import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Public per-post like count.
//
// Derived directly from the `likes` table via the `by_post` index, not from
// a parallel `likeCounts` counter row. The counter was a denormalized
// cache that introduced a race: two concurrent first-likes for the same
// post could each read "no counter row exists" and then both insert one,
// leaving two rows for one slug. Later reads via .unique() would then
// throw permanently until manual DB surgery.
//
// Counting on the fly is O(K) where K is the number of likes for the post,
// which for a portfolio blog is dozens at most and stays well under
// Convex's per-query read limits. It removes the race entirely because the
// `likes` table is now the single source of truth.
//
// The legacy `likeCounts` table remains defined in schema.ts so the
// existing rows don't fail validation on the next schema push; a follow-up
// will drop both the rows and the table definition. See schema.ts.
export const getCount = query({
  args: { postSlug: v.string() },
  handler: async (ctx, { postSlug }) => {
    const rows = await ctx.db
      .query('likes')
      .withIndex('by_post', (q) => q.eq('postSlug', postSlug))
      .collect();
    return { count: rows.length };
  },
});

// "Did THIS client like this post?" Requires the per-browser clientId,
// so the caller must wait until it's loaded from localStorage before running this.
export const getMyLikeState = query({
  args: { postSlug: v.string(), clientId: v.string() },
  handler: async (ctx, { postSlug, clientId }) => {
    const mine = await ctx.db
      .query('likes')
      .withIndex('by_post_and_client', (q) =>
        q.eq('postSlug', postSlug).eq('clientId', clientId),
      )
      .unique();
    return { liked: mine !== null };
  },
});

export const toggle = mutation({
  args: { postSlug: v.string(), clientId: v.string() },
  handler: async (ctx, { postSlug, clientId }) => {
    const existing = await ctx.db
      .query('likes')
      .withIndex('by_post_and_client', (q) =>
        q.eq('postSlug', postSlug).eq('clientId', clientId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false };
    }

    await ctx.db.insert('likes', {
      postSlug,
      clientId,
      createdAt: Date.now(),
    });
    return { liked: true };
  },
});
