import {
  canonicalClosedAccountingPeriodErrorCode,
  createStableSnapshotHash,
  type AccountingPeriodRecord
} from './periodCloseContract.js';
import {
  bookAccountingVoucher,
  prepareAccountingVoucher,
  reverseAccountingVoucher,
  type AccountingVoucherLifecycleLine,
  type AccountingVoucherLifecycleRecord,
  type AccountingVoucherSourceSnapshot,
  type GeneralLedgerLifecycleRow
} from './accountingVoucherLifecycleContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createPeriod(period: string, status: AccountingPeriodRecord['status']): AccountingPeriodRecord {
  return {
    period,
    status,
    version: 1
  };
}

function createSourceSnapshot(overrides: Partial<AccountingVoucherSourceSnapshot> = {}): AccountingVoucherSourceSnapshot {
  const base = {
    accountingPeriod: '2026-06',
    amount: '68000.00',
    businessType: '权责凭证' as const,
    sourceId: 'ar-202606-001',
    sourceModule: '应收应付',
    sourceNo: 'AR-202606-001',
    sourceTitle: '奈雪华南门店设计服务合同',
    sourceVersion: 3,
    voucherDate: '2026-06-10'
  };

  return {
    ...base,
    sourceHash: createStableSnapshotHash(base),
    ...overrides
  };
}

function createVoucherLines(overrides: Partial<AccountingVoucherLifecycleLine>[] = []): AccountingVoucherLifecycleLine[] {
  const lines: AccountingVoucherLifecycleLine[] = [
    {
      amount: '68000.00',
      auxiliary: '奈雪华南区域',
      id: 'line-debit',
      side: '借方',
      subjectCode: '1122',
      subjectName: '应收账款',
      summary: '客户回款确认'
    },
    {
      amount: '68000.00',
      auxiliary: 'CON-2026-001',
      id: 'line-credit',
      side: '贷方',
      subjectCode: '5001',
      subjectName: '主营业务收入',
      summary: '客户回款确认'
    }
  ];

  return lines.map((line, index) => ({
    ...line,
    ...(overrides[index] ?? {})
  }));
}

function prepareOpenVoucher() {
  const sourceSnapshot = createSourceSnapshot();

  return prepareAccountingVoucher({
    lines: createVoucherLines(),
    periods: [createPeriod('2026-06', '开放')],
    request: {
      actorSnapshot: { id: 'user-001', name: '李明' },
      expectedSourceHash: sourceSnapshot.sourceHash,
      idempotencyKey: 'idem-prepare-001',
      now: '2026-06-10T10:00:00+08:00',
      requestId: 'req-prepare-001'
    },
    sourceSnapshot
  });
}

function bookOpenVoucher(voucher: AccountingVoucherLifecycleRecord, ledgerRows: GeneralLedgerLifecycleRow[] = []) {
  return bookAccountingVoucher({
    ledgerRows,
    periods: [createPeriod('2026-06', '开放')],
    request: {
      actorSnapshot: { id: 'user-001', name: '李明' },
      idempotencyKey: 'idem-book-001',
      now: '2026-06-10T10:10:00+08:00',
      requestId: 'req-book-001'
    },
    voucherId: voucher.id,
    vouchers: [voucher]
  });
}

const tests: UnitTest[] = [
  {
    name: 'prepare freezes source snapshot and creates formal unbooked voucher number',
    run: () => {
      const sourceSnapshot = createSourceSnapshot();
      const result = prepareAccountingVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06', '开放')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-prepare-freeze',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-prepare-freeze'
        },
        sourceSnapshot
      });

      assertEqual(result.ok, true, 'prepare should pass for open period and balanced lines');

      if (!result.ok) {
        return;
      }

      sourceSnapshot.sourceTitle = 'source changed after prepare';
      assertEqual(result.voucher.status, '已制单', 'prepared voucher should not be booked automatically');
      assertEqual(result.voucher.voucherNo, '记-202606-001', 'prepare should assign formal voucher number');
      assertEqual(result.voucher.sourceSnapshot.sourceTitle, '奈雪华南门店设计服务合同', 'prepared voucher should freeze source snapshot');
      assertEqual(result.ledgerRows.length, 0, 'prepare should not write general ledger rows');
      assertEqual(result.voucher.preparedBySnapshot.name, '李明', 'prepare actor should be server-owned snapshot');
    }
  },
  {
    name: 'prepare rejects stale source hash and unbalanced lines',
    run: () => {
      const sourceSnapshot = createSourceSnapshot();
      const stale = prepareAccountingVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06', '开放')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: 'chk_stale',
          idempotencyKey: 'idem-prepare-stale',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-prepare-stale'
        },
        sourceSnapshot
      });
      const unbalanced = prepareAccountingVoucher({
        lines: createVoucherLines([{ amount: '67000.00' }]),
        periods: [createPeriod('2026-06', '开放')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-prepare-unbalanced',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-prepare-unbalanced'
        },
        sourceSnapshot
      });

      assertEqual(stale.ok, false, 'stale source hash should reject prepare');
      assertEqual(stale.ok ? '' : stale.error.code, 'VOUCHER_SOURCE_CHANGED', 'stale source hash should use stable code');
      assertEqual(unbalanced.ok, false, 'unbalanced lines should reject prepare');
      assertEqual(unbalanced.ok ? '' : unbalanced.error.code, 'VOUCHER_NOT_BALANCED', 'unbalanced lines should use stable code');
    }
  },
  {
    name: 'book writes one general ledger row per line and replay does not duplicate rows',
    run: () => {
      const prepared = prepareOpenVoucher();

      assertEqual(prepared.ok, true, 'fixture prepare should pass');

      if (!prepared.ok) {
        return;
      }

      const booked = bookOpenVoucher(prepared.voucher);

      assertEqual(booked.ok, true, 'book should pass for prepared voucher');

      if (!booked.ok) {
        return;
      }

      const replay = bookOpenVoucher(booked.voucher, booked.ledgerRows);

      assertEqual(booked.voucher.status, '已记账', 'book should move voucher to booked status');
      assertEqual(booked.ledgerRows.length, 2, 'book should write exactly one ledger row per voucher line');
      assertEqual(booked.ledgerRows[0]?.debitAmount, '68000.00', 'debit line should write debit amount');
      assertEqual(booked.ledgerRows[1]?.creditAmount, '68000.00', 'credit line should write credit amount');
      assertEqual(replay.ok, true, 'replaying a booked voucher should be safe');
      assertEqual(replay.ok ? replay.replayed : false, true, 'book replay should be marked');
      assertEqual(replay.ledgerRows.length, 2, 'book replay should not duplicate ledger rows');
    }
  },
  {
    name: 'reverse open-period booked voucher creates linked reversal voucher and keeps original evidence',
    run: () => {
      const prepared = prepareOpenVoucher();

      if (!prepared.ok) {
        throw new Error('fixture prepare should pass');
      }

      const booked = bookOpenVoucher(prepared.voucher);

      if (!booked.ok) {
        throw new Error('fixture book should pass');
      }

      const reversed = reverseAccountingVoucher({
        ledgerRows: booked.ledgerRows,
        periods: [createPeriod('2026-06', '开放')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-reverse-001',
          now: '2026-06-11T09:00:00+08:00',
          reason: '开放期间发现确认口径错误，需要冲销重做',
          requestId: 'req-reverse-001'
        },
        voucherId: booked.voucher.id,
        vouchers: [booked.voucher]
      });

      assertEqual(reversed.ok, true, 'open-period booked voucher should allow reversal');

      if (!reversed.ok) {
        return;
      }

      const original = reversed.vouchers.find((voucher) => voucher.id === booked.voucher.id);

      assertEqual(reversed.voucher.businessType, '冲销凭证', 'reversal should create reversal voucher');
      assertEqual(reversed.voucher.status, '已记账', 'reversal action should book reversal voucher');
      assertEqual(reversed.voucher.reversalOfVoucherId, booked.voucher.id, 'reversal voucher should link original voucher');
      assertEqual(original?.status, '已冲销', 'original voucher should be marked reversed in open period');
      assertEqual(original?.reversedByVoucherId, reversed.voucher.id, 'original voucher should link reversal voucher');
      assertEqual(reversed.ledgerRows.length, 4, 'reversal should append opposite ledger rows without deleting original rows');
      assertEqual(reversed.ledgerRows[2]?.creditAmount, '68000.00', 'reversal first row should be opposite side');
    }
  },
  {
    name: 'closed period blocks prepare, book, and direct reversal with canonical error',
    run: () => {
      const sourceSnapshot = createSourceSnapshot();
      const closedPrepared = prepareAccountingVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06', '已结账')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-prepare-closed',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-prepare-closed'
        },
        sourceSnapshot
      });
      const openPrepared = prepareOpenVoucher();

      if (!openPrepared.ok) {
        throw new Error('fixture prepare should pass');
      }

      const booked = bookOpenVoucher(openPrepared.voucher);

      if (!booked.ok) {
        throw new Error('fixture book should pass');
      }

      const closedBook = bookAccountingVoucher({
        periods: [createPeriod('2026-06', '已结账')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-book-closed',
          now: '2026-06-10T10:10:00+08:00',
          requestId: 'req-book-closed'
        },
        voucherId: openPrepared.voucher.id,
        vouchers: [openPrepared.voucher]
      });
      const closedReverse = reverseAccountingVoucher({
        ledgerRows: booked.ledgerRows,
        periods: [createPeriod('2026-06', '已结账')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-reverse-closed',
          now: '2026-06-11T09:00:00+08:00',
          reason: '历史期间需要修正',
          requestId: 'req-reverse-closed'
        },
        voucherId: booked.voucher.id,
        vouchers: [booked.voucher]
      });

      assertEqual(closedPrepared.ok, false, 'closed period should block prepare');
      assertEqual(closedPrepared.ok ? '' : closedPrepared.error.code, canonicalClosedAccountingPeriodErrorCode, 'closed prepare should use canonical error');
      assertEqual(closedBook.ok, false, 'closed period should block book');
      assertEqual(closedBook.ok ? '' : closedBook.error.code, canonicalClosedAccountingPeriodErrorCode, 'closed book should use canonical error');
      assertEqual(closedReverse.ok, false, 'closed period should block direct reversal');
      assertEqual(closedReverse.ok ? '' : closedReverse.error.code, canonicalClosedAccountingPeriodErrorCode, 'closed reversal should use canonical error');
      assertEqual(closedReverse.ok ? '' : closedReverse.error.nextAction, '后续期间调整', 'closed reversal should point to later-period adjustment');
    }
  }
];

for (const test of tests) {
  test.run();
}
