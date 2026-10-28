import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // Files share one Postgres/Redis, so run them one at a time.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
    },
  },
});
