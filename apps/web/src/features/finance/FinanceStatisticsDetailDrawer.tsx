import { BankOutlined, FileTextOutlined, ProfileOutlined } from '@ant-design/icons';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { ReportSummaryBar } from '../../components/ReportSummaryBar';
import { CellText } from '../../components/TableCell';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { formatMoney } from './financeUtils';
import {
  financeStatisticsAccrualSourceColumns,
  financeStatisticsTransactionColumns
} from './FinanceStatisticsColumns';
import {
  financeReportKindTone,
  getFinanceReportSourceRecordCount,
  getFinanceReportSummaryTone,
  type FinanceReportDrawerDetail
} from './financeStatisticsModel';

type FinanceStatisticsDetailDrawerProps = {
  detail?: FinanceReportDrawerDetail;
  onClose: () => void;
};

export function FinanceStatisticsDetailDrawer({ detail, onClose }: FinanceStatisticsDetailDrawerProps) {
  if (!detail) {
    return null;
  }

  return (
    <DetailDrawerShell
      bodyTestId="finance-statistics-detail-drawer"
      open={Boolean(detail)}
      title={
        <DetailDrawerTitle
          status={detail.kind}
          statusToneMap={financeReportKindTone}
          subtitle={`${detail.period} / ${detail.basis} / ${detail.aggregation}`}
          title={detail.title}
        />
      }
      width={920}
      onClose={onClose}
    >
      <ReportSummaryBar
        density="compact"
        meta={`${detail.primaryName ?? detail.aggregation}${detail.secondaryName ? ` / ${detail.secondaryName}` : ''}`}
        title="统计结果"
        items={[
          { key: 'income', label: '收入', tone: 'income', value: formatMoney(detail.income) },
          { key: 'expense', label: '支出', tone: 'expense', value: formatMoney(detail.expense) },
          {
            key: 'net',
            label: '收支差额',
            tone: getFinanceReportSummaryTone(detail.net),
            value: formatMoney(detail.net)
          },
          {
            key: 'source',
            label: '来源记录',
            tone: 'muted',
            value: `${getFinanceReportSourceRecordCount(detail)} 条`
          }
        ]}
      />

      <DetailTabs
        items={[
          {
            children: (
              <DetailSection icon={<ProfileOutlined />} title="统计信息">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '统计视角', value: detail.kind },
                    { label: '统计期间', value: detail.period },
                    { label: '统计口径', value: detail.basis },
                    { label: '统计归集', value: detail.aggregation },
                    { label: '一级类目', value: detail.primaryName },
                    { label: '二级类目', value: detail.secondaryName },
                    { label: '收入', value: formatMoney(detail.income) },
                    { label: '支出', value: formatMoney(detail.expense) },
                    { label: '收支差额', value: formatMoney(detail.net) }
                  ]}
                />
              </DetailSection>
            ),
            key: 'summary',
            label: '统计信息'
          },
          {
            children: (
              <DetailSection
                extra={<CellText tone="subtle">{detail.accrualRecords.length} 条</CellText>}
                icon={<FileTextOutlined />}
                title="应收应付来源"
              >
                <CompactDetailTable<FinanceReceivablePayableRecord>
                  columns={financeStatisticsAccrualSourceColumns}
                  dataSource={detail.accrualRecords}
                  emptyText="暂无应收应付来源"
                  rowKey="id"
                  scrollX={860}
                />
              </DetailSection>
            ),
            key: 'accrual',
            label: '应收应付来源'
          },
          {
            children: (
              <DetailSection
                extra={<CellText tone="subtle">{detail.transactionRecords.length} 条</CellText>}
                icon={<BankOutlined />}
                title="收支流水来源"
              >
                <CompactDetailTable<FinanceTransactionRecord>
                  columns={financeStatisticsTransactionColumns}
                  dataSource={detail.transactionRecords}
                  emptyText="暂无收支流水来源"
                  rowKey="id"
                  scrollX={860}
                />
              </DetailSection>
            ),
            key: 'transactions',
            label: '收支流水来源'
          }
        ]}
        tabTestIdPrefix="finance-statistics-detail-tab"
        testId="finance-statistics-detail-tabs"
      />
    </DetailDrawerShell>
  );
}
