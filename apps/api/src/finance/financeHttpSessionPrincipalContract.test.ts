import { createFinanceHttpAuthMiddleware } from './financeHttpAuthMiddlewareContract.js';
import { createFinanceHttpFrameworkRouteBinding } from './financeHttpFrameworkRouteBindingContract.js';
import { handleFinanceHttpApiRepositoryGateway } from './financeHttpApiRepositoryGatewayContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import { createFinanceHttpResourceAuthorizationMiddleware } from './financeHttpResourceAuthorizationContract.js';
import { createFinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import { createFinanceHttpServerRuntime } from './financeHttpServerRuntimeContract.js';
import {
  createFinanceHttpSessionPrincipalResolver,
  type FinanceHttpSessionPrincipalRecord
} from './financeHttpSessionPrincipalContract.js';
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

function createSession(
  overrides: Partial<FinanceHttpSessionPrincipalRecord> = {}
): FinanceHttpSessionPrincipalRecord {
  return {
    actorSnapshot: {
      id: 'user-session-001',
      name: '钱会计'
    },
    expiresAt: '2026-07-04T18:00:00+08:00',
    ledgerResourceKeys: ['default-ledger'],
    permissionScopes: financePeriodClosePermissionScopes,
    sessionToken: 'session-token-001',
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
    id: 'rp-session-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-801',
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
        computedAt: '2026-07-04T17:00:00+08:00',
        sourceVersionSetHash: 'src-session-v1',
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
    fallbackNow: '2026-07-04T17:00:00+08:00',
    initialState: createState(overrides)
  });
}

function createHandlerStack(sessions: readonly FinanceHttpSessionPrincipalRecord[]) {
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
    now: () => '2026-07-04T17:00:00+08:00',
    requestIdFactory: () => 'req-session-principal-001',
    resolvePrincipal: createFinanceHttpSessionPrincipalResolver({
      now: () => '2026-07-04T17:00:00+08:00',
      sessions
    })
  });
  const routeBinding = createFinanceHttpFrameworkRouteBinding({ runtime });

  return {
    handler: createFinanceHttpServerHandler({ routeBinding }),
    repository
  };
}

const tests: UnitTest[] = [
  {
    name: 'resolves bearer session into actor permissions and ledger resources',
    run: () => {
      const resolvePrincipal = createFinanceHttpSessionPrincipalResolver({
        now: () => '2026-07-04T17:00:00+08:00',
        sessions: [createSession()]
      });
      const principal = resolvePrincipal({
        authorization: 'Bearer session-token-001',
        headers: {},
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });

      assert(principal !== undefined, 'bearer session should resolve principal');
      assertEqual(principal.actorSnapshot.id, 'user-session-001', 'principal actor should come from session');
      assertEqual(
        principal.resourceScopes?.includes('finance.ledger:default-ledger'),
        true,
        'ledger resource should be derived from session ledger access'
      );
    }
  },
  {
    name: 'resolves cookie session when authorization header is absent',
    run: () => {
      const resolvePrincipal = createFinanceHttpSessionPrincipalResolver({
        now: () => '2026-07-04T17:00:00+08:00',
        sessions: [createSession()]
      });
      const principal = resolvePrincipal({
        headers: {
          cookie: 'theme=light; sms_session=session-token-001'
        },
        method: 'GET',
        url: '/api/finance/accounting-periods/2026-06/close-checks'
      });

      assert(principal !== undefined, 'cookie session should resolve principal');
      assertEqual(principal.actorSnapshot.name, '钱会计', 'cookie principal should keep actor snapshot');
    }
  },
  {
    name: 'rejects expired sessions before period close mutation',
    run: () => {
      const { handler, repository } = createHandlerStack([
        createSession({
          expiresAt: '2026-07-04T16:59:59+08:00',
          sessionToken: 'expired-session-token'
        })
      ]);
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'expired-session-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer expired-session-token',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'expired session response should be object');
      assertEqual(response.status, 401, 'expired session should be unauthenticated');
      assertEqual(body.code, 'UNAUTHENTICATED', 'expired session should use unauthenticated code');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'expired session must not close period');
    }
  },
  {
    name: 'rejects disabled session principals through auth middleware',
    run: () => {
      const { handler, repository } = createHandlerStack([
        createSession({
          sessionToken: 'disabled-session-token',
          status: 'disabled'
        })
      ]);
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'disabled-session-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer disabled-session-token',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'disabled session response should be object');
      assertEqual(response.status, 403, 'disabled session should be forbidden by auth middleware');
      assertEqual(body.code, 'AUTH_PRINCIPAL_DISABLED', 'disabled session should use stable auth code');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'disabled session must not close period');
    }
  },
  {
    name: 'ignores client-supplied permissions and resources when session is read only',
    run: () => {
      const { handler, repository } = createHandlerStack([
        createSession({
          permissionScopes: ['finance.accountingPeriod.read'],
          sessionToken: 'readonly-session-token'
        })
      ]);
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'readonly-forged-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer readonly-session-token',
          'content-type': 'application/json',
          'x-finance-resource-scopes': 'finance.ledger:*',
          'x-permission-scopes': 'finance.accountingPeriod.close'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'forged readonly session response should be object');
      assertEqual(response.status, 403, 'forged close permission should be rejected');
      assertEqual(body.code, 'FORBIDDEN', 'forged close permission should use gateway forbidden code');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'forged readonly session must not close period');
    }
  },
  {
    name: 'allows cookie session with ledger access to close through full handler chain',
    run: () => {
      const { handler, repository } = createHandlerStack([createSession()]);
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'cookie-session-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          cookie: 'sms_session=session-token-001',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: 'https://sms.test/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);
      const event = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

      assertObject(body, 'cookie session close response should be object');
      assertEqual(response.status, 201, 'cookie session with ledger access should close period');
      assertEqual(repository.readState().periods[0]?.status, '已结账', 'cookie session should lock period');
      assertObject(body.closedBySnapshot, 'close response should include actor snapshot');
      assertEqual(body.closedBySnapshot.id, 'user-session-001', 'close actor should come from session principal');
      assert(event !== undefined, 'cookie session close should write close event');
      assertEqual(event.request_id, 'req-session-principal-001', 'close event should use runtime request id');
    }
  }
];

for (const test of tests) {
  test.run();
}
