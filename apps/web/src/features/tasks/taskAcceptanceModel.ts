import type { UploadFile } from 'antd/es/upload/interface';
import type { CustomerContactRecord, CustomerRecord } from '../customers/customerData';
import type { PeopleMember } from '../people/peopleTypes';
import { resolvePerformanceRuleForMember } from '../performance/performanceRuleApplicabilityModel';
import type {
  PerformanceQualityDimension,
  PerformanceRulePreset
} from '../performance/performanceTypes';
import { calculateWeightedPerformanceQualityScore } from '../performance/performanceRuleCalculationModel';
import {
  taskManagementNow,
  type ClientFeedbackChannel,
  type ClientFeedbackRecord,
  type StoreTaskRecord,
  type TaskPerformanceDimensionScore,
  type TaskPerformanceScoringRecord
} from './TaskManagementState';

export type AcceptanceScoringDraft = {
  adjustmentReason: string;
  dimensionScores: AcceptanceDimensionScore[];
  ruleId?: string;
  scoreItemId?: string;
  scoreValue?: number;
  sourceMonth: string;
};

export type AcceptanceDimensionScore = Omit<TaskPerformanceDimensionScore, 'score'> & {
  score?: number;
};

export type AcceptanceFeedbackDraft = {
  channel: ClientFeedbackChannel;
  contactId: string;
  content: string;
  feedbackAt: string;
  feedbackBy: string;
  feedbackPhone: string;
  feedbackRole: string;
  screenshots: UploadFile[];
};

export function formatScore(value?: number) {
  if (typeof value !== 'number') {
    return '-';
  }

  return Number.isInteger(value) ? `${value} 分` : `${value.toFixed(1)} 分`;
}

export function getAcceptedMonth(task: StoreTaskRecord) {
  return (task.acceptedAt ?? taskManagementNow).slice(0, 7);
}

export function getTaskPerformanceRule(
  task: StoreTaskRecord,
  member: PeopleMember | undefined,
  performanceRuleRows: PerformanceRulePreset[]
) {
  if (!member) {
    return undefined;
  }

  const resolution = resolvePerformanceRuleForMember({
    category: '绘图任务制',
    member,
    performanceMonth: getAcceptedMonth(task),
    ruleRows: performanceRuleRows
  });

  return resolution.applicability.status === '适用'
    && resolution.rule?.performanceType === '任务制'
    && resolution.rule.taskScoreItems.some((item) => item.taskConfigId === task.taskConfigId)
    ? resolution.rule
    : undefined;
}

export function getTaskScoreItem(task: StoreTaskRecord, rule: PerformanceRulePreset | undefined) {
  if (!rule) {
    return undefined;
  }

  return rule.taskScoreItems.find((item) => item.taskConfigId === task.taskConfigId);
}

function getPrimaryContact(contacts: CustomerContactRecord[] | undefined) {
  return contacts?.find((contact) => contact.primary) ?? contacts?.[0];
}

export function buildAcceptanceFeedbackDraft(task: StoreTaskRecord, getCustomerById: (customerId: string) => CustomerRecord | undefined): AcceptanceFeedbackDraft {
  const contact = getPrimaryContact(getCustomerById(task.customerId)?.contacts);

  return {
    channel: '微信',
    contactId: contact?.id ?? '',
    content: '',
    feedbackAt: taskManagementNow,
    feedbackBy: contact?.name ?? '',
    feedbackPhone: contact?.phone ?? '',
    feedbackRole: contact?.role ?? '',
    screenshots: []
  };
}

export function getQualityBand(rule: PerformanceRulePreset | undefined, score: number) {
  return rule?.qualityBands.find((band) => score >= band.minScore && (typeof band.maxScore !== 'number' || score <= band.maxScore));
}

export function getQualityScore(
  dimensionScores: TaskPerformanceDimensionScore[],
  qualityDimensions: PerformanceQualityDimension[]
) {
  return calculateWeightedPerformanceQualityScore(dimensionScores, qualityDimensions);
}

export function getCompletedDimensionScores(draft: AcceptanceScoringDraft | undefined): TaskPerformanceDimensionScore[] | undefined {
  if (!draft?.dimensionScores.length) {
    return undefined;
  }

  const isComplete = draft.dimensionScores.every((item) => typeof item.score === 'number' && item.score >= 0 && item.score <= item.maxScore);

  if (!isComplete) {
    return undefined;
  }

  return draft.dimensionScores.map((item) => ({
    id: item.id,
    maxScore: item.maxScore,
    name: item.name,
    score: item.score as number
  }));
}

export function buildAcceptanceScoringDraft(
  task: StoreTaskRecord,
  member: PeopleMember | undefined,
  performanceRuleRows: PerformanceRulePreset[]
): AcceptanceScoringDraft {
  const rule = getTaskPerformanceRule(task, member, performanceRuleRows);
  const scoreItem = getTaskScoreItem(task, rule);

  return {
    adjustmentReason: '',
    dimensionScores:
      rule?.qualityDimensions.map((dimension) => ({
        id: dimension.id,
        maxScore: dimension.score,
        name: dimension.name
      })) ?? [],
    ruleId: rule?.id,
    scoreItemId: scoreItem?.id,
    scoreValue: scoreItem?.score,
    sourceMonth: getAcceptedMonth(task)
  };
}

export function getTaskClientFeedbackRows(task: StoreTaskRecord, clientFeedbackRows: ClientFeedbackRecord[]) {
  return clientFeedbackRows
    .filter((record) => record.taskId === task.id)
    .sort((left, right) => right.feedbackAt.localeCompare(left.feedbackAt) || right.updatedAt.localeCompare(left.updatedAt));
}

export function isAcceptanceFeedbackReady(draft: AcceptanceFeedbackDraft | undefined) {
  return Boolean(draft?.feedbackAt && draft.feedbackBy.trim() && draft.channel && draft.content.trim());
}

export function getAcceptanceBlockers(task: StoreTaskRecord, draft: AcceptanceScoringDraft | undefined) {
  const blockers: string[] = [];

  if (!task.acceptorName?.trim()) {
    blockers.push('验收人');
  }

  if (!task.submittedAt) {
    blockers.push('提交时间');
  }

  if (!task.files.some((file) => file.stage === '交付文件')) {
    blockers.push('交付文件');
  }

  if (!draft?.ruleId || !draft.scoreItemId || typeof draft.scoreValue !== 'number') {
    blockers.push('绩效计分项');
  }

  if (!draft?.sourceMonth) {
    blockers.push('归属月份');
  }

  if (!draft?.dimensionScores.length || !getCompletedDimensionScores(draft)) {
    blockers.push('质量评分');
  }

  return blockers;
}

export function getReworkBlockers(reason: string, requirement: string, hasClientFeedback: boolean) {
  const blockers: string[] = [];

  if (!hasClientFeedback) {
    blockers.push('甲方反馈');
  }

  if (!reason.trim()) {
    blockers.push('驳回原因');
  }

  if (!requirement.trim()) {
    blockers.push('整改要求');
  }

  return blockers;
}

export function buildTaskPerformanceScoringRecord(
  task: StoreTaskRecord,
  draft: AcceptanceScoringDraft,
  performanceRuleRows: PerformanceRulePreset[]
): TaskPerformanceScoringRecord {
  const rule = performanceRuleRows.find((item) => item.id === draft.ruleId);
  const scoreItem = rule?.taskScoreItems.find((item) => item.id === draft.scoreItemId);
  const dimensionScores = getCompletedDimensionScores(draft) ?? [];
  const qualityScore = getQualityScore(dimensionScores, rule?.qualityDimensions ?? []);
  const qualityBand = getQualityBand(rule, qualityScore);

  return {
    adjustmentReason: draft.adjustmentReason.trim(),
    confirmedAt: taskManagementNow,
    confirmedBy: task.acceptorName || '李明',
    id: `score-${task.id}`,
    operationRecords: [
      {
        action: '验收计分',
        actor: task.acceptorName || '李明',
        id: `op-score-${task.id}-${taskManagementNow}`.replace(/\s+/g, '-'),
        object: task.name,
        summary: `${rule?.name ?? '绩效规则'} / ${scoreItem?.name ?? '计分项'} / 质量分 ${formatScore(qualityScore)}`,
        time: taskManagementNow
      }
    ],
    performanceCategory: rule?.category,
    qualityBand: qualityBand?.scoreRange,
    qualityDimensionScores: dimensionScores,
    qualityScore,
    ruleId: rule?.id,
    ruleName: rule?.name,
    ruleVersion: rule?.currentVersion,
    scoreItemId: scoreItem?.id,
    scoreItemName: scoreItem?.name,
    scoreValue: draft.scoreValue,
    sourceMonth: draft.sourceMonth,
    status: '已计入',
    taskId: task.id,
    updatedAt: taskManagementNow
  };
}
