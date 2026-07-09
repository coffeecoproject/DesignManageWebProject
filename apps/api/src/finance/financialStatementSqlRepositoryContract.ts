import {
  buildFinancialStatementReadiness,
  createFinancialStatementSnapshot,
  type CashFlowActivity,
  type CashFlowMappingRecord,
  type CashFlowMappingStatus,
  type CreateFinancialStatementSnapshotRequest,
  type FinancialStatementError,
  type FinancialStatementLedgerEntry,
  type FinancialStatementLine,
  type FinancialStatementSnapshot
} from './financialStatementContract.js';
import type { FinancialStatementRouteState } from './financialStatementRoutes.js';
import {
  hydrateFinancialStatementSnapshotsFromDatabaseRows,
  mapFinancialStatementSnapshotsToDatabaseRows,
  type FinancialStatementGeneralLedgerLineDbRow,
  type FinancialStatementSnapshotDbRow,
  type FinancialStatementSnapshotLineDbRow,
  type JsonValue,
  type PeriodCloseDatabaseRows
} from './periodCloseDatabaseContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';

export type CashFlowMappingSqlRow = {
  activity: CashFlowActivity;
  created_at: string;
  created_by: string;
  created_by_snapshot: JsonValue;
  effective_period: string;
  id: string;
  item: string;
  status: CashFlowMappingStatus;
  subject_code: string;
  updated_at: string;
  version: number;
};

export type FinancialStatementSqlRows = {
  cash_flow_mapping_rules: CashFlowMappingSqlRow[];
  financial_statement_general_ledger_lines: FinancialStatementGeneralLedgerLineDbRow[];
  financial_statement_snapshot_lines: FinancialStatementSnapshotLineDbRow[];
  financial_statement_snapshots: FinancialStatementSnapshotDbRow[];
};

export type FinancialStatementSqlColumn = {
  name: string;
  nullable: boolean;
  primaryKey?: boolean;
  references?: string;
  type: string;
  uniqueKey?: string;
};

export type FinancialStatementSqlTable = {
  columns: FinancialStatementSqlColumn[];
  name: 'cash_flow_mapping_rules';
  notes: string[];
};

export type FinancialStatementSqlIndex = {
  columns: string[];
  name: string;
  table:
    | 'cash_flow_mapping_rules'
    | 'financial_statement_general_ledger_lines'
    | 'financial_statement_snapshot_lines'
    | 'financial_statement_snapshots';
  unique?: boolean;
};

export type FinancialStatementSqlMigrationContract = {
  cashFlowMappingTable: FinancialStatementSqlTable;
  destructive: false;
  id: string;
  indexes: FinancialStatementSqlIndex[];
  rollbackStrategy: string;
  snapshotTables: [
    'financial_statement_snapshots',
    'financial_statement_snapshot_lines',
    'financial_statement_general_ledger_lines'
  ];
};

export type FinancialStatementSqlSnapshotWriteResult =
  | {
      ok: true;
      replayed: boolean;
      rows: FinancialStatementSqlRows;
      snapshot: FinancialStatementSnapshot;
    }
  | {
      error: FinancialStatementError;
      ok: false;
      rows: FinancialStatementSqlRows;
    };

export type FinancialStatementSqlRepository = {
  createSnapshot: (input: {
    accountingPeriod: string;
    expectedCashFlowMappingVersionHash?: string;
    expectedSourceLedgerHash?: string;
    request: CreateFinancialStatementSnapshotRequest;
  }) => FinancialStatementSqlSnapshotWriteResult;
  readLatestSnapshot: (accountingPeriod: string) => FinancialStatementSnapshot | undefined;
  readReadiness: (accountingPeriod: string) => ReturnType<typeof buildFinancialStatementReadiness>;
  readRouteState: () => FinancialStatementRouteState;
  readRows: () => FinancialStatementSqlRows;
};

const activities: CashFlowActivity[] = ['经营活动', '投资活动', '筹资活动'];
const mappingStatuses: CashFlowMappingStatus[] = ['有效', '停用'];

export const cashFlowMappingSqlTable: FinancialStatementSqlTable = {
  columns: [
    { name: 'id', nullable: false, primaryKey: true, type: 'text' },
    { name: 'subject_code', nullable: false, type: 'text', uniqueKey: 'cash_flow_mapping_subject_period_version' },
    { name: 'activity', nullable: false, type: 'cash_flow_activity' },
    { name: 'item', nullable: false, type: 'text' },
    { name: 'effective_period', nullable: false, type: 'text', uniqueKey: 'cash_flow_mapping_subject_period_version' },
    { name: 'version', nullable: false, type: 'integer', uniqueKey: 'cash_flow_mapping_subject_period_version' },
    { name: 'status', nullable: false, type: 'cash_flow_mapping_status' },
    { name: 'created_by', nullable: false, type: 'text' },
    { name: 'created_by_snapshot', nullable: false, type: 'jsonb' },
    { name: 'created_at', nullable: false, type: 'timestamptz' },
    { name: 'updated_at', nullable: false, type: 'timestamptz' }
  ],
  name: 'cash_flow_mapping_rules',
  notes: [
    'Cash-flow mapping is a controlled accounting basis used by report readiness and formal snapshots.',
    'Rules are period-effective; the latest active row at or before the report period wins for one subject.',
    'Business modules read this table; ordinary business flows do not mutate it directly.'
  ]
};

export const financialStatementSqlMigrationContract: FinancialStatementSqlMigrationContract = {
  cashFlowMappingTable: cashFlowMappingSqlTable,
  destructive: false,
  id: '20260704_finance_financial_statement_snapshot_repository',
  indexes: [
    {
      columns: ['subject_code', 'effective_period', 'version'],
      name: 'uk_cash_flow_mapping_subject_period_version',
      table: 'cash_flow_mapping_rules',
      unique: true
    },
    {
      columns: ['accounting_period', 'generated_at'],
      name: 'idx_financial_statement_snapshots_period_generated',
      table: 'financial_statement_snapshots'
    },
    {
      columns: ['snapshot_id', 'statement_type', 'line_index'],
      name: 'idx_financial_statement_lines_snapshot_type',
      table: 'financial_statement_snapshot_lines'
    },
    {
      columns: ['snapshot_id', 'subject_code'],
      name: 'idx_financial_statement_general_ledger_snapshot_subject',
      table: 'financial_statement_general_ledger_lines'
    }
  ],
  rollbackStrategy:
    'Forward-fix only after report snapshots exist; before apply, rollback can drop the additive cash-flow mapping table and snapshot read indexes.',
  snapshotTables: [
    'financial_statement_snapshots',
    'financial_statement_snapshot_lines',
    'financial_statement_general_ledger_lines'
  ]
};

function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]));
  }

  return value;
}

function cloneLine(line: FinancialStatementLine): FinancialStatementLine {
  return {
    ...line,
    sourceSubjectCodes: [...line.sourceSubjectCodes],
    voucherNos: [...line.voucherNos]
  };
}

function cloneRows(rows: FinancialStatementSqlRows): FinancialStatementSqlRows {
  return {
    cash_flow_mapping_rules: rows.cash_flow_mapping_rules.map((row) => ({
      ...row,
      created_by_snapshot: cloneJsonValue(row.created_by_snapshot)
    })),
    financial_statement_general_ledger_lines: rows.financial_statement_general_ledger_lines.map((row) => ({
      ...row,
      voucher_nos: cloneJsonValue(row.voucher_nos)
    })),
    financial_statement_snapshot_lines: rows.financial_statement_snapshot_lines.map((row) => ({
      ...row,
      source_subject_codes: cloneJsonValue(row.source_subject_codes),
      voucher_nos: cloneJsonValue(row.voucher_nos)
    })),
    financial_statement_snapshots: rows.financial_statement_snapshots.map((row) => ({
      ...row,
      generated_by_snapshot: cloneJsonValue(row.generated_by_snapshot)
    }))
  };
}

function toActorSnapshot(value: JsonValue): ActorSnapshot | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const actor = value as { id?: JsonValue; name?: JsonValue };

  if (typeof actor.id !== 'string' || typeof actor.name !== 'string') {
    return undefined;
  }

  return {
    id: actor.id,
    name: actor.name
  };
}

function isPeriod(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function requireNonBlank(errors: string[], value: string, label: string) {
  if (value.trim().length === 0) {
    errors.push(`${label} is required`);
  }
}

function isJsonStringArray(value: JsonValue) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function createEmptyDatabaseRows(rows: FinancialStatementSqlRows): PeriodCloseDatabaseRows {
  return {
    accounting_period_close_check_items: [],
    accounting_period_close_checks: [],
    accounting_period_events: [],
    accounting_period_idempotency_records: [],
    accounting_period_source_mutation_events: [],
    accounting_periods: [],
    financial_statement_general_ledger_lines: rows.financial_statement_general_ledger_lines.map((row) => ({ ...row })),
    financial_statement_snapshot_lines: rows.financial_statement_snapshot_lines.map((row) => ({
      ...row,
      source_subject_codes: cloneJsonValue(row.source_subject_codes),
      voucher_nos: cloneJsonValue(row.voucher_nos)
    })),
    financial_statement_snapshots: rows.financial_statement_snapshots.map((row) => ({
      ...row,
      generated_by_snapshot: cloneJsonValue(row.generated_by_snapshot)
    }))
  };
}

function hydrateSnapshots(rows: FinancialStatementSqlRows) {
  return hydrateFinancialStatementSnapshotsFromDatabaseRows(createEmptyDatabaseRows(rows));
}

function mapCashFlowMapping(row: CashFlowMappingSqlRow): CashFlowMappingRecord {
  return {
    activity: row.activity,
    createdAt: row.created_at,
    createdBySnapshot: toActorSnapshot(row.created_by_snapshot) ?? {
      id: row.created_by,
      name: row.created_by
    },
    effectivePeriod: row.effective_period,
    item: row.item,
    status: row.status,
    subjectCode: row.subject_code,
    version: row.version
  };
}

function cloneStatementLineInputs(
  inputs: FinancialStatementRouteState['statementLineInputs']
): FinancialStatementRouteState['statementLineInputs'] {
  if (!inputs) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(inputs).map(([period, lineInputs]) => [
      period,
      {
        ...(lineInputs.balanceSheetLines ? { balanceSheetLines: lineInputs.balanceSheetLines.map(cloneLine) } : {}),
        ...(lineInputs.profitStatementLines ? { profitStatementLines: lineInputs.profitStatementLines.map(cloneLine) } : {})
      }
    ])
  );
}

function createStatementError({
  code,
  message,
  period,
  requestId,
  rows
}: FinancialStatementError & { rows: FinancialStatementSqlRows }): FinancialStatementSqlSnapshotWriteResult {
  return {
    error: {
      code,
      message,
      period,
      requestId
    },
    ok: false,
    rows: cloneRows(rows)
  };
}

export function validateFinancialStatementSqlRows({
  periods,
  rows
}: {
  periods: AccountingPeriodRecord[];
  rows: FinancialStatementSqlRows;
}): string[] {
  const errors: string[] = [];
  const periodsByValue = new Map(periods.map((period) => [period.period, period]));
  const mappingKeys = new Set<string>();
  const snapshotById = new Map<string, FinancialStatementSnapshotDbRow>();
  const snapshotIds = new Set<string>();

  for (const mapping of rows.cash_flow_mapping_rules) {
    requireNonBlank(errors, mapping.id, 'cash_flow_mapping_rules.id');
    requireNonBlank(errors, mapping.subject_code, `cash_flow_mapping_rules[${mapping.id}].subject_code`);
    requireNonBlank(errors, mapping.item, `cash_flow_mapping_rules[${mapping.id}].item`);

    if (!activities.includes(mapping.activity)) {
      errors.push(`cash_flow_mapping_rules:${mapping.id}:activity is invalid`);
    }

    if (!mappingStatuses.includes(mapping.status)) {
      errors.push(`cash_flow_mapping_rules:${mapping.id}:status is invalid`);
    }

    if (!isPeriod(mapping.effective_period)) {
      errors.push(`cash_flow_mapping_rules:${mapping.id}:effective_period must be YYYY-MM`);
    }

    if (!Number.isInteger(mapping.version) || mapping.version <= 0) {
      errors.push(`cash_flow_mapping_rules:${mapping.id}:version must be a positive integer`);
    }

    if (!toActorSnapshot(mapping.created_by_snapshot)) {
      errors.push(`cash_flow_mapping_rules:${mapping.id}:created_by_snapshot is invalid`);
    }

    const mappingKey = `${mapping.subject_code}:${mapping.effective_period}:${mapping.version}`;

    if (mappingKeys.has(mappingKey)) {
      errors.push(`cash_flow_mapping_rules:${mapping.id}:duplicate mapping ${mappingKey}`);
    }

    mappingKeys.add(mappingKey);
  }

  for (const snapshot of rows.financial_statement_snapshots) {
    if (snapshotIds.has(snapshot.id)) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:duplicate id`);
    }

    snapshotIds.add(snapshot.id);
    snapshotById.set(snapshot.id, snapshot);

    const period = periodsByValue.get(snapshot.accounting_period);

    if (!period) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:period is missing`);
    } else if (period.status !== '已结账') {
      errors.push(`financial_statement_snapshots:${snapshot.id}:period must be closed`);
    }

    requireNonBlank(errors, snapshot.source_ledger_hash, `financial_statement_snapshots[${snapshot.id}].source_ledger_hash`);
    requireNonBlank(
      errors,
      snapshot.cash_flow_mapping_version_hash,
      `financial_statement_snapshots[${snapshot.id}].cash_flow_mapping_version_hash`
    );
    requireNonBlank(errors, snapshot.snapshot_hash, `financial_statement_snapshots[${snapshot.id}].snapshot_hash`);

    if (!toActorSnapshot(snapshot.generated_by_snapshot)) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:generated_by_snapshot is invalid`);
    }
  }

  for (const line of rows.financial_statement_snapshot_lines) {
    const snapshot = snapshotById.get(line.snapshot_id);

    if (!snapshot) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:snapshot is missing`);
      continue;
    }

    if (line.accounting_period !== snapshot.accounting_period) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:period must match snapshot`);
    }

    if (!isJsonStringArray(line.source_subject_codes)) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:source_subject_codes must be string array`);
    }

    if (!isJsonStringArray(line.voucher_nos)) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:voucher_nos must be string array`);
    }
  }

  for (const line of rows.financial_statement_general_ledger_lines) {
    const snapshot = snapshotById.get(line.snapshot_id);

    if (!snapshot) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:snapshot is missing`);
      continue;
    }

    if (line.accounting_period !== snapshot.accounting_period) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:period must match snapshot`);
    }

    if (line.source_ledger_hash !== snapshot.source_ledger_hash) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:source ledger hash must match snapshot`);
    }

    if (!isJsonStringArray(line.voucher_nos)) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:voucher_nos must be string array`);
    }
  }

  return errors;
}

export function createFinancialStatementSqlRepository({
  ledgerEntries,
  periods,
  rows,
  statementLineInputs
}: {
  ledgerEntries: FinancialStatementLedgerEntry[];
  periods: AccountingPeriodRecord[];
  rows: FinancialStatementSqlRows;
  statementLineInputs?: FinancialStatementRouteState['statementLineInputs'];
}): FinancialStatementSqlRepository {
  const initialErrors = validateFinancialStatementSqlRows({ periods, rows });

  if (initialErrors.length > 0) {
    throw new Error(`Financial-statement SQL row contract failed: ${initialErrors.join('; ')}`);
  }

  let committedRows = cloneRows(rows);
  const committedPeriods = periods.map((period) => ({ ...period }));
  const committedLedgerEntries = ledgerEntries.map((entry) => ({ ...entry }));
  const committedStatementLineInputs = cloneStatementLineInputs(statementLineInputs);

  const readCashFlowMappings = () => committedRows.cash_flow_mapping_rules.map(mapCashFlowMapping);
  const readSnapshots = () => hydrateSnapshots(committedRows);
  const readReadiness = (accountingPeriod: string) => {
    const lines = committedStatementLineInputs?.[accountingPeriod];

    return buildFinancialStatementReadiness({
      accountingPeriod,
      balanceSheetLines: lines?.balanceSheetLines,
      cashFlowMappings: readCashFlowMappings(),
      ledgerEntries: committedLedgerEntries,
      profitStatementLines: lines?.profitStatementLines
    });
  };

  return {
    createSnapshot: ({
      accountingPeriod,
      expectedCashFlowMappingVersionHash,
      expectedSourceLedgerHash,
      request
    }) => {
      const existingSnapshot = readSnapshots()
        .filter((snapshot) => snapshot.accountingPeriod === accountingPeriod)
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];

      if (existingSnapshot) {
        return {
          ok: true,
          replayed: true,
          rows: cloneRows(committedRows),
          snapshot: existingSnapshot
        };
      }

      const period = committedPeriods.find((item) => item.period === accountingPeriod);
      const readiness = readReadiness(accountingPeriod);

      if (!period) {
        return createStatementError({
          code: 'FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED',
          message: '会计期间不存在，不能生成正式财务报表快照。',
          period: accountingPeriod,
          requestId: request.requestId,
          rows: committedRows
        });
      }

      if (expectedSourceLedgerHash && expectedSourceLedgerHash !== readiness.sourceLedgerHash) {
        return createStatementError({
          code: 'FINANCIAL_STATEMENT_READINESS_STALE',
          message: '源总账快照已变化，请重新读取财务报表准备状态。',
          period: accountingPeriod,
          requestId: request.requestId,
          rows: committedRows
        });
      }

      if (
        expectedCashFlowMappingVersionHash &&
        expectedCashFlowMappingVersionHash !== readiness.cashFlowMappingVersionHash
      ) {
        return createStatementError({
          code: 'FINANCIAL_STATEMENT_READINESS_STALE',
          message: '现金流量映射版本已变化，请重新读取财务报表准备状态。',
          period: accountingPeriod,
          requestId: request.requestId,
          rows: committedRows
        });
      }

      const result = createFinancialStatementSnapshot({ period, readiness, request });

      if (!result.ok) {
        return {
          error: result.error,
          ok: false,
          rows: cloneRows(committedRows)
        };
      }

      const snapshotRows = mapFinancialStatementSnapshotsToDatabaseRows([result.snapshot]);
      const nextRows: FinancialStatementSqlRows = {
        ...committedRows,
        financial_statement_general_ledger_lines: [
          ...committedRows.financial_statement_general_ledger_lines,
          ...snapshotRows.financial_statement_general_ledger_lines
        ],
        financial_statement_snapshot_lines: [
          ...committedRows.financial_statement_snapshot_lines,
          ...snapshotRows.financial_statement_snapshot_lines
        ],
        financial_statement_snapshots: [
          ...committedRows.financial_statement_snapshots,
          ...snapshotRows.financial_statement_snapshots
        ]
      };
      const validationErrors = validateFinancialStatementSqlRows({ periods: committedPeriods, rows: nextRows });

      if (validationErrors.length > 0) {
        throw new Error(`Financial-statement SQL snapshot write failed: ${validationErrors.join('; ')}`);
      }

      committedRows = cloneRows(nextRows);

      return {
        ok: true,
        replayed: false,
        rows: cloneRows(committedRows),
        snapshot: result.snapshot
      };
    },
    readLatestSnapshot: (accountingPeriod) =>
      readSnapshots()
        .filter((snapshot) => snapshot.accountingPeriod === accountingPeriod)
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0],
    readReadiness,
    readRouteState: () => ({
      cashFlowMappings: readCashFlowMappings(),
      ledgerEntries: committedLedgerEntries.map((entry) => ({ ...entry })),
      periods: committedPeriods.map((period) => ({ ...period })),
      ...(committedStatementLineInputs ? { statementLineInputs: cloneStatementLineInputs(committedStatementLineInputs) } : {}),
      statementSnapshots: readSnapshots()
    }),
    readRows: () => cloneRows(committedRows)
  };
}
