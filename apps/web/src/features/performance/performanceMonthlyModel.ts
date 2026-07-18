import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import { isWorkCalendarDateWorkday } from '../system/workCalendarRules';
import { getMemberWorkCalendar } from '../people/peopleDomain';
import type { PeopleMember } from '../people/peopleTypes';
import { attachPerformanceRuleApplicability } from './performanceRuleApplicabilityModel';
import {
  calculateDrawingTaskPerformanceAmount,
  roundPerformanceValue
} from './performanceRuleCalculationModel';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord,
  PerformanceMonthlyEmploymentScope,
  PerformanceMonthlyProrationSummary,
  PerformanceRulePreset
} from './performanceTypes';

type BuildPerformanceMonthlyRecordsInput = {
  annualExceptionRows: AnnualExceptionConfigRow[];
  drawingTaskRecords: PerformanceDrawingTaskMonthlyRecord[];
  peopleRows: PeopleMember[];
  ruleRows: PerformanceRulePreset[];
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

export function buildPerformanceSalarySettlementReference(
  performanceResultId: string,
  resultKind: 'monthly-prepay' | 'quarterly-difference',
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

function findMonthlyRule(
  record: Pick<
    PerformanceMonthlyCategoryRecord,
    'category' | 'ruleName' | 'ruleVersion' | 'ruleApplicability'
  >,
  ruleRows: PerformanceRulePreset[],
) {
  const applicabilityRuleId = record.ruleApplicability?.ruleId;

  if (applicabilityRuleId) {
    return ruleRows.find((rule) => rule.id === applicabilityRuleId);
  }

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

function buildProrationNote(scope: PerformanceMonthlyEmploymentScope, proration: PerformanceMonthlyProrationSummary) {
  return `计绩区间 ${scope.effectiveStartDate} 至 ${scope.effectiveEndDate}，${scope.effectiveWorkdays}/${scope.monthWorkdays} 个工作日；满分口径 ${proration.fullScore} 分，达标线 ${proration.baseLineScore} 分。`;
}

function adjustDrawingTaskRecord(
  record: PerformanceDrawingTaskMonthlyRecord,
  scope: PerformanceMonthlyEmploymentScope,
  rule: PerformanceRulePreset
): PerformanceDrawingTaskMonthlyRecord {
  const proration = buildProrationSummary(rule, scope);
  const amount = calculateDrawingTaskPerformanceAmount({
    basePerformanceAmount: rule.basePerformanceAmount ?? 0,
    baselineScore: rule.baseLineScore ?? 0,
    belowBaselineFactor: rule.belowBaselineFactor,
    excessBands: rule.excessBands,
    fullScore: rule.fullScore,
    monthlyPrepayRatio: rule.monthlyPrepayRatio,
    qualityBands: rule.qualityBands,
    qualityScore: record.qualityScore,
    taskScore: record.taskScore,
    thresholdRatio: scope.ratio
  });
  const settlementNote = proration.applied
    ? buildProrationNote(scope, proration)
    : record.amountSummary.settlementNote;

  return {
    ...record,
    amountSummary: {
      ...record.amountSummary,
      baseAmount: amount.baseAmount,
      baseQualityRatio: amount.baseQualityRatio,
      confirmedBaseScore: amount.confirmedBaseScore,
      excessAmount: amount.excessAmount,
      excessMultiplier: amount.excessMultiplier,
      excessQualityRatio: amount.excessQualityRatio,
      excessScore: amount.excessScore,
      monthlyAmount: amount.monthlyAmount,
      pointValue: amount.pointValue,
      prepayAmount: amount.prepayAmount,
      prepayRatio: amount.prepayRatio,
      settlementNote,
      taskConfirmRatio: amount.taskConfirmRatio
    },
    baseQualityRatio: amount.baseQualityRatio,
    employmentScope: scope,
    excessQualityRatio: amount.excessQualityRatio,
    monthlyAmount: amount.monthlyAmount,
    prepayAmount: amount.prepayAmount,
    prorationSummary: proration
  };
}

export function buildPerformanceMonthlyRecords({
  annualExceptionRows,
  drawingTaskRecords,
  peopleRows,
  ruleRows,
  workCalendarRows
}: BuildPerformanceMonthlyRecordsInput) {
  const applicableDrawingRecords = attachPerformanceRuleApplicability({
    peopleRows,
    records: drawingTaskRecords,
    ruleRows
  });
  const drawingRecordsById = new Map<string, PerformanceDrawingTaskMonthlyRecord>();

  for (const record of applicableDrawingRecords) {
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

  const nextDrawingRecords = [...drawingRecordsById.values()];

  return {
    categoryRecords: nextDrawingRecords as PerformanceMonthlyCategoryRecord[],
    drawingTaskRecords: nextDrawingRecords
  };
}
