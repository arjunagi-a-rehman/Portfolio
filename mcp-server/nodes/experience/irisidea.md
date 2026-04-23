---
id: experience-irisidea
title: "Irisidea TechSolutions — The Architect-Not-Just-Lead Arc"
source: experience
url: /about
date: "2023-06-01"
tags:
  - irisidea
  - architect
  - lead-engineer
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
  - field-engineer
summary: "Irisidea TechSolutions since 2023 — the title on paper was Lead Engineer, the actual role was architect + product vision + client-facing + field engineer. Shipped three 0→1 production builds: Kalrav.AI (vertical AI for e-commerce, 10+ customers), RouteEye (real-time fleet at BIAL — went on-ground multiple times to debug real-world signal issues), and Wisp (IoT safety hardware + mobile app + backend). Currently carved-out time around Jano Health."
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

An AI agent platform I built for e-commerce operators. Multi-tenant, multi-platform (WordPress, Shopify, WooCommerce), 10+ live customers running 24/7 customer conversations. Google ADK for orchestration, FastAPI backend, no-code agent builder with CRM connectivity to Zoho and Salesforce.

The architectural bet: domain embedding beats model quality. A generic chatbot doesn't know the difference between a product variant and a product category. Kalrav does, because it's wired directly into each commerce platform's schema. That specificity is the moat.

Every integration is purpose-built:
- **WordPress Plugin** — one-click install from the WP dashboard, zero code required
- **WooCommerce** — product search, order tracking, cart assistance wired directly to store data
- **Shopify App** — native app, auto-syncs catalog and customer data
- **NPM Package** — embed in any JS app, framework-agnostic

The hardest product problem was the centralized dashboard. Operators need to configure, monitor, and tune all their deployed agents without writing code. Built that on top of a visual agent-builder that compiles down to ADK agent configs at deploy time.

The unexpected hard part wasn't the AI — it was multi-tenant session isolation and making sure customer A's conversation history never bled into customer B's context. Got that wrong once in staging. Only once.

This is the project I'm most proud of from Irisidea. Full deep-dive in the `kalrav-ai` node.

### RouteEye — the real-time systems arc

Principal architect + team lead. Two years from blank repo to production. Live at Bangalore International Airport (BIAL) tracking staff shuttles 24/7. Four engineers under me.

This is the project where I spent the most hours on the ground, not just in a repo. Real-time IoT systems fail in ways that don't reproduce on a laptop. Signal drops in specific parts of the airport, GPS multipath near metal structures, radio interference from the airport's own equipment, WiFi handoff behavior in moving vehicles. You can't debug any of that from Bangalore office wifi. Multiple trips to BIAL to watch real shuttle runs, read logs live, tune the ingest pipeline against actual traffic. The "field engineer" part of the role earned its keep here.

What shipped:

- **Vehicles → AWS IoT Core (MQTT)** — managed ingest, auto-scales with fleet size
- **Go device service** — validates, enriches, persists to PostgreSQL
- **Redis pub/sub** — decouples writes from reads, one publisher many subscribers
- **Go SSE service** — subscribes to Redis channels, streams to dashboard clients
- **PostgreSQL** — partitioned tables for telemetry, indexed for replay queries
- **React dashboard** — live maps, alerts, replay, analytics

Core tension: designed for high-frequency IoT writes without degrading read latency on live dashboards. 5-second telemetry intervals, sub-second dashboard updates.

Four engineering lessons from RouteEye:

- **Start monolith, split when the seams hurt.** We started as one Go service and split into four microservices only when deploy cycles and team parallelism demanded it. Splitting earlier would have bought us nothing except operational complexity.
- **SSE beats WebSockets for one-way push.** Simpler protocol, plays nice with HTTP/2, survives through proxies. WebSockets are overkill when you only need server → client.
- **Go is the right call for high-frequency IoT.** Goroutines for per-connection state, channels for in-process pub/sub, low memory per connection. Could have done it in Node or Python — it would have been more expensive per message and harder to debug under load.
- **The unsexy wins matter most.** Postgres partitioning by time, connection pooling tuned for the actual workload, Redis memory tuned to drop stale messages on lag. That's the 80% that keeps production up.

The architecture-diagram stuff is table-stakes; the field engineering is where the product actually gets built. Full details in the `routeeye` node.

### Wisp — the hardware + mobile + backend arc

0→1 Tech Lead. Drink-spiking prevention platform — a handheld near-infrared spectroscopy wand + a mobile app + AWS backend + SOS dispatch with live location sharing. Under 3 seconds from tap-scan to result on the phone.

Architecture:

- **WiSPer wand** — portable (fits on a keychain), NIR spectroscopy sensor array, BLE 5.0 radio
- **Mobile app (React Native)** — pairs with wand, shows scan results, one-tap SOS
- **Go REST APIs** — device registration, scan ingestion, SOS dispatch, location sharing
- **AWS IoT Core** — device-to-cloud message ingestion
- **AWS Lambda** — event-driven alert processing, SMS/push dispatch via SNS
- **RDS PostgreSQL** — user data, device registry, scan history
- **GitLab CI/CD** — zero-downtime deployments across staging and prod

The SOS path shaped the whole design. Safety products have one non-negotiable: the SOS path must be faster and more reliable than everything else. Alert processing is Lambda because cold starts are acceptable for SOS (a few hundred ms), but the path has no shared state — one failing instance can't cascade into the alert pipeline.

Scan ingestion is the hot path. Under 3 seconds from "tap scan" on the wand to "result shown" on the phone. That meant keeping the round-trip local where possible — the wand runs its own detection model and only phones home with the result, not the raw sensor data.

Three lessons from Wisp that transfer to any cross-disciplinary hardware build:

- **One shared vocabulary across hardware, software, and backend teams.** We had three different meanings for "scan" in week one. Spent a full day writing one shared glossary. Best time investment of the project.
- **IoT fleets die from firmware update bugs.** We set up OTA updates with staged rollouts (1% → 10% → 100%) before shipping the first device. A bad firmware push to a bricked device is a customer lost forever.
- **BLE is harder than it looks.** Pairing UX, reconnection after sleep, GATT quirks across iOS/Android — spent more debug hours on BLE than on the entire cloud stack.

Full details in the `wisp` node.

## Cross-cutting lessons from the Irisidea arc

Three things I keep doing because they keep working:

**1. Ship early, measure, iterate in production.** I'd rather have a rough thing live with 10 users than a polished thing in staging with 0. Every major insight in Kalrav/RouteEye/Wisp came from production, not from planning docs.

**2. Small teams work.** All three products shipped with 2-4 engineers including me. Communication overhead stays near zero. Everyone owns outcomes. This is the "coders to owners" thesis in practice before I wrote the essay.

**3. Vertical first, horizontal later.** Generic platforms are tempting but hard to sell. Kalrav is e-commerce-first. RouteEye is airport-first. Wisp is spectroscopy-first. Specificity wins at the SMB layer.

**4. Own the whole path, not just the code.** The most expensive Irisidea lessons were the ones you can't learn from a PR. Sitting with a client who's frustrated. Watching a real shuttle miss a GPS fix. Walking the terminal with a device in hand. The code's output is not the product — the product is whatever actually works in the customer's environment.
