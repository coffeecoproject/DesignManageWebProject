import {
  handleFinanceHttpPostgresManagedRuntimeGateway,
  type FinanceHttpPostgresManagedRuntimeGatewayResponse
} from './financeHttpPostgresManagedRuntimeGatewayContract.js';
import type { FinanceHttpApiRepositoryGatewayRequest } from './financeHttpApiRepositoryGatewayContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import { buildPeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';
import {
  type PeriodClosePostgresClientPort,
  type PeriodClosePostgresPoolPort
} from './periodClosePostgresClientPortContract.js';
import type { PeriodClosePostgresPackageManifest } from './periodClosePostgresDependencyAdmissionContract.js';
import {
  createPeriodClosePostgresManagedServicePoolRuntimeContract,
  validatePeriodClosePostgresManagedServicePoolRuntimeTrace,
  type PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  type PeriodClosePostgresManagedServicePoolRuntimeContract,
  type PeriodClosePostgresManagedServicePoolRuntimeResult
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import { createPeriodClosePostgresAtomicCommitBridgeContract } from './periodClosePostgresAtomicCommitBridgeContract.js';
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
  requiredCloseCheckCodes,
  type CloseCheckRow
} from './periodCloseContract.js';
import {
  clonePeriodClosePersistentState,
  type PeriodClosePersistentState,
  type PersistentAccountingPeriodRecord,
  type PersistentCloseAccountingPeriodResult,
  type PersistentFinanceSourceRecord,
  type PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

type CapturedManagedRuntimeResult =
  | PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentCloseAccountingPeriodResult>
  | PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>;

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

function assertManagedRuntime(
  response: FinanceHttpPostgresManagedRuntimeGatewayResponse
): NonNullable<FinanceHttpPostgresManagedRuntimeGatewayResponse['managedRuntime']> {
  if (!response.managedRuntime) {
    throw new Error('response should include managed runtime evidence');
  }

  return response.managedRuntime;
}

function bodyAsRecord(response: FinanceHttpPostgresManagedRuntimeGatewayResponse) {
  return response.body as Record<string, unknown>;
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
      applicationName: 'startupmanage-period-close-http-managed-runtime-test',
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
    reviewer: 'finance-http-postgres-managed-runtime-gateway-test',
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
        sourceVersionSetHash: 'src_hash_http_managed_runtime_202606',
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
    periods: [createPeriod()],
    sourceMutationEvents: [],
    sourceRecords: [createSourceRecord()],
    ...overrides
  };
}

function createManagedPoolServiceBoundaryFactory() {
  let committedState = createState();
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
    readCommittedSnapshot: () =>
      createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-05T12:00:00+08:00',
        initialState: clonePeriodClosePersistentState(committedState)
      }).readDatabaseSnapshot(),
    readFactoryState: () => ({
      commitCount,
      factoryCallCount,
      uniquePoolCount: new Set(pools).size
    })
  };
}

function createRuntimeFixture({
  readinessPackage = createReadyProductionReadinessPackage()
}: {
  readinessPackage?: PeriodClosePostgresRuntimeReadinessPackage;
} = {}) {
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
  const capturedResults: CapturedManagedRuntimeResult[] = [];
  const capturingRuntime: PeriodClosePostgresManagedServicePoolRuntimeContract = {
    closeAccountingPeriod: async (input) => {
      const result = await runtime.closeAccountingPeriod(input);

      capturedResults.push(result);

      return result;
    },
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
    readCommittedSnapshot,
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

function createCloseRequest({
  requestId,
  scopes = 'finance.accountingPeriod.close'
}: {
  requestId: string;
  scopes?: string;
}): FinanceHttpApiRepositoryGatewayRequest {
  return {
    body: {
      idempotencyKey: `idem-${requestId}`,
      reason: '月末结账',
      version: 1
    },
    headers: {
      ...createHeaders(scopes),
      'x-request-id': requestId
    },
    method: 'POST',
    path: '/api/finance/accounting-periods/2026-06/close'
  };
}

function createSourceAdjustmentRequest(requestId: string): FinanceHttpApiRepositoryGatewayRequest {
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
    path: '/api/finance/receivables-payables/source-001/adjust'
  };
}

function assertCapturedRuntimeTraces(results: readonly CapturedManagedRuntimeResult[]) {
  for (const result of results) {
    const errors =
      result.operation === 'close_accounting_period'
        ? validatePeriodClosePostgresManagedServicePoolRuntimeTrace(
            result as PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentCloseAccountingPeriodResult>
          )
        : validatePeriodClosePostgresManagedServicePoolRuntimeTrace(
            result as PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>
          );

    assertEqual(errors.length, 0, `managed runtime trace should validate: ${errors.join('; ')}`);
  }
}

const tests: UnitTest[] = [
  {
    name: 'rejects unauthorized close request before managed runtime admission',
    run: async () => {
      const fixture = createRuntimeFixture();
      const response = await handleFinanceHttpPostgresManagedRuntimeGateway({
        admission: fixture.admission,
        request: createCloseRequest({ requestId: 'req-http-managed-runtime-unauthorized', scopes: '' }),
        runtime: fixture.runtime
      });

      assertEqual(response.status, 403, 'unauthorized HTTP close request should be rejected');
      assertEqual(response.managedRuntime, undefined, 'unauthorized response must not expose runtime work');
      assertEqual(fixture.readPgState().constructCount, 0, 'unauthorized request must not construct managed pool');
      assertEqual(fixture.readCapturedResults().length, 0, 'unauthorized request must not call runtime methods');
    }
  },
  {
    name: 'returns managed runtime evidence when operational readiness blocks the write route',
    run: async () => {
      const operationalGate = buildPeriodCloseMigrationOperationalGateContract();
      const readinessPackage = buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
        operationalGate
      });
      const fixture = createRuntimeFixture({ readinessPackage });
      const response = await handleFinanceHttpPostgresManagedRuntimeGateway({
        admission: fixture.admission,
        request: createCloseRequest({ requestId: 'req-http-managed-runtime-readiness-blocked' }),
        runtime: fixture.runtime
      });
      const managedRuntime = assertManagedRuntime(response);

      assertEqual(response.status, 503, 'blocked readiness should return service unavailable at HTTP boundary');
      assertEqual(bodyAsRecord(response).code, 'POSTGRES_RUNTIME_UNAVAILABLE', 'blocked readiness should expose runtime unavailable code');
      assertEqual(managedRuntime.status, 'readiness_blocked', 'response should preserve managed runtime readiness status');
      assertEqual(managedRuntime.poolLifecycleState, 'not_initialized', 'blocked readiness should not initialize pool');
      assertEqual(fixture.readPgState().constructCount, 0, 'blocked readiness must not construct managed pool');
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
    }
  },
  {
    name: 'rejects invalid source mutation payload before managed runtime admission',
    run: async () => {
      const fixture = createRuntimeFixture();
      const response = await handleFinanceHttpPostgresManagedRuntimeGateway({
        admission: fixture.admission,
        request: {
          body: {
            amount: 1500,
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          headers: {
            ...createHeaders('finance.receivablePayable.write'),
            'x-request-id': 'req-http-managed-runtime-invalid-source-payload'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/source-001/adjust'
        },
        runtime: fixture.runtime
      });

      assertEqual(response.status, 400, 'invalid source payload should return bad request');
      assertEqual(bodyAsRecord(response).code, 'INVALID_REQUEST', 'invalid source payload should use stable error code');
      assertEqual(response.managedRuntime, undefined, 'invalid source payload must not expose runtime work');
      assertEqual(fixture.readPgState().constructCount, 0, 'invalid source payload must not construct managed pool');
      assertEqual(fixture.readCapturedResults().length, 0, 'invalid source payload must not call runtime methods');
    }
  },
  {
    name: 'routes authorized HTTP close and source mutation through one reused managed pool',
    run: async () => {
      const fixture = createRuntimeFixture();
      const closeResponse = await handleFinanceHttpPostgresManagedRuntimeGateway({
        admission: fixture.admission,
        request: createCloseRequest({ requestId: 'req-http-managed-runtime-close' }),
        runtime: fixture.runtime
      });
      const sourceResponse = await handleFinanceHttpPostgresManagedRuntimeGateway({
        admission: fixture.admission,
        request: createSourceAdjustmentRequest('req-http-managed-runtime-closed-source-adjust'),
        runtime: fixture.runtime
      });
      const closeRuntime = assertManagedRuntime(closeResponse);
      const sourceRuntime = assertManagedRuntime(sourceResponse);
      const pgState = fixture.readPgState();
      const factoryState = fixture.readFactoryState();
      const committedSnapshot = fixture.readCommittedSnapshot();

      assertEqual(closeResponse.status, 201, 'HTTP close request should create a closed period result');
      assertEqual(bodyAsRecord(closeResponse).status, '已结账', 'close response should expose closed period status');
      assertEqual(closeRuntime.status, 'committed', 'close should commit through managed runtime');
      assertEqual(sourceResponse.status, 409, 'closed-period source mutation should return business conflict');
      assertEqual(sourceRuntime.status, 'committed', 'source guard rejection audit should still commit atomically');
      assertIncludes(sourceRuntime.runtimeEventNames, 'reuse_managed_pool', 'second HTTP write should reuse managed pool');
      assertEqual(pgState.constructCount, 1, 'HTTP write sequence should construct exactly one managed pg pool');
      assertEqual(pgState.connectCount, 2, 'both HTTP writes should acquire from the same managed pool');
      assertEqual(pgState.releaseCount, 2, 'both HTTP writes should release managed pool clients');
      assertEqual(factoryState.factoryCallCount, 2, 'runtime should create a request-scoped service boundary per HTTP write');
      assertEqual(factoryState.uniquePoolCount, 1, 'request-scoped service boundaries should share the managed pool adapter');
      assertEqual(factoryState.commitCount, 2, 'close and rejection audit should publish separate commits');
      assertEqual(
        committedSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period HTTP source mutation should persist a rejection audit event'
      );
      assertEqual(
        committedSnapshot.sourceRecords[0]?.amount,
        '1000.00',
        'closed-period source mutation must not alter the source record'
      );
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
    }
  }
];

for (const test of tests) {
  await test.run();
}
