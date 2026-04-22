import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadNodes,
  getNodeSummaries,
  getNodesByIds,
  clearNodeCache,
} from "./nodes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_NODE = `---
id: test-node
title: "Test Node"
source: project
url: /projects/test
date: "2025-01-01"
tags:
  - testing
summary: "A test node for unit tests."
---

This is the body of the test node.
`;

const MISSING_SUMMARY = `---
id: bad-node
title: "Bad Node"
source: essay
url: /bad
---

No summary field.
`;

const INVALID_SOURCE = `---
id: bad-source
title: "Bad Source"
source: unknown_type
url: /bad
summary: "Bad source type."
---

Body.
`;

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "mcp-nodes-test-"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadNodes", () => {
  let dir: string;

  beforeEach(async () => {
    clearNodeCache();
    dir = await createTempDir();
  });

  afterEach(async () => {
    clearNodeCache();
    await rm(dir, { recursive: true, force: true });
  });

  it("loads valid nodes from a directory", async () => {
    await writeFile(join(dir, "test.md"), VALID_NODE);

    const nodes = await loadNodes(dir);

    expect(nodes).toHaveLength(1);
    const node = nodes[0]!;
    expect(node.frontmatter.id).toBe("test-node");
    expect(node.frontmatter.title).toBe("Test Node");
    expect(node.frontmatter.source).toBe("project");
    expect(node.frontmatter.tags).toEqual(["testing"]);
    expect(node.body).toContain("body of the test node");
  });

  it("returns empty array for empty directory", async () => {
    const nodes = await loadNodes(dir);
    expect(nodes).toHaveLength(0);
  });

  it("returns empty array for non-existent directory", async () => {
    const nodes = await loadNodes("/does/not/exist");
    expect(nodes).toHaveLength(0);
  });

  it("skips nodes with missing required frontmatter fields", async () => {
    await writeFile(join(dir, "bad.md"), MISSING_SUMMARY);
    const nodes = await loadNodes(dir);
    expect(nodes).toHaveLength(0);
  });

  it("skips nodes with invalid source enum", async () => {
    await writeFile(join(dir, "bad-source.md"), INVALID_SOURCE);
    const nodes = await loadNodes(dir);
    expect(nodes).toHaveLength(0);
  });

  it("loads nodes from nested subdirectories", async () => {
    const subdir = join(dir, "projects");
    await mkdir(subdir, { recursive: true });
    await writeFile(join(subdir, "test.md"), VALID_NODE);

    const nodes = await loadNodes(dir);
    expect(nodes).toHaveLength(1);
  });

  it("caches results on second call", async () => {
    await writeFile(join(dir, "test.md"), VALID_NODE);

    const first = await loadNodes(dir);
    // Write another file — should NOT appear due to cache
    await writeFile(join(dir, "second.md"), VALID_NODE.replace("test-node", "second-node"));
    const second = await loadNodes(dir);

    expect(first).toBe(second); // same object reference = cache hit
    expect(second).toHaveLength(1);
  });

  it("clearNodeCache() forces reload", async () => {
    await writeFile(join(dir, "test.md"), VALID_NODE);
    await loadNodes(dir);

    clearNodeCache();
    await writeFile(join(dir, "second.md"), VALID_NODE.replace("test-node", "second-node"));
    const nodes = await loadNodes(dir);

    expect(nodes).toHaveLength(2);
  });
});

describe("getNodeSummaries", () => {
  let dir: string;

  beforeEach(async () => {
    clearNodeCache();
    dir = await createTempDir();
    await writeFile(join(dir, "test.md"), VALID_NODE);
  });

  afterEach(async () => {
    clearNodeCache();
    await rm(dir, { recursive: true, force: true });
  });

  it("returns id, title, summary, tags only", async () => {
    const summaries = await getNodeSummaries(dir);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual({
      id: "test-node",
      title: "Test Node",
      summary: "A test node for unit tests.",
      tags: ["testing"],
    });
    // Should not contain body or url
    expect(summaries[0]).not.toHaveProperty("body");
    expect(summaries[0]).not.toHaveProperty("url");
  });
});

describe("getNodesByIds", () => {
  let dir: string;

  beforeEach(async () => {
    clearNodeCache();
    dir = await createTempDir();
    await writeFile(join(dir, "test.md"), VALID_NODE);
  });

  afterEach(async () => {
    clearNodeCache();
    await rm(dir, { recursive: true, force: true });
  });

  it("returns nodes matching the given IDs", async () => {
    const nodes = await getNodesByIds(["test-node"], dir);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.frontmatter.id).toBe("test-node");
  });

  it("returns empty array when no IDs match", async () => {
    const nodes = await getNodesByIds(["nonexistent"], dir);
    expect(nodes).toHaveLength(0);
  });

  it("returns empty array for empty ID list", async () => {
    const nodes = await getNodesByIds([], dir);
    expect(nodes).toHaveLength(0);
  });

  it("deduplicates when the same ID is requested twice", async () => {
    const nodes = await getNodesByIds(["test-node", "test-node"], dir);
    // Set-based filter means duplicates in IDs still return one node
    expect(nodes).toHaveLength(1);
  });
});
