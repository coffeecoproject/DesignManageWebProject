import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Input, InputNumber, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { MonthFilterField, MonthPickerControl } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useDrawerFormState } from '../../components/DrawerForm';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import { formatAttendanceDuration } from './peopleAttendanceDisplayModel';
import {
  adjustmentDirectionTone,
  adjustmentTypeOptions,
  attendanceMonthlyStatusOptions,
  buildAttendanceMonthlyAdjustmentRecord,
  createAttendanceMonthlyAdjustmentForm,
  createAttendanceMonthlyAdjustmentFormFromRecord,
  defaultAttendanceMonthlyFilters,
  exceptionTypeTone,
  filterAttendanceMonthlyReports,
  formatDays,
  formatPayrollTime,
  formatSignedHours,
  getAdjustmentSignedText,
  getAttendanceMonthlyAdjustmentDirection,
  getAttendanceMonthlyAdjustmentMemberOptions,
  getAttendanceMonthlyAdjustmentSelectedReport,
  getAttendanceMonthlyMetrics,
  isAttendanceMonthlyAdjustmentFormValid,
  reportStatusTone,
  resolveAttendanceMonthlyFormMonth,
  setAttendanceMonthlyAdjustmentFormMonth,
  type AttendanceMonthlyAdjustmentFormValue,
  type MonthlyReportFilters
} from './peopleAttendanceMonthlyDisplayModel';
import {
  buildAttendanceMonthlyReports,
  getAttendanceMonthRange,
  type AttendanceMonthlyAdjustmentRecord,
  type AttendanceMonthlyReport
} from './peopleAttendanceMonthlyDomain';
import {
  peopleAttendanceToday,
  type PeopleAttendanceRecord,
  usePeopleOrganizationState
} from './PeopleOrganizationState';

function PersonCell({ report }: { report: AttendanceMonthlyReport }) {
  return <CompactCell primary={report.member.name} secondary={report.member.position} />;
}

function MonthlyReportDetailDrawer({
  open,
  report,
  onClose,
  onConfirm
}: {
  open: boolean;
  report?: AttendanceMonthlyReport;
  onClose: () => void;
  onConfirm: (report: AttendanceMonthlyReport) => void;
}) {
  if (!report) {
    return null;
  }

  const exceptionColumns: TableColumnsType<PeopleAttendanceRecord> = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (type: PeopleAttendanceRecord['type']) => <StatusTag toneMap={exceptionTypeTone} value={type} />
    },
    {
      title: '时间范围',
      key: 'timeRange',
      width: 250,
      render: (_, record) => <CompactCell primary={record.startAt} secondary={`至 ${record.endAt}`} />
    },
    {
      title: '时长',
      dataIndex: 'durationHours',
      width: 90,
      render: (hours: number) => <CellText>{formatAttendanceDuration(hours)}</CellText>
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 220
    },
    {
      title: '来源',
      key: 'source',
      width: 140,
      render: (_, record) => <CompactCell primary={record.mode} secondary={record.recorder} />
    }
  ];

  const adjustmentColumns: TableColumnsType<AttendanceMonthlyAdjustmentRecord> = [
    {
      title: '方向',
      dataIndex: 'direction',
      width: 88,
      render: (direction: AttendanceMonthlyAdjustmentRecord['direction']) => <StatusTag toneMap={adjustmentDirectionTone} value={direction} />
    },
    {
      title: '调整',
      key: 'days',
      width: 110,
      render: (_, record) => <CellText>{getAdjustmentSignedText(record)}</CellText>
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 260
    },
    {
      title: '记录人',
      key: 'actor',
      width: 150,
      render: (_, record) => <CompactCell primary={record.actor} secondary={record.createdAt} />
    }
  ];

  return (
    <DetailDrawerShell
      bodyTestId="people-attendance-monthly-detail"
      className="people-attendance-monthly-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={open}
      primaryAction={{
        disabled: report.status === '已确认' || !report.canAdjust,
        icon: <CheckCircleOutlined />,
        label: '确认月报',
        onClick: () => onConfirm(report)
      }}
      title={
        <DetailDrawerTitle
          status={report.status}
          statusToneMap={reportStatusTone}
          subtitle="人员组织 / 考勤月报"
          title={`${report.member.name} ${report.month} 考勤月报`}
        />
      }
      width={880}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <CalendarOutlined />, key: 'expected', label: '应出勤', value: formatDays(report.expectedWorkdays) },
          { icon: <ClockCircleOutlined />, key: 'deduction', label: '考勤扣减', value: formatPayrollTime(report.payrollDeductionDays, report.payrollDeductionHours) },
          { icon: <PlusOutlined />, key: 'restUncovered', label: '未覆盖调休', value: formatPayrollTime(report.restUncoveredDays, report.restUncoveredHours) },
          { icon: <CheckCircleOutlined />, key: 'payable', label: '计薪出勤', value: formatPayrollTime(report.payableAttendanceDays, report.payableAttendanceHours) }
        ]}
      />
      <DetailTabs
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <DetailSection icon={<FileTextOutlined />} title="月报结果">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '月份', value: report.month },
                    { label: '人员', value: report.member.name },
                    { label: '员工工号', value: report.member.id },
                    { label: '岗位', value: report.member.position },
                    { label: '适用工作日历', value: report.workCalendarName },
                    { label: '状态', value: <StatusTag toneMap={reportStatusTone} value={report.status} /> },
                    { label: '应出勤', value: formatDays(report.expectedWorkdays) },
                    { label: '请假记录', value: formatPayrollTime(report.recordedLeaveDays ?? report.leaveDays, report.recordedLeaveHours ?? report.leaveHours) },
                    { label: '有效请假', value: formatPayrollTime(report.leaveDays, report.leaveHours) },
                    { label: '调休', value: formatPayrollTime(report.restDays, report.restHours) },
                    { label: '补班', value: formatPayrollTime(report.makeupWorkDays, report.makeupWorkHours) },
                    { label: '调休已覆盖', value: formatPayrollTime(report.restCoveredDays, report.restCoveredHours) },
                    { label: '未覆盖调休', value: formatPayrollTime(report.restUncoveredDays, report.restUncoveredHours) },
                    { label: '调休余额', value: formatPayrollTime(report.restBalanceDays, report.restBalanceHours) },
                    { label: '考勤扣减', value: formatPayrollTime(report.payrollDeductionDays, report.payrollDeductionHours) },
                    { label: '人工调整', value: formatSignedHours(report.adjustmentHours) },
                    { label: '计薪出勤', value: formatPayrollTime(report.payableAttendanceDays, report.payableAttendanceHours) },
                    ...(report.confirmation
                      ? [
                          { label: '确认人', value: report.confirmation.actor },
                          { label: '确认时间', value: report.confirmation.confirmedAt },
                          { label: '确认说明', value: report.confirmation.note, wide: true }
                        ]
                      : [])
                  ]}
                />
              </DetailSection>
            )
          },
          {
            key: 'exceptions',
            label: '例外明细',
            children: (
              <DetailSection icon={<CalendarOutlined />} title="来自考勤假勤">
                <CompactDetailTable<PeopleAttendanceRecord>
                  columns={exceptionColumns}
                  dataSource={report.relatedExceptions}
                  emptyText="暂无例外记录"
                  rowKey="id"
                  scrollX={860}
                />
              </DetailSection>
            )
          },
          {
            key: 'adjustments',
            label: '调整记录',
            children: (
              <DetailSection icon={<EditOutlined />} title="薪酬考勤调整">
                <CompactDetailTable<AttendanceMonthlyAdjustmentRecord>
                  columns={adjustmentColumns}
                  dataSource={report.relatedAdjustments}
                  emptyText="暂无调整记录"
                  rowKey="id"
                  scrollX={760}
                />
              </DetailSection>
            )
          },
          {
            key: 'calculation',
            label: '计算说明',
            children: (
              <DetailSection icon={<ClockCircleOutlined />} title="计算口径">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { label: '月份范围', value: `${getAttendanceMonthRange(report.month).startDateText} 至 ${getAttendanceMonthRange(report.month).endDateText}` },
                    { label: '默认规则', value: '有效全职人员按适用工作日历默认全勤' },
                    { label: '请假', value: '仅工作日内的请假时长计入薪酬考勤扣减' },
                    { label: '补班', value: '仅休息日补班产生调休额度，不自动增加薪酬' },
                    { label: '调休', value: '仅工作日调休参与抵扣；额度不足部分计入考勤扣减' },
                    { label: '临时不可用', value: '作为例外列示，默认不扣减计薪出勤' },
                    { label: '人工调整', value: '只影响薪酬考勤口径，不回写考勤假勤', wide: true }
                  ]}
                />
              </DetailSection>
            )
          }
        ]}
        tabTestIdPrefix="people-attendance-monthly-detail-tab"
        testId="people-attendance-monthly-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

function AttendanceMonthlyAdjustmentForm({
  form,
  reports,
  selectedReport,
  onChange,
  onMonthChange
}: {
  form: AttendanceMonthlyAdjustmentFormValue;
  reports: AttendanceMonthlyReport[];
  selectedReport?: AttendanceMonthlyReport;
  onChange: <K extends keyof AttendanceMonthlyAdjustmentFormValue>(field: K, value: AttendanceMonthlyAdjustmentFormValue[K]) => void;
  onMonthChange: (month: string) => void;
}) {
  const direction = getAttendanceMonthlyAdjustmentDirection(form);
  const memberOptions = getAttendanceMonthlyAdjustmentMemberOptions(reports);
  const adjustmentDisabled = !selectedReport || !selectedReport.canAdjust;

  function handleMonthChange(month: string) {
    onMonthChange(resolveAttendanceMonthlyFormMonth(month, form.month || defaultAttendanceMonthlyFilters.month));
  }

  return (
    <>
      <DetailSection icon={<CalendarOutlined />} title="调整对象">
        <DrawerFormGrid>
          <DrawerFormField required label="月份">
            <MonthPickerControl
              allowClear={false}
              testId="people-attendance-monthly-adjustment-month"
              value={form.month ? dayjs(form.month) : undefined}
              onChange={handleMonthChange}
            />
          </DrawerFormField>
          <DrawerFormField required label="人员">
            <Select
              optionFilterProp="label"
              options={memberOptions}
              placeholder="选择人员"
              showSearch
              value={form.memberId}
              onChange={(memberId) => onChange('memberId', memberId)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>

      {selectedReport ? (
        <DetailSection icon={<FileTextOutlined />} title="月报摘要">
          <DrawerFormGrid>
            <ReadOnlyField label="人员" value={`${selectedReport.member.name} / ${selectedReport.member.id}`} />
            <ReadOnlyField label="岗位" value={selectedReport.member.position} />
            <ReadOnlyField label="月报状态" value={<StatusTag toneMap={reportStatusTone} value={selectedReport.status} />} />
            <ReadOnlyField label="应出勤" value={formatDays(selectedReport.expectedWorkdays)} />
            <ReadOnlyField label="当前计薪出勤" value={formatPayrollTime(selectedReport.payableAttendanceDays, selectedReport.payableAttendanceHours)} />
          </DrawerFormGrid>
        </DetailSection>
      ) : null}

      <DetailSection icon={<EditOutlined />} title="调整信息">
        <DrawerFormGrid>
          <DrawerFormField required label="调整类型">
            <Select
              disabled={adjustmentDisabled}
              value={form.type}
              options={adjustmentTypeOptions.map((option) => ({
                label: option,
                value: option
              }))}
              onChange={(type) => onChange('type', type)}
            />
          </DrawerFormField>
          <DrawerFormField required label="调整时长">
            <InputNumber
              disabled={adjustmentDisabled || direction === '备注'}
              min={0.5}
              precision={1}
              step={0.5}
              value={direction === '备注' ? 0 : form.hours}
              onChange={(hours) => onChange('hours', hours)}
            />
          </DrawerFormField>
          <ReadOnlyField label="调整方向" value={<StatusTag toneMap={adjustmentDirectionTone} value={direction} />} />
          <DrawerFormField required wide label="原因">
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              disabled={adjustmentDisabled}
              placeholder="请输入薪酬考勤调整原因"
              value={form.reason}
              onChange={(event) => onChange('reason', event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
    </>
  );
}

function MonthlyAdjustmentDrawer({
  form,
  getReportsForMonth,
  open,
  onCancel,
  onChange,
  onMonthChange,
  onSave
}: {
  form: AttendanceMonthlyAdjustmentFormValue;
  getReportsForMonth: (month: string) => AttendanceMonthlyReport[];
  open: boolean;
  onCancel: () => void;
  onChange: <K extends keyof AttendanceMonthlyAdjustmentFormValue>(field: K, value: AttendanceMonthlyAdjustmentFormValue[K]) => void;
  onMonthChange: (month: string) => void;
  onSave: (record: AttendanceMonthlyAdjustmentRecord) => void;
}) {
  const reports = useMemo(() => getReportsForMonth(form.month), [form.month, getReportsForMonth]);
  const selectedReport = getAttendanceMonthlyAdjustmentSelectedReport(reports, form);
  const saveDisabled = !isAttendanceMonthlyAdjustmentFormValid(form, selectedReport);

  function handleSave() {
    if (!selectedReport || saveDisabled) {
      return;
    }

    onSave(buildAttendanceMonthlyAdjustmentRecord({
      actor: '李明',
      createdAt: `${peopleAttendanceToday} 10:45`,
      form,
      selectedReport
    }));
  }

  return (
    <DrawerFormShell
      bodyTestId="people-attendance-monthly-adjustment"
      cancelAction={{ label: '取消', onClick: onCancel }}
      className="people-attendance-monthly-adjustment-drawer"
      layout="detail"
      open={open}
      primaryAction={{
        disabled: saveDisabled,
        icon: <CheckCircleOutlined />,
        label: '保存调整',
        testId: 'people-attendance-monthly-adjustment-save',
        onClick: handleSave
      }}
      title={<DetailDrawerTitle subtitle="人员组织 / 考勤月报" title="新增薪酬考勤调整" />}
      width={620}
      onClose={onCancel}
    >
      <AttendanceMonthlyAdjustmentForm
        form={form}
        reports={reports}
        selectedReport={selectedReport}
        onChange={onChange}
        onMonthChange={onMonthChange}
      />
    </DrawerFormShell>
  );
}

export function PeopleAttendanceMonthlyPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    attendanceMonthlyAdjustments,
    attendanceMonthlyConfirmations,
    attendanceMonthlySalarySettlements,
    attendanceRecords,
    confirmAttendanceMonthlyReport,
    peopleRows,
    saveAttendanceMonthlyAdjustment
  } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const [filters, setFilters] = useState<MonthlyReportFilters>(defaultAttendanceMonthlyFilters);
  const [activeReportId, setActiveReportId] = useState<string>();
  const adjustmentDrawer = useDrawerFormState<AttendanceMonthlyAdjustmentRecord, AttendanceMonthlyAdjustmentFormValue>({
    createForm: () => createAttendanceMonthlyAdjustmentForm(filters.month),
    editForm: createAttendanceMonthlyAdjustmentFormFromRecord
  });
  const getReportsForMonth = useCallback(
    (month: string) =>
      buildAttendanceMonthlyReports({
        adjustments: attendanceMonthlyAdjustments,
        annualExceptionRows,
        attendanceRecords,
        confirmations: attendanceMonthlyConfirmations,
        month,
        peopleRows,
        salarySettlements: attendanceMonthlySalarySettlements,
        workCalendarRows
      }),
    [
      annualExceptionRows,
      attendanceMonthlyAdjustments,
      attendanceMonthlyConfirmations,
      attendanceMonthlySalarySettlements,
      attendanceRecords,
      peopleRows,
      workCalendarRows
    ]
  );
  const reports = useMemo(() => getReportsForMonth(filters.month), [filters.month, getReportsForMonth]);
  const activeReport = reports.find((report) => report.id === activeReportId);
  const filteredReports = useMemo(
    () => filterAttendanceMonthlyReports(reports, filters),
    [filters, reports]
  );
  const metrics = useMemo(() => getAttendanceMonthlyMetrics(reports), [reports]);

  function updateFilter<K extends keyof MonthlyReportFilters>(key: K, value: MonthlyReportFilters[K]) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value
    }));
  }

  function openAdjustmentDrawer() {
    adjustmentDrawer.openCreate();
  }

  function handleChangeAdjustmentMonth(month: string) {
    adjustmentDrawer.setForm((currentForm) => setAttendanceMonthlyAdjustmentFormMonth(currentForm, month));
  }

  function handleSaveAdjustment(record: AttendanceMonthlyAdjustmentRecord) {
    const result = saveAttendanceMonthlyAdjustment(record);

    if (!result.success) {
      void messageApi.warning(result.reason ?? '薪酬考勤调整未保存');
      return;
    }

    setFilters((currentFilters) => ({
      ...currentFilters,
      keyword: '',
      month: record.month,
      status: '全部'
    }));
    setActiveReportId(`${record.month}-${record.memberId}`);
    adjustmentDrawer.close();
    const salaryNote = result.invalidatedSalaryMonths.length > 0 ? '，薪酬需重新核定' : '';
    void messageApi.success(`薪酬考勤调整已保存${salaryNote}`);
  }

  function handleConfirm(report: AttendanceMonthlyReport) {
    if (!report.canAdjust) {
      void messageApi.warning('当前月报已锁定，不能再确认或调整');
      return;
    }

    confirmAttendanceMonthlyReport(report);
    setActiveReportId(report.id);
    void messageApi.success('考勤月报已确认');
  }

  const columns: TableColumnsType<AttendanceMonthlyReport> = [
    {
      title: '员工工号',
      key: 'employeeId',
      width: 118,
      render: (_, report) => <CellText>{report.member.id}</CellText>
    },
    {
      title: '人员',
      key: 'person',
      width: 150,
      render: (_, report) => <PersonCell report={report} />
    },
    {
      title: '月份',
      dataIndex: 'month',
      width: 96
    },
    {
      title: '应出勤',
      dataIndex: 'expectedWorkdays',
      width: 94,
      render: (days: number) => <CellText>{formatDays(days)}</CellText>
    },
    {
      title: '请假',
      key: 'leave',
      width: 128,
      render: (_, report) => <CellText>{formatPayrollTime(report.leaveDays, report.leaveHours)}</CellText>
    },
    {
      title: '调休',
      key: 'rest',
      width: 128,
      render: (_, report) => <CellText>{formatPayrollTime(report.restDays, report.restHours)}</CellText>
    },
    {
      title: '未覆盖调休',
      key: 'restUncovered',
      width: 128,
      render: (_, report) => <CellText>{formatPayrollTime(report.restUncoveredDays, report.restUncoveredHours)}</CellText>
    },
    {
      title: '补班',
      key: 'makeupWork',
      width: 128,
      render: (_, report) => <CellText>{formatPayrollTime(report.makeupWorkDays, report.makeupWorkHours)}</CellText>
    },
    {
      title: '临时不可用',
      key: 'temporaryUnavailable',
      width: 138,
      render: (_, report) => <CellText>{formatPayrollTime(report.temporaryUnavailableDays, report.temporaryUnavailableHours)}</CellText>
    },
    {
      title: '人工调整',
      dataIndex: 'adjustmentHours',
      width: 108,
      render: (hours: number) => <CellText>{formatSignedHours(hours)}</CellText>
    },
    {
      title: '计薪出勤',
      key: 'payableAttendance',
      width: 136,
      render: (_, report) => <CellText>{formatPayrollTime(report.payableAttendanceDays, report.payableAttendanceHours)}</CellText>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: AttendanceMonthlyReport['status']) => <StatusTag toneMap={reportStatusTone} value={status} />
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      filters={
        <FilterPanel>
          <FilterBar>
            <MonthFilterField
              allowClear={false}
              label="月份"
              placeholder="选择月份"
              testId="people-attendance-monthly-month-filter"
              value={filters.month}
              onChange={(month) => {
                updateFilter('month', month || defaultAttendanceMonthlyFilters.month);
                setActiveReportId(undefined);
              }}
            />
            <FilterField label="状态" controlWidth="status-select">
              <Select
                value={filters.status}
                options={attendanceMonthlyStatusOptions.map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(value) => updateFilter('status', value)}
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
          <MetricCard icon={<FileTextOutlined />} label="月报人员" value={metrics.total} />
          <MetricCard icon={<CalendarOutlined />} label="应出勤" value={formatDays(metrics.expectedWorkdays)} />
          <MetricCard icon={<ClockCircleOutlined />} label="计薪出勤" value={formatDays(metrics.payableAttendanceDays)} />
          <MetricCard icon={<ClockCircleOutlined />} label="未覆盖调休" value={formatDays(metrics.restUncoveredDays)} />
          <MetricCard icon={<EditOutlined />} label="调整记录" value={metrics.adjustmentCount} />
          <MetricCard icon={<CheckCircleOutlined />} label="已确认" value={`${metrics.confirmed}/${metrics.total}`} />
          <MetricCard icon={<FileTextOutlined />} label="待确认" value={metrics.total - metrics.confirmed} />
        </MetricGrid>
      }
    >
      {contextHolder}
      <ManagementTable<AttendanceMonthlyReport>
        columns={columns}
        count={{ unit: '人', value: filteredReports.length }}
        dataSource={filteredReports}
        primaryAction={{ icon: <PlusOutlined />, label: '新增调整', testId: 'people-attendance-monthly-adjustment-create', onClick: openAdjustmentDrawer }}
        rowKey="id"
        rowTestIdPrefix="people-attendance-monthly-row"
        tableTestId="people-attendance-monthly-table"
        onRowClick={(report) => setActiveReportId(report.id)}
      />

      <MonthlyReportDetailDrawer
        open={Boolean(activeReport)}
        report={activeReport}
        onClose={() => setActiveReportId(undefined)}
        onConfirm={handleConfirm}
      />
      <MonthlyAdjustmentDrawer
        form={adjustmentDrawer.form}
        getReportsForMonth={getReportsForMonth}
        open={adjustmentDrawer.open}
        onCancel={adjustmentDrawer.cancel}
        onChange={adjustmentDrawer.updateForm}
        onMonthChange={handleChangeAdjustmentMonth}
        onSave={handleSaveAdjustment}
      />
    </ManagementPageScaffold>
  );
}
