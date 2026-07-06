// ---------------------------------------------------------------------------
// HTTP-layer guards for the agent endpoints, ported from
// mcp-server/src/middleware.ts. Plain helpers (no Hono middleware chain —
// Convex httpActions call these directly at the top of each handler).
//
// All config is read from Convex environment variables at request time, so
// `npx convex env set AGENT_DISABLED 1` takes effect without a deploy:
//   AGENT_DISABLED=1        kill switch — degraded 503, zero LLM spend
//   RATE_LIMIT_MAX          max requests/window/key (default 10)
//   RATE_LIMIT_WINDOW_MS    window length (default 60000)
//   ALLOWED_BOTS            comma-separated UA substrings to allow on /mcp
// ---------------------------------------------------------------------------

/** Canonical site origin — reused for citation links and contact URLs. */
export const SITE_ORIGIN = 'https://arjunagiarehman.com';

/** Browser origins allowed to call /ask and /agent/thread. */
const ALLOWED_ORIGINS = new Set([
  SITE_ORIGIN,
  'http://localhost:4321',
  'http://localhost:3000',
]);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

export function corsPreflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Mcp-Session-Id, Authorization',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

// ---------------------------------------------------------------------------
// Kill switch
// ---------------------------------------------------------------------------

export const DEGRADED_PAYLOAD = {
  error: 'Agent temporarily disabled.',
  answer:
    'My agent brain is offline right now. Drop Rehman a note directly instead.',
  citations: [],
  noMatch: true,
  latencyMs: 0,
};

export function killSwitchOn(): boolean {
  return process.env.AGENT_DISABLED === '1';
}

// ---------------------------------------------------------------------------
// Bot UA filter — cheap first-line defense on the public /mcp endpoint.
// Note: /ask is fully public too — CORS only affects browsers, not curl or
// scrapers. Its real protection is the rate limiter; the bot filter is kept
// off /ask so the browser UI never trips on an unusual UA string.
// ---------------------------------------------------------------------------

export const DEFAULT_BLOCKED_BOTS = [
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'Claude-Web',
  'Anthropic-AI',
  'PerplexityBot',
  'Google-Extended',
  'Amazonbot',
  'Applebot-Extended',
  'Bytespider',
  'Diffbot',
  'AhrefsBot',
  'SemrushBot',
  'DotBot',
  'MJ12bot',
] as const;

/** Returns the matched blocklist entry, or null when the UA may pass. */
export function blockedBot(userAgent: string): string | null {
  const uaLower = userAgent.toLowerCase();
  const allowed = new Set(
    (process.env.ALLOWED_BOTS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const bot of DEFAULT_BLOCKED_BOTS) {
    const botLower = bot.toLowerCase();
    if (uaLower.includes(botLower) && !allowed.has(botLower)) {
      return bot;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rate-limit key — best-effort client IP from proxy headers, endpoint-prefixed
// so /ask and /mcp get independent buckets (a flood on one doesn't starve the
// other) — same isolation the VPS server's per-endpoint limiters had.
//
// The key is NEVER derived from a client-supplied value (thread token, first
// XFF hop): an attacker who controls the key just rotates it for a fresh
// bucket per request, defeating the limiter and driving unbounded LLM spend.
// The IP-per-window bucket is best-effort; the hard spend ceiling lives in
// the Anthropic dashboard and `AGENT_DISABLED` is the panic button (see
// mcp-server/README.md "Safety layer").
// ---------------------------------------------------------------------------

export function rateLimitKey(endpoint: string, request: Request): string {
  // Take the LAST x-forwarded-for hop: proxies APPEND the observed client
  // IP, so the last entry is the one the edge saw. Earlier entries are
  // whatever the client claims — keying on them would be spoofable.
  const xff = request.headers.get('x-forwarded-for');
  const last = xff?.split(',').pop()?.trim();
  if (last) return `${endpoint}:ip:${last}`;
  const xreal = request.headers.get('x-real-ip')?.trim();
  if (xreal) return `${endpoint}:ip:${xreal}`;
  // No trustworthy IP → one shared bucket per endpoint. Coarse, but not
  // attacker-partitionable.
  return `${endpoint}:anon`;
}

// ---------------------------------------------------------------------------
// SSE formatting — /ask streams `event:`/`data:` frames the AgentChat UI
// already knows how to parse.
// ---------------------------------------------------------------------------

export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
