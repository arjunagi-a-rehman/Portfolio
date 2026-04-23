/**
 * GA4 Measurement Protocol — server-side event beacons.
 *
 * Sends fire-and-forget events to Google Analytics from the MCP server,
 * where browser gtag isn't available (external MCP clients like Claude
 * Desktop or Cursor hit us without loading any of our JS).
 *
 * Config (both optional — no-op if either is missing):
 *   GA4_MEASUREMENT_ID   e.g. G-XXXXXXXXXX
 *   GA4_API_SECRET       created in GA4 admin → Data streams → API secrets
 *
 * Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Coarse bucket for the MCP caller. No raw UA ever leaves this server. */
export type McpClientBucket =
  | "claude-desktop"
  | "cursor"
  | "mcp-inspector"
  | "chatgpt"
  | "openai-agent"
  | "curl"
  | "unknown"
  | "other";

// ---------------------------------------------------------------------------
// UA classification
// ---------------------------------------------------------------------------

/**
 * Classify a User-Agent header into a known-client bucket. Substring match,
 * case-insensitive. Anything we can't identify goes to "other" (or "unknown"
 * if there's no UA at all). The raw UA is NEVER forwarded to GA4 — only the
 * bucket. This is the PII floor.
 */
export function classifyMcpClient(userAgent: string | undefined): McpClientBucket {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("claude-desktop") || ua.includes("claude desktop")) return "claude-desktop";
  if (ua.includes("cursor")) return "cursor";
  if (ua.includes("mcp-inspector")) return "mcp-inspector";
  if (ua.includes("chatgpt")) return "chatgpt";
  if (ua.includes("openai") || ua.includes("gpt")) return "openai-agent";
  if (ua.startsWith("curl/")) return "curl";
  return "other";
}

// ---------------------------------------------------------------------------
// Measurement Protocol beacon
// ---------------------------------------------------------------------------

export interface Ga4Event {
  name: string;
  params?: Record<string, string | number | boolean>;
}

export interface Ga4BeaconOptions {
  /**
   * Opaque per-MCP-session identifier. GA4 requires a client_id; reusing
   * the Mcp-Session-Id here keeps events correlated within an external-agent
   * session without ever touching a real user ID.
   */
  clientId: string;
  /** One or more events to send in a single request. */
  events: Ga4Event[];
  /**
   * Override fetch for tests. Defaults to the global fetch. Returns the
   * raw Response so tests can assert on status + body if they care.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Fire-and-forget. Logs failures but never throws — analytics must not
 * affect MCP session init or any other request path. No-ops silently if
 * GA4_MEASUREMENT_ID or GA4_API_SECRET is unset (typical in dev / fork).
 */
export async function sendGa4Event(opts: Ga4BeaconOptions): Promise<void> {
  const id = process.env.GA4_MEASUREMENT_ID;
  const secret = process.env.GA4_API_SECRET;
  if (!id || !secret) return;

  const fetchFn = opts.fetchImpl ?? fetch;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    id,
  )}&api_secret=${encodeURIComponent(secret)}`;

  try {
    await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: opts.clientId,
        events: opts.events,
      }),
    });
  } catch (err) {
    console.warn("[ga4] beacon failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Convenience wrapper for the specific event the MCP server fires today.
 * Called from `onsessioninitialized` when a new MCP client connects.
 */
export async function trackMcpConnected(
  sessionId: string,
  userAgent: string | undefined,
  fetchImpl?: typeof fetch,
): Promise<void> {
  await sendGa4Event({
    clientId: sessionId,
    events: [
      {
        name: "agent_mcp_connected",
        params: {
          client_bucket: classifyMcpClient(userAgent),
        },
      },
    ],
    fetchImpl,
  });
}
