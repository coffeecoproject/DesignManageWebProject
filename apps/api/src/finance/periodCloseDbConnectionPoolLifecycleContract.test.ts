import {
  createPeriodCloseDbConnectionPoolLifecycleContract,
  validatePeriodCloseDbConnectionPoolLifecycleTrace,
  type PeriodCloseDbConnectionPoolEvent
} from './periodCloseDbConnectionPoolLifecycleContract.js';

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

function cloneEvents(events: readonly PeriodCloseDbConnectionPoolEvent[]) {
  return events.map((event) => ({ ...event }));
}

const tests: UnitTest[] = [
  {
    name: 'records a leak-free connection-pool transaction lifecycle for committed close operations',
    run: () => {
      const pool = createPeriodCloseDbConnectionPoolLifecycleContract({
        acquireTimeoutMs: 750,
        maxConnections: 2,
        poolId: 'period-close-test-pool-001'
      });
      const result = pool.runTransaction({
        operation: 'close_or_reopen_accounting_period',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-pool-001'
      });
      const errors = validatePeriodCloseDbConnectionPoolLifecycleTrace({ events: pool.readEvents() });
      const eventNames = result.events.map((event) => event.event);
      const checkoutEvent = result.events.find((event) => event.event === 'checkout_connection');
      const releaseEvent = result.events.find((event) => event.event === 'release_connection');

      assertEqual(errors.length, 0, `connection-pool lifecycle should validate: ${errors.join('; ')}`);
      assert(result.ok, 'committed transaction should be accepted');
      assertEqual(result.outcome, 'committed', 'transaction outcome should be committed');
      assertEqual(eventNames[0], 'checkout_connection', 'request should start by checking out a connection');
      assert(eventNames.includes('begin_transaction'), 'pool should begin the transaction after checkout');
      assert(eventNames.includes('set_isolation_level'), 'pool should configure isolation before work');
      assert(eventNames.includes('set_lock_timeout'), 'pool should configure lock timeout before work');
      assert(eventNames.includes('commit_transaction'), 'pool should commit successful work');
      assertEqual(eventNames.at(-1), 'return_result', 'pool should return only after releasing the connection');
      assertEqual(releaseEvent?.activeLeases, 0, 'release event should leave no active leases');
      assertEqual(checkoutEvent?.connectionId, releaseEvent?.connectionId, 'release should target the checked-out connection');
    }
  },
  {
    name: 'rolls back and releases the connection when the driver fails',
    run: () => {
      const pool = createPeriodCloseDbConnectionPoolLifecycleContract({ poolId: 'period-close-test-pool-002' });
      const result = pool.runTransaction({
        failureCode: 'connection_lost',
        operation: 'closed_period_source_mutation_guard',
        outcome: 'driver_failed',
        period: '2026-06',
        requestId: 'req-pool-002'
      });
      const errors = validatePeriodCloseDbConnectionPoolLifecycleTrace({ events: pool.readEvents() });
      const eventNames = result.events.map((event) => event.event);
      const rollbackIndex = eventNames.indexOf('rollback_transaction');
      const releaseIndex = eventNames.indexOf('release_connection');

      assertEqual(errors.length, 0, `driver failure lifecycle should validate: ${errors.join('; ')}`);
      assert(result.ok, 'driver failure should still return a transaction result');
      assertEqual(result.outcome, 'driver_failed', 'transaction outcome should carry driver_failed');
      assert(rollbackIndex !== -1, 'driver failure should roll back');
      assert(releaseIndex > rollbackIndex, 'driver failure should release after rollback');
    }
  },
  {
    name: 'rejects checkout when the pool is exhausted before transaction work starts',
    run: () => {
      const pool = createPeriodCloseDbConnectionPoolLifecycleContract({
        maxConnections: 1,
        poolId: 'period-close-test-pool-003'
      });
      const reservation = pool.reserveConnection({
        operation: 'close_or_reopen_accounting_period',
        period: '2026-06',
        requestId: 'req-pool-003-held'
      });

      assert(reservation.ok, 'fixture should hold the only pool connection');

      const result = pool.runTransaction({
        operation: 'closed_period_source_mutation_guard',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-pool-003-rejected'
      });

      assert(!result.ok, 'pool should reject checkout while exhausted');
      assertEqual(result.outcome, 'pool_exhausted', 'rejection reason should be pool_exhausted');
      assertEqual(result.retryable, true, 'pool exhaustion should be retryable');
      assert(
        !result.events.some((event) => event.event === 'begin_transaction' || event.event === 'execute_unit_of_work'),
        'rejected checkout must not begin or execute a transaction'
      );

      pool.releaseReservedConnection({ leaseId: reservation.leaseId, requestId: 'req-pool-003-release' });

      const errors = validatePeriodCloseDbConnectionPoolLifecycleTrace({ events: pool.readEvents() });

      assertEqual(errors.length, 0, `pool exhaustion lifecycle should validate after release: ${errors.join('; ')}`);
    }
  },
  {
    name: 'detects leaked connection leases when release is missing',
    run: () => {
      const pool = createPeriodCloseDbConnectionPoolLifecycleContract({ poolId: 'period-close-test-pool-004' });
      pool.runTransaction({
        operation: 'financial_statement_snapshot_after_close',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-pool-004'
      });
      const brokenEvents = cloneEvents(pool.readEvents()).filter((event) => event.event !== 'release_connection');
      const errors = validatePeriodCloseDbConnectionPoolLifecycleTrace({ events: brokenEvents });

      assert(
        errors.some((error) => error.includes('must not leak active leases')),
        'validator should detect unreleased connection leases'
      );
      assert(
        errors.some((error) => error.includes('release the connection after terminal event')),
        'validator should require release before returning'
      );
    }
  },
  {
    name: 'detects mixed connection ids and missing lock timeout in transaction traces',
    run: () => {
      const pool = createPeriodCloseDbConnectionPoolLifecycleContract({ poolId: 'period-close-test-pool-005' });
      pool.runTransaction({
        operation: 'close_or_reopen_accounting_period',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-pool-005'
      });
      const brokenEvents = cloneEvents(pool.readEvents()).filter((event) => event.event !== 'set_lock_timeout');
      const executeEvent = brokenEvents.find((event) => event.event === 'execute_unit_of_work');

      if (!executeEvent) {
        throw new Error('fixture execute event missing');
      }

      executeEvent.connectionId = 'period-close-test-pool-005:unexpected-second-connection';

      const errors = validatePeriodCloseDbConnectionPoolLifecycleTrace({ events: brokenEvents });

      assert(
        errors.some((error) => error.includes('set lock timeout before executing')),
        'validator should require lock-timeout setup before work'
      );
      assert(
        errors.some((error) => error.includes('one connection throughout')),
        'validator should reject connection changes inside one transaction'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
