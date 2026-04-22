# rehman-mcp-server

The MCP server powering [arjunagiarehman.com/agent](https://arjunagiarehman.com/agent).

Ask questions about Rehman's projects, essays, and thinking. Get cited answers grounded in his actual writing. Connect with any MCP-compatible client — Claude Desktop, Cursor, mcp-inspector — or call the plain JSON `/ask` endpoint from your own app.

Open-source. Fork it, swap the nodes for your own writing, and ship your own AI persona.

---

## Architecture

```
User question
  ↓
POST /ask  (browser)  or  ALL /mcp  (MCP clients)
  ↓
Router — Claude Haiku reads node summaries, picks 2-3 relevant node IDs
  ↓
Responder — Claude Sonnet reads full node bodies, writes a cited answer
  ↓
{ answer, citations[], noMatch, latencyMs }
```

Knowledge base: plain markdown files in `nodes/**/*.md` with YAML frontmatter. No vector database, no dense embeddings — just curated nodes and a smart router.

## Stack

- **Runtime**: Bun
- **Web framework**: Hono
- **MCP transport**: `@modelcontextprotocol/sdk` (WebStandardStreamableHTTPServerTransport)
- **Router LLM**: Claude Haiku 4.5 (fast, JSON-mode)
- **Responder LLM**: Claude Sonnet 4.5 (voice quality)
- **Validation**: Zod on all inputs/outputs
- **Tests**: Vitest (22 tests, no network required)
- **Deploy**: Docker on Dokploy

## Quick start

```bash
# 1. Install dependencies
bun install

# 2. Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Start the server (hot-reload)
bun run dev

# 4. Test it
curl -X POST http://localhost:3001/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "what is Kalrav.AI?"}'
```

Server listens on port `3001` by default. Override with `PORT=xxxx`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ask` | Plain JSON endpoint for the browser UI |
| `ALL` | `/mcp` | MCP Streamable HTTP (Claude Desktop, Cursor, mcp-inspector) |
| `GET` | `/health` | Liveness probe — returns `{"status":"ok"}` |
| `GET` | `/ready` | Readiness probe — checks nodes loaded + LLM reachable |

## MCP client setup

**mcp-inspector**
```bash
npx @modelcontextprotocol/inspector http://localhost:3001/mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "rehman": {
      "url": "https://arjunagiarehman.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

**Available MCP tools**:
- `ask_rehman` — ask a question, get a cited answer
- `list_nodes` — discover what topics are covered (filter by `project`, `essay`, `about`, or `all`)

## Adding knowledge nodes

Create a markdown file anywhere under `nodes/`:

```markdown
---
id: my-unique-id          # must be globally unique
title: "My Project Name"
source: project           # project | essay | about
url: /projects/my-project # path on the live site
date: "2025-01-01"
tags:
  - relevant-tag
summary: "One sentence that captures the core claim. Router LLM reads this. Keep it under 120 chars."
---

Full body content here. Write freely — this is what the responder LLM reads
to compose cited answers. Treat it like a well-written internal wiki entry.
```

Restart the server after adding nodes (the cache refreshes on startup).

## Project structure

```
mcp-server/
├── src/
│   ├── types.ts        # Zod schemas + TypeScript types
│   ├── nodes.ts        # Node loader + in-memory cache
│   ├── router.ts       # Haiku routing step
│   ├── responder.ts    # Sonnet response step
│   ├── server.ts       # Hono app (/ask, /mcp, /health, /ready)
│   ├── nodes.test.ts   # Node loader tests
│   └── router.test.ts  # Router tests (mocked LLM)
├── nodes/
│   ├── projects/       # Project knowledge nodes
│   ├── essays/         # Essay knowledge nodes
│   └── about/          # About/background nodes
├── index.ts            # Entry point (Bun.serve)
├── Dockerfile
└── vitest.config.ts
```

## Tests

```bash
bun run test              # run once
bun run test:watch        # watch mode
bun run test:coverage     # coverage report
```

Tests are fully offline — no Anthropic API key required. The router tests inject a fake client.

## Docker

```bash
docker build -t rehman-mcp-server .
docker run -p 3001:3001 -e ANTHROPIC_API_KEY=sk-ant-... rehman-mcp-server
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | — | Set to `production` in Docker |

## License

MIT — fork freely, swap the nodes, ship your own AI persona.
