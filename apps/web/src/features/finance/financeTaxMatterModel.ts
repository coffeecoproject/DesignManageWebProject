import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type { PublicAccountRef } from '../system/PublicAccountConfigState';
import {
  getFinanceCategorySnapshot,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig,
  type FinanceTaxPaymentAllocation,
  type FinanceTransactionRecord
} from './financeData';
import type { SocialInsuranceCategory, SocialInsuranceEmployeeRecord } from './financeSocialInsuranceData';
import {
  getDeclarationPreparationProgress,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import type {
  FinanceTaxDeclarationVerificationStatus,
  FinanceTaxMatterDeclarationStatus,
  FinanceTaxMatterAccountingStatus,
  FinanceTaxMatterDataStatus,
  FinanceTaxMatterEvidenceStatus,
  FinanceTaxMatterProcessStatus,
  FinanceTaxMatterRecord,
  FinanceTaxMatterSettlementDirection,
  FinanceTaxMatterSourceItem,
  FinanceTaxMatterType,
  FinanceVatOfficialSettlementBreakdown
} from './financeTaxFilingData';
import { getFinanceVatSurchargeSummary } from './financeTaxPolicyModel';
import { financeToday, getAccountingPeriodFromBusinessPeriod, getDefaultFinanceReviewDueAt } from './financeUtils';

export type SocialInsuranceTaxMatterSummary = {
  category: SocialInsuranceCategory;
  companyAmount: number;
  confirmedCount: number;
  exceptionCount: number;
  participantSummary: string;
  pendingCount: number;
  period: string;
  personalAmount: number;
  recordCount: number;
  readyForHandling: boolean;
  sourceStatus: FinanceTaxMatterDataStatus;
  totalAmount: number;
};

export type TaxMatterReceiptFileType = '正式申报表' | '申报结果回执' | '缴款回单' | '退抵申请回执' | '退税申请回执' | '退税回单' | '抵缴确认单';

export type TaxMatterDeclarationResultInput = {
  declarationDate: string;
  declarationFormFiles?: RelatedFileRecord[];
  declarationResultFile?: RelatedFileRecord;
  declarationVerificationNote?: string;
  declarationVerificationStatus?: FinanceTaxDeclarationVerificationStatus;
  taxAuthorityAssessmentVoucherNo?: string;
  taxAuthorityDeclarationNo?: string;
  declarationStatus: Extract<FinanceTaxMatterDeclarationStatus, '申报成功' | '零申报'>;
  differenceReason?: string;
  settlementAmount: number;
  settlementDirection: Exclude<FinanceTaxMatterSettlementDirection, '待确定'>;
  vatBreakdown?: FinanceVatOfficialSettlementBreakdown;
};

export type TaxMatterDeclarationRevisionContext = {
  historyId?: string;
  operatedAt?: string;
  operatedBy?: string;
  operationId?: string;
};

function getLatestEffectiveDeclarationHistory(
  declarationHistory: FinanceTaxMatterRecord['declarationHistory']
) {
  return [...declarationHistory].reverse().find((record) => record.action !== '作废');
}

export function getTaxMatterDeclarationResultValidationError(
  record: Pick<FinanceTaxMatterRecord, 'declarationHistory' | 'declarationVersion' | 'matterType' | 'preparedPayableAmount' | 'preparedRefundableAmount' | 'preparedSettlementDirection'>,
  input: Pick<
    TaxMatterDeclarationResultInput,
    | 'declarationFormFiles'
    | 'declarationResultFile'
    | 'declarationStatus'
    | 'declarationVerificationNote'
    | 'declarationVerificationStatus'
    | 'differenceReason'
    | 'settlementAmount'
    | 'settlementDirection'
    | 'vatBreakdown'
  >
) {
  if (
    input.declarationVerificationStatus === '人工核验一致'
    && (!input.declarationFormFiles?.length || !input.declarationResultFile)
  ) {
    return '正式申报表和申报结果回执齐全后才能标记核验一致';
  }

  if (input.declarationVerificationStatus === '核验不一致' && !input.declarationVerificationNote?.trim()) {
    return '请填写核验不一致原因';
  }

  if (record.matterType === '增值税及附加') {
    if (input.declarationStatus === '零申报') {
      return input.settlementDirection === '无需补退' && roundMoney(input.settlementAmount) === 0
        ? undefined
        : '零申报不应产生增值税及附加税额';
    }

    if (!input.vatBreakdown) {
      return '请按增值税、城建税及两项教育附加登记申报结果';
    }

    const versionSettlement = getVatDeclarationVersionSettlement(record, input.vatBreakdown);

    return input.settlementDirection === versionSettlement.direction
      && Math.abs(versionSettlement.amount - roundMoney(input.settlementAmount)) <= 0.01
      ? undefined
      : '增值税及附加的补退差额与前后版本不一致';
  }

  if (record.matterType === '印花税') {
    const expectedAmount = roundMoney(record.preparedPayableAmount);
    const actualAmount = input.settlementDirection === '无需补退' ? 0 : roundMoney(input.settlementAmount);

    if (expectedAmount <= 0.005) {
      return input.declarationStatus === '零申报' && input.settlementDirection === '无需补退' && actualAmount === 0
        ? undefined
        : '印花税无应缴金额时应登记为零申报';
    }

    if (input.declarationStatus !== '申报成功') {
      return '存在应纳印花税时不能登记为零申报';
    }

    return record.declarationVersion > 1
      ? undefined
      : Math.abs(actualAmount - expectedAmount) <= 0.01 || input.differenceReason?.trim()
      ? undefined
      : '印花税申报金额与准备结果不一致，请填写差异原因';
  }

  if (record.matterType === '企业所得税') {
    if (record.declarationVersion > 1) {
      return undefined;
    }

    const expectedDirection = record.preparedSettlementDirection ?? (
      (record.preparedRefundableAmount ?? 0) > 0
        ? '应退'
        : record.preparedPayableAmount > 0
          ? '应缴'
          : '无需补退'
    );
    const expectedAmount = expectedDirection === '应退'
      ? roundMoney(record.preparedRefundableAmount ?? 0)
      : expectedDirection === '应缴'
        ? roundMoney(record.preparedPayableAmount)
        : 0;
    const actualAmount = input.settlementDirection === '无需补退' ? 0 : roundMoney(input.settlementAmount);

    return input.settlementDirection === expectedDirection && Math.abs(actualAmount - expectedAmount) <= 0.01
      ? undefined
      : input.differenceReason?.trim()
        ? undefined
        : '企业所得税申报补退结果与准备结果不一致，请填写差异原因';
  }

  if (record.matterType !== '个人所得税') {
    return undefined;
  }

  const expectedAmount = roundMoney(record.preparedPayableAmount);
  const actualAmount = input.settlementDirection === '应缴' ? roundMoney(input.settlementAmount) : 0;

  if (expectedAmount <= 0.005) {
    return input.declarationStatus === '零申报' && input.settlementDirection === '无需补退' && actualAmount === 0
      ? undefined
      : '个人所得税无应缴金额时应登记为零申报';
  }

  if (input.declarationStatus !== '申报成功' || input.settlementDirection !== '应缴') {
    return '个人所得税申报结果应与已确认的人员明细一致';
  }

  return Math.abs(actualAmount - expectedAmount) <= 0.01
    ? undefined
    : '个人所得税申报金额与人员明细不一致，请先更正工资或劳务来源';
}

function buildOfficialVatSettlement(
  record: FinanceTaxMatterRecord,
  breakdown: FinanceVatOfficialSettlementBreakdown
) {
  const sourceSettlement = record.vatSettlement;

  if (!sourceSettlement) {
    return undefined;
  }

  const policySurcharge = getFinanceVatSurchargeSummary({
    accountingPeriod: getAccountingPeriodFromBusinessPeriod(record.period) ?? financeToday.slice(0, 7),
    qualifiesForMicroTaxFeeReduction: sourceSettlement.surcharge.reductionAmount > 0,
    vatPayableAmount: breakdown.declaredVatAmount
  });
  const surcharge = {
    ...policySurcharge,
    educationSurchargeAfterReduction: breakdown.educationSurchargeAmount,
    educationSurchargeReduction: roundMoney(
      policySurcharge.educationSurchargeBeforeReduction - breakdown.educationSurchargeAmount
    ),
    localEducationSurchargeAfterReduction: breakdown.localEducationSurchargeAmount,
    localEducationSurchargeReduction: roundMoney(
      policySurcharge.localEducationSurchargeBeforeReduction - breakdown.localEducationSurchargeAmount
    ),
    reductionAmount: roundMoney(
      policySurcharge.totalBeforeReduction -
      breakdown.urbanMaintenanceTaxAmount -
      breakdown.educationSurchargeAmount -
      breakdown.localEducationSurchargeAmount
    ),
    totalAfterReduction: roundMoney(
      breakdown.urbanMaintenanceTaxAmount +
      breakdown.educationSurchargeAmount +
      breakdown.localEducationSurchargeAmount
    ),
    urbanMaintenanceTaxAfterReduction: breakdown.urbanMaintenanceTaxAmount,
    urbanMaintenanceTaxReduction: roundMoney(
      policySurcharge.urbanMaintenanceTaxBeforeReduction - breakdown.urbanMaintenanceTaxAmount
    )
  };

  return {
    ...sourceSettlement,
    declaredVatAmount: breakdown.declaredVatAmount,
    officialBreakdown: breakdown,
    surcharge,
    totalPayableAmount: roundMoney(breakdown.declaredVatAmount + surcharge.totalAfterReduction)
  };
}

export function getVatDeclarationVersionSettlement(
  record: Pick<FinanceTaxMatterRecord, 'declarationHistory' | 'declarationVersion'>,
  breakdown: FinanceVatOfficialSettlementBreakdown
): { amount: number; direction: Exclude<FinanceTaxMatterSettlementDirection, '待确定'>; officialTotalAmount: number } {
  const officialTotalAmount = roundMoney(
    breakdown.declaredVatAmount
      + breakdown.urbanMaintenanceTaxAmount
      + breakdown.educationSurchargeAmount
      + breakdown.localEducationSurchargeAmount
  );
  const priorOfficialTotalAmount = record.declarationVersion > 1
    ? roundMoney(getLatestEffectiveDeclarationHistory(record.declarationHistory)?.filedVatSettlement?.totalPayableAmount ?? 0)
    : 0;
  const versionDifference = roundMoney(officialTotalAmount - priorOfficialTotalAmount);

  return versionDifference > 0.005
    ? { amount: versionDifference, direction: '应缴', officialTotalAmount }
    : versionDifference < -0.005
      ? { amount: Math.abs(versionDifference), direction: '应退', officialTotalAmount }
      : { amount: 0, direction: '无需补退', officialTotalAmount };
}

export type TaxMatterDeclarationEvidenceInput = {
  declarationFormFiles: RelatedFileRecord[];
  declarationResultFile?: RelatedFileRecord;
  declarationVerificationNote?: string;
  declarationVerificationStatus: FinanceTaxDeclarationVerificationStatus;
  taxAuthorityAssessmentVoucherNo?: string;
  taxAuthorityDeclarationNo?: string;
};

export type TaxMatterPaymentResultInput = {
  amount: number;
  paymentDate: string;
  receiptFile: RelatedFileRecord;
};

export type TaxMatterRefundResultInput = {
  amount: number;
  receiptFile: RelatedFileRecord;
  refundDate: string;
};

export type TaxMatterRefundApplicationInput = {
  applicationDate: string;
  method: '退税' | '抵缴';
  receiptFile?: RelatedFileRecord;
  receiptNo?: string;
  targetMatterId?: string;
};

export type TaxMatterOffsetResultInput = {
  amount: number;
  offsetDate: string;
  receiptFile?: RelatedFileRecord;
  receiptNo?: string;
};

type TaxMatterReceiptRequirementSource = Pick<
  FinanceTaxMatterRecord,
  'declarationStatus' | 'matterType' | 'paymentStatus'
>;

const socialTaxMatterCategoryMap: Partial<Record<FinanceTaxMatterType, SocialInsuranceCategory>> = {
  社保缴纳: '社保',
  公积金缴纳: '公积金'
};

const socialTaxMatterSourceConfig: Record<
  SocialInsuranceCategory,
  {
    confirmationName: string;
    verificationName: string;
    verificationModule: string;
  }
> = {
  公积金: {
    confirmationName: '公积金缴费明细',
    verificationModule: '公积金系统',
    verificationName: '公积金汇缴核定单'
  },
  社保: {
    confirmationName: '社保缴费明细',
    verificationModule: '电子税务局',
    verificationName: '社保缴费核定单'
  }
};

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function getSocialInsuranceCategoryByTaxMatterType(matterType: FinanceTaxMatterType) {
  return socialTaxMatterCategoryMap[matterType];
}

export function isSocialInsuranceTaxMatter(matterType: FinanceTaxMatterType) {
  return Boolean(getSocialInsuranceCategoryByTaxMatterType(matterType));
}

export function getTaxMatterRequiredReceiptTypes(record: TaxMatterReceiptRequirementSource): TaxMatterReceiptFileType[] {
  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return ['缴款回单'];
  }

  if (record.declarationStatus === '待申报' || record.declarationStatus === '无申报义务') {
    return [];
  }

  return [
    '正式申报表',
    '申报结果回执',
    ...(['部分缴纳', '已缴纳'].includes(record.paymentStatus) ? ['缴款回单' as const] : [])
  ];
}

export function getTaxMatterOutstandingAmount(
  record: Pick<FinanceTaxMatterRecord, 'offsetReceivedAmount' | 'offsetReceivedBaselineAmount' | 'paidAmount' | 'payableAmount' | 'paymentBaselineAmount'>
) {
  return roundMoney(Math.max(
    0,
    record.payableAmount
      - getTaxMatterCurrentVersionPaidAmount(record)
      - getTaxMatterCurrentVersionOffsetReceivedAmount(record)
  ));
}

export function getTaxMatterCurrentVersionPaidAmount(
  record: Pick<FinanceTaxMatterRecord, 'paidAmount' | 'paymentBaselineAmount'>
) {
  return roundMoney(Math.max(0, record.paidAmount - (record.paymentBaselineAmount ?? 0)));
}

export function getTaxMatterCurrentVersionOffsetReceivedAmount(
  record: Pick<FinanceTaxMatterRecord, 'offsetReceivedAmount' | 'offsetReceivedBaselineAmount'>
) {
  return roundMoney(Math.max(
    0,
    (record.offsetReceivedAmount ?? 0) - (record.offsetReceivedBaselineAmount ?? 0)
  ));
}

export function getTaxMatterRefundOutstandingAmount(
  record: Pick<FinanceTaxMatterRecord, 'offsetAmount' | 'offsetBaselineAmount' | 'refundableAmount' | 'refundBaselineAmount' | 'refundedAmount'>
) {
  return roundMoney(Math.max(
    0,
    (record.refundableAmount ?? 0)
      - getTaxMatterCurrentVersionRefundedAmount(record)
      - getTaxMatterCurrentVersionOffsetAmount(record)
  ));
}

export function getTaxMatterCurrentVersionRefundedAmount(
  record: Pick<FinanceTaxMatterRecord, 'refundBaselineAmount' | 'refundedAmount'>
) {
  return roundMoney(Math.max(0, (record.refundedAmount ?? 0) - (record.refundBaselineAmount ?? 0)));
}

export function getTaxMatterCurrentVersionOffsetAmount(
  record: Pick<FinanceTaxMatterRecord, 'offsetAmount' | 'offsetBaselineAmount'>
) {
  return roundMoney(Math.max(0, (record.offsetAmount ?? 0) - (record.offsetBaselineAmount ?? 0)));
}

export function getTaxMatterAccountingAmount(
  record: Pick<
    FinanceTaxMatterRecord,
    'filedAccountingAmount' | 'matterType' | 'payableAmount' | 'refundableAmount' | 'socialInsuranceSettlement' | 'vatSettlement'
  >
) {
  if (record.matterType === '增值税及附加') {
    const settlement = record.vatSettlement;

    if (!settlement) {
      return 0;
    }

    return roundMoney(
      settlement.declaredVatAmount -
      settlement.sourceRecognizedVatAmount +
      settlement.surcharge.totalAfterReduction
    );
  }

  if (record.matterType === '个人所得税') {
    return 0;
  }

  if (
    (record.matterType === '企业所得税' || record.matterType === '印花税')
    && record.filedAccountingAmount !== undefined
  ) {
    return roundMoney(record.filedAccountingAmount);
  }

  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return roundMoney(record.socialInsuranceSettlement?.companyAmount ?? 0);
  }

  return roundMoney(record.payableAmount - (record.refundableAmount ?? 0));
}

export function getTaxMatterAccountingDelta(record: FinanceTaxMatterRecord) {
  const currentAmount = getTaxMatterAccountingAmount(record);
  const previousVersion = getLatestEffectiveDeclarationHistory(record.declarationHistory);

  if (!previousVersion) {
    return currentAmount;
  }

  return roundMoney(currentAmount - (previousVersion.filedAccountingAmount ?? previousVersion.filedPayableAmount));
}

export function getTaxMatterAccountingReceiptTypes(
  record: Pick<FinanceTaxMatterRecord, 'declarationStatus' | 'matterType'>
): TaxMatterReceiptFileType[] {
  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return [];
  }

  return ['申报成功', '零申报'].includes(record.declarationStatus)
    ? ['正式申报表', '申报结果回执']
    : [];
}

export function getTaxMatterEvidenceStatus(
  record: Pick<
    FinanceTaxMatterRecord,
    'declarationFormFileIds' | 'declarationResultFileId' | 'declarationStatus' | 'declarationVerificationStatus' | 'matterType'
  >
): FinanceTaxMatterEvidenceStatus {
  if (isSocialInsuranceTaxMatter(record.matterType) || record.declarationStatus === '无申报义务') {
    return '无需申报材料';
  }

  if (!['申报成功', '零申报'].includes(record.declarationStatus)) {
    return '材料待补';
  }

  if (!record.declarationResultFileId || record.declarationFormFileIds.length === 0) {
    return '材料待补';
  }

  if (record.declarationVerificationStatus === '核验不一致') {
    return '核验不一致';
  }

  return record.declarationVerificationStatus === '人工核验一致' ? '已齐全' : '待核验';
}

export function getTaxMatterAccountingStatus(record: FinanceTaxMatterRecord): FinanceTaxMatterAccountingStatus {
  if (record.dataStatus !== '已确认') {
    return '待确认';
  }

  if (record.matterType === '个人所得税') {
    return '无需生成';
  }

  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return record.sourceItems.every((item) => ['已确认', '不适用'].includes(item.status)) ? '可生成' : '待确认';
  }

  if (['零申报', '无申报义务'].includes(record.declarationStatus)) {
    return '无需生成';
  }

  if (!['申报成功', '零申报'].includes(record.declarationStatus) || getTaxMatterEvidenceStatus(record) !== '已齐全') {
    return '待确认';
  }

  return Math.abs(getTaxMatterAccountingDelta(record)) > 0.005 ? '可生成' : '无需生成';
}

export function getTaxMatterSettlementDirection(
  record: Pick<FinanceTaxMatterRecord, 'declarationStatus' | 'payableAmount' | 'refundableAmount' | 'settlementDirection'>
): FinanceTaxMatterSettlementDirection {
  if (record.settlementDirection) {
    return record.settlementDirection;
  }

  if (record.declarationStatus === '待申报' || record.declarationStatus === '已作废') {
    return '待确定';
  }

  if (record.declarationStatus === '零申报' || record.declarationStatus === '无申报义务') {
    return '无需补退';
  }

  return (record.refundableAmount ?? 0) > 0 ? '应退' : record.payableAmount > 0 ? '应缴' : '无需补退';
}

export function deriveTaxMatterProcessStatus(
  record: Pick<
    FinanceTaxMatterRecord,
    'dataStatus' | 'declarationFormFileIds' | 'declarationResultFileId' | 'declarationStatus' | 'declarationVerificationStatus' | 'matterType' | 'offsetAmount' | 'offsetBaselineAmount' | 'offsetReceivedAmount' | 'offsetReceivedBaselineAmount' | 'paidAmount' | 'payableAmount' | 'paymentBaselineAmount' | 'refundableAmount' | 'refundBaselineAmount' | 'refundedAmount' | 'refundStatus' | 'settlementDirection'
  >
): FinanceTaxMatterProcessStatus {
  if (record.dataStatus !== '已确认') {
    return '数据待确认';
  }

  if (isSocialInsuranceTaxMatter(record.matterType)) {
    if (record.paidAmount <= 0) {
      return '待申报';
    }

    return record.paidAmount < record.payableAmount ? '部分缴纳' : '已完成';
  }

  if (record.declarationStatus === '待申报' || record.declarationStatus === '已作废') {
    return '待申报';
  }

  if (record.declarationStatus === '无申报义务') {
    return '已完成';
  }

  const outstandingPayment = getTaxMatterOutstandingAmount(record);
  if (outstandingPayment > 0) {
    return record.paidAmount - (record.paymentBaselineAmount ?? 0) > 0 ? '部分缴纳' : '待缴款';
  }

  const outstandingRefund = getTaxMatterRefundOutstandingAmount(record);
  if (outstandingRefund > 0) {
    if (record.refundStatus === '申请中') {
      return '退抵处理中';
    }

    if (record.refundStatus === '部分到账') {
      return '部分退抵';
    }

    return '待退抵处理';
  }

  return getTaxMatterEvidenceStatus(record) === '已齐全' ? '已完成' : '申报材料待核对';
}

export function recordTaxMatterDeclarationResult(
  record: FinanceTaxMatterRecord,
  input: TaxMatterDeclarationResultInput
): FinanceTaxMatterRecord {
  if (getTaxMatterDeclarationResultValidationError(record, input)) {
    return record;
  }

  const nextVatSettlement = record.matterType === '增值税及附加' && input.vatBreakdown
    ? buildOfficialVatSettlement(record, input.vatBreakdown)
    : undefined;
  const vatVersionSettlement = record.matterType === '增值税及附加' && input.vatBreakdown
    ? getVatDeclarationVersionSettlement(record, input.vatBreakdown)
    : undefined;
  const settlementDirection = input.declarationStatus === '零申报'
    ? '无需补退'
    : vatVersionSettlement?.direction ?? input.settlementDirection;
  const settlementAmount = settlementDirection === '无需补退'
    ? 0
    : vatVersionSettlement?.amount ?? roundMoney(input.settlementAmount);
  const payableAmount = settlementDirection === '应缴' ? settlementAmount : 0;
  const refundableAmount = settlementDirection === '应退' ? settlementAmount : 0;
  const priorFiledAccountingAmount = getLatestEffectiveDeclarationHistory(record.declarationHistory)?.filedAccountingAmount;
  const currentSettlementAccountingAmount = payableAmount - refundableAmount;
  const filedAccountingAmount = record.matterType === '企业所得税' || record.matterType === '印花税'
    ? roundMoney((priorFiledAccountingAmount ?? 0) + currentSettlementAccountingAmount)
    : record.filedAccountingAmount;
  const currentVersionPaidAmount = getTaxMatterCurrentVersionPaidAmount(record);
  const declarationFormFiles = input.declarationFormFiles ?? [];
  const declarationResultFileId = input.declarationResultFile?.id;
  const retainedFiles = record.files.filter((file) => (
    !record.declarationFormFileIds.includes(file.id)
    && file.id !== record.declarationResultFileId
  ));
  const nextFiles = mergeTaxMatterFiles(retainedFiles, [
    ...declarationFormFiles,
    ...(input.declarationResultFile ? [input.declarationResultFile] : [])
  ]);
  const declarationVerificationStatus = input.declarationVerificationStatus ?? '未核验';
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    declarationDate: input.declarationDate,
    declarationDifferenceReason: input.differenceReason?.trim() || undefined,
    declarationFormFileIds: declarationFormFiles.map((file) => file.id),
    declarationResultFileId,
    declarationVerificationNote: input.declarationVerificationNote?.trim() || undefined,
    declarationVerificationStatus,
    declarationVerifiedAt: declarationVerificationStatus === '未核验' ? undefined : `${financeToday} 15:10`,
    declarationVerifiedBy: declarationVerificationStatus === '未核验' ? undefined : '李明',
    taxAuthorityAssessmentVoucherNo: input.taxAuthorityAssessmentVoucherNo?.trim() || undefined,
    taxAuthorityDeclarationNo: input.taxAuthorityDeclarationNo?.trim() || undefined,
    declarationStatus: input.declarationStatus,
    files: nextFiles,
    filedAccountingAmount,
    payableAmount,
    refundableAmount,
    refundApplicationDate: refundableAmount > 0 ? undefined : record.refundApplicationDate,
    refundApplicationReceiptFileId: refundableAmount > 0 ? undefined : record.refundApplicationReceiptFileId,
    refundApplicationReceiptNo: refundableAmount > 0 ? undefined : record.refundApplicationReceiptNo,
    refundStatus: refundableAmount > 0 ? '待申请' : '不适用',
    overpaymentMethod: refundableAmount > 0 ? undefined : record.overpaymentMethod,
    settlementDirection,
    paymentStatus: payableAmount <= 0
      ? '无需缴纳'
      : currentVersionPaidAmount <= 0
        ? '待缴纳'
        : currentVersionPaidAmount < payableAmount
          ? '部分缴纳'
          : '已缴纳',
    updatedAt: financeToday
  };

  if (nextVatSettlement) {
    nextRecord.vatSettlement = nextVatSettlement;
  }

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: record.declarationVersion > 1 ? '登记更正结果' : '登记申报结果',
        actor: '李明',
        id: `tax-op-declaration-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: `第 ${record.declarationVersion} 版：${input.declarationStatus}，${settlementDirection} ${settlementAmount.toFixed(2)} 元`,
        time: `${financeToday} 15:10`
      },
      ...record.operationRecords
    ]
  };
}

export function supplementTaxMatterDeclarationEvidence(
  record: FinanceTaxMatterRecord,
  input: TaxMatterDeclarationEvidenceInput
): FinanceTaxMatterRecord {
  const taxAuthorityAssessmentVoucherNo = input.taxAuthorityAssessmentVoucherNo?.trim() || undefined;
  const taxAuthorityDeclarationNo = input.taxAuthorityDeclarationNo?.trim() || undefined;
  const declarationVerificationNote = input.declarationVerificationNote?.trim() || undefined;
  const hasRequiredFiles = input.declarationFormFiles.length > 0 && Boolean(input.declarationResultFile);

  if (
    !['申报成功', '零申报'].includes(record.declarationStatus)
    || (!input.declarationFormFiles.length && !input.declarationResultFile && !taxAuthorityDeclarationNo)
    || (input.declarationVerificationStatus === '人工核验一致' && !hasRequiredFiles)
    || (input.declarationVerificationStatus === '核验不一致' && !declarationVerificationNote)
  ) {
    return record;
  }

  const retainedFiles = record.files.filter((file) => (
    !record.declarationFormFileIds.includes(file.id)
    && file.id !== record.declarationResultFileId
  ));
  const nextFiles = mergeTaxMatterFiles(retainedFiles, [
    ...input.declarationFormFiles,
    ...(input.declarationResultFile ? [input.declarationResultFile] : [])
  ]);
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    declarationFormFileIds: input.declarationFormFiles.map((file) => file.id),
    declarationResultFileId: input.declarationResultFile?.id,
    declarationVerificationNote,
    declarationVerificationStatus: input.declarationVerificationStatus,
    declarationVerifiedAt: input.declarationVerificationStatus === '未核验' ? undefined : `${financeToday} 15:20`,
    declarationVerifiedBy: input.declarationVerificationStatus === '未核验' ? undefined : '李明',
    taxAuthorityAssessmentVoucherNo,
    taxAuthorityDeclarationNo,
    files: nextFiles,
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: '维护申报材料',
        actor: '李明',
        id: `tax-op-declaration-evidence-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: `申报材料${hasRequiredFiles ? '已齐全' : '待补充'}，${input.declarationVerificationStatus}`,
        time: `${financeToday} 15:20`
      },
      ...record.operationRecords
    ]
  };
}

function mergeTaxMatterFiles(existingFiles: RelatedFileRecord[], incomingFiles: RelatedFileRecord[]) {
  const incomingIds = new Set(incomingFiles.map((file) => file.id));
  return [...incomingFiles, ...existingFiles.filter((file) => !incomingIds.has(file.id))];
}

export function recordTaxMatterRefundResult(
  record: FinanceTaxMatterRecord,
  input: TaxMatterRefundResultInput
): FinanceTaxMatterRecord {
  const outstandingAmount = getTaxMatterRefundOutstandingAmount(record);

  if (
    !['申请中', '部分到账'].includes(record.refundStatus ?? '')
    || input.amount <= 0
    || input.amount - outstandingAmount > 0.01
    || !input.refundDate
    || input.receiptFile.status !== '已上传'
  ) {
    return record;
  }

  const refundedAmount = roundMoney((record.refundedAmount ?? 0) + input.amount);
  const remainingAmount = roundMoney(outstandingAmount - input.amount);
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    files: [input.receiptFile, ...record.files],
    refundedAmount,
    refundDate: input.refundDate,
    refundStatus: remainingAmount > 0 ? '部分到账' : '已到账',
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: '登记退税到账',
        actor: '李明',
        id: `tax-op-refund-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: `登记退税到账 ${input.amount.toFixed(2)} 元`,
        time: `${financeToday} 15:25`
      },
      ...record.operationRecords
    ]
  };
}

export function recordTaxMatterRefundApplication(
  record: FinanceTaxMatterRecord,
  input: TaxMatterRefundApplicationInput
): FinanceTaxMatterRecord {
  if (
    record.refundStatus !== '待申请'
    || getTaxMatterRefundOutstandingAmount(record) <= 0
    || !input.applicationDate
    || (!input.receiptFile && !input.receiptNo?.trim())
    || (input.method === '抵缴' && !input.targetMatterId)
  ) {
    return record;
  }

  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    files: input.receiptFile ? [input.receiptFile, ...record.files] : record.files,
    refundApplicationDate: input.applicationDate,
    refundApplicationReceiptFileId: input.receiptFile?.id,
    refundApplicationReceiptNo: input.receiptNo?.trim() || undefined,
    refundStatus: '申请中',
    overpaymentMethod: input.method,
    offsetTargetMatterId: input.method === '抵缴' ? input.targetMatterId : undefined,
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: input.method === '抵缴' ? '登记抵缴申请' : '登记退税申请',
        actor: '李明',
        id: `tax-op-refund-application-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: `${input.method === '抵缴' ? '申请抵缴' : '申请退税'} ${getTaxMatterRefundOutstandingAmount(record).toFixed(2)} 元`,
        time: `${financeToday} 15:22`
      },
      ...record.operationRecords
    ]
  };
}

export function recordTaxMatterOffsetResult(
  sourceRecord: FinanceTaxMatterRecord,
  targetRecord: FinanceTaxMatterRecord,
  input: TaxMatterOffsetResultInput
): { sourceRecord: FinanceTaxMatterRecord; targetRecord: FinanceTaxMatterRecord } | undefined {
  const sourceOutstandingAmount = getTaxMatterRefundOutstandingAmount(sourceRecord);
  const targetOutstandingAmount = getTaxMatterOutstandingAmount(targetRecord);

  if (
    sourceRecord.overpaymentMethod !== '抵缴'
    || !['申请中', '部分到账'].includes(sourceRecord.refundStatus ?? '')
    || sourceRecord.offsetTargetMatterId !== targetRecord.id
    || sourceRecord.matterType !== targetRecord.matterType
    || input.amount <= 0
    || input.amount - sourceOutstandingAmount > 0.01
    || input.amount - targetOutstandingAmount > 0.01
    || !input.offsetDate
    || (!input.receiptFile && !input.receiptNo?.trim())
  ) {
    return undefined;
  }

  const offsetAmount = roundMoney((sourceRecord.offsetAmount ?? 0) + input.amount);
  const offsetReceivedAmount = roundMoney((targetRecord.offsetReceivedAmount ?? 0) + input.amount);
  const sourceRemainingAmount = roundMoney(sourceOutstandingAmount - input.amount);
  const targetRemainingAmount = roundMoney(targetOutstandingAmount - input.amount);
  const nextSourceRecord: FinanceTaxMatterRecord = {
    ...sourceRecord,
    files: input.receiptFile ? [input.receiptFile, ...sourceRecord.files] : sourceRecord.files,
    offsetAmount,
    offsetDate: input.offsetDate,
    offsetReceiptFileId: input.receiptFile?.id,
    offsetReceiptNo: input.receiptNo?.trim() || undefined,
    offsetTargetMatterNo: targetRecord.matterNo,
    refundStatus: sourceRemainingAmount > 0 ? '部分到账' : '已到账',
    updatedAt: financeToday
  };
  const nextTargetRecord: FinanceTaxMatterRecord = {
    ...targetRecord,
    offsetReceivedAmount,
    paymentStatus: targetRemainingAmount > 0 ? '部分缴纳' : '已缴纳',
    updatedAt: financeToday,
    operationRecords: [
      {
        action: '抵缴税款',
        actor: '李明',
        id: `tax-op-offset-received-${targetRecord.id}-${Date.now()}`,
        object: targetRecord.matterNo,
        summary: `使用 ${sourceRecord.matterNo} 多缴税款抵缴 ${input.amount.toFixed(2)} 元`,
        time: `${financeToday} 15:26`
      },
      ...targetRecord.operationRecords
    ]
  };

  return {
    sourceRecord: {
      ...nextSourceRecord,
      processStatus: deriveTaxMatterProcessStatus(nextSourceRecord),
      operationRecords: [
        {
          action: '登记抵缴结果',
          actor: '李明',
          id: `tax-op-offset-${sourceRecord.id}-${Date.now()}`,
          object: sourceRecord.matterNo,
          summary: `抵缴 ${targetRecord.matterNo} ${input.amount.toFixed(2)} 元`,
          time: `${financeToday} 15:26`
        },
        ...sourceRecord.operationRecords
      ]
    },
    targetRecord: {
      ...nextTargetRecord,
      processStatus: deriveTaxMatterProcessStatus(nextTargetRecord)
    }
  };
}

export function recordTaxMatterPaymentResult(
  record: FinanceTaxMatterRecord,
  input: TaxMatterPaymentResultInput
): FinanceTaxMatterRecord {
  const outstandingAmount = getTaxMatterOutstandingAmount(record);
  const declarationReady = ['申报成功', '零申报'].includes(record.declarationStatus)
    || (
      isSocialInsuranceTaxMatter(record.matterType)
      && record.declarationStatus === '无申报义务'
      && record.sourceItems.every((item) => ['已确认', '不适用'].includes(item.status))
    );

  if (
    record.settlementDirection !== '应缴'
    || !declarationReady
    || !['待缴纳', '部分缴纳'].includes(record.paymentStatus)
    || input.amount <= 0
    || input.amount - outstandingAmount > 0.01
    || !input.paymentDate
    || input.receiptFile.status !== '已上传'
  ) {
    return record;
  }

  const paidAmount = roundMoney(record.paidAmount + input.amount);
  const currentVersionPaidAmount = paidAmount - (record.paymentBaselineAmount ?? 0);
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    files: [input.receiptFile, ...record.files],
    paidAmount,
    paymentDate: input.paymentDate,
    paymentStatus: currentVersionPaidAmount < record.payableAmount ? '部分缴纳' : '已缴纳',
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: '登记缴款',
        actor: '李明',
        id: `tax-op-payment-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: `登记缴款 ${input.amount.toFixed(2)} 元`,
        time: `${financeToday} 15:20`
      },
      ...record.operationRecords
    ]
  };
}

export function getTaxMatterDeclarationRevisionValidationError(
  record: FinanceTaxMatterRecord,
  action: '更正' | '作废',
  allRecords: FinanceTaxMatterRecord[] = [record],
  voucherRows: Array<{ id: string; status: string }> = []
) {
  if (!['申报成功', '零申报'].includes(record.declarationStatus)) {
    return '只能调整已完成申报的事项';
  }

  if (
    action === '作废'
    && (
      record.paidAmount > 0
      || (record.refundedAmount ?? 0) > 0
      || Boolean(record.refundApplicationDate)
    )
  ) {
    return '已有缴款、退税申请或退税到账记录，只能更正申报';
  }

  if (
    action === '作废'
    && voucherRows.some((voucher) => (
      voucher.id === `voucher-tax-${record.id}-filing-v${record.declarationVersion}`
      && voucher.status === '已记账'
    ))
  ) {
    return '本版申报差异已记账，不能直接作废；请通过更正申报形成后续调整';
  }

  if (record.matterType !== '企业所得税' || record.declarationScenario !== '季度预缴') {
    return undefined;
  }

  const matchedPeriod = record.period.match(/^(\d{4})-Q([1-4])$/);
  if (!matchedPeriod) {
    return '企业所得税季度期间格式不正确';
  }

  const taxYear = matchedPeriod[1];
  const annualFiled = allRecords.some((candidate) =>
    candidate.id !== record.id
    && candidate.matterType === '企业所得税'
    && candidate.declarationScenario === '年度汇算'
    && candidate.period === taxYear
    && ['申报成功', '零申报'].includes(candidate.declarationStatus)
  );

  if (annualFiled) {
    return `${taxYear} 年度汇算已申报，不能再调整该年度季度预缴`;
  }

  const latestFiledQuarter = allRecords
    .filter((candidate) =>
      candidate.matterType === '企业所得税'
      && candidate.declarationScenario === '季度预缴'
      && candidate.period.startsWith(`${taxYear}-Q`)
      && ['申报成功', '零申报'].includes(candidate.declarationStatus)
    )
    .sort((left, right) => right.period.localeCompare(left.period))[0];

  return latestFiledQuarter && latestFiledQuarter.id !== record.id
    ? `企业所得税季度预缴只能调整最近一期，当前为 ${latestFiledQuarter.period}`
    : undefined;
}

export function startTaxMatterDeclarationRevision(
  record: FinanceTaxMatterRecord,
  action: '更正' | '作废',
  reason: string,
  context: TaxMatterDeclarationRevisionContext = {}
): FinanceTaxMatterRecord {
  const operatedAt = context.operatedAt ?? `${financeToday} 15:40`;
  const operatedBy = context.operatedBy ?? '李明';
  const currentHistory = {
    action,
    declarationDate: record.declarationDate,
    declarationFormFileIds: record.declarationFormFileIds,
    declarationResultFileId: record.declarationResultFileId,
    declarationVerificationNote: record.declarationVerificationNote,
    declarationVerificationStatus: record.declarationVerificationStatus,
    declarationVerifiedAt: record.declarationVerifiedAt,
    declarationVerifiedBy: record.declarationVerifiedBy,
    taxAuthorityAssessmentVoucherNo: record.taxAuthorityAssessmentVoucherNo,
    taxAuthorityDeclarationNo: record.taxAuthorityDeclarationNo,
    declarationStatus: record.declarationStatus,
    filingAdjustmentAccountingPeriod: record.filingAdjustmentAccountingPeriod,
    filedAccountingAmount: getTaxMatterAccountingAmount(record),
    filedPayableAmount: record.payableAmount,
    filedRefundableAmount: record.refundableAmount,
    paidAmountAtRevision: record.paidAmount,
    refundedAmountAtRevision: record.refundedAmount,
    filedVatSettlement: record.vatSettlement,
    filedVatSurcharge: record.vatSettlement?.surcharge,
    id: context.historyId ?? `tax-declaration-history-${record.id}-${record.declarationVersion}`,
    operatedAt,
    operatedBy,
    reason: reason.trim(),
    version: record.declarationVersion
  } satisfies FinanceTaxMatterRecord['declarationHistory'][number];
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    declarationDate: undefined,
    declarationDifferenceReason: undefined,
    declarationFormFileIds: [],
    declarationHistory: [...record.declarationHistory, currentHistory],
    declarationResultFileId: undefined,
    declarationVerificationNote: undefined,
    declarationVerificationStatus: '未核验',
    declarationVerifiedAt: undefined,
    declarationVerifiedBy: undefined,
    taxAuthorityAssessmentVoucherNo: undefined,
    taxAuthorityDeclarationNo: undefined,
    declarationStatus: '待申报',
    declarationVersion: record.declarationVersion + 1,
    filingAdjustmentAccountingPeriod: undefined,
    filedAccountingAmount: undefined,
    payableAmount: 0,
    paymentBaselineAmount: record.paidAmount,
    offsetReceivedBaselineAmount: record.offsetReceivedAmount ?? 0,
    refundableAmount: 0,
    refundApplicationDate: undefined,
    refundApplicationReceiptFileId: undefined,
    refundApplicationReceiptNo: undefined,
    refundBaselineAmount: record.refundedAmount ?? 0,
    offsetBaselineAmount: record.offsetAmount ?? 0,
    overpaymentMethod: undefined,
    offsetDate: undefined,
    offsetReceiptFileId: undefined,
    offsetReceiptNo: undefined,
    offsetTargetMatterId: undefined,
    offsetTargetMatterNo: undefined,
    refundStatus: '不适用',
    settlementDirection: '待确定',
    paymentStatus: '未开始',
    processStatus: '待申报',
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    operationRecords: [
      {
        action: action === '更正' ? '发起更正' : '作废申报',
        actor: operatedBy,
        id: context.operationId ?? `tax-op-revision-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: action === '更正'
          ? `第 ${record.declarationVersion} 版调整为第 ${record.declarationVersion + 1} 版：${reason.trim()}`
          : `作废第 ${record.declarationVersion} 版：${reason.trim()}`,
        time: operatedAt
      },
      ...record.operationRecords
    ]
  };
}

export function getMissingTaxMatterReceiptTypes(
  files: RelatedFileRecord[],
  requiredTypes: TaxMatterReceiptFileType[]
): TaxMatterReceiptFileType[] {
  return requiredTypes.filter((type) => !files.some((file) => file.type === type));
}

export function hasTaxMatterRequiredReceiptFiles(
  files: RelatedFileRecord[],
  requiredTypes: TaxMatterReceiptFileType[]
) {
  return getMissingTaxMatterReceiptTypes(files, requiredTypes).length === 0;
}

export function buildSocialInsuranceTaxMatterSummary(
  records: SocialInsuranceEmployeeRecord[],
  category: SocialInsuranceCategory,
  period: string
): SocialInsuranceTaxMatterSummary {
  const periodRecords = records.filter((record) => record.category === category && record.period === period);
  const confirmedRecords = periodRecords.filter((record) => record.handlingStatus === '已确认');
  const pendingCount = periodRecords.filter((record) => record.handlingStatus === '待确认').length;
  const exceptionCount = periodRecords.filter((record) => record.handlingStatus === '延期补缴' || record.handlingStatus === '本月不缴').length;
  const readyForHandling = periodRecords.length > 0 && pendingCount === 0 && confirmedRecords.length > 0;
  const companyAmount = roundMoney(confirmedRecords.reduce((total, record) => total + record.companyAmount, 0));
  const personalAmount = roundMoney(confirmedRecords.reduce((total, record) => total + record.personalAmount, 0));
  const totalAmount = roundMoney(companyAmount + personalAmount);
  const sourceStatus: FinanceTaxMatterDataStatus =
    readyForHandling
      ? '已确认'
      : pendingCount > 0
        ? '待复核'
      : confirmedRecords.length > 0
        ? '待复核'
        : '待准备';

  return {
    category,
    companyAmount,
    confirmedCount: confirmedRecords.length,
    exceptionCount,
    participantSummary: confirmedRecords.length > 0 ? `${confirmedRecords.length} 人` : '待确认',
    pendingCount,
    period,
    personalAmount,
    readyForHandling,
    recordCount: periodRecords.length,
    sourceStatus,
    totalAmount
  };
}

function getSourceStatusFromSocialSummary(summary: SocialInsuranceTaxMatterSummary) {
  if (summary.sourceStatus === '已确认') {
    return '已确认';
  }

  if (summary.sourceStatus === '待复核') {
    return '待复核';
  }

  return '待准备';
}

function getVerificationSourceStatus(record: FinanceTaxMatterRecord) {
  if (
    record.declarationStatus === '申报成功'
    || record.declarationStatus === '零申报'
    || record.declarationStatus === '无申报义务'
    || record.files.some((file) => ['申报', '核定', '回执', '凭证'].some((keyword) => file.type.includes(keyword)))
  ) {
    return '已确认';
  }

  return '待准备';
}

export function buildSocialInsuranceTaxMatterSourceItems(
  record: FinanceTaxMatterRecord,
  summary: SocialInsuranceTaxMatterSummary
): FinanceTaxMatterSourceItem[] {
  const sourceConfig = socialTaxMatterSourceConfig[summary.category];
  const confirmationSource = record.sourceItems.find((item) => item.name === sourceConfig.confirmationName);
  const verificationSource = record.sourceItems.find((item) => item.name === sourceConfig.verificationName);

  return [
    {
      id: confirmationSource?.id ?? `tax-source-${summary.category}-${summary.period}-confirmation`,
      name: sourceConfig.confirmationName,
      sourceModule: '社保公积金 / 缴费明细',
      status: getSourceStatusFromSocialSummary(summary),
      updatedAt: financeToday
    },
    {
      id: verificationSource?.id ?? `tax-source-${summary.category}-${summary.period}-verification`,
      name: sourceConfig.verificationName,
      sourceModule: sourceConfig.verificationModule,
      status: getVerificationSourceStatus(record),
      updatedAt: record.declarationDate ?? financeToday
    }
  ];
}

export function applySocialInsuranceSummaryToTaxMatter(
  record: FinanceTaxMatterRecord,
  records: SocialInsuranceEmployeeRecord[]
): FinanceTaxMatterRecord {
  const category = getSocialInsuranceCategoryByTaxMatterType(record.matterType);

  if (!category || record.processStatus === '已完成') {
    return record;
  }

  const summary = buildSocialInsuranceTaxMatterSummary(records, category, record.period);
  const processStatus = summary.readyForHandling
    ? record.processStatus === '数据待确认'
      ? '待申报'
      : record.processStatus
    : '数据待确认';

  return {
    ...record,
    dataStatus: summary.sourceStatus,
    paidAmount: summary.readyForHandling ? record.paidAmount : 0,
    participantSummary: summary.participantSummary,
    payableAmount: summary.totalAmount,
    paymentStatus: summary.readyForHandling ? record.paymentStatus : '未开始',
    processStatus,
    socialInsuranceSettlement: {
      category: summary.category,
      companyAmount: summary.companyAmount,
      personalAmount: summary.personalAmount,
      totalAmount: summary.totalAmount
    },
    sourceItems: buildSocialInsuranceTaxMatterSourceItems(record, summary)
  };
}

export function applySocialInsuranceSummariesToTaxMatters(
  records: FinanceTaxMatterRecord[],
  socialInsuranceRecords: SocialInsuranceEmployeeRecord[]
) {
  return records.map((record) => applySocialInsuranceSummaryToTaxMatter(record, socialInsuranceRecords));
}

export function applyTaxMatterSourceSummaries(
  records: FinanceTaxMatterRecord[],
  socialInsuranceRecords: SocialInsuranceEmployeeRecord[]
) {
  return records.map((record) => applySocialInsuranceSummaryToTaxMatter(record, socialInsuranceRecords));
}

export function isDeclarationPreparationBackedTaxMatter(
  record: Pick<FinanceTaxMatterRecord, 'matterType'>
) {
  return (
    record.matterType === '个人所得税' ||
    record.matterType === '增值税及附加' ||
    record.matterType === '企业所得税' ||
    record.matterType === '印花税'
  );
}

export function findDeclarationPreparationForTaxMatter(
  record: FinanceTaxMatterRecord,
  preparationRows: FinanceDeclarationPreparationRecord[]
) {
  if (!isDeclarationPreparationBackedTaxMatter(record)) {
    return undefined;
  }

  return preparationRows.find(
    (preparation) =>
      preparation.taxType === record.matterType &&
      preparation.period === record.period &&
      (!record.declarationScenario || preparation.declarationScenario === record.declarationScenario)
  );
}

export function getTaxMatterDeclarationPreparationSnapshot(
  preparation: FinanceDeclarationPreparationRecord,
  options: { usePendingIitCorrection?: boolean } = {}
): FinanceDeclarationPreparationRecord {
  const pendingIitCorrection = options.usePendingIitCorrection
    ? preparation.pendingIitCorrection
    : undefined;

  return {
    ...preparation,
    citAnnualSettlement:
      preparation.confirmedCitAnnualSettlement ?? preparation.citAnnualSettlement,
    citSummary: preparation.confirmedCitSummary ?? preparation.citSummary,
    iitEmployeeRows: pendingIitCorrection?.employeeRows
      ?? preparation.confirmedIitEmployeeRows
      ?? preparation.iitEmployeeRows,
    iitSummary: pendingIitCorrection?.summary
      ?? preparation.confirmedIitSummary
      ?? preparation.iitSummary,
    stampDutySources:
      preparation.confirmedStampDutySources ?? preparation.stampDutySources,
    stampDutySummary:
      preparation.confirmedStampDutySummary ?? preparation.stampDutySummary,
    unbilledIncomeDeclarations:
      preparation.confirmedUnbilledIncomeDeclarations ?? preparation.unbilledIncomeDeclarations,
    vatSummary: preparation.confirmedVatSummary ?? preparation.vatSummary
  };
}

function getDeclarationPreparationPayableAmount(
  preparation: FinanceDeclarationPreparationRecord | undefined,
  usePendingIitCorrection = false
) {
  if (!preparation) {
    return 0;
  }

  if (preparation.taxType === '个人所得税') {
    if (usePendingIitCorrection && preparation.pendingIitCorrection) {
      return preparation.pendingIitCorrection.summary.payableAmount;
    }

    return preparation.iitSummary?.payableAmount ?? 0;
  }

  if (preparation.taxType === '企业所得税') {
    return preparation.citSummary?.currentPeriodPayableAmount ?? 0;
  }

  if (preparation.taxType === '印花税') {
    return preparation.stampDutySummary?.estimatedPayableAmount ?? 0;
  }

  return preparation.vatSummary.estimatedTotalTaxAmount;
}

function getDeclarationPreparationSettlement(
  preparation: FinanceDeclarationPreparationRecord | undefined,
  usePendingIitCorrection = false
): {
  amount: number;
  direction: Exclude<FinanceTaxMatterSettlementDirection, '待确定'>;
  payableAmount: number;
  refundableAmount: number;
} {
  const payableAmount = roundMoney(getDeclarationPreparationPayableAmount(preparation, usePendingIitCorrection));
  const refundableAmount = preparation?.taxType === '企业所得税'
    ? roundMoney(preparation.citSummary?.overpaidTaxAmount ?? 0)
    : 0;

  if (refundableAmount > 0.005) {
    return { amount: refundableAmount, direction: '应退', payableAmount: 0, refundableAmount };
  }

  if (payableAmount > 0.005) {
    return { amount: payableAmount, direction: '应缴', payableAmount, refundableAmount: 0 };
  }

  return { amount: 0, direction: '无需补退', payableAmount: 0, refundableAmount: 0 };
}

function getDeclarationPreparationParticipantSummary(
  record: FinanceTaxMatterRecord,
  preparation: FinanceDeclarationPreparationRecord | undefined,
  usePendingIitCorrection = false
) {
  if (preparation?.taxType === '个人所得税' && usePendingIitCorrection && preparation.pendingIitCorrection) {
    return preparation.pendingIitCorrection.summary.reportCount > 0
      ? preparation.pendingIitCorrection.summary.participantSummary
      : '0 人';
  }

  if (preparation?.taxType === '印花税') {
    return `应税凭证 ${preparation.stampDutySummary?.declarableCount ?? 0} 条`;
  }

  return record.participantSummary;
}

function getVatSettlementSnapshot(preparation: FinanceDeclarationPreparationRecord | undefined) {
  if (!preparation || preparation.taxType !== '增值税及附加') {
    return undefined;
  }

  const declaredVatAmount = preparation.vatSummary.estimatedVatAfterExemption;
  const surcharge = preparation.vatSummary.surchargeBreakdown;

  return {
    declaredVatAmount,
    officialBreakdown: {
      declaredVatAmount,
      educationSurchargeAmount: surcharge.educationSurchargeAfterReduction,
      localEducationSurchargeAmount: surcharge.localEducationSurchargeAfterReduction,
      urbanMaintenanceTaxAmount: surcharge.urbanMaintenanceTaxAfterReduction
    },
    sourceRecognizedVatAmount: preparation.vatSummary.sourceRecognizedVatAmount,
    surcharge,
    totalPayableAmount: preparation.vatSummary.estimatedTotalTaxAmount
  };
}

function buildDeclarationPreparationSourceItem(
  record: FinanceTaxMatterRecord,
  preparation: FinanceDeclarationPreparationRecord | undefined
): FinanceTaxMatterSourceItem[] {
  const existingItem = record.sourceItems.find((item) => item.name === '办理依据');

  if (
    !preparation &&
    existingItem &&
    !['待申报', '已作废'].includes(record.declarationStatus)
  ) {
    return [existingItem];
  }

  const progress = preparation ? getDeclarationPreparationProgress(preparation) : undefined;
  const isPreparationReady = Boolean(
    preparation &&
    (preparation.status === '可申报' || preparation.status === '已进入税务办理') &&
    progress?.pendingCount === 0
  );

  return [
    {
      id: existingItem?.id ?? `tax-source-${record.id}-preparation`,
      name: '办理依据',
      sourceModule: '申报准备',
      status: isPreparationReady ? '已确认' : '待复核',
      updatedAt: preparation?.updatedAt ?? financeToday
    }
  ];
}

export function applyDeclarationPreparationToTaxMatter(
  record: FinanceTaxMatterRecord,
  preparationRows: FinanceDeclarationPreparationRecord[]
): FinanceTaxMatterRecord {
  if (!isDeclarationPreparationBackedTaxMatter(record)) {
    return record;
  }

  const preparation = findDeclarationPreparationForTaxMatter(record, preparationRows);
  const sourceItems = buildDeclarationPreparationSourceItem(record, preparation);
  const progress = preparation ? getDeclarationPreparationProgress(preparation) : undefined;
  const isPreparationReady = Boolean(
    preparation &&
    (preparation.status === '可申报' || preparation.status === '已进入税务办理') &&
    progress?.pendingCount === 0
  );
  const usePendingIitCorrection = Boolean(
    record.matterType === '个人所得税'
    && record.declarationStatus === '待申报'
    && record.declarationVersion > 1
    && preparation?.pendingIitCorrection
  );
  const preparedSettlement = getDeclarationPreparationSettlement(
    preparation,
    usePendingIitCorrection
  );
  const preparedPayableAmount = preparedSettlement.payableAmount;
  const participantSummary = getDeclarationPreparationParticipantSummary(
    record,
    preparation,
    usePendingIitCorrection
  );

  if (record.declarationStatus !== '待申报' && record.declarationStatus !== '已作废') {
    return {
      ...record,
      sourceItems,
      vatSettlement: record.vatSettlement ?? getVatSettlementSnapshot(preparation)
    };
  }

  if (!isPreparationReady) {
    return {
      ...record,
      dataStatus: '待复核',
      participantSummary,
      payableAmount: 0,
      preparedPayableAmount: 0,
      preparedRefundableAmount: 0,
      preparedSettlementDirection: '无需补退',
      paymentStatus: '未开始',
      processStatus: '数据待确认',
      refundableAmount: 0,
      refundStatus: '不适用',
      settlementDirection: '待确定',
      sourceItems,
      vatSettlement: undefined
    };
  }

  return {
    ...record,
    dataStatus: '已确认',
    payableAmount: record.declarationStatus === '待申报'
      ? preparedPayableAmount
      : record.payableAmount,
    preparedPayableAmount,
    preparedRefundableAmount: preparedSettlement.refundableAmount,
    preparedSettlementDirection: preparedSettlement.direction,
    participantSummary,
    paymentStatus: record.paymentStatus === '未开始' ? '待缴纳' : record.paymentStatus,
    processStatus: record.processStatus === '数据待确认' ? '待申报' : record.processStatus,
    settlementDirection: record.declarationStatus === '待申报' ? '待确定' : record.settlementDirection,
    sourceItems,
    updatedAt: preparation?.updatedAt ?? record.updatedAt,
    vatSettlement: getVatSettlementSnapshot(preparation)
  };
}

function getPayrollIitDueDate(period: string) {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const dueYear = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;

  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-15`;
}

export function ensurePayrollIitTaxMatterRecords(
  records: FinanceTaxMatterRecord[],
  preparationRows: FinanceDeclarationPreparationRecord[]
) {
  const existingPeriods = new Set(
    records
      .filter((record) => record.matterType === '个人所得税' && record.declarationScenario === '月度扣缴')
      .map((record) => record.period)
  );
  const generatedRecords = preparationRows
    .filter(
      (preparation) =>
        preparation.taxType === '个人所得税' &&
        preparation.declarationScenario === '月度扣缴' &&
        !existingPeriods.has(preparation.period)
    )
    .map((preparation): FinanceTaxMatterRecord => {
      const compactPeriod = preparation.period.replace('-', '');
      const dueDate = getPayrollIitDueDate(preparation.period);

      return {
        dataStatus: '待复核',
        declarationDueDate: dueDate,
        declarationFormFileIds: [],
        declarationHistory: [],
        declarationScenario: '月度扣缴',
        declarationStatus: '待申报',
        declarationVerificationStatus: '未核验',
        declarationVersion: 1,
        files: [],
        id: `tax-matter-${compactPeriod}-iit`,
        linkedTransactionNos: [],
        matterNo: `TAX-${compactPeriod}-IIT`,
        matterType: '个人所得税',
        operationRecords: [
          {
            action: '建立事项',
            actor: '系统',
            id: `tax-op-${compactPeriod}-iit-001`,
            object: `TAX-${compactPeriod}-IIT`,
            summary: `根据 ${preparation.preparationNo} 建立个人所得税办理事项`,
            time: `${preparation.updatedAt} 09:30`
          }
        ],
        owner: preparation.owner,
        paidAmount: 0,
        participantSummary: '0 人',
        payableAmount: 0,
        paymentDueDate: dueDate,
        paymentStatus: '未开始',
        period: preparation.period,
        periodType: '月度',
        preparedPayableAmount: 0,
        processStatus: '数据待确认',
        refundableAmount: 0,
        refundStatus: '不适用',
        settlementDirection: '待确定',
        sourceItems: [
          {
            id: `tax-source-${compactPeriod}-iit-preparation`,
            name: '办理依据',
            sourceModule: '申报准备',
            status: '待复核',
            updatedAt: preparation.updatedAt
          }
        ],
        title: `${preparation.period} 个人所得税`,
        updatedAt: preparation.updatedAt
      };
    });

  return [...records, ...generatedRecords];
}

export function applyDeclarationPreparationsToTaxMatters(
  records: FinanceTaxMatterRecord[],
  preparationRows: FinanceDeclarationPreparationRecord[]
) {
  return ensurePayrollIitTaxMatterRecords(records, preparationRows).map((record) =>
    applyDeclarationPreparationToTaxMatter(record, preparationRows)
  );
}

function formatPeriodCode(period: string) {
  return period.replace(/[^0-9A-Z]/gi, '');
}

function getNextFinanceTransactionNo(financeRows: FinanceTransactionRecord[], accountingPeriod: string) {
  const periodCode = formatPeriodCode(accountingPeriod);
  const prefix = `FIN-${periodCode}-`;
  const nextSequence =
    financeRows.reduce((maxSequence, row) => {
      if (!row.transactionNo.startsWith(prefix)) {
        return maxSequence;
      }

      const sequence = Number(row.transactionNo.slice(prefix.length));
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1;

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

function getTaxMatterCounterparty(matterType: FinanceTaxMatterType) {
  if (matterType === '社保缴纳') {
    return '社保经办机构';
  }

  if (matterType === '公积金缴纳') {
    return '住房公积金中心';
  }

  return '税务机关';
}

function isTaxMatterPaymentReceiptFile(file: RelatedFileRecord) {
  return file.type === '缴款回单'
    || file.type.includes('缴款')
    || file.name.includes('缴款')
    || file.name.includes('银行回单');
}

function copyTaxMatterPaymentFilesToTransaction(files: RelatedFileRecord[]) {
  return files
    .filter(isTaxMatterPaymentReceiptFile)
    .map((file) => ({
      ...file,
      type: file.type === '缴款回单' ? '缴款回单' : '税费缴款凭证'
    }));
}

function buildTaxMatterPaymentAllocations(
  record: FinanceTaxMatterRecord,
  financeRows: FinanceTransactionRecord[],
  amountToRegister: number
): FinanceTaxPaymentAllocation[] | undefined {
  if (record.matterType !== '增值税及附加' || !record.vatSettlement) {
    return undefined;
  }

  const surcharge = record.vatSettlement.surcharge;

  const allocations = [
    { amount: record.vatSettlement.declaredVatAmount, subjectCode: '2221.01', taxType: '增值税' },
    { amount: surcharge.urbanMaintenanceTaxAfterReduction, subjectCode: '2221.04', taxType: '城市维护建设税' },
    { amount: surcharge.educationSurchargeAfterReduction, subjectCode: '2221.06', taxType: '教育费附加' },
    { amount: surcharge.localEducationSurchargeAfterReduction, subjectCode: '2221.07', taxType: '地方教育附加' }
  ] satisfies FinanceTaxPaymentAllocation[];

  const linkedRows = financeRows.filter(
    (row) => record.linkedTransactionNos.includes(row.transactionNo) && row.status !== '已作废'
  );

  if (linkedRows.some((row) => !row.taxPaymentAllocations)) {
    return undefined;
  }

  const remainingAllocations = allocations
    .map((allocation) => {
      const allocatedAmount = linkedRows.reduce(
        (total, row) => total + (row.taxPaymentAllocations ?? [])
          .filter((item) => item.subjectCode === allocation.subjectCode)
          .reduce((subtotal, item) => subtotal + item.amount, 0),
        0
      );

      return {
        ...allocation,
        amount: roundMoney(allocation.amount - allocatedAmount)
      };
    })
    .filter((allocation) => allocation.amount > 0);
  let amountRemaining = amountToRegister;

  return remainingAllocations.flatMap((allocation) => {
    if (amountRemaining <= 0) {
      return [];
    }

    const amount = roundMoney(Math.min(allocation.amount, amountRemaining));
    amountRemaining = roundMoney(amountRemaining - amount);

    return [{ ...allocation, amount }];
  });
}

function buildTaxMatterRefundAllocations(
  record: FinanceTaxMatterRecord,
  financeRows: FinanceTransactionRecord[],
  amountToRegister: number
): FinanceTaxPaymentAllocation[] | undefined {
  if (record.matterType !== '增值税及附加' || !record.vatSettlement) {
    return undefined;
  }

  const previousSettlement = getLatestEffectiveDeclarationHistory(record.declarationHistory)?.filedVatSettlement;

  if (!previousSettlement) {
    return undefined;
  }

  const allocations = ([
    {
      amount: roundMoney(previousSettlement.declaredVatAmount - record.vatSettlement.declaredVatAmount),
      subjectCode: '2221.01',
      taxType: '增值税'
    },
    {
      amount: roundMoney(
        previousSettlement.surcharge.urbanMaintenanceTaxAfterReduction
          - record.vatSettlement.surcharge.urbanMaintenanceTaxAfterReduction
      ),
      subjectCode: '2221.04',
      taxType: '城市维护建设税'
    },
    {
      amount: roundMoney(
        previousSettlement.surcharge.educationSurchargeAfterReduction
          - record.vatSettlement.surcharge.educationSurchargeAfterReduction
      ),
      subjectCode: '2221.06',
      taxType: '教育费附加'
    },
    {
      amount: roundMoney(
        previousSettlement.surcharge.localEducationSurchargeAfterReduction
          - record.vatSettlement.surcharge.localEducationSurchargeAfterReduction
      ),
      subjectCode: '2221.07',
      taxType: '地方教育附加'
    }
  ] satisfies FinanceTaxPaymentAllocation[]).filter((allocation) => allocation.amount > 0.005);

  const versionRefundAmount = roundMoney(allocations.reduce((total, allocation) => total + allocation.amount, 0));

  if (Math.abs(versionRefundAmount - (record.refundableAmount ?? 0)) > 0.01) {
    return undefined;
  }

  const linkedRows = financeRows.filter(
    (row) => record.linkedTransactionNos.includes(row.transactionNo)
      && row.direction === '收入'
      && row.status !== '已作废'
  );

  if (linkedRows.some((row) => !row.taxPaymentAllocations)) {
    return undefined;
  }

  const remainingAllocations = allocations
    .map((allocation) => {
      const allocatedAmount = linkedRows.reduce(
        (total, row) => total + (row.taxPaymentAllocations ?? [])
          .filter((item) => item.subjectCode === allocation.subjectCode)
          .reduce((subtotal, item) => subtotal + item.amount, 0),
        0
      );

      return {
        ...allocation,
        amount: roundMoney(allocation.amount - allocatedAmount)
      };
    })
    .filter((allocation) => allocation.amount > 0.005);
  let amountRemaining = amountToRegister;

  const result = remainingAllocations.flatMap((allocation) => {
    if (amountRemaining <= 0) {
      return [];
    }

    const amount = roundMoney(Math.min(allocation.amount, amountRemaining));
    amountRemaining = roundMoney(amountRemaining - amount);

    return [{ ...allocation, amount }];
  });

  return amountRemaining <= 0.01 ? result : undefined;
}

export function getTaxMatterLinkedPaymentAmount(record: FinanceTaxMatterRecord, financeRows: FinanceTransactionRecord[]) {
  const { adjustmentRows, directRows } = getTaxMatterSettlementTransactions(record, financeRows);

  return getTaxMatterSettlementNetAmount(directRows, adjustmentRows, '税费缴纳');
}

export function getTaxMatterLinkedRefundAmount(record: FinanceTaxMatterRecord, financeRows: FinanceTransactionRecord[]) {
  const { adjustmentRows, directRows } = getTaxMatterSettlementTransactions(record, financeRows);

  return getTaxMatterSettlementNetAmount(directRows, adjustmentRows, '税费退还');
}

function getTaxMatterSettlementTransactions(
  record: FinanceTaxMatterRecord,
  financeRows: FinanceTransactionRecord[]
) {
  const linkedNos = new Set(record.linkedTransactionNos);
  const directRows = financeRows.filter((row) => (
    row.sourceType === '税费事项'
    && (row.sourceNo === record.matterNo || linkedNos.has(row.transactionNo))
  ));
  const directTransactionNos = new Set(directRows.map((row) => row.transactionNo));
  const adjustmentRows = financeRows.filter((row) => (
    row.adjustmentContext?.originTransactionNo
    && directTransactionNos.has(row.adjustmentContext.originTransactionNo)
  ));

  return {
    adjustmentRows,
    directRows
  };
}

function getTaxMatterSettlementNetAmount(
  directRows: FinanceTransactionRecord[],
  adjustmentRows: FinanceTransactionRecord[],
  category: '税费缴纳' | '税费退还'
) {
  const positiveDirection = category === '税费缴纳' ? '支出' : '收入';
  const negativeDirection = positiveDirection === '支出' ? '收入' : '支出';
  const activeDirectRows = directRows.filter((row) => row.category === category && row.status !== '已作废');
  const postedAdjustmentRows = adjustmentRows.filter((row) => row.category === category && row.status === '已入账');

  return roundMoney(Math.max(0, [...activeDirectRows, ...postedAdjustmentRows].reduce((total, row) => {
    if (row.direction === positiveDirection) {
      return total + row.amount;
    }

    if (row.direction === negativeDirection) {
      return total - row.amount;
    }

    return total;
  }, 0)));
}

function getLatestTaxMatterSettlementDate(
  directRows: FinanceTransactionRecord[],
  category: '税费缴纳' | '税费退还'
) {
  return directRows
    .filter((row) => row.category === category && row.status !== '已作废')
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0]
    ?.occurredAt;
}

/**
 * Tax handling stores the external filing result, while finance rows store the cash facts.
 * Reconcile their amounts so a voided registration or a posted reversal cannot leave the
 * tax matter falsely shown as paid or refunded.
 */
export function reconcileTaxMatterCashSettlement(
  record: FinanceTaxMatterRecord,
  financeRows: FinanceTransactionRecord[]
): FinanceTaxMatterRecord {
  const { adjustmentRows, directRows } = getTaxMatterSettlementTransactions(record, financeRows);

  if (directRows.length === 0) {
    return record;
  }

  const paidAmount = getTaxMatterSettlementNetAmount(directRows, adjustmentRows, '税费缴纳');
  const refundedAmount = getTaxMatterSettlementNetAmount(directRows, adjustmentRows, '税费退还');
  const currentVersionPaidAmount = roundMoney(Math.max(0, paidAmount - (record.paymentBaselineAmount ?? 0)));
  const currentVersionRefundedAmount = roundMoney(Math.max(0, refundedAmount - (record.refundBaselineAmount ?? 0)));
  const paymentStatus = record.payableAmount <= 0
    ? '无需缴纳'
    : currentVersionPaidAmount <= 0
      ? '待缴纳'
      : currentVersionPaidAmount < record.payableAmount
        ? '部分缴纳'
        : '已缴纳';
  const refundStatus = (record.refundableAmount ?? 0) <= 0
    ? '不适用'
    : currentVersionRefundedAmount <= 0
      ? record.refundApplicationDate
        ? '申请中'
        : '待申请'
      : currentVersionRefundedAmount < (record.refundableAmount ?? 0)
        ? '部分到账'
        : '已到账';
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    paidAmount,
    paymentDate: paidAmount > 0
      ? getLatestTaxMatterSettlementDate(directRows, '税费缴纳')
      : undefined,
    paymentStatus,
    refundedAmount,
    refundDate: refundedAmount > 0
      ? getLatestTaxMatterSettlementDate(directRows, '税费退还')
      : undefined,
    refundStatus
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord)
  };
}

export function buildTaxMatterPaymentTransaction({
  financePrimaryCategories,
  financeRows,
  financeSecondaryCategories,
  paymentAmount,
  paymentDate,
  paymentReceiptFile,
  publicAccountRef,
  record,
}: {
  financePrimaryCategories?: FinancePrimaryCategoryConfig[];
  financeRows: FinanceTransactionRecord[];
  financeSecondaryCategories?: FinanceSecondaryCategoryConfig[];
  paymentAmount?: number;
  paymentDate?: string;
  paymentReceiptFile?: RelatedFileRecord;
  publicAccountRef?: PublicAccountRef;
  record: FinanceTaxMatterRecord;
}): FinanceTransactionRecord | undefined {
  if (!publicAccountRef || !['部分缴纳', '已缴纳'].includes(record.paymentStatus) || record.paidAmount <= 0) {
    return undefined;
  }

  const linkedAmount = getTaxMatterLinkedPaymentAmount(record, financeRows);
  const amountToRegister = roundMoney(paymentAmount ?? record.paidAmount - linkedAmount);

  if (amountToRegister <= 0) {
    return undefined;
  }

  const resolvedPaymentDate = paymentDate ?? record.paymentDate;

  if (!resolvedPaymentDate) {
    return undefined;
  }

  const occurredAt = resolvedPaymentDate;
  const accountingPeriod = occurredAt.slice(0, 7);
  const transactionNo = getNextFinanceTransactionNo(financeRows, accountingPeriod);
  const files = paymentReceiptFile
    ? [{ ...paymentReceiptFile, type: '缴款回单' }]
    : copyTaxMatterPaymentFilesToTransaction(record.files);
  const taxPaymentAllocations = buildTaxMatterPaymentAllocations(record, financeRows, amountToRegister);

  if (
    record.matterType === '增值税及附加' &&
    (
      !taxPaymentAllocations ||
      Math.abs(taxPaymentAllocations.reduce((total, allocation) => total + allocation.amount, 0) - amountToRegister) > 0.01
    )
  ) {
    return undefined;
  }

  if (files.length === 0) {
    return undefined;
  }

  return {
    accountingPeriod,
    amount: amountToRegister,
    category: '税费缴纳',
    categorySnapshot: getFinanceCategorySnapshot('税费缴纳', financePrimaryCategories, financeSecondaryCategories),
    counterparty: getTaxMatterCounterparty(record.matterType),
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '支出',
    files,
    id: `fin-tax-${transactionNo}`,
    note: `${record.title}缴款回填`,
    occurredAt,
    operationRecords: [
      {
        action: '登记流水',
        actor: '李明',
        id: `fin-op-tax-payment-${transactionNo}`,
        object: transactionNo,
        summary: `由 ${record.matterNo} 生成税费缴纳流水`,
        time: `${financeToday} 15:30`
      }
    ],
    paymentMethod: '对公账户付款',
    publicAccountId: publicAccountRef.publicAccountId,
    publicAccountSnapshot: publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    reviewDueAt: getDefaultFinanceReviewDueAt(occurredAt),
    sourceNo: record.matterNo,
    sourceTitle: record.title,
    sourceType: '税费事项',
    taxPaymentAllocations,
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 15:30`,
    voucherStatus: files.length > 0 ? '已上传' : '待补充'
  };
}

export function attachTaxMatterPaymentTransaction(
  record: FinanceTaxMatterRecord,
  transaction: FinanceTransactionRecord | undefined
): FinanceTaxMatterRecord {
  if (!transaction) {
    return record;
  }

  return {
    ...record,
    linkedTransactionNos: [...record.linkedTransactionNos, transaction.transactionNo],
    operationRecords: [
      ...record.operationRecords,
      {
        action: '生成缴款流水',
        actor: '李明',
        id: `tax-op-payment-flow-${Date.now()}`,
        object: record.matterNo,
        summary: `生成待复核缴款流水 ${transaction.transactionNo}`,
        time: `${financeToday} 15:35`
      }
    ]
  };
}

export function buildTaxMatterRefundTransaction({
  financePrimaryCategories,
  financeRows,
  financeSecondaryCategories,
  publicAccountRef,
  record,
  refundAmount,
  refundDate,
  refundReceiptFile
}: {
  financePrimaryCategories?: FinancePrimaryCategoryConfig[];
  financeRows: FinanceTransactionRecord[];
  financeSecondaryCategories?: FinanceSecondaryCategoryConfig[];
  publicAccountRef?: PublicAccountRef;
  record: FinanceTaxMatterRecord;
  refundAmount: number;
  refundDate: string;
  refundReceiptFile: RelatedFileRecord;
}): FinanceTransactionRecord | undefined {
  if (!publicAccountRef || refundAmount <= 0 || !refundDate || record.settlementDirection !== '应退') {
    return undefined;
  }

  const linkedAmount = getTaxMatterLinkedRefundAmount(record, financeRows);
  const registeredRefundAmount = roundMoney((record.refundedAmount ?? 0) - linkedAmount);

  if (Math.abs(registeredRefundAmount - refundAmount) > 0.01) {
    return undefined;
  }

  const accountingPeriod = refundDate.slice(0, 7);
  const transactionNo = getNextFinanceTransactionNo(financeRows, accountingPeriod);
  const taxPaymentAllocations = buildTaxMatterRefundAllocations(record, financeRows, refundAmount);

  if (record.matterType === '增值税及附加' && !taxPaymentAllocations) {
    return undefined;
  }

  return {
    accountingPeriod,
    amount: refundAmount,
    category: '税费退还',
    categorySnapshot: getFinanceCategorySnapshot('税费退还', financePrimaryCategories, financeSecondaryCategories),
    counterparty: getTaxMatterCounterparty(record.matterType),
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '收入',
    files: [{ ...refundReceiptFile, type: '退税回单' }],
    id: `fin-tax-refund-${transactionNo}`,
    note: `${record.title}退税到账`,
    occurredAt: refundDate,
    operationRecords: [
      {
        action: '登记流水',
        actor: '李明',
        id: `fin-op-tax-refund-${transactionNo}`,
        object: transactionNo,
        summary: `由 ${record.matterNo} 生成税费退还流水`,
        time: `${financeToday} 15:30`
      }
    ],
    paymentMethod: '对公账户收款',
    publicAccountId: publicAccountRef.publicAccountId,
    publicAccountSnapshot: publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    reviewDueAt: getDefaultFinanceReviewDueAt(refundDate),
    sourceNo: record.matterNo,
    sourceTitle: record.title,
    sourceType: '税费事项',
    taxPaymentAllocations,
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 15:30`,
    voucherStatus: '已上传'
  };
}

export function attachTaxMatterRefundTransaction(
  record: FinanceTaxMatterRecord,
  transaction: FinanceTransactionRecord | undefined
): FinanceTaxMatterRecord {
  if (!transaction) {
    return record;
  }

  return {
    ...record,
    linkedTransactionNos: [...record.linkedTransactionNos, transaction.transactionNo],
    operationRecords: [
      ...record.operationRecords,
      {
        action: '生成退税流水',
        actor: '李明',
        id: `tax-op-refund-flow-${Date.now()}`,
        object: record.matterNo,
        summary: `生成待复核退税流水 ${transaction.transactionNo}`,
        time: `${financeToday} 15:35`
      }
    ]
  };
}
