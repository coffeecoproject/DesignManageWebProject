import {
  canonicalClosedAccountingPeriodErrorCode,
  requiredCloseCheckCodes,
  type CloseAccountingPeriodRequest,
  type CloseCheckRow
} from './periodCloseContract.js';
import {
  applyFinanceSourceMutationInPersistenceTransaction,
  closeAccountingPeriodInPersistenceTransaction,
  type PeriodClosePersistentState,
  type PersistentAccountingPeriodRecord,
  type PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';

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

function createPeriod(overrides: Partial<PersistentAccountingPeriodRecord> = {}): PersistentAccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
  };
}

function createCloseChecks(canPass = true): CloseCheckRow[] {
  return requiredCloseCheckCodes.map((code) => ({
    blockerCount: canPass ? 0 : code === 'voucher_booking' ? 1 : 0,
    canPass: canPass || code !== 'voucher_booking',
    code,
    label: code,
    nextModule: code === 'voucher_booking' && !canPass ? '会计凭证' : undefined,
    sources:
      code === 'voucher_booking' && !canPass
        ? [
            {
              accountingPeriod: '2026-06',
              nextAction: '完成记账',
              reason: '存在已制单未记账凭证。',
              reasonCode: 'voucher_unbooked',
              sourceId: 'voucher-001',
              sourceModule: '会计凭证',
              sourceNo: '记-202606-001',
              sourceStatus: '已制单'
            }
          ]
        : [],
    status: canPass || code !== 'voucher_booking' ? '通过' : '阻断',
    summary: canPass || code !== 'voucher_booking' ? '通过' : '存在阻断项'
  }));
}

function createSourceRecord(
  overrides: Partial<PersistentFinanceSourceRecord> = {}
): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1000.00',
    id: 'source-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-001',
    status: '未结清',
    version: 1,
    ...overrides
  };
}

function createState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {
      '2026-06': {
        checks: createCloseChecks(),
        computedAt: '2026-06-30T20:00:00+08:00',
        sourceVersionSetHash: 'src_hash_202606',
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
    periods: [createPeriod(), createPeriod({ period: '2026-07' })],
    sourceMutationEvents: [],
    sourceRecords: [
      createSourceRecord(),
      createSourceRecord({
        id: 'shared-id',
        sourceArea: 'receivable_payable',
        sourceNo: 'AR-202606-002'
      }),
      createSourceRecord({
        id: 'shared-id',
        sourceArea: 'invoice_matching',
        sourceNo: 'INV-202606-002'
      })
    ],
    ...overrides
  };
}

function createCloseRequest(overrides: Partial<CloseAccountingPeriodRequest> = {}): CloseAccountingPeriodRequest {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    idempotencyKey: 'idem-close-202606',
    now: '2026-07-02T20:30:00+08:00',
    reason: '月末结账',
    requestId: 'req-close-202606',
    version: 1,
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'persists period close snapshot, period lock, event, and idempotency atomically',
    run: () => {
      const state = createState();
      const result = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest(),
        state
      });

      assertEqual(result.ok, true, 'close should pass when all transaction checks pass');
      assertEqual(state.periods[0]?.status, '开放', 'input state should not be mutated directly');
      assertEqual(state.closeCheckSnapshots.length, 0, 'input snapshots should stay unchanged');

      if (!result.ok) {
        return;
      }

      assertEqual(result.period.status, '已结账', 'period should be locked as closed');
      assertEqual(result.period.version, 2, 'period version should increment');
      assertEqual(result.period.closeCheckSnapshotId, result.snapshot.id, 'period should reference persisted close snapshot');
      assertEqual(result.snapshot.persistedForClose, true, 'close snapshot should be marked as persisted for close');
      assertEqual(result.snapshot.runType, 'close_snapshot', 'successful close should persist close snapshot');
      assertEqual(result.state.closeCheckSnapshots.length, 1, 'transaction should commit one close snapshot');
      assertEqual(result.state.periodEvents.length, 1, 'transaction should commit one close event');
      assertEqual(result.state.idempotencyRecords.length, 1, 'transaction should commit idempotency record');
    }
  },
  {
    name: 'keeps period and close snapshots unchanged when close checks block',
    run: () => {
      const state = createState({
        checkInputs: {
          '2026-06': {
            checks: createCloseChecks(false),
            computedAt: '2026-06-30T20:00:00+08:00',
            sourceVersionSetHash: 'src_hash_blocked',
            trialBalance: {
              creditTotal: '68000.00',
              debitTotal: '68000.00',
              difference: '0.00',
              status: '平衡'
            }
          }
        }
      });
      const result = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest(),
        state
      });

      assertEqual(result.ok, false, 'blocked checks should reject close');
      assertEqual(result.ok ? '' : result.error.code, 'PERIOD_CLOSE_BLOCKED', 'blocked close should use stable code');
      assertEqual(result.state.periods[0]?.status, '开放', 'blocked close should not lock period');
      assertEqual(result.state.closeCheckSnapshots.length, 0, 'blocked close should not persist close snapshot');
      assertEqual(result.state.periodEvents.length, 1, 'blocked close may retain failed attempt event');
      assertEqual(result.state.periodEvents[0]?.eventType, 'close_attempt_failed', 'failed event should be explicit');
    }
  },
  {
    name: 'rejects close when period or close-check snapshot is not registered',
    run: () => {
      const missingPeriod = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-08',
        request: createCloseRequest(),
        state: createState()
      });
      const missingChecks = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest(),
        state: createState({ checkInputs: {} })
      });

      assertEqual(missingPeriod.ok, false, 'missing period should reject close');
      assertEqual(missingPeriod.ok ? '' : missingPeriod.error.code, 'PERIOD_NOT_FOUND', 'missing period should use stable code');
      assertEqual(missingPeriod.state.closeCheckSnapshots.length, 0, 'missing period should not persist snapshots');
      assertEqual(missingPeriod.state.periodEvents.length, 0, 'missing period should not append period event');

      assertEqual(missingChecks.ok, false, 'missing close checks should reject close');
      assertEqual(
        missingChecks.ok ? '' : missingChecks.error.code,
        'CLOSE_CHECK_NOT_FOUND',
        'missing close checks should use stable code'
      );
      assertEqual(missingChecks.state.periods[0]?.status, '开放', 'missing checks should not lock period');
      assertEqual(missingChecks.state.closeCheckSnapshots.length, 0, 'missing checks should not persist snapshots');
      assertEqual(missingChecks.state.periodEvents.length, 0, 'missing checks should not append period event');
    }
  },
  {
    name: 'replays close idempotency without duplicating snapshot or event',
    run: () => {
      const first = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest(),
        state: createState()
      });

      assertEqual(first.ok, true, 'first close should pass');

      if (!first.ok) {
        return;
      }

      const replay = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest(),
        state: first.state
      });

      assertEqual(replay.ok, true, 'same idempotency request should replay');

      if (!replay.ok) {
        return;
      }

      assertEqual(replay.replayed, true, 'replay flag should be true');
      assertEqual(replay.state.closeCheckSnapshots.length, 1, 'replay should not duplicate close snapshot');
      assertEqual(replay.state.periodEvents.length, 1, 'replay should not duplicate close event');
      assertEqual(replay.state.idempotencyRecords.length, 1, 'replay should not duplicate idempotency record');
    }
  },
  {
    name: 'keeps committed close state unchanged on close request conflicts',
    run: () => {
      const first = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest(),
        state: createState()
      });

      assertEqual(first.ok, true, 'first close should pass');

      if (!first.ok) {
        return;
      }

      const reusedKey = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest({ reason: '重复键但参数不同' }),
        state: first.state
      });
      const staleSnapshot = closeAccountingPeriodInPersistenceTransaction({
        period: '2026-06',
        request: createCloseRequest({ expectedCheckSnapshotHash: 'stale_hash', idempotencyKey: 'idem-stale-hash' }),
        state: createState()
      });

      assertEqual(reusedKey.ok, false, 'same key with different request should reject');
      assertEqual(reusedKey.ok ? '' : reusedKey.error.code, 'IDEMPOTENCY_KEY_REUSED', 'key reuse should use stable code');
      assertEqual(reusedKey.state.closeCheckSnapshots.length, 1, 'key reuse should not append snapshot');
      assertEqual(reusedKey.state.periodEvents.length, 1, 'key reuse should not append event');
      assertEqual(reusedKey.state.idempotencyRecords.length, 1, 'key reuse should not append idempotency record');

      assertEqual(staleSnapshot.ok, false, 'stale snapshot should reject');
      assertEqual(
        staleSnapshot.ok ? '' : staleSnapshot.error.code,
        'CHECK_SNAPSHOT_MISMATCH',
        'stale snapshot should use mismatch code'
      );
      assertEqual(staleSnapshot.state.closeCheckSnapshots.length, 0, 'stale snapshot should not append snapshot');
      assertEqual(staleSnapshot.state.periodEvents.length, 0, 'stale snapshot should not append event');
    }
  },
  {
    name: 'rejects closed-period source mutation without changing source row',
    run: () => {
      const state = createState({
        periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })]
      });
      const result = applyFinanceSourceMutationInPersistenceTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T20:30:00+08:00',
          requestId: 'req-source-closed'
        },
        mutation: {
          amount: '1200.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        state
      });

      assertEqual(result.ok, false, 'closed-period source mutation should reject');
      assertEqual(result.ok ? '' : result.error.code, canonicalClosedAccountingPeriodErrorCode, 'closed-period error should be canonical');
      assertEqual(result.state.sourceRecords[0]?.amount, '1000.00', 'source amount should remain unchanged');
      assertEqual(result.state.sourceRecords[0]?.version, 1, 'source version should remain unchanged');
      assertEqual(result.state.sourceMutationEvents.length, 1, 'rejection should append audit event');
      assertEqual(result.state.sourceMutationEvents[0]?.eventType, 'source_mutation_rejected', 'event should be rejection');
    }
  },
  {
    name: 'rejects missing or unresolved source rows without applying mutation',
    run: () => {
      const missingSource = applyFinanceSourceMutationInPersistenceTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T20:30:00+08:00',
          requestId: 'req-source-missing'
        },
        mutation: {
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'missing-source',
          status: '已调整'
        },
        state: createState()
      });
      const unresolvedPeriod = applyFinanceSourceMutationInPersistenceTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T20:30:00+08:00',
          requestId: 'req-source-unresolved-period'
        },
        mutation: {
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        state: createState({
          sourceRecords: [createSourceRecord({ accountingPeriod: '2026-08' })]
        })
      });

      assertEqual(missingSource.ok, false, 'missing source should reject');
      assertEqual(missingSource.ok ? '' : missingSource.error.code, 'SOURCE_NOT_FOUND', 'missing source should use stable code');
      assertEqual(missingSource.state.sourceMutationEvents.length, 0, 'missing source should not append source event');

      assertEqual(unresolvedPeriod.ok, false, 'unregistered source period should reject');
      assertEqual(
        unresolvedPeriod.ok ? '' : unresolvedPeriod.error.code,
        'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED',
        'unregistered source period should use unresolved code'
      );
      assertEqual(unresolvedPeriod.state.sourceRecords[0]?.status, '未结清', 'unresolved period should not mutate source status');
      assertEqual(unresolvedPeriod.state.sourceRecords[0]?.version, 1, 'unresolved period should not mutate source version');
      assertEqual(unresolvedPeriod.state.sourceMutationEvents.length, 1, 'unresolved period should append rejection event');
    }
  },
  {
    name: 'prioritizes closed-period rejection over stale source version',
    run: () => {
      const state = createState({
        periods: [createPeriod({ status: '已结账' }), createPeriod({ period: '2026-07' })]
      });
      const result = applyFinanceSourceMutationInPersistenceTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T20:30:00+08:00',
          requestId: 'req-source-closed-stale'
        },
        mutation: {
          expectedVersion: 99,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        state
      });

      assertEqual(result.ok, false, 'closed period should reject before source version conflict');
      assertEqual(
        result.ok ? '' : result.error.code,
        canonicalClosedAccountingPeriodErrorCode,
        'closed-period rejection should keep canonical priority'
      );
      assertEqual(result.state.sourceRecords[0]?.status, '未结清', 'closed stale mutation should not change source status');
      assertEqual(result.state.sourceRecords[0]?.version, 1, 'closed stale mutation should not change source version');
    }
  },
  {
    name: 'updates only the matching source-area row after old and target periods pass',
    run: () => {
      const result = applyFinanceSourceMutationInPersistenceTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T20:30:00+08:00',
          requestId: 'req-source-open'
        },
        mutation: {
          amount: '1500.00',
          expectedVersion: 1,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'shared-id',
          status: '已调整',
          targetAccountingPeriod: '2026-07'
        },
        state: createState()
      });

      assertEqual(result.ok, true, 'open old and target periods should allow mutation');

      if (!result.ok) {
        return;
      }

      const receivableRow = result.state.sourceRecords.find(
        (record) => record.id === 'shared-id' && record.sourceArea === 'receivable_payable'
      );
      const invoiceRow = result.state.sourceRecords.find(
        (record) => record.id === 'shared-id' && record.sourceArea === 'invoice_matching'
      );

      assertObject(receivableRow, 'receivable row should exist');
      assertObject(invoiceRow, 'invoice row should exist');
      assertEqual(receivableRow.accountingPeriod, '2026-07', 'matching row should move to target period');
      assertEqual(receivableRow.amount, '1500.00', 'matching row amount should update');
      assertEqual(receivableRow.version, 2, 'matching row version should increment');
      assertEqual(invoiceRow.accountingPeriod, '2026-06', 'same id in other source area should not change');
      assertEqual(invoiceRow.version, 1, 'same id in other source area version should stay unchanged');
      assertEqual(result.event.affectedAccountingPeriods.includes('2026-06'), true, 'old period should be checked');
      assertEqual(result.event.affectedAccountingPeriods.includes('2026-07'), true, 'target period should be checked');
    }
  },
  {
    name: 'rejects stale source version before applying mutation',
    run: () => {
      const result = applyFinanceSourceMutationInPersistenceTransaction({
        context: {
          actorSnapshot: { id: 'user-001', name: '李明' },
          now: '2026-07-02T20:30:00+08:00',
          requestId: 'req-source-stale'
        },
        mutation: {
          expectedVersion: 99,
          operation: '调整应收应付事项',
          sourceArea: 'receivable_payable',
          sourceId: 'source-001',
          status: '已调整'
        },
        state: createState()
      });

      assertEqual(result.ok, false, 'stale source version should reject');
      assertEqual(result.ok ? '' : result.error.code, 'SOURCE_VERSION_CONFLICT', 'stale source should use conflict code');
      assertEqual(result.state.sourceRecords[0]?.status, '未结清', 'stale mutation should not change source status');
      assertEqual(result.state.sourceRecords[0]?.version, 1, 'stale mutation should not change source version');
    }
  }
];

for (const test of tests) {
  test.run();
}
