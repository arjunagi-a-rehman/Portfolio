import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { internalMutation, internalQuery } from '../_generated/server';

// ---------------------------------------------------------------------------
// Conversation threads — server-held history for the agent.
//
// A thread is identified by an unguessable `token` (crypto.randomUUID) that
// the client holds: localStorage for the web UI, the `conversation_id` tool
// argument for MCP clients. History loaded from the table is authoritative —
// clients never supply prior turns, so nobody can replay a fabricated
// assistant message.
// ---------------------------------------------------------------------------

/** Max prior turns fed back to the LLM — same cap the VPS server enforced. */
export const MAX_HISTORY_TURNS = 20;

/** Tokens are crypto.randomUUID (36 chars); 64 leaves headroom without
 *  letting clients feed arbitrary-length strings into index lookups. */
export const MAX_THREAD_TOKEN_LENGTH = 64;

/** Threads idle longer than this are purged by the retention cron. */
export const THREAD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const citationValidator = v.array(
  v.object({
    id: v.string(),
    title: v.string(),
    url: v.string(),
    source: v.string(),
  }),
);

/**
 * Resolve a thread by token, creating one when the token is absent or
 * unknown (an unknown token most likely means the thread was purged by the
 * retention cron — starting fresh is the right behavior). Returns the token
 * to hold on to plus the LLM-facing history, oldest first.
 */
export const getOrCreate = internalMutation({
  args: {
    token: v.optional(v.string()),
    origin: v.union(v.literal('web'), v.literal('mcp')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.token) {
      const existing = await ctx.db
        .query('agentThreads')
        .withIndex('by_token', (q) => q.eq('token', args.token as string))
        .unique();
      if (existing) {
        const recent = await ctx.db
          .query('agentMessages')
          .withIndex('by_thread', (q) => q.eq('threadId', existing._id))
          .order('desc')
          .take(MAX_HISTORY_TURNS);
        return {
          token: existing.token,
          history: recent
            .reverse()
            .map((m) => ({ role: m.role, content: m.content })),
        };
      }
    }

    const token = crypto.randomUUID();
    await ctx.db.insert('agentThreads', {
      token,
      origin: args.origin,
      createdAt: now,
      lastActiveAt: now,
    });
    return { token, history: [] };
  },
});

/**
 * Persist one completed exchange (user turn + assistant turn) atomically.
 * Called by the HTTP action after the answer finishes streaming.
 */
export const appendExchange = internalMutation({
  args: {
    token: v.string(),
    userContent: v.string(),
    /** The user's literal words when userContent was contextHint-augmented. */
    userDisplay: v.optional(v.string()),
    assistantContent: v.string(),
    citations: v.optional(citationValidator),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query('agentThreads')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();
    // Thread purged mid-conversation (retention cron) — drop silently; the
    // client's next message will mint a fresh thread.
    if (!thread) return null;

    const now = Date.now();
    await ctx.db.insert('agentMessages', {
      threadId: thread._id,
      role: 'user',
      content: args.userContent,
      display: args.userDisplay,
      createdAt: now,
    });
    await ctx.db.insert('agentMessages', {
      threadId: thread._id,
      role: 'assistant',
      content: args.assistantContent,
      citations: args.citations,
      createdAt: now + 1, // deterministic ordering within the exchange
    });
    await ctx.db.patch('agentThreads', thread._id, { lastActiveAt: now });
    return null;
  },
});

/**
 * Restore a conversation for the web UI (GET /agent/thread). Returns the
 * display-facing transcript, oldest first — capped so a marathon thread
 * can't blow up the response.
 */
export const getTranscript = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query('agentThreads')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();
    if (!thread) return null;

    const recent = await ctx.db
      .query('agentMessages')
      .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
      .order('desc')
      .take(MAX_HISTORY_TURNS * 2);
    return recent.reverse().map((m) => ({
      role: m.role,
      content: m.display ?? m.content,
      citations: m.citations ?? [],
    }));
  },
});

// ---------------------------------------------------------------------------
// Rate limiting — fixed window per key (client IP, falling back to thread
// token). Persistent, unlike the VPS's in-memory buckets that reset on every
// container restart.
// ---------------------------------------------------------------------------

/**
 * Resolved per-call so `npx convex env set` changes apply immediately.
 * Non-numeric env values fall back to the defaults (fail closed) — a NaN
 * here would make every `count >= max` comparison false and silently turn
 * the rate limiter off.
 */
function rateLimitConfig() {
  const max = Number(process.env.RATE_LIMIT_MAX ?? 10);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  return {
    max: Number.isFinite(max) && max > 0 ? max : 10,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
  };
}

export const checkRateLimit = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { max, windowMs } = rateLimitConfig();
    const now = Date.now();

    const bucket = await ctx.db
      .query('agentRateLimits')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique();

    if (!bucket || bucket.windowStart + windowMs < now) {
      if (bucket) {
        await ctx.db.patch('agentRateLimits', bucket._id, {
          windowStart: now,
          count: 1,
        });
      } else {
        await ctx.db.insert('agentRateLimits', {
          key: args.key,
          windowStart: now,
          count: 1,
        });
      }
      return { ok: true as const };
    }

    if (bucket.count >= max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.windowStart + windowMs - now) / 1000),
      );
      return { ok: false as const, retryAfterSeconds };
    }

    await ctx.db.patch('agentRateLimits', bucket._id, {
      count: bucket.count + 1,
    });
    return { ok: true as const };
  },
});

// ---------------------------------------------------------------------------
// Retention — purge idle threads (and stale rate-limit rows) in batches,
// rescheduling itself until a pass comes up empty.
// ---------------------------------------------------------------------------

const PURGE_THREAD_BATCH = 25;
const PURGE_MESSAGE_BATCH = 200;

export const purgeIdle = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THREAD_RETENTION_MS;

    const stale = await ctx.db
      .query('agentThreads')
      .withIndex('by_last_active', (q) => q.lt('lastActiveAt', cutoff))
      .take(PURGE_THREAD_BATCH);

    for (const thread of stale) {
      // Delete this thread's messages in bounded chunks. If a thread has
      // more than PURGE_MESSAGE_BATCH messages we leave the thread row for
      // the next pass, which picks up where this one stopped.
      const messages = await ctx.db
        .query('agentMessages')
        .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
        .take(PURGE_MESSAGE_BATCH);
      for (const m of messages) {
        await ctx.db.delete('agentMessages', m._id);
      }
      if (messages.length < PURGE_MESSAGE_BATCH) {
        await ctx.db.delete('agentThreads', thread._id);
      }
    }

    // Sweep rate-limit buckets whose window ended long ago, oldest-first via
    // the index so a burst of distinct keys can't outrun the purge.
    const bucketCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const staleBuckets = await ctx.db
      .query('agentRateLimits')
      .withIndex('by_window_start', (q) => q.lt('windowStart', bucketCutoff))
      .take(PURGE_MESSAGE_BATCH);
    for (const b of staleBuckets) {
      await ctx.db.delete('agentRateLimits', b._id);
    }

    // More stale threads or buckets may remain — continue in a fresh txn.
    if (
      stale.length === PURGE_THREAD_BATCH ||
      staleBuckets.length === PURGE_MESSAGE_BATCH
    ) {
      await ctx.scheduler.runAfter(0, internal.agent.threads.purgeIdle, {});
    }
    return null;
  },
});
