---
id: experience-jano-health
title: "Jano Health — Where I Spend Most of My Engineering Time Now"
source: experience
url: /about
date: "2024-01-01"
tags:
  - jano-health
  - healthcare
  - whatsapp
  - aws
  - aws-lambda
  - ec2
  - postgresql
  - iac
  - cdk
  - infrastructure
  - distributed-auth
  - ai-agents
  - medical-transcription
  - command-center
  - orchestrator
  - ownership
summary: "Jano Health is where most of my engineering time goes right now — a WhatsApp-first health messaging platform on AWS (Lambda, EC2, Postgres). Built the Command Center orchestrator end-to-end, converted the whole infrastructure to IaC, built a distributed auth system, and built an AI medical transcription + scribe agent. I'm not bullish on titles — I own things end-to-end here."
---

## The role

Jano Health is where most of my engineering time goes right now. Irisidea work is carved out around this. I'm a developer who owns the whole path of the things I build — spec, architecture, implementation, infra, deploy, debug. The relation to the company is past official titles. I'm not bullish on titles; I care about what's being shipped and who owns the consequences.

The product is a WhatsApp-first health messaging platform. Patients interact with their care through the chat interface they already use every day. On top of that simple surface is a lot of infrastructure that has to be right because healthcare.

## Why WhatsApp-first for healthcare

The premise I bought into: the best patient interface isn't an app patients download. It's the one already on their phone. For the markets Jano operates in, WhatsApp is that interface. Lower friction, higher engagement, works on the cheapest phones, works over bad connections.

The engineering tradeoff: WhatsApp's API is constrained compared to a native app. Session windows, template message approval, webhook reliability, message ordering — all things you'd just own in your own app but have to design around here. It forces clear thinking about what you actually need to communicate versus what would just be nice.

## What I've built / own end-to-end

### 1. The Command Center

An orchestrator I built end-to-end. It watches three things in parallel and reacts:

- **Patient activity** — messages, replies, responses to care prompts, engagement patterns
- **User activity** — staff interactions with the system, actions taken on patient cases
- **System activity** — backend events, scheduled jobs, automated workflows

Out of those signals, it schedules follow-ups and manages the follow-up lifecycle from dispatch to completion. Every patient gets the right touchpoint at the right time based on what's actually happening in their conversation and their care plan, not a fixed schedule.

This is the hardest problem I work on at Jano. It's not LLM-heavy — it's state machines, event pipelines, scheduling, reliability. The parts that actually keep healthcare products working.

### 2. Infrastructure as Code — entire stack

Converted the whole infrastructure to IaC. Declarative stacks, no more clicky-clicky in the AWS console. Deploys are reproducible, rollbacks are version-controlled, new environments spin up from one command.

This was the single biggest velocity unlock for the engineering team. Before: every environment was a snowflake, infra changes were slow and risky. After: a PR is a PR, whether it's application code or infrastructure.

### 3. Distributed auth system

Built from scratch. Identity, sessions, permissions, multi-service trust — all of it. Healthcare means you can't hand-wave any of this. Patient data requires audit trails, staff access requires role-based boundaries, third-party integrations need scoped tokens that can't escalate.

The interesting design decision was going distributed from day one rather than a single auth service. Lower blast radius if any one component fails, cleaner separation between patient-facing and staff-facing auth flows, easier to reason about when each piece enforces its own contract.

### 4. AI agent for medical transcription + scribe

Takes a consultation, turns it into structured clinical notes. Transcribe the audio, extract the relevant clinical entities, format them into the template clinicians actually use, feed it back into the patient record.

The constraint that shapes the whole design: clinicians don't trust AI output. The system isn't a black box that writes the chart — it produces a draft with every claim traceable back to a specific point in the transcript. The scribe agent is an assistant, not a replacement. The clinician stays in the loop.

This is where AI-agent work intersects with my primary work at Jano. Most of my agent-building experience comes from Kalrav.AI at Irisidea, which is SMB e-commerce. Applying the same patterns to healthcare forces different tradeoffs — correctness over breadth, traceability over fluency, audit-readiness over speed.

## The stack

- **AWS Lambda** — serverless message handlers. Good fit for WhatsApp webhooks: unpredictable arrival patterns, short-lived per-message logic, scales to zero between bursts.
- **AWS EC2** — longer-running services that don't suit Lambda's 15-minute ceiling.
- **PostgreSQL** — conversation state, patient records, audit trails.
- **WhatsApp Cloud API** — Meta's official business messaging integration.
- **IaC layer on top** — everything above, declarative, reproducible.

## Why healthcare is different

Healthcare is not a domain to move fast and break things in. Reliability expectations are different from consumer SaaS in ways that affect every technical decision — idempotency, retry semantics, message ordering guarantees, how you log what, what you don't log, what happens if the system is down for 15 minutes at 2am. A message that should reach a patient and doesn't is a real consequence, not a UX bug.

Patient data handling, audit expectations, the seriousness of correctness when the output isn't "did the chatbot respond well" but "did the right person get the right information" — it all shapes how I build at Jano.

It's a good counterbalance to the Irisidea work, where "ship and measure" is the default mode. At Jano I ship carefully and then measure. Both disciplines compound.

## The AI-agent connection

A WhatsApp messaging backend is most of what you need to drop agents into that surface later. The Command Center already does some of this — automated follow-ups are effectively a rules-based agent. The medical scribe IS an AI agent. As the product matures, more of the patient-facing workflows will shift from rules to agents with tools, which is directly adjacent to the Kalrav / ChotU.AI / school-agents work I've done elsewhere. Different domain, same underlying craft.

## Ownership beats titles

Formally I'm a "Software Developer" at Jano. In practice that maps badly to what the work actually is. I picked the work by scope, not by title, and the title is what HR calls it for paperwork.

What matters is the four things above ship and keep working. If you're asking "what does Rehman do at Jano" — those four, plus the WhatsApp-first backend they all run on, are the answer. The job description is a lagging indicator.
