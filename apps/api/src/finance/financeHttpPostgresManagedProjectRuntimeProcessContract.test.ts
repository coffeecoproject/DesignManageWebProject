import {
  createFinanceHttpPostgresManagedProjectRuntimeProcessContract,
  validateFinanceHttpPostgresManagedProjectRuntimeProcessSummary,
} from './financeHttpPostgresManagedProjectRuntimeProcessContract.js';
import {
  createFinanceHttpPostgresManagedProjectRuntimeNodeServerTraceHeaders,
} from './financeHttpPostgresManagedProjectRuntimeNodeServerContract.js';
import type { FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import type { FinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import {
  evaluatePeriodClosePostgresDependencyAdmission,
  type PeriodClosePostgresPackageManifest,
} from './periodClosePostgresDependencyAdmissionContract.js';
import {
  type PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  type PeriodClosePostgresManagedServicePoolRuntimeContract,
  type PeriodClosePostgresManagedServicePoolRuntimeResult,
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import {
  derivePeriodClosePostgresRuntimeReadiness,
  type PeriodClosePostgresRuntimeReadinessPackage,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationBundleDescriptor,
} from './periodClosePostgresRuntimeImplementationBundleContract.js';
import type {
  PeriodClosePersistentState,
  PersistentFinanceSourceRecord,
  PersistentSourceMutationResult,
} from './periodClosePersistenceContract.js';
import { getDefaultFinanceSourceTableName } from './periodCloseSourceTableRepositoryContract.js';
import {
  createFinanceSourceTableSqlRepositoryContract,
  type FinanceSourceTableSqlRow,
} from './periodCloseSourceTableSqlRepositoryContract.js';

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

function parseJson(bodyText: string) {
  return JSON.parse(bodyText) as { code?: string; sourceId?: string; status?: string; version?: number };
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

const apiPackageManifest = {
  dependencies: {
    pg: '^8.22.0',
  },
  name: '@startupmanage/api',
} satisfies PeriodClosePostgresPackageManifest;

function createReadyReadinessPackage(): PeriodClosePostgresRuntimeReadinessPackage {
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
      releaseOwner: 'release-owner',
      rollbackOwner: 'rollback-owner',
      status: 'assigned',
    },
    poolPolicy: {
      applicationName: 'startupmanage-period-close-project-runtime-process-production',
      connectionTimeoutMs: 1_000,
      idleTimeoutMs: 10_000,
      maxConnections: 4,
      statementTimeoutMs: 5_000,
    },
    productionApplyApproval: {
      approvalEvidenceId: 'production-apply-approval-20260705',
      approvedBy: 'finance-owner',
      status: 'approved',
    },
    reviewedAt: '2026-07-05T06:00:00.000Z',
    reviewer: 'project-runtime-process-test',
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

function createAdmissionInput(
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage,
): PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput {
  const readiness = derivePeriodClosePostgresRuntimeReadiness(readinessPackage);
  const fallbackReadiness = derivePeriodClosePostgresRuntimeReadiness(createReadyReadinessPackage());

  return {
    apiPackageManifest,
    apiPackageManifestPath,
    lockfilePath,
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

function createPrincipal(): FinanceHttpAuthenticatedPrincipal {
  return {
    actorSnapshot: {
      id: 'finance-user-001',
      name: '财务用户',
    },
    permissionScopes: ['finance.receivablePayable.write'],
    resourceScopes: ['finance.ledger:default-ledger'],
    status: 'active',
  };
}

function createSourceRow(overrides: Partial<FinanceSourceTableSqlRow> = {}): FinanceSourceTableSqlRow {
  return {
    accounting_period: '2026-06',
    amount: '1000.00',
    id: 'source-001',
    source_no: 'AR-202606-001',
    status: '未结清',
    tableName: getDefaultFinanceSourceTableName('receivable_payable'),
    version: 1,
    ...overrides,
  };
}

function createPersistentState(record: PersistentFinanceSourceRecord): PeriodClosePersistentState {
  return {
    checkInputs: {},
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [
      {
        period: '2026-06',
        status: '开放',
        version: 1,
      },
    ],
    sourceMutationEvents: [],
    sourceRecords: [record],
  };
}

function createSuccessRuntimeResult({
  admission,
  record,
  requestId,
}: {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  record: PersistentFinanceSourceRecord;
  requestId: string;
}): PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult> {
  const readiness = derivePeriodClosePostgresRuntimeReadiness(admission.readinessPackage);
  const dependencyAdmission = evaluatePeriodClosePostgresDependencyAdmission({
    apiPackageManifest: admission.apiPackageManifest,
    apiPackageManifestPath: admission.apiPackageManifestPath,
    lockfilePath: admission.lockfilePath,
    lockfileText: admission.lockfileText,
    runtimeEvidence: readiness.runtimeEvidence,
  });
  const mutationResult: PersistentSourceMutationResult = {
    event: {
      actorSnapshot: {
        id: 'finance-user-001',
        name: '财务用户',
      },
      affectedAccountingPeriods: ['2026-06'],
      eventType: 'source_mutation_applied',
      operation: '调整应收应付事项',
      requestId,
      sourceArea: record.sourceArea,
      sourceId: record.id,
      timestamp: '2026-07-05T06:10:00.000Z',
    },
    ok: true,
    record,
    state: createPersistentState(record),
  };

  return {
    adapterEvents: [],
    admissionErrors: [],
    configErrors: [],
    constructorErrors: [],
    dependencyAdmission,
    events: [
      {
        event: 'receive_request',
        operation: 'guard_source_mutation',
        period: '2026-06',
        requestId,
        sequence: 1,
        transactionId: `${requestId}:runtime`,
      },
      {
        event: 'return_response',
        operation: 'guard_source_mutation',
        period: '2026-06',
        requestId,
        sequence: 2,
        transactionId: `${requestId}:runtime`,
      },
    ],
    importErrors: [],
    operation: 'guard_source_mutation',
    period: '2026-06',
    poolLifecycleState: 'active',
    readiness,
    requestId,
    runtimeBundleErrors: [],
    runtimeImplementationBundle: admission.runtimeImplementationBundle,
    secretErrors: [],
    serviceResult: {
      atomicResult: {
        atomicEvents: [],
        clientEvents: [],
        driverExecutions: [],
        operation: 'guard_source_mutation',
        period: '2026-06',
        postgresResult: {
          events: [],
          executions: [],
          operation: 'closed_period_source_mutation_guard',
          ok: true,
          period: '2026-06',
          requestId,
          retryable: false,
          status: 'committed',
          traceErrors: [],
          transactionId: `${requestId}:runtime`,
        },
        repositoryResult: {
          driverOk: true,
          executions: [],
          result: {
            ok: true,
            snapshot: {
              checkInputs: {},
              periodCloseRows: {
                accounting_period_close_check_items: [],
                accounting_period_close_checks: [],
                accounting_period_events: [],
                accounting_period_idempotency_records: [],
                accounting_period_source_mutation_events: [],
                accounting_periods: [],
                financial_statement_general_ledger_lines: [],
                financial_statement_snapshot_lines: [],
                financial_statement_snapshots: [],
              },
              sourceRecords: [record],
            },
            value: mutationResult,
          },
        },
        requestId,
        status: 'committed',
        traceErrors: [],
        transactionId: `${requestId}:runtime`,
      },
      operation: 'guard_source_mutation',
      period: '2026-06',
      requestId,
      serviceEvents: [],
      status: 'committed',
      traceErrors: [],
      transactionId: `${requestId}:service`,
    },
    status: 'committed',
    traceErrors: [],
    transactionId: `${requestId}:runtime`,
  } as PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>;
}

function createFakeRuntime({
  admission,
}: {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
}) {
  let guardCallCount = 0;
  let shutdownCallCount = 0;

  const runtime: PeriodClosePostgresManagedServicePoolRuntimeContract = {
    closeAccountingPeriod: async () => {
      throw new Error('closeAccountingPeriod should not be called by project runtime process tests');
    },
    guardSourceMutation: async ({ context, mutation }) => {
      guardCallCount += 1;
      const record: PersistentFinanceSourceRecord = {
        accountingPeriod: mutation.targetAccountingPeriod,
        amount: mutation.amount ?? '1000.00',
        id: mutation.sourceId,
        sourceArea: mutation.sourceArea,
        sourceNo: mutation.sourceNo ?? 'AR-202606-001',
        status: mutation.status ?? '已调整',
        version: 2,
      };

      return createSuccessRuntimeResult({
        admission,
        record,
        requestId: context.requestId,
      });
    },
    readEvents: () => [],
    shutdown: async ({ requestId }) => {
      shutdownCallCount += 1;

      return {
        events: [
          {
            event: 'shutdown_managed_pool',
            operation: 'shutdown_runtime_pool',
            requestId,
            sequence: 1,
            transactionId: `${requestId}:shutdown`,
          },
        ],
        poolLifecycleState: 'closed',
        requestId,
        shutdownErrors: [],
        status: 'closed',
        traceErrors: [],
        transactionId: `${requestId}:shutdown`,
      };
    },
  };

  return {
    readCounts: () => ({ guardCallCount, shutdownCallCount }),
    runtime,
  };
}

function createFallbackHandler() {
  let callCount = 0;
  const handler: FinanceHttpServerHandler = {
    handleServerHandlerRequest: () => {
      callCount += 1;

      return {
        body: { code: 'FALLBACK_OK' },
        bodyText: JSON.stringify({ code: 'FALLBACK_OK' }),
        handled: true,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        status: 200,
      };
    },
  };

  return {
    handler,
    readCallCount: () => callCount,
  };
}

const tests: UnitTest[] = [
  {
    name: 'blocks project API server construction when runtime readiness is incomplete',
    run: async () => {
      const admission = createAdmissionInput(createBlockedReadinessPackage());
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T06:00:00.000Z',
        initialRows: [createSourceRow()],
      });
      const fakeRuntime = createFakeRuntime({ admission });
      const fallback = createFallbackHandler();
      const process = createFinanceHttpPostgresManagedProjectRuntimeProcessContract({
        admission,
        fallbackHandler: fallback.handler,
        resolvePrincipal: createPrincipal,
        runtime: fakeRuntime.runtime,
        sourceSqlRepository,
      });
      const summary = process.getProcessSummary();
      const validation = validateFinanceHttpPostgresManagedProjectRuntimeProcessSummary(summary);

      assertEqual(summary.lifecycleState, 'blocked_by_runtime_readiness', 'blocked readiness should stop startup');
      assertEqual(summary.projectApiServerConstructed, false, 'blocked readiness must not construct project API server');
      assertEqual(validation.ok, true, `blocked readiness summary should validate: ${validation.errors.join(', ')}`);

      const response = await process.handleConcreteFrameworkRequest({
        body: {
          amount: '1200.00',
          expectedVersion: 1,
          targetAccountingPeriod: '2026-06',
        },
        headers: {
          authorization: 'Bearer finance-user',
          'content-type': 'application/json',
        },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/source-001/adjust',
      });
      const body = parseJson(response.bodyText);

      assertEqual(response.status, 503, 'blocked readiness should reject framework requests');
      assertEqual(
        body.code,
        'FINANCE_PROJECT_RUNTIME_READINESS_BLOCKED',
        'blocked readiness should return runtime readiness code',
      );
      assertEqual(fakeRuntime.readCounts().guardCallCount, 0, 'blocked readiness must not call managed runtime');
      assertEqual(fallback.readCallCount(), 0, 'blocked readiness must not call fallback handler');
    },
  },
  {
    name: 'delegates active source mutations through project API server wiring into one managed runtime',
    run: async () => {
      let requestCounter = 0;
      const admission = createAdmissionInput(createReadyReadinessPackage());
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T06:00:00.000Z',
        initialRows: [createSourceRow()],
      });
      const fakeRuntime = createFakeRuntime({ admission });
      const fallback = createFallbackHandler();
      const process = createFinanceHttpPostgresManagedProjectRuntimeProcessContract({
        admission,
        fallbackHandler: fallback.handler,
        requestIdFactory: () => {
          requestCounter += 1;

          return `project-process-request-${requestCounter}`;
        },
        resolvePrincipal: createPrincipal,
        runtime: fakeRuntime.runtime,
        sourceSqlRepository,
      });
      const summary = process.getProcessSummary();
      const validation = validateFinanceHttpPostgresManagedProjectRuntimeProcessSummary(summary);

      assertEqual(summary.lifecycleState, 'active', 'ready admission should start active process');
      assertEqual(summary.projectApiServerConstructed, true, 'active process should construct project API server');
      assertEqual(summary.runtimeBundleErrors.length, 0, 'active process should not expose runtime bundle errors');
      assertEqual(
        summary.runtimeImplementationBundle?.serviceRuntimeAdmissionEvidenceId,
        admission.runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
        'active process summary should expose admitted runtime bundle evidence',
      );
      assertEqual(validation.ok, true, `active summary should validate: ${validation.errors.join(', ')}`);
      const nodeServerTraceHeaders = createFinanceHttpPostgresManagedProjectRuntimeNodeServerTraceHeaders(summary);

      assertEqual(
        nodeServerTraceHeaders['x-finance-local-project-runtime-node-server-runtime-bundle'],
        admission.runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
        'Node host trace headers should preserve active runtime bundle evidence id without requiring a listener',
      );

      const response = await process.handleConcreteFrameworkRequest({
        body: {
          amount: '1200.00',
          expectedVersion: 1,
          targetAccountingPeriod: '2026-06',
        },
        headers: {
          authorization: 'Bearer finance-user',
          'content-type': 'application/json',
        },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/source-001/adjust',
      });
      const body = parseJson(response.bodyText);
      const processEvents = response.processTrace.map((event) => event.event);
      const sourceSqlRows = sourceSqlRepository.readSqlRows();

      assertEqual(response.status, 200, 'source mutation should return managed runtime success');
      assertEqual(body.sourceId, 'source-001', 'response should expose source id');
      assertEqual(body.version, 2, 'response should expose updated source version');
      assertEqual(sourceSqlRows[0]?.amount, '1200.00', 'source SQL row should be written back after managed commit');
      assertEqual(sourceSqlRows[0]?.version, 2, 'source SQL row version should be written back after managed commit');
      assertEqual(fakeRuntime.readCounts().guardCallCount, 1, 'managed runtime should be called once');
      assertEqual(fallback.readCallCount(), 0, 'managed source mutation should not fall through to fallback');
      assertEqual(
        response.headers['x-finance-local-project-api-server-entry'],
        'framework-route-plugin',
        'response should preserve project API server provenance',
      );
      assertIncludes(
        processEvents,
        'delegate_project_api_server_wiring',
        'active process should delegate into project API server wiring',
      );
    },
  },
  {
    name: 'blocks project API server construction when runtime implementation bundle drifts from readiness',
    run: async () => {
      const admission = createAdmissionInput(createReadyReadinessPackage());
      const driftedAdmission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput = {
        ...admission,
        runtimeImplementationBundle: {
          ...admission.runtimeImplementationBundle,
          poolConfig: {
            ...admission.runtimeImplementationBundle.poolConfig,
            applicationName: 'period-close-drifted-project-runtime',
          },
        },
      };
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T06:00:00.000Z',
        initialRows: [createSourceRow()],
      });
      const fakeRuntime = createFakeRuntime({ admission: driftedAdmission });
      const fallback = createFallbackHandler();
      const process = createFinanceHttpPostgresManagedProjectRuntimeProcessContract({
        admission: driftedAdmission,
        fallbackHandler: fallback.handler,
        resolvePrincipal: createPrincipal,
        runtime: fakeRuntime.runtime,
        sourceSqlRepository,
      });
      const summary = process.getProcessSummary();
      const validation = validateFinanceHttpPostgresManagedProjectRuntimeProcessSummary(summary);

      assertEqual(summary.lifecycleState, 'blocked_by_runtime_bundle', 'bundle drift should block project runtime');
      assertEqual(summary.projectApiServerConstructed, false, 'bundle drift must not construct project API server');
      assertEqual(summary.runtimeBundleErrors.length, 1, 'bundle drift should expose one process summary error');
      assertIncludes(
        summary.runtimeBundleErrors,
        'project runtime bundle pool config must match derived readiness pool config',
        'bundle drift should be explicit in process summary',
      );
      assertEqual(
        summary.runtimeImplementationBundle,
        undefined,
        'blocked runtime bundle must not be exposed as active process evidence',
      );
      assertEqual(validation.ok, true, `bundle-blocked summary should validate: ${validation.errors.join(', ')}`);

      const response = await process.handleConcreteFrameworkRequest({
        body: {
          amount: '1200.00',
          expectedVersion: 1,
          targetAccountingPeriod: '2026-06',
        },
        headers: {
          authorization: 'Bearer finance-user',
          'content-type': 'application/json',
        },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/source-001/adjust',
      });
      const body = parseJson(response.bodyText);

      assertEqual(response.status, 503, 'bundle-blocked process should reject framework requests');
      assertEqual(
        body.code,
        'FINANCE_PROJECT_RUNTIME_BUNDLE_BLOCKED',
        'bundle-blocked process should return runtime bundle code',
      );
      assertEqual(fakeRuntime.readCounts().guardCallCount, 0, 'bundle drift must not call managed runtime');
      assertEqual(fallback.readCallCount(), 0, 'bundle drift must not call fallback handler');
    },
  },
  {
    name: 'shuts down managed runtime and rejects subsequent framework requests',
    run: async () => {
      const admission = createAdmissionInput(createReadyReadinessPackage());
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T06:00:00.000Z',
        initialRows: [createSourceRow()],
      });
      const fakeRuntime = createFakeRuntime({ admission });
      const fallback = createFallbackHandler();
      const process = createFinanceHttpPostgresManagedProjectRuntimeProcessContract({
        admission,
        fallbackHandler: fallback.handler,
        resolvePrincipal: createPrincipal,
        runtime: fakeRuntime.runtime,
        sourceSqlRepository,
      });
      const shutdown = await process.shutdown({ requestId: 'shutdown-request-001' });

      assertEqual(shutdown.lifecycleState, 'closed', 'shutdown should close process lifecycle');
      assertEqual(shutdown.runtimeShutdown.status, 'closed', 'shutdown should call managed runtime shutdown');
      assertEqual(fakeRuntime.readCounts().shutdownCallCount, 1, 'managed runtime shutdown should be called once');

      const response = await process.handleConcreteFrameworkRequest({
        method: 'GET',
        url: '/api/finance/accounting-periods/2026-06/close-checks',
      });
      const body = parseJson(response.bodyText);

      assertEqual(response.status, 503, 'closed process should reject later requests');
      assertEqual(
        body.code,
        'FINANCE_PROJECT_RUNTIME_PROCESS_CLOSED',
        'closed process should return closed lifecycle code',
      );
      assertEqual(fallback.readCallCount(), 0, 'closed process should not call fallback handler');
    },
  },
];

for (const test of tests) {
  await test.run();
}
