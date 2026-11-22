import type { PersonnelType } from '../people';

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
