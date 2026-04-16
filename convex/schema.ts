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
});
