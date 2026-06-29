import { getFinanceCategorySnapshot } from './financeData';
import type { FinanceInvoiceRecord } from './financeInvoiceData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  getFinanceReceivablePayableInvoiceDirection,
  getInvoiceReceivablePayableMatchLabel,
  isFinanceReceivablePayableInvoiceMatchApplicable
} from './financeInvoiceMatchingModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createReceivablePayableRecord(overrides: Partial<FinanceReceivablePayableRecord> = {}): FinanceReceivablePayableRecord {
  const category = overrides.category ?? '客户回款';
  const categorySnapshot = getFinanceCategorySnapshot(category);

  return {
    accountingPeriod: '2026-06',
    amount: 12800,
    category,
    categorySnapshot,
    confirmDate: '2026-06-20',
    confirmationStatus: '已确认',
    counterparty: '光谷商业空间',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-TEST-001',
    dueDate: '2026-07-05',
    files: [],
    id: 'rp-test-001',
    linkedTransactionNos: [],
    note: '',
    operationRecords: [],
    owner: '李明',
    reportAggregation: categorySnapshot.reportAggregation,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-TEST-001',
    sourceTitle: '光谷商业空间方案阶段',
    sourceType: '项目阶段确认',
    taxBasis: {
      basisSource: '来源单据',
      taxAmount: 126.73,
      taxExcludedAmount: 12673.27,
      taxIncludedAmount: 12800,
      taxRate: '1%'
    },
    updatedAt: '2026-06-20',
    ...overrides
  };
}

function createInvoiceRecord(overrides: Partial<FinanceInvoiceRecord> = {}): FinanceInvoiceRecord {
  return {
    accountingPeriod: '2026-07',
    counterparty: '光谷商业空间',
    declarationPeriod: '2026-Q3',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-test-001',
    importedAt: '2026-07-03 10:00',
    invoiceColor: '蓝票',
    invoiceDate: '2026-07-03',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000710001',
    invoiceStatus: '正常',
    matchedBusinessRefs: [],
    netAmount: 12673.27,
    sourceFile: '2026-07_销项发票_税务下载.xlsx',
    taxAmount: 126.73,
    taxExcludedAmount: 12673.27,
    taxIncludedAmount: 12800,
    taxRate: '1%',
    totalAmount: 12800,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'keeps payroll and performance facts out of invoice matching',
    run: () => {
      const salaryRecord = createReceivablePayableRecord({
        category: '工资发放',
        counterparty: '示例员工',
        counterpartyType: '员工',
        direction: '应付',
        sourceType: '薪酬发放',
        taxBasis: {
          basisSource: '不涉及发票',
          taxAmount: 0,
          taxExcludedAmount: 12000,
          taxIncludedAmount: 12000,
          taxRate: '0%'
        }
      });
      const performanceRecord = createReceivablePayableRecord({
        category: '绩效发放',
        counterparty: '示例员工',
        counterpartyType: '员工',
        direction: '应付',
        sourceType: '月度绩效',
        taxBasis: {
          basisSource: '不涉及发票',
          taxAmount: 0,
          taxExcludedAmount: 3200,
          taxIncludedAmount: 3200,
          taxRate: '0%'
        }
      });

      assertEqual(isFinanceReceivablePayableInvoiceMatchApplicable(salaryRecord), false, 'salary payable should not enter invoice matching');
      assertEqual(isFinanceReceivablePayableInvoiceMatchApplicable(performanceRecord), false, 'performance payable should not enter invoice matching');
    }
  },
  {
    name: 'uses tax policy to decide which payables need invoice matching',
    run: () => {
      const outsourcingRecord = createReceivablePayableRecord({
        amount: 3200,
        category: '外协付款',
        counterparty: '示例兼职 B',
        counterpartyType: '外协',
        direction: '应付',
        sourceType: '外协结算',
        taxBasis: {
          basisSource: '来源单据',
          taxAmount: 31.68,
          taxExcludedAmount: 3168.32,
          taxIncludedAmount: 3200,
          taxRate: '1%'
        }
      });

      assertEqual(isFinanceReceivablePayableInvoiceMatchApplicable(outsourcingRecord), true, 'outsourcing payable should follow policy-backed input invoice matching');
      assertEqual(getFinanceReceivablePayableInvoiceDirection(outsourcingRecord), '进项', 'outsourcing payable should expect input invoice');
    }
  },
  {
    name: 'allows cross-period invoice matching when the business object is the same',
    run: () => {
      const juneReceivable = createReceivablePayableRecord({ accountingPeriod: '2026-06' });
      const julyInvoice = createInvoiceRecord({ accountingPeriod: '2026-07', invoiceDate: '2026-07-03' });

      assertEqual(getFinanceReceivablePayableInvoiceDirection(juneReceivable), '销项', 'receivable should expect output invoice');
      assertEqual(isFinanceReceivablePayableInvoiceMatchApplicable(juneReceivable), true, 'contract-stage receivable should require invoice matching work');
      assertEqual(
        getInvoiceReceivablePayableMatchLabel(julyInvoice, juneReceivable),
        '对象一致',
        'cross-period invoice should still match by counterparty'
      );
    }
  },
  {
    name: 'does not expose ordinary same-direction but unrelated invoice candidates',
    run: () => {
      const juneReceivable = createReceivablePayableRecord({ accountingPeriod: '2026-06' });
      const unrelatedInvoice = createInvoiceRecord({
        accountingPeriod: '2026-06',
        counterparty: '无关客户',
        invoiceDate: '2026-06-23'
      });

      assertEqual(
        getInvoiceReceivablePayableMatchLabel(unrelatedInvoice, juneReceivable),
        undefined,
        'same direction without source, object, or reimbursement evidence should not be selectable'
      );
    }
  },
  {
    name: 'keeps employee reimbursement invoices matchable by bill amount instead of employee name',
    run: () => {
      const reimbursement = createReceivablePayableRecord({
        amount: 486.5,
        category: '差旅交通',
        confirmDate: '2026-05-30',
        counterparty: '刘宇',
        counterpartyType: '员工',
        direction: '应付',
        sourceType: '员工报销',
        taxBasis: {
          basisSource: '来源单据',
          taxAmount: 4.82,
          taxExcludedAmount: 481.68,
          taxIncludedAmount: 486.5,
          taxRate: '1%'
        }
      });
      const transportInvoice = createInvoiceRecord({
        accountingPeriod: '2026-05',
        counterparty: '交通服务商',
        direction: '进项',
        invoiceDate: '2026-05-29',
        totalAmount: 486.5
      });

      assertEqual(getFinanceReceivablePayableInvoiceDirection(reimbursement), '进项', 'reimbursement payable should expect input invoice');
      assertEqual(
        getInvoiceReceivablePayableMatchLabel(transportInvoice, reimbursement),
        '报销票据',
        'reimbursement should allow exact bill amount even when invoice seller differs from employee'
      );
    }
  }
];

export function runFinanceInvoiceMatchingModelTests() {
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
