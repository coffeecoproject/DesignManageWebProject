import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  brandRecords,
  customerContractRecords,
  customerRecords,
  deriveCustomerStatus as deriveCustomerStatusFromContracts,
  storeRecords,
  type BrandRecord,
  type CustomerContractRecord,
  type CustomerRecord,
  type CustomerStatus,
  type StoreRecord
} from './customerData';

type CustomerManagementStateValue = {
  brandRows: BrandRecord[];
  contractRows: CustomerContractRecord[];
  customerRows: CustomerRecord[];
  storeRows: StoreRecord[];
  deriveCustomerStatus: (customerId: string) => CustomerStatus;
  getBrandById: (brandId: string | undefined) => BrandRecord | undefined;
  getBrandStoreCount: (brandId: string) => number;
  getCustomerBrandCount: (customerId: string) => number;
  getCustomerById: (customerId: string | undefined) => CustomerRecord | undefined;
  getCustomerStoreCount: (customerId: string) => number;
  saveBrand: (record: BrandRecord) => void;
  saveContract: (record: CustomerContractRecord) => void;
  saveCustomer: (record: CustomerRecord) => void;
  saveStore: (record: StoreRecord) => void;
};

const CustomerManagementStateContext = createContext<CustomerManagementStateValue | undefined>(undefined);

function upsertById<T extends { id: string }>(records: T[], nextRecord: T) {
  return records.some((record) => record.id === nextRecord.id)
    ? records.map((record) => (record.id === nextRecord.id ? nextRecord : record))
    : [nextRecord, ...records];
}

export function CustomerManagementProvider({ children }: { children: ReactNode }) {
  const [customerRows, setCustomerRows] = useState<CustomerRecord[]>(() => customerRecords);
  const [brandRows, setBrandRows] = useState<BrandRecord[]>(() => brandRecords);
  const [storeRows, setStoreRows] = useState<StoreRecord[]>(() => storeRecords);
  const [contractRows, setContractRows] = useState<CustomerContractRecord[]>(() => customerContractRecords);

  const saveCustomer = useCallback((record: CustomerRecord) => {
    setCustomerRows((currentRows) => upsertById(currentRows, record));
  }, []);

  const saveBrand = useCallback((record: BrandRecord) => {
    setBrandRows((currentRows) => upsertById(currentRows, record));
  }, []);

  const saveStore = useCallback((record: StoreRecord) => {
    setStoreRows((currentRows) => upsertById(currentRows, record));
  }, []);

  const saveContract = useCallback((record: CustomerContractRecord) => {
    setContractRows((currentRows) => upsertById(currentRows, record));
  }, []);

  const getCustomerById = useCallback(
    (customerId: string | undefined) => {
      if (!customerId) {
        return undefined;
      }

      return customerRows.find((customer) => customer.id === customerId);
    },
    [customerRows]
  );

  const getBrandById = useCallback(
    (brandId: string | undefined) => {
      if (!brandId) {
        return undefined;
      }

      return brandRows.find((brand) => brand.id === brandId);
    },
    [brandRows]
  );

  const getCustomerBrandCount = useCallback(
    (customerId: string) => brandRows.filter((brand) => brand.customerId === customerId).length,
    [brandRows]
  );

  const getCustomerStoreCount = useCallback(
    (customerId: string) => storeRows.filter((store) => store.customerId === customerId).length,
    [storeRows]
  );

  const getBrandStoreCount = useCallback(
    (brandId: string) => storeRows.filter((store) => store.brandId === brandId).length,
    [storeRows]
  );

  const deriveCustomerStatus = useCallback(
    (customerId: string) => deriveCustomerStatusFromContracts(customerId, contractRows),
    [contractRows]
  );

  const value = useMemo<CustomerManagementStateValue>(
    () => ({
      brandRows,
      contractRows,
      customerRows,
      storeRows,
      deriveCustomerStatus,
      getBrandById,
      getBrandStoreCount,
      getCustomerBrandCount,
      getCustomerById,
      getCustomerStoreCount,
      saveBrand,
      saveContract,
      saveCustomer,
      saveStore
    }),
    [
      brandRows,
      contractRows,
      customerRows,
      storeRows,
      deriveCustomerStatus,
      getBrandById,
      getBrandStoreCount,
      getCustomerBrandCount,
      getCustomerById,
      getCustomerStoreCount,
      saveBrand,
      saveContract,
      saveCustomer,
      saveStore
    ]
  );

  return <CustomerManagementStateContext.Provider value={value}>{children}</CustomerManagementStateContext.Provider>;
}

export function useCustomerManagementState() {
  const value = useContext(CustomerManagementStateContext);

  if (!value) {
    throw new Error('useCustomerManagementState must be used within CustomerManagementProvider');
  }

  return value;
}
