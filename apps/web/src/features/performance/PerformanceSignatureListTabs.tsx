import { PlusOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { StatusTag } from '../../components/Detail';
import { TabbedManagementTable, createTabbedManagementTableItem } from '../../components/TabbedManagementTable';
import { CellText, CompactCell } from '../../components/TableCell';
import type { PerformanceRuleCategory } from './performanceTypes';
import type { PerformanceSignatureRelationRow, SignatureListTabKey } from './performanceSignatureModel';

type PerformanceSignatureListTabsProps = {
  activeKey: SignatureListTabKey;
  records: PerformanceSignatureRelationRow[];
  onChange: (key: SignatureListTabKey) => void;
  onCreateSignature: () => void;
  onRowClick: (record: PerformanceSignatureRelationRow) => void;
};

export function PerformanceSignatureListTabs({
  activeKey,
  records,
  onChange,
  onCreateSignature,
  onRowClick
}: PerformanceSignatureListTabsProps) {
  const columns = useMemo<TableColumnsType<PerformanceSignatureRelationRow>>(
    () => [
      {
        title: '员工',
        key: 'employee',
        width: 172,
        render: (_, record) => <CompactCell primary={record.employee.employeeName} secondary={record.employee.workNo} />
      },
      {
        title: '岗位',
        key: 'position',
        width: 126,
        render: (_, record) => <CompactCell primary={record.employee.position} secondary={record.employee.department} />
      },
      {
        title: '绩效类别',
        dataIndex: 'category',
        width: 130,
        render: (category: PerformanceRuleCategory) => <StatusTag tone={category === '绘图任务制' ? 'blue' : 'gray'} value={category} />
      },
      {
        title: activeKey === 'current' ? '当前版本' : '历史版本',
        key: 'rule',
        width: 104,
        render: (_, record) => <CellText>{record.file.ruleVersion}</CellText>
      },
      {
        title: '签署文件',
        key: 'file',
        width: 108,
        render: () => <StatusTag tone={activeKey === 'current' ? 'green' : 'gray'} value={activeKey === 'current' ? '已上传' : '已归档'} />
      },
      {
        title: '签署日期',
        key: 'latestSignedAt',
        width: 116,
        render: (_, record) => <CellText>{record.file.signedAt}</CellText>
      },
      {
        title: activeKey === 'current' ? '历史版本' : '文件说明',
        key: 'historyFiles',
        width: activeKey === 'current' ? 104 : 176,
        render: (_, record) =>
          activeKey === 'current' ? (
            <CellText tone={record.historyFiles.length > 0 ? 'strong' : 'subtle'}>{record.historyFiles.length} 份</CellText>
          ) : (
            <span className="detail-table-sub">{record.file.note}</span>
          )
      }
    ],
    [activeKey]
  );

  return (
    <TabbedManagementTable
      activeKey={activeKey}
      tabTestIdPrefix="performance-signature-list-tab"
      testId="performance-signature-list-tabs"
      tabs={[
        createTabbedManagementTableItem<PerformanceSignatureRelationRow>({
          key: 'current',
          label: '当前签署',
          table: {
            columns,
            count: { value: records.length, unit: '条当前签署' },
            dataSource: records,
            primaryAction: { icon: <PlusOutlined />, label: '新增签署', testId: 'performance-signature-create-button', onClick: onCreateSignature },
            rowTestIdPrefix: 'performance-signature-current-table-row',
            rowKey: 'id',
            tableTestId: 'performance-signature-current-table',
            onRowClick
          }
        }),
        createTabbedManagementTableItem<PerformanceSignatureRelationRow>({
          key: 'history',
          label: '历史签署',
          table: {
            columns,
            count: { value: records.length, unit: '条历史版本' },
            dataSource: records,
            rowTestIdPrefix: 'performance-signature-history-table-row',
            rowKey: 'id',
            tableTestId: 'performance-signature-history-table',
            onRowClick
          }
        })
      ]}
      onChange={(key) => onChange(key as SignatureListTabKey)}
    />
  );
}
