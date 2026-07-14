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
  FinanceTaxMatterDeclarationStatus,
  FinanceTaxMatterAccountingStatus,
  FinanceTaxMatterDataStatus,
  FinanceTaxMatterEvidenceStatus,
  FinanceTaxMatterProcessStatus,
  FinanceTaxMatterRecord,
  FinanceTaxMatterSettlementDirection,
  FinanceTaxMatterSourceItem,
  FinanceTaxMatterType
} from './financeTaxFilingData';
import { financeToday, getDefaultFinanceReviewDueAt } from './financeUtils';

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

export type TaxMatterReceiptFileType = '申报回执' | '缴款回单' | '退税回单';

export type TaxMatterDeclarationResultInput = {
  declarationDate: string;
  declarationReceiptFile?: RelatedFileRecord;
  declarationReceiptNo?: string;
  declarationStatus: Extract<FinanceTaxMatterDeclarationStatus, '申报成功' | '零申报'>;
  differenceReason?: string;
  settlementAmount: number;
  settlementDirection: Exclude<FinanceTaxMatterSettlementDirection, '待确定'>;
};

export type TaxMatterDeclarationRevisionContext = {
  historyId?: string;
  operatedAt?: string;
  operatedBy?: string;
  operationId?: string;
};

export function getTaxMatterDeclarationResultValidationError(
  record: Pick<FinanceTaxMatterRecord, 'matterType' | 'preparedPayableAmount'>,
  input: Pick<TaxMatterDeclarationResultInput, 'declarationStatus' | 'settlementAmount' | 'settlementDirection'>
) {
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

export type TaxMatterDeclarationReceiptInput = {
  declarationReceiptFile?: RelatedFileRecord;
  declarationReceiptNo?: string;
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
    '申报回执',
    ...(['部分缴纳', '已缴纳'].includes(record.paymentStatus) ? ['缴款回单' as const] : [])
  ];
}

export function getTaxMatterOutstandingAmount(
  record: Pick<FinanceTaxMatterRecord, 'paidAmount' | 'payableAmount' | 'refundableAmount' | 'refundedAmount'>
) {
  const officialNetPayable = record.payableAmount - (record.refundableAmount ?? 0);
  const settledNetPayable = record.paidAmount - (record.refundedAmount ?? 0);
  return roundMoney(Math.max(0, officialNetPayable - settledNetPayable));
}

export function getTaxMatterRefundOutstandingAmount(
  record: Pick<FinanceTaxMatterRecord, 'paidAmount' | 'payableAmount' | 'refundableAmount' | 'refundedAmount'>
) {
  const officialNetRefundable = (record.refundableAmount ?? 0) - record.payableAmount;
  const settledNetRefundable = (record.refundedAmount ?? 0) - record.paidAmount;
  return roundMoney(Math.max(0, officialNetRefundable - settledNetRefundable));
}

export function getTaxMatterAccountingAmount(
  record: Pick<
    FinanceTaxMatterRecord,
    'matterType' | 'payableAmount' | 'refundableAmount' | 'socialInsuranceSettlement' | 'vatSettlement'
  >
) {
  if (record.matterType === '增值税及附加') {
    return roundMoney(record.vatSettlement?.surcharge.totalAfterReduction ?? 0);
  }

  if (record.matterType === '个人所得税') {
    return 0;
  }

  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return roundMoney(record.socialInsuranceSettlement?.companyAmount ?? 0);
  }

  return roundMoney(record.payableAmount - (record.refundableAmount ?? 0));
}

export function getTaxMatterAccountingDelta(record: FinanceTaxMatterRecord) {
  const currentAmount = getTaxMatterAccountingAmount(record);
  const previousVersion = record.declarationHistory.at(-1);

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

  return ['申报成功', '零申报'].includes(record.declarationStatus) ? ['申报回执'] : [];
}

export function getTaxMatterEvidenceStatus(
  record: Pick<FinanceTaxMatterRecord, 'declarationReceiptFileId' | 'declarationReceiptNo' | 'declarationStatus' | 'matterType'>
): FinanceTaxMatterEvidenceStatus {
  if (isSocialInsuranceTaxMatter(record.matterType) || record.declarationStatus === '无申报义务') {
    return '无需回执';
  }

  if (!['申报成功', '零申报'].includes(record.declarationStatus)) {
    return '待补回执';
  }

  return record.declarationReceiptFileId || record.declarationReceiptNo ? '已齐全' : '待补回执';
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
    'dataStatus' | 'declarationReceiptFileId' | 'declarationReceiptNo' | 'declarationStatus' | 'matterType' | 'paidAmount' | 'payableAmount' | 'refundableAmount' | 'refundedAmount' | 'settlementDirection'
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
    return record.paidAmount > 0 ? '部分缴纳' : '待缴款';
  }

  const outstandingRefund = getTaxMatterRefundOutstandingAmount(record);
  if (outstandingRefund > 0) {
    return (record.refundedAmount ?? 0) > 0 ? '部分退税' : '待退税';
  }

  return record.declarationReceiptFileId || record.declarationReceiptNo ? '已完成' : '待补回执';
}

export function recordTaxMatterDeclarationResult(
  record: FinanceTaxMatterRecord,
  input: TaxMatterDeclarationResultInput
): FinanceTaxMatterRecord {
  if (getTaxMatterDeclarationResultValidationError(record, input)) {
    return record;
  }

  const settlementDirection = input.declarationStatus === '零申报' ? '无需补退' : input.settlementDirection;
  const settlementAmount = settlementDirection === '无需补退' ? 0 : roundMoney(input.settlementAmount);
  const payableAmount = settlementDirection === '应缴' ? settlementAmount : 0;
  const refundableAmount = settlementDirection === '应退' ? settlementAmount : 0;
  const declarationReceiptFileId = input.declarationReceiptFile?.id;
  const nextFiles = input.declarationReceiptFile
    ? [input.declarationReceiptFile, ...record.files]
    : record.files;
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    declarationDate: input.declarationDate,
    declarationDifferenceReason: input.differenceReason?.trim() || undefined,
    declarationReceiptFileId,
    declarationReceiptNo: input.declarationReceiptNo?.trim() || undefined,
    declarationStatus: input.declarationStatus,
    files: nextFiles,
    payableAmount,
    refundableAmount,
    refundStatus: refundableAmount > 0 ? '待退税' : '不适用',
    settlementDirection,
    paymentStatus: payableAmount <= 0
      ? '无需缴纳'
      : record.paidAmount <= 0
        ? '待缴纳'
        : record.paidAmount < payableAmount
          ? '部分缴纳'
          : '已缴纳',
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: record.declarationVersion > 1 ? '登记更正结果' : '登记申报结果',
        actor: '李明',
        id: `tax-op-declaration-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: `${input.declarationStatus}，${settlementDirection} ${settlementAmount.toFixed(2)} 元`,
        time: `${financeToday} 15:10`
      },
      ...record.operationRecords
    ]
  };
}

export function supplementTaxMatterDeclarationReceipt(
  record: FinanceTaxMatterRecord,
  input: TaxMatterDeclarationReceiptInput
): FinanceTaxMatterRecord {
  const declarationReceiptNo = input.declarationReceiptNo?.trim() || undefined;

  if (
    !['申报成功', '零申报'].includes(record.declarationStatus)
    || (!input.declarationReceiptFile && !declarationReceiptNo)
  ) {
    return record;
  }

  const nextFiles = input.declarationReceiptFile
    ? [input.declarationReceiptFile, ...record.files.filter((file) => file.id !== input.declarationReceiptFile?.id)]
    : record.files;
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    declarationReceiptFileId: input.declarationReceiptFile?.id ?? record.declarationReceiptFileId,
    declarationReceiptNo: declarationReceiptNo ?? record.declarationReceiptNo,
    files: nextFiles,
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: '补充申报回执',
        actor: '李明',
        id: `tax-op-declaration-receipt-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: input.declarationReceiptFile
          ? `上传 ${input.declarationReceiptFile.name}`
          : `登记申报回执号 ${declarationReceiptNo}`,
        time: `${financeToday} 15:20`
      },
      ...record.operationRecords
    ]
  };
}

export function recordTaxMatterRefundResult(
  record: FinanceTaxMatterRecord,
  input: TaxMatterRefundResultInput
): FinanceTaxMatterRecord {
  const refundedAmount = roundMoney((record.refundedAmount ?? 0) + input.amount);
  const refundableAmount = record.refundableAmount ?? 0;
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    files: [input.receiptFile, ...record.files],
    refundedAmount,
    refundDate: input.refundDate,
    refundStatus: refundedAmount < refundableAmount ? '部分退税' : '已退税',
    updatedAt: financeToday
  };

  return {
    ...nextRecord,
    processStatus: deriveTaxMatterProcessStatus(nextRecord),
    operationRecords: [
      {
        action: '登记退税',
        actor: '李明',
        id: `tax-op-refund-${record.id}-${Date.now()}`,
        object: record.matterNo,
        summary: `登记退税 ${input.amount.toFixed(2)} 元`,
        time: `${financeToday} 15:25`
      },
      ...record.operationRecords
    ]
  };
}

export function recordTaxMatterPaymentResult(
  record: FinanceTaxMatterRecord,
  input: TaxMatterPaymentResultInput
): FinanceTaxMatterRecord {
  const paidAmount = roundMoney(record.paidAmount + input.amount);
  const nextRecord: FinanceTaxMatterRecord = {
    ...record,
    files: [input.receiptFile, ...record.files],
    paidAmount,
    paymentDate: input.paymentDate,
    paymentStatus: paidAmount < record.payableAmount ? '部分缴纳' : '已缴纳',
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
    declarationReceiptFileId: record.declarationReceiptFileId,
    declarationReceiptNo: record.declarationReceiptNo,
    declarationStatus: record.declarationStatus,
    filedAccountingAmount: getTaxMatterAccountingAmount(record),
    filedPayableAmount: record.payableAmount,
    filedRefundableAmount: record.refundableAmount,
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
    declarationHistory: [...record.declarationHistory, currentHistory],
    declarationReceiptFileId: undefined,
    declarationReceiptNo: undefined,
    declarationStatus: '待申报',
    declarationVersion: record.declarationVersion + 1,
    payableAmount: record.preparedPayableAmount,
    refundableAmount: 0,
    refundStatus: '不适用',
    settlementDirection: '待确定',
    paymentStatus: record.paidAmount <= 0 ? '未开始' : '部分缴纳',
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
        summary: reason.trim(),
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
    sourceRecognizedVatAmount: declaredVatAmount,
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
  const preparedPayableAmount = getDeclarationPreparationPayableAmount(
    preparation,
    usePendingIitCorrection
  );
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
      paidAmount: 0,
      participantSummary,
      payableAmount: 0,
      preparedPayableAmount: 0,
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
        declarationHistory: [],
        declarationScenario: '月度扣缴',
        declarationStatus: '待申报',
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

export function getTaxMatterLinkedPaymentAmount(record: FinanceTaxMatterRecord, financeRows: FinanceTransactionRecord[]) {
  const linkedNos = new Set(record.linkedTransactionNos);

  return roundMoney(
    financeRows
      .filter((row) => linkedNos.has(row.transactionNo) && row.direction === '支出' && row.status !== '已作废')
      .reduce((total, row) => total + row.amount, 0)
  );
}

export function getTaxMatterLinkedRefundAmount(record: FinanceTaxMatterRecord, financeRows: FinanceTransactionRecord[]) {
  const linkedNos = new Set(record.linkedTransactionNos);

  return roundMoney(
    financeRows
      .filter((row) => linkedNos.has(row.transactionNo) && row.direction === '收入' && row.status !== '已作废')
      .reduce((total, row) => total + row.amount, 0)
  );
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
    id: `fin-tax-${record.matterNo}-${Date.now()}`,
    note: `${record.title}缴款回填`,
    occurredAt,
    operationRecords: [
      {
        action: '登记流水',
        actor: '李明',
        id: `fin-op-tax-payment-${Date.now()}`,
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
    id: `fin-tax-refund-${record.matterNo}-${Date.now()}`,
    note: `${record.title}退税到账`,
    occurredAt: refundDate,
    operationRecords: [
      {
        action: '登记流水',
        actor: '李明',
        id: `fin-op-tax-refund-${Date.now()}`,
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
