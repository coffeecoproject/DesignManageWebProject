import {
  createPeriodCloseServiceTransactionBoundaryContract,
  validatePeriodCloseServiceTransactionEvents
} from './periodCloseServiceTransactionBoundaryContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import {
  createInMemoryPeriodCloseSqlDriverExecutor,
  type PeriodCloseSqlDriverStatementName
} from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
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
    idempotencyKey: 'idem-close-service-boundary',
    now: '2026-07-02T22:45:00+08:00',
    reason: '月末结账',
    requestId: 'req-service-close',
    version: 1,
    ...overrides
  };
}

function createService({
  failOnStatement,
  initialState = createState()
}: {
  failOnStatement?: PeriodCloseSqlDriverStatementName;
  initialState?: PeriodClosePersistentState;
} = {}) {
  const driver = createInMemoryPeriodCloseSqlDriverExecutor(
    failOnStatement ? { failOnStatement } : undefined
  );
  const repository = createPeriodCloseSqlRepositoryContract({
    fallbackNow: '2026-07-02T22:00:00+08:00',
    initialState
  });
  const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
  const service = createPeriodCloseServiceTransactionBoundaryContract({
    clientRepository,
    resolveSourceMutationPeriod: ({ mutation }) =>
      mutation.targetAccountingPeriod ??
      repository
        .readDatabaseSnapshot()
        .sourceRecords.find(
          (record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea
        )?.accountingPeriod
  });

  return {
    repository,
    service
  };
}

const tests: UnitTest[] = [
  {
    name: 'commits close through service transaction boundary',
    run: () => {
      const { repository, service } = createService();
      const result = service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest()
      });

      assertEqual(result.status, 'committed', 'service close should commit');
      assertEqual(result.traceErrors.length, 0, 'service close should have valid DB client trace');
      assertEqual(result.runtimeResult.status, 'committed', 'service close should validate committed DB runtime trace');
      assertEqual(
        validatePeriodCloseServiceTransactionEvents(result.serviceEvents).length,
        0,
        'service events should follow request-to-response order'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'service close should persist closed period'
      );
      assert(
        result.clientEvents.some((event) => event.event === 'release_connection'),
        'service close must release the DB client connection'
      );
    }
  },
  {
    name: 'rolls back stale close through service transaction boundary',
    run: () => {
      const { repository, service } = createService();
      const result = service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-service-stale-close',
          version: 99
        })
      });

      assertEqual(result.status, 'rolled_back', 'stale close should rollback service transaction');
      assertEqual(result.traceErrors.length, 0, 'stale close rollback should still have valid DB client trace');
      assertEqual(result.runtimeResult.status, 'rolled_back', 'stale close should validate rolled-back DB runtime trace');
      assert(
        result.clientEvents.some((event) => event.event === 'rollback_transaction'),
        'stale close should rollback DB client transaction'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'stale close should not mutate accounting period'
      );
    }
  },
  {
    name: 'commits closed-period source guard audit through service transaction boundary',
    run: () => {
      const { repository, service } = createService();

      service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-service-close-before-source'
        })
      });

      const result = service.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:55:00+08:00',
          requestId: 'req-service-source-guard'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        }
      });

      assertEqual(result.status, 'committed', 'closed-period source guard audit should commit');
      assertEqual(result.traceErrors.length, 0, 'source guard service trace should be valid');
      assertEqual(result.runtimeResult.status, 'committed', 'source guard should validate committed DB runtime trace');

      if (!result.repositoryResult.driverOk || !result.repositoryResult.result.ok) {
        throw new Error('source guard service result should reach repository transaction');
      }

      assertEqual(result.repositoryResult.result.value.ok, false, 'source mutation should be rejected by closed-period guard');
      assertEqual(repository.readDatabaseSnapshot().sourceRecords[0]?.amount, '1000.00', 'source row should remain unchanged');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'source guard rejection should persist one audit row'
      );
    }
  },
  {
    name: 'rejects source guard when runtime accounting period cannot be resolved',
    run: () => {
      const { service } = createService();
      const result = service.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:58:00+08:00',
          requestId: 'req-service-unresolved-source-period'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'missing-source',
          status: '已调整'
        }
      });

      assertEqual(result.status, 'trace_invalid', 'unresolved source period should fail service/runtime validation');
      assertEqual(
        result.runtimeResult.period,
        'UNRESOLVED_ACCOUNTING_PERIOD',
        'runtime adapter should expose unresolved source period explicitly'
      );
      assert(
        result.traceErrors.some((error) =>
          error.includes('source mutation runtime accounting period must be resolved')
        ),
        'service trace should require source mutation accounting period before runtime validation'
      );
    }
  },
  {
    name: 'maps driver failure to service transaction error and releases connection',
    run: () => {
      const { repository, service } = createService({
        failOnStatement: 'lock_accounting_period_for_update'
      });
      const result = service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-service-driver-failure'
        })
      });

      assertEqual(result.status, 'driver_failed', 'driver failure should surface as service driver failure');
      assertEqual(result.error?.code, 'DB_TRANSACTION_FAILED', 'service should map driver failure to transaction error');
      assertEqual(result.error?.retryable, true, 'driver failures should be retryable');
      assertEqual(result.runtimeResult.status, 'driver_failed', 'driver failure should validate failed DB runtime trace');
      assertEqual(result.clientEvents.at(-1)?.event, 'release_connection', 'driver failure should release connection');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'driver failure should not mutate period'
      );
    }
  },
  {
    name: 'uses independent service transaction ids across sequential requests',
    run: () => {
      const { service } = createService();
      const closeResult = service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-service-sequence-close'
        })
      });
      const sourceResult = service.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T23:00:00+08:00',
          requestId: 'req-service-sequence-source'
        },
        mutation: {
          amount: '1200.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        }
      });

      assert(closeResult.transactionId !== sourceResult.transactionId, 'service requests should not reuse transaction ids');
      assertEqual(
        validatePeriodCloseServiceTransactionEvents(service.readServiceEvents()).length,
        0,
        'all service transactions should keep independent event order'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
