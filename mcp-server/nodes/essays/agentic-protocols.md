---
id: essay-agentic-protocols
title: "The Agentic Internet: MCP, A2A, UCP, and Why You Should Build Now"
source: essay
url: /cli-to-ai
date: "2026-02-10"
tags:
  - ai-agents
  - protocols
  - mcp
  - a2a
  - ucp
  - function-calling
  - opinions
  - future
  - agent-economy
  - standards
summary: "A take on the protocol layer being built under our feet right now — MCP (models ↔ tools), A2A (agents ↔ agents), UCP (agents ↔ commerce), function calling (APIs → tools). AI isn't just generating text anymore. It's starting to act. The standards are still being written, which is exactly why builders should ship now."
---

## The protocol layer

Every week there's a new standard for how AI agents connect to the world. Not features — **protocols**. That distinction matters:

- **MCP** (Model Context Protocol) — models connecting to tools. Anthropic's spec. How an LLM discovers and calls external capabilities through a uniform interface.
- **A2A** (Agent-to-Agent) — agents talking to other agents. Google's push for multi-agent interoperability.
- **UCP** (Universal Commerce Protocol) — agents transacting with merchants. One discovery URL, and any agent can browse, authenticate, checkout, track orders. I built the reference stack.
- **Function calling** — turning any REST API into a callable tool the model can reason about.

These are the agentic internet's equivalent of HTTP, OAuth, OpenAPI. The plumbing.

## What makes this moment different

AI isn't just generating text anymore. It's starting to **act**. A user can hand an agent one URL and walk away — the agent discovers capabilities, authenticates, browses, decides, transacts, reports. No SDKs per service. No custom integrations per merchant. Just the protocol.

I felt this directly when I built the UCP stack — merchant API, demo store with real Razorpay payments, shopping agent on Gemini 2.0 Flash. The agent has zero store-specific code. Point it at `/.well-known/ucp`, and it figures out the rest. That's the pattern the whole agent economy is moving toward.

## What I learned building at this layer

A few concrete principles from actually shipping agent-first infrastructure:

- **APIs need to guide agents.** `next_actions` in responses matter a lot. Every response tells the agent what to call next — endpoint, method, required fields, example payload. Self-documenting APIs go from nice-to-have to required.
- **Errors should tell the agent what to do next.** Not "400 Bad Request." More like: "missing buyer.email — call POST /checkout/update with this field, see example: `{...}`."
- **OAuth for agents needs different patterns.** The user signs in in a browser; the agent polls `/agent/session/{id}` for the token. No browser automation, no screen scraping. A specific flow for a specific client type.
- **The protocol layer should stay thin.** The UCP merchant API in my stack is a reference implementation that proxies to an existing storefront's API routes. Zero database dependencies in the protocol layer itself. That's the whole point — it's a translation layer, not a new system.

## Why build now

The standards are still being written. That's a window, not a warning. Builders who ship against draft specs — and give feedback — shape what the final spec looks like. Wait until it's "stable" and you're an implementer of someone else's decisions.

This is exactly what happened with HTTP, OAuth, MCP already. The people building at the protocol layer in 2026 are shaping how agents will talk to the world for the next decade.

If you're a developer: pick one of these — MCP, A2A, UCP, or a domain-specific equivalent — and ship something real against it. Not a demo, a live service. Open-source it. You'll learn more about agent architecture in six weeks of shipping than six months of reading posts about it.

## The bigger pattern

This sits on top of the CLI→GUI→AI layering argument. CLI became invisible infrastructure under GUIs. GUIs are becoming invisible infrastructure under natural-language agents. And the agentic protocols (MCP, A2A, UCP) are the new plumbing — the HTTP-equivalent of the agent era.

The full stack is present: natural language at the top, GUI in the middle, CLI at the bottom, and now agentic protocols as the connective tissue between every layer.
