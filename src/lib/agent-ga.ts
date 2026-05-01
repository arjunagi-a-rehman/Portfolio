/**
 * GA4 event helpers for the /agent page.
 *
 * The existing `window.gtag` is initialized in Layout.astro with measurement
 * id G-KPKX4ZXF47. This module wraps it with typed, named events so the
 * agent surface gets consistent, PII-free analytics across every firing site.
 *
 * Every function here:
 *   - no-ops if gtag is missing (ad-block, DNT, not-yet-loaded)
 *   - never transmits the raw user query — length bucket only
 *   - never throws — analytics failure must not break the chat UX
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Length bucket for question volume analytics. Raw length is NOT sent.
 *   short   <50 chars   — filler / quick ping
 *   medium  50-200      — typical question
 *   long    >200        — essay-style prompts
 */
export type QuestionLengthBucket = 'short' | 'medium' | 'long';

export function bucketizeQuestionLength(text: string): QuestionLengthBucket {
  const n = text.length;
  if (n < 50) return 'short';
  if (n <= 200) return 'medium';
  return 'long';
}

/** Source category of a cited node. Mirrors NODE_SOURCES in mcp-server. */
export type NodeSourceForAnalytics =
  | 'project'
  | 'essay'
  | 'about'
  | 'experience'
  | 'thinking';

/**
 * Free-form placement identifier — which surface fired the question. Required.
 * Common values: "agent-page" (the dedicated /agent route), "home-hero",
 * "essay-software-can-talk", "project-kalrav", "project-routeeye". Free-form
 * so adding a new placement is one prop, no schema migration here.
 */
export type AgentSurface = string;

// ---------------------------------------------------------------------------
// gtag accessor — safe under every condition
// ---------------------------------------------------------------------------

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === 'undefined') return undefined;
  const g = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof g === 'function' ? g : undefined;
}

function send(eventName: string, params: Record<string, unknown>): void {
  try {
    const gtag = getGtag();
    if (!gtag) return; // ad-block, DNT, dev, not yet loaded — silent no-op
    gtag('event', eventName, params);
  } catch {
    // analytics must never break the product
  }
}

// ---------------------------------------------------------------------------
// Event emitters
// ---------------------------------------------------------------------------

/**
 * Fired the moment a user submits a question on any agent surface.
 * Does NOT include the query text — only a length bucket.
 *
 * `surface` is required — defaulting to a single value silently buckets new
 * placements into the wrong column and the GA dashboard lies. Every caller
 * passes its placement explicitly.
 */
export function trackQuestionAsked(
  query: string,
  sessionId: string,
  hasHistory: boolean,
  surface: AgentSurface,
): void {
  send('agent_question_asked', {
    question_length: bucketizeQuestionLength(query),
    session_id: sessionId,
    is_followup: hasHistory,
    surface,
  });
}

/**
 * Fired when the server returns a no-match response (router found nothing
 * relevant). One event per no-match turn.
 */
export function trackNoMatch(sessionId: string): void {
  send('agent_no_match', {
    session_id: sessionId,
  });
}

/**
 * Fired once per citation that appears in a successful response. Useful for
 * seeing which nodes the agent is actually drawing on in practice.
 */
export function trackNodeCited(
  nodeId: string,
  nodeSource: NodeSourceForAnalytics,
  sessionId: string,
): void {
  send('node_cited', {
    node_id: nodeId,
    node_source: nodeSource,
    session_id: sessionId,
  });
}

/**
 * Fired when the user clicks the "Send a note" / "Drop a note directly"
 * mailto link from no-match or error state. Signals a handoff from agent
 * to direct contact — high-intent, worth tracking.
 */
export function trackHandoffToContact(
  sessionId: string,
  from: 'no-match' | 'error',
): void {
  send('agent_handoff_to_contact', {
    session_id: sessionId,
    from_state: from,
  });
}
