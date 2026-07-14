import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DateScopeFilter, getDateScopeRange, type DateScopeFilterValue } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { FilterBar, FilterField, FilterPanel } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import { getAccountingSubjectByCode } from './financeAccountingSubjectData';
import {
  buildFinanceMonthEndMatterMetrics,
  confirmFinanceMonthEndMatter,
  financeMonthEndMatterStatusTone,
  financeMonthEndMatterTypeTone,
  type FinanceMonthEndMatterRecord,
  type FinanceMonthEndMatterStatus,
  type FinanceMonthEndMatterType
} from './financeMonthEndModel';
import { formatMoney } from './financeUtils';

type MonthEndFilters = {
  periodTime: DateScopeFilterValue;
  status: '全部' | FinanceMonthEndMatterStatus;
  type: '全部' | FinanceMonthEndMatterType;
};

const defaultFilters: MonthEndFilters = {
  periodTime: { mode: 'currentMonth' },
  status: '全部',
  type: '全部'
};

function matchesFilters(record: FinanceMonthEndMatterRecord, filters: MonthEndFilters) {
  const dateRange = getDateScopeRange(filters.periodTime, '2026-06');

  if (dateRange && (record.voucherDate < dateRange.startDate || record.voucherDate > dateRange.endDate)) {
    return false;
  }

  return (filters.status === '全部' || record.status === filters.status)
    && (filters.type === '全部' || record.type === filters.type);
}

function getSubjectLabel(subjectCode: string) {
  const subject = getAccountingSubjectByCode(subjectCode);

  return subject ? `${subject.code} ${subject.name}` : subjectCode;
}

function FinanceMonthEndMatterDrawer({
  record,
  onClose,
  onConfirm,
  onDownloadFile,
  onPreviewFile
}: {
  record?: FinanceMonthEndMatterRecord;
  onClose: () => void;
  onConfirm: (record: FinanceMonthEndMatterRecord) => void;
  onDownloadFile: (name: string) => void;
  onPreviewFile: (name: string) => void;
}) {
  if (!record) {
    return null;
  }

  const confirmable = record.status === '待确认';

  return (
    <DetailDrawerShell
      bodyTestId="finance-month-end-detail-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      primaryAction={
        confirmable
          ? {
              icon: <CheckCircleOutlined />,
              label: '确认生成凭证',
              onClick: () => onConfirm(record),
              testId: 'finance-month-end-confirm'
            }
          : undefined
      }
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={financeMonthEndMatterStatusTone}
          subtitle={`${record.sourceNo} / ${record.accountingPeriod}`}
          title="月末事项详情"
        />
      }
      width={820}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <ProfileOutlined />, key: 'type', label: '事项类型', value: record.type },
          { icon: <FileTextOutlined />, key: 'amount', label: '本期金额', value: formatMoney(record.amount) },
          { icon: <CalendarOutlined />, key: 'period', label: '会计期间', value: record.accountingPeriod },
          { icon: <ClockCircleOutlined />, key: 'status', label: '处理状态', value: record.status }
        ]}
      />

      <DetailTabs
        items={[
          {
            children: (
              <>
                <DetailSection icon={<ProfileOutlined />} title="来源事项">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '来源模块', value: record.sourceModule },
                      { label: '来源单号', value: record.sourceNo },
                      { label: '来源对象', value: record.sourceTitle },
                      { label: '事项类型', value: <StatusTag toneMap={financeMonthEndMatterTypeTone} value={record.type} /> },
                      { label: '会计期间', value: record.accountingPeriod },
                      { label: '本期金额', value: formatMoney(record.amount) },
                      { label: '说明', value: record.note, wide: true }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<FileTextOutlined />} title="原始凭证">
                  <RelatedFileTable
                    records={record.sourceFiles}
                    onDownload={(file) => onDownloadFile(file.name)}
                    onPreview={(file) => onPreviewFile(file.name)}
                  />
                </DetailSection>
              </>
            ),
            key: 'source',
            label: '来源事项'
          },
          {
            children: (
              <>
                <DetailSection icon={<FileTextOutlined />} title="凭证规则">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { label: '借方科目', value: getSubjectLabel(record.debitSubjectCode) },
                      { label: '贷方科目', value: getSubjectLabel(record.creditSubjectCode) },
                      { label: '凭证日期', value: record.voucherDate },
                      { label: '凭证状态', value: record.status === '待确认' ? '确认后生成待记账凭证' : record.status }
                    ]}
                  />
                </DetailSection>
                <OperationRecordSection icon={<AuditOutlined />} records={record.operationRecords} title="操作记录" />
              </>
            ),
            key: 'voucher',
            label: '凭证'
          }
        ]}
        testId="finance-month-end-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

export function FinanceMonthEndMattersPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { getAccountingPeriodGuard, monthEndMatterRows, updateMonthEndMatterRecord } = useFinanceManagement();
  const [filters, setFilters] = useState<MonthEndFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const rows = useMemo(
    () => monthEndMatterRows.filter((record) => matchesFilters(record, filters)),
    [filters, monthEndMatterRows]
  );
  const metrics = useMemo(() => buildFinanceMonthEndMatterMetrics(monthEndMatterRows), [monthEndMatterRows]);
  const activeRecord = useMemo(
    () => monthEndMatterRows.find((record) => record.id === activeRecordId),
    [activeRecordId, monthEndMatterRows]
  );

  function handleConfirm(record: FinanceMonthEndMatterRecord) {
    const periodGuard = getAccountingPeriodGuard(record.accountingPeriod, '确认月末事项');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    if (!updateMonthEndMatterRecord(record.id, (currentRecord) => confirmFinanceMonthEndMatter(currentRecord))) {
      void messageApi.warning('当前月末事项不可确认');
      return;
    }

    void messageApi.success('已生成待记账凭证');
  }

  const columns: TableColumnsType<FinanceMonthEndMatterRecord> = [
    {
      key: 'matter',
      title: '月末事项',
      width: 280,
      render: (_, record) => <CompactCell primary={record.title} secondary={`${record.sourceModule} / ${record.sourceNo}`} />
    },
    {
      dataIndex: 'type',
      title: '类型',
      width: 132,
      render: (type: FinanceMonthEndMatterType) => <StatusTag toneMap={financeMonthEndMatterTypeTone} value={type} />
    },
    {
      dataIndex: 'accountingPeriod',
      title: '会计期间',
      width: 116
    },
    {
      dataIndex: 'amount',
      title: '本期金额',
      width: 136,
      render: (amount: number) => formatMoney(amount)
    },
    {
      key: 'entries',
      title: '凭证科目',
      width: 250,
      render: (_, record) => <CompactCell primary={getSubjectLabel(record.debitSubjectCode)} secondary={getSubjectLabel(record.creditSubjectCode)} />
    },
    {
      dataIndex: 'status',
      title: '状态',
      width: 112,
      render: (status: FinanceMonthEndMatterStatus) => <StatusTag toneMap={financeMonthEndMatterStatusTone} value={status} />
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<FileTextOutlined />} label="本期事项" value={metrics.totalCount} />
          <MetricCard icon={<ClockCircleOutlined />} label="待确认" value={metrics.pendingConfirmationCount} />
          <MetricCard icon={<ProfileOutlined />} label="待记账" value={metrics.pendingBookingCount} />
          <MetricCard icon={<CheckCircleOutlined />} label="已记账" value={metrics.bookedCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth="2026-06"
              label="会计期间"
              modeOptions={[
                { label: '全部', value: 'all' },
                { label: '当月', value: 'currentMonth' },
                { label: '按月份', value: 'month' }
              ]}
              testIdPrefix="finance-month-end-period"
              value={filters.periodTime}
              onChange={(periodTime) => setFilters((current) => ({ ...current, periodTime }))}
            />
            <FilterField label="事项类型">
              <Select
                options={['全部', '固定资产折旧', '待摊费用摊销', '收入确认'].map((type) => ({ label: type, value: type }))}
                value={filters.type}
                onChange={(type) => setFilters((current) => ({ ...current, type }))}
              />
            </FilterField>
            <FilterField label="处理状态">
              <Select
                options={['全部', '待确认', '待记账', '已记账', '无需处理'].map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-month-end"
    >
      {contextHolder}
      <ManagementTable<FinanceMonthEndMatterRecord>
        columns={columns}
        count={{ value: rows.length, unit: '项' }}
        dataSource={rows}
        rowKey="id"
        rowTestIdPrefix="finance-month-end-table-row"
        tableTestId="finance-month-end-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />
      <FinanceMonthEndMatterDrawer
        record={activeRecord}
        onClose={() => setActiveRecordId(undefined)}
        onConfirm={handleConfirm}
        onDownloadFile={(name) => void messageApi.info(`已请求下载 ${name}`)}
        onPreviewFile={(name) => void messageApi.info(`已打开 ${name} 预览`)}
      />
    </ManagementPageScaffold>
  );
}
