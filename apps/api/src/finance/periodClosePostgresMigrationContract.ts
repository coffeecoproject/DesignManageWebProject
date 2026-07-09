import { requiredCloseCheckCodes } from './periodCloseContract.js';
import {
  periodCloseSqlMigrationContract,
  validatePeriodCloseSqlMigrationContract,
  type PeriodCloseSqlIndex,
  type PeriodCloseSqlMigrationContract
} from './periodCloseSqlRepositoryContract.js';
import type {
  PeriodCloseDatabaseColumn,
  PeriodCloseDatabaseTable,
  PeriodCloseDatabaseTableName
} from './periodCloseDatabaseContract.js';

export type PeriodClosePostgresStatementPhase = 'enum_types' | 'tables' | 'constraints' | 'indexes';

export type PeriodClosePostgresMigrationStatement = {
  id: string;
  phase: PeriodClosePostgresStatementPhase;
  sql: string;
};

export type PeriodClosePostgresTransactionRecipe = {
  id: string;
  requiredSqlFragments: string[];
  sql: string;
};

export type PeriodClosePostgresMigrationPlan = {
  destructive: false;
  dialect: 'postgresql';
  minimumVersion: '16';
  sourceContractId: string;
  statements: PeriodClosePostgresMigrationStatement[];
  transactionRecipes: PeriodClosePostgresTransactionRecipe[];
};

const postgresTypeValues: Record<string, string[]> = {
  accounting_period_close_check_group: [...requiredCloseCheckCodes],
  accounting_period_close_check_run_type: ['close_attempt', 'close_snapshot'],
  accounting_period_close_check_status: ['未运行', '通过', '阻断'],
  accounting_period_event_type: ['close_attempt_failed', 'closed', 'reopen_attempt_failed', 'reopened'],
  accounting_period_status: ['开放', '已结账', '已反结账'],
  close_check_item_status: ['不适用', '提示', '通过', '阻断'],
  financial_statement_snapshot_status: ['已生成'],
  financial_statement_type: ['balance_sheet', 'cash_flow', 'profit_statement'],
  trial_balance_status: ['平衡', '不平', '未生成']
};

const nativePostgresTypes = new Set(['boolean', 'integer', 'jsonb', 'numeric(18,2)', 'text', 'timestamptz']);

function quoteIdentifier(identifier: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier ${identifier}`);
  }

  return `"${identifier}"`;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderPostgresType(type: string) {
  if (nativePostgresTypes.has(type) || postgresTypeValues[type]) {
    return type;
  }

  throw new Error(`Unsupported period-close Postgres column type ${type}`);
}

function parseReference(reference: string) {
  const [tableName, columnName] = reference.split('.');

  if (!tableName || !columnName) {
    throw new Error(`Unsupported period-close Postgres reference ${reference}`);
  }

  return { columnName, tableName };
}

function renderColumn(column: PeriodCloseDatabaseColumn, { includeReferences }: { includeReferences: boolean }) {
  return [
    quoteIdentifier(column.name),
    renderPostgresType(column.type),
    column.primaryKey ? 'PRIMARY KEY' : '',
    column.nullable ? '' : 'NOT NULL',
    column.references && includeReferences
      ? `REFERENCES ${quoteIdentifier(parseReference(column.references).tableName)} (${quoteIdentifier(
          parseReference(column.references).columnName
        )})`
      : ''
  ]
    .filter(Boolean)
    .join(' ');
}

function renderEnumStatement(typeName: string, values: readonly string[]): PeriodClosePostgresMigrationStatement {
  return {
    id: `create_type_${typeName}`,
    phase: 'enum_types',
    sql: [
      'DO $$',
      'BEGIN',
      `  CREATE TYPE ${quoteIdentifier(typeName)} AS ENUM (${values.map(sqlString).join(', ')});`,
      'EXCEPTION WHEN duplicate_object THEN NULL;',
      'END',
      '$$;'
    ].join('\n')
  };
}

function renderTableStatement(table: PeriodCloseDatabaseTable): PeriodClosePostgresMigrationStatement {
  return {
    id: `create_table_${table.name}`,
    phase: 'tables',
    sql: [
      `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (`,
      table.columns.map((column) => `  ${renderColumn(column, { includeReferences: false })}`).join(',\n'),
      ');'
    ].join('\n')
  };
}

function renderForeignKeyStatement(
  table: PeriodCloseDatabaseTable,
  column: PeriodCloseDatabaseColumn
): PeriodClosePostgresMigrationStatement {
  if (!column.references) {
    throw new Error(`${table.name}.${column.name} does not define a reference`);
  }

  const reference = parseReference(column.references);
  const constraintName = `fk_${table.name}_${column.name}`;

  return {
    id: `create_constraint_${constraintName}`,
    phase: 'constraints',
    sql: [
      'DO $$',
      'BEGIN',
      '  IF NOT EXISTS (',
      '    SELECT 1',
      '    FROM pg_constraint',
      `    WHERE conname = ${sqlString(constraintName)}`,
      '      AND connamespace = current_schema()::regnamespace',
      '  ) THEN',
      `    ALTER TABLE ${quoteIdentifier(table.name)}`,
      `    ADD CONSTRAINT ${quoteIdentifier(constraintName)}`,
      `    FOREIGN KEY (${quoteIdentifier(column.name)})`,
      `    REFERENCES ${quoteIdentifier(reference.tableName)} (${quoteIdentifier(reference.columnName)});`,
      '  END IF;',
      'END',
      '$$;'
    ].join('\n')
  };
}

function renderIndexStatement(index: PeriodCloseSqlIndex): PeriodClosePostgresMigrationStatement {
  return {
    id: `create_index_${index.name}`,
    phase: 'indexes',
    sql: [
      'CREATE',
      index.unique ? 'UNIQUE' : '',
      'INDEX IF NOT EXISTS',
      quoteIdentifier(index.name),
      'ON',
      quoteIdentifier(index.table),
      `(${index.columns.map(quoteIdentifier).join(', ')});`
    ]
      .filter(Boolean)
      .join(' ')
  };
}

function buildTransactionRecipes(): PeriodClosePostgresTransactionRecipe[] {
  return [
    {
      id: 'close_accounting_period',
      requiredSqlFragments: [
        'BEGIN',
        'FOR UPDATE',
        'UPDATE "accounting_periods"',
        'INSERT INTO "accounting_period_close_checks"',
        'INSERT INTO "accounting_period_events"',
        'INSERT INTO "accounting_period_idempotency_records"',
        'COMMIT'
      ],
      sql: [
        'BEGIN;',
        'SELECT "period", "status", "version"',
        'FROM "accounting_periods"',
        'WHERE "period" = $1',
        'FOR UPDATE;',
        '-- Application layer validates expected version, close-check result, and idempotency request signature here.',
        'INSERT INTO "accounting_period_close_checks" (...) VALUES (...);',
        'INSERT INTO "accounting_period_events" (...) VALUES (...);',
        'INSERT INTO "accounting_period_idempotency_records" (...) VALUES (...)',
        'ON CONFLICT ("period", "operation", "idempotency_key") DO NOTHING;',
        'UPDATE "accounting_periods"',
        'SET "status" = $2, "version" = "version" + 1, "closed_at" = $3, "closed_by" = $4, "updated_at" = $3',
        'WHERE "period" = $1 AND "version" = $5;',
        'COMMIT;'
      ].join('\n')
    },
    {
      id: 'guard_source_mutation',
      requiredSqlFragments: [
        'BEGIN',
        'FOR UPDATE',
        'SELECT "period", "status"',
        'INSERT INTO "accounting_period_source_mutation_events"',
        'COMMIT'
      ],
      sql: [
        'BEGIN;',
        'SELECT "period", "status"',
        'FROM "accounting_periods"',
        'WHERE "period" = ANY($1::text[])',
        'FOR UPDATE;',
        '-- Application layer rejects any closed period before source rows are changed.',
        'INSERT INTO "accounting_period_source_mutation_events" (...) VALUES (...);',
        'COMMIT;'
      ].join('\n')
    },
    {
      id: 'write_financial_statement_snapshot',
      requiredSqlFragments: [
        'BEGIN',
        'FOR UPDATE',
        'INSERT INTO "financial_statement_snapshots"',
        'INSERT INTO "financial_statement_snapshot_lines"',
        'INSERT INTO "financial_statement_general_ledger_lines"',
        'COMMIT'
      ],
      sql: [
        'BEGIN;',
        'SELECT "period", "status", "version"',
        'FROM "accounting_periods"',
        'WHERE "period" = $1',
        'FOR UPDATE;',
        '-- Application layer verifies the period is closed and source ledger/mapping hashes match readiness.',
        'INSERT INTO "financial_statement_snapshots" (...) VALUES (...);',
        'INSERT INTO "financial_statement_snapshot_lines" (...) VALUES (...);',
        'INSERT INTO "financial_statement_general_ledger_lines" (...) VALUES (...);',
        'COMMIT;'
      ].join('\n')
    }
  ];
}

export function buildPeriodClosePostgresMigrationPlan(
  contract: PeriodCloseSqlMigrationContract = periodCloseSqlMigrationContract
): PeriodClosePostgresMigrationPlan {
  const contractErrors = validatePeriodCloseSqlMigrationContract(contract);

  if (contractErrors.length > 0) {
    throw new Error(`Cannot build period-close Postgres migration plan: ${contractErrors.join('; ')}`);
  }

  return {
    destructive: false,
    dialect: 'postgresql',
    minimumVersion: '16',
    sourceContractId: contract.id,
    statements: [
      ...Object.entries(postgresTypeValues).map(([typeName, values]) => renderEnumStatement(typeName, values)),
      ...contract.tables.map(renderTableStatement),
      ...contract.tables.flatMap((table) =>
        table.columns
          .filter((column) => column.references !== undefined)
          .map((column) => renderForeignKeyStatement(table, column))
      ),
      ...contract.indexes.map(renderIndexStatement)
    ],
    transactionRecipes: buildTransactionRecipes()
  };
}

function collectTableReferences(table: PeriodCloseDatabaseTable) {
  return table.columns
    .map((column) => column.references)
    .filter((reference): reference is string => reference !== undefined)
    .map((reference) => reference.split('.')[0] as PeriodCloseDatabaseTableName);
}

export function validatePeriodClosePostgresMigrationPlan(
  plan: PeriodClosePostgresMigrationPlan = buildPeriodClosePostgresMigrationPlan()
): string[] {
  const errors: string[] = [];
  const statementSql = plan.statements.map((statement) => statement.sql).join('\n');
  const tableNames = new Set(periodCloseSqlMigrationContract.tables.map((table) => table.name));

  if (plan.destructive !== false) {
    errors.push('Postgres migration plan must be non-destructive');
  }

  if (plan.dialect !== 'postgresql' || plan.minimumVersion !== '16') {
    errors.push('Postgres migration plan must target PostgreSQL 16');
  }

  for (const typeName of Object.keys(postgresTypeValues)) {
    if (!plan.statements.some((statement) => statement.id === `create_type_${typeName}`)) {
      errors.push(`missing enum type statement ${typeName}`);
    }
  }

  for (const table of periodCloseSqlMigrationContract.tables) {
    if (!plan.statements.some((statement) => statement.id === `create_table_${table.name}`)) {
      errors.push(`missing table statement ${table.name}`);
    }

    const referencedColumns = table.columns.filter((column) => column.references !== undefined);

    for (const referencedTable of collectTableReferences(table)) {
      if (!tableNames.has(referencedTable)) {
        errors.push(`${table.name} references unknown table ${referencedTable}`);
      }
    }

    for (const column of referencedColumns) {
      const constraintName = `fk_${table.name}_${column.name}`;

      if (!plan.statements.some((statement) => statement.id === `create_constraint_${constraintName}`)) {
        errors.push(`missing foreign key constraint statement ${constraintName}`);
      }
    }
  }

  for (const index of periodCloseSqlMigrationContract.indexes) {
    if (!plan.statements.some((statement) => statement.id === `create_index_${index.name}`)) {
      errors.push(`missing index statement ${index.name}`);
    }
  }

  if (/\b(DROP|TRUNCATE|DELETE)\b/i.test(statementSql)) {
    errors.push('Postgres migration statements must not contain destructive DDL/DML');
  }

  for (const recipe of plan.transactionRecipes) {
    for (const fragment of recipe.requiredSqlFragments) {
      if (!recipe.sql.includes(fragment)) {
        errors.push(`${recipe.id} transaction recipe is missing ${fragment}`);
      }
    }
  }

  return errors;
}
