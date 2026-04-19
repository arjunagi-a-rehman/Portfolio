import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as likes from './likes';

// Contract tests for the likes module.
//
// History of bugs these tests pin down:
//
//   1. `getLikeState` bundled public count + per-client liked state into a
//      single query keyed on clientId, so the count flashed "0" on first
//      paint until localStorage hydrated. Fix: split into getCount (no
//      clientId) + getMyLikeState. Regression guard: assert getLikeState
//      no longer exists and the split is intact.
//
//   2. The toggle mutation used a denormalized `likeCounts` counter row
//      per post. Two concurrent first-likes for the same slug could each
//      read "no counter row exists" and then both insert one, leaving
//      duplicates that permanently broke getCount's .unique() call.
//      Fix: count is now derived from the `likes` table on the fly; the
//      `likeCounts` table is no longer read or written. Regression guard:
//      assert the source of convex/likes.ts contains no references to
//      the `likeCounts` table at all.

const LIKES_SRC = readFileSync(path.join(__dirname, 'likes.ts'), 'utf8');

describe('convex/likes public API', () => {
  it('exports a count query independent of clientId', () => {
    expect(likes.getCount).toBeDefined();
  });

  it('exports a per-client liked-state query', () => {
    expect(likes.getMyLikeState).toBeDefined();
  });

  it('exports a toggle mutation', () => {
    expect(likes.toggle).toBeDefined();
  });

  it('does NOT export the old bundled getLikeState query', () => {
    // The bundled query is what caused the "count flashes 0" bug.
    // Re-introducing it would regress the fix from issue [likes-clientid-gate].
    expect((likes as Record<string, unknown>).getLikeState).toBeUndefined();
  });
});

describe('convex/likes counter-race contract', () => {
  it('makes no string-literal reference to the legacy likeCounts table', () => {
    // The whole point of the fix is that `likes` is the single source of
    // truth. Any `.query('likeCounts')`, `.insert('likeCounts', ...)`,
    // `.patch(...)`, etc. reintroduces the race where concurrent first-
    // likes for a slug can each see no counter row and both insert one,
    // leaving duplicates that permanently break getCount. Comments in
    // likes.ts reference the table with backticks, so this regex
    // (quoted 'likeCounts' or "likeCounts" only) won't flag prose.
    expect(LIKES_SRC).not.toMatch(/['"]likeCounts['"]/);
  });
});
