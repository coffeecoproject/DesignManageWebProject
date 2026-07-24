import type { UploadFile } from 'antd/es/upload/interface';
import type { BrandRecord } from '../customers/customerData';
import type { PeopleMember } from '../people/peopleTypes';
import type { PerformanceRulePreset } from '../performance/performanceTypes';
import { defaultBrandAcceptancePolicy } from '../customers/brandAcceptancePolicyModel';
import { buildTaskDefinitionSnapshot, type TaskConfigRow } from '../system/TaskConfigState';
import type { ClientFeedbackRecord, StoreTaskRecord, TaskPerformanceScoringRecord } from './TaskManagementState';
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
import { defaultTaskFilters, getBrandTaskOptions, getFilteredStoreTasks } from './taskListFormModel';
import { appendTaskOperation } from './taskOperationModel';
import { buildPartTimeLaborAcceptanceRecord, buildPartTimeLaborSettlementBatches } from './partTimeLaborSettlementModel';
import { applyTaskAcceptanceCommit, applyTaskAcceptanceReversal } from './taskAcceptanceCommitModel';
import { ensureTaskAcceptanceArchive } from './taskAcceptanceEvidenceModel';
import {
  applyCustomerTaskAcceptance,
  getCustomerTaskAcceptanceStatus,
  getCustomerTaskAcceptanceValidationMessage
} from './taskCustomerAcceptanceModel';
import { getTaskCreationBlockingMessage } from './taskCreationEligibilityModel';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  executedTestNames: string[];
  failures: string[];
  passed: number;
  passedTestNames: string[];
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
  const taskId = overrides.id ?? 'task-test-001';

  const task: StoreTaskRecord = {
    acceptorId: 'member-acceptor',
    acceptorName: '验收人',
    brandId: 'brand-test',
    code: 'TASK-TEST-001',
    createdAt: '2026-06-15 10:00',
    customerId: 'customer-test',
    executorId: 'member-executor',
    executorName: '执行人',
    files: [],
    customerBillingSnapshot: {
      acceptancePolicy: defaultBrandAcceptancePolicy,
      billable: true,
      brandId: 'brand-test',
      brandName: '测试品牌',
      capturedAt: '2026-06-15 10:00',
      contractAmount: null,
      contractAmountMode: '无固定金额',
      currency: 'CNY',
      customerId: 'customer-test',
      customerName: '测试客户',
      id: `task-billing-snapshot-${taskId}`,
      priceVersion: 1,
      priceVersionId: 'brand-price-test-v1',
      settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
      settlementPolicyVersion: 1,
      settlementPolicyVersionId: 'brand-settlement-test-v1',
      taskConfigId: 'task-type-floor-plan',
      taskId,
      unitPrice: 1000
    },
    id: taskId,
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
    ...overrides,
    taskDefinitionSnapshot: overrides.taskDefinitionSnapshot ?? {
      capturedAt: overrides.createdAt ?? '2026-06-15 10:00', category: '设计交付', code: 'TASK-FLOOR', deliveryHints: [], id: overrides.taskConfigId ?? 'task-type-floor-plan', name: '平面方案'
    }
  };

  return task.status === '已完成' && task.acceptedAt
    ? ensureTaskAcceptanceArchive(task, task.acceptedAt, task.acceptorName)
    : task;
}

function createPerformanceRule(overrides: Partial<PerformanceRulePreset> = {}): PerformanceRulePreset {
  return {
    applicablePositions: ['空间设计师'],
    baseLineScore: 80,
    basePerformanceAmount: 1000,
    belowBaselineFactor: 0.5,
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
    monthlyPrepayRatio: 0.5,
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
      { evidence: '图纸检查', focus: '准确性', id: 'quality-accuracy', name: '准确性', score: 60, weight: 0.6 },
      { evidence: '交付检查', focus: '完整性', id: 'quality-complete', name: '完整性', score: 40, weight: 0.4 }
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
    name: 'task definition snapshot freezes display metadata and delivery hints',
    run: () => {
      const config: TaskConfigRow = {
        category: '设计交付',
        code: 'TT-2026-099',
        deliveryHints: ['建议提供图纸'],
        id: 'task-type-test',
        name: '原任务名称',
        note: '',
        status: '启用',
        updatedAt: '2026-06-15'
      };
      const snapshot = buildTaskDefinitionSnapshot(config, '2026-06-15 10:00');

      config.name = '新任务名称';
      config.deliveryHints.push('后续新增提示');

      assertEqual(snapshot.name, '原任务名称', 'renaming master data should not rewrite an existing task snapshot');
      assertEqual(snapshot.deliveryHints.length, 1, 'delivery hints should be copied into the task snapshot');
    }
  },
  {
    name: 'brand task options are controlled by brand binding and global task status only',
    run: () => {
      const brand: BrandRecord = {
        code: 'BR-TEST',
        contactName: '甲方',
        customerId: 'customer-test',
        id: 'brand-test',
        name: '测试品牌',
        note: '',
        owner: '李明',
        settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
        status: '启用',
        storeCount: 1,
        taskConfigs: [{ id: 'brand-task-test', taskConfigId: 'task-type-test' }],
        updatedAt: '2026-06-15'
      };
      const enabledTask: TaskConfigRow = {
        category: '设计交付', code: 'TT-TEST', deliveryHints: [], id: 'task-type-test', name: '测试任务', note: '', status: '启用', updatedAt: '2026-06-15'
      };

      assertEqual(getBrandTaskOptions(brand, [enabledTask]).length, 1, 'brand-bound enabled task should be publishable without a brand performance rule');
      assertEqual(getBrandTaskOptions({ ...brand, taskConfigs: [] }, [enabledTask]).length, 0, 'removing brand binding should remove the task from new-task options');
      assertEqual(getBrandTaskOptions(brand, [{ ...enabledTask, status: '停用' }]).length, 0, 'globally disabled task should not be publishable');
    }
  },
  {
    name: 'task creation requires available customer, master data and people relationships',
    run: () => {
      const validInput = {
        acceptorAvailable: true,
        brandAvailable: true,
        brandTaskAvailable: true,
        customerStatus: '合作中',
        executorAvailable: true,
        storeAvailable: true,
        taskConfigAvailable: true
      };
      assertEqual(getTaskCreationBlockingMessage(validInput), undefined, 'valid task context should pass');
      assertEqual(
        getTaskCreationBlockingMessage({ ...validInput, brandTaskAvailable: false }),
        '当前品牌未配置该任务类型',
        'task type outside the brand configuration should be blocked'
      );
      assertEqual(
        getTaskCreationBlockingMessage({ ...validInput, customerStatus: '已终止' }),
        '当前客户没有生效中的合同，不能新增任务',
        'terminated customer should be blocked'
      );
      assertEqual(
        getTaskCreationBlockingMessage({ ...validInput, taskConfigAvailable: false }),
        '当前任务类型已停用',
        'disabled task type should be blocked'
      );
      assertEqual(
        getTaskCreationBlockingMessage({ ...validInput, executorAvailable: false }),
        '当前执行人不可承接任务',
        'inactive executor should be blocked'
      );
    }
  },
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
      assertEqual(
        getTaskTypeName(createTask({
          taskDefinitionSnapshot: {
            capturedAt: '2026-06-15 10:00',
            category: '设计交付',
            code: 'TASK-FLOOR',
            deliveryHints: [],
            id: 'task-type-floor-plan',
            name: '历史平面方案'
          }
        })),
        '历史平面方案',
        'task type should resolve from the frozen definition snapshot'
      );
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
        storeTaskRows: [inRangeTask, outOfRangeTask]
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
            settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
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
            taxpayerIdentificationNo: '91420100TEST000001',
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
            settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
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
            taxpayerIdentificationNo: '91420100TEST000001',
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
      const ruleRows = [createPerformanceRule()];
      const member = {
        id: task.executorId,
        personnelType: '全职',
        position: '空间设计师',
        positionAssignments: [{
          effectiveFrom: '2026-01-01',
          id: 'assignment-task-domain',
          isPrimary: true,
          positionId: 'position-space-designer',
          positionName: '空间设计师',
          status: '生效中'
        }]
      } as PeopleMember;
      const rule = getTaskPerformanceRule(task, member, ruleRows);
      const scoreItem = getTaskScoreItem(task, rule);
      const draft = buildAcceptanceScoringDraft(task, member, ruleRows);

      assertEqual(rule?.id, 'rule-drawing', 'task should resolve the rule applicable to the employee and acceptance month');
      assertEqual(scoreItem?.id, 'score-floor-plan', 'task should resolve score item by task config id');
      assertEqual(getAcceptanceBlockers(task, draft).includes('质量评分'), true, 'empty quality scores should block acceptance');
      const completedDraft = {
        ...draft,
        dimensionScores: draft.dimensionScores.map((dimension) => ({ ...dimension, score: dimension.maxScore }))
      };
      const completedScores = getCompletedDimensionScores(completedDraft);

      assertEqual(getAcceptanceBlockers(task, completedDraft).length, 0, 'completed scoring draft should unblock acceptance');
      assertEqual(getQualityScore(completedScores ?? [], ruleRows[0]?.qualityDimensions ?? []), 100, 'quality score should use configured dimension weights');

      const scoringRecord = buildTaskPerformanceScoringRecord(task, completedDraft, ruleRows);

      assertEqual(scoringRecord.taskId, task.id, 'scoring record should bind to task');
      assertEqual(scoringRecord.scoreItemName, '平面方案', 'scoring record should retain score item name');
      assertEqual(scoringRecord.qualityBand, '优秀', 'scoring record should resolve quality band');
    }
  },
  {
    name: 'acceptance model resolves the historical rule version by acceptance month',
    run() {
      const task = createTask({ executorId: 'member-history' });
      const member = {
        id: task.executorId,
        personnelType: '全职',
        position: '空间设计师',
        positionAssignments: [{
          effectiveFrom: '2026-01-01',
          id: 'assignment-task-history',
          isPrimary: true,
          positionId: 'position-space-designer',
          positionName: '空间设计师',
          status: '生效中'
        }]
      } as PeopleMember;
      const v1 = createPerformanceRule({ effectiveEndAt: '2026-06-30' });
      const v2 = createPerformanceRule({
        currentVersion: 'V2',
        effectiveStartAt: '2026-07-01',
        id: 'rule-drawing-v2',
        name: '绘图任务制V2'
      });

      assertEqual(
        getTaskPerformanceRule(task, member, [v1, v2])?.id,
        v1.id,
        'June acceptance must not use the rule that starts in July'
      );
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
        taxpayerIdentificationNo: '91420100TEST000001',
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
      assertEqual(getReworkBlockers('', '').join('、'), '驳回原因、整改要求', 'rework should require internal rejection fields');
      assertEqual(getReworkBlockers('尺寸错误', '调整门头').length, 0, 'internal rework should not require client feedback');
      assertEqual(feedbackRows[0]?.id, 'feedback-new', 'feedback rows should sort latest first');
    }
  },
  {
    name: 'NP-04 atomically commits task acceptance, performance and the labor source',
    run() {
      const task = createTask({
        acceptedAt: '2026-06-18 16:00',
        code: 'TASK-PT-001',
        executorId: '20260006',
        executorName: '林悦',
        id: 'task-part-time-001',
        laborAgreement: {
          agreedGrossAmount: 3200,
          agreementVersion: 'HZ-PT-2026-0006/V1',
          projectId: 'HZ-PT-2026-0006/STORE-IMAGE'
        },
        status: '已完成'
      });
      const person = {
        id: '20260006',
        name: '林悦',
        personnelType: '兼职' as const,
        taxIdentityProfile: { identityType: '居民个人' as const, status: '已确认' as const }
      };
      const acceptanceResult = buildPartTimeLaborAcceptanceRecord({ person, task });
      assert(acceptanceResult.ready, 'complete accepted part-time task should build a labor acceptance fact');
      assert(acceptanceResult.acceptanceRecord, 'part-time acceptance should retain a labor fact');
      const scoringRecord: TaskPerformanceScoringRecord = {
        adjustmentReason: '',
        confirmedAt: task.acceptedAt,
        confirmedBy: '验收人',
        id: 'score-task-part-time-001',
        operationRecords: [],
        qualityDimensionScores: [],
        qualityScore: 95,
        sourceMonth: '2026-06',
        status: '已计入',
        taskId: task.id,
        updatedAt: task.acceptedAt ?? ''
      };
      const committedState = applyTaskAcceptanceCommit(
        {
          customerTaskBillingFacts: [],
          partTimeLaborAcceptanceRows: [],
          storeTaskRows: [createTask({ id: task.id, status: '待验收' })],
          taskPerformanceScoringRows: []
        },
        {
          laborAcceptance: acceptanceResult.acceptanceRecord,
          scoringRecord,
          task
        }
      );
      const result = buildPartTimeLaborSettlementBatches({
        acceptanceRecords: committedState.partTimeLaborAcceptanceRows,
        people: [person],
        settlementPeriod: '2026-06',
        tasks: committedState.storeTaskRows
      });

      assertEqual(committedState.storeTaskRows[0]?.status, '已完成', 'acceptance commit should complete the task');
      assertEqual(committedState.taskPerformanceScoringRows[0]?.id, scoringRecord.id, 'acceptance commit should store performance scoring');
      assertEqual(result.blockers.length, 0, 'complete accepted labor source should not be blocked');
      assertEqual(result.batches.length, 1, 'accepted part-time task should produce one batch');
      assertEqual(result.batches[0]?.grossAmount, 3200, 'batch gross amount should come from the acceptance fact');
      assertEqual(result.batches[0]?.sources[0]?.taskNo, 'TASK-PT-001', 'source should retain task number');
      assertEqual(result.batches[0]?.sources[0]?.acceptedAt, '2026-06-18 16:00', 'source should retain acceptance time');
      assertEqual(result.batches[0]?.sources[0]?.grossAmountSource.recordId, `${task.id}/labor-agreement`, 'source should retain amount fact identity');

      const reversedState = applyTaskAcceptanceReversal(committedState, {
        actor: '验收人',
        occurredAt: '2026-06-19 09:00',
        reason: '验收归档内容有误',
        taskId: task.id
      });
      const reacceptedState = applyTaskAcceptanceCommit(reversedState, {
        laborAcceptance: acceptanceResult.acceptanceRecord,
        scoringRecord,
        task
      });

      assertEqual(reversedState.customerTaskBillingFacts[0]?.status, '已冲销', 'acceptance reversal should void the customer billing fact');
      assertEqual(
        reacceptedState.customerTaskBillingFacts[0]?.status,
        '待甲方验收',
        'reacceptance should replace the reversed fact and await a new customer acceptance result'
      );
      assertEqual(reacceptedState.customerTaskBillingFacts.length, 1, 'reacceptance must reuse the deterministic billing identity without duplication');
      assertEqual(reacceptedState.partTimeLaborAcceptanceRows[0]?.reversedAt, undefined, 'reacceptance should replace the reversed labor fact');
    }
  },
  {
    name: 'NP-05 merges continuous same-project labor in one month and separates different projects',
    run() {
      const firstTask = createTask({
        acceptedAt: '2026-06-10 16:00',
        code: 'TASK-PT-002',
        executorId: '20260006',
        id: 'task-part-time-002',
        status: '已完成'
      });
      const secondTask = createTask({
        acceptedAt: '2026-06-20 17:00',
        code: 'TASK-PT-003',
        executorId: '20260006',
        id: 'task-part-time-003',
        status: '已完成'
      });
      const acceptanceRecords = [
        {
          acceptedAt: '2026-06-20 17:00',
          agreementVersion: 'HZ-PT-2026-0006/V1',
          grossAmount: 1700,
          grossAmountSource: { field: 'acceptedGrossAmount', kind: '验收确认' as const, recordId: 'acceptance-part-time-003' },
          id: 'acceptance-part-time-003',
          laborProjectId: 'HZ-PT-2026-0006/STORE-IMAGE-A',
          taskId: secondTask.id
        },
        {
          acceptedAt: '2026-06-10 16:00',
          agreementVersion: 'HZ-PT-2026-0006/V1',
          grossAmount: 1500,
          grossAmountSource: { field: 'acceptedGrossAmount', kind: '验收确认' as const, recordId: 'acceptance-part-time-002' },
          id: 'acceptance-part-time-002',
          laborProjectId: 'HZ-PT-2026-0006/STORE-IMAGE-A',
          taskId: firstTask.id
        }
      ];
      const people = [
        {
          id: '20260006',
          name: '林悦',
          personnelType: '兼职' as const,
          taxIdentityProfile: { identityType: '居民个人' as const, status: '已确认' as const }
        }
      ];
      const firstResult = buildPartTimeLaborSettlementBatches({
        acceptanceRecords,
        people,
        settlementPeriod: '2026-06',
        tasks: [secondTask, firstTask]
      });
      const reorderedResult = buildPartTimeLaborSettlementBatches({
        acceptanceRecords: [...acceptanceRecords].reverse(),
        people,
        settlementPeriod: '2026-06',
        tasks: [firstTask, secondTask]
      });

      assertEqual(firstResult.batches.length, 1, 'same employee, project and period should produce one batch');
      assertEqual(firstResult.batches[0]?.grossAmount, 3200, 'batch should sum accepted gross amounts before tax calculation');
      assertEqual(firstResult.batches[0]?.sources.length, 2, 'batch should retain both task sources');
      assertEqual(firstResult.batches[0]?.sources[0]?.taskNo, 'TASK-PT-002', 'batch sources should have deterministic task ordering');
      assertEqual(firstResult.batches[0]?.batchKey, reorderedResult.batches[0]?.batchKey, 'batch key should not depend on input order');
      assertEqual(
        firstResult.batches[0]?.batchKey,
        'part-time-labor:2026-06:20260006:HZ-PT-2026-0006%2FSTORE-IMAGE-A',
        'batch key should derive from period, employee number and labor project'
      );
      assertEqual(firstResult.batches[0]?.laborProjectId, 'HZ-PT-2026-0006/STORE-IMAGE-A', 'batch should retain its single labor project');

      const separateProjectResult = buildPartTimeLaborSettlementBatches({
        acceptanceRecords: [
          acceptanceRecords[0],
          { ...acceptanceRecords[1], laborProjectId: 'HZ-PT-2026-0006/STORE-IMAGE-B' }
        ],
        people,
        settlementPeriod: '2026-06',
        tasks: [firstTask, secondTask]
      });

      assertEqual(separateProjectResult.batches.length, 2, 'different labor projects must produce separate withholding batches');
      assertEqual(
        separateProjectResult.batches.reduce((total, batch) => total + batch.grossAmount, 0),
        3200,
        'separate project batches should preserve the total gross income'
      );
    }
  },
  {
    name: 'NP-06 blocks pending tax identity and incomplete gross amount facts',
    run() {
      const identityPendingTask = createTask({
        acceptedAt: '2026-06-12 12:00',
        code: 'TASK-PT-004',
        executorId: '20260006',
        id: 'task-part-time-004',
        status: '已完成'
      });
      const amountMissingTask = createTask({
        acceptedAt: '2026-06-13 12:00',
        code: 'TASK-PT-005',
        executorId: '20260007',
        id: 'task-part-time-005',
        status: '已完成'
      });
      const result = buildPartTimeLaborSettlementBatches({
        acceptanceRecords: [
          {
            acceptedAt: '2026-06-12 12:00',
            agreementVersion: 'HZ-PT-2026-0006/V1',
            grossAmount: 3200,
            grossAmountSource: { field: 'acceptedGrossAmount', kind: '验收确认', recordId: 'acceptance-part-time-004' },
            id: 'acceptance-part-time-004',
            laborProjectId: 'HZ-PT-2026-0006/STORE-IMAGE',
            taskId: identityPendingTask.id
          },
          {
            acceptedAt: '2026-06-13 12:00',
            agreementVersion: 'HZ-PT-2026-0007/V1',
            grossAmountSource: { field: 'acceptedGrossAmount', kind: '验收确认', recordId: 'acceptance-part-time-005' },
            id: 'acceptance-part-time-005',
            laborProjectId: 'HZ-PT-2026-0007/STORE-IMAGE',
            taskId: amountMissingTask.id
          }
        ],
        people: [
          { id: '20260006', name: '林悦', personnelType: '兼职', taxIdentityProfile: { identityType: '居民个人', status: '待确认' } },
          { id: '20260007', name: '高远', personnelType: '兼职', taxIdentityProfile: { identityType: '居民个人', status: '已确认' } }
        ],
        settlementPeriod: '2026-06',
        tasks: [identityPendingTask, amountMissingTask]
      });

      assertEqual(result.batches.length, 0, 'blocked sources must not silently produce settlement batches');
      assert(result.blockers.some((blocker) => blocker.code === 'TAX_IDENTITY_UNCONFIRMED'), 'pending tax identity should return an explicit blocker');
      assert(result.blockers.some((blocker) => blocker.code === 'GROSS_AMOUNT_MISSING'), 'missing gross amount should return an explicit blocker');
    }
  },
  {
    name: 'TR-40 customer acceptance validates score deduction and required remark',
    run() {
      const task = createTask({ acceptedAt: '2026-06-18 16:00', status: '已完成' });

      assertEqual(getCustomerTaskAcceptanceStatus(task), '待录入', 'billable internally accepted task should await customer acceptance');
      assertEqual(
        getCustomerTaskAcceptanceValidationMessage(task, { acceptedOn: '2026-06-19', correctionReason: '', remark: '', score: 82, timelinessResult: '未超时' }),
        '存在扣罚或不计时时备注必填',
        'rule-calculated customer deduction should require a remark'
      );
      assertEqual(
        getCustomerTaskAcceptanceValidationMessage(task, { acceptedOn: '2026-06-19', correctionReason: '', remark: '', score: 101, timelinessResult: '未超时' }),
        '甲方评分需为 0 至 100 分',
        'customer score must remain within the accepted range'
      );
    }
  },
  {
    name: 'TR-41 customer acceptance records one auditable result and supports correction',
    run() {
      const task = createTask({ acceptedAt: '2026-06-18 16:00', status: '已完成' });
      const accepted = applyCustomerTaskAcceptance(
        task,
        { acceptedOn: '2026-06-19', correctionReason: '', remark: '甲方评分触发扣罚', score: 82, timelinessResult: '未超时' },
        { actor: '李明', occurredAt: '2026-06-19 10:00' }
      );
      assertEqual(
        getCustomerTaskAcceptanceValidationMessage(
          accepted,
          { acceptedOn: '2026-06-19', correctionReason: '重复提交', remark: '甲方评分触发扣罚', score: 82, timelinessResult: '未超时' }
        ),
        '甲方验收结果未发生变化',
        'unchanged customer acceptance must not create a correction audit'
      );
      assertEqual(
        getCustomerTaskAcceptanceValidationMessage(
          accepted,
          { acceptedOn: '2026-06-18', correctionReason: '', remark: '', score: 90, timelinessResult: '未超时' }
        ),
        '请填写更正原因',
        'existing customer acceptance must not be corrected without a reason'
      );
      const corrected = applyCustomerTaskAcceptance(
        accepted,
        { acceptedOn: '2026-06-18', correctionReason: '甲方复核后更正评分', remark: '', score: 90, timelinessResult: '未超时' },
        { actor: '李明', occurredAt: '2026-06-19 11:00' }
      );

      assertEqual(getCustomerTaskAcceptanceStatus(accepted), '已完成', 'recorded customer acceptance should be complete');
      assertEqual(accepted.customerAcceptance?.deductionAmount, 200, 'customer acceptance should calculate deduction from the frozen rule');
      assertEqual(accepted.customerAcceptance?.totalPenaltyPoints, 10, 'customer acceptance should retain calculated penalty points');
      assertEqual(corrected.customerAcceptance?.score, 90, 'correction should replace the current customer result');
      assertEqual(corrected.customerAcceptance?.deductionAmount, 0, 'correction should recalculate the deduction instead of retaining manual input');
      assertEqual(corrected.customerAcceptance?.acceptedOn, '2026-06-18', 'correction should update the business acceptance date');
      assertEqual(corrected.customerAcceptance?.recordedAt, '2026-06-19 10:00', 'correction must preserve initial recording audit');
      assertEqual(corrected.customerAcceptance?.updatedAt, '2026-06-19 11:00', 'correction should record latest update audit');
      assertEqual(corrected.customerAcceptance?.correctionReason, '甲方复核后更正评分', 'correction should retain its reason');
      assertEqual(corrected.operationRecords.length, 2, 'initial entry and correction should both remain in operation history');
      assertEqual(corrected.operationRecords[0]?.action, '更正甲方验收', 'latest operation should identify the correction');
      assert(corrected.operationRecords[0]?.summary.includes('82 分') && corrected.operationRecords[0]?.summary.includes('90 分'), 'correction audit should retain before and after values');
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
  const passedTestNames: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed,
    passedTestNames,
    total: tests.length
  };
}
