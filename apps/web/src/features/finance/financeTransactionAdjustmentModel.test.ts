import { getFinanceCategorySnapshot, getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';
import {
  buildFinanceTransactionAdjustmentRecord,
  createFinanceTransactionAdjustmentForm,
  getDefaultFinanceTransactionAdjustmentAmountText,
  getFinanceTransactionAdjustmentSignedDifference,
  type FinanceTransactionAdjustmentBankContext
} from './financeTransactionAdjustmentModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createFinanceRecord(overrides: Partial<FinanceTransactionRecord> = {}): FinanceTransactionRecord {
  const category = overrides.category ?? '外协付款';

  return {
    accountingPeriod: '2026-06',
    amount: 3200,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category),
    counterparty: '林悦',
    counterpartyType: '外协',
    currency: 'CNY',
    direction: '支出',
    files: [],
    id: 'finance-adjust-origin',
    note: '空间设计外协任务结算',
    occurredAt: '2026-06-12',
    operationRecords: [],
    paymentMethod: '对公账户付款',
    ...getFinanceSeedPublicAccountRef(),
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: 'OUT-202606-0008',
    sourceTitle: '空间设计外协任务结算',
    sourceType: '外协结算',
    status: '已入账',
    transactionNo: 'FIN-202606-0004',
    updatedAt: '2026-06-12 17:25',
    voucherStatus: '已上传',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds reversal as opposite-direction pending review transaction',
    run: () => {
      const origin = createFinanceRecord();
      const form = createFinanceTransactionAdjustmentForm(origin);
      const record = buildFinanceTransactionAdjustmentRecord({
        existingRows: [origin],
        files: [],
        form: {
          ...form,
          reason: '原流水登记错误'
        },
        originRecord: origin
      });

      assertEqual(record.direction, '收入', 'expense reversal should become income');
      assertEqual(record.amount, 3200, 'reversal should use original amount');
      assertEqual(record.sourceType, '流水冲正', 'reversal should use adjustment source type');
      assertEqual(record.sourceNo, origin.transactionNo, 'adjustment should reference original transaction number');
      assertEqual(record.adjustmentContext?.mode, '冲正', 'adjustment context should preserve reversal mode');
      assertEqual(record.adjustmentContext?.originTransactionNo, origin.transactionNo, 'adjustment context should reference origin transaction structurally');
      assertEqual(record.status, '待复核', 'adjustment should enter finance review');
      assertEqual(record.reconciliationStatus, '未对账', 'adjustment should not be reconciled immediately');
    }
  },
  {
    name: 'builds amount difference from bank mismatch context',
    run: () => {
      const origin = createFinanceRecord();
      const bankContext: FinanceTransactionAdjustmentBankContext = {
        amount: 3000,
        bankSerialNo: 'CMB202606120002',
        counterparty: '林悦',
        direction: '出账',
        statementDate: '2026-06-12',
        summary: '空间设计外协任务结算'
      };
      const form = createFinanceTransactionAdjustmentForm(origin, bankContext);
      const record = buildFinanceTransactionAdjustmentRecord({
        bankContext,
        existingRows: [origin],
        files: [],
        form: {
          ...form,
          reason: '银行实际付款与系统流水不一致'
        },
        originRecord: origin
      });

      assertEqual(getFinanceTransactionAdjustmentSignedDifference(origin, bankContext), 200, 'signed difference should offset public-account amount');
      assertEqual(getDefaultFinanceTransactionAdjustmentAmountText(origin, '补差', bankContext), '200.00', 'default difference amount should be absolute signed difference');
      assertEqual(record.direction, '收入', 'positive signed difference should create income adjustment');
      assertEqual(record.amount, 200, 'difference adjustment should use mismatch amount');
      assertEqual(record.sourceType, '流水补差', 'difference adjustment should use supplementary source type');
      assertEqual(record.adjustmentContext?.mode, '补差', 'adjustment context should preserve difference mode');
      assertEqual(record.adjustmentContext?.bankSerialNo, bankContext.bankSerialNo, 'adjustment context should retain bank statement serial number');
      assertEqual(record.status, '待复核', 'difference adjustment should enter finance review');
    }
  }
];

export function runFinanceTransactionAdjustmentModelTests() {
  const failures: string[] = [];

  tests.forEach((test) => {
    try {
      test.run();
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
