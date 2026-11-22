import { readFileSync } from 'node:fs';
import {
  periodCloseNotAppliedMigrationArtifactPath,
  validatePeriodCloseMigrationArtifactFile
} from './periodCloseMigrationArtifactFileContract.js';
import { it } from 'vitest';
import { assert, assertEqual } from '../__tests__/assertions.js';

function readNotAppliedMigrationArtifact() {
  return readFileSync('migrations/not-applied/20260704_000001_period_close_persistent_lock.sql', 'utf8');
}

it('validates the repository not-applied migration artifact file against the project contract', () => {
  const sqlText = readNotAppliedMigrationArtifact();
  const errors = validatePeriodCloseMigrationArtifactFile({
    path: periodCloseNotAppliedMigrationArtifactPath,
    sqlText
  });

  assertEqual(errors.length, 0, `migration artifact file should validate: ${errors.join('; ')}`);
  assert(sqlText.includes('-- Formal apply status: not_applied'), 'artifact file should remain not applied');
  assert(sqlText.includes('CREATE TABLE IF NOT EXISTS "accounting_periods"'), 'artifact file should contain period table DDL');
  assert(
    sqlText.includes('CREATE UNIQUE INDEX IF NOT EXISTS "uk_accounting_period_idempotency_period_operation_key"'),
    'artifact file should contain idempotency uniqueness DDL'
  );
});

it('rejects an artifact file outside the not-applied path', () => {
  const sqlText = readNotAppliedMigrationArtifact();
  const errors = validatePeriodCloseMigrationArtifactFile({
    path: 'apps/api/migrations/applied/20260704_000001_period_close_persistent_lock.sql',
    sqlText
  });

  assert(
    errors.some((error) => error.includes('not-applied migration path')),
    'validator should reject applied or ambiguous paths'
  );
});

it('rejects a repository artifact that claims formal apply', () => {
  const sqlText = readNotAppliedMigrationArtifact().replace(
    '-- Formal apply status: not_applied',
    '-- Formal apply status: applied'
  );
  const errors = validatePeriodCloseMigrationArtifactFile({
    path: periodCloseNotAppliedMigrationArtifactPath,
    sqlText
  });

  assert(
    errors.some((error) => error.includes('stay not_applied')),
    'validator should reject applied status claims'
  );
  assert(
    errors.some((error) => error.includes('match the rendered project migration artifact exactly')),
    'validator should reject content drift'
  );
});

it('rejects destructive edits to the not-applied artifact file', () => {
  const sqlText = `${readNotAppliedMigrationArtifact()}\nDROP TABLE "accounting_periods";`;
  const errors = validatePeriodCloseMigrationArtifactFile({
    path: periodCloseNotAppliedMigrationArtifactPath,
    sqlText
  });

  assert(
    errors.some((error) => error.includes('destructive DDL/DML')),
    'validator should reject destructive SQL drift'
  );
});
