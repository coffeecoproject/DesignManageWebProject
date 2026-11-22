export const canonicalClosedAccountingPeriodErrorCode = 'CLOSED_ACCOUNTING_PERIOD';

export const requiredCloseCheckCodes = [
  'voucher_preparation',
  'voucher_booking',
  'general_ledger_trial_balance',
  'financial_statements',
  'cash_review',
  'cash_reconciliation',
  'tax_handling',
  'social_insurance_housing_fund'
] as const;

export type AccountingPeriodStatus = '开放' | '已结账' | '已反结账';
export type CloseCheckCode = (typeof requiredCloseCheckCodes)[number];
export type CloseCheckStatus = '通过' | '阻断' | '提示' | '不适用';
export type TrialBalanceStatus = '平衡' | '不平' | '未生成';

export type PeriodCloseErrorCode =
  | typeof canonicalClosedAccountingPeriodErrorCode
  | 'CHECK_SNAPSHOT_MISMATCH'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INVALID_CLOSE_REASON'
  | 'INVALID_REOPEN_REASON'
  | 'INVALID_REOPEN_RISK_CONFIRMATION'
  | 'PERIOD_ALREADY_CLOSED'
  | 'PERIOD_CLOSE_BLOCKED'
  | 'PERIOD_NOT_CLOSED'
  | 'PERIOD_REOPEN_BLOCKED'
  | 'PERIOD_VERSION_CONFLICT'
  | 'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED';

export type ApiErrorResponse = {
  code: PeriodCloseErrorCode;
  currentCheckSnapshotHash?: string;
  expectedCheckSnapshotHash?: string;
  message: string;
  nextAction?: '后续期间调整' | '反结账';
  period?: string;
  requestId: string;
  sourceId?: string;
  sourceModule?: string;
};

export type ActorSnapshot = {
  id: string;
  name: string;
};

export type AccountingPeriodRecord = {
  period: string;
  status: AccountingPeriodStatus;
  version: number;
  closeCheckSnapshotId?: string;
  closeCheckSnapshotHash?: string;
  closeReason?: string;
  closedAt?: string;
  closedBySnapshot?: ActorSnapshot;
  reopenReason?: string;
  reopenImpactSnapshot?: ReopenAccountingPeriodImpactSnapshot;
  reopenRiskConfirmationSnapshot?: ReopenAccountingPeriodRiskConfirmation;
  reopenedAt?: string;
  reopenedBySnapshot?: ActorSnapshot;
};

export type CloseCheckSourceRef = {
  accountingPeriod: string;
  nextAction: string;
  reason: string;
  reasonCode: string;
  sourceId: string;
  sourceModule: string;
  sourceNo: string;
  sourceStatus: string;
};

export type CloseCheckRow = {
  blockerCount: number;
  canPass: boolean;
  code: CloseCheckCode;
  label: string;
  nextModule?: string;
  sources: CloseCheckSourceRef[];
  status: CloseCheckStatus;
  summary: string;
};

export type TrialBalanceSnapshot = {
  creditTotal: string;
  debitTotal: string;
  difference: string;
  status: TrialBalanceStatus;
};

export type CloseChecksResponse = {
  canClose: boolean;
  checkSnapshotHash: string;
  checks: CloseCheckRow[];
  computedAt: string;
  period: string;
  periodStatus: AccountingPeriodStatus;
  sourceVersionSetHash: string;
  trialBalance: TrialBalanceSnapshot;
  version: number;
};

export type CloseAccountingPeriodRequest = {
  actorSnapshot: ActorSnapshot;
  expectedCheckSnapshotHash?: string;
  idempotencyKey: string;
  now: string;
  reason: string;
  requestId: string;
  version: number;
};

export type ReopenAccountingPeriodRequest = {
  actorSnapshot: ActorSnapshot;
  idempotencyKey: string;
  now: string;
  reason: string;
  requestId: string;
  riskConfirmation?: ReopenAccountingPeriodRiskConfirmation;
  version: number;
};

export type AccountingPeriodEvent = {
  actorSnapshot?: ActorSnapshot;
  afterStatus?: AccountingPeriodStatus;
  beforeStatus?: AccountingPeriodStatus;
  closeCheckSnapshotHash?: string;
  eventType: 'closed' | 'close_attempt_failed' | 'reopened' | 'reopen_attempt_failed';
  idempotencyKey?: string;
  reopenImpactSnapshot?: ReopenAccountingPeriodImpactSnapshot;
  reopenRiskConfirmationSnapshot?: ReopenAccountingPeriodRiskConfirmation;
  period: string;
  reason?: string;
  requestId: string;
  timestamp: string;
};

export type ReopenAccountingPeriodRiskConfirmation = {
  allowIrreversibleExternalSubmissions?: boolean;
  allowLaterClosedPeriods?: boolean;
  decisionNo: string;
  note: string;
};

export type ReopenAccountingPeriodExternalSubmission = {
  accountingPeriod: string;
  description: string;
  id: string;
  sourceModule: string;
  sourceNo: string;
  submittedAt: string;
};

export type ReopenAccountingPeriodImpactSnapshot = {
  irreversibleExternalSubmissions: ReopenAccountingPeriodExternalSubmission[];
  laterClosedPeriods: string[];
};

export type CloseIdempotencyRecord = {
  idempotencyKey: string;
  operation: 'close';
  period: string;
  requestSignature: string;
  response: CloseAccountingPeriodSuccess;
};

export type ReopenIdempotencyRecord = {
  idempotencyKey: string;
  operation: 'reopen';
  period: string;
  requestSignature: string;
  response: ReopenAccountingPeriodSuccess;
};

export type AccountingPeriodIdempotencyRecord = CloseIdempotencyRecord | ReopenIdempotencyRecord;

export type CloseAccountingPeriodSuccess = {
  event: AccountingPeriodEvent;
  idempotencyRecords: AccountingPeriodIdempotencyRecord[];
  ok: true;
  period: AccountingPeriodRecord;
  replayed: boolean;
};

export type CloseAccountingPeriodFailure = {
  error: ApiErrorResponse;
  event?: AccountingPeriodEvent;
  idempotencyRecords: AccountingPeriodIdempotencyRecord[];
  ok: false;
  period: AccountingPeriodRecord;
};

export type CloseAccountingPeriodResult = CloseAccountingPeriodFailure | CloseAccountingPeriodSuccess;

export type ReopenAccountingPeriodSuccess = {
  event: AccountingPeriodEvent;
  idempotencyRecords: AccountingPeriodIdempotencyRecord[];
  ok: true;
  period: AccountingPeriodRecord;
  replayed: boolean;
};

export type ReopenAccountingPeriodFailure = {
  error: ApiErrorResponse;
  event?: AccountingPeriodEvent;
  idempotencyRecords: AccountingPeriodIdempotencyRecord[];
  ok: false;
  period: AccountingPeriodRecord;
};

export type ReopenAccountingPeriodResult = ReopenAccountingPeriodFailure | ReopenAccountingPeriodSuccess;

export type SourceMutationGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      error: ApiErrorResponse;
    };

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createStableSnapshotHash(value: unknown) {
  const serialized = stableStringify(value);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `chk_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function createError({
  code,
  currentCheckSnapshotHash,
  expectedCheckSnapshotHash,
  message,
  nextAction,
  period,
  requestId,
  sourceId,
  sourceModule
}: Omit<ApiErrorResponse, 'requestId'> & { requestId?: string }): ApiErrorResponse {
  return {
    code,
    currentCheckSnapshotHash,
    expectedCheckSnapshotHash,
    message,
    nextAction,
    period,
    requestId: requestId ?? 'local-contract-test',
    sourceId,
    sourceModule
  };
}

function createCloseRequestSignature(period: string, request: CloseAccountingPeriodRequest) {
  return stableStringify({
    expectedCheckSnapshotHash: request.expectedCheckSnapshotHash,
    period,
    reason: request.reason.trim(),
    version: request.version
  });
}

function createReopenRequestSignature(period: string, request: ReopenAccountingPeriodRequest) {
  return stableStringify({
    period,
    reason: request.reason.trim(),
    riskConfirmation: request.riskConfirmation,
    version: request.version
  });
}

function normalizeRiskConfirmation(
  riskConfirmation: ReopenAccountingPeriodRiskConfirmation | undefined
): ReopenAccountingPeriodRiskConfirmation | undefined {
  if (!riskConfirmation) {
    return undefined;
  }

  return {
    allowIrreversibleExternalSubmissions: Boolean(riskConfirmation.allowIrreversibleExternalSubmissions),
    allowLaterClosedPeriods: Boolean(riskConfirmation.allowLaterClosedPeriods),
    decisionNo: riskConfirmation.decisionNo.trim(),
    note: riskConfirmation.note.trim()
  };
}

function hasValidRiskConfirmation(
  riskConfirmation: ReopenAccountingPeriodRiskConfirmation | undefined
): riskConfirmation is ReopenAccountingPeriodRiskConfirmation {
  return Boolean(riskConfirmation?.decisionNo.trim() && riskConfirmation.note.trim());
}

export function buildCloseChecksResponse({
  checks,
  computedAt,
  period,
  sourceVersionSetHash,
  trialBalance
}: {
  checks: CloseCheckRow[];
  computedAt: string;
  period: AccountingPeriodRecord;
  sourceVersionSetHash: string;
  trialBalance: TrialBalanceSnapshot;
}): CloseChecksResponse {
  const canClose = requiredCloseCheckCodes.every((requiredCode) => {
    const check = checks.find((item) => item.code === requiredCode);

    return Boolean(check?.canPass && check.status !== '阻断');
  });
  const normalizedSnapshot = {
    canClose,
    checks: checks.map((check) => ({
      blockerCount: check.blockerCount,
      canPass: check.canPass,
      code: check.code,
      label: check.label,
      nextModule: check.nextModule,
      sources: check.sources,
      status: check.status,
      summary: check.summary
    })),
    period: period.period,
    periodStatus: period.status,
    sourceVersionSetHash,
    trialBalance,
    version: period.version
  };

  return {
    canClose,
    checkSnapshotHash: createStableSnapshotHash(normalizedSnapshot),
    checks,
    computedAt,
    period: period.period,
    periodStatus: period.status,
    sourceVersionSetHash,
    trialBalance,
    version: period.version
  };
}

export function closeAccountingPeriod({
  checks,
  idempotencyRecords = [],
  period,
  request
}: {
  checks: CloseChecksResponse;
  idempotencyRecords?: AccountingPeriodIdempotencyRecord[];
  period: AccountingPeriodRecord;
  request: CloseAccountingPeriodRequest;
}): CloseAccountingPeriodResult {
  const requestSignature = createCloseRequestSignature(period.period, request);
  const existingIdempotencyRecord = idempotencyRecords.find(
    (record): record is CloseIdempotencyRecord =>
      record.operation === 'close' && record.idempotencyKey === request.idempotencyKey
  );

  if (existingIdempotencyRecord) {
    if (existingIdempotencyRecord.requestSignature === requestSignature) {
      return {
        ...existingIdempotencyRecord.response,
        idempotencyRecords,
        replayed: true
      };
    }

    return {
      error: createError({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: '幂等键已被不同请求使用。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (request.reason.trim().length === 0) {
    return {
      error: createError({
        code: 'INVALID_CLOSE_REASON',
        message: '结账说明不能为空。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (period.status === '已结账') {
    return {
      error: createError({
        code: 'PERIOD_ALREADY_CLOSED',
        message: '该会计期间已结账。',
        nextAction: '反结账',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (request.version !== period.version || checks.version !== period.version) {
    return {
      error: createError({
        code: 'PERIOD_VERSION_CONFLICT',
        message: '会计期间版本已变化，请刷新后重试。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (request.expectedCheckSnapshotHash && request.expectedCheckSnapshotHash !== checks.checkSnapshotHash) {
    return {
      error: createError({
        code: 'CHECK_SNAPSHOT_MISMATCH',
        currentCheckSnapshotHash: checks.checkSnapshotHash,
        expectedCheckSnapshotHash: request.expectedCheckSnapshotHash,
        message: '结账检查结果已变化，请重新检查后再结账。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (!checks.canClose) {
    const failedEvent: AccountingPeriodEvent = {
      afterStatus: period.status,
      beforeStatus: period.status,
      closeCheckSnapshotHash: checks.checkSnapshotHash,
      eventType: 'close_attempt_failed',
      idempotencyKey: request.idempotencyKey,
      period: period.period,
      reason: request.reason.trim(),
      requestId: request.requestId,
      timestamp: request.now
    };

    return {
      error: createError({
        code: 'PERIOD_CLOSE_BLOCKED',
        message: '结账检查未通过，不能结账。',
        period: period.period,
        requestId: request.requestId
      }),
      event: failedEvent,
      idempotencyRecords,
      ok: false,
      period
    };
  }

  const nextPeriod: AccountingPeriodRecord = {
    ...period,
    closeCheckSnapshotId: period.closeCheckSnapshotId ?? `close-check:${period.period}:${checks.checkSnapshotHash}`,
    closeCheckSnapshotHash: checks.checkSnapshotHash,
    closeReason: request.reason.trim(),
    closedAt: request.now,
    closedBySnapshot: request.actorSnapshot,
    status: '已结账',
    version: period.version + 1
  };
  const event: AccountingPeriodEvent = {
    actorSnapshot: request.actorSnapshot,
    afterStatus: nextPeriod.status,
    beforeStatus: period.status,
    closeCheckSnapshotHash: checks.checkSnapshotHash,
    eventType: 'closed',
    idempotencyKey: request.idempotencyKey,
    period: period.period,
    reason: request.reason.trim(),
    requestId: request.requestId,
    timestamp: request.now
  };
  const successWithoutIdempotency: CloseAccountingPeriodSuccess = {
    event,
    idempotencyRecords,
    ok: true,
    period: nextPeriod,
    replayed: false
  };
  const nextIdempotencyRecords = [
    ...idempotencyRecords,
    {
      idempotencyKey: request.idempotencyKey,
      operation: 'close' as const,
      period: period.period,
      requestSignature,
      response: successWithoutIdempotency
    }
  ];

  return {
    ...successWithoutIdempotency,
    idempotencyRecords: nextIdempotencyRecords
  };
}

export function reopenAccountingPeriod({
  irreversibleExternalSubmissions = [],
  idempotencyRecords = [],
  period,
  periods,
  request
}: {
  irreversibleExternalSubmissions?: ReopenAccountingPeriodExternalSubmission[];
  idempotencyRecords?: AccountingPeriodIdempotencyRecord[];
  period: AccountingPeriodRecord;
  periods: AccountingPeriodRecord[];
  request: ReopenAccountingPeriodRequest;
}): ReopenAccountingPeriodResult {
  const requestSignature = createReopenRequestSignature(period.period, request);
  const existingIdempotencyRecord = idempotencyRecords.find(
    (record): record is ReopenIdempotencyRecord =>
      record.operation === 'reopen' && record.idempotencyKey === request.idempotencyKey
  );

  if (existingIdempotencyRecord) {
    if (existingIdempotencyRecord.requestSignature === requestSignature) {
      return {
        ...existingIdempotencyRecord.response,
        idempotencyRecords,
        replayed: true
      };
    }

    return {
      error: createError({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: '幂等键已被不同请求使用。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (request.reason.trim().length === 0) {
    return {
      error: createError({
        code: 'INVALID_REOPEN_REASON',
        message: '反结账原因不能为空。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (period.status !== '已结账') {
    return {
      error: createError({
        code: 'PERIOD_NOT_CLOSED',
        message: '只有已结账期间才能反结账。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (request.version !== period.version) {
    return {
      error: createError({
        code: 'PERIOD_VERSION_CONFLICT',
        message: '会计期间版本已变化，请刷新后重试。',
        period: period.period,
        requestId: request.requestId
      }),
      idempotencyRecords,
      ok: false,
      period
    };
  }

  const laterClosedPeriods = periods
    .filter((item) => item.period > period.period && item.status === '已结账')
    .map((item) => item.period)
    .sort();
  const impactSnapshot: ReopenAccountingPeriodImpactSnapshot = {
    irreversibleExternalSubmissions: irreversibleExternalSubmissions
      .filter((submission) => submission.accountingPeriod === period.period)
      .map((submission) => ({ ...submission }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    laterClosedPeriods
  };
  const riskConfirmation = normalizeRiskConfirmation(request.riskConfirmation);
  const riskConfirmationRequired =
    impactSnapshot.laterClosedPeriods.length > 0 ||
    impactSnapshot.irreversibleExternalSubmissions.length > 0;

  if (riskConfirmationRequired && request.riskConfirmation && !hasValidRiskConfirmation(riskConfirmation)) {
    const failedEvent: AccountingPeriodEvent = {
      actorSnapshot: request.actorSnapshot,
      afterStatus: period.status,
      beforeStatus: period.status,
      eventType: 'reopen_attempt_failed',
      idempotencyKey: request.idempotencyKey,
      period: period.period,
      reason: request.reason.trim(),
      requestId: request.requestId,
      reopenImpactSnapshot: impactSnapshot,
      timestamp: request.now
    };

    return {
      error: createError({
        code: 'INVALID_REOPEN_RISK_CONFIRMATION',
        message: '反结账风险确认必须包含决策编号和确认说明。',
        nextAction: '后续期间调整',
        period: period.period,
        requestId: request.requestId
      }),
      event: failedEvent,
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (impactSnapshot.laterClosedPeriods.length > 0 && !riskConfirmation?.allowLaterClosedPeriods) {
    const failedEvent: AccountingPeriodEvent = {
      actorSnapshot: request.actorSnapshot,
      afterStatus: period.status,
      beforeStatus: period.status,
      eventType: 'reopen_attempt_failed',
      idempotencyKey: request.idempotencyKey,
      period: period.period,
      reason: request.reason.trim(),
      requestId: request.requestId,
      reopenImpactSnapshot: impactSnapshot,
      timestamp: request.now
    };

    return {
      error: createError({
        code: 'PERIOD_REOPEN_BLOCKED',
        message: `后续期间 ${impactSnapshot.laterClosedPeriods.join('、')} 已结账，不能直接反开 ${period.period}。`,
        nextAction: '后续期间调整',
        period: period.period,
        requestId: request.requestId
      }),
      event: failedEvent,
      idempotencyRecords,
      ok: false,
      period
    };
  }

  if (
    impactSnapshot.irreversibleExternalSubmissions.length > 0 &&
    !riskConfirmation?.allowIrreversibleExternalSubmissions
  ) {
    const failedEvent: AccountingPeriodEvent = {
      actorSnapshot: request.actorSnapshot,
      afterStatus: period.status,
      beforeStatus: period.status,
      eventType: 'reopen_attempt_failed',
      idempotencyKey: request.idempotencyKey,
      period: period.period,
      reason: request.reason.trim(),
      requestId: request.requestId,
      reopenImpactSnapshot: impactSnapshot,
      timestamp: request.now
    };

    return {
      error: createError({
        code: 'PERIOD_REOPEN_BLOCKED',
        message: `${period.period} 已存在不可逆外部提交，不能直接反结账。`,
        nextAction: '后续期间调整',
        period: period.period,
        requestId: request.requestId
      }),
      event: failedEvent,
      idempotencyRecords,
      ok: false,
      period
    };
  }

  const nextPeriod: AccountingPeriodRecord = {
    ...period,
    reopenReason: request.reason.trim(),
    reopenImpactSnapshot: riskConfirmationRequired ? impactSnapshot : undefined,
    reopenRiskConfirmationSnapshot: riskConfirmationRequired ? riskConfirmation : undefined,
    reopenedAt: request.now,
    reopenedBySnapshot: request.actorSnapshot,
    status: '已反结账',
    version: period.version + 1
  };
  const event: AccountingPeriodEvent = {
    actorSnapshot: request.actorSnapshot,
    afterStatus: nextPeriod.status,
    beforeStatus: period.status,
    closeCheckSnapshotHash: period.closeCheckSnapshotHash,
    eventType: 'reopened',
    idempotencyKey: request.idempotencyKey,
    period: period.period,
    reason: request.reason.trim(),
    requestId: request.requestId,
    reopenImpactSnapshot: nextPeriod.reopenImpactSnapshot,
    reopenRiskConfirmationSnapshot: nextPeriod.reopenRiskConfirmationSnapshot,
    timestamp: request.now
  };
  const successWithoutIdempotency: ReopenAccountingPeriodSuccess = {
    event,
    idempotencyRecords,
    ok: true,
    period: nextPeriod,
    replayed: false
  };
  const nextIdempotencyRecords: AccountingPeriodIdempotencyRecord[] = [
    ...idempotencyRecords,
    {
      idempotencyKey: request.idempotencyKey,
      operation: 'reopen',
      period: period.period,
      requestSignature,
      response: successWithoutIdempotency
    }
  ];

  return {
    ...successWithoutIdempotency,
    idempotencyRecords: nextIdempotencyRecords
  };
}

export function assertAccountingPeriodOpen({
  accountingPeriod,
  periods,
  requestId,
  sourceId,
  sourceModule
}: {
  accountingPeriod: string;
  periods: AccountingPeriodRecord[];
  requestId: string;
  sourceId?: string;
  sourceModule?: string;
}): SourceMutationGuardResult {
  const period = periods.find((record) => record.period === accountingPeriod);

  if (!period) {
    return {
      allowed: false,
      error: createError({
        code: 'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED',
        message: `${accountingPeriod} 尚未建立会计期间，不能修改影响账务结果的事项。`,
        period: accountingPeriod,
        requestId,
        sourceId,
        sourceModule
      })
    };
  }

  if (period.status !== '已结账') {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: createError({
      code: canonicalClosedAccountingPeriodErrorCode,
      message: `${accountingPeriod} 已结账，不能修改影响本期账务结果的事项。`,
      nextAction: '后续期间调整',
      period: accountingPeriod,
      requestId,
      sourceId,
      sourceModule
    })
  };
}
