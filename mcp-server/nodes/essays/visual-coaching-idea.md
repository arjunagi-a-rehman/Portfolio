---
id: essay-visual-coaching-idea
title: "Visual Coaching Agents: An Idea I'm Exploring"
source: essay
url: https://claude.ai/share/cc8d53bb-5a3c-4565-9cb4-b06698f58e03
date: "2026-04-21"
tags:
  - product-ideas
  - ai-agents
  - gemini-live
  - v-jepa
  - mediapipe
  - explorations
  - computer-vision
  - kalrav-ai
summary: "Exploration notes on building a real-time visual coaching agent — the user turns on their camera mid-squat, the agent watches, corrects form, asks them to reposition the camera when it can't see properly. Same pattern for cooking, cleaning, car wash. Research on Gemini Live vs V-JEPA vs MediaPipe, scalability across domains, and unit economics."
---

## The idea

User turns on their phone camera mid-gym — wrong angle, half-visible — and asks "am I doing this squat right?" The agent either answers if it can see enough, or asks the user to reposition the camera, then re-evaluates. Same system works for cooking, cleaning, car wash — any physical task where form matters.

This is a vertical agent problem, not a general AI problem.

## What the stack actually looks like

Three real options, each with a different cost-complexity profile:

- **Gemini Live API** — real-time video + voice at 1 FPS, ~$0.05-0.13 per 10-min session. Hosted. Mature. One WebSocket connection. The fastest path to MVP.
- **V-JEPA 2** — Meta's world model. Better at motion understanding. No hosted API — needs GPU infra and probe training per domain. Not a replacement for the conversational layer, but a precision add-on.
- **MediaPipe Pose** — runs on-device, free. 33 body landmarks in 3D. Perfect for gym specifically where joint angles matter.

## How I'd build it

MVP on Gemini Live alone, domain-specific system prompts per activity (gym / cooking / cleaning). Adding a new domain is a prompt file, not a training run — that's the scalability win.

Layer MediaPipe Pose client-side for gym specifically. Gives precise joint angles and rep counting without an API call. The LLM then gets both the raw frame AND the computed angles as context. Cheaper and more accurate than asking the LLM to guess angles from pixels.

V-JEPA only becomes worth the engineering once there are enough users to justify collecting domain-specific training data. Then it becomes the moat — nobody else has your labeled car-wash-technique dataset.

## What actually breaks at scale

Adding domains is cheap with prompts. The hard parts:

- **Camera angle requirements differ per activity.** Side view for squats, top-down for chopping, wide angle for car wash. Combinatorially tricky as domains multiply.
- **Quality thinning.** Domain 1 is great because you iterated. Domain 47 is mediocre. Users judge the product by the worst domain they try.
- **Domain auto-detection** becomes its own classifier problem past ~20 domains. If the user doesn't manually select "car wash mode", can the system figure it out?

## The economics

Rough Gemini Flash numbers for a 10-min session with video + voice streaming:

- Full stream: ~$0.13
- With MediaPipe smart-triggering (only send frames when something looks off): ~$0.03
- Self-hosted V-JEPA on an A10G: ~$0.001 marginal, but $540/month fixed GPU cost

Break-even for V-JEPA vs Gemini is somewhere around 15K sessions/month. Until then, API wins.

At 1,000 users doing 3 sessions/day, we're looking at ~$3-4K/month with MediaPipe gating, which is very livable on a $5-10/month subscription per user.

## Why this fits Kalrav

Kalrav is already a vertical AI agent platform — specifically-right beats generally-capable. Visual coaching across physical tasks is the same playbook on a different surface. E-commerce vertical agents became the thing because the domain-embedding moat is real. Same thesis works for "watching you do something and telling you what to fix."

The add-a-new-domain-with-a-prompt-file architecture is also the same architecture pattern I use in Kalrav's agent builder. So a lot of the platform layer transfers directly.

## Status

Exploration, not a plan. Writing this up so the idea doesn't rot in a tab. The Gemini Live MVP is a weekend prototype and I can run the numbers on real traffic from there.
