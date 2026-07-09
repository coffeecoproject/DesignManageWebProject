import {
  createPeriodCloseSqlTransactionManagerContract,
  validatePeriodCloseSqlTransactionTrace,
  type PeriodCloseSqlTransactionTraceEvent
} from './periodCloseSqlTransactionManagerContract.js';
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
    idempotencyKey: 'idem-close-managed-sql',
    now: '2026-07-02T22:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-managed-sql',
    version: 1,
    ...overrides
  };
}

function stageIndex(trace: readonly PeriodCloseSqlTransactionTraceEvent[], stage: string) {
  return trace.findIndex((event) => event.stage === stage);
}

const tests: UnitTest[] = [
  {
    name: 'wraps close in explicit application SQL transaction order',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const manager = createPeriodCloseSqlTransactionManagerContract({ repository });
      const { result, trace } = manager.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-managed-close-202606'
      });

      assertEqual(result.ok, true, 'managed SQL close should commit');
      assertEqual(validatePeriodCloseSqlTransactionTrace(trace).length, 0, 'managed close trace should be valid');
      assertEqual(manager.isolationLevel, 'read_committed', 'manager should declare PostgreSQL read committed isolation');
      assert(
        stageIndex(trace, 'begin') <
          stageIndex(trace, 'set_transaction_isolation') &&
          stageIndex(trace, 'set_transaction_isolation') < stageIndex(trace, 'lock_accounting_period_for_update') &&
          stageIndex(trace, 'lock_accounting_period_for_update') < stageIndex(trace, 'validate_expected_period_version') &&
          stageIndex(trace, 'validate_expected_period_version') < stageIndex(trace, 'execute_domain_handler') &&
          stageIndex(trace, 'execute_domain_handler') < stageIndex(trace, 'validate_row_contract') &&
          stageIndex(trace, 'validate_row_contract') < stageIndex(trace, 'commit'),
        'managed close should lock and validate before mutating and committing'
      );
      assert(
        trace.some((event) => event.sqlFragment.includes('FOR UPDATE')),
        'managed close should expose SELECT FOR UPDATE boundary'
      );
    }
  },
  {
    name: 'rolls back managed SQL transaction after stale version under the period lock',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const manager = createPeriodCloseSqlTransactionManagerContract({ repository });
      const { result, trace } = manager.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ version: 99 }),
        transactionId: 'tx-managed-stale-close-202606'
      });

      assertEqual(result.ok, false, 'stale managed close should fail');
      assertEqual(result.ok ? '' : result.error.code, 'PERIOD_VERSION_CONFLICT', 'stale close should keep conflict code');
      assertEqual(validatePeriodCloseSqlTransactionTrace(trace).length, 0, 'stale close trace should still be valid');
      assert(
        stageIndex(trace, 'lock_accounting_period_for_update') < stageIndex(trace, 'validate_expected_period_version') &&
          stageIndex(trace, 'validate_expected_period_version') < stageIndex(trace, 'rollback'),
        'stale managed close should happen after row lock and end with rollback'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'stale managed close should not mutate period'
      );
    }
  },
  {
    name: 'runs source mutation guard after period lock and before source write',
    run: () => {
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const manager = createPeriodCloseSqlTransactionManagerContract({ repository });

      manager.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-managed-close-before-source'
      });

      const { result, trace } = manager.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:35:00+08:00',
          requestId: 'req-managed-source-guard'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        transactionId: 'tx-managed-source-guard'
      });

      assertEqual(result.ok, true, 'closed-period source guard should commit audit transaction');
      assertEqual(result.ok ? result.value.ok : true, false, 'domain source mutation should be rejected');
      assertEqual(validatePeriodCloseSqlTransactionTrace(trace).length, 0, 'source guard trace should be valid');
      assert(
        stageIndex(trace, 'lock_accounting_period_for_update') <
          stageIndex(trace, 'guard_source_mutation_before_source_write') &&
          stageIndex(trace, 'guard_source_mutation_before_source_write') < stageIndex(trace, 'execute_domain_handler') &&
          stageIndex(trace, 'execute_domain_handler') < stageIndex(trace, 'commit'),
        'source guard should run after lock and before source write'
      );
      assertEqual(repository.readDatabaseSnapshot().sourceRecords[0]?.amount, '1000.00', 'source amount should stay unchanged');
    }
  },
  {
    name: 'detects invalid application SQL transaction traces',
    run: () => {
      const errors = validatePeriodCloseSqlTransactionTrace([
        {
          period: '2026-06',
          sqlFragment: 'SELECT "period" FROM "accounting_periods" WHERE "period" = $1;',
          stage: 'lock_accounting_period_for_update',
          transactionId: 'tx-broken-trace'
        },
        {
          period: '2026-06',
          sqlFragment: 'BEGIN;',
          stage: 'begin',
          transactionId: 'tx-broken-trace'
        },
        {
          period: '2026-06',
          sqlFragment: 'COMMIT;',
          stage: 'commit',
          transactionId: 'tx-broken-trace'
        }
      ]);

      assert(errors.length >= 3, 'broken trace should fail ordering and lock validation');
    }
  }
];

for (const test of tests) {
  test.run();
}
