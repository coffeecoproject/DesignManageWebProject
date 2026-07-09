import type { FinanceInvoiceRecord } from './financeInvoiceData';
import {
  buildFinanceInvoiceImportBatch,
  buildFinanceInvoiceRecordsFromImportBatch
} from './financeInvoiceImportModel';
import { getRedInvoiceOriginalAssociationAffectedInvoices } from './financeInvoiceModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createInvoice(overrides: Partial<FinanceInvoiceRecord>): FinanceInvoiceRecord {
  return {
    accountingPeriod: '2026-06',
    counterparty: '测试客户',
    declarationPeriod: '2026-Q2',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-test',
    importedAt: '2026-06-21 17:10',
    invoiceColor: '蓝票',
    invoiceDate: '2026-06-21',
    invoiceKind: '普通发票',
    invoiceNo: 'TEST-001',
    invoiceStatus: '正常',
    matchedBusinessRefs: [],
    netAmount: 990,
    sourceFile: '测试发票.xlsx',
    taxAmount: 10,
    taxExcludedAmount: 990,
    taxIncludedAmount: 1000,
    taxRate: '1%',
    totalAmount: 1000,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds an import batch and generated invoice rows for frontend session import',
    run: () => {
      const batch = buildFinanceInvoiceImportBatch({
        direction: '进销项',
        fileName: '2026-06_进销项发票_税务下载.xlsx',
        importedAt: '2026-06-15 10:00',
        period: '2026-06',
        sequence: 5
      });
      const invoiceRows = buildFinanceInvoiceRecordsFromImportBatch(batch, 5);

      assertEqual(batch.invoiceCount, 2, 'combined import should count generated output and input rows');
      assertEqual(invoiceRows.length, 2, 'combined import should generate two invoice rows');
      assertEqual(invoiceRows[0]?.accountingPeriod, '2026-06', 'generated invoice should use import period');
      assertEqual(invoiceRows[0]?.sourceFile, batch.fileName, 'generated invoice should keep imported file as source evidence');
      assertEqual(invoiceRows[0]?.matchedBusinessRefs.length, 0, 'generated invoice should enter matching as unassociated');
      assert(invoiceRows.every((invoice) => invoice.invoiceStatus === '正常'), 'generated rows should be active normal invoices');
    }
  },
  {
    name: 'single-direction import keeps batch count aligned with generated invoices',
    run: () => {
      const batch = buildFinanceInvoiceImportBatch({
        direction: '销项',
        fileName: '2026-07_销项发票_税务下载.xlsx',
        importedAt: '2026-07-02 09:10',
        period: '2026-07',
        sequence: 6
      });

      assertEqual(batch.invoiceCount, 1, 'single-direction import should count one generated invoice row');
      assertEqual(buildFinanceInvoiceRecordsFromImportBatch(batch, 6)[0]?.direction, '销项', 'generated row should follow import direction');
    }
  },
  {
    name: 'red invoice original association resolves both previous and next original invoices',
    run: () => {
      const originalJune = createInvoice({ id: 'invoice-origin-june', accountingPeriod: '2026-06' });
      const originalJuly = createInvoice({ id: 'invoice-origin-july', accountingPeriod: '2026-07' });
      const currentRed = createInvoice({
        id: 'invoice-red',
        invoiceColor: '红票',
        invoiceStatus: '红冲',
        originalInvoiceId: 'invoice-origin-june'
      });
      const nextRed = {
        ...currentRed,
        originalInvoiceId: 'invoice-origin-july'
      } satisfies FinanceInvoiceRecord;

      const affected = getRedInvoiceOriginalAssociationAffectedInvoices(currentRed, nextRed, [originalJune, originalJuly, currentRed]);

      assertEqual(affected.length, 2, 'changing red original link should guard previous and next original periods');
      assertEqual(affected.map((invoice) => invoice.accountingPeriod).join('|'), '2026-06|2026-07', 'affected original periods should be stable');
    }
  }
];

export function runFinanceInvoiceImportModelTests() {
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
