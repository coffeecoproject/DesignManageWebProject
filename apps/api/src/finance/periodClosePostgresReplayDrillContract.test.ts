import {
  buildPeriodClosePostgresReplayDrillScript,
  validatePeriodClosePostgresReplayDrillSchemaName,
  validatePeriodClosePostgresReplayDrillScript
} from './periodClosePostgresReplayDrillContract.js';

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
    name: 'builds a persistent PostgreSQL idempotent replay drill script',
    run: () => {
      const script = buildPeriodClosePostgresReplayDrillScript({
        schemaName: 'period_close_drill_20260704_replay_001'
      });
      const errors = validatePeriodClosePostgresReplayDrillScript(script);

      assertEqual(errors.length, 0, `replay drill script should validate: ${errors.join('; ')}`);
      assertEqual(script.cleanupStrategy, 'drop_isolated_schema', 'replay drill should clean up the isolated schema');
      assertEqual(script.dialect, 'postgresql', 'replay drill dialect should be PostgreSQL');
      assertEqual(script.minimumVersion, '16', 'replay drill should target PostgreSQL 16');
      assert(
        script.sql.includes('CREATE SCHEMA "period_close_drill_20260704_replay_001";'),
        'replay drill should create the schema'
      );
      assert(
        script.sql.includes('DROP SCHEMA "period_close_drill_20260704_replay_001" CASCADE;'),
        'replay drill should clean up schema'
      );
      assert(!/\b(DROP\s+TABLE|TRUNCATE|DELETE)\b/i.test(script.sql), 'drill should not destroy tables or rows');
      assert(
        script.sql.includes('period_close_postgres_replay_drill_passed'),
        'drill should emit a stable evidence marker'
      );
    }
  },
  {
    name: 'proves replay reads persisted response without duplicating close artifacts',
    run: () => {
      const script = buildPeriodClosePostgresReplayDrillScript({
        schemaName: 'period_close_drill_20260704_replay_002'
      });

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
    }
  },
  {
    name: 'rejects unsafe schema names before rendering SQL',
    run: () => {
      const errors = validatePeriodClosePostgresReplayDrillSchemaName('public;drop_schema');

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
      const script = buildPeriodClosePostgresReplayDrillScript({
        schemaName: 'period_close_drill_20260704_replay_004'
      });
      const errors = validatePeriodClosePostgresReplayDrillScript({
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
    name: 'fails validation when replay evidence marker is missing',
    run: () => {
      const script = buildPeriodClosePostgresReplayDrillScript({
        schemaName: 'period_close_drill_20260704_replay_003'
      });
      const brokenScript = {
        ...script,
        sql: script.sql.replace("SELECT 'period_close_postgres_replay_drill_passed' AS evidence_marker;", '')
      };
      const errors = validatePeriodClosePostgresReplayDrillScript(brokenScript);

      assert(
        errors.some((error) => error.includes('emit an evidence marker')),
        'validator should reject missing replay evidence marker'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
