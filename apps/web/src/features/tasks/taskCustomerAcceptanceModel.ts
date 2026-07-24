import type { StoreTaskRecord } from './TaskManagementState';
import {
  calculateBrandAcceptance,
  type BrandAcceptanceTimelinessResult
} from '../customers/brandAcceptancePolicyModel';

export type CustomerTaskAcceptanceRecord = {
  acceptedOn: string;
  correctionReason?: string;
  deductionAmount: number;
  deductionRate: number;
  finalAmount: number;
  id: string;
  recordedAt: string;
  recordedBy: string;
  remark: string;
  score: number;
  qualityPenaltyPoints: number;
  standardAmount: number;
  taskId: string;
  timelinessPenaltyPoints: number;
  timelinessResult: BrandAcceptanceTimelinessResult;
  totalPenaltyPoints: number;
  updatedAt: string;
  updatedBy: string;
};

export type CustomerTaskAcceptanceInput = {
  acceptedOn: string;
  correctionReason: string;
  remark: string;
  score: number | null;
  timelinessResult: BrandAcceptanceTimelinessResult | null;
};

export type CustomerTaskAcceptanceStatus = '不适用' | '待录入' | '已完成';

function hasCustomerTaskAcceptanceChanged(
  current: CustomerTaskAcceptanceRecord,
  input: CustomerTaskAcceptanceInput
) {
  return current.acceptedOn !== input.acceptedOn
    || current.score !== input.score
    || current.timelinessResult !== input.timelinessResult
    || current.remark !== input.remark.trim();
}

export function getCustomerTaskAcceptanceStatus(
  task: Pick<StoreTaskRecord, 'customerAcceptance' | 'customerBillingSnapshot' | 'status'>
): CustomerTaskAcceptanceStatus {
  if (task.status !== '已完成' || !task.customerBillingSnapshot?.billable) {
    return '不适用';
  }

  return task.customerAcceptance ? '已完成' : '待录入';
}

export function getCustomerTaskAcceptanceValidationMessage(
  task: Pick<StoreTaskRecord, 'acceptedAt' | 'customerAcceptance' | 'customerBillingSnapshot' | 'status'>,
  input: CustomerTaskAcceptanceInput
) {
  if (task.status !== '已完成') {
    return '内部验收完成后才能录入甲方验收';
  }
  if (!task.customerBillingSnapshot?.billable) {
    return '当前任务不参与客户结算';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.acceptedOn)) {
    return '请选择甲方验收日期';
  }
  if (task.acceptedAt && input.acceptedOn < task.acceptedAt.slice(0, 10)) {
    return '甲方验收日期不能早于内部验收日期';
  }
  if (typeof input.score !== 'number' || !Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    return '甲方评分需为 0 至 100 分';
  }
  if (!input.timelinessResult) {
    return '请选择时效结果';
  }
  if (task.customerAcceptance) {
    if (!hasCustomerTaskAcceptanceChanged(task.customerAcceptance, input)) {
      return '甲方验收结果未发生变化';
    }
    if (!input.correctionReason.trim()) {
      return '请填写更正原因';
    }
  }
  const calculation = calculateBrandAcceptance({
    policy: task.customerBillingSnapshot.acceptancePolicy,
    score: input.score,
    standardAmount: task.customerBillingSnapshot.unitPrice,
    timelinessResult: input.timelinessResult
  });
  if ((calculation.totalPenaltyPoints > 0 || input.timelinessResult === '不计时') && !input.remark.trim()) {
    return '存在扣罚或不计时时备注必填';
  }

  return '';
}

export function applyCustomerTaskAcceptance(
  task: StoreTaskRecord,
  input: CustomerTaskAcceptanceInput,
  context: { actor: string; occurredAt: string }
): StoreTaskRecord {
  const validationMessage = getCustomerTaskAcceptanceValidationMessage(task, input);
  if (validationMessage) {
    throw new Error(validationMessage);
  }
  if (input.acceptedOn > context.occurredAt.slice(0, 10)) {
    throw new Error('甲方验收日期不能晚于当前日期');
  }

  const isCorrection = Boolean(task.customerAcceptance);
  const previousAcceptance = task.customerAcceptance;
  const snapshot = task.customerBillingSnapshot!;
  const calculation = calculateBrandAcceptance({
    policy: snapshot.acceptancePolicy,
    score: input.score!,
    standardAmount: snapshot.unitPrice,
    timelinessResult: input.timelinessResult!
  });
  const customerAcceptance: CustomerTaskAcceptanceRecord = {
    acceptedOn: input.acceptedOn,
    correctionReason: isCorrection ? input.correctionReason.trim() : undefined,
    deductionAmount: calculation.deductionAmount,
    deductionRate: calculation.deductionRate,
    finalAmount: calculation.finalAmount,
    id: `${task.id}/customer-acceptance`,
    recordedAt: previousAcceptance?.recordedAt ?? context.occurredAt,
    recordedBy: previousAcceptance?.recordedBy ?? context.actor,
    remark: input.remark.trim(),
    score: input.score!,
    qualityPenaltyPoints: calculation.qualityPenaltyPoints,
    standardAmount: calculation.standardAmount,
    taskId: task.id,
    timelinessPenaltyPoints: calculation.timelinessPenaltyPoints,
    timelinessResult: input.timelinessResult!,
    totalPenaltyPoints: calculation.totalPenaltyPoints,
    updatedAt: context.occurredAt,
    updatedBy: context.actor
  };
  const previousSummary = previousAcceptance
    ? `日期 ${previousAcceptance.acceptedOn}、评分 ${previousAcceptance.score} 分、${previousAcceptance.timelinessResult}、扣款 ${previousAcceptance.deductionAmount.toFixed(2)} 元`
    : '';
  const currentSummary = `日期 ${customerAcceptance.acceptedOn}、评分 ${customerAcceptance.score} 分、${customerAcceptance.timelinessResult}、扣款 ${customerAcceptance.deductionAmount.toFixed(2)} 元`;
  const operation = {
    action: isCorrection ? '更正甲方验收' : '录入甲方验收',
    actor: context.actor,
    id: `op-${task.id}-${task.operationRecords.length + 1}`,
    object: task.name,
    summary: isCorrection
      ? `甲方验收由“${previousSummary}”更正为“${currentSummary}”；原因：${customerAcceptance.correctionReason}`
      : `甲方验收 ${currentSummary}`,
    time: context.occurredAt
  };

  return {
    ...task,
    customerAcceptance,
    operationRecords: [operation, ...task.operationRecords],
    updatedAt: context.occurredAt
  };
}
