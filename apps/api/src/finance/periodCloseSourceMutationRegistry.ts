import { financeSourceMutationRouteDefinitions } from './periodCloseSourceMutationRoutes.js';
import type { FinanceSourceMutationArea } from './periodCloseSourceMutationGuard.js';
import {
  findFinanceSourceMutationOperationMetadata,
  type FinanceSourceMutationClosedPeriodPath,
  type FinanceSourceMutationOperationMetadata,
  type FinanceSourceMutationPeriodCheckMode
} from './periodCloseSourceMutationOperationMetadata.js';

export type {
  FinanceSourceMutationClosedPeriodPath,
  FinanceSourceMutationOperationMetadata,
  FinanceSourceMutationPeriodCheckMode
};

export type FinanceSourceMutationOperationRegistryEntry = FinanceSourceMutationOperationMetadata & {
  createsSourceRecord: boolean;
  localApiMethod: 'PATCH' | 'POST';
  operationId: string;
  permissionScope: string;
  sourceArea: FinanceSourceMutationArea;
  sourceIdFromBody: boolean;
  successStatus: string;
};

export type FinanceDedicatedClosedPeriodCorrectionEntry = {
  accountingPeriodSource: string;
  closedPeriodBehavior: string;
  localApiMethod: 'POST';
  localApiRoute: string;
  operation: string;
  operationId: string;
  requiredOriginalPeriodState: '已结账';
  requiredTargetPeriodState: '开放';
  sourceArea: FinanceSourceMutationArea;
};

export const financeDedicatedClosedPeriodCorrectionRegistry = [
  {
    accountingPeriodSource: '原已记账凭证归属月份和后续调整目标月份',
    closedPeriodBehavior: '原闭期凭证保持不变，只在开放目标期间生成待制单调整事实。',
    localApiMethod: 'POST',
    localApiRoute: '/api/finance/accounting-vouchers/{id}/later-period-adjustments',
    operation: '生成后续期间调整',
    operationId: 'accounting-voucher-later-period-adjustment',
    requiredOriginalPeriodState: '已结账',
    requiredTargetPeriodState: '开放',
    sourceArea: 'accounting_voucher'
  }
] as const satisfies readonly FinanceDedicatedClosedPeriodCorrectionEntry[];

function toOperationId(operation: string) {
  return operation
    .normalize('NFKD')
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

export const financeSourceMutationOperationRegistry: readonly FinanceSourceMutationOperationRegistryEntry[] =
  financeSourceMutationRouteDefinitions.map((definition) => {
    const metadata = findFinanceSourceMutationOperationMetadata(definition.operation);

    if (!metadata) {
      throw new Error(`Missing source mutation operation metadata: ${definition.operation}`);
    }

    return {
      ...metadata,
      createsSourceRecord: Boolean(definition.createsSourceRecord),
      localApiMethod: definition.method,
      operationId: toOperationId(definition.operation),
      permissionScope: definition.permissionScope,
      sourceArea: definition.sourceArea,
      sourceIdFromBody: Boolean(definition.sourceIdFromBody),
      successStatus: definition.successStatus
    };
  });

export function findFinanceSourceMutationOperation(operation: string) {
  return financeSourceMutationOperationRegistry.find((entry) => entry.operation === operation);
}
