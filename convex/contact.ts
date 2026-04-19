import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation } from './_generated/server';

const MAX_NAME = 80;
const MAX_EMAIL = 254; // RFC 5321
const MAX_MESSAGE = 5000;

// Rate limit: 1 submission per 5 minutes per clientId. Prevents accidental
// double-submits and trivial spam-bot floods. Not security (clientId is forgeable).
const RATE_WINDOW_MS = 5 * 60_000;
const RATE_MAX = 1;

// Basic email sanity check — not a full RFC validator, just enough to catch
// typos. Real delivery validation happens when Brevo tries to send.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    clientId: v.string(),
    honeypot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.honeypot && args.honeypot.length > 0) {
      return { ok: false, reason: 'spam' as const };
    }

    const name = args.name.trim().slice(0, MAX_NAME);
    const email = args.email.trim().slice(0, MAX_EMAIL);
    const message = args.message.trim().slice(0, MAX_MESSAGE);

    if (!name || !message) {
      return { ok: false, reason: 'empty' as const };
    }
    if (!EMAIL_RE.test(email)) {
      return { ok: false, reason: 'bad_email' as const };
    }

    const since = Date.now() - RATE_WINDOW_MS;
    const recent = await ctx.db
      .query('contactSubmissions')
      .withIndex('by_client_recent', (q) =>
        q.eq('clientId', args.clientId).gt('createdAt', since),
      )
      .collect();
    if (recent.length >= RATE_MAX) {
      return { ok: false, reason: 'rate_limited' as const };
    }

    const submissionId = await ctx.db.insert('contactSubmissions', {
      name,
      email,
      message,
      clientId: args.clientId,
      createdAt: Date.now(),
    });

    // Fire-and-forget the email delivery in a Node action. If SMTP fails, the
    // submission row is still stored — we just patch it with the error.
    await ctx.scheduler.runAfter(0, internal.emails.sendContactEmails, {
      submissionId,
    });

    return { ok: true as const };
  },
});

// Internal helpers invoked from the Node action in convex/emails.ts.
// They live here (default runtime) because the action file uses "use node"
// which cannot define queries/mutations that touch the DB directly.

export const _getSubmission = internalQuery({
  args: { submissionId: v.id('contactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    return await ctx.db.get(submissionId);
  },
});

export const _markSent = internalMutation({
  args: {
    submissionId: v.id('contactSubmissions'),
    thankYouSent: v.boolean(),
    notificationSent: v.boolean(),
    emailError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.submissionId, {
      thankYouSent: args.thankYouSent,
      notificationSent: args.notificationSent,
      emailError: args.emailError,
    });
  },
});
