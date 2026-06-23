import {
  CalculatorOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  TeamOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { DateScopeFilter, getDateScopeMonthRange } from '../../components/DateFilterFields';
import { FilterBar, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { formatSalaryMoney } from './salaryDomain';
import {
  salaryOverviewBoardColumns,
  salaryOverviewEmployeeColumns
} from './SalaryOverviewColumns';
import {
  buildSalaryOverview,
  defaultSalaryOverviewFilters,
  getSalaryOverviewReportMonths,
  matchesSalaryOverviewReport,
  salaryOverviewDefaultMonth,
  type SalaryOverviewFilters
} from './salaryOverviewModel';
import { useSalaryMonthlyReportBuilder } from './salaryReportBuilder';

const salaryOverviewDefaultMonthRange = getDateScopeMonthRange(salaryOverviewDefaultMonth);
const salaryOverviewTableScrollY = 'calc(100vh - 470px)';

export function SalaryOverviewPage() {
  const { getSalaryMonthlyReports, salaryState } = useSalaryMonthlyReportBuilder();
  const [filters, setFilters] = useState<SalaryOverviewFilters>(defaultSalaryOverviewFilters);
  const reportMonths = useMemo(
    () =>
      getSalaryOverviewReportMonths({
        salaryDetailMonths: salaryState.salaryDetailMonths,
        salaryTime: filters.salaryTime
      }),
    [filters.salaryTime, salaryState.salaryDetailMonths]
  );
  const reports = useMemo(
    () =>
      reportMonths
        .flatMap((month) => getSalaryMonthlyReports(month))
        .filter((report) => matchesSalaryOverviewReport(report, filters.keyword))
        .sort(
          (left, right) =>
            right.month.localeCompare(left.month) ||
            left.member.name.localeCompare(right.member.name, 'zh-CN')
        ),
    [filters.keyword, getSalaryMonthlyReports, reportMonths]
  );
  const overview = useMemo(() => buildSalaryOverview(reports), [reports]);

  return (
    <ManagementPageScaffold
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={salaryOverviewDefaultMonth}
              defaultRange={salaryOverviewDefaultMonthRange}
              label="薪酬时间"
              testIdPrefix="salary-overview-time-filter"
              value={filters.salaryTime}
              onChange={(salaryTime) => setFilters((current) => ({ ...current, salaryTime }))}
            />
            <KeywordFilter
              placeholder="姓名 / 工号 / 岗位"
              value={filters.keyword}
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid>
          <MetricCard icon={<TeamOutlined />} label="薪酬人数" value={overview.summary.employeeCount} />
          <MetricCard icon={<FileSearchOutlined />} label="薪酬明细" value={overview.summary.recordCount} />
          <MetricCard icon={<WalletOutlined />} label="应发合计" value={formatSalaryMoney(overview.summary.grossSalary)} />
          <MetricCard icon={<CalculatorOutlined />} label="人均应发" value={formatSalaryMoney(overview.summary.averageGrossSalary)} />
          <MetricCard icon={<WalletOutlined />} label="扣减合计" value={formatSalaryMoney(overview.summary.deductionAmount)} />
          <MetricCard icon={<CalculatorOutlined />} label="人均扣减" value={formatSalaryMoney(overview.summary.averageDeductionAmount)} />
          <MetricCard icon={<CheckCircleOutlined />} label="实发合计" value={formatSalaryMoney(overview.summary.netSalary)} />
          <MetricCard icon={<CheckCircleOutlined />} label="人均实发" value={formatSalaryMoney(overview.summary.averageNetSalary)} />
        </MetricGrid>
      }
      pageId="salary-overview"
    >
      <div className="salary-overview-table-grid">
        <ManagementTable
          columns={salaryOverviewBoardColumns}
          count={{ unit: '项', value: overview.boardRows.length }}
          dataSource={overview.boardRows}
          rowKey="id"
          rowTestIdPrefix="salary-overview-board-row"
          scrollX={560}
          scrollY={salaryOverviewTableScrollY}
          tableTestId="salary-overview-board-table"
          title="板块汇总"
        />

        <ManagementTable
          columns={salaryOverviewEmployeeColumns}
          count={{ unit: '人', value: overview.employeeRows.length }}
          dataSource={overview.employeeRows}
          rowKey="id"
          rowTestIdPrefix="salary-overview-employee-row"
          scrollX={460}
          scrollY={salaryOverviewTableScrollY}
          tableTestId="salary-overview-employee-table"
          title="员工薪酬排序"
        />
      </div>
    </ManagementPageScaffold>
  );
}
