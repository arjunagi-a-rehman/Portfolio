---
id: agent-skills
title: "Agent Skills — GitHub Progress Workflows for Codex"
source: project
url: https://github.com/arjunagi-a-rehman/agent-skills
date: "2026-07-14"
tags:
  - codex
  - skills
  - github
  - automation
  - python
  - excel
  - developer-tools
summary: "Three repository-local Codex skills that collect evidence-based GitHub progress, query saved reports, and export selected work into polished Excel workbooks."
---

## What it is

`agent-skills` packages three reusable Codex workflows for turning GitHub activity into useful progress records. The skills live inside a repository, use the authenticated GitHub CLI account as their evidence source, and keep generated reports local by default because they can include private work.

## The three skills

### github-change-summary

Collects authored commits and pull requests across repositories visible to the authenticated GitHub account, produces an evidence-based Markdown summary, and can set up daily, weekly, or monthly reporting schedules.

### github-progress-query

Answers date, repository, topic, commit, and pull-request questions from previously saved progress reports. It deduplicates evidence when daily, weekly, and monthly reports overlap.

### github-progress-excel

Turns selected progress reports into a polished `.xlsx` workbook. It delegates workbook construction and visual verification to Codex's spreadsheet tooling so the output can adapt to the intended audience.

## Why it matters

Git history contains evidence but not a useful narrative. These skills make that history queryable and presentable without relying on memory or manually compiling status updates. The repository also demonstrates how to structure portable Codex skills with clear instructions, UI metadata, optional collection helpers, and privacy-conscious local storage.
