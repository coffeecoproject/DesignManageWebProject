import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useMemo, useState } from 'react';
import { bankImportBatchSeedRows, bankStatementSeedRows } from './financeBankStatementSeedData';
import type { BankStatementRecord } from './financeBankImportContract';

export type BankImportBatch = Pick<
  BankStatementRecord,
  'importedAccountName' | 'publicAccountId' | 'publicAccountSnapshot'
> & {
  amountMismatchRows: number;
  batchNo: string;
  duplicateRows: number;
  fileName: string;
  id: string;
  importedAt: string;
  matchedRows: number;
  statementRange: string;
  status: '已导入' | '导入预览';
  totalRows: number;
};

export type BankImportDraft = {
  fileName?: string;
  previewRows: BankStatementRecord[];
  publicAccountId: string;
};

export const defaultBankImportPublicAccountId = 'public-account-cmb-basic';

export function createBankImportDraft(publicAccountId = defaultBankImportPublicAccountId): BankImportDraft {
  return { previewRows: [], publicAccountId };
}

export function changeBankImportDraftAccount(publicAccountId: string): BankImportDraft {
  return createBankImportDraft(publicAccountId);
}

export function setBankImportDraftFile(
  draft: BankImportDraft,
  fileName: string,
  previewRows: BankStatementRecord[]
): BankImportDraft {
  return { ...draft, fileName, previewRows };
}

export function clearBankImportDraftFile(draft: BankImportDraft): BankImportDraft {
  return createBankImportDraft(draft.publicAccountId);
}

type FinanceBankStatementStateValue = {
  bankStatements: BankStatementRecord[];
  importBatches: BankImportBatch[];
  importDraft: BankImportDraft;
  setBankStatements: Dispatch<SetStateAction<BankStatementRecord[]>>;
  setImportBatches: Dispatch<SetStateAction<BankImportBatch[]>>;
  setImportDraft: Dispatch<SetStateAction<BankImportDraft>>;
};

const FinanceBankStatementStateContext = createContext<FinanceBankStatementStateValue | null>(null);

export function FinanceBankStatementProvider({ children }: { children: ReactNode }) {
  const [bankStatements, setBankStatements] = useState<BankStatementRecord[]>(() => bankStatementSeedRows);
  const [importBatches, setImportBatches] = useState<BankImportBatch[]>(() => bankImportBatchSeedRows);
  const [importDraft, setImportDraft] = useState<BankImportDraft>(() => createBankImportDraft());
  const value = useMemo(
    () => ({ bankStatements, importBatches, importDraft, setBankStatements, setImportBatches, setImportDraft }),
    [bankStatements, importBatches, importDraft]
  );

  return <FinanceBankStatementStateContext.Provider value={value}>{children}</FinanceBankStatementStateContext.Provider>;
}

export function useFinanceBankStatementState() {
  const value = useContext(FinanceBankStatementStateContext);

  if (!value) {
    throw new Error('useFinanceBankStatementState must be used within FinanceBankStatementProvider');
  }

  return value;
}
