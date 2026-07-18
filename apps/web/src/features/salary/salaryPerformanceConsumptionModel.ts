import { getCurrentPerformanceResults } from '../performance/performanceResultModel';
import { isPerformanceResultSalaryEligible } from '../performance/performanceResultResponseModel';
import type { PerformanceResultSnapshot } from '../performance/performanceTypes';
import type {
  SalaryMonthlyWorkflowRecord,
  SalaryPerformanceSourceRecord
} from './salaryDomain';

type BuildSalaryPerformanceSourceRecordsInput = {
  asOf: string;
  formalResults: PerformanceResultSnapshot[];
  salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[];
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getResultSettlementAmount(result: PerformanceResultSnapshot) {
  return result.kind === '月度结果'
    ? result.prepayAmount
    : result.quarterDifferenceAmount;
}

function getClaimedReferences(salaryMonthlyWorkflows: SalaryMonthlyWorkflowRecord[]) {
  return new Set(
    salaryMonthlyWorkflows.flatMap((workflow) => workflow.salarySettlementReferences ?? [])
  );
}

function getLatestClaimedPriorResult(
  result: PerformanceResultSnapshot,
  resultHistory: PerformanceResultSnapshot[],
  claimedReferences: Set<string>
) {
  return resultHistory
    .filter(
      (candidate) =>
        candidate.resultKey === result.resultKey
        && candidate.version < result.version
        && claimedReferences.has(candidate.salarySettlementReference)
    )
    .sort((left, right) => right.version - left.version)[0];
}

function getResultUpdatedAt(result: PerformanceResultSnapshot) {
  return result.employeeResponse.resolvedAt
    ?? result.employeeResponse.respondedAt
    ?? result.publishedAt
    ?? `${result.period}-01 00:00`;
}

function toSalaryPerformanceSourceRecord(
  result: PerformanceResultSnapshot,
  settlementAmount: number
): SalaryPerformanceSourceRecord {
  const updatedAt = getResultUpdatedAt(result);

  if (result.kind === '月度结果') {
    const source = result.calculationSnapshot.categoryRecord;

    return {
      category: source.category,
      employeeName: result.employeeNameSnapshot,
      id: result.id,
      monthlyAmount: result.monthlyAmount,
      note: `${result.period} ${result.ruleNameSnapshot} V${result.version}`,
      performanceMonth: result.period,
      prepayAmount: roundMoney(settlementAmount),
      qualityScore: source.qualityScore ?? source.taskScore,
      ruleName: result.ruleNameSnapshot,
      ruleVersion: result.ruleVersion,
      salarySettlementReference: result.salarySettlementReference,
      sourceLabel: '正式月度绩效结果',
      sourceTaskCount: source.sourceTaskCount,
      updatedAt,
      workNo: result.employeeId
    };
  }

  return {
    category: result.calculationSnapshot.category,
    employeeName: result.employeeNameSnapshot,
    id: result.id,
    monthlyAmount: result.quarterFinalAmount,
    note: `${result.period} ${result.ruleNameSnapshot} V${result.version}，本次结算差额 ${roundMoney(settlementAmount)} 元`,
    performanceMonth: result.salarySettlementMonth,
    prepayAmount: 0,
    quarterlyReviewResult: {
      confirmedAt: updatedAt,
      finalAmount: roundMoney(settlementAmount),
      prepayAmount: 0,
      reviewPeriod: result.period,
      salarySettlementReference: result.salarySettlementReference,
      settlementDate: `${result.salarySettlementMonth}-01`,
      sourceMonths: [...result.calculationSnapshot.expectedMonths],
      sourceRecordIds: [...result.sourceRecordIds]
    },
    ruleName: result.ruleNameSnapshot,
    ruleVersion: result.ruleVersion,
    salarySettlementReference: result.salarySettlementReference,
    sourceLabel: '正式季度绩效结果',
    sourceTaskCount: result.sourceRecordIds.length,
    updatedAt,
    workNo: result.employeeId
  };
}

export function buildSalaryPerformanceSourceRecords({
  asOf,
  formalResults,
  salaryMonthlyWorkflows
}: BuildSalaryPerformanceSourceRecordsInput): SalaryPerformanceSourceRecord[] {
  const claimedReferences = getClaimedReferences(salaryMonthlyWorkflows);
  const currentResults = getCurrentPerformanceResults(formalResults);

  return formalResults
    .filter((result) => {
      if (claimedReferences.has(result.salarySettlementReference)) {
        return true;
      }

      return currentResults.get(result.resultKey)?.id === result.id
        && isPerformanceResultSalaryEligible(formalResults, result.id, asOf);
    })
    .map((result) => {
      const priorClaimedResult = getLatestClaimedPriorResult(
        result,
        formalResults,
        claimedReferences
      );
      const settlementAmount = roundMoney(
        getResultSettlementAmount(result)
          - (priorClaimedResult ? getResultSettlementAmount(priorClaimedResult) : 0)
      );

      return toSalaryPerformanceSourceRecord(result, settlementAmount);
    })
    .sort(
      (left, right) =>
        left.performanceMonth.localeCompare(right.performanceMonth)
        || left.workNo.localeCompare(right.workNo)
        || left.salarySettlementReference.localeCompare(right.salarySettlementReference)
    );
}
