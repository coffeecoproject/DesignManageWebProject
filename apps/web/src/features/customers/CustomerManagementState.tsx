import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { frontendBusinessToday } from '../../app/frontendBusinessClock';
import {
  brandTaskPriceVersionRecords,
  brandRecords,
  customerContractRecords,
  customerRecords,
  deriveCustomerStatus as deriveCustomerStatusFromContracts,
  deriveCustomerContractStatus,
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
import {
  createInitialBrandAcceptancePolicies,
  getBrandAcceptancePolicy,
  upsertBrandAcceptancePolicy,
  type BrandAcceptancePolicy,
  type BrandAcceptancePolicyRecord
} from './brandAcceptancePolicyModel';

type CustomerManagementStateValue = {
  brandAcceptancePolicyRows: BrandAcceptancePolicyRecord[];
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
  getBrandAcceptancePolicy: (brandId: string) => BrandAcceptancePolicyRecord | undefined;
  saveBrandConfiguration: (input: {
    acceptancePolicy: BrandAcceptancePolicy;
    effectiveAt: string;
    pricingDrafts: BrandTaskPricingDraft[];
    record: BrandRecord;
    settlementPolicyEffectiveAt: string;
  }) => void;
  saveContract: (record: CustomerContractRecord) => void;
  saveCustomer: (record: CustomerRecord) => void;
  saveStore: (record: StoreRecord) => void;
  terminateContract: (contractId: string, terminatedAt: string, reason: string) => boolean;
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
  const [brandAcceptancePolicyRows, setBrandAcceptancePolicyRows] = useState<BrandAcceptancePolicyRecord[]>(() =>
    createInitialBrandAcceptancePolicies(brandRecords)
  );
  const [brandTaskPriceRows, setBrandTaskPriceRows] = useState<BrandTaskPriceVersionRecord[]>(() => brandTaskPriceVersionRecords);
  const [storeRows, setStoreRows] = useState<StoreRecord[]>(() => storeRecords);
  const [contractRows, setContractRows] = useState<CustomerContractRecord[]>(() => customerContractRecords);
  const effectiveContractRows = useMemo(
    () => contractRows.map((record) => ({
      ...record,
      status: deriveCustomerContractStatus(record, frontendBusinessToday)
    })),
    [contractRows]
  );

  const saveCustomer = useCallback((record: CustomerRecord) => {
    setCustomerRows((currentRows) => upsertById(currentRows, record));
  }, []);

  const saveBrandConfiguration = useCallback(({
    acceptancePolicy,
    effectiveAt,
    pricingDrafts,
    record,
    settlementPolicyEffectiveAt
  }: {
    acceptancePolicy: BrandAcceptancePolicy;
    effectiveAt: string;
    pricingDrafts: BrandTaskPricingDraft[];
    record: BrandRecord;
    settlementPolicyEffectiveAt: string;
  }) => {
    setBrandRows((currentRows) => upsertById(currentRows, record));
    setBrandAcceptancePolicyRows((currentRows) =>
      upsertBrandAcceptancePolicy({
        brandId: record.id,
        policy: acceptancePolicy,
        policies: currentRows
      })
    );
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

  const resolveBrandAcceptancePolicy = useCallback(
    (brandId: string) =>
      getBrandAcceptancePolicy({
        brandId,
        policies: brandAcceptancePolicyRows
      }),
    [brandAcceptancePolicyRows]
  );

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

  const terminateContract = useCallback((contractId: string, terminatedAt: string, reason: string) => {
    if (!terminatedAt || !reason.trim()) {
      return false;
    }

    const target = effectiveContractRows.find((record) => record.id === contractId);
    if (!target || target.status !== '有效') {
      return false;
    }

    setContractRows((currentRows) => currentRows.map((record) => {
      if (record.id !== contractId) {
        return record;
      }

      return {
        ...record,
        status: '已终止',
        terminatedAt,
        terminationReason: reason.trim(),
        updatedAt: frontendBusinessToday
      };
    }));
    return true;
  }, [effectiveContractRows]);

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
    (customerId: string) => deriveCustomerStatusFromContracts(customerId, effectiveContractRows),
    [effectiveContractRows]
  );

  const value = useMemo<CustomerManagementStateValue>(
    () => ({
      brandAcceptancePolicyRows,
      brandSettlementPolicyRows,
      brandTaskPriceRows,
      brandRows,
      contractRows: effectiveContractRows,
      customerRows,
      storeRows,
      deriveCustomerStatus,
      getBrandById,
      getBrandAcceptancePolicy: resolveBrandAcceptancePolicy,
      getActiveBrandSettlementPolicy,
      getActiveBrandTaskPrice,
      getBrandStoreCount,
      getCustomerBrandCount,
      getCustomerById,
      getCustomerStoreCount,
      saveBrandConfiguration,
      saveContract,
      saveCustomer,
      saveStore,
      terminateContract
    }),
    [
      brandRows,
      brandAcceptancePolicyRows,
      brandSettlementPolicyRows,
      brandTaskPriceRows,
      effectiveContractRows,
      customerRows,
      storeRows,
      deriveCustomerStatus,
      getBrandById,
      resolveBrandAcceptancePolicy,
      getActiveBrandSettlementPolicy,
      getActiveBrandTaskPrice,
      getBrandStoreCount,
      getCustomerBrandCount,
      getCustomerById,
      getCustomerStoreCount,
      saveBrandConfiguration,
      saveContract,
      saveCustomer,
      saveStore,
      terminateContract
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
