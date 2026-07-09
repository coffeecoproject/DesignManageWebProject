import type { AccountingPeriodRecord } from './periodCloseContract.js';
import type { AccountingPeriodVoucherCountSourceRow } from './periodCloseVoucherSummaryContract.js';
import {
  bookAccountingVoucher,
  prepareAccountingVoucher,
  reverseAccountingVoucher,
  type AccountingVoucherLifecycleEvent,
  type AccountingVoucherLifecycleLine,
  type AccountingVoucherLifecycleRecord,
  type AccountingVoucherLifecycleResult,
  type AccountingVoucherSourceSnapshot,
  type BookAccountingVoucherRequest,
  type GeneralLedgerLifecycleRow,
  type PrepareAccountingVoucherRequest,
  type ReverseAccountingVoucherRequest
} from './accountingVoucherLifecycleContract.js';

export type AccountingVoucherLedgerRepositoryIdempotencyOperation =
  | 'book_voucher'
  | 'prepare_voucher'
  | 'reverse_voucher';

export type AccountingVoucherLedgerRepositoryIdempotencyRecord = {
  idempotencyKey: string;
  operation: AccountingVoucherLedgerRepositoryIdempotencyOperation;
  requestSignature: string;
  voucherId: string;
};

export type AccountingVoucherLedgerRepositoryState = {
  events: AccountingVoucherLifecycleEvent[];
  idempotencyRecords: AccountingVoucherLedgerRepositoryIdempotencyRecord[];
  ledgerRows: GeneralLedgerLifecycleRow[];
  voucherRows: AccountingPeriodVoucherCountSourceRow[];
  vouchers: AccountingVoucherLifecycleRecord[];
};

export type AccountingVoucherLedgerRepositorySnapshot = AccountingVoucherLedgerRepositoryState;

export type AccountingVoucherLedgerRepository = {
  bookVoucher: (input: {
    periods: AccountingPeriodRecord[];
    request: BookAccountingVoucherRequest;
    voucherId: string;
  }) => AccountingVoucherLifecycleResult;
  prepareVoucher: (input: {
    lines: AccountingVoucherLifecycleLine[];
    periods: AccountingPeriodRecord[];
    request: PrepareAccountingVoucherRequest;
    sourceSnapshot: AccountingVoucherSourceSnapshot;
  }) => AccountingVoucherLifecycleResult;
  readLedgerRows: (accountingPeriod?: string) => GeneralLedgerLifecycleRow[];
  readSnapshot: () => AccountingVoucherLedgerRepositorySnapshot;
  reverseVoucher: (input: {
    periods: AccountingPeriodRecord[];
    request: ReverseAccountingVoucherRequest;
    voucherId: string;
  }) => AccountingVoucherLifecycleResult;
};

type RepositoryFailureInput = {
  code: 'IDEMPOTENCY_KEY_REUSED' | 'VOUCHER_NOT_FOUND';
  message: string;
  now: string;
  request: {
    actorSnapshot: BookAccountingVoucherRequest['actorSnapshot'];
    requestId: string;
  };
  state: AccountingVoucherLedgerRepositoryState;
  voucherId?: string;
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

function cloneVoucher(record: AccountingVoucherLifecycleRecord): AccountingVoucherLifecycleRecord {
  return {
    ...record,
    bookedBySnapshot: record.bookedBySnapshot ? { ...record.bookedBySnapshot } : undefined,
    lines: record.lines.map((line) => ({ ...line })),
    preparedBySnapshot: { ...record.preparedBySnapshot },
    reversedBySnapshot: record.reversedBySnapshot ? { ...record.reversedBySnapshot } : undefined,
    sourceSnapshot: { ...record.sourceSnapshot }
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

function cloneIdempotencyRecord(
  record: AccountingVoucherLedgerRepositoryIdempotencyRecord
): AccountingVoucherLedgerRepositoryIdempotencyRecord {
  return { ...record };
}

function cloneState(state: AccountingVoucherLedgerRepositoryState): AccountingVoucherLedgerRepositoryState {
  return {
    events: state.events.map(cloneEvent),
    idempotencyRecords: state.idempotencyRecords.map(cloneIdempotencyRecord),
    ledgerRows: state.ledgerRows.map(cloneLedgerRow),
    voucherRows: state.voucherRows.map((row) => ({ ...row })),
    vouchers: state.vouchers.map(cloneVoucher)
  };
}

function createInitialState(
  initialState: Partial<AccountingVoucherLedgerRepositoryState> = {}
): AccountingVoucherLedgerRepositoryState {
  return {
    events: initialState.events?.map(cloneEvent) ?? [],
    idempotencyRecords: initialState.idempotencyRecords?.map(cloneIdempotencyRecord) ?? [],
    ledgerRows: initialState.ledgerRows?.map(cloneLedgerRow) ?? [],
    voucherRows: initialState.voucherRows?.map((row) => ({ ...row })) ?? [],
    vouchers: initialState.vouchers?.map(cloneVoucher) ?? []
  };
}

function createPrepareSignature({
  lines,
  request,
  sourceSnapshot
}: {
  lines: AccountingVoucherLifecycleLine[];
  request: PrepareAccountingVoucherRequest;
  sourceSnapshot: AccountingVoucherSourceSnapshot;
}) {
  return stableStringify({
    expectedSourceHash: request.expectedSourceHash,
    lines,
    sourceSnapshot
  });
}

function createVoucherActionSignature({
  reason,
  voucherId
}: {
  reason?: string;
  voucherId: string;
}) {
  return stableStringify({
    reason: reason?.trim(),
    voucherId
  });
}

function createRepositoryFailure({
  code,
  message,
  now,
  request,
  state,
  voucherId
}: RepositoryFailureInput): AccountingVoucherLifecycleResult {
  const event: AccountingVoucherLifecycleEvent = {
    actorSnapshot: { ...request.actorSnapshot },
    eventType: 'voucher_action_rejected',
    reason: message,
    requestId: request.requestId,
    timestamp: now,
    voucherId
  };
  const nextState = cloneState({
    ...state,
    events: [...state.events, event]
  });

  return {
    error: {
      code,
      message,
      requestId: request.requestId,
      voucherId
    },
    event,
    events: nextState.events,
    ledgerRows: nextState.ledgerRows,
    ok: false,
    voucher: voucherId ? nextState.vouchers.find((voucher) => voucher.id === voucherId) : undefined,
    vouchers: nextState.vouchers
  };
}

function replayVoucherResult({
  state,
  voucherId
}: {
  state: AccountingVoucherLedgerRepositoryState;
  voucherId: string;
}): AccountingVoucherLifecycleResult {
  const snapshot = cloneState(state);
  const voucher = snapshot.vouchers.find((record) => record.id === voucherId);

  if (!voucher) {
    throw new Error(`Missing voucher ${voucherId} for idempotent replay`);
  }

  return {
    events: snapshot.events,
    ledgerRows: snapshot.ledgerRows,
    ok: true,
    replayed: true,
    voucher,
    vouchers: snapshot.vouchers
  };
}

function findIdempotencyRecord({
  idempotencyKey,
  operation,
  state
}: {
  idempotencyKey: string;
  operation: AccountingVoucherLedgerRepositoryIdempotencyOperation;
  state: AccountingVoucherLedgerRepositoryState;
}) {
  return state.idempotencyRecords.find(
    (record) => record.idempotencyKey === idempotencyKey && record.operation === operation
  );
}

function syncVoucherRowsFromVouchers({
  voucherRows,
  vouchers
}: {
  voucherRows: AccountingPeriodVoucherCountSourceRow[];
  vouchers: AccountingVoucherLifecycleRecord[];
}) {
  return vouchers.reduce(
    (rows, voucher) => {
      const sourceCandidateId = voucher.sourceSnapshot.sourceId.startsWith('candidate-later-adjustment-')
        ? voucher.sourceSnapshot.sourceId
        : undefined;
      const nextRow: AccountingPeriodVoucherCountSourceRow = {
        accountingPeriod: voucher.accountingPeriod,
        id: voucher.id,
        sourceModule: '会计凭证',
        sourceNo: voucher.voucherNo,
        status: voucher.status
      };

      return [
        nextRow,
        ...rows.filter((row) => row.id !== voucher.id && row.id !== sourceCandidateId)
      ];
    },
    voucherRows.map((row) => ({ ...row }))
  );
}

function commitLifecycleResult({
  idempotencyKey,
  operation,
  requestSignature,
  result,
  state
}: {
  idempotencyKey: string;
  operation: AccountingVoucherLedgerRepositoryIdempotencyOperation;
  requestSignature: string;
  result: AccountingVoucherLifecycleResult;
  state: AccountingVoucherLedgerRepositoryState;
}) {
  if (!result.ok) {
    state.events = result.events.map(cloneEvent);
    state.ledgerRows = result.ledgerRows.map(cloneLedgerRow);
    state.vouchers = result.vouchers.map(cloneVoucher);
    return;
  }

  state.events = result.events.map(cloneEvent);
  state.ledgerRows = result.ledgerRows.map(cloneLedgerRow);
  state.vouchers = result.vouchers.map(cloneVoucher);
  state.voucherRows = syncVoucherRowsFromVouchers({
    voucherRows: state.voucherRows,
    vouchers: result.vouchers
  });
  state.idempotencyRecords = [
    ...state.idempotencyRecords.map(cloneIdempotencyRecord),
    {
      idempotencyKey,
      operation,
      requestSignature,
      voucherId: result.voucher.id
    }
  ];
}

export function createAccountingVoucherLedgerRepository(
  initialState: Partial<AccountingVoucherLedgerRepositoryState> = {}
): AccountingVoucherLedgerRepository {
  const state = createInitialState(initialState);

  return {
    bookVoucher({ periods, request, voucherId }) {
      const requestSignature = createVoucherActionSignature({ voucherId });
      const existingRecord = findIdempotencyRecord({
        idempotencyKey: request.idempotencyKey,
        operation: 'book_voucher',
        state
      });

      if (existingRecord) {
        if (existingRecord.requestSignature !== requestSignature) {
          return createRepositoryFailure({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: '幂等键已被不同记账请求使用。',
            now: request.now,
            request,
            state,
            voucherId
          });
        }

        return replayVoucherResult({ state, voucherId: existingRecord.voucherId });
      }

      const result = bookAccountingVoucher({
        events: state.events,
        ledgerRows: state.ledgerRows,
        periods,
        request,
        voucherId,
        vouchers: state.vouchers
      });

      commitLifecycleResult({
        idempotencyKey: request.idempotencyKey,
        operation: 'book_voucher',
        requestSignature,
        result,
        state
      });

      return result;
    },
    prepareVoucher({ lines, periods, request, sourceSnapshot }) {
      const requestSignature = createPrepareSignature({ lines, request, sourceSnapshot });
      const existingRecord = findIdempotencyRecord({
        idempotencyKey: request.idempotencyKey,
        operation: 'prepare_voucher',
        state
      });

      if (existingRecord) {
        if (existingRecord.requestSignature !== requestSignature) {
          return createRepositoryFailure({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: '幂等键已被不同制单请求使用。',
            now: request.now,
            request,
            state,
            voucherId: existingRecord.voucherId
          });
        }

        return replayVoucherResult({ state, voucherId: existingRecord.voucherId });
      }

      const result = prepareAccountingVoucher({
        events: state.events,
        ledgerRows: state.ledgerRows,
        lines,
        periods,
        request,
        sourceSnapshot,
        vouchers: state.vouchers
      });

      commitLifecycleResult({
        idempotencyKey: request.idempotencyKey,
        operation: 'prepare_voucher',
        requestSignature,
        result,
        state
      });

      return result;
    },
    readLedgerRows(accountingPeriod) {
      return state.ledgerRows
        .filter((row) => !accountingPeriod || row.accountingPeriod === accountingPeriod)
        .map(cloneLedgerRow);
    },
    readSnapshot() {
      return cloneState(state);
    },
    reverseVoucher({ periods, request, voucherId }) {
      const requestSignature = createVoucherActionSignature({
        reason: request.reason,
        voucherId
      });
      const existingRecord = findIdempotencyRecord({
        idempotencyKey: request.idempotencyKey,
        operation: 'reverse_voucher',
        state
      });

      if (existingRecord) {
        if (existingRecord.requestSignature !== requestSignature) {
          return createRepositoryFailure({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: '幂等键已被不同冲销请求使用。',
            now: request.now,
            request,
            state,
            voucherId
          });
        }

        return replayVoucherResult({ state, voucherId: existingRecord.voucherId });
      }

      const result = reverseAccountingVoucher({
        events: state.events,
        ledgerRows: state.ledgerRows,
        periods,
        request,
        voucherId,
        vouchers: state.vouchers
      });

      commitLifecycleResult({
        idempotencyKey: request.idempotencyKey,
        operation: 'reverse_voucher',
        requestSignature,
        result,
        state
      });

      return result;
    }
  };
}
