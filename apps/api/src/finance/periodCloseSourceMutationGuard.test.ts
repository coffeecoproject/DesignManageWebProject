import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord } from './periodCloseContract.js';
import {
  financeSourceMutationAreaLabels,
  guardFinanceSourceMutation,
  guardedFinanceSourceMutationAreas,
  sourceAccountingPeriodUnresolvedErrorCode,
  type FinanceSourceMutationArea
} from './periodCloseSourceMutationGuard.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createPeriod(period: string, status: AccountingPeriodRecord['status']): AccountingPeriodRecord {
  return {
    period,
    status,
    version: 1
  };
}

function createGuardRequest(overrides: {
  accountingPeriods?: Array<string | undefined>;
  operation?: string;
  sourceArea?: FinanceSourceMutationArea;
  sourceId?: string;
}) {
  return {
    accountingPeriods: ['2026-06'],
    operation: '调整应收应付事项',
    requestId: 'req-source-guard-001',
    sourceArea: 'receivable_payable' as const,
    sourceId: 'rp-001',
    ...overrides
  };
}

const accountingPeriods = [
  createPeriod('2026-05', '已结账'),
  createPeriod('2026-06', '开放'),
  createPeriod('2026-07', '已反结账')
];

const tests: UnitTest[] = [
  {
    name: 'registers every period-affecting source area with a user-facing module label',
    run: () => {
      assertEqual(guardedFinanceSourceMutationAreas.length, 10, 'guarded source area count should stay explicit');

      for (const area of guardedFinanceSourceMutationAreas) {
        assertEqual(typeof financeSourceMutationAreaLabels[area], 'string', `${area} should have a source module label`);
        assertEqual(financeSourceMutationAreaLabels[area].length > 0, true, `${area} label should not be empty`);
      }

      assertEqual(financeSourceMutationAreaLabels.invoice_ledger, '发票台账', 'invoice import should stay separated from invoice matching');
    }
  },
  {
    name: 'allows source mutation when all resolved periods are open or reopened',
    run: () => {
      const result = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-06', '2026-07', '2026-06'],
          sourceArea: 'invoice_matching'
        })
      });

      assertEqual(result.allowed, true, 'open and reopened periods should allow mutation');
      assertEqual(result.checkedAccountingPeriods.join(','), '2026-06,2026-07', 'periods should be normalized and deduplicated');
      assertEqual(result.sourceModule, '发票匹配', 'source module should come from area definition');
    }
  },
  {
    name: 'blocks backdated source mutation into a closed period with canonical error code',
    run: () => {
      const result = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-05'],
          operation: '补登记系统流水',
          sourceArea: 'bank_reconciliation',
          sourceId: 'bank-001'
        })
      });

      assertEqual(result.allowed, false, 'closed period should block mutation');

      if (result.allowed) {
        return;
      }

      assertEqual(result.error.code, canonicalClosedAccountingPeriodErrorCode, 'closed period should use canonical error code');
      assertEqual(result.error.period, '2026-05', 'closed error should keep blocked period');
      assertEqual(result.error.nextAction, '后续期间调整', 'closed error should guide normal correction path');
      assertEqual(
        result.error.message.includes('请优先创建后续期间调整事项，反结账属于异常流程'),
        true,
        'closed error should prefer later-period adjustment and mark reopen as exceptional'
      );
      assertEqual(result.sourceModule, '银行对账', 'source module should be bank reconciliation');
    }
  },
  {
    name: 'checks both old and new accounting periods when mutation changes period',
    run: () => {
      const blockedByOldPeriod = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-05', '2026-06'],
          operation: '调整发票归属期间',
          sourceArea: 'invoice_matching',
          sourceId: 'inv-001'
        })
      });
      const allowedMove = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-06', '2026-07'],
          operation: '调整发票归属期间',
          sourceArea: 'invoice_matching',
          sourceId: 'inv-002'
        })
      });

      assertEqual(blockedByOldPeriod.allowed, false, 'closed old period should block period-changing mutation');
      assertEqual(allowedMove.allowed, true, 'open to reopened period move should be allowed by guard');
    }
  },
  {
    name: 'rejects source mutation when accounting period cannot be resolved',
    run: () => {
      const missingPeriod = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: [undefined, ''],
          operation: '生成税费缴款流水',
          sourceArea: 'tax_handling',
          sourceId: 'tax-001'
        })
      });
      const malformedPeriod = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-Q2'],
          operation: '确认社保公积金缴费',
          sourceArea: 'social_insurance_housing_fund',
          sourceId: 'si-001'
        })
      });
      const unknownPeriod = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-08'],
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'rp-unknown'
        })
      });

      assertEqual(missingPeriod.allowed, false, 'missing period should reject mutation');
      assertEqual(malformedPeriod.allowed, false, 'malformed period should reject mutation');
      assertEqual(unknownPeriod.allowed, false, 'unknown registered period should reject mutation');

      if (!missingPeriod.allowed) {
        assertEqual(missingPeriod.error.code, sourceAccountingPeriodUnresolvedErrorCode, 'missing period should use unresolved error');
      }

      if (!malformedPeriod.allowed) {
        assertEqual(malformedPeriod.error.code, sourceAccountingPeriodUnresolvedErrorCode, 'malformed period should use unresolved error');
      }

      if (!unknownPeriod.allowed) {
        assertEqual(unknownPeriod.error.code, sourceAccountingPeriodUnresolvedErrorCode, 'unknown period should use unresolved error');
      }
    }
  },
  {
    name: 'guards accounting voucher and ledger initialization mutations with same contract',
    run: () => {
      const voucherResult = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-05'],
          operation: '记账会计凭证',
          sourceArea: 'accounting_voucher',
          sourceId: 'voucher-001'
        })
      });
      const openingAdjustmentResult = guardFinanceSourceMutation({
        periods: accountingPeriods,
        request: createGuardRequest({
          accountingPeriods: ['2026-06'],
          operation: '生成期初调整凭证',
          sourceArea: 'ledger_initialization',
          sourceId: 'opening-001'
        })
      });

      assertEqual(voucherResult.allowed, false, 'closed period should block voucher mutation');
      assertEqual(openingAdjustmentResult.allowed, true, 'open period should allow opening adjustment mutation');
    }
  }
];

for (const test of tests) {
  test.run();
}
