import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import { buildGeneralLedgerReadModel } from './generalLedgerContract.js';
import type {
  GeneralLedgerBalanceDirection,
  GeneralLedgerOpeningBalanceRecord,
  GeneralLedgerOpeningBalanceSource,
  GeneralLedgerReadModel,
  GeneralLedgerSubjectRecord,
  GeneralLedgerSubjectType
} from './generalLedgerContract.js';
import type { AccountingPeriodRecord } from './periodCloseContract.js';

export type GeneralLedgerSqlTableName =
  | 'accounting_general_ledger_entries'
  | 'accounting_opening_balances'
  | 'accounting_subjects';

export type GeneralLedgerSqlColumn = {
  name: string;
  nullable: boolean;
  primaryKey?: boolean;
  references?: string;
  type: string;
  uniqueKey?: string;
};

export type GeneralLedgerSqlTable = {
  columns: GeneralLedgerSqlColumn[];
  name: GeneralLedgerSqlTableName;
  notes: string[];
};

export type GeneralLedgerSqlIndex = {
  columns: string[];
  name: string;
  table: GeneralLedgerSqlTableName;
  unique?: boolean;
};

export type GeneralLedgerSqlMigrationContract = {
  destructive: false;
  id: string;
  indexes: GeneralLedgerSqlIndex[];
  rollbackStrategy: string;
  tables: GeneralLedgerSqlTable[];
};

export type AccountingSubjectSqlRow = {
  balance_direction: GeneralLedgerBalanceDirection;
  code: string;
  created_at: string;
  name: string;
  report_item: string;
  statement_target: string;
  status: '启用' | '停用';
  type: GeneralLedgerSubjectType;
  updated_at: string;
};

export type AccountingOpeningBalanceSqlRow = {
  accounting_period: string;
  amount: string;
  balance_direction: GeneralLedgerBalanceDirection;
  created_at: string;
  created_by: string;
  id: string;
  source: GeneralLedgerOpeningBalanceSource;
  subject_code: string;
};

export type AccountingGeneralLedgerEntrySqlRow = {
  accounting_period: string;
  auxiliary: string;
  created_at: string;
  credit_amount: string;
  debit_amount: string;
  id: string;
  source_snapshot_hash: string;
  source_voucher_line_id: string;
  subject_code: string;
  subject_name: string;
  summary: string;
  voucher_date: string;
  voucher_id: string;
  voucher_no: string;
};

export type GeneralLedgerSqlRows = {
  accounting_general_ledger_entries: AccountingGeneralLedgerEntrySqlRow[];
  accounting_opening_balances: AccountingOpeningBalanceSqlRow[];
  accounting_subjects: AccountingSubjectSqlRow[];
};

export type GeneralLedgerSqlReadRepository = {
  readGeneralLedger: (input: { accountingPeriod: string }) => GeneralLedgerReadModel;
  readRows: () => GeneralLedgerSqlRows;
  readRouteState: () => {
    ledgerRows: GeneralLedgerLifecycleRow[];
    openingBalances: GeneralLedgerOpeningBalanceRecord[];
    periods: AccountingPeriodRecord[];
    subjects: GeneralLedgerSubjectRecord[];
  };
};

const moneyPattern = /^-?\d+\.\d{2}$/;

export const generalLedgerSqlTables: GeneralLedgerSqlTable[] = [
  {
    columns: [
      { name: 'code', nullable: false, primaryKey: true, type: 'text' },
      { name: 'name', nullable: false, type: 'text' },
      { name: 'type', nullable: false, type: 'accounting_subject_type' },
      { name: 'balance_direction', nullable: false, type: 'accounting_balance_direction' },
      { name: 'statement_target', nullable: false, type: 'text' },
      { name: 'report_item', nullable: false, type: 'text' },
      { name: 'status', nullable: false, type: 'accounting_subject_status' },
      { name: 'created_at', nullable: false, type: 'timestamptz' },
      { name: 'updated_at', nullable: false, type: 'timestamptz' }
    ],
    name: 'accounting_subjects',
    notes: [
      'Business pages read accounting subjects as a controlled catalog.',
      'Subject code is stable after ledger entries exist; stop using compatible aliases in formal ledger reads.'
    ]
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'accounting_period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'subject_code', nullable: false, references: 'accounting_subjects.code', type: 'text' },
      { name: 'balance_direction', nullable: false, type: 'accounting_balance_direction' },
      { name: 'amount', nullable: false, type: 'numeric(18,2)' },
      { name: 'source', nullable: false, type: 'opening_balance_source' },
      { name: 'created_by', nullable: false, type: 'text' },
      { name: 'created_at', nullable: false, type: 'timestamptz' }
    ],
    name: 'accounting_opening_balances',
    notes: [
      'Opening balances are the locked account-set initialization facts used by general-ledger reads.',
      'balance_direction lets an opening balance sit on the opposite side without storing a negative user-facing amount.'
    ]
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'accounting_period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'voucher_id', nullable: false, type: 'text' },
      { name: 'voucher_no', nullable: false, type: 'text' },
      { name: 'voucher_date', nullable: false, type: 'date' },
      { name: 'source_voucher_line_id', nullable: false, type: 'text', uniqueKey: 'voucher_line_once_in_ledger' },
      { name: 'subject_code', nullable: false, references: 'accounting_subjects.code', type: 'text' },
      { name: 'subject_name', nullable: false, type: 'text' },
      { name: 'summary', nullable: false, type: 'text' },
      { name: 'auxiliary', nullable: false, type: 'text' },
      { name: 'debit_amount', nullable: false, type: 'numeric(18,2)' },
      { name: 'credit_amount', nullable: false, type: 'numeric(18,2)' },
      { name: 'source_snapshot_hash', nullable: false, type: 'text' },
      { name: 'created_at', nullable: false, type: 'timestamptz' }
    ],
    name: 'accounting_general_ledger_entries',
    notes: [
      'Only booked voucher lines become general-ledger entries.',
      'Each voucher line must be inserted once; reversals are additional booked voucher lines rather than edits.'
    ]
  }
];

export const generalLedgerSqlMigrationContract: GeneralLedgerSqlMigrationContract = {
  destructive: false,
  id: '20260704_finance_general_ledger_read_model',
  indexes: [
    {
      columns: ['accounting_period', 'subject_code', 'voucher_date', 'voucher_no'],
      name: 'idx_general_ledger_entries_period_subject_date',
      table: 'accounting_general_ledger_entries'
    },
    {
      columns: ['voucher_id', 'source_voucher_line_id'],
      name: 'uk_general_ledger_entries_voucher_line',
      table: 'accounting_general_ledger_entries',
      unique: true
    },
    {
      columns: ['accounting_period', 'subject_code', 'source'],
      name: 'uk_opening_balances_period_subject_source',
      table: 'accounting_opening_balances',
      unique: true
    }
  ],
  rollbackStrategy:
    'Forward-fix only after data exists; before apply, rollback can drop the new read-model tables because this migration is additive.',
  tables: generalLedgerSqlTables
};

function cloneRows(rows: GeneralLedgerSqlRows): GeneralLedgerSqlRows {
  return {
    accounting_general_ledger_entries: rows.accounting_general_ledger_entries.map((row) => ({ ...row })),
    accounting_opening_balances: rows.accounting_opening_balances.map((row) => ({ ...row })),
    accounting_subjects: rows.accounting_subjects.map((row) => ({ ...row }))
  };
}

function parseMoneyToCents(amount: string) {
  if (!moneyPattern.test(amount)) {
    return Number.NaN;
  }

  const sign = amount.startsWith('-') ? -1 : 1;
  const unsigned = amount.replace(/^-/, '');
  const [yuan = '0', cents = '00'] = unsigned.split('.');

  return sign * (Number(yuan) * 100 + Number(cents));
}

function isPeriod(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function requireNonBlank(errors: string[], value: string, label: string) {
  if (value.trim().length === 0) {
    errors.push(`${label} is required`);
  }
}

function validateMoney(errors: string[], value: string, label: string, options: { allowNegative?: boolean } = {}) {
  const cents = parseMoneyToCents(value);

  if (!Number.isFinite(cents)) {
    errors.push(`${label} must be numeric(18,2)`);
    return Number.NaN;
  }

  if (!options.allowNegative && cents < 0) {
    errors.push(`${label} must not be negative`);
  }

  return cents;
}

export function validateGeneralLedgerSqlRows(rows: GeneralLedgerSqlRows): string[] {
  const errors: string[] = [];
  const subjectByCode = new Map<string, AccountingSubjectSqlRow>();
  const subjectCodes = new Set<string>();
  const openingKeys = new Set<string>();
  const voucherLineKeys = new Set<string>();

  for (const subject of rows.accounting_subjects) {
    requireNonBlank(errors, subject.code, 'accounting_subjects.code');
    requireNonBlank(errors, subject.name, `accounting_subjects[${subject.code}].name`);
    requireNonBlank(errors, subject.report_item, `accounting_subjects[${subject.code}].report_item`);
    requireNonBlank(errors, subject.statement_target, `accounting_subjects[${subject.code}].statement_target`);

    if (subjectCodes.has(subject.code)) {
      errors.push(`duplicate accounting subject ${subject.code}`);
    }

    subjectCodes.add(subject.code);
    subjectByCode.set(subject.code, subject);
  }

  for (const opening of rows.accounting_opening_balances) {
    const subject = subjectByCode.get(opening.subject_code);

    requireNonBlank(errors, opening.id, 'accounting_opening_balances.id');

    if (!isPeriod(opening.accounting_period)) {
      errors.push(`opening balance ${opening.id} accounting_period must be YYYY-MM`);
    }

    if (!subject) {
      errors.push(`opening balance ${opening.id} references missing subject ${opening.subject_code}`);
    }

    validateMoney(errors, opening.amount, `opening balance ${opening.id} amount`);

    const openingKey = `${opening.accounting_period}:${opening.subject_code}:${opening.source}`;

    if (openingKeys.has(openingKey)) {
      errors.push(`duplicate opening balance ${openingKey}`);
    }

    openingKeys.add(openingKey);
  }

  for (const entry of rows.accounting_general_ledger_entries) {
    const subject = subjectByCode.get(entry.subject_code);

    requireNonBlank(errors, entry.id, 'accounting_general_ledger_entries.id');
    requireNonBlank(errors, entry.voucher_id, `ledger entry ${entry.id} voucher_id`);
    requireNonBlank(errors, entry.voucher_no, `ledger entry ${entry.id} voucher_no`);
    requireNonBlank(errors, entry.source_voucher_line_id, `ledger entry ${entry.id} source_voucher_line_id`);
    requireNonBlank(errors, entry.source_snapshot_hash, `ledger entry ${entry.id} source_snapshot_hash`);

    if (!isPeriod(entry.accounting_period)) {
      errors.push(`ledger entry ${entry.id} accounting_period must be YYYY-MM`);
    }

    if (!isIsoDate(entry.voucher_date)) {
      errors.push(`ledger entry ${entry.id} voucher_date must be YYYY-MM-DD`);
    }

    if (!subject) {
      errors.push(`ledger entry ${entry.id} references missing subject ${entry.subject_code}`);
    } else if (subject.name !== entry.subject_name) {
      errors.push(`ledger entry ${entry.id} subject_name must match accounting_subjects`);
    }

    const debitCents = validateMoney(errors, entry.debit_amount, `ledger entry ${entry.id} debit_amount`);
    const creditCents = validateMoney(errors, entry.credit_amount, `ledger entry ${entry.id} credit_amount`);

    if (Number.isFinite(debitCents) && Number.isFinite(creditCents)) {
      if (debitCents === 0 && creditCents === 0) {
        errors.push(`ledger entry ${entry.id} must have a debit or credit amount`);
      }

      if (debitCents > 0 && creditCents > 0) {
        errors.push(`ledger entry ${entry.id} cannot have both debit and credit amounts`);
      }
    }

    const voucherLineKey = `${entry.voucher_id}:${entry.source_voucher_line_id}`;

    if (voucherLineKeys.has(voucherLineKey)) {
      errors.push(`duplicate general-ledger voucher line ${voucherLineKey}`);
    }

    voucherLineKeys.add(voucherLineKey);
  }

  return errors;
}

function mapSubject(row: AccountingSubjectSqlRow): GeneralLedgerSubjectRecord {
  return {
    balanceDirection: row.balance_direction,
    code: row.code,
    name: row.name,
    reportItem: row.report_item,
    statementTarget: row.statement_target,
    status: row.status,
    type: row.type
  };
}

function mapOpeningBalance(row: AccountingOpeningBalanceSqlRow, subject: AccountingSubjectSqlRow): GeneralLedgerOpeningBalanceRecord {
  const directionSign = row.balance_direction === subject.balance_direction ? 1 : -1;
  const cents = parseMoneyToCents(row.amount) * directionSign;
  const sign = cents < 0 ? '-' : '';
  const absoluteCents = Math.abs(cents);

  return {
    accountingPeriod: row.accounting_period,
    amount: `${sign}${Math.floor(absoluteCents / 100)}.${String(absoluteCents % 100).padStart(2, '0')}`,
    source: row.source,
    subjectCode: row.subject_code
  };
}

function mapLedgerEntry(row: AccountingGeneralLedgerEntrySqlRow): GeneralLedgerLifecycleRow {
  return {
    accountingPeriod: row.accounting_period,
    auxiliary: row.auxiliary,
    createdAt: row.created_at,
    creditAmount: row.credit_amount,
    debitAmount: row.debit_amount,
    id: row.id,
    sourceSnapshotHash: row.source_snapshot_hash,
    sourceVoucherLineId: row.source_voucher_line_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    summary: row.summary,
    voucherDate: row.voucher_date,
    voucherId: row.voucher_id,
    voucherNo: row.voucher_no
  };
}

export function mapGeneralLedgerSqlRowsToReadState({
  periods,
  rows
}: {
  periods: AccountingPeriodRecord[];
  rows: GeneralLedgerSqlRows;
}) {
  const validationErrors = validateGeneralLedgerSqlRows(rows);

  if (validationErrors.length > 0) {
    throw new Error(`General-ledger SQL row contract failed: ${validationErrors.join('; ')}`);
  }

  const subjectByCode = new Map(rows.accounting_subjects.map((subject) => [subject.code, subject]));

  return {
    ledgerRows: rows.accounting_general_ledger_entries.map(mapLedgerEntry),
    openingBalances: rows.accounting_opening_balances.map((row) => {
      const subject = subjectByCode.get(row.subject_code);

      if (!subject) {
        throw new Error(`Missing accounting subject ${row.subject_code}`);
      }

      return mapOpeningBalance(row, subject);
    }),
    periods: periods.map((period) => ({ ...period })),
    subjects: rows.accounting_subjects.map(mapSubject)
  };
}

export function createGeneralLedgerSqlReadRepository({
  periods,
  rows
}: {
  periods: AccountingPeriodRecord[];
  rows: GeneralLedgerSqlRows;
}): GeneralLedgerSqlReadRepository {
  const committedRows = cloneRows(rows);
  const routeState = mapGeneralLedgerSqlRowsToReadState({ periods, rows: committedRows });

  return {
    readGeneralLedger: ({ accountingPeriod }) =>
      buildGeneralLedgerReadModel({
        accountingPeriod,
        ledgerRows: routeState.ledgerRows,
        openingBalances: routeState.openingBalances,
        periods: routeState.periods,
        subjects: routeState.subjects
      }),
    readRows: () => cloneRows(committedRows),
    readRouteState: () => ({
      ledgerRows: routeState.ledgerRows.map((row) => ({ ...row })),
      openingBalances: routeState.openingBalances.map((row) => ({ ...row })),
      periods: routeState.periods.map((row) => ({ ...row })),
      subjects: routeState.subjects.map((row) => ({ ...row }))
    })
  };
}
