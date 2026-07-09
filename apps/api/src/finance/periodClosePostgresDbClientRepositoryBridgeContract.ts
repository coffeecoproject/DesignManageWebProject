import {
  validatePeriodCloseDbClientRepositoryTrace,
  type PeriodCloseDbClientEvent,
  type PeriodCloseDbClientOperation,
  type PeriodCloseDbClientRepositoryContract,
  type PeriodCloseDbClientRepositoryResult
} from './periodCloseDbClientRepositoryContract.js';
import {
  createPeriodClosePostgresClientPortContract,
  validatePeriodClosePostgresClientPortTrace,
  type PeriodClosePostgresClientPortResult,
  type PeriodClosePostgresPoolPort
} from './periodClosePostgresClientPortContract.js';
import type {
  PeriodCloseSqlDriverExecution,
  PeriodCloseSqlDriverStatement
} from './periodCloseSqlDriverRepositoryContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import type { PeriodCloseTransactionPolicyOperation } from './periodCloseTransactionIsolationPolicyContract.js';

export type PeriodClosePostgresDbClientRepositoryBridgeStatus =
  | 'committed'
  | 'driver_failed'
  | 'rolled_back'
  | 'trace_invalid';

export type PeriodClosePostgresDbClientRepositoryBridgeEventName =
  | 'receive_request'
  | 'run_db_client_repository'
  | 'run_postgres_client_port'
  | 'validate_bridge_trace'
  | 'return_response';

export type PeriodClosePostgresDbClientRepositoryBridgeEvent = {
  event: PeriodClosePostgresDbClientRepositoryBridgeEventName;
  operation: PeriodCloseDbClientOperation;
  period?: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresDbClientRepositoryBridgeResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  bridgeEvents: PeriodClosePostgresDbClientRepositoryBridgeEvent[];
  clientEvents: PeriodCloseDbClientEvent[];
  driverExecutions: PeriodCloseSqlDriverExecution[];
  operation: PeriodCloseDbClientOperation;
  period?: string;
  postgresResult?: PeriodClosePostgresClientPortResult;
  repositoryResult: PeriodCloseDbClientRepositoryResult<T>['repositoryResult'];
  requestId: string;
  status: PeriodClosePostgresDbClientRepositoryBridgeStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresDbClientRepositoryBridgeContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => Promise<PeriodClosePostgresDbClientRepositoryBridgeResult<PersistentCloseAccountingPeriodResult>>;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => Promise<PeriodClosePostgresDbClientRepositoryBridgeResult<PersistentSourceMutationResult>>;
  readBridgeEvents: () => PeriodClosePostgresDbClientRepositoryBridgeEvent[];
};

function buildTransactionId({
  operation,
  requestId
}: {
  operation: PeriodCloseDbClientOperation;
  requestId: string;
}) {
  return `${requestId}:${operation}:pg-client-bridge`;
}

function toRuntimeOperation(operation: PeriodCloseDbClientOperation): PeriodCloseTransactionPolicyOperation {
  return operation === 'close_accounting_period'
    ? 'close_or_reopen_accounting_period'
    : 'closed_period_source_mutation_guard';
}

function toStatement(execution: PeriodCloseSqlDriverExecution): PeriodCloseSqlDriverStatement {
  return {
    name: execution.name,
    parameters: [...execution.parameters],
    ...(execution.period ? { period: execution.period } : {}),
    sql: execution.sql,
    transactionId: execution.transactionId
  };
}

function terminalFromExecutions(executions: readonly PeriodCloseSqlDriverExecution[]) {
  const terminal = executions.at(-1)?.name;

  return terminal === 'commit' || terminal === 'rollback' ? terminal : undefined;
}

function statusFromTerminal(terminal: 'commit' | 'rollback'): PeriodClosePostgresDbClientRepositoryBridgeStatus {
  return terminal === 'commit' ? 'committed' : 'rolled_back';
}

function expectedPostgresStatus(terminal: 'commit' | 'rollback') {
  return terminal === 'commit' ? 'committed' : 'rolled_back';
}

function periodFromTrace({
  clientEvents,
  driverExecutions,
  explicitPeriod
}: {
  clientEvents: readonly PeriodCloseDbClientEvent[];
  driverExecutions: readonly PeriodCloseSqlDriverExecution[];
  explicitPeriod?: string;
}) {
  return explicitPeriod ?? clientEvents.find((event) => event.period)?.period ?? driverExecutions.find((execution) => execution.period)?.period;
}

function executionsMatchPostgresTrace({
  driverExecutions,
  postgresResult,
  transactionId
}: {
  driverExecutions: readonly PeriodCloseSqlDriverExecution[];
  postgresResult: PeriodClosePostgresClientPortResult;
  transactionId: string;
}) {
  const errors: string[] = [];

  if (driverExecutions.length !== postgresResult.executions.length) {
    errors.push(`${transactionId} postgres client port must execute the same number of SQL driver statements`);
  }

  for (let index = 0; index < Math.min(driverExecutions.length, postgresResult.executions.length); index += 1) {
    const driverExecution = driverExecutions[index];
    const postgresExecution = postgresResult.executions[index];

    if (!driverExecution || !postgresExecution) {
      continue;
    }

    if (driverExecution.name !== postgresExecution.name || driverExecution.sql !== postgresExecution.sql) {
      errors.push(`${transactionId} postgres client port statement ${index + 1} must match SQL driver execution`);
    }

    if (JSON.stringify(driverExecution.parameters) !== JSON.stringify(postgresExecution.parameters)) {
      errors.push(`${transactionId} postgres client port parameters ${index + 1} must match SQL driver execution`);
    }
  }

  return errors;
}

export function validatePeriodClosePostgresDbClientRepositoryBridgeTrace<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
>(
  result: PeriodClosePostgresDbClientRepositoryBridgeResult<T>
): string[] {
  const errors = [
    ...validatePeriodCloseDbClientRepositoryTrace({
      clientEvents: result.clientEvents,
      driverExecutions: result.driverExecutions
    })
  ];
  const bridgeEvents = result.bridgeEvents.slice().sort((left, right) => left.sequence - right.sequence);
  const bridgeEventNames = bridgeEvents.map((event) => event.event);

  if (bridgeEventNames[0] !== 'receive_request') {
    errors.push(`${result.transactionId} postgres repository bridge must receive request first`);
  }

  if (bridgeEventNames.at(-1) !== 'return_response') {
    errors.push(`${result.transactionId} postgres repository bridge must return response last`);
  }

  if (bridgeEventNames.indexOf('run_db_client_repository') <= bridgeEventNames.indexOf('receive_request')) {
    errors.push(`${result.transactionId} postgres repository bridge must run DB client repository after request`);
  }

  if (bridgeEventNames.indexOf('validate_bridge_trace') <= bridgeEventNames.indexOf('run_db_client_repository')) {
    errors.push(`${result.transactionId} postgres repository bridge must validate after DB client repository`);
  }

  if (!result.repositoryResult.driverOk) {
    if (result.postgresResult) {
      errors.push(`${result.transactionId} failed SQL driver repository plans must not run the postgres client port`);
    }

    return errors;
  }

  const terminal = terminalFromExecutions(result.driverExecutions);

  if (!terminal) {
    errors.push(`${result.transactionId} SQL driver repository plan must end in COMMIT or ROLLBACK`);
  }

  if (!result.postgresResult) {
    errors.push(`${result.transactionId} successful SQL driver repository plan must run through postgres client port`);

    return errors;
  }

  errors.push(...validatePeriodClosePostgresClientPortTrace(result.postgresResult));
  errors.push(
    ...executionsMatchPostgresTrace({
      driverExecutions: result.driverExecutions,
      postgresResult: result.postgresResult,
      transactionId: result.transactionId
    })
  );

  if (terminal && result.postgresResult.status !== expectedPostgresStatus(terminal)) {
    errors.push(
      `${result.transactionId} postgres client port status ${result.postgresResult.status} cannot satisfy repository terminal ${terminal}`
    );
  }

  if (result.postgresResult.transactionId !== result.transactionId) {
    errors.push(`${result.transactionId} postgres client port must use the bridge transaction id`);
  }

  if (result.period && result.postgresResult.period !== result.period) {
    errors.push(`${result.transactionId} postgres client port must use the bridge accounting period`);
  }

  return errors;
}

function bridgeStatus<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
  repositoryResult,
  postgresResult,
  traceErrors
}: {
  postgresResult?: PeriodClosePostgresClientPortResult;
  repositoryResult: PeriodCloseDbClientRepositoryResult<T>['repositoryResult'];
  traceErrors: string[];
}): PeriodClosePostgresDbClientRepositoryBridgeStatus {
  if (traceErrors.length > 0) {
    return 'trace_invalid';
  }

  if (!repositoryResult.driverOk) {
    return 'driver_failed';
  }

  if (postgresResult?.status === 'driver_failed') {
    return 'trace_invalid';
  }

  const terminal = terminalFromExecutions(postgresResult?.executions ?? []);

  return terminal ? statusFromTerminal(terminal) : 'trace_invalid';
}

export function createPeriodClosePostgresDbClientRepositoryBridgeContract({
  clientRepository,
  pool
}: {
  clientRepository: PeriodCloseDbClientRepositoryContract;
  pool: PeriodClosePostgresPoolPort;
}): PeriodClosePostgresDbClientRepositoryBridgeContract {
  const bridgeEvents: PeriodClosePostgresDbClientRepositoryBridgeEvent[] = [];
  const postgresClientPort = createPeriodClosePostgresClientPortContract({ pool });

  function record({
    event,
    operation,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresDbClientRepositoryBridgeEvent, 'sequence'>) {
    bridgeEvents.push({
      event,
      operation,
      ...(period ? { period } : {}),
      requestId,
      sequence: bridgeEvents.length + 1,
      transactionId
    });
  }

  function readEvents(transactionId: string) {
    return bridgeEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  async function run<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
    explicitPeriod,
    operation,
    requestId,
    runRepository,
    transactionId
  }: {
    explicitPeriod?: string;
    operation: PeriodCloseDbClientOperation;
    requestId: string;
    runRepository: (transactionId: string) => PeriodCloseDbClientRepositoryResult<T>;
    transactionId: string;
  }): Promise<PeriodClosePostgresDbClientRepositoryBridgeResult<T>> {
    record({ event: 'receive_request', operation, period: explicitPeriod, requestId, transactionId });
    record({ event: 'run_db_client_repository', operation, period: explicitPeriod, requestId, transactionId });

    const clientResult = runRepository(transactionId);
    const period = periodFromTrace({
      clientEvents: clientResult.clientEvents,
      driverExecutions: clientResult.driverExecutions,
      explicitPeriod
    });
    let postgresResult: PeriodClosePostgresClientPortResult | undefined;

    if (clientResult.repositoryResult.driverOk && period) {
      record({ event: 'run_postgres_client_port', operation, period, requestId, transactionId });
      postgresResult = await postgresClientPort.run({
        operation: toRuntimeOperation(operation),
        period,
        requestId,
        statements: clientResult.driverExecutions.map(toStatement),
        transactionId
      });
    }

    const draftResult: PeriodClosePostgresDbClientRepositoryBridgeResult<T> = {
      bridgeEvents: readEvents(transactionId),
      clientEvents: clientResult.clientEvents,
      driverExecutions: clientResult.driverExecutions,
      operation,
      ...(period ? { period } : {}),
      ...(postgresResult ? { postgresResult } : {}),
      repositoryResult: clientResult.repositoryResult,
      requestId,
      status: 'trace_invalid',
      traceErrors: [],
      transactionId
    };

    record({ event: 'validate_bridge_trace', operation, period, requestId, transactionId });
    record({ event: 'return_response', operation, period, requestId, transactionId });

    const resultWithEvents = {
      ...draftResult,
      bridgeEvents: readEvents(transactionId)
    };
    const traceErrors = validatePeriodClosePostgresDbClientRepositoryBridgeTrace(resultWithEvents);

    return {
      ...resultWithEvents,
      status: bridgeStatus({
        postgresResult,
        repositoryResult: clientResult.repositoryResult,
        traceErrors
      }),
      traceErrors
    };
  }

  return {
    closeAccountingPeriod: ({ period, request }) => {
      const transactionId = buildTransactionId({
        operation: 'close_accounting_period',
        requestId: request.requestId
      });

      return run({
        explicitPeriod: period,
        operation: 'close_accounting_period',
        requestId: request.requestId,
        runRepository: (resolvedTransactionId) =>
          clientRepository.closeAccountingPeriod({
            period,
            request,
            transactionId: resolvedTransactionId
          }),
        transactionId
      });
    },
    guardSourceMutation: ({ context, mutation }) => {
      const transactionId = buildTransactionId({
        operation: 'guard_source_mutation',
        requestId: context.requestId
      });

      return run({
        operation: 'guard_source_mutation',
        requestId: context.requestId,
        runRepository: (resolvedTransactionId) =>
          clientRepository.guardSourceMutation({
            context,
            mutation,
            transactionId: resolvedTransactionId
          }),
        transactionId
      });
    },
    readBridgeEvents: () => bridgeEvents.map((event) => ({ ...event }))
  };
}
