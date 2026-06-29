import {
  CheckCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Select, message } from 'antd';
import { useMemo, useState } from 'react';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateRangeFilterValue,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { useDrawerFormState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import {
  createSalaryAdjustmentForm,
  createSalaryAdjustmentFormFromRecord,
  defaultSalaryMonthlyFilters,
  salaryDetailDefaultMonth,
  setSalaryAdjustmentFormMonth,
  type SalaryAdjustmentFormValue,
  type SalaryMonthlyFilters
} from './salaryMonthlyDisplayModel';
import {
  buildSalaryMonthlyReportId,
  formatSalaryMoney,
  type SalaryAdjustmentRecord,
  type SalaryMonthlyReport
} from './salaryDomain';
import { SalaryAdjustmentCreateDrawer } from './SalaryAdjustmentCreateDrawer';
import { salaryMonthlyColumns } from './SalaryMonthlyColumns';
import { SalaryMonthlyDetailDrawer } from './SalaryMonthlyDetailDrawer';
import { useSalaryMonthlyReportBuilder } from './salaryReportBuilder';

const salaryDetailDefaultMonthRange = getDateScopeMonthRange(salaryDetailDefaultMonth);

function isSalaryMonthInRange(month: string, range?: DateRangeFilterValue) {
  if (!range) {
    return true;
  }

  const monthRange = getDateScopeMonthRange(month);

  return monthRange.startDate <= range.endDate && monthRange.endDate >= range.startDate;
}

function getSingleSalaryMonthFromScope(salaryTime: DateScopeFilterValue) {
  if (salaryTime.mode === 'currentMonth') {
    return salaryDetailDefaultMonth;
  }

  if (salaryTime.mode === 'month') {
    return salaryTime.month;
  }

  return undefined;
}

function getSalaryAdjustmentDefaultMonth(salaryTime: DateScopeFilterValue) {
  return getSingleSalaryMonthFromScope(salaryTime) ?? salaryDetailDefaultMonth;
}

function getSalaryReportMonths({
  salaryDetailMonths,
  salaryRange,
  salaryTime
}: {
  salaryDetailMonths: string[];
  salaryRange?: DateRangeFilterValue;
  salaryTime: DateScopeFilterValue;
}) {
  const singleMonth = getSingleSalaryMonthFromScope(salaryTime);

  if (singleMonth) {
    return [singleMonth];
  }

  return salaryDetailMonths
    .filter((month) => isSalaryMonthInRange(month, salaryRange))
    .sort((left, right) => right.localeCompare(left));
}

export function SalaryMonthlyPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { getSalaryMonthlyReports, salaryState } = useSalaryMonthlyReportBuilder();
  const [filters, setFilters] = useState<SalaryMonthlyFilters>(defaultSalaryMonthlyFilters);
  const [activeReportId, setActiveReportId] = useState<string>();
  const adjustmentDrawer = useDrawerFormState<SalaryAdjustmentRecord, SalaryAdjustmentFormValue>({
    createForm: () => createSalaryAdjustmentForm(getSalaryAdjustmentDefaultMonth(filters.salaryTime)),
    editForm: createSalaryAdjustmentFormFromRecord
  });
  const salaryRange = useMemo(() => getDateScopeRange(filters.salaryTime, salaryDetailDefaultMonth), [filters.salaryTime]);
  const reportMonths = useMemo(
    () =>
      getSalaryReportMonths({
        salaryDetailMonths: salaryState.salaryDetailMonths,
        salaryRange,
        salaryTime: filters.salaryTime
      }),
    [filters.salaryTime, salaryRange, salaryState.salaryDetailMonths]
  );
  const reports = useMemo(
    () =>
      reportMonths
        .flatMap((month) => getSalaryMonthlyReports(month))
        .sort(
          (left, right) =>
            right.month.localeCompare(left.month) ||
            left.member.id.localeCompare(right.member.id)
        ),
    [getSalaryMonthlyReports, reportMonths]
  );
  const activeReport = reports.find((report) => report.id === activeReportId);
  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const keyword = filters.keyword.trim().toLowerCase();
        const searchableText = `${report.member.name} ${report.member.id} ${report.member.position} ${report.status}`.toLowerCase();

        if (filters.status !== '全部' && report.status !== filters.status) {
          return false;
        }

        return !keyword || searchableText.includes(keyword);
      }),
    [filters.keyword, filters.status, reports]
  );
  const metrics = useMemo(
    () => ({
      deductionAmount: filteredReports.reduce((total, report) => total + report.deductionAmount, 0),
      employeeCount: new Set(filteredReports.map((report) => report.member.id)).size,
      grossSalary: filteredReports.reduce((total, report) => total + report.grossSalary, 0),
      netSalary: filteredReports.reduce((total, report) => total + report.netSalary, 0),
      processing: filteredReports.filter((report) => report.status === '结算中').length,
      readyToConfirm: filteredReports.filter((report) => report.status === '待确认').length,
      settled: filteredReports.filter((report) => report.status === '已结算').length,
      total: filteredReports.length
    }),
    [filteredReports]
  );

  function updateFilter<K extends keyof SalaryMonthlyFilters>(key: K, value: SalaryMonthlyFilters[K]) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value
    }));
  }

  function openAdjustmentDrawer() {
    adjustmentDrawer.openCreate();
  }

  function handleChangeAdjustmentMonth(month: string) {
    adjustmentDrawer.setForm((currentForm) => setSalaryAdjustmentFormMonth(currentForm, month));
  }

  function handleConfirm(report: SalaryMonthlyReport) {
    salaryState.confirmSalaryMonthlyReport(report.member.id, report.month);
    setActiveReportId(report.id);
    void messageApi.success('薪酬明细已确认');
  }

  function handleSettle(report: SalaryMonthlyReport) {
    salaryState.settleSalaryMonthlyReport(report.member.id, report.month);
    setActiveReportId(report.id);
    void messageApi.success('薪酬明细已结算，相关考勤月报已锁定');
  }

  function handleSaveAdjustment(record: SalaryAdjustmentRecord) {
    const saved = salaryState.saveSalaryAdjustment(record);

    if (!saved) {
      void messageApi.warning('工资已结算，不能再调整');
      return;
    }

    adjustmentDrawer.close();
    setFilters((currentFilters) => ({ ...currentFilters, salaryTime: { mode: 'month', month: record.month } }));
    setActiveReportId(buildSalaryMonthlyReportId(record.month, record.memberId));
    void messageApi.success('薪酬调整已保存');
  }

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={salaryDetailDefaultMonth}
              defaultRange={salaryDetailDefaultMonthRange}
              label="薪酬月份"
              testIdPrefix="salary-detail-time-filter"
              value={filters.salaryTime}
              onChange={(salaryTime) => {
                updateFilter('salaryTime', salaryTime);
                setActiveReportId(undefined);
              }}
            />
            <FilterField label="状态" controlWidth="status-select">
              <Select
                value={filters.status}
                options={['全部', '结算中', '待确认', '已确认', '已结算'].map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status) => updateFilter('status', status)}
              />
            </FilterField>
            <KeywordFilter
              placeholder="姓名 / 工号 / 岗位"
              value={filters.keyword}
              onChange={(keyword) => updateFilter('keyword', keyword)}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid>
          <MetricCard icon={<FileTextOutlined />} label="薪酬明细" value={metrics.total} />
          <MetricCard icon={<FileSearchOutlined />} label="涉及员工" value={metrics.employeeCount} />
          <MetricCard icon={<ReloadOutlined />} label="结算中" value={metrics.processing} />
          <MetricCard icon={<CheckCircleOutlined />} label="待确认" value={metrics.readyToConfirm} />
          <MetricCard icon={<WalletOutlined />} label="已结算" value={metrics.settled} />
          <MetricCard icon={<WalletOutlined />} label="应发合计" value={formatSalaryMoney(metrics.grossSalary)} />
          <MetricCard icon={<FileSearchOutlined />} label="扣减合计" value={formatSalaryMoney(metrics.deductionAmount)} />
          <MetricCard icon={<CheckCircleOutlined />} label="实发合计" value={formatSalaryMoney(metrics.netSalary)} />
        </MetricGrid>
      }
    >
      {contextHolder}
      <ManagementTable<SalaryMonthlyReport>
        columns={salaryMonthlyColumns}
        count={{ unit: '条', value: filteredReports.length }}
        dataSource={filteredReports}
        primaryAction={{
          icon: <PlusOutlined />,
          label: '新增薪酬调整',
          testId: 'salary-monthly-adjustment-create',
          onClick: openAdjustmentDrawer
        }}
        rowKey="id"
        rowTestIdPrefix="salary-monthly-row"
        tableTestId="salary-monthly-table"
        onRowClick={(report) => setActiveReportId(report.id)}
      />

      <SalaryMonthlyDetailDrawer
        open={Boolean(activeReport)}
        report={activeReport}
        onClose={() => setActiveReportId(undefined)}
        onConfirm={handleConfirm}
        onSettle={handleSettle}
      />

      <SalaryAdjustmentCreateDrawer
        form={adjustmentDrawer.form}
        getReportsForMonth={getSalaryMonthlyReports}
        open={adjustmentDrawer.open}
        onCancel={adjustmentDrawer.cancel}
        onChange={adjustmentDrawer.updateForm}
        onMonthChange={handleChangeAdjustmentMonth}
        onSave={handleSaveAdjustment}
      />
    </ManagementPageScaffold>
  );
}
