import {
  buildFinancialStatementReadiness,
  createCashFlowMappingVersionHash,
  createFinancialStatementSnapshot,
  resolveCashFlowMappingsForPeriod,
  type CashFlowMappingRecord,
  type FinancialStatementLedgerEntry
} from './financialStatementContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertNotEqual<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    throw new Error(`${message}. Did not expect ${String(expected)}`);
  }
}

const actor: ActorSnapshot = { id: 'user-001', name: '李明' };

function createMapping(overrides: Partial<CashFlowMappingRecord> = {}): CashFlowMappingRecord {
  return {
    activity: '经营活动',
    createdAt: '2026-07-02T10:00:00+08:00',
    createdBySnapshot: actor,
    effectivePeriod: '2026-01',
    item: '销售商品、提供劳务收到的现金',
    status: '有效',
    subjectCode: '1122',
    version: 1,
    ...overrides
  };
}

function createPeriod(overrides: Partial<AccountingPeriodRecord> = {}): AccountingPeriodRecord {
  return {
    period: '2026-06',
    status: '已结账',
    version: 3,
    ...overrides
  };
}

function createLedgerEntries(overrides: Partial<FinancialStatementLedgerEntry>[] = []): FinancialStatementLedgerEntry[] {
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
    name: 'creates stable cash-flow mapping version hash independent of row order',
    run: () => {
      const mappings = [
        createMapping({ subjectCode: '2211.01', item: '支付给职工以及为职工支付的现金' }),
        createMapping()
      ];
      const reversedMappings = [mappings[1], mappings[0]];

      assertEqual(
        createCashFlowMappingVersionHash(mappings),
        createCashFlowMappingVersionHash(reversedMappings),
        'mapping version hash should not depend on row order'
      );
    }
  },
  {
    name: 'resolves latest effective mapping for the requested accounting period',
    run: () => {
      const resolved = resolveCashFlowMappingsForPeriod({
        accountingPeriod: '2026-06',
        mappings: [
          createMapping({ effectivePeriod: '2026-01', item: '旧映射', version: 1 }),
          createMapping({ effectivePeriod: '2026-06', item: '新映射', version: 2 }),
          createMapping({ effectivePeriod: '2026-07', item: '未来映射', version: 3 })
        ]
      });

      assertEqual(resolved.length, 1, 'only one mapping should be effective for one subject');
      assertEqual(resolved[0]?.item, '新映射', 'latest mapping before or at period should win');
    }
  },
  {
    name: 'blocks formal statement snapshot when booked cash voucher counterpart lacks mapping',
    run: () => {
      const readiness = buildFinancialStatementReadiness({
        accountingPeriod: '2026-06',
        cashFlowMappings: [],
        ledgerEntries: createLedgerEntries([{ subjectCode: '1002' }, { subjectCode: '9999' }])
      });
      const result = createFinancialStatementSnapshot({
        period: createPeriod(),
        readiness,
        request: {
          generatedAt: '2026-07-02T18:30:00+08:00',
          generatedBySnapshot: actor,
          requestId: 'req-statement-001'
        }
      });

      assertEqual(readiness.canGenerateSnapshot, false, 'readiness should block missing cash-flow mapping');
      assertEqual(readiness.status, '需处理', 'readiness status should be actionable when mapping is missing');
      assertEqual(readiness.cashFlowMappingGaps.length, 1, 'missing counterpart should create one gap');
      assertEqual(result.ok, false, 'formal snapshot should reject incomplete mapping');
      assertEqual(
        result.ok ? '' : result.error.code,
        'CASH_FLOW_MAPPING_INCOMPLETE',
        'missing mapping should use stable error code'
      );
    }
  },
  {
    name: 'generates closed-period snapshot and preserves it when mappings later change',
    run: () => {
      const ledgerEntries = createLedgerEntries();
      const readiness = buildFinancialStatementReadiness({
        accountingPeriod: '2026-06',
        balanceSheetLines: [
          {
            amount: '1200.00',
            item: '应收账款',
            section: '资产',
            sourceSubjectCodes: ['1122'],
            voucherNos: ['记-202606-001']
          }
        ],
        cashFlowMappings: [createMapping()],
        ledgerEntries,
        profitStatementLines: []
      });
      const result = createFinancialStatementSnapshot({
        period: createPeriod(),
        readiness,
        request: {
          generatedAt: '2026-07-02T18:30:00+08:00',
          generatedBySnapshot: actor,
          requestId: 'req-statement-002'
        }
      });

      assertEqual(readiness.canGenerateSnapshot, true, 'complete mapping should allow formal snapshot');
      assertEqual(readiness.generalLedgerLines.length, 2, 'readiness should include close-period general-ledger subject lines');
      assertEqual(
        readiness.generalLedgerLines[0]?.sourceLedgerHash,
        readiness.sourceLedgerHash,
        'general-ledger snapshot lines should bind to the same source ledger hash'
      );
      assertEqual(result.ok, true, 'closed period with complete mapping should create snapshot');

      if (!result.ok) {
        return;
      }

      const originalSnapshotHash = result.snapshot.snapshotHash;
      const originalMappingHash = result.snapshot.cashFlowMappingVersionHash;
      const revisedReadiness = buildFinancialStatementReadiness({
        accountingPeriod: '2026-06',
        cashFlowMappings: [createMapping({ item: '调整后的映射', version: 2 })],
        ledgerEntries
      });

      assertEqual(result.snapshot.cashFlowLines[0]?.amount, '1200.00', 'cash-flow line should use cash movement');
      assertEqual(result.snapshot.generalLedgerLines.length, 2, 'formal snapshot should persist general-ledger subject lines');
      assertEqual(
        result.snapshot.generalLedgerLines.find((line) => line.subjectCode === '1002')?.debitAmount,
        '1200.00',
        'general-ledger snapshot should preserve cash-subject debit amount'
      );
      assertEqual(
        result.snapshot.generalLedgerLines.find((line) => line.subjectCode === '1122')?.creditAmount,
        '1200.00',
        'general-ledger snapshot should preserve counterpart credit amount'
      );
      assertEqual(
        result.snapshot.cashFlowLines[0]?.item,
        '销售商品、提供劳务收到的现金',
        'snapshot should keep the mapping item used at generation time'
      );
      assertNotEqual(
        revisedReadiness.cashFlowMappingVersionHash,
        originalMappingHash,
        'later mapping changes should produce a new readiness mapping hash'
      );
      assertEqual(
        result.snapshot.snapshotHash,
        originalSnapshotHash,
        'persisted snapshot should not drift after later mapping changes'
      );
    }
  },
  {
    name: 'rejects formal snapshot for an open period',
    run: () => {
      const readiness = buildFinancialStatementReadiness({
        accountingPeriod: '2026-06',
        cashFlowMappings: [createMapping()],
        ledgerEntries: createLedgerEntries()
      });
      const result = createFinancialStatementSnapshot({
        period: createPeriod({ status: '开放' }),
        readiness,
        request: {
          generatedAt: '2026-07-02T18:30:00+08:00',
          generatedBySnapshot: actor,
          requestId: 'req-statement-003'
        }
      });

      assertEqual(result.ok, false, 'open period should not create formal statement snapshot');
      assertEqual(
        result.ok ? '' : result.error.code,
        'FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED',
        'open-period snapshot rejection should use stable code'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
