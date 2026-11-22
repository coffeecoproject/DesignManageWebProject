import type { PeriodClosePersistenceContext } from './periodClosePersistenceContract.js';
import {
  applyFinanceSourceMutationWithRepositoryTransaction,
  type PeriodCloseRepository
} from './periodCloseRepositoryContract.js';
import type { FinanceSourceMutationArea } from './periodCloseSourceMutationGuard.js';
import type {
  FinanceSourceMutationClosedPeriodPath,
  FinanceSourceMutationPeriodCheckMode
} from './periodCloseSourceMutationOperationMetadata.js';

export type FinanceSourceMutationRepositoryApiOperation = {
  createsSourceRecord?: boolean;
  closedPeriodPath?: FinanceSourceMutationClosedPeriodPath;
  operation: string;
  periodCheckMode?: FinanceSourceMutationPeriodCheckMode;
  sourceArea: FinanceSourceMutationArea;
  successStatus: string;
};

export type FinanceSourceMutationRepositoryApiRequest = {
  amount?: string;
  expectedVersion?: number;
  sourceId: string;
  sourceNo?: string;
  status?: string;
  targetAccountingPeriod?: string;
};

export function applyFinanceSourceMutationRepositoryApi({
  context,
  operation,
  repository,
  request
}: {
  context: PeriodClosePersistenceContext;
  operation: FinanceSourceMutationRepositoryApiOperation;
  repository: PeriodCloseRepository;
  request: FinanceSourceMutationRepositoryApiRequest;
}) {
  return applyFinanceSourceMutationWithRepositoryTransaction({
    context,
    mutation: {
      amount: request.amount,
      createsSourceRecord: operation.createsSourceRecord,
      expectedVersion: request.expectedVersion,
      operation: operation.operation,
      sourceArea: operation.sourceArea,
      sourceId: request.sourceId,
      sourceNo: request.sourceNo,
      status: request.status ?? operation.successStatus,
      targetAccountingPeriod: request.targetAccountingPeriod
    },
    repository
  });
}

export function buildFinanceSourceMutationRepositoryApiEvidence(
  operation: FinanceSourceMutationRepositoryApiOperation
) {
  return {
    closedPeriodPath: operation.closedPeriodPath,
    createsSourceRecord: Boolean(operation.createsSourceRecord),
    operation: operation.operation,
    periodCheckMode: operation.periodCheckMode,
    sourceArea: operation.sourceArea,
    usesUnifiedPersistenceMutation: true
  };
}
