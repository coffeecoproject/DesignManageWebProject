import {
  createPeriodCloseFormalDbTransactionManagerContract,
  validatePeriodCloseFormalDbTransactionManagerTrace,
  type PeriodCloseFormalDbTransactionEvent
} from './periodCloseFormalDbTransactionManagerContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function cloneEvents(events: readonly PeriodCloseFormalDbTransactionEvent[]) {
  return events.map((event) => ({ ...event }));
}

const tests: UnitTest[] = [
  {
    name: 'records a formal transaction-manager trace for committed period-close operations',
    run: () => {
      const manager = createPeriodCloseFormalDbTransactionManagerContract();
      const result = manager.run({
        operation: 'close_or_reopen_accounting_period',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-formal-db-tx-001'
      });
      const errors = validatePeriodCloseFormalDbTransactionManagerTrace({ events: result.events });
      const eventNames = result.events.map((event) => event.event);

      assertEqual(errors.length, 0, `transaction-manager trace should validate: ${errors.join('; ')}`);
      assertEqual(result.outcome, 'committed', 'committed transaction should return committed outcome');
      assertEqual(result.retryable, false, 'committed transaction should not be retryable');
      assertEqual(eventNames[0], 'allocate_transaction_context', 'transaction context should be first');
      assert(eventNames.includes('acquire_connection'), 'manager should acquire a connection');
      assert(eventNames.includes('begin_transaction'), 'manager should begin a transaction');
      assert(eventNames.includes('set_isolation_level'), 'manager should set isolation level');
      assert(eventNames.includes('set_lock_timeout'), 'manager should set lock timeout');
      assert(eventNames.includes('execute_unit_of_work'), 'manager should execute a unit of work');
      assert(eventNames.includes('commit_transaction'), 'manager should commit successful work');
      assertEqual(eventNames.at(-1), 'return_result', 'manager should return only after cleanup');
    }
  },
  {
    name: 'classifies lock failures as retryable only after rollback and connection release',
    run: () => {
      const manager = createPeriodCloseFormalDbTransactionManagerContract();
      const result = manager.run({
        failureCode: 'lock_timeout',
        operation: 'closed_period_source_mutation_guard',
        outcome: 'driver_failed',
        period: '2026-06',
        requestId: 'req-formal-db-tx-002'
      });
      const errors = validatePeriodCloseFormalDbTransactionManagerTrace({ events: result.events });
      const eventNames = result.events.map((event) => event.event);
      const rollbackIndex = eventNames.indexOf('rollback_transaction');
      const releaseIndex = eventNames.indexOf('release_connection');
      const classifyIndex = eventNames.indexOf('classify_failure');
      const classifyEvent = result.events[classifyIndex];

      assertEqual(errors.length, 0, `lock failure trace should validate: ${errors.join('; ')}`);
      assertEqual(result.outcome, 'driver_failed', 'driver failure should return driver_failed outcome');
      assertEqual(result.retryable, true, 'lock timeout should be retryable outside the transaction');
      assert(rollbackIndex !== -1, 'driver failure should roll back');
      assert(releaseIndex > rollbackIndex, 'connection should be released after rollback');
      assert(classifyIndex > releaseIndex, 'retryability should be classified after connection release');
      assertEqual(classifyEvent.retryScope, 'outside_transaction', 'retry scope should be outside the transaction');
      assertEqual(classifyEvent.failureCode, 'lock_timeout', 'failure code should be recorded');
    }
  },
  {
    name: 'rejects traces that execute before isolation and lock timeout are configured',
    run: () => {
      const manager = createPeriodCloseFormalDbTransactionManagerContract();
      const result = manager.run({
        operation: 'financial_statement_snapshot_after_close',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-formal-db-tx-003'
      });
      const brokenEvents = cloneEvents(result.events).filter(
        (event) => event.event !== 'set_isolation_level' && event.event !== 'set_lock_timeout'
      );
      const errors = validatePeriodCloseFormalDbTransactionManagerTrace({ events: brokenEvents });

      assert(
        errors.some((error) => error.includes('set isolation before executing')),
        'validator should require isolation configuration before work'
      );
      assert(
        errors.some((error) => error.includes('set lock timeout before executing')),
        'validator should require lock-timeout configuration before work'
      );
    }
  },
  {
    name: 'rejects retry classification inside an open transaction',
    run: () => {
      const manager = createPeriodCloseFormalDbTransactionManagerContract();
      const result = manager.run({
        failureCode: 'deadlock_detected',
        operation: 'close_or_reopen_accounting_period',
        outcome: 'driver_failed',
        period: '2026-06',
        requestId: 'req-formal-db-tx-004'
      });
      const brokenEvents = cloneEvents(result.events);
      const classifyEvent = brokenEvents.find((event) => event.event === 'classify_failure');

      if (!classifyEvent) {
        throw new Error('classify event missing in fixture');
      }

      classifyEvent.sequence = 6;
      classifyEvent.retryScope = 'inside_transaction';

      const errors = validatePeriodCloseFormalDbTransactionManagerTrace({ events: brokenEvents });

      assert(
        errors.some((error) => error.includes('inside an open transaction')),
        'validator should reject retry classification inside a transaction'
      );
      assert(
        errors.some((error) => error.includes('after releasing the DB connection')),
        'validator should require retry classification after connection release'
      );
    }
  },
  {
    name: 'rejects traces with mixed connection leases and non-policy retryable failures',
    run: () => {
      const manager = createPeriodCloseFormalDbTransactionManagerContract();
      const result = manager.run({
        failureCode: 'connection_lost',
        operation: 'closed_period_source_mutation_guard',
        outcome: 'driver_failed',
        period: '2026-06',
        requestId: 'req-formal-db-tx-005'
      });
      const brokenEvents = cloneEvents(result.events);
      const executeEvent = brokenEvents.find((event) => event.event === 'execute_unit_of_work');
      const classifyEvent = brokenEvents.find((event) => event.event === 'classify_failure');

      if (!executeEvent || !classifyEvent) {
        throw new Error('fixture events missing');
      }

      executeEvent.connectionLeaseId = 'unexpected-second-lease';
      classifyEvent.retryable = true;
      classifyEvent.retryScope = 'outside_transaction';

      const errors = validatePeriodCloseFormalDbTransactionManagerTrace({ events: brokenEvents });

      assert(
        errors.some((error) => error.includes('one connection lease')),
        'validator should reject mixed connection leases in one transaction'
      );
      assert(
        errors.some((error) => error.includes('only mark policy retryable failures')),
        'validator should reject retryable=true for non-policy failures'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
