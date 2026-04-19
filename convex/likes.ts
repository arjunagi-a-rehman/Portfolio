import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Public per-post like count. Keyed only on postSlug so it can render
// immediately on mount, before the browser-only clientId is available.
export const getCount = query({
  args: { postSlug: v.string() },
  handler: async (ctx, { postSlug }) => {
    const counter = await ctx.db
      .query('likeCounts')
      .withIndex('by_post', (q) => q.eq('postSlug', postSlug))
      .unique();
    return { count: counter?.count ?? 0 };
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

    const counter = await ctx.db
      .query('likeCounts')
      .withIndex('by_post', (q) => q.eq('postSlug', postSlug))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      if (counter) {
        await ctx.db.patch(counter._id, {
          count: Math.max(0, counter.count - 1),
        });
      }
      return { liked: false, count: Math.max(0, (counter?.count ?? 1) - 1) };
    }

    await ctx.db.insert('likes', {
      postSlug,
      clientId,
      createdAt: Date.now(),
    });

    if (counter) {
      await ctx.db.patch(counter._id, { count: counter.count + 1 });
      return { liked: true, count: counter.count + 1 };
    }

    await ctx.db.insert('likeCounts', { postSlug, count: 1 });
    return { liked: true, count: 1 };
  },
});
