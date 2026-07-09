import {
  canonicalClosedAccountingPeriodErrorCode,
  requiredCloseCheckCodes,
  type CloseAccountingPeriodRequest,
  type CloseCheckRow
} from './periodCloseContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';
import {
  applyFinanceSourceMutationWithRepositoryTransaction,
  closeAccountingPeriodWithRepositoryTransaction,
  createInMemoryPeriodCloseRepository
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
    idempotencyKey: 'idem-close-202606',
    now: '2026-07-02T21:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-repository',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'commits period close through repository transaction and protects committed state copies',
    run: () => {
      const repository = createInMemoryPeriodCloseRepository(createState());
      const result = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(result.ok, true, 'repository close should pass');
      assertEqual(repository.readState().periods[0]?.status, '已结账', 'repository should commit closed period');
      assertEqual(repository.readState().closeCheckSnapshots.length, 1, 'repository should commit close snapshot');
      assertEqual(repository.readState().periodEvents.length, 1, 'repository should commit close event');

      const leakedState = repository.readState();
      if (leakedState.periods[0]) {
        leakedState.periods[0].status = '开放';
      }

      assertEqual(repository.readState().periods[0]?.status, '已结账', 'readState should return a defensive copy');
    }
  },
  {
    name: 'replays close idempotency in repository without duplicate commits',
    run: () => {
      const repository = createInMemoryPeriodCloseRepository(createState());
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

      assertEqual(first.ok, true, 'first close should pass');
      assertEqual(replay.ok, true, 'replay close should pass');

      if (!replay.ok) {
        return;
      }

      assertEqual(replay.replayed, true, 'repository replay should retain replay flag');
      assertEqual(repository.readState().closeCheckSnapshots.length, 1, 'repository replay should not duplicate snapshots');
      assertEqual(repository.readState().periodEvents.length, 1, 'repository replay should not duplicate period events');
      assertEqual(repository.readState().idempotencyRecords.length, 1, 'repository replay should not duplicate idempotency records');
    }
  },
  {
    name: 'uses committed period lock to reject later source mutation in same repository',
    run: () => {
      const repository = createInMemoryPeriodCloseRepository(createState());
      const closeResult = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(closeResult.ok, true, 'close should pass before source mutation check');

      const mutationResult = applyFinanceSourceMutationWithRepositoryTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T21:35:00+08:00',
          requestId: 'req-source-after-close'
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

      assertEqual(mutationResult.ok, false, 'source mutation should reject after period close commit');
      assertEqual(
        mutationResult.ok ? '' : mutationResult.error.code,
        canonicalClosedAccountingPeriodErrorCode,
        'source mutation should use closed-period code after committed lock'
      );
      assertEqual(repository.readState().sourceRecords[0]?.amount, '1000.00', 'source amount should stay unchanged');
      assertEqual(repository.readState().sourceRecords[0]?.version, 1, 'source version should stay unchanged');
      assertEqual(repository.readState().sourceMutationEvents.length, 1, 'rejection event should be committed');
    }
  },
  {
    name: 'does not commit repository transaction when handler throws',
    run: () => {
      const repository = createInMemoryPeriodCloseRepository(createState());
      let caught = false;

      try {
        repository.runInTransaction((state) => {
          if (state.periods[0]) {
            state.periods[0].status = '已结账';
          }
          throw new Error('simulated repository failure');
        });
      } catch {
        caught = true;
      }

      assertEqual(caught, true, 'repository exception should surface to caller');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'failed transaction should not commit working state');
      assertEqual(repository.readState().periodEvents.length, 0, 'failed transaction should not append events');
    }
  }
];

for (const test of tests) {
  test.run();
}
