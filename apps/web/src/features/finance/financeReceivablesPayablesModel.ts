import {
  financeReceivablePayableSettlementStatusOptions,
  getReceivablePayableOutstandingAmount,
  type FinanceReceivablePayableCounterpartyType,
  type FinanceReceivablePayableDirection,
  type FinanceReceivablePayableRecord,
  type FinanceReceivablePayableReviewProgressStatus,
  type FinanceReceivablePayableSettlementStatus,
  type FinanceReceivablePayableSourceType,
} from './financeReceivablesPayablesData';
import { getDateScopeRange, type DateScopeFilterValue } from '../../components/DateFilterFields';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type {
  FinanceAccountingSubjectRole,
  FinancePaymentMethod,
  FinanceSourceType,
  FinanceTransactionCategory,
  FinanceTransactionDirection,
  FinanceTransactionRecord
} from './financeData';
import type { PublicAccountRef } from '../system/PublicAccountConfigState';
import {
  financeAccountingSubjectRoleLabels,
  getFinanceCategoryMissingAccountingRoles,
  getFinanceCategorySnapshot
} from './financeData';
import {
  getDefaultReceivablePayableTaxBasis,
  isFinanceTaxBasisResolved,
  type FinanceTaxBasis
} from './financeTaxBasisModel';
import { financeToday, formatMoney, getAccountingPeriod, getDefaultFinanceReviewDueAt } from './financeUtils';

export type FinanceReceivablePayableFilterValue = '全部';
export type FinanceReceivablePayableDirectionFilter = FinanceReceivablePayableFilterValue | FinanceReceivablePayableDirection;
export type FinanceReceivablePayableListTabKey = 'open' | 'settled';

export type FinanceReceivablePayableFilters = {
  direction: FinanceReceivablePayableDirectionFilter;
  keyword: string;
  periodTime: DateScopeFilterValue;
  settlementStatus: FinanceReceivablePayableFilterValue | FinanceReceivablePayableSettlementStatus;
};

export type FinanceReceivablePayableAmountLabels = {
  amount: string;
  outstanding: string;
  settled: string;
};

export type FinanceReceivablePayableFilterOptions = {
  directionOptions: FinanceReceivablePayableDirectionFilter[];
  settlementStatusOptions: Array<FinanceReceivablePayableFilterValue | FinanceReceivablePayableSettlementStatus>;
};

export type FinanceReceivablePayableListTab = {
  key: FinanceReceivablePayableListTabKey;
  label: string;
};

export type FinanceReceivablePayableMetrics = {
  confirmedAmount: number;
  overdueRows: FinanceReceivablePayableRecord[];
  payableOutstanding: number;
  payableRows: FinanceReceivablePayableRecord[];
  receivableOutstanding: number;
  receivableRows: FinanceReceivablePayableRecord[];
};

export type FinanceReceivablePayableAccrualReadinessIssue =
  | 'source_document_incomplete'
  | 'original_evidence_missing'
  | 'tax_basis_pending'
  | 'accounting_subject_missing';

export type FinanceReceivablePayableAccrualReadinessStatus =
  | '待补资料'
  | '待补票税'
  | '待配置'
  | '可确认'
  | '已确认'
  | '已作废';

export type FinanceReceivablePayableAccrualReadiness = {
  issues: FinanceReceivablePayableAccrualReadinessIssue[];
  status: FinanceReceivablePayableAccrualReadinessStatus;
};

export type FinanceReceivablePayableFormValue = {
  accountingPeriod: string;
  amount: number;
  category: FinanceTransactionCategory;
  confirmDate: string;
  counterparty: string;
  counterpartyType: FinanceReceivablePayableCounterpartyType;
  direction: FinanceReceivablePayableDirection;
  dueDate: string;
  files: RelatedFileRecord[];
  note: string;
  owner: string;
  sourceNo: string;
  sourceTitle: string;
  sourceType: FinanceReceivablePayableSourceType;
};

export type FinanceReceivablePayableSettlementFormValue = {
  amount: number;
  files: RelatedFileRecord[];
  note: string;
  occurredAt: string;
  publicAccountId: string;
};

export const financeReceivablePayableCurrentPeriod = financeToday.slice(0, 7);

export const defaultFinanceReceivablePayableFilters: FinanceReceivablePayableFilters = {
  direction: '全部',
  keyword: '',
  periodTime: { mode: 'currentMonth' },
  settlementStatus: '全部'
};

export const financeReceivablePayableLedgerAmountLabels: FinanceReceivablePayableAmountLabels = {
  amount: '确认金额',
  outstanding: '未结清金额',
  settled: '已结清金额'
};

export const financeReceivablePayableListTabs: FinanceReceivablePayableListTab[] = [
  { key: 'open', label: '未结清' },
  { key: 'settled', label: '已结清' }
];

const acceptableAccrualEvidenceStatuses = new Set(['已上传', '已归档', '已生成', '已发布']);

export function getFinanceReceivablePayableAmountLabels(
  direction: FinanceReceivablePayableDirection
): FinanceReceivablePayableAmountLabels {
  if (direction === '应收') {
    return {
      amount: '应收金额',
      outstanding: '未收金额',
      settled: '已收金额'
    };
  }

  return {
    amount: '应付金额',
    outstanding: '未付金额',
    settled: '已付金额'
  };
}

export function uniqueFinanceReceivablePayableOptions<T extends string>(
  records: FinanceReceivablePayableRecord[],
  selector: (record: FinanceReceivablePayableRecord) => T
) {
  return Array.from(new Set(records.map(selector)));
}

export function isFinanceReceivablePayableConfirmed(record: FinanceReceivablePayableRecord) {
  return record.confirmationStatus === '已确认';
}

export function isFinanceReceivablePayableVoided(record: FinanceReceivablePayableRecord) {
  return record.confirmationStatus === '已作废';
}

function hasBlankAccrualSourceValue(value?: string) {
  return !value?.trim();
}

function hasFinanceReceivablePayableOriginalEvidence(record: FinanceReceivablePayableRecord) {
  return record.files.some((file) => acceptableAccrualEvidenceStatuses.has(file.status));
}

export function getFinanceReceivablePayableRequiredAccountingRoles(
  record: FinanceReceivablePayableRecord,
  taxBasis: FinanceTaxBasis | undefined = record.taxBasis
): FinanceAccountingSubjectRole[] {
  if (record.direction === '应收') {
    const roles: FinanceAccountingSubjectRole[] = ['accrualReceivable', 'accrualRevenue'];

    if ((taxBasis?.taxAmount ?? 0) > 0) {
      roles.push('outputVatPayable');
    }

    return roles;
  }

  return ['accrualExpense', 'accrualPayable'];
}

export function getFinanceReceivablePayableMissingAccountingRoles(
  record: FinanceReceivablePayableRecord,
  taxBasis: FinanceTaxBasis | undefined = record.taxBasis
) {
  if (record.categorySnapshot.primaryCode === 'FC1-UNMAPPED' || record.categorySnapshot.secondaryCode === 'FC2-UNMAPPED') {
    return getFinanceReceivablePayableRequiredAccountingRoles(record, taxBasis);
  }

  return getFinanceCategoryMissingAccountingRoles(
    record.category,
    getFinanceReceivablePayableRequiredAccountingRoles(record, taxBasis)
  );
}

export function getFinanceReceivablePayableMissingAccountingRoleLabels(
  record: FinanceReceivablePayableRecord,
  taxBasis: FinanceTaxBasis | undefined = record.taxBasis
) {
  return getFinanceReceivablePayableMissingAccountingRoles(record, taxBasis).map(
    (role) => financeAccountingSubjectRoleLabels[role]
  );
}

export function hasFinanceReceivablePayableAccountingSubject(
  record: FinanceReceivablePayableRecord,
  taxBasis: FinanceTaxBasis | undefined = record.taxBasis
) {
  return getFinanceReceivablePayableMissingAccountingRoles(record, taxBasis).length === 0;
}

export function buildFinanceReceivablePayableAccrualReadiness(
  record: FinanceReceivablePayableRecord,
  taxBasis: FinanceTaxBasis | undefined = record.taxBasis
): FinanceReceivablePayableAccrualReadiness {
  if (isFinanceReceivablePayableVoided(record)) {
    return {
      issues: [],
      status: '已作废'
    };
  }

  const issues: FinanceReceivablePayableAccrualReadinessIssue[] = [];

  if (
    hasBlankAccrualSourceValue(record.documentNo) ||
    hasBlankAccrualSourceValue(record.sourceNo) ||
    hasBlankAccrualSourceValue(record.sourceTitle) ||
    hasBlankAccrualSourceValue(record.counterparty) ||
    hasBlankAccrualSourceValue(record.accountingPeriod) ||
    hasBlankAccrualSourceValue(record.confirmDate) ||
    record.amount <= 0
  ) {
    issues.push('source_document_incomplete');
  }

  if (!hasFinanceReceivablePayableOriginalEvidence(record)) {
    issues.push('original_evidence_missing');
  }

  if (!isFinanceTaxBasisResolved(taxBasis)) {
    issues.push('tax_basis_pending');
  }

  if (!hasFinanceReceivablePayableAccountingSubject(record, taxBasis)) {
    issues.push('accounting_subject_missing');
  }

  if (issues.includes('source_document_incomplete') || issues.includes('original_evidence_missing')) {
    return {
      issues,
      status: '待补资料'
    };
  }

  if (issues.includes('tax_basis_pending')) {
    return {
      issues,
      status: '待补票税'
    };
  }

  if (issues.includes('accounting_subject_missing')) {
    return {
      issues,
      status: '待配置'
    };
  }

  return {
    issues,
    status: isFinanceReceivablePayableConfirmed(record) ? '已确认' : '可确认'
  };
}

export function isFinanceReceivablePayableAccrualReady(
  record: FinanceReceivablePayableRecord,
  taxBasis?: FinanceTaxBasis
) {
  return (
    isFinanceReceivablePayableConfirmed(record) &&
    buildFinanceReceivablePayableAccrualReadiness(record, taxBasis).status === '已确认'
  );
}

export function getFinanceReceivablePayableSourceLabel(
  sourceType: FinanceReceivablePayableSourceType
) {
  return sourceType;
}

function padMonth(month: number) {
  return String(month).padStart(2, '0');
}

function normalizeAccountingPeriod(period: string) {
  const match = period.match(/^(\d{4})-(\d{2})/);

  if (!match) {
    return financeReceivablePayableCurrentPeriod;
  }

  return `${match[1]}-${match[2]}`;
}

export function getFinanceReceivablePayablePayrollDueDate(accountingPeriod: string) {
  const normalizedPeriod = normalizeAccountingPeriod(accountingPeriod);
  const year = Number(normalizedPeriod.slice(0, 4));
  const month = Number(normalizedPeriod.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${padMonth(nextMonth)}-15`;
}

export function getFinanceReceivablePayableDueDate(record: FinanceReceivablePayableRecord) {
  if (record.sourceType === '薪酬发放' || record.sourceType === '月度绩效') {
    return getFinanceReceivablePayablePayrollDueDate(record.accountingPeriod);
  }

  if (record.sourceType === '季度绩效') {
    return getFinanceReceivablePayablePayrollDueDate(record.confirmDate.slice(0, 7));
  }

  return record.dueDate;
}

export function getDefaultFinanceReceivablePayableCategory(direction: FinanceReceivablePayableDirection) {
  return direction === '应收' ? '客户回款' : '办公费用';
}

export function createFinanceReceivablePayableForm(record?: FinanceReceivablePayableRecord): FinanceReceivablePayableFormValue {
  return {
    accountingPeriod: record?.accountingPeriod ?? financeReceivablePayableCurrentPeriod,
    amount: record?.amount ?? 0,
    category: record?.category ?? getDefaultFinanceReceivablePayableCategory('应付'),
    confirmDate: record?.confirmDate ?? financeToday,
    counterparty: record?.counterparty ?? '',
    counterpartyType: record?.counterpartyType ?? '供应商',
    direction: record?.direction ?? '应付',
    dueDate: record ? getFinanceReceivablePayableDueDate(record) : financeToday,
    files: record?.files ?? [],
    note: record?.note ?? '',
    owner: record?.owner ?? '李明',
    sourceNo: record?.sourceNo ?? '',
    sourceTitle: record?.sourceTitle ?? '',
    sourceType: record?.sourceType ?? '运营费用'
  };
}

export function createFinanceReceivablePayableSettlementForm(
  record?: FinanceReceivablePayableRecord,
  publicAccountId = ''
): FinanceReceivablePayableSettlementFormValue {
  return {
    amount: record ? getReceivablePayableOutstandingAmount(record) : 0,
    files: [],
    note: '',
    occurredAt: financeToday,
    publicAccountId
  };
}

export function isFinanceReceivablePayableFormValid(form: FinanceReceivablePayableFormValue) {
  return (
    form.accountingPeriod.trim() !== '' &&
    form.amount > 0 &&
    form.category.trim() !== '' &&
    form.confirmDate.trim() !== '' &&
    form.counterparty.trim() !== '' &&
    form.dueDate.trim() !== '' &&
    form.files.length > 0 &&
    form.owner.trim() !== '' &&
    form.sourceNo.trim() !== '' &&
    form.sourceTitle.trim() !== ''
  );
}

export function isFinanceReceivablePayableSettlementFormValid(
  form: FinanceReceivablePayableSettlementFormValue,
  registerableAmount: number
) {
  return (
    form.amount > 0 &&
    form.amount <= registerableAmount &&
    form.files.length > 0 &&
    form.occurredAt.trim() !== '' &&
    form.publicAccountId.trim() !== ''
  );
}

function getFinanceReceivablePayableAccountingPeriodRange(record: FinanceReceivablePayableRecord) {
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
    const startMonth = padMonth((quarter - 1) * 3 + 1);
    const endMonth = padMonth(quarter * 3);

    return {
      endDate: `${year}-${endMonth}-31`,
      startDate: `${year}-${startMonth}-01`
    };
  }

  return {
    endDate: record.confirmDate,
    startDate: record.confirmDate
  };
}

export function isFinanceReceivablePayableRecordInPeriodScope(
  record: FinanceReceivablePayableRecord,
  scope: DateScopeFilterValue
) {
  const range = getDateScopeRange(scope, financeReceivablePayableCurrentPeriod);

  if (!range) {
    return true;
  }

  const accountingPeriodRange = getFinanceReceivablePayableAccountingPeriodRange(record);

  return accountingPeriodRange.startDate <= range.endDate && accountingPeriodRange.endDate >= range.startDate;
}

export function matchesFinanceReceivablePayableFilters(
  record: FinanceReceivablePayableRecord,
  filters: FinanceReceivablePayableFilters
) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (!isFinanceReceivablePayableConfirmed(record)) {
    return false;
  }

  if (!isFinanceReceivablePayableRecordInPeriodScope(record, filters.periodTime)) {
    return false;
  }

  if (filters.direction !== '全部' && record.direction !== filters.direction) {
    return false;
  }

  if (filters.settlementStatus !== '全部' && record.settlementStatus !== filters.settlementStatus) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [record.documentNo, record.counterparty, record.sourceNo, record.sourceTitle, record.category, record.sourceType]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function getFinanceReceivablePayableSettlementProgress(record: FinanceReceivablePayableRecord) {
  if (record.amount <= 0) {
    return '0%';
  }

  const percent = Math.min(100, Math.round((record.settledAmount / record.amount) * 100));
  return `${percent}%`;
}

export function isFinanceReceivablePayablePendingSettlementTransaction(record: FinanceTransactionRecord) {
  return record.status === '待复核';
}

export function isFinanceReceivablePayablePostedSettlementTransaction(record: FinanceTransactionRecord) {
  return record.status === '已入账';
}

export function isFinanceReceivablePayableActiveSettlementTransaction(record: FinanceTransactionRecord) {
  return (
    isFinanceReceivablePayablePendingSettlementTransaction(record) ||
    isFinanceReceivablePayablePostedSettlementTransaction(record)
  );
}

export function getFinanceReceivablePayablePendingSettlementAmount(records: FinanceTransactionRecord[]) {
  return records
    .filter(isFinanceReceivablePayablePendingSettlementTransaction)
    .reduce((total, record) => total + record.amount, 0);
}

export function getFinanceReceivablePayableReviewProgressStatus(
  record: FinanceReceivablePayableRecord,
  linkedTransactionRows: FinanceTransactionRecord[] = []
): FinanceReceivablePayableReviewProgressStatus | undefined {
  const pendingAmount = getFinanceReceivablePayablePendingSettlementAmount(linkedTransactionRows);

  if (pendingAmount <= 0) {
    return undefined;
  }

  return record.settledAmount > 0 ? '部分待复核' : '待复核';
}

export function getFinanceReceivablePayableListTabKey(
  record: FinanceReceivablePayableRecord
): FinanceReceivablePayableListTabKey {
  return record.settlementStatus === '已结清' ? 'settled' : 'open';
}

export function matchesFinanceReceivablePayableListTab(
  record: FinanceReceivablePayableRecord,
  tabKey: FinanceReceivablePayableListTabKey
) {
  return getFinanceReceivablePayableListTabKey(record) === tabKey;
}

export function getFinanceReceivablePayableSettlementStatusOptionsByTab(
  tabKey: FinanceReceivablePayableListTabKey
): Array<FinanceReceivablePayableFilterValue | FinanceReceivablePayableSettlementStatus> {
  const tabStatusOptions =
    tabKey === 'settled'
      ? financeReceivablePayableSettlementStatusOptions.filter((status) => status === '已结清')
      : financeReceivablePayableSettlementStatusOptions.filter((status) => status !== '已结清');

  return ['全部', ...tabStatusOptions];
}

export function isFinanceReceivablePayableSettlementStatusFilterAllowedInTab(
  tabKey: FinanceReceivablePayableListTabKey,
  settlementStatus: FinanceReceivablePayableFilters['settlementStatus']
) {
  return getFinanceReceivablePayableSettlementStatusOptionsByTab(tabKey).some((option) => option === settlementStatus);
}

export function isFinanceReceivablePayableOverdue(
  record: FinanceReceivablePayableRecord,
  today = financeToday
) {
  return (
    isFinanceReceivablePayableConfirmed(record) &&
    getFinanceReceivablePayableDueDate(record) < today &&
    getReceivablePayableOutstandingAmount(record) > 0
  );
}

export function hasFinanceReceivablePayableActiveSettlement(linkedTransactionRows: FinanceTransactionRecord[]) {
  return linkedTransactionRows.some(isFinanceReceivablePayableActiveSettlementTransaction);
}

export function canEditFinanceReceivablePayableRecord(
  record: FinanceReceivablePayableRecord,
  linkedTransactionRows: FinanceTransactionRecord[]
) {
  return !isFinanceReceivablePayableVoided(record) && record.settledAmount <= 0 && !hasFinanceReceivablePayableActiveSettlement(linkedTransactionRows);
}

export function getFinanceReceivablePayableRegisterableAmount(
  record: FinanceReceivablePayableRecord,
  linkedTransactionRows: FinanceTransactionRecord[]
) {
  return Math.max(
    0,
    getReceivablePayableOutstandingAmount(record) -
      getFinanceReceivablePayablePendingSettlementAmount(linkedTransactionRows)
  );
}

export function canRegisterFinanceReceivablePayableSettlement(
  record: FinanceReceivablePayableRecord,
  linkedTransactionRows: FinanceTransactionRecord[]
) {
  return isFinanceReceivablePayableConfirmed(record) && getFinanceReceivablePayableRegisterableAmount(record, linkedTransactionRows) > 0;
}

export function buildFinanceReceivablePayableFilterOptions(
  tabKey?: FinanceReceivablePayableListTabKey
): FinanceReceivablePayableFilterOptions {
  return {
    directionOptions: ['全部', '应收', '应付'],
    settlementStatusOptions: tabKey
      ? getFinanceReceivablePayableSettlementStatusOptionsByTab(tabKey)
      : ['全部', ...financeReceivablePayableSettlementStatusOptions]
  };
}

export function buildFinanceReceivablePayableMetrics(
  records: FinanceReceivablePayableRecord[]
): FinanceReceivablePayableMetrics {
  const confirmedRows = records.filter(isFinanceReceivablePayableConfirmed);
  const receivableRows = confirmedRows.filter((record) => record.direction === '应收');
  const payableRows = confirmedRows.filter((record) => record.direction === '应付');
  const receivableOutstanding = receivableRows.reduce(
    (total, record) => total + getReceivablePayableOutstandingAmount(record),
    0
  );
  const payableOutstanding = payableRows.reduce(
    (total, record) => total + getReceivablePayableOutstandingAmount(record),
    0
  );
  const confirmedAmount = confirmedRows.reduce((total, record) => total + record.amount, 0);
  const overdueRows = confirmedRows.filter((record) => isFinanceReceivablePayableOverdue(record));

  return {
    confirmedAmount,
    overdueRows,
    payableOutstanding,
    payableRows,
    receivableOutstanding,
    receivableRows
  };
}

export function updateFinanceReceivablePayableRecordFromForm(
  record: FinanceReceivablePayableRecord,
  form: FinanceReceivablePayableFormValue
): FinanceReceivablePayableRecord {
  const categorySnapshot = getFinanceCategorySnapshot(form.category);
  const nextRecordSeed = {
    ...record,
    accountingPeriod: form.accountingPeriod,
    amount: form.amount,
    category: form.category,
    confirmDate: form.confirmDate,
    direction: form.direction,
    dueDate: form.dueDate,
    sourceType: form.sourceType
  };

  return {
    ...record,
    accountingPeriod: form.accountingPeriod,
    amount: form.amount,
    category: form.category,
    categorySnapshot,
    confirmDate: form.confirmDate,
    dueDate: form.dueDate,
    files: form.files.map((file) => ({
      ...file,
      status: file.status === '已选择' ? '已上传' : file.status,
      updatedAt: file.updatedAt || financeToday
    })),
    note: form.note,
    owner: form.owner,
    operationRecords: [
      {
        action: '调整事项',
        actor: form.owner,
        id: `${record.id}-adjust-${record.operationRecords.length + 1}`,
        object: record.documentNo,
        summary: `调整确认金额为 ${formatMoney(form.amount)}，到期日为 ${form.dueDate}`,
        time: `${financeToday} 09:00`
      },
      ...record.operationRecords
    ],
    reportAggregation: categorySnapshot.reportAggregation,
    taxBasis: getDefaultReceivablePayableTaxBasis(nextRecordSeed),
    updatedAt: `${financeToday} 09:00`
  };
}

function buildNextFinanceTransactionNo(records: FinanceTransactionRecord[], occurredAt: string) {
  const period = getAccountingPeriod(occurredAt).replace('-', '');
  const maxSequence = records.reduce((max, record) => {
    if (record.transactionNo.slice(4, 10) !== period) {
      return max;
    }

    const sequence = Number(record.transactionNo.slice(-4));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `FIN-${period}-${String(maxSequence + 1).padStart(4, '0')}`;
}

function getSettlementTransactionDirection(record: FinanceReceivablePayableRecord): FinanceTransactionDirection {
  return record.direction === '应收' ? '收入' : '支出';
}

function getSettlementPaymentMethod(record: FinanceReceivablePayableRecord): FinancePaymentMethod {
  return record.direction === '应收' ? '对公账户收款' : '对公账户付款';
}

function getSettlementTransactionSourceType(record: FinanceReceivablePayableRecord): FinanceSourceType {
  if (record.sourceType === '员工报销') {
    return '报销单';
  }

  if (record.sourceType === '项目阶段确认') {
    return '合同应收';
  }

  if (record.sourceType === '材料采购' || record.sourceType === '运营费用') {
    return '手工登记';
  }

  return record.sourceType;
}

export function buildFinanceReceivablePayableSettlementTransaction(
  record: FinanceReceivablePayableRecord,
  form: FinanceReceivablePayableSettlementFormValue,
  financeRows: FinanceTransactionRecord[],
  publicAccountRef: PublicAccountRef
): FinanceTransactionRecord {
  const transactionNo = buildNextFinanceTransactionNo(financeRows, form.occurredAt);
  const accountingPeriod = getAccountingPeriod(form.occurredAt);
  const action = record.direction === '应收' ? '登记收款' : '登记付款';

  return {
    accountingPeriod,
    amount: form.amount,
    category: record.category,
    categorySnapshot: getFinanceCategorySnapshot(record.category),
    counterparty: record.counterparty,
    counterpartyType: record.counterpartyType,
    currency: 'CNY',
    direction: getSettlementTransactionDirection(record),
    files: form.files.map((file) => ({
      ...file,
      status: '已上传',
      updatedAt: financeToday
    })),
    id: `fin-rp-${record.id}-${Date.now()}`,
    note: form.note.trim(),
    occurredAt: form.occurredAt,
    operationRecords: [
      {
        action,
        actor: '李明',
        id: `fin-rp-op-${Date.now()}`,
        object: transactionNo,
        summary: `${record.documentNo} ${action} ${formatMoney(form.amount)}`,
        time: `${financeToday} 10:00`
      }
    ],
    paymentMethod: getSettlementPaymentMethod(record),
    publicAccountId: publicAccountRef.publicAccountId,
    publicAccountSnapshot: publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    reviewDueAt: getDefaultFinanceReviewDueAt(form.occurredAt),
    sourceNo: record.documentNo,
    sourceTitle: record.sourceTitle,
    sourceType: getSettlementTransactionSourceType(record),
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 10:00`,
    voucherStatus: form.files.length > 0 ? '已上传' : '待补充'
  };
}

export function linkFinanceReceivablePayableSettlementTransaction(
  record: FinanceReceivablePayableRecord,
  transaction: FinanceTransactionRecord
): FinanceReceivablePayableRecord {
  if (record.linkedTransactionNos.includes(transaction.transactionNo)) {
    return record;
  }

  return {
    ...record,
    linkedTransactionNos: [...record.linkedTransactionNos, transaction.transactionNo],
    operationRecords: [
      {
        action: record.direction === '应收' ? '登记收款流水' : '登记付款流水',
        actor: '李明',
        id: `${record.id}-settlement-${record.operationRecords.length + 1}`,
        object: record.documentNo,
        summary: `登记待复核流水 ${transaction.transactionNo}，金额 ${formatMoney(transaction.amount)}`,
        time: `${financeToday} 10:00`
      },
      ...record.operationRecords
    ],
    updatedAt: `${financeToday} 10:00`
  };
}

export function isFinanceReceivablePayableSettlementForRecord(
  record: FinanceReceivablePayableRecord,
  transaction: FinanceTransactionRecord
) {
  const expectedDirection = record.direction === '应收' ? '收入' : '支出';

  return (
    transaction.direction === expectedDirection &&
    (record.linkedTransactionNos.includes(transaction.transactionNo) || transaction.sourceNo === record.documentNo)
  );
}

export function getFinanceReceivablePayableLinkedTransactionRows(
  record: FinanceReceivablePayableRecord,
  financeRows: FinanceTransactionRecord[] = []
) {
  return financeRows.filter((transaction) => isFinanceReceivablePayableSettlementForRecord(record, transaction));
}

function getFinanceReceivablePayableSettlementStatusAfterPostedSettlement(
  record: FinanceReceivablePayableRecord,
  settledAmount: number
): FinanceReceivablePayableSettlementStatus {
  if (settledAmount >= record.amount && record.amount > 0) {
    return '已结清';
  }

  if (settledAmount > 0) {
    return '部分结清';
  }

  return '未结清';
}

export function applyFinanceReceivablePayableSettlementReview(
  records: FinanceReceivablePayableRecord[],
  transaction: FinanceTransactionRecord
) {
  if (!isFinanceReceivablePayablePendingSettlementTransaction(transaction)) {
    return records;
  }

  return records.map((record) => {
    if (!isFinanceReceivablePayableSettlementForRecord(record, transaction)) {
      return record;
    }

    const nextSettledAmount = Math.min(record.amount, record.settledAmount + transaction.amount);
    const nextLinkedTransactionNos = record.linkedTransactionNos.includes(transaction.transactionNo)
      ? record.linkedTransactionNos
      : [...record.linkedTransactionNos, transaction.transactionNo];
    const action = record.direction === '应收' ? '确认收款入账' : '确认付款入账';

    return {
      ...record,
      linkedTransactionNos: nextLinkedTransactionNos,
      operationRecords: [
        {
          action,
          actor: '财务复核',
          id: `${record.id}-posted-${transaction.transactionNo}`,
          object: record.documentNo,
          summary: `${transaction.transactionNo} 复核入账，${record.direction === '应收' ? '已收' : '已付'}增加 ${formatMoney(transaction.amount)}`,
          time: `${financeToday} 15:30`
        },
        ...record.operationRecords
      ],
      settledAmount: nextSettledAmount,
      settlementStatus: getFinanceReceivablePayableSettlementStatusAfterPostedSettlement(record, nextSettledAmount),
      updatedAt: `${financeToday} 15:30`
    };
  });
}
