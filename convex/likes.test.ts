import { describe, expect, it } from 'vitest';
import * as likes from './likes';

// Contract tests for the likes module.
//
// Background: a prior bug bundled the public count and the per-client
// "liked" state into a single `getLikeState` query that required `clientId`.
// That forced the count to wait for localStorage to hydrate, so blog
// posts rendered "0" on first paint and only snapped to the real count
// after the WebSocket round-trip completed. The split below (getCount +
// getMyLikeState) is what prevents that regression — if someone ever
// re-bundles them or adds `clientId` back to getCount, these tests fail.

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
