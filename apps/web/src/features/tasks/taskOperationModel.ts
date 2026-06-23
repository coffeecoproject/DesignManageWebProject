import type { OperationRecord } from '../../components/OperationRecordTable';
import { taskManagementNow, type StoreTaskRecord } from './TaskManagementState';

export function buildTaskOperationRecord({
  action,
  actor = '李明',
  object,
  recordId,
  sequence,
  summary,
  time = taskManagementNow
}: {
  action: string;
  actor?: string;
  object: string;
  recordId: string;
  sequence: number;
  summary: string;
  time?: string;
}): OperationRecord {
  return {
    action,
    actor,
    id: `op-${recordId}-${sequence}`,
    object,
    summary,
    time
  };
}

export function appendTaskOperation(record: StoreTaskRecord, action: string, summary: string, actor = '李明', time = taskManagementNow): StoreTaskRecord {
  const operation = buildTaskOperationRecord({
    action,
    actor,
    object: record.name,
    recordId: record.id,
    sequence: record.operationRecords.length + 1,
    summary,
    time
  });

  return {
    ...record,
    operationRecords: [operation, ...record.operationRecords],
    updatedAt: time
  };
}
