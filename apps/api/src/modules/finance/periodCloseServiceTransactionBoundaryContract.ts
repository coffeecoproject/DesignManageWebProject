import {
  validatePeriodCloseDbClientRepositoryTrace,
  type PeriodCloseDbClientEvent,
  type PeriodCloseDbClientRepositoryContract,
  type PeriodCloseDbClientRepositoryResult,
  type PeriodCloseDbClientOperation
} from './periodCloseDbClientRepositoryContract.js';
import {
  createPeriodCloseDbRuntimeAdapterContract,
  type PeriodCloseDbRuntimeAdapterContract,
  type PeriodCloseDbRuntimeAdapterResult
} from './periodCloseDbRuntimeAdapterContract.js';
import type { PeriodCloseSqlDriverExecution } from './periodCloseSqlDriverRepositoryContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import type { PeriodCloseTransactionPolicyOperation } from './periodCloseTransactionIsolationPolicyContract.js';

export type PeriodCloseServiceTransactionStatus =
  | 'committed'
  | 'rolled_back'
  | 'driver_failed'
  | 'trace_invalid';

export type PeriodCloseServiceTransactionEventName =
  | 'receive_request'
  | 'allocate_transaction'
  | 'delegate_to_db_client'
  | 'validate_db_client_trace'
  | 'validate_db_runtime_trace'
  | 'return_response';

export type PeriodCloseServiceTransactionEvent = {
  event: PeriodCloseServiceTransactionEventName;
  operation: PeriodCloseDbClientOperation;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodCloseServiceTransactionError = {
  code: 'DB_TRANSACTION_FAILED' | 'DB_TRANSACTION_TRACE_INVALID';
  message: string;
  requestId: string;
  retryable: boolean;
  transactionId: string;
};

export type PeriodCloseServiceTransactionBoundaryResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  clientEvents: PeriodCloseDbClientEvent[];
  driverExecutions: PeriodCloseSqlDriverExecution[];
  error?: PeriodCloseServiceTransactionError;
  operation: PeriodCloseDbClientOperation;
  repositoryResult: PeriodCloseDbClientRepositoryResult<T>['repositoryResult'];
  requestId: string;
  runtimeResult: PeriodCloseDbRuntimeAdapterResult;
  serviceEvents: PeriodCloseServiceTransactionEvent[];
  status: PeriodCloseServiceTransactionStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodCloseServiceTransactionBoundaryContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => PeriodCloseServiceTransactionBoundaryResult<PersistentCloseAccountingPeriodResult>;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => PeriodCloseServiceTransactionBoundaryResult<PersistentSourceMutationResult>;
  readServiceEvents: () => PeriodCloseServiceTransactionEvent[];
};

function buildTransactionId({
  operation,
  requestId
}: {
  operation: PeriodCloseDbClientOperation;
  requestId: string;
}) {
  return `${requestId}:${operation}`;
}

function toRuntimeOperation(operation: PeriodCloseDbClientOperation): PeriodCloseTransactionPolicyOperation {
  return operation === 'close_accounting_period'
    ? 'close_or_reopen_accounting_period'
    : 'closed_period_source_mutation_guard';
}

function resolveStatus<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
  repositoryResult,
  traceErrors
}: {
  repositoryResult: PeriodCloseDbClientRepositoryResult<T>['repositoryResult'];
  traceErrors: string[];
}): PeriodCloseServiceTransactionStatus {
  if (traceErrors.length > 0) {
    return 'trace_invalid';
  }

  if (!repositoryResult.driverOk) {
    return 'driver_failed';
  }

  return repositoryResult.result.ok ? 'committed' : 'rolled_back';
}

function toRuntimeOutcome(status: Exclude<PeriodCloseServiceTransactionStatus, 'trace_invalid'>) {
  return status === 'committed' ? 'committed' : status === 'driver_failed' ? 'driver_failed' : 'rolled_back';
}

function validateServiceRuntimeAlignment({
  requestId,
  serviceStatus,
  runtimeResult
}: {
  requestId: string;
  runtimeResult: PeriodCloseDbRuntimeAdapterResult;
  serviceStatus: PeriodCloseServiceTransactionStatus;
}) {
  const errors: string[] = [];

  if (serviceStatus === 'trace_invalid') {
    return errors;
  }

  if (runtimeResult.status !== serviceStatus) {
    errors.push(
      `${requestId} service transaction status ${serviceStatus} must match DB runtime adapter status ${runtimeResult.status}`
    );
  }

  return errors;
}

function buildServiceError<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
  requestId,
  repositoryResult,
  status,
  traceErrors,
  transactionId
}: {
  requestId: string;
  repositoryResult: PeriodCloseDbClientRepositoryResult<T>['repositoryResult'];
  status: PeriodCloseServiceTransactionStatus;
  traceErrors: string[];
  transactionId: string;
}): PeriodCloseServiceTransactionError | undefined {
  if (status === 'trace_invalid') {
    return {
      code: 'DB_TRANSACTION_TRACE_INVALID',
      message: traceErrors.join('; '),
      requestId,
      retryable: false,
      transactionId
    };
  }

  if (status === 'driver_failed' && !repositoryResult.driverOk) {
    return {
      code: 'DB_TRANSACTION_FAILED',
      message: repositoryResult.error.message,
      requestId,
      retryable: true,
      transactionId
    };
  }

  return undefined;
}

export function createPeriodCloseServiceTransactionBoundaryContract({
  clientRepository,
  resolveSourceMutationPeriod = ({ mutation }) => mutation.targetAccountingPeriod,
  runtimeAdapter = createPeriodCloseDbRuntimeAdapterContract()
}: {
  clientRepository: PeriodCloseDbClientRepositoryContract;
  resolveSourceMutationPeriod?: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => string | undefined;
  runtimeAdapter?: PeriodCloseDbRuntimeAdapterContract;
}): PeriodCloseServiceTransactionBoundaryContract {
  const serviceEvents: PeriodCloseServiceTransactionEvent[] = [];

  function record({
    event,
    operation,
    requestId,
    transactionId
  }: Omit<PeriodCloseServiceTransactionEvent, 'sequence'>) {
    serviceEvents.push({
      event,
      operation,
      requestId,
      sequence: serviceEvents.length + 1,
      transactionId
    });
  }

  function readEvents(transactionId: string) {
    return serviceEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  function run<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
    operation,
    period,
    requestId,
    runClientTransaction,
    transactionId
  }: {
    operation: PeriodCloseDbClientOperation;
    period?: string;
    requestId: string;
    runClientTransaction: (transactionId: string) => PeriodCloseDbClientRepositoryResult<T>;
    transactionId: string;
  }): PeriodCloseServiceTransactionBoundaryResult<T> {
    record({ event: 'receive_request', operation, requestId, transactionId });
    record({ event: 'allocate_transaction', operation, requestId, transactionId });
    record({ event: 'delegate_to_db_client', operation, requestId, transactionId });

    const clientResult = runClientTransaction(transactionId);
    const clientTraceErrors = validatePeriodCloseDbClientRepositoryTrace({
      clientEvents: clientResult.clientEvents,
      driverExecutions: clientResult.driverExecutions
    });
    const preliminaryStatus = resolveStatus({
      repositoryResult: clientResult.repositoryResult,
      traceErrors: clientTraceErrors
    });
    const runtimeResult = runtimeAdapter.run({
      ...(preliminaryStatus === 'driver_failed' ? { failureCode: 'unknown' } : {}),
      operation: toRuntimeOperation(operation),
      outcome: toRuntimeOutcome(preliminaryStatus === 'trace_invalid' ? 'rolled_back' : preliminaryStatus),
      period: period ?? 'UNRESOLVED_ACCOUNTING_PERIOD',
      requestId
    });
    const runtimeResolutionErrors = period
      ? []
      : [`${requestId} source mutation runtime accounting period must be resolved before DB runtime validation`];
    const traceErrors = [
      ...clientTraceErrors,
      ...runtimeResult.traceErrors,
      ...runtimeResolutionErrors,
      ...validateServiceRuntimeAlignment({
        requestId,
        runtimeResult,
        serviceStatus: preliminaryStatus
      })
    ];
    const status = resolveStatus({
      repositoryResult: clientResult.repositoryResult,
      traceErrors
    });
    const error = buildServiceError({
      requestId,
      repositoryResult: clientResult.repositoryResult,
      status,
      traceErrors,
      transactionId
    });

    record({ event: 'validate_db_client_trace', operation, requestId, transactionId });
    record({ event: 'validate_db_runtime_trace', operation, requestId, transactionId });
    record({ event: 'return_response', operation, requestId, transactionId });

    return {
      clientEvents: clientResult.clientEvents,
      driverExecutions: clientResult.driverExecutions,
      ...(error ? { error } : {}),
      operation,
      repositoryResult: clientResult.repositoryResult,
      requestId,
      runtimeResult,
      serviceEvents: readEvents(transactionId),
      status,
      traceErrors,
      transactionId
    };
  }

  return {
    closeAccountingPeriod: ({ period, request }) => {
      const operation: PeriodCloseDbClientOperation = 'close_accounting_period';
      const transactionId = buildTransactionId({
        operation,
        requestId: request.requestId
      });

      return run({
        operation,
        period,
        requestId: request.requestId,
        runClientTransaction: (nextTransactionId) =>
          clientRepository.closeAccountingPeriod({
            period,
            request,
            transactionId: nextTransactionId
          }),
        transactionId
      });
    },
    guardSourceMutation: ({ context, mutation }) => {
      const operation: PeriodCloseDbClientOperation = 'guard_source_mutation';
      const transactionId = buildTransactionId({
        operation,
        requestId: context.requestId
      });
      const period = resolveSourceMutationPeriod({ context, mutation });

      return run({
        operation,
        period,
        requestId: context.requestId,
        runClientTransaction: (nextTransactionId) =>
          clientRepository.guardSourceMutation({
            context,
            mutation,
            transactionId: nextTransactionId
          }),
        transactionId
      });
    },
    readServiceEvents: () => serviceEvents.map((event) => ({ ...event }))
  };
}

export function validatePeriodCloseServiceTransactionEvents(
  events: readonly PeriodCloseServiceTransactionEvent[]
): string[] {
  const errors: string[] = [];
  const transactionIds = [...new Set(events.map((event) => event.transactionId))];
  const expectedOrder: PeriodCloseServiceTransactionEventName[] = [
    'receive_request',
    'allocate_transaction',
    'delegate_to_db_client',
    'validate_db_client_trace',
    'validate_db_runtime_trace',
    'return_response'
  ];

  for (const transactionId of transactionIds) {
    const transactionEvents = events
      .filter((event) => event.transactionId === transactionId)
      .sort((left, right) => left.sequence - right.sequence);
    const actualOrder = transactionEvents.map((event) => event.event);

    if (actualOrder.join('|') !== expectedOrder.join('|')) {
      errors.push(`${transactionId} service transaction events must follow request-to-response order`);
    }

    if (transactionEvents.some((event) => event.operation !== transactionEvents[0]?.operation)) {
      errors.push(`${transactionId} must not mix service operations`);
    }
  }

  return errors;
}
