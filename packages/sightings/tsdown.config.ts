import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/beacon.ts',
    'src/crawlers.ts',
    'src/redact.ts',
    'src/storage.ts'
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true
});
