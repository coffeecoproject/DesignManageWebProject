import {
  allowMasterDataMutation,
  blockMasterDataMutation,
  type MasterDataMutationResult
} from './masterDataLifecycleModel';
import type {
  SocialInsurancePolicyConfigType,
  SocialInsurancePolicyVersion
} from './socialInsurancePolicyData';

export type SocialInsurancePolicyLifecycleStatus = '草稿' | '待生效' | '当前生效' | '历史';

export type SocialInsurancePolicyMutation = {
  result: MasterDataMutationResult;
  rows: SocialInsurancePolicyVersion[];
};

export function getSocialInsurancePolicyPeriod(today: string) {
  return today.slice(0, 7);
}

export function getCurrentPublishedPolicy(
  rows: SocialInsurancePolicyVersion[],
  configType: SocialInsurancePolicyConfigType,
  period: string
) {
  return rows
    .filter((policy) =>
      policy.configType === configType
      && policy.status === '已发布'
      && policy.effectiveMonth <= period
    )
    .sort((left, right) => right.effectiveMonth.localeCompare(left.effectiveMonth))[0];
}

export function getSocialInsurancePolicyLifecycleStatus(
  policy: SocialInsurancePolicyVersion,
  rows: SocialInsurancePolicyVersion[],
  period: string
): SocialInsurancePolicyLifecycleStatus {
  if (policy.status === '草稿') {
    return '草稿';
  }

  if (policy.effectiveMonth > period) {
    return '待生效';
  }

  return getCurrentPublishedPolicy(rows, policy.configType, period)?.id === policy.id
    ? '当前生效'
    : '历史';
}

function appendOperation(
  policy: SocialInsurancePolicyVersion,
  action: string,
  summary: string,
  today: string
): SocialInsurancePolicyVersion {
  return {
    ...policy,
    operationRecords: [
      {
        action,
        actor: '李明',
        id: `${policy.id}-${action}-${policy.operationRecords.length + 1}`,
        object: policy.name,
        summary,
        time: `${today} 10:30`
      },
      ...policy.operationRecords
    ]
  };
}

export function validateSocialInsurancePolicyDraft(
  rows: SocialInsurancePolicyVersion[],
  policy: SocialInsurancePolicyVersion
): MasterDataMutationResult {
  if (rows.some((row) => row.id === policy.id)) {
    return blockMasterDataMutation('配置记录已存在');
  }

  if (rows.some((row) => row.configType === policy.configType && row.version === policy.version)) {
    return blockMasterDataMutation('同类配置版本号已存在');
  }

  if (rows.some((row) => row.configType === policy.configType && row.effectiveMonth === policy.effectiveMonth)) {
    return blockMasterDataMutation('同类配置的生效月份已存在');
  }

  return allowMasterDataMutation();
}

export function publishSocialInsurancePolicyVersion(
  rows: SocialInsurancePolicyVersion[],
  policyId: string,
  today: string
): SocialInsurancePolicyMutation {
  const target = rows.find((policy) => policy.id === policyId);
  if (!target) {
    return { result: blockMasterDataMutation('未找到配置版本'), rows };
  }

  if (target.status !== '草稿') {
    return { result: blockMasterDataMutation('已发布版本不可重复发布'), rows };
  }

  const publishedRows = rows.filter((policy) =>
    policy.configType === target.configType && policy.status === '已发布'
  );
  if (publishedRows.some((policy) => policy.effectiveMonth === target.effectiveMonth)) {
    return { result: blockMasterDataMutation('该生效月份已有已发布配置'), rows };
  }

  const latestPublished = [...publishedRows]
    .sort((left, right) => right.effectiveMonth.localeCompare(left.effectiveMonth))[0];
  if (latestPublished && target.effectiveMonth <= latestPublished.effectiveMonth) {
    return {
      result: blockMasterDataMutation(`生效月份必须晚于最近已发布月份 ${latestPublished.effectiveMonth}`),
      rows
    };
  }

  const targetLifecycle = target.effectiveMonth > getSocialInsurancePolicyPeriod(today)
    ? '待生效'
    : '当前生效';

  return {
    result: allowMasterDataMutation(),
    rows: rows.map((policy) =>
      policy.id === policyId
        ? {
            ...appendOperation(policy, '发布版本', `发布后状态为${targetLifecycle}`, today),
            status: '已发布'
          }
        : policy
    )
  };
}

export function createSocialInsurancePolicyVersion(
  rows: SocialInsurancePolicyVersion[],
  policy: SocialInsurancePolicyVersion,
  publish: boolean,
  today: string
): SocialInsurancePolicyMutation {
  const validation = validateSocialInsurancePolicyDraft(rows, policy);
  if (!validation.success) {
    return { result: validation, rows };
  }

  const draft: SocialInsurancePolicyVersion = {
    ...policy,
    status: '草稿'
  };
  const nextRows = [...rows, draft];
  return publish
    ? publishSocialInsurancePolicyVersion(nextRows, draft.id, today)
    : { result: allowMasterDataMutation(), rows: nextRows };
}

export function deleteSocialInsurancePolicyDraft(
  rows: SocialInsurancePolicyVersion[],
  policyId: string
): SocialInsurancePolicyMutation {
  const target = rows.find((policy) => policy.id === policyId);
  if (!target) {
    return { result: blockMasterDataMutation('未找到配置版本'), rows };
  }

  if (target.status !== '草稿') {
    return { result: blockMasterDataMutation('已发布版本不可删除'), rows };
  }

  return {
    result: allowMasterDataMutation(),
    rows: rows.filter((policy) => policy.id !== policyId)
  };
}
