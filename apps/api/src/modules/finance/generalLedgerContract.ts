import type {
  FinancialStatementLedgerEntry
} from './financialStatementContract.js';
import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import { createStableSnapshotHash, type AccountingPeriodRecord } from './periodCloseContract.js';

export type GeneralLedgerSubjectType = '资产类' | '负债类' | '权益类' | '成本类' | '损益类';
export type GeneralLedgerBalanceDirection = '借方' | '贷方';
export type GeneralLedgerBalanceSide = GeneralLedgerBalanceDirection | '平';
export type GeneralLedgerOpeningBalanceSource = '账套初始化' | '期初余额承接' | '期初导入';

export type GeneralLedgerSubjectRecord = {
  balanceDirection: GeneralLedgerBalanceDirection;
  code: string;
  name: string;
  reportItem: string;
  statementTarget: string;
  status: '启用' | '停用';
  type: GeneralLedgerSubjectType;
};

export type GeneralLedgerOpeningBalanceRecord = {
  accountingPeriod: string;
  amount: string;
  source: GeneralLedgerOpeningBalanceSource;
  subjectCode: string;
};

export type GeneralLedgerDetailEntry = {
  accountingPeriod: string;
  auxiliary: string;
  creditAmount: string;
  debitAmount: string;
  id: string;
  runningBalance: string;
  sourceVoucherLineId: string;
  summary: string;
  voucherDate: string;
  voucherId: string;
  voucherNo: string;
};

export type GeneralLedgerSubjectBalanceRow = {
  balanceDirection: GeneralLedgerBalanceDirection;
  creditAmount: string;
  debitAmount: string;
  endingBalance: string;
  endingBalanceAmount: string;
  endingBalanceSide: GeneralLedgerBalanceSide;
  entries: GeneralLedgerDetailEntry[];
  entryCount: number;
  openingBalance: string;
  openingBalanceAmount: string;
  openingBalanceSide: GeneralLedgerBalanceSide;
  openingBalanceSource: string;
  reportItem: string;
  statementTarget: string;
  subjectCode: string;
  subjectName: string;
  subjectType: GeneralLedgerSubjectType;
  voucherCount: number;
};

export type GeneralLedgerMetrics = {
  bookedVoucherCount: number;
  creditTotal: string;
  debitTotal: string;
  entryCount: number;
  subjectCount: number;
};

export type GeneralLedgerTrialBalance = {
  creditTotal: string;
  debitTotal: string;
  difference: string;
  status: '平衡' | '不平衡';
};

export type GeneralLedgerReadbackSource = '已记账总账' | '结账总账';

export type GeneralLedgerReadModel = {
  accountingPeriod: string;
  metrics: GeneralLedgerMetrics;
  periodStatus: AccountingPeriodRecord['status'];
  readbackSource: GeneralLedgerReadbackSource;
  rows: GeneralLedgerSubjectBalanceRow[];
  sourceLedgerHash: string;
  trialBalance: GeneralLedgerTrialBalance;
};

type BuildGeneralLedgerReadModelInput = {
  accountingPeriod: string;
  ledgerRows: GeneralLedgerLifecycleRow[];
  openingBalances?: GeneralLedgerOpeningBalanceRecord[];
  periods: AccountingPeriodRecord[];
  subjects: GeneralLedgerSubjectRecord[];
};

type MoneyPresentation = {
  amount: string;
  side: GeneralLedgerBalanceSide;
};

const moneyToleranceInCents = 1;

function parseMoneyToCents(amount: string) {
  const trimmed = amount.trim();
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const unsigned = trimmed.replace(/^[+-]/, '');
  const [yuanPart = '0', centPart = ''] = unsigned.split('.');
  const yuan = Number(yuanPart || '0');
  const cents = Number((centPart || '00').padEnd(2, '0').slice(0, 2));

  if (!Number.isFinite(yuan) || !Number.isFinite(cents)) {
    return 0;
  }

  return sign * (yuan * 100 + cents);
}

function formatCents(cents: number) {
  const normalized = Math.abs(cents) < moneyToleranceInCents ? 0 : cents;
  const sign = normalized < 0 ? '-' : '';
  const absolute = Math.abs(normalized);

  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function getBalanceDeltaInCents(
  balanceDirection: GeneralLedgerBalanceDirection,
  debitAmount: string,
  creditAmount: string
) {
  const debitCents = parseMoneyToCents(debitAmount);
  const creditCents = parseMoneyToCents(creditAmount);

  return balanceDirection === '借方' ? debitCents - creditCents : creditCents - debitCents;
}

function getOppositeBalanceDirection(direction: GeneralLedgerBalanceDirection): GeneralLedgerBalanceDirection {
  return direction === '借方' ? '贷方' : '借方';
}

export function getGeneralLedgerBalancePresentation({
  balanceDirection,
  signedBalance
}: {
  balanceDirection: GeneralLedgerBalanceDirection;
  signedBalance: string;
}): MoneyPresentation {
  const signedCents = parseMoneyToCents(signedBalance);

  if (Math.abs(signedCents) < moneyToleranceInCents) {
    return {
      amount: '0.00',
      side: '平'
    };
  }

  return {
    amount: formatCents(Math.abs(signedCents)),
    side: signedCents > 0 ? balanceDirection : getOppositeBalanceDirection(balanceDirection)
  };
}

function isBeforePeriod(leftPeriod: string, rightPeriod: string) {
  return leftPeriod < rightPeriod;
}

function isCurrentPeriod(row: { accountingPeriod: string }, accountingPeriod: string) {
  return row.accountingPeriod === accountingPeriod;
}

function createSourceLedgerHash({
  accountingPeriod,
  ledgerRows,
  openingBalances,
  subjects
}: {
  accountingPeriod: string;
  ledgerRows: GeneralLedgerLifecycleRow[];
  openingBalances: GeneralLedgerOpeningBalanceRecord[];
  subjects: GeneralLedgerSubjectRecord[];
}) {
  return createStableSnapshotHash({
    accountingPeriod,
    ledgerRows: ledgerRows
      .filter((row) => row.accountingPeriod <= accountingPeriod)
      .map((row) => ({
        accountingPeriod: row.accountingPeriod,
        creditAmount: row.creditAmount,
        debitAmount: row.debitAmount,
        sourceVoucherLineId: row.sourceVoucherLineId,
        subjectCode: row.subjectCode,
        voucherId: row.voucherId,
        voucherNo: row.voucherNo
      }))
      .sort(
        (left, right) =>
          left.accountingPeriod.localeCompare(right.accountingPeriod) ||
          left.voucherNo.localeCompare(right.voucherNo) ||
          left.subjectCode.localeCompare(right.subjectCode) ||
          left.sourceVoucherLineId.localeCompare(right.sourceVoucherLineId)
      ),
    openingBalances: openingBalances
      .filter((row) => row.accountingPeriod <= accountingPeriod)
      .map((row) => ({ ...row }))
      .sort(
        (left, right) =>
          left.accountingPeriod.localeCompare(right.accountingPeriod) ||
          left.subjectCode.localeCompare(right.subjectCode) ||
          left.amount.localeCompare(right.amount)
      ),
    subjects: subjects
      .map((subject) => ({
        balanceDirection: subject.balanceDirection,
        code: subject.code,
        status: subject.status,
        type: subject.type
      }))
      .sort((left, right) => left.code.localeCompare(right.code))
  });
}

function cloneLedgerRow(row: GeneralLedgerLifecycleRow): GeneralLedgerLifecycleRow {
  return { ...row };
}

function buildDetailEntries({
  balanceDirection,
  currentRows,
  openingBalanceInCents
}: {
  balanceDirection: GeneralLedgerBalanceDirection;
  currentRows: GeneralLedgerLifecycleRow[];
  openingBalanceInCents: number;
}): GeneralLedgerDetailEntry[] {
  let runningBalanceInCents = openingBalanceInCents;

  return currentRows
    .map(cloneLedgerRow)
    .sort(
      (left, right) =>
        left.voucherDate.localeCompare(right.voucherDate) ||
        left.voucherNo.localeCompare(right.voucherNo) ||
        left.sourceVoucherLineId.localeCompare(right.sourceVoucherLineId)
    )
    .map((row) => {
      runningBalanceInCents += getBalanceDeltaInCents(
        balanceDirection,
        row.debitAmount,
        row.creditAmount
      );

      return {
        accountingPeriod: row.accountingPeriod,
        auxiliary: row.auxiliary,
        creditAmount: row.creditAmount,
        debitAmount: row.debitAmount,
        id: row.id,
        runningBalance: formatCents(runningBalanceInCents),
        sourceVoucherLineId: row.sourceVoucherLineId,
        summary: row.summary,
        voucherDate: row.voucherDate,
        voucherId: row.voucherId,
        voucherNo: row.voucherNo
      };
    });
}

function buildSubjectBalanceRow({
  accountingPeriod,
  ledgerRows,
  openingBalances,
  subject
}: {
  accountingPeriod: string;
  ledgerRows: GeneralLedgerLifecycleRow[];
  openingBalances: GeneralLedgerOpeningBalanceRecord[];
  subject: GeneralLedgerSubjectRecord;
}): GeneralLedgerSubjectBalanceRow {
  const currentRows = ledgerRows.filter(
    (row) => row.subjectCode === subject.code && isCurrentPeriod(row, accountingPeriod)
  );
  const priorRows = ledgerRows.filter(
    (row) => row.subjectCode === subject.code && isBeforePeriod(row.accountingPeriod, accountingPeriod)
  );
  const subjectOpeningBalances = openingBalances.filter(
    (row) => row.subjectCode === subject.code && row.accountingPeriod <= accountingPeriod
  );
  const openingFromBalancesInCents = subjectOpeningBalances.reduce(
    (total, row) => total + parseMoneyToCents(row.amount),
    0
  );
  const openingFromPriorRowsInCents = priorRows.reduce(
    (total, row) => total + getBalanceDeltaInCents(subject.balanceDirection, row.debitAmount, row.creditAmount),
    0
  );
  const openingBalanceInCents = openingFromBalancesInCents + openingFromPriorRowsInCents;
  const debitAmountInCents = currentRows.reduce((total, row) => total + parseMoneyToCents(row.debitAmount), 0);
  const creditAmountInCents = currentRows.reduce((total, row) => total + parseMoneyToCents(row.creditAmount), 0);
  const endingBalanceInCents =
    openingBalanceInCents +
    (subject.balanceDirection === '借方'
      ? debitAmountInCents - creditAmountInCents
      : creditAmountInCents - debitAmountInCents);
  const openingPresentation = getGeneralLedgerBalancePresentation({
    balanceDirection: subject.balanceDirection,
    signedBalance: formatCents(openingBalanceInCents)
  });
  const endingPresentation = getGeneralLedgerBalancePresentation({
    balanceDirection: subject.balanceDirection,
    signedBalance: formatCents(endingBalanceInCents)
  });
  const openingSources = new Set(subjectOpeningBalances.map((row) => row.source));

  if (priorRows.length > 0) {
    openingSources.add('期初余额承接');
  }

  return {
    balanceDirection: subject.balanceDirection,
    creditAmount: formatCents(creditAmountInCents),
    debitAmount: formatCents(debitAmountInCents),
    endingBalance: formatCents(endingBalanceInCents),
    endingBalanceAmount: endingPresentation.amount,
    endingBalanceSide: endingPresentation.side,
    entries: buildDetailEntries({
      balanceDirection: subject.balanceDirection,
      currentRows,
      openingBalanceInCents
    }),
    entryCount: currentRows.length,
    openingBalance: formatCents(openingBalanceInCents),
    openingBalanceAmount: openingPresentation.amount,
    openingBalanceSide: openingPresentation.side,
    openingBalanceSource: openingSources.size > 0 ? [...openingSources].sort().join(' / ') : '无期初余额',
    reportItem: subject.reportItem,
    statementTarget: subject.statementTarget,
    subjectCode: subject.code,
    subjectName: subject.name,
    subjectType: subject.type,
    voucherCount: new Set(currentRows.map((row) => row.voucherId)).size
  };
}

function shouldExposeSubjectBalance(row: GeneralLedgerSubjectBalanceRow) {
  return (
    row.openingBalance !== '0.00' ||
    row.debitAmount !== '0.00' ||
    row.creditAmount !== '0.00' ||
    row.endingBalance !== '0.00'
  );
}

function buildMetrics(rows: GeneralLedgerSubjectBalanceRow[]): GeneralLedgerMetrics {
  const voucherIds = new Set(rows.flatMap((row) => row.entries.map((entry) => entry.voucherId)));
  const debitTotalInCents = rows.reduce((total, row) => total + parseMoneyToCents(row.debitAmount), 0);
  const creditTotalInCents = rows.reduce((total, row) => total + parseMoneyToCents(row.creditAmount), 0);

  return {
    bookedVoucherCount: voucherIds.size,
    creditTotal: formatCents(creditTotalInCents),
    debitTotal: formatCents(debitTotalInCents),
    entryCount: rows.reduce((total, row) => total + row.entryCount, 0),
    subjectCount: rows.length
  };
}

function buildTrialBalance(metrics: GeneralLedgerMetrics): GeneralLedgerTrialBalance {
  const differenceInCents = parseMoneyToCents(metrics.debitTotal) - parseMoneyToCents(metrics.creditTotal);

  return {
    creditTotal: metrics.creditTotal,
    debitTotal: metrics.debitTotal,
    difference: formatCents(differenceInCents),
    status: Math.abs(differenceInCents) < moneyToleranceInCents ? '平衡' : '不平衡'
  };
}

function findAccountingPeriod(periods: AccountingPeriodRecord[], accountingPeriod: string) {
  return periods.find((period) => period.period === accountingPeriod);
}

export function buildGeneralLedgerReadModel({
  accountingPeriod,
  ledgerRows,
  openingBalances = [],
  periods,
  subjects
}: BuildGeneralLedgerReadModelInput): GeneralLedgerReadModel {
  const periodRecord = findAccountingPeriod(periods, accountingPeriod);
  const rows = subjects
    .filter((subject) => subject.status === '启用')
    .map((subject) => buildSubjectBalanceRow({ accountingPeriod, ledgerRows, openingBalances, subject }))
    .filter(shouldExposeSubjectBalance)
    .sort((left, right) => left.subjectCode.localeCompare(right.subjectCode));
  const metrics = buildMetrics(rows);

  return {
    accountingPeriod,
    metrics,
    periodStatus: periodRecord?.status ?? '开放',
    readbackSource: periodRecord?.status === '已结账' ? '结账总账' : '已记账总账',
    rows,
    sourceLedgerHash: createSourceLedgerHash({ accountingPeriod, ledgerRows, openingBalances, subjects }),
    trialBalance: buildTrialBalance(metrics)
  };
}

export function buildFinancialStatementLedgerEntriesFromGeneralLedgerRows(
  ledgerRows: GeneralLedgerLifecycleRow[]
): FinancialStatementLedgerEntry[] {
  return ledgerRows.map((row) => ({
    accountingPeriod: row.accountingPeriod,
    creditAmount: row.creditAmount,
    debitAmount: row.debitAmount,
    subjectCode: row.subjectCode,
    voucherId: row.voucherId,
    voucherNo: row.voucherNo
  }));
}
