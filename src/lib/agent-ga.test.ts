// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bucketizeQuestionLength,
  trackQuestionAsked,
  trackNoMatch,
  trackNodeCited,
  trackHandoffToContact,
} from "./agent-ga.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function installGtag(): ReturnType<typeof vi.fn> {
  const gtag = vi.fn();
  (window as unknown as { gtag: typeof gtag }).gtag = gtag;
  return gtag;
}

function removeGtag(): void {
  delete (window as Partial<{ gtag: unknown }>).gtag;
}

// ---------------------------------------------------------------------------
// bucketizeQuestionLength
// ---------------------------------------------------------------------------

describe("bucketizeQuestionLength", () => {
  it("returns 'short' for inputs under 50 chars", () => {
    expect(bucketizeQuestionLength("")).toBe("short");
    expect(bucketizeQuestionLength("hi")).toBe("short");
    expect(bucketizeQuestionLength("a".repeat(49))).toBe("short");
  });

  it("returns 'medium' for 50-200 chars (inclusive on 200)", () => {
    expect(bucketizeQuestionLength("a".repeat(50))).toBe("medium");
    expect(bucketizeQuestionLength("a".repeat(100))).toBe("medium");
    expect(bucketizeQuestionLength("a".repeat(200))).toBe("medium");
  });

  it("returns 'long' for inputs over 200 chars", () => {
    expect(bucketizeQuestionLength("a".repeat(201))).toBe("long");
    expect(bucketizeQuestionLength("a".repeat(500))).toBe("long");
  });
});

// ---------------------------------------------------------------------------
// Event senders — gtag present
// ---------------------------------------------------------------------------

describe("event senders with gtag installed", () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtag = installGtag();
  });

  afterEach(() => {
    removeGtag();
  });

  it("trackQuestionAsked sends bucket + session + followup flag + surface, no raw query", () => {
    trackQuestionAsked("a short question", "sess-1", false, "agent-page");
    expect(gtag).toHaveBeenCalledWith("event", "agent_question_asked", {
      question_length: "short",
      session_id: "sess-1",
      is_followup: false,
      surface: "agent-page",
    });
    // The raw query should never appear in the payload
    const [, , payload] = gtag.mock.calls[0]!;
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("short question");
  });

  it("trackQuestionAsked flags follow-ups correctly", () => {
    trackQuestionAsked("q", "sess-2", true, "home-hero");
    expect(gtag).toHaveBeenCalledWith("event", "agent_question_asked", {
      question_length: "short",
      session_id: "sess-2",
      is_followup: true,
      surface: "home-hero",
    });
  });

  it("trackQuestionAsked propagates surface verbatim for any placement", () => {
    trackQuestionAsked("q", "sess-7", false, "essay-software-can-talk");
    expect(gtag).toHaveBeenCalledWith("event", "agent_question_asked", {
      question_length: "short",
      session_id: "sess-7",
      is_followup: false,
      surface: "essay-software-can-talk",
    });
  });

  it("trackNoMatch sends session_id only", () => {
    trackNoMatch("sess-3");
    expect(gtag).toHaveBeenCalledWith("event", "agent_no_match", {
      session_id: "sess-3",
    });
  });

  it("trackNodeCited sends id + source + session", () => {
    trackNodeCited("kalrav-ai", "project", "sess-4");
    expect(gtag).toHaveBeenCalledWith("event", "node_cited", {
      node_id: "kalrav-ai",
      node_source: "project",
      session_id: "sess-4",
    });
  });

  it("trackHandoffToContact distinguishes no-match from error handoffs", () => {
    trackHandoffToContact("sess-5", "no-match");
    trackHandoffToContact("sess-6", "error");
    expect(gtag).toHaveBeenNthCalledWith(1, "event", "agent_handoff_to_contact", {
      session_id: "sess-5",
      from_state: "no-match",
    });
    expect(gtag).toHaveBeenNthCalledWith(2, "event", "agent_handoff_to_contact", {
      session_id: "sess-6",
      from_state: "error",
    });
  });
});

// ---------------------------------------------------------------------------
// Event senders — gtag missing (DNT, ad-block, dev, etc.)
// ---------------------------------------------------------------------------

describe("event senders are safe when gtag is missing", () => {
  beforeEach(() => removeGtag());

  it("every emitter is a no-op and does not throw", () => {
    expect(() => trackQuestionAsked("q", "sess", false, "agent-page")).not.toThrow();
    expect(() => trackNoMatch("sess")).not.toThrow();
    expect(() => trackNodeCited("id", "project", "sess")).not.toThrow();
    expect(() => trackHandoffToContact("sess", "no-match")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Event senders — gtag throws
// ---------------------------------------------------------------------------

describe("event senders swallow gtag errors", () => {
  beforeEach(() => {
    (window as unknown as { gtag: () => void }).gtag = () => {
      throw new Error("ad-block denied call");
    };
  });

  afterEach(() => removeGtag());

  it("does not propagate gtag throws to callers", () => {
    expect(() => trackQuestionAsked("q", "sess", false, "agent-page")).not.toThrow();
    expect(() => trackNoMatch("sess")).not.toThrow();
    expect(() => trackNodeCited("id", "project", "sess")).not.toThrow();
    expect(() => trackHandoffToContact("sess", "error")).not.toThrow();
  });
});
