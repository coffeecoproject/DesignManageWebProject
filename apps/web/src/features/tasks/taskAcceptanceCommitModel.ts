import type {
  StoreTaskRecord,
  TaskAcceptanceCommitInput,
  TaskPerformanceScoringRecord
} from './TaskManagementState';
import type { PartTimeLaborAcceptanceRecord } from './partTimeLaborSettlementModel';
import {
  buildCustomerTaskBillingFact,
  reverseCustomerTaskBillingFact,
  type CustomerTaskBillingFact
} from './taskCustomerBillingModel';
import { appendTaskOperation } from './taskOperationModel';

export type TaskAcceptanceReversalInput = {
  actor: string;
  occurredAt: string;
  reason: string;
  taskId: string;
};

export type TaskWorkflowState = {
  customerTaskBillingFacts: CustomerTaskBillingFact[];
  partTimeLaborAcceptanceRows: PartTimeLaborAcceptanceRecord[];
  storeTaskRows: StoreTaskRecord[];
  taskPerformanceScoringRows: TaskPerformanceScoringRecord[];
};

export type TaskAcceptanceCommitValidation =
  | { success: true }
  | {
      code: 'CUSTOMER_BILLING_FACT_MISSING';
      message: string;
      success: false;
    };

function upsertById<T extends { id: string }>(rows: readonly T[], record: T) {
  return rows.some((row) => row.id === record.id)
    ? rows.map((row) => (row.id === record.id ? record : row))
    : [record, ...rows];
}

export function validateTaskAcceptanceCommit(input: TaskAcceptanceCommitInput): TaskAcceptanceCommitValidation {
  return buildCustomerTaskBillingFact(input.task)
    ? { success: true }
    : {
        code: 'CUSTOMER_BILLING_FACT_MISSING',
        message: '当前任务缺少有效客户结算快照，无法完成验收',
        success: false
      };
}

export function applyTaskAcceptanceCommit(
  currentState: TaskWorkflowState,
  input: TaskAcceptanceCommitInput
): TaskWorkflowState {
  const billingFact = buildCustomerTaskBillingFact(input.task);

  if (!billingFact) {
    throw new Error('当前任务缺少有效客户结算快照，无法完成验收');
  }

  return {
    customerTaskBillingFacts: !currentState.customerTaskBillingFacts.some((fact) => fact.id === billingFact.id)
      ? [billingFact, ...currentState.customerTaskBillingFacts]
      : currentState.customerTaskBillingFacts,
    partTimeLaborAcceptanceRows: input.laborAcceptance
      ? upsertById(currentState.partTimeLaborAcceptanceRows, input.laborAcceptance)
      : currentState.partTimeLaborAcceptanceRows,
    storeTaskRows: upsertById(currentState.storeTaskRows, input.task),
    taskPerformanceScoringRows: upsertById(currentState.taskPerformanceScoringRows, input.scoringRecord)
  };
}

export function applyTaskAcceptanceReversal(
  currentState: TaskWorkflowState,
  input: TaskAcceptanceReversalInput
): TaskWorkflowState {
  const task = currentState.storeTaskRows.find((record) => record.id === input.taskId);
  const billingFact = currentState.customerTaskBillingFacts.find((fact) => fact.taskId === input.taskId);

  if (!task || task.status !== '已完成' || !billingFact) {
    throw new Error('当前任务没有可撤销的验收结果');
  }

  const nextTask = appendTaskOperation(
    {
      ...task,
      acceptedAt: undefined,
      files: task.files.map((file) =>
        file.stage === '验收归档' ? { ...file, status: '已作废', updatedAt: input.occurredAt } : file
      ),
      status: '待验收'
    },
    '撤销验收',
    input.reason.trim(),
    input.actor,
    input.occurredAt
  );

  return {
    customerTaskBillingFacts: currentState.customerTaskBillingFacts.map((fact) =>
      fact.id === billingFact.id ? reverseCustomerTaskBillingFact(fact, input) : fact
    ),
    partTimeLaborAcceptanceRows: currentState.partTimeLaborAcceptanceRows.map((record) =>
      record.taskId === input.taskId
        ? {
            ...record,
            reversedAt: input.occurredAt,
            reversedBy: input.actor,
            reversalReason: input.reason.trim()
          }
        : record
    ),
    storeTaskRows: currentState.storeTaskRows.map((record) =>
      record.id === input.taskId ? nextTask : record
    ),
    taskPerformanceScoringRows: currentState.taskPerformanceScoringRows.map((record) =>
      record.taskId === input.taskId
        ? {
            ...record,
            adjustmentReason: input.reason.trim(),
            confirmedAt: undefined,
            confirmedBy: undefined,
            status: '不计入',
            updatedAt: input.occurredAt
          }
        : record
    )
  };
}
