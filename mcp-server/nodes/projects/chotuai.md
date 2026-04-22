---
id: chotuai
title: "ChotU.AI — Multi-Agent Personal Assistant"
source: project
url: /projects/chotuai
date: "2025-03-12"
tags:
  - ai-agents
  - multi-agent
  - langgraph
  - openrouter
  - aws
  - aws-cdk
  - ecs-fargate
  - personal-assistant
  - google-calendar
summary: "Built ChotU.AI, a production multi-agent personal assistant using LangGraph supervisor routing across 5 specialized agents with 3 different LLMs chosen per-task via OpenRouter, deployed on AWS ECS Fargate with React frontend."
---

## What is ChotU.AI?

ChotU.AI is a production-grade personal assistant built on a multi-agent architecture. Instead of one big LLM trying to do everything, five specialized agents handle task management, scheduling, planning, memory, and Google Calendar operations. A Supervisor agent routes each user message to the right specialist.

Live at chotuai.in. Five specialized agents, three different LLM providers, one coherent conversation.

## Why multi-agent over monolithic

The core bet: different tasks deserve different models. Task routing is cheap and deterministic — perfect for Gemini Flash as the Supervisor. Natural-language calendar parsing needs more reasoning — DeepSeek V3. Short-form replies? GPT-4o-mini. Picking the right model per task via OpenRouter cuts cost without losing quality.

LangGraph gives the system a stateful, graph-based execution model. Conditional edges route between nodes. The graph state carries conversation context across every turn — users never need to know which agent is responding.

## Architecture

- **Supervisor (Gemini Flash)** — intent classification and routing via LangGraph conditional edges
- **Specialist agents** — each tuned to one domain: calendar, tasks, planning, memory, general
- **OpenRouter** — unified API across providers, per-agent model selection
- **ECS Fargate** — containerized backend, no server management
- **AWS CDK (TypeScript)** — entire infrastructure as code, reproducible stacks
- **React + Vite** — SPA frontend on S3/CloudFront
- **API Gateway + Lambda authorizer + Cognito** — JWT auth flow
- **Google Calendar OAuth2** — token delegation for real-time calendar ops

## What I learned

Stateful graph execution matters. Context across turns is what makes an assistant feel continuous — a stateless pipeline can answer one question well but can't reason about "put that on my calendar tomorrow."

Per-task model selection is underrated. Most multi-agent systems use one model for every agent because it's easier. That's leaving performance and cost on the table. OpenRouter makes model-per-agent as cheap as a config change.

The harder-than-expected part was OAuth token refresh. Calendar delegation expires, and expired tokens in the middle of a conversation kill UX. Built a proactive refresh loop that runs ahead of expiry, not on 401.
