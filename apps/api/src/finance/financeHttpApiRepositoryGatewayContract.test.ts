import {
  handleFinanceHttpApiRepositoryGateway,
  type FinanceHttpApiRepositoryGatewayFinancialStatementInputs,
  type FinanceHttpApiRepositoryGatewayResponse
} from './financeHttpApiRepositoryGatewayContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import { canonicalClosedAccountingPeriodErrorCode, requiredCloseCheckCodes, type CloseCheckRow } from './periodCloseContract.js';
import { createRowBackedPeriodCloseRepository } from './periodCloseDatabaseRepositoryContract.js';
import { financeSourceMutationRouteDefinitions } from './periodCloseSourceMutationRoutes.js';
import type { AccountingVoucherPersistedRecord } from './accountingVoucherLaterPeriodAdjustmentContract.js';
import type {
  PeriodClosePersistentState,
  PersistentAccountingPeriodRecord,
  PersistentFinanceSourceRecord
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

function createPeriod(overrides: Partial<PersistentAccountingPeriodRecord> = {}): PersistentAccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '开放',
    version: 1,
    ...overrides
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

function createSourceRecord(
  overrides: Partial<PersistentFinanceSourceRecord> = {}
): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1200.00',
    id: 'rp-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-001',
    status: '未结清',
    version: 1,
    ...overrides
  };
}

function createBookedAccountingVoucher(
  overrides: Partial<AccountingVoucherPersistedRecord> = {}
): AccountingVoucherPersistedRecord {
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

function createState(overrides: Partial<PeriodClosePersistentState> = {}): PeriodClosePersistentState {
  return {
    checkInputs: {
      '2026-06': {
        checks: createCloseChecks(),
        computedAt: '2026-07-02T10:00:00+08:00',
        sourceVersionSetHash: 'src-http-row-gateway-v1',
        trialBalance: {
          creditTotal: '1200.00',
          debitTotal: '1200.00',
          difference: '0.00',
          status: '平衡'
        }
      }
    },
    closeCheckSnapshots: [],
    idempotencyRecords: [],
    periodEvents: [],
    periods: [createPeriod()],
    sourceMutationEvents: [],
    sourceRecords: [createSourceRecord()],
    ...overrides
  };
}

function createRepository(overrides: Partial<PeriodClosePersistentState> = {}) {
  return createRowBackedPeriodCloseRepository({
    fallbackNow: '2026-07-02T18:00:00+08:00',
    initialState: createState(overrides)
  });
}

function createFinancialStatementInputs(): FinanceHttpApiRepositoryGatewayFinancialStatementInputs {
  return {
    cashFlowMappings: [
      {
        activity: '经营活动',
        createdAt: '2026-06-01T09:00:00+08:00',
        createdBySnapshot: { id: 'user-001', name: '李明' },
        effectivePeriod: '2026-06',
        item: '销售商品、提供劳务收到的现金',
        status: '有效',
        subjectCode: '1122',
        version: 1
      }
    ],
    ledgerEntries: [
      {
        accountingPeriod: '2026-06',
        creditAmount: '0.00',
        debitAmount: '1200.00',
        subjectCode: '1002',
        voucherId: 'voucher-001',
        voucherNo: '记-202606-001'
      },
      {
        accountingPeriod: '2026-06',
        creditAmount: '1200.00',
        debitAmount: '0.00',
        subjectCode: '1122',
        voucherId: 'voucher-001',
        voucherNo: '记-202606-001'
      }
    ],
    statementLineInputs: {
      '2026-06': {
        balanceSheetLines: [
          {
            amount: '1200.00',
            item: '银行存款',
            section: '资产',
            sourceSubjectCodes: ['1002'],
            voucherNos: ['记-202606-001']
          }
        ],
        profitStatementLines: [
          {
            amount: '1200.00',
            item: '主营业务收入',
            section: '收入',
            sourceSubjectCodes: ['6001'],
            voucherNos: ['记-202606-001']
          }
        ]
      }
    }
  };
}

function headers(overrides: Record<string, string> = {}) {
  return {
    'x-actor-id': 'user-001',
    'x-actor-name': '李明',
    'x-permission-scopes': financePeriodClosePermissionScopes.join(','),
    'x-request-id': 'req-http-row-gateway-001',
    'x-request-time': '2026-07-02T18:00:00+08:00',
    ...overrides
  };
}

function closePeriodResponse({
  idempotencyKey = 'http-row-close-001',
  repository
}: {
  idempotencyKey?: string;
  repository: ReturnType<typeof createRepository>;
}) {
  return handleFinanceHttpApiRepositoryGateway({
    repository,
    request: {
      body: {
        idempotencyKey,
        reason: '2026-06 月结',
        version: 1
      },
      headers: headers(),
      method: 'POST',
      path: '/api/finance/accounting-periods/2026-06/close'
    }
  });
}

function buildRoutePath(definition: (typeof financeSourceMutationRouteDefinitions)[number], sourceId: string) {
  const path = definition.pathPattern.source
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\\\//g, '/')
    .replace(/\(\[\^\/\]\+\)/g, encodeURIComponent(sourceId));

  if (path.includes('(') || path.includes(')') || path.includes('\\')) {
    throw new Error(`Unsupported route pattern sample generation: ${definition.operation}`);
  }

  return path;
}

function assertErrorCode(response: FinanceHttpApiRepositoryGatewayResponse, expectedCode: string) {
  assertObject(response.body, 'error body should be an object');
  assertEqual(response.body.code, expectedCode, 'error code should match');
}

const tests: UnitTest[] = [
  {
    name: 'rejects close before row-backed transaction when permission headers are missing',
    run: () => {
      const repository = createRepository();
      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            idempotencyKey: 'http-row-close-no-permission',
            reason: '2026-06 月结',
            version: 1
          },
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-06/close'
        }
      });

      assertEqual(response.status, 403, 'missing permission should reject before close');
      assertErrorCode(response, 'FORBIDDEN');
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_close_checks.length,
        0,
        'permission rejection should not persist close-check rows'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_periods[0]?.status,
        '开放',
        'permission rejection should not close period row'
      );
    }
  },
  {
    name: 'commits close through HTTP-shaped gateway into row-backed period-lock rows',
    run: () => {
      const repository = createRepository();
      const response = closePeriodResponse({ repository });

      assertEqual(response.status, 201, 'first gateway close should create a close transaction');
      assertObject(response.body, 'close response body should be an object');
      assertEqual(response.body.status, '已结账', 'close response should expose closed status');

      const periodRow = response.databaseSnapshot.periodCloseRows.accounting_periods[0];

      assert(periodRow !== undefined, 'period row should exist after close');
      assertEqual(periodRow.status, '已结账', 'row-backed gateway should persist closed period');
      assert(periodRow.close_check_snapshot_id !== undefined, 'closed period row should link close-check snapshot');
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_close_checks.length,
        1,
        'row-backed gateway should persist one close snapshot row'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_events.length,
        1,
        'row-backed gateway should persist one close event row'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_idempotency_records.length,
        1,
        'row-backed gateway should persist one idempotency row'
      );
    }
  },
  {
    name: 'replays close through HTTP-shaped gateway without duplicating row-backed evidence',
    run: () => {
      const repository = createRepository();
      const first = closePeriodResponse({ repository });
      const replay = closePeriodResponse({ repository });

      assertEqual(first.status, 201, 'first close should create the close transaction');
      assertEqual(replay.status, 200, 'idempotent replay should return success without creating new rows');
      assertObject(replay.body, 'replay response body should be an object');
      assertEqual(replay.body.replayed, true, 'replay response should expose replay flag');
      assertEqual(
        replay.databaseSnapshot.periodCloseRows.accounting_period_close_checks.length,
        1,
        'idempotent replay should not duplicate close snapshots'
      );
      assertEqual(
        replay.databaseSnapshot.periodCloseRows.accounting_period_events.length,
        1,
        'idempotent replay should not duplicate events'
      );
    }
  },
  {
    name: 'uses committed row-backed close lock to reject later source mutation through gateway',
    run: () => {
      const repository = createRepository();
      const closeResponse = closePeriodResponse({ repository });

      assertEqual(closeResponse.status, 201, 'close should pass before source mutation');

      const mutationResponse = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            amount: '1300.00',
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-source-001',
            'x-request-time': '2026-07-02T18:05:00+08:00'
          }),
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-001/adjust'
        }
      });

      assertEqual(mutationResponse.status, 409, 'closed-period source mutation should reject');
      assertErrorCode(mutationResponse, canonicalClosedAccountingPeriodErrorCode);
      assertEqual(
        mutationResponse.databaseSnapshot.sourceRecords[0]?.amount,
        '1200.00',
        'closed-period rejection should leave source amount unchanged'
      );
      assertEqual(
        mutationResponse.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period rejection should persist a guard audit row'
      );
      assertEqual(
        mutationResponse.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events[0]?.event_type,
        'source_mutation_rejected',
        'guard audit row should record rejection'
      );
    }
  },
  {
    name: 'rejects invalid source mutation payload before row-backed repository mutation',
    run: () => {
      const repository = createRepository();
      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            amount: 1300,
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-invalid-source-payload'
          }),
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-001/adjust'
        }
      });

      assertEqual(response.status, 400, 'invalid source mutation payload should return bad request');
      assertErrorCode(response, 'INVALID_REQUEST');
      assertEqual(
        response.databaseSnapshot.sourceRecords[0]?.amount,
        '1200.00',
        'invalid source mutation payload should not alter source amount'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        0,
        'invalid source mutation payload should not create guard audit rows'
      );
    }
  },
  {
    name: 'rejects formal statement snapshot generation before period close',
    run: () => {
      const repository = createRepository();
      const response = handleFinanceHttpApiRepositoryGateway({
        financialStatements: createFinancialStatementInputs(),
        repository,
        request: {
          headers: headers({
            'x-request-id': 'req-http-row-gateway-statement-open-001'
          }),
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        }
      });

      assertEqual(response.status, 422, 'open period should not create formal statement snapshot');
      assertErrorCode(response, 'FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED');
      assertEqual(
        response.databaseSnapshot.periodCloseRows.financial_statement_snapshots.length,
        0,
        'open-period statement rejection should not persist snapshot rows'
      );
    }
  },
  {
    name: 'commits formal statement snapshots through row-backed gateway into statement and ledger rows',
    run: () => {
      const repository = createRepository();
      const closeResponse = closePeriodResponse({ repository });

      assertEqual(closeResponse.status, 201, 'close should pass before formal statement snapshot');

      const response = handleFinanceHttpApiRepositoryGateway({
        financialStatements: createFinancialStatementInputs(),
        repository,
        request: {
          headers: headers({
            'x-request-id': 'req-http-row-gateway-statement-001',
            'x-request-time': '2026-07-02T19:00:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        }
      });

      assertEqual(response.status, 201, 'closed period should create formal statement snapshot');
      assertObject(response.body, 'formal statement response body should be an object');
      assertEqual(response.body.replayed, false, 'first snapshot generation should not be replayed');
      assertEqual(
        response.databaseSnapshot.periodCloseRows.financial_statement_snapshots.length,
        1,
        'row-backed gateway should persist one statement snapshot row'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.financial_statement_snapshot_lines.length,
        3,
        'row-backed gateway should persist balance sheet, profit, and cash-flow lines'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.financial_statement_general_ledger_lines.length,
        2,
        'row-backed gateway should persist subject-level general-ledger snapshot rows'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.financial_statement_general_ledger_lines[0]?.source_ledger_hash,
        response.databaseSnapshot.periodCloseRows.financial_statement_snapshots[0]?.source_ledger_hash,
        'general-ledger snapshot rows should bind to the statement snapshot source ledger hash'
      );
    }
  },
  {
    name: 'replays formal statement snapshot generation without duplicate row-backed snapshot rows',
    run: () => {
      const repository = createRepository();
      const closeResponse = closePeriodResponse({ repository });

      assertEqual(closeResponse.status, 201, 'close should pass before formal statement replay');

      const first = handleFinanceHttpApiRepositoryGateway({
        financialStatements: createFinancialStatementInputs(),
        repository,
        request: {
          headers: headers({
            'x-request-id': 'req-http-row-gateway-statement-replay-001',
            'x-request-time': '2026-07-02T19:00:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        }
      });
      const replay = handleFinanceHttpApiRepositoryGateway({
        financialStatements: {
          ...createFinancialStatementInputs(),
          ledgerEntries: [
            ...createFinancialStatementInputs().ledgerEntries,
            {
              accountingPeriod: '2026-06',
              creditAmount: '0.00',
              debitAmount: '999.00',
              subjectCode: '1002',
              voucherId: 'voucher-drift',
              voucherNo: '记-202606-DRIFT'
            }
          ]
        },
        repository,
        request: {
          headers: headers({
            'x-request-id': 'req-http-row-gateway-statement-replay-002',
            'x-request-time': '2026-07-02T19:10:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/financial-statements/2026-06/snapshots'
        }
      });

      assertEqual(first.status, 201, 'first formal statement generation should create snapshot rows');
      assertEqual(replay.status, 200, 'existing formal statement snapshot should replay');
      assertObject(replay.body, 'replay statement body should be an object');
      assertEqual(replay.body.replayed, true, 'replay statement body should expose replay flag');
      assertEqual(
        replay.databaseSnapshot.periodCloseRows.financial_statement_snapshots.length,
        1,
        'statement replay should not duplicate snapshot rows'
      );
      assertEqual(
        replay.databaseSnapshot.periodCloseRows.financial_statement_general_ledger_lines.find(
          (line) => line.subject_code === '1002'
        )?.debit_amount,
        '1200.00',
        'statement replay should preserve original ledger snapshot instead of current drift'
      );
    }
  },
  {
    name: 'applies open-period existing-source mutation through row-backed gateway',
    run: () => {
      const repository = createRepository();
      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            amount: '1300.00',
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06'
          },
          headers: headers(),
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-001/adjust'
        }
      });

      assertEqual(response.status, 200, 'open-period source mutation should apply');
      assertEqual(response.databaseSnapshot.sourceRecords[0]?.amount, '1300.00', 'source amount should update');
      assertEqual(response.databaseSnapshot.sourceRecords[0]?.version, 2, 'source version should increment');
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events[0]?.event_type,
        'source_mutation_applied',
        'open-period mutation should persist an applied guard audit row'
      );
    }
  },
  {
    name: 'tracks later-period adjustment candidate through preparation, booking, and target close',
    run: () => {
      const repository = createRepository({
        accountingVouchers: [createBookedAccountingVoucher()],
        checkInputs: {
          '2026-06': createState().checkInputs['2026-06']!,
          '2026-07': {
            checks: createCloseChecks(),
            computedAt: '2026-07-31T20:00:00+08:00',
            sourceVersionSetHash: 'src-http-row-gateway-202607',
            trialBalance: {
              creditTotal: '0.00',
              debitTotal: '0.00',
              difference: '0.00',
              status: '平衡'
            }
          }
        },
        periods: [
          createPeriod({ period: '2026-06', status: '开放', version: 1 }),
          createPeriod({ period: '2026-07', status: '开放', version: 1 })
        ],
        voucherRows: []
      });
      const closeOriginalPeriodResponse = closePeriodResponse({
        idempotencyKey: 'http-row-close-before-later-adjustment-001',
        repository
      });

      assertEqual(closeOriginalPeriodResponse.status, 201, 'original period should close before later-period adjustment');

      const adjustmentResponse = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            adjustmentDate: '2026-07-01',
            adjustmentPeriod: '2026-07',
            idempotencyKey: 'http-row-later-adjustment-001',
            reason: '历史期间收入确认口径需要在后续期间调整',
            version: 4
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-later-adjustment-001',
            'x-request-time': '2026-07-02T19:30:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/accounting-vouchers/voucher-202606-001/later-period-adjustments'
        }
      });

      assertEqual(adjustmentResponse.status, 201, 'later-period adjustment should create target-period candidate');
      assertObject(adjustmentResponse.body, 'later-period adjustment response body should be an object');
      assertEqual(
        adjustmentResponse.databaseSnapshot.laterPeriodAdjustmentFacts?.length,
        1,
        'row-backed gateway should persist one later-period adjustment fact'
      );
      assertEqual(
        adjustmentResponse.databaseSnapshot.voucherRows?.[0]?.status,
        '待制单',
        'later-period adjustment should create a pending voucher candidate row'
      );
      const pendingVoucherRow = adjustmentResponse.databaseSnapshot.voucherRows?.[0];

      if (!pendingVoucherRow) {
        throw new Error('expected persisted later-period adjustment voucher row');
      }

      const checksResponse = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          headers: headers({
            'x-request-id': 'req-http-row-gateway-later-adjustment-checks'
          }),
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-07/close-checks'
        }
      });

      assertEqual(checksResponse.status, 200, 'target period close checks should be readable');
      assertObject(checksResponse.body, 'close checks response body should be an object');
      assertEqual(checksResponse.body.canClose, false, 'target period should not close with pending adjustment candidate');

      const checks = checksResponse.body.checks;
      assert(Array.isArray(checks), 'close checks response should include check rows');
      const voucherPreparationCheck = checks.find(
        (check): check is Record<string, unknown> =>
          Boolean(check && typeof check === 'object' && 'code' in check && check.code === 'voucher_preparation')
      );

      assertObject(voucherPreparationCheck, 'voucher preparation check should be present');
      assertEqual(voucherPreparationCheck.status, '阻断', 'pending adjustment candidate should block voucher preparation');

      const pendingCloseResponse = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            idempotencyKey: 'http-row-close-202607-blocked',
            reason: '2026-07 月结',
            version: 1
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-close-202607-blocked',
            'x-request-time': '2026-07-31T20:10:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-07/close'
        }
      });

      assertEqual(pendingCloseResponse.status, 409, 'target period close should reject while adjustment candidate is pending');
      assertErrorCode(pendingCloseResponse, 'PERIOD_CLOSE_BLOCKED');

      const preparedRepository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-31T20:00:00+08:00',
        initialState: {
          ...repository.readState(),
          voucherRows: [{ ...pendingVoucherRow, status: '已制单' }]
        }
      });
      const preparedChecksResponse = handleFinanceHttpApiRepositoryGateway({
        repository: preparedRepository,
        request: {
          headers: headers({
            'x-request-id': 'req-http-row-gateway-later-adjustment-prepared-checks'
          }),
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-07/close-checks'
        }
      });

      assertEqual(preparedChecksResponse.status, 200, 'prepared target-period close checks should be readable');
      assertObject(preparedChecksResponse.body, 'prepared close checks response body should be an object');
      assertEqual(preparedChecksResponse.body.canClose, false, 'prepared but unbooked adjustment should still block target close');

      const preparedChecks = preparedChecksResponse.body.checks;
      assert(Array.isArray(preparedChecks), 'prepared close checks response should include check rows');
      const voucherBookingCheck = preparedChecks.find(
        (check): check is Record<string, unknown> =>
          Boolean(check && typeof check === 'object' && 'code' in check && check.code === 'voucher_booking')
      );

      assertObject(voucherBookingCheck, 'voucher booking check should be present');
      assertEqual(voucherBookingCheck.status, '阻断', 'prepared adjustment should block voucher booking until booked');
      assertEqual(voucherBookingCheck.blockerCount, 1, 'prepared adjustment should count as one unbooked voucher blocker');

      const preparedCloseResponse = handleFinanceHttpApiRepositoryGateway({
        repository: preparedRepository,
        request: {
          body: {
            idempotencyKey: 'http-row-close-202607-prepared-blocked',
            reason: '2026-07 月结',
            version: 1
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-close-202607-prepared-blocked',
            'x-request-time': '2026-07-31T20:20:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-07/close'
        }
      });

      assertEqual(preparedCloseResponse.status, 409, 'target period close should reject while adjustment voucher is unbooked');
      assertErrorCode(preparedCloseResponse, 'PERIOD_CLOSE_BLOCKED');

      const bookedRepository = createRowBackedPeriodCloseRepository({
        fallbackNow: '2026-07-31T20:00:00+08:00',
        initialState: {
          ...repository.readState(),
          voucherRows: [{ ...pendingVoucherRow, status: '已记账' }]
        }
      });
      const bookedChecksResponse = handleFinanceHttpApiRepositoryGateway({
        repository: bookedRepository,
        request: {
          headers: headers({
            'x-request-id': 'req-http-row-gateway-later-adjustment-booked-checks'
          }),
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-07/close-checks'
        }
      });

      assertEqual(bookedChecksResponse.status, 200, 'booked target-period close checks should be readable');
      assertObject(bookedChecksResponse.body, 'booked close checks response body should be an object');
      assertEqual(bookedChecksResponse.body.canClose, true, 'booked adjustment should allow target close when other checks pass');

      const bookedCloseResponse = handleFinanceHttpApiRepositoryGateway({
        repository: bookedRepository,
        request: {
          body: {
            idempotencyKey: 'http-row-close-202607-after-booking',
            reason: '2026-07 月结',
            version: 1
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-close-202607-after-booking',
            'x-request-time': '2026-07-31T20:30:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/accounting-periods/2026-07/close'
        }
      });

      assertEqual(bookedCloseResponse.status, 201, 'target period should close after later adjustment voucher is booked');
      assertObject(bookedCloseResponse.body, 'booked close response body should be an object');
      assertEqual(bookedCloseResponse.body.status, '已结账', 'booked target period close should persist closed status');
    }
  },
  {
    name: 'replays later-period adjustment without duplicate row-backed candidate evidence',
    run: () => {
      const repository = createRepository({
        accountingVouchers: [createBookedAccountingVoucher()],
        periods: [
          createPeriod({ period: '2026-06', status: '开放', version: 1 }),
          createPeriod({ period: '2026-07', status: '开放', version: 1 })
        ]
      });
      const closeOriginalPeriodResponse = closePeriodResponse({
        idempotencyKey: 'http-row-close-before-later-adjustment-replay',
        repository
      });

      assertEqual(closeOriginalPeriodResponse.status, 201, 'original period should close before later-period replay');

      const request = {
        body: {
          adjustmentDate: '2026-07-01',
          adjustmentPeriod: '2026-07',
          idempotencyKey: 'http-row-later-adjustment-replay',
          reason: '历史期间收入确认口径需要在后续期间调整',
          version: 4
        },
        headers: headers({
          'x-request-id': 'req-http-row-gateway-later-adjustment-replay-001',
          'x-request-time': '2026-07-02T19:30:00+08:00'
        }),
        method: 'POST',
        path: '/api/finance/accounting-vouchers/voucher-202606-001/later-period-adjustments'
      } as const;
      const first = handleFinanceHttpApiRepositoryGateway({ repository, request });
      const replay = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          ...request,
          headers: headers({
            'x-request-id': 'req-http-row-gateway-later-adjustment-replay-002',
            'x-request-time': '2026-07-02T19:40:00+08:00'
          })
        }
      });

      assertEqual(first.status, 201, 'first later-period adjustment should create candidate evidence');
      assertEqual(replay.status, 200, 'matching idempotent later-period adjustment should replay');
      assertObject(replay.body, 'later-period replay body should be an object');
      assertEqual(replay.body.replayed, true, 'later-period replay should expose replay flag');
      assertEqual(
        replay.databaseSnapshot.laterPeriodAdjustmentFacts?.length,
        1,
        'later-period replay should not duplicate adjustment facts'
      );
      assertEqual(replay.databaseSnapshot.voucherRows?.length, 1, 'later-period replay should not duplicate voucher rows');
    }
  },
  {
    name: 'creates new source records through row-backed gateway only after open-period guard passes',
    run: () => {
      const repository = createRepository();
      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            amount: '6800.00',
            sourceId: 'rp-new-001',
            sourceNo: 'AR-202606-NEW',
            targetAccountingPeriod: '2026-06'
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-create-001'
          }),
          method: 'POST',
          path: '/api/finance/receivables-payables'
        }
      });

      assertEqual(response.status, 201, 'open-period create source mutation should create a source row');
      assertEqual(response.databaseSnapshot.sourceRecords.length, 2, 'create mutation should append a source record');
      assertEqual(
        response.databaseSnapshot.sourceRecords[0]?.sourceNo,
        'AR-202606-NEW',
        'new source row should preserve source number'
      );
      assertEqual(
        response.databaseSnapshot.sourceRecords[0]?.accountingPeriod,
        '2026-06',
        'new source row should preserve target accounting period'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events[0]?.event_type,
        'source_mutation_applied',
        'open-period create should persist an applied guard audit row'
      );
    }
  },
  {
    name: 'rejects closed-period create source mutation without inserting the source row',
    run: () => {
      const repository = createRepository();
      const closeResponse = closePeriodResponse({ repository });

      assertEqual(closeResponse.status, 201, 'close should pass before create source mutation');

      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            amount: '6800.00',
            sourceId: 'rp-new-closed-001',
            sourceNo: 'AR-202606-CLOSED',
            targetAccountingPeriod: '2026-06'
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-create-closed-001',
            'x-request-time': '2026-07-02T18:10:00+08:00'
          }),
          method: 'POST',
          path: '/api/finance/receivables-payables'
        }
      });

      assertEqual(response.status, 409, 'closed-period create source mutation should reject');
      assertErrorCode(response, canonicalClosedAccountingPeriodErrorCode);
      assertEqual(response.databaseSnapshot.sourceRecords.length, 1, 'closed-period create should not insert source row');
      assertEqual(
        response.databaseSnapshot.sourceRecords.some((record) => record.id === 'rp-new-closed-001'),
        false,
        'closed-period create should not leave a partial source row'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        1,
        'closed-period create rejection should persist a guard audit row'
      );
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events[0]?.event_type,
        'source_mutation_rejected',
        'closed-period create audit row should record rejection'
      );
    }
  },
  {
    name: 'rejects every ordinary source mutation route through committed row-backed period lock',
    run: () => {
      const sourceRecords = financeSourceMutationRouteDefinitions
        .map((definition, index) =>
          definition.createsSourceRecord
            ? undefined
            : {
                definition,
                sourceId: `source-route-${index + 1}`
              }
        )
        .filter((item): item is { definition: (typeof financeSourceMutationRouteDefinitions)[number]; sourceId: string } =>
          Boolean(item)
        )
        .map(({ definition, sourceId }, index) =>
          createSourceRecord({
            accountingPeriod: '2026-06',
            amount: `${1000 + index}.00`,
            id: sourceId,
            sourceArea: definition.sourceArea,
            sourceNo: `${definition.sourceArea}-${index + 1}`,
            status: '待处理'
          })
        );
      const repository = createRepository({ sourceRecords });
      const closeResponse = closePeriodResponse({ repository });

      assertEqual(closeResponse.status, 201, 'period should close before route-matrix source mutation checks');

      financeSourceMutationRouteDefinitions.forEach((definition, index) => {
        const sourceId = `source-route-${index + 1}`;
        const existingRecord = definition.createsSourceRecord
          ? undefined
          : sourceRecords.find((record) => record.sourceArea === definition.sourceArea && record.id === sourceId);
        const beforeSourceRecords = repository.readDatabaseSnapshot().sourceRecords;
        const response = handleFinanceHttpApiRepositoryGateway({
          repository,
          request: {
            body: {
              amount: '9999.00',
              expectedVersion: 1,
              sourceId,
              sourceNo: `${definition.sourceArea}-${sourceId}`,
              targetAccountingPeriod: '2026-06'
            },
            headers: headers({
              'x-request-id': `req-http-row-gateway-source-matrix-${index + 1}`,
              'x-request-time': '2026-07-02T18:30:00+08:00'
            }),
            method: definition.method,
            path: buildRoutePath(definition, sourceId)
          }
        });
        const afterSourceRecords = response.databaseSnapshot.sourceRecords;

        assertEqual(response.status, 409, `${definition.operation} should reject after committed period close`);
        assertErrorCode(response, canonicalClosedAccountingPeriodErrorCode);

        if (definition.createsSourceRecord) {
          assertEqual(
            afterSourceRecords.some((record) => record.id === sourceId && record.sourceArea === definition.sourceArea),
            false,
            `${definition.operation} should not insert a source row in a closed period`
          );
          assertEqual(
            afterSourceRecords.length,
            beforeSourceRecords.length,
            `${definition.operation} should keep source row count unchanged`
          );
        } else {
          assert(existingRecord !== undefined, `${definition.operation} should have a fixture source record`);
          const afterRecord = afterSourceRecords.find(
            (record) => record.id === existingRecord.id && record.sourceArea === existingRecord.sourceArea
          );

          assert(afterRecord !== undefined, `${definition.operation} should keep fixture source record`);
          assertEqual(afterRecord.status, existingRecord.status, `${definition.operation} should keep source status unchanged`);
          assertEqual(afterRecord.amount, existingRecord.amount, `${definition.operation} should keep source amount unchanged`);
          assertEqual(afterRecord.version, existingRecord.version, `${definition.operation} should keep source version unchanged`);
        }
      });

      assertEqual(
        repository.readDatabaseSnapshot().periodCloseRows.accounting_period_source_mutation_events.length,
        financeSourceMutationRouteDefinitions.length,
        'row-backed gateway should persist one rejection audit row per ordinary source mutation route'
      );
    }
  },
  {
    name: 'rejects create source mutation when target accounting period is unresolved',
    run: () => {
      const repository = createRepository();
      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          body: {
            amount: '6800.00',
            sourceId: 'rp-new-unresolved-001',
            sourceNo: 'AR-UNRESOLVED'
          },
          headers: headers({
            'x-request-id': 'req-http-row-gateway-create-unresolved-001'
          }),
          method: 'POST',
          path: '/api/finance/receivables-payables'
        }
      });

      assertEqual(response.status, 400, 'unresolved create source period should reject');
      assertErrorCode(response, 'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED');
      assertEqual(response.databaseSnapshot.sourceRecords.length, 1, 'unresolved create should not insert source row');
      assertEqual(
        response.databaseSnapshot.periodCloseRows.accounting_period_source_mutation_events.length,
        0,
        'unresolved create should not persist an incomplete guard audit row'
      );
    }
  },
  {
    name: 'returns stable not-found responses for unsupported row-backed gateway routes',
    run: () => {
      const repository = createRepository();
      const response = handleFinanceHttpApiRepositoryGateway({
        repository,
        request: {
          headers: headers(),
          method: 'GET',
          path: '/api/finance/unknown'
        }
      });

      assertEqual(response.status, 404, 'unknown route should return 404');
      assertErrorCode(response, 'NOT_FOUND');
    }
  }
];

for (const test of tests) {
  test.run();
}
