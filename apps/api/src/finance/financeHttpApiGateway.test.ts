import {
  handleFinanceHttpApiGateway,
  type FinanceHttpApiGatewayState
} from './financeHttpApiGateway.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import { requiredCloseCheckCodes, type AccountingPeriodRecord, type CloseCheckCode, type CloseCheckRow } from './periodCloseContract.js';
import type { CashFlowMappingRecord, FinancialStatementLedgerEntry } from './financialStatementContract.js';
import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import type { GeneralLedgerSubjectRecord } from './generalLedgerContract.js';

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

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createCheck(code: CloseCheckCode, overrides: Partial<CloseCheckRow> = {}): CloseCheckRow {
  return {
    blockerCount: 0,
    canPass: true,
    code,
    label: code,
    sources: [],
    status: '通过',
    summary: '检查通过。',
    ...overrides
  };
}

function createCashFlowMapping(overrides: Partial<CashFlowMappingRecord> = {}): CashFlowMappingRecord {
  return {
    activity: '经营活动',
    createdAt: '2026-07-02T10:00:00+08:00',
    createdBySnapshot: { id: 'user-001', name: '李明' },
    effectivePeriod: '2026-01',
    item: '销售商品、提供劳务收到的现金',
    status: '有效',
    subjectCode: '1122',
    version: 1,
    ...overrides
  };
}

function createLedgerEntries(): FinancialStatementLedgerEntry[] {
  return [
    {
      accountingPeriod: '2026-06',
      creditAmount: '0.00',
      debitAmount: '1200.00',
      subjectCode: '1002',
      voucherId: 'voucher-receipt-001',
      voucherNo: '记-202606-001'
    },
    {
      accountingPeriod: '2026-06',
      creditAmount: '1200.00',
      debitAmount: '0.00',
      subjectCode: '1122',
      voucherId: 'voucher-receipt-001',
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
      id: 'ledger-http-bank',
      sourceSnapshotHash: 'chk_http_gateway_ledger',
      sourceVoucherLineId: 'line-http-bank',
      subjectCode: '1002',
      subjectName: '银行存款',
      summary: '客户回款确认',
      voucherDate: '2026-06-10',
      voucherId: 'voucher-receipt-001',
      voucherNo: '记-202606-001'
    },
    {
      accountingPeriod: '2026-06',
      auxiliary: '奈雪华南区域',
      creditAmount: '1200.00',
      createdAt: '2026-06-10T10:00:00+08:00',
      debitAmount: '0.00',
      id: 'ledger-http-receivable',
      sourceSnapshotHash: 'chk_http_gateway_ledger',
      sourceVoucherLineId: 'line-http-receivable',
      subjectCode: '1122',
      subjectName: '应收账款',
      summary: '客户回款确认',
      voucherDate: '2026-06-10',
      voucherId: 'voucher-receipt-001',
      voucherNo: '记-202606-001'
    }
  ];
}

function createGeneralLedgerSubjects(): GeneralLedgerSubjectRecord[] {
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
  const ledgerEntries = createLedgerEntries();

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
      subjects: createGeneralLedgerSubjects()
    },
    periodClose: {
      checkInputs: {
        '2026-06': {
          checks: requiredCloseCheckCodes.map((code) => createCheck(code)),
          computedAt: '2026-07-02T10:00:00+08:00',
          sourceVersionSetHash: 'src-http-gateway-v1',
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
          id: 'rp-001',
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
  'x-actor-id': 'user-001',
  'x-actor-name': '李明',
  'x-permission-scopes': financePeriodClosePermissionScopes.join(','),
  'x-request-id': 'req-http-gateway-001',
  'x-request-time': '2026-07-02T18:00:00+08:00'
};

const tests: UnitTest[] = [
  {
    name: 'rejects HTTP gateway requests before route logic when permission headers are missing',
    run: () => {
      const response = handleFinanceHttpApiGateway({
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods'
        },
        state: createGatewayState()
      });

      assertEqual(response.status, 403, 'gateway should enforce route permission contract');
      assertObject(response.body, 'permission error body should be an object');
      assertEqual(response.body.code, 'FORBIDDEN', 'permission error should use stable code');
      assertEqual(response.headers['content-type'], 'application/json; charset=utf-8', 'gateway should return JSON responses');
    }
  },
  {
    name: 'routes close checks through the HTTP gateway',
    run: () => {
      const response = handleFinanceHttpApiGateway({
        request: {
          headers,
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/close-checks'
        },
        state: createGatewayState()
      });

      assertEqual(response.status, 200, 'gateway close-check route should return 200');
      assertObject(response.body, 'close-check body should be an object');
      assertEqual(response.body.period, '2026-06', 'gateway should preserve period route parameter');
      assertEqual(response.body.canClose, true, 'gateway should expose route-adapter close result');
    }
  },
  {
    name: 'propagates period close locks to source mutation guard and financial statements',
    run: () => {
      const closeResponse = handleFinanceHttpApiGateway({
        request: {
          body: {
            idempotencyKey: 'http-gateway-close-001',
            reason: '2026-06 月结',
            version: 1
          },
          headers,
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createGatewayState()
      });

      assertEqual(closeResponse.status, 201, 'gateway close route should create close event');
      assertEqual(closeResponse.state.periodClose.periods[0]?.status, '已结账', 'period-close state should be closed');
      assertEqual(closeResponse.state.sourceMutation.periods[0]?.status, '已结账', 'source mutation guard should receive closed period');
      assertEqual(closeResponse.state.financialStatements.periods[0]?.status, '已结账', 'financial statements should receive closed period');
      assertEqual(closeResponse.state.generalLedger.periods[0]?.status, '已结账', 'general ledger should receive closed period');

      const sourceMutationResponse = handleFinanceHttpApiGateway({
        request: {
          body: {
            amount: '1300.00',
            targetAccountingPeriod: '2026-06'
          },
          headers: {
            ...headers,
            'x-request-id': 'req-http-gateway-source-001'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-001/adjust'
        },
        state: closeResponse.state
      });

      assertEqual(sourceMutationResponse.status, 409, 'closed period source mutation should be rejected');
      assertObject(sourceMutationResponse.body, 'source mutation rejection body should be an object');
      assertEqual(sourceMutationResponse.body.code, 'CLOSED_ACCOUNTING_PERIOD', 'source mutation should use closed-period guard code');
      assertEqual(
        sourceMutationResponse.state.sourceMutation.sourceRecords[0]?.amount,
        '1200.00',
        'rejected source mutation should not change source amount'
      );
      assertEqual(
        sourceMutationResponse.state.sourceMutation.events[0]?.eventType,
        'source_mutation_rejected',
        'rejected source mutation should append guard event'
      );

      const snapshotResponse = handleFinanceHttpApiGateway({
        request: {
          headers: {
            ...headers,
            'x-request-id': 'req-http-gateway-snapshot-001'
          },
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        },
        state: closeResponse.state
      });

      assertEqual(snapshotResponse.status, 201, 'closed period should allow statement snapshot generation');
      assertObject(snapshotResponse.body, 'statement snapshot body should be an object');
      assertEqual(snapshotResponse.state.financialStatements.statementSnapshots.length, 1, 'snapshot should be persisted in gateway state');
    }
  },
  {
    name: 'routes general-ledger reads through the HTTP gateway',
    run: () => {
      const response = handleFinanceHttpApiGateway({
        request: {
          headers,
          method: 'GET',
          path: '/api/finance/general-ledger',
          query: {
            period: '2026-06'
          }
        },
        state: createGatewayState()
      });

      assertEqual(response.status, 200, 'gateway general-ledger route should return 200');
      assertObject(response.body, 'general-ledger body should be an object');
      assertEqual(response.body.accountingPeriod, '2026-06', 'gateway should preserve requested ledger period');
      assertEqual(response.body.periodStatus, '开放', 'gateway should expose period status');
      assertObject(response.body.trialBalance, 'general-ledger body should include trial balance');
      assertEqual(response.body.trialBalance.status, '平衡', 'gateway should expose balanced ledger status');
    }
  },
  {
    name: 'returns stable not-found responses for unknown gateway routes',
    run: () => {
      const response = handleFinanceHttpApiGateway({
        request: {
          headers,
          method: 'GET',
          path: '/api/finance/unknown'
        },
        state: createGatewayState()
      });

      assertEqual(response.status, 404, 'unknown gateway route should return 404');
      assertObject(response.body, 'not-found body should be an object');
      assertEqual(response.body.code, 'NOT_FOUND', 'unknown gateway route should use stable code');
    }
  }
];

for (const test of tests) {
  test.run();
}
