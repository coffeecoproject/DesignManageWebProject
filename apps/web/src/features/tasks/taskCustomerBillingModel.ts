import {
  isBrandPricingContractEligible,
  type BrandPricingContract,
  type BrandSettlementPolicyVersionRecord,
  type BrandSettlementPolicy,
  type BrandTaskPriceVersionRecord
} from '../customers/brandTaskPricingModel';
import {
  cloneBrandAcceptancePolicy,
  type BrandAcceptancePolicy,
  type BrandAcceptanceTimelinessResult
} from '../customers/brandAcceptancePolicyModel';

export type TaskCustomerBillingSnapshot = {
  acceptancePolicy: BrandAcceptancePolicy;
  billable: boolean;
  brandId: string;
  brandName: string;
  capturedAt: string;
  contractAmount: number | null;
  contractAmountMode?: BrandPricingContract['amountMode'];
  contractCode?: string;
  contractId?: string;
  contractName?: string;
  contractAmountTaxMode?: BrandPricingContract['amountTaxMode'];
  currency: 'CNY';
  customerId: string;
  customerName: string;
  id: string;
  priceVersion: number;
  priceVersionId: string;
  settlementPolicy: BrandSettlementPolicy;
  settlementPolicyVersion: number;
  settlementPolicyVersionId: string;
  taskConfigId: string;
  taskId: string;
  unitPrice: number;
};

export type CustomerTaskBillingFactStatus = '待甲方验收' | '有效' | '不计费' | '已冲销';

export type CustomerTaskAcceptanceEvidence = {
  id: string;
  name: string;
  source: string;
  status: string;
  type: string;
  updatedAt: string;
  url: string;
};

export type CustomerTaskBillingFact = {
  acceptedAt: string;
  acceptedBy: string;
  amount: number;
  customerAcceptanceCorrectionReason?: string;
  customerAcceptanceRemark?: string;
  customerAcceptedOn?: string;
  customerAcceptanceRecordedAt?: string;
  customerAcceptanceRecordedBy?: string;
  customerAcceptanceUpdatedAt?: string;
  customerAcceptanceUpdatedBy?: string;
  customerScore?: number;
  deductionRate: number;
  deductionAmount: number;
  acceptanceEvidence: CustomerTaskAcceptanceEvidence[];
  billingSnapshot: TaskCustomerBillingSnapshot;
  brandId: string;
  customerId: string;
  id: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  settlementPeriod: string;
  status: CustomerTaskBillingFactStatus;
  standardAmount: number;
  qualityPenaltyPoints: number;
  timelinessPenaltyPoints: number;
  timelinessResult?: BrandAcceptanceTimelinessResult;
  totalPenaltyPoints: number;
  storeId: string;
  taskCode: string;
  taskId: string;
  taskName: string;
};

export function reverseCustomerTaskBillingFact(
  fact: CustomerTaskBillingFact,
  input: { actor: string; occurredAt: string; reason: string }
): CustomerTaskBillingFact {
  if (!input.reason.trim()) {
    throw new Error('撤销原因必填');
  }
  if (fact.status === '已冲销') {
    throw new Error('客户结算事实已经撤销');
  }

  return {
    ...fact,
    reversedAt: input.occurredAt,
    reversedBy: input.actor,
    reversalReason: input.reason.trim(),
    status: '已冲销'
  };
}

export type CustomerTaskSettlementLine = {
  acceptedAt: string;
  acceptedBy: string;
  amount: number;
  acceptanceEvidence: CustomerTaskAcceptanceEvidence[];
  customerAcceptanceCorrectionReason?: string;
  customerAcceptanceRemark: string;
  customerAcceptedOn: string;
  customerAcceptanceRecordedAt: string;
  customerAcceptanceRecordedBy: string;
  customerAcceptanceUpdatedAt: string;
  customerAcceptanceUpdatedBy: string;
  customerScore: number;
  deductionRate: number;
  deductionAmount: number;
  priceVersion: number;
  priceVersionId: string;
  standardAmount: number;
  qualityPenaltyPoints: number;
  timelinessPenaltyPoints: number;
  timelinessResult: BrandAcceptanceTimelinessResult;
  totalPenaltyPoints: number;
  storeId: string;
  taskCode: string;
  taskId: string;
  taskName: string;
  unitPrice: number;
};

export type CustomerTaskSettlementBatch = {
  amount: number;
  brandId: string;
  brandName: string;
  contractAmount: number | null;
  contractAmountMode?: BrandPricingContract['amountMode'];
  contractCode?: string;
  contractId?: string;
  contractName?: string;
  customerId: string;
  customerName: string;
  dueDate: string;
  generatedAt: string;
  id: string;
  lineItems: CustomerTaskSettlementLine[];
  settlementMode: BrandSettlementPolicy['mode'];
  settlementPolicyVersionId: string;
  settlementPeriod: string;
};

export type CustomerTaskContractUsageStatus = '正常' | '接近上限' | '已超出';

export type CustomerTaskContractUsageSummary = {
  brandIds: string[];
  contractAmount: number;
  contractCode: string;
  contractId: string;
  contractName: string;
  overageAmount: number;
  remainingAmount: number;
  settledAmount: number;
  status: CustomerTaskContractUsageStatus;
  usageRate: number;
};

function toDateOnly(value: string) {
  return value.slice(0, 10);
}

function addDays(value: string, days: number) {
  const [yearValue, monthValue, dayValue] = toDateOnly(value).split('-').map(Number);
  const date = new Date(Date.UTC(yearValue, monthValue - 1, dayValue + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthEnd(period: string) {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNextMonthDueDate(period: string, dueDay: number) {
  const [year, month] = period.split('-').map(Number);
  const target = new Date(year, month, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(dueDay, maxDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

export function buildTaskCustomerBillingSnapshot({
  acceptancePolicy,
  brandId,
  brandName,
  capturedAt,
  contract,
  customerId,
  customerName,
  priceVersion,
  settlementPolicyVersion,
  taskConfigId,
  taskId
}: {
  acceptancePolicy: BrandAcceptancePolicy | undefined;
  brandId: string;
  brandName: string;
  capturedAt: string;
  contract: BrandPricingContract | undefined;
  customerId: string;
  customerName: string;
  priceVersion: BrandTaskPriceVersionRecord | undefined;
  settlementPolicyVersion: BrandSettlementPolicyVersionRecord | undefined;
  taskConfigId: string;
  taskId: string;
}): TaskCustomerBillingSnapshot | undefined {
  if (!acceptancePolicy || !priceVersion || !settlementPolicyVersion) {
    return undefined;
  }

  if (
    priceVersion.billable
    && (
      !contract
      || contract.id !== priceVersion.contractId
      || !isBrandPricingContractEligible(contract, customerId, capturedAt)
    )
  ) {
    return undefined;
  }

  return {
    acceptancePolicy: cloneBrandAcceptancePolicy(acceptancePolicy),
    billable: priceVersion.billable,
    brandId,
    brandName,
    capturedAt,
    contractAmount: contract?.amount ?? null,
    contractAmountMode: contract?.amountMode,
    contractCode: contract?.code,
    contractId: contract?.id,
    contractName: contract?.name,
    contractAmountTaxMode: contract?.amountTaxMode ?? contract?.stampDutyFacts?.amountTaxMode,
    currency: 'CNY',
    customerId,
    customerName,
    id: `task-billing-snapshot-${taskId}`,
    priceVersion: priceVersion.version,
    priceVersionId: priceVersion.id,
    settlementPolicy: { ...settlementPolicyVersion.policy },
    settlementPolicyVersion: settlementPolicyVersion.version,
    settlementPolicyVersionId: settlementPolicyVersion.id,
    taskConfigId,
    taskId,
    unitPrice: priceVersion.billable ? priceVersion.unitPrice : 0
  };
}

export function buildCustomerTaskBillingFact(task: {
  acceptedAt?: string;
  acceptorName?: string;
  code: string;
  customerBillingSnapshot?: TaskCustomerBillingSnapshot;
  customerAcceptance?: {
    acceptedOn: string;
    correctionReason?: string;
    deductionAmount: number;
    deductionRate: number;
    recordedAt: string;
    recordedBy: string;
    remark: string;
    score: number;
    qualityPenaltyPoints: number;
    timelinessPenaltyPoints: number;
    timelinessResult: BrandAcceptanceTimelinessResult;
    totalPenaltyPoints: number;
    updatedAt: string;
    updatedBy: string;
  };
  files?: Array<{
    id: string;
    name: string;
    source?: string;
    stage: string;
    status: string;
    type: string;
    updatedAt: string;
    url?: string;
  }>;
  id: string;
  name: string;
  status: string;
  storeId: string;
}): CustomerTaskBillingFact | undefined {
  if (task.status !== '已完成' || !task.acceptedAt || !task.customerBillingSnapshot) {
    return undefined;
  }

  const acceptanceEvidence = (task.files ?? [])
    .filter((file) => file.stage === '验收归档' && file.source?.trim() && file.url?.trim())
    .map(({ id, name, source, status, type, updatedAt, url }) => ({
      id,
      name,
      source: source!,
      status,
      type,
      updatedAt,
      url: url!
    }));

  if (acceptanceEvidence.length === 0) {
    return undefined;
  }

  const snapshot = task.customerBillingSnapshot;
  const customerAcceptance = task.customerAcceptance;
  const deductionAmount = snapshot.billable ? customerAcceptance?.deductionAmount ?? 0 : 0;
  return {
    acceptedAt: task.acceptedAt,
    acceptedBy: task.acceptorName ?? '系统验收人',
    amount: snapshot.billable ? Math.max(0, snapshot.unitPrice - deductionAmount) : 0,
    acceptanceEvidence,
    billingSnapshot: snapshot,
    brandId: snapshot.brandId,
    customerId: snapshot.customerId,
    customerAcceptanceCorrectionReason: customerAcceptance?.correctionReason,
    customerAcceptanceRemark: customerAcceptance?.remark,
    customerAcceptedOn: customerAcceptance?.acceptedOn,
    customerAcceptanceRecordedAt: customerAcceptance?.recordedAt,
    customerAcceptanceRecordedBy: customerAcceptance?.recordedBy,
    customerAcceptanceUpdatedAt: customerAcceptance?.updatedAt,
    customerAcceptanceUpdatedBy: customerAcceptance?.updatedBy,
    customerScore: customerAcceptance?.score,
    deductionRate: customerAcceptance?.deductionRate ?? 0,
    deductionAmount,
    id: `task-billing-fact-${task.id}`,
    settlementPeriod: customerAcceptance?.acceptedOn.slice(0, 7) ?? task.acceptedAt.slice(0, 7),
    status: snapshot.billable ? (customerAcceptance ? '有效' : '待甲方验收') : '不计费',
    standardAmount: snapshot.billable ? snapshot.unitPrice : 0,
    qualityPenaltyPoints: customerAcceptance?.qualityPenaltyPoints ?? 0,
    storeId: task.storeId,
    taskCode: task.code,
    taskId: task.id,
    taskName: task.name,
    timelinessPenaltyPoints: customerAcceptance?.timelinessPenaltyPoints ?? 0,
    timelinessResult: customerAcceptance?.timelinessResult,
    totalPenaltyPoints: customerAcceptance?.totalPenaltyPoints ?? 0
  };
}

function buildBatchLine(fact: CustomerTaskBillingFact): CustomerTaskSettlementLine {
  if (
    !fact.customerAcceptedOn
    || !fact.customerAcceptanceRecordedAt
    || !fact.customerAcceptanceRecordedBy
    || !fact.customerAcceptanceUpdatedAt
    || !fact.customerAcceptanceUpdatedBy
    || fact.customerScore === undefined
    || !fact.timelinessResult
  ) {
    throw new Error('有效客户结算事实缺少甲方验收信息');
  }

  return {
    acceptedAt: fact.acceptedAt,
    acceptedBy: fact.acceptedBy,
    amount: fact.amount,
    acceptanceEvidence: fact.acceptanceEvidence.map((file) => ({ ...file })),
    customerAcceptanceCorrectionReason: fact.customerAcceptanceCorrectionReason,
    customerAcceptanceRemark: fact.customerAcceptanceRemark ?? '',
    customerAcceptedOn: fact.customerAcceptedOn,
    customerAcceptanceRecordedAt: fact.customerAcceptanceRecordedAt,
    customerAcceptanceRecordedBy: fact.customerAcceptanceRecordedBy,
    customerAcceptanceUpdatedAt: fact.customerAcceptanceUpdatedAt,
    customerAcceptanceUpdatedBy: fact.customerAcceptanceUpdatedBy,
    customerScore: fact.customerScore,
    deductionRate: fact.deductionRate,
    deductionAmount: fact.deductionAmount,
    priceVersion: fact.billingSnapshot.priceVersion,
    priceVersionId: fact.billingSnapshot.priceVersionId,
    standardAmount: fact.standardAmount,
    qualityPenaltyPoints: fact.qualityPenaltyPoints,
    storeId: fact.storeId,
    taskCode: fact.taskCode,
    taskId: fact.taskId,
    taskName: fact.taskName,
    timelinessPenaltyPoints: fact.timelinessPenaltyPoints,
    timelinessResult: fact.timelinessResult!,
    totalPenaltyPoints: fact.totalPenaltyPoints,
    unitPrice: fact.billingSnapshot.unitPrice
  };
}

export function buildCustomerTaskSettlementBatches({
  asOfDate,
  facts
}: {
  asOfDate: string;
  facts: readonly CustomerTaskBillingFact[];
}): { batches: CustomerTaskSettlementBatch[] } {
  const effectiveFacts = facts.filter(
    (fact) => fact.status === '有效' && fact.billingSnapshot.billable && fact.amount > 0
  );
  const candidateBatches: CustomerTaskSettlementBatch[] = [];
  const monthlyGroups = new Map<string, CustomerTaskBillingFact[]>();

  for (const fact of effectiveFacts) {
    const snapshot = fact.billingSnapshot;
    if (snapshot.settlementPolicy.mode === '按任务结算') {
      candidateBatches.push({
        amount: fact.amount,
        brandId: fact.brandId,
        brandName: snapshot.brandName,
        contractAmount: snapshot.contractAmount,
        contractAmountMode: snapshot.contractAmountMode,
        contractCode: snapshot.contractCode,
        contractId: snapshot.contractId,
        contractName: snapshot.contractName,
        customerId: fact.customerId,
        customerName: snapshot.customerName,
        dueDate: addDays(fact.customerAcceptedOn!, snapshot.settlementPolicy.perTaskDueDays ?? 0),
        generatedAt: toDateOnly(asOfDate),
        id: `task-revenue:${fact.taskId}`,
        lineItems: [buildBatchLine(fact)],
        settlementMode: '按任务结算',
        settlementPolicyVersionId: snapshot.settlementPolicyVersionId,
        settlementPeriod: fact.settlementPeriod
      });
      continue;
    }

    const key = [
      fact.settlementPeriod,
      fact.customerId,
      fact.brandId,
      snapshot.contractId ?? 'no-contract',
      snapshot.settlementPolicyVersionId
    ].join(':');
    const group = monthlyGroups.get(key) ?? [];
    group.push(fact);
    monthlyGroups.set(key, group);
  }

  for (const group of monthlyGroups.values()) {
    const first = group[0];
    if (!first || getMonthEnd(first.settlementPeriod) >= toDateOnly(asOfDate)) {
      continue;
    }

    const snapshot = first.billingSnapshot;
    candidateBatches.push({
      amount: group.reduce((sum, fact) => sum + fact.amount, 0),
      brandId: first.brandId,
      brandName: snapshot.brandName,
      contractAmount: snapshot.contractAmount,
      contractAmountMode: snapshot.contractAmountMode,
      contractCode: snapshot.contractCode,
      contractId: snapshot.contractId,
      contractName: snapshot.contractName,
      customerId: first.customerId,
      customerName: snapshot.customerName,
      dueDate: getNextMonthDueDate(first.settlementPeriod, snapshot.settlementPolicy.monthlyDueDay ?? 1),
      generatedAt: toDateOnly(asOfDate),
      id: `task-revenue:${first.settlementPeriod}:${first.customerId}:${first.brandId}:${snapshot.contractId ?? 'no-contract'}:${snapshot.settlementPolicyVersionId}`,
      lineItems: group
        .map(buildBatchLine)
        .sort((left, right) => left.customerAcceptedOn.localeCompare(right.customerAcceptedOn)),
      settlementMode: '按月汇总',
      settlementPolicyVersionId: snapshot.settlementPolicyVersionId,
      settlementPeriod: first.settlementPeriod
    });
  }

  return {
    batches: candidateBatches.sort(
      (left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id)
    )
  };
}

export function buildCustomerTaskContractUsageSummaries({
  contracts,
  facts,
  priceVersions
}: {
  contracts: readonly BrandPricingContract[];
  facts: readonly CustomerTaskBillingFact[];
  priceVersions: readonly BrandTaskPriceVersionRecord[];
}): CustomerTaskContractUsageSummary[] {
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
  const usageByContract = new Map<
    string,
    { brandIds: Set<string>; contract: BrandPricingContract; settledAmount: number }
  >();

  for (const priceVersion of priceVersions) {
    if (priceVersion.status !== '生效中' || !priceVersion.billable || !priceVersion.contractId) {
      continue;
    }

    const contract = contractsById.get(priceVersion.contractId);
    if (!contract || contract.amountMode !== '固定金额' || typeof contract.amount !== 'number' || contract.amount <= 0) {
      continue;
    }

    const usage = usageByContract.get(contract.id) ?? {
      brandIds: new Set<string>(),
      contract,
      settledAmount: 0
    };
    usage.brandIds.add(priceVersion.brandId);
    usageByContract.set(contract.id, usage);
  }

  for (const fact of facts) {
    const contractId = fact.billingSnapshot.contractId;
    if (fact.status !== '有效' || !fact.billingSnapshot.billable || fact.amount <= 0 || !contractId) {
      continue;
    }

    const currentContract = contractsById.get(contractId);
    const contract = currentContract ?? {
      amount: fact.billingSnapshot.contractAmount,
      amountMode: fact.billingSnapshot.contractAmountMode ?? '无固定金额',
      code: fact.billingSnapshot.contractCode ?? contractId,
      customerId: fact.customerId,
      expiresAt: '',
      files: [],
      id: contractId,
      name: fact.billingSnapshot.contractName ?? fact.billingSnapshot.contractCode ?? contractId,
      signedAt: '',
      status: '有效' as const
    } satisfies BrandPricingContract;

    if (contract.amountMode !== '固定金额' || typeof contract.amount !== 'number' || contract.amount <= 0) {
      continue;
    }

    const usage = usageByContract.get(contractId) ?? {
      brandIds: new Set<string>(),
      contract,
      settledAmount: 0
    };
    usage.brandIds.add(fact.brandId);
    usage.settledAmount += fact.amount;
    usageByContract.set(contractId, usage);
  }

  return Array.from(usageByContract.values())
    .map(({ brandIds, contract, settledAmount }) => {
      const contractAmount = contract.amount as number;
      const usageRate = settledAmount / contractAmount;
      const status: CustomerTaskContractUsageStatus = usageRate >= 1
        ? '已超出'
        : usageRate >= 0.8
          ? '接近上限'
          : '正常';

      return {
        brandIds: Array.from(brandIds).sort(),
        contractAmount,
        contractCode: contract.code,
        contractId: contract.id,
        contractName: contract.name,
        overageAmount: Math.max(0, settledAmount - contractAmount),
        remainingAmount: Math.max(0, contractAmount - settledAmount),
        settledAmount,
        status,
        usageRate
      };
    })
    .sort((left, right) => right.usageRate - left.usageRate || left.contractCode.localeCompare(right.contractCode));
}
