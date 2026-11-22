import type { StoreTaskFileRecord, StoreTaskRecord } from './TaskManagementState';

export function buildTaskAcceptanceArchiveFile({
  acceptedAt,
  acceptedBy,
  task
}: {
  acceptedAt: string;
  acceptedBy: string;
  task: Pick<StoreTaskRecord, 'code' | 'id'>;
}): StoreTaskFileRecord {
  const acceptedDate = acceptedAt.slice(0, 10);

  return {
    id: `task-acceptance-archive-${task.id}`,
    name: `${task.code} 任务验收记录.pdf`,
    registeredBy: acceptedBy,
    source: '业务服务器',
    stage: '验收归档',
    status: '已生成',
    type: '验收记录',
    updatedAt: acceptedAt,
    url: `/records/tasks/${encodeURIComponent(task.code)}/acceptance/${acceptedDate}.pdf`
  };
}

export function ensureTaskAcceptanceArchive(
  task: StoreTaskRecord,
  acceptedAt: string,
  acceptedBy: string
): StoreTaskRecord {
  const archiveFile = buildTaskAcceptanceArchiveFile({ acceptedAt, acceptedBy, task });
  const files = task.files.some((file) => file.id === archiveFile.id)
    ? task.files.map((file) => (file.id === archiveFile.id ? archiveFile : file))
    : [...task.files, archiveFile];

  return { ...task, files };
}
