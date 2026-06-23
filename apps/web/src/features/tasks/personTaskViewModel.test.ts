import { peopleMockRepository } from '../people/peopleRepository';
import type { PeopleMember } from '../people/peopleTypes';
import type { StoreTaskRecord } from './TaskManagementState';
import { buildPersonTaskSummaries, isOpenPersonTask } from './personTaskViewModel';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
  total: number;
};

type PeopleMemberOverrides = Omit<Partial<PeopleMember>, 'workEvaluationSummary'> & {
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

function createMember(id: string, overrides: PeopleMemberOverrides = {}): PeopleMember {
  const baseMember = peopleMockRepository.getInitialSnapshot().peopleRows[0];

  return {
    ...baseMember,
    id,
    name: `测试人员 ${id}`,
    personnelType: '全职',
    position: '空间设计师',
    status: '在职',
    taskAccessStatus: '可参与任务',
    ...overrides,
    taskCapabilityIds: overrides.taskCapabilityIds ?? ['task-type-floor-plan'],
    workEvaluationSummary: {
      ...baseMember.workEvaluationSummary,
      score: 90,
      ...overrides.workEvaluationSummary
    }
  };
}

function createTask(overrides: Partial<StoreTaskRecord> = {}): StoreTaskRecord {
  return {
    acceptorId: 'member-acceptor',
    acceptorName: '验收人',
    brandId: 'brand-test',
    code: 'TASK-TEST-001',
    createdAt: '2026-06-15 10:00',
    customerId: 'customer-test',
    files: [],
    id: 'task-test-001',
    name: '测试任务',
    note: '',
    operationRecords: [],
    executorId: 'member-active',
    executorName: '测试人员',
    plannedDurationHours: 8,
    plannedDeliveryAt: '2026-06-16 18:00',
    reworkCount: 0,
    status: '进行中',
    storeId: 'store-test',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-15 12:00',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'closed tasks are not counted in person task summaries',
    run() {
      const peopleRows = [createMember('member-active'), createMember('member-idle')];
      const summaries = buildPersonTaskSummaries({
        now: '2026-06-17 10:00',
        peopleRows,
        storeTaskRows: [
          createTask({ id: 'task-open', executorId: 'member-active', status: '进行中' }),
          createTask({ id: 'task-done', executorId: 'member-active', status: '已完成' }),
          createTask({ id: 'task-stopped', executorId: 'member-idle', status: '已中止' })
        ]
      });
      const activeSummary = summaries.find((summary) => summary.id === 'member-active');
      const idleSummary = summaries.find((summary) => summary.id === 'member-idle');

      assert(activeSummary, 'active member should be included');
      assert(idleSummary, 'active idle member should remain visible');
      assertEqual(activeSummary.involvedTasks.length, 1, 'only open task should be counted');
      assertEqual(activeSummary.involvedTasks[0]?.id, 'task-open', 'completed task should be excluded');
      assertEqual(activeSummary.completedTasks.length, 1, 'completed task should be retained as summary count');
      assertEqual(idleSummary.involvedTasks.length, 0, 'stopped task should be excluded from idle member');
    }
  },
  {
    name: 'completed task summary only includes selected completion range and executor ownership',
    run() {
      const peopleRows = [createMember('member-active'), createMember('member-acceptor')];
      const summaries = buildPersonTaskSummaries({
        completedRange: { endDate: '2026-06-30', startDate: '2026-06-01' },
        now: '2026-06-17 10:00',
        peopleRows,
        storeTaskRows: [
          createTask({
            acceptedAt: '2026-06-10 09:00',
            id: 'task-done-current',
            status: '已完成',
            updatedAt: '2026-06-10 09:00'
          }),
          createTask({
            acceptedAt: '2026-05-31 18:00',
            id: 'task-done-previous',
            status: '已完成',
            updatedAt: '2026-05-31 18:00'
          }),
          createTask({
            acceptorId: 'member-active',
            executorId: 'member-acceptor',
            id: 'task-done-accepted-by-active',
            status: '已完成',
            updatedAt: '2026-06-12 10:00'
          })
        ]
      });
      const activeSummary = summaries.find((summary) => summary.id === 'member-active');

      assert(activeSummary, 'active member should be visible');
      assertEqual(activeSummary.involvedTasks.length, 0, 'completed tasks should not enter current task rows');
      assertEqual(activeSummary.completedTasks.length, 1, 'completed count should use selected range and executor only');
      assertEqual(activeSummary.completedTasks[0]?.id, 'task-done-current', 'outside-range and accepted-only tasks should be excluded');
    }
  },
  {
    name: 'open task state buckets are split for the personnel table',
    run() {
      const peopleRows = [createMember('member-active')];
      const summaries = buildPersonTaskSummaries({
        now: '2026-06-17 10:00',
        peopleRows,
        storeTaskRows: [
          createTask({
            id: 'task-in-progress',
            plannedDeliveryAt: '2026-06-18 18:00',
            status: '进行中'
          }),
          createTask({
            acceptorId: 'member-active',
            executorId: 'member-other',
            id: 'task-pending-acceptance',
            plannedDeliveryAt: '2026-06-18 18:00',
            status: '待验收'
          }),
          createTask({
            id: 'task-overdue',
            plannedDeliveryAt: '2026-06-16 18:00',
            status: '进行中'
          }),
          createTask({
            id: 'task-rejected',
            plannedDeliveryAt: '2026-06-18 18:00',
            status: '验收驳回'
          })
        ]
      });
      const summary = summaries.find((row) => row.id === 'member-active');

      assert(summary, 'active member should be visible');
      assertEqual(summary.inProgressTasks.length, 2, 'in-progress bucket should include executor in-progress tasks');
      assertEqual(summary.pendingAcceptanceTasks.length, 1, 'pending acceptance bucket should include involved pending tasks');
      assertEqual(summary.overdueTasks.length, 1, 'overdue bucket should derive from plan time');
      assertEqual(summary.rejectedTasks.length, 1, 'rejected bucket should derive from task status');
      assertEqual(summary.rejectionCount, 0, 'rejection count should use actual rework count, not rejected task count');
    }
  },
  {
    name: 'person rejection count uses executor rework count across open and selected completed tasks',
    run() {
      const peopleRows = [createMember('member-active'), createMember('member-acceptor')];
      const summaries = buildPersonTaskSummaries({
        completedRange: { endDate: '2026-06-30', startDate: '2026-06-01' },
        now: '2026-06-17 10:00',
        peopleRows,
        storeTaskRows: [
          createTask({
            id: 'task-open-reworked',
            reworkCount: 2,
            status: '验收驳回'
          }),
          createTask({
            acceptedAt: '2026-06-12 10:00',
            id: 'task-completed-reworked',
            reworkCount: 1,
            status: '已完成',
            updatedAt: '2026-06-12 10:00'
          }),
          createTask({
            acceptorId: 'member-active',
            executorId: 'member-acceptor',
            id: 'task-accepted-by-active',
            reworkCount: 3,
            status: '验收驳回'
          })
        ]
      });
      const summary = summaries.find((row) => row.id === 'member-active');

      assert(summary, 'active member should be visible');
      assertEqual(summary.rejectedTasks.length, 2, 'current rejected task list should still count involved open rejected tasks');
      assertEqual(summary.rejectionCount, 3, 'rejection count should sum executor-side rework counts');
    }
  },
  {
    name: 'ended member with open task remains visible and unavailable',
    run() {
      const peopleRows = [createMember('member-ended', { status: '离职', taskAccessStatus: '已关闭' })];
      const summaries = buildPersonTaskSummaries({
        now: '2026-06-17 10:00',
        peopleRows,
        storeTaskRows: [createTask({ executorId: 'member-ended', id: 'task-open-ended', status: '验收驳回' })]
      });
      const summary = summaries[0];

      assert(summary, 'ended member with open task should remain visible');
      assertEqual(summary.id, 'member-ended', 'ended member should be selected');
      assertEqual(summary.involvedTasks.length, 1, 'open task should be visible for ended member');
      assertEqual(summary.dispatch.state, '不可分配', 'ended member should be unavailable');
    }
  },
  {
    name: 'isOpenPersonTask treats completed and stopped as closed',
    run() {
      assert(isOpenPersonTask(createTask({ status: '进行中' })), 'in-progress task should be open');
      assert(!isOpenPersonTask(createTask({ status: '已完成' })), 'completed task should be closed');
      assert(!isOpenPersonTask(createTask({ status: '已中止' })), 'stopped task should be closed');
    }
  }
];

export function runPersonTaskViewModelTests(): UnitTestResult {
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
