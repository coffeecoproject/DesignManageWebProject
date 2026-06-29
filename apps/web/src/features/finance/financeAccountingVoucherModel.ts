import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { getDateScopeRange, type DateScopeFilterValue } from '../../components/DateFilterFields';
import {
  getAccountingSubjectByCode,
  type AccountingSubjectBalanceDirection,
  type AccountingSubjectType
} from './financeAccountingSubjectData';
import {
  getFinanceCategoryAccountingSubjectCode,
  type FinanceTransactionDirection,
  type FinanceTransactionRecord
} from './financeData';
import type { FinanceInvoiceRecord } from './financeInvoiceData';
import type {
  FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import {
  buildFinanceReceivablePayableAccrualReadiness,
  isFinanceReceivablePayableConfirmed,
  isFinanceReceivablePayableVoided,
  type FinanceReceivablePayableAccrualReadinessIssue
} from './financeReceivablesPayablesModel';
import {
  resolveFinanceAccrualTaxBasis,
  type FinanceResolvedTaxBasis,
  type FinanceTaxBasisSource,
  type FinanceTaxEvidenceStatus
} from './financeTaxBasisModel';
import type {
  FinanceTaxMatterRecord,
  FinanceTaxMatterType
} from './financeTaxFilingData';
import {
  getMissingTaxMatterReceiptTypes,
  getTaxMatterRequiredReceiptTypes
} from './financeTaxMatterModel';

export type AccountingVoucherSourceType = '业务确认' | '收付款' | '票税事实' | '税费事项';
export type AccountingVoucherBusinessType = '权责凭证' | '资金凭证' | '税费凭证' | '调整凭证';
export type AccountingVoucherKind = '转账凭证' | '收款凭证' | '付款凭证';
export type AccountingVoucherCandidateStatus = '待生成' | '需处理' | '待制单';
export type AccountingVoucherFormalStatus = '已制单' | '已入账' | '已冲销';
export type AccountingVoucherStatus = AccountingVoucherCandidateStatus | AccountingVoucherFormalStatus;
export type AccountingVoucherLineSide = '借方' | '贷方';
export type AccountingVoucherIssueCode =
  | 'missing_source_document'
  | 'missing_original_evidence'
  | 'missing_accounting_subject'
  | 'amount_invalid'
  | 'unbalanced_entries'
  | 'tax_amount_missing'
  | 'tax_basis_pending'
  | 'bank_reconciliation_pending'
  | 'bank_amount_mismatch'
  | 'period_mismatch'
  | 'reversal_required'
  | 'tax_matter_pending'
  | 'tax_receipt_missing';

export type AccountingVoucherSubjectSnapshot = {
  balanceDirection: AccountingSubjectBalanceDirection;
  code: string;
  name: string;
  type: AccountingSubjectType;
};

export type AccountingVoucherLine = {
  amount: number;
  auxiliary: string;
  id: string;
  side: AccountingVoucherLineSide;
  subject?: AccountingVoucherSubjectSnapshot;
  subjectCode: string;
  summary: string;
};

export type AccountingVoucherSourceRef = {
  module: string;
  recordId: string;
  recordNo: string;
  role: '主来源' | '发票依据' | '申报依据' | '缴款依据';
};

export type AccountingVoucherInvoiceRef = {
  accountingPeriod: string;
  declarationTreatment: FinanceInvoiceRecord['declarationTreatment'];
  direction: FinanceInvoiceRecord['direction'];
  id: string;
  invoiceColor: FinanceInvoiceRecord['invoiceColor'];
  invoiceNo: string;
  invoiceStatus: FinanceInvoiceRecord['invoiceStatus'];
  taxAmount: number;
  taxExcludedAmount: number;
  taxIncludedAmount: number;
};

export type AccountingVoucherTaxBasisSource = FinanceTaxBasisSource;
export type AccountingVoucherTaxEvidenceStatus = FinanceTaxEvidenceStatus;
export type AccountingVoucherTaxBasis = FinanceResolvedTaxBasis;

export type AccountingVoucherRecord = {
  accountingPeriod: string;
  amount: number;
  businessType: AccountingVoucherBusinessType;
  counterparty: string;
  id: string;
  invoiceRefs: AccountingVoucherInvoiceRef[];
  issueReasons: AccountingVoucherIssueCode[];
  kind: AccountingVoucherKind;
  lines: AccountingVoucherLine[];
  sourceModule: '应收应付' | '收支流水' | '发票台账' | '税务办理';
  sourceNo: string;
  sourceRefs: AccountingVoucherSourceRef[];
  sourceTitle: string;
  sourceType: AccountingVoucherSourceType;
  status: AccountingVoucherStatus;
  summary: string;
  taxBasis?: AccountingVoucherTaxBasis;
  voucherDate: string;
  voucherNo: string;
};

export type AccountingVoucherFilters = {
  accountingPeriodTime: DateScopeFilterValue;
  businessType: '全部' | AccountingVoucherBusinessType;
  keyword: string;
  status: '全部' | AccountingVoucherStatus;
};

export type AccountingVoucherMetrics = {
  balancedCount: number;
  issueCount: number;
  pendingGenerationCount: number;
  postedCount: number;
  preparedCount: number;
  readyToPrepareCount: number;
  reversedCount: number;
  totalCount: number;
};

export type AccountingVoucherLifecycleStatus = AccountingVoucherFormalStatus;

export type AccountingVoucherLifecycleRecord = {
  accountingPeriod: string;
  formalVoucherNo: string;
  postedAt?: string;
  postedBy?: string;
  preparedAt: string;
  preparedBy: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  status: AccountingVoucherLifecycleStatus;
  voucherId: string;
};

export type AccountingPeriodLockStatus = '开放' | '已结账';

export type AccountingPeriodLockRecord = {
  accountingPeriod: string;
  lockedAt?: string;
  lockedBy?: string;
  reason?: string;
  status: AccountingPeriodLockStatus;
};

export type AccountingLedgerEntry = {
  accountingPeriod: string;
  auxiliary: string;
  creditAmount: number;
  debitAmount: number;
  formalVoucherNo: string;
  id: string;
  side: AccountingVoucherLineSide;
  subjectCode: string;
  subjectName: string;
  summary: string;
  voucherDate: string;
  voucherId: string;
};

type AccountingVoucherRecordDraft = Omit<AccountingVoucherRecord, 'issueReasons' | 'status'>;

export const accountingVoucherDefaultMonth = '2026-06';
export const accountingVoucherStatusOptions: AccountingVoucherStatus[] = ['待生成', '需处理', '待制单', '已制单', '已入账', '已冲销'];

export const accountingVoucherIssueLabels: Record<AccountingVoucherIssueCode, string> = {
  amount_invalid: '金额无效',
  bank_amount_mismatch: '银行金额不一致',
  bank_reconciliation_pending: '银行对账未完成',
  missing_accounting_subject: '缺少会计科目',
  missing_original_evidence: '缺少原始凭证',
  missing_source_document: '来源单据不完整',
  period_mismatch: '期间不一致',
  reversal_required: '需冲销处理',
  tax_amount_missing: '发票税额缺失',
  tax_basis_pending: '税额依据待确认',
  tax_matter_pending: '税费办理未完成',
  tax_receipt_missing: '税费回执缺失',
  unbalanced_entries: '借贷不平'
};

export const defaultAccountingVoucherFilters: AccountingVoucherFilters = {
  accountingPeriodTime: { mode: 'currentMonth' },
  businessType: '全部',
  keyword: '',
  status: '全部'
};

const acceptableEvidenceStatuses = new Set(['已上传', '已归档', '已生成', '已发布']);
const moneyTolerance = 0.01;
const pendingAccrualGenerationIssues = new Set<AccountingVoucherIssueCode>([
  'missing_source_document',
  'missing_original_evidence',
  'missing_accounting_subject',
  'tax_basis_pending'
]);

const receivablePayableReadinessIssueMap: Record<FinanceReceivablePayableAccrualReadinessIssue, AccountingVoucherIssueCode> = {
  accounting_subject_missing: 'missing_accounting_subject',
  original_evidence_missing: 'missing_original_evidence',
  source_document_incomplete: 'missing_source_document',
  tax_basis_pending: 'tax_basis_pending'
};

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

function getSubjectSnapshot(code: string): AccountingVoucherSubjectSnapshot | undefined {
  const subject = getAccountingSubjectByCode(code);

  if (!subject) {
    return undefined;
  }

  return {
    balanceDirection: subject.balanceDirection,
    code: subject.code,
    name: subject.name,
    type: subject.type
  };
}

function hasBlankSourceValue(value?: string) {
  return !value?.trim();
}

function hasOriginalEvidence(files: RelatedFileRecord[]) {
  return files.some((file) => acceptableEvidenceStatuses.has(file.status));
}

function addIssue(issues: AccountingVoucherIssueCode[], issue: AccountingVoucherIssueCode) {
  if (!issues.includes(issue)) {
    issues.push(issue);
  }
}

function addIssues(issues: AccountingVoucherIssueCode[], sourceIssues: AccountingVoucherIssueCode[]) {
  sourceIssues.forEach((issue) => addIssue(issues, issue));
}

function createVoucherLine({
  amount,
  auxiliary,
  id,
  side,
  subjectCode,
  summary
}: {
  amount: number;
  auxiliary: string;
  id: string;
  side: AccountingVoucherLineSide;
  subjectCode: string;
  summary: string;
}): AccountingVoucherLine {
  return {
    amount: roundMoney(amount),
    auxiliary,
    id,
    side,
    subject: getSubjectSnapshot(subjectCode),
    subjectCode,
    summary
  };
}

function createSourceRef(
  module: AccountingVoucherSourceRef['module'],
  recordId: string,
  recordNo: string,
  role: AccountingVoucherSourceRef['role']
): AccountingVoucherSourceRef {
  return {
    module,
    recordId,
    recordNo,
    role
  };
}

function createInvoiceRef(invoice: FinanceInvoiceRecord): AccountingVoucherInvoiceRef {
  return {
    accountingPeriod: invoice.accountingPeriod,
    declarationTreatment: invoice.declarationTreatment,
    direction: invoice.direction,
    id: invoice.id,
    invoiceColor: invoice.invoiceColor,
    invoiceNo: invoice.invoiceNo,
    invoiceStatus: invoice.invoiceStatus,
    taxAmount: invoice.taxAmount,
    taxExcludedAmount: invoice.taxExcludedAmount,
    taxIncludedAmount: invoice.taxIncludedAmount
  };
}

function summarizeInvoices(invoiceRows: FinanceInvoiceRecord[]) {
  return invoiceRows.reduce(
    (summary, invoice) => ({
      taxAmount: roundMoney(summary.taxAmount + invoice.taxAmount),
      taxExcludedAmount: roundMoney(summary.taxExcludedAmount + invoice.taxExcludedAmount),
      taxIncludedAmount: roundMoney(summary.taxIncludedAmount + invoice.taxIncludedAmount)
    }),
    {
      taxAmount: 0,
      taxExcludedAmount: 0,
      taxIncludedAmount: 0
    }
  );
}

function getReceivablePayableInvoiceRows(
  record: FinanceReceivablePayableRecord,
  invoiceRows: FinanceInvoiceRecord[]
) {
  const expectedDirection: FinanceInvoiceRecord['direction'] = record.direction === '应收' ? '销项' : '进项';

  return invoiceRows.filter((invoice) => (
    invoice.direction === expectedDirection &&
    invoice.counterparty === record.counterparty &&
    invoice.matchedBusinessRefs.some((businessRef) =>
      businessRef.recordId === record.id ||
      businessRef.recordNo === record.documentNo ||
      businessRef.sourceNo === record.sourceNo
    )
  ));
}

function getReceivablePayableInvoiceIssueReasons(
  record: FinanceReceivablePayableRecord,
  invoiceRows: FinanceInvoiceRecord[]
) {
  const issues: AccountingVoucherIssueCode[] = [];
  const normalInvoices = invoiceRows.filter((invoice) => invoice.invoiceStatus === '正常' && invoice.invoiceColor === '蓝票');
  const redInvoicesWithoutOrigin = invoiceRows.filter((invoice) => invoice.invoiceColor === '红票' && !invoice.originalInvoiceId);
  const invoiceSummary = summarizeInvoices(normalInvoices);
  const taxBasis = resolveFinanceAccrualTaxBasis(record, invoiceRows);

  if (redInvoicesWithoutOrigin.length > 0) {
    addIssue(issues, 'reversal_required');
  }

  if (taxBasis.basisSource === '待确认') {
    addIssue(issues, 'tax_basis_pending');
  }

  if (normalInvoices.some((invoice) => !Number.isFinite(invoice.taxAmount)) && taxBasis.basisSource === '发票台账') {
    addIssue(issues, 'tax_amount_missing');
  }

  if (invoiceSummary.taxIncludedAmount - record.amount > moneyTolerance) {
    addIssue(issues, 'amount_invalid');
  }

  return issues;
}

function getReceivablePayableIssueReasons(record: FinanceReceivablePayableRecord) {
  const issues: AccountingVoucherIssueCode[] = [];

  if (
    hasBlankSourceValue(record.documentNo) ||
    hasBlankSourceValue(record.sourceNo) ||
    hasBlankSourceValue(record.sourceTitle) ||
    hasBlankSourceValue(record.counterparty) ||
    hasBlankSourceValue(record.accountingPeriod) ||
    hasBlankSourceValue(record.confirmDate)
  ) {
    addIssue(issues, 'missing_source_document');
  }

  if (!hasOriginalEvidence(record.files)) {
    addIssue(issues, 'missing_original_evidence');
  }

  return issues;
}

function getReceivablePayableReadinessIssueReasons(
  record: FinanceReceivablePayableRecord,
  taxBasis: AccountingVoucherTaxBasis
) {
  return buildFinanceReceivablePayableAccrualReadiness(record, taxBasis).issues.map(
    (issue) => receivablePayableReadinessIssueMap[issue]
  );
}

function getTransactionIssueReasons(record: FinanceTransactionRecord) {
  const issues: AccountingVoucherIssueCode[] = [];

  if (
    hasBlankSourceValue(record.transactionNo) ||
    hasBlankSourceValue(record.sourceNo) ||
    hasBlankSourceValue(record.sourceTitle) ||
    hasBlankSourceValue(record.counterparty) ||
    hasBlankSourceValue(record.accountingPeriod) ||
    hasBlankSourceValue(record.occurredAt) ||
    hasBlankSourceValue(record.publicAccountId)
  ) {
    addIssue(issues, 'missing_source_document');
  }

  if (record.voucherStatus === '待补充' || !hasOriginalEvidence(record.files)) {
    addIssue(issues, 'missing_original_evidence');
  }

  if (record.reconciliationStatus === '对账异常') {
    addIssue(issues, 'bank_amount_mismatch');
  }

  if (record.reconciliationStatus === '未对账') {
    addIssue(issues, 'bank_reconciliation_pending');
  }

  return issues;
}

function getTaxMatterIssueReasons(record: FinanceTaxMatterRecord) {
  const issues: AccountingVoucherIssueCode[] = [];

  if (
    hasBlankSourceValue(record.matterNo) ||
    hasBlankSourceValue(record.title) ||
    hasBlankSourceValue(record.period) ||
    hasBlankSourceValue(record.paymentDueDate) ||
    hasBlankSourceValue(record.declarationDueDate)
  ) {
    addIssue(issues, 'missing_source_document');
  }

  if (record.processStatus !== '已完成') {
    addIssue(issues, 'tax_matter_pending');
    return issues;
  }

  const requiredReceiptTypes = getTaxMatterRequiredReceiptTypes(record);
  const missingReceiptTypes = getMissingTaxMatterReceiptTypes(record.files, requiredReceiptTypes);

  if (missingReceiptTypes.length > 0 || !hasOriginalEvidence(record.files)) {
    addIssue(issues, 'tax_receipt_missing');
  }

  return issues;
}

function getUnresolvedRedInvoiceIssueReasons(invoice: FinanceInvoiceRecord, invoiceRows: FinanceInvoiceRecord[]) {
  const issues: AccountingVoucherIssueCode[] = [];
  const originalInvoice = invoice.originalInvoiceId
    ? invoiceRows.find((candidate) => candidate.id === invoice.originalInvoiceId)
    : undefined;

  if (invoice.invoiceColor === '红票' && !originalInvoice) {
    addIssue(issues, 'reversal_required');
  }

  return issues;
}

function finalizeAccountingVoucher(
  record: AccountingVoucherRecordDraft,
  sourceIssues: AccountingVoucherIssueCode[] = []
): AccountingVoucherRecord {
  const issueReasons: AccountingVoucherIssueCode[] = [];

  addIssues(issueReasons, sourceIssues);

  if (!Number.isFinite(record.amount) || record.amount <= 0) {
    addIssue(issueReasons, 'amount_invalid');
  }

  if (record.lines.some((line) => !line.subject)) {
    addIssue(issueReasons, 'missing_accounting_subject');
  }

  if (!isAccountingVoucherBalanced(record)) {
    addIssue(issueReasons, 'unbalanced_entries');
  }

  return {
    ...record,
    issueReasons,
    status: issueReasons.length > 0 ? '需处理' : '待制单'
  };
}

function finalizeTransactionVoucher(
  record: AccountingVoucherRecordDraft,
  sourceIssues: AccountingVoucherIssueCode[]
): AccountingVoucherRecord {
  const finalized = finalizeAccountingVoucher(record, sourceIssues);
  const onlyWaitingForBankReconciliation = finalized.issueReasons.length === 1 &&
    finalized.issueReasons[0] === 'bank_reconciliation_pending';

  if (onlyWaitingForBankReconciliation) {
    return {
      ...finalized,
      status: '待生成'
    };
  }

  return finalized;
}

function finalizeTaxMatterVoucher(
  record: AccountingVoucherRecordDraft,
  sourceIssues: AccountingVoucherIssueCode[]
): AccountingVoucherRecord {
  const finalized = finalizeAccountingVoucher(record, sourceIssues);
  const onlyWaitingForTaxMatterCompletion = finalized.issueReasons.length === 1 &&
    finalized.issueReasons[0] === 'tax_matter_pending';

  if (onlyWaitingForTaxMatterCompletion) {
    return {
      ...finalized,
      status: '待生成'
    };
  }

  return finalized;
}

function finalizeReceivablePayableVoucher(
  record: AccountingVoucherRecordDraft,
  sourceIssues: AccountingVoucherIssueCode[]
): AccountingVoucherRecord {
  const finalized = finalizeAccountingVoucher(record, sourceIssues);
  const onlyWaitingForAccrualPrerequisites = finalized.issueReasons.length > 0 &&
    finalized.issueReasons.every((issue) => pendingAccrualGenerationIssues.has(issue));

  if (onlyWaitingForAccrualPrerequisites) {
    return {
      ...finalized,
      status: '待生成'
    };
  }

  return finalized;
}

function getPayableExpenseSubjectCode(record: FinanceReceivablePayableRecord) {
  return getFinanceCategoryAccountingSubjectCode(record.category, 'accrualExpense') ?? '';
}

function getPayableLiabilitySubjectCode(record: FinanceReceivablePayableRecord) {
  return getFinanceCategoryAccountingSubjectCode(record.category, 'accrualPayable') ?? '';
}

function getCashReceiptCreditSubjectCode(record: FinanceTransactionRecord) {
  return getFinanceCategoryAccountingSubjectCode(record.category, 'cashCredit') ?? '';
}

function getTaxPaymentDebitSubjectCode(record: FinanceTransactionRecord) {
  const sourceText = `${record.sourceTitle} ${record.sourceNo} ${record.category}`;

  if (sourceText.includes('个人所得税') || sourceText.includes('IIT')) {
    return '2221.03';
  }

  if (sourceText.includes('企业所得税') || sourceText.includes('CIT')) {
    return '2221.02';
  }

  if (sourceText.includes('社保')) {
    return '2211.03';
  }

  if (sourceText.includes('公积金')) {
    return '2211.04';
  }

  if (sourceText.includes('印花税')) {
    return '2221.05';
  }

  if (sourceText.includes('增值税') || sourceText.includes('VAT')) {
    return '2221.01';
  }

  return getFinanceCategoryAccountingSubjectCode(record.category, 'cashDebit') ?? '';
}

function getCashPaymentDebitSubjectCode(record: FinanceTransactionRecord) {
  if (record.sourceType === '税费事项') {
    return getTaxPaymentDebitSubjectCode(record);
  }

  return getFinanceCategoryAccountingSubjectCode(record.category, 'cashDebit') ?? '';
}

const taxMatterAccountingSubjectMappings: Record<FinanceTaxMatterType, { credit: string; debit: string }> = {
  个人所得税: { credit: '2221.03', debit: '2211.01' },
  企业所得税: { credit: '2221.02', debit: '6801' },
  公积金缴纳: { credit: '2211.04', debit: '6602.02' },
  其他税费: { credit: '2221.99', debit: '6403' },
  印花税: { credit: '2221.05', debit: '6403' },
  增值税及附加: { credit: '2221.01', debit: '6403' },
  社保缴纳: { credit: '2211.03', debit: '6602.02' }
};

function getTaxMatterDebitSubjectCode(matterType: FinanceTaxMatterType) {
  return taxMatterAccountingSubjectMappings[matterType].debit;
}

function getTaxMatterCreditSubjectCode(matterType: FinanceTaxMatterType) {
  return taxMatterAccountingSubjectMappings[matterType].credit;
}

function getTaxMatterCounterparty(matterType: FinanceTaxMatterType) {
  if (matterType === '社保缴纳') {
    return '社保经办机构';
  }

  if (matterType === '公积金缴纳') {
    return '住房公积金中心';
  }

  return '税务机关';
}

function getTaxMatterVoucherDate(record: FinanceTaxMatterRecord) {
  return record.declarationDate ?? record.updatedAt ?? record.paymentDueDate;
}

function getTaxMatterAccountingPeriod(record: FinanceTaxMatterRecord) {
  return getTaxMatterVoucherDate(record).slice(0, 7);
}

function getTaxMatterVoucherPeriodCode(record: FinanceTaxMatterRecord) {
  return getTaxMatterAccountingPeriod(record).replace(/[^0-9]/g, '');
}

function shouldBuildTaxMatterVoucher(record: FinanceTaxMatterRecord) {
  if (record.dataStatus !== '已确认') {
    return false;
  }

  if (record.payableAmount > moneyTolerance) {
    return true;
  }

  return !['零申报', '无需申报'].includes(record.declarationStatus) && record.paymentStatus !== '无需缴纳';
}

function getVoucherKindForTransactionDirection(direction: FinanceTransactionDirection): AccountingVoucherKind {
  if (direction === '收入') {
    return '收款凭证';
  }

  if (direction === '支出') {
    return '付款凭证';
  }

  return '转账凭证';
}

function isAdjustmentTransaction(record: FinanceTransactionRecord) {
  return Boolean(record.adjustmentContext) || record.sourceType === '流水冲正' || record.sourceType === '流水补差';
}

function createReceivableLines(
  record: FinanceReceivablePayableRecord,
  taxBasis: AccountingVoucherTaxBasis
) {
  const taxAmount = Math.max(0, taxBasis.taxAmount);
  const incomeAmount = roundMoney(record.amount - taxAmount);
  const lines = [
    createVoucherLine({
      amount: record.amount,
        auxiliary: record.counterparty,
        id: `${record.id}-debit`,
        side: '借方',
        subjectCode: getFinanceCategoryAccountingSubjectCode(record.category, 'accrualReceivable') ?? '',
        summary: record.sourceTitle
      }),
      createVoucherLine({
        amount: incomeAmount,
        auxiliary: record.sourceNo,
        id: `${record.id}-credit-income`,
        side: '贷方',
        subjectCode: getFinanceCategoryAccountingSubjectCode(record.category, 'accrualRevenue') ?? '',
        summary: record.sourceTitle
      })
  ];

  if (taxAmount > moneyTolerance) {
    lines.push(
      createVoucherLine({
        amount: taxAmount,
          auxiliary: record.sourceNo,
          id: `${record.id}-credit-tax`,
          side: '贷方',
          subjectCode: getFinanceCategoryAccountingSubjectCode(record.category, 'outputVatPayable') ?? '',
          summary: `${record.sourceTitle} ${taxBasis.basisSource === '发票台账' ? '发票税额' : '来源税额'}`
        })
    );
  }

  return lines;
}

export function buildAccountingVoucherFromReceivablePayable(
  record: FinanceReceivablePayableRecord,
  index: number,
  invoiceRows: FinanceInvoiceRecord[] = []
): AccountingVoucherRecord | undefined {
  const relatedInvoices = getReceivablePayableInvoiceRows(record, invoiceRows);
  const invoiceRefs = relatedInvoices.map(createInvoiceRef);
  const taxBasis = resolveFinanceAccrualTaxBasis(record, relatedInvoices);

  if (!isFinanceReceivablePayableConfirmed(record) || isFinanceReceivablePayableVoided(record)) {
    return undefined;
  }

  const voucherNo = `VCH-${record.accountingPeriod.replace('-', '')}-B${String(index + 1).padStart(3, '0')}`;
  const common = {
    accountingPeriod: record.accountingPeriod,
    amount: record.amount,
    businessType: '权责凭证' as const,
    counterparty: record.counterparty,
    id: `voucher-business-${record.id}`,
    invoiceRefs,
    kind: '转账凭证' as const,
    sourceModule: '应收应付' as const,
    sourceNo: record.documentNo,
    sourceRefs: [
      createSourceRef('应收应付', record.id, record.documentNo, '主来源'),
      ...invoiceRefs.map((invoice) => createSourceRef('发票台账', invoice.id, invoice.invoiceNo, '发票依据'))
    ],
    sourceTitle: record.sourceTitle,
    sourceType: '业务确认' as const,
    summary: `${record.sourceType}确认：${record.sourceTitle}`,
    taxBasis,
    voucherDate: record.confirmDate,
    voucherNo
  };
  const sourceIssues = [
    ...getReceivablePayableReadinessIssueReasons(record, taxBasis),
    ...getReceivablePayableIssueReasons(record),
    ...getReceivablePayableInvoiceIssueReasons(record, relatedInvoices)
  ];

  if (record.direction === '应收') {
    return finalizeReceivablePayableVoucher(
      {
        ...common,
        lines: createReceivableLines(record, taxBasis)
      },
      sourceIssues
    );
  }

  return finalizeReceivablePayableVoucher(
    {
      ...common,
      lines: [
        createVoucherLine({
          amount: record.amount,
          auxiliary: record.sourceNo,
          id: `${record.id}-debit`,
          side: '借方',
          subjectCode: getPayableExpenseSubjectCode(record),
          summary: record.sourceTitle
        }),
        createVoucherLine({
          amount: record.amount,
          auxiliary: record.counterparty,
          id: `${record.id}-credit`,
          side: '贷方',
          subjectCode: getPayableLiabilitySubjectCode(record),
          summary: record.sourceTitle
        })
      ]
    },
    sourceIssues
  );
}

export function buildAccountingVoucherFromTransaction(record: FinanceTransactionRecord, index: number): AccountingVoucherRecord | undefined {
  if (record.status !== '已入账') {
    return undefined;
  }

  const isAdjustment = isAdjustmentTransaction(record);
  const voucherNo = `VCH-${record.accountingPeriod.replace('-', '')}-${isAdjustment ? 'A' : 'C'}${String(index + 1).padStart(3, '0')}`;
  const bankSubjectCode = '1002';
  const common = {
    accountingPeriod: record.accountingPeriod,
    amount: record.amount,
    businessType: isAdjustment ? '调整凭证' as const : '资金凭证' as const,
    counterparty: record.counterparty,
    id: `voucher-cash-${record.id}`,
    invoiceRefs: [],
    kind: getVoucherKindForTransactionDirection(record.direction),
    sourceModule: '收支流水' as const,
    sourceNo: record.transactionNo,
    sourceRefs: [createSourceRef('收支流水', record.id, record.transactionNo, '主来源')],
    sourceTitle: record.sourceTitle,
    sourceType: '收付款' as const,
    summary: isAdjustment
      ? `${record.adjustmentContext?.mode ?? '调整'}入账：${record.sourceTitle}`
      : `${record.direction}入账：${record.sourceTitle}`,
    voucherDate: record.occurredAt,
    voucherNo
  };
  const sourceIssues = getTransactionIssueReasons(record);

  if (record.direction === '收入') {
    return finalizeTransactionVoucher(
      {
        ...common,
        lines: [
          createVoucherLine({
            amount: record.amount,
            auxiliary: record.publicAccountSnapshot.displayName,
            id: `${record.id}-debit`,
            side: '借方',
            subjectCode: bankSubjectCode,
            summary: record.sourceTitle
          }),
          createVoucherLine({
            amount: record.amount,
            auxiliary: record.counterparty,
            id: `${record.id}-credit`,
            side: '贷方',
            subjectCode: getCashReceiptCreditSubjectCode(record),
            summary: record.sourceTitle
          })
        ]
      },
      sourceIssues
    );
  }

  return finalizeTransactionVoucher(
    {
      ...common,
      lines: [
        createVoucherLine({
          amount: record.amount,
          auxiliary: record.counterparty,
          id: `${record.id}-debit`,
          side: '借方',
          subjectCode: getCashPaymentDebitSubjectCode(record),
          summary: record.sourceTitle
        }),
        createVoucherLine({
          amount: record.amount,
          auxiliary: record.publicAccountSnapshot.displayName,
          id: `${record.id}-credit`,
          side: '贷方',
          subjectCode: bankSubjectCode,
          summary: record.sourceTitle
        })
      ]
    },
    sourceIssues
  );
}

function buildAccountingVoucherFromUnresolvedRedInvoice(
  invoice: FinanceInvoiceRecord,
  index: number,
  invoiceRows: FinanceInvoiceRecord[]
): AccountingVoucherRecord | undefined {
  const sourceIssues = getUnresolvedRedInvoiceIssueReasons(invoice, invoiceRows);

  if (sourceIssues.length === 0) {
    return undefined;
  }

  const voucherNo = `VCH-${invoice.accountingPeriod.replace('-', '')}-I${String(index + 1).padStart(3, '0')}`;
  const invoiceAmount = Math.abs(invoice.taxIncludedAmount || invoice.totalAmount);

  return finalizeAccountingVoucher(
    {
      accountingPeriod: invoice.accountingPeriod,
      amount: roundMoney(invoiceAmount),
      businessType: '调整凭证',
      counterparty: invoice.counterparty,
      id: `voucher-invoice-${invoice.id}`,
      invoiceRefs: [createInvoiceRef(invoice)],
      kind: '转账凭证',
      lines: [],
      sourceModule: '发票台账',
      sourceNo: invoice.invoiceNo,
      sourceRefs: [createSourceRef('发票台账', invoice.id, invoice.invoiceNo, '主来源')],
      sourceTitle: `${invoice.counterparty} ${invoice.invoiceColor}`,
      sourceType: '票税事实',
      summary: `红字发票待处理：${invoice.invoiceNo}`,
      voucherDate: invoice.invoiceDate,
      voucherNo
    },
    sourceIssues
  );
}

export function buildAccountingVoucherFromTaxMatter(record: FinanceTaxMatterRecord, index: number): AccountingVoucherRecord | undefined {
  if (!shouldBuildTaxMatterVoucher(record)) {
    return undefined;
  }

  const voucherNo = `VCH-${getTaxMatterVoucherPeriodCode(record)}-T${String(index + 1).padStart(3, '0')}`;
  const voucherDate = getTaxMatterVoucherDate(record);
  const accountingPeriod = getTaxMatterAccountingPeriod(record);
  const sourceRefs: AccountingVoucherSourceRef[] = [
    createSourceRef('税务办理', record.id, record.matterNo, '主来源'),
    ...record.sourceItems.map((sourceItem) => (
      createSourceRef(sourceItem.sourceModule, sourceItem.id, sourceItem.name, '申报依据')
    )),
    ...record.linkedTransactionNos.map((transactionNo) => (
      createSourceRef('收支流水', transactionNo, transactionNo, '缴款依据')
    ))
  ];

  return finalizeTaxMatterVoucher(
    {
      accountingPeriod,
      amount: record.payableAmount,
      businessType: '税费凭证',
      counterparty: getTaxMatterCounterparty(record.matterType),
      id: `voucher-tax-${record.id}`,
      invoiceRefs: [],
      kind: '转账凭证',
      lines: [
        createVoucherLine({
          amount: record.payableAmount,
          auxiliary: record.period,
          id: `${record.id}-debit`,
          side: '借方',
          subjectCode: getTaxMatterDebitSubjectCode(record.matterType),
          summary: record.title
        }),
        createVoucherLine({
          amount: record.payableAmount,
          auxiliary: record.matterType,
          id: `${record.id}-credit`,
          side: '贷方',
          subjectCode: getTaxMatterCreditSubjectCode(record.matterType),
          summary: record.title
        })
      ],
      sourceModule: '税务办理',
      sourceNo: record.matterNo,
      sourceRefs,
      sourceTitle: record.title,
      sourceType: '税费事项',
      summary: `${record.matterType}确认：${record.title}`,
      voucherDate,
      voucherNo
    },
    getTaxMatterIssueReasons(record)
  );
}

export function buildAccountingVouchers(
  receivablePayableRows: FinanceReceivablePayableRecord[],
  financeRows: FinanceTransactionRecord[],
  invoiceRows: FinanceInvoiceRecord[] = [],
  taxMatterRows: FinanceTaxMatterRecord[] = []
): AccountingVoucherRecord[] {
  const usedInvoiceIds = new Set<string>();
  const businessVouchers = receivablePayableRows
    .map((record, index) => {
      const voucher = buildAccountingVoucherFromReceivablePayable(record, index, invoiceRows);

      voucher?.invoiceRefs.forEach((invoice) => usedInvoiceIds.add(invoice.id));

      return voucher;
    })
    .filter((record): record is AccountingVoucherRecord => Boolean(record));
  const cashVouchers = financeRows
    .map((record, index) => buildAccountingVoucherFromTransaction(record, index))
    .filter((record): record is AccountingVoucherRecord => Boolean(record));
  const unresolvedInvoiceVouchers = invoiceRows
    .filter((invoice) => invoice.invoiceColor === '红票' && !usedInvoiceIds.has(invoice.id))
    .map((invoice, index) => buildAccountingVoucherFromUnresolvedRedInvoice(invoice, index, invoiceRows))
    .filter((record): record is AccountingVoucherRecord => Boolean(record));
  const taxMatterVouchers = taxMatterRows
    .map((record, index) => buildAccountingVoucherFromTaxMatter(record, index))
    .filter((record): record is AccountingVoucherRecord => Boolean(record));

  return [...businessVouchers, ...cashVouchers, ...taxMatterVouchers, ...unresolvedInvoiceVouchers].sort((left, right) => right.voucherDate.localeCompare(left.voucherDate));
}

export function getAccountingVoucherDebitTotal(record: Pick<AccountingVoucherRecord, 'lines'>) {
  return record.lines.filter((line) => line.side === '借方').reduce((total, line) => total + line.amount, 0);
}

export function getAccountingVoucherCreditTotal(record: Pick<AccountingVoucherRecord, 'lines'>) {
  return record.lines.filter((line) => line.side === '贷方').reduce((total, line) => total + line.amount, 0);
}

export function isAccountingVoucherBalanced(record: Pick<AccountingVoucherRecord, 'lines'>) {
  return Math.abs(getAccountingVoucherDebitTotal(record) - getAccountingVoucherCreditTotal(record)) < 0.01;
}

export function getAccountingVoucherIssueSummary(record: AccountingVoucherRecord) {
  if (record.issueReasons.length === 0) {
    return '-';
  }

  return record.issueReasons.map((issue) => accountingVoucherIssueLabels[issue]).join(' / ');
}

export function buildAccountingVoucherMetrics(rows: AccountingVoucherRecord[]): AccountingVoucherMetrics {
  return {
    balancedCount: rows.filter(isAccountingVoucherBalanced).length,
    issueCount: rows.filter((row) => row.status === '需处理').length,
    pendingGenerationCount: rows.filter((row) => row.status === '待生成').length,
    postedCount: rows.filter((row) => row.status === '已入账').length,
    preparedCount: rows.filter((row) => row.status === '已制单').length,
    readyToPrepareCount: rows.filter((row) => row.status === '待制单').length,
    reversedCount: rows.filter((row) => row.status === '已冲销').length,
    totalCount: rows.length
  };
}

function getFormalVoucherSequence(voucherNo: string) {
  const sequence = Number(voucherNo.slice(voucherNo.lastIndexOf('-') + 1));

  return Number.isFinite(sequence) ? sequence : 0;
}

export function getNextAccountingVoucherFormalNo(
  lifecycleRows: AccountingVoucherLifecycleRecord[],
  accountingPeriod: string
) {
  const periodCode = accountingPeriod.replace('-', '');
  const nextSequence =
    lifecycleRows
      .filter((row) => row.accountingPeriod === accountingPeriod)
      .reduce((maxSequence, row) => Math.max(maxSequence, getFormalVoucherSequence(row.formalVoucherNo)), 0) + 1;

  return `记-${periodCode}-${String(nextSequence).padStart(3, '0')}`;
}

export function isAccountingPeriodLocked(
  periodLocks: AccountingPeriodLockRecord[],
  accountingPeriod: string
) {
  return periodLocks.some((periodLock) => periodLock.accountingPeriod === accountingPeriod && periodLock.status === '已结账');
}

export function canPrepareAccountingVoucher(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  return record.status === '待制单' && !isAccountingPeriodLocked(periodLocks, record.accountingPeriod);
}

export function canPostAccountingVoucher(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  return record.status === '已制单' && !isAccountingPeriodLocked(periodLocks, record.accountingPeriod);
}

export function canReverseAccountingVoucher(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  return record.status === '已入账' && !isAccountingPeriodLocked(periodLocks, record.accountingPeriod);
}

export function applyAccountingVoucherLifecycle(
  rows: AccountingVoucherRecord[],
  lifecycleRows: AccountingVoucherLifecycleRecord[] = []
): AccountingVoucherRecord[] {
  const lifecycleByVoucherId = new Map(lifecycleRows.map((row) => [row.voucherId, row]));

  return rows.map((row) => {
    const lifecycle = lifecycleByVoucherId.get(row.id);

    if (!lifecycle) {
      return row;
    }

    return {
      ...row,
      status: lifecycle.status,
      voucherNo: lifecycle.formalVoucherNo
    };
  });
}

export function buildAccountingLedgerEntries(rows: AccountingVoucherRecord[]): AccountingLedgerEntry[] {
  return rows
    .filter((record) => record.status === '已入账')
    .flatMap((record) =>
      record.lines.map((line, index) => ({
        accountingPeriod: record.accountingPeriod,
        auxiliary: line.auxiliary,
        creditAmount: line.side === '贷方' ? line.amount : 0,
        debitAmount: line.side === '借方' ? line.amount : 0,
        formalVoucherNo: record.voucherNo,
        id: `ledger-${record.id}-${index + 1}`,
        side: line.side,
        subjectCode: line.subject?.code ?? line.subjectCode,
        subjectName: line.subject?.name ?? '未配置科目',
        summary: line.summary,
        voucherDate: record.voucherDate,
        voucherId: record.id
      }))
    );
}

function getAccountingVoucherPeriodRange(record: AccountingVoucherRecord) {
  const monthMatch = record.accountingPeriod.match(/^(\d{4})-(\d{2})$/);

  if (monthMatch) {
    return {
      endDate: `${monthMatch[1]}-${monthMatch[2]}-31`,
      startDate: `${monthMatch[1]}-${monthMatch[2]}-01`
    };
  }

  const quarterMatch = record.accountingPeriod.match(/^(\d{4})-Q([1-4])$/);

  if (quarterMatch) {
    const year = quarterMatch[1];
    const quarter = Number(quarterMatch[2]);
    const startMonth = String((quarter - 1) * 3 + 1).padStart(2, '0');
    const endMonth = String(quarter * 3).padStart(2, '0');

    return {
      endDate: `${year}-${endMonth}-31`,
      startDate: `${year}-${startMonth}-01`
    };
  }

  return {
    endDate: record.voucherDate,
    startDate: record.voucherDate
  };
}

export function matchesAccountingVoucherFilters(record: AccountingVoucherRecord, filters: AccountingVoucherFilters) {
  const range = getDateScopeRange(filters.accountingPeriodTime, accountingVoucherDefaultMonth);

  if (range) {
    const periodRange = getAccountingVoucherPeriodRange(record);

    if (periodRange.startDate > range.endDate || periodRange.endDate < range.startDate) {
      return false;
    }
  }

  if (filters.businessType !== '全部' && record.businessType !== filters.businessType) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [
    record.voucherNo,
    record.summary,
    record.sourceNo,
    record.sourceTitle,
    record.counterparty,
    record.businessType,
    record.kind,
    record.status,
    getAccountingVoucherIssueSummary(record),
    record.taxBasis ? `${record.taxBasis.basisSource} ${record.taxBasis.evidenceStatus} ${record.taxBasis.taxRate}` : '',
    ...record.sourceRefs.map((source) => `${source.module} ${source.recordNo} ${source.role}`),
    ...record.invoiceRefs.map((invoice) => `${invoice.invoiceNo} ${invoice.direction} ${invoice.invoiceStatus}`),
    ...record.lines.map((line) => `${line.subject?.code ?? line.subjectCode} ${line.subject?.name ?? '科目未配置'} ${line.auxiliary}`)
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}
