import { afterEach, describe, expect, it } from 'vitest';
import {
  blockedBot,
  corsHeaders,
  corsPreflight,
  formatSseEvent,
  killSwitchOn,
  rateLimitKey,
} from './guards';

afterEach(() => {
  delete process.env.AGENT_DISABLED;
  delete process.env.ALLOWED_BOTS;
});

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://example.convex.site/ask', { headers });
}

describe('corsHeaders', () => {
  it('reflects an allowlisted origin', () => {
    const h = corsHeaders(req({ origin: 'https://arjunagiarehman.com' }));
    expect(h['Access-Control-Allow-Origin']).toBe(
      'https://arjunagiarehman.com',
    );
  });

  it('returns no CORS headers for unknown origins', () => {
    expect(corsHeaders(req({ origin: 'https://evil.example' }))).toEqual({});
    expect(corsHeaders(req())).toEqual({});
  });
});

describe('corsPreflight', () => {
  it('returns 204 with the methods/headers the MCP + ask clients need', () => {
    const res = corsPreflight(req({ origin: 'https://arjunagiarehman.com' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://arjunagiarehman.com',
    );
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
      'Mcp-Session-Id',
    );
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain(
      'Mcp-Session-Id',
    );
  });

  it('omits the origin grant for non-allowlisted origins', () => {
    const res = corsPreflight(req({ origin: 'https://evil.example' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });
});

describe('killSwitchOn', () => {
  it('only trips on AGENT_DISABLED=1', () => {
    expect(killSwitchOn()).toBe(false);
    process.env.AGENT_DISABLED = '1';
    expect(killSwitchOn()).toBe(true);
    process.env.AGENT_DISABLED = '0';
    expect(killSwitchOn()).toBe(false);
  });
});

describe('blockedBot', () => {
  it('blocks known crawler UAs case-insensitively', () => {
    expect(blockedBot('Mozilla/5.0 (compatible; gptbot/1.0)')).toBe('GPTBot');
    expect(blockedBot('Bytespider; something')).toBe('Bytespider');
  });

  it('passes normal MCP clients', () => {
    expect(blockedBot('Claude-Desktop/1.0')).toBe(null);
    expect(blockedBot('node')).toBe(null);
    expect(blockedBot('')).toBe(null);
  });

  it('honors the ALLOWED_BOTS env allowlist', () => {
    process.env.ALLOWED_BOTS = 'GPTBot, PerplexityBot';
    expect(blockedBot('GPTBot/1.1')).toBe(null);
    expect(blockedBot('CCBot/2.0')).toBe('CCBot');
  });
});

describe('rateLimitKey', () => {
  it('uses the LAST x-forwarded-for hop (the edge-observed IP, not the spoofable first)', () => {
    expect(
      rateLimitKey('ask', req({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' })),
    ).toBe('ask:ip:9.9.9.9');
  });

  it('falls back to x-real-ip, then a shared anon bucket', () => {
    expect(rateLimitKey('ask', req({ 'x-real-ip': '5.6.7.8' }))).toBe(
      'ask:ip:5.6.7.8',
    );
    expect(rateLimitKey('mcp', req())).toBe('mcp:anon');
  });

  it('never derives the key from a client-supplied token (no per-token buckets)', () => {
    // A key that a client can choose is trivially rotated for a fresh bucket
    // per request — the key must only ever come from edge-observed headers.
    const key = rateLimitKey('ask', req());
    expect(key).not.toContain('token');
    expect(key).toBe('ask:anon');
  });

  it('separates /ask and /mcp buckets for the same client', () => {
    const r = req({ 'x-forwarded-for': '1.2.3.4' });
    expect(rateLimitKey('ask', r)).not.toBe(rateLimitKey('mcp', r));
  });
});

describe('formatSseEvent', () => {
  it('emits event/data frames the AgentChat SSE parser understands', () => {
    expect(formatSseEvent('token', { text: 'hi' })).toBe(
      'event: token\ndata: {"text":"hi"}\n\n',
    );
  });
});
