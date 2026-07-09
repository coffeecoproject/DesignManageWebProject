import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import {
  handleGeneralLedgerRoute,
  type GeneralLedgerRouteState,
  type GeneralLedgerServerContext
} from './generalLedgerRoutes.js';
import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';
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

function assertReadModelBody(value: unknown, message: string): asserts value is {
  accountingPeriod: string;
  metrics: { subjectCount: number };
  periodStatus: string;
  readbackSource: string;
  rows: unknown[];
  serverTime: string;
  trialBalance: { status: string };
} {
  assertObject(value, message);
  assertObject(value.metrics, `${message}: metrics missing`);
  assertObject(value.trialBalance, `${message}: trialBalance missing`);
  if (!Array.isArray(value.rows)) {
    throw new Error(`${message}: rows missing`);
  }
}

const actor: ActorSnapshot = { id: 'user-001', name: '李明' };

function createContext(overrides: Partial<GeneralLedgerServerContext> = {}): GeneralLedgerServerContext {
  return {
    actorSnapshot: actor,
    now: '2026-07-04T10:00:00+08:00',
    permissionScopes: [...financePeriodClosePermissionScopes],
    requestId: 'req-general-ledger-route-001',
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

function createSubject(overrides: Partial<GeneralLedgerSubjectRecord>): GeneralLedgerSubjectRecord {
  return {
    balanceDirection: '借方',
    code: '1002',
    name: '银行存款',
    reportItem: '货币资金',
    statementTarget: '资产负债表',
    status: '启用',
    type: '资产类',
    ...overrides
  };
}

function createLedgerRow(overrides: Partial<GeneralLedgerLifecycleRow>): GeneralLedgerLifecycleRow {
  return {
    accountingPeriod: '2026-06',
    auxiliary: '奈雪华南区域',
    creditAmount: '0.00',
    createdAt: '2026-06-10T10:00:00+08:00',
    debitAmount: '0.00',
    id: 'ledger-row-default',
    sourceSnapshotHash: 'chk_general_ledger_route_source',
    sourceVoucherLineId: 'line-default',
    subjectCode: '1002',
    subjectName: '银行存款',
    summary: '客户回款确认',
    voucherDate: '2026-06-10',
    voucherId: 'voucher-202606-001',
    voucherNo: '记-202606-001',
    ...overrides
  };
}

function createState(overrides: Partial<GeneralLedgerRouteState> = {}): GeneralLedgerRouteState {
  return {
    ledgerRows: [
      createLedgerRow({
        debitAmount: '1200.00',
        id: 'ledger-route-bank',
        sourceVoucherLineId: 'line-route-bank'
      }),
      createLedgerRow({
        creditAmount: '1200.00',
        id: 'ledger-route-income',
        sourceVoucherLineId: 'line-route-income',
        subjectCode: '5001',
        subjectName: '主营业务收入',
        summary: '客户收入确认'
      })
    ],
    openingBalances: [
      {
        accountingPeriod: '2026-06',
        amount: '1000.00',
        source: '账套初始化',
        subjectCode: '1002'
      }
    ],
    periods: [createPeriod()],
    subjects: [
      createSubject({ code: '1002', name: '银行存款', type: '资产类' }),
      createSubject({
        balanceDirection: '贷方',
        code: '5001',
        name: '主营业务收入',
        reportItem: '营业收入',
        statementTarget: '利润表',
        type: '损益类'
      })
    ],
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects general-ledger reads before business logic when permission is missing',
    run: () => {
      const state = createState();
      const response = handleGeneralLedgerRoute({
        context: createContext({ permissionScopes: [] }),
        request: {
          method: 'GET',
          path: '/api/finance/general-ledger/2026-06'
        },
        state
      });

      assertEqual(response.status, 403, 'general-ledger route should require read permission');
      assertObject(response.body, 'forbidden response should be an object');
      assertEqual(response.body.code, 'FORBIDDEN', 'forbidden response should use stable code');
      assertEqual(response.state.ledgerRows.length, state.ledgerRows.length, 'forbidden read should not mutate state');
    }
  },
  {
    name: 'reads general ledger balances with unfiltered metrics and visible row filters',
    run: () => {
      const response = handleGeneralLedgerRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/general-ledger',
          query: {
            keyword: '主营业务收入',
            period: '2026-06',
            subjectType: '损益类'
          }
        },
        state: createState()
      });

      assertEqual(response.status, 200, 'general-ledger route should return read model');
      assertReadModelBody(response.body, 'read model body should be an object');
      assertEqual(response.body.accountingPeriod, '2026-06', 'read model should carry requested period');
      assertEqual(response.body.periodStatus, '开放', 'read model should expose period status');
      assertEqual(response.body.readbackSource, '已记账总账', 'open period should read posted ledger rows');
      assertEqual(response.body.rows.length, 1, 'visible rows should follow subject and keyword filters');
      assertEqual(response.body.metrics.subjectCount, 2, 'metrics should remain full-period, not visible-filtered');
      assertEqual(response.body.trialBalance.status, '平衡', 'balanced ledger rows should pass trial balance');
      assertEqual(response.body.serverTime, '2026-07-04T10:00:00+08:00', 'route should return server time');
    }
  },
  {
    name: 'returns closed-period general-ledger readback source and stable errors',
    run: () => {
      const closedRead = handleGeneralLedgerRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/general-ledger/2026-06'
        },
        state: createState({
          periods: [createPeriod({ status: '已结账' })]
        })
      });
      const missingPeriod = handleGeneralLedgerRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/general-ledger/2026-05'
        },
        state: createState()
      });
      const invalidPeriod = handleGeneralLedgerRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/general-ledger',
          query: { period: '2026' }
        },
        state: createState()
      });

      assertReadModelBody(closedRead.body, 'closed read body should be an object');
      assertEqual(closedRead.body.readbackSource, '结账总账', 'closed period should expose close-ledger readback');
      assertEqual(missingPeriod.status, 404, 'missing period should return not found');
      assertObject(missingPeriod.body, 'missing period response should be an object');
      assertEqual(missingPeriod.body.code, 'NOT_FOUND', 'missing period should use stable code');
      assertEqual(invalidPeriod.status, 400, 'invalid period should return bad request');
      assertObject(invalidPeriod.body, 'invalid period response should be an object');
      assertEqual(invalidPeriod.body.code, 'INVALID_REQUEST', 'invalid period should use stable code');
    }
  }
];

for (const test of tests) {
  test.run();
}
