import { buildPerformanceSalarySettlementReference } from './performanceMonthlyModel';
import type {
  PerformanceMonthlyCategoryRecord,
  PerformanceQuarterlyReviewResult
} from './performanceTypes';

export type PerformanceQuarterlyReviewPolicy = {
  payoutMode: string;
  reviewCycle: string;
};

export type PerformanceQuarterlyReviewFact = PerformanceQuarterlyReviewResult & {
  confirmedBy: string;
  employeeName: string;
  employeeNo: string;
  monthlyAmount: number;
  reviewKey: string;
  ruleName: string;
  ruleVersion: string;
};

export type PerformanceQuarterlyReviewInput = {
  confirmedAt: string;
  confirmedBy: string;
  finalAmount: number;
  settlementDate: string;
};

export type PerformanceQuarterlyReviewCommitResult =
  | { facts: PerformanceQuarterlyReviewFact[]; success: true }
  | { facts: PerformanceQuarterlyReviewFact[]; reason: string; success: false };

function isValidMoney(value: number) {
  return Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getRuleKey(record: PerformanceMonthlyCategoryRecord) {
  return record.executionContract?.ruleId ?? `${record.ruleName}:${record.ruleVersion}`;
}

export function getPerformanceQuarter(periodMonth: string) {
  const [year, monthText] = periodMonth.split('-');
  const month = Number(monthText);

  if (!/^\d{4}$/.test(year ?? '') || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('绩效月份无法确定季度');
  }

  return `${year}-Q${Math.ceil(month / 3)}`;
}

export function getPerformanceQuarterEndDate(periodMonth: string) {
  const [year, monthText] = periodMonth.split('-');
  const month = Number(monthText);

  if (!/^\d{4}$/.test(year ?? '') || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('绩效月份无法确定季度结算日');
  }

  const quarterEndMonth = Math.ceil(month / 3) * 3;
  const endDate = new Date(Number(year), quarterEndMonth, 0);

  return `${year}-${String(quarterEndMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
}

export function getPerformanceQuarterlyReviewKey(record: PerformanceMonthlyCategoryRecord) {
  return `${record.workNo}:${getRuleKey(record)}:${getPerformanceQuarter(record.performanceMonth)}`;
}

export function getPerformanceQuarterlyReviewSourceRecords(
  record: PerformanceMonthlyCategoryRecord,
  records: PerformanceMonthlyCategoryRecord[]
) {
  const reviewKey = getPerformanceQuarterlyReviewKey(record);

  return records
    .filter((candidate) => getPerformanceQuarterlyReviewKey(candidate) === reviewKey)
    .sort(
      (left, right) =>
        left.performanceMonth.localeCompare(right.performanceMonth)
        || left.id.localeCompare(right.id)
    );
}

export function buildPerformanceQuarterlyReviewFact({
  existingFacts,
  input,
  policy,
  records
}: {
  existingFacts: PerformanceQuarterlyReviewFact[];
  input: PerformanceQuarterlyReviewInput;
  policy?: PerformanceQuarterlyReviewPolicy;
  records: PerformanceMonthlyCategoryRecord[];
}): PerformanceQuarterlyReviewFact {
  const firstRecord = records[0];

  if (!firstRecord || records.some((record) => record.category !== '绘图任务制')) {
    throw new Error('季度绩效缺少可复核的任务制来源');
  }
  if (policy?.reviewCycle !== '季度复核' || !policy.payoutMode.includes('季度复核')) {
    throw new Error('当前绩效规则不适用季度复核结算');
  }

  const reviewKey = getPerformanceQuarterlyReviewKey(firstRecord);

  if (records.some((record) => getPerformanceQuarterlyReviewKey(record) !== reviewKey)) {
    throw new Error('季度绩效来源不属于同一人员、规则和季度');
  }
  if (existingFacts.some((fact) => fact.reviewKey === reviewKey)) {
    throw new Error('该员工本季度绩效已经完成复核');
  }
  if (!isValidMoney(input.finalAmount)) {
    throw new Error('季度复核金额必须是非负且最多两位小数');
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input.confirmedAt)) {
    throw new Error('季度复核必须记录有效确认时间');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.settlementDate)) {
    throw new Error('请选择有效的季度结算日');
  }

  const quarterEndDate = getPerformanceQuarterEndDate(firstRecord.performanceMonth);
  const confirmedDate = input.confirmedAt.slice(0, 10);

  if (confirmedDate < quarterEndDate) {
    throw new Error('本季度尚未结束，不能确认季度绩效');
  }
  if (input.settlementDate < confirmedDate) {
    throw new Error('季度绩效结算日不能早于确认日期');
  }
  if (!input.confirmedBy.trim()) {
    throw new Error('季度复核必须记录确认人');
  }

  const reviewPeriod = getPerformanceQuarter(firstRecord.performanceMonth);
  const sourceRecordIds = records.map((record) => record.id);

  return {
    confirmedAt: input.confirmedAt,
    confirmedBy: input.confirmedBy.trim(),
    employeeName: firstRecord.employeeName,
    employeeNo: firstRecord.workNo,
    finalAmount: roundMoney(input.finalAmount),
    monthlyAmount: roundMoney(records.reduce((total, record) => total + record.monthlyAmount, 0)),
    prepayAmount: roundMoney(records.reduce((total, record) => total + record.prepayAmount, 0)),
    reviewKey,
    reviewPeriod,
    ruleName: firstRecord.ruleName,
    ruleVersion: firstRecord.ruleVersion,
    salarySettlementReference: buildPerformanceSalarySettlementReference(
      `${firstRecord.workNo}:${getRuleKey(firstRecord)}:${reviewPeriod}`,
      'quarterly-review',
      'v1'
    ),
    settlementDate: input.settlementDate,
    sourceMonths: [...new Set(records.map((record) => record.performanceMonth))].sort(),
    sourceRecordIds
  };
}

export function commitPerformanceQuarterlyReview({
  facts,
  input,
  policy,
  records
}: {
  facts: PerformanceQuarterlyReviewFact[];
  input: PerformanceQuarterlyReviewInput;
  policy?: PerformanceQuarterlyReviewPolicy;
  records: PerformanceMonthlyCategoryRecord[];
}): PerformanceQuarterlyReviewCommitResult {
  try {
    const nextFact = buildPerformanceQuarterlyReviewFact({ existingFacts: facts, input, policy, records });

    return { facts: [nextFact, ...facts], success: true };
  } catch (error) {
    return {
      facts,
      reason: error instanceof Error ? error.message : '季度绩效结果未保存',
      success: false
    };
  }
}

export function attachPerformanceQuarterlyReviewFacts(
  records: PerformanceMonthlyCategoryRecord[],
  facts: PerformanceQuarterlyReviewFact[]
) {
  const factsBySourceId = new Map(
    facts.flatMap((fact) => fact.sourceRecordIds.map((sourceRecordId) => [sourceRecordId, fact] as const))
  );

  return records.map((record) => {
    const fact = factsBySourceId.get(record.id);

    return fact
      ? {
          ...record,
          quarterlyReviewResult: {
            confirmedAt: fact.confirmedAt,
            finalAmount: fact.finalAmount,
            prepayAmount: fact.prepayAmount,
            reviewPeriod: fact.reviewPeriod,
            salarySettlementReference: fact.salarySettlementReference,
            settlementDate: fact.settlementDate,
            sourceMonths: [...fact.sourceMonths],
            sourceRecordIds: [...fact.sourceRecordIds]
          },
          events: record.events.some((event) => event.id === `${fact.reviewKey}-quarterly-review`)
            ? record.events
            : [
                ...record.events,
                {
                  action: '确认季度绩效',
                  actor: fact.confirmedBy,
                  id: `${fact.reviewKey}-quarterly-review`,
                  object: `${record.employeeName} ${fact.reviewPeriod} ${record.category}`,
                  summary: `季度结果 ${fact.finalAmount.toFixed(2)} 元，随 ${fact.settlementDate.slice(0, 7)} 薪酬结算`,
                  time: fact.confirmedAt
                }
              ]
        }
      : record;
  });
}
