import {
  createPeriodCloseSqlDriverRepositoryAdapterContract,
  type PeriodCloseSqlDriverExecution,
  type PeriodCloseSqlDriverExecutor,
  type PeriodCloseSqlDriverRepositoryCallResult
} from './periodCloseSqlDriverRepositoryContract.js';
import type { PeriodCloseSqlRepository } from './periodCloseSqlRepositoryContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

export type PeriodCloseDbClientOperation = 'close_accounting_period' | 'guard_source_mutation';

export type PeriodCloseDbClientEventName =
  | 'checkout_connection'
  | 'begin_transaction'
  | 'delegate_repository_operation'
  | 'commit_transaction'
  | 'rollback_transaction'
  | 'release_connection';

export type PeriodCloseDbClientEvent = {
  event: PeriodCloseDbClientEventName;
  operation: PeriodCloseDbClientOperation;
  period?: string;
  sequence: number;
  transactionId: string;
};

export type PeriodCloseDbClientRepositoryResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  clientEvents: PeriodCloseDbClientEvent[];
  driverExecutions: PeriodCloseSqlDriverExecution[];
  repositoryResult: PeriodCloseSqlDriverRepositoryCallResult<T>;
};

export type PeriodCloseDbClientRepositoryContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
    transactionId: string;
  }) => PeriodCloseDbClientRepositoryResult<PersistentCloseAccountingPeriodResult>;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
    transactionId: string;
  }) => PeriodCloseDbClientRepositoryResult<PersistentSourceMutationResult>;
  readClientEvents: () => PeriodCloseDbClientEvent[];
};

function shouldCommitRepositoryResult<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>(
  result: PeriodCloseSqlDriverRepositoryCallResult<T>
) {
  return result.driverOk && result.result.ok;
}

function resolveMutationPeriod({
  mutation,
  repository
}: {
  mutation: PersistentSourceMutationRequest;
  repository: PeriodCloseSqlRepository;
}) {
  const sourceRecord = repository
    .readDatabaseSnapshot()
    .sourceRecords.find((record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea);

  return mutation.targetAccountingPeriod ?? sourceRecord?.accountingPeriod;
}

export function createPeriodCloseDbClientRepositoryContract({
  driver,
  repository
}: {
  driver: PeriodCloseSqlDriverExecutor;
  repository: PeriodCloseSqlRepository;
}): PeriodCloseDbClientRepositoryContract {
  const clientEvents: PeriodCloseDbClientEvent[] = [];
  const driverAdapter = createPeriodCloseSqlDriverRepositoryAdapterContract({ driver, repository });

  function record({
    event,
    operation,
    period,
    transactionId
  }: Omit<PeriodCloseDbClientEvent, 'sequence'>) {
    clientEvents.push({
      event,
      operation,
      ...(period ? { period } : {}),
      sequence: clientEvents.length + 1,
      transactionId
    });
  }

  function readEvents(transactionId: string) {
    return clientEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  function runClientTransaction<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
    operation,
    period,
    run,
    transactionId
  }: {
    operation: PeriodCloseDbClientOperation;
    period?: string;
    run: () => PeriodCloseSqlDriverRepositoryCallResult<T>;
    transactionId: string;
  }): PeriodCloseDbClientRepositoryResult<T> {
    record({ event: 'checkout_connection', operation, period, transactionId });
    record({ event: 'begin_transaction', operation, period, transactionId });
    record({ event: 'delegate_repository_operation', operation, period, transactionId });

    const repositoryResult = run();

    record({
      event: shouldCommitRepositoryResult(repositoryResult) ? 'commit_transaction' : 'rollback_transaction',
      operation,
      period,
      transactionId
    });
    record({ event: 'release_connection', operation, period, transactionId });

    return {
      clientEvents: readEvents(transactionId),
      driverExecutions: repositoryResult.executions,
      repositoryResult
    };
  }

  return {
    closeAccountingPeriod: ({ period, request, transactionId }) =>
      runClientTransaction({
        operation: 'close_accounting_period',
        period,
        run: () => driverAdapter.closeAccountingPeriod({ period, request, transactionId }),
        transactionId
      }),
    guardSourceMutation: ({ context, mutation, transactionId }) =>
      runClientTransaction({
        operation: 'guard_source_mutation',
        period: resolveMutationPeriod({ mutation, repository }),
        run: () => driverAdapter.guardSourceMutation({ context, mutation, transactionId }),
        transactionId
      }),
    readClientEvents: () => clientEvents.map((event) => ({ ...event }))
  };
}

export function validatePeriodCloseDbClientRepositoryTrace({
  clientEvents,
  driverExecutions
}: {
  clientEvents: readonly PeriodCloseDbClientEvent[];
  driverExecutions: readonly PeriodCloseSqlDriverExecution[];
}): string[] {
  const errors: string[] = [];
  const transactionIds = [...new Set(clientEvents.map((event) => event.transactionId))];

  for (const transactionId of transactionIds) {
    const events = clientEvents
      .filter((event) => event.transactionId === transactionId)
      .sort((left, right) => left.sequence - right.sequence);
    const eventNames = events.map((event) => event.event);
    const checkoutIndex = eventNames.indexOf('checkout_connection');
    const beginIndex = eventNames.indexOf('begin_transaction');
    const delegateIndex = eventNames.indexOf('delegate_repository_operation');
    const commitIndex = eventNames.indexOf('commit_transaction');
    const rollbackIndex = eventNames.indexOf('rollback_transaction');
    const releaseIndex = eventNames.indexOf('release_connection');
    const terminalIndex = Math.max(commitIndex, rollbackIndex);
    const executions = driverExecutions
      .filter((execution) => execution.transactionId === transactionId)
      .sort((left, right) => left.sequence - right.sequence);
    const driverTerminal = executions.at(-1)?.name;

    if (checkoutIndex !== 0) {
      errors.push(`${transactionId} must checkout a DB connection first`);
    }

    if (beginIndex <= checkoutIndex) {
      errors.push(`${transactionId} must begin a DB transaction after checkout`);
    }

    if (delegateIndex <= beginIndex) {
      errors.push(`${transactionId} must delegate repository work after the DB transaction begins`);
    }

    if ((commitIndex === -1 && rollbackIndex === -1) || (commitIndex !== -1 && rollbackIndex !== -1)) {
      errors.push(`${transactionId} must have exactly one client terminal event`);
    }

    if (terminalIndex <= delegateIndex) {
      errors.push(`${transactionId} must terminate after repository delegation`);
    }

    if (releaseIndex !== events.length - 1 || releaseIndex <= terminalIndex) {
      errors.push(`${transactionId} must release the DB connection after terminal event`);
    }

    if (commitIndex !== -1 && driverTerminal !== 'commit') {
      errors.push(`${transactionId} client commit must match driver COMMIT`);
    }

    if (rollbackIndex !== -1 && driverTerminal !== 'rollback') {
      errors.push(`${transactionId} client rollback must match driver ROLLBACK`);
    }

    if (events.some((event) => event.operation !== events[0]?.operation)) {
      errors.push(`${transactionId} must not mix operations in one DB client transaction`);
    }
  }

  return errors;
}
