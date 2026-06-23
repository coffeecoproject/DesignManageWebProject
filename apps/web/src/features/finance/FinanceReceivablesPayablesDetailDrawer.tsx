import {
  CalendarOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { TagChip } from '../../components/TagChip';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  getReceivablePayableOutstandingAmount,
  receivablePayableDirectionTone,
  receivablePayableStatusTone
} from './financeReceivablesPayablesData';
import {
  financeReceivablePayableLinkedTransactionColumns
} from './FinanceReceivablesPayablesColumns';
import {
  getFinanceReceivablePayableAmountLabels,
  getFinanceReceivablePayableSettlementProgress
} from './financeReceivablesPayablesModel';
import { formatMoney } from './financeUtils';

type FinanceReceivablesPayablesDetailDrawerProps = {
  linkedTransactionRows: FinanceTransactionRecord[];
  onClose: () => void;
  record?: FinanceReceivablePayableRecord;
};

export function FinanceReceivablesPayablesDetailDrawer({
  linkedTransactionRows,
  onClose,
  record
}: FinanceReceivablesPayablesDetailDrawerProps) {
  if (!record) {
    return null;
  }

  const amountLabels = getFinanceReceivablePayableAmountLabels(record.direction);
  const outstandingAmount = getReceivablePayableOutstandingAmount(record);

  return (
    <DetailDrawerShell
      bodyTestId="finance-rp-detail-drawer"
      open={Boolean(record)}
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={receivablePayableStatusTone}
          subtitle={`${record.documentNo} / ${record.accountingPeriod}`}
          title={`${record.direction}详情`}
        />
      }
      width={780}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          {
            icon: <ProfileOutlined />,
            key: 'counterparty',
            label: '对象',
            value: record.counterparty
          },
          {
            icon: <FileProtectOutlined />,
            key: 'amount',
            label: amountLabels.amount,
            value: formatMoney(record.amount)
          },
          {
            icon: <WalletOutlined />,
            key: 'outstanding',
            label: amountLabels.outstanding,
            value: formatMoney(outstandingAmount)
          },
          {
            icon: <CalendarOutlined />,
            key: 'dueDate',
            label: '到期日',
            value: record.dueDate
          }
        ]}
      />

      <DetailTabs
        items={[
          {
            children: (
              <DetailSection icon={<ProfileOutlined />} title="确认信息">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    {
                      label: '确认方向',
                      value: <StatusTag toneMap={receivablePayableDirectionTone} value={record.direction} />
                    },
                    {
                      label: '确认状态',
                      value: <StatusTag toneMap={receivablePayableStatusTone} value={record.status} />
                    },
                    { label: '结清进度', value: getFinanceReceivablePayableSettlementProgress(record) },
                    { label: '确认期间', value: record.accountingPeriod },
                    { label: '确认日期', value: record.confirmDate },
                    { label: '到期日', value: record.dueDate },
                    { label: '财务类目', value: record.category },
                    { label: '统计归集', value: record.reportAggregation },
                    { label: '责任人', value: record.owner },
                    { label: '来源类型', value: record.sourceType },
                    { label: '来源单号', value: record.sourceNo },
                    { label: '来源名称', value: record.sourceTitle },
                    { label: amountLabels.amount, value: formatMoney(record.amount) },
                    { label: amountLabels.settled, value: formatMoney(record.settledAmount) },
                    { label: amountLabels.outstanding, value: formatMoney(outstandingAmount) },
                    { label: '备注', value: record.note, wide: true }
                  ]}
                />
              </DetailSection>
            ),
            key: 'basic',
            label: '确认信息'
          },
          {
            children: (
              <DetailSection
                extra={<TagChip label={`${linkedTransactionRows.length} 条`} tone={linkedTransactionRows.length > 0 ? 'blue' : 'gray'} />}
                icon={<FileSearchOutlined />}
                title="关联流水"
              >
                <CompactDetailTable<FinanceTransactionRecord>
                  columns={financeReceivablePayableLinkedTransactionColumns}
                  dataSource={linkedTransactionRows}
                  emptyText="暂无关联流水"
                  rowKey="id"
                  scrollX={800}
                />
              </DetailSection>
            ),
            key: 'transactions',
            label: '关联流水'
          },
          {
            children: (
              <DetailSection icon={<FileProtectOutlined />} title="对应文件">
                <RelatedFileTable records={record.files} />
              </DetailSection>
            ),
            key: 'files',
            label: '对应文件'
          },
          {
            children: (
              <OperationRecordSection
                icon={<CheckCircleOutlined />}
                records={record.operationRecords}
                title="操作记录"
              />
            ),
            key: 'operations',
            label: '操作记录'
          }
        ]}
        tabTestIdPrefix="finance-rp-detail-tab"
        testId="finance-rp-detail-tabs"
      />
    </DetailDrawerShell>
  );
}
