import {
  buildPublicAccountRef,
  publicAccountSeeds
} from '../system/PublicAccountConfigState';
import {
  buildBankStatementImportPrecheck,
  buildBankStatementUniqueKey,
  getBankStatementMissingFieldLabels,
  requiredBankStatementImportFieldLabels,
  type BankStatementRecord
} from './financeBankImportContract';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createBankRow(overrides: Partial<BankStatementRecord> = {}): BankStatementRecord {
  const selectedPublicAccount = buildPublicAccountRef(publicAccountSeeds[0]);

  return {
    amount: 1000,
    balance: 100000,
    bankSerialNo: 'CMB-TEST-001',
    batchNo: '导入预览',
    counterparty: '测试客户',
    direction: '入账',
    id: 'bank-row-test',
    importedAccountName: selectedPublicAccount.publicAccountSnapshot.displayName,
    importedAt: '2026-06-25 10:00',
    matchedTransactionIds: [],
    matchReason: '测试行',
    matchScore: 40,
    matchStatus: '银行未匹配',
    publicAccountId: selectedPublicAccount.publicAccountId,
    publicAccountSnapshot: selectedPublicAccount.publicAccountSnapshot,
    statementDate: '2026-06-15',
    summary: '测试回款',
    ...overrides
  };
}

const selectedPublicAccount = buildPublicAccountRef(publicAccountSeeds[0]);
const otherPublicAccount = buildPublicAccountRef(publicAccountSeeds[1]);

const tests: UnitTest[] = [
  {
    name: 'defines required bank-statement import field contract',
    run: () => {
      assertEqual(
        requiredBankStatementImportFieldLabels.join('|'),
        '账户名称|交易日期|银行流水号|收支方向|交易金额|对方户名|摘要',
        'field labels should match the frontend import contract'
      );

      const invalidRow = createBankRow({
        amount: 0,
        bankSerialNo: ' ',
        statementDate: '2026/06/15',
        summary: ''
      });

      assertEqual(
        getBankStatementMissingFieldLabels(invalidRow).join('|'),
        '交易日期|银行流水号|交易金额|摘要',
        'missing-field validation should expose the broken contract fields'
      );
    }
  },
  {
    name: 'uses public account id and bank serial number as the import unique key',
    run: () => {
      assertEqual(
        buildBankStatementUniqueKey(createBankRow({ bankSerialNo: ' CMB-TEST-001 ' })),
        `${selectedPublicAccount.publicAccountId}::CMB-TEST-001`,
        'unique key should normalize account id and bank serial number'
      );
      assertEqual(
        buildBankStatementUniqueKey(createBankRow({ ...otherPublicAccount, bankSerialNo: 'CMB-TEST-001' })),
        `${otherPublicAccount.publicAccountId}::CMB-TEST-001`,
        'same bank serial number on another account should not share the same unique key'
      );
    }
  },
  {
    name: 'skips existing duplicates and keeps valid unmatched exceptions importable',
    run: () => {
      const existingRows = [createBankRow({ bankSerialNo: 'CMB-TEST-001', id: 'existing-001' })];
      const duplicateRow = createBankRow({ bankSerialNo: 'CMB-TEST-001', id: 'preview-duplicate' });
      const newRow = createBankRow({ bankSerialNo: 'CMB-TEST-002', id: 'preview-new' });
      const exceptionRow = createBankRow({
        bankSerialNo: 'CMB-TEST-003',
        id: 'preview-exception',
        matchStatus: '金额不一致'
      });
      const result = buildBankStatementImportPrecheck({
        existingRows,
        previewRows: [duplicateRow, newRow, exceptionRow],
        requiredPeriodCounts: [
          { count: 1, period: '2026-05' },
          { count: 2, period: '2026-06' }
        ],
        selectedPublicAccount
      });

      assertEqual(result.summary.duplicateCount, 1, 'existing duplicate should be counted');
      assertEqual(result.summary.importableCount, 2, 'new valid rows should enter the import pool');
      assertEqual(result.summary.amountMismatchCount, 1, 'amount mismatches should stay visible but not block import');
      assertEqual(result.importableRows.map((record) => record.id).join('|'), 'preview-new|preview-exception', 'importable row order should be stable');
      assertEqual(result.duplicateRowIds.has('preview-duplicate'), true, 'duplicate row id should be tracked for UI handling');
      assertEqual(result.uncoveredPeriodCounts.map((item) => `${item.period}:${item.count}`).join('|'), '2026-05:1', 'uncovered suggested periods should remain visible');
      assertEqual(result.hasBlockingIssue, false, 'duplicates and matching exceptions should not block the whole file');
    }
  },
  {
    name: 'blocks account mismatches and missing required fields',
    run: () => {
      const accountMismatchRow = createBankRow({
        bankSerialNo: 'CMB-TEST-004',
        id: 'account-mismatch',
        importedAccountName: '未配置账户'
      });
      const accountIdMismatchRow = createBankRow({
        bankSerialNo: 'CMB-TEST-005',
        id: 'account-id-mismatch',
        importedAccountName: selectedPublicAccount.publicAccountSnapshot.displayName,
        publicAccountId: otherPublicAccount.publicAccountId,
        publicAccountSnapshot: otherPublicAccount.publicAccountSnapshot
      });
      const missingFieldRow = createBankRow({
        bankSerialNo: '',
        id: 'missing-field'
      });
      const result = buildBankStatementImportPrecheck({
        existingRows: [],
        previewRows: [accountMismatchRow, accountIdMismatchRow, missingFieldRow],
        requiredPeriodCounts: [],
        selectedPublicAccount
      });

      assertEqual(result.summary.accountMismatchCount, 2, 'unrecognized account and wrong account id should be counted');
      assertEqual(result.summary.invalidFieldCount, 1, 'missing required fields should be counted');
      assertEqual(result.summary.importableCount, 0, 'blocked rows should not be importable');
      assertEqual(result.blockedRowIds.has('account-mismatch'), true, 'account mismatch should block the row');
      assertEqual(result.blockedRowIds.has('account-id-mismatch'), true, 'account id mismatch should block the row');
      assertEqual(result.blockedRowIds.has('missing-field'), true, 'missing fields should block the row');
      assertEqual(result.hasBlockingIssue, true, 'blocking rows should disable import');
    }
  },
  {
    name: 'blocks import when no enabled reconciliation account is selected',
    run: () => {
      const row = createBankRow({ id: 'no-account-selected' });
      const result = buildBankStatementImportPrecheck({
        existingRows: [],
        previewRows: [row],
        requiredPeriodCounts: [],
        selectedPublicAccount: undefined
      });

      assertEqual(result.summary.accountMismatchCount, 1, 'row should be treated as account mismatch without selected account');
      assertEqual(result.importableRows.length, 0, 'no rows should be importable without selected account');
      assertEqual(result.blockedRowIds.has('no-account-selected'), true, 'row should be blocked without selected account');
      assertEqual(result.hasBlockingIssue, true, 'missing selected account should block import');
      assertEqual(result.items[0]?.level, '阻断', 'account precheck should be blocking');
    }
  },
  {
    name: 'skips duplicate rows inside the same import file',
    run: () => {
      const firstRow = createBankRow({ bankSerialNo: 'CMB-TEST-005', id: 'file-row-first' });
      const secondRow = createBankRow({ bankSerialNo: 'CMB-TEST-005', id: 'file-row-second' });
      const result = buildBankStatementImportPrecheck({
        existingRows: [],
        previewRows: [firstRow, secondRow],
        requiredPeriodCounts: [],
        selectedPublicAccount
      });

      assertEqual(result.summary.importableCount, 1, 'first in-file unique key should be importable');
      assertEqual(result.summary.duplicateCount, 1, 'second in-file unique key should be skipped');
      assertEqual(result.importableRowIds.has('file-row-first'), true, 'first duplicate group row should import');
      assertEqual(result.duplicateRowIds.has('file-row-second'), true, 'second duplicate group row should skip');
    }
  }
];

export function runFinanceBankImportContractTests() {
  const failures: string[] = [];
  let passed = 0;

  tests.forEach((test) => {
    try {
      test.run();
      passed += 1;
    } catch (error) {
      failures.push(`${test.name}: ${(error as Error).message}`);
    }
  });

  return {
    failures,
    passed,
    total: tests.length
  };
}
