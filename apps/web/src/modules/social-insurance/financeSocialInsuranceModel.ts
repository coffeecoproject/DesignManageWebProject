import { isPeopleRelationshipActive, type PeopleMember } from '../people';
import type {
  ContributionBaseRecord,
  ContributionCorrectionRecord,
  EnrollmentChannel,
  MonthlyContributionItem,
  SocialInsuranceEnrollmentProfile,
  SocialInsuranceEmployeeRecord,
  SocialInsuranceHandlingStatus,
  SocialInsurancePayrollDeductionRecord
} from './financeSocialInsuranceData';
import { socialInsuranceEnrollmentProfiles } from './financeSocialInsuranceData';
import {
  getActivePolicyByConfigType,
  type SocialInsurancePolicyVersion
} from './socialInsurancePolicyData';

export type SocialInsuranceRecordEligibility =
  | '适用'
  | '人员不存在'
  | '无需参保'
  | '参保待判定'
  | '尚未增员'
  | '人员已结束'
  | '公积金暂不缴存'
  | '公积金未到生效月份';

export type SocialInsurancePayrollSourceState = '待处理' | '计入扣款' | '本月不扣';

export function buildContributionCorrectionRecord(input: {
  evidenceFileIds: string[];
  handlingPeriod: string;
  lateFeeAmount: number;
  officialReferenceNo: string;
  principalEmployeeAmount: number;
  principalEmployerAmount: number;
  reason: string;
  sourceRecord: SocialInsuranceEmployeeRecord;
}): ContributionCorrectionRecord | undefined {
  const officialReferenceNo = input.officialReferenceNo.trim();
  const reason = input.reason.trim();

  if (
    input.sourceRecord.handlingStatus !== '欠缴待补'
    || !input.handlingPeriod
    || input.handlingPeriod < input.sourceRecord.originalPeriod
    || !officialReferenceNo
    || !reason
    || input.evidenceFileIds.length === 0
    || input.principalEmployeeAmount < 0
    || input.principalEmployerAmount < 0
    || input.lateFeeAmount < 0
    || input.principalEmployeeAmount + input.principalEmployerAmount + input.lateFeeAmount <= 0
  ) {
    return undefined;
  }

  return {
    category: input.sourceRecord.category,
    employeeName: input.sourceRecord.employeeName,
    employeeNo: input.sourceRecord.employeeNo,
    evidenceFileIds: input.evidenceFileIds,
    handlingPeriod: input.handlingPeriod,
    id: `social-correction-${input.sourceRecord.id}-${input.handlingPeriod}`,
    officialReferenceNo,
    originalPeriod: input.sourceRecord.originalPeriod,
    principalEmployeeAmount: Math.round(input.principalEmployeeAmount * 100) / 100,
    principalEmployerAmount: Math.round(input.principalEmployerAmount * 100) / 100,
    lateFeeAmount: Math.round(input.lateFeeAmount * 100) / 100,
    reason,
    salaryAdjustmentPeriod: input.principalEmployeeAmount > 0 ? input.handlingPeriod : undefined,
    sourceRecordId: input.sourceRecord.id,
    status: '待缴费'
  };
}

/** A posted finance transaction as social insurance sees it: which payment it is and whether it is booked. */
export type SocialInsurancePaymentPosting = {
  status: string;
  transactionNo: string;
};

export function resolveSocialInsuranceRecordPaymentStatus(
  record: SocialInsuranceEmployeeRecord,
  financeRows: readonly SocialInsurancePaymentPosting[]
): SocialInsuranceEmployeeRecord {
  const paymentTransaction = record.transactionNo
    ? financeRows.find((financeRecord) => financeRecord.transactionNo === record.transactionNo)
    : undefined;

  return paymentTransaction?.status === '已入账'
    ? { ...record, handlingStatus: '已缴费' }
    : record;
}

export function resolveContributionCorrectionPaymentStatus(
  record: ContributionCorrectionRecord,
  financeRows: readonly SocialInsurancePaymentPosting[]
): ContributionCorrectionRecord {
  const paymentTransaction = record.transactionNo
    ? financeRows.find((financeRecord) => financeRecord.transactionNo === record.transactionNo)
    : undefined;

  return paymentTransaction?.status === '已入账'
    ? { ...record, status: '已完成' }
    : record;
}

export function getSocialInsuranceRecordEligibility(
  record: SocialInsuranceEmployeeRecord,
  member?: PeopleMember,
  enrollmentProfile?: SocialInsuranceEnrollmentProfile
): SocialInsuranceRecordEligibility {
  if (!member) {
    return '人员不存在';
  }

  if (!isPeopleRelationshipActiveForPeriod(member, record.period)) {
    return '人员已结束';
  }

  if (record.category === '社保') {
    if (!enrollmentProfile || enrollmentProfile.obligation === '待判定') {
      return '参保待判定';
    }

    if (enrollmentProfile.obligation === '无需参保') {
      return '无需参保';
    }

    if (!isEnrollmentEffectiveForPeriod(enrollmentProfile, record.period)) {
      return '尚未增员';
    }

    return '适用';
  }

  if (!enrollmentProfile || enrollmentProfile.housingFundStatus === '不适用') {
    return '公积金暂不缴存';
  }

  if (!isEnrollmentChannelEffectiveForPeriod(enrollmentProfile, '公积金', record.period)) {
    return '公积金未到生效月份';
  }

  return '适用';
}

export function isSocialInsuranceRecordApplicable(
  record: SocialInsuranceEmployeeRecord,
  member?: PeopleMember,
  enrollmentProfile?: SocialInsuranceEnrollmentProfile
) {
  return getSocialInsuranceRecordEligibility(record, member, enrollmentProfile) === '适用';
}

export function getVisibleSocialInsuranceRecords(
  records: SocialInsuranceEmployeeRecord[],
  peopleRows: PeopleMember[],
  enrollmentProfiles: SocialInsuranceEnrollmentProfile[] = socialInsuranceEnrollmentProfiles
) {
  const peopleByNo = new Map(peopleRows.map((member) => [member.id, member]));
  const profilesByPersonId = new Map(enrollmentProfiles.map((profile) => [profile.personId, profile]));

  return records.filter((record) => {
    if (record.handlingStatus === '无需缴纳' || record.noContributionOfficialReferenceNo) {
      return true;
    }

    const member = peopleByNo.get(record.employeeNo);
    const profile = profilesByPersonId.get(record.employeeNo);

    if (isSocialInsuranceRecordApplicable(record, member, profile)) {
      return true;
    }

    const effectiveStopMonths = record.category === '社保'
      ? [profile?.socialSecurityStopEffectiveMonth, profile?.medicalInsuranceStopEffectiveMonth]
      : [profile?.housingFundStopEffectiveMonth];

    return effectiveStopMonths.some((month) => Boolean(month && month <= record.period));
  });
}

export function getAppliedContributionBase(sourceAmount: number, lowerLimit: number, upperLimit: number) {
  return Math.min(Math.max(sourceAmount, lowerLimit), upperLimit);
}

export function resolveContributionBaseRecord(
  records: ContributionBaseRecord[],
  personId: string,
  category: SocialInsuranceEmployeeRecord['category'],
  period: string
) {
  return records
    .filter((record) =>
      record.personId === personId
      && record.category === category
      && record.effectiveFrom <= period
      && (!record.effectiveTo || record.effectiveTo >= period)
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
}

export function isEnrollmentEffectiveForPeriod(profile: SocialInsuranceEnrollmentProfile, period: string) {
  if (profile.obligation !== '应参保') {
    return false;
  }

  const socialEffective = Boolean(
    profile.socialSecurityEffectiveMonth
    && profile.socialSecurityEffectiveMonth <= period
    && (!profile.socialSecurityStopEffectiveMonth || profile.socialSecurityStopEffectiveMonth > period)
  );
  const medicalEffective = Boolean(
    profile.medicalInsuranceEffectiveMonth
    && profile.medicalInsuranceEffectiveMonth <= period
    && (!profile.medicalInsuranceStopEffectiveMonth || profile.medicalInsuranceStopEffectiveMonth > period)
  );

  return socialEffective || medicalEffective;
}

export function isEnrollmentChannelEffectiveForPeriod(
  profile: SocialInsuranceEnrollmentProfile,
  channel: '社保' | '医保' | '公积金',
  period: string
) {
  if (profile.obligation !== '应参保') return false;

  const effectiveMonth = channel === '社保'
    ? profile.socialSecurityEffectiveMonth
    : channel === '医保'
      ? profile.medicalInsuranceEffectiveMonth
      : profile.housingFundEffectiveMonth;
  const stopMonth = channel === '社保'
    ? profile.socialSecurityStopEffectiveMonth
    : channel === '医保'
      ? profile.medicalInsuranceStopEffectiveMonth
      : profile.housingFundStopEffectiveMonth;

  return Boolean(effectiveMonth && effectiveMonth <= period && (!stopMonth || stopMonth > period));
}

export function applyEnrollmentChannelResult(
  profile: SocialInsuranceEnrollmentProfile,
  channel: EnrollmentChannel,
  input: {
    action: '增员' | '停办';
    effectiveMonth: string;
    evidenceFileIds: string[];
    insuredRegionCode: string;
    officialReferenceNo: string;
    updatedAt: string;
  }
) {
  const officialReferenceNo = input.officialReferenceNo.trim();
  if (
    profile.obligation !== '应参保'
    || !input.effectiveMonth
    || !input.insuredRegionCode
    || !officialReferenceNo
    || input.evidenceFileIds.length === 0
  ) {
    return undefined;
  }

  const status = input.action === '停办' ? '已停保' as const : '已增员' as const;
  const common = {
    insuredRegionCode: input.insuredRegionCode,
    noObligationReason: undefined,
    obligation: '应参保' as const,
    updatedAt: input.updatedAt
  };

  if (channel === '社保') {
    return {
      ...profile,
      ...common,
      socialSecurityEffectiveMonth: input.action === '增员' ? input.effectiveMonth : profile.socialSecurityEffectiveMonth,
      socialSecurityEvidenceFileIds: [...input.evidenceFileIds],
      socialSecurityOfficialReferenceNo: officialReferenceNo,
      socialSecurityStatus: status,
      socialSecurityStopEffectiveMonth: input.action === '停办' ? input.effectiveMonth : undefined
    };
  }

  if (channel === '医保') {
    return {
      ...profile,
      ...common,
      medicalInsuranceEffectiveMonth: input.action === '增员' ? input.effectiveMonth : profile.medicalInsuranceEffectiveMonth,
      medicalInsuranceEvidenceFileIds: [...input.evidenceFileIds],
      medicalInsuranceOfficialReferenceNo: officialReferenceNo,
      medicalInsuranceStatus: status,
      medicalInsuranceStopEffectiveMonth: input.action === '停办' ? input.effectiveMonth : undefined
    };
  }

  return {
    ...profile,
    ...common,
    housingFundEffectiveMonth: input.action === '增员' ? input.effectiveMonth : profile.housingFundEffectiveMonth,
    housingFundEvidenceFileIds: [...input.evidenceFileIds],
    housingFundOfficialReferenceNo: officialReferenceNo,
    housingFundStatus: status,
    housingFundStopEffectiveMonth: input.action === '停办' ? input.effectiveMonth : undefined
  };
}

function getMemberRelationshipStartMonth(member: PeopleMember) {
  return (member.personnelType === '兼职' ? member.cooperationStartAt : member.joinedAt)?.slice(0, 7);
}

function getMemberRelationshipEndMonth(member: PeopleMember) {
  return (member.personnelType === '兼职' ? member.cooperationEndAt ?? member.contractEndAt : member.contractEndAt)?.slice(0, 7);
}

export function isPeopleRelationshipActiveForPeriod(member: PeopleMember, period: string) {
  const startMonth = getMemberRelationshipStartMonth(member);
  const endMonth = getMemberRelationshipEndMonth(member);

  if (startMonth && startMonth > period) return false;
  if (endMonth && endMonth < period) return false;
  return true;
}

export function buildDerivedEnrollmentProfiles(
  peopleRows: PeopleMember[],
  storedProfiles: SocialInsuranceEnrollmentProfile[],
  currentMonth: string
) {
  const profilesByPersonId = new Map(storedProfiles.map((profile) => [profile.personId, profile]));

  return peopleRows.map((member) => {
    const storedProfile = profilesByPersonId.get(member.id);
    const relationshipEnded = !isPeopleRelationshipActive(member);
    const relationshipEndMonth = getMemberRelationshipEndMonth(member) ?? currentMonth;

    if (storedProfile) {
      if (relationshipEnded && storedProfile.obligation === '应参保') {
        const needsSocialStop = !storedProfile.socialSecurityStopEffectiveMonth
          && !['待停保', '停保办理中', '已停保', '不适用'].includes(storedProfile.socialSecurityStatus);
        const needsMedicalStop = !storedProfile.medicalInsuranceStopEffectiveMonth
          && !['待停保', '停保办理中', '已停保', '不适用'].includes(storedProfile.medicalInsuranceStatus);
        const needsHousingStop = !storedProfile.housingFundStopEffectiveMonth
          && !['待停保', '停保办理中', '已停保', '不适用'].includes(storedProfile.housingFundStatus);

        return {
          ...storedProfile,
          employmentRelationshipType: member.employmentRelationshipType,
          plannedStopMonth: relationshipEndMonth,
          socialSecurityStatus: needsSocialStop ? '待停保' as const : storedProfile.socialSecurityStatus,
          medicalInsuranceStatus: needsMedicalStop ? '待停保' as const : storedProfile.medicalInsuranceStatus,
          housingFundStatus: needsHousingStop ? '待停保' as const : storedProfile.housingFundStatus
        };
      }

      return {
        ...storedProfile,
        employmentRelationshipType: member.employmentRelationshipType
      };
    }

    if (member.employmentRelationshipType === '独立劳务合作' || member.employmentRelationshipType === '企业供应商') {
      return {
        personId: member.id,
        employmentRelationshipType: member.employmentRelationshipType,
        obligation: '无需参保' as const,
        noObligationReason: member.employmentRelationshipType,
        socialSecurityStatus: '不适用' as const,
        medicalInsuranceStatus: '不适用' as const,
        housingFundStatus: '不适用' as const,
        socialSecurityEvidenceFileIds: [],
        medicalInsuranceEvidenceFileIds: [],
        housingFundEvidenceFileIds: [],
        updatedAt: currentMonth
      };
    }

    if (member.employmentRelationshipType === '非全日制劳动关系' || relationshipEnded) {
      return {
        personId: member.id,
        employmentRelationshipType: member.employmentRelationshipType,
        obligation: '待判定' as const,
        socialSecurityStatus: '办理异常' as const,
        medicalInsuranceStatus: '办理异常' as const,
        housingFundStatus: member.housingFundStatus === '缴存' ? '办理异常' as const : '不适用' as const,
        plannedStopMonth: relationshipEnded ? relationshipEndMonth : undefined,
        socialSecurityEvidenceFileIds: [],
        medicalInsuranceEvidenceFileIds: [],
        housingFundEvidenceFileIds: [],
        updatedAt: currentMonth
      };
    }

    return {
      personId: member.id,
      employmentRelationshipType: member.employmentRelationshipType,
      obligation: '应参保' as const,
      socialSecurityStatus: '待增员' as const,
      medicalInsuranceStatus: '待增员' as const,
      housingFundStatus: member.housingFundStatus === '缴存' ? '待增员' as const : '不适用' as const,
      plannedEnrollmentMonth: getMemberRelationshipStartMonth(member) ?? currentMonth,
      socialSecurityEvidenceFileIds: [],
      medicalInsuranceEvidenceFileIds: [],
      housingFundEvidenceFileIds: [],
      updatedAt: currentMonth
    };
  });
}

export function resolveSocialInsurancePolicyForPeriod(
  policies: SocialInsurancePolicyVersion[],
  category: SocialInsuranceEmployeeRecord['category'],
  period: string
) {
  const configType = category === '社保' ? '社保配置' : '公积金配置';

  return getActivePolicyByConfigType(policies, configType, period);
}

function resolveContributionItemCode(name: string): MonthlyContributionItem['itemCode'] {
  if (name.includes('医疗')) return '职工基本医疗保险';
  if (name.includes('生育')) return '生育保险';
  if (name.includes('失业')) return '失业保险';
  if (name.includes('工伤')) return '工伤保险';
  if (name.includes('公积金')) return '住房公积金';
  return '基本养老保险';
}

function isPolicyItemEffectiveForEnrollment(
  item: SocialInsurancePolicyVersion['socialItems'][number],
  profile: SocialInsuranceEnrollmentProfile,
  period: string
) {
  const effectiveMonth = item.name.includes('医疗') || item.name.includes('生育')
    ? profile.medicalInsuranceEffectiveMonth
    : profile.socialSecurityEffectiveMonth;
  const stopMonth = item.name.includes('医疗') || item.name.includes('生育')
    ? profile.medicalInsuranceStopEffectiveMonth
    : profile.socialSecurityStopEffectiveMonth;

  return Boolean(effectiveMonth && effectiveMonth <= period && (!stopMonth || stopMonth > period));
}

function buildMonthlyItems(
  policy: SocialInsurancePolicyVersion,
  category: SocialInsuranceEmployeeRecord['category'],
  contributionBase: number,
  profile: SocialInsuranceEnrollmentProfile,
  period: string
) {
  return policy.socialItems
    .filter((item) =>
      item.category === category
      && item.status === '启用'
      && (category === '公积金' || isPolicyItemEffectiveForEnrollment(item, profile, period))
    )
    .map<MonthlyContributionItem>((item) => ({
      itemCode: resolveContributionItemCode(item.name),
      contributionBase,
      employerRate: item.companyRate,
      employeeRate: item.employeeRate,
      estimatedEmployerAmount: Math.round((contributionBase * item.companyRate + (item.companyFixedAmount ?? 0)) * 100) / 100,
      estimatedEmployeeAmount: Math.round((contributionBase * item.employeeRate + (item.employeeFixedAmount ?? 0)) * 100) / 100,
      policyVersionId: policy.id
    }));
}

export function buildMonthlyContributionCandidates(input: {
  contributionBaseRecords: ContributionBaseRecord[];
  existingRecords: SocialInsuranceEmployeeRecord[];
  peopleRows: PeopleMember[];
  period: string;
  policies: SocialInsurancePolicyVersion[];
  profiles: SocialInsuranceEnrollmentProfile[];
}) {
  const existingIds = new Set(input.existingRecords.map((record) => record.id));
  const membersById = new Map(input.peopleRows.map((member) => [member.id, member]));
  const generated: SocialInsuranceEmployeeRecord[] = [];

  input.profiles.forEach((profile) => {
    const member = membersById.get(profile.personId);

    if (!member || profile.obligation !== '应参保') return;

    (['社保', '公积金'] as const).forEach((category) => {
      const recordId = `${category === '社保' ? 'social' : 'housing'}-${member.id}-${input.period}`;
      if (existingIds.has(recordId)) return;

      const categoryApplicable = category === '社保'
        ? isEnrollmentEffectiveForPeriod(profile, input.period)
        : isEnrollmentChannelEffectiveForPeriod(profile, '公积金', input.period)
          && isPeopleRelationshipActiveForPeriod(member, input.period);

      if (!categoryApplicable) return;

      const policy = resolveSocialInsurancePolicyForPeriod(input.policies, category, input.period);
      const baseRecord = resolveContributionBaseRecord(input.contributionBaseRecords, member.id, category, input.period);
      const contributionBase = baseRecord?.appliedBase ?? 0;
      const items = policy ? buildMonthlyItems(policy, category, contributionBase, profile, input.period) : [];
      const employerAmount = items.reduce((total, item) => total + item.estimatedEmployerAmount, 0);
      const employeeAmount = items.reduce((total, item) => total + item.estimatedEmployeeAmount, 0);

      generated.push({
        category,
        companyAmount: employerAmount,
        contributionBase,
        department: member.position,
        employeeName: member.name,
        employeeNo: member.id,
        handlingStatus: policy && baseRecord && items.length > 0 ? '待申报' : '待测算',
        id: recordId,
        originalPeriod: input.period,
        handlingPeriod: input.period,
        eligibilitySnapshot: profile.obligation,
        items,
        estimatedEmployerAmount: employerAmount,
        estimatedEmployeeAmount: employeeAmount,
        assessmentFileIds: [],
        paymentFileIds: [],
        operationRecords: [],
        period: input.period,
        personalAmount: employeeAmount,
        position: member.position,
        reason: !policy ? '所属期政策未配置' : !baseRecord ? '缴费基数待确定' : undefined,
        salaryBase: baseRecord?.sourceAmount ?? 0,
        updatedAt: input.period
      });
    });
  });

  return [...input.existingRecords, ...generated];
}

export function getSocialInsurancePayrollSourceState(
  record: SocialInsuranceEmployeeRecord | undefined
): SocialInsurancePayrollSourceState {
  if (!record || ['待测算', '待申报', '待核定', '核定有差异', '待确认'].includes(record.handlingStatus)) {
    return '待处理';
  }

  if (record.handlingStatus === '待缴费' || record.handlingStatus === '已缴费') {
    return '计入扣款';
  }

  return '本月不扣';
}

export function isSocialInsurancePayrollDeductible(
  record: SocialInsuranceEmployeeRecord | undefined
): record is SocialInsuranceEmployeeRecord & {
  handlingStatus: Extract<SocialInsuranceHandlingStatus, '待缴费' | '已缴费'>;
} {
  return getSocialInsurancePayrollSourceState(record) === '计入扣款';
}

export function isSocialInsurancePayrollHandled(record: SocialInsuranceEmployeeRecord | undefined) {
  return getSocialInsurancePayrollSourceState(record) !== '待处理';
}

export function buildSocialInsurancePayrollDeductions(
  records: SocialInsuranceEmployeeRecord[],
  payrollMonth: string
): SocialInsurancePayrollDeductionRecord[] {
  return records
    .filter(
      (
        record
      ): record is SocialInsuranceEmployeeRecord & {
        handlingStatus: Extract<SocialInsuranceHandlingStatus, '待缴费' | '已缴费'>;
      } => record.period === payrollMonth && isSocialInsurancePayrollDeductible(record)
    )
    .map((record) => ({
      accrualPeriod: record.period,
      category: record.category,
      companyAmount: record.assessedEmployerAmount ?? record.companyAmount,
      contributionBase: record.contributionBase,
      employeeName: record.employeeName,
      employeeNo: record.employeeNo,
      handlingStatus: record.handlingStatus,
      id: record.id,
      payrollMonth: record.period,
      personalAmount: record.assessedEmployeeAmount ?? record.personalAmount,
      reason: record.reason,
      sourceMonth: record.makeupPeriod ?? record.period
    }))
    .sort(
      (left, right) =>
        left.employeeNo.localeCompare(right.employeeNo) ||
        left.category.localeCompare(right.category) ||
        left.sourceMonth.localeCompare(right.sourceMonth)
    );
}
