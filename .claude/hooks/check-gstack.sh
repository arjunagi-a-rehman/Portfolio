#!/bin/bash
# Block skill usage when gstack is not installed globally.
#
# Uses exit 2 + stderr to block. Claude Code's PreToolUse hook contract
# treats exit code 2 as a hard block regardless of stdout format — more
# portable than the JSON schema which has changed across versions. The
# original gstack-generated template used `exit 0` + a flat JSON object,
# which Claude Code silently ignores, failing the gate OPEN.

if [ ! -d "$HOME/.claude/skills/gstack/bin" ]; then
  cat >&2 <<'MSG'
BLOCKED: gstack is not installed globally.

gstack is required for AI-assisted work in this repo.

Install it:
  git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
  cd ~/.claude/skills/gstack && ./setup --team

Then restart your AI coding tool.
MSG
  exit 2
fi

exit 0
