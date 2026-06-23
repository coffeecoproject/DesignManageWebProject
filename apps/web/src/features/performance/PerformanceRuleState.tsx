import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { performanceRulePresets } from './performanceMockData';
import type { PerformanceRulePreset } from './performanceTypes';

type PerformanceRuleStateValue = {
  deletePerformanceRule: (ruleId: string) => void;
  performanceRuleRows: PerformanceRulePreset[];
  savePerformanceRule: (record: PerformanceRulePreset) => void;
  setPerformanceRuleRows: (updater: (currentRows: PerformanceRulePreset[]) => PerformanceRulePreset[]) => void;
};

const PerformanceRuleStateContext = createContext<PerformanceRuleStateValue | undefined>(undefined);

function upsertRule(records: PerformanceRulePreset[], nextRecord: PerformanceRulePreset) {
  return records.some((record) => record.id === nextRecord.id)
    ? records.map((record) => (record.id === nextRecord.id ? nextRecord : record))
    : [nextRecord, ...records];
}

export function PerformanceRuleProvider({ children }: { children: ReactNode }) {
  const [performanceRuleRows, setPerformanceRuleRowsState] = useState<PerformanceRulePreset[]>(() => performanceRulePresets);

  const savePerformanceRule = useCallback((record: PerformanceRulePreset) => {
    setPerformanceRuleRowsState((currentRows) => upsertRule(currentRows, record));
  }, []);

  const deletePerformanceRule = useCallback((ruleId: string) => {
    setPerformanceRuleRowsState((currentRows) => currentRows.filter((record) => record.id !== ruleId));
  }, []);

  const setPerformanceRuleRows = useCallback((updater: (currentRows: PerformanceRulePreset[]) => PerformanceRulePreset[]) => {
    setPerformanceRuleRowsState(updater);
  }, []);

  const value = useMemo<PerformanceRuleStateValue>(
    () => ({
      deletePerformanceRule,
      performanceRuleRows,
      savePerformanceRule,
      setPerformanceRuleRows
    }),
    [deletePerformanceRule, performanceRuleRows, savePerformanceRule, setPerformanceRuleRows]
  );

  return <PerformanceRuleStateContext.Provider value={value}>{children}</PerformanceRuleStateContext.Provider>;
}

export function usePerformanceRuleState() {
  const value = useContext(PerformanceRuleStateContext);

  if (!value) {
    throw new Error('usePerformanceRuleState must be used within PerformanceRuleProvider');
  }

  return value;
}
