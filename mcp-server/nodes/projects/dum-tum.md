---
id: dum-tum
title: "dum-tum — No-Trigger-Key Shell Fixer"
source: project
url: https://github.com/arjunagi-a-rehman/dum-tum
date: "2026-08-25"
tags:
  - shell
  - zsh
  - bash
  - python
  - npm
  - cli
  - developer-tools
  - ai
  - open-source
summary: "Open-source shell fixer for zsh and bash that intercepts Enter, fixes safe typos locally, and turns natural language into confirm-before-run commands through an optional AI provider. Published to npm; v0.0.5 recorded 330 weekly downloads."
---

## What it is

`dum-tum` is the shell fixer with no trigger key. Instead of running a bad command and then invoking a separate helper, the user types normally and presses Enter. The shell hook decides whether to run the input unchanged, correct a safe typo locally, or ask an AI provider to translate natural language into a command.

Install or update it with:

```bash
npx dum-tum@latest
```

It supports macOS and Linux, zsh 5+, and Bash 4+. The project is MIT-licensed and reached version 0.0.5 across five npm releases. At the v0.0.5 release snapshot, npm reported 330 weekly downloads.

## The interaction model

- `sl` can resolve locally to `ls` and auto-run because it is read-only.
- A typo in a mutating command asks for confirmation instead of running.
- Natural language such as `create a python venv` becomes an AI suggestion that the user can run, edit, or cancel.
- A failed eligible command can be sent for an AI-generated correction with `FX_AI_ON_FAIL=1`.
- Known commands that are already valid pass through normally.

There is no magic keyword, prefix, or mode switch. The project hooks the shell's normal accept-line path so help appears at the point of intent.

## Safety model

Only allowlisted, read-only local corrections can auto-run. AI output never auto-runs. Risky or mutating corrections always wait for explicit confirmation. Known secret patterns are redacted before a request leaves the machine, and local-only mode works without sending anything to an AI service.

## AI providers

The tool can reuse authenticated `codex`, `claude` (Claude Code), or `opencode` CLI sessions, avoiding another API key. It also supports OpenRouter, OpenAI, Anthropic, and Gemini keys, or `none` for fully offline typo correction.

## Implementation

- zsh and bash adapters hook each shell's Enter behavior.
- Shared shell logic handles fuzzy matching, command classification, and confirmation.
- Python builds provider payloads and extracts candidate commands.
- The installer detects the shell and existing AI CLIs, updates a marked rc-file block idempotently, and smoke-tests the selected provider.
- PTY-level tests exercise real interactive confirmation flows in both zsh and bash; GitHub Actions runs both shell paths plus native macOS zsh coverage.

## Why it matters

The product insight is that invoking a fixer is itself friction. `dum-tum` moves correction into the shell interaction users already perform while keeping execution boundaries explicit. It is a small developer tool, but it combines UX, shell internals, cross-platform testing, privacy tradeoffs, and a careful safety model.
