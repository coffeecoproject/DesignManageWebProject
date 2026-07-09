import {
  createPeriodClosePostgresDbClientRepositoryBridgeContract,
  validatePeriodClosePostgresDbClientRepositoryBridgeTrace,
  type PeriodClosePostgresDbClientRepositoryBridgeResult
} from './periodClosePostgresDbClientRepositoryBridgeContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import {
  createInMemoryPeriodCloseSqlDriverExecutor,
  type PeriodCloseSqlDriverExecution
} from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import type { PeriodClosePostgresClientPort } from './periodClosePostgresClientPortContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
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
        throw createPgError('simulated postgres bridge query failure', '55P03');
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
    idempotencyKey: `idem-pg-bridge-${overrides.requestId ?? 'default'}`,
    now: '2026-07-02T22:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-pg-bridge-close',
    version: 1,
    ...overrides
  };
}

function createBridge({ failWhenSqlIncludes }: { failWhenSqlIncludes?: string } = {}) {
  const driver = createInMemoryPeriodCloseSqlDriverExecutor();
  const repository = createPeriodCloseSqlRepositoryContract({
    fallbackNow: '2026-07-02T22:00:00+08:00',
    initialState: createState()
  });
  const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
  const { pool, readState } = createMockPool({ failWhenSqlIncludes });
  const bridge = createPeriodClosePostgresDbClientRepositoryBridgeContract({ clientRepository, pool });

  return { bridge, readPoolState: readState, repository };
}

function cloneResult<T extends PeriodClosePostgresDbClientRepositoryBridgeResult<never>>(
  result: T
): T {
  return {
    ...result,
    bridgeEvents: result.bridgeEvents.map((event) => ({ ...event })),
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
    name: 'commits close through DB client repository and pg-like client port bridge',
    run: async () => {
      const { bridge, readPoolState, repository } = createBridge();
      const result = await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest()
      });
      const poolState = readPoolState();

      assertEqual(result.status, 'committed', 'bridge should report committed close when both traces commit');
      assertEqual(result.traceErrors.length, 0, `bridge trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(result.postgresResult?.status, 'committed', 'postgres client port should commit');
      assertEqual(
        poolState.queries.length,
        result.driverExecutions.length,
        'postgres client port should execute every repository SQL driver statement'
      );
      assertEqual(poolState.releaseCount, 1, 'postgres client port should release the client once');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'bridge repository path should commit the close into local rows'
      );
    }
  },
  {
    name: 'rolls back stale close through both DB client and pg-like client traces',
    run: async () => {
      const { bridge, repository } = createBridge();
      const result = await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-pg-bridge-stale', version: 99 })
      });

      assertEqual(result.status, 'rolled_back', 'stale close should report rolled_back');
      assertEqual(result.traceErrors.length, 0, `stale close bridge trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(result.postgresResult?.status, 'rolled_back', 'postgres client port should execute rollback terminal');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'stale close should not mutate the accounting period'
      );
    }
  },
  {
    name: 'commits closed-period source guard audit without source mutation through pg-like bridge',
    run: async () => {
      const { bridge, repository } = createBridge();

      await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-pg-bridge-close-before-source' })
      });

      const result = await bridge.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:35:00+08:00',
          requestId: 'req-pg-bridge-source-guard'
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
      assertEqual(result.traceErrors.length, 0, `source guard bridge trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(result.postgresResult?.status, 'committed', 'postgres client port should commit the guard audit');

      assert(result.repositoryResult.driverOk, 'source guard should reach repository driver');
      assert(result.repositoryResult.result.ok, 'source guard wrapper transaction should commit audit result');
      assertEqual(result.repositoryResult.result.value.ok, false, 'closed-period source mutation should be rejected');
      assertEqual(repository.readDatabaseSnapshot().sourceRecords[0]?.amount, '1000.00', 'source amount should remain unchanged');
    }
  },
  {
    name: 'marks bridge trace invalid when pg-like client fails after a repository commit plan',
    run: async () => {
      const { bridge, readPoolState } = createBridge({ failWhenSqlIncludes: 'UPDATE "accounting_periods"' });
      const result = await bridge.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-pg-bridge-client-failure' })
      });

      assertEqual(result.status, 'trace_invalid', 'postgres runtime mismatch should not be reported as committed');
      assertEqual(result.postgresResult?.status, 'driver_failed', 'postgres client port should surface query failure');
      assertEqual(readPoolState().releaseCount, 1, 'postgres failure should still release the client');
      assert(
        result.traceErrors.some((error) => error.includes('cannot satisfy repository terminal commit')),
        'bridge should explain repository terminal and postgres terminal mismatch'
      );
    }
  },
  {
    name: 'validator rejects mismatched pg execution text',
    run: async () => {
      const { bridge } = createBridge();
      const result = cloneResult(
        (await bridge.closeAccountingPeriod({
          period: '2026-06',
          request: createCloseRequest({ requestId: 'req-pg-bridge-mutated-trace' })
        })) as PeriodClosePostgresDbClientRepositoryBridgeResult<never>
      );

      if (!result.postgresResult) {
        throw new Error('expected postgres result for mutated trace test');
      }

      result.postgresResult.executions = result.postgresResult.executions.map(
        (execution, index): PeriodCloseSqlDriverExecution =>
          index === 1
            ? {
                ...execution,
                sql: 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;'
              }
            : execution
      );

      const errors = validatePeriodClosePostgresDbClientRepositoryBridgeTrace(result);

      assert(
        errors.some((error) => error.includes('must match SQL driver execution')),
        'bridge validator should reject postgres execution drift from repository SQL plan'
      );
    }
  }
];

for (const test of tests) {
  await test.run();
}
