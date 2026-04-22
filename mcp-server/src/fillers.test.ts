/**
 * Unit tests for fillers.ts — conversational-filler detection.
 *
 * The integration tests in ask.test.ts cover the filler *path* through
 * the SSE pipeline, but the rule-shape of isFiller (length cap, question
 * mark, trailing punctuation, case) deserves direct coverage so regressions
 * in the classifier are caught at the unit level.
 */
import { describe, it, expect } from "vitest";
import { isFiller, pickColdFillerReaction } from "./fillers.js";

describe("isFiller", () => {
  // ── Happy cases ────────────────────────────────────────────────────────
  it.each([
    "ok",
    "okay",
    "hmm",
    "yeah",
    "sure",
    "got it",
    "hello",
    "hi",
    "hey",
    "yo",
    "lol",
    "test",
  ])("classifies %p as filler", (input) => {
    expect(isFiller(input)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isFiller("OK")).toBe(true);
    expect(isFiller("Hello")).toBe(true);
    expect(isFiller("YEAH")).toBe(true);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(isFiller("  ok  ")).toBe(true);
    expect(isFiller("\tyeah\n")).toBe(true);
  });

  it("strips a trailing . ! or , before matching", () => {
    expect(isFiller("ok.")).toBe(true);
    expect(isFiller("yeah!")).toBe(true);
    expect(isFiller("sure,")).toBe(true);
    expect(isFiller("hmm...")).toBe(true);
  });

  // ── Negative cases ─────────────────────────────────────────────────────
  it("rejects queries that contain a question mark", () => {
    // "ok?" feels like a filler but a question mark signals the user
    // actually wants an answer — route it normally.
    expect(isFiller("ok?")).toBe(false);
    expect(isFiller("hey?")).toBe(false);
  });

  it("rejects queries longer than 12 characters", () => {
    // 13-char filler-ish string
    expect(isFiller("hello world x")).toBe(false);
    // Real question, even if it starts with a filler word
    expect(isFiller("hey what is kalrav")).toBe(false);
  });

  it("rejects unknown words even if short", () => {
    expect(isFiller("kalrav")).toBe(false);
    expect(isFiller("rehman")).toBe(false);
    expect(isFiller("xyz")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isFiller("")).toBe(false);
    expect(isFiller("   ")).toBe(false);
  });
});

describe("pickColdFillerReaction", () => {
  it("returns a non-empty reaction string", () => {
    const result = pickColdFillerReaction("ok");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("is deterministic — same input always yields the same reaction", () => {
    // The character-sum hash means stable queries map to a stable bucket,
    // which keeps the UX feeling less like a random canned response.
    const a = pickColdFillerReaction("ok");
    const b = pickColdFillerReaction("ok");
    expect(a).toBe(b);

    const c = pickColdFillerReaction("hmm");
    const d = pickColdFillerReaction("hmm");
    expect(c).toBe(d);
  });

  it("produces reactions from the known pool", () => {
    const pool = new Set([
      "ok what?",
      "yeah? go ahead",
      "sorry — what did you want to know?",
      "what's on your mind?",
      "shoot",
      "hey — ask me something",
      "what's up?",
    ]);
    for (const q of ["ok", "yeah", "hmm", "hi", "hey", "lol", "test", "sure"]) {
      expect(pool.has(pickColdFillerReaction(q))).toBe(true);
    }
  });
});
