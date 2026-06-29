import {
  CalendarOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ScheduleOutlined,
  StopOutlined,
  UserSwitchOutlined
} from '@ant-design/icons';
import { DatePicker, Input, Modal, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useModeDrawerState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { CellText, CompactCell } from '../../components/TableCell';
import { useWorkCalendarState, type WorkCalendarRow } from '../system/WorkCalendarState';
import {
  getAttendanceWorkCalendarDisplayName,
  isAttendanceEligiblePeopleMember,
  isPeopleRelationshipActive
} from './peopleDomain';
import {
  attendanceDateTimeFormat,
  attendanceModeOptions,
  attendanceModeTone,
  attendanceStatusOptions,
  attendanceStatusTone,
  attendanceTypeOptions,
  attendanceTypeTone,
  buildAttendanceRecord,
  buildCanceledAttendanceRecord,
  createAttendanceForm,
  createAttendanceFormFromRecord,
  disabledAttendanceMinutes,
  formatAttendanceDuration,
  getAttendanceFormDerivedStatus,
  getAttendanceFormDurationHours,
  getAttendanceFormSnapshot,
  getAttendanceOperationRecords,
  isAttendanceFormValid,
  isHistoricalAttendanceInFuture,
  isSameAttendanceFormSnapshot,
  normalizeDateString,
  type AttendanceFormValue
} from './peopleAttendanceDisplayModel';
import {
  peopleAttendanceToday,
  type PeopleAttendanceRecord,
  type PeopleAttendanceStatus,
  type PeopleAttendanceType,
  usePeopleOrganizationState
} from './PeopleOrganizationState';
import type { PeopleMember } from './peopleTypes';

type AttendanceStatusFilter = '全部' | PeopleAttendanceStatus;
type AttendanceTypeFilter = '全部' | PeopleAttendanceType;

type AttendanceFilters = {
  keyword: string;
  status: AttendanceStatusFilter;
  timeScope: DateScopeFilterValue;
  type: AttendanceTypeFilter;
};

type AttendanceTableRow = PeopleAttendanceRecord & {
  member: PeopleMember;
};

const defaultAttendanceFilters: AttendanceFilters = {
  keyword: '',
  status: '全部',
  timeScope: { mode: 'all' },
  type: '全部'
};

const attendanceCurrentMonth = peopleAttendanceToday.slice(0, 7);
const attendanceCurrentMonthRange = getDateScopeMonthRange(attendanceCurrentMonth);

function isAttendanceRecordInTimeScope(record: Pick<PeopleAttendanceRecord, 'endAt' | 'startAt'>, scope: DateScopeFilterValue) {
  const range = getDateScopeRange(scope, attendanceCurrentMonth);

  if (!range) {
    return true;
  }

  const startDate = record.startAt.slice(0, 10);
  const endDate = record.endAt.slice(0, 10);

  return endDate >= range.startDate && startDate <= range.endDate;
}

function PersonCell({ member }: { member: PeopleMember }) {
  return <CompactCell primary={member.name} secondary={member.position} />;
}

function formatAttendanceMemberReference(member: PeopleMember) {
  return `${member.name} / ${member.id} / ${member.position}`;
}

function AttendanceDetailContent({
  member,
  record,
  workCalendarRows
}: {
  member: PeopleMember;
  record: PeopleAttendanceRecord;
  workCalendarRows: WorkCalendarRow[];
}) {
  return (
    <>
      <DetailSummaryCards
        columns={3}
        items={[
          {
            icon: <UserSwitchOutlined />,
            key: 'member',
            label: '人员',
            value: member.name
          },
          {
            icon: <CalendarOutlined />,
            key: 'type',
            label: '类型',
            value: <StatusTag toneMap={attendanceTypeTone} value={record.type} />
          },
          {
            icon: <ClockCircleOutlined />,
            key: 'duration',
            label: '时长',
            value: formatAttendanceDuration(record.durationHours)
          }
        ]}
      />
      <DetailSection icon={<UserSwitchOutlined />} title="人员范围">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '员工工号', value: member.id },
            { label: '岗位', value: member.position },
            { label: '适用日历', value: getAttendanceWorkCalendarDisplayName(member, workCalendarRows) }
          ]}
        />
      </DetailSection>
      <DetailSection icon={<ScheduleOutlined />} title="假勤记录">
        <DetailInfoGrid
          columns={2}
          items={[
            { label: '开始时间', value: record.startAt },
            { label: '结束时间', value: record.endAt },
            { label: '记录方式', value: <StatusTag toneMap={attendanceModeTone} value={record.mode} /> },
            { label: '原因', value: record.reason, wide: true },
            ...(record.status === '已取消' ? [{ label: '取消原因', value: record.cancelReason ?? '-', wide: true }] : [])
          ]}
        />
      </DetailSection>
      <OperationRecordSection icon={<ClockCircleOutlined />} records={getAttendanceOperationRecords(record, member)} scrollX={760} title="操作记录" />
    </>
  );
}

function AttendanceFormContent({
  availableMembers,
  form,
  historicalEndsInFuture,
  isCreateMode,
  selectedMember,
  onUpdate
}: {
  availableMembers: PeopleMember[];
  form: AttendanceFormValue;
  historicalEndsInFuture: boolean;
  isCreateMode: boolean;
  selectedMember?: PeopleMember;
  onUpdate: <K extends keyof AttendanceFormValue>(field: K, value: AttendanceFormValue[K]) => void;
}) {
  const durationHours = getAttendanceFormDurationHours(form);
  const derivedStatus = getAttendanceFormDerivedStatus(form);

  return (
    <DetailSection icon={<CalendarOutlined />} title={isCreateMode ? '假勤信息' : '编辑信息'}>
      <DrawerFormGrid>
        {isCreateMode ? (
          <DrawerFormField required label="人员">
            <Select
              showSearch
              optionFilterProp="label"
              value={form.memberId}
              options={availableMembers.map((member) => ({
                label: formatAttendanceMemberReference(member),
                value: member.id
              }))}
              onChange={(value) => onUpdate('memberId', value)}
            />
          </DrawerFormField>
        ) : (
          <ReadOnlyField label="人员" value={selectedMember ? formatAttendanceMemberReference(selectedMember) : form.memberId} />
        )}
        <DrawerFormField required label="记录类型">
          <Select
            value={form.type}
            options={attendanceTypeOptions.map((option) => ({
              label: option,
              value: option
            }))}
            onChange={(value) => onUpdate('type', value)}
          />
        </DrawerFormField>
        {isCreateMode ? (
          <DrawerFormField required label="记录方式">
            <Select
              value={form.mode}
              options={attendanceModeOptions.map((option) => ({
                label: option,
                value: option
              }))}
              onChange={(value) => onUpdate('mode', value)}
            />
          </DrawerFormField>
        ) : (
          <ReadOnlyField label="记录方式" value={form.mode} />
        )}
        <DrawerFormField required label="开始时间">
          <DatePicker
            format={attendanceDateTimeFormat}
            inputReadOnly
            placeholder="选择日期和小时"
            showTime={{ disabledMinutes: () => disabledAttendanceMinutes, format: 'HH:mm' }}
            value={form.startAt ? dayjs(form.startAt) : undefined}
            onChange={(_, dateString) => onUpdate('startAt', normalizeDateString(dateString))}
          />
        </DrawerFormField>
        <DrawerFormField required label="结束时间">
          <DatePicker
            format={attendanceDateTimeFormat}
            inputReadOnly
            placeholder="选择日期和小时"
            showTime={{ disabledMinutes: () => disabledAttendanceMinutes, format: 'HH:mm' }}
            value={form.endAt ? dayjs(form.endAt) : undefined}
            onChange={(_, dateString) => onUpdate('endAt', normalizeDateString(dateString))}
          />
        </DrawerFormField>
        <ReadOnlyField label="时长" value={formatAttendanceDuration(durationHours)} />
        <ReadOnlyField label="记录状态" value={derivedStatus ? <StatusTag toneMap={attendanceStatusTone} value={derivedStatus} /> : undefined} />
        {historicalEndsInFuture ? <ReadOnlyField label="时间校验" value="历史补录结束时间不能晚于当前时间" /> : null}
        <DrawerFormField required wide label="原因">
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 5 }}
            placeholder="请记录请假、调休、临时不可用或补班原因"
            value={form.reason}
            onChange={(event) => onUpdate('reason', event.target.value)}
          />
        </DrawerFormField>
      </DrawerFormGrid>
    </DetailSection>
  );
}

function AttendanceRecordDrawer({
  form,
  mode,
  open,
  peopleRows,
  record,
  workCalendarRows,
  onBackToDetail,
  onCancel,
  onCancelRecord,
  onClose,
  onEdit,
  onSave,
  onUpdateForm
}: {
  form: AttendanceFormValue;
  mode: 'create' | 'detail' | 'edit' | undefined;
  open: boolean;
  peopleRows: PeopleMember[];
  record?: PeopleAttendanceRecord;
  workCalendarRows: WorkCalendarRow[];
  onBackToDetail: () => void;
  onCancel: () => void;
  onCancelRecord: (record: PeopleAttendanceRecord, cancelReason: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onSave: (record: PeopleAttendanceRecord) => void;
  onUpdateForm: <K extends keyof AttendanceFormValue>(field: K, value: AttendanceFormValue[K]) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [cancelReason, setCancelReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit';
  const selectedMember = peopleRows.find((member) => member.id === form.memberId);
  const detailMember = record ? peopleRows.find((member) => member.id === record.memberId) ?? selectedMember : selectedMember;
  const availableMembers = useMemo(() => {
    const attendancePeopleRows = peopleRows.filter(isAttendanceEligiblePeopleMember);

    return form.mode === '历史补录' ? attendancePeopleRows : attendancePeopleRows.filter(isPeopleRelationshipActive);
  }, [form.mode, peopleRows]);
  const historicalEndsInFuture = isHistoricalAttendanceInFuture(form);
  const recordSnapshot = record ? getAttendanceFormSnapshot(createAttendanceFormFromRecord(record)) : undefined;
  const isChanged = isCreateMode || !recordSnapshot || !isSameAttendanceFormSnapshot(getAttendanceFormSnapshot(form), recordSnapshot);
  const saveDisabled = !isAttendanceFormValid(form, selectedMember) || !isChanged;
  const drawerTitle = isCreateMode ? '新增假勤' : isEditMode ? '编辑假勤' : '假勤详情';

  useEffect(() => {
    if (!open || mode !== 'create' || availableMembers.some((member) => member.id === form.memberId)) {
      return;
    }

    onUpdateForm('memberId', availableMembers[0]?.id ?? '');
  }, [availableMembers, form.memberId, mode, onUpdateForm, open]);

  useEffect(() => {
    setCancelModalOpen(false);
    setCancelReason('');
  }, [open, record?.id]);

  function handleSave() {
    if (!selectedMember) {
      void messageApi.warning('请选择人员');
      return;
    }

    if (!form.startAt || !form.endAt) {
      void messageApi.warning('请选择开始和结束时间');
      return;
    }

    if (getAttendanceFormDurationHours(form) <= 0) {
      void messageApi.warning('结束时间必须晚于开始时间');
      return;
    }

    if (historicalEndsInFuture) {
      void messageApi.warning('历史补录结束时间不能晚于当前时间');
      return;
    }

    if (!form.reason.trim()) {
      void messageApi.warning('请输入原因');
      return;
    }

    onSave(buildAttendanceRecord({ form, record, selectedMember }));
    void messageApi.success(isEditMode ? '假勤记录已保存' : '假勤记录已新增');
  }

  function handleConfirmCancel() {
    if (!record) {
      return;
    }

    if (!cancelReason.trim()) {
      void messageApi.warning('请输入取消原因');
      return;
    }

    onCancelRecord(record, cancelReason.trim());
    setCancelModalOpen(false);
    setCancelReason('');
    void messageApi.success('假勤记录已取消');
  }

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        bodyTestId="people-attendance-drawer"
        className="people-detail-drawer people-attendance-drawer"
        detailActions={{
          closeAction: { label: '关闭', onClick: onClose },
          primaryAction: record && record.status !== '已取消' ? { label: '编辑记录', onClick: onEdit } : undefined,
          secondaryAction:
            record && record.status !== '已取消'
              ? { danger: true, icon: <CloseCircleOutlined />, label: '取消记录', onClick: () => setCancelModalOpen(true) }
              : undefined
        }}
        formActions={{
          cancelAction: { label: '取消', onClick: onCancel },
          primaryAction: { disabled: saveDisabled, label: '保存记录', onClick: handleSave }
        }}
        mode={mode}
        open={open}
        title={<DetailDrawerTitle status={record?.status} statusToneMap={attendanceStatusTone} subtitle="人员组织 / 考勤假勤" title={drawerTitle} />}
        width={760}
        onClose={isEditMode ? onBackToDetail : onClose}
      >
        {mode === 'detail' && detailMember && record ? (
          <AttendanceDetailContent member={detailMember} record={record} workCalendarRows={workCalendarRows} />
        ) : null}
        {mode !== 'detail' ? (
          <AttendanceFormContent
            availableMembers={availableMembers}
            form={form}
            historicalEndsInFuture={historicalEndsInFuture}
            isCreateMode={isCreateMode}
            selectedMember={selectedMember}
            onUpdate={onUpdateForm}
          />
        ) : null}
      </DrawerFormShell>
      <Modal
        destroyOnHidden
        okButtonProps={{ disabled: !cancelReason.trim() }}
        okText="确认取消"
        open={cancelModalOpen}
        title="取消假勤记录"
        onCancel={() => {
          setCancelModalOpen(false);
          setCancelReason('');
        }}
        onOk={handleConfirmCancel}
      >
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 5 }}
          placeholder="请输入取消原因"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </Modal>
    </>
  );
}

export function PeopleAttendancePage() {
  const { attendanceRecords, cancelAttendanceRecord, peopleRows, saveAttendanceRecord } = usePeopleOrganizationState();
  const { workCalendarRows } = useWorkCalendarState();
  const [filters, setFilters] = useState<AttendanceFilters>(defaultAttendanceFilters);
  const attendancePeopleRows = useMemo(() => peopleRows.filter(isAttendanceEligiblePeopleMember), [peopleRows]);
  const firstActiveMemberId = useMemo(
    () =>
      attendancePeopleRows.find(isPeopleRelationshipActive)?.id ??
      attendancePeopleRows[0]?.id ??
      '',
    [attendancePeopleRows]
  );
  const attendanceDrawer = useModeDrawerState<PeopleAttendanceRecord, AttendanceFormValue>({
    createForm: () => createAttendanceForm(firstActiveMemberId),
    detailForm: createAttendanceFormFromRecord,
    editForm: createAttendanceFormFromRecord
  });
  const activeRecord = attendanceDrawer.record;
  const rows = useMemo(
    () =>
      attendanceRecords
        .map((record) => {
          const member = attendancePeopleRows.find((peopleRow) => peopleRow.id === record.memberId);
          return member ? { ...record, member } : undefined;
        })
        .filter((record): record is AttendanceTableRow => Boolean(record))
        .sort((left, right) => right.startAt.localeCompare(left.startAt) || right.updatedAt.localeCompare(left.updatedAt)),
    [attendancePeopleRows, attendanceRecords]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const keyword = filters.keyword.trim().toLowerCase();
        const searchableText = `${row.member.name} ${row.member.id} ${row.member.position} ${row.type} ${row.reason}`.toLowerCase();

        if (filters.type !== '全部' && row.type !== filters.type) {
          return false;
        }

        if (filters.status !== '全部' && row.status !== filters.status) {
          return false;
        }

        if (!isAttendanceRecordInTimeScope(row, filters.timeScope)) {
          return false;
        }

        return !keyword || searchableText.includes(keyword);
      }),
    [filters, rows]
  );

  const metrics = useMemo(
    () => ({
      activeUnavailable: rows.filter((row) => row.status === '生效中' && row.effect === '不可用').length,
      ended: rows.filter((row) => row.status === '已结束').length,
      monthRecords: rows.filter((row) => row.startAt.startsWith(peopleAttendanceToday.slice(0, 7))).length,
      pending: rows.filter((row) => row.status === '待生效').length,
      temporaryUnavailable: rows.filter((row) => row.type === '临时不可用' && row.status !== '已取消' && row.status !== '已结束').length
    }),
    [rows]
  );

  function updateFilter<K extends keyof AttendanceFilters>(key: K, value: AttendanceFilters[K]) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value
    }));
  }

  function handleOpenCreate() {
    attendanceDrawer.openCreate();
  }

  function handleSave(record: PeopleAttendanceRecord) {
    saveAttendanceRecord(record);
    attendanceDrawer.openDetail(record);
  }

  function handleCancelRecord(record: PeopleAttendanceRecord, cancelReason: string) {
    const nextRecord = buildCanceledAttendanceRecord(record, cancelReason);

    cancelAttendanceRecord(record.id, cancelReason);
    attendanceDrawer.openDetail(nextRecord);
  }

  const columns: TableColumnsType<AttendanceTableRow> = [
    {
      title: '员工工号',
      key: 'employeeId',
      width: 120,
      render: (_, record) => <CellText>{record.member.id}</CellText>
    },
    {
      title: '人员',
      key: 'person',
      width: 150,
      render: (_, record) => <PersonCell member={record.member} />
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 108,
      render: (type: PeopleAttendanceType) => <StatusTag toneMap={attendanceTypeTone} value={type} />
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
      width: 108,
      render: (durationHours: number) => <CellText>{formatAttendanceDuration(durationHours)}</CellText>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: PeopleAttendanceStatus) => <StatusTag toneMap={attendanceStatusTone} value={status} />
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 220,
      render: (reason: string) => <span className="detail-table-sub">{reason}</span>
    },
    {
      title: '记录信息',
      key: 'recordInfo',
      width: 132,
      render: (_, record) => <CompactCell primarySlot={<StatusTag toneMap={attendanceModeTone} value={record.mode} />} secondary={record.recorder} />
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={attendanceCurrentMonth}
              defaultRange={attendanceCurrentMonthRange}
              label="生效时间"
              testIdPrefix="people-attendance-time-filter"
              value={filters.timeScope}
              onChange={(timeScope) => updateFilter('timeScope', timeScope)}
            />
            <FilterField label="类型" controlWidth="wide-select">
              <Select
                value={filters.type}
                options={[
                  { label: '全部', value: '全部' },
                  ...attendanceTypeOptions.map((type) => ({
                    label: type,
                    value: type
                  }))
                ]}
                onChange={(value) => updateFilter('type', value)}
              />
            </FilterField>
            <FilterField label="状态" controlWidth="status-select">
              <Select
                value={filters.status}
                options={attendanceStatusOptions.map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(value) => updateFilter('status', value)}
              />
            </FilterField>
            <KeywordFilter
              placeholder="姓名 / 工号 / 岗位 / 原因"
              value={filters.keyword}
              onChange={(keyword) => updateFilter('keyword', keyword)}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid>
          <MetricCard icon={<PauseCircleOutlined />} label="当前不可用" value={metrics.activeUnavailable} />
          <MetricCard icon={<ClockCircleOutlined />} label="待生效" value={metrics.pending} />
          <MetricCard icon={<CalendarOutlined />} label="本月记录" value={metrics.monthRecords} />
          <MetricCard icon={<StopOutlined />} label="临时不可用" value={metrics.temporaryUnavailable} />
          <MetricCard icon={<ScheduleOutlined />} label="已结束" value={metrics.ended} />
        </MetricGrid>
      }
    >
      <ManagementTable<AttendanceTableRow>
        columns={columns}
        count={{ unit: '条', value: filteredRows.length }}
        dataSource={filteredRows}
        primaryAction={{
          icon: <PlusOutlined />,
          label: '新增记录',
          testId: 'people-attendance-create-button',
          onClick: handleOpenCreate
        }}
        rowKey="id"
        rowTestIdPrefix="people-attendance-row"
        tableTestId="people-attendance-table"
        onRowClick={(record) => {
          attendanceDrawer.openDetail(record);
        }}
      />

      <AttendanceRecordDrawer
        form={attendanceDrawer.form}
        mode={attendanceDrawer.mode}
        open={attendanceDrawer.open}
        peopleRows={attendancePeopleRows}
        record={activeRecord}
        workCalendarRows={workCalendarRows}
        onBackToDetail={attendanceDrawer.backToDetail}
        onCancel={attendanceDrawer.cancel}
        onCancelRecord={handleCancelRecord}
        onClose={attendanceDrawer.close}
        onEdit={() => attendanceDrawer.openEdit(activeRecord)}
        onSave={handleSave}
        onUpdateForm={attendanceDrawer.updateForm}
      />
    </ManagementPageScaffold>
  );
}
