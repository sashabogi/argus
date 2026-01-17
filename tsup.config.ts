import { defineConfig } from 'tsup';

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
  },
  // CLI builds with shebang
  {
    entry: {
      cli: 'src/cli.ts',
      mcp: 'src/mcp.ts',
    },
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
