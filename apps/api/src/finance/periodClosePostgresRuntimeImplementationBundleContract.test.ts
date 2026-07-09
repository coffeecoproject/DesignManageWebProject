import {
  evaluatePeriodClosePostgresRuntimeImplementationBundle,
  validatePeriodClosePostgresRuntimeImplementationBundleTrace,
  type PeriodClosePostgresRuntimeImplementationBundleEvidence,
  type PeriodClosePostgresRuntimeImplementationRepositoryBindings,
} from './periodClosePostgresRuntimeImplementationBundleContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationManifest,
} from './periodClosePostgresRuntimeImplementationManifestContract.js';
import type {
  PeriodClosePostgresRuntimeReadinessPackage,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type { PeriodClosePostgresPackageManifest } from './periodClosePostgresDependencyAdmissionContract.js';

type UnitTest = {
  name: string;
  run: () => void;
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

const apiPackageManifestPath = 'apps/api/package.json';
const lockfilePath = 'pnpm-lock.yaml';
const readyApiManifest: PeriodClosePostgresPackageManifest = {
  dependencies: {
    pg: '^8.22.0',
  },
  name: '@startupmanage/api',
};
const readyLockfileText = `
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
      integrity: sha512-runtime-bundle-fixture
`;

function createReadyReadinessPackage(
  overrides: Partial<PeriodClosePostgresRuntimeReadinessPackage> = {},
): PeriodClosePostgresRuntimeReadinessPackage {
  return {
    backupRestore: {
      backupEvidenceId: 'backup-evidence-20260705',
      restoreDrillEvidenceId: 'restore-drill-evidence-20260705',
      status: 'approved',
    },
    formalMigrationApply: {
      appliedAt: '2026-07-05T07:00:00.000Z',
      applyEvidenceId: 'formal-migration-apply-20260705',
      artifactFilePath: 'migrations/20260705_period_close_persistent_lock.sql',
      status: 'applied',
    },
    ownership: {
      releaseOwner: 'finance-release-owner',
      rollbackOwner: 'finance-rollback-owner',
      status: 'assigned',
    },
    poolPolicy: {
      applicationName: 'startupmanage-period-close-runtime-implementation',
      connectionTimeoutMs: 1000,
      idleTimeoutMs: 10000,
      maxConnections: 4,
      statementTimeoutMs: 5000,
    },
    productionApplyApproval: {
      approvalEvidenceId: 'production-apply-approval-20260705',
      approvedBy: 'finance-owner',
      status: 'approved',
    },
    reviewedAt: '2026-07-05T07:10:00.000Z',
    reviewer: 'runtime-implementation-reviewer',
    scope: 'period_close_persistent_lock',
    secret: {
      accessPolicyEvidenceId: 'secret-access-policy-20260705',
      reference: 'secret://finance/period-close/postgres-password',
      rotationEvidenceId: 'secret-rotation-20260705',
      source: 'managed_secret_store',
      status: 'ready',
      targetDatabaseEvidenceId: 'target-db-evidence-20260705',
    },
    targetDatabase: {
      database: 'startupmanage',
      environment: 'production',
      evidenceId: 'target-db-evidence-20260705',
      host: 'period-close-postgres.internal',
      port: 5432,
      selectedEnvironment: 'production',
      status: 'selected',
      user: 'period_close_runtime',
    },
    ...overrides,
  };
}

function createReadyManifest(
  overrides: Partial<PeriodClosePostgresRuntimeImplementationManifest> = {},
): PeriodClosePostgresRuntimeImplementationManifest {
  return {
    environment: 'production',
    migration: {
      applyEvidenceId: 'formal-migration-apply-20260705',
      artifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
      rollbackEvidenceId: 'period-close-rollback-evidence-20260705',
      status: 'applied',
    },
    operations: {
      auditArchive: 'durable_archive',
      metricsEvidenceId: 'period-close-metrics-evidence-20260705',
      runbookEvidenceId: 'period-close-runbook-evidence-20260705',
    },
    pgRuntime: {
      dependencyAdmissionEvidenceId: 'pg-dependency-admission-20260705',
      loader: 'lazy_pg_runtime_import',
      managedPoolEvidenceId: 'managed-pool-runtime-evidence-20260705',
      nativePoolAdapter: 'native_pg_pool_adapter',
    },
    readinessPackage: createReadyReadinessPackage(),
    repositories: {
      periodLockRepository: 'sql_repository_runtime',
      sourceMutationRepository: 'sql_repository_runtime',
      voucherLedgerRepository: 'sql_repository_runtime',
    },
    reviewedAt: '2026-07-05T07:20:00.000Z',
    reviewer: 'runtime-implementation-reviewer',
    scope: 'period_close_persistent_lock',
    secretProvider: {
      accessPolicyEvidenceId: 'secret-access-policy-20260705',
      adapter: 'managed_secret_store_adapter',
      evidenceId: 'managed-secret-store-adapter-evidence-20260705',
      forbidsRawRuntimeSecretEnv: true,
      rotationEvidenceId: 'secret-rotation-20260705',
    },
    serviceProcess: {
      entrypoint: 'production_process_manager',
      evidenceId: 'production-process-manager-evidence-20260705',
      healthReadinessEvidenceId: 'deployed-health-readiness-evidence-20260705',
      productionTrafficBound: true,
    },
    ...overrides,
  };
}

function createRepositoryBindings(
  overrides: Partial<PeriodClosePostgresRuntimeImplementationRepositoryBindings> = {},
): PeriodClosePostgresRuntimeImplementationRepositoryBindings {
  const base = {
    evidenceId: 'sql-repository-runtime-evidence-20260705',
    implementation: 'sql_repository_runtime' as const,
    migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
    modulePath: 'apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts',
    transactionBoundary: 'managed_postgres_transaction' as const,
  };

  return {
    periodLockRepository: {
      ...base,
      modulePath: 'apps/api/src/finance/periodCloseSqlRepositoryContract.ts',
    },
    sourceMutationRepository: {
      ...base,
      modulePath: 'apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts',
    },
    voucherLedgerRepository: {
      ...base,
      modulePath: 'apps/api/src/finance/accountingVoucherLedgerRepositoryContract.ts',
    },
    ...overrides,
  };
}

function createBundleEvidence(
  overrides: Partial<PeriodClosePostgresRuntimeImplementationBundleEvidence> = {},
): PeriodClosePostgresRuntimeImplementationBundleEvidence {
  return {
    managedServicePoolRuntimeModulePath:
      'apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts',
    runtimeImportModulePath: 'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
    serviceRuntimeAdmissionEvidenceId: 'service-runtime-admission-evidence-20260705',
    sourceMutationBridgeModulePath:
      'apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts',
    ...overrides,
  };
}

function evaluate({
  apiPackageManifest = readyApiManifest,
  bundleEvidence = createBundleEvidence(),
  lockfileText = readyLockfileText,
  manifest = createReadyManifest(),
  repositoryBindings = createRepositoryBindings(),
}: {
  apiPackageManifest?: PeriodClosePostgresPackageManifest;
  bundleEvidence?: PeriodClosePostgresRuntimeImplementationBundleEvidence;
  lockfileText?: string;
  manifest?: PeriodClosePostgresRuntimeImplementationManifest;
  repositoryBindings?: PeriodClosePostgresRuntimeImplementationRepositoryBindings;
} = {}) {
  return evaluatePeriodClosePostgresRuntimeImplementationBundle({
    apiPackageManifest,
    apiPackageManifestPath,
    bundleEvidence,
    lockfilePath,
    lockfileText,
    manifest,
    repositoryBindings,
  });
}

function assertTraceValid(result: ReturnType<typeof evaluatePeriodClosePostgresRuntimeImplementationBundle>) {
  const errors = validatePeriodClosePostgresRuntimeImplementationBundleTrace(result);

  assertEqual(errors.length, 0, `bundle trace should validate: ${errors.join('; ')}`);
}

const tests: UnitTest[] = [
  {
    name: 'assembles runtime implementation bundle only when implementation, dependency, pool, repositories, and service runtime evidence are ready',
    run: () => {
      const result = evaluate();

      assertEqual(result.status, 'ready', 'complete bundle should be ready');
      assert(result.bundle !== undefined, 'ready result should expose bundle descriptor');
      assert(result.poolConfig !== undefined, 'ready result should expose readiness-derived pool config');
      assertEqual(result.dependencyAdmission?.status, 'admitted', 'dependency admission should be admitted');
      assertEqual(result.bundle?.poolConfig.host, 'period-close-postgres.internal', 'bundle should carry pool target');
      assert(
        result.gates.every((item) => item.status === 'satisfied'),
        'ready bundle should satisfy every bundle gate',
      );
      assertTraceValid(result);
    },
  },
  {
    name: 'does not evaluate dependencies when runtime implementation manifest is blocked',
    run: () => {
      const result = evaluate({
        manifest: createReadyManifest({
          repositories: {
            periodLockRepository: 'sql_repository_runtime',
            sourceMutationRepository: 'row_backed_contract',
            voucherLedgerRepository: 'sql_repository_runtime',
          },
        }),
      });

      assertEqual(result.status, 'implementation_blocked', 'blocked manifest should stop bundle construction');
      assertEqual(result.dependencyAdmission, undefined, 'dependency admission should not run after blocked manifest');
      assertEqual(result.bundle, undefined, 'blocked implementation should not expose bundle');
      assert(
        result.events.every((event) => event.event !== 'evaluate_dependency_admission'),
        'blocked implementation should not evaluate dependency admission',
      );
      assertTraceValid(result);
    },
  },
  {
    name: 'keeps ready implementation blocked when pg dependency admission is not admitted',
    run: () => {
      const result = evaluate({
        apiPackageManifest: {
          devDependencies: {
            pg: '^8.22.0',
          },
          name: '@startupmanage/api',
        },
      });

      assertEqual(result.status, 'dependency_blocked', 'misclassified pg dependency should block bundle');
      assertEqual(
        result.dependencyAdmission?.status,
        'runtime_dependency_misclassified',
        'dependency admission should preserve misclassification status',
      );
      assertEqual(result.bundle, undefined, 'dependency-blocked bundle should not expose descriptor');
      assert(
        result.traceErrors.some((error) => error.includes('pg must be a runtime dependency')),
        'dependency-blocked bundle should preserve pg misclassification trace error',
      );
    },
  },
  {
    name: 'blocks bundle when SQL repository binding drifts from manifest or migration artifact',
    run: () => {
      const result = evaluate({
        repositoryBindings: createRepositoryBindings({
          sourceMutationRepository: {
            evidenceId: 'row-backed-source-evidence',
            implementation: 'row_backed_contract',
            migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
            modulePath: 'apps/api/src/finance/periodCloseRepositoryContract.ts',
            transactionBoundary: 'local_contract',
          },
        }),
      });

      assertEqual(result.status, 'repository_runtime_invalid', 'row-backed binding should block bundle');
      assert(
        result.repositoryErrors.some((error) => error.includes('sourceMutationRepository')),
        'repository errors should identify source mutation binding',
      );
      assertEqual(result.bundle, undefined, 'repository-blocked bundle should not expose descriptor');
      assertTraceValid(result);
    },
  },
  {
    name: 'blocks bundle when service runtime evidence is incomplete',
    run: () => {
      const result = evaluate({
        bundleEvidence: createBundleEvidence({
          managedServicePoolRuntimeModulePath: undefined,
        }),
      });

      assertEqual(result.status, 'service_runtime_bundle_invalid', 'missing service runtime evidence should block');
      assert(
        result.bundleErrors.some((error) => error.includes('managed service pool runtime module')),
        'bundle errors should identify missing managed runtime module',
      );
      assertEqual(result.bundle, undefined, 'invalid service bundle should not expose descriptor');
      assertTraceValid(result);
    },
  },
];

for (const test of tests) {
  try {
    await test.run();
  } catch (error) {
    console.error(`Test failed: ${test.name}`);
    throw error;
  }
}
