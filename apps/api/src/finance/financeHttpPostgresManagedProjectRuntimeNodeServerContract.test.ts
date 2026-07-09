import { request as createNodeHttpRequest } from 'node:http';

import { createFinanceHttpPostgresManagedProjectRuntimeNodeServerContract } from './financeHttpPostgresManagedProjectRuntimeNodeServerContract.js';
import {
  createFinanceHttpPostgresManagedProjectRuntimeProcessContract,
} from './financeHttpPostgresManagedProjectRuntimeProcessContract.js';
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

type HttpClientResponse = {
  bodyText: string;
  headers: Record<string, string | readonly string[] | undefined>;
  status: number;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertStringIncludes(actual: string, expected: string, message: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}. Expected ${expected} in ${actual}`);
  }
}

function parseJson(bodyText: string) {
  return JSON.parse(bodyText) as { code?: string; sourceId?: string; version?: number };
}

function sendHttpRequest({
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
  return new Promise<HttpClientResponse>((resolve, reject) => {
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
      applicationName: 'startupmanage-period-close-project-runtime-node-server-production',
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
    reviewedAt: '2026-07-05T08:00:00.000Z',
    reviewer: 'project-runtime-node-server-test',
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
    backupRestore: { status: 'not_started' },
    formalMigrationApply: { status: 'not_applied' },
    productionApplyApproval: { status: 'not_started' },
    secret: { status: 'not_ready' },
    targetDatabase: { status: 'not_selected' },
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

function createSourceRow(): FinanceSourceTableSqlRow {
  return {
    accounting_period: '2026-06',
    amount: '1000.00',
    id: 'source-001',
    source_no: 'AR-202606-001',
    status: '未结清',
    tableName: getDefaultFinanceSourceTableName('receivable_payable'),
    version: 1,
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
      timestamp: '2026-07-05T08:10:00.000Z',
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
      throw new Error('closeAccountingPeriod should not be called by project runtime node server tests');
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

function createProcessFixture(readinessPackage: PeriodClosePostgresRuntimeReadinessPackage) {
  let requestCounter = 0;
  const admission = createAdmissionInput(readinessPackage);
  const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
    fallbackUpdatedAt: '2026-07-05T08:00:00.000Z',
    initialRows: [createSourceRow()],
  });
  const fakeRuntime = createFakeRuntime({ admission });
  const fallback = createFallbackHandler();
  const process = createFinanceHttpPostgresManagedProjectRuntimeProcessContract({
    admission,
    fallbackHandler: fallback.handler,
    requestIdFactory: () => {
      requestCounter += 1;

      return `project-runtime-node-request-${requestCounter}`;
    },
    resolvePrincipal: createPrincipal,
    runtime: fakeRuntime.runtime,
    sourceSqlRepository,
  });

  return {
    admission,
    fakeRuntime,
    fallback,
    process,
    sourceSqlRepository,
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects local listener startup when project runtime process is not active',
    run: async () => {
      const fixture = createProcessFixture(createBlockedReadinessPackage());

      try {
        await createFinanceHttpPostgresManagedProjectRuntimeNodeServerContract({
          process: fixture.process,
        }).listen();
      } catch (error) {
        assertStringIncludes(
          String(error),
          'blocked_by_runtime_readiness',
          'blocked process should fail listener startup before binding',
        );
        assertEqual(fixture.fakeRuntime.readCounts().guardCallCount, 0, 'blocked startup must not call runtime');
        assertEqual(fixture.fallback.readCallCount(), 0, 'blocked startup must not call fallback');

        return;
      }

      throw new Error('blocked project runtime process should not start local listener');
    },
  },
  {
    name: 'hosts active project runtime process behind a local Node HTTP listener',
    run: async () => {
      const fixture = createProcessFixture(createReadyReadinessPackage());
      const server = await createFinanceHttpPostgresManagedProjectRuntimeNodeServerContract({
        process: fixture.process,
      }).listen();

      try {
        const response = await sendHttpRequest({
          bodyText: JSON.stringify({
            amount: '1300.00',
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06',
          }),
          headers: {
            authorization: 'Bearer finance-user',
            'content-type': 'application/json',
          },
          method: 'PATCH',
          origin: server.origin,
          path: '/api/finance/receivables-payables/source-001/adjust',
        });
        const body = parseJson(response.bodyText);
        const rows = fixture.sourceSqlRepository.readSqlRows();

        assertEqual(response.status, 200, 'local Node host should return project runtime response');
        assertEqual(body.sourceId, 'source-001', 'local Node host should preserve source mutation body');
        assertEqual(body.version, 2, 'local Node host should preserve updated source version');
        assertEqual(rows[0]?.amount, '1300.00', 'local Node host should write source SQL row after managed commit');
        assertEqual(
          response.headers['x-finance-local-project-runtime-node-server-entry'],
          'project-runtime-process',
          'local Node host should expose project runtime process provenance',
        );
        assertEqual(
          response.headers['x-finance-local-project-runtime-node-server-lifecycle'],
          'active',
          'local Node host should expose active lifecycle while handling request',
        );
        assertEqual(
          response.headers['x-finance-local-project-runtime-node-server-runtime-bundle'],
          fixture.admission.runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
          'local Node host should expose the active runtime bundle evidence id',
        );
        assertEqual(fixture.fakeRuntime.readCounts().guardCallCount, 1, 'local Node host should call runtime once');
        assertEqual(fixture.fallback.readCallCount(), 0, 'source mutation should not fall through to fallback');

        const shutdown = await server.close({ requestId: 'project-runtime-node-shutdown-001' });

        assertEqual(shutdown.httpServerClosed, true, 'local Node host should close HTTP server');
        assertEqual(
          shutdown.processShutdown.runtimeShutdown.status,
          'closed',
          'local Node host should shutdown managed runtime',
        );
        assertEqual(
          fixture.process.getProcessSummary().lifecycleState,
          'closed',
          'local Node host close should close process lifecycle',
        );
        assertEqual(fixture.fakeRuntime.readCounts().shutdownCallCount, 1, 'local Node host should shutdown runtime once');
      } finally {
        if (fixture.process.getProcessSummary().lifecycleState !== 'closed') {
          await server.close({ requestId: 'project-runtime-node-finally-close' });
        }
      }
    },
  },
  {
    name: 'rejects non-local bind hosts in the local node server contract',
    run: async () => {
      const fixture = createProcessFixture(createReadyReadinessPackage());

      try {
        await createFinanceHttpPostgresManagedProjectRuntimeNodeServerContract({
          process: fixture.process,
        }).listen({ host: '0.0.0.0' });
      } catch (error) {
        assertStringIncludes(String(error), 'localhost', 'non-local host should be rejected before binding');
        assertEqual(fixture.fakeRuntime.readCounts().guardCallCount, 0, 'non-local host reject must not call runtime');

        return;
      }

      throw new Error('non-local host should not be accepted by local node server contract');
    },
  },
];

for (const test of tests) {
  await test.run();
}
