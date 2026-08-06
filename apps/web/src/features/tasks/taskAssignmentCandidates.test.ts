import type { PeopleAttendanceRecord } from '../people/peopleDomain';
import { peopleMockRepository } from '../people/peopleRepository';
import type { PeopleMember } from '../people/peopleTypes';
import type { PerformanceMonthlyCategoryRecord } from '../performance/performanceTypes';
import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import type { StoreTaskRecord } from './TaskManagementState';
import { buildTaskExecutorCandidates } from './taskAssignmentCandidates';
import { addTaskWorkingHours } from './taskScheduling';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
  total: number;
};

type PeopleMemberOverrides = Partial<PeopleMember>;

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    fail(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const weekdayCalendar: WorkCalendarRow = {
  alternateWorkdays: [],
  anchorDate: '2026-06-15',
  code: 'CAL-TASK-TEST',
  fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
  id: 'calendar-task-weekday',
  isDefault: true,
  name: '任务测试双休',
  note: '',
  status: '启用',
  type: '双休',
  updatedAt: '2026-06-17'
};

const annualExceptionRows: AnnualExceptionConfigRow[] = [];
const storeTaskRows: StoreTaskRecord[] = [];

function createMember(overrides: PeopleMemberOverrides = {}): PeopleMember {
  const baseMember = peopleMockRepository.getInitialSnapshot().peopleRows[0];

  return {
    ...baseMember,
    id: 'member-task-001',
    name: '任务候选测试人员',
    personnelType: '全职',
    position: '空间设计师',
    status: '在职',
    taskAccessStatus: '可参与任务',
    workCalendarId: weekdayCalendar.id,
    ...overrides,
    taskCapabilityIds: overrides.taskCapabilityIds ?? ['task-type-floor-plan']
  };
}

function createAttendanceRecord(overrides: Partial<PeopleAttendanceRecord> = {}): PeopleAttendanceRecord {
  return {
    durationHours: 8,
    effect: '不可用',
    endAt: '2026-06-19 18:00',
    id: 'attendance-task-test',
    memberId: 'member-task-001',
    mode: '日常记录',
    reason: '测试',
    recordedAt: '2026-06-17',
    recorder: '测试人',
    startAt: '2026-06-19 10:00',
    status: '待生效',
    type: '请假',
    updatedAt: '2026-06-17',
    ...overrides
  };
}

function createPublishedPerformanceRecord(
  workNo: string,
  qualityScore: number,
  overrides: Partial<PerformanceMonthlyCategoryRecord> = {}
): PerformanceMonthlyCategoryRecord {
  return {
    category: '绘图任务制',
    employeeName: '任务候选测试人员',
    events: [],
    id: `published-performance:${workNo}:2026-06`,
    monthlyAmount: 1200,
    note: '按正式绩效结果生成。',
    performanceMonth: '2026-06',
    position: '空间设计师',
    prepayAmount: 600,
    qualityScore,
    ruleName: '设计绩效规则',
    ruleVersion: 'V1',
    salarySettlementReference: `performance-result:${workNo}:2026-06:v1`,
    sourceLabel: '正式绩效结果',
    sourceRecordIds: [`task-score:${workNo}:2026-06`],
    sourceTaskCount: 1,
    taskScore: qualityScore,
    updatedAt: '2026-06-28 18:00',
    workNo,
    ...overrides
  };
}

function getExecutorCandidate(
  member: PeopleMember,
  attendanceRecords: PeopleAttendanceRecord[],
  window: { endAt: string; startAt: string },
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[] = [],
  plannedDurationHours?: number
) {
  const [candidate] = buildTaskExecutorCandidates({
    annualExceptionRows,
    attendanceRecords,
    peopleRows: [member],
    plannedDurationHours,
    publishedPerformanceRecords,
    storeTaskRows,
    taskConfigId: 'task-type-floor-plan',
    window,
    workCalendarRows: [weekdayCalendar]
  });

  assert(candidate, 'candidate should be generated');
  return candidate;
}

const tests: UnitTest[] = [
  {
    name: 'keeps cross-rest-day full-time candidates selectable with a soft warning',
    run: () => {
      const candidate = getExecutorCandidate(createMember(), [], {
        endAt: '2026-06-22 18:00',
        startAt: '2026-06-19 10:00'
      });

      assertEqual(candidate.selectable, true, 'cross-rest-day candidate should remain selectable');
      assert(candidate.blockers.length === 0, 'cross-rest-day candidate should not have hard blockers');
      assert(candidate.reasons.includes('周期含 2 天休息'), 'cross-rest-day candidate should expose a soft rest-day warning');
    }
  },
  {
    name: 'ignores unavailable records that only cover normal rest days',
    run: () => {
      const candidate = getExecutorCandidate(createMember(), [createAttendanceRecord({ endAt: '2026-06-20 18:00', startAt: '2026-06-20 10:00' })], {
        endAt: '2026-06-22 18:00',
        startAt: '2026-06-19 10:00'
      });

      assertEqual(candidate.selectable, true, 'rest-day leave should not hard block assignment');
      assert(candidate.blockers.length === 0, 'rest-day leave should not create blockers');
    }
  },
  {
    name: 'keeps candidates selectable when leave covers working time and exposes a warning',
    run: () => {
      const candidate = getExecutorCandidate(createMember(), [createAttendanceRecord()], {
        endAt: '2026-06-19 18:00',
        startAt: '2026-06-19 10:00'
      });

      assertEqual(candidate.selectable, true, 'working-time leave should remain a scheduling warning');
      assert(candidate.reasons.includes('请假覆盖工作时段'), 'working-time leave should explain the warning');
    }
  },
  {
    name: 'keeps all-rest-day candidates selectable with a self-arrangement warning',
    run: () => {
      const candidate = getExecutorCandidate(createMember(), [], {
        endAt: '2026-06-21 18:00',
        startAt: '2026-06-20 10:00'
      });

      assertEqual(candidate.selectable, true, 'all-rest-day window should remain selectable');
      assert(candidate.reasons.includes('任务周期内无日历可用工时，请自行安排'), 'all-rest-day window should explain the warning');
    }
  },
  {
    name: 'warns when member calendar capacity is below the fixed task plan without changing selectability',
    run: () => {
      const candidate = getExecutorCandidate(createMember(), [], {
        endAt: '2026-06-19 18:00',
        startAt: '2026-06-16 10:00'
      }, [], 40);

      assertEqual(candidate.selectable, true, 'capacity shortage must not block employee self-arrangement');
      assert(candidate.reasons.includes('日历可用约 32 小时，低于任务计划 40 小时'), 'capacity warning should show both values');
    }
  },
  {
    name: 'does not apply time-window checks to part-time executor candidates',
    run: () => {
      const member = createMember({
        personnelType: '兼职',
        position: '外协设计师',
        status: '合作中',
        taskCapabilityIds: ['task-type-floor-plan'],
        workCalendarId: undefined
      });
      const candidate = getExecutorCandidate(member, [createAttendanceRecord({ memberId: member.id })], {
        endAt: '2026-06-19 18:00',
        startAt: '2026-06-19 10:00'
      });

      assertEqual(candidate.selectable, true, 'part-time candidate should ignore time-window records');
      assert(candidate.blockers.length === 0, 'part-time candidate should have no time blockers');
    }
  },
  {
    name: 'blocks a task planned before the full-time member join date',
    run: () => {
      const candidate = getExecutorCandidate(createMember({ joinedAt: '2026-06-20' }), [], {
        endAt: '2026-06-19 18:00',
        startAt: '2026-06-19 10:00'
      });

      assertEqual(candidate.selectable, false, 'pre-employment task should not be selectable');
      assert(candidate.blockers.includes('任务开始早于入职日期'), 'pre-employment task should explain the relationship blocker');
    }
  },
  {
    name: 'blocks a part-time task planned after the cooperation end date',
    run: () => {
      const member = createMember({
        cooperationEndAt: '2026-06-18',
        cooperationStartAt: '2026-06-01',
        personnelType: '兼职',
        position: '外协设计师',
        positionAssignments: [{
          effectiveFrom: '2026-06-01',
          id: 'assignment-external-test',
          isPrimary: true,
          positionId: 'position-external-designer',
          positionName: '外协设计师',
          status: '生效中'
        }],
        status: '合作中',
        workCalendarId: undefined
      });
      const candidate = getExecutorCandidate(member, [], {
        endAt: '2026-06-19 18:00',
        startAt: '2026-06-19 10:00'
      });

      assertEqual(candidate.selectable, false, 'post-cooperation task should not be selectable');
      assert(candidate.blockers.includes('任务结束晚于合作截止日期'), 'post-cooperation task should explain the relationship blocker');
    }
  },
  {
    name: 'PF-29 candidate ranking consumes the published performance result',
    run: () => {
      const member = createMember();
      const candidate = getExecutorCandidate(
        member,
        [],
        {
          endAt: '2026-06-19 18:00',
          startAt: '2026-06-19 10:00'
        },
        [createPublishedPerformanceRecord(member.id, 75)]
      );

      assertEqual(candidate.performanceScore, 75, 'published performance should be the candidate score');
      assert(candidate.reasons.includes('绩效偏低：75 分'), 'published low score should create a soft warning');
      assertEqual(candidate.selectable, true, 'performance should remain a recommendation signal, not a blocker');
    }
  },
  {
    name: 'PF-29 candidate ranking ignores a disputed performance result',
    run: () => {
      const member = createMember();
      const candidate = getExecutorCandidate(
        member,
        [],
        {
          endAt: '2026-06-19 18:00',
          startAt: '2026-06-19 10:00'
        },
        [createPublishedPerformanceRecord(member.id, 55, { resultResponseStatus: '有异议' })]
      );

      assertEqual(candidate.performanceScore, null, 'disputed performance should not become a candidate score');
      assert(
        !candidate.reasons.some((reason) => reason.includes('绩效偏低')),
        'disputed performance should not create a low-score warning'
      );
      assertEqual(candidate.selectable, true, 'disputed performance should not become an assignment blocker');
    }
  },
  {
    name: 'work calendar status is resolved at the task schedule start date',
    run: () => {
      const calendar: WorkCalendarRow = {
        ...weekdayCalendar,
        status: '停用',
        statusPeriods: [
          { effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', status: '启用' },
          { effectiveFrom: '2026-07-01', status: '停用' }
        ]
      };

      assertEqual(
        addTaskWorkingHours('2026-06-19 10:00', 8, [calendar], []),
        '2026-06-19 18:00',
        'a later calendar stop must not erase a historical task schedule'
      );
      assertEqual(
        addTaskWorkingHours('2026-07-01 10:00', 8, [calendar], []),
        '',
        'a task starting after the stop date must not use the calendar'
      );
    }
  },
  {
    name: 'task scheduling resolves the effective company default on every workday',
    run: () => {
      const oldDefault: WorkCalendarRow = {
        ...weekdayCalendar,
        defaultPeriods: [{ effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' }]
      };
      const nextDefault: WorkCalendarRow = {
        ...weekdayCalendar,
        code: 'CAL-TASK-NEXT',
        defaultPeriods: [{ effectiveFrom: '2026-07-01' }],
        fixedWorkdays: ['周四'],
        id: 'calendar-task-next',
        isDefault: false,
        name: '周四工作制'
      };

      assertEqual(
        addTaskWorkingHours('2026-06-30 10:00', 16, [oldDefault, nextDefault], []),
        '2026-07-02 18:00',
        'remaining hours should follow the new default after its effective date'
      );
    }
  }
];

export function runTaskAssignmentCandidateTests(): UnitTestResult {
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

  return {
    failures,
    passed,
    total: tests.length
  };
}
