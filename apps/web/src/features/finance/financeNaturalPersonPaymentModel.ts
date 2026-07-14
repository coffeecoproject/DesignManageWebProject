import type { SalaryPaymentRecord } from '../salary/salaryDomain';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import type {
  NaturalPersonPaymentFact,
  NaturalPersonPaymentSnapshot
} from './naturalPersonPaymentTypes';

export type ResidentLaborWithholdingResult = Pick<
  NaturalPersonPaymentSnapshot,
  | 'deductibleExpenseAmount'
  | 'grossIncomeAmount'
  | 'netPaymentAmount'
  | 'taxableIncomeAmount'
  | 'withheldTaxAmount'
> & {
  quickDeductionAmount: number;
  taxRate: number;
};

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

export function calculateResidentLaborWithholding(grossIncomeAmount: number): ResidentLaborWithholdingResult {
  const grossAmount = roundMoney(Math.max(0, grossIncomeAmount));
  const deductibleExpenseAmount = grossAmount <= 4000
    ? Math.min(800, grossAmount)
    : roundMoney(grossAmount * 0.2);
  const taxableIncomeAmount = roundMoney(Math.max(0, grossAmount - deductibleExpenseAmount));
  const bracket = taxableIncomeAmount <= 20000
    ? { quickDeductionAmount: 0, taxRate: 0.2 }
    : taxableIncomeAmount <= 50000
      ? { quickDeductionAmount: 2000, taxRate: 0.3 }
      : { quickDeductionAmount: 7000, taxRate: 0.4 };
  const withheldTaxAmount = roundMoney(
    Math.max(0, taxableIncomeAmount * bracket.taxRate - bracket.quickDeductionAmount)
  );

  return {
    deductibleExpenseAmount,
    grossIncomeAmount: grossAmount,
    netPaymentAmount: roundMoney(grossAmount - withheldTaxAmount),
    quickDeductionAmount: bracket.quickDeductionAmount,
    taxableIncomeAmount,
    taxRate: bracket.taxRate,
    withheldTaxAmount
  };
}

export function buildResidentLaborPaymentSnapshot(input: {
  grossIncomeAmount: number;
  identityNo?: string;
  paymentFactId: string;
  personId: string;
  personName: string;
  sourceBatchNo: string;
  sourceRecordNos?: string[];
  taxPeriod: string;
}): NaturalPersonPaymentSnapshot {
  const calculation = calculateResidentLaborWithholding(input.grossIncomeAmount);

  return {
    ...calculation,
    incomeType: '劳务报酬',
    identityNo: input.identityNo,
    paymentFactId: input.paymentFactId,
    personId: input.personId,
    personName: input.personName,
    sourceBatchNo: input.sourceBatchNo,
    sourceRecordNos: input.sourceRecordNos,
    taxIdentityType: '居民个人',
    taxPeriod: input.taxPeriod,
    withholdingMethod: '按次预扣法'
  };
}

export function buildExpenseReimbursementPaymentSnapshot(input: {
  amount: number;
  paymentFactId: string;
  personId: string;
  personName: string;
  sourceRecordNo: string;
  taxPeriod: string;
}): NaturalPersonPaymentSnapshot {
  const amount = roundMoney(Math.max(0, input.amount));

  return {
    deductibleExpenseAmount: 0,
    grossIncomeAmount: amount,
    incomeType: '费用返还',
    netPaymentAmount: amount,
    paymentFactId: input.paymentFactId,
    personId: input.personId,
    personName: input.personName,
    sourceBatchNo: input.sourceRecordNo,
    sourceRecordNos: [input.sourceRecordNo],
    taxIdentityType: '居民个人',
    taxPeriod: input.taxPeriod,
    taxableIncomeAmount: 0,
    withheldTaxAmount: 0,
    withholdingMethod: '不计入个人所得'
  };
}

export function getFullyReversedFinanceTransactionNos(financeRows: FinanceTransactionRecord[]) {
  const postedAmountsByOrigin = new Map<string, number>();

  for (const row of financeRows) {
    const originTransactionNo = row.adjustmentContext?.originTransactionNo;
    if (row.status !== '已入账' || row.adjustmentContext?.mode !== '冲正' || !originTransactionNo) {
      continue;
    }

    postedAmountsByOrigin.set(
      originTransactionNo,
      roundMoney((postedAmountsByOrigin.get(originTransactionNo) ?? 0) + Math.abs(row.amount))
    );
  }

  return new Set(
    financeRows
      .filter((row) => {
        const reversedAmount = postedAmountsByOrigin.get(row.transactionNo) ?? 0;
        return reversedAmount > 0 && reversedAmount + 0.009 >= Math.abs(row.amount);
      })
      .map((row) => row.transactionNo)
  );
}

export function buildSalaryNaturalPersonPaymentFact(payment: SalaryPaymentRecord): NaturalPersonPaymentFact {
  const taxRecord = payment.personalIncomeTaxRecord;

  return {
    deductibleExpenseAmount: roundMoney(
      (taxRecord?.basicDeductionAmount ?? 0)
      + (taxRecord?.currentSpecialDeductionAmount ?? 0)
      + (taxRecord?.currentAdditionalDeductionAmount ?? 0)
      + (taxRecord?.currentOtherDeductionAmount ?? 0)
    ),
    financeTransactionNo: payment.financeTransactionNo,
    grossIncomeAmount: roundMoney(payment.settlementSnapshot.taxableIncomeAmount),
    incomeType: '工资薪金',
    identityNo: payment.identityNo,
    netPaymentAmount: roundMoney(payment.settlementSnapshot.employeeNetPayableAmount),
    occurredAt: payment.paidAt,
    paymentFactId: `salary:${payment.payrollNo}:${payment.employeeNo}`,
    personId: payment.employeeNo,
    personName: payment.employeeName,
    sourceBatchNo: payment.payrollNo,
    sourceModule: '薪酬明细',
    status: payment.paymentEvidenceStatus,
    taxIdentityType: '居民个人',
    taxPeriod: payment.taxPeriod,
    taxableIncomeAmount: roundMoney(taxRecord?.currentTaxableIncomeAmount ?? 0),
    withheldTaxAmount: roundMoney(payment.settlementSnapshot.withheldPersonalIncomeTaxAmount),
    withholdingMethod: '累计预扣法'
  };
}

export function buildNaturalPersonPaymentFacts(
  salaryPayments: SalaryPaymentRecord[],
  financeRows: FinanceTransactionRecord[]
): NaturalPersonPaymentFact[] {
  const reversedOriginNos = getFullyReversedFinanceTransactionNos(financeRows);
  const salaryFacts = salaryPayments
    .filter((payment) => !payment.financeTransactionNo || !reversedOriginNos.has(payment.financeTransactionNo))
    .map(buildSalaryNaturalPersonPaymentFact);
  const laborFacts = financeRows
    .filter(
      (row) =>
        row.status === '已入账'
        && row.naturalPersonPayment?.incomeType === '劳务报酬'
        && !reversedOriginNos.has(row.transactionNo)
    )
    .map((row): NaturalPersonPaymentFact => ({
      ...row.naturalPersonPayment!,
      financeTransactionNo: row.transactionNo,
      occurredAt: row.occurredAt,
      sourceModule: '应收应付',
      status: row.voucherStatus === '已上传' ? '已核验' : '待核验'
    }));

  return [...salaryFacts, ...laborFacts];
}

export function getUnrepresentedPostedNaturalPersonPayments(
  salaryPayments: SalaryPaymentRecord[],
  financeRows: FinanceTransactionRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[] = []
) {
  const reversedOriginNos = getFullyReversedFinanceTransactionNos(financeRows);
  const representedTransactionNos = new Set(
    buildNaturalPersonPaymentFacts(salaryPayments, financeRows)
      .map((fact) => fact.financeTransactionNo)
      .filter((transactionNo): transactionNo is string => Boolean(transactionNo))
  );
  const naturalPersonPayableNos = new Set(
    receivablePayableRows
      .filter((record) => record.naturalPersonPayment?.incomeType === '劳务报酬')
      .flatMap((record) => [record.documentNo, record.sourceNo])
  );

  return financeRows.filter(
    (row) =>
      row.status === '已入账'
      && (
        row.sourceType === '薪酬发放'
        || row.naturalPersonPayment?.incomeType === '劳务报酬'
        || naturalPersonPayableNos.has(row.sourceNo)
      )
      && !reversedOriginNos.has(row.transactionNo)
      && !representedTransactionNos.has(row.transactionNo)
  );
}

export function isPostedNaturalPersonPaymentCandidate(
  row: FinanceTransactionRecord,
  receivablePayableRows: FinanceReceivablePayableRecord[] = []
) {
  if (row.status !== '已入账') {
    return false;
  }

  if (row.sourceType === '薪酬发放' || row.naturalPersonPayment?.incomeType === '劳务报酬') {
    return true;
  }

  return receivablePayableRows.some(
    (record) =>
      record.naturalPersonPayment?.incomeType === '劳务报酬'
      && (row.sourceNo === record.documentNo || row.sourceNo === record.sourceNo)
  );
}
