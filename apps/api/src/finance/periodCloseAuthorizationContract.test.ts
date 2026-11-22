import {
  authorizeFinancePeriodCloseOperation,
  financePeriodClosePermissionScopes,
  hasFinancePeriodClosePermission,
  type FinancePeriodCloseAuthorizationContext
} from './periodCloseAuthorizationContract.js';
import { it } from 'vitest';
import { assertEqual } from '../__tests__/assertions.js';

function createContext(overrides: Partial<FinancePeriodCloseAuthorizationContext> = {}): FinancePeriodCloseAuthorizationContext {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    permissionScopes: ['finance.accountingPeriod.read', 'finance.accountingPeriod.close'],
    requestId: 'req-auth-001',
    ...overrides
  };
}

it('declares permission scopes used by period-close and guarded source routes', () => {
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
});

it('allows operation when actor has required permission scope', () => {
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
});

it('rejects operation with stable forbidden response when permission is missing', () => {
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
});
