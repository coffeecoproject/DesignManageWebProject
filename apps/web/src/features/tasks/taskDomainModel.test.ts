import type { UploadFile } from 'antd/es/upload/interface';
import type { BrandRecord } from '../customers/customerData';
import type { PerformanceRulePreset } from '../performance/performanceTypes';
import type { ClientFeedbackRecord, StoreTaskRecord } from './TaskManagementState';
import {
  buildAcceptanceFeedbackDraft,
  buildAcceptanceScoringDraft,
  buildTaskPerformanceScoringRecord,
  getAcceptanceBlockers,
  getCompletedDimensionScores,
  getQualityScore,
  getReworkBlockers,
  getTaskClientFeedbackRows,
  getTaskPerformanceRule,
  getTaskScoreItem,
  isAcceptanceFeedbackReady
} from './taskAcceptanceModel';
import { buildTaskDashboardData, buildTaskDashboardPeriodRange } from './taskDashboardModel';
import { getTaskDeadlineState, getTaskSearchText, getTaskStoreContext, getTaskTypeName, isTaskClosed, isTaskOverdue } from './taskDisplayModel';
import { buildTaskFilesFromDrafts, buildTaskReworkScreenshotFiles, hasPartialTaskFileDraft, normalizeCompletedTaskFileDrafts } from './taskFileModel';
import { defaultTaskFilters, getFilteredStoreTasks } from './taskListFormModel';
import { appendTaskOperation } from './taskOperationModel';

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
    plannedDeliveryAt: '2026-06-20 18:00',
    plannedDurationHours: 8,
    reworkCount: 0,
    status: '进行中',
    storeId: 'store-test',
    taskConfigId: 'task-type-floor-plan',
    updatedAt: '2026-06-15 10:00',
    ...overrides
  };
}

function createPerformanceRule(overrides: Partial<PerformanceRulePreset> = {}): PerformanceRulePreset {
  return {
    applicablePositions: ['空间设计师'],
    baseLineScore: 80,
    basePerformanceAmount: 1000,
    calculationSummary: '',
    category: '绘图任务制',
    categoryVersionState: '当前发布版本',
    code: 'PERF-TEST-001',
    currentVersion: 'V1',
    editableScope: '测试',
    effectiveStartAt: '2026-06-01',
    excessBands: [],
    formulas: [],
    fullScore: 100,
    generatedFileSummary: '',
    generatedFiles: [],
    id: 'rule-drawing',
    lastUpdatedAt: '2026-06-15',
    lastUpdatedBy: '李明',
    lockReason: '',
    monthlyResultFields: [],
    name: '绘图任务制V1',
    payoutMode: '',
    performanceType: '任务制',
    personnelType: '全职',
    preservedClauses: [],
    qualityBands: [
      {
        excessRatio: 1,
        handling: '正常',
        id: 'quality-a',
        minScore: 90,
        qualityRatio: 1,
        scoreRange: '优秀'
      },
      {
        excessRatio: 0.8,
        handling: '复核',
        id: 'quality-b',
        maxScore: 89,
        minScore: 0,
        qualityRatio: 0.8,
        scoreRange: '待提升'
      }
    ],
    qualityDimensions: [
      { evidence: '图纸检查', focus: '准确性', id: 'quality-accuracy', name: '准确性', score: 60 },
      { evidence: '交付检查', focus: '完整性', id: 'quality-complete', name: '完整性', score: 40 }
    ],
    qualityScoreSummary: '',
    reviewCycle: '',
    ruleParameterFields: [],
    scopeNote: '',
    scoringCycle: '',
    sourceFiles: [],
    status: '已发布',
    structuredFieldSummary: '',
    taskEventFields: [],
    taskScoreItems: [
      {
        confirmationMode: '验收确认',
        evidence: '任务验收',
        id: 'score-floor-plan',
        name: '平面方案',
        requiresConfirmation: true,
        score: 3.8,
        scoreFieldKey: 'floor_plan_score',
        taskConfigId: 'task-type-floor-plan',
        unit: '套/门店',
        unitKey: 'store'
      }
    ],
    taskScoreSummary: '',
    templateMode: '固定模块',
    versionEvents: [],
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'task deadline state uses closed and overdue rules consistently',
    run() {
      assertEqual(isTaskClosed(createTask({ status: '已完成' })), true, 'completed task should be closed');
      assertEqual(isTaskClosed(createTask({ status: '已中止' })), true, 'stopped task should be closed');
      assertEqual(isTaskClosed(createTask({ status: '待验收' })), false, 'pending acceptance task should be open');
      assertEqual(isTaskOverdue(createTask({ plannedDeliveryAt: '2026-06-14 18:00' }), '2026-06-15 10:00'), true, 'open overdue task should be overdue');
      assertEqual(isTaskOverdue(createTask({ plannedDeliveryAt: '2026-06-14 18:00', status: '已完成' }), '2026-06-15 10:00'), false, 'closed task should not be overdue');
      assertEqual(getTaskDeadlineState(createTask({ plannedDeliveryAt: '2026-06-14 18:00' }), '2026-06-15 10:00'), '逾期', 'deadline state should expose overdue');
      assertEqual(getTaskDeadlineState(createTask({ status: '已完成' }), '2026-06-15 10:00'), '已关闭', 'completed task should expose closed deadline');
    }
  },
  {
    name: 'task display helpers resolve store, type and keyword text',
    run() {
      const storeContext = getTaskStoreContext(
        [
          {
            city: '武汉市',
            id: 'store-test',
            name: '武汉光谷店',
            province: '湖北省'
          }
        ],
        'store-test'
      );

      assertEqual(storeContext.storeCityLabel, '武汉光谷店 / 武汉市', 'store label should include name and city');
      assertEqual(getTaskTypeName('task-type-floor-plan', [{ id: 'task-type-floor-plan', name: '平面方案' }]), '平面方案', 'task type should resolve by id');
      assert(
        getTaskSearchText({
          acceptorName: '验收人',
          brandName: '星际空间',
          code: 'TASK-001',
          customerName: '湖北星际装饰有限公司',
          executorName: '执行人',
          name: '武汉光谷店平面方案',
          storeCity: '武汉市',
          storeName: '武汉光谷店',
          taskTypeName: '平面方案'
        }).includes('星际空间'),
        'search text should include brand and context fields'
      );
    }
  },
  {
    name: 'task list filters by planned delivery date range',
    run() {
      const inRangeTask = createTask({
        id: 'task-in-range',
        name: '范围内任务',
        plannedDeliveryAt: '2026-06-15 18:00',
        updatedAt: '2026-06-15 10:00'
      });
      const outOfRangeTask = createTask({
        id: 'task-out-range',
        name: '范围外任务',
        plannedDeliveryAt: '2026-07-01 18:00',
        updatedAt: '2026-07-01 10:00'
      });
      const rows = getFilteredStoreTasks({
        brandRows: [{ id: 'brand-test', name: '测试品牌' }],
        customerRows: [{ id: 'customer-test', name: '测试客户' }],
        filters: defaultTaskFilters,
        plannedDeliveryRange: {
          endDate: '2026-06-30',
          startDate: '2026-06-01'
        },
        storeRows: [
          {
            address: '',
            brandId: 'brand-test',
            city: '武汉市',
            code: 'STORE-TEST',
            customerId: 'customer-test',
            id: 'store-test',
            name: '测试门店',
            openedAt: '2026-06-01',
            province: '湖北省',
            status: '营业中',
            updatedAt: '2026-06-15'
          }
        ],
        storeTaskRows: [inRangeTask, outOfRangeTask],
        taskConfigRows: [
          {
            category: '设计交付',
            code: 'TT-TEST-001',
            deliveryFileRequirements: ['平面方案文件'],
            id: 'task-type-floor-plan',
            name: '平面方案',
            note: '',
            status: '启用',
            updatedAt: '2026-06-15'
          }
        ]
      });

      assertEqual(rows.length, 1, 'only tasks planned inside selected range should remain');
      assertEqual(rows[0]?.id, 'task-in-range', 'planned delivery range should match task plannedDeliveryAt');
    }
  },
  {
    name: 'task dashboard model derives summary, trend and risk rows',
    run() {
      const overdueTask = createTask({
        code: 'TASK-DASH-001',
        createdAt: '2026-06-15 09:00',
        id: 'task-dashboard-overdue',
        name: '逾期执行任务',
        plannedDeliveryAt: '2026-06-14 18:00',
        status: '进行中',
        updatedAt: '2026-06-15 09:00'
      });
      const pendingAcceptanceTask = createTask({
        code: 'TASK-DASH-002',
        createdAt: '2026-06-14 09:00',
        id: 'task-dashboard-pending',
        name: '待验收任务',
        plannedDeliveryAt: '2026-06-16 18:00',
        status: '待验收',
        submittedAt: '2026-06-15 11:00',
        updatedAt: '2026-06-15 11:00'
      });
      const completedTask = createTask({
        acceptedAt: '2026-06-15 12:00',
        code: 'TASK-DASH-003',
        createdAt: '2026-06-12 09:00',
        id: 'task-dashboard-completed',
        name: '已完成多次驳回任务',
        plannedDeliveryAt: '2026-06-15 18:00',
        reworkCount: 2,
        status: '已完成',
        updatedAt: '2026-06-15 12:00'
      });
      const feedback: ClientFeedbackRecord = {
        brandId: completedTask.brandId,
        channel: '微信',
        code: 'FB-DASH-001',
        content: '甲方反馈',
        createdAt: '2026-06-15 13:00',
        customerId: completedTask.customerId,
        feedbackAt: '2026-06-15 13:00',
        feedbackBy: '甲方',
        feedbackPhone: '13800000000',
        feedbackRole: '负责人',
        files: [],
        id: 'feedback-dashboard',
        operationRecords: [],
        recorder: '李明',
        storeId: completedTask.storeId,
        summary: '甲方反馈',
        taskId: completedTask.id,
        updatedAt: '2026-06-15 13:00'
      };

      const dashboard = buildTaskDashboardData({
        brandRows: [
          {
            code: 'BR-TEST',
            contactName: '甲方',
            customerId: 'customer-test',
            id: 'brand-test',
            name: '测试品牌',
            note: '',
            owner: '李明',
            performanceRuleId: '',
            status: '启用',
            storeCount: 1,
            taskConfigs: [],
            updatedAt: '2026-06-15'
          } satisfies BrandRecord
        ],
        clientFeedbackRows: [feedback],
        customerRows: [
          {
            brandCount: 1,
            code: 'CUS-TEST',
            contacts: [],
            id: 'customer-test',
            industry: '测试行业',
            name: '测试客户',
            note: '',
            owner: '李明',
            storeCount: 1,
            updatedAt: '2026-06-15'
          }
        ],
        storeRows: [
          {
            address: '',
            brandId: 'brand-test',
            city: '武汉市',
            code: 'STORE-TEST',
            customerId: 'customer-test',
            id: 'store-test',
            name: '测试门店',
            openedAt: '2026-06-01',
            province: '湖北省',
            status: '营业中',
            updatedAt: '2026-06-15'
          }
        ],
        storeTaskRows: [overdueTask, pendingAcceptanceTask, completedTask],
        taskConfigRows: [{ id: 'task-type-floor-plan', name: '平面方案' }],
        today: '2026-06-15',
        now: '2026-06-15 10:00'
      });
      const currentTrend = dashboard.trend.find((point) => point.date === '2026-06-15');

      assertEqual(dashboard.metrics.total, 3, 'dashboard should count all tasks');
      assertEqual(dashboard.metrics.active, 2, 'dashboard should count open tasks');
      assertEqual(dashboard.metrics.pendingSubmit, 1, 'dashboard should derive pending submit from in-progress tasks');
      assertEqual(dashboard.metrics.pendingAcceptance, 1, 'dashboard should count pending acceptance');
      assertEqual(dashboard.metrics.overdue, 1, 'dashboard should count open overdue tasks');
      assertEqual(dashboard.metrics.completedInPeriod, 1, 'dashboard should count completed tasks in the selected period');
      assertEqual(dashboard.metrics.reworkCount, 2, 'dashboard should sum rework count');
      assertEqual(dashboard.metrics.clientFeedback, 1, 'dashboard should count client feedback rows');
      assertEqual(currentTrend?.created, 1, 'current trend should count tasks created today');
      assertEqual(currentTrend?.completed, 1, 'current trend should count tasks completed today');
      assertEqual(dashboard.riskRows[0]?.id, overdueTask.id, 'overdue active task should be the first risk row');
      assertEqual(dashboard.loadRows[0]?.activeCount, 2, 'load row should count active executor tasks');

      const oneDayDashboard = buildTaskDashboardData({
        brandRows: [
          {
            code: 'BR-TEST',
            contactName: '甲方',
            customerId: 'customer-test',
            id: 'brand-test',
            name: '测试品牌',
            note: '',
            owner: '李明',
            performanceRuleId: '',
            status: '启用',
            storeCount: 1,
            taskConfigs: [],
            updatedAt: '2026-06-15'
          } satisfies BrandRecord
        ],
        clientFeedbackRows: [feedback],
        customerRows: [
          {
            brandCount: 1,
            code: 'CUS-TEST',
            contacts: [],
            id: 'customer-test',
            industry: '测试行业',
            name: '测试客户',
            note: '',
            owner: '李明',
            storeCount: 1,
            updatedAt: '2026-06-15'
          }
        ],
        periodRange: buildTaskDashboardPeriodRange('custom', '2026-06-15', {
          endDate: '2026-06-15',
          startDate: '2026-06-15'
        }),
        storeRows: [
          {
            address: '',
            brandId: 'brand-test',
            city: '武汉市',
            code: 'STORE-TEST',
            customerId: 'customer-test',
            id: 'store-test',
            name: '测试门店',
            openedAt: '2026-06-01',
            province: '湖北省',
            status: '营业中',
            updatedAt: '2026-06-15'
          }
        ],
        storeTaskRows: [overdueTask, pendingAcceptanceTask, completedTask],
        taskConfigRows: [{ id: 'task-type-floor-plan', name: '平面方案' }],
        today: '2026-06-15',
        now: '2026-06-15 10:00'
      });

      assertEqual(oneDayDashboard.period.label, '2026-06-15 至 2026-06-15', 'custom period should keep selected date range');
      assertEqual(oneDayDashboard.trend.length, 1, 'single-day custom period should produce one daily trend point');
      assertEqual(oneDayDashboard.metrics.total, 2, 'custom period should include tasks related to the selected date only');
      assertEqual(oneDayDashboard.metrics.active, 1, 'custom period should count open tasks related to the selected date');
      assertEqual(oneDayDashboard.metrics.completedInPeriod, 1, 'custom period should count completed tasks on the selected date');
      assertEqual(oneDayDashboard.metrics.clientFeedback, 1, 'custom period should count feedback in the selected date range');
    }
  },
  {
    name: 'task file model normalizes Feishu drafts and rejects partial rows',
    run() {
      const drafts = [
        { id: 'draft-1', name: '  交付文件.zip  ', type: '压缩包' as const, url: ' https://example.feishu.cn/file ' },
        { id: 'draft-2', name: '', type: 'PDF图纸' as const, url: '' }
      ];

      assertEqual(hasPartialTaskFileDraft([{ ...drafts[0], url: '' }]), true, 'name without url should be partial');
      const completedDrafts = normalizeCompletedTaskFileDrafts(drafts);
      assertEqual(completedDrafts.length, 1, 'only completed drafts should remain');
      assertEqual(completedDrafts[0]?.name, '交付文件.zip', 'completed draft name should be trimmed');

      const files = buildTaskFilesFromDrafts({
        drafts,
        idPrefix: 'task-file-delivery',
        registeredBy: '执行人',
        stage: '交付文件',
        startIndex: 3,
        updatedAt: '2026-06-15 12:00'
      });

      assertEqual(files.length, 1, 'only completed draft should build file');
      assertEqual(files[0]?.id, 'task-file-delivery-3', 'file id should use supplied start index');
      assertEqual(files[0]?.source, '飞书云盘', 'task drafts should be stored as Feishu links');
      assertEqual(files[0]?.stage, '交付文件', 'file stage should be retained');
      assertEqual(files[0]?.status, '已登记', 'Feishu file should be registered');
    }
  },
  {
    name: 'task uploaded image files use server source and rework sequence',
    run() {
      const files = buildTaskReworkScreenshotFiles([{ name: '问题截图.png' } as UploadFile], createTask({ reworkCount: 1 }));

      assertEqual(files.length, 1, 'one upload file should be built');
      assertEqual(files[0]?.source, '业务服务器', 'rework screenshots should use business server source');
      assertEqual(files[0]?.stage, '问题截图', 'rework screenshot should use problem screenshot stage');
      assert(files[0]?.url.includes('/rework-2/'), 'rework screenshot url should include next rework sequence');
    }
  },
  {
    name: 'acceptance model requires delivery, score item and completed quality scores',
    run() {
      const task = createTask({
        files: [
          {
            id: 'file-delivery',
            name: '交付文件.zip',
            registeredBy: '执行人',
            source: '飞书云盘',
            stage: '交付文件',
            status: '已登记',
            type: '压缩包',
            updatedAt: '2026-06-15 12:00',
            url: 'https://example.feishu.cn/file'
          }
        ],
        status: '待验收',
        submittedAt: '2026-06-15 12:00'
      });
      const brandRows = [{ id: 'brand-test', performanceRuleId: 'rule-drawing' }] as BrandRecord[];
      const ruleRows = [createPerformanceRule()];
      const rule = getTaskPerformanceRule(task, brandRows, ruleRows);
      const scoreItem = getTaskScoreItem(task, rule);
      const draft = buildAcceptanceScoringDraft(task, brandRows, ruleRows);

      assertEqual(rule?.id, 'rule-drawing', 'task should resolve brand performance rule');
      assertEqual(scoreItem?.id, 'score-floor-plan', 'task should resolve score item by task config id');
      assertEqual(getAcceptanceBlockers(task, draft).includes('质量评分'), true, 'empty quality scores should block acceptance');
      const completedDraft = {
        ...draft,
        dimensionScores: draft.dimensionScores.map((dimension) => ({ ...dimension, score: dimension.maxScore }))
      };
      const completedScores = getCompletedDimensionScores(completedDraft);

      assertEqual(getAcceptanceBlockers(task, completedDraft).length, 0, 'completed scoring draft should unblock acceptance');
      assertEqual(getQualityScore(completedScores ?? []), 100, 'quality score should sum completed dimensions');

      const scoringRecord = buildTaskPerformanceScoringRecord(task, completedDraft, ruleRows);

      assertEqual(scoringRecord.taskId, task.id, 'scoring record should bind to task');
      assertEqual(scoringRecord.scoreItemName, '平面方案', 'scoring record should retain score item name');
      assertEqual(scoringRecord.qualityBand, '优秀', 'scoring record should resolve quality band');
    }
  },
  {
    name: 'acceptance feedback and rework blockers separate client feedback from internal rejection fields',
    run() {
      const task = createTask();
      const feedbackDraft = buildAcceptanceFeedbackDraft(task, () => ({
        brandCount: 1,
        code: 'CUS-TEST',
        contacts: [
          {
            email: 'contact@example.test',
            id: 'contact-1',
            name: '周岚',
            phone: '13800000000',
            primary: true,
            role: '工程负责人',
            wechat: 'zhoulan'
          }
        ],
        id: 'customer-test',
        industry: '连锁商业空间',
        name: '测试客户',
        note: '',
        owner: '李明',
        storeCount: 1,
        updatedAt: '2026-06-15'
      }));
      const readyFeedback = {
        ...feedbackDraft,
        content: '门头尺寸需调整'
      };
      const feedbackRows = getTaskClientFeedbackRows(task, [
        {
          brandId: task.brandId,
          channel: '微信',
          code: 'FB-OLD',
          content: '较早反馈',
          createdAt: '2026-06-14 09:00',
          customerId: task.customerId,
          feedbackAt: '2026-06-14 09:00',
          feedbackBy: '周岚',
          feedbackPhone: '13800000000',
          feedbackRole: '工程负责人',
          files: [],
          id: 'feedback-old',
          operationRecords: [],
          recorder: '李明',
          storeId: task.storeId,
          summary: '较早反馈',
          taskId: task.id,
          updatedAt: '2026-06-14 09:00'
        },
        {
          brandId: task.brandId,
          channel: '微信',
          code: 'FB-NEW',
          content: '最新反馈',
          createdAt: '2026-06-15 09:00',
          customerId: task.customerId,
          feedbackAt: '2026-06-15 09:00',
          feedbackBy: '周岚',
          feedbackPhone: '13800000000',
          feedbackRole: '工程负责人',
          files: [],
          id: 'feedback-new',
          operationRecords: [],
          recorder: '李明',
          storeId: task.storeId,
          summary: '最新反馈',
          taskId: task.id,
          updatedAt: '2026-06-15 09:00'
        }
      ]);

      assertEqual(feedbackDraft.feedbackBy, '周岚', 'feedback draft should default to primary contact');
      assertEqual(isAcceptanceFeedbackReady(feedbackDraft), false, 'empty content should not be ready');
      assertEqual(isAcceptanceFeedbackReady(readyFeedback), true, 'content should make feedback ready');
      assertEqual(getReworkBlockers('', '', false).join('、'), '甲方反馈、驳回原因、整改要求', 'rework should require client feedback and internal rejection fields');
      assertEqual(getReworkBlockers('尺寸错误', '调整门头', true).length, 0, 'complete rework fields should pass');
      assertEqual(feedbackRows[0]?.id, 'feedback-new', 'feedback rows should sort latest first');
    }
  },
  {
    name: 'task operation model prepends operation and updates timestamp',
    run() {
      const nextTask = appendTaskOperation(createTask(), '提交交付', '提交 1 份交付文件', '执行人', '2026-06-15 12:00');

      assertEqual(nextTask.operationRecords.length, 1, 'operation should be appended');
      assertEqual(nextTask.operationRecords[0]?.action, '提交交付', 'operation action should be retained');
      assertEqual(nextTask.operationRecords[0]?.actor, '执行人', 'operation actor should use supplied actor');
      assertEqual(nextTask.updatedAt, '2026-06-15 12:00', 'task updatedAt should follow operation time');
    }
  }
];

export function runTaskDomainModelTests(): UnitTestResult {
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
