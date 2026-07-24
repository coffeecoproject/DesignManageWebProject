import type { StatusTagTone } from '../../components/Detail';
import type { StoreRecord } from '../customers/customerData';
import { isTaskHourBefore, taskManagementNow, type StoreTaskFileStage, type StoreTaskRecord, type StoreTaskStatus } from './TaskManagementState';

export type TaskDeadlineState = '已中止' | '已关闭' | '逾期' | '未逾期';

export const taskStatusTone: Record<StoreTaskStatus, StatusTagTone> = {
  已中止: 'gray',
  已完成: 'green',
  待验收: 'amber',
  进行中: 'blue',
  验收驳回: 'red'
};

export const taskFileStageTone: Record<StoreTaskFileStage, StatusTagTone> = {
  交付文件: 'blue',
  其他附件: 'gray',
  甲方反馈: 'purple',
  问题截图: 'red',
  原始资料: 'amber',
  验收归档: 'green'
};

const closedTaskStatuses = new Set<StoreTaskStatus>(['已完成', '已中止']);

export function isTaskClosed(record: StoreTaskRecord) {
  return closedTaskStatuses.has(record.status);
}

export function isTaskOverdue(record: StoreTaskRecord, now = taskManagementNow) {
  return !isTaskClosed(record) && isTaskHourBefore(record.plannedDeliveryAt, now);
}

export function getTaskDeadlineState(record: StoreTaskRecord, now = taskManagementNow): TaskDeadlineState {
  if (record.status === '已中止') {
    return '已中止';
  }

  if (record.status === '已完成') {
    return '已关闭';
  }

  return isTaskOverdue(record, now) ? '逾期' : '未逾期';
}

export function getTaskTypeName(task: Pick<StoreTaskRecord, 'taskDefinitionSnapshot'>) {
  return task.taskDefinitionSnapshot.name;
}

export function getTaskStoreContext(storeRows: Pick<StoreRecord, 'city' | 'id' | 'name' | 'province'>[], storeId: string) {
  const store = storeRows.find((item) => item.id === storeId);

  return {
    city: store?.city ?? '',
    name: store?.name ?? '-',
    region: store ? `${store.province} / ${store.city}` : '-',
    store,
    storeCityLabel: store ? `${store.name} / ${store.city}` : '-'
  };
}

export function getTaskSearchText({
  acceptorName,
  brandName,
  code,
  customerName,
  executorName,
  name,
  storeCity,
  storeName,
  taskTypeName
}: {
  acceptorName?: string;
  brandName?: string;
  code: string;
  customerName?: string;
  executorName?: string;
  name: string;
  storeCity?: string;
  storeName?: string;
  taskTypeName?: string;
}) {
  return [code, name, executorName, acceptorName, customerName, brandName, storeName, storeCity, taskTypeName].join(' ');
}
