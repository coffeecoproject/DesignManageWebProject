import {
  brandRecords,
  customerRecords,
  storeRecords
} from '../customers/customerData';
import { deriveCustomerContractReceiptViews } from '../customers/contractReceiptModel';
import { peopleMembers } from '../people/mockData';
import {
  applyTaskAcceptanceCommit,
  applyTaskAcceptanceReversal,
  validateTaskAcceptanceCommit,
  type TaskWorkflowState
} from '../tasks/taskAcceptanceCommitModel';
import {
  buildCustomerTaskBillingFact,
  buildCustomerTaskSettlementBatches,
  buildTaskCustomerBillingSnapshot
} from '../tasks/taskCustomerBillingModel';
import { buildTaskAcceptanceArchiveFile } from '../tasks/taskAcceptanceEvidenceModel';
import { applyCustomerTaskAcceptance } from '../tasks/taskCustomerAcceptanceModel';
import type {
  StoreTaskRecord,
  TaskPerformanceScoringRecord
} from '../tasks/TaskManagementState';
import {
  buildPartTimeLaborAcceptanceRecord,
  buildPartTimeLaborSettlementBatches
} from '../tasks/partTimeLaborSettlementModel';
import type { BrandSettlementPolicyVersionRecord } from '../customers/brandTaskPricingModel';
import { defaultBrandAcceptancePolicy } from '../customers/brandAcceptancePolicyModel';
import { getFinanceSeedPublicAccountRef } from './financeData';
import { mergeCustomerTaskReceivablePayableRecords } from './financeCustomerTaskSettlementModel';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVoucherFromReceivablePayable,
  buildAccountingVoucherFromTransaction,
  createAccountingVoucherLifecycleRecord
} from './financeAccountingVoucherModel';
import {
  buildInvoiceBusinessAllocations,
  buildInvoiceBusinessAssociationCandidates
} from './financeInvoiceAssociationModel';
import type { FinanceInvoiceRecord } from './financeInvoiceData';
import { mergePartTimeLaborReceivablePayableRecords } from './financePartTimeLaborSettlementModel';
import {
  buildFinanceReceivablePayableSettlementTransaction,
  createFinanceReceivablePayableSettlementForm,
  deriveFinanceReceivablePayableSettlementRows
} from './financeReceivablesPayablesModel';
import {
  commitFinanceReceivablePayableSettlementRegistration,
  commitFinanceTransactionReview
} from './financeSettlementWorkflow';

type UnitTest = { name: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const customer = customerRecords.find((row) => row.id === 'customer-starry')!;
const brand = brandRecords.find((row) => row.id === 'brand-starry-space')!;
const contract = {
  amount: 100000,
  amountMode: '固定金额' as const,
  code: 'CON-2026-001',
  customerId: 'customer-starry',
  expiresAt: '2026-12-31',
  files: [{
    id: 'contract-starry-framework-file',
    name: '星际空间设计服务框架合同.pdf',
    status: '已上传' as const,
    type: '已签署合同' as const,
    updatedAt: '2026-01-01'
  }],
  id: 'contract-starry-framework',
  name: '星际空间设计服务框架合同',
  note: '任务结算测试合同',
  owner: '李明',
  signedAt: '2026-01-01',
  stampDutyFacts: {
    amountTaxMode: '价税分列' as const,
    businessNature: '设计及咨询服务' as const,
    signedVersionNo: 'V1.0',
    vatAmount: 0
  },
  status: '有效' as const,
  type: '项目合同' as const,
  updatedAt: '2026-06-01'
};

assert(customer, 'customer fixture should exist');
assert(brand, 'brand fixture should exist');

function createTask({
  customerAccepted = true,
  executorId = '20260001',
  executorName = '李明',
  id,
  laborAgreement,
  unitPrice
}: {
  customerAccepted?: boolean;
  executorId?: string;
  executorName?: string;
  id: string;
  laborAgreement?: StoreTaskRecord['laborAgreement'];
  unitPrice: number;
}): StoreTaskRecord {
  const settlementPolicyVersion: BrandSettlementPolicyVersionRecord = {
    brandId: brand.id,
    effectiveFrom: '2026-01-01',
    id: `${brand.id}/settlement-v1`,
    policy: { mode: '按任务结算', perTaskDueDays: 15 },
    status: '生效中',
    version: 1
  };
  const customerBillingSnapshot = buildTaskCustomerBillingSnapshot({
    acceptancePolicy: defaultBrandAcceptancePolicy,
    brandId: brand.id,
    brandName: brand.name,
    capturedAt: '2026-06-10 09:00',
    contract,
    customerId: customer.id,
    customerName: customer.name,
    priceVersion: {
      billable: true,
      brandId: brand.id,
      contractId: contract.id,
      currency: 'CNY',
      effectiveFrom: '2026-01-01',
      id: `${id}/price-v1`,
      status: '生效中',
      taskConfigId: 'task-type-store-image',
      unitPrice,
      version: 1
    },
    settlementPolicyVersion,
    taskConfigId: 'task-type-store-image',
    taskId: id
  });

  assert(customerBillingSnapshot, 'task billing snapshot should be created');

  return {
    acceptedAt: '2026-06-18 16:00',
    acceptorId: '20250018',
    acceptorName: '陈浩',
    brandId: brand.id,
    code: `TASK-${id}`,
    createdAt: '2026-06-10 09:00',
    customerBillingSnapshot,
    customerAcceptance: customerAccepted
      ? {
          acceptedOn: '2026-06-19',
          deductionAmount: 0,
          deductionRate: 0,
          finalAmount: unitPrice,
          id: `${id}/customer-acceptance`,
          recordedAt: '2026-06-19 10:00',
          recordedBy: '李明',
          remark: '',
          qualityPenaltyPoints: 0,
          score: 95,
          standardAmount: unitPrice,
          taskId: id,
          timelinessPenaltyPoints: 0,
          timelinessResult: '未超时',
          totalPenaltyPoints: 0,
          updatedAt: '2026-06-19 10:00',
          updatedBy: '李明'
        }
      : undefined,
    customerId: customer.id,
    executorId,
    executorName,
    files: [buildTaskAcceptanceArchiveFile({
      acceptedAt: '2026-06-18 16:00',
      acceptedBy: '陈浩',
      task: { code: `TASK-${id}`, id }
    })],
    id,
    laborAgreement,
    name: `${executorName} 门店图任务`,
    note: '',
    operationRecords: [],
    plannedDeliveryAt: '2026-06-18 12:00',
    plannedDurationHours: 16,
    reworkCount: 0,
    status: '已完成',
    storeId: 'store-wh-optics',
    taskConfigId: 'task-type-store-image',
    taskDefinitionSnapshot: {
      capturedAt: '2026-06-10 09:00', category: '设计交付', code: 'TASK-IMAGE', deliveryHints: [], id: 'task-type-store-image', name: '门店图'
    },
    updatedAt: '2026-06-18 16:00'
  };
}

function createScoring(task: StoreTaskRecord): TaskPerformanceScoringRecord {
  return {
    adjustmentReason: '',
    confirmedAt: task.acceptedAt,
    confirmedBy: task.acceptorName,
    id: `${task.id}/score`,
    operationRecords: [],
    qualityDimensionScores: [],
    qualityScore: 95,
    sourceMonth: '2026-06',
    status: '已计入',
    taskId: task.id,
    updatedAt: task.acceptedAt ?? ''
  };
}

function createEmptyWorkflow(task: StoreTaskRecord): TaskWorkflowState {
  return {
    customerTaskBillingFacts: [],
    partTimeLaborAcceptanceRows: [],
    storeTaskRows: [{ ...task, acceptedAt: undefined, status: '待验收' }],
    taskPerformanceScoringRows: []
  };
}

const tests: UnitTest[] = [
  {
    name: 'TR-29 acceptance reversal retains audit history and removes downstream task sources',
    run() {
      const task = createTask({
        executorId: '20260006',
        executorName: '林悦',
        id: 'reversed-task',
        laborAgreement: {
          agreedGrossAmount: 1200,
          agreementVersion: 'HZ-PT-2026-0006/V1',
          projectId: 'HZ-PT-2026-0006/STORE-IMAGE'
        },
        unitPrice: 1600
      });
      const person = peopleMembers.find((row) => row.id === '20260006');
      const laborAcceptance = buildPartTimeLaborAcceptanceRecord({ person, task });
      assert(laborAcceptance.ready && laborAcceptance.acceptanceRecord, 'labor source should be ready before reversal');
      const committed = applyTaskAcceptanceCommit(createEmptyWorkflow(task), {
        laborAcceptance: laborAcceptance.acceptanceRecord,
        scoringRecord: createScoring(task),
        task
      });
      const reversed = applyTaskAcceptanceReversal(committed, {
        actor: '李明',
        occurredAt: '2026-07-18 10:00',
        reason: '验收结果录入错误',
        taskId: task.id
      });

      assertEqual(reversed.storeTaskRows[0]?.status, '待验收', 'task should return to pending acceptance');
      assertEqual(reversed.customerTaskBillingFacts[0]?.status, '已冲销', 'billing fact should remain as reversed history');
      assertEqual(reversed.taskPerformanceScoringRows[0]?.status, '不计入', 'performance source should stop contributing');
      assertEqual(
        reversed.partTimeLaborAcceptanceRows.find((record) => record.taskId === task.id)?.reversedAt,
        '2026-07-18 10:00',
        'labor source should remain as reversed audit history'
      );
      assertEqual(
        buildPartTimeLaborSettlementBatches({
          acceptanceRecords: reversed.partTimeLaborAcceptanceRows,
          people: peopleMembers,
          settlementPeriod: '2026-06',
          tasks: reversed.storeTaskRows.map((record) => ({ ...record, status: '已完成' }))
        }).batches.length,
        0,
        'reversed labor source must not contribute even if a stale completed task is supplied'
      );
      assertEqual(
        reversed.storeTaskRows[0]?.files.find((file) => file.stage === '验收归档')?.status,
        '已作废',
        'acceptance archive should remain as voided audit evidence'
      );
      assertEqual(
        buildCustomerTaskSettlementBatches({ asOfDate: '2026-07-18', facts: reversed.customerTaskBillingFacts }).batches.length,
        0,
        'reversed fact must not create a receivable batch'
      );
    }
  },
  {
    name: 'TR-07 acceptance is blocked atomically when the customer billing fact cannot be created',
    run() {
      const task = createTask({ id: 'missing-billing-snapshot', unitPrice: 1600 });
      const invalidTask = { ...task, customerBillingSnapshot: undefined };
      const initialState = createEmptyWorkflow(invalidTask);
      const input = { scoringRecord: createScoring(invalidTask), task: invalidTask };
      const validation = validateTaskAcceptanceCommit(input);

      assertEqual(validation.success, false, 'missing billing snapshot should block acceptance before state mutation');
      let failed = false;
      try {
        applyTaskAcceptanceCommit(initialState, input);
      } catch {
        failed = true;
      }

      assert(failed, 'the domain commit should reject an invalid acceptance even if the caller skips prevalidation');
      assertEqual(initialState.storeTaskRows[0]?.status, '待验收', 'the task should remain pending acceptance');
      assertEqual(initialState.taskPerformanceScoringRows.length, 0, 'performance scoring must not be partially written');
      assertEqual(initialState.customerTaskBillingFacts.length, 0, 'customer billing facts must not be partially written');
    }
  },
  {
    name: 'TR-08 repeated acceptance keeps one customer billing fact and one receivable',
    run() {
      const task = createTask({ id: 'full-time-task', unitPrice: 1600 });
      const input = { scoringRecord: createScoring(task), task };
      const first = applyTaskAcceptanceCommit(createEmptyWorkflow(task), input);
      const second = applyTaskAcceptanceCommit(first, input);
      const batches = buildCustomerTaskSettlementBatches({
        asOfDate: '2026-07-17',
        facts: second.customerTaskBillingFacts
      }).batches;
      const records = mergeCustomerTaskReceivablePayableRecords({
        batches,
        brands: brandRecords,
        canDirectCorrect: () => true,
        customers: customerRecords,
        records: [],
        stores: storeRecords
      });

      assertEqual(second.customerTaskBillingFacts.length, 1, 'repeated acceptance must keep one billing fact');
      assertEqual(records.length, 1, 'one billing fact must produce one receivable');
      assertEqual(records[0]?.amount, 1600, 'receivable amount must use frozen customer price');
    }
  },
  {
    name: 'TR-16 part-time task produces independent customer receivable and labor payable',
    run() {
      const task = createTask({
        executorId: '20260006',
        executorName: '林悦',
        id: 'part-time-task',
        laborAgreement: {
          agreedGrossAmount: 1200,
          agreementVersion: 'HZ-PT-2026-0006/V1',
          projectId: 'HZ-PT-2026-0006/STORE-IMAGE'
        },
        unitPrice: 1600
      });
      const person = peopleMembers.find((row) => row.id === '20260006');
      const laborAcceptance = buildPartTimeLaborAcceptanceRecord({ person, task });
      assert(laborAcceptance.ready && laborAcceptance.acceptanceRecord, 'part-time labor source should be ready');
      const workflow = applyTaskAcceptanceCommit(createEmptyWorkflow(task), {
        laborAcceptance: laborAcceptance.acceptanceRecord,
        scoringRecord: createScoring(task),
        task
      });
      const customerBatches = buildCustomerTaskSettlementBatches({
        asOfDate: '2026-07-17',
        facts: workflow.customerTaskBillingFacts
      }).batches;
      const laborBatches = buildPartTimeLaborSettlementBatches({
        acceptanceRecords: workflow.partTimeLaborAcceptanceRows,
        people: peopleMembers,
        settlementPeriod: '2026-06',
        tasks: workflow.storeTaskRows
      }).batches;
      const withReceivable = mergeCustomerTaskReceivablePayableRecords({
        batches: customerBatches,
        brands: brandRecords,
        canDirectCorrect: () => true,
        customers: customerRecords,
        records: [],
        stores: storeRecords
      });
      const records = mergePartTimeLaborReceivablePayableRecords({
        batches: laborBatches,
        people: peopleMembers,
        records: withReceivable
      });

      assertEqual(records.filter((record) => record.direction === '应收').length, 1, 'part-time execution must still create customer receivable');
      assertEqual(records.filter((record) => record.direction === '应付').length, 1, 'part-time execution must independently create labor payable');
      assertEqual(records.find((record) => record.direction === '应收')?.amount, 1600, 'customer price must remain independent');
      assertEqual(records.find((record) => record.direction === '应付')?.amount, 1200, 'labor agreement amount must remain independent');
    }
  },
  {
    name: 'TR-39 customer acceptance activates the net task receivable after internal completion',
    run() {
      const internallyAcceptedTask = createTask({
        customerAccepted: false,
        id: 'customer-acceptance-task',
        unitPrice: 1600
      });
      const internalWorkflow = applyTaskAcceptanceCommit(createEmptyWorkflow(internallyAcceptedTask), {
        scoringRecord: createScoring(internallyAcceptedTask),
        task: internallyAcceptedTask
      });
      const pendingBatches = buildCustomerTaskSettlementBatches({
        asOfDate: '2026-07-17',
        facts: internalWorkflow.customerTaskBillingFacts
      }).batches;
      const customerAcceptedTask = applyCustomerTaskAcceptance(
        internallyAcceptedTask,
        { acceptedOn: '2026-06-19', correctionReason: '', remark: '评分触发规则扣款', score: 82, timelinessResult: '未超时' },
        { actor: '李明', occurredAt: '2026-06-19 10:00' }
      );
      const effectiveFact = buildCustomerTaskBillingFact(customerAcceptedTask);

      assertEqual(pendingBatches.length, 0, 'internal completion alone must not create customer receivable batches');
      assert(effectiveFact, 'customer acceptance should retain the current billing fact');
      const records = mergeCustomerTaskReceivablePayableRecords({
        batches: buildCustomerTaskSettlementBatches({ asOfDate: '2026-07-17', facts: [effectiveFact] }).batches,
        brands: brandRecords,
        canDirectCorrect: () => true,
        customers: customerRecords,
        records: [],
        stores: storeRecords
      });

      assertEqual(records.length, 1, 'customer acceptance should activate one customer receivable');
      assertEqual(records[0]?.amount, 1280, 'customer receivable should use the rule-calculated net amount');
      assertEqual(
        internalWorkflow.taskPerformanceScoringRows[0]?.status,
        '已计入',
        'internal performance should remain independent from customer acceptance'
      );
    }
  },
  {
    name: 'TR-25 task receivable remains consumable by invoice settlement and voucher workflows',
    run() {
      const task = createTask({ id: 'downstream-task', unitPrice: 1600 });
      const workflow = applyTaskAcceptanceCommit(createEmptyWorkflow(task), {
        scoringRecord: createScoring(task),
        task
      });
      const batches = buildCustomerTaskSettlementBatches({
        asOfDate: '2026-07-17',
        facts: workflow.customerTaskBillingFacts
      }).batches;
      const records = mergeCustomerTaskReceivablePayableRecords({
        batches,
        brands: brandRecords,
        canDirectCorrect: () => true,
        customers: customerRecords,
        records: [],
        stores: storeRecords
      });
      const receivable = records[0];

      assert(receivable, 'task acceptance should create a downstream receivable');

      const invoice: FinanceInvoiceRecord = {
        accountingPeriod: '2026-06',
        counterparty: customer.name,
        declarationPeriod: '2026-Q2',
        declarationTreatment: '本期申报',
        direction: '销项',
        id: 'invoice-task-downstream',
        importedAt: '2026-06-20 10:00',
        invoiceColor: '蓝票',
        invoiceDate: '2026-06-20',
        invoiceKind: '普通发票',
        invoiceNo: '254420000000610099',
        invoiceStatus: '正常',
        netAmount: 1584.16,
        salesCategory: '服务、不动产和无形资产',
        sourceFile: '2026-06_销项发票_税务下载.xlsx',
        taxAmount: 15.84,
        taxExcludedAmount: 1584.16,
        taxIncludedAmount: 1600,
        taxRate: '1%',
        taxableClassification: '普通应税交易',
        totalAmount: 1600,
        vatTreatment: '减按1%'
      };
      const candidates = buildInvoiceBusinessAssociationCandidates(invoice, [invoice], [], [receivable]);
      const candidate = candidates.find((row) => row.businessRecord.id === receivable.id);

      assert(candidate, 'task receivable should be available to invoice association');

      const allocations = buildInvoiceBusinessAllocations(
        invoice,
        [{
          amount: 1600,
          matchBasis: candidate.matchBasis,
          targetId: receivable.id,
          targetNo: receivable.documentNo,
          targetTitle: receivable.sourceTitle,
          targetType: '应收应付'
        }],
        { actor: '李明', occurredAt: '2026-06-20 10:05', sequence: 1 }
      );
      const voucher = buildAccountingVoucherFromReceivablePayable(receivable, 0, [invoice], allocations);
      const publicAccountRef = getFinanceSeedPublicAccountRef();
      const settlementForm = {
        ...createFinanceReceivablePayableSettlementForm(receivable, publicAccountRef.publicAccountId),
        files: [{
          id: 'task-collection-proof',
          name: '任务结算收款回单.pdf',
          status: '已选择' as const,
          type: '收款凭证',
          updatedAt: '2026-06-25'
        }],
        occurredAt: '2026-06-25'
      };
      const transaction = buildFinanceReceivablePayableSettlementTransaction(
        receivable,
        settlementForm,
        [],
        publicAccountRef
      );
      const registration = commitFinanceReceivablePayableSettlementRegistration(
        { financeRows: [], receivablePayableRows: [receivable] },
        receivable.id,
        transaction
      );

      assert(registration.success, 'task receivable should complete collection registration');
      const review = commitFinanceTransactionReview(registration, {
        operationId: 'task-collection-review',
        reviewedAt: '2026-06-25 15:00',
        reviewer: '财务复核',
        transactionId: transaction.id
      });
      assert(review.success, 'registered task collection should post through finance review');
      const settledReceivable = deriveFinanceReceivablePayableSettlementRows(
        review.receivablePayableRows,
        review.financeRows
      )[0];

      assertEqual(settledReceivable?.settlementStatus, '已结清', 'posted collection should settle the task receivable');
      assertEqual(settledReceivable?.settledAmount, 1600, 'settled amount should equal the task receivable amount');
      const contractReceipt = deriveCustomerContractReceiptViews({
        contracts: [contract],
        financeRows: review.financeRows,
        receivablePayableRows: review.receivablePayableRows
      })[0];
      assertEqual(contractReceipt?.receivedAmount, 1600, 'posted task collection should enter the linked contract receipt summary');
      assertEqual(contractReceipt?.receiptRecords.length, 1, 'linked contract should expose one posted receipt record');
      assert(voucher, 'task receivable with invoice basis should generate an accrual voucher');
      assertEqual(voucher.sourceNo, receivable.documentNo, 'voucher should retain the task receivable document number');
      const postedTransaction = review.financeRows.find((row) => row.id === transaction.id);

      assert(postedTransaction, 'reviewed task collection should retain the posted transaction');
      const collectionVoucher = buildAccountingVoucherFromTransaction(postedTransaction, 1);

      assert(collectionVoucher, 'reviewed task collection should generate a funds voucher');
      assertEqual(
        buildAccountingLedgerEntries([voucher, collectionVoucher]).length,
        0,
        'pending-booking task vouchers must not enter the general ledger'
      );

      const bookedVouchers = applyAccountingVoucherLifecycle(
        [voucher, collectionVoucher],
        [
          createAccountingVoucherLifecycleRecord(voucher, '记-202606-101', '李明', '2026-06-25 15:10'),
          createAccountingVoucherLifecycleRecord(collectionVoucher, '记-202606-102', '李明', '2026-06-25 15:15')
        ]
      );
      const ledgerEntries = buildAccountingLedgerEntries(bookedVouchers);

      assertEqual(
        ledgerEntries.length,
        voucher.lines.length + collectionVoucher.lines.length,
        'booked accrual and collection vouchers should create one ledger entry per accounting line'
      );
      assertEqual(
        ledgerEntries.filter((entry) => entry.subjectCode === '1122').length,
        2,
        'task revenue ledger should debit and later clear accounts receivable'
      );
      assert(
        ledgerEntries.some((entry) => entry.subjectCode === '5001' && entry.creditAmount === invoice.netAmount),
        'task acceptance revenue should enter operating revenue at the tax-exclusive amount after booking'
      );
      assert(
        ledgerEntries.some((entry) => entry.subjectCode === '2221.01' && entry.creditAmount === invoice.taxAmount),
        'task acceptance accrual should retain output VAT separately from operating revenue'
      );
      assert(
        ledgerEntries.some((entry) => entry.subjectCode === '1002' && entry.debitAmount === 1600),
        'reviewed customer collection should enter bank deposit after booking'
      );
    }
  }
];

export function runTaskCustomerReceivableFrontendWorkflowTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];

  for (const test of tests) {
    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed: passedTestNames.length,
    passedTestNames,
    total: tests.length
  };
}
