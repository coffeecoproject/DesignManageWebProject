import {
  buildCloseChecksResponse,
  closeAccountingPeriod,
  type AccountingPeriodEvent,
  type AccountingPeriodIdempotencyRecord,
  type AccountingPeriodRecord,
  type ActorSnapshot,
  type ApiErrorResponse,
  type CloseAccountingPeriodRequest,
  type CloseCheckRow,
  type ReopenAccountingPeriodExternalSubmission,
  type ReopenAccountingPeriodImpactSnapshot,
  type ReopenAccountingPeriodRiskConfirmation,
  type TrialBalanceSnapshot
} from './periodCloseContract.js';
import {
  guardFinanceSourceMutation,
  type FinanceSourceMutationArea
} from './periodCloseSourceMutationGuard.js';
import type {
  AccountingVoucherLaterPeriodAdjustmentEvent,
  AccountingVoucherLaterPeriodAdjustmentFact,
  AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord,
  AccountingVoucherPersistedRecord
} from './accountingVoucherLaterPeriodAdjustmentContract.js';
import type { AccountingPeriodVoucherCountSourceRow } from './periodCloseVoucherSummaryContract.js';

export type PersistentAccountingPeriodRecord = AccountingPeriodRecord & {
  closeCheckSnapshotId?: string;
};

export type PeriodCloseCheckInput = {
  checks: CloseCheckRow[];
  computedAt: string;
  sourceVersionSetHash: string;
  trialBalance: TrialBalanceSnapshot;
};

export type PersistedPeriodCloseCheckSnapshot = {
  canClose: boolean;
  checkSnapshotHash: string;
  checks: CloseCheckRow[];
  computedAt: string;
  createdAt: string;
  id: string;
  persistedForClose: boolean;
  period: string;
  requestId: string;
  runType: 'close_attempt' | 'close_snapshot';
  sourceVersionSetHash: string;
  status: '未运行' | '通过' | '阻断';
  trialBalance: TrialBalanceSnapshot;
};

export type PersistentFinanceSourceRecord = {
  accountingPeriod?: string;
  amount: string;
  id: string;
  sourceArea: FinanceSourceMutationArea;
  sourceNo: string;
  status: string;
  version: number;
};

export type PersistentFinanceSourceMutationEvent = {
  actorSnapshot: ActorSnapshot;
  affectedAccountingPeriods: string[];
  eventType: 'source_mutation_applied' | 'source_mutation_rejected';
  operation: string;
  requestId: string;
  sourceArea: FinanceSourceMutationArea;
  sourceId: string;
  timestamp: string;
};

export type PeriodClosePersistentState = {
  accountingVouchers?: AccountingVoucherPersistedRecord[];
  checkInputs: Record<string, PeriodCloseCheckInput>;
  closeCheckSnapshots: PersistedPeriodCloseCheckSnapshot[];
  idempotencyRecords: AccountingPeriodIdempotencyRecord[];
  laterPeriodAdjustmentEvents?: AccountingVoucherLaterPeriodAdjustmentEvent[];
  laterPeriodAdjustmentFacts?: AccountingVoucherLaterPeriodAdjustmentFact[];
  laterPeriodAdjustmentIdempotencyRecords?: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[];
  periodEvents: AccountingPeriodEvent[];
  periods: PersistentAccountingPeriodRecord[];
  sourceMutationEvents: PersistentFinanceSourceMutationEvent[];
  sourceRecords: PersistentFinanceSourceRecord[];
  voucherRows?: AccountingPeriodVoucherCountSourceRow[];
};

export type PeriodClosePersistenceContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  requestId: string;
};

export type PeriodClosePersistenceErrorCode =
  | ApiErrorResponse['code']
  | 'CLOSE_CHECK_NOT_FOUND'
  | 'PERIOD_NOT_FOUND'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_VERSION_CONFLICT';

export type PeriodClosePersistenceError = Omit<ApiErrorResponse, 'code'> & {
  code: PeriodClosePersistenceErrorCode;
};

export type PersistentCloseAccountingPeriodResult =
  | {
      event: AccountingPeriodEvent;
      ok: true;
      period: PersistentAccountingPeriodRecord;
      replayed: boolean;
      snapshot: PersistedPeriodCloseCheckSnapshot;
      state: PeriodClosePersistentState;
    }
  | {
      error: PeriodClosePersistenceError;
      event?: AccountingPeriodEvent;
      ok: false;
      state: PeriodClosePersistentState;
    };

export type PersistentSourceMutationRequest = {
  amount?: string;
  createsSourceRecord?: boolean;
  expectedVersion?: number;
  operation: string;
  sourceArea: FinanceSourceMutationArea;
  sourceId: string;
  sourceNo?: string;
  status?: string;
  targetAccountingPeriod?: string;
};

export type PersistentSourceMutationResult =
  | {
      event: PersistentFinanceSourceMutationEvent;
      ok: true;
      record: PersistentFinanceSourceRecord;
      state: PeriodClosePersistentState;
    }
  | {
      error: PeriodClosePersistenceError;
      event?: PersistentFinanceSourceMutationEvent;
      ok: false;
      state: PeriodClosePersistentState;
    };

function cloneActorSnapshot(actor: ActorSnapshot): ActorSnapshot {
  return {
    ...actor
  };
}

function cloneReopenExternalSubmission(
  submission: ReopenAccountingPeriodExternalSubmission
): ReopenAccountingPeriodExternalSubmission {
  return { ...submission };
}

function cloneReopenImpactSnapshot(
  snapshot: ReopenAccountingPeriodImpactSnapshot
): ReopenAccountingPeriodImpactSnapshot {
  return {
    irreversibleExternalSubmissions: snapshot.irreversibleExternalSubmissions.map(cloneReopenExternalSubmission),
    laterClosedPeriods: [...snapshot.laterClosedPeriods]
  };
}

function cloneReopenRiskConfirmation(
  riskConfirmation: ReopenAccountingPeriodRiskConfirmation
): ReopenAccountingPeriodRiskConfirmation {
  return { ...riskConfirmation };
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
    actorSnapshot: cloneActorSnapshot(record.actorSnapshot)
  };
}

function cloneLaterPeriodAdjustmentEvent(
  event: AccountingVoucherLaterPeriodAdjustmentEvent
): AccountingVoucherLaterPeriodAdjustmentEvent {
  return {
    ...event,
    actorSnapshot: cloneActorSnapshot(event.actorSnapshot)
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

function cloneVoucherRow(row: AccountingPeriodVoucherCountSourceRow): AccountingPeriodVoucherCountSourceRow {
  return { ...row };
}

function cloneCheckRow(check: CloseCheckRow): CloseCheckRow {
  return {
    ...check,
    sources: check.sources.map((source) => ({ ...source }))
  };
}

function cloneTrialBalance(trialBalance: TrialBalanceSnapshot): TrialBalanceSnapshot {
  return {
    ...trialBalance
  };
}

function clonePeriod(period: PersistentAccountingPeriodRecord): PersistentAccountingPeriodRecord {
  return {
    ...period,
    closedBySnapshot: period.closedBySnapshot ? cloneActorSnapshot(period.closedBySnapshot) : undefined,
    reopenImpactSnapshot: period.reopenImpactSnapshot ? cloneReopenImpactSnapshot(period.reopenImpactSnapshot) : undefined,
    reopenRiskConfirmationSnapshot: period.reopenRiskConfirmationSnapshot
      ? cloneReopenRiskConfirmation(period.reopenRiskConfirmationSnapshot)
      : undefined,
    reopenedBySnapshot: period.reopenedBySnapshot ? cloneActorSnapshot(period.reopenedBySnapshot) : undefined
  };
}

function clonePeriodEvent(event: AccountingPeriodEvent): AccountingPeriodEvent {
  return {
    ...event,
    actorSnapshot: event.actorSnapshot ? cloneActorSnapshot(event.actorSnapshot) : undefined,
    reopenImpactSnapshot: event.reopenImpactSnapshot ? cloneReopenImpactSnapshot(event.reopenImpactSnapshot) : undefined,
    reopenRiskConfirmationSnapshot: event.reopenRiskConfirmationSnapshot
      ? cloneReopenRiskConfirmation(event.reopenRiskConfirmationSnapshot)
      : undefined
  };
}

function cloneCloseSnapshot(snapshot: PersistedPeriodCloseCheckSnapshot): PersistedPeriodCloseCheckSnapshot {
  return {
    ...snapshot,
    checks: snapshot.checks.map(cloneCheckRow),
    trialBalance: cloneTrialBalance(snapshot.trialBalance)
  };
}

function cloneSourceRecord(record: PersistentFinanceSourceRecord): PersistentFinanceSourceRecord {
  return {
    ...record
  };
}

function cloneSourceMutationEvent(event: PersistentFinanceSourceMutationEvent): PersistentFinanceSourceMutationEvent {
  return {
    ...event,
    actorSnapshot: cloneActorSnapshot(event.actorSnapshot),
    affectedAccountingPeriods: [...event.affectedAccountingPeriods]
  };
}

export function clonePeriodClosePersistentState(state: PeriodClosePersistentState): PeriodClosePersistentState {
  return {
    ...(state.accountingVouchers ? { accountingVouchers: state.accountingVouchers.map(cloneAccountingVoucher) } : {}),
    checkInputs: Object.fromEntries(
      Object.entries(state.checkInputs).map(([period, input]) => [
        period,
        {
          checks: input.checks.map(cloneCheckRow),
          computedAt: input.computedAt,
          sourceVersionSetHash: input.sourceVersionSetHash,
          trialBalance: cloneTrialBalance(input.trialBalance)
        }
      ])
    ),
    closeCheckSnapshots: state.closeCheckSnapshots.map(cloneCloseSnapshot),
    idempotencyRecords: [...state.idempotencyRecords],
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
    periodEvents: state.periodEvents.map(clonePeriodEvent),
    periods: state.periods.map(clonePeriod),
    sourceMutationEvents: state.sourceMutationEvents.map(cloneSourceMutationEvent),
    sourceRecords: state.sourceRecords.map(cloneSourceRecord),
    ...(state.voucherRows ? { voucherRows: state.voucherRows.map(cloneVoucherRow) } : {})
  };
}

function createPersistenceError({
  code,
  message,
  period,
  requestId,
  sourceId,
  sourceModule
}: {
  code: PeriodClosePersistenceErrorCode;
  message: string;
  period?: string;
  requestId: string;
  sourceId?: string;
  sourceModule?: string;
}): PeriodClosePersistenceError {
  return {
    code,
    message,
    period,
    requestId,
    sourceId,
    sourceModule
  };
}

function createCloseSnapshotId(period: string, hash: string, existingSnapshots: PersistedPeriodCloseCheckSnapshot[]) {
  const sequence = existingSnapshots.filter((snapshot) => snapshot.period === period).length + 1;

  return `period-close-${period}-${hash}-${String(sequence).padStart(3, '0')}`;
}

function buildPersistedCloseSnapshot({
  checks,
  now,
  requestId,
  snapshots
}: {
  checks: ReturnType<typeof buildCloseChecksResponse>;
  now: string;
  requestId: string;
  snapshots: PersistedPeriodCloseCheckSnapshot[];
}): PersistedPeriodCloseCheckSnapshot {
  return {
    canClose: checks.canClose,
    checkSnapshotHash: checks.checkSnapshotHash,
    checks: checks.checks.map(cloneCheckRow),
    computedAt: checks.computedAt,
    createdAt: now,
    id: createCloseSnapshotId(checks.period, checks.checkSnapshotHash, snapshots),
    persistedForClose: checks.canClose,
    period: checks.period,
    requestId,
    runType: checks.canClose ? 'close_snapshot' : 'close_attempt',
    sourceVersionSetHash: checks.sourceVersionSetHash,
    status: checks.canClose ? '通过' : '阻断',
    trialBalance: cloneTrialBalance(checks.trialBalance)
  };
}

function getCloseChecksFromTransactionState(
  state: PeriodClosePersistentState,
  period: PersistentAccountingPeriodRecord
) {
  const input = state.checkInputs[period.period];

  if (!input) {
    return undefined;
  }

  const checks = buildEffectiveVoucherCloseChecks({
    checks: input.checks,
    period,
    voucherRows: state.voucherRows ?? []
  });

  return buildCloseChecksResponse({
    checks,
    computedAt: input.computedAt,
    period,
    sourceVersionSetHash: input.sourceVersionSetHash,
    trialBalance: input.trialBalance
  });
}

export function buildEffectiveVoucherCloseChecks({
  checks,
  period,
  voucherRows
}: {
  checks: CloseCheckRow[];
  period: PersistentAccountingPeriodRecord;
  voucherRows: AccountingPeriodVoucherCountSourceRow[];
}) {
  if (voucherRows.length === 0) {
    return checks;
  }

  const pendingRows = voucherRows.filter((row) => row.accountingPeriod === period.period && row.status === '待制单');
  const unbookedRows = voucherRows.filter((row) => row.accountingPeriod === period.period && row.status === '已制单');
  const replacementByCode = new Map<CloseCheckRow['code'], CloseCheckRow>();

  if (pendingRows.length > 0) {
    const baseCheck = checks.find((check) => check.code === 'voucher_preparation');
    replacementByCode.set('voucher_preparation', {
      blockerCount: pendingRows.length,
      canPass: false,
      code: 'voucher_preparation',
      label: baseCheck?.label ?? '凭证准备',
      nextModule: baseCheck?.nextModule ?? '会计凭证',
      sources: pendingRows.map((row) => ({
        accountingPeriod: period.period,
        nextAction: '完成调整凭证制单后重新运行结账检查',
        reason: '后续期间调整候选尚未制单。',
        reasonCode: 'pending_later_period_adjustment_voucher',
        sourceId: row.id,
        sourceModule: row.sourceModule ?? '会计凭证',
        sourceNo: row.sourceNo ?? row.id,
        sourceStatus: row.status
      })),
      status: '阻断',
      summary: `还有 ${pendingRows.length} 条后续期间调整候选未制单。`
    });
  }

  if (unbookedRows.length > 0) {
    const baseCheck = checks.find((check) => check.code === 'voucher_booking');
    replacementByCode.set('voucher_booking', {
      blockerCount: unbookedRows.length,
      canPass: false,
      code: 'voucher_booking',
      label: baseCheck?.label ?? '凭证记账',
      nextModule: baseCheck?.nextModule ?? '会计凭证',
      sources: unbookedRows.map((row) => ({
        accountingPeriod: period.period,
        nextAction: '完成凭证记账后重新运行结账检查',
        reason: '凭证已制单但尚未记账。',
        reasonCode: 'unbooked_voucher',
        sourceId: row.id,
        sourceModule: row.sourceModule ?? '会计凭证',
        sourceNo: row.sourceNo ?? row.id,
        sourceStatus: row.status
      })),
      status: '阻断',
      summary: `还有 ${unbookedRows.length} 张已制单凭证未记账。`
    });
  }

  return checks.map((check) => replacementByCode.get(check.code) ?? check);
}

export function closeAccountingPeriodInPersistenceTransaction({
  period,
  request,
  state
}: {
  period: string;
  request: CloseAccountingPeriodRequest;
  state: PeriodClosePersistentState;
}): PersistentCloseAccountingPeriodResult {
  const transactionState = clonePeriodClosePersistentState(state);

  return createCloseAccountingPeriodTransaction({
    period: transactionState.periods.find((item) => item.period === period),
    request,
    state: transactionState
  });
}

function createCloseAccountingPeriodTransaction({
  period,
  request,
  state
}: {
  period?: PersistentAccountingPeriodRecord;
  request: CloseAccountingPeriodRequest;
  state: PeriodClosePersistentState;
}): PersistentCloseAccountingPeriodResult {
  if (!period) {
    return {
      error: createPersistenceError({
        code: 'PERIOD_NOT_FOUND',
        message: '会计期间不存在。',
        requestId: request.requestId
      }),
      ok: false,
      state
    };
  }

  const checks = getCloseChecksFromTransactionState(state, period);

  if (!checks) {
    return {
      error: createPersistenceError({
        code: 'CLOSE_CHECK_NOT_FOUND',
        message: '结账检查尚未生成。',
        period: period.period,
        requestId: request.requestId
      }),
      ok: false,
      state
    };
  }

  const result = closeAccountingPeriod({
    checks,
    idempotencyRecords: state.idempotencyRecords,
    period,
    request
  });

  if (!result.ok) {
    return {
      error: result.error,
      event: result.event,
      ok: false,
      state: {
        ...state,
        periodEvents: result.event ? [...state.periodEvents, result.event] : state.periodEvents
      }
    };
  }

  if (result.replayed) {
    const existingPeriod = state.periods.find((item) => item.period === period.period) ?? period;
    const existingSnapshot = state.closeCheckSnapshots.find(
      (snapshot) =>
        snapshot.period === period.period &&
        snapshot.checkSnapshotHash === existingPeriod.closeCheckSnapshotHash &&
        snapshot.persistedForClose
    );

    return {
      event: result.event,
      ok: true,
      period: existingPeriod,
      replayed: true,
      snapshot: existingSnapshot ?? buildPersistedCloseSnapshot({
        checks,
        now: request.now,
        requestId: request.requestId,
        snapshots: state.closeCheckSnapshots
      }),
      state
    };
  }

  const snapshot = buildPersistedCloseSnapshot({
    checks,
    now: request.now,
    requestId: request.requestId,
    snapshots: state.closeCheckSnapshots
  });
  const nextPeriod: PersistentAccountingPeriodRecord = {
    ...result.period,
    closeCheckSnapshotId: snapshot.id
  };

  return {
    event: result.event,
    ok: true,
    period: nextPeriod,
    replayed: false,
    snapshot,
    state: {
      ...state,
      closeCheckSnapshots: [...state.closeCheckSnapshots, snapshot],
      idempotencyRecords: result.idempotencyRecords,
      periodEvents: [...state.periodEvents, result.event],
      periods: state.periods.map((item) => (item.period === period.period ? nextPeriod : item))
    }
  };
}

export function applyFinanceSourceMutationInPersistenceTransaction({
  context,
  mutation,
  state
}: {
  context: PeriodClosePersistenceContext;
  mutation: PersistentSourceMutationRequest;
  state: PeriodClosePersistentState;
}): PersistentSourceMutationResult {
  const transactionState = clonePeriodClosePersistentState(state);
  const sourceRecord = transactionState.sourceRecords.find(
    (record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea
  );

  if (!sourceRecord && mutation.createsSourceRecord) {
    const sourceNo = mutation.sourceNo?.trim() || mutation.sourceId;
    const accountingPeriod = mutation.targetAccountingPeriod?.trim();
    const candidateRecord: PersistentFinanceSourceRecord = {
      accountingPeriod,
      amount: mutation.amount ?? '0.00',
      id: mutation.sourceId,
      sourceArea: mutation.sourceArea,
      sourceNo,
      status: mutation.status ?? '已生成',
      version: 1
    };
    const guard = guardFinanceSourceMutation({
      periods: transactionState.periods,
      request: {
        accountingPeriods: [accountingPeriod],
        operation: mutation.operation,
        requestId: context.requestId,
        sourceArea: mutation.sourceArea,
        sourceId: candidateRecord.id,
        sourceNo: candidateRecord.sourceNo
      }
    });

    if (!guard.allowed) {
      const event = createSourceMutationEvent({
        affectedAccountingPeriods: guard.checkedAccountingPeriods,
        context,
        eventType: 'source_mutation_rejected',
        mutation,
        sourceRecord: candidateRecord
      });

      return {
        error: guard.error,
        ...(guard.checkedAccountingPeriods.length > 0 ? { event } : {}),
        ok: false,
        state:
          guard.checkedAccountingPeriods.length > 0
            ? {
                ...transactionState,
                sourceMutationEvents: [...transactionState.sourceMutationEvents, event]
              }
            : transactionState
      };
    }

    const event = createSourceMutationEvent({
      affectedAccountingPeriods: guard.checkedAccountingPeriods,
      context,
      eventType: 'source_mutation_applied',
      mutation,
      sourceRecord: candidateRecord
    });

    return {
      event,
      ok: true,
      record: candidateRecord,
      state: {
        ...transactionState,
        sourceMutationEvents: [...transactionState.sourceMutationEvents, event],
        sourceRecords: [candidateRecord, ...transactionState.sourceRecords]
      }
    };
  }

  if (sourceRecord && mutation.createsSourceRecord) {
    return {
      error: createPersistenceError({
        code: 'SOURCE_VERSION_CONFLICT',
        message: '源单已存在，不能重复新增。',
        requestId: context.requestId,
        sourceId: mutation.sourceId
      }),
      ok: false,
      state: transactionState
    };
  }

  if (!sourceRecord) {
    return {
      error: createPersistenceError({
        code: 'SOURCE_NOT_FOUND',
        message: '源单不存在。',
        requestId: context.requestId,
        sourceId: mutation.sourceId
      }),
      ok: false,
      state: transactionState
    };
  }

  const guard = guardFinanceSourceMutation({
    periods: transactionState.periods,
    request: {
      accountingPeriods: [sourceRecord.accountingPeriod, mutation.targetAccountingPeriod],
      operation: mutation.operation,
      requestId: context.requestId,
      sourceArea: mutation.sourceArea,
      sourceId: sourceRecord.id,
      sourceNo: sourceRecord.sourceNo
    }
  });

  if (!guard.allowed) {
    const event = createSourceMutationEvent({
      affectedAccountingPeriods: guard.checkedAccountingPeriods,
      context,
      eventType: 'source_mutation_rejected',
      mutation,
      sourceRecord
    });

    return {
      error: guard.error,
      event,
      ok: false,
      state: {
        ...transactionState,
        sourceMutationEvents: [...transactionState.sourceMutationEvents, event]
      }
    };
  }

  if (mutation.expectedVersion !== undefined && mutation.expectedVersion !== sourceRecord.version) {
    const event = createSourceMutationEvent({
      affectedAccountingPeriods: guard.checkedAccountingPeriods,
      context,
      eventType: 'source_mutation_rejected',
      mutation,
      sourceRecord
    });

    return {
      error: createPersistenceError({
        code: 'SOURCE_VERSION_CONFLICT',
        message: '源单版本已变化，请刷新后重试。',
        requestId: context.requestId,
        sourceId: sourceRecord.id,
        sourceModule: guard.sourceModule
      }),
      event,
      ok: false,
      state: {
        ...transactionState,
        sourceMutationEvents: [...transactionState.sourceMutationEvents, event]
      }
    };
  }

  const nextRecord: PersistentFinanceSourceRecord = {
    ...sourceRecord,
    accountingPeriod: mutation.targetAccountingPeriod?.trim() || sourceRecord.accountingPeriod,
    amount: mutation.amount ?? sourceRecord.amount,
    status: mutation.status ?? sourceRecord.status,
    version: sourceRecord.version + 1
  };
  const event = createSourceMutationEvent({
    affectedAccountingPeriods: guard.checkedAccountingPeriods,
    context,
    eventType: 'source_mutation_applied',
    mutation,
    sourceRecord
  });

  return {
    event,
    ok: true,
    record: nextRecord,
    state: {
      ...transactionState,
      sourceMutationEvents: [...transactionState.sourceMutationEvents, event],
      sourceRecords: transactionState.sourceRecords.map((record) =>
        record.id === sourceRecord.id && record.sourceArea === sourceRecord.sourceArea ? nextRecord : record
      )
    }
  };
}

function createSourceMutationEvent({
  affectedAccountingPeriods,
  context,
  eventType,
  mutation,
  sourceRecord
}: {
  affectedAccountingPeriods: string[];
  context: PeriodClosePersistenceContext;
  eventType: PersistentFinanceSourceMutationEvent['eventType'];
  mutation: PersistentSourceMutationRequest;
  sourceRecord: PersistentFinanceSourceRecord;
}): PersistentFinanceSourceMutationEvent {
  return {
    actorSnapshot: context.actorSnapshot,
    affectedAccountingPeriods,
    eventType,
    operation: mutation.operation,
    requestId: context.requestId,
    sourceArea: sourceRecord.sourceArea,
    sourceId: sourceRecord.id,
    timestamp: context.now
  };
}
