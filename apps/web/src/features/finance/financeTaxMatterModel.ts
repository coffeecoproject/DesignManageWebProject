import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type { SalaryMonthlyReport } from '../salary/salaryDomain';
import {
  getFinanceCategorySnapshot,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionRecord
} from './financeData';
import type { SocialInsuranceCategory, SocialInsuranceEmployeeRecord } from './financeSocialInsuranceData';
import type {
  FinanceTaxMatterDataStatus,
  FinanceTaxMatterRecord,
  FinanceTaxMatterSourceItem,
  FinanceTaxMatterType
} from './financeTaxFilingData';
import { financeToday } from './financeUtils';

export type SocialInsuranceTaxMatterSummary = {
  category: SocialInsuranceCategory;
  companyAmount: number;
  confirmedCount: number;
  exceptionCount: number;
  participantSummary: string;
  pendingCount: number;
  period: string;
  personalAmount: number;
  recordCount: number;
  readyForHandling: boolean;
  sourceStatus: FinanceTaxMatterDataStatus;
  totalAmount: number;
};

export type PayrollIitTaxMatterSummary = {
  confirmedCount: number;
  participantSummary: string;
  payableAmount: number;
  pendingCount: number;
  period: string;
  readyForHandling: boolean;
  reportCount: number;
  sourceStatus: FinanceTaxMatterDataStatus;
  currentTaxableIncomeAmount: number;
};

export type PayrollIitTaxMatterEmployeeRow = {
  currentIncomeAmount: number;
  currentTaxableIncomeAmount: number;
  employeeName: string;
  employeeNo: string;
  grossSalary: number;
  id: string;
  includedInFiling: boolean;
  personalIncomeTaxAmount: number;
  position: string;
  salaryStatus: SalaryMonthlyReport['status'];
  socialInsuranceDeductionAmount: number;
};

export type TaxMatterReceiptFileType = '申报回执' | '缴款回单';

type TaxMatterReceiptRequirementSource = Pick<FinanceTaxMatterRecord, 'matterType' | 'payableAmount'>;

const socialTaxMatterCategoryMap: Partial<Record<FinanceTaxMatterType, SocialInsuranceCategory>> = {
  社保缴纳: '社保',
  公积金缴纳: '公积金'
};

const socialTaxMatterSourceConfig: Record<
  SocialInsuranceCategory,
  {
    confirmationName: string;
    verificationName: string;
    verificationModule: string;
  }
> = {
  公积金: {
    confirmationName: '公积金缴费明细',
    verificationModule: '公积金系统',
    verificationName: '公积金汇缴核定单'
  },
  社保: {
    confirmationName: '社保缴费明细',
    verificationModule: '电子税务局',
    verificationName: '社保缴费核定单'
  }
};

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function getSocialInsuranceCategoryByTaxMatterType(matterType: FinanceTaxMatterType) {
  return socialTaxMatterCategoryMap[matterType];
}

export function isSocialInsuranceTaxMatter(matterType: FinanceTaxMatterType) {
  return Boolean(getSocialInsuranceCategoryByTaxMatterType(matterType));
}

export function getTaxMatterRequiredReceiptTypes(record: TaxMatterReceiptRequirementSource): TaxMatterReceiptFileType[] {
  if (isSocialInsuranceTaxMatter(record.matterType)) {
    return ['缴款回单'];
  }

  return record.payableAmount > 0 ? ['申报回执', '缴款回单'] : ['申报回执'];
}

export function getMissingTaxMatterReceiptTypes(
  files: RelatedFileRecord[],
  requiredTypes: TaxMatterReceiptFileType[]
): TaxMatterReceiptFileType[] {
  return requiredTypes.filter((type) => !files.some((file) => file.type === type));
}

export function hasTaxMatterRequiredReceiptFiles(
  files: RelatedFileRecord[],
  requiredTypes: TaxMatterReceiptFileType[]
) {
  return getMissingTaxMatterReceiptTypes(files, requiredTypes).length === 0;
}

export function buildSocialInsuranceTaxMatterSummary(
  records: SocialInsuranceEmployeeRecord[],
  category: SocialInsuranceCategory,
  period: string
): SocialInsuranceTaxMatterSummary {
  const periodRecords = records.filter((record) => record.category === category && record.period === period);
  const confirmedRecords = periodRecords.filter((record) => record.handlingStatus === '已确认');
  const pendingCount = periodRecords.filter((record) => record.handlingStatus === '待确认').length;
  const exceptionCount = periodRecords.filter((record) => record.handlingStatus === '延期补缴' || record.handlingStatus === '本月不缴').length;
  const readyForHandling = periodRecords.length > 0 && pendingCount === 0 && confirmedRecords.length > 0;
  const companyAmount = roundMoney(confirmedRecords.reduce((total, record) => total + record.companyAmount, 0));
  const personalAmount = roundMoney(confirmedRecords.reduce((total, record) => total + record.personalAmount, 0));
  const totalAmount = roundMoney(companyAmount + personalAmount);
  const sourceStatus: FinanceTaxMatterDataStatus =
    readyForHandling
      ? '已确认'
      : pendingCount > 0
        ? '待复核'
      : confirmedRecords.length > 0
        ? '待复核'
        : '待准备';

  return {
    category,
    companyAmount,
    confirmedCount: confirmedRecords.length,
    exceptionCount,
    participantSummary: confirmedRecords.length > 0 ? `${confirmedRecords.length} 人` : '待确认',
    pendingCount,
    period,
    personalAmount,
    readyForHandling,
    recordCount: periodRecords.length,
    sourceStatus,
    totalAmount
  };
}

function getSourceStatusFromSocialSummary(summary: SocialInsuranceTaxMatterSummary) {
  if (summary.sourceStatus === '已确认') {
    return '已确认';
  }

  if (summary.sourceStatus === '待复核') {
    return '待复核';
  }

  return '待准备';
}

function getSourceStatusFromPayrollSummary(summary: PayrollIitTaxMatterSummary) {
  if (summary.sourceStatus === '已确认') {
    return '已确认';
  }

  if (summary.sourceStatus === '待复核') {
    return '待复核';
  }

  return '待准备';
}

function getVerificationSourceStatus(record: FinanceTaxMatterRecord) {
  if (
    record.declarationStatus === '已申报'
    || record.declarationStatus === '已核定'
    || record.declarationStatus === '零申报'
    || record.declarationStatus === '无需申报'
    || record.files.some((file) => ['申报', '核定', '回执', '凭证'].some((keyword) => file.type.includes(keyword)))
  ) {
    return '已确认';
  }

  return '待准备';
}

export function buildSocialInsuranceTaxMatterSourceItems(
  record: FinanceTaxMatterRecord,
  summary: SocialInsuranceTaxMatterSummary
): FinanceTaxMatterSourceItem[] {
  const sourceConfig = socialTaxMatterSourceConfig[summary.category];
  const confirmationSource = record.sourceItems.find((item) => item.name === sourceConfig.confirmationName);
  const verificationSource = record.sourceItems.find((item) => item.name === sourceConfig.verificationName);

  return [
    {
      id: confirmationSource?.id ?? `tax-source-${summary.category}-${summary.period}-confirmation`,
      name: sourceConfig.confirmationName,
      sourceModule: '社保公积金 / 缴费明细',
      status: getSourceStatusFromSocialSummary(summary),
      updatedAt: financeToday
    },
    {
      id: verificationSource?.id ?? `tax-source-${summary.category}-${summary.period}-verification`,
      name: sourceConfig.verificationName,
      sourceModule: sourceConfig.verificationModule,
      status: getVerificationSourceStatus(record),
      updatedAt: record.declarationDate ?? financeToday
    }
  ];
}

export function buildPayrollIitTaxMatterSummary(
  reports: SalaryMonthlyReport[],
  period: string
): PayrollIitTaxMatterSummary {
  const periodReports = reports.filter((report) => report.month === period);
  const confirmedReports = periodReports.filter((report) => report.status === '已确认' || report.status === '已结算');
  const pendingCount = periodReports.length - confirmedReports.length;
  const readyForHandling = periodReports.length > 0 && pendingCount === 0 && confirmedReports.length > 0;
  const reportsForFiling = readyForHandling ? confirmedReports : [];
  const payableAmount = roundMoney(reportsForFiling.reduce((total, report) => total + report.personalIncomeTaxAmount, 0));
  const currentTaxableIncomeAmount = roundMoney(
    reportsForFiling.reduce(
      (total, report) =>
        total + report.personalIncomeTaxRecords.reduce((recordTotal, record) => recordTotal + record.currentTaxableIncomeAmount, 0),
      0
    )
  );
  const sourceStatus: FinanceTaxMatterDataStatus =
    readyForHandling
      ? '已确认'
      : pendingCount > 0
        ? '待复核'
        : '待准备';

  return {
    confirmedCount: confirmedReports.length,
    participantSummary: periodReports.length > 0 ? `${confirmedReports.length}/${periodReports.length} 人` : '待确认',
    payableAmount,
    pendingCount,
    period,
    readyForHandling,
    reportCount: periodReports.length,
    sourceStatus,
    currentTaxableIncomeAmount
  };
}

export function buildPayrollIitTaxMatterEmployeeRows(
  reports: SalaryMonthlyReport[],
  period: string
): PayrollIitTaxMatterEmployeeRow[] {
  return reports
    .filter((report) => report.month === period)
    .map((report) => {
      const includedInFiling = report.status === '已确认' || report.status === '已结算';
      const currentTaxableIncomeAmount = roundMoney(
        report.personalIncomeTaxRecords.reduce((total, record) => total + record.currentTaxableIncomeAmount, 0)
      );
      const currentIncomeAmount = roundMoney(
        report.personalIncomeTaxRecords.reduce((total, record) => total + record.currentIncomeAmount, 0)
      );

      return {
        currentIncomeAmount,
        currentTaxableIncomeAmount,
        employeeName: report.member.name,
        employeeNo: report.member.id,
        grossSalary: report.grossSalary,
        id: report.id,
        includedInFiling,
        personalIncomeTaxAmount: includedInFiling ? report.personalIncomeTaxAmount : 0,
        position: report.member.position,
        salaryStatus: report.status,
        socialInsuranceDeductionAmount: report.socialInsuranceDeductionAmount
      };
    });
}

export function buildPayrollIitTaxMatterSourceItems(
  record: FinanceTaxMatterRecord,
  summary: PayrollIitTaxMatterSummary
): FinanceTaxMatterSourceItem[] {
  const payrollSource = record.sourceItems.find((item) => item.name === '薪酬明细');
  const declarationSource = record.sourceItems.find((item) => item.name === '工资薪金个税表');

  return [
    {
      id: payrollSource?.id ?? `tax-source-iit-${summary.period}-payroll`,
      name: '薪酬明细',
      sourceModule: '薪酬明细',
      status: getSourceStatusFromPayrollSummary(summary),
      updatedAt: financeToday
    },
    {
      id: declarationSource?.id ?? `tax-source-iit-${summary.period}-declaration`,
      name: '工资薪金个税表',
      sourceModule: '自然人电子税务局',
      status: getVerificationSourceStatus(record),
      updatedAt: record.declarationDate ?? financeToday
    }
  ];
}

export function applySocialInsuranceSummaryToTaxMatter(
  record: FinanceTaxMatterRecord,
  records: SocialInsuranceEmployeeRecord[]
): FinanceTaxMatterRecord {
  const category = getSocialInsuranceCategoryByTaxMatterType(record.matterType);

  if (!category || record.processStatus === '已完成') {
    return record;
  }

  const summary = buildSocialInsuranceTaxMatterSummary(records, category, record.period);
  const processStatus = summary.readyForHandling
    ? record.processStatus === '数据待确认'
      ? '可申报'
      : record.processStatus
    : '数据待确认';

  return {
    ...record,
    dataStatus: summary.sourceStatus,
    paidAmount: summary.readyForHandling ? record.paidAmount : 0,
    participantSummary: summary.participantSummary,
    payableAmount: summary.totalAmount,
    paymentStatus: summary.readyForHandling ? record.paymentStatus : '未开始',
    processStatus,
    sourceItems: buildSocialInsuranceTaxMatterSourceItems(record, summary)
  };
}

export function applyPayrollIitSummaryToTaxMatter(
  record: FinanceTaxMatterRecord,
  reports: SalaryMonthlyReport[]
): FinanceTaxMatterRecord {
  if (record.matterType !== '个人所得税') {
    return record;
  }

  if (record.processStatus === '已完成' && record.period !== financeToday.slice(0, 7)) {
    return record;
  }

  const summary = buildPayrollIitTaxMatterSummary(reports, record.period);
  const processStatus = summary.readyForHandling
    ? record.processStatus === '数据待确认'
      ? '可申报'
      : record.processStatus
    : '数据待确认';

  return {
    ...record,
    dataStatus: summary.sourceStatus,
    paidAmount: summary.readyForHandling ? record.paidAmount : 0,
    participantSummary: summary.participantSummary,
    payableAmount: summary.payableAmount,
    paymentStatus: summary.readyForHandling ? record.paymentStatus : '未开始',
    processStatus,
    sourceItems: buildPayrollIitTaxMatterSourceItems(record, summary)
  };
}

export function applySocialInsuranceSummariesToTaxMatters(
  records: FinanceTaxMatterRecord[],
  socialInsuranceRecords: SocialInsuranceEmployeeRecord[]
) {
  return records.map((record) => applySocialInsuranceSummaryToTaxMatter(record, socialInsuranceRecords));
}

export function applyTaxMatterSourceSummaries(
  records: FinanceTaxMatterRecord[],
  socialInsuranceRecords: SocialInsuranceEmployeeRecord[],
  salaryReports: SalaryMonthlyReport[]
) {
  return records.map((record) =>
    applyPayrollIitSummaryToTaxMatter(
      applySocialInsuranceSummaryToTaxMatter(record, socialInsuranceRecords),
      salaryReports
    )
  );
}

function formatPeriodCode(period: string) {
  return period.replace(/[^0-9A-Z]/gi, '');
}

function getNextFinanceTransactionNo(financeRows: FinanceTransactionRecord[], accountingPeriod: string) {
  const periodCode = formatPeriodCode(accountingPeriod);
  const prefix = `FIN-${periodCode}-`;
  const nextSequence =
    financeRows.reduce((maxSequence, row) => {
      if (!row.transactionNo.startsWith(prefix)) {
        return maxSequence;
      }

      const sequence = Number(row.transactionNo.slice(prefix.length));
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1;

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

function getTaxMatterCounterparty(matterType: FinanceTaxMatterType) {
  if (matterType === '社保缴纳') {
    return '社保经办机构';
  }

  if (matterType === '公积金缴纳') {
    return '住房公积金中心';
  }

  return '税务机关';
}

function isTaxMatterPaymentReceiptFile(file: RelatedFileRecord) {
  return file.type === '缴款回单'
    || file.type.includes('缴款')
    || file.name.includes('缴款')
    || file.name.includes('银行回单');
}

function copyTaxMatterPaymentFilesToTransaction(files: RelatedFileRecord[]) {
  return files
    .filter(isTaxMatterPaymentReceiptFile)
    .map((file) => ({
      ...file,
      type: file.type === '缴款回单' ? '缴款回单' : '税费缴款凭证'
    }));
}

export function getTaxMatterLinkedPaymentAmount(record: FinanceTaxMatterRecord, financeRows: FinanceTransactionRecord[]) {
  const linkedNos = new Set(record.linkedTransactionNos);

  return roundMoney(
    financeRows
      .filter((row) => linkedNos.has(row.transactionNo) && row.status !== '已作废')
      .reduce((total, row) => total + row.amount, 0)
  );
}

export function buildTaxMatterPaymentTransaction({
  financePrimaryCategories,
  financeRows,
  financeSecondaryCategories,
  record,
  settlementAccount
}: {
  financePrimaryCategories?: FinancePrimaryCategoryConfig[];
  financeRows: FinanceTransactionRecord[];
  financeSecondaryCategories?: FinanceSecondaryCategoryConfig[];
  record: FinanceTaxMatterRecord;
  settlementAccount: string;
}): FinanceTransactionRecord | undefined {
  if (!['部分缴纳', '已缴纳'].includes(record.paymentStatus) || record.paidAmount <= 0) {
    return undefined;
  }

  const linkedAmount = getTaxMatterLinkedPaymentAmount(record, financeRows);
  const amountToRegister = roundMoney(record.paidAmount - linkedAmount);

  if (amountToRegister <= 0) {
    return undefined;
  }

  const occurredAt = record.declarationDate ?? financeToday;
  const accountingPeriod = occurredAt.slice(0, 7);
  const transactionNo = getNextFinanceTransactionNo(financeRows, accountingPeriod);
  const files = copyTaxMatterPaymentFilesToTransaction(record.files);

  if (files.length === 0) {
    return undefined;
  }

  return {
    accountingPeriod,
    amount: amountToRegister,
    category: '税费缴纳',
    categorySnapshot: getFinanceCategorySnapshot('税费缴纳', financePrimaryCategories, financeSecondaryCategories),
    collectionStatus: '不适用',
    counterparty: getTaxMatterCounterparty(record.matterType),
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '支出',
    files,
    id: `fin-tax-${record.matterNo}-${Date.now()}`,
    note: `${record.title}缴款回填`,
    occurredAt,
    operationRecords: [
      {
        action: '登记流水',
        actor: '李明',
        id: `fin-op-tax-payment-${Date.now()}`,
        object: transactionNo,
        summary: `由 ${record.matterNo} 生成税费缴纳流水`,
        time: `${financeToday} 15:30`
      }
    ],
    paymentMethod: '对公账户付款',
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    settlementAccount,
    settlementAccountType: '对公账户',
    sourceNo: record.matterNo,
    sourceTitle: record.title,
    sourceType: '税费事项',
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 15:30`,
    voucherStatus: files.length > 0 ? '已上传' : '待补充'
  };
}

export function attachTaxMatterPaymentTransaction(
  record: FinanceTaxMatterRecord,
  transaction: FinanceTransactionRecord | undefined
): FinanceTaxMatterRecord {
  if (!transaction) {
    return record;
  }

  return {
    ...record,
    linkedTransactionNos: [...record.linkedTransactionNos, transaction.transactionNo],
    operationRecords: [
      ...record.operationRecords,
      {
        action: '生成缴款流水',
        actor: '李明',
        id: `tax-op-payment-flow-${Date.now()}`,
        object: record.matterNo,
        summary: `生成待复核缴款流水 ${transaction.transactionNo}`,
        time: `${financeToday} 15:35`
      }
    ]
  };
}
