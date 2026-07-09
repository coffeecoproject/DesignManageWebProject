import { createFinanceHttpAuthMiddleware, type FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import { createFinanceHttpConcreteFrameworkAdapter } from './financeHttpConcreteFrameworkAdapterContract.js';
import { createFinanceHttpFrameworkRouteBinding } from './financeHttpFrameworkRouteBindingContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import { createFinanceHttpResourceAuthorizationMiddleware } from './financeHttpResourceAuthorizationContract.js';
import {
  handleFinanceHttpServiceTransactionGateway,
  type FinanceHttpServiceTransactionGatewayResponse
} from './financeHttpServiceTransactionGatewayContract.js';
import { createFinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import { createFinanceHttpServerRuntime } from './financeHttpServerRuntimeContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import { createPeriodCloseServiceTransactionBoundaryContract } from './periodCloseServiceTransactionBoundaryContract.js';
import {
  createInMemoryPeriodCloseSqlDriverExecutor,
  type PeriodCloseSqlDriverStatementName
} from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import { requiredCloseCheckCodes, type CloseCheckRow } from './periodCloseContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';

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

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(message);
  }
}

function parseBody(bodyText: string) {
  return JSON.parse(bodyText) as unknown;
}

function createPrincipal(overrides: Partial<FinanceHttpAuthenticatedPrincipal> = {}): FinanceHttpAuthenticatedPrincipal {
  return {
    actorSnapshot: {
      id: 'user-service-gateway-001',
      name: '赵会计'
    },
    permissionScopes: financePeriodClosePermissionScopes,
    resourceScopes: ['finance.ledger:default-ledger'],
    status: 'active',
    ...overrides
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
    summary: '检查通过。'
  }));
}

function createSourceRecord(
  overrides: Partial<PersistentFinanceSourceRecord> = {}
): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1200.00',
    id: 'rp-service-gateway-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-905',
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
        computedAt: '2026-07-05T10:00:00+08:00',
        sourceVersionSetHash: 'src-service-gateway-v1',
        trialBalance: {
          creditTotal: '1200.00',
          debitTotal: '1200.00',
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

function createServiceStack({
  failOnStatement,
  initialState = createState(),
  principal
}: {
  failOnStatement?: PeriodCloseSqlDriverStatementName;
  initialState?: PeriodClosePersistentState;
  principal?: FinanceHttpAuthenticatedPrincipal;
} = {}) {
  const driver = createInMemoryPeriodCloseSqlDriverExecutor(
    failOnStatement ? { failOnStatement } : undefined
  );
  const repository = createPeriodCloseSqlRepositoryContract({
    fallbackNow: '2026-07-05T10:30:00+08:00',
    initialState
  });
  const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
  const service = createPeriodCloseServiceTransactionBoundaryContract({
    clientRepository,
    resolveSourceMutationPeriod: ({ mutation }) =>
      mutation.targetAccountingPeriod ??
      repository
        .readDatabaseSnapshot()
        .sourceRecords.find(
          (record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea
        )?.accountingPeriod
  });
  const transport = createFinanceHttpJsonTransport({
    handle: (request) => handleFinanceHttpServiceTransactionGateway({ request, service })
  });
  const resourceAuthorization = createFinanceHttpResourceAuthorizationMiddleware({ transport });
  let requestSequence = 0;
  const runtime = createFinanceHttpServerRuntime({
    authMiddleware: createFinanceHttpAuthMiddleware({ transport: resourceAuthorization }),
    now: () => '2026-07-05T10:30:00+08:00',
    requestIdFactory: () => {
      requestSequence += 1;
      return `req-service-gateway-${String(requestSequence).padStart(3, '0')}`;
    },
    resolvePrincipal: (request) =>
      request.authorization === 'Bearer finance-service-gateway-token' ? principal : undefined
  });
  const routeBinding = createFinanceHttpFrameworkRouteBinding({ runtime });
  const handler = createFinanceHttpServerHandler({ routeBinding });
  const adapter = createFinanceHttpConcreteFrameworkAdapter({
    frameworkName: 'express-like-service-gateway-contract',
    handler
  });

  return {
    adapter,
    driver,
    repository,
    service
  };
}

function createAuthorizedHeaders() {
  return {
    authorization: 'Bearer finance-service-gateway-token',
    'content-type': 'application/json',
    'x-actor-id': 'forged-client-user',
    'x-finance-resource-scopes': 'finance.ledger:*',
    'x-permission-scopes': ''
  };
}

function assertServiceDelegated(
  response: FinanceHttpServiceTransactionGatewayResponse,
  expectedOperation: 'close_accounting_period' | 'guard_source_mutation'
) {
  assert(response.serviceTransaction !== undefined, 'service gateway response should expose local transaction evidence');
  assertEqual(response.serviceTransaction.operation, expectedOperation, 'service transaction operation should match');
  assertEqual(response.serviceTransaction.traceErrorCount, 0, 'service transaction should have no trace errors');
}

const tests: UnitTest[] = [
  {
    name: 'delegates close route through concrete framework adapter into service transaction boundary',
    run: () => {
      const { adapter, repository, service } = createServiceStack({
        principal: createPrincipal()
      });
      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          idempotencyKey: 'service-gateway-close-001',
          reason: '2026-06 月结',
          version: 1
        },
        headers: createAuthorizedHeaders(),
        method: 'POST',
        originalUrl: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);
      const serviceEvents = service.readServiceEvents();

      assertObject(body, 'service close body should be an object');
      assertEqual(response.status, 201, 'service gateway close should return created');
      assertObject(body.closedBySnapshot, 'service close body should include closed actor');
      assertEqual(body.closedBySnapshot.id, 'user-service-gateway-001', 'close actor should come from server principal');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'service gateway close should persist closed period through SQL-shaped repository'
      );
      assert(
        serviceEvents.some((event) => event.event === 'delegate_to_db_client'),
        'close route must delegate to DB client transaction boundary'
      );
    }
  },
  {
    name: 'exposes service transaction evidence when called directly by JSON transport gateway contract',
    run: () => {
      const { repository, service } = createServiceStack({
        principal: createPrincipal()
      });
      const response = handleFinanceHttpServiceTransactionGateway({
        request: {
          body: {
            idempotencyKey: 'service-gateway-direct-close-001',
            reason: '2026-06 月结',
            version: 1
          },
          headers: {
            'x-actor-id': 'user-service-gateway-001',
            'x-actor-name': '赵会计',
            'x-permission-scopes': financePeriodClosePermissionScopes.join(','),
            'x-request-id': 'req-service-gateway-direct',
            'x-request-time': '2026-07-05T10:35:00+08:00'
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        service
      });

      assertEqual(response.status, 201, 'direct service gateway close should return created');
      assertServiceDelegated(response, 'close_accounting_period');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'direct service gateway close should persist period lock'
      );
    }
  },
  {
    name: 'rejects missing server-owned ledger resource before service transaction delegation',
    run: () => {
      const { adapter, repository, service } = createServiceStack({
        principal: createPrincipal({
          resourceScopes: []
        })
      });
      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          idempotencyKey: 'service-gateway-forged-resource-001',
          reason: '2026-06 月结',
          version: 1
        },
        headers: createAuthorizedHeaders(),
        method: 'POST',
        pathname: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'resource rejection body should be an object');
      assertEqual(response.status, 403, 'missing server-owned ledger resource should be forbidden');
      assertEqual(body.code, 'FORBIDDEN', 'resource rejection code should match');
      assertEqual(service.readServiceEvents().length, 0, 'forbidden request must not enter service transaction boundary');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'forbidden request must not mutate period'
      );
    }
  },
  {
    name: 'creates a new receivable-payable source through service transaction boundary',
    run: () => {
      const { adapter, repository, service } = createServiceStack({
        principal: createPrincipal()
      });
      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          amount: '800.00',
          sourceId: 'rp-service-gateway-new',
          sourceNo: 'AR-202606-NEW',
          status: '已生成',
          targetAccountingPeriod: '2026-06'
        },
        headers: createAuthorizedHeaders(),
        method: 'POST',
        pathname: '/api/finance/receivables-payables'
      });
      const body = parseBody(response.bodyText);
      const createdRecord = repository
        .readDatabaseSnapshot()
        .sourceRecords.find((record) => record.id === 'rp-service-gateway-new');

      assertObject(body, 'create-source response body should be an object');
      assertEqual(response.status, 201, 'create-source response should return created');
      assertEqual(body.sourceId, 'rp-service-gateway-new', 'create-source response should include source id');
      assert(createdRecord !== undefined, 'create-source should persist a source record');
      assertEqual(createdRecord.accountingPeriod, '2026-06', 'create-source should persist target accounting period');
      assert(
        service.readServiceEvents().some((event) => event.operation === 'guard_source_mutation'),
        'create-source route must enter service transaction boundary'
      );
    }
  },
  {
    name: 'rejects invalid source mutation payload before service transaction delegation',
    run: () => {
      const { adapter, repository, service } = createServiceStack({
        principal: createPrincipal()
      });
      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          amount: 1800,
          expectedVersion: 1,
          status: '已调整'
        },
        headers: createAuthorizedHeaders(),
        method: 'PATCH',
        pathname: '/api/finance/receivables-payables/rp-service-gateway-001/adjust'
      });
      const body = parseBody(response.bodyText);
      const sourceRecord = repository
        .readDatabaseSnapshot()
        .sourceRecords.find((record) => record.id === 'rp-service-gateway-001');

      assertObject(body, 'invalid source payload body should be an object');
      assertEqual(response.status, 400, 'invalid source payload should return bad request');
      assertEqual(body.code, 'INVALID_REQUEST', 'invalid source payload should use stable error code');
      assertEqual(service.readServiceEvents().length, 0, 'invalid source payload must not enter service boundary');
      assertEqual(sourceRecord?.amount, '1200.00', 'invalid source payload must not mutate source amount');
    }
  },
  {
    name: 'rejects closed-period source mutation through service transaction boundary and keeps source unchanged',
    run: () => {
      const { adapter, repository, service } = createServiceStack({
        principal: createPrincipal()
      });

      adapter.handleConcreteFrameworkRequest({
        body: {
          idempotencyKey: 'service-gateway-close-before-source-001',
          reason: '2026-06 月结',
          version: 1
        },
        headers: createAuthorizedHeaders(),
        method: 'POST',
        pathname: '/api/finance/accounting-periods/2026-06/close'
      });

      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          amount: '1800.00',
          expectedVersion: 1,
          status: '已调整'
        },
        headers: createAuthorizedHeaders(),
        method: 'PATCH',
        pathname: '/api/finance/receivables-payables/rp-service-gateway-001/adjust'
      });
      const body = parseBody(response.bodyText);
      const sourceRecord = repository
        .readDatabaseSnapshot()
        .sourceRecords.find((record) => record.id === 'rp-service-gateway-001');
      const sourceEvents = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events;

      assertObject(body, 'closed source response body should be an object');
      assertEqual(response.status, 409, 'closed source mutation should be rejected');
      assertEqual(body.code, 'CLOSED_ACCOUNTING_PERIOD', 'closed source mutation code should match');
      assertEqual(sourceRecord?.amount, '1200.00', 'closed source mutation must keep amount unchanged');
      assertEqual(sourceEvents.length, 1, 'closed source mutation should persist a guard audit event');
      assert(
        service
          .readServiceEvents()
          .some((event) => event.operation === 'guard_source_mutation' && event.event === 'delegate_to_db_client'),
        'closed source mutation must delegate to DB client transaction boundary'
      );
    }
  },
  {
    name: 'maps SQL driver failure to retryable service gateway error',
    run: () => {
      const { repository, service } = createServiceStack({
        failOnStatement: 'lock_accounting_period_for_update',
        principal: createPrincipal()
      });
      const response = handleFinanceHttpServiceTransactionGateway({
        request: {
          body: {
            idempotencyKey: 'service-gateway-driver-failure-001',
            reason: '2026-06 月结',
            version: 1
          },
          headers: {
            'x-actor-id': 'user-service-gateway-001',
            'x-actor-name': '赵会计',
            'x-permission-scopes': financePeriodClosePermissionScopes.join(','),
            'x-request-id': 'req-service-gateway-driver-failure',
            'x-request-time': '2026-07-05T10:40:00+08:00'
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        service
      });
      const body = response.body;

      assertObject(body, 'driver failure body should be an object');
      assertEqual(response.status, 503, 'driver failure should be surfaced as retryable service unavailable');
      assertEqual(body.code, 'DB_TRANSACTION_FAILED', 'driver failure code should match');
      assertEqual(response.serviceTransaction?.status, 'driver_failed', 'service transaction status should be driver failed');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'driver failure must not persist closed period'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
