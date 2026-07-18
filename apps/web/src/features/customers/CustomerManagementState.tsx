import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { frontendBusinessToday } from '../../app/frontendBusinessClock';
import {
  brandTaskPriceVersionRecords,
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
import {
  createInitialBrandSettlementPolicyVersions,
  reconcileBrandTaskPriceVersions,
  reconcileBrandSettlementPolicyVersions,
  resolveActiveBrandSettlementPolicyVersion,
  resolveActiveBrandTaskPriceVersion,
  type BrandSettlementPolicyVersionRecord,
  type BrandTaskPriceVersionRecord,
  type BrandTaskPricingDraft
} from './brandTaskPricingModel';

type CustomerManagementStateValue = {
  brandSettlementPolicyRows: BrandSettlementPolicyVersionRecord[];
  brandTaskPriceRows: BrandTaskPriceVersionRecord[];
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
  getActiveBrandTaskPrice: (
    brandId: string,
    taskConfigId: string,
    effectiveAt: string
  ) => BrandTaskPriceVersionRecord | undefined;
  getActiveBrandSettlementPolicy: (
    brandId: string,
    effectiveAt: string
  ) => BrandSettlementPolicyVersionRecord | undefined;
  saveBrandConfiguration: (input: {
    effectiveAt: string;
    pricingDrafts: BrandTaskPricingDraft[];
    record: BrandRecord;
    settlementPolicyEffectiveAt: string;
  }) => void;
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
  const [brandSettlementPolicyRows, setBrandSettlementPolicyRows] = useState<BrandSettlementPolicyVersionRecord[]>(() =>
    createInitialBrandSettlementPolicyVersions(brandRecords, '2026-01-01')
  );
  const [brandTaskPriceRows, setBrandTaskPriceRows] = useState<BrandTaskPriceVersionRecord[]>(() => brandTaskPriceVersionRecords);
  const [storeRows, setStoreRows] = useState<StoreRecord[]>(() => storeRecords);
  const [contractRows, setContractRows] = useState<CustomerContractRecord[]>(() => customerContractRecords);

  const saveCustomer = useCallback((record: CustomerRecord) => {
    setCustomerRows((currentRows) => upsertById(currentRows, record));
  }, []);

  const saveBrandConfiguration = useCallback(({
    effectiveAt,
    pricingDrafts,
    record,
    settlementPolicyEffectiveAt
  }: {
    effectiveAt: string;
    pricingDrafts: BrandTaskPricingDraft[];
    record: BrandRecord;
    settlementPolicyEffectiveAt: string;
  }) => {
    setBrandRows((currentRows) => upsertById(currentRows, record));
    setBrandSettlementPolicyRows((currentRows) =>
      reconcileBrandSettlementPolicyVersions({
        asOfDate: frontendBusinessToday,
        brandId: record.id,
        effectiveAt: settlementPolicyEffectiveAt,
        policy: record.settlementPolicy,
        policyVersions: currentRows
      })
    );
    setBrandTaskPriceRows((currentRows) =>
      reconcileBrandTaskPriceVersions({
        brandId: record.id,
        effectiveAt,
        priceVersions: currentRows,
        pricingDrafts
      })
    );
  }, []);

  const getActiveBrandSettlementPolicy = useCallback(
    (brandId: string, effectiveAt: string) =>
      resolveActiveBrandSettlementPolicyVersion({
        brandId,
        effectiveAt,
        policyVersions: brandSettlementPolicyRows
      }),
    [brandSettlementPolicyRows]
  );

  const getActiveBrandTaskPrice = useCallback(
    (brandId: string, taskConfigId: string, effectiveAt: string) =>
      resolveActiveBrandTaskPriceVersion({
        brandId,
        effectiveAt,
        priceVersions: brandTaskPriceRows,
        taskConfigId
      }),
    [brandTaskPriceRows]
  );

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
      brandSettlementPolicyRows,
      brandTaskPriceRows,
      brandRows,
      contractRows,
      customerRows,
      storeRows,
      deriveCustomerStatus,
      getBrandById,
      getActiveBrandSettlementPolicy,
      getActiveBrandTaskPrice,
      getBrandStoreCount,
      getCustomerBrandCount,
      getCustomerById,
      getCustomerStoreCount,
      saveBrandConfiguration,
      saveContract,
      saveCustomer,
      saveStore
    }),
    [
      brandRows,
      brandSettlementPolicyRows,
      brandTaskPriceRows,
      contractRows,
      customerRows,
      storeRows,
      deriveCustomerStatus,
      getBrandById,
      getActiveBrandSettlementPolicy,
      getActiveBrandTaskPrice,
      getBrandStoreCount,
      getCustomerBrandCount,
      getCustomerById,
      getCustomerStoreCount,
      saveBrandConfiguration,
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
