export type BrandSettlementMode = '按任务结算' | '按月汇总';

export type BrandSettlementPolicy = {
  mode: BrandSettlementMode;
  monthlyDueDay?: number;
  perTaskDueDays?: number;
};

export type BrandSettlementPolicyVersionStatus = '待生效' | '生效中' | '已失效';

export type BrandSettlementPolicyVersionRecord = {
  brandId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  id: string;
  policy: BrandSettlementPolicy;
  status: BrandSettlementPolicyVersionStatus;
  version: number;
};

export type BrandTaskPricingDraft = {
  billable: boolean;
  contractId?: string;
  taskConfigId: string;
  unitPrice: number;
};

export type BrandTaskPriceVersionStatus = '生效中' | '已失效';

export type BrandTaskPriceVersionRecord = BrandTaskPricingDraft & {
  brandId: string;
  currency: 'CNY';
  effectiveFrom: string;
  effectiveTo?: string;
  id: string;
  status: BrandTaskPriceVersionStatus;
  version: number;
};

export type BrandPricingContract = {
  amount: number | null;
  amountMode: '固定金额' | '无固定金额';
  amountTaxMode?: '价税分列' | '含税未分列' | '不涉及增值税';
  code: string;
  customerId: string;
  expiresAt: string;
  files: Array<{ type: string }>;
  id: string;
  name: string;
  signedAt: string;
  stampDutyFacts?: {
    amountTaxMode: '价税分列' | '含税未分列' | '不涉及增值税';
  };
  status: '有效' | '已到期' | '已终止';
  terminatedAt?: string;
};

export type BrandTaskPriceValidationCode =
  | 'CONTRACT_CUSTOMER_MISMATCH'
  | 'CONTRACT_INELIGIBLE'
  | 'CONTRACT_REQUIRED'
  | 'INVALID_PRICE';

export type BrandTaskPriceValidationIssue = {
  code: BrandTaskPriceValidationCode;
  message: string;
  taskConfigId: string;
};

function toDateOnly(value: string) {
  return value.slice(0, 10);
}

function previousDate(value: string) {
  const date = new Date(`${toDateOnly(value)}T00:00:00+08:00`);
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isBrandPricingContractEligible(
  contract: BrandPricingContract,
  customerId: string,
  effectiveAt: string
) {
  const effectiveDate = toDateOnly(effectiveAt);
  return (
    contract.customerId === customerId &&
    contract.status === '有效' &&
    (!contract.terminatedAt || contract.terminatedAt > effectiveDate) &&
    contract.signedAt <= effectiveDate &&
    contract.expiresAt >= effectiveDate &&
    contract.files.some((file) => file.type === '已签署合同')
  );
}

export function getEligibleBrandPricingContracts(
  contracts: readonly BrandPricingContract[],
  customerId: string,
  effectiveAt: string
) {
  return contracts.filter((contract) => isBrandPricingContractEligible(contract, customerId, effectiveAt));
}

export function validateBrandTaskPricingDrafts({
  contracts,
  customerId,
  effectiveAt,
  pricingDrafts
}: {
  contracts: readonly BrandPricingContract[];
  customerId: string;
  effectiveAt: string;
  pricingDrafts: readonly BrandTaskPricingDraft[];
}): BrandTaskPriceValidationIssue[] {
  const issues: BrandTaskPriceValidationIssue[] = [];

  for (const draft of pricingDrafts) {
    if (!draft.billable) {
      continue;
    }

    if (!Number.isFinite(draft.unitPrice) || draft.unitPrice <= 0) {
      issues.push({
        code: 'INVALID_PRICE',
        message: '计费任务必须填写大于 0 的结算单价',
        taskConfigId: draft.taskConfigId
      });
    }

    if (!draft.contractId) {
      issues.push({
        code: 'CONTRACT_REQUIRED',
        message: '计费任务必须选择有效合同',
        taskConfigId: draft.taskConfigId
      });
      continue;
    }

    const contract = contracts.find((item) => item.id === draft.contractId);
    if (!contract) {
      issues.push({
        code: 'CONTRACT_INELIGIBLE',
        message: '所选合同不存在或已不可用',
        taskConfigId: draft.taskConfigId
      });
      continue;
    }

    if (contract.customerId !== customerId) {
      issues.push({
        code: 'CONTRACT_CUSTOMER_MISMATCH',
        message: '所选合同不属于当前品牌客户',
        taskConfigId: draft.taskConfigId
      });
      continue;
    }

    if (!isBrandPricingContractEligible(contract, customerId, effectiveAt)) {
      issues.push({
        code: 'CONTRACT_INELIGIBLE',
        message: '所选合同在当前生效日不可用',
        taskConfigId: draft.taskConfigId
      });
    }
  }

  return issues;
}

export function resolveActiveBrandTaskPriceVersion({
  brandId,
  effectiveAt,
  priceVersions,
  taskConfigId
}: {
  brandId: string;
  effectiveAt: string;
  priceVersions: readonly BrandTaskPriceVersionRecord[];
  taskConfigId: string;
}) {
  const effectiveDate = toDateOnly(effectiveAt);
  return priceVersions
    .filter(
      (version) =>
        version.brandId === brandId &&
        version.taskConfigId === taskConfigId &&
        version.effectiveFrom <= effectiveDate &&
        (!version.effectiveTo || version.effectiveTo >= effectiveDate)
    )
    .sort((left, right) => right.version - left.version)[0];
}

function isSamePricing(left: BrandTaskPriceVersionRecord | undefined, right: BrandTaskPricingDraft) {
  return Boolean(
    left &&
      left.billable === right.billable &&
      left.unitPrice === (right.billable ? right.unitPrice : 0) &&
      left.contractId === (right.billable ? right.contractId : undefined)
  );
}

export function reconcileBrandTaskPriceVersions({
  brandId,
  effectiveAt,
  priceVersions,
  pricingDrafts
}: {
  brandId: string;
  effectiveAt: string;
  priceVersions: readonly BrandTaskPriceVersionRecord[];
  pricingDrafts: readonly BrandTaskPricingDraft[];
}) {
  const effectiveDate = toDateOnly(effectiveAt);
  const nextRows = priceVersions.map((row) => ({ ...row }));
  const activeTaskIds = new Set(pricingDrafts.map((draft) => draft.taskConfigId));

  for (const current of nextRows) {
    if (
      current.brandId === brandId &&
      current.status === '生效中' &&
      !activeTaskIds.has(current.taskConfigId)
    ) {
      current.status = '已失效';
      current.effectiveTo = previousDate(effectiveDate);
    }
  }

  for (const draft of pricingDrafts) {
    const current = resolveActiveBrandTaskPriceVersion({
      brandId,
      effectiveAt: effectiveDate,
      priceVersions: nextRows,
      taskConfigId: draft.taskConfigId
    });

    if (isSamePricing(current, draft)) {
      continue;
    }

    if (current) {
      const currentIndex = nextRows.findIndex((row) => row.id === current.id);
      nextRows[currentIndex] = {
        ...current,
        effectiveTo: previousDate(effectiveDate),
        status: '已失效'
      };
    }

    const latestVersion = nextRows
      .filter((row) => row.brandId === brandId && row.taskConfigId === draft.taskConfigId)
      .reduce((max, row) => Math.max(max, row.version), 0);
    const version = latestVersion + 1;
    nextRows.push({
      billable: draft.billable,
      brandId,
      contractId: draft.billable ? draft.contractId : undefined,
      currency: 'CNY',
      effectiveFrom: effectiveDate,
      id: `brand-price-${brandId}-${draft.taskConfigId}-v${version}`,
      status: '生效中',
      taskConfigId: draft.taskConfigId,
      unitPrice: draft.billable ? draft.unitPrice : 0,
      version
    });
  }

  return nextRows;
}

export function getCurrentBrandTaskPricingDrafts({
  brandId,
  effectiveAt,
  priceVersions,
  taskConfigIds
}: {
  brandId: string;
  effectiveAt: string;
  priceVersions: readonly BrandTaskPriceVersionRecord[];
  taskConfigIds: readonly string[];
}): BrandTaskPricingDraft[] {
  return taskConfigIds.map((taskConfigId) => {
    const version = resolveActiveBrandTaskPriceVersion({ brandId, effectiveAt, priceVersions, taskConfigId });
    return {
      billable: version?.billable ?? false,
      contractId: version?.contractId,
      taskConfigId,
      unitPrice: version?.unitPrice ?? 0
    };
  });
}

export function isBrandSettlementPolicyValid(policy: BrandSettlementPolicy) {
  if (policy.mode === '按任务结算') {
    return Number.isInteger(policy.perTaskDueDays) && (policy.perTaskDueDays ?? -1) >= 0;
  }

  return Number.isInteger(policy.monthlyDueDay) && (policy.monthlyDueDay ?? 0) >= 1 && (policy.monthlyDueDay ?? 32) <= 31;
}

function isSameSettlementPolicy(left: BrandSettlementPolicy, right: BrandSettlementPolicy) {
  return (
    left.mode === right.mode &&
    left.monthlyDueDay === right.monthlyDueDay &&
    left.perTaskDueDays === right.perTaskDueDays
  );
}

function normalizeBrandSettlementPolicyVersionStatuses(
  rows: BrandSettlementPolicyVersionRecord[],
  asOfDate: string
) {
  const currentDate = toDateOnly(asOfDate);
  return rows.map((row) => ({
    ...row,
    status: row.effectiveFrom > currentDate
      ? '待生效' as const
      : row.effectiveTo && row.effectiveTo < currentDate
        ? '已失效' as const
        : '生效中' as const
  }));
}

export function createInitialBrandSettlementPolicyVersions(
  brands: ReadonlyArray<{ id: string; settlementPolicy: BrandSettlementPolicy }>,
  effectiveFrom: string
): BrandSettlementPolicyVersionRecord[] {
  return brands.map((brand) => ({
    brandId: brand.id,
    effectiveFrom: toDateOnly(effectiveFrom),
    id: `brand-settlement-${brand.id}-v1`,
    policy: { ...brand.settlementPolicy },
    status: '生效中',
    version: 1
  }));
}

export function resolveActiveBrandSettlementPolicyVersion({
  brandId,
  effectiveAt,
  policyVersions
}: {
  brandId: string;
  effectiveAt: string;
  policyVersions: readonly BrandSettlementPolicyVersionRecord[];
}) {
  const effectiveDate = toDateOnly(effectiveAt);

  return policyVersions
    .filter(
      (version) =>
        version.brandId === brandId &&
        version.effectiveFrom <= effectiveDate &&
        (!version.effectiveTo || version.effectiveTo >= effectiveDate)
    )
    .sort((left, right) => right.version - left.version)[0];
}

export function reconcileBrandSettlementPolicyVersions({
  asOfDate,
  brandId,
  effectiveAt,
  policy,
  policyVersions
}: {
  asOfDate: string;
  brandId: string;
  effectiveAt: string;
  policy: BrandSettlementPolicy;
  policyVersions: readonly BrandSettlementPolicyVersionRecord[];
}) {
  const effectiveDate = toDateOnly(effectiveAt);
  const nextRows = policyVersions.map((row) => ({ ...row, policy: { ...row.policy } }));
  const current = resolveActiveBrandSettlementPolicyVersion({
    brandId,
    effectiveAt: effectiveDate,
    policyVersions: nextRows
  });

  if (current && isSameSettlementPolicy(current.policy, policy)) {
    return normalizeBrandSettlementPolicyVersionStatuses(nextRows, asOfDate);
  }

  if (current?.effectiveFrom === effectiveDate) {
    return normalizeBrandSettlementPolicyVersionStatuses(nextRows.map((row) =>
      row.id === current.id
        ? { ...row, policy: { ...policy } }
        : row
    ), asOfDate);
  }

  if (current) {
    const currentIndex = nextRows.findIndex((row) => row.id === current.id);
    nextRows[currentIndex] = {
      ...current,
      effectiveTo: previousDate(effectiveDate),
      status: '已失效'
    };
  }

  const version = nextRows
    .filter((row) => row.brandId === brandId)
    .reduce((max, row) => Math.max(max, row.version), 0) + 1;
  nextRows.push({
    brandId,
    effectiveFrom: effectiveDate,
    id: `brand-settlement-${brandId}-v${version}`,
    policy: { ...policy },
    status: effectiveDate > toDateOnly(asOfDate) ? '待生效' : '生效中',
    version
  });

  return normalizeBrandSettlementPolicyVersionStatuses(nextRows, asOfDate);
}
