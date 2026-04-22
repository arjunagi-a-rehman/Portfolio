/**
 * Conversational filler detection.
 *
 * Short acknowledgements ("ok", "yeah", "hmm") aren't real questions —
 * they're signals inside a conversation. With no prior context, the right
 * human response is to ask for clarification, not recite a help menu.
 * With prior context, the LLM handles them naturally.
 */

const FILLER_PATTERNS = new Set([
  "ok",
  "okay",
  "k",
  "kk",
  "hmm",
  "hmmm",
  "uh",
  "um",
  "yeah",
  "yep",
  "yup",
  "ya",
  "sure",
  "right",
  "cool",
  "nice",
  "got it",
  "alright",
  "fine",
  "oh",
  "wow",
  "huh",
  "meh",
  "lol",
  "lmao",
  "haha",
  "test",
  "hello",
  "hi",
  "hey",
  "yo",
  "sup",
]);

/**
 * True if the query is a short conversational filler — not a real question.
 * Rules: short (≤12 chars), no question mark, matches a known filler.
 */
export function isFiller(query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/[.!,]+$/, "");
  if (normalized.length > 12) return false;
  if (normalized.includes("?")) return false;
  return FILLER_PATTERNS.has(normalized);
}

/**
 * Human reactions for when someone drops a filler with no prior context.
 * Picks one deterministically based on the query so the same input always
 * gets the same reaction (feels less like a random canned response).
 */
const COLD_FILLER_REACTIONS = [
  "ok what?",
  "yeah? go ahead",
  "sorry — what did you want to know?",
  "what's on your mind?",
  "shoot",
  "hey — ask me something",
  "what's up?",
];

export function pickColdFillerReaction(query: string): string {
  const hash = [...query].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLD_FILLER_REACTIONS[hash % COLD_FILLER_REACTIONS.length]!;
}
