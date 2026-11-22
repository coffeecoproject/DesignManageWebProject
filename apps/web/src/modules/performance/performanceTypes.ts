import type { PerformanceResponseDeadline } from './performanceResultDeadlineModel';
import type { PerformanceRuleApplicability, PerformanceRuleCategory } from '../performance-rules';

export type PerformanceMonthlyEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  object: string;
  summary: string;
};

export type PerformanceMonthlyTaskSummary = {
  id: string;
  taskItem: string;
  quantity: number;
  quantityUnit: string;
  scorePerUnit: number;
  scoreUnit: string;
  subtotalScore: number;
};

export type PerformanceMonthlyQualitySummary = {
  id: string;
  dimension: string;
  maxScore: number;
  score: number;
};

export type PerformanceMonthlyAmountSummary = {
  pointValue: number;
  confirmedBaseScore: number;
  excessScore: number;
  taskConfirmRatio: number;
  baseQualityRatio: number;
  excessQualityRatio: number;
  excessMultiplier: number;
  baseAmount: number;
  excessAmount: number;
  monthlyAmount: number;
  prepayRatio: number;
  prepayAmount: number;
  settlementNote: string;
};

export type PerformanceMonthlyEmploymentScope = {
  effectiveEndDate: string;
  effectiveStartDate: string;
  effectiveWorkdays: number;
  monthWorkdays: number;
  ratio: number;
};

export type PerformanceMonthlyProrationSummary = {
  applied: boolean;
  baseLineScore: number;
  basePerformanceAmount: number;
  fullScore: number;
  originalBaseLineScore: number;
  originalBasePerformanceAmount: number;
  originalFullScore: number;
};

export type PerformanceMonthlyCategoryRecord = {
  id: string;
  employeeName: string;
  workNo: string;
  position: string;
  category: PerformanceRuleCategory;
  ruleName: string;
  ruleVersion: string;
  salarySettlementReference: string;
  performanceMonth: string;
  monthlyAmount: number;
  prepayAmount: number;
  sourceTaskCount: number;
  sourceRecordIds: string[];
  qualityScore?: number;
  taskScore?: number;
  updatedAt: string;
  sourceLabel: string;
  note: string;
  ruleApplicability?: PerformanceRuleApplicability;
  resultLifecycleStatus?: PerformanceResultLifecycleStatus;
  resultResponseStatus?: PerformanceEmployeeResponseStatus;
  employmentScope?: PerformanceMonthlyEmploymentScope;
  prorationSummary?: PerformanceMonthlyProrationSummary;
  events: PerformanceMonthlyEvent[];
};

export type PerformanceDrawingTaskMonthlyRecord = Omit<
  PerformanceMonthlyCategoryRecord,
  'category' | 'qualityScore' | 'taskScore'
> & {
  category: '绘图任务制';
  taskScore: number;
  qualityScore: number;
  qualityBand: string;
  baseQualityRatio: number;
  excessQualityRatio: number;
  taskSummaries: PerformanceMonthlyTaskSummary[];
  qualitySummaries: PerformanceMonthlyQualitySummary[];
  amountSummary: PerformanceMonthlyAmountSummary;
};

export type PerformanceResultKind = '月度结果' | '季度结果';

export type PerformanceResultLifecycleStatus = '待发布' | '已发布' | '已结算' | '已更正';

export type PerformanceEmployeeResponseStatus = '待确认' | '已确认' | '有异议' | '异议已处理';

export type PerformanceEmployeeResponse = {
  employeeId: string;
  evidenceFileIds?: string[];
  objectionReason?: string;
  respondedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionSummary?: string;
  resultId: string;
  resultVersion: number;
  status: PerformanceEmployeeResponseStatus;
};

export type PerformanceResultEvent = {
  action:
    | '生成草稿'
    | '发布结果'
    | '确认结果'
    | '提出异议'
    | '维持原结果'
    | '更正结果'
    | '标记已更正'
    | '结算结果';
  actor: string;
  id: string;
  resultVersion: number;
  summary: string;
  time: string;
};

export type PerformanceCalculationSnapshot = {
  categoryRecord: PerformanceMonthlyCategoryRecord;
  drawingTaskRecord?: PerformanceDrawingTaskMonthlyRecord;
};

export type PerformanceQuarterlySourceSnapshot = {
  monthlyAmount: number;
  period: string;
  prepayAmount: number;
  publishedAt: string;
  resultId: string;
  resultVersion: number;
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  sourceHash: string;
};

export type PerformanceQuarterlyCalculationSnapshot = {
  category: PerformanceRuleCategory;
  expectedMonths: string[];
  missingMonths: string[];
  unresolvedObjectionMonths: string[];
  quarterAdjustmentAmount: number;
  quarterAdjustmentReason?: string;
  quarterCalculatedAmount: number;
  quarterClosed: boolean;
  quarterDifferenceAmount: number;
  quarterEndDate: string;
  quarterEvidenceFileIds: string[];
  quarterFinalAmount: number;
  quarterPrepayAmount: number;
  salarySettlementMonth: string;
  sourceResults: PerformanceQuarterlySourceSnapshot[];
};

type PerformanceResultSnapshotBase = {
  correctionReason?: string;
  deliveredAt?: string;
  employeeId: string;
  employeeNameSnapshot: string;
  employeeResponse: PerformanceEmployeeResponse;
  events: PerformanceResultEvent[];
  id: string;
  kind: PerformanceResultKind;
  lifecycleStatus: PerformanceResultLifecycleStatus;
  period: string;
  positionSnapshot: string;
  publishedAt?: string;
  publishedBy?: string;
  responseDeadline?: string;
  responseDeadlineSnapshot?: PerformanceResponseDeadline;
  resultKey: string;
  ruleId: string;
  ruleNameSnapshot: string;
  ruleVersion: string;
  salarySettlementMonth?: string;
  salarySettlementReference: string;
  sourceHash: string;
  sourceRecordIds: string[];
  supersededByResultId?: string;
  supersedesResultId?: string;
  version: number;
  workNoSnapshot: string;
};

export type PerformanceMonthlyResultSnapshot = PerformanceResultSnapshotBase & {
  calculationSnapshot: PerformanceCalculationSnapshot;
  kind: '月度结果';
  monthlyAmount: number;
  prepayAmount: number;
};

export type PerformanceQuarterlyResultSnapshot = PerformanceResultSnapshotBase & {
  calculationSnapshot: PerformanceQuarterlyCalculationSnapshot;
  kind: '季度结果';
  quarterAdjustmentAmount: number;
  quarterAdjustmentReason?: string;
  quarterCalculatedAmount: number;
  quarterDifferenceAmount: number;
  quarterEvidenceFileIds: string[];
  quarterFinalAmount: number;
  quarterPrepayAmount: number;
  salarySettlementMonth: string;
};

export type PerformanceResultSnapshot = PerformanceMonthlyResultSnapshot | PerformanceQuarterlyResultSnapshot;

export type PerformanceResultReadRecord = {
  currentSourceRecord?: PerformanceMonthlyCategoryRecord;
  currentQuarterDraft?: PerformanceQuarterlyResultSnapshot;
  publishBlockingReasons: string[];
  result: PerformanceResultSnapshot;
  sourceAvailable: boolean;
  sourceChangedSincePublish: boolean;
};
