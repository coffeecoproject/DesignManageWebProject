import {
  buildPeriodClosePostgresApplyDrillScript,
  validatePeriodClosePostgresApplyDrillScript
} from './periodClosePostgresApplyDrillContract.js';
import { it } from 'vitest';
import { assert, assertEqual } from '../../__tests__/assertions.js';

it('builds a persistent PostgreSQL apply drill script', () => {
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
});

it('exercises period lock, idempotency, source guard audit, and close update fixtures', () => {
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
});

it('fails validation when the apply is rolled back instead of persisted', () => {
  const script = buildPeriodClosePostgresApplyDrillScript();
  const errors = validatePeriodClosePostgresApplyDrillScript({
    ...script,
    sql: script.sql.replace('COMMIT;', 'ROLLBACK;')
  });

  assert(
    errors.some((error) => error.includes('must persist the apply')),
    'validator should reject a rollback-only apply drill'
  );
});
