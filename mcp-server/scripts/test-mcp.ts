#!/usr/bin/env bun
/**
 * MCP smoke test — starts the server, runs a real end-to-end MCP exchange.
 *
 * Requires ANTHROPIC_API_KEY.
 * Run with: bun run scripts/test-mcp.ts
 *
 * Exit 0 on pass, Exit 1 on any failure.
 */

import app from '../src/server.js';

interface JsonRpcResponse {
  jsonrpc: string;
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
}

async function mcpPost(
  baseUrl: string,
  body: object,
  sessionId?: string,
): Promise<{ res: Response; json: JsonRpcResponse | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get('content-type') ?? '';
  let json: JsonRpcResponse | null = null;

  if (contentType.includes('application/json')) {
    json = (await res.json()) as JsonRpcResponse;
  } else if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    const match = text.match(/^data: (.+)$/m);
    if (match?.[1]) json = JSON.parse(match[1]) as JsonRpcResponse;
  }

  return { res, json };
}

async function main() {
  console.log('\nMCP smoke test — Rehman MCP Server\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '⚠  ANTHROPIC_API_KEY not set. /ready will show llmReachable: false but protocol tests will still run.\n',
    );
  }

  // Start server on random port
  const server = Bun.serve({ port: 0, fetch: app.fetch });
  const baseUrl = `http://localhost:${server.port}`;
  console.log(`  Server: ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  async function check(label: string, fn: () => Promise<void>) {
    try {
      await fn();
      ok(label);
      passed++;
    } catch (err) {
      fail(`${label} — ${(err as Error).message}`);
      failed++;
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────

  await check('GET /health returns 200 ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as { status: string };
    if (data.status !== 'ok') throw new Error(`status=${data.status}`);
  });

  // ── MCP initialize ───────────────────────────────────────────────────────

  let sessionId: string | null = null;

  await check('POST /mcp initialize → 200 + Mcp-Session-Id', async () => {
    const { res, json } = await mcpPost(baseUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'smoke-test', version: '1.0.0' },
      },
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const sid = res.headers.get('mcp-session-id');
    if (!sid) throw new Error('No Mcp-Session-Id header');
    if (json?.error)
      throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
    sessionId = sid;
  });

  // ── tools/list ───────────────────────────────────────────────────────────

  await check('tools/list returns ask_rehman + list_nodes', async () => {
    if (!sessionId) throw new Error('No session from initialize step');
    const { json } = await mcpPost(
      baseUrl,
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      sessionId,
    );
    if (json?.error)
      throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
    const result = json?.result as
      | { tools?: Array<{ name: string }> }
      | undefined;
    const names = (result?.tools ?? []).map((t) => t.name);
    if (!names.includes('ask_rehman'))
      throw new Error(`Missing ask_rehman. Got: ${names.join(', ')}`);
    if (!names.includes('list_nodes'))
      throw new Error(`Missing list_nodes. Got: ${names.join(', ')}`);
  });

  // ── tools/call list_nodes ────────────────────────────────────────────────

  await check('tools/call list_nodes returns node list', async () => {
    if (!sessionId) throw new Error('No session');
    const { json } = await mcpPost(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'list_nodes', arguments: { source: 'all' } },
      },
      sessionId,
    );
    if (json?.error)
      throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
    const content =
      (json?.result as { content?: Array<{ text?: string }> } | undefined)
        ?.content ?? [];
    if (content.length === 0) throw new Error('Empty content');
    const text = content[0]?.text ?? '';
    if (!text.includes('['))
      throw new Error(`Unexpected content: ${text.slice(0, 80)}`);
  });

  // ── tools/call ask_rehman (only if API key present) ──────────────────────

  if (process.env.ANTHROPIC_API_KEY) {
    await check('tools/call ask_rehman returns cited text', async () => {
      if (!sessionId) throw new Error('No session');
      const { json } = await mcpPost(
        baseUrl,
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'ask_rehman',
            arguments: { query: 'What is Kalrav.AI?' },
          },
        },
        sessionId,
      );
      if (json?.error)
        throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
      const content =
        (json?.result as { content?: Array<{ text?: string }> } | undefined)
          ?.content ?? [];
      if (content.length === 0) throw new Error('Empty content');
      const text = content[0]?.text ?? '';
      if (text.length < 10) throw new Error(`Response too short: "${text}"`);
    });
  } else {
    console.log('  (skipping ask_rehman live call — no ANTHROPIC_API_KEY)');
  }

  // ── POST /ask (browser endpoint) ─────────────────────────────────────────

  if (process.env.ANTHROPIC_API_KEY) {
    await check('POST /ask returns cited answer', async () => {
      const res = await fetch(`${baseUrl}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is Kalrav.AI?' }),
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as {
        answer: string;
        citations: unknown[];
      };
      if (!data.answer || data.answer.length < 10)
        throw new Error(`Short answer: "${data.answer}"`);
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  server.stop(true);

  const total = passed + failed;
  console.log(`\n  ${passed}/${total} passed`);

  if (failed > 0) {
    console.error(`\n✗ smoke test failed\n`);
    process.exit(1);
  } else {
    console.log(`\n✓ smoke test passed\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
