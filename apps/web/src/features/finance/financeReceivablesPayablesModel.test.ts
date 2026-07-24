import { getFinanceCategorySnapshot, getFinanceSeedPublicAccountRef } from './financeData';
import type { FinanceTransactionRecord } from './financeData';
import { getDefaultReceivablePayableTaxBasis } from './financeTaxBasisModel';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  applyFinanceReceivablePayableSettlementReview,
  buildFinanceReceivablePayableAccrualReadiness,
  buildFinanceReceivablePayableFilterOptions,
  buildFinanceReceivablePayableMetrics,
  buildFinanceReceivablePayableSettlementTransaction,
  canEditFinanceReceivablePayableRecord,
  canRegisterFinanceReceivablePayableSettlement,
  createFinanceReceivablePayableForm,
  createFinanceReceivablePayableSettlementForm,
  getFinanceReceivablePayableDueDate,
  getFinanceReceivablePayableListTabKey,
  getFinanceReceivablePayablePayrollDueDate,
  getFinanceReceivablePayableRegisterableAmount,
  getFinanceReceivablePayableReviewProgressStatus,
  getFinanceReceivablePayableSettlementSnapshot,
  getFinanceReceivablePayableSettlementTargets,
  getFinanceReceivablePayableSourceLabel,
  getFinanceReceivablePayableSettlementStatusOptionsByTab,
  isFinanceReceivablePayableAccrualReady,
  isFinanceReceivablePayableOverdue,
  isFinanceReceivablePayableFormValid,
  isFinanceReceivablePayableSettlementFormValid,
  hasFinanceReceivablePayableActiveSettlement,
  hasFinanceReceivablePayableBookedVoucher,
  linkFinanceReceivablePayableSettlementTransaction,
  matchesFinanceReceivablePayableFilters,
  matchesFinanceReceivablePayableListTab,
  updateFinanceReceivablePayableRecordFromForm,
  type FinanceReceivablePayableFilters
} from './financeReceivablesPayablesModel';
import { getFinanceVatDeclarationOutcome, getFinanceVatOutcomeRate } from './financeTaxPolicyModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createReceivablePayableRecord(overrides: Partial<FinanceReceivablePayableRecord> = {}): FinanceReceivablePayableRecord {
  const category = overrides.category ?? '客户回款';
  const categorySnapshot = getFinanceCategorySnapshot(category);

  return {
    accountingPeriod: '2026-06',
    amount: 1000,
    category,
    categorySnapshot,
    confirmDate: '2026-06-10',
    confirmationStatus: '已确认',
    counterparty: '测试客户',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-TEST-001',
    dueDate: '2026-06-30',
    files: [
      {
        id: 'rp-test-file-001',
        name: '测试确认依据.pdf',
        status: '已上传',
        type: '确认依据',
        updatedAt: '2026-06-10'
      }
    ],
    id: 'rp-test-001',
    linkedTransactionNos: [],
    note: '',
    operationRecords: [],
    owner: '李明',
    reportAggregation: categorySnapshot.reportAggregation,
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-TEST-001',
    sourceTitle: '测试合同',
    sourceType: '合同应收',
    taxBasis: {
      basisSource: '来源单据',
      salesCategory: '服务、不动产和无形资产',
      taxAmount: 9.9,
      taxExcludedAmount: 990.1,
      taxIncludedAmount: 1000,
      taxRate: '1%'
    },
    updatedAt: '2026-06-10',
    ...overrides
  };
}

const defaultFilters: FinanceReceivablePayableFilters = {
  direction: '全部',
  keyword: '',
  periodTime: { mode: 'month', month: '2026-06' },
  settlementStatus: '全部'
};

const tests: UnitTest[] = [
  {
    name: 'uses small-scale VAT outcomes instead of a global one-percent default',
    run: () => {
      const exemptOutcome = getFinanceVatDeclarationOutcome({
        taxableClassification: '普通应税交易',
        taxableSalesAmount: 300000
      });
      const reducedOutcome = getFinanceVatDeclarationOutcome({
        taxableClassification: '普通应税交易',
        taxableSalesAmount: 300001
      });
      const propertyOutcome = getFinanceVatDeclarationOutcome({
        taxableClassification: '不动产或土地交易',
        taxableSalesAmount: 50000
      });

      assertEqual(exemptOutcome, '免税', 'sales within the configured filing threshold should be an exemption candidate');
      assertEqual(getFinanceVatOutcomeRate(exemptOutcome), '0%', 'exemption outcome should not produce VAT');
      assertEqual(reducedOutcome, '减按1%', 'ordinary taxable sales above threshold should use the reduced-rate candidate');
      assertEqual(getFinanceVatOutcomeRate(reducedOutcome), '1%', 'reduced outcome should retain the policy rate');
      assertEqual(propertyOutcome, '按法定征收率', 'property and land transactions must not inherit the ordinary one-percent result');
      assertEqual(getFinanceVatOutcomeRate(propertyOutcome), '3%', 'property and land candidate should use the legal levy rate');
    }
  },
  {
    name: 'keeps small-scale tax outcome pending until invoice facts and declaration period are confirmed',
    run: () => {
      const receivableTaxBasis = getDefaultReceivablePayableTaxBasis({
        amount: 10100,
        direction: '应收',
        sourceType: '合同应收'
      });
      const reimbursementTaxBasis = getDefaultReceivablePayableTaxBasis({
        amount: 1010,
        direction: '应付',
        sourceType: '员工报销'
      });
      const salaryTaxBasis = getDefaultReceivablePayableTaxBasis({
        amount: 12000,
        direction: '应付',
        sourceType: '薪酬发放'
      });

      assertEqual(receivableTaxBasis.basisSource, '来源单据', 'receivable should keep an accrual source before declaration preparation');
      assertEqual(receivableTaxBasis.taxOutcome, '待申报判定', 'receivable should retain a declaration-period tax outcome');
      assertEqual(receivableTaxBasis.taxRate, '待票面或申报判定', 'receivable should not receive a global default rate');
      assertEqual(receivableTaxBasis.taxAmount, 0, 'unresolved receivable should not split a speculative tax amount');
      assertEqual(reimbursementTaxBasis.taxRate, '以票面为准', 'input invoice rate should remain an invoice fact');
      assertEqual(reimbursementTaxBasis.inputTaxTreatment, '成本入账', 'small-scale input invoices should enter cost by policy');
      assertEqual(salaryTaxBasis.basisSource, '不涉及发票', 'salary payable should remain outside invoice tax basis');
      assertEqual(salaryTaxBasis.taxAmount, 0, 'non-invoice salary payable should not create VAT amount');
    }
  },
  {
    name: 'keeps accrual readiness in receivable-payable before voucher generation',
    run: () => {
      const readyRecord = createReceivablePayableRecord();
      const missingTaxRecord = createReceivablePayableRecord({
        id: 'missing-tax-record',
        taxBasis: {
          basisSource: '待确认',
          salesCategory: '服务、不动产和无形资产',
          taxAmount: 0,
          taxExcludedAmount: 0,
          taxIncludedAmount: 0,
          taxRate: '-'
        }
      });
      const missingSubjectRecord = createReceivablePayableRecord({
        category: '未配置类目',
        categorySnapshot: {
          ...readyRecord.categorySnapshot,
          accountingSubject: {
            balanceDirection: '借方',
            code: '',
            name: '未配置科目',
            type: '损益类'
          },
          accountingSubjectMappings: {},
          mappingIssue: '财务类目缺少有效会计科目映射',
          mappingStatus: '待配置',
          primaryCode: 'FC1-UNMAPPED',
          primaryName: '未归类',
          secondaryCode: 'FC2-UNMAPPED',
          secondaryName: '未配置类目'
        },
        id: 'missing-subject-record'
      });
      const missingEvidenceRecord = createReceivablePayableRecord({
        files: [],
        id: 'missing-evidence-record'
      });

      assertEqual(buildFinanceReceivablePayableAccrualReadiness(readyRecord).status, '已确认', 'complete confirmed accrual fact should be ready');
      assertEqual(isFinanceReceivablePayableAccrualReady(readyRecord), true, 'complete confirmed record should be consumable by accrual vouchers');
      assertEqual(buildFinanceReceivablePayableAccrualReadiness(missingTaxRecord).status, '待补票税', 'missing tax basis should stay upstream');
      assertEqual(isFinanceReceivablePayableAccrualReady(missingTaxRecord), false, 'missing tax basis should not be voucher-ready');
      assertEqual(buildFinanceReceivablePayableAccrualReadiness(missingSubjectRecord).status, '待配置', 'missing accounting subject should stay upstream');
      assertEqual(buildFinanceReceivablePayableAccrualReadiness(missingEvidenceRecord).status, '待补资料', 'missing original evidence should stay upstream');
    }
  },
  {
    name: 'requires complete source facts before receivable-payable adjustments can be saved',
    run: () => {
      const record = createReceivablePayableRecord();
      const validForm = createFinanceReceivablePayableForm(record);

      assertEqual(isFinanceReceivablePayableFormValid(validForm), true, 'complete source form should be valid');
      assertEqual(isFinanceReceivablePayableFormValid({ ...validForm, files: [] }), false, 'source confirmation evidence should be required');
      assertEqual(isFinanceReceivablePayableFormValid({ ...validForm, sourceNo: '' }), false, 'source number should be required');
      assertEqual(isFinanceReceivablePayableFormValid({ ...validForm, counterparty: '' }), false, 'counterparty should be required');
    }
  },
  {
    name: 'filters receivable-payable records by accounting period, direction, payment status, and keyword',
    run: () => {
      const payableRecord = createReceivablePayableRecord({
        accountingPeriod: '2026-06',
        counterparty: '测试供应商',
        direction: '应付',
        id: 'payable-record',
        settledAmount: 400,
        settlementStatus: '部分结清'
      });
      const previousMonthRecord = createReceivablePayableRecord({
        accountingPeriod: '2026-05',
        confirmDate: '2026-06-01',
        id: 'previous-month-record'
      });
      const currentPeriodLateConfirmationRecord = createReceivablePayableRecord({
        accountingPeriod: '2026-06',
        confirmDate: '2026-07-01',
        id: 'current-period-late-confirmation-record'
      });
      const pendingConfirmationRecord = createReceivablePayableRecord({
        confirmationStatus: '待确认',
        id: 'pending-confirmation-record'
      });

      assertEqual(
        matchesFinanceReceivablePayableFilters(payableRecord, { ...defaultFilters, direction: '应付' }),
        true,
        'payable record should match payable direction'
      );
      assertEqual(
        matchesFinanceReceivablePayableFilters(payableRecord, { ...defaultFilters, settlementStatus: '部分结清' }),
        true,
        'payable record should match settlement status'
      );
      assertEqual(
        matchesFinanceReceivablePayableFilters(payableRecord, { ...defaultFilters, keyword: '供应商' }),
        true,
        'keyword should match counterparty'
      );
      assertEqual(
        matchesFinanceReceivablePayableFilters(currentPeriodLateConfirmationRecord, defaultFilters),
        true,
        'current accounting period should match even when confirmation date is later'
      );
      assertEqual(
        matchesFinanceReceivablePayableFilters(previousMonthRecord, defaultFilters),
        false,
        'previous accounting period should not match June period scope'
      );
      assertEqual(
        matchesFinanceReceivablePayableFilters(pendingConfirmationRecord, defaultFilters),
        false,
        'pending upstream confirmation should not enter receivable-payable ledger'
      );
    }
  },
  {
    name: 'builds metrics from the provided filtered record set',
    run: () => {
      const juneRecord = createReceivablePayableRecord({
        amount: 1000,
        confirmDate: '2026-06-10',
        dueDate: '2026-06-30',
        id: 'metrics-june'
      });
      const mayRecord = createReceivablePayableRecord({
        amount: 500,
        confirmDate: '2026-05-20',
        dueDate: '2026-06-05',
        id: 'metrics-may'
      });

      const allMetrics = buildFinanceReceivablePayableMetrics([juneRecord, mayRecord]);
      const filteredMetrics = buildFinanceReceivablePayableMetrics([mayRecord]);

      assertEqual(allMetrics.confirmedAmount, 1500, 'metrics should sum all provided confirmation rows');
      assertEqual(filteredMetrics.confirmedAmount, 500, 'metrics should follow filtered rows instead of fixed current month');
      assertEqual(filteredMetrics.overdueRows.length, 1, 'overdue metrics should also follow filtered rows');
    }
  },
  {
    name: 'derives the unified salary payable due date from payroll calendar',
    run: () => {
      const salaryRecord = createReceivablePayableRecord({
        accountingPeriod: '2026-06',
        category: '工资发放',
        direction: '应付',
        dueDate: '2026-06-10',
        sourceType: '薪酬发放'
      });

      assertEqual(getFinanceReceivablePayablePayrollDueDate('2026-06'), '2026-07-15', 'June payroll should be due on next-month fifteenth');
      assertEqual(getFinanceReceivablePayablePayrollDueDate('2026-12'), '2027-01-15', 'December payroll should roll to next year');
      assertEqual(getFinanceReceivablePayableDueDate(salaryRecord), '2026-07-15', 'salary payable should use payroll due date');
    }
  },
  {
    name: 'separates settlement status, review progress, and overdue risk',
    run: () => {
      const unsettledRecord = createReceivablePayableRecord({ dueDate: '2026-06-05' });
      const partiallySettledRecord = createReceivablePayableRecord({
        amount: 1000,
        settledAmount: 400,
        settlementStatus: '部分结清'
      });
      const pendingTransaction = {
        amount: 600,
        status: '待复核',
        transactionNo: 'FIN-202606-0099'
      } as FinanceTransactionRecord;

      assertEqual(unsettledRecord.settlementStatus, '未结清', 'unsettled row should keep settlement status only');
      assertEqual(
        getFinanceReceivablePayableReviewProgressStatus(unsettledRecord, [pendingTransaction]),
        '待复核',
        'pending cash-flow should derive standalone review progress'
      );
      assertEqual(partiallySettledRecord.settlementStatus, '部分结清', 'partial row should keep settlement status only');
      assertEqual(
        getFinanceReceivablePayableReviewProgressStatus(partiallySettledRecord, [pendingTransaction]),
        '部分待复核',
        'partial settlement plus pending cash-flow should derive standalone partial review progress'
      );
      assertEqual(
        getFinanceReceivablePayableReviewProgressStatus(partiallySettledRecord),
        undefined,
        'standalone review progress should stay empty when no cash-flow is pending review'
      );
      assertEqual(isFinanceReceivablePayableOverdue(unsettledRecord), true, 'past due outstanding row should be overdue');
      assertEqual(
        isFinanceReceivablePayableOverdue(createReceivablePayableRecord({ dueDate: '2026-06-05', settledAmount: 1000, settlementStatus: '已结清' })),
        false,
        'settled row should not be overdue'
      );
    }
  },
  {
    name: 'separates receivable-payable list tabs and scopes status filters by tab',
    run: () => {
      const openRecord = createReceivablePayableRecord();
      const settledRecord = createReceivablePayableRecord({
        amount: 1000,
        settledAmount: 1000,
        settlementStatus: '已结清'
      });
      const openStatusOptions = getFinanceReceivablePayableSettlementStatusOptionsByTab('open').join('|');
      const settledStatusOptions = getFinanceReceivablePayableSettlementStatusOptionsByTab('settled').join('|');

      assertEqual(getFinanceReceivablePayableListTabKey(openRecord), 'open', 'unsettled record should stay in open tab');
      assertEqual(getFinanceReceivablePayableListTabKey(settledRecord), 'settled', 'settled record should move to settled tab');
      assertEqual(matchesFinanceReceivablePayableListTab(settledRecord, 'settled'), true, 'settled tab should match settled record');
      assertEqual(matchesFinanceReceivablePayableListTab(settledRecord, 'open'), false, 'open tab should exclude settled record');
      assertEqual(openStatusOptions.includes('已结清'), false, 'open tab status filter should exclude settled status');
      assertEqual(settledStatusOptions, '全部|已结清', 'settled tab should only expose settled status filter');
      assertEqual(
        buildFinanceReceivablePayableFilterOptions('open').settlementStatusOptions.includes('已结清'),
        false,
        'open tab filter options should stay scoped'
      );
      assertEqual(
        buildFinanceReceivablePayableFilterOptions('settled').settlementStatusOptions.join('|'),
        '全部|已结清',
        'settled tab filter options should stay scoped'
      );
    }
  },
  {
    name: 'keeps receivable-payable source labels tied to upstream source types',
    run: () => {
      assertEqual(getFinanceReceivablePayableSourceLabel('合同应收'), '合同应收', 'contract source label should remain source-owned');
      assertEqual(getFinanceReceivablePayableSourceLabel('外协结算'), '外协结算', 'labor settlement source label should remain source-owned');
      assertEqual(getFinanceReceivablePayableSourceLabel('员工报销'), '员工报销', 'expense source label should remain source-owned');
      assertEqual(getFinanceReceivablePayableSourceLabel('运营费用'), '运营费用', 'operating expense source label should remain source-owned');
    }
  },
  {
    name: 'updates source confirmation facts without rewriting object or settlement progress',
    run: () => {
      const record = createReceivablePayableRecord();
      const form = {
        ...createFinanceReceivablePayableForm(record),
        amount: 1200,
        counterparty: '被误改客户',
        counterpartyType: '供应商' as const,
        dueDate: '2026-07-05'
      };
      const updatedRecord = updateFinanceReceivablePayableRecordFromForm(record, form);

      assertEqual(updatedRecord.amount, 1200, 'ledger amount should be adjustable');
      assertEqual(updatedRecord.dueDate, '2026-07-05', 'source confirmation due date should be adjustable');
      assertEqual(updatedRecord.counterparty, record.counterparty, 'counterparty should stay source-owned');
      assertEqual(updatedRecord.counterpartyType, record.counterpartyType, 'counterparty type should stay source-owned');
      assertEqual(updatedRecord.settledAmount, record.settledAmount, 'settled amount should stay cash-flow-review-owned');
      assertEqual(updatedRecord.settlementStatus, record.settlementStatus, 'settlement status should stay cash-flow-review-owned');
      assertEqual(updatedRecord.sourceType, record.sourceType, 'automatic source type should be preserved');
      assertEqual(updatedRecord.sourceNo, record.sourceNo, 'automatic source number should be preserved');
      assertEqual(updatedRecord.sourceTitle, record.sourceTitle, 'automatic source title should be preserved');
      assertEqual(updatedRecord.operationRecords[0]?.action, '调整事项', 'ledger adjustment should be recorded first');
    }
  },
  {
    name: 'registers receivable-payable settlement as pending cash-flow without directly settling ledger',
    run: () => {
      const record = createReceivablePayableRecord({
        amount: 1000,
        settledAmount: 200,
        linkedTransactionNos: ['FIN-202606-0001']
      });
      const existingTransaction = {
        amount: 200,
        status: '已入账',
        transactionNo: 'FIN-202606-0001'
      } as FinanceTransactionRecord;
      const pendingTransaction = {
        amount: 300,
        status: '待复核',
        transactionNo: 'FIN-202606-0002'
      } as FinanceTransactionRecord;
      const registerableAmount = getFinanceReceivablePayableRegisterableAmount(record, [pendingTransaction]);
      const publicAccountRef = getFinanceSeedPublicAccountRef();
      const form = {
        ...createFinanceReceivablePayableSettlementForm(record, publicAccountRef.publicAccountId),
        amount: 500,
        files: [
          {
            id: 'settlement-file-001',
            name: '客户回款回单.pdf',
            status: '已选择',
            type: '收款凭证',
            updatedAt: '2026-06-23'
          }
        ]
      };

      assertEqual(registerableAmount, 500, 'pending settlement cash-flow should reduce registerable amount');
      assertEqual(isFinanceReceivablePayableSettlementFormValid(form, registerableAmount), true, 'settlement form should allow remaining amount');
      assertEqual(
        isFinanceReceivablePayableSettlementFormValid({ ...form, files: [] }, registerableAmount),
        false,
        'settlement registration should require a receipt or payment voucher'
      );

      const transaction = buildFinanceReceivablePayableSettlementTransaction(record, form, [existingTransaction, pendingTransaction], publicAccountRef);
      const linkedRecord = linkFinanceReceivablePayableSettlementTransaction(record, transaction);
      const editableRecord = createReceivablePayableRecord({ amount: 1000, settledAmount: 0 });

      assertEqual(canEditFinanceReceivablePayableRecord(editableRecord, []), true, 'ledger without settlement progress should remain editable');
      assertEqual(canEditFinanceReceivablePayableRecord(record, []), false, 'settled progress should lock ledger adjustment');
      assertEqual(
        canEditFinanceReceivablePayableRecord(editableRecord, [], true),
        false,
        'a source with a booked voucher should not be directly editable'
      );
      assertEqual(
        hasFinanceReceivablePayableBookedVoucher(editableRecord, [{ status: '已记账', voucherId: `voucher-business-${editableRecord.id}` }]),
        true,
        'booked voucher lifecycle should be resolved from the receivable-payable source id'
      );
      assertEqual(canEditFinanceReceivablePayableRecord(record, [transaction]), false, 'active cash-flow should lock ledger adjustment');
      assertEqual(canRegisterFinanceReceivablePayableSettlement(record, [pendingTransaction]), true, 'partially settled ledger should allow remaining settlement registration');
      assertEqual(transaction.transactionNo, 'FIN-202606-0003', 'settlement transaction should receive finance transaction number');
      assertEqual(transaction.direction, '收入', 'receivable settlement should create income cash-flow');
      assertEqual(transaction.paymentMethod, '对公账户收款', 'receivable settlement should use public account receipt');
      assertEqual(transaction.status, '待复核', 'settlement transaction should wait for review');
      assertEqual(transaction.reviewDueAt, '2026-06-16', 'settlement transaction should carry review due date');
      assertEqual(transaction.reconciliationStatus, '未对账', 'settlement transaction should wait for bank reconciliation');
      assertEqual(transaction.sourceNo, record.documentNo, 'settlement transaction should point to confirmation document');
      assertEqual(transaction.files[0]?.status, '已上传', 'settlement voucher should become uploaded file');
      assertEqual(linkedRecord.settledAmount, record.settledAmount, 'ledger settled amount should not change before review/reconciliation');
      assertEqual(linkedRecord.settlementStatus, record.settlementStatus, 'ledger status should not change before review/reconciliation');
      assertEqual(linkedRecord.linkedTransactionNos.includes(transaction.transactionNo), true, 'ledger should link pending cash-flow number');
      assertEqual(linkedRecord.operationRecords[0]?.action, '登记收款流水', 'ledger should record settlement registration action');
    }
  },
  {
    name: 'uses settlement occurrence month as cash-flow accounting period',
    run: () => {
      const record = createReceivablePayableRecord({
        accountingPeriod: '2026-05',
        amount: 1000,
        confirmDate: '2026-05-20',
        dueDate: '2026-05-31'
      });
      const publicAccountRef = getFinanceSeedPublicAccountRef('招商银行基本户');

      if (!publicAccountRef) {
        throw new Error('missing seed public account ref');
      }

      const transaction = buildFinanceReceivablePayableSettlementTransaction(
        record,
        {
          amount: 1000,
          files: [
            {
              id: 'settlement-file-cross-period-001',
              name: '6月收款回单.pdf',
              status: '已选择',
              type: '收款凭证',
              updatedAt: '2026-06-15'
            }
          ],
          note: '',
          occurredAt: '2026-06-15',
          publicAccountId: publicAccountRef.publicAccountId
        },
        [],
        publicAccountRef
      );

      assertEqual(transaction.accountingPeriod, '2026-06', 'settlement cash-flow period should follow occurrence date');
      assertEqual(record.accountingPeriod, '2026-05', 'source receivable/payable period should stay unchanged');
    }
  },
  {
    name: 'keeps receivable-payable registerable amount tied to active settlement rows only',
    run: () => {
      const record = createReceivablePayableRecord({ amount: 1000, settledAmount: 0 });
      const returnedTransaction = {
        amount: 400,
        status: '退回修改',
        transactionNo: 'FIN-202606-0010'
      } as FinanceTransactionRecord;
      const voidedTransaction = {
        amount: 300,
        status: '已作废',
        transactionNo: 'FIN-202606-0011'
      } as FinanceTransactionRecord;
      const pendingTransaction = {
        amount: 500,
        status: '待复核',
        transactionNo: 'FIN-202606-0012'
      } as FinanceTransactionRecord;
      const settledRecord = createReceivablePayableRecord({
        amount: 1000,
        settledAmount: 1000,
        settlementStatus: '已结清'
      });

      assertEqual(
        getFinanceReceivablePayableRegisterableAmount(record, [returnedTransaction, voidedTransaction]),
        1000,
        'returned and voided cash-flow rows should not occupy registerable amount'
      );
      assertEqual(
        canEditFinanceReceivablePayableRecord(record, [returnedTransaction, voidedTransaction]),
        true,
        'returned and voided cash-flow rows should not lock source confirmation'
      );
      assertEqual(
        getFinanceReceivablePayableRegisterableAmount(record, [pendingTransaction]),
        500,
        'pending review cash-flow should occupy remaining amount'
      );
      assertEqual(
        canRegisterFinanceReceivablePayableSettlement(settledRecord, []),
        false,
        'settled ledger should not allow further settlement registration'
      );
    }
  },
  {
    name: 'resolves settlement targets for cross-period cash-flow review guard',
    run: () => {
      const maySourceRecord = createReceivablePayableRecord({
        accountingPeriod: '2026-05',
        documentNo: 'AR-202605-001',
        id: 'rp-may-source',
        linkedTransactionNos: ['FIN-202606-0030']
      });
      const unrelatedRecord = createReceivablePayableRecord({
        documentNo: 'AR-202606-999',
        id: 'rp-unrelated',
        linkedTransactionNos: []
      });
      const juneTransaction = {
        amount: 1000,
        accountingPeriod: '2026-06',
        direction: '收入',
        relatedReceivableNo: maySourceRecord.documentNo,
        sourceNo: 'EC-202606-088',
        status: '待复核',
        transactionNo: 'FIN-202606-0030'
      } as FinanceTransactionRecord;
      const targets = getFinanceReceivablePayableSettlementTargets([maySourceRecord, unrelatedRecord], juneTransaction);

      assertEqual(targets.length, 1, 'cash-flow review guard should resolve linked source confirmation rows');
      assertEqual(targets[0]?.accountingPeriod, '2026-05', 'matched target should keep source accounting period');
    }
  },
  {
    name: 'derives reviewed settlement progress from posted cash-flow instead of mutating a counter',
    run: () => {
      const record = createReceivablePayableRecord({
        amount: 1000,
        linkedTransactionNos: ['FIN-202606-0020'],
        settledAmount: 0,
        settlementStatus: '未结清'
      });
      const pendingTransaction = {
        amount: 400,
        direction: '收入',
        sourceNo: record.documentNo,
        status: '待复核',
        transactionNo: 'FIN-202606-0020'
      } as FinanceTransactionRecord;
      const returnedTransaction = {
        ...pendingTransaction,
        status: '退回修改' as const,
        transactionNo: 'FIN-202606-0021'
      } as FinanceTransactionRecord;
      const postedTransaction = { ...pendingTransaction, status: '已入账' as const };
      const partiallySettledRows = applyFinanceReceivablePayableSettlementReview([record], pendingTransaction, [pendingTransaction]);
      const partiallySettledRecord = partiallySettledRows[0]!;
      const secondPostedTransaction = {
        ...postedTransaction,
        amount: 600,
        relatedReceivableNo: record.documentNo,
        sourceNo: 'EC-202606-088',
        transactionNo: 'FIN-202606-0022'
      } as FinanceTransactionRecord;
      const partiallySettledSnapshot = getFinanceReceivablePayableSettlementSnapshot(record, [postedTransaction]);
      const completedSnapshot = getFinanceReceivablePayableSettlementSnapshot(
        record,
        [postedTransaction, secondPostedTransaction]
      );
      const ignoredRows = applyFinanceReceivablePayableSettlementReview([record], returnedTransaction);

      assertEqual(partiallySettledRecord.settledAmount, 0, 'review logging should not mutate the ledger settlement counter');
      assertEqual(partiallySettledRecord.operationRecords[0]?.action, '确认收款入账', 'review writeback should record operation');
      assertEqual(partiallySettledSnapshot.settledAmount, 400, 'posted settlement should derive a partial settled amount');
      assertEqual(partiallySettledSnapshot.settlementStatus, '部分结清', 'posted settlement should derive a partial settlement status');
      assertEqual(completedSnapshot.settledAmount, 1000, 'multiple posted settlements should cap at confirmation amount');
      assertEqual(completedSnapshot.settlementStatus, '已结清', 'multiple posted settlements should derive a settled status');
      assertEqual(ignoredRows[0]?.settledAmount, 0, 'returned cash-flow should not write back settlement progress');
    }
  },
  {
    name: 'NP-14 reopens a settled receivable or payable when its posted settlement is reversed',
    run: () => {
      const record = createReceivablePayableRecord({
        amount: 1000,
        linkedTransactionNos: ['FIN-202606-0030'],
        settledAmount: 1000,
        settlementStatus: '已结清'
      });
      const receipt = {
        amount: 1000,
        direction: '收入',
        sourceNo: record.documentNo,
        status: '已入账',
        transactionNo: 'FIN-202606-0030'
      } as FinanceTransactionRecord;
      const reversal = {
        adjustmentContext: {
          mode: '冲正' as const,
          originTransactionNo: receipt.transactionNo,
          reason: '客户原收款退回'
        },
        amount: 1000,
        direction: '支出',
        sourceNo: receipt.transactionNo,
        status: '已入账',
        transactionNo: 'FIN-ADJ-202606-0001'
      } as FinanceTransactionRecord;
      const snapshot = getFinanceReceivablePayableSettlementSnapshot(record, [receipt, reversal]);

      assertEqual(snapshot.settledAmount, 0, 'posted reversal should offset the original receipt');
      assertEqual(snapshot.settlementStatus, '未结清', 'posted reversal should reopen the receivable');
      assertEqual(
        hasFinanceReceivablePayableActiveSettlement([receipt, reversal]),
        false,
        'a fully posted reversal should close the original active settlement fact'
      );
      assertEqual(
        hasFinanceReceivablePayableActiveSettlement([receipt, { ...reversal, status: '待复核' }]),
        true,
        'a pending reversal should keep the settlement under active processing'
      );
      assertEqual(
        hasFinanceReceivablePayableBookedVoucher(record, [{
          status: '已冲销',
          voucherId: `voucher-business-${record.id}`
        }]),
        false,
        'a reversed accrual voucher should no longer block source correction as an active booked voucher'
      );
    }
  }
];

export function runFinanceReceivablesPayablesModelTests() {
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
