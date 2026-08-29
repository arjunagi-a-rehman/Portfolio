// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
});

function selectTerm() {
  const term = document.getElementById('selected-term');
  if (!term) throw new Error('missing selected term');
  const range = document.createRange();
  range.selectNodeContents(term);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({
      top: 120,
      right: 260,
      bottom: 142,
      left: 180,
      width: 80,
      height: 22,
      x: 180,
      y: 120,
      toJSON: () => ({}),
    }),
  });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

function mountPage() {
  document.title = 'Architecture — Portfolio';
  document.body.innerHTML = `
    <main id="main-content">
      <section>
        <h2>Architecture</h2>
        <p>A <strong id="selected-term">monolith</strong> keeps the application together.</p>
      </section>
    </main>`;
  render(<GlobalSelectionAI mcpServerUrl="https://agent.example" />);
}

describe('GlobalSelectionAI', () => {
  it('offers the two actions and moves selected text into the chat drawer', async () => {
    mountPage();
    selectTerm();

    const addButton = await screen.findByRole('button', {
      name: /add to chat/i,
    });
    expect(screen.getByRole('button', { name: /explain here/i })).toBeTruthy();
    fireEvent.click(addButton);

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

    expect(screen.getByText('Explaining')).toBeTruthy();
    expect(answerRegion?.contains(selectedText)).toBe(false);
    expect(answerRegion?.contains(continueButton)).toBe(false);
  });

  it('keeps an open explanation visible while the page scrolls', async () => {
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

    fireEvent.scroll(window);

    expect(screen.getByText(/one deployable application/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /close explanation/i }),
    ).toBeTruthy();
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
    fireEvent(window, new Event('resize'));

    expect(panel?.style.width).toBe('');
    expect(closeButton).toBeTruthy();
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

    expect(panel?.style.top).toBe('12px');
    expect(panel?.style.maxHeight).toBe('376px');
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
