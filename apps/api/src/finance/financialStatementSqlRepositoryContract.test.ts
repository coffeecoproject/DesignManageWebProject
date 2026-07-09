import {
  createFinancialStatementSqlRepository,
  financialStatementSqlMigrationContract,
  validateFinancialStatementSqlRows,
  type CashFlowMappingSqlRow,
  type FinancialStatementSqlRows
} from './financialStatementSqlRepositoryContract.js';
import { handleFinancialStatementRoute } from './financialStatementRoutes.js';
import type { FinancialStatementLedgerEntry, FinancialStatementLine } from './financialStatementContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';

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

function assertIncludes<T>(values: readonly T[], expected: T, message: string) {
  if (!values.includes(expected)) {
    throw new Error(`${message}. Missing ${String(expected)}`);
  }
}

const actor: ActorSnapshot = { id: 'user-001', name: '李明' };

function createPeriods(overrides: Partial<AccountingPeriodRecord>[] = []): AccountingPeriodRecord[] {
  return [
    {
      period: '2026-06',
      status: '已结账',
      version: 2,
      ...overrides[0]
    }
  ];
}

function createMapping(overrides: Partial<CashFlowMappingSqlRow> = {}): CashFlowMappingSqlRow {
  return {
    activity: '经营活动',
    created_at: '2026-06-01T09:00:00+08:00',
    created_by: actor.id,
    created_by_snapshot: actor,
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

function createLedgerEntries(overrides: Partial<FinancialStatementLedgerEntry>[] = []): FinancialStatementLedgerEntry[] {
  return [
    {
      accountingPeriod: '2026-06',
      creditAmount: '0.00',
      debitAmount: '1200.00',
      subjectCode: '1002',
      voucherId: 'voucher-202606-001',
      voucherNo: '记-202606-001',
      ...overrides[0]
    },
    {
      accountingPeriod: '2026-06',
      creditAmount: '1200.00',
      debitAmount: '0.00',
      subjectCode: '1122',
      voucherId: 'voucher-202606-001',
      voucherNo: '记-202606-001',
      ...overrides[1]
    }
  ];
}

function createLine(overrides: Partial<FinancialStatementLine> = {}): FinancialStatementLine {
  return {
    amount: '1200.00',
    item: '应收账款',
    section: '资产',
    sourceSubjectCodes: ['1122'],
    voucherNos: ['记-202606-001'],
    ...overrides
  };
}

function createRows(overrides: Partial<FinancialStatementSqlRows> = {}): FinancialStatementSqlRows {
  return {
    cash_flow_mapping_rules: [createMapping()],
    financial_statement_general_ledger_lines: [],
    financial_statement_snapshot_lines: [],
    financial_statement_snapshots: [],
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'declares additive SQL contract for cash-flow mappings and formal statement snapshots',
    run: () => {
      const indexNames = financialStatementSqlMigrationContract.indexes.map((index) => index.name);

      assertEqual(
        financialStatementSqlMigrationContract.destructive,
        false,
        'financial-statement SQL migration contract should be additive'
      );
      assertEqual(
        financialStatementSqlMigrationContract.cashFlowMappingTable.name,
        'cash_flow_mapping_rules',
        'contract should declare cash-flow mapping table'
      );
      assertIncludes(
        financialStatementSqlMigrationContract.snapshotTables,
        'financial_statement_snapshots',
        'contract should reference formal statement snapshot table'
      );
      assertIncludes(
        financialStatementSqlMigrationContract.snapshotTables,
        'financial_statement_snapshot_lines',
        'contract should reference formal statement line table'
      );
      assertIncludes(
        financialStatementSqlMigrationContract.snapshotTables,
        'financial_statement_general_ledger_lines',
        'contract should reference formal statement general-ledger table'
      );
      assertIncludes(
        indexNames,
        'uk_cash_flow_mapping_subject_period_version',
        'contract should prevent duplicate period-effective mapping versions'
      );
    }
  },
  {
    name: 'validates cash-flow mappings and snapshot row references',
    run: () => {
      const validErrors = validateFinancialStatementSqlRows({
        periods: createPeriods(),
        rows: createRows()
      });
      const invalidErrors = validateFinancialStatementSqlRows({
        periods: createPeriods([{ status: '开放' }]),
        rows: createRows({
          cash_flow_mapping_rules: [
            createMapping({ created_by_snapshot: { id: 'user-001' }, id: 'invalid-actor' }),
            createMapping({ id: 'duplicate-mapping' })
          ],
          financial_statement_general_ledger_lines: [
            {
              accounting_period: '2026-06',
              credit_amount: '0.00',
              debit_amount: '1200.00',
              entry_count: 1,
              id: 'general-ledger-line-invalid',
              snapshot_id: 'statement-snapshot-invalid',
              source_ledger_hash: 'different_hash',
              subject_code: '1002',
              voucher_nos: ['记-202606-001']
            }
          ],
          financial_statement_snapshot_lines: [
            {
              accounting_period: '2026-06',
              amount: '1200.00',
              id: 'statement-line-invalid',
              item: '应收账款',
              line_index: 1,
              section: '资产',
              snapshot_id: 'statement-snapshot-invalid',
              source_subject_codes: ['1122'],
              statement_type: 'balance_sheet',
              voucher_nos: ['记-202606-001']
            }
          ],
          financial_statement_snapshots: [
            {
              accounting_period: '2026-06',
              cash_flow_mapping_version_hash: 'mapping_hash',
              generated_at: '2026-07-01T10:00:00+08:00',
              generated_by: actor.id,
              generated_by_snapshot: actor,
              id: 'statement-snapshot-invalid',
              snapshot_hash: 'snapshot_hash',
              source_ledger_hash: 'source_hash',
              status: '已生成'
            }
          ]
        })
      });

      assertEqual(validErrors.length, 0, 'valid SQL rows should pass');
      assert(
        invalidErrors.some((error) => error.includes('created_by_snapshot is invalid')),
        'invalid mapping actor snapshot should be rejected'
      );
      assert(
        invalidErrors.some((error) => error.includes('duplicate mapping')),
        'duplicate mapping version should be rejected'
      );
      assert(
        invalidErrors.some((error) => error.includes('period must be closed')),
        'snapshot rows should require closed periods'
      );
      assert(
        invalidErrors.some((error) => error.includes('source ledger hash must match snapshot')),
        'snapshot general-ledger lines should bind to snapshot source ledger hash'
      );
    }
  },
  {
    name: 'writes formal statement snapshots into SQL-shaped rows',
    run: () => {
      const repository = createFinancialStatementSqlRepository({
        ledgerEntries: createLedgerEntries(),
        periods: createPeriods(),
        rows: createRows(),
        statementLineInputs: {
          '2026-06': {
            balanceSheetLines: [createLine()],
            profitStatementLines: [createLine({ item: '主营业务收入', section: '收入', sourceSubjectCodes: ['5001'] })]
          }
        }
      });
      const readiness = repository.readReadiness('2026-06');
      const result = repository.createSnapshot({
        accountingPeriod: '2026-06',
        expectedCashFlowMappingVersionHash: readiness.cashFlowMappingVersionHash,
        expectedSourceLedgerHash: readiness.sourceLedgerHash,
        request: {
          generatedAt: '2026-07-01T10:00:00+08:00',
          generatedBySnapshot: actor,
          requestId: 'req-statement-sql-snapshot'
        }
      });

      assertEqual(readiness.canGenerateSnapshot, true, 'complete SQL mapping should allow statement snapshot');
      assertEqual(result.ok, true, 'closed period should write formal statement rows');

      if (!result.ok) {
        return;
      }

      assertEqual(result.replayed, false, 'first snapshot write should not replay');
      assertEqual(result.rows.financial_statement_snapshots.length, 1, 'snapshot row should be persisted');
      assertEqual(result.rows.financial_statement_snapshot_lines.length, 3, 'balance/profit/cash-flow lines should persist');
      assertEqual(
        result.rows.financial_statement_general_ledger_lines.length,
        2,
        'subject-level general-ledger lines should persist'
      );
      assertEqual(
        repository.readLatestSnapshot('2026-06')?.snapshotHash,
        result.snapshot.snapshotHash,
        'latest snapshot should read from persisted rows'
      );
    }
  },
  {
    name: 'replays existing snapshot rows without recomputing after mapping changes',
    run: () => {
      const firstRepository = createFinancialStatementSqlRepository({
        ledgerEntries: createLedgerEntries(),
        periods: createPeriods(),
        rows: createRows()
      });
      const firstResult = firstRepository.createSnapshot({
        accountingPeriod: '2026-06',
        request: {
          generatedAt: '2026-07-01T10:00:00+08:00',
          generatedBySnapshot: actor,
          requestId: 'req-statement-sql-first'
        }
      });

      assertEqual(firstResult.ok, true, 'first snapshot should be created');

      if (!firstResult.ok) {
        return;
      }

      const replayRepository = createFinancialStatementSqlRepository({
        ledgerEntries: createLedgerEntries(),
        periods: createPeriods(),
        rows: {
          ...firstResult.rows,
          cash_flow_mapping_rules: [createMapping({ item: '调整后的映射', version: 2 })]
        }
      });
      const replayResult = replayRepository.createSnapshot({
        accountingPeriod: '2026-06',
        request: {
          generatedAt: '2026-07-02T10:00:00+08:00',
          generatedBySnapshot: actor,
          requestId: 'req-statement-sql-replay'
        }
      });

      assertEqual(replayResult.ok, true, 'existing snapshot should replay');

      if (!replayResult.ok) {
        return;
      }

      assertEqual(replayResult.replayed, true, 'existing closed-period snapshot should replay');
      assertEqual(
        replayResult.snapshot.snapshotHash,
        firstResult.snapshot.snapshotHash,
        'replay should return original formal snapshot hash'
      );
      assertEqual(
        replayResult.snapshot.cashFlowLines[0]?.item,
        '销售商品、提供劳务收到的现金',
        'replay should not drift with later mapping row changes'
      );
    }
  },
  {
    name: 'feeds the financial-statement route adapter from SQL repository state',
    run: () => {
      const repository = createFinancialStatementSqlRepository({
        ledgerEntries: createLedgerEntries(),
        periods: createPeriods(),
        rows: createRows()
      });
      const readinessResponse = handleFinancialStatementRoute({
        context: {
          actorSnapshot: actor,
          now: '2026-07-01T10:00:00+08:00',
          permissionScopes: ['finance.financialStatement.read'],
          requestId: 'req-statement-route-readiness'
        },
        request: {
          method: 'GET',
          path: '/api/finance/financial-statements/2026-06/readiness'
        },
        state: repository.readRouteState()
      });

      assertEqual(readinessResponse.status, 200, 'route should read readiness from SQL-backed state');
      assertEqual(
        (readinessResponse.body as { canGenerateFormalSnapshot: boolean }).canGenerateFormalSnapshot,
        true,
        'closed period with complete persisted mapping should be formally generatable'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
