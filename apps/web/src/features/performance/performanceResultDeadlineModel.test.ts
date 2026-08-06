import type { PeopleMember } from '../people/peopleTypes';
import {
  defaultWorkCalendarId,
  type AnnualExceptionItem,
  type AnnualExceptionConfigRow,
  type WorkCalendarRow
} from '../system/WorkCalendarState';
import { buildPerformanceResponseDeadline } from './performanceResultDeadlineModel';

type UnitTest = { name: string; run: () => void };
type UnitTestResult = { failures: string[]; passed: number; total: number };

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const weekdayCalendar: WorkCalendarRow = {
  alternateWorkdays: [],
  code: 'CAL-DEADLINE-001',
  fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
  id: 'calendar-deadline-weekday',
  isDefault: true,
  name: '双休工作日历',
  note: '',
  status: '启用',
  type: '双休',
  updatedAt: '2026-06-01'
};

const member = {
  id: '20269999',
  name: '绩效反馈测试人员',
  personnelType: '全职',
  position: '空间设计师',
  status: '在职',
  workCalendarId: weekdayCalendar.id
} as PeopleMember;

const defaultCalendar: WorkCalendarRow = {
  ...weekdayCalendar,
  code: 'CAL-DEFAULT-001',
  fixedWorkdays: ['周一'],
  id: defaultWorkCalendarId,
  name: '公司默认工作日历'
};

function exceptionRows(items: AnnualExceptionItem[]): AnnualExceptionConfigRow[] {
  return [
    {
      code: 'EX-2026',
      currentRevisionId: 'exception-2026-r1',
      id: 'exception-2026',
      revisions: [
        {
          createdAt: '2026-01-01',
          createdBy: '测试人员',
          effectiveFrom: '2026-01-01',
          id: 'exception-2026-r1',
          items,
          revision: 1,
          source: '测试年度配置'
        }
      ],
      status: '已启用',
      updatedAt: '2026-01-01',
      updatedBy: '测试人员',
      year: 2026
    }
  ];
}

const tests: UnitTest[] = [
  {
    name: 'response deadline starts on the next day and skips a normal weekend',
    run() {
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: [],
        deliveredAt: '2026-06-19 10:00:00',
        member,
        workCalendarRows: [weekdayCalendar]
      });

      assertEqual(result?.workingDates.join(','), '2026-06-22,2026-06-23,2026-06-24', 'weekend should not consume response days');
      assertEqual(result?.deadlineAt, '2026-06-24 23:59:59', 'third working day should end the response window');
    }
  },
  {
    name: 'response deadline skips statutory rest days',
    run() {
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: exceptionRows([
          { date: '2026-06-16', groupId: 'dragon-boat', groupName: '端午节', id: 'rest-16', name: '端午休息', note: '', type: '休息日' },
          { date: '2026-06-17', groupId: 'dragon-boat', groupName: '端午节', id: 'rest-17', name: '端午休息', note: '', type: '休息日' },
          { date: '2026-06-18', groupId: 'dragon-boat', groupName: '端午节', id: 'rest-18', name: '端午休息', note: '', type: '休息日' }
        ]),
        deliveredAt: '2026-06-15 09:00:00',
        member,
        workCalendarRows: [weekdayCalendar]
      });

      assertEqual(result?.workingDates.join(','), '2026-06-19,2026-06-22,2026-06-23', 'statutory rest days should be skipped');
      assertEqual(result?.calendarSnapshot.exceptionItems.length, 3, 'deadline should preserve the applied exception snapshot');
    }
  },
  {
    name: 'response deadline counts a weekend makeup workday',
    run() {
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: exceptionRows([
          { date: '2026-06-20', groupId: 'dragon-boat', groupName: '端午节', id: 'work-20', name: '端午调休补班', note: '', type: '特殊工作日' }
        ]),
        deliveredAt: '2026-06-19 16:00:00',
        member,
        workCalendarRows: [weekdayCalendar]
      });

      assertEqual(result?.workingDates.join(','), '2026-06-20,2026-06-22,2026-06-23', 'makeup workday should consume one response day');
    }
  },
  {
    name: 'response deadline prefers the employee calendar over the company default',
    run() {
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: [],
        deliveredAt: '2026-06-19 10:00:00',
        member,
        workCalendarRows: [defaultCalendar, weekdayCalendar]
      });

      assertEqual(result?.calendarSnapshot.id, weekdayCalendar.id, 'employee calendar should take precedence');
      assertEqual(result?.workingDates.join(','), '2026-06-22,2026-06-23,2026-06-24', 'employee workdays should drive the deadline');
    }
  },
  {
    name: 'response deadline uses the company default only when the employee follows the default calendar',
    run() {
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: [],
        deliveredAt: '2026-06-19 10:00:00',
        member: { ...member, workCalendarId: undefined },
        workCalendarRows: [defaultCalendar]
      });

      assertEqual(result?.calendarSnapshot.id, defaultWorkCalendarId, 'default-mode employee should use the company default calendar');
      assertEqual(result?.workingDates.join(','), '2026-06-22,2026-06-29,2026-07-06', 'default calendar workdays should drive the fallback deadline');
    }
  },
  {
    name: 'response deadline blocks when no active calendar exists',
    run() {
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: [],
        deliveredAt: '2026-06-19 10:00:00',
        member: { ...member, workCalendarId: 'calendar-missing' },
        workCalendarRows: [defaultCalendar, weekdayCalendar]
      });

      assertEqual(result, undefined, 'missing explicitly assigned calendar should not fall back to the company default');
    }
  },
  {
    name: 'response deadline preserves historical availability and applied rule versions',
    run() {
      const versionedCalendar: WorkCalendarRow = {
        ...weekdayCalendar,
        currentVersionId: 'deadline-rule-v2',
        fixedWorkdays: ['周二', '周三', '周四', '周五', '周六'],
        status: '停用',
        statusPeriods: [
          { effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', status: '启用' },
          { effectiveFrom: '2026-07-01', status: '停用' }
        ],
        versions: [
          {
            alternateWorkdays: [],
            createdAt: '2026-01-01',
            effectiveFrom: '2026-01-01',
            effectiveTo: '2026-06-30',
            fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
            id: 'deadline-rule-v1',
            note: '',
            type: '双休',
            version: 1
          },
          {
            alternateWorkdays: [],
            createdAt: '2026-07-01',
            effectiveFrom: '2026-07-01',
            fixedWorkdays: ['周二', '周三', '周四', '周五', '周六'],
            id: 'deadline-rule-v2',
            note: '',
            type: '自定义',
            version: 2
          }
        ]
      };
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: [],
        deliveredAt: '2026-06-19 10:00:00',
        member: { ...member, workCalendarId: versionedCalendar.id },
        workCalendarRows: [versionedCalendar]
      });

      assertEqual(result?.workingDates.join(','), '2026-06-22,2026-06-23,2026-06-24', 'historical delivery should use the then-active calendar');
      assertEqual(result?.calendarSnapshot.fixedWorkdays.includes('周一'), true, 'snapshot should preserve the effective rule instead of current row fields');
      assertEqual(result?.calendarSnapshot.ruleVersionIds.join(','), 'deadline-rule-v1', 'snapshot should record the applied rule version');
    }
  },
  {
    name: 'response deadline resolves employee calendar changes for each response day',
    run() {
      const nextCalendar: WorkCalendarRow = {
        ...weekdayCalendar,
        code: 'CAL-DEADLINE-NEXT',
        fixedWorkdays: ['周四'],
        id: 'calendar-deadline-next',
        isDefault: false,
        name: '周四工作制'
      };
      const changingMember = {
        ...member,
        workCalendarAssignments: [
          {
            effectiveFrom: '2026-01-01',
            effectiveTo: '2026-06-30',
            id: 'deadline-assignment-old',
            mode: '指定工作日历',
            status: '已结束',
            workCalendarId: weekdayCalendar.id
          },
          {
            effectiveFrom: '2026-07-01',
            id: 'deadline-assignment-next',
            mode: '指定工作日历',
            status: '生效中',
            workCalendarId: nextCalendar.id
          }
        ]
      } as PeopleMember;
      const result = buildPerformanceResponseDeadline({
        annualExceptionRows: [],
        deliveredAt: '2026-06-29 10:00:00',
        member: changingMember,
        workCalendarRows: [weekdayCalendar, nextCalendar]
      });

      assertEqual(result?.workingDates.join(','), '2026-06-30,2026-07-02,2026-07-09', 'each response day should use the effective employee calendar');
      assertEqual(result?.calendarSnapshot.appliedCalendars?.length, 2, 'snapshot should identify every calendar used by the deadline');
    }
  }
];

export function runPerformanceResultDeadlineModelTests(): UnitTestResult {
  const failures: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { failures, passed, total: tests.length };
}
