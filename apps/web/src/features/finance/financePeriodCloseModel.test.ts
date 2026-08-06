import type {
  AccountingLedgerEntry,
  AccountingVoucherLaterPeriodAdjustmentRecord,
  AccountingPeriodLockRecord,
  AccountingVoucherRecord,
  AccountingVoucherStatus
} from './financeAccountingVoucherModel';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVoucherFromLaterPeriodAdjustment,
  createAccountingVoucherLifecycleRecord,
  reopenAccountingPeriodLock
} from './financeAccountingVoucherModel';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceTaxMatterRecord } from './financeTaxFilingData';
import { socialInsuranceEmployeeRecords, type SocialInsuranceEmployeeRecord } from './financeSocialInsuranceData';
import {
  buildFinancePeriodCloseMetrics,
  buildFinancePeriodCloseReadModel,
  buildFinancePeriodCloseRecords,
  createAccountingPeriodLockRecord,
  createFinancePeriodCloseSummarySnapshot,
  defaultFinancePeriodCloseFilters,
  type FinancePeriodCloseFilters,
  getFinancePeriodCloseConfirmationNotice
} from './financePeriodCloseModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createVoucher(status: AccountingVoucherStatus, overrides: Partial<AccountingVoucherRecord> = {}): AccountingVoucherRecord {
  return {
    accountingPeriod: '2026-06',
    amount: 100,
    businessType: '权责凭证',
    counterparty: '测试对象',
    id: `voucher-${status}`,
    invoiceRefs: [],
    issueReasons: status === '需处理' ? ['missing_accounting_subject'] : [],
    kind: '转账凭证',
    lines: [],
    sourceModule: '应收应付',
    sourceNo: `SRC-${status}`,
    sourceRefs: [],
    sourceTitle: '测试来源',
    sourceType: '业务确认',
    status,
    summary: '测试凭证',
    voucherDate: '2026-06-15',
    voucherNo: `记-202606-${status}`,
    ...overrides
  };
}

function createLedgerEntry(overrides: Partial<AccountingLedgerEntry>): AccountingLedgerEntry {
  return {
    accountingPeriod: '2026-06',
    auxiliary: '测试对象',
    creditAmount: 0,
    debitAmount: 0,
    voucherNo: '记-202606-001',
    id: 'ledger-entry-test',
    side: '借方',
    subjectCode: '1002',
    subjectName: '银行存款',
    summary: '测试分录',
    voucherDate: '2026-06-15',
    voucherId: 'voucher-booked',
    ...overrides
  };
}

function createFinanceTransaction(overrides: Partial<FinanceTransactionRecord>): FinanceTransactionRecord {
  return {
    accountingPeriod: '2026-06',
    reconciliationStatus: '已对账',
    status: '已入账',
    transactionNo: 'FIN-TEST-001',
    ...overrides
  } as FinanceTransactionRecord;
}

function createTaxMatter(overrides: Partial<FinanceTaxMatterRecord>): FinanceTaxMatterRecord {
  return {
    dataStatus: '已确认',
    declarationDate: '2026-07-10',
    declarationDueDate: '2026-07-15',
    declarationFormFileIds: [],
    declarationHistory: [],
    taxAuthorityDeclarationNo: 'DECLARATION-RECEIPT-001',
    declarationStatus: '申报成功',
    declarationVerificationStatus: '未核验',
    declarationVersion: 1,
    files: [],
    id: 'tax-matter-test-001',
    linkedTransactionNos: [],
    matterNo: 'TAX-TEST-001',
    matterType: '个人所得税',
    operationRecords: [],
    owner: '李明',
    paidAmount: 100,
    participantSummary: '1 人',
    payableAmount: 100,
    preparedPayableAmount: 100,
    paymentDate: '2026-07-10',
    paymentDueDate: '2026-07-15',
    paymentStatus: '已缴纳',
    period: '2026-06',
    periodType: '月度',
    processStatus: '已完成',
    sourceItems: [
      {
        id: 'tax-source-test-001',
        name: '申报准备',
        sourceModule: '申报准备',
        status: '已确认',
        updatedAt: '2026-07-10'
      }
    ],
    title: '2026-06 个人所得税',
    updatedAt: '2026-07-10',
    ...overrides
  };
}

function createLaterPeriodAdjustment(
  overrides: Partial<AccountingVoucherLaterPeriodAdjustmentRecord> = {}
): AccountingVoucherLaterPeriodAdjustmentRecord {
  const snapshot = createVoucher('已记账', {
    accountingPeriod: '2026-06',
    id: 'original-voucher-for-later-adjustment',
    voucherNo: '记-202606-001'
  });

  return {
    accountingPeriod: '2026-07',
    adjustedAt: '2026-07-01 17:30',
    adjustedBy: '李明',
    adjustmentNo: 'ADJ-202607-001',
    amount: snapshot.amount,
    adjustmentMode: '冲销原凭证',
    candidateStatus: '待记账',
    id: 'later-period-adjustment-test',
    originalAccountingPeriod: '2026-06',
    originalVoucherId: snapshot.id,
    originalVoucherNo: snapshot.voucherNo,
    reason: '历史期间确认口径调整',
    signedAmount: -snapshot.amount,
    snapshot,
    ...overrides
  };
}

function buildRows({
  accountingPeriodStart,
  filters = defaultFinancePeriodCloseFilters,
  financeRows = [],
  laterPeriodAdjustmentRows = [],
  ledgerEntries = [],
  periodLocks = [],
  socialInsuranceRows = [],
  taxMatterRows = [],
  voucherRows = []
}: {
  accountingPeriodStart?: string;
  filters?: FinancePeriodCloseFilters;
  financeRows?: FinanceTransactionRecord[];
  laterPeriodAdjustmentRows?: AccountingVoucherLaterPeriodAdjustmentRecord[];
  ledgerEntries?: AccountingLedgerEntry[];
  periodLocks?: AccountingPeriodLockRecord[];
  socialInsuranceRows?: SocialInsuranceEmployeeRecord[];
  taxMatterRows?: FinanceTaxMatterRecord[];
  voucherRows?: AccountingVoucherRecord[];
}) {
  return buildFinancePeriodCloseRecords({
    accountingPeriodStart,
    filters,
    financeRows,
    laterPeriodAdjustmentRows,
    ledgerEntries,
    periodLocks,
    socialInsuranceRows,
    taxMatterRows,
    voucherRows
  });
}

const balancedLedgerEntries: AccountingLedgerEntry[] = [
  createLedgerEntry({ debitAmount: 100, id: 'entry-debit', subjectCode: '1002', voucherId: 'voucher-booked' }),
  createLedgerEntry({
    creditAmount: 100,
    id: 'entry-credit',
    side: '贷方',
    subjectCode: '5001',
    subjectName: '主营业务收入',
    voucherId: 'voucher-booked'
  })
];

const tests: UnitTest[] = [
  {
    name: 'blocks close from an unassessed social-insurance domain record instead of legacy tax matters',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        socialInsuranceRows: [{ ...socialInsuranceEmployeeRecords[0], handlingStatus: '待核定', period: '2026-06' }],
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账', { id: 'voucher-booked' })]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      assertEqual(period?.socialInsurancePendingCount, 1, 'unassessed social-insurance record should block period close');
      assertEqual(
        period?.checkItems.find((item) => item.code === 'social_insurance_housing_fund')?.status,
        '需处理',
        'period close should consume the social-insurance domain status'
      );
    }
  },
  {
    name: 'resolves social-insurance close checks by each target accounting period',
    run: () => {
      const source = socialInsuranceEmployeeRecords[0];
      const requestedPeriods: string[] = [];
      const rows = buildFinancePeriodCloseRecords({
        financeRows: [
          createFinanceTransaction({ accountingPeriod: '2026-05', transactionNo: 'FIN-MAY-SOCIAL' }),
          createFinanceTransaction({ accountingPeriod: '2026-06', transactionNo: 'FIN-JUNE-SOCIAL' })
        ],
        ledgerEntries: [],
        resolveSocialInsuranceRowsForPeriod: (period) => {
          requestedPeriods.push(period);
          return period === '2026-06'
            ? [{ ...source, id: 'social-june-pending', handlingStatus: '待核定', period }]
            : [{ ...source, id: `social-${period}-paid`, handlingStatus: '已缴费', period }];
        },
        taxMatterRows: [],
        voucherRows: []
      });
      const may = rows.find((record) => record.accountingPeriod === '2026-05');
      const june = rows.find((record) => record.accountingPeriod === '2026-06');

      assertEqual(requestedPeriods.includes('2026-05'), true, 'close workbench must request the may contribution state');
      assertEqual(requestedPeriods.includes('2026-06'), true, 'close workbench must request the june contribution state');
      assertEqual(may?.socialInsurancePendingCount, 0, 'a completed historical month must remain complete');
      assertEqual(june?.socialInsurancePendingCount, 1, 'a pending current month must block only its own period');
    }
  },
  {
    name: 'accepts assessed unpaid paid and officially exempt social-insurance records for close',
    run: () => {
      const source = socialInsuranceEmployeeRecords[0];
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        socialInsuranceRows: [
          { ...source, id: 'social-assessed-unpaid', handlingStatus: '待缴费', period: '2026-06' },
          { ...source, id: 'social-paid', handlingStatus: '已缴费', period: '2026-06' },
          { ...source, id: 'housing-exempt', category: '公积金', handlingStatus: '无需缴纳', period: '2026-06' }
        ],
        voucherRows: [createVoucher('已记账', { id: 'voucher-booked' })]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      assertEqual(period?.socialInsurancePendingCount, 0, 'assessed or completed social-insurance outcomes should not block close');
    }
  },
  {
    name: 'keeps next-period contribution payment review out of the original obligation period',
    run: () => {
      const source = socialInsuranceEmployeeRecords[0];
      const rows = buildRows({
        financeRows: [createFinanceTransaction({
          accountingPeriod: '2026-07',
          sourceNo: 'SI-2026-06-社保',
          status: '待复核',
          transactionNo: 'FIN-202607-SOCIAL'
        })],
        socialInsuranceRows: [
          { ...source, handlingStatus: '待缴费', id: 'social-assessed-june', period: '2026-06' }
        ]
      });
      const june = rows.find((record) => record.accountingPeriod === '2026-06');
      const july = rows.find((record) => record.accountingPeriod === '2026-07');

      assertEqual(june?.socialInsurancePendingCount, 0, 'June close should depend on June assessment rather than July cash completion');
      assertEqual(june?.pendingReviewCashFlowCount, 0, 'July payment review must not be assigned back to June');
      assertEqual(july?.pendingReviewCashFlowCount, 1, 'July should retain the actual payment review blocker');
    }
  },
  {
    name: 'marks a balanced booked period as closeable',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账', { id: 'voucher-booked' })]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '可结账', 'balanced booked period should be closeable');
      assertEqual(period.canClose, true, 'closeable period should expose canClose');
      assertEqual(period.blockedCheckCount, 0, 'closeable period should have no blocking checks');
      assertEqual(period.trialBalanceStatus, '平衡', 'balanced entries should pass trial balance');
      assertEqual(
        period.checkItems.map((item) => item.code).join(','),
        [
          'month_end_matters',
          'voucher_preparation',
          'voucher_booking',
          'general_ledger_trial_balance',
          'financial_statements',
          'cash_review',
          'cash_reconciliation',
          'social_insurance_housing_fund'
        ].join(','),
        'period close should expose only the current close-check groups'
      );

      const closeSnapshot = createFinancePeriodCloseSummarySnapshot(period);

      assertEqual(
        (closeSnapshot.generalLedgerRows?.length ?? 0) > 0,
        true,
        'period close summary snapshot should carry general-ledger subject rows for closed-period readback'
      );
      assertEqual(
        closeSnapshot.generalLedgerRows?.some((row) => row.subjectCode === '1002' && row.debitAmount === 100),
        true,
        'period close ledger snapshot should preserve close-time subject balances'
      );
      assertEqual(
        closeSnapshot.financialStatementReport?.trialBalanceStatus,
        '平衡',
        'period close summary snapshot should carry financial statement snapshot readiness'
      );
    }
  },
  {
    name: 'requires the prior accounting period to be closed before a later clear period can close',
    run: () => {
      const julyVoucher = createVoucher('已记账', {
        accountingPeriod: '2026-07',
        id: 'voucher-july-booked',
        voucherDate: '2026-07-15'
      });
      const julyLedgerEntries = balancedLedgerEntries.map((entry) => ({
        ...entry,
        accountingPeriod: '2026-07',
        id: `july-${entry.id}`,
        voucherDate: '2026-07-15',
        voucherId: julyVoucher.id
      }));
      const rows = buildRows({
        accountingPeriodStart: '2026-06',
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-07' }
        },
        financeRows: [createFinanceTransaction({ accountingPeriod: '2026-07', transactionNo: 'FIN-JULY-CONTINUITY' })],
        ledgerEntries: julyLedgerEntries,
        taxMatterRows: [createTaxMatter({ period: '2026-07' })],
        voucherRows: [julyVoucher]
      });
      const july = rows.find((record) => record.accountingPeriod === '2026-07');

      if (!july) {
        throw new Error('expected 2026-07 period');
      }

      assertEqual(rows.length, 1, 'month filtering should keep only the selected later period after continuity is derived');
      assertEqual(july.status, '需处理', 'later period should not remain closeable while the prior period is open');
      assertEqual(july.canClose, false, 'prior-period blocker should disable close confirmation');
      assertEqual(july.blockedCheckCount, 0, 'prior-period blocker should not be duplicated as a current-period check item');
      assertEqual(july.continuityStatus, '待前期结账', 'later period should expose the prior-period close blocker');
      assertEqual(july.continuityBlockerPeriod, '2026-06', 'later period should name the direct prior accounting period');
      assertEqual(
        july.continuityDetail,
        '需先完成 2026-06 期间结账，当前期间才能结账。',
        'later period should expose concise continuity guidance'
      );
      assertEqual(
        july.checkItems.every((item) => item.status === '通过'),
        true,
        'current-period checks should stay passed when only the prior-period continuity is blocking'
      );
    }
  },
  {
    name: 'derives a continuous month range from account-set start and only unlocks each direct successor after its prior lock',
    run: () => {
      const julyVoucher = createVoucher('已记账', {
        accountingPeriod: '2026-07',
        id: 'voucher-july-sequence',
        voucherDate: '2026-07-15'
      });
      const rows = buildRows({
        accountingPeriodStart: '2026-05',
        financeRows: [createFinanceTransaction({ accountingPeriod: '2026-07', transactionNo: 'FIN-JULY-SEQUENCE' })],
        ledgerEntries: balancedLedgerEntries.map((entry) => ({
          ...entry,
          accountingPeriod: '2026-07',
          id: `sequence-${entry.id}`,
          voucherDate: '2026-07-15',
          voucherId: julyVoucher.id
        })),
        periodLocks: [createAccountingPeriodLockRecord('2026-05', '2026-05 月结确认')],
        taxMatterRows: [createTaxMatter({ period: '2026-07' })],
        voucherRows: [julyVoucher]
      });
      const june = rows.find((record) => record.accountingPeriod === '2026-06');
      const july = rows.find((record) => record.accountingPeriod === '2026-07');

      if (!june || !july) {
        throw new Error('expected 2026-06 and 2026-07 periods');
      }

      assertEqual(
        rows.map((record) => record.accountingPeriod).join(','),
        '2026-07,2026-06,2026-05',
        'account-set start should fill blank months through the latest closing candidate'
      );
      assertEqual(june.status, '可结账', 'the direct successor of a closed period should be eligible after its own checks pass');
      assertEqual(june.continuityStatus, '前期已结账', 'june should recognize the locked start period');
      assertEqual(july.status, '需处理', 'july should remain blocked until june itself is closed');
      assertEqual(july.continuityBlockerPeriod, '2026-06', 'july should require its direct prior period instead of any earlier lock');
    }
  },
  {
    name: 'flags existing out-of-order period locks and restores the regular continuity blocker after a repair reopen',
    run: () => {
      const legacyPeriodLocks = [createAccountingPeriodLockRecord('2026-07', 'legacy 2026-07 close')];
      const rows = buildRows({
        accountingPeriodStart: '2026-06',
        financeRows: [createFinanceTransaction({ accountingPeriod: '2026-07', transactionNo: 'FIN-OUT-OF-ORDER' })],
        periodLocks: legacyPeriodLocks,
        taxMatterRows: [createTaxMatter({ period: '2026-07' })]
      });
      const july = rows.find((record) => record.accountingPeriod === '2026-07');

      if (!july) {
        throw new Error('expected 2026-07 period');
      }

      assertEqual(july.status, '已结账', 'existing period lock should remain read-only instead of being silently rewritten');
      assertEqual(july.canClose, false, 'closed period should remain non-closeable');
      assertEqual(july.continuityStatus, '锁定顺序异常', 'out-of-order historical lock should remain visible');
      assertEqual(july.continuityBlockerPeriod, '2026-06', 'out-of-order lock should identify the missing prior close');

      const reopenedRows = buildRows({
        accountingPeriodStart: '2026-06',
        financeRows: [createFinanceTransaction({ accountingPeriod: '2026-07', transactionNo: 'FIN-OUT-OF-ORDER' })],
        periodLocks: reopenAccountingPeriodLock(legacyPeriodLocks, '2026-07', {
          reason: '补齐前期结账顺序',
          reopenedAt: '2026-08-01 09:30',
          reopenedBy: '李明'
        }),
        taxMatterRows: [createTaxMatter({ period: '2026-07' })]
      });
      const reopenedJuly = reopenedRows.find((record) => record.accountingPeriod === '2026-07');

      if (!reopenedJuly) {
        throw new Error('expected reopened 2026-07 period');
      }

      assertEqual(reopenedJuly.status, '需处理', 'reopened period should return to the ordinary close workflow');
      assertEqual(reopenedJuly.continuityStatus, '待前期结账', 'reopened period should require its missing prior period');
      assertEqual(reopenedJuly.continuityBlockerPeriod, '2026-06', 'reopened period should retain the direct prior-period requirement');
      assertEqual(reopenedJuly.reopenedBy, '李明', 'reopened period should expose the repair operator for readback');
      assertEqual(reopenedJuly.reopenedAt, '2026-08-01 09:30', 'reopened period should expose the repair time for readback');
      assertEqual(reopenedJuly.reopenReason, '补齐前期结账顺序', 'reopened period should expose the repair reason for readback');
    }
  },
  {
    name: 'blocks period close when cash-flow statement mapping is incomplete',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: [
          createLedgerEntry({
            debitAmount: 100,
            id: 'entry-cash-flow-gap-debit',
            subjectCode: '1002',
            voucherId: 'voucher-cash-flow-gap',
            voucherNo: '记-202606-CFGAP'
          }),
          createLedgerEntry({
            creditAmount: 100,
            id: 'entry-cash-flow-gap-credit',
            side: '贷方',
            subjectCode: '1123',
            subjectName: '预付账款',
            voucherId: 'voucher-cash-flow-gap',
            voucherNo: '记-202606-CFGAP'
          })
        ],
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [
          createVoucher('已记账', {
            id: 'voucher-cash-flow-gap',
            voucherNo: '记-202606-CFGAP'
          })
        ]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.trialBalanceStatus, '平衡', 'cash-flow mapping gap fixture should still be trial-balanced');
      assertEqual(period.status, '需处理', 'cash-flow mapping gap should block period close');
      assertEqual(period.canClose, false, 'cash-flow mapping gap should prevent period close');
      assertEqual(period.financialStatementReadinessMode, '暂不可出具', 'cash-flow mapping gap should make report unavailable');
      assertEqual(
        period.financialStatementReadinessDetail.includes('缺少对方科目现金流量项目映射'),
        true,
        'financial-statement readiness detail should explain cash-flow mapping gap'
      );
      assertEqual(
        period.checkItems.some((item) => item.code === 'financial_statements' && item.status === '需处理'),
        true,
        'financial statement check should surface cash-flow mapping gap as a blocking close item'
      );
    }
  },
  {
    name: 'uses accounting voucher lifecycle as the source for ledger and period close readiness',
    run: () => {
      const sourceVoucher = createVoucher('待记账', {
        id: 'voucher-lifecycle-close-test',
        lines: [
          {
            amount: 100,
            auxiliary: '测试客户',
            id: 'voucher-lifecycle-close-test-debit',
            side: '借方',
            subjectCode: '1002',
            summary: '测试收款'
          },
          {
            amount: 100,
            auxiliary: '测试客户',
            id: 'voucher-lifecycle-close-test-credit',
            side: '贷方',
            subjectCode: '5001',
            summary: '测试收入'
          }
        ],
        sourceNo: 'SRC-LIFECYCLE-CLOSE',
        voucherNo: 'VCH-202606-LIFECYCLE'
      });
      const pendingRows = [sourceVoucher];
      const pendingLedgerEntries = buildAccountingLedgerEntries(pendingRows);
      const pendingPeriod = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: pendingLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: pendingRows
      }).find((record) => record.accountingPeriod === '2026-06');
      const bookedLifecycle = createAccountingVoucherLifecycleRecord(
        sourceVoucher,
        '记-202606-010',
        '李明',
        '2026-06-30 17:10'
      );
      const bookedRows = applyAccountingVoucherLifecycle([sourceVoucher], [bookedLifecycle]);
      const bookedLedgerEntries = buildAccountingLedgerEntries(bookedRows);
      const bookedPeriod = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: bookedLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: bookedRows
      }).find((record) => record.accountingPeriod === '2026-06');

      if (!pendingPeriod || !bookedPeriod) {
        throw new Error('expected period close rows before and after booking');
      }

      assertEqual(pendingLedgerEntries.length, 0, 'pending-booking vouchers must not enter general-ledger entries');
      assertEqual(pendingPeriod.status, '需处理', 'pending-booking voucher should block period close');
      assertEqual(pendingPeriod.unbookedVoucherCount, 1, 'pending-booking row should count as unbooked voucher');
      assertEqual(
        pendingPeriod.checkItems.some((item) => item.code === 'voucher_booking' && item.status === '需处理'),
        true,
        'period close should point pending-booking vouchers to voucher booking'
      );
      assertEqual(bookedLedgerEntries.length, 2, 'booked voucher should produce one ledger entry per voucher line');
      assertEqual(bookedPeriod.status, '可结账', 'booked balanced voucher should make the period closeable');
      assertEqual(bookedPeriod.bookedVoucherCount, 1, 'booked lifecycle row should count as booked voucher');
      assertEqual(bookedPeriod.trialBalanceStatus, '平衡', 'booked balanced lines should pass general-ledger trial balance');
    }
  },
  {
    name: 'exposes a frontend-session read model while backend close-checks are pending',
    run: () => {
      const readModel = buildFinancePeriodCloseReadModel({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账', { id: 'voucher-booked' })]
      });

      assertEqual(readModel.authority, 'frontend_session_adapter', 'read model should not claim backend authority');
      assertEqual(readModel.records.length > 0, true, 'read model should include period close rows');
      assertEqual(readModel.metrics.periodCount, readModel.records.length, 'metrics should be derived from read model rows');
      assertEqual(
        readModel.pendingBackendCapabilities.includes('GET /api/finance/accounting-periods/{period}/close-checks'),
        true,
        'read model should expose pending backend close-checks capability'
      );
    }
  },
  {
    name: 'keeps historical periods visible by default for close workbench review',
    run: () => {
      const rows = buildRows({
        financeRows: [
          createFinanceTransaction({ accountingPeriod: '2026-04', transactionNo: 'FIN-202604-TEST' }),
          createFinanceTransaction({ accountingPeriod: '2026-06', transactionNo: 'FIN-202606-TEST' })
        ],
        ledgerEntries: [
          ...balancedLedgerEntries,
          createLedgerEntry({
            accountingPeriod: '2026-04',
            debitAmount: 80,
            id: 'april-entry-debit',
            voucherDate: '2026-04-15',
            voucherId: 'voucher-april-booked'
          }),
          createLedgerEntry({
            accountingPeriod: '2026-04',
            creditAmount: 80,
            id: 'april-entry-credit',
            side: '贷方',
            subjectCode: '5001',
            subjectName: '主营业务收入',
            voucherDate: '2026-04-15',
            voucherId: 'voucher-april-booked'
          })
        ],
        taxMatterRows: [createTaxMatter({ period: '2026-04' }), createTaxMatter({})],
        voucherRows: [
          createVoucher('已记账', {
            accountingPeriod: '2026-04',
            id: 'voucher-april-booked',
            voucherDate: '2026-04-15'
          }),
          createVoucher('已记账', { id: 'voucher-june-booked' })
        ]
      });

      assertEqual(
        rows.some((record) => record.accountingPeriod === '2026-04'),
        true,
        'default period close filters should keep historical close periods visible'
      );
      assertEqual(
        rows.some((record) => record.accountingPeriod === '2026-06'),
        true,
        'default period close filters should still include the current accounting period'
      );
    }
  },
  {
    name: 'keeps period close confirmation notice business-facing',
    run: () => {
      const notice = getFinancePeriodCloseConfirmationNotice();

      assertEqual(notice.includes('当前工作台'), false, 'confirmation notice should not expose workbench implementation wording');
      assertEqual(notice.includes('只读回看'), true, 'confirmation notice should keep readback wording');
      assertEqual(
        notice.includes('后端') || notice.includes('前端会话') || notice.includes('真实锁期') || notice.includes('影响账务结果'),
        false,
        'confirmation notice should not expose implementation boundaries or overstate persisted locking'
      );
    }
  },
  {
    name: 'exposes report readback mode and later-period adjustment summary',
    run: () => {
      const rows = buildRows({
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'all' }
        },
        financeRows: [createFinanceTransaction({})],
        laterPeriodAdjustmentRows: [createLaterPeriodAdjustment()],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账')]
      });
      const targetPeriod = rows.find((record) => record.accountingPeriod === '2026-07');
      const originalPeriod = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!targetPeriod || !originalPeriod) {
        throw new Error('expected original and target periods');
      }

      assertEqual(originalPeriod.financialStatementReadinessMode, '待结账', 'open balanced period should expose pending-close report mode');
      assertEqual(originalPeriod.laterAdjustmentSourceCount, 1, 'original period should count later adjustments raised against it');
      assertEqual(targetPeriod.laterAdjustmentTargetCount, 1, 'target period should count later adjustments carried into it');
      assertEqual(
        targetPeriod.laterAdjustmentSummary.includes('承接 1 项后续调整事项'),
        true,
        'target period should expose later-period adjustment carryover summary'
      );
      assertEqual(
        originalPeriod.financialStatementReadinessDetail.includes('正式报表'),
        true,
        'financial-statement readiness copy should keep report mode business-facing'
      );
      assertEqual(
        targetPeriod.financialStatementReadinessDetail.includes('正式报表') || targetPeriod.financialStatementReadinessMode === '暂不可出具',
        true,
        'target-period financial-statement readiness copy should stay business-facing or explicitly unavailable'
      );
    }
  },
  {
    name: 'blocks target-period close when later-period adjustment candidate is not booked',
    run: () => {
      const targetAdjustment = createLaterPeriodAdjustment();
      const rows = buildRows({
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-07' }
        },
        laterPeriodAdjustmentRows: [targetAdjustment],
        voucherRows: [
          createVoucher('待记账', {
            accountingPeriod: targetAdjustment.accountingPeriod,
            businessType: '调整凭证',
            id: `voucher-${targetAdjustment.id}`,
            sourceNo: targetAdjustment.adjustmentNo,
            sourceTitle: '后续期间调整测试',
            sourceType: '后续调整',
            voucherDate: '2026-07-01',
            voucherNo: 'VCH-202607-L001'
          })
        ]
      });
      const targetPeriod = rows.find((record) => record.accountingPeriod === '2026-07');

      if (!targetPeriod) {
        throw new Error('expected target period');
      }

      assertEqual(targetPeriod.status, '需处理', 'target period should remain blocked while adjustment candidate is pending booking');
      assertEqual(targetPeriod.readyToBookVoucherCount, 1, 'target period should count the later-period adjustment as ready to book');
      assertEqual(
        targetPeriod.checkItems.some((item) =>
          item.code === 'voucher_booking' &&
          item.status === '需处理' &&
          item.sourceSummary === '会计凭证 / 1 项'
        ),
        true,
        'voucher-booking check should show pending later-period adjustment count without exposing the adjustment number'
      );

      const bookingCheck = targetPeriod.checkItems.find((item) => item.code === 'voucher_booking');
      const actionParams = new URLSearchParams(bookingCheck?.actionQuery);

      assertEqual(bookingCheck?.actionPath, '/finance/accounting-vouchers', 'pending adjustment should route to accounting vouchers');
      assertEqual(actionParams.get('period'), targetAdjustment.accountingPeriod, 'pending adjustment route should carry target period');
      assertEqual(actionParams.get('status'), '待记账', 'pending adjustment route should carry pending booking status');
      assertEqual(actionParams.get('sourceNo'), targetAdjustment.adjustmentNo, 'pending adjustment route should carry adjustment number');
    }
  },
  {
    name: 'moves later-period adjustment from target-period booking blocker to closeable state after booking',
    run: () => {
      const originalVoucher = createVoucher('已记账', {
        accountingPeriod: '2026-06',
        amount: 100,
        id: 'original-voucher-target-close-loop',
        lines: [
          {
            amount: 100,
            auxiliary: '测试客户',
            id: 'original-voucher-target-close-loop-debit',
            side: '借方',
            subjectCode: '1122',
            summary: '历史应收确认'
          },
          {
            amount: 100,
            auxiliary: '测试客户',
            id: 'original-voucher-target-close-loop-credit',
            side: '贷方',
            subjectCode: '5001',
            summary: '历史收入确认'
          }
        ],
        sourceNo: 'SRC-ORIGINAL-CLOSED',
        voucherNo: '记-202606-099'
      });
      const targetAdjustment = createLaterPeriodAdjustment({
        amount: originalVoucher.amount,
        originalVoucherId: originalVoucher.id,
        originalVoucherNo: originalVoucher.voucherNo,
        snapshot: originalVoucher
      });
      const adjustmentVoucher = buildAccountingVoucherFromLaterPeriodAdjustment(targetAdjustment, 0);

      if (!adjustmentVoucher) {
        throw new Error('expected later-period adjustment voucher');
      }

      const pendingTargetRows = buildRows({
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-07' }
        },
        laterPeriodAdjustmentRows: [{ ...targetAdjustment, candidateStatus: '待记账' }],
        ledgerEntries: [],
        periodLocks: [createAccountingPeriodLockRecord('2026-06', '2026-06 月结确认')],
        voucherRows: [adjustmentVoucher]
      });
      const pendingTargetPeriod = pendingTargetRows.find((record) => record.accountingPeriod === '2026-07');

      if (!pendingTargetPeriod) {
        throw new Error('expected pending target period');
      }

      assertEqual(pendingTargetPeriod.status, '需处理', 'pending adjustment should block target-period close');
      assertEqual(pendingTargetPeriod.readyToBookVoucherCount, 1, 'pending adjustment should count as waiting for booking');
      assertEqual(pendingTargetPeriod.unbookedVoucherCount, 1, 'pending adjustment should count as unbooked');

      const bookingCheck = pendingTargetPeriod.checkItems.find((item) => item.code === 'voucher_booking');
      const bookingActionParams = new URLSearchParams(bookingCheck?.actionQuery);

      assertEqual(bookingCheck?.status, '需处理', 'pending adjustment should block the booking check');
      assertEqual(bookingCheck?.actionPath, '/finance/accounting-vouchers', 'pending adjustment should route to accounting vouchers');
      assertEqual(bookingActionParams.get('period'), targetAdjustment.accountingPeriod, 'booking route should carry target period');
      assertEqual(bookingActionParams.get('status'), '待记账', 'booking route should carry pending booking status');
      assertEqual(bookingActionParams.get('sourceNo'), targetAdjustment.adjustmentNo, 'booking route should carry adjustment number');

      const bookedLifecycle = createAccountingVoucherLifecycleRecord(
        adjustmentVoucher,
        '记-202607-001',
        '李明',
        '2026-07-01 17:10'
      );
      const bookedVoucherRows = applyAccountingVoucherLifecycle([adjustmentVoucher], [bookedLifecycle]);
      const bookedLedgerEntries = buildAccountingLedgerEntries(bookedVoucherRows);
      const bookedTargetRows = buildRows({
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-07' }
        },
        laterPeriodAdjustmentRows: [{ ...targetAdjustment, candidateStatus: '已记账' }],
        ledgerEntries: bookedLedgerEntries,
        periodLocks: [createAccountingPeriodLockRecord('2026-06', '2026-06 月结确认')],
        voucherRows: bookedVoucherRows
      });
      const bookedTargetPeriod = bookedTargetRows.find((record) => record.accountingPeriod === '2026-07');

      if (!bookedTargetPeriod) {
        throw new Error('expected booked target period');
      }

      assertEqual(bookedTargetPeriod.status, '可结账', 'booked adjustment should allow target-period close when other checks pass');
      assertEqual(bookedTargetPeriod.bookedVoucherCount, 1, 'booked adjustment should count as booked');
      assertEqual(bookedTargetPeriod.unbookedVoucherCount, 0, 'booked adjustment should clear the booking blocker');
      assertEqual(bookedTargetPeriod.trialBalanceStatus, '平衡', 'booked adjustment ledger should remain balanced');
      assertEqual(bookedTargetPeriod.debitTotal, 100, 'booked adjustment should be included in target-period debit total');
      assertEqual(bookedTargetPeriod.creditTotal, 100, 'booked adjustment should be included in target-period credit total');
      assertEqual(bookedTargetPeriod.blockedCheckCount, 0, 'booked target period should have no blocking checks');

      const originalPeriodLock: AccountingPeriodLockRecord = {
        ...createAccountingPeriodLockRecord('2026-06', '2026-06 月结确认'),
        closeSummarySnapshot: {
          blockedCheckCount: 0,
          bookedVoucherCount: 2,
          creditTotal: 500,
          debitTotal: 500,
          readyToBookVoucherCount: 0,
          generatedVoucherCount: 2,
          issueVoucherCount: 0,
          pendingVoucherCount: 0,
          pendingReviewCashFlowCount: 0,
          socialInsurancePendingCount: 0,
          trialBalanceDifference: 0,
          trialBalanceStatus: '平衡',
          unbookedVoucherCount: 0,
          unreconciledCashFlowCount: 0,
          voucherCount: 2
        }
      };
      const originalReadbackRows = buildRows({
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-06' }
        },
        laterPeriodAdjustmentRows: [{ ...targetAdjustment, candidateStatus: '已记账' }],
        ledgerEntries: bookedLedgerEntries,
        periodLocks: [originalPeriodLock],
        voucherRows: bookedVoucherRows
      });
      const originalReadbackPeriod = originalReadbackRows.find((record) => record.accountingPeriod === '2026-06');

      if (!originalReadbackPeriod) {
        throw new Error('expected original closed period');
      }

      assertEqual(originalReadbackPeriod.status, '已结账', 'original period should stay closed after target-period adjustment');
      assertEqual(originalReadbackPeriod.bookedVoucherCount, 2, 'original period should keep close-time booked voucher count');
      assertEqual(originalReadbackPeriod.debitTotal, 500, 'original period should keep close-time debit total');
      assertEqual(originalReadbackPeriod.creditTotal, 500, 'original period should keep close-time credit total');
      assertEqual(originalReadbackPeriod.laterAdjustmentSourceCount, 1, 'original period should show post-close adjustment readback count');
      assertEqual(originalReadbackPeriod.laterAdjustmentTargetCount, 0, 'original period should not count target-period carryover as live work');
      assertEqual(
        originalReadbackPeriod.laterAdjustmentSummary.includes('发起 1 项调整'),
        true,
        'original period should show later adjustment context without recalculating close summary'
      );
    }
  },
  {
    name: 'blocks close when voucher work is not fully booked',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('待记账'), createVoucher('需处理')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '需处理', 'pending or issue vouchers should block closing');
      assertEqual(period.readyToBookVoucherCount, 1, 'ready-to-book voucher should be counted');
      assertEqual(period.unbookedVoucherCount, 1, 'pending-booking voucher should be counted');
      assertEqual(period.issueVoucherCount, 1, 'issue voucher should be counted');
      assertEqual(
        period.checkItems.some((item) => item.code === 'voucher_preparation' && item.sourceSummary === '会计凭证 / 1 项'),
        true,
        'voucher generation check should show source count instead of source number'
      );
      assertEqual(
        period.checkItems.some((item) => item.code === 'voucher_booking' && item.sourceSummary === '会计凭证 / 1 项'),
        true,
        'voucher booking check should show pending count instead of source number'
      );
      assertEqual(
        period.checkItems.every((item) => !item.nextStep.startsWith('回到')),
        true,
        'open period check guidance should not use source-operation wording'
      );
      assertEqual(
        period.checkItems.some((item) => item.code === 'voucher_preparation' && item.nextStep.startsWith('需先在会计凭证')),
        true,
        'open period check guidance should read as prerequisite guidance'
      );
      assertEqual(
        period.checkItems.some(
          (item) => item.code === 'voucher_preparation' && item.actionLabel === '去会计凭证' && item.actionPath === '/finance/accounting-vouchers'
        ),
        true,
        'voucher source blocker should expose the accounting-voucher source route'
      );
      assertEqual(
        period.checkItems.some(
          (item) => item.code === 'voucher_booking' && item.actionLabel === '去会计凭证' && item.actionPath === '/finance/accounting-vouchers'
        ),
        true,
        'voucher booking blocker should expose the accounting-voucher source route'
      );
    }
  },
  {
    name: 'exposes source routes for trial-balance and financial-statement-readiness blockers',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: [
          createLedgerEntry({
            debitAmount: 100,
            id: 'imbalanced-ledger-entry'
          })
        ],
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '需处理', 'imbalanced general ledger should block closing');
      assertEqual(period.trialBalanceStatus, '不平衡', 'imbalanced ledger entries should fail trial balance');
      assertEqual(
        period.checkItems.some(
          (item) => item.code === 'general_ledger_trial_balance' && item.actionLabel === '去总账' && item.actionPath === '/finance/general-ledger'
        ),
        true,
        'trial-balance blocker should expose the general-ledger source route'
      );
    }
  },
  {
    name: 'uses no-action guidance for passed period close checks',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(
        period.checkItems.every((item) => item.status !== '通过' || item.nextStep === '无需处理'),
        true,
        'passed checks should not show prerequisite handling guidance'
      );
      assertEqual(
        period.checkItems.some((item) => item.status === '需处理' && item.nextStep.startsWith('需先在')),
        false,
        'fully clear period should not contain blocking prerequisite guidance'
      );
      assertEqual(
        period.checkItems.every((item) => !item.actionLabel && !item.actionPath),
        true,
        'passed checks should not expose source route actions'
      );
    }
  },
  {
    name: 'blocks close when cash flow is still waiting for review',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({ status: '待复核' })],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '需处理', 'pending-review cash flow should block close');
      assertEqual(period.pendingReviewCashFlowCount, 1, 'pending-review cash flow should be counted');
      assertEqual(period.unreconciledCashFlowCount, 0, 'pending-review cash flow should not be counted as bank reconciliation yet');
      assertEqual(
        period.checkItems.some(
          (item) =>
            item.code === 'cash_review' &&
            item.status === '需处理' &&
            item.actionLabel === '去流水复核' &&
            item.actionPath === '/finance/review'
        ),
        true,
        'cash review blocker should route to finance review'
      );
    }
  },
  {
    name: 'does not block period close only because a declared tax remains unpaid',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({
          paidAmount: 0,
          paymentDate: undefined,
          paymentStatus: '待缴纳',
          processStatus: '待缴款'
        })],
        voucherRows: [createVoucher('已记账')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '可结账', 'declared and booked tax should allow close before the later payment date');
      assertEqual(
        period.checkItems.some((item) => item.title === '税务办理'),
        false,
        'external tax filing and payment should not appear as an accounting-period close check'
      );
    }
  },
  {
    name: 'blocks close for unreconciled cash flow but not for unfinished external tax handling',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({ reconciliationStatus: '未对账' })],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [createTaxMatter({
          taxAuthorityDeclarationNo: undefined,
          processStatus: '申报材料待核对'
        })],
        voucherRows: [createVoucher('已记账')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '需处理', 'unreconciled cash flow should block closing');
      assertEqual(period.unreconciledCashFlowCount, 1, 'unreconciled booked cash flow should be counted');
      assertEqual(period.socialInsurancePendingCount, 0, 'tax handling matter should not be counted as social insurance');
      assertEqual(
        period.checkItems.some((item) => item.code === 'cash_reconciliation' && item.sourceSummary === '银行对账 / 1 条'),
        true,
        'cash reconciliation check should show row count instead of transaction number'
      );
      assertEqual(
        period.checkItems.some(
          (item) => item.code === 'cash_reconciliation' && item.actionLabel === '去银行对账' && item.actionPath === '/finance/bank-reconciliation'
        ),
        true,
        'cash reconciliation blocker should expose the bank-reconciliation source route'
      );
      assertEqual(
        period.checkItems.some((item) => item.title === '税务办理'),
        false,
        'unfinished external tax handling should not be duplicated in period-close checks'
      );
    }
  },
  {
    name: 'keeps social-insurance domain records as a close check without duplicating external tax handling',
    run: () => {
      const source = socialInsuranceEmployeeRecords[0];
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        socialInsuranceRows: [
          { ...source, id: 'social', category: '社保', handlingStatus: '欠缴待补', period: '2026-06' },
          { ...source, id: 'housing', category: '公积金', handlingStatus: '待确认', period: '2026-06' }
        ],
        taxMatterRows: [createTaxMatter({ id: 'tax-iit', dataStatus: '待复核', processStatus: '数据待确认' })],
        voucherRows: [createVoucher('已记账')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.socialInsurancePendingCount, 2, 'social insurance and housing fund should be counted separately');
      assertEqual(
        period.checkItems.some((item) => item.title === '税务办理'),
        false,
        'non-social external tax handling should not become a close-check group'
      );
      assertEqual(
        period.checkItems.some((item) => item.code === 'social_insurance_housing_fund' && item.detail.includes('2 项社保公积金')),
        true,
        'social-insurance check should explain social pending count'
      );
      assertEqual(
        period.checkItems.some(
          (item) =>
            item.code === 'social_insurance_housing_fund' &&
            item.actionLabel === '去社保公积金' &&
            item.actionPath === '/salary/social-insurance'
        ),
        true,
        'social-insurance blocker should expose the salary social-insurance source route'
      );
    }
  },
  {
    name: 'does not turn a pending quarterly filing into a quarter-end close blocker',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        taxMatterRows: [
          createTaxMatter({
            matterType: '增值税及附加',
            dataStatus: '待复核',
            period: '2026-Q2',
            periodType: '季度',
            processStatus: '数据待确认'
          })
        ],
        voucherRows: [createVoucher('已记账')]
      });
      const junePeriod = rows.find((record) => record.accountingPeriod === '2026-06');
      const quarterPeriod = rows.find((record) => record.accountingPeriod === '2026-Q2');

      if (!junePeriod) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(quarterPeriod, undefined, 'quarter labels should not become accounting-period rows');
      assertEqual(junePeriod.status, '可结账', 'Q2 external filing should not block June after the tax voucher is booked');
      assertEqual(
        junePeriod.checkItems.some((item) => item.title === '税务办理'),
        false,
        'quarterly filing status should stay in the tax module rather than period close'
      );
    }
  },
  {
    name: 'uses period locks as closed state and excludes closed periods from closeable metrics',
    run: () => {
      const periodLocks = [createAccountingPeriodLockRecord('2026-06', '2026-06 月结确认')];
      const rows = buildRows({
        financeRows: [createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        periodLocks,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('已记账')]
      });
      const metrics = buildFinancePeriodCloseMetrics(rows);
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '已结账', 'locked period should display as closed');
      assertEqual(period.canClose, false, 'closed period should not be closeable again');
      assertEqual(period.closeReason, '2026-06 月结确认', 'closed period should expose lock reason');
      assertEqual(
        period.checkItems.every((item) => item.nextStep === '期间已结账，只读回看'),
        true,
        'closed period check rows should not expose source-handling action copy'
      );
      assertEqual(
        period.checkItems.every((item) => !item.actionLabel && !item.actionPath),
        true,
        'closed period check rows should not expose source route actions'
      );
      assertEqual(
        period.checkItems.every((item) => item.sourceSummary.length > 0),
        true,
        'closed period check rows should preserve source summary for historical readback'
      );
      assertEqual(metrics.closedCount, 1, 'closed metrics should count locked period');
      assertEqual(metrics.closeableCount, 0, 'closed period should not count as closeable');
    }
  },
  {
    name: 'uses closed-period check snapshots for readback instead of live source drift',
    run: () => {
      const periodLocks: AccountingPeriodLockRecord[] = [
        {
          accountingPeriod: '2026-06',
          closeCheckSnapshot: [
            {
              code: 'cash_reconciliation',
              detail: '结账时已完成资金对账。',
              nextStep: '需先在银行对账完成未对账流水',
              sourceSummary: '银行对账 / FIN-CLOSED-001',
              status: '通过',
              title: '资金对账'
            }
          ],
          closeSummarySnapshot: {
          blockedCheckCount: 0,
          bookedVoucherCount: 7,
          creditTotal: 8800,
            debitTotal: 8800,
            financialStatementReport: {
              accountingPeriod: '2026-06',
              assetTotal: 0,
              balanceSheetDifference: 0,
              balanceSheetLines: [],
              balanceSheetReadiness: '可出具',
              balanceSheetReadinessDetail: '资产负债表勾稽一致。',
              cashFlowLines: [],
              cashFlowMappingGaps: [],
              cashFlowNetAmount: 0,
              cashFlowReadiness: '可出具',
              cashFlowReadinessDetail: '本期无现金或银行存款变动，现金流量表金额为零。',
              financialStatementReadiness: '可出具',
              financialStatementReadinessDetail: '三张表校验已通过。',
              liabilityEquityTotal: 0,
              periodLabel: '2026-06 当月',
              profitLines: [],
              profitTotal: 0,
              reportBasis: '总账：7 张已记账凭证 / 8,800.00 元借方 / 8,800.00 元贷方',
              trialBalanceStatus: '平衡'
            },
            readyToBookVoucherCount: 0,
            generatedVoucherCount: 7,
            issueVoucherCount: 0,
            pendingVoucherCount: 0,
            pendingReviewCashFlowCount: 0,
            socialInsurancePendingCount: 0,
            trialBalanceDifference: 0,
            trialBalanceStatus: '平衡',
            unbookedVoucherCount: 0,
            unreconciledCashFlowCount: 0,
            voucherCount: 7
          },
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          reason: '2026-06 月结确认',
          status: '已结账'
        }
      ];
      const rows = buildRows({
        financeRows: [createFinanceTransaction({ reconciliationStatus: '未对账', transactionNo: 'FIN-LATER-DRIFT' })],
        ledgerEntries: [
          ...balancedLedgerEntries,
          createLedgerEntry({
            debitAmount: 120,
            id: 'ledger-entry-live-drift',
            voucherId: 'voucher-live-drift'
          })
        ],
        periodLocks,
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('待记账')]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '已结账', 'locked period should stay closed even when live source data later drifts');
      assertEqual(period.blockedCheckCount, 0, 'closed period readback should use the close-time check snapshot');
      assertEqual(period.bookedVoucherCount, 7, 'closed period readback should use the close-time voucher summary');
      assertEqual(period.unreconciledCashFlowCount, 0, 'closed period readback should use the close-time cash summary');
      assertEqual(period.debitTotal, 8800, 'closed period readback should use the close-time debit total');
      assertEqual(period.creditTotal, 8800, 'closed period readback should use the close-time credit total');
      assertEqual(period.trialBalanceStatus, '平衡', 'closed period readback should use the close-time trial balance status');
      assertEqual(period.financialStatementReadinessMode, '正式报表', 'closed period financial-statement readiness should not drift with live ledger changes');
      assertEqual(period.checkItems.length, 1, 'closed period readback should prefer the stored close-check snapshot');
      assertEqual(period.checkItems[0]?.detail, '结账时已完成资金对账。', 'snapshot detail should be preserved');
      assertEqual(
        period.checkItems[0]?.sourceSummary,
        '银行对账 / 1 条',
        'snapshot source summary should be normalized to module count'
      );
      assertEqual(
        period.checkItems[0]?.sourceSummary.includes('FIN-LATER-DRIFT'),
        false,
        'live source drift should not replace closed-period snapshot source summary'
      );
      assertEqual(
        period.checkItems[0]?.nextStep,
        '期间已结账，只读回看',
        'closed period snapshot should still render readback-only handling copy'
      );
    }
  },
  {
    name: 'keeps closed-period readback stable when legacy locks have no close snapshots',
    run: () => {
      const rows = buildRows({
        financeRows: [createFinanceTransaction({ reconciliationStatus: '未对账', transactionNo: 'FIN-LEGACY-DRIFT' })],
        ledgerEntries: balancedLedgerEntries,
        periodLocks: [createAccountingPeriodLockRecord('2026-06', 'legacy frontend close without snapshots')],
        taxMatterRows: [createTaxMatter({})],
        voucherRows: [createVoucher('待记账', { sourceNo: 'SRC-LEGACY-UNBOOKED' })]
      });
      const period = rows.find((record) => record.accountingPeriod === '2026-06');

      if (!period) {
        throw new Error('expected 2026-06 period');
      }

      assertEqual(period.status, '已结账', 'legacy closed lock should still display as closed');
      assertEqual(period.blockedCheckCount, 0, 'legacy closed readback should not reintroduce live blockers without snapshots');
      assertEqual(
        period.checkItems.every((item) => item.status === '通过' && item.nextStep === '期间已结账，只读回看'),
        true,
        'legacy closed readback checks should be normalized to readback-only rows'
      );
      assertEqual(
        period.checkItems.every((item) => item.sourceSummary === '结账记录'),
        true,
        'legacy closed readback fallback should point to the close record instead of live source drift'
      );
    }
  },
  {
    name: 'limits period-close records to the configured account-set start period',
    run: () => {
      const rows = buildFinancePeriodCloseRecords({
        accountingPeriodStart: '2026-06',
        financeRows: [
          createFinanceTransaction({ accountingPeriod: '2026-04', transactionNo: 'FIN-APRIL-HISTORY' }),
          createFinanceTransaction({ accountingPeriod: '2026-06', transactionNo: 'FIN-JUNE-ACTIVE' })
        ],
        ledgerEntries: balancedLedgerEntries,
        periodLocks: [],
        taxMatterRows: [createTaxMatter({ period: '2026-04' }), createTaxMatter({})],
        voucherRows: [
          createVoucher('已记账', { accountingPeriod: '2026-04', id: 'voucher-april-history', voucherDate: '2026-04-15' }),
          createVoucher('已记账', { id: 'voucher-june-active' })
        ]
      });

      assertEqual(rows.length, 1, 'pre-start accounting periods should stay outside period-close records');
      assertEqual(rows[0]?.accountingPeriod, '2026-06', 'period close should start from the enabled account-set period');
    }
  },
  {
    name: 'filters periods by accounting period and keyword',
    run: () => {
      const rows = buildFinancePeriodCloseRecords({
        financeRows: [createFinanceTransaction({ accountingPeriod: '2026-05' }), createFinanceTransaction({})],
        ledgerEntries: balancedLedgerEntries,
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'month', month: '2026-05' },
          keyword: '可结账'
        },
        periodLocks: [],
        taxMatterRows: [createTaxMatter({ period: '2026-05' })],
        voucherRows: [createVoucher('已记账', { accountingPeriod: '2026-05' })]
      });

      assertEqual(rows.length, 1, 'period and keyword filters should narrow result');
      assertEqual(rows[0]?.accountingPeriod, '2026-05', 'month filter should return selected period');
    }
  },
  {
    name: 'filters periods by close status without relying on keyword matching',
    run: () => {
      const rows = buildFinancePeriodCloseRecords({
        financeRows: [
          createFinanceTransaction({ accountingPeriod: '2026-05' }),
          createFinanceTransaction({ accountingPeriod: '2026-06' })
        ],
        ledgerEntries: [
          ...balancedLedgerEntries,
          createLedgerEntry({
            accountingPeriod: '2026-05',
            debitAmount: 100,
            id: 'may-entry-debit',
            subjectCode: '1002',
            voucherDate: '2026-05-15',
            voucherId: 'voucher-may-booked'
          }),
          createLedgerEntry({
            accountingPeriod: '2026-05',
            creditAmount: 100,
            id: 'may-entry-credit',
            side: '贷方',
            subjectCode: '5001',
            subjectName: '主营业务收入',
            voucherDate: '2026-05-15',
            voucherId: 'voucher-may-booked'
          })
        ],
        filters: {
          ...defaultFinancePeriodCloseFilters,
          accountingPeriodTime: { mode: 'all' },
          closeStatus: '已结账'
        },
        periodLocks: [createAccountingPeriodLockRecord('2026-05', '2026-05 月结确认')],
        taxMatterRows: [createTaxMatter({ period: '2026-05' }), createTaxMatter({})],
        voucherRows: [
          createVoucher('已记账', {
            accountingPeriod: '2026-05',
            id: 'voucher-may-booked',
            voucherDate: '2026-05-15'
          }),
          createVoucher('已记账', { id: 'voucher-june-booked' })
        ]
      });

      assertEqual(rows.length, 1, 'close-status filter should return only matching periods');
      assertEqual(rows[0]?.accountingPeriod, '2026-05', 'closed status filter should return the locked period');
      assertEqual(rows[0]?.status, '已结账', 'filtered row should carry the selected close status');
    }
  }
];

export function runFinancePeriodCloseModelTests() {
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
