import {
  createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract,
  validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace,
  type FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEventName,
} from './financeHttpPostgresManagedProjectServiceRuntimeAdmissionContract.js';
import type {
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary,
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeContract,
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle,
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest,
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeStartInput,
} from './financeHttpPostgresManagedProjectServiceProcessRuntimeContract.js';
import {
  summarizeRuntimeImplementationBundle,
} from './financeHttpPostgresManagedProjectServiceProcessRuntimeContract.js';
import type {
  PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationManifest,
} from './periodClosePostgresRuntimeImplementationManifestContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationBundleEvidence,
  PeriodClosePostgresRuntimeImplementationBundleDescriptor,
  PeriodClosePostgresRuntimeImplementationRepositoryBindings,
} from './periodClosePostgresRuntimeImplementationBundleContract.js';
import type {
  PeriodClosePostgresRuntimeReadinessPackage,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import {
  derivePeriodClosePostgresRuntimeReadiness,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';

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

function assertDeepEqual<T>(actual: T, expected: T, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}. Expected ${expectedJson}, got ${actualJson}`);
  }
}

const baseManifest: FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest = {
  appName: 'startupmanage-finance-api',
  exposesProductionTraffic: false,
  healthPath: '/healthz',
  mode: 'local_contract',
  processName: 'finance-period-close-api-service-process',
  readinessPath: '/readyz',
  shutdownTimeoutMs: 5000,
  signals: {
    SIGINT: 'graceful',
    SIGTERM: 'graceful',
  },
  supervisor: 'local_contract',
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
      appliedAt: '2026-07-05T03:30:00.000Z',
      applyEvidenceId: 'formal-apply-evidence-20260705',
      artifactFilePath: 'migrations/20260705_period_close_persistent_lock.sql',
      status: 'applied',
    },
    ownership: {
      releaseOwner: 'finance-release-owner',
      rollbackOwner: 'finance-rollback-owner',
      status: 'assigned',
    },
    poolPolicy: {
      applicationName: 'startupmanage-period-close-service-runtime-admission',
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
    reviewedAt: '2026-07-05T03:40:00.000Z',
    reviewer: 'service-runtime-admission-reviewer',
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

function createBlockedReadinessPackage(): PeriodClosePostgresRuntimeReadinessPackage {
  return {
    ...createReadyReadinessPackage(),
    backupRestore: {
      status: 'not_started',
    },
    formalMigrationApply: {
      status: 'not_applied',
    },
    ownership: {
      status: 'not_started',
    },
    productionApplyApproval: {
      status: 'not_started',
    },
    secret: {
      status: 'not_ready',
    },
    targetDatabase: {
      status: 'not_selected',
    },
  };
}

function createReadyLocalReadinessPackage(): PeriodClosePostgresRuntimeReadinessPackage {
  return createReadyReadinessPackage({
    secret: {
      accessPolicyEvidenceId: 'local-secret-access-policy-20260705',
      reference: 'secret://finance/period-close/postgres-password',
      rotationEvidenceId: 'local-secret-rotation-20260705',
      source: 'managed_secret_store',
      status: 'ready',
      targetDatabaseEvidenceId: 'local-target-db-evidence-20260705',
    },
    targetDatabase: {
      database: 'startupmanage_local',
      environment: 'local',
      evidenceId: 'local-target-db-evidence-20260705',
      host: '127.0.0.1',
      port: 5432,
      selectedEnvironment: 'local_drill_only',
      status: 'selected',
      user: 'period_close_local',
    },
  });
}

function createReadyLocalRuntimeImplementationManifest({
  readinessPackage = createReadyLocalReadinessPackage(),
  overrides = {},
}: {
  readinessPackage?: PeriodClosePostgresRuntimeReadinessPackage;
  overrides?: Partial<PeriodClosePostgresRuntimeImplementationManifest>;
} = {}): PeriodClosePostgresRuntimeImplementationManifest {
  return {
    environment: 'local_contract',
    migration: {
      applyEvidenceId: readinessPackage.formalMigrationApply.applyEvidenceId,
      artifactPath: readinessPackage.formalMigrationApply.artifactFilePath,
      rollbackEvidenceId: 'local-period-close-rollback-evidence-20260705',
      status: 'applied',
    },
    operations: {
      auditArchive: 'durable_archive',
      metricsEvidenceId: 'local-period-close-metrics-evidence-20260705',
      runbookEvidenceId: 'local-period-close-runbook-evidence-20260705',
    },
    pgRuntime: {
      dependencyAdmissionEvidenceId: 'local-pg-dependency-admission-20260705',
      loader: 'lazy_pg_runtime_import',
      managedPoolEvidenceId: 'local-managed-pool-runtime-evidence-20260705',
      nativePoolAdapter: 'native_pg_pool_adapter',
    },
    readinessPackage,
    repositories: {
      periodLockRepository: 'sql_repository_runtime',
      sourceMutationRepository: 'sql_repository_runtime',
      voucherLedgerRepository: 'sql_repository_runtime',
    },
    reviewedAt: '2026-07-05T08:30:00.000Z',
    reviewer: 'service-runtime-admission-reviewer',
    scope: 'period_close_persistent_lock',
    secretProvider: {
      accessPolicyEvidenceId: 'local-secret-access-policy-20260705',
      adapter: 'managed_secret_store_adapter',
      evidenceId: 'local-managed-secret-store-adapter-evidence-20260705',
      forbidsRawRuntimeSecretEnv: true,
      rotationEvidenceId: 'local-secret-rotation-20260705',
    },
    serviceProcess: {
      entrypoint: 'project_service_runtime_admission',
      evidenceId: 'local-project-service-runtime-admission-evidence-20260705',
      healthReadinessEvidenceId: 'local-service-health-readiness-evidence-20260705',
      productionTrafficBound: false,
    },
    ...overrides,
  };
}

function createAdmissionInput({
  apiPackageManifest = {
    dependencies: {
      pg: '^8.22.0',
    },
    name: '@startupmanage/api',
  },
  readinessPackage = createReadyLocalReadinessPackage(),
}: {
  apiPackageManifest?: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput['apiPackageManifest'];
  readinessPackage?: PeriodClosePostgresRuntimeReadinessPackage;
} = {}): PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput {
  const readiness = derivePeriodClosePostgresRuntimeReadiness(readinessPackage);
  const fallbackReadiness = derivePeriodClosePostgresRuntimeReadiness(createReadyLocalReadinessPackage());

  return {
    apiPackageManifest,
    apiPackageManifestPath: 'apps/api/package.json',
    lockfilePath: 'pnpm-lock.yaml',
    lockfileText: pgLockfile,
    readinessPackage,
    runtimeImplementationBundle: createRuntimeImplementationBundle(readiness.poolConfig ?? fallbackReadiness.poolConfig!),
  };
}

function createRuntimeImplementationBundle(
  poolConfig: NonNullable<ReturnType<typeof derivePeriodClosePostgresRuntimeReadiness>['poolConfig']>,
): PeriodClosePostgresRuntimeImplementationBundleDescriptor {
  return {
    managedServicePoolRuntimeModulePath: 'apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts',
    poolConfig,
    repositoryBindings: {
      periodLockRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/periodCloseSqlRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction',
      },
      sourceMutationRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction',
      },
      voucherLedgerRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/accountingVoucherLedgerRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction',
      },
    },
    runtimeImportModulePath: 'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
    serviceRuntimeAdmissionEvidenceId: 'local-project-service-runtime-admission-evidence-20260705',
    sourceMutationBridgeModulePath: 'apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts',
  };
}

function createReadyRepositoryBindings(
  manifest: PeriodClosePostgresRuntimeImplementationManifest,
): PeriodClosePostgresRuntimeImplementationRepositoryBindings {
  const binding = {
    evidenceId: 'local-sql-runtime-repository-evidence-20260705',
    implementation: 'sql_repository_runtime' as const,
    migrationArtifactPath: manifest.migration.artifactPath,
    modulePath: 'apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts',
    transactionBoundary: 'managed_postgres_transaction' as const,
  };

  return {
    periodLockRepository: {
      ...binding,
      modulePath: 'apps/api/src/finance/periodCloseSqlRepositoryContract.ts',
    },
    sourceMutationRepository: binding,
    voucherLedgerRepository: {
      ...binding,
      modulePath: 'apps/api/src/finance/accountingVoucherLedgerRepositoryContract.ts',
    },
  };
}

function createReadyBundleEvidence(): PeriodClosePostgresRuntimeImplementationBundleEvidence {
  return {
    managedServicePoolRuntimeModulePath: 'apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts',
    runtimeImportModulePath: 'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
    serviceRuntimeAdmissionEvidenceId: 'local-project-service-runtime-admission-evidence-20260705',
    sourceMutationBridgeModulePath: 'apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts',
  };
}

function createRuntimeImplementationBundleStartInput(
  runtimeImplementationManifest: PeriodClosePostgresRuntimeImplementationManifest,
  {
    bundleEvidence = createReadyBundleEvidence(),
    repositoryBindings = createReadyRepositoryBindings(runtimeImplementationManifest),
  }: {
    bundleEvidence?: PeriodClosePostgresRuntimeImplementationBundleEvidence;
    repositoryBindings?: PeriodClosePostgresRuntimeImplementationRepositoryBindings;
  } = {},
) {
  return {
    runtimeImplementationBundleEvidence: bundleEvidence,
    runtimeImplementationManifest,
    runtimeRepositoryBindings: repositoryBindings,
  };
}

function createRuntimeHandle(
  input: FinanceHttpPostgresManagedProjectServiceProcessRuntimeStartInput,
  {
    runtimeBundleEvidenceId,
  }: {
    runtimeBundleEvidenceId?: string;
  } = {},
): FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle {
  const { manifest } = input;
  const runtimeImplementationBundle: FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary = {
    ...summarizeRuntimeImplementationBundle(input.runtimeImplementationBundle),
    ...(runtimeBundleEvidenceId ? { serviceRuntimeAdmissionEvidenceId: runtimeBundleEvidenceId } : {}),
  };
  const summary = {
    host: '127.0.0.1',
    mode: manifest.mode,
    origin: 'http://127.0.0.1:53221',
    port: 53221,
    processName: manifest.processName,
    productionServiceBound: false,
    runtimeBundleEvidenceId: runtimeBundleEvidenceId ?? runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
    runtimeImplementationBundle,
    runtimeNodeServerLifecycleState: 'active' as const,
  };

  return {
    health: ({ requestId: _requestId = 'health' } = {}) => ({
      lifecycleState: 'ready',
      path: manifest.healthPath,
      productionReady: false,
      runtimeImplementationBundle,
      status: 'healthy',
      summary,
    }),
    origin: summary.origin,
    readiness: ({ requestId: _requestId = 'readiness' } = {}) => ({
      lifecycleState: 'ready',
      path: manifest.readinessPath,
      productionReady: false,
      runtimeImplementationBundle,
      status: 'ready',
      summary,
    }),
    readRuntimeEvents: () => [],
    shutdown: async ({ requestId = 'shutdown' } = {}) => ({
      bootstrapShutdown: {
        nodeServerShutdown: {
          httpServerClosed: true,
          processShutdown: {
            lifecycleState: 'closed',
            processTrace: [],
            runtimeShutdown: {
              events: [],
              poolLifecycleState: 'closed',
              requestId,
              shutdownErrors: [],
              status: 'closed',
              traceErrors: [],
              transactionId: `${requestId}:tx`,
            },
          },
        },
        processTrace: [],
        serviceProcessClosed: true,
      },
      lifecycleState: 'closed',
      runtimeTrace: [],
    }),
    summary,
  };
}

function createFakeServiceRuntime({
  failStart = false,
  runtimeBundleEvidenceId,
}: {
  failStart?: boolean;
  runtimeBundleEvidenceId?: string;
} = {}) {
  const startInputs: FinanceHttpPostgresManagedProjectServiceProcessRuntimeStartInput[] = [];
  const serviceRuntime: FinanceHttpPostgresManagedProjectServiceProcessRuntimeContract = {
    start: async (input) => {
      startInputs.push(input);

      if (failStart) {
        throw new Error('service-runtime-start-failed');
      }

      return createRuntimeHandle(input, { runtimeBundleEvidenceId });
    },
  };

  return {
    serviceRuntime,
    startInputs,
  };
}

function eventNames(events: Array<{ event: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEventName }>) {
  return events.map((event) => event.event);
}

const tests: UnitTest[] = [
  {
    name: 'starts service runtime only after manifest, readiness, and dependency admission pass',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime();
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest();

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-admission-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
        runtimeStartInput: {
          bootstrapInput: {
            envSnapshot: {
              FINANCE_DATABASE_PASSWORD: 'secret://finance/period-close/postgres-password',
            },
            host: '127.0.0.1',
            port: 53221,
          },
        },
      });

      assertEqual(result.status, 'service_runtime_started', 'Complete admission should start local service runtime');
      assertEqual(result.traceErrors.length, 0, 'Complete admission should keep trace valid');
      assertEqual(fakeRuntime.startInputs.length, 1, 'Complete admission should call service runtime once');
      assertEqual(
        fakeRuntime.startInputs[0]?.manifest.processName,
        baseManifest.processName,
        'Admission should forward runtime manifest',
      );
      assertEqual(
        fakeRuntime.startInputs[0]?.runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
        'local-project-service-runtime-admission-evidence-20260705',
        'Admission should forward ready runtime implementation bundle into service runtime start',
      );
      assertEqual(
        result.readinessProbe?.runtimeImplementationBundle?.managedServicePoolRuntimeModulePath,
        'apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts',
        'Started readiness probe should expose runtime implementation bundle evidence',
      );
      assertEqual(
        result.handle?.summary.runtimeBundleEvidenceId,
        'local-project-service-runtime-admission-evidence-20260705',
        'Started handle summary should preserve admitted runtime bundle evidence id',
      );
      assertEqual(
        result.health?.summary?.runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
        'local-project-service-runtime-admission-evidence-20260705',
        'Started health summary should preserve admitted runtime bundle evidence id',
      );
      assertEqual(
        result.readinessProbe?.summary?.runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
        'local-project-service-runtime-admission-evidence-20260705',
        'Started readiness summary should preserve admitted runtime bundle evidence id',
      );
      assertEqual(result.readiness.status, 'ready', 'Complete admission should keep postgres readiness ready');
      assertEqual(result.runtimeImplementation.status, 'ready', 'Complete admission should keep implementation ready');
      assertEqual(result.runtimeImplementationBundle.status, 'ready', 'Complete admission should keep implementation bundle ready');
      assertEqual(result.secretProviderReadiness.status, 'ready', 'Complete admission should keep secret provider ready');
      assert(result.dependencyAdmission !== undefined, 'Complete admission should expose dependency admission result');
      assertEqual(result.dependencyAdmission.status, 'admitted', 'Complete admission should keep dependency admitted');
      assertEqual(result.health?.status, 'healthy', 'Started service should expose healthy probe');
      assertEqual(result.readinessProbe?.status, 'ready', 'Started service should expose ready probe');
      assertDeepEqual(
        eventNames(result.events),
        [
          'receive_start_request',
          'validate_service_runtime_manifest',
          'evaluate_runtime_implementation_bundle',
          'derive_runtime_readiness',
          'evaluate_secret_provider_readiness',
          'validate_runtime_implementation_bundle',
          'start_service_runtime',
          'read_service_probes',
          'validate_service_runtime_bundle_continuity',
          'return_response',
        ],
        'Admission trace should keep start order',
      );
      assertDeepEqual(
        validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace(result),
        [],
        'Trace validator should accept complete start result',
      );
    },
  },
  {
    name: 'does not start service runtime when readiness package is blocked',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime();
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const blockedReadinessPackage = createBlockedReadinessPackage();
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest({
        readinessPackage: blockedReadinessPackage,
      });

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: blockedReadinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-readiness-blocked-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
      });

      assertEqual(result.status, 'readiness_blocked', 'Blocked readiness should block service runtime start');
      assertEqual(fakeRuntime.startInputs.length, 0, 'Blocked readiness must not call service runtime');
      assertEqual(result.readiness.status, 'blocked', 'Result should preserve blocked readiness');
      assertEqual(result.runtimeImplementation.status, 'blocked', 'Result should preserve blocked implementation');
      assertEqual(
        result.secretProviderReadiness.status,
        'blocked',
        'Blocked readiness package should also expose blocked secret provider readiness',
      );
      assert(
        result.readiness.gates.some((gate) => gate.status === 'blocked'),
        'Blocked result should expose readiness gates',
      );
      assertDeepEqual(result.manifestErrors, [], 'Valid manifest should not be blamed for readiness block');
    },
  },
  {
    name: 'does not start service runtime when runtime env exposes raw database secret',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime();
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest();

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-secret-provider-blocked-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
        runtimeStartInput: {
          bootstrapInput: {
            envSnapshot: {
              FINANCE_DATABASE_PASSWORD: 'plain-text-password',
            },
            host: '127.0.0.1',
            port: 53221,
          },
        },
      });

      assertEqual(result.status, 'secret_provider_blocked', 'Raw runtime secret should block service runtime');
      assertEqual(fakeRuntime.startInputs.length, 0, 'Secret provider block must not call service runtime');
      assertEqual(result.readiness.status, 'ready', 'Secret provider block should preserve ready postgres package');
      assertEqual(
        result.secretProviderReadiness.status,
        'blocked',
        'Result should expose blocked secret provider readiness',
      );
      assert(
        result.secretProviderReadiness.traceErrors.some((error) => error.includes('FINANCE_DATABASE_PASSWORD')),
        'Secret provider readiness should identify unsafe env key',
      );
      assertEqual(result.secretProviderReadiness.secretValueExposed, false, 'Secret values must never be exposed');
      assertDeepEqual(
        eventNames(result.events),
        [
          'receive_start_request',
          'validate_service_runtime_manifest',
          'evaluate_runtime_implementation_bundle',
          'derive_runtime_readiness',
          'evaluate_secret_provider_readiness',
          'validate_runtime_implementation_bundle',
          'reject_service_runtime_start',
          'return_response',
        ],
        'Secret provider blocked trace should reject before service runtime start',
      );
    },
  },
  {
    name: 'does not start service runtime when dependency admission is invalid',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime();
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest();

      const result = await admission.start({
        admission: createAdmissionInput({
          apiPackageManifest: {
            dependencies: {},
            name: '@startupmanage/api',
          },
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-dependency-blocked-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
      });

      assertEqual(result.status, 'dependency_admission_blocked', 'Invalid dependency admission should block service runtime');
      assertEqual(fakeRuntime.startInputs.length, 0, 'Invalid dependency admission must not call service runtime');
      assert(result.dependencyAdmission !== undefined, 'Dependency block should expose dependency admission result');
      assert(
        result.dependencyAdmission.gates.some((gate) => gate.gate === 'pg_runtime_dependency' && gate.status === 'blocked'),
        'Result should expose blocked pg runtime dependency gate',
      );
      assert(
        result.dependencyAdmission.gates.some((gate) => gate.gate === 'runtime_import_allowed' && gate.status === 'blocked'),
        'Result should block runtime import gate',
      );
      assertEqual(result.dependencyAdmission.status, 'manifest_lock_mismatch', 'Manifest and lockfile mismatch should be explicit');
    },
  },
  {
    name: 'does not start service runtime when runtime implementation manifest is blocked',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime();
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest({
        overrides: {
          repositories: {
            periodLockRepository: 'sql_repository_runtime',
            sourceMutationRepository: 'row_backed_contract',
            voucherLedgerRepository: 'sql_repository_runtime',
          },
        },
      });

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-implementation-blocked-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
        runtimeStartInput: {
          bootstrapInput: {
            envSnapshot: {
              FINANCE_DATABASE_PASSWORD: 'secret://finance/period-close/postgres-password',
            },
            host: '127.0.0.1',
            port: 53221,
          },
        },
      });

      assertEqual(result.status, 'runtime_implementation_blocked', 'Blocked implementation should block service runtime');
      assertEqual(fakeRuntime.startInputs.length, 0, 'Blocked implementation must not call service runtime');
      assertEqual(result.readiness.status, 'ready', 'Implementation block should preserve ready readiness');
      assertEqual(result.runtimeImplementation.status, 'blocked', 'Implementation block should expose blocked implementation');
      assertEqual(
        result.runtimeImplementationBundle.status,
        'implementation_blocked',
        'Implementation block should stop runtime bundle assembly early',
      );
      assert(
        result.runtimeImplementation.gates.some(
          (gate) => gate.gate === 'sql_repository_runtime' && gate.status === 'blocked',
        ),
        'Result should expose blocked SQL repository runtime gate',
      );
      assertEqual(result.secretProviderReadiness.status, 'ready', 'Implementation block should not hide secret provider readiness');
      assertEqual(result.dependencyAdmission, undefined, 'Implementation block should stop before dependency admission');
    },
  },
  {
    name: 'does not start service runtime when runtime implementation bundle evidence is incomplete',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime();
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest();

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-bundle-blocked-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest, {
          bundleEvidence: {
            managedServicePoolRuntimeModulePath: 'apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts',
            runtimeImportModulePath: 'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
            sourceMutationBridgeModulePath: 'apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts',
          },
        }),
        runtimeStartInput: {
          bootstrapInput: {
            envSnapshot: {
              FINANCE_DATABASE_PASSWORD: 'secret://finance/period-close/postgres-password',
            },
            host: '127.0.0.1',
            port: 53221,
          },
        },
      });

      assertEqual(
        result.status,
        'runtime_implementation_bundle_blocked',
        'Incomplete runtime implementation bundle should block service runtime',
      );
      assertEqual(fakeRuntime.startInputs.length, 0, 'Incomplete runtime implementation bundle must not call service runtime');
      assertEqual(
        result.runtimeImplementationBundle.status,
        'service_runtime_bundle_invalid',
        'Result should expose invalid service runtime bundle evidence',
      );
      assert(
        result.runtimeImplementationBundle.bundleErrors.some((error) =>
          error.includes('service runtime admission evidence')
        ),
        'Bundle errors should identify missing service runtime admission evidence',
      );
    },
  },
  {
    name: 'does not start service runtime when service manifest is production-shaped',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime();
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest();

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: {
          ...baseManifest,
          exposesProductionTraffic: true,
          mode: 'production',
          supervisor: 'production_process_manager',
        },
        requestId: 'service-runtime-manifest-blocked-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
      });

      assertEqual(result.status, 'runtime_manifest_invalid', 'Production-shaped manifest should be rejected');
      assertEqual(fakeRuntime.startInputs.length, 0, 'Invalid manifest must not call service runtime');
      assert(
        result.manifestErrors.includes('service_runtime_admission_requires_local_contract_mode'),
        'Result should expose local contract mode requirement',
      );
      assertEqual(result.readiness.status, 'ready', 'Manifest rejection should not hide postgres readiness result');
      assert(
        result.dependencyAdmission !== undefined,
        'Manifest rejection should still expose already evaluated dependency result',
      );
      assertEqual(result.dependencyAdmission.status, 'admitted', 'Manifest rejection should not hide dependency result');
    },
  },
  {
    name: 'blocks service runtime admission when started runtime returns drifted bundle evidence',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime({
        runtimeBundleEvidenceId: 'drifted-project-service-runtime-admission-evidence',
      });
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest();

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-bundle-continuity-blocked-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
        runtimeStartInput: {
          bootstrapInput: {
            envSnapshot: {
              FINANCE_DATABASE_PASSWORD: 'secret://finance/period-close/postgres-password',
            },
            host: '127.0.0.1',
            port: 53221,
          },
        },
      });

      assertEqual(
        result.status,
        'runtime_bundle_continuity_blocked',
        'Drifted runtime bundle evidence should block service runtime admission',
      );
      assertEqual(fakeRuntime.startInputs.length, 1, 'Bundle drift is detected after a single local runtime start attempt');
      assertEqual(result.handle, undefined, 'Bundle drift must not expose unsafe runtime handle to caller');
      assertEqual(result.health?.status, 'healthy', 'Bundle drift diagnostics should include health snapshot');
      assertEqual(result.readinessProbe?.status, 'ready', 'Bundle drift diagnostics should include readiness snapshot');
      assert(
        result.traceErrors.some((error) => error.includes('drifted-project-service-runtime-admission-evidence')),
        'Bundle drift result should identify actual drifted runtime evidence',
      );
      assertDeepEqual(
        eventNames(result.events),
        [
          'receive_start_request',
          'validate_service_runtime_manifest',
          'evaluate_runtime_implementation_bundle',
          'derive_runtime_readiness',
          'evaluate_secret_provider_readiness',
          'validate_runtime_implementation_bundle',
          'start_service_runtime',
          'read_service_probes',
          'validate_service_runtime_bundle_continuity',
          'return_response',
        ],
        'Bundle drift trace should validate continuity before returning blocked result',
      );
    },
  },
  {
    name: 'returns runtime start failure without converting it into readiness evidence',
    run: async () => {
      const fakeRuntime = createFakeServiceRuntime({ failStart: true });
      const admission = createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
        serviceRuntime: fakeRuntime.serviceRuntime,
      });
      const runtimeImplementationManifest = createReadyLocalRuntimeImplementationManifest();

      const result = await admission.start({
        admission: createAdmissionInput({
          readinessPackage: runtimeImplementationManifest.readinessPackage,
        }),
        manifest: baseManifest,
        requestId: 'service-runtime-start-failed-001',
        ...createRuntimeImplementationBundleStartInput(runtimeImplementationManifest),
      });

      assertEqual(result.status, 'runtime_start_failed', 'Runtime start exception should be explicit');
      assertEqual(fakeRuntime.startInputs.length, 1, 'Start failure should happen after one runtime start attempt');
      assert(
        result.traceErrors.some((error) => error.includes('service-runtime-start-failed')),
        'Start failure should be preserved in trace errors',
      );
      assertEqual(result.readiness.status, 'ready', 'Runtime start failure should not rewrite readiness evidence');
    },
  },
];

async function run() {
  for (const test of tests) {
    await test.run();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
