import {
  createStableSnapshotHash,
  requiredCloseCheckCodes,
  type AccountingPeriodRecord,
  type CloseCheckRow
} from './periodCloseContract.js';
import { createAccountingVoucherLedgerRepository } from './accountingVoucherLedgerRepositoryContract.js';
import type {
  AccountingVoucherLifecycleLine,
  AccountingVoucherSourceSnapshot
} from './accountingVoucherLifecycleContract.js';
import {
  handleFinanceHttpApiRepositoryGateway
} from './financeHttpApiRepositoryGatewayContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import { createRowBackedPeriodCloseRepository } from './periodCloseDatabaseRepositoryContract.js';
import type { AccountingPeriodVoucherCountSourceRow } from './periodCloseVoucherSummaryContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord
} from './periodClosePersistenceContract.js';

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

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(message);
  }
}

function createPeriod(
  period: string,
  status: AccountingPeriodRecord['status'] = '开放'
): PersistentAccountingPeriodRecord {
  return {
    period,
    status,
    version: 1
  };
}

function createCloseChecks(): CloseCheckRow[] {
  return requiredCloseCheckCodes.map((code) => ({
    blockerCount: 0,
    canPass: true,
    code,
    label: code,
    sources: [],
    status: '通过',
    summary: '检查通过。'
  }));
}

function createPeriodCloseState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {
      '2026-06': {
        checks: createCloseChecks(),
        computedAt: '2026-06-30T20:00:00+08:00',
        sourceVersionSetHash: 'src-accounting-voucher-ledger-repository-202606',
        trialBalance: {
          creditTotal: '68000.00',
          debitTotal: '68000.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    },
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [createPeriod('2026-06')],
    sourceMutationEvents: [],
    sourceRecords: [],
    ...overrides
  };
}

function headers(overrides: Record<string, string> = {}) {
  return {
    'x-actor-id': 'user-001',
    'x-actor-name': '李明',
    'x-permission-scopes': financePeriodClosePermissionScopes.join(','),
    'x-request-id': 'req-accounting-voucher-ledger-repository',
    'x-request-time': '2026-06-30T20:00:00+08:00',
    ...overrides
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

function readCloseChecksFromVoucherRows(voucherRows: AccountingPeriodVoucherCountSourceRow[]) {
  const repository = createRowBackedPeriodCloseRepository({
    fallbackNow: '2026-06-30T20:00:00+08:00',
    initialState: createPeriodCloseState({ voucherRows })
  });

  return handleFinanceHttpApiRepositoryGateway({
    repository,
    request: {
      headers: headers(),
      method: 'GET',
      path: '/api/finance/accounting-periods/2026-06/close-checks'
    }
  });
}

const tests: UnitTest[] = [
  {
    name: 'persists prepare and book lifecycle through voucher ledger repository',
    run: () => {
      const repository = createAccountingVoucherLedgerRepository();
      const sourceSnapshot = createSourceSnapshot();
      const prepared = repository.prepareVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-repository-prepare',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-repository-prepare'
        },
        sourceSnapshot
      });

      assertEqual(prepared.ok, true, 'repository prepare should succeed');

      if (!prepared.ok) {
        return;
      }

      const preparedSnapshot = repository.readSnapshot();
      const preparedCloseChecks = readCloseChecksFromVoucherRows(preparedSnapshot.voucherRows);

      assertEqual(preparedSnapshot.vouchers.length, 1, 'repository should persist prepared voucher');
      assertEqual(preparedSnapshot.ledgerRows.length, 0, 'prepare should not persist ledger rows');
      assertEqual(preparedSnapshot.voucherRows[0]?.status, '已制单', 'voucher row should show prepared status');
      assertEqual(preparedSnapshot.idempotencyRecords.length, 1, 'prepare should persist idempotency record');
      assertEqual(preparedCloseChecks.status, 200, 'prepared close checks should be readable');
      assertObject(preparedCloseChecks.body, 'prepared close checks response should be an object');
      assertEqual(preparedCloseChecks.body.canClose, false, 'prepared but unbooked voucher should block close checks');

      const preparedRows = preparedCloseChecks.body.checks;
      assert(Array.isArray(preparedRows), 'close checks should include rows');
      const bookingCheck = preparedRows.find(
        (row): row is Record<string, unknown> =>
          Boolean(row && typeof row === 'object' && 'code' in row && row.code === 'voucher_booking')
      );

      assertObject(bookingCheck, 'voucher booking close check should exist');
      assertEqual(bookingCheck.status, '阻断', 'prepared voucher should block voucher booking');

      const prepareReplay = repository.prepareVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-repository-prepare',
          now: '2026-06-10T10:05:00+08:00',
          requestId: 'req-repository-prepare-replay'
        },
        sourceSnapshot
      });
      const conflictingPrepare = repository.prepareVoucher({
        lines: createVoucherLines([{ amount: '67000.00' }]),
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-repository-prepare',
          now: '2026-06-10T10:06:00+08:00',
          requestId: 'req-repository-prepare-conflict'
        },
        sourceSnapshot
      });

      assertEqual(prepareReplay.ok, true, 'matching prepare idempotency replay should succeed');
      assertEqual(prepareReplay.ok ? prepareReplay.replayed : false, true, 'matching prepare replay should be marked');
      assertEqual(conflictingPrepare.ok, false, 'same prepare key with different request should reject');
      assertEqual(
        conflictingPrepare.ok ? '' : conflictingPrepare.error.code,
        'IDEMPOTENCY_KEY_REUSED',
        'prepare key reuse should use stable code'
      );
      assertEqual(repository.readSnapshot().vouchers.length, 1, 'prepare replay/conflict should not duplicate vouchers');

      const booked = repository.bookVoucher({
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-repository-book',
          now: '2026-06-10T10:10:00+08:00',
          requestId: 'req-repository-book'
        },
        voucherId: prepared.voucher.id
      });

      assertEqual(booked.ok, true, 'repository book should succeed');

      if (!booked.ok) {
        return;
      }

      const bookReplay = repository.bookVoucher({
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-repository-book',
          now: '2026-06-10T10:11:00+08:00',
          requestId: 'req-repository-book-replay'
        },
        voucherId: prepared.voucher.id
      });
      const bookedSnapshot = repository.readSnapshot();
      const bookedCloseChecks = readCloseChecksFromVoucherRows(bookedSnapshot.voucherRows);

      assertEqual(bookedSnapshot.vouchers[0]?.status, '已记账', 'repository should persist booked voucher');
      assertEqual(bookedSnapshot.ledgerRows.length, 2, 'book should persist one ledger row per voucher line');
      assertEqual(bookedSnapshot.voucherRows[0]?.status, '已记账', 'voucher row should show booked status');
      assertEqual(bookReplay.ok, true, 'matching book idempotency replay should succeed');
      assertEqual(bookReplay.ok ? bookReplay.replayed : false, true, 'matching book replay should be marked');
      assertEqual(repository.readLedgerRows('2026-06').length, 2, 'ledger rows should be readable by accounting period');
      assertEqual(bookedCloseChecks.status, 200, 'booked close checks should be readable');
      assertObject(bookedCloseChecks.body, 'booked close checks response should be an object');
      assertEqual(bookedCloseChecks.body.canClose, true, 'booked voucher should clear voucher blockers when other checks pass');
    }
  },
  {
    name: 'replaces later-period adjustment candidate row when prepared through repository',
    run: () => {
      const candidateId = 'candidate-later-adjustment-later-adjustment-voucher-202606-001-202607';
      const repository = createAccountingVoucherLedgerRepository({
        voucherRows: [
          {
            accountingPeriod: '2026-06',
            id: candidateId,
            sourceModule: '会计凭证',
            sourceNo: 'ADJ-202606-001',
            status: '待制单'
          }
        ]
      });
      const sourceSnapshot = createSourceSnapshot({
        businessType: '调整凭证',
        sourceId: candidateId,
        sourceModule: '会计凭证',
        sourceNo: 'ADJ-202606-001',
        sourceTitle: '后续调整 奈雪华南门店设计服务合同'
      });
      const prepared = repository.prepareVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-candidate-row-prepare',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-candidate-row-prepare'
        },
        sourceSnapshot
      });

      assertEqual(prepared.ok, true, 'candidate row prepare should succeed');

      if (!prepared.ok) {
        return;
      }

      const snapshot = repository.readSnapshot();

      assertEqual(snapshot.voucherRows.length, 1, 'prepared formal voucher row should replace candidate row');
      assertEqual(snapshot.voucherRows[0]?.id, prepared.voucher.id, 'voucher row should reference prepared voucher');
      assertEqual(snapshot.voucherRows[0]?.status, '已制单', 'replacement row should show prepared status');
    }
  },
  {
    name: 'persists open-period reversal without deleting original ledger evidence',
    run: () => {
      const repository = createAccountingVoucherLedgerRepository();
      const sourceSnapshot = createSourceSnapshot();
      const prepared = repository.prepareVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-reversal-prepare',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-reversal-prepare'
        },
        sourceSnapshot
      });

      if (!prepared.ok) {
        throw new Error('fixture prepare should succeed');
      }

      const booked = repository.bookVoucher({
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-reversal-book',
          now: '2026-06-10T10:10:00+08:00',
          requestId: 'req-reversal-book'
        },
        voucherId: prepared.voucher.id
      });

      if (!booked.ok) {
        throw new Error('fixture book should succeed');
      }

      const reversed = repository.reverseVoucher({
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-reversal-reverse',
          now: '2026-06-11T09:00:00+08:00',
          reason: '开放期间发现确认口径错误，需要冲销重做',
          requestId: 'req-reversal-reverse'
        },
        voucherId: prepared.voucher.id
      });

      assertEqual(reversed.ok, true, 'repository reversal should succeed in open period');

      if (!reversed.ok) {
        return;
      }

      const reversalReplay = repository.reverseVoucher({
        periods: [createPeriod('2026-06')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-reversal-reverse',
          now: '2026-06-11T09:10:00+08:00',
          reason: '开放期间发现确认口径错误，需要冲销重做',
          requestId: 'req-reversal-reverse-replay'
        },
        voucherId: prepared.voucher.id
      });
      const snapshot = repository.readSnapshot();
      const originalVoucher = snapshot.vouchers.find((voucher) => voucher.id === prepared.voucher.id);
      const reversalVoucher = snapshot.vouchers.find((voucher) => voucher.reversalOfVoucherId === prepared.voucher.id);

      assertEqual(snapshot.vouchers.length, 2, 'repository should keep original and reversal voucher');
      assertEqual(originalVoucher?.status, '已冲销', 'original voucher should become reversed');
      assertEqual(reversalVoucher?.status, '已记账', 'reversal voucher should be booked immediately');
      assertEqual(snapshot.ledgerRows.length, 4, 'reversal should append opposite ledger rows without deleting original rows');
      assertEqual(
        snapshot.voucherRows.find((row) => row.id === prepared.voucher.id)?.status,
        '已冲销',
        'voucher rows should update original voucher status'
      );
      assertEqual(
        snapshot.voucherRows.find((row) => row.id === reversalVoucher?.id)?.status,
        '已记账',
        'voucher rows should include reversal voucher status'
      );
      assertEqual(reversalReplay.ok, true, 'matching reversal idempotency replay should succeed');
      assertEqual(reversalReplay.ok ? reversalReplay.replayed : false, true, 'matching reversal replay should be marked');
      assertEqual(repository.readSnapshot().ledgerRows.length, 4, 'reversal replay should not duplicate ledger rows');
    }
  },
  {
    name: 'closed period rejection does not persist voucher or ledger rows',
    run: () => {
      const repository = createAccountingVoucherLedgerRepository();
      const sourceSnapshot = createSourceSnapshot();
      const result = repository.prepareVoucher({
        lines: createVoucherLines(),
        periods: [createPeriod('2026-06', '已结账')],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-closed-prepare',
          now: '2026-06-10T10:00:00+08:00',
          requestId: 'req-closed-prepare'
        },
        sourceSnapshot
      });
      const snapshot = repository.readSnapshot();

      assertEqual(result.ok, false, 'closed period should reject repository prepare');
      assertEqual(result.ok ? '' : result.error.code, 'CLOSED_ACCOUNTING_PERIOD', 'closed prepare should use stable code');
      assertEqual(snapshot.vouchers.length, 0, 'closed prepare should not persist voucher');
      assertEqual(snapshot.ledgerRows.length, 0, 'closed prepare should not persist ledger rows');
      assertEqual(snapshot.voucherRows.length, 0, 'closed prepare should not persist voucher rows');
      assertEqual(snapshot.events.length, 1, 'closed prepare should persist rejection event for audit readback');
    }
  }
];

for (const test of tests) {
  test.run();
}
