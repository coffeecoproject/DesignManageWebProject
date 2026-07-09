import {
  createPeriodCloseDbConnectionPoolLifecycleContract,
  validatePeriodCloseDbConnectionPoolLifecycleTrace,
  type PeriodCloseDbConnectionPoolEvent,
  type PeriodCloseDbConnectionPoolLifecycleContract
} from './periodCloseDbConnectionPoolLifecycleContract.js';
import {
  createPeriodCloseFormalDbTransactionManagerContract,
  validatePeriodCloseFormalDbTransactionManagerTrace,
  type PeriodCloseFormalDbTransactionEvent,
  type PeriodCloseFormalDbTransactionFailureCode,
  type PeriodCloseFormalDbTransactionManagerContract,
  type PeriodCloseFormalDbTransactionOutcome
} from './periodCloseFormalDbTransactionManagerContract.js';
import {
  validatePeriodCloseSqlDriverExecutions,
  type PeriodCloseSqlDriverExecution,
  type PeriodCloseSqlDriverStatementName
} from './periodCloseSqlDriverRepositoryContract.js';
import type { PeriodCloseTransactionPolicyOperation } from './periodCloseTransactionIsolationPolicyContract.js';

export type PeriodCloseDbRuntimeAdapterStatus =
  | 'committed'
  | 'driver_failed'
  | 'pool_exhausted'
  | 'rolled_back'
  | 'trace_invalid';

export type PeriodCloseDbRuntimeAdapterEventName =
  | 'receive_request'
  | 'acquire_pool_transaction'
  | 'open_formal_transaction'
  | 'delegate_sql_driver'
  | 'validate_runtime_trace'
  | 'return_response';

export type PeriodCloseDbRuntimeAdapterEvent = {
  event: PeriodCloseDbRuntimeAdapterEventName;
  operation: PeriodCloseTransactionPolicyOperation;
  period: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodCloseDbRuntimeAdapterRunInput = {
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  holdPoolConnectionBeforeRun?: boolean;
  lockTimeoutMs?: number;
  operation: PeriodCloseTransactionPolicyOperation;
  outcome: PeriodCloseFormalDbTransactionOutcome;
  period: string;
  requestId: string;
};

export type PeriodCloseDbRuntimeAdapterResult = {
  driverExecutions: PeriodCloseSqlDriverExecution[];
  formalEvents: PeriodCloseFormalDbTransactionEvent[];
  operation: PeriodCloseTransactionPolicyOperation;
  period: string;
  poolEvents: PeriodCloseDbConnectionPoolEvent[];
  requestId: string;
  retryable: boolean;
  runtimeEvents: PeriodCloseDbRuntimeAdapterEvent[];
  status: PeriodCloseDbRuntimeAdapterStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodCloseDbRuntimeAdapterContract = {
  readRuntimeEvents: () => PeriodCloseDbRuntimeAdapterEvent[];
  run: (input: PeriodCloseDbRuntimeAdapterRunInput) => PeriodCloseDbRuntimeAdapterResult;
};

function buildRuntimeTransactionId({
  operation,
  requestId
}: {
  operation: PeriodCloseTransactionPolicyOperation;
  requestId: string;
}) {
  return `${requestId}:${operation}:db-runtime`;
}

function buildDriverExecution({
  name,
  parameters,
  period,
  sequence,
  sql,
  transactionId
}: {
  name: PeriodCloseSqlDriverStatementName;
  parameters: readonly unknown[];
  period: string;
  sequence: number;
  sql: string;
  transactionId: string;
}): PeriodCloseSqlDriverExecution {
  return {
    name,
    parameters,
    period,
    sequence,
    sql,
    transactionId
  };
}

function buildDriverExecutions({
  period,
  terminal,
  transactionId
}: {
  period: string;
  terminal: 'commit' | 'rollback';
  transactionId: string;
}): PeriodCloseSqlDriverExecution[] {
  return [
    buildDriverExecution({
      name: 'begin',
      parameters: [],
      period,
      sequence: 1,
      sql: 'BEGIN;',
      transactionId
    }),
    buildDriverExecution({
      name: 'set_transaction_isolation',
      parameters: [],
      period,
      sequence: 2,
      sql: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
      transactionId
    }),
    buildDriverExecution({
      name: 'lock_accounting_period_for_update',
      parameters: [period],
      period,
      sequence: 3,
      sql: 'SELECT "period", "status", "version" FROM "accounting_periods" WHERE "period" = $1 FOR UPDATE;',
      transactionId
    }),
    buildDriverExecution({
      name: terminal,
      parameters: [],
      period,
      sequence: 4,
      sql: terminal === 'commit' ? 'COMMIT;' : 'ROLLBACK;',
      transactionId
    })
  ];
}

function requestPoolEvents(events: readonly PeriodCloseDbConnectionPoolEvent[], requestId: string) {
  return events.filter((event) => event.requestId === requestId);
}

function terminalFromPool(events: readonly PeriodCloseDbConnectionPoolEvent[]) {
  if (events.some((event) => event.event === 'commit_transaction')) {
    return 'commit';
  }

  if (events.some((event) => event.event === 'rollback_transaction')) {
    return 'rollback';
  }

  return undefined;
}

function terminalFromFormal(events: readonly PeriodCloseFormalDbTransactionEvent[]) {
  if (events.some((event) => event.event === 'commit_transaction')) {
    return 'commit';
  }

  if (events.some((event) => event.event === 'rollback_transaction')) {
    return 'rollback';
  }

  return undefined;
}

function terminalFromDriver(executions: readonly PeriodCloseSqlDriverExecution[]) {
  const terminal = executions.at(-1)?.name;

  return terminal === 'commit' || terminal === 'rollback' ? terminal : undefined;
}

function operationMatches(
  events: readonly (PeriodCloseDbConnectionPoolEvent | PeriodCloseFormalDbTransactionEvent | PeriodCloseDbRuntimeAdapterEvent)[],
  operation: PeriodCloseTransactionPolicyOperation
) {
  return events.every((event) => !event.operation || event.operation === operation);
}

function periodMatches(
  events: readonly (PeriodCloseDbConnectionPoolEvent | PeriodCloseFormalDbTransactionEvent | PeriodCloseDbRuntimeAdapterEvent)[],
  period: string
) {
  return events.every((event) => !event.period || event.period === period);
}

function requestMatches(
  events: readonly (PeriodCloseDbConnectionPoolEvent | PeriodCloseFormalDbTransactionEvent | PeriodCloseDbRuntimeAdapterEvent)[],
  requestId: string
) {
  return events.every((event) => !event.requestId || event.requestId === requestId);
}

function validateRuntimeEventOrder({
  events,
  poolExhausted,
  transactionId
}: {
  events: readonly PeriodCloseDbRuntimeAdapterEvent[];
  poolExhausted: boolean;
  transactionId: string;
}) {
  const errors: string[] = [];
  const expectedOrder: PeriodCloseDbRuntimeAdapterEventName[] = poolExhausted
    ? ['receive_request', 'acquire_pool_transaction', 'validate_runtime_trace', 'return_response']
    : [
        'receive_request',
        'acquire_pool_transaction',
        'open_formal_transaction',
        'delegate_sql_driver',
        'validate_runtime_trace',
        'return_response'
      ];
  const actualOrder = events
    .filter((event) => event.transactionId === transactionId)
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);

  if (actualOrder.join('|') !== expectedOrder.join('|')) {
    errors.push(`${transactionId} runtime adapter events must follow request-to-response order`);
  }

  return errors;
}

export function validatePeriodCloseDbRuntimeAdapterTrace(result: PeriodCloseDbRuntimeAdapterResult): string[] {
  const errors: string[] = [
    ...validatePeriodCloseDbConnectionPoolLifecycleTrace({ events: result.poolEvents }),
    ...validatePeriodCloseFormalDbTransactionManagerTrace({ events: result.formalEvents }),
    ...validatePeriodCloseSqlDriverExecutions(result.driverExecutions)
  ];
  const poolRequestEvents = requestPoolEvents(result.poolEvents, result.requestId);
  const poolExhausted = poolRequestEvents.some((event) => event.event === 'reject_checkout');

  errors.push(
    ...validateRuntimeEventOrder({
      events: result.runtimeEvents,
      poolExhausted,
      transactionId: result.transactionId
    })
  );

  if (!operationMatches([...poolRequestEvents, ...result.formalEvents, ...result.runtimeEvents], result.operation)) {
    errors.push(`${result.transactionId} must keep one operation across runtime, pool and formal transaction traces`);
  }

  if (!periodMatches([...poolRequestEvents, ...result.formalEvents, ...result.runtimeEvents], result.period)) {
    errors.push(`${result.transactionId} must keep one accounting period across runtime, pool and formal traces`);
  }

  if (!requestMatches([...poolRequestEvents, ...result.formalEvents, ...result.runtimeEvents], result.requestId)) {
    errors.push(`${result.transactionId} must keep one request id across runtime, pool and formal traces`);
  }

  if (result.driverExecutions.some((execution) => execution.period !== result.period)) {
    errors.push(`${result.transactionId} SQL driver executions must target the runtime accounting period`);
  }

  if (poolExhausted) {
    if (result.status !== 'pool_exhausted') {
      errors.push(`${result.transactionId} pool exhaustion must surface as pool_exhausted`);
    }

    if (result.formalEvents.length > 0 || result.driverExecutions.length > 0) {
      errors.push(`${result.transactionId} pool exhaustion must not enter formal transaction manager or SQL driver`);
    }

    return errors;
  }

  if (result.formalEvents.length === 0) {
    errors.push(`${result.transactionId} must open a formal DB transaction after pool checkout`);
  }

  if (result.driverExecutions.length === 0) {
    errors.push(`${result.transactionId} must delegate unit of work to SQL driver inside the DB runtime`);
  }

  const poolTerminal = terminalFromPool(poolRequestEvents);
  const formalTerminal = terminalFromFormal(result.formalEvents);
  const driverTerminal = terminalFromDriver(result.driverExecutions);
  const expectedTerminal = result.status === 'committed' ? 'commit' : 'rollback';

  if (
    (result.status === 'committed' || result.status === 'rolled_back' || result.status === 'driver_failed') &&
    (poolTerminal !== expectedTerminal || formalTerminal !== expectedTerminal || driverTerminal !== expectedTerminal)
  ) {
    errors.push(
      `${result.transactionId} pool, formal transaction manager and SQL driver terminals must match ${expectedTerminal}`
    );
  }

  if (result.status === 'driver_failed') {
    const classifyEvent = result.formalEvents.find((event) => event.event === 'classify_failure');

    if (!classifyEvent) {
      errors.push(`${result.transactionId} driver failures must be classified after the DB connection is released`);
    }

    if (classifyEvent?.retryable === true && classifyEvent.retryScope !== 'outside_transaction') {
      errors.push(`${result.transactionId} retryable driver failures must be classified outside the DB transaction`);
    }
  }

  return errors;
}

export function createPeriodCloseDbRuntimeAdapterContract({
  manager = createPeriodCloseFormalDbTransactionManagerContract(),
  pool = createPeriodCloseDbConnectionPoolLifecycleContract({ maxConnections: 1 })
}: {
  manager?: PeriodCloseFormalDbTransactionManagerContract;
  pool?: PeriodCloseDbConnectionPoolLifecycleContract;
} = {}): PeriodCloseDbRuntimeAdapterContract {
  const runtimeEvents: PeriodCloseDbRuntimeAdapterEvent[] = [];

  function record({
    event,
    operation,
    period,
    requestId,
    transactionId
  }: Omit<PeriodCloseDbRuntimeAdapterEvent, 'sequence'>) {
    runtimeEvents.push({
      event,
      operation,
      period,
      requestId,
      sequence: runtimeEvents.length + 1,
      transactionId
    });
  }

  function readEvents(transactionId: string) {
    return runtimeEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  return {
    readRuntimeEvents: () => runtimeEvents.map((event) => ({ ...event })),
    run: ({ failureCode, holdPoolConnectionBeforeRun, lockTimeoutMs, operation, outcome, period, requestId }) => {
      const transactionId = buildRuntimeTransactionId({ operation, requestId });

      record({ event: 'receive_request', operation, period, requestId, transactionId });

      const reservation = holdPoolConnectionBeforeRun
        ? pool.reserveConnection({
            operation,
            period,
            requestId: `${requestId}:existing-lease`
          })
        : undefined;

      const poolResult = pool.runTransaction({
        ...(failureCode ? { failureCode } : {}),
        ...(lockTimeoutMs ? { lockTimeoutMs } : {}),
        operation,
        outcome,
        period,
        requestId
      });

      record({ event: 'acquire_pool_transaction', operation, period, requestId, transactionId });

      if (reservation?.ok) {
        pool.releaseReservedConnection({ leaseId: reservation.leaseId, requestId: `${requestId}:release-existing-lease` });
      }

      if (!poolResult.ok) {
        const draftResult: PeriodCloseDbRuntimeAdapterResult = {
          driverExecutions: [],
          formalEvents: [],
          operation,
          period,
          poolEvents: pool.readEvents(),
          requestId,
          retryable: poolResult.retryable,
          runtimeEvents: readEvents(transactionId),
          status: 'pool_exhausted',
          traceErrors: [],
          transactionId
        };

        record({ event: 'validate_runtime_trace', operation, period, requestId, transactionId });
        record({ event: 'return_response', operation, period, requestId, transactionId });

        const result = {
          ...draftResult,
          runtimeEvents: readEvents(transactionId)
        };
        const traceErrors = validatePeriodCloseDbRuntimeAdapterTrace(result);

        return {
          ...result,
          status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
          traceErrors
        };
      }

      record({ event: 'open_formal_transaction', operation, period, requestId, transactionId });

      const formalResult = manager.run({
        ...(failureCode ? { failureCode } : {}),
        ...(lockTimeoutMs ? { lockTimeoutMs } : {}),
        operation,
        outcome,
        period,
        requestId
      });

      record({ event: 'delegate_sql_driver', operation, period, requestId, transactionId });

      const driverExecutions = buildDriverExecutions({
        period,
        terminal: outcome === 'committed' ? 'commit' : 'rollback',
        transactionId
      });
      const status: PeriodCloseDbRuntimeAdapterStatus =
        outcome === 'committed' ? 'committed' : outcome === 'driver_failed' ? 'driver_failed' : 'rolled_back';

      record({ event: 'validate_runtime_trace', operation, period, requestId, transactionId });
      record({ event: 'return_response', operation, period, requestId, transactionId });

      const result: PeriodCloseDbRuntimeAdapterResult = {
        driverExecutions,
        formalEvents: formalResult.events,
        operation,
        period,
        poolEvents: pool.readEvents(),
        requestId,
        retryable: formalResult.retryable,
        runtimeEvents: readEvents(transactionId),
        status,
        traceErrors: [],
        transactionId
      };
      const traceErrors = validatePeriodCloseDbRuntimeAdapterTrace(result);

      return {
        ...result,
        status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
        traceErrors
      };
    }
  };
}
