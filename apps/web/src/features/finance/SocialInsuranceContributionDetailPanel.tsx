import { RollbackOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { StatusTag } from '../../components/Detail';
import { InlineRowActions, type InlineRowAction } from '../../components/InlineRowActions';
import { SummaryTablePanel } from '../../components/SummaryTablePanel';
import { CompactCell } from '../../components/TableCell';
import {
  getSocialInsuranceTotalAmount,
  socialInsuranceHandlingStatusTone,
  type SocialInsuranceEmployeeRecord,
  type SocialInsuranceHandlingStatus
} from './financeSocialInsuranceData';
import type { SocialInsuranceTaxMatterSummary } from './financeTaxMatterModel';
import { formatMoney } from './financeUtils';

type SocialInsuranceContributionDetailPanelProps = {
  isRecordLocked: (record: SocialInsuranceEmployeeRecord) => boolean;
  payableAmount: number;
  readOnly?: boolean;
  records: SocialInsuranceEmployeeRecord[];
  summary?: SocialInsuranceTaxMatterSummary;
  onStatusChange: (record: SocialInsuranceEmployeeRecord, status: SocialInsuranceHandlingStatus) => void;
};

function SocialInsuranceContributionActions({
  isLocked,
  onStatusChange,
  readOnly,
  record
}: {
  isLocked: boolean;
  readOnly?: boolean;
  record: SocialInsuranceEmployeeRecord;
  onStatusChange: (status: SocialInsuranceHandlingStatus) => void;
}) {
  if (readOnly) {
    return <InlineRowActions actions={[]} />;
  }

  const actions: InlineRowAction[] =
    record.handlingStatus === '待确认'
      ? [
          { disabled: isLocked, key: 'confirm', label: '确认', onClick: () => onStatusChange('已确认') },
          { disabled: isLocked, key: 'defer', label: '延期', onClick: () => onStatusChange('延期补缴') },
          { disabled: isLocked, key: 'skip', label: '不缴', tone: 'danger', onClick: () => onStatusChange('本月不缴') }
        ]
      : [
          {
            disabled: isLocked,
            icon: <RollbackOutlined />,
            key: 'rollback',
            label: record.handlingStatus === '已确认' ? '退回' : '恢复',
            onClick: () => onStatusChange('待确认')
          }
        ];

  return <InlineRowActions actions={actions} />;
}

export function SocialInsuranceContributionDetailPanel({
  isRecordLocked,
  payableAmount,
  readOnly,
  records,
  summary,
  onStatusChange
}: SocialInsuranceContributionDetailPanelProps) {
  const columns = useMemo<TableColumnsType<SocialInsuranceEmployeeRecord>>(
    () => [
      {
        className: 'summary-table-left-cell',
        dataIndex: 'employeeName',
        render: (_employeeName: string, record) => (
          <CompactCell primary={record.employeeName} secondary={`${record.employeeNo} / ${record.position}`} />
        ),
        title: '员工',
        width: 174
      },
      {
        dataIndex: 'contributionBase',
        render: (contributionBase: number) => formatMoney(contributionBase),
        title: '缴纳基数',
        width: 116
      },
      {
        key: 'amounts',
        render: (_, record) => (
          <CompactCell
            align="center"
            primary={formatMoney(record.companyAmount)}
            secondary={`个人 ${formatMoney(record.personalAmount)}`}
          />
        ),
        title: '单位金额',
        width: 136
      },
      {
        key: 'totalAmount',
        render: (_, record) => formatMoney(getSocialInsuranceTotalAmount(record)),
        title: '合计',
        width: 108
      },
      {
        dataIndex: 'handlingStatus',
        render: (status: SocialInsuranceEmployeeRecord['handlingStatus']) => (
          <StatusTag toneMap={socialInsuranceHandlingStatusTone} value={status} />
        ),
        title: '状态',
        width: 104
      },
      {
        key: 'action',
        render: (_, record) => (
          <SocialInsuranceContributionActions
            isLocked={isRecordLocked(record)}
            readOnly={readOnly}
            record={record}
            onStatusChange={(status) => onStatusChange(record, status)}
          />
        ),
        title: '操作',
        width: 142
      }
    ],
    [isRecordLocked, onStatusChange, readOnly]
  );

  return (
    <SummaryTablePanel<SocialInsuranceEmployeeRecord>
      columns={columns}
      dataSource={records}
      rowKey="id"
      scrollX={760}
      summaryItems={[
        { key: 'records', label: '明细人数', value: `${summary?.recordCount ?? records.length} 人` },
        { key: 'confirmed', label: '已确认', tone: 'income', value: `${summary?.confirmedCount ?? 0} 人` },
        { key: 'pending', label: '待确认', tone: 'muted', value: `${summary?.pendingCount ?? 0} 人` },
        { key: 'amount', label: '应缴金额', value: formatMoney(payableAmount) }
      ]}
      summaryLayout="amount-trailing"
      summaryMeta={`${summary?.period ?? '-'} / ${summary?.category ?? '缴费'}`}
      summaryTitle="缴费概览"
    />
  );
}
