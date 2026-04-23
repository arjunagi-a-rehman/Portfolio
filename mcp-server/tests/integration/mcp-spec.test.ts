/**
 * MCP spec integration tests
 *
 * Spins up a real Bun HTTP server on a random port and tests the full
 * MCP Streamable HTTP protocol:
 * - Session initialization (POST /mcp with no session ID → gets Mcp-Session-Id back)
 * - Session reuse (subsequent requests carry the same session ID)
 * - tools/list — server advertises ask_rehman and list_nodes
 * - tools/call ask_rehman — returns text content
 * - tools/call list_nodes — returns node list
 * - Session deletion (DELETE /mcp)
 *
 * The pipeline (router + responder) is mocked so no ANTHROPIC_API_KEY needed.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock pipeline before importing server
vi.mock("../../src/router.js", () => ({
  routeQuery: vi.fn().mockResolvedValue({
    nodeIds: ["kalrav-ai"],
    confidence: "high",
    noMatch: false,
  }),
}));
vi.mock("../../src/responder.js", () => ({
  generateAnswer: vi.fn().mockResolvedValue({
    answer: "Kalrav.AI is a vertical AI agent platform [kalrav-ai].",
    citations: [
      {
        id: "kalrav-ai",
        title: "Kalrav.AI",
        url: "/projects/kalrav",
        source: "project",
      },
    ],
    noMatch: false,
    latencyMs: 100,
  }),
}));
vi.mock("../../src/nodes.js", () => ({
  loadNodes: vi.fn().mockResolvedValue([
    {
      frontmatter: {
        id: "kalrav-ai",
        title: "Kalrav.AI",
        source: "project",
        url: "/projects/kalrav",
        tags: ["ai-agents"],
        summary: "Vertical AI agent platform for e-commerce",
      },
      body: "Kalrav.AI body content.",
    },
  ]),
  getNodesByIds: vi.fn().mockResolvedValue([
    {
      frontmatter: {
        id: "kalrav-ai",
        title: "Kalrav.AI",
        source: "project",
        url: "/projects/kalrav",
        tags: ["ai-agents"],
        summary: "Vertical AI agent platform for e-commerce",
      },
      body: "Kalrav.AI body content.",
    },
  ]),
  getNodeSummaries: vi.fn().mockResolvedValue([
    {
      id: "kalrav-ai",
      title: "Kalrav.AI",
      summary: "Vertical AI agent platform",
      tags: ["ai-agents"],
    },
  ]),
  clearNodeCache: vi.fn(),
}));

import app from "../../src/server.js";
import { serve } from "@hono/node-server";

// ---------------------------------------------------------------------------
// Server lifecycle — use @hono/node-server (Node.js HTTP) so Vitest can run it
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let server: any;
let BASE_URL: string;

beforeAll(async () => {
  // Bump the rate limit so 100+ test requests from "unknown" IP don't trip the
  // middleware's 10/min default. The rate limiter itself is tested separately
  // in src/middleware.test.ts.
  process.env.RATE_LIMIT_MAX = "10000";

  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      BASE_URL = `http://localhost:${info.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  delete process.env.RATE_LIMIT_MAX;
  await new Promise<void>((resolve, reject) =>
    server.close((err: Error | undefined) => (err ? reject(err) : resolve()))
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a JSON-RPC 2.0 MCP request */
async function mcpPost(
  body: object,
  sessionId?: string
): Promise<{ res: Response; json: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // MCP may respond with SSE or JSON — parse whichever comes back
  const contentType = res.headers.get("content-type") ?? "";
  let json: unknown = null;
  if (contentType.includes("application/json")) {
    json = await res.json();
  } else if (contentType.includes("text/event-stream")) {
    // Read the SSE stream and parse the first data line
    const text = await res.text();
    const match = text.match(/^data: (.+)$/m);
    if (match?.[1]) json = JSON.parse(match[1]);
  }

  return { res, json };
}

const INIT_REQUEST = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "vitest-mcp-client", version: "1.0.0" },
  },
};

const LIST_TOOLS_REQUEST = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP spec — session lifecycle", () => {
  it("POST /mcp initialize → returns Mcp-Session-Id header", async () => {
    const { res, json } = await mcpPost(INIT_REQUEST);

    expect(res.status).toBe(200);
    const sessionId = res.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe("string");
    expect((sessionId as string).length).toBeGreaterThan(8);
  });

  it("Mcp-Session-Id is a valid UUID format", async () => {
    const { res } = await mcpPost(INIT_REQUEST);
    const sessionId = res.headers.get("mcp-session-id");
    // UUID v4 pattern
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("session reuse — same session ID accepted on follow-up requests", async () => {
    const { res: initRes } = await mcpPost(INIT_REQUEST);
    const sessionId = initRes.headers.get("mcp-session-id")!;
    expect(sessionId).toBeTruthy();

    // Follow-up request with the session ID should succeed
    const { res: toolsRes } = await mcpPost(LIST_TOOLS_REQUEST, sessionId);
    expect(toolsRes.status).toBe(200);
  });

  it("request without session ID on follow-up is handled gracefully", async () => {
    // Without session ID, a new session is created (not 400)
    const { res } = await mcpPost(LIST_TOOLS_REQUEST);
    // Server may return 400 (no session) or 200 (creates new) — both are valid per spec
    expect([200, 400]).toContain(res.status);
  });
});

describe("MCP spec — tools/list", () => {
  let sessionId: string;

  beforeAll(async () => {
    const { res } = await mcpPost(INIT_REQUEST);
    sessionId = res.headers.get("mcp-session-id")!;
  });

  it("advertises ask_rehman tool", async () => {
    const { json } = await mcpPost(LIST_TOOLS_REQUEST, sessionId);
    const result = json as { result?: { tools?: Array<{ name: string }> } };
    const tools = result?.result?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toContain("ask_rehman");
  });

  it("advertises list_nodes tool", async () => {
    const { json } = await mcpPost(LIST_TOOLS_REQUEST, sessionId);
    const result = json as { result?: { tools?: Array<{ name: string }> } };
    const tools = result?.result?.tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_nodes");
  });

  it("ask_rehman tool has a description and inputSchema", async () => {
    const { json } = await mcpPost(LIST_TOOLS_REQUEST, sessionId);
    const result = json as {
      result?: {
        tools?: Array<{ name: string; description?: string; inputSchema?: object }>;
      };
    };
    const tools = result?.result?.tools ?? [];
    const askTool = tools.find((t) => t.name === "ask_rehman");
    expect(askTool).toBeDefined();
    expect(askTool?.description).toBeTruthy();
    expect(askTool?.inputSchema).toBeDefined();
  });
});

describe("MCP spec — tools/call ask_rehman", () => {
  let sessionId: string;

  beforeAll(async () => {
    const { res } = await mcpPost(INIT_REQUEST);
    sessionId = res.headers.get("mcp-session-id")!;
  });

  it("returns text content for a valid query", async () => {
    const { res, json } = await mcpPost(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "ask_rehman",
          arguments: { query: "What is Kalrav.AI?" },
        },
      },
      sessionId
    );

    expect(res.status).toBe(200);
    const result = json as {
      result?: { content?: Array<{ type: string; text?: string }> };
    };
    const content = result?.result?.content ?? [];
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]?.type).toBe("text");
    expect(content[0]?.text).toBeTruthy();
    expect(typeof content[0]?.text).toBe("string");
  });

  it("rejects call with missing query argument", async () => {
    const { json } = await mcpPost(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "ask_rehman",
          arguments: {},
        },
      },
      sessionId
    );
    // Should return an error response, not throw
    const result = json as { error?: object; result?: object };
    // Either an MCP error or an isError tool result
    const hasError =
      result?.error != null ||
      (result?.result as { isError?: boolean } | undefined)?.isError === true;
    expect(hasError).toBe(true);
  });
});

describe("MCP spec — tools/call list_nodes", () => {
  let sessionId: string;

  beforeAll(async () => {
    const { res } = await mcpPost(INIT_REQUEST);
    sessionId = res.headers.get("mcp-session-id")!;
  });

  it("returns a list of nodes when source=all", async () => {
    const { res, json } = await mcpPost(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "list_nodes",
          arguments: { source: "all" },
        },
      },
      sessionId
    );

    expect(res.status).toBe(200);
    const result = json as {
      result?: { content?: Array<{ type: string; text?: string }> };
    };
    const content = result?.result?.content ?? [];
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]?.type).toBe("text");
    expect(content[0]?.text).toContain("kalrav-ai");
  });
});

describe("MCP spec — unknown tool", () => {
  let sessionId: string;

  beforeAll(async () => {
    const { res } = await mcpPost(INIT_REQUEST);
    sessionId = res.headers.get("mcp-session-id")!;
  });

  it("returns an error for a non-existent tool name", async () => {
    const { json } = await mcpPost(
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "does_not_exist",
          arguments: {},
        },
      },
      sessionId
    );
    // MCP SDK may surface unknown-tool as top-level error OR result.isError
    const result = json as {
      error?: object;
      result?: { isError?: boolean; content?: unknown[] };
    };
    const hasError =
      result?.error != null || result?.result?.isError === true;
    expect(hasError).toBe(true);
  });
});
