import { createFinanceHttpAuthMiddleware, type FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import { createFinanceHttpConcreteFrameworkAdapter } from './financeHttpConcreteFrameworkAdapterContract.js';
import { handleFinanceHttpApiRepositoryGateway } from './financeHttpApiRepositoryGatewayContract.js';
import { createFinanceHttpFrameworkRouteBinding } from './financeHttpFrameworkRouteBindingContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import { createFinanceHttpResourceAuthorizationMiddleware } from './financeHttpResourceAuthorizationContract.js';
import type { FinanceHttpServerHandlerRequest } from './financeHttpServerHandlerContract.js';
import { createFinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import { createFinanceHttpServerRuntime } from './financeHttpServerRuntimeContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import { requiredCloseCheckCodes, type CloseCheckRow } from './periodCloseContract.js';
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

type CapturedFrameworkResponse = {
  bodyText?: string;
  headers: Record<string, string>;
  status?: number;
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
      id: 'user-concrete-framework-001',
      name: '周会计'
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
    id: 'rp-concrete-framework-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-904',
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
        computedAt: '2026-07-05T09:00:00+08:00',
        sourceVersionSetHash: 'src-concrete-framework-v1',
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
    fallbackNow: '2026-07-05T09:30:00+08:00',
    initialState: createState(overrides)
  });
}

function createAdapterStack({
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
  const resourceAuthorization = createFinanceHttpResourceAuthorizationMiddleware({ transport });
  const runtime = createFinanceHttpServerRuntime({
    authMiddleware: createFinanceHttpAuthMiddleware({ transport: resourceAuthorization }),
    now: () => '2026-07-05T09:30:00+08:00',
    requestIdFactory: () => 'req-concrete-framework-001',
    resolvePrincipal: (request) => (request.authorization === 'Bearer finance-framework-token' ? principal : undefined)
  });
  const routeBinding = createFinanceHttpFrameworkRouteBinding({ runtime });
  const handler = createFinanceHttpServerHandler({ routeBinding });

  return {
    adapter: createFinanceHttpConcreteFrameworkAdapter({
      frameworkName: 'express-like-local-contract',
      handler
    }),
    repository
  };
}

function createResponseWriter() {
  const captured: CapturedFrameworkResponse = {
    headers: {}
  };

  return {
    captured,
    writer: {
      send: (bodyText: string) => {
        captured.bodyText = bodyText;
      },
      setHeader: (name: string, value: string) => {
        captured.headers[name.toLowerCase()] = value;
      },
      status: (status: number) => {
        captured.status = status;
      }
    }
  };
}

const tests: UnitTest[] = [
  {
    name: 'maps concrete framework request body query headers and writes framework response',
    run: () => {
      let delegatedRequest: FinanceHttpServerHandlerRequest | undefined;
      const adapter = createFinanceHttpConcreteFrameworkAdapter({
        frameworkName: 'express-like-local-contract',
        handler: {
          handleServerHandlerRequest: (request) => {
            delegatedRequest = request;

            return {
              bodyText: JSON.stringify({ ok: true }),
              handled: true,
              headers: {
                'content-type': 'application/json; charset=utf-8',
                'x-finance-test': 'adapter'
              },
              status: 202
            };
          }
        }
      });
      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          expectedCheckSnapshotHash: 'hash-client-001'
        },
        headers: {
          accept: ['application/json', 'text/plain']
        },
        method: 'post',
        path: '/api/finance/accounting-periods/2026-06/close',
        query: {
          include: ['checks', 'sources'],
          preview: true
        }
      });
      const { captured, writer } = createResponseWriter();

      adapter.writeConcreteFrameworkResponse(writer, response);

      assert(delegatedRequest !== undefined, 'concrete adapter should delegate to server handler');
      assertEqual(delegatedRequest.method, 'post', 'adapter should preserve concrete framework method');
      assertEqual(
        delegatedRequest.url,
        '/api/finance/accounting-periods/2026-06/close?include=checks&include=sources&preview=true',
        'adapter should compose framework path and query'
      );
      assertEqual(
        delegatedRequest.bodyText,
        '{"expectedCheckSnapshotHash":"hash-client-001"}',
        'adapter should serialize framework body objects'
      );
      assertEqual(Array.isArray(delegatedRequest.headers?.accept), true, 'adapter should preserve framework headers');
      assertEqual(response.adapterTrace.adapterKind, 'local_concrete_framework_adapter_contract', 'trace should identify local adapter');
      assertEqual(response.adapterTrace.handled, true, 'trace should preserve handled state');
      assertEqual(captured.status, 202, 'response writer should receive status');
      assertEqual(
        captured.headers['content-type'],
        'application/json; charset=utf-8',
        'response writer should receive JSON content type'
      );
      assertEqual(captured.headers['x-finance-test'], 'adapter', 'response writer should receive custom headers');
      assertEqual(captured.bodyText, '{"ok":true}', 'response writer should receive serialized body');
    }
  },
  {
    name: 'closes a period through concrete framework adapter with server-owned actor permission and resource context',
    run: () => {
      const { adapter, repository } = createAdapterStack({
        principal: createPrincipal()
      });
      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          idempotencyKey: 'concrete-framework-close-001',
          reason: '2026-06 月结',
          version: 1
        },
        headers: {
          authorization: 'Bearer finance-framework-token',
          'content-type': 'application/json',
          'x-actor-id': 'forged-client-user',
          'x-finance-resource-scopes': 'finance.ledger:*',
          'x-permission-scopes': ''
        },
        method: 'POST',
        originalUrl: 'https://sms.test/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);
      const event = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

      assertObject(body, 'concrete framework close response body should be an object');
      assertEqual(response.status, 201, 'concrete framework close should create close snapshot');
      assertEqual(response.adapterTrace.frameworkName, 'express-like-local-contract', 'trace should preserve framework name');
      assertEqual(response.adapterTrace.handled, true, 'finance route should be handled');
      assertEqual(repository.readState().periods[0]?.status, '已结账', 'concrete framework close should persist lock');
      assertObject(body.closedBySnapshot, 'concrete framework close should include server-owned actor');
      assertEqual(body.closedBySnapshot.id, 'user-concrete-framework-001', 'actor should come from server principal');
      assert(event !== undefined, 'concrete framework close should write close event');
      assertEqual(event.request_id, 'req-concrete-framework-001', 'request id should come from runtime');
    }
  },
  {
    name: 'rejects client-forged resource scope when server principal has no ledger resource',
    run: () => {
      const { adapter, repository } = createAdapterStack({
        principal: createPrincipal({
          resourceScopes: []
        })
      });
      const response = adapter.handleConcreteFrameworkRequest({
        body: {
          idempotencyKey: 'concrete-framework-forged-resource-001',
          reason: '2026-06 月结',
          version: 1
        },
        headers: {
          authorization: 'Bearer finance-framework-token',
          'content-type': 'application/json',
          'x-finance-resource-scopes': 'finance.ledger:*'
        },
        method: 'POST',
        pathname: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'forged resource response body should be an object');
      assertEqual(response.status, 403, 'missing server-owned resource scope should be forbidden');
      assertEqual(body.code, 'FORBIDDEN', 'forged resource response code should match');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'forged resource request must not mutate period');
    }
  },
  {
    name: 'keeps non-finance concrete framework requests outside the finance runtime',
    run: () => {
      const { adapter, repository } = createAdapterStack({
        principal: createPrincipal()
      });
      const response = adapter.handleConcreteFrameworkRequest({
        headers: {
          authorization: 'Bearer finance-framework-token'
        },
        method: 'GET',
        originalUrl: '/api/people/overview?tab=summary'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'non-finance concrete framework response body should be an object');
      assertEqual(response.handled, false, 'non-finance concrete framework route should not be handled');
      assertEqual(response.status, 404, 'non-finance concrete framework route should return not-bound');
      assertEqual(body.code, 'FINANCE_ROUTE_NOT_BOUND', 'non-finance concrete framework code should match');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'non-finance request must not mutate period');
    }
  },
  {
    name: 'rejects unsupported concrete framework finance methods before state mutation',
    run: () => {
      const { adapter, repository } = createAdapterStack({
        principal: createPrincipal()
      });
      const response = adapter.handleConcreteFrameworkRequest({
        headers: {
          authorization: 'Bearer finance-framework-token'
        },
        method: 'DELETE',
        pathname: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'unsupported method response body should be an object');
      assertEqual(response.handled, true, 'unsupported finance method should be handled by route binding');
      assertEqual(response.status, 405, 'unsupported finance method should return 405');
      assertEqual(body.code, 'FINANCE_METHOD_NOT_ALLOWED', 'unsupported finance method code should match');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'unsupported method must not mutate period');
    }
  }
];

for (const test of tests) {
  test.run();
}
