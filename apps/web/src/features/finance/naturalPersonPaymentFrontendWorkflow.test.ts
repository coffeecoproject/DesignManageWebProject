import { getFinanceSeedPublicAccountRef } from './financeData';
import {
  buildAccountingVouchers,
  isAccountingVoucherBalanced
} from './financeAccountingVoucherModel';
import {
  buildFinanceTransactionAdjustmentRecord,
  createFinanceTransactionAdjustmentForm
} from './financeTransactionAdjustmentModel';
import {
  applyDeclarationPreparationSourceState,
  ensurePayrollIitDeclarationPreparationRecords
} from './financeDeclarationPreparationData';
import {
  buildPayrollIitDeclarationEmployeeRows,
  buildPayrollIitDeclarationSummary
} from './financePayrollIitDeclarationModel';
import {
  commitPayrollIitCorrectionAfterPostedReversal,
  finalizePayrollIitCorrectionPreparation
} from './financePayrollIitCorrectionWorkflow';
import { financeReceivablePayableRecords, type FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
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
import {
  applyDeclarationPreparationToTaxMatter,
  getTaxMatterDeclarationPreparationSnapshot
} from './financeTaxMatterModel';

type UnitTest = { name: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createLaborPayable(): FinanceReceivablePayableRecord {
  const seed = financeReceivablePayableRecords.find((record) => record.documentNo === 'AP-202606-003');

  if (!seed?.naturalPersonPayment) {
    throw new Error('expected natural-person labor payable AP-202606-003');
  }

  return {
    ...seed,
    linkedTransactionNos: [],
    operationRecords: [],
    settledAmount: 0,
    settlementStatus: '未结清'
  };
}

function buildLaborPaymentTransaction(record: FinanceReceivablePayableRecord) {
  const publicAccountRef = getFinanceSeedPublicAccountRef('cmb-basic');

  return buildFinanceReceivablePayableSettlementTransaction(
    record,
    {
      amount: record.amount,
      files: [
        {
          id: 'np-07-payment-file',
          name: '兼职劳务付款回单.pdf',
          status: '已上传',
          type: '付款回单',
          updatedAt: '2026-07-02'
        }
      ],
      note: '',
      occurredAt: '2026-07-02',
      publicAccountId: publicAccountRef.publicAccountId
    },
    [],
    publicAccountRef
  );
}

const tests: UnitTest[] = [
  {
    name: 'NP-07 FRONTEND-CHAIN registers net labor payment, posts it through review, and creates the payment-month IIT preparation',
    run: () => {
      const payable = createLaborPayable();
      const transaction = buildLaborPaymentTransaction(payable);
      const initialState = { financeRows: [], receivablePayableRows: [payable] };

      assertEqual(
        ensurePayrollIitDeclarationPreparationRecords([], [], initialState.financeRows, initialState.receivablePayableRows).length,
        0,
        'unpaid labor payable must not create an IIT preparation task'
      );

      const registration = commitFinanceReceivablePayableSettlementRegistration(
        initialState,
        payable.id,
        transaction
      );

      assert(registration.success, `labor payment registration should succeed: ${registration.success ? '' : registration.message}`);
      assertEqual(registration.financeRows.length, 1, 'registration should create one pending finance transaction');
      assertEqual(registration.financeRows[0]?.status, '待复核', 'registered payment must wait for finance review');
      assertEqual(registration.financeRows[0]?.amount, 2720, 'bank transaction must use labor net payment');
      assertEqual(
        registration.financeRows[0]?.naturalPersonPayment?.withheldTaxAmount,
        480,
        'pending transaction must retain withheld IIT'
      );
      assertEqual(
        registration.receivablePayableRows[0]?.linkedTransactionNos[0],
        transaction.transactionNo,
        'registration must link the transaction to the labor payable in the same workflow result'
      );
      assertEqual(
        ensurePayrollIitDeclarationPreparationRecords(
          [],
          [],
          registration.financeRows,
          registration.receivablePayableRows
        ).length,
        0,
        'pending review payment must not enter IIT preparation'
      );

      const review = commitFinanceTransactionReview(registration, {
        operationId: 'np-07-review-operation',
        reviewedAt: '2026-07-02 15:30',
        reviewer: '财务复核',
        transactionId: transaction.id
      });

      assert(review.success, `labor payment review should succeed: ${review.success ? '' : review.message}`);
      assertEqual(review.financeRows[0]?.status, '已入账', 'reviewed transaction must become posted');

      const settlementRows = deriveFinanceReceivablePayableSettlementRows(
        review.receivablePayableRows,
        review.financeRows
      );
      assertEqual(settlementRows[0]?.settledAmount, 3200, 'net bank payment must settle the gross labor payable');
      assertEqual(settlementRows[0]?.settlementStatus, '已结清', 'gross labor payable must become settled');

      const employeeRows = buildPayrollIitDeclarationEmployeeRows([], '2026-07', review.financeRows);
      const summary = buildPayrollIitDeclarationSummary(
        [],
        '2026-07',
        review.financeRows,
        review.receivablePayableRows
      );
      const preparationRows = ensurePayrollIitDeclarationPreparationRecords(
        [],
        [],
        review.financeRows,
        review.receivablePayableRows
      );

      assertEqual(employeeRows.length, 1, 'posted labor payment must create one IIT employee row');
      assertEqual(employeeRows[0]?.currentIncomeAmount, 3200, 'IIT preparation must report gross labor income');
      assertEqual(employeeRows[0]?.personalIncomeTaxAmount, 480, 'IIT preparation must report withheld labor IIT');
      assertEqual(summary.readyForConfirmation, true, 'complete posted labor payment must allow IIT confirmation');
      assertEqual(summary.payableAmount, 480, 'IIT payable must equal withheld labor IIT');
      assertEqual(preparationRows[0]?.period, '2026-07', 'IIT period must follow the actual payment month');
    }
  },
  {
    name: 'NP-07 FRONTEND-CHAIN rejects incomplete labor payment before posting and blocks legacy orphan payments from IIT confirmation',
    run: () => {
      const payable = createLaborPayable();
      const completeTransaction = buildLaborPaymentTransaction(payable);
      const incompleteTransaction = { ...completeTransaction, naturalPersonPayment: undefined };
      const initialState = { financeRows: [], receivablePayableRows: [payable] };
      const registration = commitFinanceReceivablePayableSettlementRegistration(
        initialState,
        payable.id,
        incompleteTransaction
      );

      assert(!registration.success, 'labor payment without a tax snapshot must be rejected before state mutation');
      assertEqual(registration.message, '自然人劳务付款缺少所得及代扣信息', 'registration blocker should be explicit');
      assertEqual(initialState.financeRows.length, 0, 'failed registration must not create a finance transaction');
      assertEqual(initialState.receivablePayableRows[0]?.linkedTransactionNos.length, 0, 'failed registration must not link the payable');

      const pendingOrphan = {
        ...incompleteTransaction,
        status: '待复核' as const
      };
      const linkedPayable = {
        ...payable,
        linkedTransactionNos: [pendingOrphan.transactionNo]
      };
      const review = commitFinanceTransactionReview(
        { financeRows: [pendingOrphan], receivablePayableRows: [linkedPayable] },
        {
          operationId: 'np-07-orphan-review-operation',
          reviewedAt: '2026-07-02 15:30',
          reviewer: '财务复核',
          transactionId: pendingOrphan.id
        }
      );

      assert(!review.success, 'review must block a labor payment with missing tax facts');
      assertEqual(review.message, '自然人劳务付款缺少所得及代扣信息', 'review blocker should be explicit');

      const legacyPostedOrphan = { ...pendingOrphan, status: '已入账' as const };
      const orphanSummary = buildPayrollIitDeclarationSummary(
        [],
        '2026-07',
        [legacyPostedOrphan],
        [linkedPayable]
      );
      const orphanPreparationRows = ensurePayrollIitDeclarationPreparationRecords(
        [],
        [],
        [legacyPostedOrphan],
        [linkedPayable]
      );

      assertEqual(orphanSummary.readyForConfirmation, false, 'legacy orphan payment must block IIT confirmation');
      assertEqual(orphanSummary.pendingCount, 1, 'legacy orphan payment must be counted as one pending tax source');
      assertEqual(orphanPreparationRows[0]?.period, '2026-07', 'orphan payment must still create a visible preparation task');
    }
  },
  {
    name: 'NP-16 FRONTEND-CHAIN creates one balanced pending-booking voucher only after labor payment review',
    run: () => {
      const payable = createLaborPayable();
      const transaction = buildLaborPaymentTransaction(payable);
      const registration = commitFinanceReceivablePayableSettlementRegistration(
        { financeRows: [], receivablePayableRows: [payable] },
        payable.id,
        transaction
      );

      assert(registration.success, `labor payment registration should succeed: ${registration.success ? '' : registration.message}`);
      assertEqual(
        buildAccountingVouchers(registration.receivablePayableRows, registration.financeRows)
          .filter((voucher) => voucher.sourceNo === transaction.transactionNo)
          .length,
        0,
        'pending-review labor payment must not create an accounting voucher'
      );

      const review = commitFinanceTransactionReview(registration, {
        operationId: 'np-16-review-operation',
        reviewedAt: '2026-07-02 15:30',
        reviewer: '财务复核',
        transactionId: transaction.id
      });

      assert(review.success, `labor payment review should succeed: ${review.success ? '' : review.message}`);

      const firstBuild = buildAccountingVouchers(review.receivablePayableRows, review.financeRows);
      const repeatedBuild = buildAccountingVouchers(review.receivablePayableRows, review.financeRows);
      const laborVouchers = firstBuild.filter((voucher) => voucher.sourceNo === transaction.transactionNo);
      const repeatedLaborVouchers = repeatedBuild.filter((voucher) => voucher.sourceNo === transaction.transactionNo);
      const voucher = laborVouchers[0];

      assertEqual(laborVouchers.length, 1, 'posted labor payment must create exactly one accounting voucher');
      assertEqual(repeatedLaborVouchers.length, 1, 'rebuilding frontend state must not duplicate the labor voucher');
      assert(voucher, 'posted labor payment voucher should exist');
      assertEqual(voucher.id, repeatedLaborVouchers[0]?.id, 'derived labor voucher identity must stay stable');
      assertEqual(voucher.businessType, '资金凭证', 'labor payment must create a cash voucher');
      assertEqual(voucher.status, '待记账', 'complete labor voucher must be ready for booking');
      assertEqual(voucher.amount, 3200, 'voucher amount must use gross labor payable');
      assertEqual(isAccountingVoucherBalanced(voucher), true, 'labor payment voucher must be balanced');
      assertEqual(
        voucher.lines.find((line) => line.side === '借方' && line.subjectCode === '2202')?.amount,
        3200,
        'labor voucher must debit the gross payable'
      );
      assertEqual(
        voucher.lines.find((line) => line.side === '贷方' && line.subjectCode === '1002')?.amount,
        2720,
        'labor voucher must credit the bank net payment'
      );
      assertEqual(
        voucher.lines.find((line) => line.side === '贷方' && line.subjectCode === '2221.03')?.amount,
        480,
        'labor voucher must credit withheld IIT'
      );
    }
  },
  {
    name: 'NP-14 FRONTEND-CHAIN reverses posted labor payment across settlement, IIT preparation, and accounting exactly once',
    run: () => {
      const payable = createLaborPayable();
      const transaction = buildLaborPaymentTransaction(payable);
      const registration = commitFinanceReceivablePayableSettlementRegistration(
        { financeRows: [], receivablePayableRows: [payable] },
        payable.id,
        transaction
      );

      assert(registration.success, `labor payment registration should succeed: ${registration.success ? '' : registration.message}`);
      const review = commitFinanceTransactionReview(registration, {
        operationId: 'np-14-origin-review-operation',
        reviewedAt: '2026-07-02 15:30',
        reviewer: '财务复核',
        transactionId: transaction.id
      });

      assert(review.success, `labor payment review should succeed: ${review.success ? '' : review.message}`);
      assertEqual(
        deriveFinanceReceivablePayableSettlementRows(review.receivablePayableRows, review.financeRows)[0]?.settledAmount,
        3200,
        'posted net payment must first settle the gross labor payable'
      );
      assertEqual(
        ensurePayrollIitDeclarationPreparationRecords(
          [],
          [],
          review.financeRows,
          review.receivablePayableRows
        ).length,
        1,
        'posted labor payment must create an IIT preparation before reversal'
      );

      const reversalForm = createFinanceTransactionAdjustmentForm(transaction);
      const reversal = buildFinanceTransactionAdjustmentRecord({
        existingRows: review.financeRows,
        files: [
          {
            id: 'np-14-reversal-file',
            name: '劳务付款冲正依据.pdf',
            status: '已上传',
            type: '调整凭证',
            updatedAt: '2026-07-03'
          }
        ],
        form: {
          ...reversalForm,
          occurredAt: '2026-07-03',
          reason: '原劳务付款退回'
        },
        originRecord: transaction
      });
      const reversalRegistration = commitFinanceTransactionAdjustmentRegistration(review, reversal);

      assert(reversalRegistration.success, `labor reversal registration should succeed: ${reversalRegistration.success ? '' : reversalRegistration.message}`);
      assertEqual(reversal.amount, 2720, 'reversal bank transaction must use the original net payment amount');
      assertEqual(reversal.status, '待复核', 'registered reversal must wait for review');
      assertEqual(
        deriveFinanceReceivablePayableSettlementRows(
          reversalRegistration.receivablePayableRows,
          reversalRegistration.financeRows
        )[0]?.settledAmount,
        3200,
        'pending reversal must not change the settled amount'
      );
      assertEqual(
        buildPayrollIitDeclarationEmployeeRows([], '2026-07', reversalRegistration.financeRows).length,
        1,
        'pending reversal must not remove the labor IIT fact'
      );
      assertEqual(
        buildAccountingVouchers(
          reversalRegistration.receivablePayableRows,
          reversalRegistration.financeRows
        ).filter((voucher) => voucher.sourceNo === reversal.transactionNo).length,
        0,
        'pending reversal must not create an accounting voucher'
      );

      const duplicateReversal = {
        ...reversal,
        id: 'np-14-duplicate-reversal',
        transactionNo: 'FIN-ADJ-202607-9999'
      };
      const duplicateRegistration = commitFinanceTransactionAdjustmentRegistration(
        reversalRegistration,
        duplicateReversal
      );

      assert(!duplicateRegistration.success, 'a second active reversal for the same payment must be rejected');
      assertEqual(
        duplicateRegistration.message,
        '该流水已有待复核或已入账的冲正记录',
        'duplicate reversal blocker must be explicit'
      );

      const reversalReview = commitFinanceTransactionReview(reversalRegistration, {
        operationId: 'np-14-reversal-review-operation',
        reviewedAt: '2026-07-03 15:30',
        reviewer: '财务复核',
        transactionId: reversal.id
      });

      assert(reversalReview.success, `labor reversal review should succeed: ${reversalReview.success ? '' : reversalReview.message}`);
      const reopenedPayable = deriveFinanceReceivablePayableSettlementRows(
        reversalReview.receivablePayableRows,
        reversalReview.financeRows
      )[0];
      const vouchers = buildAccountingVouchers(
        reversalReview.receivablePayableRows,
        reversalReview.financeRows
      );
      const reversalVoucher = vouchers.find((voucher) => voucher.sourceNo === reversal.transactionNo);

      assertEqual(reopenedPayable?.settledAmount, 0, 'posted net reversal must reopen the full gross labor payable');
      assertEqual(reopenedPayable?.settlementStatus, '未结清', 'posted reversal must restore the payable to unsettled');
      assertEqual(
        buildPayrollIitDeclarationEmployeeRows([], '2026-07', reversalReview.financeRows).length,
        0,
        'posted reversal must remove the unfiled labor IIT fact'
      );
      assertEqual(
        ensurePayrollIitDeclarationPreparationRecords(
          [],
          [],
          reversalReview.financeRows,
          reversalReview.receivablePayableRows
        ).length,
        0,
        'source-empty unconfirmed IIT preparation must be withdrawn after reversal'
      );
      assert(reversalVoucher, 'posted labor reversal must create an adjustment voucher');
      assertEqual(reversalVoucher.businessType, '调整凭证', 'labor reversal must create an adjustment voucher');
      assertEqual(reversalVoucher.status, '待记账', 'complete reversal voucher must be ready for booking');
      assertEqual(reversalVoucher.amount, 3200, 'reversal voucher must use the original gross labor amount');
      assertEqual(isAccountingVoucherBalanced(reversalVoucher), true, 'labor reversal voucher must balance');
      assertEqual(
        reversalVoucher.lines.find((line) => line.side === '借方' && line.subjectCode === '1002')?.amount,
        2720,
        'reversal voucher must debit the returned bank net payment'
      );
      assertEqual(
        reversalVoucher.lines.find((line) => line.side === '借方' && line.subjectCode === '2221.03')?.amount,
        480,
        'reversal voucher must debit the cancelled withheld IIT'
      );
      assertEqual(
        reversalVoucher.lines.find((line) => line.side === '贷方' && line.subjectCode === '2202')?.amount,
        3200,
        'reversal voucher must restore the gross labor payable'
      );
    }
  },
  {
    name: 'NP-15 FRONTEND-CHAIN preserves filed labor IIT and automatically opens one correction version after posted reversal',
    run: () => {
      const payable = createLaborPayable();
      const transaction = buildLaborPaymentTransaction(payable);
      const registration = commitFinanceReceivablePayableSettlementRegistration(
        { financeRows: [], receivablePayableRows: [payable] },
        payable.id,
        transaction
      );

      assert(registration.success, `labor payment registration should succeed: ${registration.success ? '' : registration.message}`);
      const review = commitFinanceTransactionReview(registration, {
        operationId: 'np-15-origin-review-operation',
        reviewedAt: '2026-07-02 15:30',
        reviewer: '财务复核',
        transactionId: transaction.id
      });

      assert(review.success, `labor payment review should succeed: ${review.success ? '' : review.message}`);
      const generatedPreparation = ensurePayrollIitDeclarationPreparationRecords(
        [],
        [],
        review.financeRows,
        review.receivablePayableRows
      )[0];

      assert(generatedPreparation, 'posted labor payment must generate the filing-period preparation');
      const readyPreparation = applyDeclarationPreparationSourceState(
        [generatedPreparation],
        [],
        review.financeRows,
        review.receivablePayableRows
      )[0];

      assert(readyPreparation, 'labor IIT preparation must derive current source rows');
      assertEqual(readyPreparation.iitSummary?.payableAmount, 480, 'original filed labor IIT must be 480');
      assertEqual(
        readyPreparation.iitEmployeeRows?.[0]?.sourceTransactionNos?.[0],
        transaction.transactionNo,
        'filed labor row must retain its source finance transaction'
      );
      const filedPreparation = {
        ...readyPreparation,
        confirmedIitEmployeeRows: readyPreparation.iitEmployeeRows,
        confirmedIitSummary: readyPreparation.iitSummary,
        confirmedSourceSnapshotKey: readyPreparation.sourceSnapshotKey,
        status: '已进入税务办理' as const
      };
      const seedTaxMatter = financeTaxMatterRecords.find((record) => record.matterType === '个人所得税');

      assert(seedTaxMatter, 'IIT tax matter seed must exist');
      const declarationReceipt = {
        id: 'np-15-original-declaration-receipt',
        name: '2026-07 个税申报回执.pdf',
        status: '已上传' as const,
        type: '申报回执',
        updatedAt: '2026-08-10'
      };
      const filedTaxMatter = {
        ...seedTaxMatter,
        dataStatus: '已确认' as const,
        declarationDate: '2026-08-10',
        declarationDueDate: '2026-08-15',
        declarationReceiptFileId: declarationReceipt.id,
        declarationReceiptNo: 'IIT-202607-001',
        declarationStatus: '申报成功' as const,
        declarationVersion: 1,
        files: [declarationReceipt],
        id: 'np-15-tax-matter',
        matterNo: 'TAX-202607-IIT',
        paidAmount: 480,
        participantSummary: '1/1 人',
        payableAmount: 480,
        paymentDueDate: '2026-08-15',
        paymentStatus: '已缴纳' as const,
        period: '2026-07',
        preparedPayableAmount: 480,
        processStatus: '已完成' as const,
        sourceItems: seedTaxMatter.sourceItems.map((item) => ({ ...item, status: '已确认' as const })),
        title: '2026-07 个人所得税'
      };
      const reversal = buildFinanceTransactionAdjustmentRecord({
        existingRows: review.financeRows,
        files: [
          {
            id: 'np-15-reversal-file',
            name: '申报后劳务付款冲正依据.pdf',
            status: '已上传',
            type: '调整凭证',
            updatedAt: '2026-08-12'
          }
        ],
        form: {
          ...createFinanceTransactionAdjustmentForm(transaction),
          occurredAt: '2026-08-12',
          reason: '申报后原劳务付款退回'
        },
        originRecord: transaction
      });
      const reversalRegistration = commitFinanceTransactionAdjustmentRegistration(review, reversal);

      assert(reversalRegistration.success, `labor reversal registration should succeed: ${reversalRegistration.success ? '' : reversalRegistration.message}`);
      const reversalReview = commitFinanceTransactionReview(reversalRegistration, {
        operationId: 'np-15-reversal-review-operation',
        reviewedAt: '2026-08-12 15:30',
        reviewer: '财务复核',
        transactionId: reversal.id
      });

      assert(reversalReview.success, `labor reversal review should succeed: ${reversalReview.success ? '' : reversalReview.message}`);
      const correction = commitPayrollIitCorrectionAfterPostedReversal(
        {
          declarationPreparationRows: [filedPreparation],
          financeRows: reversalReview.financeRows,
          receivablePayableRows: reversalReview.receivablePayableRows,
          salaryPaymentRecords: [],
          taxMatterRows: [filedTaxMatter]
        },
        {
          actor: '财务复核',
          occurredAt: '2026-08-12 15:30',
          transactionId: reversal.id
        }
      );

      assert(correction.success, `post-filing correction must be created: ${correction.success ? '' : correction.message}`);
      assertEqual(correction.correctionCreated, true, 'posted reversal must create a correction task');
      const correctedPreparation = correction.declarationPreparationRows[0];
      const correctedTaxMatter = correction.taxMatterRows[0];

      assertEqual(correctedPreparation?.status, '已进入税务办理', 'original preparation remains filed');
      assertEqual(correctedPreparation?.confirmedIitSummary?.payableAmount, 480, 'original filed snapshot remains 480');
      assertEqual(correctedPreparation?.iitSummary?.payableAmount, 480, 'historical preparation readback remains unchanged');
      assertEqual(correctedPreparation?.pendingIitCorrection?.summary.payableAmount, 0, 'reversal recalculation creates a zero correction basis');
      assertEqual(correctedTaxMatter?.declarationVersion, 2, 'correction must open declaration version 2');
      assertEqual(correctedTaxMatter?.declarationStatus, '待申报', 'correction version must wait for official filing');
      assertEqual(correctedTaxMatter?.preparedPayableAmount, 0, 'correction version must use recalculated payable amount');
      assertEqual(correctedTaxMatter?.paidAmount, 480, 'original paid tax remains until official correction result');
      assertEqual(correctedTaxMatter?.declarationHistory.length, 1, 'original declaration must be retained exactly once');
      assertEqual(correctedTaxMatter?.declarationHistory[0]?.filedPayableAmount, 480, 'history retains original official payable amount');
      assertEqual(
        correctedTaxMatter?.declarationHistory[0]?.declarationReceiptFileId,
        declarationReceipt.id,
        'history retains original declaration receipt'
      );

      assert(correctedPreparation && correctedTaxMatter, 'corrected preparation and matter must exist');
      const displayedTaxMatter = applyDeclarationPreparationToTaxMatter(
        correctedTaxMatter,
        [correctedPreparation]
      );
      const correctionDetail = getTaxMatterDeclarationPreparationSnapshot(correctedPreparation, {
        usePendingIitCorrection: true
      });

      assertEqual(displayedTaxMatter.preparedPayableAmount, 0, 'page derivation must not overwrite correction amount with historical amount');
      assertEqual(correctionDetail.iitSummary?.payableAmount, 0, 'correction detail must display recalculated filing rows');
      const filedCorrectionTaxMatter = {
        ...correctedTaxMatter,
        declarationStatus: '零申报' as const,
        payableAmount: 0,
        processStatus: '已完成' as const
      };
      const finalizedCorrectionPreparation = finalizePayrollIitCorrectionPreparation(
        correctedPreparation,
        filedCorrectionTaxMatter,
        '李明',
        '2026-08-15 15:10'
      );

      assertEqual(
        finalizedCorrectionPreparation.confirmedIitSummary?.payableAmount,
        0,
        'filed correction must promote the recalculated summary to the effective declaration snapshot'
      );
      assertEqual(
        finalizedCorrectionPreparation.pendingIitCorrection,
        undefined,
        'filed correction must clear the pending correction snapshot'
      );
      assertEqual(
        getTaxMatterDeclarationPreparationSnapshot(finalizedCorrectionPreparation).iitSummary?.payableAmount,
        0,
        'historical detail must read the corrected effective snapshot after filing'
      );
      const repeated = commitPayrollIitCorrectionAfterPostedReversal(correction, {
        actor: '财务复核',
        occurredAt: '2026-08-12 15:30',
        transactionId: reversal.id
      });

      assert(repeated.success, 'repeated correction derivation must remain successful');
      assertEqual(repeated.correctionCreated, false, 'same reversal must not create a second correction task');
      assertEqual(repeated.taxMatterRows[0]?.declarationHistory.length, 1, 'same reversal must not duplicate declaration history');
    }
  }
];

export function runNaturalPersonPaymentFrontendWorkflowTests() {
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
