export type SalaryIitResidentType = '居民个人' | '非居民个人';
export type SalaryIitEmploymentScenario = '普通任职' | '本年首次就业';
export type SalaryIitBasicDeductionMethod = '按月累计' | '全年6万元直接扣除';
export type SalaryIitPersonnelReportingStatus = '待报送' | '已报送' | '报送异常';
export type SalaryIitDeductionAcquisitionStatus = '待获取' | '已获取' | '待更新';
export type SalaryIitDeductionSource = '自然人电子税务局' | '员工提交扣除信息表';
export type SalaryIitDeductionCategory =
  | '子女教育'
  | '3岁以下婴幼儿照护'
  | '继续教育'
  | '住房贷款利息'
  | '住房租金'
  | '赡养老人'
  | '个人养老金'
  | '其他依法扣除';

export type SalaryIitEvidenceFile = {
  id: string;
  name: string;
  status: '已上传';
  type: '扣除信息表' | '首次就业佐证';
  updatedAt: string;
};

export type SalaryIitLowIncomeEligibility = {
  confirmedAt: string;
  currentYearContinuedEmployment: boolean;
  priorYearEveryMonthEmployment: boolean;
  priorYearGrossIncomeAmount: number;
};

export type SalaryIitDeductionItem = {
  category: SalaryIitDeductionCategory;
  effectiveFrom: string;
  effectiveTo?: string;
  id: string;
  monthlyAmount: number;
};

export type SalaryIitProfile = {
  acquiredAt?: string;
  acquisitionStatus: SalaryIitDeductionAcquisitionStatus;
  basicDeductionMethod: SalaryIitBasicDeductionMethod;
  deductionItems: SalaryIitDeductionItem[];
  employeeNo: string;
  employmentScenario: SalaryIitEmploymentScenario;
  evidenceFiles: SalaryIitEvidenceFile[];
  firstEmploymentEvidenceFiles: SalaryIitEvidenceFile[];
  firstEmploymentMonth?: string;
  lowIncomeEligibility?: SalaryIitLowIncomeEligibility;
  personnelReportedAt?: string;
  personnelReportingStatus: SalaryIitPersonnelReportingStatus;
  reportingFailureReason?: string;
  residentType: SalaryIitResidentType;
  source?: SalaryIitDeductionSource;
  submittedAt?: string;
  taxYear: string;
  updatedAt: string;
};

export type SalaryIitDeductionSummary = {
  additionalDeductionAmount: number;
  otherDeductionAmount: number;
  totalDeductionAmount: number;
};

export type SalaryIitCumulativeDeductionSnapshot = {
  cumulativeAdditionalDeductionAmount: number;
  cumulativeOtherDeductionAmount: number;
};

export const salaryIitBasicDeductionMonthlyAmount = 5000;

const additionalDeductionCategories = new Set<SalaryIitDeductionCategory>([
  '子女教育',
  '3岁以下婴幼儿照护',
  '继续教育',
  '住房贷款利息',
  '住房租金',
  '赡养老人'
]);

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function createSalaryIitProfile(employeeNo: string, taxYear: string): SalaryIitProfile {
  return {
    acquisitionStatus: '待获取',
    basicDeductionMethod: '按月累计',
    deductionItems: [],
    employeeNo,
    employmentScenario: '普通任职',
    evidenceFiles: [],
    firstEmploymentEvidenceFiles: [],
    personnelReportingStatus: '待报送',
    residentType: '居民个人',
    taxYear,
    updatedAt: `${taxYear}-01-01`
  };
}

export function isSalaryIitDeductionItemActive(item: SalaryIitDeductionItem, month: string) {
  return item.effectiveFrom <= month && (!item.effectiveTo || item.effectiveTo >= month);
}

export function getSalaryIitDeductionSummary(profile: SalaryIitProfile | undefined, month: string): SalaryIitDeductionSummary {
  if (!profile || profile.acquisitionStatus !== '已获取' || profile.taxYear !== month.slice(0, 4)) {
    return { additionalDeductionAmount: 0, otherDeductionAmount: 0, totalDeductionAmount: 0 };
  }

  const activeItems = profile.deductionItems.filter((item) => isSalaryIitDeductionItemActive(item, month));
  const additionalDeductionAmount = roundMoney(
    activeItems.filter((item) => additionalDeductionCategories.has(item.category)).reduce((total, item) => total + item.monthlyAmount, 0)
  );
  const otherDeductionAmount = roundMoney(
    activeItems.filter((item) => !additionalDeductionCategories.has(item.category)).reduce((total, item) => total + item.monthlyAmount, 0)
  );

  return {
    additionalDeductionAmount,
    otherDeductionAmount,
    totalDeductionAmount: roundMoney(additionalDeductionAmount + otherDeductionAmount)
  };
}

function getTaxYearMonthsThrough(month: string) {
  const taxYear = month.slice(0, 4);
  const monthNumber = Number(month.slice(5, 7));

  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return [];
  }

  return Array.from({ length: monthNumber }, (_, index) => `${taxYear}-${String(index + 1).padStart(2, '0')}`);
}

export function getSalaryIitCumulativeDeductionSummary(
  profile: SalaryIitProfile | undefined,
  month: string
): SalaryIitDeductionSummary {
  return getTaxYearMonthsThrough(month).reduce<SalaryIitDeductionSummary>(
    (summary, currentMonth) => {
      const currentSummary = getSalaryIitDeductionSummary(profile, currentMonth);

      return {
        additionalDeductionAmount: roundMoney(summary.additionalDeductionAmount + currentSummary.additionalDeductionAmount),
        otherDeductionAmount: roundMoney(summary.otherDeductionAmount + currentSummary.otherDeductionAmount),
        totalDeductionAmount: roundMoney(summary.totalDeductionAmount + currentSummary.totalDeductionAmount)
      };
    },
    { additionalDeductionAmount: 0, otherDeductionAmount: 0, totalDeductionAmount: 0 }
  );
}

export function getSalaryIitCurrentDeductionSummary({
  month,
  priorSnapshot,
  profile
}: {
  month: string;
  priorSnapshot: SalaryIitCumulativeDeductionSnapshot;
  profile: SalaryIitProfile | undefined;
}): SalaryIitDeductionSummary {
  const cumulativeTarget = getSalaryIitCumulativeDeductionSummary(profile, month);
  const additionalDeductionAmount = roundMoney(
    Math.max(0, cumulativeTarget.additionalDeductionAmount - priorSnapshot.cumulativeAdditionalDeductionAmount)
  );
  const otherDeductionAmount = roundMoney(
    Math.max(0, cumulativeTarget.otherDeductionAmount - priorSnapshot.cumulativeOtherDeductionAmount)
  );

  return {
    additionalDeductionAmount,
    otherDeductionAmount,
    totalDeductionAmount: roundMoney(additionalDeductionAmount + otherDeductionAmount)
  };
}

export function getSalaryIitCurrentBasicDeductionAmount({
  month,
  priorCumulativeBasicDeductionAmount,
  priorCumulativePeriod,
  profile
}: {
  month: string;
  priorCumulativeBasicDeductionAmount: number;
  priorCumulativePeriod?: string;
  profile: SalaryIitProfile;
}) {
  if (
    profile.basicDeductionMethod === '全年6万元直接扣除' &&
    isSalaryIitLowIncomeEligibilityReady(profile)
  ) {
    return roundMoney(Math.max(0, 60000 - priorCumulativeBasicDeductionAmount));
  }

  if (
    profile.employmentScenario === '本年首次就业' &&
    profile.firstEmploymentMonth &&
    profile.firstEmploymentMonth.slice(0, 4) === month.slice(0, 4) &&
    profile.firstEmploymentMonth <= month
  ) {
    const cumulativeTarget = salaryIitBasicDeductionMonthlyAmount * Number(month.slice(5, 7));

    return roundMoney(Math.max(0, cumulativeTarget - priorCumulativeBasicDeductionAmount));
  }

  return priorCumulativePeriod === month ? 0 : salaryIitBasicDeductionMonthlyAmount;
}

export function isSalaryIitLowIncomeEligibilityReady(profile: SalaryIitProfile) {
  const eligibility = profile.lowIncomeEligibility;

  return Boolean(
    profile.basicDeductionMethod === '全年6万元直接扣除' &&
      profile.employmentScenario === '普通任职' &&
      eligibility &&
      eligibility.priorYearEveryMonthEmployment &&
      eligibility.currentYearContinuedEmployment &&
      eligibility.priorYearGrossIncomeAmount >= 0 &&
      eligibility.priorYearGrossIncomeAmount <= 60000 &&
      /^\d{4}-\d{2}-\d{2}$/.test(eligibility.confirmedAt) &&
      eligibility.confirmedAt.slice(0, 4) === profile.taxYear
  );
}

export function isSalaryIitEmploymentScenarioReady(profile: SalaryIitProfile) {
  if (profile.employmentScenario !== '本年首次就业') {
    return true;
  }

  return Boolean(
    profile.firstEmploymentMonth &&
      profile.firstEmploymentMonth.slice(0, 4) === profile.taxYear &&
      profile.firstEmploymentEvidenceFiles.some((file) => file.type === '首次就业佐证')
  );
}

export function isSalaryIitProfileReady(profile: SalaryIitProfile | undefined, month: string) {
  return Boolean(
    profile &&
      profile.personnelReportingStatus === '已报送' &&
      profile.acquisitionStatus === '已获取' &&
      profile.residentType === '居民个人' &&
      profile.taxYear === month.slice(0, 4) &&
      isSalaryIitEmploymentScenarioReady(profile) &&
      (profile.basicDeductionMethod !== '全年6万元直接扣除' || isSalaryIitLowIncomeEligibilityReady(profile))
  );
}

export function maskSalaryIitIdentityNo(identityNo: string | undefined) {
  if (!identityNo || identityNo.length < 8) {
    return '-';
  }

  return `${identityNo.slice(0, 4)}**********${identityNo.slice(-4)}`;
}

export const initialSalaryIitProfiles: SalaryIitProfile[] = [
  {
    acquisitionStatus: '待获取',
    basicDeductionMethod: '按月累计',
    deductionItems: [],
    employeeNo: '20260001',
    employmentScenario: '普通任职',
    evidenceFiles: [],
    firstEmploymentEvidenceFiles: [],
    personnelReportingStatus: '待报送',
    residentType: '居民个人',
    taxYear: '2026',
    updatedAt: '2026-06-18'
  },
  {
    acquiredAt: '2026-06-08',
    acquisitionStatus: '已获取',
    basicDeductionMethod: '按月累计',
    deductionItems: [
      { category: '住房贷款利息', effectiveFrom: '2026-01', id: 'iit-deduction-20250018-mortgage', monthlyAmount: 1000 },
      { category: '赡养老人', effectiveFrom: '2026-01', id: 'iit-deduction-20250018-elderly', monthlyAmount: 1500 },
      { category: '个人养老金', effectiveFrom: '2026-01', id: 'iit-deduction-20250018-pension', monthlyAmount: 1000 }
    ],
    employeeNo: '20250018',
    employmentScenario: '普通任职',
    evidenceFiles: [
      {
        id: 'iit-file-20250018-2026',
        name: '2026年个人所得税专项附加扣除信息表.pdf',
        status: '已上传',
        type: '扣除信息表',
        updatedAt: '2026-06-08'
      }
    ],
    firstEmploymentEvidenceFiles: [],
    personnelReportedAt: '2025-01-10',
    personnelReportingStatus: '已报送',
    residentType: '居民个人',
    source: '员工提交扣除信息表',
    submittedAt: '2026-06-08',
    taxYear: '2026',
    updatedAt: '2026-06-08'
  }
];
