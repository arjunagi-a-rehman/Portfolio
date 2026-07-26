---
id: essay-dont-wait-fork-it
title: "Don't Wait. Fork It."
source: essay
url: /dont-wait-fork-it
date: "2026-07-26"
tags:
  - open-source
  - ai-agents
  - forking
  - craft
  - tooling
summary: "Developers have always shaped their own tools. AI harnesses took that away, but agents made forking cheap — so fork your tools, keep the change, and only upstream when it's wanted."
---

## The thesis

Developers have always built their own workbench — dotfiles, Vim configs, Emacs, VS Code extensions. Agentic coding tools briefly broke that habit: the best harnesses became vendor-controlled products with generous plugin ecosystems but hard seams. An extension point is something you are granted; a fork is something you take.

The old objection to forking was cost — a fork required a team to maintain, rebase, and patch. Agents collapsed that cost by doing the archaeology: reading forty thousand lines of unfamiliar code to find the one place a menu gets populated is now ninety seconds, not an evening. A fork stops being a strategic commitment and becomes a Tuesday.

## What I shipped into my T3 Code fork

Public fork: https://github.com/arjunagi-a-rehman/t3code

1. OpenCode slash commands in the composer — the slash menu now discovers OpenCode custom commands (global config dir + per-project `.opencode/command/*.md`), via a new `providers.listProjectSlashCommands` RPC; a leading `/name args` routes through `session.command`.
2. A custom app background image — uploaded image stored on-device as a data URL, adjustable opacity, translucent shell scrim.
3. Provider model filtering with bulk hide/show controls.

None proposed upstream. None waiting on a roadmap. That's the point.

## The rules

- A feature does not have to be useful. The background image saves zero seconds; joy is a valid reason to change software.
- The fork is the destination, not a waiting room for the PR. Your change does not need to be merged, reviewed, or blessed. Nobody has ever asked you to upstream your dotfiles.
- Do not open a PR as your first move. Default to your own fork, read CONTRIBUTING.md, open an issue before building for upstream, and accept that what you want may not be what the project wants.
- A fork still costs: you own security patches, merge debt compounds, keep changes small and surgical, and always read the agent-generated diff.

The rule: fork freely, keep it, and upstream only when you're sure it's wanted.

## Related essays

- /coders-to-owners — the same shift from the career side: AI writes the diff, you own the workbench.
- /software-can-talk — the open, forkable agent stack behind /agent, a small bet on the same openness.
