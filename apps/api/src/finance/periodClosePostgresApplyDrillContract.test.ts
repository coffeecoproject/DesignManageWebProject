import {
  buildPeriodClosePostgresApplyDrillScript,
  validatePeriodClosePostgresApplyDrillSchemaName,
  validatePeriodClosePostgresApplyDrillScript
} from './periodClosePostgresApplyDrillContract.js';

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
    name: 'builds a persistent isolated-schema PostgreSQL apply drill script',
    run: () => {
      const script = buildPeriodClosePostgresApplyDrillScript({
        schemaName: 'period_close_drill_20260704_001'
      });
      const errors = validatePeriodClosePostgresApplyDrillScript(script);

      assertEqual(errors.length, 0, `apply drill script should validate: ${errors.join('; ')}`);
      assertEqual(script.cleanupStrategy, 'drop_isolated_schema', 'apply drill should clean up the isolated schema');
      assertEqual(script.dialect, 'postgresql', 'apply drill dialect should be PostgreSQL');
      assertEqual(script.minimumVersion, '16', 'apply drill should target PostgreSQL 16');
      assert(script.sql.includes('CREATE SCHEMA "period_close_drill_20260704_001";'), 'drill should create the schema');
      assert(script.sql.includes('DROP SCHEMA "period_close_drill_20260704_001" CASCADE;'), 'drill should clean up schema');
      assert(script.sql.includes('COMMIT;'), 'drill should persist isolated migration and fixture writes before cleanup');
      assert(!script.sql.includes('ROLLBACK;'), 'apply drill should not be rollback-only');
      assert(!/\b(DROP\s+TABLE|TRUNCATE|DELETE)\b/i.test(script.sql), 'drill should not destroy tables or rows');
      assert(
        script.sql.includes('period_close_postgres_apply_drill_passed'),
        'drill should emit a stable evidence marker'
      );
    }
  },
  {
    name: 'exercises period lock, idempotency, source guard audit, and close update fixtures',
    run: () => {
      const script = buildPeriodClosePostgresApplyDrillScript({
        schemaName: 'period_close_drill_20260704_002'
      });

      assertEqual(script.fixtureAssertionCount, 4, 'apply drill should keep the fixture assertion count explicit');
      assert(
        script.sql.includes('FOR UPDATE'),
        'apply drill should prove the period row can be locked in the isolated schema'
      );
      assert(
        script.sql.includes('ON CONFLICT ("period", "operation", "idempotency_key") DO NOTHING'),
        'apply drill should prove idempotency conflict handling'
      );
      assert(
        script.sql.includes('"accounting_period_source_mutation_events"'),
        'apply drill should insert a source mutation audit event'
      );
      assert(
        script.sql.includes("AND \"status\" = '已结账'"),
        'apply drill should assert the closed-period update result'
      );
    }
  },
  {
    name: 'rejects unsafe schema names before rendering SQL',
    run: () => {
      const errors = validatePeriodClosePostgresApplyDrillSchemaName('public;drop_schema');

      assert(errors.length > 0, 'unsafe schema names should fail validation');
      assert(
        errors.some((error) => error.includes('Unsafe period-close drill schema name')),
        'unsafe schema validation should explain the failure'
      );
    }
  },
  {
    name: 'returns validation errors for unsafe rendered script metadata',
    run: () => {
      const script = buildPeriodClosePostgresApplyDrillScript({
        schemaName: 'period_close_drill_20260704_004'
      });
      const errors = validatePeriodClosePostgresApplyDrillScript({
        ...script,
        schemaName: 'public'
      });

      assert(
        errors.some((error) => error.includes('isolated period_close_drill_* schema')),
        'validator should return a schema error instead of throwing'
      );
    }
  },
  {
    name: 'fails validation when isolated cleanup is missing',
    run: () => {
      const script = buildPeriodClosePostgresApplyDrillScript({
        schemaName: 'period_close_drill_20260704_003'
      });
      const brokenScript = {
        ...script,
        sql: script.sql.replace('DROP SCHEMA "period_close_drill_20260704_003" CASCADE;', '')
      };
      const errors = validatePeriodClosePostgresApplyDrillScript(brokenScript);

      assert(
        errors.some((error) => error.includes('clean up only the isolated schema')),
        'validator should reject missing isolated schema cleanup'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
