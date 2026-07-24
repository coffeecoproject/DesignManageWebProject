import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ProfileOutlined,
  StopOutlined
} from '@ant-design/icons';
import { DatePicker, Input, Select, Table, message } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DrawerFormShell, type ModeDrawerState, useModeDrawerState } from '../../components/DrawerForm';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TabbedManagementTable, createTabbedManagementTableItem } from '../../components/TabbedManagementTable';
import { TagChipList } from '../../components/TagChip';
import { CompactCell } from '../../components/TableCell';
import {
  bigSmallWeekModes,
  defaultBigSmallAlternateWorkdays,
  defaultBigSmallFixedWorkdays,
  defaultDoubleWeekendWorkdays,
  defaultSingleWeekendWorkdays,
  statutoryHolidayGroups,
  type AnnualExceptionConfigFormValue,
  type AnnualExceptionConfigRow,
  type AnnualExceptionItem,
  type AnnualExceptionStatus,
  type BigSmallWeekMode,
  type StatutoryHolidayGroupId,
  type WorkCalendarFormValue,
  type WorkCalendarRow,
  type WorkCalendarStatus,
  type WorkCalendarType,
  type WorkCalendarWeekday,
  useWorkCalendarState,
  workCalendarTypes,
  workCalendarWeekdays
} from './WorkCalendarState';
import { getAnnualExceptionSummary, type AnnualExceptionSummary } from './workCalendarRules';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { isPeopleRelationshipActive } from '../people/peopleDomain';

const workCalendarStatusTone = {
  启用: 'green',
  停用: 'gray'
} as const;

const workCalendarTypeTone = {
  双休: 'blue',
  单休: 'green',
  大小周: 'amber',
  自定义: 'purple'
} as const;

const annualExceptionStatusTone = {
  草稿: 'amber',
  已启用: 'green'
} as const;

const defaultWorkCalendarForm: WorkCalendarFormValue = {
  alternateWorkdays: [],
  effectiveFrom: '2026-06-16',
  fixedWorkdays: defaultDoubleWeekendWorkdays,
  name: '',
  note: '',
  type: '双休'
};

const defaultAnnualExceptionForm: AnnualExceptionConfigFormValue = {
  items: [],
  source: '国务院办公厅通知 / 前端全年配置',
  year: 2026
};

type StatutoryHolidayGroupRow = {
  groupId: StatutoryHolidayGroupId;
  groupName: string;
  note: string;
  restDates: string[];
  workdayDates: string[];
};

function CalendarCell({ record }: { record: WorkCalendarRow }) {
  return <CompactCell primary={record.name} secondary={record.code} />;
}

function AnnualExceptionCell({ record }: { record: AnnualExceptionConfigRow }) {
  const groupRows = getStatutoryHolidayGroupRows(record.items);
  const restDayCount = groupRows.reduce((total, row) => total + row.restDates.length, 0);
  const workdayCount = groupRows.reduce((total, row) => total + row.workdayDates.length, 0);

  return (
    <CompactCell
      primary={`${record.year} 年法定节假日`}
      secondary={`${restDayCount} 天休息 / ${workdayCount} 天工作日调整`}
    />
  );
}

function getDefaultsForCalendarType(type: WorkCalendarType): Pick<
  WorkCalendarFormValue,
  'alternateWorkdays' | 'anchorDate' | 'fixedWorkdays' | 'startMode'
> {
  if (type === '单休') {
    return {
      alternateWorkdays: [],
      fixedWorkdays: defaultSingleWeekendWorkdays
    };
  }

  if (type === '大小周') {
    return {
      alternateWorkdays: defaultBigSmallAlternateWorkdays,
      anchorDate: '2026-06-01',
      fixedWorkdays: defaultBigSmallFixedWorkdays,
      startMode: '单休周开始'
    };
  }

  if (type === '自定义') {
    return {
      alternateWorkdays: [],
      fixedWorkdays: defaultDoubleWeekendWorkdays
    };
  }

  return {
    alternateWorkdays: [],
    fixedWorkdays: defaultDoubleWeekendWorkdays
  };
}

function buildWorkCalendarForm(record?: WorkCalendarRow): WorkCalendarFormValue {
  if (!record) {
    return {
      ...defaultWorkCalendarForm,
      alternateWorkdays: [...defaultWorkCalendarForm.alternateWorkdays],
      fixedWorkdays: [...defaultWorkCalendarForm.fixedWorkdays]
    };
  }

  return {
    alternateWorkdays: [...record.alternateWorkdays],
    anchorDate: record.anchorDate,
    effectiveFrom: record.effectiveFrom ?? '2026-01-01',
    fixedWorkdays: [...record.fixedWorkdays],
    name: record.name,
    note: record.note,
    startMode: record.startMode,
    type: record.type
  };
}

function buildAnnualExceptionForm(record?: AnnualExceptionConfigRow): AnnualExceptionConfigFormValue {
  if (!record) {
    return {
      ...defaultAnnualExceptionForm,
      items: []
    };
  }

  return {
    items: record.items.map((item) => ({ ...item })),
    source: record.source,
    year: record.year
  };
}

function sortDates(dates: string[]) {
  return Array.from(new Set(dates)).sort((left, right) => left.localeCompare(right));
}

function getStatutoryHolidayGroupRows(items: AnnualExceptionItem[]): StatutoryHolidayGroupRow[] {
  return statutoryHolidayGroups.map((group) => {
    const groupItems = items.filter((item) => item.groupId === group.id);

    return {
      groupId: group.id,
      groupName: group.name,
      note: groupItems.find((item) => item.note)?.note ?? '',
      restDates: sortDates(groupItems.filter((item) => item.type === '休息日').map((item) => item.date)),
      workdayDates: sortDates(groupItems.filter((item) => item.type === '特殊工作日').map((item) => item.date))
    };
  });
}

function getDatePickerValue(dates: string[]) {
  return dates.map((date) => dayjs(date));
}

function createAnnualExceptionItem(
  year: number,
  group: (typeof statutoryHolidayGroups)[number],
  type: AnnualExceptionItem['type'],
  date: string,
  note: string
): AnnualExceptionItem {
  return {
    date,
    groupId: group.id,
    groupName: group.name,
    id: `annual-${year}-${group.id}-${type === '休息日' ? 'rest' : 'work'}-${date}`,
    name: type === '休息日' ? group.name : `${group.name}工作日调整`,
    note,
    type
  };
}

function updateAnnualExceptionGroupItems(
  currentItems: AnnualExceptionItem[],
  year: number,
  groupId: StatutoryHolidayGroupId,
  nextPatch: Partial<Pick<StatutoryHolidayGroupRow, 'note' | 'restDates' | 'workdayDates'>>
) {
  const group = statutoryHolidayGroups.find((candidate) => candidate.id === groupId) ?? statutoryHolidayGroups[0];
  const groupRows = getStatutoryHolidayGroupRows(currentItems);
  const currentGroup = groupRows.find((row) => row.groupId === groupId) ?? {
    groupId: group.id,
    groupName: group.name,
    note: '',
    restDates: [],
    workdayDates: []
  };
  const nextGroup = {
    ...currentGroup,
    ...nextPatch,
    restDates: sortDates(nextPatch.restDates ?? currentGroup.restDates),
    workdayDates: sortDates(nextPatch.workdayDates ?? currentGroup.workdayDates)
  };
  const otherItems = currentItems.filter((item) => item.groupId !== groupId);
  const nextGroupItems = [
    ...nextGroup.restDates.map((date) => createAnnualExceptionItem(year, group, '休息日', date, nextGroup.note)),
    ...nextGroup.workdayDates.map((date) => createAnnualExceptionItem(year, group, '特殊工作日', date, nextGroup.note))
  ];

  return [...otherItems, ...nextGroupItems].sort((left, right) => left.date.localeCompare(right.date));
}

function isValidDateInYear(date: string, year: number) {
  if (!new RegExp(`^${year}-\\d{2}-\\d{2}$`).test(date)) {
    return false;
  }

  const [dateYear, month, day] = date.split('-').map(Number);
  const parsedDate = new Date(dateYear, month - 1, day);

  return parsedDate.getFullYear() === dateYear && parsedDate.getMonth() === month - 1 && parsedDate.getDate() === day;
}

function getAnnualExceptionValidationError(formValue: AnnualExceptionConfigFormValue) {
  if (!formValue.year) {
    return '请输入年度';
  }

  if (!formValue.source.trim()) {
    return '请输入来源';
  }

  const groupRows = getStatutoryHolidayGroupRows(formValue.items);
  const missingGroups = groupRows.filter((group) => group.restDates.length === 0).map((group) => group.groupName);

  if (missingGroups.length > 0) {
    return `${missingGroups.join('、')}需要配置休息日`;
  }

  const invalidDate = formValue.items.find((item) => !isValidDateInYear(item.date, formValue.year));

  if (invalidDate) {
    return `日期必须属于 ${formValue.year} 年`;
  }

  const duplicateDate = formValue.items.find((item, index) => formValue.items.findIndex((candidate) => candidate.date === item.date) !== index);

  if (duplicateDate) {
    return `${duplicateDate.date} 已重复配置`;
  }

  return '';
}

function normalizeWorkCalendarForm(formValue: WorkCalendarFormValue): WorkCalendarFormValue {
  const defaults = getDefaultsForCalendarType(formValue.type);

  if (formValue.type === '自定义') {
    return {
      alternateWorkdays: [],
      effectiveFrom: formValue.effectiveFrom,
      fixedWorkdays: Array.from(new Set(formValue.fixedWorkdays)),
      name: formValue.name.trim(),
      note: formValue.note.trim(),
      type: formValue.type
    };
  }

  if (formValue.type === '大小周') {
    return {
      alternateWorkdays: defaultBigSmallAlternateWorkdays,
      anchorDate: formValue.anchorDate ?? defaults.anchorDate,
      effectiveFrom: formValue.effectiveFrom,
      fixedWorkdays: defaultBigSmallFixedWorkdays,
      name: formValue.name.trim(),
      note: formValue.note.trim(),
      startMode: formValue.startMode ?? '单休周开始',
      type: formValue.type
    };
  }

  return {
    alternateWorkdays: defaults.alternateWorkdays,
    effectiveFrom: formValue.effectiveFrom,
    fixedWorkdays: defaults.fixedWorkdays,
    name: formValue.name.trim(),
    note: formValue.note.trim(),
    type: formValue.type
  };
}

function getWorkdaySummary(record: Pick<WorkCalendarRow, 'alternateWorkdays' | 'fixedWorkdays' | 'type'>) {
  if (record.type === '大小周') {
    return '周一至周五固定，周六隔周工作';
  }

  return record.fixedWorkdays.join(' / ');
}

function getCycleSummary(record: Pick<WorkCalendarRow, 'anchorDate' | 'startMode' | 'type'>) {
  if (record.type === '大小周') {
    return `${record.startMode ?? '单休周开始'} / 基准 ${record.anchorDate ?? '未设置'}`;
  }

  if (record.type === '自定义') {
    return '按所选工作日';
  }

  return '每周固定';
}

function getCalendarScope(record: WorkCalendarRow) {
  return record.isDefault ? '公司默认' : '可分配给人员';
}

function getHolidayRuleSummaryText(summary: AnnualExceptionSummary) {
  return `${summary.enabledYearCount} 年启用 / ${summary.restDayCount} 天休息 / ${summary.specialWorkdayCount} 天工作日调整`;
}

function getEnabledAnnualExceptionItems(items: AnnualExceptionItem[]) {
  if (items.length === 0) {
    return '暂无启用法定节假日';
  }

  const previewText = getStatutoryHolidayGroupRows(items)
    .filter((group) => group.restDates.length > 0)
    .slice(0, 4)
    .map((group) => `${group.groupName} ${group.restDates.length} 天`)
    .join(' / ');

  return items.length > 4 ? `${previewText} 等` : previewText;
}

function WorkCalendarDrawer({
  annualExceptionItems,
  annualExceptionSummary,
  drawer,
  existingRows,
  record,
  onCreate,
  onSave,
  onToggleStatus
}: {
  annualExceptionItems: AnnualExceptionItem[];
  annualExceptionSummary: AnnualExceptionSummary;
  drawer: ModeDrawerState<string, WorkCalendarFormValue>;
  existingRows: WorkCalendarRow[];
  record?: WorkCalendarRow;
  onCreate: (nextValue: WorkCalendarFormValue) => void;
  onSave: (id: string, nextValue: WorkCalendarFormValue) => void;
  onToggleStatus: (record: WorkCalendarRow) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const mode = drawer.mode ?? 'detail';
  const isCreateMode = mode === 'create';
  const isDetailMode = mode === 'detail';
  const isEditMode = mode === 'edit';
  const formValue = isDetailMode && record ? buildWorkCalendarForm(record) : drawer.form;
  const normalizedForm = normalizeWorkCalendarForm(formValue);
  const status = record?.status ?? '启用';
  const code = record?.code ?? '保存后生成';
  const saveDisabled =
    !normalizedForm.name ||
    !normalizedForm.effectiveFrom ||
    normalizedForm.fixedWorkdays.length === 0 ||
    (normalizedForm.type === '大小周' && !normalizedForm.anchorDate);

  function updateFormValue<T extends keyof WorkCalendarFormValue>(key: T, value: WorkCalendarFormValue[T]) {
    drawer.updateForm(key, value);
  }

  function handleTypeChange(type: WorkCalendarType) {
    drawer.setForm((currentValue) => ({
      ...currentValue,
      ...getDefaultsForCalendarType(type),
      type
    }));
  }

  function handleSave() {
    const nextValue = normalizeWorkCalendarForm(formValue);

    if (!nextValue.name) {
      void messageApi.warning('请输入工作日历名称');
      return;
    }

    if (!nextValue.effectiveFrom) {
      void messageApi.warning('请选择生效日期');
      return;
    }

    if (isEditMode && record && nextValue.effectiveFrom <= (record.effectiveFrom ?? '0001-01-01')) {
      void messageApi.warning(`生效日期需晚于当前版本 ${record.effectiveFrom ?? '初始版本'}`);
      return;
    }

    if (nextValue.fixedWorkdays.length === 0) {
      void messageApi.warning('请至少选择一个工作日');
      return;
    }

    if (nextValue.type === '大小周' && !nextValue.anchorDate) {
      void messageApi.warning('请选择大小周基准周');
      return;
    }

    if (existingRows.some((row) => row.id !== record?.id && row.name === nextValue.name)) {
      void messageApi.warning('工作日历名称已存在');
      return;
    }

    if (isCreateMode) {
      onCreate(nextValue);
      void messageApi.success('工作日历已新增');
      return;
    }

    if (!record) {
      return;
    }

    onSave(record.id, nextValue);
    void messageApi.success('工作日历已保存');
  }

  function getTitle() {
    if (isCreateMode) {
      return '新增工作日历';
    }

    if (isEditMode) {
      return '编辑工作日历';
    }

    return '工作日历详情';
  }

  function renderWorkdayField() {
    if (isDetailMode) {
      return <TagChipList items={normalizedForm.fixedWorkdays} maxVisible={7} wrap />;
    }

    if (formValue.type === '自定义') {
      return (
        <Select
          mode="multiple"
          options={workCalendarWeekdays.map((day) => ({ label: day, value: day }))}
          placeholder="选择工作日"
          value={formValue.fixedWorkdays}
          onChange={(workdays: WorkCalendarWeekday[]) => updateFormValue('fixedWorkdays', workdays)}
        />
      );
    }

    return getWorkdaySummary(normalizedForm);
  }

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        className="work-calendar-drawer"
        detailActions={
          isDetailMode && record
            ? {
                closeAction: { label: '关闭', onClick: drawer.close },
                primaryAction: { label: '编辑', onClick: () => drawer.openEdit() },
                secondaryAction: {
                  danger: record.status === '启用',
                  disabled: record.isDefault && record.status === '启用',
                  label: record.status === '启用' ? '停用' : '启用',
                  onClick: () => onToggleStatus(record)
                }
              }
            : undefined
        }
        formActions={
          !isDetailMode
            ? {
                cancelAction: { label: '取消', onClick: drawer.cancel },
                primaryAction: {
                  disabled: saveDisabled,
                  label: isCreateMode ? '创建工作日历' : '保存配置',
                  onClick: handleSave
                }
              }
            : undefined
        }
        mode={mode}
        open={drawer.open}
        title={<DetailDrawerTitle status={status} statusToneMap={workCalendarStatusTone} subtitle="系统管理 / 工作日历" title={getTitle()} />}
        width={760}
        onClose={isDetailMode ? drawer.close : drawer.cancel}
      >
        <DrawerProfileCard
          avatar={(formValue.name.trim() || '日').slice(0, 1)}
          subtitle={code}
          tags={[
            <StatusTag key="type" toneMap={workCalendarTypeTone} value={formValue.type} />,
            record?.isDefault ? <StatusTag key="default" tone="blue" value="默认" /> : null
          ]}
          title={formValue.name.trim() || '新工作日历'}
        />

        <DetailSection icon={<CalendarOutlined />} title="基础配置">
          <DetailInfoGrid
            columns={2}
            items={[
              {
                label: '工作日历名称 *',
                value: isDetailMode ? (
                  formValue.name
                ) : (
                  <Input
                    placeholder="例如：公司默认大小周"
                    value={formValue.name}
                    onChange={(event) => updateFormValue('name', event.target.value)}
                  />
                )
              },
              { label: '日历编码', value: code },
              {
                label: '工作制 *',
                value: isDetailMode ? (
                  <StatusTag toneMap={workCalendarTypeTone} value={formValue.type} />
                ) : (
                  <Select
                    options={workCalendarTypes.map((type) => ({ label: type, value: type }))}
                    value={formValue.type}
                    onChange={handleTypeChange}
                  />
                )
              },
              { label: '使用范围', value: record ? getCalendarScope(record) : '可分配给人员' },
              { label: '状态', value: <StatusTag toneMap={workCalendarStatusTone} value={status} /> },
              {
                label: '生效日期 *',
                value: isDetailMode ? (
                  formValue.effectiveFrom
                ) : (
                  <DatePicker
                    className="archive-create-date-picker"
                    format="YYYY-MM-DD"
                    inputReadOnly
                    value={formValue.effectiveFrom ? dayjs(formValue.effectiveFrom) : undefined}
                    onChange={(_, dateString) =>
                      updateFormValue('effectiveFrom', Array.isArray(dateString) ? dateString[0] : dateString)
                    }
                  />
                )
              },
              { label: '版本', value: record ? `第 ${record.versions?.length ?? 1} 版` : '保存后生成' }
            ]}
          />
        </DetailSection>

        <DetailSection icon={<ClockCircleOutlined />} title="工作规则">
          <DetailInfoGrid
            columns={2}
            items={[
              { label: '固定工作日 *', value: renderWorkdayField() },
              { label: '周期规则', value: getCycleSummary(normalizedForm) },
              ...(formValue.type === '大小周'
                ? [
                    {
                      label: '基准周 *',
                      value: isDetailMode ? (
                        normalizedForm.anchorDate
                      ) : (
                        <DatePicker
                          className="archive-create-date-picker"
                          format="YYYY-MM-DD"
                          inputReadOnly
                          placeholder="选择基准周周一"
                          value={normalizedForm.anchorDate ? dayjs(normalizedForm.anchorDate) : undefined}
                          onChange={(_, dateString) =>
                            updateFormValue('anchorDate', Array.isArray(dateString) ? dateString[0] : dateString)
                          }
                        />
                      )
                    },
                    {
                      label: '起始周',
                      value: isDetailMode ? (
                        normalizedForm.startMode
                      ) : (
                        <Select
                          options={bigSmallWeekModes.map((modeOption) => ({ label: modeOption, value: modeOption }))}
                          value={formValue.startMode}
                          onChange={(modeOption: BigSmallWeekMode) => updateFormValue('startMode', modeOption)}
                        />
                      )
                    },
                    {
                      label: '隔周工作日',
                      value: <TagChipList items={normalizedForm.alternateWorkdays} maxVisible={7} wrap />,
                      wide: true
                    }
                  ]
                : [])
            ]}
          />
        </DetailSection>

        <DetailSection icon={<ProfileOutlined />} title="法定节假日">
          <DetailInfoGrid
            columns={2}
            items={[
              { label: '节假日规则', value: getHolidayRuleSummaryText(annualExceptionSummary) },
              { label: '配置方式', value: '全年法定节假日配置统一维护' },
              {
                label: '任务排期',
                value: '先应用法定节假日，再应用工作日历模板',
                wide: true
              },
              {
                label: '当前数据',
                value: getEnabledAnnualExceptionItems(annualExceptionItems),
                wide: true
              }
            ]}
          />
        </DetailSection>

        <DetailSection icon={<ProfileOutlined />} title="备注">
          {isDetailMode ? (
            <div className="task-config-note-text">{formValue.note || '暂无备注'}</div>
          ) : (
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              placeholder="记录适用人群或特殊说明"
              value={formValue.note}
              onChange={(event) => updateFormValue('note', event.target.value)}
            />
          )}
        </DetailSection>
      </DrawerFormShell>
    </>
  );
}

function AnnualExceptionDrawer({
  drawer,
  existingRows,
  record,
  onCreate,
  onSave,
  onToggleStatus
}: {
  drawer: ModeDrawerState<string, AnnualExceptionConfigFormValue>;
  existingRows: AnnualExceptionConfigRow[];
  record?: AnnualExceptionConfigRow;
  onCreate: (nextValue: AnnualExceptionConfigFormValue) => void;
  onSave: (id: string, nextValue: AnnualExceptionConfigFormValue) => void;
  onToggleStatus: (record: AnnualExceptionConfigRow) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const mode = drawer.mode ?? 'detail';
  const isCreateMode = mode === 'create';
  const isDetailMode = mode === 'detail';
  const isEditMode = mode === 'edit';
  const formValue = isDetailMode && record ? buildAnnualExceptionForm(record) : drawer.form;
  const groupRows = getStatutoryHolidayGroupRows(formValue.items);
  const restDayCount = groupRows.reduce((total, row) => total + row.restDates.length, 0);
  const workdayCount = groupRows.reduce((total, row) => total + row.workdayDates.length, 0);
  const validationError = getAnnualExceptionValidationError(formValue);
  const status = record?.status ?? '草稿';
  const saveDisabled = Boolean(validationError);

  function updateFormValue<T extends keyof AnnualExceptionConfigFormValue>(key: T, value: AnnualExceptionConfigFormValue[T]) {
    drawer.updateForm(key, value);
  }

  function updateHolidayGroup(groupId: StatutoryHolidayGroupId, patch: Partial<Pick<StatutoryHolidayGroupRow, 'note' | 'restDates' | 'workdayDates'>>) {
    drawer.setForm((currentValue) => ({
      ...currentValue,
      items: updateAnnualExceptionGroupItems(currentValue.items, currentValue.year, groupId, patch)
    }));
  }

  function handleSave() {
    const error = getAnnualExceptionValidationError(formValue);

    if (error) {
      void messageApi.warning(error);
      return;
    }

    if (existingRows.some((row) => row.id !== record?.id && row.year === formValue.year)) {
      void messageApi.warning(`${formValue.year} 年法定节假日已存在`);
      return;
    }

    if (isCreateMode) {
      onCreate(formValue);
      void messageApi.success('法定节假日已新增');
      return;
    }

    if (!record) {
      return;
    }

    onSave(record.id, formValue);
    void messageApi.success('法定节假日已保存');
  }

  function getTitle() {
    if (isCreateMode) {
      return '新增法定节假日';
    }

    if (isEditMode) {
      return '编辑法定节假日';
    }

    return '法定节假日详情';
  }

  function renderDateValue(dates: string[], tone: 'amber' | 'green') {
    return <TagChipList items={dates} maxVisible={6} tone={tone} wrap />;
  }

  function renderDatePicker(row: StatutoryHolidayGroupRow, field: 'restDates' | 'workdayDates') {
    return (
      <DatePicker
        allowClear
        className="annual-exception-date-picker"
        disabledDate={(current) => Boolean(current && current.year() !== formValue.year)}
        format="YYYY-MM-DD"
        inputReadOnly
        multiple
        placeholder="选择日期"
        value={getDatePickerValue(row[field])}
        onChange={(dates) => {
          const nextDates = Array.isArray(dates) ? sortDates(dates.map((date) => date.format('YYYY-MM-DD'))) : [];
          updateHolidayGroup(row.groupId, { [field]: nextDates });
        }}
      />
    );
  }

  const columns: TableColumnsType<StatutoryHolidayGroupRow> = [
    {
      title: '法定节假日',
      dataIndex: 'groupName',
      width: 130,
      render: (_, row) => <CompactCell primary={row.groupName} secondary={`${row.restDates.length} 休 / ${row.workdayDates.length} 调整`} />
    },
    {
      title: '休息日',
      dataIndex: 'restDates',
      width: 310,
      render: (_, row) => (isDetailMode ? renderDateValue(row.restDates, 'green') : renderDatePicker(row, 'restDates'))
    },
    {
      title: '工作日调整',
      dataIndex: 'workdayDates',
      width: 270,
      render: (_, row) => (isDetailMode ? renderDateValue(row.workdayDates, 'amber') : renderDatePicker(row, 'workdayDates'))
    },
    {
      title: '说明',
      dataIndex: 'note',
      width: 210,
      render: (_, row) =>
        isDetailMode ? (
          row.note || '-'
        ) : (
          <Input
            placeholder="可选"
            value={row.note}
            onChange={(event) => updateHolidayGroup(row.groupId, { note: event.target.value })}
          />
        )
    }
  ];

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        className="work-calendar-drawer"
        detailActions={
          isDetailMode && record
            ? {
                closeAction: { label: '关闭', onClick: drawer.close },
                primaryAction: { label: '编辑', onClick: () => drawer.openEdit() },
                secondaryAction: {
                  danger: record.status === '已启用',
                  label: record.status === '已启用' ? '停用' : '启用',
                  onClick: () => onToggleStatus(record)
                }
              }
            : undefined
        }
        formActions={
          !isDetailMode
            ? {
                cancelAction: { label: '取消', onClick: drawer.cancel },
                primaryAction: {
                  disabled: saveDisabled,
                  label: isCreateMode ? '创建法定节假日' : '保存配置',
                  onClick: handleSave
                }
              }
            : undefined
        }
        mode={mode}
        open={drawer.open}
        title={<DetailDrawerTitle status={status} statusToneMap={annualExceptionStatusTone} subtitle="系统管理 / 工作日历" title={getTitle()} />}
        width={960}
        onClose={isDetailMode ? drawer.close : drawer.cancel}
      >
        <DrawerProfileCard
          avatar="节"
          subtitle={record?.code ?? '保存后生成'}
          tags={[
            <StatusTag key="restDays" tone="green" value={`${restDayCount} 天休息`} />,
            <StatusTag key="workdays" tone="amber" value={`${workdayCount} 天工作日调整`} />
          ]}
          title={`${formValue.year} 年法定节假日`}
        />

        <DetailSection icon={<CalendarOutlined />} title="年度配置">
          <DetailInfoGrid
            columns={2}
            items={[
              {
                label: '年度 *',
                value: isDetailMode ? (
                  formValue.year
                ) : (
                  <Input
                    value={String(formValue.year)}
                    onChange={(event) => {
                      const nextYear = Number.parseInt(event.target.value, 10);
                      if (Number.isFinite(nextYear)) {
                        updateFormValue('year', nextYear);
                      }
                    }}
                  />
                )
              },
              {
                label: '来源 *',
                value: isDetailMode ? (
                  formValue.source
                ) : (
                  <Input value={formValue.source} onChange={(event) => updateFormValue('source', event.target.value)} />
                )
              },
              { label: '休息日', value: `${restDayCount} 天` },
              { label: '工作日调整', value: `${workdayCount} 天` },
              { label: '当前修订', value: record ? `第 ${record.revisions?.length ?? 1} 版` : '保存后生成' }
            ]}
          />
          {!isDetailMode && validationError ? <div className="form-inline-warning">{validationError}</div> : null}
        </DetailSection>

        <DetailSection icon={<ClockCircleOutlined />} title="节假日安排">
          <Table<StatutoryHolidayGroupRow>
            className="annual-exception-table"
            columns={columns}
            dataSource={groupRows}
            pagination={false}
            rowKey="groupId"
            scroll={{ x: 920 }}
            size="middle"
            tableLayout="fixed"
          />
        </DetailSection>
      </DrawerFormShell>
    </>
  );
}

export function SystemWorkCalendarPage() {
  const { peopleRows } = usePeopleOrganizationState();
  const {
    annualExceptionRows,
    createAnnualExceptionConfig,
    createWorkCalendar,
    updateAnnualExceptionConfig,
    updateAnnualExceptionStatus,
    updateWorkCalendar,
    updateWorkCalendarStatus,
    workCalendarRows
  } = useWorkCalendarState();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState('work-calendar');
  const [statusFilter, setStatusFilter] = useState<'全部' | WorkCalendarStatus>('全部');
  const [typeFilter, setTypeFilter] = useState<'全部' | WorkCalendarType>('全部');
  const [keyword, setKeyword] = useState('');
  const calendarDrawer = useModeDrawerState<string, WorkCalendarFormValue>({
    createForm: () => buildWorkCalendarForm(),
    detailForm: (id) => buildWorkCalendarForm(workCalendarRows.find((row) => row.id === id))
  });
  const annualExceptionDrawer = useModeDrawerState<string, AnnualExceptionConfigFormValue>({
    createForm: () => buildAnnualExceptionForm(),
    detailForm: (id) => buildAnnualExceptionForm(annualExceptionRows.find((row) => row.id === id))
  });
  const activeCalendar = calendarDrawer.record
    ? workCalendarRows.find((row) => row.id === calendarDrawer.record)
    : undefined;
  const activeAnnualException = annualExceptionDrawer.record
    ? annualExceptionRows.find((row) => row.id === annualExceptionDrawer.record)
    : undefined;

  const enabledCount = workCalendarRows.filter((row) => row.status === '启用').length;
  const disabledCount = workCalendarRows.length - enabledCount;
  const defaultCount = workCalendarRows.filter((row) => row.isDefault).length;
  const typeCount = new Set(workCalendarRows.map((row) => row.type)).size;
  const annualExceptionSummary = getAnnualExceptionSummary(annualExceptionRows);
  const annualExceptionItems = annualExceptionRows
    .filter((row) => row.status === '已启用')
    .flatMap((row) => row.items);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return workCalendarRows.filter((row) => {
      const matchesStatus = statusFilter === '全部' || row.status === statusFilter;
      const matchesType = typeFilter === '全部' || row.type === typeFilter;
      const matchesKeyword =
        !normalizedKeyword ||
        [
          row.name,
          row.code,
          row.type,
          row.note,
          getWorkdaySummary(row),
          getCycleSummary(row),
          getCalendarScope(row)
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);

      return matchesStatus && matchesType && matchesKeyword;
    });
  }, [keyword, statusFilter, typeFilter, workCalendarRows]);

  function openCreateDrawer() {
    calendarDrawer.openCreate();
  }

  function openCreateAnnualExceptionDrawer() {
    annualExceptionDrawer.openCreate();
  }

  function openDetailDrawer(record: WorkCalendarRow) {
    calendarDrawer.openDetail(record.id);
  }

  function openAnnualExceptionDetailDrawer(record: AnnualExceptionConfigRow) {
    annualExceptionDrawer.openDetail(record.id);
  }

  function saveNewCalendar(nextValue: WorkCalendarFormValue) {
    createWorkCalendar(nextValue);
    calendarDrawer.close();
  }

  function saveNewAnnualException(nextValue: AnnualExceptionConfigFormValue) {
    createAnnualExceptionConfig(nextValue);
    annualExceptionDrawer.close();
  }

  function saveCalendar(id: string, nextValue: WorkCalendarFormValue) {
    updateWorkCalendar(id, nextValue);
    calendarDrawer.openDetail(id);
  }

  function saveAnnualException(id: string, nextValue: AnnualExceptionConfigFormValue) {
    updateAnnualExceptionConfig(id, nextValue);
    annualExceptionDrawer.openDetail(id);
  }

  function toggleCalendarStatus(record: WorkCalendarRow) {
    if (record.isDefault && record.status === '启用') {
      void messageApi.warning('默认工作日历不可停用');
      return;
    }

    const nextStatus: WorkCalendarStatus = record.status === '启用' ? '停用' : '启用';
    const activeMemberCount = peopleRows.filter(
      (member) => member.workCalendarId === record.id && isPeopleRelationshipActive(member)
    ).length;
    const result = updateWorkCalendarStatus(record.id, nextStatus, activeMemberCount);
    if (!result.success) {
      void messageApi.warning(result.message);
      return;
    }
    void messageApi.success(`${record.name}已${nextStatus}`);
  }

  function toggleAnnualExceptionStatus(record: AnnualExceptionConfigRow) {
    const nextStatus: AnnualExceptionStatus = record.status === '已启用' ? '草稿' : '已启用';
    updateAnnualExceptionStatus(record.id, nextStatus);
    void messageApi.success(`${record.year} 年法定节假日已${nextStatus === '已启用' ? '启用' : '停用'}`);
  }

  const columns: TableColumnsType<WorkCalendarRow> = [
    {
      title: '工作日历',
      key: 'calendar',
      width: 170,
      render: (_, record) => <CalendarCell record={record} />
    },
    {
      title: '工作制',
      dataIndex: 'type',
      width: 88,
      render: (type: WorkCalendarType) => <StatusTag toneMap={workCalendarTypeTone} value={type} />
    },
    {
      title: '工作日',
      key: 'workdays',
      width: 226,
      render: (_, record) => getWorkdaySummary(record)
    },
    {
      title: '周期规则',
      key: 'cycle',
      width: 178,
      render: (_, record) => getCycleSummary(record)
    },
    {
      title: '使用范围',
      key: 'scope',
      width: 100,
      render: (_, record) => <StatusTag tone={record.isDefault ? 'blue' : 'gray'} value={getCalendarScope(record)} />
    },
    {
      title: '法定节假日',
      key: 'holidayRules',
      width: 150,
      render: () => (
        <CompactCell
          align="center"
          primary="已配置"
          secondary={`${annualExceptionSummary.restDayCount} 休 / ${annualExceptionSummary.specialWorkdayCount} 调整`}
        />
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 78,
      render: (status: WorkCalendarStatus) => <StatusTag toneMap={workCalendarStatusTone} value={status} />
    },
    {
      title: '生效版本',
      key: 'effectiveVersion',
      width: 126,
      render: (_, record) => (
        <CompactCell
          align="center"
          primary={record.effectiveFrom ?? '-'}
          secondary={`V${record.versions?.length ?? 1}`}
        />
      )
    }
  ];

  const annualExceptionColumns: TableColumnsType<AnnualExceptionConfigRow> = [
    {
      title: '法定节假日',
      key: 'annualException',
      width: 190,
      render: (_, record) => <AnnualExceptionCell record={record} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 86,
      render: (status: AnnualExceptionStatus) => <StatusTag toneMap={annualExceptionStatusTone} value={status} />
    },
    {
      title: '全年分组',
      key: 'groups',
      width: 230,
      render: (_, record) => {
        const groupRows = getStatutoryHolidayGroupRows(record.items).filter((row) => row.restDates.length > 0);
        return <TagChipList items={groupRows.map((row) => row.groupName)} maxVisible={4} tone="blue" />;
      }
    },
    {
      title: '配置来源',
      dataIndex: 'source',
      width: 220
    },
    {
      title: '当前修订',
      key: 'revision',
      width: 128,
      render: (_, record) => (
        <CompactCell
          align="center"
          primary={`第 ${record.revisions?.length ?? 1} 版`}
          secondary={record.updatedAt}
        />
      )
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={6}>
          <MetricCard label="日历模板" value={workCalendarRows.length} icon={<CalendarOutlined />} />
          <MetricCard label="启用模板" value={enabledCount} icon={<CheckCircleOutlined />} />
          <MetricCard label="停用模板" value={disabledCount} icon={<StopOutlined />} />
          <MetricCard label="默认日历" value={defaultCount} icon={<ProfileOutlined />} />
          <MetricCard label="工作制" value={typeCount} icon={<ClockCircleOutlined />} />
          <MetricCard label="法定日期" value={annualExceptionSummary.restDayCount + annualExceptionSummary.specialWorkdayCount} icon={<CalendarOutlined />} />
        </MetricGrid>
      }
      filters={
        activeTab === 'work-calendar' ? (
        <FilterPanel>
          <FilterBar>
            <FilterField as="div" label="状态">
              <Select
                options={['全部', '启用', '停用'].map((status) => ({ label: status, value: status }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </FilterField>
            <FilterField as="div" label="工作制">
              <Select
                options={['全部', ...workCalendarTypes].map((type) => ({ label: type, value: type }))}
                value={typeFilter}
                onChange={setTypeFilter}
              />
            </FilterField>
            <KeywordFilter as="div" placeholder="名称 / 编码 / 工作制" value={keyword} width="wide" onChange={setKeyword} />
          </FilterBar>
        </FilterPanel>
        ) : undefined
      }
    >
      <TabbedManagementTable
        activeKey={activeTab}
        tabs={[
          createTabbedManagementTableItem<WorkCalendarRow>({
            key: 'work-calendar',
            label: '工作日历',
            table: {
              columns,
              count: { value: filteredRows.length, unit: '个工作日历' },
              dataSource: filteredRows,
              primaryAction: { icon: <PlusOutlined />, label: '新增工作日历', onClick: openCreateDrawer },
              rowTestIdPrefix: 'system-work-calendar-table-row',
              rowKey: 'id',
              tableTestId: 'system-work-calendar-table',
              onRowClick: openDetailDrawer
            }
          }),
          createTabbedManagementTableItem<AnnualExceptionConfigRow>({
            key: 'statutory-holidays',
            label: '法定节假日',
            table: {
              columns: annualExceptionColumns,
              count: { value: annualExceptionRows.length, unit: '个年度配置' },
              dataSource: annualExceptionRows,
              primaryAction: { icon: <PlusOutlined />, label: '新增法定节假日', onClick: openCreateAnnualExceptionDrawer },
              rowTestIdPrefix: 'system-statutory-holiday-table-row',
              rowKey: 'id',
              tableTestId: 'system-statutory-holiday-table',
              onRowClick: openAnnualExceptionDetailDrawer
            }
          })
        ]}
        tabTestIdPrefix="system-work-calendar-tab"
        testId="system-work-calendar-tabs"
        onChange={setActiveTab}
      />
      <WorkCalendarDrawer
        annualExceptionItems={annualExceptionItems}
        annualExceptionSummary={annualExceptionSummary}
        drawer={calendarDrawer}
        existingRows={workCalendarRows}
        record={activeCalendar}
        onCreate={saveNewCalendar}
        onSave={saveCalendar}
        onToggleStatus={toggleCalendarStatus}
      />
      <AnnualExceptionDrawer
        drawer={annualExceptionDrawer}
        existingRows={annualExceptionRows}
        record={activeAnnualException}
        onCreate={saveNewAnnualException}
        onSave={saveAnnualException}
        onToggleStatus={toggleAnnualExceptionStatus}
      />
    </ManagementPageScaffold>
  );
}
