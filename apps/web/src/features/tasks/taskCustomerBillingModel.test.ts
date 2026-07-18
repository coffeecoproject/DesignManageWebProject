import type {
  BrandSettlementPolicyVersionRecord,
  BrandTaskPriceVersionRecord
} from '../customers/brandTaskPricingModel';
import {
  buildCustomerTaskBillingFact,
  buildCustomerTaskContractUsageSummaries,
  buildCustomerTaskSettlementBatches,
  buildTaskCustomerBillingSnapshot,
  type CustomerTaskBillingFact
} from './taskCustomerBillingModel';
import { buildTaskAcceptanceArchiveFile } from './taskAcceptanceEvidenceModel';

type UnitTest = { name: string; run: () => void };
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function assertEqual<T>(actual: T, expected: T, message: string) { if (!Object.is(actual, expected)) throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`); }

const priceVersion: BrandTaskPriceVersionRecord = {
  billable: true,
  brandId: 'brand-a',
  contractId: 'contract-a',
  currency: 'CNY',
  effectiveFrom: '2026-01-01',
  id: 'brand-price-a-v1',
  status: '生效中',
  taskConfigId: 'task-floor-plan',
  unitPrice: 4800,
  version: 1
};

function createSettlementPolicyVersion(
  mode: '按任务结算' | '按月汇总'
): BrandSettlementPolicyVersionRecord {
  return {
    brandId: 'brand-a',
    effectiveFrom: '2026-01-01',
    id: `brand-settlement-a-${mode === '按任务结算' ? 'per-task' : 'monthly'}-v1`,
    policy: mode === '按任务结算' ? { mode, perTaskDueDays: 30 } : { mode, monthlyDueDay: 15 },
    status: '生效中',
    version: 1
  };
}

function createSnapshot(
  taskId = 'task-a',
  mode: '按任务结算' | '按月汇总' = '按任务结算',
  resolvedPriceVersion: BrandTaskPriceVersionRecord = priceVersion
) {
  return buildTaskCustomerBillingSnapshot({
    brandId: 'brand-a',
    brandName: '品牌 A',
    capturedAt: '2026-06-01 10:00',
    contract: {
      amount: null,
      amountMode: '无固定金额',
      code: 'CON-001',
      customerId: 'customer-a',
      expiresAt: '2026-12-31',
      files: [{ type: '已签署合同' }],
      id: 'contract-a',
      name: '测试合同',
      signedAt: '2026-01-01',
      status: '有效'
    },
    customerId: 'customer-a',
    customerName: '客户 A',
    priceVersion: resolvedPriceVersion,
    settlementPolicyVersion: createSettlementPolicyVersion(mode),
    taskConfigId: 'task-floor-plan',
    taskId
  });
}

function createFact(taskId: string, acceptedAt: string, mode: '按任务结算' | '按月汇总' = '按任务结算') {
  const fact = buildCustomerTaskBillingFact({
    acceptedAt,
    code: `TASK-${taskId}`,
    customerBillingSnapshot: createSnapshot(taskId, mode),
    files: [buildTaskAcceptanceArchiveFile({
      acceptedAt,
      acceptedBy: '验收人',
      task: { code: `TASK-${taskId}`, id: taskId }
    })],
    id: taskId,
    name: `任务 ${taskId}`,
    status: '已完成',
    storeId: 'store-a'
  });
  assert(fact, 'completed task with snapshot should create a fact');
  return fact;
}

const tests: UnitTest[] = [
  {
    name: 'TR-06 task snapshot freezes the resolved price version',
    run() {
      const firstSnapshot = createSnapshot('task-before-repricing');
      const secondSnapshot = createSnapshot('task-after-repricing', '按任务结算', {
        ...priceVersion,
        effectiveFrom: '2026-07-01',
        id: 'brand-price-a-v2',
        unitPrice: 5200,
        version: 2
      });

      assertEqual(firstSnapshot?.priceVersionId, 'brand-price-a-v1', 'existing task should retain the original price version id');
      assertEqual(firstSnapshot?.unitPrice, 4800, 'existing task should retain the original price');
      assertEqual(secondSnapshot?.priceVersionId, 'brand-price-a-v2', 'new task should use the new price version id');
      assertEqual(secondSnapshot?.unitPrice, 5200, 'new task should use the new price');
    }
  },
  {
    name: 'TR-07 completed task creates one customer billing fact',
    run() {
      const fact = createFact('task-a', '2026-06-15 12:00');
      assertEqual(fact.amount, 4800, 'fact amount should come from snapshot');
      assertEqual(fact.id, 'task-billing-fact-task-a', 'fact id should be stable');
    }
  },
  {
    name: 'TR-30 customer billing fact requires a real acceptance archive URL',
    run() {
      const fact = buildCustomerTaskBillingFact({
        acceptedAt: '2026-06-15 12:00',
        code: 'TASK-NO-ARCHIVE',
        customerBillingSnapshot: createSnapshot('task-no-archive'),
        files: [{
          id: 'task-no-archive-label-only',
          name: '验收归档',
          source: '业务服务器',
          stage: '验收归档',
          status: '已生成',
          type: '验收记录',
          updatedAt: '2026-06-15 12:00'
        }],
        id: 'task-no-archive',
        name: '缺少归档地址任务',
        status: '已完成',
        storeId: 'store-a'
      });

      assertEqual(fact, undefined, 'label-only acceptance evidence must not create a customer billing fact');
    }
  },
  {
    name: 'TR-09 rework acceptance keeps the same billing fact identity',
    run() {
      const first = createFact('task-rework', '2026-06-15 12:00');
      const second = createFact('task-rework', '2026-06-16 12:00');
      assertEqual(first.id, second.id, 'rework acceptance must retain the task billing identity');
    }
  },
  {
    name: 'TR-10 stopped task does not create a billing fact',
    run() {
      const fact = buildCustomerTaskBillingFact({
        acceptedAt: '2026-06-15 12:00',
        code: 'TASK-STOPPED',
        customerBillingSnapshot: createSnapshot('task-stopped'),
        id: 'task-stopped',
        name: '已中止任务',
        status: '已中止',
        storeId: 'store-a'
      });
      assertEqual(fact, undefined, 'stopped task must not create a billing fact');
    }
  },
  {
    name: 'TR-11 non-billable task creates fact but no receivable batch',
    run() {
      const snapshot = createSnapshot();
      assert(snapshot, 'snapshot should exist');
      snapshot.billable = false;
      snapshot.unitPrice = 0;
      const fact = buildCustomerTaskBillingFact({
        acceptedAt: '2026-06-15 12:00', code: 'TASK-NB', customerBillingSnapshot: snapshot,
        files: [buildTaskAcceptanceArchiveFile({
          acceptedAt: '2026-06-15 12:00', acceptedBy: '验收人', task: { code: 'TASK-NB', id: 'task-nb' }
        })],
        id: 'task-nb', name: '不计费任务', status: '已完成', storeId: 'store-a'
      });
      assert(fact, 'non-billable completed task should retain trace fact');
      assertEqual(buildCustomerTaskSettlementBatches({ asOfDate: '2026-07-17', facts: [fact] }).batches.length, 0, 'non-billable fact should not create AR');
    }
  },
  {
    name: 'TR-12 per-task settlement creates one deterministic batch',
    run() {
      const result = buildCustomerTaskSettlementBatches({ asOfDate: '2026-07-17', facts: [createFact('task-a', '2026-06-15 12:00')] });
      assertEqual(result.batches[0]?.id, 'task-revenue:task-a', 'per-task batch key should be deterministic');
      assertEqual(result.batches[0]?.dueDate, '2026-07-15', 'per-task due date should use accepted date plus due days');
    }
  },
  {
    name: 'TR-13 monthly settlement aggregates facts after month end',
    run() {
      const facts: CustomerTaskBillingFact[] = [
        createFact('task-a', '2026-06-10 12:00', '按月汇总'),
        createFact('task-b', '2026-06-20 12:00', '按月汇总')
      ];
      const closed = buildCustomerTaskSettlementBatches({ asOfDate: '2026-07-01', facts });
      assertEqual(closed.batches.length, 1, 'closed month should create one aggregate');
      assertEqual(closed.batches[0]?.amount, 9600, 'monthly aggregate should sum task facts');
      assertEqual(closed.batches[0]?.lineItems.length, 2, 'monthly aggregate should retain task trace lines');
    }
  },
  {
    name: 'TR-14 monthly settlement does not freeze before month end',
    run() {
      const result = buildCustomerTaskSettlementBatches({
        asOfDate: '2026-06-30',
        facts: [createFact('task-current-month', '2026-06-20 12:00', '按月汇总')]
      });
      assertEqual(result.batches.length, 0, 'current month must not freeze early');
    }
  },
  {
    name: 'TR-17 fixed contract cap only creates a management warning and never blocks settlement',
    run() {
      const first = createFact('task-cap-a', '2026-06-10 12:00');
      const second = createFact('task-cap-b', '2026-06-11 12:00');
      first.billingSnapshot.contractAmount = 7000;
      first.billingSnapshot.contractAmountMode = '固定金额';
      second.billingSnapshot.contractAmount = 7000;
      second.billingSnapshot.contractAmountMode = '固定金额';
      const result = buildCustomerTaskSettlementBatches({ asOfDate: '2026-07-17', facts: [first, second] });
      const usage = buildCustomerTaskContractUsageSummaries({
        contracts: [{
          amount: 7000,
          amountMode: '固定金额',
          code: 'CON-001',
          customerId: 'customer-a',
          expiresAt: '2026-12-31',
          files: [{ type: '已签署合同' }],
          id: 'contract-a',
          name: '测试合同',
          signedAt: '2026-01-01',
          status: '有效'
        }],
        facts: [first, second],
        priceVersions: [priceVersion]
      });

      assertEqual(result.batches.length, 2, 'contract cap must not remove accepted task settlement batches');
      assertEqual(usage[0]?.status, '已超出', 'usage at or over the contract amount should warn management');
      assertEqual(usage[0]?.settledAmount, 9600, 'usage should sum accepted billable facts');
      assertEqual(usage[0]?.overageAmount, 2600, 'usage should expose the overage without blocking settlement');
    }
  },
  {
    name: 'TR-17 fixed contract usage warns at eighty percent',
    run() {
      const first = createFact('task-cap-near-a', '2026-06-10 12:00');
      const second = createFact('task-cap-near-b', '2026-06-11 12:00');
      const usage = buildCustomerTaskContractUsageSummaries({
        contracts: [{
          amount: 12000,
          amountMode: '固定金额',
          code: 'CON-001',
          customerId: 'customer-a',
          expiresAt: '2026-12-31',
          files: [{ type: '已签署合同' }],
          id: 'contract-a',
          name: '测试合同',
          signedAt: '2026-01-01',
          status: '有效'
        }],
        facts: [first, second],
        priceVersions: [priceVersion]
      });

      assertEqual(usage[0]?.usageRate, 0.8, 'usage rate should be derived from accepted billable facts');
      assertEqual(usage[0]?.status, '接近上限', 'eighty percent usage should trigger the soft warning');
    }
  },
  {
    name: 'TR-17 contract without a fixed amount has no usage warning',
    run() {
      const usage = buildCustomerTaskContractUsageSummaries({
        contracts: [{
          amount: null,
          amountMode: '无固定金额',
          code: 'CON-001',
          customerId: 'customer-a',
          expiresAt: '2026-12-31',
          files: [{ type: '已签署合同' }],
          id: 'contract-a',
          name: '测试合同',
          signedAt: '2026-01-01',
          status: '有效'
        }],
        facts: [createFact('task-unlimited', '2026-06-10 12:00')],
        priceVersions: [priceVersion]
      });

      assertEqual(usage.length, 0, 'contract without a fixed amount should not create a usage status');
    }
  },
  {
    name: 'TR-17 configured fixed contract remains visible before the first task settles',
    run() {
      const usage = buildCustomerTaskContractUsageSummaries({
        contracts: [{
          amount: 58000,
          amountMode: '固定金额',
          code: 'CON-001',
          customerId: 'customer-a',
          expiresAt: '2026-12-31',
          files: [{ type: '已签署合同' }],
          id: 'contract-a',
          name: '测试合同',
          signedAt: '2026-01-01',
          status: '有效'
        }],
        facts: [],
        priceVersions: [priceVersion]
      });

      assertEqual(usage.length, 1, 'configured fixed contract should be the management usage ledger master record');
      assertEqual(usage[0]?.brandIds[0], 'brand-a', 'configured brand should retain the contract usage relation');
      assertEqual(usage[0]?.settledAmount, 0, 'contract usage should start at zero before accepted task facts');
      assertEqual(usage[0]?.remainingAmount, 58000, 'full contract amount should remain available before settlement');
      assertEqual(usage[0]?.status, '正常', 'zero usage should be a normal management status');
    }
  },
  {
    name: 'TR-18 expired contract cannot create a new billing snapshot',
    run() {
      const snapshot = buildTaskCustomerBillingSnapshot({
        brandId: 'brand-a',
        brandName: '品牌 A',
        capturedAt: '2027-01-02 09:00',
        contract: {
          amount: null,
          amountMode: '无固定金额',
          code: 'CON-EXPIRED',
          customerId: 'customer-a',
          expiresAt: '2026-12-31',
          files: [{ type: '已签署合同' }],
          id: 'contract-a',
          name: '已到期合同',
          signedAt: '2026-01-01',
          status: '有效'
        },
        customerId: 'customer-a',
        customerName: '客户 A',
        priceVersion,
        settlementPolicyVersion: createSettlementPolicyVersion('按任务结算'),
        taskConfigId: 'task-floor-plan',
        taskId: 'task-expired-contract'
      });
      assertEqual(snapshot, undefined, 'expired contract must not back a new task snapshot');
    }
  }
];

export function runTaskCustomerBillingModelTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];
  for (const test of tests) {
    try { test.run(); passedTestNames.push(test.name); }
    catch (error) { failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { executedTestNames: tests.map((test) => test.name), failures, passed: passedTestNames.length, passedTestNames, total: tests.length };
}
