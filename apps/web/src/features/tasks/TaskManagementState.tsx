import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type { OperationRecord } from '../../components/OperationRecordTable';

export type StoreTaskStatus = '进行中' | '待验收' | '验收驳回' | '已完成' | '已中止';
export type StoreTaskFileSource = '飞书云盘' | '业务服务器';
export type StoreTaskFileStage = '原始资料' | '交付文件' | '问题截图' | '甲方反馈' | '验收归档' | '其他附件';
export type StoreTaskFileType = 'CAD源文件' | 'PDF图纸' | '图片' | '压缩包' | '说明文件' | '验收记录';
export type ClientFeedbackChannel = '微信' | '电话' | '飞书' | '现场' | '邮件' | '其他';

export type StoreTaskFileRecord = RelatedFileRecord & {
  registeredBy: string;
  source: StoreTaskFileSource;
  stage: StoreTaskFileStage;
  type: StoreTaskFileType;
  url: string;
};

export type StoreTaskRecord = {
  id: string;
  code: string;
  customerId: string;
  brandId: string;
  storeId: string;
  taskConfigId: string;
  name: string;
  executorId?: string;
  executorName?: string;
  acceptorId: string;
  acceptorName: string;
  status: StoreTaskStatus;
  createdAt: string;
  plannedDurationHours: number;
  plannedDeliveryAt: string;
  submittedAt?: string;
  acceptedAt?: string;
  reworkCount: number;
  latestReworkReason?: string;
  latestReworkRequirement?: string;
  note: string;
  files: StoreTaskFileRecord[];
  operationRecords: OperationRecord[];
  updatedAt: string;
};

export type StoreTaskCreateInput = {
  brandId: string;
  customerId: string;
  files: StoreTaskFileRecord[];
  name: string;
  note: string;
  executorId?: string;
  executorName?: string;
  acceptorId: string;
  acceptorName: string;
  plannedDurationHours: number;
  plannedDeliveryAt: string;
  storeId: string;
  taskConfigId: string;
};

export type ClientFeedbackRecord = {
  id: string;
  code: string;
  taskId: string;
  customerId: string;
  brandId: string;
  storeId: string;
  feedbackAt: string;
  feedbackBy: string;
  feedbackRole: string;
  feedbackPhone: string;
  channel: ClientFeedbackChannel;
  summary: string;
  content: string;
  files: StoreTaskFileRecord[];
  recorder: string;
  createdAt: string;
  updatedAt: string;
  operationRecords: OperationRecord[];
};

export type TaskPerformanceScoringStatus = '已计入' | '不计入';

export type TaskPerformanceDimensionScore = {
  id: string;
  maxScore: number;
  name: string;
  score: number;
};

export type TaskPerformanceScoringRecord = {
  id: string;
  taskId: string;
  status: TaskPerformanceScoringStatus;
  performanceCategory?: string;
  ruleId?: string;
  ruleName?: string;
  ruleVersion?: string;
  scoreItemId?: string;
  scoreItemName?: string;
  scoreValue?: number;
  qualityBand?: string;
  qualityDimensionScores: TaskPerformanceDimensionScore[];
  qualityScore: number;
  sourceMonth: string;
  adjustmentReason: string;
  confirmedBy?: string;
  confirmedAt?: string;
  operationRecords: OperationRecord[];
  updatedAt: string;
};

export type ClientFeedbackCreateInput = {
  taskId: string;
  customerId: string;
  brandId: string;
  storeId: string;
  feedbackAt: string;
  feedbackBy: string;
  feedbackRole: string;
  feedbackPhone: string;
  channel: ClientFeedbackChannel;
  content: string;
  files: StoreTaskFileRecord[];
};

type TaskManagementStateValue = {
  clientFeedbackRows: ClientFeedbackRecord[];
  createClientFeedback: (input: ClientFeedbackCreateInput) => ClientFeedbackRecord;
  createStoreTask: (input: StoreTaskCreateInput) => StoreTaskRecord;
  saveClientFeedback: (record: ClientFeedbackRecord) => void;
  saveTaskPerformanceScoring: (record: TaskPerformanceScoringRecord) => void;
  saveStoreTask: (record: StoreTaskRecord) => void;
  taskPerformanceScoringRows: TaskPerformanceScoringRecord[];
  storeTaskRows: StoreTaskRecord[];
};

export const taskManagementToday = '2026-06-15';
export const taskDateTimeFormat = 'YYYY-MM-DD HH:mm';
export const taskManagementNow = `${taskManagementToday} 10:00`;

export function normalizeTaskHourText(value: string | undefined, fallbackHour = 18) {
  if (!value) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value} ${String(fallbackHour).padStart(2, '0')}:00`;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2})(?::\d{1,2})?/);
  if (match) {
    return `${match[1]} ${match[2].padStart(2, '0')}:00`;
  }

  return value;
}

export function isTaskHourBefore(leftDateText: string, rightDateText: string) {
  return normalizeTaskHourText(leftDateText) < normalizeTaskHourText(rightDateText, 10);
}

function formatTaskDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatTaskHour(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');

  return `${formatTaskDate(date)} ${hour}:00`;
}

export function formatTaskDuration(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '-';
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days === 0) {
    return `${hours} 小时`;
  }

  if (remainingHours === 0) {
    return `${days} 天`;
  }

  return `${days} 天 ${remainingHours} 小时`;
}

const seedStoreTaskRows: StoreTaskRecord[] = [
  {
    acceptedAt: undefined,
    acceptorId: '20250018',
    acceptorName: '示例全职 B',
    brandId: 'brand-starry-space',
    code: 'TASK-2026-001',
    createdAt: '2026-06-09 10:00',
    customerId: 'customer-starry',
    files: [
      {
        id: 'task-file-2026-001-delivery',
        name: '武汉光谷店全套施工图.zip',
        registeredBy: '示例全职 A',
        source: '飞书云盘',
        stage: '交付文件',
        status: '已登记',
        type: '压缩包',
        updatedAt: '2026-06-14 17:00',
        url: 'https://starry.feishu.cn/drive/folder/task-2026-001-delivery'
      },
      {
        id: 'task-file-2026-001-source',
        name: '客户原始平面资料.pdf',
        registeredBy: '李明',
        source: '飞书云盘',
        stage: '原始资料',
        status: '已登记',
        type: 'PDF图纸',
        updatedAt: '2026-06-09 10:00',
        url: 'https://starry.feishu.cn/drive/file/task-2026-001-source'
      }
    ],
    id: 'store-task-2026-001',
    name: '武汉光谷店全套施工图交付',
    note: '按品牌当前交付标准执行，待客户验收。',
    operationRecords: [
      {
        id: 'op-task-2026-001-submit',
        action: '提交交付',
        actor: '示例全职 A',
        object: '武汉光谷店全套施工图交付',
        summary: '登记施工图飞书链接并提交验收',
        time: '2026-06-14 17:40'
      },
      {
        id: 'op-task-2026-001-create',
        action: '创建任务',
        actor: '李明',
        object: '武汉光谷店全套施工图交付',
        summary: '创建任务并分配执行人',
        time: '2026-06-09 10:20'
      }
    ],
    executorId: '20260001',
    executorName: '示例全职 A',
    plannedDurationHours: 128,
    plannedDeliveryAt: '2026-06-14 18:00',
    reworkCount: 0,
    status: '待验收',
    storeId: 'store-wh-optics',
    submittedAt: '2026-06-14 17:00',
    taskConfigId: 'task-type-full-drawing',
    updatedAt: '2026-06-14 17:00'
  },
  {
    brandId: 'brand-starry-space',
    code: 'TASK-2026-002',
    createdAt: '2026-06-12 09:00',
    customerId: 'customer-starry',
    files: [
      {
        id: 'task-file-2026-002-source',
        name: '汉口店照片资料.zip',
        registeredBy: '李明',
        source: '飞书云盘',
        stage: '原始资料',
        status: '已登记',
        type: '压缩包',
        updatedAt: '2026-06-12 09:00',
        url: 'https://starry.feishu.cn/drive/folder/task-2026-002-source'
      }
    ],
    id: 'store-task-2026-002',
    name: '武汉汉口店门店P图',
    note: '客户提供门店现场照片，需要快速出图。',
    operationRecords: [
      {
        id: 'op-task-2026-002-create',
        action: '创建任务',
        actor: '李明',
        object: '武汉汉口店门店P图',
        summary: '创建门店P图任务',
        time: '2026-06-12 09:15'
      }
    ],
    acceptorId: '20260001',
    acceptorName: '示例全职 A',
    executorId: '20260006',
    executorName: '示例兼职 B',
    plannedDurationHours: 57,
    plannedDeliveryAt: '2026-06-14 18:00',
    reworkCount: 0,
    status: '进行中',
    storeId: 'store-wh-hankou',
    taskConfigId: 'task-type-store-image',
    updatedAt: '2026-06-12 09:00'
  },
  {
    brandId: 'brand-nova-tea',
    code: 'TASK-2026-003',
    createdAt: '2026-06-08 10:00',
    customerId: 'customer-nova',
    files: [
      {
        id: 'task-file-2026-003-delivery',
        name: '长沙岳麓首店平面方案-v1.pdf',
        registeredBy: '示例全职 B',
        source: '飞书云盘',
        stage: '交付文件',
        status: '已登记',
        type: 'PDF图纸',
        updatedAt: '2026-06-11 18:00',
        url: 'https://nova.feishu.cn/drive/file/task-2026-003-delivery-v1'
      }
    ],
    id: 'store-task-2026-003',
    latestReworkReason: '收银区动线与甲方反馈不一致。',
    latestReworkRequirement: '按甲方反馈调整收银区动线，并重新提交平面方案文件。',
    name: '长沙岳麓首店平面方案',
    note: '首店模型确认任务，验收要求修改后需再次提交。',
    operationRecords: [
      {
        id: 'op-task-2026-003-rework',
        action: '验收驳回',
        actor: '李明',
        object: '长沙岳麓首店平面方案',
        summary: '验收驳回：收银区动线与甲方反馈不一致；按反馈调整后重新提交',
        time: '2026-06-12 15:30'
      },
      {
        id: 'op-task-2026-003-submit',
        action: '提交交付',
        actor: '示例全职 B',
        object: '长沙岳麓首店平面方案',
        summary: '提交首版平面方案',
        time: '2026-06-11 18:10'
      }
    ],
    acceptorId: '20260001',
    acceptorName: '示例全职 A',
    executorId: '20250018',
    executorName: '示例全职 B',
    plannedDurationHours: 80,
    plannedDeliveryAt: '2026-06-11 18:00',
    reworkCount: 1,
    status: '验收驳回',
    storeId: 'store-cs-yuelu',
    submittedAt: '2026-06-11 18:00',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-12 15:00'
  },
  {
    acceptedAt: '2026-06-10 16:00',
    acceptorId: '20260001',
    acceptorName: '李明',
    brandId: 'brand-starry-space',
    code: 'TASK-2026-004',
    createdAt: '2026-06-06 10:00',
    customerId: 'customer-starry',
    files: [
      {
        id: 'task-file-2026-004-delivery',
        name: '星际轻装门店快图交付.zip',
        registeredBy: '示例兼职 B',
        source: '飞书云盘',
        stage: '交付文件',
        status: '已登记',
        type: '压缩包',
        updatedAt: '2026-06-10 15:00',
        url: 'https://starry.feishu.cn/drive/folder/task-2026-004-delivery'
      }
    ],
    id: 'store-task-2026-004',
    latestReworkReason: '门店照片裁切比例与甲方确认口径不一致。',
    latestReworkRequirement: '按甲方确认比例重新导出快图，并保留调整说明。',
    name: '星际轻装门店快图交付',
    note: '验收通过，后续可进入绩效汇总。',
    operationRecords: [
      {
        id: 'op-task-2026-004-accept',
        action: '验收通过',
        actor: '李明',
        object: '星际轻装门店快图交付',
        summary: '交付内容验收通过',
        time: '2026-06-10 16:00'
      },
      {
        id: 'op-task-2026-004-resubmit',
        action: '提交交付',
        actor: '示例兼职 B',
        object: '星际轻装门店快图交付',
        summary: '按驳回要求重新提交门店快图',
        time: '2026-06-10 15:00'
      },
      {
        id: 'op-task-2026-004-rework',
        action: '验收驳回',
        actor: '李明',
        object: '星际轻装门店快图交付',
        summary: '验收驳回：门店照片裁切比例与甲方确认口径不一致',
        time: '2026-06-10 11:30'
      }
    ],
    executorId: '20260006',
    executorName: '示例兼职 B',
    plannedDurationHours: 104,
    plannedDeliveryAt: '2026-06-10 18:00',
    reworkCount: 1,
    status: '已完成',
    storeId: 'store-wh-hankou',
    submittedAt: '2026-06-10 15:00',
    taskConfigId: 'task-type-store-image',
    updatedAt: '2026-06-10 16:00'
  },
  {
    acceptedAt: '2026-06-13 18:00',
    acceptorId: '20260001',
    acceptorName: '李明',
    brandId: 'brand-nova-tea',
    code: 'TASK-2026-006',
    createdAt: '2026-06-09 09:30',
    customerId: 'customer-nova',
    files: [
      {
        id: 'task-file-2026-006-delivery-v2',
        name: '长沙岳麓首店吧台深化图-v2.pdf',
        registeredBy: '示例全职 B',
        source: '飞书云盘',
        stage: '交付文件',
        status: '已登记',
        type: 'PDF图纸',
        updatedAt: '2026-06-13 17:20',
        url: 'https://nova.feishu.cn/drive/file/task-2026-006-delivery-v2'
      },
      {
        id: 'task-file-2026-006-archive',
        name: '吧台深化图验收归档.zip',
        registeredBy: '李明',
        source: '业务服务器',
        stage: '验收归档',
        status: '已上传',
        type: '压缩包',
        updatedAt: '2026-06-13 18:00',
        url: '/uploads/tasks/TASK-2026-006/archive/bar-detail.zip'
      }
    ],
    id: 'store-task-2026-006',
    latestReworkReason: '吧台给排水点位与甲方二次确认图不一致。',
    latestReworkRequirement: '按甲方二次确认图调整给排水点位，并补充变更说明。',
    name: '长沙岳麓首店吧台深化图归档',
    note: '存在两次内部驳回和两次甲方反馈，用于查看任务反馈完整链路。',
    operationRecords: [
      {
        id: 'op-task-2026-006-accept',
        action: '验收通过',
        actor: '李明',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '二次调整后的吧台深化图验收通过',
        time: '2026-06-13 18:00'
      },
      {
        id: 'op-task-2026-006-resubmit-v2',
        action: '提交交付',
        actor: '示例全职 B',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '按二次驳回要求补充点位变更说明并重新提交',
        time: '2026-06-13 17:20'
      },
      {
        id: 'op-task-2026-006-rework-v2',
        action: '验收驳回',
        actor: '李明',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '验收驳回：吧台给排水点位与甲方二次确认图不一致',
        time: '2026-06-13 14:40'
      },
      {
        id: 'op-task-2026-006-resubmit-v1',
        action: '提交交付',
        actor: '示例全职 B',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '提交吧台深化图首轮调整稿',
        time: '2026-06-12 18:20'
      },
      {
        id: 'op-task-2026-006-rework-v1',
        action: '验收驳回',
        actor: '李明',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '验收驳回：吧台正立面尺寸标注缺少复核依据',
        time: '2026-06-12 11:20'
      },
      {
        id: 'op-task-2026-006-create',
        action: '创建任务',
        actor: '李明',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '创建吧台深化图归档任务并分配执行人',
        time: '2026-06-09 09:40'
      }
    ],
    executorId: '20250018',
    executorName: '示例全职 B',
    plannedDurationHours: 104,
    plannedDeliveryAt: '2026-06-13 18:00',
    reworkCount: 2,
    status: '已完成',
    storeId: 'store-cs-yuelu',
    submittedAt: '2026-06-13 17:20',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-13 18:00'
  },
  {
    acceptedAt: '2026-06-08 17:30',
    acceptorId: '20260001',
    acceptorName: '李明',
    brandId: 'brand-starry-space',
    code: 'TASK-2026-007',
    createdAt: '2026-06-05 09:00',
    customerId: 'customer-starry',
    files: [
      {
        id: 'task-file-2026-007-delivery',
        name: '武汉汉口店灯光调整图.pdf',
        registeredBy: '示例兼职 B',
        source: '飞书云盘',
        stage: '交付文件',
        status: '已登记',
        type: 'PDF图纸',
        updatedAt: '2026-06-08 16:50',
        url: 'https://starry.feishu.cn/drive/file/task-2026-007-lighting'
      }
    ],
    id: 'store-task-2026-007',
    latestReworkReason: '灯带分区标注不完整。',
    latestReworkRequirement: '补充分区标注和控制回路说明后重新提交。',
    name: '武汉汉口店灯光调整图',
    note: '仅存在内部验收驳回，不存在甲方反馈。',
    operationRecords: [
      {
        id: 'op-task-2026-007-accept',
        action: '验收通过',
        actor: '李明',
        object: '武汉汉口店灯光调整图',
        summary: '补充分区标注后验收通过',
        time: '2026-06-08 17:30'
      },
      {
        id: 'op-task-2026-007-resubmit',
        action: '提交交付',
        actor: '示例兼职 B',
        object: '武汉汉口店灯光调整图',
        summary: '补充灯光控制回路说明后重新提交',
        time: '2026-06-08 16:50'
      },
      {
        id: 'op-task-2026-007-rework',
        action: '验收驳回',
        actor: '李明',
        object: '武汉汉口店灯光调整图',
        summary: '验收驳回：灯带分区标注不完整',
        time: '2026-06-08 10:30'
      },
      {
        id: 'op-task-2026-007-create',
        action: '创建任务',
        actor: '李明',
        object: '武汉汉口店灯光调整图',
        summary: '创建灯光调整图任务',
        time: '2026-06-05 09:20'
      }
    ],
    executorId: '20260006',
    executorName: '示例兼职 B',
    plannedDurationHours: 80,
    plannedDeliveryAt: '2026-06-08 18:00',
    reworkCount: 1,
    status: '已完成',
    storeId: 'store-wh-hankou',
    submittedAt: '2026-06-08 16:50',
    taskConfigId: 'task-type-store-image',
    updatedAt: '2026-06-08 17:30'
  },
  {
    acceptedAt: '2026-06-07 16:30',
    acceptorId: '20250018',
    acceptorName: '示例全职 B',
    brandId: 'brand-starry-space',
    code: 'TASK-2026-008',
    createdAt: '2026-06-04 10:00',
    customerId: 'customer-starry',
    files: [
      {
        id: 'task-file-2026-008-delivery',
        name: '武汉光谷店软装清单.xlsx',
        registeredBy: '示例全职 A',
        source: '飞书云盘',
        stage: '交付文件',
        status: '已登记',
        type: '说明文件',
        updatedAt: '2026-06-07 15:40',
        url: 'https://starry.feishu.cn/drive/file/task-2026-008-soft-decoration'
      }
    ],
    id: 'store-task-2026-008',
    name: '武汉光谷店软装清单核对',
    note: '内部验收一次通过，但存在甲方后续反馈。',
    operationRecords: [
      {
        id: 'op-task-2026-008-accept',
        action: '验收通过',
        actor: '示例全职 B',
        object: '武汉光谷店软装清单核对',
        summary: '软装清单核对完成并验收通过',
        time: '2026-06-07 16:30'
      },
      {
        id: 'op-task-2026-008-submit',
        action: '提交交付',
        actor: '示例全职 A',
        object: '武汉光谷店软装清单核对',
        summary: '提交软装清单核对结果',
        time: '2026-06-07 15:40'
      },
      {
        id: 'op-task-2026-008-create',
        action: '创建任务',
        actor: '李明',
        object: '武汉光谷店软装清单核对',
        summary: '创建软装清单核对任务',
        time: '2026-06-04 10:15'
      }
    ],
    executorId: '20260001',
    executorName: '示例全职 A',
    plannedDurationHours: 80,
    plannedDeliveryAt: '2026-06-07 18:00',
    reworkCount: 0,
    status: '已完成',
    storeId: 'store-wh-optics',
    submittedAt: '2026-06-07 15:40',
    taskConfigId: 'task-type-full-drawing',
    updatedAt: '2026-06-07 16:30'
  },
  {
    brandId: 'brand-starry-space',
    code: 'TASK-2026-005',
    createdAt: '2026-06-15 09:00',
    customerId: 'customer-starry',
    files: [],
    id: 'store-task-2026-005',
    name: '武汉汉口店门店P图优化',
    note: '新增任务必须明确执行人与验收人。',
    operationRecords: [
      {
        id: 'op-task-2026-005-create',
        action: '创建任务',
        actor: '李明',
        object: '武汉汉口店门店P图优化',
        summary: '创建任务并分配执行人与验收人',
        time: '2026-06-15 09:30'
      }
    ],
    acceptorId: '20260001',
    acceptorName: '示例全职 A',
    executorId: '20260006',
    executorName: '示例兼职 B',
    plannedDurationHours: 105,
    plannedDeliveryAt: '2026-06-19 18:00',
    reworkCount: 0,
    status: '进行中',
    storeId: 'store-wh-hankou',
    taskConfigId: 'task-type-store-image',
    updatedAt: '2026-06-15 09:00'
  }
];

const seedClientFeedbackRows: ClientFeedbackRecord[] = [
  {
    brandId: 'brand-starry-space',
    channel: '电话',
    code: 'FB-2026-003',
    content: '甲方确认门店快图裁切比例需要与招商物料保持一致，要求保留调整前后对比截图。',
    createdAt: '2026-06-10 11:10',
    customerId: 'customer-starry',
    feedbackAt: '2026-06-10 10:50',
    feedbackBy: '周岚',
    feedbackPhone: '13800006601',
    feedbackRole: '工程负责人',
    files: [
      {
        id: 'feedback-file-2026-003-screenshot',
        name: '门店快图裁切比例反馈.png',
        registeredBy: '李明',
        source: '业务服务器',
        stage: '甲方反馈',
        status: '已上传',
        type: '图片',
        updatedAt: '2026-06-10 11:10',
        url: '/uploads/tasks/TASK-2026-004/client-feedback/crop-ratio.png'
      }
    ],
    id: 'client-feedback-2026-003',
    operationRecords: [
      {
        id: 'op-client-feedback-2026-003-create',
        action: '登记甲方反馈',
        actor: '李明',
        object: '星际轻装门店快图交付',
        summary: '登记门店快图裁切比例反馈并上传截图',
        time: '2026-06-10 11:10'
      }
    ],
    recorder: '李明',
    storeId: 'store-wh-hankou',
    summary: '门店快图裁切比例需按招商物料调整',
    taskId: 'store-task-2026-004',
    updatedAt: '2026-06-10 11:10'
  },
  {
    brandId: 'brand-nova-tea',
    channel: '现场',
    code: 'FB-2026-004',
    content: '现场复核时确认吧台正立面尺寸需要按施工队复测值修正，同时要求保留尺寸复核照片。',
    createdAt: '2026-06-12 10:20',
    customerId: 'customer-nova',
    feedbackAt: '2026-06-12 10:00',
    feedbackBy: '陈思',
    feedbackPhone: '13800006602',
    feedbackRole: '品牌运营',
    files: [
      {
        id: 'feedback-file-2026-004-photo',
        name: '吧台正立面尺寸复核照片.png',
        registeredBy: '李明',
        source: '业务服务器',
        stage: '甲方反馈',
        status: '已上传',
        type: '图片',
        updatedAt: '2026-06-12 10:20',
        url: '/uploads/tasks/TASK-2026-006/client-feedback/bar-elevation-size.png'
      }
    ],
    id: 'client-feedback-2026-004',
    operationRecords: [
      {
        id: 'op-client-feedback-2026-004-create',
        action: '登记甲方反馈',
        actor: '李明',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '登记吧台正立面尺寸复核反馈并上传现场照片',
        time: '2026-06-12 10:20'
      }
    ],
    recorder: '李明',
    storeId: 'store-cs-yuelu',
    summary: '吧台正立面尺寸按现场复测值修正',
    taskId: 'store-task-2026-006',
    updatedAt: '2026-06-12 10:20'
  },
  {
    brandId: 'brand-nova-tea',
    channel: '邮件',
    code: 'FB-2026-005',
    content: '甲方通过邮件确认给排水点位以二次确认图为准，要求在交付文件中补充变更说明。',
    createdAt: '2026-06-13 13:35',
    customerId: 'customer-nova',
    feedbackAt: '2026-06-13 13:20',
    feedbackBy: '陈思',
    feedbackPhone: '13800006602',
    feedbackRole: '品牌运营',
    files: [
      {
        id: 'feedback-file-2026-005-mail',
        name: '给排水点位邮件确认.pdf',
        registeredBy: '李明',
        source: '业务服务器',
        stage: '甲方反馈',
        status: '已上传',
        type: 'PDF图纸',
        updatedAt: '2026-06-13 13:35',
        url: '/uploads/tasks/TASK-2026-006/client-feedback/plumbing-mail-confirm.pdf'
      }
    ],
    id: 'client-feedback-2026-005',
    operationRecords: [
      {
        id: 'op-client-feedback-2026-005-create',
        action: '登记甲方反馈',
        actor: '李明',
        object: '长沙岳麓首店吧台深化图归档',
        summary: '登记给排水点位邮件确认并上传附件',
        time: '2026-06-13 13:35'
      }
    ],
    recorder: '李明',
    storeId: 'store-cs-yuelu',
    summary: '给排水点位按二次确认图调整',
    taskId: 'store-task-2026-006',
    updatedAt: '2026-06-13 13:35'
  },
  {
    brandId: 'brand-starry-space',
    channel: '微信',
    code: 'FB-2026-006',
    content: '甲方核对软装清单后补充灯具型号要求，内部验收已经通过，此反馈仅用于任务归档和后续复盘。',
    createdAt: '2026-06-07 14:20',
    customerId: 'customer-starry',
    feedbackAt: '2026-06-07 14:00',
    feedbackBy: '周岚',
    feedbackPhone: '13800006601',
    feedbackRole: '工程负责人',
    files: [
      {
        id: 'feedback-file-2026-006-screenshot',
        name: '软装清单缺项反馈.png',
        registeredBy: '李明',
        source: '业务服务器',
        stage: '甲方反馈',
        status: '已上传',
        type: '图片',
        updatedAt: '2026-06-07 14:20',
        url: '/uploads/tasks/TASK-2026-008/client-feedback/soft-decoration-missing-item.png'
      }
    ],
    id: 'client-feedback-2026-006',
    operationRecords: [
      {
        id: 'op-client-feedback-2026-006-create',
        action: '登记甲方反馈',
        actor: '李明',
        object: '武汉光谷店软装清单核对',
        summary: '登记软装清单缺项反馈并上传截图',
        time: '2026-06-07 14:20'
      }
    ],
    recorder: '李明',
    storeId: 'store-wh-optics',
    summary: '软装清单补充灯具型号',
    taskId: 'store-task-2026-008',
    updatedAt: '2026-06-07 14:20'
  },
  {
    brandId: 'brand-starry-space',
    channel: '微信',
    code: 'FB-2026-001',
    content: '甲方反馈门头尺寸需按商场批复图调整，同时保留原始立面尺寸截图作为沟通依据。',
    createdAt: '2026-06-15 09:30',
    customerId: 'customer-starry',
    feedbackAt: '2026-06-15 09:10',
    feedbackBy: '周岚',
    feedbackPhone: '13800006601',
    feedbackRole: '工程负责人',
    files: [
      {
        id: 'feedback-file-2026-001-screenshot',
        name: '门头尺寸反馈截图.png',
        registeredBy: '李明',
        source: '业务服务器',
        stage: '甲方反馈',
        status: '已上传',
        type: '图片',
        updatedAt: '2026-06-15 09:30',
        url: '/uploads/tasks/TASK-2026-001/client-feedback/door-size.png'
      }
    ],
    id: 'client-feedback-2026-001',
    operationRecords: [
      {
        id: 'op-client-feedback-2026-001-create',
        action: '登记甲方反馈',
        actor: '李明',
        object: '武汉光谷店全套施工图交付',
        summary: '登记门头尺寸反馈并上传截图',
        time: '2026-06-15 09:30'
      }
    ],
    recorder: '李明',
    storeId: 'store-wh-optics',
    summary: '门头尺寸需按商场批复图调整',
    taskId: 'store-task-2026-001',
    updatedAt: '2026-06-15 09:30'
  },
  {
    brandId: 'brand-nova-tea',
    channel: '飞书',
    code: 'FB-2026-002',
    content: '客户补充说明收银区动线需要避开排队区，反馈内容仅作为后续沟通留存。',
    createdAt: '2026-06-12 15:00',
    customerId: 'customer-nova',
    feedbackAt: '2026-06-12 14:30',
    feedbackBy: '陈思',
    feedbackPhone: '13800006602',
    feedbackRole: '品牌运营',
    files: [
      {
        id: 'feedback-file-2026-002-screenshot',
        name: '收银区动线反馈截图.png',
        registeredBy: '李明',
        source: '业务服务器',
        stage: '甲方反馈',
        status: '已上传',
        type: '图片',
        updatedAt: '2026-06-12 15:00',
        url: '/uploads/tasks/TASK-2026-003/client-feedback/cashier-flow.png'
      }
    ],
    id: 'client-feedback-2026-002',
    operationRecords: [
      {
        id: 'op-client-feedback-2026-002-create',
        action: '登记甲方反馈',
        actor: '李明',
        object: '长沙岳麓首店平面方案',
        summary: '登记收银区动线反馈并上传截图',
        time: '2026-06-12 15:00'
      }
    ],
    recorder: '李明',
    storeId: 'store-cs-yuelu',
    summary: '收银区动线避开排队区',
    taskId: 'store-task-2026-003',
    updatedAt: '2026-06-12 15:00'
  }
];

const seedTaskPerformanceScoringRows: TaskPerformanceScoringRecord[] = [
  {
    adjustmentReason: '',
    confirmedAt: '2026-06-10 16:00',
    confirmedBy: '李明',
    id: 'score-store-task-2026-004',
    operationRecords: [
      {
        id: 'op-score-store-task-2026-004-create',
        action: '验收计分',
        actor: '李明',
        object: '星际轻装门店快图交付',
        summary: '验收通过并完成绩效评分',
        time: '2026-06-10 16:00'
      }
    ],
    performanceCategory: '绘图任务制',
    ruleId: 'perf-rule-space-design-2026-final',
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    scoreItemId: 'store-photoshop',
    scoreItemName: '门店P图',
    scoreValue: 1.2,
    qualityBand: '90分及以上',
    qualityDimensionScores: [
      { id: 'quality', maxScore: 40, name: '成果有效性与质量', score: 38 },
      { id: 'timeliness', maxScore: 25, name: '交付时效', score: 25 },
      { id: 'workflow', maxScore: 25, name: '流程闭环', score: 23 },
      { id: 'collaboration', maxScore: 10, name: '项目配合与沟通归档', score: 9 }
    ],
    qualityScore: 95,
    sourceMonth: '2026-06',
    status: '已计入',
    taskId: 'store-task-2026-004',
    updatedAt: '2026-06-10 16:00'
  }
];

function getNextTaskSequence(rows: StoreTaskRecord[]) {
  return (
    rows.reduce((maxSequence, row) => {
      const sequence = Number.parseInt(row.code.replace(/^TASK-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

function getNextClientFeedbackSequence(rows: ClientFeedbackRecord[]) {
  return (
    rows.reduce((maxSequence, row) => {
      const sequence = Number.parseInt(row.code.replace(/^FB-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

function buildCreateOperation(name: string): OperationRecord {
  return {
    id: `op-${name}-${taskManagementNow}`.replace(/\s+/g, '-'),
    action: '创建任务',
    actor: '李明',
    object: name,
    summary: '创建任务',
    time: taskManagementNow
  };
}

function buildClientFeedbackSummary(content: string) {
  const normalizedContent = content.trim().replace(/\s+/g, ' ');
  return normalizedContent.length > 28 ? `${normalizedContent.slice(0, 28)}...` : normalizedContent;
}

function buildClientFeedbackOperation(taskName: string, fileCount: number): OperationRecord {
  return {
    id: `op-client-feedback-${taskManagementNow}`.replace(/\s+/g, '-'),
    action: '登记甲方反馈',
    actor: '李明',
    object: taskName,
    summary: fileCount > 0 ? `登记甲方反馈并补充 ${fileCount} 份资料` : '登记甲方反馈',
    time: taskManagementNow
  };
}

const TaskManagementStateContext = createContext<TaskManagementStateValue | undefined>(undefined);

export function TaskManagementProvider({ children }: { children: ReactNode }) {
  const [storeTaskRows, setStoreTaskRows] = useState<StoreTaskRecord[]>(() => seedStoreTaskRows);
  const [clientFeedbackRows, setClientFeedbackRows] = useState<ClientFeedbackRecord[]>(() => seedClientFeedbackRows);
  const [taskPerformanceScoringRows, setTaskPerformanceScoringRows] = useState<TaskPerformanceScoringRecord[]>(() => seedTaskPerformanceScoringRows);

  const value = useMemo<TaskManagementStateValue>(
    () => ({
      clientFeedbackRows,
      createClientFeedback(input) {
        const sequence = getNextClientFeedbackSequence(clientFeedbackRows);
        const paddedSequence = String(sequence).padStart(3, '0');
        const code = `FB-2026-${paddedSequence}`;
        const taskName = storeTaskRows.find((task) => task.id === input.taskId)?.name ?? '甲方反馈';
        const nextRecord: ClientFeedbackRecord = {
          ...input,
          code,
          createdAt: taskManagementNow,
          id: `client-feedback-2026-${paddedSequence}`,
          operationRecords: [buildClientFeedbackOperation(taskName, input.files.length)],
          recorder: '李明',
          summary: buildClientFeedbackSummary(input.content),
          updatedAt: taskManagementNow
        };

        setClientFeedbackRows((currentRows) => [nextRecord, ...currentRows]);
        return nextRecord;
      },
      createStoreTask(input) {
        const sequence = getNextTaskSequence(storeTaskRows);
        const paddedSequence = String(sequence).padStart(3, '0');
        const code = `TASK-2026-${paddedSequence}`;
        const nextRecord: StoreTaskRecord = {
          ...input,
          code,
          createdAt: taskManagementNow,
          id: `store-task-2026-${paddedSequence}`,
          operationRecords: [buildCreateOperation(input.name)],
          reworkCount: 0,
          status: '进行中',
          updatedAt: taskManagementNow
        };

        setStoreTaskRows((currentRows) => [nextRecord, ...currentRows]);
        return nextRecord;
      },
      saveStoreTask(record) {
        setStoreTaskRows((currentRows) => currentRows.map((currentRecord) => (currentRecord.id === record.id ? record : currentRecord)));
      },
      saveClientFeedback(record) {
        setClientFeedbackRows((currentRows) => currentRows.map((currentRecord) => (currentRecord.id === record.id ? record : currentRecord)));
      },
      saveTaskPerformanceScoring(record) {
        setTaskPerformanceScoringRows((currentRows) => {
          const existingRecord = currentRows.some((currentRecord) => currentRecord.id === record.id);

          return existingRecord
            ? currentRows.map((currentRecord) => (currentRecord.id === record.id ? record : currentRecord))
            : [record, ...currentRows];
        });
      },
      taskPerformanceScoringRows,
      storeTaskRows
    }),
    [clientFeedbackRows, storeTaskRows, taskPerformanceScoringRows]
  );

  return <TaskManagementStateContext.Provider value={value}>{children}</TaskManagementStateContext.Provider>;
}

export function useTaskManagementState() {
  const value = useContext(TaskManagementStateContext);

  if (!value) {
    throw new Error('useTaskManagementState must be used within TaskManagementProvider');
  }

  return value;
}
