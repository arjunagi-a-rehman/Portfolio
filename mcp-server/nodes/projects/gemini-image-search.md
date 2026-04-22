---
id: gemini-image-search
title: "Gemini Multimodal Image Search"
source: project
url: https://github.com/arjunagi-a-rehman/gemini-multimodal-image-search
date: "2026-03-12"
tags:
  - multimodal
  - gemini
  - qdrant
  - fastapi
  - embeddings
  - vector-search
  - image-search
  - python
summary: "Small FastAPI app that indexes a local image folder using Gemini multimodal embeddings, stores the vectors in Qdrant over gRPC, and serves a browser UI supporting text queries, image uploads, drag-drop, and image URLs — all in one backend, no separate frontend build."
---

## What it is

A single-file-ish FastAPI app that makes semantic image search work over any folder of images. Point it at a directory, it indexes every image with Gemini multimodal embeddings into Qdrant, and spins up a browser UI where you can search with:

- text prompts
- uploaded images
- drag-and-drop files
- image URLs

## Stack

- **FastAPI** — API + UI in one backend, no separate frontend build
- **Google Gemini** (official `google-genai` SDK) — multimodal embedding model
- **Qdrant** — vector DB, prefers gRPC on port 6334 when exposed
- **uv** — package manager (faster than pip, has lockfile)
- **Python 3.11+**

## Why it's interesting

Multimodal embeddings in one vector space are the whole magic. A text query and an image query project into the same embedding space, so "red shoes on a beach" and a photo of red shoes on a beach return overlapping results. That's not something you build — Gemini just does it — but wiring it up cleanly into a searchable index is where the work is.

The FastAPI-only pattern (no separate React SPA) is intentional. For a tool like this, the fewer moving parts the better. Jinja templates + vanilla JS + FastAPI routes. It renders in ~150ms, no build step, deploys as one container.

## What I learned

Qdrant over gRPC is meaningfully faster than HTTP for bulk indexing. Default client prefers gRPC when port 6334 is open, falls back to HTTP otherwise. Small config, real wins.

The `google-genai` SDK is the right call over third-party wrappers. Gemini's API surface changes often; being on the official SDK means one-liner version bumps instead of chasing a maintainer.

Small projects want `uv` over `pip`. Installs in seconds, reproducible lockfile, no virtualenv dance. `requirements.txt` is still in the repo for compat, but `uv sync` is the primary flow.
