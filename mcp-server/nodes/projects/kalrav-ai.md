---
id: kalrav-ai
title: "Kalrav.AI — E-commerce AI Agent Platform"
source: project
url: /projects/kalrav
date: "2024-10-15"
tags:
  - ai-agents
  - e-commerce
  - vertical-ai
  - shopify
  - woocommerce
  - google-adk
  - multi-tenant
  - fastapi
summary: "Built Kalrav.AI, a vertical AI agent platform serving 10+ live e-commerce customers with WordPress, Shopify, and WooCommerce integrations, no-code agent builder, and CRM connectivity."
---

## What is Kalrav.AI?

Kalrav.AI is an enterprise AI agent platform I built for e-commerce operators. The core idea: instead of asking a store owner to integrate with a generic LLM playground, give them an agent that already knows their stack — WooCommerce product catalog, Shopify order data, WordPress admin flow.

The platform serves 10+ live customers including VarCapital and Handmade Earth, running 24/7 intelligent customer conversations.

## Why vertical over horizontal?

The insight that drove the architecture: domain embedding beats model quality for most business workflows. A horizontally generic assistant doesn't know the difference between a product variant and a product category. Kalrav does. That's the moat.

Every integration is purpose-built:
- **WordPress Plugin** — one-click install from the WP dashboard, zero code required
- **WooCommerce** — product search, order tracking, cart assistance wired directly to store data
- **Shopify App** — native app, auto-syncs catalog and customer data
- **NPM Package** (`@irisidea/kalrav-ai`) — embed in any JS app, framework-agnostic

## Architecture decisions

I used **Google ADK** for the agent orchestration layer and **FastAPI** for the backend API. Multi-tenant infrastructure means each customer's agent is logically isolated but running on shared compute — that's the only way to keep costs low enough for SMB customers.

The centralized dashboard was the hardest product problem: operators need to configure, monitor, and tune all their deployed agents without writing code. Built that on top of a visual agent-builder that compiles down to ADK agent configs at deploy time.

**CRM connectivity** to Zoho and Salesforce means the agent doesn't just answer questions — it logs conversations, flags high-intent users, and routes escalations.

## What I learned

Vertical AI wins at the workflow layer because your agent is specifically-right, not generally-capable. For the next two years, the real bottleneck is domain embedding. That's the distribution bet behind Kalrav.

The unexpected hard part wasn't the AI — it was multi-tenant session isolation and making sure customer A's conversation history never bled into customer B's context. Got that wrong once in staging. Only once.
