import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { CellText, CompactCell } from '../../components/TableCell';
import type { PerformanceSignatureFile } from './performanceSignatureArchiveData';

type PerformanceSignatureFileTableProps = {
  files: PerformanceSignatureFile[];
  mode: 'current' | 'history';
};

export function PerformanceSignatureFileTable({
  files,
  mode
}: PerformanceSignatureFileTableProps) {
  const currentColumns: TableColumnsType<PerformanceSignatureFile> = [
    {
      title: '文件名称',
      key: 'fileName',
      width: 420,
      render: (_, record) => <CellText>{record.fileName}</CellText>
    },
    {
      title: '上传时间',
      dataIndex: 'uploadedAt',
      width: 148
    }
  ];
  const historyColumns: TableColumnsType<PerformanceSignatureFile> = [
    {
      title: '历史版本',
      key: 'rule',
      width: 136,
      render: (_, record) => <CompactCell primary={record.ruleName} secondary={record.ruleVersion} />
    },
    {
      title: '签署文件',
      key: 'fileName',
      width: 260,
      render: (_, record) => <CellText>{record.fileName}</CellText>
    },
    {
      title: '签署日期',
      dataIndex: 'signedAt',
      align: 'center',
      width: 112
    },
    {
      title: '上传时间',
      dataIndex: 'uploadedAt',
      width: 148
    },
    {
      title: '文件说明',
      dataIndex: 'note',
      width: 196,
      render: (note: string) => <span className="detail-table-sub">{note}</span>
    }
  ];
  const columns = mode === 'current' ? currentColumns : historyColumns;

  return (
    <Table
      className="detail-table"
      columns={columns}
      dataSource={files}
      pagination={false}
      rowKey="id"
      scroll={{ x: mode === 'current' ? 700 : 976 }}
      size="small"
    />
  );
}
