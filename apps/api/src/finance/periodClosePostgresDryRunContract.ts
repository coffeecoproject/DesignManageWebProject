import {
  buildPeriodClosePostgresMigrationPlan,
  validatePeriodClosePostgresMigrationPlan,
  type PeriodClosePostgresMigrationPlan,
  type PeriodClosePostgresMigrationStatement
} from './periodClosePostgresMigrationContract.js';

export type PeriodClosePostgresDryRunScript = {
  contractId: string;
  dialect: 'postgresql';
  minimumVersion: '16';
  sql: string;
  validationStatementCount: number;
};

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function extractName(statement: PeriodClosePostgresMigrationStatement, prefix: string) {
  if (!statement.id.startsWith(prefix)) {
    throw new Error(`Statement ${statement.id} does not start with ${prefix}`);
  }

  return statement.id.slice(prefix.length);
}

function renderExistenceAssertion({
  label,
  missingLabelPrefix,
  query
}: {
  label: string;
  missingLabelPrefix: string;
  query: string;
}) {
  return [
    'DO $$',
    'BEGIN',
    '  IF NOT EXISTS (',
    `    ${query}`,
    '  ) THEN',
    `    RAISE EXCEPTION ${sqlString(`${missingLabelPrefix} ${label}`)};`,
    '  END IF;',
    'END',
    '$$;'
  ].join('\n');
}

export function buildPeriodClosePostgresSchemaValidationStatements(
  plan: PeriodClosePostgresMigrationPlan = buildPeriodClosePostgresMigrationPlan(),
  missingLabelPrefix = 'period close schema missing'
) {
  const assertions: string[] = [];

  for (const statement of plan.statements) {
    if (statement.phase === 'enum_types') {
      const typeName = extractName(statement, 'create_type_');
      assertions.push(
        renderExistenceAssertion({
          label: `enum type ${typeName}`,
          missingLabelPrefix,
          query: [
            'SELECT 1',
            'FROM pg_type t',
            'JOIN pg_namespace n ON n.oid = t.typnamespace',
            `WHERE n.nspname = current_schema() AND t.typname = ${sqlString(typeName)}`
          ].join('\n    ')
        })
      );
    }

    if (statement.phase === 'tables') {
      const tableName = extractName(statement, 'create_table_');
      assertions.push(
        renderExistenceAssertion({
          label: `table ${tableName}`,
          missingLabelPrefix,
          query: [
            'SELECT 1 FROM information_schema.tables',
            `WHERE table_schema = current_schema() AND table_name = ${sqlString(tableName)}`
          ].join('\n    ')
        })
      );
    }

    if (statement.phase === 'constraints') {
      const constraintName = extractName(statement, 'create_constraint_');
      assertions.push(
        renderExistenceAssertion({
          label: `constraint ${constraintName}`,
          missingLabelPrefix,
          query: [
            'SELECT 1 FROM pg_constraint',
            `WHERE connamespace = current_schema()::regnamespace AND conname = ${sqlString(constraintName)}`
          ].join('\n    ')
        })
      );
    }

    if (statement.phase === 'indexes') {
      const indexName = extractName(statement, 'create_index_');
      assertions.push(
        renderExistenceAssertion({
          label: `index ${indexName}`,
          missingLabelPrefix,
          query: [
            'SELECT 1 FROM pg_indexes',
            `WHERE schemaname = current_schema() AND indexname = ${sqlString(indexName)}`
          ].join('\n    ')
        })
      );
    }
  }

  return assertions;
}

export function buildPeriodClosePostgresDryRunScript(
  plan: PeriodClosePostgresMigrationPlan = buildPeriodClosePostgresMigrationPlan()
): PeriodClosePostgresDryRunScript {
  const planErrors = validatePeriodClosePostgresMigrationPlan(plan);

  if (planErrors.length > 0) {
    throw new Error(`Cannot build period-close Postgres dry-run script: ${planErrors.join('; ')}`);
  }

  const validationStatements = buildPeriodClosePostgresSchemaValidationStatements(plan, 'period close dry-run missing');
  const migrationSql = plan.statements.map((statement) => statement.sql).join('\n\n');

  return {
    contractId: plan.sourceContractId,
    dialect: 'postgresql',
    minimumVersion: '16',
    validationStatementCount: validationStatements.length,
    sql: [
      '\\set ON_ERROR_STOP on',
      '-- Period close PostgreSQL migration dry-run.',
      `-- Source contract: ${plan.sourceContractId}`,
      '-- This script runs DDL and schema assertions inside one transaction, then rolls back.',
      'BEGIN;',
      "SET LOCAL lock_timeout = '5s';",
      "SET LOCAL statement_timeout = '30s';",
      migrationSql,
      ...validationStatements,
      "SELECT 'period_close_postgres_migration_dry_run_passed' AS evidence_marker;",
      'ROLLBACK;'
    ].join('\n\n')
  };
}

export function validatePeriodClosePostgresDryRunScript(script: PeriodClosePostgresDryRunScript): string[] {
  const errors: string[] = [];

  if (script.dialect !== 'postgresql' || script.minimumVersion !== '16') {
    errors.push('Postgres dry-run script must target PostgreSQL 16');
  }

  if (!script.sql.includes('\\set ON_ERROR_STOP on')) {
    errors.push('Postgres dry-run script must enable psql ON_ERROR_STOP');
  }

  if (!script.sql.includes('BEGIN;') || !script.sql.includes('ROLLBACK;')) {
    errors.push('Postgres dry-run script must run inside a rollback-only transaction');
  }

  if (/\b(COMMIT|DROP|TRUNCATE|DELETE)\b/i.test(script.sql)) {
    errors.push('Postgres dry-run script must not commit or run destructive SQL');
  }

  if (!script.sql.includes('period_close_postgres_migration_dry_run_passed')) {
    errors.push('Postgres dry-run script must emit an evidence marker');
  }

  if (script.validationStatementCount <= 0) {
    errors.push('Postgres dry-run script must include schema validation statements');
  }

  return errors;
}
