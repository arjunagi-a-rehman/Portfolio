/**
 * Integration tests for /health and /ready endpoints
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/nodes.js', () => ({
  loadNodes: vi.fn(),
  getNodesByIds: vi.fn(),
  getNodeSummaries: vi.fn(),
  clearNodeCache: vi.fn(),
}));

// Mock Anthropic for /ready LLM ping
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  function MockAnthropic() {
    return { messages: { create: mockCreate } };
  }
  MockAnthropic.__mockCreate = mockCreate;
  return { default: MockAnthropic, __mockCreate: mockCreate };
});

import Anthropic from '@anthropic-ai/sdk';
import { loadNodes } from '../../src/nodes.js';
import app from '../../src/server.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with status ok and uptime', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('ok');
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /ready', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 ready when nodes loaded and LLM reachable', async () => {
    (loadNodes as ReturnType<typeof vi.fn>).mockResolvedValue([
      { frontmatter: { id: 'test' }, body: '' },
      { frontmatter: { id: 'test2' }, body: '' },
    ]);
    const anthropicInstance = new (Anthropic as any)();
    anthropicInstance.messages.create.mockResolvedValue({
      content: [{ type: 'text', text: 'pong' }],
    });

    const res = await app.request('/ready');
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('ready');
    expect(data.nodesLoaded).toBe(2);
    expect(data.llmReachable).toBe(true);
  });

  it('returns 503 when no nodes loaded', async () => {
    (loadNodes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const anthropicInstance = new (Anthropic as any)();
    anthropicInstance.messages.create.mockResolvedValue({
      content: [{ type: 'text', text: 'pong' }],
    });

    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const data = (await res.json()) as any;
    expect(data.status).toBe('not_ready');
    expect(data.nodesLoaded).toBe(0);
  });

  it('returns 503 when LLM not reachable', async () => {
    (loadNodes as ReturnType<typeof vi.fn>).mockResolvedValue([
      { frontmatter: { id: 'test' }, body: '' },
    ]);
    const anthropicInstance = new (Anthropic as any)();
    anthropicInstance.messages.create.mockRejectedValue(
      new Error('connection refused'),
    );

    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const data = (await res.json()) as any;
    expect(data.status).toBe('not_ready');
    expect(data.llmReachable).toBe(false);
  });

  it('returns 503 when nodes fail to load', async () => {
    (loadNodes as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('disk error'),
    );

    const res = await app.request('/ready');
    expect(res.status).toBe(503);
  });
});
