import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useSocialInsurancePolicyConfigState } from '../system/SocialInsurancePolicyConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import { financeToday, formatMoney } from './financeUtils';
import {
  buildDerivedEnrollmentProfiles,
  buildMonthlyContributionCandidates,
  getAppliedContributionBase,
  getVisibleSocialInsuranceRecords,
  resolveContributionCorrectionPaymentStatus,
  resolveSocialInsuranceRecordPaymentStatus,
  resolveSocialInsurancePolicyForPeriod
} from './financeSocialInsuranceModel';
import {
  getSocialInsuranceContributionAmounts,
  socialInsuranceContributionBaseRecords,
  socialInsuranceCurrentPeriod,
  socialInsuranceEmployeeRecords,
  socialInsuranceEnrollmentProfiles,
  type ContributionBaseRecord,
  type ContributionCorrectionRecord,
  type SocialInsuranceEmployeeRecord,
  type SocialInsuranceEnrollmentProfile,
  type SocialInsuranceHandlingStatus
} from './financeSocialInsuranceData';

type FinanceSocialInsuranceStateValue = {
  socialInsuranceRecords: SocialInsuranceEmployeeRecord[];
  enrollmentProfiles: SocialInsuranceEnrollmentProfile[];
  contributionBaseRecords: ContributionBaseRecord[];
  correctionRecords: ContributionCorrectionRecord[];
  getSocialInsuranceRecordsForPeriod: (period: string) => SocialInsuranceEmployeeRecord[];
  confirmMonthlyAssessment: (recordId: string, input: {
    assessedAt: string;
    assessedEmployeeAmount: number;
    assessedEmployerAmount: number;
    assessmentFileIds: string[];
    assessmentNo: string;
    differenceReason?: string;
  }) => boolean;
  registerMonthlyBatchPayment: (input: {
    category: SocialInsuranceEmployeeRecord['category'];
    paidAt: string;
    paymentFileIds: string[];
    period: string;
    transactionNo: string;
  }) => boolean;
  registerMonthlyNoContribution: (recordId: string, input: {
    confirmedAt: string;
    evidenceFileIds: string[];
    officialReferenceNo: string;
    reason: string;
  }) => boolean;
  registerContributionCorrectionPayment: (correctionId: string, input: {
    paidAt: string;
    paymentFileIds: string[];
    transactionNo: string;
  }) => boolean;
  saveContributionCorrection: (record: ContributionCorrectionRecord) => boolean;
  saveEnrollmentProfile: (profile: SocialInsuranceEnrollmentProfile) => boolean;
  saveSocialInsuranceContributionBase: (recordId: string, contributionBase: number) => boolean;
  updateSocialInsuranceRecordStatus: (recordId: string, handlingStatus: SocialInsuranceHandlingStatus) => boolean;
};

const FinanceSocialInsuranceContext = createContext<FinanceSocialInsuranceStateValue | undefined>(undefined);

const allowedMonthlyStatusTransitions: Partial<Record<SocialInsuranceHandlingStatus, SocialInsuranceHandlingStatus[]>> = {
  待申报: ['待核定'],
  核定有差异: ['待确认'],
  待确认: ['待缴费'],
  待缴费: ['欠缴待补']
};

function getRecordPeriod(recordId: string) {
  return recordId.match(/(\d{4}-\d{2})$/)?.[1];
}

function allocateAssessedAmount(
  record: SocialInsuranceEmployeeRecord,
  total: number,
  field: 'estimatedEmployerAmount' | 'estimatedEmployeeAmount'
) {
  const estimatedTotal = record.items.reduce((sum, item) => sum + item[field], 0);

  return record.items.map((item, index) => {
    if (index === record.items.length - 1) {
      const allocatedBefore = record.items.slice(0, -1).reduce((sum, previousItem) => {
        const ratio = estimatedTotal > 0 ? previousItem[field] / estimatedTotal : 1 / record.items.length;
        return sum + Math.round(total * ratio * 100) / 100;
      }, 0);
      return Math.round((total - allocatedBefore) * 100) / 100;
    }

    const ratio = estimatedTotal > 0 ? item[field] / estimatedTotal : 1 / record.items.length;
    return Math.round(total * ratio * 100) / 100;
  });
}

function getOperationSummary(record: SocialInsuranceEmployeeRecord, handlingStatus: SocialInsuranceHandlingStatus) {
  if (handlingStatus === '待缴费') {
    return record.makeupPeriod ? `确认补缴 ${record.makeupPeriod} 核定结果` : '确认官方核定结果';
  }

  if (handlingStatus === '已缴费') {
    return '登记实际缴费结果';
  }

  if (handlingStatus === '欠缴待补') {
    return '登记原所属期欠缴，进入补缴办理';
  }

  return `更新为${handlingStatus}`;
}

export function FinanceSocialInsuranceProvider({ children }: { children: ReactNode }) {
  const { policyVersions } = useSocialInsurancePolicyConfigState();
  const { peopleRows } = usePeopleOrganizationState();
  const { financeRows } = useFinanceManagement();
  const [socialInsuranceRecords, setSocialInsuranceRecords] = useState<SocialInsuranceEmployeeRecord[]>(() => socialInsuranceEmployeeRecords);
  const [enrollmentProfiles, setEnrollmentProfiles] = useState<SocialInsuranceEnrollmentProfile[]>(() => socialInsuranceEnrollmentProfiles);
  const [contributionBaseRecords, setContributionBaseRecords] = useState<ContributionBaseRecord[]>(() => socialInsuranceContributionBaseRecords);
  const [correctionRecords, setCorrectionRecords] = useState<ContributionCorrectionRecord[]>([]);
  const derivedEnrollmentProfiles = useMemo(
    () => buildDerivedEnrollmentProfiles(peopleRows, enrollmentProfiles, socialInsuranceCurrentPeriod),
    [enrollmentProfiles, peopleRows]
  );
  const getSocialInsuranceRecordsForPeriod = useCallback((period: string) => {
    const periodProfiles = buildDerivedEnrollmentProfiles(peopleRows, enrollmentProfiles, period);
    const periodRecords = buildMonthlyContributionCandidates({
      contributionBaseRecords,
      existingRecords: socialInsuranceRecords.filter((record) => record.period === period),
      peopleRows,
      period,
      policies: policyVersions,
      profiles: periodProfiles
    });

    return getVisibleSocialInsuranceRecords(periodRecords, peopleRows, periodProfiles).map((record) =>
      resolveSocialInsuranceRecordPaymentStatus(record, financeRows)
    );
  }, [contributionBaseRecords, enrollmentProfiles, financeRows, peopleRows, policyVersions, socialInsuranceRecords]);
  const derivedSocialInsuranceRecords = useMemo(
    () => getSocialInsuranceRecordsForPeriod(socialInsuranceCurrentPeriod),
    [getSocialInsuranceRecordsForPeriod]
  );
  const visibleSocialInsuranceRecords = derivedSocialInsuranceRecords;
  const resolvedCorrectionRecords = useMemo(
    () => correctionRecords.map((record) => resolveContributionCorrectionPaymentStatus(record, financeRows)),
    [correctionRecords, financeRows]
  );

  const findSourceRecord = useCallback((recordId: string) => {
    const persistedRecord = socialInsuranceRecords.find((record) => record.id === recordId);
    if (persistedRecord) return persistedRecord;

    const period = getRecordPeriod(recordId);
    return period ? getSocialInsuranceRecordsForPeriod(period).find((record) => record.id === recordId) : undefined;
  }, [getSocialInsuranceRecordsForPeriod, socialInsuranceRecords]);

  const value = useMemo<FinanceSocialInsuranceStateValue>(
    () => ({
      socialInsuranceRecords: visibleSocialInsuranceRecords,
      enrollmentProfiles: derivedEnrollmentProfiles,
      contributionBaseRecords,
      correctionRecords: resolvedCorrectionRecords,
      getSocialInsuranceRecordsForPeriod,
      confirmMonthlyAssessment(recordId, input) {
        const sourceRecord = findSourceRecord(recordId);

        if (
          !sourceRecord
          || sourceRecord.handlingStatus !== '待核定'
          || !input.assessedAt
          || !input.assessmentNo.trim()
          || input.assessmentFileIds.length === 0
        ) {
          return false;
        }

        const hasDifference = Math.abs(input.assessedEmployerAmount - sourceRecord.estimatedEmployerAmount) > 0.009
          || Math.abs(input.assessedEmployeeAmount - sourceRecord.estimatedEmployeeAmount) > 0.009;

        if (hasDifference && !input.differenceReason?.trim()) {
          return false;
        }

        const assessedEmployerItems = allocateAssessedAmount(sourceRecord, input.assessedEmployerAmount, 'estimatedEmployerAmount');
        const assessedEmployeeItems = allocateAssessedAmount(sourceRecord, input.assessedEmployeeAmount, 'estimatedEmployeeAmount');

        setSocialInsuranceRecords((currentRecords) => {
          const sourceRows = currentRecords.some((record) => record.id === recordId)
            ? currentRecords
            : [sourceRecord, ...currentRecords];

          return sourceRows.map((record) => record.id !== recordId ? record : {
            ...record,
            assessedAt: input.assessedAt,
            assessedEmployeeAmount: input.assessedEmployeeAmount,
            assessedEmployerAmount: input.assessedEmployerAmount,
            assessmentFileIds: input.assessmentFileIds,
            assessmentNo: input.assessmentNo.trim(),
            differenceReason: hasDifference ? input.differenceReason?.trim() : undefined,
            handlingStatus: hasDifference ? '核定有差异' : '待确认',
            items: record.items.map((item, index) => ({
              ...item,
              assessedEmployerAmount: assessedEmployerItems[index] ?? 0,
              assessedEmployeeAmount: assessedEmployeeItems[index] ?? 0
            })),
            updatedAt: financeToday,
            operationRecords: [{
              action: '登记核定结果',
              actor: '李明',
              id: `${record.id}-assessment-${record.operationRecords.length + 1}`,
              object: `${record.employeeName} / ${record.category}`,
              summary: hasDifference ? '官方核定与内部测算存在差异' : '官方核定与内部测算一致',
              time: `${financeToday} 10:30`
            }, ...record.operationRecords]
          });
        });

        return true;
      },
      registerMonthlyBatchPayment(input) {
        const payableRecords = getSocialInsuranceRecordsForPeriod(input.period).filter((record) =>
          record.category === input.category && record.handlingStatus === '待缴费' && !record.transactionNo
        );

        if (payableRecords.length === 0 || !input.paidAt || !input.transactionNo.trim() || input.paymentFileIds.length === 0) {
          return false;
        }

        const payableIds = new Set(payableRecords.map((record) => record.id));

        setSocialInsuranceRecords((currentRecords) => {
          const persistedIds = new Set(currentRecords.map((record) => record.id));
          const sourceRows = [
            ...payableRecords.filter((record) => !persistedIds.has(record.id)),
            ...currentRecords
          ];

          return sourceRows.map((record) => !payableIds.has(record.id) ? record : {
            ...record,
            handlingStatus: '待缴费',
            paidAt: input.paidAt,
            paymentFileIds: input.paymentFileIds,
            transactionNo: input.transactionNo.trim(),
            updatedAt: financeToday,
            operationRecords: [{
              action: '登记缴费结果',
              actor: '李明',
              id: `${record.id}-payment-${record.operationRecords.length + 1}`,
              object: `${record.employeeName} / ${record.category}`,
              summary: `关联流水 ${input.transactionNo.trim()}`,
              time: `${financeToday} 10:30`
            }, ...record.operationRecords]
          });
        });

        return true;
      },
      registerMonthlyNoContribution(recordId, input) {
        const sourceRecord = findSourceRecord(recordId);
        const profile = derivedEnrollmentProfiles.find((currentProfile) => currentProfile.personId === sourceRecord?.employeeNo);
        const officialReferenceNo = input.officialReferenceNo.trim();
        const reason = input.reason.trim();
        const stopEffectiveMonth = profile?.socialSecurityStopEffectiveMonth;

        if (
          !sourceRecord
          || sourceRecord.handlingStatus === '已缴费'
          || !stopEffectiveMonth
          || stopEffectiveMonth > sourceRecord.period
          || !input.confirmedAt
          || !officialReferenceNo
          || !reason
          || input.evidenceFileIds.length === 0
        ) {
          return false;
        }

        setSocialInsuranceRecords((currentRecords) =>
          (currentRecords.some((record) => record.id === recordId) ? currentRecords : [sourceRecord, ...currentRecords]).map((record) =>
            record.id !== recordId ? record : {
              ...record,
              handlingStatus: '无需缴纳',
              noContributionConfirmedAt: input.confirmedAt,
              noContributionEvidenceFileIds: input.evidenceFileIds,
              noContributionOfficialReferenceNo: officialReferenceNo,
              reason,
              updatedAt: financeToday,
              operationRecords: [{
                action: '登记无需缴纳',
                actor: '李明',
                id: `${record.id}-no-contribution-${record.operationRecords.length + 1}`,
                object: `${record.employeeName} / ${record.category}`,
                summary: `${reason} / ${officialReferenceNo}`,
                time: `${financeToday} 10:30`
              }, ...record.operationRecords]
            }
          )
        );

        return true;
      },
      registerContributionCorrectionPayment(correctionId, input) {
        if (!input.paidAt || !input.transactionNo || input.paymentFileIds.length === 0) {
          return false;
        }

        const correction = correctionRecords.find((record) => record.id === correctionId);
        if (!correction || correction.status !== '待缴费' || correction.transactionNo) {
          return false;
        }

        setCorrectionRecords((records) => records.map((record) =>
          record.id !== correctionId ? record : {
            ...record,
            paidAt: input.paidAt,
            paymentFileIds: input.paymentFileIds,
            status: '待缴费',
            transactionNo: input.transactionNo
          }
        ));
        setSocialInsuranceRecords((records) => records.map((record) =>
          record.id !== correction.sourceRecordId ? record : {
            ...record,
            handlingStatus: '欠缴待补',
            handlingPeriod: correction.handlingPeriod,
            paidAt: input.paidAt,
            paymentFileIds: input.paymentFileIds,
            transactionNo: input.transactionNo,
            updatedAt: financeToday,
            operationRecords: [{
              action: '登记补缴结果',
              actor: '李明',
              id: `${record.id}-correction-payment-${record.operationRecords.length + 1}`,
              object: `${record.employeeName} / ${record.category}`,
              summary: `办理期 ${correction.handlingPeriod} / 流水 ${input.transactionNo}`,
              time: `${financeToday} 10:30`
            }, ...record.operationRecords]
          }
        ));

        return true;
      },
      saveContributionCorrection(record) {
        const sourceRecord = findSourceRecord(record.sourceRecordId);
        if (
          !sourceRecord
          || sourceRecord.handlingStatus !== '欠缴待补'
          || record.originalPeriod !== sourceRecord.originalPeriod
          || record.handlingPeriod < record.originalPeriod
          || !record.reason.trim()
          || !record.officialReferenceNo?.trim()
          || record.evidenceFileIds.length === 0
        ) {
          return false;
        }

        setCorrectionRecords((records) =>
          records.some((currentRecord) => currentRecord.id === record.id)
            ? records.map((currentRecord) => currentRecord.id === record.id ? record : currentRecord)
            : [record, ...records]
        );
        setSocialInsuranceRecords((records) => records.map((currentRecord) =>
          currentRecord.id !== sourceRecord.id ? currentRecord : {
            ...currentRecord,
            operationRecords: [{
              action: '创建补缴事项',
              actor: '李明',
              id: `${currentRecord.id}-correction-${currentRecord.operationRecords.length + 1}`,
              object: `${currentRecord.employeeName} / ${currentRecord.category}`,
              summary: `原所属期 ${record.originalPeriod} / 办理期 ${record.handlingPeriod}`,
              time: `${financeToday} 10:30`
            }, ...currentRecord.operationRecords],
            updatedAt: financeToday
          }
        ));
        return true;
      },
      saveEnrollmentProfile(profile) {
        if (profile.obligation === '无需参保' && !profile.noObligationReason) {
          return false;
        }

        if (
          (profile.socialSecurityStatus === '已增员' || profile.medicalInsuranceStatus === '已增员')
          && (!profile.insuredRegionCode || !profile.officialReferenceNo)
        ) {
          return false;
        }

        setEnrollmentProfiles((currentProfiles) =>
          currentProfiles.some((currentProfile) => currentProfile.personId === profile.personId)
            ? currentProfiles.map((currentProfile) => currentProfile.personId === profile.personId ? profile : currentProfile)
            : [profile, ...currentProfiles]
        );
        return true;
      },
      saveSocialInsuranceContributionBase(recordId, contributionBase) {
        const sourceRecord = findSourceRecord(recordId);
        if (!sourceRecord) {
          return false;
        }

        const periodPolicy = resolveSocialInsurancePolicyForPeriod(policyVersions, sourceRecord.category, sourceRecord.period);
        if (!periodPolicy) return false;

        const policyItems = periodPolicy.socialItems.filter((item) => item.category === sourceRecord.category && item.status === '启用');
        const lowerLimit = Math.max(0, ...policyItems.map((item) => item.baseLower ?? 0));
        const configuredUpperLimits = policyItems.flatMap((item) => item.baseUpper === undefined ? [] : [item.baseUpper]);
        const upperLimit = configuredUpperLimits.length > 0 ? Math.min(...configuredUpperLimits) : contributionBase;
        const appliedBase = getAppliedContributionBase(contributionBase, lowerLimit, upperLimit);
        const nextAmounts = getSocialInsuranceContributionAmounts(sourceRecord.category, appliedBase, periodPolicy);

        setContributionBaseRecords((currentRecords) => [
          ...currentRecords.filter((record) => !(
            record.personId === sourceRecord.employeeNo
            && record.category === sourceRecord.category
            && record.effectiveFrom === sourceRecord.period
          )),
          {
            appliedBase,
            category: sourceRecord.category,
            effectiveFrom: sourceRecord.period,
            evidenceFileIds: [],
            lowerLimit,
            personId: sourceRecord.employeeNo,
            policyVersionId: periodPolicy.id,
            policyYear: sourceRecord.period.slice(0, 4),
            regionCode: '420100',
            source: '更正',
            sourceAmount: contributionBase,
            upperLimit
          }
        ]);

        setSocialInsuranceRecords((currentRecords) =>
          (currentRecords.some((currentRecord) => currentRecord.id === recordId) ? currentRecords : [sourceRecord, ...currentRecords]).map((currentRecord) => {
              if (currentRecord.id !== recordId) {
                return currentRecord;
              }

              return {
                ...currentRecord,
                ...nextAmounts,
                contributionBase: appliedBase,
                estimatedEmployerAmount: nextAmounts.companyAmount,
                estimatedEmployeeAmount: nextAmounts.personalAmount,
                handlingStatus: '待核定',
                assessedEmployerAmount: undefined,
                assessedEmployeeAmount: undefined,
                assessmentNo: undefined,
                assessedAt: undefined,
                assessmentFileIds: [],
                confirmedAt: undefined,
                updatedAt: financeToday,
                operationRecords: [
                  {
                    action: '编辑基数',
                    actor: '李明',
                    id: `${currentRecord.id}-base-${currentRecord.operationRecords.length + 1}`,
                    object: `${currentRecord.employeeName} / ${currentRecord.category}`,
                    summary: `缴纳基数 ${formatMoney(currentRecord.contributionBase)} -> ${formatMoney(appliedBase)}`,
                    time: `${financeToday} 10:30`
                  },
                  ...currentRecord.operationRecords
                ]
              };
            })
        );

        return true;
      },
      updateSocialInsuranceRecordStatus(recordId, handlingStatus) {
        const sourceRecord = findSourceRecord(recordId);
        if (!sourceRecord || !(allowedMonthlyStatusTransitions[sourceRecord.handlingStatus] ?? []).includes(handlingStatus)) {
          return false;
        }

        setSocialInsuranceRecords((currentRecords) =>
          (currentRecords.some((currentRecord) => currentRecord.id === recordId) ? currentRecords : [sourceRecord, ...currentRecords]).map((currentRecord) => {
              if (currentRecord.id !== recordId) {
                return currentRecord;
              }

              return {
                ...currentRecord,
                handlingStatus,
                reason: handlingStatus === '欠缴待补'
                  ? currentRecord.reason ?? '原所属期欠缴，进入补缴办理'
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
        );

        return true;
      }
    }),
    [contributionBaseRecords, correctionRecords, derivedEnrollmentProfiles, findSourceRecord, getSocialInsuranceRecordsForPeriod, policyVersions, resolvedCorrectionRecords, visibleSocialInsuranceRecords]
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
