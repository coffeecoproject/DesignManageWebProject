import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import { performanceRulePresets } from '../performance/performanceMockData';
import {
  applyPeopleMovementEffect,
  createPeopleMovementSnapshot,
  getPeopleArchiveListStatus,
  getPeopleAttendanceDurationHours,
  getPeopleAttendanceEffect,
  getPeopleAttendanceStatus,
  getPeopleBaseSalaryText,
  getPeopleHousingFundStatus,
  getPeopleOngoingTaskCount,
  getPeopleOverviewAvailabilitySummary,
  getPeopleTaskAccessStatusFromArchive,
  isPeopleHousingFundContributionApplicable,
  isPeopleHousingFundContributionEnabled,
  getPositionRowsWithMemberCount,
  inferCreatePeopleStatus,
  inferPeopleSalaryMode,
  isPeopleMovementSnapshotEqual,
  normalizePeopleText,
  normalizeTaskCapabilityIds,
  restorePeopleMovementSnapshot,
  toPositionManagementRecord,
  type PeopleAttendanceRecord,
  type PositionManagementRecord,
  type PositionManagementRow
} from './peopleDomain';
import { getPeoplePerformanceRuleRiskLabels, peoplePerformanceTerminationRiskLabel } from './peoplePerformanceRiskModel';
import { peopleMockRepository } from './peopleRepository';
import type { PeopleMember } from './peopleTypes';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
  total: number;
};

type PeopleMemberOverrides = Omit<Partial<PeopleMember>, 'paymentProfile' | 'salaryProfile' | 'workEvaluationSummary'> & {
  paymentProfile?: Partial<PeopleMember['paymentProfile']>;
  salaryProfile?: Partial<PeopleMember['salaryProfile']>;
  workEvaluationSummary?: Partial<PeopleMember['workEvaluationSummary']>;
};

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

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    fail(`${message}. Expected ${expectedJson}, received ${actualJson}`);
  }
}

const weekdayCalendar: WorkCalendarRow = {
  alternateWorkdays: [],
  anchorDate: '2026-06-15',
  code: 'CAL-TEST-001',
  fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
  id: 'calendar-test-weekday',
  isDefault: true,
  name: '测试双休',
  note: '',
  status: '启用',
  type: '双休',
  updatedAt: '2026-06-17'
};

const annualExceptions: AnnualExceptionConfigRow[] = [
  {
    code: 'YEAR-2026',
    id: 'annual-2026',
    items: [
      {
        date: '2026-06-17',
        groupId: 'new-year',
        groupName: '测试节假日',
        id: 'annual-rest',
        name: '测试休息日',
        note: '',
        type: '休息日'
      },
      {
        date: '2026-06-21',
        groupId: 'new-year',
        groupName: '测试节假日',
        id: 'annual-workday',
        name: '测试特殊工作日',
        note: '',
        type: '特殊工作日'
      }
    ],
    source: '测试',
    status: '已启用',
    updatedAt: '2026-06-17',
    updatedBy: '测试人',
    year: 2026
  }
];

function createMember(overrides: PeopleMemberOverrides = {}): PeopleMember {
  const baseMember: PeopleMember = {
    address: '武汉市洪山区',
    archiveFiles: [
      {
        category: '身份资料',
        id: 'file-id-card',
        name: '身份证',
        status: '已上传',
        updatedAt: '2026-06-01'
      }
    ],
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-06-15',
    auditRecords: [],
    birthDate: '1992-01-01',
    city: '武汉',
    contractNo: 'HT-TEST-001',
    contractStartAt: '2026-06-01',
    contractStatus: '试用合同',
    contractType: '劳动合同',
    education: '本科',
    educationMajor: '设计',
    email: 'test@example.com',
    emergencyContact: '测试联系人',
    emergencyContactPhone: '13800000000',
    emergencyContactRelation: '家属',
    gender: '女',
    graduatedAt: '2014-06',
    graduationSchool: '武汉大学',
    hukouAddress: '湖北武汉',
    id: 'member-001',
    idDocumentType: '身份证',
    idValidUntil: '2036-01-01',
    identityNo: '420000199201010000',
    joinedAt: '2026-06-01',
    mobile: '13800000001',
    name: '测试人员',
    nationality: '中国',
    housingFundEffectiveMonth: '2026-06',
    housingFundStatus: '缴存',
    paymentProfile: {
      accountName: '测试人员',
      bankAccount: '6222000000000000000',
      bankName: '招商银行',
      mode: '工资发放',
      payCycle: '每月'
    },
    personnelType: '全职',
    position: '设计师',
    probationEndAt: '2026-09-01',
    salaryProfile: {
      effectiveAt: '2026-06-01',
      note: '',
      payCycle: '每月',
      probationSalary: '8000',
      regularSalary: '10000',
      status: '已配置',
      structure: '固定月薪'
    },
    source: '社招',
    status: '试用期',
    taskAccessStatus: '可参与任务',
    taskCapabilityIds: ['design'],
    taskRecords: [],
    wechat: 'test-wechat',
    workCalendarId: weekdayCalendar.id,
    workEvaluationRecords: [],
    workEvaluationSummary: {
      acceptedTasks: 0,
      level: 'A',
      month: '2026-06',
      reworkTasks: 0,
      score: 90
    }
  };

  return {
    ...baseMember,
    ...overrides,
    archiveFiles: overrides.archiveFiles ?? baseMember.archiveFiles.map((file) => ({ ...file })),
    auditRecords: overrides.auditRecords ?? baseMember.auditRecords.map((record) => ({ ...record })),
    paymentProfile: {
      ...baseMember.paymentProfile,
      ...overrides.paymentProfile
    },
    salaryProfile: {
      ...baseMember.salaryProfile,
      ...overrides.salaryProfile
    },
    taskCapabilityIds: overrides.taskCapabilityIds ?? [...baseMember.taskCapabilityIds],
    taskRecords: overrides.taskRecords ?? baseMember.taskRecords.map((record) => ({ ...record })),
    workEvaluationRecords: overrides.workEvaluationRecords ?? baseMember.workEvaluationRecords.map((record) => ({ ...record })),
    workEvaluationSummary: {
      ...baseMember.workEvaluationSummary,
      ...overrides.workEvaluationSummary
    }
  };
}

function createAttendanceRecord(overrides: Partial<PeopleAttendanceRecord> = {}): PeopleAttendanceRecord {
  return {
    durationHours: 8,
    effect: '不可用',
    endAt: '2026-06-17 18:00',
    id: 'attendance-001',
    memberId: 'member-001',
    mode: '日常记录',
    reason: '测试',
    recordedAt: '2026-06-16 10:00',
    recorder: '测试人',
    startAt: '2026-06-17 09:00',
    status: '生效中',
    type: '请假',
    updatedAt: '2026-06-16 10:00',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'normalizes create defaults and task access status',
    run: () => {
      assertEqual(normalizePeopleText('  李明  '), '李明', 'text should be trimmed');
      assertDeepEqual(normalizeTaskCapabilityIds(['task-b', 'task-a', 'task-b']), ['task-a', 'task-b'], 'task capabilities should be deduplicated and sorted');
      assertEqual(inferCreatePeopleStatus('全职'), '试用期', 'full-time create status should default to probation');
      assertEqual(inferCreatePeopleStatus('兼职'), '合作中', 'part-time create status should default to cooperating');
      assertEqual(inferPeopleSalaryMode('全职'), '月薪制', 'full-time salary mode should default to monthly');
      assertEqual(inferPeopleSalaryMode('兼职'), '任务制', 'part-time salary mode should default to task based');
      assertEqual(getPeopleTaskAccessStatusFromArchive('离职', ['design']), '已关闭', 'ended full-time relationship should close task access');
      assertEqual(getPeopleTaskAccessStatusFromArchive('在职', []), '暂停参与', 'active member without capabilities should pause task access');
      assertEqual(getPeopleTaskAccessStatusFromArchive('在职', ['design']), '可参与任务', 'active member with capabilities should allow task access');
      assertEqual(getPeopleHousingFundStatus(createMember({ housingFundStatus: undefined })), '暂不缴存', 'full-time housing fund status should default to not contributing');
      assertEqual(isPeopleHousingFundContributionEnabled(createMember({ housingFundStatus: '缴存' })), true, 'full-time contributing member should be enabled for housing fund records');
      assertEqual(
        isPeopleHousingFundContributionApplicable(createMember({ housingFundEffectiveMonth: '2026-05', housingFundStatus: '缴存' }), '2026-06'),
        true,
        'housing fund should apply after its effective month'
      );
      assertEqual(
        isPeopleHousingFundContributionApplicable(createMember({ housingFundEffectiveMonth: '2026-07', housingFundStatus: '缴存' }), '2026-06'),
        false,
        'housing fund should not apply before its effective month'
      );
      assertEqual(
        getPeopleHousingFundStatus(createMember({ personnelType: '兼职', housingFundStatus: '缴存' })),
        '不适用',
        'part-time member should not enter housing fund records'
      );
    }
  },
  {
    name: 'derives archive and salary read models',
    run: () => {
      const fulltimeMember = createMember();
      const parttimeMember = createMember({
        paymentProfile: {
          accountName: '测试人员',
          bankAccount: '6222000000000000000',
          bankName: '招商银行',
          mode: '按任务付款',
          payCycle: '按任务'
        },
        personnelType: '兼职',
        salaryProfile: {
          effectiveAt: '2026-06-01',
          note: '',
          payCycle: '按任务',
          probationSalary: undefined,
          regularSalary: undefined,
          status: '已配置',
          structure: '任务计价',
          taskRateRule: '按任务报价'
        },
        status: '合作中'
      });

      assertEqual(getPeopleArchiveListStatus(fulltimeMember), '已齐全', 'complete archive should render as complete');
      assertEqual(getPeopleArchiveListStatus(createMember({ archiveStatus: '待补充' })), '待补充', 'pending archive should render as pending');
      assertEqual(getPeopleBaseSalaryText(fulltimeMember), '8000', 'probation full-time member should use probation salary');
      assertEqual(getPeopleBaseSalaryText(createMember({ probationEndAt: undefined, status: '在职' })), '10000', 'regular full-time member should use regular salary');
      assertEqual(getPeopleBaseSalaryText(parttimeMember), '按任务规则', 'part-time member with task-rate rule should hide fixed salary');
    }
  },
  {
    name: 'derives attendance effect status and duration',
    run: () => {
      assertEqual(getPeopleAttendanceEffect('补班'), '可用', 'make-up work should be available');
      assertEqual(getPeopleAttendanceEffect('请假'), '不可用', 'leave should be unavailable');
      assertEqual(
        getPeopleAttendanceStatus('2026-06-17 09:00', '2026-06-17 18:00', '日常记录', '2026-06-17 12:00'),
        '生效中',
        'current daily record should be active'
      );
      assertEqual(
        getPeopleAttendanceStatus('2026-06-18 09:00', '2026-06-18 18:00', '日常记录', '2026-06-17 12:00'),
        '待生效',
        'future daily record should be pending'
      );
      assertEqual(
        getPeopleAttendanceStatus('2026-06-16 09:00', '2026-06-16 18:00', '日常记录', '2026-06-17 12:00'),
        '已结束',
        'past daily record should be ended'
      );
      assertEqual(
        getPeopleAttendanceStatus('2026-06-16 09:00', '2026-06-16 18:00', '历史补录', '2026-06-17 12:00'),
        '已结束',
        'historical record should be ended'
      );
      assertEqual(getPeopleAttendanceDurationHours('2026-06-17 09:00', '2026-06-17 10:30'), 2, 'duration should round up to hours');
      assertEqual(getPeopleAttendanceDurationHours('bad', '2026-06-17 10:30'), 0, 'invalid start time should produce zero duration');
    }
  },
  {
    name: 'summarizes overview availability from attendance and work calendar facts',
    run: () => {
      const fulltimeMember = createMember();
      const parttimeMember = createMember({ personnelType: '兼职', status: '合作中' });
      const endedMember = createMember({ status: '离职' });

      assertEqual(
        getPeopleOverviewAvailabilitySummary(fulltimeMember, [], [weekdayCalendar], [], '2026-06-17').status,
        '在岗',
        'weekday without attendance record should be available'
      );
      assertEqual(
        getPeopleOverviewAvailabilitySummary(fulltimeMember, [], [weekdayCalendar], annualExceptions, '2026-06-17').status,
        '休息',
        'enabled rest-day exception should override base work calendar'
      );
      assertEqual(
        getPeopleOverviewAvailabilitySummary(fulltimeMember, [], [weekdayCalendar], annualExceptions, '2026-06-21').status,
        '在岗',
        'enabled special-workday exception should override weekend'
      );
      assertEqual(
        getPeopleOverviewAvailabilitySummary(fulltimeMember, [createAttendanceRecord()], [weekdayCalendar], [], '2026-06-17').status,
        '休息',
        'active unavailable attendance record should render rest'
      );
      assertEqual(
        getPeopleOverviewAvailabilitySummary(
          fulltimeMember,
          [createAttendanceRecord({ effect: '可用', type: '补班' })],
          [weekdayCalendar],
          [],
          '2026-06-21'
        ).status,
        '在岗',
        'active make-up work record should render available'
      );
      assertEqual(getPeopleOverviewAvailabilitySummary(parttimeMember, [], [weekdayCalendar], [], '2026-06-17').status, '-', 'part-time member should not enter attendance summary');
      assertEqual(getPeopleOverviewAvailabilitySummary(endedMember, [], [weekdayCalendar], [], '2026-06-17').status, '-', 'ended relationship should not enter attendance summary');
    }
  },
  {
    name: 'counts ongoing tasks and position members through stable selectors',
    run: () => {
      const positionRecords: PositionManagementRecord[] = [
        {
          code: 'CEO',
          extraPermissions: ['人员档案查看'],
          files: [],
          id: 'position-ceo',
          position: 'CEO',
          roleBindings: [],
          status: '启用',
          updatedAt: '2026-06-17'
        },
        {
          code: 'DESIGNER',
          extraPermissions: [],
          files: [],
          id: 'position-designer',
          position: '设计师',
          roleBindings: [],
          status: '启用',
          updatedAt: '2026-06-17'
        }
      ];
      const positionRows = getPositionRowsWithMemberCount(positionRecords, [
        createMember({ id: 'member-001', position: 'CEO' }),
        createMember({ id: 'member-002', position: '设计师' }),
        createMember({ id: 'member-003', position: '设计师' })
      ]);
      const positionRow: PositionManagementRow = { ...positionRows[0], memberCount: 99 };

      assertEqual(getPeopleOngoingTaskCount('member-001', [{ executorId: 'member-001', status: '进行中' }, { executorId: 'member-001', status: '已完成' }]), 1, 'ongoing task count should only count active statuses');
      assertDeepEqual(
        positionRows.map((row) => [row.position, row.memberCount]),
        [
          ['CEO', 1],
          ['设计师', 2]
        ],
        'position rows should derive member counts by position'
      );
      assert(!('memberCount' in toPositionManagementRecord(positionRow)), 'position record should strip derived member count');
      assertDeepEqual(toPositionManagementRecord(positionRow).extraPermissions, ['人员档案查看'], 'position record should keep position-level extra permissions');
    }
  },
  {
    name: 'applies movement effects without leaking page-local mutation rules',
    run: () => {
      const member = createMember();
      const regularized = applyPeopleMovementEffect(member, { effectiveAt: '2026-06-20', memberId: member.id, type: '转正' }, { actor: '测试人', today: '2026-06-21' });
      const departed = applyPeopleMovementEffect(member, { effectiveAt: '2026-06-30', memberId: member.id, type: '离职' }, { today: '2026-07-01' });
      const renewed = applyPeopleMovementEffect(
        member,
        { effectiveAt: '2026-07-02', memberId: member.id, newContractEndAt: '2027-06-30', type: '续签' },
        { today: '2026-07-02' }
      );
      const salaryAdjusted = applyPeopleMovementEffect(
        member,
        { effectiveAt: '2026-07-03', memberId: member.id, newSalaryText: '12000', type: '薪资标准调整' },
        { today: '2026-07-03' }
      );
      const paused = applyPeopleMovementEffect(member, { effectiveAt: '2026-07-04', memberId: member.id, type: '暂停任务参与' }, { today: '2026-07-04' });
      const endedParttime = createMember({ personnelType: '兼职', status: '结束合作', taskAccessStatus: '已关闭' });
      const activeParttime = createMember({ personnelType: '兼职', status: '合作中', taskAccessStatus: '暂停参与' });
      const cooperationEnded = applyPeopleMovementEffect(
        activeParttime,
        { effectiveAt: '2026-07-05', memberId: activeParttime.id, type: '结束合作' },
        { today: '2026-07-05' }
      );
      const restoredParttime = applyPeopleMovementEffect(endedParttime, { effectiveAt: '2026-07-01', memberId: endedParttime.id, type: '恢复任务参与' }, { today: '2026-07-01' });
      const restoredActiveParttime = applyPeopleMovementEffect(
        activeParttime,
        { effectiveAt: '2026-07-06', memberId: activeParttime.id, type: '恢复任务参与' },
        { today: '2026-07-06' }
      );
      const unchanged = applyPeopleMovementEffect(member, { effectiveAt: '2026-07-01', memberId: 'other-member', type: '离职' }, { today: '2026-07-01' });

      assertEqual(regularized.status, '在职', 'regularization should switch full-time status to active');
      assertEqual(regularized.contractStatus, '正式合同', 'regularization should switch contract status');
      assertEqual(regularized.auditRecords[0]?.actor, '测试人', 'movement should prepend audit record with actor');
      assertEqual(departed.status, '离职', 'departure should switch status');
      assertEqual(departed.taskAccessStatus, '已关闭', 'departure should close task access');
      assertEqual(departed.salaryProfile.status, '已停用', 'departure should disable salary profile');
      assertEqual(renewed.contractEndAt, '2027-06-30', 'renewal should update contract end date');
      assertEqual(renewed.contractStatus, '劳动合同有效', 'renewal should keep full-time contract active');
      assertEqual(salaryAdjusted.salaryProfile.regularSalary, '12000', 'salary adjustment should update regular salary');
      assertEqual(salaryAdjusted.salaryProfile.effectiveAt, '2026-07-03', 'salary adjustment should update salary effective date');
      assertEqual(paused.taskAccessStatus, '暂停参与', 'pause movement should pause task access');
      assertEqual(cooperationEnded.status, '结束合作', 'cooperation end should switch part-time status');
      assertEqual(cooperationEnded.cooperationEndAt, '2026-07-05', 'cooperation end should update cooperation end date');
      assertEqual(restoredParttime.taskAccessStatus, '已关闭', 'ended relationship should stay closed when restoring task access');
      assertEqual(restoredActiveParttime.taskAccessStatus, '可参与任务', 'active relationship should restore task access');
      assert(unchanged === member, 'movement for another member should return the original reference');
    }
  },
  {
    name: 'restores people movement snapshots for reversal records',
    run: () => {
      const member = createMember({
        contractStatus: '劳动合同有效',
        probationEndAt: '2026-06-01',
        status: '在职'
      });
      const beforeSnapshot = createPeopleMovementSnapshot(member);
      const departed = applyPeopleMovementEffect(member, { effectiveAt: '2026-07-01', memberId: member.id, type: '离职' }, { today: '2026-07-01' });
      const restored = restorePeopleMovementSnapshot(departed, beforeSnapshot, {
        actor: '测试人',
        effectiveAt: '2026-07-02',
        reason: '离职日期录入错误',
        sourceRecordId: 'MOV-TEST-001',
        today: '2026-07-02'
      });

      assert(!isPeopleMovementSnapshotEqual(departed, beforeSnapshot), 'departed member should no longer match original snapshot');
      assert(isPeopleMovementSnapshotEqual(restored, beforeSnapshot), 'restored member should match original snapshot');
      assertEqual(restored.archiveUpdatedAt, '2026-07-02', 'reversal should mark archive update date');
      assertEqual(restored.auditRecords[0]?.action, '冲正', 'reversal should prepend reversal audit record');
      assertEqual(restored.auditRecords[0]?.actor, '测试人', 'reversal audit should keep actor');
      assert(restored.auditRecords[0]?.note.includes('MOV-TEST-001'), 'reversal audit should reference source record');
      assertDeepEqual(restored.salaryProfile, beforeSnapshot.salaryProfile, 'reversal should restore salary profile from snapshot');
    }
  },
  {
    name: 'derives performance termination risk from applicable published rules',
    run: () => {
      const riskyMember = createMember({
        position: '空间设计师',
        workEvaluationRecords: [{ acceptedTasks: 1, level: 'D', month: '2026-06', reworkTasks: 0, score: 58 }],
        workEvaluationSummary: { acceptedTasks: 1, level: 'D', month: '2026-06', reworkTasks: 0, score: 58 }
      });
      const lowScoreUnmatchedMember = createMember({
        position: '财务专员',
        workEvaluationRecords: [{ acceptedTasks: 1, level: 'D', month: '2026-06', reworkTasks: 0, score: 58 }],
        workEvaluationSummary: { acceptedTasks: 1, level: 'D', month: '2026-06', reworkTasks: 0, score: 58 }
      });
      const attentionOnlyMember = createMember({
        position: '空间设计师',
        workEvaluationRecords: [{ acceptedTasks: 1, level: 'C', month: '2026-06', reworkTasks: 0, score: 65 }],
        workEvaluationSummary: { acceptedTasks: 1, level: 'C', month: '2026-06', reworkTasks: 0, score: 65 }
      });

      assertDeepEqual(
        getPeoplePerformanceRuleRiskLabels(riskyMember, performanceRulePresets),
        [peoplePerformanceTerminationRiskLabel],
        'latest score in rule termination band should trigger termination-condition risk'
      );
      assertDeepEqual(
        getPeoplePerformanceRuleRiskLabels(lowScoreUnmatchedMember, performanceRulePresets),
        [],
        'low score without an applicable published rule should not trigger termination-condition risk'
      );
      assertDeepEqual(
        getPeoplePerformanceRuleRiskLabels(attentionOnlyMember, performanceRulePresets),
        [],
        'score above the termination band should stay as a normal performance concern only'
      );
    }
  },
  {
    name: 'keeps repository snapshots isolated from raw mock mutation',
    run: () => {
      const firstSnapshot = peopleMockRepository.getInitialSnapshot();
      const secondSnapshot = peopleMockRepository.getInitialSnapshot();

      assert(firstSnapshot.peopleRows.length > 0, 'mock repository should expose people rows');
      assert(secondSnapshot.peopleRows.length > 0, 'mock repository should expose independent people rows');

      const originalSecondName = secondSnapshot.peopleRows[0].name;
      const originalSecondFileName = secondSnapshot.peopleRows[0].archiveFiles[0]?.name;
      firstSnapshot.peopleRows[0].name = '已被测试修改';

      if (firstSnapshot.peopleRows[0].archiveFiles[0]) {
        firstSnapshot.peopleRows[0].archiveFiles[0].name = '已被测试修改文件';
      }

      assertEqual(secondSnapshot.peopleRows[0].name, originalSecondName, 'repository snapshots should not share member objects');
      assertEqual(secondSnapshot.peopleRows[0].archiveFiles[0]?.name, originalSecondFileName, 'repository snapshots should not share nested archive-file objects');
    }
  }
];

export function runPeopleDomainTests(): UnitTestResult {
  const failures: string[] = [];

  for (const test of tests) {
    try {
      test.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${test.name}: ${message}`);
    }
  }

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
