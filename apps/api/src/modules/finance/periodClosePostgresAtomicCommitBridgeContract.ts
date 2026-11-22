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

export type PeriodClosePostgresAtomicCommitBridgeStatus =
  | 'committed'
  | 'driver_failed'
  | 'rolled_back'
  | 'trace_invalid';

export type PeriodClosePostgresAtomicCommitBridgeEventName =
  | 'receive_request'
  | 'create_staged_unit_of_work'
  | 'run_staged_db_client_repository'
  | 'run_postgres_client_port'
  | 'validate_atomic_commit_trace'
  | 'commit_staged_unit_of_work'
  | 'rollback_staged_unit_of_work'
  | 'return_response';

export type PeriodClosePostgresAtomicCommitBridgeEvent = {
  event: PeriodClosePostgresAtomicCommitBridgeEventName;
  operation: PeriodCloseDbClientOperation;
  period?: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresAtomicCommitUnitOfWork = {
  clientRepository: PeriodCloseDbClientRepositoryContract;
  commit: () => void;
  rollback: () => void;
};

export type PeriodClosePostgresAtomicCommitBridgeResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  atomicEvents: PeriodClosePostgresAtomicCommitBridgeEvent[];
  clientEvents: PeriodCloseDbClientEvent[];
  driverExecutions: PeriodCloseSqlDriverExecution[];
  operation: PeriodCloseDbClientOperation;
  period?: string;
  postgresResult?: PeriodClosePostgresClientPortResult;
  repositoryResult: PeriodCloseDbClientRepositoryResult<T>['repositoryResult'];
  requestId: string;
  status: PeriodClosePostgresAtomicCommitBridgeStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresAtomicCommitBridgeContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => Promise<PeriodClosePostgresAtomicCommitBridgeResult<PersistentCloseAccountingPeriodResult>>;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => Promise<PeriodClosePostgresAtomicCommitBridgeResult<PersistentSourceMutationResult>>;
  readAtomicEvents: () => PeriodClosePostgresAtomicCommitBridgeEvent[];
};

function buildTransactionId({
  operation,
  requestId
}: {
  operation: PeriodCloseDbClientOperation;
  requestId: string;
}) {
  return `${requestId}:${operation}:pg-atomic-commit`;
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

function statusFromTerminal(terminal: 'commit' | 'rollback'): PeriodClosePostgresAtomicCommitBridgeStatus {
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
    errors.push(`${transactionId} postgres atomic bridge must execute the same number of staged SQL statements`);
  }

  for (let index = 0; index < Math.min(driverExecutions.length, postgresResult.executions.length); index += 1) {
    const driverExecution = driverExecutions[index];
    const postgresExecution = postgresResult.executions[index];

    if (!driverExecution || !postgresExecution) {
      continue;
    }

    if (driverExecution.name !== postgresExecution.name || driverExecution.sql !== postgresExecution.sql) {
      errors.push(`${transactionId} postgres atomic bridge statement ${index + 1} must match staged SQL execution`);
    }

    if (JSON.stringify(driverExecution.parameters) !== JSON.stringify(postgresExecution.parameters)) {
      errors.push(`${transactionId} postgres atomic bridge parameters ${index + 1} must match staged SQL execution`);
    }
  }

  return errors;
}

function validateRuntimeTrace<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
>(
  result: PeriodClosePostgresAtomicCommitBridgeResult<T>
) {
  const errors = [
    ...validatePeriodCloseDbClientRepositoryTrace({
      clientEvents: result.clientEvents,
      driverExecutions: result.driverExecutions
    })
  ];

  if (!result.repositoryResult.driverOk) {
    if (result.postgresResult) {
      errors.push(`${result.transactionId} failed staged SQL plans must not run the postgres client port`);
    }

    return errors;
  }

  const terminal = terminalFromExecutions(result.driverExecutions);

  if (!terminal) {
    errors.push(`${result.transactionId} staged SQL plan must end in COMMIT or ROLLBACK`);
  }

  if (!result.postgresResult) {
    errors.push(`${result.transactionId} successful staged SQL plan must run through postgres client port`);

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
      `${result.transactionId} postgres client port status ${result.postgresResult.status} cannot satisfy staged terminal ${terminal}`
    );
  }

  if (result.postgresResult.transactionId !== result.transactionId) {
    errors.push(`${result.transactionId} postgres client port must use the atomic bridge transaction id`);
  }

  if (result.period && result.postgresResult.period !== result.period) {
    errors.push(`${result.transactionId} postgres client port must use the atomic bridge accounting period`);
  }

  return errors;
}

export function validatePeriodClosePostgresAtomicCommitBridgeTrace<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
>(
  result: PeriodClosePostgresAtomicCommitBridgeResult<T>
): string[] {
  const errors = validateRuntimeTrace(result);
  const atomicEvents = result.atomicEvents.slice().sort((left, right) => left.sequence - right.sequence);
  const eventNames = atomicEvents.map((event) => event.event);
  const receiveIndex = eventNames.indexOf('receive_request');
  const createIndex = eventNames.indexOf('create_staged_unit_of_work');
  const runIndex = eventNames.indexOf('run_staged_db_client_repository');
  const validateIndex = eventNames.indexOf('validate_atomic_commit_trace');
  const commitIndex = eventNames.indexOf('commit_staged_unit_of_work');
  const rollbackIndex = eventNames.indexOf('rollback_staged_unit_of_work');
  const returnIndex = eventNames.indexOf('return_response');
  const decisionIndex = Math.max(commitIndex, rollbackIndex);

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres atomic bridge must receive request first`);
  }

  if (createIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres atomic bridge must create a staged unit of work after request`);
  }

  if (runIndex <= createIndex) {
    errors.push(`${result.transactionId} postgres atomic bridge must run staged repository after unit of work creation`);
  }

  if (validateIndex <= runIndex) {
    errors.push(`${result.transactionId} postgres atomic bridge must validate before publishing staged state`);
  }

  if ((commitIndex === -1 && rollbackIndex === -1) || (commitIndex !== -1 && rollbackIndex !== -1)) {
    errors.push(`${result.transactionId} postgres atomic bridge must publish exactly one staged decision`);
  }

  if (decisionIndex <= validateIndex) {
    errors.push(`${result.transactionId} postgres atomic bridge must decide staged commit or rollback after validation`);
  }

  if (returnIndex !== atomicEvents.length - 1 || returnIndex <= decisionIndex) {
    errors.push(`${result.transactionId} postgres atomic bridge must return after the staged decision`);
  }

  if (result.status === 'committed' && commitIndex === -1) {
    errors.push(`${result.transactionId} committed atomic bridge results must commit staged state`);
  }

  if (result.status !== 'committed' && rollbackIndex === -1) {
    errors.push(`${result.transactionId} non-committed atomic bridge results must roll back staged state`);
  }

  if (atomicEvents.some((event) => event.operation !== result.operation)) {
    errors.push(`${result.transactionId} postgres atomic bridge events must keep one operation`);
  }

  if (atomicEvents.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres atomic bridge events must keep one request id`);
  }

  return errors;
}

function preliminaryStatus<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
  repositoryResult,
  postgresResult,
  runtimeErrors
}: {
  postgresResult?: PeriodClosePostgresClientPortResult;
  repositoryResult: PeriodCloseDbClientRepositoryResult<T>['repositoryResult'];
  runtimeErrors: string[];
}): PeriodClosePostgresAtomicCommitBridgeStatus {
  if (runtimeErrors.length > 0) {
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

export function createPeriodClosePostgresAtomicCommitBridgeContract({
  createUnitOfWork,
  pool
}: {
  createUnitOfWork: () => PeriodClosePostgresAtomicCommitUnitOfWork;
  pool: PeriodClosePostgresPoolPort;
}): PeriodClosePostgresAtomicCommitBridgeContract {
  const atomicEvents: PeriodClosePostgresAtomicCommitBridgeEvent[] = [];
  const postgresClientPort = createPeriodClosePostgresClientPortContract({ pool });

  function record({
    event,
    operation,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresAtomicCommitBridgeEvent, 'sequence'>) {
    atomicEvents.push({
      event,
      operation,
      ...(period ? { period } : {}),
      requestId,
      sequence: atomicEvents.length + 1,
      transactionId
    });
  }

  function readEvents(transactionId: string) {
    return atomicEvents
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
    runRepository: (
      clientRepository: PeriodCloseDbClientRepositoryContract,
      transactionId: string
    ) => PeriodCloseDbClientRepositoryResult<T>;
    transactionId: string;
  }): Promise<PeriodClosePostgresAtomicCommitBridgeResult<T>> {
    record({ event: 'receive_request', operation, period: explicitPeriod, requestId, transactionId });
    record({ event: 'create_staged_unit_of_work', operation, period: explicitPeriod, requestId, transactionId });

    const unitOfWork = createUnitOfWork();

    record({ event: 'run_staged_db_client_repository', operation, period: explicitPeriod, requestId, transactionId });

    const clientResult = runRepository(unitOfWork.clientRepository, transactionId);
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

    const draftResult: PeriodClosePostgresAtomicCommitBridgeResult<T> = {
      atomicEvents: readEvents(transactionId),
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
    const runtimeErrors = validateRuntimeTrace(draftResult);
    const stagedStatus = preliminaryStatus({
      postgresResult,
      repositoryResult: clientResult.repositoryResult,
      runtimeErrors
    });

    record({ event: 'validate_atomic_commit_trace', operation, period, requestId, transactionId });
    record({
      event: stagedStatus === 'committed' ? 'commit_staged_unit_of_work' : 'rollback_staged_unit_of_work',
      operation,
      period,
      requestId,
      transactionId
    });
    record({ event: 'return_response', operation, period, requestId, transactionId });

    const resultWithEvents = {
      ...draftResult,
      atomicEvents: readEvents(transactionId),
      status: stagedStatus
    };
    const traceErrors = validatePeriodClosePostgresAtomicCommitBridgeTrace(resultWithEvents);
    const finalStatus = traceErrors.length > 0 ? 'trace_invalid' : stagedStatus;

    if (finalStatus === 'committed') {
      unitOfWork.commit();
    } else {
      unitOfWork.rollback();
    }

    return {
      ...resultWithEvents,
      status: finalStatus,
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
        runRepository: (clientRepository, resolvedTransactionId) =>
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
        runRepository: (clientRepository, resolvedTransactionId) =>
          clientRepository.guardSourceMutation({
            context,
            mutation,
            transactionId: resolvedTransactionId
          }),
        transactionId
      });
    },
    readAtomicEvents: () => atomicEvents.map((event) => ({ ...event }))
  };
}
