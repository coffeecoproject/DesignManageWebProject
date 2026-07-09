import {
  createPeriodClosePostgresPoolFactoryContract,
  validatePeriodClosePostgresPoolFactoryTrace,
  validatePeriodClosePostgresPoolRuntimeConfig,
  type PeriodClosePostgresPoolConstructorOptions,
  type PeriodClosePostgresPoolFactoryResult,
  type PeriodClosePostgresPoolRuntimeConfig
} from './periodClosePostgresPoolFactoryContract.js';
import {
  createPeriodClosePostgresSecretResolverContract,
  type PeriodClosePostgresSecretRecord
} from './periodClosePostgresSecretResolverContract.js';
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

function createLocalConfig(
  overrides: Partial<PeriodClosePostgresPoolRuntimeConfig> = {}
): PeriodClosePostgresPoolRuntimeConfig {
  return {
    applicationName: 'startupmanage-period-close-local',
    connectionTimeoutMs: 1_000,
    databaseUrl: 'postgres://localhost:5432/startupmanage_local',
    environment: 'local',
    idleTimeoutMs: 10_000,
    maxConnections: 4,
    sslMode: 'disable',
    statementTimeoutMs: 5_000,
    ...overrides
  };
}

function createStatements({
  period = '2026-06',
  terminal = 'commit',
  transactionId = 'tx-pg-pool-factory-001'
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

function createFakePoolConstructor({
  invalidPool,
  throwInConstructor
}: {
  invalidPool?: boolean;
  throwInConstructor?: boolean;
} = {}) {
  const constructedOptions: PeriodClosePostgresPoolConstructorOptions[] = [];
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  let releaseCount = 0;

  class FakePool implements PeriodCloseNativePostgresPoolLike {
    constructor(options: PeriodClosePostgresPoolConstructorOptions) {
      constructedOptions.push(options);

      if (throwInConstructor) {
        throw new Error('fake pg pool constructor failed');
      }
    }

    connect = invalidPool
      ? undefined
      : async (): Promise<PeriodCloseNativePostgresClientLike> => ({
          query: async (sql, parameters = []): Promise<PeriodCloseNativePostgresQueryResult> => {
            queries.push({ parameters: [...parameters], sql });

            return {
              rowCount: 1,
              rows: [{ period: parameters[0] ?? null }]
            };
          },
          release: () => {
            releaseCount += 1;
          }
        });
  }

  return {
    PoolConstructor: FakePool,
    readState: () => ({
      constructedOptions: constructedOptions.map((options) => ({ ...options })),
      queries: queries.map((query) => ({ ...query, parameters: [...query.parameters] })),
      releaseCount
    })
  };
}

function createSecretResolver(overrides: Partial<PeriodClosePostgresSecretRecord> = {}) {
  return createPeriodClosePostgresSecretResolverContract({
    now: '2026-07-05T00:00:00.000Z',
    secretStore: [
      {
        enabled: true,
        environment: 'local',
        expiresAt: '2026-12-31T00:00:00.000Z',
        purpose: 'postgres_password',
        reference: 'secret://local/postgres/period-close/password',
        source: 'local_dev_secret_store',
        value: 'local-secret-value',
        version: 'local-v1',
        ...overrides
      }
    ]
  });
}

function cloneResult(result: PeriodClosePostgresPoolFactoryResult): PeriodClosePostgresPoolFactoryResult {
  return {
    ...result,
    configErrors: [...result.configErrors],
    factoryEvents: result.factoryEvents.map((event) => ({ ...event })),
    poolOptions: result.poolOptions ? { ...result.poolOptions } : undefined,
    requiresPasswordSecret: result.requiresPasswordSecret,
    resolvedSecretEvidence: result.resolvedSecretEvidence ? { ...result.resolvedSecretEvidence } : undefined,
    runtimeResult: result.runtimeResult
      ? {
          ...result.runtimeResult,
          adapterEvents: result.runtimeResult.adapterEvents.map((event) => ({ ...event })),
          bindingEvents: result.runtimeResult.bindingEvents.map((event) => ({ ...event })),
          postgresResult: {
            ...result.runtimeResult.postgresResult,
            events: result.runtimeResult.postgresResult.events.map((event) => ({ ...event })),
            executions: result.runtimeResult.postgresResult.executions.map((execution) => ({
              ...execution,
              parameters: [...execution.parameters]
            })),
            traceErrors: [...result.runtimeResult.postgresResult.traceErrors]
          },
          traceErrors: [...result.runtimeResult.traceErrors]
        }
      : undefined,
    secretErrors: [...result.secretErrors],
    traceErrors: [...result.traceErrors]
  };
}

const tests: UnitTest[] = [
  {
    name: 'constructs local pool options and delegates through postgres runtime binding',
    run: async () => {
      const { PoolConstructor, readState } = createFakePoolConstructor();
      const factory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor });
      const result = await factory.run({
        config: createLocalConfig(),
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-pool-factory-001',
        statements: createStatements(),
        transactionId: 'tx-pg-pool-factory-001'
      });
      const state = readState();

      assertEqual(result.status, 'committed', 'pool factory should run valid local config through runtime binding');
      assertEqual(result.configErrors.length, 0, 'valid local config should not have config errors');
      assertEqual(result.secretErrors.length, 0, 'valid local config without secret should not have secret errors');
      assertEqual(result.requiresPasswordSecret, false, 'local config without secret should not require secret resolver');
      assertEqual(result.traceErrors.length, 0, `pool factory trace should validate: ${result.traceErrors.join('; ')}`);
      assertEqual(state.constructedOptions.length, 1, 'pool factory should construct one pg-like pool');
      assertEqual(
        state.constructedOptions[0]?.application_name,
        'startupmanage-period-close-local',
        'pool factory should pass period-close application name'
      );
      assertEqual(state.constructedOptions[0]?.max, 4, 'pool factory should pass max connection limit');
      assertEqual(state.constructedOptions[0]?.ssl, false, 'local pool config should not require ssl');
      assert(
        !Object.hasOwn(state.constructedOptions[0] ?? {}, 'password'),
        'pool factory options must not include raw password'
      );
      assertEqual(state.queries.at(-1)?.sql, 'COMMIT;', 'runtime binding should execute terminal COMMIT');
      assertEqual(state.releaseCount, 1, 'runtime binding should release fake native client');
      assert(
        result.factoryEvents.some((event) => event.event === 'delegate_runtime_binding'),
        'factory should record runtime binding delegation'
      );
    }
  },
  {
    name: 'resolves password secret before constructing postgres pool',
    run: async () => {
      const { PoolConstructor, readState } = createFakePoolConstructor();
      const secretResolver = createSecretResolver();
      const factory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor, secretResolver });
      const result = await factory.run({
        config: createLocalConfig({
          passwordSecretRef: 'secret://local/postgres/period-close/password'
        }),
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-pool-factory-secret',
        statements: createStatements({ transactionId: 'tx-pg-pool-factory-secret' }),
        transactionId: 'tx-pg-pool-factory-secret'
      });
      const state = readState();

      assertEqual(result.status, 'committed', 'pool factory should run after resolving password secret');
      assertEqual(result.secretErrors.length, 0, 'resolved secret should not create secret errors');
      assertEqual(result.requiresPasswordSecret, true, 'passwordSecretRef should require secret resolver');
      assertEqual(
        result.resolvedSecretEvidence?.reference,
        'secret://local/postgres/period-close/password',
        'pool factory should keep redacted secret evidence'
      );
      assertEqual(
        state.constructedOptions[0]?.password,
        'local-secret-value',
        'pool constructor should receive resolved password internally'
      );
      assert(
        !Object.hasOwn(result.poolOptions ?? {}, 'password'),
        'public pool options must not expose resolved password'
      );
      assert(
        result.factoryEvents.some((event) => event.event === 'resolve_password_secret'),
        'pool factory should record password secret resolution before construction'
      );
      assert(
        result.factoryEvents.findIndex((event) => event.event === 'resolve_password_secret') <
          result.factoryEvents.findIndex((event) => event.event === 'construct_pool'),
        'pool factory should resolve password before constructing pool'
      );
    }
  },
  {
    name: 'rejects passwordSecretRef when no secret resolver is wired',
    run: async () => {
      const { PoolConstructor, readState } = createFakePoolConstructor();
      const factory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor });
      const result = await factory.run({
        config: createLocalConfig({
          passwordSecretRef: 'secret://local/postgres/period-close/password'
        }),
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-pool-factory-missing-resolver',
        statements: createStatements({ transactionId: 'tx-pg-pool-factory-missing-resolver' }),
        transactionId: 'tx-pg-pool-factory-missing-resolver'
      });

      assertEqual(result.status, 'secret_invalid', 'missing resolver should reject password secret configs');
      assertEqual(readState().constructedOptions.length, 0, 'missing resolver must stop before pool construction');
      assert(
        result.secretErrors.some((error) => error.includes('requires a secret resolver')),
        'secret error should explain missing resolver'
      );
    }
  },
  {
    name: 'rejects local config that targets a non-local host before pool construction',
    run: async () => {
      const { PoolConstructor, readState } = createFakePoolConstructor();
      const factory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor });
      const result = await factory.run({
        config: createLocalConfig({ databaseUrl: 'postgres://db.example.com:5432/startupmanage' }),
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-pool-factory-non-local',
        statements: createStatements({ transactionId: 'tx-pg-pool-factory-non-local' }),
        transactionId: 'tx-pg-pool-factory-non-local'
      });

      assertEqual(result.status, 'config_invalid', 'non-local target should be rejected in local config');
      assertEqual(readState().constructedOptions.length, 0, 'invalid local target must not construct pool');
      assert(
        result.configErrors.some((error) => error.includes('localhost only')),
        'config error should explain local target restriction'
      );
      assert(
        !result.factoryEvents.some((event) => event.event === 'construct_pool'),
        'invalid config must not record pool construction'
      );
    }
  },
  {
    name: 'rejects raw passwords in pool config',
    run: () => {
      const errors = validatePeriodClosePostgresPoolRuntimeConfig({
        ...createLocalConfig(),
        password: 'unsafe-raw-password'
      } as PeriodClosePostgresPoolRuntimeConfig & { password: string });

      assert(
        errors.some((error) => error.includes('raw passwords')),
        'pool config validator should reject raw password fields'
      );
    }
  },
  {
    name: 'rejects raw credentials embedded in databaseUrl',
    run: () => {
      const errors = validatePeriodClosePostgresPoolRuntimeConfig(
        createLocalConfig({ databaseUrl: 'postgres://user:password@localhost:5432/startupmanage_local' })
      );

      assert(
        errors.some((error) => error.includes('databaseUrl must not include raw credentials')),
        'pool config validator should reject raw credentials in databaseUrl'
      );
    }
  },
  {
    name: 'requires production database evidence and approval before production config is valid',
    run: () => {
      const errors = validatePeriodClosePostgresPoolRuntimeConfig({
        applicationName: 'startupmanage-period-close-prod',
        connectionTimeoutMs: 1_000,
        databaseUrl: 'postgres://prod-db.internal:5432/startupmanage',
        environment: 'production',
        idleTimeoutMs: 10_000,
        maxConnections: 8,
        passwordSecretRef: 'secret://prod/postgres/password',
        sslMode: 'require',
        statementTimeoutMs: 5_000
      });

      assert(errors.some((error) => error.includes('target database evidence')), 'production target DB evidence is required');
      assert(errors.some((error) => error.includes('backup/restore evidence')), 'production backup evidence is required');
      assert(errors.some((error) => error.includes('release and rollback owners')), 'release owners are required');
      assert(errors.some((error) => error.includes('production apply approval')), 'production approval is required');
    }
  },
  {
    name: 'surfaces invalid constructed pool shape through runtime binding',
    run: async () => {
      const { PoolConstructor } = createFakePoolConstructor({ invalidPool: true });
      const factory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor });
      const result = await factory.run({
        config: createLocalConfig(),
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-pool-factory-invalid-pool',
        statements: createStatements({ transactionId: 'tx-pg-pool-factory-invalid-pool' }),
        transactionId: 'tx-pg-pool-factory-invalid-pool'
      });

      assertEqual(result.status, 'trace_invalid', 'invalid constructed pool shape should become trace invalid');
      assert(
        result.runtimeResult?.adapterEvents.some((event) => event.event === 'reject_invalid_native_pool') ?? false,
        'invalid constructed pool shape should be visible in runtime adapter events'
      );
    }
  },
  {
    name: 'reports constructor failures without runtime delegation',
    run: async () => {
      const { PoolConstructor } = createFakePoolConstructor({ throwInConstructor: true });
      const factory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor });
      const result = await factory.run({
        config: createLocalConfig(),
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pg-pool-factory-constructor-fail',
        statements: createStatements({ transactionId: 'tx-pg-pool-factory-constructor-fail' }),
        transactionId: 'tx-pg-pool-factory-constructor-fail'
      });

      assertEqual(result.status, 'constructor_failed', 'constructor failure should stay separate from driver failure');
      assert(
        !result.factoryEvents.some((event) => event.event === 'delegate_runtime_binding'),
        'constructor failure must not delegate to runtime binding'
      );
      assert(result.traceErrors.some((error) => error.includes('constructor failed')), 'constructor error should be reported');
    }
  },
  {
    name: 'validator rejects factory traces that skip pool construction',
    run: async () => {
      const { PoolConstructor } = createFakePoolConstructor();
      const factory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor });
      const result = cloneResult(
        await factory.run({
          config: createLocalConfig(),
          operation: 'close_or_reopen_accounting_period',
          period: '2026-06',
          requestId: 'req-pg-pool-factory-mutated',
          statements: createStatements({ transactionId: 'tx-pg-pool-factory-mutated' }),
          transactionId: 'tx-pg-pool-factory-mutated'
        })
      );

      result.factoryEvents = result.factoryEvents.filter((event) => event.event !== 'construct_pool');

      const errors = validatePeriodClosePostgresPoolFactoryTrace(result);

      assert(
        errors.some((error) => error.includes('must construct pool after config validation')),
        'pool factory validator should reject missing construction event'
      );
    }
  }
];

for (const test of tests) {
  await test.run();
}
