import type { BankStatementRecord } from './financeBankImportContract';
import {
  buildFinanceTransactionFromBankStatement,
  createBankReconciliationFlowForm,
  getBankReconciliationCategoryOptions,
  getBankReconciliationPrimaryCategoryOptions,
  getBankReconciliationResolution
} from './financeBankReconciliationModel';
import { getFinanceCategorySnapshot, getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createBankRow(overrides: Partial<BankStatementRecord> = {}): BankStatementRecord {
  const publicAccountRef = getFinanceSeedPublicAccountRef();

  return {
    amount: 9800,
    balance: 100000,
    bankSerialNo: 'CMB-TEST-001',
    batchNo: 'BANK-TEST-001',
    counterparty: '测试客户',
    direction: '入账',
    id: 'bank-reconcile-test-row',
    importedAccountName: publicAccountRef.publicAccountSnapshot.displayName,
    importedAt: '2026-06-15 10:00',
    matchedTransactionIds: [],
    matchReason: '银行已有入账，系统尚未形成对公账户流水',
    matchScore: 40,
    matchStatus: '银行未匹配',
    publicAccountId: publicAccountRef.publicAccountId,
    publicAccountSnapshot: publicAccountRef.publicAccountSnapshot,
    statementDate: '2026-06-15',
    summary: '测试客户项目回款',
    ...overrides
  };
}

function createFinanceRecord(overrides: Partial<FinanceTransactionRecord> = {}): FinanceTransactionRecord {
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
    id: 'finance-bank-reconcile-existing',
    note: '',
    occurredAt: '2026-06-10',
    operationRecords: [],
    paymentMethod: '对公账户收款',
    ...getFinanceSeedPublicAccountRef(),
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: 'CON-TEST-001',
    sourceTitle: '测试合同',
    sourceType: '合同应收',
    status: '已入账',
    transactionNo: 'FIN-202606-0008',
    updatedAt: '2026-06-10 10:00',
    voucherStatus: '已上传',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'filters quick-registration categories by bank direction and public-account method',
    run: () => {
      const incomeOptions = getBankReconciliationCategoryOptions('入账');
      const expenseOptions = getBankReconciliationCategoryOptions('出账');
      const incomePrimaryOptions = getBankReconciliationPrimaryCategoryOptions('入账');

      assertEqual(incomeOptions.some((category) => category.name === '客户回款'), true, 'income bank rows should allow customer payment');
      assertEqual(incomeOptions.some((category) => category.name === '客户现金收款'), false, 'cash collection should not appear for bank rows');
      assertEqual(expenseOptions.some((category) => category.name === '外协付款'), true, 'expense bank rows should allow outsource payment');
      assertEqual(expenseOptions.some((category) => category.name === '客户回款'), false, 'income categories should not appear in expense rows');
      assertEqual(incomePrimaryOptions.map((category) => category.name).join('|'), '客户收入|其他收入', 'primary categories should be derived from usable secondary categories');
    }
  },
  {
    name: 'builds pending-review system cash flow from unmatched bank statement',
    run: () => {
      const bankRow = createBankRow();
      const form = createBankReconciliationFlowForm(bankRow);
      const transaction = buildFinanceTransactionFromBankStatement(bankRow, form, [createFinanceRecord()]);

      assertEqual(transaction.transactionNo, 'FIN-202606-0009', 'transaction number should follow current period sequence');
      assertEqual(transaction.status, '待复核', 'bank-generated system cash flow should wait for finance review');
      assertEqual(transaction.reconciliationStatus, '未对账', 'bank-generated system cash flow should not auto reconcile');
      assertEqual(transaction.paymentMethod, '对公账户收款', 'income bank row should generate public-account receipt');
      assertEqual(transaction.voucherStatus, '已上传', 'imported bank row should be retained as voucher evidence');
      assertEqual(transaction.files[0]?.type, '银行流水', 'voucher file should mark the bank statement source');
      assertEqual(transaction.sourceNo, 'CMB-TEST-001', 'source number should default to the bank serial number');
    }
  },
  {
    name: 'builds expense cash flow with public-account payment semantics',
    run: () => {
      const bankRow = createBankRow({
        amount: 3200,
        counterparty: '示例兼职 B',
        direction: '出账',
        summary: '空间设计外协任务结算'
      });
      const form = createBankReconciliationFlowForm(bankRow);
      const transaction = buildFinanceTransactionFromBankStatement(bankRow, form, []);

      assertEqual(form.category, '外协付款', 'expense bank row should default to outsource payment');
      assertEqual(transaction.direction, '支出', 'expense bank row should generate expense cash flow');
      assertEqual(transaction.paymentMethod, '对公账户付款', 'expense bank row should generate public-account payment');
      assertEqual(transaction.counterpartyType, '外协', 'outsource category should map counterparty type');
      assertEqual(transaction.reviewDueAt, '2026-06-16', 'generated cash flow should carry review SLA');
    }
  },
  {
    name: 'keeps amount mismatch waiting while adjustment flow is pending review',
    run: () => {
      const origin = createFinanceRecord({
        amount: 3200,
        category: '外协付款',
        counterparty: '示例兼职 B',
        counterpartyType: '外协',
        direction: '支出',
        id: 'finance-bank-reconcile-origin',
        paymentMethod: '对公账户付款',
        sourceNo: 'OUT-202606-0008',
        sourceTitle: '空间设计外协任务结算',
        sourceType: '外协结算',
        transactionNo: 'FIN-202606-0004'
      });
      const bankRow = createBankRow({
        amount: 3000,
        bankSerialNo: 'CMB202606120002',
        counterparty: '示例兼职 B',
        direction: '出账',
        matchedTransactionIds: [origin.id, 'finance-bank-reconcile-adjust-pending'],
        matchStatus: '金额不一致',
        summary: '空间设计外协任务结算'
      });
      const pendingAdjustment = createFinanceRecord({
        amount: 200,
        counterparty: '示例兼职 B',
        direction: '收入',
        id: 'finance-bank-reconcile-adjust-pending',
        paymentMethod: '对公账户收款',
        sourceNo: origin.transactionNo,
        sourceTitle: `补差处理 / ${origin.transactionNo} / ${bankRow.bankSerialNo}`,
        sourceType: '流水补差',
        status: '待复核',
        transactionNo: 'FIN-ADJ-202606-0001'
      });
      const resolution = getBankReconciliationResolution(bankRow, origin, [origin, pendingAdjustment]);

      assertEqual(resolution.effectiveStatus, '暂不可对账', 'pending adjustment should block bank confirmation');
      assertEqual(resolution.pendingAdjustmentRecords.length, 1, 'pending adjustment should be tracked');
      assertEqual(resolution.canConfirmWithAdjustments, false, 'pending adjustment should not be confirmable');
    }
  },
  {
    name: 'turns amount mismatch into confirmable item after reviewed adjustment offsets difference',
    run: () => {
      const origin = createFinanceRecord({
        amount: 3200,
        category: '外协付款',
        counterparty: '示例兼职 B',
        counterpartyType: '外协',
        direction: '支出',
        id: 'finance-bank-reconcile-origin',
        paymentMethod: '对公账户付款',
        sourceNo: 'OUT-202606-0008',
        sourceTitle: '空间设计外协任务结算',
        sourceType: '外协结算',
        transactionNo: 'FIN-202606-0004'
      });
      const bankRow = createBankRow({
        amount: 3000,
        bankSerialNo: 'CMB202606120002',
        counterparty: '示例兼职 B',
        direction: '出账',
        matchedTransactionIds: [origin.id, 'finance-bank-reconcile-adjust-reviewed'],
        matchStatus: '金额不一致',
        summary: '空间设计外协任务结算'
      });
      const reviewedAdjustment = createFinanceRecord({
        amount: 200,
        counterparty: '示例兼职 B',
        direction: '收入',
        id: 'finance-bank-reconcile-adjust-reviewed',
        paymentMethod: '对公账户收款',
        sourceNo: origin.transactionNo,
        sourceTitle: `补差处理 / ${origin.transactionNo} / ${bankRow.bankSerialNo}`,
        sourceType: '流水补差',
        status: '已入账',
        transactionNo: 'FIN-ADJ-202606-0001'
      });
      const resolution = getBankReconciliationResolution(bankRow, origin, [origin, reviewedAdjustment]);

      assertEqual(resolution.effectiveStatus, '待确认', 'reviewed adjustment should make mismatch confirmable');
      assertEqual(resolution.remainingDifference, 0, 'reviewed adjustment should offset the signed bank difference');
      assertEqual(resolution.canConfirmWithAdjustments, true, 'reviewed adjustment should allow confirmation');
      assertEqual(resolution.reviewedAdjustmentRecords.length, 1, 'reviewed adjustment should be tracked');
    }
  }
];

export function runFinanceBankReconciliationModelTests() {
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
