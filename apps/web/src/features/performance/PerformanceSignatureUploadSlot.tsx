import type { UploadFile } from 'antd/es/upload/interface';
import { FileSlot, FileSlotGrid } from '../../components/FileSlot';

type PerformanceSignatureUploadSlotProps = {
  description: string;
  fileName: string | null;
  onSelect: (file: UploadFile) => void;
  title: string;
};

export function PerformanceSignatureUploadSlot({
  description,
  fileName,
  onSelect,
  title
}: PerformanceSignatureUploadSlotProps) {
  return (
    <FileSlotGrid flush>
      <FileSlot
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
        density="compact"
        description={description}
        file={fileName ? { id: fileName, name: fileName, status: '已选择' } : undefined}
        status={fileName ? '已选择' : '未上传'}
        statusTone={fileName ? 'green' : 'amber'}
        title={title}
        onSelect={onSelect}
      />
    </FileSlotGrid>
  );
}
