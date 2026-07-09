import {
  evaluatePeriodClosePostgresDependencyAdmission,
  type PeriodClosePostgresRuntimeAdmissionEvidence
} from './periodClosePostgresDependencyAdmissionContract.js';
import {
  createPeriodClosePostgresRuntimeImportContract,
  validatePeriodClosePostgresRuntimeImportTrace,
  type PeriodClosePostgresRuntimeImportResult
} from './periodClosePostgresRuntimeImportContract.js';
import type {
  PeriodCloseNativePostgresClientLike,
  PeriodCloseNativePostgresPoolLike,
  PeriodCloseNativePostgresQueryResult
} from './periodCloseNativePostgresPoolAdapterContract.js';
import type { PeriodClosePostgresPoolConstructorOptions } from './periodClosePostgresPoolFactoryContract.js';
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

function assertValid(result: PeriodClosePostgresRuntimeImportResult) {
  const errors = validatePeriodClosePostgresRuntimeImportTrace(result);

  assertEqual(errors.length, 0, `runtime import trace should validate: ${errors.join('; ')}`);
}

const readyRuntimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence = {
  backupRestoreEvidenceReady: true,
  formalMigrationApplyReady: true,
  productionApplyApproved: true,
  releaseRollbackOwnerReady: true,
  secretManagerRuntimeReady: true,
  targetDatabaseSelected: true
};
const blockedRuntimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence = {
  backupRestoreEvidenceReady: false,
  formalMigrationApplyReady: false,
  productionApplyApproved: false,
  releaseRollbackOwnerReady: false,
  secretManagerRuntimeReady: false,
  targetDatabaseSelected: false
};
const pgLockfile = `
lockfileVersion: '11.0'
importers:
  apps/api:
    dependencies:
      pg:
        specifier: ^8.22.0
        version: 8.22.0
packages:
  pg@8.22.0:
    resolution:
      integrity: sha512-local-fixture
`;

function createAdmission(runtimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence = readyRuntimeEvidence) {
  return evaluatePeriodClosePostgresDependencyAdmission({
    apiPackageManifest: {
      dependencies: {
        pg: '^8.22.0'
      },
      name: '@startupmanage/api'
    },
    apiPackageManifestPath: 'apps/api/package.json',
    lockfilePath: 'pnpm-lock.yaml',
    lockfileText: pgLockfile,
    runtimeEvidence
  });
}

function createLocalConfig({
  databaseUrl = 'postgres://localhost:5432/startupmanage_local'
}: {
  databaseUrl?: string;
} = {}) {
  return {
    applicationName: 'startupmanage-period-close-runtime-import-local',
    connectionTimeoutMs: 1_000,
    databaseUrl,
    environment: 'local' as const,
    idleTimeoutMs: 10_000,
    maxConnections: 4,
    sslMode: 'disable' as const,
    statementTimeoutMs: 5_000
  };
}

function createStatements({
  period = '2026-06',
  transactionId = 'tx-pg-runtime-import-001'
}: {
  period?: string;
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
      name: 'commit',
      parameters: [],
      period,
      sql: 'COMMIT;',
      transactionId
    }
  ];
}

function createRunInput({
  admission = createAdmission(),
  config = createLocalConfig(),
  period = '2026-06',
  requestId = 'req-pg-runtime-import-001',
  transactionId = 'tx-pg-runtime-import-001'
}: {
  admission?: ReturnType<typeof createAdmission>;
  config?: ReturnType<typeof createLocalConfig>;
  period?: string;
  requestId?: string;
  transactionId?: string;
} = {}) {
  return {
    config,
    dependencyAdmission: admission,
    operation: 'close_or_reopen_accounting_period' as const,
    period,
    requestId,
    statements: createStatements({ period, transactionId }),
    transactionId
  };
}

function createFakePgModule() {
  const constructedOptions: PeriodClosePostgresPoolConstructorOptions[] = [];
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  let releaseCount = 0;

  class Pool implements PeriodCloseNativePostgresPoolLike {
    constructor(options: PeriodClosePostgresPoolConstructorOptions) {
      constructedOptions.push(options);
    }

    connect = async (): Promise<PeriodCloseNativePostgresClientLike> => ({
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
    module: { Pool },
    readState: () => ({
      constructedOptions: constructedOptions.map((options) => ({ ...options })),
      queries: queries.map((query) => ({ ...query, parameters: [...query.parameters] })),
      releaseCount
    })
  };
}

const tests: UnitTest[] = [
  {
    name: 'blocks pg module import when dependency admission is still blocked',
    run: async () => {
      let loadCount = 0;
      const contract = createPeriodClosePostgresRuntimeImportContract({
        loadPgModule: async () => {
          loadCount += 1;

          return createFakePgModule().module;
        }
      });
      const result = await contract.run(createRunInput({ admission: createAdmission(blockedRuntimeEvidence) }));

      assertEqual(result.status, 'admission_blocked', 'blocked admission must stop before runtime import');
      assertEqual(result.runtimeImportAllowed, false, 'runtime import should not be allowed');
      assertEqual(loadCount, 0, 'blocked admission must not load pg module');
      assert(
        !result.runtimeEvents.some((event) => event.event === 'import_pg_module'),
        'blocked admission must not record pg import'
      );
      assertValid(result);
    }
  },
  {
    name: 'validates config before loading pg module',
    run: async () => {
      let loadCount = 0;
      const contract = createPeriodClosePostgresRuntimeImportContract({
        loadPgModule: async () => {
          loadCount += 1;

          return createFakePgModule().module;
        }
      });
      const result = await contract.run(
        createRunInput({
          config: createLocalConfig({ databaseUrl: 'postgres://remote-db.example:5432/startupmanage' })
        })
      );

      assertEqual(result.status, 'config_invalid', 'invalid runtime config must stop before pg import');
      assertEqual(loadCount, 0, 'invalid config must not load pg module');
      assert(
        result.configErrors.some((error) => error.includes('localhost')),
        'invalid config should explain local/test localhost boundary'
      );
      assertValid(result);
    }
  },
  {
    name: 'rejects pg module without Pool constructor',
    run: async () => {
      let loadCount = 0;
      const contract = createPeriodClosePostgresRuntimeImportContract({
        loadPgModule: async () => {
          loadCount += 1;

          return { default: {} };
        }
      });
      const result = await contract.run(createRunInput());

      assertEqual(result.status, 'module_invalid', 'pg module without Pool constructor should be rejected');
      assertEqual(loadCount, 1, 'valid admission/config should load pg module once');
      assertEqual(Boolean(result.factoryResult), false, 'invalid module must not run pool factory');
      assert(
        result.importErrors.some((error) => error.includes('Pool constructor')),
        'module invalid result should explain Pool constructor requirement'
      );
      assertValid(result);
    }
  },
  {
    name: 'keeps loader failure separate from database driver failure',
    run: async () => {
      const contract = createPeriodClosePostgresRuntimeImportContract({
        loadPgModule: async () => {
          throw new Error('fake pg import failed');
        }
      });
      const result = await contract.run(createRunInput());

      assertEqual(result.status, 'loader_failed', 'loader failure should not be classified as db driver failure');
      assertEqual(Boolean(result.factoryResult), false, 'loader failure must not run pool factory');
      assert(
        result.importErrors.some((error) => error.includes('fake pg import failed')),
        'loader failure should be visible in import errors'
      );
      assertValid(result);
    }
  },
  {
    name: 'delegates admitted pg Pool constructor into pool factory runtime binding',
    run: async () => {
      const fakePg = createFakePgModule();
      const contract = createPeriodClosePostgresRuntimeImportContract({
        loadPgModule: async () => fakePg.module
      });
      const result = await contract.run(createRunInput());
      const state = fakePg.readState();

      assertEqual(result.status, 'committed', 'admitted pg module should run through pool factory and client port');
      assertEqual(result.factoryResult?.status, 'committed', 'pool factory should commit fake pg statements');
      assertEqual(result.importErrors.length, 0, 'valid pg module should not produce import errors');
      assertEqual(state.constructedOptions.length, 1, 'runtime import should construct one pg pool');
      assertEqual(
        state.constructedOptions[0]?.application_name,
        'startupmanage-period-close-runtime-import-local',
        'runtime import should preserve period-close application name'
      );
      assertEqual(state.queries.at(-1)?.sql, 'COMMIT;', 'runtime import should reach terminal COMMIT');
      assertEqual(state.releaseCount, 1, 'runtime import should release fake pg client');
      assert(
        result.runtimeEvents.some((event) => event.event === 'delegate_pool_factory'),
        'runtime import should record pool factory delegation'
      );
      assertValid(result);
    }
  },
  {
    name: 'supports commonjs default pg module shape',
    run: async () => {
      const fakePg = createFakePgModule();
      const contract = createPeriodClosePostgresRuntimeImportContract({
        loadPgModule: async () => ({ default: fakePg.module })
      });
      const result = await contract.run(
        createRunInput({
          requestId: 'req-pg-runtime-import-default',
          transactionId: 'tx-pg-runtime-import-default'
        })
      );

      assertEqual(result.status, 'committed', 'runtime import should accept pg default export with Pool');
      assertEqual(fakePg.readState().constructedOptions.length, 1, 'default export should still construct one pool');
      assertValid(result);
    }
  }
];

for (const test of tests) {
  await test.run();
}
