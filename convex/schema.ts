import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  comments: defineTable({
    postSlug: v.string(),
    authorName: v.string(),
    emailHash: v.optional(v.string()),
    body: v.string(),
    clientId: v.string(),
    createdAt: v.number(),
  })
    .index('by_post', ['postSlug', 'createdAt'])
    .index('by_client_recent', ['clientId', 'createdAt']),

  likes: defineTable({
    postSlug: v.string(),
    clientId: v.string(),
    createdAt: v.number(),
  })
    .index('by_post_and_client', ['postSlug', 'clientId'])
    .index('by_post', ['postSlug']),

  // DEPRECATED: `likeCounts` used to be a denormalized cache of the like
  // count per post. It introduced a race where concurrent first-likes for
  // the same slug could both insert a new row, leaving duplicates that
  // broke getCount's .unique() call forever. likes.ts no longer reads or
  // writes this table — count is derived directly from the `likes` table.
  // The schema entry stays so existing rows don't fail validation on the
  // next schema push. Follow-up: run a cleanup mutation to empty the
  // table, then drop this definition.
  likeCounts: defineTable({
    postSlug: v.string(),
    count: v.number(),
  }).index('by_post', ['postSlug']),

  contactSubmissions: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    clientId: v.string(),
    createdAt: v.number(),
    // Email delivery bookkeeping — patched by the sendContactEmails action.
    thankYouSent: v.optional(v.boolean()),
    notificationSent: v.optional(v.boolean()),
    emailError: v.optional(v.string()),
  })
    .index('by_client_recent', ['clientId', 'createdAt'])
    .index('by_created', ['createdAt']),

  // Newsletter subscribers. Single opt-in; unsubscribe link in every email
  // uses the stable unsubscribeToken to identify the row.
  subscribers: defineTable({
    email: v.string(), // normalized: trim + lowercase
    clientId: v.string(),
    subscribedAt: v.number(),
    unsubscribedAt: v.optional(v.number()), // set = unsubscribed; cleared on resub
    unsubscribeToken: v.string(), // 32 hex chars; stable across resub
    source: v.optional(v.string()), // "article:/cli-to-ai" | "blogs-index"
  })
    .index('by_email', ['email'])
    .index('by_unsubscribe_token', ['unsubscribeToken'])
    .index('by_client_recent', ['clientId', 'subscribedAt'])
    .index('by_active', ['unsubscribedAt']),

  // ---------------------------------------------------------------------
  // AI agent ("talk to me") — replaces the VPS-hosted mcp-server.
  // ---------------------------------------------------------------------

  // Knowledge nodes. Source of truth stays the markdown in mcp-server/nodes/
  // — `npm run agent:sync` re-parses the frontmatter and replaces this table
  // via `npx convex import --replace`. Never hand-edit rows.
  agentNodes: defineTable({
    nodeId: v.string(), // frontmatter `id`, globally unique
    title: v.string(),
    source: v.union(
      v.literal('project'),
      v.literal('essay'),
      v.literal('about'),
      v.literal('experience'),
      v.literal('thinking'),
    ),
    url: v.string(), // path on the live site, used in citation links
    date: v.optional(v.string()),
    tags: v.array(v.string()),
    summary: v.string(), // short single sentence — the only thing the router LLM sees (agent:sync caps it)
    body: v.string(), // full markdown body — what the responder reads
  }).index('by_node_id', ['nodeId']),

  // One conversation with the agent. The `token` is an unguessable
  // capability held by the client (localStorage on the web UI, passed as
  // conversation_id by MCP clients) — knowing it grants access to the
  // thread, so it is never enumerable from any public endpoint.
  agentThreads: defineTable({
    token: v.string(),
    origin: v.union(v.literal('web'), v.literal('mcp')),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_last_active', ['lastActiveAt']),

  // Individual turns. Server-held (not client-supplied) so history is
  // authoritative — a client can never replay a fabricated assistant turn.
  agentMessages: defineTable({
    threadId: v.id('agentThreads'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    // What the LLM sees/said. For user turns on inline surfaces this is the
    // contextHint-augmented form ("About the essay X: <question>").
    content: v.string(),
    // The user's literal words when `content` was augmented — what the UI
    // renders. Absent when identical to content.
    display: v.optional(v.string()),
    // Optional bounded page text attached by the site-wide selection UI.
    // Stored separately so a restored transcript can render the quote chip
    // without exposing the model-facing augmented prompt as the user message.
    selectionContext: v.optional(
      v.object({
        selectedText: v.string(),
        surroundingText: v.string(),
        nearestHeading: v.optional(v.string()),
        pageTitle: v.string(),
        pathname: v.string(),
      }),
    ),
    citations: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          url: v.string(),
          source: v.string(),
        }),
      ),
    ),
    createdAt: v.number(),
  }).index('by_thread', ['threadId', 'createdAt']),

  // Fixed-window rate-limit buckets keyed by client IP (or thread token as
  // fallback). Rows are reused per key and purged by the retention cron.
  agentRateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  })
    .index('by_key', ['key'])
    // Retention cron sweeps oldest-first so rows can't outrun the purge.
    .index('by_window_start', ['windowStart']),

  // One row per post we've announced. Used as the idempotency guard for
  // notifier.announce — re-running for an existing slug returns skipped:true.
  notifiedPosts: defineTable({
    postSlug: v.string(), // matches src/data/posts.ts: "/cli-to-ai"
    firstSeenAt: v.number(), // when claimed (before fanout)
    notifiedAt: v.optional(v.number()), // when fanout completed
    recipientCount: v.optional(v.number()),
    errorCount: v.optional(v.number()),
  }).index('by_slug', ['postSlug']),
});
