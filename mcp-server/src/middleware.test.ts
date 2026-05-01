/**
 * Unit tests for safety middleware.
 *
 * Each middleware is mounted on a tiny throwaway Hono app, then exercised
 * directly with app.request() — no HTTP server needed.
 */

import { Hono, type MiddlewareHandler } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createBotFilter,
  createKillSwitch,
  createRateLimiter,
  DEFAULT_BLOCKED_BOTS,
  getClientIp,
} from './middleware.js';

// ---------------------------------------------------------------------------
// Helper — builds a minimal app that echoes "ok" past the middleware
// ---------------------------------------------------------------------------

function buildApp(middleware: MiddlewareHandler) {
  const app = new Hono();
  app.use('*', middleware);
  app.get('/', (c) => c.json({ status: 'ok' }));
  app.post('/', (c) => c.json({ status: 'ok' }));
  return app;
}

// ---------------------------------------------------------------------------
// getClientIp — header precedence
// ---------------------------------------------------------------------------

describe('getClientIp', () => {
  it('prefers x-forwarded-for first hop over x-real-ip', async () => {
    const app = new Hono();
    app.get('/', (c) => c.json({ ip: getClientIp(c) }));

    const res = await app.request('/', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        'x-real-ip': '10.0.0.1',
      },
    });
    const data = (await res.json()) as { ip: string };
    expect(data.ip).toBe('203.0.113.10');
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', async () => {
    const app = new Hono();
    app.get('/', (c) => c.json({ ip: getClientIp(c) }));

    const res = await app.request('/', {
      headers: { 'x-real-ip': '198.51.100.7' },
    });
    const data = (await res.json()) as { ip: string };
    expect(data.ip).toBe('198.51.100.7');
  });

  it("returns 'unknown' when no proxy headers are present", async () => {
    const app = new Hono();
    app.get('/', (c) => c.json({ ip: getClientIp(c) }));

    const res = await app.request('/');
    const data = (await res.json()) as { ip: string };
    expect(data.ip).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

describe('createRateLimiter', () => {
  const makeIpHeaders = (ip: string) => ({ 'x-forwarded-for': ip });

  it('allows traffic under the limit', async () => {
    const app = buildApp(createRateLimiter({ max: 3, windowMs: 60_000 }));
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 once the limit is exceeded', async () => {
    const app = buildApp(createRateLimiter({ max: 2, windowMs: 60_000 }));
    await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    const res = await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { retryAfterSeconds: number };
    expect(typeof body.retryAfterSeconds).toBe('number');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('sets a Retry-After header on 429', async () => {
    const app = buildApp(createRateLimiter({ max: 1, windowMs: 60_000 }));
    await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    const res = await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('keeps separate buckets for different IPs', async () => {
    const app = buildApp(createRateLimiter({ max: 1, windowMs: 60_000 }));
    await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    // Second IP should still be fresh
    const res = await app.request('/', { headers: makeIpHeaders('5.6.7.8') });
    expect(res.status).toBe(200);
  });

  it('resets after the window expires', async () => {
    const app = buildApp(createRateLimiter({ max: 1, windowMs: 50 }));
    const first = await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    expect(first.status).toBe(200);

    const blocked = await app.request('/', {
      headers: makeIpHeaders('1.2.3.4'),
    });
    expect(blocked.status).toBe(429);

    await new Promise((r) => setTimeout(r, 60)); // window expires

    const fresh = await app.request('/', { headers: makeIpHeaders('1.2.3.4') });
    expect(fresh.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Bot filter
// ---------------------------------------------------------------------------

describe('createBotFilter', () => {
  const humanUAs = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    'curl/8.1.2',
    'Claude-Desktop/1.0',
    'mcp-inspector/0.5',
    'node-fetch/3.3.2',
  ];

  for (const ua of humanUAs) {
    it(`allows legitimate UA: ${ua.slice(0, 40)}`, async () => {
      const app = buildApp(createBotFilter());
      const res = await app.request('/', { headers: { 'user-agent': ua } });
      expect(res.status).toBe(200);
    });
  }

  for (const bot of DEFAULT_BLOCKED_BOTS) {
    it(`blocks ${bot}`, async () => {
      const app = buildApp(createBotFilter());
      const res = await app.request('/', {
        headers: { 'user-agent': `Mozilla/5.0 (compatible; ${bot}/1.0)` },
      });
      expect(res.status).toBe(403);
    });
  }

  it('is case-insensitive on UA matching', async () => {
    const app = buildApp(createBotFilter());
    const res = await app.request('/', {
      headers: { 'user-agent': 'gptbot/2.0' },
    });
    expect(res.status).toBe(403);
  });

  it('allowlist lets a specific bot through', async () => {
    const app = buildApp(createBotFilter({ allow: ['ClaudeBot'] }));
    const res = await app.request('/', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ClaudeBot/1.0)' },
    });
    expect(res.status).toBe(200);
  });

  it('empty user-agent is allowed (handled by rate limiter instead)', async () => {
    const app = buildApp(createBotFilter());
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('custom blocklist replaces the default', async () => {
    const app = buildApp(createBotFilter({ blocklist: ['EvilBot'] }));

    // Would normally be blocked, but not in this blocklist
    const res1 = await app.request('/', {
      headers: { 'user-agent': 'GPTBot/1.0' },
    });
    expect(res1.status).toBe(200);

    // Custom blocklist hit
    const res2 = await app.request('/', {
      headers: { 'user-agent': 'EvilBot/1.0' },
    });
    expect(res2.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Kill switch
// ---------------------------------------------------------------------------

describe('createKillSwitch', () => {
  beforeEach(() => {
    delete process.env.AGENT_DISABLED;
    delete process.env.CUSTOM_KILL;
  });
  afterEach(() => {
    delete process.env.AGENT_DISABLED;
    delete process.env.CUSTOM_KILL;
  });

  it('passes through when env var is unset', async () => {
    const app = buildApp(createKillSwitch());
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it("passes through when env var is any value other than '1'", async () => {
    process.env.AGENT_DISABLED = '0';
    const app = buildApp(createKillSwitch());
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('returns 503 with degraded payload when AGENT_DISABLED=1', async () => {
    process.env.AGENT_DISABLED = '1';
    const app = buildApp(createKillSwitch());
    const res = await app.request('/');
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      answer: string;
      noMatch: boolean;
    };
    expect(body.noMatch).toBe(true);
    expect(body.answer).toContain('offline');
  });

  it('respects a custom env var name', async () => {
    process.env.CUSTOM_KILL = '1';
    const app = buildApp(createKillSwitch({ envVar: 'CUSTOM_KILL' }));
    const res = await app.request('/');
    expect(res.status).toBe(503);
  });
});
