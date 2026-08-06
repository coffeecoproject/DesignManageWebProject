import type { PublicAccountRecord } from '../system/PublicAccountConfigState';
import type { LedgerOpeningBalanceRow } from './financeLedgerInitializationModel';

export type PublicAccountOpeningBalance = {
  openingBalance: number;
  openingBalanceDate: string;
  publicAccountId: string;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function buildPublicAccountOpeningBalances(
  accounts: PublicAccountRecord[],
  openingRows: LedgerOpeningBalanceRow[],
  effectivePeriod?: string
): PublicAccountOpeningBalance[] {
  const openingBalanceDate = effectivePeriod ? `${effectivePeriod}-01` : '';

  return accounts.map((account) => ({
    openingBalance: roundMoney(
      openingRows
        .filter(
          (row) =>
            row.subjectCode === '1002'
            && row.auxiliaryScope === '对公账户'
            && row.auxiliaryId === account.id
        )
        .reduce((total, row) => total + row.debitAmount - row.creditAmount, 0)
    ),
    openingBalanceDate,
    publicAccountId: account.id
  }));
}

export function getPublicAccountOpeningBalance(
  balances: PublicAccountOpeningBalance[],
  publicAccountId: string
) {
  return balances.find((balance) => balance.publicAccountId === publicAccountId) ?? {
    openingBalance: 0,
    openingBalanceDate: '',
    publicAccountId
  };
}
