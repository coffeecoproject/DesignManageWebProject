import { FileDoneOutlined } from '@ant-design/icons';
import { Alert, Empty } from 'antd';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DetailSection } from '../../../components/Detail';
import { FilePreviewModal } from '../../../components/FilePreviewModal';
import { TaskFileLinkTable } from '../TaskFileLinkTable';
import type { StoreTaskFileRecord } from '../TaskManagementState';

type TaskFilesSectionProps = {
  emptyText?: string;
  icon?: ReactNode;
  records: StoreTaskFileRecord[];
  title?: string;
};

const taskFileStatusTone = {
  已上传: 'green',
  已登记: 'blue',
  已选择: 'blue',
  待上传: 'amber',
  待补充: 'amber',
  已归档: 'gray'
} as const;

export function TaskFilesSection({ emptyText = '暂无文件记录', icon = <FileDoneOutlined />, records, title = '相关文件' }: TaskFilesSectionProps) {
  const [previewFile, setPreviewFile] = useState<StoreTaskFileRecord>();
  const previewRecord = previewFile
    ? {
        category: previewFile.type,
        name: previewFile.name,
        status: previewFile.status,
        updatedAt: previewFile.updatedAt
      }
    : undefined;

  return (
    <>
      <DetailSection icon={icon} title={title}>
        {records.length > 0 ? (
          <TaskFileLinkTable records={records} onPreviewServerFile={setPreviewFile} />
        ) : title === '相关文件' ? (
          <Alert message={emptyText} showIcon type="info" />
        ) : (
          <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </DetailSection>
      <FilePreviewModal file={previewRecord} statusToneMap={taskFileStatusTone} title="文件预览" onClose={() => setPreviewFile(undefined)} />
    </>
  );
}
