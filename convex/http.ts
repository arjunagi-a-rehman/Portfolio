import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

// Fallback one-click unsubscribe endpoint.
//
// Normally the email's unsubscribe link points at the Astro page at
// /unsubscribe?token=... which handles it via React. But Gmail's
// "List-Unsubscribe: <URL>" header uses this endpoint directly (they ping
// it without a browser), and mail clients with JS disabled fall back here
// too. Returns a self-contained HTML page so either flow produces a clean
// confirmation.
http.route({
  path: '/unsubscribe',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const result = await ctx.runMutation(
      internal.subscribers._unsubscribeInternal,
      { token }
    );

    const title = result.ok ? 'Unsubscribed' : 'Invalid link';
    const message = result.ok
      ? result.alreadyUnsubscribed
        ? "You're already unsubscribed. Nothing more to do."
        : "You've been unsubscribed. You won't receive further emails."
      : 'This unsubscribe link is invalid or has expired.';

    const html = `<!doctype html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Arjunagi A. Rehman</title>
  <style>
    body { font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;
      background:#040912; color:#dde5f4; margin:0; padding:80px 20px;
      text-align:center; min-height:100vh; box-sizing:border-box; }
    .card { max-width:480px; margin:0 auto; background:#0a1424;
      border:1px solid rgba(0,229,255,0.35); border-radius:12px;
      padding:36px 32px; }
    h1 { margin:0 0 12px; font-size:22px; color:#00e5ff; letter-spacing:0.02em; }
    p  { color:#96a8bf; line-height:1.6; font-size:15px; margin:0 0 20px; }
    a  { color:#00e5ff; text-decoration:none; font-size:14px;
      font-family:monospace; letter-spacing:0.04em; }
    a:hover { text-decoration:underline; }
  </style>
</head><body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://arjunagiarehman.com/blogs">← Back to the blog</a>
  </div>
</body></html>`;

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }),
});

// Convex HTTP routers treat POST /unsubscribe the same way for List-Unsubscribe-Post:
// Gmail sends an empty POST when the user clicks the inbox-level button.
http.route({
  path: '/unsubscribe',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    await ctx.runMutation(internal.subscribers._unsubscribeInternal, { token });
    // Gmail expects a 2xx; body is ignored.
    return new Response('ok', { status: 200 });
  }),
});

export default http;
