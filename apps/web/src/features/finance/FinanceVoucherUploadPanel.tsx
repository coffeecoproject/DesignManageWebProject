import { FileSlot } from '../../components/FileSlot';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';

export type FinanceVoucherUploadFile = {
  name: string;
  size?: number;
  uid: string;
};

type FinanceVoucherUploadPanelProps = {
  description?: string;
  emptyText?: string;
  files: RelatedFileRecord[];
  onRemove?: (file: RelatedFileRecord) => void;
  onSelect: (file: FinanceVoucherUploadFile) => void;
  title?: string;
};

export function FinanceVoucherUploadPanel({
  description = '支持上传 PDF/JPG/PNG，单个不超过 10MB。',
  emptyText = '暂无凭证文件',
  files,
  onRemove,
  onSelect,
  title = '上传凭证'
}: FinanceVoucherUploadPanelProps) {
  return (
    <div className="finance-voucher-panel">
      <FileSlot
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
        description={description}
        emptyText={emptyText}
        files={files}
        status={files[0]?.status ?? '待补充'}
        title={title}
        uploadText="上传文件"
        variant="list"
        onRemove={onRemove}
        onSelect={onSelect}
      />
    </div>
  );
}
