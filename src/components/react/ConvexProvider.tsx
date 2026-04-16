import { ConvexProvider, ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';

const url = import.meta.env.PUBLIC_CONVEX_URL as string | undefined;

if (!url) {
  // Visible in the browser console during dev if the env var was forgotten.
  console.warn(
    '[portfolio] PUBLIC_CONVEX_URL is not set. Comments and likes will not load.'
  );
}

// Module-scope singleton so multiple islands on one page share one WebSocket.
const client = url ? new ConvexReactClient(url) : null;

export function Provider({ children }: { children: ReactNode }) {
  if (!client) {
    return (
      <div className="engagement-error">
        Engagement is offline (missing PUBLIC_CONVEX_URL).
      </div>
    );
  }
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
