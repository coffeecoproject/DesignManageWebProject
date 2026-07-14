import { CalendarOutlined, FileTextOutlined, ProfileOutlined, WalletOutlined } from '@ant-design/icons';
import { Segmented, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { FilterBar, FilterField, FilterPanel } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { CompactCell } from '../../components/TableCell';
import {
  financeFixedAssetRecords,
  financePrepaidExpenseRecords,
  type FinanceFixedAssetRecord,
  type FinancePrepaidExpenseRecord
} from './financeMonthEndSourceData';
import { formatMoney } from './financeUtils';

type MonthEndSourceView = '固定资产' | '待摊费用';
type MonthEndSourceRecord = FinanceFixedAssetRecord | FinancePrepaidExpenseRecord;

const assetStatusTone = { 使用中: 'green' } as const;
const prepaidStatusTone = { 使用中: 'blue', 已摊销完毕: 'gray' } as const;

function isFixedAsset(record: MonthEndSourceRecord): record is FinanceFixedAssetRecord {
  return 'assetNo' in record;
}

function getSourceNo(record: MonthEndSourceRecord) {
  return isFixedAsset(record) ? record.assetNo : record.sourceNo;
}

function MonthEndSourceDrawer({
  record,
  onClose,
  onDownloadFile,
  onPreviewFile
}: {
  record?: MonthEndSourceRecord;
  onClose: () => void;
  onDownloadFile: (name: string) => void;
  onPreviewFile: (name: string) => void;
}) {
  if (!record) {
    return null;
  }

  const asset = isFixedAsset(record);
  const statusToneMap = asset ? assetStatusTone : prepaidStatusTone;
  const currentPeriodAmount = asset ? record.monthlyDepreciation : record.monthlyAmortization;

  return (
    <DetailDrawerShell
      bodyTestId="finance-assets-prepayments-detail-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={statusToneMap}
          subtitle={getSourceNo(record)}
          title={asset ? '固定资产详情' : '待摊费用详情'}
        />
      }
      width={800}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <ProfileOutlined />, key: 'title', label: asset ? '资产名称' : '事项名称', value: record.title },
          { icon: <WalletOutlined />, key: 'amount', label: asset ? '原值' : '原始金额', value: formatMoney(asset ? record.originalCost : record.originalAmount) },
          { icon: <CalendarOutlined />, key: 'current', label: asset ? '本期折旧' : '本期摊销', value: formatMoney(currentPeriodAmount) },
          { icon: <FileTextOutlined />, key: 'status', label: '状态', value: record.status }
        ]}
      />
      <DetailTabs
        items={[
          {
            children: (
              <DetailSection icon={<ProfileOutlined />} title={asset ? '资产信息' : '摊销信息'}>
                <DetailInfoGrid
                  columns={3}
                  items={
                    asset
                      ? [
                          { label: '资产编号', value: record.assetNo },
                          { label: '使用部门', value: record.department },
                          { label: '启用日期', value: record.startDate },
                          { label: '预计使用月数', value: `${record.usefulLifeMonths} 个月` },
                          { label: '累计折旧', value: formatMoney(record.accumulatedDepreciation) },
                          { label: '本期折旧', value: formatMoney(record.monthlyDepreciation) }
                        ]
                      : [
                          { label: '来源单号', value: record.sourceNo },
                          { label: '受益开始', value: record.startDate },
                          { label: '受益结束', value: record.endDate },
                          { label: '已摊销金额', value: formatMoney(record.amortizedAmount) },
                          { label: '未摊销金额', value: formatMoney(record.remainingAmount) },
                          { label: '本期摊销', value: formatMoney(record.monthlyAmortization) }
                        ]
                  }
                />
              </DetailSection>
            ),
            key: 'information',
            label: '基础信息'
          },
          {
            children: (
              <DetailSection icon={<FileTextOutlined />} title="原始凭证">
                <RelatedFileTable records={record.files} onDownload={(file) => onDownloadFile(file.name)} onPreview={(file) => onPreviewFile(file.name)} />
              </DetailSection>
            ),
            key: 'files',
            label: '原始凭证'
          }
        ]}
        testId="finance-assets-prepayments-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

export function FinanceAssetsPrepaymentsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [activeSourceNo, setActiveSourceNo] = useState<string>();
  const [view, setView] = useState<MonthEndSourceView>('固定资产');
  const activeRows = view === '固定资产' ? financeFixedAssetRecords : financePrepaidExpenseRecords;
  const activeRecord = useMemo(
    () => activeRows.find((record) => getSourceNo(record) === activeSourceNo),
    [activeRows, activeSourceNo]
  );

  const assetColumns: TableColumnsType<FinanceFixedAssetRecord> = [
    {
      key: 'asset',
      title: '资产',
      width: 280,
      render: (_, record) => <CompactCell primary={record.title} secondary={record.assetNo} />
    },
    { dataIndex: 'department', title: '使用部门', width: 150 },
    { dataIndex: 'startDate', title: '启用日期', width: 140 },
    { dataIndex: 'originalCost', title: '资产原值', width: 150, render: (amount: number) => formatMoney(amount) },
    { dataIndex: 'usefulLifeMonths', title: '预计使用月数', width: 150, render: (months: number) => `${months} 个月` },
    { dataIndex: 'monthlyDepreciation', title: '本期折旧', width: 150, render: (amount: number) => formatMoney(amount) },
    { dataIndex: 'status', title: '状态', width: 112, render: (status: FinanceFixedAssetRecord['status']) => <StatusTag toneMap={assetStatusTone} value={status} /> }
  ];

  const prepaidColumns: TableColumnsType<FinancePrepaidExpenseRecord> = [
    {
      key: 'prepaid',
      title: '待摊事项',
      width: 300,
      render: (_, record) => <CompactCell primary={record.title} secondary={record.sourceNo} />
    },
    { key: 'benefitPeriod', title: '受益期间', width: 210, render: (_, record) => `${record.startDate} 至 ${record.endDate}` },
    { dataIndex: 'originalAmount', title: '原始金额', width: 150, render: (amount: number) => formatMoney(amount) },
    { dataIndex: 'remainingAmount', title: '未摊销金额', width: 150, render: (amount: number) => formatMoney(amount) },
    { dataIndex: 'monthlyAmortization', title: '本期摊销', width: 150, render: (amount: number) => formatMoney(amount) },
    { dataIndex: 'status', title: '状态', width: 112, render: (status: FinancePrepaidExpenseRecord['status']) => <StatusTag toneMap={prepaidStatusTone} value={status} /> }
  ];

  const totalAmount = view === '固定资产'
    ? financeFixedAssetRecords.reduce((total, record) => total + record.originalCost, 0)
    : financePrepaidExpenseRecords.reduce((total, record) => total + record.remainingAmount, 0);
  const currentPeriodAmount = view === '固定资产'
    ? financeFixedAssetRecords.reduce((total, record) => total + record.monthlyDepreciation, 0)
    : financePrepaidExpenseRecords.reduce((total, record) => total + record.monthlyAmortization, 0);

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={3}>
          <MetricCard icon={<ProfileOutlined />} label={view === '固定资产' ? '使用中资产' : '待摊事项'} value={activeRows.length} />
          <MetricCard icon={<WalletOutlined />} label={view === '固定资产' ? '资产原值' : '未摊销余额'} value={formatMoney(totalAmount)} />
          <MetricCard icon={<CalendarOutlined />} label={view === '固定资产' ? '本期折旧' : '本期摊销'} value={formatMoney(currentPeriodAmount)} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="来源类型">
              <Segmented<MonthEndSourceView>
                options={['固定资产', '待摊费用']}
                value={view}
                onChange={(value) => {
                  setActiveSourceNo(undefined);
                  setView(value);
                }}
              />
            </FilterField>
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-assets-prepayments"
    >
      {contextHolder}
      {view === '固定资产' ? (
        <ManagementTable<FinanceFixedAssetRecord>
          columns={assetColumns}
          count={{ value: financeFixedAssetRecords.length, unit: '项' }}
          dataSource={financeFixedAssetRecords}
          rowKey="assetNo"
          rowTestIdPrefix="finance-fixed-assets-table-row"
          tableTestId="finance-fixed-assets-table"
          onRowClick={(record) => setActiveSourceNo(record.assetNo)}
        />
      ) : (
        <ManagementTable<FinancePrepaidExpenseRecord>
          columns={prepaidColumns}
          count={{ value: financePrepaidExpenseRecords.length, unit: '项' }}
          dataSource={financePrepaidExpenseRecords}
          rowKey="sourceNo"
          rowTestIdPrefix="finance-prepaid-expenses-table-row"
          tableTestId="finance-prepaid-expenses-table"
          onRowClick={(record) => setActiveSourceNo(record.sourceNo)}
        />
      )}
      <MonthEndSourceDrawer
        record={activeRecord}
        onClose={() => setActiveSourceNo(undefined)}
        onDownloadFile={(name) => void messageApi.info(`已请求下载 ${name}`)}
        onPreviewFile={(name) => void messageApi.info(`已打开 ${name} 预览`)}
      />
    </ManagementPageScaffold>
  );
}
