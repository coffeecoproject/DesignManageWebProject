import type { StatusTagTone } from '../../components/Detail';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { AccountingPeriodLockRecord } from './financeAccountingVoucherModel';
import type { SalaryPaymentRecord } from '../salary/salaryDomain';
import {
  customerContractRecords,
  customerRecords,
  type CustomerContractRecord,
  type CustomerRecord
} from '../customers/customerData';
import type { FinanceCorporateIncomeTaxAccountingSource } from './financeCorporateIncomeTaxModel';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceInvoiceBusinessAllocation, FinanceInvoiceRecord } from './financeInvoiceData';
import {
  getInvoiceAmount,
  getInvoiceMatchedAmount,
  getInvoiceMatchStatus,
  getInvoiceTaxExcludedAmount,
  getRedInvoiceOriginalAssociationStatus,
  isInvoiceEffective,
  isTransactionInvoiceAssociationRequired
} from './financeInvoiceModel';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  buildNaturalPersonPaymentFacts,
  getUnrepresentedPostedNaturalPersonPayments
} from './financeNaturalPersonPaymentModel';
import type { FinanceTaxMatterRecord } from './financeTaxFilingData';
import {
  buildPayrollIitDeclarationEmployeeRows,
  buildPayrollIitDeclarationSourceSnapshotKey,
  buildPayrollIitDeclarationSummary,
  type PayrollIitDeclarationEmployeeRow,
  type PayrollIitDeclarationSummary
} from './financePayrollIitDeclarationModel';
import { isFinanceTaxBasisResolved, resolveFinanceAccrualTaxBasis } from './financeTaxBasisModel';
import {
  getActiveFinanceTaxPolicyProfile,
  getFinanceVatDeclarationOutcome,
  getFinanceVatExemptionThreshold,
  getFinanceVatOutcomeRate,
  getFinanceVatSurchargeSummary,
  parseFinanceTaxRate,
  resolveFinanceVatInvoiceTreatment,
  type FinanceVatInvoiceTreatment,
  type FinanceVatDeclarationOutcome,
  type FinanceVatFilingCycle,
  type FinanceVatSalesCategory
} from './financeTaxPolicyModel';
import {
  financeToday,
  getAccountingPeriodFromBusinessPeriod
} from './financeUtils';
import type { getFinanceTransactionInvoiceDeclarationStatus } from './financeUtils';
import {
  buildContractStampDutySource,
  buildManualDocumentStampDutySource,
  buildStampDutySettlementEvent,
  buildStampDutyPreparationSummary,
  buildStampDutySourceSnapshotKey,
  applyStampDutySourceResolutions,
  type FinanceStampDutyPreparationSummary,
  type FinanceStampDutySourceRecord,
  type FinanceStampDutySourceResolution
} from './financeStampDutyModel';

export type FinanceDeclarationPreparationTaxType = '个人所得税' | '增值税及附加' | '企业所得税' | '印花税';
export type FinanceDeclarationScenario = '月度扣缴' | '季度申报' | '季度预缴' | '年度申报' | '年度汇算' | '按次申报';
export type FinanceDeclarationPreparationStatus = '准备中' | '可申报' | '已进入税务办理';
export type FinanceDeclarationPreparationItemStatus = '待确认' | '已确认' | '无需确认';
export type FinanceDeclarationPreparationItemType =
  | '销项发票核对'
  | '红票关联原蓝票'
  | '前期未开票后续开票'
  | '未开票收入核对'
  | '申报测算'
  | '利润数据同步'
  | '纳税调整测算'
  | '季度亏损核对'
  | '所得税抵免核对'
  | '优惠资格判定'
  | '季度账务完整性检查'
  | '历史申报连续性检查'
  | '预缴测算'
  | '年度结账检查'
  | '年度报表检查'
  | '第四季度预缴检查'
  | '年度纳税调整'
  | '以前年度亏损核对'
  | '年度汇算测算'
  | '薪酬数据核对'
  | '印花税税源核对'
  | '印花税申报口径确认';

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
  displayValue?: string;
  id: string;
  name: string;
  result: string;
  sourceModule: string;
  sourcePeriod: string;
  status: FinanceCorporateIncomeTaxSourceStatus;
  unit?: string;
  value: number;
  valueKind: 'amount' | 'count';
};

export type FinanceVatPreparationSummary = {
  appliedTaxRate: string;
  declaredNetSalesAmount: number;
  exemptionEligibleSalesAmount: number;
  exemptSalesAmount: number;
  estimatedSurcharge: number;
  estimatedTotalTaxAmount: number;
  estimatedVatAfterExemption: number;
  estimatedVatBeforeExemption: number;
  filingCycle: FinanceVatFilingCycle;
  goodsLaborSalesAmount: number;
  isBelowExemptionThreshold: boolean;
  legalRateSalesAmount: number;
  nonTaxableSalesAmount: number;
  outputBlueNetAmount: number;
  outputBlueTaxIncludedAmount: number;
  otherInvoiceAndUnbilledSalesAmount: number;
  priorUnbilledOffsetNetAmount: number;
  exemptionThreshold: number;
  redInvoiceNetAmount: number;
  riskInvoiceCashflowAmount: number;
  riskUnreviewedCashflowAmount: number;
  reducedRateSalesAmount: number;
  specialInvoiceSalesAmount: number;
  serviceSalesAmount: number;
  sourceRecognizedVatAmount: number;
  surchargeBreakdown: ReturnType<typeof getFinanceVatSurchargeSummary>;
  taxOutcome: FinanceVatDeclarationOutcome;
  taxOutcomeReason?: string;
  taxableSalesAmount: number;
  unbilledIncomeNetAmount: number;
};

export type FinanceCorporateIncomeTaxPreparationSummary = {
  accountingSourceReady: boolean;
  averageAssetAmount: number;
  averageEmployeeCount: number;
  coveredAccountingPeriods: string[];
  cumulativeIncomeTaxPayableAmount: number;
  cumulativeOperatingCostAmount: number;
  cumulativeOperatingRevenueAmount: number;
  cumulativeOtherIncomeAmount: number;
  cumulativePayrollAndSocialInsuranceAmount: number;
  cumulativeProfitBeforeTaxAmount: number;
  cumulativeSalesExpenseAmount: number;
  cumulativeTaxableIncomeAmount: number;
  currentPeriodPayableAmount: number;
  effectiveTaxRate: number;
  incomeTaxReliefAmount: number;
  industryRestrictionResult: '符合' | '不符合' | '待确认';
  missingPriorQuarterPeriods: string[];
  overpaidTaxAmount: number;
  policyBasis: string;
  priorLossDeductionAmount: number;
  priorQuarterFilingReady: boolean;
  reportingBasis: '本年累计';
  smallLowProfitAssetLimit: number;
  smallLowProfitEligible: boolean;
  smallLowProfitEmployeeLimit: number;
  smallLowProfitTaxableIncomeLimit: number;
  statutoryTaxRate: number;
  statutoryIncomeTaxAmount: number;
  taxAdjustmentDecreaseAmount: number;
  taxAdjustmentIncreaseAmount: number;
  taxCreditAmount: number;
  taxPaidYearToDateAmount: number;
  taxYear: string;
  unbookedVoucherCount: number;
  unclosedAccountingPeriods: string[];
};

export type FinanceCorporateIncomeTaxAdjustment = {
  accountingAmount: number;
  adjustmentAmount: number;
  deductibleAmount: number;
  direction: '调增' | '调减';
  id: string;
  item: string;
  sourceModule: string;
  sourceNo: string;
  status: '已归集' | '待归集';
};

export type FinanceCorporateIncomeTaxAnnualSourceReview = {
  adjustments: FinanceCorporateIncomeTaxAdjustment[];
  adjustmentReviewCompleted: boolean;
  priorLossDeductionAmount: number;
  priorLossReviewCompleted: boolean;
  priorLossSourceNo?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type FinanceCorporateIncomeTaxQuarterSourceReview = {
  adjustments: FinanceCorporateIncomeTaxAdjustment[];
  adjustmentReviewCompleted: boolean;
  priorLossDeductionAmount: number;
  priorLossReviewCompleted: boolean;
  priorLossSourceNo?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  taxCreditAmount: number;
  taxCreditReviewCompleted: boolean;
  taxCreditSourceNo?: string;
};

export type FinanceCorporateIncomeTaxAnnualSettlement = {
  adjustments: FinanceCorporateIncomeTaxAdjustment[];
  adjustmentSourceReady: boolean;
  annualFinancialStatementsReady: boolean;
  priorLossSourceReady: boolean;
  q4PrepaymentReady: boolean;
  readyForConfirmation: boolean;
  yearEndClosed: boolean;
};

export type FinancePayrollIitCorrectionSnapshot = {
  createdAt: string;
  employeeRows: PayrollIitDeclarationEmployeeRow[];
  reason: string;
  sourceSnapshotKey: string;
  sourceTransactionNos: string[];
  summary: PayrollIitDeclarationSummary;
};

export type FinanceDeclarationPreparationRecord = {
  confirmedSourceSnapshotKey?: string;
  confirmedCitSummary?: FinanceCorporateIncomeTaxPreparationSummary;
  confirmedCitAnnualSettlement?: FinanceCorporateIncomeTaxAnnualSettlement;
  confirmedCitAnnualSourceReview?: FinanceCorporateIncomeTaxAnnualSourceReview;
  confirmedCitQuarterSourceReview?: FinanceCorporateIncomeTaxQuarterSourceReview;
  confirmedIitEmployeeRows?: PayrollIitDeclarationEmployeeRow[];
  confirmedIitSummary?: PayrollIitDeclarationSummary;
  confirmedUnbilledIncomeDeclarations?: FinanceDeclaredUnbilledIncomeFact[];
  confirmedVatSummary?: FinanceVatPreparationSummary;
  confirmedStampDutySources?: FinanceStampDutySourceRecord[];
  confirmedStampDutySummary?: FinanceStampDutyPreparationSummary;
  id: string;
  declarationScenario: FinanceDeclarationScenario;
  items: FinanceDeclarationPreparationItem[];
  operationRecords: OperationRecord[];
  owner: string;
  pendingIitCorrection?: FinancePayrollIitCorrectionSnapshot;
  period: string;
  periodType: '月度' | '季度' | '年度' | '按次';
  preparationNo: string;
  sourceSnapshotKey?: string;
  status: FinanceDeclarationPreparationStatus;
  stampDutySources?: FinanceStampDutySourceRecord[];
  stampDutySummary?: FinanceStampDutyPreparationSummary;
  taxType: FinanceDeclarationPreparationTaxType;
  title: string;
  citSummary?: FinanceCorporateIncomeTaxPreparationSummary;
  citAnnualSettlement?: FinanceCorporateIncomeTaxAnnualSettlement;
  citAnnualSourceReview?: FinanceCorporateIncomeTaxAnnualSourceReview;
  citQuarterSourceReview?: FinanceCorporateIncomeTaxQuarterSourceReview;
  iitEmployeeRows?: PayrollIitDeclarationEmployeeRow[];
  iitSummary?: PayrollIitDeclarationSummary;
  unbilledIncomeDeclarations?: FinanceDeclaredUnbilledIncomeFact[];
  unbilledIncomeBusinessRecordIds?: string[];
  unbilledIncomeExclusions?: FinanceUnbilledIncomeExclusion[];
  updatedAt: string;
  vatSummary: FinanceVatPreparationSummary;
};

export type FinanceDeclaredUnbilledIncomeFact = {
  businessRecordId: string;
  netAmount: number;
  salesCategory: FinanceVatSalesCategory;
  vatTreatment: FinanceVatInvoiceTreatment;
};

export function finalizeDeclarationPreparationAfterFiling(
  preparation: FinanceDeclarationPreparationRecord,
  taxMatter: Pick<FinanceTaxMatterRecord, 'declarationStatus' | 'declarationVersion' | 'matterNo'>,
  actor: string,
  operatedAt: string
): FinanceDeclarationPreparationRecord {
  if (
    !['申报成功', '零申报'].includes(taxMatter.declarationStatus) ||
    preparation.status === '已进入税务办理'
  ) {
    return preparation;
  }

  return {
    ...preparation,
    confirmedCitSummary: preparation.confirmedCitSummary ?? preparation.citSummary,
    confirmedCitAnnualSettlement: preparation.confirmedCitAnnualSettlement ?? preparation.citAnnualSettlement,
    confirmedCitAnnualSourceReview: preparation.confirmedCitAnnualSourceReview ?? preparation.citAnnualSourceReview,
    confirmedIitEmployeeRows: preparation.confirmedIitEmployeeRows ?? preparation.iitEmployeeRows,
    confirmedIitSummary: preparation.confirmedIitSummary ?? preparation.iitSummary,
    confirmedSourceSnapshotKey: preparation.confirmedSourceSnapshotKey ?? preparation.sourceSnapshotKey,
    confirmedStampDutySources: preparation.confirmedStampDutySources ?? preparation.stampDutySources,
    confirmedStampDutySummary: preparation.confirmedStampDutySummary ?? preparation.stampDutySummary,
    confirmedUnbilledIncomeDeclarations:
      preparation.confirmedUnbilledIncomeDeclarations ?? preparation.unbilledIncomeDeclarations,
    confirmedVatSummary: preparation.confirmedVatSummary ?? preparation.vatSummary,
    operationRecords: [
      {
        action: '进入税务办理',
        actor,
        id: `declaration-prep-op-filed-${preparation.id}-v${taxMatter.declarationVersion}`,
        object: preparation.preparationNo,
        summary: `${taxMatter.matterNo} 已登记${taxMatter.declarationStatus}`,
        time: operatedAt
      },
      ...preparation.operationRecords
    ],
    status: '已进入税务办理',
    updatedAt: operatedAt.slice(0, 10)
  };
}

export const financeUnbilledIncomeExclusionReasons = [
  '尚未发生纳税义务',
  '已开票',
  '已在前期申报',
  '重复事项',
  '不征税事项'
] as const;

export type FinanceUnbilledIncomeExclusionReason = typeof financeUnbilledIncomeExclusionReasons[number];

export type FinanceUnbilledIncomeExclusion = {
  businessRecordId: string;
  excludedAt: string;
  excludedBy: string;
  reason?: FinanceUnbilledIncomeExclusionReason;
};

export type FinanceUnbilledIncomeCandidateStatus = '系统纳入' | '待核实' | '排除待说明' | '已排除';

export type FinanceDeclarationUnbilledIncomeCandidate = {
  businessRecord: FinanceReceivablePayableRecord;
  exclusion?: FinanceUnbilledIncomeExclusion;
  includedInDeclaration: boolean;
  obligationBasis: string;
  obligationDate: string;
  netAmount: number;
  selectedForInclusion: boolean;
  status: FinanceUnbilledIncomeCandidateStatus;
  taxAmount: number;
  taxBasisResolved: boolean;
  taxIncludedAmount: number;
};

export type FinanceDeclarationSubsequentInvoiceCandidate = {
  amount: number;
  businessRecord: FinanceReceivablePayableRecord;
  invoice: FinanceInvoiceRecord;
  invoiceDeclarationStatus: ReturnType<typeof getFinanceTransactionInvoiceDeclarationStatus>;
  netAmount: number;
  priorVatTreatment?: FinanceVatInvoiceTreatment;
};

// Seed summaries use the current mock period only. All declaration calculations
// resolve a profile from the record's accounting period below.
const defaultTaxPolicyProfile = getActiveFinanceTaxPolicyProfile();
const defaultVatDeclarationPolicy = defaultTaxPolicyProfile.vatDeclaration;
const defaultCorporateIncomeTaxPolicy = defaultTaxPolicyProfile.corporateIncomeTax;
const defaultVatExemptionThreshold = getFinanceVatExemptionThreshold(defaultVatDeclarationPolicy);

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
  appliedTaxRate: '-',
  declaredNetSalesAmount: 0,
  exemptionEligibleSalesAmount: 0,
  exemptSalesAmount: 0,
  estimatedSurcharge: 0,
  estimatedTotalTaxAmount: 0,
  estimatedVatAfterExemption: 0,
  estimatedVatBeforeExemption: 0,
  filingCycle: defaultVatDeclarationPolicy.filingCycle,
  goodsLaborSalesAmount: 0,
  isBelowExemptionThreshold: true,
  legalRateSalesAmount: 0,
  nonTaxableSalesAmount: 0,
  outputBlueNetAmount: 0,
  outputBlueTaxIncludedAmount: 0,
  otherInvoiceAndUnbilledSalesAmount: 0,
  priorUnbilledOffsetNetAmount: 0,
  exemptionThreshold: defaultVatExemptionThreshold,
  redInvoiceNetAmount: 0,
  riskInvoiceCashflowAmount: 0,
  riskUnreviewedCashflowAmount: 0,
  reducedRateSalesAmount: 0,
  specialInvoiceSalesAmount: 0,
  serviceSalesAmount: 0,
  sourceRecognizedVatAmount: 0,
  surchargeBreakdown: getFinanceVatSurchargeSummary({ accountingPeriod: '2026-06', vatPayableAmount: 0 }),
  taxOutcome: '待申报判定',
  taxableSalesAmount: 0,
  unbilledIncomeNetAmount: 0
};

const emptyCitSummary: FinanceCorporateIncomeTaxPreparationSummary = {
  accountingSourceReady: false,
  averageAssetAmount: 0,
  averageEmployeeCount: 0,
  coveredAccountingPeriods: [],
  cumulativeIncomeTaxPayableAmount: 0,
  cumulativeOperatingCostAmount: 0,
  cumulativeOperatingRevenueAmount: 0,
  cumulativeOtherIncomeAmount: 0,
  cumulativePayrollAndSocialInsuranceAmount: 0,
  cumulativeProfitBeforeTaxAmount: 0,
  cumulativeSalesExpenseAmount: 0,
  cumulativeTaxableIncomeAmount: 0,
  currentPeriodPayableAmount: 0,
  effectiveTaxRate: defaultCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate,
  incomeTaxReliefAmount: 0,
  industryRestrictionResult: '待确认',
  missingPriorQuarterPeriods: [],
  overpaidTaxAmount: 0,
  policyBasis: '普通企业预缴口径',
  priorLossDeductionAmount: 0,
  priorQuarterFilingReady: false,
  reportingBasis: '本年累计',
  smallLowProfitAssetLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitAssetLimit,
  smallLowProfitEligible: false,
  smallLowProfitEmployeeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitEmployeeLimit,
  smallLowProfitTaxableIncomeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeLimit,
  statutoryTaxRate: defaultCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate,
  statutoryIncomeTaxAmount: 0,
  taxAdjustmentDecreaseAmount: 0,
  taxAdjustmentIncreaseAmount: 0,
  taxCreditAmount: 0,
  taxPaidYearToDateAmount: 0,
  taxYear: financeToday.slice(0, 4),
  unbookedVoucherCount: 0,
  unclosedAccountingPeriods: []
};

type FinanceCorporateIncomeTaxPreparationInput = Omit<
  FinanceCorporateIncomeTaxPreparationSummary,
  | 'cumulativeIncomeTaxPayableAmount'
  | 'cumulativeTaxableIncomeAmount'
  | 'currentPeriodPayableAmount'
  | 'effectiveTaxRate'
  | 'incomeTaxReliefAmount'
  | 'overpaidTaxAmount'
  | 'policyBasis'
  | 'smallLowProfitEligible'
  | 'statutoryIncomeTaxAmount'
>;

function calculateCorporateIncomeTaxSummary(
  input: FinanceCorporateIncomeTaxPreparationInput
): FinanceCorporateIncomeTaxPreparationSummary {
  const cumulativeTaxableIncomeAmount = roundMoney(Math.max(
    0,
    input.cumulativeProfitBeforeTaxAmount +
      input.taxAdjustmentIncreaseAmount -
      input.taxAdjustmentDecreaseAmount -
      input.priorLossDeductionAmount
  ));
  const smallLowProfitEligible =
    input.industryRestrictionResult === '符合' &&
    cumulativeTaxableIncomeAmount <= input.smallLowProfitTaxableIncomeLimit &&
    input.averageEmployeeCount <= input.smallLowProfitEmployeeLimit &&
    input.averageAssetAmount <= input.smallLowProfitAssetLimit;
  const effectiveTaxRate = smallLowProfitEligible
    ? defaultCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeRatio *
      defaultCorporateIncomeTaxPolicy.smallLowProfitPreferentialTaxRate
    : input.statutoryTaxRate;
  const statutoryIncomeTaxAmount = roundMoney(cumulativeTaxableIncomeAmount * input.statutoryTaxRate);
  const incomeTaxAfterReliefAmount = roundMoney(cumulativeTaxableIncomeAmount * effectiveTaxRate);
  const incomeTaxReliefAmount = roundMoney(Math.max(0, statutoryIncomeTaxAmount - incomeTaxAfterReliefAmount));
  const cumulativeIncomeTaxPayableAmount = roundMoney(Math.max(0, incomeTaxAfterReliefAmount - input.taxCreditAmount));
  const currentPeriodDifference = roundMoney(cumulativeIncomeTaxPayableAmount - input.taxPaidYearToDateAmount);
  const summary = {
    ...input,
    cumulativeIncomeTaxPayableAmount,
    cumulativeTaxableIncomeAmount,
    currentPeriodPayableAmount: Math.max(0, currentPeriodDifference),
    effectiveTaxRate,
    incomeTaxReliefAmount,
    overpaidTaxAmount: Math.max(0, -currentPeriodDifference),
    policyBasis: '',
    smallLowProfitEligible,
    statutoryIncomeTaxAmount
  } satisfies FinanceCorporateIncomeTaxPreparationSummary;

  return {
    ...summary,
    policyBasis: buildSmallLowProfitPolicyBasis(summary)
  };
}

export function recalculateCorporateIncomeTaxSummary(
  summary: FinanceCorporateIncomeTaxPreparationSummary,
  taxPaidYearToDateAmount: number
) {
  return calculateCorporateIncomeTaxSummary({
    accountingSourceReady: summary.accountingSourceReady,
    averageAssetAmount: summary.averageAssetAmount,
    averageEmployeeCount: summary.averageEmployeeCount,
    coveredAccountingPeriods: summary.coveredAccountingPeriods,
    cumulativeOperatingCostAmount: summary.cumulativeOperatingCostAmount,
    cumulativeOperatingRevenueAmount: summary.cumulativeOperatingRevenueAmount,
    cumulativeOtherIncomeAmount: summary.cumulativeOtherIncomeAmount,
    cumulativePayrollAndSocialInsuranceAmount: summary.cumulativePayrollAndSocialInsuranceAmount,
    cumulativeProfitBeforeTaxAmount: summary.cumulativeProfitBeforeTaxAmount,
    cumulativeSalesExpenseAmount: summary.cumulativeSalesExpenseAmount,
    industryRestrictionResult: summary.industryRestrictionResult,
    missingPriorQuarterPeriods: summary.missingPriorQuarterPeriods,
    priorLossDeductionAmount: summary.priorLossDeductionAmount,
    priorQuarterFilingReady: summary.priorQuarterFilingReady,
    reportingBasis: summary.reportingBasis,
    smallLowProfitAssetLimit: summary.smallLowProfitAssetLimit,
    smallLowProfitEmployeeLimit: summary.smallLowProfitEmployeeLimit,
    smallLowProfitTaxableIncomeLimit: summary.smallLowProfitTaxableIncomeLimit,
    statutoryTaxRate: summary.statutoryTaxRate,
    taxAdjustmentDecreaseAmount: summary.taxAdjustmentDecreaseAmount,
    taxAdjustmentIncreaseAmount: summary.taxAdjustmentIncreaseAmount,
    taxCreditAmount: summary.taxCreditAmount,
    taxPaidYearToDateAmount,
    taxYear: summary.taxYear,
    unbookedVoucherCount: summary.unbookedVoucherCount,
    unclosedAccountingPeriods: summary.unclosedAccountingPeriods
  });
}

function getCorporateIncomeTaxPaidYearToDate(
  record: FinanceDeclarationPreparationRecord,
  taxMatterRows: FinanceTaxMatterRecord[],
  fallbackAmount: number
) {
  if (taxMatterRows.length === 0) {
    return fallbackAmount;
  }

  return roundMoney(
    taxMatterRows
      .filter(
        (matter) =>
          matter.matterType === '企业所得税' &&
          matter.period.startsWith(`${record.period.slice(0, 4)}-Q`) &&
          (record.declarationScenario === '年度汇算' || matter.period < record.period) &&
          matter.processStatus === '已完成' &&
          matter.paymentStatus === '已缴纳'
      )
      .reduce((total, matter) => total + matter.paidAmount, 0)
  );
}

function getCorporateIncomeTaxPriorQuarterPeriods(period: string) {
  const match = period.match(/^(\d{4})-Q([1-4])$/);

  if (!match) {
    return [];
  }

  return Array.from(
    { length: Math.max(0, Number(match[2]) - 1) },
    (_, index) => `${match[1]}-Q${index + 1}`
  );
}

function getMissingCorporateIncomeTaxPriorQuarterPeriods(
  period: string,
  taxMatterRows: FinanceTaxMatterRecord[]
) {
  return getCorporateIncomeTaxPriorQuarterPeriods(period).filter((priorPeriod) =>
    !taxMatterRows.some((matter) =>
      matter.matterType === '企业所得税' &&
      matter.period === priorPeriod &&
      matter.declarationScenario === '季度预缴' &&
      ['申报成功', '零申报'].includes(matter.declarationStatus)
    )
  );
}

function isCorporateIncomeTaxQuarterAdjustmentReady(review?: FinanceCorporateIncomeTaxQuarterSourceReview) {
  return Boolean(
    review?.adjustmentReviewCompleted &&
      review.adjustments.every(
        (adjustment) =>
          adjustment.status === '已归集' &&
          adjustment.item.trim() &&
          adjustment.sourceModule.trim() &&
          adjustment.sourceNo.trim() &&
          adjustment.adjustmentAmount > 0
      )
  );
}

function isCorporateIncomeTaxQuarterPriorLossReady(review?: FinanceCorporateIncomeTaxQuarterSourceReview) {
  return Boolean(
    review?.priorLossReviewCompleted &&
      (review.priorLossDeductionAmount === 0 || Boolean(review.priorLossSourceNo?.trim()))
  );
}

function isCorporateIncomeTaxQuarterTaxCreditReady(review?: FinanceCorporateIncomeTaxQuarterSourceReview) {
  return Boolean(
    review?.taxCreditReviewCompleted &&
      (review.taxCreditAmount === 0 || Boolean(review.taxCreditSourceNo?.trim()))
  );
}

function buildSmallLowProfitPolicyBasis(summary: Pick<
  FinanceCorporateIncomeTaxPreparationSummary,
  'effectiveTaxRate' | 'industryRestrictionResult' | 'smallLowProfitEligible'
>) {
  if (!summary.smallLowProfitEligible) {
    return summary.industryRestrictionResult === '待确认' ? '小型微利资格待确认' : '普通企业预缴口径';
  }

  return `按小型微利企业口径预估，当前有效预缴率 ${(summary.effectiveTaxRate * 100).toFixed(0)}%`;
}

function getCorporateIncomeTaxItemSourceStatus(
  record: FinanceDeclarationPreparationRecord,
  type: FinanceDeclarationPreparationItemType
): FinanceCorporateIncomeTaxSourceStatus {
  if (record.items.find((item) => item.type === type)?.status === '待确认') {
    return '待确认';
  }

  return record.status === '准备中' ? '已同步' : '已确认';
}

function getCorporateIncomeTaxCumulativePeriod(period: string) {
  const match = period.match(/^(\d{4})-Q([1-4])$/);

  if (!match) {
    return /^\d{4}$/.test(period) ? `${period}-01 至 ${period}-12` : period;
  }

  return `${match[1]}-01 至 ${match[1]}-${String(Number(match[2]) * 3).padStart(2, '0')}`;
}

export function buildCorporateIncomeTaxSourceRows(record: FinanceDeclarationPreparationRecord): FinanceCorporateIncomeTaxSourceRow[] {
  if (record.taxType !== '企业所得税') {
    return [];
  }

  const summary = record.citSummary ?? emptyCitSummary;
  const cumulativePeriod = getCorporateIncomeTaxCumulativePeriod(record.period);
  const accountingSourcePeriod = summary.coveredAccountingPeriods.length > 0
    ? `${summary.coveredAccountingPeriods[0]} 至 ${summary.coveredAccountingPeriods[summary.coveredAccountingPeriods.length - 1]}`
    : record.period;
  const isAnnualSettlement = record.declarationScenario === '年度汇算';
  const annualSettlement = record.citAnnualSettlement;

  return [
    {
      displayValue: summary.unbookedVoucherCount > 0 ? `${summary.unbookedVoucherCount} 张待记账` : '无待记账',
      id: `${record.id}-cit-source-accounting-readiness`,
      name: isAnnualSettlement ? '年度账务完整性' : '季度账务完整性',
      result: summary.accountingSourceReady
        ? `${summary.coveredAccountingPeriods.join('、')} 已结账`
        : [
            summary.unclosedAccountingPeriods.length > 0
              ? `未结账 ${summary.unclosedAccountingPeriods.join('、')}`
              : '',
            summary.unbookedVoucherCount > 0 ? `${summary.unbookedVoucherCount} 张凭证待记账` : ''
          ].filter(Boolean).join(' / '),
      sourceModule: '期间结账',
      sourcePeriod: accountingSourcePeriod,
      status: summary.accountingSourceReady ? '已同步' : '待确认',
      unit: '张',
      value: summary.unbookedVoucherCount,
      valueKind: 'count'
    },
    {
      displayValue: isAnnualSettlement
        ? annualSettlement?.q4PrepaymentReady ? '已完成' : '待完成'
        : summary.missingPriorQuarterPeriods.length > 0
          ? `${summary.missingPriorQuarterPeriods.length} 个季度缺失`
          : '申报连续',
      id: `${record.id}-cit-source-prior-filing`,
      name: isAnnualSettlement ? '第四季度预缴' : '以前季度申报',
      result: isAnnualSettlement
        ? annualSettlement?.q4PrepaymentReady ? '第四季度预缴已完成' : '第四季度预缴尚未完成'
        : summary.priorQuarterFilingReady
          ? '以前季度申报记录连续'
          : `缺少 ${summary.missingPriorQuarterPeriods.join('、')} 申报结果`,
      sourceModule: '税务办理',
      sourcePeriod: summary.taxYear,
      status: isAnnualSettlement
        ? annualSettlement?.q4PrepaymentReady ? '已同步' : '待确认'
        : summary.priorQuarterFilingReady ? '已同步' : '待确认',
      unit: '个季度',
      value: isAnnualSettlement ? Number(!annualSettlement?.q4PrepaymentReady) : summary.missingPriorQuarterPeriods.length,
      valueKind: 'count'
    },
    {
      id: `${record.id}-cit-source-revenue`,
      name: '本年累计营业收入',
      result: '本年年初至申报期末累计',
      sourceModule: '利润表',
      sourcePeriod: cumulativePeriod,
      status: '已同步',
      value: summary.cumulativeOperatingRevenueAmount,
      valueKind: 'amount'
    },
    {
      id: `${record.id}-cit-source-cost-expense`,
      name: '本年累计营业成本',
      result: `销售费用 ${roundMoney(summary.cumulativeSalesExpenseAmount).toLocaleString('zh-CN')} 元 / 营业外收入 ${roundMoney(summary.cumulativeOtherIncomeAmount).toLocaleString('zh-CN')} 元`,
      sourceModule: '利润表',
      sourcePeriod: cumulativePeriod,
      status: '已同步',
      value: summary.cumulativeOperatingCostAmount,
      valueKind: 'amount'
    },
    {
      id: `${record.id}-cit-source-profit`,
      name: '本年累计利润总额',
      result: '来自本年累计利润表',
      sourceModule: '利润表',
      sourcePeriod: cumulativePeriod,
      status: '已同步',
      value: summary.cumulativeProfitBeforeTaxAmount,
      valueKind: 'amount'
    },
    ...(isAnnualSettlement
      ? [{
          id: `${record.id}-cit-source-payroll`,
          name: '职工薪酬附报',
          result: '已归集职工薪酬及公司承担的社保公积金',
          sourceModule: '总账',
          sourcePeriod: cumulativePeriod,
          status: '已同步' as const,
          value: summary.cumulativePayrollAndSocialInsuranceAmount,
          valueKind: 'amount' as const
        }]
      : []),
    {
      id: `${record.id}-cit-source-adjustment`,
      name: isAnnualSettlement ? '年度纳税调整' : '纳税调整',
      result: `调增 ${roundMoney(summary.taxAdjustmentIncreaseAmount).toLocaleString('zh-CN')} 元 / 调减 ${roundMoney(summary.taxAdjustmentDecreaseAmount).toLocaleString('zh-CN')} 元`,
      sourceModule: isAnnualSettlement ? '年度税务资料' : '季度税务资料',
      sourcePeriod: cumulativePeriod,
      status: getCorporateIncomeTaxItemSourceStatus(
        record,
        record.declarationScenario === '年度汇算' ? '年度纳税调整' : '纳税调整测算'
      ),
      value: roundMoney(summary.taxAdjustmentIncreaseAmount - summary.taxAdjustmentDecreaseAmount),
      valueKind: 'amount'
    },
    {
      id: `${record.id}-cit-source-loss`,
      name: '弥补亏损',
      result: isAnnualSettlement
        ? annualSettlement?.priorLossSourceReady ? '以前年度亏损已核对' : '以前年度亏损尚未核对'
        : record.citQuarterSourceReview?.priorLossReviewCompleted
          ? `来源 ${record.citQuarterSourceReview.priorLossSourceNo ?? '本期核对为零'}`
          : '以前年度可弥补亏损尚未核对',
      sourceModule: isAnnualSettlement ? '年度税务资料' : '季度税务资料',
      sourcePeriod: cumulativePeriod,
      status: isAnnualSettlement
        ? annualSettlement?.priorLossSourceReady ? '已同步' : '待确认'
        : getCorporateIncomeTaxItemSourceStatus(record, '季度亏损核对'),
      value: summary.priorLossDeductionAmount,
      valueKind: 'amount'
    },
    ...(!isAnnualSettlement
      ? [{
          id: `${record.id}-cit-source-tax-credit`,
          name: '抵免所得税额',
          result: record.citQuarterSourceReview?.taxCreditReviewCompleted
            ? `来源 ${record.citQuarterSourceReview.taxCreditSourceNo ?? '本期核对为零'}`
            : '本年累计抵免所得税额尚未核对',
          sourceModule: '季度税务资料',
          sourcePeriod: cumulativePeriod,
          status: getCorporateIncomeTaxItemSourceStatus(record, '所得税抵免核对'),
          value: summary.taxCreditAmount,
          valueKind: 'amount' as const
        }]
      : []),
    {
      id: `${record.id}-cit-source-paid-tax`,
      name: '本年实际已缴税额',
      result: '来自以前季度已完成企业所得税办理记录',
      sourceModule: '税务办理',
      sourcePeriod: cumulativePeriod,
      status: '已同步',
      value: summary.taxPaidYearToDateAmount,
      valueKind: 'amount'
    },
    {
      displayValue: summary.smallLowProfitEligible ? '符合' : '不符合',
      id: `${record.id}-cit-source-policy`,
      name: '小型微利资格',
      result: `${summary.policyBasis} / 平均人数 ${summary.averageEmployeeCount} 人 / 平均资产 ${roundMoney(summary.averageAssetAmount).toLocaleString('zh-CN')} 元 / 行业条件 ${summary.industryRestrictionResult}`,
      sourceModule: '税务口径',
      sourcePeriod: cumulativePeriod,
      status: '已同步',
      value: summary.cumulativeTaxableIncomeAmount,
      valueKind: 'amount'
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
      sourceModule: '发票台账',
      status: '待确认',
      title: '红票关联原蓝票',
      type: '红票关联原蓝票',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-subsequent`,
      period,
      result: '前期未开票后续开票关联未完成',
      sourceModule: '发票台账',
      status: '待确认',
      title: '后续开票关联',
      type: '前期未开票后续开票',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-unbilled`,
      period,
      result: '待确认未开票收入',
      sourceModule: '应收应付',
      status: '待确认',
      title: '未开票收入',
      type: '未开票收入核对',
      updatedAt: financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-basis`,
      period,
      result: '等待来源检查完成后生成申报测算',
      sourceModule: '申报准备',
      status: '无需确认',
      title: '申报测算',
      type: '申报测算',
      updatedAt: financeToday
    }
  ];
}

function createPayrollIitItems(period: string, suffix: string): FinanceDeclarationPreparationItem[] {
  return [
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-salary`,
      period,
      result: '待确认当月薪酬明细',
      sourceModule: '薪酬明细',
      status: '待确认',
      title: '薪酬明细',
      type: '薪酬数据核对',
      updatedAt: financeToday
    }
  ];
}

function createCorporateIncomeTaxItems(
  period: string,
  suffix: string,
  summary: FinanceCorporateIncomeTaxPreparationSummary,
  sourceReview?: FinanceCorporateIncomeTaxQuarterSourceReview,
  status: 'preparing' | 'completed' = 'preparing'
): FinanceDeclarationPreparationItem[] {
  const netAdjustmentAmount = roundMoney(summary.taxAdjustmentIncreaseAmount - summary.taxAdjustmentDecreaseAmount);
  const completed = status === 'completed';
  const adjustmentResult = `调增 ${formatDeclarationAmount(summary.taxAdjustmentIncreaseAmount)} / 调减 ${formatDeclarationAmount(summary.taxAdjustmentDecreaseAmount)}`;
  const eligibilityResult = summary.smallLowProfitEligible
    ? '符合小型微利企业条件'
    : '按普通企业口径';
  const prepaymentResult = `累计应纳税额 ${formatDeclarationAmount(summary.cumulativeIncomeTaxPayableAmount)}，本年实际已缴 ${formatDeclarationAmount(summary.taxPaidYearToDateAmount)}，本期应补 ${formatDeclarationAmount(summary.currentPeriodPayableAmount)}`;
  const adjustmentReady = isCorporateIncomeTaxQuarterAdjustmentReady(sourceReview);
  const priorLossReady = isCorporateIncomeTaxQuarterPriorLossReady(sourceReview);
  const taxCreditReady = isCorporateIncomeTaxQuarterTaxCreditReady(sourceReview);

  return [
    {
      amount: summary.unbookedVoucherCount,
      id: `declaration-prep-item-${suffix}-accounting-readiness`,
      period,
      result: summary.accountingSourceReady
        ? `${summary.coveredAccountingPeriods.join('、')} 已结账，累计账务来源完整`
        : [
            summary.unclosedAccountingPeriods.length > 0
              ? `未结账 ${summary.unclosedAccountingPeriods.join('、')}`
              : '',
            summary.unbookedVoucherCount > 0 ? `${summary.unbookedVoucherCount} 张凭证待记账` : ''
          ].filter(Boolean).join(' / '),
      sourceModule: '期间结账',
      status: summary.accountingSourceReady ? '无需确认' : '待确认',
      title: '季度账务完整性',
      type: '季度账务完整性检查',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: summary.missingPriorQuarterPeriods.length,
      id: `declaration-prep-item-${suffix}-prior-filing`,
      period,
      result: summary.priorQuarterFilingReady
        ? '以前季度企业所得税申报记录连续'
        : `缺少 ${summary.missingPriorQuarterPeriods.join('、')} 申报结果`,
      sourceModule: '税务办理',
      status: summary.priorQuarterFilingReady ? '无需确认' : '待确认',
      title: '以前季度申报',
      type: '历史申报连续性检查',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: summary.cumulativeProfitBeforeTaxAmount,
      id: `declaration-prep-item-${suffix}-profit`,
      period,
      result: `本年累计利润总额 ${formatDeclarationAmount(summary.cumulativeProfitBeforeTaxAmount)}，已从利润表同步`,
      sourceModule: '利润表',
      status: '无需确认',
      title: '累计利润来源',
      type: '利润数据同步',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: netAdjustmentAmount,
      id: `declaration-prep-item-${suffix}-adjustment`,
      period,
      result: `${adjustmentResult}，净调整 ${formatDeclarationAmount(netAdjustmentAmount)}`,
      sourceModule: '季度税务资料',
      status: completed || adjustmentReady ? '已确认' : '待确认',
      title: '纳税调整',
      type: '纳税调整测算',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: summary.priorLossDeductionAmount,
      id: `declaration-prep-item-${suffix}-prior-loss`,
      period,
      result: priorLossReady
        ? `以前年度可弥补亏损 ${formatDeclarationAmount(summary.priorLossDeductionAmount)}`
        : '等待核对以前年度可弥补亏损',
      sourceModule: '季度税务资料',
      status: completed || priorLossReady ? '已确认' : '待确认',
      title: '以前年度亏损',
      type: '季度亏损核对',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: summary.taxCreditAmount,
      id: `declaration-prep-item-${suffix}-tax-credit`,
      period,
      result: taxCreditReady
        ? `本年累计抵免所得税额 ${formatDeclarationAmount(summary.taxCreditAmount)}`
        : '等待核对本年累计抵免所得税额',
      sourceModule: '季度税务资料',
      status: completed || taxCreditReady ? '已确认' : '待确认',
      title: '所得税抵免',
      type: '所得税抵免核对',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: 0,
      id: `declaration-prep-item-${suffix}-policy`,
      period,
      result: `${eligibilityResult}，已按累计所得额、人数、资产和行业条件判定`,
      sourceModule: '税务口径',
      status: '无需确认',
      title: '优惠资格判定',
      type: '优惠资格判定',
      updatedAt: completed ? '2026-04-10' : financeToday
    },
    {
      amount: summary.currentPeriodPayableAmount,
      id: `declaration-prep-item-${suffix}-basis`,
      period,
      result: prepaymentResult,
      sourceModule: '申报准备',
      status: completed ? '已确认' : '无需确认',
      title: '预缴测算',
      type: '预缴测算',
      updatedAt: completed ? '2026-04-10' : financeToday
    }
  ];
}

function buildCorporateIncomeTaxAnnualSettlement({
  accountingPeriodLocks,
  period,
  sourceReview,
  taxMatterRows
}: {
  accountingPeriodLocks: AccountingPeriodLockRecord[];
  period: string;
  sourceReview?: FinanceCorporateIncomeTaxAnnualSourceReview;
  taxMatterRows: FinanceTaxMatterRecord[];
}): FinanceCorporateIncomeTaxAnnualSettlement {
  const yearEndLock = accountingPeriodLocks.find(
    (lock) => lock.accountingPeriod === `${period}-12` && lock.status === '已结账'
  );
  const annualFinancialStatementsReady = Boolean(
    yearEndLock?.closeSummarySnapshot?.financialStatementReport?.financialStatementReadiness === '可出具'
  );
  const q4PrepaymentReady = taxMatterRows.some(
    (matter) =>
      matter.matterType === '企业所得税' &&
      matter.period === `${period}-Q4` &&
      matter.processStatus === '已完成' &&
      ['申报成功', '零申报'].includes(matter.declarationStatus) &&
      (matter.paymentStatus === '已缴纳' || matter.paymentStatus === '无需缴纳')
  );
  const adjustments = sourceReview?.adjustments ?? [];
  const adjustmentSourceReady = Boolean(
    sourceReview?.adjustmentReviewCompleted && adjustments.every((adjustment) => adjustment.status === '已归集')
  );
  const priorLossSourceReady = Boolean(
    sourceReview?.priorLossReviewCompleted &&
      (sourceReview.priorLossDeductionAmount === 0 || Boolean(sourceReview.priorLossSourceNo?.trim()))
  );
  const yearEndClosed = Boolean(yearEndLock);

  return {
    adjustments,
    adjustmentSourceReady,
    annualFinancialStatementsReady,
    priorLossSourceReady,
    q4PrepaymentReady,
    readyForConfirmation:
      yearEndClosed &&
      annualFinancialStatementsReady &&
      q4PrepaymentReady &&
      adjustmentSourceReady &&
      priorLossSourceReady,
    yearEndClosed
  };
}

function createCorporateIncomeTaxAnnualItems(
  period: string,
  suffix: string,
  summary: FinanceCorporateIncomeTaxPreparationSummary,
  settlement: FinanceCorporateIncomeTaxAnnualSettlement
): FinanceDeclarationPreparationItem[] {
  const netAdjustmentAmount = roundMoney(summary.taxAdjustmentIncreaseAmount - summary.taxAdjustmentDecreaseAmount);
  const preconditionItem = (
    key: 'close' | 'statements' | 'q4',
    ready: boolean,
    title: string,
    type: FinanceDeclarationPreparationItemType,
    readyResult: string,
    pendingResult: string
  ): FinanceDeclarationPreparationItem => ({
    amount: 0,
    id: `declaration-prep-item-${suffix}-${key}`,
    period,
    result: ready ? readyResult : pendingResult,
    sourceModule: key === 'q4' ? '税务办理' : key === 'close' ? '期间结账' : '财务报表',
    status: ready ? '无需确认' : '待确认',
    title,
    type,
    updatedAt: financeToday
  });

  return [
    preconditionItem('close', settlement.yearEndClosed, '年度结账', '年度结账检查', '12 月已结账', '等待 12 月期间结账'),
    preconditionItem('statements', settlement.annualFinancialStatementsReady, '年度报表', '年度报表检查', '年度财务报表可出具', '等待年度财务报表通过校验'),
    preconditionItem('q4', settlement.q4PrepaymentReady, '第四季度预缴', '第四季度预缴检查', 'Q4 预缴已完成', '等待 Q4 企业所得税预缴完成'),
    {
      amount: netAdjustmentAmount,
      id: `declaration-prep-item-${suffix}-adjustments`,
      period,
      result: `调增 ${formatDeclarationAmount(summary.taxAdjustmentIncreaseAmount)} / 调减 ${formatDeclarationAmount(summary.taxAdjustmentDecreaseAmount)}`,
      sourceModule: '年度调整明细',
      status: settlement.adjustmentSourceReady ? '已确认' : '待确认',
      title: '年度纳税调整',
      type: '年度纳税调整',
      updatedAt: financeToday
    },
    {
      amount: summary.priorLossDeductionAmount,
      id: `declaration-prep-item-${suffix}-prior-loss`,
      period,
      result: settlement.priorLossSourceReady
        ? `以前年度亏损弥补 ${formatDeclarationAmount(summary.priorLossDeductionAmount)}`
        : '等待核对以前年度可弥补亏损',
      sourceModule: '年度税务资料',
      status: settlement.priorLossSourceReady ? '已确认' : '待确认',
      title: '以前年度亏损',
      type: '以前年度亏损核对',
      updatedAt: financeToday
    },
    {
      amount: summary.currentPeriodPayableAmount,
      id: `declaration-prep-item-${suffix}-settlement`,
      period,
      result: summary.overpaidTaxAmount > 0
        ? `年度多缴 ${formatDeclarationAmount(summary.overpaidTaxAmount)}`
        : `年度应补 ${formatDeclarationAmount(summary.currentPeriodPayableAmount)}`,
      sourceModule: '申报准备',
      status: '无需确认',
      title: '年度汇算测算',
      type: '年度汇算测算',
      updatedAt: financeToday
    }
  ];
}

const cit2026q2SourceReview: FinanceCorporateIncomeTaxQuarterSourceReview = {
  adjustments: [
    {
      accountingAmount: 1200,
      adjustmentAmount: 1200,
      deductibleAmount: 0,
      direction: '调增',
      id: 'cit-q2-adjustment-entertainment-001',
      item: '业务招待费超限额',
      sourceModule: '费用台账',
      sourceNo: 'EXP-2026Q2-ENTERTAINMENT',
      status: '已归集'
    },
    {
      accountingAmount: 700,
      adjustmentAmount: 700,
      deductibleAmount: 700,
      direction: '调减',
      id: 'cit-q2-adjustment-prior-001',
      item: '前期已调增事项本期转回',
      sourceModule: '税务办理',
      sourceNo: 'CIT-ADJ-2026Q2-001',
      status: '已归集'
    }
  ],
  adjustmentReviewCompleted: true,
  priorLossDeductionAmount: 5000,
  priorLossReviewCompleted: true,
  priorLossSourceNo: 'CIT-LOSS-LEDGER-2025',
  reviewedAt: '2026-07-10T10:30:00+08:00',
  reviewedBy: '李明',
  taxCreditAmount: 0,
  taxCreditReviewCompleted: true
};

const cit2026q1SourceReview: FinanceCorporateIncomeTaxQuarterSourceReview = {
  adjustments: [],
  adjustmentReviewCompleted: true,
  priorLossDeductionAmount: 2000,
  priorLossReviewCompleted: true,
  priorLossSourceNo: 'CIT-LOSS-LEDGER-2025',
  reviewedAt: '2026-04-10T09:50:00+08:00',
  reviewedBy: '李明',
  taxCreditAmount: 0,
  taxCreditReviewCompleted: true
};

const cit2026q2Summary = calculateCorporateIncomeTaxSummary({
  accountingSourceReady: false,
  averageAssetAmount: 0,
  averageEmployeeCount: 0,
  coveredAccountingPeriods: ['2026-04', '2026-05', '2026-06'],
  cumulativeOperatingCostAmount: 0,
  cumulativeOperatingRevenueAmount: 0,
  cumulativeOtherIncomeAmount: 0,
  cumulativePayrollAndSocialInsuranceAmount: 0,
  cumulativeProfitBeforeTaxAmount: 0,
  cumulativeSalesExpenseAmount: 0,
  industryRestrictionResult: defaultCorporateIncomeTaxPolicy.industryRestrictionResult,
  missingPriorQuarterPeriods: [],
  priorLossDeductionAmount: cit2026q2SourceReview.priorLossDeductionAmount,
  priorQuarterFilingReady: true,
  reportingBasis: '本年累计',
  smallLowProfitAssetLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitAssetLimit,
  smallLowProfitEmployeeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitEmployeeLimit,
  smallLowProfitTaxableIncomeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeLimit,
  statutoryTaxRate: defaultCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate,
  taxAdjustmentDecreaseAmount: 700,
  taxAdjustmentIncreaseAmount: 1200,
  taxCreditAmount: cit2026q2SourceReview.taxCreditAmount,
  taxPaidYearToDateAmount: 500,
  taxYear: '2026',
  unbookedVoucherCount: 0,
  unclosedAccountingPeriods: ['2026-04', '2026-05', '2026-06']
});

const cit2026q1Summary = calculateCorporateIncomeTaxSummary({
  accountingSourceReady: true,
  averageAssetAmount: 1180000,
  averageEmployeeCount: 5,
  coveredAccountingPeriods: ['2026-01', '2026-02', '2026-03'],
  cumulativeOperatingCostAmount: 98000,
  cumulativeOperatingRevenueAmount: 156000,
  cumulativeOtherIncomeAmount: 0,
  cumulativePayrollAndSocialInsuranceAmount: 13800,
  cumulativeProfitBeforeTaxAmount: 12000,
  cumulativeSalesExpenseAmount: 12000,
  industryRestrictionResult: defaultCorporateIncomeTaxPolicy.industryRestrictionResult,
  missingPriorQuarterPeriods: [],
  priorLossDeductionAmount: cit2026q1SourceReview.priorLossDeductionAmount,
  priorQuarterFilingReady: true,
  reportingBasis: '本年累计',
  smallLowProfitAssetLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitAssetLimit,
  smallLowProfitEmployeeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitEmployeeLimit,
  smallLowProfitTaxableIncomeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeLimit,
  statutoryTaxRate: defaultCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate,
  taxAdjustmentDecreaseAmount: 0,
  taxAdjustmentIncreaseAmount: 0,
  taxCreditAmount: 0,
  taxPaidYearToDateAmount: 0,
  taxYear: '2026',
  unbookedVoucherCount: 0,
  unclosedAccountingPeriods: []
});

const cit2026AnnualSourceReview: FinanceCorporateIncomeTaxAnnualSourceReview = {
  adjustments: [],
  adjustmentReviewCompleted: false,
  priorLossDeductionAmount: 0,
  priorLossReviewCompleted: false
};
const cit2026AnnualSummary = calculateCorporateIncomeTaxSummary({
  accountingSourceReady: false,
  averageAssetAmount: 0,
  averageEmployeeCount: 0,
  coveredAccountingPeriods: Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`),
  cumulativeOperatingCostAmount: 0,
  cumulativeOperatingRevenueAmount: 0,
  cumulativeOtherIncomeAmount: 0,
  cumulativePayrollAndSocialInsuranceAmount: 0,
  cumulativeProfitBeforeTaxAmount: 0,
  cumulativeSalesExpenseAmount: 0,
  industryRestrictionResult: defaultCorporateIncomeTaxPolicy.industryRestrictionResult,
  missingPriorQuarterPeriods: [],
  priorLossDeductionAmount: cit2026AnnualSourceReview.priorLossDeductionAmount,
  priorQuarterFilingReady: false,
  reportingBasis: '本年累计',
  smallLowProfitAssetLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitAssetLimit,
  smallLowProfitEmployeeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitEmployeeLimit,
  smallLowProfitTaxableIncomeLimit: defaultCorporateIncomeTaxPolicy.smallLowProfitTaxableIncomeLimit,
  statutoryTaxRate: defaultCorporateIncomeTaxPolicy.ordinaryEffectiveTaxRate,
  taxAdjustmentDecreaseAmount: 0,
  taxAdjustmentIncreaseAmount: 0,
  taxCreditAmount: 0,
  taxPaidYearToDateAmount: 500,
  taxYear: '2026',
  unbookedVoucherCount: 0,
  unclosedAccountingPeriods: Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`)
});

const cit2026AnnualSettlement: FinanceCorporateIncomeTaxAnnualSettlement = {
  adjustments: cit2026AnnualSourceReview.adjustments,
  adjustmentSourceReady: false,
  annualFinancialStatementsReady: false,
  priorLossSourceReady: false,
  q4PrepaymentReady: false,
  readyForConfirmation: false,
  yearEndClosed: false
};

const seedStampDutyPurchaseSource = buildManualDocumentStampDutySource({
    amountTaxMode: '价税分列',
    counterparty: '武汉新材供应链有限公司',
    counterpartyTaxId: '91420100MA4MATERIAL1',
    documentName: '办公设备采购合同',
    documentNo: 'CG-2026-018',
    evidenceFiles: [
      {
        id: 'stamp-manual-purchase-file-001',
        name: '办公设备采购合同_已签署.pdf',
        status: '已上传',
        type: '已签署合同',
        updatedAt: '2026-05-20'
      }
    ],
    id: 'stamp-manual-purchase-202605',
    signedAt: '2026-05-20',
    sourceNo: 'STAMP-MANUAL-2026-001',
    sourceVersion: 'V1.0',
    statedAmount: 40000,
    statedVatAmount: 1165.05,
    taxItem: '买卖合同'
  });
const seedStampDutyOpenAmountSource = buildManualDocumentStampDutySource({
  amountTaxMode: '含税未分列',
  counterparty: '武汉光谷商业管理有限公司',
  counterpartyTaxId: '91420100MA4LEASE01',
  documentName: '办公场地租赁框架协议',
  documentNo: 'LEASE-2026-006',
  evidenceFiles: [
    {
      id: 'stamp-manual-open-lease-file-001',
      name: '办公场地租赁框架协议_已签署.pdf',
      status: '已上传',
      type: '已签署合同',
      updatedAt: '2026-06-18'
    }
  ],
  id: 'stamp-manual-open-lease-202606',
  signedAt: '2026-06-18',
  sourceNo: 'STAMP-MANUAL-2026-002',
  sourceVersion: 'V1.0',
  taxItem: '租赁合同'
});
const seedStampDutyOpenAmountSettlementSource = buildStampDutySettlementEvent(seedStampDutyOpenAmountSource, {
  amount: 12000,
  evidenceFiles: [
    {
      id: 'stamp-manual-open-lease-settlement-file-001',
      name: '办公场地租赁结算单_202607.pdf',
      status: '已上传',
      type: '结算依据',
      updatedAt: '2026-07-20'
    }
  ],
  id: 'SET-202607-001',
  settledAt: '2026-07-20'
});

export const financeStampDutyManualSourceRecords = [
  seedStampDutyPurchaseSource,
  seedStampDutyOpenAmountSource,
  seedStampDutyOpenAmountSettlementSource
];

export const financeStampDutyHistoricalCapitalBookBases: Record<string, number> = {
  '2025': 200000
};

export const financeStampDutyInitialSourceResolutions: FinanceStampDutySourceResolution[] = [
  {
    allocations: [],
    obligationPeriod: '2026-Q1',
    reason: '年度咨询服务框架未形成印花税税目税率表列举的应税凭证',
    resolvedAt: '2026-03-31 18:30',
    resolvedBy: '李明',
    sourceId: 'contract-starry-framework',
    sourceVersion: 'V1.0',
    treatment: '非应税'
  }
];

function buildStampDutySourcesForPreparation(
  record: Pick<FinanceDeclarationPreparationRecord, 'declarationScenario' | 'period'>,
  contracts: CustomerContractRecord[],
  customers: CustomerRecord[],
  manualSources: FinanceStampDutySourceRecord[] = financeStampDutyManualSourceRecords,
  resolutions: FinanceStampDutySourceResolution[] = [],
  capitalBookSources: FinanceStampDutySourceRecord[] = []
) {
  const periodContracts = contracts.filter((contract) => {
    if (record.declarationScenario === '季度申报') {
      const signedMonth = Number(contract.signedAt.slice(5, 7));
      const signedQuarter = `${contract.signedAt.slice(0, 4)}-Q${Math.ceil(signedMonth / 3)}`;

      return signedQuarter === record.period;
    }

    return record.declarationScenario === '按次申报' && contract.signedAt === record.period;
  });
  const contractSources = periodContracts.flatMap((contract) => {
    const customer = customers.find((currentCustomer) => currentCustomer.id === contract.customerId);

    return customer ? [buildContractStampDutySource(contract, customer)] : [];
  });
  const applicableCapitalBookSources = record.declarationScenario === '年度申报'
    ? capitalBookSources.filter((source) => source.obligationPeriod === record.period)
    : [];
  const sourcePool = applyStampDutySourceResolutions(
    [...contractSources, ...manualSources, ...applicableCapitalBookSources],
    resolutions
  );

  return sourcePool.filter(
    (source) => source.obligationPeriod === record.period && source.declarationScenario === record.declarationScenario
  );
}

function createStampDutyItems(
  period: string,
  suffix: string,
  sources: FinanceStampDutySourceRecord[]
): FinanceDeclarationPreparationItem[] {
  const summary = buildStampDutyPreparationSummary(sources);
  const sourceReady = summary.pendingCount === 0;

  return [
    {
      amount: summary.taxableBasis,
      id: `declaration-prep-item-${suffix}-stamp-source`,
      period,
      result: sourceReady
        ? `${summary.sourceCount} 条税源已核对`
        : `${summary.pendingCount} 条税源待确认`,
      sourceModule: '合同管理 / 补录应税凭证 / 总账',
      status: sourceReady ? '已确认' : '待确认',
      title: '税源完整性',
      type: '印花税税源核对',
      updatedAt: financeToday
    },
    {
      amount: summary.estimatedPayableAmount,
      id: `declaration-prep-item-${suffix}-stamp-result`,
      period,
      result: sourceReady
        ? `预计应纳印花税 ${formatDeclarationAmount(summary.estimatedPayableAmount)}`
        : '待税源完整后确认申报口径',
      sourceModule: '税务口径',
      status: sourceReady ? '已确认' : '待确认',
      title: '申报口径',
      type: '印花税申报口径确认',
      updatedAt: financeToday
    }
  ];
}

const stampDuty2026Q1Sources = buildStampDutySourcesForPreparation(
  { declarationScenario: '季度申报', period: '2026-Q1' },
  customerContractRecords,
  customerRecords,
  financeStampDutyManualSourceRecords,
  financeStampDutyInitialSourceResolutions
);
const stampDuty2026Q1Summary = buildStampDutyPreparationSummary(stampDuty2026Q1Sources);
const stampDuty2026Q2Sources = buildStampDutySourcesForPreparation(
  { declarationScenario: '季度申报', period: '2026-Q2' },
  customerContractRecords,
  customerRecords
);
const stampDuty2026Q2Summary = buildStampDutyPreparationSummary(stampDuty2026Q2Sources);
const stampDuty2026Q3Sources = buildStampDutySourcesForPreparation(
  { declarationScenario: '季度申报', period: '2026-Q3' },
  customerContractRecords,
  customerRecords
);
const stampDuty2026Q3Summary = buildStampDutyPreparationSummary(stampDuty2026Q3Sources);
const stampDuty2026AnnualSources = buildStampDutySourcesForPreparation(
  { declarationScenario: '年度申报', period: '2026' },
  customerContractRecords,
  customerRecords
);
const stampDuty2026AnnualSummary = buildStampDutyPreparationSummary(stampDuty2026AnnualSources);

const q1VatSurchargeBreakdown = getFinanceVatSurchargeSummary({
  accountingPeriod: '2026-03',
  qualifiesForMicroTaxFeeReduction: true,
  vatPayableAmount: 440.1
});
const q1VatPreparationSummary: FinanceVatPreparationSummary = {
  ...emptyVatSummary,
  appliedTaxRate: '按票面分项',
  declaredNetSalesAmount: 45000,
  exemptionEligibleSalesAmount: 45000,
  exemptSalesAmount: 990.1,
  estimatedSurcharge: q1VatSurchargeBreakdown.totalAfterReduction,
  estimatedTotalTaxAmount: 440.1 + q1VatSurchargeBreakdown.totalAfterReduction,
  estimatedVatAfterExemption: 440.1,
  estimatedVatBeforeExemption: 1350,
  isBelowExemptionThreshold: true,
  outputBlueNetAmount: 45000,
  outputBlueTaxIncludedAmount: 45440.1,
  otherInvoiceAndUnbilledSalesAmount: 990.1,
  reducedRateSalesAmount: 44009.9,
  serviceSalesAmount: 45000,
  sourceRecognizedVatAmount: 440.1,
  specialInvoiceSalesAmount: 44009.9,
  surchargeBreakdown: q1VatSurchargeBreakdown,
  taxOutcome: '混合口径',
  taxOutcomeReason: '专用发票部分按票面 1% 计税，未开票普通销售额适用季度免税。',
  taxableSalesAmount: 45000,
  unbilledIncomeNetAmount: 990.1
};

export const financeDeclarationPreparationRecords: FinanceDeclarationPreparationRecord[] = [
  {
    declarationScenario: '月度扣缴',
    id: 'declaration-prep-202606-iit',
    operationRecords: [
      {
        id: 'declaration-prep-op-202606-iit-001',
        time: '2026-06-21 16:50',
        actor: '系统',
        object: 'PREP-202606-IIT',
        action: '生成准备事项',
        summary: '根据 2026-06 薪酬明细生成个人所得税申报准备'
      }
    ],
    owner: '李明',
    period: '2026-06',
    periodType: '月度',
    preparationNo: 'PREP-202606-IIT',
    status: '准备中',
    taxType: '个人所得税',
    title: '2026-06 个人所得税申报准备',
    updatedAt: '2026-06-21',
    vatSummary: emptyVatSummary,
    items: createPayrollIitItems('2026-06', '202606-iit')
  },
  {
    confirmedSourceSnapshotKey: buildStampDutySourceSnapshotKey(stampDuty2026Q1Sources),
    confirmedStampDutySources: stampDuty2026Q1Sources,
    confirmedStampDutySummary: stampDuty2026Q1Summary,
    declarationScenario: '季度申报',
    id: 'declaration-prep-2026q1-stamp',
    items: createStampDutyItems('2026-Q1', '2026q1-stamp', stampDuty2026Q1Sources),
    operationRecords: [
      {
        action: '生成准备事项',
        actor: '系统',
        id: 'declaration-prep-op-2026q1-stamp-001',
        object: 'PREP-2026Q1-STAMP',
        summary: '根据 2026-Q1 已书立凭证生成印花税申报准备',
        time: '2026-03-31 18:20'
      },
      {
        action: '完成税源核对',
        actor: '李明',
        id: 'declaration-prep-op-2026q1-stamp-002',
        object: 'PREP-2026Q1-STAMP',
        summary: '确认本期已书立凭证不属于印花税列举应税凭证，无需申报',
        time: '2026-03-31 18:30'
      }
    ],
    owner: '李明',
    period: '2026-Q1',
    periodType: '季度',
    preparationNo: 'PREP-2026Q1-STAMP',
    sourceSnapshotKey: buildStampDutySourceSnapshotKey(stampDuty2026Q1Sources),
    stampDutySources: stampDuty2026Q1Sources,
    stampDutySummary: stampDuty2026Q1Summary,
    status: '已进入税务办理',
    taxType: '印花税',
    title: '2026-Q1 印花税申报准备',
    updatedAt: '2026-03-31',
    vatSummary: emptyVatSummary
  },
  {
    declarationScenario: '季度申报',
    id: 'declaration-prep-2026q2-stamp',
    items: createStampDutyItems('2026-Q2', '2026q2-stamp', stampDuty2026Q2Sources),
    operationRecords: [
      {
        action: '生成准备事项',
        actor: '系统',
        id: 'declaration-prep-op-2026q2-stamp-001',
        object: 'PREP-2026Q2-STAMP',
        summary: '根据已书立应税凭证生成 2026-Q2 印花税申报准备',
        time: '2026-06-21 18:20'
      }
    ],
    owner: '李明',
    period: '2026-Q2',
    periodType: '季度',
    preparationNo: 'PREP-2026Q2-STAMP',
    sourceSnapshotKey: buildStampDutySourceSnapshotKey(stampDuty2026Q2Sources),
    stampDutySources: stampDuty2026Q2Sources,
    stampDutySummary: stampDuty2026Q2Summary,
    status: '准备中',
    taxType: '印花税',
    title: '2026-Q2 印花税申报准备',
    updatedAt: '2026-06-21',
    vatSummary: emptyVatSummary
  },
  {
    declarationScenario: '季度申报',
    id: 'declaration-prep-2026q3-stamp',
    items: createStampDutyItems('2026-Q3', '2026q3-stamp', stampDuty2026Q3Sources),
    operationRecords: [
      {
        action: '生成准备事项',
        actor: '系统',
        id: 'declaration-prep-op-2026q3-stamp-001',
        object: 'PREP-2026Q3-STAMP',
        summary: '根据无固定金额凭证的实际结算事件生成 2026-Q3 印花税申报准备',
        time: '2026-07-21 09:20'
      }
    ],
    owner: '李明',
    period: '2026-Q3',
    periodType: '季度',
    preparationNo: 'PREP-2026Q3-STAMP',
    sourceSnapshotKey: buildStampDutySourceSnapshotKey(stampDuty2026Q3Sources),
    stampDutySources: stampDuty2026Q3Sources,
    stampDutySummary: stampDuty2026Q3Summary,
    status: '准备中',
    taxType: '印花税',
    title: '2026-Q3 印花税申报准备',
    updatedAt: '2026-07-21',
    vatSummary: emptyVatSummary
  },
  {
    declarationScenario: '年度申报',
    id: 'declaration-prep-2026-stamp-book',
    items: createStampDutyItems('2026', '2026-stamp-book', stampDuty2026AnnualSources),
    operationRecords: [
      {
        action: '生成准备事项',
        actor: '系统',
        id: 'declaration-prep-op-2026-stamp-book-001',
        object: 'PREP-2026-STAMP-BOOK',
        summary: '根据实收资本与资本公积新增额生成 2026 年营业账簿印花税准备',
        time: '2026-06-30 18:25'
      }
    ],
    owner: '李明',
    period: '2026',
    periodType: '年度',
    preparationNo: 'PREP-2026-STAMP-BOOK',
    sourceSnapshotKey: buildStampDutySourceSnapshotKey(stampDuty2026AnnualSources),
    stampDutySources: stampDuty2026AnnualSources,
    stampDutySummary: stampDuty2026AnnualSummary,
    status: '准备中',
    taxType: '印花税',
    title: '2026 年营业账簿印花税申报准备',
    updatedAt: '2026-06-30',
    vatSummary: emptyVatSummary
  },
  {
    declarationScenario: '季度申报',
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
    citQuarterSourceReview: cit2026q2SourceReview,
    citSummary: cit2026q2Summary,
    declarationScenario: '季度预缴',
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
    title: '2026-Q2 企业所得税季度预缴',
    updatedAt: '2026-06-21',
    vatSummary: emptyVatSummary,
    items: createCorporateIncomeTaxItems('2026-Q2', '2026q2-cit', cit2026q2Summary, cit2026q2SourceReview)
  },
  {
    citAnnualSettlement: cit2026AnnualSettlement,
    citAnnualSourceReview: cit2026AnnualSourceReview,
    citSummary: cit2026AnnualSummary,
    declarationScenario: '年度汇算',
    id: 'declaration-prep-2026-cit-annual',
    operationRecords: [
      {
        id: 'declaration-prep-op-2026-cit-annual-001',
        time: '2026-06-30 18:20',
        actor: '系统',
        object: 'PREP-2026-CIT-ANNUAL',
        action: '建立年度准备',
        summary: '建立 2026 年度企业所得税汇算准备，等待年度结账、年度报表和 Q4 预缴'
      }
    ],
    owner: '李明',
    period: '2026',
    periodType: '年度',
    preparationNo: 'PREP-2026-CIT-ANNUAL',
    status: '准备中',
    taxType: '企业所得税',
    title: '2026 年度企业所得税汇算清缴',
    updatedAt: '2026-06-30',
    vatSummary: emptyVatSummary,
    items: createCorporateIncomeTaxAnnualItems(
      '2026',
      '2026-cit-annual',
      cit2026AnnualSummary,
      cit2026AnnualSettlement
    )
  },
  {
    declarationScenario: '季度申报',
    confirmedSourceSnapshotKey: 'seed-confirmed-2026q1-vat',
    confirmedUnbilledIncomeDeclarations: [
      {
        businessRecordId: 'ar-202603-001',
        netAmount: 990.1,
        salesCategory: '服务、不动产和无形资产',
        vatTreatment: '免税'
      }
    ],
    confirmedVatSummary: q1VatPreparationSummary,
    id: 'declaration-prep-2026q1-vat',
    operationRecords: [
      {
        id: 'declaration-prep-op-2026q1-vat-001',
        time: '2026-04-10 09:30',
        actor: '李明',
        object: 'PREP-2026Q1-VAT',
        action: '确认准备结果',
        summary: '确认 2026-Q1 增值税及附加申报准备，专票按 1% 计税、未开票收入适用免税'
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
    unbilledIncomeDeclarations: [
      {
        businessRecordId: 'ar-202603-001',
        netAmount: 990.1,
        salesCategory: '服务、不动产和无形资产',
        vatTreatment: '免税'
      }
    ],
    unbilledIncomeBusinessRecordIds: ['ar-202603-001'],
    vatSummary: q1VatPreparationSummary,
    items: createVatItems('2026-Q1', '2026q1-vat').map((item) => ({
      ...item,
      amount: item.type === '销项发票核对' || item.type === '申报测算' ? 45000 : 0,
      result:
        item.type === '销项发票核对'
          ? '销项发票已确认'
          : item.type === '申报测算'
            ? '不含税申报销售额 45,000.00 元'
            : '本期无需处理',
      status: item.type === '红票关联原蓝票' || item.type === '前期未开票后续开票' || item.type === '未开票收入核对'
        ? '无需确认'
        : item.type === '申报测算'
          ? '无需确认'
          : '已确认',
      updatedAt: '2026-04-10'
    }))
  },
  {
    citQuarterSourceReview: cit2026q1SourceReview,
    citSummary: cit2026q1Summary,
    declarationScenario: '季度预缴',
    confirmedCitSummary: cit2026q1Summary,
    confirmedCitQuarterSourceReview: cit2026q1SourceReview,
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
    title: '2026-Q1 企业所得税季度预缴',
    updatedAt: '2026-04-12',
    vatSummary: emptyVatSummary,
    items: createCorporateIncomeTaxItems('2026-Q1', '2026q1-cit', cit2026q1Summary, cit2026q1SourceReview, 'completed')
  }
];

export function ensurePayrollIitDeclarationPreparationRecords(
  records: FinanceDeclarationPreparationRecord[],
  salaryPaymentRecords: SalaryPaymentRecord[],
  financeRows: FinanceTransactionRecord[] = [],
  receivablePayableRows: FinanceReceivablePayableRecord[] = []
) {
  const existingPeriods = new Set(
    records
      .filter((record) => record.taxType === '个人所得税' && record.declarationScenario === '月度扣缴')
      .map((record) => record.period)
  );
  const paymentFacts = buildNaturalPersonPaymentFacts(salaryPaymentRecords, financeRows);
  const unrepresentedPayments = getUnrepresentedPostedNaturalPersonPayments(
    salaryPaymentRecords,
    financeRows,
    receivablePayableRows
  );
  const paymentPeriods = [
    ...paymentFacts.map((fact) => fact.taxPeriod),
    ...unrepresentedPayments.map(
      (row) => row.naturalPersonPayment?.taxPeriod ?? row.occurredAt.slice(0, 7)
    )
  ];
  const generatedRecords = Array.from(
    new Set(
      paymentPeriods
        .filter((period) => /^\d{4}-\d{2}$/.test(period) && !existingPeriods.has(period))
    )
  )
    .sort()
    .map((period): FinanceDeclarationPreparationRecord => {
      const compactPeriod = period.replace('-', '');
      const latestPaymentTime = [
        ...paymentFacts.filter((fact) => fact.taxPeriod === period).map((fact) => fact.occurredAt),
        ...unrepresentedPayments
          .filter(
            (row) => (row.naturalPersonPayment?.taxPeriod ?? row.occurredAt.slice(0, 7)) === period
          )
          .map((row) => row.occurredAt)
      ]
        .sort()
        .at(-1) ?? `${period}-01 09:00`;

      return {
        declarationScenario: '月度扣缴',
        id: `declaration-prep-${compactPeriod}-iit`,
        items: createPayrollIitItems(period, `${compactPeriod}-iit`),
        operationRecords: [
          {
            action: '生成准备事项',
            actor: '系统',
            id: `declaration-prep-op-${compactPeriod}-iit-001`,
            object: `PREP-${compactPeriod}-IIT`,
            summary: `根据 ${period} 自然人实际支付记录生成个人所得税申报准备`,
            time: latestPaymentTime
          }
        ],
        owner: '李明',
        period,
        periodType: '月度',
        preparationNo: `PREP-${compactPeriod}-IIT`,
        status: '准备中',
        taxType: '个人所得税',
        title: `${period} 个人所得税申报准备`,
        updatedAt: latestPaymentTime.slice(0, 10),
        vatSummary: emptyVatSummary
      };
    });

  return [...records, ...generatedRecords];
}

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

  return progress.pendingCount === 0;
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

function getPreparationPeriodReceivables(
  record: FinanceDeclarationPreparationRecord,
  receivablePayableRows: FinanceReceivablePayableRecord[]
) {
  const periodSet = new Set(getPreparationMonthPeriods(record.period));

  return receivablePayableRows.filter(
    (businessRecord) =>
      periodSet.has(businessRecord.accountingPeriod) &&
      businessRecord.confirmationStatus === '已确认' &&
      businessRecord.direction === '应收' &&
      businessRecord.counterpartyType === '客户'
  );
}

function sumMoney<T>(rows: T[], selector: (row: T) => number) {
  return roundMoney(rows.reduce((total, row) => total + selector(row), 0));
}

type VatTreatmentAmounts = Record<FinanceVatInvoiceTreatment, number>;

function createVatTreatmentAmounts(): VatTreatmentAmounts {
  return {
    不涉及: 0,
    免税: 0,
    '减按1%': 0,
    按法定征收率: 0
  };
}

function addVatTreatmentAmount(
  amounts: VatTreatmentAmounts,
  treatment: FinanceVatInvoiceTreatment,
  amount: number
) {
  amounts[treatment] = roundMoney(amounts[treatment] + amount);
}

function getVatTreatmentSummaryOutcome(amounts: VatTreatmentAmounts): FinanceVatDeclarationOutcome {
  const activeTreatments = (Object.keys(amounts) as FinanceVatInvoiceTreatment[]).filter(
    (treatment) => treatment !== '不涉及' && Math.abs(amounts[treatment]) > 0.01
  );

  if (activeTreatments.length === 0) {
    return '不涉及';
  }

  return activeTreatments.length === 1 ? activeTreatments[0]! : '混合口径';
}

function getInvoiceVatTreatment(invoice: FinanceInvoiceRecord): FinanceVatInvoiceTreatment {
  return invoice.vatTreatment ?? resolveFinanceVatInvoiceTreatment({
    accountingPeriod: invoice.accountingPeriod,
    direction: invoice.direction,
    taxRate: invoice.taxRate,
    taxableClassification: invoice.taxableClassification
  });
}

function getInvoicePendingAssociationRiskAmount(
  invoices: FinanceInvoiceRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]
) {
  return sumMoney(
    invoices.filter((invoice) => invoice.invoiceStatus === '正常' && getInvoiceMatchStatus(invoice, invoiceBusinessAllocationRows) !== '已匹配'),
    (invoice) => Math.max(0, invoice.taxIncludedAmount - getInvoiceMatchedAmount(invoice, invoiceBusinessAllocationRows))
  );
}

export function getDeclarationPreparationUnbilledIncomeCandidates(
  record: FinanceDeclarationPreparationRecord,
  invoices: FinanceInvoiceRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[] = [],
  allPreparationRecords: FinanceDeclarationPreparationRecord[] = []
): FinanceDeclarationUnbilledIncomeCandidate[] {
  const periodInvoiceIds = new Set(getPreparationPeriodInvoices(record, invoices).map((invoice) => invoice.id));
  const previouslyDeclaredBusinessRecordIds = new Set(
    allPreparationRecords
      .filter(
        (preparation) =>
          preparation.id !== record.id &&
          preparation.taxType === '增值税及附加' &&
          preparation.period < record.period &&
          preparation.status === '已进入税务办理'
      )
      .flatMap((preparation) => (
        preparation.confirmedUnbilledIncomeDeclarations ?? preparation.unbilledIncomeDeclarations ?? []
      ))
      .map((fact) => fact.businessRecordId)
  );

  return getPreparationPeriodReceivables(record, receivablePayableRows)
    .filter((businessRecord) => !previouslyDeclaredBusinessRecordIds.has(businessRecord.id))
    .flatMap((businessRecord): FinanceDeclarationUnbilledIncomeCandidate[] => {
      const allocatedTax = invoiceBusinessAllocationRows
        .filter(
          (allocation) =>
            allocation.status === '有效' &&
            periodInvoiceIds.has(allocation.invoiceId) &&
            allocation.targetType === '应收应付' &&
            allocation.targetId === businessRecord.id
        )
        .reduce(
          (summary, allocation) => ({
            taxAmount: roundMoney(summary.taxAmount + allocation.taxAmount),
            taxExcludedAmount: roundMoney(summary.taxExcludedAmount + allocation.taxExcludedAmount),
            taxIncludedAmount: roundMoney(summary.taxIncludedAmount + allocation.taxIncludedAmount)
          }),
          { taxAmount: 0, taxExcludedAmount: 0, taxIncludedAmount: 0 }
        );
      const taxBasisResolved = isFinanceTaxBasisResolved(businessRecord.taxBasis);
      const taxIncludedAmount = roundMoney(Math.max(0, businessRecord.taxBasis.taxIncludedAmount - allocatedTax.taxIncludedAmount));

      if (taxIncludedAmount <= 0.01) {
        return [];
      }

      const exclusion = record.unbilledIncomeExclusions?.find(
        (item) => item.businessRecordId === businessRecord.id
      );
      const selectedForInclusion = !exclusion;
      const includedInDeclaration = selectedForInclusion && taxBasisResolved;
      const status: FinanceUnbilledIncomeCandidateStatus = exclusion
        ? exclusion.reason
          ? '已排除'
          : '排除待说明'
        : taxBasisResolved
          ? '系统纳入'
          : '待核实';

      return [{
        businessRecord,
        exclusion,
        includedInDeclaration,
        netAmount: taxBasisResolved
          ? roundMoney(Math.max(0, businessRecord.taxBasis.taxExcludedAmount - allocatedTax.taxExcludedAmount))
          : 0,
        obligationBasis: businessRecord.sourceType === '项目阶段确认' ? '项目阶段已确认' : '应收事项已确认',
        obligationDate: businessRecord.confirmDate,
        selectedForInclusion,
        status,
        taxAmount: taxBasisResolved
          ? roundMoney(Math.max(0, businessRecord.taxBasis.taxAmount - allocatedTax.taxAmount))
          : 0,
        taxBasisResolved,
        taxIncludedAmount
      }];
    })
    .sort(
      (left, right) =>
        left.obligationDate.localeCompare(right.obligationDate) ||
        left.businessRecord.documentNo.localeCompare(right.businessRecord.documentNo)
    );
}

function getSourceRecognizedVatAmount(
  record: FinanceDeclarationPreparationRecord,
  invoices: FinanceInvoiceRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]
) {
  const recognizedBusinessVat = sumMoney(
    getPreparationPeriodReceivables(record, receivablePayableRows),
    (businessRecord) => {
      const eligibleInvoiceIds = new Set(
        invoiceBusinessAllocationRows
          .filter(
            (allocation) =>
              allocation.status === '有效' &&
              allocation.targetType === '应收应付' &&
              allocation.targetId === businessRecord.id &&
              allocation.taxIncludedAmount > 0.01
          )
          .map((allocation) => allocation.invoiceId)
      );
      const eligibleInvoices = invoices.filter(
        (invoice) =>
          eligibleInvoiceIds.has(invoice.id) &&
          invoice.accountingPeriod <= businessRecord.accountingPeriod
      );

      return resolveFinanceAccrualTaxBasis(
        businessRecord,
        eligibleInvoices,
        invoiceBusinessAllocationRows
      ).taxAmount;
    }
  );
  const redInvoiceVat = sumMoney(
    getPreparationPeriodInvoices(record, invoices).filter(
      (invoice) => invoice.direction === '销项' && invoice.invoiceStatus === '红冲'
    ),
    (invoice) => invoice.taxAmount
  );

  return roundMoney(recognizedBusinessVat + redInvoiceVat);
}

export function getDeclarationPreparationSubsequentInvoiceCandidates(
  record: FinanceDeclarationPreparationRecord,
  allPreparationRecords: FinanceDeclarationPreparationRecord[],
  invoices: FinanceInvoiceRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[] = []
): FinanceDeclarationSubsequentInvoiceCandidate[] {
  const periodInvoices = getPreparationPeriodInvoices(record, invoices).filter(
    (invoice) => invoice.direction === '销项' && invoice.invoiceStatus === '正常'
  );
  const businessRecordById = new Map(receivablePayableRows.map((businessRecord) => [businessRecord.id, businessRecord]));
  const priorUnbilledFactsByBusinessId = new Map<string, FinanceDeclaredUnbilledIncomeFact>();

  allPreparationRecords
    .filter(
      (preparation) =>
        preparation.taxType === '增值税及附加' &&
        preparation.period < record.period &&
        preparation.status === '已进入税务办理'
    )
    .forEach((preparation) => {
      preparation.unbilledIncomeDeclarations?.forEach((fact) => {
        priorUnbilledFactsByBusinessId.set(fact.businessRecordId, fact);
      });
    });

  return periodInvoices
    .flatMap((invoice): FinanceDeclarationSubsequentInvoiceCandidate[] =>
      invoiceBusinessAllocationRows
        .filter(
          (allocation) =>
            allocation.status === '有效' &&
            allocation.invoiceId === invoice.id &&
            allocation.targetType === '应收应付' &&
            priorUnbilledFactsByBusinessId.has(allocation.targetId)
        )
        .flatMap((allocation) => {
        const businessRecord = businessRecordById.get(allocation.targetId);
        const priorUnbilledFact = priorUnbilledFactsByBusinessId.get(allocation.targetId);

        if (!businessRecord || !priorUnbilledFact) {
          return [];
        }

        return [
          {
            amount: allocation.taxIncludedAmount,
            businessRecord,
            invoice,
            invoiceDeclarationStatus: '后续开票已关联',
            netAmount: allocation.taxExcludedAmount,
            priorVatTreatment: priorUnbilledFact.vatTreatment
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

function buildDeclarationPreparationSourceSnapshotKey(
  record: FinanceDeclarationPreparationRecord,
  periodInvoices: FinanceInvoiceRecord[],
  periodFinanceRows: FinanceTransactionRecord[],
  periodReceivables: FinanceReceivablePayableRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]
) {
  const invoiceSourceKey = periodInvoices
    .map((invoice) => {
      const matchKey = invoiceBusinessAllocationRows
        .filter((allocation) => allocation.invoiceId === invoice.id)
        .map((allocation) => `${allocation.targetType}:${allocation.targetId}:${allocation.taxIncludedAmount}:${allocation.taxExcludedAmount}:${allocation.taxAmount}:${allocation.status}`)
        .sort()
        .join(',');

      return [
        invoice.id,
        invoice.invoiceNo,
        invoice.direction,
        invoice.invoiceStatus,
        invoice.invoiceKind,
        invoice.salesCategory,
        invoice.declarationTreatment,
        invoice.originalInvoiceId ?? '',
        invoice.taxIncludedAmount,
        invoice.taxExcludedAmount,
        invoice.taxRate,
        invoice.taxableClassification,
        invoice.vatTreatment,
        invoice.accountingPeriod,
        matchKey
      ].join(':');
    })
    .sort()
    .join('|');
  const unbilledIncomeBusinessRecordKey = (record.unbilledIncomeDeclarations ?? [])
    .map((fact) => `${fact.businessRecordId}:${fact.netAmount}:${fact.salesCategory}:${fact.vatTreatment}`)
    .sort()
    .join(',');
  const unbilledIncomeExclusionKey = (record.unbilledIncomeExclusions ?? [])
    .map((exclusion) => `${exclusion.businessRecordId}:${exclusion.reason ?? ''}`)
    .sort()
    .join(',');
  const receivableSourceKey = periodReceivables
    .map((businessRecord) => [
      businessRecord.id,
      businessRecord.documentNo,
      businessRecord.accountingPeriod,
      businessRecord.confirmDate,
      businessRecord.confirmationStatus,
      businessRecord.amount,
      businessRecord.taxBasis.basisSource,
      businessRecord.taxBasis.salesCategory,
      businessRecord.taxBasis.taxIncludedAmount,
      businessRecord.taxBasis.taxExcludedAmount,
      businessRecord.taxBasis.taxAmount,
      businessRecord.taxBasis.taxRate,
      businessRecord.taxBasis.taxableClassification ?? '',
      businessRecord.taxBasis.taxOutcome ?? ''
    ].join(':'))
    .sort()
    .join('|');
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
        financeRow.invoiceDeclarationPreparationNo ?? '',
        financeRow.vatDeclarationFact?.taxableClassification ?? '',
        financeRow.vatDeclarationFact?.taxRate ?? '',
        financeRow.vatDeclarationFact?.vatTreatment ?? ''
      ].join(':')
    )
    .sort()
    .join('|');

  return `${record.id}::${record.period}::${invoiceSourceKey}::${receivableSourceKey}::${financeSourceKey}::${unbilledIncomeBusinessRecordKey}::${unbilledIncomeExclusionKey}`;
}

export function applyDeclarationPreparationSourceState(
  records: FinanceDeclarationPreparationRecord[],
  invoices: FinanceInvoiceRecord[],
  financeRows: FinanceTransactionRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[] = [],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[] = [],
  taxMatterRows: FinanceTaxMatterRecord[] = [],
  salaryPaymentRecords: SalaryPaymentRecord[] = [],
  corporateIncomeTaxAccountingSources: Record<string, FinanceCorporateIncomeTaxAccountingSource> = {},
  accountingPeriodLocks: AccountingPeriodLockRecord[] = [],
  customerContracts: CustomerContractRecord[] = customerContractRecords,
  customers: CustomerRecord[] = customerRecords,
  manualStampDutySources: FinanceStampDutySourceRecord[] = financeStampDutyManualSourceRecords,
  stampDutySourceResolutions: FinanceStampDutySourceResolution[] = [],
  capitalBookStampDutySources: FinanceStampDutySourceRecord[] = []
): FinanceDeclarationPreparationRecord[] {
  return records.map((record): FinanceDeclarationPreparationRecord => {
    if (record.taxType === '印花税') {
      if (record.status === '已进入税务办理') {
        return {
          ...record,
          stampDutySources: record.confirmedStampDutySources ?? record.stampDutySources,
          stampDutySummary: record.confirmedStampDutySummary ?? record.stampDutySummary
        };
      }

      const stampDutySources = buildStampDutySourcesForPreparation(
        record,
        customerContracts,
        customers,
        manualStampDutySources,
        stampDutySourceResolutions,
        capitalBookStampDutySources
      );
      const stampDutySummary = buildStampDutyPreparationSummary(stampDutySources);
      const sourceSnapshotKey = buildStampDutySourceSnapshotKey(stampDutySources);
      const sourceChangedAfterConfirmation = Boolean(
        record.confirmedSourceSnapshotKey && record.confirmedSourceSnapshotKey !== sourceSnapshotKey
      );

      return {
        ...record,
        items: createStampDutyItems(record.period, record.id, stampDutySources),
        sourceSnapshotKey,
        stampDutySources,
        stampDutySummary,
        status: sourceChangedAfterConfirmation ? '准备中' : record.status
      };
    }

    if (record.taxType === '个人所得税') {
      if (record.status === '已进入税务办理') {
        return {
          ...record,
          iitEmployeeRows: record.confirmedIitEmployeeRows ?? record.iitEmployeeRows,
          iitSummary: record.confirmedIitSummary ?? record.iitSummary
        };
      }

      const iitSummary = buildPayrollIitDeclarationSummary(
        salaryPaymentRecords,
        record.period,
        financeRows,
        receivablePayableRows
      );
      const iitEmployeeRows = buildPayrollIitDeclarationEmployeeRows(salaryPaymentRecords, record.period, financeRows);
      const sourceSnapshotKey = `${record.id}:${buildPayrollIitDeclarationSourceSnapshotKey(
        salaryPaymentRecords,
        record.period,
        financeRows,
        receivablePayableRows
      )}`;
      const sourceChangedAfterConfirmation = Boolean(
        record.confirmedSourceSnapshotKey && record.confirmedSourceSnapshotKey !== sourceSnapshotKey
      );
      const currentSalaryItem = record.items.find((item) => item.type === '薪酬数据核对');
      const salaryItem: FinanceDeclarationPreparationItem = {
        ...(currentSalaryItem ?? createPayrollIitItems(record.period, record.id)[0]),
        amount: iitSummary.currentIncomeAmount,
        result: iitSummary.readyForConfirmation
          ? `${iitSummary.reportCount} 人自然人付款已核验并计入本期`
          : iitSummary.reportCount > 0
            ? `${iitSummary.pendingCount} 人自然人付款记录待处理`
            : '本期尚无自然人付款记录',
        status: iitSummary.readyForConfirmation ? '已确认' : '待确认',
        updatedAt: financeToday
      };
      return {
        ...record,
        iitEmployeeRows,
        iitSummary,
        items: [salaryItem],
        sourceSnapshotKey,
        status: sourceChangedAfterConfirmation ? '准备中' : record.status
      };
    }

    if (record.taxType === '企业所得税') {
      if (record.status === '已进入税务办理') {
        return {
          ...record,
          citAnnualSettlement: record.confirmedCitAnnualSettlement ?? record.citAnnualSettlement,
          citAnnualSourceReview: record.confirmedCitAnnualSourceReview ?? record.citAnnualSourceReview,
          citQuarterSourceReview: record.confirmedCitQuarterSourceReview ?? record.citQuarterSourceReview,
          citSummary: record.confirmedCitSummary ?? record.citSummary
        };
      }

      const fallbackSummary = record.confirmedCitSummary ?? record.citSummary ?? emptyCitSummary;
      const accountingSource = corporateIncomeTaxAccountingSources[record.period];
      const missingPriorQuarterPeriods = record.declarationScenario === '季度预缴'
        ? getMissingCorporateIncomeTaxPriorQuarterPeriods(record.period, taxMatterRows)
        : [];
      const sourceSummary = accountingSource
        ? {
            ...fallbackSummary,
            ...accountingSource,
            industryRestrictionResult: getActiveFinanceTaxPolicyProfile(
              getDeclarationPreparationAccountingPeriod(record.period) ?? financeToday.slice(0, 7)
            ).corporateIncomeTax.industryRestrictionResult,
            missingPriorQuarterPeriods,
            priorQuarterFilingReady: missingPriorQuarterPeriods.length === 0
          }
        : {
            ...fallbackSummary,
            accountingSourceReady: false,
            missingPriorQuarterPeriods,
            priorQuarterFilingReady: missingPriorQuarterPeriods.length === 0
          };
      const isAnnualSettlement = record.declarationScenario === '年度汇算';
      const annualAdjustments = isAnnualSettlement
        ? record.citAnnualSourceReview?.adjustments ?? []
        : [];
      const quarterlyAdjustments = !isAnnualSettlement
        ? record.citQuarterSourceReview?.adjustments ?? []
        : [];
      const summaryWithReviewedTaxFacts = isAnnualSettlement
        ? {
            ...sourceSummary,
            priorLossDeductionAmount: record.citAnnualSourceReview?.priorLossDeductionAmount ?? 0,
            taxAdjustmentDecreaseAmount: annualAdjustments
              .filter((adjustment) => adjustment.direction === '调减')
              .reduce((total, adjustment) => roundMoney(total + adjustment.adjustmentAmount), 0),
            taxAdjustmentIncreaseAmount: annualAdjustments
              .filter((adjustment) => adjustment.direction === '调增')
              .reduce((total, adjustment) => roundMoney(total + adjustment.adjustmentAmount), 0)
          }
        : {
            ...sourceSummary,
            priorLossDeductionAmount: record.citQuarterSourceReview?.priorLossDeductionAmount ?? 0,
            taxAdjustmentDecreaseAmount: quarterlyAdjustments
              .filter((adjustment) => adjustment.direction === '调减')
              .reduce((total, adjustment) => roundMoney(total + adjustment.adjustmentAmount), 0),
            taxAdjustmentIncreaseAmount: quarterlyAdjustments
              .filter((adjustment) => adjustment.direction === '调增')
              .reduce((total, adjustment) => roundMoney(total + adjustment.adjustmentAmount), 0),
            taxCreditAmount: record.citQuarterSourceReview?.taxCreditAmount ?? 0
          };
      const citSummary = recalculateCorporateIncomeTaxSummary(
        summaryWithReviewedTaxFacts,
        getCorporateIncomeTaxPaidYearToDate(record, taxMatterRows, summaryWithReviewedTaxFacts.taxPaidYearToDateAmount)
      );
      const citAnnualSettlement = isAnnualSettlement
        ? buildCorporateIncomeTaxAnnualSettlement({
            accountingPeriodLocks,
            period: record.period,
            sourceReview: record.citAnnualSourceReview,
            taxMatterRows
          })
        : undefined;
      const sourceSnapshotKey = [
        record.id,
        record.period,
        citSummary.reportingBasis,
        citSummary.accountingSourceReady,
        citSummary.coveredAccountingPeriods.join(','),
        citSummary.unclosedAccountingPeriods.join(','),
        citSummary.unbookedVoucherCount,
        citSummary.priorQuarterFilingReady,
        citSummary.missingPriorQuarterPeriods.join(','),
        citSummary.cumulativeOperatingRevenueAmount,
        citSummary.cumulativeOperatingCostAmount,
        citSummary.cumulativeSalesExpenseAmount,
        citSummary.cumulativeOtherIncomeAmount,
        citSummary.cumulativeProfitBeforeTaxAmount,
        citSummary.cumulativeTaxableIncomeAmount,
        citSummary.taxAdjustmentIncreaseAmount,
        citSummary.taxAdjustmentDecreaseAmount,
        citSummary.priorLossDeductionAmount,
        citSummary.smallLowProfitEligible,
        citSummary.averageEmployeeCount,
        citSummary.averageAssetAmount,
        citSummary.industryRestrictionResult,
        citSummary.effectiveTaxRate,
        citSummary.cumulativeIncomeTaxPayableAmount,
        citSummary.taxPaidYearToDateAmount,
        citSummary.currentPeriodPayableAmount,
        citSummary.overpaidTaxAmount,
        citAnnualSettlement?.yearEndClosed ?? '',
        citAnnualSettlement?.annualFinancialStatementsReady ?? '',
        citAnnualSettlement?.q4PrepaymentReady ?? '',
        citAnnualSettlement?.adjustmentSourceReady ?? '',
        citAnnualSettlement?.priorLossSourceReady ?? '',
        record.citAnnualSourceReview?.priorLossDeductionAmount ?? '',
        record.citAnnualSourceReview?.priorLossSourceNo ?? '',
        citAnnualSettlement?.adjustments.map((adjustment) => `${adjustment.id}:${adjustment.adjustmentAmount}:${adjustment.status}`).join('|') ?? '',
        record.citQuarterSourceReview?.adjustmentReviewCompleted ?? '',
        record.citQuarterSourceReview?.priorLossReviewCompleted ?? '',
        record.citQuarterSourceReview?.priorLossSourceNo ?? '',
        record.citQuarterSourceReview?.taxCreditReviewCompleted ?? '',
        record.citQuarterSourceReview?.taxCreditSourceNo ?? '',
        record.citQuarterSourceReview?.adjustments.map((adjustment) => `${adjustment.id}:${adjustment.adjustmentAmount}:${adjustment.status}:${adjustment.sourceNo}`).join('|') ?? ''
      ].join(':');
      const sourceChangedAfterConfirmation = Boolean(
        record.confirmedSourceSnapshotKey && record.confirmedSourceSnapshotKey !== sourceSnapshotKey
      );
      const generatedItems = citAnnualSettlement
        ? createCorporateIncomeTaxAnnualItems(record.period, record.id, citSummary, citAnnualSettlement)
        : createCorporateIncomeTaxItems(record.period, record.id, citSummary, record.citQuarterSourceReview);
      const items = generatedItems.map((generatedItem): FinanceDeclarationPreparationItem => {
        const currentItem = record.items.find((item) => item.type === generatedItem.type);

        if (!currentItem) {
          return generatedItem;
        }

        return {
          ...generatedItem,
          id: currentItem.id
        };
      });

      return {
        ...record,
        citAnnualSettlement,
        citSummary,
        items,
        sourceSnapshotKey,
        status: sourceChangedAfterConfirmation ? '准备中' : record.status
      };
    }

    if (record.taxType !== '增值税及附加') {
      return record;
    }

    const periodInvoices = getPreparationPeriodInvoices(record, invoices);
    const periodFinanceRows = getPreparationPeriodFinanceRows(record, financeRows);
    const periodReceivables = getPreparationPeriodReceivables(record, receivablePayableRows);
    const accountingPeriod = getDeclarationPreparationAccountingPeriod(record.period) ?? financeToday.slice(0, 7);
    const vatDeclarationPolicy = getActiveFinanceTaxPolicyProfile(accountingPeriod).vatDeclaration;
    const exemptionThreshold = getFinanceVatExemptionThreshold(vatDeclarationPolicy);
    const sourceSnapshotKey = buildDeclarationPreparationSourceSnapshotKey(
      record,
      periodInvoices,
      periodFinanceRows,
      periodReceivables,
      invoiceBusinessAllocationRows
    );
    const sourceChangedAfterConfirmation = Boolean(
      record.confirmedSourceSnapshotKey && record.confirmedSourceSnapshotKey !== sourceSnapshotKey
    );

    // Once filing has entered the external tax-handling record, its confirmed
    // result is historical evidence. Later local source changes must create a
    // correction flow rather than silently reset the archived preparation.
    if (record.status === '已进入税务办理' || (record.status !== '准备中' && !sourceChangedAfterConfirmation)) {
      return {
        ...record,
        sourceSnapshotKey,
        unbilledIncomeDeclarations:
          record.confirmedUnbilledIncomeDeclarations ?? record.unbilledIncomeDeclarations,
        vatSummary: record.confirmedVatSummary ?? record.vatSummary
      };
    }

    const outputBlueInvoices = periodInvoices.filter(
      (invoice) =>
        invoice.direction === '销项' &&
        invoice.invoiceStatus === '正常' &&
        (invoice.declarationTreatment === '本期申报' || invoice.declarationTreatment === '前期未开票冲抵')
    );
    const redInvoices = periodInvoices.filter((invoice) => invoice.direction === '销项' && invoice.invoiceStatus === '红冲');
    const unlinkedRedInvoices = redInvoices.filter((invoice) => getRedInvoiceOriginalAssociationStatus(invoice) === '待关联原票');
    const pendingInvoiceAssociationRiskAmount = getInvoicePendingAssociationRiskAmount(periodInvoices, invoiceBusinessAllocationRows);
    const pendingReviewRows = periodFinanceRows.filter((financeRow) => financeRow.status !== '已入账' && isTransactionInvoiceAssociationRequired(financeRow));
    const unbilledIncomeCandidates = getDeclarationPreparationUnbilledIncomeCandidates(
      record,
      invoices,
      receivablePayableRows,
      invoiceBusinessAllocationRows,
      records
    );
    const subsequentInvoiceCandidates = getDeclarationPreparationSubsequentInvoiceCandidates(
      record,
      records,
      invoices,
      receivablePayableRows,
      invoiceBusinessAllocationRows
    );
    const selectedUnbilledIncomeRows = unbilledIncomeCandidates.filter((candidate) => candidate.includedInDeclaration);
    const pendingUnbilledIncomeRows = unbilledIncomeCandidates.filter(
      (candidate) => candidate.status === '待核实' || candidate.status === '排除待说明'
    );
    const excludedUnbilledIncomeRows = unbilledIncomeCandidates.filter((candidate) => candidate.status === '已排除');
    const pendingSubsequentInvoiceRows = subsequentInvoiceCandidates.filter(
      (candidate) => candidate.invoiceDeclarationStatus !== '后续开票已关联'
    );
    const confirmedSubsequentInvoiceRows = subsequentInvoiceCandidates.filter(
      (candidate) => candidate.invoiceDeclarationStatus === '后续开票已关联'
    );
    const outputBlueNetAmount = sumMoney(outputBlueInvoices, getInvoiceTaxExcludedAmount);
    const outputBlueTaxIncludedAmount = sumMoney(outputBlueInvoices, getInvoiceAmount);
    const redInvoiceNetAmount = sumMoney(redInvoices, getInvoiceTaxExcludedAmount);
    const selectedUnbilledNetAmount = sumMoney(selectedUnbilledIncomeRows, (candidate) => candidate.netAmount);
    const subsequentInvoiceNetAmount = sumMoney(subsequentInvoiceCandidates, (candidate) => candidate.netAmount);
    const confirmedSubsequentInvoiceNetAmount = sumMoney(confirmedSubsequentInvoiceRows, (candidate) => candidate.netAmount);
    const hasPendingUnbilledIncome = pendingUnbilledIncomeRows.length > 0;
    const hasPendingSubsequentInvoice = pendingSubsequentInvoiceRows.length > 0;
    const declaredNetSalesAmount = roundMoney(outputBlueNetAmount + redInvoiceNetAmount + selectedUnbilledNetAmount - confirmedSubsequentInvoiceNetAmount);
    const taxableSalesAmount = Math.max(0, declaredNetSalesAmount);
    const declaredInvoiceRows = [...outputBlueInvoices, ...redInvoices];
    const invoiceTreatmentAmounts = declaredInvoiceRows.reduce((amounts, invoice) => {
      addVatTreatmentAmount(amounts, getInvoiceVatTreatment(invoice), getInvoiceTaxExcludedAmount(invoice));
      return amounts;
    }, createVatTreatmentAmounts());
    const invoiceThresholdEligibleSalesAmount = sumMoney(
      declaredInvoiceRows.filter((invoice) => invoice.taxableClassification !== '免税交易' && invoice.taxableClassification !== '不征税'),
      getInvoiceTaxExcludedAmount
    );
    const unbilledThresholdEligibleSalesAmount = sumMoney(
      selectedUnbilledIncomeRows.filter(
        (candidate) => {
          const classification = candidate.businessRecord.taxBasis.taxableClassification ?? '普通应税交易';
          return classification !== '免税交易' && classification !== '不征税';
        }
      ),
      (candidate) => candidate.netAmount
    );
    // The threshold is judged against this period's applicable taxable sales.
    // A special invoice is still taxed by its invoice fact, but cannot be hidden
    // from the period sales base when the taxpayer waives a benefit partially.
    const exemptionEligibleSalesAmount = roundMoney(invoiceThresholdEligibleSalesAmount + unbilledThresholdEligibleSalesAmount);
    const unbilledVatFacts = selectedUnbilledIncomeRows.map((candidate) => {
      const taxableClassification = candidate.businessRecord.taxBasis.taxableClassification ?? '普通应税交易';
      const configuredTreatment = candidate.businessRecord.taxBasis.taxOutcome;
      const resolvedTreatment =
        !configuredTreatment || configuredTreatment === '待申报判定' || configuredTreatment === '混合口径'
          ? getFinanceVatDeclarationOutcome({
              accountingPeriod,
              taxableClassification,
              taxableSalesAmount: exemptionEligibleSalesAmount
            })
          : configuredTreatment;
      const treatment: FinanceVatInvoiceTreatment =
        resolvedTreatment === '待申报判定' || resolvedTreatment === '混合口径'
          ? '不涉及'
          : resolvedTreatment;

      return {
        amount: candidate.netAmount,
        taxRate: getFinanceVatOutcomeRate(treatment, accountingPeriod),
        taxableClassification,
        treatment
      };
    });
    const treatmentAmounts = unbilledVatFacts.reduce((amounts, fact) => {
      addVatTreatmentAmount(amounts, fact.treatment, fact.amount);
      return amounts;
    }, invoiceTreatmentAmounts);
    confirmedSubsequentInvoiceRows.forEach((candidate) => {
      if (candidate.priorVatTreatment) {
        addVatTreatmentAmount(treatmentAmounts, candidate.priorVatTreatment, -candidate.netAmount);
      }
    });
    const taxOutcome = getVatTreatmentSummaryOutcome(treatmentAmounts);
    const appliedTaxRate = taxOutcome === '混合口径' ? '按票面分项' : getFinanceVatOutcomeRate(taxOutcome, accountingPeriod);
    const legalLevyRate = parseFinanceTaxRate(vatDeclarationPolicy.legalLevyRate);
    const taxRelevantSalesAmount = roundMoney(
      treatmentAmounts['免税'] + treatmentAmounts['减按1%'] + treatmentAmounts['按法定征收率']
    );
    const estimatedVatBeforeExemption = roundMoney(taxRelevantSalesAmount * legalLevyRate);
    const isBelowExemptionThreshold = exemptionEligibleSalesAmount <= exemptionThreshold;
    const invoiceVatAmount = sumMoney(declaredInvoiceRows, (invoice) => invoice.taxAmount);
    const unbilledVatAmount = sumMoney(unbilledVatFacts, (fact) => fact.amount * parseFinanceTaxRate(fact.taxRate));
    const estimatedVatAfterExemption = roundMoney(invoiceVatAmount + unbilledVatAmount);
    const surchargeBreakdown = getFinanceVatSurchargeSummary({
      accountingPeriod,
      qualifiesForMicroTaxFeeReduction: vatDeclarationPolicy.surchargePolicy.taxFeeReductionEligibility === '符合',
      vatPayableAmount: estimatedVatAfterExemption
    });
    const estimatedSurcharge = surchargeBreakdown.totalAfterReduction;
    const estimatedTotalTaxAmount = roundMoney(estimatedVatAfterExemption + estimatedSurcharge);
    const goodsLaborSalesAmount = roundMoney(
      sumMoney(declaredInvoiceRows.filter((invoice) => invoice.salesCategory === '货物及劳务'), getInvoiceTaxExcludedAmount) +
      sumMoney(selectedUnbilledIncomeRows.filter((candidate) => candidate.businessRecord.taxBasis.salesCategory === '货物及劳务'), (candidate) => candidate.netAmount) -
      sumMoney(confirmedSubsequentInvoiceRows.filter((candidate) => candidate.businessRecord.taxBasis.salesCategory === '货物及劳务'), (candidate) => candidate.netAmount)
    );
    const serviceSalesAmount = roundMoney(declaredNetSalesAmount - goodsLaborSalesAmount);
    const specialInvoiceSalesAmount = sumMoney(
      declaredInvoiceRows.filter((invoice) => invoice.invoiceKind === '专用发票'),
      getInvoiceTaxExcludedAmount
    );
    const hasSourcePendingItem =
      unlinkedRedInvoices.length > 0 ||
      hasPendingSubsequentInvoice ||
      hasPendingUnbilledIncome;

    const items: FinanceDeclarationPreparationItem[] = record.items.map((item): FinanceDeclarationPreparationItem => {
      if (item.type === '销项发票核对') {
        return {
          ...item,
          amount: outputBlueNetAmount,
          result: outputBlueInvoices.length > 0 ? `${record.period} 销项蓝票已导入` : '本期无销项蓝票',
          status: outputBlueInvoices.length > 0 ? '已确认' : '无需确认'
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
              ? `${pendingSubsequentInvoiceRows.length} 张后续开票关联未完成`
              : `${confirmedSubsequentInvoiceRows.length} 张后续开票已自动冲抵`,
          status: pendingSubsequentInvoiceRows.length > 0 ? '待确认' : '已确认'
        };
      }

      if (item.type === '未开票收入核对') {
        if (unbilledIncomeCandidates.length === 0) {
          return {
            ...item,
            amount: 0,
            result: '本期无未开票应税事项',
            status: '无需确认'
          };
        }

        return {
          ...item,
          amount: selectedUnbilledNetAmount,
          result: pendingUnbilledIncomeRows.length > 0
            ? `${pendingUnbilledIncomeRows.length} 条未开票事项待核实`
            : excludedUnbilledIncomeRows.length > 0
              ? `${selectedUnbilledIncomeRows.length} 条已计入，${excludedUnbilledIncomeRows.length} 条已说明排除`
              : `${selectedUnbilledIncomeRows.length} 条未开票应税事项已自动计入本期`,
          status: pendingUnbilledIncomeRows.length > 0 ? '待确认' : '已确认'
        };
      }

      if (item.type === '申报测算') {
        return {
          ...item,
          amount: declaredNetSalesAmount,
          result: hasSourcePendingItem
            ? '来源检查未完成，当前测算结果不可确认'
            : taxOutcome === '免税'
              ? `符合${vatDeclarationPolicy.filingCycle}${exemptionThreshold.toLocaleString('zh-CN')}元以下免税测算口径`
              : `按${taxOutcome}口径完成测算`,
          status: '无需确认'
        };
      }

      return item;
    });

    return {
      ...record,
      unbilledIncomeDeclarations: unbilledVatFacts.map((fact, index) => ({
        businessRecordId: selectedUnbilledIncomeRows[index].businessRecord.id,
        netAmount: fact.amount,
        salesCategory: selectedUnbilledIncomeRows[index].businessRecord.taxBasis.salesCategory,
        vatTreatment: fact.treatment
      })),
      unbilledIncomeBusinessRecordIds: selectedUnbilledIncomeRows.map((candidate) => candidate.businessRecord.id),
      sourceSnapshotKey,
      status: sourceChangedAfterConfirmation ? '准备中' : record.status,
      vatSummary: {
        appliedTaxRate,
        declaredNetSalesAmount,
        exemptionEligibleSalesAmount,
        exemptSalesAmount: treatmentAmounts['免税'],
        estimatedSurcharge,
        estimatedTotalTaxAmount,
        estimatedVatAfterExemption,
        estimatedVatBeforeExemption,
        filingCycle: vatDeclarationPolicy.filingCycle,
        goodsLaborSalesAmount,
        isBelowExemptionThreshold,
        legalRateSalesAmount: treatmentAmounts['按法定征收率'],
        nonTaxableSalesAmount: treatmentAmounts['不涉及'],
        outputBlueNetAmount,
        outputBlueTaxIncludedAmount,
        otherInvoiceAndUnbilledSalesAmount: roundMoney(declaredNetSalesAmount - specialInvoiceSalesAmount),
        priorUnbilledOffsetNetAmount: confirmedSubsequentInvoiceNetAmount,
        exemptionThreshold,
        redInvoiceNetAmount,
        riskInvoiceCashflowAmount: pendingInvoiceAssociationRiskAmount,
        riskUnreviewedCashflowAmount: sumMoney(pendingReviewRows, (financeRow) => financeRow.amount),
        reducedRateSalesAmount: treatmentAmounts['减按1%'],
        specialInvoiceSalesAmount,
        serviceSalesAmount,
        sourceRecognizedVatAmount: getSourceRecognizedVatAmount(
          record,
          invoices,
          receivablePayableRows,
          invoiceBusinessAllocationRows
        ),
        surchargeBreakdown,
        taxOutcome,
        taxableSalesAmount,
        unbilledIncomeNetAmount: selectedUnbilledNetAmount
      },
      items
    };
  });
}
