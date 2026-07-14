import { peopleMembers } from '../people/mockData';
import { performanceRulePresets } from '../performance/performanceMockData';
import type { AcceptanceScoringDraft } from '../tasks/taskAcceptanceModel';
import { applyTaskAcceptanceCommit, type TaskWorkflowState } from '../tasks/taskAcceptanceCommitModel';
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
    acceptorName: '示例全职 A',
    brandId: 'brand-starry-space',
    code,
    createdAt: '2026-06-10 09:00',
    customerId: 'customer-starry',
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
    updatedAt: '2026-06-14 17:00'
  };
}

function createWorkflowState(tasks: StoreTaskRecord[]): TaskWorkflowState {
  return {
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
    name: 'NP-06 FRONTEND-CHAIN blocks task acceptance before state mutation when tax identity or gross amount is invalid',
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

      assert(!identityResult.success, 'pending tax identity should block the page acceptance action');
      assertEqual(identityResult.message, '兼职执行人的税务身份尚未确认', 'identity blocker should be explicit');

      const invalidAmountTask = createReadyTask({ amount: 0, code: 'TASK-PT-FRONT-005', id: 'task-pt-front-005' });
      const amountResult = prepareTaskAcceptanceCommit({
        acceptedAt: '2026-06-15 10:00',
        performanceRuleRows: [performanceRule],
        person: partTimePerson,
        scoringDraft: createReadyScoringDraft(),
        task: invalidAmountTask
      });

      assert(!amountResult.success, 'invalid tax-inclusive amount should block the page acceptance action');
      assertEqual(amountResult.message, '兼职任务税前约定金额无效', 'amount blocker should be explicit');

      const unchangedState = createWorkflowState([identityPendingTask, invalidAmountTask]);
      const settlementResult = buildSettlementResult(unchangedState, [identityPendingPerson, partTimePerson]);

      assert(unchangedState.storeTaskRows.every((row) => row.status === '待验收'), 'blocked acceptance should not complete any task');
      assertEqual(unchangedState.partTimeLaborAcceptanceRows.length, 0, 'blocked acceptance should not write labor facts');
      assertEqual(unchangedState.taskPerformanceScoringRows.length, 0, 'blocked acceptance should not write performance scoring');
      assertEqual(settlementResult.batches.length, 0, 'blocked acceptance should not derive a labor settlement batch');
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
