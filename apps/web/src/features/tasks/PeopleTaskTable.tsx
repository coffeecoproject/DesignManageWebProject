import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { ManagementTable } from '../../components/ManagementTable';
import { TagChip } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import {
  getPersonTaskStatusLabel,
  getPersonTaskStatusTone,
  type PersonTaskSummary
} from './personTaskViewModel';

type PeopleTaskTableProps = {
  records: PersonTaskSummary[];
  onRowClick: (summary: PersonTaskSummary) => void;
};

function TaskCountCell({ tone = 'strong', unit = '项', value }: { tone?: 'strong' | 'subtle' | 'risk'; unit?: string; value: number }) {
  return (
    <CellText tone={value > 0 ? tone : 'subtle'}>
      {value} {unit}
    </CellText>
  );
}

export function PeopleTaskTable({ records, onRowClick }: PeopleTaskTableProps) {
  const columns = useMemo<TableColumnsType<PersonTaskSummary>>(
    () => [
      {
        title: '人员',
        key: 'person',
        width: 168,
        render: (_, summary) => <CompactCell primary={summary.member.name} secondary={summary.member.mobile} />
      },
      {
        title: '工号',
        key: 'employeeId',
        align: 'center',
        width: 112,
        render: (_, summary) => <CellText>{summary.member.id}</CellText>
      },
      {
        title: '岗位',
        dataIndex: ['member', 'position'],
        align: 'center',
        width: 132
      },
      {
        title: '人员状态',
        key: 'peopleStatus',
        align: 'center',
        width: 136,
        render: (_, summary) => <TagChip label={getPersonTaskStatusLabel(summary.member)} tone={getPersonTaskStatusTone(summary.member.status)} />
      },
      {
        title: '已完成',
        key: 'completedTasks',
        align: 'center',
        width: 112,
        render: (_, summary) => <TaskCountCell value={summary.completedTasks.length} />
      },
      {
        title: '执行中任务',
        key: 'inProgressTasks',
        align: 'center',
        width: 112,
        render: (_, summary) => <TaskCountCell value={summary.inProgressTasks.length} />
      },
      {
        title: '待验收任务',
        key: 'pendingAcceptanceTasks',
        align: 'center',
        width: 112,
        render: (_, summary) => <TaskCountCell value={summary.pendingAcceptanceTasks.length} />
      },
      {
        title: '逾期任务',
        key: 'overdueTasks',
        align: 'center',
        width: 104,
        render: (_, summary) => <TaskCountCell tone="risk" value={summary.overdueTasks.length} />
      },
      {
        title: '驳回次数',
        key: 'rejectionCount',
        align: 'center',
        width: 104,
        render: (_, summary) => <TaskCountCell tone="risk" unit="次" value={summary.rejectionCount} />
      }
    ],
    []
  );

  return (
    <ManagementTable<PersonTaskSummary>
      columns={columns}
      count={{ unit: '人', value: records.length }}
      dataSource={records}
      rowKey="id"
      rowTestIdPrefix="people-task-row"
      tableTestId="people-task-table"
      onRowClick={onRowClick}
    />
  );
}
