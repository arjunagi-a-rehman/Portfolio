---
id: experience-jano-health
title: "Jano Health — Where I Spend Most of My Engineering Time Now"
source: experience
url: /about
date: "2024-01-01"
tags:
  - jano-health
  - healthcare
  - nephrology
  - reno
  - doctor-app
  - scheduling
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
  - data-pipeline
  - patient-reports
  - ai-human-hybrid
  - command-center
  - orchestrator
  - ownership
summary: "Jano Health is a multi-product healthcare platform — Reno (their nephrology solution), a doctor app for appointments and scheduling, and WhatsApp as the primary patient interface hospitals and doctors use to interact with patients. I own five things end-to-end: Command Center orchestrator, IaC migration, distributed auth, AI medical transcription + scribe, and the patient report data pipeline (AI + human hybrid). Primary engineering focus. Not bullish on titles."
---

## The role

Jano Health is where most of my engineering time goes right now. Irisidea work is carved out around this. I'm a developer who owns the whole path of the things I build — spec, architecture, implementation, infra, deploy, debug. I'm not bullish on titles; I care about what's being shipped and who owns the consequences.

## What Jano actually is

Not a single-channel messaging tool. Jano ships multiple products on a shared platform:

- **Reno** — their clinical solution for the **nephrology** domain. Built specifically for kidney care — the workflows, the data models, the care patterns that matter for nephrologists and their patients.
- **Doctor app** — appointment booking and schedule management for doctors. Calendar, slot management, patient queuing, the day-to-day operational surface clinicians live in.
- **WhatsApp as the primary patient interface** — the way hospitals and doctors actually reach patients, and how patients send data back (messages, reports, updates). Not the *product*, the *patient-facing layer* on top of the real product.

All three share the same platform infrastructure — auth, data pipelines, the orchestration layer, the AI systems. That shared infrastructure is where most of my engineering time goes.

## Why WhatsApp specifically for the patient surface

The premise: the best patient interface isn't an app patients download. It's the one already on their phone. For the markets Jano operates in, WhatsApp is that interface. Lower friction, higher engagement, works on the cheapest phones, works over bad connections.

The engineering tradeoff: WhatsApp's API is constrained compared to a native app. Session windows, template message approval, webhook reliability, message ordering — all things you'd just own in your own app but have to design around here. It forces clear thinking about what you actually need to communicate versus what would just be nice.

## What I've built / own end-to-end

### 1. The Command Center

An orchestrator I built end-to-end. It watches three things in parallel and reacts:

- **Patient activity** — messages, replies, responses to care prompts, engagement patterns
- **User activity** — staff / doctor interactions with the system, actions taken on patient cases
- **System activity** — backend events, scheduled jobs, automated workflows

Out of those signals, it schedules follow-ups and manages the follow-up lifecycle from dispatch to completion. Every patient gets the right touchpoint at the right time based on what's actually happening in their conversation and their care plan, not a fixed schedule.

This is the hardest problem I work on at Jano. It's not LLM-heavy — it's state machines, event pipelines, scheduling, reliability. The parts that actually keep healthcare products working.

### 2. Infrastructure as Code — entire stack

Converted the whole infrastructure to IaC. Declarative stacks, no more clicky-clicky in the AWS console. Deploys are reproducible, rollbacks are version-controlled, new environments spin up from one command.

This was the single biggest velocity unlock for the engineering team. Before: every environment was a snowflake, infra changes were slow and risky. After: a PR is a PR, whether it's application code or infrastructure.

### 3. Distributed auth system

Built from scratch. Identity, sessions, permissions, multi-service trust — all of it. Healthcare means you can't hand-wave any of this. Patient data requires audit trails, staff access requires role-based boundaries, third-party integrations need scoped tokens that can't escalate.

The interesting design decision was going distributed from day one rather than a single auth service. Lower blast radius if any one component fails, cleaner separation between patient-facing and staff-facing auth flows, easier to reason about when each piece enforces its own contract. Works across Reno, the doctor app, and the WhatsApp-side services uniformly.

### 4. AI agent for medical transcription + scribe

Takes a consultation, turns it into structured clinical notes. Transcribe the audio, extract the relevant clinical entities, format them into the template clinicians actually use, feed it back into the patient record.

The constraint that shapes the whole design: clinicians don't trust AI output. The system isn't a black box that writes the chart — it produces a draft with every claim traceable back to a specific point in the transcript. The scribe agent is an assistant, not a replacement. The clinician stays in the loop.

### 5. Patient report data pipeline — AI + human hybrid

When a patient sends a report — any report, any format — the pipeline extracts the data and saves it against that patient's profile. Lab reports, prescriptions, scan results, whatever the patient forwards through WhatsApp or uploads via the doctor app.

The design choice that makes it actually work: it's not "fire the AI and trust it." It's a hybrid. AI does the extraction pass first, pulls out structured fields, classifies the report type, normalizes values. A human reviewer gets what the AI produced plus the original document, and either confirms or corrects. The clean output is what lands in the patient record.

**Why hybrid, not fully AI:**

- Medical data correctness isn't a 95%-is-good-enough domain. The last 5% is the stuff that causes real harm.
- AI extraction on heterogeneous healthcare documents is genuinely hard. Handwriting, lab formats, scan quality, language mix — edge cases compound.
- Human-in-the-loop isn't a hedge, it's a feature. It's what makes the system trustworthy enough to actually plug into care workflows.

**Why hybrid, not fully human:**

- Pure manual entry doesn't scale.
- AI handles the 80% of the report that's boilerplate (patient ID, report type, obvious numeric fields) and lets the human focus on the 20% that actually needs judgment.

This pattern — AI does the first pass, human confirms or corrects, clean output is canonical — shows up again and again in healthcare AI that actually ships. It's the right shape for this problem.

## The stack

- **AWS Lambda** — serverless handlers for WhatsApp webhooks, scheduled jobs, event-driven work
- **AWS EC2** — longer-running services that don't suit Lambda's 15-minute ceiling
- **PostgreSQL** — patient records, conversation state, audit trails, structured report data
- **WhatsApp Cloud API** — Meta's official business messaging integration
- **IaC layer on top** — everything above, declarative, reproducible

## Why healthcare is different

Healthcare is not a domain to move fast and break things in. Reliability expectations are different from consumer SaaS in ways that affect every technical decision — idempotency, retry semantics, message ordering guarantees, how you log what, what you don't log, what happens if the system is down for 15 minutes at 2am. A message that should reach a patient and doesn't is a real consequence, not a UX bug. A lab value that gets misparsed is worse.

Patient data handling, audit expectations, the seriousness of correctness when the output isn't "did the chatbot respond well" but "did the right person get the right information" — it all shapes how I build at Jano.

It's a good counterbalance to the Irisidea work, where "ship and measure" is the default mode. At Jano I ship carefully and then measure. Both disciplines compound.

## The AI-agent connection

The medical scribe and the patient report pipeline are both AI-agent work at their core — the scribe is an agent doing consultation → structured notes, the report pipeline is an agent doing unstructured document → structured patient data. Both are wrapped in human-in-the-loop patterns because healthcare demands it.

Most of my agent-building experience before Jano came from Kalrav.AI at Irisidea, which is SMB e-commerce. Applying the same patterns to healthcare forces different tradeoffs — correctness over breadth, traceability over fluency, audit-readiness over speed. Different domain, same underlying craft.

## Ownership beats titles

Formally I'm a "Software Developer" at Jano. In practice that maps badly to what the work actually is. I picked the work by scope, not by title, and the title is what HR calls it for paperwork.

What matters is the five things above ship and keep working. If you're asking "what does Rehman do at Jano" — those five, plus the shared platform they all run on, are the answer. The job description is a lagging indicator.
