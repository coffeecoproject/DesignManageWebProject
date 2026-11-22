import { financeDeclarationPreparationRecords } from './financeDeclarationPreparationData';
import { buildCapitalBookStampDutySourcesFromLedger } from './financeStampDutyLedgerBridge';
import { it } from 'vitest';
import { assertEqual } from '../../__tests__/assertions';

it('historical filing period preserves its audited non-taxable source conclusion', () => {
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
});

it('capital book source reads current ledger balances and historical taxed maximum', () => {
  const [source] = buildCapitalBookStampDutySourcesFromLedger(financeDeclarationPreparationRecords, []);

  assertEqual(source.obligationPeriod, '2026', 'annual obligation period');
  assertEqual(source.statedAmount, 200000, 'current capital book balance comes from ledger opening balance');
  assertEqual(source.taxableBasis, 0, 'historically taxed capital is not taxed again');
  assertEqual(source.sourceVersion.includes('ledger-200000-0-200000'), true, 'source version preserves ledger facts');
});
