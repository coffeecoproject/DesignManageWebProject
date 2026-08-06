import type { PeopleMember } from '../people/peopleTypes';
import {
  socialInsuranceEmployeeRecords,
  type SocialInsuranceEmployeeRecord,
  type SocialInsuranceEnrollmentProfile
} from './financeSocialInsuranceData';
import {
  applyEnrollmentChannelResult,
  buildContributionCorrectionRecord,
  buildContributionCorrectionPaymentTransaction,
  buildDerivedEnrollmentProfiles,
  buildMonthlyContributionCandidates,
  buildSocialInsurancePaymentTransaction,
  buildSocialInsurancePayrollDeductions,
  getAppliedContributionBase,
  getSocialInsurancePayrollSourceState,
  getSocialInsuranceRecordEligibility,
  getVisibleSocialInsuranceRecords,
  isEnrollmentChannelEffectiveForPeriod,
  isEnrollmentEffectiveForPeriod,
  isPeopleRelationshipActiveForPeriod,
  isSocialInsuranceRecordApplicable,
  resolveContributionCorrectionPaymentStatus,
  resolveSocialInsuranceRecordPaymentStatus
} from './financeSocialInsuranceModel';
import { financePrimaryCategorySeeds, financeSecondaryCategorySeeds } from './financeData';
import { buildPublicAccountRef, publicAccountSeeds } from '../system/PublicAccountConfigState';
import { socialInsurancePolicyVersions } from '../system/socialInsurancePolicyData';

type UnitTest = { name: string; run: () => void };

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}. Expected ${expectedJson}, got ${actualJson}`);
  }
}

function createMember(overrides: Partial<PeopleMember> = {}): PeopleMember {
  return {
    archiveFiles: [], archiveStatus: '资料完整', archiveUpdatedAt: '2026-06-01', auditRecords: [],
    address: '武汉市洪山区测试路 1 号', birthDate: '1990-01-01', city: '武汉', contractNo: 'HT-001',
    contractStartAt: '2026-01-01', contractStatus: '劳动合同有效', contractType: '劳动合同', education: '本科',
    educationMajor: '管理', email: 'demo@example.com', emergencyContact: '联系人', emergencyContactPhone: '13900000000',
    emergencyContactRelation: '家属', employmentRelationshipType: '全日制劳动关系', gender: '女', graduatedAt: '2012-06-30',
    graduationSchool: '武汉大学', housingFundEffectiveMonth: '2026-01', housingFundStatus: '缴存', hukouAddress: '武汉',
    id: 'EMP-001', idDocumentType: '居民身份证', idValidUntil: '2036-01-01', identityNo: '420100199001010000',
    joinedAt: '2026-01-01', mobile: '13800000000', name: '测试员工', nationality: '中国',
    paymentProfile: { accountName: '测试员工', bankAccount: '6222000000000000', bankName: '招商银行', mode: '工资发放', payCycle: '月度' },
    personnelType: '全职', position: '财务专员',
    salaryProfile: { effectiveAt: '2026-01-01', note: '', payCycle: '月度', regularSalary: '10000 元/月', status: '已配置', structure: '月薪制' },
    source: '社会招聘', status: '在职', taskAccessStatus: '可参与任务', taskCapabilityIds: [], taskRecords: [], wechat: 'wx_demo',
    ...overrides,
    positionAssignments: overrides.positionAssignments ?? [{
      effectiveFrom: '2026-01-01',
      id: 'assignment-finance-test',
      isPrimary: true,
      positionId: 'position-finance',
      positionName: overrides.position ?? '财务专员',
      status: '生效中'
    }]
  };
}

function createProfile(overrides: Partial<SocialInsuranceEnrollmentProfile> = {}): SocialInsuranceEnrollmentProfile {
  return {
    personId: 'EMP-001', employmentRelationshipType: '全日制劳动关系', obligation: '应参保', insuredRegionCode: '420100',
    socialSecurityStatus: '已增员', medicalInsuranceStatus: '已增员', plannedEnrollmentMonth: '2026-01',
    socialSecurityEffectiveMonth: '2026-01', medicalInsuranceEffectiveMonth: '2026-01', housingFundStatus: '已增员',
    housingFundEffectiveMonth: '2026-01', socialSecurityOfficialReferenceNo: 'WH-SI-001',
    socialSecurityEvidenceFileIds: ['file-si-001'], medicalInsuranceOfficialReferenceNo: 'WH-MI-001',
    medicalInsuranceEvidenceFileIds: ['file-mi-001'], housingFundOfficialReferenceNo: 'WH-HF-001',
    housingFundEvidenceFileIds: ['file-hf-001'], updatedAt: '2026-01-03', ...overrides
  };
}

function createRecord(overrides: Partial<SocialInsuranceEmployeeRecord> = {}): SocialInsuranceEmployeeRecord {
  return {
    category: '社保', companyAmount: 2700, contributionBase: 10000, department: '财务部', employeeName: '测试员工',
    employeeNo: 'EMP-001', handlingStatus: '待核定', id: 'record-001', originalPeriod: '2026-06', handlingPeriod: '2026-06',
    eligibilitySnapshot: '应参保', items: [], estimatedEmployerAmount: 2700, estimatedEmployeeAmount: 1050,
    assessmentFileIds: [], paymentFileIds: [], operationRecords: [], period: '2026-06', personalAmount: 1050, position: '财务专员',
    salaryBase: 10000, updatedAt: '2026-06-18', ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'uses explicit enrollment obligation instead of display personnel type',
    run: () => {
      const nonFulltimeEmployee = createMember({ personnelType: '兼职', employmentRelationshipType: '非全日制劳动关系', status: '合作中' });
      const independentContractor = createMember({ id: 'EMP-002', personnelType: '兼职', employmentRelationshipType: '独立劳务合作', status: '合作中' });
      const records = [createRecord(), createRecord({ employeeNo: 'EMP-002', id: 'record-002' })];
      const profiles = [
        createProfile({ employmentRelationshipType: '非全日制劳动关系' }),
        createProfile({ personId: 'EMP-002', employmentRelationshipType: '独立劳务合作', obligation: '无需参保', noObligationReason: '独立劳务合作', socialSecurityStatus: '不适用', medicalInsuranceStatus: '不适用', socialSecurityEffectiveMonth: undefined, medicalInsuranceEffectiveMonth: undefined })
      ];

      assertDeepEqual(
        getVisibleSocialInsuranceRecords(records, [nonFulltimeEmployee, independentContractor], profiles).map((record) => record.id),
        ['record-001'],
        'non-fulltime employment must not be excluded by the part-time display type while independent labor is excluded'
      );
    }
  },
  {
    name: 'keeps an existing stop-effective record visible for official no-contribution registration',
    run: () => {
      const record = createRecord({ handlingStatus: '待申报', period: '2026-07' });
      const profile = createProfile({
        socialSecurityStatus: '已停保',
        medicalInsuranceStatus: '已停保',
        socialSecurityStopEffectiveMonth: '2026-07',
        medicalInsuranceStopEffectiveMonth: '2026-07'
      });

      assertDeepEqual(
        getVisibleSocialInsuranceRecords([record], [createMember()], [profile]).map((item) => item.id),
        ['record-001'],
        'an existing stop-effective item must remain actionable until the official no-contribution result is recorded'
      );
    }
  },
  {
    name: 'keeps pending enrollment as an obligation blocker',
    run: () => {
      const member = createMember();
      const profile = createProfile({
        socialSecurityStatus: '待增员',
        medicalInsuranceStatus: '待增员',
        socialSecurityEffectiveMonth: undefined,
        medicalInsuranceEffectiveMonth: undefined,
        socialSecurityOfficialReferenceNo: undefined,
        socialSecurityEvidenceFileIds: []
      });
      const record = createRecord();

      assertEqual(getSocialInsuranceRecordEligibility(record, member, profile), '尚未增员', 'missing enrollment is not a no-obligation reason');
      assertEqual(isSocialInsuranceRecordApplicable(record, member, profile), false, 'monthly record must wait for official enrollment effect');
    }
  },
  {
    name: 'derives monthly eligibility from official effective and stop months',
    run: () => {
      const profile = createProfile({
        socialSecurityEffectiveMonth: '2026-04',
        medicalInsuranceEffectiveMonth: '2026-04',
        socialSecurityStopEffectiveMonth: '2026-07',
        medicalInsuranceStopEffectiveMonth: '2026-07'
      });

      assertEqual(isEnrollmentEffectiveForPeriod(profile, '2026-03'), false, 'period before official enrollment must be excluded');
      assertEqual(isEnrollmentEffectiveForPeriod(profile, '2026-06'), true, 'period before stop-effective month remains payable');
      assertEqual(isEnrollmentEffectiveForPeriod(profile, '2026-07'), false, 'stop-effective month must be excluded');
    }
  },
  {
    name: 'derives enrollment work items from employment relationships and departures',
    run: () => {
      const newEmployee = createMember({ id: 'EMP-NEW', joinedAt: '2026-06-08' });
      const contractor = createMember({ id: 'EMP-LABOR', personnelType: '兼职', employmentRelationshipType: '独立劳务合作', status: '合作中' });
      const departedEmployee = createMember({ id: 'EMP-LEFT', status: '离职', contractEndAt: '2026-06-20' });
      const profiles = buildDerivedEnrollmentProfiles(
        [newEmployee, contractor, departedEmployee],
        [createProfile({ personId: 'EMP-LEFT' })],
        '2026-06'
      );

      assertEqual(profiles.find((profile) => profile.personId === 'EMP-NEW')?.socialSecurityStatus, '待增员', 'new employee must create enrollment work');
      assertEqual(profiles.find((profile) => profile.personId === 'EMP-LABOR')?.obligation, '无需参保', 'independent labor must keep a structured no-obligation result');
      assertEqual(profiles.find((profile) => profile.personId === 'EMP-LEFT')?.socialSecurityStatus, '待停保', 'departure must create stop-enrollment work');
    }
  },
  {
    name: 'generates monthly candidates from enrollment interval, base and period policy',
    run: () => {
      const member = createMember({ id: 'EMP-GENERATED', housingFundStatus: '缴存', housingFundEffectiveMonth: '2026-06' });
      const profile = createProfile({ personId: member.id });
      const candidates = buildMonthlyContributionCandidates({
        contributionBaseRecords: (['社保', '公积金'] as const).map((category) => ({
          category,
          personId: member.id,
          policyYear: '2026',
          regionCode: '420100',
          source: '新入职首月工资',
          sourceAmount: 9000,
          lowerLimit: 4224,
          upperLimit: 21120,
          appliedBase: 9000,
          effectiveFrom: '2026-06',
          policyVersionId: 'wuhan-social-insurance-2026-06-v1',
          evidenceFileIds: []
        })),
        existingRecords: [],
        peopleRows: [member],
        period: '2026-06',
        policies: socialInsurancePolicyVersions,
        profiles: [profile]
      });

      assertDeepEqual(candidates.map((record) => [record.category, record.handlingStatus]), [['社保', '待申报'], ['公积金', '待申报']], 'eligible employee must receive both monthly candidates');
      assertDeepEqual(
        candidates.find((record) => record.category === '社保')?.items.map((item) => item.itemCode),
        ['基本养老保险', '职工基本医疗保险', '失业保险', '工伤保险'],
        'social insurance must retain item-level contribution details'
      );
      assertEqual(candidates[0]?.items.every((item) => item.policyVersionId === 'wuhan-social-insurance-2026-06-v1'), true, 'candidate must freeze the applicable period policy version');
    }
  },
  {
    name: 'clamps contribution bases to policy bounds',
    run: () => {
      assertEqual(getAppliedContributionBase(3000, 4224, 21120), 4224, 'low source amount must use the lower limit');
      assertEqual(getAppliedContributionBase(12000, 4224, 21120), 12000, 'in-range source amount must remain unchanged');
      assertEqual(getAppliedContributionBase(30000, 4224, 21120), 21120, 'high source amount must use the upper limit');
    }
  },
  {
    name: 'salary consumes formally assessed amounts before payment completion',
    run: () => {
      const deductions = buildSocialInsurancePayrollDeductions([
        createRecord({ handlingStatus: '待缴费', assessedEmployerAmount: 2800, assessedEmployeeAmount: 1080, assessmentNo: 'ASSESS-001', assessmentFileIds: ['file-assess'] }),
        createRecord({ id: 'pending', handlingStatus: '待核定' }),
        createRecord({ id: 'arrears', handlingStatus: '欠缴待补' })
      ], '2026-06');

      assertDeepEqual(deductions.map((record) => [record.id, record.personalAmount]), [['record-001', 1080]], 'only formally assessed records enter payroll');
      assertEqual(getSocialInsurancePayrollSourceState(createRecord({ handlingStatus: '待缴费' })), '计入扣款', 'payment completion is not a payroll prerequisite');
      assertEqual(getSocialInsurancePayrollSourceState(createRecord({ handlingStatus: '待核定' })), '待处理', 'unassessed records block payroll');
      assertEqual(getSocialInsurancePayrollSourceState(createRecord({ handlingStatus: '欠缴待补' })), '本月不扣', 'arrears require an explicit correction record rather than automatic carryover');
    }
  },
  {
    name: 'keeps arrears correction in its original period while splitting principal and late fee',
    run: () => {
      const correction = buildContributionCorrectionRecord({
        evidenceFileIds: ['arrears-assessment.pdf'],
        handlingPeriod: '2026-07',
        lateFeeAmount: 18.5,
        officialReferenceNo: 'WH-ARREARS-202607-001',
        principalEmployeeAmount: 820,
        principalEmployerAmount: 820,
        reason: '补缴 2026-06 公积金',
        sourceRecord: createRecord({ category: '公积金', handlingStatus: '欠缴待补', originalPeriod: '2026-06' })
      });

      assertEqual(correction?.originalPeriod, '2026-06', 'arrears must retain the original obligation period');
      assertEqual(correction?.handlingPeriod, '2026-07', 'arrears must record the actual handling period');
      assertDeepEqual(
        [correction?.principalEmployerAmount, correction?.principalEmployeeAmount, correction?.lateFeeAmount],
        [820, 820, 18.5],
        'employer principal, employee principal and late fee must remain separate'
      );
      assertEqual(correction?.salaryAdjustmentPeriod, '2026-07', 'employee principal must enter the handling-period salary adjustment source');
    }
  },
  {
    name: 'creates an arrears payment with employer expense employee receivable and late-fee allocations',
    run: () => {
      const correction = buildContributionCorrectionRecord({
        evidenceFileIds: ['arrears-assessment.pdf'],
        handlingPeriod: '2026-07',
        lateFeeAmount: 18.5,
        officialReferenceNo: 'WH-ARREARS-202607-001',
        principalEmployeeAmount: 820,
        principalEmployerAmount: 820,
        reason: '补缴 2026-06 公积金',
        sourceRecord: createRecord({ category: '公积金', handlingStatus: '欠缴待补', originalPeriod: '2026-06' })
      });
      if (!correction) throw new Error('expected correction record');

      const transaction = buildContributionCorrectionPaymentTransaction({
        correction,
        financePrimaryCategories: financePrimaryCategorySeeds,
        financeRows: [],
        financeSecondaryCategories: financeSecondaryCategorySeeds,
        paidAt: '2026-07-18',
        paymentFileIds: ['arrears-payment.pdf'],
        publicAccountRef: buildPublicAccountRef(publicAccountSeeds[0])
      });

      assertEqual(transaction?.amount, 1658.5, 'arrears cash amount must include principal and late fee');
      assertDeepEqual(
        transaction?.accountingAllocations?.map((allocation) => [allocation.subjectCode, allocation.amount]),
        [['5602.02', 820], ['1221', 820], ['5711', 18.5]],
        'employer principal must enter employee-benefit expense, employee principal must remain recoverable and late fee must enter non-operating expense'
      );
      assertEqual(transaction?.status, '待复核', 'arrears payment must enter finance review');
      assertEqual(transaction?.sourceNo, correction.id, 'cash flow must retain the correction source');
    }
  },
  {
    name: 'creates one pending-review payment transaction from a confirmed monthly batch',
    run: () => {
      const transaction = buildSocialInsurancePaymentTransaction({
        category: '社保',
        financePrimaryCategories: financePrimaryCategorySeeds,
        financeRows: [],
        financeSecondaryCategories: financeSecondaryCategorySeeds,
        paidAt: '2026-07-10',
        paymentFileIds: ['social-payment.pdf'],
        period: '2026-06',
        publicAccountRef: buildPublicAccountRef(publicAccountSeeds[0]),
        records: [createRecord({
          assessedEmployeeAmount: 1080,
          assessedEmployerAmount: 2800,
          assessmentFileIds: ['assessment.pdf'],
          assessmentNo: 'WH-ASSESS-001',
          handlingStatus: '待缴费'
        })]
      });

      assertEqual(transaction?.amount, 3880, 'payment transaction must use assessed employer and employee amounts');
      assertEqual(transaction?.status, '待复核', 'registered payment must enter finance review instead of direct booking');
      assertEqual(transaction?.accountingPeriod, '2026-07', 'cash-flow period must follow actual payment date');
      assertEqual(transaction?.sourceNo, 'SI-2026-06-社保', 'cash flow must retain the contribution obligation period');
    }
  },
  {
    name: 'marks contribution obligations paid only after the linked cash flow is reviewed and posted',
    run: () => {
      const sourceRecord = createRecord({ handlingStatus: '待缴费', transactionNo: 'FIN-SI-001' });
      const pendingTransaction = buildSocialInsurancePaymentTransaction({
        category: '社保',
        financePrimaryCategories: financePrimaryCategorySeeds,
        financeRows: [],
        financeSecondaryCategories: financeSecondaryCategorySeeds,
        paidAt: '2026-07-10',
        paymentFileIds: ['social-payment.pdf'],
        period: '2026-06',
        publicAccountRef: buildPublicAccountRef(publicAccountSeeds[0]),
        records: [createRecord({ assessedEmployeeAmount: 1050, assessedEmployerAmount: 2700, handlingStatus: '待缴费' })]
      });
      if (!pendingTransaction) throw new Error('expected pending social-insurance transaction');
      const linkedPendingTransaction = { ...pendingTransaction, transactionNo: 'FIN-SI-001' };

      assertEqual(resolveSocialInsuranceRecordPaymentStatus(sourceRecord, [linkedPendingTransaction]).handlingStatus, '待缴费', 'pending review must not be represented as paid');
      assertEqual(resolveSocialInsuranceRecordPaymentStatus(sourceRecord, [{ ...linkedPendingTransaction, status: '已入账' }]).handlingStatus, '已缴费', 'reviewed and posted cash flow completes the obligation');
      assertEqual(buildSocialInsurancePaymentTransaction({
        category: '社保',
        financePrimaryCategories: financePrimaryCategorySeeds,
        financeRows: [linkedPendingTransaction],
        financeSecondaryCategories: financeSecondaryCategorySeeds,
        paidAt: '2026-07-10',
        paymentFileIds: ['social-payment.pdf'],
        period: '2026-06',
        publicAccountRef: buildPublicAccountRef(publicAccountSeeds[0]),
        records: [sourceRecord]
      }), undefined, 'an obligation with a pending-review cash flow must not create a duplicate payment');
    }
  },
  {
    name: 'completes an arrears correction only after its linked cash flow is reviewed and posted',
    run: () => {
      const correction = buildContributionCorrectionRecord({
        evidenceFileIds: ['arrears-assessment.pdf'],
        handlingPeriod: '2026-07',
        lateFeeAmount: 18.5,
        officialReferenceNo: 'WH-ARREARS-202607-001',
        principalEmployeeAmount: 820,
        principalEmployerAmount: 820,
        reason: '补缴 2026-06 公积金',
        sourceRecord: createRecord({ category: '公积金', handlingStatus: '欠缴待补', originalPeriod: '2026-06' })
      });
      if (!correction) throw new Error('expected correction record');
      const linkedCorrection = { ...correction, transactionNo: 'FIN-SI-002' };
      const transaction = buildContributionCorrectionPaymentTransaction({
        correction,
        financePrimaryCategories: financePrimaryCategorySeeds,
        financeRows: [],
        financeSecondaryCategories: financeSecondaryCategorySeeds,
        paidAt: '2026-07-18',
        paymentFileIds: ['arrears-payment.pdf'],
        publicAccountRef: buildPublicAccountRef(publicAccountSeeds[0])
      });
      if (!transaction) throw new Error('expected correction transaction');
      const linkedPendingTransaction = { ...transaction, transactionNo: 'FIN-SI-002' };

      assertEqual(resolveContributionCorrectionPaymentStatus(linkedCorrection, [linkedPendingTransaction]).status, '待缴费', 'pending review must keep correction open');
      assertEqual(resolveContributionCorrectionPaymentStatus(linkedCorrection, [{ ...linkedPendingTransaction, status: '已入账' }]).status, '已完成', 'reviewed and posted cash flow completes correction');
      assertEqual(buildContributionCorrectionPaymentTransaction({
        correction: linkedCorrection,
        financePrimaryCategories: financePrimaryCategorySeeds,
        financeRows: [linkedPendingTransaction],
        financeSecondaryCategories: financeSecondaryCategorySeeds,
        paidAt: '2026-07-18',
        paymentFileIds: ['arrears-payment.pdf'],
        publicAccountRef: buildPublicAccountRef(publicAccountSeeds[0])
      }), undefined, 'a correction with a pending-review cash flow must not create a duplicate payment');
    }
  },
  {
    name: 'saves each enrollment channel without mutating the other handling facts',
    run: () => {
      const profile = createProfile();
      const stoppedSocial = applyEnrollmentChannelResult(profile, '社保', {
        action: '停办',
        effectiveMonth: '2026-07',
        evidenceFileIds: ['social-stop.pdf'],
        insuredRegionCode: '420100',
        officialReferenceNo: 'WH-SI-STOP-001',
        updatedAt: '2026-07-03'
      });
      if (!stoppedSocial) throw new Error('expected channel result');

      assertEqual(stoppedSocial.obligation, '应参保', 'stopping one channel must not rewrite the historical obligation');
      assertEqual(stoppedSocial.socialSecurityStatus, '已停保', 'selected channel must be updated');
      assertEqual(stoppedSocial.medicalInsuranceStatus, '已增员', 'medical insurance must remain unchanged');
      assertEqual(stoppedSocial.housingFundStatus, '已增员', 'housing fund must remain unchanged');
      assertEqual(stoppedSocial.medicalInsuranceOfficialReferenceNo, profile.medicalInsuranceOfficialReferenceNo, 'medical evidence identity must remain unchanged');
    }
  },
  {
    name: 'keeps historical relationship eligibility after a later departure',
    run: () => {
      const departed = createMember({ contractEndAt: '2026-05-20', status: '离职' });

      assertEqual(isPeopleRelationshipActiveForPeriod(departed, '2026-04'), true, 'a later departure must not erase an earlier active month');
      assertEqual(isPeopleRelationshipActiveForPeriod(departed, '2026-06'), false, 'a month after departure must be excluded');
    }
  },
  {
    name: 'evaluates social insurance medical insurance and housing fund intervals independently',
    run: () => {
      const profile = createProfile({
        socialSecurityStopEffectiveMonth: '2026-06',
        medicalInsuranceStopEffectiveMonth: '2026-07',
        housingFundStopEffectiveMonth: '2026-08'
      });

      assertEqual(isEnrollmentChannelEffectiveForPeriod(profile, '社保', '2026-06'), false, 'social insurance can stop independently');
      assertEqual(isEnrollmentChannelEffectiveForPeriod(profile, '医保', '2026-06'), true, 'medical insurance remains effective until its own stop month');
      assertEqual(isEnrollmentChannelEffectiveForPeriod(profile, '公积金', '2026-07'), true, 'housing fund must use its own stop month');
      assertEqual(isEnrollmentEffectiveForPeriod(profile, '2026-06'), true, 'combined social contribution remains applicable while medical insurance is active');
    }
  },
  {
    name: 'freezes category-specific policy versions on seeded contribution details',
    run: () => {
      const socialRecord = socialInsuranceEmployeeRecords.find((record) => record.category === '社保');
      const housingRecord = socialInsuranceEmployeeRecords.find((record) => record.category === '公积金');

      assertEqual(
        socialRecord?.items.every((item) => item.policyVersionId === 'wuhan-social-insurance-2026-06-v1'),
        true,
        'social contribution details must retain the social policy version'
      );
      assertEqual(
        housingRecord?.items.every((item) => item.policyVersionId === 'wuhan-housing-fund-2026-06-v1'),
        true,
        'housing-fund details must retain the housing-fund policy version'
      );
    }
  },
  {
    name: 'marks orphan records as inapplicable',
    run: () => {
      const record = createRecord({ employeeNo: 'EMP-404' });
      assertEqual(getSocialInsuranceRecordEligibility(record, undefined), '人员不存在', 'orphan records must not enter the workbench');
      assertEqual(isSocialInsuranceRecordApplicable(record, undefined), false, 'orphan records must be hidden');
    }
  }
];

export function runFinanceSocialInsuranceModelTests() {
  const failures: string[] = [];
  for (const test of tests) {
    try { test.run(); } catch (error) { failures.push(`${test.name}: ${(error as Error).message}`); }
  }
  return { failures, passed: tests.length - failures.length, total: tests.length };
}
