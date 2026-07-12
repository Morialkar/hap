import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/test/**/*.spec.ts', 'src/test/**/*.spec.tsx'],
  },
  resolve: {
    alias: {
      '@hap/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
});
