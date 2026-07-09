import { createFinanceHttpAuthMiddleware, type FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import { createFinanceHttpFrameworkRouteBinding } from './financeHttpFrameworkRouteBindingContract.js';
import { handleFinanceHttpApiRepositoryGateway } from './financeHttpApiRepositoryGatewayContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import { createFinanceHttpServerRuntime, type FinanceHttpServerRuntimeRequest } from './financeHttpServerRuntimeContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import { canonicalClosedAccountingPeriodErrorCode, requiredCloseCheckCodes, type CloseCheckRow } from './periodCloseContract.js';
import { createRowBackedPeriodCloseRepository } from './periodCloseDatabaseRepositoryContract.js';
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
      id: 'user-route-binding-001',
      name: '钱会计'
    },
    permissionScopes: financePeriodClosePermissionScopes,
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
    id: 'rp-binding-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-902',
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
        computedAt: '2026-07-04T14:00:00+08:00',
        sourceVersionSetHash: 'src-http-route-binding-v1',
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

function createRepository(overrides: Partial<PeriodClosePersistentState> = {}) {
  return createRowBackedPeriodCloseRepository({
    fallbackNow: '2026-07-04T14:30:00+08:00',
    initialState: createState(overrides)
  });
}

function createBindingStack({
  principal
}: {
  principal?: FinanceHttpAuthenticatedPrincipal;
} = {}) {
  const repository = createRepository();
  const transport = createFinanceHttpJsonTransport({
    handle: (request) => {
      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: request.body,
          headers: request.headers,
          method: request.method,
          path: request.path
        }
      });

      return {
        body: response.body,
        headers: response.headers,
        status: response.status
      };
    }
  });
  const runtime = createFinanceHttpServerRuntime({
    authMiddleware: createFinanceHttpAuthMiddleware({ transport }),
    now: () => '2026-07-04T14:30:00+08:00',
    requestIdFactory: () => 'req-framework-binding-001',
    resolvePrincipal: (request) => (request.authorization === 'Bearer finance-route-token' ? principal : undefined)
  });

  return {
    binding: createFinanceHttpFrameworkRouteBinding({ runtime }),
    repository
  };
}

const tests: UnitTest[] = [
  {
    name: 'does not delegate non-finance routes to the runtime',
    run: () => {
      let delegated = false;
      const binding = createFinanceHttpFrameworkRouteBinding({
        runtime: {
          handleServerRequest: () => {
            delegated = true;

            return {
              bodyText: JSON.stringify({ ok: true }),
              headers: { 'content-type': 'application/json; charset=utf-8' },
              status: 200
            };
          }
        }
      });
      const response = binding.handleFrameworkRouteRequest({
        method: 'GET',
        pathname: '/api/people/overview'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'non-finance route body should be an object');
      assertEqual(response.handled, false, 'non-finance route should not be handled by finance binding');
      assertEqual(response.status, 404, 'non-finance route should return not-bound status');
      assertEqual(body.code, 'FINANCE_ROUTE_NOT_BOUND', 'non-finance route code should match');
      assertEqual(delegated, false, 'non-finance route must not reach runtime');
    }
  },
  {
    name: 'rejects unsupported finance methods before runtime delegation',
    run: () => {
      let delegated = false;
      const binding = createFinanceHttpFrameworkRouteBinding({
        runtime: {
          handleServerRequest: () => {
            delegated = true;

            return {
              bodyText: JSON.stringify({ ok: true }),
              headers: { 'content-type': 'application/json; charset=utf-8' },
              status: 200
            };
          }
        }
      });
      const response = binding.handleFrameworkRouteRequest({
        method: 'DELETE',
        pathname: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'method-not-allowed body should be an object');
      assertEqual(response.handled, true, 'finance route with unsupported method should be handled');
      assertEqual(response.status, 405, 'unsupported finance method should return 405');
      assertEqual(body.code, 'FINANCE_METHOD_NOT_ALLOWED', 'unsupported finance method code should match');
      assertEqual(delegated, false, 'unsupported finance method must not reach runtime');
    }
  },
  {
    name: 'maps framework pathname query headers and method into runtime request',
    run: () => {
      let delegatedRequest: FinanceHttpServerRuntimeRequest | undefined;
      const binding = createFinanceHttpFrameworkRouteBinding({
        runtime: {
          handleServerRequest: (request) => {
            delegatedRequest = request;

            return {
              bodyText: JSON.stringify({ ok: true }),
              headers: { 'content-type': 'application/json; charset=utf-8' },
              status: 200
            };
          }
        }
      });
      const response = binding.handleFrameworkRouteRequest({
        headers: {
          accept: ['application/json', 'text/plain']
        },
        method: 'get',
        pathname: 'api/finance/accounting-periods/2026-06/close-checks',
        query: {
          include: ['checks', 'sources'],
          preview: true
        }
      });

      assertEqual(response.handled, true, 'finance route should be handled');
      assert(delegatedRequest !== undefined, 'finance route should reach runtime');
      assertEqual(delegatedRequest.method, 'GET', 'framework binding should normalize method');
      assertEqual(
        delegatedRequest.url,
        '/api/finance/accounting-periods/2026-06/close-checks?include=checks&include=sources&preview=true',
        'framework binding should serialize pathname and query'
      );
      assertEqual(
        Array.isArray(delegatedRequest.headers?.accept),
        true,
        'framework binding should pass framework header values to runtime for normalization'
      );
    }
  },
  {
    name: 'closes a period through framework binding and row-backed runtime chain',
    run: () => {
      const { binding, repository } = createBindingStack({
        principal: createPrincipal()
      });
      const response = binding.handleFrameworkRouteRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'binding-close-001',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer finance-route-token',
          'content-type': 'application/json',
          'x-actor-id': 'forged-client-user',
          'x-permission-scopes': ''
        },
        method: 'POST',
        pathname: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);
      const event = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

      assertObject(body, 'framework close response body should be an object');
      assertEqual(response.handled, true, 'close route should be handled');
      assertEqual(response.status, 201, 'framework route close should create close snapshot');
      assertEqual(repository.readState().periods[0]?.status, '已结账', 'framework route close should persist lock');
      assertObject(body.closedBySnapshot, 'framework close response should include actor snapshot');
      assertEqual(body.closedBySnapshot.id, 'user-route-binding-001', 'close actor should come from server principal');
      assert(event !== undefined, 'framework route close should write close event');
      assertEqual(event.request_id, 'req-framework-binding-001', 'event request id should come from runtime');
    }
  },
  {
    name: 'rejects closed-period source mutation through framework binding',
    run: () => {
      const { binding, repository } = createBindingStack({
        principal: createPrincipal()
      });

      binding.handleFrameworkRouteRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'binding-close-before-source-001',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer finance-route-token',
          'content-type': 'application/json'
        },
        method: 'POST',
        pathname: '/api/finance/accounting-periods/2026-06/close'
      });
      const response = binding.handleFrameworkRouteRequest({
        bodyText: JSON.stringify({
          amount: '1500.00',
          expectedVersion: 1,
          status: '已调整'
        }),
        headers: {
          authorization: 'Bearer finance-route-token',
          'content-type': 'application/json'
        },
        method: 'PATCH',
        pathname: '/api/finance/receivables-payables/rp-binding-001/adjust'
      });
      const body = parseBody(response.bodyText);
      const sourceRecord = repository.readState().sourceRecords[0];
      const sourceEvent = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events[0];

      assertObject(body, 'framework source mutation response body should be an object');
      assertEqual(response.status, 409, 'closed-period source mutation should be rejected');
      assertEqual(body.code, canonicalClosedAccountingPeriodErrorCode, 'closed source mutation code should match');
      assertEqual(sourceRecord?.amount, '1200.00', 'closed source mutation should keep source amount unchanged');
      assertEqual(sourceRecord?.version, 1, 'closed source mutation should keep source version unchanged');
      assert(sourceEvent !== undefined, 'closed source mutation should write audit event');
      assertEqual(sourceEvent.event_type, 'source_mutation_rejected', 'closed source event should be rejection');
    }
  }
];

for (const test of tests) {
  test.run();
}
