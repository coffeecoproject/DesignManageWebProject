import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { FileActionButtons } from '../../components/FileActionButtons';
import { CellText, CompactCell } from '../../components/TableCell';
import type { PerformanceSignatureFile } from './performanceSignatureArchiveData';
import type { PerformanceSignatureFileAction } from './performanceSignatureModel';

type PerformanceSignatureFileTableProps = {
  files: PerformanceSignatureFile[];
  mode: 'current' | 'history';
  onFileAction: (action: PerformanceSignatureFileAction, file: PerformanceSignatureFile) => void;
};

export function PerformanceSignatureFileTable({
  files,
  mode,
  onFileAction
}: PerformanceSignatureFileTableProps) {
  const actionColumn: TableColumnsType<PerformanceSignatureFile>[number] = {
    title: '操作',
    key: 'actions',
    align: 'center',
    width: 148,
    render: (_, record) => (
      <FileActionButtons
        record={record}
        onDownload={(file) => onFileAction('download', file)}
        onPreview={(file) => onFileAction('preview', file)}
      />
    )
  };
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
    },
    actionColumn
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
    },
    actionColumn
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
