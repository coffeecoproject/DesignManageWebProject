import { peopleMockRepository } from '../people/peopleRepository';
import type { PeopleMember } from '../people/peopleTypes';
import type { StoreTaskRecord, TaskPerformanceScoringRecord } from '../tasks/TaskManagementState';
import {
  buildMyWorkArchiveSummary,
  buildMyWorkPerformanceTaskRows,
  buildMyWorkTaskRows,
  buildMyWorkTaskSummary,
  getMySalaryReports,
  getMyWorkMember,
  toMyWorkArchiveStatus
} from './myWorkModel';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
  total: number;
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

function createMember(overrides: Partial<PeopleMember> = {}): PeopleMember {
  const baseMember = peopleMockRepository.getInitialSnapshot().peopleRows[0];

  return {
    ...baseMember,
    ...overrides
  };
}

function createTask(overrides: Partial<StoreTaskRecord> = {}): StoreTaskRecord {
  return {
    acceptorId: 'acceptor-001',
    acceptorName: '验收人',
    brandId: 'brand-test',
    code: 'TASK-TEST-001',
    createdAt: '2026-06-15 10:00',
    customerId: 'customer-test',
    executorId: 'member-001',
    executorName: '执行人',
    files: [],
    id: 'task-test-001',
    name: '测试任务',
    note: '',
    operationRecords: [],
    plannedDeliveryAt: '2026-06-16 18:00',
    plannedDurationHours: 8,
    reworkCount: 0,
    status: '进行中',
    storeId: 'store-test',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-15 12:00',
    ...overrides
  };
}

function createScoringRecord(overrides: Partial<TaskPerformanceScoringRecord> = {}): TaskPerformanceScoringRecord {
  return {
    adjustmentReason: '',
    id: 'score-001',
    operationRecords: [],
    qualityDimensionScores: [],
    qualityScore: 92,
    scoreValue: 3.8,
    sourceMonth: '2026-06',
    status: '已计入',
    taskId: 'task-test-001',
    updatedAt: '2026-06-15 18:00',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'current member falls back to requested id and active person',
    run() {
      const target = createMember({ id: 'member-target', name: '目标人员' });
      const fallback = createMember({ id: 'member-fallback', name: '兜底人员', status: '在职' });

      assertEqual(getMyWorkMember([fallback, target], 'member-target')?.id, 'member-target', 'requested member should be selected');
      assertEqual(getMyWorkMember([fallback], 'missing')?.id, 'member-fallback', 'active member should be fallback');
    }
  },
  {
    name: 'archive status is converted to employee-facing wording',
    run() {
      const member = createMember({
        archiveFiles: [
          { category: '身份资料', id: 'file-1', name: '身份证', status: '已上传', updatedAt: '2026-06-01' },
          { category: '合同协议', id: 'file-2', name: '劳动合同', status: '待补充', updatedAt: '2026-06-02' }
        ],
        archiveStatus: '资料完整'
      });
      const summary = buildMyWorkArchiveSummary(member);

      assertEqual(toMyWorkArchiveStatus('资料完整'), '已齐全', 'complete archive should be renamed');
      assertEqual(summary.fileCount, 2, 'file count should use archive files');
      assertEqual(summary.pendingFileCount, 1, 'pending file count should be derived from files');
    }
  },
  {
    name: 'my task rows include only open owned tasks and split roles',
    run() {
      const rows = buildMyWorkTaskRows('member-001', [
        createTask({ id: 'task-executor', executorId: 'member-001', status: '进行中' }),
        createTask({ acceptorId: 'member-001', executorId: 'other', id: 'task-acceptor', status: '待验收' }),
        createTask({ executorId: 'member-001', id: 'task-done', status: '已完成' }),
        createTask({ executorId: 'other', id: 'task-other', status: '进行中' })
      ]);

      assertEqual(rows.length, 2, 'only open owned tasks should be visible');
      assert(rows.some((row) => row.task.id === 'task-executor' && row.role === '执行'), 'executor role should be included');
      assert(rows.some((row) => row.task.id === 'task-acceptor' && row.role === '验收'), 'acceptor role should be included');
    }
  },
  {
    name: 'my task summary separates current and completed task counts',
    run() {
      const summary = buildMyWorkTaskSummary(
        'member-001',
        [
          createTask({ id: 'task-current', executorId: 'member-001', status: '进行中' }),
          createTask({ executorId: 'member-001', id: 'task-rejected', status: '验收驳回' }),
          createTask({ acceptorId: 'member-001', executorId: 'other', id: 'task-acceptance', status: '待验收' }),
          createTask({
            acceptedAt: '2026-06-10 18:00',
            executorId: 'member-001',
            id: 'task-completed',
            status: '已完成',
            updatedAt: '2026-06-10 18:00'
          })
        ],
        '2026-06'
      );

      assertEqual(summary.currentTaskCount, 3, 'current count should exclude completed tasks');
      assertEqual(summary.completedThisMonthCount, 1, 'completed count should include current month executor tasks');
      assertEqual(summary.rejectedCount, 1, 'rejected count should derive from current tasks');
      assertEqual(summary.pendingSubmitCount, 1, 'pending submit count should include executor in-progress tasks');
      assertEqual(summary.pendingResubmitCount, 1, 'pending resubmit count should include executor rejected tasks');
      assertEqual(summary.pendingMyAcceptanceCount, 1, 'pending my acceptance count should include acceptor pending tasks');
    }
  },
  {
    name: 'my salary and performance helpers keep employee ownership',
    run() {
      const currentMember = createMember({ id: 'member-001' });
      const otherMember = createMember({ id: 'other' });
      const salaryReports = getMySalaryReports('member-001', [
        { member: otherMember, month: '2026-06' },
        { member: currentMember, month: '2026-05' },
        { member: currentMember, month: '2026-06' }
      ] as never);
      const performanceRows = buildMyWorkPerformanceTaskRows(
        'member-001',
        [
          createTask({ executorId: 'member-001', id: 'task-test-001' }),
          createTask({ executorId: 'other', id: 'task-other' })
        ],
        [createScoringRecord({ taskId: 'task-test-001' }), createScoringRecord({ id: 'score-other', taskId: 'task-other' })]
      );

      assertEqual(salaryReports.length, 2, 'salary reports should keep only current member');
      assertEqual(salaryReports[0]?.month, '2026-06', 'salary reports should sort by latest month');
      assertEqual(performanceRows.length, 1, 'performance rows should keep only executor-owned tasks');
      assertEqual(performanceRows[0]?.task?.id, 'task-test-001', 'performance row should attach source task');
    }
  }
];

export function runMyWorkModelTests(): UnitTestResult {
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
