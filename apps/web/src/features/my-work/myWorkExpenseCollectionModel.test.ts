import { getFinanceCategorySnapshot, getFinanceSeedPublicAccountRef } from '../finance/financeData';
import type { FinanceReceivablePayableRecord } from '../finance/financeReceivablesPayablesData';
import {
  buildFinanceTransactionFromMyWorkCollection,
  buildMyWorkCollectionReceivableOptions,
  buildMyWorkExpenseCollectionMetrics,
  createMyWorkExpenseCollectionForm,
  createMyWorkExpenseCollectionRecordFromForm,
  getMyWorkExpenseCategoryOptions,
  getMyWorkExpensePrimaryCategoryId,
  getMyWorkExpensePrimaryCategoryOptions,
  isMyWorkExpenseCollectionDraftSavable,
  isMyWorkExpenseCollectionFormValid,
  linkMyWorkCollectionFinanceTransaction,
  matchesMyWorkExpenseCollectionFilters,
  resubmitMyWorkExpenseCollectionRecordFromForm,
  type MyWorkExpenseCollectionFilters,
  type MyWorkExpenseCollectionRecord
} from './myWorkExpenseCollectionModel';

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

function createReceivableRecord(overrides: Partial<FinanceReceivablePayableRecord> = {}): FinanceReceivablePayableRecord {
  const category = overrides.category ?? '客户回款';
  const categorySnapshot = getFinanceCategorySnapshot(category);

  return {
    accountingPeriod: '2026-06',
    amount: 1000,
    category,
    categorySnapshot,
    confirmDate: '2026-06-10',
    confirmationStatus: '已确认',
    counterparty: '测试客户',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-TEST-001',
    dueDate: '2026-06-30',
    files: [],
    id: 'receivable-test-001',
    linkedTransactionNos: [],
    note: '',
    operationRecords: [],
    owner: '李明',
    reportAggregation: categorySnapshot.reportAggregation,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-TEST-001',
    sourceTitle: '测试合同回款',
    sourceType: '合同应收',
    taxBasis: {
      basisSource: '来源单据',
      taxAmount: 9.9,
      taxExcludedAmount: 990.1,
      taxIncludedAmount: 1000,
      taxRate: '1%'
    },
    updatedAt: '2026-06-10',
    ...overrides
  };
}

function createExpenseCollectionRecord(overrides: Partial<MyWorkExpenseCollectionRecord> = {}): MyWorkExpenseCollectionRecord {
  return {
    amount: 100,
    category: '差旅交通',
    code: 'EC-TEST-001',
    files: [
      {
        id: 'file-test-001',
        name: '费用凭证.pdf',
        status: '已上传',
        type: '费用凭证',
        updatedAt: '2026-06-15'
      }
    ],
    id: 'expense-test-001',
    kind: '费用报销',
    note: '测试说明',
    occurredAt: '2026-06-15',
    operationRecords: [],
    originalType: '电子原件',
    paperStatus: '无需提交',
    paymentMethod: '微信',
    relatedTarget: '测试项目',
    status: '待审核',
    title: '测试费用',
    updatedAt: '2026-06-15 09:00',
    ...overrides
  };
}

const defaultFilters: MyWorkExpenseCollectionFilters = {
  keyword: '',
  kind: '全部',
  occurredTime: { mode: 'month', month: '2026-06' },
  status: '全部'
};

const testPublicAccountRef = getFinanceSeedPublicAccountRef();

const tests: UnitTest[] = [
  {
    name: 'expense categories expose reimbursement primary and secondary business categories only',
    run() {
      const primaryNames = getMyWorkExpensePrimaryCategoryOptions().map((category) => category.name);
      const categoryNames = getMyWorkExpenseCategoryOptions().map((category) => category.name);
      const operatingCategoryNames = getMyWorkExpenseCategoryOptions(getMyWorkExpensePrimaryCategoryId('差旅交通')).map((category) => category.name);

      assert(primaryNames.includes('运营费用'), 'operating expense primary category should be available');
      assert(primaryNames.includes('项目成本'), 'project cost primary category should be available');
      assert(!primaryNames.includes('人员支出'), 'salary-only primary category should not be employee-facing');
      assert(categoryNames.includes('差旅交通'), 'travel expense should be available');
      assert(categoryNames.includes('办公费用'), 'office expense should be available');
      assert(operatingCategoryNames.includes('差旅交通'), 'secondary options should narrow by selected primary category');
      assert(getMyWorkExpenseCategoryOptions().every((category) => category.defaultSourceType === '报销单'), 'only reimbursement-source categories should be employee-facing');
    }
  },
  {
    name: 'collection receivable options keep outstanding receivables only',
    run() {
      const options = buildMyWorkCollectionReceivableOptions([
        createReceivableRecord({ documentNo: 'AR-OPEN', settledAmount: 100 }),
        createReceivableRecord({ documentNo: 'AR-CLOSED', settledAmount: 1000 }),
        createReceivableRecord({ confirmationStatus: '待确认', documentNo: 'AR-PENDING' }),
        createReceivableRecord({ direction: '应付', documentNo: 'AP-001' })
      ]);

      assertEqual(options.length, 1, 'only confirmed outstanding receivable should be selectable');
      assertEqual(options[0]?.value, 'AR-OPEN', 'open receivable document should be selected');
    }
  },
  {
    name: 'filters records by date, type, status, and keyword',
    run() {
      const collection = createExpenseCollectionRecord({
        customerName: '测试客户',
        kind: '代收登记',
        publicAccountId: testPublicAccountRef.publicAccountId,
        status: '待复核',
        title: '客户代收款'
      });
      const previousMonth = createExpenseCollectionRecord({ occurredAt: '2026-05-31' });

      assertEqual(matchesMyWorkExpenseCollectionFilters(collection, { ...defaultFilters, kind: '代收登记' }), true, 'collection type should match');
      assertEqual(matchesMyWorkExpenseCollectionFilters(collection, { ...defaultFilters, status: '待复核' }), true, 'status should match');
      assertEqual(matchesMyWorkExpenseCollectionFilters(collection, { ...defaultFilters, keyword: '客户' }), true, 'keyword should match customer');
      assertEqual(matchesMyWorkExpenseCollectionFilters(previousMonth, defaultFilters), false, 'previous month should be excluded');
    }
  },
  {
    name: 'creates employee-facing forms and submitted records',
    run() {
      const invalidForm = createMyWorkExpenseCollectionForm();
      const form = {
        ...invalidForm,
        amount: 486.5,
        category: '差旅交通',
        files: [
          {
            id: 'file-001',
            name: '交通发票.pdf',
            status: '已选择',
            type: '费用凭证',
            updatedAt: '2026-06-15'
          }
        ],
        originalType: '纸质原件' as const,
        paymentMethod: '微信' as const,
        primaryCategoryId: getMyWorkExpensePrimaryCategoryId('差旅交通'),
        relatedTarget: '测试项目',
        title: '现场交通费'
      };
      const record = createMyWorkExpenseCollectionRecordFromForm(form, 5);

      assert(!Object.prototype.hasOwnProperty.call(invalidForm, 'paperStatus'), 'submitter form should not expose paper original handling status');
      assertEqual(isMyWorkExpenseCollectionFormValid(invalidForm), false, 'empty form should be invalid');
      assertEqual(isMyWorkExpenseCollectionFormValid(form), true, 'complete expense form should be valid');
      assertEqual(record.code, 'EC-202606-005', 'record code should use occurrence month and sequence');
      assertEqual(record.paperStatus, '待提交', 'paper original should require submission by default');
      assertEqual(record.paymentMethod, '微信', 'expense payment method should be retained');
      assertEqual(record.status, '待审核', 'new expense record should start from approval');
      assertEqual(record.files.length, 1, 'attachment should be retained');
    }
  },
  {
    name: 'validates missing-voucher note and collection transfer proof',
    run() {
      const baseForm = {
        ...createMyWorkExpenseCollectionForm(),
        amount: 120,
        files: [
          {
            id: 'file-002',
            name: '付款截图.png',
            status: '已选择',
            type: '费用凭证',
            updatedAt: '2026-06-15'
          }
        ],
        title: '无票费用'
      };
      const missingVoucherForm = {
        ...baseForm,
        originalType: '无正式票据' as const,
        note: ''
      };
      const collectionWithoutTransferFile = {
        ...baseForm,
        category: '客户回款',
        collectionMethod: '微信' as const,
        customerName: '测试客户',
        kind: '代收登记' as const,
        publicAccountId: testPublicAccountRef.publicAccountId,
        transferFiles: [],
      };
      const collectionWithTransferFile = {
        ...collectionWithoutTransferFile,
        transferFiles: [
          {
            id: 'transfer-file-001',
            name: '转入公司截图.png',
            status: '已选择',
            type: '转入凭证',
            updatedAt: '2026-06-15'
          }
        ]
      };
      const record = createMyWorkExpenseCollectionRecordFromForm(collectionWithTransferFile, 6);

      assertEqual(isMyWorkExpenseCollectionFormValid(missingVoucherForm), false, 'missing formal voucher should require reason in note');
      assertEqual(isMyWorkExpenseCollectionFormValid({ ...missingVoucherForm, note: '客户未提供正式票据' }), true, 'missing formal voucher reason should make form valid');
      assertEqual(isMyWorkExpenseCollectionFormValid(collectionWithoutTransferFile), false, 'transferred collection should require transfer proof');
      assertEqual(isMyWorkExpenseCollectionFormValid(collectionWithTransferFile), true, 'transfer proof should make transferred collection valid');
      assertEqual(record.status, '待复核', 'submitted collection should enter review');
      assertEqual(record.publicAccountId, testPublicAccountRef.publicAccountId, 'collection public account should be retained');
      assertEqual(record.transferFiles?.length, 1, 'transfer proof should be retained');
    }
  },
  {
    name: 'saves drafts without entering approval or review',
    run() {
      const form = {
        ...createMyWorkExpenseCollectionForm(),
        amount: 0,
        files: [],
        title: '临时草稿'
      };
      const draft = createMyWorkExpenseCollectionRecordFromForm(form, 7, 'draft');

      assertEqual(isMyWorkExpenseCollectionDraftSavable(createMyWorkExpenseCollectionForm()), false, 'blank draft should not be saved');
      assertEqual(isMyWorkExpenseCollectionDraftSavable(form), true, 'partial form should be savable as draft');
      assertEqual(isMyWorkExpenseCollectionFormValid(form), false, 'partial draft should not be submittable');
      assertEqual(draft.status, '草稿', 'draft should stay in employee workspace only');
      assertEqual(draft.operationRecords[0]?.action, '保存草稿', 'draft operation should be recorded');
    }
  },
  {
    name: 'submitted collections create pending finance review transactions',
    run() {
      const collectionForm = {
        ...createMyWorkExpenseCollectionForm(),
        amount: 9800,
        category: '客户回款',
        collectionMethod: '微信' as const,
        customerName: '测试客户',
        kind: '代收登记' as const,
        publicAccountId: testPublicAccountRef.publicAccountId,
        title: '客户临时代收',
        transferFiles: [
          {
            id: 'transfer-file-002',
            name: '转入公司账户截图.png',
            status: '已选择',
            type: '转入凭证',
            updatedAt: '2026-06-15'
          }
        ]
      };
      const collectionRecord = createMyWorkExpenseCollectionRecordFromForm(collectionForm, 8);
      const financeRecord = buildFinanceTransactionFromMyWorkCollection(collectionRecord, [], testPublicAccountRef);

      assert(financeRecord, 'submitted collection should produce finance transaction');
      assertEqual(financeRecord.status, '待复核', 'finance transaction should enter review');
      assertEqual(financeRecord.paymentMethod, '员工代收', 'payment method should preserve employee collection origin');
      assertEqual(financeRecord.publicAccountId, testPublicAccountRef.publicAccountId, 'submitted collection should already point to public account');
      assertEqual(financeRecord.publicAccountSnapshot.displayName, testPublicAccountRef.publicAccountSnapshot.displayName, 'public account snapshot should be copied');
      assertEqual(financeRecord.sourceNo, collectionRecord.code, 'finance source should link to employee submission');
      assertEqual(linkMyWorkCollectionFinanceTransaction(collectionRecord, financeRecord.transactionNo).linkedFinanceTransactionNo, financeRecord.transactionNo, 'employee record should keep review transaction number');
    }
  },
  {
    name: 'does not create collection finance transaction with mismatched public account ref',
    run() {
      const collectionRecord = createExpenseCollectionRecord({
        kind: '代收登记',
        publicAccountId: testPublicAccountRef.publicAccountId,
        status: '待复核',
        transferFiles: [
          {
            id: 'transfer-file-mismatch',
            name: '转入公司账户截图.png',
            status: '已选择',
            type: '转入凭证',
            updatedAt: '2026-06-15'
          }
        ]
      });
      const otherPublicAccountRef = getFinanceSeedPublicAccountRef('public-account-icbc-payment-reserve');
      const financeRecord = buildFinanceTransactionFromMyWorkCollection(collectionRecord, [], otherPublicAccountRef);

      assertEqual(financeRecord, undefined, 'mismatched public account ref should fail closed');
    }
  },
  {
    name: 'resubmits returned records and derives dashboard metrics',
    run() {
      const returnedRecord = createExpenseCollectionRecord({ status: '退回修改' });
      const form = {
        ...createMyWorkExpenseCollectionForm(returnedRecord),
        amount: 168,
        title: '补充后的费用'
      };
      const resubmitted = resubmitMyWorkExpenseCollectionRecordFromForm(returnedRecord, form);
      const metrics = buildMyWorkExpenseCollectionMetrics([
        returnedRecord,
        createExpenseCollectionRecord({ id: 'draft', status: '草稿' }),
        createExpenseCollectionRecord({ id: 'finance-confirm', status: '待复核' }),
        createExpenseCollectionRecord({ id: 'confirmed', status: '已确认' })
      ]);

      assertEqual(resubmitted.status, '待审核', 'resubmitted expense should return to approval');
      assertEqual(resubmitted.operationRecords[0]?.action, '重新提交', 'resubmission should prepend operation');
      assertEqual(metrics.draftCount, 1, 'draft metric should count draft records');
      assertEqual(metrics.pendingMyActionCount, 2, 'returned and draft records should count as my action');
      assertEqual(metrics.financeConfirmCount, 1, 'finance confirmation metric should count matching records');
      assertEqual(metrics.pendingReviewCount, 1, 'pending review metric should count collection review records');
      assertEqual(metrics.confirmedCount, 1, 'confirmed metric should count matching records');
    }
  }
];

export function runMyWorkExpenseCollectionModelTests() {
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
