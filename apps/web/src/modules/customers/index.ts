// Entry of the customers module: everything other modules and the app use from it.
export { calculateBrandAcceptance, cloneBrandAcceptancePolicy } from './brandAcceptancePolicyModel';
export type { BrandAcceptancePolicy, BrandAcceptancePolicyRecord, BrandAcceptanceTimelinessResult } from './brandAcceptancePolicyModel';
export { isBrandPricingContractEligible } from './brandTaskPricingModel';
export type { BrandPricingContract, BrandSettlementPolicy, BrandSettlementPolicyVersionRecord, BrandTaskPriceVersionRecord } from './brandTaskPricingModel';
export type { CustomerContractReceiptView } from './contractReceiptModel';
export { customerContractRecords, customerRecords } from './customerData';
export type { BrandRecord, CustomerContactRecord, CustomerContractAmountTaxMode, CustomerContractBusinessNature, CustomerContractReceiptMethod, CustomerContractReceiptRecord, CustomerContractRecord, CustomerRecord, StoreRecord } from './customerData';
export { CustomerManagementProvider, useCustomerManagementState } from './CustomerManagementState';
