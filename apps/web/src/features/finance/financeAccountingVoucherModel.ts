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
import {
  getBankReconciliationLinksForTransaction,
  type FinanceBankReconciliationLinkRecord
} from './financeBankReconciliationModel';
import type { FinanceInvoiceBusinessAllocation, FinanceInvoiceRecord } from './financeInvoiceData';
import type {
  FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import type { FinanceDeclarationPreparationRecord } from './financeDeclarationPreparationData';
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
  FinanceTaxMatterDeclarationHistoryRecord,
  FinanceTaxMatterRecord,
  FinanceTaxMatterType,
  FinanceVatTaxSettlementSnapshot
} from './financeTaxFilingData';
import {
  getTaxMatterAccountingAmount,
  getTaxMatterEvidenceStatus,
  isSocialInsuranceTaxMatter
} from './financeTaxMatterModel';
import type { LedgerOpeningAdjustmentVoucherRecord } from './financeLedgerInitializationModel';
import {
  getFinanceMonthEndMatterVoucherLines,
  isFinanceMonthEndMatterVoucherReady,
  type FinanceMonthEndMatterRecord
} from './financeMonthEndModel';
import { getAccountingPeriodFromBusinessPeriod } from './financeUtils';

export type AccountingVoucherSourceType =
  | '业务确认'
  | '收付款'
  | '票税事实'
  | '税费事项'
  | '月末事项'
  | '期初调整'
  | '冲销事项'
  | '后续调整';
export type AccountingVoucherBusinessType = '权责凭证' | '资金凭证' | '税费凭证' | '调整凭证' | '冲销凭证';
export type AccountingVoucherKind = '转账凭证' | '收款凭证' | '付款凭证';
export type AccountingVoucherCandidateStatus = '待生成' | '需处理' | '待记账';
export type AccountingVoucherFormalStatus = '已记账' | '已冲销';
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
  | 'tax_payment_allocation_missing'
  | 'vat_liability_mismatch'
  | 'bank_reconciliation_source_missing'
  | 'bank_amount_mismatch'
  | 'period_mismatch'
  | 'reversal_required'
  | 'tax_declaration_evidence_pending';

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
  role: '主来源' | '发票依据' | '申报依据' | '资金结算依据' | '银行依据' | '冲销依据' | '调整依据';
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

export type AccountingVoucherTaxFilingContext = {
  declarationDate: string;
  declarationVersion: number;
  taxPeriod: string;
};

export type AccountingVoucherRecord = {
  accountingPeriod: string;
  amount: number;
  bookedAt?: string;
  bookedBy?: string;
  businessType: AccountingVoucherBusinessType;
  counterparty: string;
  id: string;
  invoiceRefs: AccountingVoucherInvoiceRef[];
  issueReasons: AccountingVoucherIssueCode[];
  kind: AccountingVoucherKind;
  lines: AccountingVoucherLine[];
  sourceModule: '应收应付' | '收支流水' | '发票台账' | '申报准备' | '税务办理' | '银行对账' | '月末事项' | '账套初始化' | '会计凭证';
  sourceNo: string;
  sourceRefs: AccountingVoucherSourceRef[];
  sourceTitle: string;
  sourceType: AccountingVoucherSourceType;
  status: AccountingVoucherStatus;
  summary: string;
  reversedAt?: string;
  reversedBy?: string;
  reversedByVoucherId?: string;
  reversalOfVoucherId?: string;
  reversalReason?: string;
  taxBasis?: AccountingVoucherTaxBasis;
  taxFilingContext?: AccountingVoucherTaxFilingContext;
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
  bookedCount: number;
  issueCount: number;
  pendingGenerationCount: number;
  readyToBookCount: number;
  reversedCount: number;
  totalCount: number;
};

export type AccountingVoucherLifecycleStatus = AccountingVoucherFormalStatus;

export type AccountingVoucherLifecycleRecord = {
  accountingPeriod: string;
  voucherNo: string;
  bookedAt: string;
  bookedBy: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  snapshot: AccountingVoucherRecord;
  status: AccountingVoucherLifecycleStatus;
  voucherId: string;
};

export type AccountingPeriodLockStatus = '开放' | '已结账' | '已反结账';

export type AccountingPeriodCloseCheckSnapshotItem = {
  code: string;
  detail: string;
  nextStep?: string;
  sourceSummary?: string;
  status: string;
  title: string;
};

export type AccountingPeriodCloseLedgerEntrySnapshot = {
  accountingPeriod: string;
  auxiliary: string;
  creditAmount: number;
  debitAmount: number;
  id: string;
  runningBalance: number;
  side: AccountingVoucherLineSide;
  subjectCode: string;
  subjectName: string;
  summary: string;
  voucherDate: string;
  voucherId: string;
  voucherNo: string;
};

export type AccountingPeriodCloseGeneralLedgerRowSnapshot = {
  balanceDirection: AccountingSubjectBalanceDirection;
  cashFlowActivity?: string;
  cashFlowItem?: string;
  creditAmount: number;
  debitAmount: number;
  endingBalanceAmount: number;
  endingBalanceSide: string;
  endingBalance: number;
  entries: AccountingPeriodCloseLedgerEntrySnapshot[];
  entryCount: number;
  hasCurrentMovement: boolean;
  openingBalanceAmount: number;
  openingBalanceSide: string;
  openingBalance: number;
  openingBalanceSource: string;
  reportItem: string;
  statementTarget: string;
  subjectCode: string;
  subjectId: string;
  subjectName: string;
  subjectType: AccountingSubjectType;
  voucherCount: number;
};

export type AccountingPeriodCloseFinancialStatementLineSnapshot = {
  amount: number;
  itemName: string;
  openingAmount?: number;
  section: string;
  sourceSubjectCodes: string[];
  sourceSubjectCount: number;
  yearToDateAmount?: number;
};

export type AccountingPeriodCloseCashFlowLineSnapshot = {
  activity: string;
  amount: number;
  itemName: string;
  sourceSubjectCodes: string[];
  sourceSubjectCount: number;
  voucherCount: number;
  voucherNos: string[];
  yearToDateAmount?: number;
};

export type AccountingPeriodCloseCashFlowMappingGapSnapshot = {
  amount: number;
  cashSubjectCodes: string[];
  counterpartySubjectCodes: string[];
  reason: string;
  voucherDate: string;
  voucherNo: string;
};

export type AccountingPeriodCloseFinancialStatementSnapshot = {
  accountingPeriod: string;
  assetTotal: number;
  balanceSheetDifference: number;
  balanceSheetLines: AccountingPeriodCloseFinancialStatementLineSnapshot[];
  balanceSheetReadiness: string;
  balanceSheetReadinessDetail: string;
  cashFlowClosingBalance?: number;
  cashFlowLines: AccountingPeriodCloseCashFlowLineSnapshot[];
  cashFlowMappingGaps: AccountingPeriodCloseCashFlowMappingGapSnapshot[];
  cashFlowNetAmount: number;
  cashFlowOpeningBalance?: number;
  cashFlowReadiness: string;
  cashFlowReadinessDetail: string;
  cashFlowReconciliationDifference?: number;
  cashFlowYearToDateClosingBalance?: number;
  cashFlowYearToDateNetAmount?: number;
  cashFlowYearToDateOpeningBalance?: number;
  cashFlowYearToDateReconciliationDifference?: number;
  financialStatementReadiness: string;
  financialStatementReadinessDetail: string;
  liabilityEquityTotal: number;
  periodLabel: string;
  profitLines: AccountingPeriodCloseFinancialStatementLineSnapshot[];
  profitTotal: number;
  reportBasis: string;
  trialBalanceStatus: string;
};

export type AccountingPeriodCloseSummarySnapshot = {
  blockedCheckCount: number;
  bookedVoucherCount: number;
  creditTotal: number;
  debitTotal: number;
  financialStatementReport?: AccountingPeriodCloseFinancialStatementSnapshot;
  generalLedgerRows?: AccountingPeriodCloseGeneralLedgerRowSnapshot[];
  readyToBookVoucherCount: number;
  generatedVoucherCount: number;
  issueVoucherCount: number;
  pendingVoucherCount: number;
  pendingReviewCashFlowCount: number;
  socialInsurancePendingCount: number;
  trialBalanceDifference: number;
  trialBalanceStatus: string;
  unbookedVoucherCount: number;
  unreconciledCashFlowCount: number;
  voucherCount: number;
};

export type AccountingPeriodLockRecord = {
  accountingPeriod: string;
  closeCheckSnapshot?: AccountingPeriodCloseCheckSnapshotItem[];
  closeSummarySnapshot?: AccountingPeriodCloseSummarySnapshot;
  lockedAt?: string;
  lockedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  reason?: string;
  status: AccountingPeriodLockStatus;
};

export type AccountingPeriodReopenInput = {
  reason: string;
  reopenedAt: string;
  reopenedBy: string;
};

export type AccountingPeriodOpenGuard = {
  allowed: boolean;
  errorCode?: 'CLOSED_ACCOUNTING_PERIOD';
  lock?: AccountingPeriodLockRecord;
  reason?: string;
};

export type AccountingVoucherReversalInput = {
  reason: string;
  reversedAt: string;
};

export type AccountingVoucherLaterPeriodAdjustmentInput = {
  accountingPeriod: string;
  adjustmentMode?: '冲销原凭证' | '差额调整';
  adjustedAt: string;
  correctionContext?: {
    batchId: string;
    issueId: string;
    recordId: string;
  };
  reason: string;
  signedAmount?: number;
};

export type AccountingVoucherLaterPeriodAdjustmentRecord = {
  accountingPeriod: string;
  adjustedAt: string;
  adjustedBy: string;
  adjustmentNo: string;
  amount: number;
  adjustmentMode: '冲销原凭证' | '差额调整';
  candidateStatus: '待记账' | '已记账';
  id: string;
  originalAccountingPeriod: string;
  originalVoucherId: string;
  originalVoucherNo: string;
  correctionContext?: {
    batchId: string;
    issueId: string;
    recordId: string;
  };
  reason: string;
  snapshot: AccountingVoucherRecord;
  signedAmount: number;
};

export type AccountingLedgerEntry = {
  accountingPeriod: string;
  auxiliary: string;
  creditAmount: number;
  debitAmount: number;
  voucherNo: string;
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
export const accountingVoucherStatusOptions: AccountingVoucherStatus[] = ['待生成', '需处理', '待记账', '已记账', '已冲销'];
export const closedAccountingPeriodErrorCode = 'CLOSED_ACCOUNTING_PERIOD';

export const accountingVoucherIssueLabels: Record<AccountingVoucherIssueCode, string> = {
  amount_invalid: '金额无效',
  bank_amount_mismatch: '银行金额不一致',
  bank_reconciliation_source_missing: '缺少银行对账依据',
  missing_accounting_subject: '缺少会计科目',
  missing_original_evidence: '缺少原始凭证',
  missing_source_document: '来源单据不完整',
  period_mismatch: '期间不一致',
  reversal_required: '需冲销处理',
  tax_amount_missing: '发票税额缺失',
  tax_basis_pending: '税额依据待确认',
  tax_payment_allocation_missing: '税费缴款分项缺失',
  tax_declaration_evidence_pending: '申报材料未核验',
  vat_liability_mismatch: '增值税申报额与账面负债不一致',
  unbalanced_entries: '借贷不平'
};

export const defaultAccountingVoucherFilters: AccountingVoucherFilters = {
  accountingPeriodTime: { mode: 'currentMonth' },
  businessType: '全部',
  keyword: '',
  status: '全部'
};

const accountingVoucherFilterStatuses = new Set<string>(['全部', ...accountingVoucherStatusOptions]);
const accountingVoucherFilterBusinessTypes = new Set<string>(['全部', '权责凭证', '资金凭证', '税费凭证', '调整凭证', '冲销凭证']);
const accountingPeriodPattern = /^\d{4}-\d{2}$/;
const acceptableEvidenceStatuses = new Set(['已上传', '已归档', '已生成', '已发布']);
const moneyTolerance = 0.01;
const openingAdjustmentOffsetSubjectCode = '3104';
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

function getAccountingPeriodOrdinal(accountingPeriod: string) {
  const match = accountingPeriod.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return Number.NaN;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return Number.NaN;
  }

  return year * 12 + month;
}

export function compareAccountingPeriods(left: string, right: string) {
  return getAccountingPeriodOrdinal(left) - getAccountingPeriodOrdinal(right);
}

function getSearchParamValue(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();

  return value ? value : undefined;
}

function normalizeAccountingVoucherFilterStatus(value?: string): AccountingVoucherFilters['status'] | undefined {
  return value && accountingVoucherFilterStatuses.has(value)
    ? value as AccountingVoucherFilters['status']
    : undefined;
}

function normalizeAccountingVoucherBusinessType(value?: string): AccountingVoucherFilters['businessType'] | undefined {
  return value && accountingVoucherFilterBusinessTypes.has(value)
    ? value as AccountingVoucherFilters['businessType']
    : undefined;
}

export function getAccountingVoucherFiltersFromQueryString(
  queryString: string,
  fallback: AccountingVoucherFilters = defaultAccountingVoucherFilters
): AccountingVoucherFilters {
  const params = new URLSearchParams(queryString);
  const period = getSearchParamValue(params, 'period');
  const sourceNo = getSearchParamValue(params, 'sourceNo');
  const voucherNo = getSearchParamValue(params, 'voucherNo');
  const keyword = getSearchParamValue(params, 'keyword') ?? sourceNo ?? voucherNo ?? fallback.keyword;
  const status = normalizeAccountingVoucherFilterStatus(getSearchParamValue(params, 'status')) ?? fallback.status;
  const businessType = normalizeAccountingVoucherBusinessType(getSearchParamValue(params, 'businessType')) ?? fallback.businessType;

  return {
    accountingPeriodTime: period && accountingPeriodPattern.test(period)
      ? { mode: 'month', month: period }
      : fallback.accountingPeriodTime,
    businessType,
    keyword,
    status
  };
}

export function getAccountingVoucherDeepLinkTargetId(rows: AccountingVoucherRecord[], queryString: string) {
  const params = new URLSearchParams(queryString);
  const voucherId = getSearchParamValue(params, 'voucherId');
  const sourceNo = getSearchParamValue(params, 'sourceNo');
  const voucherNo = getSearchParamValue(params, 'voucherNo');
  const status = normalizeAccountingVoucherFilterStatus(getSearchParamValue(params, 'status'));
  const period = getSearchParamValue(params, 'period');

  if (voucherId && rows.some((record) => record.id === voucherId)) {
    return voucherId;
  }

  const matchingRows = rows.filter((record) => {
    if (period && record.accountingPeriod !== period) {
      return false;
    }

    if (status && status !== '全部' && record.status !== status) {
      return false;
    }

    if (sourceNo && record.sourceNo !== sourceNo) {
      return false;
    }

    if (voucherNo && record.voucherNo !== voucherNo) {
      return false;
    }

    return Boolean(sourceNo || voucherNo || status);
  });

  return matchingRows[0]?.id;
}

export function getNextAccountingPeriod(accountingPeriod: string) {
  const match = accountingPeriod.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return accountingPeriod;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export function getFirstOpenAccountingPeriod(
  periodLocks: AccountingPeriodLockRecord[],
  requestedPeriod: string
) {
  const closedPeriods = new Set(
    periodLocks
      .filter((record) => record.status === '已结账')
      .map((record) => record.accountingPeriod)
  );
  let accountingPeriod = requestedPeriod;

  while (closedPeriods.has(accountingPeriod)) {
    accountingPeriod = getNextAccountingPeriod(accountingPeriod);
  }

  return accountingPeriod;
}

export function assignTaxFilingAdjustmentAccountingPeriod(
  record: FinanceTaxMatterRecord,
  periodLocks: AccountingPeriodLockRecord[]
) {
  let historyChanged = false;
  const declarationHistory = record.declarationHistory.map((declaration) => {
    if (
      declaration.filingAdjustmentAccountingPeriod
      || !declaration.declarationDate
      || !['申报成功', '零申报'].includes(declaration.declarationStatus)
    ) {
      return declaration;
    }

    historyChanged = true;
    return {
      ...declaration,
      filingAdjustmentAccountingPeriod: getFirstOpenAccountingPeriod(
        periodLocks,
        declaration.declarationDate.slice(0, 7)
      )
    };
  });

  if (
    record.filingAdjustmentAccountingPeriod
    || !record.declarationDate
    || !['申报成功', '零申报'].includes(record.declarationStatus)
  ) {
    return historyChanged ? { ...record, declarationHistory } : record;
  }

  return {
    ...record,
    declarationHistory,
    filingAdjustmentAccountingPeriod: getFirstOpenAccountingPeriod(
      periodLocks,
      record.declarationDate.slice(0, 7)
    )
  };
}

export function getDefaultLaterPeriodAdjustmentAccountingPeriod(record: AccountingVoucherRecord) {
  return getNextAccountingPeriod(record.accountingPeriod);
}

export function getDefaultLaterPeriodAdjustmentDate(record: AccountingVoucherRecord) {
  return `${getDefaultLaterPeriodAdjustmentAccountingPeriod(record)}-01`;
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

function shouldKeepAccrualUpstream(sourceIssues: AccountingVoucherIssueCode[]) {
  return sourceIssues.some((issue) => pendingAccrualGenerationIssues.has(issue));
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

function summarizeInvoiceAllocations(allocations: FinanceInvoiceBusinessAllocation[]) {
  return allocations.reduce(
    (summary, allocation) => ({
      taxAmount: roundMoney(summary.taxAmount + allocation.taxAmount),
      taxExcludedAmount: roundMoney(summary.taxExcludedAmount + allocation.taxExcludedAmount),
      taxIncludedAmount: roundMoney(summary.taxIncludedAmount + allocation.taxIncludedAmount)
    }),
    { taxAmount: 0, taxExcludedAmount: 0, taxIncludedAmount: 0 }
  );
}

function getReceivablePayableInvoiceRows(
  record: FinanceReceivablePayableRecord,
  invoiceRows: FinanceInvoiceRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]
) {
  const expectedDirection: FinanceInvoiceRecord['direction'] = record.direction === '应收' ? '销项' : '进项';
  const relatedInvoiceIds = new Set(
    invoiceBusinessAllocationRows
      .filter((allocation) => (
        allocation.status === '有效' &&
        allocation.targetType === '应收应付' &&
        allocation.targetId === record.id &&
        allocation.taxIncludedAmount > moneyTolerance
      ))
      .map((allocation) => allocation.invoiceId)
  );

  return invoiceRows.filter((invoice) => (
    invoice.direction === expectedDirection &&
    invoice.invoiceStatus === '正常' &&
    invoice.accountingPeriod <= record.accountingPeriod &&
    relatedInvoiceIds.has(invoice.id)
  ));
}

function getReceivablePayableInvoiceIssueReasons(
  record: FinanceReceivablePayableRecord,
  invoiceRows: FinanceInvoiceRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]
) {
  const issues: AccountingVoucherIssueCode[] = [];
  const normalInvoices = invoiceRows.filter((invoice) => invoice.invoiceStatus === '正常' && invoice.invoiceColor === '蓝票');
  const invoiceSummary = summarizeInvoiceAllocations(
    invoiceBusinessAllocationRows.filter((allocation) => (
      allocation.status === '有效' &&
      allocation.targetType === '应收应付' &&
      allocation.targetId === record.id &&
      allocation.taxIncludedAmount > moneyTolerance
    ))
  );
  const taxBasis = resolveFinanceAccrualTaxBasis(record, invoiceRows, invoiceBusinessAllocationRows);

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

function getTransactionIssueReasons(
  record: FinanceTransactionRecord,
  bankReconciliationLinks: FinanceBankReconciliationLinkRecord[] = []
) {
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

  if (record.reconciliationStatus === '已对账' && bankReconciliationLinks.length === 0) {
    addIssue(issues, 'bank_reconciliation_source_missing');
  }

  if (
    record.sourceType === '税费事项' &&
    (record.sourceTitle.includes('增值税') || record.sourceNo.includes('VAT')) &&
    (!record.taxPaymentAllocations || Math.abs(
      record.taxPaymentAllocations.reduce((total, allocation) => total + allocation.amount, 0) - record.amount
    ) > moneyTolerance)
  ) {
    addIssue(issues, 'tax_payment_allocation_missing');
  }

  return issues;
}

function isTaxAccrualPreparationReady(
  record: FinanceTaxMatterRecord,
  preparation?: FinanceDeclarationPreparationRecord
) {
  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return record.sourceItems.every((item) => ['已确认', '不适用'].includes(item.status));
  }

  if (record.matterType === '个人所得税') {
    return true;
  }

  if (!preparation) {
    return record.dataStatus === '已确认';
  }

  if (preparation.taxType !== record.matterType) {
    return false;
  }

  return preparation.items.every((item) => (
    item.status !== '待确认' || (
      preparation.taxType === '企业所得税' &&
      preparation.declarationScenario === '季度预缴' &&
      item.type === '季度账务完整性检查'
    )
  ));
}

function getTaxAccrualIssueReasons(
  record: FinanceTaxMatterRecord,
  preparation?: FinanceDeclarationPreparationRecord
) {
  const issues: AccountingVoucherIssueCode[] = [];

  if (
    hasBlankSourceValue(record.matterNo) ||
    hasBlankSourceValue(record.title) ||
    hasBlankSourceValue(record.period)
  ) {
    addIssue(issues, 'missing_source_document');
  }

  if (!isTaxAccrualPreparationReady(record, preparation)) {
    addIssue(issues, 'tax_basis_pending');
  }

  return issues;
}

function getTaxFilingAdjustmentIssueReasons(
  record: FinanceTaxMatterRecord,
  declaration: Pick<
    FinanceTaxMatterRecord,
    | 'declarationDate'
    | 'declarationFormFileIds'
    | 'declarationResultFileId'
    | 'declarationStatus'
    | 'declarationVerificationStatus'
  >
) {
  const issues: AccountingVoucherIssueCode[] = [];

  if (
    hasBlankSourceValue(record.matterNo) ||
    hasBlankSourceValue(record.title) ||
    hasBlankSourceValue(record.period) ||
    !declaration.declarationDate
  ) {
    addIssue(issues, 'missing_source_document');
  }

  if (getTaxMatterEvidenceStatus({
    declarationFormFileIds: declaration.declarationFormFileIds,
    declarationResultFileId: declaration.declarationResultFileId,
    declarationVerificationStatus: declaration.declarationVerificationStatus,
    declarationStatus: declaration.declarationStatus,
    matterType: record.matterType
  }) !== '已齐全') {
    addIssue(issues, 'tax_declaration_evidence_pending');
  }

  return issues;
}

function getRedInvoiceIssueReasons(
  invoice: FinanceInvoiceRecord,
  invoiceRows: FinanceInvoiceRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]
) {
  const issues: AccountingVoucherIssueCode[] = [];
  const originalInvoice = invoice.originalInvoiceId
    ? invoiceRows.find((candidate) => candidate.id === invoice.originalInvoiceId)
    : undefined;
  const allocatedAmount = invoiceBusinessAllocationRows
    .filter((allocation) => allocation.status === '有效' && allocation.invoiceId === invoice.id)
    .reduce((total, allocation) => total + Math.abs(allocation.taxIncludedAmount), 0);

  if (invoice.invoiceColor === '红票' && !originalInvoice) {
    addIssue(issues, 'reversal_required');
  }

  if (invoice.invoiceColor === '红票' && allocatedAmount + moneyTolerance < Math.abs(invoice.taxIncludedAmount)) {
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
    status: issueReasons.length > 0 ? '需处理' : '待记账'
  };
}

function finalizeTaxMatterVoucher(
  record: AccountingVoucherRecordDraft,
  sourceIssues: AccountingVoucherIssueCode[]
): AccountingVoucherRecord {
  const finalized = finalizeAccountingVoucher(record, sourceIssues);
  const waitingForTaxBasis = finalized.issueReasons.every((issue) => (
    issue === 'tax_basis_pending' || issue === 'amount_invalid'
  )) && finalized.issueReasons.includes('tax_basis_pending');

  if (waitingForTaxBasis) {
    return {
      ...finalized,
      issueReasons: ['tax_basis_pending'],
      status: '待生成'
    };
  }

  return finalized;
}

function finalizeReceivablePayableVoucher(
  record: AccountingVoucherRecordDraft,
  sourceIssues: AccountingVoucherIssueCode[]
): AccountingVoucherRecord {
  return finalizeAccountingVoucher(record, sourceIssues);
}

function getPayableExpenseSubjectCode(record: FinanceReceivablePayableRecord) {
  return getFinanceCategoryAccountingSubjectCode(record.category, 'accrualExpense') ?? '';
}

function getPayableLiabilitySubjectCode(record: FinanceReceivablePayableRecord) {
  return getFinanceCategoryAccountingSubjectCode(record.category, 'accrualPayable') ?? '';
}

function getCashReceiptCreditSubjectCode(record: FinanceTransactionRecord) {
  if (record.sourceType === '税费事项' && record.category === '税费退还') {
    return getTaxPaymentDebitSubjectCode(record);
  }

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
  企业所得税: { credit: '2221.02', debit: '5801' },
  公积金缴纳: { credit: '2211.04', debit: '5602.02' },
  其他税费: { credit: '2221.99', debit: '5403' },
  印花税: { credit: '2221.05', debit: '5403' },
  增值税及附加: { credit: '2221.04', debit: '5403' },
  社保缴纳: { credit: '2211.03', debit: '5602.02' }
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

function getTaxMatterAccountingPeriod(record: FinanceTaxMatterRecord) {
  return getAccountingPeriodFromBusinessPeriod(record.period) ?? record.updatedAt.slice(0, 7);
}

function getTaxMatterVoucherPeriodCode(record: FinanceTaxMatterRecord) {
  return getTaxMatterAccountingPeriod(record).replace(/[^0-9]/g, '');
}

function getAccountingPeriodEndDate(accountingPeriod: string) {
  const [yearText, monthText] = accountingPeriod.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = new Date(year, month, 0).getDate();

  return `${accountingPeriod}-${String(day).padStart(2, '0')}`;
}

function getTaxPreparationForMatter(
  record: FinanceTaxMatterRecord,
  preparationRows: FinanceDeclarationPreparationRecord[] = []
) {
  return preparationRows.find((preparation) => (
    preparation.taxType === record.matterType &&
    preparation.period === record.period &&
    (!record.declarationScenario || preparation.declarationScenario === record.declarationScenario)
  ));
}

function getPreparedVatSettlement(
  record: FinanceTaxMatterRecord,
  preparation?: FinanceDeclarationPreparationRecord
) {
  if (preparation?.taxType !== '增值税及附加') {
    return record.vatSettlement;
  }

  const summary = preparation.confirmedVatSummary ?? preparation.vatSummary;

  return {
    declaredVatAmount: summary.estimatedVatAfterExemption,
    sourceRecognizedVatAmount: summary.sourceRecognizedVatAmount,
    surcharge: summary.surchargeBreakdown,
    totalPayableAmount: summary.estimatedTotalTaxAmount
  };
}

function getTaxAccrualAmount(
  record: FinanceTaxMatterRecord,
  preparation?: FinanceDeclarationPreparationRecord
) {
  if (record.matterType === '个人所得税') {
    return 0;
  }

  if (record.matterType === '企业所得税') {
    if (record.declarationScenario === '年度汇算') {
      return 0;
    }

    const summary = preparation?.taxType === '企业所得税'
      ? preparation.confirmedCitSummary ?? preparation.citSummary
      : undefined;

    return roundMoney(
      summary
        ? summary.currentPeriodPayableAmount - summary.overpaidTaxAmount
        : record.preparedPayableAmount - (record.preparedRefundableAmount ?? 0)
    );
  }

  if (record.matterType === '印花税') {
    const summary = preparation?.taxType === '印花税'
      ? preparation.confirmedStampDutySummary ?? preparation.stampDutySummary
      : undefined;

    return roundMoney(summary?.estimatedPayableAmount ?? record.preparedPayableAmount);
  }

  if (record.matterType === '增值税及附加') {
    const settlement = getPreparedVatSettlement(record, preparation);

    return settlement
      ? roundMoney(
          settlement.declaredVatAmount -
          settlement.sourceRecognizedVatAmount +
          settlement.surcharge.totalAfterReduction
        )
      : 0;
  }

  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return roundMoney(record.socialInsuranceSettlement?.companyAmount ?? 0);
  }

  return roundMoney(record.preparedPayableAmount - (record.preparedRefundableAmount ?? 0));
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

function getOppositeVoucherLineSide(side: AccountingVoucherLineSide): AccountingVoucherLineSide {
  return side === '借方' ? '贷方' : '借方';
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

function createSalaryPayableLines(record: FinanceReceivablePayableRecord) {
  const settlement = record.salarySettlement;

  if (!settlement) {
    return [];
  }

  const creditLines = [
    {
      amount: settlement.employeeNetPayableAmount,
      id: 'employee-net-payable',
      subjectCode: '2211.01',
      summary: `${record.sourceTitle} 员工实发`
    },
    {
      amount: settlement.withheldPersonalIncomeTaxAmount,
      id: 'withheld-iit',
      subjectCode: '2221.03',
      summary: `${record.sourceTitle} 代扣个人所得税`
    },
    {
      amount: settlement.employeeSocialInsuranceAmount,
      id: 'employee-social-insurance',
      subjectCode: '2211.03',
      summary: `${record.sourceTitle} 个人社保`
    },
    {
      amount: settlement.employeeHousingFundAmount,
      id: 'employee-housing-fund',
      subjectCode: '2211.04',
      summary: `${record.sourceTitle} 个人公积金`
    }
  ].filter((line) => line.amount > moneyTolerance);

  const employerContributionLines = [
    {
      amount: settlement.employerSocialInsuranceAmount,
      id: 'employer-social-insurance',
      subjectCode: '2211.03',
      summary: `${record.sourceTitle} 单位社保`
    },
    {
      amount: settlement.employerHousingFundAmount,
      id: 'employer-housing-fund',
      subjectCode: '2211.04',
      summary: `${record.sourceTitle} 单位公积金`
    }
  ].filter((line) => line.amount > moneyTolerance);

  return [
    createVoucherLine({
      amount: settlement.employeeGrossPayableAmount,
      auxiliary: record.sourceNo,
      id: `${record.id}-debit-salary-expense`,
      side: '借方',
      subjectCode: getPayableExpenseSubjectCode(record),
      summary: `${record.sourceTitle} 工资费用`
    }),
    ...employerContributionLines.map((line) => createVoucherLine({
      amount: line.amount,
      auxiliary: record.counterparty,
      id: `${record.id}-debit-${line.id}`,
      side: '借方',
      subjectCode: '5602.02',
      summary: line.summary
    })),
    ...creditLines.map((line) => createVoucherLine({
      amount: line.amount,
      auxiliary: record.counterparty,
      id: `${record.id}-credit-${line.id}`,
      side: '贷方',
      subjectCode: line.subjectCode,
      summary: line.summary
    })),
    ...employerContributionLines.map((line) => createVoucherLine({
      amount: line.amount,
      auxiliary: record.counterparty,
      id: `${record.id}-credit-${line.id}`,
      side: '贷方',
      subjectCode: line.subjectCode,
      summary: line.summary
    }))
  ];
}

export function buildAccountingVoucherFromReceivablePayable(
  record: FinanceReceivablePayableRecord,
  index: number,
  invoiceRows: FinanceInvoiceRecord[] = [],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[] = []
): AccountingVoucherRecord | undefined {
  const relatedInvoices = getReceivablePayableInvoiceRows(record, invoiceRows, invoiceBusinessAllocationRows);
  const invoiceRefs = relatedInvoices.map(createInvoiceRef);
  const taxBasis = resolveFinanceAccrualTaxBasis(record, relatedInvoices, invoiceBusinessAllocationRows);

  if (!isFinanceReceivablePayableConfirmed(record) || isFinanceReceivablePayableVoided(record)) {
    return undefined;
  }

  const voucherNo = `VCH-${record.accountingPeriod.replace('-', '')}-B${String(index + 1).padStart(3, '0')}`;
  const sourceSummaryPrefix = record.sourceType.endsWith('确认') ? record.sourceType : `${record.sourceType}确认`;
  const common = {
    accountingPeriod: record.accountingPeriod,
    amount: record.salarySettlement?.totalEmploymentCostAmount ?? record.amount,
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
    summary: `${sourceSummaryPrefix}：${record.sourceTitle}`,
    taxBasis,
    voucherDate: record.confirmDate,
    voucherNo
  };
  const sourceIssues = [
    ...getReceivablePayableReadinessIssueReasons(record, taxBasis),
    ...getReceivablePayableIssueReasons(record),
    ...getReceivablePayableInvoiceIssueReasons(record, relatedInvoices, invoiceBusinessAllocationRows)
  ];

  if (shouldKeepAccrualUpstream(sourceIssues)) {
    return undefined;
  }

  if (record.direction === '应收') {
    return finalizeReceivablePayableVoucher(
      {
        ...common,
        lines: createReceivableLines(record, taxBasis)
      },
      sourceIssues
    );
  }

  if (record.sourceType === '薪酬发放' && record.salarySettlement) {
    return finalizeReceivablePayableVoucher(
      {
        ...common,
        lines: createSalaryPayableLines(record)
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

export function buildAccountingVoucherFromTransaction(
  record: FinanceTransactionRecord,
  index: number,
  bankReconciliationRows: FinanceBankReconciliationLinkRecord[] = [],
  originTransaction?: FinanceTransactionRecord
): AccountingVoucherRecord | undefined {
  if (record.status !== '已入账') {
    return undefined;
  }

  const isAdjustment = isAdjustmentTransaction(record);
  const bankReconciliationLinks = getBankReconciliationLinksForTransaction(record, bankReconciliationRows);
  const sourceRefs: AccountingVoucherSourceRef[] = [
    createSourceRef('收支流水', record.id, record.transactionNo, '主来源'),
    ...bankReconciliationLinks.map((link) =>
      createSourceRef('银行对账', link.bankStatementId, link.bankSerialNo, '银行依据')
    )
  ];
  const voucherNo = `VCH-${record.accountingPeriod.replace('-', '')}-${isAdjustment ? 'A' : 'C'}${String(index + 1).padStart(3, '0')}`;
  const bankSubjectCode = '1002';
  const naturalPersonPayment = record.naturalPersonPayment;
  const reversedNaturalPersonPayment = record.adjustmentContext?.mode === '冲正'
    && originTransaction?.naturalPersonPayment?.incomeType === '劳务报酬'
    ? originTransaction.naturalPersonPayment
    : undefined;
  const voucherAmount = reversedNaturalPersonPayment?.grossIncomeAmount
    ?? naturalPersonPayment?.grossIncomeAmount
    ?? record.amount;
  const common = {
    accountingPeriod: record.accountingPeriod,
    amount: voucherAmount,
    businessType: isAdjustment ? '调整凭证' as const : '资金凭证' as const,
    counterparty: record.counterparty,
    id: `voucher-cash-${record.id}`,
    invoiceRefs: [],
    kind: getVoucherKindForTransactionDirection(record.direction),
    sourceModule: '收支流水' as const,
    sourceNo: record.transactionNo,
    sourceRefs: originTransaction
      ? [
          ...sourceRefs,
          createSourceRef('收支流水', originTransaction.id, originTransaction.transactionNo, '冲销依据')
        ]
      : sourceRefs,
    sourceTitle: record.sourceTitle,
    sourceType: '收付款' as const,
    summary: isAdjustment
      ? `${record.adjustmentContext?.mode ?? '调整'}确认：${record.sourceTitle}`
      : `${record.direction === '收入' ? '收款确认' : '付款确认'}：${record.sourceTitle}`,
    voucherDate: record.occurredAt,
    voucherNo
  };
  const sourceIssues = getTransactionIssueReasons(record, bankReconciliationLinks);

  if (reversedNaturalPersonPayment && originTransaction) {
    return finalizeAccountingVoucher(
      {
        ...common,
        lines: [
          createVoucherLine({
            amount: reversedNaturalPersonPayment.netPaymentAmount,
            auxiliary: record.publicAccountSnapshot.displayName,
            id: `${record.id}-debit-bank-reversal`,
            side: '借方',
            subjectCode: bankSubjectCode,
            summary: `${originTransaction.sourceTitle} 银行实付冲正`
          }),
          createVoucherLine({
            amount: reversedNaturalPersonPayment.withheldTaxAmount,
            auxiliary: originTransaction.counterparty,
            id: `${record.id}-debit-labor-iit-reversal`,
            side: '借方',
            subjectCode: '2221.03',
            summary: `${originTransaction.sourceTitle} 代扣个人所得税冲正`
          }),
          createVoucherLine({
            amount: reversedNaturalPersonPayment.grossIncomeAmount,
            auxiliary: originTransaction.counterparty,
            id: `${record.id}-credit-labor-payable-reversal`,
            side: '贷方',
            subjectCode: getCashPaymentDebitSubjectCode(originTransaction),
            summary: `${originTransaction.sourceTitle} 税前劳务应付冲正`
          })
        ]
      },
      sourceIssues
    );
  }

  if (
    record.adjustmentContext?.mode === '冲正'
    && originTransaction
    && (originTransaction.sourceType === '税费事项' || originTransaction.accountingAllocations?.length)
  ) {
    const reversedTaxLines = (
      originTransaction.accountingAllocations?.map((allocation) => ({
        ...allocation,
        taxType: allocation.label
      }))
      ?? originTransaction.taxPaymentAllocations
    )?.map((allocation, allocationIndex) => (
      createVoucherLine({
        amount: allocation.amount,
        auxiliary: allocation.taxType,
        id: `${record.id}-${originTransaction.direction === '收入' ? 'debit' : 'credit'}-tax-reversal-${allocationIndex + 1}`,
        side: originTransaction.direction === '收入' ? '借方' : '贷方',
        subjectCode: allocation.subjectCode,
        summary: `${originTransaction.sourceTitle} ${allocation.taxType}冲正`
      })
    ));
    const reversedSettlementLines = reversedTaxLines?.length
      ? reversedTaxLines
      : [createVoucherLine({
          amount: record.amount,
          auxiliary: originTransaction.counterparty,
          id: `${record.id}-tax-settlement-reversal`,
          side: originTransaction.direction === '收入' ? '借方' : '贷方',
          subjectCode: originTransaction.direction === '收入'
            ? getCashReceiptCreditSubjectCode(originTransaction)
            : getCashPaymentDebitSubjectCode(originTransaction),
          summary: `${originTransaction.sourceTitle}冲正`
        })];
    const bankLine = createVoucherLine({
      amount: record.amount,
      auxiliary: record.publicAccountSnapshot.displayName,
      id: `${record.id}-bank-reversal`,
      side: originTransaction.direction === '收入' ? '贷方' : '借方',
      subjectCode: bankSubjectCode,
      summary: `${originTransaction.sourceTitle}银行流水冲正`
    });

    return finalizeAccountingVoucher(
      {
        ...common,
        lines: originTransaction.direction === '收入'
          ? [...reversedSettlementLines, bankLine]
          : [bankLine, ...reversedSettlementLines]
      },
      sourceIssues
    );
  }

  const taxSettlementLines = (
    record.accountingAllocations?.map((allocation) => ({
      ...allocation,
      taxType: allocation.label
    }))
    ?? record.taxPaymentAllocations
  )?.map((allocation, allocationIndex) => (
    createVoucherLine({
      amount: allocation.amount,
      auxiliary: allocation.taxType,
      id: `${record.id}-${record.direction === '收入' ? 'credit' : 'debit'}-tax-${allocationIndex + 1}`,
      side: record.direction === '收入' ? '贷方' : '借方',
      subjectCode: allocation.subjectCode,
      summary: `${record.sourceTitle} ${allocation.taxType}`
    })
  ));

  if (record.direction === '收入') {
    return finalizeAccountingVoucher(
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
          ...(taxSettlementLines?.length
            ? taxSettlementLines
            : [
                createVoucherLine({
                  amount: record.amount,
                  auxiliary: record.counterparty,
                  id: `${record.id}-credit`,
                  side: '贷方',
                  subjectCode: getCashReceiptCreditSubjectCode(record),
                  summary: record.sourceTitle
                })
              ])
        ]
      },
      sourceIssues
    );
  }

  const taxPaymentDebitLines = taxSettlementLines;

  if (naturalPersonPayment?.incomeType === '劳务报酬') {
    return finalizeAccountingVoucher(
      {
        ...common,
        lines: [
          createVoucherLine({
            amount: naturalPersonPayment.grossIncomeAmount,
            auxiliary: record.counterparty,
            id: `${record.id}-debit-labor-payable`,
            side: '借方',
            subjectCode: getCashPaymentDebitSubjectCode(record),
            summary: `${record.sourceTitle} 税前劳务结算`
          }),
          createVoucherLine({
            amount: naturalPersonPayment.netPaymentAmount,
            auxiliary: record.publicAccountSnapshot.displayName,
            id: `${record.id}-credit-bank`,
            side: '贷方',
            subjectCode: bankSubjectCode,
            summary: `${record.sourceTitle} 银行实付`
          }),
          createVoucherLine({
            amount: naturalPersonPayment.withheldTaxAmount,
            auxiliary: record.counterparty,
            id: `${record.id}-credit-labor-iit`,
            side: '贷方',
            subjectCode: '2221.03',
            summary: `${record.sourceTitle} 代扣个人所得税`
          })
        ]
      },
      sourceIssues
    );
  }

  return finalizeAccountingVoucher(
    {
      ...common,
      lines: [
        ...(taxPaymentDebitLines && taxPaymentDebitLines.length > 0
          ? taxPaymentDebitLines
          : [createVoucherLine({
              amount: record.amount,
              auxiliary: record.counterparty,
              id: `${record.id}-debit`,
              side: '借方',
              subjectCode: getCashPaymentDebitSubjectCode(record),
              summary: record.sourceTitle
            })]),
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

function buildAccountingVoucherFromRedInvoice(
  invoice: FinanceInvoiceRecord,
  index: number,
  invoiceRows: FinanceInvoiceRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[],
  receivablePayableRows: FinanceReceivablePayableRecord[]
): AccountingVoucherRecord | undefined {
  const sourceIssues = getRedInvoiceIssueReasons(invoice, invoiceRows, invoiceBusinessAllocationRows);
  const originalInvoice = invoice.originalInvoiceId
    ? invoiceRows.find((candidate) => candidate.id === invoice.originalInvoiceId)
    : undefined;
  const redAllocations = invoiceBusinessAllocationRows.filter(
    (allocation) => allocation.status === '有效' && allocation.invoiceId === invoice.id && allocation.taxIncludedAmount < -moneyTolerance
  );
  const businessAllocations = redAllocations.filter((allocation) => allocation.targetType === '应收应付');
  const targetById = new Map(receivablePayableRows.map((record) => [record.id, record]));
  const targetRows = businessAllocations.map((allocation) => ({ allocation, record: targetById.get(allocation.targetId) }));

  if (targetRows.some((row) => !row.record) || businessAllocations.length !== redAllocations.length) {
    addIssue(sourceIssues, 'reversal_required');
  }

  const voucherNo = `VCH-${invoice.accountingPeriod.replace('-', '')}-I${String(index + 1).padStart(3, '0')}`;
  const invoiceAmount = Math.abs(invoice.taxIncludedAmount || invoice.totalAmount);
  const lines = targetRows.flatMap(({ allocation, record }) => {
    if (!record) {
      return [];
    }

    const grossAmount = Math.abs(allocation.taxIncludedAmount);
    const netAmount = Math.abs(allocation.taxExcludedAmount);
    const taxAmount = Math.abs(allocation.taxAmount);

    if (record.direction === '应收') {
      return [
        createVoucherLine({
          amount: netAmount,
          auxiliary: record.sourceNo,
          id: `${invoice.id}-${allocation.id}-debit-income`,
          side: '借方',
          subjectCode: getFinanceCategoryAccountingSubjectCode(record.category, 'accrualRevenue') ?? '',
          summary: `红冲 ${record.sourceTitle}`
        }),
        ...(taxAmount > moneyTolerance ? [createVoucherLine({
          amount: taxAmount,
          auxiliary: record.sourceNo,
          id: `${invoice.id}-${allocation.id}-debit-tax`,
          side: '借方' as const,
          subjectCode: getFinanceCategoryAccountingSubjectCode(record.category, 'outputVatPayable') ?? '',
          summary: `红冲 ${record.sourceTitle} 税额`
        })] : []),
        createVoucherLine({
          amount: grossAmount,
          auxiliary: record.counterparty,
          id: `${invoice.id}-${allocation.id}-credit-receivable`,
          side: '贷方',
          subjectCode: getFinanceCategoryAccountingSubjectCode(record.category, 'accrualReceivable') ?? '',
          summary: `红冲 ${record.sourceTitle}`
        })
      ];
    }

    return [
      createVoucherLine({
        amount: grossAmount,
        auxiliary: record.counterparty,
        id: `${invoice.id}-${allocation.id}-debit-payable`,
        side: '借方',
        subjectCode: getPayableLiabilitySubjectCode(record),
        summary: `红冲 ${record.sourceTitle}`
      }),
      createVoucherLine({
        amount: grossAmount,
        auxiliary: record.sourceNo,
        id: `${invoice.id}-${allocation.id}-credit-expense`,
        side: '贷方',
        subjectCode: getPayableExpenseSubjectCode(record),
        summary: `红冲 ${record.sourceTitle}`
      })
    ];
  });

  return finalizeAccountingVoucher(
    {
      accountingPeriod: invoice.accountingPeriod,
      amount: roundMoney(invoiceAmount),
      businessType: '调整凭证',
      counterparty: invoice.counterparty,
      id: `voucher-invoice-${invoice.id}`,
      invoiceRefs: [createInvoiceRef(invoice), ...(originalInvoice ? [createInvoiceRef(originalInvoice)] : [])],
      kind: '转账凭证',
      lines,
      sourceModule: '发票台账',
      sourceNo: invoice.invoiceNo,
      sourceRefs: [
        createSourceRef('发票台账', invoice.id, invoice.invoiceNo, '主来源'),
        ...(originalInvoice ? [createSourceRef('发票台账', originalInvoice.id, originalInvoice.invoiceNo, '冲销依据')] : []),
        ...targetRows.flatMap(({ record }) => record ? [createSourceRef('应收应付', record.id, record.documentNo, '调整依据')] : [])
      ],
      sourceTitle: `${invoice.counterparty} ${invoice.invoiceColor}`,
      sourceType: '票税事实',
      summary: sourceIssues.length > 0 ? `红字发票待处理：${invoice.invoiceNo}` : `红字发票冲减：${invoice.invoiceNo}`,
      voucherDate: invoice.invoiceDate,
      voucherNo
    },
    sourceIssues
  );
}

function getTaxMatterSourceRefs(record: FinanceTaxMatterRecord): AccountingVoucherSourceRef[] {
  return [
    createSourceRef('税务办理', record.id, record.matterNo, '主来源'),
    ...record.sourceItems.map((sourceItem) => (
      createSourceRef(sourceItem.sourceModule, sourceItem.id, sourceItem.name, '申报依据')
    )),
    ...record.linkedTransactionNos.map((transactionNo) => (
      createSourceRef('收支流水', transactionNo, transactionNo, '资金结算依据')
    ))
  ];
}

function buildTaxAmountLines({
  amount,
  idPrefix,
  matterType,
  period,
  summary
}: {
  amount: number;
  idPrefix: string;
  matterType: FinanceTaxMatterType;
  period: string;
  summary: string;
}): AccountingVoucherLine[] {
  const absoluteAmount = Math.abs(amount);

  if (absoluteAmount <= moneyTolerance) {
    return [];
  }

  return [
    createVoucherLine({
      amount: absoluteAmount,
      auxiliary: period,
      id: `${idPrefix}-debit`,
      side: amount >= 0 ? '借方' : '贷方',
      subjectCode: getTaxMatterDebitSubjectCode(matterType),
      summary
    }),
    createVoucherLine({
      amount: absoluteAmount,
      auxiliary: matterType,
      id: `${idPrefix}-credit`,
      side: amount >= 0 ? '贷方' : '借方',
      subjectCode: getTaxMatterCreditSubjectCode(matterType),
      summary
    })
  ];
}

function buildVatTaxLines({
  baseline,
  current,
  idPrefix,
  period,
  summary
}: {
  baseline?: FinanceVatTaxSettlementSnapshot;
  current?: FinanceVatTaxSettlementSnapshot;
  idPrefix: string;
  period: string;
  summary: string;
}): AccountingVoucherLine[] {
  if (!current) {
    return [];
  }

  const currentVatAdjustment = roundMoney(current.declaredVatAmount - current.sourceRecognizedVatAmount);
  const baselineVatAdjustment = baseline
    ? roundMoney(baseline.declaredVatAmount - baseline.sourceRecognizedVatAmount)
    : 0;
  const vatAdjustmentDelta = roundMoney(currentVatAdjustment - baselineVatAdjustment);
  const lines: AccountingVoucherLine[] = [];

  if (Math.abs(vatAdjustmentDelta) > moneyTolerance) {
    lines.push(
      createVoucherLine({
        amount: Math.abs(vatAdjustmentDelta),
        auxiliary: period,
        id: `${idPrefix}-vat-adjustment-debit`,
        side: '借方',
        subjectCode: vatAdjustmentDelta > 0 ? '5001' : '2221.01',
        summary: `${summary}增值税差额`
      }),
      createVoucherLine({
        amount: Math.abs(vatAdjustmentDelta),
        auxiliary: period,
        id: `${idPrefix}-vat-adjustment-credit`,
        side: '贷方',
        subjectCode: vatAdjustmentDelta > 0 ? '2221.01' : '5301',
        summary: `${summary}增值税差额`
      })
    );
  }

  [
    {
      amount: roundMoney(current.surcharge.urbanMaintenanceTaxAfterReduction - (baseline?.surcharge.urbanMaintenanceTaxAfterReduction ?? 0)),
      code: '2221.04',
      name: '城市维护建设税'
    },
    {
      amount: roundMoney(current.surcharge.educationSurchargeAfterReduction - (baseline?.surcharge.educationSurchargeAfterReduction ?? 0)),
      code: '2221.06',
      name: '教育费附加'
    },
    {
      amount: roundMoney(current.surcharge.localEducationSurchargeAfterReduction - (baseline?.surcharge.localEducationSurchargeAfterReduction ?? 0)),
      code: '2221.07',
      name: '地方教育附加'
    }
  ].filter((line) => Math.abs(line.amount) > moneyTolerance).forEach((line) => {
    lines.push(
      createVoucherLine({
        amount: Math.abs(line.amount),
        auxiliary: period,
        id: `${idPrefix}-surcharge-expense-${line.code}`,
        side: line.amount >= 0 ? '借方' : '贷方',
        subjectCode: '5403',
        summary: `${summary}${line.name}`
      }),
      createVoucherLine({
        amount: Math.abs(line.amount),
        auxiliary: line.name,
        id: `${idPrefix}-surcharge-liability-${line.code}`,
        side: line.amount >= 0 ? '贷方' : '借方',
        subjectCode: line.code,
        summary: `${summary}${line.name}`
      })
    );
  });

  return lines;
}

function getVoucherAmountFromLines(lines: AccountingVoucherLine[]) {
  return roundMoney(
    lines
      .filter((line) => line.side === '借方')
      .reduce((total, line) => total + line.amount, 0)
  );
}

export function buildTaxAccrualVoucher(
  record: FinanceTaxMatterRecord,
  index: number,
  preparation?: FinanceDeclarationPreparationRecord
): AccountingVoucherRecord | undefined {
  if (record.matterType === '个人所得税' || (
    record.matterType === '企业所得税' && record.declarationScenario === '年度汇算'
  )) {
    return undefined;
  }

  const accountingPeriod = getTaxMatterAccountingPeriod(record);
  const voucherDate = getAccountingPeriodEndDate(accountingPeriod);
  const voucherNo = `VCH-${getTaxMatterVoucherPeriodCode(record)}-T${String(index + 1).padStart(3, '0')}`;
  const voucherId = `voucher-tax-${record.id}`;
  const sourceRefs: AccountingVoucherSourceRef[] = [
    createSourceRef('申报准备', preparation?.id ?? record.id, preparation?.preparationNo ?? record.matterNo, '主来源'),
    ...getTaxMatterSourceRefs(record).filter((sourceRef) => sourceRef.role === '申报依据')
  ];
  const taxMatterIssues = getTaxAccrualIssueReasons(record, preparation);
  const accrualAmount = getTaxAccrualAmount(record, preparation);
  const preparedVatSettlement = getPreparedVatSettlement(record, preparation);
  const lines = record.matterType === '增值税及附加'
    ? buildVatTaxLines({
        current: preparedVatSettlement,
        idPrefix: `${record.id}-accrual`,
        period: record.period,
        summary: `${record.title}计提`
      })
    : buildTaxAmountLines({
        amount: accrualAmount,
        idPrefix: `${record.id}-accrual`,
        matterType: record.matterType,
        period: record.period,
        summary: `${record.title}计提`
      });
  const voucherAmount = record.matterType === '增值税及附加'
    ? getVoucherAmountFromLines(lines)
    : Math.abs(accrualAmount);

  if (voucherAmount <= moneyTolerance && taxMatterIssues.length === 0) {
    return undefined;
  }

  return finalizeTaxMatterVoucher(
    {
      accountingPeriod,
      amount: voucherAmount,
      businessType: '税费凭证',
      counterparty: getTaxMatterCounterparty(record.matterType),
      id: voucherId,
      invoiceRefs: [],
      kind: '转账凭证',
      lines,
      sourceModule: '申报准备',
      sourceNo: record.matterNo,
      sourceRefs,
      sourceTitle: record.title,
      sourceType: '税费事项',
      summary: `${record.matterType}计提：${record.title}`,
      voucherDate,
      voucherNo
    },
    taxMatterIssues
  );
}

export function buildTaxFilingAdjustmentVoucher(
  record: FinanceTaxMatterRecord,
  index: number,
  preparation?: FinanceDeclarationPreparationRecord,
  declarationVersion = record.declarationVersion
): AccountingVoucherRecord | undefined {
  const filedVersions = [
    ...record.declarationHistory.filter((candidate) => candidate.action !== '作废'),
    ...(['申报成功', '零申报'].includes(record.declarationStatus)
      ? [{
          declarationDate: record.declarationDate,
          declarationFormFileIds: record.declarationFormFileIds,
          declarationResultFileId: record.declarationResultFileId,
          declarationVerificationStatus: record.declarationVerificationStatus,
          taxAuthorityDeclarationNo: record.taxAuthorityDeclarationNo,
          declarationStatus: record.declarationStatus,
          filingAdjustmentAccountingPeriod: record.filingAdjustmentAccountingPeriod,
          filedAccountingAmount: getTaxMatterAccountingAmount(record),
          filedPayableAmount: record.payableAmount,
          filedRefundableAmount: record.refundableAmount,
          filedVatSettlement: record.vatSettlement,
          version: record.declarationVersion
        } satisfies Pick<
          FinanceTaxMatterDeclarationHistoryRecord,
          | 'declarationDate'
          | 'declarationFormFileIds'
          | 'declarationResultFileId'
          | 'declarationVerificationStatus'
          | 'taxAuthorityDeclarationNo'
          | 'declarationStatus'
          | 'filingAdjustmentAccountingPeriod'
          | 'filedAccountingAmount'
          | 'filedPayableAmount'
          | 'filedRefundableAmount'
          | 'filedVatSettlement'
          | 'version'
        >]
      : [])
  ];
  const declarationIndex = filedVersions.findIndex((candidate) => candidate.version === declarationVersion);
  const declaration = filedVersions[declarationIndex];

  if (
    isSocialInsuranceTaxMatter(record.matterType) ||
    record.matterType === '个人所得税' ||
    !declaration ||
    !['申报成功', '零申报'].includes(declaration.declarationStatus) ||
    !declaration.declarationDate
  ) {
    return undefined;
  }

  const previousDeclaration = filedVersions[declarationIndex - 1];
  const previousOfficialAmount = previousDeclaration?.filedAccountingAmount;
  const accrualAmount = getTaxAccrualAmount(record, preparation);
  const officialAmount = getTaxMatterAccountingAmount({
    filedAccountingAmount: declaration.filedAccountingAmount,
    matterType: record.matterType,
    payableAmount: declaration.filedPayableAmount,
    refundableAmount: declaration.filedRefundableAmount,
    vatSettlement: declaration.filedVatSettlement
  });
  const adjustmentAmount = roundMoney(
    officialAmount - (previousOfficialAmount ?? accrualAmount)
  );
  const previousVatSettlement = previousDeclaration?.filedVatSettlement;
  const baselineVatSettlement = previousVatSettlement ?? getPreparedVatSettlement(record, preparation);
  const lines = record.matterType === '增值税及附加'
    ? buildVatTaxLines({
        baseline: baselineVatSettlement,
        current: declaration.filedVatSettlement,
        idPrefix: `${record.id}-filing-v${declaration.version}`,
        period: record.period,
        summary: `${record.title}申报差异`
      })
    : buildTaxAmountLines({
        amount: adjustmentAmount,
        idPrefix: `${record.id}-filing-v${declaration.version}`,
        matterType: record.matterType,
        period: record.period,
        summary: `${record.title}申报差异`
      });
  const voucherAmount = record.matterType === '增值税及附加'
    ? getVoucherAmountFromLines(lines)
    : Math.abs(adjustmentAmount);

  if (voucherAmount <= moneyTolerance) {
    return undefined;
  }

  const declarationPeriod = declaration.declarationDate.slice(0, 7);
  const accountingPeriod = declaration.filingAdjustmentAccountingPeriod ?? declarationPeriod;
  const voucherDate = accountingPeriod === declarationPeriod
    ? declaration.declarationDate
    : `${accountingPeriod}-01`;

  return finalizeTaxMatterVoucher(
    {
      accountingPeriod,
      amount: voucherAmount,
      businessType: '调整凭证',
      counterparty: getTaxMatterCounterparty(record.matterType),
      id: `voucher-tax-${record.id}-filing-v${declaration.version}`,
      invoiceRefs: [],
      kind: '转账凭证',
      lines,
      sourceModule: '税务办理',
      sourceNo: record.matterNo,
      sourceRefs: getTaxMatterSourceRefs(record).filter((sourceRef) => sourceRef.role !== '资金结算依据'),
      sourceTitle: record.title,
      sourceType: '税费事项',
      summary: `${record.matterType}申报差异：${record.title}`,
      taxFilingContext: {
        declarationDate: declaration.declarationDate,
        declarationVersion: declaration.version,
        taxPeriod: record.period
      },
      voucherDate,
      voucherNo: `VCH-${accountingPeriod.replace('-', '')}-F${String(index * 100 + declaration.version).padStart(3, '0')}`
    },
    getTaxFilingAdjustmentIssueReasons(record, declaration)
  );
}

export function buildAccountingVouchersFromTaxMatter(
  record: FinanceTaxMatterRecord,
  index: number,
  preparation?: FinanceDeclarationPreparationRecord
) {
  const filedVersions = [
    ...record.declarationHistory
      .filter((candidate) => candidate.action !== '作废')
      .map((candidate) => candidate.version),
    ...(['申报成功', '零申报'].includes(record.declarationStatus) ? [record.declarationVersion] : [])
  ];

  return [
    buildTaxAccrualVoucher(record, index, preparation),
    ...filedVersions.map((declarationVersion) => (
      buildTaxFilingAdjustmentVoucher(record, index, preparation, declarationVersion)
    ))
  ].filter((voucher): voucher is AccountingVoucherRecord => Boolean(voucher));
}

export function buildAccountingVoucherFromTaxMatter(
  record: FinanceTaxMatterRecord,
  index: number,
  preparation?: FinanceDeclarationPreparationRecord
) {
  return buildAccountingVouchersFromTaxMatter(record, index, preparation).at(-1);
}

export function buildAccountingVoucherFromOpeningAdjustment(
  record: LedgerOpeningAdjustmentVoucherRecord,
  index: number
): AccountingVoucherRecord | undefined {
  const accountingPeriod = record.accountingPeriod;
  const voucherDate = record.createdAt.slice(0, 10);
  const voucherNo = `VCH-${accountingPeriod.replace('-', '')}-O${String(index + 1).padStart(3, '0')}`;
  const counterSide = getOppositeVoucherLineSide(record.balanceSide);

  return finalizeAccountingVoucher({
    accountingPeriod,
    amount: record.amount,
    businessType: '调整凭证',
    counterparty: '账套初始化',
    id: `voucher-opening-adjustment-${record.id}`,
    invoiceRefs: [],
    kind: '转账凭证',
    lines: [
      createVoucherLine({
        amount: record.amount,
        auxiliary: '期初调整',
        id: `${record.id}-target`,
        side: record.balanceSide,
        subjectCode: record.subjectCode,
        summary: record.reason
      }),
      createVoucherLine({
        amount: record.amount,
        auxiliary: '期初调整',
        id: `${record.id}-offset`,
        side: counterSide,
        subjectCode: openingAdjustmentOffsetSubjectCode,
        summary: `期初调整差额承接：${record.reason}`
      })
    ],
    sourceModule: '账套初始化',
    sourceNo: record.voucherNo,
    sourceRefs: [createSourceRef('账套初始化', record.id, record.voucherNo, '主来源')],
    sourceTitle: `${record.subjectCode} ${record.subjectName} 期初调整`,
    sourceType: '期初调整',
    summary: `期初调整：${record.reason}`,
    voucherDate,
    voucherNo
  });
}

export function buildAccountingVoucherFromLaterPeriodAdjustment(
  record: AccountingVoucherLaterPeriodAdjustmentRecord,
  index: number
): AccountingVoucherRecord | undefined {
  const voucherNo = `VCH-${record.accountingPeriod.replace('-', '')}-L${String(index + 1).padStart(3, '0')}`;
  const voucherDate = record.adjustedAt.slice(0, 10);

  const differenceMode = record.adjustmentMode === '差额调整';
  const targetAmount = differenceMode ? Math.abs(record.signedAmount) : record.amount;
  if (targetAmount <= 0 || record.snapshot.amount <= 0 || record.snapshot.lines.length === 0) {
    return undefined;
  }
  const preserveOriginalSide = differenceMode && record.signedAmount > 0;
  const sourceLines = differenceMode
    ? record.snapshot.lines.flatMap((line, lineIndex, lines) => {
        const sameSideLines = lines.filter((candidate) => candidate.side === line.side);
        const sameSideIndex = sameSideLines.findIndex((candidate) => candidate.id === line.id);
        const priorAmount = sameSideLines.slice(0, sameSideIndex).reduce(
          (total, candidate) => total + roundMoney(candidate.amount * targetAmount / record.snapshot.amount),
          0
        );
        const amount = sameSideIndex === sameSideLines.length - 1
          ? roundMoney(targetAmount - priorAmount)
          : roundMoney(line.amount * targetAmount / record.snapshot.amount);

        return amount > 0
          ? [{ line, lineIndex, amount }]
          : [];
      })
    : record.snapshot.lines.map((line, lineIndex) => ({ amount: line.amount, line, lineIndex }));

  if (targetAmount <= 0 || sourceLines.length === 0) {
    return undefined;
  }

  return finalizeAccountingVoucher({
    accountingPeriod: record.accountingPeriod,
    amount: record.amount,
    businessType: '调整凭证',
    counterparty: record.snapshot.counterparty,
    id: `voucher-later-adjustment-${record.id}`,
    invoiceRefs: record.snapshot.invoiceRefs.map((invoiceRef) => ({ ...invoiceRef })),
    kind: '转账凭证',
    lines: sourceLines.map(({ amount, line, lineIndex }) =>
      createVoucherLine({
        amount,
        auxiliary: line.auxiliary,
        id: `${record.id}-adjustment-${lineIndex + 1}`,
        side: preserveOriginalSide ? line.side : getOppositeVoucherLineSide(line.side),
        subjectCode: line.subjectCode,
        summary: `${differenceMode ? '差额调整' : '后续调整'}：${line.summary}`
      })
    ),
    sourceModule: '会计凭证',
    sourceNo: record.adjustmentNo,
    sourceRefs: [
      createSourceRef('会计凭证', record.originalVoucherId, record.originalVoucherNo, '调整依据'),
      ...(record.correctionContext
        ? [createSourceRef('应收应付', record.correctionContext.recordId, record.correctionContext.issueId, '调整依据')]
        : [])
    ],
    sourceTitle: `后续调整 ${record.snapshot.sourceTitle}`,
    sourceType: '后续调整',
    summary: `后续期间调整：${record.reason}`,
    voucherDate,
    voucherNo
  });
}

export function buildAccountingVoucherFromMonthEndMatter(
  record: FinanceMonthEndMatterRecord,
  index: number
): AccountingVoucherRecord | undefined {
  if (!isFinanceMonthEndMatterVoucherReady(record)) {
    return undefined;
  }

  const voucherNo = `VCH-${record.accountingPeriod.replace('-', '')}-M${String(index + 1).padStart(3, '0')}`;

  return finalizeAccountingVoucher({
    accountingPeriod: record.accountingPeriod,
    amount: record.amount,
    businessType: '调整凭证',
    counterparty: record.sourceTitle,
    id: `voucher-month-end-${record.id}`,
    invoiceRefs: [],
    kind: '转账凭证',
    lines: getFinanceMonthEndMatterVoucherLines(record).map((line, lineIndex) =>
      createVoucherLine({
        ...line,
        id: `${record.id}-month-end-${lineIndex + 1}`
      })
    ),
    sourceModule: '月末事项',
    sourceNo: record.sourceNo,
    sourceRefs: [
      createSourceRef('月末事项', record.id, record.sourceNo, '主来源'),
      createSourceRef(record.sourceModule, record.id, record.sourceNo, '调整依据')
    ],
    sourceTitle: record.sourceTitle,
    sourceType: '月末事项',
    summary: `${record.type}：${record.sourceTitle}`,
    voucherDate: record.voucherDate,
    voucherNo
  });
}

export type AccountingVoucherBuildOptions = {
  accountingPeriodStart?: string;
  declarationPreparationRows?: FinanceDeclarationPreparationRecord[];
  invoiceBusinessAllocationRows?: FinanceInvoiceBusinessAllocation[];
  monthEndMatterRows?: FinanceMonthEndMatterRecord[];
};

function isAccountingVoucherInsideScope(record: Pick<AccountingVoucherRecord, 'accountingPeriod'>, accountingPeriodStart?: string) {
  return !accountingPeriodStart || record.accountingPeriod >= accountingPeriodStart;
}

export function buildAccountingVouchers(
  receivablePayableRows: FinanceReceivablePayableRecord[],
  financeRows: FinanceTransactionRecord[],
  invoiceRows: FinanceInvoiceRecord[] = [],
  taxMatterRows: FinanceTaxMatterRecord[] = [],
  bankReconciliationRows: FinanceBankReconciliationLinkRecord[] = [],
  openingAdjustmentRows: LedgerOpeningAdjustmentVoucherRecord[] = [],
  laterPeriodAdjustmentRows: AccountingVoucherLaterPeriodAdjustmentRecord[] = [],
  options: AccountingVoucherBuildOptions = {}
): AccountingVoucherRecord[] {
  const accountingPeriodStart = options.accountingPeriodStart;
  const declarationPreparationRows = options.declarationPreparationRows ?? [];
  const invoiceBusinessAllocationRows = options.invoiceBusinessAllocationRows ?? [];
  const businessVouchers = receivablePayableRows
    .map((record, index) => {
      return buildAccountingVoucherFromReceivablePayable(record, index, invoiceRows, invoiceBusinessAllocationRows);
    })
    .filter((record): record is AccountingVoucherRecord => Boolean(record))
    .filter((record) => isAccountingVoucherInsideScope(record, accountingPeriodStart));
  const transactionByNo = new Map(financeRows.map((record) => [record.transactionNo, record]));
  const cashVouchers = financeRows
    .map((record, index) => buildAccountingVoucherFromTransaction(
      record,
      index,
      bankReconciliationRows,
      record.adjustmentContext?.originTransactionNo
        ? transactionByNo.get(record.adjustmentContext.originTransactionNo)
        : undefined
    ))
    .filter((record): record is AccountingVoucherRecord => Boolean(record))
    .filter((record) => isAccountingVoucherInsideScope(record, accountingPeriodStart));
  const redInvoiceVouchers = invoiceRows
    .filter((invoice) => invoice.invoiceColor === '红票')
    .map((invoice, index) => buildAccountingVoucherFromRedInvoice(invoice, index, invoiceRows, invoiceBusinessAllocationRows, receivablePayableRows))
    .filter((record): record is AccountingVoucherRecord => Boolean(record))
    .filter((record) => isAccountingVoucherInsideScope(record, accountingPeriodStart));
  const taxMatterVouchers = taxMatterRows
    .flatMap((record, index) => buildAccountingVouchersFromTaxMatter(
      record,
      index,
      getTaxPreparationForMatter(record, declarationPreparationRows)
    ))
    .filter((record) => isAccountingVoucherInsideScope(record, accountingPeriodStart));
  const openingAdjustmentVouchers = openingAdjustmentRows
    .map((record, index) => buildAccountingVoucherFromOpeningAdjustment(record, index))
    .filter((record): record is AccountingVoucherRecord => Boolean(record))
    .filter((record) => isAccountingVoucherInsideScope(record, accountingPeriodStart));
  const laterPeriodAdjustmentVouchers = laterPeriodAdjustmentRows
    .map((record, index) => buildAccountingVoucherFromLaterPeriodAdjustment(record, index))
    .filter((record): record is AccountingVoucherRecord => Boolean(record))
    .filter((record) => isAccountingVoucherInsideScope(record, accountingPeriodStart));
  const monthEndMatterVouchers = (options.monthEndMatterRows ?? [])
    .map((record, index) => buildAccountingVoucherFromMonthEndMatter(record, index))
    .filter((record): record is AccountingVoucherRecord => Boolean(record))
    .filter((record) => isAccountingVoucherInsideScope(record, accountingPeriodStart));

  return [
    ...businessVouchers,
    ...cashVouchers,
    ...taxMatterVouchers,
    ...openingAdjustmentVouchers,
    ...laterPeriodAdjustmentVouchers,
    ...monthEndMatterVouchers,
    ...redInvoiceVouchers
  ].sort((left, right) => right.voucherDate.localeCompare(left.voucherDate));
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
    bookedCount: rows.filter((row) => row.status === '已记账').length,
    issueCount: rows.filter((row) => row.status === '需处理').length,
    pendingGenerationCount: rows.filter((row) => row.status === '待生成').length,
    readyToBookCount: rows.filter((row) => row.status === '待记账').length,
    reversedCount: rows.filter((row) => row.status === '已冲销').length,
    totalCount: rows.length
  };
}

function getVoucherNoSequence(voucherNo: string) {
  const sequence = Number(voucherNo.slice(voucherNo.lastIndexOf('-') + 1));

  return Number.isFinite(sequence) ? sequence : 0;
}

export function getNextAccountingVoucherNo(
  lifecycleRows: AccountingVoucherLifecycleRecord[],
  accountingPeriod: string
) {
  const periodCode = accountingPeriod.replace('-', '');
  const nextSequence =
    lifecycleRows
      .filter((row) => row.accountingPeriod === accountingPeriod)
      .reduce((maxSequence, row) => Math.max(maxSequence, getVoucherNoSequence(row.voucherNo)), 0) + 1;

  return `记-${periodCode}-${String(nextSequence).padStart(3, '0')}`;
}

export function getNextAccountingVoucherAdjustmentNo(
  rows: AccountingVoucherLaterPeriodAdjustmentRecord[],
  accountingPeriod: string
) {
  const periodCode = accountingPeriod.replace('-', '');
  const nextSequence =
    rows
      .filter((row) => row.accountingPeriod === accountingPeriod)
      .reduce((maxSequence, row) => Math.max(maxSequence, getVoucherNoSequence(row.adjustmentNo)), 0) + 1;

  return `ADJ-${periodCode}-${String(nextSequence).padStart(3, '0')}`;
}

function cloneAccountingVoucherRecord(record: AccountingVoucherRecord): AccountingVoucherRecord {
  return {
    ...record,
    invoiceRefs: record.invoiceRefs.map((invoice) => ({ ...invoice })),
    issueReasons: [...record.issueReasons],
    lines: record.lines.map((line) => ({
      ...line,
      subject: line.subject ? { ...line.subject } : undefined
    })),
    sourceRefs: record.sourceRefs.map((sourceRef) => ({ ...sourceRef })),
    taxBasis: record.taxBasis ? { ...record.taxBasis } : undefined,
    taxFilingContext: record.taxFilingContext ? { ...record.taxFilingContext } : undefined
  };
}

export function createBookedAccountingVoucherSnapshot(
  record: AccountingVoucherRecord,
  bookedBy: string,
  bookedAt: string,
  voucherNo = record.voucherNo
): AccountingVoucherRecord {
  const snapshot = cloneAccountingVoucherRecord(record);

  return {
    ...snapshot,
    bookedAt,
    bookedBy,
    reversedAt: undefined,
    reversedBy: undefined,
    reversedByVoucherId: undefined,
    reversalReason: undefined,
    status: '已记账',
    voucherNo: voucherNo
  };
}

export function createReversedAccountingVoucherSnapshot({
  record,
  reversedAt,
  reversedBy,
  reversalReason,
  reversedByVoucherId
}: {
  record: AccountingVoucherRecord;
  reversedAt: string;
  reversedBy: string;
  reversalReason: string;
  reversedByVoucherId: string;
}): AccountingVoucherRecord {
  const snapshot = cloneAccountingVoucherRecord(record);

  return {
    ...snapshot,
    reversedAt,
    reversedBy,
    reversedByVoucherId,
    reversalReason,
    status: '已冲销'
  };
}

export function createReversalAccountingVoucherSnapshot({
  actor,
  voucherNo,
  originalRecord,
  reason,
  reversedAt
}: {
  actor: string;
  voucherNo: string;
  originalRecord: AccountingVoucherRecord;
  reason: string;
  reversedAt: string;
}): AccountingVoucherRecord {
  const snapshot = cloneAccountingVoucherRecord(originalRecord);
  const voucherDate = reversedAt.slice(0, 10);

  return {
    ...snapshot,
    accountingPeriod: originalRecord.accountingPeriod,
    bookedAt: reversedAt,
    bookedBy: actor,
    businessType: '冲销凭证',
    id: `${originalRecord.id}-reversal`,
    invoiceRefs: snapshot.invoiceRefs,
    issueReasons: [],
    kind: originalRecord.kind,
    lines: originalRecord.lines.map((line, index) => ({
      ...line,
      id: `${originalRecord.id}-reversal-${index + 1}`,
      side: getOppositeVoucherLineSide(line.side),
      summary: `冲销：${line.summary}`
    })),
    reversalOfVoucherId: originalRecord.id,
    sourceModule: '会计凭证',
    sourceNo: originalRecord.voucherNo,
    sourceRefs: [createSourceRef('会计凭证', originalRecord.id, originalRecord.voucherNo, '冲销依据')],
    sourceTitle: `冲销 ${originalRecord.sourceTitle}`,
    sourceType: '冲销事项',
    status: '已记账',
    summary: reason ? `冲销：${reason}` : `冲销：${originalRecord.summary}`,
    voucherDate,
    voucherNo: voucherNo
  };
}

export function createAccountingVoucherLifecycleRecord(
  record: AccountingVoucherRecord,
  voucherNo: string,
  bookedBy: string,
  bookedAt: string
): AccountingVoucherLifecycleRecord {
  const snapshot = createBookedAccountingVoucherSnapshot(record, bookedBy, bookedAt, voucherNo);

  return {
    accountingPeriod: snapshot.accountingPeriod,
    voucherNo,
    bookedAt,
    bookedBy,
    snapshot,
    status: '已记账',
    voucherId: snapshot.id
  };
}

export function isAccountingPeriodLocked(
  periodLocks: AccountingPeriodLockRecord[],
  accountingPeriod: string
) {
  return Boolean(getClosedAccountingPeriodLock(periodLocks, accountingPeriod));
}

export function getClosedAccountingPeriodLock(
  periodLocks: AccountingPeriodLockRecord[],
  accountingPeriod: string
) {
  return periodLocks.find((periodLock) => periodLock.accountingPeriod === accountingPeriod && periodLock.status === '已结账');
}

export function applyAccountingPeriodCloseLock(
  periodLocks: AccountingPeriodLockRecord[],
  nextLock: AccountingPeriodLockRecord
) {
  if (getClosedAccountingPeriodLock(periodLocks, nextLock.accountingPeriod)) {
    return periodLocks;
  }

  return [
    nextLock,
    ...periodLocks.filter((periodLock) => periodLock.accountingPeriod !== nextLock.accountingPeriod)
  ];
}

export function reopenAccountingPeriodLock(
  periodLocks: AccountingPeriodLockRecord[],
  accountingPeriod: string,
  input: AccountingPeriodReopenInput
) {
  return periodLocks.map((periodLock) => {
    if (periodLock.accountingPeriod !== accountingPeriod || periodLock.status !== '已结账') {
      return periodLock;
    }

    return {
      ...periodLock,
      reopenReason: input.reason,
      reopenedAt: input.reopenedAt,
      reopenedBy: input.reopenedBy,
      status: '已反结账' as const
    };
  });
}

export function getAccountingPeriodClosedReason(accountingPeriod: string, actionLabel = '修改') {
  return `${accountingPeriod} 已结账，不能${actionLabel}；如需修正，请优先创建后续调整事项，反结账属于异常流程。`;
}

export function getClosedAccountingPeriodReadbackNotice(accountingPeriod: string, subject = '当前事项') {
  return `${accountingPeriod} 已结账，${subject}仅用于历史回看；如需修正，请走后续期间调整，反结账属于异常流程。`;
}

export function getAccountingVoucherPeriodLockNotice(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  const lock = getClosedAccountingPeriodLock(periodLocks, record.accountingPeriod);

  if (!lock) {
    return undefined;
  }

  if (record.status === '待记账') {
    return getAccountingPeriodClosedReason(record.accountingPeriod, '记账');
  }

  if (record.status === '已记账' && !record.reversalOfVoucherId) {
    return `${record.accountingPeriod} 已结账，不能在原期间冲销；如需修正，请创建后续调整事项。`;
  }

  return getClosedAccountingPeriodReadbackNotice(record.accountingPeriod, '当前凭证');
}

export function guardAccountingPeriodOpen(
  periodLocks: AccountingPeriodLockRecord[],
  accountingPeriod: string | undefined,
  actionLabel = '修改'
): AccountingPeriodOpenGuard {
  if (!accountingPeriod) {
    return {
      allowed: false,
      errorCode: closedAccountingPeriodErrorCode,
      reason: '缺少会计期间，不能执行账务变更。'
    };
  }

  const lock = getClosedAccountingPeriodLock(periodLocks, accountingPeriod);

  if (!lock) {
    return {
      allowed: true
    };
  }

  return {
    allowed: false,
    errorCode: closedAccountingPeriodErrorCode,
    lock,
    reason: getAccountingPeriodClosedReason(accountingPeriod, actionLabel)
  };
}

export function canBookAccountingVoucher(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  return record.status === '待记账' && !isAccountingPeriodLocked(periodLocks, record.accountingPeriod);
}

export function canReverseAccountingVoucher(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  return record.status === '已记账' && !record.reversalOfVoucherId && !isAccountingPeriodLocked(periodLocks, record.accountingPeriod);
}

export function getAccountingVoucherDefaultReversalDate(record: AccountingVoucherRecord) {
  return record.voucherDate || `${record.accountingPeriod}-01`;
}

export function getAccountingVoucherReversalAccountingPeriod(reversedAt: string) {
  return reversedAt.slice(0, 7);
}

export function validateAccountingVoucherReversal(
  record: AccountingVoucherRecord,
  reversalInput: AccountingVoucherReversalInput,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  const issues: string[] = [];
  const reason = reversalInput.reason.trim();
  const reversalPeriod = getAccountingVoucherReversalAccountingPeriod(reversalInput.reversedAt);

  if (!canReverseAccountingVoucher(record, periodLocks)) {
    issues.push('仅开放期间内的已记账凭证可以冲销');
  }

  if (!reversalInput.reversedAt) {
    issues.push('冲销日期必填');
  }

  if (reversalInput.reversedAt && reversalPeriod !== record.accountingPeriod) {
    issues.push('冲销日期必须落在原凭证归属月份');
  }

  if (!reason) {
    issues.push('冲销原因必填');
  }

  return issues;
}

export function canSubmitAccountingVoucherReversal(
  record: AccountingVoucherRecord,
  reversalInput: AccountingVoucherReversalInput,
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  return validateAccountingVoucherReversal(record, reversalInput, periodLocks).length === 0;
}

export function canCreateLaterPeriodAccountingVoucherAdjustment(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = [],
  targetAccountingPeriod?: string,
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[] = [],
  correctionIssueId?: string
) {
  const baseAllowed =
    record.status === '已记账' &&
    !record.reversalOfVoucherId &&
    isAccountingPeriodLocked(periodLocks, record.accountingPeriod);

  if (!baseAllowed) {
    return false;
  }

  if (!targetAccountingPeriod) {
    return true;
  }

  if (getExistingLaterPeriodAccountingVoucherAdjustment(record, targetAccountingPeriod, existingRows, correctionIssueId)) {
    return false;
  }

  return (
    compareAccountingPeriods(targetAccountingPeriod, record.accountingPeriod) > 0 &&
    !isAccountingPeriodLocked(periodLocks, targetAccountingPeriod)
  );
}

export function getExistingLaterPeriodAccountingVoucherAdjustment(
  record: AccountingVoucherRecord,
  targetAccountingPeriod: string,
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[] = [],
  correctionIssueId?: string
) {
  return existingRows.find(
    (row) =>
      row.originalVoucherId === record.id &&
      row.accountingPeriod === targetAccountingPeriod &&
      (!correctionIssueId || row.correctionContext?.issueId === correctionIssueId)
  );
}

export function getAvailableLaterPeriodAdjustmentAccountingPeriod(
  record: AccountingVoucherRecord,
  periodLocks: AccountingPeriodLockRecord[] = [],
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[] = [],
  correctionIssueId?: string,
  maxLookaheadMonths = 12
) {
  let targetAccountingPeriod = getDefaultLaterPeriodAdjustmentAccountingPeriod(record);

  for (let index = 0; index < maxLookaheadMonths; index += 1) {
    if (canCreateLaterPeriodAccountingVoucherAdjustment(
      record,
      periodLocks,
      targetAccountingPeriod,
      existingRows,
      correctionIssueId
    )) {
      return targetAccountingPeriod;
    }

    targetAccountingPeriod = getNextAccountingPeriod(targetAccountingPeriod);
  }

  return undefined;
}

export function validateLaterPeriodAccountingVoucherAdjustment(
  record: AccountingVoucherRecord,
  input: AccountingVoucherLaterPeriodAdjustmentInput,
  periodLocks: AccountingPeriodLockRecord[] = [],
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[] = []
) {
  const issues: string[] = [];
  const reason = input.reason.trim();
  const adjustmentPeriodFromDate = input.adjustedAt.slice(0, 7);
  const existingAdjustment = input.accountingPeriod
    ? getExistingLaterPeriodAccountingVoucherAdjustment(
        record,
        input.accountingPeriod,
        existingRows,
        input.correctionContext?.issueId
      )
    : undefined;

  if (record.status !== '已记账' || record.reversalOfVoucherId) {
    issues.push('仅已记账且非冲销凭证可以创建后续调整事项');
  }

  if (!isAccountingPeriodLocked(periodLocks, record.accountingPeriod)) {
    issues.push('原凭证期间尚未结账，请使用冲销处理');
  }

  if (!input.accountingPeriod) {
    issues.push('调整期间必填');
  } else if (compareAccountingPeriods(input.accountingPeriod, record.accountingPeriod) <= 0) {
    issues.push('调整期间必须晚于原凭证归属月份');
  }

  if (input.accountingPeriod && isAccountingPeriodLocked(periodLocks, input.accountingPeriod)) {
    issues.push('调整期间已结账，不能创建后续调整事项');
  }

  if (existingAdjustment) {
    issues.push(`该原凭证在 ${input.accountingPeriod} 已有后续调整事项 ${existingAdjustment.adjustmentNo}`);
  }

  if (!input.adjustedAt) {
    issues.push('调整日期必填');
  } else if (input.accountingPeriod && adjustmentPeriodFromDate !== input.accountingPeriod) {
    issues.push('调整日期必须落在调整期间');
  }

  if (!reason) {
    issues.push('调整原因必填');
  }

  if (input.adjustmentMode === '差额调整') {
    if (!input.correctionContext) {
      issues.push('差额调整缺少来源更正事项');
    }

    if (!input.signedAmount || Math.abs(input.signedAmount) < 0.01) {
      issues.push('差额调整金额不能为 0');
    }
  }

  return issues;
}

export function canSubmitLaterPeriodAccountingVoucherAdjustment(
  record: AccountingVoucherRecord,
  input: AccountingVoucherLaterPeriodAdjustmentInput,
  periodLocks: AccountingPeriodLockRecord[] = [],
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[] = []
) {
  return validateLaterPeriodAccountingVoucherAdjustment(record, input, periodLocks, existingRows).length === 0;
}

export function createLaterPeriodAccountingVoucherAdjustmentRecord({
  actor,
  existingRows,
  input,
  originalRecord
}: {
  actor: string;
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  input: AccountingVoucherLaterPeriodAdjustmentInput;
  originalRecord: AccountingVoucherRecord;
}): AccountingVoucherLaterPeriodAdjustmentRecord {
  const adjustedAt = input.adjustedAt.includes(' ')
    ? input.adjustedAt
    : `${input.adjustedAt} 17:30`;

  return {
    accountingPeriod: input.accountingPeriod,
    adjustedAt,
    adjustedBy: actor,
    adjustmentNo: getNextAccountingVoucherAdjustmentNo(existingRows, input.accountingPeriod),
    amount: input.adjustmentMode === '差额调整'
      ? Math.abs(input.signedAmount ?? 0)
      : originalRecord.amount,
    adjustmentMode: input.adjustmentMode ?? '冲销原凭证',
    candidateStatus: '待记账',
    id: `later-adjustment-${originalRecord.id}-${input.accountingPeriod}-${input.correctionContext?.issueId ?? 'general'}`,
    originalAccountingPeriod: originalRecord.accountingPeriod,
    originalVoucherId: originalRecord.id,
    originalVoucherNo: originalRecord.voucherNo,
    correctionContext: input.correctionContext ? { ...input.correctionContext } : undefined,
    reason: input.reason.trim(),
    signedAmount: input.adjustmentMode === '差额调整'
      ? Number((input.signedAmount ?? 0).toFixed(2))
      : -originalRecord.amount,
    snapshot: cloneAccountingVoucherRecord(originalRecord)
  };
}

export function applyAccountingVoucherLifecycle(
  rows: AccountingVoucherRecord[],
  lifecycleRows: AccountingVoucherLifecycleRecord[] = []
): AccountingVoucherRecord[] {
  const lifecycleByVoucherId = new Map(lifecycleRows.map((row) => [row.voucherId, row]));
  const generatedVoucherIds = new Set(rows.map((row) => row.id));

  function hydrateLifecycleRecord(lifecycle: AccountingVoucherLifecycleRecord): AccountingVoucherRecord {
    return {
      ...cloneAccountingVoucherRecord(lifecycle.snapshot),
      bookedAt: lifecycle.bookedAt,
      bookedBy: lifecycle.bookedBy,
      reversedAt: lifecycle.reversedAt,
      reversedBy: lifecycle.reversedBy,
      reversalReason: lifecycle.reversalReason,
      status: lifecycle.status,
      voucherNo: lifecycle.voucherNo
    };
  }

  const rowsWithLifecycle = rows.map((row) => {
    const lifecycle = lifecycleByVoucherId.get(row.id);

    if (!lifecycle) {
      return row;
    }

    return hydrateLifecycleRecord(lifecycle);
  });

  const persistedOnlyRows = lifecycleRows
    .filter((lifecycle) => !generatedVoucherIds.has(lifecycle.voucherId))
    .map(hydrateLifecycleRecord);

  return [...rowsWithLifecycle, ...persistedOnlyRows].sort((left, right) => right.voucherDate.localeCompare(left.voucherDate));
}

export function buildAccountingLedgerEntries(rows: AccountingVoucherRecord[]): AccountingLedgerEntry[] {
  return rows
    .filter((record) => record.status === '已记账' || record.status === '已冲销')
    .flatMap((record) =>
      record.lines.map((line, index) => ({
        accountingPeriod: record.accountingPeriod,
        auxiliary: line.auxiliary,
        creditAmount: line.side === '贷方' ? line.amount : 0,
        debitAmount: line.side === '借方' ? line.amount : 0,
        voucherNo: record.voucherNo,
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
