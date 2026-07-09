import {
  createPeriodClosePostgresClientPortContract,
  validatePeriodClosePostgresClientPortTrace,
  type PeriodClosePostgresClientPort,
  type PeriodClosePostgresClientPortResult
} from './periodClosePostgresClientPortContract.js';
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
        throw createPgError('canceling statement due to lock timeout', '55P03');
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

function createStatements({
  period = '2026-06',
  terminal = 'commit',
  transactionId = 'tx-pg-port-001'
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

function cloneResult(result: PeriodClosePostgresClientPortResult): PeriodClosePostgresClientPortResult {
  return {
    ...result,
    events: result.events.map((event) => ({ ...event })),
    executions: result.executions.map((execution) => ({
      ...execution,
      parameters: [...execution.parameters]
    })),
    traceErrors: [...result.traceErrors]
  };
}

const tests: UnitTest[] = [
  {
    name: 'executes committed transaction through pg-like client port',
    run: async () => {
      const { pool, readState } = createMockPool();
      const adapter = createPeriodClosePostgresClientPortContract({ pool });
      const result = await adapter.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-port-001',
        statements: createStatements(),
        transactionId: 'tx-pg-port-001'
      });
      const state = readState();

      assertEqual(result.status, 'committed', 'pg-like port should commit valid transaction statements');
      assertEqual(result.traceErrors.length, 0, `pg-like port trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(state.connectCount, 1, 'pg-like port should acquire exactly one client');
      assertEqual(state.releaseCount, 1, 'pg-like port should release exactly one client');
      assertEqual(state.queries.at(-1)?.sql, 'COMMIT;', 'pg-like port should execute COMMIT as terminal SQL');
      assert(
        state.queries.some(
          (query) =>
            query.sql.includes('FOR UPDATE') && query.parameters.length === 1 && query.parameters[0] === '2026-06'
        ),
        'pg-like port should lock accounting period with parameterized FOR UPDATE'
      );
    }
  },
  {
    name: 'rejects invalid transaction shape before acquiring pg client',
    run: async () => {
      const { pool, readState } = createMockPool();
      const adapter = createPeriodClosePostgresClientPortContract({ pool });
      const statements = createStatements();

      statements[2] = {
        ...statements[2],
        parameters: [],
        sql: 'SELECT "period" FROM "accounting_periods" WHERE "period" = \'2026-06\';'
      };

      const result = await adapter.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-port-invalid',
        statements,
        transactionId: 'tx-pg-port-001'
      });

      assertEqual(result.status, 'trace_invalid', 'invalid SQL shape should fail before DB client acquisition');
      assertEqual(readState().connectCount, 0, 'invalid SQL shape must not connect to the DB client');
      assert(
        result.traceErrors.some((error) => error.includes('must use parameterized SQL placeholders')),
        'invalid SQL shape should report parameterization error'
      );
    }
  },
  {
    name: 'rolls back, releases and classifies lock timeout after pg query failure',
    run: async () => {
      const { pool, readState } = createMockPool({ failWhenSqlIncludes: 'FOR UPDATE' });
      const adapter = createPeriodClosePostgresClientPortContract({ pool });
      const result = await adapter.run({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-port-lock-timeout',
        statements: createStatements({ transactionId: 'tx-pg-port-lock-timeout' }),
        transactionId: 'tx-pg-port-lock-timeout'
      });
      const eventNames = result.events.map((event) => event.event);
      const state = readState();

      assertEqual(result.status, 'driver_failed', 'lock timeout should surface as driver_failed');
      assertEqual(result.failureCode, 'lock_timeout', 'PostgreSQL 55P03 should map to lock_timeout');
      assertEqual(result.retryable, true, 'lock_timeout should be retryable outside the transaction');
      assertEqual(state.releaseCount, 1, 'driver failure should still release client');
      assertEqual(state.queries.at(-1)?.sql, 'ROLLBACK;', 'driver failure should execute ROLLBACK before release');
      assert(
        eventNames.indexOf('rollback_after_failure') < eventNames.indexOf('release_client'),
        'rollback should happen before release'
      );
      assert(
        eventNames.indexOf('classify_failure') > eventNames.indexOf('release_client'),
        'failure classification should happen after release'
      );
      assertEqual(result.traceErrors.length, 0, `driver-failure trace should validate: ${result.traceErrors.join('; ')}`);
    }
  },
  {
    name: 'validator rejects pg client traces that return before release',
    run: async () => {
      const { pool } = createMockPool();
      const adapter = createPeriodClosePostgresClientPortContract({ pool });
      const result = cloneResult(
        await adapter.run({
          operation: 'close_or_reopen_accounting_period',
          period: '2026-06',
          requestId: 'req-pg-port-mutated',
          statements: createStatements({ transactionId: 'tx-pg-port-mutated' }),
          transactionId: 'tx-pg-port-mutated'
        })
      );

      result.events = result.events.filter((event) => event.event !== 'release_client');

      const errors = validatePeriodClosePostgresClientPortTrace(result);

      assert(
        errors.some((error) => error.includes('must release the client before returning')),
        'validator should reject missing client release'
      );
    }
  }
];

for (const test of tests) {
  await test.run();
}
