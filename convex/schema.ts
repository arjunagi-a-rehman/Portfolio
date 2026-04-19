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
