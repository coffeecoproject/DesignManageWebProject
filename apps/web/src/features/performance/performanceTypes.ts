import type { PersonnelType } from '../people/peopleTypes';

export type PerformanceRuleStatus = '草稿' | '待审核' | '审核驳回' | '已发布' | '停用';

export type PerformanceRuleType = '任务制' | '提成制';

export type PerformanceRuleCategory = '绘图任务制' | '岗位职责考核' | '项目奖金' | '其它';

export type PerformanceRuleTemplateMode = '固定模块' | '待新增';

export type PerformanceRuleCategoryVersionState = '当前发布版本' | '员工执行旧版' | '待审核' | '审核驳回' | '草稿';

export type PerformanceRuleDocumentStatus = '待生成' | '已生成' | '已发布' | '已归档';

export type PerformanceSignatureStatus = '待发起' | '待员工确认' | '部分确认' | '已完成' | '已撤回' | '已失效';

export type PerformanceSignatureMethod = '在线确认' | '电子签待接入' | '线下补录';

export type PerformanceSignatureEmployeeStatus = '待确认' | '已确认' | '已拒绝' | '已撤回';

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
  taskItem: '平面图' | '施工图' | '物料营建单/下单流程' | '门店P图';
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

export type PerformanceQuarterlyReviewResult = {
  confirmedAt: string;
  finalAmount: number;
  prepayAmount: number;
  reviewPeriod: string;
  salarySettlementReference: string;
  settlementDate: string;
  sourceMonths: string[];
  sourceRecordIds: string[];
};

export type PerformanceExecutionContractStatus = '已匹配' | '缺少签署' | '签署版本不一致' | '岗位不适用' | '规则未发布' | '规则未配置';

export type PerformanceExecutionContractSource = '结构化规则' | '签署规则选项' | '未匹配';

export type PerformanceExecutionContract = {
  applicablePositions: string[];
  category: PerformanceRuleCategory;
  note: string;
  position: string;
  ruleId?: string;
  ruleName: string;
  ruleSource: PerformanceExecutionContractSource;
  ruleVersion: string;
  signedAt?: string;
  signedFileId?: string;
  signedFileName?: string;
  signedRuleName?: string;
  signedRuleVersion?: string;
  status: PerformanceExecutionContractStatus;
  workNo: string;
};

export type PerformanceMonthlyCategoryRecord = {
  id: string;
  employeeName: string;
  workNo: string;
  position: string;
  department: string;
  category: PerformanceRuleCategory;
  ruleName: string;
  ruleVersion: string;
  salarySettlementReference: string;
  performanceMonth: string;
  monthlyAmount: number;
  prepayAmount: number;
  sourceTaskCount: number;
  qualityScore?: number;
  taskScore?: number;
  updatedAt: string;
  sourceLabel: string;
  note: string;
  executionContract?: PerformanceExecutionContract;
  employmentScope?: PerformanceMonthlyEmploymentScope;
  prorationSummary?: PerformanceMonthlyProrationSummary;
  quarterlyReviewResult?: PerformanceQuarterlyReviewResult;
  events: PerformanceMonthlyEvent[];
};

export type PerformanceDrawingTaskMonthlyRecord = {
  id: string;
  employeeName: string;
  workNo: string;
  position: string;
  department: string;
  category: '绘图任务制';
  ruleName: string;
  ruleVersion: string;
  salarySettlementReference: string;
  performanceMonth: string;
  taskScore: number;
  qualityScore: number;
  qualityBand: string;
  baseQualityRatio: number;
  excessQualityRatio: number;
  monthlyAmount: number;
  prepayAmount: number;
  sourceTaskCount: number;
  updatedAt: string;
  taskSummaries: PerformanceMonthlyTaskSummary[];
  qualitySummaries: PerformanceMonthlyQualitySummary[];
  amountSummary: PerformanceMonthlyAmountSummary;
  executionContract?: PerformanceExecutionContract;
  employmentScope?: PerformanceMonthlyEmploymentScope;
  prorationSummary?: PerformanceMonthlyProrationSummary;
  quarterlyReviewResult?: PerformanceQuarterlyReviewResult;
  events: PerformanceMonthlyEvent[];
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

export type PerformanceSignatureEmployee = {
  id: string;
  employeeName: string;
  workNo: string;
  position: string;
  currentRuleVersion: string;
  pendingRuleVersion?: string;
  executionRuleVersion: string;
  calculationPolicy: string;
  confirmStatus: PerformanceSignatureEmployeeStatus;
  confirmedAt?: string;
  method: PerformanceSignatureMethod;
  effectiveDate: string;
  payrollUsable: boolean;
  note: string;
};

export type PerformanceSignatureBatchEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  changeSummary: string;
  note: string;
};

export type PerformanceSignatureBatch = {
  id: string;
  code: string;
  name: string;
  ruleId: string;
  ruleName: string;
  category: PerformanceRuleCategory;
  ruleVersion: string;
  previousRuleVersion?: string;
  executionFallback: string;
  positions: string[];
  personnelType: PersonnelType;
  fileName: string;
  fileVersion: string;
  method: PerformanceSignatureMethod;
  status: PerformanceSignatureStatus;
  launchedAt: string;
  launchedBy: string;
  effectiveDate: string;
  totalCount: number;
  confirmedCount: number;
  payrollUsableCount: number;
  riskNote: string;
  employees: PerformanceSignatureEmployee[];
  events: PerformanceSignatureBatchEvent[];
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
  scoringCycle: string;
  reviewCycle: string;
  payoutMode: string;
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
