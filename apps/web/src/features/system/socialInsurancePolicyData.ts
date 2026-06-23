import type { StatusTagTone } from '../../components/Detail';

export type SocialInsurancePolicyStatus = '草稿' | '启用' | '历史';
export type SocialInsurancePolicyItemStatus = '启用' | '停用';
export type SocialInsurancePolicyCategory = '社保' | '公积金';
export type SocialInsurancePolicyConfigType = '社保配置' | '公积金配置';

export type SocialInsurancePolicyOperationRecord = {
  action: string;
  actor: string;
  id: string;
  object: string;
  summary: string;
  time: string;
};

export type SocialInsurancePolicyItem = {
  baseLower?: number;
  baseUpper?: number;
  baseUpperRule?: string;
  category: SocialInsurancePolicyCategory;
  companyFixedAmount?: number;
  companyRate: number;
  employeeFixedAmount?: number;
  employeeRate: number;
  id: string;
  name: string;
  status: SocialInsurancePolicyItemStatus;
};

export type SocialInsurancePolicyReference = {
  category: SocialInsurancePolicyCategory;
  effectiveAt: string;
  title: string;
};

export type SocialInsurancePolicyVersion = {
  city: string;
  code: string;
  configType: SocialInsurancePolicyConfigType;
  contributionCycle: string;
  effectiveMonth: string;
  housingFundEqualRateRequired?: boolean;
  housingFundRateRange?: [number, number];
  id: string;
  name: string;
  operationRecords: SocialInsurancePolicyOperationRecord[];
  payrollBaseSource: string;
  province: string;
  references: SocialInsurancePolicyReference[];
  socialItems: SocialInsurancePolicyItem[];
  status: SocialInsurancePolicyStatus;
  version: string;
};

export const socialInsurancePolicyStatusTone = {
  草稿: 'blue',
  启用: 'green',
  历史: 'gray'
} as const satisfies Record<SocialInsurancePolicyStatus, StatusTagTone>;

export const socialInsurancePolicyItemStatusTone = {
  启用: 'green',
  停用: 'gray'
} as const satisfies Record<SocialInsurancePolicyItemStatus, StatusTagTone>;

export const socialInsurancePolicyCategoryTone = {
  社保: 'blue',
  公积金: 'green'
} as const satisfies Record<SocialInsurancePolicyCategory, StatusTagTone>;

export const socialInsurancePolicyConfigTypeTone = {
  社保配置: 'blue',
  公积金配置: 'green'
} as const satisfies Record<SocialInsurancePolicyConfigType, StatusTagTone>;

export const socialInsuranceDefaultHousingFundRateRange: [number, number] = [0.05, 0.12];

const wuhanSocialInsuranceBaseRule = '按当期武汉社保缴费基数上限执行';
const wuhanHousingFundBaseRule = '按当期武汉公积金缴存基数上限执行';

export const socialInsurancePolicyVersions: SocialInsurancePolicyVersion[] = [
  {
    city: '武汉市',
    code: 'WUHAN-SI-2026-03-V0',
    configType: '社保配置',
    contributionCycle: '自然月',
    effectiveMonth: '2026-03',
    id: 'wuhan-social-insurance-2026-03-v0',
    name: '武汉社保配置V0',
    payrollBaseSource: '人员薪资基数',
    province: '湖北省',
    references: [],
    socialItems: [
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.16,
        employeeRate: 0.08,
        id: 'wuhan-pension-v0',
        name: '养老保险',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.08,
        employeeRate: 0.02,
        id: 'wuhan-medical-v0',
        name: '医疗生育',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.01,
        employeeRate: 0.005,
        id: 'wuhan-unemployment-v0',
        name: '失业保险',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.02,
        employeeRate: 0,
        id: 'wuhan-injury-v0',
        name: '工伤保险',
        status: '启用'
      }
    ],
    status: '历史',
    version: 'V0',
    operationRecords: [
      {
        action: '转为历史',
        actor: '李明',
        id: 'op-wuhan-social-insurance-v0-history',
        object: '武汉社保配置V0',
        summary: '新社保配置启用后，原版本转为历史',
        time: '2026-06-18 15:30'
      },
      {
        action: '建立版本',
        actor: '李明',
        id: 'op-wuhan-social-insurance-v0-create',
        object: '武汉社保配置V0',
        summary: '建立湖北武汉社保配置版本',
        time: '2026-03-01 09:20'
      }
    ]
  },
  {
    city: '武汉市',
    code: 'WUHAN-SI-2026-06-V1',
    configType: '社保配置',
    contributionCycle: '自然月',
    effectiveMonth: '2026-06',
    id: 'wuhan-social-insurance-2026-06-v1',
    name: '武汉社保配置V1',
    payrollBaseSource: '人员薪资基数',
    province: '湖北省',
    references: [],
    socialItems: [
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.16,
        employeeRate: 0.08,
        id: 'wuhan-pension-v1',
        name: '养老保险',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.08,
        employeeRate: 0.02,
        id: 'wuhan-medical-v1',
        name: '医疗生育',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.01,
        employeeRate: 0.005,
        id: 'wuhan-unemployment-v1',
        name: '失业保险',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.02,
        employeeRate: 0,
        id: 'wuhan-injury-v1',
        name: '工伤保险',
        status: '启用'
      }
    ],
    status: '启用',
    version: 'V1',
    operationRecords: [
      {
        action: '建立版本',
        actor: '李明',
        id: 'op-wuhan-social-insurance-v1-create',
        object: '武汉社保配置V1',
        summary: '建立湖北武汉社保配置版本',
        time: '2026-06-18 15:40'
      }
    ]
  },
  {
    city: '武汉市',
    code: 'WUHAN-SI-2026-07-V2',
    configType: '社保配置',
    contributionCycle: '自然月',
    effectiveMonth: '2026-07',
    id: 'wuhan-social-insurance-2026-07-v2',
    name: '武汉社保配置V2',
    payrollBaseSource: '人员薪资基数',
    province: '湖北省',
    references: [],
    socialItems: [
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.16,
        employeeRate: 0.08,
        id: 'wuhan-pension-v2',
        name: '养老保险',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.08,
        employeeRate: 0.02,
        id: 'wuhan-medical-v2',
        name: '医疗生育',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.01,
        employeeRate: 0.005,
        id: 'wuhan-unemployment-v2',
        name: '失业保险',
        status: '启用'
      },
      {
        baseLower: 4224,
        baseUpperRule: wuhanSocialInsuranceBaseRule,
        category: '社保',
        companyRate: 0.02,
        employeeRate: 0,
        id: 'wuhan-injury-v2',
        name: '工伤保险',
        status: '启用'
      }
    ],
    status: '草稿',
    version: 'V2',
    operationRecords: [
      {
        action: '新增草稿',
        actor: '李明',
        id: 'op-wuhan-social-insurance-v2-draft',
        object: '武汉社保配置V2',
        summary: '复制当前社保配置后新增草稿',
        time: '2026-06-18 16:10'
      }
    ]
  },
  {
    city: '武汉市',
    code: 'WUHAN-HF-2026-03-V0',
    configType: '公积金配置',
    contributionCycle: '自然月',
    effectiveMonth: '2026-03',
    housingFundEqualRateRequired: true,
    housingFundRateRange: socialInsuranceDefaultHousingFundRateRange,
    id: 'wuhan-housing-fund-2026-03-v0',
    name: '武汉公积金配置V0',
    payrollBaseSource: '人员薪资基数',
    province: '湖北省',
    references: [
      {
        category: '公积金',
        effectiveAt: '2024-02-01',
        title: '武汉住房公积金缴存基数下限'
      }
    ],
    socialItems: [
      {
        baseLower: 2010,
        baseUpperRule: wuhanHousingFundBaseRule,
        category: '公积金',
        companyRate: 0.08,
        employeeRate: 0.08,
        id: 'wuhan-housing-fund-v0',
        name: '住房公积金',
        status: '启用'
      }
    ],
    status: '历史',
    version: 'V0',
    operationRecords: [
      {
        action: '转为历史',
        actor: '李明',
        id: 'op-wuhan-housing-fund-v0-history',
        object: '武汉公积金配置V0',
        summary: '新公积金配置启用后，原版本转为历史',
        time: '2026-06-18 15:32'
      },
      {
        action: '建立版本',
        actor: '李明',
        id: 'op-wuhan-housing-fund-v0-create',
        object: '武汉公积金配置V0',
        summary: '建立湖北武汉公积金配置版本',
        time: '2026-03-01 09:30'
      }
    ]
  },
  {
    city: '武汉市',
    code: 'WUHAN-HF-2026-06-V1',
    configType: '公积金配置',
    contributionCycle: '自然月',
    effectiveMonth: '2026-06',
    housingFundEqualRateRequired: true,
    housingFundRateRange: socialInsuranceDefaultHousingFundRateRange,
    id: 'wuhan-housing-fund-2026-06-v1',
    name: '武汉公积金配置V1',
    payrollBaseSource: '人员薪资基数',
    province: '湖北省',
    references: [
      {
        category: '公积金',
        effectiveAt: '2024-02-01',
        title: '武汉住房公积金缴存基数下限'
      },
      {
        category: '公积金',
        effectiveAt: '2024-04-03',
        title: '武汉住房公积金缴存管理办法'
      }
    ],
    socialItems: [
      {
        baseLower: 2210,
        baseUpperRule: wuhanHousingFundBaseRule,
        category: '公积金',
        companyRate: 0.1,
        employeeRate: 0.1,
        id: 'wuhan-housing-fund-v1',
        name: '住房公积金',
        status: '启用'
      }
    ],
    status: '启用',
    version: 'V1',
    operationRecords: [
      {
        action: '建立版本',
        actor: '李明',
        id: 'op-wuhan-housing-fund-v1-create',
        object: '武汉公积金配置V1',
        summary: '建立湖北武汉公积金配置版本',
        time: '2026-06-18 15:40'
      }
    ]
  },
  {
    city: '武汉市',
    code: 'WUHAN-HF-2026-07-V2',
    configType: '公积金配置',
    contributionCycle: '自然月',
    effectiveMonth: '2026-07',
    housingFundEqualRateRequired: true,
    housingFundRateRange: socialInsuranceDefaultHousingFundRateRange,
    id: 'wuhan-housing-fund-2026-07-v2',
    name: '武汉公积金配置V2',
    payrollBaseSource: '人员薪资基数',
    province: '湖北省',
    references: [
      {
        category: '公积金',
        effectiveAt: '2024-02-01',
        title: '武汉住房公积金缴存基数下限'
      },
      {
        category: '公积金',
        effectiveAt: '2024-04-03',
        title: '武汉住房公积金缴存管理办法'
      }
    ],
    socialItems: [
      {
        baseLower: 2210,
        baseUpperRule: wuhanHousingFundBaseRule,
        category: '公积金',
        companyRate: 0.12,
        employeeRate: 0.12,
        id: 'wuhan-housing-fund-v2',
        name: '住房公积金',
        status: '启用'
      }
    ],
    status: '草稿',
    version: 'V2',
    operationRecords: [
      {
        action: '新增草稿',
        actor: '李明',
        id: 'op-wuhan-housing-fund-v2-draft',
        object: '武汉公积金配置V2',
        summary: '复制当前公积金配置后新增草稿',
        time: '2026-06-18 16:12'
      }
    ]
  }
];

export function formatSocialInsuranceRate(rate: number) {
  return `${(rate * 100).toLocaleString('zh-CN', { maximumFractionDigits: 3 })}%`;
}

export function formatSocialInsuranceBase(lower?: number, upper?: number, upperRule?: string) {
  if (!lower && !upper && !upperRule) {
    return '-';
  }

  if (lower && upper) {
    return `${lower.toLocaleString('zh-CN')} - ${upper.toLocaleString('zh-CN')} 元`;
  }

  if (lower && upperRule) {
    return `下限 ${lower.toLocaleString('zh-CN')} 元 / ${upperRule}`;
  }

  if (lower) {
    return `下限 ${lower.toLocaleString('zh-CN')} 元`;
  }

  return upperRule ?? `上限 ${upper?.toLocaleString('zh-CN')} 元`;
}

export function getActiveSocialInsurancePolicy() {
  return buildCombinedSocialInsurancePolicy(socialInsurancePolicyVersions);
}

export function getPolicyConfigCategory(configType: SocialInsurancePolicyConfigType): SocialInsurancePolicyCategory {
  return configType === '社保配置' ? '社保' : '公积金';
}

export function getActivePolicyByConfigType(
  rows: SocialInsurancePolicyVersion[],
  configType: SocialInsurancePolicyConfigType
) {
  return rows.find((policy) => policy.configType === configType && policy.status === '启用')
    ?? rows.find((policy) => policy.configType === configType)
    ?? rows[0];
}

export function buildCombinedSocialInsurancePolicy(rows: SocialInsurancePolicyVersion[]): SocialInsurancePolicyVersion {
  const activeSocialPolicy = getActivePolicyByConfigType(rows, '社保配置');
  const activeHousingFundPolicy = getActivePolicyByConfigType(rows, '公积金配置');

  return {
    ...(activeSocialPolicy ?? activeHousingFundPolicy),
    code: `${activeSocialPolicy?.code ?? 'WUHAN-SI'} / ${activeHousingFundPolicy?.code ?? 'WUHAN-HF'}`,
    configType: '社保配置',
    effectiveMonth:
      activeSocialPolicy?.effectiveMonth === activeHousingFundPolicy?.effectiveMonth
        ? activeSocialPolicy?.effectiveMonth ?? activeHousingFundPolicy?.effectiveMonth ?? '-'
        : `${activeSocialPolicy?.effectiveMonth ?? '-'} / ${activeHousingFundPolicy?.effectiveMonth ?? '-'}`,
    housingFundEqualRateRequired: activeHousingFundPolicy?.housingFundEqualRateRequired ?? true,
    housingFundRateRange: activeHousingFundPolicy?.housingFundRateRange ?? socialInsuranceDefaultHousingFundRateRange,
    id: 'wuhan-social-insurance-housing-fund-active',
    name: '武汉社保公积金当前配置',
    operationRecords: [
      ...(activeSocialPolicy?.operationRecords ?? []),
      ...(activeHousingFundPolicy?.operationRecords ?? [])
    ],
    references: [
      ...(activeSocialPolicy?.references ?? []),
      ...(activeHousingFundPolicy?.references ?? [])
    ],
    socialItems: [
      ...((activeSocialPolicy?.socialItems ?? []).filter((item) => item.category === '社保')),
      ...((activeHousingFundPolicy?.socialItems ?? []).filter((item) => item.category === '公积金'))
    ],
    status: '启用',
    version: `${activeSocialPolicy?.version ?? '-'} / ${activeHousingFundPolicy?.version ?? '-'}`
  };
}

export function getPolicyContributionAmounts(
  policy: SocialInsurancePolicyVersion,
  category: SocialInsurancePolicyCategory,
  contributionBase: number
) {
  const activeItems = policy.socialItems.filter((item) => item.category === category && item.status === '启用');
  const companyAmount = activeItems.reduce(
    (total, item) => total + contributionBase * item.companyRate + (item.companyFixedAmount ?? 0),
    0
  );
  const personalAmount = activeItems.reduce(
    (total, item) => total + contributionBase * item.employeeRate + (item.employeeFixedAmount ?? 0),
    0
  );

  return {
    companyAmount: Math.round(companyAmount * 100) / 100,
    personalAmount: Math.round(personalAmount * 100) / 100
  };
}

export function getPolicyCategoryRateTotal(policy: SocialInsurancePolicyVersion, category: SocialInsurancePolicyCategory) {
  const activeItems = policy.socialItems.filter((item) => item.category === category && item.status === '启用');

  return {
    companyRate: activeItems.reduce((total, item) => total + item.companyRate, 0),
    employeeRate: activeItems.reduce((total, item) => total + item.employeeRate, 0)
  };
}
