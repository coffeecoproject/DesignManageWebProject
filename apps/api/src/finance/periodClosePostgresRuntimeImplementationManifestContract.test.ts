import {
  evaluatePeriodClosePostgresRuntimeImplementationManifest,
  type PeriodClosePostgresRuntimeImplementationManifest,
} from './periodClosePostgresRuntimeImplementationManifestContract.js';
import type {
  PeriodClosePostgresRuntimeReadinessPackage,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';

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

function findGate(
  result: ReturnType<typeof evaluatePeriodClosePostgresRuntimeImplementationManifest>,
  gate: string,
) {
  const item = result.gates.find((candidate) => candidate.gate === gate);

  assert(item !== undefined, `missing gate ${gate}`);

  return item;
}

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

function createReadyImplementationManifest(
  overrides: Partial<PeriodClosePostgresRuntimeImplementationManifest> = {},
): PeriodClosePostgresRuntimeImplementationManifest {
  const readinessPackage = createReadyReadinessPackage();

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
    readinessPackage,
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

function createLocalContractManifest(): PeriodClosePostgresRuntimeImplementationManifest {
  return {
    ...createReadyImplementationManifest(),
    environment: 'local_contract',
    operations: {
      auditArchive: 'local_contract_events',
    },
    pgRuntime: {
      loader: 'fake_pg_module',
      nativePoolAdapter: 'local_contract_adapter',
    },
    readinessPackage: createReadyReadinessPackage({
      targetDatabase: {
        database: 'startupmanage_local',
        environment: 'local',
        evidenceId: 'local-target-db-evidence',
        host: '127.0.0.1',
        port: 5432,
        selectedEnvironment: 'local_drill_only',
        status: 'selected',
        user: 'period_close_local',
      },
      secret: {
        reference: 'secret://local/period-close/postgres-password',
        status: 'ready',
        targetDatabaseEvidenceId: 'local-target-db-evidence',
      },
    }),
    repositories: {
      periodLockRepository: 'row_backed_contract',
      sourceMutationRepository: 'row_backed_contract',
      voucherLedgerRepository: 'row_backed_contract',
    },
    secretProvider: {
      adapter: 'local_contract_resolver',
      forbidsRawRuntimeSecretEnv: true,
    },
    serviceProcess: {
      entrypoint: 'project_service_runtime_admission',
      evidenceId: 'local-service-runtime-admission-evidence',
      healthReadinessEvidenceId: 'local-health-readiness-evidence',
      productionTrafficBound: false,
    },
  };
}

const tests: UnitTest[] = [
  {
    name: 'marks complete production implementation manifest ready',
    run: () => {
      const result = evaluatePeriodClosePostgresRuntimeImplementationManifest(createReadyImplementationManifest());

      assertEqual(result.status, 'ready', 'complete implementation should be ready');
      assertEqual(result.traceErrors.length, 0, 'complete implementation should not produce trace errors');
      assert(result.gates.every((gate) => gate.status === 'satisfied'), 'all implementation gates should be satisfied');
      assertEqual(findGate(result, 'runtime_readiness_package').status, 'satisfied', 'readiness package should be satisfied');
      assertEqual(findGate(result, 'sql_repository_runtime').status, 'satisfied', 'SQL repository runtime should be satisfied');
    },
  },
  {
    name: 'keeps current local contract implementation blocked from production runtime claims',
    run: () => {
      const result = evaluatePeriodClosePostgresRuntimeImplementationManifest(createLocalContractManifest());

      assertEqual(result.status, 'blocked', 'local contract manifest must not be ready');
      assertEqual(findGate(result, 'secret_provider_adapter').status, 'blocked', 'local secret resolver must block');
      assertEqual(findGate(result, 'postgres_module_loader').status, 'blocked', 'fake pg module must block');
      assertEqual(findGate(result, 'managed_pool_runtime').status, 'blocked', 'local managed pool evidence must block');
      assertEqual(findGate(result, 'sql_repository_runtime').status, 'blocked', 'row-backed repositories must block');
      assertEqual(findGate(result, 'audit_and_observability').status, 'blocked', 'local audit events must block');
    },
  },
  {
    name: 'blocks ready secret evidence when implementation uses local resolver',
    run: () => {
      const result = evaluatePeriodClosePostgresRuntimeImplementationManifest(
        createReadyImplementationManifest({
          secretProvider: {
            adapter: 'local_contract_resolver',
            forbidsRawRuntimeSecretEnv: true,
          },
        }),
      );

      assertEqual(result.status, 'blocked', 'local secret provider must block');
      assertEqual(findGate(result, 'secret_provider_adapter').status, 'blocked', 'secret provider gate should block');
      assert(
        result.traceErrors.includes('ready runtime secret evidence must be backed by a managed secret store adapter'),
        'local resolver should produce secret provider trace error',
      );
    },
  },
  {
    name: 'blocks repository runtime when any repository still uses row-backed contract state',
    run: () => {
      const result = evaluatePeriodClosePostgresRuntimeImplementationManifest(
        createReadyImplementationManifest({
          repositories: {
            periodLockRepository: 'sql_repository_runtime',
            sourceMutationRepository: 'row_backed_contract',
            voucherLedgerRepository: 'sql_repository_runtime',
          },
        }),
      );

      assertEqual(result.status, 'blocked', 'row-backed source repository must block');
      assertEqual(findGate(result, 'sql_repository_runtime').status, 'blocked', 'SQL runtime gate should block');
    },
  },
  {
    name: 'blocks migration evidence drift from readiness package',
    run: () => {
      const result = evaluatePeriodClosePostgresRuntimeImplementationManifest(
        createReadyImplementationManifest({
          migration: {
            applyEvidenceId: 'different-apply-evidence',
            artifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
            rollbackEvidenceId: 'period-close-rollback-evidence-20260705',
            status: 'applied',
          },
        }),
      );

      assertEqual(result.status, 'blocked', 'migration evidence drift must block');
      assert(
        result.traceErrors.includes('runtime implementation migration evidence must match readiness package migration apply evidence'),
        'migration drift should be recorded as trace error',
      );
    },
  },
  {
    name: 'blocks production manifest that does not use production process manager',
    run: () => {
      const result = evaluatePeriodClosePostgresRuntimeImplementationManifest(
        createReadyImplementationManifest({
          serviceProcess: {
            entrypoint: 'project_service_runtime_admission',
            evidenceId: 'local-service-runtime-admission-evidence',
            healthReadinessEvidenceId: 'local-health-readiness-evidence',
            productionTrafficBound: false,
          },
        }),
      );

      assertEqual(result.status, 'blocked', 'production manifest without production process manager must block');
      assertEqual(findGate(result, 'service_process_entry').status, 'blocked', 'service entry gate should block');
      assert(
        result.traceErrors.includes('production runtime implementation must use a production process manager entrypoint'),
        'production process-manager trace error should be recorded',
      );
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
