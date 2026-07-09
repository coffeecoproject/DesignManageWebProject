import {
  requiredCloseCheckCodes,
  type AccountingPeriodEvent,
  type AccountingPeriodIdempotencyRecord,
  type ActorSnapshot,
  type CloseCheckCode,
  type ReopenAccountingPeriodImpactSnapshot,
  type ReopenAccountingPeriodRiskConfirmation
} from './periodCloseContract.js';
import type {
  FinancialStatementGeneralLedgerLine,
  FinancialStatementLine,
  FinancialStatementSnapshot
} from './financialStatementContract.js';
import type {
  PeriodClosePersistentState,
  PersistedPeriodCloseCheckSnapshot,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceMutationEvent
} from './periodClosePersistenceContract.js';

export type PeriodCloseDatabaseTableName =
  | 'accounting_periods'
  | 'accounting_period_close_checks'
  | 'accounting_period_close_check_items'
  | 'accounting_period_events'
  | 'accounting_period_idempotency_records'
  | 'accounting_period_source_mutation_events'
  | 'financial_statement_general_ledger_lines'
  | 'financial_statement_snapshot_lines'
  | 'financial_statement_snapshots';

export type PeriodCloseDatabaseColumn = {
  name: string;
  nullable: boolean;
  primaryKey?: boolean;
  references?: string;
  type: string;
  uniqueKey?: string;
};

export type PeriodCloseDatabaseTable = {
  columns: PeriodCloseDatabaseColumn[];
  name: PeriodCloseDatabaseTableName;
  notes: string[];
};

export type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

export type AccountingPeriodDbRow = {
  close_check_snapshot_hash?: string;
  close_check_snapshot_id?: string;
  close_reason?: string;
  closed_at?: string;
  closed_by?: string;
  closed_by_snapshot?: JsonValue;
  created_at: string;
  opened_at?: string;
  period: string;
  reopen_reason?: string;
  reopen_impact_snapshot?: JsonValue;
  reopen_risk_confirmation_snapshot?: JsonValue;
  reopened_at?: string;
  reopened_by?: string;
  reopened_by_snapshot?: JsonValue;
  status: '开放' | '已结账' | '已反结账';
  updated_at: string;
  version: number;
};

export type AccountingPeriodCloseCheckDbRow = {
  can_close: boolean;
  check_snapshot_hash: string;
  computed_at: string;
  computed_by?: string;
  id: string;
  period: string;
  persisted_for_close: boolean;
  request_id?: string;
  run_type: 'close_attempt' | 'close_snapshot';
  source_version_set_hash: string;
  status: '未运行' | '通过' | '阻断';
  trial_balance_difference: string;
  trial_balance_status: '平衡' | '不平' | '未生成';
  trial_credit_total: string;
  trial_debit_total: string;
};

export type AccountingPeriodCloseCheckItemDbRow = {
  blocker_count: number;
  can_pass: boolean;
  close_check_id: string;
  group_code: CloseCheckCode;
  group_label: string;
  id: string;
  next_action?: string;
  period: string;
  reason: string;
  reason_code?: string;
  snapshot?: JsonValue;
  source_id?: string;
  source_module?: string;
  source_no?: string;
  source_status?: string;
  source_version?: number;
  status: '不适用' | '提示' | '通过' | '阻断';
};

export type AccountingPeriodEventDbRow = {
  actor_id?: string;
  actor_snapshot?: JsonValue;
  after_status?: '开放' | '已结账' | '已反结账';
  before_status?: '开放' | '已结账' | '已反结账';
  close_check_id?: string;
  created_at: string;
  event_type: 'close_attempt_failed' | 'closed' | 'reopen_attempt_failed' | 'reopened';
  id: string;
  idempotency_key?: string;
  period: string;
  reason?: string;
  reopen_impact_snapshot?: JsonValue;
  reopen_risk_confirmation_snapshot?: JsonValue;
  request_id: string;
};

export type AccountingPeriodIdempotencyDbRow = {
  created_at: string;
  id: string;
  idempotency_key: string;
  operation: 'close' | 'reopen';
  period: string;
  request_signature: string;
  response_snapshot: JsonValue;
};

export type AccountingPeriodSourceMutationEventDbRow = {
  actor_id: string;
  actor_snapshot: JsonValue;
  affected_accounting_periods: JsonValue;
  created_at: string;
  event_type: 'source_mutation_applied' | 'source_mutation_rejected';
  id: string;
  operation: string;
  request_id: string;
  source_area: string;
  source_id: string;
};

export type FinancialStatementSnapshotDbStatementType = 'balance_sheet' | 'cash_flow' | 'profit_statement';

export type FinancialStatementSnapshotDbRow = {
  accounting_period: string;
  cash_flow_mapping_version_hash: string;
  generated_at: string;
  generated_by: string;
  generated_by_snapshot: JsonValue;
  id: string;
  snapshot_hash: string;
  source_ledger_hash: string;
  status: '已生成';
};

export type FinancialStatementSnapshotLineDbRow = {
  amount: string;
  accounting_period: string;
  id: string;
  item: string;
  line_index: number;
  section: string;
  snapshot_id: string;
  source_subject_codes: JsonValue;
  statement_type: FinancialStatementSnapshotDbStatementType;
  voucher_nos: JsonValue;
};

export type FinancialStatementGeneralLedgerLineDbRow = {
  accounting_period: string;
  credit_amount: string;
  debit_amount: string;
  entry_count: number;
  id: string;
  snapshot_id: string;
  source_ledger_hash: string;
  subject_code: string;
  voucher_nos: JsonValue;
};

export type PeriodCloseDatabaseRows = {
  accounting_period_close_check_items: AccountingPeriodCloseCheckItemDbRow[];
  accounting_period_close_checks: AccountingPeriodCloseCheckDbRow[];
  accounting_period_events: AccountingPeriodEventDbRow[];
  accounting_period_idempotency_records: AccountingPeriodIdempotencyDbRow[];
  accounting_period_source_mutation_events: AccountingPeriodSourceMutationEventDbRow[];
  accounting_periods: AccountingPeriodDbRow[];
  financial_statement_general_ledger_lines: FinancialStatementGeneralLedgerLineDbRow[];
  financial_statement_snapshot_lines: FinancialStatementSnapshotLineDbRow[];
  financial_statement_snapshots: FinancialStatementSnapshotDbRow[];
};

export const periodCloseDatabaseTables: PeriodCloseDatabaseTable[] = [
  {
    columns: [
      { name: 'period', nullable: false, primaryKey: true, type: 'text' },
      { name: 'status', nullable: false, type: 'accounting_period_status' },
      { name: 'opened_at', nullable: true, type: 'timestamptz' },
      { name: 'closed_at', nullable: true, type: 'timestamptz' },
      { name: 'closed_by', nullable: true, type: 'text' },
      { name: 'closed_by_snapshot', nullable: true, type: 'jsonb' },
      { name: 'close_reason', nullable: true, type: 'text' },
      { name: 'close_check_snapshot_id', nullable: true, references: 'accounting_period_close_checks.id', type: 'text' },
      { name: 'close_check_snapshot_hash', nullable: true, type: 'text' },
      { name: 'reopened_at', nullable: true, type: 'timestamptz' },
      { name: 'reopened_by', nullable: true, type: 'text' },
      { name: 'reopened_by_snapshot', nullable: true, type: 'jsonb' },
      { name: 'reopen_reason', nullable: true, type: 'text' },
      { name: 'reopen_impact_snapshot', nullable: true, type: 'jsonb' },
      { name: 'reopen_risk_confirmation_snapshot', nullable: true, type: 'jsonb' },
      { name: 'version', nullable: false, type: 'integer' },
      { name: 'created_at', nullable: false, type: 'timestamptz' },
      { name: 'updated_at', nullable: false, type: 'timestamptz' }
    ],
    name: 'accounting_periods',
    notes: [
      'period is the authoritative accounting-period identity.',
      'closed status requires close metadata and close snapshot reference.',
      'current executable contract uses stable text identifiers; production migrations may later choose uuid with a matching mapper change.',
      'version is used for optimistic concurrency.'
    ]
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'run_type', nullable: false, type: 'accounting_period_close_check_run_type' },
      { name: 'can_close', nullable: false, type: 'boolean' },
      { name: 'status', nullable: false, type: 'accounting_period_close_check_status' },
      { name: 'computed_at', nullable: false, type: 'timestamptz' },
      { name: 'computed_by', nullable: true, type: 'text' },
      { name: 'source_version_set_hash', nullable: false, type: 'text' },
      { name: 'check_snapshot_hash', nullable: false, type: 'text' },
      { name: 'trial_debit_total', nullable: false, type: 'numeric(18,2)' },
      { name: 'trial_credit_total', nullable: false, type: 'numeric(18,2)' },
      { name: 'trial_balance_difference', nullable: false, type: 'numeric(18,2)' },
      { name: 'trial_balance_status', nullable: false, type: 'trial_balance_status' },
      { name: 'persisted_for_close', nullable: false, type: 'boolean' },
      { name: 'request_id', nullable: true, type: 'text' }
    ],
    name: 'accounting_period_close_checks',
    notes: [
      'successful close must persist exactly one close_snapshot row for the close transaction.',
      'check_snapshot_hash excludes volatile fields.',
      'period plus hash plus run type plus persisted flag can deduplicate equivalent snapshots.'
    ]
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'close_check_id', nullable: false, references: 'accounting_period_close_checks.id', type: 'text' },
      { name: 'period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'group_code', nullable: false, type: 'accounting_period_close_check_group' },
      { name: 'group_label', nullable: false, type: 'text' },
      { name: 'status', nullable: false, type: 'close_check_item_status' },
      { name: 'can_pass', nullable: false, type: 'boolean' },
      { name: 'blocker_count', nullable: false, type: 'integer' },
      { name: 'source_module', nullable: true, type: 'text' },
      { name: 'source_id', nullable: true, type: 'text' },
      { name: 'source_no', nullable: true, type: 'text' },
      { name: 'source_status', nullable: true, type: 'text' },
      { name: 'source_version', nullable: true, type: 'integer' },
      { name: 'reason_code', nullable: true, type: 'text' },
      { name: 'reason', nullable: false, type: 'text' },
      { name: 'next_action', nullable: true, type: 'text' },
      { name: 'snapshot', nullable: true, type: 'jsonb' }
    ],
    name: 'accounting_period_close_check_items',
    notes: ['items are immutable once linked to a close_snapshot row.']
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'event_type', nullable: false, type: 'accounting_period_event_type' },
      { name: 'before_status', nullable: true, type: 'accounting_period_status' },
      { name: 'after_status', nullable: true, type: 'accounting_period_status' },
      { name: 'actor_id', nullable: true, type: 'text' },
      { name: 'actor_snapshot', nullable: true, type: 'jsonb' },
      { name: 'reason', nullable: true, type: 'text' },
      { name: 'reopen_impact_snapshot', nullable: true, type: 'jsonb' },
      { name: 'reopen_risk_confirmation_snapshot', nullable: true, type: 'jsonb' },
      { name: 'close_check_id', nullable: true, references: 'accounting_period_close_checks.id', type: 'text' },
      { name: 'idempotency_key', nullable: true, type: 'text' },
      { name: 'request_id', nullable: false, type: 'text' },
      { name: 'created_at', nullable: false, type: 'timestamptz' }
    ],
    name: 'accounting_period_events',
    notes: ['events are append-only and must not be deleted by reopen.']
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'period', nullable: false, references: 'accounting_periods.period', type: 'text', uniqueKey: 'period_operation_idempotency_key' },
      { name: 'operation', nullable: false, type: 'text', uniqueKey: 'period_operation_idempotency_key' },
      { name: 'idempotency_key', nullable: false, type: 'text', uniqueKey: 'period_operation_idempotency_key' },
      { name: 'request_signature', nullable: false, type: 'text' },
      { name: 'response_snapshot', nullable: false, type: 'jsonb' },
      { name: 'created_at', nullable: false, type: 'timestamptz' }
    ],
    name: 'accounting_period_idempotency_records',
    notes: ['unique period plus operation plus idempotency_key prevents duplicate effective close or reopen.']
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'source_area', nullable: false, type: 'text' },
      { name: 'source_id', nullable: false, type: 'text' },
      { name: 'event_type', nullable: false, type: 'text' },
      { name: 'operation', nullable: false, type: 'text' },
      { name: 'affected_accounting_periods', nullable: false, type: 'jsonb' },
      { name: 'actor_id', nullable: false, type: 'text' },
      { name: 'actor_snapshot', nullable: false, type: 'jsonb' },
      { name: 'request_id', nullable: false, type: 'text' },
      { name: 'created_at', nullable: false, type: 'timestamptz' }
    ],
    name: 'accounting_period_source_mutation_events',
    notes: ['source modules may own their domain events; this table is the period-close guard audit contract.']
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'accounting_period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'status', nullable: false, type: 'financial_statement_snapshot_status' },
      { name: 'source_ledger_hash', nullable: false, type: 'text' },
      { name: 'cash_flow_mapping_version_hash', nullable: false, type: 'text' },
      { name: 'snapshot_hash', nullable: false, type: 'text' },
      { name: 'generated_at', nullable: false, type: 'timestamptz' },
      { name: 'generated_by', nullable: false, type: 'text' },
      { name: 'generated_by_snapshot', nullable: false, type: 'jsonb' }
    ],
    name: 'financial_statement_snapshots',
    notes: [
      'formal financial statements are immutable snapshots generated after period close.',
      'source_ledger_hash binds the report to the ledger facts used at generation time.',
      'cash_flow_mapping_version_hash binds cash-flow rows to the mapping version used at generation time.'
    ]
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'snapshot_id', nullable: false, references: 'financial_statement_snapshots.id', type: 'text' },
      { name: 'accounting_period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'statement_type', nullable: false, type: 'financial_statement_type' },
      { name: 'line_index', nullable: false, type: 'integer' },
      { name: 'section', nullable: false, type: 'text' },
      { name: 'item', nullable: false, type: 'text' },
      { name: 'amount', nullable: false, type: 'numeric(18,2)' },
      { name: 'source_subject_codes', nullable: false, type: 'jsonb' },
      { name: 'voucher_nos', nullable: false, type: 'jsonb' }
    ],
    name: 'financial_statement_snapshot_lines',
    notes: ['stores immutable balance sheet, profit statement, and cash-flow snapshot lines.']
  },
  {
    columns: [
      { name: 'id', nullable: false, primaryKey: true, type: 'text' },
      { name: 'snapshot_id', nullable: false, references: 'financial_statement_snapshots.id', type: 'text' },
      { name: 'accounting_period', nullable: false, references: 'accounting_periods.period', type: 'text' },
      { name: 'subject_code', nullable: false, type: 'text' },
      { name: 'debit_amount', nullable: false, type: 'numeric(18,2)' },
      { name: 'credit_amount', nullable: false, type: 'numeric(18,2)' },
      { name: 'entry_count', nullable: false, type: 'integer' },
      { name: 'source_ledger_hash', nullable: false, type: 'text' },
      { name: 'voucher_nos', nullable: false, type: 'jsonb' }
    ],
    name: 'financial_statement_general_ledger_lines',
    notes: ['stores immutable subject-level general-ledger rows used by the formal statement snapshot.']
  }
];

function toJsonActor(actor?: ActorSnapshot): JsonValue | undefined {
  return actor ? { id: actor.id, name: actor.name } : undefined;
}

function toJsonValue(value?: ReopenAccountingPeriodImpactSnapshot | ReopenAccountingPeriodRiskConfirmation): JsonValue | undefined {
  return value === undefined ? undefined : (value as unknown as JsonValue);
}

function fromJsonActor(value: JsonValue | undefined): ActorSnapshot | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const maybeActor = value as { id?: JsonValue; name?: JsonValue };

  if (typeof maybeActor.id !== 'string' || typeof maybeActor.name !== 'string') {
    return undefined;
  }

  return {
    id: maybeActor.id,
    name: maybeActor.name
  };
}

function fallbackTimestamp(period: PersistentAccountingPeriodRecord, fallbackNow: string) {
  return period.closedAt ?? period.reopenedAt ?? fallbackNow;
}

function mapPeriod(period: PersistentAccountingPeriodRecord, fallbackNow: string): AccountingPeriodDbRow {
  const timestamp = fallbackTimestamp(period, fallbackNow);

  return {
    close_check_snapshot_hash: period.closeCheckSnapshotHash,
    close_check_snapshot_id: period.closeCheckSnapshotId,
    close_reason: period.closeReason,
    closed_at: period.closedAt,
    closed_by: period.closedBySnapshot?.id,
    closed_by_snapshot: toJsonActor(period.closedBySnapshot),
    created_at: timestamp,
    opened_at: period.status === '开放' ? timestamp : undefined,
    period: period.period,
    reopen_reason: period.reopenReason,
    reopen_impact_snapshot: toJsonValue(period.reopenImpactSnapshot),
    reopen_risk_confirmation_snapshot: toJsonValue(period.reopenRiskConfirmationSnapshot),
    reopened_at: period.reopenedAt,
    reopened_by: period.reopenedBySnapshot?.id,
    reopened_by_snapshot: toJsonActor(period.reopenedBySnapshot),
    status: period.status,
    updated_at: timestamp,
    version: period.version
  };
}

function mapCloseCheck(snapshot: PersistedPeriodCloseCheckSnapshot): AccountingPeriodCloseCheckDbRow {
  return {
    can_close: snapshot.canClose,
    check_snapshot_hash: snapshot.checkSnapshotHash,
    computed_at: snapshot.computedAt,
    id: snapshot.id,
    period: snapshot.period,
    persisted_for_close: snapshot.persistedForClose,
    request_id: snapshot.requestId,
    run_type: snapshot.runType,
    source_version_set_hash: snapshot.sourceVersionSetHash,
    status: snapshot.status,
    trial_balance_difference: snapshot.trialBalance.difference,
    trial_balance_status: snapshot.trialBalance.status,
    trial_credit_total: snapshot.trialBalance.creditTotal,
    trial_debit_total: snapshot.trialBalance.debitTotal
  };
}

function mapCloseCheckItems(snapshot: PersistedPeriodCloseCheckSnapshot): AccountingPeriodCloseCheckItemDbRow[] {
  return snapshot.checks.flatMap((check) => {
    if (check.sources.length === 0) {
      return [
        {
          blocker_count: check.blockerCount,
          can_pass: check.canPass,
          close_check_id: snapshot.id,
          group_code: check.code,
          group_label: check.label,
          id: `${snapshot.id}:${check.code}:aggregate`,
          next_action: check.nextModule,
          period: snapshot.period,
          reason: check.summary,
          reason_code: check.status === '阻断' ? `${check.code}_aggregate_blocker` : undefined,
          status: check.status
        }
      ];
    }

    return check.sources.map((source, sourceIndex) => ({
      blocker_count: 1,
      can_pass: check.canPass,
      close_check_id: snapshot.id,
      group_code: check.code,
      group_label: check.label,
      id: `${snapshot.id}:${check.code}:${source.sourceId}:${sourceIndex + 1}`,
      next_action: source.nextAction,
      period: snapshot.period,
      reason: source.reason,
      reason_code: source.reasonCode,
      source_id: source.sourceId,
      source_module: source.sourceModule,
      source_no: source.sourceNo,
      source_status: source.sourceStatus,
      status: check.status
    }));
  });
}

function mapEvent(
  event: AccountingPeriodEvent,
  eventIndex: number,
  snapshots: PersistedPeriodCloseCheckSnapshot[]
): AccountingPeriodEventDbRow {
  const closeCheckId = event.closeCheckSnapshotHash
    ? snapshots.find(
        (snapshot) => snapshot.period === event.period && snapshot.checkSnapshotHash === event.closeCheckSnapshotHash
      )?.id
    : undefined;

  return {
    actor_id: event.actorSnapshot?.id,
    actor_snapshot: toJsonActor(event.actorSnapshot),
    after_status: event.afterStatus,
    before_status: event.beforeStatus,
    close_check_id: closeCheckId,
    created_at: event.timestamp,
    event_type: event.eventType,
    id: `period-event-${event.period}-${event.requestId}-${event.eventType}-${eventIndex + 1}`,
    idempotency_key: event.idempotencyKey,
    period: event.period,
    reason: event.reason,
    reopen_impact_snapshot: toJsonValue(event.reopenImpactSnapshot),
    reopen_risk_confirmation_snapshot: toJsonValue(event.reopenRiskConfirmationSnapshot),
    request_id: event.requestId
  };
}

function getIdempotencyCreatedAt(record: AccountingPeriodIdempotencyRecord) {
  return record.response.event.timestamp;
}

function mapIdempotencyRecord(record: AccountingPeriodIdempotencyRecord): AccountingPeriodIdempotencyDbRow {
  return {
    created_at: getIdempotencyCreatedAt(record),
    id: `period-idempotency-${record.period}-${record.operation}-${record.idempotencyKey}`,
    idempotency_key: record.idempotencyKey,
    operation: record.operation,
    period: record.period,
    request_signature: record.requestSignature,
    response_snapshot: record.response as unknown as JsonValue
  };
}

function mapSourceMutationEvent(
  event: PersistentFinanceSourceMutationEvent,
  eventIndex: number
): AccountingPeriodSourceMutationEventDbRow {
  return {
    actor_id: event.actorSnapshot.id,
    actor_snapshot: toJsonActor(event.actorSnapshot) ?? null,
    affected_accounting_periods: event.affectedAccountingPeriods,
    created_at: event.timestamp,
    event_type: event.eventType,
    id: `period-source-event-${event.sourceArea}-${event.sourceId}-${event.requestId}-${eventIndex + 1}`,
    operation: event.operation,
    request_id: event.requestId,
    source_area: event.sourceArea,
    source_id: event.sourceId
  };
}

function asJsonStringArray(values: readonly string[]): JsonValue {
  return [...new Set(values)].sort();
}

function readJsonStringArray(value: JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string').sort();
}

function hasValidReopenRiskConfirmationJson(value: JsonValue | undefined): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const maybeRisk = value as { decisionNo?: JsonValue; note?: JsonValue };

  return (
    typeof maybeRisk.decisionNo === 'string' &&
    maybeRisk.decisionNo.trim().length > 0 &&
    typeof maybeRisk.note === 'string' &&
    maybeRisk.note.trim().length > 0
  );
}

function isStringArrayJson(value: JsonValue | undefined): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasValidReopenImpactSnapshotJson(value: JsonValue | undefined): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const maybeImpact = value as {
    irreversibleExternalSubmissions?: JsonValue;
    laterClosedPeriods?: JsonValue;
  };

  return Array.isArray(maybeImpact.irreversibleExternalSubmissions) && isStringArrayJson(maybeImpact.laterClosedPeriods);
}

function hasMaterialReopenImpactSnapshotJson(value: JsonValue | undefined): boolean {
  if (!hasValidReopenImpactSnapshotJson(value)) {
    return false;
  }

  const maybeImpact = value as {
    irreversibleExternalSubmissions: JsonValue[];
    laterClosedPeriods: string[];
  };

  return maybeImpact.irreversibleExternalSubmissions.length > 0 || maybeImpact.laterClosedPeriods.length > 0;
}

function snapshotRowId(snapshot: FinancialStatementSnapshot) {
  return `financial-statement-snapshot-${snapshot.accountingPeriod}-${snapshot.snapshotHash}`;
}

function mapFinancialStatementSnapshot(snapshot: FinancialStatementSnapshot): FinancialStatementSnapshotDbRow {
  return {
    accounting_period: snapshot.accountingPeriod,
    cash_flow_mapping_version_hash: snapshot.cashFlowMappingVersionHash,
    generated_at: snapshot.generatedAt,
    generated_by: snapshot.generatedBySnapshot.id,
    generated_by_snapshot: toJsonActor(snapshot.generatedBySnapshot) ?? null,
    id: snapshotRowId(snapshot),
    snapshot_hash: snapshot.snapshotHash,
    source_ledger_hash: snapshot.sourceLedgerHash,
    status: snapshot.status
  };
}

function mapFinancialStatementLines({
  lines,
  snapshot,
  statementType
}: {
  lines: readonly FinancialStatementLine[];
  snapshot: FinancialStatementSnapshot;
  statementType: FinancialStatementSnapshotDbStatementType;
}): FinancialStatementSnapshotLineDbRow[] {
  const parentId = snapshotRowId(snapshot);

  return lines.map((line, lineIndex) => ({
    accounting_period: snapshot.accountingPeriod,
    amount: line.amount,
    id: `${parentId}:${statementType}:${lineIndex + 1}`,
    item: line.item,
    line_index: lineIndex + 1,
    section: line.section,
    snapshot_id: parentId,
    source_subject_codes: asJsonStringArray(line.sourceSubjectCodes),
    statement_type: statementType,
    voucher_nos: asJsonStringArray(line.voucherNos)
  }));
}

function mapGeneralLedgerLine({
  line,
  lineIndex,
  snapshot
}: {
  line: FinancialStatementGeneralLedgerLine;
  lineIndex: number;
  snapshot: FinancialStatementSnapshot;
}): FinancialStatementGeneralLedgerLineDbRow {
  const parentId = snapshotRowId(snapshot);

  return {
    accounting_period: snapshot.accountingPeriod,
    credit_amount: line.creditAmount,
    debit_amount: line.debitAmount,
    entry_count: line.entryCount,
    id: `${parentId}:general-ledger:${line.subjectCode}:${lineIndex + 1}`,
    snapshot_id: parentId,
    source_ledger_hash: line.sourceLedgerHash,
    subject_code: line.subjectCode,
    voucher_nos: asJsonStringArray(line.voucherNos)
  };
}

export function mapFinancialStatementSnapshotsToDatabaseRows(
  snapshots: readonly FinancialStatementSnapshot[]
): Pick<
  PeriodCloseDatabaseRows,
  'financial_statement_general_ledger_lines' | 'financial_statement_snapshot_lines' | 'financial_statement_snapshots'
> {
  return {
    financial_statement_general_ledger_lines: snapshots.flatMap((snapshot) =>
      snapshot.generalLedgerLines.map((line, lineIndex) => mapGeneralLedgerLine({ line, lineIndex, snapshot }))
    ),
    financial_statement_snapshot_lines: snapshots.flatMap((snapshot) => [
      ...mapFinancialStatementLines({
        lines: snapshot.balanceSheetLines,
        snapshot,
        statementType: 'balance_sheet'
      }),
      ...mapFinancialStatementLines({
        lines: snapshot.profitStatementLines,
        snapshot,
        statementType: 'profit_statement'
      }),
      ...mapFinancialStatementLines({
        lines: snapshot.cashFlowLines,
        snapshot,
        statementType: 'cash_flow'
      })
    ]),
    financial_statement_snapshots: snapshots.map(mapFinancialStatementSnapshot)
  };
}

export function mapPeriodCloseStateToDatabaseRows({
  fallbackNow,
  financialStatementSnapshots = [],
  state
}: {
  fallbackNow: string;
  financialStatementSnapshots?: readonly FinancialStatementSnapshot[];
  state: PeriodClosePersistentState;
}): PeriodCloseDatabaseRows {
  const financialStatementRows = mapFinancialStatementSnapshotsToDatabaseRows(financialStatementSnapshots);

  return {
    accounting_period_close_check_items: state.closeCheckSnapshots.flatMap(mapCloseCheckItems),
    accounting_period_close_checks: state.closeCheckSnapshots.map(mapCloseCheck),
    accounting_period_events: state.periodEvents.map((event, eventIndex) =>
      mapEvent(event, eventIndex, state.closeCheckSnapshots)
    ),
    accounting_period_idempotency_records: state.idempotencyRecords.map(mapIdempotencyRecord),
    accounting_period_source_mutation_events: state.sourceMutationEvents.map(mapSourceMutationEvent),
    accounting_periods: state.periods.map((period) => mapPeriod(period, fallbackNow)),
    ...financialStatementRows
  };
}

function hydrateStatementLines(
  rows: FinancialStatementSnapshotLineDbRow[],
  statementType: FinancialStatementSnapshotDbStatementType
): FinancialStatementLine[] {
  return rows
    .filter((row) => row.statement_type === statementType)
    .sort((left, right) => left.line_index - right.line_index)
    .map((row) => ({
      amount: row.amount,
      item: row.item,
      section: row.section,
      sourceSubjectCodes: readJsonStringArray(row.source_subject_codes),
      voucherNos: readJsonStringArray(row.voucher_nos)
    }));
}

export function hydrateFinancialStatementSnapshotsFromDatabaseRows(
  rows: PeriodCloseDatabaseRows
): FinancialStatementSnapshot[] {
  return rows.financial_statement_snapshots
    .map((snapshotRow) => {
      const lineRows = rows.financial_statement_snapshot_lines.filter((line) => line.snapshot_id === snapshotRow.id);

      return {
        accountingPeriod: snapshotRow.accounting_period,
        balanceSheetLines: hydrateStatementLines(lineRows, 'balance_sheet'),
        cashFlowLines: hydrateStatementLines(lineRows, 'cash_flow'),
        cashFlowMappingVersionHash: snapshotRow.cash_flow_mapping_version_hash,
        generatedAt: snapshotRow.generated_at,
        generatedBySnapshot: fromJsonActor(snapshotRow.generated_by_snapshot) ?? {
          id: snapshotRow.generated_by,
          name: snapshotRow.generated_by
        },
        generalLedgerLines: rows.financial_statement_general_ledger_lines
          .filter((line) => line.snapshot_id === snapshotRow.id)
          .sort((left, right) => left.subject_code.localeCompare(right.subject_code))
          .map((line) => ({
            accountingPeriod: line.accounting_period,
            creditAmount: line.credit_amount,
            debitAmount: line.debit_amount,
            entryCount: line.entry_count,
            sourceLedgerHash: line.source_ledger_hash,
            subjectCode: line.subject_code,
            voucherNos: readJsonStringArray(line.voucher_nos)
          })),
        profitStatementLines: hydrateStatementLines(lineRows, 'profit_statement'),
        snapshotHash: snapshotRow.snapshot_hash,
        sourceLedgerHash: snapshotRow.source_ledger_hash,
        status: snapshotRow.status
      };
    })
    .sort((left, right) => left.accountingPeriod.localeCompare(right.accountingPeriod) || left.generatedAt.localeCompare(right.generatedAt));
}

export function validatePeriodCloseDatabaseRows(rows: PeriodCloseDatabaseRows): string[] {
  const errors: string[] = [];
  const periodSet = new Set(rows.accounting_periods.map((row) => row.period));
  const closedPeriodSet = new Set(rows.accounting_periods.filter((row) => row.status === '已结账').map((row) => row.period));
  const closeCheckSet = new Set(rows.accounting_period_close_checks.map((row) => row.id));
  const idempotencyUniqueKeys = new Set<string>();
  const financialStatementSnapshotSet = new Set<string>();
  const financialStatementSnapshotById = new Map(rows.financial_statement_snapshots.map((row) => [row.id, row]));

  for (const period of rows.accounting_periods) {
    if (period.status === '已结账') {
      if (!period.closed_at || !period.closed_by || !period.closed_by_snapshot || !period.close_reason) {
        errors.push(`accounting_periods:${period.period}:closed metadata is incomplete`);
      }

      if (!period.close_check_snapshot_id || !closeCheckSet.has(period.close_check_snapshot_id)) {
        errors.push(`accounting_periods:${period.period}:closed period must reference persisted close snapshot`);
      }
    }

    if (period.status === '已反结账') {
      if (!period.reopened_at || !period.reopened_by || !period.reopened_by_snapshot || !period.reopen_reason) {
        errors.push(`accounting_periods:${period.period}:reopened metadata is incomplete`);
      }

      if (period.reopen_impact_snapshot && !hasValidReopenImpactSnapshotJson(period.reopen_impact_snapshot)) {
        errors.push(`accounting_periods:${period.period}:reopen impact snapshot is invalid`);
      }

      if (
        hasMaterialReopenImpactSnapshotJson(period.reopen_impact_snapshot) &&
        !hasValidReopenRiskConfirmationJson(period.reopen_risk_confirmation_snapshot)
      ) {
        errors.push(`accounting_periods:${period.period}:reopen risk confirmation is incomplete`);
      }
    }
  }

  for (const snapshot of rows.accounting_period_close_checks) {
    if (!periodSet.has(snapshot.period)) {
      errors.push(`accounting_period_close_checks:${snapshot.id}:period is missing`);
    }

    if (snapshot.persisted_for_close && snapshot.run_type !== 'close_snapshot') {
      errors.push(`accounting_period_close_checks:${snapshot.id}:persisted close must be close_snapshot`);
    }
  }

  for (const item of rows.accounting_period_close_check_items) {
    if (!closeCheckSet.has(item.close_check_id)) {
      errors.push(`accounting_period_close_check_items:${item.id}:close_check_id is missing`);
    }

    if (!requiredCloseCheckCodes.includes(item.group_code)) {
      errors.push(`accounting_period_close_check_items:${item.id}:unknown group_code`);
    }

    if (item.status === '阻断' && item.source_id && (!item.source_module || !item.source_no)) {
      errors.push(`accounting_period_close_check_items:${item.id}:blocking source row is incomplete`);
    }
  }

  for (const event of rows.accounting_period_events) {
    if (!periodSet.has(event.period)) {
      errors.push(`accounting_period_events:${event.id}:period is missing`);
    }

    if (event.close_check_id && !closeCheckSet.has(event.close_check_id)) {
      errors.push(`accounting_period_events:${event.id}:close_check_id is missing`);
    }

    if (event.reopen_impact_snapshot && !hasValidReopenImpactSnapshotJson(event.reopen_impact_snapshot)) {
      errors.push(`accounting_period_events:${event.id}:reopen impact snapshot is invalid`);
    }

    if (event.reopen_risk_confirmation_snapshot && !hasValidReopenRiskConfirmationJson(event.reopen_risk_confirmation_snapshot)) {
      errors.push(`accounting_period_events:${event.id}:reopen risk confirmation is incomplete`);
    }
  }

  for (const record of rows.accounting_period_idempotency_records) {
    const uniqueKey = `${record.period}:${record.operation}:${record.idempotency_key}`;

    if (idempotencyUniqueKeys.has(uniqueKey)) {
      errors.push(`accounting_period_idempotency_records:${record.id}:duplicate idempotency key`);
    }

    idempotencyUniqueKeys.add(uniqueKey);
  }

  for (const event of rows.accounting_period_source_mutation_events) {
    if (!event.source_area || !event.source_id || !event.operation) {
      errors.push(`accounting_period_source_mutation_events:${event.id}:source identity is incomplete`);
    }

    if (!event.actor_id || !event.actor_snapshot || !event.request_id || !event.created_at) {
      errors.push(`accounting_period_source_mutation_events:${event.id}:audit metadata is incomplete`);
    }

    if (!Array.isArray(event.affected_accounting_periods) || event.affected_accounting_periods.length === 0) {
      errors.push(`accounting_period_source_mutation_events:${event.id}:affected periods are missing`);
      continue;
    }

    for (const affectedPeriod of event.affected_accounting_periods) {
      if (typeof affectedPeriod !== 'string' || !periodSet.has(affectedPeriod)) {
        errors.push(`accounting_period_source_mutation_events:${event.id}:affected period is unresolved`);
      }
    }
  }

  for (const snapshot of rows.financial_statement_snapshots) {
    if (financialStatementSnapshotSet.has(snapshot.id)) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:duplicate snapshot id`);
    }

    financialStatementSnapshotSet.add(snapshot.id);

    if (!periodSet.has(snapshot.accounting_period)) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:accounting period is missing`);
    }

    if (!closedPeriodSet.has(snapshot.accounting_period)) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:formal snapshot must reference a closed period`);
    }

    if (!snapshot.source_ledger_hash || !snapshot.cash_flow_mapping_version_hash || !snapshot.snapshot_hash) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:snapshot hashes are incomplete`);
    }

    if (!snapshot.generated_by || !snapshot.generated_by_snapshot || !snapshot.generated_at) {
      errors.push(`financial_statement_snapshots:${snapshot.id}:generation audit metadata is incomplete`);
    }
  }

  for (const line of rows.financial_statement_snapshot_lines) {
    const snapshot = financialStatementSnapshotById.get(line.snapshot_id);

    if (!snapshot) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:snapshot_id is missing`);
      continue;
    }

    if (line.accounting_period !== snapshot.accounting_period) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:accounting period does not match snapshot`);
    }

    if (line.line_index < 1 || !Number.isInteger(line.line_index)) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:line_index must be a positive integer`);
    }

    if (!Array.isArray(line.source_subject_codes) || !Array.isArray(line.voucher_nos)) {
      errors.push(`financial_statement_snapshot_lines:${line.id}:source subjects and vouchers must be arrays`);
    }
  }

  for (const line of rows.financial_statement_general_ledger_lines) {
    const snapshot = financialStatementSnapshotById.get(line.snapshot_id);

    if (!snapshot) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:snapshot_id is missing`);
      continue;
    }

    if (line.accounting_period !== snapshot.accounting_period) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:accounting period does not match snapshot`);
    }

    if (line.source_ledger_hash !== snapshot.source_ledger_hash) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:source ledger hash does not match snapshot`);
    }

    if (line.entry_count < 1 || !Number.isInteger(line.entry_count)) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:entry_count must be a positive integer`);
    }

    if (!Array.isArray(line.voucher_nos)) {
      errors.push(`financial_statement_general_ledger_lines:${line.id}:voucher_nos must be an array`);
    }
  }

  return errors;
}
