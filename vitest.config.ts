import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    fileParallelism: false,
  },
});
