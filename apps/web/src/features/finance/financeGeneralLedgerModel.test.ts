import type { AccountingLedgerEntry, AccountingPeriodLockRecord } from './financeAccountingVoucherModel';
import {
  buildGeneralLedgerResponse,
  getGeneralLedgerReadbackNotice,
  getGeneralLedgerBalancePresentation,
  buildGeneralLedgerMetrics,
  buildGeneralLedgerSubjectBalances,
  defaultGeneralLedgerFilters,
  type GeneralLedgerOpeningBalance
} from './financeGeneralLedgerModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createLedgerEntry(overrides: Partial<AccountingLedgerEntry>): AccountingLedgerEntry {
  return {
    accountingPeriod: '2026-06',
    auxiliary: '测试对象',
    creditAmount: 0,
    debitAmount: 0,
    voucherNo: '记-202606-001',
    id: 'ledger-test-default',
    side: '借方',
    subjectCode: '1002',
    subjectName: '银行存款',
    summary: '测试分录',
    voucherDate: '2026-06-15',
    voucherId: 'voucher-test-001',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'aggregates debit and credit movements by accounting subject and period',
    run: () => {
      const entries: AccountingLedgerEntry[] = [
        createLedgerEntry({ debitAmount: 100, id: 'entry-bank-debit', subjectCode: '1002', voucherId: 'voucher-1' }),
        createLedgerEntry({ creditAmount: 20, id: 'entry-bank-credit', side: '贷方', subjectCode: '1002', voucherId: 'voucher-2' }),
        createLedgerEntry({
          creditAmount: 200,
          voucherNo: '记-202606-002',
          id: 'entry-income-credit',
          side: '贷方',
          subjectCode: '5001',
          subjectName: '主营业务收入',
          voucherId: 'voucher-3'
        })
      ];
      const openingBalances: GeneralLedgerOpeningBalance[] = [
        { accountingPeriod: '2026-06', amount: 1_000, subjectCode: '1002' }
      ];
      const rows = buildGeneralLedgerSubjectBalances({ entries, openingBalances });
      const bankRow = rows.find((row) => row.subjectCode === '1002');
      const incomeRow = rows.find((row) => row.subjectCode === '5001');
      const metrics = buildGeneralLedgerMetrics(rows);

      if (!bankRow || !incomeRow) {
        throw new Error('expected bank and income subject rows');
      }

      assertEqual(bankRow.openingBalance, 1000, 'bank opening balance should use configured opening balance');
      assertEqual(bankRow.debitAmount, 100, 'bank debit amount should aggregate current-period debit entries');
      assertEqual(bankRow.creditAmount, 20, 'bank credit amount should aggregate current-period credit entries');
      assertEqual(bankRow.endingBalance, 1080, 'debit-nature bank balance should add debit and subtract credit');
      assertEqual(bankRow.endingBalanceAmount, 1080, 'bank display balance should use absolute ending balance');
      assertEqual(bankRow.endingBalanceSide, '借方', 'positive bank balance should display as debit balance');
      assertEqual(incomeRow.endingBalance, 200, 'credit-nature revenue balance should add credit amount');
      assertEqual(metrics.bookedVoucherCount, 3, 'metrics should count unique booked vouchers in current period');
      assertEqual(metrics.debitTotal, 100, 'metrics should aggregate debit total');
      assertEqual(metrics.creditTotal, 220, 'metrics should aggregate credit total');
    }
  },
  {
    name: 'rolls prior-period movement into opening balance for the selected period',
    run: () => {
      const entries: AccountingLedgerEntry[] = [
        createLedgerEntry({
          accountingPeriod: '2026-05',
          debitAmount: 100,
          voucherNo: '记-202605-001',
          id: 'entry-prior-bank-debit',
          voucherDate: '2026-05-20'
        }),
        createLedgerEntry({
          creditAmount: 40,
          id: 'entry-current-bank-credit',
          side: '贷方'
        })
      ];
      const rows = buildGeneralLedgerSubjectBalances({
        entries,
        filters: {
          ...defaultGeneralLedgerFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-06' }
        },
        openingBalances: [{ accountingPeriod: '2026-05', amount: 1_000, subjectCode: '1002' }]
      });
      const bankRow = rows.find((row) => row.subjectCode === '1002');

      if (!bankRow) {
        throw new Error('expected bank subject row');
      }

      assertEqual(bankRow.openingBalance, 1100, 'prior-period debit should be carried into opening balance');
      assertEqual(bankRow.creditAmount, 40, 'current-period credit should stay in current movement');
      assertEqual(bankRow.endingBalance, 1060, 'ending balance should apply current movement after opening');
      assertEqual(bankRow.entries[0]?.runningBalance, 1060, 'detail running balance should start from adjusted opening');
    }
  },
  {
    name: 'keeps opening balance source labels business-facing',
    run: () => {
      const rows = buildGeneralLedgerSubjectBalances({
        entries: [],
        openingBalances: [
          { accountingPeriod: '2026-06', amount: 1_000, source: '期初余额承接', subjectCode: '1002' },
          { accountingPeriod: '2026-06', amount: 200, source: '期初导入', subjectCode: '1122' }
        ]
      });
      const sourceLabels = rows.map((row) => row.openingBalanceSource).join(' / ');

      assertEqual(sourceLabels.includes('后端'), false, 'visible opening-balance sources should not expose technical backend wording');
      assertEqual(sourceLabels.includes('期初余额承接'), true, 'external opening-balance carryover should use business wording');
      assertEqual(sourceLabels.includes('期初导入'), true, 'imported opening balances should retain business source wording');
    }
  },
  {
    name: 'presents opposite-side balances without negative display amounts',
    run: () => {
      const entries: AccountingLedgerEntry[] = [
        createLedgerEntry({
          creditAmount: 120,
          id: 'entry-bank-overdrawn',
          side: '贷方',
          subjectCode: '1002',
          voucherId: 'voucher-overdrawn'
        })
      ];
      const rows = buildGeneralLedgerSubjectBalances({
        entries,
        openingBalances: [{ accountingPeriod: '2026-06', amount: 100, subjectCode: '1002' }]
      });
      const bankRow = rows.find((row) => row.subjectCode === '1002');
      const directPresentation = getGeneralLedgerBalancePresentation(-20, '借方');

      if (!bankRow) {
        throw new Error('expected bank subject row');
      }

      assertEqual(bankRow.endingBalance, -20, 'signed balance should preserve accounting calculation');
      assertEqual(bankRow.endingBalanceAmount, 20, 'display balance should not expose a negative amount');
      assertEqual(bankRow.endingBalanceSide, '贷方', 'debit-nature negative balance should present as credit balance');
      assertEqual(directPresentation.amount, 20, 'balance presentation helper should return absolute amount');
      assertEqual(directPresentation.side, '贷方', 'balance presentation helper should flip balance side');
    }
  },
  {
    name: 'filters ledger rows by subject type and keyword',
    run: () => {
      const entries: AccountingLedgerEntry[] = [
        createLedgerEntry({ debitAmount: 100, subjectCode: '1002', voucherId: 'voucher-bank' }),
        createLedgerEntry({
          creditAmount: 200,
          voucherNo: '记-202606-002',
          id: 'entry-income-credit',
          side: '贷方',
          subjectCode: '5001',
          subjectName: '主营业务收入',
          summary: '客户收入确认',
          voucherId: 'voucher-income'
        })
      ];
      const profitRows = buildGeneralLedgerSubjectBalances({
        entries,
        filters: { ...defaultGeneralLedgerFilters, subjectType: '损益类' },
        openingBalances: []
      });
      const keywordRows = buildGeneralLedgerSubjectBalances({
        entries,
        filters: { ...defaultGeneralLedgerFilters, keyword: '记-202606-002' },
        openingBalances: []
      });

      assertEqual(profitRows.length, 1, 'subject type filter should keep only profit and loss subjects with movement');
      assertEqual(profitRows[0]?.subjectCode, '5001', 'profit and loss filter should return revenue subject');
      assertEqual(keywordRows.length, 1, 'keyword should match session voucher number from detail entries');
      assertEqual(keywordRows[0]?.subjectCode, '5001', 'keyword match should return the subject containing the voucher');
    }
  },
  {
    name: 'builds period response with unfiltered trial balance and period lock status',
    run: () => {
      const entries: AccountingLedgerEntry[] = [
        createLedgerEntry({
          creditAmount: 300,
          id: 'entry-bank-credit-response',
          side: '贷方',
          subjectCode: '1002',
          voucherId: 'voucher-response-1'
        }),
        createLedgerEntry({
          debitAmount: 300,
          id: 'entry-expense-debit-response',
          side: '借方',
          subjectCode: '5602.01',
          subjectName: '管理费用-办公费',
          summary: '办公支出',
          voucherId: 'voucher-response-1'
        })
      ];
      const response = buildGeneralLedgerResponse({
        entries,
        filters: {
          ...defaultGeneralLedgerFilters,
          keyword: '银行存款'
        },
        openingBalances: [],
        periodLocks: [
          {
            accountingPeriod: '2026-06',
            lockedAt: '2026-07-01 10:00',
            lockedBy: '李明',
            reason: '6 月结账完成',
            status: '已结账'
          }
        ]
      });

      assertEqual(response.rows.length, 1, 'visible rows should still follow keyword filter');
      assertEqual(response.metrics.subjectCount, 2, 'period metrics should ignore subject and keyword filters');
      assertEqual(response.periodSummary.periodStatus, '已结账', 'single-month period should expose lock status');
      assertEqual(response.periodSummary.lockedReason, '6 月结账完成', 'period summary should carry close reason for drawer readback');
      assertEqual(response.periodSummary.trialBalanceStatus, '平衡', 'trial balance should use full period rows');
      assertEqual(response.periodSummary.trialBalanceDifference, 0, 'balanced debit/credit difference should be zero');
      assertEqual(
        getGeneralLedgerReadbackNotice(response.periodSummary),
        '本期间已结账但缺少总账快照，当前仅为旧锁只读参考；正式回看需后端持久化总账快照承接。',
        'legacy closed lock should expose downgraded readback notice'
      );
      assertEqual(
        getGeneralLedgerReadbackNotice({
          ...response.periodSummary,
          periodStatus: '开放'
        }),
        undefined,
        'open period should not expose closed-period readback notice'
      );
    }
  },
  {
    name: 'uses closed-period ledger snapshot instead of live ledger drift',
    run: () => {
      const snapshotRows = buildGeneralLedgerSubjectBalances({
        entries: [
          createLedgerEntry({
            debitAmount: 500,
            id: 'entry-snapshot-bank-debit',
            subjectCode: '1002',
            voucherId: 'voucher-snapshot'
          }),
          createLedgerEntry({
            creditAmount: 500,
            id: 'entry-snapshot-revenue-credit',
            side: '贷方',
            subjectCode: '5001',
            subjectName: '主营业务收入',
            voucherId: 'voucher-snapshot'
          })
        ],
        openingBalances: []
      });
      const periodLocks: AccountingPeriodLockRecord[] = [
        {
          accountingPeriod: '2026-06',
          closeSummarySnapshot: {
            blockedCheckCount: 0,
            bookedVoucherCount: 1,
            creditTotal: 500,
            debitTotal: 500,
            generalLedgerRows: snapshotRows,
            readyToBookVoucherCount: 0,
            generatedVoucherCount: 1,
            issueVoucherCount: 0,
            pendingVoucherCount: 0,
            pendingReviewCashFlowCount: 0,
            socialInsurancePendingCount: 0,
            taxHandlingPendingCount: 0,
            trialBalanceDifference: 0,
            trialBalanceStatus: '平衡',
            unbookedVoucherCount: 0,
            unreconciledCashFlowCount: 0,
            voucherCount: 1
          },
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          reason: '6 月结账完成',
          status: '已结账'
        }
      ];
      const response = buildGeneralLedgerResponse({
        entries: [
          createLedgerEntry({
            debitAmount: 999,
            id: 'entry-live-drift',
            subjectCode: '1002',
            voucherId: 'voucher-live-drift'
          })
        ],
        filters: {
          ...defaultGeneralLedgerFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-06' }
        },
        openingBalances: [],
        periodLocks
      });

      assertEqual(response.periodSummary.readbackSource, '结账快照', 'closed period should mark ledger snapshot source');
      assertEqual(response.metrics.debitTotal, 500, 'closed period metrics should use close-time ledger snapshot');
      assertEqual(response.metrics.creditTotal, 500, 'closed period credit total should use close-time ledger snapshot');
      assertEqual(
        response.rows.some((row) => row.entries.some((entry) => entry.id === 'entry-live-drift')),
        false,
        'live ledger drift should not appear in closed-period ledger rows'
      );
      assertEqual(
        getGeneralLedgerReadbackNotice(response.periodSummary),
        '本期间已结账，总账按结账快照回看；如需修正，请走后续期间调整，反结账属于异常流程。',
        'closed period with snapshot should expose snapshot readback notice'
      );
    }
  }
];

export function runFinanceGeneralLedgerModelTests() {
  const failures: string[] = [];

  tests.forEach((test) => {
    try {
      test.run();
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
