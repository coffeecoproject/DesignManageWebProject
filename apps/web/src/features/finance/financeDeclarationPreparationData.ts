import type { StatusTagTone } from '../../components/Detail';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceInvoiceRecord } from './financeInvoiceData';
import {
  buildTransactionInvoiceAssociation,
  getInvoiceAmount,
  getInvoiceMatchStatus,
  getInvoiceTaxExcludedAmount,
  getRedInvoiceOriginalAssociationStatus,
  isInvoiceEffective,
  isTransactionInvoiceAssociationRequired
} from './financeInvoiceModel';
import {
  getActiveFinanceTaxPolicyProfile,
  getFinanceTaxExcludedAmountFromIncludedAmount,
  parseFinanceTaxRate
} from './financeTaxPolicyModel';
import {
  financeToday,
  getAccountingPeriodFromBusinessPeriod,
  getFinanceTransactionInvoiceDeclarationStatus
} from './financeUtils';

export type FinanceDeclarationPreparationTaxType = '增值税及附加' | '企业所得税' | '印花税';
export type FinanceDeclarationPreparationStatus = '准备中' | '可申报' | '已进入税务办理';
export type FinanceDeclarationPreparationItemStatus = '待确认' | '已确认' | '无需确认';
export type FinanceDeclarationPreparationItemType =
  | '销项发票核对'
  | '红票关联原蓝票'
  | '前期未开票后续开票'
  | '未开票收入确认'
  | '申报口径确认'
  | '内部核对风险'
  | '资金复核提示'
  | '利润数据确认'
  | '纳税调整确认'
  | '优惠资格确认'
  | '预缴口径确认';

export type FinanceDeclarationPreparationItem = {
  amount: number;
  id: string;
  period: string;
  result: string;
  sourceModule: string;
  status: FinanceDeclarationPreparationItemStatus;
  title: string;
  type: FinanceDeclarationPreparationItemType;
  updatedAt: string;
};

export type FinanceCorporateIncomeTaxSourceStatus = '已同步' | '待确认' | '已确认';

export type FinanceCorporateIncomeTaxSourceRow = {
  amount: number;
  id: string;
  name: string;
  result: string;
  sourceModule: string;
  sourcePeriod: string;
  status: FinanceCorporateIncomeTaxSourceStatus;
};

export type FinanceVatPreparationSummary = {
  declaredNetSalesAmount: number;
  estimatedSurcharge: number;
  estimatedTotalTaxAmount: number;
  estimatedVatAfterExemption: number;
  estimatedVatBeforeExemption: number;
  isBelowQuarterlyExemptionThreshold: boolean;
  outputBlueNetAmount: number;
  outputBlueTaxIncludedAmount: number;
  priorUnbilledOffsetNetAmount: number;
  quarterlyExemptionThreshold: number;
  redInvoiceNetAmount: number;
  riskInvoiceCashflowAmount: number;
  riskUnreviewedCashflowAmount: number;
  unbilledIncomeNetAmount: number;
};

export type FinanceCorporateIncomeTaxPreparationSummary = {
  averageAssetAmount: number;
  averageEmployeeCount: number;
  estimatedCorporateIncomeTaxAmount: number;
  effectiveTaxRate: number;
  industryRestrictionResult: '符合' | '不符合' | '待确认';
  operatingCostAmount: number;
  operatingRevenueAmount: number;
  payrollAndSocialInsuranceAmount: number;
  periodExpenseAmount: number;
  policyBasis: string;
  priorLossDeductionAmount: number;
  profitBeforeTaxAmount: number;
  smallLowProfitAssetLimit: number;
  smallLowProfitEligible: boolean;
  smallLowProfitEmployeeLimit: number;
  smallLowProfitTaxableIncomeLimit: number;
  statutoryTaxRate: number;
  taxableIncomeAmount: number;
  taxableIncomeInclusionRate: number;
  taxAdjustmentDecreaseAmount: number;
  taxAdjustmentIncreaseAmount: number;
  taxRate: number;
};

export type FinanceDeclarationPreparationRecord = {
  confirmedSourceSnapshotKey?: string;
  confirmedCitSummary?: FinanceCorporateIncomeTaxPreparationSummary;
  confirmedVatSummary?: FinanceVatPreparationSummary;
  deferredUnbilledIncomeTransactionNos?: string[];
  id: string;
  items: FinanceDeclarationPreparationItem[];
  operationRecords: OperationRecord[];
  owner: string;
  period: string;
  periodType: '季度' | '年度' | '按次';
  preparationNo: string;
  sourceSnapshotKey?: string;
  status: FinanceDeclarationPreparationStatus;
  taxType: FinanceDeclarationPreparationTaxType;
  title: string;
  citSummary?: FinanceCorporateIncomeTaxPreparationSummary;
  unbilledIncomeTransactionNos?: string[];
  updatedAt: string;
  vatSummary: FinanceVatPreparationSummary;
};

export type FinanceDeclarationUnbilledIncomeCandidate = {
  invoiceDeclarationStatus: ReturnType<typeof getFinanceTransactionInvoiceDeclarationStatus>;
  netAmount: number;
  record: FinanceTransactionRecord;
};

export type FinanceDeclarationSubsequentInvoiceCandidate = {
  amount: number;
  invoice: FinanceInvoiceRecord;
  invoiceDeclarationStatus: ReturnType<typeof getFinanceTransactionInvoiceDeclarationStatus>;
  netAmount: number;
  record: FinanceTransactionRecord;
};

const activeTaxPolicyProfile = getActiveFinanceTaxPolicyProfile();
const activeVatDeclarationPolicy = activeTaxPolicyProfile.vatDeclaration;
const activeCorporateIncomeTaxPolicy = activeTaxPolicyProfile.corporateIncomeTax;

export const VAT_QUARTERLY_EXEMPTION_THRESHOLD = activeVatDeclarationPolicy.quarterlyExemptionThreshold;
const VAT_EFFECTIVE_LEVY_RATE = parseFinanceTaxRate(activeVatDeclarationPolicy.unbilledIncomeTaxRate);
const VAT_SURCHARGE_RATE = activeVatDeclarationPolicy.surchargeRate;

export const declarationPreparationStatusTone = {
  准备中: 'amber',
  可申报: 'blue',
  已进入税务办理: 'green'
} as const satisfies Record<FinanceDeclarationPreparationStatus, StatusTagTone>;

export const declarationPreparationItemStatusTone = {
  待确认: 'amber',
  已确认: 'green',
  无需确认: 'gray'
} as const satisfies Record<FinanceDeclarationPreparationItemStatus, StatusTagTone>;

export const corporateIncomeTaxSourceStatusTone = {
  已同步: 'blue',
  待确认: 'amber',
  已确认: 'green'
} as const satisfies Record<FinanceCorporateIncomeTaxSourceStatus, StatusTagTone>;

const emptyVatSummary: FinanceVatPreparationSummary = {
  declaredNetSalesAmount: 0,
  estimatedSurcharge: 0,
  estimatedTotalTaxAmount: 0,
  estimatedVatAfterExemption: 0,
  estimatedVatBeforeExemption: 0,
  isBelowQuarterlyExemptionThreshold: true,
  outputBlueNetAmount: 0,
  outputBlueTaxIncludedAmount: 0,
  priorUnbilledOffsetNetAmount: 0,
  quarterlyExemptionThreshold: VAT_QUARTERLY_EXEMPTION_THRESHOLD,
  redInvoiceNetAmount: 0,
  riskInvoiceCashflowAmount: 0,
  riskUnreviewedCashflowAmount: 0,
  unbilledIncomeNetAmount: 0
};

const emptyCitSummary: FinanceCorporateIncomeTaxPreparationSummary = {
  averageAssetAmount: 0,
  averageEmployeeCount: 0,
  estimatedCorporateIncomeTaxAmount: 0,
  effectiveTaxRate: activeCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate,
  industryRestrictionResult: '待确认',
  operatingCostAmount: 0,
  operatingRevenueAmount: 0,
  payrollAndSocialInsuranceAmount: 0,
  periodExpenseAmount: 0,
  policyBasis: '普通企业预缴口径',
  priorLossDeductionAmount: 0,
  profitBeforeTaxAmount: 0,
  smallLowProfitAssetLimit: activeCorporateIncomeTaxPolicy.smallLowProfitAssetLimit,
  smallLowProfitEligible: false,
  smallLowProfitEmployeeLimit: activeCorporateIncomeTaxPolicy.smallLowProfitEmployeeLimit,
  smallLowProfitTaxableIncomeLimit: activeCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeLimit,
  statutoryTaxRate: activeCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate,
  taxableIncomeAmount: 0,
  taxableIncomeInclusionRate: 1,
  taxAdjustmentDecreaseAmount: 0,
  taxAdjustmentIncreaseAmount: 0,
  taxRate: activeCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate
};

function calculateCorporateIncomeTaxAmount(summary: Omit<FinanceCorporateIncomeTaxPreparationSummary, 'estimatedCorporateIncomeTaxAmount'>) {
  return roundMoney(Math.max(0, summary.taxableIncomeAmount) * summary.effectiveTaxRate);
}

function buildSmallLowProfitPolicyBasis(summary: Pick<
  FinanceCorporateIncomeTaxPreparationSummary,
  'effectiveTaxRate' | 'industryRestrictionResult' | 'smallLowProfitEligible'
>) {
  if (!summary.smallLowProfitEligible) {
    return summary.industryRestrictionResult === '待确认' ? '小型微利资格待确认' : '普通企业预缴口径';
  }

  return `符合小型微利企业候选口径，按 ${(summary.effectiveTaxRate * 100).toFixed(0)}% 有效预缴率预估`;
}

function getCorporateIncomeTaxItemSourceStatus(
  record: FinanceDeclarationPreparationRecord,
  type: FinanceDeclarationPreparationItemType
): FinanceCorporateIncomeTaxSourceStatus {
  return record.items.find((item) => item.type === type)?.status === '已确认' ? '已确认' : '待确认';
}

export function buildCorporateIncomeTaxSourceRows(record: FinanceDeclarationPreparationRecord): FinanceCorporateIncomeTaxSourceRow[] {
  if (record.taxType !== '企业所得税') {
    return [];
  }

  const summary = record.citSummary ?? emptyCitSummary;

  return [
    {
      amount: summary.operatingRevenueAmount,
      id: `${record.id}-cit-source-revenue`,
      name: '经营收入',
      result: '本季度经营收入汇总',
      sourceModule: '经营数据',
      sourcePeriod: record.period,
      status: '已同步'
    },
    {
      amount: roundMoney(summary.operatingCostAmount + summary.periodExpenseAmount),
      id: `${record.id}-cit-source-cost-expense`,
      name: '成本费用',
      result: `营业成本 ${roundMoney(summary.operatingCostAmount).toLocaleString('zh-CN')} 元 / 期间费用 ${roundMoney(summary.periodExpenseAmount).toLocaleString('zh-CN')} 元`,
      sourceModule: '经营数据',
      sourcePeriod: record.period,
      status: '已同步'
    },
    {
      amount: summary.payrollAndSocialInsuranceAmount,
      id: `${record.id}-cit-source-payroll`,
      name: '薪酬社保',
      result: '薪酬明细与社保公积金缴费明细结果',
      sourceModule: '薪酬社保',
      sourcePeriod: record.period,
      status: '已同步'
    },
    {
      amount: roundMoney(summary.taxAdjustmentIncreaseAmount - summary.taxAdjustmentDecreaseAmount),
      id: `${record.id}-cit-source-adjustment`,
      name: '纳税调整',
      result: `调增 ${roundMoney(summary.taxAdjustmentIncreaseAmount).toLocaleString('zh-CN')} 元 / 调减 ${roundMoney(summary.taxAdjustmentDecreaseAmount).toLocaleString('zh-CN')} 元`,
      sourceModule: '申报准备',
      sourcePeriod: record.period,
      status: getCorporateIncomeTaxItemSourceStatus(record, '纳税调整确认')
    },
    {
      amount: summary.priorLossDeductionAmount,
      id: `${record.id}-cit-source-loss`,
      name: '弥补亏损',
      result: '以前年度可弥补亏损抵减',
      sourceModule: '历史亏损台账',
      sourcePeriod: record.period,
      status: getCorporateIncomeTaxItemSourceStatus(record, '纳税调整确认')
    },
    {
      amount: summary.estimatedCorporateIncomeTaxAmount,
      id: `${record.id}-cit-source-policy`,
      name: '小型微利资格',
      result: summary.policyBasis,
      sourceModule: '税务口径',
      sourcePeriod: record.period,
      status: getCorporateIncomeTaxItemSourceStatus(record, '优惠资格确认')
    }
  ];
}

function createVatItems(period: string, suffix: string): FinanceDeclarationPreparationItem[] {
  return [
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-output`,
      period,
      result: '待同步销项发票',
      sourceModule: '发票台账',
      status: '待确认',
      title: '销项发票',
      type: '销项发票核对',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-red`,
      period,
      result: '待确认红票关联',
      sourceModule: '发票匹配',
      status: '待确认',
      title: '红票关联原蓝票',
      type: '红票关联原蓝票',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-subsequent`,
      period,
      result: '待确认前期未开票后续开票',
      sourceModule: '发票匹配',
      status: '待确认',
      title: '前期未开票后续开票',
      type: '前期未开票后续开票',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-unbilled`,
      period,
      result: '待确认未开票收入',
      sourceModule: '收支流水',
      status: '待确认',
      title: '未开票收入',
      type: '未开票收入确认',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-basis`,
      period,
      result: '待确认最终申报口径',
      sourceModule: '申报准备',
      status: '待确认',
      title: '申报口径',
      type: '申报口径确认',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-cashflow-risk`,
      period,
      result: '内部核对风险不阻断申报',
      sourceModule: '发票匹配',
      status: '无需确认',
      title: '内部核对风险',
      type: '内部核对风险',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-review-risk`,
      period,
      result: '资金复核提示不阻断申报',
      sourceModule: '流水复核',
      status: '无需确认',
      title: '资金复核提示',
      type: '资金复核提示',
      updatedAt: financeToday
    }
  ];
}

function createCorporateIncomeTaxItems(
  period: string,
  suffix: string,
  summary: FinanceCorporateIncomeTaxPreparationSummary,
  status: 'preparing' | 'completed' = 'preparing'
): FinanceDeclarationPreparationItem[] {
  const netAdjustmentAmount = roundMoney(summary.taxAdjustmentIncreaseAmount - summary.taxAdjustmentDecreaseAmount);
  const completed = status === 'completed';
  const adjustmentResult = `调增 ${formatDeclarationAmount(summary.taxAdjustmentIncreaseAmount)} / 调减 ${formatDeclarationAmount(summary.taxAdjustmentDecreaseAmount)}`;
  const eligibilityResult = summary.smallLowProfitEligible
    ? '符合小型微利候选口径'
    : '按普通企业口径';
  const prepaymentResult = `应纳税所得额 ${formatDeclarationAmount(summary.taxableIncomeAmount)}，预计预缴 ${formatDeclarationAmount(summary.estimatedCorporateIncomeTaxAmount)}`;

  return [
    {
      amount: summary.profitBeforeTaxAmount,
      id: `declaration-prep-item-${suffix}-profit`,
      period,
      result: `利润总额 ${formatDeclarationAmount(summary.profitBeforeTaxAmount)}，已从经营数据同步`,
      sourceModule: '经营数据',
      status: '无需确认',
      title: '利润总额来源',
      type: '利润数据确认',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: netAdjustmentAmount,
      id: `declaration-prep-item-${suffix}-adjustment`,
      period,
      result: completed ? `${adjustmentResult}，净调整 ${formatDeclarationAmount(netAdjustmentAmount)} 已确认` : `${adjustmentResult}，待确认`,
      sourceModule: '申报准备',
      status: completed ? '已确认' : '待确认',
      title: '纳税调整确认',
      type: '纳税调整确认',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-policy`,
      period,
      result: completed ? `${eligibilityResult}，已确认` : `${eligibilityResult}，待确认人数、资产和行业条件`,
      sourceModule: '税务口径',
      status: completed ? '已确认' : '待确认',
      title: '优惠资格确认',
      type: '优惠资格确认',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: summary.estimatedCorporateIncomeTaxAmount,
      id: `declaration-prep-item-${suffix}-basis`,
      period,
      result: completed ? `${prepaymentResult} 已确认` : `${prepaymentResult}，待完成前置确认`,
      sourceModule: '申报准备',
      status: completed ? '已确认' : '待确认',
      title: '预缴口径确认',
      type: '预缴口径确认',
      updatedAt: completed ? '2026-04-10' : financeToday
    }
  ];
}

const cit2026q2Summary: FinanceCorporateIncomeTaxPreparationSummary = {
  averageAssetAmount: 1260000,
  averageEmployeeCount: 5,
  estimatedCorporateIncomeTaxAmount: 0,
  effectiveTaxRate: activeCorporateIncomeTaxPolicy.smallLowProfitEffectiveTaxRate,
  industryRestrictionResult: '符合',
  operatingCostAmount: 126400,
  operatingRevenueAmount: 212600,
  payrollAndSocialInsuranceAmount: 17200,
  periodExpenseAmount: 48200,
  policyBasis: '',
  priorLossDeductionAmount: 5000,
  profitBeforeTaxAmount: 20800,
  smallLowProfitAssetLimit: activeCorporateIncomeTaxPolicy.smallLowProfitAssetLimit,
  smallLowProfitEligible: true,
  smallLowProfitEmployeeLimit: activeCorporateIncomeTaxPolicy.smallLowProfitEmployeeLimit,
  smallLowProfitTaxableIncomeLimit: activeCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeLimit,
  statutoryTaxRate: activeCorporateIncomeTaxPolicy.smallLowProfitStatutoryTaxRate,
  taxableIncomeAmount: 16300,
  taxableIncomeInclusionRate: activeCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeRatio,
  taxAdjustmentDecreaseAmount: 700,
  taxAdjustmentIncreaseAmount: 1200,
  taxRate: activeCorporateIncomeTaxPolicy.smallLowProfitEffectiveTaxRate
};

const cit2026q1Summary: FinanceCorporateIncomeTaxPreparationSummary = {
  averageAssetAmount: 1180000,
  averageEmployeeCount: 5,
  estimatedCorporateIncomeTaxAmount: 0,
  effectiveTaxRate: activeCorporateIncomeTaxPolicy.smallLowProfitEffectiveTaxRate,
  industryRestrictionResult: '符合',
  operatingCostAmount: 98000,
  operatingRevenueAmount: 156000,
  payrollAndSocialInsuranceAmount: 13800,
  periodExpenseAmount: 32200,
  policyBasis: '',
  priorLossDeductionAmount: 2000,
  profitBeforeTaxAmount: 12000,
  smallLowProfitAssetLimit: activeCorporateIncomeTaxPolicy.smallLowProfitAssetLimit,
  smallLowProfitEligible: true,
  smallLowProfitEmployeeLimit: activeCorporateIncomeTaxPolicy.smallLowProfitEmployeeLimit,
  smallLowProfitTaxableIncomeLimit: activeCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeLimit,
  statutoryTaxRate: activeCorporateIncomeTaxPolicy.smallLowProfitStatutoryTaxRate,
  taxableIncomeAmount: 10000,
  taxableIncomeInclusionRate: activeCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeRatio,
  taxAdjustmentDecreaseAmount: 0,
  taxAdjustmentIncreaseAmount: 0,
  taxRate: activeCorporateIncomeTaxPolicy.smallLowProfitEffectiveTaxRate
};

cit2026q2Summary.policyBasis = buildSmallLowProfitPolicyBasis(cit2026q2Summary);
cit2026q2Summary.estimatedCorporateIncomeTaxAmount = calculateCorporateIncomeTaxAmount(cit2026q2Summary);
cit2026q1Summary.policyBasis = buildSmallLowProfitPolicyBasis(cit2026q1Summary);
cit2026q1Summary.estimatedCorporateIncomeTaxAmount = calculateCorporateIncomeTaxAmount(cit2026q1Summary);

export const financeDeclarationPreparationRecords: FinanceDeclarationPreparationRecord[] = [
  {
    id: 'declaration-prep-2026q2-vat',
    operationRecords: [
      {
        id: 'declaration-prep-op-2026q2-vat-001',
        time: '2026-06-21 17:30',
        actor: '李明',
        object: 'PREP-2026Q2-VAT',
        action: '生成准备事项',
        summary: '按季度生成 2026-Q2 增值税及附加申报准备'
      }
    ],
    owner: '李明',
    period: '2026-Q2',
    periodType: '季度',
    preparationNo: 'PREP-2026Q2-VAT',
    status: '准备中',
    taxType: '增值税及附加',
    title: '2026-Q2 增值税及附加申报准备',
    updatedAt: '2026-06-21',
    vatSummary: emptyVatSummary,
    items: createVatItems('2026-Q2', '2026q2-vat')
  },
  {
    citSummary: cit2026q2Summary,
    id: 'declaration-prep-2026q2-cit',
    operationRecords: [
      {
        id: 'declaration-prep-op-2026q2-cit-001',
        time: '2026-06-21 18:10',
        actor: '李明',
        object: 'PREP-2026Q2-CIT',
        action: '生成准备事项',
        summary: '按季度生成 2026-Q2 企业所得税预缴准备'
      }
    ],
    owner: '李明',
    period: '2026-Q2',
    periodType: '季度',
    preparationNo: 'PREP-2026Q2-CIT',
    status: '准备中',
    taxType: '企业所得税',
    title: '2026-Q2 企业所得税预缴准备',
    updatedAt: '2026-06-21',
    vatSummary: emptyVatSummary,
    items: createCorporateIncomeTaxItems('2026-Q2', '2026q2-cit', cit2026q2Summary)
  },
  {
    confirmedSourceSnapshotKey: 'seed-confirmed-2026q1-vat',
    confirmedVatSummary: {
      ...emptyVatSummary,
      declaredNetSalesAmount: 45000,
      isBelowQuarterlyExemptionThreshold: true,
      outputBlueNetAmount: 45000,
      outputBlueTaxIncludedAmount: 45450
    },
    id: 'declaration-prep-2026q1-vat',
    operationRecords: [
      {
        id: 'declaration-prep-op-2026q1-vat-001',
        time: '2026-04-10 09:30',
        actor: '李明',
        object: 'PREP-2026Q1-VAT',
        action: '确认准备结果',
        summary: '确认 2026-Q1 增值税及附加申报准备，符合季度 30 万以下免税口径'
      },
      {
        id: 'declaration-prep-op-2026q1-vat-002',
        time: '2026-04-12 15:20',
        actor: '李明',
        object: 'PREP-2026Q1-VAT',
        action: '进入税务办理',
        summary: '已进入税务办理并完成回执归档'
      }
    ],
    owner: '李明',
    period: '2026-Q1',
    periodType: '季度',
    preparationNo: 'PREP-2026Q1-VAT',
    status: '已进入税务办理',
    taxType: '增值税及附加',
    title: '2026-Q1 增值税及附加申报准备',
    updatedAt: '2026-04-12',
    vatSummary: {
      ...emptyVatSummary,
      declaredNetSalesAmount: 45000,
      isBelowQuarterlyExemptionThreshold: true,
      outputBlueNetAmount: 45000,
      outputBlueTaxIncludedAmount: 45450
    },
    items: createVatItems('2026-Q1', '2026q1-vat').map((item) => ({
      ...item,
      amount: item.type === '销项发票核对' || item.type === '申报口径确认' ? 45000 : 0,
      result:
        item.type === '销项发票核对'
          ? '销项发票已确认'
          : item.type === '申报口径确认'
            ? '不含税申报销售额已确认'
            : item.type === '内部核对风险' || item.type === '资金复核提示'
              ? '无影响申报的内部风险'
              : '本期无需处理',
      status: item.type === '内部核对风险' || item.type === '资金复核提示' || item.type === '红票关联原蓝票' || item.type === '前期未开票后续开票' || item.type === '未开票收入确认'
        ? '无需确认'
        : '已确认',
      updatedAt: '2026-04-10'
    }))
  },
  {
    citSummary: cit2026q1Summary,
    confirmedCitSummary: cit2026q1Summary,
    confirmedSourceSnapshotKey: 'seed-confirmed-2026q1-cit',
    id: 'declaration-prep-2026q1-cit',
    operationRecords: [
      {
        id: 'declaration-prep-op-2026q1-cit-001',
        time: '2026-04-10 10:20',
        actor: '李明',
        object: 'PREP-2026Q1-CIT',
        action: '确认准备结果',
        summary: '确认 2026-Q1 企业所得税预缴准备结果'
      },
      {
        id: 'declaration-prep-op-2026q1-cit-002',
        time: '2026-04-12 16:05',
        actor: '李明',
        object: 'PREP-2026Q1-CIT',
        action: '进入税务办理',
        summary: '已进入税务办理并完成回执归档'
      }
    ],
    owner: '李明',
    period: '2026-Q1',
    periodType: '季度',
    preparationNo: 'PREP-2026Q1-CIT',
    status: '已进入税务办理',
    taxType: '企业所得税',
    title: '2026-Q1 企业所得税预缴准备',
    updatedAt: '2026-04-12',
    vatSummary: emptyVatSummary,
    items: createCorporateIncomeTaxItems('2026-Q1', '2026q1-cit', cit2026q1Summary, 'completed')
  }
];

export function getDeclarationPreparationProgress(record: FinanceDeclarationPreparationRecord) {
  const actionableItems = record.items.filter((item) => item.status !== '无需确认');
  const processedItems = actionableItems.filter((item) => item.status === '已确认');
  const pendingItems = actionableItems.filter((item) => item.status === '待确认');

  return {
    actionableCount: actionableItems.length,
    pendingAmount: pendingItems.reduce((total, item) => total + Math.abs(item.amount), 0),
    pendingCount: pendingItems.length,
    processedCount: processedItems.length,
    totalCount: record.items.length
  };
}

export function isDeclarationPreparationReady(record: FinanceDeclarationPreparationRecord) {
  const progress = getDeclarationPreparationProgress(record);

  return progress.actionableCount > 0 && progress.pendingCount === 0;
}

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

function formatDeclarationAmount(amount: number) {
  const roundedAmount = roundMoney(amount);

  return `${roundedAmount.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(roundedAmount) ? 0 : 2
  })} 元`;
}

function getPreparationMonthPeriods(period: string) {
  const quarterMatch = period.match(/^(\d{4})-Q([1-4])$/);

  if (!quarterMatch) {
    return [period];
  }

  const year = quarterMatch[1];
  const quarter = Number(quarterMatch[2]);
  const startMonth = (quarter - 1) * 3 + 1;

  return [startMonth, startMonth + 1, startMonth + 2].map((month) => `${year}-${String(month).padStart(2, '0')}`);
}

export function getDeclarationPreparationMonthPeriods(period: string) {
  return getPreparationMonthPeriods(period);
}

export const getDeclarationPreparationAccountingPeriod = getAccountingPeriodFromBusinessPeriod;

function getPreparationPeriodInvoices(record: FinanceDeclarationPreparationRecord, invoices: FinanceInvoiceRecord[]) {
  const periodSet = new Set(getPreparationMonthPeriods(record.period));

  return invoices.filter((invoice) => periodSet.has(invoice.accountingPeriod) && isInvoiceEffective(invoice));
}

function getPreparationPeriodFinanceRows(record: FinanceDeclarationPreparationRecord, financeRows: FinanceTransactionRecord[]) {
  const periodSet = new Set(getPreparationMonthPeriods(record.period));

  return financeRows.filter((financeRow) => periodSet.has(financeRow.accountingPeriod));
}

function sumMoney<T>(rows: T[], selector: (row: T) => number) {
  return roundMoney(rows.reduce((total, row) => total + selector(row), 0));
}

function getTaxExcludedAmountFromCashAmount(amount: number) {
  return getFinanceTaxExcludedAmountFromIncludedAmount(amount, activeVatDeclarationPolicy.unbilledIncomeTaxRate);
}

function getInvoicePendingAssociationRiskAmount(invoices: FinanceInvoiceRecord[]) {
  return sumMoney(
    invoices.filter((invoice) => invoice.invoiceStatus === '正常' && getInvoiceMatchStatus(invoice) !== '已匹配'),
    (invoice) => Math.max(0, invoice.taxIncludedAmount - invoice.matchedBusinessRefs.reduce((total, match) => total + match.amount, 0))
  );
}

export function getDeclarationPreparationUnbilledIncomeCandidates(
  record: FinanceDeclarationPreparationRecord,
  invoices: FinanceInvoiceRecord[],
  financeRows: FinanceTransactionRecord[]
): FinanceDeclarationUnbilledIncomeCandidate[] {
  const periodFinanceRows = getPreparationPeriodFinanceRows(record, financeRows);
  const selectedTransactionNos = new Set(record.unbilledIncomeTransactionNos ?? []);
  const deferredTransactionNos = new Set(record.deferredUnbilledIncomeTransactionNos ?? []);

  return periodFinanceRows
    .flatMap((financeRow): FinanceDeclarationUnbilledIncomeCandidate[] => {
      if (financeRow.status !== '已入账' || financeRow.direction !== '收入' || financeRow.counterpartyType !== '客户') {
        return [];
      }

      const invoiceAssociation = buildTransactionInvoiceAssociation(financeRow, invoices);

      if (invoiceAssociation.status !== '未关联') {
        return [];
      }

      const explicitStatus = financeRow.invoiceDeclarationStatus;

      if (
        !selectedTransactionNos.has(financeRow.transactionNo) &&
        !deferredTransactionNos.has(financeRow.transactionNo) &&
        (explicitStatus === '未开票已申报' ||
          explicitStatus === '本期暂不计入' ||
          explicitStatus === '后续开票待处理' ||
          explicitStatus === '后续开票已处理')
      ) {
        return [];
      }

      return [
        {
          invoiceDeclarationStatus: getFinanceTransactionInvoiceDeclarationStatus(financeRow, invoiceAssociation),
          netAmount: getTaxExcludedAmountFromCashAmount(financeRow.amount),
          record: financeRow
        }
      ];
    })
    .sort(
      (left, right) =>
        left.record.occurredAt.localeCompare(right.record.occurredAt) ||
        left.record.transactionNo.localeCompare(right.record.transactionNo)
    );
}

export function getDeclarationPreparationSubsequentInvoiceCandidates(
  record: FinanceDeclarationPreparationRecord,
  invoices: FinanceInvoiceRecord[],
  financeRows: FinanceTransactionRecord[]
): FinanceDeclarationSubsequentInvoiceCandidate[] {
  const periodInvoices = getPreparationPeriodInvoices(record, invoices).filter(
    (invoice) => invoice.direction === '销项' && invoice.invoiceStatus === '正常'
  );
  const financeRowByNo = new Map(financeRows.map((financeRow) => [financeRow.transactionNo, financeRow]));

  return periodInvoices
    .flatMap((invoice): FinanceDeclarationSubsequentInvoiceCandidate[] =>
      invoice.matchedBusinessRefs.flatMap((match) => {
        const financeRow = match.sourceModule === '未开票收入' ? financeRowByNo.get(match.sourceNo) : undefined;

        if (!financeRow || financeRow.invoiceDeclarationPreparationNo === record.preparationNo) {
          return [];
        }

        if (financeRow.invoiceDeclarationStatus !== '未开票已申报' && financeRow.invoiceDeclarationStatus !== '后续开票已处理') {
          return [];
        }

        const invoiceDeclarationStatus = getFinanceTransactionInvoiceDeclarationStatus(
          financeRow,
          buildTransactionInvoiceAssociation(financeRow, invoices)
        );

        if (invoiceDeclarationStatus !== '后续开票待处理' && invoiceDeclarationStatus !== '后续开票已处理') {
          return [];
        }

        return [
          {
            amount: match.amount,
            invoice,
            invoiceDeclarationStatus,
            netAmount: getTaxExcludedAmountFromCashAmount(match.amount),
            record: financeRow
          }
        ];
      })
    )
    .sort(
      (left, right) =>
        left.invoice.invoiceDate.localeCompare(right.invoice.invoiceDate) ||
        left.invoice.invoiceNo.localeCompare(right.invoice.invoiceNo)
    );
}

function isSameMoneyAmount(left: number, right: number) {
  return Math.abs(left - right) <= 0.01;
}

function buildDeclarationPreparationSourceSnapshotKey(
  record: FinanceDeclarationPreparationRecord,
  periodInvoices: FinanceInvoiceRecord[],
  periodFinanceRows: FinanceTransactionRecord[]
) {
  const invoiceSourceKey = periodInvoices
    .map((invoice) => {
      const matchKey = invoice.matchedBusinessRefs
        .map((match) => `${match.sourceModule}:${match.recordNo}:${match.sourceNo}:${match.amount}`)
        .sort()
        .join(',');

      return [
        invoice.id,
        invoice.invoiceNo,
        invoice.direction,
        invoice.invoiceStatus,
        invoice.invoiceKind,
        invoice.declarationTreatment,
        invoice.originalInvoiceId ?? '',
        invoice.taxIncludedAmount,
        invoice.taxExcludedAmount,
        invoice.accountingPeriod,
        matchKey
      ].join(':');
    })
    .sort()
    .join('|');
  const selectedUnbilledIncomeKey = (record.unbilledIncomeTransactionNos ?? []).slice().sort().join(',');
  const deferredUnbilledIncomeKey = (record.deferredUnbilledIncomeTransactionNos ?? []).slice().sort().join(',');
  const financeSourceKey = periodFinanceRows
    .map((financeRow) =>
      [
        financeRow.id,
        financeRow.transactionNo,
        financeRow.direction,
        financeRow.counterparty,
        financeRow.counterpartyType,
        financeRow.amount,
        financeRow.accountingPeriod,
        financeRow.status,
        financeRow.invoiceDeclarationStatus ?? '',
        financeRow.invoiceDeclarationPeriod ?? '',
        financeRow.invoiceDeclarationPreparationNo ?? ''
      ].join(':')
    )
    .sort()
    .join('|');

  return `${record.id}::${record.period}::${invoiceSourceKey}::${financeSourceKey}::${selectedUnbilledIncomeKey}::${deferredUnbilledIncomeKey}`;
}

function getPreparationItem(record: FinanceDeclarationPreparationRecord, type: FinanceDeclarationPreparationItemType) {
  return record.items.find((item) => item.type === type);
}

export function isDeclarationPreparationItemManuallyConfirmable(item: FinanceDeclarationPreparationItem) {
  return (
    item.type === '未开票收入确认' ||
    item.type === '前期未开票后续开票' ||
    item.type === '申报口径确认' ||
    item.type === '纳税调整确认' ||
    item.type === '优惠资格确认' ||
    item.type === '预缴口径确认'
  );
}

export function canConfirmDeclarationPreparationItem(record: FinanceDeclarationPreparationRecord, item: FinanceDeclarationPreparationItem) {
  if (record.status !== '准备中' || item.status !== '待确认' || !isDeclarationPreparationItemManuallyConfirmable(item)) {
    return false;
  }

  if (
    item.type === '未开票收入确认' ||
    item.type === '前期未开票后续开票' ||
    item.type === '纳税调整确认' ||
    item.type === '优惠资格确认'
  ) {
    return true;
  }

  return record.items.every((currentItem) => currentItem.id === item.id || currentItem.status !== '待确认');
}

export function applyDeclarationPreparationSourceState(
  records: FinanceDeclarationPreparationRecord[],
  invoices: FinanceInvoiceRecord[],
  financeRows: FinanceTransactionRecord[]
): FinanceDeclarationPreparationRecord[] {
  return records.map((record): FinanceDeclarationPreparationRecord => {
  if (record.taxType === '企业所得税') {
      const citSummary = record.confirmedCitSummary ?? record.citSummary ?? emptyCitSummary;
      const sourceSnapshotKey = [
        record.id,
        record.period,
        citSummary.operatingRevenueAmount,
        citSummary.profitBeforeTaxAmount,
        citSummary.taxableIncomeAmount,
        citSummary.taxAdjustmentIncreaseAmount,
        citSummary.taxAdjustmentDecreaseAmount,
        citSummary.priorLossDeductionAmount,
        citSummary.smallLowProfitEligible,
        citSummary.averageEmployeeCount,
        citSummary.averageAssetAmount,
        citSummary.industryRestrictionResult,
        citSummary.effectiveTaxRate,
        citSummary.estimatedCorporateIncomeTaxAmount
      ].join(':');

      return {
        ...record,
        citSummary,
        sourceSnapshotKey
      };
    }

    if (record.taxType !== '增值税及附加') {
      return record;
    }

    const periodInvoices = getPreparationPeriodInvoices(record, invoices);
    const periodFinanceRows = getPreparationPeriodFinanceRows(record, financeRows);
    const sourceSnapshotKey = buildDeclarationPreparationSourceSnapshotKey(record, periodInvoices, periodFinanceRows);
    const sourceChangedAfterConfirmation = Boolean(
      record.confirmedSourceSnapshotKey && record.confirmedSourceSnapshotKey !== sourceSnapshotKey
    );

    if (record.status !== '准备中' && !sourceChangedAfterConfirmation) {
      return {
        ...record,
        sourceSnapshotKey,
        vatSummary: record.confirmedVatSummary ?? record.vatSummary
      };
    }

    const outputBlueInvoices = periodInvoices.filter(
      (invoice) => invoice.direction === '销项' && invoice.invoiceStatus === '正常' && invoice.declarationTreatment === '本期申报'
    );
    const redInvoices = periodInvoices.filter((invoice) => invoice.direction === '销项' && invoice.invoiceStatus === '红冲');
    const unlinkedRedInvoices = redInvoices.filter((invoice) => getRedInvoiceOriginalAssociationStatus(invoice) === '待关联原票');
    const pendingInvoiceAssociationRiskAmount = getInvoicePendingAssociationRiskAmount(periodInvoices);
    const pendingReviewRows = periodFinanceRows.filter((financeRow) => financeRow.status !== '已入账' && isTransactionInvoiceAssociationRequired(financeRow));
    const unbilledIncomeCandidates = getDeclarationPreparationUnbilledIncomeCandidates(record, invoices, financeRows);
    const subsequentInvoiceCandidates = getDeclarationPreparationSubsequentInvoiceCandidates(record, invoices, financeRows);
    const selectedUnbilledTransactionNos = new Set(record.unbilledIncomeTransactionNos ?? []);
    const deferredUnbilledTransactionNos = new Set(record.deferredUnbilledIncomeTransactionNos ?? []);
    const selectedUnbilledIncomeRows = unbilledIncomeCandidates.filter((candidate) =>
      selectedUnbilledTransactionNos.has(candidate.record.transactionNo)
    );
    const deferredUnbilledIncomeRows = unbilledIncomeCandidates.filter((candidate) =>
      deferredUnbilledTransactionNos.has(candidate.record.transactionNo)
    );
    const pendingUnbilledIncomeRows = unbilledIncomeCandidates.filter(
      (candidate) =>
        !selectedUnbilledTransactionNos.has(candidate.record.transactionNo) &&
        !deferredUnbilledTransactionNos.has(candidate.record.transactionNo)
    );
    const pendingSubsequentInvoiceRows = subsequentInvoiceCandidates.filter(
      (candidate) => candidate.invoiceDeclarationStatus !== '后续开票已处理'
    );
    const confirmedSubsequentInvoiceRows = subsequentInvoiceCandidates.filter(
      (candidate) => candidate.invoiceDeclarationStatus === '后续开票已处理'
    );
    const outputBlueNetAmount = sumMoney(outputBlueInvoices, getInvoiceTaxExcludedAmount);
    const outputBlueTaxIncludedAmount = sumMoney(outputBlueInvoices, getInvoiceAmount);
    const redInvoiceNetAmount = sumMoney(redInvoices, getInvoiceTaxExcludedAmount);
    const selectedUnbilledNetAmount = sumMoney(selectedUnbilledIncomeRows, (candidate) => candidate.netAmount);
    const unbilledCandidateNetAmount = sumMoney(unbilledIncomeCandidates, (candidate) => candidate.netAmount);
    const subsequentInvoiceNetAmount = sumMoney(subsequentInvoiceCandidates, (candidate) => candidate.netAmount);
    const confirmedSubsequentInvoiceNetAmount = sumMoney(confirmedSubsequentInvoiceRows, (candidate) => candidate.netAmount);
    const unbilledIncomeItem = getPreparationItem(record, '未开票收入确认');
    const hasConfirmedUnbilledIncome =
      !sourceChangedAfterConfirmation &&
      unbilledIncomeItem?.status === '已确认' &&
      pendingUnbilledIncomeRows.length === 0 &&
      (selectedUnbilledIncomeRows.length > 0 || deferredUnbilledIncomeRows.length > 0);
    const hasPendingUnbilledIncome = pendingUnbilledIncomeRows.length > 0;
    const hasPendingSubsequentInvoice = pendingSubsequentInvoiceRows.length > 0;
    const declaredNetSalesAmount = roundMoney(outputBlueNetAmount + redInvoiceNetAmount + selectedUnbilledNetAmount - confirmedSubsequentInvoiceNetAmount);
    const estimatedVatBeforeExemption = roundMoney(Math.max(0, declaredNetSalesAmount) * VAT_EFFECTIVE_LEVY_RATE);
    const isBelowQuarterlyExemptionThreshold = declaredNetSalesAmount <= VAT_QUARTERLY_EXEMPTION_THRESHOLD;
    const estimatedVatAfterExemption = isBelowQuarterlyExemptionThreshold ? 0 : estimatedVatBeforeExemption;
    const estimatedSurcharge = roundMoney(estimatedVatAfterExemption * VAT_SURCHARGE_RATE);
    const estimatedTotalTaxAmount = roundMoney(estimatedVatAfterExemption + estimatedSurcharge);
    const hasSourcePendingItem =
      outputBlueInvoices.length === 0 ||
      unlinkedRedInvoices.length > 0 ||
      hasPendingSubsequentInvoice ||
      hasPendingUnbilledIncome;

    const items: FinanceDeclarationPreparationItem[] = record.items.map((item): FinanceDeclarationPreparationItem => {
      if (item.type === '销项发票核对') {
        return {
          ...item,
          amount: outputBlueNetAmount,
          result: outputBlueInvoices.length > 0 ? `${record.period} 销项蓝票已导入` : '本期未导入销项蓝票',
          status: outputBlueInvoices.length > 0 ? '已确认' : '待确认'
        };
      }

      if (item.type === '红票关联原蓝票') {
        if (redInvoices.length === 0) {
          return {
            ...item,
            amount: 0,
            result: '本期无红票',
            status: '无需确认'
          };
        }

        return {
          ...item,
          amount: redInvoiceNetAmount,
          result:
            unlinkedRedInvoices.length > 0
              ? `${unlinkedRedInvoices.length} 张红票待关联原蓝票`
              : '红票已关联原蓝票',
          status: unlinkedRedInvoices.length > 0 ? '待确认' : '已确认'
        };
      }

      if (item.type === '前期未开票后续开票') {
        if (subsequentInvoiceNetAmount <= 0.01) {
          return {
            ...item,
            amount: 0,
            result: '本期无前期未开票后续开票',
            status: '无需确认'
          };
        }

        return {
          ...item,
          amount: subsequentInvoiceNetAmount,
          result:
            pendingSubsequentInvoiceRows.length > 0
              ? `${pendingSubsequentInvoiceRows.length} 张后续开票待确认冲抵`
              : `${confirmedSubsequentInvoiceRows.length} 张后续开票已冲抵`,
          status: pendingSubsequentInvoiceRows.length > 0 ? '待确认' : '已确认'
        };
      }

      if (item.type === '未开票收入确认') {
        if (unbilledCandidateNetAmount <= 0.01) {
          return {
            ...item,
            amount: 0,
            result: '本期无已入账未开票收入',
            status: '无需确认'
          };
        }

        return {
          ...item,
          amount: hasConfirmedUnbilledIncome ? selectedUnbilledNetAmount : unbilledCandidateNetAmount,
          result:
            hasConfirmedUnbilledIncome
              ? `${selectedUnbilledIncomeRows.length} 条计入本期，${deferredUnbilledIncomeRows.length} 条本期暂不计入`
              : `${pendingUnbilledIncomeRows.length} 条已入账收入未关联发票，待确认是否计入本期`,
          status: hasConfirmedUnbilledIncome ? '已确认' : '待确认'
        };
      }

      if (item.type === '申报口径确认') {
        const hasConfirmedDeclarationBasis =
          !sourceChangedAfterConfirmation &&
          item.status === '已确认' &&
          isSameMoneyAmount(item.amount, declaredNetSalesAmount) &&
          !hasSourcePendingItem;

        return {
          ...item,
          amount: declaredNetSalesAmount,
          result: hasConfirmedDeclarationBasis
            ? '不含税申报销售额已确认'
            : hasSourcePendingItem
              ? '待完成必须处理项后再确认申报口径'
              : isBelowQuarterlyExemptionThreshold
                ? '符合季度 30 万以下免税口径，待确认'
                : '超过季度 30 万免税阈值，待确认',
          status: hasConfirmedDeclarationBasis ? '已确认' : '待确认'
        };
      }

      if (item.type === '内部核对风险') {
        return {
          ...item,
          amount: pendingInvoiceAssociationRiskAmount,
          result:
            pendingInvoiceAssociationRiskAmount > 0
              ? '存在发票和业务确认未完全关联，不阻断申报准备'
              : '发票与业务确认关联无明显风险',
          status: '无需确认'
        };
      }

      if (item.type === '资金复核提示') {
        return {
          ...item,
          amount: sumMoney(pendingReviewRows, (financeRow) => financeRow.amount),
          result: pendingReviewRows.length > 0 ? `${pendingReviewRows.length} 条相关流水待复核，不阻断申报准备` : '相关流水无复核提示',
          status: '无需确认'
        };
      }

      return item;
    });

    return {
      ...record,
      sourceSnapshotKey,
      status: sourceChangedAfterConfirmation ? '准备中' : record.status,
      vatSummary: {
        declaredNetSalesAmount,
        estimatedSurcharge,
        estimatedTotalTaxAmount,
        estimatedVatAfterExemption,
        estimatedVatBeforeExemption,
        isBelowQuarterlyExemptionThreshold,
        outputBlueNetAmount,
        outputBlueTaxIncludedAmount,
        priorUnbilledOffsetNetAmount: confirmedSubsequentInvoiceNetAmount,
        quarterlyExemptionThreshold: VAT_QUARTERLY_EXEMPTION_THRESHOLD,
        redInvoiceNetAmount,
        riskInvoiceCashflowAmount: pendingInvoiceAssociationRiskAmount,
        riskUnreviewedCashflowAmount: sumMoney(pendingReviewRows, (financeRow) => financeRow.amount),
        unbilledIncomeNetAmount: selectedUnbilledNetAmount
      },
      items
    };
  });
}

export function buildConfirmedDeclarationPreparationItem(item: FinanceDeclarationPreparationItem): FinanceDeclarationPreparationItem {
  const resultMap: Record<FinanceDeclarationPreparationItemType, string> = {
    销项发票核对: '销项发票已确认',
    红票关联原蓝票: '红票原蓝票关联已确认',
    前期未开票后续开票: '前期未开票后续开票已冲抵',
    未开票收入确认: '未开票收入申报口径已确认',
    申报口径确认: '不含税申报销售额已确认',
    内部核对风险: '内部核对风险已记录',
    资金复核提示: '资金复核提示已记录',
    利润数据确认: '利润总额来源已同步',
    纳税调整确认: `纳税调整净额 ${formatDeclarationAmount(item.amount)} 已确认`,
    优惠资格确认: '优惠资格条件已确认',
    预缴口径确认: `本季预计预缴 ${formatDeclarationAmount(item.amount)} 已确认`
  };

  return {
    ...item,
    result: resultMap[item.type],
    status: '已确认',
    updatedAt: financeToday
  };
}
