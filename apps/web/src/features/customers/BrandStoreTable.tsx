import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { StatusTag } from '../../components/Detail';
import { CellText } from '../../components/TableCell';
import type { StoreRecord } from './customerData';
import { CustomerCodeCell, storeStatusTone } from './CustomerShared';

const storeColumns: TableColumnsType<StoreRecord> = [
  {
    title: '门店',
    key: 'store',
    width: 170,
    render: (_, record) => <CustomerCodeCell code={record.code} name={record.name} />
  },
  {
    title: '省市',
    key: 'region',
    align: 'center',
    width: 130,
    render: (_, record) => `${record.province} / ${record.city}`
  },
  {
    title: '状态',
    dataIndex: 'status',
    align: 'center',
    width: 90,
    render: (status: StoreRecord['status']) => <StatusTag toneMap={storeStatusTone} value={status} />
  }
];

export function BrandStoreTable({
  emptyText = '该品牌暂未关联门店。',
  rows
}: {
  emptyText?: string;
  rows: StoreRecord[];
}) {
  if (rows.length === 0) {
    return <CellText tone="subtle">{emptyText}</CellText>;
  }

  return (
    <CompactDetailTable<StoreRecord>
      className="brand-store-table"
      columns={storeColumns}
      dataSource={rows}
      rowKey="id"
      scrollX={480}
    />
  );
}
