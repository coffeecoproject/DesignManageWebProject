import { buildPeriodClosePostgresSchemaValidationStatements } from './periodClosePostgresDryRunContract.js';
import {
  buildPeriodClosePostgresMigrationPlan,
  validatePeriodClosePostgresMigrationPlan,
  type PeriodClosePostgresMigrationPlan
} from './periodClosePostgresMigrationContract.js';

export type PeriodClosePostgresConcurrencyDrillSection =
  | 'cleanup'
  | 'contend-lock'
  | 'hold-lock'
  | 'setup'
  | 'verify';

export type PeriodClosePostgresConcurrencyDrillScriptSet = {
  cleanupStrategy: 'drop_isolated_schema';
  contractId: string;
  dialect: 'postgresql';
  minimumVersion: '16';
  schemaName: string;
  scripts: Record<PeriodClosePostgresConcurrencyDrillSection, string>;
};

const drillSchemaNamePattern = /^period_close_drill_[a-z0-9_]+$/;

function quoteIdentifier(identifier: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier ${identifier}`);
  }

  return `"${identifier}"`;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function assertSafeDrillSchemaName(schemaName: string) {
  if (!drillSchemaNamePattern.test(schemaName)) {
    throw new Error(`Unsafe period-close drill schema name ${schemaName}`);
  }
}

function renderSetupSql({
  plan,
  schemaIdentifier,
  schemaName
}: {
  plan: PeriodClosePostgresMigrationPlan;
  schemaIdentifier: string;
  schemaName: string;
}) {
  const migrationSql = plan.statements.map((statement) => statement.sql).join('\n\n');
  const schemaAssertions = buildPeriodClosePostgresSchemaValidationStatements(
    plan,
    'period close concurrency drill missing'
  );

  return [
    '\\set ON_ERROR_STOP on',
    '-- Period close PostgreSQL concurrency drill setup.',
    `-- Isolated schema: ${schemaName}`,
    `DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE;`,
    `CREATE SCHEMA ${schemaIdentifier};`,
    'BEGIN;',
    `SET LOCAL search_path TO ${schemaIdentifier};`,
    "SET LOCAL lock_timeout = '5s';",
    "SET LOCAL statement_timeout = '30s';",
    migrationSql,
    ...schemaAssertions,
    'CREATE TABLE "drill_source_records" (',
    '  "id" text PRIMARY KEY,',
    '  "accounting_period" text NOT NULL,',
    '  "amount" numeric(18,2) NOT NULL,',
    '  "version" integer NOT NULL',
    ');',
    "INSERT INTO \"accounting_periods\" (\"period\", \"status\", \"opened_at\", \"version\", \"created_at\", \"updated_at\") VALUES ('2026-06', '开放', '2026-06-01T00:00:00Z', 1, '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z');",
    "INSERT INTO \"drill_source_records\" (\"id\", \"accounting_period\", \"amount\", \"version\") VALUES ('source-202606-001', '2026-06', 1200.00, 1);",
    'COMMIT;'
  ].join('\n\n');
}

function renderHoldLockSql(schemaIdentifier: string) {
  return [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    `SET LOCAL search_path TO ${schemaIdentifier};`,
    "SET LOCAL lock_timeout = '5s';",
    "SET LOCAL statement_timeout = '10s';",
    'SELECT "period", "status", "version"',
    'FROM "accounting_periods"',
    "WHERE \"period\" = '2026-06'",
    'FOR UPDATE;',
    'SELECT pg_sleep(4);',
    'COMMIT;',
    "SELECT 'period_close_postgres_concurrency_holder_released' AS evidence_marker;"
  ].join('\n');
}

function renderContendLockSql(schemaIdentifier: string) {
  return [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    `SET LOCAL search_path TO ${schemaIdentifier};`,
    "SET LOCAL lock_timeout = '500ms';",
    "SET LOCAL statement_timeout = '5s';",
    'SELECT "period", "status", "version"',
    'FROM "accounting_periods"',
    "WHERE \"period\" = '2026-06'",
    'FOR UPDATE;',
    'COMMIT;'
  ].join('\n');
}

function renderVerifySql(schemaIdentifier: string) {
  return [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    `SET LOCAL search_path TO ${schemaIdentifier};`,
    "SET LOCAL lock_timeout = '5s';",
    "SET LOCAL statement_timeout = '30s';",
    'SELECT "period", "status", "version"',
    'FROM "accounting_periods"',
    "WHERE \"period\" = '2026-06'",
    'FOR UPDATE;',
    "INSERT INTO \"accounting_period_close_checks\" (\"id\", \"period\", \"run_type\", \"can_close\", \"status\", \"computed_at\", \"computed_by\", \"source_version_set_hash\", \"check_snapshot_hash\", \"trial_debit_total\", \"trial_credit_total\", \"trial_balance_difference\", \"trial_balance_status\", \"persisted_for_close\", \"request_id\") VALUES ('check-202606-concurrency-001', '2026-06', 'close_snapshot', true, '通过', '2026-06-30T23:00:00Z', 'user-finance-001', 'source-set-hash-concurrency-001', 'check-hash-concurrency-001', 12800.00, 12800.00, 0.00, '平衡', true, 'req-concurrency-close-001');",
    "INSERT INTO \"accounting_period_close_check_items\" (\"id\", \"close_check_id\", \"period\", \"group_code\", \"group_label\", \"status\", \"can_pass\", \"blocker_count\", \"reason\", \"snapshot\") VALUES ('check-item-202606-concurrency-001', 'check-202606-concurrency-001', '2026-06', 'voucher_booking', '凭证记账', '通过', true, 0, '已完成凭证记账', '{}'::jsonb);",
    [
      'UPDATE "accounting_periods"',
      "SET \"status\" = '已结账',",
      "    \"closed_at\" = '2026-06-30T23:10:00Z',",
      "    \"closed_by\" = 'user-finance-001',",
      "    \"closed_by_snapshot\" = '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb,",
      "    \"close_reason\" = 'period close concurrency drill',",
      "    \"close_check_snapshot_id\" = 'check-202606-concurrency-001',",
      "    \"close_check_snapshot_hash\" = 'check-hash-concurrency-001',",
      '    "version" = "version" + 1,',
      "    \"updated_at\" = '2026-06-30T23:10:00Z'",
      "WHERE \"period\" = '2026-06' AND \"version\" = 1;"
    ].join('\n'),
    [
      'DO $$',
      'BEGIN',
      '  IF NOT EXISTS (',
      '    SELECT 1',
      '    FROM "accounting_periods"',
      "    WHERE \"period\" = '2026-06' AND \"status\" = '已结账' AND \"version\" = 2",
      '  ) THEN',
      `    RAISE EXCEPTION ${sqlString('period close concurrency drill close update failed')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    "INSERT INTO \"accounting_period_events\" (\"id\", \"period\", \"event_type\", \"before_status\", \"after_status\", \"actor_id\", \"actor_snapshot\", \"reason\", \"close_check_id\", \"idempotency_key\", \"request_id\", \"created_at\") VALUES ('event-202606-concurrency-001', '2026-06', 'closed', '开放', '已结账', 'user-finance-001', '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb, 'period close concurrency drill', 'check-202606-concurrency-001', 'concurrency-key-001', 'req-concurrency-close-001', '2026-06-30T23:10:00Z');",
    "INSERT INTO \"accounting_period_idempotency_records\" (\"id\", \"period\", \"operation\", \"idempotency_key\", \"request_signature\", \"response_snapshot\", \"created_at\") VALUES ('idem-202606-concurrency-001', '2026-06', 'close', 'concurrency-key-001', 'request-signature-concurrency-001', '{\"period\":\"2026-06\",\"status\":\"已结账\"}'::jsonb, '2026-06-30T23:10:00Z');",
    'COMMIT;',
    'BEGIN;',
    `SET LOCAL search_path TO ${schemaIdentifier};`,
    "SET LOCAL lock_timeout = '5s';",
    'SELECT "period", "status"',
    'FROM "accounting_periods"',
    "WHERE \"period\" = '2026-06'",
    'FOR UPDATE;',
    [
      'DO $$',
      'BEGIN',
      '  IF EXISTS (',
      '    SELECT 1',
      '    FROM "accounting_periods"',
      "    WHERE \"period\" = '2026-06' AND \"status\" = '已结账'",
      '  ) THEN',
      '    INSERT INTO "accounting_period_source_mutation_events" ("id", "source_area", "source_id", "event_type", "operation", "affected_accounting_periods", "actor_id", "actor_snapshot", "request_id", "created_at")',
      "    VALUES ('source-event-202606-concurrency-001', 'receivable_payable', 'source-202606-001', 'source_mutation_rejected', 'update_receivable_payable', '[\"2026-06\"]'::jsonb, 'user-finance-001', '{\"id\":\"user-finance-001\",\"name\":\"李明\"}'::jsonb, 'req-concurrency-source-001', '2026-06-30T23:11:00Z');",
      '  ELSE',
      '    UPDATE "drill_source_records"',
      '    SET "amount" = 1300.00, "version" = "version" + 1',
      "    WHERE \"id\" = 'source-202606-001';",
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    'COMMIT;',
    `SET search_path TO ${schemaIdentifier};`,
    [
      'DO $$',
      'BEGIN',
      '  IF NOT EXISTS (',
      '    SELECT 1',
      '    FROM "drill_source_records"',
      "    WHERE \"id\" = 'source-202606-001' AND \"amount\" = 1200.00 AND \"version\" = 1",
      '  ) THEN',
      `    RAISE EXCEPTION ${sqlString('period close concurrency drill mutated a closed-period source row')};`,
      '  END IF;',
      '  IF NOT EXISTS (',
      '    SELECT 1',
      '    FROM "accounting_period_source_mutation_events"',
      "    WHERE \"source_id\" = 'source-202606-001' AND \"event_type\" = 'source_mutation_rejected'",
      '  ) THEN',
      `    RAISE EXCEPTION ${sqlString('period close concurrency drill missing source guard audit event')};`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n'),
    "SELECT 'period_close_postgres_concurrency_drill_passed' AS evidence_marker;"
  ].join('\n\n');
}

function renderCleanupSql(schemaIdentifier: string) {
  return [
    '\\set ON_ERROR_STOP on',
    "SET search_path TO public;",
    `DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE;`
  ].join('\n');
}

export function buildPeriodClosePostgresConcurrencyDrillScriptSet({
  plan = buildPeriodClosePostgresMigrationPlan(),
  schemaName
}: {
  plan?: PeriodClosePostgresMigrationPlan;
  schemaName: string;
}): PeriodClosePostgresConcurrencyDrillScriptSet {
  assertSafeDrillSchemaName(schemaName);

  const planErrors = validatePeriodClosePostgresMigrationPlan(plan);

  if (planErrors.length > 0) {
    throw new Error(`Cannot build period-close Postgres concurrency drill script: ${planErrors.join('; ')}`);
  }

  const schemaIdentifier = quoteIdentifier(schemaName);

  return {
    cleanupStrategy: 'drop_isolated_schema',
    contractId: plan.sourceContractId,
    dialect: 'postgresql',
    minimumVersion: '16',
    schemaName,
    scripts: {
      cleanup: renderCleanupSql(schemaIdentifier),
      'contend-lock': renderContendLockSql(schemaIdentifier),
      'hold-lock': renderHoldLockSql(schemaIdentifier),
      setup: renderSetupSql({ plan, schemaIdentifier, schemaName }),
      verify: renderVerifySql(schemaIdentifier)
    }
  };
}

export function validatePeriodClosePostgresConcurrencyDrillScriptSet(
  scriptSet: PeriodClosePostgresConcurrencyDrillScriptSet
): string[] {
  const errors: string[] = [];
  const isSafeSchemaName = drillSchemaNamePattern.test(scriptSet.schemaName);
  const schemaIdentifier = isSafeSchemaName ? quoteIdentifier(scriptSet.schemaName) : '';

  if (scriptSet.dialect !== 'postgresql' || scriptSet.minimumVersion !== '16') {
    errors.push('Postgres concurrency drill must target PostgreSQL 16');
  }

  if (!isSafeSchemaName) {
    errors.push('Postgres concurrency drill must use an isolated period_close_drill_* schema');
  }

  if (isSafeSchemaName && !scriptSet.scripts.setup.includes(`CREATE SCHEMA ${schemaIdentifier};`)) {
    errors.push('Postgres concurrency drill must create the isolated schema');
  }

  if (isSafeSchemaName && !scriptSet.scripts.cleanup.includes(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE;`)) {
    errors.push('Postgres concurrency drill must clean up only the isolated schema');
  }

  if (!scriptSet.scripts['hold-lock'].includes('pg_sleep(4)') || !scriptSet.scripts['hold-lock'].includes('FOR UPDATE')) {
    errors.push('Postgres concurrency drill holder must keep a real row lock open');
  }

  if (
    !scriptSet.scripts['contend-lock'].includes("lock_timeout = '500ms'") ||
    !scriptSet.scripts['contend-lock'].includes('FOR UPDATE')
  ) {
    errors.push('Postgres concurrency drill contender must prove a lock timeout path');
  }

  if (!scriptSet.scripts.verify.includes('period_close_postgres_concurrency_drill_passed')) {
    errors.push('Postgres concurrency drill must emit an evidence marker');
  }

  if (
    !scriptSet.scripts.verify.includes('"accounting_period_source_mutation_events"') ||
    !scriptSet.scripts.verify.includes('"drill_source_records"')
  ) {
    errors.push('Postgres concurrency drill must verify source guard audit without mutating source rows');
  }

  if (/\b(DROP\s+TABLE|TRUNCATE|DELETE)\b/i.test(Object.values(scriptSet.scripts).join('\n'))) {
    errors.push('Postgres concurrency drill must not drop tables, truncate, or delete rows');
  }

  return errors;
}

export function validatePeriodClosePostgresConcurrencyDrillSchemaName(schemaName: string): string[] {
  try {
    assertSafeDrillSchemaName(schemaName);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}
