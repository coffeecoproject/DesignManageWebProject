import { DeleteOutlined, DownloadOutlined, EyeOutlined, FileProtectOutlined } from '@ant-design/icons';
import { StatusTag } from './Detail';

export type FileTagListItem = {
  id: string;
  name: string;
  status?: string;
  type?: string;
};

type FileTagListProps<T extends FileTagListItem> = {
  emptyText?: string;
  files: T[];
  onDownload?: (file: T) => void;
  onPreview?: (file: T) => void;
  onRemove?: (file: T) => void;
};

const fileTagStatusTone = {
  已选择: 'blue',
  已上传: 'green',
  未上传: 'amber',
  待复核: 'amber'
} as const;

export function FileTagList<T extends FileTagListItem>({
  emptyText = '暂未选择文件',
  files,
  onDownload,
  onPreview,
  onRemove
}: FileTagListProps<T>) {
  if (files.length === 0) {
    return <div className="file-tag-list-empty">{emptyText}</div>;
  }

  return (
    <div className="file-tag-list">
      {files.map((file) => (
        <div className="file-tag-item" key={file.id} title={file.name}>
          <FileProtectOutlined className="file-tag-icon" />
          <span className="file-tag-name">{file.name}</span>
          {file.type ? <span className="file-tag-type">{file.type}</span> : null}
          {file.status ? <StatusTag toneMap={fileTagStatusTone} value={file.status} /> : null}
          <div className="file-tag-actions">
            {onPreview ? (
              <button aria-label={`预览 ${file.name}`} className="file-tag-action" type="button" onClick={() => onPreview(file)}>
                <EyeOutlined />
              </button>
            ) : null}
            {onDownload ? (
              <button aria-label={`下载 ${file.name}`} className="file-tag-action" type="button" onClick={() => onDownload(file)}>
                <DownloadOutlined />
              </button>
            ) : null}
            {onRemove ? (
              <button aria-label={`移除 ${file.name}`} className="file-tag-action file-tag-action-danger" type="button" onClick={() => onRemove(file)}>
                <DeleteOutlined />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
