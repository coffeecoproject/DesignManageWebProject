import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useMemo, useState } from 'react';
import {
  ledgerInitializationDraftOperationRecords,
  ledgerInitializationDraftProfile,
  ledgerInitializationOperationRecords,
  ledgerInitializationProfile,
  ledgerOpeningBalanceDraftImportBatch,
  ledgerOpeningBalanceImportBatch,
  ledgerOpeningBalanceRows,
  type LedgerInitializationOperationRecord,
  type LedgerInitializationProfile,
  type LedgerOpeningBalanceImportBatch,
  type LedgerOpeningBalanceRow
} from './financeLedgerInitializationModel';

type FinanceLedgerInitializationStateValue = {
  draftImportBatch?: LedgerOpeningBalanceImportBatch;
  draftOpeningRows: LedgerOpeningBalanceRow[];
  draftOperationRecords: LedgerInitializationOperationRecord[];
  draftProfile: LedgerInitializationProfile;
  enabledImportBatch?: LedgerOpeningBalanceImportBatch;
  enabledOpeningRows: LedgerOpeningBalanceRow[];
  enabledOperationRecords: LedgerInitializationOperationRecord[];
  enabledProfile?: LedgerInitializationProfile;
  setDraftImportBatch: Dispatch<SetStateAction<LedgerOpeningBalanceImportBatch | undefined>>;
  setDraftOpeningRows: Dispatch<SetStateAction<LedgerOpeningBalanceRow[]>>;
  setDraftOperationRecords: Dispatch<SetStateAction<LedgerInitializationOperationRecord[]>>;
  setDraftProfile: Dispatch<SetStateAction<LedgerInitializationProfile>>;
  setEnabledImportBatch: Dispatch<SetStateAction<LedgerOpeningBalanceImportBatch | undefined>>;
  setEnabledOpeningRows: Dispatch<SetStateAction<LedgerOpeningBalanceRow[]>>;
  setEnabledOperationRecords: Dispatch<SetStateAction<LedgerInitializationOperationRecord[]>>;
  setEnabledProfile: Dispatch<SetStateAction<LedgerInitializationProfile | undefined>>;
};

const FinanceLedgerInitializationStateContext = createContext<FinanceLedgerInitializationStateValue | null>(null);

export function FinanceLedgerInitializationProvider({ children }: { children: ReactNode }) {
  const [draftProfile, setDraftProfile] = useState<LedgerInitializationProfile>(ledgerInitializationDraftProfile);
  const [draftOpeningRows, setDraftOpeningRows] = useState<LedgerOpeningBalanceRow[]>(ledgerOpeningBalanceRows);
  const [draftImportBatch, setDraftImportBatch] = useState<LedgerOpeningBalanceImportBatch | undefined>(
    ledgerOpeningBalanceDraftImportBatch
  );
  const [draftOperationRecords, setDraftOperationRecords] = useState<LedgerInitializationOperationRecord[]>(
    ledgerInitializationDraftOperationRecords
  );
  const [enabledProfile, setEnabledProfile] = useState<LedgerInitializationProfile | undefined>(ledgerInitializationProfile);
  const [enabledOpeningRows, setEnabledOpeningRows] = useState<LedgerOpeningBalanceRow[]>(ledgerOpeningBalanceRows);
  const [enabledImportBatch, setEnabledImportBatch] = useState<LedgerOpeningBalanceImportBatch | undefined>(
    ledgerOpeningBalanceImportBatch
  );
  const [enabledOperationRecords, setEnabledOperationRecords] = useState<LedgerInitializationOperationRecord[]>(
    ledgerInitializationOperationRecords
  );

  const value = useMemo<FinanceLedgerInitializationStateValue>(
    () => ({
      draftImportBatch,
      draftOpeningRows,
      draftOperationRecords,
      draftProfile,
      enabledImportBatch,
      enabledOpeningRows,
      enabledOperationRecords,
      enabledProfile,
      setDraftImportBatch,
      setDraftOpeningRows,
      setDraftOperationRecords,
      setDraftProfile,
      setEnabledImportBatch,
      setEnabledOpeningRows,
      setEnabledOperationRecords,
      setEnabledProfile
    }),
    [
      draftImportBatch,
      draftOpeningRows,
      draftOperationRecords,
      draftProfile,
      enabledImportBatch,
      enabledOpeningRows,
      enabledOperationRecords,
      enabledProfile
    ]
  );

  return (
    <FinanceLedgerInitializationStateContext.Provider value={value}>
      {children}
    </FinanceLedgerInitializationStateContext.Provider>
  );
}

export function useFinanceLedgerInitialization() {
  const value = useContext(FinanceLedgerInitializationStateContext);

  if (!value) {
    throw new Error('useFinanceLedgerInitialization must be used within FinanceLedgerInitializationProvider');
  }

  return value;
}
