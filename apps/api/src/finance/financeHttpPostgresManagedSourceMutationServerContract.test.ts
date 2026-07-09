import { request as createNodeHttpRequest } from 'node:http';

import type { FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import { createFinanceHttpPostgresManagedSourceMutationNodeServerContract } from './financeHttpPostgresManagedSourceMutationNodeServerContract.js';
import {
  createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
  validateFinanceHttpPostgresManagedSourceMutationFrameworkAdapterTrace,
  type FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';
import {
  handleFinanceHttpPostgresManagedSourceMutationServer,
  validateFinanceHttpPostgresManagedSourceMutationServerTrace,
  type FinanceHttpPostgresManagedSourceMutationServerResponse,
} from './financeHttpPostgresManagedSourceMutationServerContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import type { FinancePeriodClosePermissionScope } from './periodCloseAuthorizationContract.js';
import { createPeriodClosePostgresAtomicCommitBridgeContract } from './periodClosePostgresAtomicCommitBridgeContract.js';
import {
  createPeriodClosePostgresManagedServicePoolRuntimeContract,
  validatePeriodClosePostgresManagedServicePoolRuntimeTrace,
  type PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  type PeriodClosePostgresManagedServicePoolRuntimeContract,
  type PeriodClosePostgresManagedServicePoolRuntimeResult,
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import type {
  PeriodClosePostgresClientPort,
  PeriodClosePostgresPoolPort,
} from './periodClosePostgresClientPortContract.js';
import type { PeriodClosePostgresPackageManifest } from './periodClosePostgresDependencyAdmissionContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationBundleDescriptor,
} from './periodClosePostgresRuntimeImplementationBundleContract.js';
import {
  derivePeriodClosePostgresRuntimeReadiness,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import {
  createPeriodClosePostgresSecretResolverContract,
  type PeriodClosePostgresSecretRecord,
} from './periodClosePostgresSecretResolverContract.js';
import {
  createPeriodCloseServiceAtomicCommitBoundaryContract,
  type PeriodCloseServiceAtomicCommitBoundaryContract,
} from './periodCloseServiceAtomicCommitBoundaryContract.js';
import {
  canonicalClosedAccountingPeriodErrorCode,
  requiredCloseCheckCodes,
  type CloseCheckRow,
} from './periodCloseContract.js';
import {
  clonePeriodClosePersistentState,
  type PeriodClosePersistentState,
  type PersistentAccountingPeriodRecord,
  type PersistentFinanceSourceRecord,
  type PersistentSourceMutationResult,
} from './periodClosePersistenceContract.js';
import { createFinanceSourceTableSqlRepositoryContract } from './periodCloseSourceTableSqlRepositoryContract.js';
import type {
  FinanceSourceTableSqlRepositoryContract,
  FinanceSourceTableSqlRow,
} from './periodCloseSourceTableSqlRepositoryContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { getDefaultFinanceSourceTableName } from './periodCloseSourceTableRepositoryContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

type CapturedManagedRuntimeResult = PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>;

type NodeManagedSourceHttpClientResponse = {
  bodyText: string;
  headers: Record<string, string | readonly string[] | undefined>;
  status: number;
};

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

function bodyAsRecord(response: FinanceHttpPostgresManagedSourceMutationServerResponse) {
  assertObject(response.body, 'managed source mutation server response body should be an object');

  return response.body;
}

function parseBodyTextAsRecord(bodyText: string, message: string) {
  const body = JSON.parse(bodyText) as unknown;

  assertObject(body, message);

  return body;
}

function sendManagedSourceHttpRequest({
  bodyText,
  headers,
  method,
  origin,
  path,
}: {
  bodyText?: string;
  headers?: Record<string, string | undefined>;
  method: string;
  origin: string;
  path: string;
}) {
  return new Promise<NodeManagedSourceHttpClientResponse>((resolve, reject) => {
    const clientRequest = createNodeHttpRequest(`${origin}${path}`, { headers, method }, (response) => {
      let responseBody = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        responseBody += String(chunk ?? '');
      });
      response.on('end', () => {
        resolve({
          bodyText: responseBody,
          headers: response.headers,
          status: response.statusCode ?? 0,
        });
      });
      response.on('error', (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });

    clientRequest.on('error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });

    if (bodyText) {
      clientRequest.write(bodyText);
    }

    clientRequest.end();
  });
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

function createReadyProductionReadinessPackage() {
  return {
    backupRestore: {
      backupEvidenceId: 'backup-restore-evidence-20260705',
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
      releaseOwner: 'release-owner',
      rollbackOwner: 'rollback-owner',
      status: 'assigned',
    },
    poolPolicy: {
      applicationName: 'startupmanage-period-close-http-managed-source-server-test',
      connectionTimeoutMs: 1_000,
      idleTimeoutMs: 10_000,
      maxConnections: 4,
      statementTimeoutMs: 5_000,
    },
    productionApplyApproval: {
      approvalEvidenceId: 'apply-approval-20260705',
      approvedBy: 'finance-owner',
      status: 'approved',
    },
    reviewedAt: '2026-07-05T04:40:00.000Z',
    reviewer: 'finance-http-postgres-managed-source-mutation-server-test',
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
  } as const;
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
      ...overrides,
    },
  ];
}

function createAdmissionInput(): PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput {
  const readinessPackage = createReadyProductionReadinessPackage();
  const readiness = derivePeriodClosePostgresRuntimeReadiness(readinessPackage);

  return {
    apiPackageManifest: {
      dependencies: {
        pg: '^8.22.0',
      },
      name: '@startupmanage/api',
    } satisfies PeriodClosePostgresPackageManifest,
    apiPackageManifestPath,
    lockfilePath,
    lockfileText: pgLockfile,
    readinessPackage,
    runtimeImplementationBundle: createRuntimeImplementationBundle(readiness.poolConfig!),
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
        },
      };
    }
  }

  return {
    loadPgModule: async () => ({ Pool }),
    readState: () => ({
      connectCount,
      constructCount,
      queries: queries.map((query) => ({ ...query, parameters: [...query.parameters] })),
      releaseCount,
    }),
  };
}

function createPeriod(overrides: Partial<PersistentAccountingPeriodRecord> = {}): PersistentAccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides,
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
    status: '已结账',
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
    summary: '通过',
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
      status: '平衡',
    },
  };
}

function createSqlRow(overrides: Partial<FinanceSourceTableSqlRow> = {}): FinanceSourceTableSqlRow {
  return {
    accounting_period: '2026-06',
    amount: '1000.00',
    id: 'source-managed-server-001',
    source_no: 'AR-202606-MANAGED-SERVER',
    status: '未结清',
    tableName: getDefaultFinanceSourceTableName('receivable_payable'),
    updated_at: '2026-07-06T10:50:00+08:00',
    version: 1,
    ...overrides,
  };
}

function createStateFromSourceSqlRepository({
  overrides = {},
  sourceSqlRepository,
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
    ...overrides,
  };
}

function createManagedPoolServiceBoundaryFactory({
  sourceSqlRepository,
  stateOverrides,
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
          initialState: clonePeriodClosePersistentState(committedState),
        });
        const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });

        return {
          clientRepository,
          commit: () => {
            committedState = clonePeriodClosePersistentState(repository.readState());
            commitCount += 1;
          },
          rollback: () => undefined,
        };
      },
      pool,
    });

    return createPeriodCloseServiceAtomicCommitBoundaryContract({ atomicBridge });
  }

  return {
    createServiceBoundary,
    readCommittedState: () => clonePeriodClosePersistentState(committedState),
    readFactoryState: () => ({
      commitCount,
      factoryCallCount,
      uniquePoolCount: new Set(pools).size,
    }),
  };
}

function createRuntimeFixture({
  sourceSqlRepository,
  stateOverrides,
}: {
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  stateOverrides?: Partial<PeriodClosePersistentState>;
}) {
  const { loadPgModule, readState: readPgState } = createFakePgModule();
  const { createServiceBoundary, readCommittedState, readFactoryState } = createManagedPoolServiceBoundaryFactory({
    sourceSqlRepository,
    stateOverrides,
  });
  const secretResolver = createPeriodClosePostgresSecretResolverContract({
    now: '2026-07-05T12:00:00.000Z',
    secretStore: createSecretStore(),
  });
  const runtime = createPeriodClosePostgresManagedServicePoolRuntimeContract({
    createServiceBoundary,
    loadPgModule,
    secretResolver,
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
    shutdown: (input) => runtime.shutdown(input),
  };

  return {
    admission: createAdmissionInput(),
    readCapturedResults: () => capturedResults.map((result) => result),
    readCommittedState,
    readFactoryState,
    readPgState,
    runtime: capturingRuntime,
  };
}

function createPrincipal(
  permissionScopes: readonly FinancePeriodClosePermissionScope[] = ['finance.receivablePayable.write'],
  resourceScopes: readonly string[] = ['finance.ledger:default-ledger'],
): FinanceHttpAuthenticatedPrincipal {
  return {
    actorSnapshot: { id: 'server-user-001', name: '服务端财务账号' },
    permissionScopes,
    resourceScopes: resourceScopes as FinanceHttpAuthenticatedPrincipal['resourceScopes'],
    status: 'active',
  };
}

function createSourceAdjustmentServerRequest(
  overrides: Partial<Parameters<typeof handleFinanceHttpPostgresManagedSourceMutationServer>[0]['request']> = {},
): Parameters<typeof handleFinanceHttpPostgresManagedSourceMutationServer>[0]['request'] {
  return {
    bodyText: JSON.stringify({
      amount: '1500.00',
      expectedVersion: 1,
      status: '已调整',
      targetAccountingPeriod: '2026-06',
    }),
    headers: {
      'content-type': 'application/json',
      'x-actor-id': 'forged-client-user',
      'x-finance-resource-scopes': 'finance.ledger:*',
      'x-permission-scopes': 'finance.receivablePayable.write',
    },
    method: 'PATCH',
    principal: createPrincipal(),
    receivedAt: '2026-07-05T12:00:00+08:00',
    requestId: 'req-managed-source-server',
    url: 'http://127.0.0.1:5173/api/finance/receivables-payables/source-managed-server-001/adjust?debug=true',
    ...overrides,
  };
}

function assertCapturedRuntimeTraces(results: readonly CapturedManagedRuntimeResult[]) {
  for (const result of results) {
    const errors = validatePeriodClosePostgresManagedServicePoolRuntimeTrace(result);

    assertEqual(errors.length, 0, `managed runtime trace should validate: ${errors.join('; ')}`);
  }
}

function assertServerTrace({
  delegated,
  response,
}: {
  delegated: boolean;
  response: FinanceHttpPostgresManagedSourceMutationServerResponse;
}) {
  const result = validateFinanceHttpPostgresManagedSourceMutationServerTrace({
    delegated,
    trace: response.trace,
  });

  assertEqual(result.errors.length, 0, `managed source mutation server trace should validate: ${result.errors.join('; ')}`);
}

function assertAdapterTrace(response: FinanceHttpPostgresManagedSourceMutationFrameworkResponse) {
  const result = validateFinanceHttpPostgresManagedSourceMutationFrameworkAdapterTrace(response);

  assertEqual(result.errors.length, 0, `managed source mutation framework adapter trace should validate: ${result.errors.join('; ')}`);
}

const tests: UnitTest[] = [
  {
    name: 'does not delegate non-finance routes into managed source mutation runtime',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:01:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({ method: 'GET', url: '/health' }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 404, 'non-finance route should not be handled as source mutation');
      assertEqual(response.handled, false, 'non-finance route should remain unhandled');
      assertEqual(fixture.readPgState().constructCount, 0, 'non-finance route should not construct managed pg pool');
      assertEqual(fixture.readCapturedResults().length, 0, 'non-finance route should not call managed runtime');
      assertServerTrace({ delegated: false, response });
    },
  },
  {
    name: 'rejects unsupported finance method before managed runtime',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:02:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({ method: 'GET' }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 405, 'GET source mutation should be rejected');
      assertEqual(fixture.readPgState().constructCount, 0, 'unsupported method should not construct managed pg pool');
      assertEqual(fixture.readCapturedResults().length, 0, 'unsupported method should not call managed runtime');
      assertServerTrace({ delegated: false, response });
    },
  },
  {
    name: 'rejects missing server principal and ignores client-forged finance headers',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:03:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({ principal: undefined }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 401, 'missing server principal should reject');
      assertEqual(bodyAsRecord(response).code, 'UNAUTHENTICATED', 'missing principal should use stable error code');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'missing principal should not write source SQL rows');
      assertEqual(fixture.readCapturedResults().length, 0, 'missing principal should not call managed runtime');
      assertServerTrace({ delegated: false, response });
    },
  },
  {
    name: 'rejects missing ledger resource scope before managed runtime',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:04:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({
          principal: createPrincipal(['finance.receivablePayable.write'], []),
        }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 403, 'missing ledger resource scope should reject');
      assertEqual(bodyAsRecord(response).code, 'FORBIDDEN', 'missing ledger scope should use forbidden code');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'missing ledger scope should not write SQL amount');
      assertEqual(fixture.readCapturedResults().length, 0, 'missing ledger scope should not call managed runtime');
      assertServerTrace({ delegated: false, response });
    },
  },
  {
    name: 'rejects invalid JSON before managed runtime and source SQL writeback',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:05:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({ bodyText: '{bad json' }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 400, 'invalid JSON should reject');
      assertEqual(bodyAsRecord(response).code, 'INVALID_JSON_REQUEST', 'invalid JSON should use stable error code');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'invalid JSON should not write SQL amount');
      assertEqual(fixture.readCapturedResults().length, 0, 'invalid JSON should not call managed runtime');
      assertServerTrace({ delegated: false, response });
    },
  },
  {
    name: 'does not allow forged permission headers to bypass server-owned principal scopes',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:06:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({
          principal: createPrincipal([], ['finance.ledger:default-ledger']),
        }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 403, 'empty server principal permission should reject even with forged client header');
      assertEqual(bodyAsRecord(response).code, 'FORBIDDEN', 'empty server permission should use forbidden code');
      assertEqual(response.sourceBridge?.status, 403, 'forged permission should be rejected by source bridge after trusted header overwrite');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'forged permission should not write source SQL rows');
      assertEqual(fixture.readCapturedResults().length, 0, 'forged permission should not call managed runtime');
      assertServerTrace({ delegated: true, response });
    },
  },
  {
    name: 'writes source SQL rows only after open-period managed runtime commit through server chain',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:07:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '800.00',
            status: '待调整',
            version: 2,
          }),
        ],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({
          bodyText: JSON.stringify({
            amount: '1200.00',
            expectedVersion: 2,
            status: '已调整',
            targetAccountingPeriod: '2026-06',
          }),
          requestId: 'req-managed-source-server-open',
        }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 200, 'open-period server source mutation should pass');
      assertEqual(response.sourceBridge?.status, 200, 'server chain should delegate to bridge successfully');
      assertEqual(response.sourceSqlRows[0]?.amount, '1200.00', 'server chain should write SQL amount after commit');
      assertEqual(response.sourceSqlRows[0]?.status, '已调整', 'server chain should write SQL status after commit');
      assertEqual(response.sourceSqlRows[0]?.version, 3, 'server chain should bump SQL version after commit');
      assertEqual(fixture.readPgState().constructCount, 1, 'server chain should construct one managed pg pool');
      assertEqual(fixture.readFactoryState().commitCount, 1, 'server chain should commit once before SQL writeback');
      assertEqual(
        fixture.readCommittedState().sourceMutationEvents[0]?.actorSnapshot.id,
        'server-user-001',
        'server chain should use server principal actor instead of forged client header',
      );
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertServerTrace({ delegated: true, response });
    },
  },
  {
    name: 'keeps SQL rows unchanged when closed-period guard commits only rejection audit through server chain',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:08:00+08:00',
        initialRows: [createSqlRow({ amount: '3200.00', version: 4 })],
      });
      const fixture = createRuntimeFixture({
        sourceSqlRepository,
        stateOverrides: {
          closeCheckSnapshots: [createCloseSnapshot()],
          periods: [createClosedPeriod(), createPeriod({ period: '2026-07' })],
        },
      });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({
          bodyText: JSON.stringify({
            amount: '3600.00',
            expectedVersion: 4,
            targetAccountingPeriod: '2026-06',
          }),
          requestId: 'req-managed-source-server-closed',
        }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 409, 'closed-period server source mutation should reject');
      assertEqual(bodyAsRecord(response).code, canonicalClosedAccountingPeriodErrorCode, 'closed-period rejection code should match');
      assertEqual(response.sourceSqlRows[0]?.amount, '3200.00', 'closed-period server chain should not write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.version, 4, 'closed-period server chain should not bump SQL version');
      assertEqual(fixture.readFactoryState().commitCount, 1, 'closed-period rejection audit should still commit once');
      assertEqual(
        fixture.readCommittedState().sourceMutationEvents[0]?.actorSnapshot.id,
        'server-user-001',
        'closed-period rejection audit should use server principal actor',
      );
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertServerTrace({ delegated: true, response });
    },
  },
  {
    name: 'inserts create-type invoice SQL row after managed runtime commit through server chain',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:09:00+08:00',
        initialRows: [],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission: fixture.admission,
        request: createSourceAdjustmentServerRequest({
          bodyText: JSON.stringify({
            amount: '2100.00',
            sourceId: 'invoice-managed-server-create',
            sourceNo: 'INV-MANAGED-SERVER-CREATE',
            targetAccountingPeriod: '2026-06',
          }),
          method: 'POST',
          principal: createPrincipal(['finance.invoiceLedger.write']),
          requestId: 'req-managed-source-server-create',
          url: '/api/finance/invoices/import',
        }),
        runtime: fixture.runtime,
        sourceSqlRepository,
      });

      assertEqual(response.status, 201, 'create-type server source mutation should return created');
      assertEqual(response.sourceSqlRows.length, 1, 'create-type server chain should insert one SQL row');
      assertEqual(
        response.sourceSqlRows[0]?.tableName,
        getDefaultFinanceSourceTableName('invoice_ledger'),
        'create-type server chain should insert invoice-ledger SQL row',
      );
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'create-type server chain should start SQL version at 1');
      assertEqual(fixture.readFactoryState().commitCount, 1, 'create-type server chain should commit before SQL writeback');
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertServerTrace({ delegated: true, response });
    },
  },
  {
    name: 'framework adapter maps object body path query identity and writes response after managed source commit',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:10:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      let capturedIdentityRequest:
        | Parameters<
            Parameters<typeof createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter>[0]['resolvePrincipal']
          >[0]
        | undefined;
      const adapter = createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter({
        admission: fixture.admission,
        frameworkName: 'express-like-managed-source-test',
        now: () => '2026-07-05T13:00:00+08:00',
        requestIdFactory: () => 'req-framework-managed-source-open',
        resolvePrincipal: (request) => {
          capturedIdentityRequest = request;

          return createPrincipal();
        },
        runtime: fixture.runtime,
        sourceSqlRepository,
      });
      const response = await adapter.handleConcreteFrameworkRequest({
        body: {
          amount: '1200.00',
          expectedVersion: 1,
          status: '已调整',
          targetAccountingPeriod: '2026-06',
        },
        headers: {
          authorization: ['Bearer local-token'],
          'content-type': 'application/json',
          'x-actor-id': 'forged-framework-user',
          'x-permission-scopes': 'finance.receivablePayable.write',
        },
        method: 'PATCH',
        path: 'api/finance/receivables-payables/source-managed-server-001/adjust',
        query: {
          debug: true,
          repeated: ['a', 'b'],
        },
      });

      assertEqual(response.status, 200, 'framework adapter source mutation should pass');
      assertEqual(response.adapterTrace.frameworkName, 'express-like-managed-source-test', 'adapter trace should carry framework name');
      assertEqual(
        response.adapterTrace.url,
        '/api/finance/receivables-payables/source-managed-server-001/adjust?debug=true&repeated=a&repeated=b',
        'adapter should serialize path and query into server URL',
      );
      assertEqual(capturedIdentityRequest?.authorization, 'Bearer local-token', 'adapter should normalize authorization for resolver');
      assertEqual(capturedIdentityRequest?.method, 'PATCH', 'adapter should pass upper-case method to resolver');
      assertEqual(response.sourceSqlRows[0]?.amount, '1200.00', 'framework adapter should write SQL amount after managed commit');
      assertEqual(response.sourceSqlRows[0]?.version, 2, 'framework adapter should bump SQL version after managed commit');
      assertEqual(fixture.readFactoryState().commitCount, 1, 'framework adapter should commit through managed runtime');
      assertEqual(
        fixture.readCommittedState().sourceMutationEvents[0]?.actorSnapshot.id,
        'server-user-001',
        'framework adapter should use resolved server principal instead of forged headers',
      );
      assertCapturedRuntimeTraces(fixture.readCapturedResults());
      assertServerTrace({ delegated: true, response });
      assertAdapterTrace(response);

      const writerOutput: {
        bodyText?: string;
        headers: Record<string, string>;
        status?: number;
      } = { headers: {} };
      adapter.writeConcreteFrameworkResponse(
        {
          send: (bodyText) => {
            writerOutput.bodyText = bodyText;
          },
          setHeader: (name, value) => {
            writerOutput.headers[name] = value;
          },
          status: (status) => {
            writerOutput.status = status;

            return undefined;
          },
        },
        response,
      );

      assertEqual(writerOutput.status, 200, 'framework writer should receive response status');
      assertEqual(
        writerOutput.headers['content-type'],
        'application/json; charset=utf-8',
        'framework writer should receive JSON content type',
      );
      assertEqual(writerOutput.bodyText, response.bodyText, 'framework writer should send response body text');
    },
  },
  {
    name: 'framework adapter rejects oversized body before identity resolution and managed runtime',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:11:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      let resolveCount = 0;
      const adapter = createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter({
        admission: fixture.admission,
        maxBodyBytes: 5,
        requestIdFactory: () => 'req-framework-body-too-large',
        resolvePrincipal: () => {
          resolveCount += 1;

          return createPrincipal();
        },
        runtime: fixture.runtime,
        sourceSqlRepository,
      });
      const response = await adapter.handleConcreteFrameworkRequest({
        bodyText: JSON.stringify({
          amount: '1200.00',
          expectedVersion: 1,
          targetAccountingPeriod: '2026-06',
        }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/source-managed-server-001/adjust',
      });

      assertEqual(response.status, 413, 'oversized source mutation request should reject at adapter');
      assertEqual(bodyAsRecord(response).code, 'PAYLOAD_TOO_LARGE', 'oversized body should use stable code');
      assertEqual(response.adapterTrace.delegatedToServerEntry, false, 'oversized body should not delegate to server entry');
      assertEqual(response.trace.length, 0, 'oversized body should not have server trace');
      assertEqual(resolveCount, 0, 'oversized body should not resolve identity');
      assertEqual(fixture.readCapturedResults().length, 0, 'oversized body should not call managed runtime');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'oversized body should not write SQL rows');
      assertAdapterTrace(response);
    },
  },
  {
    name: 'framework adapter delegates missing resolved principal to server-entry authentication rejection',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:12:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const adapter = createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter({
        admission: fixture.admission,
        requestIdFactory: () => 'req-framework-missing-principal',
        resolvePrincipal: () => undefined,
        runtime: fixture.runtime,
        sourceSqlRepository,
      });
      const response = await adapter.handleConcreteFrameworkRequest({
        body: {
          amount: '1200.00',
          expectedVersion: 1,
          targetAccountingPeriod: '2026-06',
        },
        headers: {
          'content-type': 'application/json',
          'x-permission-scopes': 'finance.receivablePayable.write',
        },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/source-managed-server-001/adjust',
      });

      assertEqual(response.status, 401, 'missing resolved principal should reject in server entry');
      assertEqual(bodyAsRecord(response).code, 'UNAUTHENTICATED', 'missing resolved principal should use stable code');
      assertEqual(response.adapterTrace.delegatedToServerEntry, true, 'missing principal should still prove server-entry delegation');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'missing principal should not write SQL rows');
      assertEqual(fixture.readCapturedResults().length, 0, 'missing principal should not call managed runtime');
      assertServerTrace({ delegated: false, response });
      assertAdapterTrace(response);
    },
  },
  {
    name: 'node listener accepts real HTTP request and writes SQL after managed source commit',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:13:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const adapter = createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter({
        admission: fixture.admission,
        frameworkName: 'node-managed-source-listener-test',
        now: () => '2026-07-05T14:00:00+08:00',
        requestIdFactory: () => 'req-node-managed-source-open',
        resolvePrincipal: (request) =>
          request.authorization === 'Bearer node-managed-source-token' ? createPrincipal() : undefined,
        runtime: fixture.runtime,
        sourceSqlRepository,
      });
      const server = await createFinanceHttpPostgresManagedSourceMutationNodeServerContract({ adapter }).listen();

      try {
        const response = await sendManagedSourceHttpRequest({
          bodyText: JSON.stringify({
            amount: '1300.00',
            expectedVersion: 1,
            status: '已调整',
            targetAccountingPeriod: '2026-06',
          }),
          headers: {
            authorization: 'Bearer node-managed-source-token',
            'content-type': 'application/json',
            'x-actor-id': 'forged-node-user',
            'x-permission-scopes': 'finance.receivablePayable.write',
          },
          method: 'PATCH',
          origin: server.origin,
          path: '/api/finance/receivables-payables/source-managed-server-001/adjust?via=node',
        });
        const body = parseBodyTextAsRecord(
          response.bodyText,
          'node listener success response body should parse as object',
        );

        assertEqual(response.status, 200, 'node listener source mutation should pass');
        assertEqual(
          response.headers['x-finance-local-managed-source-server-handled'],
          'true',
          'node listener should mark request as handled',
        );
        assertEqual(
          response.headers['x-finance-local-managed-source-server-delegated'],
          'true',
          'node listener should mark request as delegated to server entry',
        );
        assertEqual(body.status, '已调整', 'node listener response body should expose updated source status');
        assertEqual(
          sourceSqlRepository.readSqlRows()[0]?.amount,
          '1300.00',
          'node listener should write SQL amount after managed commit',
        );
        assertEqual(
          sourceSqlRepository.readSqlRows()[0]?.version,
          2,
          'node listener should bump SQL version after managed commit',
        );
        assertEqual(fixture.readFactoryState().commitCount, 1, 'node listener should commit runtime once');
        assertEqual(
          fixture.readCommittedState().sourceMutationEvents[0]?.actorSnapshot.id,
          'server-user-001',
          'node listener should use resolved server principal instead of forged headers',
        );
        assertCapturedRuntimeTraces(fixture.readCapturedResults());
      } finally {
        await server.close();
      }
    },
  },
  {
    name: 'node listener returns authentication rejection without SQL write when bearer is missing',
    run: async () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:14:00+08:00',
        initialRows: [createSqlRow()],
      });
      const fixture = createRuntimeFixture({ sourceSqlRepository });
      const adapter = createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter({
        admission: fixture.admission,
        frameworkName: 'node-managed-source-listener-auth-test',
        now: () => '2026-07-05T14:10:00+08:00',
        requestIdFactory: () => 'req-node-managed-source-unauthenticated',
        resolvePrincipal: (request) =>
          request.authorization === 'Bearer node-managed-source-token' ? createPrincipal() : undefined,
        runtime: fixture.runtime,
        sourceSqlRepository,
      });
      const server = await createFinanceHttpPostgresManagedSourceMutationNodeServerContract({ adapter }).listen();

      try {
        const response = await sendManagedSourceHttpRequest({
          bodyText: JSON.stringify({
            amount: '1300.00',
            expectedVersion: 1,
            status: '已调整',
            targetAccountingPeriod: '2026-06',
          }),
          headers: {
            'content-type': 'application/json',
          },
          method: 'PATCH',
          origin: server.origin,
          path: '/api/finance/receivables-payables/source-managed-server-001/adjust',
        });
        const body = parseBodyTextAsRecord(
          response.bodyText,
          'node listener authentication rejection body should parse as object',
        );

        assertEqual(response.status, 401, 'node listener missing bearer should reject');
        assertEqual(body.code, 'UNAUTHENTICATED', 'node listener authentication rejection should use stable code');
        assertEqual(
          response.headers['x-finance-local-managed-source-server-handled'],
          'true',
          'node listener should mark authentication rejection as handled',
        );
        assertEqual(
          response.headers['x-finance-local-managed-source-server-delegated'],
          'true',
          'node listener should still prove server-entry delegation for authentication rejection',
        );
        assertEqual(
          sourceSqlRepository.readSqlRows()[0]?.amount,
          '1000.00',
          'node listener authentication rejection should not write SQL amount',
        );
        assertEqual(
          sourceSqlRepository.readSqlRows()[0]?.version,
          1,
          'node listener authentication rejection should not bump SQL version',
        );
        assertEqual(
          fixture.readCapturedResults().length,
          0,
          'node listener authentication rejection should not call managed runtime',
        );
      } finally {
        await server.close();
      }
    },
  },
];

for (const test of tests) {
  await test.run();
}
