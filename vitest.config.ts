import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    testTimeout: 30000, // 30s for filesystem operations
  },
  resolve: {
    // Support .js imports in TypeScript source
    extensions: ['.ts', '.js'],
  },
});
