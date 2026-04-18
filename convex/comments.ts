import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const MAX_NAME = 40;
const MAX_BODY = 2000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;
const EMAIL_HASH_RE = /^[a-f0-9]{32}$/;

export const list = query({
  args: { postSlug: v.string() },
  handler: async (ctx, { postSlug }) => {
    const rows = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postSlug', postSlug))
      .order('desc')
      .take(200);
    // Strip clientId before returning to other readers
    return rows.map(({ clientId: _c, ...pub }) => pub);
  },
});

export const add = mutation({
  args: {
    postSlug: v.string(),
    authorName: v.string(),
    emailHash: v.optional(v.string()),
    body: v.string(),
    clientId: v.string(),
    honeypot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.honeypot && args.honeypot.length > 0) {
      return { ok: false, reason: 'spam' as const };
    }

    const name = args.authorName.trim().slice(0, MAX_NAME);
    const body = args.body.trim().slice(0, MAX_BODY);
    if (!name || !body) {
      return { ok: false, reason: 'empty' as const };
    }

    let emailHash: string | undefined;
    if (args.emailHash) {
      const candidate = args.emailHash.trim().toLowerCase();
      if (EMAIL_HASH_RE.test(candidate)) {
        emailHash = candidate;
      }
      // silently drop malformed hashes — avatar just won't render
    }

    const since = Date.now() - RATE_WINDOW_MS;
    const recent = await ctx.db
      .query('comments')
      .withIndex('by_client_recent', (q) =>
        q.eq('clientId', args.clientId).gt('createdAt', since),
      )
      .collect();
    if (recent.length >= RATE_MAX) {
      return { ok: false, reason: 'rate_limited' as const };
    }

    await ctx.db.insert('comments', {
      postSlug: args.postSlug,
      authorName: name,
      emailHash,
      body,
      clientId: args.clientId,
      createdAt: Date.now(),
    });

    return { ok: true as const };
  },
});
