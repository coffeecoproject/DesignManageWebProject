import {
  brandRecords,
  customerRecords,
  storeRecords
} from '../customers/customerData';
import type {
  CustomerTaskBillingFact,
  CustomerTaskSettlementBatch
} from '../tasks/taskCustomerBillingModel';
import {
  buildCustomerTaskReceivablePayableRecord,
  getCustomerTaskSettlementMergeIssues,
  mergeCustomerTaskReceivablePayableRecords,
  reconcileCustomerTaskReversals
} from './financeCustomerTaskSettlementModel';

type UnitTest = { name: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const customer = customerRecords.find((row) => row.id === 'customer-starry');
const brand = brandRecords.find((row) => row.id === 'brand-starry-space');

assert(customer, 'customer fixture should exist');
assert(brand, 'brand fixture should exist');

function createAcceptanceEvidence(taskId: string, taskCode: string, acceptedAt: string) {
  return [{
    id: `task-acceptance-archive-${taskId}`,
    name: `${taskCode} 任务验收记录.pdf`,
    source: '业务服务器',
    status: '已生成',
    type: '验收记录',
    updatedAt: acceptedAt,
    url: `/records/tasks/${taskCode}/acceptance/${acceptedAt.slice(0, 10)}.pdf`
  }];
}

const taskBatch: CustomerTaskSettlementBatch = {
  amount: 16800,
  brandId: brand.id,
  brandName: brand.name,
  contractAmount: 100000,
  contractAmountMode: '固定金额',
  contractCode: 'CON-2026-001',
  contractId: 'contract-starry-framework',
  contractName: '星际空间设计服务框架合同',
  customerId: customer.id,
  customerName: customer.name,
  dueDate: '2026-07-15',
  generatedAt: '2026-07-17',
  id: 'task-revenue:2026-06:customer-starry:brand-starry-space:contract-starry-framework',
  lineItems: [
    {
      acceptedAt: '2026-06-10 16:00',
      acceptedBy: '李明',
      acceptanceEvidence: createAcceptanceEvidence('store-task-2026-004', 'TASK-2026-004', '2026-06-10 16:00'),
      amount: 12000,
      priceVersion: 1,
      priceVersionId: 'brand-price-starry-full-v1',
      storeId: 'store-wh-optics',
      taskCode: 'TASK-2026-004',
      taskId: 'store-task-2026-004',
      taskName: '武汉光谷店全套施工图',
      unitPrice: 12000
    },
    {
      acceptedAt: '2026-06-20 14:15',
      acceptedBy: '李明',
      acceptanceEvidence: createAcceptanceEvidence('store-task-2026-007', 'TASK-2026-007', '2026-06-20 14:15'),
      amount: 4800,
      priceVersion: 1,
      priceVersionId: 'brand-price-starry-floor-v1',
      storeId: 'store-wh-hankou',
      taskCode: 'TASK-2026-007',
      taskId: 'store-task-2026-007',
      taskName: '武汉汉口店平面方案',
      unitPrice: 4800
    }
  ],
  settlementMode: '按月汇总',
  settlementPolicyVersionId: 'brand-settlement-starry-v1',
  settlementPeriod: '2026-06'
};

function createReversedBillingFact(line: CustomerTaskSettlementBatch['lineItems'][number]): CustomerTaskBillingFact {
  return {
    acceptedAt: line.acceptedAt,
    acceptedBy: line.acceptedBy,
    acceptanceEvidence: line.acceptanceEvidence,
    amount: line.amount,
    billingSnapshot: {
      billable: true,
      brandId: taskBatch.brandId,
      brandName: taskBatch.brandName,
      capturedAt: '2026-06-01 09:00',
      contractAmount: taskBatch.contractAmount,
      contractAmountMode: taskBatch.contractAmountMode,
      contractCode: taskBatch.contractCode,
      contractId: taskBatch.contractId,
      contractName: taskBatch.contractName,
      currency: 'CNY',
      customerId: taskBatch.customerId,
      customerName: taskBatch.customerName,
      id: `task-billing-snapshot-${line.taskId}`,
      priceVersion: line.priceVersion,
      priceVersionId: line.priceVersionId,
      settlementPolicy: { mode: '按月汇总', monthlyDueDay: 15 },
      settlementPolicyVersion: 1,
      settlementPolicyVersionId: taskBatch.settlementPolicyVersionId,
      taskConfigId: 'task-type-store-image',
      taskId: line.taskId,
      unitPrice: line.unitPrice
    },
    brandId: taskBatch.brandId,
    customerId: taskBatch.customerId,
    id: `task-billing-fact-${line.taskId}`,
    reversedAt: '2026-07-18 10:00',
    reversedBy: '李明',
    reversalReason: '验收结果录入错误',
    settlementPeriod: taskBatch.settlementPeriod,
    status: '已冲销',
    storeId: line.storeId,
    taskCode: line.taskCode,
    taskId: line.taskId,
    taskName: line.taskName
  };
}

const tests: UnitTest[] = [
  {
    name: 'TR-27 reversed acceptance directly voids an unconsumed task receivable',
    run() {
      const singleLineBatch = { ...taskBatch, amount: taskBatch.lineItems[0]!.amount, lineItems: [taskBatch.lineItems[0]!] };
      const record = buildCustomerTaskReceivablePayableRecord({
        batch: singleLineBatch,
        brand,
        customer,
        stores: storeRecords
      });
      const result = reconcileCustomerTaskReversals({
        canDirectCorrect: () => true,
        facts: [createReversedBillingFact(singleLineBatch.lineItems[0]!)],
        records: [record]
      });

      assertEqual(result.records[0]?.confirmationStatus, '已作废', 'unconsumed receivable should be voided');
      assertEqual(result.issues.length, 0, 'direct reversal should not leave a finance issue');
    }
  },
  {
    name: 'TR-28 reversed acceptance with finance downstream requires voucher correction',
    run() {
      const singleLineBatch = { ...taskBatch, amount: taskBatch.lineItems[0]!.amount, lineItems: [taskBatch.lineItems[0]!] };
      const record = buildCustomerTaskReceivablePayableRecord({
        batch: singleLineBatch,
        brand,
        customer,
        stores: storeRecords
      });
      const result = reconcileCustomerTaskReversals({
        canDirectCorrect: () => false,
        facts: [createReversedBillingFact(singleLineBatch.lineItems[0]!)],
        records: [record]
      });

      assertEqual(result.records[0]?.confirmationStatus, '已确认', 'consumed receivable must retain its history');
      assertEqual(result.issues[0]?.kind, '来源撤销待财务更正', 'finance correction should be explicit');
    }
  },
  {
    name: 'TR-13 monthly task batch becomes one confirmed receivable with source lines',
    run() {
      const record = buildCustomerTaskReceivablePayableRecord({
        batch: taskBatch,
        brand,
        customer,
        stores: storeRecords
      });

      assertEqual(record.direction, '应收', 'task settlement should create receivable');
      assertEqual(record.confirmationStatus, '已确认', 'internal acceptance should already confirm source fact');
      assertEqual(record.category, '设计服务收入', 'accrual category should describe revenue, not cash collection');
      assertEqual(record.amount, 16800, 'receivable should equal task line sum');
      assertEqual(record.taskSettlement?.lineItems.length, 2, 'receivable should retain task trace lines');
      assertEqual(record.taskSettlement?.contractCode, 'CON-2026-001', 'receivable should retain contract snapshot');
      assert(
        record.files.every((file) => Boolean(file.url)),
        'receivable evidence should reuse acceptance archives with real URLs'
      );
    }
  },
  {
    name: 'settlement adapter is idempotent and preserves existing finance lifecycle state',
    run() {
      const first = mergeCustomerTaskReceivablePayableRecords({
        batches: [taskBatch],
        brands: brandRecords,
        customers: customerRecords,
        records: [],
        stores: storeRecords
      });
      const settled = first.map((record) => ({
        ...record,
        linkedTransactionNos: ['FIN-202607-0001'],
        settledAmount: 5000,
        settlementStatus: '部分结清' as const
      }));
      const second = mergeCustomerTaskReceivablePayableRecords({
        batches: [taskBatch],
        brands: brandRecords,
        customers: customerRecords,
        records: settled,
        stores: storeRecords
      });

      assertEqual(second.length, 1, 'same task batch must not create duplicate receivable');
      assertEqual(second[0]?.settledAmount, 5000, 're-derivation must not overwrite finance settlement state');
      assertEqual(second[0]?.linkedTransactionNos[0], 'FIN-202607-0001', 're-derivation must preserve linked cash flow');
    }
  },
  {
    name: 'TR-15 late monthly fact keeps original receivable and creates a later-period adjustment receivable',
    run() {
      const originalRecord = buildCustomerTaskReceivablePayableRecord({ batch: taskBatch, brand, customer, stores: storeRecords });
      const nextBatch: CustomerTaskSettlementBatch = {
        ...taskBatch,
        amount: 18400,
        lineItems: [
          ...taskBatch.lineItems,
          {
            acceptedAt: '2026-07-02 09:00',
            acceptedBy: '李明',
            acceptanceEvidence: createAcceptanceEvidence('task-late-001', 'TASK-LATE-001', '2026-07-02 09:00'),
            amount: 1600,
            priceVersion: 1,
            priceVersionId: 'brand-price-starry-image-v1',
            storeId: 'store-wh-optics',
            taskCode: 'TASK-LATE-001',
            taskId: 'task-late-001',
            taskName: '迟到验收任务',
            unitPrice: 1600
          }
        ]
      };
      const merged = mergeCustomerTaskReceivablePayableRecords({
        batches: [nextBatch], brands: brandRecords, customers: customerRecords, records: [originalRecord], stores: storeRecords
      });
      const issues = getCustomerTaskSettlementMergeIssues({
        batches: [nextBatch],
        brands: brandRecords,
        customers: customerRecords,
        records: merged
      });

      assertEqual(merged[0]?.amount, 16800, 'late fact must not rewrite the original receivable');
      assertEqual(merged.length, 2, 'late fact should create one adjustment receivable');
      assertEqual(merged[1]?.amount, 1600, 'adjustment receivable should contain only the late fact amount');
      assertEqual(merged[1]?.accountingPeriod, '2026-07', 'adjustment receivable should enter the generated period');
      assertEqual(merged[1]?.taskSettlement?.recordKind, '后续调整', 'adjustment should be explicitly traceable');
      assertEqual(issues.length, 0, 'created adjustment should close the late-fact issue');
    }
  },
  {
    name: 'TR-26 missing source master data is visible and never silently creates a receivable',
    run() {
      const merged = mergeCustomerTaskReceivablePayableRecords({
        batches: [taskBatch],
        brands: [],
        customers: customerRecords,
        records: [],
        stores: storeRecords
      });
      const issues = getCustomerTaskSettlementMergeIssues({
        batches: [taskBatch],
        brands: [],
        customers: customerRecords,
        records: merged
      });

      assertEqual(merged.length, 0, 'missing brand master data must not create an incomplete receivable');
      assertEqual(issues.length, 1, 'missing source master data must create a visible handoff issue');
      assertEqual(issues[0]?.kind, '来源主数据缺失', 'handoff issue should distinguish missing master data');
      assert(issues[0]?.message.includes('品牌档案'), 'handoff issue should identify the missing dimension');
    }
  },
  {
    name: 'TR-19 receivable retains customer brand and contract name snapshots',
    run() {
      const renamedBrand = { ...brand, name: '品牌已改名' };
      const renamedCustomer = { ...customer, name: '客户已改名' };
      const record = buildCustomerTaskReceivablePayableRecord({
        batch: taskBatch,
        brand: renamedBrand,
        customer: renamedCustomer,
        stores: storeRecords
      });

      assertEqual(record.counterparty, taskBatch.customerName, 'receivable should use the frozen customer name');
      assertEqual(record.taskSettlement?.brandName, taskBatch.brandName, 'receivable should use the frozen brand name');
      assertEqual(record.taskSettlement?.contractName, taskBatch.contractName, 'receivable should retain the frozen contract name');
    }
  },
  {
    name: 'TR-20 later repricing does not overwrite an existing receivable',
    run() {
      const original = buildCustomerTaskReceivablePayableRecord({ batch: taskBatch, brand, customer, stores: storeRecords });
      const repricedBatch = {
        ...taskBatch,
        amount: 20000,
        lineItems: taskBatch.lineItems.map((line) => ({ ...line, amount: 10000, unitPrice: 10000 }))
      };
      const merged = mergeCustomerTaskReceivablePayableRecords({
        batches: [repricedBatch], brands: brandRecords, customers: customerRecords, records: [original], stores: storeRecords
      });

      assertEqual(merged[0]?.amount, 16800, 'repricing must not rewrite an existing receivable');
      assertEqual(merged[0]?.taskSettlement?.lineItems[0]?.unitPrice, 12000, 'historical price snapshot must remain unchanged');
    }
  }
];

export function runFinanceCustomerTaskSettlementModelTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];

  for (const test of tests) {
    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed: passedTestNames.length,
    passedTestNames,
    total: tests.length
  };
}
