import type { GeneralLedgerPeriodSummary, GeneralLedgerSubjectBalanceRow } from './financeGeneralLedgerModel';
import { formatMoney } from './financeUtils';

export type FinanceStatementMode = '待结账' | '正式报表';
export type FinanceStatementSection = '资产' | '负债' | '所有者权益' | '收入' | '成本费用';
export type FinanceCashFlowActivity = NonNullable<GeneralLedgerSubjectBalanceRow['cashFlowActivity']>;

export type FinanceStatementLine = {
  amount: number;
  itemName: string;
  openingAmount?: number;
  section: FinanceStatementSection;
  sourceSubjectCodes: string[];
  sourceSubjectCount: number;
  yearToDateAmount?: number;
};

export type FinanceCashFlowStatementLine = {
  activity: FinanceCashFlowActivity;
  amount: number;
  itemName: string;
  sourceSubjectCodes: string[];
  sourceSubjectCount: number;
  voucherCount: number;
  voucherNos: string[];
  yearToDateAmount: number;
};

export type FinanceCashFlowMappingGap = {
  amount: number;
  cashSubjectCodes: string[];
  counterpartySubjectCodes: string[];
  reason: string;
  voucherDate: string;
  voucherNo: string;
};

export type FinanceFinancialStatementReport = {
  accountingPeriod: string;
  balanceSheetLines: FinanceStatementLine[];
  cashFlowClosingBalance: number;
  cashFlowLines: FinanceCashFlowStatementLine[];
  cashFlowMappingGaps: FinanceCashFlowMappingGap[];
  cashFlowNetAmount: number;
  cashFlowOpeningBalance: number;
  cashFlowReadiness: '待处理' | '可出具';
  cashFlowReadinessDetail: string;
  cashFlowReconciliationDifference: number;
  cashFlowYearToDateClosingBalance: number;
  cashFlowYearToDateNetAmount: number;
  cashFlowYearToDateOpeningBalance: number;
  cashFlowYearToDateReconciliationDifference: number;
  liabilityEquityTotal: number;
  mode: FinanceStatementMode;
  periodLabel: string;
  profitLines: FinanceStatementLine[];
  profitTotal: number;
  reportBasis: string;
  reportNotice: string;
  trialBalanceStatus: GeneralLedgerPeriodSummary['trialBalanceStatus'];
  assetTotal: number;
};

function roundStatementAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function getStatementMode(periodSummary: GeneralLedgerPeriodSummary): FinanceStatementMode {
  return periodSummary.periodStatus === '已结账' ? '正式报表' : '待结账';
}

function getReportNotice(periodSummary: GeneralLedgerPeriodSummary, mode: FinanceStatementMode) {
  if (mode !== '正式报表') {
    return '本期尚未结账，当前金额用于结账前核对；结账后生成正式报表。';
  }

  return periodSummary.readbackSource === '结账快照' && periodSummary.financialStatementSnapshot
    ? '本期已结账，当前为结账时生成的正式报表。'
    : '本期已结账，但缺少结账报表快照。';
}

function cloneStatementLines(
  lines: NonNullable<GeneralLedgerPeriodSummary['financialStatementSnapshot']>['balanceSheetLines']
) {
  return (lines ?? []).map((line) => ({
    ...line,
    openingAmount: line.openingAmount,
    section: line.section as FinanceStatementSection,
    sourceSubjectCodes: [...line.sourceSubjectCodes],
    yearToDateAmount: line.yearToDateAmount
  }));
}

function cloneFinancialStatementSnapshotReport(
  periodSummary: GeneralLedgerPeriodSummary,
  mode: FinanceStatementMode
): FinanceFinancialStatementReport | undefined {
  const snapshot = periodSummary.financialStatementSnapshot;

  if (!snapshot) {
    return undefined;
  }

  return {
    ...snapshot,
    accountingPeriod: periodSummary.periodKey ?? snapshot.accountingPeriod,
    balanceSheetLines: cloneStatementLines(snapshot.balanceSheetLines),
    cashFlowLines: snapshot.cashFlowLines.map((line) => ({
      ...line,
      activity: line.activity as FinanceCashFlowActivity,
      sourceSubjectCodes: [...line.sourceSubjectCodes],
      voucherNos: [...line.voucherNos],
      yearToDateAmount: line.yearToDateAmount ?? line.amount
    })),
    cashFlowClosingBalance: snapshot.cashFlowClosingBalance ?? snapshot.cashFlowNetAmount,
    cashFlowMappingGaps: snapshot.cashFlowMappingGaps.map((gap) => ({
      ...gap,
      cashSubjectCodes: [...gap.cashSubjectCodes],
      counterpartySubjectCodes: [...gap.counterpartySubjectCodes]
    })),
    cashFlowReadiness: snapshot.cashFlowReadiness as FinanceFinancialStatementReport['cashFlowReadiness'],
    cashFlowOpeningBalance: snapshot.cashFlowOpeningBalance ?? 0,
    cashFlowReconciliationDifference: snapshot.cashFlowReconciliationDifference ?? 0,
    cashFlowYearToDateClosingBalance: snapshot.cashFlowYearToDateClosingBalance ?? snapshot.cashFlowYearToDateNetAmount ?? snapshot.cashFlowNetAmount,
    cashFlowYearToDateNetAmount: snapshot.cashFlowYearToDateNetAmount ?? snapshot.cashFlowNetAmount,
    cashFlowYearToDateOpeningBalance: snapshot.cashFlowYearToDateOpeningBalance ?? 0,
    cashFlowYearToDateReconciliationDifference: snapshot.cashFlowYearToDateReconciliationDifference ?? 0,
    mode,
    periodLabel: periodSummary.periodLabel,
    profitLines: cloneStatementLines(snapshot.profitLines),
    reportNotice: getReportNotice(periodSummary, mode),
    trialBalanceStatus: periodSummary.trialBalanceStatus
  };
}

function getTrialReportNotice(mode: FinanceStatementMode) {
  return mode === '正式报表'
    ? '本期已结账，当前为结账时生成的正式报表。'
    : '本期尚未结账，当前金额用于结账前核对；结账后生成正式报表。';
}

function getBalanceSheetSection(row: GeneralLedgerSubjectBalanceRow): FinanceStatementSection | undefined {
  if (row.subjectType === '资产类') {
    return '资产';
  }

  if (row.subjectType === '负债类') {
    return '负债';
  }

  if (row.subjectType === '所有者权益类') {
    return '所有者权益';
  }

  return undefined;
}

function getProfitSection(row: GeneralLedgerSubjectBalanceRow): FinanceStatementSection {
  return row.subjectType === '损益类' && row.balanceDirection === '贷方' ? '收入' : '成本费用';
}

function getProfitLineAmount(row: GeneralLedgerSubjectBalanceRow) {
  return row.balanceDirection === '贷方'
    ? roundStatementAmount(row.creditAmount - row.debitAmount)
    : roundStatementAmount(row.debitAmount - row.creditAmount);
}

function getBalanceSheetLineAmount(row: GeneralLedgerSubjectBalanceRow, amount: number) {
  const section = getBalanceSheetSection(row);

  if (!section) {
    return 0;
  }

  const normalDirection = section === '资产' ? '借方' : '贷方';

  return roundStatementAmount(row.balanceDirection === normalDirection ? amount : -amount);
}

function mergeStatementLine(
  rowsByKey: Map<string, FinanceStatementLine>,
  section: FinanceStatementSection,
  itemName: string,
  amount: number,
  subjectCode: string,
  extra: Partial<Pick<FinanceStatementLine, 'openingAmount' | 'yearToDateAmount'>> = {}
) {
  const key = `${section}:${itemName}`;
  const existing = rowsByKey.get(key);

  if (!existing) {
    rowsByKey.set(key, {
      amount: roundStatementAmount(amount),
      itemName,
      openingAmount: extra.openingAmount === undefined ? undefined : roundStatementAmount(extra.openingAmount),
      section,
      sourceSubjectCodes: [subjectCode],
      sourceSubjectCount: 1,
      yearToDateAmount: extra.yearToDateAmount === undefined ? undefined : roundStatementAmount(extra.yearToDateAmount)
    });
    return;
  }

  rowsByKey.set(key, {
    ...existing,
    amount: roundStatementAmount(existing.amount + amount),
    openingAmount:
      existing.openingAmount === undefined && extra.openingAmount === undefined
        ? undefined
        : roundStatementAmount((existing.openingAmount ?? 0) + (extra.openingAmount ?? 0)),
    sourceSubjectCodes: [...existing.sourceSubjectCodes, subjectCode],
    sourceSubjectCount: existing.sourceSubjectCount + 1,
    yearToDateAmount:
      existing.yearToDateAmount === undefined && extra.yearToDateAmount === undefined
        ? undefined
        : roundStatementAmount((existing.yearToDateAmount ?? 0) + (extra.yearToDateAmount ?? 0))
  });
}

function mergeCashFlowLine(
  rowsByKey: Map<string, FinanceCashFlowStatementLine>,
  activity: FinanceCashFlowActivity,
  itemName: string,
  amount: number,
  subjectCode: string,
  voucherNo: string
) {
  const key = `${activity}:${itemName}`;
  const existing = rowsByKey.get(key);

  if (!existing) {
    rowsByKey.set(key, {
      activity,
      amount: roundStatementAmount(amount),
      itemName,
      sourceSubjectCodes: [subjectCode],
      sourceSubjectCount: 1,
      voucherCount: 1,
      voucherNos: [voucherNo],
      yearToDateAmount: roundStatementAmount(amount)
    });
    return;
  }

  const sourceSubjectCodes = new Set(existing.sourceSubjectCodes);
  sourceSubjectCodes.add(subjectCode);
  const voucherNos = new Set(existing.voucherNos);
  voucherNos.add(voucherNo);

  rowsByKey.set(key, {
    ...existing,
    amount: roundStatementAmount(existing.amount + amount),
    sourceSubjectCodes: [...sourceSubjectCodes],
    sourceSubjectCount: sourceSubjectCodes.size,
    voucherCount: voucherNos.size,
    voucherNos: [...voucherNos],
    yearToDateAmount: roundStatementAmount(existing.yearToDateAmount + amount)
  });
}

function sortStatementLines(lines: FinanceStatementLine[]) {
  return [...lines].sort((left, right) => {
    const sectionDiff = left.section.localeCompare(right.section);

    if (sectionDiff !== 0) {
      return sectionDiff;
    }

    return left.itemName.localeCompare(right.itemName);
  });
}

function sortCashFlowLines(lines: FinanceCashFlowStatementLine[]) {
  const activityOrder: Record<FinanceCashFlowActivity, number> = {
    经营活动: 1,
    投资活动: 2,
    筹资活动: 3
  };

  return [...lines].sort((left, right) => {
    const activityDiff = activityOrder[left.activity] - activityOrder[right.activity];

    if (activityDiff !== 0) {
      return activityDiff;
    }

    return left.itemName.localeCompare(right.itemName);
  });
}

function getBalanceSheetTotal(lines: FinanceStatementLine[], sections: FinanceStatementSection[]) {
  return roundStatementAmount(
    lines
      .filter((line) => sections.includes(line.section))
      .reduce((total, line) => total + line.amount, 0)
  );
}

function appendCurrentProfitToEquityIfNeeded(
  lines: FinanceStatementLine[],
  profitLines: FinanceStatementLine[],
  profitTotal: number
) {
  if (Math.abs(profitTotal) < 0.01) {
    return lines;
  }

  const assetTotal = getBalanceSheetTotal(lines, ['资产']);
  const liabilityEquityTotal = getBalanceSheetTotal(lines, ['负债', '所有者权益']);
  const difference = roundStatementAmount(assetTotal - liabilityEquityTotal);

  if (Math.abs(difference - profitTotal) > 0.01) {
    return lines;
  }

  return sortStatementLines([
    ...lines,
    {
      amount: profitTotal,
      itemName: '本期利润',
      openingAmount: 0,
      section: '所有者权益',
      sourceSubjectCodes: [...new Set(profitLines.flatMap((line) => line.sourceSubjectCodes))],
      sourceSubjectCount: new Set(profitLines.flatMap((line) => line.sourceSubjectCodes)).size,
      yearToDateAmount: profitLines.reduce((total, line) => (
        total + (line.section === '收入' ? line.yearToDateAmount ?? line.amount : -(line.yearToDateAmount ?? line.amount))
      ), 0)
    }
  ]);
}

function isCashSubjectCode(subjectCode: string) {
  return subjectCode === '1001' || subjectCode === '1002' || subjectCode === '1012' || /^10(01|02|12)\./.test(subjectCode);
}

function getEntryAmount(entry: GeneralLedgerSubjectBalanceRow['entries'][number]) {
  return roundStatementAmount(entry.debitAmount + entry.creditAmount);
}

function getVoucherCashMovement(entries: GeneralLedgerSubjectBalanceRow['entries']) {
  return roundStatementAmount(
    entries
      .filter((entry) => isCashSubjectCode(entry.subjectCode))
      .reduce((total, entry) => total + entry.debitAmount - entry.creditAmount, 0)
  );
}

function getCashBalanceSummary(subjectRows: GeneralLedgerSubjectBalanceRow[]) {
  const cashRows = subjectRows.filter((row) => isCashSubjectCode(row.subjectCode));
  const openingBalance = roundStatementAmount(
    cashRows.reduce((total, row) => total + getBalanceSheetLineAmount(row, row.openingBalance), 0)
  );
  const closingBalance = roundStatementAmount(
    cashRows.reduce((total, row) => total + getBalanceSheetLineAmount(row, row.endingBalance), 0)
  );

  return {
    closingBalance,
    movement: roundStatementAmount(closingBalance - openingBalance),
    openingBalance
  };
}

function buildCashFlowStatementRows(subjectRows: GeneralLedgerSubjectBalanceRow[]) {
  const subjectByCode = new Map(subjectRows.map((row) => [row.subjectCode, row]));
  const entriesByVoucher = new Map<string, GeneralLedgerSubjectBalanceRow['entries']>();

  subjectRows.forEach((row) => {
    row.entries.forEach((entry) => {
      entriesByVoucher.set(entry.voucherId, [...(entriesByVoucher.get(entry.voucherId) ?? []), entry]);
    });
  });

  const cashFlowRows = new Map<string, FinanceCashFlowStatementLine>();
  const gaps: FinanceCashFlowMappingGap[] = [];

  entriesByVoucher.forEach((entries) => {
    const cashEntries = entries.filter((entry) => isCashSubjectCode(entry.subjectCode));

    if (cashEntries.length === 0) {
      return;
    }

    const cashMovement = getVoucherCashMovement(entries);

    if (Math.abs(cashMovement) < 0.01) {
      return;
    }

    const counterpartyEntries = entries.filter((entry) => !isCashSubjectCode(entry.subjectCode));
    const mappedCounterparties = counterpartyEntries.filter((entry) => {
      const subject = subjectByCode.get(entry.subjectCode);

      return Boolean(subject?.cashFlowActivity && subject.cashFlowItem);
    });
    const unmappedCounterparties = counterpartyEntries.filter((entry) => {
      const subject = subjectByCode.get(entry.subjectCode);

      return !subject?.cashFlowActivity || !subject.cashFlowItem;
    });
    const totalCounterpartyAmount = counterpartyEntries.reduce((total, entry) => total + getEntryAmount(entry), 0);

    if (mappedCounterparties.length === 0) {
      gaps.push({
        amount: cashMovement,
        cashSubjectCodes: [...new Set(cashEntries.map((entry) => entry.subjectCode))],
        counterpartySubjectCodes: [...new Set(counterpartyEntries.map((entry) => entry.subjectCode))],
        reason: '现金/银行分录的对方科目未配置现金流量项目',
        voucherDate: cashEntries[0]?.voucherDate ?? entries[0]?.voucherDate ?? '',
        voucherNo: cashEntries[0]?.voucherNo ?? entries[0]?.voucherNo ?? ''
      });
      return;
    }

    if (unmappedCounterparties.length > 0) {
      const unmappedAmount = unmappedCounterparties.reduce((total, entry) => total + getEntryAmount(entry), 0);
      const allocationRatio = totalCounterpartyAmount > 0 ? unmappedAmount / totalCounterpartyAmount : 1;

      gaps.push({
        amount: roundStatementAmount(cashMovement * allocationRatio),
        cashSubjectCodes: [...new Set(cashEntries.map((entry) => entry.subjectCode))],
        counterpartySubjectCodes: [...new Set(unmappedCounterparties.map((entry) => entry.subjectCode))],
        reason: '现金/银行分录的部分对方科目未配置现金流量项目',
        voucherDate: cashEntries[0]?.voucherDate ?? entries[0]?.voucherDate ?? '',
        voucherNo: cashEntries[0]?.voucherNo ?? entries[0]?.voucherNo ?? ''
      });
    }

    mappedCounterparties.forEach((entry) => {
      const subject = subjectByCode.get(entry.subjectCode);

      if (!subject?.cashFlowActivity || !subject.cashFlowItem) {
        return;
      }

      const allocationRatio =
        totalCounterpartyAmount > 0 ? getEntryAmount(entry) / totalCounterpartyAmount : 1 / mappedCounterparties.length;
      const allocatedAmount = roundStatementAmount(cashMovement * allocationRatio);

      mergeCashFlowLine(
        cashFlowRows,
        subject.cashFlowActivity,
        subject.cashFlowItem,
        allocatedAmount,
        entry.subjectCode,
        entry.voucherNo
      );
    });
  });

  const cashFlowLines = sortCashFlowLines([...cashFlowRows.values()]);
  const cashFlowNetAmount = roundStatementAmount(cashFlowLines.reduce((total, line) => total + line.amount, 0));

  return {
    cashFlowLines,
    cashFlowMappingGaps: gaps.sort((left, right) => left.voucherDate.localeCompare(right.voucherDate)),
    cashFlowNetAmount
  };
}

function mergeYearToDateProfitLines(
  currentLines: FinanceStatementLine[],
  yearToDateSubjectRows: GeneralLedgerSubjectBalanceRow[]
) {
  const yearToDateRows = new Map<string, FinanceStatementLine>();
  const currentRows = new Map(currentLines.map((line) => [`${line.section}:${line.itemName}`, line]));

  yearToDateSubjectRows.forEach((row) => {
    if (row.statementTarget === '利润表') {
      mergeStatementLine(yearToDateRows, getProfitSection(row), row.reportItem, 0, row.subjectCode, {
        yearToDateAmount: getProfitLineAmount(row)
      });
    }
  });

  const keys = new Set([...currentRows.keys(), ...yearToDateRows.keys()]);

  return [...keys].reduce<FinanceStatementLine[]>((lines, key) => {
    const current = currentRows.get(key);
    const matched = yearToDateRows.get(key);
    const source = current ?? matched;

    if (!source) {
      return lines;
    }

    lines.push({
      ...source,
      amount: current?.amount ?? 0,
      openingAmount: current?.openingAmount ?? matched?.openingAmount,
      sourceSubjectCodes: current?.sourceSubjectCodes ?? matched?.sourceSubjectCodes ?? [],
      sourceSubjectCount: current?.sourceSubjectCount ?? matched?.sourceSubjectCount ?? 0,
      yearToDateAmount: matched?.yearToDateAmount ?? current?.amount ?? 0
    });

    return lines;
  }, []);
}

function mergeYearToDateCashFlowLines(
  currentLines: FinanceCashFlowStatementLine[],
  yearToDateSubjectRows: GeneralLedgerSubjectBalanceRow[]
) {
  const yearToDateRows = buildCashFlowStatementRows(yearToDateSubjectRows);
  const currentByKey = new Map(currentLines.map((line) => [`${line.activity}:${line.itemName}`, line]));
  const yearToDateByKey = new Map(yearToDateRows.cashFlowLines.map((line) => [`${line.activity}:${line.itemName}`, line]));
  const keys = new Set([...currentByKey.keys(), ...yearToDateByKey.keys()]);

  return {
    cashFlowLines: [...keys].reduce<FinanceCashFlowStatementLine[]>((lines, key) => {
      const current = currentByKey.get(key);
      const matched = yearToDateByKey.get(key);
      const source = current ?? matched;

      if (!source) {
        return lines;
      }

      lines.push({
        ...source,
        amount: current?.amount ?? 0,
        sourceSubjectCodes: current?.sourceSubjectCodes ?? matched?.sourceSubjectCodes ?? [],
        sourceSubjectCount: current?.sourceSubjectCount ?? matched?.sourceSubjectCount ?? 0,
        voucherCount: current?.voucherCount ?? 0,
        voucherNos: current?.voucherNos ?? [],
        yearToDateAmount: matched?.amount ?? current?.amount ?? 0
      });

      return lines;
    }, []),
    cashFlowYearToDateNetAmount: yearToDateRows.cashFlowNetAmount,
    yearToDateMappingGaps: yearToDateRows.cashFlowMappingGaps
  };
}

function getCashFlowReadinessDetail({
  cashFlowReconciliationDifference,
  cashFlowLines,
  cashFlowMappingGaps,
  cashFlowYearToDateReconciliationDifference
}: {
  cashFlowReconciliationDifference: number;
  cashFlowLines: FinanceCashFlowStatementLine[];
  cashFlowMappingGaps: FinanceCashFlowMappingGap[];
  cashFlowYearToDateReconciliationDifference: number;
}) {
  if (cashFlowMappingGaps.length > 0) {
    return `${cashFlowMappingGaps.length} 张含现金/银行分录的凭证缺少对方科目现金流量项目映射；暂不从应收应付、流水或发票源单倒推。`;
  }

  if (Math.abs(cashFlowReconciliationDifference) > 0.01 || Math.abs(cashFlowYearToDateReconciliationDifference) > 0.01) {
    return '现金流量表净额与货币资金期初、期末余额变动不一致；需先核对现金/银行科目和现金流量项目映射。';
  }

  if (cashFlowLines.length > 0) {
    return '现金流量表按已记账凭证中的现金/银行分录和对方科目现金流量项目映射汇总。';
  }

  return '本期无现金或银行存款变动，现金流量表金额为零。';
}

function uniqueCashFlowMappingGaps(gaps: FinanceCashFlowMappingGap[]) {
  const seen = new Set<string>();

  return gaps.filter((gap) => {
    const key = `${gap.voucherNo}:${gap.amount}:${gap.voucherDate}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function buildFinanceFinancialStatementReport({
  periodSummary,
  subjectRows,
  yearToDateSubjectRows = subjectRows
}: {
  periodSummary: GeneralLedgerPeriodSummary;
  subjectRows: GeneralLedgerSubjectBalanceRow[];
  yearToDateSubjectRows?: GeneralLedgerSubjectBalanceRow[];
}): FinanceFinancialStatementReport {
  const mode = getStatementMode(periodSummary);
  const snapshotReport = cloneFinancialStatementSnapshotReport(periodSummary, mode);

  if (snapshotReport) {
    return snapshotReport;
  }

  const balanceSheetRows = new Map<string, FinanceStatementLine>();
  const profitRows = new Map<string, FinanceStatementLine>();
  const {
    cashFlowLines,
    cashFlowMappingGaps,
    cashFlowNetAmount
  } = buildCashFlowStatementRows(subjectRows);
  const {
    cashFlowLines: cashFlowLinesWithYearToDate,
    cashFlowYearToDateNetAmount,
    yearToDateMappingGaps
  } = mergeYearToDateCashFlowLines(cashFlowLines, yearToDateSubjectRows);
  const cashBalance = getCashBalanceSummary(subjectRows);
  const yearToDateCashBalance = getCashBalanceSummary(yearToDateSubjectRows);
  const cashFlowReconciliationDifference = roundStatementAmount(cashFlowNetAmount - cashBalance.movement);
  const cashFlowYearToDateReconciliationDifference = roundStatementAmount(
    cashFlowYearToDateNetAmount - yearToDateCashBalance.movement
  );

  subjectRows.forEach((row) => {
    if (row.statementTarget === '资产负债表') {
      const section = getBalanceSheetSection(row);

      if (section) {
        mergeStatementLine(
          balanceSheetRows,
          section,
          row.reportItem,
          getBalanceSheetLineAmount(row, row.endingBalance),
          row.subjectCode,
          {
            openingAmount: getBalanceSheetLineAmount(row, row.openingBalance)
          }
        );
      }
    }

    if (row.statementTarget === '利润表') {
      mergeStatementLine(profitRows, getProfitSection(row), row.reportItem, getProfitLineAmount(row), row.subjectCode);
    }
  });

  const rawBalanceSheetLines = sortStatementLines([...balanceSheetRows.values()]);
  const profitLines = mergeYearToDateProfitLines(sortStatementLines([...profitRows.values()]), yearToDateSubjectRows);
  const profitTotal = roundStatementAmount(
    profitLines.reduce((total, line) => total + (line.section === '收入' ? line.amount : -line.amount), 0)
  );
  const balanceSheetLines = appendCurrentProfitToEquityIfNeeded(rawBalanceSheetLines, profitLines, profitTotal);
  const assetTotal = getBalanceSheetTotal(balanceSheetLines, ['资产']);
  const liabilityEquityTotal = getBalanceSheetTotal(balanceSheetLines, ['负债', '所有者权益']);
  const allCashFlowMappingGaps = uniqueCashFlowMappingGaps([...cashFlowMappingGaps, ...yearToDateMappingGaps]);
  const cashFlowReadiness =
    allCashFlowMappingGaps.length === 0
    && Math.abs(cashFlowReconciliationDifference) <= 0.01
    && Math.abs(cashFlowYearToDateReconciliationDifference) <= 0.01
      ? '可出具'
      : '待处理';

  return {
    accountingPeriod: periodSummary.periodKey ?? periodSummary.periodLabel,
    assetTotal,
    balanceSheetLines,
    cashFlowClosingBalance: cashBalance.closingBalance,
    cashFlowLines: cashFlowLinesWithYearToDate,
    cashFlowMappingGaps: allCashFlowMappingGaps,
    cashFlowNetAmount,
    cashFlowOpeningBalance: cashBalance.openingBalance,
    cashFlowReadiness,
    cashFlowReadinessDetail: getCashFlowReadinessDetail({
      cashFlowReconciliationDifference,
      cashFlowLines: cashFlowLinesWithYearToDate,
      cashFlowMappingGaps: allCashFlowMappingGaps,
      cashFlowYearToDateReconciliationDifference
    }),
    cashFlowReconciliationDifference,
    cashFlowYearToDateClosingBalance: yearToDateCashBalance.closingBalance,
    cashFlowYearToDateNetAmount,
    cashFlowYearToDateOpeningBalance: yearToDateCashBalance.openingBalance,
    cashFlowYearToDateReconciliationDifference,
    liabilityEquityTotal,
    mode,
    periodLabel: periodSummary.periodLabel,
    profitLines,
    profitTotal,
    reportBasis: `总账：${periodSummary.bookedVoucherCount} 张已记账凭证 / ${formatMoney(periodSummary.debitTotal)} 借方 / ${formatMoney(periodSummary.creditTotal)} 贷方`,
    reportNotice: mode === '正式报表' ? getReportNotice(periodSummary, mode) : getTrialReportNotice(mode),
    trialBalanceStatus: periodSummary.trialBalanceStatus
  };
}
