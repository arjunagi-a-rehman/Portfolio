import { useEffect, useState } from 'react';

const STORAGE_KEY = 'portfolio.clientId';

/**
 * Returns a stable per-browser UUID used for idempotent likes and per-client
 * rate limiting. Returns `null` on the first render (before localStorage is
 * available) so consumers can show a skeleton. Falls back to an in-memory UUID
 * if localStorage throws (Safari private mode).
 */
export function useClientId(): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let value: string | null = null;
    try {
      value = window.localStorage.getItem(STORAGE_KEY);
      if (!value) {
        value = crypto.randomUUID();
        window.localStorage.setItem(STORAGE_KEY, value);
      }
    } catch {
      // Safari private mode or other storage failure — use a session-scoped id.
      value = crypto.randomUUID();
    }
    setId(value);
  }, []);

  return id;
}
