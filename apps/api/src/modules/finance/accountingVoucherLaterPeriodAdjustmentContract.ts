import {
  canonicalClosedAccountingPeriodErrorCode,
  type AccountingPeriodRecord,
  type ActorSnapshot
} from './periodCloseContract.js';

export type AccountingVoucherLifecycleStatus = '待制单' | '已制单' | '已记账' | '已冲销';
export type AccountingVoucherLineSide = '借方' | '贷方';
export type AccountingVoucherAdjustmentErrorCode =
  | typeof canonicalClosedAccountingPeriodErrorCode
  | 'ADJUSTMENT_ALREADY_EXISTS'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INVALID_ADJUSTMENT_REQUEST'
  | 'ORIGINAL_PERIOD_NOT_CLOSED'
  | 'VERSION_CONFLICT'
  | 'VOUCHER_ADJUSTMENT_PERIOD_INVALID'
  | 'VOUCHER_ALREADY_REVERSED'
  | 'VOUCHER_IS_REVERSAL'
  | 'VOUCHER_NOT_BOOKED'
  | 'VOUCHER_NOT_FOUND';

export type AccountingVoucherAdjustmentLine = {
  amount: string;
  auxiliary: string;
  id: string;
  side: AccountingVoucherLineSide;
  subjectCode: string;
  summary: string;
};

export type AccountingVoucherPersistedRecord = {
  accountingPeriod: string;
  amount: string;
  id: string;
  lines: AccountingVoucherAdjustmentLine[];
  reversalOfVoucherId?: string;
  reversedByVoucherId?: string;
  sourceNo: string;
  sourceTitle: string;
  status: AccountingVoucherLifecycleStatus;
  version: number;
  voucherNo: string;
};

export type AccountingVoucherLaterPeriodAdjustmentRequest = {
  actorSnapshot: ActorSnapshot;
  adjustmentDate: string;
  adjustmentPeriod: string;
  idempotencyKey: string;
  now: string;
  reason: string;
  requestId: string;
  version: number;
};

export type AccountingVoucherLaterPeriodAdjustmentFact = {
  actorSnapshot: ActorSnapshot;
  adjustmentDate: string;
  adjustmentNo: string;
  adjustmentPeriod: string;
  amount: string;
  createdAt: string;
  id: string;
  originalAccountingPeriod: string;
  originalVoucherId: string;
  originalVoucherNo: string;
  reason: string;
  status: '待制单' | '已制单';
};

export type AccountingVoucherLaterPeriodAdjustmentCandidate = {
  accountingPeriod: string;
  amount: string;
  businessType: '调整凭证';
  id: string;
  lines: AccountingVoucherAdjustmentLine[];
  sourceNo: string;
  sourceRefs: Array<{
    module: '会计凭证';
    recordId: string;
    recordNo: string;
    role: '调整依据';
  }>;
  sourceTitle: string;
  sourceType: '后续调整';
  status: '待制单';
  summary: string;
  voucherDate: string;
  voucherNo: string;
};

export type AccountingVoucherLaterPeriodAdjustmentEvent = {
  actorSnapshot: ActorSnapshot;
  adjustmentNo?: string;
  eventType: 'later_period_adjustment_created' | 'later_period_adjustment_rejected';
  originalVoucherId: string;
  reason?: string;
  requestId: string;
  targetAccountingPeriod?: string;
  timestamp: string;
};

export type AccountingVoucherLaterPeriodAdjustmentError = {
  code: AccountingVoucherAdjustmentErrorCode;
  message: string;
  nextAction?: '冲销' | '后续期间调整' | '反结账';
  period?: string;
  requestId: string;
  voucherId?: string;
};

export type AccountingVoucherLaterPeriodAdjustmentSuccess = {
  adjustmentFact: AccountingVoucherLaterPeriodAdjustmentFact;
  adjustmentFacts: AccountingVoucherLaterPeriodAdjustmentFact[];
  candidate: AccountingVoucherLaterPeriodAdjustmentCandidate;
  event: AccountingVoucherLaterPeriodAdjustmentEvent;
  idempotencyRecords: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[];
  ok: true;
  originalVoucher: AccountingVoucherPersistedRecord;
  replayed: boolean;
};

export type AccountingVoucherLaterPeriodAdjustmentFailure = {
  adjustmentFacts: AccountingVoucherLaterPeriodAdjustmentFact[];
  error: AccountingVoucherLaterPeriodAdjustmentError;
  event?: AccountingVoucherLaterPeriodAdjustmentEvent;
  idempotencyRecords: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[];
  ok: false;
  originalVoucher?: AccountingVoucherPersistedRecord;
};

export type AccountingVoucherLaterPeriodAdjustmentResult =
  | AccountingVoucherLaterPeriodAdjustmentFailure
  | AccountingVoucherLaterPeriodAdjustmentSuccess;

export type AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord = {
  idempotencyKey: string;
  operation: 'later_period_adjustment';
  requestSignature: string;
  response: AccountingVoucherLaterPeriodAdjustmentSuccess;
  voucherId: string;
};

export type AccountingVoucherLaterPeriodAdjustmentRouteRequest = {
  body?: unknown;
  method: 'POST';
  path: string;
};

export type AccountingVoucherLaterPeriodAdjustmentRouteContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  requestId: string;
};

export type AccountingVoucherLaterPeriodAdjustmentRouteState = {
  adjustmentFacts: AccountingVoucherLaterPeriodAdjustmentFact[];
  events: AccountingVoucherLaterPeriodAdjustmentEvent[];
  idempotencyRecords: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[];
  periods: AccountingPeriodRecord[];
  vouchers: AccountingVoucherPersistedRecord[];
};

export type AccountingVoucherLaterPeriodAdjustmentRouteResponse = {
  body: unknown;
  state: AccountingVoucherLaterPeriodAdjustmentRouteState;
  status: number;
};

type LaterPeriodAdjustmentBody = {
  adjustmentDate: string;
  adjustmentPeriod: string;
  idempotencyKey: string;
  reason: string;
  version: number;
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

function createError({
  code,
  message,
  nextAction,
  period,
  requestId,
  voucherId
}: Omit<AccountingVoucherLaterPeriodAdjustmentError, 'requestId'> & {
  requestId?: string;
}): AccountingVoucherLaterPeriodAdjustmentError {
  return {
    code,
    message,
    nextAction,
    period,
    requestId: requestId ?? 'local-contract-test',
    voucherId
  };
}

function createRequestSignature(voucherId: string, request: AccountingVoucherLaterPeriodAdjustmentRequest) {
  return stableStringify({
    adjustmentDate: request.adjustmentDate,
    adjustmentPeriod: request.adjustmentPeriod,
    reason: request.reason.trim(),
    version: request.version,
    voucherId
  });
}

function isAccountingPeriodText(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function compareAccountingPeriods(left: string, right: string) {
  const leftMatch = left.match(/^(\d{4})-(\d{2})$/);
  const rightMatch = right.match(/^(\d{4})-(\d{2})$/);

  if (!leftMatch || !rightMatch) {
    return Number.NaN;
  }

  return (Number(leftMatch[1]) * 12 + Number(leftMatch[2])) -
    (Number(rightMatch[1]) * 12 + Number(rightMatch[2]));
}

function isAccountingPeriodClosed(periods: AccountingPeriodRecord[], accountingPeriod: string) {
  return periods.some((period) => period.period === accountingPeriod && period.status === '已结账');
}

function getAccountingPeriodStatus(periods: AccountingPeriodRecord[], accountingPeriod: string) {
  return periods.find((period) => period.period === accountingPeriod)?.status;
}

function getOppositeLineSide(side: AccountingVoucherLineSide): AccountingVoucherLineSide {
  return side === '借方' ? '贷方' : '借方';
}

function cloneVoucher(record: AccountingVoucherPersistedRecord): AccountingVoucherPersistedRecord {
  return {
    ...record,
    lines: record.lines.map((line) => ({ ...line }))
  };
}

function cloneAdjustmentFact(record: AccountingVoucherLaterPeriodAdjustmentFact): AccountingVoucherLaterPeriodAdjustmentFact {
  return {
    ...record,
    actorSnapshot: { ...record.actorSnapshot }
  };
}

function getNextAdjustmentNo(rows: AccountingVoucherLaterPeriodAdjustmentFact[], accountingPeriod: string) {
  const periodCode = accountingPeriod.replace('-', '');
  const nextSequence =
    rows
      .filter((row) => row.adjustmentPeriod === accountingPeriod)
      .reduce((maxSequence, row) => {
        const sequence = Number(row.adjustmentNo.slice(row.adjustmentNo.lastIndexOf('-') + 1));

        return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
      }, 0) + 1;

  return `ADJ-${periodCode}-${String(nextSequence).padStart(3, '0')}`;
}

function getNextCandidateVoucherNo(rows: AccountingVoucherLaterPeriodAdjustmentFact[], accountingPeriod: string) {
  const periodCode = accountingPeriod.replace('-', '');
  const nextSequence = rows.filter((row) => row.adjustmentPeriod === accountingPeriod).length + 1;

  return `VCH-${periodCode}-L${String(nextSequence).padStart(3, '0')}`;
}

function buildLaterPeriodAdjustmentCandidate(
  originalVoucher: AccountingVoucherPersistedRecord,
  adjustmentFact: AccountingVoucherLaterPeriodAdjustmentFact,
  existingAdjustmentFacts: AccountingVoucherLaterPeriodAdjustmentFact[]
): AccountingVoucherLaterPeriodAdjustmentCandidate {
  return {
    accountingPeriod: adjustmentFact.adjustmentPeriod,
    amount: adjustmentFact.amount,
    businessType: '调整凭证',
    id: `candidate-later-adjustment-${adjustmentFact.id}`,
    lines: originalVoucher.lines.map((line, index) => ({
      ...line,
      id: `${adjustmentFact.id}-line-${index + 1}`,
      side: getOppositeLineSide(line.side),
      summary: `后续调整：${line.summary}`
    })),
    sourceNo: adjustmentFact.adjustmentNo,
    sourceRefs: [
      {
        module: '会计凭证',
        recordId: originalVoucher.id,
        recordNo: originalVoucher.voucherNo,
        role: '调整依据'
      }
    ],
    sourceTitle: `后续调整 ${originalVoucher.sourceTitle}`,
    sourceType: '后续调整',
    status: '待制单',
    summary: `后续期间调整：${adjustmentFact.reason}`,
    voucherDate: adjustmentFact.adjustmentDate,
    voucherNo: getNextCandidateVoucherNo(existingAdjustmentFacts, adjustmentFact.adjustmentPeriod)
  };
}

function createRejectedEvent({
  originalVoucher,
  request,
  targetAccountingPeriod
}: {
  originalVoucher?: AccountingVoucherPersistedRecord;
  request: AccountingVoucherLaterPeriodAdjustmentRequest;
  targetAccountingPeriod?: string;
}): AccountingVoucherLaterPeriodAdjustmentEvent {
  return {
    actorSnapshot: request.actorSnapshot,
    eventType: 'later_period_adjustment_rejected',
    originalVoucherId: originalVoucher?.id ?? '-',
    reason: request.reason.trim() || undefined,
    requestId: request.requestId,
    targetAccountingPeriod,
    timestamp: request.now
  };
}

function createFailure({
  adjustmentFacts,
  code,
  event,
  idempotencyRecords,
  message,
  nextAction,
  originalVoucher,
  period,
  request,
  voucherId
}: {
  adjustmentFacts: AccountingVoucherLaterPeriodAdjustmentFact[];
  code: AccountingVoucherAdjustmentErrorCode;
  event?: AccountingVoucherLaterPeriodAdjustmentEvent;
  idempotencyRecords: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[];
  message: string;
  nextAction?: AccountingVoucherLaterPeriodAdjustmentError['nextAction'];
  originalVoucher?: AccountingVoucherPersistedRecord;
  period?: string;
  request: AccountingVoucherLaterPeriodAdjustmentRequest;
  voucherId?: string;
}): AccountingVoucherLaterPeriodAdjustmentFailure {
  return {
    adjustmentFacts,
    error: createError({
      code,
      message,
      nextAction,
      period,
      requestId: request.requestId,
      voucherId
    }),
    event,
    idempotencyRecords,
    ok: false,
    originalVoucher
  };
}

export function createAccountingVoucherLaterPeriodAdjustment({
  adjustmentFacts = [],
  idempotencyRecords = [],
  originalVoucher,
  periods,
  request
}: {
  adjustmentFacts?: AccountingVoucherLaterPeriodAdjustmentFact[];
  idempotencyRecords?: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[];
  originalVoucher?: AccountingVoucherPersistedRecord;
  periods: AccountingPeriodRecord[];
  request: AccountingVoucherLaterPeriodAdjustmentRequest;
}): AccountingVoucherLaterPeriodAdjustmentResult {
  const voucherId = originalVoucher?.id ?? '-';
  const requestSignature = createRequestSignature(voucherId, request);
  const existingIdempotencyRecord = idempotencyRecords.find(
    (record) =>
      record.operation === 'later_period_adjustment' &&
      record.idempotencyKey === request.idempotencyKey
  );

  if (existingIdempotencyRecord) {
    if (existingIdempotencyRecord.requestSignature === requestSignature) {
      return {
        ...existingIdempotencyRecord.response,
        adjustmentFacts,
        idempotencyRecords,
        replayed: true
      };
    }

    return createFailure({
      adjustmentFacts,
      code: 'IDEMPOTENCY_KEY_REUSED',
      idempotencyRecords,
      message: '幂等键已被不同请求使用。',
      originalVoucher,
      request,
      voucherId: originalVoucher?.id
    });
  }

  if (!originalVoucher) {
    return createFailure({
      adjustmentFacts,
      code: 'VOUCHER_NOT_FOUND',
      idempotencyRecords,
      message: '原会计凭证不存在。',
      request,
      voucherId: undefined
    });
  }

  const eventBase = {
    originalVoucher,
    request,
    targetAccountingPeriod: request.adjustmentPeriod
  };
  const reason = request.reason.trim();

  if (!reason || !request.adjustmentDate || !request.adjustmentPeriod || !request.idempotencyKey) {
    return createFailure({
      adjustmentFacts,
      code: 'INVALID_ADJUSTMENT_REQUEST',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '调整期间、调整日期、调整原因和幂等键不能为空。',
      originalVoucher,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (request.version !== originalVoucher.version) {
    return createFailure({
      adjustmentFacts,
      code: 'VERSION_CONFLICT',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '凭证版本已变化，请刷新后重试。',
      originalVoucher,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (originalVoucher.reversalOfVoucherId) {
    return createFailure({
      adjustmentFacts,
      code: 'VOUCHER_IS_REVERSAL',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '冲销凭证不能再生成后续期间调整。',
      originalVoucher,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (originalVoucher.reversedByVoucherId || originalVoucher.status === '已冲销') {
    return createFailure({
      adjustmentFacts,
      code: 'VOUCHER_ALREADY_REVERSED',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '原凭证已冲销，不能重复生成后续期间调整。',
      originalVoucher,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (originalVoucher.status !== '已记账') {
    return createFailure({
      adjustmentFacts,
      code: 'VOUCHER_NOT_BOOKED',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '只有已记账凭证可以生成后续期间调整。',
      originalVoucher,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (!isAccountingPeriodClosed(periods, originalVoucher.accountingPeriod)) {
    return createFailure({
      adjustmentFacts,
      code: 'ORIGINAL_PERIOD_NOT_CLOSED',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '原凭证期间尚未结账，请使用同期间冲销。',
      nextAction: '冲销',
      originalVoucher,
      period: originalVoucher.accountingPeriod,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (
    !isAccountingPeriodText(request.adjustmentPeriod) ||
    compareAccountingPeriods(request.adjustmentPeriod, originalVoucher.accountingPeriod) <= 0 ||
    request.adjustmentDate.slice(0, 7) !== request.adjustmentPeriod
  ) {
    return createFailure({
      adjustmentFacts,
      code: 'VOUCHER_ADJUSTMENT_PERIOD_INVALID',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '调整期间必须晚于原凭证期间，且调整日期必须落在调整期间。',
      originalVoucher,
      period: request.adjustmentPeriod,
      request,
      voucherId: originalVoucher.id
    });
  }

  const targetPeriodStatus = getAccountingPeriodStatus(periods, request.adjustmentPeriod);

  if (targetPeriodStatus === '已结账') {
    return createFailure({
      adjustmentFacts,
      code: canonicalClosedAccountingPeriodErrorCode,
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: `${request.adjustmentPeriod} 已结账，不能生成后续期间调整凭证。`,
      nextAction: '反结账',
      originalVoucher,
      period: request.adjustmentPeriod,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (targetPeriodStatus !== '开放') {
    return createFailure({
      adjustmentFacts,
      code: 'VOUCHER_ADJUSTMENT_PERIOD_INVALID',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '调整期间必须是已存在的开放期间。',
      originalVoucher,
      period: request.adjustmentPeriod,
      request,
      voucherId: originalVoucher.id
    });
  }

  if (
    adjustmentFacts.some((record) =>
      record.originalVoucherId === originalVoucher.id &&
      record.adjustmentPeriod === request.adjustmentPeriod
    )
  ) {
    return createFailure({
      adjustmentFacts,
      code: 'ADJUSTMENT_ALREADY_EXISTS',
      event: createRejectedEvent(eventBase),
      idempotencyRecords,
      message: '该原凭证在目标调整期间已存在后续期间调整。',
      originalVoucher,
      period: request.adjustmentPeriod,
      request,
      voucherId: originalVoucher.id
    });
  }

  const adjustmentFact: AccountingVoucherLaterPeriodAdjustmentFact = {
    actorSnapshot: request.actorSnapshot,
    adjustmentDate: request.adjustmentDate,
    adjustmentNo: getNextAdjustmentNo(adjustmentFacts, request.adjustmentPeriod),
    adjustmentPeriod: request.adjustmentPeriod,
    amount: originalVoucher.amount,
    createdAt: request.now,
    id: `later-adjustment-${originalVoucher.id}-${request.adjustmentPeriod}`,
    originalAccountingPeriod: originalVoucher.accountingPeriod,
    originalVoucherId: originalVoucher.id,
    originalVoucherNo: originalVoucher.voucherNo,
    reason,
    status: '待制单'
  };
  const candidate = buildLaterPeriodAdjustmentCandidate(originalVoucher, adjustmentFact, adjustmentFacts);
  const event: AccountingVoucherLaterPeriodAdjustmentEvent = {
    actorSnapshot: request.actorSnapshot,
    adjustmentNo: adjustmentFact.adjustmentNo,
    eventType: 'later_period_adjustment_created',
    originalVoucherId: originalVoucher.id,
    reason,
    requestId: request.requestId,
    targetAccountingPeriod: request.adjustmentPeriod,
    timestamp: request.now
  };
  const nextAdjustmentFacts = [adjustmentFact, ...adjustmentFacts.map(cloneAdjustmentFact)];
  const successWithoutIdempotency: AccountingVoucherLaterPeriodAdjustmentSuccess = {
    adjustmentFact,
    adjustmentFacts: nextAdjustmentFacts,
    candidate,
    event,
    idempotencyRecords,
    ok: true,
    originalVoucher: cloneVoucher(originalVoucher),
    replayed: false
  };
  const nextIdempotencyRecords: AccountingVoucherLaterPeriodAdjustmentIdempotencyRecord[] = [
    ...idempotencyRecords,
    {
      idempotencyKey: request.idempotencyKey,
      operation: 'later_period_adjustment',
      requestSignature,
      response: successWithoutIdempotency,
      voucherId: originalVoucher.id
    }
  ];

  return {
    ...successWithoutIdempotency,
    idempotencyRecords: nextIdempotencyRecords
  };
}

function cloneRouteState(
  state: AccountingVoucherLaterPeriodAdjustmentRouteState
): AccountingVoucherLaterPeriodAdjustmentRouteState {
  return {
    adjustmentFacts: state.adjustmentFacts.map(cloneAdjustmentFact),
    events: state.events.map((event) => ({ ...event, actorSnapshot: { ...event.actorSnapshot } })),
    idempotencyRecords: [...state.idempotencyRecords],
    periods: state.periods.map((period) => ({ ...period })),
    vouchers: state.vouchers.map(cloneVoucher)
  };
}

function isAdjustmentBody(value: unknown): value is LaterPeriodAdjustmentBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const body = value as LaterPeriodAdjustmentBody;

  return (
    typeof body.adjustmentDate === 'string' &&
    typeof body.adjustmentPeriod === 'string' &&
    typeof body.idempotencyKey === 'string' &&
    typeof body.reason === 'string' &&
    typeof body.version === 'number'
  );
}

function getRouteStatus(result: AccountingVoucherLaterPeriodAdjustmentResult) {
  if (result.ok) {
    return result.replayed ? 200 : 201;
  }

  if (result.error.code === 'VOUCHER_NOT_FOUND') {
    return 404;
  }

  if (
    result.error.code === canonicalClosedAccountingPeriodErrorCode ||
    result.error.code === 'ADJUSTMENT_ALREADY_EXISTS' ||
    result.error.code === 'IDEMPOTENCY_KEY_REUSED' ||
    result.error.code === 'VERSION_CONFLICT'
  ) {
    return 409;
  }

  return 422;
}

export function handleAccountingVoucherLaterPeriodAdjustmentRoute({
  context,
  request,
  state
}: {
  context: AccountingVoucherLaterPeriodAdjustmentRouteContext;
  request: AccountingVoucherLaterPeriodAdjustmentRouteRequest;
  state: AccountingVoucherLaterPeriodAdjustmentRouteState;
}): AccountingVoucherLaterPeriodAdjustmentRouteResponse {
  const nextState = cloneRouteState(state);
  const match = request.path.match(/^\/api\/finance\/accounting-vouchers\/([^/]+)\/later-period-adjustments$/);

  if (!match?.[1]) {
    return {
      body: {
        code: 'NOT_FOUND',
        message: '接口不存在。',
        requestId: context.requestId
      },
      state: nextState,
      status: 404
    };
  }

  if (!isAdjustmentBody(request.body)) {
    return {
      body: {
        code: 'INVALID_ADJUSTMENT_REQUEST',
        message: '请求体必须包含调整期间、调整日期、调整原因、版本和幂等键。',
        requestId: context.requestId
      },
      state: nextState,
      status: 400
    };
  }

  const body = request.body;
  const voucherId = decodeURIComponent(match[1]);
  const originalVoucher = nextState.vouchers.find((voucher) => voucher.id === voucherId);
  const result = createAccountingVoucherLaterPeriodAdjustment({
    adjustmentFacts: nextState.adjustmentFacts,
    idempotencyRecords: nextState.idempotencyRecords,
    originalVoucher,
    periods: nextState.periods,
    request: {
      actorSnapshot: context.actorSnapshot,
      adjustmentDate: body.adjustmentDate,
      adjustmentPeriod: body.adjustmentPeriod,
      idempotencyKey: body.idempotencyKey,
      now: context.now,
      reason: body.reason,
      requestId: context.requestId,
      version: body.version
    }
  });

  if (result.ok) {
    return {
      body: {
        adjustmentFact: result.adjustmentFact,
        candidate: result.candidate,
        replayed: result.replayed
      },
      state: {
        ...nextState,
        adjustmentFacts: result.adjustmentFacts,
        events: result.replayed ? nextState.events : [result.event, ...nextState.events],
        idempotencyRecords: result.idempotencyRecords
      },
      status: getRouteStatus(result)
    };
  }

  return {
    body: result.error,
    state: {
      ...nextState,
      events: result.event ? [result.event, ...nextState.events] : nextState.events,
      idempotencyRecords: result.idempotencyRecords
    },
    status: getRouteStatus(result)
  };
}
