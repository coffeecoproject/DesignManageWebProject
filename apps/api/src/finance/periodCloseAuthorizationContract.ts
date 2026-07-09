import type { ActorSnapshot, ApiErrorResponse } from './periodCloseContract.js';

export const financePeriodClosePermissionScopes = [
  'finance.accountingPeriod.read',
  'finance.accountingPeriod.close',
  'finance.accountingPeriod.reopen',
  'finance.receivablePayable.write',
  'finance.invoiceLedger.write',
  'finance.invoiceMatching.write',
  'finance.cashFlow.review',
  'finance.bankReconciliation.reconcile',
  'finance.accountingVoucher.prepare',
  'finance.accountingVoucher.book',
  'finance.accountingVoucher.reverse',
  'finance.generalLedger.read',
  'finance.financialStatement.read',
  'finance.financialStatement.generate',
  'finance.taxHandling.write',
  'finance.socialInsurance.write',
  'finance.payroll.write',
  'finance.ledgerInitialization.write'
] as const;

export type FinancePeriodClosePermissionScope = (typeof financePeriodClosePermissionScopes)[number];

export type FinancePeriodCloseAuthorizationContext = {
  actorSnapshot: ActorSnapshot;
  permissionScopes: FinancePeriodClosePermissionScope[];
  requestId: string;
};

export type FinancePeriodCloseAuthorizationResult =
  | {
      allowed: true;
      actorSnapshot: ActorSnapshot;
      requiredPermissionScope: FinancePeriodClosePermissionScope;
    }
  | {
      allowed: false;
      error: ApiErrorResponse & {
        code: 'FORBIDDEN';
      };
      requiredPermissionScope: FinancePeriodClosePermissionScope;
    };

export function hasFinancePeriodClosePermission({
  context,
  requiredPermissionScope
}: {
  context: FinancePeriodCloseAuthorizationContext;
  requiredPermissionScope: FinancePeriodClosePermissionScope;
}) {
  return context.permissionScopes.includes(requiredPermissionScope);
}

export function authorizeFinancePeriodCloseOperation({
  context,
  operation,
  period,
  requiredPermissionScope,
  sourceId,
  sourceModule
}: {
  context: FinancePeriodCloseAuthorizationContext;
  operation: string;
  period?: string;
  requiredPermissionScope: FinancePeriodClosePermissionScope;
  sourceId?: string;
  sourceModule?: string;
}): FinancePeriodCloseAuthorizationResult {
  if (hasFinancePeriodClosePermission({ context, requiredPermissionScope })) {
    return {
      actorSnapshot: context.actorSnapshot,
      allowed: true,
      requiredPermissionScope
    };
  }

  return {
    allowed: false,
    error: {
      code: 'FORBIDDEN',
      message: `缺少 ${requiredPermissionScope} 权限，不能${operation}。`,
      period,
      requestId: context.requestId,
      sourceId,
      sourceModule
    },
    requiredPermissionScope
  };
}
