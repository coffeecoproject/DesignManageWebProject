import { peopleMembers } from '../people/mockData';
import { defaultBrandAcceptancePolicy } from '../customers/brandAcceptancePolicyModel';
import { performanceRulePresets } from '../performance/performanceMockData';
import type { AcceptanceScoringDraft } from '../tasks/taskAcceptanceModel';
import {
  applyTaskAcceptanceCommit,
  applyTaskAcceptanceReversal,
  type TaskWorkflowState
} from '../tasks/taskAcceptanceCommitModel';
import { prepareTaskAcceptanceCommit } from '../tasks/taskAcceptanceWorkflow';
import type { StoreTaskRecord } from '../tasks/TaskManagementState';
import { buildPartTimeLaborSettlementBatches } from '../tasks/partTimeLaborSettlementModel';
import { mergePartTimeLaborReceivablePayableRecords } from './financePartTimeLaborSettlementModel';

type UnitTest = {
  name: string;
  run: () => void;
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

function requireFixture<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

const performanceRule = requireFixture(
  performanceRulePresets[0],
  'part-time labor performance rule fixture is missing'
);
const partTimePerson = requireFixture(
  peopleMembers.find((person) => person.id === '20260006'),
  'part-time labor person fixture is missing'
);

function createReadyScoringDraft(): AcceptanceScoringDraft {
  const scoreItem = performanceRule.taskScoreItems.find(
    (item) => item.taskConfigId === 'task-type-store-image'
  );

  assert(scoreItem, 'performance rule should include the store-image score item');

  return {
    adjustmentReason: '',
    dimensionScores: performanceRule.qualityDimensions.map((dimension) => ({
      id: dimension.id,
      maxScore: dimension.score,
      name: dimension.name,
      score: dimension.score
    })),
    ruleId: performanceRule.id,
    scoreItemId: scoreItem.id,
    scoreValue: scoreItem.score,
    sourceMonth: '2026-06'
  };
}

function createReadyTask({
  amount,
  code,
  id,
  projectId = 'HZ-PT-2026-0006/STORE-IMAGE'
}: {
  amount: number;
  code: string;
  id: string;
  projectId?: string;
}): StoreTaskRecord {
  return {
    acceptorId: '20260001',
    acceptorName: '李明',
    brandId: 'brand-starry-space',
    code,
    createdAt: '2026-06-10 09:00',
    customerId: 'customer-starry',
    customerBillingSnapshot: {
      acceptancePolicy: defaultBrandAcceptancePolicy,
      billable: true,
      brandId: 'brand-starry-space',
      brandName: '星际空间',
      capturedAt: '2026-06-10 09:00',
      contractAmount: null,
      contractAmountMode: '无固定金额',
      currency: 'CNY',
      customerId: 'customer-starry',
      customerName: '湖南新岚餐饮管理有限公司',
      id: `task-billing-snapshot-${id}`,
      priceVersion: 1,
      priceVersionId: 'brand-price-starry-image-v1',
      settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
      settlementPolicyVersion: 1,
      settlementPolicyVersionId: 'brand-settlement-starry-v1',
      taskConfigId: 'task-type-store-image',
      taskId: id,
      unitPrice: 1600
    },
    executorId: partTimePerson.id,
    executorName: partTimePerson.name,
    files: [
      {
        id: `${id}-delivery`,
        name: `${code}-交付文件.png`,
        registeredBy: partTimePerson.name,
        source: '业务服务器',
        stage: '交付文件',
        status: '已登记',
        type: '图片',
        updatedAt: '2026-06-14 17:00',
        url: `/mock/tasks/${id}/delivery.png`
      }
    ],
    id,
    laborAgreement: {
      agreedGrossAmount: amount,
      agreementVersion: 'HZ-PT-2026-0006/V1',
      projectId
    },
    name: `${partTimePerson.name} 门店图任务`,
    note: '',
    operationRecords: [],
    plannedDeliveryAt: '2026-06-15 18:00',
    plannedDurationHours: 8,
    reworkCount: 0,
    status: '待验收',
    storeId: 'store-starry-test',
    submittedAt: '2026-06-14 17:00',
    taskConfigId: 'task-type-store-image',
    taskDefinitionSnapshot: {
      capturedAt: '2026-06-10 09:00', category: '设计交付', code: 'TASK-IMAGE', deliveryHints: [], id: 'task-type-store-image', name: '门店图'
    },
    updatedAt: '2026-06-14 17:00'
  };
}

function createWorkflowState(tasks: StoreTaskRecord[]): TaskWorkflowState {
  return {
    customerTaskBillingFacts: [],
    partTimeLaborAcceptanceRows: [],
    storeTaskRows: tasks,
    taskPerformanceScoringRows: []
  };
}

function acceptTask(state: TaskWorkflowState, task: StoreTaskRecord, person = partTimePerson) {
  const prepared = prepareTaskAcceptanceCommit({
    acceptedAt: '2026-06-15 10:00',
    performanceRuleRows: [performanceRule],
    person,
    scoringDraft: createReadyScoringDraft(),
    task
  });

  assert(prepared.success, `task acceptance should succeed: ${prepared.success ? '' : prepared.message}`);
  return applyTaskAcceptanceCommit(state, prepared.commitInput);
}

function buildSettlementResult(state: TaskWorkflowState, people = [partTimePerson]) {
  return buildPartTimeLaborSettlementBatches({
    acceptanceRecords: state.partTimeLaborAcceptanceRows,
    people,
    settlementPeriod: '2026-06',
    tasks: state.storeTaskRows
  });
}

const tests: UnitTest[] = [
  {
    name: 'NP-04 FRONTEND-CHAIN accepts a tax-inclusive part-time task and derives gross withholding and net payable',
    run: () => {
      const task = createReadyTask({ amount: 3200, code: 'TASK-PT-FRONT-001', id: 'task-pt-front-001' });
      const committedState = acceptTask(createWorkflowState([task]), task);
      const settlementResult = buildSettlementResult(committedState);

      assertEqual(settlementResult.blockers.length, 0, 'accepted task should have no settlement blocker');
      assertEqual(settlementResult.batches.length, 1, 'accepted task should produce one labor settlement batch');

      const receivablePayableRows = mergePartTimeLaborReceivablePayableRecords({
        batches: settlementResult.batches,
        people: [partTimePerson],
        records: []
      });
      const payable = receivablePayableRows[0];

      assert(payable?.naturalPersonPayment, 'labor settlement batch should derive a natural-person payable');
      assertEqual(payable.amount, 3200, 'payable should retain the tax-inclusive agreement amount');
      assertEqual(payable.naturalPersonPayment.grossIncomeAmount, 3200, 'payment snapshot should retain gross labor income');
      assertEqual(payable.naturalPersonPayment.withheldTaxAmount, 480, 'resident labor withholding should be calculated from gross income');
      assertEqual(payable.naturalPersonPayment.netPaymentAmount, 2720, 'employee net payment should exclude withheld IIT');
      assertEqual(payable.naturalPersonPayment.sourceRecordNos?.[0], task.code, 'payment snapshot should retain the accepted task source');
    }
  },
  {
    name: 'NP-05 FRONTEND-CHAIN merges same-project continuous labor and separates different projects',
    run: () => {
      const firstTask = createReadyTask({ amount: 1200, code: 'TASK-PT-FRONT-002', id: 'task-pt-front-002' });
      const secondTask = createReadyTask({ amount: 2000, code: 'TASK-PT-FRONT-003', id: 'task-pt-front-003' });
      let state = createWorkflowState([firstTask, secondTask]);
      state = acceptTask(state, firstTask);
      state = acceptTask(state, secondTask);

      const settlementResult = buildSettlementResult(state);
      const receivablePayableRows = mergePartTimeLaborReceivablePayableRecords({
        batches: settlementResult.batches,
        people: [partTimePerson],
        records: []
      });

      assertEqual(settlementResult.blockers.length, 0, 'same-period accepted tasks should not be blocked');
      assertEqual(settlementResult.batches.length, 1, 'same person, project and period should produce one labor batch');
      assertEqual(settlementResult.batches[0]?.grossAmount, 3200, 'labor batch should add both tax-inclusive task amounts');
      assertEqual(settlementResult.batches[0]?.sources.length, 2, 'labor batch should retain both task sources');
      assertEqual(receivablePayableRows.length, 1, 'one labor batch should produce one payable');
      assertEqual(receivablePayableRows[0]?.naturalPersonPayment?.sourceRecordNos?.length, 2, 'payable snapshot should retain both source tasks');

      const otherProjectTask = createReadyTask({
        amount: 800,
        code: 'TASK-PT-FRONT-004-PROJECT-B',
        id: 'task-pt-front-004-project-b',
        projectId: 'HZ-PT-2026-0006/STORE-IMAGE-B'
      });
      const separateProjectState = acceptTask(
        createWorkflowState([firstTask, otherProjectTask]),
        firstTask
      );
      const completedSeparateProjectState = acceptTask(separateProjectState, otherProjectTask);
      const separateProjectResult = buildSettlementResult(completedSeparateProjectState);

      assertEqual(separateProjectResult.batches.length, 2, 'different projects should produce two labor withholding batches');
    }
  },
  {
    name: 'NP-06 FRONTEND-CHAIN keeps customer acceptance independent while labor source remains blocked',
    run: () => {
      const identityPendingTask = createReadyTask({ amount: 3200, code: 'TASK-PT-FRONT-004', id: 'task-pt-front-004' });
      const identityPendingPerson = {
        ...partTimePerson,
        taxIdentityProfile: {
          identityType: '居民个人' as const,
          status: '待确认' as const
        }
      };
      const identityResult = prepareTaskAcceptanceCommit({
        acceptedAt: '2026-06-15 10:00',
        performanceRuleRows: [performanceRule],
        person: identityPendingPerson,
        scoringDraft: createReadyScoringDraft(),
        task: identityPendingTask
      });

      assert(identityResult.success, 'pending tax identity must not block customer acceptance');
      assertEqual(identityResult.warnings[0], '兼职执行人的税务身份尚未确认', 'labor blocker should remain explicit');

      const invalidAmountTask = createReadyTask({ amount: 0, code: 'TASK-PT-FRONT-005', id: 'task-pt-front-005' });
      const amountResult = prepareTaskAcceptanceCommit({
        acceptedAt: '2026-06-15 10:00',
        performanceRuleRows: [performanceRule],
        person: partTimePerson,
        scoringDraft: createReadyScoringDraft(),
        task: invalidAmountTask
      });

      assert(amountResult.success, 'invalid labor amount must not block customer acceptance');
      assertEqual(amountResult.warnings[0], '兼职任务税前约定金额无效', 'labor amount blocker should remain explicit');

      const acceptedIdentityState = applyTaskAcceptanceCommit(
        createWorkflowState([identityPendingTask, invalidAmountTask]),
        identityResult.commitInput
      );
      const acceptedState = applyTaskAcceptanceCommit(acceptedIdentityState, amountResult.commitInput);
      const settlementResult = buildSettlementResult(acceptedState, [identityPendingPerson, partTimePerson]);

      assert(acceptedState.storeTaskRows.every((row) => row.status === '已完成'), 'customer acceptance should complete both tasks');
      assertEqual(acceptedState.customerTaskBillingFacts.length, 2, 'customer billing facts should remain independent from labor blockers');
      assertEqual(acceptedState.partTimeLaborAcceptanceRows.length, 0, 'invalid labor sources must not write labor facts');
      assertEqual(acceptedState.taskPerformanceScoringRows.length, 2, 'customer acceptance should retain performance scoring');
      assertEqual(settlementResult.blockers.length, 2, 'labor settlement should surface both source blockers');
      assertEqual(settlementResult.batches.length, 0, 'invalid labor sources should not derive a labor settlement batch');
    }
  },
  {
    name: 'NP-20 FRONTEND-CHAIN voids an unconsumed labor payable after acceptance reversal and restores it after reacceptance',
    run: () => {
      const task = createReadyTask({ amount: 3200, code: 'TASK-PT-REV-001', id: 'task-pt-rev-001' });
      const committedState = acceptTask(createWorkflowState([task]), task);
      const initialBatches = buildSettlementResult(committedState).batches;
      const initialPayables = mergePartTimeLaborReceivablePayableRecords({
        batches: initialBatches,
        people: [partTimePerson],
        records: []
      });
      const reversedState = applyTaskAcceptanceReversal(committedState, {
        actor: '验收人',
        occurredAt: '2026-06-16 09:00',
        reason: '验收材料有误',
        taskId: task.id
      });
      const reversedPayables = mergePartTimeLaborReceivablePayableRecords({
        batches: buildSettlementResult(reversedState).batches,
        canDirectCorrect: () => true,
        people: [partTimePerson],
        records: initialPayables
      });

      assertEqual(reversedPayables[0]?.confirmationStatus, '已作废', 'acceptance reversal should void an unconsumed labor payable');

      const reacceptedState = acceptTask(reversedState, task);
      const restoredPayables = mergePartTimeLaborReceivablePayableRecords({
        batches: buildSettlementResult(reacceptedState).batches,
        canDirectCorrect: () => true,
        people: [partTimePerson],
        records: reversedPayables
      });

      assertEqual(restoredPayables.length, 1, 'reacceptance should reuse the deterministic labor payable identity');
      assertEqual(restoredPayables[0]?.confirmationStatus, '已确认', 'reacceptance should restore the current labor payable');
      assertEqual(restoredPayables[0]?.amount, 3200, 'restored labor payable should use the current accepted gross amount');
    }
  }
];

export function runPartTimeLaborFrontendWorkflowTests() {
  const failures: string[] = [];
  const executedTestNames: string[] = [];
  const passedTestNames: string[] = [];

  for (const test of tests) {
    executedTestNames.push(test.name);

    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames,
    failures,
    passed: tests.length - failures.length,
    passedTestNames,
    total: tests.length
  };
}
