import { BankOutlined, CalendarOutlined, WalletOutlined, WarningOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { useMemo, useState } from 'react';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TabbedManagementTable, createTabbedManagementTableItem } from '../../components/TabbedManagementTable';
import { useFinanceManagement } from './FinanceManagementState';
import {
  buildFinanceReceivablePayableColumns
} from './FinanceReceivablesPayablesColumns';
import { FinanceReceivablesPayablesDetailDrawer } from './FinanceReceivablesPayablesDetailDrawer';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { financeReceivablePayableRecords } from './financeReceivablesPayablesData';
import {
  buildFinanceReceivablePayableFilterOptions,
  buildFinanceReceivablePayableMetrics,
  defaultFinanceReceivablePayableFilters,
  financeReceivablePayableCurrentPeriod,
  getFinanceReceivablePayableAmountLabels,
  getFinanceReceivablePayableDirectionByTab,
  getFinanceReceivablePayableRecordsByTab,
  matchesFinanceReceivablePayableFilters,
  type FinanceReceivablePayableFilters,
  type ReceivablePayableTabKey
} from './financeReceivablesPayablesModel';
import { formatMoney } from './financeUtils';

export function FinanceReceivablesPayablesPage() {
  const { financeRows } = useFinanceManagement();
  const [activeTab, setActiveTab] = useState<ReceivablePayableTabKey>('receivable');
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [filters, setFilters] = useState<FinanceReceivablePayableFilters>(defaultFinanceReceivablePayableFilters);

  const updateFilters = (patch: Partial<FinanceReceivablePayableFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setActiveRecordId(undefined);
  };

  const activeTabRecords = useMemo(
    () => getFinanceReceivablePayableRecordsByTab(financeReceivablePayableRecords, activeTab),
    [activeTab]
  );
  const filteredRecords = useMemo(
    () => activeTabRecords.filter((record) => matchesFinanceReceivablePayableFilters(record, filters)),
    [activeTabRecords, filters]
  );
  const activeRecord = useMemo(
    () => financeReceivablePayableRecords.find((record) => record.id === activeRecordId),
    [activeRecordId]
  );
  const linkedTransactionRows = useMemo(
    () => activeRecord
      ? financeRows.filter((record) => activeRecord.linkedTransactionNos.includes(record.transactionNo))
      : [],
    [activeRecord, financeRows]
  );

  const metrics = useMemo(
    () => buildFinanceReceivablePayableMetrics(financeReceivablePayableRecords),
    []
  );
  const filterOptions = useMemo(
    () => buildFinanceReceivablePayableFilterOptions(financeReceivablePayableRecords, activeTabRecords),
    [activeTabRecords]
  );
  const amountLabels = useMemo(
    () => getFinanceReceivablePayableAmountLabels(getFinanceReceivablePayableDirectionByTab(activeTab)),
    [activeTab]
  );
  const columns = useMemo(
    () => buildFinanceReceivablePayableColumns(amountLabels),
    [amountLabels]
  );

  return (
    <ManagementPageScaffold
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="确认期间">
              <Select
                data-testid="finance-rp-period-filter"
                options={filterOptions.periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.accountingPeriod}
                onChange={(accountingPeriod) => updateFilters({ accountingPeriod })}
              />
            </FilterField>
            <FilterField label="状态" controlWidth="status-select">
              <Select
                data-testid="finance-rp-status-filter"
                options={filterOptions.statusOptions.map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status) => updateFilters({ status })}
              />
            </FilterField>
            <FilterField label="来源类型" controlWidth="wide-select">
              <Select
                data-testid="finance-rp-source-filter"
                options={filterOptions.sourceTypeOptions.map((sourceType) => ({ label: sourceType, value: sourceType }))}
                value={filters.sourceType}
                onChange={(sourceType) => updateFilters({ sourceType })}
              />
            </FilterField>
            <FilterField label="对象类型" controlWidth="wide-select">
              <Select
                data-testid="finance-rp-counterparty-type-filter"
                options={filterOptions.counterpartyTypeOptions.map((counterpartyType) => ({ label: counterpartyType, value: counterpartyType }))}
                value={filters.counterpartyType}
                onChange={(counterpartyType) => updateFilters({ counterpartyType })}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-rp-keyword-input"
              placeholder="对象 / 来源 / 单号"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => updateFilters({ keyword })}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<WalletOutlined />} label="应收未收" value={formatMoney(metrics.receivableOutstanding)} />
          <MetricCard icon={<BankOutlined />} label="应付未付" value={formatMoney(metrics.payableOutstanding)} />
          <MetricCard icon={<CalendarOutlined />} label={`${financeReceivablePayableCurrentPeriod} 确认`} value={formatMoney(metrics.currentConfirmedAmount)} />
          <MetricCard icon={<WarningOutlined />} label="逾期记录" value={`${metrics.overdueRows.length} 条`} />
        </MetricGrid>
      }
      pageId="finance-receivables-payables"
    >
      <TabbedManagementTable
        activeKey={activeTab}
        tabs={[
          createTabbedManagementTableItem<FinanceReceivablePayableRecord>({
            key: 'receivable',
            label: '应收',
            table: {
              columns,
              count: { value: filteredRecords.length, unit: '条应收确认' },
              dataSource: filteredRecords,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-rp-table-row',
              tableTestId: 'finance-rp-receivable-table',
              onRowClick: (record) => setActiveRecordId(record.id)
            }
          }),
          createTabbedManagementTableItem<FinanceReceivablePayableRecord>({
            key: 'payable',
            label: '应付',
            table: {
              columns,
              count: { value: filteredRecords.length, unit: '条应付确认' },
              dataSource: filteredRecords,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-rp-table-row',
              tableTestId: 'finance-rp-payable-table',
              onRowClick: (record) => setActiveRecordId(record.id)
            }
          })
        ]}
        tabTestIdPrefix="finance-rp-page-tab"
        testId="finance-rp-page-tabs"
        onChange={(key) => {
          setActiveRecordId(undefined);
          setActiveTab(key as ReceivablePayableTabKey);
        }}
      />

      <FinanceReceivablesPayablesDetailDrawer
        linkedTransactionRows={linkedTransactionRows}
        record={activeRecord}
        onClose={() => setActiveRecordId(undefined)}
      />
    </ManagementPageScaffold>
  );
}
