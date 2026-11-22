export type AccountingPeriodVoucherCountStatus = '待制单' | '已制单' | '已记账' | '已冲销';

export type AccountingPeriodVoucherCountSourceRow = {
  accountingPeriod: string;
  id: string;
  sourceModule?: string;
  sourceNo?: string;
  status: AccountingPeriodVoucherCountStatus;
};

export type AccountingPeriodVoucherSummary = {
  bookedVoucherCount: number;
  preparedVoucherCount: number;
  unbookedVoucherCount: number;
};

function createEmptySummary(): AccountingPeriodVoucherSummary {
  return {
    bookedVoucherCount: 0,
    preparedVoucherCount: 0,
    unbookedVoucherCount: 0
  };
}

export function buildAccountingPeriodVoucherSummaries(
  rows: AccountingPeriodVoucherCountSourceRow[]
): Record<string, AccountingPeriodVoucherSummary> {
  const summaries: Record<string, AccountingPeriodVoucherSummary> = {};

  for (const row of rows) {
    const summary = summaries[row.accountingPeriod] ?? createEmptySummary();

    if (row.status === '待制单') {
      summaries[row.accountingPeriod] = summary;
      continue;
    }

    summary.preparedVoucherCount += 1;

    if (row.status === '已制单') {
      summary.unbookedVoucherCount += 1;
    } else {
      summary.bookedVoucherCount += 1;
    }

    summaries[row.accountingPeriod] = summary;
  }

  return summaries;
}
