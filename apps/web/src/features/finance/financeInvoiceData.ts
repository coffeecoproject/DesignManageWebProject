export type FinanceInvoiceDirection = '销项' | '进项';
export type FinanceInvoiceStatus = '正常' | '红冲' | '作废';
export type FinanceInvoiceMatchStatus = '已匹配' | '部分匹配' | '未匹配';
export type FinanceInvoiceColor = '蓝票' | '红票';
export type FinanceInvoiceKind = '普通发票' | '专用发票';
export type FinanceInvoiceDeclarationTreatment = '本期申报' | '前期未开票冲抵' | '不计入增值税申报' | '待处理';

export type FinanceInvoiceMatchedTransaction = {
  amount: number;
  id: string;
  transactionNo: string;
};

export type FinanceInvoiceRecord = {
  accountingPeriod: string;
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
  matchedTransactions: FinanceInvoiceMatchedTransaction[];
  netAmount: number;
  originalInvoiceId?: string;
  sourceFile: string;
  taxAmount: number;
  taxExcludedAmount: number;
  taxIncludedAmount: number;
  taxRate: string;
  totalAmount: number;
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
  'declarationPeriod' | 'invoiceColor' | 'netAmount' | 'taxExcludedAmount' | 'taxIncludedAmount' | 'totalAmount'
> & {
  totalAmount: number;
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

  return {
    ...input,
    declarationPeriod: getQuarterPeriod(input.accountingPeriod),
    invoiceColor: input.invoiceStatus === '红冲' ? '红票' : '蓝票',
    netAmount: taxExcludedAmount,
    taxExcludedAmount,
    taxIncludedAmount,
    totalAmount: taxIncludedAmount
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
    matchedTransactions: [{ amount: 68000, id: 'invoice-match-out-202606-001-001', transactionNo: 'FIN-202606-0001' }],
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 673.27,
    taxRate: '1%',
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
    matchedTransactions: [{ amount: 9800, id: 'invoice-match-out-202606-002-001', transactionNo: 'FIN-202606-0005' }],
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 97.03,
    taxRate: '1%',
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
    matchedTransactions: [
      { amount: 3000, id: 'invoice-match-out-202606-003-001', transactionNo: 'FIN-202606-0008' },
      { amount: 2000, id: 'invoice-match-out-202606-003-002', transactionNo: 'FIN-202606-0009' }
    ],
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 74.26,
    taxRate: '1%',
    totalAmount: 7500
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '湖畔烘焙',
    declarationTreatment: '本期申报',
    direction: '销项',
    id: 'invoice-out-202606-007',
    importedAt: '2026-06-21 17:10',
    invoiceDate: '2026-06-21',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000610007',
    invoiceStatus: '正常',
    matchedTransactions: [],
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 99.01,
    taxRate: '1%',
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
    matchedTransactions: [{ amount: 1000, id: 'invoice-match-out-202606-008-001', transactionNo: 'FIN-202603-0021' }],
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
    matchedTransactions: [],
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: -11.88,
    taxRate: '1%',
    totalAmount: -1200
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
    matchedTransactions: [{ amount: 8000, id: 'invoice-match-out-202606-005-001', transactionNo: 'FIN-202606-0010' }],
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 79.21,
    taxRate: '1%',
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
    matchedTransactions: [{ amount: 3800, id: 'invoice-match-out-202606-006-001', transactionNo: 'FIN-202606-0010' }],
    sourceFile: '2026-06_销项发票_税务下载.xlsx',
    taxAmount: 37.62,
    taxRate: '1%',
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
    matchedTransactions: [{ amount: 3200, id: 'invoice-match-in-202606-001-001', transactionNo: 'FIN-202606-0004' }],
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
    matchedTransactions: [],
    sourceFile: '2026-06_进项发票_税务下载.xlsx',
    taxAmount: 7.82,
    taxRate: '1%',
    totalAmount: 790
  }),
  createInvoice({
    accountingPeriod: '2026-06',
    counterparty: '云服务平台',
    declarationTreatment: '不计入增值税申报',
    direction: '进项',
    id: 'invoice-in-202606-003',
    importedAt: '2026-06-15 10:24',
    invoiceDate: '2026-06-15',
    invoiceKind: '普通发票',
    invoiceNo: '254420000000620003',
    invoiceStatus: '正常',
    matchedTransactions: [{ amount: 580, id: 'invoice-match-in-202606-003-001', transactionNo: 'FIN-202606-0004' }],
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
    matchedTransactions: [{ amount: 486.5, id: 'invoice-match-in-202605-001-001', transactionNo: 'FIN-202605-0018' }],
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
    matchedTransactions: [{ amount: 12000, id: 'invoice-match-out-202605-001-001', transactionNo: 'FIN-202605-0017' }],
    sourceFile: '2026-05_销项发票_税务下载.xlsx',
    taxAmount: 148.51,
    taxRate: '1%',
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
    matchedTransactions: [{ amount: 32000, id: 'invoice-match-out-202604-001-001', transactionNo: 'FIN-202604-0005' }],
    sourceFile: '2026-04_销项发票_税务下载.xlsx',
    taxAmount: 316.83,
    taxRate: '1%',
    totalAmount: 32000
  }),
];

export const financeInvoiceImportBatches: FinanceInvoiceImportBatch[] = [
  {
    accountingPeriod: '2026-06',
    direction: '销项',
    fileName: '2026-06_销项发票_税务下载.xlsx',
    id: 'invoice-import-202606-output',
    importedAt: '2026-06-21 17:10',
    invoiceCount: 8
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
