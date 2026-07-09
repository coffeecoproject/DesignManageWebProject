import {
  periodCloseTransactionIsolationPolicies,
  type PeriodCloseTransactionIsolationPolicyInput,
  type PeriodCloseTransactionPolicyOperation
} from './periodCloseTransactionIsolationPolicyContract.js';

export type PeriodCloseFormalDbTransactionOutcome = 'committed' | 'driver_failed' | 'rolled_back';

export type PeriodCloseFormalDbTransactionFailureCode =
  | 'connection_lost'
  | 'constraint_violation'
  | 'deadlock_detected'
  | 'lock_timeout'
  | 'serialization_failure'
  | 'unknown';

export type PeriodCloseFormalDbTransactionEventName =
  | 'allocate_transaction_context'
  | 'acquire_connection'
  | 'begin_transaction'
  | 'classify_failure'
  | 'commit_transaction'
  | 'execute_unit_of_work'
  | 'release_connection'
  | 'return_result'
  | 'rollback_transaction'
  | 'set_isolation_level'
  | 'set_lock_timeout';

export type PeriodCloseFormalDbTransactionEvent = {
  connectionLeaseId?: string;
  event: PeriodCloseFormalDbTransactionEventName;
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  isolationLevel?: PeriodCloseTransactionIsolationPolicyInput['isolationLevel'];
  lockTimeoutMs?: number;
  operation: PeriodCloseTransactionPolicyOperation;
  period: string;
  requestId: string;
  retryScope?: 'inside_transaction' | 'outside_transaction' | 'none';
  retryable?: boolean;
  sequence: number;
  transactionId: string;
};

export type PeriodCloseFormalDbTransactionManagerRunInput = {
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  lockTimeoutMs?: number;
  operation: PeriodCloseTransactionPolicyOperation;
  outcome: PeriodCloseFormalDbTransactionOutcome;
  period: string;
  requestId: string;
};

export type PeriodCloseFormalDbTransactionManagerRunResult = {
  events: PeriodCloseFormalDbTransactionEvent[];
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  outcome: PeriodCloseFormalDbTransactionOutcome;
  retryable: boolean;
  transactionId: string;
};

export type PeriodCloseFormalDbTransactionManagerContract = {
  readEvents: () => PeriodCloseFormalDbTransactionEvent[];
  run: (
    input: PeriodCloseFormalDbTransactionManagerRunInput
  ) => PeriodCloseFormalDbTransactionManagerRunResult;
};

const defaultLockTimeoutMs = 5000;

function policyByOperation(
  policies: readonly PeriodCloseTransactionIsolationPolicyInput[],
  operation: PeriodCloseTransactionPolicyOperation
) {
  return policies.find((policy) => policy.operation === operation);
}

function buildTransactionId({ operation, requestId }: { operation: string; requestId: string }) {
  return `${requestId}:${operation}:formal-db-tx`;
}

function buildConnectionLeaseId(transactionId: string) {
  return `${transactionId}:lease`;
}

function isRetryableOutsideTransaction({
  failureCode,
  operation,
  policies
}: {
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  operation: PeriodCloseTransactionPolicyOperation;
  policies: readonly PeriodCloseTransactionIsolationPolicyInput[];
}) {
  if (!failureCode) {
    return false;
  }

  return policyByOperation(policies, operation)?.retryableFailureCodes.includes(failureCode) ?? false;
}

export function createPeriodCloseFormalDbTransactionManagerContract({
  policies = periodCloseTransactionIsolationPolicies
}: {
  policies?: readonly PeriodCloseTransactionIsolationPolicyInput[];
} = {}): PeriodCloseFormalDbTransactionManagerContract {
  const events: PeriodCloseFormalDbTransactionEvent[] = [];

  function record(event: Omit<PeriodCloseFormalDbTransactionEvent, 'sequence'>) {
    events.push({
      ...event,
      sequence: events.length + 1
    });
  }

  function readTransactionEvents(transactionId: string) {
    return events
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  return {
    readEvents: () => events.map((event) => ({ ...event })),
    run: ({ failureCode, lockTimeoutMs = defaultLockTimeoutMs, operation, outcome, period, requestId }) => {
      const policy = policyByOperation(policies, operation);
      const transactionId = buildTransactionId({ operation, requestId });
      const connectionLeaseId = buildConnectionLeaseId(transactionId);
      const baseEvent = {
        connectionLeaseId,
        operation,
        period,
        requestId,
        transactionId
      };

      record({ ...baseEvent, event: 'allocate_transaction_context' });
      record({ ...baseEvent, event: 'acquire_connection' });
      record({ ...baseEvent, event: 'begin_transaction' });
      record({
        ...baseEvent,
        event: 'set_isolation_level',
        isolationLevel: policy?.isolationLevel ?? 'read_committed'
      });
      record({
        ...baseEvent,
        event: 'set_lock_timeout',
        lockTimeoutMs
      });
      record({ ...baseEvent, event: 'execute_unit_of_work' });

      if (outcome === 'committed') {
        record({ ...baseEvent, event: 'commit_transaction' });
      } else {
        record({ ...baseEvent, event: 'rollback_transaction' });
      }

      record({ ...baseEvent, event: 'release_connection' });

      const retryable = isRetryableOutsideTransaction({ failureCode, operation, policies });

      if (outcome === 'driver_failed') {
        record({
          ...baseEvent,
          event: 'classify_failure',
          failureCode: failureCode ?? 'unknown',
          retryScope: retryable ? 'outside_transaction' : 'none',
          retryable
        });
      }

      record({
        ...baseEvent,
        event: 'return_result',
        ...(failureCode ? { failureCode } : {}),
        retryScope: retryable ? 'outside_transaction' : 'none',
        retryable
      });

      return {
        events: readTransactionEvents(transactionId),
        ...(failureCode ? { failureCode } : {}),
        outcome,
        retryable,
        transactionId
      };
    }
  };
}

function indexOfEvent(
  events: readonly PeriodCloseFormalDbTransactionEvent[],
  name: PeriodCloseFormalDbTransactionEventName
) {
  return events.findIndex((event) => event.event === name);
}

function hasExactlyOneTerminal(events: readonly PeriodCloseFormalDbTransactionEvent[]) {
  const terminalCount = events.filter(
    (event) => event.event === 'commit_transaction' || event.event === 'rollback_transaction'
  ).length;

  return terminalCount === 1;
}

export function validatePeriodCloseFormalDbTransactionManagerTrace({
  events,
  policies = periodCloseTransactionIsolationPolicies
}: {
  events: readonly PeriodCloseFormalDbTransactionEvent[];
  policies?: readonly PeriodCloseTransactionIsolationPolicyInput[];
}): string[] {
  const errors: string[] = [];
  const transactionIds = [...new Set(events.map((event) => event.transactionId))];

  for (const transactionId of transactionIds) {
    const transactionEvents = events
      .filter((event) => event.transactionId === transactionId)
      .sort((left, right) => left.sequence - right.sequence);
    const firstEvent = transactionEvents[0];
    const policy = firstEvent ? policyByOperation(policies, firstEvent.operation) : undefined;
    const allocateIndex = indexOfEvent(transactionEvents, 'allocate_transaction_context');
    const acquireIndex = indexOfEvent(transactionEvents, 'acquire_connection');
    const beginIndex = indexOfEvent(transactionEvents, 'begin_transaction');
    const isolationIndex = indexOfEvent(transactionEvents, 'set_isolation_level');
    const lockTimeoutIndex = indexOfEvent(transactionEvents, 'set_lock_timeout');
    const executeIndex = indexOfEvent(transactionEvents, 'execute_unit_of_work');
    const commitIndex = indexOfEvent(transactionEvents, 'commit_transaction');
    const rollbackIndex = indexOfEvent(transactionEvents, 'rollback_transaction');
    const releaseIndex = indexOfEvent(transactionEvents, 'release_connection');
    const classifyIndex = indexOfEvent(transactionEvents, 'classify_failure');
    const returnIndex = indexOfEvent(transactionEvents, 'return_result');
    const terminalIndex = Math.max(commitIndex, rollbackIndex);

    if (!firstEvent || !policy) {
      errors.push(`${transactionId} must reference a known period-close isolation policy operation`);
      continue;
    }

    if (allocateIndex !== 0) {
      errors.push(`${transactionId} must allocate a transaction context first`);
    }

    if (acquireIndex <= allocateIndex) {
      errors.push(`${transactionId} must acquire a DB connection after transaction context allocation`);
    }

    if (beginIndex <= acquireIndex) {
      errors.push(`${transactionId} must begin a transaction after acquiring the DB connection`);
    }

    if (isolationIndex <= beginIndex || isolationIndex >= executeIndex) {
      errors.push(`${transactionId} must set isolation before executing the unit of work`);
    }

    if (lockTimeoutIndex <= beginIndex || lockTimeoutIndex >= executeIndex) {
      errors.push(`${transactionId} must set lock timeout before executing the unit of work`);
    }

    if (!transactionEvents.some((event) => event.event === 'set_isolation_level' && event.isolationLevel === policy.isolationLevel)) {
      errors.push(`${transactionId} must use the operation isolation policy`);
    }

    if (!transactionEvents.some((event) => event.event === 'set_lock_timeout' && Number(event.lockTimeoutMs) > 0)) {
      errors.push(`${transactionId} must configure a positive lock timeout`);
    }

    if (!hasExactlyOneTerminal(transactionEvents)) {
      errors.push(`${transactionId} must have exactly one commit or rollback terminal event`);
    }

    if (terminalIndex <= executeIndex) {
      errors.push(`${transactionId} must terminate after executing the unit of work`);
    }

    if (releaseIndex <= terminalIndex || releaseIndex >= returnIndex) {
      errors.push(`${transactionId} must release the connection after terminal event and before returning`);
    }

    if (returnIndex !== transactionEvents.length - 1) {
      errors.push(`${transactionId} must return only after connection release and optional failure classification`);
    }

    const leaseIds = new Set(transactionEvents.map((event) => event.connectionLeaseId).filter(Boolean));

    if (leaseIds.size !== 1) {
      errors.push(`${transactionId} must use one connection lease for the whole transaction`);
    }

    for (const event of transactionEvents) {
      if (event.retryScope === 'inside_transaction') {
        errors.push(`${transactionId} must not retry or classify retries inside an open transaction`);
      }
    }

    if (classifyIndex !== -1) {
      const classifyEvent = transactionEvents[classifyIndex];

      if (rollbackIndex === -1) {
        errors.push(`${transactionId} must rollback before classifying a driver failure`);
      }

      if (classifyIndex <= releaseIndex) {
        errors.push(`${transactionId} must classify retryability after releasing the DB connection`);
      }

      if (
        classifyEvent.retryable === true &&
        (!classifyEvent.failureCode || !policy.retryableFailureCodes.includes(classifyEvent.failureCode))
      ) {
        errors.push(`${transactionId} must only mark policy retryable failures as retryable`);
      }

      if (classifyEvent.retryable === true && classifyEvent.retryScope !== 'outside_transaction') {
        errors.push(`${transactionId} must classify retryable failures outside the transaction`);
      }
    }
  }

  return errors;
}
