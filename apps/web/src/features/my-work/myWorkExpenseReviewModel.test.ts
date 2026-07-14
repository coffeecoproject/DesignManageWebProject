import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  buildFinanceExpenseApprovalCommit,
  buildFinanceExpenseApprovalReversal,
  buildFinanceExpenseEvidenceSupplement
} from '../finance/financeExpenseApprovalCommitModel';
import {
  approveExpenseReviewRecord,
  buildMyWorkExpenseReviewCompletedRows,
  buildMyWorkExpenseApprovalExecutionPlan,
  buildReceivablePayableFromExpenseReview,
  buildSalaryTaxResultFromExpenseReview,
  buildMyWorkExpenseReviewMetrics,
  buildMyWorkExpenseReviewQueue,
  getExpenseReviewCategoryLabel,
  getFirstUnpaidExpenseSalaryMonth,
  isExpenseApprovalDecisionValid,
  isExpenseReviewOverdue,
  revokeExpenseReviewRecord,
  returnExpenseReviewRecord,
  supplementExpenseReviewEvidence,
  type MyWorkExpenseApprovalDecision,
  type MyWorkExpenseReviewRecord
} from './myWorkExpenseReviewModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    fail(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertThrows(run: () => void, expectedMessage: string, message: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expectedMessage), `${message}: unexpected error`);
    return;
  }

  fail(`${message}: expected function to throw`);
}

function createFile(name = '费用凭证.pdf'): RelatedFileRecord {
  return {
    id: `file-${name}`,
    name,
    status: '已上传',
    type: '费用凭证',
    updatedAt: '2026-06-15'
  };
}

function createReviewRecord(overrides: Partial<MyWorkExpenseReviewRecord> = {}): MyWorkExpenseReviewRecord {
  return {
    amount: 100,
    category: '差旅交通',
    code: 'EC-TEST-001',
    dueAt: '2026-06-20',
    files: [createFile()],
    id: 'review-test-001',
    note: '测试报销',
    occurredAt: '2026-06-15',
    operationRecords: [],
    originalType: '电子原件',
    paymentMethod: '微信',
    relatedTarget: '测试项目',
    reviewStatus: '待审核',
    submittedAt: '2026-06-15 09:00',
    submitterId: '20260001',
    submitterName: '测试员工',
    title: '测试费用',
    updatedAt: '2026-06-15 09:00',
    ...overrides
  };
}

function createApprovalDecision(overrides: Partial<MyWorkExpenseApprovalDecision> = {}): MyWorkExpenseApprovalDecision {
  return {
    businessReimbursementAmount: 100,
    employeeBorneAmount: 0,
    expenseAuthenticity: '真实',
    overStandardNature: '未超标',
    reviewerName: '审核人',
    salaryTaxableAmount: 0,
    voucherCompliance: '发票',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'builds pending review queue and prioritizes overdue records',
    run() {
      const overdue = createReviewRecord({ dueAt: '2026-06-10', id: 'overdue' });
      const pending = createReviewRecord({ dueAt: '2026-06-22', id: 'pending' });
      const returned = createReviewRecord({ id: 'returned', reviewStatus: '需调整' });
      const approved = createReviewRecord({ id: 'approved', reviewStatus: '已通过' });
      const queue = buildMyWorkExpenseReviewQueue([pending, returned, approved, overdue]);

      assertEqual(queue.length, 2, 'queue should include pending records only');
      assertEqual(queue[0]?.id, 'overdue', 'overdue record should be first');
      assertEqual(queue[1]?.id, 'pending', 'normal pending record should follow');
      assertEqual(isExpenseReviewOverdue(overdue, '2026-06-23'), true, 'overdue helper should detect pending overdue records');
      assertEqual(isExpenseReviewOverdue(returned, '2026-06-23'), false, 'returned records should not count as overdue');
    }
  },
  {
    name: 'derives metrics from review statuses',
    run() {
      const metrics = buildMyWorkExpenseReviewMetrics([
        createReviewRecord({ dueAt: '2026-06-10', id: 'pending-overdue' }),
        createReviewRecord({ dueAt: '2026-06-24', id: 'pending-normal' }),
        createReviewRecord({ id: 'returned', reviewStatus: '需调整' }),
        createReviewRecord({ id: 'approved', reviewStatus: '已通过' })
      ]);

      assertEqual(metrics.pendingCount, 2, 'pending metric should count pending records');
      assertEqual(metrics.returnedCount, 1, 'returned metric should count returned records');
      assertEqual(metrics.overdueCount, 1, 'overdue metric should count pending overdue records');
    }
  },
  {
    name: 'approves and returns reimbursement records without direct payment actions',
    run() {
      const record = createReviewRecord();
      const approved = approveExpenseReviewRecord(record, createApprovalDecision());
      const returned = returnExpenseReviewRecord(record, { returnedReason: '请补充发票', reviewerName: '审核人' });
      const returnedAfterApproval = returnExpenseReviewRecord(approved, { returnedReason: '重新核实', reviewerName: '审核人' });

      assertEqual(approved.reviewStatus, '已通过', 'approved record should be marked approved');
      assertEqual(approved.expenseReviewResult?.expenseAuthenticity, '真实', 'authenticity conclusion should be saved');
      assertEqual(approved.expenseReviewResult?.voucherCompliance, '发票', 'voucher compliance conclusion should be saved');
      assertEqual(approved.expenseReviewResult?.overStandardNature, '未超标', 'over-standard nature should be saved');
      assertEqual(approved.operationRecords[0]?.action, '审核通过', 'approval operation should be prepended');
      assertEqual(returned.reviewStatus, '需调整', 'returned record should be marked returned');
      assertEqual(returnedAfterApproval.expenseReviewResult, undefined, 'return should clear any stale approved result');
      assertEqual(returned.operationRecords[0]?.summary, '请补充发票', 'returned reason should be retained');
      assert(!approved.operationRecords.some((operation) => operation.action.includes('付款')), 'review should not create payment operation');
      assert(!approved.operationRecords.some((operation) => operation.action.includes('生成应付')), 'review should not expose payable generation operation');
    }
  },
  {
    name: 'NP-08 builds a non-taxable payable for a truthful expense with compliant evidence',
    run() {
      const record = createReviewRecord({
        amount: 486.5,
        category: '差旅交通',
        code: 'EC-202606-088',
        occurredAt: '2026-06-15',
        submitterName: '测试员工',
        title: '现场交通费'
      });
      const approved = approveExpenseReviewRecord(record, createApprovalDecision({
        businessReimbursementAmount: 486.5
      }));
      const payable = buildReceivablePayableFromExpenseReview(approved, []);
      const salaryTaxResult = buildSalaryTaxResultFromExpenseReview(approved);

      assert(payable, 'positive business reimbursement should create payable confirmation');
      assertEqual(payable.direction, '应付', 'approved reimbursement should create payable confirmation');
      assertEqual(payable.amount, 486.5, 'truthful compliant expense should create the full business reimbursement payable');
      assertEqual(payable.confirmationStatus, '已确认', 'payable should be confirmed after approval');
      assertEqual(payable.settlementStatus, '未结清', 'payable should wait for payment registration');
      assertEqual(payable.sourceNo, record.code, 'payable should trace to reimbursement record');
      assertEqual(payable.counterparty, record.submitterName, 'payable counterparty should be submitter');
      assertEqual(payable.counterpartyId, record.submitterId, 'payable should retain the employee identity');
      assertEqual(payable.naturalPersonPayment?.incomeType, '费用返还', 'truthful reimbursement should retain an explicit non-taxable payment fact');
      assertEqual(payable.naturalPersonPayment?.taxableIncomeAmount, 0, 'expense reimbursement payment fact must not become taxable income');
      assertEqual(payable.category, record.category, 'payable should keep expense category');
      assertEqual(payable.operationRecords[0]?.action, '生成应付', 'payable generation should be recorded on payable item');
      assertEqual(salaryTaxResult.salaryTaxableAmount, 0, 'truthful compliant expense should not enter salary IIT');
      assertEqual(salaryTaxResult.sourceCode, record.code, 'salary result should retain expense source code');
    }
  },
  {
    name: 'NP-17 requires complete conclusions and exact amount conservation',
    run() {
      const record = createReviewRecord();
      const incompleteDecision = { reviewerName: '审核人' } as MyWorkExpenseApprovalDecision;
      const mismatchedDecision = createApprovalDecision({ businessReimbursementAmount: 90 });
      const excessivePrecisionDecision = createApprovalDecision({
        businessReimbursementAmount: 99.999,
        employeeBorneAmount: 0.001
      });

      assertEqual(isExpenseApprovalDecisionValid(record.amount, mismatchedDecision), false, 'mismatched allocation should be invalid');
      assertEqual(isExpenseApprovalDecisionValid(record.amount, excessivePrecisionDecision), false, 'allocation should use cent precision');
      assertThrows(
        () => approveExpenseReviewRecord(record, incompleteDecision),
        '必须完整记录真实性、凭证合规性和超标准性质',
        'approval without three-layer conclusions should fail closed'
      );
      assertThrows(
        () => approveExpenseReviewRecord(record, mismatchedDecision),
        '合计必须等于提交金额',
        'approval with mismatched allocation should fail closed'
      );
      assertThrows(
        () => buildReceivablePayableFromExpenseReview(record, []),
        '只有已完整保存三层判定的已通过报销',
        'pending reimbursement should not derive payable'
      );
    }
  },
  {
    name: 'NP-10 and NP-12 reject untruthful expenses, unverifiable material, and personal consumption routed as business reimbursement',
    run() {
      const record = createReviewRecord();
      const untruthfulDecision = createApprovalDecision({
        businessReimbursementAmount: 0,
        employeeBorneAmount: 100,
        expenseAuthenticity: '不真实',
        overStandardNature: '个人消费超标'
      });
      const unverifiableDecision = createApprovalDecision({ voucherCompliance: '无法核验材料' });
      const personalConsumptionAsBusiness = createApprovalDecision({ overStandardNature: '个人消费超标' });

      assertThrows(
        () => approveExpenseReviewRecord(record, untruthfulDecision),
        '费用不真实必须退回',
        'untruthful expense should not pass even when no payable allocation is requested'
      );
      assertThrows(
        () => approveExpenseReviewRecord(record, unverifiableDecision),
        '无法核验的材料不得通过审核',
        'unverifiable material should fail closed'
      );
      assertThrows(
        () => approveExpenseReviewRecord(record, personalConsumptionAsBusiness),
        '个人消费超标部分必须进入员工承担',
        'personal consumption should not be routed entirely to business reimbursement'
      );

      const employeeBorne = approveExpenseReviewRecord(record, createApprovalDecision({
        businessReimbursementAmount: 80,
        employeeBorneAmount: 20,
        overStandardNature: '个人消费超标'
      }));
      assertEqual(
        buildReceivablePayableFromExpenseReview(employeeBorne, [])?.amount,
        80,
        'only the non-personal business portion should create a payable'
      );
    }
  },
  {
    name: 'NP-09 keeps truthful reimbursement payable and pending evidence basis when compliant voucher is temporarily missing',
    run() {
      const record = createReviewRecord({ amount: 120, originalType: '无正式票据' });
      assertThrows(
        () => approveExpenseReviewRecord(record, createApprovalDecision({
          businessReimbursementAmount: 120,
          voucherCompliance: '暂缺合规凭证'
        })),
        '待补凭证必须记录暂缺原因',
        'pending evidence should require a retained basis'
      );
      const approved = approveExpenseReviewRecord(record, createApprovalDecision({
        businessReimbursementAmount: 120,
        exceptionReason: '供应商补开发票，预计 2026-06-30 前补齐',
        voucherCompliance: '暂缺合规凭证'
      }));
      const payable = buildReceivablePayableFromExpenseReview(approved, []);
      const salaryTaxResult = buildSalaryTaxResultFromExpenseReview(approved);

      assert(payable, 'truthful business expense without formal voucher can retain explicit reimbursement outcome');
      assertEqual(payable.amount, 120, 'missing formal voucher should not force reimbursement amount to zero');
      assertEqual(approved.expenseReviewResult?.evidenceStatus, '待补凭证', 'pending evidence status should be persisted on review result');
      assert(
        payable.note.includes('供应商补开发票') && payable.note.includes('待补凭证'),
        'payable should retain the pending evidence basis'
      );
      assertEqual(salaryTaxResult.salaryTaxableAmount, 0, 'missing formal voucher should not automatically create taxable salary amount');
    }
  },
  {
    name: 'NP-11 selects the first unpaid salary month at or after review and preflights duplicate sources',
    run() {
      const salaryMonthState = {
        salaryMonthlyWorkflows: [
          { memberId: '20260001', month: '2026-06', status: '已发放' as const }
        ],
        salaryPaymentRecords: [
          { employeeNo: '20260001', payrollMonth: '2026-07' }
        ]
      };

      assertEqual(
        getFirstUnpaidExpenseSalaryMonth('2026-06-15 09:00', '20260001', salaryMonthState),
        '2026-08',
        'target month should skip workflow-paid and payment-recorded months'
      );

      const record = createReviewRecord({ code: 'EC-TARGET-MONTH-001' });
      const decision = createApprovalDecision({
        businessReimbursementAmount: 40,
        overStandardNature: '混合性质超标',
        salaryTaxableAmount: 60
      });
      const plan = buildMyWorkExpenseApprovalExecutionPlan({
        decision,
        existingPayableRows: [],
        existingSalaryAdjustments: [],
        record,
        salaryMonthState
      });

      assertEqual(plan.salaryTaxResult.salaryMonth, '2026-08', 'salary tax result should use first unpaid month');
      assertEqual(plan.salaryAdjustment?.month, '2026-08', 'salary adjustment should use the preflighted target month');
      assertEqual(plan.payableRecord?.amount, 40, 'business reimbursement portion should remain in the reimbursement payable');
      assertEqual(plan.salaryAdjustment?.amount, 60, 'taxable allowance portion should enter salary at the exact split amount');
      assertThrows(
        () => buildMyWorkExpenseApprovalExecutionPlan({
          decision,
          existingPayableRows: [],
          existingSalaryAdjustments: [{ id: 'salary-expense-EC-TARGET-MONTH-001' }],
          record,
          salaryMonthState
        }),
        '不得重复写入',
        'salary source duplication should fail before state writes'
      );
      assertThrows(
        () => buildMyWorkExpenseApprovalExecutionPlan({
          decision,
          existingPayableRows: [{ ...plan.payableRecord!, sourceNo: record.code }],
          existingSalaryAdjustments: [],
          record,
          salaryMonthState
        }),
        '已生成应付事项',
        'payable source duplication should fail before state writes'
      );
    }
  },
  {
    name: 'does not create payable when approved business reimbursement is zero',
    run() {
      const record = createReviewRecord();
      const approved = approveExpenseReviewRecord(record, createApprovalDecision({
        businessReimbursementAmount: 0,
        employeeBorneAmount: 25,
        overStandardNature: '混合性质超标',
        salaryTaxableAmount: 75,
        voucherCompliance: '发票'
      }));

      assertEqual(buildReceivablePayableFromExpenseReview(approved, []), undefined, 'zero business reimbursement should not create zero-amount payable');
      assertEqual(buildSalaryTaxResultFromExpenseReview(approved).salaryTaxableAmount, 75, 'taxable transfer should remain available to salary consumer');
    }
  },
  {
    name: 'renders category label from finance category hierarchy',
    run() {
      assertEqual(getExpenseReviewCategoryLabel(createReviewRecord({ category: '差旅交通' })), '运营费用 / 差旅交通', 'category label should include primary and secondary category');
    }
  },
  {
    name: 'NP-08 FRONTEND-CHAIN commits one non-taxable reimbursement payable from the approved three-layer result',
    run() {
      const record = createReviewRecord({ amount: 486.5, code: 'EC-NP08-CHAIN' });
      const approved = approveExpenseReviewRecord(record, createApprovalDecision({
        businessReimbursementAmount: 486.5
      }));
      const plan = buildMyWorkExpenseApprovalExecutionPlan({
        decision: approved.expenseReviewResult!,
        existingPayableRows: [],
        existingSalaryAdjustments: [],
        record,
        salaryMonthState: { salaryMonthlyWorkflows: [], salaryPaymentRecords: [] }
      });
      const commit = buildFinanceExpenseApprovalCommit({
        isAccountingPeriodOpen: () => true,
        isSalaryAdjustmentPeriodOpen: () => true,
        plan,
        snapshot: { payableRows: [], salaryAdjustments: [] }
      });

      assertEqual(commit.payableRows.length, 1, 'approval should commit one reimbursement payable');
      assertEqual(commit.salaryAdjustments.length, 0, 'truthful compliant reimbursement must not enter salary IIT');
      assertEqual(commit.payableRows[0]?.naturalPersonPayment?.incomeType, '费用返还', 'payable should retain explicit non-taxable nature');
    }
  },
  {
    name: 'NP-09 FRONTEND-CHAIN supplements pending reimbursement evidence and reverses only an unbooked unpaid result',
    run() {
      const record = createReviewRecord({ amount: 120, code: 'EC-NP09-CHAIN', originalType: '无正式票据' });
      const decision = createApprovalDecision({
        businessReimbursementAmount: 120,
        exceptionReason: '供应商将在本月补开发票',
        voucherCompliance: '暂缺合规凭证'
      });
      const approved = approveExpenseReviewRecord(record, decision);
      const plan = buildMyWorkExpenseApprovalExecutionPlan({
        decision,
        existingPayableRows: [],
        existingSalaryAdjustments: [],
        record,
        salaryMonthState: { salaryMonthlyWorkflows: [], salaryPaymentRecords: [] }
      });
      const committed = buildFinanceExpenseApprovalCommit({
        isAccountingPeriodOpen: () => true,
        isSalaryAdjustmentPeriodOpen: () => true,
        plan,
        snapshot: { payableRows: [], salaryAdjustments: [] }
      });
      const evidenceFile = createFile('补开发票.pdf');
      const supplementedReview = supplementExpenseReviewEvidence(
        approved,
        evidenceFile,
        '发票',
        '审核人'
      );
      const supplementedPayables = buildFinanceExpenseEvidenceSupplement({
        actor: '审核人',
        file: evidenceFile,
        hasActiveSettlement: () => false,
        isAccountingPeriodOpen: () => true,
        isPayableBooked: () => false,
        payableRows: committed.payableRows,
        sourceCode: record.code
      });

      assertEqual(supplementedReview.expenseReviewResult?.evidenceStatus, '合规', 'review result should close pending evidence');
      assertEqual(supplementedPayables[0]?.files[0]?.name, evidenceFile.name, 'payable basis should receive the same evidence');

      const reversal = buildFinanceExpenseApprovalReversal({
        actor: '审核人',
        hasActiveSettlement: () => false,
        isAccountingPeriodOpen: () => true,
        isPayableBooked: () => false,
        isSalaryAdjustmentPeriodOpen: () => true,
        occurredAt: '2026-06-20 10:00',
        payableRows: supplementedPayables,
        reason: '报销事项重复提交',
        salaryAdjustments: committed.salaryAdjustments,
        sourceCode: record.code
      });
      const revokedReview = revokeExpenseReviewRecord(supplementedReview, {
        returnedReason: '报销事项重复提交',
        reviewerName: '审核人'
      });

      assertEqual(reversal.payableRows[0]?.confirmationStatus, '已作废', 'unpaid unbooked payable should be voided');
      assertEqual(revokedReview.reviewStatus, '已撤销', 'shared review state should retain the reversal result');
      assertEqual(buildMyWorkExpenseReviewCompletedRows([revokedReview]).length, 1, 'revoked review must remain in processed audit records');

      assertThrows(
        () => buildFinanceExpenseApprovalReversal({
          actor: '审核人',
          hasActiveSettlement: () => true,
          isAccountingPeriodOpen: () => true,
          isPayableBooked: () => false,
          isSalaryAdjustmentPeriodOpen: () => true,
          occurredAt: '2026-06-20 10:00',
          payableRows: committed.payableRows,
          reason: '尝试撤销已付款事项',
          salaryAdjustments: [],
          sourceCode: record.code
        }),
        '已有收付款记录',
        'paid reimbursement must not be overwritten by direct reversal'
      );
    }
  },
  {
    name: 'NP-10 FRONTEND-CHAIN commits only the approved business portion when excess is employee-borne',
    run() {
      const record = createReviewRecord({ amount: 100, code: 'EC-NP10-CHAIN' });
      const decision = createApprovalDecision({
        businessReimbursementAmount: 80,
        employeeBorneAmount: 20,
        overStandardNature: '个人消费超标'
      });
      const plan = buildMyWorkExpenseApprovalExecutionPlan({
        decision,
        existingPayableRows: [],
        existingSalaryAdjustments: [],
        record,
        salaryMonthState: { salaryMonthlyWorkflows: [], salaryPaymentRecords: [] }
      });
      const commit = buildFinanceExpenseApprovalCommit({
        isAccountingPeriodOpen: () => true,
        isSalaryAdjustmentPeriodOpen: () => true,
        plan,
        snapshot: { payableRows: [], salaryAdjustments: [] }
      });

      assertEqual(commit.payableRows[0]?.amount, 80, 'only approved business expense should create reimbursement payable');
      assertEqual(commit.salaryAdjustments.length, 0, 'employee-borne personal excess must not become salary income');
    }
  },
  {
    name: 'NP-11 FRONTEND-CHAIN atomically commits reimbursement payable and taxable allowance into the first unpaid salary',
    run() {
      const record = createReviewRecord({ amount: 100, code: 'EC-NP11-CHAIN' });
      const decision = createApprovalDecision({
        businessReimbursementAmount: 40,
        overStandardNature: '混合性质超标',
        salaryTaxableAmount: 60
      });
      const plan = buildMyWorkExpenseApprovalExecutionPlan({
        decision,
        existingPayableRows: [],
        existingSalaryAdjustments: [],
        record,
        salaryMonthState: { salaryMonthlyWorkflows: [], salaryPaymentRecords: [] }
      });
      const commit = buildFinanceExpenseApprovalCommit({
        isAccountingPeriodOpen: () => true,
        isSalaryAdjustmentPeriodOpen: () => true,
        plan,
        snapshot: { payableRows: [], salaryAdjustments: [] }
      });

      assertEqual(commit.payableRows[0]?.amount, 40, 'business reimbursement should remain payable');
      assertEqual(commit.salaryAdjustments[0]?.amount, 60, 'taxable allowance should enter salary once');
      assertEqual(commit.salaryAdjustments[0]?.taxTreatment, '税前计税', 'salary adjustment should retain IIT treatment');
    }
  },
  {
    name: 'NP-12 FRONTEND-CHAIN rejects untruthful reimbursement before any finance or salary state can be produced',
    run() {
      const record = createReviewRecord({ code: 'EC-NP12-CHAIN' });
      const decision = createApprovalDecision({
        businessReimbursementAmount: 0,
        employeeBorneAmount: 100,
        expenseAuthenticity: '不真实',
        overStandardNature: '个人消费超标'
      });

      assertThrows(
        () => {
          const approved = approveExpenseReviewRecord(record, decision);
          const plan = buildMyWorkExpenseApprovalExecutionPlan({
            decision: approved.expenseReviewResult!,
            existingPayableRows: [],
            existingSalaryAdjustments: [],
            record,
            salaryMonthState: { salaryMonthlyWorkflows: [], salaryPaymentRecords: [] }
          });
          buildFinanceExpenseApprovalCommit({
            isAccountingPeriodOpen: () => true,
            isSalaryAdjustmentPeriodOpen: () => true,
            plan,
            snapshot: { payableRows: [], salaryAdjustments: [] }
          });
        },
        '费用不真实必须退回',
        'untruthful expense must stop before financial commit'
      );
    }
  }
];

export function runMyWorkExpenseReviewModelTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed,
    passedTestNames,
    total: tests.length
  };
}
