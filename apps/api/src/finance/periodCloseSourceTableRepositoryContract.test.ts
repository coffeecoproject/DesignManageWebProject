import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord } from './periodCloseContract.js';
import type {
  PeriodClosePersistentState,
  PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';
import {
  applyFinanceSourceMutationRepositoryApi,
  type FinanceSourceMutationRepositoryApiOperation
} from './periodCloseSourceMutationRepositoryApiContract.js';
import { financeSourceMutationOperationRegistry } from './periodCloseSourceMutationRegistry.js';
import {
  createInMemoryFinanceSourceTableRepository,
  createSourceTableBackedPeriodCloseRepository,
  getDefaultFinanceSourceTableName,
  type FinanceSourceTableRow
} from './periodCloseSourceTableRepositoryContract.js';

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

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createSourceRecord(
  overrides: Partial<PersistentFinanceSourceRecord> = {}
): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1000.00',
    id: 'source-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'SRC-202606-001',
    status: '待处理',
    version: 1,
    ...overrides
  };
}

function createSourceTableRow(overrides: Partial<FinanceSourceTableRow> = {}): FinanceSourceTableRow {
  const record = createSourceRecord(overrides);

  return {
    ...record,
    tableName: 'finance_receivable_payable_source_rows',
    updatedAt: '2026-07-05T21:00:00+08:00',
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

function createContext(requestId = 'req-source-table-repository') {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-05T21:10:00+08:00',
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

const tests: UnitTest[] = [
  {
    name: 'reads existing source rows from source-table repository before applying closed-period guard',
    run: () => {
      const operation = operationFromRegistry('调整应收应付事项');
      const sourceTableRepository = createInMemoryFinanceSourceTableRepository([
        createSourceTableRow({
          amount: '3200.00',
          id: 'rp-closed-001',
          sourceArea: operation.sourceArea,
          sourceNo: 'AR-202606-001',
          version: 3
        })
      ]);
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState({
          periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })]
        }),
        sourceTableRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-table-closed'),
        operation,
        repository: periodRepository,
        request: {
          amount: '3600.00',
          expectedVersion: 3,
          sourceId: 'rp-closed-001',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(result.ok, false, 'closed-period source-table mutation should reject');
      assertEqual(
        result.ok ? '' : result.error.code,
        canonicalClosedAccountingPeriodErrorCode,
        'closed-period source-table mutation should use canonical error code'
      );
      assertEqual(sourceTableRepository.readRows()[0]?.amount, '3200.00', 'closed-period rejection should not write source table');
      assertEqual(sourceTableRepository.readRows()[0]?.version, 3, 'closed-period rejection should not bump source version');
      assertEqual(periodRepository.readState().sourceRecords.length, 1, 'period repository should read source-table rows');
      assertEqual(periodRepository.readState().sourceMutationEvents.length, 1, 'closed-period rejection should persist audit event');
    }
  },
  {
    name: 'writes source-table row only after open-period guard and version check pass',
    run: () => {
      const operation = operationFromRegistry('调整应收应付事项');
      const sourceTableRepository = createInMemoryFinanceSourceTableRepository([
        createSourceTableRow({
          amount: '800.00',
          id: 'rp-open-001',
          sourceArea: operation.sourceArea,
          sourceNo: 'AR-202606-002',
          status: '待调整',
          version: 2
        })
      ]);
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState(),
        sourceTableRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-table-open'),
        operation,
        repository: periodRepository,
        request: {
          amount: '1200.00',
          expectedVersion: 2,
          sourceId: 'rp-open-001',
          targetAccountingPeriod: '2026-07'
        }
      });

      assertEqual(result.ok, true, 'open-period source-table mutation should pass');
      assertEqual(sourceTableRepository.readRows()[0]?.amount, '1200.00', 'open mutation should write source table amount');
      assertEqual(sourceTableRepository.readRows()[0]?.status, operation.successStatus, 'open mutation should write success status');
      assertEqual(sourceTableRepository.readRows()[0]?.version, 3, 'open mutation should bump source table version');
      assertEqual(
        sourceTableRepository.readRows()[0]?.tableName,
        'finance_receivable_payable_source_rows',
        'open mutation should preserve existing physical table name'
      );
      assertEqual(periodRepository.readState().sourceMutationEvents[0]?.eventType, 'source_mutation_applied', 'open mutation should be audited');
    }
  },
  {
    name: 'keeps source-table row unchanged when version check fails after open-period guard',
    run: () => {
      const operation = operationFromRegistry('调整应收应付事项');
      const sourceTableRepository = createInMemoryFinanceSourceTableRepository([
        createSourceTableRow({
          amount: '1500.00',
          id: 'rp-version-conflict',
          sourceArea: operation.sourceArea,
          sourceNo: 'AR-202606-003',
          version: 4
        })
      ]);
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState(),
        sourceTableRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-table-version-conflict'),
        operation,
        repository: periodRepository,
        request: {
          amount: '1600.00',
          expectedVersion: 3,
          sourceId: 'rp-version-conflict'
        }
      });

      assertEqual(result.ok, false, 'version conflict should reject');
      assertEqual(result.ok ? '' : result.error.code, 'SOURCE_VERSION_CONFLICT', 'version conflict should keep source error code');
      assertEqual(sourceTableRepository.readRows()[0]?.amount, '1500.00', 'version conflict should not write source table');
      assertEqual(sourceTableRepository.readRows()[0]?.version, 4, 'version conflict should not bump source version');
      assertEqual(periodRepository.readState().sourceMutationEvents[0]?.eventType, 'source_mutation_rejected', 'version conflict should be audited');
    }
  },
  {
    name: 'inserts create-type source rows into the source table only after target period is open',
    run: () => {
      const operation = operationFromRegistry('新增应收应付事项');
      const sourceTableRepository = createInMemoryFinanceSourceTableRepository([]);
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState(),
        sourceTableRepository
      });
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-table-create'),
        operation,
        repository: periodRepository,
        request: {
          amount: '6800.00',
          sourceId: 'rp-created-source-table',
          sourceNo: 'AR-202606-NEW',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(result.ok, true, 'open target-period create should pass');
      assertEqual(sourceTableRepository.readRows().length, 1, 'open target-period create should insert source-table row');
      assertEqual(
        sourceTableRepository.readRows()[0]?.tableName,
        getDefaultFinanceSourceTableName(operation.sourceArea),
        'created source row should use the default source table name for its source area'
      );
      assertEqual(sourceTableRepository.readRows()[0]?.version, 1, 'created source row should start at version 1');

      const closedSourceTableRepository = createInMemoryFinanceSourceTableRepository([]);
      const closedPeriodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState({
          periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })]
        }),
        sourceTableRepository: closedSourceTableRepository
      });
      const rejected = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-source-table-create-closed'),
        operation,
        repository: closedPeriodRepository,
        request: {
          amount: '6800.00',
          sourceId: 'rp-created-source-table-closed',
          sourceNo: 'AR-202606-CLOSED',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(rejected.ok, false, 'closed target-period create should reject');
      assertEqual(closedSourceTableRepository.readRows().length, 0, 'closed target-period create should not insert source-table row');
      assertEqual(closedPeriodRepository.readState().sourceMutationEvents.length, 1, 'closed create rejection should be audited');
    }
  },
  {
    name: 'does not commit source-table writes when repository transaction throws',
    run: () => {
      const sourceTableRepository = createInMemoryFinanceSourceTableRepository([
        createSourceTableRow({
          amount: '900.00',
          id: 'rp-throw-001',
          version: 1
        })
      ]);
      const periodRepository = createSourceTableBackedPeriodCloseRepository({
        initialState: createState(),
        sourceTableRepository
      });

      try {
        periodRepository.runInTransaction((state): never => {
          state.sourceRecords[0] = {
            ...state.sourceRecords[0],
            amount: '9999.00',
            version: 99
          } as PersistentFinanceSourceRecord;
          throw new Error('simulated transaction failure');
        });
      } catch (error) {
        assert(error instanceof Error, 'transaction failure should be surfaced');
      }

      assertEqual(sourceTableRepository.readRows()[0]?.amount, '900.00', 'thrown transaction should not commit source-table amount');
      assertEqual(sourceTableRepository.readRows()[0]?.version, 1, 'thrown transaction should not commit source-table version');
      assertEqual(periodRepository.readState().sourceMutationEvents.length, 0, 'thrown transaction should not commit audit events');
    }
  }
];

for (const test of tests) {
  test.run();
}
