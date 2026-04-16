'use node';

import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import nodemailer from 'nodemailer';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Convex env var: ${name}`);
  return value;
}

// Lightweight HTML escape — we insert user-submitted name/email/message into
// the HTML email template, so escape the five hostile characters.
function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function thankYouHtml(name: string, message: string): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0a1424;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4ebf5;border-radius:10px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#00e5ff 0%,#1565ff 100%);padding:28px 32px;color:#040912;">
      <h1 style="margin:0;font-size:20px;letter-spacing:0.02em;">Thanks for reaching out!</h1>
    </div>
    <div style="padding:28px 32px;line-height:1.6;font-size:15px;">
      <p>Hi ${esc(name)},</p>
      <p>Thanks for getting in touch — I've received your message and will reply as soon as I can.</p>
      <p style="margin-top:20px;color:#6b7a8f;font-size:13px;">Here's a copy of what you sent:</p>
      <blockquote style="border-left:3px solid #00e5ff;margin:12px 0 20px;padding:10px 14px;color:#3b4a60;background:#f0f6fc;white-space:pre-wrap;">${esc(message)}</blockquote>
      <p>— Arjunagi A. Rehman<br/><a href="https://arjunagiarehman.com" style="color:#1565ff;">arjunagiarehman.com</a></p>
    </div>
  </div>
</body></html>`;
}

function thankYouText(name: string, message: string): string {
  return `Hi ${name},

Thanks for getting in touch — I've received your message and will reply as soon as I can.

Here's a copy of what you sent:
"""
${message}
"""

— Arjunagi A. Rehman
https://arjunagiarehman.com
`;
}

function notificationHtml(
  name: string,
  email: string,
  message: string,
  createdAt: number
): string {
  const when = new Date(createdAt).toISOString();
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0a1424;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4ebf5;border-radius:10px;overflow:hidden;">
    <div style="background:#0a1424;color:#00e5ff;padding:20px 28px;">
      <h1 style="margin:0;font-size:16px;letter-spacing:0.04em;font-family:monospace;">NEW CONTACT SUBMISSION</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:10px 28px;color:#6b7a8f;width:90px;">Name</td><td style="padding:10px 28px;"><strong>${esc(name)}</strong></td></tr>
      <tr style="background:#f6f8fb;"><td style="padding:10px 28px;color:#6b7a8f;">Email</td><td style="padding:10px 28px;"><a href="mailto:${esc(email)}" style="color:#1565ff;">${esc(email)}</a></td></tr>
      <tr><td style="padding:10px 28px;color:#6b7a8f;">At</td><td style="padding:10px 28px;font-family:monospace;font-size:12px;">${esc(when)}</td></tr>
    </table>
    <div style="padding:20px 28px;border-top:1px solid #e4ebf5;">
      <div style="color:#6b7a8f;font-size:12px;margin-bottom:8px;">Message</div>
      <div style="white-space:pre-wrap;background:#f0f6fc;border-left:3px solid #00e5ff;padding:12px 14px;line-height:1.6;">${esc(message)}</div>
    </div>
  </div>
</body></html>`;
}

function notificationText(
  name: string,
  email: string,
  message: string,
  createdAt: number
): string {
  return `NEW CONTACT SUBMISSION

Name:    ${name}
Email:   ${email}
At:      ${new Date(createdAt).toISOString()}

Message:
${message}
`;
}

export const sendContactEmails = internalAction({
  args: { submissionId: v.id('contactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    const submission = await ctx.runQuery(internal.contact._getSubmission, {
      submissionId,
    });
    if (!submission) {
      console.error('[emails] submission not found', submissionId);
      return;
    }

    const host = requireEnv('BREVO_SMTP_HOST');
    const port = Number(requireEnv('BREVO_SMTP_PORT'));
    const user = requireEnv('BREVO_SMTP_USER');
    const pass = requireEnv('BREVO_SMTP_PASS');
    const from = requireEnv('CONTACT_FROM');
    const notifyTo = requireEnv('CONTACT_NOTIFY_TO')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const transporter = nodemailer.createTransport({
      host,
      port,
      // 587 = STARTTLS. secure:false lets nodemailer upgrade the connection.
      secure: port === 465,
      auth: { user, pass },
    });

    const { name, email, message, createdAt } = submission;

    let thankYouSent = false;
    let notificationSent = false;
    const errors: string[] = [];

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: "Thanks for reaching out — I'll be in touch",
        text: thankYouText(name, message),
        html: thankYouHtml(name, message),
      });
      thankYouSent = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`thankYou: ${msg}`);
      console.error('[emails] thank-you failed', msg);
    }

    try {
      await transporter.sendMail({
        from,
        to: notifyTo,
        replyTo: `${name} <${email}>`,
        subject: `New contact: ${name}`,
        text: notificationText(name, email, message, createdAt),
        html: notificationHtml(name, email, message, createdAt),
      });
      notificationSent = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`notification: ${msg}`);
      console.error('[emails] notification failed', msg);
    }

    await ctx.runMutation(internal.contact._markSent, {
      submissionId,
      thankYouSent,
      notificationSent,
      emailError: errors.length ? errors.join(' | ') : undefined,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// New-post announcement emails (blog subscriptions)
// ═══════════════════════════════════════════════════════════════════════════

type NewPostMeta = {
  slug: string;          // "/cli-to-ai"
  title: string;
  excerpt: string;
  readTime: string;
  series: string;
  part: number | null;
};

function newPostHtml(
  post: NewPostMeta,
  unsubscribeToken: string,
  siteUrl: string,
  customMessage?: string
): string {
  const postUrl = `${siteUrl}${post.slug}`;
  const unsubUrl = `${siteUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const meta = post.part !== null
    ? `${esc(post.series)} · Part ${post.part} · ${esc(post.readTime)} read`
    : `${esc(post.series)} · ${esc(post.readTime)} read`;

  const customBlock = customMessage
    ? `<p style="margin:0 0 18px;color:#3b4a60;font-style:italic;line-height:1.6;">${esc(customMessage)}</p>`
    : '';

  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0a1424;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4ebf5;border-radius:10px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#00e5ff 0%,#1565ff 100%);padding:22px 32px;color:#040912;">
      <div style="font-family:monospace;font-size:11px;letter-spacing:0.08em;opacity:0.75;">NEW POST</div>
      <h1 style="margin:6px 0 0;font-size:20px;letter-spacing:0.02em;">New from Arjunagi</h1>
    </div>
    <div style="padding:28px 32px;line-height:1.6;font-size:15px;">
      ${customBlock}
      <h2 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0a1424;">${esc(post.title)}</h2>
      <div style="font-family:monospace;font-size:12px;color:#6b7a8f;margin-bottom:16px;">${meta}</div>
      <blockquote style="border-left:3px solid #00e5ff;margin:0 0 22px;padding:10px 14px;color:#3b4a60;background:#f0f6fc;">
        ${esc(post.excerpt)}
      </blockquote>
      <p style="margin:0 0 26px;">
        <a href="${postUrl}" style="display:inline-block;background:#1565ff;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.03em;">Read the post →</a>
      </p>
      <p style="margin:0;">— Arjunagi A. Rehman<br/><a href="${siteUrl}" style="color:#1565ff;">arjunagiarehman.com</a></p>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #e4ebf5;font-size:11px;color:#6b7a8f;line-height:1.6;">
      You're receiving this because you subscribed at arjunagiarehman.com.<br/>
      <a href="${unsubUrl}" style="color:#6b7a8f;text-decoration:underline;">Unsubscribe</a>
    </div>
  </div>
</body></html>`;
}

function newPostText(
  post: NewPostMeta,
  unsubscribeToken: string,
  siteUrl: string,
  customMessage?: string
): string {
  const postUrl = `${siteUrl}${post.slug}`;
  const unsubUrl = `${siteUrl}/unsubscribe?token=${unsubscribeToken}`;
  const meta = post.part !== null
    ? `${post.series} · Part ${post.part} · ${post.readTime} read`
    : `${post.series} · ${post.readTime} read`;
  const preface = customMessage ? `${customMessage}\n\n` : '';

  return `${preface}${post.title}
${meta}

${post.excerpt}

Read the post: ${postUrl}

— Arjunagi A. Rehman
${siteUrl}

---
You're receiving this because you subscribed at arjunagiarehman.com.
Unsubscribe: ${unsubUrl}
`;
}

export const sendNewPostNotifications = internalAction({
  args: {
    postSlug: v.string(),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, { postSlug, customMessage }) => {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      console.error('[emails] SITE_URL not set; cannot send new-post emails');
      await ctx.runMutation(internal.notifier._markPostNotified, {
        postSlug,
        recipientCount: 0,
        errorCount: 0,
      });
      return;
    }

    // Re-fetch the catalog so the email template always uses what's live on
    // the site at send time.
    let post: NewPostMeta | undefined;
    try {
      const resp = await fetch(`${siteUrl}/blogs.json`);
      if (!resp.ok) throw new Error(`blogs.json ${resp.status}`);
      const data = (await resp.json()) as { posts: NewPostMeta[] };
      post = data.posts.find((p) => p.slug === postSlug);
    } catch (err) {
      console.error('[emails] could not fetch blogs.json for', postSlug, err);
    }

    if (!post) {
      console.error('[emails] post not found in blogs.json', postSlug);
      await ctx.runMutation(internal.notifier._markPostNotified, {
        postSlug,
        recipientCount: 0,
        errorCount: 0,
      });
      return;
    }

    const subs = await ctx.runQuery(internal.subscribers._listActiveSubscribers, {});

    const host = requireEnv('BREVO_SMTP_HOST');
    const port = Number(requireEnv('BREVO_SMTP_PORT'));
    const user = requireEnv('BREVO_SMTP_USER');
    const pass = requireEnv('BREVO_SMTP_PASS');
    const from = process.env.NEWSLETTER_FROM ?? requireEnv('CONTACT_FROM');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const subject = `New post: ${post.title}`;
    let sent = 0;
    let errors = 0;

    // Serial loop — avoids spawning N parallel SMTP connections and getting
    // throttled by Brevo. ~300 ms per send; 100 subs ≈ 30 s.
    for (const sub of subs) {
      try {
        const unsubUrl = `${siteUrl}/unsubscribe?token=${sub.unsubscribeToken}`;
        await transporter.sendMail({
          from,
          to: sub.email,
          subject,
          text: newPostText(post, sub.unsubscribeToken, siteUrl, customMessage),
          html: newPostHtml(post, sub.unsubscribeToken, siteUrl, customMessage),
          headers: {
            // Native inbox-level unsubscribe button (Gmail/Apple Mail).
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        sent++;
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[emails] newPost send failed for ${sub.email}:`, msg);
      }
    }

    await ctx.runMutation(internal.notifier._markPostNotified, {
      postSlug,
      recipientCount: sent,
      errorCount: errors,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Welcome email sent once when a visitor subscribes (or re-subscribes after
// an unsubscribe). Scheduled from subscribers.subscribe.
// ═══════════════════════════════════════════════════════════════════════════

function welcomeHtml(unsubscribeToken: string, siteUrl: string): string {
  const unsubUrl = `${siteUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#0a1424;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4ebf5;border-radius:10px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#00e5ff 0%,#1565ff 100%);padding:28px 32px;color:#040912;">
      <h1 style="margin:0;font-size:20px;letter-spacing:0.02em;">You're subscribed</h1>
    </div>
    <div style="padding:28px 32px;line-height:1.6;font-size:15px;">
      <p>Hey,</p>
      <p>Thanks for subscribing to the blog. Here's what to expect:</p>
      <ul style="padding-left:20px;color:#3b4a60;">
        <li style="margin:6px 0;">One email whenever a new post goes live.</li>
        <li style="margin:6px 0;">No weekly newsletter. No promos. Just new writing.</li>
        <li style="margin:6px 0;">One-click unsubscribe in every email — including this one.</li>
      </ul>
      <p style="margin:24px 0 0;">
        <a href="${siteUrl}/blogs" style="display:inline-block;background:#1565ff;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.03em;">Browse the blog →</a>
      </p>
      <p style="margin:24px 0 0;">— Arjunagi A. Rehman<br/><a href="${siteUrl}" style="color:#1565ff;">arjunagiarehman.com</a></p>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #e4ebf5;font-size:11px;color:#6b7a8f;line-height:1.6;">
      You're receiving this because you just subscribed at arjunagiarehman.com.<br/>
      Changed your mind? <a href="${unsubUrl}" style="color:#6b7a8f;text-decoration:underline;">Unsubscribe</a>.
    </div>
  </div>
</body></html>`;
}

function welcomeText(unsubscribeToken: string, siteUrl: string): string {
  const unsubUrl = `${siteUrl}/unsubscribe?token=${unsubscribeToken}`;
  return `Hey,

Thanks for subscribing to the blog. Here's what to expect:

  • One email whenever a new post goes live.
  • No weekly newsletter. No promos. Just new writing.
  • One-click unsubscribe in every email — including this one.

Browse the blog: ${siteUrl}/blogs

— Arjunagi A. Rehman
${siteUrl}

---
You're receiving this because you just subscribed at arjunagiarehman.com.
Unsubscribe: ${unsubUrl}
`;
}

export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    unsubscribeToken: v.string(),
  },
  handler: async (_ctx, { email, unsubscribeToken }) => {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      console.error('[emails] SITE_URL not set; welcome email skipped');
      return;
    }

    const host = requireEnv('BREVO_SMTP_HOST');
    const port = Number(requireEnv('BREVO_SMTP_PORT'));
    const user = requireEnv('BREVO_SMTP_USER');
    const pass = requireEnv('BREVO_SMTP_PASS');
    const from = process.env.NEWSLETTER_FROM ?? requireEnv('CONTACT_FROM');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const unsubUrl = `${siteUrl}/unsubscribe?token=${unsubscribeToken}`;

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: "Thanks for subscribing — you're in",
        text: welcomeText(unsubscribeToken, siteUrl),
        html: welcomeHtml(unsubscribeToken, siteUrl),
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[emails] welcome email failed for ${email}:`, msg);
      // Non-fatal. The subscription row is already persisted — missing a
      // welcome email doesn't lose the subscriber.
    }
  },
});
