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
import { useFinanceManagement } from '../finance/FinanceManagementState';
import {
  createSalaryAdjustmentForm,
  createSalaryAdjustmentFormFromRecord,
  defaultSalaryMonthlyFilters,
  getSalaryMonthlyAccountingPeriod,
  salaryDetailDefaultMonth,
  setSalaryAdjustmentFormMonth,
  type SalaryAdjustmentFormValue,
  type SalaryMonthlyFilters
} from './salaryMonthlyDisplayModel';
import {
  buildSalaryMonthlyReportId,
  formatSalaryMoney,
  type SalaryAdjustmentRecord,
  type SalaryMonthlyReport,
  type SalaryPaymentEvidenceInput
} from './salaryDomain';
import { SalaryAdjustmentCreateDrawer } from './SalaryAdjustmentCreateDrawer';
import { salaryMonthlyColumns } from './SalaryMonthlyColumns';
import { SalaryMonthlyDetailDrawer } from './SalaryMonthlyDetailDrawer';
import { SalaryPaymentConfirmDrawer } from './SalaryPaymentConfirmDrawer';
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
  const { financeRows, getAccountingPeriodGuard } = useFinanceManagement();
  const { getSalaryMonthlyReports, salaryReportMonths, salaryState } = useSalaryMonthlyReportBuilder();
  const [filters, setFilters] = useState<SalaryMonthlyFilters>(defaultSalaryMonthlyFilters);
  const [activeReportId, setActiveReportId] = useState<string>();
  const [paymentReportId, setPaymentReportId] = useState<string>();
  const adjustmentDrawer = useDrawerFormState<SalaryAdjustmentRecord, SalaryAdjustmentFormValue>({
    createForm: () => createSalaryAdjustmentForm(getSalaryAdjustmentDefaultMonth(filters.salaryTime)),
    editForm: createSalaryAdjustmentFormFromRecord
  });
  const salaryRange = useMemo(() => getDateScopeRange(filters.salaryTime, salaryDetailDefaultMonth), [filters.salaryTime]);
  const reportMonths = useMemo(
    () =>
      getSalaryReportMonths({
        salaryDetailMonths: salaryReportMonths,
        salaryRange,
        salaryTime: filters.salaryTime
      }),
    [filters.salaryTime, salaryRange, salaryReportMonths]
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
  const paymentReport = reports.find((report) => report.id === paymentReportId);
  const paymentCandidates = useMemo<SalaryPaymentEvidenceInput[]>(() => {
    if (!paymentReport?.workflow?.payrollNo) {
      return [];
    }

    const usedTransactionNos = new Set(
      salaryState.salaryPaymentRecords
        .map((record) => record.financeTransactionNo)
        .filter((transactionNo): transactionNo is string => Boolean(transactionNo))
    );

    return financeRows
      .filter(
        (row) =>
          row.sourceType === '薪酬发放' &&
          row.status === '已入账' &&
          row.sourceNo === paymentReport.workflow?.payrollNo &&
          !usedTransactionNos.has(row.transactionNo)
      )
      .map((row) => ({
        accountName: row.publicAccountSnapshot?.displayName ?? '-',
        amount: row.amount,
        financeTransactionNo: row.transactionNo,
        occurredAt: row.occurredAt,
        payrollNo: row.sourceNo,
        status: '已入账' as const
      }))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }, [financeRows, paymentReport, salaryState.salaryPaymentRecords]);
  const activeReportPeriodGuard = activeReport?.canConfirm
    ? getAccountingPeriodGuard(getSalaryMonthlyAccountingPeriod(activeReport.month), '处理薪酬明细')
    : undefined;
  const adjustmentPeriodGuard = adjustmentDrawer.open
    ? getAccountingPeriodGuard(getSalaryMonthlyAccountingPeriod(adjustmentDrawer.form.month), '保存薪酬调整')
    : undefined;
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
      paid: filteredReports.filter((report) => report.status === '已发放').length,
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

  function guardSalaryMonthlyMutation(month: string, actionLabel: string) {
    const periodGuard = getAccountingPeriodGuard(getSalaryMonthlyAccountingPeriod(month), actionLabel);

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return false;
    }

    return true;
  }

  function handleConfirm(report: SalaryMonthlyReport) {
    if (!guardSalaryMonthlyMutation(report.month, '确认薪酬明细')) {
      return;
    }

    const result = salaryState.confirmSalaryMonthlyReport(report);

    if (!result.success) {
      void messageApi.warning(result.reason ?? '薪酬明细确认失败');
      return;
    }

    setActiveReportId(report.id);
    void messageApi.success('薪酬明细已确认');
  }

  function openPaymentDrawer(report: SalaryMonthlyReport) {
    setPaymentReportId(report.id);
  }

  function handlePay(report: SalaryMonthlyReport, evidence: SalaryPaymentEvidenceInput) {
    if (!guardSalaryMonthlyMutation(evidence.occurredAt.slice(0, 7), '确认工资发放')) {
      return;
    }

    const result = salaryState.markSalaryMonthlyPaid(report, evidence);

    if (!result.success) {
      void messageApi.warning(result.reason ?? '工资发放事实核验失败');
      return;
    }

    setPaymentReportId(undefined);
    setActiveReportId(report.id);
    void messageApi.success('工资发放事实已记录，个税按实际发放月份冻结');
  }

  function handleRecalculatePayment(report: SalaryMonthlyReport, paymentDate: string) {
    if (!guardSalaryMonthlyMutation(paymentDate.slice(0, 7), '重新核定工资发放')) {
      return;
    }

    const result = salaryState.recalculateSalaryMonthlyPayment(report, paymentDate);

    if (!result.success) {
      void messageApi.warning(result.reason ?? '薪酬重新核定失败');
      return;
    }

    void messageApi.success(`已按 ${result.personalIncomeTaxPeriod} 个税月份重新核定`);
  }

  function handleSaveAdjustment(record: SalaryAdjustmentRecord) {
    if (!guardSalaryMonthlyMutation(record.month, '保存薪酬调整')) {
      return;
    }

    const saved = salaryState.saveSalaryAdjustment(record);

    if (!saved) {
      void messageApi.warning('工资已发放，不能再调整');
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
                options={['全部', '结算中', '待确认', '已确认', '已发放'].map((status) => ({
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
          <MetricCard icon={<WalletOutlined />} label="已发放" value={metrics.paid} />
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
        periodReadbackNotice={activeReportPeriodGuard?.allowed === false ? activeReportPeriodGuard.reason : undefined}
        report={activeReport}
        onClose={() => setActiveReportId(undefined)}
        onConfirm={handleConfirm}
        onOpenPayment={openPaymentDrawer}
      />

      <SalaryPaymentConfirmDrawer
        open={Boolean(paymentReport)}
        paymentCandidates={paymentCandidates}
        report={paymentReport}
        onCancel={() => setPaymentReportId(undefined)}
        onConfirm={handlePay}
        onRecalculate={handleRecalculatePayment}
      />

      <SalaryAdjustmentCreateDrawer
        form={adjustmentDrawer.form}
        getReportsForMonth={getSalaryMonthlyReports}
        open={adjustmentDrawer.open}
        periodReadbackNotice={adjustmentPeriodGuard?.allowed === false ? adjustmentPeriodGuard.reason : undefined}
        onCancel={adjustmentDrawer.cancel}
        onChange={adjustmentDrawer.updateForm}
        onMonthChange={handleChangeAdjustmentMonth}
        onSave={handleSaveAdjustment}
      />
    </ManagementPageScaffold>
  );
}
