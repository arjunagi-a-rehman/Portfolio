---
id: wisp
title: "Wisp — Drink-Spiking Prevention Platform"
source: project
url: /projects/wisp
date: "2024-06-20"
tags:
  - iot
  - hardware
  - spectroscopy
  - ble
  - safety
  - go
  - aws-lambda
  - mobile
  - react-native
summary: "0→1 build: tech-led Wisp from blank repo to production — a safety platform combining a handheld near-infrared spectroscopy wand (WiSPer) with a mobile app for sub-3-second drink-spike detection and one-tap SOS alerts with live location sharing."
---

## What is Wisp?

Wisp is a safety platform I led as Tech Lead at Irisidea. Two parts: the WiSPer wand — a handheld near-infrared spectroscopy device that reads the chemical composition of a drink — and a mobile app that pairs with it over BLE 5.0, shows scan results in under 3 seconds, and fires SOS alerts to trusted contacts if something's wrong.

0→1 build. I co-designed the full system, from embedded firmware communication to cloud pipelines, working directly with stakeholders on roadmap.

## Architecture

- **WiSPer wand** — portable (fits on a keychain), NIR spectroscopy sensor array, BLE 5.0 radio
- **Mobile app (React Native)** — pairs with wand, shows scan results, one-tap SOS
- **Go REST APIs** — device registration, scan ingestion, SOS dispatch, location sharing
- **AWS IoT Core** — device-to-cloud message ingestion
- **AWS Lambda** — event-driven alert processing, SMS/push dispatch via SNS
- **RDS PostgreSQL** — user data, device registry, scan history
- **GitLab CI/CD** — zero-downtime deployments across staging and prod

## Why this architecture

Safety products have one non-negotiable: the SOS path must be faster and more reliable than everything else. That shaped the whole stack. Alert processing is Lambda because cold starts are acceptable for SOS (a few hundred ms), but the path has no shared state — one failing instance can't cascade into the alert pipeline.

Scan ingestion is the hot path. Under 3 seconds from "tap scan" on the wand to "result shown" on the phone. That meant keeping the round-trip local where possible — the wand runs its own detection model and only phones home with the result, not the raw sensor data.

## What I learned

Hardware + software + backend teams need one shared vocabulary. We had three different meanings for "scan" in week one. Spent a full day writing one shared glossary. Best time investment of the project.

IoT fleets die from firmware update bugs. We set up OTA updates with staged rollouts (1% → 10% → 100%) before shipping the first device. A bad firmware push to a bricked device is a customer lost forever.

BLE is harder than it looks. Pairing UX, reconnection after sleep, GATT quirks across iOS/Android — spent more debug hours on BLE than on the cloud stack.
