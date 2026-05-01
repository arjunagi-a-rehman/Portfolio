import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock nodes module before importing router
vi.mock('./nodes.js', () => ({
  getNodeSummaries: vi.fn(),
}));

import type Anthropic from '@anthropic-ai/sdk';
import { getNodeSummaries } from './nodes.js';
import { routeQuery } from './router.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_SUMMARIES = [
  {
    id: 'kalrav-ai',
    title: 'Kalrav.AI',
    summary: 'Vertical AI agent platform for e-commerce',
    tags: ['ai-agents', 'e-commerce'],
  },
  {
    id: 'essay-coders-to-owners',
    title: 'From Coders to Owners',
    summary: 'Engineering ownership in the AI era',
    tags: ['ai', 'engineering', 'ownership'],
  },
];

/** Create a fake Anthropic client that returns a given JSON payload */
function makeFakeClient(payload: object | string): Anthropic {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
      }),
    },
  } as unknown as Anthropic;
}

function makeFailingClient(error: Error): Anthropic {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(error),
    },
  } as unknown as Anthropic;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('routeQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getNodeSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(
      MOCK_SUMMARIES,
    );
  });

  it('returns matched node IDs from router LLM response', async () => {
    const client = makeFakeClient({
      nodeIds: ['kalrav-ai'],
      confidence: 'high',
      noMatch: false,
      reasoning: 'Directly about Kalrav.AI',
    });

    const result = await routeQuery('tell me about Kalrav.AI', { client });

    expect(result.nodeIds).toEqual(['kalrav-ai']);
    expect(result.noMatch).toBe(false);
    expect(result.confidence).toBe('high');
  });

  it('returns noMatch:true when LLM signals no match', async () => {
    const client = makeFakeClient({
      nodeIds: [],
      confidence: 'low',
      noMatch: true,
      reasoning: 'Off-topic question',
    });

    const result = await routeQuery('what is the weather in Paris?', {
      client,
    });

    expect(result.noMatch).toBe(true);
    expect(result.nodeIds).toHaveLength(0);
  });

  it('strips phantom node IDs not in the knowledge base', async () => {
    const client = makeFakeClient({
      nodeIds: ['kalrav-ai', 'hallucinated-node'],
      confidence: 'medium',
      noMatch: false,
    });

    const result = await routeQuery('tell me about kalrav', { client });

    expect(result.nodeIds).toEqual(['kalrav-ai']);
    expect(result.nodeIds).not.toContain('hallucinated-node');
  });

  it('handles malformed JSON from LLM gracefully', async () => {
    const client = makeFakeClient('This is not JSON at all');

    const result = await routeQuery('anything', { client });

    expect(result.noMatch).toBe(true);
    expect(result.nodeIds).toHaveLength(0);
    expect(result.confidence).toBe('low');
  });

  it('handles LLM response wrapped in markdown code fence', async () => {
    const client = makeFakeClient(
      '```json\n{"nodeIds":["kalrav-ai"],"confidence":"high","noMatch":false}\n```',
    );

    const result = await routeQuery('kalrav', { client });

    expect(result.nodeIds).toEqual(['kalrav-ai']);
  });

  it('returns noMatch when no summaries available', async () => {
    (getNodeSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const client = makeFakeClient({
      nodeIds: [],
      confidence: 'low',
      noMatch: false,
    });

    const result = await routeQuery('anything', { client });

    expect(result.noMatch).toBe(true);
    expect(result.nodeIds).toHaveLength(0);
  });

  it('throws when LLM API call fails', async () => {
    const client = makeFailingClient(new Error('API error'));

    await expect(routeQuery('anything', { client })).rejects.toThrow(
      'API error',
    );
  });

  it('sanitizes HTML/script injection in query before sending to LLM', async () => {
    let capturedMessage = '';
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (params: any) => {
          capturedMessage = params.messages[0].content;
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  nodeIds: [],
                  confidence: 'low',
                  noMatch: true,
                }),
              },
            ],
          };
        }),
      },
    } as unknown as Anthropic;

    await routeQuery("<script>alert('xss')</script>what is kalrav", { client });

    // Tag markers stripped — content may remain as plain text (intentional)
    expect(capturedMessage).not.toContain('<script>');
    expect(capturedMessage).not.toContain('</script>');
  });

  it('returns multiple node IDs when LLM matches multiple nodes', async () => {
    const client = makeFakeClient({
      nodeIds: ['kalrav-ai', 'essay-coders-to-owners'],
      confidence: 'high',
      noMatch: false,
    });

    const result = await routeQuery('tell me about your ai work and thinking', {
      client,
    });

    expect(result.nodeIds).toHaveLength(2);
    expect(result.nodeIds).toContain('kalrav-ai');
    expect(result.nodeIds).toContain('essay-coders-to-owners');
  });
});
