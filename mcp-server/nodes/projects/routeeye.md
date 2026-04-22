---
id: routeeye
title: "RouteEye — Real-Time Fleet Management at BIAL"
source: project
url: /projects/routeeye
date: "2024-01-10"
tags:
  - iot
  - real-time
  - go
  - aws-iot-core
  - mqtt
  - redis
  - sse
  - postgresql
  - microservices
  - fleet-management
summary: "Led RouteEye from blank repo to production over 2 years — a high-frequency fleet platform processing 5-second vehicle telemetry via AWS IoT Core, Go microservices, Redis pub/sub, and Server-Sent Events. Live at Bangalore International Airport (BIAL) tracking staff shuttles."
---

## What is RouteEye?

RouteEye is a fleet management platform I built and led as principal architect. Two years from first commit to production. Live at Bangalore International Airport (BIAL) tracking staff shuttles 24/7. Team of four engineers under me.

Vehicle IoT devices push telemetry every 5 seconds. The platform ingests, processes, routes, and displays it on operator dashboards in sub-second latency. Plus a real-time alert engine on 9000+ event types.

## The core tension

Building for high-frequency IoT writes without degrading read latency on live map dashboards. Naive approaches fail — either writes block the read path, or the cache gets stale, or SSE connections pile up until the process dies.

The architecture that works:

- **Vehicles → AWS IoT Core (MQTT)** — managed ingest, auto-scales with fleet size
- **Go device service** — validates, enriches, persists to PostgreSQL
- **Redis pub/sub** — decouples writes from reads, one publisher many subscribers
- **Go SSE service** — subscribes to Redis channels, streams to dashboard clients
- **PostgreSQL** — partitioned tables for telemetry, indexed for replay queries
- **React dashboard** — live maps, alerts, replay, analytics

## What I learned

Start monolith, split when the seams hurt. We started as one Go service and split into four microservices only when deploy cycles and team parallelism demanded it. Splitting earlier would have bought us nothing except operational complexity.

SSE beats WebSockets for one-way push. Simpler protocol, plays nice with HTTP/2, survives through proxies. WebSockets are overkill when you only need server → client.

Go is the right call for high-frequency IoT. Goroutines for per-connection state, channels for in-process pub/sub, low memory per connection. Could have done it in Node or Python — it would have been more expensive per message and harder to debug under load.

The unsexy wins: Postgres partitioning on time, connection pooling tuned for the actual workload, Redis memory tuned to drop stale messages on lag. That's the 80% that keeps production up.
