/**
 * Unit tests for responder.ts post-processors.
 *
 * Focused on the pure functions — stripPhantomCitations + extractCitations —
 * that form the hallucination-defense layer. The LLM can emit [fake-id]
 * strings and we must scrub anything that isn't in the validIds set before
 * the answer reaches the user.
 *
 * The full generateAnswer / generateAnswerStream pipeline is covered by
 * integration tests in tests/integration/ask.test.ts, which mock those
 * functions at the module level. Direct unit testing here keeps the
 * post-processor contract pinned without needing to mock the Anthropic SDK.
 */
import { describe, it, expect } from "vitest";
import { stripPhantomCitations, extractCitations } from "./responder.js";
import type { KnowledgeNode } from "./types.js";

const NODE_KALRAV: KnowledgeNode = {
  frontmatter: {
    id: "kalrav-ai",
    title: "Kalrav.AI",
    source: "project",
    url: "/projects/kalrav",
    tags: ["ai-agents"],
    summary: "Vertical AI agent platform.",
  },
  body: "Kalrav body.",
};

const NODE_ESSAY: KnowledgeNode = {
  frontmatter: {
    id: "essay-coders-to-owners",
    title: "From Coders to Owners",
    source: "essay",
    url: "/essays/coders-to-owners",
    tags: ["ai"],
    summary: "Ownership in the AI era.",
  },
  body: "Essay body.",
};

// ---------------------------------------------------------------------------
// stripPhantomCitations
// ---------------------------------------------------------------------------

describe("stripPhantomCitations", () => {
  it("keeps markers whose IDs are in the valid set", () => {
    const out = stripPhantomCitations(
      "Kalrav [kalrav-ai] is real.",
      new Set(["kalrav-ai"])
    );
    expect(out).toBe("Kalrav [kalrav-ai] is real.");
  });

  it("strips markers whose IDs are NOT in the valid set", () => {
    const out = stripPhantomCitations(
      "[kalrav-ai] is real. [hallucinated] is not. [another-fake] also not.",
      new Set(["kalrav-ai"])
    );
    expect(out).toBe("[kalrav-ai] is real.  is not.  also not.");
  });

  it("strips everything when validIds is empty", () => {
    const out = stripPhantomCitations(
      "[a] [b] text [c]",
      new Set()
    );
    expect(out).toBe("  text ");
  });

  it("is a no-op when the answer has no bracket markers", () => {
    const input = "Plain text with no citations at all.";
    expect(stripPhantomCitations(input, new Set(["kalrav-ai"]))).toBe(input);
  });

  it("keeps multiple valid markers", () => {
    const out = stripPhantomCitations(
      "[kalrav-ai] and [essay-coders-to-owners] together.",
      new Set(["kalrav-ai", "essay-coders-to-owners"])
    );
    expect(out).toBe("[kalrav-ai] and [essay-coders-to-owners] together.");
  });

  it("strips nested-looking bracket content by treating the innermost match", () => {
    // The regex is greedy-free — /\[([^\]]+)\]/g matches the first ] it sees
    const out = stripPhantomCitations(
      "Has a [fake-id] here",
      new Set(["kalrav-ai"])
    );
    expect(out).toBe("Has a  here");
  });
});

// ---------------------------------------------------------------------------
// extractCitations
// ---------------------------------------------------------------------------

describe("extractCitations", () => {
  it("returns a Citation for each valid [id] marker in the answer", () => {
    const out = extractCitations(
      "Kalrav [kalrav-ai] is a platform.",
      [NODE_KALRAV]
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: "kalrav-ai",
      title: "Kalrav.AI",
      url: "/projects/kalrav",
      source: "project",
    });
  });

  it("deduplicates repeated markers, keeping first-appearance order", () => {
    const out = extractCitations(
      "[kalrav-ai] and [kalrav-ai] again and [kalrav-ai] thrice.",
      [NODE_KALRAV]
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("kalrav-ai");
  });

  it("returns multiple citations in order of first appearance", () => {
    const out = extractCitations(
      "First [essay-coders-to-owners] then [kalrav-ai].",
      [NODE_KALRAV, NODE_ESSAY]
    );
    expect(out.map((c) => c.id)).toEqual([
      "essay-coders-to-owners",
      "kalrav-ai",
    ]);
  });

  it("ignores markers whose IDs aren't in the nodes list", () => {
    const out = extractCitations(
      "Real: [kalrav-ai]. Fake: [phantom-node].",
      [NODE_KALRAV]
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("kalrav-ai");
  });

  it("returns an empty array when the answer has no markers", () => {
    const out = extractCitations("Plain text.", [NODE_KALRAV]);
    expect(out).toEqual([]);
  });

  it("returns an empty array when the nodes list is empty", () => {
    const out = extractCitations("[kalrav-ai] present", []);
    expect(out).toEqual([]);
  });

  it("carries through the correct source type for essay vs project", () => {
    const out = extractCitations(
      "[kalrav-ai] and [essay-coders-to-owners]",
      [NODE_KALRAV, NODE_ESSAY]
    );
    expect(out.find((c) => c.id === "kalrav-ai")!.source).toBe("project");
    expect(out.find((c) => c.id === "essay-coders-to-owners")!.source).toBe("essay");
  });
});
