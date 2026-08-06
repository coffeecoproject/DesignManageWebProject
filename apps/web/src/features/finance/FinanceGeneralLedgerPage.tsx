import {
  BookOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  LockOutlined,
  PartitionOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { Alert, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DateScopeFilter, type DateScopeFilterMode } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import { useFinanceLedgerInitialization } from './FinanceLedgerInitializationState';
import { buildLedgerInitializationOpeningBalancesForGeneralLedger } from './financeLedgerInitializationModel';
import {
  accountingStatementTargetTone,
  accountingSubjectTypeOptions,
  accountingSubjectTypeTone,
  type AccountingSubjectType
} from './financeAccountingSubjectData';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVouchers
} from './financeAccountingVoucherModel';
import {
  buildGeneralLedgerResponse,
  defaultGeneralLedgerFilters,
  generalLedgerDefaultMonth,
  getGeneralLedgerBalancePresentation,
  getGeneralLedgerPeriodLabel,
  getGeneralLedgerReadbackNotice,
  type GeneralLedgerBalanceSide,
  type GeneralLedgerDetailEntry,
  type GeneralLedgerFilters,
  type GeneralLedgerPeriodSummary,
  type GeneralLedgerPeriodStatus,
  type GeneralLedgerSubjectBalanceRow
} from './financeGeneralLedgerModel';
import { formatMoney } from './financeUtils';

const balanceDirectionTone = {
  借方: 'green',
  贷方: 'red',
  平: 'gray'
} as const;

const subjectMovementTone = {
  无发生额: 'gray',
  有发生额: 'green'
} as const;

const generalLedgerPeriodModeOptions: Array<{ label: string; value: DateScopeFilterMode }> = [
  { label: '当月', value: 'currentMonth' },
  { label: '按月份', value: 'month' }
];

const periodStatusTone: Record<GeneralLedgerPeriodStatus, 'blue' | 'gray' | 'green'> = {
  开放: 'green',
  已结账: 'gray',
  已反结账: 'blue',
  跨期查看: 'blue'
};

const trialBalanceStatusTone = {
  不平衡: 'red',
  平衡: 'green'
} as const;

function formatOptionalMoney(amount: number) {
  return amount === 0 ? '-' : formatMoney(amount);
}

function formatLedgerBalance(amount: number, side: GeneralLedgerBalanceSide) {
  return side === '平' || amount === 0 ? '平' : `${side} ${formatMoney(amount)}`;
}

function LedgerBalanceCell({ amount, side }: { amount: number; side: GeneralLedgerBalanceSide }) {
  if (side === '平' || amount === 0) {
    return <CellText tone="subtle">-</CellText>;
  }

  return <CompactCell primary={formatMoney(amount)} secondary={`${side}余额`} />;
}

function getSubjectMovementStatus(row: GeneralLedgerSubjectBalanceRow) {
  return row.entryCount > 0 ? '有发生额' : '无发生额';
}

function GeneralLedgerDetailDrawer({
  periodLabel,
  periodSummary,
  record,
  onClose
}: {
  periodLabel: string;
  periodSummary: GeneralLedgerPeriodSummary;
  record?: GeneralLedgerSubjectBalanceRow;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }

  const readbackNotice = getGeneralLedgerReadbackNotice(periodSummary);
  const detailColumns: TableColumnsType<GeneralLedgerDetailEntry> = [
    {
      title: '日期',
      dataIndex: 'voucherDate',
      width: 108
    },
    {
      title: '凭证号',
      key: 'voucher',
      width: 170,
      render: (_, entry) => <CompactCell primary={entry.voucherNo} secondary={entry.summary} />
    },
    {
      title: '辅助核算',
      dataIndex: 'auxiliary',
      width: 150
    },
    {
      title: '借方金额',
      dataIndex: 'debitAmount',
      width: 128,
      render: (amount: number) => <CellText tone={amount > 0 ? 'income' : 'subtle'}>{formatOptionalMoney(amount)}</CellText>
    },
    {
      title: '贷方金额',
      dataIndex: 'creditAmount',
      width: 128,
      render: (amount: number) => <CellText tone={amount > 0 ? 'expense' : 'subtle'}>{formatOptionalMoney(amount)}</CellText>
    },
    {
      title: '余额',
      dataIndex: 'runningBalance',
      width: 128,
      render: (amount: number) => {
        const balance = getGeneralLedgerBalancePresentation(amount, record.balanceDirection);

        return <LedgerBalanceCell amount={balance.amount} side={balance.side} />;
      }
    }
  ];

  return (
    <DetailDrawerShell
      bodyTestId="finance-general-ledger-detail-drawer"
      className="finance-transaction-drawer"
      open={Boolean(record)}
      title={
        <DetailDrawerTitle
          status={getSubjectMovementStatus(record)}
          statusToneMap={subjectMovementTone}
          subtitle={`${record.subjectCode} / ${periodLabel}`}
          title="总账明细"
        />
      }
      width={920}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          {
            icon: <ProfileOutlined />,
            key: 'opening',
            label: '期初余额',
            value: formatLedgerBalance(record.openingBalanceAmount, record.openingBalanceSide)
          },
          { icon: <BookOutlined />, key: 'debit', label: '本期借方', value: formatMoney(record.debitAmount) },
          { icon: <BookOutlined />, key: 'credit', label: '本期贷方', value: formatMoney(record.creditAmount) },
          {
            icon: <CheckCircleOutlined />,
            key: 'ending',
            label: '期末余额',
            value: formatLedgerBalance(record.endingBalanceAmount, record.endingBalanceSide)
          }
        ]}
      />

      <DetailSection icon={<LockOutlined />} title="期间状态">
        {readbackNotice ? (
          <Alert className="drawer-inline-alert" message={readbackNotice} showIcon type="info" />
        ) : null}
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '会计期间', value: periodSummary.periodLabel },
            { label: '期间状态', value: <StatusTag toneMap={periodStatusTone} value={periodSummary.periodStatus} /> },
            { label: '试算状态', value: <StatusTag toneMap={trialBalanceStatusTone} value={periodSummary.trialBalanceStatus} /> },
            ...(periodSummary.periodStatus === '已结账'
              ? [
                  ...(periodSummary.lockedAt ? [{ label: '结账时间', value: periodSummary.lockedAt }] : []),
                  ...(periodSummary.lockedBy ? [{ label: '结账人', value: periodSummary.lockedBy }] : []),
                  ...(periodSummary.lockedReason ? [{ label: '结账说明', value: periodSummary.lockedReason }] : [])
                ]
              : [])
          ]}
        />
      </DetailSection>

      <DetailSection icon={<PartitionOutlined />} title="科目信息">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '科目编码', value: record.subjectCode },
            { label: '科目名称', value: record.subjectName },
            { label: '科目类别', value: <StatusTag toneMap={accountingSubjectTypeTone} value={record.subjectType} /> },
            { label: '正常余额', value: <StatusTag toneMap={balanceDirectionTone} value={record.balanceDirection} /> },
            { label: '报表归属', value: <StatusTag toneMap={accountingStatementTargetTone} value={record.statementTarget} /> },
            { label: '报表项目', value: record.reportItem },
            { label: '会计期间', value: periodLabel },
            { label: '期初来源', value: record.openingBalanceSource },
            { label: '分录数', value: record.entryCount },
            { label: '凭证数', value: record.voucherCount }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<FileTextOutlined />} title="科目明细">
        <CompactDetailTable<GeneralLedgerDetailEntry>
          columns={detailColumns}
          dataSource={record.entries}
          emptyText="本期间暂无已记账分录"
          rowKey="id"
          scrollX={812}
        />
      </DetailSection>
    </DetailDrawerShell>
  );
}

export function FinanceGeneralLedgerPage() {
  const { enabledOpeningRows, enabledProfile, enabledSubjectRows } = useFinanceLedgerInitialization();
  const {
    accountingPeriodLocks,
    accountingVoucherLaterPeriodAdjustmentRows,
    accountingVoucherLifecycleRows,
    bankReconciliationRows,
    declarationPreparationRows,
    financeRows,
    invoiceBusinessAllocationRows,
    invoiceRows,
    ledgerOpeningAdjustmentRows,
    monthEndMatterRows,
    receivablePayableRows,
    taxMatterRows
  } = useFinanceManagement();
  const [filters, setFilters] = useState<GeneralLedgerFilters>(defaultGeneralLedgerFilters);
  const [activeSubjectCode, setActiveSubjectCode] = useState<string>();

  const voucherRows = useMemo(
    () => enabledProfile
      ? applyAccountingVoucherLifecycle(
          buildAccountingVouchers(
            receivablePayableRows,
            financeRows,
            invoiceRows,
            taxMatterRows,
            bankReconciliationRows,
            ledgerOpeningAdjustmentRows,
            accountingVoucherLaterPeriodAdjustmentRows,
            {
              accountingPeriodStart: enabledProfile.effectivePeriod,
              declarationPreparationRows,
              invoiceBusinessAllocationRows,
              monthEndMatterRows
            }
          ),
          accountingVoucherLifecycleRows
        )
      : [],
    [
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingVoucherLifecycleRows,
      bankReconciliationRows,
      declarationPreparationRows,
      enabledProfile,
      financeRows,
      invoiceBusinessAllocationRows,
      invoiceRows,
      ledgerOpeningAdjustmentRows,
      monthEndMatterRows,
      receivablePayableRows,
      taxMatterRows
    ]
  );
  const ledgerEntries = useMemo(() => buildAccountingLedgerEntries(voucherRows), [voucherRows]);
  const openingBalances = useMemo(
    () =>
      enabledProfile
        ? buildLedgerInitializationOpeningBalancesForGeneralLedger(enabledOpeningRows, enabledProfile)
        : [],
    [enabledOpeningRows, enabledProfile]
  );
  const ledgerResponse = useMemo(
    () => buildGeneralLedgerResponse({ entries: ledgerEntries, filters, openingBalances, periodLocks: accountingPeriodLocks, subjects: enabledSubjectRows }),
    [accountingPeriodLocks, enabledSubjectRows, filters, ledgerEntries, openingBalances]
  );
  const { metrics, periodSummary, rows } = ledgerResponse;
  const readbackNotice = getGeneralLedgerReadbackNotice(periodSummary);
  const periodLabel = useMemo(
    () => getGeneralLedgerPeriodLabel(filters.accountingPeriodTime, generalLedgerDefaultMonth),
    [filters.accountingPeriodTime]
  );
  const activeRecord = useMemo(
    () => rows.find((record) => record.subjectCode === activeSubjectCode),
    [activeSubjectCode, rows]
  );

  const columns: TableColumnsType<GeneralLedgerSubjectBalanceRow> = [
    {
      title: '科目',
      key: 'subject',
      width: 230,
      render: (_, record) => (
        <CompactCell
          primary={`${record.subjectCode} ${record.subjectName}`}
          secondary={`${record.reportItem} / ${record.statementTarget}`}
        />
      )
    },
    {
      title: '类别',
      dataIndex: 'subjectType',
      width: 110,
      render: (subjectType: AccountingSubjectType) => <StatusTag toneMap={accountingSubjectTypeTone} value={subjectType} />
    },
    {
      title: '正常余额',
      dataIndex: 'balanceDirection',
      width: 86,
      render: (direction: GeneralLedgerSubjectBalanceRow['balanceDirection']) => (
        <StatusTag toneMap={balanceDirectionTone} value={direction} />
      )
    },
    {
      title: '期初余额',
      key: 'openingBalance',
      width: 130,
      render: (_, record) => <LedgerBalanceCell amount={record.openingBalanceAmount} side={record.openingBalanceSide} />
    },
    {
      title: '本期借方',
      dataIndex: 'debitAmount',
      width: 130,
      render: (amount: number) => <CellText tone={amount > 0 ? 'income' : 'subtle'}>{formatOptionalMoney(amount)}</CellText>
    },
    {
      title: '本期贷方',
      dataIndex: 'creditAmount',
      width: 130,
      render: (amount: number) => <CellText tone={amount > 0 ? 'expense' : 'subtle'}>{formatOptionalMoney(amount)}</CellText>
    },
    {
      title: '期末余额',
      key: 'endingBalance',
      width: 130,
      render: (_, record) => <LedgerBalanceCell amount={record.endingBalanceAmount} side={record.endingBalanceSide} />
    },
    {
      title: '凭证数',
      key: 'voucherCount',
      width: 96,
      render: (_, record) => <CompactCell align="center" primary={record.voucherCount} secondary={`${record.entryCount} 条分录`} />
    }
  ];

  return (
    <ManagementPageScaffold
      feedback={
        readbackNotice ? (
          <Alert
            data-testid="finance-general-ledger-readback-notice"
            message={readbackNotice}
            showIcon
            type="info"
          />
        ) : undefined
      }
      layout="table-workbench"
      metrics={
        <MetricGrid columns={3} density="compact">
          <MetricCard icon={<ProfileOutlined />} label="会计期间" value={periodSummary.periodLabel} />
          <MetricCard
            icon={<LockOutlined />}
            label="期间状态"
            value={<StatusTag toneMap={periodStatusTone} value={periodSummary.periodStatus} />}
          />
          <MetricCard
            icon={<CheckCircleOutlined />}
            label="试算状态"
            value={<StatusTag toneMap={trialBalanceStatusTone} value={periodSummary.trialBalanceStatus} />}
          />
          <MetricCard icon={<FileTextOutlined />} label="已记账凭证" value={metrics.bookedVoucherCount} />
          <MetricCard icon={<BookOutlined />} label="本期借方" value={formatMoney(metrics.debitTotal)} />
          <MetricCard icon={<BookOutlined />} label="本期贷方" value={formatMoney(metrics.creditTotal)} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={generalLedgerDefaultMonth}
              label="会计期间"
              modeOptions={generalLedgerPeriodModeOptions}
              testIdPrefix="finance-general-ledger-period"
              value={filters.accountingPeriodTime}
              onChange={(accountingPeriodTime) => setFilters((current) => ({ ...current, accountingPeriodTime }))}
            />
            <FilterField label="科目类别">
              <Select
                data-testid="finance-general-ledger-subject-type-filter"
                options={(['全部', ...accountingSubjectTypeOptions] satisfies Array<'全部' | AccountingSubjectType>).map((subjectType) => ({
                  label: subjectType,
                  value: subjectType
                }))}
                value={filters.subjectType}
                onChange={(subjectType) => setFilters((current) => ({ ...current, subjectType }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-general-ledger-keyword-input"
              placeholder="科目 / 凭证号 / 摘要"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-general-ledger"
    >
      <ManagementTable<GeneralLedgerSubjectBalanceRow>
        columns={columns}
        count={{ value: rows.length, unit: '个科目' }}
        dataSource={rows}
        rowKey="subjectCode"
        rowTestIdPrefix="finance-general-ledger-table-row"
        tableTestId="finance-general-ledger-table"
        onRowClick={(record) => setActiveSubjectCode(record.subjectCode)}
      />

      <GeneralLedgerDetailDrawer
        periodLabel={periodLabel}
        periodSummary={periodSummary}
        record={activeRecord}
        onClose={() => setActiveSubjectCode(undefined)}
      />
    </ManagementPageScaffold>
  );
}
