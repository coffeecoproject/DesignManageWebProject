import type { SalaryPaymentRecord } from '../salary/salaryDomain';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceDeclarationPreparationRecord } from './financeDeclarationPreparationData';
import {
  buildPayrollIitDeclarationEmployeeRows,
  buildPayrollIitDeclarationSourceSnapshotKey,
  buildPayrollIitDeclarationSummary
} from './financePayrollIitDeclarationModel';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import type { FinanceTaxMatterRecord } from './financeTaxFilingData';
import { startTaxMatterDeclarationRevision } from './financeTaxMatterModel';

export type PayrollIitCorrectionWorkflowState = {
  declarationPreparationRows: FinanceDeclarationPreparationRecord[];
  financeRows: FinanceTransactionRecord[];
  receivablePayableRows: FinanceReceivablePayableRecord[];
  salaryPaymentRecords: SalaryPaymentRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
};

export type PayrollIitCorrectionWorkflowResult =
  | ({ correctionCreated: boolean; success: true } & PayrollIitCorrectionWorkflowState)
  | { message: string; success: false };

type PayrollIitCorrectionWorkflowInput = {
  actor: string;
  occurredAt: string;
  transactionId: string;
};

export function finalizePayrollIitCorrectionPreparation(
  preparation: FinanceDeclarationPreparationRecord,
  taxMatter: FinanceTaxMatterRecord,
  actor: string,
  occurredAt: string
) {
  const correction = preparation.pendingIitCorrection;

  if (
    preparation.taxType !== '个人所得税'
    || taxMatter.matterType !== '个人所得税'
    || taxMatter.declarationVersion <= 1
    || !['申报成功', '零申报'].includes(taxMatter.declarationStatus)
    || !correction
  ) {
    return preparation;
  }

  return {
    ...preparation,
    confirmedIitEmployeeRows: correction.employeeRows,
    confirmedIitSummary: correction.summary,
    confirmedSourceSnapshotKey: correction.sourceSnapshotKey,
    iitEmployeeRows: correction.employeeRows,
    iitSummary: correction.summary,
    operationRecords: [
      {
        action: '确认申报更正',
        actor,
        id: `declaration-prep-op-iit-correction-filed-${taxMatter.id}-v${taxMatter.declarationVersion}`,
        object: preparation.preparationNo,
        summary: `${preparation.period} 个人所得税第 ${taxMatter.declarationVersion} 版申报结果已确认`,
        time: occurredAt
      },
      ...preparation.operationRecords
    ],
    pendingIitCorrection: undefined,
    sourceSnapshotKey: correction.sourceSnapshotKey,
    updatedAt: occurredAt.slice(0, 10)
  };
}

function wasPaymentIncludedInFiledPreparation(
  preparation: FinanceDeclarationPreparationRecord,
  originTransaction: FinanceTransactionRecord,
  salaryPayment?: SalaryPaymentRecord
) {
  const paymentSnapshot = originTransaction.naturalPersonPayment;

  if (paymentSnapshot?.incomeType === '劳务报酬') {
    return (preparation.confirmedIitEmployeeRows ?? []).some((row) =>
      row.incomeType === '劳务报酬'
      && (
        row.sourceTransactionNos?.includes(originTransaction.transactionNo)
        || (
          row.sourceBatchNo === paymentSnapshot.sourceBatchNo
          && row.employeeNo === paymentSnapshot.personId
        )
      )
    );
  }

  if (!salaryPayment || originTransaction.sourceType !== '薪酬发放') {
    return false;
  }

  return (preparation.confirmedIitEmployeeRows ?? []).some((row) =>
    row.incomeType === '工资薪金'
    && (
      row.sourceTransactionNos?.includes(originTransaction.transactionNo)
      || (row.sourceBatchNo === salaryPayment.payrollNo && row.employeeNo === salaryPayment.employeeNo)
    )
  );
}

export function commitPayrollIitCorrectionAfterPostedReversal(
  state: PayrollIitCorrectionWorkflowState,
  input: PayrollIitCorrectionWorkflowInput
): PayrollIitCorrectionWorkflowResult {
  const reversalTransaction = state.financeRows.find((row) => row.id === input.transactionId);
  const originTransaction = reversalTransaction?.adjustmentContext?.originTransactionNo
    ? state.financeRows.find(
        (row) => row.transactionNo === reversalTransaction.adjustmentContext?.originTransactionNo
      )
    : undefined;

  if (
    !reversalTransaction
    || reversalTransaction.status !== '已入账'
    || reversalTransaction.adjustmentContext?.mode !== '冲正'
    || !originTransaction
  ) {
    return { ...state, correctionCreated: false, success: true };
  }

  const salaryPayment = originTransaction.sourceType === '薪酬发放'
    ? state.salaryPaymentRecords.find(
        (payment) =>
          payment.financeTransactionNo === originTransaction.transactionNo
          || payment.payrollNo === originTransaction.sourceNo
      )
    : undefined;
  const incomeType = originTransaction.naturalPersonPayment?.incomeType === '劳务报酬'
    ? '劳务报酬'
    : salaryPayment
      ? '工资薪金'
      : undefined;
  const taxPeriod = originTransaction.naturalPersonPayment?.incomeType === '劳务报酬'
    ? originTransaction.naturalPersonPayment.taxPeriod
    : salaryPayment?.taxPeriod;

  if (!incomeType || !taxPeriod) {
    return { ...state, correctionCreated: false, success: true };
  }

  const preparation = state.declarationPreparationRows.find(
    (record) =>
      record.taxType === '个人所得税'
      && record.declarationScenario === '月度扣缴'
      && record.period === taxPeriod
      && record.status === '已进入税务办理'
  );

  if (!preparation || !wasPaymentIncludedInFiledPreparation(preparation, originTransaction, salaryPayment)) {
    return { ...state, correctionCreated: false, success: true };
  }

  const currentEmployeeRows = buildPayrollIitDeclarationEmployeeRows(
    state.salaryPaymentRecords,
    taxPeriod,
    state.financeRows
  );
  const currentSummary = buildPayrollIitDeclarationSummary(
    state.salaryPaymentRecords,
    taxPeriod,
    state.financeRows,
    state.receivablePayableRows
  );
  const currentSourceSnapshotKey = `${preparation.id}:${buildPayrollIitDeclarationSourceSnapshotKey(
    state.salaryPaymentRecords,
    taxPeriod,
    state.financeRows,
    state.receivablePayableRows
  )}`;

  if (preparation.pendingIitCorrection?.sourceSnapshotKey === currentSourceSnapshotKey) {
    return { ...state, correctionCreated: false, success: true };
  }

  const taxMatter = state.taxMatterRows.find(
    (record) =>
      record.matterType === '个人所得税'
      && record.declarationScenario === '月度扣缴'
      && record.period === taxPeriod
  );

  if (!taxMatter) {
    return { message: `${taxPeriod} 个人所得税已申报，但缺少对应税务办理事项`, success: false };
  }

  if (
    !['申报成功', '零申报'].includes(taxMatter.declarationStatus)
    && !(taxMatter.declarationStatus === '待申报' && taxMatter.declarationVersion > 1)
  ) {
    return { message: `${taxPeriod} 个人所得税办理状态不支持自动发起更正`, success: false };
  }

  const reason = `${incomeType}付款 ${originTransaction.transactionNo} 已由 ${reversalTransaction.transactionNo} 冲正，需更正 ${taxPeriod} 个人所得税申报`;
  const pendingIitCorrection = {
    createdAt: input.occurredAt,
    employeeRows: currentEmployeeRows,
    reason,
    sourceSnapshotKey: currentSourceSnapshotKey,
    sourceTransactionNos: [originTransaction.transactionNo, reversalTransaction.transactionNo],
    summary: currentSummary
  };
  const nextPreparation: FinanceDeclarationPreparationRecord = {
    ...preparation,
    operationRecords: preparation.operationRecords.some(
      (record) => record.id === `declaration-prep-op-iit-correction-${reversalTransaction.transactionNo}`
    )
      ? preparation.operationRecords
      : [
          {
            action: '识别申报更正',
            actor: input.actor,
            id: `declaration-prep-op-iit-correction-${reversalTransaction.transactionNo}`,
            object: preparation.preparationNo,
            summary: reason,
            time: input.occurredAt
          },
          ...preparation.operationRecords
        ],
    pendingIitCorrection,
    updatedAt: input.occurredAt.slice(0, 10)
  };
  const preparedTaxMatter: FinanceTaxMatterRecord = {
    ...taxMatter,
    dataStatus: '已确认',
    participantSummary: currentSummary.reportCount > 0 ? currentSummary.participantSummary : '0 人',
    payableAmount: currentSummary.payableAmount,
    preparedPayableAmount: currentSummary.payableAmount,
    sourceItems: taxMatter.sourceItems.map((item) =>
      item.name === '办理依据'
        ? { ...item, status: '已确认', updatedAt: input.occurredAt.slice(0, 10) }
        : item
    )
  };
  const nextTaxMatter = taxMatter.declarationStatus === '待申报'
    ? {
        ...preparedTaxMatter,
        operationRecords: taxMatter.operationRecords.some(
          (record) => record.id === `tax-op-correction-source-${reversalTransaction.transactionNo}`
        )
          ? taxMatter.operationRecords
          : [
              {
                action: '更新更正数据',
                actor: input.actor,
                id: `tax-op-correction-source-${reversalTransaction.transactionNo}`,
                object: taxMatter.matterNo,
                summary: reason,
                time: input.occurredAt
              },
              ...taxMatter.operationRecords
            ],
        updatedAt: input.occurredAt.slice(0, 10)
      }
    : {
        ...startTaxMatterDeclarationRevision(taxMatter, '更正', reason, {
          historyId: `tax-declaration-history-${taxMatter.id}-${taxMatter.declarationVersion}`,
          operatedAt: input.occurredAt,
          operatedBy: input.actor,
          operationId: `tax-op-revision-${taxMatter.id}-${reversalTransaction.transactionNo}`
        }),
        dataStatus: preparedTaxMatter.dataStatus,
        participantSummary: preparedTaxMatter.participantSummary,
        payableAmount: preparedTaxMatter.payableAmount,
        preparedPayableAmount: preparedTaxMatter.preparedPayableAmount,
        sourceItems: preparedTaxMatter.sourceItems,
        updatedAt: input.occurredAt.slice(0, 10)
      };

  return {
    correctionCreated: true,
    declarationPreparationRows: state.declarationPreparationRows.map((record) =>
      record.id === preparation.id ? nextPreparation : record
    ),
    financeRows: state.financeRows,
    receivablePayableRows: state.receivablePayableRows,
    salaryPaymentRecords: state.salaryPaymentRecords,
    success: true,
    taxMatterRows: state.taxMatterRows.map((record) =>
      record.id === taxMatter.id ? nextTaxMatter : record
    )
  };
}
