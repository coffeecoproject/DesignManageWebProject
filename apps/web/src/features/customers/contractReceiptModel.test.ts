import { financeTransactionRecords } from '../finance/financeData';
import { financeReceivablePayableRecords } from '../finance/financeReceivablesPayablesData';
import { deriveCustomerContractReceiptViews } from './contractReceiptModel';
import type { CustomerContractRecord } from './customerData';

type UnitTest = { name: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const contract: CustomerContractRecord = {
  amount: 10000,
  amountMode: '固定金额',
  code: 'CON-TEST-001',
  customerId: 'customer-test',
  expiresAt: '2026-12-31',
  files: [],
  id: 'contract-test',
  name: '测试合同',
  note: '',
  owner: '李明',
  signedAt: '2026-01-01',
  stampDutyFacts: {
    amountTaxMode: '价税分列',
    businessNature: '设计及咨询服务',
    signedVersionNo: 'V1.0',
    vatAmount: 0
  },
  status: '有效',
  type: '项目合同',
  updatedAt: '2026-06-01'
};
const receivableSeed = financeReceivablePayableRecords[0]!;
const transactionSeed = financeTransactionRecords[0]!;

function createReceivable({
  contractId = contract.id,
  documentNo,
  id,
  linkedTransactionNos
}: {
  contractId?: string;
  documentNo: string;
  id: string;
  linkedTransactionNos: string[];
}) {
  return {
    ...receivableSeed,
    amount: 10000,
    confirmationStatus: '已确认' as const,
    contractId,
    counterparty: '测试客户',
    counterpartyId: contract.customerId,
    documentNo,
    id,
    linkedTransactionNos,
    settledAmount: 0,
    settlementStatus: '未结清' as const,
    sourceNo: documentNo,
    sourceTitle: '测试合同应收'
  };
}

function createTransaction({
  amount,
  direction = '收入' as const,
  occurredAt,
  status = '已入账' as const,
  transactionNo
}: {
  amount: number;
  direction?: '收入' | '支出';
  occurredAt: string;
  status?: '待复核' | '已入账';
  transactionNo: string;
}) {
  return {
    ...transactionSeed,
    amount,
    direction,
    id: `row-${transactionNo}`,
    occurredAt,
    relatedReceivableNo: undefined,
    sourceNo: transactionNo,
    status,
    transactionNo
  };
}

const tests: UnitTest[] = [
  {
    name: 'TR-32 derives contract receipts only from posted linked collections',
    run() {
      const receivable = createReceivable({
        documentNo: 'AR-TEST-001',
        id: 'ar-test-001',
        linkedTransactionNos: ['FIN-TEST-001', 'FIN-TEST-002']
      });
      const posted = createTransaction({ amount: 4000, occurredAt: '2026-06-10', transactionNo: 'FIN-TEST-001' });
      const pending = createTransaction({
        amount: 3000,
        occurredAt: '2026-06-12',
        status: '待复核',
        transactionNo: 'FIN-TEST-002'
      });
      const view = deriveCustomerContractReceiptViews({
        contracts: [contract],
        financeRows: [posted, pending],
        receivablePayableRows: [receivable]
      })[0];

      assert(view, 'contract receipt view should exist');
      assertEqual(view.receivedAmount, 4000, 'pending collections must not count as received');
      assertEqual(view.receiptRecords.length, 1, 'only posted collections should become receipt records');
      assertEqual(view.latestReceiptAt, '2026-06-10', 'latest receipt date should come from the posted receipt');
    }
  },
  {
    name: 'TR-33 posted reversal rolls contract receipts back without deleting audit history',
    run() {
      const receivable = createReceivable({
        documentNo: 'AR-TEST-002',
        id: 'ar-test-002',
        linkedTransactionNos: ['FIN-TEST-003']
      });
      const posted = createTransaction({ amount: 4000, occurredAt: '2026-06-10', transactionNo: 'FIN-TEST-003' });
      const reversal = {
        ...createTransaction({
          amount: 4000,
          direction: '支出',
          occurredAt: '2026-06-15',
          transactionNo: 'FIN-TEST-004'
        }),
        adjustmentContext: {
          mode: '冲正' as const,
          originTransactionNo: posted.transactionNo,
          reason: '客户回款误记'
        }
      };
      const view = deriveCustomerContractReceiptViews({
        contracts: [contract],
        financeRows: [posted, reversal],
        receivablePayableRows: [receivable]
      })[0];

      assert(view, 'contract receipt view should exist');
      assertEqual(view.receivedAmount, 0, 'posted reversal should remove the original receipt amount');
      assertEqual(view.receiptRecords.length, 2, 'original and reversal should both remain visible');
      assertEqual(view.receiptRecords[0]?.amount, -4000, 'reversal should be represented as a negative receipt record');
      assert(view.receiptNote.includes('1 笔冲正'), 'receipt summary should disclose the reversal');
    }
  },
  {
    name: 'TR-34 isolates receipts by structured contract identity',
    run() {
      const ownReceivable = createReceivable({
        documentNo: 'AR-TEST-003',
        id: 'ar-test-003',
        linkedTransactionNos: ['FIN-TEST-005']
      });
      const otherReceivable = createReceivable({
        contractId: 'contract-other',
        documentNo: 'AR-TEST-004',
        id: 'ar-test-004',
        linkedTransactionNos: ['FIN-TEST-006']
      });
      const view = deriveCustomerContractReceiptViews({
        contracts: [contract],
        financeRows: [
          createTransaction({ amount: 2500, occurredAt: '2026-06-11', transactionNo: 'FIN-TEST-005' }),
          createTransaction({ amount: 9000, occurredAt: '2026-06-12', transactionNo: 'FIN-TEST-006' })
        ],
        receivablePayableRows: [ownReceivable, otherReceivable]
      })[0];

      assert(view, 'contract receipt view should exist');
      assertEqual(view.receivedAmount, 2500, 'another contract receipt must not leak into this contract');
    }
  },
  {
    name: 'TR-35 supports task settlement contract snapshots and excludes void receivables',
    run() {
      const taskReceivable = {
        ...createReceivable({
          contractId: undefined,
          documentNo: 'AR-TEST-005',
          id: 'ar-test-005',
          linkedTransactionNos: ['FIN-TEST-007']
        }),
        taskSettlement: {
          batchId: 'batch-test',
          brandId: 'brand-test',
          brandName: '测试品牌',
          contractId: contract.id,
          customerId: contract.customerId,
          customerName: '测试客户',
          lineItems: [],
          recordKind: '原始结算' as const,
          settlementMode: '按任务结算' as const,
          settlementPeriod: '2026-06'
        }
      };
      const voidReceivable = {
        ...createReceivable({
          documentNo: 'AR-TEST-006',
          id: 'ar-test-006',
          linkedTransactionNos: ['FIN-TEST-008']
        }),
        confirmationStatus: '已作废' as const
      };
      const view = deriveCustomerContractReceiptViews({
        contracts: [contract],
        financeRows: [
          createTransaction({ amount: 1800, occurredAt: '2026-06-13', transactionNo: 'FIN-TEST-007' }),
          createTransaction({ amount: 7000, occurredAt: '2026-06-14', transactionNo: 'FIN-TEST-008' })
        ],
        receivablePayableRows: [taskReceivable, voidReceivable]
      })[0];

      assert(view, 'contract receipt view should exist');
      assertEqual(view.receivedAmount, 1800, 'task settlement snapshot should link receipts to its contract');
      assertEqual(view.receiptRecords.length, 1, 'void receivable collections must not enter the contract view');
    }
  }
];

export function runContractReceiptModelTests() {
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
