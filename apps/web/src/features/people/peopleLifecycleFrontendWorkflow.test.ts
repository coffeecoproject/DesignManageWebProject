import {
  applyPeopleMovementEffect,
  createPeopleMovementSnapshot,
  getMovementAffectedSalaryMonths,
  getPeopleMemberPositions,
  getPeopleRelationshipRangeBlockers,
  getPositionRowsWithMemberCount,
  restorePeopleMovementSnapshot,
  type PositionManagementRecord
} from './peopleDomain';
import { peopleMockRepository } from './peopleRepository';
import { invalidateSalaryMonthlySources, type SalaryMonthlyWorkflowRecord } from '../salary/salaryDomain';

type UnitTest = { name: string; run: () => void };

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const memberFixture = peopleMockRepository.getInitialSnapshot().peopleRows.find((row) => row.id === '20260001');

if (!memberFixture) {
  throw new Error('personnel lifecycle fixture should exist');
}

const member = memberFixture;

function createWorkflow(status: SalaryMonthlyWorkflowRecord['status']): SalaryMonthlyWorkflowRecord {
  return {
    id: `salary-workflow-${status}`,
    memberId: member.id,
    month: '2026-06',
    note: '人员生命周期验收',
    status,
    updatedAt: '2026-06-18'
  };
}

const tests: UnitTest[] = [
  {
    name: 'PL-04 and PL-08 preserve multi-position membership and primary-position movement',
    run: () => {
      const adjusted = applyPeopleMovementEffect(
        member,
        {
          effectiveAt: '2026-06-20',
          memberId: member.id,
          newPositions: ['主案设计师', '财务专员'],
          newPrimaryPosition: '主案设计师',
          type: '岗位调整'
        },
        { today: '2026-06-20' }
      );
      const positions: PositionManagementRecord[] = [
        { code: 'P-01', dataScopes: { people: '本人', tasks: '负责验收', customers: '关联品牌', finance: '不可访问', salary: '本人' }, extraPermissions: [], files: [], id: 'p-01', position: '主案设计师', roleBindings: [], status: '启用', updatedAt: '2026-06-20' },
        { code: 'P-02', dataScopes: { people: '全部人员', tasks: '本人参与', customers: '全部客户', finance: '管理', salary: '全部人员' }, extraPermissions: [], files: [], id: 'p-02', position: '财务专员', roleBindings: [], status: '启用', updatedAt: '2026-06-20' }
      ];

      assertDeepEqual(getPeopleMemberPositions(adjusted), ['主案设计师', '财务专员'], 'all assigned positions should be retained');
      assertDeepEqual(
        getPositionRowsWithMemberCount(positions, [adjusted]).map((row) => row.memberCount),
        [1, 1],
        'one member should count in every assigned position'
      );
    }
  },
  {
    name: 'PL-06 blocks task windows outside employment and cooperation dates',
    run: () => {
      assertDeepEqual(
        getPeopleRelationshipRangeBlockers({ ...member, joinedAt: '2026-06-20' }, '2026-06-19 09:00', '2026-06-19 18:00'),
        ['任务开始早于入职日期'],
        'task before join date should be blocked'
      );
      assertDeepEqual(
        getPeopleRelationshipRangeBlockers(
          { ...member, cooperationEndAt: '2026-06-18', cooperationStartAt: '2026-06-01', personnelType: '兼职' },
          '2026-06-19 09:00',
          '2026-06-19 18:00'
        ),
        ['任务结束晚于合作截止日期'],
        'task after cooperation end should be blocked'
      );
    }
  },
  {
    name: 'PL-07 PL-09 and PL-10 invalidate confirmed salary but block paid salary',
    run: () => {
      const affectedMonths = getMovementAffectedSalaryMonths(
        { effectiveAt: '2026-06-15', memberId: member.id, type: '薪资标准调整' },
        ['2026-06', '2026-05']
      );
      const confirmedResult = invalidateSalaryMonthlySources(
        [createWorkflow('已确认')],
        [],
        member.id,
        affectedMonths,
        '人员异动后重新核定',
        '2026-06-20'
      );
      const paidResult = invalidateSalaryMonthlySources(
        [createWorkflow('已发放')],
        [],
        member.id,
        affectedMonths,
        '人员异动后重新核定',
        '2026-06-20'
      );

      assertEqual(confirmedResult.success, true, 'confirmed salary should be invalidated');
      assertEqual(confirmedResult.workflows[0]?.status, '待确认', 'confirmed salary should return to pending confirmation');
      assertEqual(paidResult.success, false, 'paid salary should block direct personnel mutation');
      assertDeepEqual(paidResult.blockedMonths, ['2026-06'], 'paid month should be reported as the blocker');
    }
  },
  {
    name: 'PL-13 movement reversal restores the complete position snapshot',
    run: () => {
      const snapshot = createPeopleMovementSnapshot(member);
      const adjusted = applyPeopleMovementEffect(
        member,
        {
          effectiveAt: '2026-06-20',
          memberId: member.id,
          newPositions: ['财务专员'],
          newPrimaryPosition: '财务专员',
          type: '岗位调整'
        },
        { today: '2026-06-20' }
      );
      const restored = restorePeopleMovementSnapshot(adjusted, snapshot, {
        effectiveAt: '2026-06-21',
        reason: '岗位调整录入错误',
        sourceRecordId: 'MOV-PL-013',
        today: '2026-06-21'
      });

      assertDeepEqual(getPeopleMemberPositions(restored), getPeopleMemberPositions(member), 'reversal should restore all original positions');
      assertEqual(restored.position, member.position, 'reversal should restore the primary position');
    }
  }
];

export function runPeopleLifecycleFrontendWorkflowTests() {
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
