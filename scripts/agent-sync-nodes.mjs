#!/usr/bin/env node
/**
 * Sync agent knowledge nodes: markdown → Convex `agentNodes` table.
 *
 * Git stays the source of truth. This script parses every markdown file
 * under mcp-server/nodes/, validates the frontmatter (same rules as the old
 * VPS server's ingest doctor), and writes a JSONL file whose rows match the
 * agentNodes schema. The npm script then hands that file to
 * `npx convex import --table agentNodes --replace`, which atomically swaps
 * the table contents.
 *
 * Usage:
 *   npm run agent:sync          # parse + import into the dev deployment
 *   npm run agent:sync:prod     # same, into the prod deployment
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import matter from 'gray-matter';

const NODES_DIR = new URL('../mcp-server/nodes/', import.meta.url).pathname;
const OUT_FILE = new URL('./.agent-nodes.jsonl', import.meta.url).pathname;

const VALID_SOURCES = new Set([
  'project',
  'essay',
  'about',
  'experience',
  'thinking',
]);

const entries = await readdir(NODES_DIR, { recursive: true });
const files = entries.filter((e) => extname(e) === '.md').sort();

const rows = [];
const seenIds = new Set();
const errors = [];
const warnings = [];

for (const file of files) {
  const raw = await readFile(join(NODES_DIR, file), 'utf-8');
  const { data, content } = matter(raw);

  const problems = [];
  if (!data.id || typeof data.id !== 'string') problems.push('missing id');
  if (seenIds.has(data.id)) problems.push(`duplicate id "${data.id}"`);
  if (!data.title) problems.push('missing title');
  if (!VALID_SOURCES.has(data.source))
    problems.push(`invalid source "${data.source}"`);
  if (!data.url) problems.push('missing url');
  if (!data.summary) problems.push('missing summary');

  if (problems.length > 0) {
    errors.push(`${file}: ${problems.join(', ')}`);
    continue;
  }

  // The summary is the ONLY thing the router LLM sees per node, so it should
  // stay a tight single sentence (guideline ~120 chars). Warn but don't
  // block — over-long summaries still route, just less sharply.
  const summaryLen = String(data.summary).trim().length;
  if (summaryLen > 200) {
    warnings.push(`${file}: summary is ${summaryLen} chars (aim for ≤120)`);
  }

  seenIds.add(data.id);
  rows.push({
    nodeId: data.id,
    title: data.title,
    source: data.source,
    url: data.url,
    ...(data.date ? { date: String(data.date) } : {}),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    summary: String(data.summary).trim(),
    body: content.trim(),
  });
}

if (errors.length > 0) {
  console.error(`Node validation failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`Node warnings:\n  ${warnings.join('\n  ')}`);
}

await writeFile(OUT_FILE, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
console.log(
  `Wrote ${rows.length} nodes from ${files.length} markdown files → ${OUT_FILE}`,
);
