import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  trackSelectionAction,
  trackSelectionExplanationCompleted,
} from '../../lib/agent-ga.js';
import {
  capturePageSelection,
  type PageSelectionContext,
  type SelectionSnapshot,
} from '../../lib/selection-context.js';
import AgentChat from './AgentChat';
import './selection-ai.css';

interface Props {
  mcpServerUrl?: string;
  contactEmail?: string;
}

type ExplanationState = {
  context: PageSelectionContext;
  rect: SelectionSnapshot['rect'];
  status: 'loading' | 'streaming' | 'done' | 'error';
  content: string;
};

function clearNativeSelection() {
  window.getSelection()?.removeAllRanges();
}

function toolbarPosition(rect: SelectionSnapshot['rect']) {
  if (window.innerWidth <= 700) return {};
  const width = 250;
  const viewportWidth = window.innerWidth;
  const left = Math.min(
    viewportWidth - width / 2 - 12,
    Math.max(width / 2 + 12, rect.left + rect.width / 2),
  );
  const top = rect.top > 64 ? rect.top - 52 : rect.bottom + 12;
  return { left, top };
}

function explanationPosition(rect: SelectionSnapshot['rect']) {
  if (window.innerWidth <= 700) return {};
  const width = Math.min(440, window.innerWidth - 24);
  const left = Math.min(
    window.innerWidth - width - 12,
    Math.max(12, rect.left + rect.width / 2 - width / 2),
  );
  const top = Math.min(
    window.innerHeight - 180,
    Math.max(12, rect.bottom + 12),
  );
  return { left, top, width };
}

export default function GlobalSelectionAI({
  mcpServerUrl = 'http://localhost:3001',
  contactEmail = 'contact@arjunagiarehman.com',
}: Props) {
  const [snapshot, setSnapshot] = useState<SelectionSnapshot | null>(null);
  const [explanation, setExplanation] = useState<ExplanationState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatSelection, setChatSelection] =
    useState<PageSelectionContext | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  const inspectSelection = useCallback(() => {
    const active = document.activeElement;
    if (active && rootRef.current?.contains(active)) return;
    setSnapshot(
      capturePageSelection(
        window.getSelection(),
        document.getElementById('main-content'),
        document.title,
        window.location.pathname,
      ),
    );
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleInspection = () => {
      clearTimeout(timer);
      timer = setTimeout(inspectSelection, 80);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      requestRef.current?.abort();
      setSnapshot(null);
      setExplanation(null);
      setDrawerOpen(false);
    };
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      // Page scrolling invalidates the selected text's viewport position, so
      // hide only the temporary action toolbar. Once an explanation has been
      // opened it is a persistent reading surface and closes explicitly via
      // its close button or Escape.
      setSnapshot(null);
    };

    document.addEventListener('selectionchange', scheduleInspection);
    document.addEventListener('keyup', scheduleInspection);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
      document.removeEventListener('selectionchange', scheduleInspection);
      document.removeEventListener('keyup', scheduleInspection);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [inspectSelection]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const addToChat = useCallback(
    (
      context: PageSelectionContext,
      action: 'add_to_chat' | 'continue_in_chat' = 'add_to_chat',
    ) => {
      trackSelectionAction(action, context.selectedText, context.pathname);
      setChatSelection(context);
      setDrawerOpen(true);
      setSnapshot(null);
      setExplanation(null);
      clearNativeSelection();
    },
    [],
  );

  const explainHere = useCallback(
    async (selected: SelectionSnapshot) => {
      trackSelectionAction(
        'explain_here',
        selected.context.selectedText,
        selected.context.pathname,
      );
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setSnapshot(null);
      clearNativeSelection();
      setExplanation({
        context: selected.context,
        rect: selected.rect,
        status: 'loading',
        content: '',
      });

      const timeoutId = setTimeout(() => controller.abort(), 60_000);
      try {
        const response = await fetch(`${mcpServerUrl}/explain`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(selected.context),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Server error ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\n\n/);
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            let event = 'message';
            let data = '';
            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              if (line.startsWith('data:')) data += line.slice(5).trim();
            }
            if (!data) continue;
            if (event === 'token') {
              const { text } = JSON.parse(data) as { text: string };
              setExplanation((current) =>
                current
                  ? {
                      ...current,
                      status: 'streaming',
                      content: current.content + text,
                    }
                  : current,
              );
            } else if (event === 'done') {
              const { latencyMs } = JSON.parse(data) as { latencyMs?: number };
              trackSelectionExplanationCompleted(
                selected.context.pathname,
                latencyMs,
                'success',
              );
              setExplanation((current) =>
                current ? { ...current, status: 'done' } : current,
              );
            } else if (event === 'error') {
              const { message } = JSON.parse(data) as { message: string };
              throw new Error(message);
            }
          }
        }
      } catch (error) {
        const content =
          error instanceof Error && error.name === 'AbortError'
            ? 'The explanation took too long. Please try again.'
            : error instanceof Error
              ? error.message
              : 'Unable to explain this selection.';
        trackSelectionExplanationCompleted(
          selected.context.pathname,
          undefined,
          'error',
        );
        setExplanation((current) =>
          current ? { ...current, status: 'error', content } : current,
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [mcpServerUrl],
  );

  const currentPath =
    chatSelection?.pathname ??
    (typeof window === 'undefined' ? '/' : window.location.pathname);
  const currentTitle =
    chatSelection?.pageTitle ??
    (typeof document === 'undefined' ? 'Arjunagi A. Rehman' : document.title);
  const contextHint = `the page '${currentTitle}' (${currentPath})`.slice(
    0,
    160,
  );

  return (
    <div className="selection-ai-root" data-selection-ai-ignore ref={rootRef}>
      {snapshot && (
        <div
          className="selection-ai-toolbar"
          role="toolbar"
          aria-label="Actions for selected text"
          style={toolbarPosition(snapshot.rect)}
        >
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => addToChat(snapshot.context)}
          >
            Add to chat
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => explainHere(snapshot)}
          >
            Explain here
          </button>
        </div>
      )}

      {explanation && (
        <aside
          className="selection-ai-explanation"
          style={explanationPosition(explanation.rect)}
          aria-live="polite"
        >
          <div className="selection-ai-explanation-head">
            <span>AI explanation</span>
            <button
              type="button"
              onClick={() => {
                requestRef.current?.abort();
                setExplanation(null);
              }}
              aria-label="Close explanation"
            >
              ×
            </button>
          </div>
          <blockquote>“{explanation.context.selectedText}”</blockquote>
          <div className="selection-ai-explanation-body">
            {explanation.status === 'loading' ? (
              <span className="selection-ai-thinking">
                Reading the context…
              </span>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {explanation.content}
              </ReactMarkdown>
            )}
            {explanation.status === 'streaming' && (
              <span className="selection-ai-cursor" aria-hidden="true">
                ▍
              </span>
            )}
          </div>
          {explanation.status === 'done' && (
            <button
              type="button"
              className="selection-ai-continue"
              onClick={() => addToChat(explanation.context, 'continue_in_chat')}
            >
              Continue in chat →
            </button>
          )}
        </aside>
      )}

      {drawerOpen && (
        <>
          <button
            type="button"
            className="selection-ai-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close AI conversation"
          />
          <aside
            className="selection-ai-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Ask AI about this page"
          >
            <header className="selection-ai-drawer-head">
              <div>
                <span className="selection-ai-drawer-kicker">PAGE CONTEXT</span>
                <h2>Ask about this page</h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close AI conversation"
              >
                ×
              </button>
            </header>
            <div className="selection-ai-drawer-chat">
              <AgentChat
                variant="inline"
                chips={[]}
                surface={`selection-drawer:${currentPath}`}
                contextHint={contextHint}
                selectionContext={chatSelection}
                onSelectionConsumed={() => setChatSelection(null)}
                mcpServerUrl={mcpServerUrl}
                contactEmail={contactEmail}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
