import { StatusTag } from '../../../components/Detail';
import type { StoreTaskFileStage, StoreTaskRecord, StoreTaskStatus } from '../TaskManagementState';
import { getTaskDeadlineState, taskFileStageTone, taskStatusTone } from '../taskDisplayModel';

export function TaskStatusTag({ status }: { status: StoreTaskStatus }) {
  return <StatusTag toneMap={taskStatusTone} value={status} />;
}

export function TaskFileStageTag({ stage }: { stage: StoreTaskFileStage }) {
  return <StatusTag toneMap={taskFileStageTone} value={stage} />;
}

export function TaskDeadlineStatus({ task }: { task: StoreTaskRecord }) {
  const deadlineState = getTaskDeadlineState(task);

  if (deadlineState === '已中止') {
    return <TaskStatusTag status="已中止" />;
  }

  if (deadlineState === '逾期') {
    return <StatusTag tone="amber" value="逾期" />;
  }

  return <>{deadlineState}</>;
}
