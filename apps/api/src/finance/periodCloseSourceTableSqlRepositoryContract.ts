import { financeSourceMutationOperationRegistry } from './periodCloseSourceMutationRegistry.js';
import type { FinanceSourceMutationArea } from './periodCloseSourceMutationGuard.js';
import {
  getDefaultFinanceSourceTableName,
  type FinanceSourceTableRepository,
  type FinanceSourceTableRow
} from './periodCloseSourceTableRepositoryContract.js';

export type FinanceSourceTableSqlColumnName =
  | 'id'
  | 'source_no'
  | 'accounting_period'
  | 'amount'
  | 'status'
  | 'version'
  | 'updated_at';

export type FinanceSourceTableSqlColumn = {
  name: FinanceSourceTableSqlColumnName;
  nullable: boolean;
  primaryKey?: boolean;
  type: 'text' | 'numeric_18_2' | 'integer' | 'timestamptz';
};

export type FinanceSourceTableSqlIndex = {
  columns: FinanceSourceTableSqlColumnName[];
  name: string;
  unique?: boolean;
};

export type FinanceSourceTableSqlTableContract = {
  columns: FinanceSourceTableSqlColumn[];
  destructive: false;
  indexes: FinanceSourceTableSqlIndex[];
  sourceArea: FinanceSourceMutationArea;
  tableName: string;
};

export type FinanceSourceTableSqlStatementContract = {
  name: 'select_by_id' | 'insert_source_row' | 'update_by_id_and_version';
  parameters: FinanceSourceTableSqlColumnName[];
  sql: string;
  tableName: string;
};

export type FinanceSourceTableSqlRow = {
  accounting_period?: string;
  amount: string;
  id: string;
  source_no: string;
  status: string;
  tableName: string;
  updated_at?: string;
  version: number;
};

export type FinanceSourceTableSqlRepositoryContract = FinanceSourceTableRepository & {
  readSqlRows: () => FinanceSourceTableSqlRow[];
  readStatementContracts: () => FinanceSourceTableSqlStatementContract[];
  readTableContracts: () => FinanceSourceTableSqlTableContract[];
};

const accountingPeriodPattern = /^\d{4}-\d{2}$/;
const amountPattern = /^-?\d+(\.\d{1,2})?$/;

function uniqueSourceAreas() {
  return Array.from(new Set(financeSourceMutationOperationRegistry.map((entry) => entry.sourceArea)));
}

function createTableContract(sourceArea: FinanceSourceMutationArea): FinanceSourceTableSqlTableContract {
  const tableName = getDefaultFinanceSourceTableName(sourceArea);

  return {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'source_no', nullable: false, type: 'text' },
      { name: 'accounting_period', nullable: true, type: 'text' },
      { name: 'amount', nullable: false, type: 'numeric_18_2' },
      { name: 'status', nullable: false, type: 'text' },
      { name: 'version', nullable: false, type: 'integer' },
      { name: 'updated_at', nullable: true, type: 'timestamptz' }
    ],
    destructive: false,
    indexes: [
      {
        columns: ['accounting_period'],
        name: `idx_${tableName}_accounting_period`
      },
      {
        columns: ['id', 'version'],
        name: `idx_${tableName}_id_version`
      }
    ],
    sourceArea,
    tableName
  };
}

export const financeSourceTableSqlTableContracts: readonly FinanceSourceTableSqlTableContract[] =
  uniqueSourceAreas().map(createTableContract);

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function createStatementContracts({
  tableName
}: FinanceSourceTableSqlTableContract): FinanceSourceTableSqlStatementContract[] {
  const table = quoteIdentifier(tableName);

  return [
    {
      name: 'select_by_id',
      parameters: ['id'],
      sql: `SELECT "id", "source_no", "accounting_period", "amount", "status", "version", "updated_at" FROM ${table} WHERE "id" = $1;`,
      tableName
    },
    {
      name: 'insert_source_row',
      parameters: ['id', 'source_no', 'accounting_period', 'amount', 'status', 'version', 'updated_at'],
      sql: `INSERT INTO ${table} ("id", "source_no", "accounting_period", "amount", "status", "version", "updated_at") VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      tableName
    },
    {
      name: 'update_by_id_and_version',
      parameters: ['id', 'version', 'source_no', 'accounting_period', 'amount', 'status', 'updated_at'],
      sql: `UPDATE ${table} SET "source_no" = $3, "accounting_period" = $4, "amount" = $5, "status" = $6, "updated_at" = $7, "version" = "version" + 1 WHERE "id" = $1 AND "version" = $2;`,
      tableName
    }
  ];
}

export function buildFinanceSourceTableSqlStatementContracts(
  tableContracts: readonly FinanceSourceTableSqlTableContract[] = financeSourceTableSqlTableContracts
): FinanceSourceTableSqlStatementContract[] {
  return tableContracts.flatMap(createStatementContracts);
}

export function validateFinanceSourceTableSqlContracts(input: {
  statements?: readonly FinanceSourceTableSqlStatementContract[];
  tableContracts?: readonly FinanceSourceTableSqlTableContract[];
} = {}) {
  const tableContracts = input.tableContracts ?? financeSourceTableSqlTableContracts;
  const statements = input.statements ?? buildFinanceSourceTableSqlStatementContracts(tableContracts);
  const errors: string[] = [];
  const requiredColumns: FinanceSourceTableSqlColumnName[] = [
    'id',
    'source_no',
    'accounting_period',
    'amount',
    'status',
    'version',
    'updated_at'
  ];
  const sourceAreas = uniqueSourceAreas();
  const tableNames = new Set<string>();

  for (const sourceArea of sourceAreas) {
    if (!tableContracts.some((table) => table.sourceArea === sourceArea)) {
      errors.push(`missing source SQL table contract for ${sourceArea}`);
    }
  }

  for (const table of tableContracts) {
    if (table.destructive !== false) {
      errors.push(`${table.tableName} must be additive/non-destructive`);
    }

    if (tableNames.has(table.tableName)) {
      errors.push(`duplicate source SQL table name ${table.tableName}`);
    }
    tableNames.add(table.tableName);

    const columns = new Set(table.columns.map((column) => column.name));

    for (const columnName of requiredColumns) {
      if (!columns.has(columnName)) {
        errors.push(`${table.tableName}.${columnName} column is required`);
      }
    }

    if (!table.columns.some((column) => column.name === 'id' && column.primaryKey)) {
      errors.push(`${table.tableName}.id must be primary key`);
    }

    if (!table.indexes.some((index) => index.columns.includes('accounting_period'))) {
      errors.push(`${table.tableName} must index accounting_period`);
    }

    if (!table.indexes.some((index) => index.columns.includes('id') && index.columns.includes('version'))) {
      errors.push(`${table.tableName} must index id + version`);
    }
  }

  for (const statement of statements) {
    if (!tableNames.has(statement.tableName)) {
      errors.push(`${statement.name} references unknown table ${statement.tableName}`);
    }

    if (/\b(drop|truncate|delete|alter\s+table\s+.*\s+drop)\b/i.test(statement.sql)) {
      errors.push(`${statement.name} must not execute destructive SQL`);
    }

    if (!statement.sql.includes('$1')) {
      errors.push(`${statement.name} must use parameterized placeholders`);
    }

    if (statement.parameters.length === 0) {
      errors.push(`${statement.name} must declare parameters`);
    }
  }

  return errors;
}

function cloneSqlRow(row: FinanceSourceTableSqlRow): FinanceSourceTableSqlRow {
  return { ...row };
}

function tableByName(tableContracts: readonly FinanceSourceTableSqlTableContract[]) {
  return new Map(tableContracts.map((table) => [table.tableName, table]));
}

export function validateFinanceSourceTableSqlRows({
  rows,
  tableContracts = financeSourceTableSqlTableContracts
}: {
  rows: readonly FinanceSourceTableSqlRow[];
  tableContracts?: readonly FinanceSourceTableSqlTableContract[];
}) {
  const errors: string[] = [];
  const tableMap = tableByName(tableContracts);
  const seen = new Set<string>();

  for (const row of rows) {
    const table = tableMap.get(row.tableName);

    if (!table) {
      errors.push(`source SQL row ${row.id} references unknown table ${row.tableName}`);
      continue;
    }

    const key = `${row.tableName}:${row.id}`;

    if (seen.has(key)) {
      errors.push(`duplicate source SQL row ${key}`);
    }
    seen.add(key);

    for (const [fieldName, value] of [
      ['id', row.id],
      ['source_no', row.source_no],
      ['amount', row.amount],
      ['status', row.status]
    ] as const) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${row.tableName}.${fieldName} is required`);
      }
    }

    if (row.accounting_period !== undefined && !accountingPeriodPattern.test(row.accounting_period)) {
      errors.push(`${row.tableName}.${row.id} accounting_period must be YYYY-MM`);
    }

    if (!amountPattern.test(row.amount)) {
      errors.push(`${row.tableName}.${row.id} amount must be a decimal string`);
    }

    if (!Number.isInteger(row.version) || row.version < 1) {
      errors.push(`${row.tableName}.${row.id} version must be a positive integer`);
    }
  }

  return errors;
}

function hydrateSourceTableRow({
  row,
  table
}: {
  row: FinanceSourceTableSqlRow;
  table: FinanceSourceTableSqlTableContract;
}): FinanceSourceTableRow {
  return {
    accountingPeriod: row.accounting_period,
    amount: row.amount,
    id: row.id,
    sourceArea: table.sourceArea,
    sourceNo: row.source_no,
    status: row.status,
    tableName: row.tableName,
    updatedAt: row.updated_at,
    version: row.version
  };
}

function toSqlRow({
  fallbackUpdatedAt,
  row,
  tableContracts
}: {
  fallbackUpdatedAt: string;
  row: FinanceSourceTableRow;
  tableContracts: readonly FinanceSourceTableSqlTableContract[];
}): FinanceSourceTableSqlRow {
  const tableName = row.tableName || getDefaultFinanceSourceTableName(row.sourceArea);
  const table = tableContracts.find((item) => item.tableName === tableName && item.sourceArea === row.sourceArea);

  if (!table) {
    throw new Error(`Missing source SQL table contract for ${row.sourceArea}/${tableName}`);
  }

  return {
    accounting_period: row.accountingPeriod,
    amount: row.amount,
    id: row.id,
    source_no: row.sourceNo,
    status: row.status,
    tableName: table.tableName,
    updated_at: row.updatedAt ?? fallbackUpdatedAt,
    version: row.version
  };
}

export function hydrateFinanceSourceTableRowsFromSqlRows({
  rows,
  tableContracts = financeSourceTableSqlTableContracts
}: {
  rows: readonly FinanceSourceTableSqlRow[];
  tableContracts?: readonly FinanceSourceTableSqlTableContract[];
}): FinanceSourceTableRow[] {
  const rowErrors = validateFinanceSourceTableSqlRows({ rows, tableContracts });

  if (rowErrors.length > 0) {
    throw new Error(rowErrors.join('; '));
  }

  const tableMap = tableByName(tableContracts);

  return rows.map((row) => {
    const table = tableMap.get(row.tableName);

    if (!table) {
      throw new Error(`Missing source SQL table contract for ${row.tableName}`);
    }

    return hydrateSourceTableRow({ row, table });
  });
}

export function createFinanceSourceTableSqlRepositoryContract({
  fallbackUpdatedAt,
  initialRows,
  tableContracts = financeSourceTableSqlTableContracts
}: {
  fallbackUpdatedAt: string;
  initialRows: readonly FinanceSourceTableSqlRow[];
  tableContracts?: readonly FinanceSourceTableSqlTableContract[];
}): FinanceSourceTableSqlRepositoryContract {
  const contractErrors = validateFinanceSourceTableSqlContracts({ tableContracts });

  if (contractErrors.length > 0) {
    throw new Error(contractErrors.join('; '));
  }

  const initialRowErrors = validateFinanceSourceTableSqlRows({ rows: initialRows, tableContracts });

  if (initialRowErrors.length > 0) {
    throw new Error(initialRowErrors.join('; '));
  }

  let rows = initialRows.map(cloneSqlRow);

  return {
    readRows: () => hydrateFinanceSourceTableRowsFromSqlRows({ rows, tableContracts }),
    readSqlRows: () => rows.map(cloneSqlRow),
    readStatementContracts: () => buildFinanceSourceTableSqlStatementContracts(tableContracts),
    readTableContracts: () => tableContracts.map((table) => ({
      ...table,
      columns: table.columns.map((column) => ({ ...column })),
      indexes: table.indexes.map((index) => ({ ...index, columns: [...index.columns] }))
    })),
    replaceRows: (nextRows) => {
      const nextSqlRows = nextRows.map((row) => toSqlRow({ fallbackUpdatedAt, row, tableContracts }));
      const errors = validateFinanceSourceTableSqlRows({ rows: nextSqlRows, tableContracts });

      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }

      rows = nextSqlRows.map(cloneSqlRow);
    }
  };
}
