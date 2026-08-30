import type { PageSelectionContext } from './selection-context.js';

export const ATTACH_PAGE_SELECTION_EVENT = 'agent:attach-page-selection';

export interface AttachPageSelectionDetail {
  context: PageSelectionContext;
}
