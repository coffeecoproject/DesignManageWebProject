import { getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';
import { financeTaxMatterRecords, type FinanceTaxMatterRecord } from './financeTaxFilingData';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVouchers,
  createAccountingVoucherLifecycleRecord,
  getNextAccountingVoucherNo,
  type AccountingLedgerEntry,
  type AccountingVoucherLifecycleRecord,
  type AccountingVoucherRecord
} from './financeAccountingVoucherModel';
import {
  commitFinanceTransactionAdjustmentRegistration,
  commitFinanceTransactionReview
} from './financeSettlementWorkflow';
import { buildFinanceTransactionAdjustmentRecord } from './financeTransactionAdjustmentModel';
import {
  attachTaxMatterPaymentTransaction,
  attachTaxMatterRefundTransaction,
  buildTaxMatterPaymentTransaction,
  buildTaxMatterRefundTransaction,
  recordTaxMatterDeclarationResult,
  recordTaxMatterOffsetResult,
  recordTaxMatterPaymentResult,
  recordTaxMatterRefundApplication,
  recordTaxMatterRefundResult,
  reconcileTaxMatterCashSettlement,
  startTaxMatterDeclarationRevision
} from './financeTaxMatterModel';

type UnitTest = {
  name: string;
  run: () => void;
};

const moneyTolerance = 0.01;

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertClose(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > moneyTolerance) {
    throw new Error(`${message}. Expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`);
  }
}

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

function getTaxMatterSeed(matterType: FinanceTaxMatterRecord['matterType']) {
  return assertDefined(
    financeTaxMatterRecords.find((record) => record.matterType === matterType),
    `missing ${matterType} tax matter seed`
  );
}

function getVatSettlementSeed() {
  return assertDefined(
    financeTaxMatterRecords.find((record) => record.matterType === '增值税及附加' && record.vatSettlement),
    'missing VAT tax matter seed with settlement details'
  );
}

function createPayableTaxMatter(
  matterType: FinanceTaxMatterRecord['matterType'],
  amount: number,
  overrides: Partial<FinanceTaxMatterRecord> = {}
): FinanceTaxMatterRecord {
  const seed = getTaxMatterSeed(matterType);
  const period = matterType === '个人所得税' ? '2026-06' : '2026-Q2';

  return {
    ...seed,
    dataStatus: '已确认',
    declarationDate: '2026-07-10',
    declarationFormFileIds: [`declaration-form-${matterType}`],
    declarationHistory: [],
    declarationResultFileId: `declaration-${matterType}`,
    declarationVerificationStatus: '人工核验一致',
    declarationVerifiedAt: '2026-07-10 15:20',
    declarationVerifiedBy: '李明',
    taxAuthorityDeclarationNo: `DECLARATION-${matterType}`,
    declarationStatus: '申报成功',
    declarationVersion: 1,
    filedAccountingAmount: amount,
    files: [
      {
        id: `declaration-form-${matterType}`,
        name: `${matterType}正式申报表.pdf`,
        status: '已上传',
        type: '正式申报表',
        updatedAt: '2026-07-10'
      },
      {
        id: `declaration-${matterType}`,
        name: `${matterType}申报结果回执.pdf`,
        status: '已上传',
        type: '申报结果回执',
        updatedAt: '2026-07-10'
      }
    ],
    id: `workflow-${matterType}`,
    linkedTransactionNos: [],
    matterNo: `TAX-WORKFLOW-${matterType}`,
    matterType,
    offsetAmount: 0,
    offsetBaselineAmount: 0,
    offsetReceivedAmount: 0,
    offsetReceivedBaselineAmount: 0,
    paidAmount: 0,
    paymentBaselineAmount: 0,
    payableAmount: amount,
    preparedPayableAmount: amount,
    preparedRefundableAmount: 0,
    paymentDate: undefined,
    paymentStatus: '待缴纳',
    period,
    processStatus: '待缴款',
    refundableAmount: 0,
    refundBaselineAmount: 0,
    refundedAmount: 0,
    refundStatus: '不适用',
    settlementDirection: '应缴',
    sourceItems: [
      {
        id: `source-${matterType}`,
        name: '申报准备',
        sourceModule: '申报准备',
        status: '已确认',
        updatedAt: '2026-07-10'
      }
    ],
    title: `${period} ${matterType}`,
    updatedAt: '2026-07-10',
    ...overrides
  };
}

function createReceipt(id: string, type: '缴款回单' | '退税回单') {
  return {
    id,
    name: `${id}.pdf`,
    status: '已上传' as const,
    type,
    updatedAt: '2026-07-15'
  };
}

function reviewTransaction(
  transaction: FinanceTransactionRecord,
  financeRows: FinanceTransactionRecord[] = [transaction]
) {
  const result = commitFinanceTransactionReview(
    { financeRows, receivablePayableRows: [] },
    {
      operationId: `review-${transaction.id}`,
      reviewedAt: `${transaction.occurredAt} 16:00`,
      reviewer: '财务复核',
      transactionId: transaction.id
    }
  );

  if (!result.success) {
    throw new Error(`transaction review failed: ${result.message}`);
  }

  return assertDefined(
    result.financeRows.find((record) => record.id === transaction.id),
    'reviewed transaction should remain in workflow state'
  );
}

function buildVoucherRows(
  financeRows: FinanceTransactionRecord[],
  taxMatterRows: FinanceTaxMatterRecord[],
  lifecycleRows: AccountingVoucherLifecycleRecord[] = []
) {
  return applyAccountingVoucherLifecycle(
    buildAccountingVouchers([], financeRows, [], taxMatterRows, [], [], [], {
      accountingPeriodStart: '2026-01'
    }),
    lifecycleRows
  );
}

function bookReadyVouchers(
  voucherRows: AccountingVoucherRecord[],
  lifecycleRows: AccountingVoucherLifecycleRecord[] = []
) {
  const nextLifecycleRows = [...lifecycleRows];

  for (const record of voucherRows) {
    if (record.status !== '待记账' || nextLifecycleRows.some((row) => row.voucherId === record.id)) {
      continue;
    }

    nextLifecycleRows.push(
      createAccountingVoucherLifecycleRecord(
        record,
        getNextAccountingVoucherNo(nextLifecycleRows, record.accountingPeriod),
        '李明',
        `${record.voucherDate} 17:10`
      )
    );
  }

  const bookedRows = applyAccountingVoucherLifecycle(voucherRows, nextLifecycleRows);

  return {
    entries: buildAccountingLedgerEntries(bookedRows),
    lifecycleRows: nextLifecycleRows,
    voucherRows: bookedRows
  };
}

function sumLedger(
  entries: AccountingLedgerEntry[],
  subjectCode: string,
  side: AccountingLedgerEntry['side']
) {
  return entries
    .filter((entry) => entry.subjectCode === subjectCode && entry.side === side)
    .reduce((total, entry) => total + (side === '借方' ? entry.debitAmount : entry.creditAmount), 0);
}

function preparePaymentWorkflow(
  matter: FinanceTaxMatterRecord,
  amount: number,
  paymentDate = '2026-07-15',
  existingFinanceRows: FinanceTransactionRecord[] = []
) {
  const receipt = createReceipt(`payment-${matter.id}-${amount}`, '缴款回单');
  const paidMatter = recordTaxMatterPaymentResult(matter, {
    amount,
    paymentDate,
    receiptFile: receipt
  });
  const transaction = assertDefined(buildTaxMatterPaymentTransaction({
    financeRows: existingFinanceRows,
    publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
    record: paidMatter
  }), 'tax payment should generate a receipt-backed pending-review transaction');

  return {
    matter: attachTaxMatterPaymentTransaction(paidMatter, transaction),
    transaction
  };
}

const tests: UnitTest[] = [
  {
    name: 'TAX-GL-01 keeps IIT payment out of vouchers until review and out of ledger until booking',
    run: () => {
      const matter = createPayableTaxMatter('个人所得税', 480);
      const payment = preparePaymentWorkflow(matter, 480);
      const pendingVoucherRows = buildVoucherRows([payment.transaction], [payment.matter]);

      assertEqual(payment.transaction.status, '待复核', 'IIT payment should enter finance review first');
      assertEqual(
        pendingVoucherRows.some((record) => record.sourceNo === payment.transaction.transactionNo),
        false,
        'pending-review payment must not create a cash voucher'
      );

      const reviewedTransaction = reviewTransaction(payment.transaction);
      const voucherRows = buildVoucherRows([reviewedTransaction], [payment.matter]);
      const cashVoucher = assertDefined(
        voucherRows.find((record) => record.sourceNo === reviewedTransaction.transactionNo),
        'reviewed IIT payment should create a cash voucher'
      );

      assertEqual(cashVoucher.status, '待记账', 'review only prepares the voucher');
      assertEqual(buildAccountingLedgerEntries(voucherRows).length, 0, 'unbooked voucher must not enter the ledger');

      const booked = bookReadyVouchers(voucherRows);

      assertClose(sumLedger(booked.entries, '2221.03', '借方'), 480, 'IIT payment clears withholding tax liability');
      assertClose(sumLedger(booked.entries, '1002', '贷方'), 480, 'IIT payment reduces bank balance');
      assertEqual(
        booked.voucherRows.some((record) => record.sourceNo === matter.matterNo && record.businessType === '税费凭证'),
        false,
        'IIT handling must not accrue a liability already created by payroll and labor facts'
      );
    }
  },
  {
    name: 'TAX-GL-02 carries VAT and surcharge allocations through review, voucher booking and ledger',
    run: () => {
      const seed = getVatSettlementSeed();
      const amount = seed.vatSettlement?.totalPayableAmount ?? 0;
      const matter = createPayableTaxMatter('增值税及附加', amount, {
        filedAccountingAmount: seed.filedAccountingAmount,
        period: '2026-Q1',
        title: '2026-Q1 增值税及附加',
        vatSettlement: seed.vatSettlement
      });
      const payment = preparePaymentWorkflow(matter, amount, '2026-04-12');
      const allocationTotal = payment.transaction.taxPaymentAllocations?.reduce(
        (total, allocation) => total + allocation.amount,
        0
      ) ?? 0;

      assertClose(allocationTotal, amount, 'VAT payment allocations should reconcile to the bank payment');
      assertEqual(payment.transaction.taxPaymentAllocations?.length, 4, 'VAT payment should preserve four tax liabilities');

      const reviewedTransaction = reviewTransaction(payment.transaction);
      const voucherRows = buildVoucherRows([reviewedTransaction], [payment.matter]);
      const booked = bookReadyVouchers(voucherRows);
      const liabilityDebit = ['2221.01', '2221.04', '2221.06', '2221.07']
        .reduce((total, code) => total + sumLedger(booked.entries, code, '借方'), 0);

      assertClose(liabilityDebit, amount, 'booked VAT payment should clear the same four liability allocations');
      assertClose(sumLedger(booked.entries, '1002', '贷方'), amount, 'booked VAT payment should credit bank deposit');
    }
  },
  {
    name: 'TAX-GL-03 reconciles enterprise-income-tax accrual and payment across accounting periods',
    run: () => {
      const matter = createPayableTaxMatter('企业所得税', 500);
      const payment = preparePaymentWorkflow(matter, 500);
      const reviewedTransaction = reviewTransaction(payment.transaction);
      const booked = bookReadyVouchers(buildVoucherRows([reviewedTransaction], [payment.matter]));

      assertClose(sumLedger(booked.entries, '5801', '借方'), 500, 'CIT filing should recognize income-tax expense');
      assertClose(sumLedger(booked.entries, '2221.02', '贷方'), 500, 'CIT filing should recognize tax liability');
      assertClose(sumLedger(booked.entries, '2221.02', '借方'), 500, 'CIT payment should clear tax liability');
      assertClose(sumLedger(booked.entries, '1002', '贷方'), 500, 'CIT payment should reduce bank balance');
      assertEqual(
        booked.voucherRows.find((record) => record.sourceNo === matter.matterNo)?.accountingPeriod,
        '2026-06',
        'CIT accrual belongs to the declaration quarter end month'
      );
      assertEqual(
        booked.voucherRows.find((record) => record.sourceNo === reviewedTransaction.transactionNo)?.accountingPeriod,
        '2026-07',
        'CIT payment belongs to the actual payment month'
      );
    }
  },
  {
    name: 'TAX-GL-04 reconciles stamp-duty filing and reviewed payment without a duplicate expense',
    run: () => {
      const matter = createPayableTaxMatter('印花税', 25);
      const payment = preparePaymentWorkflow(matter, 25);
      const reviewedTransaction = reviewTransaction(payment.transaction);
      const booked = bookReadyVouchers(buildVoucherRows([reviewedTransaction], [payment.matter]));

      assertClose(sumLedger(booked.entries, '5403', '借方'), 25, 'stamp-duty filing should recognize tax expense once');
      assertClose(sumLedger(booked.entries, '2221.05', '贷方'), 25, 'stamp-duty filing should recognize the liability');
      assertClose(sumLedger(booked.entries, '2221.05', '借方'), 25, 'reviewed payment should clear stamp-duty liability');
      assertClose(sumLedger(booked.entries, '1002', '贷方'), 25, 'reviewed payment should reduce bank balance');
    }
  },
  {
    name: 'TAX-GL-05 carries a CIT refund through application, bank receipt, review and general ledger',
    run: () => {
      const refundableMatter = createPayableTaxMatter('企业所得税', 0, {
        filedAccountingAmount: -500,
        matterNo: 'TAX-WORKFLOW-CIT-REFUND',
        payableAmount: 0,
        preparedPayableAmount: 0,
        preparedRefundableAmount: 500,
        paymentStatus: '无需缴纳',
        processStatus: '待退抵处理',
        refundableAmount: 500,
        refundStatus: '待申请',
        settlementDirection: '应退',
        title: '2025 年度企业所得税汇算退税'
      });
      const appliedMatter = recordTaxMatterRefundApplication(refundableMatter, {
        applicationDate: '2026-07-12',
        method: '退税',
        receiptNo: 'CIT-REFUND-APPLICATION-001'
      });
      const refundReceipt = createReceipt('cit-refund-receipt', '退税回单');
      const refundedMatter = recordTaxMatterRefundResult(appliedMatter, {
        amount: 500,
        receiptFile: refundReceipt,
        refundDate: '2026-07-15'
      });
      const transaction = assertDefined(buildTaxMatterRefundTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: refundedMatter,
        refundAmount: 500,
        refundDate: '2026-07-15',
        refundReceiptFile: refundReceipt
      }), 'CIT refund receipt should generate a pending-review bank receipt');
      const matter = attachTaxMatterRefundTransaction(refundedMatter, transaction);

      assertEqual(transaction.status, '待复核', 'tax refund should enter finance review');

      const reviewedTransaction = reviewTransaction(transaction);
      const booked = bookReadyVouchers(buildVoucherRows([reviewedTransaction], [matter]));

      assertClose(sumLedger(booked.entries, '2221.02', '借方'), 500, 'overpayment filing should reverse CIT liability');
      assertClose(sumLedger(booked.entries, '2221.02', '贷方'), 500, 'refund receipt should settle the reversed liability');
      assertClose(sumLedger(booked.entries, '1002', '借方'), 500, 'refund receipt should increase bank balance');
      assertClose(sumLedger(booked.entries, '5051', '贷方'), 0, 'tax refund must not be treated as operating income');
    }
  },
  {
    name: 'TAX-GL-06 preserves original and correction vouchers while settling only the CIT difference',
    run: () => {
      const originalMatter = createPayableTaxMatter('企业所得税', 500, {
        id: 'workflow-cit-correction',
        matterNo: 'TAX-WORKFLOW-CIT-CORRECTION'
      });
      const originalPayment = preparePaymentWorkflow(originalMatter, 500, '2026-07-15');
      const reviewedOriginalTransaction = reviewTransaction(originalPayment.transaction);
      const originalBooked = bookReadyVouchers(
        buildVoucherRows([reviewedOriginalTransaction], [originalPayment.matter])
      );
      const revision = startTaxMatterDeclarationRevision(originalPayment.matter, '更正', '补充纳税调整增加应纳税额');
      const correctedMatter = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-08-10',
        declarationFormFiles: [{
          id: 'cit-correction-form',
          name: '企业所得税更正正式申报表.pdf',
          status: '已上传',
          type: '正式申报表',
          updatedAt: '2026-08-10'
        }],
        declarationResultFile: {
          id: 'cit-correction-result',
          name: '企业所得税更正申报结果回执.pdf',
          status: '已上传',
          type: '申报结果回执',
          updatedAt: '2026-08-10'
        },
        declarationVerificationStatus: '人工核验一致',
        taxAuthorityDeclarationNo: 'CIT-CORRECTION-002',
        declarationStatus: '申报成功',
        differenceReason: '补充纳税调整增加应纳税额',
        settlementAmount: 100,
        settlementDirection: '应缴'
      });
      const correctionPayment = preparePaymentWorkflow(
        correctedMatter,
        100,
        '2026-08-15',
        [reviewedOriginalTransaction]
      );

      assertClose(correctionPayment.transaction.amount, 100, 'correction payment should register only the version difference');

      const reviewedCorrectionTransaction = reviewTransaction(
        correctionPayment.transaction,
        [correctionPayment.transaction, reviewedOriginalTransaction]
      );
      const currentRows = buildVoucherRows(
        [reviewedCorrectionTransaction, reviewedOriginalTransaction],
        [correctionPayment.matter],
        originalBooked.lifecycleRows
      );
      const booked = bookReadyVouchers(currentRows, originalBooked.lifecycleRows);

      assertEqual(
        booked.voucherRows.filter((record) => record.sourceNo === originalMatter.matterNo).length,
        2,
        'original and corrected tax accrual vouchers should both remain immutable'
      );
      assertClose(sumLedger(booked.entries, '5801', '借方'), 600, 'original and correction expense should reconcile to cumulative CIT');
      assertClose(sumLedger(booked.entries, '2221.02', '贷方'), 600, 'original and correction liabilities should reconcile');
      assertClose(sumLedger(booked.entries, '2221.02', '借方'), 600, 'original and supplemental payments should fully clear liability');
    }
  },
  {
    name: 'TAX-GL-07 keeps same-tax offset outside cash flow while reconciling the remaining liability',
    run: () => {
      const source = createPayableTaxMatter('企业所得税', 0, {
        filedAccountingAmount: -500,
        id: 'workflow-cit-offset-source',
        matterNo: 'TAX-WORKFLOW-CIT-OFFSET-SOURCE',
        payableAmount: 0,
        preparedPayableAmount: 0,
        preparedRefundableAmount: 500,
        paymentStatus: '无需缴纳',
        processStatus: '待退抵处理',
        refundableAmount: 500,
        refundStatus: '待申请',
        settlementDirection: '应退',
        title: '2025 年度企业所得税多缴'
      });
      const target = createPayableTaxMatter('企业所得税', 300, {
        id: 'workflow-cit-offset-target',
        matterNo: 'TAX-WORKFLOW-CIT-OFFSET-TARGET',
        title: '2026-Q3 企业所得税预缴'
      });
      const appliedSource = recordTaxMatterRefundApplication(source, {
        applicationDate: '2026-10-10',
        method: '抵缴',
        receiptNo: 'CIT-OFFSET-APPLICATION-001',
        targetMatterId: target.id
      });
      const offsetResult = assertDefined(recordTaxMatterOffsetResult(appliedSource, target, {
        amount: 300,
        offsetDate: '2026-10-15',
        receiptNo: 'CIT-OFFSET-RESULT-001'
      }), 'same-tax offset should update source and target matters');

      assertEqual(
        buildTaxMatterPaymentTransaction({
          financeRows: [],
          publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
          record: offsetResult.targetRecord
        }),
        undefined,
        'offset target must not generate a bank payment transaction'
      );

      const booked = bookReadyVouchers(buildVoucherRows([], [offsetResult.sourceRecord, offsetResult.targetRecord]));

      assertClose(sumLedger(booked.entries, '1002', '借方'), 0, 'same-tax offset must not increase bank balance');
      assertClose(sumLedger(booked.entries, '1002', '贷方'), 0, 'same-tax offset must not reduce bank balance');
      assertClose(
        sumLedger(booked.entries, '2221.02', '借方') - sumLedger(booked.entries, '2221.02', '贷方'),
        200,
        'ledger should retain only the unapplied overpayment balance'
      );
    }
  },
  {
    name: 'TAX-GL-08 carries itemized VAT refund through review and booking without collapsing surcharge liabilities',
    run: () => {
      const original = createPayableTaxMatter('增值税及附加', 466.51, {
        filedAccountingAmount: undefined,
        id: 'workflow-vat-refund',
        matterNo: 'TAX-WORKFLOW-VAT-REFUND',
        period: '2026-Q1',
        title: '2026-Q1 增值税及附加',
        vatSettlement: getVatSettlementSeed().vatSettlement
      });
      const paidOriginal = preparePaymentWorkflow(original, 466.51, '2026-04-12');
      const revision = startTaxMatterDeclarationRevision(paidOriginal.matter, '更正', '更正后调减增值税及附加');
      const corrected = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-05-10',
        taxAuthorityDeclarationNo: 'VAT-REFUND-CORRECTION-002',
        declarationStatus: '申报成功',
        differenceReason: '更正后调减增值税及附加',
        settlementAmount: 66.51,
        settlementDirection: '应退',
        vatBreakdown: {
          declaredVatAmount: 376,
          educationSurchargeAmount: 6,
          localEducationSurchargeAmount: 4,
          urbanMaintenanceTaxAmount: 14
        }
      });
      const applied = recordTaxMatterRefundApplication(corrected, {
        applicationDate: '2026-05-11',
        method: '退税',
        receiptNo: 'VAT-REFUND-APPLICATION-001'
      });
      const receipt = createReceipt('vat-refund-receipt', '退税回单');
      const refunded = recordTaxMatterRefundResult(applied, {
        amount: 66.51,
        receiptFile: receipt,
        refundDate: '2026-05-15'
      });
      const transaction = assertDefined(buildTaxMatterRefundTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: refunded,
        refundAmount: 66.51,
        refundDate: '2026-05-15',
        refundReceiptFile: receipt
      }), 'VAT refund should preserve itemized allocation data');
      const matter = attachTaxMatterRefundTransaction(refunded, transaction);
      const reviewedTransaction = reviewTransaction(transaction);
      const voucherRows = buildVoucherRows([reviewedTransaction], [matter]);
      const refundVoucher = assertDefined(
        voucherRows.find((record) => record.sourceNo === transaction.transactionNo),
        'reviewed VAT refund should create a cash voucher'
      );
      const liabilityCredit = refundVoucher.lines
        .filter((line) => line.side === '贷方' && ['2221.01', '2221.04', '2221.06', '2221.07'].includes(line.subjectCode))
        .reduce((total, line) => total + line.amount, 0);
      const booked = bookReadyVouchers(voucherRows);

      assertEqual(transaction.taxPaymentAllocations?.length, 4, 'VAT refund should retain four allocation lines');
      assertClose(liabilityCredit, 66.51, 'booked VAT refund should settle the four reduced liabilities');
      assertClose(sumLedger(booked.entries, '1002', '借方'), 66.51, 'booked VAT refund should increase bank balance');
    }
  },
  {
    name: 'TAX-GL-09 reopens tax payment after its pending-review transaction is voided',
    run: () => {
      const matter = createPayableTaxMatter('印花税', 10, {
        id: 'workflow-stamp-payment-void',
        matterNo: 'TAX-WORKFLOW-STAMP-PAYMENT-VOID'
      });
      const payment = preparePaymentWorkflow(matter, 10);
      const voidedTransaction: FinanceTransactionRecord = {
        ...payment.transaction,
        status: '已作废'
      };
      const reconciledMatter = reconcileTaxMatterCashSettlement(payment.matter, [voidedTransaction]);

      assertClose(reconciledMatter.paidAmount, 0, 'voided payment must not remain in the tax cash facts');
      assertEqual(reconciledMatter.paymentStatus, '待缴纳', 'voided payment should reopen payment handling');
      assertEqual(reconciledMatter.processStatus, '待缴款', 'voided payment should reopen the tax matter');
      assertEqual(reconciledMatter.paymentDate, undefined, 'voided payment must clear the effective payment date');
    }
  },
  {
    name: 'TAX-GL-10 nets a posted tax-payment reversal back to the unpaid liability',
    run: () => {
      const matter = createPayableTaxMatter('企业所得税', 500, {
        id: 'workflow-cit-payment-reversal',
        matterNo: 'TAX-WORKFLOW-CIT-PAYMENT-REVERSAL'
      });
      const payment = preparePaymentWorkflow(matter, 500);
      const reviewedPayment = reviewTransaction(payment.transaction);
      const reversal = buildFinanceTransactionAdjustmentRecord({
        existingRows: [reviewedPayment],
        files: [createReceipt('cit-payment-reversal-receipt', '缴款回单')],
        form: {
          amountText: '500.00',
          mode: '冲正',
          note: '原缴款流水重复登记',
          occurredAt: '2026-07-16',
          reason: '原缴款流水重复登记'
        },
        originRecord: reviewedPayment
      });
      const reviewedReversal = reviewTransaction(reversal, [reversal, reviewedPayment]);
      const reconciledMatter = reconcileTaxMatterCashSettlement(
        payment.matter,
        [reviewedReversal, reviewedPayment]
      );
      const booked = bookReadyVouchers(
        buildVoucherRows([reviewedReversal, reviewedPayment], [reconciledMatter])
      );

      assertClose(reconciledMatter.paidAmount, 0, 'posted reversal should remove the effective tax payment');
      assertEqual(reconciledMatter.processStatus, '待缴款', 'posted reversal should reopen tax payment handling');
      assertClose(
        sumLedger(booked.entries, '1002', '借方'),
        sumLedger(booked.entries, '1002', '贷方'),
        'payment and reversal should net the bank movement to zero'
      );
      assertClose(
        sumLedger(booked.entries, '2221.02', '贷方') - sumLedger(booked.entries, '2221.02', '借方'),
        500,
        'tax liability should remain outstanding after the cash payment is reversed'
      );

      const repeatedPayment = preparePaymentWorkflow(
        reconciledMatter,
        500,
        '2026-07-17',
        [reviewedReversal, reviewedPayment]
      );

      assertClose(repeatedPayment.transaction.amount, 500, 'reopened tax liability should allow a new payment registration');
    }
  },
  {
    name: 'TAX-GL-11 reopens a tax refund after its posted receipt is reversed',
    run: () => {
      const matter = createPayableTaxMatter('企业所得税', 0, {
        filedAccountingAmount: -500,
        id: 'workflow-cit-refund-reversal',
        matterNo: 'TAX-WORKFLOW-CIT-REFUND-REVERSAL',
        payableAmount: 0,
        paymentStatus: '无需缴纳',
        processStatus: '待退抵处理',
        refundableAmount: 500,
        refundApplicationDate: '2026-07-12',
        refundStatus: '申请中',
        settlementDirection: '应退'
      });
      const receipt = createReceipt('cit-refund-reversal-receipt', '退税回单');
      const refundedMatter = recordTaxMatterRefundResult(matter, {
        amount: 500,
        receiptFile: receipt,
        refundDate: '2026-07-15'
      });
      const refundTransaction = assertDefined(buildTaxMatterRefundTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: refundedMatter,
        refundAmount: 500,
        refundDate: '2026-07-15',
        refundReceiptFile: receipt
      }), 'tax refund should generate a receipt transaction');
      const attachedMatter = attachTaxMatterRefundTransaction(refundedMatter, refundTransaction);
      const reviewedRefund = reviewTransaction(refundTransaction);
      const reversal = buildFinanceTransactionAdjustmentRecord({
        existingRows: [reviewedRefund],
        files: [createReceipt('cit-refund-bank-reversal', '退税回单')],
        form: {
          amountText: '500.00',
          mode: '冲正',
          note: '退税到账流水重复登记',
          occurredAt: '2026-07-16',
          reason: '退税到账流水重复登记'
        },
        originRecord: reviewedRefund
      });
      const reviewedReversal = reviewTransaction(reversal, [reversal, reviewedRefund]);
      const reconciledMatter = reconcileTaxMatterCashSettlement(
        attachedMatter,
        [reviewedReversal, reviewedRefund]
      );

      assertClose(reconciledMatter.refundedAmount ?? 0, 0, 'posted reversal should remove the effective refund receipt');
      assertEqual(reconciledMatter.refundStatus, '申请中', 'refund handling should return to the submitted application');
      assertEqual(reconciledMatter.processStatus, '退抵处理中', 'reversed refund should no longer appear complete');
      assertEqual(reconciledMatter.refundDate, undefined, 'reversed refund must clear the effective receipt date');
    }
  },
  {
    name: 'TAX-GL-12 rejects partial tax reversal and keeps amount differences on the supplement path',
    run: () => {
      const matter = createPayableTaxMatter('企业所得税', 500, {
        id: 'workflow-cit-partial-reversal',
        matterNo: 'TAX-WORKFLOW-CIT-PARTIAL-REVERSAL'
      });
      const payment = preparePaymentWorkflow(matter, 500);
      const reviewedPayment = reviewTransaction(payment.transaction);
      const partialReversal = buildFinanceTransactionAdjustmentRecord({
        existingRows: [reviewedPayment],
        files: [createReceipt('cit-partial-reversal-receipt', '缴款回单')],
        form: {
          amountText: '250.00',
          mode: '冲正',
          note: '尝试部分冲正',
          occurredAt: '2026-07-16',
          reason: '尝试部分冲正'
        },
        originRecord: reviewedPayment
      });
      const result = commitFinanceTransactionAdjustmentRegistration(
        { financeRows: [reviewedPayment], receivablePayableRows: [] },
        partialReversal
      );

      assertEqual(result.success, false, 'tax payment reversal must keep the original allocation intact');
      if (result.success) {
        throw new Error('partial tax reversal should have been rejected');
      }
      assertEqual(
        result.message,
        '税费缴退流水只能全额冲正；差额请登记补差流水',
        'partial correction should use the supplement workflow'
      );
    }
  }
];

export function runTaxAccountingFrontendWorkflowTests() {
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
    passed: passedTestNames.length,
    passedTestNames,
    total: tests.length
  };
}
