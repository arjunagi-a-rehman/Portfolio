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
