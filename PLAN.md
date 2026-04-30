<!-- /autoplan restore point: /Users/admin/.gstack/projects/arjunagi-a-rehman-Portfolio/main-autoplan-restore-20260430-215332.md -->

# Plan: Hero-embedded Agent Terminal

> **Status: APPROVED via /autoplan on 2026-04-30.** All 3 review phases ran single-voice (Codex unavailable). Premise gate → option B (bundled scope: hero + essay-bottom + project pages). Final gate → option A (approve as-is). Ready for implementation.

## Goal

Replace the hex-ring logo visual with a live, embedded agent terminal in the homepage hero. Move agent discovery from `/agent` (currently 3% homepage→agent click-through, GA last 28 days) to homepage hero where every visitor sees it. Keep `/agent` as the deep-link / full-transcript surface.

**Why now:** GA shows Ask Rehman has 0% bounce + ~4 events/view (highest engagement on the site) but only 18 visitors found it vs 78 on home. It's the most differentiating feature with the worst discovery. Survey of 13 leading AI/agent landing pages (ChatGPT, Perplexity, Gemini, Mistral, OpenAI, Lovable, Bolt, v0, Anthropic, Cursor, Cognition, Lee Robinson, Tony Dinh) shows unanimous convergence on "input-as-hero" — every winner places the chat composer above the fold as the dominant element.

## Scope (locked at /autoplan Phase 1, option B)

1. **Hero rework** on `/` — embed agent terminal in right column (co-hero with name/CTAs)
2. **Essay-bottom embed** at foot of `/software-can-talk` (currently getting LinkedIn citations)
3. **Project-page embed** at foot of top-2 production projects: `/projects/kalrav` and `/projects/routeeye` (the two that recruiters/clients are most likely to read)

Same `AgentChat` component, three placements via three variants:

| Variant | Where | Chrome | Chips |
|---|---|---|---|
| `page` (default) | `/agent` | full header + MCP footer | 5 page chips (current) |
| `hero` | `/` (right col) | terminal window chrome + LIVE indicator | 4 hero chips (locked) |
| `inline` | essay/project foot | minimal — "Ask the agent →" label + composer | 3 context-specific chips per page |

## Out of scope

- Backend / MCP / streaming logic — already works, no changes
- Citation rendering — already works, no changes
- Mobile redesign of `/agent` itself — variants only
- Other essay pages (cli-to-ai, coders-to-owners, agent-deployment-1, study-buddy, first-ai-agent) — defer to TODOS.md after measuring `/software-can-talk` impact
- Other project pages (chotuai, wisp, ecai) — defer to TODOS.md
- Brand-shift discussion (terminal aesthetic for non-AI consulting clients) — flagged for design phase but not blocking

## Decisions locked from prior conversation

- **Co-hero split (50/50)**: terminal occupies right column at desktop. "View My Work" stays as primary CTA on left; agent is co-hero, not subordinate.
- **Empty composer on first paint**: drop the pre-filled exchange shown in the mockup. Pulsing cursor + chips signal "type here", not "this happened already".
- **Conversation expands in place** (not handoff to /agent): once the user submits, the thread renders inside the hero terminal (constrained max-height with internal scroll). Matches the mockup's LIVE/terminal-alive feel.
- **Hex-ring removed on desktop**: terminal IS the visual. No hexagon competition.
- **Mobile: agent stacks above "View My Work"**: discovery is the problem; agent gets fold priority on phone.
- **Terminal aesthetic stays**: window chrome (mac dots + `arjunagi.sh — agent` + LIVE indicator) is brand, not barrier — input takes plain English. Confirmed during design review.
- **Chip set (4)**:
  1. `why convex over postgres?`
  2. `what's running at BIAL?`
  3. `what's "software can talk" about?`
  4. `taking consulting work?`
  Each chip earns its place by surfacing what the static page doesn't already say.

## Architecture decisions

### 1. Reuse `AgentChat`, don't fork

Add `variant: 'hero' | 'page'` prop to `src/components/react/AgentChat.tsx`. In `'hero'` mode, hide the big header ("Ask me anything_"), the subhead, the MCP footer info. The composer + chips + thread + streaming logic stay identical. Avoids two divergent codebases.

**Alternative considered (rejected):** Create a new `HeroAgentTeaser.tsx`. Rejected because the streaming/citation/markdown rendering logic is non-trivial and would either duplicate or extract into a shared sub-component — extra surface area for marginal gain.

### 2. Variant-aware chips

`EXAMPLE_CHIPS` becomes:
```ts
const HERO_CHIPS = [
  'why convex over postgres?',
  "what's running at BIAL?",
  'what\'s "software can talk" about?',
  'taking consulting work?',
];

const PAGE_CHIPS = [
  // current 5 chips, kept for /agent breadth
  'What is Kalrav.AI?',
  'Vertical vs horizontal AI agents?',
  'Your coders-to-owners thesis',
  'How to deploy an AI agent?',
  'Your background and stack',
];
```

For `inline` variant, chips are **page-specific** and passed as a prop:

```tsx
// In /software-can-talk.astro, foot of essay:
<AgentChat
  variant="inline"
  client:visible
  chips={[
    'tldr software can talk?',
    'how is this different from delphi/sana?',
    'why mcp and not just a chat widget?',
  ]}
  source="essay-software-can-talk"
/>

// In /projects/kalrav.astro:
chips=[
  'how does kalrav route across woocommerce + shopify?',
  'why google adk over langgraph for this?',
  'how do you handle multi-tenant agent isolation?',
]

// In /projects/routeeye.astro:
chips=[
  'why redis pub/sub over kafka for telemetry?',
  'how does sse handle 200+ vehicles?',
  'lessons from running this at BIAL?',
]
```

Each set surfaces what only the agent knows that the page doesn't already say.

Add `chips?: string[]` prop to `AgentChat`. When provided, it overrides the variant's default. When omitted, defaults apply.

### 3. Source tracking in GA

Extend `trackQuestionAsked` in `src/lib/agent-ga.ts` with a `source: string` arg (default `'agent-page'` for back-compat). Pass via `AgentChat`'s `source?: string` prop. Recommended source values:

- `agent-page` (default — `/agent`)
- `home-hero` (`/` hero)
- `essay-software-can-talk` (and equivalents per essay)
- `project-kalrav`, `project-routeeye` (and equivalents per project)

Free-form string for forward-compat — adding a new placement is one prop, no schema change.

### 4. CSS scoping

Add `.ac-hero` and `.ac-inline` classes on root when variant matches. Scoped overrides in `agent.css`:

**`.ac-hero`** (homepage):
- terminal-window chrome (header dots + `arjunagi.sh — agent` title + LIVE indicator)
- max-height with internal scroll on `.ac-thread`
- compact spacing
- hide `.ac-header`, `.ac-mcp-inline`, `.ac-footer-info`

**`.ac-inline`** (essay/project foot):
- no terminal chrome (it's contextual to the surrounding article, not a window)
- "Ask the agent about this →" lead-in label
- compact composer + chips
- hide `.ac-header`, `.ac-mcp-inline`, `.ac-footer-info`
- max-height on thread (smaller than hero, ~400px)
- bordered top edge so it visually separates from article content

No new CSS file. Keep all agent styling in one place.

### 5. Hero layout (index.astro)

```
.hero-inner (grid 1fr 480px → 1fr on tablet → stack on mobile)
├── .hero-content (left)
│   ├── greeting + name + role
│   ├── description
│   ├── CTAs (View Work | email) — "Ask me anything →" CTA REMOVED (now embedded)
│   └── stats
└── .hero-terminal (right) — replaces .hero-visual
    └── <AgentChat variant="hero" client:load />
```

The hex-ring + social pills block is removed entirely. Social links can move to footer (already there) or a quieter section.

### 6. Mobile order

```
@media (max-width: 1024px):
  .hero-inner: grid → flex column
  Order:
    1. greeting + name + role
    2. description
    3. .hero-terminal (agent above fold target)
    4. CTAs
    5. stats
```

## Files touched

| File | Change |
|---|---|
| `src/pages/index.astro` | Replace `.hero-visual` block with `<AgentChat variant="hero" client:visible .../>`; remove `.hero-agent-cta` from CTAs; update grid + mobile order; remove hex-ring CSS; **keep** small Rehman visual (logo+name treatment) on left so first-impression "who is this?" still answers in 200ms (Finding 5 mitigation) |
| `src/components/react/AgentChat.tsx` | Add `variant?: 'hero' \| 'page' \| 'inline'` prop (default `'page'`); add `chips?: string[]` prop (override default chips); add `source?: string` prop; conditional render of header/footer/chrome by variant |
| `src/components/react/agent.css` | Add `.ac-hero` and `.ac-inline` scoped overrides |
| `src/lib/agent-ga.ts` | Add `source: string` arg to `trackQuestionAsked`; default `'agent-page'` |
| `src/lib/agent-ga.test.ts` | Cover new source arg |
| `src/pages/agent.astro` | Pass `variant="page"` explicitly to `AgentChat` |
| `src/pages/software-can-talk.astro` | Add `<AgentChat variant="inline" client:visible chips={[...]} source="essay-software-can-talk" />` at foot of essay, before footer |
| `src/pages/projects/kalrav.astro` | Same, with project-specific chips, `source="project-kalrav"` |
| `src/pages/projects/routeeye.astro` | Same, with project-specific chips, `source="project-routeeye"` |
| `src/components/react/AgentChat.test.tsx` | Add hero+inline variant render tests (header hidden, footer hidden, variant-specific chips shown, custom chips override) |

**No new files. No new routes. No new dependencies.** Astro env vars unchanged. Hydration: `client:visible` everywhere (lazy hydrate when scrolled into view).

## Verification

```
npx astro check          # types
npx biome check .        # lint
npm test                 # AgentChat + agent-ga unit tests
npx knip --no-progress   # dead code (the removed hex-ring assets/CSS shouldn't leave dead refs)
```

Manual:
- Desktop 1440 → terminal occupies right ~480px; chips visible; submit expands thread inline
- Tablet 1024 → hero stacks; terminal below role/desc; CTAs below terminal
- Mobile 375 → terminal above CTAs; chips wrap; thread scrolls internally
- /agent direct → still works identically (variant defaults preserve old behavior)

## Rollout

Single-author site, no flag needed. One PR, one merge, done. Component changes are additive — `variant` defaults to `'page'`, so /agent and any other current consumer is byte-identical to today.

If conversion drops vs current after a week, revert `index.astro` only. Component + CSS additions are inert when unused.

## Success criteria (post-launch, 2-week window)

- **Primary (process)**: total agent submits (all sources) > 2.5x current baseline (~75/28d → 190+/28d)
- **Surface mix**: essay-foot submit rate (`/software-can-talk`) >= home-hero submit rate (validates Phase 1 hypothesis that intent traffic converts higher)
- **Guardrail (brand)**: home bounce rate doesn't increase >5 percentage points; essay engagement_time doesn't drop
- **Watch (business)**: consulting-inquiry contact-form submits — does this redesign correlate with more/fewer than the prior 28-day baseline? (Acknowledged in CEO Phase 1: this is the real KPI; 2 weeks is too short to conclude, but track from day-1.)

## Open questions for review

1. **Inline expand vs route to /agent on submit?** Plan picks inline. Eng-review should pressure-test layout-shift / scroll-anchor / mobile-keyboard behavior when the thread grows.
2. **Compact terminal height on mobile?** Plan: `min-height: 280px; max-height: 60vh` with internal scroll. Design-review should confirm chips + composer fit the iPhone fold without scrolling away.
3. **Hex-ring removal** — desktop hero might feel asymmetric without a balancing visual on the left. Design-review should weigh whether to keep a quieter decorative element or let the terminal carry the right side alone.
4. ~~`client:load` on hero~~ **LOCKED via /autoplan Phase 1**: switch to `client:visible` with a 280px skeleton placeholder. Avoids LCP regression on a route that's served to every visitor. (Auto-decided: P5 explicit, P3 pragmatic — clear eng win, not a taste call.)

---

## /autoplan — Phase 1: CEO Review

**Mode**: SELECTIVE EXPANSION
**Voices**: Claude subagent only (Codex binary unavailable on this machine — all phases run [subagent-only]; consensus column noted as N/A)

### CEO consensus table

| Dimension | Subagent | Codex | Consensus |
|---|---|---|---|
| 1. Premises valid? | NO (multiple) | N/A | **FLAGGED** — premise gate |
| 2. Right problem to solve? | NO | N/A | **FLAGGED** — see Finding 1 |
| 3. Scope calibration correct? | NO (too narrow) | N/A | **FLAGGED** — see Finding 4 |
| 4. Alternatives sufficiently explored? | NO | N/A | **FLAGGED** — see Findings 3, 4 |
| 5. Competitive/market risks covered? | PARTIAL | N/A | flagged |
| 6. 6-month trajectory sound? | RISK | N/A | flagged |

Single-voice mode: each finding flagged regardless of consensus, per autoplan rule.

### Findings

1. **CRITICAL — KPI is a vanity proxy.** "3% home→/agent click-through → fix it" assumes more agent submits = better outcome. The agent is a *thesis demo*, not a conversion engine. Real KPIs: consulting inbound, GitHub forks of the OSS template, credibility signal for recruiters/founders. Could 10x submits and gain zero new business. → **Premise gate question.**

2. **CRITICAL — Reference class error.** The "13 leaders all put input in hero" survey conflates chat products (ChatGPT, Perplexity, v0, Bolt — input IS the product) with personal brands. Visitors to a personal site came for *the person*, not the chat. Tony Dinh did put chat in hero, but he's the only personal-brand example. Lee Robinson doesn't lead with chat. → **Premise gate question.**

3. **HIGH — Instrument-first dismissed.** 28 days × ~3 visitors/day = sample too small to know *why* visitors didn't click. Cheaper experiments first: (a) sticky banner, (b) better CTA copy, (c) move CTA above the fold without a terminal. → **Surface at final gate as taste decision.**

4. **HIGH — Contextual placement ignored.** "Software Can Talk" is getting LinkedIn citations. An agent embed at the *foot of that essay* converts intent-loaded readers, probably 10-20%. Same for Kalrav.AI / RouteEye project pages. The plan optimizes the *lowest-intent* surface (home) and ignores the highest-intent ones. → **Surface at final gate as scope expansion.**

5. **HIGH — 6-month regret: home becomes "AI demo site," not "Rehman."** A LIVE-indicator terminal as the dominant right-column visual pulls every eye. Hex-ring at least said "this is a person." For non-AI-native consulting clients (Jano Health-style), terminal aesthetic is alienating. → **Mitigation: keep a subordinate Rehman visual (small portrait/logo) on the left so the page still answers "who is this?" in 200ms.**

6. **MEDIUM — Inline expand vs route to /agent.** Plan gave this 1 line. It's the load-bearing UX call. Inline expansion in 480px column with internal scroll < /agent's full single-column reading width. → **Surface at final gate as taste decision.** (Note: subagent fabricated a "W7B-2" cite to a prior decision; verified false. Concern is real, prior-art claim was not.)

7. **MEDIUM — `client:load` LCP cost punted.** Strategic call, not eng question. → **Auto-decided: switch to `client:visible` with skeleton. P5 + P3.**

### Existing code leverage map

| Sub-problem | Existing code | New work |
|---|---|---|
| Streaming/citation/markdown rendering | `AgentChat.tsx` (full impl) | None — reuse |
| GA event tracking | `agent-ga.ts` (`trackQuestionAsked` etc.) | Add `source` arg |
| Composer + chips UX | `AgentChat.tsx` lines 590-700 | Add `variant` prop |
| Terminal/window aesthetic | `agent.css` (existing dark theme) | Add `.ac-hero` overrides |
| Hero layout | `index.astro` lines 376-467 | Replace `.hero-visual` block |
| Route /agent | `agent.astro` (deep-link kept) | Pass `variant="page"` explicitly |

**Nothing new from scratch.** Plan correctly reuses; no DRY violations.

### Dream state delta

```
CURRENT (v1.2.0):
  Home page: bullets + projects + bio, hex-ring visual, "Ask me anything →" CTA
  /agent: live agent with full terminal UX
  Engagement: 78 home users, 6 reach /agent, 18 total agent visits/28d

THIS PLAN:
  Home page: bullets + projects + bio + EMBEDDED agent terminal (right col)
  /agent: unchanged (deep-link / full transcript)
  Expected: home-hero submits raise total agent engagement ~3-5x

12-MONTH IDEAL (per /office-hours design doc):
  Personal-brand-as-platform: agent is queryable from anywhere visitor lands
  Essays carry agent embeds for context
  MCP endpoint discovery surfaced for AI-builder audience
  Distribution: agent shows up on LinkedIn, in podcasts, in fork-template README
  Engagement: agent submits driven by INTENT, not placement; consulting inbound
    correlates with agent-cited projects
```

**Delta**: this plan moves discovery up but does not address the 12-month ideal of *contextual* embeds. Finding 4 is the gap.

### Implementation alternatives (CEO mode adds)

| # | Approach | Effort (CC) | Reward | Risk |
|---|---|---|---|---|
| A | Hero rework as planned | ~30 min | Medium | Brand-shift risk |
| B | Sticky banner promoting /agent on home | ~10 min | Low-Medium | Low |
| C | Embed `<AgentChat variant="inline" />` at foot of `/software-can-talk` + 3 project pages | ~45 min | **Highest** (intent traffic) | Low |
| D | A+C bundled (hero + contextual essays) | ~75 min | Highest + brand risk | Medium |
| E | Do nothing 30 days, instrument hero CTA copy variants | 0 | Sample for decision | None — pure wait |

**P1 (completeness) + P2 (boil lakes) recommend D**. The plan currently picks A. → Surface at gate.

### NOT in scope (auto-defer)

- /agent page redesign — locked, stays as-is
- MCP server changes — locked, stays as-is
- Brand-shift discussion (terminal aesthetic for non-AI consulting clients) — flagged for design phase
- Agent embeds in other essays/projects — Finding 4 surfaces this; user decides at gate

### What already exists

Already covered above in "Existing code leverage map." Nothing new in this plan invents what exists.

### Error & Rescue Registry

N/A — pure UI placement change, no new error paths. Existing error handling in `AgentChat.tsx` (timeout, no-match, server error) is unchanged.

### Failure Modes Registry

| Failure | Cause | User-visible | Mitigation |
|---|---|---|---|
| LCP regression | `client:load` blocks paint | Slower home | Auto-decided: `client:visible` |
| Layout shift on submit | thread expansion in fixed-width column | jarring | Eng phase: `min-height` reservation |
| Mobile keyboard covers thread | iOS keyboard pops up | unreadable | Design phase: scroll-into-view + safe-area-inset |
| Brand erosion | terminal dominates first impression | "AI demo site" feel | Finding 5: keep small Rehman visual |
| Drives wrong audience | terminal alienates non-AI consulting clients | fewer consulting leads | Finding 1: confirm KPI |

### CEO Phase 1 — Completion Summary

- **Premises**: 4 challenged (KPI, reference class, alternatives, scope) → premise gate
- **User decision at gate**: B (bundle hero + essay-bottom + project-page embeds)
- **Auto-decided**: 1 (Finding 7: `client:visible`)
- **Mitigations into plan**: 1 (Finding 5: keep Rehman visual)
- **Outputs written**: consensus table, existing-code map, dream state, alternatives, NOT-in-scope, what-exists, error registry (N/A), failure modes
- **Sub-voice status**: Codex unavailable → `[subagent-only]` mode

---

## /autoplan — Phase 2: Design Review

**Voices**: Claude subagent only (Codex unavailable)

### Design litmus scorecard

| # | Dimension | Score | Action |
|---|---|---|---|
| 4 | Inline on /software-can-talk placement | **3/10** | Auto-fix: insertion seam + label change |
| 5 | Inline on project pages placement | **3/10** | Auto-fix: foot before back-section + optional mid-page teaser (taste decision) |
| 3 | Hero left-column visual weight | **4/10** | Auto-fix: monogram + delayed LIVE pulse + subtle blink |
| 6 | Mobile fold regression | **4/10** | Auto-fix: drop chrome on mobile, 3 chips, compact heights |
| 8 | Motion choreography | **4/10** | Auto-fix: chip behavior + fade + sticky chrome spec |
| 2 | Missing states | **5/10** | Auto-fix: `<noscript>`, skeletons, post-stream cursor stop |
| 7 | Accessibility | **6/10** | Auto-fix: a11y label + reduced-motion + focus mgmt |
| 1 | Information hierarchy | **6/10** | Resolved by fixes 3, 4, 5 |

### Locked design decisions (auto-applied to plan)

**1. Insertion point on `/software-can-talk`** — between `</article>` (line 339) and `<section class="article-engagement">` (line 342). Inline variant treated as essay epilogue, not generic widget. Lead-in label: **"Argue with this essay →"** (not "Ask the agent"). Also: **remove the existing `/agent` link** from the closing paragraph of the essay so the embed isn't competing with a duplicate CTA.

**2. Project-page placement** — at the foot, **before** the existing `back-section` element (so the agent is the last meaningful surface, not floating between back-nav and footer). Lead-in label: **"Ask the agent about this project →"**. Per-page chips stay as defined in Architecture §2.

**3. Hero left-column visual weight** (Finding 5 mitigation, concrete spec):
- 72px monogram OR existing logo.svg above the greeting line
- Name treatment unchanged but the existing `-webkit-text-stroke` accent on "A. Rehman" stays as the visual anchor
- **Hold LIVE pulse for 4 seconds after page load** (or until first user interaction). Use `animation-delay: 4s` on the `.ac-hero-live` indicator pulse animation.
- **Cursor blink** uses subtle 1.1s blink (existing `--cyan` blink keyframes), NOT the glow pulse currently on `.hero-agent-cta-dot`

**4. Mobile fold strategy** (375×667):
- Order: greeting → name → role → terminal → desc → CTAs → stats
- Drop terminal chrome (window dots + title bar) below 768px — looks toy-like at small widths
- 3 chips not 4 below 768px (drop "taking consulting work?" — least curiosity-driving on mobile-first traffic)
- Mobile heights: `min-height: 240px; max-height: 50vh` on `.ac-thread`
- LIVE indicator hidden below 768px (visual noise on small screens)

**5. Motion choreography (locked)**:
- **Chip click** = fill input + focus + cursor-at-end. NOT auto-submit. (Two-step intent matches Perplexity/v0 pattern.)
- **First submit** = chip row fades out (200ms opacity → 0) and does not return for the session — chips were scaffolding, not navigation
- **LIVE indicator** stays visible during streaming; after stream completes, pulsing cursor → static `_`
- **Sticky terminal chrome** on hero variant: dots + title + LIVE stay sticky at top of `.ac-hero-frame` when thread scrolls internally beyond max-height
- **Mobile only**: on submit, smooth-scroll terminal into viewport center

**6. Missing-state coverage (locked)**:
- `<noscript>` static card per variant pointing to `/agent` (so JS-disabled users still see the agent exists)
- Skeleton heights: hero 280px, inline-essay 180px, inline-project 180px (matches `client:visible` placeholder before hydration)
- Slow-network signal: if no first token within 2s after submit, show "Connecting…" pre-stream label (extends existing `LoadingState`)
- After stream end: pulsing cursor → static `_`; surface "Ask another →" chip as a single re-engagement affordance

**7. Accessibility (locked)**:
- Visually-hidden label `"AI agent, ready to answer questions"` near each variant root
- Wrap pulsing cursor + glow in `@media (prefers-reduced-motion: no-preference)` (currently the role-cycler does this; agent must too)
- On chip click: `setQuery(chip)` + `inputRef.current?.focus()` + cursor at end of textarea
- Verify chip text contrast (cyan-on-dark) at WCAG AA in CI — add a contrast assertion to existing test or note for manual check

### Taste decisions (locked at final gate — option A)

- **D2-T1 [APPROVED — NO mid-page teaser]**: Project pages get foot-only embed. No mid-page chip-as-link. If post-launch data shows project-page foot conversion is meaningfully lower than essay-foot, reconsider with a mid-page teaser as a follow-up.
- **D2-T2 [APPROVED — "Argue with this essay →"]**: Inline lead-in on `/software-can-talk` reads "Argue with this essay →". Frames the embed as essay continuation, not generic widget.

### Design Phase 2 — Completion Summary

- **Dimensions evaluated**: 8
- **Auto-decided**: 7 dimensions (concrete fixes locked into plan above)
- **Surfaced as taste**: 2 (D2-T1, D2-T2)
- **Required outputs**: scorecard, locked decisions, file insertion seams (line-numbered), motion spec, mobile spec, a11y spec, missing-state spec
- **Files plan now touches** (updated): software-can-talk.astro insertion at line 339-340 boundary; closing-paragraph link removal; project page foot placement before back-section

---

## /autoplan — Phase 3: Eng Review

**Voices**: Claude subagent only (Codex unavailable)

### Eng consensus table

| Dimension | Subagent | Codex | Consensus |
|---|---|---|---|
| 1. Architecture sound? | NO — variant prop forks render tree | N/A | **FLAGGED** — extract primitives |
| 2. Test coverage sufficient? | NO — 14 codepaths, 1 line in plan | N/A | **FLAGGED** — expand test plan |
| 3. Performance risks addressed? | NO — bundle on 4 pages, hydration cost | N/A | **FLAGGED** — lazy-load + measure |
| 4. Security threats covered? | YES — no new attack surface | N/A | confirmed (single voice) |
| 5. Error paths handled? | PARTIAL — 3 surfaces × 1 error UI feels loud | N/A | flagged (low) |
| 6. Deployment risk manageable? | YES — additive, revertable | N/A | confirmed |

Single-voice mode applies — flag every finding.

### Architecture diagram (post-eng-review primitives extraction)

```
src/components/react/
├── AgentChat.tsx          (top-level — variant dispatch + shared state)
│   ├── <AgentChatComposer>  (NEW — textarea, submit btn, chip row)
│   ├── <AgentChatThread>    (NEW — messages + streaming + scroll)
│   ├── <AgentChatHeroFrame> (NEW — terminal chrome + LIVE indicator + delay)
│   └── <AgentChatInlineFrame> (NEW — lead-in label + bordered top edge)
├── agent.css              (existing — add .ac-hero, .ac-inline scopes)
└── AgentChat.test.tsx     (extend — variant matrix tests)

src/lib/
├── agent-ga.ts            (trackQuestionAsked: source REQUIRED, no default)
└── agent-ga.test.ts       (update positional callers)

src/pages/
├── index.astro            (variant=hero, client:idle, with skeleton)
├── agent.astro            (variant=page, unchanged behavior)
├── software-can-talk.astro (insert variant=inline at l. 339-340 boundary)
└── projects/
    ├── kalrav.astro       (insert variant=inline before back-section)
    └── routeeye.astro     (insert variant=inline before back-section)

mcp-server/                (unchanged code; RATE_LIMIT_MAX env bumped at deploy time)
```

### Locked eng decisions (auto-applied to plan)

**E1 (CRITICAL → fix)**: `trackQuestionAsked(query, sessionId, hasHistory, source)` — `source` is **required**, no default. Confirmed: only one caller in production (`AgentChat.tsx:385`), 4 test callers in `agent-ga.test.ts:65,78,124,145` to update. Defaulting silently buckets new placements as `agent-page` — defeats the entire measurement purpose of the plan.

**E2 (HIGH → fix architecture)**: Extract two primitives from `AgentChat.tsx` and use slot composition rather than `{variant === 'hero' && ...}` branches:

- `<AgentChatComposer chips={...} onChipClick={...} onSubmit={...} disabled={...} hasThread={...} />`
- `<AgentChatThread messages={...} streaming={...} onHandoffClick={...} />`

`AgentChat.tsx` becomes a top-level dispatcher: shared state hooks (query/messages/status/abort/sessionId), then conditional rendering of one of three variant wrappers — `<HeroFrame>{composer + thread}</HeroFrame>`, `<InlineFrame>{composer + thread}</InlineFrame>`, or the existing page layout. Each variant wrapper owns its own chrome (window dots, LIVE indicator, lead-in label).

This:
- Stops the render tree forking inside one giant function
- Lets variant-specific state (4s LIVE delay, chip-fade-on-first-submit) live in the wrapper, not in the shared component
- Makes the test matrix tractable (test each primitive independently, then test 3 thin wrappers)

**E3 (HIGH → fix bundle)**: Lazy-load `react-markdown` + `remark-gfm` via `React.lazy`. They are only needed once a streamed response arrives; the empty composer state doesn't render markdown. Wrap `<MarkdownAnswer>` in `<Suspense fallback={<pre>{content}</pre>}>` so during the first stream tokens the user sees a plain `<pre>` block until the markdown chunk loads (typically <50ms).

Also: hydration policy — **`client:idle` on the hero** (above-the-fold, but defers JS until main thread is free), `client:visible` on essay/project foot (below the fold; intersection-trigger). Plan's prior "client:visible everywhere" loses the LCP win on hero because the terminal IS above-the-fold.

**Measurement gate**: before merging, run `npx astro build && du -sb dist/_astro/*.js | sort -rn | head -10` and write the top-10 chunk sizes into the PR description (current vs new). If `/` route bundle grows >25 KB gz post-extraction+lazy-load, revisit (target: <15 KB delta).

**E4 (HIGH → fix CLS)**: Skeleton and rendered component must have matching `min-height`. CSS spec:

```css
.ac-hero-frame {
  min-height: 280px;       /* matches client:idle skeleton */
  max-height: 60vh;
  display: grid;
  grid-template-rows: auto 1fr auto;  /* chrome | thread | composer */
}
@media (max-width: 768px) {
  .ac-hero-frame {
    min-height: 240px;
    max-height: 50vh;
  }
}
.ac-inline-frame {
  min-height: 180px;
  max-height: 480px;
  display: grid;
  grid-template-rows: auto 1fr auto;  /* lead-in | thread | composer */
}
.ac-thread {
  overflow-y: auto;
  scroll-behavior: smooth;
}
```

`aspect-ratio` is wrong (terminal isn't a fixed shape).

**E5 (HIGH → fix iOS keyboard)**: Code spec:

```ts
// In AgentChat.tsx, near other useEffect hooks:
useEffect(() => {
  if (typeof window === 'undefined' || !window.visualViewport) return;
  const vv = window.visualViewport;
  const onResize = () => {
    const ta = textareaRef.current;
    if (!ta || document.activeElement !== ta) return;
    const rect = ta.getBoundingClientRect();
    const overlap = rect.bottom - (vv.height - 24);
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
  };
  vv.addEventListener('resize', onResize);
  return () => vv.removeEventListener('resize', onResize);
}, []);
```

Plus CSS `html { scroll-padding-bottom: env(keyboard-inset-height, 0px); }` as belt-and-braces. Drop the prior "smooth-scroll terminal into viewport center on mobile" — that targets the wrong viewport.

**E6 (MEDIUM → spec)**: `chips={[]}` (empty array) = render no chip row. `chips` prop (omitted/undefined) = use variant default. Document via JSDoc on the prop. Add unit test for both cases.

**E7 (MEDIUM → fix MCP rate limit)**: Bump `RATE_LIMIT_MAX` env var to **20** at deploy. No code change needed (`mcp-server/src/middleware.ts:70` reads from env). Document the bump in the deploy step. Re-evaluate once 28-day post-launch traffic shape is known.

**E8 (MEDIUM → spec noscript)**: Each variant gets a noscript fallback. For hero:

```html
<noscript>
  <div class="ac-noscript-card">
    <strong>Ask the agent →</strong>
    JavaScript disabled. Email instead: <a href="mailto:contact@arjunagiarehman.com">contact@arjunagiarehman.com</a>
  </div>
</noscript>
```

For inline (essay/project), simpler — link to `/agent` plus mailto. CSS gives noscript card the same `min-height` to prevent layout shift.

**E9 (LOW → polish)**: On MCP outage (post-error state in hero variant), swap to a softer "agent's offline · [mailto:contact@arjunagiarehman.com](contact link)" line, omit the `role="alert"` (not appropriate for a global outage on a personal-brand homepage).

### Test diagram + plan

| # | Codepath | Test type | Status | Owner |
|---|---|---|---|---|
| 1 | `variant="hero"` hides header/MCP-inline/footer | unit (RTL) | gap | add to AgentChat.test.tsx |
| 2 | `variant="inline"` hides chrome, shows lead-in label | unit | gap | add |
| 3 | `chips` prop overrides variant defaults | unit | gap | add |
| 4 | `chips={[]}` renders zero chip buttons | unit | gap | add |
| 5 | `chips` undefined → variant default applied | unit | gap | add |
| 6 | `source` arg propagates to `trackQuestionAsked` | unit (mock gtag) | gap | add — assert payload |
| 7 | `source` is REQUIRED (TS compile-time) | typecheck | gap | rely on `astro check` |
| 8 | 4s LIVE-indicator delay in hero | unit (fake timers) | gap | add `vi.useFakeTimers` test |
| 9 | Post-stream pulse cursor → static `_` | unit | gap | add — assert `.ac-stream-cursor` removed |
| 10 | Chip fade-out on first submit, no return in session | unit | gap | add |
| 11 | `<noscript>` card per variant | manual | gap | manual sweep + screenshot |
| 12 | `client:idle` defers JS on hero | Lighthouse / manual | gap | benchmark before/after |
| 13 | iOS keyboard scroll-fix | manual on iOS Safari | gap | manual — Phase 3.5 deploy gate |
| 14 | CLS on hero hydration + first submit | manual / Lighthouse | gap | benchmark |
| 15 | Visually-hidden a11y label per variant | unit | gap | `getByText(/AI agent, ready/i)` |
| 16 | `prefers-reduced-motion` wraps cursor pulse | manual CSS review | gap | review |
| 17 | Empty chips on inline-essay still submittable via input | unit | gap | add |
| 18 | Bundle size delta < 25 KB gz post-merge | CI (manual baseline) | gap | record in PR |
| 19 | MCP rate limit bumped to 20 | deploy step | n/a | env var change |
| 20 | Existing /agent flow unchanged (variant=page) | regression test | partial | extend existing tests |

**Test plan artifact** written to: `~/.gstack/projects/arjunagi-a-rehman-Portfolio/main-eng-review-test-plan-20260430-215332.md`

### Failure modes registry (updated)

| Failure | Cause | User-visible | Mitigation |
|---|---|---|---|
| LCP regression on `/` | full AgentChat bundle ships | slow home | E3: lazy markdown + `client:idle` + size gate |
| CLS on hero | skeleton ≠ rendered min-height | jumpy | E4: matching min-height + grid layout |
| iOS keyboard hides input | scroll targets wrong viewport | unreadable | E5: visualViewport listener + scroll-padding-bottom |
| Silent GA miscount | source defaults to 'agent-page' | wrong analytics | E1: required source arg |
| 429 rate-limit on first impression | NAT+chip-clicker hits 11 reqs | broken UI | E7: bump to 20/min |
| MCP outage paints loud error on hero | error UI dominates first impression | brand hit | E9: softer degraded mode |
| Render-tree fork debt | variant prop branches multiply | maintenance pit | E2: extract primitives |
| JS disabled = empty hero box | placeholder never resolves | layout hole | E8: spec noscript card |

### Eng Phase 3 — Completion Summary

- **Dimensions evaluated**: 6 (architecture, tests, perf, security, errors, deploy) + 11 sub-findings
- **Auto-decided**: 9 of 11 (E1-E9 locked into plan)
- **D3-T1 [APPROVED — lazy-load only]**: Use `React.lazy` on `react-markdown`/`remark-gfm` + `client:idle` on hero. Skip stub-component pattern unless the bundle gate fails (`/` route delta > 25 KB gz post-merge).
- **Test plan**: 20 codepaths, written to `~/.gstack/projects/.../main-eng-review-test-plan-*.md`
- **Bundle gate**: < 25 KB gz delta on `/` route after extraction + lazy-load
- **Architecture diagram**: produced (slot composition replaces variant branching)

