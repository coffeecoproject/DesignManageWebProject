import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SocialInsurancePolicyVersion } from './socialInsurancePolicyData';
import {
  buildCombinedSocialInsurancePolicy,
  getActivePolicyByConfigType,
  socialInsurancePolicyVersions
} from './socialInsurancePolicyData';

type SocialInsurancePolicyConfigStateValue = {
  activePolicy: SocialInsurancePolicyVersion;
  activeHousingFundPolicy: SocialInsurancePolicyVersion;
  activeSocialInsurancePolicy: SocialInsurancePolicyVersion;
  createPolicyVersion: (nextPolicy: SocialInsurancePolicyVersion, activate?: boolean) => SocialInsurancePolicyVersion;
  deleteDraftPolicyVersion: (policyId: string) => void;
  enablePolicyVersion: (policyId: string) => void;
  policyVersions: SocialInsurancePolicyVersion[];
};

export const socialInsurancePolicyConfigToday = '2026-06-18';

const SocialInsurancePolicyConfigContext = createContext<SocialInsurancePolicyConfigStateValue | undefined>(undefined);

function markPolicyEnabled(rows: SocialInsurancePolicyVersion[], policyId: string) {
  const targetPolicy = rows.find((policy) => policy.id === policyId);

  if (!targetPolicy) {
    return rows;
  }

  return rows.map((policy) => {
    if (policy.id === policyId) {
      return {
        ...policy,
        operationRecords: [
          {
            action: '启用版本',
            actor: '李明',
            id: `${policy.id}-enable-${policy.operationRecords.length + 1}`,
            object: policy.name,
            summary: `启用为当前${policy.configType}版本`,
            time: `${socialInsurancePolicyConfigToday} 10:30`
          },
          ...policy.operationRecords
        ],
        status: '启用' as const
      };
    }

    if (policy.configType === targetPolicy.configType && policy.status === '启用') {
      return {
        ...policy,
        operationRecords: [
          {
            action: '转为历史',
            actor: '李明',
            id: `${policy.id}-history-${policy.operationRecords.length + 1}`,
            object: policy.name,
            summary: `新${policy.configType}启用后，原版本转为历史`,
            time: `${socialInsurancePolicyConfigToday} 10:30`
          },
          ...policy.operationRecords
        ],
        status: '历史' as const
      };
    }

    return policy;
  });
}

export function SocialInsurancePolicyConfigProvider({ children }: { children: ReactNode }) {
  const [policyVersions, setPolicyVersions] = useState<SocialInsurancePolicyVersion[]>(() => socialInsurancePolicyVersions);
  const activeSocialInsurancePolicy = getActivePolicyByConfigType(policyVersions, '社保配置');
  const activeHousingFundPolicy = getActivePolicyByConfigType(policyVersions, '公积金配置');
  const activePolicy = buildCombinedSocialInsurancePolicy(policyVersions);

  const value = useMemo<SocialInsurancePolicyConfigStateValue>(
    () => ({
      activePolicy,
      activeHousingFundPolicy,
      activeSocialInsurancePolicy,
      createPolicyVersion(nextPolicy, activate = false) {
        const policyWithStatus: SocialInsurancePolicyVersion = {
          ...nextPolicy,
          status: activate ? '启用' : '草稿'
        };

        setPolicyVersions((currentRows) => {
          const nextRows = [...currentRows, policyWithStatus];
          return activate ? markPolicyEnabled(nextRows, policyWithStatus.id) : nextRows;
        });

        return policyWithStatus;
      },
      deleteDraftPolicyVersion(policyId) {
        setPolicyVersions((currentRows) =>
          currentRows.filter((policy) => policy.id !== policyId || policy.status !== '草稿')
        );
      },
      enablePolicyVersion(policyId) {
        setPolicyVersions((currentRows) => markPolicyEnabled(currentRows, policyId));
      },
      policyVersions
    }),
    [activeHousingFundPolicy, activePolicy, activeSocialInsurancePolicy, policyVersions]
  );

  return <SocialInsurancePolicyConfigContext.Provider value={value}>{children}</SocialInsurancePolicyConfigContext.Provider>;
}

export function useSocialInsurancePolicyConfigState() {
  const value = useContext(SocialInsurancePolicyConfigContext);

  if (!value) {
    throw new Error('useSocialInsurancePolicyConfigState must be used within SocialInsurancePolicyConfigProvider');
  }

  return value;
}
