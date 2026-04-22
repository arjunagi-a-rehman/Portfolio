---
id: portfolio
title: "This Portfolio — Astro 6 + Convex + Open-Source AI Agent"
source: project
url: https://github.com/arjunagi-a-rehman/Portfolio
date: "2026-04-19"
tags:
  - portfolio
  - astro
  - react
  - convex
  - open-source
  - mcp
  - ai-agents
  - nodemailer
  - brevo
summary: "The site you're on, fully open-source. Astro 6 + React 19 islands for the static surface, Convex as the real-time backend for comments/likes/contact/newsletter, Brevo SMTP via Nodemailer for email, and a Bun-based MCP server running the AI agent you're talking to right now."
---

## What it is

arjunagiarehman.com — my portfolio, blog, and public AI persona. Mostly static, React islands where interactivity matters, Convex for the real-time bits, and an MCP server powering the agent at `/agent`. Full source on GitHub at `arjunagi-a-rehman/Portfolio`.

I open-sourced it because the best way to attract builders is to show the actual code, not a polished demo.

## Stack

| Layer | Tech |
| --- | --- |
| Site | Astro 6 + React 19 islands (client:load, client:idle) |
| Backend | Convex — real-time DB + serverless functions |
| Email | Brevo SMTP via Nodemailer |
| Styling | Hand-rolled CSS, no Tailwind, no UI kit |
| Hosting | Any static CDN + Convex cloud |
| AI Agent | Bun + Hono + @modelcontextprotocol/sdk + Anthropic Claude (Haiku router, Sonnet responder) |

Node >= 22. Bun for the MCP subproject. Biome for lint. Vitest for tests.

## Convex powers the interactive bits

- **Comments** — per-post threads with rate limiting, optimistic UI
- **Likes** — per-post counters, per-client state stored separately to avoid bundled reads
- **Contact** — intake form → Convex → email to me via Brevo
- **Newsletter** — subscribe / unsubscribe flow with HTTP callback for email links
- **Post announce fanout** — manual-trigger internal action that emails new-post alerts to all subscribers

Schema, mutations, and queries all in `convex/`. Real-time reactivity means the like count updates across all open tabs the instant someone taps.

## The AI agent

`/agent` route — ask me anything, get cited answers grounded in markdown nodes that mirror my actual projects and essays. SSE streaming. Conversation memory. Filler detection (typing "ok" with no history gets "yeah? go ahead", not a wall of text). Two-LLM pipeline: Haiku routes to relevant nodes, Sonnet composes the cited answer. Phantom-citation stripping on the way out.

Also exposed as `/mcp` (Streamable HTTP, spec 2025-03-26) so external MCP clients — Claude Desktop, Cursor, mcp-inspector — can ask me questions programmatically via the `ask_rehman` and `list_nodes` tools.

## Why this architecture

Astro because most of the site is static — a blog post shouldn't pay the cost of a JS framework on first paint. React islands because contact modals and like buttons need real interactivity. Convex because I didn't want to run a database or a queue or an auth stack — one backend-as-a-service that I trust for the bits that matter.

The MCP server is a separate subproject with its own package.json, tests, and deploy. Keeps the portfolio's static build fast and the agent's deploy cycle independent.

## What I learned

Astro islands are the best mental model for portfolio sites. Static by default, interactive by opt-in. No per-page JS cost unless you ask for it.

Convex killed 80% of my backend boilerplate for this stack. Schema, queries, mutations, cron — all one codebase, typesafe end-to-end, no REST wiring.

Open-sourcing forces discipline. Every commit is public; every architectural decision is readable. That pressure alone improved the codebase more than any linter.
