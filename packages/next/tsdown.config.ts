import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.tsx', 'src/middleware.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true
});
