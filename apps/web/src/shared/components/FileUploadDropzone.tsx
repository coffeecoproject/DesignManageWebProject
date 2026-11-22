import { UploadOutlined } from '@ant-design/icons';
import { Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import type { ReactNode } from 'react';

type FileUploadDropzoneProps = {
  accept?: string;
  beforeUpload?: UploadProps['beforeUpload'];
  description?: ReactNode;
  fileList: UploadFile[];
  multiple?: boolean;
  title: ReactNode;
  uploadText: ReactNode;
  onChange: (fileList: UploadFile[]) => void;
};

export function FileUploadDropzone({
  accept,
  beforeUpload = () => false,
  description,
  fileList,
  multiple,
  title,
  uploadText,
  onChange
}: FileUploadDropzoneProps) {
  return (
    <div className="file-upload-dropzone">
      <div className="file-upload-dropzone-copy">
        <div className="file-upload-dropzone-title">{title}</div>
        {description ? <div className="file-upload-dropzone-desc">{description}</div> : null}
      </div>
      <Upload.Dragger
        accept={accept}
        beforeUpload={beforeUpload}
        className="file-upload-dropzone-control"
        fileList={fileList}
        multiple={multiple}
        onChange={({ fileList: nextFileList }) => onChange(nextFileList)}
      >
        <div className="file-upload-dropzone-inline">
          <span className="file-upload-dropzone-icon">
            <UploadOutlined />
          </span>
          <span className="file-upload-dropzone-action">{uploadText}</span>
        </div>
      </Upload.Dragger>
    </div>
  );
}
