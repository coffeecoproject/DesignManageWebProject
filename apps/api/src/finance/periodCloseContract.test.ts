import {
  assertAccountingPeriodOpen,
  buildCloseChecksResponse,
  canonicalClosedAccountingPeriodErrorCode,
  closeAccountingPeriod,
  createStableSnapshotHash,
  reopenAccountingPeriod,
  requiredCloseCheckCodes,
  type AccountingPeriodRecord,
  type CloseCheckCode,
  type CloseCheckRow,
  type CloseChecksResponse
} from './periodCloseContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 3,
    ...overrides
  };
}

function createCheck(code: CloseCheckCode, overrides: Partial<CloseCheckRow> = {}): CloseCheckRow {
  return {
    blockerCount: 0,
    canPass: true,
    code,
    label: code,
    sources: [],
    status: '通过',
    summary: '检查通过。',
    ...overrides
  };
}

function createPassingChecks(period = createPeriod(), computedAt = '2026-07-02T10:00:00+08:00'): CloseChecksResponse {
  return buildCloseChecksResponse({
    checks: requiredCloseCheckCodes.map((code) => createCheck(code)),
    computedAt,
    period,
    sourceVersionSetHash: 'src_v1',
    trialBalance: {
      creditTotal: '1200.00',
      debitTotal: '1200.00',
      difference: '0.00',
      status: '平衡'
    }
  });
}

function createCloseRequest(overrides: Parameters<typeof closeAccountingPeriod>[0]['request'] extends infer Request ? Partial<Request> : never = {}) {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    expectedCheckSnapshotHash: undefined,
    idempotencyKey: 'idem-close-001',
    now: '2026-07-02T18:00:00+08:00',
    reason: '2026-06 月结',
    requestId: 'req-001',
    version: 3,
    ...overrides
  };
}

function createReopenRequest(overrides: Parameters<typeof reopenAccountingPeriod>[0]['request'] extends infer Request ? Partial<Request> : never = {}) {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    idempotencyKey: 'idem-reopen-001',
    now: '2026-07-03T09:00:00+08:00',
    reason: '发现本期凭证需要重开处理',
    requestId: 'req-reopen-001',
    version: 4,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds backend-owned close checks with all required groups and stable hash',
    run: () => {
      const period = createPeriod();
      const first = createPassingChecks(period, '2026-07-02T10:00:00+08:00');
      const second = createPassingChecks(period, '2026-07-02T10:05:00+08:00');

      assertEqual(first.canClose, true, 'all passing check groups should allow close');
      assertEqual(first.checks.length, requiredCloseCheckCodes.length, 'all required check groups should be present');
      assertEqual(first.checkSnapshotHash, second.checkSnapshotHash, 'volatile computedAt should not change snapshot hash');
      assertEqual(createStableSnapshotHash({ b: 2, a: 1 }), createStableSnapshotHash({ a: 1, b: 2 }), 'snapshot hashing should be key-order stable');
    }
  },
  {
    name: 'blocks close checks when any required group is blocking',
    run: () => {
      const checks = buildCloseChecksResponse({
        checks: requiredCloseCheckCodes.map((code) =>
          code === 'cash_reconciliation'
            ? createCheck(code, {
                blockerCount: 1,
                canPass: false,
                sources: [
                  {
                    accountingPeriod: '2026-06',
                    nextAction: '回到银行对账',
                    reason: '已复核流水未对账。',
                    reasonCode: 'cash_flow_unreconciled',
                    sourceId: 'txn-001',
                    sourceModule: '银行对账',
                    sourceNo: 'FIN-202606-0001',
                    sourceStatus: '未对账'
                  }
                ],
                status: '阻断',
                summary: '还有 1 条已入账流水未完成银行对账。'
              })
            : createCheck(code)
        ),
        computedAt: '2026-07-02T10:00:00+08:00',
        period: createPeriod(),
        sourceVersionSetHash: 'src_v2',
        trialBalance: {
          creditTotal: '1200.00',
          debitTotal: '1200.00',
          difference: '0.00',
          status: '平衡'
        }
      });

      assertEqual(checks.canClose, false, 'one blocking group should make canClose false');
      assertEqual(checks.checks.find((check) => check.code === 'cash_reconciliation')?.sources[0]?.sourceNo, 'FIN-202606-0001', 'blockers should keep source number');
    }
  },
  {
    name: 'treats blocking status as non-closeable even when canPass is inconsistent',
    run: () => {
      const period = createPeriod();
      const checks = buildCloseChecksResponse({
        checks: requiredCloseCheckCodes.map((code) =>
          code === 'voucher_booking'
            ? createCheck(code, {
                blockerCount: 1,
                canPass: true,
                status: '阻断',
                summary: '存在阻断事项。'
              })
            : createCheck(code)
        ),
        computedAt: '2026-07-02T10:00:00+08:00',
        period,
        sourceVersionSetHash: 'src_v_inconsistent_status',
        trialBalance: {
          creditTotal: '1200.00',
          debitTotal: '1200.00',
          difference: '0.00',
          status: '平衡'
        }
      });
      const result = closeAccountingPeriod({
        checks,
        period,
        request: createCloseRequest()
      });

      assertEqual(checks.canClose, false, 'blocking status should make canClose false');
      assertEqual(result.ok, false, 'blocking status should reject close even when canPass is stale');

      if (!result.ok) {
        assertEqual(result.error.code, 'PERIOD_CLOSE_BLOCKED', 'blocking status should use close-blocked error');
      }
    }
  },
  {
    name: 'closes a period with idempotent event and persisted lock snapshot',
    run: () => {
      const period = createPeriod();
      const checks = createPassingChecks(period);
      const result = closeAccountingPeriod({
        checks,
        period,
        request: createCloseRequest({ expectedCheckSnapshotHash: checks.checkSnapshotHash })
      });

      assertEqual(result.ok, true, 'passing checks should close period');

      if (!result.ok) {
        return;
      }

      assertEqual(result.period.status, '已结账', 'closed period should persist closed status');
      assertEqual(result.period.version, 4, 'close should increment version');
      assertEqual(
        result.period.closeCheckSnapshotId,
        `close-check:2026-06:${checks.checkSnapshotHash}`,
        'close should expose a snapshot id before persistence replaces it'
      );
      assertEqual(result.period.closeCheckSnapshotHash, checks.checkSnapshotHash, 'close should store check snapshot hash');
      assertEqual(result.event.eventType, 'closed', 'close should write a closed event');
      assertEqual(result.idempotencyRecords.length, 1, 'close should store idempotency record');
    }
  },
  {
    name: 'rejects close when checks are blocked and keeps period open',
    run: () => {
      const period = createPeriod();
      const checks = createPassingChecks(period);
      const blockedChecks = {
        ...checks,
        canClose: false,
        checks: checks.checks.map((check) =>
          check.code === 'voucher_booking'
            ? { ...check, blockerCount: 2, canPass: false, status: '阻断' as const }
            : check
        )
      };
      const result = closeAccountingPeriod({
        checks: blockedChecks,
        period,
        request: createCloseRequest()
      });

      assertEqual(result.ok, false, 'blocked checks should reject close');

      if (result.ok) {
        return;
      }

      assertEqual(result.error.code, 'PERIOD_CLOSE_BLOCKED', 'blocked close should return stable error');
      assertEqual(result.period.status, '开放', 'failed close should not lock period');
      assertEqual(result.event?.eventType, 'close_attempt_failed', 'failed close may be audited');
    }
  },
  {
    name: 'replays matching idempotent close and rejects key reuse with different request',
    run: () => {
      const period = createPeriod();
      const checks = createPassingChecks(period);
      const first = closeAccountingPeriod({
        checks,
        period,
        request: createCloseRequest({ expectedCheckSnapshotHash: checks.checkSnapshotHash })
      });

      assertEqual(first.ok, true, 'first close should pass');

      if (!first.ok) {
        return;
      }

      const replay = closeAccountingPeriod({
        checks,
        idempotencyRecords: first.idempotencyRecords,
        period,
        request: createCloseRequest({ expectedCheckSnapshotHash: checks.checkSnapshotHash })
      });
      const reused = closeAccountingPeriod({
        checks,
        idempotencyRecords: first.idempotencyRecords,
        period,
        request: createCloseRequest({ expectedCheckSnapshotHash: checks.checkSnapshotHash, reason: '不同结账说明' })
      });

      assertEqual(replay.ok, true, 'same idempotent request should replay');
      assertEqual(replay.ok ? replay.replayed : false, true, 'replayed result should be marked');
      assertEqual(reused.ok, false, 'same key with different request should be rejected');
      assertEqual(reused.ok ? '' : reused.error.code, 'IDEMPOTENCY_KEY_REUSED', 'key reuse should use stable error code');
    }
  },
  {
    name: 'rejects stale version and stale check snapshot',
    run: () => {
      const period = createPeriod();
      const checks = createPassingChecks(period);
      const staleVersion = closeAccountingPeriod({
        checks,
        period,
        request: createCloseRequest({ version: 2 })
      });
      const staleSnapshot = closeAccountingPeriod({
        checks,
        period,
        request: createCloseRequest({ expectedCheckSnapshotHash: 'chk_stale' })
      });

      assertEqual(staleVersion.ok, false, 'stale version should reject close');
      assertEqual(staleVersion.ok ? '' : staleVersion.error.code, 'PERIOD_VERSION_CONFLICT', 'stale version should use conflict code');
      assertEqual(staleSnapshot.ok, false, 'stale check snapshot should reject close');
      assertEqual(staleSnapshot.ok ? '' : staleSnapshot.error.code, 'CHECK_SNAPSHOT_MISMATCH', 'stale snapshot should use mismatch code');
      assertEqual(
        staleSnapshot.ok ? '' : staleSnapshot.error.expectedCheckSnapshotHash,
        'chk_stale',
        'stale snapshot error should echo the client-observed hash'
      );
      assertEqual(
        staleSnapshot.ok ? '' : staleSnapshot.error.currentCheckSnapshotHash,
        checks.checkSnapshotHash,
        'stale snapshot error should expose the current backend-owned hash'
      );
    }
  },
  {
    name: 'guards source mutation in closed periods with canonical error code',
    run: () => {
      const openGuard = assertAccountingPeriodOpen({
        accountingPeriod: '2026-07',
        periods: [createPeriod({ period: '2026-07', status: '开放' })],
        requestId: 'req-guard-open'
      });
      const reopenedGuard = assertAccountingPeriodOpen({
        accountingPeriod: '2026-05',
        periods: [createPeriod({ period: '2026-05', status: '已反结账' })],
        requestId: 'req-guard-reopened'
      });
      const closedGuard = assertAccountingPeriodOpen({
        accountingPeriod: '2026-06',
        periods: [createPeriod({ period: '2026-06', status: '已结账' })],
        requestId: 'req-guard-closed',
        sourceId: 'rp-001',
        sourceModule: '应收应付'
      });
      const unknownGuard = assertAccountingPeriodOpen({
        accountingPeriod: '2026-08',
        periods: [createPeriod({ period: '2026-06', status: '开放' })],
        requestId: 'req-guard-unknown',
        sourceId: 'rp-002',
        sourceModule: '应收应付'
      });

      assertEqual(openGuard.allowed, true, 'open period should allow mutation');
      assertEqual(reopenedGuard.allowed, true, 'reopened period should allow correction flow mutations');
      assertEqual(closedGuard.allowed, false, 'closed period should block mutation');
      assertEqual(unknownGuard.allowed, false, 'unknown period should block mutation');

      if (closedGuard.allowed) {
        return;
      }

      assertEqual(closedGuard.error.code, canonicalClosedAccountingPeriodErrorCode, 'closed guard should use canonical code');
      assertEqual(closedGuard.error.nextAction, '后续期间调整', 'closed guard should guide normal correction path');
      assertEqual(closedGuard.error.sourceModule, '应收应付', 'closed guard should preserve source module');

      if (!unknownGuard.allowed) {
        assertEqual(
          unknownGuard.error.code,
          'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED',
          'unknown period should use unresolved-period code'
        );
      }
    }
  },
  {
    name: 'reopens a closed period with event, idempotency and reopened status',
    run: () => {
      const period = createPeriod({
        closeCheckSnapshotHash: 'chk_locked',
        closedAt: '2026-07-02T18:00:00+08:00',
        closedBySnapshot: { id: 'user-001', name: '李明' },
        status: '已结账',
        version: 4
      });
      const result = reopenAccountingPeriod({
        period,
        periods: [period],
        request: createReopenRequest()
      });

      assertEqual(result.ok, true, 'closed period should be reopenable when no later closed period exists');

      if (!result.ok) {
        return;
      }

      assertEqual(result.period.status, '已反结账', 'reopen should move period to reopened status');
      assertEqual(result.period.version, 5, 'reopen should increment period version');
      assertEqual(result.period.reopenReason, '发现本期凭证需要重开处理', 'reopen should persist reason');
      assertEqual(result.event.eventType, 'reopened', 'reopen should write reopened event');
      assertEqual(result.idempotencyRecords.length, 1, 'reopen should store idempotency record');

      const replay = reopenAccountingPeriod({
        idempotencyRecords: result.idempotencyRecords,
        period,
        periods: [period],
        request: createReopenRequest()
      });

      assertEqual(replay.ok, true, 'same reopen request should replay');
      assertEqual(replay.ok ? replay.replayed : false, true, 'reopen replay should be marked');
    }
  },
  {
    name: 'rejects reopen when period is not closed, stale, or later period is closed',
    run: () => {
      const openPeriod = createPeriod({ status: '开放', version: 4 });
      const closedPeriod = createPeriod({ status: '已结账', version: 4 });
      const laterClosedPeriod = createPeriod({ period: '2026-07', status: '已结账', version: 1 });
      const notClosed = reopenAccountingPeriod({
        period: openPeriod,
        periods: [openPeriod],
        request: createReopenRequest()
      });
      const stale = reopenAccountingPeriod({
        period: closedPeriod,
        periods: [closedPeriod],
        request: createReopenRequest({ version: 3 })
      });
      const blockedByLaterPeriod = reopenAccountingPeriod({
        period: closedPeriod,
        periods: [closedPeriod, laterClosedPeriod],
        request: createReopenRequest()
      });
      const invalidReason = reopenAccountingPeriod({
        period: closedPeriod,
        periods: [closedPeriod],
        request: createReopenRequest({ reason: '   ' })
      });

      assertEqual(notClosed.ok, false, 'open period should not be reopened');
      assertEqual(notClosed.ok ? '' : notClosed.error.code, 'PERIOD_NOT_CLOSED', 'not closed reopen should use stable code');
      assertEqual(stale.ok, false, 'stale reopen request should reject');
      assertEqual(stale.ok ? '' : stale.error.code, 'PERIOD_VERSION_CONFLICT', 'stale reopen should use conflict code');
      assertEqual(blockedByLaterPeriod.ok, false, 'later closed period should block reopen');
      assertEqual(blockedByLaterPeriod.ok ? '' : blockedByLaterPeriod.error.code, 'PERIOD_REOPEN_BLOCKED', 'later closed period should use reopen blocked code');
      assertEqual(invalidReason.ok, false, 'blank reopen reason should reject');
      assertEqual(invalidReason.ok ? '' : invalidReason.error.code, 'INVALID_REOPEN_REASON', 'blank reopen reason should use stable code');
    }
  },
  {
    name: 'blocks reopen when irreversible external submissions exist without risk confirmation',
    run: () => {
      const closedPeriod = createPeriod({ status: '已结账', version: 4 });
      const result = reopenAccountingPeriod({
        irreversibleExternalSubmissions: [
          {
            accountingPeriod: '2026-06',
            description: '2026-06 增值税申报已提交税局',
            id: 'external-tax-202606',
            sourceModule: '税务办理',
            sourceNo: 'TAX-202606',
            submittedAt: '2026-07-01T09:00:00+08:00'
          }
        ],
        period: closedPeriod,
        periods: [closedPeriod],
        request: createReopenRequest()
      });

      assertEqual(result.ok, false, 'irreversible external submission should block reopen by default');
      assertEqual(result.ok ? '' : result.error.code, 'PERIOD_REOPEN_BLOCKED', 'external submission should use reopen blocked code');
      assertEqual(result.ok ? '' : result.event?.reopenImpactSnapshot?.irreversibleExternalSubmissions[0]?.sourceNo, 'TAX-202606', 'blocked event should retain external submission snapshot');
    }
  },
  {
    name: 'rejects incomplete reopen risk confirmation',
    run: () => {
      const closedPeriod = createPeriod({ status: '已结账', version: 4 });
      const laterClosedPeriod = createPeriod({ period: '2026-07', status: '已结账', version: 1 });
      const result = reopenAccountingPeriod({
        period: closedPeriod,
        periods: [closedPeriod, laterClosedPeriod],
        request: createReopenRequest({
          riskConfirmation: {
            allowLaterClosedPeriods: true,
            decisionNo: '',
            note: ' '
          }
        })
      });

      assertEqual(result.ok, false, 'incomplete risk confirmation should reject reopen');
      assertEqual(result.ok ? '' : result.error.code, 'INVALID_REOPEN_RISK_CONFIRMATION', 'incomplete risk confirmation should use stable code');
    }
  },
  {
    name: 'allows exceptional reopen with explicit risk confirmation for later closed periods and external submissions',
    run: () => {
      const closedPeriod = createPeriod({ status: '已结账', version: 4 });
      const laterClosedPeriod = createPeriod({ period: '2026-07', status: '已结账', version: 1 });
      const result = reopenAccountingPeriod({
        irreversibleExternalSubmissions: [
          {
            accountingPeriod: '2026-06',
            description: '2026-06 增值税申报已提交税局',
            id: 'external-tax-202606',
            sourceModule: '税务办理',
            sourceNo: 'TAX-202606',
            submittedAt: '2026-07-01T09:00:00+08:00'
          }
        ],
        period: closedPeriod,
        periods: [closedPeriod, laterClosedPeriod],
        request: createReopenRequest({
          riskConfirmation: {
            allowIrreversibleExternalSubmissions: true,
            allowLaterClosedPeriods: true,
            decisionNo: 'DEC-REOPEN-202606-001',
            note: '已确认后续期间和税务申报影响，允许异常反结账。'
          }
        })
      });

      assertEqual(result.ok, true, 'complete high-risk confirmation should allow exceptional reopen');

      if (!result.ok) {
        return;
      }

      assertEqual(result.period.status, '已反结账', 'exceptional reopen should still move period to reopened status');
      assertEqual(result.period.reopenRiskConfirmationSnapshot?.decisionNo, 'DEC-REOPEN-202606-001', 'period should persist risk decision number');
      assertEqual(result.period.reopenImpactSnapshot?.laterClosedPeriods[0], '2026-07', 'period should persist later closed impact');
      assertEqual(result.event.reopenImpactSnapshot?.irreversibleExternalSubmissions[0]?.sourceNo, 'TAX-202606', 'event should retain external submission impact');
    }
  }
];

for (const test of tests) {
  test.run();
}
