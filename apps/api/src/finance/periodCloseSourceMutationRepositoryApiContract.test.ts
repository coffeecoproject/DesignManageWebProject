import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord } from './periodCloseContract.js';
import {
  type PeriodClosePersistentState,
  type PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';
import { createInMemoryPeriodCloseRepository } from './periodCloseRepositoryContract.js';
import {
  applyFinanceSourceMutationRepositoryApi,
  buildFinanceSourceMutationRepositoryApiEvidence,
  type FinanceSourceMutationRepositoryApiOperation
} from './periodCloseSourceMutationRepositoryApiContract.js';
import { financeSourceMutationOperationRegistry } from './periodCloseSourceMutationRegistry.js';
import type { FinanceSourceMutationArea } from './periodCloseSourceMutationGuard.js';

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

function createContext(requestId = 'req-source-repository-api') {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-05T20:30:00+08:00',
    requestId
  };
}

function operationFromRegistry(
  operation: string
): FinanceSourceMutationRepositoryApiOperation & { operationId: string } {
  const entry = financeSourceMutationOperationRegistry.find((item) => item.operation === operation);

  if (!entry) {
    throw new Error(`Missing source mutation operation: ${operation}`);
  }

  return entry;
}

function sourceIdFor(index: number) {
  return `source-${String(index + 1).padStart(3, '0')}`;
}

function sourceRecordFor({
  entry,
  id
}: {
  entry: FinanceSourceMutationRepositoryApiOperation;
  id: string;
}) {
  return createSourceRecord({
    id,
    sourceArea: entry.sourceArea,
    sourceNo: `${entry.sourceArea}-202606-${id}`,
    status: '原始状态'
  });
}

const tests: UnitTest[] = [
  {
    name: 'uses one repository transaction path for every ordinary source mutation operation',
    run: () => {
      for (const [index, entry] of financeSourceMutationOperationRegistry.entries()) {
        const sourceId = sourceIdFor(index);
        const sourceRecords = entry.createsSourceRecord ? [] : [sourceRecordFor({ entry, id: sourceId })];
        const repository = createInMemoryPeriodCloseRepository(
          createState({
            periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })],
            sourceRecords
          })
        );
        const result = applyFinanceSourceMutationRepositoryApi({
          context: createContext(`req-source-repository-api-${index}`),
          operation: entry,
          repository,
          request: {
            amount: '1200.00',
            expectedVersion: entry.createsSourceRecord ? undefined : 1,
            sourceId,
            sourceNo: `${entry.sourceArea}-202606-${sourceId}`,
            targetAccountingPeriod:
              entry.periodCheckMode === 'source_period' ? undefined : '2026-06'
          }
        });

        assertEqual(result.ok, false, `${entry.operation} should reject in a closed period`);
        assertEqual(
          result.ok ? '' : result.error.code,
          canonicalClosedAccountingPeriodErrorCode,
          `${entry.operation} should use the canonical closed-period code`
        );
        assertEqual(
          repository.readState().sourceRecords.length,
          sourceRecords.length,
          `${entry.operation} should not insert or remove source rows after rejection`
        );
        assertEqual(
          repository.readState().sourceMutationEvents.length,
          1,
          `${entry.operation} should persist one source rejection audit event`
        );
        assertEqual(
          repository.readState().sourceMutationEvents[0]?.eventType,
          'source_mutation_rejected',
          `${entry.operation} should write a rejection event`
        );

        const evidence = buildFinanceSourceMutationRepositoryApiEvidence(entry);
        assertEqual(
          evidence.usesUnifiedPersistenceMutation,
          true,
          `${entry.operation} should declare unified persistence mutation path evidence`
        );
      }
    }
  },
  {
    name: 'creates open-period source rows through the same repository mutation contract',
    run: () => {
      const operation = operationFromRegistry('新增应收应付事项');
      const repository = createInMemoryPeriodCloseRepository(createState());
      const first = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-create-source-open'),
        operation,
        repository,
        request: {
          amount: '6800.00',
          sourceId: 'rp-created-001',
          sourceNo: 'AR-202606-NEW',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(first.ok, true, 'open-period create source mutation should pass');
      assertEqual(repository.readState().sourceRecords.length, 1, 'create should insert one source row');
      assertEqual(
        repository.readState().sourceRecords[0]?.status,
        operation.successStatus,
        'create should use the route success status'
      );
      assertEqual(repository.readState().sourceRecords[0]?.version, 1, 'created source row should start at version 1');

      const duplicate = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-create-source-duplicate'),
        operation,
        repository,
        request: {
          amount: '6800.00',
          sourceId: 'rp-created-001',
          sourceNo: 'AR-202606-NEW',
          targetAccountingPeriod: '2026-06'
        }
      });

      assertEqual(duplicate.ok, false, 'duplicate create should reject');
      assertEqual(
        duplicate.ok ? '' : duplicate.error.code,
        'SOURCE_VERSION_CONFLICT',
        'duplicate create should keep source-version conflict semantics'
      );
      assertEqual(repository.readState().sourceRecords.length, 1, 'duplicate create should not insert another row');
    }
  },
  {
    name: 'checks target period before updating an open source period',
    run: () => {
      const operation = operationFromRegistry('调整应收应付事项');
      const repository = createInMemoryPeriodCloseRepository(
        createState({
          periods: [createPeriod(), createPeriod({ period: '2026-07', status: '已结账' })],
          sourceRecords: [
            createSourceRecord({
              id: 'rp-open-source',
              sourceArea: operation.sourceArea,
              sourceNo: 'AR-202606-OPEN'
            })
          ]
        })
      );
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-target-period-closed'),
        operation,
        repository,
        request: {
          amount: '1500.00',
          expectedVersion: 1,
          sourceId: 'rp-open-source',
          targetAccountingPeriod: '2026-07'
        }
      });

      assertEqual(result.ok, false, 'closed target period should reject source mutation');
      assertEqual(
        result.ok ? '' : result.error.code,
        canonicalClosedAccountingPeriodErrorCode,
        'closed target period should use canonical closed-period code'
      );
      assertEqual(repository.readState().sourceRecords[0]?.accountingPeriod, '2026-06', 'source period should stay unchanged');
      assertEqual(repository.readState().sourceRecords[0]?.amount, '1000.00', 'source amount should stay unchanged');
      assertEqual(repository.readState().sourceMutationEvents.length, 1, 'target-period rejection should be audited');
    }
  },
  {
    name: 'rejects target-period-required creates before inserting incomplete source rows',
    run: () => {
      const operation = operationFromRegistry('导入税务发票数据');
      const repository = createInMemoryPeriodCloseRepository(createState());
      const result = applyFinanceSourceMutationRepositoryApi({
        context: createContext('req-create-source-missing-period'),
        operation,
        repository,
        request: {
          amount: '2000.00',
          sourceId: 'invoice-import-001',
          sourceNo: 'INV-IMPORT-001'
        }
      });

      assertEqual(result.ok, false, 'missing target period should reject create');
      assertEqual(
        result.ok ? '' : result.error.code,
        'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED',
        'missing target period should use unresolved-period code'
      );
      assertEqual(repository.readState().sourceRecords.length, 0, 'missing-period create should not insert source rows');
      assertEqual(
        repository.readState().sourceMutationEvents.length,
        0,
        'unresolved period create should not write an incomplete audit event'
      );
    }
  }
];

assert(financeSourceMutationOperationRegistry.length > 0, 'source mutation registry should not be empty');
assert(
  new Set(financeSourceMutationOperationRegistry.map((entry) => entry.operation)).size ===
    financeSourceMutationOperationRegistry.length,
  'source mutation operation names should be unique'
);
assert(
  new Set(financeSourceMutationOperationRegistry.map((entry) => entry.sourceArea as FinanceSourceMutationArea)).size > 1,
  'source mutation registry should cover multiple source areas'
);

for (const test of tests) {
  test.run();
}
