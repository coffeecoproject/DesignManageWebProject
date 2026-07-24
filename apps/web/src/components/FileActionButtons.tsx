import { DeleteOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import type { ReactNode } from 'react';

type FileActionButtonsProps<T> = {
  deleteLabel?: ReactNode;
  downloadHref?: string;
  downloadLabel?: ReactNode;
  onDelete?: (record: T) => void;
  onDownload?: (record: T) => void;
  onPreview?: (record: T) => void;
  previewHref?: string;
  previewLabel?: ReactNode;
  record: T;
};

export function FileActionButtons<T>({
  deleteLabel = '删除',
  downloadHref,
  downloadLabel = '下载',
  onDelete,
  onDownload,
  onPreview,
  previewHref,
  previewLabel = '预览',
  record
}: FileActionButtonsProps<T>) {
  const hasDownloadAction = Boolean(onDownload || downloadHref);

  const hasPreviewAction = Boolean(onPreview || previewHref);

  if (!hasPreviewAction && !hasDownloadAction && !onDelete) {
    return null;
  }

  return (
    <Space className="archive-file-actions" size={2}>
      {hasPreviewAction ? (
        <Button
          href={previewHref}
          icon={<EyeOutlined />}
          rel={previewHref ? 'noreferrer' : undefined}
          size="small"
          target={previewHref ? '_blank' : undefined}
          type="link"
          onClick={onPreview ? () => onPreview(record) : undefined}
        >
          {previewLabel}
        </Button>
      ) : null}
      {hasDownloadAction ? (
        <Button
          href={downloadHref}
          icon={<DownloadOutlined />}
          rel={downloadHref ? 'noreferrer' : undefined}
          size="small"
          target={downloadHref ? '_blank' : undefined}
          type="link"
          onClick={onDownload ? () => onDownload(record) : undefined}
        >
          {downloadLabel}
        </Button>
      ) : null}
      {onDelete ? (
        <Button danger icon={<DeleteOutlined />} size="small" type="link" onClick={() => onDelete(record)}>
          {deleteLabel}
        </Button>
      ) : null}
    </Space>
  );
}
