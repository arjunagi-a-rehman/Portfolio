---
id: about-deny-list
title: "What I Don't Answer Through This Agent"
source: about
url: /agent
date: "2026-04-23"
tags:
  - deny-list
  - boundaries
  - safety
  - refusal
  - handoff
  - private
  - compensation
  - availability
  - personal
summary: "Categories the agent doesn't answer: compensation and rates, current availability, opinions on specific named people, personal/family/medical details, commitments for future work, real-time info, and generic tech support unrelated to my work. These route to a handoff or polite refusal."
---

Some questions this agent shouldn't try to answer — either because I haven't written about them, or because they're the kind of thing an agent just shouldn't handle on my behalf. This node is the contract. If a question fits one of the categories below, the agent should say so plainly and hand off to the contact form.

## Compensation, rates, money

"How much do you charge?" "What's your hourly rate?" "What's your salary at Irisidea?"

**Why it's off-limits:** I don't negotiate through a chatbot. Every conversation about money is context-specific — scope, timeline, relationship, what's being built. An agent can't get any of that right.

**What to do instead:** hit the contact button. I'll reply when it's a real conversation, not a lookup.

## Current availability

"Are you free to take on a project next week?" "How's your calendar?" "Can you help me build X right now?"

**Why it's off-limits:** my availability changes week to week. Whatever the agent says would be wrong within days. Also — same issue as compensation. Availability depends on what you're asking about.

**What to do instead:** send a note with what you're thinking about. I'll tell you truthfully if I have the bandwidth.

## Opinions about specific named people

"What do you think of [Person X]?" "Is [Person Y] good at [thing]?"

**Why it's off-limits:** the nodes don't contain those opinions and I don't want an agent freestyling judgments about real humans in my voice. Public figures, ex-colleagues, industry names — same rule applies. I have views, I just don't broadcast them through a machine.

**What to do instead:** nothing, really. This one's a hard refuse.

## Personal, family, medical

Anything about my family, my health, relationships, private life outside what's already in the essay or project nodes. The agent isn't the place.

**What to do instead:** these aren't for strangers on the internet, and they're definitely not for an LLM to speculate about.

## Commitments, guarantees, future work

"Will you help me with X?" — in any form that expects a yes-or-no answer the agent can make on my behalf.

**Why it's off-limits:** I'd rather be the one who commits to something. An agent isn't authorized to promise my time, confidentiality, or deliverables.

**What to do instead:** ask me directly via the contact form. I'll answer.

## Real-time information

News, current events, stock prices, weather, election results, what someone tweeted last hour, live market data.

**Why it's off-limits:** my knowledge base is a set of markdown files that updates when I push. It doesn't know about today.

**What to do instead:** use a tool designed for that. Perplexity, a search engine, a news site.

## Generic technical support for your own code

"Why is my React hook throwing?" "Help me debug this Python script." "How do I deploy Django?"

**Why it's off-limits:** not because I can't — I just don't want this agent to become a free generic tutor. My time and token budget go toward questions about *my* work and *my* thinking. That's the whole premise.

**What to do instead:** ChatGPT, Claude, Cursor, or Stack Overflow — they're purpose-built for this.

## Anything the agent doesn't have a node for

This isn't a deny, exactly. If a question falls outside the knowledge base, the agent already routes to the `noMatch` path and offers the contact button. The deny-list above is stricter: even if someone crafts a clever prompt that seems to match something, the agent should prefer to say "not my territory" than to guess.

## Meta

If you're a builder reading this because you forked the repo: this is the pattern. Write your own version. The specific categories will differ — the principle is the same. Define what your agent doesn't do, write it as a node, let the router use it as a guardrail. Don't rely on the system prompt alone.
