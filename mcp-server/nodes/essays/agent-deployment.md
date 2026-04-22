---
id: essay-agent-deployment
title: "Deploying Your AI Agent: From Code to Production"
source: essay
url: /agent-deployment-1
date: "2025-01-01"
tags:
  - deployment
  - fastapi
  - docker
  - production
  - ai-agents
  - session-management
  - rate-limiting
summary: "A production deployment guide for AI agents using FastAPI — covers REST API architecture, session management, rate limiting, Docker containerization, and the decisions that matter at scale."
---

## What this essay covers

Part 3 of the AI Agent System Series. Takes the Study Buddy agent from Part 2 and deploys it as a production REST API. This is where theory meets infrastructure.

## The production API shape

The agent exposes two endpoints:
- `POST /chat` — send a message, get a response (stateless from the HTTP perspective, stateful inside via session ID)
- `GET /health` — liveness probe for orchestrators

```python
@app.post("/chat")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks):
    session = await session_service.get_or_create(request.session_id)
    response = await agent.run(request.message, session=session)
    background_tasks.add_task(persist_session, session)
    return ChatResponse(message=response, session_id=session.id)
```

The session ID is the user's responsibility to store and send — that keeps the server stateless between requests.

## Session management at scale

In-memory sessions don't survive restarts. For production, use Redis:

```python
class RedisSessionService:
    def __init__(self, redis_url: str, ttl: int = 3600):
        self.redis = aioredis.from_url(redis_url)
        self.ttl = ttl  # 1 hour session TTL

    async def get_or_create(self, session_id: str) -> Session:
        raw = await self.redis.get(f"session:{session_id}")
        if raw:
            return Session.model_validate_json(raw)
        return Session(id=session_id, history=[])
```

One hour TTL is sensible for most study session use cases. Adjust based on your users' actual session patterns.

## Rate limiting

Agents are expensive. A single user can blow through your entire monthly LLM budget in an afternoon if you don't rate-limit.

I use `slowapi` with a Redis backend:

```python
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)

@app.post("/chat")
@limiter.limit("10/minute")
async def chat(request: Request, body: ChatRequest):
    ...
```

10 req/min per IP is conservative but prevents abuse. For authenticated users, you can raise it.

## Docker setup

The Dockerfile that actually works in production (not the tutorial version):

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user for security
RUN useradd -m -u 1000 agent
USER agent

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Multi-worker is important — single-worker FastAPI will block on LLM calls that take 2-5 seconds. With 2 workers you can handle concurrent requests without queuing.

## What breaks in production that didn't break locally

1. **Long LLM responses timeout** — set `timeout=30` on your HTTP client, not the default infinite
2. **Session store full** — add TTL from day one, not after your Redis fills up
3. **Tool errors cascade** — one broken tool silently degrades the agent; log tool call failures explicitly
4. **Context window creep** — conversation history grows per session; trim to last N turns or use a summarization step

The agents that work in production are the ones built with production failure modes in mind from the start. Demo agents are built to work. Production agents are built to fail gracefully.
