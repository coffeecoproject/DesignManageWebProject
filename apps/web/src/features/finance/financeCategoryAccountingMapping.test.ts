import { getAccountingSubjectByCode } from './financeAccountingSubjectData';
import {
  financeCategoryAccountingSubjectMappings,
  financeSecondaryCategorySeeds,
  getFinanceCategoryMissingAccountingRoles,
  getFinanceCategorySnapshot,
  type FinanceAccountingSubjectRole
} from './financeData';

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
    name: 'maps every enabled finance category to an existing accounting subject',
    run: () => {
      const unmappedCategories = financeSecondaryCategorySeeds
        .filter((row) => row.status === '启用')
        .filter((row) => !getAccountingSubjectByCode(row.defaultAccountingSubjectCode))
        .map((row) => row.name);

      assertEqual(unmappedCategories.length, 0, 'enabled secondary finance categories should all have valid accounting subject mappings');
    }
  },
  {
    name: 'maps every enabled finance category accounting role to an existing subject',
    run: () => {
      const unmappedRoles = financeSecondaryCategorySeeds
        .filter((row) => row.status === '启用')
        .flatMap((row) =>
          Object.entries(financeCategoryAccountingSubjectMappings[row.name] ?? {})
            .filter(([, subjectCode]) => !subjectCode || !getAccountingSubjectByCode(subjectCode))
            .map(([role]) => `${row.name}:${role}`)
        );

      assertEqual(unmappedRoles.length, 0, 'enabled secondary finance category role mappings should all point to valid accounting subjects');
    }
  },
  {
    name: 'keeps key finance categories mapped to default posting subjects',
    run: () => {
      assertEqual(getFinanceCategorySnapshot('客户回款').accountingSubject.code, '1122', 'customer payment should default to accounts receivable');
      assertEqual(getFinanceCategorySnapshot('其他收入').accountingSubject.code, '6051', 'other income should default to other business income');
      assertEqual(getFinanceCategorySnapshot('工资发放').accountingSubject.code, '2211.01', 'salary payment should default to salary payable detail subject');
      assertEqual(getFinanceCategorySnapshot('办公费用').accountingSubject.code, '6602.03', 'office expense should default to office expense detail subject');
      assertEqual(getFinanceCategorySnapshot('税费缴纳').accountingSubject.code, '2221', 'tax payment should default to tax payable');
    }
  },
  {
    name: 'keeps unknown finance category snapshots unconfigured instead of falling back',
    run: () => {
      const snapshot = getFinanceCategorySnapshot('未配置类目');
      const missingRoles = getFinanceCategoryMissingAccountingRoles(
        '未配置类目',
        ['accrualReceivable', 'accrualRevenue'] satisfies FinanceAccountingSubjectRole[]
      );

      assertEqual(snapshot.mappingStatus, '待配置', 'unknown category should expose missing accounting mapping');
      assertEqual(snapshot.accountingSubject.code, '', 'unknown category should not silently pick a posting subject');
      assertEqual(snapshot.accountingSubject.name, '未配置科目', 'unknown category should display explicit unconfigured subject');
      assertEqual(missingRoles.length, 2, 'unknown category should miss every requested accounting role');
    }
  }
];

export function runFinanceCategoryAccountingMappingTests() {
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
