import { financeTransactionRecords, getFinanceCategorySnapshot } from './financeData';
import {
  financeInvoiceBusinessAllocations,
  financeInvoiceRecords,
  type FinanceInvoiceBusinessAllocation,
  type FinanceInvoiceRecord
} from './financeInvoiceData';
import {
  buildInvoiceBusinessAllocations,
  buildInvoiceBusinessAssociationCandidates,
  buildRedInvoiceBusinessAllocations,
  doesInvoiceAllocationMatchReceivablePayable,
  getInvoiceMatchedReceivablePayableTargets,
  haveBusinessInvoiceAssociationDraftsChanged,
  haveInvoiceAssociationDraftsChanged,
  isFinanceReceivablePayableInvoiceAssociationRequired
} from './financeInvoiceAssociationModel';
import { getInvoiceMatchedAmount, getInvoiceMatchStatus } from './financeInvoiceModel';
import { financeReceivablePayableRecords, type FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { resolveFinanceAccrualTaxBasis } from './financeTaxBasisModel';

type UnitTest = { name: string; run: () => void };

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
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
    counterparty: '武汉城设商业运营有限公司',
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
    sourceTitle: '武汉城设商业运营有限公司方案阶段',
    sourceType: '任务结算',
    taxBasis: {
      basisSource: '来源单据',
      salesCategory: '服务、不动产和无形资产',
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
    counterparty: '武汉城设商业运营有限公司',
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
    netAmount: 12673.27,
    sourceFile: '2026-07_销项发票_税务下载.xlsx',
    taxAmount: 126.73,
    taxExcludedAmount: 12673.27,
    taxIncludedAmount: 12800,
    taxRate: '1%',
    taxableClassification: '普通应税交易',
    totalAmount: 12800,
    vatTreatment: '减按1%',
    ...overrides,
    salesCategory: overrides.salesCategory ?? '服务、不动产和无形资产'
  };
}

const tests: UnitTest[] = [
  {
    name: 'excludes payroll and performance facts from invoice association',
    run: () => {
      const salaryRecord = createReceivablePayableRecord({
        category: '工资发放', counterparty: '示例员工', counterpartyType: '员工', direction: '应付', sourceType: '薪酬发放',
        taxBasis: { basisSource: '不涉及发票', salesCategory: '服务、不动产和无形资产', taxAmount: 0, taxExcludedAmount: 12000, taxIncludedAmount: 12000, taxRate: '0%' }
      });

      assertEqual(isFinanceReceivablePayableInvoiceAssociationRequired(salaryRecord), false, 'salary payable should not need invoice association');
    }
  },
  {
    name: 'labels name-only invoice candidates as name matches',
    run: () => {
      const invoice = createInvoiceRecord({ counterparty: '武汉城设商业运营有限公司', id: 'invoice-name-match-001' });
      const record = createReceivablePayableRecord({ counterparty: '武汉城设商业运营有限公司', id: 'rp-name-match-001' });
      const candidates = buildInvoiceBusinessAssociationCandidates(invoice, [invoice], [], [record]);

      assertEqual(candidates.length, 1, 'matching counterparty should produce one candidate');
      assertEqual(candidates[0]?.matchBasis, '名称一致', 'name-only candidate should expose an honest match basis');
    }
  },
  {
    name: 'uses only a business record id to resolve an allocation target',
    run: () => {
      const firstRecord = createReceivablePayableRecord({ id: 'rp-id-001', documentNo: 'AR-001', sourceNo: 'CON-SHARED' });
      const secondRecord = createReceivablePayableRecord({ id: 'rp-id-002', documentNo: 'AR-002', sourceNo: 'CON-SHARED' });
      const allocation: FinanceInvoiceBusinessAllocation = {
        createdAt: '2026-06-21 10:00', createdBy: '李明', id: 'allocation-001', invoiceId: 'invoice-001', matchBasis: '来源单据',
        status: '有效', targetId: firstRecord.id, targetNo: firstRecord.documentNo, targetTitle: firstRecord.sourceTitle,
        targetType: '应收应付', taxAmount: 0, taxExcludedAmount: 1000, taxIncludedAmount: 1000
      };

      assertEqual(doesInvoiceAllocationMatchReceivablePayable(allocation, firstRecord), true, 'matching record id should resolve');
      assertEqual(doesInvoiceAllocationMatchReceivablePayable(allocation, secondRecord), false, 'shared contract source must not cause a second match');
    }
  },
  {
    name: 'keeps multi-to-multi allocation tax amounts proportional and source-specific',
    run: () => {
      const firstRecord = createReceivablePayableRecord({ id: 'rp-split-001', amount: 4000, documentNo: 'AR-SPLIT-001' });
      const secondRecord = createReceivablePayableRecord({ id: 'rp-split-002', amount: 6000, documentNo: 'AR-SPLIT-002' });
      const invoice = createInvoiceRecord({ id: 'invoice-split-001', taxIncludedAmount: 10000, totalAmount: 10000, taxExcludedAmount: 9900.99, netAmount: 9900.99, taxAmount: 99.01 });
      const allocations = buildInvoiceBusinessAllocations(invoice, [
        { amount: 4000, matchBasis: '来源单据', targetId: firstRecord.id, targetNo: firstRecord.documentNo, targetTitle: firstRecord.sourceTitle, targetType: '应收应付' },
        { amount: 6000, matchBasis: '来源单据', targetId: secondRecord.id, targetNo: secondRecord.documentNo, targetTitle: secondRecord.sourceTitle, targetType: '应收应付' }
      ], { actor: '李明', occurredAt: '2026-07-03 10:20', sequence: 1 });
      const firstTaxBasis = resolveFinanceAccrualTaxBasis(firstRecord, [invoice], allocations);
      const secondTaxBasis = resolveFinanceAccrualTaxBasis(secondRecord, [invoice], allocations);

      assertEqual(allocations.reduce((total, allocation) => total + allocation.taxIncludedAmount, 0), 10000, 'allocation gross amounts should reconcile to the invoice');
      assertEqual(Number(allocations.reduce((total, allocation) => total + allocation.taxAmount, 0).toFixed(2)), 99.01, 'allocation tax amounts should reconcile to the invoice');
      assertEqual(firstTaxBasis.taxIncludedAmount, 4000, 'first business fact should read only its allocated invoice amount');
      assertEqual(secondTaxBasis.taxIncludedAmount, 6000, 'second business fact should read only its allocated invoice amount');
    }
  },
  {
    name: 'creates negative allocations for a linked red invoice without editing the original allocation',
    run: () => {
      const record = createReceivablePayableRecord({ id: 'rp-red-001', amount: 1200, documentNo: 'AR-RED-001' });
      const original = createInvoiceRecord({ id: 'invoice-origin-001', taxIncludedAmount: 1200, totalAmount: 1200, taxExcludedAmount: 1200, netAmount: 1200, taxAmount: 0 });
      const red = createInvoiceRecord({ id: 'invoice-red-001', invoiceColor: '红票', invoiceStatus: '红冲', taxIncludedAmount: -1200, totalAmount: -1200, taxExcludedAmount: -1200, netAmount: -1200, taxAmount: 0 });
      const originalAllocations = buildInvoiceBusinessAllocations(original, [
        { amount: 1200, matchBasis: '来源单据', targetId: record.id, targetNo: record.documentNo, targetTitle: record.sourceTitle, targetType: '应收应付' }
      ], { actor: '李明', occurredAt: '2026-06-16 10:00', sequence: 1 });
      const redAllocations = buildRedInvoiceBusinessAllocations(red, original, originalAllocations, { actor: '李明', occurredAt: '2026-06-20 10:00', sequence: 2 });

      assertEqual(originalAllocations[0]?.taxIncludedAmount, 1200, 'original allocation must remain immutable');
      assertEqual(redAllocations[0]?.taxIncludedAmount, -1200, 'red allocation must be negative');
      assertEqual(redAllocations[0]?.sourceAllocationId, originalAllocations[0]?.id, 'red allocation must trace its original allocation');
    }
  },
  {
    name: 'detects invoice association changes by business identity, amount, and match basis',
    run: () => {
      const invoice = createInvoiceRecord({ id: 'invoice-dirty-001', taxIncludedAmount: 1000, totalAmount: 1000 });
      const record = createReceivablePayableRecord({ id: 'rp-dirty-001', amount: 1000, documentNo: 'AR-DIRTY-001' });
      const allocations = buildInvoiceBusinessAllocations(invoice, [{
        amount: 1000,
        matchBasis: '来源单据',
        targetId: record.id,
        targetNo: record.documentNo,
        targetTitle: record.sourceTitle,
        targetType: '应收应付'
      }], { actor: '李明', occurredAt: '2026-07-11 09:00', sequence: 1 });
      const unchangedDraft = [{
        amount: 1000,
        matchBasis: '来源单据' as const,
        targetId: record.id,
        targetNo: record.documentNo,
        targetTitle: record.sourceTitle,
        targetType: '应收应付' as const
      }];

      assertEqual(haveInvoiceAssociationDraftsChanged(invoice.id, unchangedDraft, allocations), false, 'unchanged invoice allocation should stay clean');
      assertEqual(
        haveInvoiceAssociationDraftsChanged(invoice.id, [{ ...unchangedDraft[0], amount: 900 }], allocations),
        true,
        'amount change should mark invoice allocation dirty'
      );
      assertEqual(
        haveInvoiceAssociationDraftsChanged(invoice.id, [{ ...unchangedDraft[0], matchBasis: '名称一致' }], allocations),
        true,
        'match-basis change should mark invoice allocation dirty'
      );
      assertEqual(haveInvoiceAssociationDraftsChanged(invoice.id, [], allocations), true, 'removing the association should mark invoice allocation dirty');
    }
  },
  {
    name: 'detects reverse business-to-invoice association changes',
    run: () => {
      const invoice = createInvoiceRecord({ id: 'invoice-business-dirty-001', taxIncludedAmount: 800, totalAmount: 800 });
      const record = createReceivablePayableRecord({ id: 'rp-business-dirty-001', amount: 800, documentNo: 'AR-BUSINESS-DIRTY-001' });
      const allocations = buildInvoiceBusinessAllocations(invoice, [{
        amount: 800,
        matchBasis: '来源单据',
        targetId: record.id,
        targetNo: record.documentNo,
        targetTitle: record.sourceTitle,
        targetType: '应收应付'
      }], { actor: '李明', occurredAt: '2026-07-11 09:10', sequence: 1 });
      const unchangedDraft = [{ amount: 800, invoiceId: invoice.id, matchBasis: '来源单据' as const }];

      assertEqual(haveBusinessInvoiceAssociationDraftsChanged(record.id, unchangedDraft, allocations), false, 'unchanged reverse association should stay clean');
      assertEqual(
        haveBusinessInvoiceAssociationDraftsChanged(record.id, [{ ...unchangedDraft[0], amount: 700 }], allocations),
        true,
        'reverse association amount change should mark the drawer dirty'
      );
    }
  },
  {
    name: 'keeps every seed allocation backed by a real invoice and source object',
    run: () => {
      financeInvoiceBusinessAllocations.forEach((allocation) => {
        assert(financeInvoiceRecords.some((invoice) => invoice.id === allocation.invoiceId), `${allocation.id} should reference an invoice`);

        if (allocation.targetType === '应收应付') {
          assert(financeReceivablePayableRecords.some((record) => record.id === allocation.targetId), `${allocation.id} should reference an accrual record`);
        } else {
          assert(financeTransactionRecords.some((record) => record.id === allocation.targetId), `${allocation.id} should reference an unbilled-income transaction`);
        }
      });

      const linkedInvoice = financeInvoiceRecords.find((invoice) => invoice.id === 'invoice-out-202606-001');
      assert(linkedInvoice, 'seed invoice must exist');
      assertEqual(getInvoiceMatchStatus(linkedInvoice, financeInvoiceBusinessAllocations), '已匹配', 'seed invoice should resolve through allocations');
      assertEqual(getInvoiceMatchedAmount(linkedInvoice, financeInvoiceBusinessAllocations), 68000, 'seed allocation should expose its matched amount');
      assertEqual(
        getInvoiceMatchedReceivablePayableTargets(linkedInvoice, financeInvoiceBusinessAllocations, financeReceivablePayableRecords).length,
        1,
        'seed invoice should resolve its business target through the relationship entity'
      );
    }
  }
];

export function runFinanceInvoiceAssociationModelTests() {
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

  return { failures, passed, total: tests.length };
}
