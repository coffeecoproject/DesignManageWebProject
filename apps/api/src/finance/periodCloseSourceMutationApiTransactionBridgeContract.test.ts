import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord } from './periodCloseContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import type { PeriodClosePersistentState } from './periodClosePersistenceContract.js';
import { getDefaultFinanceSourceTableName } from './periodCloseSourceTableRepositoryContract.js';
import {
  createFinanceSourceTableSqlRepositoryContract,
  type FinanceSourceTableSqlRow
} from './periodCloseSourceTableSqlRepositoryContract.js';
import {
  handleFinanceSourceMutationApiTransactionBridge,
  validateFinanceSourceMutationApiTransactionBridgeTrace,
  type FinanceSourceMutationApiTransactionBridgeContext
} from './periodCloseSourceMutationApiTransactionBridgeContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(message);
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

function createClosedPeriod(period = '2026-06'): AccountingPeriodRecord {
  return createPeriod({
    closeCheckSnapshotHash: `chk-${period}`,
    closeCheckSnapshotId: `close-check-${period}`,
    closeReason: `${period} 月结`,
    closedAt: `${period}-30T18:00:00+08:00`,
    closedBySnapshot: { id: 'user-001', name: '李明' },
    period,
    status: '已结账'
  });
}

function createCloseSnapshot(
  period = '2026-06'
): PeriodClosePersistentState['closeCheckSnapshots'][number] {
  return {
    canClose: true,
    checkSnapshotHash: `chk-${period}`,
    checks: [],
    computedAt: `${period}-30T17:50:00+08:00`,
    createdAt: `${period}-30T18:00:00+08:00`,
    id: `close-check-${period}`,
    persistedForClose: true,
    period,
    requestId: `req-close-${period}`,
    runType: 'close_snapshot',
    sourceVersionSetHash: `source-version-${period}`,
    status: '通过',
    trialBalance: {
      creditTotal: '0.00',
      debitTotal: '0.00',
      difference: '0.00',
      status: '平衡'
    }
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

function createContext(
  overrides: Partial<FinanceSourceMutationApiTransactionBridgeContext> = {}
): FinanceSourceMutationApiTransactionBridgeContext {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-06T11:00:00+08:00',
    permissionScopes: [...financePeriodClosePermissionScopes],
    requestId: 'req-source-api-transaction-bridge',
    ...overrides
  };
}

function createSqlRow(overrides: Partial<FinanceSourceTableSqlRow> = {}): FinanceSourceTableSqlRow {
  return {
    accounting_period: '2026-06',
    amount: '1000.00',
    id: 'source-bridge-001',
    source_no: 'AR-202606-BRIDGE',
    status: '未结清',
    tableName: getDefaultFinanceSourceTableName('receivable_payable'),
    updated_at: '2026-07-06T10:50:00+08:00',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects invalid source API payload before service transaction bridge delegation',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:01:00+08:00',
        initialRows: [createSqlRow({ id: 'source-invalid-payload' })]
      });
      const response = handleFinanceSourceMutationApiTransactionBridge({
        context: createContext({ requestId: 'req-source-bridge-invalid-payload' }),
        initialState: createState(),
        request: {
          body: {
            amount: 1200,
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/source-invalid-payload/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 400, 'invalid source API bridge payload should reject');
      assertObject(response.body, 'invalid source API bridge body should be object');
      assertEqual(response.body.code, 'INVALID_REQUEST', 'invalid source API bridge should use stable error');
      assertEqual(response.serviceTransaction, undefined, 'invalid source API bridge should not enter service transaction');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'invalid source API bridge should not write SQL row');
      assertEqual(
        validateFinanceSourceMutationApiTransactionBridgeTrace({
          delegated: false,
          trace: response.trace,
          writeback: false
        }).length,
        0,
        'invalid source API bridge trace should be valid'
      );
    }
  },
  {
    name: 'writes SQL source rows only after open-period service transaction commits',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:02:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '800.00',
            id: 'source-open-bridge',
            status: '待调整',
            version: 2
          })
        ]
      });
      const response = handleFinanceSourceMutationApiTransactionBridge({
        context: createContext({ requestId: 'req-source-bridge-open' }),
        initialState: createState(),
        request: {
          body: {
            amount: '1200.00',
            expectedVersion: 2,
            status: '已调整',
            targetAccountingPeriod: '2026-06'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/source-open-bridge/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 200, 'open-period source API bridge should pass');
      assertEqual(response.serviceTransaction?.status, 'committed', 'open-period bridge should commit service transaction');
      assertEqual(response.sourceSqlRows[0]?.amount, '1200.00', 'open-period bridge should write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.status, '已调整', 'open-period bridge should write SQL status');
      assertEqual(response.sourceSqlRows[0]?.version, 3, 'open-period bridge should bump SQL version after commit');
      assertEqual(
        validateFinanceSourceMutationApiTransactionBridgeTrace({
          delegated: true,
          trace: response.trace,
          writeback: true
        }).length,
        0,
        'open-period source API bridge trace should be valid'
      );
    }
  },
  {
    name: 'keeps SQL source rows unchanged when service transaction returns closed-period rejection',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:03:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '3200.00',
            id: 'source-closed-bridge',
            version: 4
          })
        ]
      });
      const response = handleFinanceSourceMutationApiTransactionBridge({
        context: createContext({ requestId: 'req-source-bridge-closed' }),
        initialState: createState({
          closeCheckSnapshots: [createCloseSnapshot()],
          periods: [createClosedPeriod(), createPeriod({ period: '2026-07' })]
        }),
        request: {
          body: {
            amount: '3600.00',
            expectedVersion: 4,
            targetAccountingPeriod: '2026-06'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/source-closed-bridge/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 409, 'closed-period source API bridge should reject');
      assertObject(response.body, 'closed-period source API bridge body should be object');
      assertEqual(response.body.code, canonicalClosedAccountingPeriodErrorCode, 'closed-period bridge code should match');
      assertEqual(response.serviceTransaction?.status, 'committed', 'closed-period guard audit should commit');
      assertEqual(response.sourceSqlRows[0]?.amount, '3200.00', 'closed-period bridge should not write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.version, 4, 'closed-period bridge should not bump SQL version');
      assertEqual(
        validateFinanceSourceMutationApiTransactionBridgeTrace({
          delegated: true,
          trace: response.trace,
          writeback: false
        }).length,
        0,
        'closed-period source API bridge trace should be valid without writeback'
      );
    }
  },
  {
    name: 'does not write SQL source rows when service transaction driver fails',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:04:00+08:00',
        initialRows: [
          createSqlRow({
            id: 'source-driver-failed-bridge',
            version: 1
          })
        ]
      });
      const response = handleFinanceSourceMutationApiTransactionBridge({
        context: createContext({ requestId: 'req-source-bridge-driver-failure' }),
        failOnStatement: 'lock_accounting_period_for_update',
        initialState: createState(),
        request: {
          body: {
            amount: '1500.00',
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/source-driver-failed-bridge/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 503, 'driver failure should surface as retryable service error');
      assertObject(response.body, 'driver failure source API bridge body should be object');
      assertEqual(response.body.code, 'DB_TRANSACTION_FAILED', 'driver failure source API bridge code should match');
      assertEqual(response.serviceTransaction?.status, 'driver_failed', 'driver failure should expose service status');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'driver failure should not write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'driver failure should not bump SQL version');
    }
  },
  {
    name: 'inserts create-type SQL source row only after service transaction commits',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T11:05:00+08:00',
        initialRows: []
      });
      const response = handleFinanceSourceMutationApiTransactionBridge({
        context: createContext({ requestId: 'req-source-bridge-create' }),
        initialState: createState(),
        request: {
          body: {
            amount: '2100.00',
            sourceId: 'invoice-bridge-create',
            sourceNo: 'INV-BRIDGE-CREATE',
            targetAccountingPeriod: '2026-06'
          },
          method: 'POST',
          path: '/api/finance/invoices/import'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 201, 'create-type bridge should return created');
      assertEqual(response.serviceTransaction?.status, 'committed', 'create-type bridge should commit service transaction');
      assertEqual(response.sourceSqlRows.length, 1, 'create-type bridge should insert SQL row after commit');
      assertEqual(
        response.sourceSqlRows[0]?.tableName,
        getDefaultFinanceSourceTableName('invoice_ledger'),
        'create-type bridge should insert into invoice-ledger SQL table'
      );
      assertEqual(response.sourceSqlRows[0]?.accounting_period, '2026-06', 'create-type bridge should persist target period');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'create-type bridge should start with version 1');
    }
  }
];

for (const test of tests) {
  test.run();
}
