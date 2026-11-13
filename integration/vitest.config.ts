import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    environment: 'node',
    // One regtest chain is shared by every test; mining in parallel would interfere.
    fileParallelism: false,
    testTimeout: 240_000,
    hookTimeout: 120_000,
  },
});
