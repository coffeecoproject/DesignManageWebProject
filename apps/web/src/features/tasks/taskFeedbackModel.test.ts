import type { ClientFeedbackRecord, StoreTaskRecord } from './TaskManagementState';
import {
  buildTaskFeedbackSummaries,
  buildTaskInternalReworkRecords,
  defaultTaskFeedbackFilters,
  filterTaskFeedbackSummaries,
  getTaskFeedbackMetrics,
  getTaskFeedbackOperationRecords
} from './taskFeedbackModel';

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

function createTask(overrides: Partial<StoreTaskRecord> = {}): StoreTaskRecord {
  return {
    acceptedAt: '2026-06-18 16:00',
    acceptorId: 'member-acceptor',
    acceptorName: '验收人',
    brandId: 'brand-test',
    code: 'TASK-TEST-001',
    createdAt: '2026-06-15 10:00',
    customerId: 'customer-test',
    executorId: 'member-executor',
    executorName: '执行人',
    files: [],
    id: 'task-test-001',
    name: '测试任务',
    note: '',
    operationRecords: [],
    plannedDeliveryAt: '2026-06-18 18:00',
    plannedDurationHours: 8,
    reworkCount: 0,
    status: '已完成',
    storeId: 'store-test',
    submittedAt: '2026-06-18 15:00',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-18 16:00',
    ...overrides
  };
}

function createFeedback(overrides: Partial<ClientFeedbackRecord> = {}): ClientFeedbackRecord {
  return {
    brandId: 'brand-test',
    channel: '微信',
    code: 'FB-TEST-001',
    content: '测试反馈内容',
    createdAt: '2026-06-18 15:20',
    customerId: 'customer-test',
    feedbackAt: '2026-06-18 15:10',
    feedbackBy: '客户联系人',
    feedbackPhone: '13800000000',
    feedbackRole: '工程负责人',
    files: [],
    id: 'feedback-test-001',
    operationRecords: [],
    recorder: '登记人',
    storeId: 'store-test',
    summary: '测试反馈',
    taskId: 'task-test-001',
    updatedAt: '2026-06-18 15:20',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'task feedback summaries only include completed tasks with feedback or rework',
    run() {
      const summaries = buildTaskFeedbackSummaries({
        clientFeedbackRows: [
          createFeedback({ id: 'feedback-open', taskId: 'task-open' }),
          createFeedback({ id: 'feedback-done', taskId: 'task-done' })
        ],
        storeTaskRows: [
          createTask({ id: 'task-open', status: '待验收' }),
          createTask({ id: 'task-clean', reworkCount: 0 }),
          createTask({ id: 'task-done', reworkCount: 0 })
        ]
      });

      assertEqual(summaries.length, 1, 'only completed task with issue record should be included');
      assertEqual(summaries[0]?.id, 'task-done', 'completed task with client feedback should be listed');
    }
  },
  {
    name: 'task feedback summary keeps rework and client feedback counts separate',
    run() {
      const summaries = buildTaskFeedbackSummaries({
        clientFeedbackRows: [
          createFeedback({ id: 'feedback-a', taskId: 'task-reworked' }),
          createFeedback({ id: 'feedback-b', taskId: 'task-reworked' })
        ],
        storeTaskRows: [
          createTask({
            id: 'task-reworked',
            latestReworkReason: '尺寸不一致',
            latestReworkRequirement: '按批复图调整',
            operationRecords: [
              {
                action: '验收驳回',
                actor: '验收人',
                id: 'op-rework',
                object: '测试任务',
                summary: '验收驳回：尺寸不一致',
                time: '2026-06-17 12:00'
              }
            ],
            reworkCount: 2
          })
        ]
      });
      const summary = summaries[0];

      assert(summary, 'summary should exist');
      assertEqual(summary.internalRejectionCount, 2, 'internal rejection count should use task rework count');
      assertEqual(summary.clientFeedbackCount, 2, 'client feedback count should use linked client records');
      assertEqual(summary.internalReworkRecords.length, 2, 'missing operation details should be represented by fallback rows');
    }
  },
  {
    name: 'internal rework records use structured latest reason for newest operation',
    run() {
      const records = buildTaskInternalReworkRecords(
        createTask({
          latestReworkReason: '动线不符合反馈',
          latestReworkRequirement: '重新调整收银区动线',
          operationRecords: [
            {
              action: '验收驳回',
              actor: '验收人',
              id: 'op-rework',
              object: '测试任务',
              summary: '验收驳回：动线不符合反馈',
              time: '2026-06-17 12:00'
            }
          ],
          reworkCount: 1
        })
      );

      assertEqual(records.length, 1, 'one rework record should be generated');
      assertEqual(records[0]?.reason, '动线不符合反馈', 'latest structured reason should be used');
      assertEqual(records[0]?.requirement, '重新调整收银区动线', 'latest structured requirement should be used');
    }
  },
  {
    name: 'task feedback filters match customer brand channel type and keyword',
    run() {
      const summaries = buildTaskFeedbackSummaries({
        clientFeedbackRows: [
          createFeedback({
            brandId: 'brand-a',
            channel: '微信',
            content: '门头尺寸需要调整',
            customerId: 'customer-a',
            id: 'feedback-a',
            storeId: 'store-a',
            taskId: 'task-a'
          }),
          createFeedback({
            brandId: 'brand-b',
            channel: '邮件',
            content: '软装清单补充',
            customerId: 'customer-b',
            id: 'feedback-b',
            storeId: 'store-b',
            taskId: 'task-b'
          })
        ],
        storeTaskRows: [
          createTask({
            brandId: 'brand-a',
            customerId: 'customer-a',
            id: 'task-a',
            name: '门头深化任务',
            storeId: 'store-a'
          }),
          createTask({
            brandId: 'brand-b',
            customerId: 'customer-b',
            id: 'task-b',
            latestReworkReason: '软装缺项',
            operationRecords: [
              {
                action: '验收驳回',
                actor: '验收人',
                id: 'op-task-b-rework',
                object: '软装清单任务',
                summary: '验收驳回：软装缺项',
                time: '2026-06-17 12:00'
              }
            ],
            reworkCount: 1,
            storeId: 'store-b'
          })
        ]
      });
      const lookup = {
        getBrandName: (task: StoreTaskRecord) => (task.brandId === 'brand-a' ? '星际空间' : '星际轻装'),
        getCustomerName: (task: StoreTaskRecord) => (task.customerId === 'customer-a' ? '湖北星际装饰' : '湖南新岚餐饮'),
        getStoreLabel: (task: StoreTaskRecord) => (task.storeId === 'store-a' ? '汉口门店 / 武汉' : '岳麓首店 / 长沙'),
        getTaskTypeName: () => '设计任务'
      };
      const filtered = filterTaskFeedbackSummaries(
        summaries,
        {
          ...defaultTaskFeedbackFilters,
          brandId: 'brand-b',
          channel: '邮件',
          customerId: 'customer-b',
          feedbackType: '两者都有',
          keyword: '软装'
        },
        lookup
      );

      assertEqual(filtered.length, 1, 'one summary should match all feedback filters');
      assertEqual(filtered[0]?.id, 'task-b', 'filtered summary should be the matching task');
    }
  },
  {
    name: 'task feedback date filter matches feedback event time instead of completed time',
    run() {
      const summaries = buildTaskFeedbackSummaries({
        clientFeedbackRows: [
          createFeedback({
            feedbackAt: '2026-05-31 10:00',
            id: 'feedback-outside-range',
            taskId: 'task-completed-in-range'
          }),
          createFeedback({
            feedbackAt: '2026-06-15 10:00',
            id: 'feedback-inside-range',
            taskId: 'task-feedback-in-range'
          })
        ],
        storeTaskRows: [
          createTask({
            acceptedAt: '2026-06-18 16:00',
            id: 'task-completed-in-range',
            updatedAt: '2026-06-18 16:00'
          }),
          createTask({
            acceptedAt: '2026-05-20 16:00',
            id: 'task-feedback-in-range',
            updatedAt: '2026-05-20 16:00'
          }),
          createTask({
            acceptedAt: '2026-05-21 16:00',
            id: 'task-rework-in-range',
            operationRecords: [
              {
                action: '验收驳回',
                actor: '验收人',
                id: 'op-rework-in-range',
                object: '测试任务',
                summary: '验收驳回：内容不完整',
                time: '2026-06-10 09:00'
              }
            ],
            reworkCount: 1,
            updatedAt: '2026-05-21 16:00'
          })
        ]
      });
      const lookup = {
        getBrandName: () => '测试品牌',
        getCustomerName: () => '测试客户',
        getStoreLabel: () => '测试门店',
        getTaskTypeName: () => '设计任务'
      };
      const filtered = filterTaskFeedbackSummaries(summaries, defaultTaskFeedbackFilters, lookup, {
        endDate: '2026-06-30',
        startDate: '2026-06-01'
      });
      const filteredIds = filtered.map((summary) => summary.id).sort().join(',');

      assertEqual(filtered.length, 2, 'two summaries should match feedback events in the selected range');
      assertEqual(filteredIds, 'task-feedback-in-range,task-rework-in-range', 'completed time alone should not satisfy feedback date filtering');
    }
  },
  {
    name: 'task feedback metrics and operation records are derived consistently',
    run() {
      const summaries = buildTaskFeedbackSummaries({
        clientFeedbackRows: [
          createFeedback({
            files: [
              {
                id: 'file-a',
                name: '反馈截图.png',
                registeredBy: '登记人',
                source: '业务服务器',
                stage: '甲方反馈',
                status: '已上传',
                type: '图片',
                updatedAt: '2026-06-18 15:12',
                url: '/uploads/file-a.png'
              }
            ],
            operationRecords: [
              {
                action: '登记甲方反馈',
                actor: '登记人',
                id: 'op-feedback-a',
                object: '甲方反馈',
                summary: '登记甲方反馈',
                time: '2026-06-18 15:20'
              }
            ]
          })
        ],
        storeTaskRows: [
          createTask({
            operationRecords: [
              {
                action: '任务完成',
                actor: '验收人',
                id: 'op-task-complete',
                object: '测试任务',
                summary: '任务验收完成',
                time: '2026-06-18 16:00'
              }
            ]
          })
        ]
      });
      const metrics = getTaskFeedbackMetrics(summaries);
      const records = summaries[0] ? getTaskFeedbackOperationRecords(summaries[0]) : [];

      assertEqual(metrics.tasks, 1, 'metrics should count feedback task summaries');
      assertEqual(metrics.clientFeedbackCount, 1, 'metrics should count client feedback rows');
      assertEqual(metrics.feedbackFiles, 1, 'metrics should count feedback files');
      assertEqual(records.length, 2, 'operation records should merge task and client feedback operations');
      assertEqual(records[0]?.id, 'op-task-complete', 'operation records should sort latest first');
    }
  }
];

export function runTaskFeedbackModelTests(): UnitTestResult {
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
