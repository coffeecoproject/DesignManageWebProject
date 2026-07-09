import {
  canonicalClosedAccountingPeriodErrorCode,
  createStableSnapshotHash,
  type AccountingPeriodRecord,
  type ActorSnapshot
} from './periodCloseContract.js';
import {
  guardFinanceSourceMutation,
  sourceAccountingPeriodUnresolvedErrorCode
} from './periodCloseSourceMutationGuard.js';

export type AccountingVoucherLifecycleBusinessType = '权责凭证' | '资金凭证' | '税费凭证' | '调整凭证' | '冲销凭证';
export type AccountingVoucherLifecycleLineSide = '借方' | '贷方';
export type AccountingVoucherLifecycleStatus = '已制单' | '已记账' | '已冲销';
export type AccountingVoucherLifecycleErrorCode =
  | typeof canonicalClosedAccountingPeriodErrorCode
  | typeof sourceAccountingPeriodUnresolvedErrorCode
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INVALID_VOUCHER_REQUEST'
  | 'LEDGER_ENTRY_ALREADY_EXISTS'
  | 'VOUCHER_ALREADY_BOOKED'
  | 'VOUCHER_ALREADY_REVERSED'
  | 'VOUCHER_IS_REVERSAL'
  | 'VOUCHER_NOT_BALANCED'
  | 'VOUCHER_NOT_BOOKED'
  | 'VOUCHER_NOT_FOUND'
  | 'VOUCHER_NOT_PREPARED'
  | 'VOUCHER_SOURCE_CHANGED';

export type AccountingVoucherSourceSnapshot = {
  accountingPeriod: string;
  amount: string;
  businessType: Exclude<AccountingVoucherLifecycleBusinessType, '冲销凭证'>;
  sourceHash: string;
  sourceId: string;
  sourceModule: string;
  sourceNo: string;
  sourceTitle: string;
  sourceVersion: number;
  voucherDate: string;
};

export type AccountingVoucherLifecycleLine = {
  amount: string;
  auxiliary: string;
  id: string;
  side: AccountingVoucherLifecycleLineSide;
  subjectCode: string;
  subjectName: string;
  summary: string;
};

export type AccountingVoucherLifecycleRecord = {
  accountingPeriod: string;
  amount: string;
  bookedAt?: string;
  bookedBySnapshot?: ActorSnapshot;
  businessType: AccountingVoucherLifecycleBusinessType;
  id: string;
  lines: AccountingVoucherLifecycleLine[];
  preparedAt: string;
  preparedBySnapshot: ActorSnapshot;
  reversalOfVoucherId?: string;
  reversedAt?: string;
  reversedBySnapshot?: ActorSnapshot;
  reversedByVoucherId?: string;
  sourceSnapshot: AccountingVoucherSourceSnapshot;
  status: AccountingVoucherLifecycleStatus;
  version: number;
  voucherDate: string;
  voucherNo: string;
};

export type GeneralLedgerLifecycleRow = {
  accountingPeriod: string;
  auxiliary: string;
  creditAmount: string;
  createdAt: string;
  debitAmount: string;
  id: string;
  sourceSnapshotHash: string;
  sourceVoucherLineId: string;
  subjectCode: string;
  subjectName: string;
  summary: string;
  voucherDate: string;
  voucherId: string;
  voucherNo: string;
};

export type AccountingVoucherLifecycleEvent = {
  actorSnapshot: ActorSnapshot;
  eventType: 'voucher_prepared' | 'voucher_booked' | 'voucher_reversed' | 'voucher_action_rejected';
  reason?: string;
  requestId: string;
  timestamp: string;
  voucherId?: string;
  voucherNo?: string;
};

export type AccountingVoucherLifecycleError = {
  code: AccountingVoucherLifecycleErrorCode;
  message: string;
  nextAction?: '后续期间调整' | '反结账' | '冲销';
  period?: string;
  requestId: string;
  voucherId?: string;
};

export type AccountingVoucherLifecycleState = {
  events: AccountingVoucherLifecycleEvent[];
  ledgerRows: GeneralLedgerLifecycleRow[];
  vouchers: AccountingVoucherLifecycleRecord[];
};

export type AccountingVoucherLifecycleSuccess = AccountingVoucherLifecycleState & {
  ok: true;
  replayed: boolean;
  voucher: AccountingVoucherLifecycleRecord;
};

export type AccountingVoucherLifecycleFailure = AccountingVoucherLifecycleState & {
  error: AccountingVoucherLifecycleError;
  event?: AccountingVoucherLifecycleEvent;
  ok: false;
  voucher?: AccountingVoucherLifecycleRecord;
};

export type AccountingVoucherLifecycleResult =
  | AccountingVoucherLifecycleFailure
  | AccountingVoucherLifecycleSuccess;

export type PrepareAccountingVoucherRequest = {
  actorSnapshot: ActorSnapshot;
  expectedSourceHash: string;
  idempotencyKey: string;
  now: string;
  requestId: string;
};

export type BookAccountingVoucherRequest = {
  actorSnapshot: ActorSnapshot;
  idempotencyKey: string;
  now: string;
  requestId: string;
};

export type ReverseAccountingVoucherRequest = {
  actorSnapshot: ActorSnapshot;
  idempotencyKey: string;
  now: string;
  reason: string;
  requestId: string;
};

function cloneLine(line: AccountingVoucherLifecycleLine): AccountingVoucherLifecycleLine {
  return { ...line };
}

function cloneSourceSnapshot(sourceSnapshot: AccountingVoucherSourceSnapshot): AccountingVoucherSourceSnapshot {
  return { ...sourceSnapshot };
}

function cloneVoucher(record: AccountingVoucherLifecycleRecord): AccountingVoucherLifecycleRecord {
  return {
    ...record,
    bookedBySnapshot: record.bookedBySnapshot ? { ...record.bookedBySnapshot } : undefined,
    lines: record.lines.map(cloneLine),
    preparedBySnapshot: { ...record.preparedBySnapshot },
    reversedBySnapshot: record.reversedBySnapshot ? { ...record.reversedBySnapshot } : undefined,
    sourceSnapshot: cloneSourceSnapshot(record.sourceSnapshot)
  };
}

function cloneLedgerRow(row: GeneralLedgerLifecycleRow): GeneralLedgerLifecycleRow {
  return { ...row };
}

function cloneEvent(event: AccountingVoucherLifecycleEvent): AccountingVoucherLifecycleEvent {
  return {
    ...event,
    actorSnapshot: { ...event.actorSnapshot }
  };
}

function createError({
  code,
  message,
  nextAction,
  period,
  requestId,
  voucherId
}: AccountingVoucherLifecycleError): AccountingVoucherLifecycleError {
  return {
    code,
    message,
    nextAction,
    period,
    requestId,
    voucherId
  };
}

function createRejectedEvent({
  actorSnapshot,
  now,
  reason,
  requestId,
  voucher
}: {
  actorSnapshot: ActorSnapshot;
  now: string;
  reason?: string;
  requestId: string;
  voucher?: AccountingVoucherLifecycleRecord;
}): AccountingVoucherLifecycleEvent {
  return {
    actorSnapshot,
    eventType: 'voucher_action_rejected',
    reason,
    requestId,
    timestamp: now,
    voucherId: voucher?.id,
    voucherNo: voucher?.voucherNo
  };
}

function createFailure({
  actorSnapshot,
  code,
  events,
  ledgerRows,
  message,
  nextAction,
  now,
  period,
  requestId,
  reason,
  voucher,
  vouchers
}: {
  actorSnapshot: ActorSnapshot;
  code: AccountingVoucherLifecycleErrorCode;
  events: AccountingVoucherLifecycleEvent[];
  ledgerRows: GeneralLedgerLifecycleRow[];
  message: string;
  nextAction?: AccountingVoucherLifecycleError['nextAction'];
  now: string;
  period?: string;
  requestId: string;
  reason?: string;
  voucher?: AccountingVoucherLifecycleRecord;
  vouchers: AccountingVoucherLifecycleRecord[];
}): AccountingVoucherLifecycleFailure {
  const event = createRejectedEvent({
    actorSnapshot,
    now,
    reason,
    requestId,
    voucher
  });

  return {
    error: createError({
      code,
      message,
      nextAction,
      period,
      requestId,
      voucherId: voucher?.id
    }),
    event,
    events: [...events.map(cloneEvent), event],
    ledgerRows: ledgerRows.map(cloneLedgerRow),
    ok: false,
    voucher: voucher ? cloneVoucher(voucher) : undefined,
    vouchers: vouchers.map(cloneVoucher)
  };
}

function parseMoneyToCents(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);

  if (!match) {
    return Number.NaN;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const integerPart = Number(match[2]);
  const decimalPart = Number((match[3] ?? '').padEnd(2, '0'));

  return sign * (integerPart * 100 + decimalPart);
}

function formatCents(cents: number) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const integerPart = Math.floor(absolute / 100);
  const decimalPart = String(absolute % 100).padStart(2, '0');

  return `${sign}${integerPart}.${decimalPart}`;
}

function sumVoucherSide(lines: AccountingVoucherLifecycleLine[], side: AccountingVoucherLifecycleLineSide) {
  return lines
    .filter((line) => line.side === side)
    .reduce((sum, line) => sum + parseMoneyToCents(line.amount), 0);
}

function isBalanced(lines: AccountingVoucherLifecycleLine[]) {
  if (lines.length === 0) {
    return false;
  }

  const debitTotal = sumVoucherSide(lines, '借方');
  const creditTotal = sumVoucherSide(lines, '贷方');

  return Number.isFinite(debitTotal) && debitTotal === creditTotal;
}

function getVoucherAmount(lines: AccountingVoucherLifecycleLine[]) {
  return formatCents(Math.abs(sumVoucherSide(lines, '借方')));
}

function getNextVoucherSequence(vouchers: AccountingVoucherLifecycleRecord[], accountingPeriod: string) {
  return vouchers.filter((voucher) => voucher.accountingPeriod === accountingPeriod).length + 1;
}

function buildVoucherNo({
  accountingPeriod,
  businessType,
  vouchers
}: {
  accountingPeriod: string;
  businessType: AccountingVoucherLifecycleBusinessType;
  vouchers: AccountingVoucherLifecycleRecord[];
}) {
  const periodCode = accountingPeriod.replace('-', '');
  const sequence = getNextVoucherSequence(vouchers, accountingPeriod);
  const prefix = businessType === '冲销凭证' ? '冲' : '记';

  return `${prefix}-${periodCode}-${String(sequence).padStart(3, '0')}`;
}

function buildVoucherId(accountingPeriod: string, sequence: number) {
  return `voucher-${accountingPeriod.replace('-', '')}-${String(sequence).padStart(3, '0')}`;
}

function getOppositeLineSide(side: AccountingVoucherLifecycleLineSide): AccountingVoucherLifecycleLineSide {
  return side === '借方' ? '贷方' : '借方';
}

function buildLedgerRows({
  now,
  voucher
}: {
  now: string;
  voucher: AccountingVoucherLifecycleRecord;
}): GeneralLedgerLifecycleRow[] {
  return voucher.lines.map((line, index) => ({
    accountingPeriod: voucher.accountingPeriod,
    auxiliary: line.auxiliary,
    creditAmount: line.side === '贷方' ? line.amount : '0.00',
    createdAt: now,
    debitAmount: line.side === '借方' ? line.amount : '0.00',
    id: `gl-${voucher.id}-${String(index + 1).padStart(3, '0')}`,
    sourceSnapshotHash: voucher.sourceSnapshot.sourceHash,
    sourceVoucherLineId: line.id,
    subjectCode: line.subjectCode,
    subjectName: line.subjectName,
    summary: line.summary,
    voucherDate: voucher.voucherDate,
    voucherId: voucher.id,
    voucherNo: voucher.voucherNo
  }));
}

function replaceVoucher(
  vouchers: AccountingVoucherLifecycleRecord[],
  nextVoucher: AccountingVoucherLifecycleRecord
) {
  return vouchers.map((voucher) => (voucher.id === nextVoucher.id ? cloneVoucher(nextVoucher) : cloneVoucher(voucher)));
}

function guardAccountingVoucherWrite({
  accountingPeriod,
  operation,
  periods,
  requestId,
  sourceId,
  sourceNo
}: {
  accountingPeriod: string;
  operation: string;
  periods: AccountingPeriodRecord[];
  requestId: string;
  sourceId?: string;
  sourceNo?: string;
}) {
  return guardFinanceSourceMutation({
    periods,
    request: {
      accountingPeriods: [accountingPeriod],
      operation,
      requestId,
      sourceArea: 'accounting_voucher',
      sourceId,
      sourceNo
    }
  });
}

export function prepareAccountingVoucher({
  events = [],
  ledgerRows = [],
  lines,
  periods,
  request,
  sourceSnapshot,
  vouchers = []
}: {
  events?: AccountingVoucherLifecycleEvent[];
  ledgerRows?: GeneralLedgerLifecycleRow[];
  lines: AccountingVoucherLifecycleLine[];
  periods: AccountingPeriodRecord[];
  request: PrepareAccountingVoucherRequest;
  sourceSnapshot: AccountingVoucherSourceSnapshot;
  vouchers?: AccountingVoucherLifecycleRecord[];
}): AccountingVoucherLifecycleResult {
  const guard = guardAccountingVoucherWrite({
    accountingPeriod: sourceSnapshot.accountingPeriod,
    operation: '制单会计凭证',
    periods,
    requestId: request.requestId,
    sourceId: sourceSnapshot.sourceId,
    sourceNo: sourceSnapshot.sourceNo
  });

  if (!guard.allowed) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: guard.error.code,
      events,
      ledgerRows,
      message: guard.error.message,
      nextAction: guard.error.nextAction,
      now: request.now,
      period: guard.error.period,
      requestId: request.requestId,
      reason: guard.error.message,
      vouchers
    });
  }

  if (request.expectedSourceHash !== sourceSnapshot.sourceHash) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_SOURCE_CHANGED',
      events,
      ledgerRows,
      message: '来源事实已变化，请重新读取候选凭证后再制单。',
      now: request.now,
      period: sourceSnapshot.accountingPeriod,
      requestId: request.requestId,
      reason: 'source hash mismatch',
      vouchers
    });
  }

  if (!isBalanced(lines)) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_NOT_BALANCED',
      events,
      ledgerRows,
      message: '凭证分录借贷不平，不能制单。',
      now: request.now,
      period: sourceSnapshot.accountingPeriod,
      requestId: request.requestId,
      reason: 'voucher lines are not balanced',
      vouchers
    });
  }

  const sequence = getNextVoucherSequence(vouchers, sourceSnapshot.accountingPeriod);
  const voucher: AccountingVoucherLifecycleRecord = {
    accountingPeriod: sourceSnapshot.accountingPeriod,
    amount: getVoucherAmount(lines),
    businessType: sourceSnapshot.businessType,
    id: buildVoucherId(sourceSnapshot.accountingPeriod, sequence),
    lines: lines.map(cloneLine),
    preparedAt: request.now,
    preparedBySnapshot: { ...request.actorSnapshot },
    sourceSnapshot: cloneSourceSnapshot(sourceSnapshot),
    status: '已制单',
    version: 1,
    voucherDate: sourceSnapshot.voucherDate,
    voucherNo: buildVoucherNo({
      accountingPeriod: sourceSnapshot.accountingPeriod,
      businessType: sourceSnapshot.businessType,
      vouchers
    })
  };
  const event: AccountingVoucherLifecycleEvent = {
    actorSnapshot: { ...request.actorSnapshot },
    eventType: 'voucher_prepared',
    requestId: request.requestId,
    timestamp: request.now,
    voucherId: voucher.id,
    voucherNo: voucher.voucherNo
  };
  const nextVouchers = [...vouchers.map(cloneVoucher), voucher];

  return {
    events: [...events.map(cloneEvent), event],
    ledgerRows: ledgerRows.map(cloneLedgerRow),
    ok: true,
    replayed: false,
    voucher: cloneVoucher(voucher),
    vouchers: nextVouchers
  };
}

export function bookAccountingVoucher({
  events = [],
  ledgerRows = [],
  periods,
  request,
  voucherId,
  vouchers = []
}: {
  events?: AccountingVoucherLifecycleEvent[];
  ledgerRows?: GeneralLedgerLifecycleRow[];
  periods: AccountingPeriodRecord[];
  request: BookAccountingVoucherRequest;
  voucherId: string;
  vouchers?: AccountingVoucherLifecycleRecord[];
}): AccountingVoucherLifecycleResult {
  const voucher = vouchers.find((record) => record.id === voucherId);

  if (!voucher) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_NOT_FOUND',
      events,
      ledgerRows,
      message: '会计凭证不存在。',
      now: request.now,
      requestId: request.requestId,
      vouchers
    });
  }

  const guard = guardAccountingVoucherWrite({
    accountingPeriod: voucher.accountingPeriod,
    operation: '记账会计凭证',
    periods,
    requestId: request.requestId,
    sourceId: voucher.id,
    sourceNo: voucher.voucherNo
  });

  if (!guard.allowed) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: guard.error.code,
      events,
      ledgerRows,
      message: guard.error.message,
      nextAction: guard.error.nextAction,
      now: request.now,
      period: guard.error.period,
      requestId: request.requestId,
      reason: guard.error.message,
      voucher,
      vouchers
    });
  }

  const existingLedgerRows = ledgerRows.filter((row) => row.voucherId === voucher.id);

  if (voucher.status === '已记账') {
    return {
      events: events.map(cloneEvent),
      ledgerRows: ledgerRows.map(cloneLedgerRow),
      ok: true,
      replayed: true,
      voucher: cloneVoucher(voucher),
      vouchers: vouchers.map(cloneVoucher)
    };
  }

  if (voucher.status !== '已制单') {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_NOT_PREPARED',
      events,
      ledgerRows,
      message: '只有已制单且未记账的凭证可以记账。',
      now: request.now,
      requestId: request.requestId,
      voucher,
      vouchers
    });
  }

  if (existingLedgerRows.length > 0) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'LEDGER_ENTRY_ALREADY_EXISTS',
      events,
      ledgerRows,
      message: '该凭证已存在总账分录，不能重复写入。',
      now: request.now,
      requestId: request.requestId,
      voucher,
      vouchers
    });
  }

  const bookedVoucher: AccountingVoucherLifecycleRecord = {
    ...cloneVoucher(voucher),
    bookedAt: request.now,
    bookedBySnapshot: { ...request.actorSnapshot },
    status: '已记账',
    version: voucher.version + 1
  };
  const event: AccountingVoucherLifecycleEvent = {
    actorSnapshot: { ...request.actorSnapshot },
    eventType: 'voucher_booked',
    requestId: request.requestId,
    timestamp: request.now,
    voucherId: bookedVoucher.id,
    voucherNo: bookedVoucher.voucherNo
  };
  const nextLedgerRows = [...ledgerRows.map(cloneLedgerRow), ...buildLedgerRows({ now: request.now, voucher: bookedVoucher })];
  const nextVouchers = replaceVoucher(vouchers, bookedVoucher);

  return {
    events: [...events.map(cloneEvent), event],
    ledgerRows: nextLedgerRows,
    ok: true,
    replayed: false,
    voucher: cloneVoucher(bookedVoucher),
    vouchers: nextVouchers
  };
}

export function reverseAccountingVoucher({
  events = [],
  ledgerRows = [],
  periods,
  request,
  voucherId,
  vouchers = []
}: {
  events?: AccountingVoucherLifecycleEvent[];
  ledgerRows?: GeneralLedgerLifecycleRow[];
  periods: AccountingPeriodRecord[];
  request: ReverseAccountingVoucherRequest;
  voucherId: string;
  vouchers?: AccountingVoucherLifecycleRecord[];
}): AccountingVoucherLifecycleResult {
  const originalVoucher = vouchers.find((record) => record.id === voucherId);

  if (!originalVoucher) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_NOT_FOUND',
      events,
      ledgerRows,
      message: '会计凭证不存在。',
      now: request.now,
      requestId: request.requestId,
      vouchers
    });
  }

  const guard = guardAccountingVoucherWrite({
    accountingPeriod: originalVoucher.accountingPeriod,
    operation: '冲销会计凭证',
    periods,
    requestId: request.requestId,
    sourceId: originalVoucher.id,
    sourceNo: originalVoucher.voucherNo
  });

  if (!guard.allowed) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: guard.error.code,
      events,
      ledgerRows,
      message: guard.error.message,
      nextAction: guard.error.nextAction,
      now: request.now,
      period: guard.error.period,
      requestId: request.requestId,
      reason: guard.error.message,
      voucher: originalVoucher,
      vouchers
    });
  }

  const reason = request.reason.trim();

  if (!reason) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'INVALID_VOUCHER_REQUEST',
      events,
      ledgerRows,
      message: '冲销原因不能为空。',
      now: request.now,
      requestId: request.requestId,
      voucher: originalVoucher,
      vouchers
    });
  }

  if (originalVoucher.reversalOfVoucherId) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_IS_REVERSAL',
      events,
      ledgerRows,
      message: '冲销凭证不能再次冲销。',
      now: request.now,
      requestId: request.requestId,
      voucher: originalVoucher,
      vouchers
    });
  }

  if (originalVoucher.status !== '已记账') {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_NOT_BOOKED',
      events,
      ledgerRows,
      message: '只有已记账凭证可以冲销。',
      now: request.now,
      requestId: request.requestId,
      voucher: originalVoucher,
      vouchers
    });
  }

  if (originalVoucher.reversedByVoucherId) {
    return createFailure({
      actorSnapshot: request.actorSnapshot,
      code: 'VOUCHER_ALREADY_REVERSED',
      events,
      ledgerRows,
      message: '该凭证已经存在冲销凭证。',
      now: request.now,
      requestId: request.requestId,
      voucher: originalVoucher,
      vouchers
    });
  }

  const sequence = getNextVoucherSequence(vouchers, originalVoucher.accountingPeriod);
  const sourceSnapshot: AccountingVoucherSourceSnapshot = {
    accountingPeriod: originalVoucher.accountingPeriod,
    amount: originalVoucher.amount,
    businessType: '调整凭证',
    sourceHash: createStableSnapshotHash({
      originalVoucherId: originalVoucher.id,
      reason,
      reversalAt: request.now
    }),
    sourceId: originalVoucher.id,
    sourceModule: '会计凭证',
    sourceNo: originalVoucher.voucherNo,
    sourceTitle: `冲销 ${originalVoucher.sourceSnapshot.sourceTitle}`,
    sourceVersion: originalVoucher.version,
    voucherDate: originalVoucher.voucherDate
  };
  const reversalVoucher: AccountingVoucherLifecycleRecord = {
    accountingPeriod: originalVoucher.accountingPeriod,
    amount: originalVoucher.amount,
    bookedAt: request.now,
    bookedBySnapshot: { ...request.actorSnapshot },
    businessType: '冲销凭证',
    id: buildVoucherId(originalVoucher.accountingPeriod, sequence),
    lines: originalVoucher.lines.map((line, index) => ({
      ...line,
      id: `reversal-${originalVoucher.id}-line-${index + 1}`,
      side: getOppositeLineSide(line.side),
      summary: `冲销：${line.summary}`
    })),
    preparedAt: request.now,
    preparedBySnapshot: { ...request.actorSnapshot },
    reversalOfVoucherId: originalVoucher.id,
    sourceSnapshot,
    status: '已记账',
    version: 1,
    voucherDate: originalVoucher.voucherDate,
    voucherNo: buildVoucherNo({
      accountingPeriod: originalVoucher.accountingPeriod,
      businessType: '冲销凭证',
      vouchers
    })
  };
  const reversedOriginalVoucher: AccountingVoucherLifecycleRecord = {
    ...cloneVoucher(originalVoucher),
    reversedAt: request.now,
    reversedBySnapshot: { ...request.actorSnapshot },
    reversedByVoucherId: reversalVoucher.id,
    status: '已冲销',
    version: originalVoucher.version + 1
  };
  const event: AccountingVoucherLifecycleEvent = {
    actorSnapshot: { ...request.actorSnapshot },
    eventType: 'voucher_reversed',
    reason,
    requestId: request.requestId,
    timestamp: request.now,
    voucherId: originalVoucher.id,
    voucherNo: originalVoucher.voucherNo
  };
  const nextVouchers = [...replaceVoucher(vouchers, reversedOriginalVoucher), reversalVoucher];
  const nextLedgerRows = [
    ...ledgerRows.map(cloneLedgerRow),
    ...buildLedgerRows({ now: request.now, voucher: reversalVoucher })
  ];

  return {
    events: [...events.map(cloneEvent), event],
    ledgerRows: nextLedgerRows,
    ok: true,
    replayed: false,
    voucher: cloneVoucher(reversalVoucher),
    vouchers: nextVouchers
  };
}
