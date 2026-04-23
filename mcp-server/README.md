# Rehman MCP Server

**An open-source reference implementation for a personal-brand AI agent.**

This is the server behind [arjunagiarehman.com/agent](https://arjunagiarehman.com/agent). Fork it, swap the knowledge nodes for your own writing, and you have your own AI persona live at `you.com/agent` — plus an MCP endpoint any external agent can connect to.

The whole thing is:

- **Markdown-as-data** — your nodes are `.md` files with YAML frontmatter. Git diffs, GitHub review, forkable like any other content. No database.
- **Router + responder**, not dense RAG — Haiku picks which of your nodes are relevant, Sonnet composes the cited answer. Deterministic and legible, not fuzzy.
- **Two transports from day one** — plain JSON `POST /ask` (for your web UI) and spec-compliant `ALL /mcp` (Streamable HTTP, 2025-03-26) for Claude Desktop, Cursor, mcp-inspector, and any future MCP-speaking agent.
- **Production-safe by default** — rate limiting, bot filter, kill switch, prompt-injection hardening all shipped.

No magic. Single Bun binary, 500-ish lines of handler code, 133 offline tests.

---

## Architecture

```
           Browser                      Any MCP client
       (/agent chat UI)             (Claude Desktop, Cursor, etc.)
              │                                │
              │ POST /ask                      │ ALL /mcp  (Streamable HTTP)
              │ (plain JSON)                   │ with mcp-session-id
              └───────────────┬────────────────┘
                              ▼
                  ┌─────────────────────────┐
                  │  Hono app (Bun runtime) │
                  │  + safety middleware    │  ← kill switch, rate limit, bot filter
                  └──────────┬──────────────┘
                             ▼
           ┌─────────────────────────────────┐
           │ 1. Router (Claude Haiku 4.5)    │  reads node SUMMARIES
           │    picks 2-3 relevant node IDs  │  (cheap, fast, JSON mode)
           └──────────┬──────────────────────┘
                      ▼
           ┌─────────────────────────────────┐
           │ 2. Fetch full bodies from cache │
           └──────────┬──────────────────────┘
                      ▼
           ┌─────────────────────────────────┐
           │ 3. Responder (Claude Sonnet 4.5)│  composes cited answer in
           │    wraps nodes in <node_body>   │  first-person voice, streams
           │    strips phantom citations     │  tokens via SSE
           └──────────┬──────────────────────┘
                      ▼
        { answer, citations[], noMatch, latencyMs }
```

**Node = one markdown file.** Router reads the YAML frontmatter `summary`, responder reads the full body. Keep summaries tight (~120 chars), bodies as long as useful.

---

## Fork walkthrough (30 minutes to your own live agent)

### 1 — Clone

```bash
git clone https://github.com/arjunagi-a-rehman/Portfolio your-agent
cd your-agent/mcp-server
```

You only need the `mcp-server/` directory if you want just the agent backend. The full repo also includes the Astro portfolio at the root, which renders the `/agent` chat UI pointing at this server.

### 2 — Install + configure

```bash
bun install
cp .env.example .env
```

Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-api03-...   # your key, set a monthly cap on it
PORT=3001                             # or whatever you want
```

All other env vars are optional — defaults are safe production values. See [Environment variables](#environment-variables) below.

### 3 — Swap the nodes

The `nodes/` directory is where your voice lives. Two options:

**Option A — start fresh.**
```bash
rm -rf nodes/projects/* nodes/essays/* nodes/about/*
# Keep the directory structure, swap the content
```
Write your own markdown files following the [node schema](#node-schema).

**Option B — fork-and-replace iteratively.**
Keep Rehman's nodes as examples, replace them one by one as you write your own. Validation is strict (unique IDs, required frontmatter), so you'll know immediately if something's off.

Validate as you go:
```bash
bun run scripts/ingest.ts doctor
```
The doctor checks every node's frontmatter schema, catches duplicate IDs, and reports your total node count.

### 4 — Run locally

```bash
bun run index.ts
```

Server listens on `http://localhost:3001`. Smoke-test it:

```bash
curl http://localhost:3001/ready
# {"status":"ready","nodesLoaded":N,"llmReachable":true}

curl -X POST http://localhost:3001/ask \
  -H "Content-Type: application/json" \
  -d '{"query":"tell me about yourself"}'
```

### 5 — Connect Claude Desktop (optional but the fun part)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "you": {
      "url": "http://localhost:3001/mcp",
      "transport": "streamable-http"
    }
  }
}
```

Restart Claude Desktop. Your agent now appears as an MCP tool source.

### 6 — Deploy

The included `Dockerfile` is a multi-stage Bun build with non-root user and a `/health` HEALTHCHECK. It builds on any container host:

**Dokploy** (what this repo uses)
1. New application → Source: your GitHub fork
2. Build type: Dockerfile
3. Dockerfile path: `mcp-server/Dockerfile`  
4. Docker context: `mcp-server`  
5. Watch paths: `mcp-server/**`
6. Set `ANTHROPIC_API_KEY` in the Environment tab
7. Add a domain, enable HTTPS
8. Deploy

**Fly.io** (alternative — keep `auto_stop_machines = false`, SSE breaks on idle)
```bash
fly launch --dockerfile mcp-server/Dockerfile
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

**Plain Docker** (any VPS)
```bash
docker build -t you-mcp-server mcp-server/
docker run -d --restart unless-stopped \
  -p 3001:3001 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  you-mcp-server
```

### 7 — Wire the web UI (if you forked the full repo)

The Astro portfolio at the repo root has a `/agent` page that reads `PUBLIC_MCP_SERVER_URL` from its build env. In your Astro hosting (Vercel/Netlify/Cloudflare Pages), set:

```
PUBLIC_MCP_SERVER_URL=https://mcp.yourdomain.com
PUBLIC_CONTACT_EMAIL=you@example.com
```

Rebuild the Astro site. Your `/agent` page now hits your production MCP server and the handoff "Send a note" button opens `mailto:you@example.com`.

---

## Node schema

Every node is a markdown file with YAML frontmatter:

```markdown
---
id: my-unique-id              # globally unique across all nodes
source: project               # one of: project | essay | about
title: "Friendly Title"
url: /projects/my-project     # path on your live site (used in citation links)
date: "2025-01-01"
tags:                         # free-form, used by the router for hints
  - ai-agents
  - infra
summary: >                    # ≤120 chars, single sentence, router-visible
  One sentence that captures the core claim. This is what the
  router LLM reads when deciding whether your node is relevant.
---

# Full markdown body below

Write freely. This is what the responder LLM reads to compose cited answers.
Treat it like a well-written internal wiki entry. Headings, lists, code blocks,
links — all rendered faithfully in the chat UI's markdown view.
```

**Rules of thumb:**

- **One opinion per node.** Don't stuff 6 ideas into one file. The router works better when each node has a clear "aboutness."
- **Write like yourself.** The responder composes in your voice by reading your voice. Slop-free, first-person, opinionated prose makes the output sound like you.
- **120-char summary is the leverage point.** It's the ONLY thing the router sees — make it count.
- **Cite with inline `[id]` markers when your node contains reference-worthy content.** The responder will preserve these as clickable citation chips.

`bun run scripts/ingest.ts doctor` validates everything in one pass before you ship.

---

## Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `POST` | `/ask` | JSON streaming for browser UI (SSE) | CORS-locked to your origins |
| `ALL`  | `/mcp` | MCP Streamable HTTP (external clients) | IP rate limit + bot UA filter |
| `GET`  | `/health` | Liveness (no LLM call) | — |
| `GET`  | `/ready` | Readiness (nodes loaded + LLM reachable) | — |

`/ask` events when used as SSE:

```
event: token         { "text": "...chunk..." }
event: done          { "citations": [...], "noMatch": bool, "latencyMs": N }
event: error         { "message": "..." }
```

### MCP tools exposed

| Tool | Purpose |
|------|---------|
| `ask_rehman` | Ask a question, get a cited answer (the main one) |
| `list_nodes` | Discover what topics are covered (filter by `project`, `essay`, `about`, or `all`) |

Forkers: rename `ask_rehman` in `src/server.ts` to match your own persona.

---

## Environment variables

All optional except `ANTHROPIC_API_KEY`. Defaults are safe production values.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | ✅ yes | — | Your Anthropic key. **Set a monthly spend cap** in the Anthropic console as primary cost protection. |
| `PORT` | no | `3001` | HTTP port the server listens on. |
| `AGENT_DISABLED` | no | `0` | Kill switch. Set to `1` to short-circuit all endpoints to a degraded response with zero LLM spend. Flip this the moment you suspect abuse. |
| `RATE_LIMIT_MAX` | no | `10` | Max requests per window per client IP. |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Rate-limit window duration. |
| `ALLOWED_BOTS` | no | (empty) | Comma-separated UA substrings to allow past the bot filter on `/mcp`. Default deny blocks GPTBot, CCBot, ClaudeBot, PerplexityBot, Bytespider, and 10 more. |

All safety config is resolved per-request, so env changes in your host (Dokploy env edit, Fly secrets, etc.) take effect **without a redeploy**.

---

## Safety layer

Shipped and on by default:

- **Rate limiter** — in-memory token bucket keyed by client IP, separate buckets for `/ask` and `/mcp`, returns 429 with `Retry-After`.
- **Bot UA filter on `/mcp`** — default-deny for 15 known training-data crawlers.
- **Kill switch** — `AGENT_DISABLED=1` → 503 + degraded payload, no LLM call.
- **Prompt-injection hardening** — node bodies wrapped in `<node_body>` delimiters with role-marker escape (`<system>`, `<user>`, `<assistant>`, nested `</node_body>` all neutralized before the LLM sees the content). System prompt explicitly treats node content as DATA, not instructions.
- **Phantom citation stripping** — the responder's final post-processor removes any `[id]` markers that weren't in the router's returned node list.
- **CORS lock on `/ask`** — only your browser origins can call the JSON endpoint; the MCP endpoint stays origin-agnostic for external agents.

The one thing NOT in this repo: a hard monthly spend cap. Anthropic's dashboard owns that — set it there, then treat `AGENT_DISABLED` as your panic button.

---

## Tests

```bash
bun test                  # all 133 tests, fully offline (mocked LLM)
bun test --watch          # watch mode
bun run scripts/ingest.ts doctor   # validate your nodes
```

No Anthropic API key needed. The router + responder unit tests inject a fake Anthropic client; integration tests mock the pipeline at the module level.

**When you add a new feature:** write a test. The coverage targets in `CLAUDE.md` at the repo root expect this.

---

## Project structure

```
mcp-server/
├── src/
│   ├── types.ts           Zod schemas + TypeScript types (request/response/node)
│   ├── nodes.ts           Node loader + in-memory cache
│   ├── router.ts          Haiku routing step (DI for tests)
│   ├── responder.ts       Sonnet response step + XML delimiter hardening
│   ├── fillers.ts         Conversational filler detection ("ok", "yeah", "hmm")
│   ├── middleware.ts      Rate limiter, bot filter, kill switch
│   ├── server.ts          Hono app (/ask SSE, /mcp MCP, /health, /ready)
│   └── *.test.ts          Unit tests for each module
├── tests/integration/
│   ├── ask.test.ts        End-to-end /ask SSE tests (pipeline mocked)
│   ├── mcp-spec.test.ts   MCP protocol conformance tests
│   └── health.test.ts     /health + /ready tests
├── nodes/
│   ├── projects/          Project knowledge nodes — swap these
│   ├── essays/            Essay knowledge nodes — swap these
│   └── about/             About/background nodes — swap these
├── scripts/
│   ├── ingest.ts          CLI: `doctor` validator + content ingestion helpers
│   └── test-mcp.ts        Live smoke test against a running server
├── index.ts               Entry: Bun.serve({ fetch: app.fetch })
├── Dockerfile             Multi-stage Bun build, non-root user, healthcheck
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## Deploy notes

- **Dokploy is what this repo runs on** — arjunagiarehman.com/agent is a Dokploy-managed Docker container on a Hostinger VPS. Total monthly cost: ~$15 VPS + LLM usage.
- **Fly.io works but be careful with `auto_stop_machines`** — default-true suspends the machine after idle, which can break long-lived SSE connections. Explicit `always-on` or `auto_stop_machines = false` in your `fly.toml`.
- **Don't use Cloudflare Workers** without wiring Durable Objects carefully — the MCP session state (`Map<sessionId, transport>`) needs to persist across requests, and Workers are stateless by default.
- **Plain Docker on any VPS** with `--restart unless-stopped` is the simplest option if you're not using an orchestrator.

---

## License

MIT — the **code** is yours to fork, modify, and deploy. See [`LICENSE`](../LICENSE) at the repo root.

Note: Rehman's personal writing in `mcp-server/nodes/` is his, not MIT-licensed for verbatim reproduction. Fork the code, bring your own nodes.

---

## Built on

- [Bun](https://bun.sh) — runtime
- [Hono](https://hono.dev) — web framework
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP transport
- [Anthropic SDK](https://docs.anthropic.com/) — Claude Haiku 4.5 + Sonnet 4.5
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — YAML frontmatter parser
- [Zod](https://zod.dev) — runtime schema validation
