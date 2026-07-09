import type { FinanceHttpApiRepositoryGatewayRequest } from './financeHttpApiRepositoryGatewayContract.js';
import {
  handleFinanceHttpPostgresManagedSourceMutationBridge,
  validateFinanceHttpPostgresManagedSourceMutationBridgeTrace,
  type FinanceHttpPostgresManagedSourceMutationBridgeResponse
} from './financeHttpPostgresManagedSourceMutationBridgeContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import { buildPeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';
import {
  type PeriodClosePostgresClientPort,
  type PeriodClosePostgresPoolPort
} from './periodClosePostgresClientPortContract.js';
import type { PeriodClosePostgresPackageManifest } from './periodClosePostgresDependencyAdmissionContract.js';
import { createPeriodClosePostgresAtomicCommitBridgeContract } from './periodClosePostgresAtomicCommitBridgeContract.js';
import {
  createPeriodClosePostgresManagedServicePoolRuntimeContract,
  validatePeriodClosePostgresManagedServicePoolRuntimeTrace,
  type PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  type PeriodClosePostgresManagedServicePoolRuntimeContract,
  type PeriodClosePostgresManagedServicePoolRuntimeResult
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
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
  createPeriodCloseServiceAtomicCommitBoundaryContract,
  type PeriodCloseServiceAtomicCommitBoundaryContract
} from './periodCloseServiceAtomicCommitBoundaryContract.js';
import {
  canonicalClosedAccountingPeriodErrorCode,
  requiredCloseCheckCodes,
  type CloseCheckRow
} from './periodCloseContract.js';
import {
  clonePeriodClosePersistentState,
  type PeriodClosePersistentState,
  type PersistentAccountingPeriodRecord,
  type PersistentFinanceSourceRecord,
  type PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { getDefaultFinanceSourceTableName } from './periodCloseSourceTableRepositoryContract.js';
import {
  createFinanceSourceTableSqlRepositoryContract,
  type FinanceSourceTableSqlRepositoryContract,
  type FinanceSourceTableSqlRow
} from './periodCloseSourceTableSqlRepositoryContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

type CapturedManagedRuntimeResult = PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>;

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(message);
  }
}

function bodyAsRecord(response: FinanceHttpPostgresManagedSourceMutationBridgeResponse) {
  assertObject(response.body, 'managed source mutation bridge response body should be an object');

  return response.body;
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
      applicationName: 'startupmanage-period-close-http-managed-source-mutation-test',
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
    reviewer: 'finance-http-postgres-managed-source-mutation-bridge-test',
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
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  let connectCount = 0;
  let constructCount = 0;
  let releaseCount = 0;

  class Pool {
    constructor() {
      constructCount += 1;
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

function createClosedPeriod(period = '2026-06'): PersistentAccountingPeriodRecord {
  return createPeriod({
    closeCheckSnapshotHash: `chk-${period}`,
    closeCheckSnapshotId: `close-check-${period}`,
    closeReason: `${period} 月结`,
    closedAt: `${period}-30T18:00:00+08:00`,
    closedBySnapshot: { id: 'user-001', name: '李明' },
    period,
    status: '已结账'
  });
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

function createCloseSnapshot(period = '2026-06'): PeriodClosePersistentState['closeCheckSnapshots'][number] {
  return {
    canClose: true,
    checkSnapshotHash: `chk-${period}`,
    checks: createCloseChecks(),
    computedAt: `${period}-30T17:50:00+08:00`,
    createdAt: `${period}-30T18:00:00+08:00`,
    id: `close-check-${period}`,
    persistedForClose: true,
    period,
    requestId: `req-close-${period}`,
    runType: 'close_snapshot',
    sourceVersionSetHash: `source-version-${period}`,
    status: '通过',
    trialBalance: {
      creditTotal: '0.00',
      debitTotal: '0.00',
      difference: '0.00',
      status: '平衡'
    }
  };
}

function createSqlRow(overrides: Partial<FinanceSourceTableSqlRow> = {}): FinanceSourceTableSqlRow {
  return {
    accounting_period: '2026-06',
    amount: '1000.00',
    id: 'source-managed-bridge-001',
    source_no: 'AR-202606-MANAGED-BRIDGE',
    status: '未结清',
    tableName: getDefaultFinanceSourceTableName('receivable_payable'),
    updated_at: '2026-07-06T10:50:00+08:00',
    version: 1,
    ...overrides
  };
}

function createStateFromSourceSqlRepository({
  overrides = {},
  sourceSqlRepository
}: {
  overrides?: Partial<PeriodClosePersistentState>;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
}): PeriodClosePersistentState {
  return {
    checkInputs: {},
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [createPeriod(), createPeriod({ period: '2026-07' })],
    sourceMutationEvents: [],
    sourceRecords: sourceSqlRepository.readRows() as PersistentFinanceSourceRecord[],
    ...overrides
  };
}

function createManagedPoolServiceBoundaryFactory({
  sourceSqlRepository,
  stateOverrides
}: {
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  stateOverrides?: Partial<PeriodClosePersistentState>;
}) {
  let committedState = createStateFromSourceSqlRepository({ overrides: stateOverrides, sourceSqlRepository });
  let commitCount = 0;
  let factoryCallCount = 0;
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
          rollback: () => undefined
        };
      },
      pool
    });

    return createPeriodCloseServiceAtomicCommitBoundaryContract({ atomicBridge });
  }

  return {
    createServiceBoundary,
    readCommittedState: () => clonePeriodClosePersistentState(committedState),
    readFactoryState: () => ({
      commitCount,
      factoryCallCount,
      uniquePoolCount: new Set(pools).size
    })
  };
}

function createRuntimeFixture({
  readinessPackage = createReadyProductionReadinessPackage(),
  sourceSqlRepository,
  stateOverrides
}: {
  readinessPackage?: PeriodClosePostgresRuntimeReadinessPackage;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  stateOverrides?: Partial<PeriodClosePersistentState>;
}) {
  const { loadPgModule, readState: readPgState } = createFakePgModule();
  const { createServiceBoundary, readCommittedState, readFactoryState } = createManagedPoolServiceBoundaryFactory({
    sourceSqlRepository,
    stateOverrides
  });
  const secretResolver = createPeriodClosePostgresSecretResolverContract({
    now: '2026-07-05T12:00:00.000Z',
    secretStore: createSecretStore()
  });
  const runtime = createPeriodClosePostgresManagedServicePoolRuntimeContract({
    createServiceBoundary,
    loadPgModule,
    secretResolver
  });
  const capturedResults: CapturedManagedRuntimeResult[] = [];
  const capturingRuntime: PeriodClosePostgresManagedServicePoolRuntimeContract = {
    closeAccountingPeriod: runtime.closeAccountingPeriod,
    guardSourceMutation: async (input) => {
      const result = await runtime.guardSourceMutation(input);

      capturedResults.push(result);

      return result;
    },
    readEvents: () => runtime.readEvents(),
    shutdown: (input) => runtime.shutdown(input)
  };

  return {
    admission: createAdmissionInput(readinessPackage),
    readCapturedResults: () => capturedResults.map((result) => result),
    readCommittedState,
    readFactoryState,
    readPgState,
    runtime: capturingRuntime
  };
}

function createHeaders(scopes: string) {
  return {
    'x-actor-id': 'user-001',
    'x-actor-name': '李明',
    'x-permission-scopes': scopes,
    'x-request-time': '2026-07-05T12:00:00+08:00'
  };
}

function createSourceAdjustmentRequest(
  requestId: string,
  overrides: Partial<FinanceHttpApiRepositoryGatewayRequest> = {}
): FinanceHttpApiRepositoryGatewayRequest {
  return {
    body: {
      amount: '1500.00',
      expectedVersion: 1,
      status: '已调整',
      targetAccountingPeriod: '2026-06'
    },
    headers: {
      ...createHeaders('finance.receivablePayable.write'),
      'x-request-id': requestId
    },
    method: 'PATCH',
    path: '/api/finance/receivables-payables/source-managed-bridge-001/adjust',
    ...overrides
  };
}

function assertCapturedRuntimeTraces(results: readonly CapturedManagedRuntimeResult[]) {
  for (const result of results) {
    const errors = validatePeriodClosePostgresManagedServicePoolRuntimeTrace(result);

    assertEqual(errors.length, 0, `managed runtime trace should validate: ${errors.join('; ')}`);
  }
}

function assertBridgeTrace({
  delegated,
  response,
  writeback
}: {
  delegated: boolean;
  response: FinanceHttpPostgresManagedSourceMutationBridgeResponse;
  writeback: boolean;
}) {
  const errors = validateFinanceHttpPostgresManagedSourceMutationBridgeTrace({
    delegated,
    trace: response.trace,
    writeback
  });

  assertEqual(errors.length, 0, `managed source mutation bridge trace should validate: ${errors.join('; ')}`);
}

const tests: UnitTest[] = [
  {
    name: 'rejects invalid source mutation payload before managed runtime and source SQL writeback',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:01:00+08:00',
        initialRows: [createSqlRow()]
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationBridge({
        admission: fixture.admission,
        request: createSourceAdjustmentRequest('req-managed-source-invalid-payload', {
          body: {
            amount: 1500,
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          }
        }),
        runtime: fixture.runtime,
        sourceSqlRepository
      });

      assertEqual(response.status, 400, 'invalid source mutation payload should reject');
      assertEqual(bodyAsRecord(response).code, 'INVALID_REQUEST', 'invalid payload should use stable error code');
      assertEqual(response.managedRuntime, undefined, 'invalid payload should not expose runtime evidence');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'invalid payload should keep SQL amount');
      assertEqual(fixture.readPgState().constructCount, 0, 'invalid payload should not construct managed pg pool');
      assertEqual(fixture.readCapturedResults().length, 0, 'invalid payload should not call managed runtime');
      assertBridgeTrace({ delegated: false, response, writeback: false });
    }
  },
  {
    name: 'rejects unauthorized source mutation before managed runtime and source SQL writeback',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:02:00+08:00',
        initialRows: [createSqlRow()]
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationBridge({
        admission: fixture.admission,
        request: createSourceAdjustmentRequest('req-managed-source-unauthorized', {
          headers: {
            ...createHeaders(''),
            'x-request-id': 'req-managed-source-unauthorized'
          }
        }),
        runtime: fixture.runtime,
        sourceSqlRepository
      });

      assertEqual(response.status, 403, 'unauthorized source mutation should reject');
      assertEqual(bodyAsRecord(response).code, 'FORBIDDEN', 'unauthorized source mutation should use forbidden code');
      assertEqual(response.managedRuntime, undefined, 'unauthorized source mutation should not expose runtime evidence');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'unauthorized source mutation should keep SQL version');
      assertEqual(fixture.readPgState().constructCount, 0, 'unauthorized source mutation should not construct managed pg pool');
      assertEqual(fixture.readCapturedResults().length, 0, 'unauthorized source mutation should not call managed runtime');
      assertBridgeTrace({ delegated: false, response, writeback: false });
    }
  },
  {
    name: 'does not write source SQL rows when managed runtime readiness blocks the write route',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:03:00+08:00',
        initialRows: [createSqlRow()]
      });
      const operationalGate = buildPeriodCloseMigrationOperationalGateContract();
      const readinessPackage = buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
        operationalGate
      });
      const fixture = createRuntimeFixture({ readinessPackage, sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationBridge({
        admission: fixture.admission,
        request: createSourceAdjustmentRequest('req-managed-source-readiness-blocked'),
        runtime: fixture.runtime,
        sourceSqlRepository
      });

      assertEqual(response.status, 503, 'blocked readiness should return service unavailable');
      assertEqual(bodyAsRecord(response).code, 'POSTGRES_RUNTIME_UNAVAILABLE', 'blocked readiness should expose runtime unavailable code');
      assertEqual(response.managedRuntime?.status, 'readiness_blocked', 'response should preserve managed runtime readiness status');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'blocked readiness should keep SQL amount');
      assertEqual(fixture.readPgState().constructCount, 0, 'blocked readiness should not construct managed pg pool');
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertBridgeTrace({ delegated: true, response, writeback: false });
    }
  },
  {
    name: 'writes source SQL rows only after open-period managed runtime commit',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:04:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '800.00',
            status: '待调整',
            version: 2
          })
        ]
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationBridge({
        admission: fixture.admission,
        request: createSourceAdjustmentRequest('req-managed-source-open', {
          body: {
            amount: '1200.00',
            expectedVersion: 2,
            status: '已调整',
            targetAccountingPeriod: '2026-06'
          }
        }),
        runtime: fixture.runtime,
        sourceSqlRepository
      });

      assertEqual(response.status, 200, 'open-period source mutation should pass');
      assertEqual(response.managedRuntime?.status, 'committed', 'open-period source mutation should commit runtime work');
      assertEqual(response.sourceSqlRows[0]?.amount, '1200.00', 'open-period bridge should write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.status, '已调整', 'open-period bridge should write SQL status');
      assertEqual(response.sourceSqlRows[0]?.version, 3, 'open-period bridge should bump SQL version after commit');
      assertEqual(fixture.readPgState().constructCount, 1, 'open-period bridge should construct one managed pg pool');
      assertEqual(fixture.readFactoryState().commitCount, 1, 'open-period bridge should commit once before SQL writeback');
      assertEqual(fixture.readCommittedState().sourceRecords[0]?.amount, '1200.00', 'committed state should contain source change');
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertBridgeTrace({ delegated: true, response, writeback: true });
    }
  },
  {
    name: 'keeps source SQL rows unchanged when closed-period guard commits only rejection audit',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:05:00+08:00',
        initialRows: [createSqlRow({ amount: '3200.00', version: 4 })]
      });
      const fixture = createRuntimeFixture({
        sourceSqlRepository,
        stateOverrides: {
          closeCheckSnapshots: [createCloseSnapshot()],
          periods: [createClosedPeriod(), createPeriod({ period: '2026-07' })]
        }
      });
      const response = await handleFinanceHttpPostgresManagedSourceMutationBridge({
        admission: fixture.admission,
        request: createSourceAdjustmentRequest('req-managed-source-closed', {
          body: {
            amount: '3600.00',
            expectedVersion: 4,
            targetAccountingPeriod: '2026-06'
          }
        }),
        runtime: fixture.runtime,
        sourceSqlRepository
      });

      assertEqual(response.status, 409, 'closed-period source mutation should reject');
      assertEqual(bodyAsRecord(response).code, canonicalClosedAccountingPeriodErrorCode, 'closed-period rejection code should match');
      assertEqual(response.managedRuntime?.status, 'committed', 'closed-period guard audit should commit atomically');
      assertEqual(response.sourceSqlRows[0]?.amount, '3200.00', 'closed-period bridge should not write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.version, 4, 'closed-period bridge should not bump SQL version');
      assertEqual(fixture.readFactoryState().commitCount, 1, 'closed-period rejection audit should publish one service commit');
      assertEqual(
        fixture.readCommittedState().sourceMutationEvents.length,
        1,
        'closed-period rejection should persist one guard audit event inside service state'
      );
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertBridgeTrace({ delegated: true, response, writeback: false });
    }
  },
  {
    name: 'inserts create-type source SQL row only after managed runtime commit',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:06:00+08:00',
        initialRows: []
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationBridge({
        admission: fixture.admission,
        request: {
          body: {
            amount: '2100.00',
            sourceId: 'invoice-managed-bridge-create',
            sourceNo: 'INV-MANAGED-BRIDGE-CREATE',
            targetAccountingPeriod: '2026-06'
          },
          headers: {
            ...createHeaders('finance.invoiceLedger.write'),
            'x-request-id': 'req-managed-source-create'
          },
          method: 'POST',
          path: '/api/finance/invoices/import'
        },
        runtime: fixture.runtime,
        sourceSqlRepository
      });

      assertEqual(response.status, 201, 'create-type bridge should return created');
      assertEqual(response.managedRuntime?.status, 'committed', 'create-type bridge should commit runtime work');
      assertEqual(response.sourceSqlRows.length, 1, 'create-type bridge should insert one SQL row');
      assertEqual(
        response.sourceSqlRows[0]?.tableName,
        getDefaultFinanceSourceTableName('invoice_ledger'),
        'create-type bridge should insert into invoice-ledger SQL table'
      );
      assertEqual(response.sourceSqlRows[0]?.accounting_period, '2026-06', 'create-type bridge should persist target period');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'create-type bridge should start with version 1');
      assertEqual(fixture.readFactoryState().commitCount, 1, 'create-type bridge should commit before SQL writeback');
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertBridgeTrace({ delegated: true, response, writeback: true });
    }
  }
];

for (const test of tests) {
  await test.run();
}
