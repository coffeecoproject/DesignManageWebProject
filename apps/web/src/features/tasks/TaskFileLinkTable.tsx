import { DownloadOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import type { StoreTaskFileRecord, StoreTaskFileStage } from './TaskManagementState';
import { TaskFileStageTag } from './components/TaskStatusTag';

type TaskFileLinkTableProps = {
  onPreviewServerFile?: (record: StoreTaskFileRecord) => void;
  records: StoreTaskFileRecord[];
};

export function TaskFileLinkTable({ onPreviewServerFile, records }: TaskFileLinkTableProps) {
  const columns: TableColumnsType<StoreTaskFileRecord> = [
    {
      title: '文件名称',
      key: 'name',
      width: 178,
      render: (_, record) => (
        <div className="detail-table-main">
          <span>{record.name}</span>
        </div>
      )
    },
    {
      title: '文件阶段',
      dataIndex: 'stage',
      align: 'center',
      width: 94,
      render: (stage: StoreTaskFileStage) => <TaskFileStageTag stage={stage} />
    },
    {
      title: '文件类型',
      dataIndex: 'type',
      align: 'center',
      width: 82
    },
    {
      title: '登记人',
      dataIndex: 'registeredBy',
      align: 'center',
      width: 80
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 118
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      width: 148,
      render: (_, record) => {
        const isBusinessServerFile = record.source === '业务服务器';

        return (
          <Space className="archive-file-actions" size={2}>
            {isBusinessServerFile ? (
              <>
                <Button icon={<EyeOutlined />} size="small" type="link" onClick={() => onPreviewServerFile?.(record)}>
                  预览
                </Button>
                <Button href={record.url} icon={<DownloadOutlined />} rel="noreferrer" size="small" target="_blank" type="link">
                  下载
                </Button>
              </>
            ) : (
              <Button href={record.url} icon={<LinkOutlined />} rel="noreferrer" size="small" target="_blank" type="link">
                打开云盘
              </Button>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <CompactDetailTable<StoreTaskFileRecord>
      className="task-file-link-table"
      columns={columns}
      dataSource={records}
      rowKey="id"
      scrollX={704}
    />
  );
}
