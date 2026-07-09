import {
  buildPeriodClosePostgresDryRunScript,
  validatePeriodClosePostgresDryRunScript
} from './periodClosePostgresDryRunContract.js';
import { buildPeriodClosePostgresMigrationPlan } from './periodClosePostgresMigrationContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const tests: UnitTest[] = [
  {
    name: 'builds a rollback-only psql dry-run script from the PostgreSQL migration plan',
    run: () => {
      const script = buildPeriodClosePostgresDryRunScript();
      const errors = validatePeriodClosePostgresDryRunScript(script);

      assertEqual(errors.length, 0, `dry-run script should validate: ${errors.join('; ')}`);
      assertEqual(script.dialect, 'postgresql', 'dry-run dialect should be PostgreSQL');
      assertEqual(script.minimumVersion, '16', 'dry-run should target PostgreSQL 16');
      assert(script.sql.includes('\\set ON_ERROR_STOP on'), 'dry-run should fail fast in psql');
      assert(script.sql.includes('BEGIN;'), 'dry-run should start a transaction');
      assert(script.sql.includes('ROLLBACK;'), 'dry-run should roll back migration changes');
      assert(!/\bCOMMIT\b/i.test(script.sql), 'dry-run should not commit migration changes');
      assert(
        script.sql.includes('period_close_postgres_migration_dry_run_passed'),
        'dry-run should emit a stable evidence marker'
      );
    }
  },
  {
    name: 'asserts every generated enum, table, constraint, and index inside the dry-run transaction',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const script = buildPeriodClosePostgresDryRunScript(plan);

      assertEqual(
        script.validationStatementCount,
        plan.statements.length,
        'dry-run should validate every generated statement'
      );
      assert(
        script.sql.includes("RAISE EXCEPTION 'period close dry-run missing enum type accounting_period_status'"),
        'dry-run should assert enum creation'
      );
      assert(
        script.sql.includes("RAISE EXCEPTION 'period close dry-run missing table accounting_periods'"),
        'dry-run should assert table creation'
      );
      assert(
        script.sql.includes(
          "RAISE EXCEPTION 'period close dry-run missing constraint fk_accounting_periods_close_check_snapshot_id'"
        ),
        'dry-run should assert deferred foreign-key creation'
      );
      assert(
        script.sql.includes(
          "RAISE EXCEPTION 'period close dry-run missing index uk_accounting_period_idempotency_period_operation_key'"
        ),
        'dry-run should assert index creation'
      );
    }
  },
  {
    name: 'fails validation when rollback protection is removed',
    run: () => {
      const script = buildPeriodClosePostgresDryRunScript();
      const brokenScript = {
        ...script,
        sql: script.sql.replace('ROLLBACK;', 'COMMIT;')
      };
      const errors = validatePeriodClosePostgresDryRunScript(brokenScript);

      assert(
        errors.some((error) => error.includes('must not commit')),
        'validator should reject a dry-run script that commits'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
