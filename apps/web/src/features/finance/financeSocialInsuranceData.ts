import type { StatusTagTone } from '../../components/Detail';
import {
  getActiveSocialInsurancePolicy,
  getPolicyContributionAmounts
} from '../system/socialInsurancePolicyData';
import type { SocialInsurancePolicyVersion } from '../system/socialInsurancePolicyData';

export type SocialInsuranceCategory = '社保' | '公积金';
export type SocialInsuranceHandlingStatus = '待确认' | '已确认' | '延期补缴' | '本月不缴';
export type SocialInsuranceBatchStatus = '待确认' | '处理中' | '已确认';

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
  handlingStatus: Extract<SocialInsuranceHandlingStatus, '已确认'>;
  id: string;
  payrollMonth: string;
  personalAmount: number;
  reason?: string;
  sourceMonth: string;
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
  待确认: 'blue',
  已确认: 'green',
  延期补缴: 'amber',
  本月不缴: 'red'
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
    employeeName: '示例全职 A',
    employeeNo: '20260001',
    handlingStatus: '待确认',
    id: 'social-20260001-2026-06',
    operationRecords: [
      {
        action: '待确认',
        actor: '李明',
        id: 'op-social-20260001-1',
        object: '示例全职 A / 社保',
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
    employeeName: '示例全职 A',
    employeeNo: '20260001',
    handlingStatus: '待确认',
    id: 'housing-20260001-2026-06',
    operationRecords: [
      {
        action: '待确认',
        actor: '李明',
        id: 'op-housing-20260001-1',
        object: '示例全职 A / 公积金',
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
    employeeName: '示例全职 B',
    employeeNo: '20250018',
    handlingStatus: '已确认',
    id: 'social-20250018-2026-06',
    operationRecords: [
      {
        action: '确认缴纳',
        actor: '李明',
        id: 'op-social-20250018-1',
        object: '示例全职 B / 社保',
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
    employeeName: '示例全职 B',
    employeeNo: '20250018',
    handlingStatus: '延期补缴',
    id: 'housing-20250018-2026-06',
    operationRecords: [
      {
        action: '标记延期',
        actor: '李明',
        id: 'op-housing-20250018-1',
        object: '示例全职 B / 公积金',
        summary: '公积金账户信息待核对，本月延期补缴',
        time: '2026-06-15 10:10'
      }
    ],
    period: '2026-06',
    personalAmount: 820,
    position: '财务专员',
    reason: '公积金账户信息待核对',
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
