import {
  createPeriodCloseDbClientRepositoryContract,
  validatePeriodCloseDbClientRepositoryTrace
} from './periodCloseDbClientRepositoryContract.js';
import { createInMemoryPeriodCloseSqlDriverExecutor } from './periodCloseSqlDriverRepositoryContract.js';
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
    idempotencyKey: 'idem-close-db-client',
    now: '2026-07-02T22:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-db-client',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'wraps close in DB client transaction and matches driver commit',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
      const result = clientRepository.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-db-client-close'
      });

      assertEqual(result.repositoryResult.driverOk, true, 'DB client close should reach driver adapter');
      assertEqual(result.clientEvents.at(-1)?.event, 'release_connection', 'DB client should release connection last');
      assertEqual(
        validatePeriodCloseDbClientRepositoryTrace({
          clientEvents: result.clientEvents,
          driverExecutions: result.driverExecutions
        }).length,
        0,
        'DB client close trace should be valid'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '已结账',
        'DB client repository should commit the close'
      );
    }
  },
  {
    name: 'rolls back DB client transaction when close version is stale',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
      const result = clientRepository.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest({ version: 99 }),
        transactionId: 'tx-db-client-stale-close'
      });

      assertEqual(result.repositoryResult.driverOk, true, 'stale close should still run through DB client');

      if (!result.repositoryResult.driverOk) {
        return;
      }

      assertEqual(result.repositoryResult.result.ok, false, 'stale close should fail domain transaction');
      assert(
        result.clientEvents.some((event) => event.event === 'rollback_transaction'),
        'DB client should rollback stale close'
      );
      assertEqual(
        validatePeriodCloseDbClientRepositoryTrace({
          clientEvents: result.clientEvents,
          driverExecutions: result.driverExecutions
        }).length,
        0,
        'stale close DB client trace should be valid'
      );
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'stale close should not mutate period'
      );
    }
  },
  {
    name: 'commits DB client transaction for closed-period source guard audit without source mutation',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor();
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });

      clientRepository.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-db-client-close-before-source'
      });

      const result = clientRepository.guardSourceMutation({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T22:35:00+08:00',
          requestId: 'req-db-client-source-guard'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        transactionId: 'tx-db-client-source-guard'
      });

      assertEqual(result.repositoryResult.driverOk, true, 'source guard should run through DB client');

      if (!result.repositoryResult.driverOk) {
        return;
      }

      assertEqual(result.repositoryResult.result.ok, true, 'source guard audit transaction should commit');
      assertEqual(result.repositoryResult.result.ok ? result.repositoryResult.result.value.ok : true, false, 'source mutation should be rejected');
      assert(
        result.clientEvents.some((event) => event.event === 'commit_transaction'),
        'DB client should commit closed-period guard audit'
      );
      assertEqual(repository.readDatabaseSnapshot().sourceRecords[0]?.amount, '1000.00', 'source amount should remain unchanged');
    }
  },
  {
    name: 'rolls back and releases DB client transaction on driver failure',
    run: () => {
      const driver = createInMemoryPeriodCloseSqlDriverExecutor({ failOnStatement: 'lock_accounting_period_for_update' });
      const repository = createPeriodCloseSqlRepositoryContract({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        initialState: createState()
      });
      const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
      const result = clientRepository.closeAccountingPeriod({
        period: '2026-06',
        request: createCloseRequest(),
        transactionId: 'tx-db-client-driver-failure'
      });

      assertEqual(result.repositoryResult.driverOk, false, 'driver failure should be surfaced through DB client');
      assertEqual(result.clientEvents.at(-2)?.event, 'rollback_transaction', 'DB client should rollback driver failure');
      assertEqual(result.clientEvents.at(-1)?.event, 'release_connection', 'DB client should release after rollback');
      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'driver failure should not mutate period'
      );
    }
  },
  {
    name: 'detects invalid DB client transaction traces',
    run: () => {
      const errors = validatePeriodCloseDbClientRepositoryTrace({
        clientEvents: [
          {
            event: 'begin_transaction',
            operation: 'close_accounting_period',
            period: '2026-06',
            sequence: 1,
            transactionId: 'tx-broken-db-client'
          },
          {
            event: 'release_connection',
            operation: 'close_accounting_period',
            period: '2026-06',
            sequence: 2,
            transactionId: 'tx-broken-db-client'
          }
        ],
        driverExecutions: []
      });

      assert(errors.length >= 3, 'broken DB client trace should fail validation');
    }
  }
];

for (const test of tests) {
  test.run();
}
