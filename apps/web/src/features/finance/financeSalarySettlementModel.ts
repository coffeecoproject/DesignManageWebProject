import type { PeopleMember } from '../people/peopleTypes';
import {
  getSalaryScheduledPaymentDate,
  type SalaryMonthlyWorkflowRecord,
  type SalaryPaymentRecord,
  type SalarySettlementSnapshot
} from '../salary/salaryDomain';
import { getFinanceCategorySnapshot, type FinanceCategorySnapshot } from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { getDefaultReceivablePayableTaxBasis } from './financeTaxBasisModel';
import { formatMoney } from './financeUtils';

export type SalarySettlementSource = {
  employeeName: string;
  employeeNo: string;
  payment?: SalaryPaymentRecord;
  settlementSnapshot: SalarySettlementSnapshot;
  workflow?: SalaryMonthlyWorkflowRecord;
};

function getMonthEndDate(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, '0')}`;
}

function buildSalarySettlementSourceKey(employeeNo: string, payrollMonth: string) {
  return `${payrollMonth}:${employeeNo}`;
}

function collectSalarySettlementSources({
  payments,
  people,
  workflows
}: {
  payments: readonly SalaryPaymentRecord[];
  people: readonly PeopleMember[];
  workflows: readonly SalaryMonthlyWorkflowRecord[];
}) {
  const sources = new Map<string, SalarySettlementSource>();

  workflows
    .filter((workflow) => ['已确认', '已发放'].includes(workflow.status) && workflow.settlementSnapshot)
    .forEach((workflow) => {
      const person = people.find((member) => member.id === workflow.memberId);
      if (!person || !workflow.settlementSnapshot) {
        return;
      }

      sources.set(buildSalarySettlementSourceKey(workflow.memberId, workflow.month), {
        employeeName: person.name,
        employeeNo: workflow.memberId,
        settlementSnapshot: workflow.settlementSnapshot,
        workflow
      });
    });

  payments.forEach((payment) => {
    const key = buildSalarySettlementSourceKey(payment.employeeNo, payment.payrollMonth);
    const existing = sources.get(key);
    sources.set(key, {
      employeeName: payment.employeeName,
      employeeNo: payment.employeeNo,
      payment,
      settlementSnapshot: payment.settlementSnapshot,
      workflow: existing?.workflow
    });
  });

  return Array.from(sources.values()).sort(
    (left, right) =>
      right.settlementSnapshot.payrollMonth.localeCompare(left.settlementSnapshot.payrollMonth)
      || left.employeeNo.localeCompare(right.employeeNo)
  );
}

export function buildSalaryReceivablePayableRecord(
  source: SalarySettlementSource,
  suppliedCategorySnapshot?: FinanceCategorySnapshot
): FinanceReceivablePayableRecord {
  const { employeeName, employeeNo, payment, settlementSnapshot, workflow } = source;
  const { payrollMonth, payrollNo } = settlementSnapshot;
  const category = '工资发放' as const;
  const categorySnapshot = suppliedCategorySnapshot ?? getFinanceCategorySnapshot(category);
  const confirmDate = workflow?.confirmedAt?.slice(0, 10) ?? getMonthEndDate(payrollMonth);
  const documentNo = `AP-${payrollMonth.replace('-', '')}-S-${employeeNo}`;
  const updatedAt = payment?.paidAt ?? workflow?.updatedAt ?? `${confirmDate} 18:00`;

  return {
    accountingPeriod: payrollMonth,
    amount: settlementSnapshot.employeeNetPayableAmount,
    category,
    categorySnapshot,
    confirmDate,
    confirmationStatus: '已确认',
    counterparty: employeeName,
    counterpartyId: employeeNo,
    counterpartyType: '员工',
    direction: '应付',
    documentNo,
    dueDate: getSalaryScheduledPaymentDate(payrollMonth),
    files: [
      {
        id: `${payrollNo}-salary-snapshot`,
        name: `${employeeName} ${payrollMonth} 薪酬确认记录`,
        status: '已归档',
        type: '薪酬确认',
        updatedAt: confirmDate
      }
    ],
    id: `ap-salary:${payrollNo}`,
    linkedTransactionNos: payment?.financeTransactionNo ? [payment.financeTransactionNo] : [],
    note: [
      `员工实发 ${formatMoney(settlementSnapshot.employeeNetPayableAmount)}`,
      `代扣个税 ${formatMoney(settlementSnapshot.withheldPersonalIncomeTaxAmount)}`,
      `个人社保 ${formatMoney(settlementSnapshot.employeeSocialInsuranceAmount)}`,
      `个人公积金 ${formatMoney(settlementSnapshot.employeeHousingFundAmount)}`
    ].join('；'),
    operationRecords: [
      {
        action: '生成应付',
        actor: '系统',
        id: `op-ap-salary:${payrollNo}`,
        object: documentNo,
        summary: `根据已确认薪酬生成员工实发应付 ${formatMoney(settlementSnapshot.employeeNetPayableAmount)}`,
        time: workflow?.confirmedAt ?? updatedAt
      }
    ],
    owner: workflow?.confirmedBy ?? payment?.paidBy ?? '系统',
    reportAggregation: categorySnapshot.reportAggregation,
    salarySettlement: settlementSnapshot,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: payrollNo,
    sourceTitle: `${employeeName} ${payrollMonth} 工资发放`,
    sourceType: '薪酬发放',
    taxBasis: getDefaultReceivablePayableTaxBasis({
      amount: settlementSnapshot.employeeNetPayableAmount,
      direction: '应付',
      sourceType: '薪酬发放'
    }),
    updatedAt
  };
}

export function mergeSalaryReceivablePayableRecords({
  payments,
  people,
  records,
  workflows,
  categorySnapshot
}: {
  payments: readonly SalaryPaymentRecord[];
  people: readonly PeopleMember[];
  records: FinanceReceivablePayableRecord[];
  workflows: readonly SalaryMonthlyWorkflowRecord[];
  categorySnapshot?: FinanceCategorySnapshot | null;
}) {
  const nonSalaryRecords = records.filter((record) => record.sourceType !== '薪酬发放');
  const existingSalaryRecords = records.filter((record) => record.sourceType === '薪酬发放');
  const newRecordCategorySnapshot = categorySnapshot === undefined
    ? getFinanceCategorySnapshot('工资发放')
    : categorySnapshot;
  if (!newRecordCategorySnapshot) {
    return records;
  }
  const existingSnapshotBySourceNo = new Map(
    existingSalaryRecords.map((record) => [record.sourceNo, record.categorySnapshot])
  );
  const salaryRecords = collectSalarySettlementSources({ payments, people, workflows })
    .map((source) => buildSalaryReceivablePayableRecord(
      source,
      existingSnapshotBySourceNo.get(source.settlementSnapshot.payrollNo) ?? newRecordCategorySnapshot
    ));

  return [...nonSalaryRecords, ...salaryRecords];
}
