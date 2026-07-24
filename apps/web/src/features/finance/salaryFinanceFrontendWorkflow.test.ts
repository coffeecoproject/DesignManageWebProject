import type { AttendanceMonthlyReport } from '../people/peopleAttendanceMonthlyDomain';
import { peopleMembers } from '../people/mockData';
import {
  buildSalaryMonthlyReports,
  reverseSalaryPaymentByFinanceTransaction,
  validateSalaryPaymentConfirmation,
  type SalaryMonthlyWorkflowRecord,
  type SalaryPaymentRecord,
  type SalaryPersonalIncomeTaxCumulativeSnapshot
} from '../salary/salaryDomain';
import { confirmSalaryMonthlyReportState } from '../salary/salaryManagementWorkflow';
import type { SalaryIitProfile } from '../salary/salaryPersonalIncomeTaxModel';
import type { SocialInsuranceEmployeeRecord } from './financeSocialInsuranceData';
import { buildSocialInsurancePayrollDeductions } from './financeSocialInsuranceModel';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVoucherFromReceivablePayable,
  buildAccountingVoucherFromTransaction,
  createAccountingVoucherLifecycleRecord
} from './financeAccountingVoucherModel';
import { financeTransactionRecords, getFinanceSeedPublicAccountRef } from './financeData';
import {
  buildFinanceTransactionAdjustmentRecord,
  createFinanceTransactionAdjustmentForm
} from './financeTransactionAdjustmentModel';
import {
  applyDeclarationPreparationSourceState,
  ensurePayrollIitDeclarationPreparationRecords
} from './financeDeclarationPreparationData';
import { buildPayrollIitDeclarationEmployeeRows } from './financePayrollIitDeclarationModel';
import { commitPayrollIitCorrectionAfterPostedReversal } from './financePayrollIitCorrectionWorkflow';
import { mergeSalaryReceivablePayableRecords } from './financeSalarySettlementModel';
import {
  buildFinanceReceivablePayableSettlementTransaction,
  deriveFinanceReceivablePayableSettlementRows
} from './financeReceivablesPayablesModel';
import {
  commitFinanceReceivablePayableSettlementRegistration,
  commitFinanceTransactionAdjustmentRegistration,
  commitFinanceTransactionReview
} from './financeSettlementWorkflow';
import { financeTaxMatterRecords } from './financeTaxFilingData';

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

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function createWorkdayDates(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const dates: string[] = [];

  for (
    let cursor = new Date(year, monthIndex, 1);
    cursor.getMonth() === monthIndex;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
      dates.push(`${month}-${String(cursor.getDate()).padStart(2, '0')}`);
    }
  }

  return dates;
}

function createAttendanceReport(month: string): AttendanceMonthlyReport {
  const member = peopleMembers.find((person) => person.id === '20250018');

  assert(member, 'salary frontend workflow fixture requires the full-time employee');

  const expectedWorkdayDates = createWorkdayDates(month);
  const expectedWorkdays = expectedWorkdayDates.length;
  const expectedWorkHours = expectedWorkdays * 8;

  return {
    adjustmentDays: 0,
    adjustmentHours: 0,
    canAdjust: true,
    expectedWorkdayDates,
    expectedWorkHours,
    expectedWorkdays,
    id: `${month}-${member.id}`,
    leaveDays: 0,
    leaveHours: 0,
    makeupWorkDays: 0,
    makeupWorkHours: 0,
    member,
    month,
    payableAttendanceDays: expectedWorkdays,
    payableAttendanceHours: expectedWorkHours,
    payrollDeductionEntries: [],
    payrollDeductionDays: 0,
    payrollDeductionHours: 0,
    payrollIncreaseDays: 0,
    payrollIncreaseHours: 0,
    relatedAdjustments: [],
    relatedExceptions: [],
    restBalanceDays: 0,
    restBalanceHours: 0,
    restCoveredDays: 0,
    restCoveredHours: 0,
    restDays: 0,
    restHours: 0,
    restUncoveredDays: 0,
    restUncoveredHours: 0,
    salarySettlementStatus: '未结算',
    status: '已确认',
    temporaryUnavailableDays: 0,
    temporaryUnavailableHours: 0,
    workCalendarName: '公司默认双休 / 双休'
  };
}

function createSocialInsuranceRecords(month: string): SocialInsuranceEmployeeRecord[] {
  const common = {
    contributionBase: 12000,
    department: '财务部',
    employeeName: '陈浩',
    employeeNo: '20250018',
    handlingStatus: '待缴费' as const,
    operationRecords: [],
    period: month,
    originalPeriod: month,
    handlingPeriod: month,
    eligibilitySnapshot: '应参保' as const,
    items: [],
    estimatedEmployerAmount: 0,
    estimatedEmployeeAmount: 0,
    assessedEmployerAmount: 0,
    assessedEmployeeAmount: 0,
    assessmentFileIds: ['assessment-file-001'],
    paymentFileIds: [],
    position: '主案设计师',
    salaryBase: 12000,
    updatedAt: `${month}-28`
  };

  return [
    {
      ...common,
      category: '社保',
      companyAmount: 2214,
      estimatedEmployerAmount: 2214,
      estimatedEmployeeAmount: 861,
      assessedEmployerAmount: 2214,
      assessedEmployeeAmount: 861,
      id: `social-20250018-${month}`,
      personalAmount: 861
    },
    {
      ...common,
      category: '公积金',
      companyAmount: 820,
      estimatedEmployerAmount: 820,
      estimatedEmployeeAmount: 820,
      assessedEmployerAmount: 820,
      assessedEmployeeAmount: 820,
      id: `housing-20250018-${month}`,
      personalAmount: 820
    }
  ];
}

function createIitProfile(taxYear: string): SalaryIitProfile {
  return {
    acquiredAt: `${taxYear}-01-02`,
    acquisitionStatus: '已获取',
    basicDeductionMethod: '按月累计',
    deductionItems: [],
    employeeNo: '20250018',
    employmentScenario: '普通任职',
    evidenceFiles: [],
    firstEmploymentEvidenceFiles: [],
    personnelReportedAt: `${taxYear}-01-02`,
    personnelReportingStatus: '已报送',
    residentType: '居民个人',
    source: '自然人电子税务局',
    taxYear,
    updatedAt: `${taxYear}-01-02`
  };
}

function createIitSnapshot(period: string): SalaryPersonalIncomeTaxCumulativeSnapshot {
  return {
    cumulativeAdditionalDeductionAmount: 0,
    cumulativeBasicDeductionAmount: 30000,
    cumulativeIncomeAmount: 72000,
    cumulativeOtherDeductionAmount: 0,
    cumulativeSpecialDeductionAmount: 10086,
    cumulativeTaxAmount: 957.42,
    cumulativeTaxableIncomeAmount: 31914,
    cumulativeWithheldTaxAmount: 957.42,
    employeeNo: '20250018',
    period,
    taxYear: period.slice(0, 4),
    updatedAt: `${period}-30`
  };
}

function getVoucherLineAmount(
  voucher: NonNullable<ReturnType<typeof buildAccountingVoucherFromReceivablePayable>>,
  subjectCode: string
) {
  return voucher.lines.find((line) => (line.subject?.code ?? line.subjectCode) === subjectCode)?.amount;
}

function createPaidSalaryReversalFixture() {
  const originTransaction = financeTransactionRecords.find(
    (record) => record.transactionNo === 'FIN-202606-0019'
  );

  assert(originTransaction, 'salary reversal fixture requires the posted May salary transaction');

  const settlementSnapshot = {
    businessDeductionAmount: 0,
    employeeGrossPayableAmount: 12000,
    employeeHousingFundAmount: 0,
    employeeNetPayableAmount: 11059.83,
    employeeSocialInsuranceAmount: 861,
    employerContributionAmount: 2214,
    employerHousingFundAmount: 0,
    employerSocialInsuranceAmount: 2214,
    grossEarningsAmount: 12000,
    payrollMonth: '2026-05',
    payrollNo: 'PAY-202605-20250018',
    taxableIncomeAmount: 12000,
    totalEmploymentCostAmount: 14214,
    withheldPersonalIncomeTaxAmount: 79.17
  };
  const payment: SalaryPaymentRecord = {
    employeeName: '陈浩',
    employeeNo: '20250018',
    financeTransactionNo: originTransaction.transactionNo,
    id: 'salary-payment-reversal-fixture',
    identityNo: '420102199108062048',
    paidAt: '2026-06-15 10:30',
    paidBy: '周倩',
    paymentAccountName: '工商银行备用付款户',
    paymentEvidenceStatus: '已核验',
    payrollMonth: '2026-05',
    payrollNo: 'PAY-202605-20250018',
    position: '财务专员',
    settlementSnapshot,
    taxPeriod: '2026-06'
  };
  const workflow: SalaryMonthlyWorkflowRecord = {
    confirmedAt: '2026-06-10 10:00',
    confirmedBy: '李明',
    id: 'salary-workflow-reversal-fixture',
    memberId: payment.employeeNo,
    month: payment.payrollMonth,
    note: '五月薪酬已发放',
    paidAt: payment.paidAt,
    paidBy: payment.paidBy,
    payrollNo: payment.payrollNo,
    salaryCompositionLines: [
      {
        amount: 12000,
        direction: '应发',
        id: 'base-salary',
        item: '基础薪资',
        note: '五月确认快照',
        source: '人员档案'
      }
    ],
    salarySettlementReferences: ['performance-result:may-prepay:v1'],
    settlementSnapshot,
    settlementSourceRecords: [],
    status: '已发放',
    updatedAt: payment.paidAt
  };

  return { originTransaction, payment, workflow };
}

const tests: UnitTest[] = [
  {
    name: 'NP-19 FRONTEND-CHAIN confirms salary and derives payable, liabilities, IIT and social-insurance reconciliation',
    run: () => {
      const month = '2026-07';
      const socialInsuranceRecords = createSocialInsuranceRecords(month);
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport(month)],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: [createIitSnapshot('2026-06')],
        personalIncomeTaxProfiles: [createIitProfile('2026')],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: buildSocialInsurancePayrollDeductions(socialInsuranceRecords, month),
        socialInsuranceSourceRecords: socialInsuranceRecords
      })[0];

      assert(report, 'salary source facts should produce a monthly report');
      assertEqual(report.status, '待确认', 'confirmed source facts should expose the frontend confirmation action');

      const stateResult = confirmSalaryMonthlyReportState({
        confirmedAt: '2026-07-31 10:30',
        confirmedBy: '李明',
        note: '七月薪酬明细已确认',
        report,
        salaryDetailMonths: [],
        salaryMonthlyWorkflows: []
      });

      assert(stateResult.success, 'the same frontend workflow used by the page should confirm the salary report');
      const workflow = stateResult.salaryMonthlyWorkflows[0];
      assert(workflow?.settlementSnapshot, 'frontend confirmation should freeze the salary settlement snapshot');

      const receivablePayableRows = mergeSalaryReceivablePayableRecords({
        payments: [],
        people: [report.member],
        records: [],
        workflows: stateResult.salaryMonthlyWorkflows
      });
      const salaryPayable = receivablePayableRows[0];

      assert(salaryPayable?.salarySettlement, 'confirmed salary state should derive a salary payable record');
      assertEqual(
        salaryPayable.amount,
        report.settlementSnapshot.employeeNetPayableAmount,
        'salary payable should contain employee net cash payable only'
      );

      const voucher = buildAccountingVoucherFromReceivablePayable(salaryPayable, 0);
      assert(voucher, 'confirmed salary payable should derive an accrual voucher');

      const debitTotal = roundMoney(
        voucher.lines.filter((line) => line.side === '借方').reduce((total, line) => total + line.amount, 0)
      );
      const creditTotal = roundMoney(
        voucher.lines.filter((line) => line.side === '贷方').reduce((total, line) => total + line.amount, 0)
      );
      const settlement = report.settlementSnapshot;

      assertEqual(debitTotal, settlement.totalEmploymentCostAmount, 'salary expense should include gross payroll and employer contributions');
      assertEqual(creditTotal, debitTotal, 'split salary liabilities should keep the accrual voucher balanced');
      assertEqual(getVoucherLineAmount(voucher, '2211.01'), settlement.employeeNetPayableAmount, 'net salary should enter employee payable');
      assertEqual(getVoucherLineAmount(voucher, '2221.03'), settlement.withheldPersonalIncomeTaxAmount, 'IIT withholding should enter the IIT liability');
      assertEqual(
        voucher.lines.filter((line) => (line.subject?.code ?? line.subjectCode) === '2211.03').reduce((total, line) => total + line.amount, 0),
        settlement.employeeSocialInsuranceAmount + settlement.employerSocialInsuranceAmount,
        'employee and employer social insurance should enter the social-insurance liability'
      );
      assertEqual(
        voucher.lines.filter((line) => (line.subject?.code ?? line.subjectCode) === '2211.04').reduce((total, line) => total + line.amount, 0),
        settlement.employeeHousingFundAmount + settlement.employerHousingFundAmount,
        'employee and employer housing fund should enter the housing-fund liability'
      );
      assertEqual(buildAccountingLedgerEntries([voucher]).length, 0, 'unbooked salary accrual must not enter the general ledger');
      const bookedVoucher = applyAccountingVoucherLifecycle(
        [voucher],
        [createAccountingVoucherLifecycleRecord(voucher, '记-202607-101', '李明', '2026-07-31 11:00')]
      );
      const salaryLedgerEntries = buildAccountingLedgerEntries(bookedVoucher);

      assertEqual(
        salaryLedgerEntries.length,
        voucher.lines.length,
        'booked salary accrual should create one general-ledger entry per split liability line'
      );
      assert(
        salaryLedgerEntries.some((entry) => entry.subjectCode === '2211.01' && entry.creditAmount === settlement.employeeNetPayableAmount),
        'booked salary accrual should retain employee net payable in the ledger'
      );

      const socialInsurance = socialInsuranceRecords.find((record) => record.category === '社保');
      const housingFund = socialInsuranceRecords.find((record) => record.category === '公积金');
      assert(socialInsurance && housingFund, 'social insurance source facts should retain both categories');
      assertEqual(settlement.employeeSocialInsuranceAmount, socialInsurance.personalAmount, 'salary personal social insurance should reconcile to the confirmed source');
      assertEqual(settlement.employerSocialInsuranceAmount, socialInsurance.companyAmount, 'employer social insurance should reconcile to the confirmed source');
      assertEqual(settlement.employeeHousingFundAmount, housingFund.personalAmount, 'salary personal housing fund should reconcile to the confirmed source');
      assertEqual(settlement.employerHousingFundAmount, housingFund.companyAmount, 'employer housing fund should reconcile to the confirmed source');
      assertEqual(report.personalIncomeTaxAmount, settlement.withheldPersonalIncomeTaxAmount, 'salary IIT display should reconcile to the frozen settlement');
    }
  },
  {
    name: 'NP-19 FRONTEND-CHAIN registers, reviews and binds the net salary payment through one payroll number',
    run: () => {
      const month = '2026-07';
      const profile = createIitProfile('2026');
      const cumulativeSnapshots = [createIitSnapshot('2026-06')];
      const report = buildSalaryMonthlyReports({
        attendanceReports: [createAttendanceReport(month)],
        performanceRecords: [],
        personalIncomeTaxCumulativeSnapshots: cumulativeSnapshots,
        personalIncomeTaxProfiles: [profile],
        salaryAdjustments: [],
        salaryMonthlyWorkflows: [],
        socialInsuranceDeductions: buildSocialInsurancePayrollDeductions(
          createSocialInsuranceRecords(month),
          month
        ),
        socialInsuranceSourceRecords: createSocialInsuranceRecords(month)
      })[0];

      assert(report, 'salary payment workflow requires a monthly report');
      const confirmation = confirmSalaryMonthlyReportState({
        confirmedAt: '2026-07-31 10:30',
        confirmedBy: '李明',
        note: '七月薪酬明细已确认',
        report,
        salaryDetailMonths: [],
        salaryMonthlyWorkflows: []
      });

      assert(confirmation.success, 'salary confirmation should succeed before payment');
      const workflow = confirmation.salaryMonthlyWorkflows[0];
      assert(workflow?.settlementSnapshot && workflow.payrollNo, 'confirmed salary should freeze a payroll number and settlement');
      const payable = mergeSalaryReceivablePayableRecords({
        payments: [],
        people: [report.member],
        records: [],
        workflows: [workflow]
      })[0];
      const publicAccountRef = getFinanceSeedPublicAccountRef();

      assert(payable, 'confirmed salary should derive the employee net payable');
      const paymentTransaction = buildFinanceReceivablePayableSettlementTransaction(
        payable,
        {
          amount: payable.amount,
          files: [{
            id: 'salary-payment-proof',
            name: '七月工资付款回单.pdf',
            status: '已选择',
            type: '付款凭证',
            updatedAt: '2026-08-15'
          }],
          note: '',
          occurredAt: '2026-08-15',
          publicAccountId: publicAccountRef.publicAccountId
        },
        [],
        publicAccountRef
      );

      assertEqual(
        paymentTransaction.sourceNo,
        workflow.payrollNo,
        'salary payment cash flow should retain the payroll number used by salary and IIT'
      );
      const registration = commitFinanceReceivablePayableSettlementRegistration(
        { financeRows: [], receivablePayableRows: [payable] },
        payable.id,
        paymentTransaction
      );

      assert(registration.success, 'salary payment should register from the payable workbench');
      const review = commitFinanceTransactionReview(registration, {
        operationId: 'salary-payment-review',
        reviewedAt: '2026-08-15 11:00',
        reviewer: '财务复核',
        transactionId: paymentTransaction.id
      });

      assert(review.success, 'salary payment should post through finance review');
      const derivedPayable = deriveFinanceReceivablePayableSettlementRows(
        review.receivablePayableRows,
        review.financeRows
      )[0];
      assertEqual(derivedPayable?.settlementStatus, '已结清', 'posted salary payment should settle the employee net payable');
      assertEqual(derivedPayable?.settledAmount, payable.amount, 'settled salary amount should equal employee net payable');
      const postedTransaction = review.financeRows.find((row) => row.id === paymentTransaction.id);
      assert(postedTransaction, 'review should retain the posted salary transaction');
      const paymentVoucher = buildAccountingVoucherFromTransaction(postedTransaction, 0);
      if (!paymentVoucher) {
        throw new Error('posted salary transaction should derive a funds voucher');
      }
      assertEqual(paymentVoucher.sourceNo, postedTransaction.transactionNo, 'funds voucher should retain the reviewed transaction number');
      assertEqual(paymentVoucher.status, '待记账', 'reviewed salary payment should enter the voucher workbench as ready to book');
      assertEqual(paymentVoucher.amount, payable.amount, 'funds voucher amount should equal employee net payable');
      assertEqual(
        paymentVoucher.lines.find((line) => line.side === '借方')?.subjectCode,
        '2211.01',
        'salary payment should debit employee salary payable'
      );
      assertEqual(
        paymentVoucher.lines.find((line) => line.side === '贷方')?.subjectCode,
        '1002',
        'salary payment should credit bank deposit'
      );
      assertEqual(buildAccountingLedgerEntries([paymentVoucher]).length, 0, 'unbooked salary payment must not enter the general ledger');
      const bookedPaymentVoucher = applyAccountingVoucherLifecycle(
        [paymentVoucher],
        [createAccountingVoucherLifecycleRecord(paymentVoucher, '记-202608-101', '李明', '2026-08-15 11:10')]
      );
      const paymentLedgerEntries = buildAccountingLedgerEntries(bookedPaymentVoucher);

      assertEqual(paymentLedgerEntries.length, 2, 'booked salary payment should create payable and bank ledger entries');
      assert(
        paymentLedgerEntries.some((entry) => entry.subjectCode === '2211.01' && entry.debitAmount === payable.amount),
        'booked salary payment should clear employee net payable'
      );
      assert(
        paymentLedgerEntries.some((entry) => entry.subjectCode === '1002' && entry.creditAmount === payable.amount),
        'booked salary payment should reduce bank deposit'
      );
      const confirmedReport = {
        ...report,
        settlementSnapshot: workflow.settlementSnapshot,
        status: '已确认' as const,
        workflow
      };
      const paymentValidation = validateSalaryPaymentConfirmation({
        evidence: {
          accountName: postedTransaction.publicAccountSnapshot.displayName,
          amount: postedTransaction.amount,
          financeTransactionNo: postedTransaction.transactionNo,
          occurredAt: postedTransaction.occurredAt,
          payrollNo: postedTransaction.sourceNo,
          status: '已入账'
        },
        personalIncomeTaxCumulativeSnapshots: cumulativeSnapshots,
        personalIncomeTaxProfile: profile,
        report: confirmedReport
      });

      if (!paymentValidation.allowed) {
        throw new Error(`posted salary transaction should bind back to payroll: ${paymentValidation.reason}`);
      }
      assertEqual(
        paymentValidation.payment.financeTransactionNo,
        postedTransaction.transactionNo,
        'salary payment fact should freeze the reviewed finance transaction number'
      );
    }
  },
  {
    name: 'NP-19 FRONTEND-CHAIN posts salary reversal before removing IIT source and reopens the frozen salary for repayment',
    run: () => {
      const { originTransaction, payment, workflow } = createPaidSalaryReversalFixture();
      const initialIitRows = buildPayrollIitDeclarationEmployeeRows(
        [payment],
        '2026-06',
        [originTransaction]
      );

      assertEqual(initialIitRows.length, 1, 'posted salary payment should enter payment-month IIT before reversal');

      const reversal = buildFinanceTransactionAdjustmentRecord({
        existingRows: [originTransaction],
        files: [
          {
            id: 'salary-reversal-evidence',
            name: '工资退回冲正依据.pdf',
            status: '已上传',
            type: '调整凭证',
            updatedAt: '2026-06-20'
          }
        ],
        form: {
          ...createFinanceTransactionAdjustmentForm(originTransaction),
          occurredAt: '2026-06-20',
          reason: '银行退回原工资付款'
        },
        originRecord: originTransaction
      });
      const registration = commitFinanceTransactionAdjustmentRegistration(
        { financeRows: [originTransaction], receivablePayableRows: [] },
        reversal
      );

      assert(registration.success, 'salary reversal registration should succeed');
      assertEqual(
        buildPayrollIitDeclarationEmployeeRows(
          [payment],
          '2026-06',
          registration.financeRows
        ).length,
        1,
        'pending-review reversal must not remove the salary IIT source early'
      );

      const reversalReview = commitFinanceTransactionReview(registration, {
        operationId: 'salary-reversal-review',
        reviewedAt: '2026-06-20 15:30',
        reviewer: '财务复核',
        transactionId: reversal.id
      });

      assert(reversalReview.success, 'salary reversal should be posted through finance review');
      assertEqual(
        buildPayrollIitDeclarationEmployeeRows(
          [payment],
          '2026-06',
          reversalReview.financeRows
        ).length,
        0,
        'posted reversal should remove the unfiled salary IIT source'
      );

      const salaryReversal = reverseSalaryPaymentByFinanceTransaction({
        actor: '李明',
        financeTransactionNo: originTransaction.transactionNo,
        occurredAt: '2026-06-20 15:30',
        salaryMonthlyWorkflows: [workflow],
        salaryPaymentRecords: [payment]
      });

      assert(salaryReversal.success, 'posted finance reversal should synchronize salary state');
      assertEqual(salaryReversal.salaryPaymentRecords.length, 0, 'reversed salary payment fact should be removed');
      assertEqual(salaryReversal.salaryMonthlyWorkflows[0]?.status, '已确认', 'salary should reopen at confirmed state for repayment');
      assertEqual(salaryReversal.salaryMonthlyWorkflows[0]?.paidAt, undefined, 'reopened salary should clear original paid time');
      assertEqual(
        salaryReversal.salaryMonthlyWorkflows[0]?.paymentLifecycleRecords?.length,
        2,
        'reopened salary should retain both the original payment link and the reversal event'
      );
      assertEqual(
        salaryReversal.salaryMonthlyWorkflows[0]?.paymentLifecycleRecords?.[1]?.action,
        '发放流水冲正',
        'salary lifecycle should identify the reversal explicitly'
      );
      assertEqual(
        salaryReversal.salaryMonthlyWorkflows[0]?.salarySettlementReferences?.[0],
        workflow.salarySettlementReferences?.[0],
        'reversal should preserve claimed performance settlement references'
      );
      assertEqual(
        salaryReversal.salaryMonthlyWorkflows[0]?.settlementSnapshot,
        workflow.settlementSnapshot,
        'reversal should preserve the confirmed salary settlement snapshot'
      );
      assertEqual(
        JSON.stringify(salaryReversal.salaryMonthlyWorkflows[0]?.salaryCompositionLines),
        JSON.stringify(workflow.salaryCompositionLines),
        'reversal should preserve the frozen payslip composition'
      );
    }
  },
  {
    name: 'NP-19 FRONTEND-CHAIN preserves filed salary IIT and creates one correction version after posted reversal',
    run: () => {
      const { originTransaction, payment } = createPaidSalaryReversalFixture();
      const generatedPreparation = ensurePayrollIitDeclarationPreparationRecords(
        [],
        [payment],
        [originTransaction],
        []
      )[0];

      assert(generatedPreparation, 'posted salary payment should generate an IIT preparation record');
      const readyPreparation = applyDeclarationPreparationSourceState(
        [generatedPreparation],
        [],
        [originTransaction],
        [],
        [],
        [],
        [payment]
      )[0];

      assert(readyPreparation?.iitEmployeeRows?.[0], 'salary IIT preparation should retain one employee source row');
      assertEqual(
        readyPreparation.iitEmployeeRows[0].sourceTransactionNos?.[0],
        originTransaction.transactionNo,
        'filed salary row should retain the source finance transaction'
      );
      const filedPreparation = {
        ...readyPreparation,
        confirmedIitEmployeeRows: readyPreparation.iitEmployeeRows,
        confirmedIitSummary: readyPreparation.iitSummary,
        confirmedSourceSnapshotKey: readyPreparation.sourceSnapshotKey,
        status: '已进入税务办理' as const
      };
      const seedTaxMatter = financeTaxMatterRecords.find((record) => record.matterType === '个人所得税');

      assert(seedTaxMatter, 'IIT tax matter seed should exist');
      const declarationForm = {
        id: 'np-19-salary-declaration-form',
        name: '2026-06 个税正式申报表.pdf',
        status: '已上传' as const,
        type: '正式申报表',
        updatedAt: '2026-07-10'
      };
      const declarationResult = {
        id: 'np-19-salary-declaration-result',
        name: '2026-06 个税申报结果回执.pdf',
        status: '已上传' as const,
        type: '申报结果回执',
        updatedAt: '2026-07-10'
      };
      const filedTaxMatter = {
        ...seedTaxMatter,
        dataStatus: '已确认' as const,
        declarationDate: '2026-07-10',
        declarationDueDate: '2026-07-15',
        declarationFormFileIds: [declarationForm.id],
        declarationResultFileId: declarationResult.id,
        declarationVerificationStatus: '人工核验一致' as const,
        taxAuthorityDeclarationNo: 'IIT-202606-001',
        declarationStatus: '申报成功' as const,
        declarationVersion: 1,
        files: [declarationForm, declarationResult],
        id: 'np-19-salary-tax-matter',
        matterNo: 'TAX-202606-IIT',
        paidAmount: readyPreparation.iitSummary?.payableAmount ?? 0,
        payableAmount: readyPreparation.iitSummary?.payableAmount ?? 0,
        paymentDueDate: '2026-07-15',
        paymentStatus: '已缴纳' as const,
        period: '2026-06',
        preparedPayableAmount: readyPreparation.iitSummary?.payableAmount ?? 0,
        processStatus: '已完成' as const,
        sourceItems: seedTaxMatter.sourceItems.map((item) => ({ ...item, status: '已确认' as const })),
        title: '2026-06 个人所得税'
      };
      const reversal = buildFinanceTransactionAdjustmentRecord({
        existingRows: [originTransaction],
        files: [
          {
            id: 'np-19-filed-salary-reversal-file',
            name: '申报后工资退回冲正依据.pdf',
            status: '已上传',
            type: '调整凭证',
            updatedAt: '2026-07-12'
          }
        ],
        form: {
          ...createFinanceTransactionAdjustmentForm(originTransaction),
          occurredAt: '2026-07-12',
          reason: '申报后原工资付款被银行退回'
        },
        originRecord: originTransaction
      });
      const registration = commitFinanceTransactionAdjustmentRegistration(
        { financeRows: [originTransaction], receivablePayableRows: [] },
        reversal
      );

      assert(registration.success, 'filed salary reversal registration should succeed');
      const reversalReview = commitFinanceTransactionReview(registration, {
        operationId: 'np-19-filed-salary-reversal-review',
        reviewedAt: '2026-07-12 15:30',
        reviewer: '财务复核',
        transactionId: reversal.id
      });

      assert(reversalReview.success, 'filed salary reversal should post through finance review');
      const correction = commitPayrollIitCorrectionAfterPostedReversal(
        {
          declarationPreparationRows: [filedPreparation],
          financeRows: reversalReview.financeRows,
          receivablePayableRows: [],
          salaryPaymentRecords: [payment],
          taxMatterRows: [filedTaxMatter]
        },
        {
          actor: '财务复核',
          occurredAt: '2026-07-12 15:30',
          transactionId: reversal.id
        }
      );

      assert(correction.success, `filed salary reversal should create correction data: ${correction.success ? '' : correction.message}`);
      assertEqual(correction.correctionCreated, true, 'filed salary reversal should create one IIT correction version');
      assertEqual(
        correction.declarationPreparationRows[0]?.confirmedIitSummary?.payableAmount,
        readyPreparation.iitSummary?.payableAmount,
        'filed salary declaration snapshot should remain unchanged'
      );
      assertEqual(
        correction.declarationPreparationRows[0]?.pendingIitCorrection?.summary.reportCount,
        0,
        'correction version should remove the reversed salary payment from current IIT sources'
      );
      assertEqual(correction.taxMatterRows[0]?.declarationStatus, '待申报', 'tax handling should reopen as a correction filing');
      assertEqual(correction.taxMatterRows[0]?.declarationVersion, 2, 'salary correction should create the next declaration version once');
    }
  }
];

export function runSalaryFinanceFrontendWorkflowTests() {
  const failures: string[] = [];
  const executedTestNames: string[] = [];
  const passedTestNames: string[] = [];

  for (const test of tests) {
    executedTestNames.push(test.name);

    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames,
    failures,
    passed: tests.length - failures.length,
    passedTestNames,
    total: tests.length
  };
}
