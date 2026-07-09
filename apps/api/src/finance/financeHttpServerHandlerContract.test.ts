import { createFinanceHttpAuthMiddleware, type FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import {
  createFinanceHttpFrameworkRouteBinding,
  type FinanceHttpFrameworkRouteRequest
} from './financeHttpFrameworkRouteBindingContract.js';
import { handleFinanceHttpApiRepositoryGateway } from './financeHttpApiRepositoryGatewayContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import { createFinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import { createFinanceHttpServerRuntime } from './financeHttpServerRuntimeContract.js';
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
      id: 'user-server-handler-001',
      name: '孙会计'
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
    id: 'rp-handler-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-903',
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
        computedAt: '2026-07-04T15:00:00+08:00',
        sourceVersionSetHash: 'src-http-server-handler-v1',
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
    fallbackNow: '2026-07-04T15:30:00+08:00',
    initialState: createState(overrides)
  });
}

function createHandlerStack({
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
    now: () => '2026-07-04T15:30:00+08:00',
    requestIdFactory: () => 'req-server-handler-001',
    resolvePrincipal: (request) => (request.authorization === 'Bearer finance-handler-token' ? principal : undefined)
  });
  const routeBinding = createFinanceHttpFrameworkRouteBinding({ runtime });

  return {
    handler: createFinanceHttpServerHandler({ routeBinding }),
    repository
  };
}

const tests: UnitTest[] = [
  {
    name: 'parses absolute server url query hash and headers into framework route request',
    run: () => {
      let delegatedRequest: FinanceHttpFrameworkRouteRequest | undefined;
      const handler = createFinanceHttpServerHandler({
        routeBinding: {
          handleFrameworkRouteRequest: (request) => {
            delegatedRequest = request;

            return {
              bodyText: JSON.stringify({ ok: true }),
              handled: true,
              headers: { 'content-type': 'application/json; charset=utf-8' },
              status: 200
            };
          }
        }
      });
      const response = handler.handleServerHandlerRequest({
        bodyText: '{"ok":true}',
        headers: {
          authorization: 'Bearer token',
          accept: ['application/json', 'text/plain']
        },
        method: 'get',
        url: 'https://sms.test/api/finance/accounting-periods/2026-06/close-checks?include=checks&include=sources&keyword=%E6%9C%88%E7%BB%93#ignored'
      });

      assertEqual(response.status, 200, 'server handler should return delegated response');
      assert(delegatedRequest !== undefined, 'server handler should delegate parsed request');
      assertEqual(delegatedRequest.method, 'get', 'server handler should preserve raw method for route binding normalization');
      assertEqual(
        delegatedRequest.pathname,
        '/api/finance/accounting-periods/2026-06/close-checks',
        'server handler should parse absolute URL pathname'
      );
      assertEqual(Array.isArray(delegatedRequest.query?.include), true, 'repeated query should become array');
      assertEqual(delegatedRequest.query?.keyword, '月结', 'server handler should decode query values');
      assertEqual(Array.isArray(delegatedRequest.headers?.accept), true, 'server handler should preserve server headers');
      assertEqual(delegatedRequest.bodyText, '{"ok":true}', 'server handler should preserve body text');
    }
  },
  {
    name: 'keeps non-finance server requests outside the runtime chain',
    run: () => {
      const { handler, repository } = createHandlerStack({
        principal: createPrincipal()
      });
      const response = handler.handleServerHandlerRequest({
        headers: {
          authorization: 'Bearer finance-handler-token'
        },
        method: 'GET',
        url: '/api/people/overview'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'non-finance server response body should be an object');
      assertEqual(response.handled, false, 'non-finance server request should not be handled by finance chain');
      assertEqual(response.status, 404, 'non-finance server request should return route not bound');
      assertEqual(body.code, 'FINANCE_ROUTE_NOT_BOUND', 'non-finance server request code should match');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'non-finance request must not change period state');
    }
  },
  {
    name: 'closes a period through server handler binding runtime auth transport and repository gateway',
    run: () => {
      const { handler, repository } = createHandlerStack({
        principal: createPrincipal()
      });
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'handler-close-001',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer finance-handler-token',
          'content-type': 'application/json',
          'x-actor-id': 'forged-client-user',
          'x-permission-scopes': ''
        },
        method: 'POST',
        url: 'https://sms.test/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);
      const event = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

      assertObject(body, 'server handler close response body should be an object');
      assertEqual(response.handled, true, 'server handler should handle finance close route');
      assertEqual(response.status, 201, 'server handler close should create close snapshot');
      assertEqual(repository.readState().periods[0]?.status, '已结账', 'server handler close should persist period lock');
      assertObject(body.closedBySnapshot, 'server handler close response should include actor snapshot');
      assertEqual(body.closedBySnapshot.id, 'user-server-handler-001', 'close actor should come from server principal');
      assertEqual(body.closedAt, '2026-07-04T15:30:00+08:00', 'close time should come from server runtime clock');
      assert(event !== undefined, 'server handler close should write close event');
      assertEqual(event.request_id, 'req-server-handler-001', 'close event request id should come from server runtime');
    }
  },
  {
    name: 'rejects closed-period source mutation through the same server handler chain',
    run: () => {
      const { handler, repository } = createHandlerStack({
        principal: createPrincipal()
      });

      handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'handler-close-before-source-001',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer finance-handler-token',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          amount: '1600.00',
          expectedVersion: 1,
          status: '已调整'
        }),
        headers: {
          authorization: 'Bearer finance-handler-token',
          'content-type': 'application/json'
        },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/rp-handler-001/adjust'
      });
      const body = parseBody(response.bodyText);
      const sourceRecord = repository.readState().sourceRecords[0];
      const sourceEvent = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events[0];

      assertObject(body, 'server handler source mutation response body should be an object');
      assertEqual(response.status, 409, 'closed-period source mutation should be rejected');
      assertEqual(body.code, canonicalClosedAccountingPeriodErrorCode, 'closed source mutation code should match');
      assertEqual(sourceRecord?.amount, '1200.00', 'closed source mutation should keep source amount unchanged');
      assertEqual(sourceRecord?.version, 1, 'closed source mutation should keep source version unchanged');
      assert(sourceEvent !== undefined, 'closed source mutation should write audit event');
      assertEqual(sourceEvent.event_type, 'source_mutation_rejected', 'source mutation event should be rejection');
      assertEqual(sourceEvent.request_id, 'req-server-handler-001', 'source mutation event should use server runtime request id');
    }
  }
];

for (const test of tests) {
  test.run();
}
