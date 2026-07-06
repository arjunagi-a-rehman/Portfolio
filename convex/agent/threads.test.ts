import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as threads from './threads';

// Contract tests for the thread module — the invariants that make the
// "conversation, not Q&A" model safe:
//
//   1. History is server-held and BOUNDED. The VPS server capped client-sent
//      history at 20 turns; the port must keep an equivalent cap or a long
//      conversation eventually blows the responder's context (and the bill).
//
//   2. Thread tokens are minted server-side with crypto.randomUUID — the
//      token is a capability, so it must never be client-chosen (a client
//      picking its own token could squat on guessable values).
//
//   3. Clients never supply prior turns. appendExchange is the only write
//      path for messages, and it derives the thread from the token.

const THREADS_SRC = readFileSync(path.join(__dirname, 'threads.ts'), 'utf8');

describe('convex/agent/threads contract', () => {
  it('exports the expected functions', () => {
    expect(threads.getOrCreate).toBeDefined();
    expect(threads.appendExchange).toBeDefined();
    expect(threads.getTranscript).toBeDefined();
    expect(threads.checkRateLimit).toBeDefined();
    expect(threads.purgeIdle).toBeDefined();
  });

  it('caps LLM-facing history at 20 turns (VPS parity)', () => {
    expect(threads.MAX_HISTORY_TURNS).toBe(20);
    // The cap must actually be applied to the message read
    expect(THREADS_SRC).toMatch(/\.take\(MAX_HISTORY_TURNS\)/);
  });

  it('mints thread tokens server-side', () => {
    expect(THREADS_SRC).toContain('crypto.randomUUID()');
  });

  it('retains threads for 30 days of inactivity', () => {
    expect(threads.THREAD_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('never trusts a client-supplied thread id as a document id', () => {
    // All thread lookups must go through the by_token index — the Convex
    // document _id is never accepted from the outside.
    expect(THREADS_SRC).not.toMatch(/v\.id\('agentThreads'\)/);
    expect(THREADS_SRC).toMatch(/withIndex\('by_token'/);
  });
});
