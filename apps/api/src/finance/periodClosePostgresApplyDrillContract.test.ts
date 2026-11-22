import {
  buildPeriodClosePostgresApplyDrillScript,
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
    name: 'builds a persistent PostgreSQL apply drill script',
    run: () => {
      const script = buildPeriodClosePostgresApplyDrillScript();
      const errors = validatePeriodClosePostgresApplyDrillScript(script);

      assertEqual(errors.length, 0, `apply drill script should validate: ${errors.join('; ')}`);
      assertEqual(script.dialect, 'postgresql', 'apply drill dialect should be PostgreSQL');
      assertEqual(script.minimumVersion, '16', 'apply drill should target PostgreSQL 16');
      assert(script.sql.includes('COMMIT;'), 'drill should persist migration and fixture writes');
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
      const script = buildPeriodClosePostgresApplyDrillScript();

      assertEqual(script.fixtureAssertionCount, 4, 'apply drill should keep the fixture assertion count explicit');
      assert(
        script.sql.includes('FOR UPDATE'),
        'apply drill should prove the period row can be locked'
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
    name: 'fails validation when the apply is rolled back instead of persisted',
    run: () => {
      const script = buildPeriodClosePostgresApplyDrillScript();
      const errors = validatePeriodClosePostgresApplyDrillScript({
        ...script,
        sql: script.sql.replace('COMMIT;', 'ROLLBACK;')
      });

      assert(
        errors.some((error) => error.includes('must persist the apply')),
        'validator should reject a rollback-only apply drill'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
