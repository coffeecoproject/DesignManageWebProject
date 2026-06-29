export type FinanceTaxpayerType = '小规模纳税人' | '一般纳税人';
export type FinanceTaxCalculationMethod = '简易计税' | '一般计税' | '不涉及';
export type FinanceInputTaxTreatment = '成本入账' | '进项抵扣' | '不可抵扣' | '不涉及';
export type FinanceTaxBasisSource = '来源单据' | '发票台账' | '不涉及发票' | '待确认';
export type FinanceTaxEvidenceStatus = '发票已匹配' | '发票部分匹配' | '发票待补' | '不涉及发票' | '待确认';

export type FinanceVatInvoiceDirectionPolicy = {
  calculationMethod: FinanceTaxCalculationMethod;
  defaultTaxRate: string;
  inputTaxTreatment: FinanceInputTaxTreatment;
  invoiceEvidenceRequired: boolean;
  invoiceKindScope: string[];
  isInputDeductible: boolean;
  taxBasisPriority: string[];
};

export type FinanceVatDeclarationPolicy = {
  quarterlyExemptionThreshold: number;
  resultAuthority: string;
  surchargeRate: number;
  unbilledIncomeTaxRate: string;
};

export type FinanceCorporateIncomeTaxPolicy = {
  ordinaryEffectiveTaxRate: number;
  smallLowProfitAssetLimit: number;
  smallLowProfitEffectiveTaxRate: number;
  smallLowProfitEmployeeLimit: number;
  smallLowProfitStatutoryTaxRate: number;
  smallLowProfitTaxableIncomeLimit: number;
  smallLowProfitTaxableIncomeRatio: number;
};

export type FinanceTaxPolicyProfile = {
  companySubject: string;
  effectivePeriod: string;
  id: string;
  officialResultAuthority: string;
  region: string;
  taxpayerType: FinanceTaxpayerType;
  vat: {
    inputInvoice: FinanceVatInvoiceDirectionPolicy;
    outputInvoice: FinanceVatInvoiceDirectionPolicy;
  };
  vatDeclaration: FinanceVatDeclarationPolicy;
  corporateIncomeTax: FinanceCorporateIncomeTaxPolicy;
};

export type FinanceAccrualTaxPolicy = {
  basisSource: FinanceTaxBasisSource;
  calculationMethod: FinanceTaxCalculationMethod;
  inputTaxTreatment: FinanceInputTaxTreatment;
  invoiceEvidenceRequired: boolean;
  taxRate: string;
  taxpayerType: FinanceTaxpayerType;
};

const invoiceApplicablePayableSourceTypes = new Set(['员工报销', '外协结算', '材料采购', '运营费用']);

export const activeFinanceTaxPolicyProfile: FinanceTaxPolicyProfile = {
  companySubject: '公司主体',
  corporateIncomeTax: {
    ordinaryEffectiveTaxRate: 0.25,
    smallLowProfitAssetLimit: 50000000,
    smallLowProfitEffectiveTaxRate: 0.05,
    smallLowProfitEmployeeLimit: 300,
    smallLowProfitStatutoryTaxRate: 0.2,
    smallLowProfitTaxableIncomeLimit: 3000000,
    smallLowProfitTaxableIncomeRatio: 0.25
  },
  effectivePeriod: '按当期有效政策',
  id: 'tax-policy-profile-hubei-wuhan-small-scale-v1',
  officialResultAuthority: '以电子税务局申报结果和回执为准',
  region: '湖北武汉',
  taxpayerType: '小规模纳税人',
  vat: {
    inputInvoice: {
      calculationMethod: '简易计税',
      defaultTaxRate: '1%',
      inputTaxTreatment: '成本入账',
      invoiceEvidenceRequired: true,
      invoiceKindScope: ['普通发票', '专用发票'],
      isInputDeductible: false,
      taxBasisPriority: ['发票台账', '来源单据']
    },
    outputInvoice: {
      calculationMethod: '简易计税',
      defaultTaxRate: '1%',
      inputTaxTreatment: '不涉及',
      invoiceEvidenceRequired: true,
      invoiceKindScope: ['普通发票', '专用发票'],
      isInputDeductible: false,
      taxBasisPriority: ['发票台账', '来源单据']
    }
  },
  vatDeclaration: {
    quarterlyExemptionThreshold: 300000,
    resultAuthority: '系统只做申报准备测算；最终以电子税务局带出结果和申报回执为准',
    surchargeRate: 0.12,
    unbilledIncomeTaxRate: '1%'
  }
};

export function getActiveFinanceTaxPolicyProfile() {
  return activeFinanceTaxPolicyProfile;
}

export function parseFinanceTaxRate(taxRate: string) {
  const normalizedRate = Number(taxRate.replace('%', ''));

  return Number.isFinite(normalizedRate) ? normalizedRate / 100 : 0;
}

export function formatFinancePercentRate(rate: number) {
  return `${(rate * 100).toFixed(Number.isInteger(rate * 100) ? 0 : 2)}%`;
}

export function roundFinanceTaxPolicyMoney(amount: number) {
  return Number(amount.toFixed(2));
}

export function getFinanceTaxAmountFromIncludedAmount(taxIncludedAmount: number, taxRate: string) {
  const rate = parseFinanceTaxRate(taxRate);

  return rate > 0 ? roundFinanceTaxPolicyMoney((taxIncludedAmount * rate) / (1 + rate)) : 0;
}

export function getFinanceTaxExcludedAmountFromIncludedAmount(taxIncludedAmount: number, taxRate: string) {
  return roundFinanceTaxPolicyMoney(taxIncludedAmount - getFinanceTaxAmountFromIncludedAmount(taxIncludedAmount, taxRate));
}

export function getFinanceVatInvoicePolicy(direction: '销项' | '进项') {
  const profile = getActiveFinanceTaxPolicyProfile();

  return direction === '销项' ? profile.vat.outputInvoice : profile.vat.inputInvoice;
}

export function isFinanceInvoiceEvidenceRequiredForSourceType(sourceType: string) {
  return invoiceApplicablePayableSourceTypes.has(sourceType);
}

export function getFinanceAccrualTaxPolicy(input: { direction: '应收' | '应付'; sourceType: string }): FinanceAccrualTaxPolicy {
  const profile = getActiveFinanceTaxPolicyProfile();

  if (input.direction === '应收') {
    const outputPolicy = profile.vat.outputInvoice;

    return {
      basisSource: '来源单据',
      calculationMethod: outputPolicy.calculationMethod,
      inputTaxTreatment: outputPolicy.inputTaxTreatment,
      invoiceEvidenceRequired: outputPolicy.invoiceEvidenceRequired,
      taxRate: outputPolicy.defaultTaxRate,
      taxpayerType: profile.taxpayerType
    };
  }

  if (isFinanceInvoiceEvidenceRequiredForSourceType(input.sourceType)) {
    const inputPolicy = profile.vat.inputInvoice;

    return {
      basisSource: '来源单据',
      calculationMethod: inputPolicy.calculationMethod,
      inputTaxTreatment: inputPolicy.inputTaxTreatment,
      invoiceEvidenceRequired: inputPolicy.invoiceEvidenceRequired,
      taxRate: inputPolicy.defaultTaxRate,
      taxpayerType: profile.taxpayerType
    };
  }

  return {
    basisSource: '不涉及发票',
    calculationMethod: '不涉及',
    inputTaxTreatment: '不涉及',
    invoiceEvidenceRequired: false,
    taxRate: '0%',
    taxpayerType: profile.taxpayerType
  };
}
