import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { StatusTag } from './Detail';
import { FileActionButtons } from './FileActionButtons';

export type RelatedFileRecord = {
  id: string;
  name: string;
  source?: string;
  status: string;
  type: string;
  updatedAt: string;
  url?: string;
};

type RelatedFileTableProps<T extends RelatedFileRecord> = {
  records: T[];
  scrollX?: number;
  onDelete?: (record: T) => void;
  onDownload?: (record: T) => void;
  onPreview?: (record: T) => void;
};

const relatedFileStatusTone = {
  已选择: 'blue',
  已上传: 'green',
  已发布: 'green',
  已生成: 'green',
  未上传: 'amber',
  待上传: 'amber',
  待补充: 'amber',
  待复核: 'amber',
  待生成: 'amber',
  已归档: 'gray'
} as const;

export function RelatedFileTable<T extends RelatedFileRecord>({
  records,
  scrollX = 720,
  onDelete,
  onDownload,
  onPreview
}: RelatedFileTableProps<T>) {
  const hasActions = Boolean(onDelete || onDownload || onPreview);
  const columns: TableColumnsType<T> = [
    {
      title: '文件名称',
      key: 'name',
      width: 220,
      render: (_, record) => (
        <div className="detail-table-main">
          <span>{record.name}</span>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      align: 'center',
      width: 108
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 96,
      render: (status: string) => <StatusTag toneMap={relatedFileStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 118
    }
  ];

  if (hasActions) {
    columns.push({
      title: '操作',
      key: 'actions',
      align: 'center',
      width: 148,
      render: (_, record) => (
        <FileActionButtons
          downloadHref={!onDownload ? record.url : undefined}
          record={record}
          onDelete={onDelete}
          onDownload={onDownload}
          onPreview={onPreview}
        />
      )
    });
  }

  return (
    <Table<T>
      className="detail-table detail-table-compact related-file-table"
      columns={columns}
      dataSource={records}
      pagination={false}
      rowKey="id"
      scroll={{ x: scrollX }}
      size="small"
    />
  );
}
