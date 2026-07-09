import {
  createPeriodCloseServiceConcurrencyContract,
  validatePeriodCloseServiceConcurrencyEvents
} from './periodCloseServiceConcurrencyContract.js';
import { hydratePeriodCloseStateFromDatabaseSnapshot } from './periodCloseDatabaseRepositoryContract.js';
import { createPeriodCloseServiceTransactionBoundaryContract } from './periodCloseServiceTransactionBoundaryContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord,
  PersistentSourceMutationRequest
} from './periodClosePersistenceContract.js';

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

function createCheckInput() {
  return {
    checks: createCloseChecks(),
    computedAt: '2026-06-30T20:00:00+08:00',
    sourceVersionSetHash: 'src_hash_202606',
    trialBalance: {
      creditTotal: '68000.00',
      debitTotal: '68000.00',
      difference: '0.00',
      status: '平衡' as const
    }
  };
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
      '2026-06': createCheckInput(),
      '2026-07': {
        ...createCheckInput(),
        computedAt: '2026-07-31T20:00:00+08:00',
        sourceVersionSetHash: 'src_hash_202607'
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
    idempotencyKey: 'idem-close-service-concurrency',
    now: '2026-07-02T22:45:00+08:00',
    reason: '月末结账',
    requestId: 'req-service-concurrency-close',
    version: 1,
    ...overrides
  };
}

function createHarness(initialState = createState()) {
  const driver = createInMemoryPeriodCloseSqlDriverExecutor();
  const repository = createPeriodCloseSqlRepositoryContract({
    fallbackNow: '2026-07-02T22:00:00+08:00',
    initialState
  });
  const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
  const resolveSourcePeriod = ({ mutation }: { mutation: PersistentSourceMutationRequest }) =>
    mutation.targetAccountingPeriod ??
    repository
      .readDatabaseSnapshot()
      .sourceRecords.find(
        (record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea
      )?.accountingPeriod;
  const service = createPeriodCloseServiceTransactionBoundaryContract({
    clientRepository,
    resolveSourceMutationPeriod: ({ mutation }) => resolveSourcePeriod({ mutation })
  });
  const concurrency = createPeriodCloseServiceConcurrencyContract({
    resolveSourceMutationPeriods: ({ mutation }) => {
      const sourcePeriod = resolveSourcePeriod({ mutation });

      return [sourcePeriod, mutation.targetAccountingPeriod].filter(
        (period): period is string => period !== undefined
      );
    },
    service
  });

  return { concurrency, repository, service };
}

const tests: UnitTest[] = [
  {
    name: 'rejects a second close request while the same period is in flight and then allows idempotent replay',
    run: () => {
      const { concurrency, repository } = createHarness();
      const first = concurrency.reserveCloseAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-concurrent-close-first'
        })
      });

      assert(first.ok, 'first close should reserve the service-level period gate');

      const second = concurrency.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-concurrent-close-second',
          idempotencyKey: 'idem-close-service-concurrency-second'
        })
      });

      assertEqual(second.ok, false, 'second close should not enter DB client while first is in flight');

      if (second.ok) {
        throw new Error('second close should be rejected while period gate is active');
      }

      assertEqual(second.error.code, 'PERIOD_TRANSACTION_IN_FLIGHT', 'second close should receive retryable in-flight error');

      const completed = concurrency.completeReservedClose(first.reservation);

      assert(completed.ok, 'reserved close should complete after the gate is released');
      assertEqual(completed.serviceResult.status, 'committed', 'reserved close should commit');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'first close should persist the period lock'
      );

      const replay = concurrency.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-concurrent-close-replay'
        })
      });

      assert(replay.ok, 'idempotent replay after gate release should delegate to service');

      if (!replay.serviceResult.repositoryResult.driverOk || !replay.serviceResult.repositoryResult.result.ok) {
        throw new Error('idempotent replay should reach repository result');
      }

      const replayValue = replay.serviceResult.repositoryResult.result.value;

      if (!replayValue.ok) {
        throw new Error('idempotent replay should return a successful close value');
      }

      assertEqual(replayValue.replayed, true, 'replay should reuse existing close result');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_period_close_checks.length,
        1,
        'idempotent replay must not create a duplicate close snapshot'
      );
      assertEqual(
        validatePeriodCloseServiceConcurrencyEvents(concurrency.readConcurrencyEvents()).length,
        0,
        'service concurrency events should remain valid'
      );
    }
  },
  {
    name: 'blocks source mutation while close for the same period is in flight',
    run: () => {
      const { concurrency, repository } = createHarness();
      const reserved = concurrency.reserveCloseAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-concurrent-close-before-source'
        })
      });

      assert(reserved.ok, 'close should reserve period before source guard request arrives');

      const sourceDuringClose = concurrency.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-002', name: '王芳' },
          now: '2026-07-02T22:46:00+08:00',
          requestId: 'req-source-during-close'
        },
        mutation: {
          amount: '1600.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        }
      });

      assertEqual(sourceDuringClose.ok, false, 'source mutation should not enter DB client while close holds gate');
      assertEqual(repository.readDatabaseSnapshot().sourceRecords[0]?.amount, '1000.00', 'source amount should remain unchanged');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events.length,
        0,
        'in-flight service rejection should not write source guard audit rows before DB transaction'
      );

      const completed = concurrency.completeReservedClose(reserved.reservation);

      assert(completed.ok, 'reserved close should complete');

      const sourceAfterClose = concurrency.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-002', name: '王芳' },
          now: '2026-07-02T22:47:00+08:00',
          requestId: 'req-source-after-close'
        },
        mutation: {
          amount: '1600.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        }
      });

      assert(sourceAfterClose.ok, 'source request should delegate after close gate is released');

      if (!sourceAfterClose.serviceResult.repositoryResult.driverOk || !sourceAfterClose.serviceResult.repositoryResult.result.ok) {
        throw new Error('source guard should reach repository after close');
      }

      assertEqual(
        sourceAfterClose.serviceResult.repositoryResult.result.value.ok,
        false,
        'source guard should be rejected by persisted closed-period lock'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period source guard should persist one audit row after the close commits'
      );
    }
  },
  {
    name: 'allows another period to close while a different period gate is in flight',
    run: () => {
      const { concurrency, repository } = createHarness();
      const june = concurrency.reserveCloseAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-june-close-in-flight'
        })
      });

      assert(june.ok, 'June close should reserve the June period gate');

      const july = concurrency.closeAccountingPeriod({
        period: '2026-07',
        request: createCloseRequest({
          idempotencyKey: 'idem-july-close',
          now: '2026-08-01T22:45:00+08:00',
          requestId: 'req-july-close-while-june-active',
          version: 1
        })
      });

      assert(july.ok, 'July close should not be blocked by June period gate');
      assertEqual(july.serviceResult.status, 'committed', 'July close should commit independently');
      assertEqual(
        repository
          .readDatabaseSnapshot()
          .periodCloseRows.accounting_periods.find((period) => period.period === '2026-07')?.status,
        '已结账',
        'July period should be closed before June reservation completes'
      );

      const juneCompleted = concurrency.completeReservedClose(june.reservation);

      assert(juneCompleted.ok, 'June close should still complete after July close');
      assertEqual(
        validatePeriodCloseServiceConcurrencyEvents(concurrency.readConcurrencyEvents()).length,
        0,
        'cross-period concurrency should keep valid period-gate trace'
      );
    }
  },
  {
    name: 'replays a committed close after service restart from persisted row-backed snapshot',
    run: () => {
      const firstRuntime = createHarness();
      const firstClose = firstRuntime.concurrency.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          idempotencyKey: 'idem-close-service-restart-replay',
          requestId: 'req-close-before-service-restart'
        })
      });

      assert(firstClose.ok, 'first close before service restart should delegate');
      assertEqual(firstClose.serviceResult.status, 'committed', 'first close before restart should commit');

      const persistedSnapshot = firstRuntime.repository.readDatabaseSnapshot();

      assertEqual(
        persistedSnapshot.periodCloseRows.accounting_period_close_checks.length,
        1,
        'first close should persist exactly one close snapshot row before restart'
      );
      assertEqual(
        persistedSnapshot.periodCloseRows.accounting_period_events.length,
        1,
        'first close should persist exactly one close event row before restart'
      );
      assertEqual(
        persistedSnapshot.periodCloseRows.accounting_period_idempotency_records.length,
        1,
        'first close should persist exactly one idempotency row before restart'
      );

      const restartedRuntime = createHarness(hydratePeriodCloseStateFromDatabaseSnapshot(persistedSnapshot));
      const replayAfterRestart = restartedRuntime.concurrency.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          idempotencyKey: 'idem-close-service-restart-replay',
          requestId: 'req-close-after-service-restart'
        })
      });

      assert(replayAfterRestart.ok, 'same idempotency key after service restart should delegate to repository');

      if (
        !replayAfterRestart.serviceResult.repositoryResult.driverOk ||
        !replayAfterRestart.serviceResult.repositoryResult.result.ok
      ) {
        throw new Error('same idempotency key after service restart should reach repository result');
      }

      const replayValue = replayAfterRestart.serviceResult.repositoryResult.result.value;

      if (!replayValue.ok) {
        throw new Error('same idempotency key after service restart should return close success');
      }

      assertEqual(replayValue.replayed, true, 'same idempotency key after restart should replay persisted close result');

      const restartedSnapshot = restartedRuntime.repository.readDatabaseSnapshot();

      assertEqual(
        restartedSnapshot.periodCloseRows.accounting_period_close_checks.length,
        1,
        'service restart replay must not duplicate close snapshot rows'
      );
      assertEqual(
        restartedSnapshot.periodCloseRows.accounting_period_events.length,
        1,
        'service restart replay must not duplicate close event rows'
      );
      assertEqual(
        restartedSnapshot.periodCloseRows.accounting_period_idempotency_records.length,
        1,
        'service restart replay must not duplicate idempotency rows'
      );
    }
  },
  {
    name: 'detects invalid concurrency traces with overlapping same-period gates',
    run: () => {
      const errors = validatePeriodCloseServiceConcurrencyEvents([
        {
          event: 'acquire_period_gate',
          operation: 'close_accounting_period',
          period: '2026-06',
          requestId: 'req-a',
          reservationId: 'res-a',
          sequence: 1
        },
        {
          event: 'acquire_period_gate',
          operation: 'close_accounting_period',
          period: '2026-06',
          requestId: 'req-b',
          reservationId: 'res-b',
          sequence: 2
        }
      ]);

      assert(
        errors.some((error) => error.includes('must not have two active service-level period gates')),
        'validator should reject overlapping same-period service gates'
      );
      assert(
        errors.some((error) => error.includes('must be released')),
        'validator should require period gates to be released'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
