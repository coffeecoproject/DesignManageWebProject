import {
  AuditOutlined,
  BankOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { CellText, CompactCell, type CellTextTone } from '../../components/TableCell';
import {
  formatPublicAccountTail,
  getDefaultPublicAccount,
  usePublicAccountConfigState
} from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import type { FinanceTransactionRecord, FinanceTransactionStatus } from './financeData';
import {
  directionTone,
  financeToday,
  formatMoney,
  getFinanceRecordCategorySnapshot,
  getPublicAccountSignedAmount,
  transactionStatusTone,
  voucherStatusTone
} from './financeUtils';

type PublicAccountDirectionFilter = '全部' | '入账' | '出账';

type PublicAccountFilters = {
  direction: PublicAccountDirectionFilter;
  keyword: string;
  period: string;
  status: '全部' | FinanceTransactionStatus;
};

const defaultFilters: PublicAccountFilters = {
  direction: '全部',
  keyword: '',
  period: financeToday.slice(0, 7),
  status: '全部'
};

function isPublicAccountMovement(record: FinanceTransactionRecord) {
  if (record.status === '已作废' || record.settlementAccountType !== '对公账户') {
    return false;
  }

  return (
    record.paymentMethod === '对公账户收款' ||
    record.paymentMethod === '对公账户付款' ||
    record.direction === '内部转入' ||
    Boolean(record.collectionSourceTransactionNo)
  );
}

function getAccountDirection(record: FinanceTransactionRecord): Exclude<PublicAccountDirectionFilter, '全部'> {
  return getPublicAccountSignedAmount(record) < 0 ? '出账' : '入账';
}

function getSignedAmountTone(amount: number): CellTextTone {
  if (amount < 0) {
    return 'expense';
  }

  if (amount > 0) {
    return 'income';
  }

  return 'muted';
}

function formatSignedMoney(amount: number) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatMoney(Math.abs(amount))}`;
}

function matchesFilters(record: FinanceTransactionRecord, filters: PublicAccountFilters) {
  if (filters.period !== '全部' && record.accountingPeriod !== filters.period) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  if (filters.direction !== '全部' && getAccountDirection(record) !== filters.direction) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [record.transactionNo, record.counterparty, record.sourceNo, record.sourceTitle, record.category, record.settlementAccount]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword));
}

function DrawerTitle({ record }: { record: FinanceTransactionRecord }) {
  const signedAmount = getPublicAccountSignedAmount(record);

  return (
    <DetailDrawerTitle
      status={record.status}
      statusToneMap={transactionStatusTone}
      subtitle={`${record.transactionNo} / ${getAccountDirection(record)} / ${formatSignedMoney(signedAmount)}`}
      title="对公账户流水"
    />
  );
}

export function FinancePublicAccountPage() {
  const { financeRows } = useFinanceManagement();
  const { publicAccounts } = usePublicAccountConfigState();
  const [messageApi, contextHolder] = message.useMessage();
  const [filters, setFilters] = useState<PublicAccountFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();

  const accountMovements = useMemo(
    () =>
      financeRows
        .filter(isPublicAccountMovement)
        .sort((first, second) => `${second.occurredAt} ${second.transactionNo}`.localeCompare(`${first.occurredAt} ${first.transactionNo}`)),
    [financeRows]
  );

  const periodOptions = useMemo(
    () => ['全部', ...Array.from(new Set(accountMovements.map((record) => record.accountingPeriod))).sort((first, second) => second.localeCompare(first))],
    [accountMovements]
  );

  const rows = useMemo(() => accountMovements.filter((record) => matchesFilters(record, filters)), [accountMovements, filters]);
  const activeRecord = useMemo(() => accountMovements.find((record) => record.id === activeRecordId), [accountMovements, activeRecordId]);
  const configuredPublicAccount = getDefaultPublicAccount(publicAccounts);
  const publicAccountProfile = {
    accountNo: configuredPublicAccount ? formatPublicAccountTail(configuredPublicAccount.accountTailNumber) : '-',
    bankName: configuredPublicAccount?.bankName ?? '-',
    name: configuredPublicAccount?.displayName ?? '-',
    openingBalance: configuredPublicAccount?.openingBalance ?? 0
  };

  const currentPeriodRows = useMemo(
    () => accountMovements.filter((record) => record.accountingPeriod === financeToday.slice(0, 7)),
    [accountMovements]
  );
  const enteredRows = useMemo(() => accountMovements.filter((record) => record.status === '已入账'), [accountMovements]);
  const currentPeriodEnteredRows = useMemo(
    () => currentPeriodRows.filter((record) => record.status === '已入账'),
    [currentPeriodRows]
  );
  const accountBalance =
    publicAccountProfile.openingBalance +
    enteredRows.reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);
  const currentPeriodInflow = currentPeriodEnteredRows.reduce((total, record) => {
    const amount = getPublicAccountSignedAmount(record);
    return amount > 0 ? total + amount : total;
  }, 0);
  const currentPeriodOutflow = currentPeriodEnteredRows.reduce((total, record) => {
    const amount = getPublicAccountSignedAmount(record);
    return amount < 0 ? total + Math.abs(amount) : total;
  }, 0);
  const pendingNetAmount = accountMovements
    .filter((record) => record.status === '待复核')
    .reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);

  const columns: TableColumnsType<FinanceTransactionRecord> = [
    {
      title: '发生日期',
      dataIndex: 'occurredAt',
      width: 108
    },
    {
      title: '流水号',
      key: 'transactionNo',
      width: 150,
      render: (_, record) => <CompactCell primary={record.transactionNo} secondary={record.accountingPeriod} />
    },
    {
      title: '方向',
      key: 'direction',
      width: 96,
      render: (_, record) => <StatusTag tone={getAccountDirection(record) === '入账' ? 'green' : 'red'} value={getAccountDirection(record)} />
    },
    {
      title: '财务类目',
      key: 'category',
      width: 168,
      render: (_, record) => {
        const category = getFinanceRecordCategorySnapshot(record);
        return <CompactCell primary={category.secondaryName} secondary={category.primaryName} />;
      }
    },
    {
      title: '业务对象',
      key: 'counterparty',
      width: 150,
      render: (_, record) => <CompactCell primary={record.counterparty} secondary={record.counterpartyType} />
    },
    {
      title: '入账/出账金额',
      key: 'amount',
      width: 138,
      render: (_, record) => {
        const signedAmount = getPublicAccountSignedAmount(record);
        return <CellText tone={getSignedAmountTone(signedAmount)}>{formatSignedMoney(signedAmount)}</CellText>;
      }
    },
    {
      title: '对公账户',
      key: 'settlementAccount',
      width: 150,
      render: (_, record) => (
        <CompactCell primary={record.settlementAccount || publicAccountProfile.name} secondary={publicAccountProfile.bankName} />
      )
    },
    {
      title: '流水状态',
      dataIndex: 'status',
      width: 108,
      render: (status: FinanceTransactionStatus) => <StatusTag toneMap={transactionStatusTone} value={status} />
    },
    {
      title: '凭证',
      key: 'voucher',
      width: 112,
      render: (_, record) => <StatusTag toneMap={voucherStatusTone} value={record.voucherStatus} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 130
    }
  ];

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      metrics={
        <MetricGrid spans={[6, 6, 4, 4, 4]}>
          <MetricCard icon={<BankOutlined />} label="对公账户" value={publicAccountProfile.name} />
          <MetricCard icon={<WalletOutlined />} label="账面余额" value={formatMoney(accountBalance)} />
          <MetricCard icon={<FileSearchOutlined />} label="本期入账" value={formatMoney(currentPeriodInflow)} />
          <MetricCard icon={<AuditOutlined />} label="本期出账" value={formatMoney(currentPeriodOutflow)} />
          <MetricCard icon={<ProfileOutlined />} label="待复核净额" value={formatSignedMoney(pendingNetAmount)} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="财务期间">
              <Select
                data-testid="finance-public-account-period-filter"
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.period}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="流水方向">
              <Select
                data-testid="finance-public-account-direction-filter"
                options={[
                  { label: '全部', value: '全部' },
                  { label: '入账', value: '入账' },
                  { label: '出账', value: '出账' }
                ]}
                value={filters.direction}
                onChange={(direction) => setFilters((current) => ({ ...current, direction }))}
              />
            </FilterField>
            <FilterField label="流水状态">
              <Select
                data-testid="finance-public-account-status-filter"
                options={[
                  { label: '全部', value: '全部' },
                  { label: '待复核', value: '待复核' },
                  { label: '退回修改', value: '退回修改' },
                  { label: '已入账', value: '已入账' }
                ]}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-public-account-keyword-input"
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
        count={{ value: rows.length, unit: '条账户流水' }}
        dataSource={rows}
        rowKey="id"
        rowTestIdPrefix="finance-public-account-table-row"
        tableTestId="finance-public-account-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />

      <DetailDrawerShell
        bodyTestId="finance-public-account-detail-drawer"
        className="finance-transaction-drawer"
        open={Boolean(activeRecord)}
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
                  {
                    icon: <BankOutlined />,
                    key: 'account',
                    label: '对公账户',
                    value: activeRecord.settlementAccount || publicAccountProfile.name
                  },
                  {
                    icon: <WalletOutlined />,
                    key: 'amount',
                    label: getAccountDirection(activeRecord) === '入账' ? '入账金额' : '出账金额',
                    value: formatSignedMoney(getPublicAccountSignedAmount(activeRecord))
                  },
                  { icon: <AuditOutlined />, key: 'status', label: '流水状态', value: activeRecord.status },
                  { icon: <FileProtectOutlined />, key: 'voucher', label: '凭证', value: activeRecord.voucherStatus }
                ].filter(Boolean) as DetailSummaryCardItem[]
              }
            />
            <DetailTabs
              defaultActiveKey="flow"
              items={[
                {
                  key: 'flow',
                  label: '账户流水',
                  children: (
                    <DetailSection icon={<WalletOutlined />} title="流水信息">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '流水号', value: activeRecord.transactionNo },
                          { label: '发生日期', value: activeRecord.occurredAt },
                          { label: '财务期间', value: activeRecord.accountingPeriod },
                          { label: '收支方向', value: <StatusTag toneMap={directionTone} value={activeRecord.direction} /> },
                          { label: '账户方向', value: getAccountDirection(activeRecord) },
                          {
                            label: '发生金额',
                            value: (
                              <CellText tone={getSignedAmountTone(getPublicAccountSignedAmount(activeRecord))}>
                                {formatSignedMoney(getPublicAccountSignedAmount(activeRecord))}
                              </CellText>
                            )
                          },
                          { label: '一级类目', value: getFinanceRecordCategorySnapshot(activeRecord).primaryName },
                          { label: '二级类目', value: getFinanceRecordCategorySnapshot(activeRecord).secondaryName },
                          { label: '统计归集', value: getFinanceRecordCategorySnapshot(activeRecord).reportAggregation },
                          { label: '收付方式', value: activeRecord.paymentMethod },
                          { label: '对公账户', value: activeRecord.settlementAccount || publicAccountProfile.name },
                          { label: '币种', value: activeRecord.currency },
                          { label: '备注', value: activeRecord.note, wide: true }
                        ]}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'source',
                  label: '业务来源',
                  children: (
                    <DetailSection icon={<FileSearchOutlined />} title="来源信息">
                      <DetailInfoGrid
                        columns={2}
                        items={[
                          { label: '业务对象', value: activeRecord.counterparty },
                          { label: '对象类型', value: activeRecord.counterpartyType },
                          { label: '来源类型', value: activeRecord.sourceType },
                          { label: '来源单号', value: activeRecord.sourceNo },
                          ...(activeRecord.collectionSourceTransactionNo
                            ? [
                                { label: '处理来源', value: activeRecord.collectionSourceTransactionNo },
                                { label: '经办来源', value: activeRecord.collectionFromAccount },
                                { label: '进入对公账户', value: activeRecord.collectionToAccount }
                              ]
                            : []),
                          { label: '事项说明', value: activeRecord.sourceTitle, wide: true }
                        ]}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'voucher',
                  label: '凭证文件',
                  children: (
                    <DetailSection icon={<FileProtectOutlined />} title="凭证文件">
                      <RelatedFileTable
                        records={activeRecord.files}
                        onDownload={(file) => {
                          void messageApi.success(`${file.name} 下载请求已记录`);
                        }}
                        onPreview={(file) => {
                          void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
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
              tabTestIdPrefix="finance-public-account-detail-tab"
              testId="finance-public-account-detail-tabs"
            />
          </>
        ) : null}
      </DetailDrawerShell>
    </ManagementPageScaffold>
  );
}
