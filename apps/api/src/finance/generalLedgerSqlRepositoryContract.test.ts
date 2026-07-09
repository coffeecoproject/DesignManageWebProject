import type { AccountingPeriodRecord } from './periodCloseContract.js';
import { handleGeneralLedgerRoute } from './generalLedgerRoutes.js';
import {
  createGeneralLedgerSqlReadRepository,
  generalLedgerSqlMigrationContract,
  generalLedgerSqlTables,
  validateGeneralLedgerSqlRows,
  type AccountingGeneralLedgerEntrySqlRow,
  type AccountingOpeningBalanceSqlRow,
  type AccountingSubjectSqlRow,
  type GeneralLedgerSqlRows
} from './generalLedgerSqlRepositoryContract.js';

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

function createOpeningBalance(
  overrides: Partial<AccountingOpeningBalanceSqlRow> = {}
): AccountingOpeningBalanceSqlRow {
  return {
    accounting_period: '2026-05',
    amount: '1000.00',
    balance_direction: '借方',
    created_at: '2026-06-01T09:10:00+08:00',
    created_by: 'user-001',
    id: 'opening-1002-202605',
    source: '账套初始化',
    subject_code: '1002',
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

function createRows(overrides: Partial<GeneralLedgerSqlRows> = {}): GeneralLedgerSqlRows {
  const subjects = [
    createSubject(),
    createSubject({
      balance_direction: '贷方',
      code: '5001',
      name: '主营业务收入',
      report_item: '营业收入',
      statement_target: '利润表',
      type: '损益类'
    })
  ];

  return {
    accounting_general_ledger_entries: [
      createLedgerEntry(),
      createLedgerEntry({
        credit_amount: '1200.00',
        debit_amount: '0.00',
        id: 'ledger-entry-5001-001',
        source_voucher_line_id: 'voucher-line-5001-001',
        subject_code: '5001',
        subject_name: '主营业务收入'
      })
    ],
    accounting_opening_balances: [createOpeningBalance()],
    accounting_subjects: subjects,
    ...overrides
  };
}

function createPeriods(): AccountingPeriodRecord[] {
  return [
    { period: '2026-05', status: '已结账', version: 2 },
    { period: '2026-06', status: '已结账', version: 2 }
  ];
}

const tests: UnitTest[] = [
  {
    name: 'declares additive SQL table and migration contract for general ledger reads',
    run: () => {
      const tableNames = generalLedgerSqlTables.map((table) => table.name);
      const indexNames = generalLedgerSqlMigrationContract.indexes.map((index) => index.name);

      assertIncludes(tableNames, 'accounting_subjects', 'contract should include accounting subjects');
      assertIncludes(tableNames, 'accounting_opening_balances', 'contract should include opening balances');
      assertIncludes(
        tableNames,
        'accounting_general_ledger_entries',
        'contract should include general-ledger entries'
      );
      assertEqual(
        generalLedgerSqlMigrationContract.destructive,
        false,
        'general-ledger read-model migration must be additive'
      );
      assertIncludes(
        indexNames,
        'idx_general_ledger_entries_period_subject_date',
        'contract should declare period and subject query index'
      );
      assertIncludes(
        indexNames,
        'uk_general_ledger_entries_voucher_line',
        'contract should prevent duplicate voucher-line ledger rows'
      );
    }
  },
  {
    name: 'validates SQL rows before they become ledger evidence',
    run: () => {
      const validErrors = validateGeneralLedgerSqlRows(createRows());
      const invalidErrors = validateGeneralLedgerSqlRows(
        createRows({
          accounting_general_ledger_entries: [
            createLedgerEntry({
              credit_amount: '10.00',
              debit_amount: '10.00',
              subject_code: '9999',
              subject_name: '不存在科目'
            })
          ],
          accounting_opening_balances: [createOpeningBalance(), createOpeningBalance({ id: 'opening-duplicate' })]
        })
      );

      assertEqual(validErrors.length, 0, 'valid row set should pass');
      assert(
        invalidErrors.some((error) => error.includes('references missing subject 9999')),
        'missing subject should be rejected'
      );
      assert(
        invalidErrors.some((error) => error.includes('cannot have both debit and credit amounts')),
        'same ledger line cannot carry both debit and credit amounts'
      );
      assert(
        invalidErrors.some((error) => error.includes('duplicate opening balance')),
        'opening balance uniqueness should be enforced'
      );
    }
  },
  {
    name: 'reads period subject balances from SQL rows through repository contract',
    run: () => {
      const repository = createGeneralLedgerSqlReadRepository({
        periods: createPeriods(),
        rows: createRows()
      });
      const readModel = repository.readGeneralLedger({ accountingPeriod: '2026-06' });
      const bankRow = readModel.rows.find((row) => row.subjectCode === '1002');
      const incomeRow = readModel.rows.find((row) => row.subjectCode === '5001');

      assert(bankRow !== undefined, 'bank subject row should exist');
      assert(incomeRow !== undefined, 'income subject row should exist');
      assertEqual(bankRow.openingBalance, '1000.00', 'opening balance should come from SQL opening rows');
      assertEqual(bankRow.debitAmount, '1200.00', 'current debit should come from booked ledger entries');
      assertEqual(incomeRow.creditAmount, '1200.00', 'current credit should come from booked ledger entries');
      assertEqual(readModel.trialBalance.status, '平衡', 'posted ledger entries should balance');
      assertEqual(readModel.readbackSource, '结账总账', 'closed period reads formal ledger rows');
      assertEqual(repository.readRows().accounting_general_ledger_entries.length, 2, 'snapshot read should clone SQL rows');
    }
  },
  {
    name: 'maps opposite-side opening balances into signed ledger opening balance',
    run: () => {
      const repository = createGeneralLedgerSqlReadRepository({
        periods: createPeriods(),
        rows: createRows({
          accounting_general_ledger_entries: [],
          accounting_opening_balances: [
            createOpeningBalance({
              amount: '50.00',
              balance_direction: '贷方'
            })
          ]
        })
      });
      const readModel = repository.readGeneralLedger({ accountingPeriod: '2026-06' });
      const bankRow = readModel.rows.find((row) => row.subjectCode === '1002');

      assert(bankRow !== undefined, 'bank subject row should exist');
      assertEqual(bankRow.openingBalance, '-50.00', 'opposite-side opening balance should be signed');
      assertEqual(bankRow.openingBalanceAmount, '50.00', 'display amount should stay positive');
      assertEqual(bankRow.openingBalanceSide, '贷方', 'opening side should reflect opposite-side balance');
    }
  },
  {
    name: 'feeds existing general-ledger route adapter from SQL repository state',
    run: () => {
      const repository = createGeneralLedgerSqlReadRepository({
        periods: createPeriods(),
        rows: createRows()
      });
      const response = handleGeneralLedgerRoute({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-04T18:00:00+08:00',
          permissionScopes: ['finance.generalLedger.read'],
          requestId: 'req-general-ledger-sql-route'
        },
        request: {
          method: 'GET',
          path: '/api/finance/general-ledger/2026-06'
        },
        state: repository.readRouteState()
      });
      const body = response.body as {
        accountingPeriod: string;
        trialBalance: { status: string };
      };

      assertEqual(response.status, 200, 'route should read from SQL-backed route state');
      assertEqual(body.accountingPeriod, '2026-06', 'route should return requested period');
      assertEqual(body.trialBalance.status, '平衡', 'route read model should preserve trial balance');
    }
  }
];

for (const test of tests) {
  test.run();
}
