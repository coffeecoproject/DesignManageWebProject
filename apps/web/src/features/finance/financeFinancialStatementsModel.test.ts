import type { GeneralLedgerPeriodSummary, GeneralLedgerSubjectBalanceRow } from './financeGeneralLedgerModel';
import { buildFinanceFinancialStatementReport } from './financeFinancialStatementsModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createPeriodSummary(overrides: Partial<GeneralLedgerPeriodSummary> = {}): GeneralLedgerPeriodSummary {
  return {
    bookedVoucherCount: 2,
    creditTotal: 100,
    debitTotal: 100,
    entryCount: 4,
    openingBalanceSource: '账套初始化',
    periodKey: '2026-06',
    periodLabel: '2026-06 当月',
    periodStatus: '开放',
    readbackSource: '实时总账',
    subjectCount: 4,
    trialBalanceDifference: 0,
    trialBalanceStatus: '平衡',
    ...overrides
  };
}

function createSubjectRow(overrides: Partial<GeneralLedgerSubjectBalanceRow>): GeneralLedgerSubjectBalanceRow {
  return {
    balanceDirection: '借方',
    creditAmount: 0,
    debitAmount: 0,
    endingBalance: 0,
    endingBalanceAmount: 0,
    endingBalanceSide: '平',
    entries: [],
    entryCount: 0,
    hasCurrentMovement: false,
    openingBalance: 0,
    openingBalanceAmount: 0,
    openingBalanceSide: '平',
    openingBalanceSource: '无期初余额',
    reportItem: '未归集',
    statementTarget: '不直接出表',
    subjectCode: '0000',
    subjectId: 'subject-test',
    subjectName: '测试科目',
    subjectType: '资产类',
    voucherCount: 0,
    ...overrides
  };
}

function createLedgerEntry(
  overrides: Partial<GeneralLedgerSubjectBalanceRow['entries'][number]>
): GeneralLedgerSubjectBalanceRow['entries'][number] {
  return {
    accountingPeriod: '2026-06',
    auxiliary: '测试辅助',
    creditAmount: 0,
    debitAmount: 0,
    id: 'ledger-entry-test',
    runningBalance: 0,
    side: '借方',
    subjectCode: '1002',
    subjectName: '银行存款',
    summary: '测试分录',
    voucherDate: '2026-06-15',
    voucherId: 'voucher-test',
    voucherNo: 'VCH-202606-T001',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds trial financial statements from general-ledger subject balances only',
    run: () => {
      const report = buildFinanceFinancialStatementReport({
        periodSummary: createPeriodSummary(),
        subjectRows: [
          createSubjectRow({
            endingBalance: 10_000,
            openingBalance: 10_000,
            reportItem: '货币资金',
            statementTarget: '资产负债表',
            subjectCode: '1002',
            subjectName: '银行存款',
            subjectType: '资产类'
          }),
          createSubjectRow({
            balanceDirection: '贷方',
            endingBalance: 3_000,
            reportItem: '应付账款',
            statementTarget: '资产负债表',
            subjectCode: '2202',
            subjectName: '应付账款',
            subjectType: '负债类'
          }),
          createSubjectRow({
            balanceDirection: '贷方',
            endingBalance: 7_000,
            reportItem: '实收资本',
            statementTarget: '资产负债表',
            subjectCode: '3001',
            subjectName: '实收资本',
            subjectType: '所有者权益类'
          }),
          createSubjectRow({
            balanceDirection: '贷方',
            creditAmount: 12_000,
            reportItem: '营业收入',
            statementTarget: '利润表',
            subjectCode: '5001',
            subjectName: '主营业务收入',
            subjectType: '损益类'
          }),
          createSubjectRow({
            debitAmount: 4_500,
            reportItem: '营业成本',
            statementTarget: '利润表',
            subjectCode: '5401',
            subjectName: '主营业务成本',
            subjectType: '损益类'
          })
        ]
      });

      assertEqual(report.accountingPeriod, '2026-06', 'report should keep the accounting period key');
      assertEqual(report.mode, '待结账', 'open period should produce pending-close statement mode');
      assertEqual(report.assetTotal, 10_000, 'asset total should come from balance-sheet ledger rows');
      assertEqual(report.liabilityEquityTotal, 10_000, 'liability and equity total should come from balance-sheet ledger rows');
      assertEqual(report.profitTotal, 7_500, 'profit total should derive from profit-statement ledger rows');
      assertEqual(report.cashFlowReadiness, '可出具', 'period with no cash movement can issue a zero cash-flow statement');
      assertEqual(report.cashFlowOpeningBalance, 10_000, 'cash-flow statement should expose opening cash balance');
      assertEqual(report.cashFlowClosingBalance, 10_000, 'cash-flow statement should expose closing cash balance');
      assertEqual(report.reportBasis.includes('2 张已记账凭证'), true, 'statement basis should expose booked-voucher ledger source');
    }
  },
  {
    name: 'builds cash-flow statement lines from booked cash voucher counterpart mappings',
    run: () => {
      const report = buildFinanceFinancialStatementReport({
        periodSummary: createPeriodSummary(),
        subjectRows: [
          createSubjectRow({
            debitAmount: 12_000,
            endingBalance: 12_000,
            entries: [
              createLedgerEntry({
                debitAmount: 12_000,
                id: 'ledger-bank-debit',
                side: '借方',
                subjectCode: '1002',
                subjectName: '银行存款'
              })
            ],
            hasCurrentMovement: true,
            reportItem: '货币资金',
            statementTarget: '资产负债表',
            subjectCode: '1002',
            subjectName: '银行存款',
            subjectType: '资产类'
          }),
          createSubjectRow({
            cashFlowActivity: '经营活动',
            cashFlowItem: '销售商品、提供劳务收到的现金',
            creditAmount: 12_000,
            entries: [
              createLedgerEntry({
                creditAmount: 12_000,
                debitAmount: 0,
                id: 'ledger-ar-credit',
                side: '贷方',
                subjectCode: '1122',
                subjectName: '应收账款'
              })
            ],
            hasCurrentMovement: true,
            reportItem: '应收账款',
            statementTarget: '资产负债表',
            subjectCode: '1122',
            subjectName: '应收账款',
            subjectType: '资产类'
          })
        ]
      });

      assertEqual(report.cashFlowReadiness, '可出具', 'mapped cash voucher should make cash-flow statement issuable');
      assertEqual(report.cashFlowLines.length, 1, 'mapped cash voucher should produce one cash-flow line');
      assertEqual(report.cashFlowLines[0]?.amount, 12_000, 'cash-flow line should use cash-side movement amount');
      assertEqual(report.cashFlowLines[0]?.yearToDateAmount, 12_000, 'cash-flow line should expose year-to-date amount');
      assertEqual(report.cashFlowNetAmount, 12_000, 'cash-flow net amount should aggregate mapped lines');
      assertEqual(report.cashFlowClosingBalance, 12_000, 'cash-flow closing balance should come from cash subjects');
      assertEqual(report.cashFlowReconciliationDifference, 0, 'cash-flow net should reconcile to cash balance movement');
      assertEqual(report.cashFlowMappingGaps.length, 0, 'mapped cash voucher should not produce mapping gaps');
    }
  },
  {
    name: 'keeps cash-flow statement pending when cash voucher counterpart lacks mapping',
    run: () => {
      const report = buildFinanceFinancialStatementReport({
        periodSummary: createPeriodSummary(),
        subjectRows: [
          createSubjectRow({
            creditAmount: 3_200,
            endingBalance: 0,
            entries: [
              createLedgerEntry({
                creditAmount: 3_200,
                debitAmount: 0,
                id: 'ledger-bank-credit',
                side: '贷方',
                subjectCode: '1002',
                subjectName: '银行存款'
              })
            ],
            hasCurrentMovement: true,
            openingBalance: 3_200,
            reportItem: '货币资金',
            statementTarget: '资产负债表',
            subjectCode: '1002',
            subjectName: '银行存款',
            subjectType: '资产类'
          }),
          createSubjectRow({
            debitAmount: 3_200,
            entries: [
              createLedgerEntry({
                debitAmount: 3_200,
                id: 'ledger-unmapped-debit',
                side: '借方',
                subjectCode: '1999',
                subjectName: '未映射科目'
              })
            ],
            hasCurrentMovement: true,
            reportItem: '未归集',
            statementTarget: '不直接出表',
            subjectCode: '1999',
            subjectName: '未映射科目',
            subjectType: '资产类'
          })
        ]
      });

      assertEqual(report.cashFlowReadiness, '待处理', 'unmapped cash counterpart should keep cash-flow statement pending');
      assertEqual(report.cashFlowLines.length, 0, 'unmapped cash counterpart should not fabricate cash-flow lines');
      assertEqual(report.cashFlowMappingGaps.length, 1, 'unmapped cash counterpart should produce one mapping gap');
      assertEqual(
        report.cashFlowReadinessDetail.includes('缺少对方科目现金流量项目映射'),
        true,
        'cash-flow readiness detail should explain the mapping gap'
      );
    }
  },
  {
    name: 'keeps cash-flow statement pending when only part of a cash voucher has mapping',
    run: () => {
      const report = buildFinanceFinancialStatementReport({
        periodSummary: createPeriodSummary(),
        subjectRows: [
          createSubjectRow({
            debitAmount: 1_000,
            endingBalance: 1_000,
            entries: [
              createLedgerEntry({
                debitAmount: 1_000,
                id: 'ledger-bank-partial-debit',
                side: '借方',
                subjectCode: '1002',
                subjectName: '银行存款',
                voucherId: 'voucher-partial',
                voucherNo: 'VCH-202606-P001'
              })
            ],
            hasCurrentMovement: true,
            reportItem: '货币资金',
            statementTarget: '资产负债表',
            subjectCode: '1002',
            subjectName: '银行存款',
            subjectType: '资产类'
          }),
          createSubjectRow({
            cashFlowActivity: '经营活动',
            cashFlowItem: '销售商品、提供劳务收到的现金',
            creditAmount: 600,
            entries: [
              createLedgerEntry({
                creditAmount: 600,
                debitAmount: 0,
                id: 'ledger-ar-partial-credit',
                side: '贷方',
                subjectCode: '1122',
                subjectName: '应收账款',
                voucherId: 'voucher-partial',
                voucherNo: 'VCH-202606-P001'
              })
            ],
            hasCurrentMovement: true,
            reportItem: '应收账款',
            statementTarget: '资产负债表',
            subjectCode: '1122',
            subjectName: '应收账款',
            subjectType: '资产类'
          }),
          createSubjectRow({
            creditAmount: 400,
            entries: [
              createLedgerEntry({
                creditAmount: 400,
                debitAmount: 0,
                id: 'ledger-unmapped-partial-credit',
                side: '贷方',
                subjectCode: '1999',
                subjectName: '未映射科目',
                voucherId: 'voucher-partial',
                voucherNo: 'VCH-202606-P001'
              })
            ],
            hasCurrentMovement: true,
            reportItem: '未归集',
            statementTarget: '不直接出表',
            subjectCode: '1999',
            subjectName: '未映射科目',
            subjectType: '负债类'
          })
        ]
      });

      assertEqual(report.cashFlowReadiness, '待处理', 'partially mapped voucher should keep cash-flow statement pending');
      assertEqual(report.cashFlowLines[0]?.amount, 600, 'mapped cash-flow line should only take the mapped allocation');
      assertEqual(report.cashFlowMappingGaps[0]?.amount, 400, 'unmapped allocation should remain as a mapping gap');
      assertEqual(report.cashFlowReconciliationDifference, -400, 'cash-flow reconciliation should expose the unmapped residual');
    }
  },
  {
    name: 'uses close readback wording for closed accounting periods',
    run: () => {
      const report = buildFinanceFinancialStatementReport({
        periodSummary: createPeriodSummary({
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          lockedReason: '月结',
          periodStatus: '已结账'
        }),
        subjectRows: []
      });

      assertEqual(report.mode, '正式报表', 'closed period should use formal statement mode');
      assertEqual(
        report.reportNotice.includes('缺少结账报表快照'),
        true,
        'closed-period statement without snapshot should expose missing snapshot notice'
      );
    }
  },
  {
    name: 'uses closed-period financial statement snapshot instead of live subject drift',
    run: () => {
      const report = buildFinanceFinancialStatementReport({
        periodSummary: createPeriodSummary({
          financialStatementSnapshot: {
            accountingPeriod: '2026-06',
            assetTotal: 88_000,
            balanceSheetLines: [
              {
                amount: 88_000,
                itemName: '货币资金',
                section: '资产',
                sourceSubjectCodes: ['1002'],
                sourceSubjectCount: 1
              }
            ],
            cashFlowLines: [],
            cashFlowMappingGaps: [],
            cashFlowNetAmount: 0,
            cashFlowReadiness: '可出具',
            cashFlowReadinessDetail: '结账时现金流量表已确认。',
            cashFlowYearToDateNetAmount: 0,
            liabilityEquityTotal: 88_000,
            periodLabel: '2026-06 当月',
            profitLines: [
              {
                amount: 12_000,
                itemName: '营业收入',
                section: '收入',
                sourceSubjectCodes: ['5001'],
                sourceSubjectCount: 1
              }
            ],
            profitTotal: 12_000,
            reportBasis: '总账：1 张已记账凭证 / 88,000.00 元借方 / 88,000.00 元贷方',
            trialBalanceStatus: '平衡'
          },
          periodStatus: '已结账',
          readbackSource: '结账快照'
        }),
        subjectRows: [
          createSubjectRow({
            endingBalance: 1,
            reportItem: '货币资金',
            statementTarget: '资产负债表',
            subjectCode: '1002',
            subjectName: '银行存款',
            subjectType: '资产类'
          })
        ]
      });

      assertEqual(report.mode, '正式报表', 'closed period should still use formal statement mode');
      assertEqual(report.assetTotal, 88_000, 'closed report should use close-time statement snapshot');
      assertEqual(report.profitTotal, 12_000, 'closed profit should use close-time statement snapshot');
      assertEqual(report.balanceSheetLines[0]?.amount, 88_000, 'live subject drift should not replace balance-sheet snapshot');
      assertEqual(
        report.reportNotice.includes('结账时生成的正式报表'),
        true,
        'closed report with snapshot should expose formal statement notice'
      );
    }
  }
];

export function runFinanceFinancialStatementsModelTests() {
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
