import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  RollbackOutlined,
  WalletOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Alert, Select, Space, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { WorkflowDrawerShell } from '../../components/WorkflowDrawerShell';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import { useFinanceManagement } from './FinanceManagementState';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import {
  type FinanceTransactionCategory,
  type FinanceTransactionDirection,
  type FinanceTransactionRecord,
  type FinanceReportAggregation,
  type FinanceTransactionStatus,
  type FinanceVoucherStatus
} from './financeData';
import {
  collectionStatusDisplayName,
  collectionStatusTone,
  directionTone,
  financeToday,
  formatMoney,
  getAmountTone,
  getFinanceCategoryDisplayName,
  getFinanceDirectionLabels,
  getFinanceRecordCategorySnapshot,
  transactionStatusTone,
  voucherStatusTone
} from './financeUtils';

type FinanceReviewFilters = {
  category: '全部' | FinanceTransactionCategory;
  direction: '全部' | FinanceTransactionDirection;
  keyword: string;
  period: '全部' | string;
  primaryCategory: '全部' | string;
  reportAggregation: '全部' | FinanceReportAggregation;
  status: '全部' | FinanceTransactionStatus;
};

const defaultReviewFilters: FinanceReviewFilters = {
  category: '全部',
  direction: '全部',
  keyword: '',
  period: '全部',
  primaryCategory: '全部',
  reportAggregation: '全部',
  status: '待复核'
};

function getCollectionStatus(record: FinanceTransactionRecord) {
  return record.collectionStatus ?? '不适用';
}

function DrawerTitle({ record }: { record: FinanceTransactionRecord }) {
  return (
    <DetailDrawerTitle
      status={record.status}
      statusToneMap={transactionStatusTone}
      subtitle={`${record.transactionNo} / ${record.occurredAt}`}
      title="流水复核"
    />
  );
}

function matchesReviewFilters(record: FinanceTransactionRecord, filters: FinanceReviewFilters) {
  if (filters.period !== '全部' && record.accountingPeriod !== filters.period) {
    return false;
  }

  if (filters.direction !== '全部' && record.direction !== filters.direction) {
    return false;
  }

  if (filters.category !== '全部' && record.category !== filters.category) {
    return false;
  }

  const snapshot = getFinanceRecordCategorySnapshot(record);

  if (filters.primaryCategory !== '全部' && snapshot.primaryName !== filters.primaryCategory) {
    return false;
  }

  if (filters.reportAggregation !== '全部' && snapshot.reportAggregation !== filters.reportAggregation) {
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
    record.settlementAccount,
    record.note
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function FinanceReviewPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    addTransactionVoucherFile,
    financeRows: records,
    removeTransactionVoucherFile,
    returnFinanceTransaction,
    reviewFinanceTransaction,
    voidFinanceTransaction
  } = useFinanceManagement();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const [filters, setFilters] = useState<FinanceReviewFilters>(defaultReviewFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();

  const rows = useMemo(
    () =>
      records
        .filter((record) => matchesReviewFilters(record, filters))
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.transactionNo.localeCompare(left.transactionNo)),
    [filters, records]
  );
  const activeRecord = activeRecordId ? records.find((record) => record.id === activeRecordId) : undefined;
  const periodOptions = useMemo(() => ['全部', ...Array.from(new Set(records.map((record) => record.accountingPeriod)))], [records]);
  const primaryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...financePrimaryCategories.filter((row) => row.status === '启用').map((row) => row.name),
          ...records.map((record) => getFinanceRecordCategorySnapshot(record).primaryName)
        ])
      ).filter(Boolean),
    [financePrimaryCategories, records]
  );
  const secondaryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...financeSecondaryCategories.filter((row) => row.status === '启用').map((row) => row.name),
          ...records.map((record) => getFinanceRecordCategorySnapshot(record).secondaryName)
        ])
      ).filter(Boolean),
    [financeSecondaryCategories, records]
  );
  const reportAggregationOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...financeSecondaryCategories.filter((row) => row.status === '启用').map((row) => row.reportAggregation),
          ...records.map((record) => getFinanceRecordCategorySnapshot(record).reportAggregation)
        ])
      ).filter(Boolean),
    [financeSecondaryCategories, records]
  );
  const pendingRows = records.filter((record) => record.status === '待复核');
  const pendingReceiptAmount = pendingRows.filter((record) => record.direction === '收入').reduce((total, record) => total + record.amount, 0);
  const pendingPaymentAmount = pendingRows.filter((record) => record.direction === '支出').reduce((total, record) => total + record.amount, 0);
  const missingVoucherCount = pendingRows.filter((record) => record.voucherStatus === '待补充').length;
  const readyReviewCount = pendingRows.filter((record) => record.voucherStatus === '已上传').length;

  function buildVoucherFile(file: FinanceVoucherUploadFile, record: FinanceTransactionRecord): RelatedFileRecord | undefined {
    const maxFileSize = 10 * 1024 * 1024;

    if (file.size && file.size > maxFileSize) {
      void messageApi.warning(`${file.name} 超过 10MB，无法作为凭证上传`);
      return undefined;
    }

    if (record.files.some((currentFile) => currentFile.name === file.name)) {
      void messageApi.warning(`${file.name} 已在凭证列表中`);
      return undefined;
    }

    return {
      id: `fin-voucher-${record.id}-${file.uid || Date.now()}`,
      name: file.name,
      status: '已选择',
      type: '收支凭证',
      updatedAt: financeToday
    };
  }

  function handleVoucherFileSelect(file: FinanceVoucherUploadFile) {
    if (!activeRecord) {
      return;
    }

    const nextFile = buildVoucherFile(file, activeRecord);

    if (!nextFile) {
      return;
    }

    addTransactionVoucherFile(activeRecord.id, nextFile);
    void messageApi.success('凭证已补充');
  }

  function closeReviewDrawer() {
    setActiveRecordId(undefined);
  }

  function handleReview(record: FinanceTransactionRecord) {
    if (record.voucherStatus !== '已上传') {
      void messageApi.warning('请先补充凭证，再复核入账');
      return;
    }

    reviewFinanceTransaction(record.id);
    void messageApi.success('流水已复核入账');
  }

  function handleReturn(record: FinanceTransactionRecord) {
    returnFinanceTransaction(record.id);
    void messageApi.success('流水已退回修改');
  }

  function handleVoid(record: FinanceTransactionRecord) {
    voidFinanceTransaction(record.id);
    void messageApi.success('流水已作废');
  }

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
      title: '方向/类目',
      key: 'category',
      width: 156,
      render: (_, record) => {
        const snapshot = getFinanceRecordCategorySnapshot(record);

        return (
          <Space direction="vertical" size={4}>
            <StatusTag toneMap={directionTone} value={record.direction} />
            <CellText>{snapshot.secondaryName}</CellText>
            <CellText tone="subtle">{`${snapshot.primaryName} / ${snapshot.reportAggregation}`}</CellText>
          </Space>
        );
      }
    },
    {
      title: '收/付款对象',
      dataIndex: 'counterparty',
      width: 138,
      render: (counterparty: string, record) => <CompactCell primary={counterparty} secondary={record.counterpartyType} />
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 132,
      render: (amount: number, record) => <CellText tone={getAmountTone(record)}>{formatMoney(amount)}</CellText>
    },
    {
      title: '凭证',
      dataIndex: 'voucherStatus',
      width: 104,
      render: (voucherStatus: FinanceVoucherStatus) => <StatusTag toneMap={voucherStatusTone} value={voucherStatus} />
    },
    {
      title: '业务来源',
      key: 'source',
      width: 190,
      render: (_, record) => <CompactCell primary={record.sourceNo} secondary={record.sourceTitle} />
    },
    {
      title: '复核状态',
      dataIndex: 'status',
      width: 112,
      render: (status: FinanceTransactionStatus) => <StatusTag toneMap={transactionStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 134,
      render: (updatedAt: string) => <CellText>{updatedAt}</CellText>
    }
  ];

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<AuditOutlined />} label="待复核" value={pendingRows.length} />
          <MetricCard icon={<WalletOutlined />} label="待复核收款" value={formatMoney(pendingReceiptAmount)} />
          <MetricCard icon={<WalletOutlined />} label="待复核付款" value={formatMoney(pendingPaymentAmount)} />
          <MetricCard icon={<CheckCircleOutlined />} label="可入账" value={readyReviewCount} />
          <MetricCard icon={<WarningOutlined />} label="凭证待补充" value={missingVoucherCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="财务期间">
              <Select
                data-testid="finance-review-period-filter"
                value={filters.period}
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="收支方向">
              <Select
                data-testid="finance-review-direction-filter"
                value={filters.direction}
                options={(['全部', '收入', '支出', '内部转入'] satisfies FinanceReviewFilters['direction'][]).map((direction) => ({
                  label: direction,
                  value: direction
                }))}
                onChange={(direction) => setFilters((current) => ({ ...current, direction }))}
              />
            </FilterField>
            <FilterField label="一级类目">
              <Select
                data-testid="finance-review-primary-category-filter"
                value={filters.primaryCategory}
                options={['全部', ...primaryOptions].map((category) => ({ label: category, value: category }))}
                onChange={(primaryCategory) => setFilters((current) => ({ ...current, primaryCategory }))}
              />
            </FilterField>
            <FilterField label="二级类目">
              <Select
                data-testid="finance-review-category-filter"
                value={filters.category}
                options={(['全部', ...secondaryOptions] satisfies FinanceReviewFilters['category'][]).map((category) => ({
                  label: category === '全部' ? category : getFinanceCategoryDisplayName(category),
                  value: category
                }))}
                onChange={(category) => setFilters((current) => ({ ...current, category }))}
              />
            </FilterField>
            <FilterField label="统计归集">
              <Select
                data-testid="finance-review-report-filter"
                value={filters.reportAggregation}
                options={(['全部', ...reportAggregationOptions] satisfies FinanceReviewFilters['reportAggregation'][]).map((aggregation) => ({
                  label: aggregation,
                  value: aggregation
                }))}
                onChange={(reportAggregation) => setFilters((current) => ({ ...current, reportAggregation }))}
              />
            </FilterField>
            <FilterField label="复核状态">
              <Select
                data-testid="finance-review-status-filter"
                value={filters.status}
                options={(['全部', '待复核', '退回修改', '已入账', '已作废'] satisfies FinanceReviewFilters['status'][]).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-review-keyword-input"
              placeholder="流水号 / 对象 / 来源"
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
        count={{ value: rows.length, unit: '条复核记录' }}
        dataSource={rows}
        rowTestIdPrefix="finance-review-table-row"
        rowKey="id"
        tableTestId="finance-review-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />

      <WorkflowDrawerShell
        bodyTestId="finance-review-detail-drawer"
        className="finance-transaction-drawer"
        closeAction={
          activeRecord
            ? {
                label: '关闭',
                onClick: closeReviewDrawer,
                testId: 'finance-review-close-button'
              }
            : undefined
        }
        dangerAction={
          activeRecord?.status === '待复核'
            ? {
                icon: <CloseCircleOutlined />,
                label: '作废',
                onClick: () => handleVoid(activeRecord),
                testId: 'finance-review-void-button'
              }
            : undefined
        }
        open={Boolean(activeRecord)}
        primaryAction={
          activeRecord?.status === '待复核'
            ? {
                disabled: activeRecord.voucherStatus !== '已上传',
                icon: <CheckCircleOutlined />,
                label: '复核入账',
                onClick: () => handleReview(activeRecord),
                testId: 'finance-review-approve-button'
              }
            : undefined
        }
        secondaryAction={
          activeRecord?.status === '待复核'
            ? {
                icon: <RollbackOutlined />,
                label: '退回修改',
                onClick: () => handleReturn(activeRecord),
                testId: 'finance-review-return-button'
              }
            : undefined
        }
        title={activeRecord ? <DrawerTitle record={activeRecord} /> : null}
        width={900}
        onClose={closeReviewDrawer}
      >
        {activeRecord ? (
          <>
            <DetailSummaryCards
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
                { icon: <AuditOutlined />, key: 'status', label: '复核状态', value: activeRecord.status }
              ]}
            />
            {activeRecord.status === '待复核' && activeRecord.voucherStatus !== '已上传' ? (
              <Alert className="finance-review-alert" message="该流水缺少凭证，补充凭证后才能复核入账。" showIcon type="warning" />
            ) : null}
            <DetailTabs
              defaultActiveKey="profile"
              tabTestIdPrefix="finance-review-detail-tab"
              testId="finance-review-detail-tabs"
              items={[
                {
                  key: 'profile',
                  label: '复核信息',
                  children: (
                    <DetailSection icon={<AuditOutlined />} title="复核信息">
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
                          {
                            label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).publicAccount,
                            value: activeRecord.settlementAccountType === '对公账户' ? activeRecord.settlementAccount : '-'
                          },
                          { label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).handler, value: activeRecord.handler },
                          { label: '凭证状态', value: <StatusTag toneMap={voucherStatusTone} value={activeRecord.voucherStatus} /> }
                        ]}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'source',
                  label: '业务来源',
                  children: (
                    <DetailSection icon={<FileSearchOutlined />} title="业务来源">
                      <DetailInfoGrid
                        columns={2}
                        items={[
                          { label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).counterparty, value: activeRecord.counterparty },
                          { label: '来源类型', value: activeRecord.sourceType },
                          { label: '来源单号', value: activeRecord.sourceNo },
                          ...(getCollectionStatus(activeRecord) !== '不适用'
                            ? [
                                {
                                  label: '资金处理',
                                  value: (
                                    <StatusTag
                                      tone={collectionStatusTone[getCollectionStatus(activeRecord)]}
                                      value={collectionStatusDisplayName[getCollectionStatus(activeRecord)]}
                                    />
                                  )
                                }
                              ]
                            : []),
                          ...(activeRecord.collectionSourceTransactionNo
                            ? [
                                { label: '处理来源', value: activeRecord.collectionSourceTransactionNo },
                                { label: '经办来源', value: activeRecord.collectionFromAccount },
                                { label: '进入对公账户', value: activeRecord.collectionToAccount }
                              ]
                            : []),
                          { label: '事项说明', value: activeRecord.sourceTitle, wide: true },
                          { label: '备注', value: activeRecord.note, wide: true }
                        ]}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'files',
                  label: '凭证文件',
                  children: (
                    <DetailSection icon={<FileProtectOutlined />} title={getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).voucherSection}>
                      {activeRecord.status === '待复核' ? (
                        <FinanceVoucherUploadPanel
                          emptyText={getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).voucherEmpty}
                          files={activeRecord.files}
                          title={getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).uploadVoucher}
                          onRemove={(file) => removeTransactionVoucherFile(activeRecord.id, file.id)}
                          onSelect={handleVoucherFileSelect}
                        />
                      ) : (
                        <RelatedFileTable
                          records={activeRecord.files}
                          onPreview={(file) => {
                            void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
                          }}
                          onDownload={(file) => {
                            void messageApi.success(`${file.name} 下载请求已记录`);
                          }}
                        />
                      )}
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
      </WorkflowDrawerShell>
    </ManagementPageScaffold>
  );
}
