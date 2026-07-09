import { request as createNodeRequest } from 'node:http';

import { createFinanceHttpAuthMiddleware } from './financeHttpAuthMiddlewareContract.js';
import { handleFinanceHttpApiRepositoryGateway } from './financeHttpApiRepositoryGatewayContract.js';
import { createFinanceHttpFrameworkRouteBinding } from './financeHttpFrameworkRouteBindingContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import { createFinanceHttpResourceAuthorizationMiddleware } from './financeHttpResourceAuthorizationContract.js';
import { createFinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import { createFinanceHttpServerRuntime } from './financeHttpServerRuntimeContract.js';
import {
  createFinanceIdentityResourceSqlSessionResolver,
  type FinanceIdentityResourceSqlRows
} from './financeIdentityResourceSqlRepositoryContract.js';
import { createFinanceNodeHttpServerContract } from './financeNodeHttpServerContract.js';
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
  run: () => Promise<void>;
};

type HttpClientResponse = {
  bodyText: string;
  headers: Record<string, string | readonly string[] | undefined>;
  status: number;
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

function hashToken(token: string) {
  return `hash:${token}`;
}

function createIdentityRows(): FinanceIdentityResourceSqlRows {
  return {
    identity_ledger_resource_grants: [
      {
        effective_from: '2026-01-01T00:00:00+08:00',
        grant_id: 'ledger-grant-node-server-001',
        ledger_key: 'default-ledger',
        status: 'active',
        user_id: 'user-node-server-001'
      }
    ],
    identity_permission_grants: financePeriodClosePermissionScopes.map((scope, index) => ({
      effective_from: '2026-01-01T00:00:00+08:00',
      grant_id: `permission-node-server-${String(index + 1).padStart(3, '0')}`,
      permission_scope: scope,
      status: 'active',
      user_id: 'user-node-server-001'
    })),
    identity_sessions: [
      {
        expires_at: '2026-07-04T18:00:00+08:00',
        session_id: 'session-node-server-001',
        session_token_hash: hashToken('node-server-session-token'),
        status: 'active',
        user_id: 'user-node-server-001'
      }
    ],
    identity_users: [
      {
        display_name: '许会计',
        status: 'active',
        user_id: 'user-node-server-001'
      }
    ]
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
    id: 'rp-node-server-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-1001',
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
        computedAt: '2026-07-04T17:45:00+08:00',
        sourceVersionSetHash: 'src-node-server-v1',
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
    fallbackNow: '2026-07-04T17:45:00+08:00',
    initialState: createState(overrides)
  });
}

function createServerStack() {
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
    now: () => '2026-07-04T17:45:00+08:00',
    requestIdFactory: () => 'req-node-http-server-001',
    resolvePrincipal: createFinanceIdentityResourceSqlSessionResolver({
      hashToken,
      now: () => '2026-07-04T17:45:00+08:00',
      rows: createIdentityRows()
    })
  });
  const routeBinding = createFinanceHttpFrameworkRouteBinding({ runtime });
  const handler = createFinanceHttpServerHandler({ routeBinding });

  return {
    repository,
    serverContract: createFinanceNodeHttpServerContract({ handler })
  };
}

function sendHttpRequest({
  bodyText,
  headers,
  method,
  origin,
  path
}: {
  bodyText?: string;
  headers?: Record<string, string | undefined>;
  method: string;
  origin: string;
  path: string;
}) {
  return new Promise<HttpClientResponse>((resolve, reject) => {
    const clientRequest = createNodeRequest(
      `${origin}${path}`,
      {
        headers,
        method
      },
      (response) => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += String(chunk ?? '');
        });
        response.on('end', () => {
          resolve({
            bodyText: responseBody,
            headers: response.headers,
            status: response.statusCode ?? 0
          });
        });
        response.on('error', (error) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      }
    );

    clientRequest.on('error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });

    if (bodyText) {
      clientRequest.write(bodyText);
    }

    clientRequest.end();
  });
}

const tests: UnitTest[] = [
  {
    name: 'serves close checks through a real local HTTP listener with SQL-backed cookie identity',
    run: async () => {
      const { serverContract } = createServerStack();
      const server = await serverContract.listen();

      try {
        const response = await sendHttpRequest({
          headers: {
            cookie: 'sms_session=node-server-session-token',
            'x-permission-scopes': ''
          },
          method: 'GET',
          origin: server.origin,
          path: '/api/finance/accounting-periods/2026-06/close-checks?include=checks&include=sources'
        });
        const body = parseBody(response.bodyText);

        assertObject(body, 'node server close-check body should be object');
        assertEqual(response.status, 200, 'node server should serve close checks');
        assertEqual(response.headers['x-finance-local-server-handled'], 'true', 'node server should mark finance route handled');
        assertEqual(body.period, '2026-06', 'node server close-check should preserve period');
      } finally {
        await server.close();
      }
    }
  },
  {
    name: 'closes a period and rejects later source mutation through the same real local HTTP listener',
    run: async () => {
      const { repository, serverContract } = createServerStack();
      const server = await serverContract.listen();

      try {
        const closeResponse = await sendHttpRequest({
          bodyText: JSON.stringify({
            idempotencyKey: 'node-http-close-001',
            reason: '2026-06 月结',
            version: 1
          }),
          headers: {
            cookie: 'sms_session=node-server-session-token',
            'content-type': 'application/json',
            'x-actor-id': 'forged-node-client',
            'x-finance-resource-scopes': 'finance.ledger:*',
            'x-permission-scopes': ''
          },
          method: 'POST',
          origin: server.origin,
          path: '/api/finance/accounting-periods/2026-06/close'
        });
        const closeBody = parseBody(closeResponse.bodyText);
        const closeEvent = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

        assertObject(closeBody, 'node server close body should be object');
        assertEqual(closeResponse.status, 201, 'node server should close period');
        assertEqual(repository.readState().periods[0]?.status, '已结账', 'node server close should persist row-backed lock');
        assertObject(closeBody.closedBySnapshot, 'node server close should include actor snapshot');
        assertEqual(closeBody.closedBySnapshot.id, 'user-node-server-001', 'close actor should come from SQL-backed session');
        assert(closeEvent !== undefined, 'node server close should write close event');
        assertEqual(closeEvent.request_id, 'req-node-http-server-001', 'node server close should use trusted request id');

        const sourceResponse = await sendHttpRequest({
          bodyText: JSON.stringify({
            amount: '1600.00',
            expectedVersion: 1,
            status: '已调整'
          }),
          headers: {
            cookie: 'sms_session=node-server-session-token',
            'content-type': 'application/json'
          },
          method: 'PATCH',
          origin: server.origin,
          path: '/api/finance/receivables-payables/rp-node-server-001/adjust'
        });
        const sourceBody = parseBody(sourceResponse.bodyText);
        const sourceRecord = repository.readState().sourceRecords[0];
        const sourceEvent = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events[0];

        assertObject(sourceBody, 'node server source mutation body should be object');
        assertEqual(sourceResponse.status, 409, 'node server closed-period source mutation should be rejected');
        assertEqual(sourceBody.code, canonicalClosedAccountingPeriodErrorCode, 'node server source mutation code should match');
        assertEqual(sourceRecord?.amount, '1200.00', 'node server source mutation should keep amount unchanged');
        assertEqual(sourceRecord?.version, 1, 'node server source mutation should keep version unchanged');
        assert(sourceEvent !== undefined, 'node server source mutation should write guard event');
        assertEqual(sourceEvent.request_id, 'req-node-http-server-001', 'node server source guard should use trusted request id');
      } finally {
        await server.close();
      }
    }
  },
  {
    name: 'keeps non-finance requests outside the runtime through the real local HTTP listener',
    run: async () => {
      const { repository, serverContract } = createServerStack();
      const server = await serverContract.listen();

      try {
        const response = await sendHttpRequest({
          method: 'GET',
          origin: server.origin,
          path: '/api/people/overview'
        });
        const body = parseBody(response.bodyText);

        assertObject(body, 'node server non-finance response should be object');
        assertEqual(response.status, 404, 'node server non-finance route should return 404');
        assertEqual(response.headers['x-finance-local-server-handled'], 'false', 'node server should mark non-finance route unhandled');
        assertEqual(body.code, 'FINANCE_ROUTE_NOT_BOUND', 'node server non-finance code should match');
        assertEqual(repository.readState().periods[0]?.status, '开放', 'non-finance request must not change period state');
      } finally {
        await server.close();
      }
    }
  }
];

for (const test of tests) {
  await test.run();
}
