import {
  canonicalClosedAccountingPeriodErrorCode,
  requiredCloseCheckCodes,
  type CloseAccountingPeriodRequest,
  type CloseCheckRow
} from './periodCloseContract.js';
import {
  createRowBackedPeriodCloseRepository,
  hydratePeriodCloseStateFromDatabaseSnapshot
} from './periodCloseDatabaseRepositoryContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';
import {
  applyFinanceSourceMutationWithRepositoryTransaction,
  closeAccountingPeriodWithRepositoryTransaction
} from './periodCloseRepositoryContract.js';

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
    idempotencyKey: 'idem-close-row-repository',
    now: '2026-07-02T22:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-row-repository',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'hydrates persistent state from row-backed database snapshot',
    run: () => {
      const repository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const snapshot = repository.readDatabaseSnapshot();
      const hydratedState = hydratePeriodCloseStateFromDatabaseSnapshot(snapshot);

      assertEqual(snapshot.periodCloseRows.accounting_periods.length, 2, 'snapshot should store accounting periods as rows');
      assertEqual(hydratedState.periods[0]?.period, '2026-06', 'hydrated state should restore period');
      assertEqual(hydratedState.sourceRecords[0]?.sourceNo, 'AR-202606-001', 'hydrated state should restore source records');

      snapshot.periodCloseRows.accounting_periods[0]!.status = '已结账';

      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'database snapshot reads should be defensive copies'
      );
    }
  },
  {
    name: 'commits close transaction into period-close row sets',
    run: () => {
      const repository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const result = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(result.ok, true, 'row-backed close should pass');

      const snapshot = repository.readDatabaseSnapshot();
      const periodRow = snapshot.periodCloseRows.accounting_periods.find((row) => row.period === '2026-06');

      assert(periodRow !== undefined, 'period row should exist');
      assertEqual(periodRow.status, '已结账', 'row-backed repository should persist closed period row');
      assert(periodRow.close_check_snapshot_id !== undefined, 'closed period row should link close snapshot row');
      assertEqual(
        snapshot.periodCloseRows.accounting_period_close_checks.length,
        1,
        'row-backed repository should persist close snapshot row'
      );
      assertEqual(
        snapshot.periodCloseRows.accounting_period_idempotency_records.length,
        1,
        'row-backed repository should persist idempotency row'
      );
      assertEqual(
        repository.readState().periods[0]?.closeCheckSnapshotId,
        periodRow.close_check_snapshot_id,
        'readState should hydrate close snapshot id from rows'
      );
    }
  },
  {
    name: 'preserves not-run close-check row status during hydration',
    run: () => {
      const repository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const result = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(result.ok, true, 'row-backed close should pass before hydration mutation');

      const snapshot = repository.readDatabaseSnapshot();
      const closeCheckRow = snapshot.periodCloseRows.accounting_period_close_checks[0];

      assert(closeCheckRow !== undefined, 'close-check row should exist');
      closeCheckRow.status = '未运行';

      const hydratedState = hydratePeriodCloseStateFromDatabaseSnapshot(snapshot);

      assertEqual(
        hydratedState.closeCheckSnapshots[0]?.status,
        '未运行',
        'row-backed hydration should not coerce not-run status into passed'
      );
    }
  },
  {
    name: 'defensively copies nested json row fields',
    run: () => {
      const repository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const result = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(result.ok, true, 'row-backed close should pass before nested json mutation');

      const snapshot = repository.readDatabaseSnapshot();
      const idempotencyRow = snapshot.periodCloseRows.accounting_period_idempotency_records[0];

      assert(idempotencyRow !== undefined, 'idempotency row should exist');
      const responseSnapshotValue = idempotencyRow.response_snapshot;

      assert(
        responseSnapshotValue !== null && typeof responseSnapshotValue === 'object' && !Array.isArray(responseSnapshotValue),
        'response snapshot should be an object'
      );

      const responseSnapshot = responseSnapshotValue as { period?: { status?: string } };

      assert(responseSnapshot.period !== undefined, 'response snapshot should contain period');
      responseSnapshot.period.status = '开放';

      const freshResponse = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_idempotency_records[0]
        ?.response_snapshot as { period?: { status?: string } } | undefined;

      assertEqual(freshResponse?.period?.status, '已结账', 'nested json mutation should not leak into repository state');
    }
  },
  {
    name: 'replays close idempotency from row-backed repository without duplicate rows',
    run: () => {
      const repository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const first = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });
      const replay = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(first.ok, true, 'first row-backed close should pass');
      assertEqual(replay.ok, true, 'replay row-backed close should pass');

      if (!replay.ok) {
        return;
      }

      const rows = repository.readDatabaseSnapshot().periodCloseRows;

      assertEqual(replay.replayed, true, 'row-backed replay should retain replay flag');
      assertEqual(rows.accounting_period_close_checks.length, 1, 'row-backed replay should not duplicate snapshots');
      assertEqual(rows.accounting_period_events.length, 1, 'row-backed replay should not duplicate events');
      assertEqual(rows.accounting_period_idempotency_records.length, 1, 'row-backed replay should not duplicate idempotency rows');
    }
  },
  {
    name: 'uses row-backed committed lock to reject source mutation and persist guard audit row',
    run: () => {
      const repository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const closeResult = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(closeResult.ok, true, 'close should pass before source mutation');

      const mutationResult = applyFinanceSourceMutationWithRepositoryTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:35:00+08:00',
          requestId: 'req-source-row-backed'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        repository
      });

      assertEqual(mutationResult.ok, false, 'closed-period source mutation should reject');
      assertEqual(
        mutationResult.ok ? '' : mutationResult.error.code,
        canonicalClosedAccountingPeriodErrorCode,
        'closed-period rejection should keep canonical code'
      );

      const snapshot = repository.readDatabaseSnapshot();

      assertEqual(snapshot.sourceRecords[0]?.amount, '1000.00', 'source row should stay unchanged');
      assertEqual(snapshot.sourceRecords[0]?.version, 1, 'source row version should stay unchanged');
      assertEqual(
        snapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'rejection should persist guard audit row'
      );
      assertEqual(
        snapshot.periodCloseRows.accounting_period_source_mutation_events[0]?.event_type,
        'source_mutation_rejected',
        'guard audit row should record rejection'
      );
    }
  },
  {
    name: 'rolls back row-backed transaction when handler throws',
    run: () => {
      const repository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      let caught = false;

      try {
        repository.runInTransaction((state) => {
          if (state.periods[0]) {
            state.periods[0].status = '已结账';
          }
          throw new Error('simulated row-backed repository failure');
        });
      } catch {
        caught = true;
      }

      const snapshot = repository.readDatabaseSnapshot();

      assertEqual(caught, true, 'row-backed repository exception should surface');
      assertEqual(snapshot.periodCloseRows.accounting_periods[0]?.status, '开放', 'failed transaction should not commit row state');
      assertEqual(snapshot.periodCloseRows.accounting_period_events.length, 0, 'failed transaction should not append events');
    }
  }
];

for (const test of tests) {
  test.run();
}
