import { FileSlot } from '../../components/FileSlot';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';

export type FinanceVoucherUploadFile = {
  name: string;
  size?: number;
  uid: string;
};

type FinanceVoucherUploadPanelProps = {
  description?: string;
  disabled?: boolean;
  emptyText?: string;
  files: RelatedFileRecord[];
  onDownload?: (file: RelatedFileRecord) => void;
  onPreview?: (file: RelatedFileRecord) => void;
  onRemove?: (file: RelatedFileRecord) => void;
  onSelect: (file: FinanceVoucherUploadFile) => void;
  title?: string;
};

export function FinanceVoucherUploadPanel({
  description = '支持上传 PDF/JPG/PNG，单个不超过 10MB。',
  disabled,
  emptyText = '暂无凭证文件',
  files,
  onDownload,
  onPreview,
  onRemove,
  onSelect,
  title = '上传凭证'
}: FinanceVoucherUploadPanelProps) {
  const status = files[0]?.status ?? '待补充';

  return (
    <div className="finance-voucher-panel">
      <FileSlot
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
        description={description}
        disabled={disabled}
        emptyText={emptyText}
        files={[]}
        showFileList={false}
        status={status}
        title={title}
        uploadText="上传文件"
        variant="list"
        onSelect={onSelect}
      />
      {files.length > 0 ? (
        <RelatedFileTable
          records={files}
          scrollX={620}
          onDelete={disabled ? undefined : onRemove}
          onDownload={onDownload}
          onPreview={onPreview}
        />
      ) : (
        <div className="finance-voucher-empty">{emptyText}</div>
      )}
    </div>
  );
}
