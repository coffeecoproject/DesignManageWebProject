import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';

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
  | '本期暂不计入'
  | '后续开票待处理'
  | '后续开票已处理';
export type FinanceSourceType = '合同应收' | '月度绩效' | '薪酬发放' | '外协结算' | '报销单' | '税费事项' | '员工代收流水' | '现金暂收流水' | '员工垫付单' | '手工登记';
export type FinancePaymentMethod = '对公账户收款' | '对公账户付款' | '员工代收' | '现金暂收' | '员工垫付';
export type FinanceSettlementAccountType = '对公账户' | '员工经办资金';
export type FinanceCategoryStatus = '启用' | '停用';
export type FinanceReportAggregation = '经营收入' | '项目成本' | '人员支出' | '运营费用' | '资金处理' | '其他';
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
export type FinanceSecondaryCategoryConfig = {
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
  includeInReport: boolean;
  primaryCode: string;
  primaryName: string;
  reportAggregation: FinanceReportAggregation;
  secondaryCode: string;
  secondaryName: FinanceTransactionCategory;
};
export type FinanceCollectionStatus =
  | '不适用'
  | '待转入对公'
  | '部分转入对公'
  | '已转入对公'
  | '待存入对公'
  | '已存入对公'
  | '待报销'
  | '已报销';
export type FinanceTransactionRecord = {
  id: string;
  transactionNo: string;
  occurredAt: string;
  accountingPeriod: string;
  direction: FinanceTransactionDirection;
  category: FinanceTransactionCategory;
  categorySnapshot: FinanceCategorySnapshot;
  counterparty: string;
  counterpartyType: '客户' | '员工' | '外协' | '供应商' | '内部';
  amount: number;
  currency: 'CNY';
  paymentMethod: FinancePaymentMethod;
  settlementAccount: string;
  settlementAccountType: FinanceSettlementAccountType;
  handler?: string;
  sourceType: FinanceSourceType;
  sourceNo: string;
  sourceTitle: string;
  voucherStatus: FinanceVoucherStatus;
  reconciliationStatus: FinanceReconciliationStatus;
  status: FinanceTransactionStatus;
  registeredBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reconciledAt?: string;
  collectionStatus: FinanceCollectionStatus;
  collectedAmount?: number;
  collectionTransactionNos?: string[];
  collectionSourceTransactionNo?: string;
  collectionFromAccount?: string;
  collectionToAccount?: string;
  note: string;
  updatedAt: string;
  files: RelatedFileRecord[];
  invoiceDeclarationPeriod?: string;
  invoiceDeclarationPreparationNo?: string;
  invoiceDeclarationStatus?: FinanceInvoiceDeclarationStatus;
  operationRecords: OperationRecord[];
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
    code: 'FC1-EXP-FUND',
    direction: '支出',
    id: 'finance-primary-expense-fund-handling',
    includeInReport: false,
    name: '员工资金处理',
    note: '员工垫付报销等资金处理流水，不作为经营费用重复归集。',
    reportAggregation: '资金处理',
    sortOrder: 60,
    status: '启用',
    updatedAt: financeCategoryConfigToday
  },
  {
    code: 'FC1-FUND-INTERNAL',
    direction: '内部转入',
    id: 'finance-primary-internal-fund-handling',
    includeInReport: false,
    name: '内部资金处理',
    note: '员工代收、现金暂收转入对公等内部资金处理。',
    reportAggregation: '资金处理',
    sortOrder: 70,
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
    code: 'FC2-REV-CUSTOMER-PAYMENT',
    counterpartyScope: '客户',
    defaultSourceType: '合同应收',
    direction: '收入',
    id: 'finance-secondary-customer-payment',
    includeInReport: true,
    name: '客户回款',
    note: '客户通过对公账户或员工代收方式支付的项目款。',
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
    paymentMethods: ['对公账户收款'],
    primaryId: 'finance-primary-other-income',
    reportAggregation: '其他',
    sortOrder: 30,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '收入来源凭证'
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
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-people-expense',
    reportAggregation: '人员支出',
    sortOrder: 40,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '工资表、付款回单'
  },
  {
    code: 'FC2-EXP-PERFORMANCE',
    counterpartyScope: '员工',
    defaultSourceType: '月度绩效',
    direction: '支出',
    id: 'finance-secondary-performance',
    includeInReport: true,
    name: '绩效发放',
    note: '员工月度绩效发放。',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-people-expense',
    reportAggregation: '人员支出',
    sortOrder: 50,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '绩效表、付款回单'
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
    paymentMethods: ['对公账户付款', '员工垫付'],
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
    paymentMethods: ['对公账户付款', '员工垫付'],
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
    paymentMethods: ['对公账户付款', '员工垫付'],
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
    paymentMethods: ['对公账户付款', '员工垫付'],
    primaryId: 'finance-primary-operating-expense',
    reportAggregation: '运营费用',
    sortOrder: 90,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '车票、行程单、发票或报销凭证'
  },
  {
    code: 'FC2-EXP-REIMBURSE',
    counterpartyScope: '员工',
    defaultSourceType: '员工垫付单',
    direction: '支出',
    id: 'finance-secondary-reimburse',
    includeInReport: false,
    name: '员工报销付款',
    note: '员工垫付款项从对公账户报销给员工，不重复计入经营统计。',
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-expense-fund-handling',
    reportAggregation: '资金处理',
    sortOrder: 100,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '报销单、付款回单'
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
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-other-expense',
    reportAggregation: '其他',
    sortOrder: 110,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '退款审批、付款回单'
  },
  {
    code: 'FC2-FUND-EMPLOYEE-COLLECTION',
    counterpartyScope: '内部',
    defaultSourceType: '员工代收流水',
    direction: '内部转入',
    id: 'finance-secondary-employee-collection-transfer',
    includeInReport: false,
    name: '员工代收转入对公',
    note: '员工代收客户款项转入对公账户，不重复计入收入。',
    paymentMethods: ['对公账户收款'],
    primaryId: 'finance-primary-internal-fund-handling',
    reportAggregation: '资金处理',
    sortOrder: 120,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '员工转账凭证、对公入账回单'
  },
  {
    code: 'FC2-FUND-CASH-DEPOSIT',
    counterpartyScope: '内部',
    defaultSourceType: '现金暂收流水',
    direction: '内部转入',
    id: 'finance-secondary-cash-deposit',
    includeInReport: false,
    name: '现金存入对公',
    note: '员工暂收现金存入对公账户，不重复计入收入。',
    paymentMethods: ['对公账户收款'],
    primaryId: 'finance-primary-internal-fund-handling',
    reportAggregation: '资金处理',
    sortOrder: 130,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '现金存入凭证、对公入账回单'
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
    paymentMethods: ['对公账户付款', '员工垫付'],
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
    paymentMethods: ['对公账户付款'],
    primaryId: 'finance-primary-tax-payment',
    reportAggregation: '其他',
    sortOrder: 150,
    status: '启用',
    updatedAt: financeCategoryConfigToday,
    voucherRequirement: '缴款回单或银行回单'
  }
];

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

export function getFinanceCategorySnapshot(
  category: FinanceTransactionCategory,
  primaryRows: FinancePrimaryCategoryConfig[] = financePrimaryCategorySeeds,
  secondaryRows: FinanceSecondaryCategoryConfig[] = financeSecondaryCategorySeeds
): FinanceCategorySnapshot {
  const secondary = getFinanceSecondaryCategory(secondaryRows, category);
  const primary = secondary ? getFinancePrimaryCategory(primaryRows, secondary.primaryId) : undefined;

  return {
    includeInReport: secondary?.includeInReport ?? primary?.includeInReport ?? true,
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
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
    collectionStatus: '不适用',
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
    id: 'fin-flow-002',
    transactionNo: 'FIN-202606-0002',
    occurredAt: '2026-06-10',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '绩效发放',
    counterparty: '陈思',
    counterpartyType: '员工',
    amount: 1806.88,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '月度绩效',
    sourceNo: 'PERF-202606-20260011',
    sourceTitle: '陈思 2026-06 绩效预发',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '待复核',
    registeredBy: '李明',
    collectionStatus: '不适用',
    note: '月度绩效预发',
    updatedAt: '2026-06-10 11:30',
    files: [
      {
        id: 'fin-file-002',
        name: '陈思_2026-06绩效预发表.pdf',
        status: '已上传',
        type: '发放依据',
        updatedAt: '2026-06-10'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-004',
        time: '2026-06-10 11:30',
        actor: '李明',
        object: 'FIN-202606-0002',
        action: '登记流水',
        summary: '登记绩效预发 1,806.88 元'
      }
    ]
  },
  {
    id: 'fin-flow-003',
    transactionNo: 'FIN-202606-0003',
    occurredAt: '2026-06-10',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '工资发放',
    counterparty: '赵倩',
    counterpartyType: '员工',
    amount: 12000,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '薪酬发放',
    sourceNo: 'PAY-202606-20260004',
    sourceTitle: '赵倩 2026-06 工资发放',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-10 15:10',
    collectionStatus: '不适用',
    note: '月度工资发放',
    updatedAt: '2026-06-11 10:04',
    files: [
      {
        id: 'fin-file-003',
        name: '赵倩_工资发放回单.pdf',
        status: '已上传',
        type: '付款回单',
        updatedAt: '2026-06-10'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-005',
        time: '2026-06-10 14:30',
        actor: '李明',
        object: 'FIN-202606-0003',
        action: '登记流水',
        summary: '登记工资发放 12,000 元'
      },
      {
        id: 'fin-op-006',
        time: '2026-06-10 15:10',
        actor: '财务复核',
        object: 'FIN-202606-0003',
        action: '复核入账',
        summary: '核对发放依据和付款回单后入账'
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
    counterpartyType: '外协',
    amount: 3200,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '外协结算',
    sourceNo: 'OUT-202606-0008',
    sourceTitle: '空间设计外协任务结算',
    voucherStatus: '待补充',
    reconciliationStatus: '未对账',
    status: '待复核',
    registeredBy: '李明',
    collectionStatus: '不适用',
    note: '待补充付款回单',
    updatedAt: '2026-06-12 17:25',
    files: [],
    operationRecords: [
      {
        id: 'fin-op-007',
        time: '2026-06-12 17:25',
        actor: '李明',
        object: 'FIN-202606-0004',
        action: '登记流水',
        summary: '登记外协付款 3,200 元'
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
    settlementAccount: '',
    settlementAccountType: '员工经办资金',
    handler: '李明',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-009',
    sourceTitle: '星河餐饮门店设计首款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '待复核',
    registeredBy: '李明',
    collectionStatus: '待转入对公',
    collectedAmount: 0,
    collectionTransactionNos: [],
    note: '客户临时打入员工经办渠道，待转入对公账户',
    updatedAt: '2026-06-14 12:10',
    files: [
      {
        id: 'fin-file-006',
        name: '星河餐饮_员工代收到账截图.png',
        status: '已上传',
        type: '员工代收凭证',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-012',
    sourceTitle: '美刻咖啡门店设计阶段款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-18 15:30',
    collectionStatus: '不适用',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-012',
    sourceTitle: '美刻咖啡门店设计阶段款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-19 10:20',
    collectionStatus: '不适用',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-015',
    sourceTitle: '合众餐饮多门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-21 16:20',
    collectionStatus: '不适用',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-018',
    sourceTitle: '湖畔烘焙门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-22 16:10',
    collectionStatus: '不适用',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-018',
    sourceTitle: '湖畔烘焙门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-23 10:30',
    collectionStatus: '不适用',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-018',
    sourceTitle: '湖畔烘焙门店设计结算款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-24 14:45',
    collectionStatus: '不适用',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-019',
    sourceTitle: '麦田轻食门店设计尾款',
    voucherStatus: '已上传',
    reconciliationStatus: '未对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-25 11:20',
    collectionStatus: '不适用',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '合同应收',
    sourceNo: 'CON-2026-005',
    sourceTitle: '示例客户 A 项目阶段款',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-05-20 16:00',
    reconciledAt: '2026-05-21',
    collectionStatus: '不适用',
    note: '5 月销项发票对应部分回款',
    updatedAt: '2026-05-21 09:20',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
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
    collectionStatus: '不适用',
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
    amount: 450,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '税费事项',
    sourceNo: 'TAX-2026Q1-VAT',
    sourceTitle: '2026-Q1 增值税及附加',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-04-12 15:40',
    reconciledAt: '2026-04-12',
    collectionStatus: '不适用',
    note: '2026-Q1 增值税及附加缴款',
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
        summary: '登记增值税及附加缴纳 450 元'
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
    id: 'fin-flow-006',
    transactionNo: 'FIN-202605-0018',
    occurredAt: '2026-05-29',
    accountingPeriod: '2026-05',
    direction: '支出',
    category: '差旅交通',
    counterparty: '交通服务商',
    counterpartyType: '供应商',
    amount: 486.5,
    currency: 'CNY',
    paymentMethod: '员工垫付',
    settlementAccount: '',
    settlementAccountType: '员工经办资金',
    handler: '刘宇',
    sourceType: '报销单',
    sourceNo: 'EXP-202605-0012',
    sourceTitle: '门店现场交通垫付',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-05-29 18:15',
    reconciledAt: '2026-05-30',
    collectionStatus: '待报销',
    collectedAmount: 0,
    collectionTransactionNos: [],
    note: '员工先行垫付交通费用，待对公账户报销',
    updatedAt: '2026-05-30 09:20',
    files: [
      {
        id: 'fin-file-005',
        name: '刘宇_交通报销凭证.pdf',
        status: '已上传',
        type: '报销凭证',
        updatedAt: '2026-05-29'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-008',
        time: '2026-05-29 17:40',
        actor: '李明',
        object: 'FIN-202605-0018',
        action: '登记流水',
        summary: '登记差旅交通 486.50 元，付款方式为员工垫付'
      },
      {
        id: 'fin-op-009',
        time: '2026-05-29 18:15',
        actor: '财务复核',
        object: 'FIN-202605-0018',
        action: '复核入账',
        summary: '核对报销凭证后入账'
      }
    ]
  },
  {
    id: 'fin-flow-007',
    transactionNo: 'FIN-202606-0007',
    occurredAt: '2026-06-15',
    accountingPeriod: '2026-06',
    direction: '支出',
    category: '税费缴纳',
    counterparty: '税务机关',
    counterpartyType: '内部',
    amount: 3280.52,
    currency: 'CNY',
    paymentMethod: '对公账户付款',
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
    sourceType: '税费事项',
    sourceNo: 'TAX-202606-IIT',
    sourceTitle: '2026-06 个人所得税代扣代缴',
    voucherStatus: '已上传',
    reconciliationStatus: '已对账',
    status: '已入账',
    registeredBy: '李明',
    reviewedBy: '财务复核',
    reviewedAt: '2026-06-15 11:20',
    reconciledAt: '2026-06-15',
    collectionStatus: '不适用',
    note: '个人所得税代扣代缴款项',
    updatedAt: '2026-06-15 11:45',
    files: [
      {
        id: 'fin-file-007',
        name: '2026-06_个税缴款回单.pdf',
        status: '已上传',
        type: '缴款回单',
        updatedAt: '2026-06-15'
      }
    ],
    operationRecords: [
      {
        id: 'fin-op-011',
        time: '2026-06-15 10:50',
        actor: '李明',
        object: 'FIN-202606-0007',
        action: '登记流水',
        summary: '登记个人所得税缴纳 3,280.52 元'
      },
      {
        id: 'fin-op-012',
        time: '2026-06-15 11:20',
        actor: '财务复核',
        object: 'FIN-202606-0007',
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
    settlementAccount: '招商银行基本户',
    settlementAccountType: '对公账户',
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
    collectionStatus: '不适用',
    invoiceDeclarationPeriod: '2026-Q1',
    invoiceDeclarationPreparationNo: 'PREP-2026Q1-VAT',
    invoiceDeclarationStatus: '未开票已申报',
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
