import { DeleteOutlined } from '@ant-design/icons';
import { Button, Input, Select } from 'antd';
import type { StoreTaskFileType } from './TaskManagementState';

export type TaskFileDraft = {
  id: string;
  name: string;
  type: StoreTaskFileType;
  url: string;
};

export function createTaskFileDraft(defaultType: StoreTaskFileType = 'PDF图纸'): TaskFileDraft {
  return {
    id: `task-file-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    type: defaultType,
    url: ''
  };
}

type TaskFileDraftEditorProps = {
  drafts: TaskFileDraft[];
  itemLabel: string;
  namePlaceholder: string;
  typeOptions: StoreTaskFileType[];
  urlPlaceholder?: string;
  onChange: <K extends keyof Omit<TaskFileDraft, 'id'>>(draftId: string, key: K, value: TaskFileDraft[K]) => void;
  onRemove: (draftId: string) => void;
};

export function TaskFileDraftEditor({
  drafts,
  itemLabel,
  namePlaceholder,
  typeOptions,
  urlPlaceholder = '粘贴飞书云盘链接',
  onChange,
  onRemove
}: TaskFileDraftEditorProps) {
  return (
    <div className="task-file-draft-list">
      <div className="task-file-draft-header">
        <span />
        <span>文件类型</span>
        <span>文件名称</span>
        <span>文件链接</span>
        <span>操作</span>
      </div>
      {drafts.map((draft, index) => (
        <div className="task-file-draft-row" key={draft.id}>
          <div className="task-file-draft-index">
            {itemLabel} {index + 1}
          </div>
          <Select
            aria-label={`${itemLabel} ${index + 1} 文件类型`}
            options={typeOptions.map((type) => ({ label: type, value: type }))}
            value={draft.type}
            onChange={(type) => onChange(draft.id, 'type', type)}
          />
          <Input
            aria-label={`${itemLabel} ${index + 1} 文件名称`}
            placeholder={namePlaceholder}
            value={draft.name}
            onChange={(event) => onChange(draft.id, 'name', event.target.value)}
          />
          <Input
            aria-label={`${itemLabel} ${index + 1} 文件链接`}
            placeholder={urlPlaceholder}
            value={draft.url}
            onChange={(event) => onChange(draft.id, 'url', event.target.value)}
          />
          <Button danger icon={<DeleteOutlined />} onClick={() => onRemove(draft.id)}>
            删除
          </Button>
        </div>
      ))}
    </div>
  );
}
