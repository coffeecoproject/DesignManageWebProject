import { DeleteOutlined, EyeOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Space, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ReactNode } from 'react';
import { StatusTag } from './Detail';
import type { StatusTagTone } from './Detail';
import { FileTagList, type FileTagListItem } from './FileTagList';

export type FileSlotFile = FileTagListItem & {
  status?: string;
};

type FileSlotGridProps = {
  children: ReactNode;
  flush?: boolean;
};

type FileSlotProps<T extends FileSlotFile> = {
  accept?: string;
  description?: ReactNode;
  disabled?: boolean;
  emptyText?: string;
  file?: T;
  files?: T[];
  density?: 'default' | 'compact';
  multiple?: boolean;
  replaceText?: string;
  showFileList?: boolean;
  status?: ReactNode;
  statusTone?: StatusTagTone;
  title: ReactNode;
  uploadText?: string;
  variant?: 'list' | 'single';
  onDownload?: (file: T) => void;
  onPreview?: (file: T) => void;
  onRemove?: (file: T) => void;
  onSelect?: (file: UploadFile) => void;
};

const fileSlotStatusTone = {
  已上传: 'green',
  已选择: 'blue',
  已归档: 'gray',
  待上传: 'amber',
  待补充: 'amber',
  待复核: 'amber',
  未上传: 'amber'
} as const;

function renderUploadButton({
  accept,
  disabled,
  fileSelected,
  multiple,
  replaceText,
  uploadText,
  onSelect
}: {
  accept?: string;
  disabled?: boolean;
  fileSelected: boolean;
  multiple?: boolean;
  replaceText: string;
  uploadText: string;
  onSelect?: (file: UploadFile) => void;
}) {
  const label = fileSelected ? replaceText : uploadText;

  return (
    <Upload
      accept={accept}
      beforeUpload={(file) => {
        onSelect?.(file as UploadFile);
        return false;
      }}
      disabled={disabled}
      maxCount={multiple ? undefined : 1}
      multiple={multiple}
      showUploadList={false}
    >
      <Button disabled={disabled} icon={<UploadOutlined />} size="small" type={!fileSelected ? 'primary' : 'default'}>
        {label}
      </Button>
    </Upload>
  );
}

export function FileSlotGrid({ children, flush }: FileSlotGridProps) {
  return <div className={flush ? 'archive-required-file-grid archive-required-file-grid-flush' : 'archive-required-file-grid'}>{children}</div>;
}

export function FileSlot<T extends FileSlotFile>({
  accept,
  description,
  density = 'default',
  disabled,
  emptyText = '暂未选择文件',
  file,
  files,
  multiple,
  replaceText = '替换',
  showFileList = true,
  status,
  statusTone,
  title,
  uploadText = '上传',
  variant = 'single',
  onDownload,
  onPreview,
  onRemove,
  onSelect
}: FileSlotProps<T>) {
  const slotFiles = files ?? (file ? [file] : []);
  const primaryFile = file ?? slotFiles[0];
  const fileSelected = slotFiles.length > 0;
  const resolvedStatus = status ?? primaryFile?.status ?? (fileSelected ? '已选择' : '未上传');

  if (variant === 'list') {
    return (
      <div
        className={[
          'archive-required-file-card',
          'file-slot-list-card',
          density === 'compact' ? 'archive-required-file-card-compact' : undefined
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="file-slot-list-head">
          <div className="archive-required-file-head">
            <div className="archive-required-file-copy">
              <div className="archive-required-file-title">{title}</div>
              {description ? <div className="archive-required-file-desc">{description}</div> : null}
            </div>
            <StatusTag tone={statusTone} toneMap={fileSlotStatusTone} value={resolvedStatus} />
          </div>
          <Space className="file-slot-list-actions" size={8} wrap>
            {renderUploadButton({ accept, disabled, fileSelected, multiple, replaceText, uploadText, onSelect })}
          </Space>
        </div>
        {showFileList ? (
          <div className="file-slot-list-panel">
            <FileTagList emptyText={emptyText} files={slotFiles} onDownload={onDownload} onPreview={onPreview} onRemove={onRemove} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={[
        'archive-required-file-card',
        primaryFile ? 'archive-required-file-card-uploaded' : undefined,
        density === 'compact' ? 'archive-required-file-card-compact' : undefined
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="archive-required-file-head">
        <div className="archive-required-file-copy">
          <div className="archive-required-file-title">{title}</div>
          {description ? <div className="archive-required-file-desc">{description}</div> : null}
        </div>
        <StatusTag tone={statusTone} toneMap={fileSlotStatusTone} value={resolvedStatus} />
      </div>
      <div className="archive-required-file-foot">
        <div className={primaryFile ? 'archive-required-file-name' : 'archive-required-file-name archive-required-file-name-empty'}>
          <FileTextOutlined />
          <span>{primaryFile?.name ?? emptyText}</span>
        </div>
        <Space className="archive-required-file-actions" size={6}>
          {renderUploadButton({ accept, disabled, fileSelected, multiple, replaceText, uploadText, onSelect })}
          {primaryFile && onPreview ? (
            <button className="archive-required-file-text-action" disabled={disabled} type="button" onClick={() => onPreview(primaryFile)}>
              <EyeOutlined />
              预览
            </button>
          ) : null}
          {primaryFile && onRemove ? (
            <button className="archive-required-file-text-action archive-required-file-text-action-danger" disabled={disabled} type="button" onClick={() => onRemove(primaryFile)}>
              <DeleteOutlined />
              删除
            </button>
          ) : null}
        </Space>
      </div>
    </div>
  );
}
