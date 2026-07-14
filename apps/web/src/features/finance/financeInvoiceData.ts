import {
  resolveFinanceVatInvoiceTreatment,
  type FinanceVatSalesCategory,
  type FinanceVatInvoiceTreatment,
  type FinanceVatTaxableClassification
} from './financeTaxPolicyModel';

export type FinanceInvoiceDirection = '销项' | '进项';
export type FinanceInvoiceStatus = '正常' | '红冲' | '作废';
export type FinanceInvoiceMatchStatus = '已匹配' | '部分匹配' | '未匹配' | '已作废';
export type FinanceInvoiceColor = '蓝票' | '红票';
export type FinanceInvoiceKind = '普通发票' | '专用发票';
export type FinanceInvoiceDeclarationTreatment = '本期申报' | '前期未开票冲抵' | '不计入增值税申报' | '待处理';

// `未开票收入` is retained only for historical readback. New associations
// must point to the originating receivable/payable business record.
export type FinanceInvoiceAllocationTargetType = '应收应付' | '未开票收入';
export type FinanceInvoiceAllocationMatchBasis = '已有关联' | '来源单据' | '名称一致' | '报销票据' | '红冲原票';
export type FinanceInvoiceAllocationStatus = '有效' | '已撤销';

export type FinanceInvoiceBusinessAllocation = {
  createdAt: string;
  createdBy: string;
  id: string;
  invoiceId: string;
  matchBasis: FinanceInvoiceAllocationMatchBasis;
  taxAmount: number;
  taxExcludedAmount: number;
  taxIncludedAmount: number;
  targetId: string;
  targetNo: string;
  targetTitle: string;
  targetType: FinanceInvoiceAllocationTargetType;
  status: FinanceInvoiceAllocationStatus;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  sourceAllocationId?: string;
};

export type FinanceInvoiceRecord = {
  accountingPeriod: string;
  businessReferenceNo?: string;
  counterparty: string;
  declarationPeriod: string;
  declarationTreatment: FinanceInvoiceDeclarationTreatment;
  direction: FinanceInvoiceDirection;
  id: string;
  importedAt: string;
  invoiceColor: FinanceInvoiceColor;
  invoiceDate: string;
  invoiceKind: FinanceInvoiceKind;
  invoiceNo: string;
  invoiceStatus: FinanceInvoiceStatus;
  salesCategory: FinanceVatSalesCategory;
  netAmount: number;
  originalInvoiceId?: string;
  sourceFile: string;
  taxAmount: number;
  taxExcludedAmount: number;
  taxIncludedAmount: number;
  taxRate: string;
  taxableClassification: FinanceVatTaxableClassification;
  totalAmount: number;
  vatTreatment: FinanceVatInvoiceTreatment;
};

export type FinanceInvoiceImportBatch = {
  accountingPeriod: string;
  direction: '进销项' | FinanceInvoiceDirection;
  fileName: string;
  id: string;
  importedAt: string;
  invoiceCount: number;
};

type CreateInvoiceInput = Omit<
  FinanceInvoiceRecord,
  'declarationPeriod' | 'invoiceColor' | 'netAmount' | 'salesCategory' | 'taxExcludedAmount' | 'taxIncludedAmount' | 'totalAmount' | 'taxableClassification' | 'vatTreatment'
> & {
  salesCategory?: FinanceVatSalesCategory;
  totalAmount: number;
  taxableClassification?: FinanceVatTaxableClassification;
  vatTreatment?: FinanceVatInvoiceTreatment;
};

function getQuarterPeriod(accountingPeriod: string) {
  const [year, monthText] = accountingPeriod.split('-');
  const month = Number(monthText);

  return `${year}-Q${Math.ceil(month / 3)}`;
}

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

function createInvoice(input: CreateInvoiceInput): FinanceInvoiceRecord {
  const taxIncludedAmount = roundMoney(input.totalAmount);
  const taxExcludedAmount = roundMoney(taxIncludedAmount - input.taxAmount);
  const taxableClassification = input.taxableClassification ?? '普通应税交易';

  return {
    ...input,
    declarationPeriod: getQuarterPeriod(input.accountingPeriod),
    invoiceColor: input.invoiceStatus === '红冲' ? '红票' : '蓝票',
    netAmount: taxExcludedAmount,
    salesCategory: input.salesCategory ?? '服务、不动产和无形资产',
    taxExcludedAmount,
    taxIncludedAmount,
    taxableClassification,
    totalAmount: taxIncludedAmount,
    vatTreatment: input.vatTreatment ?? resolveFinanceVatInvoiceTreatment({
      accountingPeriod: input.accountingPeriod,
      direction: input.direction,
      taxRate: input.taxRate,
      taxableClassification
    })
  };
}

export const financeInvoiceRecords: FinanceInvoiceRecord[] = [
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '奈雪华南区域',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-001',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-03',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610001',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 68000
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '星河餐饮集团',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-002',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-14',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610002',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 9800
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '美刻咖啡',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-003',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-18',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610003',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 7500
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '光谷商业空间',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-007',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-21',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610007',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 10000
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '前期未开票客户',
    declarationTreatment: '前期未开票冲抵',
    direction: '销项',
    id: 'invoice-out-202606-008',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-21',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610008',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 9.9,
    taxRate: '1%',
    totalAmount: 1000
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '旧票红冲调整',
    declarationTreatment: '待处理',
    direction: '销项',
    id: 'invoice-out-202606-004',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-20',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610004',
    invoiceStatus: '红冲',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: -1200
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '旧票红冲调整',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-009',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-16',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610009',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 1200
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '合众餐饮集团',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-005',
    importedAt: '2026-06-21 17:05',
    invoiceDate: '2026-06-21',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610005',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 8000
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '合众餐饮集团',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-006',
    importedAt: '2026-06-21 17:05',
    invoiceDate: '2026-06-21',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610006',
    invoiceStatus: '正常',
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 3800
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '示例兼职 B',
    declarationTreatment: '不计入增值税申报',
    direction: '进项',
    id: 'invoice-in-202606-001',
    importedAt: '2026-06-15 10:24',
    invoiceDate: '2026-06-12',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000620001',
    invoiceStatus: '正常',
    sourceFile: '2026-06_进项发票_税务下载.xlsx',
    taxAmount: 31.68,
    taxRate: '1%',
    totalAmount: 3200
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '办公用品服务商',
    declarationTreatment: '不计入增值税申报',
    direction: '进项',
    id: 'invoice-in-202606-002',
    importedAt: '2026-06-15 10:24',
    invoiceDate: '2026-06-13',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000620002',
    invoiceStatus: '正常',
    sourceFile: '2026-06_进项发票_税务下载.xlsx',
    taxAmount: 7.82,
    taxRate: '1%',
    totalAmount: 790
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '云协同科技',
    declarationTreatment: '不计入增值税申报',
    direction: '进项',
    id: 'invoice-in-202606-003',
    importedAt: '2026-06-15 10:24',
    invoiceDate: '2026-06-15',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000620003',
    invoiceStatus: '正常',
    sourceFile: '2026-06_进项发票_税务下载.xlsx',
    taxAmount: 5.94,
    taxRate: '1%',
    totalAmount: 600
  }),
  createInvoice({
    accountingPeriod: '2026-05',
    counterparty: '交通服务商',
    declarationTreatment: '不计入增值税申报',
    direction: '进项',
    id: 'invoice-in-202605-001',
    importedAt: '2026-06-01 09:12',
    invoiceDate: '2026-05-29',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000520001',
    invoiceStatus: '正常',
    sourceFile: '2026-05_进项发票_税务下载.xlsx',
    taxAmount: 4.82,
    taxRate: '1%',
    totalAmount: 486.5
  }),
  createInvoice({
    accountingPeriod: '2026-05',
    counterparty: '示例客户 A',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202605-001',
    importedAt: '2026-06-01 09:08',
    invoiceDate: '2026-05-20',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000510001',
    invoiceStatus: '正常',
    sourceFile: '2026-05_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 15000
  }),
  createInvoice({
    accountingPeriod: '2026-04',
    counterparty: '春序茶饮',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202604-001',
    importedAt: '2026-04-19 09:30',
    invoiceDate: '2026-04-18',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000410001',
    invoiceStatus: '正常',
    sourceFile: '2026-04_销项发票_税务下载.xlsx',
    taxAmount: 0,
    taxRate: '0%',
    totalAmount: 32000
  }),
];

function createInvoiceBusinessAllocation(input: Omit<FinanceInvoiceBusinessAllocation, 'status'> & { status?: FinanceInvoiceAllocationStatus }) {
  return {
    ...input,
    status: input.status ?? '有效'
  } satisfies FinanceInvoiceBusinessAllocation;
}

export const financeInvoiceBusinessAllocations: FinanceInvoiceBusinessAllocation[] = [
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-21 17:12',
    createdBy: '系统',
    id: 'invoice-allocation-out-202606-001-001',
    invoiceId: 'invoice-out-202606-001',
    matchBasis: '已有关联',
    targetId: 'ar-202606-001',
    targetNo: 'AR-202606-001',
    targetTitle: '奈雪华南门店设计服务合同',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 68000,
    taxIncludedAmount: 68000
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-21 17:12',
    createdBy: '系统',
    id: 'invoice-allocation-out-202606-002-001',
    invoiceId: 'invoice-out-202606-002',
    matchBasis: '已有关联',
    targetId: 'ar-202606-002',
    targetNo: 'AR-202606-002',
    targetTitle: '星河餐饮集团空间设计项目',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 9800,
    taxIncludedAmount: 9800
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-21 17:12',
    createdBy: '系统',
    id: 'invoice-allocation-out-202606-003-001',
    invoiceId: 'invoice-out-202606-003',
    matchBasis: '已有关联',
    targetId: 'ar-202606-005',
    targetNo: 'AR-202606-005',
    targetTitle: '美刻咖啡门店设计阶段款',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 7500,
    taxIncludedAmount: 7500
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-21 17:12',
    createdBy: '系统',
    id: 'invoice-allocation-out-202606-008-001',
    invoiceId: 'invoice-out-202606-008',
    matchBasis: '已有关联',
    targetId: 'ar-202603-001',
    targetNo: 'AR-202603-001',
    targetTitle: '前期未开票设计服务',
    targetType: '应收应付',
    taxAmount: 9.9,
    taxExcludedAmount: 990.1,
    taxIncludedAmount: 1000
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-21 17:12',
    createdBy: '系统',
    id: 'invoice-allocation-out-202606-005-001',
    invoiceId: 'invoice-out-202606-005',
    matchBasis: '已有关联',
    targetId: 'ar-202606-006',
    targetNo: 'AR-202606-006',
    targetTitle: '合众餐饮多门店设计结算款',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 8000,
    taxIncludedAmount: 8000
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-21 17:12',
    createdBy: '系统',
    id: 'invoice-allocation-out-202606-006-001',
    invoiceId: 'invoice-out-202606-006',
    matchBasis: '已有关联',
    targetId: 'ar-202606-006',
    targetNo: 'AR-202606-006',
    targetTitle: '合众餐饮多门店设计结算款',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 3800,
    taxIncludedAmount: 3800
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-15 10:25',
    createdBy: '系统',
    id: 'invoice-allocation-in-202606-001-001',
    invoiceId: 'invoice-in-202606-001',
    matchBasis: '已有关联',
    targetId: 'ap-202606-003',
    targetNo: 'AP-202606-003',
    targetTitle: '示例兼职 B 外协结算',
    targetType: '应收应付',
    taxAmount: 31.68,
    taxExcludedAmount: 3168.32,
    taxIncludedAmount: 3200
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-05-20 16:12',
    createdBy: '系统',
    id: 'invoice-allocation-out-202605-001-001',
    invoiceId: 'invoice-out-202605-001',
    matchBasis: '已有关联',
    targetId: 'ar-202605-001',
    targetNo: 'AR-202605-001',
    targetTitle: '示例客户 A 项目阶段款',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 12000,
    taxIncludedAmount: 12000
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-04-19 09:32',
    createdBy: '系统',
    id: 'invoice-allocation-out-202604-001-001',
    invoiceId: 'invoice-out-202604-001',
    matchBasis: '已有关联',
    targetId: 'ar-202604-001',
    targetNo: 'AR-202604-001',
    targetTitle: '春序茶饮空间设计服务',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 32000,
    taxIncludedAmount: 32000
  }),
  createInvoiceBusinessAllocation({
    createdAt: '2026-06-16 09:32',
    createdBy: '系统',
    id: 'invoice-allocation-out-202606-009-001',
    invoiceId: 'invoice-out-202606-009',
    matchBasis: '已有关联',
    targetId: 'ar-202606-008',
    targetNo: 'AR-202606-008',
    targetTitle: '旧票红冲调整服务确认',
    targetType: '应收应付',
    taxAmount: 0,
    taxExcludedAmount: 1200,
    taxIncludedAmount: 1200
  })
];

export const financeInvoiceImportBatches: FinanceInvoiceImportBatch[] = [
  {
    accountingPeriod: '2026-06',
    direction: '销项',
    fileName: '2026-06_销项发票_税务下载.xlsx',
    id: 'invoice-import-202606-output',
    importedAt: '2026-06-21 17:10',
    invoiceCount: 9
  },
  {
    accountingPeriod: '2026-06',
    direction: '进项',
    fileName: '2026-06_进项发票_税务下载.xlsx',
    id: 'invoice-import-202606-input',
    importedAt: '2026-06-15 10:24',
    invoiceCount: 3
  },
  {
    accountingPeriod: '2026-05',
    direction: '进销项',
    fileName: '2026-05_进销项发票_税务下载.xlsx',
    id: 'invoice-import-202605-all',
    importedAt: '2026-06-01 09:12',
    invoiceCount: 2
  },
  {
    accountingPeriod: '2026-04',
    direction: '销项',
    fileName: '2026-04_销项发票_税务下载.xlsx',
    id: 'invoice-import-202604-output',
    importedAt: '2026-04-19 09:30',
    invoiceCount: 1
  },
];
