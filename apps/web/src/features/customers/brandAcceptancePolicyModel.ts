export type BrandAcceptanceTimelinessResult = '未超时' | '超时' | '不计时';

export type BrandAcceptanceDeductionTier = {
  deductionRate: number;
  minimumPenaltyPoints: number;
};

export type BrandAcceptancePolicy = {
  deductionTiers: BrandAcceptanceDeductionTier[];
  lowScorePenaltyPoints: number;
  noPenaltyScoreMinimum: number;
  standardPenaltyPoints: number;
  standardPenaltyScoreMinimum: number;
  overduePenaltyPoints: number;
};

export type BrandAcceptancePolicyRecord = {
  brandId: string;
  policy: BrandAcceptancePolicy;
};

export type BrandAcceptanceCalculation = {
  deductionAmount: number;
  deductionRate: number;
  finalAmount: number;
  qualityPenaltyPoints: number;
  standardAmount: number;
  timelinessPenaltyPoints: number;
  totalPenaltyPoints: number;
};

export const defaultBrandAcceptancePolicy: BrandAcceptancePolicy = {
  deductionTiers: [
    { deductionRate: 0, minimumPenaltyPoints: 0 },
    { deductionRate: 0.2, minimumPenaltyPoints: 10 },
    { deductionRate: 0.5, minimumPenaltyPoints: 20 }
  ],
  lowScorePenaltyPoints: 20,
  noPenaltyScoreMinimum: 85,
  overduePenaltyPoints: 10,
  standardPenaltyPoints: 10,
  standardPenaltyScoreMinimum: 80
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function cloneBrandAcceptancePolicy(policy: BrandAcceptancePolicy): BrandAcceptancePolicy {
  return {
    ...policy,
    deductionTiers: policy.deductionTiers.map((tier) => ({ ...tier }))
  };
}

export function isBrandAcceptancePolicyValid(policy: BrandAcceptancePolicy) {
  if (
    !Number.isInteger(policy.noPenaltyScoreMinimum)
    || !Number.isInteger(policy.standardPenaltyScoreMinimum)
    || policy.noPenaltyScoreMinimum < 0
    || policy.noPenaltyScoreMinimum > 100
    || policy.standardPenaltyScoreMinimum < 0
    || policy.standardPenaltyScoreMinimum >= policy.noPenaltyScoreMinimum
  ) {
    return false;
  }

  if (
    !Number.isInteger(policy.standardPenaltyPoints)
    || !Number.isInteger(policy.lowScorePenaltyPoints)
    || !Number.isInteger(policy.overduePenaltyPoints)
    || policy.standardPenaltyPoints < 0
    || policy.lowScorePenaltyPoints < policy.standardPenaltyPoints
    || policy.overduePenaltyPoints < 0
  ) {
    return false;
  }

  const tiers = [...policy.deductionTiers].sort(
    (left, right) => left.minimumPenaltyPoints - right.minimumPenaltyPoints
  );
  return tiers.length > 0
    && tiers[0]?.minimumPenaltyPoints === 0
    && tiers.every((tier, index) =>
      Number.isInteger(tier.minimumPenaltyPoints)
      && tier.minimumPenaltyPoints >= 0
      && tier.deductionRate >= 0
      && tier.deductionRate <= 1
      && (index === 0 || tier.minimumPenaltyPoints > tiers[index - 1]!.minimumPenaltyPoints)
      && (index === 0 || tier.deductionRate >= tiers[index - 1]!.deductionRate)
    );
}

export function calculateBrandAcceptance({
  policy,
  score,
  standardAmount,
  timelinessResult
}: {
  policy: BrandAcceptancePolicy;
  score: number;
  standardAmount: number;
  timelinessResult: BrandAcceptanceTimelinessResult;
}): BrandAcceptanceCalculation {
  if (!isBrandAcceptancePolicyValid(policy)) {
    throw new Error('品牌验收规则无效');
  }
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('甲方评分需为 0 至 100 分');
  }
  if (!Number.isFinite(standardAmount) || standardAmount < 0) {
    throw new Error('任务标准结算金额无效');
  }

  const qualityPenaltyPoints = score >= policy.noPenaltyScoreMinimum
    ? 0
    : score >= policy.standardPenaltyScoreMinimum
      ? policy.standardPenaltyPoints
      : policy.lowScorePenaltyPoints;
  const timelinessPenaltyPoints = timelinessResult === '超时' ? policy.overduePenaltyPoints : 0;
  const totalPenaltyPoints = qualityPenaltyPoints + timelinessPenaltyPoints;
  const deductionRate = [...policy.deductionTiers]
    .sort((left, right) => right.minimumPenaltyPoints - left.minimumPenaltyPoints)
    .find((tier) => totalPenaltyPoints >= tier.minimumPenaltyPoints)?.deductionRate ?? 0;
  const deductionAmount = roundMoney(standardAmount * deductionRate);

  return {
    deductionAmount,
    deductionRate,
    finalAmount: roundMoney(Math.max(0, standardAmount - deductionAmount)),
    qualityPenaltyPoints,
    standardAmount: roundMoney(standardAmount),
    timelinessPenaltyPoints,
    totalPenaltyPoints
  };
}

export function createInitialBrandAcceptancePolicies(
  brands: ReadonlyArray<{ id: string }>
): BrandAcceptancePolicyRecord[] {
  return brands.map((brand) => ({
    brandId: brand.id,
    policy: cloneBrandAcceptancePolicy(defaultBrandAcceptancePolicy)
  }));
}

export function getBrandAcceptancePolicy({
  brandId,
  policies
}: {
  brandId: string;
  policies: readonly BrandAcceptancePolicyRecord[];
}) {
  return policies.find((record) => record.brandId === brandId);
}

export function upsertBrandAcceptancePolicy({
  brandId,
  policy,
  policies
}: {
  brandId: string;
  policy: BrandAcceptancePolicy;
  policies: readonly BrandAcceptancePolicyRecord[];
}) {
  if (!isBrandAcceptancePolicyValid(policy)) {
    throw new Error('品牌验收规则无效');
  }
  const nextRecord = { brandId, policy: cloneBrandAcceptancePolicy(policy) };
  return policies.some((record) => record.brandId === brandId)
    ? policies.map((record) => record.brandId === brandId ? nextRecord : record)
    : [nextRecord, ...policies];
}
