import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation } from './_generated/server';

// Fetches the site's blogs.json, guards idempotency via notifiedPosts, and
// schedules the email fanout action.
//
// SECURITY: this is an internalAction, not a public action. Making it public
// would let anyone with the Convex deployment URL (exposed in every browser
// via PUBLIC_CONVEX_URL) trigger a mass email fanout to every subscriber,
// with attacker-controlled customMessage content. The idempotency guard on
// notifiedPosts only prevents repeats per slug — it does not gate who can
// fire the first announcement for a new slug. Keep this internal.
//
// npx convex run has deployer-level credentials and can invoke internal
// functions directly, so the author's workflow is unchanged:
//   npx convex run notifier:announce '{"slug":"/your-new-slug"}'
//   npx convex run notifier:announce '{"slug":"/your-new-slug","customMessage":"intro"}'
//
// Uses the default Convex runtime (not Node) — fetch is built in, and the
// heavy-lifting SMTP work lives in emails.ts which is Node-scoped.
export const announce = internalAction({
  args: {
    slug: v.string(),
    customMessage: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { slug, customMessage },
  ): Promise<
    | { ok: true; skipped: false; scheduled: true; slug: string }
    | { ok: true; skipped: true; reason: 'already-sent'; slug: string }
    | { ok: false; reason: 'not-found' | 'fetch-failed' | 'missing-site-url' }
  > => {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      return { ok: false as const, reason: 'missing-site-url' as const };
    }

    // Canonicalize the slug: accept "cli-to-ai", "/cli-to-ai", or "//cli-to-ai"
    // and normalize them all to exactly one leading slash. blogs.json entries
    // always start with a single slash (see src/data/posts.ts).
    const canonicalSlug = `/${slug.trim().replace(/^\/+/, '')}`;

    // Fetch the catalog from the deployed site so the email template uses the
    // same post metadata that readers see on the site.
    let catalog: { posts: Array<{ slug: string; title: string }> };
    try {
      const resp = await fetch(`${siteUrl}/blogs.json`, {
        cache: 'no-cache' as RequestCache,
      });
      if (!resp.ok) {
        console.error('[notifier] blogs.json fetch failed', resp.status);
        return { ok: false as const, reason: 'fetch-failed' as const };
      }
      catalog = (await resp.json()) as typeof catalog;
    } catch (err) {
      console.error('[notifier] blogs.json fetch threw', err);
      return { ok: false as const, reason: 'fetch-failed' as const };
    }

    const post = catalog.posts.find((p) => p.slug === canonicalSlug);
    if (!post) {
      return { ok: false as const, reason: 'not-found' as const };
    }

    // Atomic claim — first caller wins. If the row exists, we skip.
    const claim = await ctx.runMutation(internal.notifier._claimPost, {
      slug: canonicalSlug,
    });
    if (!claim.inserted) {
      return {
        ok: true as const,
        skipped: true as const,
        reason: 'already-sent' as const,
        slug: canonicalSlug,
      };
    }

    // Schedule the SMTP fanout. Runs in the Node action at emails.ts.
    await ctx.scheduler.runAfter(0, internal.emails.sendNewPostNotifications, {
      postSlug: canonicalSlug,
      customMessage,
    });

    return {
      ok: true as const,
      skipped: false as const,
      scheduled: true as const,
      slug: canonicalSlug,
    };
  },
});

// ───── Internal helpers

export const _claimPost = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const existing = await ctx.db
      .query('notifiedPosts')
      .withIndex('by_slug', (q) => q.eq('postSlug', slug))
      .unique();
    if (existing) {
      return { inserted: false as const };
    }
    await ctx.db.insert('notifiedPosts', {
      postSlug: slug,
      firstSeenAt: Date.now(),
    });
    return { inserted: true as const };
  },
});

export const _markPostNotified = internalMutation({
  args: {
    postSlug: v.string(),
    recipientCount: v.number(),
    errorCount: v.number(),
  },
  handler: async (ctx, { postSlug, recipientCount, errorCount }) => {
    const row = await ctx.db
      .query('notifiedPosts')
      .withIndex('by_slug', (q) => q.eq('postSlug', postSlug))
      .unique();
    if (!row) {
      console.error('[notifier] _markPostNotified: no row for', postSlug);
      return;
    }
    await ctx.db.patch(row._id, {
      notifiedAt: Date.now(),
      recipientCount,
      errorCount,
    });
  },
});

// One-time seeding tool. Marks existing slugs as already announced so they
// won't be blasted to subscribers if `announce` is run against them later.
// Invoke manually:
//   npx convex run notifier:_seedExistingPosts '{"slugs":["/cli-to-ai","/study-buddy","/first-ai-agent","/agent-deployment-1"]}'
export const _seedExistingPosts = internalMutation({
  args: { slugs: v.array(v.string()) },
  handler: async (ctx, { slugs }) => {
    const now = Date.now();
    let inserted = 0;
    let skipped = 0;
    for (const slug of slugs) {
      const existing = await ctx.db
        .query('notifiedPosts')
        .withIndex('by_slug', (q) => q.eq('postSlug', slug))
        .unique();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert('notifiedPosts', {
        postSlug: slug,
        firstSeenAt: now,
        notifiedAt: now,
        recipientCount: 0,
        errorCount: 0,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});
