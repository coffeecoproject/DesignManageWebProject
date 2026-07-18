import {
  AuditOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  PartitionOutlined,
  ProfileOutlined,
  SettingOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { ReactNode } from 'react';
import { DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import type { TaskConfigRow } from '../system/TaskConfigState';
import {
  formatEffectivePeriod,
  formatPerformancePayoutMode,
  formatMoney,
  formatRatio,
  formatRulePositions,
  formatScore,
  getCoreAmountFormulaRows,
  getRuleRelatedFileRecords,
  getRuleVersionOperationRecords,
  getTaskConfigName,
  ruleTypeTone,
  type AmountFormulaRow,
  type RuleRelatedFileRecord
} from './performanceRuleModel';
import type {
  PerformanceExcessBand,
  PerformanceQualityBand,
  PerformanceQualityDimension,
  PerformanceRulePreset,
  PerformanceTaskScoreItem
} from './performanceTypes';

type RuleReadonlyTabsProps = {
  activeRule: PerformanceRulePreset;
  onDownloadFile: (file: RuleRelatedFileRecord) => void;
  onPreviewFile: (file: RuleRelatedFileRecord) => void;
  taskConfigRows: TaskConfigRow[];
};

function EmptyRuleBlock({ text }: { text: string }) {
  return <div className="role-position-empty">{text}</div>;
}

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

const excessColumns: TableColumnsType<PerformanceExcessBand> = [
  {
    title: '任务完成分区间',
    dataIndex: 'scoreRange'
  },
  {
    title: '激励系数',
    key: 'multiplier',
    align: 'center',
    width: 160,
    render: (_, record) => `${record.multiplier} 倍`
  }
];

const qualityBandReadonlyColumns: TableColumnsType<PerformanceQualityBand> = [
  {
    title: '质量得分',
    dataIndex: 'scoreRange',
    width: 130,
    render: (value: PerformanceQualityBand['scoreRange']) => <span className="quality-band-score-range">{value}</span>
  },
  {
    title: '基础确认',
    key: 'qualityRatio',
    align: 'center',
    width: 110,
    render: (_, record) => <span className="quality-band-ratio-value">{formatRatio(record.qualityRatio)}</span>
  },
  {
    title: '超额确认',
    key: 'excessRatio',
    align: 'center',
    width: 110,
    render: (_, record) => <span className="quality-band-ratio-value">{formatRatio(record.excessRatio)}</span>
  },
  {
    title: '处理方式',
    dataIndex: 'handling',
    render: (value: PerformanceQualityBand['handling']) => <span className="quality-band-handling-value">{value}</span>
  }
];

function createTaskScoreReadonlyColumns(taskConfigRows: TaskConfigRow[]): TableColumnsType<PerformanceTaskScoreItem> {
  return [
    {
      title: '关联任务',
      key: 'task',
      render: (_, record) => <span className="task-score-name-value">{getTaskConfigName(record.taskConfigId, taskConfigRows)}</span>
    },
    {
      title: '任务分值',
      key: 'score',
      align: 'center',
      width: 160,
      render: (_, record) => (
        <span className="task-score-number-value">
          {record.score} 分 / {record.unit}
        </span>
      )
    }
  ];
}

const amountFormulaColumns: TableColumnsType<AmountFormulaRow> = [
  {
    title: '项目',
    dataIndex: 'item',
    width: 142
  },
  {
    title: '计算口径',
    dataIndex: 'method',
    width: 420
  }
];

function TaskScoreFormList({ items, taskConfigRows }: { items: PerformanceTaskScoreItem[]; taskConfigRows: TaskConfigRow[] }) {
  return (
    <Table
      className="detail-table task-score-readonly-table"
      columns={createTaskScoreReadonlyColumns(taskConfigRows)}
      dataSource={items}
      pagination={false}
      rowKey="id"
      scroll={{ x: 420 }}
      size="small"
    />
  );
}

function QualityDimensionFormList({ items }: { items: PerformanceQualityDimension[] }) {
  return (
    <div className="quality-dimension-list">
      {items.map((item) => (
        <div className="quality-dimension-item" key={item.id}>
          <div className="quality-dimension-main">
            <span className="quality-dimension-title">{item.name}</span>
            <span className="quality-dimension-score">
              <span className="quality-dimension-score-label">最高分值 / 权重</span>
              <span className="quality-dimension-score-value">{item.score}</span>
              <span className="quality-dimension-score-unit">分 / {formatRatio(item.weight)}</span>
            </span>
          </div>
          <div className="quality-dimension-content">
            <RuleDescriptionBlock label="评价重点" value={item.focus} />
            <RuleDescriptionBlock label="参考材料" value={item.evidence} />
          </div>
        </div>
      ))}
    </div>
  );
}

function QualityBandFormList({ items }: { items: PerformanceQualityBand[] }) {
  return (
    <Table
      className="detail-table quality-band-readonly-table"
      columns={qualityBandReadonlyColumns}
      dataSource={items}
      pagination={false}
      rowKey="id"
      scroll={{ x: 640 }}
      size="small"
    />
  );
}

export function PerformanceRuleReadonlyTabs({
  activeRule,
  onDownloadFile,
  onPreviewFile,
  taskConfigRows
}: RuleReadonlyTabsProps) {
  const relatedFileRecords = getRuleRelatedFileRecords(activeRule.sourceFiles);
  const versionOperationRecords = getRuleVersionOperationRecords(activeRule);
  const coreAmountFormulaRows = getCoreAmountFormulaRows(activeRule);

  return (
    <div className="rule-readonly-stack">
      <DetailSummaryCards
        items={[
          { icon: <PartitionOutlined />, key: 'performanceType', label: '绩效类型', value: activeRule.performanceType },
          { icon: <SettingOutlined />, key: 'category', label: '绩效方案', value: activeRule.category },
          { icon: <TeamOutlined />, key: 'positions', label: '适用岗位', value: formatRulePositions(activeRule) },
          { icon: <CheckCircleOutlined />, key: 'effectivePeriod', label: '生效区间', value: formatEffectivePeriod(activeRule) }
        ]}
      />
      <DetailTabs
        tabTestIdPrefix="performance-rule-detail-tab"
        testId="performance-rule-detail-tabs"
        items={[
          {
            key: 'overview',
            label: '规则概览',
            children: (
              <>
                <DetailSection icon={<SettingOutlined />} title="规则基础">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { label: '绩效类型', value: <StatusTag toneMap={ruleTypeTone} value={activeRule.performanceType} /> },
                      { label: '绩效方案', value: activeRule.category },
                      { label: '规则版本', value: activeRule.currentVersion },
                      { label: '适用岗位', value: formatRulePositions(activeRule) },
                      { label: '生效区间', value: formatEffectivePeriod(activeRule) },
                      { label: '适用边界', value: activeRule.scopeNote }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<ProfileOutlined />} title="执行摘要">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      {
                        label: '计分配置',
                        value: activeRule.performanceType === '任务制' ? '按任务类型配置绩效分值' : '提成制暂未开放'
                      },
                      { label: '质量评分', value: '固定四项质量评分模板，验收时填写' },
                      { label: '金额计算', value: '基础绩效 + 超额激励，质量比例取自质量档位' },
                      { label: '发放口径', value: formatPerformancePayoutMode(activeRule) }
                    ]}
                  />
                </DetailSection>
              </>
            )
          },
          {
            key: 'scoring',
            label: '计分配置',
            children: (
              <>
                {activeRule.taskScoreItems.length > 0 ? (
                  <DetailSection icon={<PartitionOutlined />} title={activeRule.performanceType === '任务制' ? '任务制绩效配置' : '计分配置'}>
                    <TaskScoreFormList items={activeRule.taskScoreItems} taskConfigRows={taskConfigRows} />
                  </DetailSection>
                ) : (
                  <EmptyRuleBlock text="该规则尚未配置任务计分项" />
                )}
                {activeRule.qualityDimensions.length > 0 ? (
                  <DetailSection icon={<CheckCircleOutlined />} title="固定质量评分">
                    <QualityDimensionFormList items={activeRule.qualityDimensions} />
                  </DetailSection>
                ) : (
                  <EmptyRuleBlock text="该规则尚未配置质量确认维度" />
                )}
              </>
            )
          },
          {
            key: 'quality-bands',
            label: '质量档位',
            children:
              activeRule.qualityBands.length > 0 ? (
                <DetailSection icon={<AuditOutlined />} title="质量确认档位配置">
                  <QualityBandFormList items={activeRule.qualityBands} />
                </DetailSection>
              ) : (
                <EmptyRuleBlock text="该规则尚未配置质量确认档位" />
              )
          },
          {
            key: 'calculation',
            label: '金额计算',
            children:
              activeRule.formulas.length > 0 ? (
                <>
                  <DetailSection icon={<CalculatorOutlined />} title="计算参数">
                    <DetailInfoGrid
                      columns={2}
                      items={[
                        { label: '满分', value: formatScore(activeRule.fullScore) },
                        { label: '达成线', value: formatScore(activeRule.baseLineScore) },
                        { label: '基础绩效金额', value: formatMoney(activeRule.basePerformanceAmount) },
                        { label: '未达标系数', value: formatRatio(activeRule.belowBaselineFactor) },
                        { label: '月度预发比例', value: formatRatio(activeRule.monthlyPrepayRatio) },
                        { label: '计分周期', value: activeRule.scoringCycle }
                      ]}
                    />
                  </DetailSection>
                  <DetailSection icon={<FileProtectOutlined />} title="超额激励">
                    <Table
                      className="detail-table"
                      columns={excessColumns}
                      dataSource={activeRule.excessBands}
                      pagination={false}
                      rowKey="id"
                      scroll={{ x: 420 }}
                      size="small"
                    />
                  </DetailSection>
                  <DetailSection icon={<CalculatorOutlined />} title="计算公式">
                    <Table
                      className="detail-table"
                      columns={amountFormulaColumns}
                      dataSource={coreAmountFormulaRows}
                      pagination={false}
                      rowKey="id"
                      scroll={{ x: 562 }}
                      size="small"
                    />
                  </DetailSection>
                  <DetailSection icon={<FileProtectOutlined />} title="发放说明">
                    <DetailInfoGrid
                      columns={2}
                      items={[
                        { label: '复核结算', value: activeRule.reviewCycle },
                        { label: '发放方式', value: formatPerformancePayoutMode(activeRule) },
                        { label: '质量比例来源', value: '取自质量档位' }
                      ]}
                    />
                  </DetailSection>
                </>
              ) : (
                <EmptyRuleBlock text="该规则尚未配置金额计算方式" />
              )
          },
          {
            key: 'files',
            label: '相关文件',
            children:
              activeRule.sourceFiles.length > 0 ? (
                <DetailSection icon={<FileProtectOutlined />} title="相关文件">
                  <RelatedFileTable<RuleRelatedFileRecord>
                    records={relatedFileRecords}
                    scrollX={690}
                    onDownload={onDownloadFile}
                    onPreview={onPreviewFile}
                  />
                </DetailSection>
              ) : (
                <EmptyRuleBlock text="该规则尚未上传规则依据文件" />
              )
          },
          {
            key: 'version',
            label: '版本记录',
            children:
              versionOperationRecords.length > 0 ? (
                <OperationRecordSection icon={<AuditOutlined />} records={versionOperationRecords} title="操作记录" />
              ) : (
                <EmptyRuleBlock text="该规则尚未形成版本记录" />
              )
          }
        ]}
      />
    </div>
  );
}
