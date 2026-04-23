---
id: experience-irisidea
title: "Irisidea TechSolutions — The Architect-Not-Just-Lead Arc"
source: experience
url: /about
date: "2023-06-01"
tags:
  - irisidea
  - architect
  - kalrav-ai
  - routeeye
  - wisp
  - ai-agents
  - iot
  - real-time
  - hardware
  - bial
  - 0-to-1
  - ownership
  - client-facing
  - product-vision
summary: "Irisidea TechSolutions since 2023 — the title on paper was Lead Engineer, the actual role was architect + product + client-facing + field engineer. Shipped three 0→1 production builds: Kalrav.AI, RouteEye (live at BIAL, went on-ground multiple times to debug), and Wisp (IoT safety). Currently carved-out time around Jano Health."
---

I've been at Irisidea TechSolutions since 2023. HR called the role "Lead Engineer" — that's the smallest honest description of what I did there. In practice the role was four things at once:

- **Architect.** System design across three very different products (AI agents, real-time IoT telemetry, hardware + mobile). Not just writing code in someone else's architecture — drawing the architecture.
- **Product.** Sat with management on product vision. What we build next, what we say no to, how the roadmap aligns with what customers actually want.
- **Client-facing.** Handled customer conversations directly. No PM intermediary, no account manager layer — if a customer had a technical question or a deployment concern, I was the one they talked to.
- **Field engineer.** Multiple times went on-ground at BIAL during RouteEye deployment to fix issues, observe behavior, debug what was happening at the actual airport site. The cleanest architecture diagrams break down when real hardware meets real airport WiFi.

I don't care about titles. I care about what's being shipped and who owns the consequences. All four were mine at Irisidea.

Status note: full-time primary focus has shifted to Jano Health. Irisidea time is carved-out around that now, but the work I've shipped there is a big part of what this agent answers questions about.

## Three shipped builds define the Irisidea arc

### Kalrav.AI — the vertical-AI bet

AI agent platform for e-commerce operators. Multi-tenant, multi-platform (WordPress, Shopify, WooCommerce), 10+ live customers running 24/7 customer conversations. Google ADK for orchestration, FastAPI backend, no-code agent builder, CRM connectivity to Zoho and Salesforce.

The architectural bet: domain embedding beats model quality. A generic chatbot doesn't know the difference between a product variant and a product category. Kalrav does, because it's wired directly into each commerce platform's schema. That specificity is the moat.

Full deep-dive in the `kalrav-ai` node.

### RouteEye — the real-time systems arc

Two years from blank repo to production. Live at Bangalore International Airport (BIAL) tracking staff shuttles 24/7. Four engineers under me.

This is the project where I spent the most hours on the ground, not just in a repo. Real-time IoT systems fail in ways that don't reproduce on a laptop. Signal drops in specific parts of the airport, GPS multipath near metal structures, radio interference from the airport's own equipment, WiFi handoff behavior in moving vehicles. You can't debug any of that from Bangalore office wifi. Multiple trips to BIAL to watch real shuttle runs, read logs live, tune the ingest pipeline against actual traffic.

What shipped:

- Monolith-first, split into microservices only when seams hurt
- SSE over WebSockets for one-way push (simpler protocol, plays nice with HTTP/2)
- Go goroutines + channels for high-frequency IoT ingest (low memory per connection, clean backpressure)
- Postgres partitioning by time, connection pooling tuned for actual workload, Redis memory tuned to drop stale messages on lag

The unsexy wins are what keep production up. The architecture-diagram stuff is table-stakes; the field engineering is where the product actually gets built.

Full details in the `routeeye` node.

### Wisp — the hardware + mobile + backend arc

0→1 Tech Lead. Drink-spiking prevention platform: a handheld near-infrared spectroscopy wand + a mobile app + AWS backend + SOS dispatch with live location sharing. Under 3 seconds from tap-scan to result.

Cross-disciplinary build. Hardware team, mobile team, backend team — three different vocabularies for the same concepts. Spent a full day in week one writing a shared glossary. Best time investment of the project.

Other lessons:

- **IoT fleets die from firmware update bugs.** Staged OTA rollouts (1% → 10% → 100%) before shipping the first device.
- **BLE is harder than it looks.** More debug hours on BLE reliability than on the entire cloud stack.

Full details in the `wisp` node.

## Cross-cutting — what worked across all three

**Ship early, measure, iterate in production.** Every real insight in Kalrav / RouteEye / Wisp came from production, not from planning docs. Rough thing live with 10 users > polished thing in staging with 0.

**Small teams work.** All three products shipped with 2-4 engineers including me. Communication overhead stays near zero. Everyone owns outcomes. The "coders to owners" thesis is basically a transcript of how we ran things at Irisidea.

**Vertical first, horizontal later.** Kalrav is e-commerce-first. RouteEye is airport-first. Wisp is spectroscopy-first. Specificity wins at the SMB layer.

**Own the whole path, not just the code.** The most expensive Irisidea lessons were the ones you can't learn from a PR. Sitting with a client who's frustrated. Watching a real shuttle miss a GPS fix. Walking the terminal with a device in hand. The code's output is not the product — the product is whatever actually works in the customer's environment.
