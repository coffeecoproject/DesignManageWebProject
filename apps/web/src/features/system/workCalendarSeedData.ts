import { frontendBusinessToday } from '../../app/frontendBusinessClock';
import {
  statutoryHolidayGroups,
  type AnnualExceptionConfigRow,
  type AnnualExceptionItem,
  type AnnualExceptionType,
  type StatutoryHolidayGroupId,
  type WorkCalendarRow,
  type WorkCalendarWeekday
} from './workCalendarTypes';

export const defaultDoubleWeekendWorkdays: WorkCalendarWeekday[] = ['周一', '周二', '周三', '周四', '周五'];
export const defaultSingleWeekendWorkdays: WorkCalendarWeekday[] = ['周一', '周二', '周三', '周四', '周五', '周六'];
export const defaultBigSmallFixedWorkdays: WorkCalendarWeekday[] = ['周一', '周二', '周三', '周四', '周五'];
export const defaultBigSmallAlternateWorkdays: WorkCalendarWeekday[] = ['周六'];
export const defaultWorkCalendarId = 'calendar-big-small-week';
export const companyDefaultWorkCalendarValue = '__company-default-work-calendar__';
export const workCalendarBaselineEffectiveFrom = '2025-01-01';

function createStatutoryHolidayItem(
  sequence: number,
  groupId: StatutoryHolidayGroupId,
  date: string,
  type: AnnualExceptionType
): AnnualExceptionItem {
  const group = statutoryHolidayGroups.find((candidate) => candidate.id === groupId) ?? statutoryHolidayGroups[0];
  const suffix = String(sequence).padStart(3, '0');

  return {
    date,
    groupId: group.id,
    groupName: group.name,
    id: `annual-2026-${suffix}`,
    name: type === '休息日' ? group.name : `${group.name}工作日调整`,
    note: '',
    type
  };
}

export const statutoryHolidayItems2026: AnnualExceptionItem[] = [
  createStatutoryHolidayItem(1, 'new-year', '2026-01-01', '休息日'),
  createStatutoryHolidayItem(2, 'new-year', '2026-01-02', '休息日'),
  createStatutoryHolidayItem(3, 'new-year', '2026-01-03', '休息日'),
  createStatutoryHolidayItem(4, 'new-year', '2026-01-04', '特殊工作日'),
  createStatutoryHolidayItem(5, 'spring-festival', '2026-02-14', '特殊工作日'),
  createStatutoryHolidayItem(6, 'spring-festival', '2026-02-15', '休息日'),
  createStatutoryHolidayItem(7, 'spring-festival', '2026-02-16', '休息日'),
  createStatutoryHolidayItem(8, 'spring-festival', '2026-02-17', '休息日'),
  createStatutoryHolidayItem(9, 'spring-festival', '2026-02-18', '休息日'),
  createStatutoryHolidayItem(10, 'spring-festival', '2026-02-19', '休息日'),
  createStatutoryHolidayItem(11, 'spring-festival', '2026-02-20', '休息日'),
  createStatutoryHolidayItem(12, 'spring-festival', '2026-02-21', '休息日'),
  createStatutoryHolidayItem(13, 'spring-festival', '2026-02-22', '休息日'),
  createStatutoryHolidayItem(14, 'spring-festival', '2026-02-23', '休息日'),
  createStatutoryHolidayItem(15, 'spring-festival', '2026-02-28', '特殊工作日'),
  createStatutoryHolidayItem(16, 'qingming', '2026-04-04', '休息日'),
  createStatutoryHolidayItem(17, 'qingming', '2026-04-05', '休息日'),
  createStatutoryHolidayItem(18, 'qingming', '2026-04-06', '休息日'),
  createStatutoryHolidayItem(19, 'labor-day', '2026-05-01', '休息日'),
  createStatutoryHolidayItem(20, 'labor-day', '2026-05-02', '休息日'),
  createStatutoryHolidayItem(21, 'labor-day', '2026-05-03', '休息日'),
  createStatutoryHolidayItem(22, 'labor-day', '2026-05-04', '休息日'),
  createStatutoryHolidayItem(23, 'labor-day', '2026-05-05', '休息日'),
  createStatutoryHolidayItem(24, 'labor-day', '2026-05-09', '特殊工作日'),
  createStatutoryHolidayItem(25, 'dragon-boat', '2026-06-19', '休息日'),
  createStatutoryHolidayItem(26, 'dragon-boat', '2026-06-20', '休息日'),
  createStatutoryHolidayItem(27, 'dragon-boat', '2026-06-21', '休息日'),
  createStatutoryHolidayItem(28, 'national-mid-autumn', '2026-09-20', '特殊工作日'),
  createStatutoryHolidayItem(29, 'national-mid-autumn', '2026-09-25', '休息日'),
  createStatutoryHolidayItem(30, 'national-mid-autumn', '2026-09-26', '休息日'),
  createStatutoryHolidayItem(31, 'national-mid-autumn', '2026-09-27', '休息日'),
  createStatutoryHolidayItem(32, 'national-mid-autumn', '2026-10-01', '休息日'),
  createStatutoryHolidayItem(33, 'national-mid-autumn', '2026-10-02', '休息日'),
  createStatutoryHolidayItem(34, 'national-mid-autumn', '2026-10-03', '休息日'),
  createStatutoryHolidayItem(35, 'national-mid-autumn', '2026-10-04', '休息日'),
  createStatutoryHolidayItem(36, 'national-mid-autumn', '2026-10-05', '休息日'),
  createStatutoryHolidayItem(37, 'national-mid-autumn', '2026-10-06', '休息日'),
  createStatutoryHolidayItem(38, 'national-mid-autumn', '2026-10-07', '休息日'),
  createStatutoryHolidayItem(39, 'national-mid-autumn', '2026-10-10', '特殊工作日')
];

export const seedAnnualExceptionRows: AnnualExceptionConfigRow[] = [
  {
    code: 'EXC-2026-001',
    currentRevisionId: 'annual-exception-2026-r1',
    id: 'annual-exception-2026',
    revisions: [{
      createdAt: frontendBusinessToday,
      createdBy: '李明',
      effectiveFrom: '2026-01-01',
      id: 'annual-exception-2026-r1',
      items: statutoryHolidayItems2026,
      revision: 1,
      source: '国务院办公厅通知 / 前端全年配置'
    }],
    status: '已启用',
    statusPeriods: [{ effectiveFrom: '2026-01-01', status: '已启用' }],
    updatedAt: frontendBusinessToday,
    updatedBy: '李明',
    year: 2026
  }
];

export const seedWorkCalendarRows: WorkCalendarRow[] = [
  {
    alternateWorkdays: [],
    code: 'CAL-2026-001',
    currentVersionId: 'calendar-default-double-weekend-v1',
    effectiveFrom: '2026-01-01',
    fixedWorkdays: defaultDoubleWeekendWorkdays,
    id: 'calendar-default-double-weekend',
    isDefault: false,
    name: '双休工作制',
    note: '适用于周末双休人员或阶段性任务安排。',
    status: '启用',
    type: '双休',
    updatedAt: frontendBusinessToday,
    versions: [{
      alternateWorkdays: [],
      createdAt: frontendBusinessToday,
      effectiveFrom: '2026-01-01',
      fixedWorkdays: defaultDoubleWeekendWorkdays,
      id: 'calendar-default-double-weekend-v1',
      note: '适用于周末双休人员或阶段性任务安排。',
      type: '双休',
      version: 1
    }]
  },
  {
    alternateWorkdays: [],
    code: 'CAL-2026-002',
    currentVersionId: 'calendar-single-weekend-v1',
    effectiveFrom: '2026-01-01',
    fixedWorkdays: defaultSingleWeekendWorkdays,
    id: 'calendar-single-weekend',
    isDefault: false,
    name: '单休工作制',
    note: '适用于周六正常工作的人员或阶段性任务安排。',
    status: '启用',
    type: '单休',
    updatedAt: frontendBusinessToday,
    versions: [{
      alternateWorkdays: [],
      createdAt: frontendBusinessToday,
      effectiveFrom: '2026-01-01',
      fixedWorkdays: defaultSingleWeekendWorkdays,
      id: 'calendar-single-weekend-v1',
      note: '适用于周六正常工作的人员或阶段性任务安排。',
      type: '单休',
      version: 1
    }]
  },
  {
    alternateWorkdays: defaultBigSmallAlternateWorkdays,
    anchorDate: '2026-06-01',
    code: 'CAL-2026-003',
    currentVersionId: 'calendar-big-small-week-v1',
    defaultPeriods: [{ effectiveFrom: workCalendarBaselineEffectiveFrom }],
    effectiveFrom: workCalendarBaselineEffectiveFrom,
    fixedWorkdays: defaultBigSmallFixedWorkdays,
    id: defaultWorkCalendarId,
    isDefault: true,
    name: '公司默认大小周',
    note: '默认适用于未单独指定工作日历的人员，以基准周开始交替计算周六是否工作。',
    startMode: '单休周开始',
    status: '启用',
    type: '大小周',
    updatedAt: frontendBusinessToday,
    versions: [{
      alternateWorkdays: defaultBigSmallAlternateWorkdays,
      anchorDate: '2026-06-01',
      createdAt: frontendBusinessToday,
      effectiveFrom: workCalendarBaselineEffectiveFrom,
      fixedWorkdays: defaultBigSmallFixedWorkdays,
      id: 'calendar-big-small-week-v1',
      note: '默认适用于未单独指定工作日历的人员，以基准周开始交替计算周六是否工作。',
      startMode: '单休周开始',
      type: '大小周',
      version: 1
    }]
  }
];
