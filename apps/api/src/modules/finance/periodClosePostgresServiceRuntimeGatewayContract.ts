import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type { PeriodCloseDbClientOperation } from './periodCloseDbClientRepositoryContract.js';
import {
  createPeriodClosePostgresRuntimeAdmissionOrchestratorContract,
  validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace,
  type PeriodClosePostgresRuntimeAdmissionOrchestratorResult,
  type PeriodClosePostgresRuntimeAdmissionOrchestratorRunInput
} from './periodClosePostgresRuntimeAdmissionOrchestratorContract.js';
import type { PeriodClosePostgresRuntimeModuleLoader } from './periodClosePostgresRuntimeImportContract.js';
import type { PeriodClosePostgresSecretResolverContract } from './periodClosePostgresSecretResolverContract.js';
import type { PeriodCloseSqlDriverStatement } from './periodCloseSqlDriverRepositoryContract.js';
import {
  type PeriodCloseServiceAtomicCommitBoundaryContract,
  type PeriodCloseServiceAtomicCommitBoundaryResult,
  type PeriodCloseServiceAtomicCommitStatus
} from './periodCloseServiceAtomicCommitBoundaryContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

export type PeriodClosePostgresServiceRuntimeGatewayStatus =
  | 'runtime_blocked'
  | PeriodCloseServiceAtomicCommitStatus;

export type PeriodClosePostgresServiceRuntimeGatewayEventName =
  | 'receive_request'
  | 'run_runtime_admission'
  | 'validate_runtime_admission_trace'
  | 'delegate_service_atomic_boundary'
  | 'validate_service_atomic_trace'
  | 'return_response';

export type PeriodClosePostgresServiceRuntimeGatewayEvent = {
  event: PeriodClosePostgresServiceRuntimeGatewayEventName;
  operation: PeriodCloseDbClientOperation;
  period?: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresServiceRuntimeGatewayAdmissionInput = Omit<
  PeriodClosePostgresRuntimeAdmissionOrchestratorRunInput,
  'operation' | 'period' | 'requestId' | 'statements' | 'transactionId'
> & {
  runtimeProofStatements: PeriodCloseSqlDriverStatement[];
};

export type PeriodClosePostgresServiceRuntimeGatewayResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  gatewayEvents: PeriodClosePostgresServiceRuntimeGatewayEvent[];
  operation: PeriodCloseDbClientOperation;
  period?: string;
  requestId: string;
  runtimeAdmissionResult: PeriodClosePostgresRuntimeAdmissionOrchestratorResult;
  serviceResult?: PeriodCloseServiceAtomicCommitBoundaryResult<T>;
  status: PeriodClosePostgresServiceRuntimeGatewayStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresServiceRuntimeGatewayContract = {
  closeAccountingPeriod: (input: {
    admission: PeriodClosePostgresServiceRuntimeGatewayAdmissionInput;
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => Promise<PeriodClosePostgresServiceRuntimeGatewayResult<PersistentCloseAccountingPeriodResult>>;
  guardSourceMutation: (input: {
    admission: PeriodClosePostgresServiceRuntimeGatewayAdmissionInput;
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => Promise<PeriodClosePostgresServiceRuntimeGatewayResult<PersistentSourceMutationResult>>;
  readGatewayEvents: () => PeriodClosePostgresServiceRuntimeGatewayEvent[];
};

function buildTransactionId({
  operation,
  requestId
}: {
  operation: PeriodCloseDbClientOperation;
  requestId: string;
}) {
  return `${requestId}:${operation}:postgres-service-runtime-gateway`;
}

function isRuntimeReadyForService(result: PeriodClosePostgresRuntimeAdmissionOrchestratorResult) {
  return result.status === 'committed' && result.traceErrors.length === 0;
}

function eventNames(events: readonly PeriodClosePostgresServiceRuntimeGatewayEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

export function validatePeriodClosePostgresServiceRuntimeGatewayTrace<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
>(result: PeriodClosePostgresServiceRuntimeGatewayResult<T>): string[] {
  const errors = [...result.traceErrors];
  const events = result.gatewayEvents.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_request');
  const runtimeIndex = names.indexOf('run_runtime_admission');
  const runtimeValidateIndex = names.indexOf('validate_runtime_admission_trace');
  const serviceIndex = names.indexOf('delegate_service_atomic_boundary');
  const serviceValidateIndex = names.indexOf('validate_service_atomic_trace');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres service runtime gateway must receive request first`);
  }

  if (runtimeIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres service runtime gateway must run runtime admission after receiving request`);
  }

  if (runtimeValidateIndex <= runtimeIndex) {
    errors.push(`${result.transactionId} postgres service runtime gateway must validate runtime admission before service delegation`);
  }

  if (!isRuntimeReadyForService(result.runtimeAdmissionResult)) {
    if (serviceIndex !== -1 || serviceValidateIndex !== -1 || result.serviceResult) {
      errors.push(`${result.transactionId} blocked postgres runtime must not enter the service atomic boundary`);
    }
  } else {
    if (serviceIndex <= runtimeValidateIndex) {
      errors.push(`${result.transactionId} postgres service runtime gateway must delegate service work after runtime admission`);
    }

    if (serviceValidateIndex <= serviceIndex) {
      errors.push(`${result.transactionId} postgres service runtime gateway must validate service trace after delegation`);
    }

    if (!result.serviceResult) {
      errors.push(`${result.transactionId} ready postgres runtime must retain service atomic boundary result`);
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} postgres service runtime gateway must return response last`);
  }

  if (events.some((event) => event.operation !== result.operation)) {
    errors.push(`${result.transactionId} postgres service runtime gateway events must keep one operation`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres service runtime gateway events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} postgres service runtime gateway events must keep one transaction id`);
  }

  errors.push(...validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace(result.runtimeAdmissionResult));

  if (result.serviceResult) {
    errors.push(...result.serviceResult.traceErrors);

    if (result.status !== result.serviceResult.status) {
      errors.push(`${result.transactionId} postgres service runtime gateway status must mirror service atomic boundary status`);
    }
  } else if (result.status !== 'runtime_blocked') {
    errors.push(`${result.transactionId} postgres service runtime gateway without service result must be runtime_blocked`);
  }

  return errors;
}

export function createPeriodClosePostgresServiceRuntimeGatewayContract({
  loadPgModule,
  secretResolver,
  serviceBoundary
}: {
  loadPgModule?: PeriodClosePostgresRuntimeModuleLoader;
  secretResolver?: PeriodClosePostgresSecretResolverContract;
  serviceBoundary: PeriodCloseServiceAtomicCommitBoundaryContract;
}): PeriodClosePostgresServiceRuntimeGatewayContract {
  const gatewayEvents: PeriodClosePostgresServiceRuntimeGatewayEvent[] = [];
  const runtimeAdmission = createPeriodClosePostgresRuntimeAdmissionOrchestratorContract({
    loadPgModule,
    secretResolver
  });

  function record({
    event,
    operation,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresServiceRuntimeGatewayEvent, 'sequence'>) {
    gatewayEvents.push({
      event,
      operation,
      ...(period ? { period } : {}),
      requestId,
      sequence: gatewayEvents.length + 1,
      transactionId
    });
  }

  function readEvents(transactionId: string) {
    return gatewayEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  async function run<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
    admission,
    operation,
    period,
    requestId,
    runService,
    transactionId
  }: {
    admission: PeriodClosePostgresServiceRuntimeGatewayAdmissionInput;
    operation: PeriodCloseDbClientOperation;
    period?: string;
    requestId: string;
    runService: () => Promise<PeriodCloseServiceAtomicCommitBoundaryResult<T>>;
    transactionId: string;
  }): Promise<PeriodClosePostgresServiceRuntimeGatewayResult<T>> {
    record({ event: 'receive_request', operation, period, requestId, transactionId });
    record({ event: 'run_runtime_admission', operation, period, requestId, transactionId });

    const runtimeAdmissionResult = await runtimeAdmission.run({
      ...admission,
      operation:
        operation === 'close_accounting_period'
          ? 'close_or_reopen_accounting_period'
          : 'closed_period_source_mutation_guard',
      period: period ?? admission.runtimeProofStatements.find((statement) => statement.period)?.period ?? 'unresolved',
      requestId,
      statements: admission.runtimeProofStatements,
      transactionId
    });

    record({ event: 'validate_runtime_admission_trace', operation, period, requestId, transactionId });

    let serviceResult: PeriodCloseServiceAtomicCommitBoundaryResult<T> | undefined;

    if (isRuntimeReadyForService(runtimeAdmissionResult)) {
      record({ event: 'delegate_service_atomic_boundary', operation, period, requestId, transactionId });
      serviceResult = await runService();
      record({
        event: 'validate_service_atomic_trace',
        operation,
        period: serviceResult.period ?? period,
        requestId,
        transactionId
      });
    }

    record({
      event: 'return_response',
      operation,
      period: serviceResult?.period ?? period,
      requestId,
      transactionId
    });

    const result: PeriodClosePostgresServiceRuntimeGatewayResult<T> = {
      gatewayEvents: readEvents(transactionId),
      operation,
      ...(serviceResult?.period ?? period ? { period: serviceResult?.period ?? period } : {}),
      requestId,
      runtimeAdmissionResult,
      ...(serviceResult ? { serviceResult } : {}),
      status: serviceResult?.status ?? 'runtime_blocked',
      traceErrors: [],
      transactionId
    };
    const traceErrors = validatePeriodClosePostgresServiceRuntimeGatewayTrace(result);

    return {
      ...result,
      status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
      traceErrors
    };
  }

  return {
    closeAccountingPeriod: ({ admission, period, request }) => {
      const operation: PeriodCloseDbClientOperation = 'close_accounting_period';
      const transactionId = buildTransactionId({
        operation,
        requestId: request.requestId
      });

      return run({
        admission,
        operation,
        period,
        requestId: request.requestId,
        runService: () => serviceBoundary.closeAccountingPeriod({ period, request }),
        transactionId
      });
    },
    guardSourceMutation: ({ admission, context, mutation }) => {
      const operation: PeriodCloseDbClientOperation = 'guard_source_mutation';
      const transactionId = buildTransactionId({
        operation,
        requestId: context.requestId
      });

      return run({
        admission,
        operation,
        period: mutation.targetAccountingPeriod,
        requestId: context.requestId,
        runService: () => serviceBoundary.guardSourceMutation({ context, mutation }),
        transactionId
      });
    },
    readGatewayEvents: () => gatewayEvents.map((event) => ({ ...event }))
  };
}
