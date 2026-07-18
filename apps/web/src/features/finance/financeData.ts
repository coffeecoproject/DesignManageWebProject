import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  buildPublicAccountRef,
  publicAccountSeeds,
  type PublicAccountRef,
  type PublicAccountSnapshot
} from '../system/PublicAccountConfigState';
import {
  getAccountingSubjectByCode,
  type AccountingSubjectBalanceDirection,
  type AccountingSubjectType
} from './financeAccountingSubjectData';
import type { FinanceVatInvoiceTreatment, FinanceVatTaxableClassification } from './financeTaxPolicyModel';
import { partTimeLaborPaymentSnapshot202606 } from './financeNaturalPersonPaymentSeeds';
import type { NaturalPersonPaymentSnapshot } from './naturalPersonPaymentTypes';

export type FinanceTransactionDirection = '收入' | '支出' | '内部转入';
export type FinanceTransactionCategory = string;
export type FinanceTransactionStatus = '待复核' | '退回修改' | '已入账' | '已作废';
export type FinanceReconciliationStatus = '未对账' | '已对账' | '对账异常';
export type FinanceVoucherStatus = '已上传' | '待补充';
export type FinanceInvoiceDeclarationStatus =
  | '不适用'
  | '待关联发票'
  | '部分关联发票'
  | '已关联发票'
  | '未开票待确认'
  | '未开票已申报'
  | '后续开票部分关联'
  | '后续开票已关联';
export type FinanceSourceType =
  | '合同应收'
  | '任务结算'
  | '薪酬发放'
  | '外协结算'
  | '报销单'
  | '税费事项'
  | '员工代收流水'
  | '现金暂收流水'
  | '流水冲正'
  | '流水补差'
  | '手工登记';
export type FinanceTransactionAdjustmentContext = {
  bankSerialNo?: string;
  mode: '冲正' | '补差';
  originTransactionNo: string;
  reason: string;
};
export type FinanceTransactionVatDeclarationFact = {
  taxRate?: string;
  taxableClassification: FinanceVatTaxableClassification;
  vatTreatment?: FinanceVatInvoiceTreatment;
};
export type FinanceTaxPaymentAllocation = {
  amount: number;
  subjectCode: string;
  taxType: '增值税' | '城市维护建设税' | '教育费附加' | '地方教育附加' | '其他税费';
};
export type FinancePaymentMethod = '对公账户收款' | '对公账户付款' | '员工代收' | '现金暂收';
export type FinanceCategoryStatus = '启用' | '停用';
export type FinanceReportAggregation = '经营收入' | '项目成本' | '人员支出' | '运营费用' | '其他';
export type FinanceCounterpartyScope = '客户' | '员工' | '合作人员' | '供应商' | '内部';
export type FinancePrimaryCategoryConfig = {
  code: string;
  direction: FinanceTransactionDirection;
  id: string;
  includeInReport: boolean;
  name: string;
  note: string;
  reportAggregation: FinanceReportAggregation;
  sortOrder: number;
  status: FinanceCategoryStatus;
  updatedAt: string;
};
export type FinanceAccountingSubjectSnapshot = {
  balanceDirection: AccountingSubjectBalanceDirection;
  code: string;
  name: string;
  type: AccountingSubjectType;
};
export type FinanceAccountingSubjectRole =
  | 'accrualReceivable'
  | 'accrualRevenue'
  | 'accrualExpense'
  | 'accrualPayable'
  | 'cashDebit'
  | 'cashCredit'
  | 'outputVatPayable';
export type FinanceAccountingSubjectRoleMappings = Partial<Record<FinanceAccountingSubjectRole, string>>;
export type FinanceSecondaryCategoryConfig = {
  defaultAccountingSubjectCode: string;
  code: string;
  counterpartyScope: FinanceCounterpartyScope;
  defaultSourceType: FinanceSourceType;
  direction: FinanceTransactionDirection;
  id: string;
  includeInReport: boolean;
  name: FinanceTransactionCategory;
  note: string;
  paymentMethods: FinancePaymentMethod[];
  primaryId: string;
  reportAggregation: FinanceReportAggregation;
  sortOrder: number;
  status: FinanceCategoryStatus;
  updatedAt: string;
  voucherRequirement: string;
};
export type FinanceCategorySnapshot = {
  accountingSubject: FinanceAccountingSubjectSnapshot;
  accountingSubjectMappings: FinanceAccountingSubjectRoleMappings;
  includeInReport: boolean;
  mappingIssue?: string;
  mappingStatus: '已配置' | '待配置';
  primaryCode: string;
  primaryName: string;
  reportAggregation: FinanceReportAggregation;
  secondaryCode: string;
  secondaryName: FinanceTransactionCategory;
};
export type FinanceTransactionRecord = {
  id: string;
  transactionNo: string;
  occurredAt: string;
  accountingPeriod: string;
  direction: FinanceTransactionDirection;
  category: FinanceTransactionCategory;
  categorySnapshot: FinanceCategorySnapshot;
  counterparty: string;
  counterpartyId?: string;
  counterpartyType: '客户' | '员工' | '外协' | '供应商' | '内部';
  amount: number;
  currency: 'CNY';
  paymentMethod: FinancePaymentMethod;
  publicAccountId: string;
  publicAccountSnapshot: PublicAccountSnapshot;
  handler?: string;
  sourceType: FinanceSourceType;
  sourceNo: string;
  sourceTitle: string;
  taxPaymentAllocations?: FinanceTaxPaymentAllocation[];
  relatedReceivableNo?: string;
  voucherStatus: FinanceVoucherStatus;
  reconciliationStatus: FinanceReconciliationStatus;
  status: FinanceTransactionStatus;
  registeredBy: string;
  reviewDueAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reconciledAt?: string;
  note: string;
  naturalPersonPayment?: NaturalPersonPaymentSnapshot;
  updatedAt: string;
  files: RelatedFileRecord[];
  invoiceDeclarationPeriod?: string;
  invoiceDeclarationPreparationNo?: string;
  invoiceDeclarationStatus?: FinanceInvoiceDeclarationStatus;
  vatDeclarationFact?: FinanceTransactionVatDeclarationFact;
  operationRecords: OperationRecord[];
  adjustmentContext?: FinanceTransactionAdjustmentContext;
};

export const financeCategoryConfigToday = '2026-06-16';

export const financePrimaryCategorySeeds: FinancePrimaryCategoryConfig[] = [
  {
    code: 'FC1-REV-CUSTOMER',
    direction: '收入',
    id: 'finance-primary-customer-income',
    includeInReport: true,
    name: '客户收入',
    note: '客户合同、设计服务和项目回款类收入。',
    reportAggregation: '经营收入',
    sortOrder: 10,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  },
  {
    code: 'FC1-REV-OTHER',
    direction: '收入',
    id: 'finance-primary-other-income',
    includeInReport: true,
    name: '其他收入',
    note: '不归入客户项目收入的其他业务收入。',
    reportAggregation: '其他',
    sortOrder: 20,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  },
  {
    code: 'FC1-EXP-PEOPLE',
    direction: '支出',
    id: 'finance-primary-people-expense',
    includeInReport: true,
    name: '人员支出',
    note: '工资、绩效等员工相关支出。',
    reportAggregation: '人员支出',
    sortOrder: 30,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  },
  {
    code: 'FC1-EXP-PROJECT',
    direction: '支出',
    id: 'finance-primary-project-cost',
    includeInReport: true,
    name: '项目成本',
    note: '外协、材料等项目交付成本。',
    reportAggregation: '项目成本',
    sortOrder: 40,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  },
  {
    code: 'FC1-EXP-OPERATING',
    direction: '支出',
    id: 'finance-primary-operating-expense',
    includeInReport: true,
    name: '运营费用',
    note: '办公、差旅、平台服务等日常运营支出。',
    reportAggregation: '运营费用',
    sortOrder: 50,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  },
  {
    code: 'FC1-EXP-OTHER',
    direction: '支出',
    id: 'finance-primary-other-expense',
    includeInReport: true,
    name: '其他支出',
    note: '无法归入项目、人员或运营类目的其他支出。',
    reportAggregation: '其他',
    sortOrder: 80,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  },
  {
    code: 'FC1-EXP-TAX',
    direction: '支出',
    id: 'finance-primary-tax-payment',
    includeInReport: false,
    name: '税费处理',
    note: '税费、社保、公积金等事项形成的缴纳流水，用于现金流追踪，不计入经营统计。',
    reportAggregation: '其他',
    sortOrder: 90,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  }
];

export const financeSecondaryCategorySeeds: FinanceSecondaryCategoryConfig[] = [
  {
    code: 'FC2-REV-DESIGN-SERVICE',
    counterpartyScope: '客户',
    defaultSourceType: '任务结算',
    direction: '收入',
    id: 'finance-secondary-design-service-income',
    includeInReport: true,
    name: '设计服务收入',
    note: '施工图、平面方案、门店图等任务验收后确认的设计服务收入。',
    defaultAccountingSubjectCode: '5001',
    paymentMethods: ['对公账户收款', '员工代收'],
    primaryId: 'finance-primary-customer-income',
    reportAggregation: '经营收入',
    sortOrder: 5,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '任务验收记录及价格依据合同'
  },
  {
    code: 'FC2-REV-CUSTOMER-PAYMENT',
    counterpartyScope: '客户',
    defaultSourceType: '合同应收',
    direction: '收入',
    id: 'finance-secondary-customer-payment',
    includeInReport: true,
    name: '客户回款',
    note: '客户通过对公账户或员工代收方式支付的项目款。',
    defaultAccountingSubjectCode: '1122',
    paymentMethods: ['对公账户收款', '员工代收'],
    primaryId: 'finance-primary-customer-income',
    reportAggregation: '经营收入',
    sortOrder: 10,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '银行回单、转账截图或客户付款凭证'
  },
  {
    code: 'FC2-REV-CUSTOMER-CASH',
    counterpartyScope: '客户',
    defaultSourceType: '现金暂收流水',
    direction: '收入',
    id: 'finance-secondary-customer-cash',
    includeInReport: true,
    name: '客户现金收款',
    note: '客户以现金交付给员工，经办后需存入对公账户。',
    defaultAccountingSubjectCode: '1122',
    paymentMethods: ['现金暂收'],
    primaryId: 'finance-primary-customer-income',
    reportAggregation: '经营收入',
    sortOrder: 20,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '现金收款凭证、收据或存现说明'
  },
  {
    code: 'FC2-REV-OTHER',
    counterpartyScope: '内部',
    defaultSourceType: '手工登记',
    direction: '收入',
    id: 'finance-secondary-other-income',
    includeInReport: true,
    name: '其他收入',
    note: '非客户项目类收入，需在备注中说明来源。',
    defaultAccountingSubjectCode: '5051',
    paymentMethods: ['对公账户收款'],
    primaryId: 'finance-primary-other-income',
    reportAggregation: '其他',
    sortOrder: 30,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '收入来源凭证'
  },
  {
    code: 'FC2-REV-TAX-REFUND',
    counterpartyScope: '内部',
    defaultSourceType: '税费事项',
    direction: '收入',
    id: 'finance-secondary-tax-refund',
    includeInReport: false,
    name: '税费退还',
    note: '税务机关退回的税款，只进入资金与对账链路，不计入经营收入。',
    defaultAccountingSubjectCode: '2221.99',
    paymentMethods: ['对公账户收款'],
    primaryId: 'finance-primary-other-income',
    reportAggregation: '其他',
    sortOrder: 35,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '退税回单'
  },
  {
    code: 'FC2-EXP-SALARY',
    counterpartyScope: '员工',
    defaultSourceType: '薪酬发放',
    direction: '支出',
    id: 'finance-secondary-salary',
    includeInReport: true,
    name: '工资发放',
    note: '员工固定工资发放。',
    defaultAccountingSubjectCode: '2211.01',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-people-expense',
    reportAggregation: '人员支出',
    sortOrder: 40,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '工资表、付款回单'
  },
  {
    code: 'FC2-EXP-OUTSOURCE',
    counterpartyScope: '合作人员',
    defaultSourceType: '外协结算',
    direction: '支出',
    id: 'finance-secondary-outsource',
    includeInReport: true,
    name: '外协付款',
    note: '兼职、外协或合作人员结算支出。',
    defaultAccountingSubjectCode: '2202',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-project-cost',
    reportAggregation: '项目成本',
    sortOrder: 60,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '结算单、付款凭证'
  },
  {
    code: 'FC2-EXP-MATERIAL',
    counterpartyScope: '供应商',
    defaultSourceType: '报销单',
    direction: '支出',
    id: 'finance-secondary-material',
    includeInReport: true,
    name: '材料采购',
    note: '项目材料、物料或样品采购支出。',
    defaultAccountingSubjectCode: '2202',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-project-cost',
    reportAggregation: '项目成本',
    sortOrder: 70,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '采购凭证、发票或报销凭证'
  },
  {
    code: 'FC2-EXP-OFFICE',
    counterpartyScope: '供应商',
    defaultSourceType: '报销单',
    direction: '支出',
    id: 'finance-secondary-office',
    includeInReport: true,
    name: '办公费用',
    note: '日常办公消耗、系统服务等运营费用。',
    defaultAccountingSubjectCode: '5602.03',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-operating-expense',
    reportAggregation: '运营费用',
    sortOrder: 80,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '发票、付款截图或报销凭证'
  },
  {
    code: 'FC2-EXP-TRAVEL',
    counterpartyScope: '供应商',
    defaultSourceType: '报销单',
    direction: '支出',
    id: 'finance-secondary-travel',
    includeInReport: true,
    name: '差旅交通',
    note: '交通、差旅和现场执行产生的费用。',
    defaultAccountingSubjectCode: '5602.04',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-operating-expense',
    reportAggregation: '运营费用',
    sortOrder: 90,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '车票、行程单、发票或报销凭证'
  },
  {
    code: 'FC2-EXP-CUSTOMER-REFUND',
    counterpartyScope: '客户',
    defaultSourceType: '手工登记',
    direction: '支出',
    id: 'finance-secondary-customer-refund',
    includeInReport: true,
    name: '客户退款',
    note: '向客户退回已收款项。',
    defaultAccountingSubjectCode: '1122',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-other-expense',
    reportAggregation: '其他',
    sortOrder: 110,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '退款审批、付款回单'
  },
  {
    code: 'FC2-EXP-OTHER',
    counterpartyScope: '内部',
    defaultSourceType: '手工登记',
    direction: '支出',
    id: 'finance-secondary-other-expense',
    includeInReport: true,
    name: '其他支出',
    note: '无法归入既有类目的支出。',
    defaultAccountingSubjectCode: '5602',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-other-expense',
    reportAggregation: '其他',
    sortOrder: 140,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '支出说明和付款凭证'
  },
  {
    code: 'FC2-EXP-TAX-PAYMENT',
    counterpartyScope: '内部',
    defaultSourceType: '税费事项',
    direction: '支出',
    id: 'finance-secondary-tax-payment',
    includeInReport: false,
    name: '税费缴纳',
    note: '个税、增值税、社保、公积金等事项确认后的对公缴纳流水。',
    defaultAccountingSubjectCode: '2221',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-tax-payment',
    reportAggregation: '其他',
    sortOrder: 150,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '缴款回单或银行回单'
  }
];

const unconfiguredAccountingSubjectSnapshot: FinanceAccountingSubjectSnapshot = {
  balanceDirection: '借方',
  code: '',
  name: '未配置科目',
  type: '损益类'
};

export const financeAccountingSubjectRoleLabels: Record<FinanceAccountingSubjectRole, string> = {
  accrualExpense: '费用/成本确认借方',
  accrualPayable: '应付确认贷方',
  accrualReceivable: '应收确认借方',
  accrualRevenue: '收入确认贷方',
  cashCredit: '收付款贷方',
  cashDebit: '收付款借方',
  outputVatPayable: '销项税额贷方'
};

export const financeCategoryAccountingSubjectMappings: Record<string, FinanceAccountingSubjectRoleMappings> = {
  差旅交通: {
    accrualExpense: '5602.04',
    accrualPayable: '2241',
    cashCredit: '1002',
    cashDebit: '2241'
  },
  办公费用: {
    accrualExpense: '5602.03',
    accrualPayable: '2241',
    cashCredit: '1002',
    cashDebit: '2241'
  },
  客户回款: {
    accrualReceivable: '1122',
    accrualRevenue: '5001',
    cashCredit: '1122',
    cashDebit: '1002',
    outputVatPayable: '2221.01'
  },
  设计服务收入: {
    accrualReceivable: '1122',
    accrualRevenue: '5001',
    cashCredit: '1122',
    cashDebit: '1002',
    outputVatPayable: '2221.01'
  },
  客户退款: {
    cashCredit: '1002',
    cashDebit: '1122'
  },
  客户现金收款: {
    accrualReceivable: '1122',
    accrualRevenue: '5001',
    cashCredit: '1122',
    cashDebit: '1002',
    outputVatPayable: '2221.01'
  },
  其他收入: {
    accrualReceivable: '1122',
    accrualRevenue: '5051',
    cashCredit: '5051',
    cashDebit: '1002',
    outputVatPayable: '2221.01'
  },
  税费退还: {
    cashCredit: '2221.99',
    cashDebit: '1002'
  },
  其他支出: {
    accrualExpense: '5602',
    accrualPayable: '2241',
    cashCredit: '1002',
    cashDebit: '2241'
  },
  税费缴纳: {
    cashCredit: '1002',
    cashDebit: '2221.99'
  },
  外协付款: {
    accrualExpense: '5401',
    accrualPayable: '2202',
    cashCredit: '1002',
    cashDebit: '2202'
  },
  工资发放: {
    accrualExpense: '5602.01',
    accrualPayable: '2211.01',
    cashCredit: '1002',
    cashDebit: '2211.01'
  },
  材料采购: {
    accrualExpense: '5401',
    accrualPayable: '2202',
    cashCredit: '1002',
    cashDebit: '2202'
  }
};

export function getFinancePrimaryCategory(
  primaryRows: FinancePrimaryCategoryConfig[],
  primaryId: string
) {
  return primaryRows.find((row) => row.id === primaryId);
}

export function getFinanceSecondaryCategory(
  secondaryRows: FinanceSecondaryCategoryConfig[],
  category: FinanceTransactionCategory
) {
  return secondaryRows.find((row) => row.name === category);
}

function buildFinanceAccountingSubjectSnapshot(code?: string): FinanceAccountingSubjectSnapshot {
  const accountingSubject = code ? getAccountingSubjectByCode(code) : undefined;

  if (!accountingSubject) {
    return unconfiguredAccountingSubjectSnapshot;
  }

  return {
    balanceDirection: accountingSubject.balanceDirection,
    code: accountingSubject.code,
    name: accountingSubject.name,
    type: accountingSubject.type
  };
}

export function getFinanceCategoryAccountingSubjectCode(
  category: FinanceTransactionCategory,
  role: FinanceAccountingSubjectRole
) {
  return financeCategoryAccountingSubjectMappings[category]?.[role];
}

export function getFinanceCategoryAccountingSubjectSnapshot(
  category: FinanceTransactionCategory,
  role: FinanceAccountingSubjectRole
) {
  return buildFinanceAccountingSubjectSnapshot(getFinanceCategoryAccountingSubjectCode(category, role));
}

export function getFinanceCategoryMissingAccountingRoles(
  category: FinanceTransactionCategory,
  roles: FinanceAccountingSubjectRole[]
) {
  return roles.filter((role) => {
    const subjectCode = getFinanceCategoryAccountingSubjectCode(category, role);

    return !subjectCode || !getAccountingSubjectByCode(subjectCode);
  });
}

export function getFinanceCategorySnapshot(
  category: FinanceTransactionCategory,
  primaryRows: FinancePrimaryCategoryConfig[] = financePrimaryCategorySeeds,
  secondaryRows: FinanceSecondaryCategoryConfig[] = financeSecondaryCategorySeeds
): FinanceCategorySnapshot {
  const secondary = getFinanceSecondaryCategory(secondaryRows, category);
  const primary = secondary ? getFinancePrimaryCategory(primaryRows, secondary.primaryId) : undefined;
  const accountingSubject = buildFinanceAccountingSubjectSnapshot(secondary?.defaultAccountingSubjectCode);
  const accountingSubjectMappings = financeCategoryAccountingSubjectMappings[category] ?? {};
  const mappingStatus = secondary && accountingSubject.code ? '已配置' : '待配置';

  return {
    accountingSubject,
    accountingSubjectMappings,
    includeInReport: secondary?.includeInReport ?? primary?.includeInReport ?? true,
    mappingIssue: mappingStatus === '已配置' ? undefined : '财务类目缺少有效会计科目映射',
    mappingStatus,
    primaryCode: primary?.code ?? 'FC1-UNMAPPED',
    primaryName: primary?.name ?? '未归类',
    reportAggregation: secondary?.reportAggregation ?? primary?.reportAggregation ?? '其他',
    secondaryCode: secondary?.code ?? 'FC2-UNMAPPED',
    secondaryName: secondary?.name ?? category
  };
}

type FinanceTransactionRecordSeed = Omit<FinanceTransactionRecord, 'categorySnapshot'> & {
  categorySnapshot?: FinanceCategorySnapshot;
};

export function getFinanceSeedPublicAccountRef(publicAccountId = 'public-account-cmb-basic'): PublicAccountRef {
  const account = publicAccountSeeds.find((row) => row.id === publicAccountId) ?? publicAccountSeeds[0];

  return buildPublicAccountRef(account);
}

const cmbPublicAccountRef = getFinanceSeedPublicAccountRef('public-account-cmb-basic');
const icbcPaymentPublicAccountRef = getFinanceSeedPublicAccountRef('public-account-icbc-payment-reserve');
const ccbPaymentPublicAccountRef = getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve');

export const financeTransactionRecords: FinanceTransactionRecord[] = ([
  {
    id: 'fin-flow-001',
    transactionNo: 'FIN-202606-0001',
    occurredAt: '2026-06-03',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '奈雪华南区域',
    counterpartyType: '客户',
    amount: 68000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-001',
    sourceTitle: '奈雪华南门店设计服务合同',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-03 16:20',
    reconciledAt: '2026-06-04',
    note: '合同阶段回款',
    updatedAt: '2026-06-04 09:12',
    files: [
      {
        id: 'fin-file-001',
        name: '奈雪华南_回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-03'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-001',
        time: '2026-06-03 15:42',
        actor: '李明',
        object: 'FIN-202606-0001',
        action: '登记流水',
        summary: '登记客户回款 68,000 元'
      },
      {
        id: 'fin-op-002',
        time: '2026-06-03 16:20',
        actor: '财务复核',
        object: 'FIN-202606-0001',
        action: '复核入账',
        summary: '核对银行回单后入账'
      },
      {
        id: 'fin-op-003',
        time: '2026-06-04 09:12',
        actor: '财务复核',
        object: 'FIN-202606-0001',
        action: '银行对账',
        summary: '与银行流水完成勾稽'
      }
    ]
  },
  {
    id: 'fin-flow-019',
    transactionNo: 'FIN-202606-0019',
    occurredAt: '2026-06-15',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '工资发放',
    counterparty: '示例全职 B',
    counterpartyType: '员工',
    amount: 11059.83,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    ...icbcPaymentPublicAccountRef,
    sourceType: '薪酬发放',
    sourceNo: 'PAY-202605-20250018',
    sourceTitle: '示例全职 B 2026-05 工资发放',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-15 10:25',
    note: '五月工资实际发放',
    updatedAt: '2026-06-15 10:30',
    files: [
      {
        id: 'fin-file-019',
        name: '示例全职B_2026-05工资付款回单.pdf',
        status: '已上传',
        type: '付款回单',
        updatedAt: '2026-06-15'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-019-register',
        time: '2026-06-15 10:10',
        actor: '李明',
        object: 'FIN-202606-0019',
        action: '登记流水',
        summary: '登记五月工资发放 11,059.83 元'
      },
      {
        id: 'fin-op-019-review',
        time: '2026-06-15 10:25',
        actor: '财务复核',
        object: 'FIN-202606-0019',
        action: '复核入账',
        summary: '核对工资单和付款回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-004',
    transactionNo: 'FIN-202606-0004',
    occurredAt: '2026-06-12',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '外协付款',
    counterparty: '示例兼职 B',
    counterpartyId: '20260006',
    counterpartyType: '外协',
    amount: 2720,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    ...cmbPublicAccountRef,
    sourceType: '外协结算',
    sourceNo: 'OUT-202606-0008',
    sourceTitle: '空间设计外协任务结算',
    naturalPersonPayment: partTimeLaborPaymentSnapshot202606,
    voucherStatus: '待补充',
    reconciliationStatus: '未对账',
    status: '待复核',
    registeredBy: '李明',
    reviewDueAt: '2026-06-13',
    note: '协议税前金额 3,200 元，代扣个税 480 元，待补充 2,720 元付款回单。',
    updatedAt: '2026-06-12 17:25',
    files: [],
    operationRecords: [
      {
        id: 'fin-op-007',
        time: '2026-06-12 17:25',
        actor: '李明',
        object: 'FIN-202606-0004',
        action: '登记流水',
        summary: '登记劳务税后付款 2,720 元'
      }
    ]
  },
  {
    id: 'fin-flow-005',
    transactionNo: 'FIN-202606-0005',
    occurredAt: '2026-06-14',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '星河餐饮集团',
    counterpartyType: '客户',
    amount: 9800,
    currency: 'CNY',
    paymentMethod: '员工代收',
    ...cmbPublicAccountRef,
    handler: '李明',
    sourceType: '员工代收流水',
    sourceNo: 'EC-202606-002',
    sourceTitle: '星河餐饮门店设计首款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '待复核',
    registeredBy: '李明',
    reviewDueAt: '2026-06-15',
    note: '员工已将客户代收款转入公司对公账户，待流水复核',
    updatedAt: '2026-06-14 15:30',
    files: [
      {
        id: 'fin-file-006',
        name: '星河餐饮_员工代收到账截图.png',
        status: '已上传',
        type: '员工代收凭证',
        updatedAt: '2026-06-14'
      },
      {
        id: 'fin-file-006-transfer',
        name: '星河餐饮_转入对公账户截图.png',
        status: '已上传',
        type: '转入凭证',
        updatedAt: '2026-06-14'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-010',
        time: '2026-06-14 12:10',
        actor: '李明',
        object: 'FIN-202606-0005',
        action: '登记流水',
        summary: '登记客户回款 9,800 元，收付方式为员工代收'
      }
    ]
  },
  {
    id: 'fin-flow-008',
    transactionNo: 'FIN-202606-0008',
    occurredAt: '2026-06-18',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '美刻咖啡',
    counterpartyType: '客户',
    amount: 3000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-012',
    sourceTitle: '美刻咖啡门店设计阶段款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-18 15:30',
    note: '客户分次回款首笔',
    updatedAt: '2026-06-18 15:40',
    files: [
      {
        id: 'fin-file-008',
        name: '美刻咖啡_首笔回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-18'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-013',
        time: '2026-06-18 15:20',
        actor: '李明',
        object: 'FIN-202606-0008',
        action: '登记流水',
        summary: '登记客户回款 3,000 元'
      },
      {
        id: 'fin-op-014',
        time: '2026-06-18 15:30',
        actor: '财务复核',
        object: 'FIN-202606-0008',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-009',
    transactionNo: 'FIN-202606-0009',
    occurredAt: '2026-06-19',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '美刻咖啡',
    counterpartyType: '客户',
    amount: 2000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-012',
    sourceTitle: '美刻咖啡门店设计阶段款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-19 10:20',
    note: '客户分次回款第二笔',
    updatedAt: '2026-06-19 10:30',
    files: [
      {
        id: 'fin-file-009',
        name: '美刻咖啡_第二笔回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-19'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-015',
        time: '2026-06-19 10:10',
        actor: '李明',
        object: 'FIN-202606-0009',
        action: '登记流水',
        summary: '登记客户回款 2,000 元'
      },
      {
        id: 'fin-op-016',
        time: '2026-06-19 10:20',
        actor: '财务复核',
        object: 'FIN-202606-0009',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-010',
    transactionNo: 'FIN-202606-0010',
    occurredAt: '2026-06-21',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '合众餐饮集团',
    counterpartyType: '客户',
    amount: 11800,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-015',
    sourceTitle: '合众餐饮多门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-21 16:20',
    note: '一笔回款对应两张销项发票',
    updatedAt: '2026-06-21 16:25',
    files: [
      {
        id: 'fin-file-010',
        name: '合众餐饮_整笔回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-21'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-017',
        time: '2026-06-21 16:05',
        actor: '李明',
        object: 'FIN-202606-0010',
        action: '登记流水',
        summary: '登记客户回款 11,800 元'
      },
      {
        id: 'fin-op-018',
        time: '2026-06-21 16:20',
        actor: '财务复核',
        object: 'FIN-202606-0010',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-011',
    transactionNo: 'FIN-202606-0011',
    occurredAt: '2026-06-22',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '湖畔烘焙',
    counterpartyType: '客户',
    amount: 3000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-018',
    sourceTitle: '湖畔烘焙门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-22 16:10',
    note: '客户分次回款首笔',
    updatedAt: '2026-06-22 16:20',
    files: [
      {
        id: 'fin-file-011',
        name: '湖畔烘焙_首笔回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-22'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-019',
        time: '2026-06-22 15:58',
        actor: '李明',
        object: 'FIN-202606-0011',
        action: '登记流水',
        summary: '登记客户回款 3,000 元'
      },
      {
        id: 'fin-op-020',
        time: '2026-06-22 16:10',
        actor: '财务复核',
        object: 'FIN-202606-0011',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-012',
    transactionNo: 'FIN-202606-0012',
    occurredAt: '2026-06-23',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '湖畔烘焙',
    counterpartyType: '客户',
    amount: 2000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-018',
    sourceTitle: '湖畔烘焙门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-23 10:30',
    note: '客户分次回款第二笔',
    updatedAt: '2026-06-23 10:40',
    files: [
      {
        id: 'fin-file-012',
        name: '湖畔烘焙_第二笔回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-23'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-021',
        time: '2026-06-23 10:18',
        actor: '李明',
        object: 'FIN-202606-0012',
        action: '登记流水',
        summary: '登记客户回款 2,000 元'
      },
      {
        id: 'fin-op-022',
        time: '2026-06-23 10:30',
        actor: '财务复核',
        object: 'FIN-202606-0012',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-013',
    transactionNo: 'FIN-202606-0013',
    occurredAt: '2026-06-24',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '湖畔烘焙',
    counterpartyType: '客户',
    amount: 8000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-018',
    sourceTitle: '湖畔烘焙门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-24 14:45',
    note: '客户合并支付尾款，部分金额可对应后续发票',
    updatedAt: '2026-06-24 15:00',
    files: [
      {
        id: 'fin-file-013',
        name: '湖畔烘焙_尾款回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-24'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-023',
        time: '2026-06-24 14:32',
        actor: '李明',
        object: 'FIN-202606-0013',
        action: '登记流水',
        summary: '登记客户回款 8,000 元'
      },
      {
        id: 'fin-op-024',
        time: '2026-06-24 14:45',
        actor: '财务复核',
        object: 'FIN-202606-0013',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-014',
    transactionNo: 'FIN-202606-0014',
    occurredAt: '2026-06-25',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '麦田轻食',
    counterpartyType: '客户',
    amount: 5600,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-019',
    sourceTitle: '麦田轻食门店设计尾款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-25 11:20',
    invoiceDeclarationStatus: '未开票待确认',
    note: '已收款，发票待开具，需在申报准备中判断是否计入未开票收入',
    updatedAt: '2026-06-25 11:30',
    files: [
      {
        id: 'fin-file-014',
        name: '麦田轻食_尾款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-25'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-025',
        time: '2026-06-25 11:05',
        actor: '李明',
        object: 'FIN-202606-0014',
        action: '登记流水',
        summary: '登记客户回款 5,600 元'
      },
      {
        id: 'fin-op-026',
        time: '2026-06-25 11:20',
        actor: '财务复核',
        object: 'FIN-202606-0014',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-019',
    transactionNo: 'FIN-202606-0015',
    occurredAt: '2026-06-20',
    accountingPeriod: '2026-06',
    direction: '收入',
    category: '客户回款',
    counterparty: '青禾咖啡',
    counterpartyType: '客户',
    amount: 24000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-020',
    sourceTitle: '青禾咖啡门店设计尾款',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-20 15:10',
    reconciledAt: '2026-06-21',
    note: '合同尾款已到账并完成银行对账。',
    updatedAt: '2026-06-21 09:30',
    files: [
      {
        id: 'fin-file-019',
        name: '青禾咖啡_尾款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-06-20'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-035',
        time: '2026-06-20 14:50',
        actor: '李明',
        object: 'FIN-202606-0015',
        action: '登记流水',
        summary: '登记客户回款 24,000 元'
      },
      {
        id: 'fin-op-036',
        time: '2026-06-20 15:10',
        actor: '财务复核',
        object: 'FIN-202606-0015',
        action: '复核入账',
        summary: '核对银行回单后入账'
      },
      {
        id: 'fin-op-037',
        time: '2026-06-21 09:30',
        actor: '财务复核',
        object: 'FIN-202606-0015',
        action: '银行对账',
        summary: '与银行流水完成勾稽'
      }
    ]
  },
  {
    id: 'fin-flow-020',
    transactionNo: 'FIN-202606-0016',
    occurredAt: '2026-06-21',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '材料采购',
    counterparty: '武汉源木物料',
    counterpartyType: '供应商',
    amount: 5200,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    ...ccbPaymentPublicAccountRef,
    sourceType: '报销单',
    sourceNo: 'MAT-202606-004',
    sourceTitle: '门店打样材料采购',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-21 16:20',
    reconciledAt: '2026-06-22',
    note: '项目材料采购付款，已取得采购凭证。',
    updatedAt: '2026-06-22 09:15',
    files: [
      {
        id: 'fin-file-020',
        name: '门店打样材料_付款回单.pdf',
        status: '已上传',
        type: '付款回单',
        updatedAt: '2026-06-21'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-038',
        time: '2026-06-21 15:55',
        actor: '李明',
        object: 'FIN-202606-0016',
        action: '登记流水',
        summary: '登记材料采购付款 5,200 元'
      },
      {
        id: 'fin-op-039',
        time: '2026-06-21 16:20',
        actor: '财务复核',
        object: 'FIN-202606-0016',
        action: '复核入账',
        summary: '核对付款回单和采购凭证后入账'
      },
      {
        id: 'fin-op-040',
        time: '2026-06-22 09:15',
        actor: '财务复核',
        object: 'FIN-202606-0016',
        action: '银行对账',
        summary: '与银行流水完成勾稽'
      }
    ]
  },
  {
    id: 'fin-flow-021',
    transactionNo: 'FIN-202606-0017',
    occurredAt: '2026-06-22',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '办公费用',
    counterparty: '云协同科技',
    counterpartyType: '供应商',
    amount: 1480,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    ...ccbPaymentPublicAccountRef,
    sourceType: '报销单',
    sourceNo: 'EXP-202606-009',
    sourceTitle: '协同工具年度服务费',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-22 17:10',
    reconciledAt: '2026-06-23',
    note: '办公软件服务费，已上传电子发票和付款回单。',
    updatedAt: '2026-06-23 09:40',
    files: [
      {
        id: 'fin-file-021',
        name: '云协同科技_服务费付款回单.pdf',
        status: '已上传',
        type: '付款回单',
        updatedAt: '2026-06-22'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-041',
        time: '2026-06-22 16:45',
        actor: '李明',
        object: 'FIN-202606-0017',
        action: '登记流水',
        summary: '登记办公费用付款 1,480 元'
      },
      {
        id: 'fin-op-042',
        time: '2026-06-22 17:10',
        actor: '财务复核',
        object: 'FIN-202606-0017',
        action: '复核入账',
        summary: '核对电子发票和付款回单后入账'
      },
      {
        id: 'fin-op-043',
        time: '2026-06-23 09:40',
        actor: '财务复核',
        object: 'FIN-202606-0017',
        action: '银行对账',
        summary: '与银行流水完成勾稽'
      }
    ]
  },
  {
    id: 'fin-flow-022',
    transactionNo: 'FIN-202606-0018',
    occurredAt: '2026-06-23',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '差旅交通',
    counterparty: '刘宇',
    counterpartyType: '员工',
    amount: 960,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    ...icbcPaymentPublicAccountRef,
    sourceType: '报销单',
    sourceNo: 'EXP-202606-010',
    sourceTitle: '长沙项目现场交通报销',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-23 15:35',
    reconciledAt: '2026-06-24',
    note: '员工项目现场交通报销，已完成付款和对账。',
    updatedAt: '2026-06-24 09:25',
    files: [
      {
        id: 'fin-file-022',
        name: '刘宇_长沙项目交通报销付款回单.pdf',
        status: '已上传',
        type: '付款回单',
        updatedAt: '2026-06-23'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-044',
        time: '2026-06-23 15:10',
        actor: '李明',
        object: 'FIN-202606-0018',
        action: '登记流水',
        summary: '登记差旅交通付款 960 元'
      },
      {
        id: 'fin-op-045',
        time: '2026-06-23 15:35',
        actor: '财务复核',
        object: 'FIN-202606-0018',
        action: '复核入账',
        summary: '核对报销单和付款回单后入账'
      },
      {
        id: 'fin-op-046',
        time: '2026-06-24 09:25',
        actor: '财务复核',
        object: 'FIN-202606-0018',
        action: '银行对账',
        summary: '与银行流水完成勾稽'
      }
    ]
  },
  {
    id: 'fin-flow-015',
    transactionNo: 'FIN-202605-0017',
    occurredAt: '2026-05-20',
    accountingPeriod: '2026-05',
    direction: '收入',
    category: '客户回款',
    counterparty: '示例客户 A',
    counterpartyType: '客户',
    amount: 12000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-005',
    sourceTitle: '示例客户 A 项目阶段款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-05-20 16:00',
    note: '5 月销项发票对应部分回款，银行对账待处理',
    updatedAt: '2026-05-20 16:00',
    files: [
      {
        id: 'fin-file-015',
        name: '示例客户A_阶段款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-05-20'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-027',
        time: '2026-05-20 15:30',
        actor: '李明',
        object: 'FIN-202605-0017',
        action: '登记流水',
        summary: '登记客户回款 12,000 元'
      },
      {
        id: 'fin-op-028',
        time: '2026-05-20 16:00',
        actor: '财务复核',
        object: 'FIN-202605-0017',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-016',
    transactionNo: 'FIN-202604-0005',
    occurredAt: '2026-04-18',
    accountingPeriod: '2026-04',
    direction: '收入',
    category: '客户回款',
    counterparty: '春序茶饮',
    counterpartyType: '客户',
    amount: 32000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-004',
    sourceTitle: '春序茶饮空间设计服务',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-04-18 15:20',
    reconciledAt: '2026-04-19',
    note: '4 月销项发票对应回款',
    updatedAt: '2026-04-19 09:40',
    files: [
      {
        id: 'fin-file-016',
        name: '春序茶饮_回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-04-18'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-029',
        time: '2026-04-18 15:00',
        actor: '李明',
        object: 'FIN-202604-0005',
        action: '登记流水',
        summary: '登记客户回款 32,000 元'
      },
      {
        id: 'fin-op-030',
        time: '2026-04-18 15:20',
        actor: '财务复核',
        object: 'FIN-202604-0005',
        action: '复核入账',
        summary: '核对银行回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-017',
    transactionNo: 'FIN-202604-0009',
    occurredAt: '2026-04-12',
    accountingPeriod: '2026-04',
    direction: '支出',
    category: '税费缴纳',
    counterparty: '税务机关',
    counterpartyType: '内部',
    amount: 466.51,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    ...ccbPaymentPublicAccountRef,
    sourceType: '税费事项',
    sourceNo: 'TAX-2026Q1-VAT',
    sourceTitle: '2026-Q1 增值税及附加',
    voucherStatus: '已上传',
    taxPaymentAllocations: [
      { amount: 440.1, subjectCode: '2221.01', taxType: '增值税' },
      { amount: 15.41, subjectCode: '2221.04', taxType: '城市维护建设税' },
      { amount: 6.6, subjectCode: '2221.06', taxType: '教育费附加' },
      { amount: 4.4, subjectCode: '2221.07', taxType: '地方教育附加' }
    ],
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-04-12 15:40',
    reconciledAt: '2026-04-12',
    note: '2026-Q1 增值税及附加合并缴款，其中增值税 440.10 元、附加税 26.41 元',
    updatedAt: '2026-04-12 15:45',
    files: [
      {
        id: 'fin-file-017',
        name: '2026-Q1_增值税及附加缴款回单.pdf',
        status: '已上传',
        type: '缴款回单',
        updatedAt: '2026-04-12'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-031',
        time: '2026-04-12 15:30',
        actor: '李明',
        object: 'FIN-202604-0009',
        action: '登记流水',
        summary: '登记增值税及附加缴纳 466.51 元'
      },
      {
        id: 'fin-op-032',
        time: '2026-04-12 15:40',
        actor: '财务复核',
        object: 'FIN-202604-0009',
        action: '复核入账',
        summary: '核对缴款回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-tax-cit-q1',
    transactionNo: 'FIN-202604-0012',
    occurredAt: '2026-04-12',
    accountingPeriod: '2026-04',
    direction: '支出',
    category: '税费缴纳',
    counterparty: '税务机关',
    counterpartyType: '内部',
    amount: 500,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    ...ccbPaymentPublicAccountRef,
    sourceType: '税费事项',
    sourceNo: 'TAX-2026Q1-CIT',
    sourceTitle: '2026-Q1 企业所得税季度预缴',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-04-12 16:15',
    reconciledAt: '2026-04-12',
    note: '2026-Q1 企业所得税季度预缴',
    updatedAt: '2026-04-12 16:20',
    files: [
      {
        id: 'fin-file-q1-cit-payment',
        name: '2026-Q1_企业所得税预缴缴款回单.pdf',
        status: '已上传',
        type: '缴款回单',
        updatedAt: '2026-04-12'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-q1-cit-payment-register',
        time: '2026-04-12 16:05',
        actor: '李明',
        object: 'FIN-202604-0012',
        action: '登记流水',
        summary: '登记企业所得税季度预缴 500 元'
      },
      {
        id: 'fin-op-q1-cit-payment-review',
        time: '2026-04-12 16:15',
        actor: '财务复核',
        object: 'FIN-202604-0012',
        action: '复核入账',
        summary: '核对缴款回单后入账'
      }
    ]
  },
  {
    id: 'fin-flow-018',
    transactionNo: 'FIN-202603-0021',
    occurredAt: '2026-03-28',
    accountingPeriod: '2026-03',
    direction: '收入',
    category: '客户回款',
    counterparty: '前期未开票客户',
    counterpartyType: '客户',
    amount: 1000,
    currency: 'CNY',
    paymentMethod: '对公账户收款',
    ...cmbPublicAccountRef,
    sourceType: '合同应收',
    sourceNo: 'CON-2026-002',
    sourceTitle: '前期未开票收入后续补开发票',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-03-28 16:20',
    reconciledAt: '2026-03-29',
    invoiceDeclarationPeriod: '2026-Q1',
    invoiceDeclarationPreparationNo: 'PREP-2026Q1-VAT',
    invoiceDeclarationStatus: '未开票已申报',
    vatDeclarationFact: {
      taxRate: '1%',
      taxableClassification: '普通应税交易',
      vatTreatment: '减按1%'
    },
    note: '2026-Q1 已按未开票收入申报，2026-Q2 补开发票时只做后续开票处理。',
    updatedAt: '2026-03-29 09:20',
    files: [
      {
        id: 'fin-file-018',
        name: '前期未开票客户_回款银行回单.pdf',
        status: '已上传',
        type: '银行回单',
        updatedAt: '2026-03-28'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-033',
        time: '2026-03-28 15:50',
        actor: '李明',
        object: 'FIN-202603-0021',
        action: '登记流水',
        summary: '登记客户回款 1,000 元'
      },
      {
        id: 'fin-op-034',
        time: '2026-03-28 16:20',
        actor: '财务复核',
        object: 'FIN-202603-0021',
        action: '确认未开票申报',
        summary: '该回款已计入 2026-Q1 未开票收入'
      }
    ]
  }
] satisfies FinanceTransactionRecordSeed[]).map((record) => {
  const seedRecord = record as FinanceTransactionRecordSeed;

  return {
    ...seedRecord,
    categorySnapshot: seedRecord.categorySnapshot ?? getFinanceCategorySnapshot(seedRecord.category)
  };
});
