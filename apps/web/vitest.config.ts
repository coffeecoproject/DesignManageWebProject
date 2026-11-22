import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests need only the React transform; vite.config.ts carries the dev-server port and build chunking.
export default defineConfig({
  plugins: [react()],
  test: {
    allowOnly: false,
    environment: 'node',
    expect: { requireAssertions: true },
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Acceptance-ID coverage from executed results; checked when the whole web suite runs.
    reporters: ['default', './scripts/acceptance-evidence-reporter.mjs']
  }
});
