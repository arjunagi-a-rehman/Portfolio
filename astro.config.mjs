import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://arjunagiarehman.com',
  integrations: [sitemap(), react()],
});
