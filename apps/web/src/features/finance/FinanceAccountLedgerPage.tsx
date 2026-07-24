import {
  AuditOutlined,
  BankOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { TagChipList } from '../../components/TagChip';
import { CellText, CompactCell, type CellTextTone } from '../../components/TableCell';
import {
  formatPublicAccountTail,
  publicAccountStatusTone,
  publicAccountUsageOptions,
  publicAccountUsageTone,
  type PublicAccountRecord,
  type PublicAccountStatus,
  type PublicAccountUsage,
  usePublicAccountConfigState
} from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import type { FinanceTransactionRecord, FinanceTransactionStatus } from './financeData';
import {
  financeToday,
  formatMoney,
  getFinanceRecordCategorySnapshot,
  getPublicAccountSignedAmount,
  reconciliationStatusTone,
  transactionStatusTone
} from './financeUtils';

type AccountLedgerStatusFilter = '全部' | PublicAccountStatus;
type AccountLedgerUsageFilter = '全部' | PublicAccountUsage;

type AccountLedgerFilters = {
  keyword: string;
  status: AccountLedgerStatusFilter;
  usage: AccountLedgerUsageFilter;
};

type AccountLedgerRow = {
  account: PublicAccountRecord;
  balance: number;
  currentInflow: number;
  currentOutflow: number;
  enteredRows: FinanceTransactionRecord[];
  lastActivity: string;
  movementRows: FinanceTransactionRecord[];
  pendingNetAmount: number;
  pendingRows: FinanceTransactionRecord[];
  unreconciledAmount: number;
  unreconciledRows: FinanceTransactionRecord[];
};

const defaultFilters: AccountLedgerFilters = {
  keyword: '',
  status: '全部',
  usage: '全部'
};

function isAccountMovement(record: FinanceTransactionRecord) {
  return record.status !== '已作废' && Boolean(record.publicAccountId);
}

function getAccountDirection(record: FinanceTransactionRecord) {
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

function sortMovementRows(rows: FinanceTransactionRecord[]) {
  return [...rows].sort((first, second) =>
    `${second.occurredAt} ${second.transactionNo}`.localeCompare(`${first.occurredAt} ${first.transactionNo}`)
  );
}

function isOnOrAfterOpeningBalanceDate(record: FinanceTransactionRecord, account: PublicAccountRecord) {
  return record.occurredAt >= account.openingBalanceDate;
}

function buildAccountLedgerRows(accounts: PublicAccountRecord[], financeRows: FinanceTransactionRecord[]): AccountLedgerRow[] {
  return accounts.map((account) => {
    const movementRows = sortMovementRows(financeRows.filter((record) => isAccountMovement(record) && record.publicAccountId === account.id));
    const enteredRows = movementRows.filter((record) => record.status === '已入账');
    const balanceRows = enteredRows.filter((record) => isOnOrAfterOpeningBalanceDate(record, account));
    const currentRows = enteredRows.filter((record) => record.accountingPeriod === financeToday.slice(0, 7));
    const pendingRows = movementRows.filter((record) => record.status === '待复核');
    const unreconciledRows = movementRows.filter((record) => record.status === '已入账' && record.reconciliationStatus !== '已对账');
    const balance = account.openingBalance + balanceRows.reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);
    const currentInflow = currentRows.reduce((total, record) => {
      const amount = getPublicAccountSignedAmount(record);
      return amount > 0 ? total + amount : total;
    }, 0);
    const currentOutflow = currentRows.reduce((total, record) => {
      const amount = getPublicAccountSignedAmount(record);
      return amount < 0 ? total + Math.abs(amount) : total;
    }, 0);
    const pendingNetAmount = pendingRows.reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);
    const unreconciledAmount = unreconciledRows.reduce((total, record) => total + Math.abs(getPublicAccountSignedAmount(record)), 0);

    return {
      account,
      balance,
      currentInflow,
      currentOutflow,
      enteredRows,
      lastActivity: movementRows[0]?.occurredAt ?? account.updatedAt,
      movementRows,
      pendingNetAmount,
      pendingRows,
      unreconciledAmount,
      unreconciledRows
    };
  });
}

function matchesAccountLedgerFilters(row: AccountLedgerRow, filters: AccountLedgerFilters) {
  if (filters.status !== '全部' && row.account.status !== filters.status) {
    return false;
  }

  if (filters.usage !== '全部' && !row.account.usage.includes(filters.usage)) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [
    row.account.displayName,
    row.account.bankName,
    row.account.accountHolder,
    row.account.accountTailNumber,
    row.account.note,
    ...row.account.usage
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function createMovementColumns(): TableColumnsType<FinanceTransactionRecord> {
  return [
    {
      title: '发生日期',
      dataIndex: 'occurredAt',
      width: 110
    },
    {
      title: '流水号',
      key: 'transactionNo',
      width: 160,
      render: (_, record) => <CompactCell primary={record.transactionNo} secondary={record.accountingPeriod} />
    },
    {
      title: '方向',
      key: 'direction',
      width: 86,
      render: (_, record) => <StatusTag tone={getAccountDirection(record) === '入账' ? 'green' : 'red'} value={getAccountDirection(record)} />
    },
    {
      title: '财务类目',
      key: 'category',
      width: 170,
      render: (_, record) => {
        const category = getFinanceRecordCategorySnapshot(record);
        return <CompactCell primary={category.secondaryName} secondary={category.primaryName} />;
      }
    },
    {
      title: '对象',
      key: 'counterparty',
      width: 150,
      render: (_, record) => <CompactCell primary={record.counterparty} secondary={record.counterpartyType} />
    },
    {
      title: '金额',
      key: 'amount',
      width: 128,
      render: (_, record) => {
        const signedAmount = getPublicAccountSignedAmount(record);
        return <CellText tone={getSignedAmountTone(signedAmount)}>{formatSignedMoney(signedAmount)}</CellText>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 104,
      render: (status: FinanceTransactionStatus) => <StatusTag toneMap={transactionStatusTone} value={status} />
    },
    {
      title: '对账',
      dataIndex: 'reconciliationStatus',
      width: 104,
      render: (status: FinanceTransactionRecord['reconciliationStatus']) => <StatusTag toneMap={reconciliationStatusTone} value={status} />
    }
  ];
}

function AccountLedgerDrawer({
  row,
  onClose,
  onDownloadFile,
  onPreviewFile
}: {
  row?: AccountLedgerRow;
  onClose: () => void;
  onDownloadFile?: (fileName: string) => void;
  onPreviewFile?: (fileName: string) => void;
}) {
  const movementColumns = useMemo(() => createMovementColumns(), []);

  if (!row) {
    return null;
  }

  return (
    <DetailDrawerShell
      bodyTestId="finance-account-ledger-detail-drawer"
      className="finance-transaction-drawer"
      open={Boolean(row)}
      title={
        <DetailDrawerTitle
          status={row.account.status}
          statusToneMap={publicAccountStatusTone}
          subtitle={`${row.account.bankName} / ${formatPublicAccountTail(row.account.accountTailNumber)}`}
          title="账户台账详情"
        />
      }
      width={940}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <BankOutlined />, key: 'account', label: '账户名称', value: row.account.displayName },
          { icon: <WalletOutlined />, key: 'balance', label: '账面余额', value: formatMoney(row.balance) },
          { icon: <ProfileOutlined />, key: 'pending', label: '待复核净额', value: formatSignedMoney(row.pendingNetAmount) },
          { icon: <FileSearchOutlined />, key: 'unreconciled', label: '未对账金额', value: formatMoney(row.unreconciledAmount) }
        ]}
      />

      <DetailTabs
        defaultActiveKey="info"
        items={[
          {
            key: 'info',
            label: '账户信息',
            children: (
              <DetailSection icon={<BankOutlined />} title="账户信息">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '账户名称', value: row.account.displayName },
                    { label: '开户行', value: row.account.bankName },
                    { label: '账户户名', value: row.account.accountHolder },
                    { label: '账号尾号', value: formatPublicAccountTail(row.account.accountTailNumber) },
                    { label: '期初日期', value: row.account.openingBalanceDate },
                    { label: '期初余额', value: formatMoney(row.account.openingBalance) },
                    {
                      label: '账户能力',
                      value: <TagChipList items={row.account.usage} maxVisible={5} tone={(usage) => publicAccountUsageTone[usage as PublicAccountUsage]} wrap />,
                      wide: true
                    },
                    {
                      label: '默认承接',
                      value: row.account.defaultFor.length ? (
                        <TagChipList items={row.account.defaultFor} maxVisible={5} tone={(usage) => publicAccountUsageTone[usage as PublicAccountUsage]} wrap />
                      ) : '-',
                      wide: true
                    },
                    { label: '备注', value: row.account.note || '-', wide: true }
                  ]}
                />
              </DetailSection>
            )
          },
          {
            key: 'flows',
            label: '账户流水',
            children: (
              <DetailSection icon={<WalletOutlined />} title="账户流水">
                <ManagementTable<FinanceTransactionRecord>
                  columns={movementColumns}
                  count={{ value: row.movementRows.length, unit: '条流水' }}
                  dataSource={row.movementRows}
                  rowKey="id"
                  tableTestId="finance-account-ledger-flow-table"
                />
              </DetailSection>
            )
          },
          {
            key: 'pending',
            label: '待复核',
            children: (
              <DetailSection icon={<AuditOutlined />} title="待复核流水">
                <ManagementTable<FinanceTransactionRecord>
                  columns={movementColumns}
                  count={{ value: row.pendingRows.length, unit: '条流水' }}
                  dataSource={row.pendingRows}
                  rowKey="id"
                  tableTestId="finance-account-ledger-pending-table"
                />
              </DetailSection>
            )
          },
          {
            key: 'unreconciled',
            label: '未对账',
            children: (
              <DetailSection icon={<FileSearchOutlined />} title="未对账流水">
                <ManagementTable<FinanceTransactionRecord>
                  columns={movementColumns}
                  count={{ value: row.unreconciledRows.length, unit: '条流水' }}
                  dataSource={row.unreconciledRows}
                  rowKey="id"
                  tableTestId="finance-account-ledger-unreconciled-table"
                />
              </DetailSection>
            )
          },
          {
            key: 'records',
            label: '操作记录',
            children: (
              <>
                <OperationRecordSection icon={<AuditOutlined />} records={row.account.operationRecords} title="账户配置记录" />
                <DetailSection icon={<FileProtectOutlined />} title="近期凭证">
                  <RelatedFileTable
                    records={row.movementRows.flatMap((record) => record.files).slice(0, 8)}
                    onDownload={onDownloadFile ? (file) => onDownloadFile(file.name) : undefined}
                    onPreview={onPreviewFile ? (file) => onPreviewFile(file.name) : undefined}
                  />
                </DetailSection>
              </>
            )
          }
        ]}
        tabTestIdPrefix="finance-account-ledger-detail-tab"
        testId="finance-account-ledger-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

export function FinanceAccountLedgerPage() {
  const { financeRows } = useFinanceManagement();
  const { publicAccounts } = usePublicAccountConfigState();
  const [filters, setFilters] = useState<AccountLedgerFilters>(defaultFilters);
  const [activeAccountId, setActiveAccountId] = useState<string>();

  const accountRows = useMemo(() => buildAccountLedgerRows(publicAccounts, financeRows), [financeRows, publicAccounts]);
  const rows = useMemo(() => accountRows.filter((row) => matchesAccountLedgerFilters(row, filters)), [accountRows, filters]);
  const activeRow = useMemo(() => accountRows.find((row) => row.account.id === activeAccountId), [accountRows, activeAccountId]);
  const enabledRows = accountRows.filter((row) => row.account.status === '启用');
  const totalBalance = enabledRows.reduce((total, row) => total + row.balance, 0);
  const currentInflow = enabledRows.reduce((total, row) => total + row.currentInflow, 0);
  const currentOutflow = enabledRows.reduce((total, row) => total + row.currentOutflow, 0);
  const pendingNetAmount = enabledRows.reduce((total, row) => total + row.pendingNetAmount, 0);

  const columns: TableColumnsType<AccountLedgerRow> = [
    {
      title: '账户',
      key: 'account',
      width: 230,
      render: (_, row) => <CompactCell primary={row.account.displayName} secondary={`${row.account.bankName} / ${formatPublicAccountTail(row.account.accountTailNumber)}`} />
    },
    {
      title: '账户户名',
      key: 'holder',
      width: 190,
      render: (_, row) => row.account.accountHolder
    },
    {
      title: '账户能力',
      key: 'usage',
      width: 240,
      render: (_, row) => <TagChipList items={row.account.usage} maxVisible={4} tone={(usage) => publicAccountUsageTone[usage as PublicAccountUsage]} wrap />
    },
    {
      title: '账面余额',
      dataIndex: 'balance',
      width: 138,
      render: (amount: number) => <CellText tone={getSignedAmountTone(amount)}>{formatMoney(amount)}</CellText>
    },
    {
      title: '本期入账',
      dataIndex: 'currentInflow',
      width: 128,
      render: (amount: number) => <CellText tone="income">{formatMoney(amount)}</CellText>
    },
    {
      title: '本期出账',
      dataIndex: 'currentOutflow',
      width: 128,
      render: (amount: number) => <CellText tone="expense">{formatMoney(amount)}</CellText>
    },
    {
      title: '待复核净额',
      dataIndex: 'pendingNetAmount',
      width: 138,
      render: (amount: number) => <CellText tone={getSignedAmountTone(amount)}>{formatSignedMoney(amount)}</CellText>
    },
    {
      title: '未对账',
      dataIndex: 'unreconciledAmount',
      width: 128,
      render: (amount: number) => <CellText>{formatMoney(amount)}</CellText>
    },
    {
      title: '状态',
      key: 'status',
      width: 96,
      render: (_, row) => <StatusTag toneMap={publicAccountStatusTone} value={row.account.status} />
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<BankOutlined />} label="启用账户" value={`${enabledRows.length} 个`} />
          <MetricCard icon={<WalletOutlined />} label="账面余额" value={formatMoney(totalBalance)} />
          <MetricCard icon={<FileSearchOutlined />} label="本期入账" value={formatMoney(currentInflow)} />
          <MetricCard icon={<AuditOutlined />} label="本期出账" value={formatMoney(currentOutflow)} />
          <MetricCard icon={<ProfileOutlined />} label="待复核净额" value={formatSignedMoney(pendingNetAmount)} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="状态">
              <Select
                data-testid="finance-account-ledger-status-filter"
                options={['全部', '启用', '停用'].map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <FilterField label="账户能力">
              <Select
                data-testid="finance-account-ledger-usage-filter"
                options={['全部', ...publicAccountUsageOptions].map((usage) => ({ label: usage, value: usage }))}
                value={filters.usage}
                onChange={(usage) => setFilters((current) => ({ ...current, usage }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-account-ledger-keyword-input"
              placeholder="账户名称 / 开户行 / 户名"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-account-ledger"
    >
      <ManagementTable<AccountLedgerRow>
        columns={columns}
        count={{ value: rows.length, unit: '个账户' }}
        dataSource={rows}
        rowKey={(row) => row.account.id}
        rowTestIdPrefix="finance-account-ledger-table-row"
        tableTestId="finance-account-ledger-table"
        onRowClick={(row) => setActiveAccountId(row.account.id)}
      />

      <AccountLedgerDrawer
        row={activeRow}
        onClose={() => setActiveAccountId(undefined)}
      />
    </ManagementPageScaffold>
  );
}
