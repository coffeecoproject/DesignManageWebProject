import type { FinanceInvoiceRecord } from './financeInvoiceData';
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
  type FinanceTaxpayerType
} from './financeTaxPolicyModel';

export type {
  FinanceInputTaxTreatment,
  FinanceTaxBasisSource,
  FinanceTaxCalculationMethod,
  FinanceTaxEvidenceStatus,
  FinanceTaxpayerType
} from './financeTaxPolicyModel';

export type FinanceTaxBasis = {
  basisSource: FinanceTaxBasisSource;
  calculationMethod?: FinanceTaxCalculationMethod;
  inputTaxTreatment?: FinanceInputTaxTreatment;
  taxAmount: number;
  taxExcludedAmount: number;
  taxIncludedAmount: number;
  taxpayerType?: FinanceTaxpayerType;
  taxRate: string;
};

export type FinanceResolvedTaxBasis = FinanceTaxBasis & {
  evidenceStatus: FinanceTaxEvidenceStatus;
  matchedInvoiceAmount: number;
};

export type FinanceAccrualTaxSource = {
  amount: number;
  direction: '应收' | '应付';
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
  overrides: Partial<Pick<FinanceTaxBasis, 'calculationMethod' | 'inputTaxTreatment' | 'taxpayerType'>> = {}
): FinanceTaxBasis {
  const taxAmount = getFinanceTaxAmountFromIncludedAmount(taxIncludedAmount, taxRate);

  return {
    basisSource,
    calculationMethod: overrides.calculationMethod ?? getDefaultTaxCalculationMethod(taxRate),
    inputTaxTreatment: overrides.inputTaxTreatment ?? getDefaultInputTaxTreatment(basisSource),
    taxAmount,
    taxExcludedAmount: roundFinanceTaxMoney(taxIncludedAmount - taxAmount),
    taxIncludedAmount: roundFinanceTaxMoney(taxIncludedAmount),
    taxpayerType: overrides.taxpayerType ?? currentFinanceTaxpayerType,
    taxRate
  };
}

export function getDefaultReceivablePayableTaxBasis(record: FinanceAccrualTaxSource): FinanceTaxBasis {
  const taxPolicy = getFinanceAccrualTaxPolicy({
    direction: record.direction,
    sourceType: record.sourceType
  });

  return createFinanceTaxBasis(record.amount, taxPolicy.taxRate, taxPolicy.basisSource, {
    calculationMethod: taxPolicy.calculationMethod,
    inputTaxTreatment: taxPolicy.inputTaxTreatment,
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
    matchedInvoiceAmount: roundFinanceTaxMoney(invoiceSummary.taxIncludedAmount),
    taxAmount: roundFinanceTaxMoney(invoiceSummary.taxAmount),
    taxExcludedAmount: roundFinanceTaxMoney(invoiceSummary.taxExcludedAmount),
    taxIncludedAmount: roundFinanceTaxMoney(invoiceSummary.taxIncludedAmount),
    taxpayerType: currentFinanceTaxpayerType,
    taxRate: invoiceRows.map((invoice) => invoice.taxRate).filter(Boolean).join(' / ') || '-'
  };
}

export function createPendingFinanceTaxBasis(): FinanceResolvedTaxBasis {
  return {
    basisSource: '待确认',
    calculationMethod: '不涉及',
    evidenceStatus: '待确认',
    inputTaxTreatment: '不涉及',
    matchedInvoiceAmount: 0,
    taxAmount: 0,
    taxExcludedAmount: 0,
    taxIncludedAmount: 0,
    taxpayerType: currentFinanceTaxpayerType,
    taxRate: '-'
  };
}

export function resolveFinanceAccrualTaxBasis(
  source: FinanceAccrualTaxSource,
  invoiceRows: FinanceInvoiceRecord[]
): FinanceResolvedTaxBasis {
  const normalInvoices = invoiceRows.filter((invoice) => invoice.invoiceStatus === '正常' && invoice.invoiceColor === '蓝票');
  const invoiceSummary = summarizeInvoiceTax(normalInvoices);
  const sourceTaxBasis = isFinanceTaxBasisResolved(source.taxBasis) ? source.taxBasis : undefined;
  const isFullyInvoiced = Math.abs(invoiceSummary.taxIncludedAmount - source.amount) <= moneyTolerance;
  const isPartiallyInvoiced =
    invoiceSummary.taxIncludedAmount > moneyTolerance &&
    invoiceSummary.taxIncludedAmount + moneyTolerance < source.amount;

  if (source.direction === '应收') {
    if (normalInvoices.length > 0 && isFullyInvoiced) {
      return createResolvedTaxBasisFromInvoices(normalInvoices, '发票已匹配');
    }

    if (sourceTaxBasis) {
      return createResolvedTaxBasisFromSource(
        sourceTaxBasis,
        normalInvoices.length > 0 || isPartiallyInvoiced ? '发票部分匹配' : '发票待补',
        invoiceSummary.taxIncludedAmount
      );
    }

    if (normalInvoices.length > 0) {
      return createResolvedTaxBasisFromInvoices(normalInvoices, '发票部分匹配');
    }

    return createPendingFinanceTaxBasis();
  }

  if (normalInvoices.length > 0) {
    return createResolvedTaxBasisFromInvoices(normalInvoices, '发票已匹配');
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
