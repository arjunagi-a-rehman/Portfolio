import Anthropic from '@anthropic-ai/sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { isFiller, pickColdFillerReaction } from './fillers.js';
import { trackMcpConnected } from './ga4.js';
import {
  createBotFilter,
  createKillSwitch,
  createRateLimiter,
} from './middleware.js';
import { getNodesByIds, loadNodes } from './nodes.js';
import { generateAnswer, generateAnswerStream } from './responder.js';
import { routeQuery } from './router.js';
import {
  AskRequestSchema,
  type HealthResponse,
  type ReadyResponse,
} from './types.js';

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono();

app.use(
  '*',
  cors({
    origin: [
      'https://arjunagiarehman.com',
      'http://localhost:4321',
      'http://localhost:3000',
    ],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Mcp-Session-Id', 'Authorization'],
    exposeHeaders: ['Mcp-Session-Id'],
  }),
);

// ---------------------------------------------------------------------------
// Safety middleware
// ---------------------------------------------------------------------------
//
// Each expensive endpoint gets its own rate-limit bucket (so a flood on /ask
// doesn't also starve legitimate /mcp traffic). The kill switch fronts both.
// The bot filter only guards /mcp — /ask is already origin-locked by CORS.
//
// Config is resolved per-request from env so Dokploy env var changes take
// effect without redeploy:
//   RATE_LIMIT_MAX        default 10 req/window
//   RATE_LIMIT_WINDOW_MS  default 60_000 (1 minute)
//   AGENT_DISABLED=1      short-circuits both endpoints to a degraded response
//   ALLOWED_BOTS          comma-separated UA substrings to allowlist
// ---------------------------------------------------------------------------

const killSwitch = createKillSwitch();
const askRateLimiter = createRateLimiter({ label: '/ask' });
const mcpRateLimiter = createRateLimiter({ label: '/mcp' });
const botFilter = createBotFilter({
  allow: (process.env.ALLOWED_BOTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});

// ---------------------------------------------------------------------------
// /health — liveness probe (is the process up?)
// ---------------------------------------------------------------------------

app.get('/health', (c) => {
  const body: HealthResponse = {
    status: 'ok',
    uptime: process.uptime(),
  };
  return c.json(body);
});

// ---------------------------------------------------------------------------
// /ready — readiness probe (are nodes loaded + LLM reachable?)
// ---------------------------------------------------------------------------

app.get('/ready', async (c) => {
  const nodes = await loadNodes().catch(() => []);
  const nodesLoaded = nodes.length;

  let llmReachable = false;
  try {
    const anthropic = new Anthropic();
    await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
    llmReachable = true;
  } catch {
    llmReachable = false;
  }

  const body: ReadyResponse = {
    status: nodesLoaded > 0 && llmReachable ? 'ready' : 'not_ready',
    nodesLoaded,
    llmReachable,
  };

  return c.json(body, body.status === 'ready' ? 200 : 503);
});

// ---------------------------------------------------------------------------
// /ask — plain JSON endpoint for the browser UI
// Guarded by: kill switch → rate limiter → CORS (upstream)
// ---------------------------------------------------------------------------

app.post('/ask', killSwitch, askRateLimiter, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = AskRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      400,
    );
  }

  const { query, history } = parsed.data;

  // ── SSE stream ─────────────────────────────────────────────────────────
  //  event: token  — data: {"text": "chunk"}  (may arrive many times)
  //  event: done   — data: {"citations": [...], "noMatch": bool, "latencyMs": n}
  //  event: error  — data: {"message": "..."}
  // ──────────────────────────────────────────────────────────────────────
  return streamSSE(c, async (stream) => {
    const startTime = Date.now();

    const emitText = async (chunk: string) => {
      await stream.writeSSE({
        event: 'token',
        data: JSON.stringify({ text: chunk }),
      });
    };

    const emitDone = async (meta: {
      citations: unknown;
      noMatch: boolean;
      latencyMs: number;
    }) => {
      await stream.writeSSE({ event: 'done', data: JSON.stringify(meta) });
    };

    try {
      // ── Short filler ── no LLM, no streaming, just a quick reaction
      if (isFiller(query)) {
        if (history.length === 0) {
          const answer = pickColdFillerReaction(query);
          await emitText(answer);
          await emitDone({
            citations: [],
            noMatch: false,
            latencyMs: Date.now() - startTime,
          });
          return;
        }
        // With history: stream the LLM's continuation — no fresh nodes
        const response = await generateAnswerStream(
          query,
          [],
          startTime,
          history,
          emitText,
        );
        await emitDone({
          citations: response.citations,
          noMatch: response.noMatch,
          latencyMs: response.latencyMs,
        });
        return;
      }

      // ── Route ──
      const decision = await routeQuery(query);

      if (decision.noMatch) {
        if (history.length === 0) {
          const answer =
            "Haven't covered that one. Ask me about agents, what I've shipped, or where I think things are heading — those I can actually speak to. Or just hit the contact button if you want to go off-script.";
          await emitText(answer);
          await emitDone({
            citations: [],
            noMatch: true,
            latencyMs: Date.now() - startTime,
          });
          return;
        }
        // No match but conversation has context — let the LLM continue
        const response = await generateAnswerStream(
          query,
          [],
          startTime,
          history,
          emitText,
        );
        await emitDone({
          citations: response.citations,
          noMatch: response.noMatch,
          latencyMs: response.latencyMs,
        });
        return;
      }

      // ── Fetch node bodies, stream the cited answer ──
      const nodes = await getNodesByIds(decision.nodeIds);
      const response = await generateAnswerStream(
        query,
        nodes,
        startTime,
        history,
        emitText,
      );
      await emitDone({
        citations: response.citations,
        noMatch: response.noMatch,
        latencyMs: response.latencyMs,
      });
    } catch (err) {
      console.error('[/ask] Pipeline error:', err);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          message: 'Agent pipeline error. Please try again.',
        }),
      });
    }
  });
});

// ---------------------------------------------------------------------------
// /mcp — MCP SDK session + tool registration (route handler is below)
// Transport: WebStandardStreamableHTTPServerTransport (spec 2025-03-26+)
// Clients: Claude Desktop, Cursor, mcp-inspector
// ---------------------------------------------------------------------------

/** Session store: sessionId → transport */
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

function createMcpServerInstance(): McpServer {
  const server = new McpServer({
    name: 'rehman-portfolio-agent',
    version: '1.0.0',
  });

  // Tool: ask_rehman
  // The primary tool — ask a question, get a cited answer
  server.registerTool(
    'ask_rehman',
    {
      title: 'Ask Rehman',
      description:
        "Ask Arjunagi A. Rehman's AI persona a question about his projects, essays, technical thinking, or background. Returns a cited answer grounded in his actual writing.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe('The question to ask Rehman'),
      },
    },
    async ({ query }) => {
      const startTime = Date.now();

      try {
        const decision = await routeQuery(query);

        if (decision.noMatch) {
          return {
            content: [
              {
                type: 'text',
                text: "I don't have anything written about that yet.",
              },
            ],
          };
        }

        const nodes = await getNodesByIds(decision.nodeIds);
        const response = await generateAnswer(query, nodes, startTime);

        // Format citations as a readable list after the answer
        const citationList =
          response.citations.length > 0
            ? '\n\nSources:\n' +
              response.citations
                .map(
                  (c) =>
                    `- [${c.id}] ${c.title}: https://arjunagiarehman.com${c.url}`,
                )
                .join('\n')
            : '';

        return {
          content: [
            {
              type: 'text',
              text: response.answer + citationList,
            },
          ],
        };
      } catch (err) {
        console.error('[mcp/ask_rehman] Error:', err);
        return {
          content: [
            {
              type: 'text',
              text: 'Agent pipeline error. Please try again.',
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Tool: list_nodes
  // Lets external clients discover what topics are covered
  server.registerTool(
    'list_nodes',
    {
      title: 'List Knowledge Nodes',
      description:
        "Returns the full list of knowledge nodes available in Rehman's knowledge base. Source categories: project (shipped artifacts), essay (long-form writing), about (bio/deny-list), experience (career arcs per company), thinking (short takes/values/reading). Useful for discovering what topics are covered before asking questions.",
      inputSchema: {
        source: z
          .enum(['project', 'essay', 'about', 'experience', 'thinking', 'all'])
          .default('all')
          .describe('Filter by source type'),
      },
    },
    async ({ source }) => {
      try {
        const nodes = await loadNodes();
        const filtered =
          source === 'all'
            ? nodes
            : nodes.filter((n) => n.frontmatter.source === source);

        const list = filtered
          .map(
            (n) =>
              `[${n.frontmatter.id}] ${n.frontmatter.title} (${n.frontmatter.source}) — ${n.frontmatter.summary}`,
          )
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: list || 'No nodes found.',
            },
          ],
        };
      } catch (err) {
        console.error('[mcp/list_nodes] Error:', err);
        return {
          content: [{ type: 'text', text: 'Failed to load nodes.' }],
          isError: true,
        };
      }
    },
  );

  return server;
}

// ---------------------------------------------------------------------------
// /mcp — Streamable HTTP transport for external MCP clients
// Guarded by: kill switch → bot UA filter → rate limiter
// ---------------------------------------------------------------------------

app.all('/mcp', killSwitch, botFilter, mcpRateLimiter, async (c) => {
  const sessionId = c.req.header('mcp-session-id');

  // Reuse existing session transport
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId)!;
    return transport.handleRequest(c.req.raw);
  }

  // Capture UA from the initiating request for server-side analytics. The
  // init callback only receives the session id, so we close over the UA
  // here and use it inside onsessioninitialized.
  const connectingUserAgent = c.req.header('user-agent');

  // New session — create transport + server, wire them together
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sid) => {
      sessions.set(sid, transport);
      console.log(`[mcp] Session created: ${sid} (total: ${sessions.size})`);
      // Fire-and-forget analytics. No-ops if GA4_MEASUREMENT_ID /
      // GA4_API_SECRET are unset (typical for forks + dev). Never throws.
      void trackMcpConnected(sid, connectingUserAgent);
    },
    onsessionclosed: (sid) => {
      sessions.delete(sid);
      console.log(`[mcp] Session closed: ${sid} (total: ${sessions.size})`);
    },
  });

  const mcpServer = createMcpServerInstance();
  await mcpServer.connect(transport);

  return transport.handleRequest(c.req.raw);
});

export default app;
