import type { StatusTagTone } from '../../components/Detail';
import type { EmploymentRelationshipType } from '../people/peopleTypes';
import {
  getActiveSocialInsurancePolicy,
  getPolicyContributionAmounts
} from '../system/socialInsurancePolicyData';
import type { SocialInsurancePolicyVersion } from '../system/socialInsurancePolicyData';

export type SocialInsuranceCategory = '社保' | '公积金';
export type SocialInsuranceObligation = '应参保' | '无需参保' | '待判定';
export type SocialInsuranceNoObligationReason =
  | '劳动关系尚未开始'
  | '劳动关系已于此前结束'
  | '独立劳务合作'
  | '企业供应商'
  | '官方确认无需参保';
export type EnrollmentHandlingStatus =
  | '待增员'
  | '增员办理中'
  | '已增员'
  | '待停保'
  | '停保办理中'
  | '已停保'
  | '办理异常'
  | '不适用';
export type MonthlyContributionStatus =
  | '待测算'
  | '待申报'
  | '待核定'
  | '核定有差异'
  | '待确认'
  | '待缴费'
  | '已缴费'
  | '欠缴待补'
  | '无需缴纳';
export type SocialInsuranceHandlingStatus = MonthlyContributionStatus;
export type ContributionBaseSource = '上年度月平均工资' | '新入职首月工资' | '新入职当年平均工资' | '官方核定' | '更正';
export type ContributionItemCode =
  | '基本养老保险'
  | '职工基本医疗保险'
  | '生育保险'
  | '失业保险'
  | '工伤保险'
  | '住房公积金';
export type SocialInsuranceBatchStatus = '待确认' | '处理中' | '已确认';

export type SocialInsuranceEnrollmentProfile = {
  personId: string;
  employmentRelationshipType: EmploymentRelationshipType;
  obligation: SocialInsuranceObligation;
  noObligationReason?: SocialInsuranceNoObligationReason;
  insuredRegionCode?: string;
  socialSecurityStatus: EnrollmentHandlingStatus;
  medicalInsuranceStatus: EnrollmentHandlingStatus;
  plannedEnrollmentMonth?: string;
  socialSecurityEffectiveMonth?: string;
  medicalInsuranceEffectiveMonth?: string;
  plannedStopMonth?: string;
  socialSecurityStopEffectiveMonth?: string;
  medicalInsuranceStopEffectiveMonth?: string;
  officialReferenceNo?: string;
  evidenceFileIds: string[];
  updatedAt: string;
};

export type ContributionBaseRecord = {
  category: SocialInsuranceCategory;
  personId: string;
  policyYear: string;
  regionCode: string;
  source: ContributionBaseSource;
  sourceAmount: number;
  lowerLimit: number;
  upperLimit: number;
  appliedBase: number;
  effectiveFrom: string;
  effectiveTo?: string;
  policyVersionId: string;
  evidenceFileIds: string[];
};

export type MonthlyContributionItem = {
  itemCode: ContributionItemCode;
  contributionBase: number;
  employerRate: number;
  employeeRate: number;
  estimatedEmployerAmount: number;
  estimatedEmployeeAmount: number;
  assessedEmployerAmount?: number;
  assessedEmployeeAmount?: number;
  policyVersionId: string;
};

export type SocialInsuranceOperationRecord = {
  action: string;
  actor: string;
  id: string;
  object: string;
  summary: string;
  time: string;
};

export type SocialInsuranceEmployeeRecord = {
  category: SocialInsuranceCategory;
  companyAmount: number;
  contributionBase: number;
  department: string;
  employeeName: string;
  employeeNo: string;
  handlingStatus: SocialInsuranceHandlingStatus;
  id: string;
  makeupPeriod?: string;
  originalPeriod: string;
  handlingPeriod: string;
  eligibilitySnapshot: SocialInsuranceObligation;
  items: MonthlyContributionItem[];
  estimatedEmployerAmount: number;
  estimatedEmployeeAmount: number;
  assessedEmployerAmount?: number;
  assessedEmployeeAmount?: number;
  assessmentNo?: string;
  assessedAt?: string;
  assessmentFileIds: string[];
  differenceReason?: string;
  confirmedAt?: string;
  paidAt?: string;
  transactionNo?: string;
  paymentFileIds: string[];
  correctionOfRecordId?: string;
  noContributionConfirmedAt?: string;
  noContributionEvidenceFileIds?: string[];
  noContributionOfficialReferenceNo?: string;
  operationRecords: SocialInsuranceOperationRecord[];
  period: string;
  personalAmount: number;
  position: string;
  reason?: string;
  salaryBase: number;
  updatedAt: string;
};

export type SocialInsurancePayrollDeductionRecord = {
  accrualPeriod: string;
  category: SocialInsuranceCategory;
  companyAmount: number;
  contributionBase: number;
  employeeName: string;
  employeeNo: string;
  handlingStatus: Extract<SocialInsuranceHandlingStatus, '待缴费' | '已缴费'>;
  id: string;
  payrollMonth: string;
  personalAmount: number;
  reason?: string;
  sourceMonth: string;
};

export type ContributionCorrectionRecord = {
  category: SocialInsuranceCategory;
  employeeName: string;
  employeeNo: string;
  id: string;
  sourceRecordId: string;
  originalPeriod: string;
  handlingPeriod: string;
  reason: string;
  principalEmployerAmount: number;
  principalEmployeeAmount: number;
  lateFeeAmount: number;
  officialReferenceNo?: string;
  evidenceFileIds: string[];
  salaryAdjustmentPeriod?: string;
  accountingAdjustmentReference?: string;
  paidAt?: string;
  paymentFileIds?: string[];
  status: '待办理' | '待核定' | '待缴费' | '已完成' | '已撤销';
  transactionNo?: string;
};

export type SocialInsuranceBatchRecord = {
  category: SocialInsuranceCategory;
  confirmedAt?: string;
  confirmedBy?: string;
  id: string;
  period: string;
  status: SocialInsuranceBatchStatus;
  title: string;
};

export const socialInsuranceCurrentPeriod = '2026-06';

export const socialInsuranceEnrollmentProfiles: SocialInsuranceEnrollmentProfile[] = [
  {
    personId: '20260001',
    employmentRelationshipType: '全日制劳动关系',
    obligation: '应参保',
    insuredRegionCode: '420100',
    socialSecurityStatus: '已增员',
    medicalInsuranceStatus: '已增员',
    plannedEnrollmentMonth: '2026-04',
    socialSecurityEffectiveMonth: '2026-04',
    medicalInsuranceEffectiveMonth: '2026-04',
    officialReferenceNo: 'WH-SI-202604-001',
    evidenceFileIds: ['FILE-SI-20260001-001'],
    updatedAt: '2026-04-03'
  },
  {
    personId: '20250018',
    employmentRelationshipType: '全日制劳动关系',
    obligation: '应参保',
    insuredRegionCode: '420100',
    socialSecurityStatus: '已增员',
    medicalInsuranceStatus: '已增员',
    plannedEnrollmentMonth: '2025-11',
    socialSecurityEffectiveMonth: '2025-11',
    medicalInsuranceEffectiveMonth: '2025-11',
    officialReferenceNo: 'WH-SI-202511-018',
    evidenceFileIds: ['FILE-SI-20250018-001'],
    updatedAt: '2025-11-18'
  },
  {
    personId: '20240009',
    employmentRelationshipType: '全日制劳动关系',
    obligation: '无需参保',
    noObligationReason: '劳动关系已于此前结束',
    insuredRegionCode: '420100',
    socialSecurityStatus: '已停保',
    medicalInsuranceStatus: '已停保',
    plannedStopMonth: '2026-05',
    socialSecurityStopEffectiveMonth: '2026-06',
    medicalInsuranceStopEffectiveMonth: '2026-06',
    officialReferenceNo: 'WH-SI-STOP-202605-009',
    evidenceFileIds: ['FILE-SI-20240009-STOP'],
    updatedAt: '2026-05-06'
  },
  {
    personId: '20260006',
    employmentRelationshipType: '独立劳务合作',
    obligation: '无需参保',
    noObligationReason: '独立劳务合作',
    socialSecurityStatus: '不适用',
    medicalInsuranceStatus: '不适用',
    evidenceFileIds: [],
    updatedAt: '2026-05-01'
  },
  {
    personId: '20250011',
    employmentRelationshipType: '独立劳务合作',
    obligation: '无需参保',
    noObligationReason: '独立劳务合作',
    socialSecurityStatus: '不适用',
    medicalInsuranceStatus: '不适用',
    evidenceFileIds: [],
    updatedAt: '2026-04-30'
  }
];

export const socialInsuranceContributionBaseRecords: ContributionBaseRecord[] = [
  {
    category: '社保',
    personId: '20260001',
    policyYear: '2026',
    regionCode: '420100',
    source: '新入职首月工资',
    sourceAmount: 12000,
    lowerLimit: 4224,
    upperLimit: 21120,
    appliedBase: 12000,
    effectiveFrom: '2026-04',
    policyVersionId: 'wuhan-social-insurance-2026-06-v1',
    evidenceFileIds: []
  },
  {
    category: '公积金',
    personId: '20260001',
    policyYear: '2026',
    regionCode: '420100',
    source: '新入职首月工资',
    sourceAmount: 12000,
    lowerLimit: 4224,
    upperLimit: 21120,
    appliedBase: 12000,
    effectiveFrom: '2026-04',
    policyVersionId: 'wuhan-housing-fund-2026-06-v1',
    evidenceFileIds: []
  },
  {
    category: '社保',
    personId: '20250018',
    policyYear: '2026',
    regionCode: '420100',
    source: '上年度月平均工资',
    sourceAmount: 8200,
    lowerLimit: 4224,
    upperLimit: 21120,
    appliedBase: 8200,
    effectiveFrom: '2026-01',
    policyVersionId: 'wuhan-social-insurance-2026-06-v1',
    evidenceFileIds: []
  },
  {
    category: '公积金',
    personId: '20250018',
    policyYear: '2026',
    regionCode: '420100',
    source: '上年度月平均工资',
    sourceAmount: 8200,
    lowerLimit: 4224,
    upperLimit: 21120,
    appliedBase: 8200,
    effectiveFrom: '2026-01',
    policyVersionId: 'wuhan-housing-fund-2026-06-v1',
    evidenceFileIds: []
  }
];

function buildContributionItems(
  category: SocialInsuranceCategory,
  contributionBase: number,
  employerAmount: number,
  employeeAmount: number,
  assessed: boolean
): MonthlyContributionItem[] {
  const policyVersionId = 'wuhan-social-insurance-2026-06-v1';
  const itemCode: ContributionItemCode = category === '公积金' ? '住房公积金' : '基本养老保险';

  return [{
    itemCode,
    contributionBase,
    employerRate: contributionBase > 0 ? employerAmount / contributionBase : 0,
    employeeRate: contributionBase > 0 ? employeeAmount / contributionBase : 0,
    estimatedEmployerAmount: employerAmount,
    estimatedEmployeeAmount: employeeAmount,
    assessedEmployerAmount: assessed ? employerAmount : undefined,
    assessedEmployeeAmount: assessed ? employeeAmount : undefined,
    policyVersionId
  }];
}

export const socialInsuranceBatchRecords: SocialInsuranceBatchRecord[] = [
  {
    category: '社保',
    confirmedAt: '2026-06-15',
    confirmedBy: '李明',
    id: 'social-2026-06',
    period: socialInsuranceCurrentPeriod,
    status: '处理中',
    title: '2026-06 社保缴纳'
  },
  {
    category: '公积金',
    id: 'housing-2026-06',
    period: socialInsuranceCurrentPeriod,
    status: '待确认',
    title: '2026-06 公积金缴纳'
  }
];

export const socialInsuranceHandlingStatusTone = {
  待测算: 'gray',
  待申报: 'blue',
  待核定: 'blue',
  核定有差异: 'red',
  待确认: 'amber',
  待缴费: 'blue',
  已缴费: 'green',
  欠缴待补: 'red',
  无需缴纳: 'gray'
} as const satisfies Record<SocialInsuranceHandlingStatus, StatusTagTone>;

export const socialInsuranceBatchStatusTone = {
  待确认: 'amber',
  处理中: 'blue',
  已确认: 'green'
} as const satisfies Record<SocialInsuranceBatchStatus, StatusTagTone>;

export const socialInsuranceEmployeeRecords: SocialInsuranceEmployeeRecord[] = [
  {
    category: '社保',
    companyAmount: 3240,
    contributionBase: 12000,
    department: '经营管理',
    employeeName: '李明',
    employeeNo: '20260001',
    handlingStatus: '待核定',
    id: 'social-20260001-2026-06',
    originalPeriod: '2026-06',
    handlingPeriod: '2026-06',
    eligibilitySnapshot: '应参保',
    items: buildContributionItems('社保', 12000, 3240, 1260, false),
    estimatedEmployerAmount: 3240,
    estimatedEmployeeAmount: 1260,
    assessmentFileIds: [],
    paymentFileIds: [],
    operationRecords: [
      {
        action: '待确认',
        actor: '李明',
        id: 'op-social-20260001-1',
        object: '李明 / 社保',
        summary: '待确认本月社保缴纳数据',
        time: '2026-06-15 09:40'
      }
    ],
    period: '2026-06',
    personalAmount: 1260,
    position: 'CEO',
    reason: '参保数据待确认',
    salaryBase: 12000,
    updatedAt: '2026-06-15'
  },
  {
    category: '公积金',
    companyAmount: 1200,
    contributionBase: 12000,
    department: '经营管理',
    employeeName: '李明',
    employeeNo: '20260001',
    handlingStatus: '待核定',
    id: 'housing-20260001-2026-06',
    originalPeriod: '2026-06',
    handlingPeriod: '2026-06',
    eligibilitySnapshot: '应参保',
    items: buildContributionItems('公积金', 12000, 1200, 1200, false),
    estimatedEmployerAmount: 1200,
    estimatedEmployeeAmount: 1200,
    assessmentFileIds: [],
    paymentFileIds: [],
    operationRecords: [
      {
        action: '待确认',
        actor: '李明',
        id: 'op-housing-20260001-1',
        object: '李明 / 公积金',
        summary: '待确认本月公积金缴存数据',
        time: '2026-06-15 09:45'
      }
    ],
    period: '2026-06',
    personalAmount: 1200,
    position: 'CEO',
    reason: '缴存基数待确认',
    salaryBase: 12000,
    updatedAt: '2026-06-15'
  },
  {
    category: '社保',
    companyAmount: 2214,
    contributionBase: 8200,
    department: '财务部',
    employeeName: '陈浩',
    employeeNo: '20250018',
    handlingStatus: '待缴费',
    id: 'social-20250018-2026-06',
    originalPeriod: '2026-06',
    handlingPeriod: '2026-06',
    eligibilitySnapshot: '应参保',
    items: buildContributionItems('社保', 8200, 2214, 861, true),
    estimatedEmployerAmount: 2214,
    estimatedEmployeeAmount: 861,
    assessedEmployerAmount: 2214,
    assessedEmployeeAmount: 861,
    assessmentNo: 'WH-ASSESS-SI-202606-018',
    assessedAt: '2026-06-15',
    assessmentFileIds: ['FILE-ASSESS-SI-202606-018'],
    paymentFileIds: [],
    confirmedAt: '2026-06-15 10:05',
    operationRecords: [
      {
        action: '确认缴纳',
        actor: '李明',
        id: 'op-social-20250018-1',
        object: '陈浩 / 社保',
        summary: '按缴纳基数确认',
        time: '2026-06-15 10:05'
      }
    ],
    period: '2026-06',
    personalAmount: 861,
    position: '财务专员',
    salaryBase: 8200,
    updatedAt: '2026-06-15'
  },
  {
    category: '公积金',
    companyAmount: 820,
    contributionBase: 8200,
    department: '财务部',
    employeeName: '陈浩',
    employeeNo: '20250018',
    handlingStatus: '欠缴待补',
    id: 'housing-20250018-2026-06',
    originalPeriod: '2026-06',
    handlingPeriod: '2026-06',
    eligibilitySnapshot: '应参保',
    items: buildContributionItems('公积金', 8200, 820, 820, true),
    estimatedEmployerAmount: 820,
    estimatedEmployeeAmount: 820,
    assessedEmployerAmount: 820,
    assessedEmployeeAmount: 820,
    assessmentNo: 'WH-ASSESS-HF-202606-018',
    assessedAt: '2026-06-15',
    assessmentFileIds: ['FILE-ASSESS-HF-202606-018'],
    paymentFileIds: [],
    operationRecords: [
      {
        action: '登记欠缴',
        actor: '李明',
        id: 'op-housing-20250018-1',
        object: '陈浩 / 公积金',
        summary: '原所属期缴费未完成，转入欠缴补办',
        time: '2026-06-15 10:10'
      }
    ],
    period: '2026-06',
    personalAmount: 820,
    position: '财务专员',
    reason: '原所属期缴费未完成',
    salaryBase: 8200,
    updatedAt: '2026-06-15'
  }
];

export function getSocialInsuranceTotalAmount(record: SocialInsuranceEmployeeRecord) {
  return record.companyAmount + record.personalAmount;
}

export function getSocialInsuranceContributionAmounts(
  category: SocialInsuranceCategory,
  contributionBase: number,
  policy: SocialInsurancePolicyVersion = getActiveSocialInsurancePolicy()
) {
  return getPolicyContributionAmounts(policy, category, contributionBase);
}

export function getSocialInsuranceBatch(category: SocialInsuranceCategory, period: string) {
  return socialInsuranceBatchRecords.find((record) => record.category === category && record.period === period);
}
