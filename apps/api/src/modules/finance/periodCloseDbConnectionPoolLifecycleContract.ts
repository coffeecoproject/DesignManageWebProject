import {
  periodCloseTransactionIsolationPolicies,
  type PeriodCloseTransactionIsolationPolicyInput,
  type PeriodCloseTransactionPolicyOperation
} from './periodCloseTransactionIsolationPolicyContract.js';
import type {
  PeriodCloseFormalDbTransactionFailureCode,
  PeriodCloseFormalDbTransactionOutcome
} from './periodCloseFormalDbTransactionManagerContract.js';

export type PeriodCloseDbConnectionPoolEventName =
  | 'begin_transaction'
  | 'checkout_connection'
  | 'commit_transaction'
  | 'execute_unit_of_work'
  | 'initialize_pool'
  | 'reject_checkout'
  | 'release_connection'
  | 'return_result'
  | 'rollback_transaction'
  | 'set_isolation_level'
  | 'set_lock_timeout';

export type PeriodCloseDbConnectionPoolLeasePurpose = 'reservation' | 'transaction';

export type PeriodCloseDbConnectionPoolEvent = {
  acquireTimeoutMs: number;
  activeLeases: number;
  connectionId?: string;
  event: PeriodCloseDbConnectionPoolEventName;
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  isolationLevel?: PeriodCloseTransactionIsolationPolicyInput['isolationLevel'];
  leaseId?: string;
  leasePurpose?: PeriodCloseDbConnectionPoolLeasePurpose;
  lockTimeoutMs?: number;
  maxConnections: number;
  operation?: PeriodCloseTransactionPolicyOperation;
  outcome?: PeriodCloseFormalDbTransactionOutcome | 'pool_exhausted';
  period?: string;
  poolId: string;
  requestId?: string;
  retryable?: boolean;
  sequence: number;
  transactionId?: string;
};

export type PeriodCloseDbConnectionPoolRunInput = {
  failureCode?: PeriodCloseFormalDbTransactionFailureCode;
  lockTimeoutMs?: number;
  operation: PeriodCloseTransactionPolicyOperation;
  outcome: PeriodCloseFormalDbTransactionOutcome;
  period: string;
  requestId: string;
};

export type PeriodCloseDbConnectionPoolTransactionResult =
  | {
      events: PeriodCloseDbConnectionPoolEvent[];
      leaseId: string;
      ok: true;
      outcome: PeriodCloseFormalDbTransactionOutcome;
      transactionId: string;
    }
  | {
      events: PeriodCloseDbConnectionPoolEvent[];
      ok: false;
      outcome: 'pool_exhausted';
      retryable: true;
      transactionId: string;
    };

export type PeriodCloseDbConnectionPoolReservationResult =
  | {
      connectionId: string;
      events: PeriodCloseDbConnectionPoolEvent[];
      leaseId: string;
      ok: true;
    }
  | {
      events: PeriodCloseDbConnectionPoolEvent[];
      ok: false;
      outcome: 'pool_exhausted';
      retryable: true;
      transactionId: string;
    };

export type PeriodCloseDbConnectionPoolLifecycleContract = {
  readEvents: () => PeriodCloseDbConnectionPoolEvent[];
  releaseReservedConnection: (input: { leaseId: string; requestId: string }) => PeriodCloseDbConnectionPoolEvent[];
  reserveConnection: (input: {
    operation: PeriodCloseTransactionPolicyOperation;
    period: string;
    requestId: string;
  }) => PeriodCloseDbConnectionPoolReservationResult;
  runTransaction: (input: PeriodCloseDbConnectionPoolRunInput) => PeriodCloseDbConnectionPoolTransactionResult;
};

const defaultAcquireTimeoutMs = 1000;
const defaultLockTimeoutMs = 5000;

function policyByOperation(
  policies: readonly PeriodCloseTransactionIsolationPolicyInput[],
  operation: PeriodCloseTransactionPolicyOperation
) {
  return policies.find((policy) => policy.operation === operation);
}

function buildTransactionId({ operation, requestId }: { operation: string; requestId: string }) {
  return `${requestId}:${operation}:pool-tx`;
}

function buildLeaseId({ purpose, transactionId }: { purpose: PeriodCloseDbConnectionPoolLeasePurpose; transactionId: string }) {
  return `${transactionId}:${purpose}:lease`;
}

function buildConnectionId({ index, poolId }: { index: number; poolId: string }) {
  return `${poolId}:connection-${index + 1}`;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function sortBySequence(events: readonly PeriodCloseDbConnectionPoolEvent[]) {
  return [...events].sort((left, right) => left.sequence - right.sequence);
}

export function createPeriodCloseDbConnectionPoolLifecycleContract({
  acquireTimeoutMs = defaultAcquireTimeoutMs,
  maxConnections = 4,
  policies = periodCloseTransactionIsolationPolicies,
  poolId = 'period-close-db-pool'
}: {
  acquireTimeoutMs?: number;
  maxConnections?: number;
  policies?: readonly PeriodCloseTransactionIsolationPolicyInput[];
  poolId?: string;
} = {}): PeriodCloseDbConnectionPoolLifecycleContract {
  const events: PeriodCloseDbConnectionPoolEvent[] = [];
  const activeLeases = new Map<string, { connectionId: string; leasePurpose: PeriodCloseDbConnectionPoolLeasePurpose }>();

  function record(event: Omit<PeriodCloseDbConnectionPoolEvent, 'sequence'>) {
    events.push({
      ...event,
      sequence: events.length + 1
    });
  }

  function baseEvent() {
    return {
      acquireTimeoutMs,
      activeLeases: activeLeases.size,
      maxConnections,
      poolId
    };
  }

  function readRequestEvents(requestId: string) {
    return events.filter((event) => event.requestId === requestId).map((event) => ({ ...event }));
  }

  function findAvailableConnectionId() {
    const activeConnectionIds = new Set([...activeLeases.values()].map((lease) => lease.connectionId));

    for (let index = 0; index < maxConnections; index += 1) {
      const connectionId = buildConnectionId({ index, poolId });

      if (!activeConnectionIds.has(connectionId)) {
        return connectionId;
      }
    }

    return undefined;
  }

  function checkout({
    leasePurpose,
    operation,
    period,
    requestId,
    transactionId
  }: {
    leasePurpose: PeriodCloseDbConnectionPoolLeasePurpose;
    operation: PeriodCloseTransactionPolicyOperation;
    period: string;
    requestId: string;
    transactionId: string;
  }) {
    if (activeLeases.size >= maxConnections) {
      record({
        ...baseEvent(),
        event: 'reject_checkout',
        operation,
        outcome: 'pool_exhausted',
        period,
        requestId,
        retryable: true,
        transactionId
      });
      record({
        ...baseEvent(),
        event: 'return_result',
        operation,
        outcome: 'pool_exhausted',
        period,
        requestId,
        retryable: true,
        transactionId
      });

      return undefined;
    }

    const connectionId = findAvailableConnectionId();

    if (!connectionId) {
      record({
        ...baseEvent(),
        event: 'reject_checkout',
        operation,
        outcome: 'pool_exhausted',
        period,
        requestId,
        retryable: true,
        transactionId
      });
      record({
        ...baseEvent(),
        event: 'return_result',
        operation,
        outcome: 'pool_exhausted',
        period,
        requestId,
        retryable: true,
        transactionId
      });

      return undefined;
    }

    const leaseId = buildLeaseId({ purpose: leasePurpose, transactionId });

    activeLeases.set(leaseId, { connectionId, leasePurpose });
    record({
      ...baseEvent(),
      connectionId,
      event: 'checkout_connection',
      leaseId,
      leasePurpose,
      operation,
      period,
      requestId,
      transactionId
    });

    return { connectionId, leaseId };
  }

  function release({
    leaseId,
    operation,
    outcome,
    period,
    requestId,
    transactionId
  }: {
    leaseId: string;
    operation?: PeriodCloseTransactionPolicyOperation;
    outcome?: PeriodCloseFormalDbTransactionOutcome;
    period?: string;
    requestId: string;
    transactionId?: string;
  }) {
    const lease = activeLeases.get(leaseId);

    activeLeases.delete(leaseId);
    record({
      ...baseEvent(),
      ...(lease?.connectionId ? { connectionId: lease.connectionId } : {}),
      event: 'release_connection',
      leaseId,
      ...(lease?.leasePurpose ? { leasePurpose: lease.leasePurpose } : {}),
      ...(operation ? { operation } : {}),
      ...(outcome ? { outcome } : {}),
      ...(period ? { period } : {}),
      requestId,
      ...(transactionId ? { transactionId } : {})
    });
  }

  record({
    acquireTimeoutMs,
    activeLeases: 0,
    event: 'initialize_pool',
    maxConnections,
    poolId
  });

  return {
    readEvents: () => events.map((event) => ({ ...event })),
    releaseReservedConnection: ({ leaseId, requestId }) => {
      release({ leaseId, requestId });

      return readRequestEvents(requestId);
    },
    reserveConnection: ({ operation, period, requestId }) => {
      const transactionId = `${requestId}:${operation}:pool-reservation`;
      const lease = checkout({ leasePurpose: 'reservation', operation, period, requestId, transactionId });

      if (!lease) {
        return {
          events: readRequestEvents(requestId),
          ok: false,
          outcome: 'pool_exhausted',
          retryable: true,
          transactionId
        };
      }

      return {
        connectionId: lease.connectionId,
        events: readRequestEvents(requestId),
        leaseId: lease.leaseId,
        ok: true
      };
    },
    runTransaction: ({ failureCode, lockTimeoutMs = defaultLockTimeoutMs, operation, outcome, period, requestId }) => {
      const transactionId = buildTransactionId({ operation, requestId });
      const lease = checkout({ leasePurpose: 'transaction', operation, period, requestId, transactionId });
      const policy = policyByOperation(policies, operation);

      if (!lease) {
        return {
          events: readRequestEvents(requestId),
          ok: false,
          outcome: 'pool_exhausted',
          retryable: true,
          transactionId
        };
      }

      const txEvent = {
        connectionId: lease.connectionId,
        leaseId: lease.leaseId,
        leasePurpose: 'transaction' as const,
        operation,
        period,
        requestId,
        transactionId
      };

      record({ ...baseEvent(), ...txEvent, event: 'begin_transaction' });
      record({
        ...baseEvent(),
        ...txEvent,
        event: 'set_isolation_level',
        isolationLevel: policy?.isolationLevel ?? 'read_committed'
      });
      record({ ...baseEvent(), ...txEvent, event: 'set_lock_timeout', lockTimeoutMs });
      record({ ...baseEvent(), ...txEvent, event: 'execute_unit_of_work' });
      record({
        ...baseEvent(),
        ...txEvent,
        event: outcome === 'committed' ? 'commit_transaction' : 'rollback_transaction',
        ...(failureCode ? { failureCode } : {}),
        outcome
      });
      release({ leaseId: lease.leaseId, operation, outcome, period, requestId, transactionId });
      record({
        ...baseEvent(),
        ...txEvent,
        event: 'return_result',
        ...(failureCode ? { failureCode } : {}),
        outcome
      });

      return {
        events: readRequestEvents(requestId),
        leaseId: lease.leaseId,
        ok: true,
        outcome,
        transactionId
      };
    }
  };
}

function eventIndex(events: readonly PeriodCloseDbConnectionPoolEvent[], eventName: PeriodCloseDbConnectionPoolEventName) {
  return events.findIndex((event) => event.event === eventName);
}

function validatePoolConfiguration(events: readonly PeriodCloseDbConnectionPoolEvent[], errors: string[]) {
  const initializeEvents = events.filter((event) => event.event === 'initialize_pool');
  const firstEvent = events[0];

  if (initializeEvents.length !== 1 || firstEvent?.event !== 'initialize_pool') {
    errors.push('connection pool must be initialized exactly once before use');
  }

  if (firstEvent && firstEvent.maxConnections < 1) {
    errors.push('connection pool maxConnections must be positive');
  }

  if (firstEvent && firstEvent.acquireTimeoutMs < 1) {
    errors.push('connection pool acquireTimeoutMs must be positive');
  }
}

function validateLeaseAccounting(events: readonly PeriodCloseDbConnectionPoolEvent[], errors: string[]) {
  const activeLeases = new Set<string>();

  for (const event of sortBySequence(events)) {
    if (event.event === 'checkout_connection') {
      if (!event.leaseId || !event.connectionId) {
        errors.push(`${event.requestId ?? event.sequence} checkout must include lease and connection ids`);
        continue;
      }

      if (activeLeases.size >= event.maxConnections) {
        errors.push(`${event.requestId ?? event.sequence} checkout must not exceed pool maxConnections`);
      }

      if (activeLeases.has(event.leaseId)) {
        errors.push(`${event.leaseId} must not be checked out twice before release`);
      }

      activeLeases.add(event.leaseId);
    }

    if (event.event === 'release_connection') {
      if (!event.leaseId || !activeLeases.has(event.leaseId)) {
        errors.push(`${event.requestId ?? event.sequence} must release a known active connection lease`);
      } else {
        activeLeases.delete(event.leaseId);
      }
    }
  }

  if (activeLeases.size > 0) {
    errors.push(`connection pool must not leak active leases: ${[...activeLeases].join(', ')}`);
  }
}

function validateTransactionLifecycle({
  events,
  policies
}: {
  events: readonly PeriodCloseDbConnectionPoolEvent[];
  policies: readonly PeriodCloseTransactionIsolationPolicyInput[];
}) {
  const errors: string[] = [];
  const transactionIds = unique(events.map((event) => event.transactionId).filter(Boolean) as string[]);

  for (const transactionId of transactionIds) {
    const transactionEvents = sortBySequence(events.filter((event) => event.transactionId === transactionId));
    const checkoutIndex = eventIndex(transactionEvents, 'checkout_connection');
    const rejectIndex = eventIndex(transactionEvents, 'reject_checkout');
    const beginIndex = eventIndex(transactionEvents, 'begin_transaction');
    const isolationIndex = eventIndex(transactionEvents, 'set_isolation_level');
    const lockTimeoutIndex = eventIndex(transactionEvents, 'set_lock_timeout');
    const executeIndex = eventIndex(transactionEvents, 'execute_unit_of_work');
    const commitIndex = eventIndex(transactionEvents, 'commit_transaction');
    const rollbackIndex = eventIndex(transactionEvents, 'rollback_transaction');
    const releaseIndex = eventIndex(transactionEvents, 'release_connection');
    const returnIndex = eventIndex(transactionEvents, 'return_result');
    const transactionWorkEvents = transactionEvents.filter((event) => event.leasePurpose === 'transaction');
    const firstWorkEvent = transactionWorkEvents[0];
    const policy = firstWorkEvent?.operation ? policyByOperation(policies, firstWorkEvent.operation) : undefined;

    if (rejectIndex !== -1) {
      if (beginIndex !== -1 || executeIndex !== -1 || commitIndex !== -1 || rollbackIndex !== -1) {
        errors.push(`${transactionId} rejected checkout must not begin or execute a transaction`);
      }

      if (returnIndex <= rejectIndex) {
        errors.push(`${transactionId} rejected checkout must return a result after rejection`);
      }

      continue;
    }

    if (!firstWorkEvent) {
      continue;
    }

    if (!policy) {
      errors.push(`${transactionId} must reference a known period-close isolation policy operation`);
      continue;
    }

    if (checkoutIndex === -1 || beginIndex <= checkoutIndex) {
      errors.push(`${transactionId} must begin only after checking out a DB connection`);
    }

    if (isolationIndex <= beginIndex || isolationIndex >= executeIndex) {
      errors.push(`${transactionId} must set isolation before executing unit of work`);
    }

    if (lockTimeoutIndex <= beginIndex || lockTimeoutIndex >= executeIndex) {
      errors.push(`${transactionId} must set lock timeout before executing unit of work`);
    }

    if (!transactionEvents.some((event) => event.event === 'set_isolation_level' && event.isolationLevel === policy.isolationLevel)) {
      errors.push(`${transactionId} must use the operation isolation policy`);
    }

    if (!transactionEvents.some((event) => event.event === 'set_lock_timeout' && Number(event.lockTimeoutMs) > 0)) {
      errors.push(`${transactionId} must configure positive lock timeout`);
    }

    if ((commitIndex === -1 && rollbackIndex === -1) || (commitIndex !== -1 && rollbackIndex !== -1)) {
      errors.push(`${transactionId} must have exactly one transaction terminal event`);
    }

    if (Math.max(commitIndex, rollbackIndex) <= executeIndex) {
      errors.push(`${transactionId} must terminate after executing unit of work`);
    }

    if (releaseIndex <= Math.max(commitIndex, rollbackIndex) || releaseIndex >= returnIndex) {
      errors.push(`${transactionId} must release the connection after terminal event and before returning`);
    }

    const leaseIds = unique(transactionWorkEvents.map((event) => event.leaseId).filter(Boolean) as string[]);
    const connectionIds = unique(transactionWorkEvents.map((event) => event.connectionId).filter(Boolean) as string[]);

    if (leaseIds.length !== 1) {
      errors.push(`${transactionId} must use one lease throughout the transaction`);
    }

    if (connectionIds.length !== 1) {
      errors.push(`${transactionId} must use one connection throughout the transaction`);
    }
  }

  return errors;
}

export function validatePeriodCloseDbConnectionPoolLifecycleTrace({
  events,
  policies = periodCloseTransactionIsolationPolicies
}: {
  events: readonly PeriodCloseDbConnectionPoolEvent[];
  policies?: readonly PeriodCloseTransactionIsolationPolicyInput[];
}): string[] {
  const orderedEvents = sortBySequence(events);
  const errors: string[] = [];

  validatePoolConfiguration(orderedEvents, errors);
  validateLeaseAccounting(orderedEvents, errors);
  errors.push(...validateTransactionLifecycle({ events: orderedEvents, policies }));

  return errors;
}
