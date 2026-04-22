---
id: ucp
title: "UCP — Universal Commerce Protocol Stack"
source: project
url: https://github.com/arjunagi-a-rehman/ucp-agent
date: "2026-04-13"
tags:
  - ai-agents
  - commerce
  - open-protocol
  - google-adk
  - gemini
  - fastapi
  - nextjs
  - firebase
  - razorpay
  - oauth
summary: "Built a 3-repo reference stack for the Universal Commerce Protocol (UCP) — an open standard letting any AI agent discover and transact with online merchants from one URL. Shipped the merchant API (FastAPI), a demo storefront (Next.js + Firebase + Razorpay), and a Google ADK + Gemini shopping agent, all live in production."
---

## What is UCP?

UCP (Universal Commerce Protocol, ucp.dev) is an open spec that lets AI agents discover, authenticate, and transact with online merchants using one discovery URL. No SDKs, no per-store plugins — an agent finds `/.well-known/ucp`, reads the manifest, and knows how to browse, sign in, checkout, and track orders.

I built the full reference stack across three repos. All three are live:

- **UCP Merchant API** (FastAPI) — ucp.c0a1.in
- **UCP Demo Store** (Next.js + Firebase + Razorpay) — ucp-demo-1f0cf.web.app
- **UCP Shopping Agent** (Google ADK + Gemini 2.0 Flash) — deployed on Cloud Run

## Why this matters

Today every AI agent that wants to shop needs a per-store integration. That doesn't scale. The web solved this for browsers with HTML + HTTP; commerce needs the same thing for agents. UCP is that thing.

Give the discovery URL to any agent that can make HTTP calls — Claude, ChatGPT with function calling, Cursor, whatever — and it figures out how to shop. No store-specific code. That's the whole bet.

## The spec, honored

The merchant API is verified against the official UCP spec:

- **Discovery** (`/.well-known/ucp`) — RFC 8615 manifest with flows, endpoints, field mappings, OAuth config
- **Checkout state machine** — `incomplete → ready_for_complete → complete`, exact spec match
- **OAuth 2.0 identity linking** — authorization code flow with an **agent polling pattern**: the user signs in in a browser, the agent polls `/agent/session/{id}` for the token. No browser automation required.
- **Bearer token auth** — JWT HS256 for protected endpoints
- **Line items + buyer info schemas** — exact spec match

## Enhancements beyond spec

A few things I added that aren't in the spec but make agents better behaved:

- **`next_actions` in every response** — each checkout/order response tells the agent exactly what to call next: endpoint, method, required fields, example payload. Self-documenting.
- **Actionable error messages** — errors carry `action`, `steps`, and `discovery_url` so agents self-recover
- **Machine-readable flow definitions** — discovery endpoint includes full flow graphs with field mappings (`maps_to: "product.id"`)

## The agent side

The shopping agent is Google ADK + Gemini 2.0 Flash. It has **zero store-specific code**. Ten tools: identity linking (3), browsing (1), checkout (4), order tracking (2). All flow through the UCP merchant API. Drop the discovery URL in, any UCP-compliant merchant works.

## What I learned

The three-sided nature is the point: spec compliance gives agents trust, spec-beyond enhancements give agents ergonomics, protocol-layer design gives merchants a way in without rewriting their backends. The merchant is a thin proxy over the storefront's existing API routes — zero database dependencies in the UCP layer itself.

If UCP (or something like it) becomes standard, 2026's "AI shopping" stops being a per-integration gold rush and starts being a protocol-layer play. I built the reference stack to bet on that future.
