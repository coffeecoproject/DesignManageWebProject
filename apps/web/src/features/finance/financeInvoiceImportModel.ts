import type {
  FinanceInvoiceDirection,
  FinanceInvoiceImportBatch,
  FinanceInvoiceRecord
} from './financeInvoiceData';

type InvoiceImportInput = {
  direction: FinanceInvoiceImportBatch['direction'];
  fileName: string;
  importedAt: string;
  period: string;
  sequence: number;
};

function getImportDirections(direction: FinanceInvoiceImportBatch['direction']): FinanceInvoiceDirection[] {
  return direction === '进销项' ? ['销项', '进项'] : [direction];
}

function getQuarterPeriod(accountingPeriod: string) {
  const [year, monthText] = accountingPeriod.split('-');
  const month = Number(monthText);

  return `${year}-Q${Math.ceil(month / 3)}`;
}

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

function getGeneratedInvoiceAmount(direction: FinanceInvoiceDirection, index: number, sequence: number) {
  const baseAmount = direction === '销项' ? 6600 : 1200;
  return baseAmount + sequence * 100 + index * 50;
}

function buildGeneratedInvoiceNo(period: string, direction: FinanceInvoiceDirection, sequence: number, index: number) {
  const directionCode = direction === '销项' ? 'OUT' : 'IN';
  return `IMPORT-${period.replace('-', '')}-${directionCode}-${String(sequence).padStart(3, '0')}${index + 1}`;
}

export function buildFinanceInvoiceImportBatch(input: InvoiceImportInput): FinanceInvoiceImportBatch {
  const directions = getImportDirections(input.direction);

  return {
    accountingPeriod: input.period,
    direction: input.direction,
    fileName: input.fileName,
    id: `invoice-import-${input.period.replace('-', '')}-${String(input.sequence).padStart(3, '0')}`,
    importedAt: input.importedAt,
    invoiceCount: directions.length
  };
}

export function buildFinanceInvoiceRecordsFromImportBatch(
  batch: FinanceInvoiceImportBatch,
  sequence: number
): FinanceInvoiceRecord[] {
  const directions = getImportDirections(batch.direction);

  return directions.map((direction, index) => {
    const totalAmount = roundMoney(getGeneratedInvoiceAmount(direction, index, sequence));
    const taxAmount = roundMoney(totalAmount / 101);
    const taxExcludedAmount = roundMoney(totalAmount - taxAmount);
    const invoiceNo = buildGeneratedInvoiceNo(batch.accountingPeriod, direction, sequence, index);

    return {
      accountingPeriod: batch.accountingPeriod,
      counterparty: direction === '销项' ? '导入待关联客户' : '导入待关联供应商',
      declarationPeriod: getQuarterPeriod(batch.accountingPeriod),
      declarationTreatment: '待处理',
      direction,
      id: `invoice-imported-${batch.accountingPeriod}-${direction}-${sequence}-${index + 1}`,
      importedAt: batch.importedAt,
      invoiceColor: '蓝票',
      invoiceDate: `${batch.accountingPeriod}-20`,
      invoiceKind: '普通发票',
      invoiceNo,
      invoiceStatus: '正常',
      matchedBusinessRefs: [],
      netAmount: taxExcludedAmount,
      originalInvoiceId: undefined,
      sourceFile: batch.fileName,
      taxAmount,
      taxExcludedAmount,
      taxIncludedAmount: totalAmount,
      taxRate: '1%',
      totalAmount
    };
  });
}
