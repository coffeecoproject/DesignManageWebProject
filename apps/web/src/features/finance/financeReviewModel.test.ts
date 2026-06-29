import { getFinanceCategorySnapshot, getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';
import {
  buildFinanceReviewMetrics,
  getFinanceReviewQueueRows,
  getFinanceReviewReadiness
} from './financeReviewModel';
import {
  getDefaultFinanceReviewDueAt,
  getFinanceTransactionReviewDueAt,
  isFinanceTransactionReviewOverdue
} from './financeUtils';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createTransactionRecord(overrides: Partial<FinanceTransactionRecord> = {}): FinanceTransactionRecord {
  const category = overrides.category ?? '客户回款';

  return {
    accountingPeriod: '2026-06',
    amount: 1000,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category),
    counterparty: '测试客户',
    counterpartyType: '客户',
    currency: 'CNY',
    direction: '收入',
    files: [],
    id: 'finance-review-test-record',
    note: '',
    occurredAt: '2026-06-14',
    operationRecords: [],
    paymentMethod: '对公账户收款',
    ...getFinanceSeedPublicAccountRef(),
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    reviewDueAt: '2026-06-15',
    sourceNo: 'AR-TEST-001',
    sourceTitle: '测试回款',
    sourceType: '合同应收',
    status: '待复核',
    transactionNo: 'FIN-TEST-001',
    updatedAt: '2026-06-14 10:00',
    voucherStatus: '已上传',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'prioritizes blocking voucher state over overdue display state',
    run: () => {
      const missingVoucher = createTransactionRecord({
        reviewDueAt: '2026-06-10',
        voucherStatus: '待补充'
      });
      const overdueReady = createTransactionRecord({
        id: 'overdue-ready',
        reviewDueAt: '2026-06-10',
        transactionNo: 'FIN-TEST-002'
      });
      const normalReady = createTransactionRecord({
        id: 'normal-ready',
        reviewDueAt: '2026-06-16',
        transactionNo: 'FIN-TEST-003'
      });

      assertEqual(getFinanceReviewReadiness(missingVoucher), '凭证待补', 'missing voucher should be the primary blocking state');
      assertEqual(getFinanceReviewReadiness(overdueReady), '逾期复核', 'ready but overdue transaction should show overdue review');
      assertEqual(getFinanceReviewReadiness(normalReady), '可复核', 'ready and in-SLA transaction should be reviewable');
    }
  },
  {
    name: 'sorts queue by reviewable records before blocked voucher records',
    run: () => {
      const missingVoucher = createTransactionRecord({
        id: 'missing-voucher',
        reviewDueAt: '2026-06-10',
        transactionNo: 'FIN-TEST-003',
        voucherStatus: '待补充'
      });
      const overdueReady = createTransactionRecord({
        id: 'overdue-ready',
        reviewDueAt: '2026-06-10',
        transactionNo: 'FIN-TEST-001'
      });
      const normalReady = createTransactionRecord({
        id: 'normal-ready',
        reviewDueAt: '2026-06-16',
        transactionNo: 'FIN-TEST-002'
      });
      const reviewed = createTransactionRecord({
        id: 'reviewed',
        status: '已入账',
        transactionNo: 'FIN-TEST-004'
      });
      const queueRows = getFinanceReviewQueueRows([missingVoucher, normalReady, reviewed, overdueReady]);
      const metrics = buildFinanceReviewMetrics([missingVoucher, normalReady, reviewed, overdueReady]);

      assertEqual(queueRows.map((record) => record.id).join('|'), 'overdue-ready|normal-ready|missing-voucher', 'queue should prioritize reviewable rows');
      assertEqual(metrics.pendingReviewCount, 3, 'metrics should count pending-review rows only');
      assertEqual(metrics.missingVoucherCount, 1, 'metrics should count missing voucher rows');
      assertEqual(metrics.overdueReviewCount, 2, 'metrics should count overdue rows by review due date');
    }
  },
  {
    name: 'derives default review due date when old transaction rows do not carry explicit due date',
    run: () => {
      const transaction = createTransactionRecord({
        occurredAt: '2026-06-14',
        reviewDueAt: undefined
      });

      assertEqual(getDefaultFinanceReviewDueAt('2026-06-14'), '2026-06-15', 'default SLA should add one calendar day');
      assertEqual(getFinanceTransactionReviewDueAt(transaction), '2026-06-15', 'missing due date should use default SLA');
      assertEqual(isFinanceTransactionReviewOverdue(transaction, '2026-06-15'), false, 'due date itself should not be overdue');
      assertEqual(isFinanceTransactionReviewOverdue(transaction, '2026-06-16'), true, 'record should become overdue after due date');
    }
  }
];

export function runFinanceReviewModelTests() {
  const failures: string[] = [];
  let passed = 0;

  tests.forEach((test) => {
    try {
      test.run();
      passed += 1;
    } catch (error) {
      failures.push(`${test.name}: ${(error as Error).message}`);
    }
  });

  return {
    failures,
    passed,
    total: tests.length
  };
}
