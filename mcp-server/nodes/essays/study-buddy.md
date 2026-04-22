---
id: essay-study-buddy
title: "Your First AI Agent System: Study Buddy & The First Steps to Agent Creation"
source: essay
url: /study-buddy
date: "2025-04-08"
tags:
  - ai-agents
  - google-adk
  - tutorial
  - python
  - prompt-engineering
  - agent-series
summary: "Part 1 of my AI Agent System Series — a hands-on walkthrough of building your first agent using Google ADK, covering environment setup, separation of concerns (code vs config vs prompts), and writing a Study Buddy that guides students through problems instead of giving them answers."
---

## Where to start

AI agents aren't magic and they aren't chatbots. An agent is an autonomous entity that takes a task, decides how to handle it, calls tools or LLMs to do the actual work, and reports back. Flexible and adaptive. Not a decision tree in costume.

The 2016 chatbot wave failed because text input is not the same as language understanding. That's the one-sentence history lesson before the tutorial starts.

## What you're building

Study Buddy — an AI tutor that never gives direct answers. It guides students through problems. When a student asks "what's 7x8?", it doesn't say "56." It says "break it down. What's 7x10? Now subtract 7x2." That behavior comes from one thing: the prompt.

## The stack

- **Python 3.11+**
- **Google Agent Development Kit (ADK)** — the framework
- **uv** — package manager, faster than pip
- **YAML** — for config
- **Markdown** — for prompts

## Separation of concerns

Three files, three concerns. This is the most important pattern in the tutorial:

- `agent.py` — the logic. Loads config, loads prompt, instantiates the Agent.
- `agent_config.yml` — the settings. Model name, description, name.
- `prompts/study_buddy.md` — the personality. Role, responsibilities, limitations, tonality, response rules.

Why split? Because good prompts are long and structured, and non-developers need to tweak them without touching code. Treating the prompt as a Markdown file you can edit in any text editor is the difference between a toy and a maintainable system.

## The prompt structure

A good agent prompt covers:

1. **Role** — who is the agent?
2. **Responsibilities** — what tasks?
3. **Specifications** — rules and constraints
4. **Limitations** — what NOT to do (this is where Study Buddy gets "never give direct answers")
5. **Tonality** — voice and style
6. **Response format** — how the output is shaped

## Running it

`adk web` launches a local chat interface. That's it. You now have a working agent in ~50 lines of Python plus a well-structured prompt. From here you add tools (Part 2), then deploy as a production API (Part 3). This is Part 1 of the AI Agent System Series.
