import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import {
  createFinanceHttpAuthMiddleware,
  type FinanceHttpAuthenticatedPrincipal
} from './financeHttpAuthMiddlewareContract.js';
import {
  handleFinanceHttpApiGateway,
  type FinanceHttpApiGatewayState
} from './financeHttpApiGateway.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import type { CashFlowMappingRecord, FinancialStatementLedgerEntry } from './financialStatementContract.js';
import type { GeneralLedgerSubjectRecord } from './generalLedgerContract.js';
import type { FinancePeriodClosePermissionScope } from './periodCloseAuthorizationContract.js';
import { requiredCloseCheckCodes, type AccountingPeriodRecord, type CloseCheckRow } from './periodCloseContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

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

function parseResponseBody(responseBodyText: string) {
  return JSON.parse(responseBodyText) as unknown;
}

function createPrincipal(
  permissionScopes: readonly FinancePeriodClosePermissionScope[],
  overrides: Partial<FinanceHttpAuthenticatedPrincipal> = {}
): FinanceHttpAuthenticatedPrincipal {
  return {
    actorSnapshot: {
      id: 'user-auth-001',
      name: '王会计'
    },
    permissionScopes,
    status: 'active',
    ...overrides
  };
}

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createCloseCheck(code: CloseCheckRow['code']): CloseCheckRow {
  return {
    blockerCount: 0,
    canPass: true,
    code,
    label: code,
    sources: [],
    status: '通过',
    summary: '检查通过。'
  };
}

function createCashFlowMapping(): CashFlowMappingRecord {
  return {
    activity: '经营活动',
    createdAt: '2026-07-04T10:00:00+08:00',
    createdBySnapshot: { id: 'user-auth-001', name: '王会计' },
    effectivePeriod: '2026-01',
    item: '销售商品、提供劳务收到的现金',
    status: '有效',
    subjectCode: '1122',
    version: 1
  };
}

function createStatementLedgerEntries(): FinancialStatementLedgerEntry[] {
  return [
    {
      accountingPeriod: '2026-06',
      creditAmount: '0.00',
      debitAmount: '1200.00',
      subjectCode: '1002',
      voucherId: 'voucher-auth-001',
      voucherNo: '记-202606-001'
    },
    {
      accountingPeriod: '2026-06',
      creditAmount: '1200.00',
      debitAmount: '0.00',
      subjectCode: '1122',
      voucherId: 'voucher-auth-001',
      voucherNo: '记-202606-001'
    }
  ];
}

function createGeneralLedgerRows(): GeneralLedgerLifecycleRow[] {
  return [
    {
      accountingPeriod: '2026-06',
      auxiliary: '奈雪华南区域',
      creditAmount: '0.00',
      createdAt: '2026-06-10T10:00:00+08:00',
      debitAmount: '1200.00',
      id: 'ledger-auth-bank',
      sourceSnapshotHash: 'chk_auth_ledger',
      sourceVoucherLineId: 'line-auth-bank',
      subjectCode: '1002',
      subjectName: '银行存款',
      summary: '客户回款确认',
      voucherDate: '2026-06-10',
      voucherId: 'voucher-auth-001',
      voucherNo: '记-202606-001'
    },
    {
      accountingPeriod: '2026-06',
      auxiliary: '奈雪华南区域',
      creditAmount: '1200.00',
      createdAt: '2026-06-10T10:00:00+08:00',
      debitAmount: '0.00',
      id: 'ledger-auth-receivable',
      sourceSnapshotHash: 'chk_auth_ledger',
      sourceVoucherLineId: 'line-auth-receivable',
      subjectCode: '1122',
      subjectName: '应收账款',
      summary: '客户回款确认',
      voucherDate: '2026-06-10',
      voucherId: 'voucher-auth-001',
      voucherNo: '记-202606-001'
    }
  ];
}

function createSubjects(): GeneralLedgerSubjectRecord[] {
  return [
    {
      balanceDirection: '借方',
      code: '1002',
      name: '银行存款',
      reportItem: '货币资金',
      statementTarget: '资产负债表',
      status: '启用',
      type: '资产类'
    },
    {
      balanceDirection: '借方',
      code: '1122',
      name: '应收账款',
      reportItem: '应收账款',
      statementTarget: '资产负债表',
      status: '启用',
      type: '资产类'
    }
  ];
}

function createGatewayState(): FinanceHttpApiGatewayState {
  const periods = [createPeriod()];
  const cashFlowMappings = [createCashFlowMapping()];
  const ledgerEntries = createStatementLedgerEntries();

  return {
    financialStatements: {
      cashFlowMappings,
      ledgerEntries,
      periods,
      statementSnapshots: []
    },
    generalLedger: {
      ledgerRows: createGeneralLedgerRows(),
      periods,
      subjects: createSubjects()
    },
    periodClose: {
      checkInputs: {
        '2026-06': {
          checks: requiredCloseCheckCodes.map(createCloseCheck),
          computedAt: '2026-07-04T10:00:00+08:00',
          sourceVersionSetHash: 'src-auth-v1',
          trialBalance: {
            creditTotal: '1200.00',
            debitTotal: '1200.00',
            difference: '0.00',
            status: '平衡'
          }
        }
      },
      financialStatementInputs: {
        cashFlowMappings,
        ledgerEntries
      },
      idempotencyRecords: [],
      periods
    },
    sourceMutation: {
      events: [],
      periods,
      sourceRecords: []
    }
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects unauthenticated requests before transport delegation',
    run: () => {
      let delegated = false;
      const middleware = createFinanceHttpAuthMiddleware({
        transport: createFinanceHttpJsonTransport({
          handle: () => {
            delegated = true;

            return {
              body: {},
              headers: {},
              status: 200
            };
          }
        })
      });
      const response = middleware.handleAuthenticatedRequest({
        method: 'GET',
        url: '/api/finance/accounting-periods'
      });
      const body = parseResponseBody(response.bodyText);

      assertEqual(response.status, 401, 'unauthenticated request should be rejected');
      assertEqual(delegated, false, 'unauthenticated request should not reach transport');
      assertObject(body, 'unauthenticated response should be JSON');
      assertEqual(body.code, 'UNAUTHENTICATED', 'unauthenticated response should use stable code');
    }
  },
  {
    name: 'injects server-owned actor permission and request context instead of trusting client headers',
    run: () => {
      let delegatedHeaders: Record<string, string | undefined> | undefined;
      const middleware = createFinanceHttpAuthMiddleware({
        transport: createFinanceHttpJsonTransport({
          handle: (request) => {
            delegatedHeaders = request.headers;

            return {
              body: {
                actorId: request.headers?.['x-actor-id'],
                permissionScopes: request.headers?.['x-permission-scopes'],
                requestId: request.headers?.['x-request-id']
              },
              headers: {},
              status: 200
            };
          }
        })
      });
      const response = middleware.handleAuthenticatedRequest({
        headers: {
          'content-type': 'application/json',
          'x-actor-id': 'forged-user',
          'x-permission-scopes': 'finance.accountingPeriod.close'
        },
        method: 'GET',
        principal: createPrincipal(['finance.accountingPeriod.read']),
        receivedAt: '2026-07-04T13:00:00+08:00',
        requestId: 'req-auth-middleware-001',
        url: '/api/finance/accounting-periods'
      });
      const body = parseResponseBody(response.bodyText);

      assertObject(body, 'middleware response should be JSON');
      assertEqual(body.actorId, 'user-auth-001', 'server principal should own actor id');
      assertEqual(
        body.permissionScopes,
        'finance.accountingPeriod.read',
        'server principal should own permission scopes'
      );
      assertEqual(body.requestId, 'req-auth-middleware-001', 'server request id should be injected');
      assertEqual(delegatedHeaders?.['x-actor-id'], 'user-auth-001', 'delegated actor header should be trusted actor');
      assertEqual(
        delegatedHeaders?.['x-request-time'],
        '2026-07-04T13:00:00+08:00',
        'delegated request time should be server supplied'
      );
    }
  },
  {
    name: 'prevents client-supplied permission escalation from closing a period',
    run: () => {
      let state = createGatewayState();
      const middleware = createFinanceHttpAuthMiddleware({
        transport: createFinanceHttpJsonTransport({
          handle: (request) => {
            const response = handleFinanceHttpApiGateway({
              request,
              state
            });

            state = response.state;

            return response;
          }
        })
      });
      const response = middleware.handleAuthenticatedRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'auth-close-202606',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          'content-type': 'application/json',
          'x-permission-scopes': 'finance.accountingPeriod.close'
        },
        method: 'POST',
        principal: createPrincipal(['finance.accountingPeriod.read']),
        receivedAt: '2026-07-04T13:10:00+08:00',
        requestId: 'req-auth-close-denied',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseResponseBody(response.bodyText);

      assertEqual(response.status, 403, 'read-only principal should not close period');
      assertObject(body, 'forbidden response should be JSON');
      assertEqual(body.code, 'FORBIDDEN', 'gateway should return stable forbidden code');
      assertEqual(state.periodClose.periods[0]?.status, '开放', 'failed auth close should not lock period');
    }
  },
  {
    name: 'allows scoped active principal to close period through auth middleware and transport',
    run: () => {
      let state = createGatewayState();
      const middleware = createFinanceHttpAuthMiddleware({
        transport: createFinanceHttpJsonTransport({
          handle: (request) => {
            const response = handleFinanceHttpApiGateway({
              request,
              state
            });

            state = response.state;

            return response;
          }
        })
      });
      const response = middleware.handleAuthenticatedRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'auth-close-allowed-202606',
          reason: '2026-06 月结',
          version: 1
        }),
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST',
        principal: createPrincipal(['finance.accountingPeriod.close']),
        receivedAt: '2026-07-04T13:20:00+08:00',
        requestId: 'req-auth-close-allowed',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseResponseBody(response.bodyText);

      assertEqual(response.status, 201, 'scoped active principal should close period');
      assertObject(body, 'close response should be JSON');
      assertEqual(body.status, '已结账', 'close response should expose closed period status');
      assertObject(body.closedBySnapshot, 'close response should include server-owned close actor');
      assertEqual(body.closedBySnapshot.id, 'user-auth-001', 'close actor should come from authenticated principal');
      assertEqual(body.closedAt, '2026-07-04T13:20:00+08:00', 'close time should come from authenticated request context');
      assertEqual(state.periodClose.periods[0]?.status, '已结账', 'authorized close should lock period');
    }
  }
];

for (const test of tests) {
  test.run();
}
