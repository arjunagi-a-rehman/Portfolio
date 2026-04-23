---
id: thinking-self-taught
title: "Self-Taught in the Ways That Matter"
source: thinking
url: /about
date: "2026-04-22"
tags:
  - self-taught
  - learning
  - craft
  - ownership
  - production
  - debugging
  - engineering-philosophy
  - values
summary: "How I actually learned engineering: by shipping things, breaking them in production, and fixing them. Self-taught isn't a bio line — it's a philosophy. AI makes the tutorial-grade content irrelevant, and ownership, taste, and judgment become the only things left that matter."
---

Self-taught in the ways that matter — by shipping things, breaking them in production, and fixing them.

That's the shortest honest version. The longer version is a whole philosophy of how to get good at engineering in 2026.

## The three teachers that actually work

**1. Production.**
A feature that works on your laptop is a hypothesis. A feature that works in production under real load, with real users, after the third time you've patched it at 2am, is knowledge. Everything I know about real-time systems came from watching RouteEye behave differently at the airport than it did in staging. Everything I know about vertical AI agents came from Kalrav customers doing things I never anticipated. The laptop is where you rehearse. Production is where you learn.

**2. Breaking things.**
Every bug is free tuition. The one where the Postgres connection pool got exhausted at 4am — tuition paid, lesson internalized, applies to every system I'll ever build from now on. The one where a bad firmware update bricked a Wisp device — tuition paid, staged OTA rollouts from then on. You can't skip the class. You have to break things to know how they actually work.

**3. Fixing things.**
Debugging is the real curriculum. Not reading about a subsystem — tracing an actual failure through it at 3am. That's when the clean architectural mental model you had collides with reality and gets replaced by a more honest one. Every time.

## What self-taught does NOT mean

It doesn't mean "I refused to read." I read a lot — docs, source code, blog posts, essays, books. Reading is the background process; shipping is the foreground.

It also doesn't mean "I avoided structure." I've taught myself things in ordered, systematic ways — the IoT curriculum I teach on SkillAnything is basically my own learning path for that domain, cleaned up for beginners. Structure is useful. But structure without production exposure is cosplay.

The distinction is about *where the certainty comes from*. A credential says someone else verified you know something. Production experience says reality verified you know something. The first is easier to collect. The second is the only one that actually matters when a system is on fire.

## Why this matters more now, not less

AI makes the tutorial layer of engineering effectively free. An LLM can scaffold a React app, write a Postgres migration, generate tests, explain a library. The activity of going from "never seen this" to "basic working code" used to take weeks. Now it takes minutes.

What that compresses is exactly the part formal education was good at — implementation fluency. What it does NOT compress is judgment under pressure, taste in system design, the muscle to recognize when something smells wrong at 3am, the experience of having seen a dozen similar systems fail in a dozen similar ways.

Those only come from shipping things, breaking them, and fixing them.

This is the same argument as the `coders-to-owners` essay, one layer deeper. If AI collapses implementation, and the remaining high-leverage skill is ownership, then **the path to ownership is still self-teaching — still shipping and breaking and fixing**. There's no school for that. There never was.

## Practical version

If you're someone who wants to get good at this and doesn't have a traditional path:

1. Ship things. Real things. Public things when possible.
2. Put them in production. A side project nobody uses isn't production — make something one stranger uses.
3. When it breaks, don't just fix it. Understand *why* it broke at that level.
4. Write about it. Not for an audience — for yourself next year. Future-you reading past-you is the most honest feedback loop there is.
5. Do that for a few years.

The fact that AI is here doesn't change this. It just means the people doing it are getting leverage they didn't have before. The fundamental act is the same as it was in 2010, 1995, or 1982. Build, break, fix, repeat.

That's the whole degree program.
