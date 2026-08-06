import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { frontendBusinessToday } from '../../app/frontendBusinessClock';
import type { MasterDataMutationResult } from './masterDataLifecycleModel';
import type { SocialInsurancePolicyVersion } from './socialInsurancePolicyData';
import {
  buildCombinedSocialInsurancePolicy,
  getActivePolicyByConfigType,
  socialInsurancePolicyVersions
} from './socialInsurancePolicyData';
import {
  createSocialInsurancePolicyVersion,
  deleteSocialInsurancePolicyDraft,
  getSocialInsurancePolicyPeriod,
  publishSocialInsurancePolicyVersion
} from './socialInsurancePolicyLifecycleModel';

type SocialInsurancePolicyConfigStateValue = {
  activePolicy: SocialInsurancePolicyVersion;
  activeHousingFundPolicy: SocialInsurancePolicyVersion;
  activeSocialInsurancePolicy: SocialInsurancePolicyVersion;
  createPolicyVersion: (nextPolicy: SocialInsurancePolicyVersion, publish?: boolean) => MasterDataMutationResult;
  deleteDraftPolicyVersion: (policyId: string) => MasterDataMutationResult;
  publishPolicyVersion: (policyId: string) => MasterDataMutationResult;
  policyVersions: SocialInsurancePolicyVersion[];
};

const SocialInsurancePolicyConfigContext = createContext<SocialInsurancePolicyConfigStateValue | undefined>(undefined);

export function SocialInsurancePolicyConfigProvider({ children }: { children: ReactNode }) {
  const [policyVersions, setPolicyVersions] = useState<SocialInsurancePolicyVersion[]>(() => socialInsurancePolicyVersions);
  const currentPeriod = getSocialInsurancePolicyPeriod(frontendBusinessToday);
  const activeSocialInsurancePolicy = getActivePolicyByConfigType(policyVersions, '社保配置', currentPeriod);
  const activeHousingFundPolicy = getActivePolicyByConfigType(policyVersions, '公积金配置', currentPeriod);

  if (!activeSocialInsurancePolicy || !activeHousingFundPolicy) {
    throw new Error(`缺少 ${currentPeriod} 生效的社保公积金配置`);
  }

  const activePolicy = buildCombinedSocialInsurancePolicy(policyVersions, currentPeriod);

  const value = useMemo<SocialInsurancePolicyConfigStateValue>(
    () => ({
      activePolicy,
      activeHousingFundPolicy,
      activeSocialInsurancePolicy,
      createPolicyVersion(nextPolicy, publish = false) {
        const mutation = createSocialInsurancePolicyVersion(
          policyVersions,
          nextPolicy,
          publish,
          frontendBusinessToday
        );
        if (mutation.result.success) setPolicyVersions(mutation.rows);
        return mutation.result;
      },
      deleteDraftPolicyVersion(policyId) {
        const mutation = deleteSocialInsurancePolicyDraft(policyVersions, policyId);
        if (mutation.result.success) setPolicyVersions(mutation.rows);
        return mutation.result;
      },
      publishPolicyVersion(policyId) {
        const mutation = publishSocialInsurancePolicyVersion(
          policyVersions,
          policyId,
          frontendBusinessToday
        );
        if (mutation.result.success) setPolicyVersions(mutation.rows);
        return mutation.result;
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
