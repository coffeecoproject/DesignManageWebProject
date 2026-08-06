import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  type FinanceCategorySnapshot,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig
} from '../finance/financeData';
import type { FinanceReceivablePayableRecord } from '../finance/financeReceivablesPayablesData';
import { getDefaultReceivablePayableTaxBasis } from '../finance/financeTaxBasisModel';
import { buildExpenseReimbursementPaymentSnapshot } from '../finance/financeNaturalPersonPaymentModel';
import {
  financeToday,
  formatMoney,
  getAccountingPeriod,
  getDefaultFinanceReviewDueAt
} from '../finance/financeUtils';
import type {
  SalaryAdjustmentRecord,
  SalaryMonthlyWorkflowRecord,
  SalaryPaymentRecord
} from '../salary/salaryDomain';
import {
  getMyWorkExpensePrimaryCategoryId,
  getMyWorkExpensePrimaryCategoryName,
  myWorkExpenseCollectionSeedRecords,
  type MyWorkExpenseCollectionRecord,
  type MyWorkExpenseEvidenceStatus,
  type MyWorkExpenseOriginalType,
  type MyWorkExpenseOverStandardNature,
  type MyWorkExpensePaymentMethod,
  type MyWorkExpenseReviewResult,
  type MyWorkExpenseAuthenticityConclusion,
  type MyWorkExpenseVoucherComplianceConclusion
} from './myWorkExpenseCollectionModel';

export type MyWorkExpenseReviewStatus = '待审核' | '需调整' | '已通过' | '已撤销';

export type MyWorkExpenseReviewRecord = {
  amount: number;
  category: string;
  categoryId: string;
  categorySnapshot: FinanceCategorySnapshot;
  code: string;
  dueAt: string;
  expenseReviewResult?: MyWorkExpenseReviewResult;
  files: RelatedFileRecord[];
  id: string;
  note: string;
  occurredAt: string;
  operationRecords: OperationRecord[];
  originalType: MyWorkExpenseOriginalType;
  paymentMethod: MyWorkExpensePaymentMethod;
  relatedTarget: string;
  reviewStatus: MyWorkExpenseReviewStatus;
  submittedAt: string;
  submitterId?: string;
  submitterName: string;
  title: string;
  updatedAt: string;
};

export type MyWorkExpenseReviewMetrics = {
  overdueCount: number;
  returnedCount: number;
  pendingCount: number;
};

export type MyWorkExpenseReviewDecision = {
  reviewerName: string;
  returnedReason?: string;
};

export type MyWorkExpenseApprovalDecision = Omit<MyWorkExpenseReviewResult, 'evidenceStatus' | 'reviewedAt'>;

export type MyWorkExpenseSalaryMonthState = {
  salaryMonthlyWorkflows: Pick<SalaryMonthlyWorkflowRecord, 'memberId' | 'month' | 'status'>[];
  salaryPaymentRecords: Pick<SalaryPaymentRecord, 'employeeNo' | 'payrollMonth'>[];
};

export type MyWorkExpenseSalaryTaxResult = {
  employeeId: string;
  employeeName: string;
  occurredAt: string;
  reviewResult: MyWorkExpenseReviewResult;
  salaryMonth: string;
  salaryTaxableAmount: number;
  sourceAmount: number;
  sourceCode: string;
  sourceReviewId: string;
};

export type MyWorkExpenseApprovalExecutionPlan = {
  approvedRecord: MyWorkExpenseReviewRecord;
  payableRecord?: FinanceReceivablePayableRecord;
  salaryAdjustment?: SalaryAdjustmentRecord;
  salaryTaxResult: MyWorkExpenseSalaryTaxResult;
};

export const myWorkExpenseReviewToday = financeToday;

function getExpenseReviewStatus(record: MyWorkExpenseCollectionRecord): MyWorkExpenseReviewStatus {
  switch (record.status) {
    case '退回修改':
      return '需调整';
    case '已确认':
      return '已通过';
    case '已关闭':
      return '已撤销';
    default:
      return '待审核';
  }
}

export function toReviewRecord(record: MyWorkExpenseCollectionRecord): MyWorkExpenseReviewRecord {
  return {
    amount: record.amount,
    category: record.category,
    categoryId: record.categoryId,
    categorySnapshot: record.categorySnapshot,
    code: record.code,
    dueAt: getDefaultFinanceReviewDueAt(record.occurredAt),
    expenseReviewResult: record.expenseReviewResult,
    files: record.files,
    id: `review-${record.id}`,
    note: record.note,
    occurredAt: record.occurredAt,
    operationRecords: record.operationRecords,
    originalType: record.originalType ?? '电子原件',
    paymentMethod: record.paymentMethod ?? '微信',
    relatedTarget: record.relatedTarget ?? '-',
    reviewStatus: getExpenseReviewStatus(record),
    submittedAt: record.updatedAt,
    submitterId: record.submitterId,
    submitterName: record.submitterName ?? '未知提交人',
    title: record.title,
    updatedAt: record.updatedAt,
  };
}

export function buildMyWorkExpenseReviewRecords(records: MyWorkExpenseCollectionRecord[]) {
  return records
    .filter((record) => record.kind === '费用报销' && record.status !== '草稿')
    .map(toReviewRecord);
}

export function applyExpenseReviewRecordToCollection(
  record: MyWorkExpenseCollectionRecord,
  reviewRecord: MyWorkExpenseReviewRecord
): MyWorkExpenseCollectionRecord {
  const statusByReview: Record<MyWorkExpenseReviewStatus, MyWorkExpenseCollectionRecord['status']> = {
    已撤销: '已关闭',
    已通过: '已确认',
    待审核: '待审核',
    需调整: '退回修改'
  };

  return {
    ...record,
    expenseReviewResult: reviewRecord.expenseReviewResult,
    files: reviewRecord.files,
    operationRecords: reviewRecord.operationRecords,
    status: statusByReview[reviewRecord.reviewStatus],
    submitterId: reviewRecord.submitterId,
    submitterName: reviewRecord.submitterName,
    updatedAt: reviewRecord.updatedAt
  };
}

export const myWorkExpenseReviewSeedRecords = buildMyWorkExpenseReviewRecords(myWorkExpenseCollectionSeedRecords);

export function getExpenseReviewCategoryLabel(
  record: Pick<MyWorkExpenseReviewRecord, 'category'>,
  primaryRows?: FinancePrimaryCategoryConfig[],
  secondaryRows?: FinanceSecondaryCategoryConfig[]
) {
  const primaryCategoryId = getMyWorkExpensePrimaryCategoryId(record.category, primaryRows, secondaryRows);

  return `${getMyWorkExpensePrimaryCategoryName(primaryCategoryId, primaryRows)} / ${record.category}`;
}

export function isExpenseReviewOverdue(record: Pick<MyWorkExpenseReviewRecord, 'dueAt' | 'reviewStatus'>, today = myWorkExpenseReviewToday) {
  return record.reviewStatus === '待审核' && record.dueAt < today;
}

export function buildMyWorkExpenseReviewQueue(records: MyWorkExpenseReviewRecord[]) {
  return records
    .filter((record) => record.reviewStatus === '待审核')
    .sort(
      (left, right) =>
        Number(isExpenseReviewOverdue(right)) - Number(isExpenseReviewOverdue(left)) ||
        left.dueAt.localeCompare(right.dueAt) ||
        left.submittedAt.localeCompare(right.submittedAt)
    );
}

export function buildMyWorkExpenseReviewCompletedRows(records: MyWorkExpenseReviewRecord[]) {
  return records
    .filter((record) => record.reviewStatus !== '待审核')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
}

export function buildMyWorkExpenseReviewMetrics(records: MyWorkExpenseReviewRecord[]): MyWorkExpenseReviewMetrics {
  return {
    overdueCount: records.filter((record) => isExpenseReviewOverdue(record)).length,
    pendingCount: records.filter((record) => record.reviewStatus === '待审核').length,
    returnedCount: records.filter((record) => record.reviewStatus === '需调整').length
  };
}

function isTwoDecimalNonNegativeAmount(amount: number) {
  return Number.isFinite(amount) && amount >= 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;
}

function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

type ExpenseSemanticRule<TDecision extends MyWorkExpenseApprovalDecision = MyWorkExpenseApprovalDecision> = {
  approvalAllowed: boolean;
  evidenceStatus?: MyWorkExpenseEvidenceStatus;
  issue?: string;
  validate?: (decision: TDecision) => string | undefined;
};

export const expenseReviewSemanticMatrix = {
  authenticity: {
    真实: { approvalAllowed: true },
    不真实: {
      approvalAllowed: false,
      issue: '费用不真实必须退回，不得通过审核或生成业务报销'
    }
  } satisfies Record<MyWorkExpenseAuthenticityConclusion, ExpenseSemanticRule>,
  overStandardNature: {
    未超标: {
      approvalAllowed: true,
      validate: (decision) =>
        decision.salaryTaxableAmount === 0 && decision.employeeBorneAmount === 0
          ? undefined
          : '未超标准时提交金额必须全部进入业务报销'
    },
    业务必要超标: {
      approvalAllowed: true,
      validate: (decision) =>
        decision.salaryTaxableAmount === 0 && decision.employeeBorneAmount === 0
          ? undefined
          : '业务必要超标不得转为薪酬或员工承担'
    },
    个人消费超标: {
      approvalAllowed: true,
      validate: (decision) =>
        decision.employeeBorneAmount > 0 && decision.salaryTaxableAmount === 0
          ? undefined
          : '个人消费超标部分必须进入员工承担，不得进入业务报销或薪酬计税'
    },
    混合性质超标: {
      approvalAllowed: true,
      validate: (decision) =>
        decision.employeeBorneAmount > 0 || decision.salaryTaxableAmount > 0
          ? undefined
          : '混合性质超标必须明确转薪酬计税或员工承担金额'
    }
  } satisfies Record<MyWorkExpenseOverStandardNature, ExpenseSemanticRule>,
  voucherCompliance: {
    发票: { approvalAllowed: true, evidenceStatus: '合规' },
    财政票据或其他合法凭证: { approvalAllowed: true, evidenceStatus: '合规' },
    小额零星收款凭证: {
      approvalAllowed: true,
      evidenceStatus: '合规',
      validate: (decision) =>
        decision.exceptionReason?.trim()
          ? undefined
          : '小额零星收款凭证必须记录收款方、主体信息、支出项目和内部报销依据'
    },
    暂缺合规凭证: {
      approvalAllowed: true,
      evidenceStatus: '待补凭证',
      validate: (decision) =>
        decision.exceptionReason?.trim() ? undefined : '待补凭证必须记录暂缺原因和后续补充依据'
    },
    无法核验材料: {
      approvalAllowed: false,
      evidenceStatus: '不合规',
      issue: '无法核验的材料不得通过审核或生成业务报销'
    }
  } satisfies Record<MyWorkExpenseVoucherComplianceConclusion, ExpenseSemanticRule>
};

const expenseAuthenticityConclusions: MyWorkExpenseAuthenticityConclusion[] = ['真实', '不真实'];
const expenseVoucherComplianceConclusions: MyWorkExpenseVoucherComplianceConclusion[] = [
  '发票',
  '财政票据或其他合法凭证',
  '小额零星收款凭证',
  '暂缺合规凭证',
  '无法核验材料'
];
const expenseOverStandardNatures: MyWorkExpenseOverStandardNature[] = [
  '未超标',
  '业务必要超标',
  '个人消费超标',
  '混合性质超标'
];

export function getExpenseApprovalDecisionIssues(
  submittedAmount: number,
  decision: MyWorkExpenseApprovalDecision
) {
  const issues: string[] = [];
  const conclusionsAreComplete =
    expenseAuthenticityConclusions.includes(decision.expenseAuthenticity) &&
    expenseVoucherComplianceConclusions.includes(decision.voucherCompliance) &&
    expenseOverStandardNatures.includes(decision.overStandardNature);
  const allocationAmounts = [
    decision.businessReimbursementAmount,
    decision.salaryTaxableAmount,
    decision.employeeBorneAmount
  ];

  if (!conclusionsAreComplete) {
    issues.push('报销审核必须完整记录真实性、凭证合规性和超标准性质');
  }
  if (!decision.reviewerName?.trim()) {
    issues.push('报销审核必须记录审核人');
  }
  if (!isTwoDecimalNonNegativeAmount(submittedAmount) || !allocationAmounts.every(isTwoDecimalNonNegativeAmount)) {
    issues.push('报销金额必须是非负且最多两位小数');
  } else if (allocationAmounts.reduce((total, amount) => total + toMinorUnits(amount), 0) !== toMinorUnits(submittedAmount)) {
    issues.push('业务报销、转薪酬计税与员工承担金额合计必须等于提交金额');
  }

  if (conclusionsAreComplete) {
    const rules: ExpenseSemanticRule[] = [
      expenseReviewSemanticMatrix.authenticity[decision.expenseAuthenticity],
      expenseReviewSemanticMatrix.voucherCompliance[decision.voucherCompliance],
      expenseReviewSemanticMatrix.overStandardNature[decision.overStandardNature]
    ];

    rules.forEach((rule) => {
      if (!rule.approvalAllowed && rule.issue) {
        issues.push(rule.issue);
      }
      const validationIssue = rule.validate?.(decision);
      if (validationIssue) {
        issues.push(validationIssue);
      }
    });
  }

  return issues;
}

export function isExpenseApprovalDecisionValid(
  submittedAmount: number,
  decision: MyWorkExpenseApprovalDecision
) {
  return getExpenseApprovalDecisionIssues(submittedAmount, decision).length === 0;
}

function assertExpenseApprovalDecision(
  submittedAmount: number,
  decision: MyWorkExpenseApprovalDecision
) {
  const issues = getExpenseApprovalDecisionIssues(submittedAmount, decision);
  if (issues.length > 0) {
    throw new Error(issues.join('；'));
  }
}

function getApprovedExpenseReviewResult(record: MyWorkExpenseReviewRecord) {
  if (record.reviewStatus !== '已通过' || !record.expenseReviewResult) {
    throw new Error('只有已完整保存三层判定的已通过报销可以派生下游结果');
  }

  assertExpenseApprovalDecision(record.amount, record.expenseReviewResult);
  return record.expenseReviewResult;
}

export function approveExpenseReviewRecord(record: MyWorkExpenseReviewRecord, decision: MyWorkExpenseApprovalDecision): MyWorkExpenseReviewRecord {
  assertExpenseApprovalDecision(record.amount, decision);
  if (decision.salaryTaxableAmount > 0 && !record.submitterId) {
    throw new Error('转薪酬计税必须关联明确的人员工号');
  }
  const reviewedAt = `${financeToday} 09:00`;
  const voucherRule = expenseReviewSemanticMatrix.voucherCompliance[decision.voucherCompliance];
  const expenseReviewResult: MyWorkExpenseReviewResult = {
    ...decision,
    evidenceStatus: voucherRule.evidenceStatus ?? '不合规',
    exceptionReason: decision.exceptionReason?.trim() || undefined,
    reviewedAt
  };

  return {
    ...record,
    expenseReviewResult,
    operationRecords: [
      {
        action: '审核通过',
        actor: decision.reviewerName,
        id: `${record.id}-approve-${record.operationRecords.length + 1}`,
        object: record.code,
        summary: `通过报销审核 ${formatMoney(record.amount)}；业务报销 ${formatMoney(decision.businessReimbursementAmount)}，转薪酬计税 ${formatMoney(decision.salaryTaxableAmount)}，员工承担 ${formatMoney(decision.employeeBorneAmount)}`,
        time: reviewedAt
      },
      ...record.operationRecords
    ],
    reviewStatus: '已通过',
    updatedAt: reviewedAt
  };
}

function buildNextExpensePayableDocumentNo(records: FinanceReceivablePayableRecord[], accountingPeriod: string) {
  const periodCode = accountingPeriod.replace('-', '');
  const prefix = `AP-${periodCode}-`;
  const maxSequence = records.reduce((max, record) => {
    if (!record.documentNo.startsWith(prefix)) {
      return max;
    }

    const sequence = Number(record.documentNo.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
}

export function buildReceivablePayableFromExpenseReview(
  record: MyWorkExpenseReviewRecord,
  existingRows: FinanceReceivablePayableRecord[]
): FinanceReceivablePayableRecord | undefined {
  const expenseReviewResult = getApprovedExpenseReviewResult(record);
  const payableAmount = expenseReviewResult.businessReimbursementAmount;

  if (payableAmount === 0) {
    return undefined;
  }

  const accountingPeriod = getAccountingPeriod(record.occurredAt);
  const categorySnapshot = record.categorySnapshot;
  const documentNo = buildNextExpensePayableDocumentNo(existingRows, accountingPeriod);
  const sourceTitle = `${record.submitterName} ${record.title}`;
  const evidenceNote = `企业所得税凭证状态：${expenseReviewResult.evidenceStatus}${
    expenseReviewResult.exceptionReason ? `；判定依据：${expenseReviewResult.exceptionReason}` : ''
  }`;
  const taxSource = {
    amount: payableAmount,
    direction: '应付' as const,
    sourceType: '员工报销'
  };

  return {
    accountingPeriod,
    amount: payableAmount,
    category: record.category,
    categorySnapshot,
    confirmDate: financeToday,
    confirmationStatus: '已确认',
    counterparty: record.submitterName,
    counterpartyId: record.submitterId,
    counterpartyType: '员工',
    direction: '应付',
    documentNo,
    dueDate: financeToday,
    files: record.files.map((file) => ({ ...file, status: '已上传', updatedAt: financeToday })),
    id: `ap-expense-${record.id}`,
    linkedTransactionNos: [],
    naturalPersonPayment: buildExpenseReimbursementPaymentSnapshot({
      amount: payableAmount,
      paymentFactId: `expense-reimbursement:${record.code}`,
      personId: record.submitterId ?? record.submitterName,
      personName: record.submitterName,
      sourceRecordNo: record.code,
      taxPeriod: accountingPeriod
    }),
    note: [record.note.trim(), evidenceNote].filter(Boolean).join('；'),
    operationRecords: [
      {
        action: '生成应付',
        actor: '系统',
        id: `rp-op-expense-${record.id}`,
        object: documentNo,
        summary: `费用报销审核通过后按业务报销金额生成应付 ${formatMoney(payableAmount)}；凭证状态 ${expenseReviewResult.evidenceStatus}`,
        time: `${financeToday} 09:00`
      },
      ...record.operationRecords
    ],
    owner: '李明',
    reportAggregation: categorySnapshot.reportAggregation,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: record.code,
    sourceTitle,
    sourceType: '员工报销',
    taxBasis: getDefaultReceivablePayableTaxBasis(taxSource),
    updatedAt: `${financeToday} 09:00`
  };
}

function getNextMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextYear = monthNumber === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonthNumber).padStart(2, '0')}`;
}

export function getFirstUnpaidExpenseSalaryMonth(
  reviewedAt: string,
  employeeId: string,
  salaryMonthState: MyWorkExpenseSalaryMonthState
) {
  const reviewMonth = reviewedAt.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(reviewMonth)) {
    throw new Error('审核时间无法确定转薪酬计税月份');
  }

  let candidateMonth = reviewMonth;
  for (let offset = 0; offset < 120; offset += 1) {
    const workflowPaid = salaryMonthState.salaryMonthlyWorkflows.some(
      (workflow) =>
        workflow.memberId === employeeId && workflow.month === candidateMonth && workflow.status === '已发放'
    );
    const paymentExists = salaryMonthState.salaryPaymentRecords.some(
      (payment) => payment.employeeNo === employeeId && payment.payrollMonth === candidateMonth
    );

    if (!workflowPaid && !paymentExists) {
      return candidateMonth;
    }
    candidateMonth = getNextMonth(candidateMonth);
  }

  throw new Error('未来薪酬月份均无法承接本次转薪酬计税金额');
}

export function buildSalaryTaxResultFromExpenseReview(
  record: MyWorkExpenseReviewRecord,
  salaryMonthState: MyWorkExpenseSalaryMonthState = {
    salaryMonthlyWorkflows: [],
    salaryPaymentRecords: []
  }
): MyWorkExpenseSalaryTaxResult {
  const expenseReviewResult = getApprovedExpenseReviewResult(record);

  if (expenseReviewResult.salaryTaxableAmount > 0 && !record.submitterId) {
    throw new Error('转薪酬计税必须关联明确的人员工号');
  }

  const salaryMonth = expenseReviewResult.salaryTaxableAmount > 0
    ? getFirstUnpaidExpenseSalaryMonth(expenseReviewResult.reviewedAt, record.submitterId ?? '', salaryMonthState)
    : expenseReviewResult.reviewedAt.slice(0, 7);

  return {
    employeeId: record.submitterId ?? '',
    employeeName: record.submitterName,
    occurredAt: record.occurredAt,
    reviewResult: expenseReviewResult,
    salaryMonth,
    salaryTaxableAmount: expenseReviewResult.salaryTaxableAmount,
    sourceAmount: record.amount,
    sourceCode: record.code,
    sourceReviewId: record.id
  };
}

export function buildMyWorkExpenseApprovalExecutionPlan({
  decision,
  existingPayableRows,
  existingSalaryAdjustments,
  record,
  salaryMonthState
}: {
  decision: MyWorkExpenseApprovalDecision;
  existingPayableRows: FinanceReceivablePayableRecord[];
  existingSalaryAdjustments: Pick<SalaryAdjustmentRecord, 'id'>[];
  record: MyWorkExpenseReviewRecord;
  salaryMonthState: MyWorkExpenseSalaryMonthState;
}): MyWorkExpenseApprovalExecutionPlan {
  const approvedRecord = approveExpenseReviewRecord(record, decision);
  const reviewResult = approvedRecord.expenseReviewResult;

  if (!reviewResult) {
    throw new Error('审核结果未生成，不能执行下游写入');
  }
  if (
    reviewResult.businessReimbursementAmount > 0 &&
    existingPayableRows.some(
      (payable) => payable.sourceNo === record.code || payable.id === `ap-expense-${record.id}`
    )
  ) {
    throw new Error('该报销来源已生成应付事项，不得重复写入');
  }

  const payableRecord = buildReceivablePayableFromExpenseReview(
    approvedRecord,
    existingPayableRows
  );
  const salaryTaxResult = buildSalaryTaxResultFromExpenseReview(approvedRecord, salaryMonthState);
  const salaryAdjustmentId = `salary-expense-${salaryTaxResult.sourceCode}`;

  if (
    salaryTaxResult.salaryTaxableAmount > 0 &&
    existingSalaryAdjustments.some((adjustment) => adjustment.id === salaryAdjustmentId)
  ) {
    throw new Error('该报销来源已转入薪酬计税，不得重复写入');
  }

  const salaryAdjustment: SalaryAdjustmentRecord | undefined = salaryTaxResult.salaryTaxableAmount > 0
    ? {
        amount: salaryTaxResult.salaryTaxableAmount,
        createdAt: salaryTaxResult.reviewResult.reviewedAt,
        createdBy: decision.reviewerName,
        id: salaryAdjustmentId,
        memberId: salaryTaxResult.employeeId,
        month: salaryTaxResult.salaryMonth,
        reason: `${record.title} 中转薪酬计税部分`,
        source: '薪酬调整',
        status: '已生效',
        taxTreatment: '税前计税',
        type: '补贴',
        updatedAt: salaryTaxResult.reviewResult.reviewedAt
      }
    : undefined;

  return {
    approvedRecord,
    payableRecord,
    salaryAdjustment,
    salaryTaxResult
  };
}

export function returnExpenseReviewRecord(record: MyWorkExpenseReviewRecord, decision: MyWorkExpenseReviewDecision): MyWorkExpenseReviewRecord {
  const reason = decision.returnedReason?.trim() || '请补充或修正报销信息';

  return {
    ...record,
    expenseReviewResult: undefined,
    note: record.note,
    operationRecords: [
      {
        action: '退回修改',
        actor: decision.reviewerName,
        id: `${record.id}-return-${record.operationRecords.length + 1}`,
        object: record.code,
        summary: reason,
        time: `${financeToday} 09:00`
      },
      ...record.operationRecords
    ],
    reviewStatus: '需调整',
    updatedAt: `${financeToday} 09:00`
  };
}

export function supplementExpenseReviewEvidence(
  record: MyWorkExpenseReviewRecord,
  file: RelatedFileRecord,
  voucherCompliance: Extract<
    MyWorkExpenseVoucherComplianceConclusion,
    '发票' | '财政票据或其他合法凭证' | '小额零星收款凭证'
  >,
  actor: string
): MyWorkExpenseReviewRecord {
  if (record.reviewStatus !== '已通过' || record.expenseReviewResult?.evidenceStatus !== '待补凭证') {
    throw new Error('只有已通过且待补凭证的报销可以补充依据');
  }

  const updatedAt = `${file.updatedAt} 09:00`;

  return {
    ...record,
    expenseReviewResult: {
      ...record.expenseReviewResult,
      evidenceStatus: '合规',
      exceptionReason: undefined,
      voucherCompliance
    },
    files: [file, ...record.files.filter((currentFile) => currentFile.id !== file.id)],
    operationRecords: [
      {
        action: '补充报销凭证',
        actor,
        id: `${record.id}-evidence-${file.id}`,
        object: record.code,
        summary: `补充凭证：${file.name}`,
        time: updatedAt
      },
      ...record.operationRecords
    ],
    updatedAt
  };
}

export function revokeExpenseReviewRecord(
  record: MyWorkExpenseReviewRecord,
  decision: Required<MyWorkExpenseReviewDecision>
): MyWorkExpenseReviewRecord {
  const reason = decision.returnedReason.trim();

  if (record.reviewStatus !== '已通过' || !record.expenseReviewResult) {
    throw new Error('只有已通过的报销可以撤销审核结果');
  }
  if (!reason) {
    throw new Error('撤销审核必须填写原因');
  }

  const updatedAt = `${financeToday} 09:00`;

  return {
    ...record,
    operationRecords: [
      {
        action: '撤销审核结果',
        actor: decision.reviewerName,
        id: `${record.id}-revoke-${record.operationRecords.length + 1}`,
        object: record.code,
        summary: reason,
        time: updatedAt
      },
      ...record.operationRecords
    ],
    reviewStatus: '已撤销',
    updatedAt
  };
}
