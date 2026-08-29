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
});
