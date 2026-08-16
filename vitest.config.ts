import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (path: string) =>
  fileURLToPath(new URL(`./packages/sightings/src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against source, so a green suite never depends on whether
    // `dist` happens to be fresh.
    alias: [
      { find: /^sightings$/, replacement: src('index.ts') },
      { find: /^sightings\/(.*)$/, replacement: src('$1.ts') }
    ]
  },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts']
  }
});
