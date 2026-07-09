import {
  validatePeriodClosePostgresAtomicCommitBridgeTrace,
  type PeriodClosePostgresAtomicCommitBridgeContract,
  type PeriodClosePostgresAtomicCommitBridgeResult,
  type PeriodClosePostgresAtomicCommitBridgeStatus
} from './periodClosePostgresAtomicCommitBridgeContract.js';
import type { PeriodCloseDbClientOperation } from './periodCloseDbClientRepositoryContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

export type PeriodCloseServiceAtomicCommitStatus = PeriodClosePostgresAtomicCommitBridgeStatus;

export type PeriodCloseServiceAtomicCommitEventName =
  | 'receive_request'
  | 'allocate_service_transaction'
  | 'delegate_to_atomic_commit_bridge'
  | 'validate_atomic_commit_trace'
  | 'return_response';

export type PeriodCloseServiceAtomicCommitEvent = {
  event: PeriodCloseServiceAtomicCommitEventName;
  operation: PeriodCloseDbClientOperation;
  period?: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodCloseServiceAtomicCommitError = {
  code: 'DB_ATOMIC_COMMIT_FAILED' | 'DB_ATOMIC_COMMIT_TRACE_INVALID';
  message: string;
  requestId: string;
  retryable: boolean;
  transactionId: string;
};

export type PeriodCloseServiceAtomicCommitBoundaryResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  atomicResult: PeriodClosePostgresAtomicCommitBridgeResult<T>;
  error?: PeriodCloseServiceAtomicCommitError;
  operation: PeriodCloseDbClientOperation;
  period?: string;
  requestId: string;
  serviceEvents: PeriodCloseServiceAtomicCommitEvent[];
  status: PeriodCloseServiceAtomicCommitStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodCloseServiceAtomicCommitBoundaryContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => Promise<PeriodCloseServiceAtomicCommitBoundaryResult<PersistentCloseAccountingPeriodResult>>;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => Promise<PeriodCloseServiceAtomicCommitBoundaryResult<PersistentSourceMutationResult>>;
  readServiceEvents: () => PeriodCloseServiceAtomicCommitEvent[];
};

function buildTransactionId({
  operation,
  requestId
}: {
  operation: PeriodCloseDbClientOperation;
  requestId: string;
}) {
  return `${requestId}:${operation}:service-atomic`;
}

function eventOrder(events: readonly PeriodCloseServiceAtomicCommitEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

export function validatePeriodCloseServiceAtomicCommitEvents(
  events: readonly PeriodCloseServiceAtomicCommitEvent[]
): string[] {
  const errors: string[] = [];
  const expectedOrder: PeriodCloseServiceAtomicCommitEventName[] = [
    'receive_request',
    'allocate_service_transaction',
    'delegate_to_atomic_commit_bridge',
    'validate_atomic_commit_trace',
    'return_response'
  ];
  const transactionIds = [...new Set(events.map((event) => event.transactionId))];

  for (const transactionId of transactionIds) {
    const transactionEvents = events
      .filter((event) => event.transactionId === transactionId)
      .sort((left, right) => left.sequence - right.sequence);
    const actualOrder = eventOrder(transactionEvents);

    if (actualOrder.join('|') !== expectedOrder.join('|')) {
      errors.push(`${transactionId} service atomic commit events must follow request-to-response order`);
    }

    if (transactionEvents.some((event) => event.operation !== transactionEvents[0]?.operation)) {
      errors.push(`${transactionId} service atomic commit events must not mix operations`);
    }

    if (transactionEvents.some((event) => event.requestId !== transactionEvents[0]?.requestId)) {
      errors.push(`${transactionId} service atomic commit events must not mix request ids`);
    }
  }

  return errors;
}

function buildServiceError<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
>({
  atomicResult,
  requestId,
  status,
  traceErrors,
  transactionId
}: {
  atomicResult: PeriodClosePostgresAtomicCommitBridgeResult<T>;
  requestId: string;
  status: PeriodCloseServiceAtomicCommitStatus;
  traceErrors: string[];
  transactionId: string;
}): PeriodCloseServiceAtomicCommitError | undefined {
  if (status === 'trace_invalid') {
    return {
      code: 'DB_ATOMIC_COMMIT_TRACE_INVALID',
      message: traceErrors.join('; '),
      requestId,
      retryable: atomicResult.postgresResult?.retryable ?? false,
      transactionId
    };
  }

  if (status === 'driver_failed') {
    return {
      code: 'DB_ATOMIC_COMMIT_FAILED',
      message: atomicResult.repositoryResult.driverOk
        ? '数据库事务执行失败。'
        : atomicResult.repositoryResult.error.message,
      requestId,
      retryable: true,
      transactionId
    };
  }

  return undefined;
}

export function createPeriodCloseServiceAtomicCommitBoundaryContract({
  atomicBridge
}: {
  atomicBridge: PeriodClosePostgresAtomicCommitBridgeContract;
}): PeriodCloseServiceAtomicCommitBoundaryContract {
  const serviceEvents: PeriodCloseServiceAtomicCommitEvent[] = [];

  function record({
    event,
    operation,
    period,
    requestId,
    transactionId
  }: Omit<PeriodCloseServiceAtomicCommitEvent, 'sequence'>) {
    serviceEvents.push({
      event,
      operation,
      ...(period ? { period } : {}),
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

  async function run<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
    operation,
    period,
    requestId,
    runAtomicBridge,
    transactionId
  }: {
    operation: PeriodCloseDbClientOperation;
    period?: string;
    requestId: string;
    runAtomicBridge: () => Promise<PeriodClosePostgresAtomicCommitBridgeResult<T>>;
    transactionId: string;
  }): Promise<PeriodCloseServiceAtomicCommitBoundaryResult<T>> {
    record({ event: 'receive_request', operation, period, requestId, transactionId });
    record({ event: 'allocate_service_transaction', operation, period, requestId, transactionId });
    record({ event: 'delegate_to_atomic_commit_bridge', operation, period, requestId, transactionId });

    const atomicResult = await runAtomicBridge();

    record({
      event: 'validate_atomic_commit_trace',
      operation,
      period: atomicResult.period ?? period,
      requestId,
      transactionId
    });
    record({
      event: 'return_response',
      operation,
      period: atomicResult.period ?? period,
      requestId,
      transactionId
    });

    const serviceTraceErrors = validatePeriodCloseServiceAtomicCommitEvents(readEvents(transactionId));
    const atomicTraceErrors = validatePeriodClosePostgresAtomicCommitBridgeTrace(atomicResult);
    const traceErrors = [...serviceTraceErrors, ...atomicResult.traceErrors, ...atomicTraceErrors];
    const status: PeriodCloseServiceAtomicCommitStatus =
      traceErrors.length > 0 ? 'trace_invalid' : atomicResult.status;
    const error = buildServiceError({
      atomicResult,
      requestId,
      status,
      traceErrors,
      transactionId
    });

    return {
      atomicResult,
      ...(error ? { error } : {}),
      operation,
      ...(atomicResult.period ?? period ? { period: atomicResult.period ?? period } : {}),
      requestId,
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
        runAtomicBridge: () => atomicBridge.closeAccountingPeriod({ period, request }),
        transactionId
      });
    },
    guardSourceMutation: ({ context, mutation }) => {
      const operation: PeriodCloseDbClientOperation = 'guard_source_mutation';
      const transactionId = buildTransactionId({
        operation,
        requestId: context.requestId
      });

      return run({
        operation,
        period: mutation.targetAccountingPeriod,
        requestId: context.requestId,
        runAtomicBridge: () => atomicBridge.guardSourceMutation({ context, mutation }),
        transactionId
      });
    },
    readServiceEvents: () => serviceEvents.map((event) => ({ ...event }))
  };
}
