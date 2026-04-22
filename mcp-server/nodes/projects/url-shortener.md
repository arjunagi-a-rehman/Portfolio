---
id: url-shortener
title: "c0a1.in — Production URL Shortener on a Single Monolith"
source: project
url: https://c0a1.in/
date: "2025-10-29"
tags:
  - java
  - spring-boot
  - mongodb
  - rest-api
  - swagger
  - docker
  - jib
  - analytics
  - geoip
  - monolith
  - dokploy
  - production
  - kalrav-ai
  - performance
summary: "c0a1.in — a production URL shortener built as a single Spring Boot monolith handling 1,000+ req/s with p99 under 150ms. No Kubernetes, no service mesh. Click analytics with GeoIP, Murmur3 short codes, Jib Docker builds, Kalrav.AI conversational layer, deployed on Hostinger VPS via Dokploy. Open-source."
---

## What it is

c0a1.in is a production URL shortener I built end-to-end. Spring Boot + MongoDB. Live. Open-source. 1,000+ requests per second on a single monolithic service. No Kubernetes, no service mesh, no event bus.

The thesis behind it: **simplicity still scales**. Not everything needs to start as a distributed system.

## Production performance

Tested under realistic load with a public test script (c0a1.in/s/3a3f1232). Zero errors across all runs.

| Workload | Throughput | Avg latency | p99 |
| --- | --- | --- | --- |
| Baseline | 87.8 req/s | 46 ms | 146 ms |
| Medium load | 330.9 req/s | 63 ms | 241 ms |
| High load | 326.9 req/s | 126 ms | 445 ms |
| Redirect (hot path) | 347.5 req/s | 34 ms | 77 ms |

Good p99 numbers on a single Spring Boot JVM with Mongo as the store. The redirect path is the hot path and it runs at ~34ms average because it's heavily cached.

## Stack

- **Spring Boot** — web framework, single monolithic service
- **MongoDB** — URL records + click analytics, partitioned by URL and day
- **Swagger (OpenAPI)** — interactive API docs
- **Lombok** — kills Java boilerplate
- **Murmur3 32-bit hash** — fast non-cryptographic short-code generation
- **Jib** — builds Docker images directly from Maven, no Dockerfile
- **GeoIP service** — async geographic lookup for click analytics
- **Kalrav.AI agent** — conversational interface over the REST API

## Kalrav.AI conversational layer

I plugged a Kalrav.AI agent into the app. Users don't need to click through the UI anymore — they paste a long URL, the agent detects it, asks if they want to shorten it, and returns the short link. All through conversation.

Integration was a few lines of code. That's the whole pitch: take any traditional web app and make it conversational with near-zero effort. This is why I care so much about vertical agents — the integration surface is the product.

## Analytics features

Every click is tracked with:

- Click totals — overall + unique users
- Geographic breakdown — country, region, city via GeoIP
- Referrer — where the click came from
- User agent — browser / device
- Per-day time series — daily click counts for trendlines

GeoIP lookups are async. Synchronous geo on the redirect path would add 50-100ms to every click. Fire-and-forget into a queue, aggregate offline.

## Deployment

Hostinger VPS + **Dokploy** (open-source deployment platform). One Dockerfile, one command — SSL, logs, monitoring, zero-downtime deploys all included. Dokploy is the self-hosted alternative to Vercel/Heroku/Render for the VPS crowd. Cheap, fast, works.

## Why Murmur3 for short codes

Fast, non-crypto, good distribution. Perfect for short deterministic codes. Collisions are rare; when they happen, you rehash with a salt. Cryptographic hashes (SHA-256) are overkill for this job and slower.

## Why Jib over Dockerfile

Jib builds a reproducible, multi-layered image from Maven without a local Docker daemon or Dockerfile. Perfect for CI. One `./mvnw jib:build` and you have a registry-ready image with optimal layer caching. Don't write Dockerfiles for JVM apps if Jib covers the 90% case.

## What I learned

Not everything needs to start as a distributed system. Clean architecture + caching + async analytics + good database design lets a single Java monolith comfortably handle 4-digit req/s. Microservices too early is the most common premature optimization in backend engineering.

The conversational layer is underrated. A REST API with good docs is already halfway to being an agent interface. Plug a domain-specific agent on top and you get chat UX without building chat UX.

Analytics tables grow fast. Partition early — by URL-and-day on MongoDB in this case — and aggregation stays sub-100ms at millions of rows. Retrofit partitioning is painful.
