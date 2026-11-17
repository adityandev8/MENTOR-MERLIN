import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Starts an isolated in-memory MongoDB *replica set* (transactions need one).
    globalSetup: ['./tests/globalSetup.ts'],
    // Sets test env vars before any app module (which validates env on import) loads.
    setupFiles: ['./tests/setupEnv.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
