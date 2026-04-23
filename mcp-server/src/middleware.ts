/**
 * Safety middlewares for the MCP server.
 *
 * Three independent pieces, each shippable on its own Hono route or chain:
 *
 *  - createRateLimiter  in-memory token bucket keyed by client IP
 *  - createBotFilter    blocks obvious crawler User-Agents (GPTBot et al.)
 *  - createKillSwitch   AGENT_DISABLED=1 env short-circuits to degraded response
 *
 * All three are factories so each mount point gets its own state (buckets,
 * allowlist) and tests can inject short windows without polluting production
 * state.
 */
import type { Context, Next } from "hono";

// ---------------------------------------------------------------------------
// IP extraction — Traefik / Dokploy put the real client IP here
// ---------------------------------------------------------------------------

/** Pull the best-effort client IP from proxy headers, falling back to "unknown". */
export function getClientIp(c: Context): string {
  // x-forwarded-for can be a chain: "client, proxy1, proxy2"
  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xreal = c.req.header("x-real-ip");
  if (xreal) return xreal.trim();
  return "unknown";
}

// ---------------------------------------------------------------------------
// Rate limiter — fixed-window token bucket
// ---------------------------------------------------------------------------

export interface RateLimitOptions {
  /**
   * Time window in ms before counter resets. When unset, falls back to
   * RATE_LIMIT_WINDOW_MS env var or 60_000 (1 minute). Resolved per-request
   * so env changes take effect without restart.
   */
  windowMs?: number;
  /**
   * Max requests allowed within the window. When unset, falls back to
   * RATE_LIMIT_MAX env var or 10. Resolved per-request.
   */
  max?: number;
  /** Optional label used in 429 body, e.g. "/ask". Purely for clarity. */
  label?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter({
  windowMs,
  max,
  label = "endpoint",
}: RateLimitOptions = {}) {
  // State lives in the closure — each mount point gets an isolated bucket map.
  const buckets = new Map<string, Bucket>();

  return async (c: Context, next: Next) => {
    // Resolve at request time so env changes apply without a restart and
    // tests can stub RATE_LIMIT_MAX mid-suite without fighting import order.
    // Explicit options still win over env, which still wins over defaults.
    const effectiveMax = max ?? Number(process.env.RATE_LIMIT_MAX ?? 10);
    const effectiveWindow =
      windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

    const ip = getClientIp(c);
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(ip, { count: 1, resetAt: now + effectiveWindow });
      return next();
    }

    if (bucket.count >= effectiveMax) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return c.json(
        {
          error: `Rate limit exceeded on ${label}. Slow down.`,
          retryAfterSeconds: retryAfter,
        },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    bucket.count++;
    return next();
  };
}

// ---------------------------------------------------------------------------
// UA bot filter — cheap first-line defense on public /mcp
// ---------------------------------------------------------------------------

/**
 * Known aggressive crawlers / training-data scrapers. Blocked by default
 * from the public /mcp endpoint because they would otherwise burn LLM budget
 * walking the surface.
 *
 * Legit MCP clients (Claude Desktop, Cursor, mcp-inspector, custom scripts)
 * do not identify as any of these. The substring match is case-insensitive.
 */
export const DEFAULT_BLOCKED_BOTS = [
  "GPTBot",
  "CCBot",
  "ClaudeBot",
  "Claude-Web",
  "Anthropic-AI",
  "PerplexityBot",
  "Google-Extended",
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "Diffbot",
  "AhrefsBot",
  "SemrushBot",
  "DotBot",
  "MJ12bot",
] as const;

export interface BotFilterOptions {
  /** UAs to allow even if they match the blocklist. Case-insensitive. */
  allow?: readonly string[];
  /** Override the blocklist entirely (advanced). */
  blocklist?: readonly string[];
}

export function createBotFilter({
  allow = [],
  blocklist = DEFAULT_BLOCKED_BOTS,
}: BotFilterOptions = {}) {
  const allowLower = new Set(allow.map((s) => s.toLowerCase()));
  const blockLower = blocklist.map((s) => s.toLowerCase());

  return async (c: Context, next: Next) => {
    const ua = c.req.header("user-agent") ?? "";
    const uaLower = ua.toLowerCase();

    for (const bot of blockLower) {
      if (uaLower.includes(bot) && !allowLower.has(bot)) {
        console.log(
          `[bot-filter] blocked ${bot} ua="${ua.slice(0, 120)}" ip=${getClientIp(c)}`,
        );
        return c.json(
          {
            error: "Bot traffic not accepted on this endpoint.",
            contact: "https://arjunagiarehman.com/#contact",
          },
          403,
        );
      }
    }

    return next();
  };
}

// ---------------------------------------------------------------------------
// Kill switch — AGENT_DISABLED=1 short-circuits to degraded response
// ---------------------------------------------------------------------------

const DEGRADED_PAYLOAD = {
  error: "Agent temporarily disabled.",
  answer:
    "My agent brain is offline right now. Drop Rehman a note directly instead.",
  citations: [],
  noMatch: true,
  latencyMs: 0,
};

export interface KillSwitchOptions {
  /** Override the env var name. Defaults to "AGENT_DISABLED". */
  envVar?: string;
}

export function createKillSwitch({
  envVar = "AGENT_DISABLED",
}: KillSwitchOptions = {}) {
  return async (c: Context, next: Next) => {
    if (process.env[envVar] === "1") {
      console.log(`[kill-switch] ${envVar}=1 — serving degraded response`);
      return c.json(DEGRADED_PAYLOAD, 503);
    }
    return next();
  };
}
