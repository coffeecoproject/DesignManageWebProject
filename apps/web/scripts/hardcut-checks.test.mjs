// Hardcut source checks: removed legacy files, tokens and wiring must not come back.
// Acceptance-ID coverage is checked against executed results by scripts/acceptance-evidence-reporter.mjs.
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { assertFrontendDomainStateHardcut } from './frontend-domain-state-hardcut.mjs';
import { assertPerformancePhase6ConsumerHardcut } from './performance-phase6-consumer-hardcut.mjs';
import { assertPerformancePhase7ResidualHardcut } from './performance-phase7-residual-hardcut.mjs';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

it('keeps the performance phase 6 consumer hardcut', async () => {
  const result = await assertPerformancePhase6ConsumerHardcut(webRoot);
  expect(result.checkedFiles).toBeGreaterThan(0);
});

it('keeps the performance phase 7 residual hardcut', async () => {
  const result = await assertPerformancePhase7ResidualHardcut(webRoot);
  expect(result.checkedSourceFiles).toBeGreaterThan(0);
});

it('keeps the frontend domain state hardcut', async () => {
  const result = await assertFrontendDomainStateHardcut(webRoot);
  expect(result.checkedSourceFiles).toBeGreaterThan(0);
});
