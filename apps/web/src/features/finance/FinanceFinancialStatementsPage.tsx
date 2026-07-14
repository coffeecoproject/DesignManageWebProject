import {
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { Segmented } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeQuarterRange,
  getDateScopeRange,
  getDateScopeYearRange,
  type DateRangeFilterValue,
  type DateScopeFilterMode,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag, type DetailInfoGridItem } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell, type CellTextTone } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVouchers,
  type AccountingLedgerEntry,
  type AccountingPeriodLockRecord
} from './financeAccountingVoucherModel';
import {
  buildGeneralLedgerResponse,
  defaultGeneralLedgerFilters,
  generalLedgerDefaultMonth
} from './financeGeneralLedgerModel';
import {
  buildFinanceFinancialStatementReport,
  type FinanceCashFlowStatementLine,
  type FinanceFinancialStatementArchiveStatus,
  type FinanceFinancialStatementReport,
  type FinanceStatementMode
} from './financeFinancialStatementsModel';
import { accountingSubjectProfile } from './financeAccountingSubjectData';
import { formatMoney } from './financeUtils';

const accountingMonthPattern = /^\d{4}-\d{2}$/;

type FinancialStatementCycle = 'month' | 'quarter' | 'year';

const statementCycleOptions: Array<{ label: string; value: FinancialStatementCycle }> = [
  { label: '月度', value: 'month' },
  { label: '季度', value: 'quarter' },
  { label: '年度', value: 'year' }
];

const statementCycleLabelMap: Record<FinancialStatementCycle, string> = {
  month: '月度',
  quarter: '季度',
  year: '年度'
};

const statementPeriodModeOptionsByCycle: Record<FinancialStatementCycle, Array<{ label: string; value: DateScopeFilterMode }>> = {
  month: [
    { label: '全部', value: 'all' },
    { label: '当月', value: 'currentMonth' },
    { label: '按月份', value: 'month' },
    { label: '按时间段', value: 'range' }
  ],
  quarter: [
    { label: '全部', value: 'all' },
    { label: '当季', value: 'currentQuarter' },
    { label: '按季度', value: 'quarter' },
    { label: '按时间段', value: 'range' }
  ],
  year: [
    { label: '全部', value: 'all' },
    { label: '当年', value: 'currentYear' },
    { label: '按年份', value: 'year' },
    { label: '按时间段', value: 'range' }
  ]
};

const statementPeriodModeFallbackOptions: Array<{ label: string; value: DateScopeFilterMode }> = [
  { label: '全部', value: 'all' },
  { label: '当月', value: 'currentMonth' },
  { label: '按月份', value: 'month' },
  { label: '按时间段', value: 'range' }
];

const statementModeTone: Record<FinanceStatementMode, 'blue' | 'gray'> = {
  待结账: 'blue',
  正式报表: 'gray'
};

const statementArchiveStatusTone = {
  待结账预览: 'blue',
  已归档: 'green',
  快照缺失: 'red'
} as const;

const trialBalanceTone = {
  不平衡: 'red',
  平衡: 'green'
} as const;

const cashFlowReadinessTone = {
  可出具: 'green',
  待处理: 'amber'
} as const;

const financialStatementReadinessTone = {
  可出具: 'green',
  待处理: 'amber'
} as const;

type BalanceSheetTemplateItem = {
  itemName: string;
  lineType?: 'normal' | 'subtotal' | 'total';
  sourceItems?: string[];
};

type ProfitStatementTemplateItem = {
  itemName: string;
  lineType?: 'normal' | 'subtotal' | 'total';
  sourceItems?: string[];
  sourceSection?: '收入' | '成本费用';
  valueMode?: 'income' | 'expense' | 'profit';
};

type CashFlowStatementTemplateItem = {
  activity?: FinanceCashFlowStatementLine['activity'];
  itemName: string;
  lineType?: 'normal' | 'subtotal' | 'total';
  sourceItems?: string[];
  valueMode?: 'cash-in' | 'cash-out' | 'net' | 'balance';
};

type BalanceSheetDisplayRow = {
  assetAmount?: number;
  assetItem?: string;
  assetOpeningAmount?: number;
  key: string;
  liabilityAmount?: number;
  liabilityItem?: string;
  liabilityOpeningAmount?: number;
};

type StatementDisplayRow = {
  amount: number;
  amountTone?: CellTextTone;
  itemName: string;
  key: string;
  lineType?: 'normal' | 'subtotal' | 'total';
  section?: string;
  yearToDateAmount: number;
};

type FinancialStatementArchiveRow = {
  accountingPeriod: string;
  archiveGeneratedAt?: string;
  archiveGeneratedBy?: string;
  archiveReason?: string;
  archiveSource: string;
  archiveStatus: FinanceFinancialStatementArchiveStatus;
  assetTotal: number;
  balanceSheetRows: BalanceSheetDisplayRow[];
  bookedVoucherCount: number;
  cashFlowNetAmount: number;
  cashFlowReadiness: FinanceFinancialStatementReport['cashFlowReadiness'];
  cashFlowRows: StatementDisplayRow[];
  expenseTotal: number;
  financialStatementReadiness: FinanceFinancialStatementReport['financialStatementReadiness'];
  incomeTotal: number;
  liabilityEquityTotal: number;
  periodLabel: string;
  periodMonths: string[];
  periodRange: DateRangeFilterValue;
  periodRangeLabel: string;
  periodType: FinancialStatementCycle;
  profitRows: StatementDisplayRow[];
  profitTotal: number;
  report: FinanceFinancialStatementReport;
  reportStatus: FinanceStatementMode;
  trialBalanceStatus: FinanceFinancialStatementReport['trialBalanceStatus'];
};

type FinancialStatementArchiveMetrics = {
  statementReadyCount: number;
  officialCount: number;
  periodCount: number;
  trialCount: number;
};

type FinancialStatementPeriodDescriptor = {
  key: string;
  label: string;
  months: string[];
  range: DateRangeFilterValue;
  rangeLabel: string;
  type: FinancialStatementCycle;
};

function formatOptionalStatementAmount(amount?: number) {
  if (amount === undefined) {
    return '';
  }

  return amount === 0 ? '-' : formatMoney(amount);
}

function formatStatementAmount(amount: number) {
  return amount === 0 ? '-' : formatMoney(amount);
}

function roundStatementAmount(value: number) {
  return Math.round(value * 100) / 100;
}

const balanceSheetAssetTemplate: BalanceSheetTemplateItem[] = [
  { itemName: '货币资金' },
  { itemName: '应收账款' },
  { itemName: '预付款项' },
  { itemName: '其他应收款' },
  { itemName: '存货' },
  { itemName: '固定资产' },
  { itemName: '无形资产' },
  { itemName: '长期待摊费用' },
  {
    itemName: '资产合计',
    lineType: 'total',
    sourceItems: ['货币资金', '应收账款', '预付款项', '其他应收款', '存货', '固定资产', '无形资产', '长期待摊费用']
  }
];

const balanceSheetLiabilityEquityTemplate: BalanceSheetTemplateItem[] = [
  { itemName: '短期借款' },
  { itemName: '应付账款' },
  { itemName: '预收款项' },
  { itemName: '应付职工薪酬' },
  { itemName: '应交税费' },
  { itemName: '其他应付款' },
  {
    itemName: '负债合计',
    lineType: 'subtotal',
    sourceItems: ['短期借款', '应付账款', '预收款项', '应付职工薪酬', '应交税费', '其他应付款']
  },
  { itemName: '实收资本' },
  { itemName: '资本公积' },
  { itemName: '未分配利润', sourceItems: ['未分配利润', '本期利润'] },
  {
    itemName: '所有者权益合计',
    lineType: 'subtotal',
    sourceItems: ['实收资本', '资本公积', '未分配利润', '本期利润']
  },
  {
    itemName: '负债和所有者权益合计',
    lineType: 'total',
    sourceItems: ['短期借款', '应付账款', '预收款项', '应付职工薪酬', '应交税费', '其他应付款', '实收资本', '资本公积', '未分配利润', '本期利润']
  }
];

const profitStatementTemplate: ProfitStatementTemplateItem[] = [
  { itemName: '营业收入', sourceItems: ['营业收入'], sourceSection: '收入', valueMode: 'income' },
  { itemName: '减：营业成本', sourceItems: ['营业成本'], sourceSection: '成本费用', valueMode: 'expense' },
  { itemName: '减：税金及附加', sourceItems: ['税金及附加'], sourceSection: '成本费用', valueMode: 'expense' },
  { itemName: '减：销售费用', sourceItems: ['销售费用'], sourceSection: '成本费用', valueMode: 'expense' },
  { itemName: '减：管理费用', sourceItems: ['管理费用'], sourceSection: '成本费用', valueMode: 'expense' },
  { itemName: '减：财务费用', sourceItems: ['财务费用'], sourceSection: '成本费用', valueMode: 'expense' },
  {
    itemName: '营业利润',
    lineType: 'subtotal',
    sourceItems: ['营业收入', '营业成本', '税金及附加', '销售费用', '管理费用', '财务费用'],
    valueMode: 'profit'
  },
  { itemName: '加：营业外收入', sourceItems: ['营业外收入'], sourceSection: '收入', valueMode: 'income' },
  { itemName: '减：营业外支出', sourceItems: ['营业外支出'], sourceSection: '成本费用', valueMode: 'expense' },
  {
    itemName: '利润总额',
    lineType: 'subtotal',
    sourceItems: ['营业收入', '营业成本', '税金及附加', '销售费用', '管理费用', '财务费用', '营业外收入', '营业外支出'],
    valueMode: 'profit'
  },
  { itemName: '减：所得税费用', sourceItems: ['所得税费用'], sourceSection: '成本费用', valueMode: 'expense' },
  {
    itemName: '净利润',
    lineType: 'total',
    sourceItems: ['营业收入', '营业成本', '税金及附加', '销售费用', '管理费用', '财务费用', '营业外收入', '营业外支出', '所得税费用'],
    valueMode: 'profit'
  }
];

const cashFlowStatementTemplate: CashFlowStatementTemplateItem[] = [
  {
    activity: '经营活动',
    itemName: '销售商品、提供劳务收到的现金',
    sourceItems: ['销售商品、提供劳务收到的现金'],
    valueMode: 'cash-in'
  },
  {
    activity: '经营活动',
    itemName: '收到其他与经营活动有关的现金',
    sourceItems: ['收到其他与经营活动有关的现金'],
    valueMode: 'cash-in'
  },
  {
    activity: '经营活动',
    itemName: '经营活动现金流入小计',
    lineType: 'subtotal',
    sourceItems: ['销售商品、提供劳务收到的现金', '收到其他与经营活动有关的现金'],
    valueMode: 'cash-in'
  },
  {
    activity: '经营活动',
    itemName: '购买商品、接受劳务支付的现金',
    sourceItems: ['购买商品、接受劳务支付的现金'],
    valueMode: 'cash-out'
  },
  {
    activity: '经营活动',
    itemName: '支付给职工以及为职工支付的现金',
    sourceItems: ['支付给职工以及为职工支付的现金'],
    valueMode: 'cash-out'
  },
  {
    activity: '经营活动',
    itemName: '支付的各项税费',
    sourceItems: ['支付的各项税费'],
    valueMode: 'cash-out'
  },
  {
    activity: '经营活动',
    itemName: '支付其他与经营活动有关的现金',
    sourceItems: ['支付其他与经营活动有关的现金'],
    valueMode: 'cash-out'
  },
  {
    activity: '经营活动',
    itemName: '经营活动现金流出小计',
    lineType: 'subtotal',
    sourceItems: ['购买商品、接受劳务支付的现金', '支付给职工以及为职工支付的现金', '支付的各项税费', '支付其他与经营活动有关的现金'],
    valueMode: 'cash-out'
  },
  {
    activity: '经营活动',
    itemName: '经营活动产生的现金流量净额',
    lineType: 'subtotal',
    sourceItems: ['销售商品、提供劳务收到的现金', '收到其他与经营活动有关的现金', '购买商品、接受劳务支付的现金', '支付给职工以及为职工支付的现金', '支付的各项税费', '支付其他与经营活动有关的现金'],
    valueMode: 'net'
  },
  {
    activity: '投资活动',
    itemName: '投资活动产生的现金流量净额',
    lineType: 'subtotal',
    valueMode: 'net'
  },
  {
    activity: '筹资活动',
    itemName: '吸收投资收到的现金',
    sourceItems: ['吸收投资收到的现金'],
    valueMode: 'cash-in'
  },
  {
    activity: '筹资活动',
    itemName: '筹资活动产生的现金流量净额',
    lineType: 'subtotal',
    sourceItems: ['吸收投资收到的现金'],
    valueMode: 'net'
  },
  {
    itemName: '现金及现金等价物净增加额',
    lineType: 'total',
    valueMode: 'net'
  },
  {
    itemName: '加：期初现金及现金等价物余额',
    lineType: 'total',
    valueMode: 'balance'
  },
  {
    itemName: '期末现金及现金等价物余额',
    lineType: 'total',
    valueMode: 'balance'
  }
];

function getYearToDateRange(month: string) {
  const year = month.slice(0, 4);
  const monthRange = getDateScopeMonthRange(month);

  return {
    mode: 'range' as const,
    range: {
      endDate: monthRange.endDate,
      startDate: `${year}-01-01`
    }
  };
}

function formatAccountingQuarterOrdinal(ordinal: number) {
  const year = Math.floor(ordinal / 4);
  const quarter = ordinal % 4 + 1;

  return `${year}-Q${quarter}`;
}

function getQuarterMonths(quarter: string) {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);

  if (!match) {
    return [];
  }

  const [, year, quarterText] = match;
  const quarterNumber = Number(quarterText);
  const startMonth = (quarterNumber - 1) * 3 + 1;

  return Array.from({ length: 3 }, (_, index) => `${year}-${String(startMonth + index).padStart(2, '0')}`);
}

function getYearMonths(year: string) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

function getPeriodRangeLabel(range: DateRangeFilterValue) {
  return `${range.startDate} 至 ${range.endDate}`;
}

function createMonthlyPeriodDescriptor(month: string): FinancialStatementPeriodDescriptor {
  const range = getDateScopeMonthRange(month);

  return {
    key: month,
    label: month,
    months: [month],
    range,
    rangeLabel: getPeriodRangeLabel(range),
    type: 'month'
  };
}

function createQuarterlyPeriodDescriptor(quarter: string): FinancialStatementPeriodDescriptor {
  const range = getDateScopeQuarterRange(quarter);

  return {
    key: quarter,
    label: quarter,
    months: getQuarterMonths(quarter),
    range,
    rangeLabel: getPeriodRangeLabel(range),
    type: 'quarter'
  };
}

function createAnnualPeriodDescriptor(year: string): FinancialStatementPeriodDescriptor {
  const range = getDateScopeYearRange(year);

  return {
    key: year,
    label: year,
    months: getYearMonths(year),
    range,
    rangeLabel: getPeriodRangeLabel(range),
    type: 'year'
  };
}

function isAccountingMonth(period: string) {
  return accountingMonthPattern.test(period);
}

function getAccountingMonthOrdinal(period: string) {
  const [year, month] = period.split('-').map(Number);

  return year * 12 + month - 1;
}

function formatAccountingMonthOrdinal(ordinal: number) {
  const year = Math.floor(ordinal / 12);
  const month = ordinal % 12 + 1;

  return `${year}-${String(month).padStart(2, '0')}`;
}

function isStatementPeriodInDateScope(record: FinancialStatementArchiveRow, value: DateScopeFilterValue) {
  if (value.mode === 'all') {
    return true;
  }

  const range = getDateScopeRange(value, generalLedgerDefaultMonth);

  if (!range) {
    return true;
  }

  return record.periodRange.startDate <= range.endDate && record.periodRange.endDate >= range.startDate;
}

function expandAccountingPeriods(periods: Set<string>) {
  const monthOrdinals = [...periods].filter(isAccountingMonth).map(getAccountingMonthOrdinal);

  if (monthOrdinals.length === 0) {
    return [generalLedgerDefaultMonth];
  }

  const startOrdinal = Math.min(...monthOrdinals);
  const endOrdinal = Math.max(...monthOrdinals, getAccountingMonthOrdinal(generalLedgerDefaultMonth));
  const expandedPeriods: string[] = [];

  for (let ordinal = endOrdinal; ordinal >= startOrdinal; ordinal -= 1) {
    expandedPeriods.push(formatAccountingMonthOrdinal(ordinal));
  }

  return expandedPeriods;
}

function getAvailableAccountingPeriods(
  ledgerEntries: AccountingLedgerEntry[],
  accountingPeriodLocks: AccountingPeriodLockRecord[]
) {
  const periods = new Set<string>([generalLedgerDefaultMonth]);

  ledgerEntries.forEach((entry) => {
    if (isAccountingMonth(entry.accountingPeriod)) {
      periods.add(entry.accountingPeriod);
    }
  });

  accountingPeriodLocks.forEach((lock) => {
    if (isAccountingMonth(lock.accountingPeriod)) {
      periods.add(lock.accountingPeriod);
    }
  });

  return expandAccountingPeriods(periods);
}

function getAvailableStatementPeriods(months: string[], cycle: FinancialStatementCycle) {
  if (cycle === 'month') {
    return months.map(createMonthlyPeriodDescriptor);
  }

  const monthOrdinals = months.map(getAccountingMonthOrdinal);

  if (monthOrdinals.length === 0) {
    return [createMonthlyPeriodDescriptor(generalLedgerDefaultMonth)];
  }

  const startOrdinal = Math.min(...monthOrdinals);
  const endOrdinal = Math.max(...monthOrdinals);

  if (cycle === 'quarter') {
    const descriptors: FinancialStatementPeriodDescriptor[] = [];
    const startQuarterOrdinal = Math.floor(startOrdinal / 3);
    const endQuarterOrdinal = Math.floor(endOrdinal / 3);

    for (let ordinal = endQuarterOrdinal; ordinal >= startQuarterOrdinal; ordinal -= 1) {
      descriptors.push(createQuarterlyPeriodDescriptor(formatAccountingQuarterOrdinal(ordinal)));
    }

    return descriptors;
  }

  const descriptors: FinancialStatementPeriodDescriptor[] = [];
  const startYear = Math.floor(startOrdinal / 12);
  const endYear = Math.floor(endOrdinal / 12);

  for (let year = endYear; year >= startYear; year -= 1) {
    descriptors.push(createAnnualPeriodDescriptor(String(year)));
  }

  return descriptors;
}

function getStatementPeriodScope(period: FinancialStatementPeriodDescriptor): DateScopeFilterValue {
  if (period.type === 'month') {
    return {
      mode: 'month',
      month: period.key
    };
  }

  return {
    mode: 'range',
    range: period.range
  };
}

function getPeriodEndMonth(period: FinancialStatementPeriodDescriptor) {
  return period.months[period.months.length - 1] ?? generalLedgerDefaultMonth;
}

function getClosedMonthSet(accountingPeriodLocks: AccountingPeriodLockRecord[]) {
  return new Set(
    accountingPeriodLocks
      .filter((lock) => lock.status === '已结账' && isAccountingMonth(lock.accountingPeriod))
      .map((lock) => lock.accountingPeriod)
  );
}

function getAggregateGeneratedAt(
  period: FinancialStatementPeriodDescriptor,
  accountingPeriodLocks: AccountingPeriodLockRecord[]
) {
  const lockedAtValues = period.months
    .map((month) => accountingPeriodLocks.find((lock) => lock.accountingPeriod === month && lock.status === '已结账')?.lockedAt)
    .filter((lockedAt): lockedAt is string => Boolean(lockedAt))
    .sort();

  return lockedAtValues[lockedAtValues.length - 1];
}

function getPeriodReportStatus({
  accountingPeriodLocks,
  period,
  report
}: {
  accountingPeriodLocks: AccountingPeriodLockRecord[];
  period: FinancialStatementPeriodDescriptor;
  report: FinanceFinancialStatementReport;
}): FinanceStatementMode {
  if (report.financialStatementReadiness !== '可出具') {
    return '待结账';
  }

  if (period.type === 'month') {
    return report.mode;
  }

  const closedMonths = getClosedMonthSet(accountingPeriodLocks);

  return period.months.length > 0 && period.months.every((month) => closedMonths.has(month)) ? '正式报表' : '待结账';
}

function buildBalanceSheetRows(report: FinanceFinancialStatementReport): BalanceSheetDisplayRow[] {
  const linesByItem = new Map(report.balanceSheetLines.map((line) => [`${line.section}:${line.itemName}`, line]));
  const readTemplateAmount = (template: BalanceSheetTemplateItem, sections: Array<'资产' | '负债' | '所有者权益'>) => {
    if (template.lineType) {
      return roundStatementAmount(
        (template.sourceItems ?? []).reduce((total, itemName) => (
          total + sections.reduce((sectionTotal, section) => sectionTotal + (linesByItem.get(`${section}:${itemName}`)?.amount ?? 0), 0)
        ), 0)
      );
    }

    return sections.reduce((total, section) => total + (linesByItem.get(`${section}:${template.itemName}`)?.amount ?? 0), 0);
  };
  const readTemplateOpeningAmount = (template: BalanceSheetTemplateItem, sections: Array<'资产' | '负债' | '所有者权益'>) => {
    if (template.lineType) {
      return roundStatementAmount(
        (template.sourceItems ?? []).reduce((total, itemName) => (
          total + sections.reduce((sectionTotal, section) => sectionTotal + (linesByItem.get(`${section}:${itemName}`)?.openingAmount ?? 0), 0)
        ), 0)
      );
    }

    return sections.reduce((total, section) => total + (linesByItem.get(`${section}:${template.itemName}`)?.openingAmount ?? 0), 0);
  };
  const assetRows = balanceSheetAssetTemplate.map((template) => ({
    amount: template.itemName === '资产合计' ? report.assetTotal : readTemplateAmount(template, ['资产']),
    itemName: template.itemName,
    lineType: template.lineType,
    openingAmount: readTemplateOpeningAmount(template, ['资产'])
  }));
  const liabilityRows = balanceSheetLiabilityEquityTemplate.map((template) => ({
    amount: template.itemName === '负债和所有者权益合计'
      ? report.liabilityEquityTotal
      : readTemplateAmount(template, ['负债', '所有者权益']),
    itemName: template.itemName,
    lineType: template.lineType,
    openingAmount: readTemplateOpeningAmount(template, ['负债', '所有者权益'])
  }));
  const maxLength = Math.max(assetRows.length, liabilityRows.length);
  const rows: BalanceSheetDisplayRow[] = Array.from({ length: maxLength }, (_, index) => {
    const asset = assetRows[index];
    const liability = liabilityRows[index];

    return {
      assetAmount: asset?.amount,
      assetItem: asset?.itemName,
      assetOpeningAmount: asset?.openingAmount,
      key: `balance-${index}`,
      liabilityAmount: liability?.amount,
      liabilityItem: liability?.itemName,
      liabilityOpeningAmount: liability?.openingAmount
    };
  });

  return rows;
}

function buildProfitRows(report: FinanceFinancialStatementReport): StatementDisplayRow[] {
  const linesByItem = new Map(report.profitLines.map((line) => [`${line.section}:${line.itemName}`, line]));
  const getSignedAmount = (template: ProfitStatementTemplateItem, mode: 'current' | 'yearToDate') => {
    const sourceItems = template.sourceItems ?? [template.itemName];

    return roundStatementAmount(sourceItems.reduce((total, itemName) => {
      const incomeLine = linesByItem.get(`收入:${itemName}`);
      const expenseLine = linesByItem.get(`成本费用:${itemName}`);
      const incomeAmount = mode === 'yearToDate' ? incomeLine?.yearToDateAmount ?? incomeLine?.amount ?? 0 : incomeLine?.amount ?? 0;
      const expenseAmount = mode === 'yearToDate' ? expenseLine?.yearToDateAmount ?? expenseLine?.amount ?? 0 : expenseLine?.amount ?? 0;

      return total + incomeAmount - expenseAmount;
    }, 0));
  };
  const getDisplayAmount = (template: ProfitStatementTemplateItem, mode: 'current' | 'yearToDate') => {
    const signedAmount = getSignedAmount(template, mode);

    return template.valueMode === 'expense' ? Math.abs(signedAmount) : signedAmount;
  };

  return profitStatementTemplate.map((template, index) => ({
    amount: getDisplayAmount(template, 'current'),
    amountTone: template.valueMode === 'expense' ? 'expense' : template.valueMode === 'profit' ? 'strong' : 'income',
    itemName: template.itemName,
    key: `profit-${index}`,
    lineType: template.lineType,
    section: template.lineType ? '小计' : template.sourceSection,
    yearToDateAmount: getDisplayAmount(template, 'yearToDate')
  }));
}

function buildCashFlowRows(report: FinanceFinancialStatementReport): StatementDisplayRow[] {
  const linesByItem = new Map(report.cashFlowLines.map((line) => [`${line.activity}:${line.itemName}`, line]));
  const getSignedAmount = (template: CashFlowStatementTemplateItem, mode: 'current' | 'yearToDate') => {
    if (template.itemName === '现金及现金等价物净增加额') {
      return mode === 'yearToDate' ? report.cashFlowYearToDateNetAmount : report.cashFlowNetAmount;
    }

    if (template.itemName === '加：期初现金及现金等价物余额') {
      return mode === 'yearToDate' ? report.cashFlowYearToDateOpeningBalance : report.cashFlowOpeningBalance;
    }

    if (template.itemName === '期末现金及现金等价物余额') {
      return mode === 'yearToDate' ? report.cashFlowYearToDateClosingBalance : report.cashFlowClosingBalance;
    }

    const sourceItems = template.sourceItems ?? [template.itemName];

    return roundStatementAmount(sourceItems.reduce((total, itemName) => {
      const sourceLine = template.activity ? linesByItem.get(`${template.activity}:${itemName}`) : undefined;
      const amount = mode === 'yearToDate' ? sourceLine?.yearToDateAmount ?? sourceLine?.amount ?? 0 : sourceLine?.amount ?? 0;

      return total + amount;
    }, 0));
  };
  const getDisplayAmount = (template: CashFlowStatementTemplateItem, mode: 'current' | 'yearToDate') => {
    const signedAmount = getSignedAmount(template, mode);

    return template.valueMode === 'cash-out' ? Math.abs(signedAmount) : signedAmount;
  };
  const getTone = (template: CashFlowStatementTemplateItem): CellTextTone => {
    if (template.valueMode === 'cash-out') {
      return 'expense';
    }

    if (template.valueMode === 'cash-in') {
      return 'income';
    }

    return 'strong';
  };

  return cashFlowStatementTemplate.map((template, index) => ({
    amount: getDisplayAmount(template, 'current'),
    amountTone: getTone(template),
    itemName: template.itemName,
    key: `cash-${index}`,
    lineType: template.lineType,
    section: template.activity ?? '合计',
    yearToDateAmount: getDisplayAmount(template, 'yearToDate')
  }));
}

function getIncomeTotal(report: FinanceFinancialStatementReport) {
  return report.profitLines
    .filter((line) => line.section === '收入')
    .reduce((total, line) => total + line.amount, 0);
}

function getExpenseTotal(report: FinanceFinancialStatementReport) {
  return report.profitLines
    .filter((line) => line.section !== '收入')
    .reduce((total, line) => total + line.amount, 0);
}

function buildFinancialStatementArchiveRows({
  accountingPeriodLocks,
  cycle,
  ledgerEntries
}: {
  accountingPeriodLocks: AccountingPeriodLockRecord[];
  cycle: FinancialStatementCycle;
  ledgerEntries: AccountingLedgerEntry[];
}): FinancialStatementArchiveRow[] {
  const availableMonths = getAvailableAccountingPeriods(ledgerEntries, accountingPeriodLocks);

  return getAvailableStatementPeriods(availableMonths, cycle).map((period) => {
    const generalLedgerResponse = buildGeneralLedgerResponse({
      entries: ledgerEntries,
      filters: {
        ...defaultGeneralLedgerFilters,
        accountingPeriodTime: getStatementPeriodScope(period)
      },
      periodLocks: accountingPeriodLocks
    });
    const yearToDateLedgerResponse = buildGeneralLedgerResponse({
      entries: ledgerEntries,
      filters: {
        ...defaultGeneralLedgerFilters,
        accountingPeriodTime: getYearToDateRange(getPeriodEndMonth(period))
      },
      periodLocks: accountingPeriodLocks
    });
    const report = buildFinanceFinancialStatementReport({
      periodSummary: generalLedgerResponse.periodSummary,
      subjectRows: generalLedgerResponse.rows,
      yearToDateSubjectRows: yearToDateLedgerResponse.rows
    });
    const reportStatus = getPeriodReportStatus({ accountingPeriodLocks, period, report });
    const generatedAt = period.type === 'month'
      ? report.mode === '正式报表'
        ? generalLedgerResponse.periodSummary.lockedAt
        : undefined
      : reportStatus === '正式报表'
        ? getAggregateGeneratedAt(period, accountingPeriodLocks)
        : undefined;
    const archiveStatus: FinancialStatementArchiveRow['archiveStatus'] = reportStatus !== '正式报表'
      ? '待结账预览'
      : period.type === 'month'
        ? report.archive.status
        : '已归档';
    const archiveSource = archiveStatus === '待结账预览'
      ? '实时总账预览'
      : archiveStatus === '快照缺失'
        ? '结账快照缺失'
        : period.type === 'month'
          ? report.archive.source
          : '已结账月份汇总';
    const archiveGeneratedAt = archiveStatus === '已归档'
      ? generatedAt ?? report.archive.archivedAt
      : report.archive.archivedAt;

    return {
      accountingPeriod: period.key,
      archiveGeneratedAt,
      archiveGeneratedBy: report.archive.archivedBy,
      archiveReason: report.archive.closeReason,
      archiveSource,
      archiveStatus,
      assetTotal: report.assetTotal,
      balanceSheetRows: buildBalanceSheetRows(report),
      bookedVoucherCount: generalLedgerResponse.periodSummary.bookedVoucherCount,
      cashFlowNetAmount: report.cashFlowNetAmount,
      cashFlowReadiness: report.cashFlowReadiness,
      cashFlowRows: buildCashFlowRows(report),
      expenseTotal: getExpenseTotal(report),
      financialStatementReadiness: report.financialStatementReadiness,
      incomeTotal: getIncomeTotal(report),
      liabilityEquityTotal: report.liabilityEquityTotal,
      periodLabel: period.label,
      periodMonths: period.months,
      periodRange: period.range,
      periodRangeLabel: period.rangeLabel,
      periodType: period.type,
      profitRows: buildProfitRows(report),
      profitTotal: report.profitTotal,
      report,
      reportStatus,
      trialBalanceStatus: report.trialBalanceStatus
    };
  });
}

function buildArchiveMetrics(rows: FinancialStatementArchiveRow[]): FinancialStatementArchiveMetrics {
  return {
    statementReadyCount: rows.filter((row) => row.financialStatementReadiness === '可出具').length,
    officialCount: rows.filter((row) => row.reportStatus === '正式报表').length,
    periodCount: rows.length,
    trialCount: rows.filter((row) => row.reportStatus === '待结账').length
  };
}

function createArchiveColumns(): TableColumnsType<FinancialStatementArchiveRow> {
  return [
    {
      title: '报表期间',
      dataIndex: 'accountingPeriod',
      width: 150,
      render: (_, record) => (
        <CompactCell
          primary={record.periodLabel}
          secondary={`${statementCycleLabelMap[record.periodType]} / ${record.periodRangeLabel}`}
        />
      )
    },
    {
      title: '报表状态',
      dataIndex: 'reportStatus',
      width: 128,
      render: (status: FinancialStatementArchiveRow['reportStatus']) => (
        <StatusTag toneMap={statementModeTone} value={status} />
      )
    },
    {
      title: '试算',
      dataIndex: 'trialBalanceStatus',
      width: 118,
      render: (status: FinancialStatementArchiveRow['trialBalanceStatus']) => (
        <StatusTag toneMap={trialBalanceTone} value={status} />
      )
    },
    {
      title: '资产合计',
      dataIndex: 'assetTotal',
      width: 150,
      render: (amount: number) => <CellText tone="income">{formatStatementAmount(amount)}</CellText>
    },
    {
      title: '负债和权益',
      dataIndex: 'liabilityEquityTotal',
      width: 150,
      render: (amount: number) => <CellText>{formatStatementAmount(amount)}</CellText>
    },
    {
      title: '营业收入',
      dataIndex: 'incomeTotal',
      width: 150,
      render: (amount: number) => <CellText tone="income">{formatStatementAmount(amount)}</CellText>
    },
    {
      title: '净利润',
      dataIndex: 'profitTotal',
      width: 150,
      render: (amount: number) => (
        <CellText tone={amount >= 0 ? 'income' : 'expense'}>{formatStatementAmount(amount)}</CellText>
      )
    },
    {
      title: '现金净增加额',
      dataIndex: 'cashFlowNetAmount',
      width: 168,
      render: (amount: number) => (
        <CellText tone={amount >= 0 ? 'income' : 'expense'}>{formatStatementAmount(amount)}</CellText>
      )
    },
    {
      title: '结账归档',
      dataIndex: 'archiveStatus',
      width: 168,
      render: (_, record) => (
        <CompactCell
          primary={<StatusTag toneMap={statementArchiveStatusTone} value={record.archiveStatus} />}
          secondary={record.archiveGeneratedAt ? `${record.archiveSource} / ${record.archiveGeneratedAt}` : record.archiveSource}
        />
      )
    }
  ];
}

function createBalanceSheetColumns(): TableColumnsType<BalanceSheetDisplayRow> {
  return [
    {
      title: '资产',
      dataIndex: 'assetItem',
      width: 220,
      render: (item?: string) => item ? <CellText>{item}</CellText> : null
    },
    {
      title: '期末余额',
      dataIndex: 'assetAmount',
      width: 150,
      render: (amount?: number) => (
        amount === undefined ? null : <CellText tone="income">{formatOptionalStatementAmount(amount)}</CellText>
      )
    },
    {
      title: '期初余额',
      dataIndex: 'assetOpeningAmount',
      width: 150,
      render: (amount?: number) => amount === undefined ? null : <CellText>{formatOptionalStatementAmount(amount)}</CellText>
    },
    {
      title: '负债和所有者权益',
      dataIndex: 'liabilityItem',
      width: 240,
      render: (item?: string) => item ? <CellText>{item}</CellText> : null
    },
    {
      title: '期末余额',
      dataIndex: 'liabilityAmount',
      width: 150,
      render: (amount?: number) => (
        amount === undefined ? null : <CellText tone="expense">{formatOptionalStatementAmount(amount)}</CellText>
      )
    },
    {
      title: '期初余额',
      dataIndex: 'liabilityOpeningAmount',
      width: 150,
      render: (amount?: number) => amount === undefined ? null : <CellText>{formatOptionalStatementAmount(amount)}</CellText>
    }
  ];
}

function renderStatementAmount(amount: number, record?: StatementDisplayRow) {
  return (
    <CellText tone={record?.amountTone ?? (amount >= 0 ? 'income' : 'expense')}>
      {formatOptionalStatementAmount(amount)}
    </CellText>
  );
}

function createStatementColumns(periodType: FinancialStatementCycle): TableColumnsType<StatementDisplayRow> {
  const baseColumns: TableColumnsType<StatementDisplayRow> = [
    {
      title: '项目',
      dataIndex: 'itemName',
      width: 260,
      render: (_, record) => <CompactCell primary={record.itemName} secondary={record.section} />
    }
  ];

  if (periodType === 'year') {
    return [
      ...baseColumns,
      {
        title: '本年金额',
        dataIndex: 'amount',
        width: 150,
        render: renderStatementAmount
      }
    ];
  }

  return [
    ...baseColumns,
    {
      title: '本期金额',
      dataIndex: 'amount',
      width: 150,
      render: renderStatementAmount
    },
    {
      title: '本年累计',
      dataIndex: 'yearToDateAmount',
      width: 150,
      render: (amount: number, record) => renderStatementAmount(amount, record)
    }
  ];
}

function FinancialStatementReadinessNotice({ report }: { report: FinanceFinancialStatementReport }) {
  if (report.financialStatementReadiness === '可出具') {
    return null;
  }

  return (
    <div className="financial-statements-cash-flow-readiness" data-testid="finance-cash-flow-readiness-notice">
      <CompactCell
        primary="报表暂不可出具"
        secondary={report.financialStatementReadinessDetail}
      />
    </div>
  );
}

function buildFinancialStatementOverviewItems(record: FinancialStatementArchiveRow): DetailInfoGridItem[] {
  const items: DetailInfoGridItem[] = [
    { label: '覆盖时间', value: record.periodRangeLabel },
    { label: '报表状态', value: <StatusTag toneMap={statementModeTone} value={record.reportStatus} /> },
    { label: '结账归档', value: <StatusTag toneMap={statementArchiveStatusTone} value={record.archiveStatus} /> },
    { label: '归档依据', value: record.archiveSource },
    { label: '报表校验', value: <StatusTag toneMap={financialStatementReadinessTone} value={record.financialStatementReadiness} /> },
    { label: '会计准则', value: accountingSubjectProfile.accountingStandard },
    { label: '记账本位币', value: accountingSubjectProfile.currency }
  ];

  if (record.archiveGeneratedAt) {
    items.push({ label: '归档时间', value: record.archiveGeneratedAt });
  }

  if (record.archiveGeneratedBy) {
    items.push({ label: '结账人', value: record.archiveGeneratedBy });
  }

  if (record.archiveReason) {
    items.push({ label: '结账说明', value: record.archiveReason, wide: true });
  }

  items.push(
    { label: '营业收入', value: formatMoney(record.incomeTotal) },
    { label: '成本费用合计', value: formatMoney(record.expenseTotal) },
    { label: '净利润', value: formatMoney(record.profitTotal) },
    { label: '现金净增加额', value: formatMoney(record.cashFlowNetAmount) }
  );

  return items;
}

function FinancialStatementOverview({ record }: { record: FinancialStatementArchiveRow }) {
  return (
    <>
      <DetailSummaryCards
        columns={4}
        items={[
          {
            icon: <AuditOutlined />,
            key: 'trial-balance',
            label: '试算状态',
            value: <StatusTag toneMap={trialBalanceTone} value={record.trialBalanceStatus} />
          },
          { icon: <BookOutlined />, key: 'asset-total', label: '资产合计', value: formatMoney(record.assetTotal) },
          {
            icon: <FileProtectOutlined />,
            key: 'liability-equity-total',
            label: '负债和权益',
            value: formatMoney(record.liabilityEquityTotal)
          },
          {
            icon: <FileTextOutlined />,
            key: 'cash-flow-readiness',
            label: '现金流量表',
            value: <StatusTag toneMap={cashFlowReadinessTone} value={record.cashFlowReadiness} />
          }
        ]}
      />

      <DetailSection icon={<CalendarOutlined />} title="期间概览">
        <DetailInfoGrid
          columns={3}
          items={buildFinancialStatementOverviewItems(record)}
        />
      </DetailSection>
      <FinancialStatementReadinessNotice report={record.report} />
    </>
  );
}

function FinancialStatementNotes({ report }: { report: FinanceFinancialStatementReport }) {
  return (
    <>
      {report.notes.map((note) => (
        <DetailSection icon={<FileTextOutlined />} key={note.key} title={note.title}>
          <DetailInfoGrid
            columns={note.items.length > 2 ? 3 : 2}
            items={note.items.map((item) => ({ label: item.label, value: item.value }))}
          />
        </DetailSection>
      ))}
    </>
  );
}

function FinancialStatementDetailDrawer({
  balanceSheetColumns,
  record,
  statementColumns,
  onClose
}: {
  balanceSheetColumns: TableColumnsType<BalanceSheetDisplayRow>;
  record?: FinancialStatementArchiveRow;
  statementColumns: TableColumnsType<StatementDisplayRow>;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }

  return (
    <DetailDrawerShell
      bodyTestId="finance-financial-statements-detail-drawer"
      className="finance-transaction-drawer"
      open={Boolean(record)}
      title={
        <DetailDrawerTitle
          status={record.reportStatus}
          statusToneMap={statementModeTone}
          subtitle={record.periodLabel}
          title={`${statementCycleLabelMap[record.periodType]}财务报表`}
        />
      }
      width={1080}
      onClose={onClose}
    >
      <DetailTabs
        items={[
          {
            children: <FinancialStatementOverview record={record} />,
            key: 'overview',
            label: '概览'
          },
          {
            children: <FinancialStatementNotes report={record.report} />,
            key: 'notes',
            label: '报表附注'
          },
          {
            children: (
              <DetailSection icon={<BookOutlined />} title="资产负债表">
                <CompactDetailTable<BalanceSheetDisplayRow>
                  columns={balanceSheetColumns}
                  dataSource={record.balanceSheetRows}
                  rowKey="key"
                  scrollX={960}
                />
              </DetailSection>
            ),
            key: 'balance',
            label: '资产负债表'
          },
          {
            children: (
              <DetailSection icon={<LineChartOutlined />} title="利润表">
                <CompactDetailTable<StatementDisplayRow>
                  columns={statementColumns}
                  dataSource={record.profitRows}
                  rowKey="key"
                  scrollX={640}
                />
              </DetailSection>
            ),
            key: 'profit',
            label: '利润表'
          },
          {
            children: (
              <>
                <DetailSection icon={<FileTextOutlined />} title="现金流量表">
                  <CompactDetailTable<StatementDisplayRow>
                    columns={statementColumns}
                    dataSource={record.cashFlowRows}
                    rowKey="key"
                    scrollX={640}
                  />
                </DetailSection>
              </>
            ),
            key: 'cash-flow',
            label: '现金流量表'
          }
        ]}
        tabTestIdPrefix="finance-financial-statements-detail-tab"
      />
    </DetailDrawerShell>
  );
}

export function FinanceFinancialStatementsPage() {
  const {
    accountingPeriodLocks,
    accountingVoucherLaterPeriodAdjustmentRows,
    accountingVoucherLifecycleRows,
    bankReconciliationRows,
    financeRows,
    invoiceBusinessAllocationRows,
    invoiceRows,
    ledgerOpeningAdjustmentRows,
    monthEndMatterRows,
    receivablePayableRows,
    taxMatterRows
  } = useFinanceManagement();
  const [statementCycle, setStatementCycle] = useState<FinancialStatementCycle>('month');
  const [accountingPeriodTime, setAccountingPeriodTime] = useState<DateScopeFilterValue>({
    mode: 'all'
  });
  const [activeAccountingPeriod, setActiveAccountingPeriod] = useState<string>();
  const generatedVoucherRows = useMemo(
    () => buildAccountingVouchers(
      receivablePayableRows,
      financeRows,
      invoiceRows,
      taxMatterRows,
      bankReconciliationRows,
      ledgerOpeningAdjustmentRows,
      accountingVoucherLaterPeriodAdjustmentRows,
      {
        accountingPeriodStart: accountingSubjectProfile.effectivePeriod,
        invoiceBusinessAllocationRows,
        monthEndMatterRows
      }
    ),
    [
      accountingVoucherLaterPeriodAdjustmentRows,
      bankReconciliationRows,
      financeRows,
      invoiceBusinessAllocationRows,
      invoiceRows,
      ledgerOpeningAdjustmentRows,
      monthEndMatterRows,
      receivablePayableRows,
      taxMatterRows
    ]
  );
  const voucherRows = useMemo(
    () => applyAccountingVoucherLifecycle(generatedVoucherRows, accountingVoucherLifecycleRows),
    [accountingVoucherLifecycleRows, generatedVoucherRows]
  );
  const ledgerEntries = useMemo(() => buildAccountingLedgerEntries(voucherRows), [voucherRows]);
  const archiveRows = useMemo(
    () => buildFinancialStatementArchiveRows({ accountingPeriodLocks, cycle: statementCycle, ledgerEntries }),
    [accountingPeriodLocks, ledgerEntries, statementCycle]
  );
  const displayRows = useMemo(
    () => archiveRows.filter((record) => isStatementPeriodInDateScope(record, accountingPeriodTime)),
    [accountingPeriodTime, archiveRows]
  );
  const archiveMetrics = useMemo(() => buildArchiveMetrics(displayRows), [displayRows]);
  const activeRecord = useMemo(
    () => archiveRows.find((record) => record.accountingPeriod === activeAccountingPeriod),
    [activeAccountingPeriod, archiveRows]
  );
  const archiveColumns = useMemo(() => createArchiveColumns(), []);
  const balanceSheetColumns = useMemo(() => createBalanceSheetColumns(), []);
  const statementColumns = useMemo(
    () => createStatementColumns(activeRecord?.periodType ?? statementCycle),
    [activeRecord?.periodType, statementCycle]
  );

  function handleStatementCycleChange(nextCycle: FinancialStatementCycle) {
    setStatementCycle(nextCycle);
    setAccountingPeriodTime({ mode: 'all' });
    setActiveAccountingPeriod(undefined);
  }

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={4} density="compact">
          <MetricCard icon={<CalendarOutlined />} label="期间数" value={archiveMetrics.periodCount} />
          <MetricCard icon={<FileProtectOutlined />} label="已归档报表" value={archiveMetrics.officialCount} />
          <MetricCard icon={<AuditOutlined />} label="待结账" value={archiveMetrics.trialCount} />
          <MetricCard icon={<FileTextOutlined />} label="报表校验通过" value={archiveMetrics.statementReadyCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField as="div" controlWidth="wide-select" label="报表周期">
              <Segmented<FinancialStatementCycle>
                data-testid="finance-financial-statements-cycle"
                options={statementCycleOptions}
                value={statementCycle}
                onChange={handleStatementCycleChange}
              />
            </FilterField>
            <DateScopeFilter
              defaultMonth={generalLedgerDefaultMonth}
              label="会计期间"
              modeOptions={statementPeriodModeOptionsByCycle[statementCycle] ?? statementPeriodModeFallbackOptions}
              testIdPrefix="finance-financial-statements-period"
              value={accountingPeriodTime}
              yearLabel="年份"
              onChange={setAccountingPeriodTime}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-financial-statements"
    >
      <ManagementTable<FinancialStatementArchiveRow>
        columns={archiveColumns}
        count={{ value: displayRows.length, unit: '期' }}
        dataSource={displayRows}
        rowKey="accountingPeriod"
        rowTestIdPrefix="finance-financial-statements-row"
        tableTestId="finance-financial-statements-table"
        title="财务报表"
        onRowClick={(record) => setActiveAccountingPeriod(record.accountingPeriod)}
      />
      <FinancialStatementDetailDrawer
        balanceSheetColumns={balanceSheetColumns}
        record={activeRecord}
        statementColumns={statementColumns}
        onClose={() => setActiveAccountingPeriod(undefined)}
      />
    </ManagementPageScaffold>
  );
}
