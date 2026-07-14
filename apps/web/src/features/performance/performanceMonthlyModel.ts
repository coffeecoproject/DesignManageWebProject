import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import { isWorkCalendarDateWorkday } from '../system/workCalendarRules';
import { getMemberWorkCalendar } from '../people/peopleDomain';
import type { PeopleMember } from '../people/peopleTypes';
import type { PerformanceEmployeeSignatureArchive, PerformanceSignatureRuleOption } from './performanceSignatureArchiveData';
import { attachPerformanceExecutionContracts } from './performanceExecutionContract';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord,
  PerformanceMonthlyEmploymentScope,
  PerformanceMonthlyProrationSummary,
  PerformanceRulePreset
} from './performanceTypes';

type BuildPerformanceMonthlyRecordsInput = {
  annualExceptionRows: AnnualExceptionConfigRow[];
  categoryRecords: PerformanceMonthlyCategoryRecord[];
  drawingTaskRecords: PerformanceDrawingTaskMonthlyRecord[];
  peopleRows: PeopleMember[];
  ruleOptions: PerformanceSignatureRuleOption[];
  ruleRows: PerformanceRulePreset[];
  signatureEmployees: PerformanceEmployeeSignatureArchive[];
  workCalendarRows: WorkCalendarRow[];
};

type PerformanceMonthRange = {
  endDate: Date;
  endDateText: string;
  startDate: Date;
  startDateText: string;
};

const dayMilliseconds = 24 * 60 * 60 * 1000;
const fullScopeRatio = 1;

function parseDate(dateText: string) {
  return new Date(`${dateText}T00:00:00`);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getPerformanceMonthRange(month: string): PerformanceMonthRange {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);

  return {
    endDate,
    endDateText: formatDateKey(endDate),
    startDate,
    startDateText: formatDateKey(startDate)
  };
}

function roundPerformanceValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

export function buildPerformanceSalarySettlementReference(
  performanceResultId: string,
  resultKind: 'monthly-prepay' | 'quarterly-review',
  revision = 'v1'
) {
  return `performance-result:${performanceResultId}:${resultKind}:${revision}`;
}

function getMemberActiveEndDate(member: PeopleMember) {
  if (member.status === '离职') {
    return member.contractEndAt ?? member.archiveUpdatedAt;
  }

  if (member.personnelType === '兼职' && member.status === '结束合作') {
    return member.cooperationEndAt ?? member.contractEndAt ?? member.archiveUpdatedAt;
  }

  return undefined;
}

function getWorkdayDatesInRange(
  member: PeopleMember,
  range: { endDate: Date; startDate: Date },
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  const calendar = getMemberWorkCalendar(member, workCalendarRows);
  const workdayDates: string[] = [];

  for (let cursorTime = range.startDate.getTime(); cursorTime <= range.endDate.getTime(); cursorTime += dayMilliseconds) {
    const cursor = new Date(cursorTime);

    if (isWorkCalendarDateWorkday(calendar, cursor, annualExceptionRows)) {
      workdayDates.push(formatDateKey(cursor));
    }
  }

  return workdayDates;
}

export function getPerformanceMonthlyEmploymentScope({
  annualExceptionRows,
  member,
  month,
  workCalendarRows
}: {
  annualExceptionRows: AnnualExceptionConfigRow[];
  member: PeopleMember;
  month: string;
  workCalendarRows: WorkCalendarRow[];
}): PerformanceMonthlyEmploymentScope | undefined {
  if (member.personnelType !== '全职') {
    return undefined;
  }

  const monthRange = getPerformanceMonthRange(month);
  const memberStartDate = parseDate(member.joinedAt);
  const memberEndText = getMemberActiveEndDate(member);
  const memberEndDate = memberEndText ? parseDate(memberEndText) : monthRange.endDate;
  const effectiveStartTime = Math.max(monthRange.startDate.getTime(), memberStartDate.getTime());
  const effectiveEndTime = Math.min(monthRange.endDate.getTime(), memberEndDate.getTime());

  if (effectiveEndTime < effectiveStartTime) {
    return undefined;
  }

  const monthWorkdayDates = getWorkdayDatesInRange(member, monthRange, workCalendarRows, annualExceptionRows);
  const effectiveRange = {
    endDate: new Date(effectiveEndTime),
    startDate: new Date(effectiveStartTime)
  };
  const effectiveWorkdayDates = getWorkdayDatesInRange(member, effectiveRange, workCalendarRows, annualExceptionRows);

  if (monthWorkdayDates.length === 0 || effectiveWorkdayDates.length === 0) {
    return undefined;
  }

  return {
    effectiveEndDate: formatDateKey(effectiveRange.endDate),
    effectiveStartDate: formatDateKey(effectiveRange.startDate),
    effectiveWorkdays: effectiveWorkdayDates.length,
    monthWorkdays: monthWorkdayDates.length,
    ratio: roundPerformanceValue(effectiveWorkdayDates.length / monthWorkdayDates.length)
  };
}

function findMonthlyMember(record: Pick<PerformanceMonthlyCategoryRecord, 'workNo'>, peopleRows: PeopleMember[]) {
  return peopleRows.find((member) => member.id === record.workNo);
}

function findMonthlyRule(record: Pick<PerformanceMonthlyCategoryRecord, 'category' | 'ruleName' | 'ruleVersion'>, ruleRows: PerformanceRulePreset[]) {
  return ruleRows.find(
    (rule) =>
      rule.name === record.ruleName ||
      (rule.category === record.category && rule.currentVersion === record.ruleVersion)
  );
}

function buildProrationSummary(rule: PerformanceRulePreset, scope: PerformanceMonthlyEmploymentScope): PerformanceMonthlyProrationSummary {
  const baseLineScore = rule.baseLineScore ?? 0;
  const basePerformanceAmount = rule.basePerformanceAmount ?? 0;

  return {
    applied: scope.ratio < fullScopeRatio,
    baseLineScore: roundPerformanceValue(baseLineScore * scope.ratio),
    basePerformanceAmount: roundPerformanceValue(basePerformanceAmount * scope.ratio),
    fullScore: roundPerformanceValue(rule.fullScore * scope.ratio),
    originalBaseLineScore: baseLineScore,
    originalBasePerformanceAmount: basePerformanceAmount,
    originalFullScore: rule.fullScore
  };
}

function getTaskConfirmRatio(taskScore: number, baseLineScore: number) {
  return taskScore >= baseLineScore ? 1 : 0.5;
}

function getExcessMultiplier(rule: PerformanceRulePreset, taskScore: number, scope: PerformanceMonthlyEmploymentScope) {
  const matchedBand = rule.excessBands.find((band) => {
    const minScore = roundPerformanceValue(band.minScoreExclusive * scope.ratio);
    const maxScore = typeof band.maxScore === 'number' ? roundPerformanceValue(band.maxScore * scope.ratio) : undefined;

    return taskScore > minScore && (typeof maxScore !== 'number' || taskScore <= maxScore);
  });

  return matchedBand?.multiplier ?? 0;
}

function buildProrationNote(scope: PerformanceMonthlyEmploymentScope, proration: PerformanceMonthlyProrationSummary) {
  return `计绩区间 ${scope.effectiveStartDate} 至 ${scope.effectiveEndDate}，${scope.effectiveWorkdays}/${scope.monthWorkdays} 个工作日；满分口径 ${proration.fullScore} 分，达标线 ${proration.baseLineScore} 分。`;
}

function adjustDrawingTaskRecord(
  record: PerformanceDrawingTaskMonthlyRecord,
  scope: PerformanceMonthlyEmploymentScope,
  rule: PerformanceRulePreset
): PerformanceDrawingTaskMonthlyRecord {
  const proration = buildProrationSummary(rule, scope);
  const basePerformanceAmount = rule.basePerformanceAmount ?? 0;
  const pointValue = rule.fullScore > 0 ? basePerformanceAmount / rule.fullScore : record.amountSummary.pointValue;
  const confirmedBaseScore = Math.min(record.taskScore, proration.fullScore);
  const excessScore = Math.max(0, roundPerformanceValue(record.taskScore - proration.fullScore));
  const taskConfirmRatio = getTaskConfirmRatio(record.taskScore, proration.baseLineScore);
  const excessMultiplier = getExcessMultiplier(rule, record.taskScore, scope);
  const baseAmount = roundPerformanceValue(
    confirmedBaseScore * pointValue * record.baseQualityRatio * taskConfirmRatio
  );
  const excessAmount = roundPerformanceValue(
    excessScore * pointValue * excessMultiplier * record.excessQualityRatio
  );
  const monthlyAmount = roundPerformanceValue(baseAmount + excessAmount);
  const prepayAmount = roundPerformanceValue(monthlyAmount * record.amountSummary.prepayRatio);
  const settlementNote = proration.applied
    ? buildProrationNote(scope, proration)
    : record.amountSummary.settlementNote;

  return {
    ...record,
    amountSummary: {
      ...record.amountSummary,
      baseAmount,
      confirmedBaseScore: roundPerformanceValue(confirmedBaseScore),
      excessAmount,
      excessMultiplier,
      excessScore,
      monthlyAmount,
      pointValue,
      prepayAmount,
      settlementNote,
      taskConfirmRatio
    },
    employmentScope: scope,
    monthlyAmount,
    prepayAmount,
    prorationSummary: proration
  };
}

function toMonthlyCategoryRecord(record: PerformanceDrawingTaskMonthlyRecord): PerformanceMonthlyCategoryRecord {
  return {
    id: record.id,
    employeeName: record.employeeName,
    workNo: record.workNo,
    position: record.position,
    department: record.department,
    category: record.category,
    ruleName: record.ruleName,
    ruleVersion: record.ruleVersion,
    salarySettlementReference: record.salarySettlementReference,
    performanceMonth: record.performanceMonth,
    monthlyAmount: record.monthlyAmount,
    prepayAmount: record.prepayAmount,
    sourceTaskCount: record.sourceTaskCount,
    qualityScore: record.qualityScore,
    taskScore: record.taskScore,
    updatedAt: record.updatedAt,
    sourceLabel: '任务汇总',
    note: '来自绘图任务制绩效明细',
    executionContract: record.executionContract,
    employmentScope: record.employmentScope,
    prorationSummary: record.prorationSummary,
    quarterlyReviewResult: record.quarterlyReviewResult,
    events: record.events
  };
}

function adjustNonTaskCategoryRecord(
  record: PerformanceMonthlyCategoryRecord,
  scope: PerformanceMonthlyEmploymentScope,
  rule: PerformanceRulePreset | undefined
): PerformanceMonthlyCategoryRecord {
  if (record.category !== '岗位职责考核') {
    return {
      ...record,
      employmentScope: scope
    };
  }

  const monthlyAmount = roundPerformanceValue(record.monthlyAmount * scope.ratio);
  const prepayAmount = roundPerformanceValue(record.prepayAmount * scope.ratio);
  const proration = rule ? buildProrationSummary(rule, scope) : undefined;

  return {
    ...record,
    employmentScope: scope,
    monthlyAmount,
    note: scope.ratio < fullScopeRatio
      ? `${record.note}；${scope.effectiveWorkdays}/${scope.monthWorkdays} 个工作日折算。`
      : record.note,
    prepayAmount,
    prorationSummary: proration
  };
}

export function buildPerformanceMonthlyRecords({
  annualExceptionRows,
  categoryRecords,
  drawingTaskRecords,
  peopleRows,
  ruleOptions,
  ruleRows,
  signatureEmployees,
  workCalendarRows
}: BuildPerformanceMonthlyRecordsInput) {
  const contractedDrawingRecords = attachPerformanceExecutionContracts({
    records: drawingTaskRecords,
    ruleOptions,
    ruleRows,
    signatureEmployees
  });
  const contractedCategoryRecords = attachPerformanceExecutionContracts({
    records: categoryRecords,
    ruleOptions,
    ruleRows,
    signatureEmployees
  });
  const drawingRecordsById = new Map<string, PerformanceDrawingTaskMonthlyRecord>();

  for (const record of contractedDrawingRecords) {
    const member = findMonthlyMember(record, peopleRows);
    const rule = findMonthlyRule(record, ruleRows);
    const scope = member
      ? getPerformanceMonthlyEmploymentScope({
          annualExceptionRows,
          member,
          month: record.performanceMonth,
          workCalendarRows
        })
      : undefined;

    if (member && !scope) {
      continue;
    }

    drawingRecordsById.set(
      record.id,
      member && scope && rule ? adjustDrawingTaskRecord(record, scope, rule) : record
    );
  }

  const nextCategoryRecords = contractedCategoryRecords.flatMap<PerformanceMonthlyCategoryRecord>((record) => {
    const drawingRecord = drawingRecordsById.get(record.id);

    if (drawingRecord) {
      return [toMonthlyCategoryRecord(drawingRecord)];
    }

    const member = findMonthlyMember(record, peopleRows);
    const rule = findMonthlyRule(record, ruleRows);
    const scope = member
      ? getPerformanceMonthlyEmploymentScope({
          annualExceptionRows,
          member,
          month: record.performanceMonth,
          workCalendarRows
        })
      : undefined;

    if (member && !scope) {
      return [];
    }

    return member && scope ? [adjustNonTaskCategoryRecord(record, scope, rule)] : [record];
  });

  return {
    categoryRecords: nextCategoryRecords,
    drawingTaskRecords: [...drawingRecordsById.values()]
  };
}
