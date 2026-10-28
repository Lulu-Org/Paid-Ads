import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['cjs'],
  platform: 'node',
  sourcemap: true,
  clean: true,
  // @lulu/shared points at TypeScript source; bundle it so dist/server.js runs on plain node.
  // Everything else in dependencies stays external (tsup's default).
  noExternal: [/^@lulu\//],
});
