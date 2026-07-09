import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord } from './periodCloseContract.js';
import type { PeriodClosePersistentState } from './periodClosePersistenceContract.js';
import {
  applyFinanceSourceMutationRepositoryApi,
  type FinanceSourceMutationRepositoryApiOperation
} from './periodCloseSourceMutationRepositoryApiContract.js';
import { financeSourceMutationOperationRegistry } from './periodCloseSourceMutationRegistry.js';
import {
  createSourceTableBackedPeriodCloseRepository,
  getDefaultFinanceSourceTableName
} from './periodCloseSourceTableRepositoryContract.js';
import {
  buildFinanceSourceTableSqlStatementContracts,
  createFinanceSourceTableSqlRepositoryContract,
  financeSourceTableSqlTableContracts,
  validateFinanceSourceTableSqlContracts,
  type FinanceSourceTableSqlRow
} from './periodCloseSourceTableSqlRepositoryContract.js';

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

function assertThrows(run: () => void, expectedMessage: string, message: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof Error, `${message}: expected Error`);
    assert(
      error.message.includes(expectedMessage),
      `${message}. Expected message to include ${expectedMessage}, got ${error.message}`
    );
    return;
  }

  throw new Error(`${message}. Expected function to throw`);
}

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {},
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [createPeriod(), createPeriod({ period: '2026-07' })],
    sourceMutationEvents: [],
    sourceRecords: [],
    ...overrides
  };
}

function createContext(requestId = 'req-source-table-sql') {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-05T22:10:00+08:00',
    requestId
  };
}

function operationFromRegistry(operation: string): FinanceSourceMutationRepositoryApiOperation {
  const entry = financeSourceMutationOperationRegistry.find((item) => item.operation === operation);

  if (!entry) {
    throw new Error(`Missing source mutation operation: ${operation}`);
  }

  return entry;
}

function createSqlRow(overrides: Partial<FinanceSourceTableSqlRow> = {}): FinanceSourceTableSqlRow {
  return {
    accounting_period: '2026-06',
    amount: '1000.00',
    id: 'source-sql-001',
    source_no: 'AR-202606-001',
    status: '待处理',
    tableName: overrides.tableName ?? getDefaultFinanceSourceTableName('receivable_payable'),
    updated_at: '2026-07-05T22:00:00+08:00',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'declares additive SQL source-table contracts for every guarded source area',
    run: () => {
      const errors = validateFinanceSourceTableSqlContracts();
      const statements = buildFinanceSourceTableSqlStatementContracts();
      const sourceAreas = new Set(financeSourceMutationOperationRegistry.map((entry) => entry.sourceArea));

      assertEqual(errors.length, 0, 'default source SQL contracts should validate');
      assertEqual(
        financeSourceTableSqlTableContracts.length,
        sourceAreas.size,
        'source SQL table contracts should cover every guarded source area'
      );

      for (const sourceArea of sourceAreas) {
        assert(
          financeSourceTableSqlTableContracts.some((table) => table.sourceArea === sourceArea),
          `source SQL table contract should exist for ${sourceArea}`
        );
      }

      for (const table of financeSourceTableSqlTableContracts) {
        const columns = new Set(table.columns.map((column) => column.name));

        assertEqual(table.destructive, false, `${table.tableName} should be additive`);
        assert(columns.has('accounting_period'), `${table.tableName} should include accounting_period`);
        assert(columns.has('version'), `${table.tableName} should include version`);
        assert(
          table.indexes.some((index) => index.columns.includes('accounting_period')),
          `${table.tableName} should index accounting_period`
        );
        assert(
          table.indexes.some((index) => index.columns.includes('id') && index.columns.includes('version')),
          `${table.tableName} should index optimistic lock columns`
        );
      }

      for (const statement of statements) {
        assert(statement.sql.includes('$1'), `${statement.name} should use parameter placeholders`);
        assert(!/\b(drop|truncate|delete)\b/i.test(statement.sql), `${statement.name} should not be destructive`);
        assert(statement.parameters.length > 0, `${statement.name} should declare parameter order`);
      }
    }
  },
  {
    name: 'hydrates SQL source rows and blocks closed-period writes without changing SQL state',
    run: () => {
      const operation = operationFromRegistry('调整应收应付事项');
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T22:15:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '3200.00',
            id: 'rp-closed-sql-001',
            source_no: 'AR-202606-001',
            tableName: getDefaultFinanceSourceTableName(operation.sourceArea),
            version: 3
          })
        ]
      });
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState({
          periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })]
        }),
        sourceTableRepository: sourceSqlRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-sql-closed'),
        operation,
        repository: periodRepository,
        request: {
          amount: '3600.00',
          expectedVersion: 3,
          sourceId: 'rp-closed-sql-001',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(result.ok, false, 'closed-period SQL source mutation should reject');
      assertEqual(
        result.ok ? '' : result.error.code,
        canonicalClosedAccountingPeriodErrorCode,
        'closed-period SQL source mutation should use canonical error code'
      );
      assertEqual(sourceSqlRepository.readSqlRows()[0]?.amount, '3200.00', 'closed-period rejection should not write SQL amount');
      assertEqual(sourceSqlRepository.readSqlRows()[0]?.version, 3, 'closed-period rejection should not bump SQL version');
      assertEqual(periodRepository.readState().sourceRecords.length, 1, 'period repository should hydrate SQL source rows');
      assertEqual(periodRepository.readState().sourceMutationEvents.length, 1, 'closed-period rejection should be audited');
    }
  },
  {
    name: 'writes SQL source rows only after open-period guard and version check pass',
    run: () => {
      const operation = operationFromRegistry('调整应收应付事项');
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T22:16:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '800.00',
            id: 'rp-open-sql-001',
            source_no: 'AR-202606-002',
            status: '待调整',
            tableName: getDefaultFinanceSourceTableName(operation.sourceArea),
            version: 2
          })
        ]
      });
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState(),
        sourceTableRepository: sourceSqlRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-sql-open'),
        operation,
        repository: periodRepository,
        request: {
          amount: '1200.00',
          expectedVersion: 2,
          sourceId: 'rp-open-sql-001',
          targetAccountingPeriod: '2026-07'
        }
      });
      const sqlRow = sourceSqlRepository.readSqlRows()[0];

      assertEqual(result.ok, true, 'open-period SQL source mutation should pass');
      assertEqual(sqlRow?.amount, '1200.00', 'open-period mutation should write SQL amount');
      assertEqual(sqlRow?.status, operation.successStatus, 'open-period mutation should write SQL status');
      assertEqual(sqlRow?.version, 3, 'open-period mutation should bump SQL version');
      assertEqual(sqlRow?.tableName, getDefaultFinanceSourceTableName(operation.sourceArea), 'open mutation should preserve SQL table');
      assertEqual(periodRepository.readState().sourceMutationEvents[0]?.eventType, 'source_mutation_applied', 'open mutation should be audited');
    }
  },
  {
    name: 'keeps SQL source rows unchanged on source version conflict',
    run: () => {
      const operation = operationFromRegistry('调整应收应付事项');
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T22:17:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '1500.00',
            id: 'rp-conflict-sql-001',
            source_no: 'AR-202606-003',
            tableName: getDefaultFinanceSourceTableName(operation.sourceArea),
            version: 4
          })
        ]
      });
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState(),
        sourceTableRepository: sourceSqlRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-sql-conflict'),
        operation,
        repository: periodRepository,
        request: {
          amount: '1600.00',
          expectedVersion: 3,
          sourceId: 'rp-conflict-sql-001'
        }
      });
      const sqlRow = sourceSqlRepository.readSqlRows()[0];

      assertEqual(result.ok, false, 'version conflict should reject');
      assertEqual(result.ok ? '' : result.error.code, 'SOURCE_VERSION_CONFLICT', 'version conflict should keep source error code');
      assertEqual(sqlRow?.amount, '1500.00', 'version conflict should not write SQL amount');
      assertEqual(sqlRow?.version, 4, 'version conflict should not bump SQL version');
      assertEqual(periodRepository.readState().sourceMutationEvents[0]?.eventType, 'source_mutation_rejected', 'version conflict should be audited');
    }
  },
  {
    name: 'inserts create-type SQL rows only for open target periods',
    run: () => {
      const operation = operationFromRegistry('新增应收应付事项');
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T22:18:00+08:00',
        initialRows: []
      });
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState(),
        sourceTableRepository: sourceSqlRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-sql-create'),
        operation,
        repository: periodRepository,
        request: {
          amount: '6800.00',
          sourceId: 'rp-created-sql-001',
          sourceNo: 'AR-202606-NEW',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(result.ok, true, 'open target-period create should pass');
      assertEqual(sourceSqlRepository.readSqlRows().length, 1, 'open target-period create should insert SQL source row');
      assertEqual(
        sourceSqlRepository.readSqlRows()[0]?.tableName,
        getDefaultFinanceSourceTableName(operation.sourceArea),
        'created SQL row should use default source table name'
      );
      assertEqual(sourceSqlRepository.readSqlRows()[0]?.updated_at, '2026-07-05T22:18:00+08:00', 'created SQL row should use fallback updated_at');

      const closedSourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-05T22:19:00+08:00',
        initialRows: []
      });
      const closedPeriodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState({
          periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })]
        }),
        sourceTableRepository: closedSourceSqlRepository
      });
      const rejected = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-sql-create-closed'),
        operation,
        repository: closedPeriodRepository,
        request: {
          amount: '6800.00',
          sourceId: 'rp-created-sql-closed',
          sourceNo: 'AR-202606-CLOSED',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(rejected.ok, false, 'closed target-period create should reject');
      assertEqual(closedSourceSqlRepository.readSqlRows().length, 0, 'closed target-period create should not insert SQL source row');
      assertEqual(closedPeriodRepository.readState().sourceMutationEvents.length, 1, 'closed create rejection should be audited');
    }
  },
  {
    name: 'rejects invalid SQL source rows before repository is usable',
    run: () => {
      assertThrows(
        () =>
          createFinanceSourceTableSqlRepositoryContract({
            fallbackUpdatedAt: '2026-07-05T22:20:00+08:00',
            initialRows: [createSqlRow({ id: 'duplicate-sql' }), createSqlRow({ id: 'duplicate-sql' })]
          }),
        'duplicate source SQL row',
        'duplicate source SQL rows should be rejected'
      );
      assertThrows(
        () =>
          createFinanceSourceTableSqlRepositoryContract({
            fallbackUpdatedAt: '2026-07-05T22:21:00+08:00',
            initialRows: [createSqlRow({ tableName: 'unknown_source_table' })]
          }),
        'unknown table',
        'unknown source SQL table should be rejected'
      );
      assertThrows(
        () =>
          createFinanceSourceTableSqlRepositoryContract({
            fallbackUpdatedAt: '2026-07-05T22:22:00+08:00',
            initialRows: [createSqlRow({ accounting_period: '2026/06' })]
          }),
        'YYYY-MM',
        'invalid source SQL accounting period should be rejected'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
