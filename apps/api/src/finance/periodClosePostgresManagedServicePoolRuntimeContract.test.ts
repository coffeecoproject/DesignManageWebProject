import {
  createPeriodClosePostgresManagedServicePoolRuntimeContract,
  validatePeriodClosePostgresManagedServicePoolRuntimeTrace,
  validatePeriodClosePostgresManagedServicePoolShutdownTrace,
  type PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  type PeriodClosePostgresManagedServicePoolRuntimeResult,
  type PeriodClosePostgresManagedServicePoolShutdownResult
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import {
  createPeriodCloseServiceAtomicCommitBoundaryContract,
  type PeriodCloseServiceAtomicCommitBoundaryContract
} from './periodCloseServiceAtomicCommitBoundaryContract.js';
import { createPeriodClosePostgresAtomicCommitBridgeContract } from './periodClosePostgresAtomicCommitBridgeContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import { buildPeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';
import type {
  PeriodClosePostgresClientPort,
  PeriodClosePostgresPoolPort
} from './periodClosePostgresClientPortContract.js';
import type { PeriodClosePostgresPackageManifest } from './periodClosePostgresDependencyAdmissionContract.js';
import {
  buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate,
  derivePeriodClosePostgresRuntimeReadiness,
  type PeriodClosePostgresRuntimeReadinessPackage
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationBundleDescriptor
} from './periodClosePostgresRuntimeImplementationBundleContract.js';
import {
  createPeriodClosePostgresSecretResolverContract,
  type PeriodClosePostgresSecretRecord
} from './periodClosePostgresSecretResolverContract.js';
import {
  clonePeriodClosePersistentState,
  type PeriodClosePersistentState,
  type PersistentAccountingPeriodRecord,
  type PersistentCloseAccountingPeriodResult,
  type PersistentFinanceSourceRecord,
  type PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertIncludes<T>(values: readonly T[], expected: T, message: string) {
  if (!values.includes(expected)) {
    throw new Error(`${message}. Expected ${String(expected)} in ${values.map(String).join(', ')}`);
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
      applicationName: 'startupmanage-period-close-managed-service-pool-production',
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
    reviewedAt: '2026-07-05T04:10:00.000Z',
    reviewer: 'postgres-managed-service-pool-runtime-test',
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

function createSecretStore(overrides: Partial<PeriodClosePostgresSecretRecord> = {}): PeriodClosePostgresSecretRecord[] {
  return [
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
      value: 'resolved-production-secret',
      version: 'prod-v1',
      ...overrides
    }
  ];
}

function createAdmissionInput(
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage = createReadyProductionReadinessPackage()
): PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput {
  const readiness = derivePeriodClosePostgresRuntimeReadiness(readinessPackage);
  const fallbackReadiness = derivePeriodClosePostgresRuntimeReadiness(createReadyProductionReadinessPackage());

  return {
    apiPackageManifest: {
      dependencies: {
        pg: '^8.22.0'
      },
      name: '@startupmanage/api'
    } satisfies PeriodClosePostgresPackageManifest,
    apiPackageManifestPath,
    lockfilePath,
    lockfileText: pgLockfile,
    readinessPackage,
    runtimeImplementationBundle: createRuntimeImplementationBundle(readiness.poolConfig ?? fallbackReadiness.poolConfig!)
  };
}

function createRuntimeImplementationBundle(
  poolConfig: NonNullable<ReturnType<typeof derivePeriodClosePostgresRuntimeReadiness>['poolConfig']>
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
        transactionBoundary: 'managed_postgres_transaction'
      },
      sourceMutationRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction'
      },
      voucherLedgerRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/accountingVoucherLedgerRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction'
      }
    },
    runtimeImportModulePath: 'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
    serviceRuntimeAdmissionEvidenceId: 'local-project-service-runtime-admission-evidence-20260705',
    sourceMutationBridgeModulePath: 'apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts'
  };
}

function createFakePgModule() {
  const constructorOptions: Record<string, unknown>[] = [];
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  let connectCount = 0;
  let constructCount = 0;
  let endCount = 0;
  let releaseCount = 0;

  class Pool {
    constructor(options: Record<string, unknown>) {
      constructCount += 1;
      constructorOptions.push({ ...options });
    }

    async connect(): Promise<PeriodClosePostgresClientPort> {
      connectCount += 1;

      return {
        query: async (sql, parameters = []) => {
          queries.push({ parameters: [...parameters], sql });

          return { rowCount: 1, rows: [] };
        },
        release: () => {
          releaseCount += 1;
        }
      };
    }

    async end() {
      endCount += 1;
    }
  }

  return {
    loadPgModule: async () => ({ Pool }),
    readState: () => ({
      connectCount,
      constructCount,
      constructorOptions: constructorOptions.map((options) => ({ ...options })),
      endCount,
      queries: queries.map((query) => ({ ...query, parameters: [...query.parameters] })),
      releaseCount
    })
  };
}

function createPeriod(overrides: Partial<PersistentAccountingPeriodRecord> = {}): PersistentAccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createCloseChecks(): CloseCheckRow[] {
  return requiredCloseCheckCodes.map((code) => ({
    blockerCount: 0,
    canPass: true,
    code,
    label: code,
    sources: [],
    status: '通过',
    summary: '通过'
  }));
}

function createSourceRecord(
  overrides: Partial<PersistentFinanceSourceRecord> = {}
): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1000.00',
    id: 'source-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-001',
    status: '未结清',
    version: 1,
    ...overrides
  };
}

function createState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {
      '2026-06': {
        checks: createCloseChecks(),
        computedAt: '2026-06-30T20:00:00+08:00',
        sourceVersionSetHash: 'src_hash_managed_service_pool_202606',
        trialBalance: {
          creditTotal: '68000.00',
          debitTotal: '68000.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    },
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [createPeriod(), createPeriod({ period: '2026-07' })],
    sourceMutationEvents: [],
    sourceRecords: [createSourceRecord()],
    ...overrides
  };
}

function createCloseRequest(overrides: Partial<CloseAccountingPeriodRequest> = {}): CloseAccountingPeriodRequest {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    idempotencyKey: `idem-managed-service-pool-${overrides.requestId ?? 'default'}`,
    now: '2026-07-05T12:00:00+08:00',
    reason: '月末结账',
    requestId: 'req-postgres-managed-service-pool-close',
    version: 1,
    ...overrides
  };
}

function createManagedPoolServiceBoundaryFactory() {
  let committedState = createState();
  let commitCount = 0;
  let factoryCallCount = 0;
  let rollbackCount = 0;
  const pools: PeriodClosePostgresPoolPort[] = [];

  function createServiceBoundary({ pool }: { pool: PeriodClosePostgresPoolPort }): PeriodCloseServiceAtomicCommitBoundaryContract {
    factoryCallCount += 1;
    pools.push(pool);

    const atomicBridge = createPeriodClosePostgresAtomicCommitBridgeContract({
      createUnitOfWork: () => {
        const driver = createInMemoryPeriodCloseSqlDriverExecutor();
        const repository = createPeriodCloseSqlRepositoryContract({
          fallbackNow: '2026-07-05T12:00:00+08:00',
          initialState: clonePeriodClosePersistentState(committedState)
        });
        const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });

        return {
          clientRepository,
          commit: () => {
            committedState = clonePeriodClosePersistentState(repository.readState());
            commitCount += 1;
          },
          rollback: () => {
            rollbackCount += 1;
          }
        };
      },
      pool
    });

    return createPeriodCloseServiceAtomicCommitBoundaryContract({ atomicBridge });
  }

  return {
    createServiceBoundary,
    readCommittedSnapshot: () =>
      createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-05T12:00:00+08:00',
        initialState: clonePeriodClosePersistentState(committedState)
      }).readDatabaseSnapshot(),
    readFactoryState: () => ({
      commitCount,
      factoryCallCount,
      poolCount: pools.length,
      rollbackCount,
      uniquePoolCount: new Set(pools).size
    })
  };
}

function assertValid<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>(
  result: PeriodClosePostgresManagedServicePoolRuntimeResult<T>
) {
  const errors = validatePeriodClosePostgresManagedServicePoolRuntimeTrace(result);

  assertEqual(errors.length, 0, `managed service pool runtime trace should validate: ${errors.join('; ')}`);
}

function assertValidShutdown(result: PeriodClosePostgresManagedServicePoolShutdownResult) {
  const errors = validatePeriodClosePostgresManagedServicePoolShutdownTrace(result);

  assertEqual(errors.length, 0, `managed service pool shutdown trace should validate: ${errors.join('; ')}`);
}

const tests: UnitTest[] = [
  {
    name: 'blocks before managed pool construction when readiness is not operationally ready',
    run: async () => {
      const operationalGate = buildPeriodCloseMigrationOperationalGateContract();
      const readinessPackage = buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
        operationalGate
      });
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readFactoryState } = createManagedPoolServiceBoundaryFactory();
      const runtime = createPeriodClosePostgresManagedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule
      });
      const result = await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(readinessPackage),
        period: '2026-06',
        request: createCloseRequest()
      });

      assertEqual(result.status, 'readiness_blocked', 'blocked readiness must stop before managed pool construction');
      assertEqual(result.poolLifecycleState, 'not_initialized', 'blocked runtime must keep pool uninitialized');
      assertEqual(readFactoryState().factoryCallCount, 0, 'blocked runtime must not create service boundary');
      assertEqual(readPgState().constructCount, 0, 'blocked runtime must not construct pg pool');
      assertEqual(readPgState().connectCount, 0, 'blocked runtime must not connect pg pool');
      assertValid(result);
    }
  },
  {
    name: 'reuses one managed runtime pool across close and source guard requests',
    run: async () => {
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readCommittedSnapshot, readFactoryState } = createManagedPoolServiceBoundaryFactory();
      const secretResolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T12:00:00.000Z',
        secretStore: createSecretStore()
      });
      const runtime = createPeriodClosePostgresManagedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule,
        secretResolver
      });

      const closeResult = await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(),
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-postgres-managed-service-pool-close-before-source' })
      });
      const guardResult = await runtime.guardSourceMutation({
        admission: createAdmissionInput(),
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-05T12:05:00+08:00',
          requestId: 'req-postgres-managed-service-pool-source-guard'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整',
          targetAccountingPeriod: '2026-06'
        }
      });
      const committedSnapshot = readCommittedSnapshot();
      const pgState = readPgState();
      const factoryState = readFactoryState();

      assertEqual(closeResult.status, 'committed', 'ready managed runtime should commit close');
      assertEqual(guardResult.status, 'committed', 'ready managed runtime should commit source guard audit');
      assertEqual(closeResult.poolLifecycleState, 'active', 'close should initialize the managed pool');
      assertEqual(guardResult.poolLifecycleState, 'active', 'source guard should reuse the managed pool');
      assertEqual(pgState.constructCount, 1, 'runtime should construct exactly one process-level managed pg pool');
      assertEqual(pgState.connectCount, 2, 'close and source guard should each acquire from the same managed pool');
      assertEqual(pgState.releaseCount, 2, 'both service requests must release their managed pool clients');
      assertEqual(factoryState.factoryCallCount, 2, 'runtime should create one service boundary per request');
      assertEqual(factoryState.uniquePoolCount, 1, 'service boundaries must receive the same managed pool adapter instance');
      assertEqual(factoryState.commitCount, 2, 'close and source guard should publish separate staged units');
      assertEqual(committedSnapshot.sourceRecords[0]?.amount, '1000.00', 'closed-period source row should remain unchanged');
      assertEqual(
        committedSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period source guard audit should persist after managed pool handoff'
      );
      assertIncludes(
        guardResult.events.map((event) => event.event),
        'reuse_managed_pool',
        'second request should explicitly reuse the managed pool'
      );
      assertIncludes(
        guardResult.adapterEvents.map((event) => event.event),
        'execute_native_query',
        'managed runtime should expose SQL replay through the native pool adapter'
      );
      assertEqual(
        JSON.stringify(closeResult.resolvedSecretEvidence).includes('resolved-production-secret'),
        false,
        'runtime result must not expose raw secret values'
      );
      assertValid(closeResult);
      assertValid(guardResult);
    }
  },
  {
    name: 'shutdown closes the managed pool and blocks later service requests',
    run: async () => {
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readFactoryState } = createManagedPoolServiceBoundaryFactory();
      const secretResolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T12:00:00.000Z',
        secretStore: createSecretStore()
      });
      const runtime = createPeriodClosePostgresManagedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule,
        secretResolver
      });

      await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(),
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-postgres-managed-service-pool-before-shutdown' })
      });

      const shutdownResult = await runtime.shutdown({ requestId: 'req-postgres-managed-service-pool-shutdown' });
      const afterShutdownResult = await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(),
        period: '2026-07',
        request: createCloseRequest({ requestId: 'req-postgres-managed-service-pool-after-shutdown' })
      });
      const pgState = readPgState();
      const factoryState = readFactoryState();

      assertEqual(shutdownResult.status, 'closed', 'shutdown should close the active managed pool');
      assertEqual(shutdownResult.poolLifecycleState, 'closed', 'shutdown should mark runtime lifecycle closed');
      assertEqual(afterShutdownResult.status, 'pool_closed', 'closed managed runtime must reject later service work');
      assertEqual(pgState.constructCount, 1, 'closed runtime must not construct another pg pool');
      assertEqual(pgState.connectCount, 1, 'closed runtime must not acquire another pg client');
      assertEqual(pgState.endCount, 1, 'shutdown should call native pool end exactly once');
      assertEqual(factoryState.factoryCallCount, 1, 'closed runtime must not create another service boundary');
      assertValidShutdown(shutdownResult);
      assertValid(afterShutdownResult);
    }
  },
  {
    name: 'rejects runtime implementation bundle pool config drift before managed pool construction',
    run: async () => {
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readFactoryState } = createManagedPoolServiceBoundaryFactory();
      const readinessPackage = createReadyProductionReadinessPackage();
      const admission = createAdmissionInput(readinessPackage);
      const runtime = createPeriodClosePostgresManagedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule
      });

      const result = await runtime.closeAccountingPeriod({
        admission: {
          ...admission,
          runtimeImplementationBundle: {
            ...admission.runtimeImplementationBundle,
            poolConfig: {
              ...admission.runtimeImplementationBundle.poolConfig,
              applicationName: 'startupmanage-period-close-managed-service-pool-drifted-bundle'
            }
          }
        },
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-postgres-managed-service-pool-bundle-drift' })
      });

      assertEqual(result.status, 'runtime_bundle_invalid', 'bundle pool config drift should block before pool construction');
      assertIncludes(
        result.runtimeBundleErrors,
        'managed service pool runtime bundle pool config must match derived readiness pool config',
        'bundle drift should be reported as runtime bundle error'
      );
      assertEqual(readPgState().constructCount, 0, 'bundle drift must not construct pg pool');
      assertEqual(readPgState().connectCount, 0, 'bundle drift must not connect pg pool');
      assertEqual(readFactoryState().factoryCallCount, 0, 'bundle drift must not create service boundary');
      assertValid(result);
    }
  },
  {
    name: 'rejects runtime config drift after managed pool initialization',
    run: async () => {
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readFactoryState } = createManagedPoolServiceBoundaryFactory();
      const secretResolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T12:00:00.000Z',
        secretStore: createSecretStore()
      });
      const runtime = createPeriodClosePostgresManagedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule,
        secretResolver
      });
      const originalReadiness = createReadyProductionReadinessPackage();
      const driftReadiness = createReadyProductionReadinessPackage({
        poolPolicy: {
          ...originalReadiness.poolPolicy,
          applicationName: 'startupmanage-period-close-managed-service-pool-production-v2'
        }
      });

      await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(originalReadiness),
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-postgres-managed-service-pool-before-config-drift' })
      });
      const driftResult = await runtime.guardSourceMutation({
        admission: createAdmissionInput(driftReadiness),
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-05T12:05:00+08:00',
          requestId: 'req-postgres-managed-service-pool-config-drift'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(driftResult.status, 'config_invalid', 'managed runtime should reject config drift after pool initialization');
      assertEqual(
        driftResult.configErrors.includes('period-close managed service pool runtime config changed after pool initialization'),
        true,
        'config drift should be visible in runtime errors'
      );
      assertEqual(readPgState().constructCount, 1, 'config drift must not construct a replacement pool');
      assertEqual(readPgState().connectCount, 1, 'config drift must not enter service work');
      assertEqual(readFactoryState().factoryCallCount, 1, 'config drift must not create another service boundary');
      assertValid(driftResult);
    }
  }
];

for (const test of tests) {
  await test.run();
}
