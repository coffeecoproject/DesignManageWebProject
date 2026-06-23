import {
  AuditOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  SwapOutlined,
  WalletOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Alert, Button, Col, Input, Row, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormShell } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import { buildPublicAccountOptions, usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import {
  getFinanceCategorySnapshot,
  type FinanceCollectionStatus,
  type FinancePaymentMethod,
  type FinancePrimaryCategoryConfig,
  type FinanceSettlementAccountType,
  type FinanceSecondaryCategoryConfig,
  type FinanceSourceType,
  type FinanceTransactionCategory,
  type FinanceTransactionDirection,
  type FinanceTransactionRecord,
  type FinanceTransactionStatus
} from './financeData';
import {
  collectionStatusDisplayName,
  collectionStatusTone,
  financeToday,
  formatMoney,
  getAccountingPeriod,
  getAmountTone,
  getFinanceCategoryDisplayName,
  getFinanceDirectionLabels,
  getFinanceRecordCategorySnapshot,
  parseMoney,
  transactionStatusTone
} from './financeUtils';

type FinanceFundHandlingMethod = Extract<FinancePaymentMethod, '员工代收' | '现金暂收' | '员工垫付'>;

type FinanceFundHandlingFilters = {
  collectionStatus: '全部' | FinanceCollectionStatus;
  keyword: string;
  method: '全部' | FinanceFundHandlingMethod;
  period: '全部' | string;
  status: '全部' | FinanceTransactionStatus;
};

type FinanceFundHandlingForm = {
  amount: string;
  note: string;
  occurredAt: string;
  settlementAccount: string;
  settlementAccountType: FinanceSettlementAccountType;
  voucherFiles: RelatedFileRecord[];
};

type FinanceSettlementAccountOption = {
  isDefault?: boolean;
  label: string;
  type: FinanceSettlementAccountType;
  value: string;
};

const fundHandlingMethods: FinanceFundHandlingMethod[] = ['员工代收', '现金暂收', '员工垫付'];

const defaultFilters: FinanceFundHandlingFilters = {
  collectionStatus: '全部',
  keyword: '',
  method: '全部',
  period: '全部',
  status: '全部'
};

const defaultForm: FinanceFundHandlingForm = {
  amount: '',
  note: '',
  occurredAt: financeToday,
  settlementAccount: '',
  settlementAccountType: '对公账户',
  voucherFiles: []
};

const handledStatuses = new Set<FinanceCollectionStatus>(['已转入对公', '已存入对公', '已报销']);

function getDefaultSettlementAccountOption(options: FinanceSettlementAccountOption[]) {
  return options.find((option) => option.isDefault) ?? options[0];
}

function getCollectionStatus(record: FinanceTransactionRecord): FinanceCollectionStatus {
  return record.collectionStatus ?? '不适用';
}

function getUnprocessedAmount(record: FinanceTransactionRecord) {
  return Math.max(0, record.amount - (record.collectedAmount ?? 0));
}

function isFundHandlingSource(record: FinanceTransactionRecord) {
  return fundHandlingMethods.includes(record.paymentMethod as FinanceFundHandlingMethod) && getCollectionStatus(record) !== '不适用';
}

function isHandled(record: FinanceTransactionRecord) {
  return handledStatuses.has(getCollectionStatus(record)) || getUnprocessedAmount(record) <= 0;
}

function canRegisterFundHandling(record: FinanceTransactionRecord) {
  return record.status === '已入账' && !isHandled(record);
}

function getHandlingActionLabel(record: FinanceTransactionRecord) {
  const status = getCollectionStatus(record);

  if (status === '待报销' || status === '已报销') {
    return '登记报销付款';
  }

  if (status === '待存入对公' || status === '已存入对公') {
    return '登记存入对公';
  }

  return '登记转入对公';
}

function getHandlingShortActionLabel(record: FinanceTransactionRecord) {
  const status = getCollectionStatus(record);

  if (status === '待报销' || status === '已报销') {
    return '登记报销';
  }

  if (status === '待存入对公' || status === '已存入对公') {
    return '登记存入';
  }

  return '登记转入';
}

function getHandlingAvailableLabel(record: FinanceTransactionRecord) {
  const status = getCollectionStatus(record);

  if (status === '待报销' || status === '已报销') {
    return '可登记报销';
  }

  if (status === '待存入对公' || status === '已存入对公') {
    return '可登记存入';
  }

  return '可登记转入';
}

function getHandlingVoucherCopy(record: FinanceTransactionRecord) {
  const status = getCollectionStatus(record);

  if (status === '待报销' || status === '已报销') {
    return {
      description: '上传公司对公账户向员工报销付款的银行回单或付款截图。',
      emptyText: '暂无报销付款凭证',
      sectionTitle: '报销付款凭证',
      uploadTitle: '上传报销凭证'
    };
  }

  if (status === '待存入对公' || status === '已存入对公') {
    return {
      description: '上传员工现金存入公司对公账户的银行回单或存款凭证。',
      emptyText: '暂无现金存入凭证',
      sectionTitle: '现金存入凭证',
      uploadTitle: '上传存入凭证'
    };
  }

  return {
    description: '上传员工代收款转入公司对公账户的银行回单或转账截图。',
    emptyText: '暂无转入对公凭证',
    sectionTitle: '转入对公凭证',
    uploadTitle: '上传转入凭证'
  };
}

function getHandlingResultCategory(record: FinanceTransactionRecord): FinanceTransactionCategory {
  const status = getCollectionStatus(record);

  if (status === '待存入对公' || status === '已存入对公') {
    return '现金存入对公';
  }

  if (status === '待报销' || status === '已报销') {
    return '员工报销付款';
  }

  return '员工代收转入对公';
}

function getHandlingDirection(record: FinanceTransactionRecord): FinanceTransactionDirection {
  return getHandlingResultCategory(record) === '员工报销付款' ? '支出' : '内部转入';
}

function getHandlingSourceType(record: FinanceTransactionRecord): FinanceSourceType {
  const category = getHandlingResultCategory(record);

  if (category === '现金存入对公') {
    return '现金暂收流水';
  }

  if (category === '员工报销付款') {
    return '员工垫付单';
  }

  return '员工代收流水';
}

function getOriginalCounterpartyLabel(record: FinanceTransactionRecord) {
  if (record.paymentMethod === '员工垫付') {
    return '原付款对象';
  }

  return '原收款对象';
}

function getPeriodOptions(records: FinanceTransactionRecord[]) {
  return ['全部', ...Array.from(new Set(records.map((record) => record.accountingPeriod)))];
}

function buildNextTransactionNo(records: FinanceTransactionRecord[], occurredAt: string) {
  const period = getAccountingPeriod(occurredAt).replace('-', '');
  const maxSequence = records.reduce((max, record) => {
    if (record.transactionNo.slice(4, 10) !== period) {
      return max;
    }

    const sequence = Number(record.transactionNo.slice(-4));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `FIN-${period}-${String(maxSequence + 1).padStart(4, '0')}`;
}

function matchesFilters(record: FinanceTransactionRecord, filters: FinanceFundHandlingFilters) {
  if (!isFundHandlingSource(record)) {
    return false;
  }

  if (filters.period !== '全部' && record.accountingPeriod !== filters.period) {
    return false;
  }

  if (filters.method !== '全部' && record.paymentMethod !== filters.method) {
    return false;
  }

  if (filters.collectionStatus !== '全部' && getCollectionStatus(record) !== filters.collectionStatus) {
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
    record.handler,
    record.category,
    record.sourceNo,
    record.sourceTitle,
    collectionStatusDisplayName[getCollectionStatus(record)]
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function buildVoucherFile(
  file: FinanceVoucherUploadFile,
  currentFiles: RelatedFileRecord[],
  messageApi: ReturnType<typeof message.useMessage>[0]
) {
  const maxFileSize = 10 * 1024 * 1024;

  if (file.size && file.size > maxFileSize) {
    void messageApi.warning(`${file.name} 超过 10MB，无法作为凭证上传`);
    return undefined;
  }

  if (currentFiles.some((currentFile) => currentFile.name === file.name)) {
    void messageApi.warning(`${file.name} 已在凭证列表中`);
    return undefined;
  }

  return {
    id: `fin-fund-voucher-${file.uid || Date.now()}`,
    name: file.name,
    status: '已选择',
    type: '资金处理凭证',
    updatedAt: financeToday
  } satisfies RelatedFileRecord;
}

function buildFundHandlingTransaction(
  form: FinanceFundHandlingForm,
  sourceRecord: FinanceTransactionRecord,
  records: FinanceTransactionRecord[],
  primaryRows: FinancePrimaryCategoryConfig[],
  secondaryRows: FinanceSecondaryCategoryConfig[]
): FinanceTransactionRecord {
  const transactionNo = buildNextTransactionNo(records, form.occurredAt);
  const amount = parseMoney(form.amount);
  const accountingPeriod = getAccountingPeriod(form.occurredAt);
  const category = getHandlingResultCategory(sourceRecord);
  const direction = getHandlingDirection(sourceRecord);
  const isReimbursement = category === '员工报销付款';

  return {
    id: `fin-fund-handling-${Date.now()}`,
    transactionNo,
    occurredAt: form.occurredAt.trim(),
    accountingPeriod,
    direction,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category, primaryRows, secondaryRows),
    counterparty: isReimbursement ? (sourceRecord.handler ?? sourceRecord.counterparty) : '内部资金处理',
    counterpartyType: isReimbursement ? '员工' : '内部',
    amount,
    currency: 'CNY',
    paymentMethod: isReimbursement ? '对公账户付款' : '对公账户收款',
    settlementAccount: form.settlementAccount.trim(),
    settlementAccountType: '对公账户',
    handler: sourceRecord.handler,
    sourceType: getHandlingSourceType(sourceRecord),
    sourceNo: sourceRecord.transactionNo,
    sourceTitle: form.note.trim() || `${sourceRecord.transactionNo} ${getFinanceCategoryDisplayName(category)}`,
    voucherStatus: form.voucherFiles.length > 0 ? '已上传' : '待补充',
    reconciliationStatus: '未对账',
    status: '待复核',
    registeredBy: '李明',
    collectionStatus: '不适用',
    collectionSourceTransactionNo: sourceRecord.transactionNo,
    collectionFromAccount: sourceRecord.handler ? `${sourceRecord.handler}经办资金` : '员工经办资金',
    collectionToAccount: form.settlementAccount.trim(),
    note: form.note.trim(),
    updatedAt: `${financeToday} 10:45`,
    files: form.voucherFiles.map((file) => ({
      ...file,
      status: '已上传',
      updatedAt: financeToday
    })),
    operationRecords: [
      {
        id: `fin-op-fund-handling-${Date.now()}`,
        time: `${financeToday} 10:45`,
        actor: '李明',
        object: transactionNo,
        action: getHandlingActionLabel(sourceRecord),
        summary: `${sourceRecord.transactionNo} ${getFinanceCategoryDisplayName(category)} ${formatMoney(amount)}`
      }
    ]
  };
}

function DrawerTitle({ record }: { record: FinanceTransactionRecord }) {
  const collectionStatus = getCollectionStatus(record);

  return (
    <DetailDrawerTitle
      status={collectionStatusDisplayName[collectionStatus]}
      statusTone={collectionStatusTone[collectionStatus]}
      subtitle={`${record.transactionNo} / ${record.paymentMethod} / ${collectionStatusDisplayName[collectionStatus]}`}
      title="资金处理详情"
    />
  );
}

function FundHandlingDrawerTitle({ record }: { record: FinanceTransactionRecord }) {
  return (
    <DetailDrawerTitle
      status="保存后进入复核"
      statusTone={transactionStatusTone['待复核']}
      subtitle={`${record.transactionNo} / 待处理 ${formatMoney(getUnprocessedAmount(record))}`}
      title={getHandlingActionLabel(record)}
    />
  );
}

export function FinanceFundHandlingPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { collectPersonalAccountTransaction, financeRows: records } = useFinanceManagement();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const { publicAccounts } = usePublicAccountConfigState();
  const [filters, setFilters] = useState<FinanceFundHandlingFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [handlingRecordId, setHandlingRecordId] = useState<string>();
  const [form, setForm] = useState<FinanceFundHandlingForm>(defaultForm);

  const sourceRecords = useMemo(() => records.filter(isFundHandlingSource), [records]);
  const settlementAccountOptions = useMemo<FinanceSettlementAccountOption[]>(
    () =>
      buildPublicAccountOptions(publicAccounts, '资金处理').map((option, index) => ({
        ...option,
        isDefault: index === 0
      })),
    [publicAccounts]
  );
  const rows = useMemo(
    () =>
      records
        .filter((record) => matchesFilters(record, filters))
        .sort((left, right) => Number(canRegisterFundHandling(right)) - Number(canRegisterFundHandling(left)) || right.occurredAt.localeCompare(left.occurredAt)),
    [filters, records]
  );
  const activeRecord = activeRecordId ? records.find((record) => record.id === activeRecordId) : undefined;
  const handlingRecord = handlingRecordId ? records.find((record) => record.id === handlingRecordId) : undefined;
  const periodOptions = useMemo(() => getPeriodOptions(sourceRecords), [sourceRecords]);
  const confirmedPendingRecords = sourceRecords.filter(canRegisterFundHandling);
  const pendingFundAmount = confirmedPendingRecords.reduce((total, record) => total + getUnprocessedAmount(record), 0);
  const pendingTransferAmount = confirmedPendingRecords
    .filter((record) => getCollectionStatus(record) === '待转入对公' || getCollectionStatus(record) === '部分转入对公')
    .reduce((total, record) => total + getUnprocessedAmount(record), 0);
  const pendingCashAmount = confirmedPendingRecords
    .filter((record) => getCollectionStatus(record) === '待存入对公')
    .reduce((total, record) => total + getUnprocessedAmount(record), 0);
  const pendingReimbursementAmount = confirmedPendingRecords
    .filter((record) => getCollectionStatus(record) === '待报销')
    .reduce((total, record) => total + getUnprocessedAmount(record), 0);
  const waitingReviewCount = sourceRecords.filter((record) => !isHandled(record) && record.status !== '已入账').length;
  const formValid =
    Boolean(handlingRecord) &&
    Boolean(form.occurredAt.trim()) &&
    Boolean(form.settlementAccount.trim()) &&
    parseMoney(form.amount) > 0 &&
    parseMoney(form.amount) <= (handlingRecord ? getUnprocessedAmount(handlingRecord) : 0);
  const handlingVoucherCopy = handlingRecord ? getHandlingVoucherCopy(handlingRecord) : undefined;

  function handleOpenHandlingDrawer(record: FinanceTransactionRecord) {
    const defaultAccount = getDefaultSettlementAccountOption(settlementAccountOptions);

    setHandlingRecordId(record.id);
    setForm({
      ...defaultForm,
      amount: String(getUnprocessedAmount(record)),
      settlementAccount: defaultAccount?.label ?? '',
      settlementAccountType: '对公账户'
    });
  }

  function handleVoucherFileSelect(file: FinanceVoucherUploadFile) {
    const nextFile = buildVoucherFile(file, form.voucherFiles, messageApi);

    if (!nextFile) {
      return;
    }

    setForm((current) => ({
      ...current,
      voucherFiles: [...current.voucherFiles, nextFile]
    }));
  }

  function handleVoucherFileRemove(file: RelatedFileRecord) {
    setForm((current) => ({
      ...current,
      voucherFiles: current.voucherFiles.filter((currentFile) => currentFile.id !== file.id)
    }));
  }

  function handleCreateFundHandling() {
    if (!handlingRecord || !formValid) {
      void messageApi.warning('请确认处理日期、处理金额和对公账户');
      return;
    }

    const nextRecord = buildFundHandlingTransaction(form, handlingRecord, records, financePrimaryCategories, financeSecondaryCategories);
    collectPersonalAccountTransaction(handlingRecord.id, nextRecord);
    setHandlingRecordId(undefined);
    setActiveRecordId(handlingRecord.id);
    setForm(defaultForm);
    void messageApi.success('资金处理流水已保存并进入流水复核');
  }

  const columns: TableColumnsType<FinanceTransactionRecord> = [
    {
      title: '原发生日期',
      dataIndex: 'occurredAt',
      width: 112,
      render: (occurredAt: string, record) => <CompactCell primary={occurredAt} secondary={record.accountingPeriod} />
    },
    {
      title: '原流水号',
      dataIndex: 'transactionNo',
      width: 154,
      render: (transactionNo: string, record) => (
        <CompactCell primary={transactionNo} secondary={getFinanceRecordCategorySnapshot(record).secondaryName} />
      )
    },
    {
      title: '资金场景',
      dataIndex: 'paymentMethod',
      width: 118,
      render: (paymentMethod: FinancePaymentMethod, record) => (
        <CompactCell primary={paymentMethod} secondary={getHandlingShortActionLabel(record)} />
      )
    },
    {
      title: '经办人',
      dataIndex: 'handler',
      width: 106,
      render: (handler: string | undefined) => <CellText>{handler}</CellText>
    },
    {
      title: '业务对象',
      dataIndex: 'counterparty',
      width: 132,
      render: (counterparty: string, record) => <CompactCell primary={counterparty} secondary={record.counterpartyType} />
    },
    {
      title: '原流水金额',
      dataIndex: 'amount',
      width: 128,
      render: (amount: number, record) => <CellText tone={getAmountTone(record)}>{formatMoney(amount)}</CellText>
    },
    {
      title: '已处理/待处理金额',
      key: 'amounts',
      width: 144,
      render: (_, record) => (
        <CompactCell primary={formatMoney(getUnprocessedAmount(record))} secondary={`已处理 ${formatMoney(record.collectedAmount ?? 0)}`} />
      )
    },
    {
      title: '资金处理',
      dataIndex: 'collectionStatus',
      width: 126,
      render: (_status: FinanceCollectionStatus, record) => (
        <StatusTag tone={collectionStatusTone[getCollectionStatus(record)]} value={collectionStatusDisplayName[getCollectionStatus(record)]} />
      )
    },
    {
      title: '原流水状态',
      dataIndex: 'status',
      width: 108,
      render: (status: FinanceTransactionStatus) => <StatusTag toneMap={transactionStatusTone} value={status} />
    },
    {
      title: '操作',
      key: 'actions',
      width: 126,
      render: (_, record) => {
        if (isHandled(record)) {
          return <CellText tone="subtle">已完成</CellText>;
        }

        if (record.status !== '已入账') {
          return <StatusTag tone="amber" value="先复核" />;
        }

        return (
          <Button
            size="small"
            type="link"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenHandlingDrawer(record);
            }}
          >
            {getHandlingShortActionLabel(record)}
          </Button>
        );
      }
    }
  ];

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<WalletOutlined />} label="待处理资金" value={formatMoney(pendingFundAmount)} />
          <MetricCard icon={<SwapOutlined />} label="待转入对公" value={formatMoney(pendingTransferAmount)} />
          <MetricCard icon={<CheckCircleOutlined />} label="待存入对公" value={formatMoney(pendingCashAmount)} />
          <MetricCard icon={<FileProtectOutlined />} label="待报销" value={formatMoney(pendingReimbursementAmount)} />
          <MetricCard icon={<WarningOutlined />} label="待复核原流水" value={waitingReviewCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="财务期间">
              <Select
                data-testid="finance-fund-handling-period-filter"
                value={filters.period}
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="资金场景">
              <Select
                data-testid="finance-fund-handling-method-filter"
                value={filters.method}
                options={(['全部', ...fundHandlingMethods] satisfies FinanceFundHandlingFilters['method'][]).map((method) => ({
                  label: method,
                  value: method
                }))}
                onChange={(method) => setFilters((current) => ({ ...current, method }))}
              />
            </FilterField>
            <FilterField label="资金处理">
              <Select
                data-testid="finance-fund-handling-status-filter"
                value={filters.collectionStatus}
                options={(
                  [
                    '全部',
                    '待转入对公',
                    '部分转入对公',
                    '已转入对公',
                    '待存入对公',
                    '已存入对公',
                    '待报销',
                    '已报销'
                  ] satisfies FinanceFundHandlingFilters['collectionStatus'][]
                ).map((status) => ({ label: status, value: status }))}
                onChange={(collectionStatus) => setFilters((current) => ({ ...current, collectionStatus }))}
              />
            </FilterField>
            <FilterField label="原流水状态">
              <Select
                data-testid="finance-fund-handling-flow-status-filter"
                value={filters.status}
                options={(['全部', '待复核', '退回修改', '已入账', '已作废'] satisfies FinanceFundHandlingFilters['status'][]).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-fund-handling-keyword-input"
              placeholder="流水号 / 对象 / 经办人"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTable<FinanceTransactionRecord>
        columns={columns}
        count={{ value: rows.length, unit: '条资金处理记录' }}
        dataSource={rows}
        rowTestIdPrefix="finance-fund-handling-table-row"
        rowKey="id"
        tableTestId="finance-fund-handling-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />

      <DetailDrawerShell
        bodyTestId="finance-fund-handling-detail-drawer"
        className="finance-transaction-drawer"
        closeAction={{ label: '关闭', testId: 'finance-fund-handling-close-button', onClick: () => setActiveRecordId(undefined) }}
        open={Boolean(activeRecord)}
        primaryAction={
          activeRecord && canRegisterFundHandling(activeRecord)
            ? {
                icon: <SwapOutlined />,
                label: getHandlingActionLabel(activeRecord),
                testId: 'finance-fund-handling-open-form-button',
                onClick: () => handleOpenHandlingDrawer(activeRecord)
              }
            : undefined
        }
        title={activeRecord ? <DrawerTitle record={activeRecord} /> : null}
        width={900}
        onClose={() => setActiveRecordId(undefined)}
      >
        {activeRecord ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={
                [
                  { icon: <ProfileOutlined />, key: 'handler', label: '经办人', value: activeRecord.handler || '-' },
                  { icon: <WalletOutlined />, key: 'pending', label: '待处理金额', value: formatMoney(getUnprocessedAmount(activeRecord)) },
                  {
                    icon: <SwapOutlined />,
                    key: 'fund-status',
                    label: '资金处理',
                    value: collectionStatusDisplayName[getCollectionStatus(activeRecord)]
                  },
                  { icon: <AuditOutlined />, key: 'flow-status', label: '原流水状态', value: activeRecord.status }
                ].filter(Boolean) as DetailSummaryCardItem[]
              }
            />
            {activeRecord.status !== '已入账' && !isHandled(activeRecord) ? (
              <Alert className="finance-review-alert" message="原流水尚未复核通过，不能登记后续资金处理。" showIcon type="warning" />
            ) : null}
            <DetailTabs
              defaultActiveKey="detail"
              tabTestIdPrefix="finance-fund-handling-detail-tab"
              testId="finance-fund-handling-detail-tabs"
              items={[
                {
                  key: 'detail',
                  label: '处理进度',
                  children: (
                    <div className="detail-tab-stack">
                      <DetailSection icon={<FileSearchOutlined />} title="原流水信息">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '原流水号', value: activeRecord.transactionNo },
                            { label: '发生日期', value: activeRecord.occurredAt },
                            { label: '财务期间', value: activeRecord.accountingPeriod },
                            { label: '资金场景', value: activeRecord.paymentMethod },
                            { label: getOriginalCounterpartyLabel(activeRecord), value: activeRecord.counterparty },
                            { label: '经办人', value: activeRecord.handler },
                            {
                              label: '原流水金额',
                              value: <CellText tone={getAmountTone(activeRecord)}>{formatMoney(activeRecord.amount)}</CellText>
                            },
                            { label: '原流水状态', value: <StatusTag toneMap={transactionStatusTone} value={activeRecord.status} /> },
                            {
                              label: '资金处理',
                              value: (
                                <StatusTag
                                  tone={collectionStatusTone[getCollectionStatus(activeRecord)]}
                                  value={collectionStatusDisplayName[getCollectionStatus(activeRecord)]}
                                />
                              )
                            },
                            { label: '事项说明', value: activeRecord.sourceTitle, wide: true }
                          ]}
                        />
                      </DetailSection>
                      <DetailSection icon={<SwapOutlined />} title="处理进度">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '已处理金额', value: formatMoney(activeRecord.collectedAmount ?? 0) },
                            { label: '待处理金额', value: formatMoney(getUnprocessedAmount(activeRecord)) },
                            { label: '目标对公账户', value: activeRecord.collectionToAccount || getDefaultSettlementAccountOption(settlementAccountOptions)?.label },
                            { label: '处理流水', value: activeRecord.collectionTransactionNos?.join(' / ') },
                            { label: '处理结果', value: isHandled(activeRecord) ? '已完成' : canRegisterFundHandling(activeRecord) ? getHandlingAvailableLabel(activeRecord) : '等待原流水复核' },
                            { label: '最近更新', value: activeRecord.updatedAt }
                          ]}
                        />
                      </DetailSection>
                    </div>
                  )
                },
                {
                  key: 'files',
                  label: '原流水凭证',
                  children: (
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

      <DrawerFormShell
        bodyTestId="finance-fund-handling-form-drawer"
        cancelAction={{ label: '取消', onClick: () => setHandlingRecordId(undefined) }}
        className="finance-transaction-drawer"
        open={Boolean(handlingRecord)}
        primaryAction={{
          disabled: !formValid,
          label: '保存并进入复核',
          onClick: handleCreateFundHandling,
          testId: 'finance-fund-handling-save-button'
        }}
        title={handlingRecord ? <FundHandlingDrawerTitle record={handlingRecord} /> : null}
        width={860}
        onClose={() => setHandlingRecordId(undefined)}
      >
        {handlingRecord ? (
          <>
            <DetailSection icon={<FileSearchOutlined />} title="原流水信息">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '原流水号', value: handlingRecord.transactionNo },
                  { label: getOriginalCounterpartyLabel(handlingRecord), value: handlingRecord.counterparty },
                  { label: '经办人', value: handlingRecord.handler },
                  { label: '原流水金额', value: formatMoney(handlingRecord.amount) },
                  { label: '已处理金额', value: formatMoney(handlingRecord.collectedAmount ?? 0) },
                  { label: '待处理金额', value: formatMoney(getUnprocessedAmount(handlingRecord)) }
                ]}
              />
            </DetailSection>
            <DetailSection icon={<WalletOutlined />} title="本次处理">
              <Row gutter={[14, 14]}>
                <Col span={8}>
                  <DrawerFormField label="处理日期" required>
                    <Input
                      placeholder="YYYY-MM-DD"
                      value={form.occurredAt}
                      onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))}
                    />
                  </DrawerFormField>
                </Col>
                <Col span={8}>
                  <DrawerFormField label="对公账户" required>
                    <Select
                      className="field-control"
                      data-testid="finance-fund-handling-account-select"
                      value={form.settlementAccount}
                      options={settlementAccountOptions.map((option) => ({
                        label: option.label,
                        value: option.label
                      }))}
                      onChange={(settlementAccount) =>
                        setForm((current) => ({
                          ...current,
                          settlementAccount,
                          settlementAccountType: '对公账户'
                        }))
                      }
                    />
                  </DrawerFormField>
                </Col>
                <Col span={8}>
                  <DrawerFormField label="处理金额" required>
                    <Input
                      data-testid="finance-fund-handling-amount-input"
                      placeholder="请输入处理金额"
                      value={form.amount}
                      onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    />
                  </DrawerFormField>
                </Col>
                <Col span={24}>
                  <DrawerFormField label="事项说明" wide>
                    <Input
                      placeholder="例如员工代收转入对公、现金存入对公或员工报销付款"
                      value={form.note}
                      onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    />
                  </DrawerFormField>
                </Col>
              </Row>
            </DetailSection>
            {handlingVoucherCopy ? (
              <DetailSection icon={<FileProtectOutlined />} title={handlingVoucherCopy.sectionTitle}>
                <FinanceVoucherUploadPanel
                  description={handlingVoucherCopy.description}
                  emptyText={handlingVoucherCopy.emptyText}
                  files={form.voucherFiles}
                  title={handlingVoucherCopy.uploadTitle}
                  onRemove={handleVoucherFileRemove}
                  onSelect={handleVoucherFileSelect}
                />
              </DetailSection>
            ) : null}
          </>
        ) : null}
      </DrawerFormShell>
    </ManagementPageScaffold>
  );
}
