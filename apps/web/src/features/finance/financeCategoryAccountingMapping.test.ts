import { getAccountingSubjectByCode } from './financeAccountingSubjectData';
import {
  financeCategoryAccountingSubjectMappings,
  financePrimaryCategorySeeds,
  financeSecondaryCategorySeeds,
  getEnabledFinanceCategorySnapshot,
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
      assertEqual(getFinanceCategorySnapshot('其他收入').accountingSubject.code, '5051', 'other income should default to other business income');
      assertEqual(getFinanceCategorySnapshot('工资发放').accountingSubject.code, '2211.01', 'salary payment should default to salary payable detail subject');
      assertEqual(getFinanceCategorySnapshot('办公费用').accountingSubject.code, '5602.03', 'office expense should default to office expense detail subject');
      assertEqual(getFinanceCategorySnapshot('税费缴纳').accountingSubject.code, '2221', 'tax payment should default to tax payable');
    }
  },
  {
    name: 'uses configured role mappings for custom categories without relying on category names',
    run: () => {
      const customCategory = {
        ...financeSecondaryCategorySeeds[0],
        accountingSubjectMappings: {
          accrualReceivable: '1122',
          accrualRevenue: '5051',
          cashCredit: '1122',
          cashDebit: '1002',
          outputVatPayable: '2221.01'
        },
        code: 'FC2-CUSTOM-001',
        id: 'finance-secondary-custom-001',
        name: '定制服务收入'
      };
      const snapshot = getFinanceCategorySnapshot(
        customCategory.name,
        undefined,
        [...financeSecondaryCategorySeeds, customCategory]
      );

      assertEqual(snapshot.secondaryCode, 'FC2-CUSTOM-001', 'custom category should resolve by configured master data');
      assertEqual(snapshot.accountingSubjectMappings.accrualRevenue, '5051', 'custom category should retain configured posting role');
    }
  },
  {
    name: 'keeps category snapshots stable after master-data mappings change',
    run: () => {
      const customCategory = {
        ...financeSecondaryCategorySeeds[0],
        accountingSubjectMappings: { accrualRevenue: '5001' },
        code: 'FC2-CUSTOM-002',
        id: 'finance-secondary-custom-002',
        name: '历史快照测试'
      };
      const snapshot = getFinanceCategorySnapshot(
        customCategory.name,
        undefined,
        [...financeSecondaryCategorySeeds, customCategory]
      );

      customCategory.accountingSubjectMappings.accrualRevenue = '5051';

      assertEqual(snapshot.accountingSubjectMappings.accrualRevenue, '5001', 'historical snapshot should not follow later mapping changes');
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
  },
  {
    name: 'rejects runtime categories with incomplete accounting role mappings',
    run: () => {
      const customerPayment = financeSecondaryCategorySeeds.find((row) => row.name === '客户回款');
      if (!customerPayment) {
        throw new Error('customer payment category fixture should exist');
      }
      const incompleteCategory = {
        ...customerPayment,
        accountingSubjectMappings: { cashDebit: '1002' }
      };
      const snapshot = getFinanceCategorySnapshot(
        incompleteCategory.name,
        financePrimaryCategorySeeds,
        financeSecondaryCategorySeeds.map((row) => row.id === incompleteCategory.id ? incompleteCategory : row)
      );

      assertEqual(snapshot.mappingStatus, '待配置', 'incomplete configured roles must not self-validate');
      assertEqual(snapshot.accountingSubjectMappings.accrualReceivable, undefined, 'runtime mapping must not fall back to a static category-name mapping');
    }
  },
  {
    name: 'blocks new business snapshots when the secondary or parent category is disabled',
    run: () => {
      const customerPayment = financeSecondaryCategorySeeds.find((row) => row.name === '客户回款');
      if (!customerPayment) {
        throw new Error('customer payment category fixture should exist');
      }
      const disabledSecondaryRows = financeSecondaryCategorySeeds.map((row) =>
        row.id === customerPayment.id ? { ...row, status: '停用' as const } : row
      );
      const disabledPrimaryRows = financePrimaryCategorySeeds.map((row) =>
        row.id === customerPayment.primaryId ? { ...row, status: '停用' as const } : row
      );

      assertEqual(
        getEnabledFinanceCategorySnapshot('客户回款', financePrimaryCategorySeeds, disabledSecondaryRows),
        undefined,
        'disabled secondary category should not create a new business snapshot'
      );
      assertEqual(
        getEnabledFinanceCategorySnapshot('客户回款', disabledPrimaryRows, financeSecondaryCategorySeeds),
        undefined,
        'disabled parent category should not create a new business snapshot'
      );
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
