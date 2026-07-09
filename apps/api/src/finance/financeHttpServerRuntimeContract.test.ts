import { createFinanceHttpAuthMiddleware, type FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
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
      id: 'user-runtime-001',
      name: '赵会计'
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
    id: 'rp-runtime-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-901',
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
        computedAt: '2026-07-04T13:00:00+08:00',
        sourceVersionSetHash: 'src-http-runtime-v1',
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
    fallbackNow: '2026-07-04T13:30:00+08:00',
    initialState: createState(overrides)
  });
}

function createRuntimeStack({
  maxBodyBytes,
  principal
}: {
  maxBodyBytes?: number;
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
    maxBodyBytes,
    now: () => '2026-07-04T13:30:00+08:00',
    requestIdFactory: () => 'req-runtime-server-001',
    resolvePrincipal: (request) => (request.authorization === 'Bearer finance-runtime-token' ? principal : undefined)
  });

  return {
    repository,
    runtime
  };
}

function jsonRequest(overrides: Partial<FinanceHttpServerRuntimeRequest> = {}): FinanceHttpServerRuntimeRequest {
  return {
    bodyText: JSON.stringify({
      idempotencyKey: 'runtime-close-001',
      reason: '2026-06 月结',
      version: 1
    }),
    headers: {
      authorization: 'Bearer finance-runtime-token',
      'content-type': 'application/json',
      'x-actor-id': 'forged-client-user',
      'x-actor-name': '伪造用户',
      'x-permission-scopes': ''
    },
    method: 'POST',
    url: '/api/finance/accounting-periods/2026-06/close',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects unauthenticated requests even when client sends forged finance headers',
    run: () => {
      const { repository, runtime } = createRuntimeStack();
      const response = runtime.handleServerRequest(
        jsonRequest({
          headers: {
            authorization: 'Bearer invalid-token',
            'content-type': 'application/json',
            'x-actor-id': 'forged-client-user',
            'x-permission-scopes': financePeriodClosePermissionScopes.join(',')
          }
        })
      );
      const body = parseBody(response.bodyText);

      assertObject(body, 'unauthenticated response body should be an object');
      assertEqual(response.status, 401, 'unauthenticated request should be rejected by runtime/auth chain');
      assertEqual(body.code, 'UNAUTHENTICATED', 'unauthenticated error code should match');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'unauthenticated request must not close period');
    }
  },
  {
    name: 'closes period through runtime with server-owned actor time request id and row-backed lock',
    run: () => {
      const { repository, runtime } = createRuntimeStack({
        principal: createPrincipal()
      });
      const response = runtime.handleServerRequest(jsonRequest());
      const body = parseBody(response.bodyText);
      const state = repository.readState();
      const event = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

      assertObject(body, 'close response body should be an object');
      assertEqual(response.status, 201, 'runtime close should create a close snapshot');
      assertEqual(state.periods[0]?.status, '已结账', 'runtime close should persist row-backed period lock');
      assertObject(body.closedBySnapshot, 'close actor snapshot should be returned');
      assertEqual(body.closedBySnapshot.id, 'user-runtime-001', 'close actor should come from runtime principal');
      assertEqual(body.closedAt, '2026-07-04T13:30:00+08:00', 'close time should come from runtime clock');
      assert(event !== undefined, 'close event should be persisted');
      assertEqual(event.actor_id, 'user-runtime-001', 'event actor should come from runtime principal');
      assertEqual(event.request_id, 'req-runtime-server-001', 'event request id should come from runtime factory');
    }
  },
  {
    name: 'rejects closed-period source mutation through the same runtime and keeps source row unchanged',
    run: () => {
      const { repository, runtime } = createRuntimeStack({
        principal: createPrincipal()
      });

      runtime.handleServerRequest(jsonRequest());
      const response = runtime.handleServerRequest(
        jsonRequest({
          bodyText: JSON.stringify({
            amount: '1300.00',
            expectedVersion: 1,
            status: '已调整'
          }),
          method: 'PATCH',
          url: '/api/finance/receivables-payables/rp-runtime-001/adjust'
        })
      );
      const body = parseBody(response.bodyText);
      const sourceRecord = repository.readState().sourceRecords[0];
      const sourceEvent = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events[0];

      assertObject(body, 'closed source mutation response body should be an object');
      assertEqual(response.status, 409, 'closed source mutation should be rejected');
      assertEqual(body.code, canonicalClosedAccountingPeriodErrorCode, 'closed source mutation code should match');
      assertEqual(sourceRecord?.amount, '1200.00', 'closed source mutation should not change source amount');
      assertEqual(sourceRecord?.version, 1, 'closed source mutation should not change source version');
      assert(sourceEvent !== undefined, 'closed source mutation rejection should write audit row');
      assertEqual(sourceEvent.event_type, 'source_mutation_rejected', 'source mutation audit event should be rejection');
      assertEqual(sourceEvent.request_id, 'req-runtime-server-001', 'source mutation audit uses runtime request id');
    }
  },
  {
    name: 'rejects oversized request body before auth middleware delegation',
    run: () => {
      let delegated = false;
      const runtime = createFinanceHttpServerRuntime({
        authMiddleware: {
          handleAuthenticatedRequest: () => {
            delegated = true;

            return {
              bodyText: JSON.stringify({ ok: true }),
              headers: { 'content-type': 'application/json; charset=utf-8' },
              status: 200
            };
          }
        },
        maxBodyBytes: 8,
        resolvePrincipal: () => createPrincipal()
      });
      const response = runtime.handleServerRequest(
        jsonRequest({
          bodyText: JSON.stringify({ value: '超过限制' })
        })
      );
      const body = parseBody(response.bodyText);

      assertObject(body, 'payload limit response body should be an object');
      assertEqual(response.status, 413, 'oversized request should be rejected');
      assertEqual(body.code, 'PAYLOAD_TOO_LARGE', 'oversized request code should match');
      assertEqual(delegated, false, 'oversized request must not reach auth middleware');
    }
  }
];

for (const test of tests) {
  test.run();
}
