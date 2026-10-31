import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // Files share one Postgres/Redis, so run them one at a time.
    fileParallelism: false,
    // The audit/outbox extension adds a transaction to every write, so DB-heavy tests are slow.
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
    },
  },
});
