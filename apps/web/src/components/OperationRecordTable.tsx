import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from './CompactDetailTable';
import { StatusTag } from './Detail';
import type { StatusTagTone } from './Detail';
import { CellText } from './TableCell';

export type OperationRecord = {
  id?: string;
  action: string;
  actor: string;
  object: string;
  summary: string;
  time: string;
};

function getOperationActorTone(actor: string): StatusTagTone {
  if (actor.includes('系统')) {
    return 'gray';
  }

  return 'blue';
}

const operationRecordColumns: TableColumnsType<OperationRecord> = [
  {
    title: '时间',
    dataIndex: 'time',
    align: 'center',
    width: 156
  },
    {
      title: '操作人',
      dataIndex: 'actor',
      align: 'center',
      width: 132,
      render: (actor: string) => <StatusTag tone={getOperationActorTone(actor)} value={actor} variant="compact" />
    },
    {
      title: '操作对象',
      dataIndex: 'object',
      width: 168,
      render: (object: string) => <CellText tone="default">{object}</CellText>
  },
  {
    title: '操作类型',
    dataIndex: 'action',
    align: 'center',
    width: 140
  },
  {
    title: '变更摘要',
    dataIndex: 'summary',
    width: 260,
    render: (summary: string) => <span className="detail-table-sub">{summary}</span>
  }
];

export function OperationRecordTable({
  emptyText,
  records,
  scrollX = 856
}: {
  emptyText?: string;
  records: OperationRecord[];
  scrollX?: number | false;
}) {
  return (
    <CompactDetailTable<OperationRecord>
      className="operation-record-table"
      columns={operationRecordColumns}
      dataSource={records}
      emptyText={emptyText}
      rowKey={(record) => record.id ?? `${record.time}-${record.actor}-${record.action}-${record.object}`}
      scrollX={scrollX}
    />
  );
}
