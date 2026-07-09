import {
  createPeriodClosePostgresRuntimeBindingContract,
  validatePeriodClosePostgresRuntimeBindingTrace,
  type PeriodClosePostgresRuntimeBindingResult
} from './periodClosePostgresRuntimeBindingContract.js';
import type {
  PeriodCloseNativePostgresClientLike,
  PeriodCloseNativePostgresPoolLike,
  PeriodCloseNativePostgresQueryResult
} from './periodCloseNativePostgresPoolAdapterContract.js';
import type { PeriodCloseSqlDriverStatement } from './periodCloseSqlDriverRepositoryContract.js';

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

function createNativePool({
  failWhenSqlIncludes,
  invalidClient
}: {
  failWhenSqlIncludes?: string;
  invalidClient?: PeriodCloseNativePostgresClientLike;
} = {}) {
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  const releases: string[] = [];
  let connectCount = 0;

  const client: PeriodCloseNativePostgresClientLike = {
    query: async (sql, parameters = []): Promise<PeriodCloseNativePostgresQueryResult> => {
      queries.push({ parameters: [...parameters], sql });

      if (failWhenSqlIncludes && sql.includes(failWhenSqlIncludes)) {
        throw createPgError('canceling statement due to lock timeout', '55P03');
      }

      return {
        rowCount: 1,
        rows: [{ period: parameters[0] ?? null }]
      };
    },
    release: () => {
      releases.push('release');
    }
  };

  const pool: PeriodCloseNativePostgresPoolLike = {
    connect: async () => {
      connectCount += 1;

      return invalidClient ?? client;
    }
  };

  return {
    pool,
    readState: () => ({
      connectCount,
      queries: queries.map((query) => ({ ...query, parameters: [...query.parameters] })),
      releaseCount: releases.length
    })
  };
}

function createStatements({
  period = '2026-06',
  terminal = 'commit',
  transactionId = 'tx-pg-runtime-binding-001'
}: {
  period?: string;
  terminal?: 'commit' | 'rollback';
  transactionId?: string;
} = {}): PeriodCloseSqlDriverStatement[] {
  return [
    {
      name: 'begin',
      parameters: [],
      period,
      sql: 'BEGIN;',
      transactionId
    },
    {
      name: 'set_transaction_isolation',
      parameters: [],
      period,
      sql: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
      transactionId
    },
    {
      name: 'lock_accounting_period_for_update',
      parameters: [period],
      period,
      sql: 'SELECT "period", "status", "version" FROM "accounting_periods" WHERE "period" = $1 FOR UPDATE;',
      transactionId
    },
    {
      name: terminal,
      parameters: [],
      period,
      sql: terminal === 'commit' ? 'COMMIT;' : 'ROLLBACK;',
      transactionId
    }
  ];
}

function cloneResult(
  result: PeriodClosePostgresRuntimeBindingResult
): PeriodClosePostgresRuntimeBindingResult {
  return {
    ...result,
    adapterEvents: result.adapterEvents.map((event) => ({ ...event })),
    bindingEvents: result.bindingEvents.map((event) => ({ ...event })),
    postgresResult: {
      ...result.postgresResult,
      events: result.postgresResult.events.map((event) => ({ ...event })),
      executions: result.postgresResult.executions.map((execution) => ({
        ...execution,
        parameters: [...execution.parameters]
      })),
      traceErrors: [...result.postgresResult.traceErrors]
    },
    traceErrors: [...result.traceErrors]
  };
}

const tests: UnitTest[] = [
  {
    name: 'runs valid statements through native adapter and postgres client port',
    run: async () => {
      const { pool, readState } = createNativePool();
      const binding = createPeriodClosePostgresRuntimeBindingContract({ nativePool: pool });
      const result = await binding.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-runtime-binding-001',
        statements: createStatements(),
        transactionId: 'tx-pg-runtime-binding-001'
      });
      const state = readState();

      assertEqual(result.status, 'committed', 'runtime binding should commit valid native postgres flow');
      assertEqual(result.traceErrors.length, 0, `runtime binding trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(state.connectCount, 1, 'runtime binding should connect native pool once');
      assertEqual(state.releaseCount, 1, 'runtime binding should release native client once');
      assertEqual(state.queries.at(-1)?.sql, 'COMMIT;', 'runtime binding should forward terminal COMMIT');
      assert(
        result.adapterEvents.some((event) => event.event === 'wrap_native_client'),
        'runtime binding should wrap native client before postgres port query execution'
      );
      assert(
        result.postgresResult.events.some((event) => event.event === 'execute_sql_statement'),
        'runtime binding should still execute through postgres client port'
      );
    }
  },
  {
    name: 'keeps invalid SQL shape before native pool acquisition',
    run: async () => {
      const { pool, readState } = createNativePool();
      const binding = createPeriodClosePostgresRuntimeBindingContract({ nativePool: pool });
      const statements = createStatements();

      statements[2] = {
        ...statements[2],
        parameters: [],
        sql: 'SELECT "period" FROM "accounting_periods" WHERE "period" = \'2026-06\';'
      };

      const result = await binding.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-runtime-binding-invalid-sql',
        statements,
        transactionId: 'tx-pg-runtime-binding-001'
      });

      assertEqual(result.status, 'trace_invalid', 'runtime binding should preserve invalid SQL shape status');
      assertEqual(readState().connectCount, 0, 'invalid SQL shape must not acquire native postgres pool');
      assertEqual(result.adapterEvents.length, 0, 'invalid SQL shape must not reach native adapter connection');
      assert(
        result.traceErrors.some((error) => error.includes('must use parameterized SQL placeholders')),
        'runtime binding should report postgres client port SQL-shape error'
      );
    }
  },
  {
    name: 'surfaces invalid native pool shape as trace invalid',
    run: async () => {
      const binding = createPeriodClosePostgresRuntimeBindingContract({ nativePool: {} });
      const result = await binding.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-runtime-binding-invalid-pool',
        statements: createStatements({ transactionId: 'tx-pg-runtime-binding-invalid-pool' }),
        transactionId: 'tx-pg-runtime-binding-invalid-pool'
      });

      assertEqual(result.status, 'trace_invalid', 'invalid native pool shape should be runtime binding trace invalid');
      assert(
        result.adapterEvents.some((event) => event.event === 'reject_invalid_native_pool'),
        'invalid native pool should be visible in adapter events'
      );
      assert(
        result.traceErrors.some((error) => error.includes('native postgres pool/client shape was rejected')),
        'runtime binding should explain native shape rejection'
      );
    }
  },
  {
    name: 'surfaces invalid native client shape as trace invalid and releases it',
    run: async () => {
      const releases: string[] = [];
      const { pool } = createNativePool({
        invalidClient: {
          release: () => {
            releases.push('release-invalid-native-client');
          }
        }
      });
      const binding = createPeriodClosePostgresRuntimeBindingContract({ nativePool: pool });
      const result = await binding.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-runtime-binding-invalid-client',
        statements: createStatements({ transactionId: 'tx-pg-runtime-binding-invalid-client' }),
        transactionId: 'tx-pg-runtime-binding-invalid-client'
      });

      assertEqual(result.status, 'trace_invalid', 'invalid native client shape should be trace invalid');
      assertEqual(releases.length, 1, 'invalid native client should be released when release is available');
      assert(
        result.adapterEvents.some((event) => event.event === 'reject_invalid_native_client'),
        'invalid native client should be visible in adapter events'
      );
    }
  },
  {
    name: 'keeps native query failures in rollback release classification path',
    run: async () => {
      const { pool, readState } = createNativePool({ failWhenSqlIncludes: 'FOR UPDATE' });
      const binding = createPeriodClosePostgresRuntimeBindingContract({ nativePool: pool });
      const result = await binding.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-runtime-binding-lock-timeout',
        statements: createStatements({ transactionId: 'tx-pg-runtime-binding-lock-timeout' }),
        transactionId: 'tx-pg-runtime-binding-lock-timeout'
      });
      const state = readState();

      assertEqual(result.status, 'driver_failed', 'native query failure should remain driver_failed');
      assertEqual(result.postgresResult.failureCode, 'lock_timeout', 'native PostgreSQL 55P03 should map to lock_timeout');
      assertEqual(result.postgresResult.retryable, true, 'native PostgreSQL lock timeout should remain retryable');
      assertEqual(state.queries.at(-1)?.sql, 'ROLLBACK;', 'native query failure should roll back');
      assertEqual(state.releaseCount, 1, 'native query failure should release native client');
      assertEqual(result.traceErrors.length, 0, `failure trace should validate: ${result.traceErrors.join('; ')}`);
    }
  },
  {
    name: 'validator rejects binding traces that skip client port execution',
    run: async () => {
      const { pool } = createNativePool();
      const binding = createPeriodClosePostgresRuntimeBindingContract({ nativePool: pool });
      const result = cloneResult(
        await binding.run({
          operation: 'close_or_reopen_accounting_period',
          period: '2026-06',
          requestId: 'req-pg-runtime-binding-mutated',
          statements: createStatements({ transactionId: 'tx-pg-runtime-binding-mutated' }),
          transactionId: 'tx-pg-runtime-binding-mutated'
        })
      );

      result.bindingEvents = result.bindingEvents.filter((event) => event.event !== 'run_postgres_client_port');

      const errors = validatePeriodClosePostgresRuntimeBindingTrace(result);

      assert(
        errors.some((error) => error.includes('must run client port after adapter creation')),
        'runtime binding validator should reject skipped postgres client port execution'
      );
    }
  }
];

for (const test of tests) {
  await test.run();
}
