import {
  createPeriodCloseServiceAtomicCommitBoundaryContract,
  validatePeriodCloseServiceAtomicCommitEvents,
  type PeriodCloseServiceAtomicCommitEvent
} from './periodCloseServiceAtomicCommitBoundaryContract.js';
import { createPeriodClosePostgresAtomicCommitBridgeContract } from './periodClosePostgresAtomicCommitBridgeContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import type { PeriodClosePostgresClientPort } from './periodClosePostgresClientPortContract.js';
import {
  clonePeriodClosePersistentState,
  type PeriodClosePersistentState,
  type PersistentAccountingPeriodRecord,
  type PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createPgError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string };

  error.code = code;

  return error;
}

function createMockPool({
  failWhenSqlIncludes
}: {
  failWhenSqlIncludes?: string;
} = {}) {
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  const releases: string[] = [];
  let connectCount = 0;

  const client: PeriodClosePostgresClientPort = {
    query: async (sql, parameters = []) => {
      queries.push({ parameters: [...parameters], sql });

      if (failWhenSqlIncludes && sql.includes(failWhenSqlIncludes)) {
        throw createPgError('simulated service atomic postgres failure', '55P03');
      }

      return { rowCount: 1, rows: [] };
    },
    release: () => {
      releases.push('release');
    }
  };

  return {
    pool: {
      connect: async () => {
        connectCount += 1;

        return client;
      }
    },
    readState: () => ({
      connectCount,
      queries: queries.map((query) => ({ ...query, parameters: [...query.parameters] })),
      releaseCount: releases.length
    })
  };
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
        sourceVersionSetHash: 'src_hash_service_atomic_202606',
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
    idempotencyKey: `idem-service-atomic-${overrides.requestId ?? 'default'}`,
    now: '2026-07-05T11:00:00+08:00',
    reason: '月末结账',
    requestId: 'req-service-atomic-close',
    version: 1,
    ...overrides
  };
}

function createServiceAtomicBoundary({ failWhenSqlIncludes }: { failWhenSqlIncludes?: string } = {}) {
  let committedState = createState();
  let commitCount = 0;
  let rollbackCount = 0;
  const { pool, readState: readPoolState } = createMockPool({ failWhenSqlIncludes });
  const atomicBridge = createPeriodClosePostgresAtomicCommitBridgeContract({
    createUnitOfWork: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-05T11:00:00+08:00',
        initialState: clonePeriodClosePersistentState(committedState)
      });
      const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });

      return {
        clientRepository,
        commit: () => {
          committedState = clonePeriodClosePersistentState(repository.readState());
          commitCount += 1;
        },
        rollback: () => {
          rollbackCount += 1;
        }
      };
    },
    pool
  });
  const service = createPeriodCloseServiceAtomicCommitBoundaryContract({ atomicBridge });

  return {
    readCommittedSnapshot: () =>
      createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-05T11:00:00+08:00',
        initialState: clonePeriodClosePersistentState(committedState)
      }).readDatabaseSnapshot(),
    readPoolState,
    readUnitOfWorkState: () => ({
      commitCount,
      rollbackCount
    }),
    service
  };
}

const tests: UnitTest[] = [
  {
    name: 'commits close through service atomic commit boundary',
    run: async () => {
      const { readCommittedSnapshot, readPoolState, readUnitOfWorkState, service } = createServiceAtomicBoundary();
      const result = await service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest()
      });

      assertEqual(result.status, 'committed', 'service atomic close should commit');
      assertEqual(result.traceErrors.length, 0, `service atomic close trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(result.atomicResult.status, 'committed', 'service should delegate to committed atomic bridge result');
      assertEqual(readUnitOfWorkState().commitCount, 1, 'service atomic close should publish one staged unit');
      assertEqual(readUnitOfWorkState().rollbackCount, 0, 'service atomic close should not discard successful staged unit');
      assertEqual(readPoolState().releaseCount, 1, 'service atomic close should release pg-like client');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'service atomic close should publish closed period'
      );
      assertEqual(
        validatePeriodCloseServiceAtomicCommitEvents(result.serviceEvents).length,
        0,
        'service atomic events should follow request-to-response order'
      );
    }
  },
  {
    name: 'keeps committed snapshot unchanged when pg-like replay fails',
    run: async () => {
      const { readCommittedSnapshot, readPoolState, readUnitOfWorkState, service } = createServiceAtomicBoundary({
        failWhenSqlIncludes: 'UPDATE "accounting_periods"'
      });
      const result = await service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-service-atomic-pg-failure' })
      });

      assertEqual(result.status, 'trace_invalid', 'pg-like failure should invalidate service atomic close');
      assertEqual(result.error?.code, 'DB_ATOMIC_COMMIT_TRACE_INVALID', 'service error should classify trace invalid');
      assertEqual(result.atomicResult.postgresResult?.status, 'driver_failed', 'atomic bridge should expose pg-like failure');
      assertEqual(readPoolState().releaseCount, 1, 'pg-like failure should release client');
      assertEqual(readUnitOfWorkState().commitCount, 0, 'pg-like failure must not publish staged unit');
      assertEqual(readUnitOfWorkState().rollbackCount, 1, 'pg-like failure should discard staged unit');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'committed snapshot should remain open after pg-like failure'
      );
    }
  },
  {
    name: 'discards staged state for stale close through service atomic boundary',
    run: async () => {
      const { readCommittedSnapshot, readUnitOfWorkState, service } = createServiceAtomicBoundary();
      const result = await service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({
          requestId: 'req-service-atomic-stale-close',
          version: 99
        })
      });

      assertEqual(result.status, 'rolled_back', 'stale close should stay a business rollback');
      assertEqual(result.traceErrors.length, 0, `stale close trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(readUnitOfWorkState().commitCount, 0, 'stale close should not publish staged unit');
      assertEqual(readUnitOfWorkState().rollbackCount, 1, 'stale close should discard staged unit');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'committed snapshot should remain open after stale close'
      );
    }
  },
  {
    name: 'commits closed-period source guard audit through service atomic boundary',
    run: async () => {
      const { readCommittedSnapshot, readUnitOfWorkState, service } = createServiceAtomicBoundary();

      await service.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-service-atomic-close-before-source' })
      });

      const result = await service.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-05T11:05:00+08:00',
          requestId: 'req-service-atomic-source-guard'
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
      const committedSnapshot = readCommittedSnapshot();

      assertEqual(result.status, 'committed', 'closed-period source guard audit should commit');
      assertEqual(result.traceErrors.length, 0, `source guard trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(committedSnapshot.sourceRecords[0]?.amount, '1000.00', 'source row should remain unchanged');
      assertEqual(
        committedSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'source guard audit should be published after service atomic replay'
      );
      assertEqual(readUnitOfWorkState().commitCount, 2, 'close and source guard should each publish one staged unit');
    }
  },
  {
    name: 'validator rejects service atomic events that skip atomic delegation',
    run: () => {
      const invalidEvents: PeriodCloseServiceAtomicCommitEvent[] = [
        {
          event: 'receive_request',
          operation: 'close_accounting_period',
          period: '2026-06',
          requestId: 'req-service-atomic-invalid',
          sequence: 1,
          transactionId: 'tx-service-atomic-invalid'
        },
        {
          event: 'allocate_service_transaction',
          operation: 'close_accounting_period',
          period: '2026-06',
          requestId: 'req-service-atomic-invalid',
          sequence: 2,
          transactionId: 'tx-service-atomic-invalid'
        },
        {
          event: 'validate_atomic_commit_trace',
          operation: 'close_accounting_period',
          period: '2026-06',
          requestId: 'req-service-atomic-invalid',
          sequence: 3,
          transactionId: 'tx-service-atomic-invalid'
        },
        {
          event: 'return_response',
          operation: 'close_accounting_period',
          period: '2026-06',
          requestId: 'req-service-atomic-invalid',
          sequence: 4,
          transactionId: 'tx-service-atomic-invalid'
        }
      ];
      const errors = validatePeriodCloseServiceAtomicCommitEvents(invalidEvents);

      assert(
        errors.some((error) => error.includes('must follow request-to-response order')),
        'service validator should reject bypassing atomic bridge delegation'
      );
    }
  }
];

for (const test of tests) {
  await test.run();
}
