import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { CellText, CompactCell } from '../../components/TableCell';
import type { PerformanceRulePreset, PerformanceTaskScoreItem } from '../performance/performanceTypes';
import type { TaskConfigRow } from '../system/TaskConfigState';
import {
  getTaskConfigName,
  type BrandTaskDisplayRow,
  type BrandTaskFormDisplayRow
} from './brandFormModel';
import { CustomerTagList } from './CustomerShared';

const taskConfigColumns: TableColumnsType<BrandTaskDisplayRow> = [
  {
    title: '关联任务',
    key: 'name',
    width: 160,
    render: (_, record) => <CompactCell primary={record.name} secondary={record.category} />
  },
  {
    title: '绩效分值',
    key: 'score',
    align: 'center',
    width: 130,
    render: (_, record) => `${record.score} 分 / ${record.unit}`
  }
];

export function BrandTaskConfigSummary({ rows }: { rows: BrandTaskDisplayRow[] }) {
  if (rows.length === 0) {
    return <CellText tone="subtle">未选择</CellText>;
  }

  return (
    <CompactCell
      align="center"
      primary={`已选择 ${rows.length} 项`}
      secondarySlot={<CustomerTagList items={rows.map((row) => row.name)} maxVisible={1} />}
    />
  );
}

export function BrandTaskConfigTable({ rows }: { rows: BrandTaskDisplayRow[] }) {
  if (rows.length === 0) {
    return <CellText tone="subtle">该品牌暂未选择适用任务，后续创建任务前需要先补充。</CellText>;
  }

  return (
    <CompactDetailTable<BrandTaskDisplayRow>
      className="brand-task-config-table"
      columns={taskConfigColumns}
      dataSource={rows}
      rowKey="id"
      scrollX={420}
    />
  );
}

export function BrandTaskConfigEditor({
  addableTaskScoreItems,
  performanceRule,
  rows,
  selectedTaskConfigId,
  taskConfigRows,
  onAdd,
  onRemove,
  onSelectTaskConfig
}: {
  addableTaskScoreItems: PerformanceTaskScoreItem[];
  performanceRule: PerformanceRulePreset | undefined;
  rows: BrandTaskFormDisplayRow[];
  selectedTaskConfigId: string | undefined;
  taskConfigRows: TaskConfigRow[];
  onAdd: () => void;
  onRemove: (taskConfigId: string) => void;
  onSelectTaskConfig: (taskConfigId: string) => void;
}) {
  const editorColumns: TableColumnsType<BrandTaskFormDisplayRow> = [
    {
      title: '关联任务',
      key: 'name',
      width: 170,
      render: (_, record) => <CompactCell primary={record.name} secondary={record.category} />
    },
    {
      title: '绩效分值',
      key: 'score',
      align: 'center',
      width: 130,
      render: (_, record) => `${record.score} 分 / ${record.unit}`
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 88,
      render: (_, record) => (
        <Button danger icon={<DeleteOutlined />} size="small" type="text" onClick={() => onRemove(record.taskConfigId)}>
          移除
        </Button>
      )
    }
  ];

  return (
    <div className="brand-task-config-editor">
      <div className="brand-task-config-editor__toolbar">
        <CellText tone="subtle">当前已选择 {rows.length} 项</CellText>
        <div className="brand-task-config-editor__actions">
          <Select
            className="brand-task-config-editor__select"
            disabled={!performanceRule || addableTaskScoreItems.length === 0}
            placeholder={performanceRule ? (addableTaskScoreItems.length > 0 ? '选择任务类型' : '暂无可添加任务') : '先选择绩效方案'}
            value={selectedTaskConfigId}
            options={addableTaskScoreItems.map((taskScoreItem) => ({
              label: getTaskConfigName(taskScoreItem.taskConfigId, taskConfigRows),
              value: taskScoreItem.taskConfigId
            }))}
            onChange={onSelectTaskConfig}
          />
          <Button disabled={!selectedTaskConfigId} icon={<PlusOutlined />} onClick={onAdd}>
            添加任务类型
          </Button>
        </div>
      </div>
      {rows.length > 0 ? (
        <CompactDetailTable<BrandTaskFormDisplayRow>
          className="brand-task-config-table"
          columns={editorColumns}
          dataSource={rows}
          rowKey="taskConfigId"
          scrollX={420}
        />
      ) : (
        <div className="brand-task-config-editor__empty">
          <CellText>暂未选择适用任务</CellText>
          <CellText tone="subtle">从已绑定绩效方案中添加任务；任务分值只读。</CellText>
        </div>
      )}
      <p className="brand-task-config-editor__help">品牌只选择适用任务；任务分值来自绩效规则，计划交付时间在创建任务时填写。</p>
    </div>
  );
}
