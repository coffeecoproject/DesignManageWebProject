import { financeDeclarationPreparationRecords } from './financeDeclarationPreparationData';
import { buildCapitalBookStampDutySourcesFromLedger } from './financeStampDutyLedgerBridge';

type UnitTest = { name: string; run: () => void };

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

const tests: UnitTest[] = [
  {
    name: 'historical filing period preserves its audited non-taxable source conclusion',
    run: () => {
      const q1Preparation = financeDeclarationPreparationRecords.find(
        (record) => record.preparationNo === 'PREP-2026Q1-STAMP'
      );

      assertEqual(Boolean(q1Preparation), true, 'Q1 stamp-duty preparation exists');
      if (!q1Preparation?.stampDutySources || !q1Preparation.stampDutySummary) {
        throw new Error('Q1 stamp-duty preparation must include source details and summary');
      }

      assertEqual(q1Preparation.stampDutySources.length, 1, 'Q1 reviewed document remains in source details');
      assertEqual(q1Preparation.stampDutySummary.pendingCount, 0, 'Q1 historical source has no unresolved classification');
      assertEqual(q1Preparation.stampDutySummary.declarableCount, 0, 'Q1 non-taxable source does not enter declaration');
      assertEqual(q1Preparation.status, '已进入税务办理', 'Q1 historical preparation is closed consistently');
    }
  },
  {
    name: 'capital book source reads current ledger balances and historical taxed maximum',
    run: () => {
      const [source] = buildCapitalBookStampDutySourcesFromLedger(financeDeclarationPreparationRecords, []);

      assertEqual(source.obligationPeriod, '2026', 'annual obligation period');
      assertEqual(source.statedAmount, 200000, 'current capital book balance comes from ledger opening balance');
      assertEqual(source.taxableBasis, 0, 'historically taxed capital is not taxed again');
      assertEqual(source.sourceVersion.includes('ledger-200000-0-200000'), true, 'source version preserves ledger facts');
    }
  }
];

export function runFinanceStampDutyLedgerBridgeTests() {
  const failures: string[] = [];

  tests.forEach((test) => {
    try {
      test.run();
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return { failures, passed: tests.length - failures.length, total: tests.length };
}
