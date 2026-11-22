import { buildAccountingLedgerEntries, type AccountingVoucherRecord } from './financeAccountingVoucherModel';
import {
  financeStampDutyHistoricalCapitalBookBases,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import { buildGeneralLedgerSubjectBalances, defaultGeneralLedgerFilters } from './financeGeneralLedgerModel';
import { buildCapitalBookStampDutySource, type FinanceStampDutySourceRecord } from './financeStampDutyModel';

export function buildCapitalBookStampDutySourcesFromLedger(
  records: FinanceDeclarationPreparationRecord[],
  accountingVoucherRows: AccountingVoucherRecord[]
): FinanceStampDutySourceRecord[] {
  const annualPeriods = Array.from(
    new Set(
      records
        .filter((record) => record.taxType === '印花税' && record.declarationScenario === '年度申报')
        .map((record) => record.period)
    )
  );
  const ledgerEntries = buildAccountingLedgerEntries(accountingVoucherRows);

  return annualPeriods.map((period) => {
    const ledgerRows = buildGeneralLedgerSubjectBalances({
      entries: ledgerEntries,
      filters: {
        ...defaultGeneralLedgerFilters,
        accountingPeriodTime: { mode: 'month', month: `${period}-12` }
      }
    });
    const paidInCapitalEndingBalance = ledgerRows.find((row) => row.subjectCode === '3001')?.endingBalanceAmount ?? 0;
    const capitalReserveEndingBalance = ledgerRows.find((row) => row.subjectCode === '3002')?.endingBalanceAmount ?? 0;
    const previousYears = Object.entries(financeStampDutyHistoricalCapitalBookBases)
      .filter(([year]) => year < period)
      .map(([, basis]) => basis);
    const historicalTaxedMaximumBasis = previousYears.length > 0 ? Math.max(...previousYears) : undefined;

    return buildCapitalBookStampDutySource({
      capitalReserveEndingBalance,
      historicalTaxedMaximumBasis,
      paidInCapitalEndingBalance,
      period,
      sourceVersion: `${period}-ledger-${paidInCapitalEndingBalance}-${capitalReserveEndingBalance}-${historicalTaxedMaximumBasis ?? 'missing'}`
    });
  });
}
