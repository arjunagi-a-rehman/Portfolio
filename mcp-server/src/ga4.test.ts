import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyMcpClient,
  sendGa4Event,
  trackMcpConnected,
} from "./ga4.js";

// ---------------------------------------------------------------------------
// classifyMcpClient
// ---------------------------------------------------------------------------

describe("classifyMcpClient", () => {
  it("returns 'unknown' when the UA is missing or empty", () => {
    expect(classifyMcpClient(undefined)).toBe("unknown");
    expect(classifyMcpClient("")).toBe("unknown");
  });

  const cases: Array<[string, ReturnType<typeof classifyMcpClient>]> = [
    ["Claude-Desktop/1.2.3", "claude-desktop"],
    ["Claude Desktop/1.0.0 (Mac)", "claude-desktop"],
    ["Cursor/0.42.3", "cursor"],
    ["mcp-inspector/0.5.0", "mcp-inspector"],
    ["ChatGPT/1.2024.318", "chatgpt"],
    ["OpenAI-Assistants/v2", "openai-agent"],
    ["SomeGPTClient/1.0", "openai-agent"],
    ["curl/8.1.2", "curl"],
    ["Mozilla/5.0 Firefox", "other"],
    ["MyCustomBot/0.1", "other"],
  ];

  for (const [ua, expected] of cases) {
    it(`classifies "${ua}" as "${expected}"`, () => {
      expect(classifyMcpClient(ua)).toBe(expected);
    });
  }

  it("is case-insensitive", () => {
    expect(classifyMcpClient("CLAUDE-DESKTOP/1.0")).toBe("claude-desktop");
    expect(classifyMcpClient("cursor/1.0")).toBe("cursor");
  });
});

// ---------------------------------------------------------------------------
// sendGa4Event — env gating + payload shape
// ---------------------------------------------------------------------------

describe("sendGa4Event", () => {
  beforeEach(() => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
  });
  afterEach(() => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
  });

  it("no-ops when GA4_MEASUREMENT_ID is unset", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));
    await sendGa4Event({
      clientId: "c1",
      events: [{ name: "test" }],
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("no-ops when GA4_API_SECRET is unset even if id is set", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-ABC";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));
    await sendGa4Event({
      clientId: "c1",
      events: [{ name: "test" }],
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs to the GA4 Measurement Protocol when both env vars are set", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-ABCDE";
    process.env.GA4_API_SECRET = "secret123";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    await sendGa4Event({
      clientId: "session-1",
      events: [{ name: "agent_mcp_connected", params: { client_bucket: "curl" } }],
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("https://www.google-analytics.com/mp/collect");
    expect(url).toContain("measurement_id=G-ABCDE");
    expect(url).toContain("api_secret=secret123");
    expect((init as RequestInit).method).toBe("POST");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      client_id: "session-1",
      events: [{ name: "agent_mcp_connected", params: { client_bucket: "curl" } }],
    });
  });

  it("url-encodes measurement id and secret", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-WITH SPACE";
    process.env.GA4_API_SECRET = "s+e/cret";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    await sendGa4Event({ clientId: "c", events: [{ name: "x" }], fetchImpl });
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("G-WITH%20SPACE");
    expect(url).toContain("s%2Be%2Fcret");
  });

  it("swallows fetch errors (analytics must not throw)", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-ABC";
    process.env.GA4_API_SECRET = "s";
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      sendGa4Event({ clientId: "c", events: [{ name: "x" }], fetchImpl }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// trackMcpConnected — the specific event the server fires
// ---------------------------------------------------------------------------

describe("trackMcpConnected", () => {
  beforeEach(() => {
    process.env.GA4_MEASUREMENT_ID = "G-TEST";
    process.env.GA4_API_SECRET = "s";
  });
  afterEach(() => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
  });

  it("fires agent_mcp_connected with client_bucket derived from UA", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    await trackMcpConnected("sess-123", "Claude-Desktop/1.0", fetchImpl);

    const [, init] = fetchImpl.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.client_id).toBe("sess-123");
    expect(body.events).toEqual([
      {
        name: "agent_mcp_connected",
        params: { client_bucket: "claude-desktop" },
      },
    ]);
  });

  it("never sends the raw UA, only the bucket", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    await trackMcpConnected("sess", "Claude-Desktop/2.1.4 (macOS 14.1)", fetchImpl);

    const [, init] = fetchImpl.mock.calls[0]!;
    const serialized = (init as RequestInit).body as string;
    expect(serialized).not.toContain("2.1.4");
    expect(serialized).not.toContain("macOS");
  });

  it("defaults to 'unknown' bucket when no UA provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

    await trackMcpConnected("sess", undefined, fetchImpl);

    const [, init] = fetchImpl.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.events[0].params.client_bucket).toBe("unknown");
  });
});
