import {
  AuditOutlined,
  CalculatorOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  SwapOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Alert, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateRangeFilterValue,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { ManagementTableTabs } from '../../components/ManagementTableTabs';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import { useFinanceManagement } from './FinanceManagementState';
import { FinanceTransactionAdjustmentDrawer } from './FinanceTransactionAdjustmentDrawer';
import { getFinanceTransactionAdjustmentBlocker } from './financeTransactionAdjustmentModel';
import {
  type FinancePaymentMethod,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionCategory,
  type FinanceTransactionDirection,
  type FinanceTransactionRecord,
  type FinanceTransactionStatus
} from './financeData';
import {
  directionTone,
  formatMoney,
  getAmountTone,
  getFinanceCategoryDisplayName,
  getFinanceDirectionLabels,
  getFinanceRecordCategorySnapshot,
  getPublicAccountSignedAmount,
  financeToday,
  transactionStatusTone
} from './financeUtils';

type FinanceTransactionFilters = {
  category: '全部' | FinanceTransactionCategory;
  keyword: string;
  occurredTime: DateScopeFilterValue;
  primaryCategory: '全部' | string;
  status: '全部' | FinanceTransactionStatus;
};

type FinanceTransactionListTabKey = Extract<FinanceTransactionDirection, '收入' | '支出'>;

const financeTransactionDefaultMonth = financeToday.slice(0, 7);
const financeTransactionDefaultMonthRange = getDateScopeMonthRange(financeTransactionDefaultMonth);

const defaultFilters: FinanceTransactionFilters = {
  category: '全部',
  keyword: '',
  occurredTime: { mode: 'currentMonth' },
  primaryCategory: '全部',
  status: '全部'
};

const transactionListTabs: Array<{ key: FinanceTransactionListTabKey; label: string }> = [
  { key: '收入', label: '收入' },
  { key: '支出', label: '支出' }
];

function isEmployeeHandledMethod(paymentMethod: FinancePaymentMethod) {
  return paymentMethod === '员工代收' || paymentMethod === '现金暂收';
}

function isPublicAccountMethod(paymentMethod: FinancePaymentMethod) {
  return paymentMethod === '对公账户收款' ||
    paymentMethod === '对公账户付款' ||
    paymentMethod === '员工代收' ||
    paymentMethod === '现金暂收';
}

function getActivePrimaryRows(primaryRows: FinancePrimaryCategoryConfig[]) {
  return primaryRows.filter((row) => row.status === '启用').sort((left, right) => left.sortOrder - right.sortOrder);
}

function getActiveSecondaryRows(primaryRows: FinancePrimaryCategoryConfig[], secondaryRows: FinanceSecondaryCategoryConfig[]) {
  const activePrimaryIds = new Set(getActivePrimaryRows(primaryRows).map((row) => row.id));

  return secondaryRows
    .filter((row) => row.status === '启用' && activePrimaryIds.has(row.primaryId))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function getPublicAccountDisplay(record: Pick<FinanceTransactionRecord, 'publicAccountSnapshot'>) {
  return record.publicAccountSnapshot.displayName;
}

function getTransactionTableLabels(direction: FinanceTransactionListTabKey) {
  if (direction === '收入') {
    return {
      amount: '收款金额',
      counterparty: '收款对象',
      handler: '收款经办人',
      publicAccount: '入账对公账户'
    };
  }

  return {
    amount: '付款金额',
    counterparty: '付款对象',
    handler: '付款经办人',
    publicAccount: '付款对公账户'
  };
}

function DrawerTitle({ record }: { record: FinanceTransactionRecord }) {
  return (
    <DetailDrawerTitle
      status={record.status}
      statusToneMap={transactionStatusTone}
      subtitle={`${record.transactionNo} / ${record.occurredAt} / ${getFinanceRecordCategorySnapshot(record).secondaryName}`}
      title="流水详情"
    />
  );
}

function matchesFilters(
  record: FinanceTransactionRecord,
  filters: FinanceTransactionFilters,
  occurredDateRange: DateRangeFilterValue | undefined
) {
  if (
    occurredDateRange &&
    (record.occurredAt < occurredDateRange.startDate || record.occurredAt > occurredDateRange.endDate)
  ) {
    return false;
  }

  if (filters.category !== '全部' && record.category !== filters.category) {
    return false;
  }

  const snapshot = getFinanceRecordCategorySnapshot(record);

  if (filters.primaryCategory !== '全部' && snapshot.primaryName !== filters.primaryCategory) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [
    record.transactionNo,
    record.counterparty,
    record.category,
    snapshot.primaryName,
    snapshot.reportAggregation,
    record.sourceNo,
    record.sourceTitle,
    record.publicAccountSnapshot.displayName,
    record.note
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function FinanceTransactionsPage() {
  const [searchParams] = useSearchParams();
  const deepLinkQuery = searchParams.toString();
  const handledDeepLinkRef = useRef('');
  const [messageApi, contextHolder] = message.useMessage();
  const {
    addFinanceTransaction,
    financeRows: records,
    getAccountingPeriodGuard
  } = useFinanceManagement();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const [activeTab, setActiveTab] = useState<FinanceTransactionListTabKey>('收入');
  const [filters, setFilters] = useState<FinanceTransactionFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [adjustmentDrawerOpen, setAdjustmentDrawerOpen] = useState(false);

  useEffect(() => {
    if (!deepLinkQuery || handledDeepLinkRef.current === deepLinkQuery) {
      return;
    }

    const transactionNo = new URLSearchParams(deepLinkQuery).get('transactionNo')?.trim();
    const target = transactionNo
      ? records.find((record) => record.transactionNo === transactionNo)
      : undefined;

    if (!target) {
      return;
    }

    handledDeepLinkRef.current = deepLinkQuery;
    setActiveTab(target.direction === '支出' ? '支出' : '收入');
    setActiveRecordId(target.id);
  }, [deepLinkQuery, records]);
  const occurredDateRange = useMemo(
    () => getDateScopeRange(filters.occurredTime, financeTransactionDefaultMonth),
    [filters.occurredTime]
  );

  const rows = useMemo(
    () =>
      records
        .filter((record) => {
          if (record.direction !== activeTab) {
            return false;
          }

          return matchesFilters(record, filters, occurredDateRange);
        })
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.transactionNo.localeCompare(left.transactionNo)),
    [activeTab, filters, occurredDateRange, records]
  );
  const tabCounts = useMemo(
    () =>
      records.reduce<Record<FinanceTransactionListTabKey, number>>(
        (counts, record) => {
          if (record.direction !== '收入' && record.direction !== '支出') {
            return counts;
          }

          if (matchesFilters(record, filters, occurredDateRange)) {
            counts[record.direction] += 1;
          }

          return counts;
        },
        { 收入: 0, 支出: 0 }
      ),
    [filters, occurredDateRange, records]
  );
  const listTabs = useMemo(
    () =>
      transactionListTabs.map((tab) => ({
        key: tab.key,
        label: `${tab.label} ${tabCounts[tab.key]}`
      })),
    [tabCounts]
  );

  const activeRecord = activeRecordId ? records.find((record) => record.id === activeRecordId) : undefined;
  const activeRecordAdjustmentGuard = activeRecord
    ? getAccountingPeriodGuard(activeRecord.accountingPeriod, '发起冲正补差')
    : undefined;
  const activeRecordPeriodReadbackNotice =
    activeRecordAdjustmentGuard && !activeRecordAdjustmentGuard.allowed
      ? `${activeRecordAdjustmentGuard.reason} 原流水仅用于回看，不在已结账期间发起冲正补差。`
      : undefined;
  const activeRows = rows.filter((record) => record.status !== '已作废');
  const receiptTotal = activeRows
    .filter((record) => record.direction === '收入' && getFinanceRecordCategorySnapshot(record).includeInReport)
    .reduce((total, record) => total + record.amount, 0);
  const paymentTotal = activeRows
    .filter((record) => record.direction === '支出' && getFinanceRecordCategorySnapshot(record).includeInReport)
    .reduce((total, record) => total + record.amount, 0);
  const publicAccountNetTotal = activeRows.reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);
  const pendingRows = activeRows.filter((record) => record.status === '待复核');
  const activePrimaryRows = getActivePrimaryRows(financePrimaryCategories);
  const activeSecondaryRows = getActiveSecondaryRows(financePrimaryCategories, financeSecondaryCategories);
  const filterPrimaryOptions = Array.from(new Set([...activePrimaryRows.map((row) => row.name), ...records.map((record) => getFinanceRecordCategorySnapshot(record).primaryName)])).filter(Boolean);
  const filterSecondaryOptions = Array.from(new Set([...activeSecondaryRows.map((row) => row.name), ...records.map((record) => record.category)])).filter(Boolean);

  const tableLabels = getTransactionTableLabels(activeTab);
  const columns: TableColumnsType<FinanceTransactionRecord> = [
    {
      title: '发生日期',
      dataIndex: 'occurredAt',
      width: 116,
      render: (occurredAt: string, record) => <CompactCell primary={occurredAt} secondary={record.accountingPeriod} />
    },
    {
      title: '流水号',
      dataIndex: 'transactionNo',
      width: 154,
      render: (transactionNo: string, record) => <CompactCell primary={transactionNo} secondary={record.paymentMethod} />
    },
    {
      title: '财务类目',
      dataIndex: 'category',
      width: 150,
      render: (_category: FinanceTransactionCategory, record) => {
        const snapshot = getFinanceRecordCategorySnapshot(record);

        return <CompactCell primary={snapshot.secondaryName} secondary={`${snapshot.primaryName} / ${snapshot.reportAggregation}`} />;
      }
    },
    {
      title: tableLabels.counterparty,
      dataIndex: 'counterparty',
      width: 128,
      render: (counterparty: string) => <CompactCell primary={counterparty} />
    },
    {
      title: tableLabels.amount,
      dataIndex: 'amount',
      width: 132,
      render: (amount: number, record) => <CellText tone={getAmountTone(record)}>{formatMoney(amount)}</CellText>
    },
    {
      title: tableLabels.handler,
      dataIndex: 'handler',
      width: 96,
      render: (handler: string | undefined) => <CellText tone={handler ? 'strong' : 'subtle'}>{handler}</CellText>
    },
    {
      title: tableLabels.publicAccount,
      dataIndex: ['publicAccountSnapshot', 'displayName'],
      width: 132,
      render: (_displayName: string, record) => (
        <CompactCell primary={getPublicAccountDisplay(record)} secondary={record.publicAccountSnapshot.bankName} />
      )
    },
    {
      title: '流水状态',
      dataIndex: 'status',
      width: 104,
      render: (status: FinanceTransactionStatus) => <StatusTag toneMap={transactionStatusTone} value={status} />
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<WalletOutlined />} label="业务收款" value={formatMoney(receiptTotal)} />
          <MetricCard icon={<WalletOutlined />} label="对公付款" value={formatMoney(paymentTotal)} />
          <MetricCard icon={<CalculatorOutlined />} label="对公账户净流入" value={formatMoney(publicAccountNetTotal)} />
          <MetricCard icon={<FileSearchOutlined />} label="待复核流水" value={pendingRows.length} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={financeTransactionDefaultMonth}
              defaultRange={financeTransactionDefaultMonthRange}
              label="发生日期"
              testIdPrefix="finance-transaction-date-filter"
              value={filters.occurredTime}
              onChange={(occurredTime) => setFilters((current) => ({ ...current, occurredTime }))}
            />
            <FilterField label="一级类目">
              <Select
                data-testid="finance-transaction-primary-category-filter"
                value={filters.primaryCategory}
                options={['全部', ...filterPrimaryOptions].map((category) => ({ label: category, value: category }))}
                onChange={(primaryCategory) => setFilters((current) => ({ ...current, primaryCategory }))}
              />
            </FilterField>
            <FilterField label="二级类目">
              <Select
                data-testid="finance-transaction-category-filter"
                value={filters.category}
                options={(['全部', ...filterSecondaryOptions] satisfies FinanceTransactionFilters['category'][]).map((category) => ({
                  label: category === '全部' ? category : getFinanceCategoryDisplayName(category),
                  value: category
                }))}
                onChange={(category) => setFilters((current) => ({ ...current, category }))}
              />
            </FilterField>
            <FilterField label="流水状态">
              <Select
                data-testid="finance-transaction-status-filter"
                value={filters.status}
                options={(['全部', '待复核', '退回修改', '已入账', '已作废'] satisfies FinanceTransactionFilters['status'][]).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-transaction-keyword-input"
              placeholder="流水号 / 对象 / 类目 / 来源"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTableTabs
        activeKey={activeTab}
        items={listTabs}
        tabTestIdPrefix="finance-transaction-list-tab"
        testId="finance-transaction-list-tabs"
        onChange={(nextTab) => {
          setActiveTab(nextTab as FinanceTransactionListTabKey);
          setActiveRecordId(undefined);
        }}
      />
      <ManagementTable<FinanceTransactionRecord>
        columns={columns}
        count={{ value: rows.length, unit: '条流水' }}
        dataSource={rows}
        rowTestIdPrefix="finance-transaction-table-row"
        rowKey="id"
        tableTestId="finance-transaction-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />

      <DetailDrawerShell
        bodyTestId="finance-transaction-detail-drawer"
        className="finance-transaction-drawer"
        closeAction={{
          label: '关闭',
          testId: 'finance-transaction-close-button',
          onClick: () => {
            setActiveRecordId(undefined);
            setAdjustmentDrawerOpen(false);
          }
        }}
        open={Boolean(activeRecord)}
        secondaryAction={
          activeRecord?.status === '已入账' && !activeRecordPeriodReadbackNotice
            ? {
                icon: <SwapOutlined />,
                label: '冲正补差',
                testId: 'finance-transaction-adjustment-open-button',
                onClick: () => setAdjustmentDrawerOpen(true)
              }
            : undefined
        }
        title={activeRecord ? <DrawerTitle record={activeRecord} /> : null}
        width={900}
        onClose={() => {
          setActiveRecordId(undefined);
          setAdjustmentDrawerOpen(false);
        }}
      >
        {activeRecord ? (
          <>
            <DetailSummaryCards
              columns={3}
              items={[
                {
                  icon: <ProfileOutlined />,
                  key: 'counterparty',
                  label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).counterparty,
                  value: activeRecord.counterparty
                },
                {
                  icon: <WalletOutlined />,
                  key: 'amount',
                  label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).amount,
                  value: formatMoney(activeRecord.amount)
                },
                { icon: <AuditOutlined />, key: 'status', label: '流水状态', value: activeRecord.status }
              ]}
            />
            {activeRecordPeriodReadbackNotice ? (
              <Alert
                className="finance-period-readback-alert"
                message={activeRecordPeriodReadbackNotice}
                showIcon
                type="info"
              />
            ) : null}
            <DetailTabs
              defaultActiveKey="flow"
              tabTestIdPrefix="finance-transaction-detail-tab"
              testId="finance-transaction-detail-tabs"
              items={[
                {
                  key: 'flow',
                  label: '流水信息',
                  children: (
                    <div className="detail-tab-stack">
                      <DetailSection icon={<WalletOutlined />} title="基础信息">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '流水号', value: activeRecord.transactionNo },
                            { label: '发生日期', value: activeRecord.occurredAt },
                            { label: '财务期间', value: activeRecord.accountingPeriod },
                            { label: '收支方向', value: <StatusTag toneMap={directionTone} value={activeRecord.direction} /> },
                            { label: '一级类目', value: getFinanceRecordCategorySnapshot(activeRecord).primaryName },
                            { label: '二级类目', value: getFinanceRecordCategorySnapshot(activeRecord).secondaryName },
                            { label: '统计归集', value: getFinanceRecordCategorySnapshot(activeRecord).reportAggregation },
                            {
                              label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).amount,
                              value: <CellText tone={getAmountTone(activeRecord)}>{formatMoney(activeRecord.amount)}</CellText>
                            },
                            ...(activeRecord.naturalPersonPayment?.incomeType === '劳务报酬'
                              ? [
                                  { label: '税前劳务金额', value: formatMoney(activeRecord.naturalPersonPayment.grossIncomeAmount) },
                                  { label: '代扣个税', value: formatMoney(activeRecord.naturalPersonPayment.withheldTaxAmount) },
                                  { label: '银行实付金额', value: formatMoney(activeRecord.naturalPersonPayment.netPaymentAmount) },
                                  { label: '扣缴期间', value: activeRecord.naturalPersonPayment.taxPeriod }
                                ]
                              : []),
                            { label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).paymentMethod, value: activeRecord.paymentMethod },
                            ...(isPublicAccountMethod(activeRecord.paymentMethod)
                              ? [{ label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).publicAccount, value: getPublicAccountDisplay(activeRecord) }]
                              : []),
                            ...(isEmployeeHandledMethod(activeRecord.paymentMethod)
                              ? [{ label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).handler, value: activeRecord.handler }]
                              : []),
                            { label: '备注', value: activeRecord.note, wide: true }
                          ]}
                        />
                      </DetailSection>
                      <DetailSection icon={<FileSearchOutlined />} title="业务来源">
                        <DetailInfoGrid
                          columns={2}
                          items={[
                            { label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).counterparty, value: activeRecord.counterparty },
                            { label: '来源类型', value: activeRecord.sourceType },
                            { label: '来源单号', value: activeRecord.sourceNo },
                            ...(activeRecord.naturalPersonPayment?.incomeType === '劳务报酬'
                              ? [
                                  { label: '结算批次', value: activeRecord.naturalPersonPayment.sourceBatchNo },
                                  {
                                    label: '来源任务',
                                    value: activeRecord.naturalPersonPayment.sourceRecordNos?.join('、') || '-'
                                  }
                                ]
                              : []),
                            { label: '事项说明', value: activeRecord.sourceTitle, wide: true }
                          ]}
                        />
                      </DetailSection>
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: '状态与凭证',
                  children: (
                    <div className="detail-tab-stack">
                      <DetailSection icon={<AuditOutlined />} title="状态信息">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '登记人', value: activeRecord.registeredBy },
                            { label: '流水状态', value: <StatusTag toneMap={transactionStatusTone} value={activeRecord.status} /> }
                          ]}
                        />
                      </DetailSection>
                      <DetailSection icon={<FileProtectOutlined />} title={getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).voucherSection}>
                        <RelatedFileTable
                          records={activeRecord.files}
                        />
                      </DetailSection>
                    </div>
                  )
                },
                {
                  key: 'logs',
                  label: '操作记录',
                  children: (
                    <OperationRecordSection icon={<AuditOutlined />} records={activeRecord.operationRecords} title="操作记录" />
                  )
                }
              ]}
            />
          </>
        ) : null}
      </DetailDrawerShell>
      <FinanceTransactionAdjustmentDrawer
        existingRows={records}
        open={adjustmentDrawerOpen}
        originRecord={activeRecord}
        onClose={() => setAdjustmentDrawerOpen(false)}
        onSubmit={(record) => {
          const periodGuard = getAccountingPeriodGuard(record.accountingPeriod, '生成冲正补差流水');
          const originRecord = records.find(
            (candidate) => candidate.transactionNo === record.adjustmentContext?.originTransactionNo
          );
          const adjustmentBlocker = record.adjustmentContext
            ? getFinanceTransactionAdjustmentBlocker(
                originRecord,
                record.adjustmentContext.mode,
                records,
                record.id
              )
            : undefined;

          if (!periodGuard.allowed) {
            void messageApi.warning(periodGuard.reason);
            return;
          }

          if (adjustmentBlocker) {
            void messageApi.warning(adjustmentBlocker);
            return;
          }

          if (!addFinanceTransaction(record)) {
            void messageApi.warning('冲正补差流水未生成，请重新核对原流水状态');
            return;
          }

          setAdjustmentDrawerOpen(false);
          void messageApi.success('已生成待复核调整流水');
        }}
      />
    </ManagementPageScaffold>
  );
}
