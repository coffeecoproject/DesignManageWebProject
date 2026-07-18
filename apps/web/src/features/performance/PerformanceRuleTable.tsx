import { PlusOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { StatusTag } from '../../components/Detail';
import { ManagementTable } from '../../components/ManagementTable';
import { CellText, CompactCell } from '../../components/TableCell';
import {
  formatEffectiveDate,
  formatRulePositionPreview,
  getRulePositions,
  ruleStatusTone,
  ruleTypeTone
} from './performanceRuleModel';
import type { PerformanceRulePreset, PerformanceRuleStatus } from './performanceTypes';

type PerformanceRuleTableProps = {
  records: PerformanceRulePreset[];
  onCreateRule: () => void;
  onRowClick: (rule: PerformanceRulePreset) => void;
};

export function PerformanceRuleTable({ records, onCreateRule, onRowClick }: PerformanceRuleTableProps) {
  const columns = useMemo<TableColumnsType<PerformanceRulePreset>>(
    () => [
      {
        title: '规则',
        key: 'rule',
        width: 236,
        render: (_, record) => <CompactCell primary={record.name} />
      },
      {
        title: '绩效类型',
        key: 'performanceType',
        width: 112,
        render: (_, record) => <StatusTag toneMap={ruleTypeTone} value={record.performanceType} />
      },
      {
        title: '绩效方案',
        key: 'category',
        width: 132,
        render: (_, record) => <StatusTag tone={record.category === '绘图任务制' ? 'blue' : 'gray'} value={record.category} />
      },
      {
        title: '适用岗位',
        key: 'scope',
        width: 136,
        render: (_, record) => (
          <CompactCell
            primary={formatRulePositionPreview(record)}
            secondary={getRulePositions(record).length > 2 ? `共 ${getRulePositions(record).length} 个岗位` : `${getRulePositions(record).length} 个岗位`}
          />
        )
      },
      {
        title: '版本',
        key: 'version',
        width: 92,
        render: (_, record) => <CellText>{record.currentVersion}</CellText>
      },
      {
        title: '依据文件',
        key: 'files',
        width: 164,
        render: (_, record) => (
          <CompactCell
            primary={record.sourceFiles.length > 0 ? `${record.sourceFiles.length} 份文件` : '待上传'}
            secondary={record.sourceFiles[0]?.name ?? record.generatedFileSummary}
          />
        )
      },
      {
        title: '生效日期',
        key: 'effective',
        width: 118,
        render: (_, record) => <CellText>{formatEffectiveDate(record)}</CellText>
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status: PerformanceRuleStatus) => <StatusTag toneMap={ruleStatusTone} value={status} />
      }
    ],
    []
  );

  return (
    <ManagementTable<PerformanceRulePreset>
      columns={columns}
      count={{ value: records.length, unit: '个版本' }}
      dataSource={records}
      primaryAction={{
        icon: <PlusOutlined />,
        label: '新增规则',
        testId: 'performance-rule-create-button',
        onClick: onCreateRule
      }}
      rowTestIdPrefix="performance-rule-table-row"
      rowKey="id"
      tableTestId="performance-rule-table"
      onRowClick={onRowClick}
    />
  );
}
