---
id: ecai
title: "ECAI — Multimodal Document Intelligence Platform"
source: project
url: /projects/ecai
date: "2025-06-05"
tags:
  - rag
  - multimodal
  - azure
  - openai
  - azure-ai-search
  - fastapi
  - react
  - embeddings
  - hnsw
summary: "Built ECAI on Azure AI Foundry — a multimodal RAG platform where documents upload to Blob Storage, text and images extract separately, both embed via text-embedding-3-small, index in Azure AI Search with HNSW, and GPT-4.1 powers chat over 1536-dim vectors with per-user document isolation."
---

## What is ECAI?

ECAI is a multimodal document intelligence platform. Upload a PDF or document, it extracts text and images separately, embeds both, and lets you chat with the content — where retrieval surfaces relevant paragraphs AND relevant diagrams together, not just text.

Built on Azure AI Foundry. FastAPI backend, React 18 frontend via Vite, hosted on Azure Static Web App. Microsoft Entra ID for auth.

## Why multimodal RAG

Most RAG systems only index text. That's fine for prose but falls apart for anything with diagrams, charts, workflows, architectural drawings. The user asks "how does the auth flow work" and the actual answer is in a sequence diagram the system can't read.

ECAI processes images separately with GPT-5-nano, generates a description, embeds the description, stores it alongside text chunks. When you ask a question, the retrieval layer returns both — a paragraph AND the diagram that illustrates it.

## Architecture

- **Documents → Azure Blob Storage** — raw file storage, per-user scoping
- **Extraction pipeline** — text chunks + image extraction in parallel
- **text-embedding-3-small** — embeds text and image descriptions into 1536-dim vectors
- **GPT-5-nano** — visual intelligence layer (describes images for embedding)
- **Azure AI Search** — HNSW index, cosine similarity, hybrid retrieval with BM25
- **GPT-4.1** — chat model, reasoning over retrieved context
- **FastAPI** — Python 3.11 backend, JWT validation per request
- **React 18 + Vite** — frontend SPA on Azure Static Web App
- **Entra ID** — Microsoft identity for SSO

## What I learned

Per-user document isolation is a feature, not an implementation detail. Every search query carries a userId filter. No cross-user leakage — ever. Got this right from day one. Retrofitting isolation into a working RAG pipeline after launch is a nightmare.

Hybrid retrieval (HNSW + BM25) beats pure vector search. Vectors catch semantic meaning; BM25 catches exact phrases and names. Weight them together and the relevance jumps noticeably.

Vision LLMs are now good enough to describe images well enough for retrieval. Two years ago this pipeline wouldn't work — image descriptions were too generic to match user queries. GPT-5-nano gets specific enough that "the diagram showing the auth handshake" actually matches.
