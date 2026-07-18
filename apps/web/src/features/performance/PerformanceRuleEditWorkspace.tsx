import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select, Space, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useState, type ReactNode } from 'react';
import { ReadOnlyField } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import { FileSlot, FileSlotGrid } from '../../components/FileSlot';
import { TagChip } from '../../components/TagChip';
import { CellText } from '../../components/TableCell';
import type { TaskConfigRow } from '../system/TaskConfigState';
import {
  formatRatio,
  formatPerformancePayoutMode,
  getRuleReviewBlockerText,
  getTaskConfigName,
  performanceEligiblePositionOptions,
  performanceRuleBasisFileAccept,
  performanceRuleBasisFileMaxSizeMb,
  performanceRuleTypeOptions,
  type ruleCategoryOptions,
  type RuleRelatedFileRecord
} from './performanceRuleModel';
import type {
  PerformanceExcessBand,
  PerformanceFormulaItem,
  PerformanceQualityBand,
  PerformanceQualityDimension,
  PerformanceRuleCategory,
  PerformanceRulePreset,
  PerformanceRuleType,
  PerformanceStructuredField,
  PerformanceTaskScoreItem
} from './performanceTypes';

type RuleEditWorkspaceProps = {
  activeRule: PerformanceRulePreset;
  baseConfigComplete: boolean;
  canSubmitReview: boolean;
  currentCategoryOptions: typeof ruleCategoryOptions;
  draftBasisFile?: UploadFile;
  draftBasisFileRecord?: RuleRelatedFileRecord;
  draftCategory: PerformanceRuleCategory;
  draftPerformanceType: PerformanceRuleType;
  draftPositions: string[];
  onAddTask: (taskConfigId: string) => void;
  onCategoryChange: (category: PerformanceRuleCategory) => void;
  onFilesChange: (files: UploadFile[]) => void;
  onPerformanceTypeChange: (performanceType: PerformanceRuleType) => void;
  onPositionsChange: (positions: string[]) => void;
  onPreviewFile: (file: RuleRelatedFileRecord) => void;
  onRemoveTask: (itemId: string) => void;
  onUpdateTask: <K extends keyof PerformanceTaskScoreItem>(itemId: string, key: K, value: PerformanceTaskScoreItem[K]) => void;
  taskConfigRows: TaskConfigRow[];
};

const formulaColumns: TableColumnsType<PerformanceFormulaItem> = [
  {
    title: '计算项目',
    dataIndex: 'item',
    width: 142
  },
  {
    title: '输入项',
    dataIndex: 'variables',
    width: 260,
    render: (variables: string[]) => (
      <Space size={[4, 4]} wrap>
        {variables.map((variable) => (
          <TagChip key={variable} label={variable} />
        ))}
      </Space>
    )
  },
  {
    title: '公式',
    dataIndex: 'method',
    width: 360
  },
  {
    title: '输出结果',
    dataIndex: 'result',
    width: 140
  }
];

function RuleDescriptionBlock({
  inline,
  label,
  value
}: {
  inline?: boolean;
  label: string;
  value: ReactNode;
}) {
  const displayValue = value === undefined || value === null || value === '' ? '-' : value;

  return (
    <div className={['rule-description-block', inline ? 'rule-description-block-inline' : undefined].filter(Boolean).join(' ')}>
      <span className="rule-description-label">{label}</span>
      <span className="rule-description-value">{displayValue}</span>
    </div>
  );
}

function RuleEditInput({
  label,
  multiline,
  value
}: {
  label: string;
  multiline?: boolean;
  value: string | number;
}) {
  return (
    <label className={['rule-edit-field', multiline ? 'rule-edit-field-wide' : undefined].filter(Boolean).join(' ')}>
      <span className="field-label">{label}</span>
      {multiline ? (
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} defaultValue={String(value)} />
      ) : (
        <Input defaultValue={String(value)} />
      )}
    </label>
  );
}

function RuleEditTaskForm({
  items,
  onAddTask,
  onRemoveTask,
  onUpdateTask,
  taskConfigRows
}: {
  items: PerformanceTaskScoreItem[];
  onAddTask: (taskConfigId: string) => void;
  onRemoveTask: (itemId: string) => void;
  onUpdateTask: <K extends keyof PerformanceTaskScoreItem>(itemId: string, key: K, value: PerformanceTaskScoreItem[K]) => void;
  taskConfigRows: TaskConfigRow[];
}) {
  const addableTaskConfigRows = taskConfigRows.filter(
    (taskConfig) => taskConfig.status === '启用' && !items.some((item) => item.taskConfigId === taskConfig.id)
  );
  const [taskConfigIdToAdd, setTaskConfigIdToAdd] = useState<string>();

  function handleAddTask() {
    if (!taskConfigIdToAdd) {
      return;
    }

    onAddTask(taskConfigIdToAdd);
    setTaskConfigIdToAdd(undefined);
  }

  return (
    <div className="rule-edit-task-configurator">
      <div className="brand-task-config-toolbar">
        <CellText tone="subtle">已配置 {items.length} 个任务类型</CellText>
        <div className="brand-task-config-actions">
          <Select
            className="brand-task-config-select"
            disabled={addableTaskConfigRows.length === 0}
            placeholder={addableTaskConfigRows.length > 0 ? '选择任务类型' : '暂无可添加任务'}
            value={taskConfigIdToAdd}
            options={addableTaskConfigRows.map((taskConfig) => ({ label: taskConfig.name, value: taskConfig.id }))}
            onChange={setTaskConfigIdToAdd}
          />
          <Button disabled={!taskConfigIdToAdd} icon={<PlusOutlined />} onClick={handleAddTask}>
            添加任务
          </Button>
        </div>
      </div>
      <div className="rule-edit-card-list">
        {items.map((item) => (
          <div className="rule-edit-card" key={item.id}>
            <div className="rule-edit-card-title">
              <span>{getTaskConfigName(item.taskConfigId, taskConfigRows)}</span>
              <Button danger icon={<DeleteOutlined />} size="small" type="text" onClick={() => onRemoveTask(item.id)}>
                移除
              </Button>
            </div>
            <div className="rule-edit-grid">
              <label className="rule-edit-field">
                <span className="field-label">任务分值</span>
                <InputNumber
                  addonAfter="分"
                  min={0}
                  precision={1}
                  value={item.score}
                  onChange={(value) => onUpdateTask(item.id, 'score', value ?? 0)}
                />
              </label>
              <ReadOnlyField density="compact" label="计分单位" value={item.unit} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleEditQualityForm({ items }: { items: PerformanceQualityDimension[] }) {
  return (
    <div className="rule-edit-card-list">
      {items.map((item) => (
        <div className="rule-edit-card" key={item.id}>
          <div className="rule-edit-card-title">{item.name}</div>
          <div className="rule-edit-grid">
            <ReadOnlyField density="compact" label="最高分值" value={`${item.score} 分`} />
            <ReadOnlyField density="compact" label="权重" value={formatRatio(item.weight)} />
            <div className="rule-description-grid">
              <RuleDescriptionBlock label="评价重点" value={item.focus} />
              <RuleDescriptionBlock label="参考材料" value={item.evidence} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RuleEditQualityBandForm({ items }: { items: PerformanceQualityBand[] }) {
  return (
    <div className="rule-edit-card-list">
      {items.map((item) => (
        <div className="rule-edit-card" key={item.id}>
          <div className="rule-edit-card-title">{item.scoreRange}</div>
          <div className="rule-edit-grid">
            <RuleEditInput label="基础确认比例" value={formatRatio(item.qualityRatio)} />
            <RuleEditInput label="超额确认比例" value={formatRatio(item.excessRatio)} />
            <div className="rule-description-grid">
              <RuleDescriptionBlock inline label="处理方式" value={item.handling} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RuleEditExcessBandForm({ items }: { items: PerformanceExcessBand[] }) {
  return (
    <div className="rule-edit-card-list">
      {items.map((item) => (
        <div className="rule-edit-card" key={item.id}>
          <div className="rule-edit-card-title">{item.scoreRange}</div>
          <div className="rule-edit-grid">
            <RuleEditInput label="超额激励" value={item.multiplier} />
            <ReadOnlyField density="compact" label="单位" value="倍" />
            <ReadOnlyField density="compact" label="确认要求" value={item.requirement} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RuleEditParameterForm({ items }: { items: PerformanceStructuredField[] }) {
  const editableItems = items.filter((item) => item.fieldKey !== 'review_cycle');

  return (
    <div className="rule-edit-grid">
      {editableItems.map((item) => (
        <RuleEditInput key={item.id} label={item.label} value={item.example} />
      ))}
    </div>
  );
}

export function PerformanceRuleEditWorkspace({
  activeRule,
  baseConfigComplete,
  canSubmitReview,
  currentCategoryOptions,
  draftBasisFile,
  draftBasisFileRecord,
  draftCategory,
  draftPerformanceType,
  draftPositions,
  onAddTask,
  onCategoryChange,
  onFilesChange,
  onPerformanceTypeChange,
  onPositionsChange,
  onPreviewFile,
  onRemoveTask,
  onUpdateTask,
  taskConfigRows
}: RuleEditWorkspaceProps) {
  return (
    <div className="rule-edit-workspace">
      {activeRule.status === '审核驳回' ? <div className="rule-edit-hint">审核已驳回，调整配置后可重新提交审核。</div> : null}
      <div className={canSubmitReview ? 'rule-edit-hint rule-edit-hint-success' : 'rule-edit-hint'}>{getRuleReviewBlockerText(activeRule)}</div>
      <DetailTabs
        tabTestIdPrefix="performance-rule-edit-tab"
        testId="performance-rule-edit-tabs"
        items={[
          {
            key: 'base',
            label: '基础配置',
            children: (
              <section className="rule-edit-panel">
                <div className="rule-edit-grid">
                  <label className="rule-edit-field rule-edit-field-wide">
                    <span className="field-label">绩效类型</span>
                    <Select
                      options={performanceRuleTypeOptions.map((option) => ({
                        disabled: option.disabled,
                        label: `${option.type}${option.disabled ? '（暂未开放）' : ''}`,
                        value: option.type
                      }))}
                      value={draftPerformanceType}
                      onChange={onPerformanceTypeChange}
                    />
                  </label>
                  <label className="rule-edit-field rule-edit-field-wide">
                    <span className="field-label">绩效方案</span>
                    <Select
                      disabled={currentCategoryOptions.filter((option) => !option.disabled).length <= 1}
                      options={currentCategoryOptions.map((option) => ({
                        disabled: option.disabled,
                        label: `${option.category}${option.disabled ? '（暂未开放）' : ''}`,
                        value: option.category
                      }))}
                      value={draftCategory}
                      onChange={onCategoryChange}
                    />
                  </label>
                  <ReadOnlyField density="compact" label="规则名称" value={activeRule.name} />
                  <ReadOnlyField density="compact" label="规则版本" value={activeRule.currentVersion} />
                  <ReadOnlyField density="compact" label="计分周期" value={activeRule.scoringCycle} />
                  <ReadOnlyField density="compact" label="复核结算" value={activeRule.reviewCycle} />
                  <ReadOnlyField density="compact" label="发放方式" value={formatPerformancePayoutMode(activeRule)} />
                  <label className="rule-edit-field rule-edit-field-wide">
                    <span className="field-label">适用岗位</span>
                    <Select
                      mode="multiple"
                      options={performanceEligiblePositionOptions.map((position) => ({ label: position, value: position }))}
                      placeholder="选择适用的全职岗位"
                      value={draftPositions}
                      onChange={onPositionsChange}
                    />
                  </label>
                  <div className="rule-edit-field rule-edit-field-wide">
                    <FileSlotGrid flush>
                      <FileSlot
                        accept={performanceRuleBasisFileAccept}
                        description={`上传绩效规则依据或确认文件，支持 DOC/DOCX/PDF/JPG/PNG，单个文件不超过 ${performanceRuleBasisFileMaxSizeMb}MB。`}
                        file={draftBasisFile ? { id: draftBasisFile.uid, name: draftBasisFile.name, status: '已选择' } : undefined}
                        status={draftBasisFile ? '已选择' : '未上传'}
                        statusTone={draftBasisFile ? 'green' : 'amber'}
                        title="规则依据文件 *"
                        onPreview={draftBasisFileRecord ? () => onPreviewFile(draftBasisFileRecord) : undefined}
                        onRemove={() => onFilesChange([])}
                        onSelect={(file) => onFilesChange([file])}
                      />
                    </FileSlotGrid>
                  </div>
                </div>
                {!baseConfigComplete ? (
                  <div className="rule-edit-hint">完成适用岗位和规则依据文件后，可继续配置任务计分、质量确认、金额参数和公式预览。</div>
                ) : null}
              </section>
            )
          },
          ...(baseConfigComplete
            ? [
                {
                  key: 'tasks',
                  label: '任务计分',
                  children: (
                    <section className="rule-edit-panel">
                      <RuleEditTaskForm
                        items={activeRule.taskScoreItems}
                        taskConfigRows={taskConfigRows}
                        onAddTask={onAddTask}
                        onRemoveTask={onRemoveTask}
                        onUpdateTask={onUpdateTask}
                      />
                    </section>
                  )
                },
                {
                  key: 'quality',
                  label: '质量评分',
                  children: (
                    <section className="rule-edit-panel">
                      <div className="rule-edit-hint">任务制质量评分当前为系统固定模板，不在绩效方案内自定义。</div>
                      <RuleEditQualityForm items={activeRule.qualityDimensions} />
                      <div className="rule-edit-subsection-title">质量确认比例</div>
                      <RuleEditQualityBandForm items={activeRule.qualityBands} />
                    </section>
                  )
                },
                {
                  key: 'amount',
                  label: '金额参数',
                  children: (
                    <section className="rule-edit-panel">
                      <RuleEditParameterForm items={activeRule.ruleParameterFields} />
                      <div className="rule-edit-subsection-title">超额激励参数</div>
                      <RuleEditExcessBandForm items={activeRule.excessBands} />
                    </section>
                  )
                },
                {
                  key: 'formula',
                  label: '公式预览',
                  children: (
                    <section className="rule-edit-panel">
                      <Table
                        className="detail-table"
                        columns={formulaColumns}
                        dataSource={activeRule.formulas}
                        pagination={false}
                        rowKey="id"
                        scroll={{ x: 902 }}
                        size="small"
                      />
                    </section>
                  )
                }
              ]
            : [])
        ]}
      />
    </div>
  );
}
