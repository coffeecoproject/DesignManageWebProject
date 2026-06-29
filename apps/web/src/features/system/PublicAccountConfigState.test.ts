import {
  getDefaultPublicAccount,
  getDefaultPublicAccountRef,
  publicAccountSeeds,
  resolveActivePublicAccountRef,
  type PublicAccountRecord
} from './PublicAccountConfigState';

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
