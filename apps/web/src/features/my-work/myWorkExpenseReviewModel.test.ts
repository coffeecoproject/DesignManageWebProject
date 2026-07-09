import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  approveExpenseReviewRecord,
  buildReceivablePayableFromExpenseReview,
  buildMyWorkExpenseReviewMetrics,
  buildMyWorkExpenseReviewQueue,
  getExpenseReviewCategoryLabel,
  isExpenseReviewOverdue,
  returnExpenseReviewRecord,
  type MyWorkExpenseReviewRecord
} from './myWorkExpenseReviewModel';

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

function createFile(name = '费用凭证.pdf'): RelatedFileRecord {
  return {
    id: `file-${name}`,
    name,
    status: '已上传',
    type: '费用凭证',
    updatedAt: '2026-06-15'
  };
}

function createReviewRecord(overrides: Partial<MyWorkExpenseReviewRecord> = {}): MyWorkExpenseReviewRecord {
  return {
    amount: 100,
    category: '差旅交通',
    code: 'EC-TEST-001',
    dueAt: '2026-06-20',
    files: [createFile()],
    id: 'review-test-001',
    note: '测试报销',
    occurredAt: '2026-06-15',
    operationRecords: [],
    originalType: '电子原件',
    paymentMethod: '微信',
    relatedTarget: '测试项目',
    reviewStatus: '待审核',
    submittedAt: '2026-06-15 09:00',
    submitterName: '测试员工',
    title: '测试费用',
    updatedAt: '2026-06-15 09:00',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds pending review queue and prioritizes overdue records',
    run() {
      const overdue = createReviewRecord({ dueAt: '2026-06-10', id: 'overdue' });
      const pending = createReviewRecord({ dueAt: '2026-06-22', id: 'pending' });
      const returned = createReviewRecord({ id: 'returned', reviewStatus: '需调整' });
      const approved = createReviewRecord({ id: 'approved', reviewStatus: '已通过' });
      const queue = buildMyWorkExpenseReviewQueue([pending, returned, approved, overdue]);

      assertEqual(queue.length, 2, 'queue should include pending records only');
      assertEqual(queue[0]?.id, 'overdue', 'overdue record should be first');
      assertEqual(queue[1]?.id, 'pending', 'normal pending record should follow');
      assertEqual(isExpenseReviewOverdue(overdue, '2026-06-23'), true, 'overdue helper should detect pending overdue records');
      assertEqual(isExpenseReviewOverdue(returned, '2026-06-23'), false, 'returned records should not count as overdue');
    }
  },
  {
    name: 'derives metrics from review statuses',
    run() {
      const metrics = buildMyWorkExpenseReviewMetrics([
        createReviewRecord({ dueAt: '2026-06-10', id: 'pending-overdue' }),
        createReviewRecord({ dueAt: '2026-06-24', id: 'pending-normal' }),
        createReviewRecord({ id: 'returned', reviewStatus: '需调整' }),
        createReviewRecord({ id: 'approved', reviewStatus: '已通过' })
      ]);

      assertEqual(metrics.pendingCount, 2, 'pending metric should count pending records');
      assertEqual(metrics.returnedCount, 1, 'returned metric should count returned records');
      assertEqual(metrics.overdueCount, 1, 'overdue metric should count pending overdue records');
    }
  },
  {
    name: 'approves and returns reimbursement records without direct payment actions',
    run() {
      const record = createReviewRecord();
      const approved = approveExpenseReviewRecord(record, { reviewerName: '审核人' });
      const returned = returnExpenseReviewRecord(record, { returnedReason: '请补充发票', reviewerName: '审核人' });

      assertEqual(approved.reviewStatus, '已通过', 'approved record should be marked approved');
      assertEqual(approved.operationRecords[0]?.action, '审核通过', 'approval operation should be prepended');
      assertEqual(returned.reviewStatus, '需调整', 'returned record should be marked returned');
      assertEqual(returned.operationRecords[0]?.summary, '请补充发票', 'returned reason should be retained');
      assert(!approved.operationRecords.some((operation) => operation.action.includes('付款')), 'review should not create payment operation');
      assert(!approved.operationRecords.some((operation) => operation.action.includes('生成应付')), 'review should not expose payable generation operation');
    }
  },
  {
    name: 'builds payable confirmation after reimbursement approval',
    run() {
      const record = createReviewRecord({
        amount: 486.5,
        category: '差旅交通',
        code: 'EC-202606-088',
        occurredAt: '2026-06-15',
        submitterName: '测试员工',
        title: '现场交通费'
      });
      const payable = buildReceivablePayableFromExpenseReview(record, []);

      assertEqual(payable.direction, '应付', 'approved reimbursement should create payable confirmation');
      assertEqual(payable.confirmationStatus, '已确认', 'payable should be confirmed after approval');
      assertEqual(payable.settlementStatus, '未结清', 'payable should wait for payment registration');
      assertEqual(payable.sourceNo, record.code, 'payable should trace to reimbursement record');
      assertEqual(payable.counterparty, record.submitterName, 'payable counterparty should be submitter');
      assertEqual(payable.category, record.category, 'payable should keep expense category');
      assertEqual(payable.operationRecords[0]?.action, '生成应付', 'payable generation should be recorded on payable item');
    }
  },
  {
    name: 'renders category label from finance category hierarchy',
    run() {
      assertEqual(getExpenseReviewCategoryLabel(createReviewRecord({ category: '差旅交通' })), '运营费用 / 差旅交通', 'category label should include primary and secondary category');
    }
  }
];

export function runMyWorkExpenseReviewModelTests() {
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
