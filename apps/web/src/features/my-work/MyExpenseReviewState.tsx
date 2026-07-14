import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { useFinanceManagement } from '../finance/FinanceManagementState';
import { financeToday, getAccountingPeriod } from '../finance/financeUtils';
import { useSalaryManagementState } from '../salary/SalaryManagementState';
import {
  buildMyWorkExpenseApprovalExecutionPlan,
  myWorkExpenseReviewSeedRecords,
  returnExpenseReviewRecord,
  revokeExpenseReviewRecord,
  supplementExpenseReviewEvidence,
  type MyWorkExpenseApprovalDecision,
  type MyWorkExpenseReviewRecord
} from './myWorkExpenseReviewModel';
import type { MyWorkExpenseVoucherComplianceConclusion } from './myWorkExpenseCollectionModel';

type ExpenseReviewStateResult = { reason?: string; success: boolean };

type MyExpenseReviewStateValue = {
  approveExpenseReview: (recordId: string, decision: MyWorkExpenseApprovalDecision) => ExpenseReviewStateResult;
  records: MyWorkExpenseReviewRecord[];
  returnExpenseReview: (recordId: string, reason: string, reviewerName: string) => ExpenseReviewStateResult;
  revokeExpenseReview: (recordId: string, reason: string, reviewerName: string) => ExpenseReviewStateResult;
  supplementExpenseEvidence: (
    recordId: string,
    file: RelatedFileRecord,
    voucherCompliance: Extract<
      MyWorkExpenseVoucherComplianceConclusion,
      '发票' | '财政票据或其他合法凭证' | '小额零星收款凭证'
    >,
    actor: string
  ) => ExpenseReviewStateResult;
};

const MyExpenseReviewContext = createContext<MyExpenseReviewStateValue | undefined>(undefined);

export function MyExpenseReviewProvider({ children }: { children: ReactNode }) {
  const {
    commitExpenseApprovalFinancialPlan,
    getAccountingPeriodGuard,
    receivablePayableRows,
    revokeExpenseApprovalFinancialPlan,
    supplementExpenseApprovalEvidence
  } = useFinanceManagement();
  const {
    salaryAdjustments,
    salaryMonthlyWorkflows,
    salaryPaymentRecords
  } = useSalaryManagementState();
  const [records, setRecords] = useState<MyWorkExpenseReviewRecord[]>(() => myWorkExpenseReviewSeedRecords);

  const value = useMemo<MyExpenseReviewStateValue>(() => ({
    approveExpenseReview(recordId, decision) {
      const record = records.find((currentRecord) => currentRecord.id === recordId);

      if (!record || record.reviewStatus !== '待审核') {
        return { reason: '当前报销不在待审核状态', success: false };
      }

      let executionPlan;
      try {
        executionPlan = buildMyWorkExpenseApprovalExecutionPlan({
          decision,
          existingPayableRows: receivablePayableRows,
          existingSalaryAdjustments: salaryAdjustments,
          record,
          salaryMonthState: {
            salaryMonthlyWorkflows,
            salaryPaymentRecords
          }
        });
      } catch (error) {
        return { reason: error instanceof Error ? error.message : '报销审核预检失败', success: false };
      }

      const periodGuard = executionPlan.payableRecord
        ? getAccountingPeriodGuard(executionPlan.payableRecord.accountingPeriod, '通过报销并生成应付事项')
        : getAccountingPeriodGuard(getAccountingPeriod(record.occurredAt), '通过费用报销审核');

      if (!periodGuard.allowed) {
        return { reason: periodGuard.reason, success: false };
      }
      if (!commitExpenseApprovalFinancialPlan(executionPlan)) {
        return { reason: '报销财务结果未提交', success: false };
      }

      setRecords((currentRecords) =>
        currentRecords.map((currentRecord) =>
          currentRecord.id === recordId ? executionPlan.approvedRecord : currentRecord
        )
      );
      return { success: true };
    },
    records,
    returnExpenseReview(recordId, reason, reviewerName) {
      const record = records.find((currentRecord) => currentRecord.id === recordId);

      if (!record || record.reviewStatus !== '待审核') {
        return { reason: '当前报销不在待审核状态', success: false };
      }
      const periodGuard = getAccountingPeriodGuard(getAccountingPeriod(record.occurredAt), '退回费用报销审核');

      if (!periodGuard.allowed) {
        return { reason: periodGuard.reason, success: false };
      }

      const nextRecord = returnExpenseReviewRecord(record, { returnedReason: reason, reviewerName });
      setRecords((currentRecords) =>
        currentRecords.map((currentRecord) => currentRecord.id === recordId ? nextRecord : currentRecord)
      );
      return { success: true };
    },
    revokeExpenseReview(recordId, reason, reviewerName) {
      const record = records.find((currentRecord) => currentRecord.id === recordId);

      if (!record || record.reviewStatus !== '已通过' || !record.expenseReviewResult) {
        return { reason: '当前报销没有可撤销的审核结果', success: false };
      }

      const hasFinancialResult =
        record.expenseReviewResult.businessReimbursementAmount > 0
        || record.expenseReviewResult.salaryTaxableAmount > 0;

      if (hasFinancialResult) {
        const reversal = revokeExpenseApprovalFinancialPlan({
          occurredAt: `${financeToday} 09:00`,
          reason,
          salaryAdjustmentId: record.expenseReviewResult.salaryTaxableAmount > 0
            ? `salary-expense-${record.code}`
            : undefined,
          sourceCode: record.code
        });

        if (!reversal.success) {
          return reversal;
        }
      }

      let nextRecord;
      try {
        nextRecord = revokeExpenseReviewRecord(record, { returnedReason: reason, reviewerName });
      } catch (error) {
        return { reason: error instanceof Error ? error.message : '撤销审核失败', success: false };
      }

      setRecords((currentRecords) =>
        currentRecords.map((currentRecord) => currentRecord.id === recordId ? nextRecord : currentRecord)
      );
      return { success: true };
    },
    supplementExpenseEvidence(recordId, file, voucherCompliance, actor) {
      const record = records.find((currentRecord) => currentRecord.id === recordId);

      if (!record) {
        return { reason: '未找到报销记录', success: false };
      }
      if (!supplementExpenseApprovalEvidence(record.code, file)) {
        return { reason: '报销已经付款、记账或所属期间已关闭，不能直接补充原凭证', success: false };
      }

      let nextRecord;
      try {
        nextRecord = supplementExpenseReviewEvidence(record, file, voucherCompliance, actor);
      } catch (error) {
        return { reason: error instanceof Error ? error.message : '补充报销凭证失败', success: false };
      }

      setRecords((currentRecords) =>
        currentRecords.map((currentRecord) => currentRecord.id === recordId ? nextRecord : currentRecord)
      );
      return { success: true };
    }
  }), [
    commitExpenseApprovalFinancialPlan,
    getAccountingPeriodGuard,
    receivablePayableRows,
    records,
    revokeExpenseApprovalFinancialPlan,
    salaryAdjustments,
    salaryMonthlyWorkflows,
    salaryPaymentRecords,
    supplementExpenseApprovalEvidence
  ]);

  return <MyExpenseReviewContext.Provider value={value}>{children}</MyExpenseReviewContext.Provider>;
}

export function useMyExpenseReviewState() {
  const value = useContext(MyExpenseReviewContext);

  if (!value) {
    throw new Error('useMyExpenseReviewState must be used within MyExpenseReviewProvider');
  }

  return value;
}
