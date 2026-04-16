import {
  mutation,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

const MAX_EMAIL = 254; // RFC 5321
const RATE_WINDOW_MS = 60 * 60_000; // 1 hour
const RATE_MAX = 3;

// Same loose format check used by contact.ts — catches typos, not every RFC
// edge case. Real delivery validation happens when Brevo tries to send.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 32 hex chars of unguessable randomness for the unsubscribe link.
function generateUnsubscribeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const subscribe = mutation({
  args: {
    email: v.string(),
    clientId: v.string(),
    honeypot: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.honeypot && args.honeypot.length > 0) {
      return { ok: false, reason: 'spam' as const };
    }

    const email = args.email.trim().toLowerCase().slice(0, MAX_EMAIL);
    if (!EMAIL_RE.test(email)) {
      return { ok: false, reason: 'bad_email' as const };
    }

    // Rate limit by clientId. clientId is forgeable, so this is hygiene, not
    // security — genuinely malicious clients will need higher walls.
    const since = Date.now() - RATE_WINDOW_MS;
    const recent = await ctx.db
      .query('subscribers')
      .withIndex('by_client_recent', (q) =>
        q.eq('clientId', args.clientId).gt('subscribedAt', since)
      )
      .collect();
    if (recent.length >= RATE_MAX) {
      return { ok: false, reason: 'rate_limited' as const };
    }

    // Dedup by normalized email.
    const existing = await ctx.db
      .query('subscribers')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    if (existing) {
      if (existing.unsubscribedAt === undefined) {
        // Already active — idempotent no-op. No welcome email resend (they
        // already got one when they first subscribed).
        return { ok: true as const };
      }
      // Resubscribe. Clear the tombstone, refresh subscribedAt, keep the token
      // so any old email link still works.
      await ctx.db.patch(existing._id, {
        unsubscribedAt: undefined,
        subscribedAt: Date.now(),
        source: args.source ?? existing.source,
      });
      // Welcome them back — they explicitly chose to come back, so a
      // confirmation email is respectful rather than noisy.
      await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
        email,
        unsubscribeToken: existing.unsubscribeToken,
      });
      return { ok: true as const, resubscribed: true };
    }

    const token = generateUnsubscribeToken();
    await ctx.db.insert('subscribers', {
      email,
      clientId: args.clientId,
      subscribedAt: Date.now(),
      unsubscribeToken: token,
      source: args.source,
    });
    // Fire-and-forget welcome. If SMTP flakes, the subscription still stands.
    await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
      email,
      unsubscribeToken: token,
    });
    return { ok: true as const };
  },
});

export const unsubscribe = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query('subscribers')
      .withIndex('by_unsubscribe_token', (q) => q.eq('unsubscribeToken', token))
      .unique();
    if (!row) {
      return { ok: false as const };
    }
    if (row.unsubscribedAt !== undefined) {
      return { ok: true as const, alreadyUnsubscribed: true };
    }
    await ctx.db.patch(row._id, { unsubscribedAt: Date.now() });
    return { ok: true as const };
  },
});

// ───── Internal helpers used by the notifier action and /unsubscribe HTTP handler.

export const _unsubscribeInternal = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query('subscribers')
      .withIndex('by_unsubscribe_token', (q) => q.eq('unsubscribeToken', token))
      .unique();
    if (!row) return { ok: false as const };
    if (row.unsubscribedAt !== undefined) {
      return { ok: true as const, alreadyUnsubscribed: true };
    }
    await ctx.db.patch(row._id, { unsubscribedAt: Date.now() });
    return { ok: true as const };
  },
});

export const _listActiveSubscribers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // by_active index is [unsubscribedAt]. A row without unsubscribedAt has
    // the field undefined; Convex indexes treat that as `null`-ish, so the
    // most portable filter is a full scan with a JS filter at this scale.
    const rows = await ctx.db.query('subscribers').collect();
    return rows
      .filter((r) => r.unsubscribedAt === undefined)
      .map((r) => ({
        email: r.email,
        unsubscribeToken: r.unsubscribeToken,
      }));
  },
});
