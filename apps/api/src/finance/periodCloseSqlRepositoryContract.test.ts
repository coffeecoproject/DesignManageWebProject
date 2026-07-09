import {
  applyFinanceSourceMutationWithSqlRepositoryTransaction,
  closeAccountingPeriodWithSqlRepositoryTransaction,
  createPeriodCloseSqlRepositoryContract,
  periodCloseSqlMigrationContract,
  validatePeriodCloseSqlMigrationContract
} from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';
import { closeAccountingPeriodInPersistenceTransaction } from './periodClosePersistenceContract.js';

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

function createPeriod(overrides: Partial<PersistentAccountingPeriodRecord> = {}): PersistentAccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createCloseChecks(): CloseCheckRow[] {
  return requiredCloseCheckCodes.map((code) => ({
    blockerCount: 0,
    canPass: true,
    code,
    label: code,
    sources: [],
    status: '通过',
    summary: '通过'
  }));
}

function createSourceRecord(
  overrides: Partial<PersistentFinanceSourceRecord> = {}
): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1000.00',
    id: 'source-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-001',
    status: '未结清',
    version: 1,
    ...overrides
  };
}

function createState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {
      '2026-06': {
        checks: createCloseChecks(),
        computedAt: '2026-06-30T20:00:00+08:00',
        sourceVersionSetHash: 'src_hash_202606',
        trialBalance: {
          creditTotal: '68000.00',
          debitTotal: '68000.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    },
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [createPeriod(), createPeriod({ period: '2026-07' })],
    sourceMutationEvents: [],
    sourceRecords: [createSourceRecord()],
    ...overrides
  };
}

function createCloseRequest(overrides: Partial<CloseAccountingPeriodRequest> = {}): CloseAccountingPeriodRequest {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    idempotencyKey: 'idem-close-sql-repository',
    now: '2026-07-02T22:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-sql-repository',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'defines additive SQL migration shape for period-close rows and locks',
    run: () => {
      const errors = validatePeriodCloseSqlMigrationContract();

      assertEqual(errors.length, 0, `migration contract should be valid: ${errors.join('; ')}`);
      assertEqual(periodCloseSqlMigrationContract.destructive, false, 'period-close SQL migration must be non-destructive');
      assert(
        periodCloseSqlMigrationContract.indexes.some(
          (index) =>
            index.name === 'idx_accounting_periods_period_version_for_close_lock' &&
            index.table === 'accounting_periods' &&
            index.columns.join(',') === 'period,version'
        ),
        'migration should expose period plus version lock lookup index'
      );
      assert(
        periodCloseSqlMigrationContract.indexes.some(
          (index) =>
            index.name === 'uk_accounting_period_idempotency_period_operation_key' &&
            index.unique === true &&
            index.columns.join(',') === 'period,operation,idempotency_key'
        ),
        'migration should expose unique period operation idempotency key'
      );
      assert(
        periodCloseSqlMigrationContract.transactionBoundaries.some((boundary) =>
          boundary.locks.some((lock) => lock.table === 'accounting_periods' && lock.mode === 'select_for_update')
        ),
        'migration should document accounting period row lock boundary'
      );
    }
  },
  {
    name: 'commits close through SQL period lock and keeps idempotent replay single-row',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const first = closeAccountingPeriodWithSqlRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest(),
        transactionId: 'tx-close-202606'
      });
      const replay = closeAccountingPeriodWithSqlRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest(),
        transactionId: 'tx-close-202606-replay'
      });

      assertEqual(first.ok, true, 'first close should commit through SQL repository');
      assertEqual(replay.ok, true, 'matching idempotency replay should commit through SQL repository');

      if (!first.ok || !replay.ok) {
        return;
      }

      const rows = repository.readDatabaseSnapshot().periodCloseRows;
      const periodRow = rows.accounting_periods.find((row) => row.period === '2026-06');

      assertEqual(periodRow?.status, '已结账', 'period row should be closed after SQL transaction');
      assertEqual(periodRow?.version, 2, 'closed period row should increment version once');
      assertEqual(rows.accounting_period_close_checks.length, 1, 'idempotent replay should not duplicate close snapshots');
      assertEqual(rows.accounting_period_events.length, 1, 'idempotent replay should not duplicate events');
      assertEqual(rows.accounting_period_idempotency_records.length, 1, 'idempotent replay should not duplicate idempotency rows');
      assertEqual(replay.value.ok, true, 'replay value should be a successful domain result');
      assertEqual(replay.value.ok ? replay.value.replayed : false, true, 'domain close result should mark replay');
    }
  },
  {
    name: 'rejects stale period version before entering SQL transaction',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const result = closeAccountingPeriodWithSqlRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest({ version: 99 }),
        transactionId: 'tx-stale-close-202606'
      });
      const rows = repository.readDatabaseSnapshot().periodCloseRows;

      assertEqual(result.ok, false, 'stale version should not enter close transaction');
      assertEqual(result.ok ? '' : result.error.code, 'PERIOD_VERSION_CONFLICT', 'stale version should use SQL conflict code');
      assertEqual(rows.accounting_periods[0]?.status, '开放', 'stale version should not mutate period row');
      assertEqual(rows.accounting_period_events.length, 0, 'stale version should not append domain events');
    }
  },
  {
    name: 'rolls back SQL transaction when handler throws before commit',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      let caught = false;

      try {
        repository.runPeriodLockedTransaction({
          expectedVersion: 1,
          period: '2026-06',
          transaction: (state) => {
            if (state.periods[0]) {
              state.periods[0].status = '已结账';
            }

            throw new Error('simulated SQL transaction failure');
          },
          transactionId: 'tx-throws-202606'
        });
      } catch {
        caught = true;
      }

      const rows = repository.readDatabaseSnapshot().periodCloseRows;

      assertEqual(caught, true, 'SQL repository should surface transaction exception');
      assertEqual(rows.accounting_periods[0]?.status, '开放', 'failed SQL transaction should not commit period mutation');
      assertEqual(rows.accounting_period_events.length, 0, 'failed SQL transaction should not append events');
    }
  },
  {
    name: 'rejects nested same-period transaction while SQL period row is locked',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      let nestedCode = '';
      const result = repository.runPeriodLockedTransaction({
        expectedVersion: 1,
        period: '2026-06',
        transaction: (state) => {
          const nested = closeAccountingPeriodWithSqlRepositoryTransaction({
            period: '2026-06',
            repository,
            request: createCloseRequest({ idempotencyKey: 'idem-nested-close', requestId: 'req-nested-close' }),
            transactionId: 'tx-nested-202606'
          });

          nestedCode = nested.ok ? '' : nested.error.code;

          return closeAccountingPeriodInPersistenceTransaction({
            period: '2026-06',
            request: createCloseRequest({
              idempotencyKey: 'idem-outer-close',
              requestId: 'req-outer-close'
            }),
            state
          });
        },
        transactionId: 'tx-outer-202606'
      });

      assertEqual(result.ok, true, 'outer transaction should still commit');
      assertEqual(nestedCode, 'PERIOD_LOCK_CONFLICT', 'nested transaction should be rejected by period lock');

      const rows = repository.readDatabaseSnapshot().periodCloseRows;

      assertEqual(rows.accounting_periods[0]?.status, '已结账', 'outer transaction should close the period');
      assertEqual(rows.accounting_period_events.length, 1, 'nested conflict should not append an extra event');
    }
  },
  {
    name: 'uses committed SQL period lock to reject closed-period source mutation',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const closeResult = closeAccountingPeriodWithSqlRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest(),
        transactionId: 'tx-close-before-source-mutation'
      });

      assertEqual(closeResult.ok, true, 'close should pass before source mutation');

      const mutationResult = applyFinanceSourceMutationWithSqlRepositoryTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:35:00+08:00',
          requestId: 'req-source-sql-closed-period'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        repository,
        transactionId: 'tx-source-sql-closed-period'
      });

      assertEqual(mutationResult.ok, true, 'SQL transaction should commit the rejection audit result');

      if (!mutationResult.ok) {
        return;
      }

      assertEqual(mutationResult.value.ok, false, 'domain source mutation should be rejected for closed period');

      const snapshot = repository.readDatabaseSnapshot();

      assertEqual(snapshot.sourceRecords[0]?.amount, '1000.00', 'closed source amount should stay unchanged');
      assertEqual(snapshot.sourceRecords[0]?.version, 1, 'closed source version should stay unchanged');
      assertEqual(
        snapshot.periodCloseRows.accounting_period_source_mutation_events[0]?.event_type,
        'source_mutation_rejected',
        'closed-period rejection should persist source mutation audit row'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
