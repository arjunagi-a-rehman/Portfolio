---
id: essay-llm-economics
title: "Self-Hosting LLMs vs Cloud APIs: The Honest Numbers"
source: essay
url: https://chatgpt.com/share/69e8d428-ab00-83a3-baa0-d81e205e64d5
date: "2026-04-21"
tags:
  - economics
  - llm-infrastructure
  - cost-analysis
  - vps
  - claude-api
  - qwen
  - opinions
  - engineering-tradeoffs
summary: "Practical take on what it actually costs to run LLMs yourself versus using APIs. For a ~₹1.5L budget: buy a local machine for small models, use Claude API for heavy lifting. Don't try to run Qwen 30B on a 32GB machine or a CPU-only VPS — the economics don't work until you're at 10K+ sessions a month."
---

## The question I kept circling

Can I run Qwen 3.6 30B on a 32GB Mac? If not, what does a VPS cost to host it? And how does that compare to just paying Claude?

I went through the math. Here's what I actually concluded.

## 32GB local — barely usable for 30B

Qwen 3.6 35B MoE at Q4 quantization with reduced context (~32K) technically runs on a 32GB Mac at 15-25 tok/sec. Crashes easily. Not usable for agent workflows that need long context or multi-step reasoning.

You can run 7B-14B models comfortably. Past that, you're fighting memory pressure.

## VPS-without-GPU is a dead end for big models

Every tier of standard VPS:

- Entry (₹300-800/month, 4GB RAM) — useless for 30B
- Mid (₹800-2,500/month, 8-16GB RAM) — still useless for 30B
- High-end (₹2,500-5,000/month, 16-32GB RAM, no GPU) — still useless for 30B

No GPU = no 30B. Period. CPU inference on a 30B model is technically possible but unusably slow.

## GPU cloud — it's not cheap

- Cheap GPU cloud (T4/L4/A10): $0.4-1/hour → ₹25-70K/month → ₹3-8L/year
- Good GPU cloud (A100 40GB): $1.5-3/hour → ₹90K-2L/month → ₹10-24L/year
- Dedicated H100: $3-8/hour → ₹25-80L/year

These are the prices people don't realize when they say "I'll just run it on cloud."

## Claude API — the comparison that matters

- Light dev usage (~5M in, 2M out/month): ~$45/month
- Medium daily coding: $100-300/month
- Heavy agent automation: $500-2,000+/month

For a developer writing code with AI help, you're in the $50-300/month band. That's ₹50K-3L/year — meaningfully cheaper than running your own GPU cloud for comparable capability, and you get a better model.

## What I actually recommend

Hybrid. With a ~₹1.5L budget:

- Spend ₹1.2-1.5L once on a local machine capable of running 7B-14B models
- Use Claude API for heavy tasks (agents, long-context reasoning, multi-step workflows)
- Cuts API costs by 50-80% vs pure cloud because local handles the easy stuff

This beats every alternative:

- Pure VPS? Useless for real models.
- Pure GPU cloud? ₹3L+/year in pure infra bills.
- Pure API? Works, but you're leaving the easy-mode savings on the table.

## The real cost problem isn't where people look

Most devs agonize over VPS costs — a ₹10-20K/year line item — while ignoring API costs that can hit ₹1L+/year for heavy usage. That's backwards. VPS is not your cost problem; your API usage pattern is. Optimize prompt efficiency and model selection first.

## My bias

I'd rather write better prompts that use fewer tokens than host my own 30B model. Self-hosting LLMs is a fun engineering problem and a terrible economic decision at small scale. The break-even for self-hosted inference vs API is measured in 10K+ sessions per month — until you hit that, pay for the API, save the ops time, ship the actual product.

Trying to self-host big models to "replace Claude" is a classic premature-optimization trap. The engineering effort is better spent on prompt caching, context pruning, and smart model selection between Haiku/Sonnet/Opus based on what the task actually needs.
