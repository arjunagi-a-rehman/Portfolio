// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import AgentChat from './AgentChat';
import GlobalSelectionAI from './GlobalSelectionAI';

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
  window.localStorage.clear();
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1024,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 768,
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0,
  });
  vi.restoreAllMocks();
});

function selectTerm(
  rect = {
    top: 120,
    right: 260,
    bottom: 142,
    left: 180,
    width: 80,
    height: 22,
  },
) {
  const term = document.getElementById('selected-term');
  if (!term) throw new Error('missing selected term');
  const range = document.createRange();
  range.selectNodeContents(term);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({
      ...rect,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

function mountPage(withExistingChat = false) {
  document.title = 'Architecture — Portfolio';
  document.body.innerHTML = `
    <main id="main-content">
      <section>
        <h2>Architecture</h2>
        <p>A <strong id="selected-term">monolith</strong> keeps the application together.</p>
      </section>
    </main>`;
  render(
    <>
      <GlobalSelectionAI mcpServerUrl="https://agent.example" />
      {withExistingChat && (
        <AgentChat
          variant="inline"
          chips={[]}
          surface="home-hero"
          mcpServerUrl="https://agent.example"
        />
      )}
    </>,
  );
}

describe('GlobalSelectionAI', () => {
  it('attaches selected text to the existing page chat without a drawer', async () => {
    mountPage(true);
    selectTerm();

    const addButton = await screen.findByRole('button', {
      name: /add to chat/i,
    });
    expect(screen.getByRole('button', { name: /explain here/i })).toBeTruthy();
    fireEvent.click(addButton);

    expect(await screen.findByText('“monolith”')).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: /ask a question/i }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses the chat drawer only when the page has no mounted chat', async () => {
    mountPage();
    selectTerm();

    fireEvent.click(
      await screen.findByRole('button', { name: /add to chat/i }),
    );

    expect(
      screen.getByRole('dialog', { name: /ask ai about this page/i }),
    ).toBeTruthy();
    expect(screen.getByText('“monolith”')).toBeTruthy();
  });

  it('streams a one-shot explanation without opening the chat drawer', async () => {
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm();

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/one deployable application/i)).toBeTruthy();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('button', { name: /continue in chat/i }),
    ).toBeTruthy();
  });

  it('keeps the selected text and chat action outside the scrolling answer', async () => {
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm();

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    const answer = await screen.findByText(/one deployable application/i);
    const answerRegion = answer.closest('.selection-ai-explanation-body');
    const selectedText = screen.getByText('“monolith”');
    const continueButton = screen.getByRole('button', {
      name: /continue in chat/i,
    });

    expect(screen.getByText(/Explaining · Architecture/i)).toBeTruthy();
    expect(answerRegion?.contains(selectedText)).toBe(false);
    expect(answerRegion?.contains(continueButton)).toBe(false);
  });

  it('keeps an open explanation attached to its selection while scrolling', async () => {
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm();

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    await screen.findByText(/one deployable application/i);
    const panel = screen
      .getByRole('button', { name: /close explanation/i })
      .closest('aside');
    expect(panel?.style.top).toBe('150px');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 100,
    });
    fireEvent.scroll(window);

    expect(screen.getByText(/one deployable application/i)).toBeTruthy();
    expect(panel?.style.top).toBe('50px');
    expect(window.getSelection()?.toString()).toBe('monolith');
    expect(
      screen.getByRole('button', { name: /close explanation/i }),
    ).toBeTruthy();
  });

  it('dismisses an explanation when the reader clicks elsewhere on the page', async () => {
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm();
    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    await screen.findByText(/one deployable application/i);

    const main = document.getElementById('main-content');
    if (!main) throw new Error('missing main content');
    fireEvent.pointerDown(main);

    expect(screen.queryByText(/one deployable application/i)).toBeNull();
    expect(window.getSelection()?.toString()).toBe('');
  });

  it('recomputes the explanation layout after a viewport resize', async () => {
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm();

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    const closeButton = await screen.findByRole('button', {
      name: /close explanation/i,
    });
    const panel = closeButton.closest('aside');
    expect(panel?.style.width).toBe('440px');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 180,
    });
    fireEvent(window, new Event('resize'));

    expect(panel?.style.width).toBe('440px');
    expect(panel?.style.left).toBe('12px');
    expect(panel?.style.top).toBe('');
    expect(panel?.style.bottom).toBe('68px');
    expect(panel?.style.maxHeight).toBe('100px');
    expect(closeButton).toBeTruthy();
  });

  it('switches sides when scrolling moves the selection across the viewport', async () => {
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm({
      top: 600,
      right: 260,
      bottom: 622,
      left: 180,
      width: 80,
      height: 22,
    });

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    const panel = screen
      .getByRole('button', { name: /close explanation/i })
      .closest('aside');
    expect(panel?.style.top).toBe('');
    expect(panel?.style.bottom).toBe('176px');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 500,
    });
    fireEvent.scroll(window);

    expect(panel?.style.bottom).toBe('');
    expect(panel?.style.top).toBe('130px');
    expect(screen.getByText('“monolith”')).toBeTruthy();
  });

  it('never sizes the explanation beyond the available viewport space', async () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 140,
    });
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm({
      top: 60,
      right: 260,
      bottom: 82,
      left: 180,
      width: 80,
      height: 22,
    });

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    const panel = screen
      .getByRole('button', { name: /close explanation/i })
      .closest('aside');

    expect(panel?.style.top).toBe('');
    expect(panel?.style.bottom).toBe('88px');
    expect(panel?.style.maxHeight).toBe('40px');
  });

  it('keeps the full explanation card within a short desktop viewport', async () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 400,
    });
    const payload =
      'event: token\ndata: {"text":"A monolith is one deployable application."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    mountPage();
    selectTerm();

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    const closeButton = await screen.findByRole('button', {
      name: /close explanation/i,
    });
    const panel = closeButton.closest('aside');

    expect(panel?.style.top).toBe('150px');
    expect(panel?.style.maxHeight).toBe('238px');
  });

  it('ignores updates from a superseded explanation request', async () => {
    let firstStreamController: ReadableStreamDefaultController<Uint8Array>;
    const firstResponse = new Response(
      new ReadableStream({
        start(controller) {
          firstStreamController = controller;
        },
      }),
      { status: 200 },
    );
    const secondPayload =
      'event: token\ndata: {"text":"The current explanation."}\n\n' +
      'event: done\ndata: {"latencyMs":20}\n\n';
    const secondResponse = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(secondPayload));
          controller.close();
        },
      }),
      { status: 200 },
    );
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);
    mountPage();
    selectTerm();

    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

    selectTerm();
    fireEvent.click(
      await screen.findByRole('button', { name: /explain here/i }),
    );
    await screen.findByText('The current explanation.');

    firstStreamController.enqueue(
      new TextEncoder().encode(
        'event: error\ndata: {"message":"Stale request failed."}\n\n',
      ),
    );
    firstStreamController.close();

    await waitFor(() => {
      expect(screen.queryByText('Stale request failed.')).toBeNull();
      expect(screen.getByText('The current explanation.')).toBeTruthy();
    });
  });
});
