import type { PeopleAttendanceRecord } from '../people/peopleDomain';
import { peopleMockRepository } from '../people/peopleRepository';
import type { PeopleMember } from '../people/peopleTypes';
import type { PerformanceMonthlyCategoryRecord } from '../performance/performanceTypes';
import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import type { StoreTaskRecord } from './TaskManagementState';
import { buildTaskExecutorCandidates } from './taskAssignmentCandidates';

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
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[] = []
) {
  const [candidate] = buildTaskExecutorCandidates({
    annualExceptionRows,
    attendanceRecords,
    peopleRows: [member],
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
    name: 'blocks full-time candidates when unavailable records cover working time',
    run: () => {
      const candidate = getExecutorCandidate(createMember(), [createAttendanceRecord()], {
        endAt: '2026-06-19 18:00',
        startAt: '2026-06-19 10:00'
      });

      assertEqual(candidate.selectable, false, 'working-time leave should hard block assignment');
      assert(candidate.blockers.includes('请假覆盖工作时段'), 'working-time leave should explain the blocker');
    }
  },
  {
    name: 'blocks full-time candidates when the whole task window has no usable working time',
    run: () => {
      const candidate = getExecutorCandidate(createMember(), [], {
        endAt: '2026-06-21 18:00',
        startAt: '2026-06-20 10:00'
      });

      assertEqual(candidate.selectable, false, 'all-rest-day window should hard block assignment');
      assert(candidate.blockers.includes('任务周期无可用工作时间'), 'all-rest-day window should explain the blocker');
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
