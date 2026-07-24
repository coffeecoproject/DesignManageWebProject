import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  validateTaskConfigStatusChange,
  type MasterDataMutationResult
} from './masterDataLifecycleModel';

export const taskConfigCategories = ['设计交付', '图像处理', '下单支持'] as const;

export type TaskConfigCategory = (typeof taskConfigCategories)[number];
export type TaskConfigStatus = '启用' | '停用';

export type TaskConfigRow = {
  id: string;
  code: string;
  name: string;
  category: TaskConfigCategory;
  deliveryHints: string[];
  status: TaskConfigStatus;
  updatedAt: string;
  note: string;
};

export type TaskConfigFormValue = Pick<
  TaskConfigRow,
  'category' | 'deliveryHints' | 'name' | 'note'
>;

export type TaskDefinitionSnapshot = Pick<TaskConfigRow, 'category' | 'code' | 'id' | 'name'> & {
  capturedAt: string;
  deliveryHints: string[];
};

export function buildTaskDefinitionSnapshot(taskConfig: TaskConfigRow, capturedAt: string): TaskDefinitionSnapshot {
  return {
    capturedAt,
    category: taskConfig.category,
    code: taskConfig.code,
    deliveryHints: [...taskConfig.deliveryHints],
    id: taskConfig.id,
    name: taskConfig.name
  };
}

type TaskConfigStateValue = {
  createTaskConfig: (nextValue: TaskConfigFormValue) => void;
  taskConfigRows: TaskConfigRow[];
  updateTaskConfig: (id: string, nextValue: TaskConfigFormValue) => void;
  updateTaskConfigStatus: (id: string, status: TaskConfigStatus, activeTaskCount?: number) => MasterDataMutationResult;
};

const prototypeToday = '2026-06-14';

export const seedTaskConfigRows: TaskConfigRow[] = [
  {
    category: '设计交付',
    code: 'TT-2026-001',
    deliveryHints: ['建议提供全套施工图文件', '建议附交付说明'],
    id: 'task-type-full-drawing',
    name: '全套施工图',
    note: '门店完整施工图交付任务，后续由品牌配置决定是否启用。',
    status: '启用',
    updatedAt: prototypeToday
  },
  {
    category: '设计交付',
    code: 'TT-2026-002',
    deliveryHints: ['建议提供深化图纸文件'],
    id: 'task-type-drawing-detail',
    name: '施工图深化',
    note: '基于已有方案进行施工图深化。',
    status: '启用',
    updatedAt: prototypeToday
  },
  {
    category: '设计交付',
    code: 'TT-2026-003',
    deliveryHints: ['建议提供平面方案文件'],
    id: 'task-type-floor-plan',
    name: '平面方案',
    note: '用于门店前期平面布局方案。',
    status: '启用',
    updatedAt: prototypeToday
  },
  {
    category: '图像处理',
    code: 'TT-2026-004',
    deliveryHints: ['建议提供效果图文件'],
    id: 'task-type-rendering',
    name: '效果图表现',
    note: '面向效果表现和展示确认。',
    status: '启用',
    updatedAt: prototypeToday
  },
  {
    category: '图像处理',
    code: 'TT-2026-005',
    deliveryHints: ['建议提供P图源文件', '建议提供导出图片'],
    id: 'task-type-store-image',
    name: '门店P图',
    note: '用于门店图片处理和快速交付。',
    status: '启用',
    updatedAt: prototypeToday
  },
  {
    category: '下单支持',
    code: 'TT-2026-006',
    deliveryHints: ['建议附下单资料', '建议附物料清单'],
    id: 'task-type-material-order',
    name: '物料下单支持',
    note: '偏执行支持类任务，具体处理规则由后续任务模板定义。',
    status: '停用',
    updatedAt: prototypeToday
  }
];

function getNextTaskConfigSequence(rows: TaskConfigRow[]) {
  return (
    rows.reduce((maxSequence, row) => {
      const sequence = Number.parseInt(row.code.replace(/^TT-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

const TaskConfigStateContext = createContext<TaskConfigStateValue | undefined>(undefined);

export function TaskConfigProvider({ children }: { children: ReactNode }) {
  const [taskConfigRows, setTaskConfigRows] = useState<TaskConfigRow[]>(() => seedTaskConfigRows);

  const value = useMemo<TaskConfigStateValue>(
    () => ({
      createTaskConfig(nextValue) {
        setTaskConfigRows((currentRows) => {
          const sequence = getNextTaskConfigSequence(currentRows);
          const paddedSequence = String(sequence).padStart(3, '0');
          const nextRow: TaskConfigRow = {
            ...nextValue,
            code: `TT-2026-${paddedSequence}`,
            id: `task-type-custom-${paddedSequence}`,
            status: '启用',
            updatedAt: prototypeToday
          };

          return [...currentRows, nextRow];
        });
      },
      taskConfigRows,
      updateTaskConfig(id, nextValue) {
        setTaskConfigRows((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  ...nextValue,
                  updatedAt: prototypeToday
                }
              : row
          )
        );
      },
      updateTaskConfigStatus(id, status, activeTaskCount = 0) {
        const validation = validateTaskConfigStatusChange(status, activeTaskCount);
        if (!validation.success) {
          return validation;
        }

        setTaskConfigRows((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status,
                  updatedAt: prototypeToday
                }
              : row
          )
        );
        return validation;
      }
    }),
    [taskConfigRows]
  );

  return <TaskConfigStateContext.Provider value={value}>{children}</TaskConfigStateContext.Provider>;
}

export function useTaskConfigState() {
  const value = useContext(TaskConfigStateContext);

  if (!value) {
    throw new Error('useTaskConfigState must be used within TaskConfigProvider');
  }

  return value;
}
