import {
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

      assertEqual(metrics.enabledCount, 28, 'enabled subject count should include parent and detail posting subjects');
      assertEqual(metrics.standardCount, 28, 'standard count should include built-in standard subjects');
      assertEqual(metrics.balanceSheetCount, 18, 'balance sheet count should include asset, liability, and equity subjects');
      assertEqual(metrics.profitStatementCount, 10, 'profit statement count should include profit and loss subjects');
    }
  },
  {
    name: 'filters accounting subjects by type, statement target, status, and keyword',
    run: () => {
      const bankSubject = accountingSubjectSeedRows.find((row) => row.code === '1002');
      const incomeSubject = accountingSubjectSeedRows.find((row) => row.code === '6001');
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
    name: 'keeps accounting type labels out of subject rows',
    run: () => {
      const accountingTypeNames = ['资产类', '负债类', '所有者权益类', '成本类', '损益类'];
      const typeNameRows = accountingSubjectSeedRows.filter((row) => accountingTypeNames.includes(row.name));
      const mainCostSubject = accountingSubjectSeedRows.find((row) => row.code === '6401');

      if (!mainCostSubject) {
        throw new Error('expected main business cost subject to use the common 6401 subject code');
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
