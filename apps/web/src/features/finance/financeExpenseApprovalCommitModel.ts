import type { SalaryAdjustmentRecord } from '../salary/salaryDomain';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';

export type FinanceExpenseApprovalPlan = {
  payableRecord?: FinanceReceivablePayableRecord;
  salaryAdjustment?: SalaryAdjustmentRecord;
};

export type FinanceExpenseApprovalCommitSnapshot = {
  payableRows: FinanceReceivablePayableRecord[];
  salaryAdjustments: SalaryAdjustmentRecord[];
};

export type FinanceExpenseApprovalReversalResult = {
  payableRows: FinanceReceivablePayableRecord[];
  salaryAdjustmentToVoid?: SalaryAdjustmentRecord;
};

export function buildFinanceExpenseApprovalCommit({
  isSalaryAdjustmentPeriodOpen,
  isAccountingPeriodOpen,
  plan,
  snapshot
}: {
  isSalaryAdjustmentPeriodOpen: (record: SalaryAdjustmentRecord) => boolean;
  isAccountingPeriodOpen: (accountingPeriod: string) => boolean;
  plan: FinanceExpenseApprovalPlan;
  snapshot: FinanceExpenseApprovalCommitSnapshot;
}): FinanceExpenseApprovalCommitSnapshot {
  const { payableRecord, salaryAdjustment } = plan;

  if (payableRecord && !isAccountingPeriodOpen(payableRecord.accountingPeriod)) {
    throw new Error('报销所属会计期间已锁定');
  }

  if (
    payableRecord
    && snapshot.payableRows.some(
      (record) => record.documentNo === payableRecord.documentNo || record.sourceNo === payableRecord.sourceNo
    )
  ) {
    throw new Error('该报销来源已生成应付事项');
  }

  if (
    salaryAdjustment
    && snapshot.salaryAdjustments.some((record) => record.id === salaryAdjustment.id)
  ) {
    throw new Error('该报销来源已转入薪酬计税');
  }

  if (salaryAdjustment && !isSalaryAdjustmentPeriodOpen(salaryAdjustment)) {
    throw new Error('目标薪酬月份已发放');
  }

  return {
    payableRows: payableRecord ? [payableRecord, ...snapshot.payableRows] : snapshot.payableRows,
    salaryAdjustments: salaryAdjustment
      ? [salaryAdjustment, ...snapshot.salaryAdjustments]
      : snapshot.salaryAdjustments
  };
}

export function buildFinanceExpenseApprovalReversal({
  actor,
  hasActiveSettlement,
  isAccountingPeriodOpen,
  isPayableBooked,
  isSalaryAdjustmentPeriodOpen,
  occurredAt,
  payableRows,
  reason,
  salaryAdjustmentId,
  salaryAdjustments,
  sourceCode
}: {
  actor: string;
  hasActiveSettlement: (record: FinanceReceivablePayableRecord) => boolean;
  isAccountingPeriodOpen: (accountingPeriod: string) => boolean;
  isPayableBooked: (record: FinanceReceivablePayableRecord) => boolean;
  isSalaryAdjustmentPeriodOpen: (record: SalaryAdjustmentRecord) => boolean;
  occurredAt: string;
  payableRows: FinanceReceivablePayableRecord[];
  reason: string;
  salaryAdjustmentId?: string;
  salaryAdjustments: SalaryAdjustmentRecord[];
  sourceCode: string;
}): FinanceExpenseApprovalReversalResult {
  const payableRecord = payableRows.find(
    (record) => record.sourceType === '员工报销' && record.sourceNo === sourceCode
  );
  const salaryAdjustment = salaryAdjustmentId
    ? salaryAdjustments.find((record) => record.id === salaryAdjustmentId)
    : undefined;

  if (!reason.trim()) {
    throw new Error('撤销原因必填');
  }
  if (!payableRecord && !salaryAdjustment) {
    throw new Error('未找到可撤销的报销财务结果');
  }
  if (payableRecord && !isAccountingPeriodOpen(payableRecord.accountingPeriod)) {
    throw new Error(`${payableRecord.accountingPeriod} 已结账，不能直接撤销原报销`);
  }
  if (payableRecord && isPayableBooked(payableRecord)) {
    throw new Error('报销应付已经记账，不能直接撤销原审核');
  }
  if (payableRecord && hasActiveSettlement(payableRecord)) {
    throw new Error('报销应付已有收付款记录，不能直接撤销原审核');
  }
  if (salaryAdjustment && !isSalaryAdjustmentPeriodOpen(salaryAdjustment)) {
    throw new Error('转薪酬计税金额已经进入已发放薪酬，不能直接撤销');
  }

  return {
    payableRows: payableRecord
      ? payableRows.map((record) =>
          record.id === payableRecord.id
            ? {
                ...record,
                confirmationStatus: '已作废',
                note: [record.note, `撤销原因：${reason.trim()}`].filter(Boolean).join('；'),
                operationRecords: [
                  {
                    action: '撤销报销审核',
                    actor,
                    id: `rp-op-expense-revoke-${record.id}-${occurredAt}`,
                    object: record.documentNo,
                    summary: reason.trim(),
                    time: occurredAt
                  },
                  ...record.operationRecords
                ],
                updatedAt: occurredAt
              }
            : record
        )
      : payableRows,
    salaryAdjustmentToVoid: salaryAdjustment
  };
}

export function buildFinanceExpenseEvidenceSupplement({
  actor,
  file,
  hasActiveSettlement,
  isAccountingPeriodOpen,
  isPayableBooked,
  payableRows,
  sourceCode
}: {
  actor: string;
  file: RelatedFileRecord;
  hasActiveSettlement: (record: FinanceReceivablePayableRecord) => boolean;
  isAccountingPeriodOpen: (accountingPeriod: string) => boolean;
  isPayableBooked: (record: FinanceReceivablePayableRecord) => boolean;
  payableRows: FinanceReceivablePayableRecord[];
  sourceCode: string;
}) {
  const payableRecord = payableRows.find(
    (record) => record.sourceType === '员工报销' && record.sourceNo === sourceCode
  );

  if (!payableRecord) {
    return payableRows;
  }
  if (!isAccountingPeriodOpen(payableRecord.accountingPeriod)) {
    throw new Error('报销所属会计期间已结账，不能补充原事项凭证');
  }
  if (isPayableBooked(payableRecord)) {
    throw new Error('报销应付已经记账，不能补充原事项凭证');
  }
  if (hasActiveSettlement(payableRecord)) {
    throw new Error('报销应付已有收付款记录，不能补充原事项凭证');
  }

  return payableRows.map((record) =>
    record.id === payableRecord.id
      ? {
          ...record,
          files: [file, ...record.files.filter((currentFile) => currentFile.id !== file.id)],
          operationRecords: [
            {
              action: '补充报销凭证',
              actor,
              id: `rp-op-expense-evidence-${record.id}-${file.id}`,
              object: record.documentNo,
              summary: `补充凭证：${file.name}`,
              time: `${file.updatedAt} 09:00`
            },
            ...record.operationRecords
          ],
          updatedAt: `${file.updatedAt} 09:00`
        }
      : record
  );
}
