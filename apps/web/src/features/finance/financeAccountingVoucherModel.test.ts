import {
  financeTransactionRecords,
  getFinanceSeedPublicAccountRef,
  type FinanceTransactionRecord
} from './financeData';
import { buildSeedFinanceBankReconciliationLinks } from './financeBankReconciliationModel';
import {
  financeInvoiceBusinessAllocations,
  financeInvoiceRecords,
  type FinanceInvoiceRecord
} from './financeInvoiceData';
import { financeReceivablePayableRecords, type FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { buildSalaryReceivablePayableRecord } from './financeSalarySettlementModel';
import { financeTaxMatterRecords, type FinanceTaxMatterRecord } from './financeTaxFilingData';
import {
  buildTaxMatterPaymentTransaction,
  buildTaxMatterRefundTransaction,
  recordTaxMatterDeclarationResult,
  recordTaxMatterPaymentResult,
  recordTaxMatterRefundApplication,
  recordTaxMatterRefundResult,
  startTaxMatterDeclarationRevision
} from './financeTaxMatterModel';
import { buildRedInvoiceBusinessAllocations } from './financeInvoiceAssociationModel';
import type { LedgerOpeningAdjustmentVoucherRecord } from './financeLedgerInitializationModel';
import { confirmFinanceMonthEndMatter, financeMonthEndMatterRecords } from './financeMonthEndModel';
import { financeFixedAssetRecords, financePrepaidExpenseRecords } from './financeMonthEndSourceData';
import {
  applyAccountingPeriodCloseLock,
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVoucherMetrics,
  buildAccountingVoucherFromReceivablePayable,
  buildAccountingVoucherFromTaxMatter,
  buildAccountingVoucherFromTransaction,
  buildAccountingVouchers,
  buildAccountingVoucherFromLaterPeriodAdjustment,
  canBookAccountingVoucher,
  canCreateLaterPeriodAccountingVoucherAdjustment,
  canReverseAccountingVoucher,
  canSubmitLaterPeriodAccountingVoucherAdjustment,
  canSubmitAccountingVoucherReversal,
  createAccountingVoucherLifecycleRecord,
  createLaterPeriodAccountingVoucherAdjustmentRecord,
  createReversalAccountingVoucherSnapshot,
  createReversedAccountingVoucherSnapshot,
  defaultAccountingVoucherFilters,
  getAccountingVoucherDeepLinkTargetId,
  getDefaultLaterPeriodAdjustmentAccountingPeriod,
  getAvailableLaterPeriodAdjustmentAccountingPeriod,
  getAccountingVoucherDefaultReversalDate,
  getAccountingVoucherFiltersFromQueryString,
  getAccountingPeriodClosedReason,
  getAccountingVoucherPeriodLockNotice,
  getClosedAccountingPeriodReadbackNotice,
  getNextAccountingVoucherNo,
  getAccountingVoucherCreditTotal,
  getAccountingVoucherDebitTotal,
  getAccountingVoucherIssueSummary,
  guardAccountingPeriodOpen,
  isAccountingVoucherBalanced,
  isAccountingPeriodLocked,
  matchesAccountingVoucherFilters,
  reopenAccountingPeriodLock,
  validateLaterPeriodAccountingVoucherAdjustment,
  validateAccountingVoucherReversal,
  type AccountingPeriodLockRecord,
  type AccountingVoucherLaterPeriodAdjustmentRecord,
  type AccountingVoucherBuildOptions,
  type AccountingVoucherIssueCode,
  type AccountingVoucherLifecycleRecord,
  type AccountingVoucherLine,
  type AccountingVoucherRecord
} from './financeAccountingVoucherModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertIncludes<T>(actual: T[], expected: T, message: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}. Expected ${String(expected)} in ${actual.join(', ')}`);
  }
}

function getVoucherBySourceNo(rows: AccountingVoucherRecord[], sourceNo: string) {
  const voucher = rows.find((record) => record.sourceNo === sourceNo);

  if (!voucher) {
    throw new Error(`expected voucher for source ${sourceNo}`);
  }

  return voucher;
}

function buildAccountingVouchersForTest(
  receivablePayableRows: FinanceReceivablePayableRecord[],
  financeRows: FinanceTransactionRecord[],
  invoiceRows: FinanceInvoiceRecord[] = [],
  taxMatterRows: FinanceTaxMatterRecord[] = [],
  bankReconciliationRows = buildSeedFinanceBankReconciliationLinks(financeRows),
  openingAdjustmentRows: LedgerOpeningAdjustmentVoucherRecord[] = [],
  laterPeriodAdjustmentRows: AccountingVoucherLaterPeriodAdjustmentRecord[] = [],
  options: AccountingVoucherBuildOptions = {}
) {
  return buildAccountingVouchers(
    receivablePayableRows,
    financeRows,
    invoiceRows,
    taxMatterRows,
    bankReconciliationRows,
    openingAdjustmentRows,
    laterPeriodAdjustmentRows,
    {
      ...options,
      invoiceBusinessAllocationRows: options.invoiceBusinessAllocationRows ?? financeInvoiceBusinessAllocations
    }
  );
}

function getTaxMatterByNo(matterNo: string) {
  const record = financeTaxMatterRecords.find((taxMatterRecord) => taxMatterRecord.matterNo === matterNo);

  if (!record) {
    throw new Error(`expected tax matter ${matterNo}`);
  }

  return record;
}

function createSalarySettlementFixture() {
  const settlementSnapshot = {
    businessDeductionAmount: 0,
    employeeGrossPayableAmount: 12000,
    employeeHousingFundAmount: 400,
    employeeNetPayableAmount: 10500,
    employeeSocialInsuranceAmount: 800,
    employerContributionAmount: 3000,
    employerHousingFundAmount: 600,
    employerSocialInsuranceAmount: 2400,
    grossEarningsAmount: 12000,
    payrollMonth: '2026-06',
    payrollNo: 'PAY-202606-EMP-SALARY',
    taxableIncomeAmount: 10800,
    totalEmploymentCostAmount: 15000,
    withheldPersonalIncomeTaxAmount: 300
  };
  const receivablePayable = buildSalaryReceivablePayableRecord({
    employeeName: '测试员工',
    employeeNo: 'EMP-SALARY',
    settlementSnapshot,
    workflow: {
      confirmedAt: '2026-06-30 18:00',
      confirmedBy: '测试财务',
      id: 'salary-workflow-test',
      memberId: 'EMP-SALARY',
      month: '2026-06',
      note: '',
      payrollNo: settlementSnapshot.payrollNo,
      settlementSnapshot,
      status: '已确认',
      updatedAt: '2026-06-30 18:00'
    }
  });
  const transactionTemplate = financeTransactionRecords.find((record) => record.status === '已入账');

  if (!transactionTemplate) {
    throw new Error('expected posted transaction fixture');
  }

  const paymentTransaction: FinanceTransactionRecord = {
    ...transactionTemplate,
    accountingPeriod: '2026-07',
    amount: settlementSnapshot.employeeNetPayableAmount,
    category: '工资发放',
    counterparty: '测试员工',
    counterpartyType: '员工',
    direction: '支出',
    id: 'finance-salary-payment-test',
    occurredAt: '2026-07-15',
    reconciliationStatus: '未对账',
    sourceNo: settlementSnapshot.payrollNo,
    sourceTitle: '测试员工 2026-06 工资发放',
    sourceType: '薪酬发放',
    status: '已入账',
    transactionNo: 'FIN-SALARY-PAYMENT-TEST',
    voucherStatus: '已上传'
  };

  return { paymentTransaction, receivablePayable, settlementSnapshot };
}

function getLineBySide(record: AccountingVoucherRecord, side: AccountingVoucherLine['side']) {
  const line = record.lines.find((item) => item.side === side);

  if (!line) {
    throw new Error(`expected ${side} line for ${record.sourceNo}`);
  }

  return line;
}

function getLineSubjectCode(record: AccountingVoucherRecord, side: AccountingVoucherLine['side']) {
  const line = getLineBySide(record, side);

  return line.subject?.code ?? line.subjectCode;
}

function getLineBySubjectCode(record: AccountingVoucherRecord, subjectCode: string) {
  const line = record.lines.find((item) => (item.subject?.code ?? item.subjectCode) === subjectCode);

  if (!line) {
    throw new Error(`expected subject ${subjectCode} line for ${record.sourceNo}`);
  }

  return line;
}

function createBookedLifecycleRow(
  record: AccountingVoucherRecord,
  voucherNo = '记-202606-001',
  bookedAt = '2026-06-27 17:10'
): AccountingVoucherLifecycleRecord {
  return createAccountingVoucherLifecycleRecord(record, voucherNo, '李明', bookedAt);
}

function createReversedLifecycleRows(record: AccountingVoucherRecord) {
  const booked = createBookedLifecycleRow(record, '记-202606-001');
  const reversedAt = '2026-06-27 17:20';
  const reversalSnapshot = createReversalAccountingVoucherSnapshot({
    actor: '李明',
    voucherNo: '记-202606-002',
    originalRecord: booked.snapshot,
    reason: '测试冲销',
    reversedAt
  });
  const reversedSnapshot = createReversedAccountingVoucherSnapshot({
    record: booked.snapshot,
    reversedAt,
    reversedBy: '李明',
    reversedByVoucherId: reversalSnapshot.id,
    reversalReason: '测试冲销'
  });

  return [
    {
      accountingPeriod: reversalSnapshot.accountingPeriod,
      bookedAt: reversalSnapshot.bookedAt ?? reversedAt,
      bookedBy: reversalSnapshot.bookedBy ?? '李明',
      voucherNo: reversalSnapshot.voucherNo,
      snapshot: reversalSnapshot,
      status: '已记账',
      voucherId: reversalSnapshot.id
    },
    {
      ...booked,
      reversedAt,
      reversedBy: '李明',
      reversalReason: '测试冲销',
      snapshot: reversedSnapshot,
      status: '已冲销'
    }
  ] satisfies AccountingVoucherLifecycleRecord[];
}

function createAdjustmentTransaction(overrides: Partial<FinanceTransactionRecord> = {}): FinanceTransactionRecord {
  const origin = financeTransactionRecords.find((record) => record.transactionNo === 'FIN-202606-0004') ?? financeTransactionRecords[0]!;

  return {
    ...origin,
    adjustmentContext: {
      bankSerialNo: 'CMB202606120002',
      mode: '补差',
      originTransactionNo: origin.transactionNo,
      reason: '银行实际金额与系统流水不一致'
    },
    amount: 200,
    files: [
      {
        id: 'fin-file-adjustment',
        name: '补差付款回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-13'
      }
    ],
    id: 'finance-adjust-reviewed-for-voucher',
    reconciledAt: '2026-06-14',
    reconciliationStatus: '已对账',
    sourceNo: origin.transactionNo,
    sourceTitle: `补差处理 / ${origin.transactionNo} / CMB202606120002`,
    sourceType: '流水补差',
    status: '已入账',
    transactionNo: 'FIN-ADJ-202606-0001',
    voucherStatus: '已上传',
    ...overrides
  };
}

function createOpeningAdjustmentVoucher(
  overrides: Partial<LedgerOpeningAdjustmentVoucherRecord> = {}
): LedgerOpeningAdjustmentVoucherRecord {
  return {
    accountingPeriod: '2026-06',
    amount: 1_200,
    balanceSide: '借方',
    createdAt: '2026-06-30 17:30',
    createdBy: '李明',
    evidenceName: '期初银行对账差异说明-202606',
    id: 'ledger-opening-adjustment-test',
    reason: '期初银行余额核对差异',
    status: '待记账',
    subjectCode: '1002',
    subjectName: '银行存款',
    voucherNo: 'INIT-ADJ-202606-0001',
    ...overrides
  };
}

function createMissingEvidenceTransaction(): FinanceTransactionRecord {
  const origin = financeTransactionRecords.find((record) => record.transactionNo === 'FIN-202606-0001') ?? financeTransactionRecords[0]!;

  return {
    ...origin,
    files: [],
    id: 'finance-missing-evidence-for-voucher',
    status: '已入账',
    transactionNo: 'FIN-MISSING-EVIDENCE-001',
    voucherStatus: '待补充'
  };
}

function createMissingSubjectPayable(): FinanceReceivablePayableRecord {
  const origin = financeReceivablePayableRecords.find((record) => record.documentNo === 'AP-202605-018') ?? financeReceivablePayableRecords[0]!;

  return {
    ...origin,
    category: '未配置类目',
    categorySnapshot: {
      ...origin.categorySnapshot,
      accountingSubject: {
        balanceDirection: '借方',
        code: '',
        name: '未配置科目',
        type: '损益类'
      },
      accountingSubjectMappings: {},
      mappingIssue: '财务类目缺少有效会计科目映射',
      mappingStatus: '待配置',
      primaryCode: 'FC1-UNMAPPED',
      primaryName: '未归类',
      secondaryCode: 'FC2-UNMAPPED',
      secondaryName: '未配置类目'
    },
    documentNo: 'AP-MISSING-SUBJECT-001',
    id: 'ap-missing-subject-001',
    sourceNo: 'EXP-MISSING-SUBJECT-001',
    taxBasis: {
      basisSource: '不涉及发票',
      salesCategory: '服务、不动产和无形资产',
      taxAmount: 0,
      taxExcludedAmount: origin.amount,
      taxIncludedAmount: origin.amount,
      taxRate: '0%'
    }
  };
}

function createReceivableWithPendingTaxBasis(): FinanceReceivablePayableRecord {
  const origin = financeReceivablePayableRecords.find((record) => record.documentNo === 'AR-202606-003') ?? financeReceivablePayableRecords[0]!;

  return {
    ...origin,
    documentNo: 'AR-PENDING-TAX-BASIS-001',
    id: 'ar-pending-tax-basis-001',
    sourceNo: 'PRJ-PENDING-TAX-BASIS-001',
    taxBasis: {
      basisSource: '待确认',
      salesCategory: '服务、不动产和无形资产',
      taxAmount: 0,
      taxExcludedAmount: 0,
      taxIncludedAmount: 0,
      taxRate: '-'
    }
  };
}

function createTaxMatter(overrides: Partial<FinanceTaxMatterRecord> = {}): FinanceTaxMatterRecord {
  return {
    ...getTaxMatterByNo('TAX-2026Q1-VAT'),
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds a month-end candidate voucher only after its source matter is confirmed',
    run: () => {
      const pendingMatter = financeMonthEndMatterRecords.find((record) => record.type === '固定资产折旧')!;
      const prepaidMatter = financeMonthEndMatterRecords.find((record) => record.type === '待摊费用摊销')!;
      const beforeConfirmation = buildAccountingVouchersForTest([], [], [], [], [], [], [], {
        monthEndMatterRows: [pendingMatter]
      });
      const confirmedMatter = confirmFinanceMonthEndMatter(pendingMatter);
      const afterConfirmation = buildAccountingVouchersForTest([], [], [], [], [], [], [], {
        monthEndMatterRows: [confirmedMatter]
      });

      assertEqual(beforeConfirmation.some((record) => record.sourceNo === pendingMatter.sourceNo), false, 'unconfirmed month-end matter should not create a voucher');
      const voucher = getVoucherBySourceNo(afterConfirmation, confirmedMatter.sourceNo);
      assertEqual(voucher.status, '待记账', 'confirmed month-end matter should create a ready-to-book voucher');
      assertEqual(getLineSubjectCode(voucher, '借方'), confirmedMatter.debitSubjectCode, 'month-end debit subject should come from the source schedule');
      assertEqual(getLineSubjectCode(voucher, '贷方'), confirmedMatter.creditSubjectCode, 'month-end credit subject should come from the source schedule');
      assertEqual(confirmedMatter.amount, financeFixedAssetRecords[0].monthlyDepreciation, 'depreciation candidate should use the fixed-asset ledger schedule');
      assertEqual(prepaidMatter.amount, financePrepaidExpenseRecords[0].monthlyAmortization, 'amortization candidate should use the prepaid-expense schedule');
    }
  },
  {
    name: 'derives accounting voucher filters and target drawer from deep-link query',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const targetVoucher = vouchers.find((record) => record.status === '待记账' && record.accountingPeriod === '2026-06');

      if (!targetVoucher) {
        throw new Error('expected ready-to-prepare voucher');
      }

      const query = `period=${targetVoucher.accountingPeriod}&status=${targetVoucher.status}&sourceNo=${targetVoucher.sourceNo}`;
      const filters = getAccountingVoucherFiltersFromQueryString(query);

      assertEqual(filters.accountingPeriodTime.mode, 'month', 'deep link should switch date filter to month mode');
      if (filters.accountingPeriodTime.mode !== 'month') {
        throw new Error('expected month filter');
      }

      assertEqual(filters.accountingPeriodTime.month, targetVoucher.accountingPeriod, 'deep link should use target accounting period');
      assertEqual(filters.status, targetVoucher.status, 'deep link should use target voucher status');
      assertEqual(filters.keyword, targetVoucher.sourceNo, 'deep link should search by source number');
      assertEqual(
        getAccountingVoucherDeepLinkTargetId(vouchers, query),
        targetVoucher.id,
        'deep link should locate the exact voucher row for drawer opening'
      );
    }
  },
  {
    name: 'builds balanced statusized vouchers from business confirmations, reviewed cash flows, and invoice facts',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const metrics = buildAccountingVoucherMetrics(vouchers);
      const reviewedNonAdjustmentRows = financeTransactionRecords.filter(
        (record) => record.status === '已入账' && record.sourceType !== '流水冲正' && record.sourceType !== '流水补差'
      );
      const unresolvedRedInvoices = financeInvoiceRecords.filter((invoice) => invoice.invoiceColor === '红票' && !invoice.originalInvoiceId);

      assertEqual(vouchers.every(isAccountingVoucherBalanced), true, 'every derived voucher row should balance');
      assertEqual(metrics.totalCount, vouchers.length, 'metrics should count all voucher rows');
      assertEqual(metrics.balancedCount, vouchers.length, 'metrics should count every derived voucher row as balanced');
      assertEqual(metrics.readyToBookCount > 0, true, 'complete rows should be ready to book');
      assertEqual(metrics.issueCount > 0, true, 'invoice-incomplete rows should create issue vouchers');
      assertEqual(metrics.pendingGenerationCount, 0, 'bank reconciliation should not keep reviewed cash rows in pending generation');
      assertEqual(
        metrics.readyToBookCount + metrics.issueCount + metrics.pendingGenerationCount,
        vouchers.length,
        'current frontend rows should be ready, waiting, or require handling'
      );
      assertEqual(metrics.bookedCount, 0, 'frontend derived rows are not booked vouchers');
      assertEqual(metrics.reversedCount, 0, 'frontend derived rows are not reversed vouchers');
      assertEqual(
        vouchers.filter((record) => record.businessType === '权责凭证').length,
        financeReceivablePayableRecords.filter((record) => record.confirmationStatus === '已确认').length,
        'only confirmed receivable/payable items should create business confirmation vouchers'
      );
      assertEqual(
        vouchers.filter((record) => record.businessType === '资金凭证').length,
        reviewedNonAdjustmentRows.length,
        'only reviewed non-adjustment cash-flow rows should create cash vouchers'
      );
      assertEqual(
        vouchers.filter((record) => record.businessType === '调整凭证').length,
        unresolvedRedInvoices.length,
        'unresolved red invoices should create adjustment handling rows'
      );
    }
  },
  {
    name: 'excludes unconfirmed receivable-payable rows from business vouchers',
    run: () => {
      const pendingRecord = {
        ...financeReceivablePayableRecords[0]!,
        confirmationStatus: '待确认' as const,
        documentNo: 'AR-PENDING-001',
        id: 'ar-pending-001'
      };
      const vouchers = buildAccountingVouchersForTest([pendingRecord, ...financeReceivablePayableRecords], financeTransactionRecords, financeInvoiceRecords);

      assertEqual(
        vouchers.some((record) => record.sourceNo === pendingRecord.documentNo),
        false,
        'pending confirmation row should not create business confirmation voucher'
      );
    }
  },
  {
    name: 'creates a full revenue credit for a below-threshold ordinary invoice without inventing output VAT',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const voucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const taxLine = voucher.lines.find((line) => (line.subject?.code ?? line.subjectCode) === '2221.01');
      const revenueLine = getLineBySubjectCode(voucher, '5001');

      assertEqual(voucher.sourceType, '业务确认', 'receivable/payable source should be business confirmation');
      assertEqual(voucher.businessType, '权责凭证', 'receivable/payable confirmation should create accrual voucher');
      assertEqual(voucher.kind, '转账凭证', 'business confirmation should use transfer voucher');
      assertEqual(voucher.status, '待记账', 'fully invoiced receivable should be ready to prepare');
      assertEqual(voucher.invoiceRefs.length, 1, 'fully invoiced receivable should retain invoice reference');
      assertEqual(getLineSubjectCode(voucher, '借方'), '1122', 'receivable confirmation debit should post to accounts receivable');
      assertEqual(getLineSubjectCode(voucher, '贷方'), '5001', 'contract receivable confirmation credit should post to main business revenue');
      assertEqual(taxLine, undefined, 'ordinary invoice under the exemption threshold should not invent output VAT');
      assertEqual(revenueLine.amount, 68000, 'ordinary invoice under the exemption threshold should credit the full revenue amount');
      assertEqual(getAccountingVoucherDebitTotal(voucher), 68000, 'receivable confirmation debit amount should match source amount');
      assertEqual(getAccountingVoucherCreditTotal(voucher), 68000, 'receivable confirmation credit amount should match source amount');
    }
  },
  {
    name: 'does not duplicate confirmation wording for project stage receivable summary',
    run: () => {
      const projectStageRecord = {
        ...financeReceivablePayableRecords[0]!,
        documentNo: 'AR-PROJECT-STAGE-SUMMARY',
        id: 'rp-project-stage-summary',
        sourceTitle: '光谷商业空间方案阶段',
        sourceType: '项目阶段确认' as const
      };
      const vouchers = buildAccountingVouchersForTest(
        [projectStageRecord, ...financeReceivablePayableRecords],
        financeTransactionRecords,
        financeInvoiceRecords
      );
      const voucher = getVoucherBySourceNo(vouchers, projectStageRecord.documentNo);

      assertEqual(voucher.summary, '项目阶段确认：光谷商业空间方案阶段', 'project stage summary should not append confirmation twice');
      assertEqual(voucher.summary.includes('确认确认'), false, 'project stage summary should not contain duplicated confirmation wording');
    }
  },
  {
    name: 'NP-19 splits salary confirmation into net pay and statutory liabilities without changing gross payroll',
    run: () => {
      const salaryFixture = createSalarySettlementFixture();
      const vouchers = buildAccountingVouchersForTest(
        [salaryFixture.receivablePayable, ...financeReceivablePayableRecords],
        financeTransactionRecords,
        financeInvoiceRecords
      );
      const salaryVoucher = getVoucherBySourceNo(vouchers, salaryFixture.receivablePayable.documentNo);
      const outsourceVoucher = getVoucherBySourceNo(vouchers, 'AP-202606-003');
      const reimbursementVoucher = getVoucherBySourceNo(vouchers, 'AP-202605-018');

      assertEqual(salaryFixture.receivablePayable.amount, 10500, 'salary payable business amount should equal employee net cash payable');
      assertEqual(getLineSubjectCode(salaryVoucher, '借方'), '5602.01', 'salary payable confirmation should debit payroll expense detail subject');
      assertEqual(getLineBySubjectCode(salaryVoucher, '2211.01').amount, 10500, 'salary payable should retain only employee net cash payable');
      assertEqual(getLineBySubjectCode(salaryVoucher, '2221.03').amount, 300, 'salary confirmation should credit withheld IIT liability');
      assertEqual(getLineBySubjectCode(salaryVoucher, '2211.03').amount, 800, 'salary confirmation should credit employee social insurance liability');
      assertEqual(getLineBySubjectCode(salaryVoucher, '2211.04').amount, 400, 'salary confirmation should credit employee housing fund liability');
      assertEqual(getAccountingVoucherDebitTotal(salaryVoucher), 12000, 'salary expense debit should retain the original payroll result');
      assertEqual(getAccountingVoucherCreditTotal(salaryVoucher), 12000, 'split salary liabilities should remain balanced');
      assertEqual(getLineSubjectCode(outsourceVoucher, '借方'), '5401', 'outsourcing payable confirmation should debit main business cost');
      assertEqual(getLineSubjectCode(outsourceVoucher, '贷方'), '2202', 'outsourcing payable confirmation should credit accounts payable');
      assertEqual(outsourceVoucher.invoiceRefs.length, 1, 'matched input invoice should be retained as cost basis');
      assertEqual(
        outsourceVoucher.lines.some((line) => (line.subject?.code ?? line.subjectCode) === '2221'),
        false,
        'small-scale input invoice should not create VAT input deduction entry'
      );
      assertEqual(getLineSubjectCode(reimbursementVoucher, '贷方'), '2241', 'employee reimbursement payable should credit other payables');
    }
  },
  {
    name: 'creates cash settlement entries after transaction review and original-evidence verification',
    run: () => {
      const salaryFixture = createSalarySettlementFixture();
      const vouchers = buildAccountingVouchersForTest(
        [salaryFixture.receivablePayable, ...financeReceivablePayableRecords],
        [salaryFixture.paymentTransaction, ...financeTransactionRecords],
        financeInvoiceRecords
      );
      const cashReceiptVoucher = getVoucherBySourceNo(vouchers, 'FIN-202606-0001');
      const salaryPaymentVoucher = getVoucherBySourceNo(vouchers, salaryFixture.paymentTransaction.transactionNo);
      const pendingReviewVoucher = vouchers.find((record) => record.sourceNo === 'FIN-202606-0004');

      assertEqual(cashReceiptVoucher.sourceType, '收付款', 'cash-flow source should be cash settlement');
      assertEqual(cashReceiptVoucher.businessType, '资金凭证', 'ordinary reviewed transaction should create cash voucher');
      assertEqual(cashReceiptVoucher.status, '待记账', 'reviewed and bank-reconciled transaction should be ready to prepare');
      assertEqual(cashReceiptVoucher.kind, '收款凭证', 'income cash-flow should use receipt voucher');
      assertEqual(
        cashReceiptVoucher.sourceRefs.some((sourceRef) => sourceRef.module === '银行对账' && sourceRef.role === '银行依据'),
        true,
        'cash voucher should include bank reconciliation source evidence'
      );
      assertEqual(getLineSubjectCode(cashReceiptVoucher, '借方'), '1002', 'cash receipt should debit bank deposit');
      assertEqual(getLineSubjectCode(cashReceiptVoucher, '贷方'), '1122', 'cash receipt should credit accounts receivable');
      assertEqual(salaryPaymentVoucher.status, '待记账', 'reviewed salary payment with evidence should not wait for bank reconciliation');
      assertEqual(
        salaryPaymentVoucher.issueReasons.length,
        0,
        'unreconciled salary payment should leave bank reconciliation to the period-close control'
      );
      assertEqual(salaryPaymentVoucher.kind, '付款凭证', 'expense cash-flow should use payment voucher');
      assertEqual(getLineSubjectCode(salaryPaymentVoucher, '借方'), '2211.01', 'salary payment should debit salary payable detail subject');
      assertEqual(getLineSubjectCode(salaryPaymentVoucher, '贷方'), '1002', 'salary payment should credit bank deposit');
      assertEqual(pendingReviewVoucher, undefined, 'pending-review cash-flow should not create accounting voucher');
    }
  },
  {
    name: 'requires explicit bank reconciliation source after reviewed transaction is reconciled',
    run: () => {
      const reconciledTransaction = financeTransactionRecords.find((record) => record.transactionNo === 'FIN-202606-0001')!;
      const vouchers = buildAccountingVouchers([], [reconciledTransaction], [], [], []);
      const voucher = getVoucherBySourceNo(vouchers, reconciledTransaction.transactionNo);

      assertEqual(voucher.status, '需处理', 'reconciled cash voucher without bank source should require handling');
      assertIncludes(
        voucher.issueReasons,
        'bank_reconciliation_source_missing' satisfies AccountingVoucherIssueCode,
        'reconciled cash voucher should keep bank source evidence as a hard prerequisite'
      );
    }
  },
  {
    name: 'creates adjustment vouchers from reviewed adjustment transactions only',
    run: () => {
      const reviewedAdjustment = createAdjustmentTransaction();
      const pendingAdjustment = createAdjustmentTransaction({
        id: 'finance-adjust-pending-for-voucher',
        reconciliationStatus: '未对账',
        reconciledAt: undefined,
        status: '待复核',
        transactionNo: 'FIN-ADJ-202606-0002'
      });
      const unreconciledAdjustment = createAdjustmentTransaction({
        id: 'finance-adjust-unreconciled-for-voucher',
        reconciliationStatus: '未对账',
        reconciledAt: undefined,
        transactionNo: 'FIN-ADJ-202606-0003'
      });
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, [
        reviewedAdjustment,
        pendingAdjustment,
        unreconciledAdjustment,
        ...financeTransactionRecords
      ], financeInvoiceRecords);
      const adjustmentVoucher = getVoucherBySourceNo(vouchers, reviewedAdjustment.transactionNo);
      const pendingVoucher = vouchers.find((record) => record.sourceNo === pendingAdjustment.transactionNo);
      const unreconciledVoucher = getVoucherBySourceNo(vouchers, unreconciledAdjustment.transactionNo);

      assertEqual(adjustmentVoucher.businessType, '调整凭证', 'reviewed adjustment should create adjustment voucher');
      assertEqual(adjustmentVoucher.summary.includes('补差确认'), true, 'adjustment voucher summary should preserve adjustment mode without cash-ledger booking wording');
      assertEqual(adjustmentVoucher.status, '待记账', 'reviewed and bank-reconciled adjustment with evidence should be ready to prepare');
      assertEqual(unreconciledVoucher.status, '待记账', 'reviewed adjustment with evidence should not wait for bank reconciliation');
      assertEqual(pendingVoucher, undefined, 'pending adjustment should not create accounting voucher');
    }
  },
  {
    name: 'limits accounting voucher candidates to the configured account-set start period',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(
        financeReceivablePayableRecords,
        financeTransactionRecords,
        financeInvoiceRecords,
        financeTaxMatterRecords,
        buildSeedFinanceBankReconciliationLinks(financeTransactionRecords),
        [],
        [],
        { accountingPeriodStart: '2026-06' }
      );

      assertEqual(
        vouchers.every((record) => record.accountingPeriod >= '2026-06'),
        true,
        'account-set scope should keep pre-start transactions out of accounting candidates'
      );
      assertEqual(
        vouchers.some((record) => record.accountingPeriod === '2026-06'),
        true,
        'account-set scope should keep in-scope accounting candidates'
      );
    }
  },
  {
    name: 'creates opening-adjustment voucher candidates and ledger entries after booking',
    run: () => {
      const openingAdjustment = createOpeningAdjustmentVoucher({ createdAt: '2026-07-01 09:30' });
      const vouchers = buildAccountingVouchersForTest([], [], [], [], [], [openingAdjustment]);
      const voucher = getVoucherBySourceNo(vouchers, openingAdjustment.voucherNo);

      assertEqual(voucher.accountingPeriod, '2026-06', 'opening adjustment should use its accounting period instead of creation month');
      assertEqual(voucher.businessType, '调整凭证', 'opening adjustment should create adjustment voucher candidate');
      assertEqual(voucher.sourceModule, '账套初始化', 'opening adjustment should keep account-set initialization as source module');
      assertEqual(voucher.sourceType, '期初调整', 'opening adjustment should keep opening-adjustment source type');
      assertEqual(voucher.status, '待记账', 'complete opening adjustment should be ready to prepare');
      assertEqual(voucher.kind, '转账凭证', 'opening adjustment should be a transfer voucher');
      assertEqual(getLineSubjectCode(voucher, '借方'), '1002', 'debit-side opening adjustment should debit target subject');
      assertEqual(getLineSubjectCode(voucher, '贷方'), '3104', 'opening adjustment should credit retained-profit carry subject');

      const bookedRows = applyAccountingVoucherLifecycle(vouchers, [createBookedLifecycleRow(voucher, '记-202606-009')]);
      const ledgerEntries = buildAccountingLedgerEntries(bookedRows);

      assertEqual(
        ledgerEntries.some((entry) => entry.subjectCode === '1002' && entry.debitAmount === 1_200),
        true,
        'booked opening adjustment should debit target subject in general-ledger entries'
      );
      assertEqual(
        ledgerEntries.some((entry) => entry.subjectCode === '3104' && entry.creditAmount === 1_200),
        true,
        'booked opening adjustment should credit carry subject in general-ledger entries'
      );
    }
  },
  {
    name: 'marks abnormal bank reconciliation as issue before cash voucher generation',
    run: () => {
      const abnormalTransaction = {
        ...financeTransactionRecords.find((record) => record.transactionNo === 'FIN-202606-0001')!,
        id: 'finance-bank-abnormal-for-voucher',
        reconciliationStatus: '对账异常' as const,
        transactionNo: 'FIN-BANK-ABNORMAL-001'
      };
      const vouchers = buildAccountingVouchersForTest([], [abnormalTransaction]);
      const voucher = getVoucherBySourceNo(vouchers, abnormalTransaction.transactionNo);

      assertEqual(voucher.status, '需处理', 'abnormal bank reconciliation should require handling');
      assertIncludes(
        voucher.issueReasons,
        'bank_amount_mismatch' satisfies AccountingVoucherIssueCode,
        'abnormal bank reconciliation should expose mismatch reason'
      );
    }
  },
  {
    name: 'does not accrue IIT twice and clears the withholding liability through the actual tax payment',
    run: () => {
      const iitMatter: FinanceTaxMatterRecord = {
        ...getTaxMatterByNo('TAX-202606-IIT'),
        dataStatus: '已确认',
        declarationDate: '2026-07-10',
        declarationReceiptNo: 'IIT-202606-001',
        declarationStatus: '申报成功',
        payableAmount: 480,
        preparedPayableAmount: 480,
        processStatus: '待缴款'
      };
      const taxAccrualVoucher = buildAccountingVoucherFromTaxMatter(iitMatter, 0);
      const seedTransaction = financeTransactionRecords[0];

      if (!seedTransaction) {
        throw new Error('expected finance transaction seed');
      }

      const iitPayment: FinanceTransactionRecord = {
        ...seedTransaction,
        accountingPeriod: '2026-07',
        amount: 480,
        category: '税费缴纳',
        direction: '支出',
        id: 'finance-iit-payment-test',
        occurredAt: '2026-07-15',
        reconciliationStatus: '已对账',
        sourceNo: iitMatter.matterNo,
        sourceTitle: iitMatter.title,
        sourceType: '税费事项',
        status: '已入账',
        transactionNo: 'FIN-202607-IIT-001'
      };
      const paymentVoucher = getVoucherBySourceNo(
        buildAccountingVouchersForTest([], [iitPayment]),
        iitPayment.transactionNo
      );

      assertEqual(taxAccrualVoucher, undefined, 'IIT handling must not accrue liability already recognized by salary and labor facts');
      assertEqual(
        paymentVoucher.lines.some((line) => line.side === '借方' && line.subjectCode === '2221.03' && line.amount === 480),
        true,
        'actual IIT payment must debit the withholding liability'
      );
      assertEqual(
        paymentVoucher.lines.some((line) => line.side === '贷方' && line.subjectCode === '1002' && line.amount === 480),
        true,
        'actual IIT payment must credit the company bank account'
      );
    }
  },
  {
    name: 'CIT-13 creates tax accrual vouchers from completed tax matters without duplicating payment cash facts',
    run: () => {
      const vouchers = buildAccountingVouchersForTest([], financeTransactionRecords, [], financeTaxMatterRecords);
      const vatVoucher = getVoucherBySourceNo(vouchers, 'TAX-2026Q1-VAT');
      const citVoucher = getVoucherBySourceNo(vouchers, 'TAX-2026Q1-CIT');
      const vatCashVoucher = getVoucherBySourceNo(vouchers, 'FIN-202604-0009');

      assertEqual(vatVoucher.businessType, '税费凭证', 'completed tax matter should create tax voucher');
      assertEqual(vatVoucher.sourceType, '税费事项', 'tax voucher should retain tax matter source type');
      assertEqual(vatVoucher.accountingPeriod, '2026-03', 'Q1 tax accrual voucher should belong to the tax period end month');
      assertEqual(vatVoucher.voucherDate, '2026-04-12', 'tax voucher should still display the declaration or confirmation date');
      assertEqual(vatVoucher.status, '待记账', 'completed tax matter with receipts should be ready to prepare');
      assertEqual(vatVoucher.amount, 26.41, 'VAT tax matter voucher should accrue surcharge only');
      assertEqual(getLineSubjectCode(vatVoucher, '借方'), '5403', 'surcharge accrual should debit taxes and surcharges');
      assertEqual(
        vatVoucher.lines.some((line) => line.subjectCode === '2221.01'),
        false,
        'VAT already recognized by source vouchers must not be accrued again by tax handling'
      );
      assertEqual(
        vatVoucher.lines.some((line) => line.subjectCode === '2221.04' && line.amount === 15.41),
        true,
        'surcharge accrual should credit urban maintenance tax separately'
      );
      assertEqual(
        vatVoucher.lines.some((line) => line.subjectCode === '2221.06' && line.amount === 6.6),
        true,
        'surcharge accrual should credit education surcharge separately'
      );
      assertEqual(
        vatVoucher.lines.some((line) => line.subjectCode === '2221.07' && line.amount === 4.4),
        true,
        'surcharge accrual should credit local education surcharge separately'
      );
      assertEqual(
        vatVoucher.sourceRefs.some((sourceRef) => sourceRef.recordNo === 'FIN-202604-0009' && sourceRef.role === '资金结算依据'),
        true,
        'tax voucher should retain linked payment cash-flow as payment basis'
      );
      assertEqual(citVoucher.businessType, '税费凭证', 'enterprise income tax should create tax voucher');
      assertEqual(citVoucher.accountingPeriod, '2026-03', 'Q1 income-tax accrual voucher should belong to the tax period end month');
      assertEqual(getLineSubjectCode(citVoucher, '借方'), '5801', 'enterprise income tax should debit income tax expense');
      assertEqual(vatCashVoucher.businessType, '资金凭证', 'linked tax payment cash-flow should remain cash voucher');
      assertEqual(vatCashVoucher.accountingPeriod, '2026-04', 'linked tax payment cash-flow should stay in the actual payment month');
      assertEqual(vatCashVoucher.status, '待记账', 'reviewed and reconciled tax payment cash-flow should remain ready to prepare');
      assertEqual(
        vatCashVoucher.lines.some((line) => line.subjectCode === '2221.01' && line.amount === 440.1),
        true,
        'tax payment should clear the VAT liability recognized by source vouchers'
      );
      assertEqual(
        vatCashVoucher.lines.some((line) => line.subjectCode === '2221.04' && line.amount === 15.41),
        true,
        'tax payment should clear urban maintenance tax separately'
      );
      assertEqual(
        vatCashVoucher.lines.some((line) => line.subjectCode === '2221.06' && line.amount === 6.6),
        true,
        'tax payment should clear education surcharge separately'
      );
      assertEqual(
        vatCashVoucher.lines.some((line) => line.subjectCode === '2221.07' && line.amount === 4.4),
        true,
        'tax payment should clear local education surcharge separately'
      );
    }
  },
  {
    name: 'CIT-14 posts reviewed tax refunds against the tax liability instead of operating income',
    run: () => {
      const sourceMatter = getTaxMatterByNo('TAX-2025-CIT-ANNUAL');
      const refundReceipt = {
        id: 'tax-refund-accounting-receipt',
        name: '企业所得税退税回单.pdf',
        status: '已上传' as const,
        type: '退税回单',
        updatedAt: '2026-07-13'
      };
      const refundedMatter = recordTaxMatterRefundResult(sourceMatter, {
        amount: 500,
        receiptFile: refundReceipt,
        refundDate: '2026-07-13'
      });
      const pendingTransaction = buildTaxMatterRefundTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: refundedMatter,
        refundAmount: 500,
        refundDate: '2026-07-13',
        refundReceiptFile: refundReceipt
      });

      if (!pendingTransaction) {
        throw new Error('expected tax refund transaction to be generated');
      }

      const reviewedTransaction: FinanceTransactionRecord = {
        ...pendingTransaction,
        reconciliationStatus: '已对账',
        reconciledAt: '2026-07-14',
        status: '已入账'
      };
      const voucher = getVoucherBySourceNo(
        buildAccountingVouchersForTest([], [reviewedTransaction]),
        reviewedTransaction.transactionNo
      );

      assertEqual(voucher.businessType, '资金凭证', 'reviewed refund receipt should create a cash voucher');
      assertEqual(voucher.kind, '收款凭证', 'tax refund receipt should use a receipt voucher');
      assertEqual(getLineSubjectCode(voucher, '借方'), '1002', 'tax refund receipt should debit bank deposit');
      assertEqual(getLineSubjectCode(voucher, '贷方'), '2221.02', 'enterprise income tax refund should credit income-tax payable');
      assertEqual(
        voucher.lines.some((line) => line.subjectCode === '5051'),
        false,
        'tax refund must not be recognized as other operating income'
      );
    }
  },
  {
    name: 'VAT-15 posts a corrected VAT refund against each reduced tax liability',
    run: () => {
      const original = getTaxMatterByNo('TAX-2026Q1-VAT');
      const revision = startTaxMatterDeclarationRevision(original, '更正', '更正后调减增值税及附加');
      const corrected = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-05-10',
        declarationReceiptNo: 'VAT-Q1-REVISION-002',
        declarationStatus: '申报成功',
        settlementAmount: 66.51,
        settlementDirection: '应退',
        vatBreakdown: {
          declaredVatAmount: 376,
          educationSurchargeAmount: 6,
          localEducationSurchargeAmount: 4,
          urbanMaintenanceTaxAmount: 14
        }
      });
      const applied = recordTaxMatterRefundApplication(corrected, {
        applicationDate: '2026-05-11',
        method: '退税',
        receiptNo: 'VAT-Q1-REFUND-APPLICATION-001'
      });
      const receiptFile = {
        id: 'vat-q1-refund-accounting-receipt',
        name: '2026-Q1_增值税及附加退税回单.pdf',
        status: '已上传' as const,
        type: '退税回单',
        updatedAt: '2026-05-15'
      };
      const refunded = recordTaxMatterRefundResult(applied, {
        amount: 66.51,
        receiptFile,
        refundDate: '2026-05-15'
      });
      const pendingTransaction = buildTaxMatterRefundTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: refunded,
        refundAmount: 66.51,
        refundDate: '2026-05-15',
        refundReceiptFile: receiptFile
      });

      if (!pendingTransaction) {
        throw new Error('expected itemized VAT refund transaction');
      }

      const reviewedTransaction: FinanceTransactionRecord = {
        ...pendingTransaction,
        reconciliationStatus: '已对账',
        reconciledAt: '2026-05-16',
        status: '已入账'
      };
      const voucher = getVoucherBySourceNo(
        buildAccountingVouchersForTest([], [reviewedTransaction]),
        reviewedTransaction.transactionNo
      );

      assertEqual(getLineSubjectCode(voucher, '借方'), '1002', 'VAT refund should debit bank deposit');
      assertEqual(
        voucher.lines.some((line) => line.side === '贷方' && line.subjectCode === '2221.01' && line.amount === 64.1),
        true,
        'VAT refund should credit VAT payable by the corrected amount'
      );
      assertEqual(
        voucher.lines.some((line) => line.side === '贷方' && line.subjectCode === '2221.04' && line.amount === 1.41),
        true,
        'VAT refund should credit urban maintenance tax payable separately'
      );
      assertEqual(
        voucher.lines.some((line) => line.side === '贷方' && line.subjectCode === '2221.06' && line.amount === 0.6),
        true,
        'VAT refund should credit education surcharge payable separately'
      );
      assertEqual(
        voucher.lines.some((line) => line.side === '贷方' && line.subjectCode === '2221.07' && line.amount === 0.4),
        true,
        'VAT refund should credit local education surcharge payable separately'
      );
    }
  },
  {
    name: 'blocks combined VAT cash vouchers when liability allocations are missing',
    run: () => {
      const sourceTransaction = financeTransactionRecords.find((record) => record.transactionNo === 'FIN-202604-0009');

      if (!sourceTransaction) {
        throw new Error('expected VAT payment transaction seed to exist');
      }

      const transaction = {
        ...sourceTransaction,
        id: 'vat-payment-without-allocation',
        taxPaymentAllocations: undefined,
        transactionNo: 'FIN-202604-ALLOCATION-MISSING'
      };
      const voucher = getVoucherBySourceNo(buildAccountingVouchersForTest([], [transaction]), transaction.transactionNo);

      assertEqual(voucher.status, '需处理', 'combined VAT payment without allocations should not be ready for booking');
      assertIncludes(
        voucher.issueReasons,
        'tax_payment_allocation_missing' satisfies AccountingVoucherIssueCode,
        'combined VAT payment should expose the missing allocation issue'
      );
    }
  },
  {
    name: 'VAT-06 prevents a later-period invoice from rewriting the original accrual voucher',
    run: () => {
      const sourceRecord = financeReceivablePayableRecords.find((record) => record.id === 'ar-202603-001');

      if (!sourceRecord) {
        throw new Error('missing prior unbilled receivable fixture');
      }

      const voucher = buildAccountingVoucherFromReceivablePayable(
        sourceRecord,
        0,
        financeInvoiceRecords,
        financeInvoiceBusinessAllocations
      );

      if (!voucher) {
        throw new Error('expected prior accrual voucher');
      }

      assertEqual(
        voucher.invoiceRefs.some((invoice) => invoice.accountingPeriod > sourceRecord.accountingPeriod),
        false,
        'a later invoice must be handled in its own period instead of rewriting the prior accrual'
      );
      assertEqual(voucher.taxBasis?.taxAmount, 0, 'the prior exempt unbilled accrual should retain its original VAT basis');
    }
  },
  {
    name: 'VAT-12 creates a balanced VAT adjustment when declaration and accounting source differ',
    run: () => {
      const sourceMatter = createTaxMatter();
      const taxMatter = createTaxMatter({
        id: 'vat-liability-mismatch',
        matterNo: 'TAX-VAT-LIABILITY-MISMATCH',
        vatSettlement: sourceMatter.vatSettlement
          ? { ...sourceMatter.vatSettlement, sourceRecognizedVatAmount: sourceMatter.vatSettlement.declaredVatAmount - 100 }
          : undefined
      });
      const voucher = buildAccountingVoucherFromTaxMatter(taxMatter, 0);

      if (!voucher) {
        throw new Error('expected VAT surcharge voucher to exist');
      }

      assertEqual(voucher.status, '待记账', 'a complete VAT declaration difference should create a reviewable adjustment voucher');
      assertEqual(
        voucher.lines.some((line) => line.subjectCode === '2221.01' && line.side === '贷方' && line.amount === 100),
        true,
        'additional declared VAT should credit VAT payable'
      );
      assertEqual(
        voucher.lines.some((line) => line.subjectCode === '5001' && line.side === '借方' && line.amount === 100),
        true,
        'additional declared VAT should reduce tax-inclusive operating revenue'
      );
    }
  },
  {
    name: 'keeps confirmed but unfinished tax matters waiting for generation',
    run: () => {
      const pendingTaxMatter = createTaxMatter({
        declarationDate: undefined,
        declarationReceiptFileId: undefined,
        declarationReceiptNo: undefined,
        declarationStatus: '待申报',
        files: [],
        id: 'tax-matter-pending-voucher',
        linkedTransactionNos: [],
        matterNo: 'TAX-PENDING-VOUCHER',
        processStatus: '待申报'
      });
      const vouchers = buildAccountingVouchersForTest([], [], [], [pendingTaxMatter]);
      const voucher = getVoucherBySourceNo(vouchers, pendingTaxMatter.matterNo);

      assertEqual(voucher.status, '待生成', 'unfinished tax matter should wait for completion');
      assertIncludes(
        voucher.issueReasons,
        'tax_matter_pending' satisfies AccountingVoucherIssueCode,
        'unfinished tax matter should expose pending issue'
      );
    }
  },
  {
    name: 'marks completed tax matters missing required receipts as issue',
    run: () => {
      const missingReceiptTaxMatter = createTaxMatter({
        declarationReceiptFileId: undefined,
        declarationReceiptNo: undefined,
        files: getTaxMatterByNo('TAX-2026Q1-VAT').files.filter((file) => file.type !== '申报回执'),
        id: 'tax-matter-missing-receipt-voucher',
        matterNo: 'TAX-MISSING-RECEIPT'
      });
      const vouchers = buildAccountingVouchersForTest([], [], [], [missingReceiptTaxMatter]);
      const voucher = getVoucherBySourceNo(vouchers, missingReceiptTaxMatter.matterNo);

      assertEqual(voucher.status, '需处理', 'completed tax matter missing required receipt should require handling');
      assertIncludes(
        voucher.issueReasons,
        'tax_receipt_missing' satisfies AccountingVoucherIssueCode,
        'missing receipt should be exposed as tax voucher issue'
      );
    }
  },
  {
    name: 'does not couple tax accrual booking to the later payment date',
    run: () => {
      const missingPaymentDateMatter = createTaxMatter({
        id: 'tax-matter-missing-payment-date',
        matterNo: 'TAX-MISSING-PAYMENT-DATE',
        paymentDate: undefined
      });
      const vouchers = buildAccountingVouchersForTest([], [], [], [missingPaymentDateMatter]);
      const voucher = getVoucherBySourceNo(vouchers, missingPaymentDateMatter.matterNo);

      assertEqual(voucher.status, '待记账', 'declared tax matter should be ready before the later cash payment');
      assertEqual(
        voucher.issueReasons.includes('tax_handling_date_missing' satisfies AccountingVoucherIssueCode),
        false,
        'cash payment date must not be an accrual-voucher prerequisite'
      );
    }
  },
  {
    name: 'CIT-15 creates a versioned difference voucher for a corrected tax declaration',
    run: () => {
      const original = getTaxMatterByNo('TAX-2026Q1-CIT');
      const revision = startTaxMatterDeclarationRevision(original, '更正', '补充纳税调整后更正申报');
      const corrected = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-04-18',
        declarationReceiptNo: 'CIT-Q1-REVISION-002',
        declarationStatus: '申报成功',
        settlementAmount: 100,
        settlementDirection: '应缴'
      });
      const voucher = buildAccountingVoucherFromTaxMatter(corrected, 0);

      if (!voucher) {
        throw new Error('expected corrected tax declaration to create a difference voucher');
      }

      assertEqual(voucher.id, `${original.id ? `voucher-tax-${original.id}` : ''}-v2`, 'corrected voucher should use an immutable versioned id');
      assertEqual(voucher.amount, 100, 'corrected voucher should contain only the declaration difference');
      assertEqual(getLineSubjectCode(voucher, '借方'), '5801', 'additional income tax should debit income tax expense');
      assertEqual(getLineSubjectCode(voucher, '贷方'), '2221.02', 'additional income tax should credit tax payable');
    }
  },
  {
    name: 'does not create amount voucher for zero-declaration tax matters',
    run: () => {
      const zeroDeclarationTaxMatter = createTaxMatter({
        declarationStatus: '零申报',
        id: 'tax-matter-zero-declaration-voucher',
        matterNo: 'TAX-ZERO-DECLARATION',
        paidAmount: 0,
        payableAmount: 0,
        paymentStatus: '无需缴纳'
      });
      const vouchers = buildAccountingVouchersForTest([], [], [], [zeroDeclarationTaxMatter]);

      assertEqual(
        vouchers.some((record) => record.sourceNo === zeroDeclarationTaxMatter.matterNo),
        false,
        'zero-declaration tax matter should not create amount voucher'
      );
    }
  },
  {
    name: 'applies booking lifecycle and derives ledger entries from booked vouchers',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords, financeTaxMatterRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const bookedLifecycleRows: AccountingVoucherLifecycleRecord[] = [
        createBookedLifecycleRow(readyVoucher, getNextAccountingVoucherNo([], readyVoucher.accountingPeriod))
      ];
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, bookedLifecycleRows);
      const bookedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const ledgerEntries = buildAccountingLedgerEntries(lifecycleAppliedRows);

      assertEqual(canBookAccountingVoucher(readyVoucher), true, 'ready voucher should be bookable');
      assertEqual(bookedVoucher.status, '已记账', 'booking lifecycle row should mark voucher as booked');
      assertEqual(bookedVoucher.voucherNo, '记-202606-001', 'booked voucher should keep the session voucher number');
      assertEqual(bookedVoucher.bookedBy, '李明', 'booked voucher should retain bookkeeper');
      assertEqual(bookedVoucher.bookedAt, '2026-06-27 17:10', 'booked voucher should retain booking time');
      assertEqual(canBookAccountingVoucher(bookedVoucher), false, 'booked voucher should not be bookable again');
      assertEqual(canReverseAccountingVoucher(bookedVoucher), true, 'booked voucher should be reversible while period is open');
      assertEqual(
        ledgerEntries.filter((entry) => entry.voucherId === bookedVoucher.id).length,
        bookedVoucher.lines.length,
        'ledger should contain one entry per booked voucher line'
      );
      assertEqual(
        ledgerEntries.some((entry) => entry.voucherNo === bookedVoucher.voucherNo && entry.subjectCode === '1122'),
        true,
        'ledger entries should retain the session voucher number and subject code'
      );
    }
  },
  {
    name: 'freezes session voucher snapshot after booking even when generated source changes',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const bookedLifecycleRows = [createBookedLifecycleRow(readyVoucher)];
      const changedGeneratedRows = vouchers.map((record) =>
        record.id === readyVoucher.id
          ? {
              ...record,
              amount: 1,
              sourceTitle: '来源已变化',
              summary: '来源已变化',
              lines: record.lines.map((line) => ({ ...line, amount: 1, summary: '来源已变化' }))
            }
          : record
      );
      const rowsAfterSourceChange = applyAccountingVoucherLifecycle(changedGeneratedRows, bookedLifecycleRows);
      const frozenVoucher = getVoucherBySourceNo(rowsAfterSourceChange, readyVoucher.sourceNo);
      const rowsAfterSourceRemoval = applyAccountingVoucherLifecycle(
        vouchers.filter((record) => record.id !== readyVoucher.id),
        bookedLifecycleRows
      );

      assertEqual(frozenVoucher.amount, readyVoucher.amount, 'session voucher snapshot should keep booked amount');
      assertEqual(frozenVoucher.sourceTitle, readyVoucher.sourceTitle, 'session voucher snapshot should keep booked source title');
      assertEqual(
        rowsAfterSourceRemoval.some((record) => record.id === readyVoucher.id && record.status === '已记账'),
        true,
        'session voucher snapshot should remain visible even if the source candidate disappears'
      );
    }
  },
  {
    name: 'blocks booking and reversal when accounting period is closed',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, [createBookedLifecycleRow(readyVoucher)]);
      const bookedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const reversedRows = applyAccountingVoucherLifecycle(vouchers, createReversedLifecycleRows(readyVoucher));
      const reversedVoucher = reversedRows.find((record) => record.sourceNo === readyVoucher.sourceNo && record.status === '已冲销');
      const lockedPeriods: AccountingPeriodLockRecord[] = [
        {
          accountingPeriod: readyVoucher.accountingPeriod,
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          reason: '月结',
          status: '已结账'
        }
      ];

      if (!reversedVoucher) {
        throw new Error('expected reversed voucher');
      }

      assertEqual(canBookAccountingVoucher(readyVoucher, lockedPeriods), false, 'closed period should block booking');
      assertEqual(canReverseAccountingVoucher(bookedVoucher, lockedPeriods), false, 'closed period should block reversal');
      assertEqual(isAccountingPeriodLocked(lockedPeriods, readyVoucher.accountingPeriod), true, 'closed lock should mark period locked');
      assertEqual(
        guardAccountingPeriodOpen(lockedPeriods, readyVoucher.accountingPeriod, '记账').reason,
        getAccountingPeriodClosedReason(readyVoucher.accountingPeriod, '记账'),
        'period guard should expose a user-facing closed-period reason'
      );
      assertEqual(
        guardAccountingPeriodOpen(lockedPeriods, '2026-07', '记账').allowed,
        true,
        'other open periods should remain mutable'
      );
      assertEqual(
        getAccountingVoucherPeriodLockNotice(readyVoucher, lockedPeriods),
        getAccountingPeriodClosedReason(readyVoucher.accountingPeriod, '记账'),
        'ready voucher should explain why booking is blocked by period close'
      );
      assertEqual(
        getAccountingVoucherPeriodLockNotice(bookedVoucher, lockedPeriods),
        `${bookedVoucher.accountingPeriod} 已结账，不能在原期间冲销；如需修正，请创建后续调整事项。`,
        'booked voucher should explain that historical reversal is replaced by later-period adjustment'
      );
      assertEqual(
        getAccountingVoucherPeriodLockNotice(reversedVoucher, lockedPeriods),
        getClosedAccountingPeriodReadbackNotice(reversedVoucher.accountingPeriod, '当前凭证'),
        'closed-period reversed voucher should be readback-only'
      );
      assertEqual(
        getAccountingVoucherPeriodLockNotice(readyVoucher, []),
        undefined,
        'open period should not show a period-lock notice'
      );
    }
  },
  {
    name: 'reopens a closed mock period without deleting the original close snapshot',
    run: () => {
      const closedLock: AccountingPeriodLockRecord = {
        accountingPeriod: '2026-07',
        closeCheckSnapshot: [
          {
            code: 'voucher_booking',
            detail: '已完成记账检查。',
            status: '通过',
            title: '凭证记账'
          }
        ],
        lockedAt: '2026-07-31 18:00',
        lockedBy: '李明',
        reason: '历史跳月结账',
        status: '已结账'
      };
      const reopenedRows = reopenAccountingPeriodLock([closedLock], '2026-07', {
        reason: '补齐前期结账顺序',
        reopenedAt: '2026-08-01 09:30',
        reopenedBy: '李明'
      });
      const reopenedLock = reopenedRows[0];

      assertEqual(reopenedLock?.status, '已反结账', 'reopen should release the closed period lock');
      assertEqual(reopenedLock?.reopenedBy, '李明', 'reopen should retain the repair operator');
      assertEqual(reopenedLock?.reopenedAt, '2026-08-01 09:30', 'reopen should retain the repair time');
      assertEqual(reopenedLock?.reopenReason, '补齐前期结账顺序', 'reopen should retain the repair reason');
      assertEqual(reopenedLock?.closeCheckSnapshot?.[0]?.title, '凭证记账', 'reopen should retain the original close snapshot');
      assertEqual(isAccountingPeriodLocked(reopenedRows, '2026-07'), false, 'reopened period should become open to the regular close workflow');
      assertEqual(reopenAccountingPeriodLock(reopenedRows, '2026-07', {
        reason: '重复修复',
        reopenedAt: '2026-08-01 10:00',
        reopenedBy: '王会计'
      })[0]?.reopenReason, '补齐前期结账顺序', 'already reopened record should not overwrite the repair audit');
    }
  },
  {
    name: 'keeps frontend period close lock idempotent and preserves the first close record',
    run: () => {
      const firstLock: AccountingPeriodLockRecord = {
        accountingPeriod: '2026-06',
        closeCheckSnapshot: [
          {
            code: 'general_ledger_trial_balance',
            detail: '首次结账试算平衡。',
            sourceSummary: '总账 / 2026-06',
            status: '通过',
            title: '总账试算'
          }
        ],
        closeSummarySnapshot: {
          blockedCheckCount: 0,
          bookedVoucherCount: 3,
          creditTotal: 1000,
          debitTotal: 1000,
          readyToBookVoucherCount: 0,
          generatedVoucherCount: 3,
          issueVoucherCount: 0,
          pendingVoucherCount: 0,
          pendingReviewCashFlowCount: 0,
          socialInsurancePendingCount: 0,
          taxHandlingPendingCount: 0,
          trialBalanceDifference: 0,
          trialBalanceStatus: '平衡',
          unbookedVoucherCount: 0,
          unreconciledCashFlowCount: 0,
          voucherCount: 3
        },
        lockedAt: '2026-06-30 18:00',
        lockedBy: '李明',
        reason: '6 月月结',
        status: '已结账'
      };
      const duplicateLock: AccountingPeriodLockRecord = {
        accountingPeriod: '2026-06',
        closeCheckSnapshot: [
          {
            code: 'general_ledger_trial_balance',
            detail: '重复结账试算结果。',
            sourceSummary: '总账 / 重复',
            status: '需处理',
            title: '总账试算'
          }
        ],
        closeSummarySnapshot: {
          blockedCheckCount: 1,
          bookedVoucherCount: 9,
          creditTotal: 2000,
          debitTotal: 1990,
          readyToBookVoucherCount: 0,
          generatedVoucherCount: 9,
          issueVoucherCount: 1,
          pendingVoucherCount: 0,
          pendingReviewCashFlowCount: 0,
          socialInsurancePendingCount: 0,
          taxHandlingPendingCount: 0,
          trialBalanceDifference: 10,
          trialBalanceStatus: '不平衡',
          unbookedVoucherCount: 0,
          unreconciledCashFlowCount: 0,
          voucherCount: 9
        },
        lockedAt: '2026-07-01 09:00',
        lockedBy: '王会计',
        reason: '重复确认',
        status: '已结账'
      };
      const reopenedLock: AccountingPeriodLockRecord = {
        accountingPeriod: '2026-05',
        lockedAt: '2026-05-31 18:00',
        lockedBy: '李明',
        reason: '已撤回',
        status: '已反结账'
      };
      const closedAfterReopen: AccountingPeriodLockRecord = {
        accountingPeriod: '2026-05',
        lockedAt: '2026-06-01 10:00',
        lockedBy: '王会计',
        reason: '重新结账',
        status: '已结账'
      };

      const rowsAfterFirstClose = applyAccountingPeriodCloseLock([], firstLock);
      const rowsAfterDuplicateClose = applyAccountingPeriodCloseLock(rowsAfterFirstClose, duplicateLock);
      const rowsAfterReclose = applyAccountingPeriodCloseLock([reopenedLock, ...rowsAfterDuplicateClose], closedAfterReopen);

      assertEqual(rowsAfterFirstClose.length, 1, 'first close should write one frontend lock');
      assertEqual(rowsAfterDuplicateClose.length, 1, 'duplicate close should not append another lock');
      assertEqual(rowsAfterDuplicateClose[0]?.lockedAt, '2026-06-30 18:00', 'duplicate close should preserve first close time');
      assertEqual(rowsAfterDuplicateClose[0]?.lockedBy, '李明', 'duplicate close should preserve first close actor');
      assertEqual(rowsAfterDuplicateClose[0]?.reason, '6 月月结', 'duplicate close should preserve first close reason');
      assertEqual(
        rowsAfterDuplicateClose[0]?.closeCheckSnapshot?.[0]?.detail,
        '首次结账试算平衡。',
        'duplicate close should preserve first close-check snapshot'
      );
      assertEqual(
        rowsAfterDuplicateClose[0]?.closeSummarySnapshot?.bookedVoucherCount,
        3,
        'duplicate close should preserve first close-summary snapshot'
      );
      assertEqual(rowsAfterReclose[0]?.accountingPeriod, '2026-05', 'reclosed period should be written at the front');
      assertEqual(rowsAfterReclose[0]?.status, '已结账', 'reclose after reopened state should write a closed lock');
      assertEqual(rowsAfterReclose[0]?.reason, '重新结账', 'reclose should replace a reopened status for the same period');
    }
  },
  {
    name: 'requires reversal date, same accounting period, and reason before reversal submission',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, [createBookedLifecycleRow(readyVoucher)]);
      const bookedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const validInput = {
        reason: '合同确认金额重复，按原凭证冲销后重新记账',
        reversedAt: getAccountingVoucherDefaultReversalDate(bookedVoucher)
      };
      const missingReasonInput = {
        ...validInput,
        reason: ' '
      };
      const crossPeriodInput = {
        ...validInput,
        reversedAt: '2026-07-01'
      };

      assertEqual(validateAccountingVoucherReversal(bookedVoucher, validInput).length, 0, 'valid reversal input should pass validation');
      assertEqual(canSubmitAccountingVoucherReversal(bookedVoucher, validInput), true, 'valid reversal input should be submittable');
      assertIncludes(
        validateAccountingVoucherReversal(bookedVoucher, missingReasonInput),
        '冲销原因必填',
        'reversal reason should be required'
      );
      assertIncludes(
        validateAccountingVoucherReversal(bookedVoucher, crossPeriodInput),
        '冲销日期必须落在原凭证归属月份',
        'reversal date should stay in the original voucher accounting period'
      );
      assertEqual(canSubmitAccountingVoucherReversal(bookedVoucher, missingReasonInput), false, 'blank reason should block reversal');
      assertEqual(canSubmitAccountingVoucherReversal(bookedVoucher, crossPeriodInput), false, 'cross-period date should block reversal');
    }
  },
  {
    name: 'creates later-period adjustment candidates for booked vouchers in closed periods',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, [createBookedLifecycleRow(readyVoucher)]);
      const bookedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const lockedPeriods: AccountingPeriodLockRecord[] = [
        {
          accountingPeriod: bookedVoucher.accountingPeriod,
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          reason: '月结',
          status: '已结账'
        }
      ];
      const input = {
        accountingPeriod: getDefaultLaterPeriodAdjustmentAccountingPeriod(bookedVoucher),
        adjustedAt: '2026-07-01',
        reason: '历史期间收入确认口径需要在后续期间调整'
      };

      assertEqual(canReverseAccountingVoucher(bookedVoucher, lockedPeriods), false, 'closed period should keep same-period reversal blocked');
      assertEqual(
        canCreateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, lockedPeriods),
        true,
        'closed booked voucher should allow later-period adjustment entry'
      );
      assertEqual(
        validateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, input, lockedPeriods).length,
        0,
        'valid later-period adjustment input should pass'
      );
      assertEqual(
        canSubmitLaterPeriodAccountingVoucherAdjustment(bookedVoucher, input, lockedPeriods),
        true,
        'valid later-period adjustment input should be submittable'
      );

      const sourceRecord = createLaterPeriodAccountingVoucherAdjustmentRecord({
        actor: '李明',
        existingRows: [],
        input,
        originalRecord: bookedVoucher
      });
      const previewVoucher = buildAccountingVoucherFromLaterPeriodAdjustment(sourceRecord, 0)!;
      const generatedRows = buildAccountingVouchersForTest([], [], [], [], [], [], [sourceRecord]);
      const generatedVoucher = getVoucherBySourceNo(generatedRows, sourceRecord.adjustmentNo);
      const targetVoucherNo = getNextAccountingVoucherNo([], generatedVoucher.accountingPeriod);
      const bookedRows = applyAccountingVoucherLifecycle(generatedRows, [
        createBookedLifecycleRow(generatedVoucher, targetVoucherNo)
      ]);
      const bookedAdjustmentVoucher = getVoucherBySourceNo(bookedRows, sourceRecord.adjustmentNo);
      const adjustmentLedgerEntries = buildAccountingLedgerEntries(bookedRows);

      assertEqual(sourceRecord.candidateStatus, '待记账', 'later-period adjustment source should start as pending booking');
      assertEqual(previewVoucher.accountingPeriod, '2026-07', 'preview adjustment voucher should use target adjustment period');
      assertEqual(generatedVoucher.accountingPeriod, '2026-07', 'generated adjustment voucher should use target adjustment period');
      assertEqual(generatedVoucher.sourceType, '后续调整', 'generated adjustment voucher should retain later-adjustment source type');
      assertEqual(generatedVoucher.businessType, '调整凭证', 'later-period correction should create adjustment voucher candidate');
      assertEqual(generatedVoucher.status, '待记账', 'later-period adjustment should still require session booking');
      assertEqual(
        generatedVoucher.sourceRefs.some((sourceRef) => sourceRef.role === '调整依据' && sourceRef.recordNo === bookedVoucher.voucherNo),
        true,
        'later-period adjustment should reference original booked voucher as adjustment basis'
      );
      assertEqual(
        generatedVoucher.lines[0]?.side,
        bookedVoucher.lines[0]?.side === '借方' ? '贷方' : '借方',
        'later-period adjustment should create opposite entries from original voucher'
      );
      assertEqual(
        buildAccountingLedgerEntries(generatedRows).length,
        0,
        'pending later-period adjustment candidate should not write ledger entries'
      );
      assertEqual(bookedAdjustmentVoucher.status, '已记账', 'booked later-period adjustment should become a posted voucher');
      assertEqual(
        adjustmentLedgerEntries.every((entry) => entry.accountingPeriod === '2026-07'),
        true,
        'posted later-period adjustment should write ledger entries only in target period'
      );
      assertEqual(
        adjustmentLedgerEntries.some((entry) => entry.accountingPeriod === bookedVoucher.accountingPeriod),
        false,
        'posted later-period adjustment should not mutate historical-period ledger entries'
      );
      assertEqual(bookedVoucher.status, '已记账', 'original booked voucher should remain booked after later-period adjustment creation');
    }
  },
  {
    name: 'blocks later-period adjustment when original period is open or target period is invalid',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, [createBookedLifecycleRow(readyVoucher)]);
      const bookedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const closedOriginalPeriod: AccountingPeriodLockRecord[] = [
        {
          accountingPeriod: bookedVoucher.accountingPeriod,
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          reason: '月结',
          status: '已结账'
        }
      ];
      const closedOriginalAndTargetPeriods: AccountingPeriodLockRecord[] = [
        ...closedOriginalPeriod,
        {
          accountingPeriod: '2026-07',
          lockedAt: '2026-07-31 18:00',
          lockedBy: '李明',
          reason: '月结',
          status: '已结账'
        }
      ];
      const baseInput = {
        accountingPeriod: '2026-07',
        adjustedAt: '2026-07-01',
        reason: '历史期间错误改由后续期间调整'
      };

      assertEqual(
        canCreateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, []),
        false,
        'open original period should not use later-period adjustment'
      );
      assertEqual(
        canCreateLaterPeriodAccountingVoucherAdjustment(readyVoucher, closedOriginalPeriod),
        false,
        'unbooked voucher should not expose later-period adjustment entry'
      );
      assertIncludes(
        validateLaterPeriodAccountingVoucherAdjustment(readyVoucher, baseInput, closedOriginalPeriod),
        '仅已记账且非冲销凭证可以创建后续调整事项',
        'unbooked voucher should be rejected as later-period adjustment source'
      );
      assertIncludes(
        validateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, baseInput, []),
        '原凭证期间尚未结账，请使用冲销处理',
        'open original period should guide users back to reversal'
      );
      assertIncludes(
        validateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, {
          ...baseInput,
          accountingPeriod: bookedVoucher.accountingPeriod,
          adjustedAt: `${bookedVoucher.accountingPeriod}-15`
        }, closedOriginalPeriod),
        '调整期间必须晚于原凭证归属月份',
        'target period should be later than original period'
      );
      assertIncludes(
        validateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, baseInput, closedOriginalAndTargetPeriods),
        '调整期间已结账，不能创建后续调整事项',
        'closed target period should block later-period adjustment'
      );
      assertEqual(
        canSubmitLaterPeriodAccountingVoucherAdjustment(bookedVoucher, baseInput, closedOriginalAndTargetPeriods),
        false,
        'closed target period should not be submittable'
      );
    }
  },
  {
    name: 'blocks duplicate later-period adjustment for the same original voucher and target period',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, [createBookedLifecycleRow(readyVoucher)]);
      const bookedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const lockedPeriods: AccountingPeriodLockRecord[] = [
        {
          accountingPeriod: bookedVoucher.accountingPeriod,
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          reason: '月结',
          status: '已结账'
        }
      ];
      const input = {
        accountingPeriod: '2026-07',
        adjustedAt: '2026-07-01',
        reason: '历史期间收入确认口径需要在后续期间调整'
      };
      const existingAdjustment = createLaterPeriodAccountingVoucherAdjustmentRecord({
        actor: '李明',
        existingRows: [],
        input,
        originalRecord: bookedVoucher
      });
      const duplicateIssues = validateLaterPeriodAccountingVoucherAdjustment(
        bookedVoucher,
        input,
        lockedPeriods,
        [existingAdjustment]
      );

      assertIncludes(
        duplicateIssues,
        `该原凭证在 ${input.accountingPeriod} 已有后续调整事项 ${existingAdjustment.adjustmentNo}`,
        'duplicate later-period adjustment should explain the existing adjustment number'
      );
      assertEqual(
        canSubmitLaterPeriodAccountingVoucherAdjustment(bookedVoucher, input, lockedPeriods, [existingAdjustment]),
        false,
        'duplicate later-period adjustment should not be submittable'
      );
      assertEqual(
        canCreateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, lockedPeriods, input.accountingPeriod, [existingAdjustment]),
        false,
        'duplicate later-period adjustment should not expose a create entry'
      );
      assertEqual(
        canCreateLaterPeriodAccountingVoucherAdjustment(bookedVoucher, lockedPeriods, '2026-08', [existingAdjustment]),
        true,
        'a later adjustment for another open target period should still expose a create entry'
      );
      assertEqual(
        getAvailableLaterPeriodAdjustmentAccountingPeriod(bookedVoucher, lockedPeriods, [existingAdjustment]),
        '2026-08',
        'entry defaults should skip an occupied target period and use the next open period'
      );
      assertEqual(
        canSubmitLaterPeriodAccountingVoucherAdjustment(bookedVoucher, {
          ...input,
          accountingPeriod: '2026-08',
          adjustedAt: '2026-08-01'
        }, lockedPeriods, [existingAdjustment]),
        true,
        'a later adjustment for another open target period should remain submittable'
      );
      assertEqual(
        getAvailableLaterPeriodAdjustmentAccountingPeriod(
          bookedVoucher,
          lockedPeriods,
          Array.from({ length: 12 }, (_, index) => {
            const accountingPeriod = `${2026 + Math.floor((6 + index) / 12)}-${String(((6 + index) % 12) + 1).padStart(2, '0')}`;

            return createLaterPeriodAccountingVoucherAdjustmentRecord({
              actor: '李明',
              existingRows: [],
              input: {
                accountingPeriod,
                adjustedAt: `${accountingPeriod}-01`,
                reason: '历史期间收入确认口径需要在后续期间调整'
              },
              originalRecord: bookedVoucher
            });
          })
        ),
        undefined,
        'entry defaults should stop when no open target period is available in the lookahead window'
      );
    }
  },
  {
    name: 'keeps reversed original ledger entries and creates an offsetting reversal voucher',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const generatedVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, createReversedLifecycleRows(generatedVoucher));
      const reversedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, generatedVoucher.sourceNo);
      const reversalVoucher = lifecycleAppliedRows.find((record) => record.reversalOfVoucherId === generatedVoucher.id);
      const ledgerEntries = buildAccountingLedgerEntries(lifecycleAppliedRows);

      assertEqual(reversedVoucher.status, '已冲销', 'reversed lifecycle should mark voucher as reversed');
      assertEqual(reversalVoucher?.businessType, '冲销凭证', 'reversal should create a separate reversal voucher');
      assertEqual(reversalVoucher?.status, '已记账', 'reversal voucher should be booked immediately in the frontend-session lifecycle');
      assertEqual(canReverseAccountingVoucher(reversalVoucher!), false, 'reversal voucher should not be reversible again');
      assertEqual(
        canCreateLaterPeriodAccountingVoucherAdjustment(reversalVoucher!, [
          {
            accountingPeriod: reversalVoucher!.accountingPeriod,
            lockedAt: '2026-06-30 18:00',
            lockedBy: '李明',
            reason: '月结',
            status: '已结账'
          }
        ]),
        false,
        'reversal voucher should not expose later-period adjustment entry'
      );
      assertEqual(
        ledgerEntries.filter((entry) => entry.voucherId === reversedVoucher.id).length,
        reversedVoucher.lines.length,
        'reversed original should retain its historical ledger entries'
      );
      assertEqual(
        ledgerEntries.filter((entry) => entry.voucherId === reversalVoucher?.id).length,
        reversalVoucher?.lines.length ?? 0,
        'reversal voucher should create offsetting ledger entries'
      );
    }
  },
  {
    name: 'allows accrual preparation without inventing VAT when the declaration-period outcome is pending',
    run: () => {
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const partialInvoiceVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-002');
      const missingInvoiceVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-003');
      const partialTaxLine = partialInvoiceVoucher.lines.find((line) => line.subjectCode === '2221.01');
      const missingInvoiceTaxLine = missingInvoiceVoucher.lines.find((line) => line.subjectCode === '2221.01');

      assertEqual(partialInvoiceVoucher.status, '待记账', 'partially invoiced receivable should be ready when source tax basis is complete');
      assertEqual(partialInvoiceVoucher.issueReasons.length, 0, 'partial invoice evidence should remain a reminder instead of blocking preparation');
      assertEqual(partialInvoiceVoucher.taxBasis?.basisSource, '来源单据', 'partial invoice should fall back to source tax basis');
      assertEqual(partialInvoiceVoucher.taxBasis?.evidenceStatus, '发票部分匹配', 'partial invoice should stay visible as evidence status');
      assertEqual(partialTaxLine, undefined, 'partial invoice should not infer VAT for unmatched revenue before declaration preparation');
      assertEqual(missingInvoiceVoucher.status, '待记账', 'receivable without invoice should be ready when source tax basis is complete');
      assertEqual(missingInvoiceVoucher.issueReasons.length, 0, 'missing invoice evidence should remain visible without blocking preparation');
      assertEqual(missingInvoiceVoucher.invoiceRefs.length, 0, 'missing invoice receivable should not invent invoice references');
      assertEqual(missingInvoiceVoucher.taxBasis?.evidenceStatus, '发票待补', 'missing invoice should stay visible as evidence status');
      assertEqual(missingInvoiceTaxLine, undefined, 'missing invoice should not infer a global VAT amount');
    }
  },
  {
    name: 'keeps confirmed receivable upstream when tax basis is unavailable',
    run: () => {
      const missingTaxBasisRecord = createReceivableWithPendingTaxBasis();
      const vouchers = buildAccountingVouchersForTest([missingTaxBasisRecord], [], []);

      assertEqual(
        vouchers.some((record) => record.sourceNo === missingTaxBasisRecord.documentNo),
        false,
        'receivable without tax basis should stay out of the accounting voucher workbench'
      );
    }
  },
  {
    name: 'VAT-07A blocks a red invoice that has no original blue-invoice relationship',
    run: () => {
      const vouchers = buildAccountingVouchersForTest([], [], financeInvoiceRecords);
      const redInvoiceVoucher = getVoucherBySourceNo(vouchers, '254420000000610004');

      assertEqual(redInvoiceVoucher.businessType, '调整凭证', 'unresolved red invoice should be treated as adjustment handling row');
      assertEqual(redInvoiceVoucher.sourceModule, '发票台账', 'unresolved red invoice source should stay in invoice ledger');
      assertEqual(redInvoiceVoucher.status, '需处理', 'red invoice without original invoice should require handling');
      assertIncludes(redInvoiceVoucher.issueReasons, 'reversal_required' satisfies AccountingVoucherIssueCode, 'red invoice should require reversal relation');
    }
  },
  {
    name: 'VAT-07B builds a ready-to-book adjustment voucher from linked red-invoice allocations',
    run: () => {
      const originalInvoice = financeInvoiceRecords.find((invoice) => invoice.id === 'invoice-out-202606-009');
      const redInvoice = financeInvoiceRecords.find((invoice) => invoice.id === 'invoice-out-202606-004');

      if (!originalInvoice || !redInvoice) {
        throw new Error('expected red invoice and its original blue invoice in seed data');
      }

      const originalAllocations = financeInvoiceBusinessAllocations.filter((allocation) => allocation.invoiceId === originalInvoice.id);
      const linkedRedInvoice: FinanceInvoiceRecord = { ...redInvoice, originalInvoiceId: originalInvoice.id };
      const redAllocations = buildRedInvoiceBusinessAllocations(linkedRedInvoice, originalInvoice, originalAllocations, {
        actor: '李明',
        occurredAt: '2026-06-20 18:20',
        sequence: 2
      });
      const vouchers = buildAccountingVouchersForTest(
        financeReceivablePayableRecords,
        financeTransactionRecords,
        [originalInvoice, linkedRedInvoice],
        [],
        undefined,
        [],
        [],
        { invoiceBusinessAllocationRows: [...originalAllocations, ...redAllocations] }
      );
      const redInvoiceVoucher = getVoucherBySourceNo(vouchers, linkedRedInvoice.invoiceNo);

      assertEqual(redInvoiceVoucher.businessType, '调整凭证', 'linked red invoice should remain an adjustment voucher');
      assertEqual(redInvoiceVoucher.status, '待记账', 'linked red invoice should be ready to book');
      assertEqual(getAccountingVoucherDebitTotal(redInvoiceVoucher), 1200, 'red invoice debit should equal its allocated gross amount');
      assertEqual(getAccountingVoucherCreditTotal(redInvoiceVoucher), 1200, 'red invoice credit should equal its allocated gross amount');
      assertEqual(getLineBySide(redInvoiceVoucher, '借方').amount, 1200, 'red invoice should reverse the revenue line');
      assertEqual(getLineBySide(redInvoiceVoucher, '贷方').amount, 1200, 'red invoice should reverse the receivable line');
    }
  },
  {
    name: 'marks reviewed cash voucher as issue when original evidence is missing',
    run: () => {
      const missingEvidenceTransaction = createMissingEvidenceTransaction();
      const vouchers = buildAccountingVouchersForTest([], [missingEvidenceTransaction]);
      const voucher = getVoucherBySourceNo(vouchers, missingEvidenceTransaction.transactionNo);
      const metrics = buildAccountingVoucherMetrics(vouchers);

      assertEqual(voucher.status, '需处理', 'reviewed cash-flow without evidence should require handling');
      assertIncludes(voucher.issueReasons, 'missing_original_evidence' satisfies AccountingVoucherIssueCode, 'missing evidence should be exposed as issue reason');
      assertEqual(getAccountingVoucherIssueSummary(voucher), '缺少原始凭证', 'issue summary should use business copy');
      assertEqual(metrics.issueCount, 1, 'metrics should count issue voucher');
      assertEqual(metrics.readyToBookCount, 0, 'issue voucher should not be counted as ready to book');
    }
  },
  {
    name: 'keeps confirmed receivable-payable rows upstream when accounting subject is missing',
    run: () => {
      const missingSubjectRecord = createMissingSubjectPayable();
      const vouchers = buildAccountingVouchersForTest([missingSubjectRecord], []);

      assertEqual(
        vouchers.some((record) => record.sourceNo === missingSubjectRecord.documentNo),
        false,
        'payable without subject mapping should stay out of the accounting voucher workbench'
      );
    }
  },
  {
    name: 'ST-13 builds stamp duty accrual with tax and surcharge expense and dedicated liability',
    run: () => {
      const seed = financeTaxMatterRecords.find((record) => record.matterType === '印花税');

      if (!seed) {
        throw new Error('expected stamp duty tax matter seed');
      }

      const record: FinanceTaxMatterRecord = {
        ...seed,
        dataStatus: '已确认',
        declarationDate: '2026-07-10',
        declarationStatus: '申报成功',
        payableAmount: 14.26,
        processStatus: '已完成',
        sourceItems: seed.sourceItems.map((item) => ({ ...item, status: '已确认' }))
      };
      const voucher = buildAccountingVoucherFromTaxMatter(record, 0);

      if (!voucher) {
        throw new Error('expected stamp duty accrual voucher');
      }

      assertEqual(voucher.lines[0]?.subjectCode, '5403', 'stamp duty debit subject');
      assertEqual(voucher.lines[1]?.subjectCode, '2221.05', 'stamp duty credit subject');
      assertEqual(voucher.amount, 14.26, 'stamp duty voucher amount');
    }
  },
  {
    name: 'ST-16 builds only the stamp-duty correction difference without overwriting the original accrual',
    run: () => {
      const seed = financeTaxMatterRecords.find((record) => record.matterType === '印花税');

      if (!seed) {
        throw new Error('expected stamp duty tax matter seed');
      }

      const original: FinanceTaxMatterRecord = {
        ...seed,
        dataStatus: '已确认',
        declarationDate: '2026-07-10',
        declarationReceiptNo: 'STAMP-ORIGINAL-001',
        declarationStatus: '申报成功',
        filedAccountingAmount: 10,
        paidAmount: 10,
        payableAmount: 10,
        paymentStatus: '已缴纳',
        preparedPayableAmount: 10,
        processStatus: '已完成',
        settlementDirection: '应缴',
        sourceItems: seed.sourceItems.map((item) => ({ ...item, status: '已确认' }))
      };
      const revision = startTaxMatterDeclarationRevision(original, '更正', '补充协议调减计税依据');
      const corrected = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-08-08',
        declarationReceiptNo: 'STAMP-REVISION-002',
        declarationStatus: '申报成功',
        differenceReason: '补充协议调减后应退 2 元',
        settlementAmount: 2,
        settlementDirection: '应退'
      });
      const voucher = buildAccountingVoucherFromTaxMatter(corrected, 0);

      if (!voucher) {
        throw new Error('expected stamp duty correction voucher');
      }

      assertEqual(voucher.amount, 2, 'correction voucher contains only the difference');
      assertEqual(voucher.lines[0]?.subjectCode, '5403', 'correction reverses tax and surcharge expense');
      assertEqual(voucher.lines[0]?.side, '贷方', 'expense correction direction');
      assertEqual(voucher.lines[1]?.subjectCode, '2221.05', 'correction reverses stamp duty liability');
      assertEqual(voucher.lines[1]?.side, '借方', 'liability correction direction');
    }
  },
  {
    name: 'ST-17 posts reviewed stamp-duty payment against the dedicated liability and bank account',
    run: () => {
      const seed = financeTaxMatterRecords.find((record) => record.matterType === '印花税');

      if (!seed) {
        throw new Error('expected stamp duty tax matter seed');
      }

      const filed: FinanceTaxMatterRecord = {
        ...seed,
        dataStatus: '已确认',
        declarationStatus: '申报成功',
        filedAccountingAmount: 10,
        payableAmount: 10,
        paymentStatus: '待缴纳',
        preparedPayableAmount: 10,
        processStatus: '待缴款',
        settlementDirection: '应缴',
        sourceItems: seed.sourceItems.map((item) => ({ ...item, status: '已确认' }))
      };
      const paid = recordTaxMatterPaymentResult(filed, {
        amount: 10,
        paymentDate: '2026-07-12',
        receiptFile: {
          id: 'stamp-payment-receipt-accounting',
          name: '印花税缴款回单.pdf',
          status: '已上传',
          type: '缴款回单',
          updatedAt: '2026-07-12'
        }
      });
      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: financeTransactionRecords,
        publicAccountRef: getFinanceSeedPublicAccountRef(),
        record: paid
      });

      if (!transaction) {
        throw new Error('expected stamp duty payment transaction');
      }

      const voucher = buildAccountingVoucherFromTransaction({ ...transaction, status: '已入账' }, 0);

      if (!voucher) {
        throw new Error('expected stamp duty payment voucher');
      }

      assertEqual(voucher.lines[0]?.subjectCode, '2221.05', 'payment debits stamp duty liability');
      assertEqual(voucher.lines[1]?.subjectCode, '1002', 'payment credits bank deposit');
      assertEqual(voucher.amount, 10, 'payment voucher amount');
    }
  },
  {
    name: 'filters vouchers by business type, status, date scope, and keyword',
    run: () => {
      const missingEvidenceTransaction = createMissingEvidenceTransaction();
      const vouchers = buildAccountingVouchersForTest(financeReceivablePayableRecords, [missingEvidenceTransaction, ...financeTransactionRecords], financeInvoiceRecords);
      const currentMonthBusinessRows = vouchers.filter((record) =>
        matchesAccountingVoucherFilters(record, {
          ...defaultAccountingVoucherFilters,
          businessType: '权责凭证',
          keyword: ''
        })
      );
      const issueRows = vouchers.filter((record) =>
        matchesAccountingVoucherFilters(record, {
          ...defaultAccountingVoucherFilters,
          businessType: '全部',
          keyword: '缺少原始凭证',
          status: '需处理',
          accountingPeriodTime: { mode: 'all' }
        })
      );
      const keywordRows = vouchers.filter((record) =>
        matchesAccountingVoucherFilters(record, {
          ...defaultAccountingVoucherFilters,
          businessType: '全部',
          keyword: 'FIN-202606-0001'
        })
      );

      assertEqual(
        currentMonthBusinessRows.every((record) => record.businessType === '权责凭证' && record.accountingPeriod === '2026-06'),
        true,
        'source and current accounting-period filters should both apply'
      );
      assertEqual(issueRows.length, 1, 'status and issue keyword should find the issue voucher');
      assertEqual(issueRows[0]?.sourceNo, missingEvidenceTransaction.transactionNo, 'issue status filter should return the cash-flow issue voucher');
      assertEqual(keywordRows.length, 1, 'keyword should find the matching cash settlement voucher');
      assertEqual(keywordRows[0]?.sourceNo, 'FIN-202606-0001', 'keyword match should return the requested cash-flow source');
    }
  }
];

export function runFinanceAccountingVoucherModelTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];

  tests.forEach((test) => {
    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed: tests.length - failures.length,
    passedTestNames,
    total: tests.length
  };
}
