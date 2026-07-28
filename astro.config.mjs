import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { blogPosts } from './src/data/posts.ts';

// Per-page lastmod from stable content dates (modDate, else pubDate). Pages
// without a known content date get no lastmod — stamping deploy time on every
// URL would claim the whole site changed on each release, which teaches
// crawlers to ignore the field entirely.
const lastmodByUrl = new Map(
  blogPosts.map((p) => [
    `https://arjunagiarehman.com${p.slug}/`,
    p.modDate ?? p.pubDate,
  ]),
);

export default defineConfig({
  site: 'https://arjunagiarehman.com',
  integrations: [
    sitemap({
      // noindex utility page — keep it out of the sitemap too.
      filter: (page) => !page.includes('/unsubscribe'),
      serialize: (item) => {
        const lastmod = lastmodByUrl.get(item.url);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
    react(),
  ],
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
