import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node env is enough for pure-data and utility tests. Switch to 'jsdom'
    // if/when we add React component tests.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'convex/**/*.test.ts'],
    // Keep worktrees, build output, and Convex's generated code out.
    exclude: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
      '.claude/worktrees/**',
      'convex/_generated/**',
    ],
  },
});
