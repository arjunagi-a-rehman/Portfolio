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
  - iac
  - terraform
  - infrastructure
  - distributed-auth
  - ai-agents
  - medical-transcription
  - command-center
  - orchestrator
  - ownership
summary: "Jano Health is where most of my engineering time goes right now — a WhatsApp-first health messaging platform on AWS. Built the Command Center orchestrator end-to-end, converted the whole infrastructure to IaC, built a distributed auth system, and built an AI medical transcription + scribe agent."
---

Jano Health is where most of my engineering time goes right now. Irisidea work is carved out around this. I'm not bullish on job titles — the shape of the work matters more than what anyone calls it. At Jano I'm a developer who owns things end-to-end: spec, architecture, implementation, infra, deploy, debug. The relationship to the company is past official titles.

The product is a WhatsApp-first health messaging platform. Patients interact with their care through the chat interface they already use every day. On top of that simple surface is a lot of infrastructure that has to be right because healthcare.

Four things I've shipped or own at Jano:

## 1. The Command Center

An orchestrator I built end-to-end. It watches three things in parallel and reacts:

- **Patient activity** — messages, replies, responses to care prompts, engagement patterns
- **User activity** — staff interactions with the system, actions taken on patient cases
- **System activity** — backend events, scheduled jobs, automated workflows

Out of those signals, it schedules follow-ups and manages the follow-up lifecycle from dispatch to completion. Every patient gets the right touchpoint at the right time based on what's actually happening in their conversation and their care plan, not a fixed schedule.

This is the hardest problem I work on at Jano. It's not LLM-heavy — it's state machines, event pipelines, scheduling, reliability. The parts that actually keep healthcare products working.

## 2. Infrastructure as Code, entire stack

Converted the whole infrastructure to IaC. Terraform/CDK-style declarative stacks, no more clicky-clicky in the AWS console. Deploys are reproducible, rollbacks are version-controlled, new environments spin up from one command.

This was the single biggest velocity unlock for the engineering team. Before: every environment was a snowflake, infra changes were slow and risky. After: a PR is a PR, whether it's application code or infrastructure.

## 3. Distributed auth system

Built from scratch. Identity, sessions, permissions, multi-service trust — all of it. Healthcare means you can't hand-wave any of this. Patient data requires audit trails, staff access requires role-based boundaries, third-party integrations need scoped tokens that can't escalate.

The interesting design decision was going distributed from day one rather than a single auth service. Lower blast radius if any one component fails, cleaner separation between patient-facing and staff-facing auth flows, easier to reason about when each piece enforces its own contract.

## 4. AI agent for medical transcription + scribe

Takes a consultation, turns it into structured clinical notes. Transcribe the audio, extract the relevant clinical entities, format them into the template clinicians actually use, feed it back into the patient record.

The constraint that shapes the whole design: clinicians don't trust AI output. The system isn't a black box that writes the chart — it produces a draft with every claim traceable back to a specific point in the transcript. The scribe agent is an assistant, not a replacement. The clinician stays in the loop.

This is where AI-agent work intersects with my primary work at Jano. Most of my agent-building experience comes from Kalrav.AI at Irisidea, which is SMB e-commerce. Applying the same patterns to healthcare forces different tradeoffs — correctness over breadth, traceability over fluency, audit-readiness over speed.

## The stack

AWS Lambda, EC2, PostgreSQL, plus WhatsApp Cloud API as the primary surface. IaC on top of that (Terraform/CDK flavor). Standard SaaS-healthcare shape, deliberately.

## Why healthcare is different

Healthcare is not a domain to move fast and break things in. Reliability expectations are different from consumer SaaS in ways that affect every technical decision — idempotency, retry semantics, message ordering guarantees, how you log what, what you don't log, what happens if the system is down for 15 minutes at 2am. A message that should reach a patient and doesn't is a real consequence, not a UX bug.

It's a good counterbalance to the Irisidea work, where "ship and measure" is the default. At Jano I ship carefully and then measure. Both disciplines compound.

## Ownership beats titles

Formally I'm a "Software Developer" at Jano. In practice that maps badly to what the work actually is. I picked the work by scope, not by title, and the title is what HR calls it for paperwork. What matters is the four things listed above ship and keep working.

If you're asking "what does Rehman do at Jano" — those four plus the WhatsApp backend are the answer. The job description is a lagging indicator.
