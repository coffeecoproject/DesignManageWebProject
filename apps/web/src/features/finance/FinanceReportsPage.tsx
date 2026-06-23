import { Select } from 'antd';
import { useMemo, useState } from 'react';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ReportSummaryBar } from '../../components/ReportSummaryBar';
import { TabbedManagementTable, createTabbedManagementTableItem } from '../../components/TabbedManagementTable';
import { financeReportAggregationOptions } from '../system/FinanceCategoryState';
import { useFinanceManagement } from './FinanceManagementState';
import { FinanceStatisticsDetailDrawer } from './FinanceStatisticsDetailDrawer';
import {
  financeStatisticsCategoryColumns,
  financeStatisticsExpenseColumns,
  financeStatisticsIncomeColumns,
  financeStatisticsSourceColumns
} from './FinanceStatisticsColumns';
import { financeReceivablePayableRecords } from './financeReceivablesPayablesData';
import { formatMoney } from './financeUtils';
import {
  buildCategoryStatisticsRows,
  buildFinanceCategoryReportDetail,
  buildFinanceReportSourceRows,
  buildFinanceSourceReportDetail,
  defaultFinanceReportFilters,
  financeStatisticsBasisOptions,
  getAvailableFinanceReportPeriods,
  getFinanceReportSummaryTone,
  type FinanceCategoryStatisticsRow,
  type FinanceReportDrawerDetail,
  type FinanceReportFilters,
  type FinanceReportTabKey,
  type FinanceStatisticsSourceRow
} from './financeStatisticsModel';

export function FinanceReportsPage() {
  const { financeRows } = useFinanceManagement();
  const [activeTab, setActiveTab] = useState<FinanceReportTabKey>('category');
  const [filters, setFilters] = useState<FinanceReportFilters>(defaultFinanceReportFilters);
  const [activeDetail, setActiveDetail] = useState<FinanceReportDrawerDetail>();

  const updateFilters = (patch: Partial<FinanceReportFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setActiveDetail(undefined);
  };

  const periodOptions = useMemo(() => ['全部', ...getAvailableFinanceReportPeriods(financeRows)], [financeRows]);
  const categoryRows = useMemo(
    () => buildCategoryStatisticsRows(financeRows, financeReceivablePayableRecords, filters),
    [financeRows, filters]
  );
  const incomeRows = useMemo(() => categoryRows.filter((row) => row.income > 0), [categoryRows]);
  const expenseRows = useMemo(() => categoryRows.filter((row) => row.expense > 0), [categoryRows]);
  const sourceRows = useMemo(() => buildFinanceReportSourceRows(categoryRows), [categoryRows]);

  const totalIncome = categoryRows.reduce((total, row) => total + row.income, 0);
  const totalExpense = categoryRows.reduce((total, row) => total + row.expense, 0);
  const netAmount = totalIncome - totalExpense;
  const selectedAggregationLabel = filters.aggregation === '全部' ? '全部归集' : filters.aggregation;
  const selectedPeriodLabel = filters.period === '全部' ? '全部期间' : filters.period;

  return (
    <ManagementPageScaffold
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="期间">
              <Select
                className="field-control"
                data-testid="finance-statistics-period-filter"
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.period}
                onChange={(period) => updateFilters({ period })}
              />
            </FilterField>
            <FilterField label="统计口径">
              <Select
                className="field-control"
                data-testid="finance-statistics-basis-filter"
                options={financeStatisticsBasisOptions.map((basis) => ({ label: basis, value: basis }))}
                value={filters.basis}
                onChange={(basis) => updateFilters({ basis })}
              />
            </FilterField>
            <FilterField label="统计归集">
              <Select
                className="field-control"
                data-testid="finance-statistics-aggregation-filter"
                options={(['全部', ...financeReportAggregationOptions] satisfies FinanceReportFilters['aggregation'][]).map((aggregation) => ({
                  label: aggregation,
                  value: aggregation
                }))}
                value={filters.aggregation}
                onChange={(aggregation) => updateFilters({ aggregation })}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-statistics-keyword-input"
              placeholder="类目 / 对象 / 单号"
              value={filters.keyword}
              onChange={(keyword) => updateFilters({ keyword })}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <ReportSummaryBar
          density="compact"
          meta={`${selectedPeriodLabel} / ${filters.basis} / ${selectedAggregationLabel}`}
          title="统计摘要"
          items={[
            { key: 'income', label: '收入合计', tone: 'income', value: formatMoney(totalIncome) },
            { key: 'expense', label: '支出合计', tone: 'expense', value: formatMoney(totalExpense) },
            { key: 'net', label: '收支差额', tone: getFinanceReportSummaryTone(netAmount), value: formatMoney(netAmount) },
            { key: 'sources', label: '来源记录', value: `${sourceRows.length} 条` }
          ]}
        />
      }
      pageId="finance-statistics"
    >
      <TabbedManagementTable
        activeKey={activeTab}
        tabs={[
          createTabbedManagementTableItem<FinanceCategoryStatisticsRow>({
            key: 'category',
            label: '类目统计',
            table: {
              columns: financeStatisticsCategoryColumns,
              count: { value: categoryRows.length, unit: '个类目' },
              dataSource: categoryRows,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-statistics-category-row',
              tableTestId: 'finance-statistics-category-table',
              onRowClick: (row) => setActiveDetail(buildFinanceCategoryReportDetail(row, selectedPeriodLabel))
            }
          }),
          createTabbedManagementTableItem<FinanceCategoryStatisticsRow>({
            key: 'income',
            label: '收入统计',
            table: {
              columns: financeStatisticsIncomeColumns,
              count: { value: incomeRows.length, unit: '个收入类目' },
              dataSource: incomeRows,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-statistics-income-row',
              tableTestId: 'finance-statistics-income-table',
              onRowClick: (row) => setActiveDetail(buildFinanceCategoryReportDetail(row, selectedPeriodLabel))
            }
          }),
          createTabbedManagementTableItem<FinanceCategoryStatisticsRow>({
            key: 'expense',
            label: '支出统计',
            table: {
              columns: financeStatisticsExpenseColumns,
              count: { value: expenseRows.length, unit: '个支出类目' },
              dataSource: expenseRows,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-statistics-expense-row',
              tableTestId: 'finance-statistics-expense-table',
              onRowClick: (row) => setActiveDetail(buildFinanceCategoryReportDetail(row, selectedPeriodLabel))
            }
          }),
          createTabbedManagementTableItem<FinanceStatisticsSourceRow>({
            key: 'sources',
            label: '来源明细',
            table: {
              columns: financeStatisticsSourceColumns,
              count: { value: sourceRows.length, unit: '条来源' },
              dataSource: sourceRows,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-statistics-source-row',
              tableTestId: 'finance-statistics-source-table',
              onRowClick: (row) => setActiveDetail(buildFinanceSourceReportDetail(row, selectedPeriodLabel))
            }
          })
        ]}
        tabTestIdPrefix="finance-statistics-page-tab"
        testId="finance-statistics-page-tabs"
        onChange={(key) => setActiveTab(key as FinanceReportTabKey)}
      />

      <FinanceStatisticsDetailDrawer detail={activeDetail} onClose={() => setActiveDetail(undefined)} />
    </ManagementPageScaffold>
  );
}
