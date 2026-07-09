import {
  bookAccountingVoucher,
  prepareAccountingVoucher
} from './accountingVoucherLifecycleContract.js';
import {
  createAccountingVoucherLaterPeriodAdjustment,
  type AccountingVoucherPersistedRecord
} from './accountingVoucherLaterPeriodAdjustmentContract.js';
import {
  createLaterPeriodAdjustmentLifecycleInput,
  updateLaterPeriodAdjustmentFactsFromLifecycle,
  upsertPeriodCloseVoucherRowFromLifecycle
} from './accountingVoucherLaterPeriodLifecycleBridgeContract.js';
import {
  handleFinanceHttpApiRepositoryGateway
} from './financeHttpApiRepositoryGatewayContract.js';
import {
  financePeriodClosePermissionScopes
} from './periodCloseAuthorizationContract.js';
import {
  requiredCloseCheckCodes,
  type AccountingPeriodRecord,
  type CloseCheckRow
} from './periodCloseContract.js';
import {
  createRowBackedPeriodCloseRepository
} from './periodCloseDatabaseRepositoryContract.js';
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
  const basePeriod: PersistentAccountingPeriodRecord = {
    period,
    status,
    version: 1
  };

  if (status !== '已结账') {
    return basePeriod;
  }

  return {
    ...basePeriod,
    closeCheckSnapshotHash: `chk-${period}`,
    closeCheckSnapshotId: `close-check-${period}`,
    closeReason: `${period} 月结`,
    closedAt: `${period}-30T18:00:00+08:00`,
    closedBySnapshot: { id: 'user-001', name: '李明' }
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

function createOriginalVoucher(): AccountingVoucherPersistedRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '68000.00',
    id: 'voucher-202606-001',
    lines: [
      {
        amount: '68000.00',
        auxiliary: '奈雪华南区域',
        id: 'line-debit',
        side: '借方',
        subjectCode: '1122',
        summary: '客户回款确认'
      },
      {
        amount: '68000.00',
        auxiliary: 'CON-2026-001',
        id: 'line-credit',
        side: '贷方',
        subjectCode: '5001',
        summary: '客户回款确认'
      }
    ],
    sourceNo: 'AR-202606-001',
    sourceTitle: '奈雪华南门店设计服务合同',
    status: '已记账',
    version: 4,
    voucherNo: '记-202606-001'
  };
}

function createState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {
      '2026-07': {
        checks: createCloseChecks(),
        computedAt: '2026-07-31T20:00:00+08:00',
        sourceVersionSetHash: 'src-later-period-lifecycle-bridge-202607',
        trialBalance: {
          creditTotal: '68000.00',
          debitTotal: '68000.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    },
    closeCheckSnapshots: [
      {
        canClose: true,
        checkSnapshotHash: 'chk-2026-06',
        checks: createCloseChecks(),
        computedAt: '2026-06-30T18:00:00+08:00',
        createdAt: '2026-06-30T18:00:00+08:00',
        id: 'close-check-2026-06',
        persistedForClose: true,
        period: '2026-06',
        requestId: 'req-close-202606-existing',
        runType: 'close_snapshot',
        sourceVersionSetHash: 'src-later-period-lifecycle-bridge-202606',
        status: '通过',
        trialBalance: {
          creditTotal: '68000.00',
          debitTotal: '68000.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    ],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [
      createPeriod('2026-06', '已结账'),
      createPeriod('2026-07', '开放')
    ],
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
    'x-request-id': 'req-later-period-lifecycle-bridge',
    'x-request-time': '2026-07-31T20:00:00+08:00',
    ...overrides
  };
}

const subjectNamesByCode: Record<string, string> = {
  '1122': '应收账款',
  '5001': '主营业务收入'
};

const tests: UnitTest[] = [
  {
    name: 'connects later-period adjustment candidate to voucher lifecycle and period close',
    run: () => {
      const originalVoucher = createOriginalVoucher();
      const adjustment = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher,
        periods: [
          createPeriod('2026-06', '已结账'),
          createPeriod('2026-07', '开放')
        ],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          adjustmentDate: '2026-07-01',
          adjustmentPeriod: '2026-07',
          idempotencyKey: 'idem-later-period-lifecycle-bridge',
          now: '2026-07-02T19:30:00+08:00',
          reason: '历史期间收入确认口径需要在后续期间调整',
          requestId: 'req-create-later-period-lifecycle-bridge',
          version: originalVoucher.version
        }
      });

      assertEqual(adjustment.ok, true, 'later-period adjustment should create a candidate');

      if (!adjustment.ok) {
        return;
      }

      const lifecycleInput = createLaterPeriodAdjustmentLifecycleInput({
        candidate: adjustment.candidate,
        resolveSubjectName: (subjectCode) => subjectNamesByCode[subjectCode]
      });
      const prepared = prepareAccountingVoucher({
        lines: lifecycleInput.lines,
        periods: [
          createPeriod('2026-06', '已结账'),
          createPeriod('2026-07', '开放')
        ],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          expectedSourceHash: lifecycleInput.sourceSnapshot.sourceHash,
          idempotencyKey: 'idem-prepare-later-period-lifecycle-bridge',
          now: '2026-07-02T19:40:00+08:00',
          requestId: 'req-prepare-later-period-lifecycle-bridge'
        },
        sourceSnapshot: lifecycleInput.sourceSnapshot
      });

      assertEqual(prepared.ok, true, 'later-period adjustment candidate should prepare a formal voucher');

      if (!prepared.ok) {
        return;
      }

      const preparedFacts = updateLaterPeriodAdjustmentFactsFromLifecycle({
        facts: adjustment.adjustmentFacts,
        voucher: prepared.voucher
      });
      const preparedVoucherRows = upsertPeriodCloseVoucherRowFromLifecycle({
        rows: [
          {
            accountingPeriod: adjustment.candidate.accountingPeriod,
            id: adjustment.candidate.id,
            sourceModule: '会计凭证',
            sourceNo: adjustment.candidate.sourceNo,
            status: '待制单'
          }
        ],
        voucher: prepared.voucher
      });

      assertEqual(preparedFacts[0]?.status, '已制单', 'preparing the formal voucher should update the adjustment fact status');
      assertEqual(preparedVoucherRows.length, 1, 'formal voucher row should replace the pending candidate row');
      assertEqual(preparedVoucherRows[0]?.id, prepared.voucher.id, 'period-close row should point to the formal voucher id');
      assertEqual(preparedVoucherRows[0]?.status, '已制单', 'prepared voucher row should block booking');

      const preparedRepository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-31T20:00:00+08:00',
        initialState: createState({ voucherRows: preparedVoucherRows })
      });
      const preparedChecks = handleFinanceHttpApiRepositoryGateway({
        repository: preparedRepository,
        request: {
          headers: headers({ 'x-request-id': 'req-prepared-later-period-checks' }),
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-07/close-checks'
        }
      });

      assertEqual(preparedChecks.status, 200, 'prepared target-period close checks should be readable');
      assertObject(preparedChecks.body, 'prepared close checks body should be an object');
      assertEqual(preparedChecks.body.canClose, false, 'prepared but unbooked voucher should block close');

      const preparedCheckRows = preparedChecks.body.checks;
      assert(Array.isArray(preparedCheckRows), 'prepared close checks should include check rows');
      const voucherBookingCheck = preparedCheckRows.find(
        (check): check is Record<string, unknown> =>
          Boolean(check && typeof check === 'object' && 'code' in check && check.code === 'voucher_booking')
      );

      assertObject(voucherBookingCheck, 'voucher booking check should exist for prepared adjustment voucher');
      assertEqual(voucherBookingCheck.status, '阻断', 'prepared adjustment voucher should block voucher booking');

      const booked = bookAccountingVoucher({
        ledgerRows: prepared.ledgerRows,
        periods: [
          createPeriod('2026-06', '已结账'),
          createPeriod('2026-07', '开放')
        ],
        request: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          idempotencyKey: 'idem-book-later-period-lifecycle-bridge',
          now: '2026-07-02T19:50:00+08:00',
          requestId: 'req-book-later-period-lifecycle-bridge'
        },
        voucherId: prepared.voucher.id,
        vouchers: prepared.vouchers
      });

      assertEqual(booked.ok, true, 'prepared later-period adjustment voucher should book');

      if (!booked.ok) {
        return;
      }

      const bookedVoucherRows = upsertPeriodCloseVoucherRowFromLifecycle({
        rows: preparedVoucherRows,
        voucher: booked.voucher
      });

      assertEqual(booked.ledgerRows.length, 2, 'booking the adjustment voucher should create ledger rows');
      assertEqual(bookedVoucherRows[0]?.status, '已记账', 'booked voucher row should clear close blockers');

      const bookedRepository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-31T20:00:00+08:00',
        initialState: createState({ voucherRows: bookedVoucherRows })
      });
      const bookedChecks = handleFinanceHttpApiRepositoryGateway({
        repository: bookedRepository,
        request: {
          headers: headers({ 'x-request-id': 'req-booked-later-period-checks' }),
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-07/close-checks'
        }
      });

      assertEqual(bookedChecks.status, 200, 'booked target-period close checks should be readable');
      assertObject(bookedChecks.body, 'booked close checks body should be an object');
      assertEqual(bookedChecks.body.canClose, true, 'booked adjustment voucher should allow close when other checks pass');

      const closeResponse = handleFinanceHttpApiRepositoryGateway({
        repository: bookedRepository,
        request: {
          body: {
            idempotencyKey: 'idem-close-later-period-lifecycle-bridge',
            reason: '2026-07 月结',
            version: 1
          },
          headers: headers({
            'x-request-id': 'req-close-later-period-lifecycle-bridge',
            'x-request-time': '2026-07-31T20:30:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-07/close'
        }
      });

      assertEqual(closeResponse.status, 201, 'target period should close after lifecycle booking');
      assertObject(closeResponse.body, 'close response body should be an object');
      assertEqual(closeResponse.body.status, '已结账', 'target period close should persist after lifecycle booking');
    }
  }
];

for (const test of tests) {
  test.run();
}
