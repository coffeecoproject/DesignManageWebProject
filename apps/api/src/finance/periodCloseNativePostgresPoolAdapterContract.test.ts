import {
  createPeriodCloseNativePostgresPoolAdapterContract,
  PeriodCloseNativePostgresPoolAdapterError,
  validatePeriodCloseNativePostgresPoolAdapterEvents,
  type PeriodCloseNativePostgresClientLike,
  type PeriodCloseNativePostgresPoolLike
} from './periodCloseNativePostgresPoolAdapterContract.js';
import { createPeriodClosePostgresClientPortContract } from './periodClosePostgresClientPortContract.js';
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

function createStatements({
  period = '2026-06',
  terminal = 'commit',
  transactionId = 'tx-native-pg-adapter-001'
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

  const validClient: PeriodCloseNativePostgresClientLike = {
    query: async (sql, parameters = []) => {
      queries.push({ parameters: [...parameters], sql });

      if (failWhenSqlIncludes && sql.includes(failWhenSqlIncludes)) {
        throw createPgError('native postgres lock timeout', '55P03');
      }

      return {
        rowCount: 1,
        rows: [
          {
            period: parameters[0] ?? null,
            status: '开放'
          }
        ]
      };
    },
    release: () => {
      releases.push('release');
    }
  };
  const pool: PeriodCloseNativePostgresPoolLike = {
    connect: async () => {
      connectCount += 1;

      return invalidClient ?? validClient;
    }
  };

  return {
    pool,
    readState: () => ({
      connectCount,
      queries: queries.map((query) => ({
        parameters: [...query.parameters],
        sql: query.sql
      })),
      releaseCount: releases.length
    })
  };
}

async function expectRejectsWithCode(
  run: () => Promise<unknown>,
  code: PeriodCloseNativePostgresPoolAdapterError['code']
) {
  try {
    await run();
  } catch (error) {
    assert(error instanceof PeriodCloseNativePostgresPoolAdapterError, 'expected native postgres adapter error');
    assertEqual(error.code, code, 'native postgres adapter error code should match');

    return;
  }

  throw new Error(`Expected native postgres adapter to reject with ${code}`);
}

const tests: UnitTest[] = [
  {
    name: 'adapts native pg-like pool into postgres client port',
    run: async () => {
      const { pool, readState } = createNativePool();
      const nativeAdapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool: pool });
      const postgresPort = createPeriodClosePostgresClientPortContract({ pool: nativeAdapter });
      const result = await postgresPort.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-native-pg-adapter-001',
        statements: createStatements(),
        transactionId: 'tx-native-pg-adapter-001'
      });
      const adapterEvents = nativeAdapter.readAdapterEvents();
      const state = readState();

      assertEqual(result.status, 'committed', 'native pg adapter should support committed client-port flow');
      assertEqual(result.traceErrors.length, 0, `native pg adapter trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(state.connectCount, 1, 'native pg adapter should connect once');
      assertEqual(state.releaseCount, 1, 'native pg adapter should release once');
      assertEqual(state.queries.at(-1)?.sql, 'COMMIT;', 'native pg adapter should forward terminal COMMIT');
      assert(
        state.queries.some(
          (query) =>
            query.sql.includes('FOR UPDATE') && query.parameters.length === 1 && query.parameters[0] === '2026-06'
        ),
        'native pg adapter should forward parameterized period-lock query'
      );
      assertEqual(
        validatePeriodCloseNativePostgresPoolAdapterEvents(adapterEvents).length,
        0,
        'native pg adapter event trace should validate'
      );
    }
  },
  {
    name: 'clones native query rows and parameters at the adapter boundary',
    run: async () => {
      const { pool, readState } = createNativePool();
      const nativeAdapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool: pool });
      const client = await nativeAdapter.connect();
      const parameters = ['2026-06'];
      const result = await client.query(
        'SELECT "period", "status" FROM "accounting_periods" WHERE "period" = $1;',
        parameters
      );

      parameters[0] = 'mutated-after-query';

      await client.release();

      const firstRow = result.rows?.[0];
      const state = readState();

      assertEqual(firstRow?.period, '2026-06', 'native pg adapter should clone query rows');
      assertEqual(state.queries[0]?.parameters[0], '2026-06', 'native pg adapter should clone query parameters');
      assertEqual(state.releaseCount, 1, 'manual adapter client should release native client');
    }
  },
  {
    name: 'rejects invalid native pool before DB connection',
    run: async () => {
      const nativeAdapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool: {} });

      await expectRejectsWithCode(
        () => nativeAdapter.connect(),
        'NATIVE_POSTGRES_POOL_SHAPE_INVALID'
      );

      const events = nativeAdapter.readAdapterEvents();

      assertEqual(events.at(-1)?.event, 'reject_invalid_native_pool', 'invalid pool should be rejected before connect');
      assertEqual(
        validatePeriodCloseNativePostgresPoolAdapterEvents(events).length,
        0,
        'invalid pool trace should still validate'
      );
    }
  },
  {
    name: 'rejects invalid native client and releases when release is available',
    run: async () => {
      const releases: string[] = [];
      const { pool, readState } = createNativePool({
        invalidClient: {
          release: () => {
            releases.push('release-invalid-client');
          }
        }
      });
      const nativeAdapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool: pool });

      await expectRejectsWithCode(
        () => nativeAdapter.connect(),
        'NATIVE_POSTGRES_CLIENT_SHAPE_INVALID'
      );

      const events = nativeAdapter.readAdapterEvents();

      assertEqual(readState().connectCount, 1, 'invalid native client should still come from one pool connection');
      assertEqual(releases.length, 1, 'invalid native client with release() should be released');
      assertEqual(events.at(-1)?.event, 'release_native_client', 'invalid client release should be recorded');
      assertEqual(
        validatePeriodCloseNativePostgresPoolAdapterEvents(events).length,
        0,
        'invalid client trace should validate'
      );
    }
  },
  {
    name: 'preserves rollback and release when native pg query fails',
    run: async () => {
      const { pool, readState } = createNativePool({ failWhenSqlIncludes: 'FOR UPDATE' });
      const nativeAdapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool: pool });
      const postgresPort = createPeriodClosePostgresClientPortContract({ pool: nativeAdapter });
      const result = await postgresPort.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-native-pg-lock-timeout',
        statements: createStatements({ transactionId: 'tx-native-pg-lock-timeout' }),
        transactionId: 'tx-native-pg-lock-timeout'
      });
      const state = readState();

      assertEqual(result.status, 'driver_failed', 'native pg failure should surface as driver_failed');
      assertEqual(result.failureCode, 'lock_timeout', 'native pg 55P03 should map to lock_timeout');
      assertEqual(result.retryable, true, 'native pg lock_timeout should remain retryable');
      assertEqual(state.queries.at(-1)?.sql, 'ROLLBACK;', 'native pg failure should forward rollback SQL');
      assertEqual(state.releaseCount, 1, 'native pg failure should release client after rollback');
      assertEqual(
        validatePeriodCloseNativePostgresPoolAdapterEvents(nativeAdapter.readAdapterEvents()).length,
        0,
        'native pg failure adapter trace should validate'
      );
    }
  }
];

for (const test of tests) {
  await test.run();
}
