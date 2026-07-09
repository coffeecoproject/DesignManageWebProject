import { financeSourceMutationRouteDefinitions } from './periodCloseSourceMutationRoutes.js';
import { guardedFinanceSourceMutationAreas } from './periodCloseSourceMutationGuard.js';
import {
  financeDedicatedClosedPeriodCorrectionRegistry,
  financeSourceMutationOperationRegistry,
  findFinanceSourceMutationOperation
} from './periodCloseSourceMutationRegistry.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

const tests: UnitTest[] = [
  {
    name: 'keeps source mutation registry in one-to-one alignment with route adapter definitions',
    run: () => {
      assertEqual(
        financeSourceMutationOperationRegistry.length,
        financeSourceMutationRouteDefinitions.length,
        'ordinary source mutation registry should match route adapter definition count'
      );

      for (const definition of financeSourceMutationRouteDefinitions) {
        const registryEntry = findFinanceSourceMutationOperation(definition.operation);

        assert(registryEntry !== undefined, `${definition.operation} should have registry metadata`);
        assertEqual(registryEntry.sourceArea, definition.sourceArea, `${definition.operation} source area should match route`);
        assertEqual(registryEntry.localApiMethod, definition.method, `${definition.operation} method should match route`);
        assertEqual(registryEntry.permissionScope, definition.permissionScope, `${definition.operation} permission should match route`);
        assertEqual(registryEntry.successStatus, definition.successStatus, `${definition.operation} success status should match route`);
        assertEqual(
          registryEntry.createsSourceRecord,
          Boolean(definition.createsSourceRecord),
          `${definition.operation} create-source flag should match route`
        );
        assertEqual(
          registryEntry.sourceIdFromBody,
          Boolean(definition.sourceIdFromBody),
          `${definition.operation} source-id body flag should match route`
        );
      }
    }
  },
  {
    name: 'requires every guarded source area to have executable operation metadata',
    run: () => {
      const registryAreas = new Set(financeSourceMutationOperationRegistry.map((entry) => entry.sourceArea));

      for (const area of guardedFinanceSourceMutationAreas) {
        assert(registryAreas.has(area), `${area} should have at least one ordinary guarded operation`);
      }
    }
  },
  {
    name: 'keeps period source and closed-period behavior explicit for every operation',
    run: () => {
      for (const entry of financeSourceMutationOperationRegistry) {
        assert(
          entry.accountingPeriodSource.includes('月份') || entry.accountingPeriodSource.includes('期间'),
          `${entry.operation} should explain accounting period source`
        );
        assert(entry.closedPeriodBehavior.includes('闭期'), `${entry.operation} should declare closed-period behavior`);
        assert(
          ['source_period', 'source_and_target_period', 'target_period_required'].includes(entry.periodCheckMode),
          `${entry.operation} should use a known period-check mode`
        );
        assert(
          [
            'reject_direct_mutation',
            'reject_then_later_period_adjustment',
            'reject_then_opening_adjustment',
            'reject_then_reopen_exception'
          ].includes(entry.closedPeriodPath),
          `${entry.operation} should use a known closed-period correction path`
        );
      }
    }
  },
  {
    name: 'marks create-type operations as target-period required before source row insertion',
    run: () => {
      const createOperations = financeSourceMutationOperationRegistry.filter((entry) => entry.createsSourceRecord);

      assertEqual(createOperations.length, 2, 'only current receivable payable creation and invoice import create source rows');

      for (const entry of createOperations) {
        assertEqual(
          entry.periodCheckMode,
          'target_period_required',
          `${entry.operation} should resolve target period before source insertion`
        );
        assertEqual(entry.sourceIdFromBody, true, `${entry.operation} should take source id from body`);
      }
    }
  },
  {
    name: 'keeps later-period adjustment outside ordinary direct source mutation registry',
    run: () => {
      const ordinaryLaterAdjustment = financeSourceMutationOperationRegistry.find(
        (entry) => entry.operation === '生成后续期间调整'
      );
      const dedicatedLaterAdjustment = financeDedicatedClosedPeriodCorrectionRegistry.find(
        (entry) => entry.operation === '生成后续期间调整'
      );

      assertEqual(ordinaryLaterAdjustment, undefined, 'later-period adjustment should not use ordinary closed-period mutation guard');
      assert(dedicatedLaterAdjustment !== undefined, 'later-period adjustment should have a dedicated correction registry entry');
      assertEqual(
        dedicatedLaterAdjustment.requiredOriginalPeriodState,
        '已结账',
        'later-period adjustment should require a closed original period'
      );
      assertEqual(
        dedicatedLaterAdjustment.requiredTargetPeriodState,
        '开放',
        'later-period adjustment should require an open target period'
      );
      assertEqual(
        dedicatedLaterAdjustment.localApiRoute,
        '/api/finance/accounting-vouchers/{id}/later-period-adjustments',
        'later-period adjustment route should stay explicit'
      );
    }
  },
  {
    name: 'preserves industrial correction paths for voucher, opening balance, and source direct writes',
    run: () => {
      const voucherBook = findFinanceSourceMutationOperation('记账会计凭证');
      const openingAdjustment = findFinanceSourceMutationOperation('生成期初调整凭证');
      const bankSystemFlow = findFinanceSourceMutationOperation('补登记系统流水');

      assert(voucherBook !== undefined, 'voucher booking should be registered');
      assert(openingAdjustment !== undefined, 'opening adjustment should be registered');
      assert(bankSystemFlow !== undefined, 'bank system-flow registration should be registered');
      assertEqual(
        voucherBook.closedPeriodPath,
        'reject_then_later_period_adjustment',
        'closed-period voucher correction should use later-period adjustment'
      );
      assertEqual(
        openingAdjustment.closedPeriodPath,
        'reject_then_opening_adjustment',
        'opening-balance correction should use opening adjustment path'
      );
      assertEqual(
        bankSystemFlow.closedPeriodPath,
        'reject_direct_mutation',
        'bank-import system-flow creation should be rejected directly in closed periods'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
