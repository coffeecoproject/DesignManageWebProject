import type {
  AccountingPeriodEvent,
  AccountingPeriodIdempotencyRecord,
  ActorSnapshot,
  CloseCheckRow,
  CloseCheckSourceRef,
  CloseCheckStatus,
  TrialBalanceSnapshot
} from './periodCloseContract.js';
import {
  hydrateFinancialStatementSnapshotsFromDatabaseRows,
  mapPeriodCloseStateToDatabaseRows,
  validatePeriodCloseDatabaseRows,
  type AccountingPeriodCloseCheckItemDbRow,
  type AccountingPeriodEventDbRow,
  type AccountingPeriodIdempotencyDbRow,
  type AccountingPeriodSourceMutationEventDbRow,
  type AccountingPeriodDbRow,
  type JsonValue,
  type PeriodCloseDatabaseRows
} from './periodCloseDatabaseContract.js';
import type { FinancialStatementSnapshot } from './financialStatementContract.js';
import type {
  AccountingVoucherLaterPeriodAdjustmentEvent,
  AccountingVoucherLaterPeriodAdjustmentFact,
  AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord,
  AccountingVoucherLaterPeriodAdjustmentSuccess,
  AccountingVoucherPersistedRecord
} from './accountingVoucherLaterPeriodAdjustmentContract.js';
import type { AccountingPeriodVoucherCountSourceRow } from './periodCloseVoucherSummaryContract.js';
import {
  type PeriodCloseCheckInput,
  type PeriodClosePersistentState,
  type PersistentAccountingPeriodRecord,
  type PersistentFinanceSourceMutationEvent,
  type PersistentFinanceSourceRecord,
  type PersistedPeriodCloseCheckSnapshot
} from './periodClosePersistenceContract.js';
import {
  type PeriodCloseRepository,
  type PeriodCloseRepositoryTransaction,
  type PeriodCloseRepositoryTransactionResult
} from './periodCloseRepositoryContract.js';

export type PeriodCloseDatabaseRepositorySnapshot = {
  accountingVouchers?: AccountingVoucherPersistedRecord[];
  checkInputs: Record<string, PeriodCloseCheckInput>;
  laterPeriodAdjustmentEvents?: AccountingVoucherLaterPeriodAdjustmentEvent[];
  laterPeriodAdjustmentFacts?: AccountingVoucherLaterPeriodAdjustmentFact[];
  laterPeriodAdjustmentIdempotencyRecords?: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[];
  periodCloseRows: PeriodCloseDatabaseRows;
  sourceRecords: PersistentFinanceSourceRecord[];
  voucherRows?: AccountingPeriodVoucherCountSourceRow[];
};

export type PeriodCloseDatabaseRepository = PeriodCloseRepository & {
  commitAccountingVoucherLaterPeriodAdjustment: (
    result: AccountingVoucherLaterPeriodAdjustmentSuccess
  ) => PeriodCloseDatabaseRepositorySnapshot;
  commitFinancialStatementSnapshot: (snapshot: FinancialStatementSnapshot) => PeriodCloseDatabaseRepositorySnapshot;
  readDatabaseSnapshot: () => PeriodCloseDatabaseRepositorySnapshot;
  readFinancialStatementSnapshots: () => FinancialStatementSnapshot[];
};

function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]));
  }

  return value;
}

function cloneOptionalJsonValue(value: JsonValue | undefined): JsonValue | undefined {
  return value === undefined ? undefined : cloneJsonValue(value);
}

function cloneDatabaseRows(rows: PeriodCloseDatabaseRows): PeriodCloseDatabaseRows {
  return {
    accounting_period_close_check_items: rows.accounting_period_close_check_items.map((row) => ({
      ...row,
      snapshot: cloneOptionalJsonValue(row.snapshot)
    })),
    accounting_period_close_checks: rows.accounting_period_close_checks.map((row) => ({ ...row })),
    accounting_period_events: rows.accounting_period_events.map((row) => ({
      ...row,
      actor_snapshot: cloneOptionalJsonValue(row.actor_snapshot),
      reopen_impact_snapshot: cloneOptionalJsonValue(row.reopen_impact_snapshot),
      reopen_risk_confirmation_snapshot: cloneOptionalJsonValue(row.reopen_risk_confirmation_snapshot)
    })),
    accounting_period_idempotency_records: rows.accounting_period_idempotency_records.map((row) => ({
      ...row,
      response_snapshot: cloneJsonValue(row.response_snapshot)
    })),
    accounting_period_source_mutation_events: rows.accounting_period_source_mutation_events.map((row) => ({
      ...row,
      actor_snapshot: cloneJsonValue(row.actor_snapshot),
      affected_accounting_periods: cloneJsonValue(row.affected_accounting_periods)
    })),
    accounting_periods: rows.accounting_periods.map((row) => ({
      ...row,
      closed_by_snapshot: cloneOptionalJsonValue(row.closed_by_snapshot),
      reopen_impact_snapshot: cloneOptionalJsonValue(row.reopen_impact_snapshot),
      reopen_risk_confirmation_snapshot: cloneOptionalJsonValue(row.reopen_risk_confirmation_snapshot),
      reopened_by_snapshot: cloneOptionalJsonValue(row.reopened_by_snapshot)
    })),
    financial_statement_general_ledger_lines: rows.financial_statement_general_ledger_lines.map((row) => ({
      ...row,
      voucher_nos: cloneJsonValue(row.voucher_nos)
    })),
    financial_statement_snapshot_lines: rows.financial_statement_snapshot_lines.map((row) => ({
      ...row,
      source_subject_codes: cloneJsonValue(row.source_subject_codes),
      voucher_nos: cloneJsonValue(row.voucher_nos)
    })),
    financial_statement_snapshots: rows.financial_statement_snapshots.map((row) => ({
      ...row,
      generated_by_snapshot: cloneJsonValue(row.generated_by_snapshot)
    }))
  };
}

function cloneCheckInput(input: PeriodCloseCheckInput): PeriodCloseCheckInput {
  return {
    checks: input.checks.map((check) => ({
      ...check,
      sources: check.sources.map((source) => ({ ...source }))
    })),
    computedAt: input.computedAt,
    sourceVersionSetHash: input.sourceVersionSetHash,
    trialBalance: { ...input.trialBalance }
  };
}

function cloneSnapshot({
  accountingVouchers,
  checkInputs,
  laterPeriodAdjustmentEvents,
  laterPeriodAdjustmentFacts,
  laterPeriodAdjustmentIdempotencyRecords,
  periodCloseRows,
  sourceRecords,
  voucherRows
}: PeriodCloseDatabaseRepositorySnapshot): PeriodCloseDatabaseRepositorySnapshot {
  return {
    ...(accountingVouchers ? { accountingVouchers: accountingVouchers.map(cloneAccountingVoucher) } : {}),
    checkInputs: Object.fromEntries(
      Object.entries(checkInputs).map(([period, input]) => [period, cloneCheckInput(input)])
    ),
    ...(laterPeriodAdjustmentEvents
      ? { laterPeriodAdjustmentEvents: laterPeriodAdjustmentEvents.map(cloneLaterPeriodAdjustmentEvent) }
      : {}),
    ...(laterPeriodAdjustmentFacts
      ? { laterPeriodAdjustmentFacts: laterPeriodAdjustmentFacts.map(cloneLaterPeriodAdjustmentFact) }
      : {}),
    ...(laterPeriodAdjustmentIdempotencyRecords
      ? {
          laterPeriodAdjustmentIdempotencyRecords: laterPeriodAdjustmentIdempotencyRecords.map(
            cloneLaterPeriodAdjustmentIdempotencyRecord
          )
        }
      : {}),
    periodCloseRows: cloneDatabaseRows(periodCloseRows),
    sourceRecords: sourceRecords.map((record) => ({ ...record })),
    ...(voucherRows ? { voucherRows: voucherRows.map((row) => ({ ...row })) } : {})
  };
}

function cloneAccountingVoucher(record: AccountingVoucherPersistedRecord): AccountingVoucherPersistedRecord {
  return {
    ...record,
    lines: record.lines.map((line) => ({ ...line }))
  };
}

function cloneLaterPeriodAdjustmentFact(
  record: AccountingVoucherLaterPeriodAdjustmentFact
): AccountingVoucherLaterPeriodAdjustmentFact {
  return {
    ...record,
    actorSnapshot: { ...record.actorSnapshot }
  };
}

function cloneLaterPeriodAdjustmentEvent(
  event: AccountingVoucherLaterPeriodAdjustmentEvent
): AccountingVoucherLaterPeriodAdjustmentEvent {
  return {
    ...event,
    actorSnapshot: { ...event.actorSnapshot }
  };
}

function cloneLaterPeriodAdjustmentIdempotencyRecord(
  record: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord
): AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord {
  return {
    ...record,
    response: {
      ...record.response,
      adjustmentFact: cloneLaterPeriodAdjustmentFact(record.response.adjustmentFact),
      adjustmentFacts: record.response.adjustmentFacts.map(cloneLaterPeriodAdjustmentFact),
      candidate: {
        ...record.response.candidate,
        lines: record.response.candidate.lines.map((line) => ({ ...line })),
        sourceRefs: record.response.candidate.sourceRefs.map((ref) => ({ ...ref }))
      },
      event: cloneLaterPeriodAdjustmentEvent(record.response.event),
      idempotencyRecords: [],
      originalVoucher: cloneAccountingVoucher(record.response.originalVoucher)
    }
  };
}

function cloneFinancialStatementSnapshotsFromRows(rows: PeriodCloseDatabaseRows): FinancialStatementSnapshot[] {
  return hydrateFinancialStatementSnapshotsFromDatabaseRows(rows).map((snapshot) => ({
    ...snapshot,
    balanceSheetLines: snapshot.balanceSheetLines.map((line) => ({
      ...line,
      sourceSubjectCodes: [...line.sourceSubjectCodes],
      voucherNos: [...line.voucherNos]
    })),
    cashFlowLines: snapshot.cashFlowLines.map((line) => ({
      ...line,
      sourceSubjectCodes: [...line.sourceSubjectCodes],
      voucherNos: [...line.voucherNos]
    })),
    generalLedgerLines: snapshot.generalLedgerLines.map((line) => ({
      ...line,
      voucherNos: [...line.voucherNos]
    })),
    generatedBySnapshot: { ...snapshot.generatedBySnapshot },
    profitStatementLines: snapshot.profitStatementLines.map((line) => ({
      ...line,
      sourceSubjectCodes: [...line.sourceSubjectCodes],
      voucherNos: [...line.voucherNos]
    }))
  }));
}

function toActorSnapshot(value: unknown): ActorSnapshot | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const maybeActor = value as { id?: unknown; name?: unknown };

  if (typeof maybeActor.id !== 'string' || typeof maybeActor.name !== 'string') {
    return undefined;
  }

  return {
    id: maybeActor.id,
    name: maybeActor.name
  };
}

function toAffectedPeriods(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function mapPeriodRow(row: AccountingPeriodDbRow): PersistentAccountingPeriodRecord {
  return {
    closeCheckSnapshotHash: row.close_check_snapshot_hash,
    closeCheckSnapshotId: row.close_check_snapshot_id,
    closeReason: row.close_reason,
    closedAt: row.closed_at,
    closedBySnapshot: toActorSnapshot(row.closed_by_snapshot),
    period: row.period,
    reopenImpactSnapshot: row.reopen_impact_snapshot as PersistentAccountingPeriodRecord['reopenImpactSnapshot'],
    reopenReason: row.reopen_reason,
    reopenRiskConfirmationSnapshot:
      row.reopen_risk_confirmation_snapshot as PersistentAccountingPeriodRecord['reopenRiskConfirmationSnapshot'],
    reopenedAt: row.reopened_at,
    reopenedBySnapshot: toActorSnapshot(row.reopened_by_snapshot),
    status: row.status,
    version: row.version
  };
}

function mapSourceRef(row: AccountingPeriodCloseCheckItemDbRow): CloseCheckSourceRef | undefined {
  if (!row.source_id || !row.source_module || !row.source_no || !row.source_status || !row.reason_code) {
    return undefined;
  }

  return {
    accountingPeriod: row.period,
    nextAction: row.next_action ?? row.group_label,
    reason: row.reason,
    reasonCode: row.reason_code,
    sourceId: row.source_id,
    sourceModule: row.source_module,
    sourceNo: row.source_no,
    sourceStatus: row.source_status
  };
}

function deriveCheckStatus(rows: AccountingPeriodCloseCheckItemDbRow[]): CloseCheckStatus {
  if (rows.some((row) => row.status === '阻断')) {
    return '阻断';
  }

  if (rows.some((row) => row.status === '提示')) {
    return '提示';
  }

  if (rows.every((row) => row.status === '不适用')) {
    return '不适用';
  }

  return '通过';
}

function mapCheckRows({
  checkId,
  rows
}: {
  checkId: string;
  rows: AccountingPeriodCloseCheckItemDbRow[];
}): CloseCheckRow[] {
  const rowsByCode = new Map<string, AccountingPeriodCloseCheckItemDbRow[]>();

  for (const row of rows.filter((item) => item.close_check_id === checkId)) {
    const groupRows = rowsByCode.get(row.group_code) ?? [];
    groupRows.push(row);
    rowsByCode.set(row.group_code, groupRows);
  }

  return [...rowsByCode.entries()].map(([code, groupRows]) => {
    const firstRow = groupRows[0];
    const sources = groupRows.map(mapSourceRef).filter((source): source is CloseCheckSourceRef => Boolean(source));
    const blockerCount = groupRows.reduce((sum, row) => sum + row.blocker_count, 0);
    const status = deriveCheckStatus(groupRows);

    return {
      blockerCount,
      canPass: groupRows.every((row) => row.can_pass),
      code: code as CloseCheckRow['code'],
      label: firstRow?.group_label ?? code,
      nextModule: firstRow?.next_action,
      sources,
      status,
      summary: firstRow?.reason ?? '通过'
    };
  });
}

function mapTrialBalance(row: {
  trial_balance_difference: string;
  trial_balance_status: TrialBalanceSnapshot['status'];
  trial_credit_total: string;
  trial_debit_total: string;
}): TrialBalanceSnapshot {
  return {
    creditTotal: row.trial_credit_total,
    debitTotal: row.trial_debit_total,
    difference: row.trial_balance_difference,
    status: row.trial_balance_status
  };
}

function mapCloseSnapshot(
  row: PeriodCloseDatabaseRows['accounting_period_close_checks'][number],
  itemRows: AccountingPeriodCloseCheckItemDbRow[]
): PersistedPeriodCloseCheckSnapshot {
  return {
    canClose: row.can_close,
    checkSnapshotHash: row.check_snapshot_hash,
    checks: mapCheckRows({ checkId: row.id, rows: itemRows }),
    computedAt: row.computed_at,
    createdAt: row.computed_at,
    id: row.id,
    persistedForClose: row.persisted_for_close,
    period: row.period,
    requestId: row.request_id ?? 'unknown-request',
    runType: row.run_type,
    sourceVersionSetHash: row.source_version_set_hash,
    status: row.status,
    trialBalance: mapTrialBalance(row)
  };
}

function mapEventRow(
  row: AccountingPeriodEventDbRow,
  closeChecks: PeriodCloseDatabaseRows['accounting_period_close_checks']
): AccountingPeriodEvent {
  const closeSnapshot = row.close_check_id
    ? closeChecks.find((snapshot) => snapshot.id === row.close_check_id)
    : undefined;

  return {
    actorSnapshot: toActorSnapshot(row.actor_snapshot),
    afterStatus: row.after_status,
    beforeStatus: row.before_status,
    closeCheckSnapshotHash: closeSnapshot?.check_snapshot_hash,
    eventType: row.event_type,
    idempotencyKey: row.idempotency_key,
    period: row.period,
    reason: row.reason,
    reopenImpactSnapshot: row.reopen_impact_snapshot as AccountingPeriodEvent['reopenImpactSnapshot'],
    reopenRiskConfirmationSnapshot: row.reopen_risk_confirmation_snapshot as AccountingPeriodEvent['reopenRiskConfirmationSnapshot'],
    requestId: row.request_id,
    timestamp: row.created_at
  };
}

function mapIdempotencyRow(row: AccountingPeriodIdempotencyDbRow): AccountingPeriodIdempotencyRecord {
  return {
    idempotencyKey: row.idempotency_key,
    operation: row.operation,
    period: row.period,
    requestSignature: row.request_signature,
    response: cloneJsonValue(row.response_snapshot)
  } as AccountingPeriodIdempotencyRecord;
}

function mapSourceMutationEventRow(row: AccountingPeriodSourceMutationEventDbRow): PersistentFinanceSourceMutationEvent {
  return {
    actorSnapshot: toActorSnapshot(row.actor_snapshot) ?? { id: row.actor_id, name: row.actor_id },
    affectedAccountingPeriods: toAffectedPeriods(row.affected_accounting_periods),
    eventType: row.event_type,
    operation: row.operation,
    requestId: row.request_id,
    sourceArea: row.source_area as PersistentFinanceSourceMutationEvent['sourceArea'],
    sourceId: row.source_id,
    timestamp: row.created_at
  };
}

export function hydratePeriodCloseStateFromDatabaseSnapshot({
  accountingVouchers,
  checkInputs,
  laterPeriodAdjustmentEvents,
  laterPeriodAdjustmentFacts,
  laterPeriodAdjustmentIdempotencyRecords,
  periodCloseRows,
  sourceRecords,
  voucherRows
}: PeriodCloseDatabaseRepositorySnapshot): PeriodClosePersistentState {
  return {
    ...(accountingVouchers ? { accountingVouchers: accountingVouchers.map(cloneAccountingVoucher) } : {}),
    checkInputs: Object.fromEntries(
      Object.entries(checkInputs).map(([period, input]) => [period, cloneCheckInput(input)])
    ),
    closeCheckSnapshots: periodCloseRows.accounting_period_close_checks.map((row) =>
      mapCloseSnapshot(row, periodCloseRows.accounting_period_close_check_items)
    ),
    idempotencyRecords: periodCloseRows.accounting_period_idempotency_records.map(mapIdempotencyRow),
    ...(laterPeriodAdjustmentEvents
      ? { laterPeriodAdjustmentEvents: laterPeriodAdjustmentEvents.map(cloneLaterPeriodAdjustmentEvent) }
      : {}),
    ...(laterPeriodAdjustmentFacts
      ? { laterPeriodAdjustmentFacts: laterPeriodAdjustmentFacts.map(cloneLaterPeriodAdjustmentFact) }
      : {}),
    ...(laterPeriodAdjustmentIdempotencyRecords
      ? {
          laterPeriodAdjustmentIdempotencyRecords: laterPeriodAdjustmentIdempotencyRecords.map(
            cloneLaterPeriodAdjustmentIdempotencyRecord
          )
        }
      : {}),
    periodEvents: periodCloseRows.accounting_period_events.map((row) =>
      mapEventRow(row, periodCloseRows.accounting_period_close_checks)
    ),
    periods: periodCloseRows.accounting_periods.map(mapPeriodRow),
    sourceMutationEvents: periodCloseRows.accounting_period_source_mutation_events.map(mapSourceMutationEventRow),
    sourceRecords: sourceRecords.map((record) => ({ ...record })),
    ...(voucherRows ? { voucherRows: voucherRows.map((row) => ({ ...row })) } : {})
  };
}

function createDatabaseSnapshotFromState({
  fallbackNow,
  financialStatementSnapshots,
  state
}: {
  fallbackNow: string;
  financialStatementSnapshots?: readonly FinancialStatementSnapshot[];
  state: PeriodClosePersistentState;
}): PeriodCloseDatabaseRepositorySnapshot {
  return {
    ...(state.accountingVouchers ? { accountingVouchers: state.accountingVouchers.map(cloneAccountingVoucher) } : {}),
    checkInputs: Object.fromEntries(
      Object.entries(state.checkInputs).map(([period, input]) => [period, cloneCheckInput(input)])
    ),
    ...(state.laterPeriodAdjustmentEvents
      ? { laterPeriodAdjustmentEvents: state.laterPeriodAdjustmentEvents.map(cloneLaterPeriodAdjustmentEvent) }
      : {}),
    ...(state.laterPeriodAdjustmentFacts
      ? { laterPeriodAdjustmentFacts: state.laterPeriodAdjustmentFacts.map(cloneLaterPeriodAdjustmentFact) }
      : {}),
    ...(state.laterPeriodAdjustmentIdempotencyRecords
      ? {
          laterPeriodAdjustmentIdempotencyRecords: state.laterPeriodAdjustmentIdempotencyRecords.map(
            cloneLaterPeriodAdjustmentIdempotencyRecord
          )
        }
      : {}),
    periodCloseRows: mapPeriodCloseStateToDatabaseRows({ fallbackNow, financialStatementSnapshots, state }),
    sourceRecords: state.sourceRecords.map((record) => ({ ...record })),
    ...(state.voucherRows ? { voucherRows: state.voucherRows.map((row) => ({ ...row })) } : {})
  };
}

function createAdjustmentVoucherRow(
  result: AccountingVoucherLaterPeriodAdjustmentSuccess
): AccountingPeriodVoucherCountSourceRow {
  return {
    accountingPeriod: result.candidate.accountingPeriod,
    id: result.candidate.id,
    sourceModule: '会计凭证',
    sourceNo: result.candidate.sourceNo,
    status: '待制单'
  };
}

function mergeVoucherRows(
  rows: readonly AccountingPeriodVoucherCountSourceRow[],
  nextRow: AccountingPeriodVoucherCountSourceRow
): AccountingPeriodVoucherCountSourceRow[] {
  return [nextRow, ...rows.filter((row) => row.id !== nextRow.id)].map((row) => ({ ...row }));
}

export function createRowBackedPeriodCloseRepository({
  fallbackNow,
  initialState
}: {
  fallbackNow: string;
  initialState: PeriodClosePersistentState;
}): PeriodCloseDatabaseRepository {
  let committedSnapshot = createDatabaseSnapshotFromState({ fallbackNow, state: initialState });

  return {
    commitAccountingVoucherLaterPeriodAdjustment: (result) => {
      const currentState = hydratePeriodCloseStateFromDatabaseSnapshot(cloneSnapshot(committedSnapshot));
      const currentEvents = currentState.laterPeriodAdjustmentEvents ?? [];
      const nextEventExists = currentEvents.some(
        (event) => event.requestId === result.event.requestId && event.eventType === result.event.eventType
      );
      const nextState: PeriodClosePersistentState = {
        ...currentState,
        laterPeriodAdjustmentEvents: nextEventExists ? currentEvents : [result.event, ...currentEvents],
        laterPeriodAdjustmentFacts: result.adjustmentFacts,
        laterPeriodAdjustmentIdempotencyRecords: result.idempotencyRecords,
        voucherRows: mergeVoucherRows(currentState.voucherRows ?? [], createAdjustmentVoucherRow(result))
      };
      const nextSnapshot = createDatabaseSnapshotFromState({
        fallbackNow,
        financialStatementSnapshots: cloneFinancialStatementSnapshotsFromRows(committedSnapshot.periodCloseRows),
        state: nextState
      });
      const validationErrors = validatePeriodCloseDatabaseRows(nextSnapshot.periodCloseRows);

      if (validationErrors.length > 0) {
        throw new Error(`Later-period adjustment database row contract failed: ${validationErrors.join('; ')}`);
      }

      committedSnapshot = nextSnapshot;

      return cloneSnapshot(committedSnapshot);
    },
    commitFinancialStatementSnapshot: (snapshot) => {
      const currentState = hydratePeriodCloseStateFromDatabaseSnapshot(cloneSnapshot(committedSnapshot));
      const currentSnapshots = cloneFinancialStatementSnapshotsFromRows(committedSnapshot.periodCloseRows);
      const existingSnapshot = currentSnapshots.find(
        (item) => item.accountingPeriod === snapshot.accountingPeriod && item.snapshotHash === snapshot.snapshotHash
      );
      const nextFinancialStatementSnapshots = existingSnapshot ? currentSnapshots : [...currentSnapshots, snapshot];
      const nextSnapshot = createDatabaseSnapshotFromState({
        fallbackNow,
        financialStatementSnapshots: nextFinancialStatementSnapshots,
        state: currentState
      });
      const validationErrors = validatePeriodCloseDatabaseRows(nextSnapshot.periodCloseRows);

      if (validationErrors.length > 0) {
        throw new Error(`Financial statement database row contract failed: ${validationErrors.join('; ')}`);
      }

      committedSnapshot = nextSnapshot;

      return cloneSnapshot(committedSnapshot);
    },
    readDatabaseSnapshot: () => cloneSnapshot(committedSnapshot),
    readFinancialStatementSnapshots: () => cloneFinancialStatementSnapshotsFromRows(committedSnapshot.periodCloseRows),
    readState: () => hydratePeriodCloseStateFromDatabaseSnapshot(cloneSnapshot(committedSnapshot)),
    runInTransaction: <T extends PeriodCloseRepositoryTransactionResult>(
      transaction: PeriodCloseRepositoryTransaction<T>
    ): T => {
      const transactionState = hydratePeriodCloseStateFromDatabaseSnapshot(cloneSnapshot(committedSnapshot));
      const result = transaction(transactionState);
      const validationErrors = validatePeriodCloseDatabaseRows(
        mapPeriodCloseStateToDatabaseRows({
          fallbackNow,
          state: result.state
        })
      );

      if (validationErrors.length > 0) {
        throw new Error(`Period close database row contract failed: ${validationErrors.join('; ')}`);
      }

      committedSnapshot = createDatabaseSnapshotFromState({
        fallbackNow,
        state: result.state
      });

      return {
        ...result,
        state: hydratePeriodCloseStateFromDatabaseSnapshot(cloneSnapshot(committedSnapshot))
      };
    }
  };
}
