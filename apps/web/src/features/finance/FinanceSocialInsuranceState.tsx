import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useSocialInsurancePolicyConfigState } from '../system/SocialInsurancePolicyConfigState';
import { financeToday, formatMoney } from './financeUtils';
import {
  buildSocialInsuranceRecordsWithCarryovers,
  getVisibleSocialInsuranceRecords
} from './financeSocialInsuranceModel';
import {
  getSocialInsuranceContributionAmounts,
  socialInsuranceEmployeeRecords,
  type SocialInsuranceEmployeeRecord,
  type SocialInsuranceHandlingStatus
} from './financeSocialInsuranceData';

type FinanceSocialInsuranceStateValue = {
  socialInsuranceRecords: SocialInsuranceEmployeeRecord[];
  saveSocialInsuranceContributionBase: (recordId: string, contributionBase: number) => boolean;
  updateSocialInsuranceRecordStatus: (recordId: string, handlingStatus: SocialInsuranceHandlingStatus) => boolean;
};

const FinanceSocialInsuranceContext = createContext<FinanceSocialInsuranceStateValue | undefined>(undefined);

function getOperationSummary(record: SocialInsuranceEmployeeRecord, handlingStatus: SocialInsuranceHandlingStatus) {
  if (handlingStatus === '已确认') {
    return record.makeupPeriod ? `确认补缴 ${record.makeupPeriod}` : '确认缴纳';
  }

  if (handlingStatus === '延期补缴') {
    return '标记延期补缴，下月继续处理';
  }

  if (handlingStatus === '本月不缴') {
    return '标记本月不缴，后续继续处理';
  }

  return '恢复待确认';
}

export function FinanceSocialInsuranceProvider({ children }: { children: ReactNode }) {
  const { activePolicy } = useSocialInsurancePolicyConfigState();
  const { peopleRows } = usePeopleOrganizationState();
  const [socialInsuranceRecords, setSocialInsuranceRecords] = useState<SocialInsuranceEmployeeRecord[]>(
    () => buildSocialInsuranceRecordsWithCarryovers(socialInsuranceEmployeeRecords)
  );
  const visibleSocialInsuranceRecords = useMemo(() => {
    return getVisibleSocialInsuranceRecords(socialInsuranceRecords, peopleRows);
  }, [peopleRows, socialInsuranceRecords]);

  const value = useMemo<FinanceSocialInsuranceStateValue>(
    () => ({
      socialInsuranceRecords: visibleSocialInsuranceRecords,
      saveSocialInsuranceContributionBase(recordId, contributionBase) {
        if (!socialInsuranceRecords.some((currentRecord) => currentRecord.id === recordId)) {
          return false;
        }

        setSocialInsuranceRecords((currentRecords) =>
          buildSocialInsuranceRecordsWithCarryovers(
            currentRecords.map((currentRecord) => {
              if (currentRecord.id !== recordId) {
                return currentRecord;
              }

              const nextAmounts = getSocialInsuranceContributionAmounts(currentRecord.category, contributionBase, activePolicy);

              return {
                ...currentRecord,
                ...nextAmounts,
                contributionBase,
                updatedAt: financeToday,
                operationRecords: [
                  {
                    action: '编辑基数',
                    actor: '李明',
                    id: `${currentRecord.id}-base-${currentRecord.operationRecords.length + 1}`,
                    object: `${currentRecord.employeeName} / ${currentRecord.category}`,
                    summary: `缴纳基数 ${formatMoney(currentRecord.contributionBase)} -> ${formatMoney(contributionBase)}`,
                    time: `${financeToday} 10:30`
                  },
                  ...currentRecord.operationRecords
                ]
              };
            })
          )
        );

        return true;
      },
      updateSocialInsuranceRecordStatus(recordId, handlingStatus) {
        if (!socialInsuranceRecords.some((currentRecord) => currentRecord.id === recordId)) {
          return false;
        }

        setSocialInsuranceRecords((currentRecords) =>
          buildSocialInsuranceRecordsWithCarryovers(
            currentRecords.map((currentRecord) => {
              if (currentRecord.id !== recordId) {
                return currentRecord;
              }

              return {
                ...currentRecord,
                handlingStatus,
                reason:
                  handlingStatus === '延期补缴'
                    ? currentRecord.reason ?? '延期补缴，下月继续处理'
                    : handlingStatus === '本月不缴'
                      ? currentRecord.reason ?? '本月未缴，后续继续处理'
                      : currentRecord.reason,
                updatedAt: financeToday,
                operationRecords: [
                  {
                    action: '更新处理',
                    actor: '李明',
                    id: `${currentRecord.id}-${handlingStatus}-${currentRecord.operationRecords.length + 1}`,
                    object: `${currentRecord.employeeName} / ${currentRecord.category}`,
                    summary: getOperationSummary(currentRecord, handlingStatus),
                    time: `${financeToday} 10:30`
                  },
                  ...currentRecord.operationRecords
                ]
              };
            })
          )
        );

        return true;
      }
    }),
    [activePolicy, socialInsuranceRecords, visibleSocialInsuranceRecords]
  );

  return <FinanceSocialInsuranceContext.Provider value={value}>{children}</FinanceSocialInsuranceContext.Provider>;
}

export function useFinanceSocialInsuranceState() {
  const value = useContext(FinanceSocialInsuranceContext);

  if (!value) {
    throw new Error('useFinanceSocialInsuranceState must be used within FinanceSocialInsuranceProvider');
  }

  return value;
}
