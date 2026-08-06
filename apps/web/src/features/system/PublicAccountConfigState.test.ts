import {
  countPublicAccountVoucherReferences,
  getDefaultPublicAccount,
  getDefaultPublicAccountRef,
  publicAccountSeeds,
  reconcilePublicAccountDefaults,
  resolveActivePublicAccountRef,
  validatePublicAccountIdentityUpdate,
  validatePublicAccountLifecycleUpdate,
  type PublicAccountRecord
} from './PublicAccountConfigState';
import {
  validateDefaultMasterDataStatusChange,
  validatePrimaryCategoryStatusChange,
  validateTaskConfigStatusChange
} from './masterDataLifecycleModel';
import {
  financePrimaryCategorySeeds,
  financeSecondaryCategorySeeds
} from '../finance/financeData';
import {
  protectFinancePrimaryCategoryUpdate,
  protectFinanceSecondaryCategoryUpdate,
  type FinancePrimaryCategoryFormValue,
  type FinanceSecondaryCategoryFormValue
} from './FinanceCategoryState';

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
    name: 'counts historical voucher references by stable public account identity',
    run: () => {
      const accountId = publicAccountSeeds[0].id;
      const vouchers = [
        {
          lines: [
            { auxiliaryId: accountId, auxiliaryScope: '对公账户' },
            { auxiliaryId: 'customer-001', auxiliaryScope: '客户' }
          ]
        },
        {
          lines: [{ auxiliaryId: publicAccountSeeds[1].id, auxiliaryScope: '对公账户' }]
        }
      ];

      assertEqual(
        countPublicAccountVoucherReferences(vouchers, accountId),
        1,
        'only vouchers referencing the requested public account should be counted'
      );
    }
  },
  {
    name: 'enforces account lifecycle references through one domain validator',
    run: () => {
      const target = publicAccountSeeds[1];
      const noReferences = {
        bankStatementCount: 0,
        financeTransactionCount: 0,
        historicalReferenceCount: 0,
        nonZeroBalance: false,
        referencedUsages: []
      };
      const pendingBankReference = {
        ...noReferences,
        bankStatementCount: 1,
        historicalReferenceCount: 1,
        referencedUsages: target.usage
      };

      assertEqual(
        validatePublicAccountLifecycleUpdate(target, { ...target, status: '停用' }, pendingBankReference).success,
        false,
        'pending bank statements should block account disablement'
      );
      assertEqual(
        validatePublicAccountLifecycleUpdate(target, { ...target, usage: ['银行对账'] }, pendingBankReference).success,
        false,
        'pending payment or reconciliation usage should not be removable through another caller'
      );
      assertEqual(
        validatePublicAccountLifecycleUpdate(target, { ...target, status: '停用' }, noReferences).success,
        true,
        'non-default zero-balance account without references should be stoppable'
      );
    }
  },
  {
    name: 'keeps referenced bank account identity immutable',
    run: () => {
      const target = publicAccountSeeds[0];
      const changedIdentity = {
        accountHolder: target.accountHolder,
        accountNumber: '755901538210999',
        bankName: target.bankName,
        defaultFor: target.defaultFor,
        displayName: target.displayName,
        note: target.note,
        status: target.status,
        usage: target.usage
      };
      const referenced = {
        bankStatementCount: 0,
        financeTransactionCount: 0,
        historicalReferenceCount: 0,
        nonZeroBalance: true,
        referencedUsages: []
      };

      assertEqual(
        validatePublicAccountIdentityUpdate(target, changedIdentity, referenced).success,
        false,
        'accounting references should protect bank identity'
      );
      assertEqual(
        validatePublicAccountIdentityUpdate(
          target,
          { ...changedIdentity, accountNumber: target.accountNumber, displayName: '招商银行经营基本户' },
          referenced
        ).success,
        true,
        'display name should remain editable without changing bank identity'
      );
    }
  },
  {
    name: 'prioritizes enabled default account for requested usage',
    run: () => {
      const reorderedRows = [publicAccountSeeds[1], publicAccountSeeds[0], publicAccountSeeds[2]];
      const defaultPaymentAccount = getDefaultPublicAccount(reorderedRows, '付款');

      assertEqual(defaultPaymentAccount?.id, publicAccountSeeds[0].id, 'payment account should use the configured default before list order');
    }
  },
  {
    name: 'does not fallback to disabled or unrelated accounts',
    run: () => {
      const rows: PublicAccountRecord[] = [
        { ...publicAccountSeeds[0], status: '停用' },
        {
          ...publicAccountSeeds[1],
          defaultFor: ['银行对账'],
          usage: ['银行对账']
        }
      ];

      assertEqual(getDefaultPublicAccount(rows, '收款'), undefined, 'disabled collection account should not be selected');
      assertEqual(getDefaultPublicAccountRef(rows, '收款'), undefined, 'default account ref should be absent without active usage match');
    }
  },
  {
    name: 'resolves selected account only when enabled and matching requested usage',
    run: () => {
      const rows: PublicAccountRecord[] = [
        {
          ...publicAccountSeeds[0],
          status: '停用'
        },
        {
          ...publicAccountSeeds[1],
          usage: ['付款', '银行对账']
        }
      ];

      assertEqual(
        resolveActivePublicAccountRef(rows, publicAccountSeeds[0].id, '收款'),
        undefined,
        'disabled selected account should not resolve'
      );
      assertEqual(
        resolveActivePublicAccountRef(rows, publicAccountSeeds[1].id, '收款'),
        undefined,
        'enabled account without requested usage should not resolve'
      );
      assertEqual(
        resolveActivePublicAccountRef(rows, publicAccountSeeds[1].id, '付款')?.publicAccountId,
        publicAccountSeeds[1].id,
        'enabled account with requested usage should resolve'
      );
    }
  },
  {
    name: 'blocks disabling task types that still have in-flight tasks',
    run: () => {
      assertEqual(validateTaskConfigStatusChange('停用', 2).success, false, 'in-flight task type should be protected');
      assertEqual(validateTaskConfigStatusChange('停用', 0).success, true, 'unused task type should be stoppable');
    }
  },
  {
    name: 'blocks disabling default calendars and accounts',
    run: () => {
      assertEqual(
        validateDefaultMasterDataStatusChange('停用', true, 'blocked').success,
        false,
        'default master data should be protected'
      );
      assertEqual(
        validateDefaultMasterDataStatusChange('停用', false, 'blocked').success,
        true,
        'non-default master data should be stoppable'
      );
    }
  },
  {
    name: 'blocks disabling primary categories with enabled children',
    run: () => {
      assertEqual(validatePrimaryCategoryStatusChange('停用', 1).success, false, 'enabled children should block parent stop');
      assertEqual(validatePrimaryCategoryStatusChange('停用', 0).success, true, 'empty parent should be stoppable');
    }
  },
  {
    name: 'keeps built-in finance category identities and hierarchy immutable',
    run: () => {
      const primary = financePrimaryCategorySeeds[0];
      const secondary = financeSecondaryCategorySeeds[0];
      const primaryUpdate: FinancePrimaryCategoryFormValue = {
        direction: '支出',
        includeInReport: false,
        name: '重命名一级',
        note: '允许更新说明',
        reportAggregation: '其他'
      };
      const secondaryUpdate: FinanceSecondaryCategoryFormValue = {
        accountingSubjectMappings: {},
        counterpartyScope: '供应商',
        defaultAccountingSubjectCode: '2202',
        defaultSourceType: '手工登记',
        includeInReport: false,
        name: '重命名二级',
        note: '允许更新说明',
        paymentMethods: ['对公账户付款'],
        primaryId: 'finance-primary-other-expense',
        voucherRequirement: '付款凭证'
      };
      const protectedPrimary = protectFinancePrimaryCategoryUpdate(primary, primaryUpdate, true);
      const protectedSecondary = protectFinanceSecondaryCategoryUpdate(secondary, secondaryUpdate);

      assertEqual(protectedPrimary.name, primary.name, 'built-in primary name should remain stable');
      assertEqual(protectedPrimary.direction, primary.direction, 'built-in primary direction should remain stable');
      assertEqual(protectedSecondary.name, secondary.name, 'built-in secondary name should remain stable');
      assertEqual(protectedSecondary.primaryId, secondary.primaryId, 'built-in secondary must not move to another parent');
    }
  },
  {
    name: 'keeps one default account for each usage after reassignment',
    run: () => {
      const reassigned = reconcilePublicAccountDefaults(
        publicAccountSeeds,
        publicAccountSeeds[1].id,
        ['付款']
      );
      assertEqual(
        reassigned[0].defaultFor.includes('付款'),
        false,
        'old account should release transferred payment default'
      );
      assertEqual(
        reassigned[0].defaultFor.includes('收款'),
        true,
        'unrelated collection default should remain'
      );
    }
  }
];

export function runPublicAccountConfigStateTests() {
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
