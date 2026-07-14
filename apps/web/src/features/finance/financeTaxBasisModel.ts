import type { FinanceInvoiceBusinessAllocation, FinanceInvoiceRecord } from './financeInvoiceData';
import {
  getActiveFinanceTaxPolicyProfile,
  getFinanceAccrualTaxPolicy,
  getFinanceTaxAmountFromIncludedAmount,
  getFinanceVatInvoicePolicy,
  parseFinanceTaxRate,
  roundFinanceTaxPolicyMoney,
  type FinanceInputTaxTreatment,
  type FinanceTaxBasisSource,
  type FinanceTaxCalculationMethod,
  type FinanceTaxEvidenceStatus,
  type FinanceTaxpayerType,
  type FinanceVatDeclarationOutcome,
  type FinanceVatSalesCategory,
  type FinanceVatTaxableClassification
} from './financeTaxPolicyModel';

export type {
  FinanceInputTaxTreatment,
  FinanceTaxBasisSource,
  FinanceTaxCalculationMethod,
  FinanceTaxEvidenceStatus,
  FinanceTaxpayerType,
  FinanceVatDeclarationOutcome,
  FinanceVatTaxableClassification
} from './financeTaxPolicyModel';

export type FinanceTaxBasis = {
  basisSource: FinanceTaxBasisSource;
  calculationMethod?: FinanceTaxCalculationMethod;
  inputTaxTreatment?: FinanceInputTaxTreatment;
  salesCategory: FinanceVatSalesCategory;
  taxAmount: number;
  taxExcludedAmount: number;
  taxIncludedAmount: number;
  taxOutcome?: FinanceVatDeclarationOutcome;
  taxpayerType?: FinanceTaxpayerType;
  taxRate: string;
  taxableClassification?: FinanceVatTaxableClassification;
};

export type FinanceResolvedTaxBasis = FinanceTaxBasis & {
  evidenceStatus: FinanceTaxEvidenceStatus;
  matchedInvoiceAmount: number;
};

export type FinanceAccrualTaxSource = {
  amount: number;
  direction: '应收' | '应付';
  id?: string;
  sourceType: string;
  taxBasis?: FinanceTaxBasis;
};

export const currentFinanceTaxpayerType: FinanceTaxpayerType = getActiveFinanceTaxPolicyProfile().taxpayerType;

const moneyTolerance = 0.01;

export function roundFinanceTaxMoney(amount: number) {
  return roundFinanceTaxPolicyMoney(amount);
}

function getDefaultTaxCalculationMethod(taxRate: string): FinanceTaxCalculationMethod {
  return parseFinanceTaxRate(taxRate) > 0 ? getActiveFinanceTaxPolicyProfile().vat.outputInvoice.calculationMethod : '不涉及';
}

function getDefaultInputTaxTreatment(basisSource: FinanceTaxBasisSource): FinanceInputTaxTreatment {
  return basisSource === '不涉及发票' ? '不涉及' : '成本入账';
}

export function createFinanceTaxBasis(
  taxIncludedAmount: number,
  taxRate: string,
  basisSource: FinanceTaxBasisSource,
  overrides: Partial<
    Pick<FinanceTaxBasis, 'calculationMethod' | 'inputTaxTreatment' | 'salesCategory' | 'taxOutcome' | 'taxableClassification' | 'taxpayerType'>
  > = {}
): FinanceTaxBasis {
  const taxAmount = getFinanceTaxAmountFromIncludedAmount(taxIncludedAmount, taxRate);

  return {
    basisSource,
    calculationMethod: overrides.calculationMethod ?? getDefaultTaxCalculationMethod(taxRate),
    inputTaxTreatment: overrides.inputTaxTreatment ?? getDefaultInputTaxTreatment(basisSource),
    salesCategory: overrides.salesCategory ?? '服务、不动产和无形资产',
    taxAmount,
    taxExcludedAmount: roundFinanceTaxMoney(taxIncludedAmount - taxAmount),
    taxIncludedAmount: roundFinanceTaxMoney(taxIncludedAmount),
    taxOutcome: overrides.taxOutcome,
    taxpayerType: overrides.taxpayerType ?? currentFinanceTaxpayerType,
    taxRate,
    taxableClassification: overrides.taxableClassification
  };
}

export function getDefaultReceivablePayableTaxBasis(record: FinanceAccrualTaxSource): FinanceTaxBasis {
  const taxPolicy = getFinanceAccrualTaxPolicy({
    direction: record.direction,
    sourceType: record.sourceType
  });

  if (taxPolicy.basisSource === '待确认') {
    return {
      basisSource: '待确认',
      calculationMethod: taxPolicy.calculationMethod,
      inputTaxTreatment: taxPolicy.inputTaxTreatment,
      salesCategory: '服务、不动产和无形资产',
      taxAmount: 0,
      taxExcludedAmount: 0,
      taxIncludedAmount: 0,
      taxOutcome: taxPolicy.taxOutcome,
      taxpayerType: taxPolicy.taxpayerType,
      taxRate: taxPolicy.taxRate,
      taxableClassification: taxPolicy.taxableClassification
    };
  }

  return createFinanceTaxBasis(record.amount, taxPolicy.taxRate, taxPolicy.basisSource, {
    calculationMethod: taxPolicy.calculationMethod,
    inputTaxTreatment: taxPolicy.inputTaxTreatment,
    taxOutcome: taxPolicy.taxOutcome,
    taxableClassification: taxPolicy.taxableClassification,
    taxpayerType: taxPolicy.taxpayerType
  });
}

export function isFinanceTaxBasisResolved(taxBasis?: FinanceTaxBasis): taxBasis is FinanceTaxBasis {
  if (!taxBasis || taxBasis.basisSource === '待确认') {
    return false;
  }

  const amountPartsAreValid =
    Number.isFinite(taxBasis.taxIncludedAmount) &&
    Number.isFinite(taxBasis.taxExcludedAmount) &&
    Number.isFinite(taxBasis.taxAmount) &&
    taxBasis.taxIncludedAmount >= 0 &&
    taxBasis.taxExcludedAmount >= 0 &&
    taxBasis.taxAmount >= 0;

  if (!amountPartsAreValid) {
    return false;
  }

  return Math.abs(taxBasis.taxIncludedAmount - taxBasis.taxExcludedAmount - taxBasis.taxAmount) <= moneyTolerance;
}

function summarizeInvoiceTax(invoiceRows: FinanceInvoiceRecord[]) {
  return invoiceRows.reduce(
    (summary, invoice) => ({
      taxAmount: roundFinanceTaxMoney(summary.taxAmount + invoice.taxAmount),
      taxExcludedAmount: roundFinanceTaxMoney(summary.taxExcludedAmount + invoice.taxExcludedAmount),
      taxIncludedAmount: roundFinanceTaxMoney(summary.taxIncludedAmount + invoice.taxIncludedAmount)
    }),
    {
      taxAmount: 0,
      taxExcludedAmount: 0,
      taxIncludedAmount: 0
    }
  );
}

function summarizeAllocationTax(allocations: FinanceInvoiceBusinessAllocation[]) {
  return allocations.reduce(
    (summary, allocation) => ({
      taxAmount: roundFinanceTaxMoney(summary.taxAmount + allocation.taxAmount),
      taxExcludedAmount: roundFinanceTaxMoney(summary.taxExcludedAmount + allocation.taxExcludedAmount),
      taxIncludedAmount: roundFinanceTaxMoney(summary.taxIncludedAmount + allocation.taxIncludedAmount)
    }),
    {
      taxAmount: 0,
      taxExcludedAmount: 0,
      taxIncludedAmount: 0
    }
  );
}

function createResolvedTaxBasisFromSource(
  taxBasis: FinanceTaxBasis,
  evidenceStatus: FinanceTaxEvidenceStatus,
  matchedInvoiceAmount: number
): FinanceResolvedTaxBasis {
  return {
    ...taxBasis,
    evidenceStatus,
    matchedInvoiceAmount: roundFinanceTaxMoney(matchedInvoiceAmount),
    taxAmount: roundFinanceTaxMoney(taxBasis.taxAmount),
    taxExcludedAmount: roundFinanceTaxMoney(taxBasis.taxExcludedAmount),
    taxIncludedAmount: roundFinanceTaxMoney(taxBasis.taxIncludedAmount)
  };
}

function createResolvedTaxBasisFromInvoices(
  invoiceRows: FinanceInvoiceRecord[],
  evidenceStatus: FinanceTaxEvidenceStatus
): FinanceResolvedTaxBasis {
  const invoiceSummary = summarizeInvoiceTax(invoiceRows);
  const invoiceDirection = invoiceRows[0]?.direction;
  const invoicePolicy = invoiceDirection ? getFinanceVatInvoicePolicy(invoiceDirection) : getActiveFinanceTaxPolicyProfile().vat.outputInvoice;

  return {
    basisSource: '发票台账',
    calculationMethod: invoicePolicy.calculationMethod,
    evidenceStatus,
    inputTaxTreatment: invoicePolicy.inputTaxTreatment,
    salesCategory: invoiceRows[0]?.salesCategory ?? '服务、不动产和无形资产',
    matchedInvoiceAmount: roundFinanceTaxMoney(invoiceSummary.taxIncludedAmount),
    taxAmount: roundFinanceTaxMoney(invoiceSummary.taxAmount),
    taxExcludedAmount: roundFinanceTaxMoney(invoiceSummary.taxExcludedAmount),
    taxIncludedAmount: roundFinanceTaxMoney(invoiceSummary.taxIncludedAmount),
    taxOutcome: invoiceSummary.taxAmount === 0 ? '免税' : undefined,
    taxpayerType: currentFinanceTaxpayerType,
    taxRate: invoiceRows.map((invoice) => invoice.taxRate).filter(Boolean).join(' / ') || '-',
    taxableClassification: invoicePolicy.defaultTaxableClassification
  };
}

function createResolvedTaxBasisFromAllocations(
  allocations: FinanceInvoiceBusinessAllocation[],
  invoiceRows: FinanceInvoiceRecord[],
  evidenceStatus: FinanceTaxEvidenceStatus
): FinanceResolvedTaxBasis {
  const allocationSummary = summarizeAllocationTax(allocations);
  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const matchedInvoices = allocations
    .map((allocation) => invoiceById.get(allocation.invoiceId))
    .filter((invoice): invoice is FinanceInvoiceRecord => Boolean(invoice));
  const invoicePolicy = matchedInvoices[0]?.direction
    ? getFinanceVatInvoicePolicy(matchedInvoices[0].direction)
    : getActiveFinanceTaxPolicyProfile().vat.outputInvoice;

  return {
    basisSource: '发票台账',
    calculationMethod: invoicePolicy.calculationMethod,
    evidenceStatus,
    inputTaxTreatment: invoicePolicy.inputTaxTreatment,
    salesCategory: matchedInvoices[0]?.salesCategory ?? '服务、不动产和无形资产',
    matchedInvoiceAmount: roundFinanceTaxMoney(allocationSummary.taxIncludedAmount),
    taxAmount: roundFinanceTaxMoney(allocationSummary.taxAmount),
    taxExcludedAmount: roundFinanceTaxMoney(allocationSummary.taxExcludedAmount),
    taxIncludedAmount: roundFinanceTaxMoney(allocationSummary.taxIncludedAmount),
    taxOutcome: allocationSummary.taxAmount === 0 ? '免税' : undefined,
    taxpayerType: currentFinanceTaxpayerType,
    taxRate: Array.from(new Set(matchedInvoices.map((invoice) => invoice.taxRate).filter(Boolean))).join(' / ') || '-',
    taxableClassification: invoicePolicy.defaultTaxableClassification
  };
}

export function createPendingFinanceTaxBasis(): FinanceResolvedTaxBasis {
  return {
    basisSource: '待确认',
    calculationMethod: '不涉及',
    evidenceStatus: '待确认',
    inputTaxTreatment: '不涉及',
    salesCategory: '服务、不动产和无形资产',
    matchedInvoiceAmount: 0,
    taxAmount: 0,
    taxExcludedAmount: 0,
    taxIncludedAmount: 0,
    taxOutcome: '待申报判定',
    taxpayerType: currentFinanceTaxpayerType,
    taxRate: '-',
    taxableClassification: '普通应税交易'
  };
}

export function resolveFinanceAccrualTaxBasis(
  source: FinanceAccrualTaxSource,
  invoiceRows: FinanceInvoiceRecord[],
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[] = []
): FinanceResolvedTaxBasis {
  const normalInvoices = invoiceRows.filter((invoice) => invoice.invoiceStatus === '正常' && invoice.invoiceColor === '蓝票');
  const normalInvoiceIds = new Set(normalInvoices.map((invoice) => invoice.id));
  const sourceAllocations = source.id
    ? invoiceBusinessAllocationRows.filter((allocation) => (
        allocation.status === '有效' &&
        allocation.targetType === '应收应付' &&
        allocation.targetId === source.id &&
        normalInvoiceIds.has(allocation.invoiceId)
      ))
    : [];
  const hasAllocationSource = Boolean(source.id);
  const invoiceSummary = hasAllocationSource ? summarizeAllocationTax(sourceAllocations) : summarizeInvoiceTax(normalInvoices);
  const sourceTaxBasis = isFinanceTaxBasisResolved(source.taxBasis) ? source.taxBasis : undefined;
  const isFullyInvoiced = Math.abs(invoiceSummary.taxIncludedAmount - source.amount) <= moneyTolerance;
  const isPartiallyInvoiced =
    invoiceSummary.taxIncludedAmount > moneyTolerance &&
    invoiceSummary.taxIncludedAmount + moneyTolerance < source.amount;

  if (source.direction === '应收') {
    if (invoiceSummary.taxIncludedAmount > moneyTolerance && isFullyInvoiced) {
      return hasAllocationSource
        ? createResolvedTaxBasisFromAllocations(sourceAllocations, invoiceRows, '发票已匹配')
        : createResolvedTaxBasisFromInvoices(normalInvoices, '发票已匹配');
    }

    if (sourceTaxBasis) {
      return createResolvedTaxBasisFromSource(
        sourceTaxBasis,
        invoiceSummary.taxIncludedAmount > moneyTolerance || isPartiallyInvoiced ? '发票部分匹配' : '发票待补',
        invoiceSummary.taxIncludedAmount
      );
    }

    if (invoiceSummary.taxIncludedAmount > moneyTolerance) {
      return hasAllocationSource
        ? createResolvedTaxBasisFromAllocations(sourceAllocations, invoiceRows, '发票部分匹配')
        : createResolvedTaxBasisFromInvoices(normalInvoices, '发票部分匹配');
    }

    return createPendingFinanceTaxBasis();
  }

  if (invoiceSummary.taxIncludedAmount > moneyTolerance) {
    return hasAllocationSource
      ? createResolvedTaxBasisFromAllocations(sourceAllocations, invoiceRows, isFullyInvoiced ? '发票已匹配' : '发票部分匹配')
      : createResolvedTaxBasisFromInvoices(normalInvoices, '发票已匹配');
  }

  if (sourceTaxBasis) {
    return createResolvedTaxBasisFromSource(
      sourceTaxBasis,
      sourceTaxBasis.basisSource === '不涉及发票' ? '不涉及发票' : '发票待补',
      0
    );
  }

  return createPendingFinanceTaxBasis();
}
