import { buildPeriodClosePostgresSchemaValidationStatements } from './periodClosePostgresDryRunContract.js';
import {
  buildPeriodClosePostgresMigrationPlan,
  validatePeriodClosePostgresMigrationPlan,
  type PeriodClosePostgresMigrationPlan
} from './periodClosePostgresMigrationContract.js';

// The drill runs in its own empty database (periodClosePostgresDrills.postgres.test.ts) that is deleted afterwards,
// so it applies to the default schema and does no cleanup of its own.
export type PeriodClosePostgresApplyDrillScript = {
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
      "  PERFORM 1 FROM \"accounting_periods\" WHERE \"period\" = '2026-06' FOR UPDATE;",
      '  IF NOT FOUND THEN',
      `    RAISE EXCEPTION ${sqlString('period close apply drill missing locked accounting period fixture')};`,
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
      "    WHERE \"period\" = '2026-06' AND \"operation\" = 'close' AND \"idempotency_key\" = 'drill-key-001'",
      '  ) <> 1 THEN',
      `    RAISE EXCEPTION ${sqlString('period close apply drill idempotency unique key failed')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    [
      'DO $$',
      'BEGIN',
      '  IF NOT EXISTS (',
      '    SELECT 1',
      '    FROM "accounting_period_source_mutation_events"',
      "    WHERE \"source_area\" = 'receivable_payable' AND \"source_id\" = 'RP-DRILL-001'",
      "      AND \"event_type\" = 'source_mutation_rejected'",
      '  ) THEN',
      `    RAISE EXCEPTION ${sqlString('period close apply drill source mutation audit fixture missing')};`,
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
      "    WHERE \"period\" = '2026-06'",
      "      AND \"status\" = '已结账'",
      '      AND "version" = 2',
      "      AND \"close_check_snapshot_id\" = 'check-202606-drill-001'",
      '  ) THEN',
      `    RAISE EXCEPTION ${sqlString('period close apply drill closed-period update fixture missing')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n')
  ];
}

function renderFixtureSql() {
  return [
    'SET LOCAL lock_timeout = \'5s\';',
    'SET LOCAL statement_timeout = \'30s\';',
    "INSERT INTO \"accounting_periods\" (\"period\", \"status\", \"opened_at\", \"version\", \"created_at\", \"updated_at\") VALUES ('2026-06', '开放', '2026-06-01T00:00:00Z', 1, '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z');",
    "INSERT INTO \"accounting_period_close_checks\" (\"id\", \"period\", \"run_type\", \"can_close\", \"status\", \"computed_at\", \"computed_by\", \"source_version_set_hash\", \"check_snapshot_hash\", \"trial_debit_total\", \"trial_credit_total\", \"trial_balance_difference\", \"trial_balance_status\", \"persisted_for_close\", \"request_id\") VALUES ('check-202606-drill-001', '2026-06', 'close_snapshot', true, '通过', '2026-06-30T23:00:00Z', 'user-finance-001', 'source-set-hash-001', 'check-hash-001', 12800.00, 12800.00, 0.00, '平衡', true, 'req-drill-001');",
    "INSERT INTO \"accounting_period_close_check_items\" (\"id\", \"close_check_id\", \"period\", \"group_code\", \"group_label\", \"status\", \"can_pass\", \"blocker_count\", \"reason\", \"snapshot\") VALUES ('check-item-202606-drill-001', 'check-202606-drill-001', '2026-06', 'voucher_booking', '凭证记账', '通过', true, 0, '已完成凭证记账', '{}'::jsonb);",
    ...renderFixtureAssertions().slice(0, 1),
    [
      'UPDATE "accounting_periods"',
      "SET \"status\" = '已结账',",
      "    \"closed_at\" = '2026-06-30T23:10:00Z',",
      "    \"closed_by\" = 'user-finance-001',",
      "    \"closed_by_snapshot\" = '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb,",
      "    \"close_reason\" = 'period close apply drill',",
      "    \"close_check_snapshot_id\" = 'check-202606-drill-001',",
      "    \"close_check_snapshot_hash\" = 'check-hash-001',",
      '    "version" = "version" + 1,',
      "    \"updated_at\" = '2026-06-30T23:10:00Z'",
      "WHERE \"period\" = '2026-06' AND \"version\" = 1;"
    ].join('\n'),
    "INSERT INTO \"accounting_period_events\" (\"id\", \"period\", \"event_type\", \"before_status\", \"after_status\", \"actor_id\", \"actor_snapshot\", \"reason\", \"close_check_id\", \"idempotency_key\", \"request_id\", \"created_at\") VALUES ('event-202606-drill-001', '2026-06', 'closed', '开放', '已结账', 'user-finance-001', '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb, 'period close apply drill', 'check-202606-drill-001', 'drill-key-001', 'req-drill-001', '2026-06-30T23:10:00Z');",
    "INSERT INTO \"accounting_period_idempotency_records\" (\"id\", \"period\", \"operation\", \"idempotency_key\", \"request_signature\", \"response_snapshot\", \"created_at\") VALUES ('idem-202606-drill-001', '2026-06', 'close', 'drill-key-001', 'request-signature-001', '{\"period\":\"2026-06\",\"status\":\"已结账\"}'::jsonb, '2026-06-30T23:10:00Z');",
    "INSERT INTO \"accounting_period_idempotency_records\" (\"id\", \"period\", \"operation\", \"idempotency_key\", \"request_signature\", \"response_snapshot\", \"created_at\") VALUES ('idem-202606-drill-duplicate', '2026-06', 'close', 'drill-key-001', 'request-signature-001', '{\"period\":\"2026-06\",\"status\":\"已结账\"}'::jsonb, '2026-06-30T23:10:01Z') ON CONFLICT (\"period\", \"operation\", \"idempotency_key\") DO NOTHING;",
    "INSERT INTO \"accounting_period_source_mutation_events\" (\"id\", \"source_area\", \"source_id\", \"event_type\", \"operation\", \"affected_accounting_periods\", \"actor_id\", \"actor_snapshot\", \"request_id\", \"created_at\") VALUES ('source-event-202606-drill-001', 'receivable_payable', 'RP-DRILL-001', 'source_mutation_rejected', 'update_receivable_payable', '[\"2026-06\"]'::jsonb, 'user-finance-001', '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb, 'req-drill-source-001', '2026-06-30T23:11:00Z');",
    ...renderFixtureAssertions().slice(1)
  ].join('\n\n');
}

export function buildPeriodClosePostgresApplyDrillScript({
  plan = buildPeriodClosePostgresMigrationPlan()
}: {
  plan?: PeriodClosePostgresMigrationPlan;
} = {}): PeriodClosePostgresApplyDrillScript {
  const planErrors = validatePeriodClosePostgresMigrationPlan(plan);

  if (planErrors.length > 0) {
    throw new Error(`Cannot build period-close Postgres apply drill script: ${planErrors.join('; ')}`);
  }

  const migrationSql = plan.statements.map((statement) => statement.sql).join('\n\n');
  const schemaAssertions = buildPeriodClosePostgresSchemaValidationStatements(
    plan,
    'period close apply drill missing'
  );
  const fixtureSql = renderFixtureSql();
  const fixtureAssertionCount = renderFixtureAssertions().length;

  return {
    contractId: plan.sourceContractId,
    dialect: 'postgresql',
    fixtureAssertionCount,
    minimumVersion: '16',
    sql: [
      '\\set ON_ERROR_STOP on',
      '-- Period close PostgreSQL persistent apply drill, run in a throwaway database.',
      `-- Source contract: ${plan.sourceContractId}`,
      'BEGIN;',
      "SET LOCAL lock_timeout = '5s';",
      "SET LOCAL statement_timeout = '30s';",
      migrationSql,
      ...schemaAssertions,
      'COMMIT;',
      'BEGIN;',
      fixtureSql,
      'COMMIT;',
      "SELECT 'period_close_postgres_apply_drill_passed' AS evidence_marker;"
    ].join('\n\n')
  };
}

export function validatePeriodClosePostgresApplyDrillScript(script: PeriodClosePostgresApplyDrillScript): string[] {
  const errors: string[] = [];

  if (script.dialect !== 'postgresql' || script.minimumVersion !== '16') {
    errors.push('Postgres apply drill script must target PostgreSQL 16');
  }

  if (!script.sql.includes('COMMIT;') || script.sql.includes('ROLLBACK;')) {
    errors.push('Postgres apply drill script must persist the apply');
  }

  if (/\b(DROP\s+TABLE|TRUNCATE|DELETE)\b/i.test(script.sql)) {
    errors.push('Postgres apply drill script must not drop tables, truncate, or delete rows');
  }

  if (!script.sql.includes('ON CONFLICT ("period", "operation", "idempotency_key") DO NOTHING')) {
    errors.push('Postgres apply drill script must exercise the idempotency unique key');
  }

  if (!script.sql.includes('"accounting_period_source_mutation_events"')) {
    errors.push('Postgres apply drill script must exercise source mutation guard audit rows');
  }

  if (!script.sql.includes('period_close_postgres_apply_drill_passed')) {
    errors.push('Postgres apply drill script must emit an evidence marker');
  }

  if (script.fixtureAssertionCount < 4) {
    errors.push('Postgres apply drill script must assert the fixture write path');
  }

  return errors;
}
