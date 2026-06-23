import type { FinanceTransactionRecord } from './financeData';
import { getFinanceCategorySnapshot } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  buildFinanceBusinessOverview,
  type FinanceBusinessOverviewRange
} from './financeBusinessOverviewModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertClose(actual: number | undefined, expected: number, message: string) {
  if (actual === undefined || Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${message}. Expected ${expected}, got ${String(actual)}`);
  }
}

function createAccrualRecord(overrides: Partial<FinanceReceivablePayableRecord> = {}): FinanceReceivablePayableRecord {
  const category = overrides.category ?? '客户回款';

  return {
    accountingPeriod: '2026-06',
    amount: 1000,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category),
    confirmDate: '2026-06-10',
    counterparty: '测试客户',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-TEST-001',
    dueDate: '2026-06-30',
    files: [],
    id: 'accrual-test-001',
    linkedTransactionNos: [],
    note: '',
    operationRecords: [],
    owner: '李明',
    reportAggregation: getFinanceCategorySnapshot(category).reportAggregation,
    settledAmount: 0,
    sourceNo: 'SRC-001',
    sourceTitle: '测试来源',
    sourceType: '合同应收',
    status: '未结清',
    updatedAt: '2026-06-10',
    ...overrides
  };
}

function createCashRecord(overrides: Partial<FinanceTransactionRecord> = {}): FinanceTransactionRecord {
  const category = overrides.category ?? '客户回款';

  return {
    accountingPeriod: '2026-06',
    amount: 1000,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category),
    collectionStatus: '不适用',
    counterparty: '测试对象',
    counterpartyType: '客户',
    currency: 'CNY',
    direction: '收入',
    files: [],
    id: 'cash-test-001',
    note: '',
    occurredAt: '2026-06-10',
    operationRecords: [],
    paymentMethod: '对公账户收款',
    reconciliationStatus: '已对账',
    registeredBy: '李明',
    reviewedAt: '2026-06-10 12:00',
    reviewedBy: '财务复核',
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceNo: 'SRC-001',
    sourceTitle: '测试来源',
    sourceType: '合同应收',
    status: '已入账',
    transactionNo: 'FIN-TEST-001',
    updatedAt: '2026-06-10',
    voucherStatus: '已上传',
    ...overrides
  };
}

const juneRange: FinanceBusinessOverviewRange = {
  endDate: '2026-06-30',
  startDate: '2026-06-01'
};

const tests: UnitTest[] = [
  {
    name: 'splits accrual income, direct cost, total cost, and outstanding amounts',
    run: () => {
      const report = buildFinanceBusinessOverview({
        accrualRecords: [
          createAccrualRecord({ amount: 1000, settledAmount: 400 }),
          createAccrualRecord({
            amount: 300,
            category: '外协付款',
            counterpartyType: '外协',
            direction: '应付',
            documentNo: 'AP-TEST-001',
            id: 'project-cost',
            sourceType: '外协结算'
          }),
          createAccrualRecord({
            amount: 200,
            category: '工资发放',
            counterpartyType: '员工',
            direction: '应付',
            documentNo: 'AP-TEST-002',
            id: 'people-cost',
            sourceType: '薪酬发放'
          })
        ],
        basis: 'business-confirmation',
        financeRows: [],
        range: juneRange
      });

      assertEqual(report.summary.income, 1000, 'accrual income should use receivable confirmation amount');
      assertEqual(report.summary.totalCost, 500, 'accrual cost should use payable confirmation amount');
      assertEqual(report.summary.grossProfit, 700, 'gross profit should subtract project direct cost only');
      assertEqual(report.summary.netProfit, 500, 'net profit should subtract all confirmed cost');
      assertEqual(report.summary.receivableOutstanding, 600, 'receivable outstanding should use unsettled receivable amount');
      assertEqual(report.summary.payableOutstanding, 500, 'payable outstanding should use unsettled payable amount');
      assertEqual(report.incomeRows.length, 1, 'income table should aggregate income categories');
      assertEqual(report.costRows.length, 2, 'cost table should aggregate cost categories');
    }
  },
  {
    name: 'uses only entered public-account operating rows for cash income and expense',
    run: () => {
      const report = buildFinanceBusinessOverview({
        accrualRecords: [],
        basis: 'cash-flow',
        financeRows: [
          createCashRecord({ amount: 1000, id: 'entered-income' }),
          createCashRecord({
            amount: 300,
            category: '外协付款',
            direction: '支出',
            id: 'entered-expense',
            paymentMethod: '对公账户付款',
            reconciliationStatus: '未对账',
            sourceType: '外协结算'
          }),
          createCashRecord({
            amount: 200,
            id: 'pending-income',
            status: '待复核',
            transactionNo: 'FIN-TEST-002'
          }),
          createCashRecord({
            amount: 500,
            direction: '内部转入',
            id: 'internal-transfer',
            paymentMethod: '对公账户收款',
            transactionNo: 'FIN-TEST-003'
          }),
          createCashRecord({
            amount: 700,
            id: 'employee-handled',
            paymentMethod: '员工代收',
            settlementAccountType: '员工经办资金',
            transactionNo: 'FIN-TEST-004'
          }),
          createCashRecord({
            amount: 900,
            id: 'out-of-range',
            occurredAt: '2026-05-20',
            transactionNo: 'FIN-TEST-005'
          })
        ],
        range: juneRange
      });

      assertEqual(report.summary.income, 1000, 'cash income should include entered public-account income only');
      assertEqual(report.summary.totalCost, 300, 'cash expense should include entered public-account expense only');
      assertEqual(report.summary.netProfit, 700, 'cash net inflow should subtract cash expense from cash income');
      assertEqual(report.summary.pendingReviewAmount, 200, 'cash view should separately summarize pending-review public-account rows');
      assertEqual(report.summary.unreconciledAmount, 300, 'cash view should separately summarize unreconciled entered rows');
      assertEqual(report.metrics.length, 6, 'cash result metrics should not duplicate status summary items');
    }
  },
  {
    name: 'builds business-confirmation status summary from supported receivable and payable records',
    run: () => {
      const report = buildFinanceBusinessOverview({
        accrualRecords: [
          createAccrualRecord({
            amount: 1000,
            id: 'unsettled-receivable',
            settledAmount: 400,
            status: '部分结清'
          }),
          createAccrualRecord({
            amount: 500,
            category: '外协付款',
            counterpartyType: '外协',
            direction: '应付',
            documentNo: 'AP-TEST-010',
            id: 'unsettled-payable',
            settledAmount: 100,
            sourceType: '外协结算',
            status: '未结清'
          }),
          createAccrualRecord({
            amount: 700,
            dueDate: '2026-06-05',
            id: 'overdue-receivable',
            settledAmount: 100,
            status: '已逾期'
          }),
          createAccrualRecord({
            amount: 300,
            category: '差旅交通',
            counterpartyType: '员工',
            direction: '应付',
            documentNo: 'AP-TEST-011',
            dueDate: '2026-06-06',
            id: 'overdue-payable',
            settledAmount: 0,
            sourceType: '员工报销',
            status: '已逾期'
          })
        ],
        basis: 'business-confirmation',
        financeRows: [],
        range: juneRange
      });
      const statusByKey = Object.fromEntries(report.statusItems.map((item) => [item.key, item]));

      assertEqual(report.statusItems.length, 5, 'business-confirmation status should render five supported status cards');
      assertEqual(statusByKey.confirmationItems?.value, 4, 'confirmation status should count report-included confirmation records');
      assertEqual(statusByKey.confirmationItems?.valueType, 'count', 'confirmation status should use count value');
      assertEqual(statusByKey.confirmationItems?.meta, '应收 2 / 应付 2', 'confirmation status should split receivable and payable counts');
      assertEqual(statusByKey.overdueReceivable?.value, 600, 'overdue receivable should use outstanding receivable amount');
      assertEqual(statusByKey.overdueReceivable?.valueType, 'amount', 'overdue receivable should use amount value');
      assertEqual(statusByKey.overduePayable?.value, 300, 'overdue payable should use outstanding payable amount');
      assertEqual(statusByKey.unsettledReceivable?.value, 2, 'unsettled receivable should count unsettled receivable records');
      assertEqual(statusByKey.unsettledPayable?.value, 2, 'unsettled payable should count unsettled payable records');
      assertEqual(statusByKey.pendingReview?.value, undefined, 'business-confirmation status should not expose cash review state');
    }
  },
  {
    name: 'builds cash-flow status summary from public-account, review, reconciliation, and fund states',
    run: () => {
      const report = buildFinanceBusinessOverview({
        accrualRecords: [
          createAccrualRecord({
            amount: 700,
            dueDate: '2026-06-05',
            id: 'overdue-accrual',
            settledAmount: 100,
            status: '已逾期'
          })
        ],
        basis: 'cash-flow',
        financeRows: [
          createCashRecord({ amount: 500, id: 'entered-income' }),
          createCashRecord({
            amount: 200,
            category: '外协付款',
            direction: '支出',
            id: 'unreconciled-expense',
            paymentMethod: '对公账户付款',
            reconciliationStatus: '未对账',
            sourceType: '外协结算'
          }),
          createCashRecord({
            amount: 300,
            id: 'pending-review',
            reconciliationStatus: '未对账',
            status: '待复核',
            transactionNo: 'FIN-TEST-006'
          }),
          createCashRecord({
            amount: 400,
            collectionStatus: '部分转入对公',
            collectedAmount: 100,
            id: 'pending-transfer',
            paymentMethod: '员工代收',
            settlementAccountType: '员工经办资金',
            transactionNo: 'FIN-TEST-007'
          }),
          createCashRecord({
            amount: 250,
            category: '办公费用',
            collectionStatus: '待报销',
            direction: '支出',
            id: 'pending-reimburse',
            paymentMethod: '员工垫付',
            settlementAccountType: '员工经办资金',
            transactionNo: 'FIN-TEST-008'
          })
        ],
        publicAccountOpeningBalance: 1000,
        range: juneRange
      });
      const statusByKey = Object.fromEntries(report.statusItems.map((item) => [item.key, item]));

      assertEqual(report.statusItems.length, 4, 'cash-flow status should render four cash-side status cards');
      assertEqual(statusByKey.publicAccountBalance?.value, 1300, 'public account balance should include opening balance and entered public movements');
      assertEqual(statusByKey.publicAccountBalance?.valueType, 'amount', 'public account balance should use amount value');
      assertEqual(statusByKey.pendingReview?.value, 300, 'pending review summary should total pending public-account operating rows');
      assertEqual(statusByKey.unreconciled?.value, 500, 'unreconciled summary should include unreconciled public-account movements in range');
      assertEqual(statusByKey.overdueReceivable?.value, undefined, 'cash-flow status should not expose receivable overdue state');
      assertEqual(statusByKey.pendingFund?.value, 550, 'pending fund summary should combine pending transfer and reimbursement amounts');
      assertEqual(statusByKey.pendingFund?.meta, '转入 1 / 报销 1', 'pending fund summary should keep transfer and reimbursement counts');
    }
  },
  {
    name: 'calculates month-over-month and year-over-year comparisons for scoped metrics',
    run: () => {
      const report = buildFinanceBusinessOverview({
        accrualRecords: [
          createAccrualRecord({ amount: 1000, confirmDate: '2026-06-10', id: 'current' }),
          createAccrualRecord({ amount: 500, accountingPeriod: '2026-05', confirmDate: '2026-05-10', id: 'previous' }),
          createAccrualRecord({ amount: 250, accountingPeriod: '2025-06', confirmDate: '2025-06-10', id: 'previous-year' })
        ],
        basis: 'business-confirmation',
        financeRows: [],
        range: juneRange
      });
      const incomeMetric = report.metrics.find((metric) => metric.key === 'income');

      assertClose(incomeMetric?.monthOverMonth?.value, 1, 'income month-over-month should compare against previous month');
      assertClose(incomeMetric?.yearOverYear?.value, 3, 'income year-over-year should compare against same range last year');
    }
  }
];

export function runFinanceBusinessOverviewModelTests() {
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
