import {
  buildPeriodClosePostgresReplayDrillScript,
  validatePeriodClosePostgresReplayDrillScript
} from './periodClosePostgresReplayDrillContract.js';
import { it } from 'vitest';
import { assert, assertEqual } from '../../__tests__/assertions.js';

it('builds a persistent PostgreSQL idempotent replay drill script', () => {
  const script = buildPeriodClosePostgresReplayDrillScript();
  const errors = validatePeriodClosePostgresReplayDrillScript(script);

  assertEqual(errors.length, 0, `replay drill script should validate: ${errors.join('; ')}`);
  assertEqual(script.dialect, 'postgresql', 'replay drill dialect should be PostgreSQL');
  assertEqual(script.minimumVersion, '16', 'replay drill should target PostgreSQL 16');
  assert(!/\b(DROP\s+TABLE|TRUNCATE|DELETE)\b/i.test(script.sql), 'drill should not destroy tables or rows');
  assert(
    script.sql.includes('period_close_postgres_replay_drill_passed'),
    'drill should emit a stable evidence marker'
  );
});

it('proves replay reads persisted response without duplicating close artifacts', () => {
  const script = buildPeriodClosePostgresReplayDrillScript();

  assertEqual(script.fixtureAssertionCount, 5, 'replay drill should keep the fixture assertion count explicit');
  assert(script.sql.includes('FOR UPDATE'), 'replay drill should lock persisted period and idempotency rows');
  assert(
    script.sql.includes('FROM "accounting_period_idempotency_records"'),
    'replay drill should read the persisted idempotency response'
  );
  assert(
    script.sql.includes('duplicated close snapshot rows'),
    'replay drill should assert close snapshots are not duplicated'
  );
  assert(
    script.sql.includes('duplicated close events'),
    'replay drill should assert close events are not duplicated'
  );
  assert(
    script.sql.includes('duplicated idempotency rows'),
    'replay drill should assert idempotency rows are not duplicated'
  );
});

it('fails validation when replay evidence marker is missing', () => {
  const script = buildPeriodClosePostgresReplayDrillScript();
  const brokenScript = {
    ...script,
    sql: script.sql.replace("SELECT 'period_close_postgres_replay_drill_passed' AS evidence_marker;", '')
  };
  const errors = validatePeriodClosePostgresReplayDrillScript(brokenScript);

  assert(
    errors.some((error) => error.includes('emit an evidence marker')),
    'validator should reject missing replay evidence marker'
  );
});
