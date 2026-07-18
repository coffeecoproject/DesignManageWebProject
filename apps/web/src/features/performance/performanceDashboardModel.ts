import type { PerformanceMonthlyCategoryRecord, PerformanceRuleCategory, PerformanceRulePreset } from './performanceTypes';

export type PerformanceDashboardPeriodMode = 'month' | 'quarter' | 'year' | 'custom';

export type PerformanceDashboardPeriodRange = {
  endDate: string;
  label: string;
  mode: PerformanceDashboardPeriodMode;
  startDate: string;
  trendGranularity: 'month';
};

export type PerformanceDashboardRiskLevel = 'high' | 'medium' | 'low';

export type PerformanceDashboardMetrics = {
  averageQualityScore: number | null;
  currentExceptionCount: number;
  employeeCount: number;
  periodAmount: number;
  periodPrepayAmount: number;
  publishedRules: number;
  recordCount: number;
  sourceTaskCount: number;
};

export type PerformanceDashboardTrendPoint = {
  amount: number;
  date: string;
  employeeCount: number;
  label: string;
  prepayAmount: number;
  recordCount: number;
};

export type PerformanceDashboardDistributionItem = {
  amount: number;
  count: number;
  key: string;
  label: string;
  percent: number;
};

export type PerformanceDashboardRiskRow = {
  amountImpact: number;
  basis: string;
  id: string;
  objectMeta: string;
  objectName: string;
  ownerName: string;
  riskLevel: PerformanceDashboardRiskLevel;
  riskText: string;
};

export type PerformanceDashboardEmployeeRow = {
  averageQualityScore: number | null;
  categories: PerformanceRuleCategory[];
  employeeName: string;
  id: string;
  latestMonth: string;
  monthlyAmount: number;
  position: string;
  prepayAmount: number;
  recordCount: number;
  sourceTaskCount: number;
  workNo: string;
};

export type PerformanceDashboardData = {
  categoryDistribution: PerformanceDashboardDistributionItem[];
  employeeRows: PerformanceDashboardEmployeeRow[];
  metrics: PerformanceDashboardMetrics;
  period: PerformanceDashboardPeriodRange;
  positionDistribution: PerformanceDashboardDistributionItem[];
  riskRows: PerformanceDashboardRiskRow[];
  ruleVersionDistribution: PerformanceDashboardDistributionItem[];
  trend: PerformanceDashboardTrendPoint[];
};

type PerformanceDashboardSource = {
  monthlyRecords: PerformanceMonthlyCategoryRecord[];
  now?: string;
  periodRange?: PerformanceDashboardPeriodRange;
  ruleRows: PerformanceRulePreset[];
  today?: string;
};

const defaultPerformanceDashboardToday = '2026-06-15';

function parseDateOnly(date: string) {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getLastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0);
}

function getMonthEndDate(monthKey: string) {
  const [year = 0, month = 1] = monthKey.split('-').map(Number);

  return formatDateOnly(getLastDayOfMonth(year, month - 1));
}

function normalizeRangeOrder(startDate: string, endDate: string) {
  return startDate <= endDate ? { endDate, startDate } : { endDate: startDate, startDate: endDate };
}

export function buildPerformanceDashboardPeriodRange(
  mode: PerformanceDashboardPeriodMode,
  today = defaultPerformanceDashboardToday,
  customRange?: { endDate: string; startDate: string }
): PerformanceDashboardPeriodRange {
  if (mode === 'custom' && customRange?.startDate && customRange.endDate) {
    const normalizedRange = normalizeRangeOrder(customRange.startDate, customRange.endDate);

    return {
      ...normalizedRange,
      label: `${normalizedRange.startDate} 至 ${normalizedRange.endDate}`,
      mode,
      trendGranularity: 'month'
    };
  }

  const currentDate = parseDateOnly(today);
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();
  let startDate: string;
  let endDate: string;

  if (mode === 'quarter') {
    const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
    startDate = formatDateOnly(new Date(year, quarterStartMonth, 1));
    endDate = formatDateOnly(getLastDayOfMonth(year, quarterStartMonth + 2));
  } else if (mode === 'year') {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    startDate = formatDateOnly(new Date(year, monthIndex, 1));
    endDate = formatDateOnly(getLastDayOfMonth(year, monthIndex));
  }

  return {
    endDate,
    label: `${startDate} 至 ${endDate}`,
    mode,
    startDate,
    trendGranularity: 'month'
  };
}

function isMonthInRange(monthKey: string, periodRange: PerformanceDashboardPeriodRange) {
  const monthStartDate = `${monthKey}-01`;
  const monthEndDate = getMonthEndDate(monthKey);

  return monthStartDate <= periodRange.endDate && monthEndDate >= periodRange.startDate;
}

function getTrendMonths(periodRange: PerformanceDashboardPeriodRange) {
  const startDate = parseDateOnly(periodRange.startDate);
  const endDate = parseDateOnly(periodRange.endDate);
  const endMonthKey = getMonthKey(endDate);
  const points: Array<{ date: string; label: string }> = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (getMonthKey(cursor) <= endMonthKey) {
    const month = String(cursor.getMonth() + 1).padStart(2, '0');

    points.push({
      date: getMonthKey(cursor),
      label: `${month}月`
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumMoney(records: PerformanceMonthlyCategoryRecord[], key: 'monthlyAmount' | 'prepayAmount') {
  return records.reduce((sum, record) => sum + record[key], 0);
}

function getUniqueCount(values: string[]) {
  return new Set(values).size;
}

function buildDistribution(records: PerformanceMonthlyCategoryRecord[], getLabel: (record: PerformanceMonthlyCategoryRecord) => string) {
  const rowsByLabel = new Map<string, PerformanceDashboardDistributionItem>();
  const totalAmount = sumMoney(records, 'monthlyAmount');

  for (const record of records) {
    const label = getLabel(record);
    const currentRow =
      rowsByLabel.get(label) ??
      ({
        amount: 0,
        count: 0,
        key: label,
        label,
        percent: 0
      } satisfies PerformanceDashboardDistributionItem);

    rowsByLabel.set(label, {
      ...currentRow,
      amount: currentRow.amount + record.monthlyAmount,
      count: currentRow.count + 1
    });
  }

  return [...rowsByLabel.values()]
    .map((row) => ({
      ...row,
      percent: totalAmount > 0 ? Math.round((row.amount / totalAmount) * 100) : 0
    }))
    .sort((left, right) => right.amount - left.amount || right.count - left.count || left.label.localeCompare(right.label));
}

function buildTrend(periodRange: PerformanceDashboardPeriodRange, records: PerformanceMonthlyCategoryRecord[]) {
  return getTrendMonths(periodRange).map<PerformanceDashboardTrendPoint>((point) => {
    const monthRecords = records.filter((record) => record.performanceMonth === point.date);

    return {
      ...point,
      amount: sumMoney(monthRecords, 'monthlyAmount'),
      employeeCount: getUniqueCount(monthRecords.map((record) => record.workNo)),
      prepayAmount: sumMoney(monthRecords, 'prepayAmount'),
      recordCount: monthRecords.length
    };
  });
}

function buildEmployeeRows(records: PerformanceMonthlyCategoryRecord[]) {
  const rowsByEmployee = new Map<string, PerformanceDashboardEmployeeRow & { qualityScores: number[] }>();

  for (const record of records) {
    const currentRow =
      rowsByEmployee.get(record.workNo) ??
      ({
        averageQualityScore: null,
        categories: [],
        employeeName: record.employeeName,
        id: record.workNo,
        latestMonth: record.performanceMonth,
        monthlyAmount: 0,
        position: record.position,
        prepayAmount: 0,
        qualityScores: [],
        recordCount: 0,
        sourceTaskCount: 0,
        workNo: record.workNo
      } satisfies PerformanceDashboardEmployeeRow & { qualityScores: number[] });

    rowsByEmployee.set(record.workNo, {
      ...currentRow,
      categories: Array.from(new Set([...currentRow.categories, record.category])),
      latestMonth: record.performanceMonth > currentRow.latestMonth ? record.performanceMonth : currentRow.latestMonth,
      monthlyAmount: currentRow.monthlyAmount + record.monthlyAmount,
      prepayAmount: currentRow.prepayAmount + record.prepayAmount,
      qualityScores:
        typeof record.qualityScore === 'number' ? [...currentRow.qualityScores, record.qualityScore] : currentRow.qualityScores,
      recordCount: currentRow.recordCount + 1,
      sourceTaskCount: currentRow.sourceTaskCount + record.sourceTaskCount
    });
  }

  return [...rowsByEmployee.values()]
    .map(({ qualityScores, ...row }) => ({
      ...row,
      averageQualityScore: getAverage(qualityScores)
    }))
    .sort(
      (left, right) =>
        right.monthlyAmount - left.monthlyAmount ||
        right.sourceTaskCount - left.sourceTaskCount ||
        left.employeeName.localeCompare(right.employeeName)
    );
}

function buildRiskRows(periodRecords: PerformanceMonthlyCategoryRecord[]) {
  const settledRecords = periodRecords.filter((record) => record.resultResponseStatus !== '有异议');
  const objectionRiskRows = periodRecords
    .filter((record) => record.resultResponseStatus === '有异议')
    .map<PerformanceDashboardRiskRow>((record) => ({
      amountImpact: record.monthlyAmount,
      basis: `${record.performanceMonth} / ${record.ruleVersion}`,
      id: `objection-${record.id}`,
      objectMeta: `${record.position} / ${record.category}`,
      objectName: record.employeeName,
      ownerName: record.employeeName,
      riskLevel: 'high',
      riskText: '绩效结果存在未处理异议'
    }));
  const scoreRiskRows = settledRecords
    .filter((record) => (record.taskScore ?? 100) < 80 || (record.qualityScore ?? 100) < 80)
    .map<PerformanceDashboardRiskRow>((record) => {
      const riskItems: string[] = [];

      if ((record.taskScore ?? 100) < 80) {
        riskItems.push('任务达成低于80');
      }

      if ((record.qualityScore ?? 100) < 80) {
        riskItems.push('质量分低于80');
      }

      return {
        amountImpact: record.monthlyAmount,
        basis: `${record.performanceMonth} / ${record.ruleVersion}`,
        id: `score-${record.id}`,
        objectMeta: `${record.position} / ${record.category}`,
        objectName: record.employeeName,
        ownerName: record.employeeName,
        riskLevel: (record.taskScore ?? 100) < 80 ? 'high' : 'medium',
        riskText: riskItems.join(' / ')
      };
    });
  const applicabilityRiskRows = settledRecords
    .filter((record) => record.ruleApplicability && record.ruleApplicability.status !== '适用')
    .map<PerformanceDashboardRiskRow>((record) => ({
      amountImpact: record.monthlyAmount,
      basis: `${record.performanceMonth} / ${record.ruleVersion}`,
      id: `applicability-${record.id}`,
      objectMeta: `${record.position} / ${record.category}`,
      objectName: record.employeeName,
      ownerName: record.employeeName,
      riskLevel: record.ruleApplicability?.status === '规则冲突' || record.ruleApplicability?.status === '规则版本不一致' ? 'high' : 'medium',
      riskText: record.ruleApplicability?.status ?? '规则适用异常'
    }));
  return [...objectionRiskRows, ...scoreRiskRows, ...applicabilityRiskRows].sort((left, right) => {
    const levelScore: Record<PerformanceDashboardRiskLevel, number> = { high: 3, low: 1, medium: 2 };

    return (
      levelScore[right.riskLevel] - levelScore[left.riskLevel] ||
      right.amountImpact - left.amountImpact ||
      left.objectName.localeCompare(right.objectName)
    );
  });
}

export function buildPerformanceDashboardData({
  monthlyRecords,
  periodRange,
  ruleRows,
  today = defaultPerformanceDashboardToday
}: PerformanceDashboardSource): PerformanceDashboardData {
  const activePeriodRange = periodRange ?? buildPerformanceDashboardPeriodRange('month', today);
  const periodRecords = monthlyRecords.filter((record) => isMonthInRange(record.performanceMonth, activePeriodRange));
  const settledPeriodRecords = periodRecords.filter((record) => record.resultResponseStatus !== '有异议');
  const qualityScores = settledPeriodRecords
    .map((record) => record.qualityScore)
    .filter((value): value is number => typeof value === 'number');
  const publishedRules = ruleRows.filter((rule) => rule.status === '已发布').length;
  const riskRows = buildRiskRows(periodRecords);

  return {
    categoryDistribution: buildDistribution(settledPeriodRecords, (record) => record.category),
    employeeRows: buildEmployeeRows(settledPeriodRecords),
    metrics: {
      averageQualityScore: getAverage(qualityScores),
      currentExceptionCount: riskRows.length,
      employeeCount: getUniqueCount(settledPeriodRecords.map((record) => record.workNo)),
      periodAmount: sumMoney(settledPeriodRecords, 'monthlyAmount'),
      periodPrepayAmount: sumMoney(settledPeriodRecords, 'prepayAmount'),
      publishedRules,
      recordCount: settledPeriodRecords.length,
      sourceTaskCount: settledPeriodRecords.reduce((sum, record) => sum + record.sourceTaskCount, 0)
    },
    period: activePeriodRange,
    positionDistribution: buildDistribution(settledPeriodRecords, (record) => record.position),
    riskRows,
    ruleVersionDistribution: buildDistribution(settledPeriodRecords, (record) => record.ruleName),
    trend: buildTrend(activePeriodRange, settledPeriodRecords)
  };
}
