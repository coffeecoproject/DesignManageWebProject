import {
  AuditOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  SwapOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Alert, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateRangeFilterValue,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
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
import {
  type FinanceInvoiceDeclarationStatus,
  type FinancePaymentMethod,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionCategory,
  type FinanceTransactionDirection,
  type FinanceTransactionRecord,
  type FinanceTransactionStatus
} from './financeData';
import {
  buildTransactionInvoiceAssociation,
  type FinanceTransactionInvoiceAssociation,
  type FinanceTransactionMatchedInvoice
} from './financeInvoiceModel';
import {
  directionTone,
  formatMoney,
  getAmountTone,
  getFinanceCategoryDisplayName,
  getFinanceDirectionLabels,
  getFinanceRecordCategorySnapshot,
  getFinanceTransactionInvoiceDeclarationStatus,
  getPublicAccountSignedAmount,
  financeToday,
  invoiceDeclarationStatusTone,
  invoiceAssociationStatusTone,
  transactionStatusTone
} from './financeUtils';

type FinanceTransactionFilters = {
  category: '全部' | FinanceTransactionCategory;
  invoiceDeclaration: '全部' | FinanceInvoiceDeclarationStatus;
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
  invoiceDeclaration: '全部',
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
  occurredDateRange: DateRangeFilterValue | undefined,
  invoiceAssociation: FinanceTransactionInvoiceAssociation,
  invoiceDeclarationStatus: FinanceInvoiceDeclarationStatus
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

  if (filters.invoiceDeclaration !== '全部' && invoiceDeclarationStatus !== filters.invoiceDeclaration) {
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
    invoiceAssociation.status,
    invoiceDeclarationStatus,
    record.note
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function FinanceTransactionsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { addFinanceTransaction, financeRows: records, getAccountingPeriodGuard, invoiceRows } = useFinanceManagement();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const [activeTab, setActiveTab] = useState<FinanceTransactionListTabKey>('收入');
  const [filters, setFilters] = useState<FinanceTransactionFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [adjustmentDrawerOpen, setAdjustmentDrawerOpen] = useState(false);
  const occurredDateRange = useMemo(
    () => getDateScopeRange(filters.occurredTime, financeTransactionDefaultMonth),
    [filters.occurredTime]
  );

  const invoiceAssociationByTransactionNo = useMemo(
    () =>
      new Map(
        records.map((record) => [
          record.transactionNo,
          buildTransactionInvoiceAssociation(record, invoiceRows)
        ])
      ),
    [invoiceRows, records]
  );
  const invoiceDeclarationStatusByTransactionNo = useMemo(
    () =>
      new Map(
        records.map((record) => {
          const invoiceAssociation =
            invoiceAssociationByTransactionNo.get(record.transactionNo) ??
            buildTransactionInvoiceAssociation(record, invoiceRows);

          return [
            record.transactionNo,
            getFinanceTransactionInvoiceDeclarationStatus(record, invoiceAssociation)
          ];
        })
      ),
    [invoiceAssociationByTransactionNo, invoiceRows, records]
  );
  const rows = useMemo(
    () =>
      records
        .filter((record) => {
          if (record.direction !== activeTab) {
            return false;
          }

          const invoiceAssociation =
            invoiceAssociationByTransactionNo.get(record.transactionNo) ??
            buildTransactionInvoiceAssociation(record, invoiceRows);
          const invoiceDeclarationStatus =
            invoiceDeclarationStatusByTransactionNo.get(record.transactionNo) ??
            getFinanceTransactionInvoiceDeclarationStatus(record, invoiceAssociation);

          return matchesFilters(record, filters, occurredDateRange, invoiceAssociation, invoiceDeclarationStatus);
        })
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.transactionNo.localeCompare(left.transactionNo)),
    [activeTab, filters, invoiceAssociationByTransactionNo, invoiceDeclarationStatusByTransactionNo, invoiceRows, occurredDateRange, records]
  );
  const tabCounts = useMemo(
    () =>
      records.reduce<Record<FinanceTransactionListTabKey, number>>(
        (counts, record) => {
          if (record.direction !== '收入' && record.direction !== '支出') {
            return counts;
          }

          const invoiceAssociation =
            invoiceAssociationByTransactionNo.get(record.transactionNo) ??
            buildTransactionInvoiceAssociation(record, invoiceRows);
          const invoiceDeclarationStatus =
            invoiceDeclarationStatusByTransactionNo.get(record.transactionNo) ??
            getFinanceTransactionInvoiceDeclarationStatus(record, invoiceAssociation);

          if (matchesFilters(record, filters, occurredDateRange, invoiceAssociation, invoiceDeclarationStatus)) {
            counts[record.direction] += 1;
          }

          return counts;
        },
        { 收入: 0, 支出: 0 }
      ),
    [filters, invoiceAssociationByTransactionNo, invoiceDeclarationStatusByTransactionNo, invoiceRows, occurredDateRange, records]
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
  const activeRecordInvoiceAssociation = activeRecord
    ? invoiceAssociationByTransactionNo.get(activeRecord.transactionNo) ?? buildTransactionInvoiceAssociation(activeRecord, invoiceRows)
    : undefined;
  const activeRecordInvoiceDeclarationStatus =
    activeRecord && activeRecordInvoiceAssociation
      ? invoiceDeclarationStatusByTransactionNo.get(activeRecord.transactionNo) ??
        getFinanceTransactionInvoiceDeclarationStatus(activeRecord, activeRecordInvoiceAssociation)
      : undefined;
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
  const pendingInvoiceDeclarationCount = activeRows.filter((record) => {
    const status =
      invoiceDeclarationStatusByTransactionNo.get(record.transactionNo) ??
      '不适用';

    return status === '待关联发票' || status === '部分关联发票' || status === '未开票待确认' || status === '后续开票待处理';
  }).length;
  const activePrimaryRows = getActivePrimaryRows(financePrimaryCategories);
  const activeSecondaryRows = getActiveSecondaryRows(financePrimaryCategories, financeSecondaryCategories);
  const filterPrimaryOptions = Array.from(new Set([...activePrimaryRows.map((row) => row.name), ...records.map((record) => getFinanceRecordCategorySnapshot(record).primaryName)])).filter(Boolean);
  const filterSecondaryOptions = Array.from(new Set([...activeSecondaryRows.map((row) => row.name), ...records.map((record) => record.category)])).filter(Boolean);

  const tableLabels = getTransactionTableLabels(activeTab);
  const invoiceRelationColumns: TableColumnsType<FinanceTransactionMatchedInvoice> = [
    {
      title: '发票号',
      dataIndex: 'invoiceNo',
      width: 180,
      render: (invoiceNo: string, record) => <CompactCell primary={invoiceNo} secondary={record.invoiceDate} />
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 86,
      render: (_direction: string, record) => (
        <CompactCell primary={record.direction} secondary={record.invoiceStatus} />
      )
    },
    {
      title: '对象',
      dataIndex: 'counterparty',
      width: 150
    },
    {
      title: '关联金额',
      dataIndex: 'amount',
      width: 132,
      render: (amount: number) => <CellText tone={amount < 0 ? 'expense' : 'strong'}>{formatMoney(amount)}</CellText>
    },
    {
      title: '发票金额',
      dataIndex: 'totalAmount',
      width: 132,
      render: (amount: number) => <CellText tone={amount < 0 ? 'expense' : 'strong'}>{formatMoney(amount)}</CellText>
    }
  ];
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
    },
    {
      title: '发票/申报',
      key: 'invoiceDeclaration',
      width: 132,
      render: (_, record) => {
        const association =
          invoiceAssociationByTransactionNo.get(record.transactionNo) ??
          buildTransactionInvoiceAssociation(record, invoiceRows);
        const invoiceDeclarationStatus =
          invoiceDeclarationStatusByTransactionNo.get(record.transactionNo) ??
          getFinanceTransactionInvoiceDeclarationStatus(record, association);

        return <StatusTag toneMap={invoiceDeclarationStatusTone} value={invoiceDeclarationStatus} />;
      }
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<WalletOutlined />} label="业务收款" value={formatMoney(receiptTotal)} />
          <MetricCard icon={<WalletOutlined />} label="对公付款" value={formatMoney(paymentTotal)} />
          <MetricCard icon={<CalculatorOutlined />} label="对公账户净流入" value={formatMoney(publicAccountNetTotal)} />
          <MetricCard icon={<FileSearchOutlined />} label="待复核流水" value={pendingRows.length} />
          <MetricCard icon={<FileTextOutlined />} label="发票/申报待处理" value={pendingInvoiceDeclarationCount} />
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
            <FilterField label="发票/申报" controlWidth="wide-select">
              <Select
                data-testid="finance-transaction-invoice-declaration-filter"
                value={filters.invoiceDeclaration}
                options={(
                  [
                    '全部',
                    '不适用',
                    '待关联发票',
                    '部分关联发票',
                    '已关联发票',
                    '未开票待确认',
                    '未开票已申报',
                    '本期暂不计入',
                    '后续开票待处理',
                    '后续开票已处理'
                  ] satisfies FinanceTransactionFilters['invoiceDeclaration'][]
                ).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(invoiceDeclaration) => setFilters((current) => ({ ...current, invoiceDeclaration }))}
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
              columns={4}
              items={
                [
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
                  { icon: <AuditOutlined />, key: 'status', label: '流水状态', value: activeRecord.status },
                  activeRecordInvoiceDeclarationStatus
                    ? {
                        icon: <FileTextOutlined />,
                        key: 'invoice-declaration',
                        label: '发票/申报',
                        value: activeRecordInvoiceDeclarationStatus
                      }
                    : undefined,
                ].filter(Boolean) as DetailSummaryCardItem[]
              }
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
                            { label: '流水状态', value: <StatusTag toneMap={transactionStatusTone} value={activeRecord.status} /> },
                            ...(activeRecordInvoiceDeclarationStatus
                              ? [
                                  {
                                    label: '发票/申报状态',
                                    value: (
                                      <StatusTag
                                        toneMap={invoiceDeclarationStatusTone}
                                        value={activeRecordInvoiceDeclarationStatus}
                                      />
                                    )
                                  },
                                  { label: '申报期间', value: activeRecord.invoiceDeclarationPeriod },
                                  { label: '申报准备', value: activeRecord.invoiceDeclarationPreparationNo }
                                ]
                              : []),
                            ...(activeRecordInvoiceAssociation
                              ? [
                                  {
                                    label: '发票关联',
                                    value: (
                                      <StatusTag
                                        toneMap={invoiceAssociationStatusTone}
                                        value={activeRecordInvoiceAssociation.status}
                                      />
                                    )
                                  },
                                  { label: '应关联金额', value: formatMoney(activeRecordInvoiceAssociation.requiredAmount) },
                                  { label: '已关联金额', value: formatMoney(activeRecordInvoiceAssociation.matchedAmount) },
                                  { label: '待关联金额', value: formatMoney(activeRecordInvoiceAssociation.remainingAmount) },
                                  { label: '关联发票数', value: `${activeRecordInvoiceAssociation.matchedInvoices.length} 张` }
                                ]
                              : [])
                          ]}
                        />
                      </DetailSection>
                      {activeRecordInvoiceAssociation && activeRecordInvoiceAssociation.status !== '无需关联' ? (
                        <DetailSection icon={<FileTextOutlined />} title="发票关联">
                          <CompactDetailTable<FinanceTransactionMatchedInvoice>
                            columns={invoiceRelationColumns}
                            dataSource={activeRecordInvoiceAssociation.matchedInvoices}
                            emptyText="暂无关联发票"
                            rowKey="id"
                          />
                        </DetailSection>
                      ) : null}
                      <DetailSection icon={<FileProtectOutlined />} title={getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).voucherSection}>
                        <RelatedFileTable
                          records={activeRecord.files}
                          onPreview={(file) => {
                            void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
                          }}
                          onDownload={(file) => {
                            void messageApi.success(`${file.name} 下载请求已记录`);
                          }}
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

          if (!periodGuard.allowed) {
            void messageApi.warning(periodGuard.reason);
            return;
          }

          if (!addFinanceTransaction(record)) {
            void messageApi.warning(periodGuard.reason ?? '当前会计期间已锁定，不能生成冲正补差流水');
            return;
          }

          setAdjustmentDrawerOpen(false);
          void messageApi.success('已生成待复核调整流水');
        }}
      />
    </ManagementPageScaffold>
  );
}
