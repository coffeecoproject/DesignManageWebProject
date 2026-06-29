import { financeTransactionRecords, type FinanceTransactionRecord } from './financeData';
import { financeInvoiceRecords } from './financeInvoiceData';
import { financeReceivablePayableRecords, type FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { financeTaxMatterRecords, type FinanceTaxMatterRecord } from './financeTaxFilingData';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVoucherMetrics,
  buildAccountingVouchers,
  canPrepareAccountingVoucher,
  canPostAccountingVoucher,
  canReverseAccountingVoucher,
  defaultAccountingVoucherFilters,
  getNextAccountingVoucherFormalNo,
  getAccountingVoucherCreditTotal,
  getAccountingVoucherDebitTotal,
  getAccountingVoucherIssueSummary,
  isAccountingVoucherBalanced,
  matchesAccountingVoucherFilters,
  type AccountingPeriodLockRecord,
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

function getTaxMatterByNo(matterNo: string) {
  const record = financeTaxMatterRecords.find((taxMatterRecord) => taxMatterRecord.matterNo === matterNo);

  if (!record) {
    throw new Error(`expected tax matter ${matterNo}`);
  }

  return record;
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
    name: 'builds balanced statusized vouchers from business confirmations, reviewed cash flows, and invoice facts',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const metrics = buildAccountingVoucherMetrics(vouchers);
      const reviewedNonAdjustmentRows = financeTransactionRecords.filter(
        (record) => record.status === '已入账' && record.sourceType !== '流水冲正' && record.sourceType !== '流水补差'
      );
      const unresolvedRedInvoices = financeInvoiceRecords.filter((invoice) => invoice.invoiceColor === '红票' && !invoice.originalInvoiceId);

      assertEqual(vouchers.every(isAccountingVoucherBalanced), true, 'every derived voucher row should balance');
      assertEqual(metrics.totalCount, vouchers.length, 'metrics should count all voucher rows');
      assertEqual(metrics.balancedCount, vouchers.length, 'metrics should count every derived voucher row as balanced');
      assertEqual(metrics.readyToPrepareCount > 0, true, 'complete rows should be ready to prepare');
      assertEqual(metrics.issueCount > 0, true, 'invoice-incomplete rows should create issue vouchers');
      assertEqual(metrics.pendingGenerationCount > 0, true, 'bank-unreconciled rows should wait for generation');
      assertEqual(
        metrics.readyToPrepareCount + metrics.issueCount + metrics.pendingGenerationCount,
        vouchers.length,
        'current frontend rows should be ready, waiting, or require handling'
      );
      assertEqual(metrics.preparedCount, 0, 'frontend derived rows are not formal prepared vouchers');
      assertEqual(metrics.postedCount, 0, 'frontend derived rows are not posted vouchers');
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
      const vouchers = buildAccountingVouchers([pendingRecord, ...financeReceivablePayableRecords], financeTransactionRecords, financeInvoiceRecords);

      assertEqual(
        vouchers.some((record) => record.sourceNo === pendingRecord.documentNo),
        false,
        'pending confirmation row should not create business confirmation voucher'
      );
    }
  },
  {
    name: 'creates issued receivable entries with receivable debit, revenue credit, and tax credit',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const voucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const taxLine = getLineBySubjectCode(voucher, '2221.01');

      assertEqual(voucher.sourceType, '业务确认', 'receivable/payable source should be business confirmation');
      assertEqual(voucher.businessType, '权责凭证', 'receivable/payable confirmation should create accrual voucher');
      assertEqual(voucher.kind, '转账凭证', 'business confirmation should use transfer voucher');
      assertEqual(voucher.status, '待制单', 'fully invoiced receivable should be ready to prepare');
      assertEqual(voucher.invoiceRefs.length, 1, 'fully invoiced receivable should retain invoice reference');
      assertEqual(getLineSubjectCode(voucher, '借方'), '1122', 'receivable confirmation debit should post to accounts receivable');
      assertEqual(getLineSubjectCode(voucher, '贷方'), '6001', 'contract receivable confirmation credit should post to main business revenue');
      assertEqual(taxLine.amount, 673.27, 'issued receivable should split output tax from invoice tax amount');
      assertEqual(getAccountingVoucherDebitTotal(voucher), 68000, 'receivable confirmation debit amount should match source amount');
      assertEqual(getAccountingVoucherCreditTotal(voucher), 68000, 'receivable confirmation credit amount should match source amount');
    }
  },
  {
    name: 'creates payable confirmation entries with expense debit and liability credit',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const salaryVoucher = getVoucherBySourceNo(vouchers, 'AP-202606-002');
      const outsourceVoucher = getVoucherBySourceNo(vouchers, 'AP-202606-003');
      const reimbursementVoucher = getVoucherBySourceNo(vouchers, 'AP-202605-018');

      assertEqual(getLineSubjectCode(salaryVoucher, '借方'), '6602.01', 'salary payable confirmation should debit payroll expense detail subject');
      assertEqual(getLineSubjectCode(salaryVoucher, '贷方'), '2211.01', 'salary payable confirmation should credit salary payable detail subject');
      assertEqual(getLineSubjectCode(outsourceVoucher, '借方'), '6401', 'outsourcing payable confirmation should debit main business cost');
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
    name: 'creates cash settlement entries only after transaction review and bank reconciliation',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const cashReceiptVoucher = getVoucherBySourceNo(vouchers, 'FIN-202606-0001');
      const salaryPaymentVoucher = getVoucherBySourceNo(vouchers, 'FIN-202606-0003');
      const pendingReviewVoucher = vouchers.find((record) => record.sourceNo === 'FIN-202606-0004');

      assertEqual(cashReceiptVoucher.sourceType, '收付款', 'cash-flow source should be cash settlement');
      assertEqual(cashReceiptVoucher.businessType, '资金凭证', 'ordinary reviewed transaction should create cash voucher');
      assertEqual(cashReceiptVoucher.status, '待制单', 'reviewed and bank-reconciled transaction should be ready to prepare');
      assertEqual(cashReceiptVoucher.kind, '收款凭证', 'income cash-flow should use receipt voucher');
      assertEqual(getLineSubjectCode(cashReceiptVoucher, '借方'), '1002', 'cash receipt should debit bank deposit');
      assertEqual(getLineSubjectCode(cashReceiptVoucher, '贷方'), '1122', 'cash receipt should credit accounts receivable');
      assertEqual(salaryPaymentVoucher.status, '待生成', 'reviewed but unreconciled salary payment should wait for bank reconciliation');
      assertIncludes(
        salaryPaymentVoucher.issueReasons,
        'bank_reconciliation_pending' satisfies AccountingVoucherIssueCode,
        'unreconciled salary payment should expose bank reconciliation prerequisite'
      );
      assertEqual(salaryPaymentVoucher.kind, '付款凭证', 'expense cash-flow should use payment voucher');
      assertEqual(getLineSubjectCode(salaryPaymentVoucher, '借方'), '2211.01', 'salary payment should debit salary payable detail subject');
      assertEqual(getLineSubjectCode(salaryPaymentVoucher, '贷方'), '1002', 'salary payment should credit bank deposit');
      assertEqual(pendingReviewVoucher, undefined, 'pending-review cash-flow should not create accounting voucher');
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
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, [
        reviewedAdjustment,
        pendingAdjustment,
        unreconciledAdjustment,
        ...financeTransactionRecords
      ], financeInvoiceRecords);
      const adjustmentVoucher = getVoucherBySourceNo(vouchers, reviewedAdjustment.transactionNo);
      const pendingVoucher = vouchers.find((record) => record.sourceNo === pendingAdjustment.transactionNo);
      const unreconciledVoucher = getVoucherBySourceNo(vouchers, unreconciledAdjustment.transactionNo);

      assertEqual(adjustmentVoucher.businessType, '调整凭证', 'reviewed adjustment should create adjustment voucher');
      assertEqual(adjustmentVoucher.summary.includes('补差入账'), true, 'adjustment voucher summary should preserve adjustment mode');
      assertEqual(adjustmentVoucher.status, '待制单', 'reviewed and bank-reconciled adjustment with evidence should be ready to prepare');
      assertEqual(unreconciledVoucher.status, '待生成', 'reviewed adjustment should wait until bank reconciliation is complete');
      assertIncludes(
        unreconciledVoucher.issueReasons,
        'bank_reconciliation_pending' satisfies AccountingVoucherIssueCode,
        'unreconciled adjustment should expose bank reconciliation prerequisite'
      );
      assertEqual(pendingVoucher, undefined, 'pending adjustment should not create accounting voucher');
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
      const vouchers = buildAccountingVouchers([], [abnormalTransaction]);
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
    name: 'creates tax accrual vouchers from completed tax matters without duplicating payment cash facts',
    run: () => {
      const vouchers = buildAccountingVouchers([], financeTransactionRecords, [], financeTaxMatterRecords);
      const vatVoucher = getVoucherBySourceNo(vouchers, 'TAX-2026Q1-VAT');
      const citVoucher = getVoucherBySourceNo(vouchers, 'TAX-2026Q1-CIT');
      const vatCashVoucher = getVoucherBySourceNo(vouchers, 'FIN-202604-0009');

      assertEqual(vatVoucher.businessType, '税费凭证', 'completed tax matter should create tax voucher');
      assertEqual(vatVoucher.sourceType, '税费事项', 'tax voucher should retain tax matter source type');
      assertEqual(vatVoucher.status, '待制单', 'completed tax matter with receipts should be ready to prepare');
      assertEqual(getLineSubjectCode(vatVoucher, '借方'), '6403', 'VAT surcharge tax matter should debit taxes and surcharges');
      assertEqual(getLineSubjectCode(vatVoucher, '贷方'), '2221.01', 'VAT tax matter should credit VAT payable detail subject');
      assertEqual(
        vatVoucher.sourceRefs.some((sourceRef) => sourceRef.recordNo === 'FIN-202604-0009' && sourceRef.role === '缴款依据'),
        true,
        'tax voucher should retain linked payment cash-flow as payment basis'
      );
      assertEqual(citVoucher.businessType, '税费凭证', 'enterprise income tax should create tax voucher');
      assertEqual(getLineSubjectCode(citVoucher, '借方'), '6801', 'enterprise income tax should debit income tax expense');
      assertEqual(vatCashVoucher.businessType, '资金凭证', 'linked tax payment cash-flow should remain cash voucher');
      assertEqual(vatCashVoucher.status, '待制单', 'reviewed and reconciled tax payment cash-flow should remain ready to prepare');
    }
  },
  {
    name: 'keeps confirmed but unfinished tax matters waiting for generation',
    run: () => {
      const pendingTaxMatter = createTaxMatter({
        files: [],
        id: 'tax-matter-pending-voucher',
        linkedTransactionNos: [],
        matterNo: 'TAX-PENDING-VOUCHER',
        processStatus: '待上传回执'
      });
      const vouchers = buildAccountingVouchers([], [], [], [pendingTaxMatter]);
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
        files: getTaxMatterByNo('TAX-2026Q1-VAT').files.filter((file) => file.type !== '缴款回单'),
        id: 'tax-matter-missing-receipt-voucher',
        matterNo: 'TAX-MISSING-RECEIPT'
      });
      const vouchers = buildAccountingVouchers([], [], [], [missingReceiptTaxMatter]);
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
      const vouchers = buildAccountingVouchers([], [], [], [zeroDeclarationTaxMatter]);

      assertEqual(
        vouchers.some((record) => record.sourceNo === zeroDeclarationTaxMatter.matterNo),
        false,
        'zero-declaration tax matter should not create amount voucher'
      );
    }
  },
  {
    name: 'applies preparation and posting lifecycle and derives ledger entries from posted vouchers only',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords, financeTaxMatterRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const preparedLifecycleRows: AccountingVoucherLifecycleRecord[] = [
        {
          accountingPeriod: readyVoucher.accountingPeriod,
          formalVoucherNo: getNextAccountingVoucherFormalNo([], readyVoucher.accountingPeriod),
          preparedAt: '2026-06-27 17:00',
          preparedBy: '李明',
          status: '已制单',
          voucherId: readyVoucher.id
        }
      ];
      const preparedRows = applyAccountingVoucherLifecycle(vouchers, preparedLifecycleRows);
      const preparedVoucher = getVoucherBySourceNo(preparedRows, readyVoucher.sourceNo);
      const postedLifecycleRows: AccountingVoucherLifecycleRecord[] = [
        {
          ...preparedLifecycleRows[0]!,
          postedAt: '2026-06-27 17:10',
          postedBy: '李明',
          status: '已入账',
        }
      ];
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, postedLifecycleRows);
      const postedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const ledgerEntries = buildAccountingLedgerEntries(lifecycleAppliedRows);

      assertEqual(canPrepareAccountingVoucher(readyVoucher), true, 'ready voucher should be preparable');
      assertEqual(preparedVoucher.status, '已制单', 'preparation lifecycle should create a formal unposted voucher');
      assertEqual(preparedVoucher.voucherNo, '记-202606-001', 'prepared voucher should use formal voucher number');
      assertEqual(canPostAccountingVoucher(preparedVoucher), true, 'prepared voucher should be postable');
      assertEqual(buildAccountingLedgerEntries(preparedRows).length, 0, 'prepared but unposted voucher should not write ledger entries');
      assertEqual(postedVoucher.status, '已入账', 'posting lifecycle row should mark voucher as posted');
      assertEqual(postedVoucher.voucherNo, '记-202606-001', 'posted voucher should use formal voucher number');
      assertEqual(canPostAccountingVoucher(postedVoucher), false, 'posted voucher should not be postable again');
      assertEqual(canReverseAccountingVoucher(postedVoucher), true, 'posted voucher should be reversible while period is open');
      assertEqual(
        ledgerEntries.filter((entry) => entry.voucherId === postedVoucher.id).length,
        postedVoucher.lines.length,
        'ledger should contain one entry per posted voucher line'
      );
      assertEqual(
        ledgerEntries.some((entry) => entry.formalVoucherNo === postedVoucher.voucherNo && entry.subjectCode === '1122'),
        true,
        'ledger entries should retain formal voucher number and subject code'
      );
    }
  },
  {
    name: 'blocks preparation, posting and reversal when accounting period is closed',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const readyVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, [
        {
          accountingPeriod: readyVoucher.accountingPeriod,
          formalVoucherNo: '记-202606-001',
          preparedAt: '2026-06-27 17:00',
          preparedBy: '李明',
          postedAt: '2026-06-27 17:00',
          postedBy: '李明',
          status: '已入账',
          voucherId: readyVoucher.id
        }
      ]);
      const preparedRows = applyAccountingVoucherLifecycle(vouchers, [
        {
          accountingPeriod: readyVoucher.accountingPeriod,
          formalVoucherNo: '记-202606-001',
          preparedAt: '2026-06-27 17:00',
          preparedBy: '李明',
          status: '已制单',
          voucherId: readyVoucher.id
        }
      ]);
      const preparedVoucher = getVoucherBySourceNo(preparedRows, readyVoucher.sourceNo);
      const postedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, readyVoucher.sourceNo);
      const lockedPeriods: AccountingPeriodLockRecord[] = [
        {
          accountingPeriod: readyVoucher.accountingPeriod,
          lockedAt: '2026-06-30 18:00',
          lockedBy: '李明',
          reason: '月结',
          status: '已结账'
        }
      ];

      assertEqual(canPrepareAccountingVoucher(readyVoucher, lockedPeriods), false, 'closed period should block preparation');
      assertEqual(canPostAccountingVoucher(preparedVoucher, lockedPeriods), false, 'closed period should block posting');
      assertEqual(canReverseAccountingVoucher(postedVoucher, lockedPeriods), false, 'closed period should block reversal');
    }
  },
  {
    name: 'marks reversed lifecycle rows without producing ledger entries',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const generatedVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-001');
      const lifecycleAppliedRows = applyAccountingVoucherLifecycle(vouchers, [
        {
          accountingPeriod: generatedVoucher.accountingPeriod,
          formalVoucherNo: '记-202606-001',
          preparedAt: '2026-06-27 17:00',
          preparedBy: '李明',
          postedAt: '2026-06-27 17:00',
          postedBy: '李明',
          reversedAt: '2026-06-27 17:20',
          reversedBy: '李明',
          reversalReason: '测试冲销',
          status: '已冲销',
          voucherId: generatedVoucher.id
        }
      ]);
      const reversedVoucher = getVoucherBySourceNo(lifecycleAppliedRows, generatedVoucher.sourceNo);

      assertEqual(reversedVoucher.status, '已冲销', 'reversed lifecycle should mark voucher as reversed');
      assertEqual(
        buildAccountingLedgerEntries(lifecycleAppliedRows).some((entry) => entry.voucherId === reversedVoucher.id),
        false,
        'reversed voucher should not produce active ledger entries in the frontend mock'
      );
    }
  },
  {
    name: 'allows accrual preparation with source tax basis while invoice evidence remains pending',
    run: () => {
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, financeTransactionRecords, financeInvoiceRecords);
      const partialInvoiceVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-002');
      const missingInvoiceVoucher = getVoucherBySourceNo(vouchers, 'AR-202606-003');
      const partialTaxLine = getLineBySubjectCode(partialInvoiceVoucher, '2221.01');
      const missingInvoiceTaxLine = getLineBySubjectCode(missingInvoiceVoucher, '2221.01');

      assertEqual(partialInvoiceVoucher.status, '待制单', 'partially invoiced receivable should be ready when source tax basis is complete');
      assertEqual(partialInvoiceVoucher.issueReasons.length, 0, 'partial invoice evidence should remain a reminder instead of blocking preparation');
      assertEqual(partialInvoiceVoucher.taxBasis?.basisSource, '来源单据', 'partial invoice should fall back to source tax basis');
      assertEqual(partialInvoiceVoucher.taxBasis?.evidenceStatus, '发票部分匹配', 'partial invoice should stay visible as evidence status');
      assertEqual(partialTaxLine.amount, 178.22, 'partial invoice receivable should split full source tax amount');
      assertEqual(missingInvoiceVoucher.status, '待制单', 'receivable without invoice should be ready when source tax basis is complete');
      assertEqual(missingInvoiceVoucher.issueReasons.length, 0, 'missing invoice evidence should remain visible without blocking preparation');
      assertEqual(missingInvoiceVoucher.invoiceRefs.length, 0, 'missing invoice receivable should not invent invoice references');
      assertEqual(missingInvoiceVoucher.taxBasis?.evidenceStatus, '发票待补', 'missing invoice should stay visible as evidence status');
      assertEqual(missingInvoiceTaxLine.amount, 126.73, 'missing invoice receivable should split source tax amount');
    }
  },
  {
    name: 'shows confirmed receivable as pending accrual voucher when tax basis is unavailable',
    run: () => {
      const missingTaxBasisRecord = createReceivableWithPendingTaxBasis();
      const vouchers = buildAccountingVouchers([missingTaxBasisRecord], [], []);
      const voucher = getVoucherBySourceNo(vouchers, missingTaxBasisRecord.documentNo);

      assertEqual(voucher.businessType, '权责凭证', 'confirmed receivable should remain visible in accrual voucher workbench');
      assertEqual(voucher.status, '待生成', 'receivable without tax basis should wait for accrual prerequisites');
      assertIncludes(voucher.issueReasons, 'tax_basis_pending' satisfies AccountingVoucherIssueCode, 'missing tax basis should be exposed as prerequisite');
      assertEqual(voucher.taxBasis?.basisSource, '待确认', 'pending tax basis should stay visible for business review');
    }
  },
  {
    name: 'creates issue row for red invoice without original blue invoice',
    run: () => {
      const vouchers = buildAccountingVouchers([], [], financeInvoiceRecords);
      const redInvoiceVoucher = getVoucherBySourceNo(vouchers, '254420000000610004');

      assertEqual(redInvoiceVoucher.businessType, '调整凭证', 'unresolved red invoice should be treated as adjustment handling row');
      assertEqual(redInvoiceVoucher.sourceModule, '发票台账', 'unresolved red invoice source should stay in invoice ledger');
      assertEqual(redInvoiceVoucher.status, '需处理', 'red invoice without original invoice should require handling');
      assertIncludes(redInvoiceVoucher.issueReasons, 'reversal_required' satisfies AccountingVoucherIssueCode, 'red invoice should require reversal relation');
    }
  },
  {
    name: 'marks reviewed cash voucher as issue when original evidence is missing',
    run: () => {
      const missingEvidenceTransaction = createMissingEvidenceTransaction();
      const vouchers = buildAccountingVouchers([], [missingEvidenceTransaction]);
      const voucher = getVoucherBySourceNo(vouchers, missingEvidenceTransaction.transactionNo);
      const metrics = buildAccountingVoucherMetrics(vouchers);

      assertEqual(voucher.status, '需处理', 'reviewed cash-flow without evidence should require handling');
      assertIncludes(voucher.issueReasons, 'missing_original_evidence' satisfies AccountingVoucherIssueCode, 'missing evidence should be exposed as issue reason');
      assertEqual(getAccountingVoucherIssueSummary(voucher), '缺少原始凭证', 'issue summary should use business copy');
      assertEqual(metrics.issueCount, 1, 'metrics should count issue voucher');
      assertEqual(metrics.readyToPrepareCount, 0, 'issue voucher should not be counted as ready to prepare');
    }
  },
  {
    name: 'shows confirmed receivable-payable rows with missing accounting subject as pending accrual vouchers',
    run: () => {
      const missingSubjectRecord = createMissingSubjectPayable();
      const vouchers = buildAccountingVouchers([missingSubjectRecord], []);
      const voucher = getVoucherBySourceNo(vouchers, missingSubjectRecord.documentNo);

      assertEqual(voucher.businessType, '权责凭证', 'confirmed payable should remain visible in accrual voucher workbench');
      assertEqual(voucher.status, '待生成', 'payable without accounting subject should wait for accrual prerequisites');
      assertIncludes(voucher.issueReasons, 'missing_accounting_subject' satisfies AccountingVoucherIssueCode, 'missing accounting subject should be exposed as prerequisite');
      assertEqual(getAccountingVoucherIssueSummary(voucher), '缺少会计科目', 'issue summary should use business copy');
    }
  },
  {
    name: 'filters vouchers by business type, status, date scope, and keyword',
    run: () => {
      const missingEvidenceTransaction = createMissingEvidenceTransaction();
      const vouchers = buildAccountingVouchers(financeReceivablePayableRecords, [missingEvidenceTransaction, ...financeTransactionRecords], financeInvoiceRecords);
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
