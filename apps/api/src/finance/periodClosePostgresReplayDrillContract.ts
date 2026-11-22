import { buildPeriodClosePostgresSchemaValidationStatements } from './periodClosePostgresDryRunContract.js';
import {
  buildPeriodClosePostgresMigrationPlan,
  validatePeriodClosePostgresMigrationPlan,
  type PeriodClosePostgresMigrationPlan
} from './periodClosePostgresMigrationContract.js';

// The drill runs in a throwaway database (scripts/local/temp-db.sh) that is deleted afterwards,
// so it applies to the default schema and does no cleanup of its own.
export type PeriodClosePostgresReplayDrillScript = {
  contractId: string;
  dialect: 'postgresql';
  fixtureAssertionCount: number;
  minimumVersion: '16';
  sql: string;
};

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderFixtureAssertions() {
  return [
    [
      'DO $$',
      'BEGIN',
      '  IF (',
      '    SELECT COUNT(*)',
      '    FROM "accounting_period_close_checks"',
      "    WHERE \"period\" = '2026-06' AND \"run_type\" = 'close_snapshot'",
      '  ) <> 1 THEN',
      `    RAISE EXCEPTION ${sqlString('period close replay drill duplicated close snapshot rows')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    [
      'DO $$',
      'BEGIN',
      '  IF (',
      '    SELECT COUNT(*)',
      '    FROM "accounting_period_events"',
      "    WHERE \"period\" = '2026-06' AND \"idempotency_key\" = 'replay-key-001'",
      '  ) <> 1 THEN',
      `    RAISE EXCEPTION ${sqlString('period close replay drill duplicated close events')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    [
      'DO $$',
      'BEGIN',
      '  IF (',
      '    SELECT COUNT(*)',
      '    FROM "accounting_period_idempotency_records"',
      "    WHERE \"period\" = '2026-06' AND \"operation\" = 'close' AND \"idempotency_key\" = 'replay-key-001'",
      '  ) <> 1 THEN',
      `    RAISE EXCEPTION ${sqlString('period close replay drill duplicated idempotency rows')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    [
      'DO $$',
      'DECLARE',
      '  replay_response jsonb;',
      'BEGIN',
      '  SELECT "response_snapshot"',
      '  INTO replay_response',
      '  FROM "accounting_period_idempotency_records"',
      "  WHERE \"period\" = '2026-06' AND \"operation\" = 'close' AND \"idempotency_key\" = 'replay-key-001'",
      '  FOR UPDATE;',
      '',
      '  IF replay_response IS NULL OR replay_response->>\'status\' <> \'已结账\' THEN',
      `    RAISE EXCEPTION ${sqlString('period close replay drill missing persisted replay response')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    [
      'DO $$',
      'BEGIN',
      '  IF NOT EXISTS (',
      '    SELECT 1',
      '    FROM "accounting_periods"',
      "    WHERE \"period\" = '2026-06' AND \"status\" = '已结账' AND \"version\" = 2",
      '  ) THEN',
      `    RAISE EXCEPTION ${sqlString('period close replay drill closed-period row drifted')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n')
  ];
}

function renderInitialCloseSql() {
  return [
    "INSERT INTO \"accounting_periods\" (\"period\", \"status\", \"opened_at\", \"version\", \"created_at\", \"updated_at\") VALUES ('2026-06', '开放', '2026-06-01T00:00:00Z', 1, '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z');",
    'SELECT "period", "status", "version"',
    'FROM "accounting_periods"',
    "WHERE \"period\" = '2026-06'",
    'FOR UPDATE;',
    "INSERT INTO \"accounting_period_close_checks\" (\"id\", \"period\", \"run_type\", \"can_close\", \"status\", \"computed_at\", \"computed_by\", \"source_version_set_hash\", \"check_snapshot_hash\", \"trial_debit_total\", \"trial_credit_total\", \"trial_balance_difference\", \"trial_balance_status\", \"persisted_for_close\", \"request_id\") VALUES ('check-202606-replay-001', '2026-06', 'close_snapshot', true, '通过', '2026-06-30T23:00:00Z', 'user-finance-001', 'source-set-hash-replay-001', 'check-hash-replay-001', 12800.00, 12800.00, 0.00, '平衡', true, 'req-replay-close-001');",
    "INSERT INTO \"accounting_period_close_check_items\" (\"id\", \"close_check_id\", \"period\", \"group_code\", \"group_label\", \"status\", \"can_pass\", \"blocker_count\", \"reason\", \"snapshot\") VALUES ('check-item-202606-replay-001', 'check-202606-replay-001', '2026-06', 'voucher_booking', '凭证记账', '通过', true, 0, '已完成凭证记账', '{}'::jsonb);",
    [
      'UPDATE "accounting_periods"',
      "SET \"status\" = '已结账',",
      "    \"closed_at\" = '2026-06-30T23:10:00Z',",
      "    \"closed_by\" = 'user-finance-001',",
      "    \"closed_by_snapshot\" = '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb,",
      "    \"close_reason\" = 'period close replay drill',",
      "    \"close_check_snapshot_id\" = 'check-202606-replay-001',",
      "    \"close_check_snapshot_hash\" = 'check-hash-replay-001',",
      '    "version" = "version" + 1,',
      "    \"updated_at\" = '2026-06-30T23:10:00Z'",
      "WHERE \"period\" = '2026-06' AND \"version\" = 1;"
    ].join('\n'),
    "INSERT INTO \"accounting_period_events\" (\"id\", \"period\", \"event_type\", \"before_status\", \"after_status\", \"actor_id\", \"actor_snapshot\", \"reason\", \"close_check_id\", \"idempotency_key\", \"request_id\", \"created_at\") VALUES ('event-202606-replay-001', '2026-06', 'closed', '开放', '已结账', 'user-finance-001', '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb, 'period close replay drill', 'check-202606-replay-001', 'replay-key-001', 'req-replay-close-001', '2026-06-30T23:10:00Z');",
    "INSERT INTO \"accounting_period_idempotency_records\" (\"id\", \"period\", \"operation\", \"idempotency_key\", \"request_signature\", \"response_snapshot\", \"created_at\") VALUES ('idem-202606-replay-001', '2026-06', 'close', 'replay-key-001', 'request-signature-replay-001', '{\"period\":\"2026-06\",\"status\":\"已结账\",\"closeSnapshotId\":\"check-202606-replay-001\"}'::jsonb, '2026-06-30T23:10:00Z');"
  ].join('\n\n');
}

function renderReplaySql() {
  return [
    '-- Simulate a new request after process restart: read the persisted idempotency response and write nothing.',
    'SELECT "response_snapshot"',
    'FROM "accounting_period_idempotency_records"',
    "WHERE \"period\" = '2026-06' AND \"operation\" = 'close' AND \"idempotency_key\" = 'replay-key-001'",
    'FOR UPDATE;',
    ...renderFixtureAssertions()
  ].join('\n\n');
}

export function buildPeriodClosePostgresReplayDrillScript({
  plan = buildPeriodClosePostgresMigrationPlan()
}: {
  plan?: PeriodClosePostgresMigrationPlan;
} = {}): PeriodClosePostgresReplayDrillScript {
  const planErrors = validatePeriodClosePostgresMigrationPlan(plan);

  if (planErrors.length > 0) {
    throw new Error(`Cannot build period-close Postgres replay drill script: ${planErrors.join('; ')}`);
  }

  const migrationSql = plan.statements.map((statement) => statement.sql).join('\n\n');
  const schemaAssertions = buildPeriodClosePostgresSchemaValidationStatements(
    plan,
    'period close replay drill missing'
  );
  const fixtureAssertionCount = renderFixtureAssertions().length;

  return {
    contractId: plan.sourceContractId,
    dialect: 'postgresql',
    fixtureAssertionCount,
    minimumVersion: '16',
    sql: [
      '\\set ON_ERROR_STOP on',
      '-- Period close PostgreSQL persisted idempotent replay drill, run in a throwaway database.',
      `-- Source contract: ${plan.sourceContractId}`,
      'BEGIN;',
      "SET LOCAL lock_timeout = '5s';",
      "SET LOCAL statement_timeout = '30s';",
      migrationSql,
      ...schemaAssertions,
      'COMMIT;',
      'BEGIN;',
      "SET LOCAL lock_timeout = '5s';",
      "SET LOCAL statement_timeout = '30s';",
      renderInitialCloseSql(),
      'COMMIT;',
      'BEGIN;',
      "SET LOCAL lock_timeout = '5s';",
      "SET LOCAL statement_timeout = '30s';",
      renderReplaySql(),
      'COMMIT;',
      "SELECT 'period_close_postgres_replay_drill_passed' AS evidence_marker;"
    ].join('\n\n')
  };
}

export function validatePeriodClosePostgresReplayDrillScript(script: PeriodClosePostgresReplayDrillScript): string[] {
  const errors: string[] = [];

  if (script.dialect !== 'postgresql' || script.minimumVersion !== '16') {
    errors.push('Postgres replay drill script must target PostgreSQL 16');
  }

  if (!script.sql.includes('FOR UPDATE')) {
    errors.push('Postgres replay drill script must lock persisted period/idempotency rows');
  }

  if (/\b(DROP\s+TABLE|TRUNCATE|DELETE)\b/i.test(script.sql)) {
    errors.push('Postgres replay drill script must not drop tables, truncate, or delete rows');
  }

  if (!script.sql.includes('FROM "accounting_period_idempotency_records"')) {
    errors.push('Postgres replay drill script must read persisted idempotency rows');
  }

  if (!script.sql.includes('duplicated close snapshot rows')) {
    errors.push('Postgres replay drill script must assert close snapshot rows are not duplicated');
  }

  if (!script.sql.includes('duplicated close events')) {
    errors.push('Postgres replay drill script must assert close events are not duplicated');
  }

  if (!script.sql.includes('duplicated idempotency rows')) {
    errors.push('Postgres replay drill script must assert idempotency rows are not duplicated');
  }

  if (!script.sql.includes('period_close_postgres_replay_drill_passed')) {
    errors.push('Postgres replay drill script must emit an evidence marker');
  }

  if (script.fixtureAssertionCount < 5) {
    errors.push('Postgres replay drill script must assert persisted replay invariants');
  }

  return errors;
}
