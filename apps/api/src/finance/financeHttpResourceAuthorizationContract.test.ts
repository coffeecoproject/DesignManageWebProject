import { createFinanceHttpAuthMiddleware, type FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import {
  createFinanceHttpResourceAuthorizationMiddleware,
  type FinanceResourceScope
} from './financeHttpResourceAuthorizationContract.js';
import { createFinanceHttpServerRuntime } from './financeHttpServerRuntimeContract.js';
import { createFinanceHttpFrameworkRouteBinding } from './financeHttpFrameworkRouteBindingContract.js';
import { createFinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import { handleFinanceHttpApiRepositoryGateway } from './financeHttpApiRepositoryGatewayContract.js';
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

function createPrincipal(resourceScopes: readonly FinanceResourceScope[]): FinanceHttpAuthenticatedPrincipal {
  return {
    actorSnapshot: {
      id: 'user-resource-001',
      name: '赵会计'
    },
    permissionScopes: financePeriodClosePermissionScopes,
    resourceScopes,
    status: 'active'
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
    id: 'rp-resource-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-701',
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
        computedAt: '2026-07-04T16:30:00+08:00',
        sourceVersionSetHash: 'src-resource-v1',
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
    fallbackNow: '2026-07-04T16:30:00+08:00',
    initialState: createState(overrides)
  });
}

function createHandlerStack(principal: FinanceHttpAuthenticatedPrincipal) {
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
    now: () => '2026-07-04T16:30:00+08:00',
    requestIdFactory: () => 'req-resource-authorization-001',
    resolvePrincipal: (request) => (request.authorization === 'Bearer finance-resource-token' ? principal : undefined)
  });
  const routeBinding = createFinanceHttpFrameworkRouteBinding({ runtime });

  return {
    handler: createFinanceHttpServerHandler({ routeBinding }),
    repository
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects finance requests without ledger resource scope before gateway mutation',
    run: () => {
      const { handler, repository } = createHandlerStack(createPrincipal([]));
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'resource-close-denied-001',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer finance-resource-token',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'resource authorization rejection body should be object');
      assertEqual(response.status, 403, 'missing ledger resource scope should reject close');
      assertEqual(body.code, 'FORBIDDEN', 'missing ledger resource should use forbidden code');
      assertEqual(body.resourceKey, 'default-ledger', 'resource rejection should expose ledger key');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'resource rejection must not close period');
      assertEqual(repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events.length, 0, 'resource rejection must not write close events');
    }
  },
  {
    name: 'ignores client supplied ledger resource escalation and keeps server principal authoritative',
    run: () => {
      const { handler, repository } = createHandlerStack(createPrincipal([]));
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'resource-client-forged-001',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer finance-resource-token',
          'content-type': 'application/json',
          'x-finance-resource-scopes': 'finance.ledger:*'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });

      assertEqual(response.status, 403, 'client supplied resource scope should not grant access');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'forged resource scope must not close period');
    }
  },
  {
    name: 'allows exact ledger resource scope through server handler chain',
    run: () => {
      const { handler, repository } = createHandlerStack(createPrincipal(['finance.ledger:default-ledger']));
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'resource-close-allowed-001',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer finance-resource-token',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: 'https://sms.test/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);
      const event = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

      assertObject(body, 'resource-authorized close body should be object');
      assertEqual(response.status, 201, 'principal with ledger resource should close period');
      assertEqual(repository.readState().periods[0]?.status, '已结账', 'resource-authorized close should lock period');
      assertObject(body.closedBySnapshot, 'close response should include actor snapshot');
      assertEqual(body.closedBySnapshot.id, 'user-resource-001', 'close actor should be server principal');
      assert(event !== undefined, 'resource-authorized close should write close event');
      assertEqual(event.request_id, 'req-resource-authorization-001', 'close event should use trusted request id');
    }
  },
  {
    name: 'allows wildcard ledger resource scope through server handler chain',
    run: () => {
      const { handler } = createHandlerStack(createPrincipal(['finance.ledger:*']));
      const response = handler.handleServerHandlerRequest({
        headers: {
          authorization: 'Bearer finance-resource-token'
        },
        method: 'GET',
        url: '/api/finance/accounting-periods/2026-06/close-checks'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'resource-authorized close checks body should be object');
      assertEqual(response.status, 200, 'wildcard ledger resource should read close checks');
      assertEqual(body.period, '2026-06', 'close checks should still read requested period');
    }
  }
];

for (const test of tests) {
  test.run();
}
