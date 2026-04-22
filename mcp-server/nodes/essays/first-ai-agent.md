---
id: essay-first-ai-agent
title: "Your First AI Agent System: Study Buddy & Tool Calls"
source: essay
url: /first-ai-agent
date: "2025-01-01"
tags:
  - ai-agents
  - google-adk
  - tool-calls
  - tutorial
  - python
  - llm
  - architecture
summary: "A practical guide to building your first AI agent with tools using Google ADK — covers tool call architecture, Google Search integration, custom function tools, and the Study Buddy agent pattern."
---

## What this essay covers

This is Part 2 of the AI Agent System Series. By the end you build a working Study Buddy agent that can search the web, use custom tools, and maintain conversation context.

## Why tools change everything

A bare LLM is a language model. An LLM with tools is an agent. The distinction matters because tools let the model interact with the world — not just generate text about it.

The mental model: the LLM decides what tool to call and with what arguments, the runtime executes the tool and returns results, the LLM synthesizes a response. That loop is the core of every AI agent, regardless of framework.

## Tool architecture in Google ADK

ADK organizes tools into three categories:
1. **Built-in tools** — Google Search, code execution, retrieval
2. **Function tools** — Python functions you define, decorated with `@tool`
3. **Agent-as-tool** — wrap another agent as a tool for orchestration

The function tool pattern is the most powerful for custom workflows:

```python
from google.adk.tools import tool

@tool
def get_study_notes(topic: str) -> str:
    """Fetch study notes for a given topic from the user's notes database."""
    # your implementation
    return notes_db.get(topic, "No notes found for this topic.")
```

The docstring matters — the LLM reads it to decide when to call the tool. Write it for the model, not for humans.

## The Study Buddy agent

The Study Buddy agent demonstrates the full pattern: it has access to Google Search for finding current information, a custom `get_study_notes` tool for personalized content, and a `create_flashcard` tool for spaced repetition output.

The key architectural decision: give the agent narrow, well-named tools rather than one big "do everything" tool. The LLM makes better routing decisions with surgical tools.

## Session management

One thing tutorials skip: agents need memory. An agent that forgets the last message is useless for studying.

ADK provides `SessionService` for this. Two modes:
- `InMemorySessionService` — fine for local development, dies on restart
- Persistent session backends — Redis, database — for production

For the Study Buddy, InMemory is enough to demo. For production (Part 3), you need persistence.

## What I learned building agents with ADK

The surprising thing: the hard part isn't the LLM. It's the tool contracts. If your tool returns ambiguous data, the LLM will interpret it ambiguously and you'll get weird behavior that's hard to debug.

Invest time in:
- Clear tool names and docstrings
- Typed return values (return structured data, not freeform strings)
- Handling tool errors gracefully (return `{"error": "..."}` not raise an exception)

The LLM is smart about working around bad tool design. But you want it spending intelligence on your problem, not on parsing your tool output.
