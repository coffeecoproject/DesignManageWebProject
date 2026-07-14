import { getFinanceCategorySnapshot, getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';
import { buildAccountingVouchers, isAccountingVoucherBalanced } from './financeAccountingVoucherModel';
import { ensurePayrollIitDeclarationPreparationRecords } from './financeDeclarationPreparationData';
import {
  buildPayrollIitDeclarationEmployeeRows,
  buildPayrollIitDeclarationSourceSnapshotKey,
  buildPayrollIitDeclarationSummary
} from './financePayrollIitDeclarationModel';
import { financeReceivablePayableRecords } from './financeReceivablesPayablesData';
import {
  buildFinanceReceivablePayableSettlementTransaction,
  getFinanceReceivablePayableRegisterableAmount,
  getFinanceReceivablePayableSettlementSnapshot
} from './financeReceivablesPayablesModel';
import {
  buildNaturalPersonPaymentFacts,
  buildResidentLaborPaymentSnapshot,
  calculateResidentLaborWithholding,
  getUnrepresentedPostedNaturalPersonPayments
} from './financeNaturalPersonPaymentModel';
import { buildPartTimeLaborReceivablePayableRecord } from './financePartTimeLaborSettlementModel';

type UnitTest = { name: string; run: () => void };

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function getLaborPayable() {
  const record = financeReceivablePayableRecords.find((row) => row.documentNo === 'AP-202606-003');

  if (!record) {
    throw new Error('expected labor payable AP-202606-003');
  }

  return record;
}

function createLaborTransaction(
  overrides: Partial<FinanceTransactionRecord> = {}
): FinanceTransactionRecord {
  const accountRef = getFinanceSeedPublicAccountRef('cmb-basic');
  const naturalPersonPayment = buildResidentLaborPaymentSnapshot({
    grossIncomeAmount: 3200,
    identityNo: '430104199605191128',
    paymentFactId: 'labor:TASK-001:20260006',
    personId: 'people-parttime-001',
    personName: '示例兼职 B',
    sourceBatchNo: 'TASK-001',
    taxPeriod: '2026-06'
  });

  return {
    accountingPeriod: '2026-06',
    amount: naturalPersonPayment.netPaymentAmount,
    category: '外协付款',
    categorySnapshot: getFinanceCategorySnapshot('外协付款'),
    counterparty: '示例兼职 B',
    counterpartyType: '外协',
    currency: 'CNY',
    direction: '支出',
    files: [{ id: 'file-1', name: '付款回单.pdf', status: '已上传', type: '付款回单', updatedAt: '2026-06-12' }],
    id: 'fin-labor-1',
    naturalPersonPayment,
    note: '',
    occurredAt: '2026-06-12',
    operationRecords: [],
    paymentMethod: '对公账户付款',
    publicAccountId: accountRef.publicAccountId,
    publicAccountSnapshot: accountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: 'AP-LABOR-001',
    sourceTitle: '任务劳务结算',
    sourceType: '外协结算',
    status: '已入账',
    transactionNo: 'FIN-LABOR-001',
    updatedAt: '2026-06-12',
    voucherStatus: '已上传',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'NP-04 calculates resident labor withholding from a tax-inclusive agreement amount',
    run: () => {
      const result = calculateResidentLaborWithholding(3200);
      assertEqual(result.deductibleExpenseAmount, 800, 'labor expense deduction should be 800');
      assertEqual(result.taxableIncomeAmount, 2400, 'taxable labor income should be 2400');
      assertEqual(result.withheldTaxAmount, 480, 'withheld IIT should be 480');
      assertEqual(result.netPaymentAmount, 2720, 'bank payment should be the net amount');

      const payable = buildPartTimeLaborReceivablePayableRecord(
        {
          batchKey: 'part-time-labor:2026-06:20260006:project-a',
          employeeName: '示例兼职 B',
          employeeNo: '20260006',
          grossAmount: 3200,
          id: 'part-time-labor:2026-06:20260006:project-a',
          laborProjectId: 'project-a',
          settlementPeriod: '2026-06',
          sources: [
            {
              acceptanceId: 'acceptance-a',
              acceptedAt: '2026-06-18 16:00',
              agreementVersion: 'AGREEMENT-A',
              employeeName: '示例兼职 B',
              employeeNo: '20260006',
              grossAmount: 3200,
              grossAmountSource: { field: 'agreedGrossAmount', kind: '任务约定', recordId: 'task-a/agreement' },
              id: 'source-a',
              laborProjectId: 'project-a',
              settlementPeriod: '2026-06',
              taskId: 'task-a',
              taskName: '兼职任务 A',
              taskNo: 'TASK-A'
            }
          ],
          taxIdentityStatus: '居民个人'
        },
        { id: '20260006', identityNo: '430104199605191128' }
      );
      assertEqual(payable.amount, 3200, 'accepted labor batch should become one gross payable');
      assertEqual(payable.naturalPersonPayment?.sourceRecordNos?.[0], 'TASK-A', 'labor payable should retain task source numbers');
    }
  },
  {
    name: 'collects posted labor facts and removes only a fully reversed origin',
    run: () => {
      const origin = createLaborTransaction();
      const pendingReversal = createLaborTransaction({
        adjustmentContext: { mode: '冲正', originTransactionNo: origin.transactionNo, reason: '测试冲正' },
        amount: origin.amount,
        id: 'fin-labor-reversal',
        naturalPersonPayment: undefined,
        sourceType: '流水冲正',
        status: '待复核',
        transactionNo: 'FIN-LABOR-R001'
      });
      assertEqual(buildNaturalPersonPaymentFacts([], [origin, pendingReversal]).length, 1, 'pending reversal must not remove tax fact');

      const partialPostedReversal = {
        ...pendingReversal,
        amount: 1,
        status: '已入账' as const
      };
      assertEqual(
        buildNaturalPersonPaymentFacts([], [origin, partialPostedReversal]).length,
        1,
        'a partial posted reversal must not remove the complete labor tax fact'
      );

      const postedReversal = { ...pendingReversal, status: '已入账' as const };
      assertEqual(buildNaturalPersonPaymentFacts([], [origin, postedReversal]).length, 0, 'posted reversal must remove origin tax fact');
    }
  },
  {
    name: 'registers labor bank payment at net amount while reserving and settling the gross payable',
    run: () => {
      const record = getLaborPayable();
      const publicAccountRef = getFinanceSeedPublicAccountRef('cmb-basic');
      const transaction = buildFinanceReceivablePayableSettlementTransaction(
        record,
        {
          amount: 3200,
          files: [{ id: 'labor-payment-file', name: '劳务付款回单.pdf', status: '已上传', type: '付款回单', updatedAt: '2026-06-18' }],
          note: '',
          occurredAt: '2026-07-02',
          publicAccountId: publicAccountRef.publicAccountId
        },
        [],
        publicAccountRef
      );

      assertEqual(transaction.amount, 2720, 'bank transaction must use labor net payment');
      assertEqual(transaction.naturalPersonPayment?.grossIncomeAmount, 3200, 'transaction must retain gross labor income');
      assertEqual(transaction.naturalPersonPayment?.withheldTaxAmount, 480, 'transaction must retain withheld IIT');
      assertEqual(transaction.naturalPersonPayment?.taxPeriod, '2026-07', 'labor withholding period must follow the actual payment month');
      assertEqual(getFinanceReceivablePayableRegisterableAmount(record, [transaction]), 0, 'pending labor registration must reserve gross payable');
      const postedSnapshot = getFinanceReceivablePayableSettlementSnapshot(record, [{ ...transaction, status: '已入账' }]);
      assertEqual(postedSnapshot.settledAmount, 3200, 'posted net payment must settle gross payable');
      assertEqual(postedSnapshot.settlementStatus, '已结清', 'gross payable must become settled');
    }
  },
  {
    name: 'NP-16 creates balanced labor cash voucher with gross payable, net bank payment and withheld IIT',
    run: () => {
      const transaction = createLaborTransaction();
      const voucher = buildAccountingVouchers([], [transaction]).find((row) => row.sourceNo === transaction.transactionNo);

      if (!voucher) {
        throw new Error('expected accounting voucher for posted labor transaction');
      }

      const payableDebit = voucher.lines.find((line) => line.side === '借方' && line.subjectCode === '2202');
      const bankCredit = voucher.lines.find((line) => line.side === '贷方' && line.subjectCode === '1002');
      const iitCredit = voucher.lines.find((line) => line.side === '贷方' && line.subjectCode === '2221.03');
      assertEqual(payableDebit?.amount, 3200, 'labor voucher must debit gross payable');
      assertEqual(bankCredit?.amount, 2720, 'labor voucher must credit net bank payment');
      assertEqual(iitCredit?.amount, 480, 'labor voucher must credit withheld IIT liability');
      assertEqual(isAccountingVoucherBalanced(voucher), true, 'labor cash voucher must balance');
    }
  },
  {
    name: 'NP-14 includes posted labor in IIT declaration and removes it after posted reversal',
    run: () => {
      const origin = createLaborTransaction();
      const rows = buildPayrollIitDeclarationEmployeeRows([], '2026-06', [origin]);
      assertEqual(rows.length, 1, 'posted labor must create one IIT declaration row');
      assertEqual(rows[0]?.incomeType, '劳务报酬', 'IIT row must keep labor income type');
      assertEqual(rows[0]?.currentIncomeAmount, 3200, 'IIT row must report gross labor income');
      assertEqual(rows[0]?.personalIncomeTaxAmount, 480, 'IIT row must report withheld tax');
      assertEqual(buildPayrollIitDeclarationSummary([], '2026-06', [origin]).readyForConfirmation, true, 'complete labor fact must be confirmable');
      const laborOnlyPreparationRows = ensurePayrollIitDeclarationPreparationRecords([], [], [origin]);
      assertEqual(laborOnlyPreparationRows[0]?.period, '2026-06', 'posted labor must create an IIT preparation period without salary payments');

      const reversal = createLaborTransaction({
        adjustmentContext: { mode: '冲正', originTransactionNo: origin.transactionNo, reason: '付款冲正' },
        amount: origin.amount,
        id: 'fin-labor-posted-reversal',
        naturalPersonPayment: undefined,
        sourceType: '流水冲正',
        status: '已入账',
        transactionNo: 'FIN-LABOR-R001'
      });
      assertEqual(buildPayrollIitDeclarationEmployeeRows([], '2026-06', [origin, reversal]).length, 0, 'posted reversal must remove labor filing fact');
      assertEqual(
        buildPayrollIitDeclarationSourceSnapshotKey([], '2026-06', [origin]) ===
          buildPayrollIitDeclarationSourceSnapshotKey([], '2026-06', [origin, reversal]),
        false,
        'posted reversal must invalidate the filing source snapshot'
      );
    }
  },
  {
    name: 'counts unique natural persons instead of payment rows',
    run: () => {
      const first = createLaborTransaction();
      const second = createLaborTransaction({
        id: 'fin-labor-2',
        naturalPersonPayment: {
          ...first.naturalPersonPayment!,
          paymentFactId: 'labor:TASK-002:20260006',
          sourceBatchNo: 'TASK-002'
        },
        sourceNo: 'AP-LABOR-002',
        transactionNo: 'FIN-LABOR-002'
      });
      const summary = buildPayrollIitDeclarationSummary([], '2026-06', [first, second]);

      assertEqual(summary.reportCount, 1, 'multiple labor payments to one person must count as one participant');
      assertEqual(summary.confirmedCount, 1, 'confirmed participant count must be deduplicated');
      assertEqual(summary.payableAmount, 960, 'withholding must still aggregate all payment facts');
    }
  },
  {
    name: 'NP-07 blocks posted salary and labor transactions without a natural-person payment snapshot',
    run: () => {
      const orphanSalary = createLaborTransaction({
        naturalPersonPayment: undefined,
        sourceNo: 'PAY-ORPHAN-001',
        sourceType: '薪酬发放',
        transactionNo: 'FIN-SALARY-ORPHAN'
      });
      const laborPayable = getLaborPayable();
      const orphanLabor = createLaborTransaction({
        naturalPersonPayment: undefined,
        sourceNo: laborPayable.documentNo,
        transactionNo: 'FIN-LABOR-ORPHAN'
      });
      assertEqual(
        getUnrepresentedPostedNaturalPersonPayments([], [orphanSalary]).length,
        1,
        'posted salary without a payment record must be reported'
      );
      assertEqual(
        getUnrepresentedPostedNaturalPersonPayments([], [orphanLabor], [laborPayable]).length,
        1,
        'posted payment linked to a natural-person labor payable must be reported even when its tax snapshot is missing'
      );
      assertEqual(
        buildPayrollIitDeclarationSummary([], '2026-06', [orphanLabor], [laborPayable]).readyForConfirmation,
        false,
        'orphan labor payment must block IIT preparation confirmation'
      );
      assertEqual(
        ensurePayrollIitDeclarationPreparationRecords([], [], [orphanLabor], [laborPayable]).length,
        1,
        'orphan labor payment must still create its monthly IIT preparation task'
      );
    }
  }
];

export function runFinanceNaturalPersonPaymentModelTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];
  let passed = 0;

  tests.forEach((test) => {
    try {
      test.run();
      passed += 1;
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${(error as Error).message}`);
    }
  });

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed,
    passedTestNames,
    total: tests.length
  };
}
