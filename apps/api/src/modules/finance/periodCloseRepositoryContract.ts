import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import {
  applyFinanceSourceMutationInPersistenceTransaction,
  clonePeriodClosePersistentState,
  closeAccountingPeriodInPersistenceTransaction,
  type PeriodClosePersistenceContext,
  type PeriodClosePersistentState,
  type PersistentCloseAccountingPeriodResult,
  type PersistentSourceMutationRequest,
  type PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

export type PeriodCloseRepositoryTransactionResult =
  | PersistentCloseAccountingPeriodResult
  | PersistentSourceMutationResult;

export type PeriodCloseRepositoryTransaction<T extends PeriodCloseRepositoryTransactionResult> = (
  state: PeriodClosePersistentState
) => T;

export type PeriodCloseRepository = {
  readState: () => PeriodClosePersistentState;
  runInTransaction: <T extends PeriodCloseRepositoryTransactionResult>(
    transaction: PeriodCloseRepositoryTransaction<T>
  ) => T;
};

export function createInMemoryPeriodCloseRepository(initialState: PeriodClosePersistentState): PeriodCloseRepository {
  let committedState = clonePeriodClosePersistentState(initialState);

  return {
    readState: () => clonePeriodClosePersistentState(committedState),
    runInTransaction: <T extends PeriodCloseRepositoryTransactionResult>(
      transaction: PeriodCloseRepositoryTransaction<T>
    ): T => {
      const transactionState = clonePeriodClosePersistentState(committedState);
      const result = transaction(transactionState);
      committedState = clonePeriodClosePersistentState(result.state);

      return {
        ...result,
        state: clonePeriodClosePersistentState(committedState)
      };
    }
  };
}

export function closeAccountingPeriodWithRepositoryTransaction({
  period,
  repository,
  request
}: {
  period: string;
  repository: PeriodCloseRepository;
  request: CloseAccountingPeriodRequest;
}): PersistentCloseAccountingPeriodResult {
  return repository.runInTransaction((state) =>
    closeAccountingPeriodInPersistenceTransaction({
      period,
      request,
      state
    })
  );
}

export function applyFinanceSourceMutationWithRepositoryTransaction({
  context,
  mutation,
  repository
}: {
  context: PeriodClosePersistenceContext;
  mutation: PersistentSourceMutationRequest;
  repository: PeriodCloseRepository;
}): PersistentSourceMutationResult {
  return repository.runInTransaction((state) =>
    applyFinanceSourceMutationInPersistenceTransaction({
      context,
      mutation,
      state
    })
  );
}
