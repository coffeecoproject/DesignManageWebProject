import {
  buildPeriodClosePostgresConcurrencyDrillScriptSet,
  validatePeriodClosePostgresConcurrencyDrillSchemaName,
  validatePeriodClosePostgresConcurrencyDrillScriptSet
} from './periodClosePostgresConcurrencyDrillContract.js';

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
    name: 'builds a multi-session isolated-schema PostgreSQL concurrency drill',
    run: () => {
      const scriptSet = buildPeriodClosePostgresConcurrencyDrillScriptSet({
        schemaName: 'period_close_drill_20260704_lock_001'
      });
      const errors = validatePeriodClosePostgresConcurrencyDrillScriptSet(scriptSet);

      assertEqual(errors.length, 0, `concurrency drill should validate: ${errors.join('; ')}`);
      assertEqual(scriptSet.cleanupStrategy, 'drop_isolated_schema', 'drill should clean up the isolated schema');
      assert(scriptSet.scripts.setup.includes('CREATE SCHEMA "period_close_drill_20260704_lock_001";'), 'setup should create schema');
      assert(
        scriptSet.scripts.cleanup.includes('DROP SCHEMA IF EXISTS "period_close_drill_20260704_lock_001" CASCADE;'),
        'cleanup should drop only the drill schema'
      );
    }
  },
  {
    name: 'requires holder and contender scripts to use real row locks',
    run: () => {
      const scriptSet = buildPeriodClosePostgresConcurrencyDrillScriptSet({
        schemaName: 'period_close_drill_20260704_lock_002'
      });

      assert(scriptSet.scripts['hold-lock'].includes('FOR UPDATE'), 'holder should lock the period row');
      assert(scriptSet.scripts['hold-lock'].includes('pg_sleep(4)'), 'holder should keep the transaction open');
      assert(scriptSet.scripts['contend-lock'].includes("lock_timeout = '500ms'"), 'contender should fail quickly');
      assert(scriptSet.scripts['contend-lock'].includes('FOR UPDATE'), 'contender should contend for the same row');
    }
  },
  {
    name: 'verifies close update and closed-period source guard after lock release',
    run: () => {
      const scriptSet = buildPeriodClosePostgresConcurrencyDrillScriptSet({
        schemaName: 'period_close_drill_20260704_lock_003'
      });

      assert(
        scriptSet.scripts.verify.includes('period_close_postgres_concurrency_drill_passed'),
        'verify should emit a stable evidence marker'
      );
      assert(
        scriptSet.scripts.verify.includes('"status" = \'已结账\''),
        'verify should close the period after the lock is released'
      );
      assert(
        scriptSet.scripts.verify.includes('"drill_source_records"'),
        'verify should keep a source-row fixture for mutation checks'
      );
      assert(
        scriptSet.scripts.verify.includes('source_mutation_rejected'),
        'verify should write a closed-period source guard audit event'
      );
    }
  },
  {
    name: 'rejects unsafe schema names',
    run: () => {
      const errors = validatePeriodClosePostgresConcurrencyDrillSchemaName('period_close_drill_bad-name');

      assert(errors.length > 0, 'unsafe schema names should fail validation');
      assert(
        errors.some((error) => error.includes('Unsafe period-close drill schema name')),
        'unsafe schema validation should explain the failure'
      );
    }
  },
  {
    name: 'fails validation when contender no longer uses a lock timeout',
    run: () => {
      const scriptSet = buildPeriodClosePostgresConcurrencyDrillScriptSet({
        schemaName: 'period_close_drill_20260704_lock_004'
      });
      const brokenScriptSet = {
        ...scriptSet,
        scripts: {
          ...scriptSet.scripts,
          'contend-lock': scriptSet.scripts['contend-lock'].replace("SET LOCAL lock_timeout = '500ms';", '')
        }
      };
      const errors = validatePeriodClosePostgresConcurrencyDrillScriptSet(brokenScriptSet);

      assert(
        errors.some((error) => error.includes('lock timeout')),
        'validator should reject a contender without lock timeout'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
