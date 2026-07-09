import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPeriodClosePostgresRuntimeAdmissionOrchestratorContract,
  validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace,
  type PeriodClosePostgresRuntimeAdmissionOrchestratorResult
} from './periodClosePostgresRuntimeAdmissionOrchestratorContract.js';
import {
  type PeriodClosePostgresPackageManifest
} from './periodClosePostgresDependencyAdmissionContract.js';
import { buildPeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';
import {
  buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate,
  type PeriodClosePostgresRuntimeReadinessPackage
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type {
  PeriodCloseNativePostgresClientLike,
  PeriodCloseNativePostgresPoolLike,
  PeriodCloseNativePostgresQueryResult
} from './periodCloseNativePostgresPoolAdapterContract.js';
import {
  createPeriodClosePostgresSecretResolverContract,
  type PeriodClosePostgresSecretRecord
} from './periodClosePostgresSecretResolverContract.js';
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

function assertValid(result: PeriodClosePostgresRuntimeAdmissionOrchestratorResult) {
  const errors = validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace(result);

  assertEqual(errors.length, 0, `runtime admission orchestrator trace should validate: ${errors.join('; ')}`);
}

const apiPackageManifestPath = 'apps/api/package.json';
const lockfilePath = 'pnpm-lock.yaml';
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

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function readCurrentWorkspaceAdmissionInput() {
  const maybeApiPackagePath = join(process.cwd(), 'package.json');
  const maybeApiPackage = readJsonFile<PeriodClosePostgresPackageManifest>(maybeApiPackagePath);
  const workspaceRoot = maybeApiPackage.name === '@startupmanage/api' ? join(process.cwd(), '..', '..') : process.cwd();
  const actualApiPackagePath =
    maybeApiPackage.name === '@startupmanage/api' ? maybeApiPackagePath : join(workspaceRoot, apiPackageManifestPath);
  const actualLockfilePath = join(workspaceRoot, lockfilePath);

  return {
    apiPackageManifest: readJsonFile<PeriodClosePostgresPackageManifest>(actualApiPackagePath),
    apiPackageManifestPath,
    lockfilePath,
    lockfileText: readFileSync(actualLockfilePath, 'utf8')
  };
}

function createReadyProductionReadinessPackage(
  overrides: Partial<PeriodClosePostgresRuntimeReadinessPackage> = {}
): PeriodClosePostgresRuntimeReadinessPackage {
  return {
    backupRestore: {
      backupEvidenceId: 'backup-restore-evidence-20260705',
      restoreDrillEvidenceId: 'restore-drill-evidence-20260705',
      status: 'approved'
    },
    formalMigrationApply: {
      appliedAt: '2026-07-05T03:30:00.000Z',
      applyEvidenceId: 'formal-apply-evidence-20260705',
      artifactFilePath: 'migrations/20260705_period_close_persistent_lock.sql',
      status: 'applied'
    },
    ownership: {
      releaseOwner: 'release-owner',
      rollbackOwner: 'rollback-owner',
      status: 'assigned'
    },
    poolPolicy: {
      applicationName: 'startupmanage-period-close-orchestrator-production',
      connectionTimeoutMs: 1_000,
      idleTimeoutMs: 10_000,
      maxConnections: 4,
      statementTimeoutMs: 5_000
    },
    productionApplyApproval: {
      approvalEvidenceId: 'apply-approval-20260705',
      approvedBy: 'finance-owner',
      status: 'approved'
    },
    reviewedAt: '2026-07-05T03:40:00.000Z',
    reviewer: 'runtime-admission-orchestrator-test',
    scope: 'period_close_persistent_lock',
    secret: {
      accessPolicyEvidenceId: 'secret-access-policy-20260705',
      reference: 'secret://finance/period-close/postgres-password',
      rotationEvidenceId: 'secret-rotation-20260705',
      source: 'managed_secret_store',
      status: 'ready',
      targetDatabaseEvidenceId: 'target-db-evidence-20260705'
    },
    targetDatabase: {
      database: 'startupmanage',
      environment: 'production',
      evidenceId: 'target-db-evidence-20260705',
      host: 'period-close-postgres.internal',
      port: 5432,
      selectedEnvironment: 'production',
      status: 'selected',
      user: 'period_close_runtime'
    },
    ...overrides
  };
}

function createStatements({
  period = '2026-06',
  transactionId = 'tx-pg-runtime-orchestrator-001'
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
  admissionInput = {
    apiPackageManifest: {
      dependencies: {
        pg: '^8.22.0'
      },
      name: '@startupmanage/api'
    },
    apiPackageManifestPath,
    lockfilePath,
    lockfileText: pgLockfile
  },
  period = '2026-06',
  readinessPackage = createReadyProductionReadinessPackage(),
  requestId = 'req-pg-runtime-orchestrator-001',
  transactionId = 'tx-pg-runtime-orchestrator-001'
}: {
  admissionInput?: Pick<
    ReturnType<typeof readCurrentWorkspaceAdmissionInput>,
    'apiPackageManifest' | 'apiPackageManifestPath' | 'lockfilePath' | 'lockfileText'
  >;
  period?: string;
  readinessPackage?: PeriodClosePostgresRuntimeReadinessPackage;
  requestId?: string;
  transactionId?: string;
} = {}) {
  return {
    ...admissionInput,
    operation: 'close_or_reopen_accounting_period' as const,
    period,
    readinessPackage,
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

function createProductionSecretResolver() {
  const secretStore: PeriodClosePostgresSecretRecord[] = [
    {
      accessPolicyEvidenceId: 'secret-access-policy-20260705',
      enabled: true,
      environment: 'production',
      expiresAt: '2026-12-31T00:00:00.000Z',
      purpose: 'postgres_password',
      reference: 'secret://finance/period-close/postgres-password',
      rotationEvidenceId: 'secret-rotation-20260705',
      source: 'managed_secret_store',
      targetDatabaseEvidenceId: 'target-db-evidence-20260705',
      value: 'internal-password-not-for-output',
      version: 'v1'
    }
  ];

  return createPeriodClosePostgresSecretResolverContract({
    now: '2026-07-05T00:00:00.000Z',
    secretStore
  });
}

const tests: UnitTest[] = [
  {
    name: 'keeps current workspace package and lockfile blocked before operational gates and pg module import',
    run: async () => {
      let loadCount = 0;
      const contract = createPeriodClosePostgresRuntimeAdmissionOrchestratorContract({
        loadPgModule: async () => {
          loadCount += 1;

          return createFakePgModule().module;
        }
      });
      const result = await contract.run(
        createRunInput({
          admissionInput: readCurrentWorkspaceAdmissionInput(),
          readinessPackage: buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
            operationalGate: buildPeriodCloseMigrationOperationalGateContract()
          })
        })
      );

      assertEqual(result.dependencyAdmission.status, 'blocked_by_operational_gates', 'current workspace should remain operationally blocked');
      assertEqual(result.status, 'readiness_blocked', 'orchestrator should stop blocked readiness before runtime import');
      assertEqual(loadCount, 0, 'operational blocker must stop before loading pg');
      assertEqual(result.readiness.status, 'blocked', 'current workspace readiness should remain blocked');
      assertEqual(result.runtimeImportResult, undefined, 'blocked readiness must not create runtime import result');
      assertValid(result);
    }
  },
  {
    name: 'does not delegate to runtime import when dependency admission trace is invalid',
    run: async () => {
      let loadCount = 0;
      const contract = createPeriodClosePostgresRuntimeAdmissionOrchestratorContract({
        loadPgModule: async () => {
          loadCount += 1;

          return createFakePgModule().module;
        }
      });
      const result = await contract.run(
        createRunInput({
          admissionInput: {
            apiPackageManifest: {
              devDependencies: {
                pg: '^8.22.0'
              },
              name: '@startupmanage/api'
            },
            apiPackageManifestPath,
            lockfilePath,
            lockfileText: pgLockfile
          }
        })
      );

      assertEqual(result.status, 'admission_invalid', 'misclassified pg dependency should stop at orchestrator admission validation');
      assertEqual(loadCount, 0, 'invalid admission must not load pg');
      assertEqual(result.runtimeImportResult, undefined, 'invalid admission must not produce runtime import result');
      assert(
        result.admissionErrors.some((error) => error.includes('runtime dependency')),
        'invalid admission should explain runtime dependency requirement'
      );
      assertValid(result);
    }
  },
  {
    name: 'stops admitted future runtime before pg import when readiness package is invalid',
    run: async () => {
      let loadCount = 0;
      const contract = createPeriodClosePostgresRuntimeAdmissionOrchestratorContract({
        loadPgModule: async () => {
          loadCount += 1;

          return createFakePgModule().module;
        }
      });
      const result = await contract.run(
        createRunInput({
          readinessPackage: createReadyProductionReadinessPackage({
            poolPolicy: {
              applicationName: 'wrong-runtime-app',
              connectionTimeoutMs: 1_000,
              idleTimeoutMs: 10_000,
              maxConnections: 4,
              statementTimeoutMs: 5_000
            }
          })
        })
      );

      assertEqual(result.dependencyAdmission.status, 'admitted', 'ready evidence should admit dependency gates');
      assertEqual(result.status, 'readiness_blocked', 'invalid readiness package should stop before pg import');
      assertEqual(loadCount, 0, 'invalid readiness must not load pg');
      assert(
        result.readiness.traceErrors.some((error) => error.includes('application name')),
        'invalid readiness should explain application-name boundary'
      );
      assertEqual(result.runtimeImportResult, undefined, 'invalid readiness must not create runtime import result');
      assertValid(result);
    }
  },
  {
    name: 'delegates admitted future runtime through secret resolver, fake pg pool, commit, and release',
    run: async () => {
      const fakePg = createFakePgModule();
      const contract = createPeriodClosePostgresRuntimeAdmissionOrchestratorContract({
        loadPgModule: async () => fakePg.module,
        secretResolver: createProductionSecretResolver()
      });
      const result = await contract.run(
        createRunInput()
      );
      const state = fakePg.readState();

      assertEqual(result.dependencyAdmission.status, 'admitted', 'complete evidence should admit dependency gates');
      assertEqual(result.readiness.status, 'ready', 'complete readiness package should be ready');
      assertEqual(result.status, 'committed', 'admitted future runtime should commit through fake pg pool');
      assertEqual(state.constructedOptions.length, 1, 'pg pool constructor should run once after admission');
      assertEqual(state.constructedOptions[0]?.password, 'internal-password-not-for-output', 'pool constructor should receive internal secret value only after resolver');
      assertEqual(state.releaseCount, 1, 'client should be released after committed transaction');
      assert(
        state.queries.some((query) => query.sql === 'COMMIT;'),
        'fake pg client should receive terminal COMMIT'
      );
      assertEqual(
        result.runtimeImportResult?.factoryResult?.resolvedSecretEvidence?.reference,
        'secret://finance/period-close/postgres-password',
        'factory result should expose redacted secret evidence'
      );
      assertValid(result);
    }
  }
];

for (const test of tests) {
  await test.run();
}
