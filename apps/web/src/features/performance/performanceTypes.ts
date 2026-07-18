import type { PersonnelType } from '../people/peopleTypes';
import type { PerformanceResponseDeadline } from './performanceResultDeadlineModel';

export type PerformanceRuleStatus = '草稿' | '待审核' | '审核驳回' | '已发布' | '停用';

export type PerformanceRuleType = '任务制' | '提成制';

export type PerformanceRuleCategory = '绘图任务制' | '岗位职责考核' | '项目奖金' | '其它';

export type PerformanceRuleTemplateMode = '固定模块' | '待新增';

export type PerformanceRuleCategoryVersionState = '当前发布版本' | '历史发布版本' | '待审核' | '审核驳回' | '草稿';

export type PerformanceRuleDocumentStatus = '待生成' | '已生成' | '已发布' | '已归档';

export type PerformanceTaskScoreItem = {
  id: string;
  taskConfigId: string;
  name: string;
  score: number;
  unit: string;
  unitKey: string;
  requiresConfirmation: boolean;
  scoreFieldKey: string;
  confirmationMode: string;
  evidence: string;
};

export type PerformanceQualityDimension = {
  id: string;
  name: string;
  score: number;
  weight: number;
  focus: string;
  evidence: string;
};

export type PerformanceQualityBand = {
  id: string;
  minScore: number;
  maxScore?: number;
  scoreRange: string;
  qualityRatio: number;
  excessRatio: number;
  handling: string;
};

export type PerformanceExcessBand = {
  id: string;
  minScoreExclusive: number;
  maxScore?: number;
  scoreRange: string;
  multiplier: number;
  requirement: string;
};

export type PerformanceFormulaItem = {
  id: string;
  item: string;
  variables: string[];
  method: string;
  result: string;
};

export type PerformanceRuleVersionEvent = {
  id: string;
  version: string;
  time: string;
  actor: string;
  action: string;
  changeSummary: string;
  note: string;
};

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

export type PerformanceRuleApplicabilityStatus =
  | '适用'
  | '人员未找到'
  | '人员类型不适用'
  | '岗位不适用'
  | '规则未发布'
  | '不在生效期'
  | '规则未配置'
  | '规则冲突'
  | '规则版本不一致';

export type PerformanceRuleApplicability = {
  applicablePositions: string[];
  category: PerformanceRuleCategory;
  effectiveEndAt?: string;
  effectiveStartAt?: string;
  note: string;
  personnelType?: PersonnelType;
  position: string;
  ruleId?: string;
  ruleName: string;
  ruleVersion: string;
  status: PerformanceRuleApplicabilityStatus;
  workNo: string;
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

export type PerformanceRuleGeneratedFile = {
  id: string;
  name: string;
  fileVersion: string;
  fileType: '系统生成规则文件' | '规则预览文件' | '历史规则文件';
  ruleVersion: string;
  documentStatus: PerformanceRuleDocumentStatus;
  effectiveDate?: string;
  generatedBy: string;
  generatedAt: string;
  note: string;
};

export type PerformanceRuleSourceFile = {
  id: string;
  name: string;
  fileType: '上传规则文件' | '规则附件';
  uploadedBy: string;
  uploadedAt: string;
  note: string;
};

export type PerformanceStructuredFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'money' | 'ratio';

export type PerformanceStructuredField = {
  id: string;
  fieldKey: string;
  label: string;
  type: PerformanceStructuredFieldType;
  required: boolean;
  usage: string;
  example: string;
};

export type PerformanceRuleClause = {
  id: string;
  title: string;
  treatment: '结构化计算' | '文本留痕' | '人工复核';
  note: string;
};

export type PerformanceRulePreset = {
  id: string;
  code: string;
  name: string;
  performanceType: PerformanceRuleType;
  category: PerformanceRuleCategory;
  categoryVersionState: PerformanceRuleCategoryVersionState;
  templateMode: PerformanceRuleTemplateMode;
  editableScope: string;
  applicablePositions: string[];
  personnelType: PersonnelType;
  status: PerformanceRuleStatus;
  currentVersion: string;
  parentRuleId?: string;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  lockReason: string;
  generatedFileSummary: string;
  fullScore: number;
  baseLineScore?: number;
  basePerformanceAmount?: number;
  belowBaselineFactor: number;
  monthlyPrepayRatio: number;
  scoringCycle: string;
  reviewCycle: string;
  taskScoreSummary: string;
  qualityScoreSummary: string;
  calculationSummary: string;
  structuredFieldSummary: string;
  scopeNote: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  taskScoreItems: PerformanceTaskScoreItem[];
  qualityDimensions: PerformanceQualityDimension[];
  qualityBands: PerformanceQualityBand[];
  excessBands: PerformanceExcessBand[];
  formulas: PerformanceFormulaItem[];
  ruleParameterFields: PerformanceStructuredField[];
  taskEventFields: PerformanceStructuredField[];
  monthlyResultFields: PerformanceStructuredField[];
  preservedClauses: PerformanceRuleClause[];
  sourceFiles: PerformanceRuleSourceFile[];
  generatedFiles: PerformanceRuleGeneratedFile[];
  versionEvents: PerformanceRuleVersionEvent[];
};
