import type { UploadFile } from 'antd/es/upload/interface';
import { taskManagementNow, type StoreTaskFileRecord, type StoreTaskFileStage, type StoreTaskFileType, type StoreTaskRecord } from './TaskManagementState';
import type { TaskFileDraft } from './TaskFileDraftEditor';

export function normalizeCompletedTaskFileDrafts(drafts: TaskFileDraft[]) {
  return drafts
    .map((draft) => ({ ...draft, name: draft.name.trim(), url: draft.url.trim() }))
    .filter((draft) => draft.name && draft.url);
}

export function hasPartialTaskFileDraft(drafts: TaskFileDraft[]) {
  return drafts.some((draft) => Boolean(draft.name.trim()) !== Boolean(draft.url.trim()));
}

export function buildTaskFilesFromDrafts({
  drafts,
  idPrefix,
  registeredBy,
  stage,
  startIndex = 1,
  updatedAt = taskManagementNow
}: {
  drafts: TaskFileDraft[];
  idPrefix: string;
  registeredBy: string;
  stage: Extract<StoreTaskFileStage, '交付文件' | '原始资料'>;
  startIndex?: number;
  updatedAt?: string;
}): StoreTaskFileRecord[] {
  return normalizeCompletedTaskFileDrafts(drafts).map((draft, index) => ({
    id: `${idPrefix}-${startIndex + index}`,
    name: draft.name,
    registeredBy,
    source: '飞书云盘',
    stage,
    status: '已登记',
    type: draft.type,
    updatedAt,
    url: draft.url
  }));
}

export function buildUploadedTaskImageFiles({
  files,
  idPrefix,
  pathPrefix,
  registeredBy,
  stage,
  updatedAt = taskManagementNow
}: {
  files: UploadFile[];
  idPrefix: string;
  pathPrefix: string;
  registeredBy: string;
  stage: Extract<StoreTaskFileStage, '甲方反馈' | '问题截图'>;
  updatedAt?: string;
}): StoreTaskFileRecord[] {
  return files.map((file, index) => ({
    id: `${idPrefix}-${index + 1}`,
    name: file.name,
    registeredBy,
    source: '业务服务器',
    stage,
    status: '已上传',
    type: '图片' satisfies StoreTaskFileType,
    updatedAt,
    url: `${pathPrefix}/${encodeURIComponent(file.name)}`
  }));
}

export function buildClientFeedbackScreenshotFiles(files: UploadFile[], task: StoreTaskRecord) {
  return buildUploadedTaskImageFiles({
    files,
    idPrefix: `feedback-screenshot-${task.code.toLowerCase()}-${Date.now()}`,
    pathPrefix: `/uploads/tasks/${task.code}/client-feedback`,
    registeredBy: '李明',
    stage: '甲方反馈'
  });
}

export function buildTaskReworkScreenshotFiles(files: UploadFile[], task: StoreTaskRecord) {
  const reworkSequence = task.reworkCount + 1;

  return buildUploadedTaskImageFiles({
    files,
    idPrefix: `task-file-${task.code.toLowerCase()}-rework-${reworkSequence}`,
    pathPrefix: `/uploads/tasks/${task.code}/rework-${reworkSequence}`,
    registeredBy: task.acceptorName || '李明',
    stage: '问题截图'
  });
}
