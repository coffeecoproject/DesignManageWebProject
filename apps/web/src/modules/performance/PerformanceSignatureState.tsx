import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  performanceSignatureEmployees,
  type PerformanceEmployeeSignatureArchive
} from './performanceSignatureArchiveData';

type PerformanceSignatureStateValue = {
  employees: PerformanceEmployeeSignatureArchive[];
  setEmployees: (updater: (current: PerformanceEmployeeSignatureArchive[]) => PerformanceEmployeeSignatureArchive[]) => void;
  updateEmployeeSignature: (
    employeeId: string,
    updater: (employee: PerformanceEmployeeSignatureArchive) => PerformanceEmployeeSignatureArchive
  ) => void;
};

const PerformanceSignatureStateContext = createContext<PerformanceSignatureStateValue | undefined>(undefined);

export function PerformanceSignatureProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployeesState] = useState<PerformanceEmployeeSignatureArchive[]>(() =>
    performanceSignatureEmployees.map((employee) => ({
      ...employee,
      files: employee.files.map((file) => ({ ...file })),
      operationRecords: employee.operationRecords.map((record) => ({ ...record }))
    }))
  );

  const setEmployees = useCallback(
    (updater: (current: PerformanceEmployeeSignatureArchive[]) => PerformanceEmployeeSignatureArchive[]) => {
      setEmployeesState(updater);
    },
    []
  );

  const updateEmployeeSignature = useCallback(
    (
      employeeId: string,
      updater: (employee: PerformanceEmployeeSignatureArchive) => PerformanceEmployeeSignatureArchive
    ) => {
      setEmployeesState((current) =>
        current.map((employee) => (employee.id === employeeId ? updater(employee) : employee))
      );
    },
    []
  );

  const value = useMemo<PerformanceSignatureStateValue>(
    () => ({ employees, setEmployees, updateEmployeeSignature }),
    [employees, setEmployees, updateEmployeeSignature]
  );

  return <PerformanceSignatureStateContext.Provider value={value}>{children}</PerformanceSignatureStateContext.Provider>;
}

export function usePerformanceSignatureState() {
  const value = useContext(PerformanceSignatureStateContext);

  if (!value) {
    throw new Error('usePerformanceSignatureState must be used within PerformanceSignatureProvider');
  }

  return value;
}
