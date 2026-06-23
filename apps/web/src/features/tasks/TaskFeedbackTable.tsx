import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { ManagementTable } from '../../components/ManagementTable';
import { CellText, CompactCell } from '../../components/TableCell';
import type { StoreTaskRecord } from './TaskManagementState';
import { getTaskFeedbackCompletedAt, type TaskFeedbackSummary } from './taskFeedbackModel';

type TaskFeedbackTableProps = {
  getBrandName: (task: StoreTaskRecord) => string;
  getCustomerName: (task: StoreTaskRecord) => string;
  getStoreLabel: (task: StoreTaskRecord) => string;
  records: TaskFeedbackSummary[];
  onRowClick: (summary: TaskFeedbackSummary) => void;
};

export function TaskFeedbackTable({
  getBrandName,
  getCustomerName,
  getStoreLabel,
  records,
  onRowClick
}: TaskFeedbackTableProps) {
  const columns = useMemo<TableColumnsType<TaskFeedbackSummary>>(
    () => [
      {
        title: '任务名称',
        key: 'task',
        width: 230,
        render: (_, summary) => <CompactCell primary={summary.task.name} secondary={summary.task.code} />
      },
      {
        title: '客户 / 品牌 / 门店',
        key: 'customerBrandStore',
        width: 260,
        render: (_, summary) => (
          <CompactCell primary={`${getBrandName(summary.task)} / ${getStoreLabel(summary.task)}`} secondary={getCustomerName(summary.task)} />
        )
      },
      {
        title: '执行人',
        key: 'executor',
        align: 'center',
        width: 108,
        render: (_, summary) => summary.task.executorName ?? '-'
      },
      {
        title: '验收人',
        dataIndex: ['task', 'acceptorName'],
        align: 'center',
        width: 108
      },
      {
        title: '完成时间',
        key: 'completedAt',
        align: 'center',
        width: 142,
        render: (_, summary) => getTaskFeedbackCompletedAt(summary)
      },
      {
        title: '驳回次数',
        dataIndex: 'internalRejectionCount',
        align: 'center',
        width: 104,
        render: (value: number) => <CellText tone={value > 0 ? 'risk' : 'subtle'}>{value} 次</CellText>
      },
      {
        title: '甲方反馈次数',
        dataIndex: 'clientFeedbackCount',
        align: 'center',
        width: 120,
        render: (value: number) => <CellText tone={value > 0 ? 'strong' : 'subtle'}>{value} 次</CellText>
      },
      {
        title: '最近反馈时间',
        dataIndex: 'latestFeedbackAt',
        align: 'center',
        width: 142
      }
    ],
    [getBrandName, getCustomerName, getStoreLabel]
  );

  return (
    <ManagementTable<TaskFeedbackSummary>
      columns={columns}
      count={{ unit: '个任务', value: records.length }}
      dataSource={records}
      rowKey="id"
      rowTestIdPrefix="task-feedback-table-row"
      tableTestId="task-feedback-table"
      onRowClick={onRowClick}
    />
  );
}
