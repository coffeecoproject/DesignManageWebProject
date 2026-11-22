import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      allowOnly: false,
      environment: 'node',
      expect: { requireAssertions: true },
      include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
      // Acceptance-ID coverage from executed results; checked when the whole web suite runs.
      reporters: ['default', './scripts/acceptance-evidence-reporter.mjs']
    }
  })
);
