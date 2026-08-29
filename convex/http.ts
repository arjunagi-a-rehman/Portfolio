import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import {
  blockedBot,
  corsHeaders,
  corsPreflight,
  DEGRADED_PAYLOAD,
  formatSseEvent,
  jsonResponse,
  killSwitchOn,
  rateLimitKey,
  SITE_ORIGIN,
} from './agent/guards';
import { createAgentMcpServer } from './agent/mcp';
import {
  type AnswerResult,
  buildSelectionAugmentedQuery,
  createAnthropicClient,
  generateAnswerStream,
  generateSelectionExplanationStream,
  isFiller,
  MAX_QUERY_LENGTH,
  MAX_SELECTED_TEXT_LENGTH,
  MAX_SURROUNDING_TEXT_LENGTH,
  type PageSelectionContext,
  pickColdFillerReaction,
  routeQuery,
} from './agent/pipeline';
import { MAX_THREAD_TOKEN_LENGTH } from './agent/threads';

const http = httpRouter();

/** Validate and normalize bounded page-selection data from an HTTP request. */
function parseSelectionContext(value: unknown): PageSelectionContext | null {
  if (typeof value !== 'object' || value === null) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.selectedText !== 'string' ||
    input.selectedText.trim().length < 2 ||
    input.selectedText.length > MAX_SELECTED_TEXT_LENGTH ||
    typeof input.surroundingText !== 'string' ||
    input.surroundingText.trim().length < 2 ||
    input.surroundingText.length > MAX_SURROUNDING_TEXT_LENGTH ||
    typeof input.pageTitle !== 'string' ||
    input.pageTitle.length > 200 ||
    typeof input.pathname !== 'string' ||
    input.pathname.length > 300 ||
    (input.nearestHeading !== undefined &&
      (typeof input.nearestHeading !== 'string' ||
        input.nearestHeading.length > 200))
  ) {
    return null;
  }
  return {
    selectedText: input.selectedText.trim(),
    surroundingText: input.surroundingText.trim(),
    nearestHeading:
      typeof input.nearestHeading === 'string'
        ? input.nearestHeading.trim()
        : undefined,
    pageTitle: input.pageTitle.trim(),
    pathname: input.pathname.trim(),
  };
}

// ---------------------------------------------------------------------------
// POST /ask — SSE endpoint for the AgentChat browser UI.
//
// Request:  { query: string, threadId?: string, contextHint?: string }
// Stream:   event: token  {"text": "..."}          (many)
//           event: done   {"citations", "noMatch", "latencyMs", "threadId"}
//           event: error  {"message": "..."}
//
// Conversation history is server-held: the client sends only its thread
// token (minted here on first message) and the new query. Guarded by kill
// switch → rate limiter → CORS allowlist.
// ---------------------------------------------------------------------------

http.route({
  path: '/ask',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => corsPreflight(request)),
});

http.route({
  path: '/ask',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const cors = corsHeaders(request);

    if (killSwitchOn()) {
      return jsonResponse(DEGRADED_PAYLOAD, 503, cors);
    }

    let body: {
      query?: unknown;
      threadId?: unknown;
      contextHint?: unknown;
      selectionContext?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
    }

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length === 0) {
      return jsonResponse(
        { error: 'Query cannot be empty or whitespace' },
        400,
        cors,
      );
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return jsonResponse(
        { error: `Query must be under ${MAX_QUERY_LENGTH} characters` },
        400,
        cors,
      );
    }
    const threadToken =
      typeof body.threadId === 'string' &&
      body.threadId.length <= MAX_THREAD_TOKEN_LENGTH
        ? body.threadId
        : undefined;
    const contextHint =
      typeof body.contextHint === 'string' && body.contextHint.length <= 160
        ? body.contextHint.trim()
        : undefined;
    const selectionContext =
      body.selectionContext === undefined
        ? undefined
        : parseSelectionContext(body.selectionContext);
    if (body.selectionContext !== undefined && !selectionContext) {
      return jsonResponse({ error: 'Invalid selection context' }, 400, cors);
    }

    const rl = await ctx.runMutation(internal.agent.threads.checkRateLimit, {
      key: rateLimitKey('ask', request),
    });
    if (!rl.ok) {
      return jsonResponse(
        {
          error: 'Rate limit exceeded on /ask. Slow down.',
          retryAfterSeconds: rl.retryAfterSeconds,
        },
        429,
        { ...cors, 'Retry-After': String(rl.retryAfterSeconds) },
      );
    }

    const { token, history } = await ctx.runMutation(
      internal.agent.threads.getOrCreate,
      { token: threadToken, origin: 'web' },
    );

    // Inline surfaces (essay/project embeds) send the page context
    // separately; the LLM sees the augmented form, the transcript keeps the
    // user's literal words for display.
    const augmented = selectionContext
      ? buildSelectionAugmentedQuery(query, selectionContext, contextHint)
      : contextHint
        ? `About ${contextHint}: ${query}`
        : query;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // A response can become unwritable while the asynchronous pipeline is
        // still completing. Convex does not expose request-disconnect
        // propagation here, so generation and transcript persistence continue.
        const emit = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(formatSseEvent(event, data)));
          } catch {
            /* client gone — keep the pipeline running to persist the turn */
          }
        };

        const run = async () => {
          const startTime = Date.now();
          const client = createAnthropicClient();
          let result: AnswerResult | null = null;

          // ── Cold filler ── no LLM, just a quick human reaction
          if (isFiller(query) && history.length === 0) {
            const answer = pickColdFillerReaction(query);
            emit('token', { text: answer });
            result = {
              answer,
              citations: [],
              noMatch: false,
              latencyMs: Date.now() - startTime,
            };
          } else {
            // Fillers with history skip routing — the conversation carries
            // the context, no fresh nodes needed.
            let nodes: Doc<'agentNodes'>[] = [];
            if (!isFiller(query)) {
              const summaries = await ctx.runQuery(
                internal.agent.nodes.listSummaries,
                {},
              );
              const decision = await routeQuery(client, augmented, summaries);
              // A router no-match leaves `nodes` empty; generateAnswerStream's
              // cold-start guard then emits NO_MATCH_ANSWER (no LLM call) when
              // there's also no history, or continues the conversation when
              // there is. One code path, no duplicated no-match branch.
              if (!decision.noMatch) {
                nodes = await ctx.runQuery(internal.agent.nodes.getByIds, {
                  nodeIds: decision.nodeIds,
                });
              }
            }

            if (!result) {
              result = await generateAnswerStream(
                client,
                augmented,
                nodes,
                history,
                startTime,
                (text) => emit('token', { text }),
              );
            }
          }

          await ctx.runMutation(internal.agent.threads.appendExchange, {
            token,
            userContent: augmented,
            userDisplay: contextHint || selectionContext ? query : undefined,
            selectionContext: selectionContext ?? undefined,
            assistantContent: result.answer,
            citations:
              result.citations.length > 0 ? result.citations : undefined,
          });

          emit('done', {
            citations: result.citations,
            noMatch: result.noMatch,
            latencyMs: result.latencyMs,
            threadId: token,
          });
        };

        run()
          .catch((err) => {
            console.error('[/ask] Pipeline error:', err);
            emit('error', {
              message: 'Agent pipeline error. Please try again.',
            });
          })
          .finally(() => {
            try {
              controller.close();
            } catch {
              /* response stream is already closed */
            }
          });
      },
    });

    return new Response(stream, {
      headers: {
        ...cors,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  }),
});

// ---------------------------------------------------------------------------
// POST /explain — one-shot explanation for text selected anywhere on the site.
// Uses bounded local page context, streams tokens, and deliberately creates no
// agent thread or transcript rows. A reader can explicitly promote the same
// selection to /ask from the client when they want a real conversation.
// ---------------------------------------------------------------------------

http.route({
  path: '/explain',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => corsPreflight(request)),
});

http.route({
  path: '/explain',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const cors = corsHeaders(request);
    if (killSwitchOn()) {
      return jsonResponse(DEGRADED_PAYLOAD, 503, cors);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
    }
    const selectionContext = parseSelectionContext(body);
    if (!selectionContext) {
      return jsonResponse({ error: 'Invalid selection context' }, 400, cors);
    }

    const rl = await ctx.runMutation(internal.agent.threads.checkRateLimit, {
      key: rateLimitKey('explain', request),
    });
    if (!rl.ok) {
      return jsonResponse(
        {
          error: 'Rate limit exceeded on /explain. Slow down.',
          retryAfterSeconds: rl.retryAfterSeconds,
        },
        429,
        { ...cors, 'Retry-After': String(rl.retryAfterSeconds) },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const emit = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(formatSseEvent(event, data)));
          } catch {
            /* response stream is no longer writable */
          }
        };

        const run = async () => {
          const result = await generateSelectionExplanationStream(
            createAnthropicClient(),
            selectionContext,
            Date.now(),
            (text) => emit('token', { text }),
          );
          emit('done', { latencyMs: result.latencyMs });
        };

        run()
          .catch((error) => {
            console.error('[/explain] Pipeline error:', error);
            emit('error', {
              message: 'Unable to explain this selection. Please try again.',
            });
          })
          .finally(() => {
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          });
      },
    });

    return new Response(stream, {
      headers: {
        ...cors,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  }),
});

// ---------------------------------------------------------------------------
// GET /agent/thread?token=… — restore a conversation for the web UI.
// The token is the capability; an unknown/purged token is a plain 404.
// ---------------------------------------------------------------------------

http.route({
  path: '/agent/thread',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => corsPreflight(request)),
});

http.route({
  path: '/agent/thread',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const cors = corsHeaders(request);

    if (killSwitchOn()) {
      return jsonResponse(DEGRADED_PAYLOAD, 503, cors);
    }

    const rl = await ctx.runMutation(internal.agent.threads.checkRateLimit, {
      key: rateLimitKey('thread', request),
    });
    if (!rl.ok) {
      return jsonResponse({ error: 'Rate limit exceeded. Slow down.' }, 429, {
        ...cors,
        'Retry-After': String(rl.retryAfterSeconds),
      });
    }

    const token = new URL(request.url).searchParams.get('token') ?? '';
    if (!token || token.length > MAX_THREAD_TOKEN_LENGTH) {
      return jsonResponse({ error: 'Missing or invalid token' }, 400, cors);
    }
    const messages = await ctx.runQuery(internal.agent.threads.getTranscript, {
      token,
    });
    if (messages === null) {
      return jsonResponse({ error: 'Unknown thread' }, 404, cors);
    }
    return jsonResponse({ messages }, 200, cors);
  }),
});

// ---------------------------------------------------------------------------
// /mcp — Streamable HTTP endpoint for external MCP clients, in stateless
// mode: a fresh server+transport pair per request, no session store.
// Guarded by: kill switch → bot UA filter → rate limiter.
// ---------------------------------------------------------------------------

const mcpHandler = httpAction(async (ctx, request) => {
  if (killSwitchOn()) {
    return jsonResponse(DEGRADED_PAYLOAD, 503);
  }

  const bot = blockedBot(request.headers.get('user-agent') ?? '');
  if (bot) {
    console.log(`[mcp] blocked bot UA match: ${bot}`);
    return jsonResponse(
      {
        error: 'Bot traffic not accepted on this endpoint.',
        contact: `${SITE_ORIGIN}/#contact`,
      },
      403,
    );
  }

  const rl = await ctx.runMutation(internal.agent.threads.checkRateLimit, {
    key: rateLimitKey('mcp', request),
  });
  if (!rl.ok) {
    return jsonResponse(
      {
        error: 'Rate limit exceeded on /mcp. Slow down.',
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      429,
      { 'Retry-After': String(rl.retryAfterSeconds) },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,
  });
  const server = createAgentMcpServer(ctx);
  await server.connect(transport);
  return transport.handleRequest(request);
});

http.route({ path: '/mcp', method: 'POST', handler: mcpHandler });
http.route({ path: '/mcp', method: 'GET', handler: mcpHandler });
http.route({ path: '/mcp', method: 'DELETE', handler: mcpHandler });
http.route({
  path: '/mcp',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => corsPreflight(request)),
});

// Fallback one-click unsubscribe endpoint.
//
// Normally the email's unsubscribe link points at the Astro page at
// /unsubscribe?token=... which handles it via React. But Gmail's
// "List-Unsubscribe: <URL>" header uses this endpoint directly (they ping
// it without a browser), and mail clients with JS disabled fall back here
// too. Returns a self-contained HTML page so either flow produces a clean
// confirmation.
http.route({
  path: '/unsubscribe',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const result = await ctx.runMutation(
      internal.subscribers._unsubscribeInternal,
      { token },
    );

    const title = result.ok ? 'Unsubscribed' : 'Invalid link';
    const message = result.ok
      ? result.alreadyUnsubscribed
        ? "You're already unsubscribed. Nothing more to do."
        : "You've been unsubscribed. You won't receive further emails."
      : 'This unsubscribe link is invalid or has expired.';

    const html = `<!doctype html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Arjunagi A. Rehman</title>
  <style>
    body { font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;
      background:#040912; color:#dde5f4; margin:0; padding:80px 20px;
      text-align:center; min-height:100vh; box-sizing:border-box; }
    .card { max-width:480px; margin:0 auto; background:#0a1424;
      border:1px solid rgba(0,229,255,0.35); border-radius:12px;
      padding:36px 32px; }
    h1 { margin:0 0 12px; font-size:22px; color:#00e5ff; letter-spacing:0.02em; }
    p  { color:#96a8bf; line-height:1.6; font-size:15px; margin:0 0 20px; }
    a  { color:#00e5ff; text-decoration:none; font-size:14px;
      font-family:monospace; letter-spacing:0.04em; }
    a:hover { text-decoration:underline; }
  </style>
</head><body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://arjunagiarehman.com/blogs">← Back to the blog</a>
  </div>
</body></html>`;

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }),
});

// Convex HTTP routers treat POST /unsubscribe the same way for List-Unsubscribe-Post:
// Gmail sends an empty POST when the user clicks the inbox-level button.
http.route({
  path: '/unsubscribe',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    await ctx.runMutation(internal.subscribers._unsubscribeInternal, { token });
    // Gmail expects a 2xx; body is ignored.
    return new Response('ok', { status: 200 });
  }),
});

export default http;
