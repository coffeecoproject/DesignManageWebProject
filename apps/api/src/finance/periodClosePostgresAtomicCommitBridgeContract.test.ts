import {
  createPeriodClosePostgresAtomicCommitBridgeContract,
  validatePeriodClosePostgresAtomicCommitBridgeTrace,
  type PeriodClosePostgresAtomicCommitBridgeResult
} from './periodClosePostgresAtomicCommitBridgeContract.js';
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
        throw createPgError('simulated postgres atomic commit failure', '55P03');
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
    idempotencyKey: `idem-pg-atomic-${overrides.requestId ?? 'default'}`,
    now: '2026-07-02T22:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-pg-atomic-close',
    version: 1,
    ...overrides
  };
}

function createAtomicBridge({ failWhenSqlIncludes }: { failWhenSqlIncludes?: string } = {}) {
  let committedState = createState();
  let commitCount = 0;
  let rollbackCount = 0;
  const { pool, readState: readPoolState } = createMockPool({ failWhenSqlIncludes });
  const bridge = createPeriodClosePostgresAtomicCommitBridgeContract({
    createUnitOfWork: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
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

  return {
    bridge,
    readCommittedSnapshot: () =>
      createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: clonePeriodClosePersistentState(committedState)
      }).readDatabaseSnapshot(),
    readPoolState,
    readUnitOfWorkState: () => ({
      commitCount,
      rollbackCount
    })
  };
}

function cloneResult<T extends PeriodClosePostgresAtomicCommitBridgeResult<never>>(result: T): T {
  return {
    ...result,
    atomicEvents: result.atomicEvents.map((event) => ({ ...event })),
    clientEvents: result.clientEvents.map((event) => ({ ...event })),
    driverExecutions: result.driverExecutions.map((execution) => ({
      ...execution,
      parameters: [...execution.parameters]
    })),
    postgresResult: result.postgresResult
      ? {
          ...result.postgresResult,
          events: result.postgresResult.events.map((event) => ({ ...event })),
          executions: result.postgresResult.executions.map((execution) => ({
            ...execution,
            parameters: [...execution.parameters]
          })),
          traceErrors: [...result.postgresResult.traceErrors]
        }
      : undefined,
    traceErrors: [...result.traceErrors]
  };
}

const tests: UnitTest[] = [
  {
    name: 'publishes staged close state only after pg-like client commit succeeds',
    run: async () => {
      const { bridge, readCommittedSnapshot, readPoolState, readUnitOfWorkState } = createAtomicBridge();
      const result = await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest()
      });

      assertEqual(result.status, 'committed', 'atomic bridge should report committed when pg-like replay succeeds');
      assertEqual(result.traceErrors.length, 0, `atomic bridge trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(readUnitOfWorkState().commitCount, 1, 'atomic bridge should commit staged state once');
      assertEqual(readUnitOfWorkState().rollbackCount, 0, 'atomic bridge should not roll back successful staged state');
      assertEqual(readPoolState().releaseCount, 1, 'pg-like client should release the client');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'committed snapshot should publish closed accounting period'
      );
    }
  },
  {
    name: 'discards staged close state when repository plan rolls back',
    run: async () => {
      const { bridge, readCommittedSnapshot, readUnitOfWorkState } = createAtomicBridge();
      const result = await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-pg-atomic-stale', version: 99 })
      });

      assertEqual(result.status, 'rolled_back', 'stale version should stay a business rollback');
      assertEqual(result.traceErrors.length, 0, `stale rollback trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(readUnitOfWorkState().commitCount, 0, 'atomic bridge should not publish stale staged state');
      assertEqual(readUnitOfWorkState().rollbackCount, 1, 'atomic bridge should discard stale staged state');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'committed snapshot should remain unchanged after stale rollback'
      );
    }
  },
  {
    name: 'discards staged close state when pg-like client fails after staged commit plan',
    run: async () => {
      const { bridge, readCommittedSnapshot, readPoolState, readUnitOfWorkState } = createAtomicBridge({
        failWhenSqlIncludes: 'UPDATE "accounting_periods"'
      });
      const result = await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-pg-atomic-pg-failure' })
      });

      assertEqual(result.status, 'trace_invalid', 'pg-like failure after staged commit plan should invalidate the trace');
      assertEqual(result.postgresResult?.status, 'driver_failed', 'pg-like port should expose driver failure');
      assertEqual(readPoolState().releaseCount, 1, 'pg-like failure should still release client');
      assertEqual(readUnitOfWorkState().commitCount, 0, 'atomic bridge must not publish staged state after pg-like failure');
      assertEqual(readUnitOfWorkState().rollbackCount, 1, 'atomic bridge must discard staged state after pg-like failure');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'committed snapshot should remain unchanged after pg-like failure'
      );
      assert(
        result.traceErrors.some((error) => error.includes('cannot satisfy staged terminal commit')),
        'atomic trace should explain the staged commit and pg-like failure mismatch'
      );
    }
  },
  {
    name: 'publishes closed-period source guard audit only after pg-like replay succeeds',
    run: async () => {
      const { bridge, readCommittedSnapshot, readUnitOfWorkState } = createAtomicBridge();

      await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-pg-atomic-close-before-source' })
      });

      const result = await bridge.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:35:00+08:00',
          requestId: 'req-pg-atomic-source-guard'
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

      assertEqual(result.status, 'committed', 'closed-period source guard audit should commit after pg-like replay');
      assertEqual(result.traceErrors.length, 0, `source guard atomic trace should validate: ${result.traceErrors.join('; ')}`);
      assert(result.repositoryResult.driverOk, 'source guard should reach staged DB client repository');
      assert(result.repositoryResult.result.ok, 'source guard wrapper transaction should commit audit result');
      assertEqual(result.repositoryResult.result.value.ok, false, 'closed-period source mutation should be rejected');
      assertEqual(committedSnapshot.sourceRecords[0]?.amount, '1000.00', 'closed source amount should remain unchanged');
      assertEqual(
        committedSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period source guard audit event should be published after replay'
      );
      assertEqual(readUnitOfWorkState().commitCount, 2, 'close and guard audit should each publish one staged unit');
    }
  },
  {
    name: 'validator rejects committed trace without staged commit event',
    run: async () => {
      const { bridge } = createAtomicBridge();
      const result = cloneResult(
        (await bridge.closeAccountingPeriod({
          period: '2026-06',
          request: createCloseRequest({ requestId: 'req-pg-atomic-mutated-trace' })
        })) as PeriodClosePostgresAtomicCommitBridgeResult<never>
      );

      result.atomicEvents = result.atomicEvents.filter((event) => event.event !== 'commit_staged_unit_of_work');

      const errors = validatePeriodClosePostgresAtomicCommitBridgeTrace(result);

      assert(
        errors.some((error) => error.includes('must commit staged state')),
        'validator should reject committed traces that do not publish staged state'
      );
    }
  }
];

for (const test of tests) {
  await test.run();
}
