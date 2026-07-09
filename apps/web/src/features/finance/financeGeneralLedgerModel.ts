import { getDateScopeRange, type DateScopeFilterValue } from '../../components/DateFilterFields';
import {
  accountingSubjectSeedRows,
  type AccountingCashFlowActivity,
  type AccountingSubjectBalanceDirection,
  type AccountingSubjectRecord,
  type AccountingSubjectType
} from './financeAccountingSubjectData';
import {
  accountingVoucherDefaultMonth,
  type AccountingPeriodCloseFinancialStatementSnapshot,
  type AccountingPeriodCloseGeneralLedgerRowSnapshot,
  type AccountingLedgerEntry,
  type AccountingPeriodLockRecord
} from './financeAccountingVoucherModel';
import { buildLedgerInitializationOpeningBalancesForGeneralLedger } from './financeLedgerInitializationModel';

export type GeneralLedgerOpeningBalance = {
  accountingPeriod: string;
  amount: number;
  source?: GeneralLedgerOpeningBalanceSource;
  subjectCode: string;
};

export type GeneralLedgerOpeningBalanceSource = '账套初始化' | '期初余额承接' | '期初导入';

export type GeneralLedgerFilters = {
  accountingPeriodTime: DateScopeFilterValue;
  keyword: string;
  subjectType: '全部' | AccountingSubjectType;
};

export type GeneralLedgerDetailEntry = AccountingLedgerEntry & {
  runningBalance: number;
};

export type GeneralLedgerBalanceSide = AccountingSubjectBalanceDirection | '平';

export type GeneralLedgerSubjectBalanceRow = {
  balanceDirection: AccountingSubjectBalanceDirection;
  cashFlowActivity?: AccountingCashFlowActivity;
  cashFlowItem?: string;
  creditAmount: number;
  debitAmount: number;
  endingBalanceAmount: number;
  endingBalanceSide: GeneralLedgerBalanceSide;
  endingBalance: number;
  entries: GeneralLedgerDetailEntry[];
  entryCount: number;
  hasCurrentMovement: boolean;
  openingBalanceAmount: number;
  openingBalanceSide: GeneralLedgerBalanceSide;
  openingBalance: number;
  openingBalanceSource: string;
  reportItem: string;
  statementTarget: AccountingSubjectRecord['statementTarget'];
  subjectCode: string;
  subjectId: string;
  subjectName: string;
  subjectType: AccountingSubjectType;
  voucherCount: number;
};

export type GeneralLedgerMetrics = {
  bookedVoucherCount: number;
  creditTotal: number;
  debitTotal: number;
  entryCount: number;
  subjectCount: number;
};

export type GeneralLedgerPeriodStatus = AccountingPeriodLockRecord['status'] | '跨期查看';
export type GeneralLedgerTrialBalanceStatus = '平衡' | '不平衡';
export type GeneralLedgerReadbackSource = '实时总账' | '结账快照' | '旧锁只读';

export type GeneralLedgerPeriodSummary = {
  bookedVoucherCount: number;
  creditTotal: number;
  debitTotal: number;
  entryCount: number;
  financialStatementSnapshot?: AccountingPeriodCloseFinancialStatementSnapshot;
  lockedAt?: string;
  lockedBy?: string;
  lockedReason?: string;
  openingBalanceSource: string;
  periodKey?: string;
  periodLabel: string;
  periodStatus: GeneralLedgerPeriodStatus;
  readbackSource: GeneralLedgerReadbackSource;
  subjectCount: number;
  trialBalanceDifference: number;
  trialBalanceStatus: GeneralLedgerTrialBalanceStatus;
};

export type GeneralLedgerResponse = {
  metrics: GeneralLedgerMetrics;
  periodSummary: GeneralLedgerPeriodSummary;
  rows: GeneralLedgerSubjectBalanceRow[];
};

export const generalLedgerDefaultMonth = accountingVoucherDefaultMonth;

export const defaultGeneralLedgerFilters: GeneralLedgerFilters = {
  accountingPeriodTime: { mode: 'currentMonth' },
  keyword: '',
  subjectType: '全部'
};

export const generalLedgerOpeningBalances: GeneralLedgerOpeningBalance[] = [
  ...buildLedgerInitializationOpeningBalancesForGeneralLedger()
];

type LedgerDateRange = {
  endDate: string;
  startDate: string;
};

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

function getAccountingPeriodRange(accountingPeriod: string): LedgerDateRange {
  const monthMatch = accountingPeriod.match(/^(\d{4})-(\d{2})$/);

  if (monthMatch) {
    return {
      endDate: `${monthMatch[1]}-${monthMatch[2]}-31`,
      startDate: `${monthMatch[1]}-${monthMatch[2]}-01`
    };
  }

  const quarterMatch = accountingPeriod.match(/^(\d{4})-Q([1-4])$/);

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
    endDate: accountingPeriod,
    startDate: accountingPeriod
  };
}

function isPeriodBeforeRange(accountingPeriod: string, range?: LedgerDateRange) {
  if (!range) {
    return false;
  }

  return getAccountingPeriodRange(accountingPeriod).endDate < range.startDate;
}

function isPeriodInsideRange(accountingPeriod: string, range?: LedgerDateRange) {
  if (!range) {
    return true;
  }

  const periodRange = getAccountingPeriodRange(accountingPeriod);

  return periodRange.startDate <= range.endDate && periodRange.endDate >= range.startDate;
}

function shouldApplyOpeningBalance(openingBalance: GeneralLedgerOpeningBalance, range?: LedgerDateRange) {
  if (!range) {
    return true;
  }

  return getAccountingPeriodRange(openingBalance.accountingPeriod).startDate <= range.startDate;
}

function resolveSingleAccountingPeriod(value: DateScopeFilterValue, defaultMonth = generalLedgerDefaultMonth) {
  if (value.mode === 'currentMonth') {
    return defaultMonth;
  }

  if (value.mode === 'month') {
    return value.month;
  }

  return undefined;
}

function cloneFinancialStatementSnapshot(snapshot?: AccountingPeriodCloseFinancialStatementSnapshot) {
  if (!snapshot) {
    return undefined;
  }

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

function cloneLedgerSnapshotRows(
  rows: AccountingPeriodCloseGeneralLedgerRowSnapshot[]
): GeneralLedgerSubjectBalanceRow[] {
  return rows.map((row) => ({
    ...row,
    cashFlowActivity: row.cashFlowActivity as GeneralLedgerSubjectBalanceRow['cashFlowActivity'],
    endingBalanceSide: row.endingBalanceSide as GeneralLedgerSubjectBalanceRow['endingBalanceSide'],
    entries: row.entries.map((entry) => ({ ...entry })),
    openingBalanceSide: row.openingBalanceSide as GeneralLedgerSubjectBalanceRow['openingBalanceSide'],
    statementTarget: row.statementTarget as GeneralLedgerSubjectBalanceRow['statementTarget']
  }));
}

function findSinglePeriodLock(
  filters: GeneralLedgerFilters,
  periodLocks: AccountingPeriodLockRecord[]
): AccountingPeriodLockRecord | undefined {
  const periodKey = resolveSingleAccountingPeriod(filters.accountingPeriodTime);

  if (!periodKey) {
    return undefined;
  }

  return periodLocks.find((lockRecord) => lockRecord.accountingPeriod === periodKey);
}

function getBalanceDelta(balanceDirection: AccountingSubjectBalanceDirection, debitAmount: number, creditAmount: number) {
  return balanceDirection === '借方' ? debitAmount - creditAmount : creditAmount - debitAmount;
}

function getOppositeBalanceDirection(direction: AccountingSubjectBalanceDirection): AccountingSubjectBalanceDirection {
  return direction === '借方' ? '贷方' : '借方';
}

export function getGeneralLedgerBalancePresentation(
  amount: number,
  normalDirection: AccountingSubjectBalanceDirection
): { amount: number; side: GeneralLedgerBalanceSide } {
  const roundedAmount = roundMoney(amount);

  if (Math.abs(roundedAmount) < 0.01) {
    return {
      amount: 0,
      side: '平'
    };
  }

  return {
    amount: Math.abs(roundedAmount),
    side: roundedAmount > 0 ? normalDirection : getOppositeBalanceDirection(normalDirection)
  };
}

function matchesGeneralLedgerFilters(row: GeneralLedgerSubjectBalanceRow, filters: GeneralLedgerFilters) {
  if (filters.subjectType !== '全部' && row.subjectType !== filters.subjectType) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [
    row.subjectCode,
    row.subjectName,
    row.reportItem,
    row.statementTarget,
    ...row.entries.flatMap((entry) => [entry.voucherNo, entry.summary, entry.auxiliary])
  ].some((value) => value.toLowerCase().includes(keyword));
}

function buildRunningEntries(
  entries: AccountingLedgerEntry[],
  openingBalance: number,
  balanceDirection: AccountingSubjectBalanceDirection
): GeneralLedgerDetailEntry[] {
  let runningBalance = openingBalance;

  return [...entries]
    .sort((left, right) => {
      const dateDiff = left.voucherDate.localeCompare(right.voucherDate);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return left.voucherNo.localeCompare(right.voucherNo);
    })
    .map((entry) => {
      runningBalance = roundMoney(
        runningBalance + getBalanceDelta(balanceDirection, entry.debitAmount, entry.creditAmount)
      );

      return {
        ...entry,
        runningBalance
      };
    });
}

export function buildGeneralLedgerSubjectBalances({
  entries,
  filters = defaultGeneralLedgerFilters,
  openingBalances = generalLedgerOpeningBalances,
  subjects = accountingSubjectSeedRows
}: {
  entries: AccountingLedgerEntry[];
  filters?: GeneralLedgerFilters;
  openingBalances?: GeneralLedgerOpeningBalance[];
  subjects?: AccountingSubjectRecord[];
}): GeneralLedgerSubjectBalanceRow[] {
  const range = getDateScopeRange(filters.accountingPeriodTime, generalLedgerDefaultMonth);
  const entriesBySubject = new Map<string, AccountingLedgerEntry[]>();
  const priorEntriesBySubject = new Map<string, AccountingLedgerEntry[]>();
  const openingBySubject = new Map<string, number>();
  const openingSourcesBySubject = new Map<string, Set<string>>();

  openingBalances.forEach((openingBalance) => {
    if (!shouldApplyOpeningBalance(openingBalance, range)) {
      return;
    }

    openingBySubject.set(
      openingBalance.subjectCode,
      roundMoney((openingBySubject.get(openingBalance.subjectCode) ?? 0) + openingBalance.amount)
    );

    const sourceSet = openingSourcesBySubject.get(openingBalance.subjectCode) ?? new Set<string>();
    sourceSet.add(openingBalance.source ?? '账套初始化');
    openingSourcesBySubject.set(openingBalance.subjectCode, sourceSet);
  });

  entries.forEach((entry) => {
    if (isPeriodBeforeRange(entry.accountingPeriod, range)) {
      priorEntriesBySubject.set(entry.subjectCode, [...(priorEntriesBySubject.get(entry.subjectCode) ?? []), entry]);
      return;
    }

    if (isPeriodInsideRange(entry.accountingPeriod, range)) {
      entriesBySubject.set(entry.subjectCode, [...(entriesBySubject.get(entry.subjectCode) ?? []), entry]);
    }
  });

  return subjects
    .filter((subject) => subject.status === '启用')
    .map((subject) => {
      const currentEntries = entriesBySubject.get(subject.code) ?? [];
      const priorEntries = priorEntriesBySubject.get(subject.code) ?? [];
      const openingSourceSet = openingSourcesBySubject.get(subject.code) ?? new Set<string>();
      const openingDelta = priorEntries.reduce(
        (total, entry) => total + getBalanceDelta(subject.balanceDirection, entry.debitAmount, entry.creditAmount),
        0
      );
      if (priorEntries.length > 0) {
        openingSourceSet.add('前期已记账分录');
      }
      const openingBalance = roundMoney((openingBySubject.get(subject.code) ?? 0) + openingDelta);
      const debitAmount = roundMoney(currentEntries.reduce((total, entry) => total + entry.debitAmount, 0));
      const creditAmount = roundMoney(currentEntries.reduce((total, entry) => total + entry.creditAmount, 0));
      const endingBalance = roundMoney(
        openingBalance + getBalanceDelta(subject.balanceDirection, debitAmount, creditAmount)
      );
      const openingBalancePresentation = getGeneralLedgerBalancePresentation(openingBalance, subject.balanceDirection);
      const endingBalancePresentation = getGeneralLedgerBalancePresentation(endingBalance, subject.balanceDirection);
      const runningEntries = buildRunningEntries(currentEntries, openingBalance, subject.balanceDirection);
      const voucherCount = new Set(currentEntries.map((entry) => entry.voucherId)).size;

      return {
        balanceDirection: subject.balanceDirection,
        cashFlowActivity: subject.cashFlowActivity,
        cashFlowItem: subject.cashFlowItem,
        creditAmount,
        debitAmount,
        endingBalanceAmount: endingBalancePresentation.amount,
        endingBalanceSide: endingBalancePresentation.side,
        endingBalance,
        entries: runningEntries,
        entryCount: currentEntries.length,
        hasCurrentMovement: currentEntries.length > 0,
        openingBalanceAmount: openingBalancePresentation.amount,
        openingBalanceSide: openingBalancePresentation.side,
        openingBalance,
        openingBalanceSource: openingSourceSet.size > 0 ? [...openingSourceSet].join(' / ') : '无期初余额',
        reportItem: subject.reportItem,
        statementTarget: subject.statementTarget,
        subjectCode: subject.code,
        subjectId: subject.id,
        subjectName: subject.name,
        subjectType: subject.type,
        voucherCount
      };
    })
    .filter((row) => row.openingBalance !== 0 || row.debitAmount !== 0 || row.creditAmount !== 0 || row.endingBalance !== 0)
    .filter((row) => matchesGeneralLedgerFilters(row, filters))
    .sort((left, right) => left.subjectCode.localeCompare(right.subjectCode));
}

export function buildGeneralLedgerMetrics(rows: GeneralLedgerSubjectBalanceRow[]): GeneralLedgerMetrics {
  const voucherIds = new Set(rows.flatMap((row) => row.entries.map((entry) => entry.voucherId)));

  return {
    bookedVoucherCount: voucherIds.size,
    creditTotal: roundMoney(rows.reduce((total, row) => total + row.creditAmount, 0)),
    debitTotal: roundMoney(rows.reduce((total, row) => total + row.debitAmount, 0)),
    entryCount: rows.reduce((total, row) => total + row.entryCount, 0),
    subjectCount: rows.length
  };
}

export function buildGeneralLedgerPeriodSummary({
  filters = defaultGeneralLedgerFilters,
  financialStatementSnapshot,
  periodLocks = [],
  readbackSource,
  rows
}: {
  filters?: GeneralLedgerFilters;
  financialStatementSnapshot?: AccountingPeriodCloseFinancialStatementSnapshot;
  periodLocks?: AccountingPeriodLockRecord[];
  readbackSource?: GeneralLedgerReadbackSource;
  rows: GeneralLedgerSubjectBalanceRow[];
}): GeneralLedgerPeriodSummary {
  const metrics = buildGeneralLedgerMetrics(rows);
  const periodKey = resolveSingleAccountingPeriod(filters.accountingPeriodTime);
  const periodLock = periodKey
    ? periodLocks.find((lockRecord) => lockRecord.accountingPeriod === periodKey)
    : undefined;
  const trialBalanceDifference = roundMoney(metrics.debitTotal - metrics.creditTotal);
  const openingSources = new Set(
    rows
      .map((row) => row.openingBalanceSource)
      .filter((source) => source && source !== '无期初余额')
  );

  return {
    bookedVoucherCount: metrics.bookedVoucherCount,
    creditTotal: metrics.creditTotal,
    debitTotal: metrics.debitTotal,
    entryCount: metrics.entryCount,
    financialStatementSnapshot: cloneFinancialStatementSnapshot(financialStatementSnapshot),
    lockedAt: periodLock?.lockedAt,
    lockedBy: periodLock?.lockedBy,
    lockedReason: periodLock?.reason,
    openingBalanceSource: openingSources.size > 0 ? [...openingSources].join(' / ') : '无期初余额',
    periodKey,
    periodLabel: getGeneralLedgerPeriodLabel(filters.accountingPeriodTime),
    periodStatus: periodKey ? periodLock?.status ?? '开放' : '跨期查看',
    readbackSource: readbackSource ?? (periodLock?.status === '已结账' ? '旧锁只读' : '实时总账'),
    subjectCount: metrics.subjectCount,
    trialBalanceDifference,
    trialBalanceStatus: Math.abs(trialBalanceDifference) < 0.01 ? '平衡' : '不平衡'
  };
}

export function buildGeneralLedgerResponse({
  entries,
  filters = defaultGeneralLedgerFilters,
  openingBalances = generalLedgerOpeningBalances,
  periodLocks = [],
  subjects = accountingSubjectSeedRows
}: {
  entries: AccountingLedgerEntry[];
  filters?: GeneralLedgerFilters;
  openingBalances?: GeneralLedgerOpeningBalance[];
  periodLocks?: AccountingPeriodLockRecord[];
  subjects?: AccountingSubjectRecord[];
}): GeneralLedgerResponse {
  const periodLock = findSinglePeriodLock(filters, periodLocks);
  const closeSummarySnapshot = periodLock?.status === '已结账' ? periodLock.closeSummarySnapshot : undefined;
  const closedLedgerSnapshotRows = closeSummarySnapshot?.generalLedgerRows
    ? cloneLedgerSnapshotRows(closeSummarySnapshot.generalLedgerRows)
    : undefined;

  if (closedLedgerSnapshotRows) {
    return {
      metrics: buildGeneralLedgerMetrics(closedLedgerSnapshotRows),
      periodSummary: buildGeneralLedgerPeriodSummary({
        filters,
        financialStatementSnapshot: closeSummarySnapshot?.financialStatementReport,
        periodLocks,
        readbackSource: '结账快照',
        rows: closedLedgerSnapshotRows
      }),
      rows: closedLedgerSnapshotRows.filter((row) => matchesGeneralLedgerFilters(row, filters))
    };
  }

  const periodRows = buildGeneralLedgerSubjectBalances({
    entries,
    filters: {
      ...filters,
      keyword: '',
      subjectType: '全部'
    },
    openingBalances,
    subjects
  });
  const rows = buildGeneralLedgerSubjectBalances({ entries, filters, openingBalances, subjects });

  return {
    metrics: buildGeneralLedgerMetrics(periodRows),
    periodSummary: buildGeneralLedgerPeriodSummary({
      filters,
      periodLocks,
      readbackSource: periodLock?.status === '已结账' ? '旧锁只读' : '实时总账',
      rows: periodRows
    }),
    rows
  };
}

export function getGeneralLedgerReadbackNotice(periodSummary: GeneralLedgerPeriodSummary) {
  if (periodSummary.periodStatus !== '已结账') {
    return undefined;
  }

  if (periodSummary.readbackSource === '结账快照') {
    return '本期间已结账，总账按结账快照回看；如需修正，请走后续期间调整，反结账属于异常流程。';
  }

  return '本期间已结账但缺少总账快照，当前仅为旧锁只读参考；正式回看需后端持久化总账快照承接。';
}

export function getGeneralLedgerPeriodLabel(value: DateScopeFilterValue, defaultMonth = generalLedgerDefaultMonth) {
  if (value.mode === 'all') {
    return '全部期间';
  }

  if (value.mode === 'currentMonth') {
    return `${defaultMonth} 当月`;
  }

  if (value.mode === 'month') {
    return value.month;
  }

  const range = getDateScopeRange(value, defaultMonth);

  return range ? `${range.startDate} 至 ${range.endDate}` : '全部期间';
}
