import {
  evaluatePeriodCloseManagedSecretProviderReadiness,
  type PeriodCloseManagedSecretProviderReadinessGateId,
} from './periodCloseManagedSecretProviderReadinessContract.js';
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
      applicationName: 'startupmanage-period-close-secret-provider-readiness',
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
    reviewedAt: '2026-07-05T04:10:00.000Z',
    reviewer: 'secret-provider-readiness-reviewer',
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

function gateStatus(
  result: ReturnType<typeof evaluatePeriodCloseManagedSecretProviderReadiness>,
  gateId: PeriodCloseManagedSecretProviderReadinessGateId,
) {
  return result.gates.find((gate) => gate.gate === gateId)?.status;
}

const tests: UnitTest[] = [
  {
    name: 'admits managed secret metadata and redacts runtime secret keys',
    run: () => {
      const result = evaluatePeriodCloseManagedSecretProviderReadiness({
        readinessPackage: createReadyReadinessPackage(),
        requestId: 'secret-provider-readiness-001',
        runtimeEnvironmentSnapshot: {
          FINANCE_DATABASE_PASSWORD: 'secret://finance/period-close/postgres-password',
        },
      });

      assertEqual(result.status, 'ready', 'complete managed secret provider readiness should pass');
      assertEqual(result.secretValueExposed, false, 'readiness result must not expose secret values');
      assertEqual(
        result.sanitizedSecretReference,
        'secret://finance/period-close/postgres-password',
        'ready result should expose only managed reference',
      );
      assertEqual(
        result.redactedRuntimeSecretKeys.includes('FINANCE_DATABASE_PASSWORD'),
        true,
        'ready result should expose only the redacted env key',
      );
      assert(
        result.gates.every((gate) => gate.status === 'satisfied'),
        'ready result should satisfy all gates',
      );
    },
  },
  {
    name: 'blocks raw database password in runtime environment snapshot',
    run: () => {
      const result = evaluatePeriodCloseManagedSecretProviderReadiness({
        readinessPackage: createReadyReadinessPackage(),
        requestId: 'secret-provider-readiness-raw-password',
        runtimeEnvironmentSnapshot: {
          FINANCE_DATABASE_PASSWORD: 'plain-text-password',
        },
      });

      assertEqual(result.status, 'blocked', 'raw password should block secret provider readiness');
      assertEqual(
        gateStatus(result, 'runtime_environment_snapshot'),
        'blocked',
        'runtime environment gate should be blocked',
      );
      assert(
        result.traceErrors.some((error) => error.includes('FINANCE_DATABASE_PASSWORD')),
        'blocked result should identify the unsafe key without exposing the value',
      );
      assertEqual(result.secretValueExposed, false, 'blocked result must not expose secret values');
    },
  },
  {
    name: 'blocks DATABASE_URL because target database must come from readiness package',
    run: () => {
      const result = evaluatePeriodCloseManagedSecretProviderReadiness({
        readinessPackage: createReadyReadinessPackage(),
        requestId: 'secret-provider-readiness-database-url',
        runtimeEnvironmentSnapshot: {
          DATABASE_URL: 'secret://finance/period-close/database-url',
        },
      });

      assertEqual(result.status, 'blocked', 'DATABASE_URL should be blocked even when secret referenced');
      assert(
        result.traceErrors.some((error) => error.includes('target database comes from readiness package')),
        'blocked result should explain target database source of truth',
      );
    },
  },
  {
    name: 'blocks secret reference mismatch with target database evidence',
    run: () => {
      const result = evaluatePeriodCloseManagedSecretProviderReadiness({
        readinessPackage: createReadyReadinessPackage({
          secret: {
            accessPolicyEvidenceId: 'secret-access-policy-20260705',
            reference: 'secret://finance/period-close/postgres-password',
            rotationEvidenceId: 'secret-rotation-20260705',
            source: 'managed_secret_store',
            status: 'ready',
            targetDatabaseEvidenceId: 'other-target-db-evidence',
          },
        }),
        requestId: 'secret-provider-readiness-scope-mismatch',
      });

      assertEqual(result.status, 'blocked', 'target database evidence mismatch should block readiness');
      assertEqual(
        gateStatus(result, 'target_database_scope'),
        'blocked',
        'target database scope gate should be blocked',
      );
    },
  },
  {
    name: 'blocks production secret without rotation or access policy evidence',
    run: () => {
      const result = evaluatePeriodCloseManagedSecretProviderReadiness({
        readinessPackage: createReadyReadinessPackage({
          secret: {
            reference: 'secret://finance/period-close/postgres-password',
            source: 'managed_secret_store',
            status: 'ready',
            targetDatabaseEvidenceId: 'target-db-evidence-20260705',
          },
        }),
        requestId: 'secret-provider-readiness-metadata-missing',
      });

      assertEqual(result.status, 'blocked', 'production secret without governance evidence should block readiness');
      assertEqual(
        gateStatus(result, 'secret_management_evidence'),
        'blocked',
        'secret management evidence gate should be blocked',
      );
    },
  },
  {
    name: 'blocks mismatched runtime secret reference before service wiring can consume it',
    run: () => {
      const result = evaluatePeriodCloseManagedSecretProviderReadiness({
        readinessPackage: createReadyReadinessPackage(),
        requestId: 'secret-provider-readiness-env-ref-mismatch',
        runtimeEnvironmentSnapshot: {
          PGPASSWORD: 'secret://finance/other/postgres-password',
        },
      });

      assertEqual(result.status, 'blocked', 'mismatched env secret reference should block readiness');
      assert(
        result.traceErrors.some((error) => error.includes('PGPASSWORD')),
        'blocked result should identify mismatched key',
      );
    },
  },
];

for (const test of tests) {
  test.run();
}
