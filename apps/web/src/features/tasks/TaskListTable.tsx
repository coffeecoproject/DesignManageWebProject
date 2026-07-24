import { PlusOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { ManagementTable } from '../../components/ManagementTable';
import { TagChip } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import { type StoreTaskRecord, type StoreTaskStatus } from './TaskManagementState';
import { getTaskStoreContext, getTaskTypeName } from './taskDisplayModel';
import { TaskScheduleCell } from './components/TaskScheduleCell';
import { TaskStatusTag } from './components/TaskStatusTag';
import type { StoreRecord } from '../customers/customerData';
import { getCustomerTaskAcceptanceStatus } from './taskCustomerAcceptanceModel';

type TaskListTableProps = {
  getBrandName: (brandId: string) => string;
  onCreate: () => void;
  onRowClick: (record: StoreTaskRecord) => void;
  records: StoreTaskRecord[];
  storeRows: StoreRecord[];
};

export function TaskListTable({
  getBrandName,
  onCreate,
  onRowClick,
  records,
  storeRows,
}: TaskListTableProps) {
  const columns: TableColumnsType<StoreTaskRecord> = [
    {
      title: '任务',
      key: 'task',
      width: 210,
      render: (_, record) => <CompactCell primary={record.name} secondary={record.code} />
    },
    {
      title: '品牌',
      key: 'brand',
      width: 150,
      render: (_, record) => <CellText>{getBrandName(record.brandId)}</CellText>
    },
    {
      title: '门店',
      key: 'store',
      width: 150,
      render: (_, record) => {
        const storeContext = getTaskStoreContext(storeRows, record.storeId);

        return <CompactCell primary={storeContext.name} secondary={storeContext.region} />;
      }
    },
    {
      title: '类型',
      key: 'taskType',
      align: 'center',
      width: 126,
      render: (_, record) => <TagChip label={getTaskTypeName(record)} />
    },
    {
      title: '执行人',
      key: 'executor',
      align: 'center',
      width: 108,
      render: (_, record) => record.executorName ?? '-'
    },
    {
      title: '验收人',
      key: 'acceptor',
      align: 'center',
      width: 108,
      render: (_, record) => record.acceptorName ?? '-'
    },
    {
      title: '计划安排',
      key: 'plannedSchedule',
      align: 'center',
      width: 156,
      render: (_, record) => <TaskScheduleCell task={record} />
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      align: 'center',
      width: 106,
      render: (status: StoreTaskStatus) => <TaskStatusTag status={status} />
    },
    {
      title: '甲方验收',
      key: 'customerAcceptance',
      align: 'center',
      width: 106,
      render: (_, record) => {
        const status = getCustomerTaskAcceptanceStatus(record);

        return status === '不适用'
          ? <CellText tone="subtle">-</CellText>
          : <TagChip label={status} tone={status === '已完成' ? 'green' : 'amber'} />;
      }
    },
    {
      title: '驳回次数',
      dataIndex: 'reworkCount',
      align: 'center',
      width: 92,
      render: (count: number) => <CellText tone={count > 0 ? 'risk' : 'strong'}>{count} 次</CellText>
    }
  ];

  return (
    <ManagementTable<StoreTaskRecord>
      columns={columns}
      count={{ value: records.length, unit: '条' }}
      dataSource={records}
      primaryAction={{ icon: <PlusOutlined />, label: '新增任务', onClick: onCreate }}
      rowTestIdPrefix="task-store-table-row"
      rowKey="id"
      tableTestId="task-store-table"
      onRowClick={onRowClick}
    />
  );
}
