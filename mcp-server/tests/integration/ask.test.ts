/**
 * Integration tests for POST /ask (SSE streaming)
 *
 * Strategy: mock routeQuery, generateAnswer, and generateAnswerStream at
 * the module level so we exercise the full Hono HTTP + SSE layer without
 * any real LLM calls.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('../../src/router.js', () => ({
  routeQuery: vi.fn(),
}));
vi.mock('../../src/responder.js', () => ({
  generateAnswer: vi.fn(),
  generateAnswerStream: vi.fn(),
}));
vi.mock('../../src/nodes.js', () => ({
  loadNodes: vi.fn().mockResolvedValue([]),
  getNodesByIds: vi.fn().mockResolvedValue([]),
  getNodeSummaries: vi.fn().mockResolvedValue([]),
  clearNodeCache: vi.fn(),
}));

import { getNodesByIds } from '../../src/nodes.js';
import { generateAnswerStream } from '../../src/responder.js';
import { routeQuery } from '../../src/router.js';
import app from '../../src/server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CITED_META = {
  citations: [
    {
      id: 'kalrav-ai',
      title: 'Kalrav.AI — E-commerce AI Agent Platform',
      url: '/projects/kalrav',
      source: 'project' as const,
    },
  ],
  noMatch: false,
  latencyMs: 420,
};

async function post(body: unknown): Promise<Response> {
  return app.request('/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
}

/** Parse a complete SSE response body into a list of {event, data} objects */
async function parseSSE(
  res: Response,
): Promise<Array<{ event: string; data: unknown }>> {
  const text = await res.text();
  const events: Array<{ event: string; data: unknown }> = [];
  for (const block of text.split(/\n\n/)) {
    if (!block.trim()) continue;
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) continue;
    try {
      events.push({ event, data: JSON.parse(data) });
    } catch {
      events.push({ event, data });
    }
  }
  return events;
}

/**
 * Configure generateAnswerStream mock to emit the given tokens in sequence
 * then return the final meta.
 */
function mockStreamAnswer(tokens: string[], meta: typeof CITED_META) {
  (generateAnswerStream as ReturnType<typeof vi.fn>).mockImplementation(
    async (
      _q: unknown,
      _n: unknown,
      startTime: number,
      _h: unknown,
      onToken: (t: string) => Promise<void>,
    ) => {
      for (const tok of tokens) {
        await onToken(tok);
      }
      return {
        answer: tokens.join(''),
        citations: meta.citations,
        noMatch: meta.noMatch,
        latencyMs: meta.latencyMs,
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /ask (SSE)', () => {
  // Bump the middleware rate limit so the ~20 test POSTs from a shared
  // "unknown" IP don't start returning 429. Rate limiter is unit-tested
  // in src/middleware.test.ts; this suite covers the pipeline.
  beforeAll(() => {
    process.env.RATE_LIMIT_MAX = '10000';
  });
  afterAll(() => {
    delete process.env.RATE_LIMIT_MAX;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('streams token events followed by a done event for a matched question', async () => {
    (routeQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodeIds: ['kalrav-ai'],
      confidence: 'high',
      noMatch: false,
    });
    (getNodesByIds as ReturnType<typeof vi.fn>).mockResolvedValue([
      { frontmatter: { id: 'kalrav-ai' }, body: '...' },
    ]);
    mockStreamAnswer(
      ['Kalrav.AI ', 'is a ', 'vertical agent platform [kalrav-ai].'],
      CITED_META,
    );

    const res = await post({ query: 'what is Kalrav.AI?' });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = await parseSSE(res);
    const tokens = events.filter((e) => e.event === 'token');
    const done = events.find((e) => e.event === 'done');

    expect(tokens.length).toBe(3);
    expect((tokens[0]!.data as { text: string }).text).toBe('Kalrav.AI ');
    expect(done).toBeDefined();
    expect((done!.data as { citations: unknown[] }).citations).toHaveLength(1);
    expect((done!.data as { noMatch: boolean }).noMatch).toBe(false);
  });

  it('emits a single-chunk token stream for cold no-match (no history)', async () => {
    (routeQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodeIds: [],
      confidence: 'low',
      noMatch: true,
    });

    const res = await post({ query: 'what is the weather in Paris?' });

    expect(res.status).toBe(200);
    const events = await parseSSE(res);
    const tokens = events.filter((e) => e.event === 'token');
    const done = events.find((e) => e.event === 'done');

    expect(tokens).toHaveLength(1);
    expect((done!.data as { noMatch: boolean }).noMatch).toBe(true);
    // generateAnswerStream should NOT be called when there's no history
    expect(generateAnswerStream).not.toHaveBeenCalled();
  });

  // ── Filler handling ─────────────────────────────────────────────────────

  it('short-circuits bare filler with a human reaction (no LLM call)', async () => {
    const res = await post({ query: 'ok' });

    expect(res.status).toBe(200);
    const events = await parseSSE(res);
    const tokens = events.filter((e) => e.event === 'token');

    expect(tokens).toHaveLength(1);
    // Text should be short and human-like, not a canned menu
    const text = (tokens[0]!.data as { text: string }).text;
    expect(text.length).toBeLessThan(60);
    expect(routeQuery).not.toHaveBeenCalled();
    expect(generateAnswerStream).not.toHaveBeenCalled();
  });

  it('passes filler with history to the LLM for contextual continuation', async () => {
    mockStreamAnswer(['👍'], {
      citations: [],
      noMatch: false,
      latencyMs: 100,
    });

    const res = await post({
      query: 'ok',
      history: [
        { role: 'user', content: 'What is Kalrav.AI?' },
        { role: 'assistant', content: 'A vertical AI agent platform.' },
      ],
    });

    expect(res.status).toBe(200);
    expect(generateAnswerStream).toHaveBeenCalledTimes(1);
    // Router skipped on fillers
    expect(routeQuery).not.toHaveBeenCalled();
  });

  // ── Input validation (still JSON) ─────────────────────────────────────────

  it('rejects empty query with 400', async () => {
    const res = await post({ query: '' });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBeDefined();
  });

  it('rejects whitespace-only query with 400', async () => {
    const res = await post({ query: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects query over 500 characters with 400', async () => {
    const res = await post({ query: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('accepts query of exactly 500 characters', async () => {
    (routeQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodeIds: [],
      confidence: 'low',
      noMatch: true,
    });
    const res = await post({ query: 'x'.repeat(500) });
    expect(res.status).toBe(200);
  });

  it('rejects missing query field with 400', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('rejects non-string query with 400', async () => {
    const res = await post({ query: 42 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON body', async () => {
    const res = await app.request('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {',
    });
    expect(res.status).toBe(400);
  });

  it('rejects history with non-role entries', async () => {
    const res = await post({
      query: 'follow up',
      history: [{ role: 'bogus', content: 'hi' }],
    });
    expect(res.status).toBe(400);
  });

  // ── Error handling (SSE error event, 200 status) ─────────────────────────

  it('emits an error event when the router throws mid-stream', async () => {
    (routeQuery as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('LLM API down'),
    );

    const res = await post({ query: 'what is Kalrav?' });

    // The SSE stream already started with status 200; errors ride on the event channel
    expect(res.status).toBe(200);
    const events = await parseSSE(res);
    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(
      (errorEvent!.data as { message: string }).message.toLowerCase(),
    ).toContain('pipeline');
  });

  it('emits an error event when the responder throws', async () => {
    (routeQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodeIds: ['kalrav-ai'],
      confidence: 'high',
      noMatch: false,
    });
    (getNodesByIds as ReturnType<typeof vi.fn>).mockResolvedValue([
      { frontmatter: { id: 'kalrav-ai' }, body: '...' },
    ]);
    (generateAnswerStream as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Responder failed'),
    );

    const res = await post({ query: 'what is Kalrav?' });

    expect(res.status).toBe(200);
    const events = await parseSSE(res);
    expect(events.some((e) => e.event === 'error')).toBe(true);
  });

  // ── Content type ─────────────────────────────────────────────────────────

  it('responds with text/event-stream content-type for streaming responses', async () => {
    (routeQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodeIds: [],
      noMatch: true,
      confidence: 'low',
    });
    // Use a non-filler query so it goes through the streaming path
    const res = await post({ query: 'some question that is not a filler' });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });
});
