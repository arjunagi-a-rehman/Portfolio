#!/usr/bin/env bun
/**
 * ingest — knowledge base management CLI
 *
 * Commands:
 *   doctor                  Validate all node frontmatter. Exits 1 on any error.
 *   doctor --citation-check Also run the citation integrity eval (requires ANTHROPIC_API_KEY).
 *
 * Usage:
 *   bun run scripts/ingest.ts doctor
 *   bun run scripts/ingest.ts doctor --citation-check
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { clearNodeCache, getNodesByIds } from '../src/nodes.js';
import { generateAnswer } from '../src/responder.js';
import { routeQuery } from '../src/router.js';
import { NodeFrontmatterSchema } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NODES_DIR = join(__dirname, '..', 'nodes');
const EVALS_DIR = join(__dirname, '..', 'tests', 'evals');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
}
function section(title: string) {
  console.log(`\n── ${title} ──`);
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    const raw = await readdir(dir, { recursive: true, encoding: 'utf-8' });
    entries = raw as string[];
  } catch {
    return [];
  }
  return entries
    .filter((e) => extname(e) === '.md')
    .map((e) => join(dir, e))
    .sort();
}

// ---------------------------------------------------------------------------
// doctor — validate all node frontmatter
// ---------------------------------------------------------------------------

async function doctorValidate(): Promise<{ errors: number; checked: number }> {
  section('Frontmatter validation');

  const files = await collectMarkdownFiles(NODES_DIR);
  if (files.length === 0) {
    console.warn('  ⚠ No markdown files found in nodes/');
    return { errors: 0, checked: 0 };
  }

  const seenIds = new Map<string, string>(); // id → first file path
  let errors = 0;

  for (const filePath of files) {
    const relPath = relative(NODES_DIR, filePath);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (err) {
      fail(`${relPath} — cannot read file: ${(err as Error).message}`);
      errors++;
      continue;
    }

    let parsed: ReturnType<typeof matter>;
    try {
      parsed = matter(raw);
    } catch (err) {
      fail(`${relPath} — invalid YAML frontmatter: ${(err as Error).message}`);
      errors++;
      continue;
    }

    const result = NodeFrontmatterSchema.safeParse(parsed.data);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      fail(`${relPath} — ${issues}`);
      errors++;
      continue;
    }

    const { id } = result.data;
    if (seenIds.has(id)) {
      fail(
        `${relPath} — duplicate id "${id}" (first seen in ${seenIds.get(id)})`,
      );
      errors++;
      continue;
    }
    seenIds.set(id, relPath);

    if (!parsed.content?.trim()) {
      fail(`${relPath} — body is empty`);
      errors++;
      continue;
    }

    ok(`${relPath} (id: ${id})`);
  }

  console.log(`\n  ${files.length} files checked, ${errors} error(s)\n`);
  return { errors, checked: files.length };
}

// ---------------------------------------------------------------------------
// doctor --citation-check — run eval fixtures against the live pipeline
// ---------------------------------------------------------------------------

interface CitationFixture {
  id: string;
  query: string;
  expectedCitationIds: string[];
  mustNotCite: string[];
  allowNoMatch: boolean;
}

interface CitationEvalFile {
  fixtures: CitationFixture[];
}

async function doctorCitationCheck(): Promise<{
  errors: number;
  checked: number;
}> {
  section('Citation integrity eval');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('  ✗ ANTHROPIC_API_KEY not set — skipping citation check\n');
    return { errors: 1, checked: 0 };
  }

  const evalPath = join(EVALS_DIR, 'citation-integrity.json');
  let evalData: CitationEvalFile;
  try {
    const raw = await readFile(evalPath, 'utf-8');
    evalData = JSON.parse(raw) as CitationEvalFile;
  } catch (err) {
    fail(`Cannot load ${evalPath}: ${(err as Error).message}`);
    return { errors: 1, checked: 0 };
  }

  // Reset node cache so eval uses real nodes on disk
  clearNodeCache();

  let errors = 0;

  for (const fixture of evalData.fixtures) {
    process.stdout.write(`  [${fixture.id}] ${fixture.query.slice(0, 60)}...`);

    try {
      const decision = await routeQuery(fixture.query);

      // Check noMatch expectation
      if (!fixture.allowNoMatch && decision.noMatch) {
        process.stdout.write(' ✗\n');
        fail(`  ${fixture.id} — got noMatch but question should have matched`);
        errors++;
        continue;
      }

      if (fixture.allowNoMatch && fixture.expectedCitationIds.length === 0) {
        // Off-topic question — just verify it didn't accidentally match
        if (!decision.noMatch) {
          // It matched something — get the answer and check for phantom cites
          const nodes = await getNodesByIds(decision.nodeIds);
          const response = await generateAnswer(
            fixture.query,
            nodes,
            Date.now(),
          );
          const citedIds = response.citations.map((c) => c.id);
          const phantoms = citedIds.filter((id) =>
            fixture.mustNotCite.includes(id),
          );
          if (phantoms.length > 0) {
            process.stdout.write(' ✗\n');
            fail(`  ${fixture.id} — phantom citations: ${phantoms.join(', ')}`);
            errors++;
            continue;
          }
        }
        process.stdout.write(' ✓\n');
        continue;
      }

      // Matched — get the full answer
      const nodes = await getNodesByIds(decision.nodeIds);
      const response = await generateAnswer(fixture.query, nodes, Date.now());
      const citedIds = response.citations.map((c) => c.id);

      // Check expected citations (at least one must appear)
      if (fixture.expectedCitationIds.length > 0) {
        const hasExpected = fixture.expectedCitationIds.some((id) =>
          citedIds.includes(id),
        );
        if (!hasExpected) {
          process.stdout.write(' ✗\n');
          fail(
            `  ${fixture.id} — expected one of [${fixture.expectedCitationIds.join(', ')}], got [${citedIds.join(', ') || 'none'}]`,
          );
          errors++;
          continue;
        }
      }

      // Check phantom citations
      const phantoms = citedIds.filter((id) =>
        fixture.mustNotCite.includes(id),
      );
      if (phantoms.length > 0) {
        process.stdout.write(' ✗\n');
        fail(`  ${fixture.id} — phantom citations: ${phantoms.join(', ')}`);
        errors++;
        continue;
      }

      process.stdout.write(' ✓\n');
    } catch (err) {
      process.stdout.write(' ✗\n');
      fail(`  ${fixture.id} — threw: ${(err as Error).message}`);
      errors++;
    }
  }

  const total = evalData.fixtures.length;
  console.log(`\n  ${total} fixtures, ${errors} failure(s)\n`);
  return { errors, checked: total };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags = new Set(args.slice(1));

  console.log('ingest — Rehman MCP Server knowledge base tool\n');

  if (command === 'doctor') {
    const { errors: validationErrors } = await doctorValidate();

    let citationErrors = 0;
    if (flags.has('--citation-check')) {
      const result = await doctorCitationCheck();
      citationErrors = result.errors;
    }

    const totalErrors = validationErrors + citationErrors;
    if (totalErrors > 0) {
      console.error(`\n✗ doctor failed with ${totalErrors} error(s)\n`);
      process.exit(1);
    } else {
      console.log(`\n✓ doctor passed\n`);
      process.exit(0);
    }
  } else {
    console.log('Usage:');
    console.log('  bun run scripts/ingest.ts doctor');
    console.log(
      '  bun run scripts/ingest.ts doctor --citation-check  (requires ANTHROPIC_API_KEY)',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
