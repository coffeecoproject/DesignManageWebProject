import { parseFinanceSourceMutationPayload } from './financeSourceMutationPayloadContract.js';

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
    name: 'accepts empty and typed source mutation payloads',
    run: () => {
      const empty = parseFinanceSourceMutationPayload(undefined);
      const typed = parseFinanceSourceMutationPayload({
        amount: '1200.00',
        expectedVersion: 2,
        sourceId: 'source-001',
        sourceNo: 'AR-202606-001',
        status: '已调整',
        targetAccountingPeriod: '2026-06'
      });

      assertEqual(empty.ok, true, 'undefined source mutation body should be treated as empty object');
      assertEqual(typed.ok, true, 'typed source mutation body should parse');

      if (!typed.ok) {
        throw new Error('typed source mutation body should parse before body assertions');
      }

      assertEqual(typed.body.amount, '1200.00', 'amount should be preserved');
      assertEqual(typed.body.expectedVersion, 2, 'expectedVersion should be preserved');
      assertEqual(typed.body.targetAccountingPeriod, '2026-06', 'target period should be preserved');
    }
  },
  {
    name: 'rejects invalid source mutation body shapes and field types',
    run: () => {
      const invalidBody = parseFinanceSourceMutationPayload(null);
      const invalidAmount = parseFinanceSourceMutationPayload({ amount: 1200 });
      const invalidVersion = parseFinanceSourceMutationPayload({ expectedVersion: '2' });
      const invalidTargetPeriod = parseFinanceSourceMutationPayload({ targetAccountingPeriod: 202606 });

      assertEqual(invalidBody.ok, false, 'null source mutation body should reject');
      assertEqual(invalidAmount.ok, false, 'numeric amount should reject');
      assertEqual(invalidVersion.ok, false, 'string expectedVersion should reject');
      assertEqual(invalidTargetPeriod.ok, false, 'non-string target period should reject');
    }
  }
];

for (const test of tests) {
  test.run();
}
