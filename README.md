# Arjunagi A. Rehman — Portfolio

Personal portfolio and blog for **[arjunagiarehman.com](https://arjunagiarehman.com)** — a Backend & AI Systems engineer based in Bangalore. Built as a mostly-static Astro site with a Convex backend powering the interactive bits (comments, likes, contact form, newsletter).

---

## Stack

| Layer | Tech |
| ----- | ---- |
| Site  | [Astro 6](https://astro.build) + [React 19](https://react.dev) islands |
| Backend | [Convex](https://convex.dev) (real-time DB + serverless functions) |
| AI agent | [Bun](https://bun.sh) + [Hono](https://hono.dev) + [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) + [Anthropic Claude](https://docs.anthropic.com/) — lives in `mcp-server/` |
| Email | [Brevo](https://www.brevo.com/) SMTP via [Nodemailer](https://nodemailer.com) |
| Styling | Hand-rolled CSS (no Tailwind / UI kit) |
| Hosting | Static build output, any CDN; Convex cloud for the backend; MCP server on a VPS via [Dokploy](https://dokploy.com) |
| Node  | `>= 22` for the site; Bun `>= 1.x` for the MCP server |

---

## Project layout

```
portfolio/
├── astro.config.mjs       # sitemap + react integrations; site URL
├── src/
│   ├── pages/             # Astro routes — file-based routing
│   │   ├── index.astro    # Home (hero, projects, skills, featured repos)
│   │   ├── about.astro
│   │   ├── agent.astro    # AI agent chat UI — hydrated from AgentChat.tsx
│   │   ├── blogs/         # Blog listing
│   │   ├── blogs.json.ts  # Static endpoint consumed by the Convex notifier
│   │   ├── projects/      # Per-project deep-dive pages
│   │   ├── cli-to-ai.astro, study-buddy.astro, …  # Blog posts
│   │   └── unsubscribe.astro
│   ├── components/
│   │   ├── Nav.astro, Footer.astro, CircuitCanvas.astro
│   │   └── react/         # Interactive islands (client:* hydrated)
│   │       ├── ConvexProvider.tsx
│   │       ├── ContactModal.tsx       # Contact form → Convex
│   │       ├── ArticleEngagement.tsx  # Wraps LikeButton + CommentsSection
│   │       ├── LikeButton.tsx
│   │       ├── CommentsSection.tsx
│   │       ├── SubscribeCard.tsx      # Newsletter opt-in
│   │       ├── UnsubscribeView.tsx
│   │       ├── AgentChat.tsx          # AI chat UI — SSE streaming + citations
│   │       ├── AgentChat.test.tsx     # vitest + @testing-library/react
│   │       └── agent.css              # Console-style styling for /agent
│   ├── data/posts.ts      # Source of truth for the blog catalog
│   ├── layouts/Layout.astro
│   └── styles/            # Global styles
├── convex/
│   ├── schema.ts          # Tables: comments, likes, likeCounts,
│   │                      #         contactSubmissions, subscribers, notifiedPosts
│   ├── comments.ts        # Comment CRUD + rate limiting
│   ├── likes.ts           # Like toggles backed by per-post counters
│   ├── contact.ts         # Contact form intake
│   ├── subscribers.ts     # Newsletter subscribe / unsubscribe
│   ├── emails.ts          # Node-scoped SMTP senders (Brevo + Nodemailer)
│   ├── notifier.ts        # Manual-trigger new-post announce fanout
│   └── http.ts            # HTTP endpoints (e.g. unsubscribe callback)
├── public/                # favicons, OG images, robots.txt, llms.txt
├── mcp-server/            # AI agent backend (Bun + Hono + MCP SDK)
│   ├── src/
│   │   ├── server.ts      # /ask SSE endpoint + /mcp Streamable HTTP transport
│   │   ├── router.ts      # Haiku 4.5 picks relevant node IDs (JSON-validated)
│   │   ├── responder.ts   # Sonnet 4.5 composes cited answer; streaming variant
│   │   ├── fillers.ts     # Short-circuit for "ok"/"yeah"/"hmm" cold queries
│   │   ├── nodes.ts       # Loads + caches markdown nodes from nodes/
│   │   └── types.ts       # zod schemas for requests, responses, nodes
│   ├── nodes/             # Knowledge base — one markdown file per project/essay
│   ├── tests/             # Integration (ask, health, mcp-spec) + unit tests
│   ├── scripts/ingest.ts  # doctor CLI: validates frontmatter + duplicate IDs
│   └── index.ts           # Bun.serve entrypoint
├── AGENTS.md, CLAUDE.md   # AI agent / Convex instructions
└── package.json
```

---

## Getting started

### 1. Install

```bash
npm install
```

Requires Node 22 or newer.

### 2. Set up Convex

The interactive features (comments, likes, contact form, newsletter) need a Convex deployment. From a fresh clone:

```bash
npx convex dev
```

This provisions a dev deployment and watches `convex/` for changes. It will print a deployment URL — copy it into `.env`:

```bash
# .env (loaded by Astro at build + dev time)
PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
```

`PUBLIC_*` vars are exposed to client-side code; this is the only one Astro needs.

### 3. Configure Convex environment

Email delivery and the newsletter fanout pull secrets from Convex env vars (not `.env`). Set them on the dev deployment:

```bash
npx convex env set BREVO_SMTP_HOST  smtp-relay.brevo.com
npx convex env set BREVO_SMTP_PORT  587
npx convex env set BREVO_SMTP_USER  <brevo-login>
npx convex env set BREVO_SMTP_PASS  <brevo-smtp-key>
npx convex env set CONTACT_FROM     "Arjunagi <hello@yourdomain.com>"
npx convex env set CONTACT_NOTIFY_TO your-inbox@example.com
npx convex env set SITE_URL         http://localhost:4321
# Optional — defaults to CONTACT_FROM if unset
npx convex env set NEWSLETTER_FROM  "Newsletter <news@yourdomain.com>"
```

For production, repeat with `--prod` or swap to the prod deployment.

### 4. Run the dev server

```bash
npm run dev
```

Astro comes up on `http://localhost:4321`. Keep `npx convex dev` running in a second terminal so backend changes hot-reload too.

### 5. Build & preview

```bash
npm run build    # static output to ./dist
npm run preview  # serve ./dist locally
```

---

## Convex backend notes

- **Schema** lives in [convex/schema.ts](convex/schema.ts). Six tables with indexes tuned for the access patterns in each feature (e.g. `by_post_and_client` for like-toggle idempotency, `by_unsubscribe_token` for one-hop unsubscribe).
- **Guidelines** for writing Convex code are in `convex/_generated/ai/guidelines.md` — read that before extending any backend file.
- **Node-only code** (Nodemailer) lives in [convex/emails.ts](convex/emails.ts) behind a `'use node';` directive. Everything else runs on the default Convex runtime.
- **Newsletter fanout is manual and admin-only.** `notifier:announce` is an `internalAction`, not a public API — only the deployer can invoke it (via `npx convex run`, which uses deployer credentials). Anonymous HTTP traffic against the Convex deployment cannot trigger a fanout. When a new post lands, announce it with:

  ```bash
  npx convex run notifier:announce '{"slug":"/your-new-slug"}'
  # Optional intro line prepended to the email body:
  npx convex run notifier:announce '{"slug":"/your-new-slug","customMessage":"Quick note before the link…"}'
  ```

  `notifiedPosts` gates this — running twice for the same slug returns `{ skipped: true }` instead of double-emailing subscribers.

---

## Adding a blog post

1. Create `src/pages/<your-slug>.astro` using an existing post (e.g. [src/pages/cli-to-ai.astro](src/pages/cli-to-ai.astro)) as a template. Drop `<ArticleEngagement client:idle postSlug="/your-slug" />` at the bottom for comments + likes.
2. Register the post in [src/data/posts.ts](src/data/posts.ts) — this is the single source of truth consumed by the listing page, the `/blogs.json` endpoint, and the sitemap.
3. Deploy the site so `/blogs.json` reflects the new entry.
4. Trigger the newsletter announcement via `npx convex run notifier:announce ...` (see above).

---

## AI agent (`/agent`)

The portfolio hosts an AI persona at `/agent`. Ask it about projects, essays, or the "coders to owners" thesis — every answer is cited against the real markdown sources.

### Architecture

```
Browser (/agent) ──POST /ask {query, history}──► Bun + Hono ──► Haiku (router) ──► node IDs
                                                      │                               │
                                                      │                               ▼
                                                      └── Sonnet (responder) ◄── full node bodies
                                                               │
                                                               ▼
                                                      SSE: token / token / … / done
```

- **Router** (Haiku 4.5) reads node summaries, picks 2-3 relevant IDs, returns JSON. Schema-validated by zod; hallucinated IDs filtered against the known-valid set.
- **Responder** (Sonnet 4.5) composes a cited answer from the node bodies, streaming tokens as SSE events. Phantom citations get stripped post-hoc.
- **Filler detection** (`fillers.ts`) short-circuits conversational fillers like "ok"/"yeah"/"hmm" — with no history, a human reaction (no LLM call); with history, the LLM continues from context.

### Transports

- `POST /ask` — SSE for the browser UI. Events: `token` (text chunks), `done` (citations + latency), `error`.
- `ALL /mcp` — [Streamable HTTP](https://spec.modelcontextprotocol.io/) transport. Claude Desktop, Cursor, and `mcp-inspector` can connect and call two tools: `ask_rehman` and `list_nodes`.

### Running the MCP server locally

```bash
cd mcp-server
cp .env.example .env
# Set ANTHROPIC_API_KEY in .env
bun install
bun run index.ts                 # http://localhost:3001
bun test                         # 88 tests, no API key needed (fully mocked)
bun run scripts/ingest.ts doctor # validate knowledge-base frontmatter
```

With both servers running (`npm run dev` for Astro + `bun run index.ts` for the agent), open [http://localhost:4321/agent](http://localhost:4321/agent).

The `/agent` page reads `PUBLIC_MCP_SERVER_URL` from `.env`, defaulting to `http://localhost:3001`. For production, set it to your deployed MCP server URL.

### Adding a knowledge node

Drop a markdown file under `mcp-server/nodes/projects/`, `nodes/essays/`, or `nodes/about/` with YAML frontmatter (`id`, `title`, `source`, `url`, `tags`, `summary`). Restart the server (node cache is loaded once). `scripts/ingest.ts doctor` validates the schema and checks for duplicate IDs.

---

## Deployment

- **Site:** any static host — the build is a plain `dist/` folder. `astro.config.mjs` sets `site: 'https://arjunagiarehman.com'` for sitemap + canonical URLs; change it for a fork.
- **Convex backend:** push with `npx convex deploy`. Make sure the prod deployment has the same env vars listed above, with `SITE_URL` pointing at the live origin (not localhost) so email templates link correctly.
- **MCP server:** deployed separately on a VPS via [Dokploy](https://dokploy.com). Fly.io's auto-stop breaks SSE connections, so we skip it. The mcp-server Dockerfile is in `mcp-server/` — point Dokploy at it, set `ANTHROPIC_API_KEY` + `PORT=3001`, and set `PUBLIC_MCP_SERVER_URL` on the Astro side to the deployed URL.

---

## License

Personal project — no license granted. Feel free to read for reference; please don't clone the content verbatim.
