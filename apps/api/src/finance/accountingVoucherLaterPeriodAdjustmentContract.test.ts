import {
  canonicalClosedAccountingPeriodErrorCode,
  type AccountingPeriodRecord
} from './periodCloseContract.js';
import {
  createAccountingVoucherLaterPeriodAdjustment,
  handleAccountingVoucherLaterPeriodAdjustmentRoute,
  type AccountingVoucherLaterPeriodAdjustmentRouteContext,
  type AccountingVoucherLaterPeriodAdjustmentRouteState,
  type AccountingVoucherPersistedRecord
} from './accountingVoucherLaterPeriodAdjustmentContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

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

function createPeriod(period: string, status: AccountingPeriodRecord['status']): AccountingPeriodRecord {
  return {
    period,
    status,
    version: 1
  };
}

function createBookedVoucher(overrides: Partial<AccountingVoucherPersistedRecord> = {}): AccountingVoucherPersistedRecord {
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
    voucherNo: '记-202606-001',
    ...overrides
  };
}

function createAdjustmentRequest(
  overrides: Partial<Parameters<typeof createAccountingVoucherLaterPeriodAdjustment>[0]['request']> = {}
) {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    adjustmentDate: '2026-07-01',
    adjustmentPeriod: '2026-07',
    idempotencyKey: 'idem-later-adjustment-001',
    now: '2026-07-02T19:30:00+08:00',
    reason: '历史期间收入确认口径需要在后续期间调整',
    requestId: 'req-later-adjustment-001',
    version: 4,
    ...overrides
  };
}

function createContext(
  overrides: Partial<AccountingVoucherLaterPeriodAdjustmentRouteContext> = {}
): AccountingVoucherLaterPeriodAdjustmentRouteContext {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-02T19:30:00+08:00',
    requestId: 'req-route-later-adjustment-001',
    ...overrides
  };
}

function createRouteState(
  overrides: Partial<AccountingVoucherLaterPeriodAdjustmentRouteState> = {}
): AccountingVoucherLaterPeriodAdjustmentRouteState {
  return {
    adjustmentFacts: [],
    events: [],
    idempotencyRecords: [],
    periods: [
      createPeriod('2026-06', '已结账'),
      createPeriod('2026-07', '开放'),
      createPeriod('2026-08', '已结账')
    ],
    vouchers: [createBookedVoucher()],
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'creates later-period adjustment source and candidate without mutating original voucher',
    run: () => {
      const originalVoucher = createBookedVoucher();
      const result = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher,
        periods: [createPeriod('2026-06', '已结账'), createPeriod('2026-07', '开放')],
        request: createAdjustmentRequest()
      });

      assertEqual(result.ok, true, 'closed original period should allow later-period adjustment in open target period');

      if (!result.ok) {
        return;
      }

      assertEqual(result.adjustmentFact.originalVoucherId, originalVoucher.id, 'adjustment fact should reference original voucher id');
      assertEqual(result.adjustmentFact.originalAccountingPeriod, '2026-06', 'adjustment fact should retain original period');
      assertEqual(result.adjustmentFact.adjustmentPeriod, '2026-07', 'adjustment fact should use target adjustment period');
      assertEqual(result.adjustmentFact.actorSnapshot.name, '李明', 'server actor snapshot should be retained');
      assertEqual(result.candidate.accountingPeriod, '2026-07', 'candidate should belong to target period');
      assertEqual(result.candidate.businessType, '调整凭证', 'candidate should be an adjustment voucher');
      assertEqual(result.candidate.status, '待制单', 'candidate should still require preparation');
      assertEqual(result.candidate.lines[0]?.side, '贷方', 'candidate should reverse first original line side');
      assertEqual(originalVoucher.status, '已记账', 'original voucher object should remain booked');
      assertEqual(originalVoucher.reversedByVoucherId, undefined, 'later-period adjustment should not mark original as reversed');
    }
  },
  {
    name: 'replays matching idempotent later-period adjustment and rejects reused key mismatch',
    run: () => {
      const originalVoucher = createBookedVoucher();
      const periods = [createPeriod('2026-06', '已结账'), createPeriod('2026-07', '开放')];
      const first = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher,
        periods,
        request: createAdjustmentRequest()
      });

      assertEqual(first.ok, true, 'first adjustment creation should pass');

      if (!first.ok) {
        return;
      }

      const replay = createAccountingVoucherLaterPeriodAdjustment({
        adjustmentFacts: first.adjustmentFacts,
        idempotencyRecords: first.idempotencyRecords,
        originalVoucher,
        periods,
        request: createAdjustmentRequest()
      });
      const mismatch = createAccountingVoucherLaterPeriodAdjustment({
        adjustmentFacts: first.adjustmentFacts,
        idempotencyRecords: first.idempotencyRecords,
        originalVoucher,
        periods,
        request: createAdjustmentRequest({
          reason: '同一个幂等键不能换原因'
        })
      });

      assertEqual(replay.ok, true, 'matching idempotent request should replay');
      assertEqual(replay.ok ? replay.replayed : false, true, 'replay should be marked');
      assertEqual(replay.adjustmentFacts.length, 1, 'replay should not create duplicate adjustment fact');
      assertEqual(mismatch.ok, false, 'idempotency key reuse with changed request should fail');
      assertEqual(mismatch.ok ? '' : mismatch.error.code, 'IDEMPOTENCY_KEY_REUSED', 'mismatch should use idempotency error');
    }
  },
  {
    name: 'blocks later-period adjustment when original period is open',
    run: () => {
      const result = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher(),
        periods: [createPeriod('2026-06', '开放'), createPeriod('2026-07', '开放')],
        request: createAdjustmentRequest()
      });

      assertEqual(result.ok, false, 'open original period should not use later-period adjustment');
      assertEqual(result.ok ? '' : result.error.code, 'ORIGINAL_PERIOD_NOT_CLOSED', 'open original period should guide same-period reversal');
      assertEqual(result.ok ? '' : result.error.nextAction, '冲销', 'open original period should point to reversal');
    }
  },
  {
    name: 'blocks invalid or closed target adjustment period',
    run: () => {
      const invalidTarget = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher(),
        periods: [createPeriod('2026-06', '已结账'), createPeriod('2026-07', '开放')],
        request: createAdjustmentRequest({
          adjustmentDate: '2026-06-30',
          adjustmentPeriod: '2026-06'
        })
      });
      const closedTarget = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher(),
        periods: [createPeriod('2026-06', '已结账'), createPeriod('2026-07', '已结账')],
        request: createAdjustmentRequest()
      });

      assertEqual(invalidTarget.ok, false, 'target period must be later than original and date-matched');
      assertEqual(
        invalidTarget.ok ? '' : invalidTarget.error.code,
        'VOUCHER_ADJUSTMENT_PERIOD_INVALID',
        'invalid target should use adjustment-period error'
      );
      assertEqual(closedTarget.ok, false, 'closed target period should block adjustment');
      assertEqual(
        closedTarget.ok ? '' : closedTarget.error.code,
        canonicalClosedAccountingPeriodErrorCode,
        'closed target should use canonical closed-period error'
      );
    }
  },
  {
    name: 'requires target adjustment period to exist and be open',
    run: () => {
      const missingTarget = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher(),
        periods: [createPeriod('2026-06', '已结账')],
        request: createAdjustmentRequest()
      });
      const reopenedTarget = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher(),
        periods: [createPeriod('2026-06', '已结账'), createPeriod('2026-07', '已反结账')],
        request: createAdjustmentRequest()
      });

      assertEqual(missingTarget.ok, false, 'missing target period should not be treated as open');
      assertEqual(
        missingTarget.ok ? '' : missingTarget.error.code,
        'VOUCHER_ADJUSTMENT_PERIOD_INVALID',
        'missing target should use adjustment-period error'
      );
      assertEqual(reopenedTarget.ok, false, 'reopened target period should not be accepted as an open adjustment period');
      assertEqual(
        reopenedTarget.ok ? '' : reopenedTarget.error.code,
        'VOUCHER_ADJUSTMENT_PERIOD_INVALID',
        'non-open target should use adjustment-period error'
      );
    }
  },
  {
    name: 'blocks non-booked, reversal, or already reversed original vouchers',
    run: () => {
      const periods = [createPeriod('2026-06', '已结账'), createPeriod('2026-07', '开放')];
      const unbooked = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher({ status: '已制单' }),
        periods,
        request: createAdjustmentRequest()
      });
      const reversal = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher({ reversalOfVoucherId: 'voucher-origin-001' }),
        periods,
        request: createAdjustmentRequest()
      });
      const alreadyReversed = createAccountingVoucherLaterPeriodAdjustment({
        originalVoucher: createBookedVoucher({ reversedByVoucherId: 'voucher-reversal-001' }),
        periods,
        request: createAdjustmentRequest()
      });

      assertEqual(unbooked.ok, false, 'unbooked voucher should not create adjustment');
      assertEqual(unbooked.ok ? '' : unbooked.error.code, 'VOUCHER_NOT_BOOKED', 'unbooked should use stable code');
      assertEqual(reversal.ok, false, 'reversal voucher should not create later adjustment');
      assertEqual(reversal.ok ? '' : reversal.error.code, 'VOUCHER_IS_REVERSAL', 'reversal should use stable code');
      assertEqual(alreadyReversed.ok, false, 'already reversed voucher should not create later adjustment');
      assertEqual(alreadyReversed.ok ? '' : alreadyReversed.error.code, 'VOUCHER_ALREADY_REVERSED', 'already reversed should use stable code');
    }
  },
  {
    name: 'handles later-period adjustment route with server-owned actor and state updates',
    run: () => {
      const response = handleAccountingVoucherLaterPeriodAdjustmentRoute({
        context: createContext(),
        request: {
          body: {
            adjustmentDate: '2026-07-01',
            adjustmentPeriod: '2026-07',
            idempotencyKey: 'idem-route-later-adjustment-001',
            reason: '历史期间收入确认口径需要在后续期间调整',
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-vouchers/voucher-202606-001/later-period-adjustments'
        },
        state: createRouteState()
      });

      assertEqual(response.status, 201, 'route should create adjustment source fact');
      assertObject(response.body, 'route success body should be object');
      assertEqual(response.state.adjustmentFacts.length, 1, 'route should persist one adjustment fact in local state');
      assertEqual(response.state.events[0]?.eventType, 'later_period_adjustment_created', 'route should append created event');
      assertEqual(response.state.vouchers[0]?.status, '已记账', 'route should not mutate original voucher status');
      assertEqual(response.body.replayed, false, 'first route call should not be replay');
    }
  },
  {
    name: 'route rejects invalid body, unknown route, and missing voucher',
    run: () => {
      const invalidBody = handleAccountingVoucherLaterPeriodAdjustmentRoute({
        context: createContext({ requestId: 'req-invalid-body' }),
        request: {
          body: { reason: '缺少字段' },
          method: 'POST',
          path: '/api/finance/accounting-vouchers/voucher-202606-001/later-period-adjustments'
        },
        state: createRouteState()
      });
      const unknownRoute = handleAccountingVoucherLaterPeriodAdjustmentRoute({
        context: createContext({ requestId: 'req-unknown-route' }),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/accounting-vouchers/voucher-202606-001/unknown'
        },
        state: createRouteState()
      });
      const missingVoucher = handleAccountingVoucherLaterPeriodAdjustmentRoute({
        context: createContext({ requestId: 'req-missing-voucher' }),
        request: {
          body: {
            adjustmentDate: '2026-07-01',
            adjustmentPeriod: '2026-07',
            idempotencyKey: 'idem-route-missing-voucher',
            reason: '历史期间收入确认口径需要在后续期间调整',
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-vouchers/voucher-missing/later-period-adjustments'
        },
        state: createRouteState()
      });

      assertEqual(invalidBody.status, 400, 'invalid route body should return bad request');
      assertEqual(unknownRoute.status, 404, 'unknown route should return not found');
      assertEqual(missingVoucher.status, 404, 'missing voucher should return not found');
      assertObject(missingVoucher.body, 'missing voucher body should be object');
      assertEqual(missingVoucher.body.code, 'VOUCHER_NOT_FOUND', 'missing voucher should use stable code');
    }
  }
];

for (const test of tests) {
  test.run();
}
