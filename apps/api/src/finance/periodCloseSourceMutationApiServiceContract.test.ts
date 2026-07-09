import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord } from './periodCloseContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import type { PeriodClosePersistentState } from './periodClosePersistenceContract.js';
import {
  financeSourceMutationRouteDefinitions
} from './periodCloseSourceMutationRoutes.js';
import { financeSourceMutationOperationRegistry } from './periodCloseSourceMutationRegistry.js';
import { getDefaultFinanceSourceTableName } from './periodCloseSourceTableRepositoryContract.js';
import {
  createFinanceSourceTableSqlRepositoryContract,
  validateFinanceSourceTableSqlContracts,
  type FinanceSourceTableSqlRow
} from './periodCloseSourceTableSqlRepositoryContract.js';
import {
  handleFinanceSourceMutationApiService,
  validateFinanceSourceMutationApiServiceTrace,
  type FinanceSourceMutationApiServiceContext
} from './periodCloseSourceMutationApiServiceContract.js';

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

function createContext(overrides: Partial<FinanceSourceMutationApiServiceContext> = {}): FinanceSourceMutationApiServiceContext {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-06T09:00:00+08:00',
    permissionScopes: [...financePeriodClosePermissionScopes],
    requestId: 'req-source-api-service',
    ...overrides
  };
}

function createSqlRow(overrides: Partial<FinanceSourceTableSqlRow> = {}): FinanceSourceTableSqlRow {
  return {
    accounting_period: '2026-06',
    amount: '1000.00',
    id: 'source-api-001',
    source_no: 'AR-202606-001',
    status: '未结清',
    tableName: getDefaultFinanceSourceTableName('receivable_payable'),
    updated_at: '2026-07-06T08:50:00+08:00',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'aligns source API service route catalog with operation registry and SQL source tables',
    run: () => {
      const routeOperations = new Set(financeSourceMutationRouteDefinitions.map((definition) => definition.operation));
      const sqlContractErrors = validateFinanceSourceTableSqlContracts();

      assertEqual(sqlContractErrors.length, 0, 'source API service should start from valid SQL source-table contracts');

      for (const entry of financeSourceMutationOperationRegistry) {
        assert(routeOperations.has(entry.operation), `${entry.operation} should have a source API route`);
      }
    }
  },
  {
    name: 'rejects unauthorized direct source API request before repository guard and SQL write',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T09:01:00+08:00',
        initialRows: [createSqlRow({ id: 'rp-auth-denied' })]
      });
      const response = handleFinanceSourceMutationApiService({
        context: createContext({
          permissionScopes: ['finance.accountingPeriod.read'],
          requestId: 'req-source-api-auth-denied'
        }),
        initialState: createState(),
        request: {
          body: {
            amount: '1200.00',
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-auth-denied/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 403, 'unauthorized source API request should be forbidden');
      assertObject(response.body, 'unauthorized source API body should be object');
      assertEqual(response.body.code, 'FORBIDDEN', 'unauthorized source API should use FORBIDDEN');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'unauthorized request should not write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.version, 1, 'unauthorized request should not bump SQL version');
      assertEqual(
        response.trace.some((event) => event.event === 'delegate_repository_guard'),
        false,
        'unauthorized request should not delegate to repository guard'
      );
      assertEqual(validateFinanceSourceMutationApiServiceTrace({ delegated: false, trace: response.trace }).length, 0, 'unauthorized trace should still return last');
    }
  },
  {
    name: 'rejects invalid direct source API payload before authorization and SQL hydration',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T09:01:30+08:00',
        initialRows: [createSqlRow({ id: 'rp-invalid-payload' })]
      });
      const response = handleFinanceSourceMutationApiService({
        context: createContext({ requestId: 'req-source-api-invalid-payload' }),
        initialState: createState(),
        request: {
          body: {
            amount: 1200,
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-invalid-payload/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 400, 'invalid direct source API payload should reject');
      assertObject(response.body, 'invalid direct source API body should be object');
      assertEqual(response.body.code, 'INVALID_REQUEST', 'invalid direct source API should use stable error code');
      assertEqual(response.sourceSqlRows[0]?.amount, '1000.00', 'invalid direct source API should not write SQL amount');
      assertEqual(
        response.trace.some((event) => event.event === 'authorize_source_mutation'),
        false,
        'invalid direct source API should not authorize malformed payload'
      );
      assertEqual(
        response.trace.some((event) => event.event === 'hydrate_source_sql_repository'),
        false,
        'invalid direct source API should not hydrate repository for malformed payload'
      );
    }
  },
  {
    name: 'rejects closed-period direct source API request and keeps SQL source row unchanged',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T09:02:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '3200.00',
            id: 'rp-closed-api',
            source_no: 'AR-202606-CLOSED',
            version: 3
          })
        ]
      });
      const response = handleFinanceSourceMutationApiService({
        context: createContext({ requestId: 'req-source-api-closed' }),
        initialState: createState({
          periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })]
        }),
        request: {
          body: {
            amount: '3600.00',
            expectedVersion: 3,
            targetAccountingPeriod: '2026-06'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-closed-api/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 409, 'closed-period source API request should conflict');
      assertObject(response.body, 'closed-period source API body should be object');
      assertEqual(response.body.code, canonicalClosedAccountingPeriodErrorCode, 'closed-period source API should use canonical error code');
      assertEqual(response.sourceSqlRows[0]?.amount, '3200.00', 'closed-period source API should not write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.version, 3, 'closed-period source API should not bump SQL version');
      assertEqual(response.state?.sourceMutationEvents.length, 1, 'closed-period source API should persist one rejection audit event');
      assertEqual(
        validateFinanceSourceMutationApiServiceTrace({ delegated: true, trace: response.trace }).length,
        0,
        'closed-period source API should follow full delegated trace'
      );
    }
  },
  {
    name: 'writes SQL source row for open-period direct API mutation',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T09:03:00+08:00',
        initialRows: [
          createSqlRow({
            amount: '800.00',
            id: 'rp-open-api',
            source_no: 'AR-202606-OPEN',
            status: '待调整',
            version: 2
          })
        ]
      });
      const response = handleFinanceSourceMutationApiService({
        context: createContext({ requestId: 'req-source-api-open' }),
        initialState: createState(),
        request: {
          body: {
            amount: '1200.00',
            expectedVersion: 2,
            targetAccountingPeriod: '2026-07'
          },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-open-api/adjust'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 200, 'open-period source API mutation should pass');
      assertObject(response.body, 'open-period source API body should be object');
      assertEqual(response.body.status, '已调整', 'open-period source API should return success status');
      assertEqual(response.sourceSqlRows[0]?.amount, '1200.00', 'open-period source API should write SQL amount');
      assertEqual(response.sourceSqlRows[0]?.status, '已调整', 'open-period source API should write SQL status');
      assertEqual(response.sourceSqlRows[0]?.version, 3, 'open-period source API should bump SQL version');
      assertEqual(response.state?.sourceMutationEvents[0]?.eventType, 'source_mutation_applied', 'open-period source API should persist applied event');
    }
  },
  {
    name: 'inserts create-type SQL source rows only after direct API target period is resolved and open',
    run: () => {
      const sourceSqlRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T09:04:00+08:00',
        initialRows: []
      });
      const response = handleFinanceSourceMutationApiService({
        context: createContext({ requestId: 'req-source-api-create' }),
        initialState: createState(),
        request: {
          body: {
            amount: '2000.00',
            sourceId: 'invoice-import-api',
            sourceNo: 'INV-IMPORT-API',
            targetAccountingPeriod: '2026-06'
          },
          method: 'POST',
          path: '/api/finance/invoices/import'
        },
        sourceSqlRepository
      });

      assertEqual(response.status, 201, 'open-period create source API mutation should create');
      assertEqual(response.sourceSqlRows.length, 1, 'open-period create source API should insert SQL row');
      assertEqual(
        response.sourceSqlRows[0]?.tableName,
        getDefaultFinanceSourceTableName('invoice_ledger'),
        'create source API should write to invoice-ledger SQL source table'
      );
      assertEqual(response.sourceSqlRows[0]?.accounting_period, '2026-06', 'create source API should persist target accounting period');

      const unresolvedRepository = createFinanceSourceTableSqlRepositoryContract({
        fallbackUpdatedAt: '2026-07-06T09:05:00+08:00',
        initialRows: []
      });
      const unresolved = handleFinanceSourceMutationApiService({
        context: createContext({ requestId: 'req-source-api-create-unresolved' }),
        initialState: createState(),
        request: {
          body: {
            amount: '2000.00',
            sourceId: 'invoice-import-unresolved',
            sourceNo: 'INV-IMPORT-UNRESOLVED'
          },
          method: 'POST',
          path: '/api/finance/invoices/import'
        },
        sourceSqlRepository: unresolvedRepository
      });

      assertEqual(unresolved.status, 400, 'missing target period create source API should reject');
      assertObject(unresolved.body, 'unresolved source API body should be object');
      assertEqual(unresolved.body.code, 'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED', 'unresolved source API should use stable error code');
      assertEqual(unresolved.sourceSqlRows.length, 0, 'unresolved source API should not insert SQL rows');
    }
  }
];

for (const test of tests) {
  test.run();
}
