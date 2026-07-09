import {
  createPeriodClosePostgresSharedServicePoolRuntimeContract,
  validatePeriodClosePostgresSharedServicePoolRuntimeTrace,
  type PeriodClosePostgresSharedServicePoolRuntimeAdmissionInput,
  type PeriodClosePostgresSharedServicePoolRuntimeResult
} from './periodClosePostgresSharedServicePoolRuntimeContract.js';
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
  type PeriodClosePostgresRuntimeReadinessPackage
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
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
      applicationName: 'startupmanage-period-close-shared-service-pool-production',
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
    reviewer: 'postgres-shared-service-pool-runtime-test',
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
): PeriodClosePostgresSharedServicePoolRuntimeAdmissionInput {
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
    readinessPackage
  };
}

function createFakePgModule() {
  const constructorOptions: Record<string, unknown>[] = [];
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  let connectCount = 0;
  let constructCount = 0;
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
  }

  return {
    loadPgModule: async () => ({ Pool }),
    readState: () => ({
      connectCount,
      constructCount,
      constructorOptions: constructorOptions.map((options) => ({ ...options })),
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
        sourceVersionSetHash: 'src_hash_shared_service_pool_202606',
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
    idempotencyKey: `idem-shared-service-pool-${overrides.requestId ?? 'default'}`,
    now: '2026-07-05T12:00:00+08:00',
    reason: '月末结账',
    requestId: 'req-postgres-shared-service-pool-close',
    version: 1,
    ...overrides
  };
}

function createSharedPoolServiceBoundaryFactory() {
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
      rollbackCount
    })
  };
}

function assertValid<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>(
  result: PeriodClosePostgresSharedServicePoolRuntimeResult<T>
) {
  const errors = validatePeriodClosePostgresSharedServicePoolRuntimeTrace(result);

  assertEqual(errors.length, 0, `shared service pool runtime trace should validate: ${errors.join('; ')}`);
}

const tests: UnitTest[] = [
  {
    name: 'blocks before shared pool construction when readiness is not operationally ready',
    run: async () => {
      const operationalGate = buildPeriodCloseMigrationOperationalGateContract();
      const readinessPackage = buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
        operationalGate
      });
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readFactoryState } = createSharedPoolServiceBoundaryFactory();
      const runtime = createPeriodClosePostgresSharedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule
      });
      const result = await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(readinessPackage),
        period: '2026-06',
        request: createCloseRequest()
      });

      assertEqual(result.status, 'readiness_blocked', 'blocked readiness must stop before shared pool construction');
      assertEqual(result.serviceResult, undefined, 'blocked runtime must not produce service result');
      assertEqual(readFactoryState().factoryCallCount, 0, 'blocked runtime must not create service boundary');
      assertEqual(readPgState().constructCount, 0, 'blocked runtime must not construct pg pool');
      assertEqual(readPgState().connectCount, 0, 'blocked runtime must not connect pg pool');
      assertValid(result);
    }
  },
  {
    name: 'hands one shared runtime pool to service atomic boundary for close',
    run: async () => {
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readCommittedSnapshot, readFactoryState } = createSharedPoolServiceBoundaryFactory();
      const secretResolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T12:00:00.000Z',
        secretStore: createSecretStore()
      });
      const runtime = createPeriodClosePostgresSharedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule,
        secretResolver
      });
      const result = await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(),
        period: '2026-06',
        request: createCloseRequest()
      });
      const pgState = readPgState();
      const factoryState = readFactoryState();

      assertEqual(result.status, 'committed', 'ready shared runtime should commit close through service boundary');
      assertEqual(result.serviceResult?.status, 'committed', 'service boundary must commit after shared pool handoff');
      assertEqual(pgState.constructCount, 1, 'runtime should construct exactly one pg pool for the service request');
      assertEqual(pgState.connectCount, 1, 'service atomic boundary should use the shared runtime pool once');
      assertEqual(pgState.releaseCount, 1, 'service atomic boundary must release the shared runtime client');
      assertEqual(
        pgState.constructorOptions[0]?.password,
        'resolved-production-secret',
        'secret value should only be injected into pg constructor options'
      );
      assertEqual(factoryState.factoryCallCount, 1, 'runtime should create one service boundary from the shared pool');
      assertEqual(factoryState.poolCount, 1, 'runtime should hand one pool adapter to the service layer');
      assertEqual(factoryState.commitCount, 1, 'service atomic boundary should publish staged close state');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'shared service pool close should persist the period lock in the local contract state'
      );
      assertIncludes(
        result.adapterEvents.map((event) => event.event),
        'connect_native_pool',
        'shared runtime should expose native pool adapter connection evidence'
      );
      assertIncludes(
        result.adapterEvents.map((event) => event.event),
        'execute_native_query',
        'shared runtime should expose service SQL replay through the native pool adapter'
      );
      assertEqual(
        JSON.stringify(result.resolvedSecretEvidence).includes('resolved-production-secret'),
        false,
        'runtime result must not expose raw secret values'
      );
      assertValid(result);
    }
  },
  {
    name: 'uses the same shared runtime pool path for closed-period source guard',
    run: async () => {
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { createServiceBoundary, readCommittedSnapshot, readFactoryState } = createSharedPoolServiceBoundaryFactory();
      const secretResolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T12:00:00.000Z',
        secretStore: createSecretStore()
      });
      const runtime = createPeriodClosePostgresSharedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule,
        secretResolver
      });

      await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(),
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-postgres-shared-service-pool-close-before-source' })
      });

      const result = await runtime.guardSourceMutation({
        admission: createAdmissionInput(),
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-05T12:05:00+08:00',
          requestId: 'req-postgres-shared-service-pool-source-guard'
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

      assertEqual(result.status, 'committed', 'shared runtime should commit source guard audit');
      assertEqual(result.serviceResult?.status, 'committed', 'source guard should commit through service boundary');
      assertEqual(pgState.constructCount, 2, 'close and source guard should each construct one request-scoped shared pool');
      assertEqual(pgState.connectCount, 2, 'close and source guard should each replay SQL through the shared pool');
      assertEqual(factoryState.factoryCallCount, 2, 'runtime should create one service boundary for each request-scoped pool');
      assertEqual(factoryState.commitCount, 2, 'close and source guard should publish separate staged units');
      assertEqual(committedSnapshot.sourceRecords[0]?.amount, '1000.00', 'closed-period source row should remain unchanged');
      assertEqual(
        committedSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period source guard audit should persist after shared pool handoff'
      );
      assertValid(result);
    }
  },
  {
    name: 'rejects invalid pg module shape before service boundary creation',
    run: async () => {
      const { createServiceBoundary, readFactoryState } = createSharedPoolServiceBoundaryFactory();
      const runtime = createPeriodClosePostgresSharedServicePoolRuntimeContract({
        createServiceBoundary,
        loadPgModule: async () => ({})
      });
      const result = await runtime.closeAccountingPeriod({
        admission: createAdmissionInput(),
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-postgres-shared-service-pool-invalid-module' })
      });

      assertEqual(result.status, 'module_invalid', 'invalid pg module shape should be classified before service work');
      assertEqual(readFactoryState().factoryCallCount, 0, 'invalid pg module must not create service boundary');
      assertValid(result);
    }
  }
];

for (const test of tests) {
  await test.run();
}
