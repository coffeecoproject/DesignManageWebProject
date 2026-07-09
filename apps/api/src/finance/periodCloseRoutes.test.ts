import { requiredCloseCheckCodes, type AccountingPeriodRecord, type CloseCheckCode, type CloseCheckRow } from './periodCloseContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import {
  handleFinancePeriodCloseRoute,
  type PeriodCloseRouteState,
  type PeriodCloseServerContext
} from './periodCloseRoutes.js';
import type { CashFlowMappingRecord, FinancialStatementLedgerEntry } from './financialStatementContract.js';

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

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
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

function createContext(overrides: Partial<PeriodCloseServerContext> = {}): PeriodCloseServerContext {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-02T18:00:00+08:00',
    permissionScopes: [...financePeriodClosePermissionScopes],
    requestId: 'req-route-001',
    ...overrides
  };
}

function createRouteState({
  checks = requiredCloseCheckCodes.map((code) => createCheck(code)),
  financialStatementInputs,
  periods = [createPeriod()],
  reopenExternalSubmissions,
  voucherRows,
  voucherSummaries
}: {
  checks?: CloseCheckRow[];
  financialStatementInputs?: PeriodCloseRouteState['financialStatementInputs'];
  periods?: AccountingPeriodRecord[];
  reopenExternalSubmissions?: PeriodCloseRouteState['reopenExternalSubmissions'];
  voucherRows?: PeriodCloseRouteState['voucherRows'];
  voucherSummaries?: PeriodCloseRouteState['voucherSummaries'];
} = {}): PeriodCloseRouteState {
  return {
    checkInputs: {
      '2026-06': {
        checks,
        computedAt: '2026-07-02T10:00:00+08:00',
        sourceVersionSetHash: 'src-route-v1',
        trialBalance: {
          creditTotal: '1200.00',
          debitTotal: '1200.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    },
    ...(financialStatementInputs ? { financialStatementInputs } : {}),
    idempotencyRecords: [],
    periods,
    ...(reopenExternalSubmissions ? { reopenExternalSubmissions } : {}),
    ...(voucherRows ? { voucherRows } : {}),
    ...(voucherSummaries ? { voucherSummaries } : {})
  };
}

function createCashFlowMapping(overrides: Partial<CashFlowMappingRecord> = {}): CashFlowMappingRecord {
  return {
    activity: '经营活动',
    createdAt: '2026-07-02T10:00:00+08:00',
    createdBySnapshot: { id: 'user-001', name: '李明' },
    effectivePeriod: '2026-01',
    item: '销售商品、提供劳务收到的现金',
    status: '有效',
    subjectCode: '1122',
    version: 1,
    ...overrides
  };
}

function createFinancialStatementLedgerEntries(
  overrides: Partial<FinancialStatementLedgerEntry>[] = []
): FinancialStatementLedgerEntry[] {
  return [
    {
      accountingPeriod: '2026-06',
      creditAmount: '0.00',
      debitAmount: '1200.00',
      subjectCode: '1002',
      voucherId: 'voucher-receipt-001',
      voucherNo: '记-202606-001',
      ...overrides[0]
    },
    {
      accountingPeriod: '2026-06',
      creditAmount: '1200.00',
      debitAmount: '0.00',
      subjectCode: '1122',
      voucherId: 'voucher-receipt-001',
      voucherNo: '记-202606-001',
      ...overrides[1]
    }
  ];
}

const tests: UnitTest[] = [
  {
    name: 'rejects period routes before business logic when required permission is missing',
    run: () => {
      const readResponse = handleFinancePeriodCloseRoute({
        context: createContext({ permissionScopes: [] }),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods'
        },
        state: createRouteState()
      });
      const closeResponse = handleFinancePeriodCloseRoute({
        context: createContext({ permissionScopes: ['finance.accountingPeriod.read'] }),
        request: {
          body: {
            idempotencyKey: 'route-close-forbidden',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createRouteState()
      });
      const reopenResponse = handleFinancePeriodCloseRoute({
        context: createContext({ permissionScopes: ['finance.accountingPeriod.read', 'finance.accountingPeriod.close'] }),
        request: {
          body: {
            idempotencyKey: 'route-reopen-forbidden',
            reason: '普通用户尝试反结账',
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/reopen'
        },
        state: createRouteState({
          periods: [
            createPeriod({
              closeCheckSnapshotHash: 'chk_locked',
              closedAt: '2026-07-02T18:00:00+08:00',
              closedBySnapshot: { id: 'user-001', name: '李明' },
              status: '已结账',
              version: 4
            })
          ]
        })
      });

      assertEqual(readResponse.status, 403, 'period list should require read permission');
      assertObject(readResponse.body, 'read forbidden body should be an object');
      assertEqual(readResponse.body.code, 'FORBIDDEN', 'read forbidden response should use stable code');
      assertEqual(closeResponse.status, 403, 'close route should require close permission');
      assertObject(closeResponse.body, 'close forbidden body should be an object');
      assertEqual(closeResponse.body.code, 'FORBIDDEN', 'close forbidden response should use stable code');
      assertEqual(closeResponse.state.periods[0]?.status, '开放', 'forbidden close should not mutate period state');
      assertEqual(closeResponse.state.idempotencyRecords.length, 0, 'forbidden close should not persist idempotency records');
      assertEqual(reopenResponse.status, 403, 'reopen route should require elevated reopen permission');
      assertObject(reopenResponse.body, 'reopen forbidden body should be an object');
      assertEqual(reopenResponse.body.code, 'FORBIDDEN', 'reopen forbidden response should use stable code');
      assertEqual(reopenResponse.state.periods[0]?.status, '已结账', 'forbidden reopen should not mutate period state');
    }
  },
  {
    name: 'lists accounting periods with backend-owned close and voucher summary',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods'
        },
        state: createRouteState({
          voucherSummaries: {
            '2026-06': {
              bookedVoucherCount: 8,
              preparedVoucherCount: 9,
              unbookedVoucherCount: 1
            }
          }
        })
      });

      assertEqual(response.status, 200, 'period list should return 200');
      assertObject(response.body, 'period list body should be an object');
      const items = response.body.items as Array<Record<string, unknown>>;

      assertEqual(items.length, 1, 'period list should include one period');
      assertEqual(items[0]?.period, '2026-06', 'period list should include target period');
      assertEqual(items[0]?.canClose, true, 'period list should use backend-owned canClose summary');
      assertEqual(items[0]?.closeCheckStatus, '通过', 'period list should expose check status');
      assertEqual(items[0]?.bookedVoucherCount, 8, 'period list should expose backend-owned booked voucher count');
      assertEqual(items[0]?.preparedVoucherCount, 9, 'period list should expose backend-owned prepared voucher count');
      assertEqual(items[0]?.unbookedVoucherCount, 1, 'period list should expose backend-owned unbooked voucher count');
    }
  },
  {
    name: 'lists accounting periods with voucher counts aggregated from formal voucher rows',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods'
        },
        state: createRouteState({
          voucherRows: [
            { accountingPeriod: '2026-06', id: 'voucher-prepared-001', status: '已制单' },
            { accountingPeriod: '2026-06', id: 'voucher-booked-001', status: '已记账' },
            { accountingPeriod: '2026-06', id: 'voucher-reversed-001', status: '已冲销' },
            { accountingPeriod: '2026-07', id: 'voucher-other-period-001', status: '已记账' }
          ]
        })
      });

      assertEqual(response.status, 200, 'period list with voucher rows should return 200');
      assertObject(response.body, 'period list with voucher rows body should be an object');
      const items = response.body.items as Array<Record<string, unknown>>;

      assertEqual(items[0]?.period, '2026-06', 'period list should include target period');
      assertEqual(items[0]?.preparedVoucherCount, 3, 'period list should aggregate all formal vouchers in the period');
      assertEqual(items[0]?.bookedVoucherCount, 2, 'period list should aggregate booked and reversed vouchers');
      assertEqual(items[0]?.unbookedVoucherCount, 1, 'period list should aggregate prepared but unbooked vouchers');
    }
  },
  {
    name: 'aligns close-check voucher booking blockers with formal voucher rows',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/close-checks'
        },
        state: createRouteState({
          voucherRows: [
            {
              accountingPeriod: '2026-06',
              id: 'voucher-prepared-001',
              sourceModule: '会计凭证',
              sourceNo: 'VCH-202606-001',
              status: '已制单'
            },
            { accountingPeriod: '2026-06', id: 'voucher-booked-001', status: '已记账' },
            { accountingPeriod: '2026-07', id: 'voucher-other-period-001', status: '已制单' }
          ]
        })
      });

      assertEqual(response.status, 200, 'close checks with voucher rows should return 200');
      assertObject(response.body, 'close checks with voucher rows body should be an object');
      const checks = response.body.checks as Array<Record<string, unknown>>;
      const voucherBookingCheck = checks.find((check) => check.code === 'voucher_booking');

      assertObject(voucherBookingCheck, 'voucher booking check should exist');
      assertEqual(response.body.canClose, false, 'unbooked voucher row should block period close');
      assertEqual(voucherBookingCheck.canPass, false, 'voucher booking check should fail when voucher row is unbooked');
      assertEqual(voucherBookingCheck.blockerCount, 1, 'voucher booking blocker count should match unbooked voucher rows');
      const sources = voucherBookingCheck.sources as Array<Record<string, unknown>>;
      assertEqual(sources[0]?.sourceNo, 'VCH-202606-001', 'voucher booking blocker should expose formal voucher source number');
    }
  },
  {
    name: 'derives financial-statement readiness blockers from financial statement readiness gaps',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/close-checks'
        },
        state: createRouteState({
          financialStatementInputs: {
            cashFlowMappings: [],
            ledgerEntries: createFinancialStatementLedgerEntries()
          }
        })
      });

      assertEqual(response.status, 200, 'close checks with statement readiness gaps should return 200');
      assertObject(response.body, 'close checks with statement readiness gaps body should be an object');
      const checks = response.body.checks as Array<Record<string, unknown>>;
      const financialStatementReadinessCheck = checks.find((check) => check.code === 'financial_statements');

      assertObject(financialStatementReadinessCheck, 'financial-statement readiness check should exist');
      assertEqual(response.body.canClose, false, 'statement readiness gap should block period close');
      assertEqual(financialStatementReadinessCheck.canPass, false, 'financial-statement readiness should fail when cash-flow mapping is missing');
      assertEqual(financialStatementReadinessCheck.blockerCount, 1, 'financial-statement readiness blocker count should match missing mapping gaps');
      assertEqual(
        financialStatementReadinessCheck.summary,
        '现金流量表有 1 张凭证缺少对方科目映射。',
        'financial-statement readiness summary should explain missing mapping gaps'
      );
      const sources = financialStatementReadinessCheck.sources as Array<Record<string, unknown>>;
      assertEqual(sources[0]?.sourceNo, '记-202606-001', 'financial-statement readiness blocker should expose voucher number');
      assertEqual(sources[0]?.reasonCode, 'cash_flow_mapping_missing', 'financial-statement readiness blocker should expose stable reason code');
      assertEqual(sources[0]?.sourceStatus, '待补映射', 'financial-statement readiness blocker should expose mapping action state');
    }
  },
  {
    name: 'allows financial-statement readiness when financial statement readiness is complete',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/close-checks'
        },
        state: createRouteState({
          financialStatementInputs: {
            cashFlowMappings: [createCashFlowMapping()],
            ledgerEntries: createFinancialStatementLedgerEntries()
          }
        })
      });

      assertEqual(response.status, 200, 'close checks with complete statement readiness should return 200');
      assertObject(response.body, 'complete statement readiness body should be an object');
      const checks = response.body.checks as Array<Record<string, unknown>>;
      const financialStatementReadinessCheck = checks.find((check) => check.code === 'financial_statements');

      assertObject(financialStatementReadinessCheck, 'financial-statement readiness check should exist');
      assertEqual(response.body.canClose, true, 'complete statement readiness should allow period close');
      assertEqual(financialStatementReadinessCheck.canPass, true, 'financial-statement readiness should pass when mapping is complete');
      assertEqual(financialStatementReadinessCheck.blockerCount, 0, 'financial-statement readiness should have no blockers when mapping is complete');
      assertEqual(
        financialStatementReadinessCheck.summary,
        '财务报表试算准备已具备，结账后可生成报表快照。',
        'open period financial-statement readiness should explain post-close snapshot generation'
      );
    }
  },
  {
    name: 'derives unbooked voucher summary from blocking close checks when no explicit summary exists',
    run: () => {
      const blockedChecks = requiredCloseCheckCodes.map((code) =>
        code === 'voucher_booking'
          ? createCheck(code, { blockerCount: 3, canPass: false, status: '阻断', summary: '还有 3 张已制单凭证未记账。' })
          : createCheck(code)
      );
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods'
        },
        state: createRouteState({ checks: blockedChecks })
      });

      assertEqual(response.status, 200, 'period list with blocked checks should return 200');
      assertObject(response.body, 'blocked period list body should be an object');
      const items = response.body.items as Array<Record<string, unknown>>;

      assertEqual(items[0]?.canClose, false, 'blocked voucher booking should make period not closable');
      assertEqual(items[0]?.closeCheckStatus, '阻断', 'blocked voucher booking should expose blocked check status');
      assertEqual(items[0]?.blockingCandidateCount, 3, 'period list should expose blocker total');
      assertEqual(items[0]?.preparedVoucherCount, 3, 'period list should derive prepared voucher count from voucher booking blockers');
      assertEqual(items[0]?.unbookedVoucherCount, 3, 'period list should derive unbooked voucher count from voucher booking blockers');
    }
  },
  {
    name: 'returns close checks for a period with all required groups',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/close-checks'
        },
        state: createRouteState()
      });

      assertEqual(response.status, 200, 'close checks should return 200');
      assertObject(response.body, 'close checks body should be an object');
      const checks = response.body.checks as Array<Record<string, unknown>>;

      assertEqual(response.body.period, '2026-06', 'close checks should be period scoped');
      assertEqual(response.body.canClose, true, 'passing checks should return canClose true');
      assertEqual(checks.length, requiredCloseCheckCodes.length, 'close checks should include all required groups');
      assertEqual(typeof response.body.checkSnapshotHash, 'string', 'close checks should expose snapshot hash');
    }
  },
  {
    name: 'closes period through route using server-owned actor and timestamp',
    run: () => {
      const firstResponse = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          body: {
            actorSnapshot: { id: 'client-user', name: '客户端伪造' },
            idempotencyKey: 'route-close-001',
            now: '1999-01-01T00:00:00+08:00',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createRouteState()
      });

      assertEqual(firstResponse.status, 201, 'first close should create close event');
      assertObject(firstResponse.body, 'close response body should be an object');

      assertEqual(firstResponse.body.period, '2026-06', 'close route should return period code');
      assertEqual(firstResponse.body.status, '已结账', 'close route should return closed status');
      assertEqual(firstResponse.body.closedAt, '2026-07-02T18:00:00+08:00', 'close route should use server timestamp');
      assertEqual(
        (firstResponse.body.closedBySnapshot as Record<string, unknown>).id,
        'user-001',
        'close route should use server actor'
      );
      assertEqual(typeof firstResponse.body.closeCheckSnapshotId, 'string', 'close route should expose snapshot id');
      assertEqual(typeof firstResponse.body.checkSnapshotHash, 'string', 'close route should expose snapshot hash');
      assertEqual(
        firstResponse.body.eventId,
        '2026-06:closed:2026-07-02T18:00:00+08:00:req-route-001',
        'close route should expose stable event id'
      );

      const replayResponse = handleFinancePeriodCloseRoute({
        context: createContext({ requestId: 'req-route-002' }),
        request: {
          body: {
            idempotencyKey: 'route-close-001',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: firstResponse.state
      });

      assertEqual(replayResponse.status, 200, 'same idempotent route request should replay');
      assertObject(replayResponse.body, 'replay response body should be an object');
      assertEqual(replayResponse.body.replayed, true, 'replay response should be marked');
    }
  },
  {
    name: 'rejects blocked close through route without mutating period',
    run: () => {
      const blockedChecks = requiredCloseCheckCodes.map((code) =>
        code === 'voucher_booking'
          ? createCheck(code, { blockerCount: 1, canPass: false, status: '阻断', summary: '还有 1 张已制单凭证未记账。' })
          : createCheck(code)
      );
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          body: {
            idempotencyKey: 'route-close-blocked',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createRouteState({ checks: blockedChecks })
      });

      assertEqual(response.status, 422, 'blocked close should return 422');
      assertObject(response.body, 'blocked close body should be an object');
      assertEqual(response.body.code, 'PERIOD_CLOSE_BLOCKED', 'blocked close should use stable code');
      assertEqual(response.state.periods[0]?.status, '开放', 'blocked close should not mutate period state');
    }
  },
  {
    name: 'rejects stale client close-check snapshot through route and returns current backend hash',
    run: () => {
      const state = createRouteState();
      const currentChecksResponse = handleFinancePeriodCloseRoute({
        context: createContext({ requestId: 'req-route-checks-before-close' }),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/close-checks'
        },
        state
      });

      assertEqual(currentChecksResponse.status, 200, 'current backend close checks should be readable');
      assertObject(currentChecksResponse.body, 'current close-check body should be an object');

      const response = handleFinancePeriodCloseRoute({
        context: createContext({ requestId: 'req-route-close-stale-check' }),
        request: {
          body: {
            expectedCheckSnapshotHash: 'chk_client_observed_stale',
            idempotencyKey: 'route-close-stale-check',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state
      });

      assertEqual(response.status, 422, 'stale client close-check snapshot should return 422');
      assertObject(response.body, 'stale snapshot response body should be an object');
      assertEqual(response.body.code, 'CHECK_SNAPSHOT_MISMATCH', 'stale snapshot should use stable code');
      assertEqual(
        response.body.expectedCheckSnapshotHash,
        'chk_client_observed_stale',
        'route should echo client-observed stale hash'
      );
      assertEqual(
        response.body.currentCheckSnapshotHash,
        currentChecksResponse.body.checkSnapshotHash,
        'route should expose current backend-owned hash'
      );
      assertEqual(response.state.periods[0]?.status, '开放', 'stale close-check hash should not mutate period state');
      assertEqual(response.state.idempotencyRecords.length, 0, 'stale close-check hash should not persist idempotency');
    }
  },
  {
    name: 'rejects close when formal voucher rows still have unbooked vouchers',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          body: {
            idempotencyKey: 'route-close-blocked-by-voucher-row',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createRouteState({
          voucherRows: [{ accountingPeriod: '2026-06', id: 'voucher-prepared-001', status: '已制单' }]
        })
      });

      assertEqual(response.status, 422, 'unbooked voucher row should block period close');
      assertObject(response.body, 'voucher-row blocked close body should be an object');
      assertEqual(response.body.code, 'PERIOD_CLOSE_BLOCKED', 'voucher-row blocked close should use stable code');
      assertEqual(response.state.periods[0]?.status, '开放', 'voucher-row blocked close should not mutate period state');
    }
  },
  {
    name: 'rejects close when financial statement readiness has missing cash-flow mapping',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          body: {
            idempotencyKey: 'route-close-blocked-by-statement-readiness',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createRouteState({
          financialStatementInputs: {
            cashFlowMappings: [],
            ledgerEntries: createFinancialStatementLedgerEntries()
          }
        })
      });

      assertEqual(response.status, 422, 'statement readiness gap should block period close');
      assertObject(response.body, 'statement-readiness blocked close body should be an object');
      assertEqual(response.body.code, 'PERIOD_CLOSE_BLOCKED', 'statement-readiness blocked close should use stable code');
      assertEqual(response.state.periods[0]?.status, '开放', 'statement-readiness blocked close should not mutate period state');
    }
  },
  {
    name: 'rejects stale version through route with conflict status',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          body: {
            idempotencyKey: 'route-close-stale',
            reason: '2026-06 月结',
            version: 0
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createRouteState()
      });

      assertEqual(response.status, 409, 'stale version should return conflict');
      assertObject(response.body, 'conflict body should be an object');
      assertEqual(response.body.code, 'PERIOD_VERSION_CONFLICT', 'stale version should use conflict code');
    }
  },
  {
    name: 'reopens period through route using server-owned actor and timestamp',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext({ now: '2026-07-03T09:00:00+08:00', requestId: 'req-route-reopen-001' }),
        request: {
          body: {
            actorSnapshot: { id: 'client-user', name: '客户端伪造' },
            idempotencyKey: 'route-reopen-001',
            now: '1999-01-01T00:00:00+08:00',
            reason: '发现本期凭证需要重开处理',
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/reopen'
        },
        state: createRouteState({
          periods: [
            createPeriod({
              closeCheckSnapshotHash: 'chk_locked',
              closedAt: '2026-07-02T18:00:00+08:00',
              closedBySnapshot: { id: 'user-001', name: '李明' },
              status: '已结账',
              version: 4
            })
          ]
        })
      });

      assertEqual(response.status, 201, 'first reopen should create reopen event');
      assertObject(response.body, 'reopen response body should be an object');

      assertEqual(response.body.period, '2026-06', 'reopen route should return period code');
      assertEqual(response.body.status, '已反结账', 'reopen route should return reopened status');
      assertEqual(response.body.reopenedAt, '2026-07-03T09:00:00+08:00', 'reopen route should use server timestamp');
      assertEqual(
        (response.body.reopenedBySnapshot as Record<string, unknown>).id,
        'user-001',
        'reopen route should use server actor'
      );
      assertEqual(
        response.body.eventId,
        '2026-06:reopened:2026-07-03T09:00:00+08:00:req-route-reopen-001',
        'reopen route should expose stable event id'
      );

      const replayResponse = handleFinancePeriodCloseRoute({
        context: createContext({ now: '2026-07-03T09:30:00+08:00', requestId: 'req-route-reopen-002' }),
        request: {
          body: {
            idempotencyKey: 'route-reopen-001',
            reason: '发现本期凭证需要重开处理',
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/reopen'
        },
        state: response.state
      });

      assertEqual(replayResponse.status, 200, 'same reopen route request should replay');
      assertObject(replayResponse.body, 'reopen replay response body should be an object');
      assertEqual(replayResponse.body.replayed, true, 'reopen replay response should be marked');
    }
  },
  {
    name: 'rejects reopen when later accounting period is closed',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          body: {
            idempotencyKey: 'route-reopen-blocked',
            reason: '发现本期凭证需要重开处理',
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/reopen'
        },
        state: createRouteState({
          periods: [
            createPeriod({ period: '2026-06', status: '已结账', version: 4 }),
            createPeriod({ period: '2026-07', status: '已结账', version: 1 })
          ]
        })
      });

      assertEqual(response.status, 409, 'later closed period should return conflict');
      assertObject(response.body, 'reopen blocked body should be an object');
      assertEqual(response.body.code, 'PERIOD_REOPEN_BLOCKED', 'later closed period should use reopen blocked code');
      assertEqual(response.state.periods.find((period) => period.period === '2026-06')?.status, '已结账', 'blocked reopen should not mutate period state');
    }
  },
  {
    name: 'rejects reopen through route when irreversible external submissions exist without confirmation',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext({ requestId: 'req-route-reopen-external-blocked' }),
        request: {
          body: {
            idempotencyKey: 'route-reopen-external-blocked',
            reason: '发现本期凭证需要重开处理',
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/reopen'
        },
        state: createRouteState({
          periods: [createPeriod({ period: '2026-06', status: '已结账', version: 4 })],
          reopenExternalSubmissions: [
            {
              accountingPeriod: '2026-06',
              description: '2026-06 增值税申报已提交税局',
              id: 'external-tax-202606',
              sourceModule: '税务办理',
              sourceNo: 'TAX-202606',
              submittedAt: '2026-07-01T09:00:00+08:00'
            }
          ]
        })
      });

      assertEqual(response.status, 409, 'external submission risk should return conflict');
      assertObject(response.body, 'external blocked body should be an object');
      assertEqual(response.body.code, 'PERIOD_REOPEN_BLOCKED', 'external submission should use reopen blocked code');
      assertEqual(
        response.state.periods.find((period) => period.period === '2026-06')?.status,
        '已结账',
        'external blocked reopen should not mutate period state'
      );
    }
  },
  {
    name: 'allows exceptional reopen through route with explicit risk confirmation',
    run: () => {
      const response = handleFinancePeriodCloseRoute({
        context: createContext({ now: '2026-07-03T10:00:00+08:00', requestId: 'req-route-reopen-risk-confirmed' }),
        request: {
          body: {
            idempotencyKey: 'route-reopen-risk-confirmed',
            reason: '发现本期凭证需要重开处理',
            riskConfirmation: {
              allowIrreversibleExternalSubmissions: true,
              allowLaterClosedPeriods: true,
              decisionNo: 'DEC-REOPEN-202606-001',
              note: '已确认后续期间和税务申报影响，允许异常反结账。'
            },
            version: 4
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/reopen'
        },
        state: createRouteState({
          periods: [
            createPeriod({ period: '2026-06', status: '已结账', version: 4 }),
            createPeriod({ period: '2026-07', status: '已结账', version: 1 })
          ],
          reopenExternalSubmissions: [
            {
              accountingPeriod: '2026-06',
              description: '2026-06 增值税申报已提交税局',
              id: 'external-tax-202606',
              sourceModule: '税务办理',
              sourceNo: 'TAX-202606',
              submittedAt: '2026-07-01T09:00:00+08:00'
            }
          ]
        })
      });

      assertEqual(response.status, 201, 'confirmed risk reopen should create reopen event');
      assertObject(response.body, 'risk confirmed response body should be an object');
      assertObject(
        response.body.reopenRiskConfirmationSnapshot,
        'risk confirmed response should include risk confirmation snapshot'
      );
      assertObject(response.body.reopenImpactSnapshot, 'risk confirmed response should include impact snapshot');
      assertEqual(
        response.body.reopenRiskConfirmationSnapshot.decisionNo,
        'DEC-REOPEN-202606-001',
        'risk confirmed response should expose decision number'
      );
      assertEqual(response.body.status, '已反结账', 'risk confirmed response should return reopened status');
      assertEqual(
        response.state.periods.find((period) => period.period === '2026-06')?.reopenRiskConfirmationSnapshot
          ?.decisionNo,
        'DEC-REOPEN-202606-001',
        'route state should persist risk confirmation snapshot'
      );
    }
  },
  {
    name: 'returns stable errors for invalid request and missing route',
    run: () => {
      const invalidBodyResponse = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          body: {
            reason: '缺少版本和幂等键'
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        },
        state: createRouteState()
      });
      const missingRouteResponse = handleFinancePeriodCloseRoute({
        context: createContext(),
        request: {
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/archive'
        },
        state: createRouteState()
      });

      assertEqual(invalidBodyResponse.status, 400, 'invalid close body should return 400');
      assertObject(invalidBodyResponse.body, 'invalid body response should be an object');
      assertEqual(invalidBodyResponse.body.code, 'INVALID_REQUEST', 'invalid body should use request error code');
      assertEqual(missingRouteResponse.status, 404, 'missing route should return 404');
      assertObject(missingRouteResponse.body, 'missing route response should be an object');
      assertEqual(missingRouteResponse.body.code, 'NOT_FOUND', 'missing route should use not-found code');
    }
  }
];

for (const test of tests) {
  test.run();
}
