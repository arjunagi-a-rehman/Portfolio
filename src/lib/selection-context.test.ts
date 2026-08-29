// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  capturePageSelection,
  MAX_SELECTED_TEXT_LENGTH,
  normalizeSelectionText,
} from './selection-context';

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

function selectNodeText(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({
      top: 100,
      right: 240,
      bottom: 120,
      left: 140,
      width: 100,
      height: 20,
      x: 140,
      y: 100,
      toJSON: () => ({}),
    }),
  });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return selection;
}

describe('capturePageSelection', () => {
  it('captures selected, surrounding, section, and route context', () => {
    document.body.innerHTML = `
      <main id="main-content">
        <h1>Portfolio</h1>
        <section>
          <h2>Architecture</h2>
          <p>A <strong id="term">monolith</strong> keeps the application in one deployable unit.</p>
        </section>
      </main>`;
    const term = document.getElementById('term');
    if (!term) throw new Error('missing test selection term');
    const snapshot = capturePageSelection(
      selectNodeText(term),
      document.getElementById('main-content'),
      'Architecture — Portfolio',
      '/projects/example',
    );

    expect(snapshot?.context).toMatchObject({
      selectedText: 'monolith',
      surroundingText:
        'A monolith keeps the application in one deployable unit.',
      nearestHeading: 'Architecture',
      pageTitle: 'Architecture — Portfolio',
      pathname: '/projects/example',
    });
    expect(snapshot?.rect.left).toBe(140);
  });

  it('ignores selections inside agent controls', () => {
    document.body.innerHTML = `
      <main id="main-content">
        <div class="agent-chat"><p id="answer">Generated answer</p></div>
      </main>`;
    const answer = document.getElementById('answer');
    if (!answer) throw new Error('missing test answer');

    expect(
      capturePageSelection(
        selectNodeText(answer),
        document.getElementById('main-content'),
        'Agent',
        '/agent',
      ),
    ).toBeNull();
  });

  it('normalizes whitespace and enforces the selection cap', () => {
    const text = `  ${'word '.repeat(MAX_SELECTED_TEXT_LENGTH)}  `;
    const normalized = normalizeSelectionText(text, MAX_SELECTED_TEXT_LENGTH);
    expect(normalized.length).toBe(MAX_SELECTED_TEXT_LENGTH);
    expect(normalized.startsWith('word word')).toBe(true);
  });
});
