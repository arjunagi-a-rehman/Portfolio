---
id: essay-simplicity-scales
title: "Simplicity Still Scales: Build the Monolith, Measure the Monolith"
source: essay
url: https://c0a1.in/
date: "2025-10-29"
tags:
  - architecture
  - monolith
  - microservices
  - scaling
  - simplicity
  - premature-optimization
  - production
  - opinions
  - spring-boot
summary: "A take on why most backend engineers overcomplicate too early. Shipped a Spring Boot monolith that handles 1,000+ req/s — no Kubernetes, no service mesh, no queues — with p99 under 150ms. Not everything needs to be a distributed system on day one."
---

## The thesis

We overcomplicate things — microservices, queues, layers, meshes — even for problems that don't need any of it. The real edge is usually the opposite: build the simplest thing that actually works, measure it, only add complexity when a specific number forces you to.

I tested this directly by building c0a1.in, a URL shortener shipped as a single Spring Boot monolith. 1,000+ requests per second. Zero errors. Good p99. No Kubernetes, no service mesh, no event bus.

## The numbers

Measured under realistic load:

- Baseline: 87.8 req/s, avg 46ms, p99 146ms
- Medium load: 330.9 req/s, avg 63ms, p99 241ms
- High load: 326.9 req/s, avg 126ms, p99 445ms
- Redirect (hot path): 347.5 req/s, avg 34ms, p99 77ms

Zero errors across all runs. On one JVM. With MongoDB. On a Hostinger VPS.

## What I actually did instead of "go distributed"

- **Clean architecture.** Separation of concerns matters more than service boundaries at this scale.
- **Caching.** The redirect path is 90% of traffic and it's cached hard. That's why it runs at ~34ms average.
- **Async analytics.** Geo lookups, click tracking, referrer parsing — all fire-and-forget into a queue inside the same process. The user's redirect doesn't wait on any of it.
- **Good schema design.** Partitioned MongoDB collections by URL-and-day. Aggregation stays sub-100ms at millions of rows.
- **Jib for Docker.** No Dockerfile. Reproducible images straight from Maven.

## The principle

Most backend engineers ship microservices before they've ever measured their monolith. That's backwards.

A monolith with disciplined caching, async work offloaded inside the process, and a decent database schema will take you to 4-digit req/s without anything exotic. That's enough throughput for 99% of SaaS apps that are actually shipping.

Microservices are a response to specific problems: team parallelism, independent deploy cycles, heterogeneous scaling needs. If you don't have those problems yet, you're paying the cost of a solution you don't need — operational complexity, network hops, distributed debugging, cascading failures.

## Where this fits in the bigger picture

This connects to what I believe about engineering more broadly: judgment beats execution. The engineer who ships a performant monolith in a week and can defend the decision with real numbers is more valuable than the one who ships the same workload across six services over six months. AI makes both possible now — which means the only differentiator left is taste. Knowing what NOT to build.

Simplicity isn't a phase you grow out of. It's a constraint you earn the right to break.
