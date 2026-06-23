import { FileProtectOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import type { ReactNode } from 'react';
import { StatusTag, type StatusTagTone } from './Detail';

export type PreviewFileRecord = {
  category: ReactNode;
  name: ReactNode;
  status: ReactNode;
  updatedAt: ReactNode;
};

type FilePreviewModalProps<T extends PreviewFileRecord> = {
  file?: T;
  icon?: ReactNode;
  statusToneMap?: Partial<Record<string, StatusTagTone>>;
  title: ReactNode;
  onClose: () => void;
};

export function FilePreviewModal<T extends PreviewFileRecord>({
  file,
  icon = <FileProtectOutlined />,
  statusToneMap,
  title,
  onClose
}: FilePreviewModalProps<T>) {
  return (
    <Modal
      className="file-preview-modal"
      footer={null}
      open={Boolean(file)}
      title={title}
      width={560}
      zIndex={1200}
      onCancel={onClose}
    >
      {file ? (
        <div className="file-preview">
          <div className="file-preview-head">
            <span className="file-preview-icon">{icon}</span>
            <div className="file-preview-title">
              <span className="file-preview-name">{file.name}</span>
            </div>
            <StatusTag toneMap={statusToneMap} value={file.status} />
          </div>
          <div className="file-preview-meta">
            <div>
              <span>文件类型</span>
              <strong>{file.category}</strong>
            </div>
            <div>
              <span>最近更新</span>
              <strong>{file.updatedAt}</strong>
            </div>
          </div>
          <div className="file-preview-canvas">
            <FileProtectOutlined />
            <span>{file.category}</span>
            <strong>{file.name}</strong>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
