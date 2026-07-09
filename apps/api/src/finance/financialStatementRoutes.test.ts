import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import {
  handleFinancialStatementRoute,
  type FinancialStatementRouteState,
  type FinancialStatementServerContext
} from './financialStatementRoutes.js';
import type { CashFlowMappingRecord, FinancialStatementLedgerEntry } from './financialStatementContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';

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

const actor: ActorSnapshot = { id: 'user-001', name: '李明' };

function createContext(overrides: Partial<FinancialStatementServerContext> = {}): FinancialStatementServerContext {
  return {
    actorSnapshot: actor,
    now: '2026-07-02T18:30:00+08:00',
    permissionScopes: [...financePeriodClosePermissionScopes],
    requestId: 'req-financial-statement-route-001',
    ...overrides
  };
}

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '已结账',
    version: 3,
    ...overrides
  };
}

function createMapping(overrides: Partial<CashFlowMappingRecord> = {}): CashFlowMappingRecord {
  return {
    activity: '经营活动',
    createdAt: '2026-07-02T10:00:00+08:00',
    createdBySnapshot: actor,
    effectivePeriod: '2026-01',
    item: '销售商品、提供劳务收到的现金',
    status: '有效',
    subjectCode: '1122',
    version: 1,
    ...overrides
  };
}

function createLedgerEntries(overrides: Partial<FinancialStatementLedgerEntry>[] = []): FinancialStatementLedgerEntry[] {
  return [
    {
      accountingPeriod: '2026-06',
      creditAmount: '0.00',
      debitAmount: '1200.00',
      subjectCode: '1002',
      voucherId: 'voucher-receipt-001',
      voucherNo: '记-202606-001',
      ...overrides[0]
    },
    {
      accountingPeriod: '2026-06',
      creditAmount: '1200.00',
      debitAmount: '0.00',
      subjectCode: '1122',
      voucherId: 'voucher-receipt-001',
      voucherNo: '记-202606-001',
      ...overrides[1]
    }
  ];
}

function createRouteState(overrides: Partial<FinancialStatementRouteState> = {}): FinancialStatementRouteState {
  return {
    cashFlowMappings: [createMapping()],
    ledgerEntries: createLedgerEntries(),
    periods: [createPeriod()],
    statementLineInputs: {
      '2026-06': {
        balanceSheetLines: [
          {
            amount: '1200.00',
            item: '应收账款',
            section: '资产',
            sourceSubjectCodes: ['1122'],
            voucherNos: ['记-202606-001']
          }
        ],
        profitStatementLines: []
      }
    },
    statementSnapshots: [],
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects financial statement routes before business logic when required permission is missing',
    run: () => {
      const response = handleFinancialStatementRoute({
        context: createContext({ permissionScopes: [] }),
        request: {
          method: 'GET',
          path: '/api/finance/financial-statements/2026-06/readiness'
        },
        state: createRouteState()
      });

      assertEqual(response.status, 403, 'readiness route should require statement read permission');
      assertObject(response.body, 'forbidden body should be an object');
      assertEqual(response.body.code, 'FORBIDDEN', 'forbidden response should use stable code');
      assertEqual(response.state.statementSnapshots.length, 0, 'forbidden read should not mutate snapshots');
    }
  },
  {
    name: 'reads statement readiness with cash-flow mapping gaps and formal snapshot eligibility',
    run: () => {
      const response = handleFinancialStatementRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/financial-statements/2026-06/readiness'
        },
        state: createRouteState({
          cashFlowMappings: [],
          ledgerEntries: createLedgerEntries([{ subjectCode: '1002' }, { subjectCode: '9999' }])
        })
      });

      assertEqual(response.status, 200, 'readiness route should return 200');
      assertObject(response.body, 'readiness body should be an object');
      assertEqual(response.body.status, '需处理', 'readiness should expose mapping issue status');
      assertEqual(response.body.canGenerateSnapshot, false, 'readiness should block missing cash-flow mapping');
      assertEqual(response.body.canGenerateFormalSnapshot, false, 'formal snapshot should not be eligible with gaps');
      assertEqual((response.body.cashFlowMappingGaps as unknown[]).length, 1, 'readiness should expose one mapping gap');
    }
  },
  {
    name: 'rejects snapshot generation when displayed readiness hashes are stale',
    run: () => {
      const response = handleFinancialStatementRoute({
        context: createContext(),
        request: {
          body: {
            expectedCashFlowMappingVersionHash: 'chk_stale_mapping',
            expectedSourceLedgerHash: 'chk_stale_ledger'
          },
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        },
        state: createRouteState()
      });

      assertEqual(response.status, 409, 'stale readiness should return conflict');
      assertObject(response.body, 'stale response body should be an object');
      assertEqual(
        response.body.code,
        'FINANCIAL_STATEMENT_READINESS_STALE',
        'stale readiness should use stable code'
      );
      assertEqual(response.state.statementSnapshots.length, 0, 'stale request should not create snapshot');
    }
  },
  {
    name: 'rejects formal snapshot generation before period close',
    run: () => {
      const response = handleFinancialStatementRoute({
        context: createContext(),
        request: {
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        },
        state: createRouteState({
          periods: [createPeriod({ status: '开放' })]
        })
      });

      assertEqual(response.status, 422, 'open-period snapshot should return validation failure');
      assertObject(response.body, 'open-period snapshot body should be an object');
      assertEqual(
        response.body.code,
        'FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED',
        'open-period snapshot should use stable code'
      );
      assertEqual(response.state.statementSnapshots.length, 0, 'open period should not create snapshot');
    }
  },
  {
    name: 'creates and reads latest closed-period statement snapshot without drift',
    run: () => {
      const createResponse = handleFinancialStatementRoute({
        context: createContext(),
        request: {
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        },
        state: createRouteState()
      });

      assertEqual(createResponse.status, 201, 'closed-period snapshot should be created');
      assertObject(createResponse.body, 'create snapshot body should be an object');
      const createdSnapshot = (createResponse.body as { snapshot: Record<string, unknown> }).snapshot;
      const originalSnapshotHash = createdSnapshot.snapshotHash;

      const readResponse = handleFinancialStatementRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/financial-statements/2026-06/snapshots/latest'
        },
        state: {
          ...createResponse.state,
          cashFlowMappings: [createMapping({ item: '调整后的现金流映射', version: 2 })],
          ledgerEntries: createLedgerEntries([
            { debitAmount: '9999.00' },
            { creditAmount: '9999.00' }
          ])
        }
      });

      assertEqual(readResponse.status, 200, 'latest snapshot route should return 200');
      assertObject(readResponse.body, 'latest snapshot body should be an object');
      const latestSnapshot = (readResponse.body as { snapshot: Record<string, unknown> }).snapshot;
      const cashFlowLines = latestSnapshot.cashFlowLines as Array<Record<string, unknown>>;
      const generalLedgerLines = latestSnapshot.generalLedgerLines as Array<Record<string, unknown>>;

      assertEqual(latestSnapshot.snapshotHash, originalSnapshotHash, 'readback snapshot hash should not drift');
      assertEqual(generalLedgerLines.length, 2, 'readback snapshot should include original general-ledger lines');
      assertEqual(
        generalLedgerLines.find((line) => line.subjectCode === '1002')?.debitAmount,
        '1200.00',
        'readback general-ledger snapshot should not drift with current ledger entries'
      );
      assertEqual(
        cashFlowLines[0]?.item,
        '销售商品、提供劳务收到的现金',
        'readback snapshot should preserve original mapping item'
      );
    }
  },
  {
    name: 'replays existing snapshot instead of rewriting closed-period snapshot',
    run: () => {
      const createResponse = handleFinancialStatementRoute({
        context: createContext(),
        request: {
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        },
        state: createRouteState()
      });
      const replayResponse = handleFinancialStatementRoute({
        context: createContext({ now: '2026-07-03T10:00:00+08:00' }),
        request: {
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        },
        state: {
          ...createResponse.state,
          cashFlowMappings: [createMapping({ item: '调整后的现金流映射', version: 2 })]
        }
      });

      assertEqual(replayResponse.status, 200, 'existing snapshot should replay');
      assertObject(replayResponse.body, 'replay body should be an object');
      assertEqual(replayResponse.body.replayed, true, 'replay body should mark existing snapshot');
      assertEqual(replayResponse.state.statementSnapshots.length, 1, 'replay should not append duplicate snapshot');
    }
  }
];

for (const test of tests) {
  test.run();
}
