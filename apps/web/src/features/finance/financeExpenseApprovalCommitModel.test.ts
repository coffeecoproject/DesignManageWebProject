import type { SalaryAdjustmentRecord } from '../salary/salaryDomain';
import { buildFinanceExpenseApprovalCommit } from './financeExpenseApprovalCommitModel';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(action: () => void, expectedMessage: string, message: string) {
  try {
    action();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expectedMessage), message);
    return;
  }

  throw new Error(message);
}

const payableRecord = {
  accountingPeriod: '2026-06',
  documentNo: 'AP-EXPENSE-001',
  id: 'ap-expense-001',
  sourceNo: 'EC-EXPENSE-001'
} as FinanceReceivablePayableRecord;

const salaryAdjustment = {
  id: 'salary-expense-EC-EXPENSE-001',
  memberId: '20260001',
  month: '2026-07'
} as SalaryAdjustmentRecord;

const tests = [
  {
    name: 'NP-11 commits reimbursement payable and salary adjustment from one validated snapshot',
    run() {
      const result = buildFinanceExpenseApprovalCommit({
        isSalaryAdjustmentPeriodOpen: () => true,
        isAccountingPeriodOpen: () => true,
        plan: { payableRecord, salaryAdjustment },
        snapshot: { payableRows: [], salaryAdjustments: [] }
      });

      assert(result.payableRows[0] === payableRecord, 'approved reimbursement payable should be committed');
      assert(result.salaryAdjustments[0] === salaryAdjustment, 'taxable allowance should be committed to salary');
    }
  },
  {
    name: 'NP-17 FRONTEND-CHAIN rejects the whole financial commit before either result changes',
    run() {
      const snapshot = { payableRows: [], salaryAdjustments: [] };

      assertThrows(
        () => buildFinanceExpenseApprovalCommit({
          isSalaryAdjustmentPeriodOpen: () => false,
          isAccountingPeriodOpen: () => true,
          plan: { payableRecord, salaryAdjustment },
          snapshot
        }),
        '目标薪酬月份已发放',
        'a closed salary month should reject the complete financial commit'
      );
      assert(snapshot.payableRows.length === 0, 'rejected commit must not create a payable');
      assert(snapshot.salaryAdjustments.length === 0, 'rejected commit must not create a salary adjustment');
    }
  }
];

export function runFinanceExpenseApprovalCommitModelTests() {
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
