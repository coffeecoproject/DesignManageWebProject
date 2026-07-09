import {
  accountingSubjectProfile,
  accountingSubjectSeedRows,
  buildAccountingSubjectMetrics,
  defaultAccountingSubjectFilters,
  matchesAccountingSubjectFilters
} from './financeAccountingSubjectData';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

const tests: UnitTest[] = [
  {
    name: 'builds accounting subject coverage metrics from enabled rows',
    run: () => {
      const metrics = buildAccountingSubjectMetrics(accountingSubjectSeedRows);

      assertEqual(metrics.enabledCount, 45, 'enabled subject count should include small-enterprise parent and detail subjects');
      assertEqual(metrics.standardCount, 45, 'standard count should include built-in standard subjects');
      assertEqual(metrics.balanceSheetCount, 31, 'balance sheet count should include asset, liability, and equity subjects');
      assertEqual(metrics.profitStatementCount, 14, 'profit statement count should include profit and loss subjects');
      assertEqual(metrics.cashFlowMappedCount, 31, 'cash-flow mapped count should include counterpart subjects used by cash vouchers');
    }
  },
  {
    name: 'keeps subject profile aligned to small-enterprise small-scale taxpayer scope',
    run: () => {
      const requiredSubjectCodes = [
        '1001',
        '1002',
        '1122',
        '1123',
        '1601',
        '1602',
        '2001',
        '2202',
        '2203',
        '2211.01',
        '2221.01',
        '2241',
        '3001',
        '3103',
        '3104',
        '5001',
        '5051',
        '5401',
        '5403',
        '5602',
        '5602.03',
        '5801'
      ];
      const missingCodes = requiredSubjectCodes.filter(
        (code) => !accountingSubjectSeedRows.some((row) => row.code === code)
      );

      assertEqual(accountingSubjectProfile.accountingStandard, '小企业会计准则', 'profile should use small enterprise standard');
      assertEqual(accountingSubjectProfile.taxpayerType, '小规模纳税人', 'profile should use small-scale taxpayer scope');
      assertEqual(missingCodes.length, 0, `required subject codes should exist: ${missingCodes.join(', ')}`);
    }
  },
  {
    name: 'filters accounting subjects by type, statement target, status, and keyword',
    run: () => {
      const bankSubject = accountingSubjectSeedRows.find((row) => row.code === '1002');
      const incomeSubject = accountingSubjectSeedRows.find((row) => row.code === '5001');
      const payrollSubject = accountingSubjectSeedRows.find((row) => row.code === '2211');

      if (!bankSubject || !incomeSubject || !payrollSubject) {
        throw new Error('expected seed subjects to exist');
      }

      assertEqual(
        matchesAccountingSubjectFilters(bankSubject, { ...defaultAccountingSubjectFilters, type: '资产类' }),
        true,
        'bank subject should match asset type'
      );
      assertEqual(
        matchesAccountingSubjectFilters(bankSubject, { ...defaultAccountingSubjectFilters, type: '负债类' }),
        false,
        'bank subject should not match liability type'
      );
      assertEqual(
        matchesAccountingSubjectFilters(incomeSubject, { ...defaultAccountingSubjectFilters, statementTarget: '利润表' }),
        true,
        'income subject should match profit statement target'
      );
      assertEqual(
        matchesAccountingSubjectFilters(payrollSubject, { ...defaultAccountingSubjectFilters, keyword: '薪酬' }),
        true,
        'keyword should match payroll subject note and source links'
      );
    }
  },
  {
    name: 'keeps cash-flow statement mapping visible on voucher counterpart subjects',
    run: () => {
      const receivableSubject = accountingSubjectSeedRows.find((row) => row.code === '1122');
      const payrollSubject = accountingSubjectSeedRows.find((row) => row.code === '2211.01');
      const taxSubject = accountingSubjectSeedRows.find((row) => row.code === '2221.01');
      const bankSubject = accountingSubjectSeedRows.find((row) => row.code === '1002');

      if (!receivableSubject || !payrollSubject || !taxSubject || !bankSubject) {
        throw new Error('expected cash-flow mapping sample subjects to exist');
      }

      assertEqual(
        receivableSubject.cashFlowItem,
        '销售商品、提供劳务收到的现金',
        'receivable subject should map customer cash receipts to cash-flow statement item'
      );
      assertEqual(
        payrollSubject.cashFlowItem,
        '支付给职工以及为职工支付的现金',
        'payroll payable subject should map salary payments to cash-flow statement item'
      );
      assertEqual(taxSubject.cashFlowItem, '支付的各项税费', 'tax payable subject should map tax payments to cash-flow item');
      assertEqual(bankSubject.cashFlowItem, undefined, 'cash subject itself should stay a balance-sheet subject, not the cash-flow item owner');
      assertEqual(
        matchesAccountingSubjectFilters(receivableSubject, { ...defaultAccountingSubjectFilters, keyword: '销售商品' }),
        true,
        'keyword should match cash-flow statement item mapping'
      );
    }
  },
  {
    name: 'keeps accounting type labels out of subject rows',
    run: () => {
      const accountingTypeNames = ['资产类', '负债类', '所有者权益类', '成本类', '损益类'];
      const typeNameRows = accountingSubjectSeedRows.filter((row) => accountingTypeNames.includes(row.name));
      const mainCostSubject = accountingSubjectSeedRows.find((row) => row.code === '5401');

      if (!mainCostSubject) {
        throw new Error('expected main business cost subject to use the common 5401 subject code');
      }

      assertEqual(typeNameRows.length, 0, 'accounting categories should not be rendered as posting subject rows');
      assertEqual(mainCostSubject.type, '损益类', 'main business cost should be categorized as profit and loss');
    }
  }
];

export function runFinanceAccountingSubjectDataTests() {
  const failures: string[] = [];

  tests.forEach((test) => {
    try {
      test.run();
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
