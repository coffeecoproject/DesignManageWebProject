import type {
  PeriodCloseServiceTransactionBoundaryContract,
  PeriodCloseServiceTransactionBoundaryResult
} from './periodCloseServiceTransactionBoundaryContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

export type PeriodCloseServiceConcurrencyOperation =
  | 'close_accounting_period'
  | 'guard_source_mutation';

export type PeriodCloseServiceConcurrencyEventName =
  | 'receive_request'
  | 'acquire_period_gate'
  | 'reject_period_in_flight'
  | 'delegate_service_transaction'
  | 'release_period_gate'
  | 'return_response';

export type PeriodCloseServiceConcurrencyEvent = {
  event: PeriodCloseServiceConcurrencyEventName;
  heldByRequestId?: string;
  operation: PeriodCloseServiceConcurrencyOperation;
  period?: string;
  requestId: string;
  reservationId?: string;
  sequence: number;
  transactionId?: string;
};

export type PeriodCloseServiceConcurrencyError = {
  code: 'PERIOD_TRANSACTION_IN_FLIGHT' | 'PERIOD_TRANSACTION_RESERVATION_NOT_ACTIVE';
  message: string;
  period: string;
  requestId: string;
  retryable: boolean;
};

export type PeriodCloseServiceConcurrencyReservation = {
  operation: 'close_accounting_period';
  period: string;
  request: CloseAccountingPeriodRequest;
  requestId: string;
  reservationId: string;
};

export type PeriodCloseServiceConcurrencyRejectedResult = {
  affectedPeriods: string[];
  error: PeriodCloseServiceConcurrencyError;
  events: PeriodCloseServiceConcurrencyEvent[];
  ok: false;
  operation: PeriodCloseServiceConcurrencyOperation;
  requestId: string;
  status: 'period_in_flight' | 'reservation_not_active';
};

export type PeriodCloseServiceConcurrencyDelegatedResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  affectedPeriods: string[];
  events: PeriodCloseServiceConcurrencyEvent[];
  ok: true;
  operation: PeriodCloseServiceConcurrencyOperation;
  requestId: string;
  serviceResult: PeriodCloseServiceTransactionBoundaryResult<T>;
  status: 'delegated';
};

export type PeriodCloseServiceConcurrencyReservationResult =
  | PeriodCloseServiceConcurrencyRejectedResult
  | {
      affectedPeriods: string[];
      events: PeriodCloseServiceConcurrencyEvent[];
      ok: true;
      operation: 'close_accounting_period';
      requestId: string;
      reservation: PeriodCloseServiceConcurrencyReservation;
      status: 'reserved';
    };

export type PeriodCloseServiceConcurrencyContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }) =>
    | PeriodCloseServiceConcurrencyDelegatedResult<PersistentCloseAccountingPeriodResult>
    | PeriodCloseServiceConcurrencyRejectedResult;
  completeReservedClose: (
    reservation: PeriodCloseServiceConcurrencyReservation
  ) =>
    | PeriodCloseServiceConcurrencyDelegatedResult<PersistentCloseAccountingPeriodResult>
    | PeriodCloseServiceConcurrencyRejectedResult;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) =>
    | PeriodCloseServiceConcurrencyDelegatedResult<PersistentSourceMutationResult>
    | PeriodCloseServiceConcurrencyRejectedResult;
  readConcurrencyEvents: () => PeriodCloseServiceConcurrencyEvent[];
  reserveCloseAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => PeriodCloseServiceConcurrencyReservationResult;
};

type ActivePeriodGate = {
  operation: PeriodCloseServiceConcurrencyOperation;
  period: string;
  requestId: string;
  reservationId: string;
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function buildReservationId({ period, requestId }: { period: string; requestId: string }) {
  return `${requestId}:period-gate:${period}`;
}

function readRequestEvents({
  events,
  requestId
}: {
  events: PeriodCloseServiceConcurrencyEvent[];
  requestId: string;
}) {
  return events.filter((event) => event.requestId === requestId).map((event) => ({ ...event }));
}

function buildInFlightError({
  gate,
  period,
  requestId
}: {
  gate: ActivePeriodGate;
  period: string;
  requestId: string;
}): PeriodCloseServiceConcurrencyError {
  return {
    code: 'PERIOD_TRANSACTION_IN_FLIGHT',
    message: `${period} 已有期间事务处理中，当前持有请求 ${gate.requestId}，请稍后重试。`,
    period,
    requestId,
    retryable: true
  };
}

function buildInactiveReservationError({
  period,
  requestId
}: {
  period: string;
  requestId: string;
}): PeriodCloseServiceConcurrencyError {
  return {
    code: 'PERIOD_TRANSACTION_RESERVATION_NOT_ACTIVE',
    message: `${period} 没有可完成的期间事务预留。`,
    period,
    requestId,
    retryable: false
  };
}

export function createPeriodCloseServiceConcurrencyContract({
  resolveSourceMutationPeriods = ({ mutation }) =>
    mutation.targetAccountingPeriod ? [mutation.targetAccountingPeriod] : [],
  service
}: {
  resolveSourceMutationPeriods?: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => string[];
  service: PeriodCloseServiceTransactionBoundaryContract;
}): PeriodCloseServiceConcurrencyContract {
  const events: PeriodCloseServiceConcurrencyEvent[] = [];
  const activeGatesByPeriod = new Map<string, ActivePeriodGate>();

  function record({
    event,
    heldByRequestId,
    operation,
    period,
    requestId,
    reservationId,
    transactionId
  }: Omit<PeriodCloseServiceConcurrencyEvent, 'sequence'>) {
    events.push({
      event,
      ...(heldByRequestId ? { heldByRequestId } : {}),
      operation,
      ...(period ? { period } : {}),
      requestId,
      ...(reservationId ? { reservationId } : {}),
      sequence: events.length + 1,
      ...(transactionId ? { transactionId } : {})
    });
  }

  function rejectInFlight({
    affectedPeriods,
    gate,
    operation,
    period,
    requestId
  }: {
    affectedPeriods: string[];
    gate: ActivePeriodGate;
    operation: PeriodCloseServiceConcurrencyOperation;
    period: string;
    requestId: string;
  }): PeriodCloseServiceConcurrencyRejectedResult {
    record({
      event: 'reject_period_in_flight',
      heldByRequestId: gate.requestId,
      operation,
      period,
      requestId,
      reservationId: gate.reservationId
    });
    record({ event: 'return_response', operation, period, requestId });

    return {
      affectedPeriods,
      error: buildInFlightError({ gate, period, requestId }),
      events: readRequestEvents({ events, requestId }),
      ok: false,
      operation,
      requestId,
      status: 'period_in_flight'
    };
  }

  function findConflictingGate(affectedPeriods: string[]) {
    for (const period of affectedPeriods) {
      const gate = activeGatesByPeriod.get(period);

      if (gate) {
        return { gate, period };
      }
    }

    return undefined;
  }

  function reserveCloseAccountingPeriod({
    period,
    request
  }: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }): PeriodCloseServiceConcurrencyReservationResult {
    const operation = 'close_accounting_period';
    const requestId = request.requestId;
    const affectedPeriods = [period];
    const reservationId = buildReservationId({ period, requestId });

    record({ event: 'receive_request', operation, period, requestId, reservationId });

    const conflict = findConflictingGate(affectedPeriods);

    if (conflict) {
      return rejectInFlight({
        affectedPeriods,
        gate: conflict.gate,
        operation,
        period: conflict.period,
        requestId
      });
    }

    activeGatesByPeriod.set(period, {
      operation,
      period,
      requestId,
      reservationId
    });
    record({ event: 'acquire_period_gate', operation, period, requestId, reservationId });

    return {
      affectedPeriods,
      events: readRequestEvents({ events, requestId }),
      ok: true,
      operation,
      requestId,
      reservation: {
        operation,
        period,
        request,
        requestId,
        reservationId
      },
      status: 'reserved'
    };
  }

  function completeReservedClose(
    reservation: PeriodCloseServiceConcurrencyReservation
  ):
    | PeriodCloseServiceConcurrencyDelegatedResult<PersistentCloseAccountingPeriodResult>
    | PeriodCloseServiceConcurrencyRejectedResult {
    const activeGate = activeGatesByPeriod.get(reservation.period);

    if (activeGate?.reservationId !== reservation.reservationId) {
      record({
        event: 'return_response',
        operation: reservation.operation,
        period: reservation.period,
        requestId: reservation.requestId,
        reservationId: reservation.reservationId
      });

      return {
        affectedPeriods: [reservation.period],
        error: buildInactiveReservationError({
          period: reservation.period,
          requestId: reservation.requestId
        }),
        events: readRequestEvents({ events, requestId: reservation.requestId }),
        ok: false,
        operation: reservation.operation,
        requestId: reservation.requestId,
        status: 'reservation_not_active'
      };
    }

    record({
      event: 'delegate_service_transaction',
      operation: reservation.operation,
      period: reservation.period,
      requestId: reservation.requestId,
      reservationId: reservation.reservationId
    });

    const serviceResult = service.closeAccountingPeriod({
      period: reservation.period,
      request: reservation.request
    });

    record({
      event: 'release_period_gate',
      operation: reservation.operation,
      period: reservation.period,
      requestId: reservation.requestId,
      reservationId: reservation.reservationId,
      transactionId: serviceResult.transactionId
    });
    activeGatesByPeriod.delete(reservation.period);
    record({
      event: 'return_response',
      operation: reservation.operation,
      period: reservation.period,
      requestId: reservation.requestId,
      reservationId: reservation.reservationId,
      transactionId: serviceResult.transactionId
    });

    return {
      affectedPeriods: [reservation.period],
      events: readRequestEvents({ events, requestId: reservation.requestId }),
      ok: true,
      operation: reservation.operation,
      requestId: reservation.requestId,
      serviceResult,
      status: 'delegated'
    };
  }

  function closeAccountingPeriod(input: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }) {
    const reserved = reserveCloseAccountingPeriod(input);

    if (!reserved.ok) {
      return reserved;
    }

    return completeReservedClose(reserved.reservation);
  }

  function guardSourceMutation({
    context,
    mutation
  }: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) {
    const operation: PeriodCloseServiceConcurrencyOperation = 'guard_source_mutation';
    const requestId = context.requestId;
    const affectedPeriods = unique(resolveSourceMutationPeriods({ context, mutation }));
    const primaryPeriod = affectedPeriods[0];

    record({ event: 'receive_request', operation, period: primaryPeriod, requestId });

    const conflict = findConflictingGate(affectedPeriods);

    if (conflict) {
      return rejectInFlight({
        affectedPeriods,
        gate: conflict.gate,
        operation,
        period: conflict.period,
        requestId
      });
    }

    record({ event: 'delegate_service_transaction', operation, period: primaryPeriod, requestId });

    const serviceResult = service.guardSourceMutation({ context, mutation });

    record({
      event: 'return_response',
      operation,
      period: primaryPeriod,
      requestId,
      transactionId: serviceResult.transactionId
    });

    return {
      affectedPeriods,
      events: readRequestEvents({ events, requestId }),
      ok: true as const,
      operation,
      requestId,
      serviceResult,
      status: 'delegated' as const
    };
  }

  return {
    closeAccountingPeriod,
    completeReservedClose,
    guardSourceMutation,
    readConcurrencyEvents: () => events.map((event) => ({ ...event })),
    reserveCloseAccountingPeriod
  };
}

export function validatePeriodCloseServiceConcurrencyEvents(
  events: readonly PeriodCloseServiceConcurrencyEvent[]
): string[] {
  const errors: string[] = [];
  const activeByPeriod = new Map<string, PeriodCloseServiceConcurrencyEvent>();
  const rejectedRequestIds = new Set(
    events
      .filter((event) => event.event === 'reject_period_in_flight')
      .map((event) => event.requestId)
  );

  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (event.event === 'acquire_period_gate') {
      if (!event.period) {
        errors.push(`${event.requestId} acquire event must include period`);
        continue;
      }

      if (activeByPeriod.has(event.period)) {
        errors.push(`${event.period} must not have two active service-level period gates`);
      }

      activeByPeriod.set(event.period, event);
    }

    if (event.event === 'release_period_gate') {
      if (!event.period) {
        errors.push(`${event.requestId} release event must include period`);
        continue;
      }

      const active = activeByPeriod.get(event.period);

      if (!active) {
        errors.push(`${event.period} must not release a service-level period gate that is not active`);
      } else if (active.reservationId !== event.reservationId) {
        errors.push(`${event.period} release must match the active service-level reservation`);
      }

      activeByPeriod.delete(event.period);
    }

    if (event.event === 'reject_period_in_flight') {
      if (!event.period || !activeByPeriod.has(event.period)) {
        errors.push(`${event.requestId} in-flight rejection must reference an active service-level period gate`);
      }
    }
  }

  for (const [period] of activeByPeriod) {
    errors.push(`${period} service-level period gate must be released before the request completes`);
  }

  for (const requestId of rejectedRequestIds) {
    if (events.some((event) => event.requestId === requestId && event.event === 'delegate_service_transaction')) {
      errors.push(`${requestId} rejected service-level request must not delegate to DB client transaction`);
    }
  }

  return errors;
}
