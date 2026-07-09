import {
  createFinanceSqlRepositoryGateway,
  type FinanceSqlRepositoryGateway
} from './financeSqlRepositoryGatewayContract.js';
import {
  createRowBackedPeriodCloseRepository,
  type PeriodCloseDatabaseRepository
} from './periodCloseDatabaseRepositoryContract.js';
import { requiredCloseCheckCodes, type CloseCheckRow } from './periodCloseContract.js';
import type {
  PeriodCloseCheckInput,
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord
} from './periodClosePersistenceContract.js';
import type {
  AccountingGeneralLedgerEntrySqlRow,
  AccountingSubjectSqlRow,
  GeneralLedgerSqlRows
} from './generalLedgerSqlRepositoryContract.js';
import type {
  CashFlowMappingSqlRow,
  FinancialStatementSqlRows
} from './financialStatementSqlRepositoryContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createChecks(): CloseCheckRow[] {
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

function createCheckInput(): PeriodCloseCheckInput {
  return {
    checks: createChecks(),
    computedAt: '2026-06-30T20:00:00+08:00',
    sourceVersionSetHash: 'src_hash_202606',
    trialBalance: {
      creditTotal: '1200.00',
      debitTotal: '1200.00',
      difference: '0.00',
      status: '平衡'
    }
  };
}

function createPeriod(overrides: Partial<PersistentAccountingPeriodRecord> = {}): PersistentAccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createPeriodCloseRepository(
  overrides: Partial<PeriodClosePersistentState> = {}
): PeriodCloseDatabaseRepository {
  return createRowBackedPeriodCloseRepository({
    fallbackNow: '2026-07-04T20:00:00+08:00',
    initialState: {
      checkInputs: {
        '2026-06': createCheckInput()
      },
      closeCheckSnapshots: [],
      idempotencyRecords: [],
      periodEvents: [],
      periods: [createPeriod()],
      sourceMutationEvents: [],
      sourceRecords: [],
      ...overrides
    }
  });
}

function createSubject(overrides: Partial<AccountingSubjectSqlRow> = {}): AccountingSubjectSqlRow {
  return {
    balance_direction: '借方',
    code: '1002',
    created_at: '2026-06-01T09:00:00+08:00',
    name: '银行存款',
    report_item: '货币资金',
    statement_target: '资产负债表',
    status: '启用',
    type: '资产类',
    updated_at: '2026-06-01T09:00:00+08:00',
    ...overrides
  };
}

function createLedgerEntry(
  overrides: Partial<AccountingGeneralLedgerEntrySqlRow> = {}
): AccountingGeneralLedgerEntrySqlRow {
  return {
    accounting_period: '2026-06',
    auxiliary: '奈雪华南区域',
    created_at: '2026-06-10T10:00:00+08:00',
    credit_amount: '0.00',
    debit_amount: '1200.00',
    id: 'ledger-entry-1002-001',
    source_snapshot_hash: 'chk_source_snapshot_001',
    source_voucher_line_id: 'voucher-line-1002-001',
    subject_code: '1002',
    subject_name: '银行存款',
    summary: '客户回款确认',
    voucher_date: '2026-06-10',
    voucher_id: 'voucher-202606-001',
    voucher_no: '记-202606-001',
    ...overrides
  };
}

function createGeneralLedgerRows(): GeneralLedgerSqlRows {
  return {
    accounting_general_ledger_entries: [
      createLedgerEntry(),
      createLedgerEntry({
        credit_amount: '1200.00',
        debit_amount: '0.00',
        id: 'ledger-entry-1122-001',
        source_voucher_line_id: 'voucher-line-1122-001',
        subject_code: '1122',
        subject_name: '应收账款'
      })
    ],
    accounting_opening_balances: [],
    accounting_subjects: [
      createSubject(),
      createSubject({
        code: '1122',
        name: '应收账款',
        report_item: '应收账款',
        statement_target: '资产负债表'
      })
    ]
  };
}

function createMapping(overrides: Partial<CashFlowMappingSqlRow> = {}): CashFlowMappingSqlRow {
  return {
    activity: '经营活动',
    created_at: '2026-06-01T09:00:00+08:00',
    created_by: 'user-001',
    created_by_snapshot: { id: 'user-001', name: '李明' },
    effective_period: '2026-01',
    id: 'cash-flow-mapping-1122-v1',
    item: '销售商品、提供劳务收到的现金',
    status: '有效',
    subject_code: '1122',
    updated_at: '2026-06-01T09:00:00+08:00',
    version: 1,
    ...overrides
  };
}

function createFinancialStatementRows(
  overrides: Partial<FinancialStatementSqlRows> = {}
): FinancialStatementSqlRows {
  return {
    cash_flow_mapping_rules: [createMapping()],
    financial_statement_general_ledger_lines: [],
    financial_statement_snapshot_lines: [],
    financial_statement_snapshots: [],
    ...overrides
  };
}

function createGateway({
  financialStatementRows = createFinancialStatementRows(),
  generalLedgerRows = createGeneralLedgerRows(),
  periodRepository = createPeriodCloseRepository()
}: {
  financialStatementRows?: FinancialStatementSqlRows;
  generalLedgerRows?: GeneralLedgerSqlRows;
  periodRepository?: PeriodCloseDatabaseRepository;
} = {}): {
  gateway: FinanceSqlRepositoryGateway;
  periodRepository: PeriodCloseDatabaseRepository;
} {
  return {
    gateway: createFinanceSqlRepositoryGateway({
      financialStatementRows,
      generalLedgerRows,
      periodRepository
    }),
    periodRepository
  };
}

function closePeriod(gateway: FinanceSqlRepositoryGateway) {
  return gateway.handle({
    body: {
      idempotencyKey: 'idem-close-202606',
      reason: '月末结账',
      version: 1
    },
    headers: {
      'x-actor-id': 'user-001',
      'x-actor-name': '李明',
      'x-permission-scopes': 'finance.accountingPeriod.close',
      'x-request-id': 'req-close-202606',
      'x-request-time': '2026-06-30T21:00:00+08:00'
    },
    method: 'POST',
    path: '/api/finance/accounting-periods/2026-06/close'
  });
}

function generateSnapshot(gateway: FinanceSqlRepositoryGateway) {
  return gateway.handle({
    headers: {
      'x-actor-id': 'user-001',
      'x-actor-name': '李明',
      'x-permission-scopes': 'finance.financialStatement.generate',
      'x-request-id': 'req-statement-snapshot-202606',
      'x-request-time': '2026-07-01T10:00:00+08:00'
    },
    method: 'POST',
    path: '/api/finance/financial-statements/2026-06/snapshots'
  });
}

const tests: UnitTest[] = [
  {
    name: 'closes period then reads general ledger from committed period state and SQL rows',
    run: () => {
      const { gateway } = createGateway();
      const closeResponse = closePeriod(gateway);
      const ledgerResponse = gateway.handle({
        headers: {
          'x-permission-scopes': 'finance.generalLedger.read',
          'x-request-id': 'req-general-ledger-after-close',
          'x-request-time': '2026-07-01T09:00:00+08:00'
        },
        method: 'GET',
        path: '/api/finance/general-ledger/2026-06'
      });
      const ledgerBody = ledgerResponse.body as {
        readbackSource: string;
        trialBalance: { status: string };
      };

      assertEqual(closeResponse.status, 201, 'period close should commit through delegated row-backed gateway');
      assertEqual(ledgerResponse.status, 200, 'general ledger should read through SQL gateway');
      assertEqual(ledgerBody.readbackSource, '结账总账', 'general ledger should see the committed closed period');
      assertEqual(ledgerBody.trialBalance.status, '平衡', 'general ledger should use SQL ledger entries');
    }
  },
  {
    name: 'uses SQL ledger rows and persisted cash-flow mappings for statement readiness',
    run: () => {
      const { gateway } = createGateway();

      closePeriod(gateway);

      const readinessResponse = gateway.handle({
        headers: {
          'x-permission-scopes': 'finance.financialStatement.read',
          'x-request-id': 'req-statement-readiness-sql',
          'x-request-time': '2026-07-01T09:30:00+08:00'
        },
        method: 'GET',
        path: '/api/finance/financial-statements/2026-06/readiness'
      });
      const readinessBody = readinessResponse.body as {
        canGenerateFormalSnapshot: boolean;
        cashFlowLines: Array<{ item: string }>;
        generalLedgerLines: unknown[];
      };

      assertEqual(readinessResponse.status, 200, 'readiness should route through SQL-backed statement state');
      assertEqual(
        readinessBody.canGenerateFormalSnapshot,
        true,
        'closed period with SQL cash-flow mapping should be formally generatable'
      );
      assertEqual(
        readinessBody.cashFlowLines[0]?.item,
        '销售商品、提供劳务收到的现金',
        'cash-flow line should come from persisted mapping rows'
      );
      assertEqual(readinessBody.generalLedgerLines.length, 2, 'statement readiness should use SQL ledger entries');
    }
  },
  {
    name: 'writes statement snapshot to financial SQL rows and period-close candidate rows',
    run: () => {
      const { gateway } = createGateway();

      closePeriod(gateway);

      const snapshotResponse = generateSnapshot(gateway);
      const snapshotBody = snapshotResponse.body as {
        replayed: boolean;
        snapshot: { snapshotHash: string };
      };

      assertEqual(snapshotResponse.status, 201, 'first statement snapshot should be written');
      assertEqual(snapshotBody.replayed, false, 'first write should not replay');
      assertEqual(
        snapshotResponse.financialStatementRows.financial_statement_snapshots.length,
        1,
        'financial-statement SQL rows should persist snapshot row'
      );
      assertEqual(
        snapshotResponse.periodCloseSnapshot.periodCloseRows.financial_statement_snapshots.length,
        1,
        'period-close candidate rows should receive the same formal snapshot'
      );
      assertEqual(
        snapshotResponse.periodCloseSnapshot.periodCloseRows.financial_statement_snapshots[0]?.snapshot_hash,
        snapshotBody.snapshot.snapshotHash,
        'period-close row snapshot hash should match statement repository snapshot'
      );
    }
  },
  {
    name: 'replays persisted snapshot after cash-flow mapping changes without historical drift',
    run: () => {
      const first = createGateway();

      closePeriod(first.gateway);

      const firstSnapshotResponse = generateSnapshot(first.gateway);
      const firstSnapshotBody = firstSnapshotResponse.body as {
        snapshot: {
          cashFlowLines: Array<{ item: string }>;
          snapshotHash: string;
        };
      };
      const replay = createGateway({
        financialStatementRows: {
          ...firstSnapshotResponse.financialStatementRows,
          cash_flow_mapping_rules: [createMapping({ id: 'cash-flow-mapping-1122-v2', item: '调整后的映射', version: 2 })]
        },
        periodRepository: first.periodRepository
      });
      const replayResponse = generateSnapshot(replay.gateway);
      const replayBody = replayResponse.body as {
        replayed: boolean;
        snapshot: {
          cashFlowLines: Array<{ item: string }>;
          snapshotHash: string;
        };
      };

      assertEqual(firstSnapshotResponse.status, 201, 'first snapshot should be created before replay');
      assertEqual(replayResponse.status, 200, 'existing snapshot should replay');
      assertEqual(replayBody.replayed, true, 'snapshot generation should replay persisted rows');
      assertEqual(
        replayBody.snapshot.snapshotHash,
        firstSnapshotBody.snapshot.snapshotHash,
        'snapshot hash should stay stable after later mapping changes'
      );
      assertEqual(
        replayBody.snapshot.cashFlowLines[0]?.item,
        '销售商品、提供劳务收到的现金',
        'replayed snapshot should keep original cash-flow mapping item'
      );
    }
  },
  {
    name: 'rejects statement snapshot without permission before writing SQL rows',
    run: () => {
      const { gateway } = createGateway();

      closePeriod(gateway);

      const response = gateway.handle({
        headers: {
          'x-permission-scopes': 'finance.financialStatement.read',
          'x-request-id': 'req-statement-denied',
          'x-request-time': '2026-07-01T10:00:00+08:00'
        },
        method: 'POST',
        path: '/api/finance/financial-statements/2026-06/snapshots'
      });

      assertEqual(response.status, 403, 'missing generate permission should be rejected');
      assertEqual(
        response.financialStatementRows.financial_statement_snapshots.length,
        0,
        'forbidden request should not write statement SQL rows'
      );
      assertEqual(
        response.periodCloseSnapshot.periodCloseRows.financial_statement_snapshots.length,
        0,
        'forbidden request should not write period-close candidate snapshot rows'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
