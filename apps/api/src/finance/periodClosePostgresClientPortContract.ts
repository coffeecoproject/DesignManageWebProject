import {
  validatePeriodCloseSqlDriverExecutions,
  type PeriodCloseSqlDriverExecution,
  type PeriodCloseSqlDriverStatement,
  type PeriodCloseSqlDriverStatementName
} from './periodCloseSqlDriverRepositoryContract.js';
import {
  periodCloseTransactionIsolationPolicies,
  type PeriodCloseTransactionPolicyOperation
} from './periodCloseTransactionIsolationPolicyContract.js';
import type { PeriodCloseFormalDbTransactionFailureCode } from './periodCloseFormalDbTransactionManagerContract.js';

export type PeriodClosePostgresClientPortQueryResult = {
  rowCount?: number;
  rows?: readonly Record<string, unknown>[];
};

export type PeriodClosePostgresClientPort = {
  query: (sql: string, parameters?: readonly unknown[]) => Promise<PeriodClosePostgresClientPortQueryResult>;
  release: () => Promise<void> | void;
};

export type PeriodClosePostgresPoolPort = {
  connect: () => Promise<PeriodClosePostgresClientPort>;
};

export type PeriodClosePostgresClientPortStatus = 'committed' | 'driver_failed' | 'rolled_back' | 'trace_invalid';

export type PeriodClosePostgresClientPortEventName =
  | 'acquire_client'
  | 'classify_failure'
  | 'connect_pool'
  | 'execute_sql_statement'
  | 'receive_request'
  | 'release_client'
  | 'return_response'
  | 'rollback_after_failure'
  | 'validate_transaction_shape';

export type PeriodClosePostgresClientPortEvent = {
  event: PeriodClosePostgresClientPortEventName;
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  operation: PeriodCloseTransactionPolicyOperation;
  period: string;
  requestId: string;
  retryable?: boolean;
  sequence: number;
  statementName?: PeriodCloseSqlDriverStatementName;
  transactionId: string;
};

export type PeriodClosePostgresClientPortRunInput = {
  operation: PeriodCloseTransactionPolicyOperation;
  period: string;
  requestId: string;
  statements: readonly PeriodCloseSqlDriverStatement[];
  transactionId: string;
};

export type PeriodClosePostgresClientPortResult = {
  events: PeriodClosePostgresClientPortEvent[];
  executions: PeriodCloseSqlDriverExecution[];
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  operation: PeriodCloseTransactionPolicyOperation;
  period: string;
  requestId: string;
  retryable: boolean;
  status: PeriodClosePostgresClientPortStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresClientPortContract = {
  readEvents: () => PeriodClosePostgresClientPortEvent[];
  run: (input: PeriodClosePostgresClientPortRunInput) => Promise<PeriodClosePostgresClientPortResult>;
};

function toExecution(statement: PeriodCloseSqlDriverStatement, sequence: number): PeriodCloseSqlDriverExecution {
  return {
    ...statement,
    parameters: [...statement.parameters],
    sequence
  };
}

function terminalStatus(statements: readonly PeriodCloseSqlDriverStatement[]): PeriodClosePostgresClientPortStatus {
  const terminal = statements.at(-1)?.name;

  return terminal === 'commit' ? 'committed' : 'rolled_back';
}

function retryableByPolicy({
  failureCode,
  operation
}: {
  failureCode: PeriodCloseFormalDbTransactionFailureCode;
  operation: PeriodCloseTransactionPolicyOperation;
}) {
  return (
    periodCloseTransactionIsolationPolicies
      .find((policy) => policy.operation === operation)
      ?.retryableFailureCodes.includes(failureCode) ?? false
  );
}

function errorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' ? code : undefined;
}

export function classifyPostgresClientPortFailure(error: unknown): PeriodCloseFormalDbTransactionFailureCode {
  switch (errorCode(error)) {
    case '40001':
      return 'serialization_failure';
    case '40P01':
      return 'deadlock_detected';
    case '55P03':
      return 'lock_timeout';
    case '08003':
    case '08006':
    case 'ECONNRESET':
      return 'connection_lost';
    case '23503':
    case '23505':
      return 'constraint_violation';
    default:
      return 'unknown';
  }
}

function validatePlannedStatements({
  period,
  statements,
  transactionId
}: {
  period: string;
  statements: readonly PeriodCloseSqlDriverStatement[];
  transactionId: string;
}) {
  const executions = statements.map((statement, index) => toExecution(statement, index + 1));
  const errors = validatePeriodCloseSqlDriverExecutions(executions);

  if (statements.some((statement) => statement.transactionId !== transactionId)) {
    errors.push(`${transactionId} postgres client port statements must use the request transaction id`);
  }

  if (statements.some((statement) => statement.period && statement.period !== period)) {
    errors.push(`${transactionId} postgres client port statements must target one accounting period`);
  }

  return errors;
}

function eventNames(events: readonly PeriodClosePostgresClientPortEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

export function validatePeriodClosePostgresClientPortTrace(
  result: PeriodClosePostgresClientPortResult
): string[] {
  const errors: string[] = [];
  const events = result.events.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_request');
  const validateIndex = names.indexOf('validate_transaction_shape');
  const connectIndex = names.indexOf('connect_pool');
  const acquireIndex = names.indexOf('acquire_client');
  const releaseIndex = names.indexOf('release_client');
  const classifyIndex = names.indexOf('classify_failure');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres client port must receive request first`);
  }

  if (validateIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres client port must validate transaction shape before DB connection`);
  }

  if (result.status === 'trace_invalid') {
    if (connectIndex !== -1 || acquireIndex !== -1 || result.executions.length > 0) {
      errors.push(`${result.transactionId} invalid transaction shape must not connect to the DB client`);
    }

    if (returnIndex !== events.length - 1) {
      errors.push(`${result.transactionId} trace-invalid result must still return after validation`);
    }

    return errors;
  }

  errors.push(...validatePeriodCloseSqlDriverExecutions(result.executions));

  if (connectIndex <= validateIndex || acquireIndex <= connectIndex) {
    errors.push(`${result.transactionId} postgres client port must acquire a client after shape validation`);
  }

  if (releaseIndex === -1 || releaseIndex >= returnIndex) {
    errors.push(`${result.transactionId} postgres client port must release the client before returning`);
  }

  if (result.status === 'driver_failed') {
    const rollbackIndex = names.indexOf('rollback_after_failure');

    if (rollbackIndex <= acquireIndex || rollbackIndex >= releaseIndex) {
      errors.push(`${result.transactionId} postgres client port must rollback failed transactions before release`);
    }

    if (classifyIndex <= releaseIndex) {
      errors.push(`${result.transactionId} postgres client port must classify driver failures after release`);
    }
  } else if (classifyIndex !== -1) {
    errors.push(`${result.transactionId} postgres client port must classify failures only for driver_failed results`);
  }

  if (events.some((event) => event.operation !== result.operation)) {
    errors.push(`${result.transactionId} postgres client port events must keep one operation`);
  }

  if (events.some((event) => event.period !== result.period)) {
    errors.push(`${result.transactionId} postgres client port events must keep one accounting period`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres client port events must keep one request id`);
  }

  return errors;
}

export function createPeriodClosePostgresClientPortContract({
  pool
}: {
  pool: PeriodClosePostgresPoolPort;
}): PeriodClosePostgresClientPortContract {
  const events: PeriodClosePostgresClientPortEvent[] = [];

  function record(event: Omit<PeriodClosePostgresClientPortEvent, 'sequence'>) {
    events.push({
      ...event,
      sequence: events.length + 1
    });
  }

  function readTransactionEvents(transactionId: string) {
    return events.filter((event) => event.transactionId === transactionId).map((event) => ({ ...event }));
  }

  return {
    readEvents: () => events.map((event) => ({ ...event })),
    run: async ({ operation, period, requestId, statements, transactionId }) => {
      const baseEvent = {
        operation,
        period,
        requestId,
        transactionId
      };
      const plannedErrors = validatePlannedStatements({ period, statements, transactionId });

      record({ ...baseEvent, event: 'receive_request' });
      record({ ...baseEvent, event: 'validate_transaction_shape' });

      if (plannedErrors.length > 0) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          events: readTransactionEvents(transactionId),
          executions: [],
          operation,
          period,
          requestId,
          retryable: false,
          status: 'trace_invalid',
          traceErrors: plannedErrors,
          transactionId
        };
      }

      const executions: PeriodCloseSqlDriverExecution[] = [];
      let client: PeriodClosePostgresClientPort | undefined;

      try {
        record({ ...baseEvent, event: 'connect_pool' });
        client = await pool.connect();
        record({ ...baseEvent, event: 'acquire_client' });

        for (const statement of statements) {
          const execution = toExecution(statement, executions.length + 1);

          executions.push(execution);
          record({ ...baseEvent, event: 'execute_sql_statement', statementName: statement.name });
          await client.query(statement.sql, [...statement.parameters]);
        }

        await client.release();
        record({ ...baseEvent, event: 'release_client' });
        record({ ...baseEvent, event: 'return_response' });

        const result: PeriodClosePostgresClientPortResult = {
          events: readTransactionEvents(transactionId),
          executions,
          operation,
          period,
          requestId,
          retryable: false,
          status: terminalStatus(statements),
          traceErrors: [],
          transactionId
        };
        const traceErrors = validatePeriodClosePostgresClientPortTrace(result);

        return {
          ...result,
          status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
          traceErrors
        };
      } catch (error) {
        const failureCode = classifyPostgresClientPortFailure(error);
        const retryable = retryableByPolicy({ failureCode, operation });
        const lastExecutionName = executions.at(-1)?.name;
        const traceErrors: string[] = [];

        if (client && lastExecutionName !== 'commit' && lastExecutionName !== 'rollback') {
          const rollback = toExecution(
            {
              name: 'rollback',
              parameters: [],
              period,
              sql: 'ROLLBACK;',
              transactionId
            },
            executions.length + 1
          );

          executions.push(rollback);
          record({ ...baseEvent, event: 'rollback_after_failure', statementName: 'rollback' });

          try {
            await client.query(rollback.sql, []);
          } catch (rollbackError) {
            traceErrors.push(
              `${transactionId} postgres client port rollback failed after driver error: ${
                rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
              }`
            );
          }
        }

        if (client) {
          await client.release();
          record({ ...baseEvent, event: 'release_client' });
        }

        record({
          ...baseEvent,
          event: 'classify_failure',
          failureCode,
          retryable
        });
        record({ ...baseEvent, event: 'return_response' });

        const result: PeriodClosePostgresClientPortResult = {
          events: readTransactionEvents(transactionId),
          executions,
          failureCode,
          operation,
          period,
          requestId,
          retryable,
          status: 'driver_failed',
          traceErrors,
          transactionId
        };
        const validationErrors = validatePeriodClosePostgresClientPortTrace(result);

        return {
          ...result,
          status: validationErrors.length > 0 ? 'trace_invalid' : result.status,
          traceErrors: [...traceErrors, ...validationErrors]
        };
      }
    }
  };
}
