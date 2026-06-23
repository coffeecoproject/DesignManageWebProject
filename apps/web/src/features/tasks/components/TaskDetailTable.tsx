import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../../components/CompactDetailTable';
import { TagChip } from '../../../components/TagChip';
import { CompactCell } from '../../../components/TableCell';
import type { StoreTaskRecord } from '../TaskManagementState';
import { TaskScheduleCell } from './TaskScheduleCell';
import { TaskStatusTag } from './TaskStatusTag';

export type TaskDetailRole = '执行' | '验收' | '完成';

export type TaskDetailTableRow = {
  role?: TaskDetailRole;
  task: StoreTaskRecord;
};

type TaskDetailTableProps = {
  emptyText?: string;
  getBrandName: (task: StoreTaskRecord) => string;
  getCustomerName?: (task: StoreTaskRecord) => string;
  getStoreLabel: (task: StoreTaskRecord) => string;
  getTaskTypeName: (task: StoreTaskRecord) => string;
  rows: TaskDetailTableRow[];
  showCustomer?: boolean;
  showRole?: boolean;
};

export function TaskDetailTable({
  emptyText = '暂无任务',
  getBrandName,
  getCustomerName,
  getStoreLabel,
  getTaskTypeName,
  rows,
  showCustomer = false,
  showRole = true
}: TaskDetailTableProps) {
  const columns: TableColumnsType<TaskDetailTableRow> = [
    {
      title: '任务',
      key: 'task',
      width: 220,
      render: (_, row) => <CompactCell primary={row.task.name} secondary={row.task.code} />
    },
    {
      title: '品牌',
      key: 'brand',
      width: showCustomer ? 180 : 140,
      render: (_, row) => (
        <CompactCell
          align={showCustomer ? 'left' : 'center'}
          primary={getBrandName(row.task)}
          secondary={showCustomer ? getCustomerName?.(row.task) : undefined}
        />
      )
    },
    {
      title: '门店',
      key: 'store',
      width: 168,
      render: (_, row) => <CompactCell align="center" primary={getStoreLabel(row.task)} secondary={getTaskTypeName(row.task)} />
    },
    ...(showRole
      ? [
          {
            title: '角色',
            dataIndex: 'role',
            align: 'center' as const,
            width: 84,
            render: (role?: TaskDetailRole) => {
              if (!role) {
                return '-';
              }

              return <TagChip label={role} tone={role === '执行' ? 'blue' : role === '完成' ? 'gray' : 'green'} />;
            }
          }
        ]
      : []),
    {
      title: '计划',
      key: 'planned',
      align: 'center',
      width: 170,
      render: (_, row) => <TaskScheduleCell task={row.task} />
    },
    {
      title: '状态',
      dataIndex: ['task', 'status'],
      align: 'center',
      width: 104,
      render: (_, row) => <TaskStatusTag status={row.task.status} />
    }
  ];

  return (
    <CompactDetailTable<TaskDetailTableRow>
      columns={columns}
      dataSource={rows}
      emptyText={emptyText}
      rowKey={(row) => `${row.task.id}-${row.role ?? 'task'}`}
      scrollX={showCustomer ? 926 : 886}
    />
  );
}
