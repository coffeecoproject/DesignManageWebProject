import { readFileSync } from 'node:fs';
import {
  periodCloseNotAppliedMigrationArtifactPath,
  validatePeriodCloseMigrationArtifactFile
} from '../node_modules/.cache/startupmanage-api-contract-tests/finance/periodCloseMigrationArtifactFileContract.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function readNotAppliedMigrationArtifact() {
  return readFileSync('migrations/not-applied/20260704_000001_period_close_persistent_lock.sql', 'utf8');
}

const tests = [
  {
    name: 'validates the repository not-applied migration artifact file against the project contract',
    run: () => {
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
    }
  },
  {
    name: 'rejects an artifact file outside the not-applied path',
    run: () => {
      const sqlText = readNotAppliedMigrationArtifact();
      const errors = validatePeriodCloseMigrationArtifactFile({
        path: 'apps/api/migrations/applied/20260704_000001_period_close_persistent_lock.sql',
        sqlText
      });

      assert(
        errors.some((error) => error.includes('not-applied migration path')),
        'validator should reject applied or ambiguous paths'
      );
    }
  },
  {
    name: 'rejects a repository artifact that claims formal apply',
    run: () => {
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
    }
  },
  {
    name: 'rejects destructive edits to the not-applied artifact file',
    run: () => {
      const sqlText = `${readNotAppliedMigrationArtifact()}\nDROP TABLE "accounting_periods";`;
      const errors = validatePeriodCloseMigrationArtifactFile({
        path: periodCloseNotAppliedMigrationArtifactPath,
        sqlText
      });

      assert(
        errors.some((error) => error.includes('destructive DDL/DML')),
        'validator should reject destructive SQL drift'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
