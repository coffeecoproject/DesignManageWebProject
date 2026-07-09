import {
  type PeriodCloseDatabaseRepository,
  type PeriodCloseDatabaseRepositorySnapshot,
  createRowBackedPeriodCloseRepository,
  hydratePeriodCloseStateFromDatabaseSnapshot
} from './periodCloseDatabaseRepositoryContract.js';
import {
  periodCloseDatabaseTables,
  validatePeriodCloseDatabaseRows,
  type PeriodCloseDatabaseTable,
  type PeriodCloseDatabaseTableName
} from './periodCloseDatabaseContract.js';
import {
  applyFinanceSourceMutationInPersistenceTransaction,
  closeAccountingPeriodInPersistenceTransaction,
  type PeriodClosePersistenceContext,
  type PeriodClosePersistentState,
  type PersistentCloseAccountingPeriodResult,
  type PersistentSourceMutationRequest,
  type PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodCloseRepositoryTransaction,
  PeriodCloseRepositoryTransactionResult
} from './periodCloseRepositoryContract.js';

export type PeriodCloseSqlIndex = {
  columns: string[];
  name: string;
  table: PeriodCloseDatabaseTableName;
  unique?: boolean;
};

export type PeriodCloseSqlTransactionBoundary = {
  name: string;
  notes: string[];
  locks: Array<{
    mode: 'select_for_update' | 'append_only_insert' | 'unique_constraint';
    table: PeriodCloseDatabaseTableName;
  }>;
};

export type PeriodCloseSqlMigrationContract = {
  destructive: false;
  id: string;
  indexes: PeriodCloseSqlIndex[];
  rollbackStrategy: string;
  tables: PeriodCloseDatabaseTable[];
  transactionBoundaries: PeriodCloseSqlTransactionBoundary[];
};

export type PeriodCloseSqlTransactionErrorCode =
  | 'PERIOD_LOCK_CONFLICT'
  | 'PERIOD_NOT_FOUND'
  | 'PERIOD_VERSION_CONFLICT'
  | 'SQL_ROW_CONTRACT_FAILED';

export type PeriodCloseSqlTransactionError = {
  code: PeriodCloseSqlTransactionErrorCode;
  message: string;
  period?: string;
  transactionId: string;
};

export type PeriodCloseSqlTransactionResult<T extends PeriodCloseRepositoryTransactionResult> =
  | {
      ok: true;
      snapshot: PeriodCloseDatabaseRepositorySnapshot;
      value: T;
    }
  | {
      error: PeriodCloseSqlTransactionError;
      ok: false;
      snapshot: PeriodCloseDatabaseRepositorySnapshot;
    };

export type PeriodCloseSqlRepository = {
  readDatabaseSnapshot: () => PeriodCloseDatabaseRepositorySnapshot;
  readState: () => PeriodClosePersistentState;
  runPeriodLockedTransaction: <T extends PeriodCloseRepositoryTransactionResult>(input: {
    expectedVersion?: number;
    period: string;
    transaction: PeriodCloseRepositoryTransaction<T>;
    transactionId: string;
  }) => PeriodCloseSqlTransactionResult<T>;
};

export const periodCloseSqlMigrationContract: PeriodCloseSqlMigrationContract = {
  destructive: false,
  id: '20260704_finance_period_close_sql_repository',
  indexes: [
    {
      columns: ['period', 'version'],
      name: 'idx_accounting_periods_period_version_for_close_lock',
      table: 'accounting_periods'
    },
    {
      columns: ['period', 'status'],
      name: 'idx_accounting_periods_period_status_for_source_guard',
      table: 'accounting_periods'
    },
    {
      columns: ['period', 'operation', 'idempotency_key'],
      name: 'uk_accounting_period_idempotency_period_operation_key',
      table: 'accounting_period_idempotency_records',
      unique: true
    },
    {
      columns: ['period', 'check_snapshot_hash', 'run_type', 'persisted_for_close'],
      name: 'idx_accounting_period_close_checks_period_hash_run_type',
      table: 'accounting_period_close_checks'
    },
    {
      columns: ['close_check_id', 'group_code', 'source_id'],
      name: 'idx_accounting_period_close_check_items_snapshot_group_source',
      table: 'accounting_period_close_check_items'
    },
    {
      columns: ['period', 'created_at'],
      name: 'idx_accounting_period_events_period_created_at',
      table: 'accounting_period_events'
    },
    {
      columns: ['source_area', 'source_id', 'created_at'],
      name: 'idx_accounting_period_source_mutation_events_source_created_at',
      table: 'accounting_period_source_mutation_events'
    }
  ],
  rollbackStrategy:
    'Forward-fix after period-close rows exist. Before apply, rollback can drop the additive indexes and new period-close tables because no production rows are claimed by this local contract.',
  tables: periodCloseDatabaseTables,
  transactionBoundaries: [
    {
      locks: [
        { mode: 'select_for_update', table: 'accounting_periods' },
        { mode: 'append_only_insert', table: 'accounting_period_close_checks' },
        { mode: 'append_only_insert', table: 'accounting_period_events' },
        { mode: 'unique_constraint', table: 'accounting_period_idempotency_records' }
      ],
      name: 'close_or_reopen_accounting_period',
      notes: [
        'Lock the accounting_periods row by period before evaluating version and writing close or reopen facts.',
        'Close snapshots, events, and idempotency rows are appended in the same transaction.',
        'The transaction commits only after the row contract validates the whole affected row set.'
      ]
    },
    {
      locks: [
        { mode: 'select_for_update', table: 'accounting_periods' },
        { mode: 'append_only_insert', table: 'accounting_period_source_mutation_events' }
      ],
      name: 'closed_period_source_mutation_guard',
      notes: [
        'Source mutations check affected accounting_periods rows in the same transaction.',
        'Rejected mutations write an audit row and do not mutate the source record.',
        'Open-period mutations and rejection audit rows share the same transaction boundary.'
      ]
    },
    {
      locks: [
        { mode: 'select_for_update', table: 'accounting_periods' },
        { mode: 'append_only_insert', table: 'financial_statement_snapshots' }
      ],
      name: 'financial_statement_snapshot_after_close',
      notes: [
        'Formal statement snapshots can reference only closed accounting periods.',
        'Snapshot rows are immutable and are committed after ledger and mapping hashes are verified.'
      ]
    }
  ]
};

export function validatePeriodCloseSqlMigrationContract(
  contract: PeriodCloseSqlMigrationContract = periodCloseSqlMigrationContract
): string[] {
  const errors: string[] = [];
  const tableNames = new Set(contract.tables.map((table) => table.name));

  if (contract.destructive !== false) {
    errors.push('period-close SQL migration must be additive/non-destructive');
  }

  for (const expectedTable of periodCloseDatabaseTables) {
    if (!tableNames.has(expectedTable.name)) {
      errors.push(`missing table ${expectedTable.name}`);
    }
  }

  const periodTable = contract.tables.find((table) => table.name === 'accounting_periods');
  const periodColumns = new Set(periodTable?.columns.map((column) => column.name) ?? []);

  for (const column of ['period', 'status', 'version', 'closed_at', 'closed_by', 'close_check_snapshot_id']) {
    if (!periodColumns.has(column)) {
      errors.push(`accounting_periods.${column} column is required`);
    }
  }

  if (!periodTable?.columns.some((column) => column.name === 'period' && column.primaryKey)) {
    errors.push('accounting_periods.period must be the primary key');
  }

  const requiredIndexes = [
    'idx_accounting_periods_period_version_for_close_lock',
    'idx_accounting_periods_period_status_for_source_guard',
    'uk_accounting_period_idempotency_period_operation_key'
  ];

  for (const indexName of requiredIndexes) {
    if (!contract.indexes.some((index) => index.name === indexName)) {
      errors.push(`missing index ${indexName}`);
    }
  }

  const idempotencyIndex = contract.indexes.find(
    (index) => index.name === 'uk_accounting_period_idempotency_period_operation_key'
  );

  if (!idempotencyIndex?.unique) {
    errors.push('period idempotency index must be unique');
  }

  if (
    !contract.transactionBoundaries.some((boundary) =>
      boundary.locks.some((lock) => lock.table === 'accounting_periods' && lock.mode === 'select_for_update')
    )
  ) {
    errors.push('period-close transactions must lock accounting_periods rows');
  }

  return errors;
}

function createTransactionError({
  code,
  message,
  period,
  transactionId
}: {
  code: PeriodCloseSqlTransactionErrorCode;
  message: string;
  period?: string;
  transactionId: string;
}): PeriodCloseSqlTransactionError {
  return {
    code,
    message,
    period,
    transactionId
  };
}

export function createPeriodCloseSqlRepositoryContract({
  fallbackNow,
  initialState
}: {
  fallbackNow: string;
  initialState: PeriodClosePersistentState;
}): PeriodCloseSqlRepository {
  const rowRepository = createRowBackedPeriodCloseRepository({ fallbackNow, initialState });
  const periodLocks = new Map<string, string>();

  return {
    readDatabaseSnapshot: () => rowRepository.readDatabaseSnapshot(),
    readState: () => rowRepository.readState(),
    runPeriodLockedTransaction: <T extends PeriodCloseRepositoryTransactionResult>({
      expectedVersion,
      period,
      transaction,
      transactionId
    }: {
      expectedVersion?: number;
      period: string;
      transaction: PeriodCloseRepositoryTransaction<T>;
      transactionId: string;
    }): PeriodCloseSqlTransactionResult<T> => {
      const existingLock = periodLocks.get(period);

      if (existingLock) {
        return {
          error: createTransactionError({
            code: 'PERIOD_LOCK_CONFLICT',
            message: `会计期间 ${period} 正在被事务 ${existingLock} 锁定。`,
            period,
            transactionId
          }),
          ok: false,
          snapshot: rowRepository.readDatabaseSnapshot()
        };
      }

      const currentPeriod = rowRepository
        .readDatabaseSnapshot()
        .periodCloseRows.accounting_periods.find((row) => row.period === period);

      if (!currentPeriod) {
        return {
          error: createTransactionError({
            code: 'PERIOD_NOT_FOUND',
            message: `会计期间 ${period} 不存在。`,
            period,
            transactionId
          }),
          ok: false,
          snapshot: rowRepository.readDatabaseSnapshot()
        };
      }

      periodLocks.set(period, transactionId);

      try {
        if (expectedVersion !== undefined && currentPeriod.version !== expectedVersion) {
          return {
            error: createTransactionError({
              code: 'PERIOD_VERSION_CONFLICT',
              message: `会计期间 ${period} 版本已变化。`,
              period,
              transactionId
            }),
            ok: false,
            snapshot: rowRepository.readDatabaseSnapshot()
          };
        }

        const value = rowRepository.runInTransaction(transaction);
        const validationErrors = validatePeriodCloseDatabaseRows(rowRepository.readDatabaseSnapshot().periodCloseRows);

        if (validationErrors.length > 0) {
          return {
            error: createTransactionError({
              code: 'SQL_ROW_CONTRACT_FAILED',
              message: validationErrors.join('; '),
              period,
              transactionId
            }),
            ok: false,
            snapshot: rowRepository.readDatabaseSnapshot()
          };
        }

        return {
          ok: true,
          snapshot: rowRepository.readDatabaseSnapshot(),
          value
        };
      } finally {
        periodLocks.delete(period);
      }
    }
  };
}

export function closeAccountingPeriodWithSqlRepositoryTransaction({
  period,
  repository,
  request,
  transactionId
}: {
  period: string;
  repository: PeriodCloseSqlRepository;
  request: CloseAccountingPeriodRequest;
  transactionId: string;
}): PeriodCloseSqlTransactionResult<PersistentCloseAccountingPeriodResult> {
  const hasExistingIdempotencyRecord = repository
    .readDatabaseSnapshot()
    .periodCloseRows.accounting_period_idempotency_records.some(
      (record) =>
        record.period === period && record.operation === 'close' && record.idempotency_key === request.idempotencyKey
    );

  return repository.runPeriodLockedTransaction({
    expectedVersion: hasExistingIdempotencyRecord ? undefined : request.version,
    period,
    transaction: (state) =>
      closeAccountingPeriodInPersistenceTransaction({
        period,
        request,
        state
      }),
    transactionId
  });
}

export function applyFinanceSourceMutationWithSqlRepositoryTransaction({
  context,
  mutation,
  repository,
  transactionId
}: {
  context: PeriodClosePersistenceContext;
  mutation: PersistentSourceMutationRequest;
  repository: PeriodCloseSqlRepository;
  transactionId: string;
}): PeriodCloseSqlTransactionResult<PersistentSourceMutationResult> {
  const sourceRecord = repository
    .readDatabaseSnapshot()
    .sourceRecords.find((record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea);
  const period = mutation.targetAccountingPeriod ?? sourceRecord?.accountingPeriod;

  if (!period) {
    return {
      error: createTransactionError({
        code: 'PERIOD_NOT_FOUND',
        message: `来源 ${mutation.sourceId} 未绑定会计期间。`,
        transactionId
      }),
      ok: false,
      snapshot: repository.readDatabaseSnapshot()
    };
  }

  return repository.runPeriodLockedTransaction({
    period,
    transaction: (state) =>
      applyFinanceSourceMutationInPersistenceTransaction({
        context,
        mutation,
        state
      }),
    transactionId
  });
}

export function createRowBackedSqlRepositoryFromSnapshot({
  fallbackNow,
  snapshot
}: {
  fallbackNow: string;
  snapshot: PeriodCloseDatabaseRepositorySnapshot;
}): PeriodCloseDatabaseRepository {
  return createRowBackedPeriodCloseRepository({
    fallbackNow,
    initialState: hydratePeriodCloseStateFromDatabaseSnapshot(snapshot)
  });
}
