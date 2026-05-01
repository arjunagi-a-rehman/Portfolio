import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // @vitejs/plugin-react handles JSX transformation (including the React 18+
  // automatic runtime so no `import React` is needed in component files).
  plugins: [react()],
  test: {
    // Default env is node. Component tests opt into jsdom with the
    // // @vitest-environment jsdom docblock at the top of the file.
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
