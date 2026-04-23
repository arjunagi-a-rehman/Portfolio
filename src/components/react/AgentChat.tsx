import { Children, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './agent.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Citation {
  id: string;
  title: string;
  url: string;
  source: 'project' | 'essay' | 'about';
}

interface AskResponse {
  answer: string;
  citations: Citation[];
  noMatch: boolean;
  latencyMs: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  noMatch?: boolean;
  latencyMs?: number;
  error?: boolean;
}

type Status =
  | { kind: 'idle' }
  // 'routing' = awaiting first token (router + fetch nodes)
  // 'streaming' = tokens are actively arriving
  | { kind: 'loading'; phase: 'routing' | 'streaming' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXAMPLE_CHIPS = [
  'What is Kalrav.AI?',
  'Vertical vs horizontal AI agents?',
  'Your coders-to-owners thesis',
  'How to deploy an AI agent?',
  'Your background and stack',
];

const MAX_QUERY = 500;
/** Max prior turns sent to the backend — guards tokens + latency */
const MAX_HISTORY_TURNS = 12;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingState() {
  // Pre-token: show a thinking indicator. Once tokens start streaming in,
  // the streaming message replaces this.
  return (
    <div className="ac-loading" role="status" aria-live="polite">
      <div className="ac-thinking">
        <span className="ac-thinking-dot" />
        <span className="ac-thinking-dot" />
        <span className="ac-thinking-dot" />
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="ac-cite"
      title={citation.title}
      aria-label={`Source: ${citation.title}`}
    >
      {citation.id}
    </a>
  );
}

/**
 * Walk the string children of a markdown element and replace `[node-id]`
 * tokens with CitationChip elements. Non-string children (nested markdown
 * elements like <em>, <code>) pass through untouched — our components
 * overrides handle them recursively.
 */
function withCitations(
  children: ReactNode,
  citationMap: Map<string, Citation>
): ReactNode {
  if (citationMap.size === 0) return children;
  return Children.map(children, (child, outerIdx) => {
    if (typeof child !== 'string') return child;
    const parts = child.split(/(\[[^\]]+\])/g);
    if (parts.length === 1) return child;
    return parts.map((part, i) => {
      const m = part.match(/^\[([^\]]+)\]$/);
      if (m) {
        const cite = citationMap.get(m[1]!);
        if (cite) return <CitationChip key={`${outerIdx}-${i}`} citation={cite} />;
      }
      return part;
    });
  });
}

/**
 * Render markdown with inline citation chips. Rebuilds each element so
 * strings inside <p>, <li>, <em>, etc. get citation substitution.
 * Code blocks are intentionally excluded — we don't want `[id]` in a
 * code sample to be treated as a citation.
 */
function MarkdownAnswer({
  content,
  citations,
}: {
  content: string;
  citations: Citation[];
}) {
  const citationMap = new Map(citations.map((c) => [c.id, c]));
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p>{withCitations(children, citationMap)}</p>,
        li: ({ children }) => <li>{withCitations(children, citationMap)}</li>,
        em: ({ children }) => <em>{withCitations(children, citationMap)}</em>,
        strong: ({ children }) => (
          <strong>{withCitations(children, citationMap)}</strong>
        ),
        h1: ({ children }) => <h1>{withCitations(children, citationMap)}</h1>,
        h2: ({ children }) => <h2>{withCitations(children, citationMap)}</h2>,
        h3: ({ children }) => <h3>{withCitations(children, citationMap)}</h3>,
        h4: ({ children }) => <h4>{withCitations(children, citationMap)}</h4>,
        blockquote: ({ children }) => (
          <blockquote>{withCitations(children, citationMap)}</blockquote>
        ),
        td: ({ children }) => <td>{withCitations(children, citationMap)}</td>,
        th: ({ children }) => <th>{withCitations(children, citationMap)}</th>,
        // Open external links in a new tab
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="ac-turn ac-turn-user">
      <span className="ac-turn-chevron" aria-hidden="true">&gt;</span>
      <div className="ac-turn-content">{content}</div>
    </div>
  );
}

function AssistantMessage({
  message,
  contactHref,
  streaming = false,
}: {
  message: ChatMessage;
  /**
   * `mailto:...` URL for the handoff button. Rendered as <a href> so default
   * browser behavior works for forkers; ContactModal intercepts it for
   * Rehman's deploy via the `data-contact-trigger` attribute.
   */
  contactHref: string;
  streaming?: boolean;
}) {
  // Error state
  if (message.error) {
    return (
      <div className="ac-turn ac-turn-assistant">
        <div className="ac-error" role="alert">
          <span className="ac-error-dot" aria-hidden="true" />
          <span>{message.content}</span>
          <a
            href={contactHref}
            className="btn btn-outline ac-contact-btn"
            data-contact-trigger
          >
            Drop a note directly
          </a>
        </div>
      </div>
    );
  }

  // No-match (cold start — no history yet). Only render as fallback UI
  // after streaming completes, otherwise show the streaming text normally.
  if (message.noMatch && !streaming) {
    return (
      <div className="ac-turn ac-turn-assistant">
        <div className="ac-no-match">
          <p>{message.content}</p>
          <a
            href={contactHref}
            className="btn btn-outline ac-contact-btn"
            data-contact-trigger
          >
            Send a note instead
          </a>
        </div>
      </div>
    );
  }

  // Normal answer with inline citations and markdown rendering
  const citations = message.citations ?? [];

  return (
    <div className="ac-turn ac-turn-assistant">
      <div className="ac-response-body">
        <div className="ac-answer">
          <MarkdownAnswer content={message.content} citations={citations} />
          {streaming && (
            <span className="ac-stream-cursor" aria-hidden="true">▍</span>
          )}
        </div>

        {citations.length > 0 && (
          <div className="ac-sources">
            <span className="ac-sources-label">Sources</span>
            <div className="ac-sources-list">
              {citations.map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ac-source-item"
                >
                  <span className="ac-source-type">{c.source}</span>
                  <span className="ac-source-title">{c.title}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1.5 8.5l7-7M4 1.5h4.5V6"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}

        {typeof message.latencyMs === 'number' && (
          <div className="ac-meta-footer">
            <span className="ac-latency">
              {(message.latencyMs / 1000).toFixed(1)}s
            </span>
            {citations.length > 0 && (
              <>
                <span className="ac-meta-dot">·</span>
                <span className="ac-source-count">
                  {citations.length}{' '}
                  {citations.length === 1 ? 'source' : 'sources'}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AgentChatProps {
  mcpServerUrl?: string;
  /**
   * Email address used for the "Send a note" handoff button in no-match and
   * error states. Forkers set this via `PUBLIC_CONTACT_EMAIL` in their Astro
   * env so the button points at their inbox instead of Rehman's.
   */
  contactEmail?: string;
}

export default function AgentChat({
  mcpServerUrl = 'http://localhost:3001',
  contactEmail = 'contact@arjunagiarehman.com',
}: AgentChatProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [query, resizeTextarea]);

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Scroll to the end of the thread whenever it grows or loading appears
  useEffect(() => {
    if (messages.length > 0 || status.kind === 'loading') {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, status.kind, messages]);

  const submit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > MAX_QUERY) return;
    if (status.kind === 'loading') return;

    // Snapshot history BEFORE adding the current user turn
    const history = messages
      .filter((m) => !m.error) // error messages aren't real turns
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMsg,
      // Placeholder assistant message — content fills in as tokens stream
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setQuery('');
    setStatus({ kind: 'loading', phase: 'routing' });

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(`${mcpServerUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ query: trimmed, history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      // ── Parse SSE stream ──
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotFirstToken = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by blank lines. Split on \n\n.
        const parts = buffer.split(/\n\n/);
        buffer = parts.pop() ?? ''; // last piece may be incomplete

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;

          if (event === 'token') {
            const { text } = JSON.parse(data) as { text: string };
            if (!gotFirstToken) {
              gotFirstToken = true;
              setStatus({ kind: 'loading', phase: 'streaming' });
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + text } : m
              )
            );
          } else if (event === 'done') {
            const meta = JSON.parse(data) as {
              citations: Citation[];
              noMatch: boolean;
              latencyMs: number;
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      citations: meta.citations,
                      noMatch: meta.noMatch,
                      latencyMs: meta.latencyMs,
                    }
                  : m
              )
            );
          } else if (event === 'error') {
            const { message } = JSON.parse(data) as { message: string };
            throw new Error(message);
          }
        }
      }

      clearTimeout(timeoutId);
      setStatus({ kind: 'idle' });
    } catch (err) {
      clearTimeout(timeoutId);
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out — try a shorter question.'
          : err instanceof Error
          ? err.message
          : 'Something went wrong.';

      // Replace the placeholder assistant with an error message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: msg, error: true }
            : m
        )
      );
      setStatus({ kind: 'idle' });
    }
  }, [query, status.kind, mcpServerUrl, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter submits; Shift+Enter inserts a newline (standard chat UX)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const handleChipClick = useCallback((chip: string) => {
    setQuery(chip);
    textareaRef.current?.focus();
  }, []);

  /**
   * Pre-built mailto URL for the handoff buttons.
   *
   * Shape: mailto:<email>?subject=Question%20from%20your%20AI%20agent
   *
   * We render this as a real <a href> rather than a button-with-onclick
   * because (a) it's accessible by default, (b) right-click / long-press
   * works, and (c) forkers without our ContactModal still get a working
   * mailto out of the box. If ContactModal IS mounted on the page, its
   * delegated click handler will intercept the <a> click (it matches any
   * element with data-contact-trigger) and open its Convex-backed form
   * instead of leaving the site.
   */
  const contactHref = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(
    'Question from your AI agent',
  )}`;

  const handleReset = useCallback(() => {
    // Abort any in-flight SSE stream so tokens don't land after clear
    abortRef.current?.abort();
    setMessages([]);
    setStatus({ kind: 'idle' });
    setQuery('');
    textareaRef.current?.focus();
  }, []);

  const isLoading = status.kind === 'loading';
  const isDisabled = isLoading || query.trim().length === 0;
  const overLimit = query.length > MAX_QUERY;
  const hasThread = messages.length > 0;

  return (
    <div className="agent-chat">
      {/* ── Header ── */}
      <div className="ac-header">
        <div className="ac-section-label">
          // Agent v1.0 — Neural Interface
        </div>
        <h1 className="ac-headline">
          Ask me anything<span className="ac-cursor" aria-hidden="true">_</span>
        </h1>
        <p className="ac-subheadline">
          My thinking on AI agents, backend systems, and the builders-over-companies
          thesis — grounded in what I've actually written and shipped. Every answer
          cited.
          <br />
          <span className="ac-mcp-inline">
            Or connect your own agent:{' '}
            <code>https://mcp.arjunagiarehman.com/mcp</code>
          </span>
        </p>
      </div>

      {/* ── Example chips (only before any conversation) ── */}
      {!hasThread && (
        <div className="ac-chips" role="list" aria-label="Example questions">
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              role="listitem"
              className="ac-chip"
              onClick={() => handleChipClick(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Conversation thread ── */}
      {hasThread && (
        <div className="ac-thread" aria-live="polite">
          <div className="ac-thread-header">
            <span className="ac-thread-label">
              Conversation · {messages.filter((m) => m.role === 'user').length}{' '}
              {messages.filter((m) => m.role === 'user').length === 1 ? 'turn' : 'turns'}
            </span>
            <button
              type="button"
              className="ac-reset-btn"
              onClick={handleReset}
              aria-label="Clear conversation"
              disabled={isLoading}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Clear
            </button>
          </div>

          {messages.map((m, i) => {
            if (m.role === 'user') {
              return <UserMessage key={m.id} content={m.content} />;
            }
            const isLast = i === messages.length - 1;
            const isStreamingInto = isLast && isLoading;
            // Empty placeholder + still awaiting first token → show thinking dots
            if (isStreamingInto && m.content.length === 0) {
              return (
                <div key={m.id} className="ac-turn ac-turn-assistant">
                  <LoadingState />
                </div>
              );
            }
            return (
              <AssistantMessage
                key={m.id}
                message={m}
                contactHref={contactHref}
                streaming={isStreamingInto}
              />
            );
          })}

          <div ref={threadEndRef} />
        </div>
      )}

      {/* ── Input ── */}
      <div className="ac-prompt-group">
        <div className="ac-prompt-label">
          {hasThread ? 'Reply' : 'Your Question'}
        </div>
        <div className="ac-prompt-row">
          <span className="ac-chevron" aria-hidden="true">&gt;</span>
          <textarea
            ref={textareaRef}
            className="ac-textarea"
            rows={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasThread ? 'Ask a follow-up…' : 'What would you like to know?'}
            maxLength={MAX_QUERY + 50}
            disabled={isLoading}
            aria-label="Ask a question"
            aria-describedby="ac-char-hint"
          />
          <button
            type="button"
            className="ac-submit"
            onClick={submit}
            disabled={isDisabled || overLimit}
            aria-label="Submit question"
          >
            {hasThread ? 'Send' : 'Run'}
            <kbd className="ac-key">↵</kbd>
          </button>
        </div>
        <div className="ac-prompt-footer">
          <span id="ac-char-hint" className="ac-hint">
            {overLimit ? (
              <span className="ac-over-limit">
                {query.length}/{MAX_QUERY} — over limit
              </span>
            ) : (
              `${query.length}/${MAX_QUERY} · shift+enter for newline`
            )}
          </span>
        </div>
      </div>

      {/* ── Footer info ── */}
      <div className="ac-footer-info">
        <div className="ac-footer-item">
          <h4 className="ac-footer-label">// MCP Endpoint</h4>
          <p>
            <code>mcp.arjunagiarehman.com/mcp</code>
            <br />
            Streamable HTTP · spec 2025-03-26 · Claude Desktop, Cursor,
            mcp-inspector compatible
          </p>
        </div>
        <div className="ac-footer-item">
          <h4 className="ac-footer-label">// What to ask</h4>
          <p>
            Projects, essays, agent architecture, the "coders to owners" thesis,
            production lessons. If I haven't written about it, I'll say so.
          </p>
        </div>
      </div>
    </div>
  );
}
