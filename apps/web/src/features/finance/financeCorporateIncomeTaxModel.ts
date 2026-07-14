import type { PeopleMember } from '../people/peopleTypes';
import { accountingSubjectProfile } from './financeAccountingSubjectData';
import {
  buildAccountingLedgerEntries,
  type AccountingPeriodLockRecord,
  type AccountingVoucherRecord
} from './financeAccountingVoucherModel';
import { buildFinanceFinancialStatementReport } from './financeFinancialStatementsModel';
import {
  buildGeneralLedgerPeriodSummary,
  buildGeneralLedgerSubjectBalances,
  defaultGeneralLedgerFilters
} from './financeGeneralLedgerModel';

export type FinanceCorporateIncomeTaxAccountingSource = {
  accountingSourceReady: boolean;
  averageAssetAmount: number;
  averageEmployeeCount: number;
  coveredAccountingPeriods: string[];
  cumulativeOperatingCostAmount: number;
  cumulativeOperatingRevenueAmount: number;
  cumulativeOtherIncomeAmount: number;
  cumulativePayrollAndSocialInsuranceAmount: number;
  cumulativeProfitBeforeTaxAmount: number;
  cumulativeSalesExpenseAmount: number;
  unbookedVoucherCount: number;
  unclosedAccountingPeriods: string[];
};

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function getCorporateIncomeTaxPeriod(period: string) {
  const matched = period.match(/^(\d{4})-Q([1-4])$/);

  if (matched) {
    return {
      quarter: Number(matched[2]),
      year: matched[1]
    };
  }

  return /^\d{4}$/.test(period) ? { quarter: 4, year: period } : undefined;
}

function getLastDayOfMonth(year: string, month: number) {
  return new Date(Number(year), month, 0).getDate();
}

function getQuarterRange(year: string, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const endMonthText = String(endMonth).padStart(2, '0');

  return {
    endDate: `${year}-${endMonthText}-${getLastDayOfMonth(year, endMonth)}`,
    startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`
  };
}

function getQuarterAccountingPeriods(year: string, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1;

  return Array.from({ length: 3 }, (_, index) => `${year}-${String(startMonth + index).padStart(2, '0')}`);
}

function getLedgerRangeStart(requestedStartDate: string, endDate: string) {
  const accountingStartDate = `${accountingSubjectProfile.effectivePeriod}-01`;

  if (accountingStartDate > endDate) {
    return undefined;
  }

  return accountingStartDate > requestedStartDate ? accountingStartDate : requestedStartDate;
}

function buildStatementReport(entries: ReturnType<typeof buildAccountingLedgerEntries>, startDate: string, endDate: string) {
  const filters = {
    ...defaultGeneralLedgerFilters,
    accountingPeriodTime: {
      mode: 'range' as const,
      range: { endDate, startDate }
    }
  };
  const rows = buildGeneralLedgerSubjectBalances({ entries, filters });
  const periodSummary = buildGeneralLedgerPeriodSummary({ filters, rows });

  return {
    report: buildFinanceFinancialStatementReport({
      periodSummary,
      subjectRows: rows,
      yearToDateSubjectRows: rows
    }),
    rows
  };
}

function getStatementLineAmount(
  lines: ReturnType<typeof buildFinanceFinancialStatementReport>['profitLines'],
  itemName: string
) {
  return roundMoney(
    lines
      .filter((line) => line.itemName === itemName)
      .reduce((total, line) => total + line.amount, 0)
  );
}

function getEmployeeCountAtDate(peopleRows: PeopleMember[], date: string) {
  return peopleRows.filter((member) => {
    if (member.personnelType !== '全职' || member.joinedAt > date) {
      return false;
    }

    if (member.status !== '离职') {
      return true;
    }

    return Boolean(member.contractEndAt && member.contractEndAt >= date);
  }).length;
}

function getAverageEmployeeCount(peopleRows: PeopleMember[], year: string, quarter: number) {
  const quarterAverages = Array.from({ length: quarter }, (_, index) => index + 1).map((currentQuarter) => {
    const range = getQuarterRange(year, currentQuarter);
    const startCount = getEmployeeCountAtDate(peopleRows, range.startDate);
    const endCount = getEmployeeCountAtDate(peopleRows, range.endDate);

    return (startCount + endCount) / 2;
  });

  return quarterAverages.length > 0
    ? roundMoney(quarterAverages.reduce((total, count) => total + count, 0) / quarterAverages.length)
    : 0;
}

export function buildCorporateIncomeTaxAccountingSource({
  periodLocks = [],
  peopleRows,
  period,
  voucherRows
}: {
  periodLocks?: AccountingPeriodLockRecord[];
  peopleRows: PeopleMember[];
  period: string;
  voucherRows: AccountingVoucherRecord[];
}): FinanceCorporateIncomeTaxAccountingSource | undefined {
  const periodParts = getCorporateIncomeTaxPeriod(period);

  if (!periodParts) {
    return undefined;
  }

  const { quarter, year } = periodParts;
  const entries = buildAccountingLedgerEntries(voucherRows);
  const periodEndRange = getQuarterRange(year, quarter);
  const coveredAccountingPeriods = /^\d{4}$/.test(period)
    ? Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
    : getQuarterAccountingPeriods(year, quarter);
  const closedAccountingPeriods = new Set(
    periodLocks
      .filter((record) => record.status === '已结账')
      .map((record) => record.accountingPeriod)
  );
  const unclosedAccountingPeriods = coveredAccountingPeriods.filter((periodValue) => !closedAccountingPeriods.has(periodValue));
  const unbookedVoucherCount = voucherRows.filter((record) =>
    record.accountingPeriod >= `${year}-01` &&
    record.accountingPeriod <= coveredAccountingPeriods[coveredAccountingPeriods.length - 1] &&
    ['待生成', '需处理', '待记账'].includes(record.status)
  ).length;
  const accountingSourceReady = unclosedAccountingPeriods.length === 0 && unbookedVoucherCount === 0;
  const yearToDateStart = getLedgerRangeStart(`${year}-01-01`, periodEndRange.endDate);

  if (!yearToDateStart) {
    return {
      accountingSourceReady,
      averageAssetAmount: 0,
      averageEmployeeCount: getAverageEmployeeCount(peopleRows, year, quarter),
      coveredAccountingPeriods,
      cumulativeOperatingCostAmount: 0,
      cumulativeOperatingRevenueAmount: 0,
      cumulativeOtherIncomeAmount: 0,
      cumulativePayrollAndSocialInsuranceAmount: 0,
      cumulativeProfitBeforeTaxAmount: 0,
      cumulativeSalesExpenseAmount: 0,
      unbookedVoucherCount,
      unclosedAccountingPeriods
    };
  }

  const yearToDate = buildStatementReport(entries, yearToDateStart, periodEndRange.endDate);
  const incomeTaxExpenseAmount = getStatementLineAmount(yearToDate.report.profitLines, '所得税费用');
  const quarterAverageAssets = Array.from({ length: quarter }, (_, index) => index + 1).map((currentQuarter) => {
    const range = getQuarterRange(year, currentQuarter);
    const rangeStart = getLedgerRangeStart(range.startDate, range.endDate);

    if (!rangeStart) {
      return 0;
    }

    const { report } = buildStatementReport(entries, rangeStart, range.endDate);
    const openingAssetAmount = roundMoney(
      report.balanceSheetLines
        .filter((line) => line.section === '资产')
        .reduce((total, line) => total + (line.openingAmount ?? 0), 0)
    );

    return roundMoney((openingAssetAmount + report.assetTotal) / 2);
  });
  const payrollSubjectCodes = new Set(['5602.01', '5602.02']);
  const cumulativePayrollAndSocialInsuranceAmount = roundMoney(
    yearToDate.rows
      .filter((row) => payrollSubjectCodes.has(row.subjectCode))
      .reduce((total, row) => total + row.debitAmount - row.creditAmount, 0)
  );

  return {
    accountingSourceReady,
    averageAssetAmount: quarterAverageAssets.length > 0
      ? roundMoney(quarterAverageAssets.reduce((total, amount) => total + amount, 0) / quarterAverageAssets.length)
      : 0,
    averageEmployeeCount: getAverageEmployeeCount(peopleRows, year, quarter),
    coveredAccountingPeriods,
    cumulativeOperatingCostAmount: getStatementLineAmount(yearToDate.report.profitLines, '营业成本'),
    cumulativeOperatingRevenueAmount: getStatementLineAmount(yearToDate.report.profitLines, '营业收入'),
    cumulativeOtherIncomeAmount: getStatementLineAmount(yearToDate.report.profitLines, '营业外收入'),
    cumulativePayrollAndSocialInsuranceAmount,
    cumulativeProfitBeforeTaxAmount: roundMoney(yearToDate.report.profitTotal + incomeTaxExpenseAmount),
    cumulativeSalesExpenseAmount: getStatementLineAmount(yearToDate.report.profitLines, '销售费用'),
    unbookedVoucherCount,
    unclosedAccountingPeriods
  };
}

export function buildCorporateIncomeTaxAccountingSources(
  records: Array<{ period: string; taxType: string }>,
  peopleRows: PeopleMember[],
  voucherRows: AccountingVoucherRecord[],
  periodLocks: AccountingPeriodLockRecord[] = []
) {
  return Object.fromEntries(
    records
      .filter((record) => record.taxType === '企业所得税')
      .flatMap((record) => {
        const source = buildCorporateIncomeTaxAccountingSource({ periodLocks, peopleRows, period: record.period, voucherRows });

        return source ? [[record.period, source] as const] : [];
      })
  ) satisfies Record<string, FinanceCorporateIncomeTaxAccountingSource>;
}
