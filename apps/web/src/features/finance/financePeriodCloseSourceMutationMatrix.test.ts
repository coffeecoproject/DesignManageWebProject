import {
  financePeriodCloseSourceMutationAreas,
  financePeriodCloseSourceMutationMatrix
} from './financePeriodCloseSourceMutationMatrix';

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

function findEntryByRoute(route: string) {
  return financePeriodCloseSourceMutationMatrix.find((entry) => entry.localApiRoute === route);
}

const requiredLocalApiRoutes = [
  '/api/finance/receivables-payables',
  '/api/finance/receivables-payables/{id}/adjust',
  '/api/finance/receivables-payables/{id}/settlements',
  '/api/finance/receivables-payables/{id}/void',
  '/api/finance/receivables-payables/{id}/tax-basis',
  '/api/finance/invoices/import',
  '/api/finance/invoices/{id}/associations',
  '/api/finance/receivables-payables/{id}/invoice-associations',
  '/api/finance/invoices/{id}/red-original',
  '/api/finance/cash-flows/{id}/review',
  '/api/finance/cash-flows/{id}/return',
  '/api/finance/cash-flows/{id}/void',
  '/api/finance/cash-flows/{id}/voucher-files',
  '/api/finance/cash-flows/{id}/adjustments',
  '/api/finance/bank-reconciliation/{id}/confirm',
  '/api/finance/bank-reconciliation/{id}/revoke',
  '/api/finance/bank-reconciliation/{id}/system-flow',
  '/api/finance/bank-reconciliation/{id}/adjustments',
  '/api/finance/bank-reconciliation/{id}/resolve-exception',
  '/api/finance/accounting-vouchers/{id}/book',
  '/api/finance/accounting-vouchers/batch-book',
  '/api/finance/accounting-vouchers/{id}/reverse',
  '/api/finance/accounting-vouchers/{id}/later-period-adjustments',
  '/api/finance/tax-handling/{id}/declaration',
  '/api/finance/tax-handling/{id}/payment',
  '/api/finance/tax-handling/{id}/receipts',
  '/api/finance/declaration-preparation/{id}/confirm-item',
  '/api/finance/declaration-preparation/{id}/confirm',
  '/api/finance/social-insurance/{id}/confirm-detail',
  '/api/finance/social-insurance/{id}/confirm-payment',
  '/api/finance/social-insurance/{id}/receipts',
  '/api/finance/payroll-results/{id}/confirm',
  '/api/finance/payroll-results/{id}/settle',
  '/api/finance/payroll-results/{id}/adjustments',
  '/api/finance/ledger-initialization/{id}/opening-adjustment',
  '/api/finance/ledger-initialization/{id}/withdraw-enable'
] as const;

const requiredStateWrites = [
  'addSourceGeneratedReceivablePayableRecord',
  'updateReceivablePayableRecord',
  'addFinanceTransaction',
  'importInvoiceBatch',
  'replaceInvoiceBusinessAssociations',
  'replaceBusinessInvoiceAssociations',
  'linkRedInvoiceOriginal',
  'reviewFinanceTransaction',
  'returnFinanceTransaction',
  'voidFinanceTransaction',
  'addTransactionVoucherFile',
  'removeTransactionVoucherFile',
  'confirmBankReconciliation',
  'revokeBankReconciliation',
  'updateFinanceTransactionsByNo',
  'bookAccountingVoucher',
  'reverseAccountingVoucher',
  'addAccountingVoucherLaterPeriodAdjustment',
  'updateTaxMatterRecord',
  'updateDeclarationPreparationRecord',
  'updateSocialInsuranceRecordStatus',
  'confirmSalaryMonthlyReport',
  'markSalaryMonthlyPaid',
  'saveSalaryAdjustment',
  'addLedgerOpeningAdjustmentVoucher',
  'withdrawEnablement'
] as const;

const tests: UnitTest[] = [
  {
    name: 'keeps source mutation matrix identity and required fields stable',
    run: () => {
      const ids = new Set<string>();

      for (const entry of financePeriodCloseSourceMutationMatrix) {
        assert(!ids.has(entry.id), `matrix id should be unique: ${entry.id}`);
        ids.add(entry.id);
        assert(entry.ownerRoute.startsWith('/'), `${entry.id} should use an absolute owner route`);
        assert(entry.localApiRoute.startsWith('/api/finance/'), `${entry.id} should use a local finance API route`);
        assert(entry.accountingPeriodSource.trim().length > 0, `${entry.id} should declare accounting-period source`);
        assert(entry.closedPeriodBehavior.includes('闭期'), `${entry.id} should declare closed-period behavior`);
        assert(entry.evidence.trim().length > 0, `${entry.id} should declare evidence source`);
        assert(entry.stateWrites.length > 0, `${entry.id} should declare at least one frontend state write`);
      }

      assertEqual(ids.size, financePeriodCloseSourceMutationMatrix.length, 'matrix should not contain duplicate ids');
    }
  },
  {
    name: 'covers every guarded source mutation area',
    run: () => {
      const coveredAreas = new Set(financePeriodCloseSourceMutationMatrix.map((entry) => entry.sourceArea));

      for (const area of financePeriodCloseSourceMutationAreas) {
        assert(coveredAreas.has(area), `${area} should have at least one frontend source-write entry`);
      }
    }
  },
  {
    name: 'covers documented local source mutation API routes',
    run: () => {
      for (const route of requiredLocalApiRoutes) {
        assert(findEntryByRoute(route), `${route} should be represented in source mutation matrix`);
      }
    }
  },
  {
    name: 'covers current frontend state write boundaries',
    run: () => {
      const coveredStateWrites = new Set(financePeriodCloseSourceMutationMatrix.flatMap((entry) => entry.stateWrites));

      for (const stateWrite of requiredStateWrites) {
        assert(coveredStateWrites.has(stateWrite), `${stateWrite} should be represented in source mutation matrix`);
      }
    }
  },
  {
    name: 'keeps invoice import and association under the invoice ledger boundary',
    run: () => {
      const invoiceImport = findEntryByRoute('/api/finance/invoices/import');
      const invoiceAssociation = findEntryByRoute('/api/finance/invoices/{id}/associations');
      const businessAssociation = findEntryByRoute('/api/finance/receivables-payables/{id}/invoice-associations');

      assertEqual(invoiceImport?.sourceArea, 'invoice_ledger', 'invoice import should use invoice ledger source area');
      assertEqual(invoiceAssociation?.sourceArea, 'invoice_ledger', 'invoice association should use invoice ledger source area');
      assertEqual(businessAssociation?.ownerRoute, '/finance/receivables-payables', 'business-side association should stay in receivable-payable detail');
    }
  }
];

export function runFinancePeriodCloseSourceMutationMatrixTests() {
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
