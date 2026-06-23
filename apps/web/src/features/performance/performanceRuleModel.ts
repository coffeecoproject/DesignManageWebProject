import type { UploadFile } from 'antd/es/upload/interface';
import { positionOptions as allPositionOptions } from '../people/rolePermissionModel';
import type { TaskConfigRow } from '../system/TaskConfigState';
import { performanceSignatureBatches } from './performanceMockData';
import type {
  PerformanceFormulaItem,
  PerformanceRuleCategory,
  PerformanceRulePreset,
  PerformanceRuleSourceFile,
  PerformanceRuleStatus,
  PerformanceRuleType,
  PerformanceRuleVersionEvent,
  PerformanceSignatureBatch,
  PerformanceSignatureEmployee,
  PerformanceTaskScoreItem
} from './performanceTypes';

export type RuleStatusFilter = '全部' | PerformanceRuleStatus;
export type RuleCategoryFilter = '全部' | PerformanceRuleCategory;
export type RuleTypeFilter = '全部' | PerformanceRuleType;
export type RuleDrawerAction = 'saveDraft' | 'submitReview' | 'approveReview' | 'rejectReview' | 'deleteDraft';
export type RuleRelatedFileRecord = {
  id: string;
  name: string;
  sourceFile?: PerformanceRuleSourceFile;
  status: string;
  type: string;
  updatedAt: string;
};
export type RuleOperationRecord = {
  id?: string;
  action: string;
  actor: string;
  object: string;
  summary: string;
  time: string;
};
export type AmountFormulaRow = Pick<PerformanceFormulaItem, 'id' | 'item' | 'method'>;
export type RuleSignatureEmployeeStatus = '已签' | '不适用';
export type RuleSignatureEmployeeRow = PerformanceSignatureEmployee & {
  ruleSignatureStatus: RuleSignatureEmployeeStatus;
  signatureBatchName: string;
};
export type RuleSignatureSummary = {
  batch?: PerformanceSignatureBatch;
  confirmedCount: number;
  rows: RuleSignatureEmployeeRow[];
};
export type CreateRuleForm = {
  category: PerformanceRuleCategory;
  files: UploadFile[];
  performanceType: PerformanceRuleType;
  positions: string[];
};

export type PerformanceRuleFilters = {
  category: RuleCategoryFilter;
  keyword: string;
  performanceType: RuleTypeFilter;
  position: '全部' | string;
  status: RuleStatusFilter;
};

export type PerformanceRuleMetrics = {
  draftOrRejectedRules: number;
  publishedRules: number;
  reviewingRules: number;
  totalRules: number;
};

export const defaultPerformanceRuleFilters: PerformanceRuleFilters = {
  category: '全部',
  keyword: '',
  performanceType: '全部',
  position: '全部',
  status: '全部'
};

export const defaultCreateRuleForm: CreateRuleForm = {
  category: '绘图任务制',
  files: [],
  performanceType: '任务制',
  positions: []
};

export const performanceRuleBasisFileAccept = '.doc,.docx,.pdf,.jpg,.jpeg,.png';
export const performanceRuleBasisFileMaxSizeMb = 20;
export const performanceEligiblePositionOptions: string[] = allPositionOptions.filter((position) => position !== '外协设计师');

export const performanceRuleTypeOptions: Array<{
  description: string;
  disabled?: boolean;
  type: PerformanceRuleType;
}> = [
  {
    description: '按验收通过的任务计入绩效，当前已开放',
    type: '任务制'
  },
  {
    description: '按销售、回款或项目收益提成，暂未开放',
    disabled: true,
    type: '提成制'
  }
];

export const ruleCategoryOptions: Array<{
  category: PerformanceRuleCategory;
  description: string;
  disabled?: boolean;
  mode: string;
  performanceType: PerformanceRuleType;
}> = [
  {
    category: '绘图任务制',
    description: '施工图、平面图、门店P图、下单固定任务模块',
    mode: '任务制',
    performanceType: '任务制'
  },
  {
    category: '岗位职责考核',
    description: '岗位职责、协作、规范执行等综合考核类别',
    disabled: true,
    mode: '待新增',
    performanceType: '任务制'
  },
  {
    category: '项目奖金',
    description: '项目激励、阶段奖金等补充绩效类别',
    disabled: true,
    mode: '待新增',
    performanceType: '提成制'
  },
  {
    category: '其它',
    description: '其它绩效方案待新增后启用',
    disabled: true,
    mode: '待新增',
    performanceType: '提成制'
  }
];

export const ruleStatusTone = {
  草稿: 'blue',
  待审核: 'amber',
  审核驳回: 'gray',
  已发布: 'green',
  停用: 'gray'
} as const;

export const ruleTypeTone = {
  任务制: 'blue',
  提成制: 'amber'
} as const;

export const ruleSignatureEmployeeStatusTone = {
  已签: 'green',
  不适用: 'gray'
} as const;

export function formatRatio(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

export function formatScore(score?: number) {
  return typeof score === 'number' ? `${score} 分` : '-';
}

export function formatMoney(amount?: number) {
  return typeof amount === 'number' ? `${amount.toLocaleString('zh-CN')} 元` : '-';
}

export function getTaskConfigName(taskConfigId: string, taskConfigRows: TaskConfigRow[]) {
  return taskConfigRows.find((taskConfig) => taskConfig.id === taskConfigId)?.name ?? '未配置任务类型';
}

export function buildTaskScoreFieldKey(taskConfigId: string) {
  return `task_score_${taskConfigId.replace(/^task-type-/, '').replace(/-/g, '_')}`;
}

export function formatEffectivePeriod(rule: PerformanceRulePreset) {
  if (!rule.effectiveStartAt) {
    return '待定';
  }

  return `${rule.effectiveStartAt} 起${rule.effectiveEndAt ? ` 至 ${rule.effectiveEndAt}` : ''}`;
}

export function formatEffectiveDate(rule: PerformanceRulePreset) {
  return rule.effectiveStartAt ?? '待定';
}

export function buildRuleName(category: PerformanceRuleCategory, version: string) {
  return `${category}${version}`;
}

export function formatPositionList(positions: string[]) {
  return positions.length > 0 ? positions.join(' / ') : '待选择岗位';
}

export function getRulePositions(rule: Pick<PerformanceRulePreset, 'applicablePositions'> & { applicablePosition?: string }) {
  if (Array.isArray(rule.applicablePositions)) {
    return rule.applicablePositions;
  }

  return rule.applicablePosition ? [rule.applicablePosition] : [];
}

export function formatRulePositions(rule: Pick<PerformanceRulePreset, 'applicablePositions'> & { applicablePosition?: string }) {
  return formatPositionList(getRulePositions(rule));
}

export function formatRulePositionPreview(
  rule: Pick<PerformanceRulePreset, 'applicablePositions'> & { applicablePosition?: string },
  visibleCount = 2
) {
  const positions = getRulePositions(rule);

  if (positions.length === 0) {
    return '待选择岗位';
  }

  const visiblePositions = positions.slice(0, visibleCount).join(' / ');
  const hiddenCount = positions.length - visibleCount;

  return hiddenCount > 0 ? `${visiblePositions} +${hiddenCount}` : visiblePositions;
}

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function hasPositiveNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function getRuleReviewBlockers(rule: PerformanceRulePreset) {
  const blockers: string[] = [];

  if (getRulePositions(rule).length === 0) {
    blockers.push('适用岗位');
  }

  if (rule.sourceFiles.length === 0) {
    blockers.push('规则依据文件');
  }

  if (rule.performanceType !== '任务制') {
    blockers.push('绩效类型暂未开放');
    return blockers;
  }

  if (
    rule.taskScoreItems.length === 0 ||
    rule.taskScoreItems.some((item) => !item.taskConfigId || !hasPositiveNumber(item.score) || !hasText(item.unit))
  ) {
    blockers.push('任务计分');
  }

  if (
    rule.qualityDimensions.length === 0 ||
    rule.qualityDimensions.some((item) => !hasText(item.name) || !hasPositiveNumber(item.score) || !hasText(item.focus) || !hasText(item.evidence))
  ) {
    blockers.push('质量评分');
  }

  if (
    rule.qualityBands.length === 0 ||
    rule.qualityBands.some(
      (item) => !hasText(item.scoreRange) || !Number.isFinite(item.qualityRatio) || !Number.isFinite(item.excessRatio) || !hasText(item.handling)
    )
  ) {
    blockers.push('质量档位');
  }

  if (
    !hasPositiveNumber(rule.baseLineScore) ||
    !hasPositiveNumber(rule.basePerformanceAmount) ||
    !hasText(rule.scoringCycle) ||
    !hasText(rule.reviewCycle) ||
    !hasText(rule.payoutMode) ||
    rule.ruleParameterFields.some((item) => item.required && !hasText(item.example))
  ) {
    blockers.push('金额参数');
  }

  if (
    rule.excessBands.length === 0 ||
    rule.excessBands.some((item) => !hasText(item.scoreRange) || !hasPositiveNumber(item.multiplier) || !hasText(item.requirement))
  ) {
    blockers.push('超额激励');
  }

  if (
    rule.formulas.length === 0 ||
    rule.formulas.some((item) => !hasText(item.item) || !hasText(item.method) || !hasText(item.result) || item.variables.length === 0)
  ) {
    blockers.push('公式预览');
  }

  return blockers;
}

export function getRuleReviewBlockerText(rule: PerformanceRulePreset) {
  const blockers = getRuleReviewBlockers(rule);

  return blockers.length > 0 ? `待补全：${blockers.join('、')}` : '已满足提交审核条件';
}

export function getRuleSignatureBatch(rule: PerformanceRulePreset) {
  return (
    performanceSignatureBatches.find((batch) => batch.ruleId === rule.id) ??
    performanceSignatureBatches.find((batch) => batch.ruleName === rule.name && batch.ruleVersion === rule.currentVersion)
  );
}

export function getRuleSignatureStatus(employee: PerformanceSignatureEmployee): RuleSignatureEmployeeStatus {
  if (employee.confirmStatus === '已确认') {
    return '已签';
  }

  return '不适用';
}

export function getRuleSignatureSummary(rule: PerformanceRulePreset): RuleSignatureSummary {
  const batch = getRuleSignatureBatch(rule);
  const batchRows =
    batch?.employees.map((employee) => ({
      ...employee,
      ruleSignatureStatus: getRuleSignatureStatus(employee),
      signatureBatchName: batch.name
    })) ?? [];
  const rows = batchRows.filter((employee) => employee.ruleSignatureStatus === '已签');
  const confirmedCount = batch?.confirmedCount ?? rows.length;

  return {
    batch,
    confirmedCount,
    rows
  };
}

export function getRuleSignatureCountText(rule: PerformanceRulePreset, summary: RuleSignatureSummary) {
  if (!summary.batch) {
    return rule.status === '已发布' ? '未发起' : '发布后签署';
  }

  return `已签 ${summary.confirmedCount} 人`;
}

export function getRuleVersionNumber(rule: PerformanceRulePreset) {
  const versionSource = `${rule.currentVersion} ${rule.name}`;
  const match = versionSource.match(/V(\d+)/);

  return match ? Number(match[1]) : 0;
}

export function getNextRuleVersion(ruleRows: PerformanceRulePreset[]) {
  const maxVersion = ruleRows.reduce((max, rule) => Math.max(max, getRuleVersionNumber(rule)), 0);

  return `V${maxVersion + 1}`;
}

export function getRuleStatusSortValue(status: PerformanceRuleStatus) {
  const priority: Record<PerformanceRuleStatus, number> = {
    已发布: 0,
    待审核: 1,
    审核驳回: 2,
    草稿: 3,
    停用: 4
  };
  return priority[status];
}

export function createDraftRuleFromCategory({
  category,
  files,
  performanceType,
  positions,
  sequence,
  templateRule,
  version
}: CreateRuleForm & {
  sequence: number;
  templateRule?: PerformanceRulePreset;
  version: string;
}): PerformanceRulePreset {
  const code = `PERF-2026-${performanceType === '任务制' ? 'TASK' : 'COMM'}-${String(sequence).padStart(3, '0')}`;
  const name = buildRuleName(category, version);
  const isTaskRule = performanceType === '任务制';
  const positionSummary = formatPositionList(positions);
  const sourceFiles: PerformanceRuleSourceFile[] = files.map((file, index) => ({
    id: `source-${code}-${index + 1}`,
    name: file.name,
    fileType: '上传规则文件',
    uploadedBy: '李明',
    uploadedAt: '2026-06-13',
    note: '新增绩效规则时上传的规则依据文件；当前仅为前端原型，未接入对象存储。'
  }));

  return {
    id: `perf-rule-new-draft-${sequence}`,
    code,
    name,
    performanceType,
    category,
    templateMode: isTaskRule ? '固定模块' : '待新增',
    editableScope: isTaskRule ? '任务类型可配置；质量评分维度固定；可调整任务分值' : '提成制暂未开放',
    applicablePositions: positions,
    personnelType: '全职',
    categoryVersionState: '草稿',
    status: '草稿',
    currentVersion: version,
    lockReason: '已选择绩效方案；完成基础配置并提交审核前不能发起员工确认',
    generatedFileSummary: sourceFiles.length > 0 ? `已上传 ${sourceFiles[0].name}` : '待上传规则依据文件',
    fullScore: templateRule?.fullScore ?? 100,
    baseLineScore: templateRule?.baseLineScore,
    basePerformanceAmount: templateRule?.basePerformanceAmount,
    scoringCycle: templateRule?.scoringCycle ?? '待确认',
    reviewCycle: templateRule?.reviewCycle ?? '待确认',
    payoutMode: templateRule?.payoutMode ?? '待确认',
    taskScoreSummary: isTaskRule ? '任务制任务项可增删；每个任务维护绩效分值' : '提成制暂未开放',
    qualityScoreSummary: isTaskRule ? '任务制固定质量维度，不在方案中自定义' : '提成制暂未开放',
    calculationSummary: templateRule?.calculationSummary ?? '待配置金额计算方式',
    structuredFieldSummary: templateRule?.structuredFieldSummary ?? '待拆字段',
    scopeNote: `${category} ${version} 草稿，覆盖岗位：${positionSummary}，待提交审核后发布`,
    lastUpdatedAt: '2026-06-13',
    lastUpdatedBy: '李明',
    taskScoreItems: templateRule?.taskScoreItems.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    qualityDimensions: templateRule?.qualityDimensions.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    qualityBands: templateRule?.qualityBands.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    excessBands: templateRule?.excessBands.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    formulas: templateRule?.formulas.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    ruleParameterFields: templateRule?.ruleParameterFields.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    taskEventFields: templateRule?.taskEventFields.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    monthlyResultFields: templateRule?.monthlyResultFields.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    preservedClauses: templateRule?.preservedClauses.map((item) => ({ ...item, id: `${item.id}-new-${sequence}` })) ?? [],
    sourceFiles,
    generatedFiles: [],
    versionEvents: [
      {
        id: `event-${code}-draft`,
        version,
        time: '2026-06-13',
        actor: '李明',
        action: '创建草稿',
        changeSummary: `${category} / ${positionSummary} / ${version}`,
        note: `规则名称由系统按模板和版本生成：${name}`
      }
    ]
  };
}

export function createTaskScoreItemFromTaskConfig(taskConfig: TaskConfigRow, sequence: number): PerformanceTaskScoreItem {
  return {
    confirmationMode: '验收通过后按质量评分确认',
    evidence: '任务记录、验收记录、交付文件',
    id: `task-score-${taskConfig.id}-${sequence}`,
    name: taskConfig.name,
    requiresConfirmation: true,
    score: 1,
    scoreFieldKey: buildTaskScoreFieldKey(taskConfig.id),
    taskConfigId: taskConfig.id,
    unit: '项',
    unitKey: 'task'
  };
}

export function buildSourceFilesFromUploads(rule: PerformanceRulePreset, files: UploadFile[]): PerformanceRuleSourceFile[] {
  const previousFiles = new Map(rule.sourceFiles.map((file) => [file.name, file]));

  return files.map((file, index) => {
    const previousFile = previousFiles.get(file.name);

    if (previousFile) {
      return previousFile;
    }

    return {
      id: file.uid || `source-${rule.code}-${index + 1}`,
      name: file.name,
      fileType: '上传规则文件',
      uploadedBy: '李明',
      uploadedAt: '2026-06-13',
      note: '草稿配置页上传的规则依据文件；当前仅为前端原型，未接入对象存储。'
    };
  });
}

export function toRuleRelatedFileRecord(file: PerformanceRuleSourceFile): RuleRelatedFileRecord {
  return {
    id: file.id,
    name: file.name,
    sourceFile: file,
    status: '已上传',
    type: file.fileType === '上传规则文件' ? '规则依据文件' : '规则附件',
    updatedAt: file.uploadedAt
  };
}

export function getRuleRelatedFileRecords(files: PerformanceRuleSourceFile[]): RuleRelatedFileRecord[] {
  if (files.length > 0) {
    return files.map(toRuleRelatedFileRecord);
  }

  return [
    {
      id: 'rule-file-placeholder',
      name: '待上传规则依据文件',
      status: '待上传',
      type: '规则依据文件',
      updatedAt: '-'
    }
  ];
}

export function getRuleVersionOperationRecords(rule: PerformanceRulePreset): RuleOperationRecord[] {
  return rule.versionEvents.map((event) => ({
    id: event.id,
    action: event.action,
    actor: event.actor,
    object: buildRuleName(rule.category, event.version),
    summary: event.changeSummary,
    time: event.time
  }));
}

export function getCoreAmountFormulaRows(rule: PerformanceRulePreset): AmountFormulaRow[] {
  const coreItems = new Set(['基础绩效工资', '超额绩效工资', '月度绩效工资']);

  return rule.formulas
    .filter((item) => coreItems.has(item.item))
    .map(({ id, item, method }) => ({ id, item, method }));
}

export function getPerformanceRuleFilterOptions(ruleRows: PerformanceRulePreset[]) {
  return {
    categories: ['全部', ...Array.from(new Set(ruleRows.map((rule) => rule.category)))] as Array<'全部' | PerformanceRuleCategory>,
    performanceTypes: ['全部', ...Array.from(new Set(ruleRows.map((rule) => rule.performanceType)))] as Array<'全部' | PerformanceRuleType>,
    positions: ['全部', ...Array.from(new Set(ruleRows.flatMap((rule) => getRulePositions(rule))))] as Array<'全部' | string>
  };
}

export function filterPerformanceRules(ruleRows: PerformanceRulePreset[], filters: PerformanceRuleFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  return ruleRows
    .filter((rule) => filters.status === '全部' || rule.status === filters.status)
    .filter((rule) => filters.performanceType === '全部' || rule.performanceType === filters.performanceType)
    .filter((rule) => filters.category === '全部' || rule.category === filters.category)
    .filter((rule) => filters.position === '全部' || getRulePositions(rule).includes(filters.position))
    .filter((rule) => {
      if (!keyword) {
        return true;
      }

      return [rule.name, rule.code, formatRulePositions(rule), rule.performanceType, rule.category, rule.taskScoreSummary]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    })
    .sort((left, right) => getRuleStatusSortValue(left.status) - getRuleStatusSortValue(right.status));
}

export function getPerformanceRuleMetrics(ruleRows: PerformanceRulePreset[]): PerformanceRuleMetrics {
  const publishedRules = ruleRows.filter((rule) => rule.status === '已发布').length;
  const reviewingRules = ruleRows.filter((rule) => rule.status === '待审核').length;
  const draftRules = ruleRows.filter((rule) => rule.status === '草稿').length;
  const rejectedRules = ruleRows.filter((rule) => rule.status === '审核驳回').length;

  return {
    draftOrRejectedRules: draftRules + rejectedRules,
    publishedRules,
    reviewingRules,
    totalRules: ruleRows.length
  };
}

export function appendRuleEvent(
  rule: PerformanceRulePreset,
  action: string,
  changeSummary: string,
  note: string,
  now = Date.now()
): PerformanceRuleVersionEvent[] {
  return [
    ...rule.versionEvents,
    {
      id: `event-${rule.id}-${now}`,
      version: rule.currentVersion,
      time: '2026-06-13',
      actor: '李明',
      action,
      changeSummary,
      note
    }
  ];
}

export function submitRuleForReview(rule: PerformanceRulePreset) {
  return {
    ...rule,
    status: '待审核',
    categoryVersionState: '待审核',
    lockReason: '规则已提交审核，审核期间不可编辑',
    lastUpdatedAt: '2026-06-13',
    lastUpdatedBy: '李明',
    versionEvents: appendRuleEvent(
      rule,
      rule.status === '审核驳回' ? '重新提交审核' : '提交审核',
      `${rule.name} ${rule.status === '审核驳回' ? '重新提交审核' : '提交审核'}`,
      '审核期间规则参数锁定，只读查看'
    )
  } satisfies PerformanceRulePreset;
}

export function rejectPerformanceRule(rule: PerformanceRulePreset) {
  return {
    ...rule,
    status: '审核驳回',
    categoryVersionState: '审核驳回',
    lockReason: '审核已驳回，可调整参数后重新提交审核',
    lastUpdatedAt: '2026-06-13',
    lastUpdatedBy: '李明',
    versionEvents: appendRuleEvent(rule, '审核驳回', `${rule.name} 审核驳回`, '驳回后可修改配置并重新提交审核')
  } satisfies PerformanceRulePreset;
}

export function publishPerformanceRule(rule: PerformanceRulePreset) {
  return {
    ...rule,
    status: '已发布',
    categoryVersionState: '当前发布版本',
    effectiveStartAt: rule.effectiveStartAt ?? '2026-07-01',
    lockReason: '规则已发布，后续调整需新建并审核发布新版本',
    lastUpdatedAt: '2026-06-13',
    lastUpdatedBy: '李明',
    versionEvents: appendRuleEvent(rule, '审核通过并发布', `${rule.name} 审核通过并发布`, '发布后可进入绩效签署，未签新版员工继续执行旧版')
  } satisfies PerformanceRulePreset;
}

export function applyPublishedRule(ruleRows: PerformanceRulePreset[], publishedRule: PerformanceRulePreset): PerformanceRulePreset[] {
  return ruleRows.map((currentRule) => {
    if (currentRule.id === publishedRule.id) {
      return publishedRule;
    }

    if (currentRule.category === publishedRule.category && currentRule.status === '已发布') {
      return {
        ...currentRule,
        categoryVersionState: '员工执行旧版'
      } satisfies PerformanceRulePreset;
    }

    return currentRule;
  });
}
