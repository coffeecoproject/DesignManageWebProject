import {
  createStableSnapshotHash,
  requiredCloseCheckCodes,
  type AccountingPeriodRecord,
  type CloseCheckRow
} from './periodCloseContract.js';
import { createAccountingVoucherLedgerRepository } from './accountingVoucherLedgerRepositoryContract.js';
import { handleAccountingVoucherLedgerHttpApiGateway } from './accountingVoucherLedgerHttpApiGatewayContract.js';
import type {
  AccountingVoucherLifecycleLine,
  AccountingVoucherLifecycleRecord,
  AccountingVoucherSourceSnapshot,
  GeneralLedgerLifecycleRow
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

type VoucherGatewaySuccessBody = {
  ledgerRows: GeneralLedgerLifecycleRow[];
  replayed: boolean;
  voucher: AccountingVoucherLifecycleRecord;
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

function assertVoucherGatewaySuccessBody(value: unknown, message: string): asserts value is VoucherGatewaySuccessBody {
  assertObject(value, message);
  assert(Array.isArray(value.ledgerRows), `${message}: ledgerRows missing`);
  assert(typeof value.replayed === 'boolean', `${message}: replayed missing`);
  assertObject(value.voucher, `${message}: voucher missing`);
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
        sourceVersionSetHash: 'src-accounting-voucher-http-gateway-202606',
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
    'x-request-id': 'req-accounting-voucher-http-gateway',
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
    name: 'handles prepare and book requests through accounting-voucher gateway',
    run: () => {
      const repository = createAccountingVoucherLedgerRepository();
      const sourceSnapshot = createSourceSnapshot();
      const prepared = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            expectedSourceHash: sourceSnapshot.sourceHash,
            idempotencyKey: 'idem-http-prepare',
            lines: createVoucherLines(),
            sourceSnapshot
          },
          headers: headers(),
          method: 'POST',
          path: '/api/finance/accounting-vouchers/prepare'
        }
      });

      assertEqual(prepared.status, 201, 'prepare request should create prepared voucher');
      assertVoucherGatewaySuccessBody(prepared.body, 'prepare response should include voucher payload');
      assertEqual(prepared.body.voucher.status, '已制单', 'prepared voucher should be in prepared status');
      assertEqual(prepared.body.voucher.preparedBySnapshot.name, '李明', 'prepare actor should come from request headers');
      assertEqual(prepared.body.voucher.preparedAt, '2026-06-30T20:00:00+08:00', 'prepare time should come from header');
      assertEqual(prepared.accountingVoucherSnapshot.voucherRows[0]?.status, '已制单', 'snapshot should expose prepared voucher row');

      const preparedCloseChecks = readCloseChecksFromVoucherRows(prepared.accountingVoucherSnapshot.voucherRows);

      assertEqual(preparedCloseChecks.status, 200, 'prepared close checks should be readable');
      assertObject(preparedCloseChecks.body, 'prepared close checks body should be an object');
      assertEqual(preparedCloseChecks.body.canClose, false, 'prepared but unbooked voucher should block close checks');

      const preparedRows = preparedCloseChecks.body.checks;
      assert(Array.isArray(preparedRows), 'close checks should include rows');
      const bookingCheck = preparedRows.find(
        (row): row is Record<string, unknown> =>
          Boolean(row && typeof row === 'object' && 'code' in row && row.code === 'voucher_booking')
      );

      assertObject(bookingCheck, 'voucher booking check should exist');
      assertEqual(bookingCheck.status, '阻断', 'prepared voucher should block voucher booking');

      const prepareReplay = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            expectedSourceHash: sourceSnapshot.sourceHash,
            idempotencyKey: 'idem-http-prepare',
            lines: createVoucherLines(),
            sourceSnapshot
          },
          headers: headers({ 'x-request-id': 'req-accounting-voucher-http-gateway-replay' }),
          method: 'POST',
          path: '/api/finance/accounting-vouchers/prepare'
        }
      });

      assertEqual(prepareReplay.status, 200, 'prepare replay should return success without duplicate mutation');
      assertVoucherGatewaySuccessBody(prepareReplay.body, 'prepare replay response should include voucher payload');
      assertEqual(prepareReplay.body.replayed, true, 'prepare replay should be marked');
      assertEqual(repository.readSnapshot().vouchers.length, 1, 'prepare replay should not duplicate voucher');

      const booked = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            idempotencyKey: 'idem-http-book',
            version: prepared.body.voucher.version
          },
          headers: headers({ 'x-request-time': '2026-06-30T20:05:00+08:00' }),
          method: 'POST',
          path: `/api/finance/accounting-vouchers/${prepared.body.voucher.id}/book`
        }
      });

      assertEqual(booked.status, 201, 'book request should book prepared voucher');
      assertVoucherGatewaySuccessBody(booked.body, 'book response should include voucher payload');
      assertEqual(booked.body.voucher.status, '已记账', 'booked voucher should be posted');
      assertEqual(booked.body.ledgerRows.length, 2, 'book response should include generated ledger rows');
      assertEqual(booked.accountingVoucherSnapshot.voucherRows[0]?.status, '已记账', 'snapshot should expose booked voucher row');

      const bookedCloseChecks = readCloseChecksFromVoucherRows(booked.accountingVoucherSnapshot.voucherRows);

      assertObject(bookedCloseChecks.body, 'booked close checks body should be an object');
      assertEqual(bookedCloseChecks.body.canClose, true, 'booked voucher should clear voucher blocker');

      const bookReplay = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            idempotencyKey: 'idem-http-book',
            version: booked.body.voucher.version
          },
          headers: headers({ 'x-request-id': 'req-accounting-voucher-http-gateway-book-replay' }),
          method: 'POST',
          path: `/api/finance/accounting-vouchers/${prepared.body.voucher.id}/book`
        }
      });

      assertEqual(bookReplay.status, 200, 'book replay should return success');
      assertVoucherGatewaySuccessBody(bookReplay.body, 'book replay response should include voucher payload');
      assertEqual(bookReplay.body.replayed, true, 'book replay should be marked');
      assertEqual(repository.readSnapshot().ledgerRows.length, 2, 'book replay should not duplicate ledger rows');
    }
  },
  {
    name: 'rejects missing permission and stale voucher version before mutation',
    run: () => {
      const repository = createAccountingVoucherLedgerRepository();
      const sourceSnapshot = createSourceSnapshot();
      const missingPreparePermission = financePeriodClosePermissionScopes
        .filter((scope) => scope !== 'finance.accountingVoucher.prepare')
        .join(',');
      const forbidden = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            expectedSourceHash: sourceSnapshot.sourceHash,
            idempotencyKey: 'idem-http-forbidden-prepare',
            lines: createVoucherLines(),
            sourceSnapshot
          },
          headers: headers({ 'x-permission-scopes': missingPreparePermission }),
          method: 'POST',
          path: '/api/finance/accounting-vouchers/prepare'
        }
      });

      assertEqual(forbidden.status, 403, 'prepare without permission should be forbidden');
      assertObject(forbidden.body, 'forbidden response should include stable body');
      assertEqual(forbidden.body.code, 'FORBIDDEN', 'forbidden response should use stable code');
      assertEqual(repository.readSnapshot().vouchers.length, 0, 'forbidden prepare should not persist voucher');

      const prepared = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            expectedSourceHash: sourceSnapshot.sourceHash,
            idempotencyKey: 'idem-http-version-prepare',
            lines: createVoucherLines(),
            sourceSnapshot
          },
          headers: headers(),
          method: 'POST',
          path: '/api/finance/accounting-vouchers/prepare'
        }
      });

      assertVoucherGatewaySuccessBody(prepared.body, 'version fixture prepare should succeed');

      const versionConflict = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            idempotencyKey: 'idem-http-version-book',
            version: prepared.body.voucher.version + 1
          },
          headers: headers(),
          method: 'POST',
          path: `/api/finance/accounting-vouchers/${prepared.body.voucher.id}/book`
        }
      });

      assertEqual(versionConflict.status, 409, 'stale book version should reject before mutation');
      assertObject(versionConflict.body, 'version conflict response should include stable body');
      assertEqual(versionConflict.body.code, 'VERSION_CONFLICT', 'stale version should use stable code');
      assertEqual(repository.readSnapshot().ledgerRows.length, 0, 'stale version should not persist ledger rows');
    }
  },
  {
    name: 'handles reverse request and closed-period rejection through gateway',
    run: () => {
      const repository = createAccountingVoucherLedgerRepository();
      const sourceSnapshot = createSourceSnapshot();
      const prepared = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            expectedSourceHash: sourceSnapshot.sourceHash,
            idempotencyKey: 'idem-http-reverse-prepare',
            lines: createVoucherLines(),
            sourceSnapshot
          },
          headers: headers(),
          method: 'POST',
          path: '/api/finance/accounting-vouchers/prepare'
        }
      });

      assertVoucherGatewaySuccessBody(prepared.body, 'reverse fixture prepare should succeed');

      const booked = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            idempotencyKey: 'idem-http-reverse-book',
            version: prepared.body.voucher.version
          },
          headers: headers(),
          method: 'POST',
          path: `/api/finance/accounting-vouchers/${prepared.body.voucher.id}/book`
        }
      });

      assertVoucherGatewaySuccessBody(booked.body, 'reverse fixture book should succeed');
      const bookedVoucherId = booked.body.voucher.id;

      const reversed = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06')],
        repository,
        request: {
          body: {
            idempotencyKey: 'idem-http-reverse',
            reason: '开放期间发现确认口径错误，需要冲销重做',
            version: booked.body.voucher.version
          },
          headers: headers({ 'x-request-time': '2026-06-30T20:10:00+08:00' }),
          method: 'POST',
          path: `/api/finance/accounting-vouchers/${bookedVoucherId}/reverse`
        }
      });

      assertEqual(reversed.status, 201, 'reverse request should create reversal voucher');
      assertVoucherGatewaySuccessBody(reversed.body, 'reverse response should include voucher payload');
      assertEqual(reversed.body.voucher.businessType, '冲销凭证', 'reverse response should expose reversal voucher');
      assertEqual(reversed.body.voucher.status, '已记账', 'reversal voucher should be posted immediately');
      assertEqual(reversed.body.ledgerRows.length, 2, 'reverse response should include reversal ledger rows');
      assertEqual(
        reversed.accountingVoucherSnapshot.vouchers.find((voucher) => voucher.id === bookedVoucherId)?.status,
        '已冲销',
        'original voucher should become reversed'
      );
      assertEqual(reversed.accountingVoucherSnapshot.ledgerRows.length, 4, 'reverse should append ledger rows');

      const closedRepository = createAccountingVoucherLedgerRepository();
      const closedPrepare = handleAccountingVoucherLedgerHttpApiGateway({
        periods: [createPeriod('2026-06', '已结账')],
        repository: closedRepository,
        request: {
          body: {
            expectedSourceHash: sourceSnapshot.sourceHash,
            idempotencyKey: 'idem-http-closed-prepare',
            lines: createVoucherLines(),
            sourceSnapshot
          },
          headers: headers(),
          method: 'POST',
          path: '/api/finance/accounting-vouchers/prepare'
        }
      });

      assertEqual(closedPrepare.status, 409, 'closed-period prepare should reject');
      assertObject(closedPrepare.body, 'closed-period response should include stable body');
      assertEqual(closedPrepare.body.code, 'CLOSED_ACCOUNTING_PERIOD', 'closed-period response should use stable code');
      assertEqual(closedRepository.readSnapshot().vouchers.length, 0, 'closed-period prepare should not persist voucher');
      assertEqual(closedRepository.readSnapshot().ledgerRows.length, 0, 'closed-period prepare should not persist ledger rows');
    }
  }
];

for (const test of tests) {
  test.run();
}
