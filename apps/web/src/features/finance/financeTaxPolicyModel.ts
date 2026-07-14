export type FinanceTaxpayerType = '小规模纳税人' | '一般纳税人';
export type FinanceTaxCalculationMethod = '简易计税' | '一般计税' | '不涉及';
export type FinanceInputTaxTreatment = '成本入账' | '进项抵扣' | '不可抵扣' | '不涉及';
export type FinanceTaxBasisSource = '来源单据' | '发票台账' | '不涉及发票' | '待确认';
export type FinanceTaxEvidenceStatus = '发票已匹配' | '发票部分匹配' | '发票待补' | '不涉及发票' | '待确认';
export type FinanceVatFilingCycle = '按月' | '按季';
export type FinanceVatTaxableClassification = '普通应税交易' | '免税交易' | '不动产或土地交易' | '不征税';
export type FinanceVatSalesCategory = '货物及劳务' | '服务、不动产和无形资产';
export type FinanceVatDeclarationOutcome = '待申报判定' | '免税' | '减按1%' | '按法定征收率' | '混合口径' | '不涉及';
export type FinanceVatInvoiceTreatment = '免税' | '减按1%' | '按法定征收率' | '不涉及';

export type FinanceVatInvoiceDirectionPolicy = {
  calculationMethod: FinanceTaxCalculationMethod;
  defaultTaxableClassification: FinanceVatTaxableClassification;
  inputTaxTreatment: FinanceInputTaxTreatment;
  invoiceEvidenceRequired: boolean;
  invoiceKindScope: string[];
  isInputDeductible: boolean;
  taxBasisPriority: string[];
  taxRateSource: '票面税率' | '申报结果';
};

export type FinanceVatSurchargePolicy = {
  educationSurchargeRate: number;
  localEducationSurchargeRate: number;
  microTaxFeeReductionRate: number;
  taxFeeReductionEligibility: '符合' | '不符合' | '待确认';
  urbanMaintenanceTaxRate: number;
};

export type FinanceVatDeclarationPolicy = {
  filingCycle: FinanceVatFilingCycle;
  legalLevyRate: string;
  monthlyExemptionThreshold: number;
  quarterlyExemptionThreshold: number;
  reducedLevyRate: string;
  resultAuthority: string;
  specialInvoicePolicy: {
    supportsPartialExemptionWaiver: boolean;
    supportsPartialReductionWaiver: boolean;
  };
  surchargePolicy: FinanceVatSurchargePolicy;
};

export type FinanceCorporateIncomeTaxPolicy = {
  ordinaryEffectiveTaxRate: number;
  smallLowProfitAssetLimit: number;
  smallLowProfitEffectiveTaxRate: number;
  smallLowProfitEmployeeLimit: number;
  smallLowProfitPreferentialTaxRate: number;
  smallLowProfitTaxableIncomeLimit: number;
  smallLowProfitTaxableIncomeRatio: number;
};

export type FinanceIndividualIncomeTaxPolicy = {
  calculationMode: '累计预扣法';
  declarationCycle: '按月';
  sourceModules: string[];
};

export type FinanceStampDutyDeclarationCycle = '按季' | '按次' | '按年';
export type FinanceStampDutyReductionEligibility = '符合' | '不符合' | '待确认';
export type FinanceStampDutyTaxItem =
  | '借款合同'
  | '融资租赁合同'
  | '买卖合同'
  | '承揽合同'
  | '建设工程合同'
  | '运输合同'
  | '技术合同'
  | '租赁合同'
  | '保管合同'
  | '仓储合同'
  | '财产保险合同'
  | '土地使用权出让书据'
  | '土地及房屋权属转让书据'
  | '股权转让书据'
  | '知识产权转让书据'
  | '营业账簿';

export type FinanceStampDutyTaxItemPolicy = {
  applicableDocuments: string;
  item: FinanceStampDutyTaxItem;
  legalRate: number;
};

export type FinanceStampDutyPolicy = {
  declarationCycles: {
    capitalBooks: Extract<FinanceStampDutyDeclarationCycle, '按年' | '按次'>;
    taxableDocuments: Extract<FinanceStampDutyDeclarationCycle, '按季' | '按次'>;
  };
  items: FinanceStampDutyTaxItemPolicy[];
  microTaxFeeReductionRate: number;
  reductionEligibility: FinanceStampDutyReductionEligibility;
};

export type FinanceTaxPolicySource = {
  label: string;
  url: string;
};

export type FinanceTaxPolicyProfile = {
  companySubject: string;
  corporateIncomeTax: FinanceCorporateIncomeTaxPolicy;
  effectiveFrom: string;
  effectiveTo: string;
  id: string;
  individualIncomeTax: FinanceIndividualIncomeTaxPolicy;
  officialResultAuthority: string;
  region: string;
  sources: FinanceTaxPolicySource[];
  stampDuty: FinanceStampDutyPolicy;
  taxpayerType: FinanceTaxpayerType;
  vat: {
    inputInvoice: FinanceVatInvoiceDirectionPolicy;
    outputInvoice: FinanceVatInvoiceDirectionPolicy;
  };
  vatDeclaration: FinanceVatDeclarationPolicy;
  version: string;
};

export type FinanceAccrualTaxPolicy = {
  basisSource: FinanceTaxBasisSource;
  calculationMethod: FinanceTaxCalculationMethod;
  inputTaxTreatment: FinanceInputTaxTreatment;
  invoiceEvidenceRequired: boolean;
  taxOutcome: FinanceVatDeclarationOutcome;
  taxRate: string;
  taxableClassification: FinanceVatTaxableClassification;
  taxpayerType: FinanceTaxpayerType;
};

export type FinanceVatSurchargeSummary = {
  educationSurchargeAfterReduction: number;
  educationSurchargeBeforeReduction: number;
  educationSurchargeReduction: number;
  localEducationSurchargeAfterReduction: number;
  localEducationSurchargeBeforeReduction: number;
  localEducationSurchargeReduction: number;
  reductionAmount: number;
  totalAfterReduction: number;
  totalBeforeReduction: number;
  urbanMaintenanceTaxAfterReduction: number;
  urbanMaintenanceTaxBeforeReduction: number;
  urbanMaintenanceTaxReduction: number;
};

const invoiceApplicablePayableSourceTypes = new Set(['员工报销', '外协结算', '材料采购', '运营费用']);
const currentMockPolicyPeriod = '2026-06';

export const financeTaxPolicyProfiles: FinanceTaxPolicyProfile[] = [
  {
    companySubject: '公司主体',
    corporateIncomeTax: {
      ordinaryEffectiveTaxRate: 0.25,
      smallLowProfitAssetLimit: 50000000,
      smallLowProfitEffectiveTaxRate: 0.05,
      smallLowProfitEmployeeLimit: 300,
      smallLowProfitPreferentialTaxRate: 0.2,
      smallLowProfitTaxableIncomeLimit: 3000000,
      smallLowProfitTaxableIncomeRatio: 0.25
    },
    effectiveFrom: '2026-01',
    effectiveTo: '2027-12',
    id: 'tax-policy-profile-hubei-wuhan-small-scale-2026-2027',
    individualIncomeTax: {
      calculationMode: '累计预扣法',
      declarationCycle: '按月',
      sourceModules: ['薪酬明细', '个税专项扣除资料']
    },
    officialResultAuthority: '以电子税务局申报结果、缴款信息和回执为准',
    region: '湖北武汉',
    sources: [
      {
        label: '增值税法施行后小规模纳税人优惠衔接口径',
        url: 'https://tianjin.chinatax.gov.cn/11200000000/0300/030005/20260428092905632.shtml'
      },
      {
        label: '小规模纳税人专票与放弃减免税口径',
        url: 'https://tianjin.chinatax.gov.cn/11200000000/0300/030005/20260324101338489.shtml'
      },
      {
        label: '湖北小微主体六税两费减征口径',
        url: 'https://jxt.hubei.gov.cn/bmdt/rdjj/202505/t20250523_5660180.shtml'
      },
      {
        label: '小型微利企业所得税优惠口径',
        url: 'https://tianjin.chinatax.gov.cn/11200000000/0300/030005/20260129152603882.shtml'
      },
      {
        label: '中华人民共和国印花税法',
        url: 'https://fgk.chinatax.gov.cn/zcfgk/c100009/c5193058/content.html'
      },
      {
        label: '印花税若干事项政策执行口径',
        url: 'https://fgk.chinatax.gov.cn/zcfgk/c102416/c5202012/content.html'
      },
      {
        label: '印花税税源明细与征收管理规则',
        url: 'https://shanghai.chinatax.gov.cn/zcfw/zcfgk/yhs/202206/t463170.html'
      }
    ],
    stampDuty: {
      declarationCycles: {
        capitalBooks: '按年',
        taxableDocuments: '按季'
      },
      items: [
        { applicableDocuments: '银行业金融机构等签订的借款合同', item: '借款合同', legalRate: 0.00005 },
        { applicableDocuments: '融资租赁合同', item: '融资租赁合同', legalRate: 0.00005 },
        { applicableDocuments: '动产买卖合同', item: '买卖合同', legalRate: 0.0003 },
        { applicableDocuments: '加工、定作、修理等承揽合同', item: '承揽合同', legalRate: 0.0003 },
        { applicableDocuments: '工程勘察、设计和施工合同', item: '建设工程合同', legalRate: 0.0003 },
        { applicableDocuments: '货运合同和多式联运合同', item: '运输合同', legalRate: 0.0003 },
        { applicableDocuments: '技术开发、转让、许可、咨询或服务合同', item: '技术合同', legalRate: 0.0003 },
        { applicableDocuments: '房屋、设备等租赁合同', item: '租赁合同', legalRate: 0.001 },
        { applicableDocuments: '保管合同', item: '保管合同', legalRate: 0.001 },
        { applicableDocuments: '仓储合同', item: '仓储合同', legalRate: 0.001 },
        { applicableDocuments: '财产保险合同', item: '财产保险合同', legalRate: 0.001 },
        { applicableDocuments: '土地使用权出让书据', item: '土地使用权出让书据', legalRate: 0.0005 },
        { applicableDocuments: '土地使用权、房屋等权属转让书据', item: '土地及房屋权属转让书据', legalRate: 0.0005 },
        { applicableDocuments: '股权转让书据', item: '股权转让书据', legalRate: 0.0005 },
        { applicableDocuments: '商标、著作权、专利及专有技术转让书据', item: '知识产权转让书据', legalRate: 0.0003 },
        { applicableDocuments: '实收资本与资本公积合计新增额', item: '营业账簿', legalRate: 0.00025 }
      ],
      microTaxFeeReductionRate: 0.5,
      reductionEligibility: '符合'
    },
    taxpayerType: '小规模纳税人',
    vat: {
      inputInvoice: {
        calculationMethod: '简易计税',
        defaultTaxableClassification: '普通应税交易',
        inputTaxTreatment: '成本入账',
        invoiceEvidenceRequired: true,
        invoiceKindScope: ['普通发票', '专用发票'],
        isInputDeductible: false,
        taxBasisPriority: ['发票台账', '来源单据'],
        taxRateSource: '票面税率'
      },
      outputInvoice: {
        calculationMethod: '简易计税',
        defaultTaxableClassification: '普通应税交易',
        inputTaxTreatment: '不涉及',
        invoiceEvidenceRequired: true,
        invoiceKindScope: ['普通发票', '专用发票'],
        isInputDeductible: false,
        taxBasisPriority: ['发票台账', '来源单据'],
        taxRateSource: '票面税率'
      }
    },
    vatDeclaration: {
      filingCycle: '按季',
      legalLevyRate: '3%',
      monthlyExemptionThreshold: 100000,
      quarterlyExemptionThreshold: 300000,
      reducedLevyRate: '1%',
      resultAuthority: '系统按票面、未开票收入和政策版本生成申报准备；最终以电子税务局申报结果和回执为准',
      specialInvoicePolicy: {
        supportsPartialExemptionWaiver: true,
        supportsPartialReductionWaiver: true
      },
      surchargePolicy: {
        educationSurchargeRate: 0.03,
        localEducationSurchargeRate: 0.02,
        microTaxFeeReductionRate: 0.5,
        taxFeeReductionEligibility: '符合',
        urbanMaintenanceTaxRate: 0.07
      }
    },
    version: '2026.1'
  }
];

export const activeFinanceTaxPolicyProfile = financeTaxPolicyProfiles[0]!;

function isPeriodWithinProfile(period: string, profile: FinanceTaxPolicyProfile) {
  return period >= profile.effectiveFrom && period <= profile.effectiveTo;
}

export function getFinanceTaxPolicyProfileForPeriod(period: string) {
  return financeTaxPolicyProfiles.find((profile) => isPeriodWithinProfile(period, profile));
}

export function getActiveFinanceTaxPolicyProfile(period = currentMockPolicyPeriod) {
  const profile = getFinanceTaxPolicyProfileForPeriod(period);

  if (!profile) {
    throw new Error(`税务口径缺少 ${period} 所属期的生效版本`);
  }

  return profile;
}

export function getFinanceTaxPolicyEffectiveRange(profile: FinanceTaxPolicyProfile) {
  return `${profile.effectiveFrom} 至 ${profile.effectiveTo}`;
}

export function parseFinanceTaxRate(taxRate: string) {
  const normalizedRate = Number(taxRate.replace('%', ''));

  return Number.isFinite(normalizedRate) ? normalizedRate / 100 : 0;
}

export function formatFinancePercentRate(rate: number) {
  const percentage = Math.round(rate * 10000) / 100;

  return `${percentage.toFixed(Number.isInteger(percentage) ? 0 : 2)}%`;
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

export function getFinanceVatInvoicePolicy(direction: '销项' | '进项', accountingPeriod?: string) {
  const profile = getActiveFinanceTaxPolicyProfile(accountingPeriod);

  return direction === '销项' ? profile.vat.outputInvoice : profile.vat.inputInvoice;
}

export function getFinanceVatExemptionThreshold(
  policy = getActiveFinanceTaxPolicyProfile().vatDeclaration
) {
  return policy.filingCycle === '按月' ? policy.monthlyExemptionThreshold : policy.quarterlyExemptionThreshold;
}

export function getFinanceVatDeclarationOutcome(input: {
  accountingPeriod?: string;
  taxableClassification: FinanceVatTaxableClassification;
  taxableSalesAmount: number;
  taxOutcome?: FinanceVatDeclarationOutcome;
}) {
  if (input.taxOutcome) {
    return input.taxOutcome;
  }

  if (input.taxableClassification === '不征税') {
    return '不涉及' as const;
  }

  if (input.taxableClassification === '免税交易') {
    return '免税' as const;
  }

  if (input.taxableClassification === '不动产或土地交易') {
    return '按法定征收率' as const;
  }

  const profile = getActiveFinanceTaxPolicyProfile(input.accountingPeriod);

  return input.taxableSalesAmount <= getFinanceVatExemptionThreshold(profile.vatDeclaration) ? '免税' : '减按1%';
}

export function getFinanceVatOutcomeRate(outcome: FinanceVatDeclarationOutcome, accountingPeriod?: string) {
  const policy = getActiveFinanceTaxPolicyProfile(accountingPeriod).vatDeclaration;

  if (outcome === '免税' || outcome === '不涉及') {
    return '0%';
  }

  if (outcome === '减按1%') {
    return policy.reducedLevyRate;
  }

  if (outcome === '按法定征收率') {
    return policy.legalLevyRate;
  }

  return '-';
}

export function resolveFinanceVatInvoiceTreatment(input: {
  accountingPeriod: string;
  direction: '销项' | '进项';
  taxRate: string;
  taxableClassification: FinanceVatTaxableClassification;
}): FinanceVatInvoiceTreatment {
  if (input.direction === '进项' || input.taxableClassification === '不征税') {
    return '不涉及';
  }

  if (input.taxableClassification === '免税交易' || parseFinanceTaxRate(input.taxRate) === 0) {
    return '免税';
  }

  const policy = getActiveFinanceTaxPolicyProfile(input.accountingPeriod).vatDeclaration;
  const rate = parseFinanceTaxRate(input.taxRate);

  if (rate === parseFinanceTaxRate(policy.reducedLevyRate)) {
    return '减按1%';
  }

  return '按法定征收率';
}

export function getFinanceVatSurchargeSummary(input: {
  accountingPeriod: string;
  vatPayableAmount: number;
  qualifiesForMicroTaxFeeReduction?: boolean;
}): FinanceVatSurchargeSummary {
  const policy = getActiveFinanceTaxPolicyProfile(input.accountingPeriod).vatDeclaration.surchargePolicy;
  const vatPayableAmount = Math.max(0, input.vatPayableAmount);
  const reductionRate = input.qualifiesForMicroTaxFeeReduction === false
    ? 0
    : policy.microTaxFeeReductionRate;
  const urbanMaintenanceTaxBeforeReduction = roundFinanceTaxPolicyMoney(vatPayableAmount * policy.urbanMaintenanceTaxRate);
  const educationSurchargeBeforeReduction = roundFinanceTaxPolicyMoney(vatPayableAmount * policy.educationSurchargeRate);
  const localEducationSurchargeBeforeReduction = roundFinanceTaxPolicyMoney(vatPayableAmount * policy.localEducationSurchargeRate);
  const urbanMaintenanceTaxReduction = roundFinanceTaxPolicyMoney(urbanMaintenanceTaxBeforeReduction * reductionRate);
  const educationSurchargeReduction = roundFinanceTaxPolicyMoney(educationSurchargeBeforeReduction * reductionRate);
  const localEducationSurchargeReduction = roundFinanceTaxPolicyMoney(localEducationSurchargeBeforeReduction * reductionRate);
  const urbanMaintenanceTaxAfterReduction = roundFinanceTaxPolicyMoney(
    urbanMaintenanceTaxBeforeReduction - urbanMaintenanceTaxReduction
  );
  const educationSurchargeAfterReduction = roundFinanceTaxPolicyMoney(
    educationSurchargeBeforeReduction - educationSurchargeReduction
  );
  const localEducationSurchargeAfterReduction = roundFinanceTaxPolicyMoney(
    localEducationSurchargeBeforeReduction - localEducationSurchargeReduction
  );
  const totalBeforeReduction = roundFinanceTaxPolicyMoney(
    urbanMaintenanceTaxBeforeReduction + educationSurchargeBeforeReduction + localEducationSurchargeBeforeReduction
  );
  const reductionAmount = roundFinanceTaxPolicyMoney(
    urbanMaintenanceTaxReduction + educationSurchargeReduction + localEducationSurchargeReduction
  );

  return {
    educationSurchargeAfterReduction,
    educationSurchargeBeforeReduction,
    educationSurchargeReduction,
    localEducationSurchargeAfterReduction,
    localEducationSurchargeBeforeReduction,
    localEducationSurchargeReduction,
    reductionAmount,
    totalAfterReduction: roundFinanceTaxPolicyMoney(
      urbanMaintenanceTaxAfterReduction + educationSurchargeAfterReduction + localEducationSurchargeAfterReduction
    ),
    totalBeforeReduction,
    urbanMaintenanceTaxAfterReduction,
    urbanMaintenanceTaxBeforeReduction,
    urbanMaintenanceTaxReduction
  };
}

export function isFinanceInvoiceEvidenceRequiredForSourceType(sourceType: string) {
  return invoiceApplicablePayableSourceTypes.has(sourceType);
}

export function getFinanceAccrualTaxPolicy(input: { accountingPeriod?: string; direction: '应收' | '应付'; sourceType: string }): FinanceAccrualTaxPolicy {
  const profile = getActiveFinanceTaxPolicyProfile(input.accountingPeriod);

  if (input.direction === '应收') {
    const outputPolicy = profile.vat.outputInvoice;

    return {
      basisSource: '来源单据',
      calculationMethod: outputPolicy.calculationMethod,
      inputTaxTreatment: outputPolicy.inputTaxTreatment,
      invoiceEvidenceRequired: outputPolicy.invoiceEvidenceRequired,
      taxOutcome: '待申报判定',
      taxRate: '待票面或申报判定',
      taxableClassification: outputPolicy.defaultTaxableClassification,
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
      taxOutcome: '不涉及',
      taxRate: '以票面为准',
      taxableClassification: inputPolicy.defaultTaxableClassification,
      taxpayerType: profile.taxpayerType
    };
  }

  return {
    basisSource: '不涉及发票',
    calculationMethod: '不涉及',
    inputTaxTreatment: '不涉及',
    invoiceEvidenceRequired: false,
    taxOutcome: '不涉及',
    taxRate: '0%',
    taxableClassification: '不征税',
    taxpayerType: profile.taxpayerType
  };
}
