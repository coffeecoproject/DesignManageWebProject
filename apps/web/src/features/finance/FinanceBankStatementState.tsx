import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useMemo, useState } from 'react';
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

type FinanceBankStatementStateValue = {
  bankStatements?: BankStatementRecord[];
  importBatches?: BankImportBatch[];
  setBankStatements: Dispatch<SetStateAction<BankStatementRecord[] | undefined>>;
  setImportBatches: Dispatch<SetStateAction<BankImportBatch[] | undefined>>;
};

const FinanceBankStatementStateContext = createContext<FinanceBankStatementStateValue | null>(null);

export function FinanceBankStatementProvider({ children }: { children: ReactNode }) {
  const [bankStatements, setBankStatements] = useState<BankStatementRecord[]>();
  const [importBatches, setImportBatches] = useState<BankImportBatch[]>();
  const value = useMemo(
    () => ({ bankStatements, importBatches, setBankStatements, setImportBatches }),
    [bankStatements, importBatches]
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
