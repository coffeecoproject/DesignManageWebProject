import {
  buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate,
  derivePeriodClosePostgresRuntimeReadiness,
  type PeriodClosePostgresRuntimeReadinessPackage
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import {
  createPeriodClosePostgresRuntimeAdmissionOrchestratorContract,
  validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace
} from './periodClosePostgresRuntimeAdmissionOrchestratorContract.js';
import { buildPeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';
import {
  createPeriodClosePostgresSecretResolverContract,
  type PeriodClosePostgresSecretRecord
} from './periodClosePostgresSecretResolverContract.js';
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

function createReadyProductionPackage(
  overrides: Partial<PeriodClosePostgresRuntimeReadinessPackage> = {}
): PeriodClosePostgresRuntimeReadinessPackage {
  return {
    backupRestore: {
      backupEvidenceId: 'backup-evidence-20260705',
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
      releaseOwner: 'finance-release-owner',
      rollbackOwner: 'finance-rollback-owner',
      status: 'assigned'
    },
    poolPolicy: {
      applicationName: 'startupmanage-period-close-runtime-readiness',
      connectionTimeoutMs: 1_000,
      idleTimeoutMs: 10_000,
      maxConnections: 4,
      statementTimeoutMs: 5_000
    },
    productionApplyApproval: {
      approvalEvidenceId: 'production-apply-approval-20260705',
      approvedBy: 'finance-owner',
      status: 'approved'
    },
    reviewedAt: '2026-07-05T03:40:00.000Z',
    reviewer: 'runtime-readiness-reviewer',
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
  transactionId = 'tx-runtime-readiness-001'
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
    now: '2026-07-05T03:45:00.000Z',
    secretStore
  });
}

const tests: UnitTest[] = [
  {
    name: 'derives current operational gate into a blocked readiness package without pool config',
    run: () => {
      const packageFromGate = buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
        operationalGate: buildPeriodCloseMigrationOperationalGateContract()
      });
      const result = derivePeriodClosePostgresRuntimeReadiness(packageFromGate);

      assertEqual(result.status, 'blocked', 'current operational gate should remain blocked');
      assertEqual(result.poolConfig, undefined, 'blocked package must not produce pool config');
      assert(
        Object.values(result.runtimeEvidence).every((value) => value === false),
        'blocked package must keep all runtime evidence false'
      );
      assert(
        result.gates.every((readinessGate) => readinessGate.status === 'blocked'),
        'blocked package must keep every runtime readiness gate blocked'
      );
    }
  },
  {
    name: 'derives a complete production readiness package into runtime evidence and redacted pool config',
    run: () => {
      const result = derivePeriodClosePostgresRuntimeReadiness(createReadyProductionPackage());

      assertEqual(result.status, 'ready', 'complete production package should be ready');
      assert(result.poolConfig !== undefined, 'ready package should produce pool config');
      assertEqual(result.poolConfig.environment, 'production', 'ready pool config should target production');
      assertEqual(result.poolConfig.sslMode, 'require', 'production pool config should require ssl');
      assertEqual(
        result.poolConfig.passwordSecretRef,
        'secret://finance/period-close/postgres-password',
        'pool config should carry secret reference only'
      );
      assert(
        !('password' in result.poolConfig),
        'pool config must not carry raw secret values'
      );
      assert(
        Object.values(result.runtimeEvidence).every((value) => value === true),
        'ready package should satisfy all runtime evidence booleans'
      );
      assert(
        result.gates.every((readinessGate) => readinessGate.status === 'satisfied'),
        'ready package should satisfy every runtime readiness gate'
      );
    }
  },
  {
    name: 'blocks production readiness when the secret source is not managed',
    run: () => {
      const result = derivePeriodClosePostgresRuntimeReadiness(
        createReadyProductionPackage({
          secret: {
            accessPolicyEvidenceId: 'secret-access-policy-20260705',
            reference: 'secret://finance/period-close/postgres-password',
            rotationEvidenceId: 'secret-rotation-20260705',
            source: 'local_dev_secret_store',
            status: 'ready',
            targetDatabaseEvidenceId: 'target-db-evidence-20260705'
          }
        })
      );

      assertEqual(result.status, 'blocked', 'production readiness should reject local dev secret source');
      assertEqual(result.poolConfig, undefined, 'invalid secret readiness must not produce pool config');
      assert(
        result.traceErrors.some((error) => error.includes('production-managed')),
        'blocked readiness should explain production-managed secret requirement'
      );
    }
  },
  {
    name: 'blocks readiness when secret evidence is scoped to a different target database',
    run: () => {
      const result = derivePeriodClosePostgresRuntimeReadiness(
        createReadyProductionPackage({
          secret: {
            accessPolicyEvidenceId: 'secret-access-policy-20260705',
            reference: 'secret://finance/period-close/postgres-password',
            rotationEvidenceId: 'secret-rotation-20260705',
            source: 'managed_secret_store',
            status: 'ready',
            targetDatabaseEvidenceId: 'other-target-db-evidence'
          }
        })
      );

      assertEqual(result.status, 'blocked', 'readiness should reject mismatched secret target evidence');
      assertEqual(result.runtimeEvidence.secretManagerRuntimeReady, false, 'mismatched secret evidence should fail runtime evidence');
      assert(
        result.traceErrors.some((error) => error.includes('scoped to target database evidence')),
        'blocked readiness should explain target database secret scope'
      );
    }
  },
  {
    name: 'feeds readiness package directly into runtime admission orchestrator',
    run: async () => {
      const readinessPackage = createReadyProductionPackage();
      const fakePg = createFakePgModule();
      const contract = createPeriodClosePostgresRuntimeAdmissionOrchestratorContract({
        loadPgModule: async () => fakePg.module,
        secretResolver: createProductionSecretResolver()
      });

      const result = await contract.run({
        apiPackageManifest: {
          dependencies: {
            pg: '^8.22.0'
          },
          name: '@startupmanage/api'
        },
        apiPackageManifestPath,
        lockfilePath,
        lockfileText: pgLockfile,
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        readinessPackage,
        requestId: 'req-runtime-readiness-001',
        statements: createStatements(),
        transactionId: 'tx-runtime-readiness-001'
      });
      const state = fakePg.readState();
      const traceErrors = validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace(result);

      assertEqual(traceErrors.length, 0, `runtime admission trace should validate: ${traceErrors.join('; ')}`);
      assertEqual(result.readiness.status, 'ready', 'orchestrator should derive ready package internally');
      assertEqual(result.readiness.poolConfig?.environment, 'production', 'orchestrator should derive production pool config internally');
      assertEqual(result.dependencyAdmission.status, 'admitted', 'derived runtime evidence should admit dependency gates');
      assertEqual(result.status, 'committed', 'derived pool config should reach fake pg commit');
      assertEqual(state.constructedOptions.length, 1, 'runtime pool should be constructed after readiness admission');
      assertEqual(state.constructedOptions[0]?.password, 'internal-password-not-for-output', 'secret should resolve only inside factory boundary');
      assert(
        state.queries.some((query) => query.sql === 'COMMIT;'),
        'fake pg runtime should execute terminal commit statement'
      );
      assertEqual(state.releaseCount, 1, 'fake pg client should be released once');
    }
  }
];

for (const test of tests) {
  await test.run();
}
