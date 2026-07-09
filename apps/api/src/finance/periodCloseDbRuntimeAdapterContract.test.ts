import {
  createPeriodCloseDbRuntimeAdapterContract,
  validatePeriodCloseDbRuntimeAdapterTrace,
  type PeriodCloseDbRuntimeAdapterResult
} from './periodCloseDbRuntimeAdapterContract.js';

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

function cloneResult(result: PeriodCloseDbRuntimeAdapterResult): PeriodCloseDbRuntimeAdapterResult {
  return {
    ...result,
    driverExecutions: result.driverExecutions.map((execution) => ({
      ...execution,
      parameters: [...execution.parameters]
    })),
    formalEvents: result.formalEvents.map((event) => ({ ...event })),
    poolEvents: result.poolEvents.map((event) => ({ ...event })),
    runtimeEvents: result.runtimeEvents.map((event) => ({ ...event })),
    traceErrors: [...result.traceErrors]
  };
}

const tests: UnitTest[] = [
  {
    name: 'commits only when pool, formal manager and SQL driver terminals are aligned',
    run: () => {
      const adapter = createPeriodCloseDbRuntimeAdapterContract();
      const result = adapter.run({
        operation: 'close_or_reopen_accounting_period',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-runtime-001'
      });

      assertEqual(result.status, 'committed', 'runtime adapter should commit the transaction');
      assertEqual(result.traceErrors.length, 0, `runtime trace should validate: ${result.traceErrors.join('; ')}`);
      assert(
        result.poolEvents.some((event) => event.event === 'commit_transaction' && event.requestId === 'req-runtime-001'),
        'pool trace should commit the request transaction'
      );
      assert(
        result.formalEvents.some((event) => event.event === 'commit_transaction'),
        'formal transaction manager should commit'
      );
      assertEqual(result.driverExecutions.at(-1)?.name, 'commit', 'SQL driver should end with COMMIT');
      assertEqual(result.runtimeEvents.at(-1)?.event, 'return_response', 'runtime should return after validation');
    }
  },
  {
    name: 'rolls back stale or rejected unit of work across all runtime layers',
    run: () => {
      const adapter = createPeriodCloseDbRuntimeAdapterContract();
      const result = adapter.run({
        operation: 'closed_period_source_mutation_guard',
        outcome: 'rolled_back',
        period: '2026-06',
        requestId: 'req-runtime-002'
      });

      assertEqual(result.status, 'rolled_back', 'runtime adapter should surface rolled_back');
      assertEqual(result.traceErrors.length, 0, `rolled-back runtime trace should validate: ${result.traceErrors.join('; ')}`);
      assert(
        result.poolEvents.some((event) => event.event === 'rollback_transaction' && event.requestId === 'req-runtime-002'),
        'pool trace should rollback the request transaction'
      );
      assert(
        result.formalEvents.some((event) => event.event === 'rollback_transaction'),
        'formal transaction manager should rollback'
      );
      assertEqual(result.driverExecutions.at(-1)?.name, 'rollback', 'SQL driver should end with ROLLBACK');
    }
  },
  {
    name: 'classifies driver failures after release and only retries outside the transaction',
    run: () => {
      const adapter = createPeriodCloseDbRuntimeAdapterContract();
      const result = adapter.run({
        failureCode: 'lock_timeout',
        operation: 'close_or_reopen_accounting_period',
        outcome: 'driver_failed',
        period: '2026-06',
        requestId: 'req-runtime-003'
      });
      const releaseIndex = result.formalEvents.findIndex((event) => event.event === 'release_connection');
      const classifyIndex = result.formalEvents.findIndex((event) => event.event === 'classify_failure');

      assertEqual(result.status, 'driver_failed', 'runtime adapter should surface driver failure');
      assertEqual(result.retryable, true, 'lock timeout should be retryable outside the transaction');
      assertEqual(result.traceErrors.length, 0, `driver-failure runtime trace should validate: ${result.traceErrors.join('; ')}`);
      assert(releaseIndex !== -1 && classifyIndex > releaseIndex, 'failure classification should happen after release');
      assertEqual(result.driverExecutions.at(-1)?.name, 'rollback', 'driver failure should end with ROLLBACK');
    }
  },
  {
    name: 'returns pool_exhausted before formal transaction manager or SQL driver work',
    run: () => {
      const adapter = createPeriodCloseDbRuntimeAdapterContract();
      const result = adapter.run({
        holdPoolConnectionBeforeRun: true,
        operation: 'close_or_reopen_accounting_period',
        outcome: 'committed',
        period: '2026-06',
        requestId: 'req-runtime-004'
      });

      assertEqual(result.status, 'pool_exhausted', 'pool exhaustion should surface before DB work');
      assertEqual(result.retryable, true, 'pool exhaustion should be retryable');
      assertEqual(result.formalEvents.length, 0, 'pool exhaustion must not open formal transaction manager');
      assertEqual(result.driverExecutions.length, 0, 'pool exhaustion must not delegate SQL driver work');
      assertEqual(result.traceErrors.length, 0, `pool-exhaustion runtime trace should validate: ${result.traceErrors.join('; ')}`);
      assert(
        result.poolEvents.some((event) => event.event === 'reject_checkout' && event.requestId === 'req-runtime-004'),
        'pool should reject checkout for the target request'
      );
    }
  },
  {
    name: 'detects terminal mismatch between formal manager and SQL driver',
    run: () => {
      const adapter = createPeriodCloseDbRuntimeAdapterContract();
      const result = cloneResult(
        adapter.run({
          operation: 'close_or_reopen_accounting_period',
          outcome: 'committed',
          period: '2026-06',
          requestId: 'req-runtime-005'
        })
      );

      const terminal = result.driverExecutions.at(-1);

      if (!terminal) {
        throw new Error('fixture terminal driver execution missing');
      }

      terminal.name = 'rollback';
      terminal.sql = 'ROLLBACK;';

      const errors = validatePeriodCloseDbRuntimeAdapterTrace(result);

      assert(
        errors.some((error) => error.includes('terminals must match commit')),
        'validator should reject commit/rollback terminal mismatch'
      );
    }
  },
  {
    name: 'detects request and period drift across runtime layers',
    run: () => {
      const adapter = createPeriodCloseDbRuntimeAdapterContract();
      const result = cloneResult(
        adapter.run({
          operation: 'financial_statement_snapshot_after_close',
          outcome: 'committed',
          period: '2026-06',
          requestId: 'req-runtime-006'
        })
      );
      const formalWorkEvent = result.formalEvents.find((event) => event.event === 'execute_unit_of_work');
      const driverLock = result.driverExecutions.find((execution) => execution.name === 'lock_accounting_period_for_update');

      if (!formalWorkEvent || !driverLock) {
        throw new Error('fixture runtime events missing');
      }

      formalWorkEvent.requestId = 'req-runtime-drifted';
      driverLock.period = '2026-07';

      const errors = validatePeriodCloseDbRuntimeAdapterTrace(result);

      assert(
        errors.some((error) => error.includes('one request id across runtime')),
        'validator should reject request id drift'
      );
      assert(
        errors.some((error) => error.includes('SQL driver executions must target the runtime accounting period')),
        'validator should reject driver period drift'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
