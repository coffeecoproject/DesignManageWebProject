import {
  buildFinancialStatementLedgerEntriesFromGeneralLedgerRows,
  buildGeneralLedgerReadModel,
  getGeneralLedgerBalancePresentation,
  type GeneralLedgerOpeningBalanceRecord,
  type GeneralLedgerSubjectRecord
} from './generalLedgerContract.js';
import { buildFinancialStatementReadiness, type CashFlowMappingRecord } from './financialStatementContract.js';
import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

const actor: ActorSnapshot = { id: 'user-001', name: '李明' };

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
    sourceSnapshotHash: 'chk_source_snapshot',
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

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createMapping(overrides: Partial<CashFlowMappingRecord> = {}): CashFlowMappingRecord {
  return {
    activity: '经营活动',
    createdAt: '2026-01-01T10:00:00+08:00',
    createdBySnapshot: actor,
    effectivePeriod: '2026-01',
    item: '销售商品、提供劳务收到的现金',
    status: '有效',
    subjectCode: '5001',
    version: 1,
    ...overrides
  };
}

const baseSubjects: GeneralLedgerSubjectRecord[] = [
  createSubject({ code: '1002', name: '银行存款', type: '资产类' }),
  createSubject({
    balanceDirection: '贷方',
    code: '5001',
    name: '主营业务收入',
    reportItem: '营业收入',
    statementTarget: '利润表',
    type: '损益类'
  }),
  createSubject({
    code: '5602.01',
    name: '管理费用-办公费',
    reportItem: '管理费用',
    statementTarget: '利润表',
    type: '损益类'
  })
];

const tests: UnitTest[] = [
  {
    name: 'builds subject balances from posted ledger rows and opening balances',
    run: () => {
      const openingBalances: GeneralLedgerOpeningBalanceRecord[] = [
        {
          accountingPeriod: '2026-05',
          amount: '1000.00',
          source: '账套初始化',
          subjectCode: '1002'
        }
      ];
      const ledgerRows: GeneralLedgerLifecycleRow[] = [
        createLedgerRow({
          accountingPeriod: '2026-05',
          creditAmount: '200.00',
          id: 'ledger-prior-bank-credit',
          side: undefined,
          sourceVoucherLineId: 'line-prior-bank',
          voucherDate: '2026-05-20',
          voucherNo: '记-202605-001'
        } as Partial<GeneralLedgerLifecycleRow>),
        createLedgerRow({
          debitAmount: '1200.00',
          id: 'ledger-current-bank-debit',
          sourceVoucherLineId: 'line-current-bank'
        }),
        createLedgerRow({
          creditAmount: '1200.00',
          id: 'ledger-current-income-credit',
          sourceVoucherLineId: 'line-current-income',
          subjectCode: '5001',
          subjectName: '主营业务收入'
        })
      ];
      const readModel = buildGeneralLedgerReadModel({
        accountingPeriod: '2026-06',
        ledgerRows,
        openingBalances,
        periods: [createPeriod()],
        subjects: baseSubjects
      });
      const bankRow = readModel.rows.find((row) => row.subjectCode === '1002');
      const incomeRow = readModel.rows.find((row) => row.subjectCode === '5001');

      if (!bankRow || !incomeRow) {
        throw new Error('expected bank and income rows');
      }

      assertEqual(bankRow.openingBalance, '800.00', 'prior credit should reduce debit-nature opening balance');
      assertEqual(bankRow.debitAmount, '1200.00', 'bank debit should aggregate current period movement');
      assertEqual(bankRow.endingBalance, '2000.00', 'bank ending balance should apply current debit movement');
      assertEqual(incomeRow.creditAmount, '1200.00', 'income credit should aggregate current period movement');
      assertEqual(readModel.metrics.bookedVoucherCount, 1, 'metrics should count unique booked vouchers');
      assertEqual(readModel.metrics.entryCount, 2, 'metrics should count current-period entries only');
      assertEqual(readModel.trialBalance.status, '平衡', 'balanced entries should pass trial balance');
      assertEqual(readModel.trialBalance.difference, '0.00', 'balanced entries should have zero difference');
      assertEqual(readModel.readbackSource, '已记账总账', 'open period should read posted ledger rows');
    }
  },
  {
    name: 'presents opposite-side balances without negative display amounts',
    run: () => {
      const readModel = buildGeneralLedgerReadModel({
        accountingPeriod: '2026-06',
        ledgerRows: [
          createLedgerRow({
            creditAmount: '120.00',
            id: 'ledger-bank-overdrawn',
            sourceVoucherLineId: 'line-bank-overdrawn'
          })
        ],
        openingBalances: [
          {
            accountingPeriod: '2026-06',
            amount: '100.00',
            source: '账套初始化',
            subjectCode: '1002'
          }
        ],
        periods: [createPeriod()],
        subjects: baseSubjects
      });
      const bankRow = readModel.rows.find((row) => row.subjectCode === '1002');
      const directPresentation = getGeneralLedgerBalancePresentation({
        balanceDirection: '借方',
        signedBalance: '-20.00'
      });

      if (!bankRow) {
        throw new Error('expected bank row');
      }

      assertEqual(bankRow.endingBalance, '-20.00', 'signed balance should preserve accounting calculation');
      assertEqual(bankRow.endingBalanceAmount, '20.00', 'display balance should use absolute amount');
      assertEqual(bankRow.endingBalanceSide, '贷方', 'negative debit-nature balance should display on credit side');
      assertEqual(directPresentation.amount, '20.00', 'presentation helper should use absolute amount');
      assertEqual(directPresentation.side, '贷方', 'presentation helper should flip balance side');
    }
  },
  {
    name: 'keeps source ledger hash stable until ledger facts change',
    run: () => {
      const ledgerRows = [
        createLedgerRow({ debitAmount: '1200.00', id: 'ledger-hash-bank', sourceVoucherLineId: 'line-hash-bank' }),
        createLedgerRow({
          creditAmount: '1200.00',
          id: 'ledger-hash-income',
          sourceVoucherLineId: 'line-hash-income',
          subjectCode: '5001',
          subjectName: '主营业务收入'
        })
      ];
      const firstRead = buildGeneralLedgerReadModel({
        accountingPeriod: '2026-06',
        ledgerRows,
        periods: [createPeriod({ status: '已结账' })],
        subjects: baseSubjects
      });
      const replayRead = buildGeneralLedgerReadModel({
        accountingPeriod: '2026-06',
        ledgerRows: [...ledgerRows].reverse(),
        periods: [createPeriod({ status: '已结账' })],
        subjects: [...baseSubjects].reverse()
      });
      const changedRead = buildGeneralLedgerReadModel({
        accountingPeriod: '2026-06',
        ledgerRows: [
          ...ledgerRows,
          createLedgerRow({
            creditAmount: '10.00',
            id: 'ledger-hash-drift',
            sourceVoucherLineId: 'line-hash-drift',
            subjectCode: '5001',
            subjectName: '主营业务收入',
            voucherId: 'voucher-202606-002',
            voucherNo: '记-202606-002'
          })
        ],
        periods: [createPeriod({ status: '已结账' })],
        subjects: baseSubjects
      });

      assertEqual(firstRead.sourceLedgerHash, replayRead.sourceLedgerHash, 'source ledger hash should ignore input order');
      assertEqual(firstRead.readbackSource, '结账总账', 'closed period should expose close-ledger readback source');
      assertEqual(
        firstRead.sourceLedgerHash === changedRead.sourceLedgerHash,
        false,
        'source ledger hash should change when posted ledger facts change'
      );
      assertEqual(changedRead.trialBalance.status, '不平衡', 'ledger fact drift should surface trial-balance issue');
    }
  },
  {
    name: 'maps posted general-ledger rows into financial-statement ledger inputs',
    run: () => {
      const ledgerRows = [
        createLedgerRow({ debitAmount: '1200.00', id: 'ledger-statement-bank', sourceVoucherLineId: 'line-statement-bank' }),
        createLedgerRow({
          creditAmount: '1200.00',
          id: 'ledger-statement-income',
          sourceVoucherLineId: 'line-statement-income',
          subjectCode: '5001',
          subjectName: '主营业务收入'
        })
      ];
      const statementLedgerEntries = buildFinancialStatementLedgerEntriesFromGeneralLedgerRows(ledgerRows);
      const readiness = buildFinancialStatementReadiness({
        accountingPeriod: '2026-06',
        cashFlowMappings: [createMapping()],
        ledgerEntries: statementLedgerEntries
      });

      assertEqual(statementLedgerEntries.length, 2, 'mapper should preserve one statement entry per ledger row');
      assertEqual(readiness.status, '可生成', 'mapped ledger entries should support statement readiness');
      assertEqual(readiness.generalLedgerLines.length, 2, 'readiness should aggregate subject-level ledger lines');
      assertEqual(readiness.cashFlowMappingGaps.length, 0, 'configured counterpart mapping should avoid cash-flow gaps');
    }
  }
];

for (const test of tests) {
  test.run();
}
