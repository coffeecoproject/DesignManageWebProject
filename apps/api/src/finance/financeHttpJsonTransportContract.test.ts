import {
  handleFinanceHttpApiGateway,
  type FinanceHttpApiGatewayState
} from './financeHttpApiGateway.js';
import { createFinanceHttpJsonTransport } from './financeHttpJsonTransportContract.js';
import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import type { CashFlowMappingRecord, FinancialStatementLedgerEntry } from './financialStatementContract.js';
import type { GeneralLedgerSubjectRecord } from './generalLedgerContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import { requiredCloseCheckCodes, type AccountingPeriodRecord, type CloseCheckRow } from './periodCloseContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assert(condition: boolean, message: string) {
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

function parseResponseBody(responseBodyText: string) {
  return JSON.parse(responseBodyText) as unknown;
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
    createdBySnapshot: { id: 'user-001', name: '李明' },
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
      voucherId: 'voucher-transport-001',
      voucherNo: '记-202606-001'
    },
    {
      accountingPeriod: '2026-06',
      creditAmount: '1200.00',
      debitAmount: '0.00',
      subjectCode: '1122',
      voucherId: 'voucher-transport-001',
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
      id: 'ledger-transport-bank',
      sourceSnapshotHash: 'chk_transport_ledger',
      sourceVoucherLineId: 'line-transport-bank',
      subjectCode: '1002',
      subjectName: '银行存款',
      summary: '客户回款确认',
      voucherDate: '2026-06-10',
      voucherId: 'voucher-transport-001',
      voucherNo: '记-202606-001'
    },
    {
      accountingPeriod: '2026-06',
      auxiliary: '奈雪华南区域',
      creditAmount: '1200.00',
      createdAt: '2026-06-10T10:00:00+08:00',
      debitAmount: '0.00',
      id: 'ledger-transport-receivable',
      sourceSnapshotHash: 'chk_transport_ledger',
      sourceVoucherLineId: 'line-transport-receivable',
      subjectCode: '1122',
      subjectName: '应收账款',
      summary: '客户回款确认',
      voucherDate: '2026-06-10',
      voucherId: 'voucher-transport-001',
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
          sourceVersionSetHash: 'src-transport-v1',
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
      sourceRecords: [
        {
          accountingPeriod: '2026-06',
          amount: '1200.00',
          id: 'rp-transport-001',
          sourceArea: 'receivable_payable',
          sourceNo: 'AR-202606-001',
          status: '已生成',
          version: 1
        }
      ]
    }
  };
}

const headers = {
  'content-type': 'application/json',
  'x-actor-id': 'user-001',
  'x-actor-name': '李明',
  'x-permission-scopes': financePeriodClosePermissionScopes.join(','),
  'x-request-id': 'req-transport-001',
  'x-request-time': '2026-07-04T12:00:00+08:00'
};

const tests: UnitTest[] = [
  {
    name: 'parses HTTP URL query headers and JSON body before delegating to the gateway',
    run: () => {
      let receivedRequest: unknown;
      const transport = createFinanceHttpJsonTransport({
        handle: (request) => {
          receivedRequest = request;

          return {
            body: {
              amount: (request.body as { amount?: string } | undefined)?.amount,
              period: request.query?.period,
              requestId: request.headers?.['x-request-id']
            },
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'x-contract': 'transport'
            },
            status: 202
          };
        }
      });
      const response = transport.handleHttpRequest({
        bodyText: '{"amount":"1200.00"}',
        headers,
        method: 'post',
        url: 'https://local.test/api/finance/example?period=2026-06'
      });
      const body = parseResponseBody(response.bodyText);

      assertObject(receivedRequest, 'delegated request should be captured');
      assertEqual(receivedRequest.method, 'POST', 'transport should normalize method');
      assertEqual(receivedRequest.path, '/api/finance/example', 'transport should parse path');
      assertObject(receivedRequest.query, 'delegated request should include query');
      assertEqual(receivedRequest.query.period, '2026-06', 'transport should parse query');
      assertEqual(response.status, 202, 'transport should preserve gateway status');
      assertEqual(response.headers['x-contract'], 'transport', 'transport should preserve gateway headers');
      assertObject(body, 'serialized response body should parse as JSON');
      assertEqual(body.amount, '1200.00', 'transport should pass parsed JSON body to gateway');
    }
  },
  {
    name: 'rejects invalid JSON before gateway state changes',
    run: () => {
      let delegated = false;
      const transport = createFinanceHttpJsonTransport({
        handle: () => {
          delegated = true;

          return {
            body: {},
            headers: {},
            status: 200
          };
        }
      });
      const response = transport.handleHttpRequest({
        bodyText: '{"amount":',
        headers,
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const body = parseResponseBody(response.bodyText);

      assertEqual(response.status, 400, 'invalid JSON should be rejected at transport boundary');
      assertEqual(delegated, false, 'invalid JSON should not call the gateway');
      assertObject(body, 'error response should be JSON');
      assertEqual(body.code, 'INVALID_JSON_REQUEST', 'transport should use stable invalid JSON code');
    }
  },
  {
    name: 'runs period-close and source-mutation guard through JSON transport and gateway state',
    run: () => {
      let state = createGatewayState();
      const transport = createFinanceHttpJsonTransport({
        handle: (request) => {
          const response = handleFinanceHttpApiGateway({
            request,
            state
          });

          state = response.state;

          return response;
        }
      });
      const closeResponse = transport.handleHttpRequest({
        bodyText: JSON.stringify({
          idempotencyKey: 'transport-close-202606',
          reason: '2026-06 月结',
          version: 1
        }),
        headers,
        method: 'POST',
        url: '/api/finance/accounting-periods/2026-06/close'
      });
      const closeBody = parseResponseBody(closeResponse.bodyText);

      assertEqual(closeResponse.status, 201, 'period close should pass through transport');
      assertObject(closeBody, 'period close body should be serialized JSON');
      assertEqual(closeBody.status, '已结账', 'period close should update gateway state');
      assertEqual(state.periodClose.periods[0]?.status, '已结账', 'transport should preserve delegated state update');

      const mutationResponse = transport.handleHttpRequest({
        bodyText: JSON.stringify({
          amount: '1300.00',
          targetAccountingPeriod: '2026-06'
        }),
        headers: {
          ...headers,
          'x-request-id': 'req-transport-source-mutation'
        },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/rp-transport-001/adjust'
      });
      const mutationBody = parseResponseBody(mutationResponse.bodyText);

      assertEqual(mutationResponse.status, 409, 'closed-period source mutation should reject through transport');
      assertObject(mutationBody, 'source mutation rejection should be serialized JSON');
      assertEqual(mutationBody.code, 'CLOSED_ACCOUNTING_PERIOD', 'closed-period rejection code should survive transport');
      assertEqual(
        state.sourceMutation.sourceRecords[0]?.amount,
        '1200.00',
        'rejected mutation should not change source amount after transport delegation'
      );
      assert(
        state.sourceMutation.events.some((event) => event.eventType === 'source_mutation_rejected'),
        'rejected mutation should still write local guard audit event'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
