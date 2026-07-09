import {
  requiredCloseCheckCodes,
  type CloseAccountingPeriodRequest,
  type CloseCheckRow
} from './periodCloseContract.js';
import {
  hydrateFinancialStatementSnapshotsFromDatabaseRows,
  mapPeriodCloseStateToDatabaseRows,
  periodCloseDatabaseTables,
  validatePeriodCloseDatabaseRows,
  type PeriodCloseDatabaseRows
} from './periodCloseDatabaseContract.js';
import {
  buildFinancialStatementReadiness,
  createFinancialStatementSnapshot,
  type FinancialStatementSnapshot
} from './financialStatementContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';
import {
  applyFinanceSourceMutationWithRepositoryTransaction,
  closeAccountingPeriodWithRepositoryTransaction,
  createInMemoryPeriodCloseRepository
} from './periodCloseRepositoryContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
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
    idempotencyKey: 'idem-close-202606',
    now: '2026-07-02T21:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-database',
    version: 1,
    ...overrides
  };
}

function createClosedRows(): PeriodCloseDatabaseRows {
  const repository = createInMemoryPeriodCloseRepository(createState());
  const result = closeAccountingPeriodWithRepositoryTransaction({
    period: '2026-06',
    repository,
    request: createCloseRequest()
  });

  assertEqual(result.ok, true, 'close should pass before database mapping');

  return mapPeriodCloseStateToDatabaseRows({
    fallbackNow: '2026-07-02T22:00:00+08:00',
    state: repository.readState()
  });
}

function createFinancialSnapshot(): FinancialStatementSnapshot {
  const readiness = buildFinancialStatementReadiness({
    accountingPeriod: '2026-06',
    balanceSheetLines: [
      {
        amount: '1200.00',
        item: '银行存款',
        section: '资产',
        sourceSubjectCodes: ['1002'],
        voucherNos: ['记-202606-001']
      }
    ],
    cashFlowMappings: [
      {
        activity: '经营活动',
        createdAt: '2026-06-01T09:00:00+08:00',
        createdBySnapshot: { id: 'user-001', name: '李明' },
        effectivePeriod: '2026-06',
        item: '销售商品、提供劳务收到的现金',
        status: '有效',
        subjectCode: '1122',
        version: 1
      }
    ],
    ledgerEntries: [
      {
        accountingPeriod: '2026-06',
        creditAmount: '0.00',
        debitAmount: '1200.00',
        subjectCode: '1002',
        voucherId: 'voucher-001',
        voucherNo: '记-202606-001'
      },
      {
        accountingPeriod: '2026-06',
        creditAmount: '1200.00',
        debitAmount: '0.00',
        subjectCode: '1122',
        voucherId: 'voucher-001',
        voucherNo: '记-202606-001'
      }
    ],
    profitStatementLines: [
      {
        amount: '1200.00',
        item: '主营业务收入',
        section: '收入',
        sourceSubjectCodes: ['6001'],
        voucherNos: ['记-202606-001']
      }
    ]
  });
  const snapshotResult = createFinancialStatementSnapshot({
    period: {
      period: '2026-06',
      status: '已结账',
      version: 2
    },
    readiness,
    request: {
      generatedAt: '2026-07-01T09:00:00+08:00',
      generatedBySnapshot: { id: 'user-001', name: '李明' },
      requestId: 'req-financial-statement-db-snapshot'
    }
  });

  assertEqual(snapshotResult.ok, true, 'financial snapshot should be created before database mapping');

  if (!snapshotResult.ok) {
    throw new Error('financial snapshot should be created');
  }

  return snapshotResult.snapshot;
}

const tests: UnitTest[] = [
  {
    name: 'declares database row contract for period close controlled tables',
    run: () => {
      const tableNames = periodCloseDatabaseTables.map((table) => table.name);

      assertIncludes(tableNames, 'accounting_periods', 'table contract should include periods');
      assertIncludes(tableNames, 'accounting_period_close_checks', 'table contract should include close checks');
      assertIncludes(
        tableNames,
        'accounting_period_close_check_items',
        'table contract should include close check items'
      );
      assertIncludes(tableNames, 'accounting_period_events', 'table contract should include period events');
      assertIncludes(
        tableNames,
        'accounting_period_idempotency_records',
        'table contract should include idempotency records'
      );
      assertIncludes(
        tableNames,
        'accounting_period_source_mutation_events',
        'table contract should include source mutation events'
      );
      assertIncludes(
        tableNames,
        'financial_statement_snapshots',
        'table contract should include financial statement snapshots'
      );
      assertIncludes(
        tableNames,
        'financial_statement_snapshot_lines',
        'table contract should include financial statement snapshot lines'
      );
      assertIncludes(
        tableNames,
        'financial_statement_general_ledger_lines',
        'table contract should include financial statement general-ledger lines'
      );

      const periodColumns =
        periodCloseDatabaseTables.find((table) => table.name === 'accounting_periods')?.columns.map((column) => column.name) ??
        [];
      const idempotencyColumns =
        periodCloseDatabaseTables
          .find((table) => table.name === 'accounting_period_idempotency_records')
          ?.columns.map((column) => column.name) ?? [];
      const eventColumns =
        periodCloseDatabaseTables
          .find((table) => table.name === 'accounting_period_events')
          ?.columns.map((column) => column.name) ?? [];
      const statementSnapshotColumns =
        periodCloseDatabaseTables
          .find((table) => table.name === 'financial_statement_snapshots')
          ?.columns.map((column) => column.name) ?? [];
      const generalLedgerColumns =
        periodCloseDatabaseTables
          .find((table) => table.name === 'financial_statement_general_ledger_lines')
          ?.columns.map((column) => column.name) ?? [];

      assertIncludes(periodColumns, 'close_check_snapshot_id', 'closed period should store close snapshot id');
      assertIncludes(periodColumns, 'reopen_impact_snapshot', 'reopened period should store impact snapshot');
      assertIncludes(
        periodColumns,
        'reopen_risk_confirmation_snapshot',
        'reopened period should store risk confirmation snapshot'
      );
      assertIncludes(periodColumns, 'version', 'period should expose optimistic concurrency version');
      assertIncludes(eventColumns, 'reopen_impact_snapshot', 'reopen event should store impact snapshot');
      assertIncludes(
        eventColumns,
        'reopen_risk_confirmation_snapshot',
        'reopen event should store risk confirmation snapshot'
      );
      assertIncludes(idempotencyColumns, 'idempotency_key', 'idempotency table should store idempotency key');
      assertIncludes(idempotencyColumns, 'response_snapshot', 'idempotency table should store replay response');
      assertIncludes(
        statementSnapshotColumns,
        'source_ledger_hash',
        'financial statement snapshot should bind source ledger hash'
      );
      assertIncludes(
        generalLedgerColumns,
        'source_ledger_hash',
        'general-ledger snapshot row should bind source ledger hash'
      );
    }
  },
  {
    name: 'maps committed period close state to database rows without validation errors',
    run: () => {
      const rows = createClosedRows();
      const errors = validatePeriodCloseDatabaseRows(rows);

      assertEqual(errors.length, 0, 'closed rows should satisfy database row invariants');

      const period = rows.accounting_periods.find((row) => row.period === '2026-06');
      assert(period !== undefined, 'closed period row should exist');
      assertEqual(period.status, '已结账', 'period should be closed');
      assertEqual(period.closed_by, 'user-001', 'period should store closer id');
      assertEqual(period.close_reason, '月末结账', 'period should store close reason');
      assert(period.close_check_snapshot_id !== undefined, 'period should reference persisted close snapshot');

      const closeSnapshot = rows.accounting_period_close_checks.find(
        (row) => row.id === period.close_check_snapshot_id
      );
      assert(closeSnapshot !== undefined, 'close snapshot row should exist');
      assertEqual(closeSnapshot.run_type, 'close_snapshot', 'successful close snapshot should use close_snapshot');
      assertEqual(closeSnapshot.persisted_for_close, true, 'successful close snapshot should be persisted for close');
      assertEqual(closeSnapshot.trial_debit_total, '68000.00', 'snapshot should persist trial debit total');
      assertEqual(closeSnapshot.trial_credit_total, '68000.00', 'snapshot should persist trial credit total');

      const itemCodes = rows.accounting_period_close_check_items
        .filter((row) => row.close_check_id === closeSnapshot.id)
        .map((row) => row.group_code)
        .sort();
      assertEqual(
        itemCodes.join(','),
        [...requiredCloseCheckCodes].sort().join(','),
        'close snapshot should include all required check groups'
      );

      const event = rows.accounting_period_events.find((row) => row.event_type === 'closed');
      assert(event !== undefined, 'closed event should exist');
      assertEqual(event.close_check_id, closeSnapshot.id, 'closed event should link to persisted close snapshot');

      const idempotency = rows.accounting_period_idempotency_records[0];
      assert(idempotency !== undefined, 'close idempotency record should exist');
      assertEqual(idempotency.period, '2026-06', 'idempotency record should use accounting period');
      assertEqual(idempotency.operation, 'close', 'idempotency record should use close operation');
      assertEqual(idempotency.idempotency_key, 'idem-close-202606', 'idempotency record should store request key');
    }
  },
  {
    name: 'maps formal financial statement snapshots into database rows and hydrates immutable readback',
    run: () => {
      const repository = createInMemoryPeriodCloseRepository(createState());
      const closeResult = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(closeResult.ok, true, 'close should pass before formal statement row mapping');

      const snapshot = createFinancialSnapshot();
      const rows = mapPeriodCloseStateToDatabaseRows({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        financialStatementSnapshots: [snapshot],
        state: repository.readState()
      });
      const errors = validatePeriodCloseDatabaseRows(rows);

      assertEqual(errors.length, 0, 'formal financial statement rows should satisfy database row invariants');
      assertEqual(rows.financial_statement_snapshots.length, 1, 'snapshot table should store one formal report snapshot');
      assertEqual(rows.financial_statement_general_ledger_lines.length, 2, 'general-ledger rows should be persisted by subject');
      assertEqual(
        rows.financial_statement_general_ledger_lines[0]?.source_ledger_hash,
        snapshot.sourceLedgerHash,
        'general-ledger rows should bind to the snapshot source ledger hash'
      );

      const hydratedSnapshots = hydrateFinancialStatementSnapshotsFromDatabaseRows(rows);
      const hydrated = hydratedSnapshots[0];

      assert(hydrated !== undefined, 'hydrated snapshot should exist');
      assertEqual(hydrated.snapshotHash, snapshot.snapshotHash, 'hydrated snapshot hash should match original');
      assertEqual(
        hydrated.generalLedgerLines.find((line) => line.subjectCode === '1002')?.debitAmount,
        '1200.00',
        'hydrated general-ledger snapshot should preserve debit amount'
      );
      assertEqual(
        hydrated.cashFlowLines[0]?.item,
        '销售商品、提供劳务收到的现金',
        'hydrated cash-flow row should preserve mapped item'
      );
    }
  },
  {
    name: 'rejects closed period rows without a persisted close snapshot reference',
    run: () => {
      const rows = createClosedRows();
      const period = rows.accounting_periods.find((row) => row.period === '2026-06');
      assert(period !== undefined, 'closed period row should exist');

      period.close_check_snapshot_id = undefined;

      const errors = validatePeriodCloseDatabaseRows(rows);
      assert(
        errors.some((error) => error.includes('closed period must reference persisted close snapshot')),
        'validator should reject closed periods without close snapshot reference'
      );
    }
  },
  {
    name: 'rejects duplicate idempotency row identities',
    run: () => {
      const rows = createClosedRows();
      const idempotency = rows.accounting_period_idempotency_records[0];
      assert(idempotency !== undefined, 'idempotency row should exist');

      rows.accounting_period_idempotency_records.push({
        ...idempotency,
        id: `${idempotency.id}-duplicate`
      });

      const errors = validatePeriodCloseDatabaseRows(rows);
      assert(
        errors.some((error) => error.includes('duplicate idempotency key')),
        'validator should reject duplicate idempotency unique key'
      );
    }
  },
  {
    name: 'rejects reopened period rows without reopen metadata',
    run: () => {
      const rows = createClosedRows();
      const period = rows.accounting_periods.find((row) => row.period === '2026-06');
      assert(period !== undefined, 'period row should exist');

      period.status = '已反结账';
      period.reopened_at = undefined;
      period.reopened_by = undefined;
      period.reopened_by_snapshot = undefined;
      period.reopen_reason = undefined;

      const errors = validatePeriodCloseDatabaseRows(rows);
      assert(
        errors.some((error) => error.includes('reopened metadata is incomplete')),
        'validator should reject reopened periods without reopen metadata'
      );
    }
  },
  {
    name: 'maps and validates reopen impact and risk confirmation snapshots',
    run: () => {
      const rows = mapPeriodCloseStateToDatabaseRows({
        fallbackNow: '2026-07-03T10:00:00+08:00',
        state: createState({
          periodEvents: [
            {
              actorSnapshot: { id: 'user-001', name: '李明' },
              afterStatus: '已反结账',
              beforeStatus: '已结账',
              eventType: 'reopened',
              idempotencyKey: 'idem-reopen-risk',
              period: '2026-06',
              reason: '发现本期凭证需要重开处理',
              reopenImpactSnapshot: {
                irreversibleExternalSubmissions: [
                  {
                    accountingPeriod: '2026-06',
                    description: '2026-06 增值税申报已提交税局',
                    id: 'external-tax-202606',
                    sourceModule: '税务办理',
                    sourceNo: 'TAX-202606',
                    submittedAt: '2026-07-01T09:00:00+08:00'
                  }
                ],
                laterClosedPeriods: ['2026-07']
              },
              reopenRiskConfirmationSnapshot: {
                allowIrreversibleExternalSubmissions: true,
                allowLaterClosedPeriods: true,
                decisionNo: 'DEC-REOPEN-202606-001',
                note: '已确认后续期间和税务申报影响，允许异常反结账。'
              },
              requestId: 'req-reopen-risk',
              timestamp: '2026-07-03T10:00:00+08:00'
            }
          ],
          periods: [
            createPeriod({
              period: '2026-06',
              reopenImpactSnapshot: {
                irreversibleExternalSubmissions: [
                  {
                    accountingPeriod: '2026-06',
                    description: '2026-06 增值税申报已提交税局',
                    id: 'external-tax-202606',
                    sourceModule: '税务办理',
                    sourceNo: 'TAX-202606',
                    submittedAt: '2026-07-01T09:00:00+08:00'
                  }
                ],
                laterClosedPeriods: ['2026-07']
              },
              reopenReason: '发现本期凭证需要重开处理',
              reopenRiskConfirmationSnapshot: {
                allowIrreversibleExternalSubmissions: true,
                allowLaterClosedPeriods: true,
                decisionNo: 'DEC-REOPEN-202606-001',
                note: '已确认后续期间和税务申报影响，允许异常反结账。'
              },
              reopenedAt: '2026-07-03T10:00:00+08:00',
              reopenedBySnapshot: { id: 'user-001', name: '李明' },
              status: '已反结账',
              version: 5
            }),
            createPeriod({ period: '2026-07', version: 1 })
          ]
        })
      });
      const errors = validatePeriodCloseDatabaseRows(rows);
      const period = rows.accounting_periods.find((row) => row.period === '2026-06');
      const event = rows.accounting_period_events.find((row) => row.event_type === 'reopened');

      assertEqual(errors.length, 0, 'risk-confirmed reopened rows should satisfy database invariants');
      assert(period !== undefined, 'reopened period row should exist');
      assert(event !== undefined, 'reopened event row should exist');
      assertObject(period.reopen_impact_snapshot, 'period should store reopen impact snapshot');
      assertObject(
        period.reopen_risk_confirmation_snapshot,
        'period should store reopen risk confirmation snapshot'
      );
      assertEqual(
        period.reopen_risk_confirmation_snapshot.decisionNo,
        'DEC-REOPEN-202606-001',
        'period risk snapshot should keep decision number'
      );
      assert(Array.isArray(period.reopen_impact_snapshot.laterClosedPeriods), 'impact snapshot should keep later periods');
      assertEqual(
        period.reopen_impact_snapshot.laterClosedPeriods[0],
        '2026-07',
        'impact snapshot should keep later closed period'
      );
      assertObject(event.reopen_impact_snapshot, 'event should store reopen impact snapshot');
      assertObject(
        event.reopen_risk_confirmation_snapshot,
        'event should store reopen risk confirmation snapshot'
      );

      period.reopen_risk_confirmation_snapshot = { decisionNo: '', note: ' ' };

      const invalidErrors = validatePeriodCloseDatabaseRows(rows);
      assert(
        invalidErrors.some((error) => error.includes('reopen risk confirmation is incomplete')),
        'validator should reject high-risk reopen without decision number and note'
      );
    }
  },
  {
    name: 'maps source mutation rejections into source mutation event rows',
    run: () => {
      const repository = createInMemoryPeriodCloseRepository(createState());
      const closeResult = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });
      assertEqual(closeResult.ok, true, 'close should pass before source mutation rejection mapping');

      const mutationResult = applyFinanceSourceMutationWithRepositoryTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T21:35:00+08:00',
          requestId: 'req-source-after-close'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        repository
      });

      assertEqual(mutationResult.ok, false, 'closed period should reject source mutation');

      const rows = mapPeriodCloseStateToDatabaseRows({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        state: repository.readState()
      });
      const event = rows.accounting_period_source_mutation_events[0];

      assert(event !== undefined, 'source mutation event row should exist');
      assertEqual(event.event_type, 'source_mutation_rejected', 'source mutation should map as rejection');
      assertEqual(event.source_area, 'receivable_payable', 'source mutation event should keep source area');
      assertEqual(event.source_id, 'source-001', 'source mutation event should keep source id');
      assert(
        (event.affected_accounting_periods as string[]).includes('2026-06'),
        'source mutation event should keep affected accounting period'
      );
    }
  },
  {
    name: 'validates source mutation guard audit rows',
    run: () => {
      const rows = mapPeriodCloseStateToDatabaseRows({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        state: {
          ...createState(),
          sourceMutationEvents: [
            {
              actorSnapshot: { id: 'user-001', name: '李明' },
              affectedAccountingPeriods: ['2026-06'],
              eventType: 'source_mutation_rejected',
              operation: '调整应收应付事项',
              requestId: 'req-source-audit-row',
              sourceArea: 'receivable_payable',
              sourceId: 'source-001',
              timestamp: '2026-07-02T21:35:00+08:00'
            }
          ]
        }
      });
      const invalidRows: PeriodCloseDatabaseRows = {
        ...rows,
        accounting_period_source_mutation_events: [
          {
            ...rows.accounting_period_source_mutation_events[0]!,
            affected_accounting_periods: ['2026-99'],
            source_id: ''
          }
        ]
      };
      const errors = validatePeriodCloseDatabaseRows(invalidRows);

      assert(
        errors.some((error) => error.includes('source identity is incomplete')),
        'validator should reject source mutation rows without source identity'
      );
      assert(
        errors.some((error) => error.includes('affected period is unresolved')),
        'validator should reject source mutation rows with unresolved affected periods'
      );
    }
  },
  {
    name: 'rejects formal financial statement snapshots that do not reference closed periods',
    run: () => {
      const rows = mapPeriodCloseStateToDatabaseRows({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        financialStatementSnapshots: [createFinancialSnapshot()],
        state: createState()
      });
      const errors = validatePeriodCloseDatabaseRows(rows);

      assert(
        errors.some((error) => error.includes('formal snapshot must reference a closed period')),
        'validator should reject statement snapshots against open periods'
      );
    }
  },
  {
    name: 'rejects formal financial statement general-ledger rows with stale source ledger hash',
    run: () => {
      const repository = createInMemoryPeriodCloseRepository(createState());
      const closeResult = closeAccountingPeriodWithRepositoryTransaction({
        period: '2026-06',
        repository,
        request: createCloseRequest()
      });

      assertEqual(closeResult.ok, true, 'close should pass before stale hash mutation');

      const rows = mapPeriodCloseStateToDatabaseRows({
        fallbackNow: '2026-07-02T22:00:00+08:00',
        financialStatementSnapshots: [createFinancialSnapshot()],
        state: repository.readState()
      });

      rows.financial_statement_general_ledger_lines[0]!.source_ledger_hash = 'stale_source_ledger_hash';

      const errors = validatePeriodCloseDatabaseRows(rows);

      assert(
        errors.some((error) => error.includes('source ledger hash does not match snapshot')),
        'validator should reject statement ledger rows with stale source ledger hash'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
