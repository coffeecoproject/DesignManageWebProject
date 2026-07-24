import {
  getPeopleHousingFundStatus,
  isPeopleHousingFundContributionApplicable,
  isPeopleRelationshipActive
} from '../people/peopleDomain';
import type { PeopleMember } from '../people/peopleTypes';
import type {
  ContributionBaseRecord,
  ContributionCorrectionRecord,
  MonthlyContributionItem,
  SocialInsuranceEnrollmentProfile,
  SocialInsuranceEmployeeRecord,
  SocialInsuranceHandlingStatus,
  SocialInsurancePayrollDeductionRecord
} from './financeSocialInsuranceData';
import { socialInsuranceEnrollmentProfiles } from './financeSocialInsuranceData';
import type { SocialInsurancePolicyVersion } from '../system/socialInsurancePolicyData';
import type { PublicAccountRef } from '../system/PublicAccountConfigState';
import {
  getFinanceCategorySnapshot,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionRecord
} from './financeData';
import { financeToday } from './financeUtils';

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

function getNextSocialInsuranceTransactionNo(financeRows: FinanceTransactionRecord[], accountingPeriod: string) {
  const prefix = `FIN-${accountingPeriod.replace('-', '')}-`;
  const nextSequence = financeRows.reduce((maxSequence, record) => {
    if (!record.transactionNo.startsWith(prefix)) return maxSequence;
    const sequence = Number(record.transactionNo.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
  }, 0) + 1;

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

export function buildSocialInsurancePaymentTransaction(input: {
  category: SocialInsuranceEmployeeRecord['category'];
  financePrimaryCategories: FinancePrimaryCategoryConfig[];
  financeRows: FinanceTransactionRecord[];
  financeSecondaryCategories: FinanceSecondaryCategoryConfig[];
  paidAt: string;
  paymentFileIds: string[];
  period: string;
  publicAccountRef: PublicAccountRef;
  records: SocialInsuranceEmployeeRecord[];
}) {
  const payableRecords = input.records.filter((record) =>
    record.category === input.category
    && record.period === input.period
    && record.handlingStatus === '待缴费'
    && !record.transactionNo
  );
  const amount = payableRecords.reduce(
    (total, record) => total + (record.assessedEmployerAmount ?? 0) + (record.assessedEmployeeAmount ?? 0),
    0
  );

  if (payableRecords.length === 0 || amount <= 0 || !input.paidAt || input.paymentFileIds.length === 0) return undefined;

  const transactionNo = getNextSocialInsuranceTransactionNo(input.financeRows, input.paidAt.slice(0, 7));
  const category = input.category === '社保' ? '社保缴费' : '公积金缴费';

  return {
    accountingPeriod: input.paidAt.slice(0, 7),
    amount: Math.round(amount * 100) / 100,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category, input.financePrimaryCategories, input.financeSecondaryCategories),
    counterparty: input.category === '社保' ? '社会保险经办机构' : '住房公积金管理中心',
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '支出',
    files: input.paymentFileIds.map((fileId) => ({
      id: fileId,
      name: fileId,
      status: '已上传' as const,
      type: '缴费回单',
      updatedAt: input.paidAt
    })),
    id: `fin-social-insurance-${transactionNo}`,
    note: `${input.period} ${input.category}缴费`,
    occurredAt: input.paidAt,
    operationRecords: [{
      action: '登记流水',
      actor: '李明',
      id: `fin-op-social-insurance-${transactionNo}`,
      object: transactionNo,
      summary: `由 ${input.period} ${input.category}核定结果生成待复核流水`,
      time: `${financeToday} 10:30`
    }],
    paymentMethod: '对公账户付款',
    publicAccountId: input.publicAccountRef.publicAccountId,
    publicAccountSnapshot: input.publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: `SI-${input.period}-${input.category}`,
    sourceTitle: `${input.period} ${input.category}缴费`,
    sourceType: '社保公积金缴费',
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 10:30`,
    voucherStatus: '已上传'
  } satisfies FinanceTransactionRecord;
}

export function buildContributionCorrectionPaymentTransaction(input: {
  correction: ContributionCorrectionRecord;
  financePrimaryCategories: FinancePrimaryCategoryConfig[];
  financeRows: FinanceTransactionRecord[];
  financeSecondaryCategories: FinanceSecondaryCategoryConfig[];
  paidAt: string;
  paymentFileIds: string[];
  publicAccountRef: PublicAccountRef;
}) {
  const { correction } = input;
  const principalAmount = correction.principalEmployerAmount + correction.principalEmployeeAmount;
  const amount = principalAmount + correction.lateFeeAmount;

  if (
    correction.status !== '待缴费'
    || Boolean(correction.transactionNo)
    || amount <= 0
    || !input.paidAt
    || input.paymentFileIds.length === 0
  ) return undefined;

  const transactionNo = getNextSocialInsuranceTransactionNo(input.financeRows, input.paidAt.slice(0, 7));
  const category = correction.category === '社保' ? '社保缴费' : '公积金缴费';
  const liabilitySubjectCode = correction.category === '社保' ? '2211.03' : '2211.04';

  return {
    accountingAllocations: [
      ...(principalAmount > 0 ? [{ amount: principalAmount, label: `${correction.originalPeriod} ${correction.category}补缴本金`, subjectCode: liabilitySubjectCode }] : []),
      ...(correction.lateFeeAmount > 0 ? [{ amount: correction.lateFeeAmount, label: '补缴滞纳金', subjectCode: '5711' }] : [])
    ],
    accountingPeriod: input.paidAt.slice(0, 7),
    amount: Math.round(amount * 100) / 100,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category, input.financePrimaryCategories, input.financeSecondaryCategories),
    counterparty: correction.category === '社保' ? '社会保险经办机构' : '住房公积金管理中心',
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '支出',
    files: input.paymentFileIds.map((fileId) => ({
      id: fileId,
      name: fileId,
      status: '已上传' as const,
      type: '补缴回单',
      updatedAt: input.paidAt
    })),
    id: `fin-social-correction-${transactionNo}`,
    note: `${correction.originalPeriod} ${correction.category}补缴；办理期 ${correction.handlingPeriod}`,
    occurredAt: input.paidAt,
    operationRecords: [{
      action: '登记流水',
      actor: '李明',
      id: `fin-op-social-correction-${transactionNo}`,
      object: transactionNo,
      summary: `补缴本金 ${principalAmount.toFixed(2)} 元，滞纳金 ${correction.lateFeeAmount.toFixed(2)} 元`,
      time: `${financeToday} 10:30`
    }],
    paymentMethod: '对公账户付款',
    publicAccountId: input.publicAccountRef.publicAccountId,
    publicAccountSnapshot: input.publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: correction.id,
    sourceTitle: `${correction.originalPeriod} ${correction.category}补缴`,
    sourceType: '社保公积金缴费',
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 10:30`,
    voucherStatus: '已上传'
  } satisfies FinanceTransactionRecord;
}

export function resolveSocialInsuranceRecordPaymentStatus(
  record: SocialInsuranceEmployeeRecord,
  financeRows: FinanceTransactionRecord[]
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
  financeRows: FinanceTransactionRecord[]
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

  if (!isPeopleRelationshipActive(member) && !enrollmentProfile?.socialSecurityStopEffectiveMonth) {
    return '人员已结束';
  }

  if (record.category === '社保') {
    if (!enrollmentProfile || enrollmentProfile.obligation === '待判定') {
      return '参保待判定';
    }

    if (enrollmentProfile.obligation === '无需参保') {
      return '无需参保';
    }

    if (enrollmentProfile.socialSecurityStatus !== '已增员' && enrollmentProfile.socialSecurityStatus !== '待停保' && enrollmentProfile.socialSecurityStatus !== '停保办理中' && enrollmentProfile.socialSecurityStatus !== '已停保') {
      return '尚未增员';
    }

    return '适用';
  }

  const housingFundStatus = getPeopleHousingFundStatus(member);

  if (housingFundStatus !== '缴存') {
    return '公积金暂不缴存';
  }

  if (!isPeopleHousingFundContributionApplicable(member, record.period)) {
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

    const effectiveStopMonths = [
      profile?.socialSecurityStopEffectiveMonth,
      profile?.medicalInsuranceStopEffectiveMonth
    ].filter((month): month is string => Boolean(month));

    return effectiveStopMonths.some((month) => month <= record.period);
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

function getMemberRelationshipStartMonth(member: PeopleMember) {
  return (member.personnelType === '兼职' ? member.cooperationStartAt : member.joinedAt)?.slice(0, 7);
}

function getMemberRelationshipEndMonth(member: PeopleMember) {
  return (member.personnelType === '兼职' ? member.cooperationEndAt ?? member.contractEndAt : member.contractEndAt)?.slice(0, 7);
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
      if (
        relationshipEnded
        && storedProfile.obligation === '应参保'
        && !storedProfile.socialSecurityStopEffectiveMonth
        && !['待停保', '停保办理中', '已停保'].includes(storedProfile.socialSecurityStatus)
      ) {
        return {
          ...storedProfile,
          employmentRelationshipType: member.employmentRelationshipType,
          plannedStopMonth: relationshipEndMonth,
          socialSecurityStatus: '待停保' as const,
          medicalInsuranceStatus: '待停保' as const
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
        evidenceFileIds: [],
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
        plannedStopMonth: relationshipEnded ? relationshipEndMonth : undefined,
        evidenceFileIds: [],
        updatedAt: currentMonth
      };
    }

    return {
      personId: member.id,
      employmentRelationshipType: member.employmentRelationshipType,
      obligation: '应参保' as const,
      socialSecurityStatus: '待增员' as const,
      medicalInsuranceStatus: '待增员' as const,
      plannedEnrollmentMonth: getMemberRelationshipStartMonth(member) ?? currentMonth,
      evidenceFileIds: [],
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

  return policies
    .filter((policy) => policy.configType === configType && policy.status !== '草稿' && policy.effectiveMonth <= period)
    .sort((left, right) => right.effectiveMonth.localeCompare(left.effectiveMonth))[0];
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
        : member.housingFundStatus === '缴存'
          && (!member.housingFundEffectiveMonth || member.housingFundEffectiveMonth <= input.period)
          && isPeopleRelationshipActive(member);

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
