import {
  authorizeFinancePeriodCloseOperation,
  financePeriodClosePermissionScopes,
  hasFinancePeriodClosePermission,
  type FinancePeriodCloseAuthorizationContext
} from './periodCloseAuthorizationContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createContext(overrides: Partial<FinancePeriodCloseAuthorizationContext> = {}): FinancePeriodCloseAuthorizationContext {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    permissionScopes: ['finance.accountingPeriod.read', 'finance.accountingPeriod.close'],
    requestId: 'req-auth-001',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'declares permission scopes used by period-close and guarded source routes',
    run: () => {
      assertEqual(
        financePeriodClosePermissionScopes.includes('finance.accountingPeriod.read'),
        true,
        'permission catalog should include period read'
      );
      assertEqual(
        financePeriodClosePermissionScopes.includes('finance.accountingPeriod.close'),
        true,
        'permission catalog should include period close'
      );
      assertEqual(
        financePeriodClosePermissionScopes.includes('finance.accountingPeriod.reopen'),
        true,
        'permission catalog should include elevated period reopen'
      );
      assertEqual(
        financePeriodClosePermissionScopes.includes('finance.accountingVoucher.reverse'),
        true,
        'permission catalog should include voucher reversal'
      );
      assertEqual(
        financePeriodClosePermissionScopes.includes('finance.generalLedger.read'),
        true,
        'permission catalog should include general-ledger read'
      );
      assertEqual(
        financePeriodClosePermissionScopes.includes('finance.financialStatement.read'),
        true,
        'permission catalog should include financial statement read'
      );
      assertEqual(
        financePeriodClosePermissionScopes.includes('finance.financialStatement.generate'),
        true,
        'permission catalog should include financial statement snapshot generation'
      );
    }
  },
  {
    name: 'allows operation when actor has required permission scope',
    run: () => {
      const context = createContext();
      const result = authorizeFinancePeriodCloseOperation({
        context,
        operation: '确认期间结账',
        period: '2026-06',
        requiredPermissionScope: 'finance.accountingPeriod.close'
      });

      assertEqual(
        hasFinancePeriodClosePermission({ context, requiredPermissionScope: 'finance.accountingPeriod.close' }),
        true,
        'hasPermission should report available scope'
      );
      assertEqual(result.allowed, true, 'authorization should allow available scope');
    }
  },
  {
    name: 'rejects operation with stable forbidden response when permission is missing',
    run: () => {
      const result = authorizeFinancePeriodCloseOperation({
        context: createContext({ permissionScopes: ['finance.accountingPeriod.read'] }),
        operation: '执行反结账',
        period: '2026-06',
        requiredPermissionScope: 'finance.accountingPeriod.reopen'
      });

      assertEqual(result.allowed, false, 'authorization should reject missing elevated permission');

      if (!result.allowed) {
        assertEqual(result.error.code, 'FORBIDDEN', 'missing permission should use forbidden code');
        assertEqual(result.error.period, '2026-06', 'forbidden response should keep accounting period context');
        assertEqual(
          result.error.message.includes('finance.accountingPeriod.reopen'),
          true,
          'forbidden response should expose missing scope for audit'
        );
      }
    }
  }
];

for (const test of tests) {
  test.run();
}
