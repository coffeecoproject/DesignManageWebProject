import type {
  PeriodCloseServiceAtomicCommitBoundaryContract
} from './periodCloseServiceAtomicCommitBoundaryContract.js';
import { createPeriodCloseServiceAtomicCommitBoundaryContract } from './periodCloseServiceAtomicCommitBoundaryContract.js';
import { createPeriodClosePostgresAtomicCommitBridgeContract } from './periodClosePostgresAtomicCommitBridgeContract.js';
import {
  createPeriodClosePostgresServiceRuntimeGatewayContract,
  validatePeriodClosePostgresServiceRuntimeGatewayTrace,
  type PeriodClosePostgresServiceRuntimeGatewayAdmissionInput,
  type PeriodClosePostgresServiceRuntimeGatewayResult
} from './periodClosePostgresServiceRuntimeGatewayContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
import type { PeriodCloseSqlDriverStatement } from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import { buildPeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';
import type { PeriodClosePostgresClientPort } from './periodClosePostgresClientPortContract.js';
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

function gatewayTransactionId({
  operation,
  requestId
}: {
  operation: 'close_accounting_period' | 'guard_source_mutation';
  requestId: string;
}) {
  return `${requestId}:${operation}:postgres-service-runtime-gateway`;
}

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
      applicationName: 'startupmanage-period-close-service-runtime-production',
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
    reviewer: 'postgres-service-runtime-gateway-test',
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

function createRuntimeProofStatements({
  period = '2026-06',
  transactionId
}: {
  period?: string;
  transactionId: string;
}): PeriodCloseSqlDriverStatement[] {
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

function createAdmissionInput({
  operation = 'close_accounting_period',
  period = '2026-06',
  readinessPackage = createReadyProductionReadinessPackage(),
  requestId = 'req-postgres-service-runtime-close'
}: {
  operation?: 'close_accounting_period' | 'guard_source_mutation';
  period?: string;
  readinessPackage?: PeriodClosePostgresRuntimeReadinessPackage;
  requestId?: string;
} = {}): PeriodClosePostgresServiceRuntimeGatewayAdmissionInput {
  const transactionId = gatewayTransactionId({ operation, requestId });

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
    runtimeProofStatements: createRuntimeProofStatements({ period, transactionId })
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

function createPgError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string };

  error.code = code;

  return error;
}

function createMockPool() {
  const queries: { parameters: readonly unknown[]; sql: string }[] = [];
  const releases: string[] = [];
  let connectCount = 0;

  const client: PeriodClosePostgresClientPort = {
    query: async (sql, parameters = []) => {
      queries.push({ parameters: [...parameters], sql });

      if (sql.includes('SIMULATE_SERVICE_RUNTIME_GATEWAY_FAILURE')) {
        throw createPgError('simulated service runtime gateway postgres failure', '55P03');
      }

      return { rowCount: 1, rows: [] };
    },
    release: () => {
      releases.push('release');
    }
  };

  return {
    pool: {
      connect: async () => {
        connectCount += 1;

        return client;
      }
    },
    readState: () => ({
      connectCount,
      queries: queries.map((query) => ({ ...query, parameters: [...query.parameters] })),
      releaseCount: releases.length
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
        sourceVersionSetHash: 'src_hash_service_runtime_gateway_202606',
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
    idempotencyKey: `idem-service-runtime-gateway-${overrides.requestId ?? 'default'}`,
    now: '2026-07-05T12:00:00+08:00',
    reason: '月末结账',
    requestId: 'req-postgres-service-runtime-close',
    version: 1,
    ...overrides
  };
}

function createServiceBoundary() {
  let committedState = createState();
  let commitCount = 0;
  let rollbackCount = 0;
  const { pool, readState: readPoolState } = createMockPool();
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

  return {
    readCommittedSnapshot: () =>
      createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-05T12:00:00+08:00',
        initialState: clonePeriodClosePersistentState(committedState)
      }).readDatabaseSnapshot(),
    readPoolState,
    readUnitOfWorkState: () => ({
      commitCount,
      rollbackCount
    }),
    serviceBoundary: createPeriodCloseServiceAtomicCommitBoundaryContract({ atomicBridge })
  };
}

function createBlockedServiceBoundarySpy() {
  let callCount = 0;
  const serviceBoundary: PeriodCloseServiceAtomicCommitBoundaryContract = {
    closeAccountingPeriod: async () => {
      callCount += 1;
      throw new Error('blocked runtime must not call close service boundary');
    },
    guardSourceMutation: async () => {
      callCount += 1;
      throw new Error('blocked runtime must not call source service boundary');
    },
    readServiceEvents: () => []
  };

  return {
    readCallCount: () => callCount,
    serviceBoundary
  };
}

function assertValid<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>(
  result: PeriodClosePostgresServiceRuntimeGatewayResult<T>
) {
  const errors = validatePeriodClosePostgresServiceRuntimeGatewayTrace(result);

  assertEqual(errors.length, 0, `service runtime gateway trace should validate: ${errors.join('; ')}`);
}

const tests: UnitTest[] = [
  {
    name: 'blocks service work when readiness package is still operationally blocked',
    run: async () => {
      const operationalGate = buildPeriodCloseMigrationOperationalGateContract();
      const readinessPackage = buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
        operationalGate
      });
      const { readCallCount, serviceBoundary } = createBlockedServiceBoundarySpy();
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const gateway = createPeriodClosePostgresServiceRuntimeGatewayContract({
        loadPgModule,
        serviceBoundary
      });
      const result = await gateway.closeAccountingPeriod({
        admission: createAdmissionInput({ readinessPackage }),
        period: '2026-06',
        request: createCloseRequest()
      });

      assertEqual(result.status, 'runtime_blocked', 'blocked readiness must block service runtime gateway');
      assertEqual(result.serviceResult, undefined, 'blocked runtime must not return a service result');
      assertEqual(readCallCount(), 0, 'blocked runtime must not call service atomic boundary');
      assertEqual(readPgState().constructCount, 0, 'blocked runtime must not construct pg pool');
      assertValid(result);
    }
  },
  {
    name: 'runs runtime admission before committing close through service atomic boundary',
    run: async () => {
      const { loadPgModule, readState: readPgState } = createFakePgModule();
      const { readCommittedSnapshot, readPoolState, readUnitOfWorkState, serviceBoundary } = createServiceBoundary();
      const secretResolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T12:00:00.000Z',
        secretStore: createSecretStore()
      });
      const gateway = createPeriodClosePostgresServiceRuntimeGatewayContract({
        loadPgModule,
        secretResolver,
        serviceBoundary
      });
      const result = await gateway.closeAccountingPeriod({
        admission: createAdmissionInput(),
        period: '2026-06',
        request: createCloseRequest()
      });

      assertEqual(result.status, 'committed', 'ready runtime should allow service close commit');
      assertEqual(result.runtimeAdmissionResult.status, 'committed', 'runtime admission should complete before service work');
      assertEqual(result.serviceResult?.status, 'committed', 'service boundary should commit after runtime admission');
      assertEqual(readPgState().constructCount, 1, 'runtime admission should construct one pg pool for readiness proof');
      assertEqual(readPoolState().connectCount, 1, 'service boundary should run one pg-like replay after readiness proof');
      assertEqual(readUnitOfWorkState().commitCount, 1, 'service boundary should publish the staged close state');
      assertEqual(
        readCommittedSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'service runtime gateway close should persist the period lock in the local contract state'
      );
      assertValid(result);
    }
  },
  {
    name: 'runs source mutation guard through the same service runtime gateway after close',
    run: async () => {
      const { loadPgModule } = createFakePgModule();
      const { readCommittedSnapshot, readUnitOfWorkState, serviceBoundary } = createServiceBoundary();
      const secretResolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T12:00:00.000Z',
        secretStore: createSecretStore()
      });
      const gateway = createPeriodClosePostgresServiceRuntimeGatewayContract({
        loadPgModule,
        secretResolver,
        serviceBoundary
      });

      await gateway.closeAccountingPeriod({
        admission: createAdmissionInput({
          requestId: 'req-postgres-service-runtime-close-before-source'
        }),
        period: '2026-06',
        request: createCloseRequest({ requestId: 'req-postgres-service-runtime-close-before-source' })
      });

      const result = await gateway.guardSourceMutation({
        admission: createAdmissionInput({
          operation: 'guard_source_mutation',
          requestId: 'req-postgres-service-runtime-source-guard'
        }),
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-05T12:05:00+08:00',
          requestId: 'req-postgres-service-runtime-source-guard'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        }
      });
      const committedSnapshot = readCommittedSnapshot();

      assertEqual(result.status, 'committed', 'ready runtime should allow source guard audit commit');
      assertEqual(result.runtimeAdmissionResult.status, 'committed', 'source guard should also pass runtime admission first');
      assertEqual(result.serviceResult?.status, 'committed', 'source guard should commit service boundary audit');
      assertEqual(committedSnapshot.sourceRecords[0]?.amount, '1000.00', 'closed-period source row should remain unchanged');
      assertEqual(
        committedSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period source guard audit should be persisted after service runtime gateway'
      );
      assertEqual(readUnitOfWorkState().commitCount, 2, 'close and source guard should publish separate staged units');
      assertValid(result);
    }
  }
];

for (const test of tests) {
  await test.run();
}
