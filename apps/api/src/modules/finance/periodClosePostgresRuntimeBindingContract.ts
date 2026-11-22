import {
  createPeriodCloseNativePostgresPoolAdapterContract,
  validatePeriodCloseNativePostgresPoolAdapterEvents,
  type PeriodCloseNativePostgresPoolAdapterEvent,
  type PeriodCloseNativePostgresPoolLike
} from './periodCloseNativePostgresPoolAdapterContract.js';
import {
  createPeriodClosePostgresClientPortContract,
  validatePeriodClosePostgresClientPortTrace,
  type PeriodClosePostgresClientPortRunInput,
  type PeriodClosePostgresClientPortStatus,
  type PeriodClosePostgresClientPortResult
} from './periodClosePostgresClientPortContract.js';

export type PeriodClosePostgresRuntimeBindingStatus = PeriodClosePostgresClientPortStatus;

export type PeriodClosePostgresRuntimeBindingEventName =
  | 'create_native_pool_adapter'
  | 'receive_request'
  | 'return_response'
  | 'run_postgres_client_port'
  | 'validate_runtime_binding_trace';

export type PeriodClosePostgresRuntimeBindingEvent = {
  event: PeriodClosePostgresRuntimeBindingEventName;
  period: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresRuntimeBindingResult = {
  adapterEvents: PeriodCloseNativePostgresPoolAdapterEvent[];
  bindingEvents: PeriodClosePostgresRuntimeBindingEvent[];
  period: string;
  postgresResult: PeriodClosePostgresClientPortResult;
  requestId: string;
  status: PeriodClosePostgresRuntimeBindingStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresRuntimeBindingContract = {
  readBindingEvents: () => PeriodClosePostgresRuntimeBindingEvent[];
  run: (input: PeriodClosePostgresClientPortRunInput) => Promise<PeriodClosePostgresRuntimeBindingResult>;
};

function eventNames(events: readonly PeriodClosePostgresRuntimeBindingEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

function hasPostgresClientAcquisitionAttempt(result: PeriodClosePostgresClientPortResult) {
  return result.events.some((event) => event.event === 'connect_pool');
}

function hasNativeShapeRejection(events: readonly PeriodCloseNativePostgresPoolAdapterEvent[]) {
  return events.some(
    (event) => event.event === 'reject_invalid_native_client' || event.event === 'reject_invalid_native_pool'
  );
}

export function validatePeriodClosePostgresRuntimeBindingTrace(
  result: PeriodClosePostgresRuntimeBindingResult
): string[] {
  const errors = [...validatePeriodClosePostgresClientPortTrace(result.postgresResult)];
  const bindingEvents = result.bindingEvents.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(bindingEvents);
  const receiveIndex = names.indexOf('receive_request');
  const createAdapterIndex = names.indexOf('create_native_pool_adapter');
  const runPortIndex = names.indexOf('run_postgres_client_port');
  const validateIndex = names.indexOf('validate_runtime_binding_trace');
  const returnIndex = names.indexOf('return_response');
  const nativeShapeRejected = hasNativeShapeRejection(result.adapterEvents);
  const postgresAttemptedClient = hasPostgresClientAcquisitionAttempt(result.postgresResult);

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres runtime binding must receive request first`);
  }

  if (createAdapterIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres runtime binding must create native adapter after request`);
  }

  if (runPortIndex <= createAdapterIndex) {
    errors.push(`${result.transactionId} postgres runtime binding must run client port after adapter creation`);
  }

  if (validateIndex <= runPortIndex) {
    errors.push(`${result.transactionId} postgres runtime binding must validate after client port run`);
  }

  if (returnIndex !== bindingEvents.length - 1) {
    errors.push(`${result.transactionId} postgres runtime binding must return response last`);
  }

  if (bindingEvents.some((event) => event.period !== result.period)) {
    errors.push(`${result.transactionId} postgres runtime binding events must keep one accounting period`);
  }

  if (bindingEvents.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres runtime binding events must keep one request id`);
  }

  if (bindingEvents.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} postgres runtime binding events must keep one transaction id`);
  }

  if (!postgresAttemptedClient && result.adapterEvents.length > 0) {
    errors.push(`${result.transactionId} invalid SQL shape must not reach native postgres adapter`);
  }

  if (postgresAttemptedClient) {
    errors.push(...validatePeriodCloseNativePostgresPoolAdapterEvents(result.adapterEvents));
  }

  if (nativeShapeRejected && result.status !== 'trace_invalid') {
    errors.push(`${result.transactionId} native postgres shape rejection must surface as trace_invalid`);
  }

  return errors;
}

export function createPeriodClosePostgresRuntimeBindingContract({
  nativePool
}: {
  nativePool: PeriodCloseNativePostgresPoolLike;
}): PeriodClosePostgresRuntimeBindingContract {
  const bindingEvents: PeriodClosePostgresRuntimeBindingEvent[] = [];

  function record({
    event,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresRuntimeBindingEvent, 'sequence'>) {
    bindingEvents.push({
      event,
      period,
      requestId,
      sequence: bindingEvents.length + 1,
      transactionId
    });
  }

  function readTransactionBindingEvents(transactionId: string) {
    return bindingEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  return {
    readBindingEvents: () => bindingEvents.map((event) => ({ ...event })),
    run: async (input) => {
      const baseEvent = {
        period: input.period,
        requestId: input.requestId,
        transactionId: input.transactionId
      };

      record({ ...baseEvent, event: 'receive_request' });
      record({ ...baseEvent, event: 'create_native_pool_adapter' });

      const nativeAdapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool });
      const postgresClientPort = createPeriodClosePostgresClientPortContract({ pool: nativeAdapter });

      record({ ...baseEvent, event: 'run_postgres_client_port' });

      const postgresResult = await postgresClientPort.run(input);
      const adapterEvents = nativeAdapter.readAdapterEvents();
      const nativeShapeRejected = hasNativeShapeRejection(adapterEvents);
      const initialStatus: PeriodClosePostgresRuntimeBindingStatus = nativeShapeRejected
        ? 'trace_invalid'
        : postgresResult.status;
      const initialTraceErrors = [
        ...postgresResult.traceErrors,
        ...(nativeShapeRejected
          ? [`${input.transactionId} native postgres pool/client shape was rejected before a valid DB runtime binding`]
          : [])
      ];

      record({ ...baseEvent, event: 'validate_runtime_binding_trace' });
      record({ ...baseEvent, event: 'return_response' });

      const result: PeriodClosePostgresRuntimeBindingResult = {
        adapterEvents,
        bindingEvents: readTransactionBindingEvents(input.transactionId),
        period: input.period,
        postgresResult,
        requestId: input.requestId,
        status: initialStatus,
        traceErrors: initialTraceErrors,
        transactionId: input.transactionId
      };
      const bindingErrors = validatePeriodClosePostgresRuntimeBindingTrace(result);

      return {
        ...result,
        status: bindingErrors.length > 0 ? 'trace_invalid' : result.status,
        traceErrors: [...initialTraceErrors, ...bindingErrors]
      };
    }
  };
}
