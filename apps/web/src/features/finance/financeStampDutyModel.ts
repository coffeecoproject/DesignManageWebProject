import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type {
  CustomerContractBusinessNature,
  CustomerContractRecord,
  CustomerRecord
} from '../customers/customerData';
import {
  getActiveFinanceTaxPolicyProfile,
  type FinanceStampDutyPolicy,
  type FinanceStampDutyTaxItem
} from './financeTaxPolicyModel';

export type FinanceStampDutySourceType = '客户合同' | '补录应税凭证' | '营业账簿';
export type FinanceStampDutyResolutionStatus = '待确认' | '可申报' | '待后续结算' | '已完成';
export type FinanceStampDutyDeclarationScenario = '季度申报' | '按次申报' | '年度申报';
export type FinanceStampDutyAmountTaxMode = '价税分列' | '含税未分列' | '不涉及增值税';
export type FinanceStampDutyAdjustmentType = '正常' | '调增' | '调减' | '非金额变更';
export type FinanceStampDutyTaxTreatment = '待确认' | '应税' | '非应税' | '抵缴';

export type FinanceStampDutyTaxItemAllocation = {
  id: string;
  taxableBasis: number;
  taxItem: FinanceStampDutyTaxItem;
};

export type FinanceStampDutySourceResolution = {
  allocations: FinanceStampDutyTaxItemAllocation[];
  obligationPeriod: string;
  reason: string;
  resolvedAt: string;
  resolvedBy: string;
  sourceId: string;
  sourceVersion: string;
  treatment: Exclude<FinanceStampDutyTaxTreatment, '待确认'>;
};

export type FinanceStampDutySourceRecord = {
  adjustmentType: FinanceStampDutyAdjustmentType;
  allocationId?: string;
  counterparty: string;
  counterpartyInvolvedAmount?: number;
  counterpartyTaxId?: string;
  declarationScenario: FinanceStampDutyDeclarationScenario;
  documentName: string;
  documentNo?: string;
  estimatedPayableAmount: number;
  evidenceFiles: RelatedFileRecord[];
  id: string;
  legalTaxRate?: number;
  obligationPeriod: string;
  reductionAmount: number;
  reductionPolicyCode?: string;
  reductionPolicyName?: string;
  resolutionStatus: FinanceStampDutyResolutionStatus;
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  settlementDate?: string;
  signedAt?: string;
  snapshotKey: string;
  sourceId: string;
  sourceNo: string;
  sourceType: FinanceStampDutySourceType;
  sourceVersion: string;
  statedAmount?: number;
  statedVatAmount?: number;
  taxBeforeReduction: number;
  taxableBasis: number;
  taxItem: FinanceStampDutyTaxItem | '待确认';
  taxTreatment: FinanceStampDutyTaxTreatment;
  amountTaxMode: FinanceStampDutyAmountTaxMode;
};

export type FinanceStampDutyManualDocumentInput = {
  amountTaxMode: FinanceStampDutyAmountTaxMode;
  counterparty: string;
  counterpartyTaxId: string;
  documentName: string;
  documentNo?: string;
  evidenceFiles: RelatedFileRecord[];
  id: string;
  signedAt: string;
  sourceNo: string;
  sourceVersion: string;
  statedAmount?: number;
  statedVatAmount?: number;
  taxItem: FinanceStampDutyTaxItem;
};

export type FinanceStampDutyCapitalBookInput = {
  capitalReserveEndingBalance: number;
  historicalTaxedMaximumBasis?: number;
  period: string;
  paidInCapitalEndingBalance: number;
  sourceVersion: string;
};

export type FinanceStampDutyPreparationSummary = {
  declarableCount: number;
  estimatedPayableAmount: number;
  pendingCount: number;
  reductionAmount: number;
  sourceCount: number;
  taxBeforeReduction: number;
  taxableBasis: number;
  waitingSettlementCount: number;
};

const taxItemByBusinessNature: Partial<Record<CustomerContractBusinessNature, FinanceStampDutyTaxItem>> = {
  工程施工: '建设工程合同',
  采购或销售: '买卖合同',
  租赁: '租赁合同',
  技术服务: '技术合同'
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getQuarterPeriod(date: string) {
  const [year, monthText] = date.split('-');
  const month = Number(monthText);
  const quarter = Math.ceil(month / 3);

  return `${year}-Q${quarter}`;
}

function getNextMonthPeriod(date: string) {
  const [yearText, monthText] = date.split('-');
  const currentDate = new Date(Number(yearText), Number(monthText), 1);

  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
}

function resolveDeclarationScenario(policy: FinanceStampDutyPolicy, sourceType: FinanceStampDutySourceType) {
  const cycle = sourceType === '营业账簿' ? policy.declarationCycles.capitalBooks : policy.declarationCycles.taxableDocuments;

  if (cycle === '按年') {
    return '年度申报' as const;
  }

  return cycle === '按季' ? ('季度申报' as const) : ('按次申报' as const);
}

function resolveObligationPeriod(
  signedAt: string,
  scenario: FinanceStampDutyDeclarationScenario
) {
  if (scenario === '季度申报') {
    return getQuarterPeriod(signedAt);
  }

  if (scenario === '年度申报') {
    return signedAt.slice(0, 4);
  }

  return signedAt;
}

function resolveTaxItemPolicy(policy: FinanceStampDutyPolicy, taxItem: FinanceStampDutyTaxItem | '待确认') {
  return taxItem === '待确认' ? undefined : policy.items.find((itemPolicy) => itemPolicy.item === taxItem);
}

export function validateStampDutyDocumentAmounts({
  amount,
  amountTaxMode,
  vatAmount
}: {
  amount?: number;
  amountTaxMode: FinanceStampDutyAmountTaxMode;
  vatAmount?: number;
}) {
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return '凭证金额必须大于 0';
  }

  if (amountTaxMode === '价税分列') {
    if (vatAmount !== undefined && (!Number.isFinite(vatAmount) || vatAmount < 0)) {
      return '单列增值税额不能为负数';
    }

    if (amount !== undefined && vatAmount !== undefined && vatAmount >= amount) {
      return '单列增值税额必须小于凭证金额';
    }
  }

  return undefined;
}

function calculateTaxableBasis(
  amount: number | undefined,
  amountTaxMode: FinanceStampDutyAmountTaxMode,
  vatAmount: number | undefined
) {
  if (!amount || amount <= 0) {
    return 0;
  }

  if (amountTaxMode !== '价税分列') {
    return roundMoney(amount);
  }

  return roundMoney(Math.max(amount - (vatAmount ?? 0), 0));
}

function calculateAmounts(
  taxableBasis: number,
  taxItem: FinanceStampDutyTaxItem | '待确认',
  policy: FinanceStampDutyPolicy
) {
  const itemPolicy = resolveTaxItemPolicy(policy, taxItem);
  const taxBeforeReduction = roundMoney(taxableBasis * (itemPolicy?.legalRate ?? 0));
  const reductionRate = policy.reductionEligibility === '符合' ? policy.microTaxFeeReductionRate : 0;
  const reductionAmount = roundMoney(taxBeforeReduction * reductionRate);

  return {
    estimatedPayableAmount: roundMoney(taxBeforeReduction - reductionAmount),
    legalTaxRate: itemPolicy?.legalRate,
    reductionAmount,
    taxBeforeReduction
  };
}

function buildSourceSnapshotKey(record: Omit<FinanceStampDutySourceRecord, 'snapshotKey'>) {
  return [
    record.sourceType,
    record.sourceId,
    record.sourceVersion,
    record.allocationId ?? '-',
    record.taxItem,
    record.taxTreatment,
    record.taxableBasis,
    record.legalTaxRate ?? '-',
    record.reductionAmount,
    record.estimatedPayableAmount,
    record.resolutionStatus
  ].join('|');
}

function withSnapshot(record: Omit<FinanceStampDutySourceRecord, 'snapshotKey'>): FinanceStampDutySourceRecord {
  return {
    ...record,
    snapshotKey: buildSourceSnapshotKey(record)
  };
}

export function resolveStampDutyTaxItem(businessNature: CustomerContractBusinessNature) {
  return taxItemByBusinessNature[businessNature] ?? '待确认';
}

export function buildContractStampDutySource(
  contract: CustomerContractRecord,
  customer: CustomerRecord,
  policy = getActiveFinanceTaxPolicyProfile(contract.signedAt.slice(0, 7)).stampDuty
): FinanceStampDutySourceRecord {
  const taxItem = resolveStampDutyTaxItem(contract.stampDutyFacts.businessNature);
  const declarationScenario = resolveDeclarationScenario(policy, '客户合同');
  const isSupplement = Boolean(contract.stampDutyFacts.parentContractId);
  const isNonAmountSupplement = contract.stampDutyFacts.agreementChangeType === '仅变更非金额条款';
  const isDecreaseSupplement = contract.stampDutyFacts.agreementChangeType === '减少金额';
  const sourceAmount = isSupplement
    ? contract.stampDutyFacts.agreementChangeAmount
    : contract.amount ?? undefined;
  const taxableBasis = calculateTaxableBasis(
    sourceAmount,
    contract.stampDutyFacts.amountTaxMode,
    contract.stampDutyFacts.vatAmount
  );
  const amounts = calculateAmounts(taxableBasis, taxItem, policy);
  const isOpenAmount = !isSupplement && contract.amountMode === '无固定金额';
  const resolutionStatus =
    taxItem === '待确认' || isDecreaseSupplement
      ? '待确认'
      : isNonAmountSupplement
        ? '已完成'
        : isOpenAmount
          ? '待后续结算'
          : '可申报';

  return withSnapshot({
    adjustmentType: isDecreaseSupplement
      ? '调减'
      : isNonAmountSupplement
        ? '非金额变更'
        : isSupplement
          ? '调增'
          : '正常',
    amountTaxMode: contract.stampDutyFacts.amountTaxMode,
    counterparty: customer.name,
    counterpartyInvolvedAmount: sourceAmount,
    counterpartyTaxId: customer.taxpayerIdentificationNo,
    declarationScenario,
    documentName: contract.name,
    documentNo: contract.code,
    estimatedPayableAmount: amounts.estimatedPayableAmount,
    evidenceFiles: contract.files,
    id: `stamp-source-contract-${contract.id}-${contract.stampDutyFacts.signedVersionNo}`,
    legalTaxRate: amounts.legalTaxRate,
    obligationPeriod: resolveObligationPeriod(contract.signedAt, declarationScenario),
    reductionAmount: amounts.reductionAmount,
    reductionPolicyCode: policy.reductionEligibility === '符合' ? 'SIX-TAX-TWO-FEE-50' : undefined,
    reductionPolicyName: policy.reductionEligibility === '符合' ? '六税两费减半征收' : undefined,
    resolutionStatus,
    signedAt: contract.signedAt,
    sourceId: contract.id,
    sourceNo: contract.code,
    sourceType: '客户合同',
    sourceVersion: contract.stampDutyFacts.signedVersionNo,
    statedAmount: sourceAmount,
    statedVatAmount: contract.stampDutyFacts.vatAmount,
    taxBeforeReduction: amounts.taxBeforeReduction,
    taxableBasis,
    taxItem,
    taxTreatment: resolutionStatus === '已完成' ? '非应税' : taxItem === '待确认' || isDecreaseSupplement ? '待确认' : '应税'
  });
}

export function buildManualDocumentStampDutySource(
  input: FinanceStampDutyManualDocumentInput,
  policy = getActiveFinanceTaxPolicyProfile(input.signedAt.slice(0, 7)).stampDuty
): FinanceStampDutySourceRecord {
  const taxItem = input.taxItem;
  const declarationScenario = resolveDeclarationScenario(policy, '补录应税凭证');
  const taxableBasis = calculateTaxableBasis(input.statedAmount, input.amountTaxMode, input.statedVatAmount);
  const amounts = calculateAmounts(taxableBasis, taxItem, policy);
  const missingCounterparty = !input.counterparty.trim() || !input.counterpartyTaxId.trim();
  const isOpenAmount = !input.statedAmount;
  const resolutionStatus = missingCounterparty ? '待确认' : isOpenAmount ? '待后续结算' : '可申报';

  return withSnapshot({
    adjustmentType: '正常',
    amountTaxMode: input.amountTaxMode,
    counterparty: input.counterparty.trim(),
    counterpartyInvolvedAmount: input.statedAmount,
    counterpartyTaxId: input.counterpartyTaxId.trim(),
    declarationScenario,
    documentName: input.documentName,
    documentNo: input.documentNo,
    estimatedPayableAmount: amounts.estimatedPayableAmount,
    evidenceFiles: input.evidenceFiles,
    id: `stamp-source-manual-${input.id}-${input.sourceVersion}`,
    legalTaxRate: amounts.legalTaxRate,
    obligationPeriod: resolveObligationPeriod(input.signedAt, declarationScenario),
    reductionAmount: amounts.reductionAmount,
    reductionPolicyCode: policy.reductionEligibility === '符合' ? 'SIX-TAX-TWO-FEE-50' : undefined,
    reductionPolicyName: policy.reductionEligibility === '符合' ? '六税两费减半征收' : undefined,
    resolutionStatus,
    signedAt: input.signedAt,
    sourceId: input.id,
    sourceNo: input.sourceNo,
    sourceType: '补录应税凭证',
    sourceVersion: input.sourceVersion,
    statedAmount: input.statedAmount,
    statedVatAmount: input.statedVatAmount,
    taxBeforeReduction: amounts.taxBeforeReduction,
    taxableBasis,
    taxItem,
    taxTreatment: resolutionStatus === '待确认' ? '待确认' : '应税'
  });
}

export function buildCapitalBookStampDutySource(
  input: FinanceStampDutyCapitalBookInput,
  policy = getActiveFinanceTaxPolicyProfile(`${input.period}-12`).stampDuty
): FinanceStampDutySourceRecord {
  const declarationScenario = resolveDeclarationScenario(policy, '营业账簿');
  const endingBasis = roundMoney(input.paidInCapitalEndingBalance + input.capitalReserveEndingBalance);
  const hasHistoricalBasis = typeof input.historicalTaxedMaximumBasis === 'number';
  const taxableBasis = hasHistoricalBasis ? roundMoney(Math.max(endingBasis - input.historicalTaxedMaximumBasis!, 0)) : 0;
  const amounts = calculateAmounts(taxableBasis, '营业账簿', policy);

  return withSnapshot({
    adjustmentType: '正常',
    amountTaxMode: '不涉及增值税',
    counterparty: '本企业营业账簿',
    declarationScenario,
    documentName: `${input.period} 年营业账簿新增额`,
    estimatedPayableAmount: amounts.estimatedPayableAmount,
    evidenceFiles: [],
    id: `stamp-source-capital-book-${input.period}`,
    legalTaxRate: amounts.legalTaxRate,
    obligationPeriod: input.period,
    reductionAmount: amounts.reductionAmount,
    reductionPolicyCode: policy.reductionEligibility === '符合' ? 'SIX-TAX-TWO-FEE-50' : undefined,
    reductionPolicyName: policy.reductionEligibility === '符合' ? '六税两费减半征收' : undefined,
    resolutionStatus: hasHistoricalBasis ? '可申报' : '待确认',
    sourceId: `capital-book-${input.period}`,
    sourceNo: `STAMP-BOOK-${input.period}`,
    sourceType: '营业账簿',
    sourceVersion: input.sourceVersion,
    statedAmount: endingBasis,
    taxBeforeReduction: amounts.taxBeforeReduction,
    taxableBasis,
    taxItem: '营业账簿',
    taxTreatment: hasHistoricalBasis ? '应税' : '待确认'
  });
}

export function buildStampDutySettlementEvent(
  source: FinanceStampDutySourceRecord,
  settlement: { amount: number; id: string; settledAt: string }
): FinanceStampDutySourceRecord {
  if (source.resolutionStatus !== '待后续结算') {
    throw new Error('只有待后续结算的应税凭证可以登记结算事件');
  }

  const policy = getActiveFinanceTaxPolicyProfile(settlement.settledAt.slice(0, 7)).stampDuty;
  const taxableBasis = roundMoney(settlement.amount);
  const amounts = calculateAmounts(taxableBasis, source.taxItem, policy);
  const nextPeriod = getNextMonthPeriod(settlement.settledAt);
  const declarationScenario = resolveDeclarationScenario(policy, source.sourceType);

  return withSnapshot({
    ...source,
    declarationScenario,
    estimatedPayableAmount: amounts.estimatedPayableAmount,
    id: `${source.id}-settlement-${settlement.id}`,
    legalTaxRate: amounts.legalTaxRate,
    obligationPeriod: declarationScenario === '季度申报' ? getQuarterPeriod(`${nextPeriod}-01`) : nextPeriod,
    reductionAmount: amounts.reductionAmount,
    resolutionStatus: '可申报',
    settlementDate: settlement.settledAt,
    sourceId: `${source.sourceId}-settlement-${settlement.id}`,
    sourceNo: `${source.sourceNo}-${settlement.id}`,
    sourceVersion: `${source.sourceVersion}-settlement-${settlement.id}`,
    statedAmount: settlement.amount,
    taxBeforeReduction: amounts.taxBeforeReduction,
    taxableBasis
  });
}

export function applyStampDutySourceResolution(
  source: FinanceStampDutySourceRecord,
  resolution: FinanceStampDutySourceResolution,
  policy = getActiveFinanceTaxPolicyProfile(source.signedAt?.slice(0, 7) ?? source.obligationPeriod).stampDuty
): FinanceStampDutySourceRecord[] {
  if (source.sourceId !== resolution.sourceId || source.sourceVersion !== resolution.sourceVersion) {
    return [source];
  }

  const commonResolution = {
    resolutionNote: resolution.reason.trim(),
    resolvedAt: resolution.resolvedAt,
    resolvedBy: resolution.resolvedBy
  };

  if (resolution.treatment === '非应税') {
    return [
      withSnapshot({
        ...source,
        ...commonResolution,
        estimatedPayableAmount: 0,
        legalTaxRate: undefined,
        reductionAmount: 0,
        resolutionStatus: '已完成',
        taxBeforeReduction: 0,
        taxableBasis: 0,
        taxItem: '待确认',
        taxTreatment: '非应税'
      })
    ];
  }

  if (resolution.allocations.length === 0) {
    throw new Error('应税或抵缴税源至少需要一条税目分配');
  }

  const allocatedBasis = roundMoney(resolution.allocations.reduce((total, allocation) => total + allocation.taxableBasis, 0));
  const expectedBasis = roundMoney(source.taxableBasis);

  if (allocatedBasis !== expectedBasis) {
    throw new Error('多税目分配的计税依据合计必须等于税源计税依据');
  }

  return resolution.allocations.map((allocation) => {
    const signedBasis = resolution.treatment === '抵缴' ? -Math.abs(allocation.taxableBasis) : allocation.taxableBasis;
    const amounts = calculateAmounts(Math.abs(signedBasis), allocation.taxItem, policy);
    const sign = signedBasis < 0 ? -1 : 1;

    return withSnapshot({
      ...source,
      ...commonResolution,
      allocationId: allocation.id,
      estimatedPayableAmount: roundMoney(amounts.estimatedPayableAmount * sign),
      legalTaxRate: amounts.legalTaxRate,
      reductionAmount: roundMoney(amounts.reductionAmount * sign),
      resolutionStatus: '可申报',
      taxBeforeReduction: roundMoney(amounts.taxBeforeReduction * sign),
      taxableBasis: roundMoney(signedBasis),
      taxItem: allocation.taxItem,
      taxTreatment: resolution.treatment
    });
  });
}

export function applyStampDutySourceResolutions(
  records: FinanceStampDutySourceRecord[],
  resolutions: FinanceStampDutySourceResolution[]
) {
  const resolutionBySource = new Map(
    resolutions.map((resolution) => [`${resolution.sourceId}|${resolution.sourceVersion}`, resolution])
  );

  return records.flatMap((record) => {
    const resolution = resolutionBySource.get(`${record.sourceId}|${record.sourceVersion}`);
    return resolution ? applyStampDutySourceResolution(record, resolution) : [record];
  });
}

export function assertUniqueStampDutySources(records: FinanceStampDutySourceRecord[]) {
  const keys = records.map((record) => `${record.sourceId}|${record.sourceVersion}|${record.allocationId ?? record.taxItem}`);

  if (new Set(keys).size !== keys.length) {
    throw new Error('印花税税源存在重复的来源版本与税目');
  }
}

export function buildStampDutyPreparationSummary(records: FinanceStampDutySourceRecord[]): FinanceStampDutyPreparationSummary {
  assertUniqueStampDutySources(records);

  return records.reduce<FinanceStampDutyPreparationSummary>(
    (summary, record) => ({
      declarableCount: summary.declarableCount + (record.resolutionStatus === '可申报' ? 1 : 0),
      estimatedPayableAmount: roundMoney(summary.estimatedPayableAmount + record.estimatedPayableAmount),
      pendingCount: summary.pendingCount + (record.resolutionStatus === '待确认' ? 1 : 0),
      reductionAmount: roundMoney(summary.reductionAmount + record.reductionAmount),
      sourceCount: summary.sourceCount + 1,
      taxBeforeReduction: roundMoney(summary.taxBeforeReduction + record.taxBeforeReduction),
      taxableBasis: roundMoney(summary.taxableBasis + record.taxableBasis),
      waitingSettlementCount: summary.waitingSettlementCount + (record.resolutionStatus === '待后续结算' ? 1 : 0)
    }),
    {
      declarableCount: 0,
      estimatedPayableAmount: 0,
      pendingCount: 0,
      reductionAmount: 0,
      sourceCount: 0,
      taxBeforeReduction: 0,
      taxableBasis: 0,
      waitingSettlementCount: 0
    }
  );
}

export function buildStampDutySourceSnapshotKey(records: FinanceStampDutySourceRecord[]) {
  return [...records]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => record.snapshotKey)
    .join('||');
}
