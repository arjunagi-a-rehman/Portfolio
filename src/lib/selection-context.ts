export const MAX_SELECTED_TEXT_LENGTH = 600;
export const MAX_SURROUNDING_TEXT_LENGTH = 1600;

export interface PageSelectionContext {
  selectedText: string;
  surroundingText: string;
  nearestHeading?: string;
  pageTitle: string;
  pathname: string;
}

export interface SelectionSnapshot {
  context: PageSelectionContext;
  rect: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  };
}

const BLOCK_SELECTOR = [
  'p',
  'li',
  'blockquote',
  'figcaption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'td',
  'th',
  '[data-selection-context]',
].join(',');

const EXCLUDED_SELECTOR = [
  '[data-selection-ai-ignore]',
  '.selection-ai-root',
  '.agent-chat',
  'nav',
  'footer',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  '[role="button"]',
  '[aria-hidden="true"]',
].join(',');

export function normalizeSelectionText(
  text: string,
  maxLength: number,
): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function elementForNode(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

function findNearestHeading(start: Element, root: Element): string | undefined {
  const ownSection = start.closest(
    'section, article, [data-selection-section]',
  );
  const sectionHeading = ownSection?.querySelector('h1, h2, h3, h4, h5, h6');
  if (sectionHeading?.textContent) {
    return normalizeSelectionText(sectionHeading.textContent, 200);
  }

  let cursor: Element | null = start;
  while (cursor && cursor !== root) {
    let previous = cursor.previousElementSibling;
    while (previous) {
      const heading = previous.matches('h1, h2, h3, h4, h5, h6')
        ? previous
        : Array.from(previous.querySelectorAll('h1, h2, h3, h4, h5, h6')).at(
            -1,
          );
      if (heading?.textContent) {
        return normalizeSelectionText(heading.textContent, 200);
      }
      previous = previous.previousElementSibling;
    }
    cursor = cursor.parentElement;
  }

  const pageHeading = root.querySelector('h1');
  return pageHeading?.textContent
    ? normalizeSelectionText(pageHeading.textContent, 200)
    : undefined;
}

export function capturePageSelection(
  selection: Selection | null,
  root: Element | null,
  pageTitle: string,
  pathname: string,
): SelectionSnapshot | null {
  if (
    !selection ||
    selection.rangeCount === 0 ||
    selection.isCollapsed ||
    !root
  ) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const start = elementForNode(range.startContainer);
  const end = elementForNode(range.endContainer);
  if (!start || !end || !root.contains(start) || !root.contains(end)) {
    return null;
  }
  if (start.closest(EXCLUDED_SELECTOR) || end.closest(EXCLUDED_SELECTOR)) {
    return null;
  }

  const selectedText = normalizeSelectionText(
    selection.toString(),
    MAX_SELECTED_TEXT_LENGTH,
  );
  if (selectedText.length < 2) return null;

  const block = start.closest(BLOCK_SELECTOR) ?? start;
  const surroundingText = normalizeSelectionText(
    block.textContent ?? selectedText,
    MAX_SURROUNDING_TEXT_LENGTH,
  );
  const rangeRect = range.getBoundingClientRect();
  const rect = {
    top: rangeRect.top,
    right: rangeRect.right,
    bottom: rangeRect.bottom,
    left: rangeRect.left,
    width: rangeRect.width,
    height: rangeRect.height,
  };

  return {
    context: {
      selectedText,
      surroundingText: surroundingText || selectedText,
      nearestHeading: findNearestHeading(block, root),
      pageTitle: normalizeSelectionText(pageTitle, 200),
      pathname: pathname.slice(0, 300),
    },
    rect,
  };
}
