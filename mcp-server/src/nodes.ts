import { readdir, readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { NodeFrontmatterSchema, type KnowledgeNode } from "./types.js";

// ---------------------------------------------------------------------------
// Node loader — reads all *.md files under nodes/ and validates frontmatter
// ---------------------------------------------------------------------------

// Resolve relative to this file — works in both Bun and Node/Vitest
const __dirname = dirname(fileURLToPath(import.meta.url));
const NODES_DIR = join(__dirname, "..", "nodes");

/** In-memory cache. Populated once on first call to loadNodes() */
let _cache: KnowledgeNode[] | null = null;

/**
 * Load all knowledge nodes from the nodes/ directory.
 * Results are cached in-memory for the lifetime of the process.
 */
export async function loadNodes(
  nodesDir: string = NODES_DIR
): Promise<KnowledgeNode[]> {
  if (_cache) return _cache;

  const nodes: KnowledgeNode[] = [];
  const files = await collectMarkdownFiles(nodesDir);

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = matter(raw);

    const parsed = NodeFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      console.error(
        `[nodes] Skipping ${filePath} — invalid frontmatter: ${parsed.error.message}`
      );
      continue;
    }

    nodes.push({ frontmatter: parsed.data, body: content.trim() });
  }

  console.log(`[nodes] Loaded ${nodes.length} nodes from ${nodesDir}`);
  _cache = nodes;
  return nodes;
}

/** Returns nodes suitable for the router — id + title + summary + tags only */
export async function getNodeSummaries(
  nodesDir?: string
): Promise<Array<{ id: string; title: string; summary: string; tags: string[] }>> {
  const nodes = await loadNodes(nodesDir);
  return nodes.map(({ frontmatter: f }) => ({
    id: f.id,
    title: f.title,
    summary: f.summary,
    tags: f.tags,
  }));
}

/** Look up full nodes by IDs returned from the router */
export async function getNodesByIds(
  ids: string[],
  nodesDir?: string
): Promise<KnowledgeNode[]> {
  const nodes = await loadNodes(nodesDir);
  const idSet = new Set(ids);
  return nodes.filter((n) => idSet.has(n.frontmatter.id));
}

/** Wipe the cache — useful in tests */
export function clearNodeCache(): void {
  _cache = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    // withFileTypes: false returns plain string[] of relative paths
    const raw = await readdir(dir, { recursive: true, encoding: "utf-8" });
    entries = raw as string[];
  } catch {
    return [];
  }

  return entries
    .filter((e) => extname(e) === ".md")
    .map((e) => join(dir, e))
    .sort();
}
