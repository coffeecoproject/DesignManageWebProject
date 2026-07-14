import { getDateScopeRange, type DateScopeFilterValue } from '../../components/DateFilterFields';
import type {
  AccountingPeriodCloseFinancialStatementSnapshot,
  AccountingPeriodCloseGeneralLedgerRowSnapshot,
  AccountingPeriodCloseCheckSnapshotItem,
  AccountingPeriodCloseSummarySnapshot,
  AccountingLedgerEntry,
  AccountingVoucherLaterPeriodAdjustmentRecord,
  AccountingPeriodLockRecord,
  AccountingVoucherRecord,
  AccountingVoucherStatus
} from './financeAccountingVoucherModel';
import type { FinanceTransactionRecord } from './financeData';
import {
  buildFinanceFinancialStatementReport,
  type FinanceFinancialStatementReport
} from './financeFinancialStatementsModel';
import {
  defaultGeneralLedgerFilters,
  buildGeneralLedgerResponse,
  generalLedgerDefaultMonth,
  type GeneralLedgerSubjectBalanceRow
} from './financeGeneralLedgerModel';
import type { FinanceTaxMatterRecord, FinanceTaxMatterType } from './financeTaxFilingData';
import { getTaxMatterAccountingStatus } from './financeTaxMatterModel';
import type { FinanceMonthEndMatterRecord } from './financeMonthEndModel';
import { financeToday, getAccountingPeriodFromBusinessPeriod } from './financeUtils';

export type FinancePeriodCloseStatus = '可结账' | '需处理' | '已结账';
export type FinancePeriodCloseContinuityStatus = '账套启用期' | '前期已结账' | '待前期结账' | '锁定顺序异常';
export type FinancePeriodCloseCheckStatus = '通过' | '需处理';
export type FinancePeriodCloseCheckCode =
  | 'voucher_preparation'
  | 'voucher_booking'
  | 'month_end_matters'
  | 'general_ledger_trial_balance'
  | 'financial_statements'
  | 'cash_review'
  | 'cash_reconciliation'
  | 'tax_handling'
  | 'social_insurance_housing_fund';

export type FinancePeriodCloseFilters = {
  accountingPeriodTime: DateScopeFilterValue;
  closeStatus: '全部' | FinancePeriodCloseStatus;
  keyword: string;
};

export type FinancePeriodCloseCheckItem = {
  actionLabel?: string;
  actionPath?: string;
  actionQuery?: string;
  code: FinancePeriodCloseCheckCode;
  detail: string;
  status: FinancePeriodCloseCheckStatus;
  sourceSummary: string;
  title: string;
  nextStep: string;
};

export type FinancePeriodCloseRecord = {
  accountingPeriod: string;
  blockedCheckCount: number;
  bookedVoucherCount: number;
  canClose: boolean;
  closedAt?: string;
  closedBy?: string;
  closeReason?: string;
  continuityBlockerPeriod?: string;
  continuityDetail: string;
  continuityStatus: FinancePeriodCloseContinuityStatus;
  creditTotal: number;
  debitTotal: number;
  financialStatementSnapshot?: AccountingPeriodCloseFinancialStatementSnapshot;
  readyToBookVoucherCount: number;
  generalLedgerSnapshotRows?: AccountingPeriodCloseGeneralLedgerRowSnapshot[];
  generatedVoucherCount: number;
  issueVoucherCount: number;
  pendingReviewCashFlowCount: number;
  pendingVoucherCount: number;
  periodLabel: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  financialStatementReadinessDetail: string;
  financialStatementReadinessMode: '待结账' | '正式报表' | '暂不可出具';
  laterAdjustmentSummary: string;
  laterAdjustmentCount: number;
  laterAdjustmentSourceCount: number;
  laterAdjustmentTargetCount: number;
  socialInsurancePendingCount: number;
  status: FinancePeriodCloseStatus;
  taxHandlingPendingCount: number;
  trialBalanceDifference: number;
  trialBalanceStatus: '平衡' | '不平衡';
  unbookedVoucherCount: number;
  unreconciledCashFlowCount: number;
  voucherCount: number;
  checkItems: FinancePeriodCloseCheckItem[];
};

export type FinancePeriodCloseMetrics = {
  closeableCount: number;
  closedCount: number;
  periodCount: number;
  pendingCount: number;
};

export type FinancePeriodCloseCheckAuthority = 'frontend_session_adapter' | 'backend_close_checks';

export type FinancePeriodCloseReadModel = {
  authority: FinancePeriodCloseCheckAuthority;
  generatedAt: string;
  metrics: FinancePeriodCloseMetrics;
  pendingBackendCapabilities: string[];
  records: FinancePeriodCloseRecord[];
};

export function createFinancePeriodCloseSummarySnapshot(
  record: FinancePeriodCloseRecord
): AccountingPeriodCloseSummarySnapshot {
  return {
    blockedCheckCount: record.blockedCheckCount,
    bookedVoucherCount: record.bookedVoucherCount,
    creditTotal: record.creditTotal,
    debitTotal: record.debitTotal,
    financialStatementReport: record.financialStatementSnapshot
      ? cloneFinancialStatementSnapshot(record.financialStatementSnapshot)
      : undefined,
    generalLedgerRows: record.generalLedgerSnapshotRows
      ? cloneGeneralLedgerSnapshotRows(record.generalLedgerSnapshotRows)
      : undefined,
    readyToBookVoucherCount: record.readyToBookVoucherCount,
    generatedVoucherCount: record.generatedVoucherCount,
    issueVoucherCount: record.issueVoucherCount,
    pendingReviewCashFlowCount: record.pendingReviewCashFlowCount,
    pendingVoucherCount: record.pendingVoucherCount,
    socialInsurancePendingCount: record.socialInsurancePendingCount,
    taxHandlingPendingCount: record.taxHandlingPendingCount,
    trialBalanceDifference: record.trialBalanceDifference,
    trialBalanceStatus: record.trialBalanceStatus,
    unbookedVoucherCount: record.unbookedVoucherCount,
    unreconciledCashFlowCount: record.unreconciledCashFlowCount,
    voucherCount: record.voucherCount
  };
}

function cloneGeneralLedgerSnapshotRows(
  rows: AccountingPeriodCloseGeneralLedgerRowSnapshot[]
): AccountingPeriodCloseGeneralLedgerRowSnapshot[] {
  return rows.map((row) => ({
    ...row,
    entries: row.entries.map((entry) => ({ ...entry }))
  }));
}

function cloneFinancialStatementSnapshot(
  snapshot: AccountingPeriodCloseFinancialStatementSnapshot
): AccountingPeriodCloseFinancialStatementSnapshot {
  return {
    ...snapshot,
    balanceSheetLines: snapshot.balanceSheetLines.map((line) => ({
      ...line,
      sourceSubjectCodes: [...line.sourceSubjectCodes]
    })),
    cashFlowLines: snapshot.cashFlowLines.map((line) => ({
      ...line,
      sourceSubjectCodes: [...line.sourceSubjectCodes],
      voucherNos: [...line.voucherNos]
    })),
    cashFlowMappingGaps: snapshot.cashFlowMappingGaps.map((gap) => ({
      ...gap,
      cashSubjectCodes: [...gap.cashSubjectCodes],
      counterpartySubjectCodes: [...gap.counterpartySubjectCodes]
    })),
    profitLines: snapshot.profitLines.map((line) => ({
      ...line,
      sourceSubjectCodes: [...line.sourceSubjectCodes]
    }))
  };
}

function createGeneralLedgerSnapshotRows(
  rows: GeneralLedgerSubjectBalanceRow[]
): AccountingPeriodCloseGeneralLedgerRowSnapshot[] {
  return rows.map((row) => ({
    ...row,
    entries: row.entries.map((entry) => ({ ...entry }))
  }));
}

function createFinancialStatementSnapshot(
  report: FinanceFinancialStatementReport
): AccountingPeriodCloseFinancialStatementSnapshot {
  return {
    accountingPeriod: report.accountingPeriod,
    assetTotal: report.assetTotal,
    balanceSheetDifference: report.balanceSheetDifference,
    balanceSheetLines: report.balanceSheetLines.map((line) => ({
      ...line,
      openingAmount: line.openingAmount,
      sourceSubjectCodes: [...line.sourceSubjectCodes]
    })),
    balanceSheetReadiness: report.balanceSheetReadiness,
    balanceSheetReadinessDetail: report.balanceSheetReadinessDetail,
    cashFlowLines: report.cashFlowLines.map((line) => ({
      ...line,
      sourceSubjectCodes: [...line.sourceSubjectCodes],
      voucherNos: [...line.voucherNos],
      yearToDateAmount: line.yearToDateAmount
    })),
    cashFlowClosingBalance: report.cashFlowClosingBalance,
    cashFlowMappingGaps: report.cashFlowMappingGaps.map((gap) => ({
      ...gap,
      cashSubjectCodes: [...gap.cashSubjectCodes],
      counterpartySubjectCodes: [...gap.counterpartySubjectCodes]
    })),
    cashFlowNetAmount: report.cashFlowNetAmount,
    cashFlowOpeningBalance: report.cashFlowOpeningBalance,
    cashFlowReadiness: report.cashFlowReadiness,
    cashFlowReadinessDetail: report.cashFlowReadinessDetail,
    cashFlowReconciliationDifference: report.cashFlowReconciliationDifference,
    cashFlowYearToDateClosingBalance: report.cashFlowYearToDateClosingBalance,
    cashFlowYearToDateNetAmount: report.cashFlowYearToDateNetAmount,
    cashFlowYearToDateOpeningBalance: report.cashFlowYearToDateOpeningBalance,
    cashFlowYearToDateReconciliationDifference: report.cashFlowYearToDateReconciliationDifference,
    financialStatementReadiness: report.financialStatementReadiness,
    financialStatementReadinessDetail: report.financialStatementReadinessDetail,
    liabilityEquityTotal: report.liabilityEquityTotal,
    periodLabel: report.periodLabel,
    profitLines: report.profitLines.map((line) => ({
      ...line,
      yearToDateAmount: line.yearToDateAmount,
      sourceSubjectCodes: [...line.sourceSubjectCodes]
    })),
    profitTotal: report.profitTotal,
    reportBasis: report.reportBasis,
    trialBalanceStatus: report.trialBalanceStatus
  };
}

export const financePeriodCloseDefaultMonth = generalLedgerDefaultMonth;
export const financePeriodCloseStatusOptions: Array<'全部' | FinancePeriodCloseStatus> = [
  '全部',
  '可结账',
  '需处理',
  '已结账'
];
export const defaultFinancePeriodCloseFilters: FinancePeriodCloseFilters = {
  accountingPeriodTime: { mode: 'all' },
  closeStatus: '全部',
  keyword: ''
};

const closingRelevantVoucherStatuses = new Set<AccountingVoucherStatus>([
  '待生成',
  '需处理',
  '待记账',
  '已记账',
  '已冲销'
]);

const currentFinancePeriodCloseCheckCodes = new Set<string>([
  'voucher_preparation',
  'voucher_booking',
  'month_end_matters',
  'general_ledger_trial_balance',
  'financial_statements',
  'cash_review',
  'cash_reconciliation',
  'tax_handling',
  'social_insurance_housing_fund'
]);

function isFinancePeriodCloseCheckCode(code: string): code is FinancePeriodCloseCheckCode {
  return currentFinancePeriodCloseCheckCodes.has(code);
}

const socialInsuranceMatterTypes = new Set<FinanceTaxMatterType>(['社保缴纳', '公积金缴纳']);

type PeriodCloseCheckAction = { label: string; path: string; query?: string };

const periodCloseCheckActions: Partial<Record<FinancePeriodCloseCheckCode, PeriodCloseCheckAction>> = {
  cash_review: {
    label: '去流水复核',
    path: '/finance/review'
  },
  cash_reconciliation: {
    label: '去银行对账',
    path: '/finance/bank-reconciliation'
  },
  general_ledger_trial_balance: {
    label: '去总账',
    path: '/finance/general-ledger'
  },
  financial_statements: {
    label: '去财务报表',
    path: '/finance/financial-statements'
  },
  month_end_matters: {
    label: '去月末事项',
    path: '/finance/month-end'
  },
  social_insurance_housing_fund: {
    label: '去社保公积金',
    path: '/salary/social-insurance'
  },
  tax_handling: {
    label: '去税务办理',
    path: '/tax/handling'
  },
  voucher_booking: {
    label: '去会计凭证',
    path: '/finance/accounting-vouchers'
  },
  voucher_preparation: {
    label: '去会计凭证',
    path: '/finance/accounting-vouchers'
  }
};

function buildAccountingVoucherCheckAction(
  rows: AccountingVoucherRecord[],
  period: string
): PeriodCloseCheckAction {
  const params = new URLSearchParams({ period });
  const statuses = new Set(rows.map((record) => record.status));
  const [firstRow] = rows;

  if (statuses.size === 1 && firstRow) {
    params.set('status', firstRow.status);
  }

  if (rows.length === 1 && firstRow) {
    params.set('sourceNo', firstRow.sourceNo || firstRow.voucherNo);
  }

  return {
    label: '去会计凭证',
    path: '/finance/accounting-vouchers',
    query: params.toString()
  };
}

function getTaxMatterAccountingPeriod(record: FinanceTaxMatterRecord) {
  if (record.periodType === '年度') {
    return `${record.period.slice(0, 4)}-12`;
  }

  return getAccountingPeriodFromBusinessPeriod(record.period);
}

function isSocialInsuranceMatter(record: FinanceTaxMatterRecord) {
  return socialInsuranceMatterTypes.has(record.matterType);
}

function getVoucherSourceReadinessDetail({ pendingSourceCount }: { pendingSourceCount: number }) {
  if (pendingSourceCount === 0) {
    return '本期凭证来源已具备记账条件。';
  }

  return `还有 ${pendingSourceCount} 项需补前置处理。`;
}

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

function getPeriodLabel(period: string) {
  return `${period} 期间`;
}

function createCheckItem({
  action,
  code,
  detail,
  nextStep,
  passed,
  sourceSummary,
  title
}: {
  action?: PeriodCloseCheckAction;
  code: FinancePeriodCloseCheckCode;
  detail: string;
  nextStep: string;
  passed: boolean;
  sourceSummary: string;
  title: string;
}): FinancePeriodCloseCheckItem {
  const resolvedAction = action ?? periodCloseCheckActions[code];

  return {
    ...(passed || !resolvedAction
      ? {}
      : { actionLabel: resolvedAction.label, actionPath: resolvedAction.path, actionQuery: resolvedAction.query }),
    code,
    detail,
    nextStep: passed ? '无需处理' : nextStep,
    sourceSummary,
    status: passed ? '通过' : '需处理',
    title
  };
}

function summarizeCheckSources(moduleLabel: string, sourceNos: string[] = [], unit = '项') {
  const uniqueSourceNos = [...new Set(sourceNos.filter(Boolean))];

  if (uniqueSourceNos.length === 0) {
    return moduleLabel;
  }

  return `${moduleLabel} / ${uniqueSourceNos.length} ${unit}`;
}

function getCheckSourceSummaryUnit(code: FinancePeriodCloseCheckCode) {
  return code === 'cash_review' || code === 'cash_reconciliation' ? '条' : '项';
}

function normalizeStoredCheckSourceSummary({
  code,
  sourceSummary,
  title
}: {
  code: FinancePeriodCloseCheckCode;
  sourceSummary?: string;
  title: string;
}) {
  if (!sourceSummary) {
    return title;
  }

  const countSummaryMatch = sourceSummary.match(/^(.*) \/ \d+ (项|条)$/);

  if (countSummaryMatch) {
    return sourceSummary;
  }

  const unit = getCheckSourceSummaryUnit(code);
  const explicitCountMatch = sourceSummary.match(/等\s*(\d+)\s*(项|条)/);

  if (explicitCountMatch) {
    const moduleLabel = sourceSummary.split(' / ')[0] || title;

    return `${moduleLabel} / ${explicitCountMatch[1]} ${unit}`;
  }

  if (sourceSummary.includes(' / ')) {
    const [moduleLabel, ...sourceParts] = sourceSummary.split(' / ');
    const sourceCount = Math.max(
      1,
      sourceParts
        .join(' / ')
        .split(/[、,，]/)
        .map((source) => source.trim())
        .filter(Boolean).length
    );

    return `${moduleLabel || title} / ${sourceCount} ${unit}`;
  }

  return sourceSummary;
}

function getFinancialStatementReadinessMode({
  financialStatementReadiness,
  periodLock,
  trialBalanceStatus
}: {
  financialStatementReadiness: FinanceFinancialStatementReport['financialStatementReadiness'];
  periodLock?: AccountingPeriodLockRecord;
  trialBalanceStatus: FinancePeriodCloseRecord['trialBalanceStatus'];
}) {
  if (trialBalanceStatus !== '平衡' || financialStatementReadiness !== '可出具') {
    return '暂不可出具';
  }

  return periodLock ? '正式报表' : '待结账';
}

function getFinancialStatementReadinessDetail({
  financialStatementReadinessDetail,
  mode
}: {
  financialStatementReadinessDetail: string;
  mode: FinancePeriodCloseRecord['financialStatementReadinessMode'];
}) {
  if (mode === '正式报表') {
    return '本期已结账，报表按结账时快照只读回看。';
  }

  if (mode === '待结账') {
    return '本期报表检查已通过，确认结账后生成正式报表。';
  }

  return financialStatementReadinessDetail;
}

function getLaterAdjustmentSummary({
  accountingPeriod,
  periodLock,
  rows
}: {
  accountingPeriod: string;
  periodLock?: AccountingPeriodLockRecord;
  rows: AccountingVoucherLaterPeriodAdjustmentRecord[];
}) {
  const sourcePeriodRows = rows.filter((record) => record.originalAccountingPeriod === accountingPeriod);
  const targetPeriodRows = rows.filter((record) => record.accountingPeriod === accountingPeriod);

  if (periodLock) {
    return sourcePeriodRows.length > 0
      ? `本期已通过后续期间发起 ${sourcePeriodRows.length} 项调整；如需继续修正，仍应在后续开放期间创建调整事项，反结账属于异常流程。`
      : '本期已结账；如需修正，请优先在后续开放期间创建调整事项，反结账属于异常流程。';
  }

  if (targetPeriodRows.length > 0) {
    return `本期承接 ${targetPeriodRows.length} 项后续调整事项，未记账会继续阻断结账。`;
  }

  return '本期暂无后续调整事项。';
}

function applyClosedPeriodCheckReadback(
  checkItems: FinancePeriodCloseCheckItem[],
  periodLock?: AccountingPeriodLockRecord
) {
  if (!periodLock) {
    return checkItems;
  }

  const snapshotItems = normalizeClosedPeriodCheckSnapshot(periodLock.closeCheckSnapshot);
  const readbackItems = snapshotItems.length > 0
    ? snapshotItems
    : checkItems.map((item) => ({
        ...item,
        detail: '本期间已结账；仅按结账结果回看，不再按当前来源单据状态重算该检查。',
        sourceSummary: '结账记录',
        status: '通过' as const
      }));

  return readbackItems.map((item) => ({
    ...item,
    actionLabel: undefined,
    actionPath: undefined,
    nextStep: '期间已结账，只读回看'
  }));
}

function normalizeClosedPeriodCheckSnapshot(snapshotItems: AccountingPeriodCloseCheckSnapshotItem[] = []): FinancePeriodCloseCheckItem[] {
  return snapshotItems
    .filter((item) => item.code && item.title && isFinancePeriodCloseCheckCode(item.code))
    .map((item) => {
      const code = item.code as FinancePeriodCloseCheckCode;

      return {
        code,
        detail: item.detail,
        nextStep: item.nextStep ?? '期间已结账，只读回看',
        sourceSummary: normalizeStoredCheckSourceSummary({ code, sourceSummary: item.sourceSummary, title: item.title }),
        status: item.status === '通过' ? '通过' : '需处理',
        title: item.title
      };
    });
}

function getTrialBalanceStatusFromSnapshot(status: string): FinancePeriodCloseRecord['trialBalanceStatus'] {
  return status === '平衡' ? '平衡' : '不平衡';
}

function collectPeriods({
  financeRows,
  laterPeriodAdjustmentRows,
  ledgerEntries,
  monthEndMatterRows,
  periodLocks,
  taxMatterRows,
  voucherRows
}: {
  financeRows: FinanceTransactionRecord[];
  laterPeriodAdjustmentRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  ledgerEntries: AccountingLedgerEntry[];
  monthEndMatterRows: FinanceMonthEndMatterRecord[];
  periodLocks: AccountingPeriodLockRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
  voucherRows: AccountingVoucherRecord[];
}) {
  const periods = new Set<string>([financePeriodCloseDefaultMonth]);

  voucherRows.forEach((record) => periods.add(record.accountingPeriod));
  laterPeriodAdjustmentRows.forEach((record) => {
    periods.add(record.accountingPeriod);
    periods.add(record.originalAccountingPeriod);
  });
  ledgerEntries.forEach((entry) => periods.add(entry.accountingPeriod));
  financeRows.forEach((record) => periods.add(record.accountingPeriod));
  monthEndMatterRows.forEach((record) => periods.add(record.accountingPeriod));
  taxMatterRows.forEach((record) => {
    const accountingPeriod = getTaxMatterAccountingPeriod(record);

    if (accountingPeriod) {
      periods.add(accountingPeriod);
    }
  });
  periodLocks.forEach((record) => periods.add(record.accountingPeriod));

  return [...periods].sort((left, right) => right.localeCompare(left));
}

function getNextPeriod(accountingPeriod: string) {
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

function getPreviousPeriod(accountingPeriod: string) {
  const match = accountingPeriod.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return accountingPeriod;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;

  return `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
}

function expandAccountingPeriods({
  accountingPeriodStart,
  periods
}: {
  accountingPeriodStart?: string;
  periods: string[];
}) {
  if (!accountingPeriodStart) {
    return periods;
  }

  const inScopePeriods = periods.filter((period) => period >= accountingPeriodStart);
  const latestPeriod = inScopePeriods.sort((left, right) => left.localeCompare(right)).at(-1) ?? accountingPeriodStart;
  const expandedPeriods: string[] = [];
  let cursor = accountingPeriodStart;

  while (cursor <= latestPeriod) {
    expandedPeriods.push(cursor);
    const nextPeriod = getNextPeriod(cursor);

    if (nextPeriod === cursor) {
      break;
    }

    cursor = nextPeriod;
  }

  return expandedPeriods;
}

function applyPeriodCloseContinuity({
  accountingPeriodStart,
  periodLocks,
  records
}: {
  accountingPeriodStart?: string;
  periodLocks: AccountingPeriodLockRecord[];
  records: FinancePeriodCloseRecord[];
}) {
  const orderedRecords = [...records].sort((left, right) => left.accountingPeriod.localeCompare(right.accountingPeriod));
  const firstAccountingPeriod = accountingPeriodStart ?? orderedRecords[0]?.accountingPeriod;
  const closedPeriods = new Set(
    periodLocks.filter((record) => record.status === '已结账').map((record) => record.accountingPeriod)
  );

  return orderedRecords.map((record) => {
    if (!firstAccountingPeriod || record.accountingPeriod === firstAccountingPeriod) {
      return {
        ...record,
        continuityDetail: `账套自 ${record.accountingPeriod} 启用，本期可作为首个结账期间。`,
        continuityStatus: '账套启用期' as const
      };
    }

    const previousPeriod = getPreviousPeriod(record.accountingPeriod);
    const previousPeriodClosed = closedPeriods.has(previousPeriod);

    if (record.status === '已结账') {
      return previousPeriodClosed
        ? {
            ...record,
            continuityDetail: `前期 ${previousPeriod} 已结账。`,
            continuityStatus: '前期已结账' as const
          }
        : {
            ...record,
            continuityBlockerPeriod: previousPeriod,
            continuityDetail: `前期 ${previousPeriod} 未结账，当前已结账记录存在顺序异常。`,
            continuityStatus: '锁定顺序异常' as const
          };
    }

    if (previousPeriodClosed) {
      return {
        ...record,
        continuityDetail: `前期 ${previousPeriod} 已结账。`,
        continuityStatus: '前期已结账' as const
      };
    }

    return {
      ...record,
      canClose: false,
      continuityBlockerPeriod: previousPeriod,
      continuityDetail: `需先完成 ${previousPeriod} 期间结账，当前期间才能结账。`,
      continuityStatus: '待前期结账' as const,
      status: '需处理' as const
    };
  });
}

function isPeriodInsideFilter(period: string, value: DateScopeFilterValue) {
  const range = getDateScopeRange(value, financePeriodCloseDefaultMonth);

  if (!range) {
    return true;
  }

  const periodStart = `${period}-01`;
  const periodEnd = `${period}-31`;

  return periodStart <= range.endDate && periodEnd >= range.startDate;
}

function matchesPeriodKeyword(record: FinancePeriodCloseRecord, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return [
    record.accountingPeriod,
    record.periodLabel,
    record.status,
    record.continuityStatus,
    record.continuityBlockerPeriod ?? '',
    record.continuityDetail,
    record.trialBalanceStatus,
    ...record.checkItems.flatMap((item) => [item.title, item.detail, item.status])
  ].some((value) => value.toLowerCase().includes(normalizedKeyword));
}

function matchesPeriodCloseStatus(record: FinancePeriodCloseRecord, closeStatus: FinancePeriodCloseFilters['closeStatus']) {
  return closeStatus === '全部' || record.status === closeStatus;
}

function buildPeriodCloseRecord({
  financeRows,
  laterPeriodAdjustmentRows,
  ledgerEntries,
  monthEndMatterRows,
  period,
  periodLocks,
  taxMatterRows,
  voucherRows
}: {
  financeRows: FinanceTransactionRecord[];
  laterPeriodAdjustmentRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  ledgerEntries: AccountingLedgerEntry[];
  monthEndMatterRows: FinanceMonthEndMatterRecord[];
  period: string;
  periodLocks: AccountingPeriodLockRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
  voucherRows: AccountingVoucherRecord[];
}): FinancePeriodCloseRecord {
  const periodLock = periodLocks.find((record) => record.accountingPeriod === period && record.status === '已结账');
  const periodLockHistory = periodLocks.find((record) => record.accountingPeriod === period);
  const periodVoucherRows = voucherRows.filter((record) => record.accountingPeriod === period && closingRelevantVoucherStatuses.has(record.status));
  const sourcePendingVoucherRows = periodVoucherRows.filter((record) =>
    record.status === '待生成' || record.status === '需处理'
  );
  const unbookedVoucherRows = periodVoucherRows.filter((record) => record.status === '待记账');
  const issueVoucherCount = periodVoucherRows.filter((record) => record.status === '需处理').length;
  const pendingVoucherCount = periodVoucherRows.filter((record) => record.status === '待生成').length;
  const readyToBookVoucherCount = unbookedVoucherRows.length;
  const unbookedVoucherCount = unbookedVoucherRows.length;
  const bookedVoucherCount = periodVoucherRows.filter((record) => record.status === '已记账' || record.status === '已冲销').length;
  const generatedVoucherCount = periodVoucherRows.filter((record) =>
    record.status === '已记账' || record.status === '已冲销'
  ).length;
  const unreconciledCashFlowRows = financeRows.filter((record) =>
    record.accountingPeriod === period && record.status === '已入账' && record.reconciliationStatus !== '已对账'
  );
  const unreconciledCashFlowCount = unreconciledCashFlowRows.length;
  const pendingReviewCashFlowRows = financeRows.filter((record) =>
    record.accountingPeriod === period && record.status === '待复核'
  );
  const pendingReviewCashFlowCount = pendingReviewCashFlowRows.length;
  const periodTaxMatterRows = taxMatterRows.filter((record) => getTaxMatterAccountingPeriod(record) === period);
  const pendingTaxHandlingRows = periodTaxMatterRows.filter((record) =>
    !isSocialInsuranceMatter(record)
      && (
        record.dataStatus !== '已确认'
        || ['数据待确认', '待申报', '待补回执'].includes(record.processStatus)
      )
  );
  const taxHandlingPendingCount = pendingTaxHandlingRows.length;
  const pendingSocialInsuranceRows = periodTaxMatterRows.filter((record) =>
    isSocialInsuranceMatter(record) && getTaxMatterAccountingStatus(record) === '待确认'
  );
  const socialInsurancePendingCount = pendingSocialInsuranceRows.length;
  const pendingMonthEndMatterRows = monthEndMatterRows.filter(
    (record) => record.accountingPeriod === period && record.status === '待确认'
  );
  const ledgerResponse = buildGeneralLedgerResponse({
    entries: ledgerEntries,
    filters: {
      ...defaultGeneralLedgerFilters,
      accountingPeriodTime: { mode: 'month', month: period }
    },
    periodLocks
  });
  const { periodSummary } = ledgerResponse;
  const financialStatementReport = buildFinanceFinancialStatementReport({
    periodSummary,
    subjectRows: ledgerResponse.rows
  });
  const liveGeneralLedgerSnapshotRows = createGeneralLedgerSnapshotRows(ledgerResponse.rows);
  const liveFinancialStatementSnapshot = createFinancialStatementSnapshot(financialStatementReport);
  const liveFinancialStatementReadinessMode = getFinancialStatementReadinessMode({
    financialStatementReadiness: financialStatementReport.financialStatementReadiness,
    periodLock,
    trialBalanceStatus: periodSummary.trialBalanceStatus
  });
  const laterAdjustmentSourceRows = laterPeriodAdjustmentRows.filter((record) => record.originalAccountingPeriod === period);
  const laterAdjustmentTargetRows = laterPeriodAdjustmentRows.filter((record) => record.accountingPeriod === period);
  const laterAdjustmentCount = laterAdjustmentSourceRows.length + laterAdjustmentTargetRows.length;

  const checkItems: FinancePeriodCloseCheckItem[] = [
    createCheckItem({
      code: 'month_end_matters',
      detail: pendingMonthEndMatterRows.length === 0
        ? '本期月末事项已确认或无需处理。'
        : `还有 ${pendingMonthEndMatterRows.length} 项月末事项待确认。`,
      nextStep: '需先在月末事项确认本期折旧、摊销或收入确认来源',
      passed: pendingMonthEndMatterRows.length === 0,
      sourceSummary: summarizeCheckSources('月末事项', pendingMonthEndMatterRows.map((record) => record.sourceNo)),
      title: '月末事项'
    }),
    createCheckItem({
      action: buildAccountingVoucherCheckAction(sourcePendingVoucherRows, period),
      code: 'voucher_preparation',
      detail: getVoucherSourceReadinessDetail({
        pendingSourceCount: issueVoucherCount + pendingVoucherCount
      }),
      nextStep: '需先在会计凭证完成待生成或需处理事项',
      passed: issueVoucherCount + pendingVoucherCount === 0,
      sourceSummary: summarizeCheckSources('会计凭证', sourcePendingVoucherRows.map((record) => record.sourceNo || record.voucherNo)),
      title: '凭证来源'
    }),
    createCheckItem({
      action: buildAccountingVoucherCheckAction(unbookedVoucherRows, period),
      code: 'voucher_booking',
      detail: unbookedVoucherCount === 0 ? '本期待记账凭证均已记账。' : `还有 ${unbookedVoucherCount} 张凭证待记账。`,
      nextStep: '需先在会计凭证完成记账',
      passed: unbookedVoucherCount === 0,
      sourceSummary: summarizeCheckSources('会计凭证', unbookedVoucherRows.map((record) => record.sourceNo || record.voucherNo)),
      title: '凭证记账'
    }),
    createCheckItem({
      code: 'general_ledger_trial_balance',
      detail: periodSummary.trialBalanceStatus === '平衡'
        ? '本期借贷试算平衡。'
        : `本期借贷差额 ${roundMoney(periodSummary.trialBalanceDifference)} 元。`,
      nextStep: '需先在总账核对分录和期初余额',
      passed: periodSummary.trialBalanceStatus === '平衡',
      sourceSummary: summarizeCheckSources('总账'),
      title: '总账试算'
    }),
    createCheckItem({
      code: 'financial_statements',
      detail: financialStatementReport.financialStatementReadiness === '可出具'
        ? '本期资产负债表、利润表、现金流量表已可生成。'
        : financialStatementReport.financialStatementReadinessDetail,
      nextStep: '需先处理财务报表生成阻断',
      passed: financialStatementReport.financialStatementReadiness === '可出具',
      sourceSummary: summarizeCheckSources('财务报表', financialStatementReport.cashFlowMappingGaps.map((record) => record.voucherNo), '项'),
      title: '财务报表'
    }),
    createCheckItem({
      code: 'cash_review',
      detail: pendingReviewCashFlowCount === 0
        ? '本期现金流水已完成复核。'
        : `还有 ${pendingReviewCashFlowCount} 条现金流水待复核。`,
      nextStep: '需先在流水复核完成本期待复核流水',
      passed: pendingReviewCashFlowCount === 0,
      sourceSummary: summarizeCheckSources('流水复核', pendingReviewCashFlowRows.map((record) => record.transactionNo), '条'),
      title: '流水复核'
    }),
    createCheckItem({
      code: 'cash_reconciliation',
      detail: unreconciledCashFlowCount === 0
        ? '已复核现金流水均已完成银行对账。'
        : `还有 ${unreconciledCashFlowCount} 条已复核现金流水未完成银行对账。`,
      nextStep: '需先在银行对账完成未对账流水',
      passed: unreconciledCashFlowCount === 0,
      sourceSummary: summarizeCheckSources('银行对账', unreconciledCashFlowRows.map((record) => record.transactionNo), '条'),
      title: '银行对账'
    }),
    createCheckItem({
      code: 'tax_handling',
      detail: taxHandlingPendingCount === 0 ? '本期对应税务办理事项已完成。' : `还有 ${taxHandlingPendingCount} 项税务办理事项未完成。`,
      nextStep: '需先在税务办理完成对应会计期间申报或回执事项',
      passed: taxHandlingPendingCount === 0,
      sourceSummary: summarizeCheckSources('税务办理', pendingTaxHandlingRows.map((record) => record.matterNo)),
      title: '税务办理'
    }),
    createCheckItem({
      code: 'social_insurance_housing_fund',
      detail: socialInsurancePendingCount === 0 ? '本期社保公积金事项已完成。' : `还有 ${socialInsurancePendingCount} 项社保公积金事项未完成。`,
      nextStep: '需先在社保公积金完成缴费确认、缴费登记或凭证补充',
      passed: socialInsurancePendingCount === 0,
      sourceSummary: summarizeCheckSources('社保公积金', pendingSocialInsuranceRows.map((record) => record.matterNo)),
      title: '社保公积金'
    })
  ];
  const displayCheckItems = applyClosedPeriodCheckReadback(checkItems, periodLock);
  const blockedCheckCount = displayCheckItems.filter((item) => item.status === '需处理').length;
  const status: FinancePeriodCloseStatus = periodLock ? '已结账' : blockedCheckCount === 0 ? '可结账' : '需处理';
  const liveSummarySnapshot = createFinancePeriodCloseSummarySnapshot({
    accountingPeriod: period,
    blockedCheckCount,
    bookedVoucherCount,
    canClose: status === '可结账',
    closedAt: periodLock?.lockedAt,
    closedBy: periodLock?.lockedBy,
    closeReason: periodLock?.reason,
    continuityDetail: '',
    continuityStatus: '账套启用期',
    creditTotal: periodSummary.creditTotal,
    debitTotal: periodSummary.debitTotal,
    financialStatementSnapshot: liveFinancialStatementSnapshot,
    readyToBookVoucherCount,
    generalLedgerSnapshotRows: liveGeneralLedgerSnapshotRows,
    generatedVoucherCount,
    issueVoucherCount,
    pendingReviewCashFlowCount,
    pendingVoucherCount,
    periodLabel: getPeriodLabel(period),
    financialStatementReadinessDetail: getFinancialStatementReadinessDetail({
      financialStatementReadinessDetail: financialStatementReport.financialStatementReadinessDetail,
      mode: liveFinancialStatementReadinessMode
    }),
    financialStatementReadinessMode: liveFinancialStatementReadinessMode,
    laterAdjustmentCount,
    laterAdjustmentSourceCount: laterAdjustmentSourceRows.length,
    laterAdjustmentTargetCount: laterAdjustmentTargetRows.length,
    laterAdjustmentSummary: getLaterAdjustmentSummary({
      accountingPeriod: period,
      periodLock,
      rows: laterPeriodAdjustmentRows
    }),
    socialInsurancePendingCount,
    status,
    taxHandlingPendingCount,
    trialBalanceDifference: roundMoney(periodSummary.trialBalanceDifference),
    trialBalanceStatus: periodSummary.trialBalanceStatus,
    unbookedVoucherCount,
    unreconciledCashFlowCount,
    voucherCount: periodVoucherRows.length,
    checkItems: displayCheckItems
  });
  const displaySummary = periodLock?.closeSummarySnapshot ?? liveSummarySnapshot;
  const displayTrialBalanceStatus = getTrialBalanceStatusFromSnapshot(displaySummary.trialBalanceStatus);
  const displayFinancialStatementReadinessMode = getFinancialStatementReadinessMode({
    financialStatementReadiness: periodLock
      ? (displaySummary.financialStatementReport?.financialStatementReadiness as FinanceFinancialStatementReport['financialStatementReadiness'] | undefined) ?? '待处理'
      : financialStatementReport.financialStatementReadiness,
    periodLock,
    trialBalanceStatus: displayTrialBalanceStatus
  });

  return {
    accountingPeriod: period,
    blockedCheckCount: displaySummary.blockedCheckCount,
    bookedVoucherCount: displaySummary.bookedVoucherCount,
    canClose: status === '可结账',
    closedAt: periodLock?.lockedAt,
    closedBy: periodLock?.lockedBy,
    closeReason: periodLock?.reason,
    continuityDetail: '',
    continuityStatus: '账套启用期',
    creditTotal: displaySummary.creditTotal,
    debitTotal: displaySummary.debitTotal,
    financialStatementSnapshot: displaySummary.financialStatementReport
      ? cloneFinancialStatementSnapshot(displaySummary.financialStatementReport)
      : liveFinancialStatementSnapshot,
    readyToBookVoucherCount: displaySummary.readyToBookVoucherCount,
    generalLedgerSnapshotRows: displaySummary.generalLedgerRows
      ? cloneGeneralLedgerSnapshotRows(displaySummary.generalLedgerRows)
      : liveGeneralLedgerSnapshotRows,
    generatedVoucherCount: displaySummary.generatedVoucherCount,
    issueVoucherCount: displaySummary.issueVoucherCount,
    pendingReviewCashFlowCount: displaySummary.pendingReviewCashFlowCount ?? 0,
    pendingVoucherCount: displaySummary.pendingVoucherCount,
    periodLabel: getPeriodLabel(period),
    reopenedAt: periodLockHistory?.status === '已反结账' ? periodLockHistory.reopenedAt : undefined,
    reopenedBy: periodLockHistory?.status === '已反结账' ? periodLockHistory.reopenedBy : undefined,
    reopenReason: periodLockHistory?.status === '已反结账' ? periodLockHistory.reopenReason : undefined,
    financialStatementReadinessDetail: getFinancialStatementReadinessDetail({
      financialStatementReadinessDetail: periodLock
        ? displaySummary.financialStatementReport?.financialStatementReadinessDetail ?? '结账快照缺少报表校验结果。'
        : financialStatementReport.financialStatementReadinessDetail,
      mode: displayFinancialStatementReadinessMode
    }),
    financialStatementReadinessMode: displayFinancialStatementReadinessMode,
    laterAdjustmentCount,
    laterAdjustmentSourceCount: laterAdjustmentSourceRows.length,
    laterAdjustmentTargetCount: laterAdjustmentTargetRows.length,
    laterAdjustmentSummary: getLaterAdjustmentSummary({
      accountingPeriod: period,
      periodLock,
      rows: laterPeriodAdjustmentRows
    }),
    socialInsurancePendingCount: displaySummary.socialInsurancePendingCount,
    status,
    taxHandlingPendingCount: displaySummary.taxHandlingPendingCount,
    trialBalanceDifference: displaySummary.trialBalanceDifference,
    trialBalanceStatus: displayTrialBalanceStatus,
    unbookedVoucherCount: displaySummary.unbookedVoucherCount,
    unreconciledCashFlowCount: displaySummary.unreconciledCashFlowCount,
    voucherCount: displaySummary.voucherCount,
    checkItems: displayCheckItems
  };
}

export function buildFinancePeriodCloseRecords({
  accountingPeriodStart,
  filters = defaultFinancePeriodCloseFilters,
  financeRows,
  laterPeriodAdjustmentRows = [],
  ledgerEntries,
  monthEndMatterRows = [],
  periodLocks = [],
  taxMatterRows,
  voucherRows
}: {
  accountingPeriodStart?: string;
  filters?: FinancePeriodCloseFilters;
  financeRows: FinanceTransactionRecord[];
  laterPeriodAdjustmentRows?: AccountingVoucherLaterPeriodAdjustmentRecord[];
  ledgerEntries: AccountingLedgerEntry[];
  monthEndMatterRows?: FinanceMonthEndMatterRecord[];
  periodLocks?: AccountingPeriodLockRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
  voucherRows: AccountingVoucherRecord[];
}) {
  const periods = expandAccountingPeriods({
    accountingPeriodStart,
    periods: collectPeriods({ financeRows, laterPeriodAdjustmentRows, ledgerEntries, monthEndMatterRows, periodLocks, taxMatterRows, voucherRows })
  });
  const records = applyPeriodCloseContinuity({
    accountingPeriodStart,
    periodLocks,
    records: periods
      .filter((period) => !accountingPeriodStart || period >= accountingPeriodStart)
    .map((period) => buildPeriodCloseRecord({
      financeRows,
      laterPeriodAdjustmentRows,
      ledgerEntries,
      monthEndMatterRows,
      period,
      periodLocks,
      taxMatterRows,
      voucherRows
    }))
  });

  return records
    .sort((left, right) => right.accountingPeriod.localeCompare(left.accountingPeriod))
    .filter((record) => isPeriodInsideFilter(record.accountingPeriod, filters.accountingPeriodTime))
    .filter((record) => matchesPeriodCloseStatus(record, filters.closeStatus))
    .filter((record) => matchesPeriodKeyword(record, filters.keyword));
}

export function buildFinancePeriodCloseMetrics(rows: FinancePeriodCloseRecord[]): FinancePeriodCloseMetrics {
  return {
    closeableCount: rows.filter((record) => record.status === '可结账').length,
    closedCount: rows.filter((record) => record.status === '已结账').length,
    pendingCount: rows.filter((record) => record.status === '需处理').length,
    periodCount: rows.length
  };
}

export function buildFinancePeriodCloseReadModel({
  accountingPeriodStart,
  filters = defaultFinancePeriodCloseFilters,
  financeRows,
  laterPeriodAdjustmentRows = [],
  ledgerEntries,
  monthEndMatterRows = [],
  periodLocks = [],
  taxMatterRows,
  voucherRows
}: {
  accountingPeriodStart?: string;
  filters?: FinancePeriodCloseFilters;
  financeRows: FinanceTransactionRecord[];
  laterPeriodAdjustmentRows?: AccountingVoucherLaterPeriodAdjustmentRecord[];
  ledgerEntries: AccountingLedgerEntry[];
  monthEndMatterRows?: FinanceMonthEndMatterRecord[];
  periodLocks?: AccountingPeriodLockRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
  voucherRows: AccountingVoucherRecord[];
}): FinancePeriodCloseReadModel {
  const records = buildFinancePeriodCloseRecords({
    accountingPeriodStart,
    filters,
    financeRows,
    laterPeriodAdjustmentRows,
    ledgerEntries,
    monthEndMatterRows,
    periodLocks,
    taxMatterRows,
    voucherRows
  });

  return {
    authority: 'frontend_session_adapter',
    generatedAt: `${financeToday} 18:00`,
    metrics: buildFinancePeriodCloseMetrics(records),
    pendingBackendCapabilities: [
      'GET /api/finance/accounting-periods/{period}/close-checks',
      'POST /api/finance/accounting-periods/{period}/close',
      'source mutation API accounting-period guard'
    ],
    records
  };
}

export function getFinancePeriodCloseConfirmationNotice() {
  return '确认后，本期间进入只读回看；同期间事项不再直接处理。后续发现错误优先走后续期间调整，反结账仅用于异常场景。';
}

export function createAccountingPeriodLockRecord(accountingPeriod: string, reason = '期间结账'): AccountingPeriodLockRecord {
  return {
    accountingPeriod,
    lockedAt: `${financeToday} 18:00`,
    lockedBy: '李明',
    reason,
    status: '已结账'
  };
}
