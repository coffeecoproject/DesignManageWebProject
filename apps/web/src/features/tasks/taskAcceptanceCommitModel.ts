import type {
  StoreTaskRecord,
  TaskAcceptanceCommitInput,
  TaskPerformanceScoringRecord
} from './TaskManagementState';
import type { PartTimeLaborAcceptanceRecord } from './partTimeLaborSettlementModel';

export type TaskWorkflowState = {
  partTimeLaborAcceptanceRows: PartTimeLaborAcceptanceRecord[];
  storeTaskRows: StoreTaskRecord[];
  taskPerformanceScoringRows: TaskPerformanceScoringRecord[];
};

function upsertById<T extends { id: string }>(rows: readonly T[], record: T) {
  return rows.some((row) => row.id === record.id)
    ? rows.map((row) => (row.id === record.id ? record : row))
    : [record, ...rows];
}

export function applyTaskAcceptanceCommit(
  currentState: TaskWorkflowState,
  input: TaskAcceptanceCommitInput
): TaskWorkflowState {
  return {
    partTimeLaborAcceptanceRows: input.laborAcceptance
      ? upsertById(currentState.partTimeLaborAcceptanceRows, input.laborAcceptance)
      : currentState.partTimeLaborAcceptanceRows,
    storeTaskRows: upsertById(currentState.storeTaskRows, input.task),
    taskPerformanceScoringRows: upsertById(currentState.taskPerformanceScoringRows, input.scoringRecord)
  };
}
