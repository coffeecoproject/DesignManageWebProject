import type { SalaryPaymentRecord } from '../salary/salaryDomain';
import { maskSalaryIitIdentityNo } from '../salary/salaryPersonalIncomeTaxModel';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  buildNaturalPersonPaymentFacts,
  getFullyReversedFinanceTransactionNos,
  getUnrepresentedPostedNaturalPersonPayments,
  isPostedNaturalPersonPaymentCandidate
} from './financeNaturalPersonPaymentModel';
import type { NaturalPersonIncomeType } from './naturalPersonPaymentTypes';

export type PayrollIitDeclarationSourceStatus = '待准备' | '待复核' | '已确认';

export type PayrollIitDeclarationSummary = {
  confirmedCount: number;
  currentAdditionalDeductionAmount: number;
  currentBasicDeductionAmount: number;
  currentIncomeAmount: number;
  currentOtherDeductionAmount: number;
  currentSpecialDeductionAmount: number;
  currentTaxableIncomeAmount: number;
  participantSummary: string;
  payableAmount: number;
  pendingCount: number;
  period: string;
  readyForConfirmation: boolean;
  reportCount: number;
  sourceStatus: PayrollIitDeclarationSourceStatus;
};

export type PayrollIitDeclarationEmployeeRow = {
  cumulativeAdditionalDeductionAmount: number;
  cumulativeBasicDeductionAmount: number;
  cumulativeIncomeAmount: number;
  cumulativeOtherDeductionAmount: number;
  cumulativeSpecialDeductionAmount: number;
  cumulativeTaxAmount: number;
  cumulativeTaxableIncomeAmount: number;
  currentAdditionalDeductionAmount: number;
  currentBasicDeductionAmount: number;
  currentIncomeAmount: number;
  currentOtherDeductionAmount: number;
  currentSpecialDeductionAmount: number;
  currentTaxableIncomeAmount: number;
  employeeName: string;
  employeeNo: string;
  grossSalary: number;
  id: string;
  identityNoMasked: string;
  incomeType: NaturalPersonIncomeType;
  includedInFiling: boolean;
  paidAt: string;
  paymentStatus: '已核验' | '待核验';
  payrollMonth: string;
  personalIncomeTaxAmount: number;
  position: string;
  priorWithheldTaxAmount: number;
  quickDeductionAmount: number;
  sourceBatchNo: string;
  sourceTransactionNos?: string[];
  taxRate: number;
};

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

export function buildPayrollIitDeclarationEmployeeRows(
  payments: SalaryPaymentRecord[],
  period: string,
  financeRows?: FinanceTransactionRecord[]
): PayrollIitDeclarationEmployeeRow[] {
  const employeePayments = new Map<string, SalaryPaymentRecord[]>();
  const reversedTransactionNos = financeRows
    ? getFullyReversedFinanceTransactionNos(financeRows)
    : new Set<string>();

  payments
    .filter(
      (payment) =>
        payment.taxPeriod === period
        && (!payment.financeTransactionNo || !reversedTransactionNos.has(payment.financeTransactionNo))
    )
    .forEach((payment) => {
      employeePayments.set(payment.employeeNo, [...(employeePayments.get(payment.employeeNo) ?? []), payment]);
    });

  const salaryRows = Array.from(employeePayments.values()).map((currentPayments): PayrollIitDeclarationEmployeeRow => {
    const sortedPayments = [...currentPayments].sort(
      (left, right) => left.paidAt.localeCompare(right.paidAt) || left.id.localeCompare(right.id)
    );
    const latestPayment = sortedPayments[sortedPayments.length - 1];
    const earliestPayment = sortedPayments[0];
    const latestTaxRecord = latestPayment.personalIncomeTaxRecord;
    const earliestTaxRecord = earliestPayment.personalIncomeTaxRecord;
    const paymentEvidenceReady = sortedPayments.every((payment) => {
      if (
        payment.paymentEvidenceStatus !== '已核验' ||
        !payment.financeTransactionNo ||
        !payment.identityNo ||
        !payment.personalIncomeTaxRecord
      ) {
        return false;
      }

      if (!financeRows) {
        return true;
      }

      return financeRows.some(
        (financeRow) =>
          financeRow.transactionNo === payment.financeTransactionNo &&
          financeRow.sourceType === '薪酬发放' &&
          financeRow.sourceNo === payment.payrollNo &&
          financeRow.status === '已入账' &&
          financeRow.occurredAt.slice(0, 7) === period &&
          Math.abs(financeRow.amount - payment.settlementSnapshot.employeeNetPayableAmount) < 0.01
      );
    });
    const sumTaxRecordField = (
      selector: (record: NonNullable<SalaryPaymentRecord['personalIncomeTaxRecord']>) => number
    ) =>
      roundMoney(
        sortedPayments.reduce(
          (total, payment) => total + (payment.personalIncomeTaxRecord ? selector(payment.personalIncomeTaxRecord) : 0),
          0
        )
      );

    return {
      cumulativeAdditionalDeductionAmount: latestTaxRecord?.cumulativeAdditionalDeductionAmount ?? 0,
      cumulativeBasicDeductionAmount: latestTaxRecord?.cumulativeBasicDeductionAmount ?? 0,
      cumulativeIncomeAmount: latestTaxRecord?.cumulativeIncomeAmount ?? 0,
      cumulativeOtherDeductionAmount: latestTaxRecord?.cumulativeOtherDeductionAmount ?? 0,
      cumulativeSpecialDeductionAmount: latestTaxRecord?.cumulativeSpecialDeductionAmount ?? 0,
      cumulativeTaxAmount: latestTaxRecord?.cumulativeTaxAmount ?? 0,
      cumulativeTaxableIncomeAmount: latestTaxRecord?.cumulativeTaxableIncomeAmount ?? 0,
      currentAdditionalDeductionAmount: sumTaxRecordField((record) => record.currentAdditionalDeductionAmount),
      currentBasicDeductionAmount: sumTaxRecordField((record) => record.basicDeductionAmount),
      currentIncomeAmount: sumTaxRecordField((record) => record.currentIncomeAmount),
      currentOtherDeductionAmount: sumTaxRecordField((record) => record.currentOtherDeductionAmount),
      currentSpecialDeductionAmount: sumTaxRecordField((record) => record.currentSpecialDeductionAmount),
      currentTaxableIncomeAmount: sumTaxRecordField((record) => record.currentTaxableIncomeAmount),
      employeeName: latestPayment.employeeName,
      employeeNo: latestPayment.employeeNo,
      grossSalary: roundMoney(
        sortedPayments.reduce((total, payment) => total + payment.settlementSnapshot.taxableIncomeAmount, 0)
      ),
      id: `iit-declaration-${period}-${latestPayment.employeeNo}`,
      identityNoMasked: maskSalaryIitIdentityNo(latestPayment.identityNo),
      incomeType: '工资薪金' as const,
      includedInFiling: paymentEvidenceReady,
      paidAt: latestPayment.paidAt,
      paymentStatus: paymentEvidenceReady ? '已核验' : '待核验',
      payrollMonth: Array.from(new Set(sortedPayments.map((payment) => payment.payrollMonth))).sort().join('、'),
      personalIncomeTaxAmount: roundMoney(
        sortedPayments.reduce(
          (total, payment) => total + payment.settlementSnapshot.withheldPersonalIncomeTaxAmount,
          0
        )
      ),
      position: latestPayment.position,
      priorWithheldTaxAmount: earliestTaxRecord?.priorWithheldTaxAmount ?? 0,
      quickDeductionAmount: latestTaxRecord?.quickDeductionAmount ?? 0,
      sourceBatchNo: latestPayment.payrollNo,
      sourceTransactionNos: sortedPayments
        .map((payment) => payment.financeTransactionNo)
        .filter((transactionNo): transactionNo is string => Boolean(transactionNo))
        .sort(),
      taxRate: latestTaxRecord?.taxRate ?? 0
    };
  });
  const laborRows = financeRows
    ? buildNaturalPersonPaymentFacts(payments, financeRows)
        .filter((fact) => fact.taxPeriod === period && fact.incomeType === '劳务报酬')
        .map((fact): PayrollIitDeclarationEmployeeRow => {
          const paymentEvidenceReady = fact.status === '已核验' && Boolean(fact.identityNo);
          const bracket = fact.taxableIncomeAmount <= 20000
            ? { quickDeductionAmount: 0, taxRate: 0.2 }
            : fact.taxableIncomeAmount <= 50000
              ? { quickDeductionAmount: 2000, taxRate: 0.3 }
              : { quickDeductionAmount: 7000, taxRate: 0.4 };

          return {
            cumulativeAdditionalDeductionAmount: 0,
            cumulativeBasicDeductionAmount: 0,
            cumulativeIncomeAmount: fact.grossIncomeAmount,
            cumulativeOtherDeductionAmount: 0,
            cumulativeSpecialDeductionAmount: 0,
            cumulativeTaxAmount: fact.withheldTaxAmount,
            cumulativeTaxableIncomeAmount: fact.taxableIncomeAmount,
            currentAdditionalDeductionAmount: 0,
            currentBasicDeductionAmount: fact.deductibleExpenseAmount,
            currentIncomeAmount: fact.grossIncomeAmount,
            currentOtherDeductionAmount: 0,
            currentSpecialDeductionAmount: 0,
            currentTaxableIncomeAmount: fact.taxableIncomeAmount,
            employeeName: fact.personName,
            employeeNo: fact.personId,
            grossSalary: fact.grossIncomeAmount,
            id: `iit-declaration-${period}-${fact.paymentFactId}`,
            identityNoMasked: maskSalaryIitIdentityNo(fact.identityNo),
            includedInFiling: paymentEvidenceReady,
            incomeType: '劳务报酬',
            paidAt: fact.occurredAt,
            paymentStatus: paymentEvidenceReady ? '已核验' : '待核验',
            payrollMonth: fact.taxPeriod,
            personalIncomeTaxAmount: fact.withheldTaxAmount,
            position: '兼职劳务',
            priorWithheldTaxAmount: 0,
            quickDeductionAmount: bracket.quickDeductionAmount,
            sourceBatchNo: fact.sourceBatchNo,
            sourceTransactionNos: fact.financeTransactionNo ? [fact.financeTransactionNo] : [],
            taxRate: bracket.taxRate
          };
        })
    : [];

  return [...salaryRows, ...laborRows];
}

export function buildPayrollIitDeclarationSummary(
  payments: SalaryPaymentRecord[],
  period: string,
  financeRows?: FinanceTransactionRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[] = []
): PayrollIitDeclarationSummary {
  const employeeRows = buildPayrollIitDeclarationEmployeeRows(payments, period, financeRows);
  const includedRows = employeeRows.filter((row) => row.includedInFiling);
  const unmatchedFinanceRows = financeRows
    ? getUnrepresentedPostedNaturalPersonPayments(payments, financeRows, receivablePayableRows)
        .filter((row) => row.occurredAt.slice(0, 7) === period).length
    : 0;
  const pendingCount = employeeRows.filter((row) => !row.includedInFiling).length + unmatchedFinanceRows;
  const readyForConfirmation = employeeRows.length > 0 && pendingCount === 0;
  const participantCount = new Set(employeeRows.map((row) => row.employeeNo)).size;
  const confirmedParticipantCount = new Set(
    includedRows.map((row) => row.employeeNo)
  ).size;

  return {
    confirmedCount: confirmedParticipantCount,
    currentAdditionalDeductionAmount: roundMoney(includedRows.reduce((total, row) => total + row.currentAdditionalDeductionAmount, 0)),
    currentBasicDeductionAmount: roundMoney(includedRows.reduce((total, row) => total + row.currentBasicDeductionAmount, 0)),
    currentIncomeAmount: roundMoney(includedRows.reduce((total, row) => total + row.currentIncomeAmount, 0)),
    currentOtherDeductionAmount: roundMoney(includedRows.reduce((total, row) => total + row.currentOtherDeductionAmount, 0)),
    currentSpecialDeductionAmount: roundMoney(includedRows.reduce((total, row) => total + row.currentSpecialDeductionAmount, 0)),
    currentTaxableIncomeAmount: roundMoney(includedRows.reduce((total, row) => total + row.currentTaxableIncomeAmount, 0)),
    participantSummary: participantCount > 0 ? `${confirmedParticipantCount}/${participantCount} 人` : '待生成',
    payableAmount: roundMoney(includedRows.reduce((total, row) => total + row.personalIncomeTaxAmount, 0)),
    pendingCount,
    period,
    readyForConfirmation,
    reportCount: participantCount,
    sourceStatus: readyForConfirmation ? '已确认' : employeeRows.length > 0 ? '待复核' : '待准备'
  };
}

export function buildPayrollIitDeclarationSourceSnapshotKey(
  payments: SalaryPaymentRecord[],
  period: string,
  financeRows: FinanceTransactionRecord[] = [],
  receivablePayableRows: FinanceReceivablePayableRecord[] = []
) {
  const paymentKey = payments
    .filter((payment) => payment.taxPeriod === period)
    .map((payment) => [
      payment.id,
      payment.employeeNo,
      payment.employeeName,
      payment.identityNo,
      payment.paidAt,
      payment.payrollMonth,
      payment.settlementSnapshot.taxableIncomeAmount,
      payment.settlementSnapshot.employeeNetPayableAmount,
      payment.settlementSnapshot.withheldPersonalIncomeTaxAmount,
      payment.paymentEvidenceStatus,
      payment.financeTransactionNo ?? '',
      ...[payment.personalIncomeTaxRecord].flatMap((record) => record ? [
        record.currentIncomeAmount,
        record.basicDeductionAmount,
        record.currentSpecialDeductionAmount,
        record.currentAdditionalDeductionAmount,
        record.currentOtherDeductionAmount,
        record.currentTaxableIncomeAmount,
        record.cumulativeIncomeAmount,
        record.cumulativeBasicDeductionAmount,
        record.cumulativeSpecialDeductionAmount,
        record.cumulativeAdditionalDeductionAmount,
        record.cumulativeOtherDeductionAmount,
        record.cumulativeTaxableIncomeAmount,
        record.priorWithheldTaxAmount,
        record.cumulativeTaxAmount,
        record.taxRate,
        record.quickDeductionAmount
      ] : [])
    ].join(':'))
    .sort()
    .join('|');
  const sourceRows = financeRows.filter((row) => {
    if (!isPostedNaturalPersonPaymentCandidate(row, receivablePayableRows)) {
      return false;
    }

    return row.naturalPersonPayment?.incomeType === '劳务报酬'
      ? row.naturalPersonPayment.taxPeriod === period
      : row.occurredAt.slice(0, 7) === period;
  });
  const sourceTransactionNos = new Set(sourceRows.map((row) => row.transactionNo));
  const reversalRows = financeRows.filter(
    (row) =>
      row.status === '已入账'
      && row.adjustmentContext?.mode === '冲正'
      && sourceTransactionNos.has(row.adjustmentContext.originTransactionNo)
  );
  const financeKey = [...sourceRows, ...reversalRows]
    .map((row) => [
      row.transactionNo,
      row.sourceNo,
      row.amount,
      row.occurredAt,
      row.status,
      row.adjustmentContext?.mode ?? '',
      row.adjustmentContext?.originTransactionNo ?? '',
      row.naturalPersonPayment?.paymentFactId ?? '',
      row.naturalPersonPayment?.personId ?? '',
      row.naturalPersonPayment?.personName ?? '',
      row.naturalPersonPayment?.identityNo ?? '',
      row.naturalPersonPayment?.grossIncomeAmount ?? '',
      row.naturalPersonPayment?.deductibleExpenseAmount ?? '',
      row.naturalPersonPayment?.taxableIncomeAmount ?? '',
      row.naturalPersonPayment?.withheldTaxAmount ?? '',
      row.naturalPersonPayment?.netPaymentAmount ?? ''
    ].join(':'))
    .sort()
    .join('|');

  return `${paymentKey}::${financeKey}`;
}
