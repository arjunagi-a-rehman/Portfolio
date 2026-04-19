import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://arjunagiarehman.com',
  integrations: [sitemap(), react()],
  // Eagerly prefetch every internal link on hover. Combined with <ClientRouter />
  // in Layout.astro this turns click-to-paint into a near-zero-latency swap: the
  // HTML lands in cache while the user is still moving toward the link, and the
  // router then performs an in-place DOM replacement (no white flash, no
  // re-execution of the top-level chrome).
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
});
