import {
  createInMemoryPeriodCloseSqlDriverExecutor,
  createPeriodCloseSqlDriverRepositoryAdapterContract,
  validatePeriodCloseSqlDriverExecutions
} from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseAccountingPeriodRequest, type CloseCheckRow } from './periodCloseContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createPeriod(overrides: Partial<PersistentAccountingPeriodRecord> = {}): PersistentAccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createCloseChecks(): CloseCheckRow[] {
  return requiredCloseCheckCodes.map((code) => ({
    blockerCount: 0,
    canPass: true,
    code,
    label: code,
    sources: [],
    status: '通过',
    summary: '通过'
  }));
}

function createSourceRecord(
  overrides: Partial<PersistentFinanceSourceRecord> = {}
): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1000.00',
    id: 'source-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-001',
    status: '未结清',
    version: 1,
    ...overrides
  };
}

function createState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {
      '2026-06': {
        checks: createCloseChecks(),
        computedAt: '2026-06-30T20:00:00+08:00',
        sourceVersionSetHash: 'src_hash_202606',
        trialBalance: {
          creditTotal: '68000.00',
          debitTotal: '68000.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    },
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [createPeriod(), createPeriod({ period: '2026-07' })],
    sourceMutationEvents: [],
    sourceRecords: [createSourceRecord()],
    ...overrides
  };
}

function createCloseRequest(overrides: Partial<CloseAccountingPeriodRequest> = {}): CloseAccountingPeriodRequest {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    idempotencyKey: 'idem-close-driver-sql',
    now: '2026-07-02T22:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-driver-sql',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'executes close through parameterized SQL driver adapter and commits rows',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const adapter = createPeriodCloseSqlDriverRepositoryAdapterContract({ driver, repository });
      const call = adapter.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-driver-close-202606'
      });

      assertEqual(call.driverOk, true, 'driver close should execute');

      if (!call.driverOk) {
        return;
      }

      assertEqual(call.result.ok, true, 'driver close should commit domain transaction');
      assertEqual(validatePeriodCloseSqlDriverExecutions(call.executions).length, 0, 'driver executions should be valid');
      assert(
        call.executions.some(
          (execution) =>
            execution.name === 'lock_accounting_period_for_update' &&
            execution.sql.includes('FOR UPDATE') &&
            execution.parameters[0] === '2026-06'
        ),
        'driver should lock the period row with a parameterized FOR UPDATE query'
      );
      assert(
        call.executions.every(
          (execution) => execution.name === 'begin' || execution.name === 'commit' || !execution.sql.includes('2026-06')
        ),
        'business SQL should not inline the accounting period literal'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'driver adapter should commit the close into repository rows'
      );
    }
  },
  {
    name: 'rolls back driver transaction for stale close version without write statements',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const adapter = createPeriodCloseSqlDriverRepositoryAdapterContract({ driver, repository });
      const call = adapter.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ version: 99 }),
        transactionId: 'tx-driver-stale-close-202606'
      });

      assertEqual(call.driverOk, true, 'stale close should still execute driver transaction');

      if (!call.driverOk) {
        return;
      }

      assertEqual(call.result.ok, false, 'stale close should fail domain transaction');
      assertEqual(call.result.ok ? '' : call.result.error.code, 'PERIOD_VERSION_CONFLICT', 'stale close should keep version conflict code');
      assertEqual(call.executions.at(-1)?.name, 'rollback', 'stale close should end with rollback');
      assert(
        !call.executions.some((execution) => execution.name === 'update_accounting_period'),
        'stale close should not execute period update statement'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'stale close should keep the period open'
      );
    }
  },
  {
    name: 'executes closed-period source guard through driver before source mutation',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const adapter = createPeriodCloseSqlDriverRepositoryAdapterContract({ driver, repository });

      adapter.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-driver-close-before-source'
      });

      const call = adapter.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:35:00+08:00',
          requestId: 'req-driver-source-guard'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        transactionId: 'tx-driver-source-guard'
      });

      assertEqual(call.driverOk, true, 'source guard should execute driver transaction');

      if (!call.driverOk) {
        return;
      }

      const lockIndex = call.executions.findIndex((execution) => execution.name === 'lock_accounting_period_for_update');
      const guardIndex = call.executions.findIndex((execution) => execution.name === 'insert_source_mutation_guard_event');

      assertEqual(call.result.ok, true, 'source guard transaction should commit rejection audit');
      assertEqual(call.result.ok ? call.result.value.ok : true, false, 'domain source mutation should be rejected');
      assert(lockIndex !== -1 && guardIndex > lockIndex, 'source guard audit should execute after period lock');
      assertEqual(validatePeriodCloseSqlDriverExecutions(call.executions).length, 0, 'source guard driver executions should be valid');
      assertEqual(repository.readDatabaseSnapshot().sourceRecords[0]?.amount, '1000.00', 'source row should stay unchanged');
    }
  },
  {
    name: 'rolls back without mutating rows when driver fails before repository mutation',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor({ failOnStatement: 'lock_accounting_period_for_update' });
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const adapter = createPeriodCloseSqlDriverRepositoryAdapterContract({ driver, repository });
      const call = adapter.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-driver-lock-failure'
      });

      assertEqual(call.driverOk, false, 'driver lock failure should be surfaced');

      if (call.driverOk) {
        return;
      }

      assertEqual(call.error.code, 'SQL_DRIVER_EXECUTION_FAILED', 'driver failure should keep SQL driver code');
      assertEqual(call.executions.at(-1)?.name, 'rollback', 'driver failure should attempt rollback');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'driver failure before repository mutation should not close the period'
      );
    }
  },
  {
    name: 'rejects unsafe driver statements before execution',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      let caught = false;

      try {
        driver.execute({
          name: 'lock_accounting_period_for_update',
          parameters: ['2026-06'],
          period: '2026-06',
          sql: 'SELECT * FROM "accounting_periods" WHERE "period" = $1; DROP TABLE "accounting_periods";',
          transactionId: 'tx-unsafe-driver'
        });
      } catch {
        caught = true;
      }

      assertEqual(caught, true, 'driver should reject destructive SQL text');
      assertEqual(driver.readExecutions().length, 0, 'unsafe SQL should not be recorded as executed');
    }
  }
];

for (const test of tests) {
  test.run();
}
