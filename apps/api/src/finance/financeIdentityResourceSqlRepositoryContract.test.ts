import { createFinanceHttpAuthMiddleware } from './financeHttpAuthMiddlewareContract.js';
import { handleFinanceHttpApiRepositoryGateway } from './financeHttpApiRepositoryGatewayContract.js';
import { createFinanceHttpFrameworkRouteBinding } from './financeHttpFrameworkRouteBindingContract.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import { createFinanceHttpResourceAuthorizationMiddleware } from './financeHttpResourceAuthorizationContract.js';
import { createFinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import { createFinanceHttpServerRuntime } from './financeHttpServerRuntimeContract.js';
import {
  createFinanceIdentityResourceSqlSessionResolver,
  financeIdentityResourceSqlTableDefinitions,
  validateFinanceIdentityResourceSqlRows,
  type FinanceIdentityResourceSqlRows
} from './financeIdentityResourceSqlRepositoryContract.js';
import {
  financePeriodClosePermissionScopes,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
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

function assertThrows(fn: () => void, message: string) {
  let thrown = false;

  try {
    fn();
  } catch {
    thrown = true;
  }

  assert(thrown, message);
}

function parseBody(bodyText: string) {
  return JSON.parse(bodyText) as unknown;
}

function hashToken(token: string) {
  return `hash:${token}`;
}

function createPermissionGrantRows(userId = 'user-identity-001') {
  return financePeriodClosePermissionScopes.map((scope, index) => ({
    effective_from: '2026-01-01T00:00:00+08:00',
    grant_id: `permission-grant-${String(index + 1).padStart(3, '0')}`,
    permission_scope: scope,
    status: 'active' as const,
    user_id: userId
  }));
}

function createRows(overrides: Partial<FinanceIdentityResourceSqlRows> = {}): FinanceIdentityResourceSqlRows {
  return {
    identity_ledger_resource_grants: [
      {
        effective_from: '2026-01-01T00:00:00+08:00',
        grant_id: 'ledger-grant-001',
        ledger_key: 'default-ledger',
        status: 'active',
        user_id: 'user-identity-001'
      }
    ],
    identity_permission_grants: createPermissionGrantRows(),
    identity_sessions: [
      {
        expires_at: '2026-07-04T18:00:00+08:00',
        session_id: 'session-identity-001',
        session_token_hash: hashToken('session-token-001'),
        status: 'active',
        user_id: 'user-identity-001'
      }
    ],
    identity_users: [
      {
        display_name: '周会计',
        status: 'active',
        user_id: 'user-identity-001'
      }
    ],
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
    id: 'rp-identity-001',
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
        computedAt: '2026-07-04T17:30:00+08:00',
        sourceVersionSetHash: 'src-identity-v1',
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
    fallbackNow: '2026-07-04T17:30:00+08:00',
    initialState: createState(overrides)
  });
}

function createHandlerStack(rows: FinanceIdentityResourceSqlRows) {
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
    now: () => '2026-07-04T17:30:00+08:00',
    requestIdFactory: () => 'req-identity-resource-sql-001',
    resolvePrincipal: createFinanceIdentityResourceSqlSessionResolver({
      hashToken,
      now: () => '2026-07-04T17:30:00+08:00',
      rows
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
    name: 'defines SQL-shaped identity, session, permission and ledger grant tables',
    run: () => {
      const tableNames = financeIdentityResourceSqlTableDefinitions.map((definition) => definition.tableName);

      assertEqual(tableNames.includes('identity_users'), true, 'user table should be defined');
      assertEqual(tableNames.includes('identity_sessions'), true, 'session table should be defined');
      assertEqual(
        tableNames.includes('identity_permission_grants'),
        true,
        'permission grant table should be defined'
      );
      assertEqual(
        tableNames.includes('identity_ledger_resource_grants'),
        true,
        'ledger resource grant table should be defined'
      );
    }
  },
  {
    name: 'validates duplicate sessions, orphan grants and unknown permissions',
    run: () => {
      const validation = validateFinanceIdentityResourceSqlRows(
        createRows({
          identity_permission_grants: [
            {
              effective_from: '2026-01-01T00:00:00+08:00',
              grant_id: 'permission-orphan-001',
              permission_scope: 'finance.unknown.write' as FinancePeriodClosePermissionScope,
              status: 'active',
              user_id: 'missing-user'
            }
          ],
          identity_sessions: [
            {
              expires_at: '2026-07-04T18:00:00+08:00',
              session_id: 'session-identity-001',
              session_token_hash: hashToken('duplicate-token'),
              status: 'active',
              user_id: 'user-identity-001'
            },
            {
              expires_at: '2026-07-04T18:00:00+08:00',
              session_id: 'session-identity-002',
              session_token_hash: hashToken('duplicate-token'),
              status: 'active',
              user_id: 'user-identity-001'
            }
          ]
        })
      );

      assertEqual(validation.ok, false, 'invalid SQL rows should be rejected');
      assert(
        !validation.ok && validation.errors.some((error) => error.includes('Session token hash')),
        'duplicate token hash should be reported'
      );
      assert(
        !validation.ok && validation.errors.some((error) => error.includes('关联的用户不存在')),
        'orphan user grant should be reported'
      );
      assert(
        !validation.ok && validation.errors.some((error) => error.includes('未登记权限')),
        'unknown permission scope should be reported'
      );
    }
  },
  {
    name: 'throws before serving when SQL-shaped identity rows are invalid',
    run: () => {
      assertThrows(
        () =>
          createFinanceIdentityResourceSqlSessionResolver({
            hashToken,
            rows: createRows({
              identity_ledger_resource_grants: [
                {
                  effective_from: '2026-01-01T00:00:00+08:00',
                  grant_id: 'ledger-invalid-001',
                  ledger_key: 'default ledger with space',
                  status: 'active',
                  user_id: 'user-identity-001'
                }
              ]
            })
          }),
        'invalid SQL row contract should fail fast'
      );
    }
  },
  {
    name: 'resolves bearer token hash into actor permissions and ledger resource scopes',
    run: () => {
      const resolvePrincipal = createFinanceIdentityResourceSqlSessionResolver({
        hashToken,
        now: () => '2026-07-04T17:30:00+08:00',
        rows: createRows()
      });
      const principal = resolvePrincipal({
        authorization: 'Bearer session-token-001',
        headers: {},
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });

      assert(principal !== undefined, 'bearer token should resolve SQL-backed principal');
      assertEqual(principal.actorSnapshot.id, 'user-identity-001', 'principal actor should come from user row');
      assertEqual(principal.actorSnapshot.name, '周会计', 'principal name should come from user row');
      assertEqual(
        principal.permissionScopes.includes('finance.accountingPeriod.close'),
        true,
        'permission grant should be projected into principal'
      );
      assertEqual(
        principal.resourceScopes?.includes('finance.ledger:default-ledger'),
        true,
        'ledger grant should be projected into resource scopes'
      );
    }
  },
  {
    name: 'resolves cookie session without trusting client permission headers',
    run: () => {
      const resolvePrincipal = createFinanceIdentityResourceSqlSessionResolver({
        hashToken,
        now: () => '2026-07-04T17:30:00+08:00',
        rows: createRows({
          identity_permission_grants: [
            {
              effective_from: '2026-01-01T00:00:00+08:00',
              grant_id: 'permission-readonly-001',
              permission_scope: 'finance.accountingPeriod.read',
              status: 'active',
              user_id: 'user-identity-001'
            }
          ]
        })
      });
      const principal = resolvePrincipal({
        headers: {
          cookie: 'sms_session=session-token-001',
          'x-permission-scopes': 'finance.accountingPeriod.close'
        },
        method: 'GET',
        url: '/api/finance/accounting-periods/2026-06/close-checks'
      });

      assert(principal !== undefined, 'cookie token should resolve principal');
      assertEqual(
        principal.permissionScopes.includes('finance.accountingPeriod.close'),
        false,
        'client supplied permission header must not affect SQL-backed principal'
      );
    }
  },
  {
    name: 'rejects expired SQL-backed sessions before period close mutation',
    run: () => {
      const { handler, repository } = createHandlerStack(
        createRows({
          identity_sessions: [
            {
              expires_at: '2026-07-04T17:29:59+08:00',
              session_id: 'session-expired-001',
              session_token_hash: hashToken('expired-token'),
              status: 'active',
              user_id: 'user-identity-001'
            }
          ]
        })
      );
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'expired-sql-session-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer expired-token',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'expired SQL session response should be object');
      assertEqual(response.status, 401, 'expired SQL session should be unauthenticated');
      assertEqual(body.code, 'UNAUTHENTICATED', 'expired SQL session should use unauthenticated code');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'expired SQL session must not close period');
    }
  },
  {
    name: 'rejects disabled SQL-backed users through auth middleware',
    run: () => {
      const { handler, repository } = createHandlerStack(
        createRows({
          identity_users: [
            {
              display_name: '周会计',
              status: 'disabled',
              user_id: 'user-identity-001'
            }
          ]
        })
      );
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'disabled-sql-user-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer session-token-001',
          'content-type': 'application/json'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'disabled SQL user response should be object');
      assertEqual(response.status, 403, 'disabled SQL user should be forbidden');
      assertEqual(body.code, 'AUTH_PRINCIPAL_DISABLED', 'disabled SQL user should use stable auth code');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'disabled SQL user must not close period');
    }
  },
  {
    name: 'rejects active SQL-backed user without ledger resource grant before gateway mutation',
    run: () => {
      const { handler, repository } = createHandlerStack(
        createRows({
          identity_ledger_resource_grants: []
        })
      );
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'missing-ledger-sql-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          authorization: 'Bearer session-token-001',
          'content-type': 'application/json',
          'x-finance-resource-scopes': 'finance.ledger:*'
        },
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);

      assertObject(body, 'missing ledger SQL grant response should be object');
      assertEqual(response.status, 403, 'missing ledger SQL grant should reject close');
      assertEqual(body.code, 'FORBIDDEN', 'missing ledger SQL grant should use forbidden code');
      assertEqual(repository.readState().periods[0]?.status, '开放', 'missing ledger SQL grant must not close period');
    }
  },
  {
    name: 'allows SQL-backed session with permission and ledger grants to close through full handler chain',
    run: () => {
      const { handler, repository } = createHandlerStack(createRows());
      const response = handler.handleServerHandlerRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'sql-backed-session-close',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          cookie: 'sms_session=session-token-001',
          'content-type': 'application/json',
          'x-permission-scopes': 'finance.accountingPeriod.read'
        },
        method: 'POST',
        url: 'https://sms.test/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseBody(response.bodyText);
      const event = repository.readDatabaseSnapshot().periodCloseRows.accounting_period_events[0];

      assertObject(body, 'SQL-backed close response should be object');
      assertEqual(response.status, 201, 'SQL-backed identity should close period');
      assertEqual(repository.readState().periods[0]?.status, '已结账', 'SQL-backed close should lock period');
      assertObject(body.closedBySnapshot, 'SQL-backed close response should include actor snapshot');
      assertEqual(body.closedBySnapshot.id, 'user-identity-001', 'close actor should come from SQL user row');
      assert(event !== undefined, 'SQL-backed close should write close event');
      assertEqual(event.request_id, 'req-identity-resource-sql-001', 'close event should use trusted request id');
    }
  }
];

for (const test of tests) {
  test.run();
}
