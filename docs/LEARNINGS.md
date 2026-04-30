# Project Learnings

Exported from gstack `/learn` on 2026-04-30. Source of truth lives in
`~/.gstack/projects/arjunagi-a-rehman-Portfolio/learnings.jsonl` — re-export with
`/learn export` to refresh.

## Patterns

- **loading-state-as-architecture-demo** (8/10): For AI/agent products where the
  pipeline IS the differentiator, design the loading state to surface the
  architecture. Phase-progress status line (router picking nodes → fetching →
  composing) turns 3-8s wait from dead air into a capability demo, and absorbs
  a visible-thinking-UI feature into core scope for free.

## Pitfalls

- **convex-denormalized-counter-race** (10/10): A denormalized counter row
  alongside the table it counts is a Convex foot-gun. Two concurrent first-writes
  both see no counter, both insert, leaving duplicates that break `.unique()`
  forever. Right fix: derive count on the fly from the source-of-truth table via
  an existing index, `.collect().length`. O(K) per-post is fine at any reasonable
  scale.
  - Files: `convex/likes.ts`, `convex/schema.ts`

- **convex-public-action-for-admin** (10/10): Any function registered with
  `action()` is exposed on the public deployment endpoint. Anyone can POST to
  invoke public functions. Admin-only capabilities (newsletter fanout, cache
  invalidation, billing) must use `internalAction` / `internalMutation` /
  `internalQuery`. Source-level regex contract test is the only reliable
  regression guard because `api.*` and `internal.*` resolve through the `anyApi`
  proxy at runtime.
  - Files: `convex/notifier.ts`, `convex/notifier.test.ts`

- **astro-transition-persist-component-tag** (9/10): In Astro 6,
  `transition:persist` on a non-island component tag does NOT propagate to the
  rendered root element — the attribute silently disappears in the build. Only
  React/framework islands receive the directive at the component tag. For Astro
  components rendering plain HTML, apply `transition:persist` directly to the
  root element inside the component definition. Verified by grepping
  `dist/**/index.html` for `data-astro-transition-persist`.
  - Files: `src/layouts/Layout.astro`, `src/components/CircuitCanvas.astro`,
    `src/components/Footer.astro`

- **convex-client-gate-flashes-default** (9/10): Gating a Convex `useQuery` on a
  browser-only id (localStorage clientId via useEffect) forces a 2-render-cycle
  delay plus network round-trip. If the component renders `state?.count ?? 0` as
  a loading placeholder, users see a fake 0 flash that snaps to the real value.
  Fix: split the query so public data renders on mount; keep the per-client
  variant gated. Never use a semantically valid default value as a loading
  placeholder — use a skeleton or dash.
  - Files: `convex/likes.ts`, `src/components/react/LikeButton.tsx`,
    `src/components/react/useClientId.ts`

- **gstack-hook-fails-open** (9/10): `gstack-team-init` generates
  `.claude/hooks/check-gstack.sh` with flat-JSON + `exit 0`, which Claude Code
  ignores; hook fails OPEN where it should block. Fix: `exit 2` + stderr.
  - Files: `.claude/hooks/check-gstack.sh`

## Architecture

- **mcp-browser-wire-format** (8/10): For personal-brand MCP servers exposing
  both a web UI and external MCP clients, collapse the browser-to-server wire
  format to plain JSON POST. The browser is NOT an MCP client. Reserve MCP
  protocol (Streamable HTTP, `Mcp-Session-Id`, SSE framing) for external A2A
  clients only. Splits a 2-week yak-shave (browser MCP client) into a 1-day
  simple HTTP endpoint. Different MCP tool definitions map to different transport
  entry points but the same underlying `ask_rehman` handler.

## Preferences

- **synthesis-over-selection**: User tends to reject all multiple-choice options
  and synthesize their own answer. Future `AskUserQuestion` prompts should
  include a synthesis / hybrid option explicitly, or frame questions more openly.
  Recommended and selected options diverge frequently.

## Operational

- **feat-ai-agent-shipped-v1.2.0** (10/10, 2026-04-30): 5-weekend agent build
  shipped as v1.2.0 on 2026-04-25 (PR #17, merge commit `c8dcdab`). Final scope:
  open-source MCP server (Haiku router + Sonnet responder, `/ask` SSE + `/mcp`
  Streamable HTTP), 26 curated knowledge nodes, production safety layer (rate
  limit, kill switch, prompt-injection hardening), 5 GA4 events, MIT-licensed
  OSS template with fork-to-live walkthrough, W5 announcement essay
  *Software Can Talk* (PR #16). Plan deviation: design doc targeted v1.0.0,
  shipped as v1.2.0 because versioning was already at 1.1.0 from W3.
  Distribution: Convex newsletter sent, X thread live, LinkedIn queued, HN
  blocked low karma → pivoted to r/ClaudeAI + r/SideProject + dev.to.
  r/LocalLLaMA attempt removed (off-topic). Second-machine fork-to-live test
  passed (Windows clone).

- **credential-leak-response** (9/10): When a user pastes a credential in chat
  (API key, secret, token): (1) state clearly the value is now in
  session/telemetry/logs and must be rotated, (2) do NOT write the value to any
  file or tool call, (3) pivot to using the information about WHAT system the
  credential is for while ignoring the value itself.

- **investigate-skill-type-mismatch** (9/10): The `/investigate` skill doc says
  to log outcomes with `type:"investigation"`, but `gstack-learnings-log` rejects
  it. Allowed types: `pattern`, `pitfall`, `preference`, `architecture`, `tool`,
  `operational`. Use `pitfall` for anti-patterns or `pattern` for the fix shape.

- **hand-written-wireframes-when-designer-offline** (8/10): When the gstack
  designer needs an OpenAI key the user hasn't configured AND the codebase has a
  strong design-system, hand-written HTML wireframes using the real tokens
  produce more site-accurate mockups than AI-generated variants. Read
  `global.css` + component CSS first, extract tokens, write 3 distinct direction
  HTML files.
