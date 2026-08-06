import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useMemo, useState } from 'react';
import {
  buildLedgerInitializationSubjectSnapshot,
  ledgerInitializationDraftOperationRecords,
  ledgerInitializationDraftProfile,
  ledgerInitializationOperationRecords,
  ledgerInitializationProfile,
  ledgerOpeningBalanceDraftImportBatch,
  ledgerOpeningBalanceImportBatch,
  ledgerOpeningBalanceRows,
  type LedgerInitializationOperationRecord,
  type LedgerInitializationProfile,
  type LedgerInitializationSubjectSnapshot,
  type LedgerOpeningBalanceImportBatch,
  type LedgerOpeningBalanceRow
} from './financeLedgerInitializationModel';

type FinanceLedgerInitializationStateValue = {
  draftImportBatch?: LedgerOpeningBalanceImportBatch;
  draftOpeningRows: LedgerOpeningBalanceRow[];
  draftOperationRecords: LedgerInitializationOperationRecord[];
  draftProfile: LedgerInitializationProfile;
  draftSubjectRows: LedgerInitializationSubjectSnapshot[];
  enabledImportBatch?: LedgerOpeningBalanceImportBatch;
  enabledOpeningRows: LedgerOpeningBalanceRow[];
  enabledOperationRecords: LedgerInitializationOperationRecord[];
  enabledProfile?: LedgerInitializationProfile;
  enabledSubjectRows: LedgerInitializationSubjectSnapshot[];
  setDraftImportBatch: Dispatch<SetStateAction<LedgerOpeningBalanceImportBatch | undefined>>;
  setDraftOpeningRows: Dispatch<SetStateAction<LedgerOpeningBalanceRow[]>>;
  setDraftOperationRecords: Dispatch<SetStateAction<LedgerInitializationOperationRecord[]>>;
  setDraftProfile: Dispatch<SetStateAction<LedgerInitializationProfile>>;
  setDraftSubjectRows: Dispatch<SetStateAction<LedgerInitializationSubjectSnapshot[]>>;
  setEnabledImportBatch: Dispatch<SetStateAction<LedgerOpeningBalanceImportBatch | undefined>>;
  setEnabledOpeningRows: Dispatch<SetStateAction<LedgerOpeningBalanceRow[]>>;
  setEnabledOperationRecords: Dispatch<SetStateAction<LedgerInitializationOperationRecord[]>>;
  setEnabledProfile: Dispatch<SetStateAction<LedgerInitializationProfile | undefined>>;
  setEnabledSubjectRows: Dispatch<SetStateAction<LedgerInitializationSubjectSnapshot[]>>;
};

const FinanceLedgerInitializationStateContext = createContext<FinanceLedgerInitializationStateValue | null>(null);

export function FinanceLedgerInitializationProvider({ children }: { children: ReactNode }) {
  const [draftProfile, setDraftProfile] = useState<LedgerInitializationProfile>(ledgerInitializationDraftProfile);
  const [draftSubjectRows, setDraftSubjectRows] = useState<LedgerInitializationSubjectSnapshot[]>(() =>
    buildLedgerInitializationSubjectSnapshot(undefined, ledgerInitializationDraftProfile.subjectConfirmedAt)
  );
  const [draftOpeningRows, setDraftOpeningRows] = useState<LedgerOpeningBalanceRow[]>(ledgerOpeningBalanceRows);
  const [draftImportBatch, setDraftImportBatch] = useState<LedgerOpeningBalanceImportBatch | undefined>(
    ledgerOpeningBalanceDraftImportBatch
  );
  const [draftOperationRecords, setDraftOperationRecords] = useState<LedgerInitializationOperationRecord[]>(
    ledgerInitializationDraftOperationRecords
  );
  const [enabledProfile, setEnabledProfile] = useState<LedgerInitializationProfile | undefined>(ledgerInitializationProfile);
  const [enabledSubjectRows, setEnabledSubjectRows] = useState<LedgerInitializationSubjectSnapshot[]>(() =>
    buildLedgerInitializationSubjectSnapshot()
  );
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
      draftSubjectRows,
      enabledImportBatch,
      enabledOpeningRows,
      enabledOperationRecords,
      enabledProfile,
      enabledSubjectRows,
      setDraftImportBatch,
      setDraftOpeningRows,
      setDraftOperationRecords,
      setDraftProfile,
      setDraftSubjectRows,
      setEnabledImportBatch,
      setEnabledOpeningRows,
      setEnabledOperationRecords,
      setEnabledProfile,
      setEnabledSubjectRows
    }),
    [
      draftImportBatch,
      draftOpeningRows,
      draftOperationRecords,
      draftProfile,
      draftSubjectRows,
      enabledImportBatch,
      enabledOpeningRows,
      enabledOperationRecords,
      enabledProfile,
      enabledSubjectRows
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
