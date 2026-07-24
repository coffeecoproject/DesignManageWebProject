import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { useTaskManagementState } from '../tasks/TaskManagementState';
import { useFinanceLedgerInitialization } from './FinanceLedgerInitializationState';
import {
  applyAccountingPeriodCloseLock,
  assignTaxFilingAdjustmentAccountingPeriod,
  type AccountingPeriodCloseCheckSnapshotItem,
  type AccountingPeriodCloseSummarySnapshot,
  canBookAccountingVoucher,
  canSubmitLaterPeriodAccountingVoucherAdjustment,
  canReverseAccountingVoucher,
  createAccountingVoucherLifecycleRecord,
  createReversalAccountingVoucherSnapshot,
  createReversedAccountingVoucherSnapshot,
  guardAccountingPeriodOpen,
  getNextAccountingVoucherNo,
  reopenAccountingPeriodLock,
  validateAccountingVoucherReversal,
  type AccountingPeriodLockRecord,
  type AccountingPeriodOpenGuard,
  type AccountingVoucherLaterPeriodAdjustmentInput,
  type AccountingVoucherLaterPeriodAdjustmentRecord,
  type AccountingVoucherLifecycleRecord,
  type AccountingVoucherRecord,
  type AccountingVoucherReversalInput,
  applyAccountingVoucherLifecycle,
  buildAccountingVouchers
} from './financeAccountingVoucherModel';
import { financeTransactionRecords, type FinanceTransactionRecord } from './financeData';
import {
  buildFinanceBankReconciliationLinkRecord,
  buildSeedFinanceBankReconciliationLinks,
  type FinanceBankReconciliationLinkRecord
} from './financeBankReconciliationModel';
import type { BankStatementRecord } from './financeBankImportContract';
import {
  financeStampDutyManualSourceRecords,
  financeStampDutyInitialSourceResolutions,
  financeDeclarationPreparationRecords,
  ensurePayrollIitDeclarationPreparationRecords,
  finalizeDeclarationPreparationAfterFiling,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import type {
  FinanceStampDutySourceRecord,
  FinanceStampDutySourceResolution
} from './financeStampDutyModel';
import {
  financeInvoiceBusinessAllocations,
  financeInvoiceImportBatches,
  financeInvoiceRecords,
  type FinanceInvoiceImportBatch,
  type FinanceInvoiceBusinessAllocation,
  type FinanceInvoiceRecord
} from './financeInvoiceData';
import {
  buildInvoiceBusinessAllocations,
  buildRedInvoiceBusinessAllocations,
  doesInvoiceAllocationMatchReceivablePayable,
  getInvoiceAssociationMatchBasis,
  getInvoiceBusinessAssociationAllocatedAmount,
  type FinanceBusinessInvoiceAssociationDraft,
  type FinanceInvoiceAssociationDraft
} from './financeInvoiceAssociationModel';
import { buildOriginalInvoiceRedSummary, isFinanceInvoiceAllocationEffective } from './financeInvoiceModel';
import {
  financeReceivablePayableRecords,
  getReceivablePayableConfirmedAmount,
  type FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import {
  deriveFinanceReceivablePayableSettlementRows,
  getFinanceReceivablePayableLinkedTransactionRows,
  getFinanceReceivablePayableSettlementSignedAmount,
  hasFinanceReceivablePayableActiveSettlement,
  hasFinanceReceivablePayableBookedVoucher,
  getFinanceReceivablePayableSettlementTargets
} from './financeReceivablesPayablesModel';
import {
  commitFinanceReceivablePayableSettlementRegistration,
  commitFinanceTransactionAdjustmentRegistration,
  commitFinanceTransactionReview,
  type FinanceSettlementWorkflowResult
} from './financeSettlementWorkflow';
import {
  financeTaxMatterRecords,
  type FinanceTaxMatterRecord
} from './financeTaxFilingData';
import {
  ensurePayrollIitTaxMatterRecords,
  reconcileTaxMatterCashSettlement
} from './financeTaxMatterModel';
import { useSalaryManagementState } from '../salary/SalaryManagementState';
import type { SalaryAdjustmentRecord } from '../salary/salaryDomain';
import { accountingSubjectProfile } from './financeAccountingSubjectData';
import type { LedgerOpeningAdjustmentVoucherRecord } from './financeLedgerInitializationModel';
import {
  financeMonthEndMatterRecords,
  markFinanceMonthEndMatterBooked,
  type FinanceMonthEndMatterRecord
} from './financeMonthEndModel';
import { financeToday, getAccountingPeriodFromBusinessPeriod } from './financeUtils';
import { mergePartTimeLaborReceivablePayableRecords } from './financePartTimeLaborSettlementModel';
import {
  getCustomerTaskSettlementMergeIssues,
  mergeCustomerTaskReceivablePayableRecords,
  reconcileCustomerTaskReversals,
  reconcileZeroNetCustomerTaskAcceptanceCorrections,
  type CustomerTaskSettlementMergeIssue
} from './financeCustomerTaskSettlementModel';
import { mergeSalaryReceivablePayableRecords } from './financeSalarySettlementModel';
import {
  buildFinanceExpenseApprovalCommit,
  buildFinanceExpenseApprovalReversal,
  buildFinanceExpenseEvidenceSupplement
} from './financeExpenseApprovalCommitModel';
import {
  commitPayrollIitCorrectionAfterPostedReversal,
  finalizePayrollIitCorrectionPreparation
} from './financePayrollIitCorrectionWorkflow';

type FinanceManagementStateValue = {
  addManualStampDutySource: (record: FinanceStampDutySourceRecord) => boolean;
  addStampDutySettlementSource: (record: FinanceStampDutySourceRecord) => boolean;
  saveStampDutySourceResolution: (resolution: FinanceStampDutySourceResolution) => boolean;
  addAccountingVoucherLaterPeriodAdjustment: (record: AccountingVoucherLaterPeriodAdjustmentRecord) => boolean;
  addFinanceTransaction: (record: FinanceTransactionRecord) => boolean;
  registerReceivablePayableSettlement: (
    recordId: string,
    transaction: FinanceTransactionRecord
  ) => FinanceSettlementWorkflowResult;
  importInvoiceBatch: (batch: FinanceInvoiceImportBatch, records: FinanceInvoiceRecord[]) => boolean;
  addLedgerOpeningAdjustmentVoucher: (record: LedgerOpeningAdjustmentVoucherRecord) => boolean;
  addSourceGeneratedReceivablePayableRecord: (record: FinanceReceivablePayableRecord) => boolean;
  commitExpenseApprovalFinancialPlan: (plan: {
    payableRecord?: FinanceReceivablePayableRecord;
    salaryAdjustment?: SalaryAdjustmentRecord;
  }) => boolean;
  revokeExpenseApprovalFinancialPlan: (input: {
    occurredAt: string;
    reason: string;
    salaryAdjustmentId?: string;
    sourceCode: string;
  }) => { reason?: string; success: boolean };
  supplementExpenseApprovalEvidence: (sourceCode: string, file: RelatedFileRecord) => boolean;
  addTransactionVoucherFile: (transactionId: string, file: RelatedFileRecord) => boolean;
  accountingPeriodLocks: AccountingPeriodLockRecord[];
  accountingVoucherLaterPeriodAdjustmentRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  accountingVoucherLifecycleRows: AccountingVoucherLifecycleRecord[];
  accountingVoucherRows: AccountingVoucherRecord[];
  bankReconciliationRows: FinanceBankReconciliationLinkRecord[];
  customerTaskSettlementIssues: CustomerTaskSettlementMergeIssue[];
  confirmBankReconciliation: (bankRecord: BankStatementRecord, transactions: FinanceTransactionRecord[]) => boolean;
  financeRows: FinanceTransactionRecord[];
  manualStampDutySourceRows: FinanceStampDutySourceRecord[];
  stampDutySourceResolutionRows: FinanceStampDutySourceResolution[];
  getAccountingPeriodGuard: (accountingPeriod: string | undefined, actionLabel?: string) => AccountingPeriodOpenGuard;
  isAccountingPeriodClosed: (accountingPeriod: string | undefined) => boolean;
  closeAccountingPeriod: (
    accountingPeriod: string,
    reason?: string,
    closeCheckSnapshot?: AccountingPeriodCloseCheckSnapshotItem[],
    closeSummarySnapshot?: AccountingPeriodCloseSummarySnapshot
  ) => boolean;
  commitTaxMatterPayment: (
    recordId: string,
    nextRecord: FinanceTaxMatterRecord,
    transaction: FinanceTransactionRecord
  ) => boolean;
  commitTaxMatterDeclarationResult: (
    recordId: string,
    nextRecord: FinanceTaxMatterRecord
  ) => boolean;
  commitTaxMatterRefund: (
    recordId: string,
    nextRecord: FinanceTaxMatterRecord,
    transaction: FinanceTransactionRecord
  ) => boolean;
  commitTaxMatterOffset: (
    sourceRecordId: string,
    targetRecordId: string,
    nextSourceRecord: FinanceTaxMatterRecord,
    nextTargetRecord: FinanceTaxMatterRecord
  ) => boolean;
  declarationPreparationRows: FinanceDeclarationPreparationRecord[];
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[];
  invoiceImportBatches: FinanceInvoiceImportBatch[];
  invoiceRows: FinanceInvoiceRecord[];
  ledgerOpeningAdjustmentRows: LedgerOpeningAdjustmentVoucherRecord[];
  monthEndMatterRows: FinanceMonthEndMatterRecord[];
  receivablePayableRows: FinanceReceivablePayableRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
  removeTransactionVoucherFile: (transactionId: string, fileId: string) => boolean;
  revokeBankReconciliation: (transactionId: string, bankSerialNo: string, reason: string) => boolean;
  returnFinanceTransaction: (transactionId: string) => boolean;
  reviewFinanceTransaction: (transactionId: string) => FinanceSettlementWorkflowResult;
  reopenAccountingPeriod: (accountingPeriod: string, reason: string) => boolean;
  updateFinanceTransactionsByNo: (
    transactionNos: string[],
    updater: (record: FinanceTransactionRecord) => FinanceTransactionRecord
  ) => boolean;
  updateReceivablePayableRecord: (
    recordId: string,
    updater: (record: FinanceReceivablePayableRecord) => FinanceReceivablePayableRecord
  ) => boolean;
  replaceInvoiceBusinessAssociations: (invoiceId: string, nextDrafts: FinanceInvoiceAssociationDraft[]) => boolean;
  replaceBusinessInvoiceAssociations: (
    businessRecordId: string,
    nextDrafts: FinanceBusinessInvoiceAssociationDraft[]
  ) => boolean;
  linkRedInvoiceOriginal: (invoiceId: string, originalInvoiceId: string) => boolean;
  updateDeclarationPreparationRecord: (
    recordId: string,
    updater: (record: FinanceDeclarationPreparationRecord) => FinanceDeclarationPreparationRecord
  ) => boolean;
  updateTaxMatterRecord: (
    recordId: string,
    updater: (record: FinanceTaxMatterRecord) => FinanceTaxMatterRecord
  ) => boolean;
  updateMonthEndMatterRecord: (
    recordId: string,
    updater: (record: FinanceMonthEndMatterRecord) => FinanceMonthEndMatterRecord
  ) => boolean;
  bookAccountingVoucher: (record: AccountingVoucherRecord) => boolean;
  reverseAccountingVoucher: (record: AccountingVoucherRecord, reversalInput: AccountingVoucherReversalInput) => boolean;
  validateAccountingVoucherLaterPeriodAdjustment: (
    record: AccountingVoucherRecord,
    input: AccountingVoucherLaterPeriodAdjustmentInput
  ) => boolean;
  voidFinanceTransaction: (transactionId: string) => boolean;
};

const FinanceManagementContext = createContext<FinanceManagementStateValue | undefined>(undefined);
const currentFinanceActor = '李明';
const seedBankReconciliationRows = buildSeedFinanceBankReconciliationLinks(financeTransactionRecords);
const seedPendingAccountingVoucherIds = new Set(['voucher-business-ap-202606-003']);

function getAccountingVoucherLifecycleTime(record: AccountingVoucherRecord, clockTime: string) {
  const lifecycleDate = record.voucherDate.slice(0, 7) === financeToday.slice(0, 7) ? financeToday : record.voucherDate;

  return `${lifecycleDate} ${clockTime}`;
}

function createSeedAccountingVoucherLifecycleRows() {
  const seedVoucherRows = buildAccountingVouchers(
    financeReceivablePayableRecords,
    financeTransactionRecords,
    financeInvoiceRecords,
    financeTaxMatterRecords,
    seedBankReconciliationRows,
    [],
    [],
    {
      accountingPeriodStart: accountingSubjectProfile.effectivePeriod,
      declarationPreparationRows: financeDeclarationPreparationRecords,
      invoiceBusinessAllocationRows: financeInvoiceBusinessAllocations,
      monthEndMatterRows: financeMonthEndMatterRecords
    }
  );

  return seedVoucherRows
    .filter((record) => (
      record.status === '待记账'
      && !seedPendingAccountingVoucherIds.has(record.id)
      && (record.businessType !== '资金凭证' || record.sourceRefs.some((sourceRef) => sourceRef.module === '银行对账'))
    ))
    .reduce<AccountingVoucherLifecycleRecord[]>((lifecycleRows, record) => {
      const bookedAt = getAccountingVoucherLifecycleTime(record, '17:10');
      const bookedLifecycle = createAccountingVoucherLifecycleRecord(
        record,
        getNextAccountingVoucherNo(lifecycleRows, record.accountingPeriod),
        currentFinanceActor,
        bookedAt
      );

      return [...lifecycleRows, bookedLifecycle];
    }, []);
}

const seedAccountingVoucherLifecycleRows = createSeedAccountingVoucherLifecycleRows();
const seedAccountingPeriodLocks: AccountingPeriodLockRecord[] = [];

function getPreviousAccountingPeriod(accountingPeriod: string) {
  const [year, month] = accountingPeriod.split('-').map(Number);
  const previousMonth = new Date(year, month - 2, 1);
  return `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
}

export function FinanceManagementProvider({ children }: { children: ReactNode }) {
  const { enabledProfile } = useFinanceLedgerInitialization();
  const { brandRows, customerRows, storeRows } = useCustomerManagementState();
  const {
    isSalaryAdjustmentPeriodOpen,
    salaryAdjustments,
    salaryMonthlyWorkflows,
    salaryPaymentRecords,
    reverseSalaryPayment,
    saveSalaryAdjustment,
    voidSalaryAdjustment
  } = useSalaryManagementState();
  const { peopleRows } = usePeopleOrganizationState();
  const {
    customerTaskBillingFacts,
    customerTaskSettlementBatches,
    partTimeLaborSettlementBatches
  } = useTaskManagementState();
  const [financeRows, setFinanceRows] = useState<FinanceTransactionRecord[]>(financeTransactionRecords);
  const [invoiceRows, setInvoiceRows] = useState<FinanceInvoiceRecord[]>(financeInvoiceRecords);
  const [invoiceBusinessAllocationRows, setInvoiceBusinessAllocationRows] = useState<FinanceInvoiceBusinessAllocation[]>(
    financeInvoiceBusinessAllocations
  );
  const [invoiceImportBatches, setInvoiceImportBatches] = useState<FinanceInvoiceImportBatch[]>(financeInvoiceImportBatches);
  const [receivablePayableRows, setReceivablePayableRows] = useState<FinanceReceivablePayableRecord[]>(
    financeReceivablePayableRecords
  );
  const [declarationPreparationRows, setDeclarationPreparationRows] = useState<FinanceDeclarationPreparationRecord[]>(
    financeDeclarationPreparationRecords
  );
  const [manualStampDutySourceRows, setManualStampDutySourceRows] = useState<FinanceStampDutySourceRecord[]>(
    financeStampDutyManualSourceRecords
  );
  const [stampDutySourceResolutionRows, setStampDutySourceResolutionRows] = useState<FinanceStampDutySourceResolution[]>(
    financeStampDutyInitialSourceResolutions
  );
  const [taxMatterRows, setTaxMatterRows] = useState<FinanceTaxMatterRecord[]>(financeTaxMatterRecords);
  const [ledgerOpeningAdjustmentRows, setLedgerOpeningAdjustmentRows] = useState<LedgerOpeningAdjustmentVoucherRecord[]>([]);
  const [monthEndMatterRows, setMonthEndMatterRows] = useState<FinanceMonthEndMatterRecord[]>(financeMonthEndMatterRecords);
  const [accountingVoucherLaterPeriodAdjustmentRows, setAccountingVoucherLaterPeriodAdjustmentRows] = useState<AccountingVoucherLaterPeriodAdjustmentRecord[]>([]);
  const [accountingVoucherLifecycleRows, setAccountingVoucherLifecycleRows] = useState<AccountingVoucherLifecycleRecord[]>(
    () => [...seedAccountingVoucherLifecycleRows]
  );
  const [accountingPeriodLocks, setAccountingPeriodLocks] = useState<AccountingPeriodLockRecord[]>(
    () => [...seedAccountingPeriodLocks]
  );
  const [bankReconciliationRows, setBankReconciliationRows] = useState<FinanceBankReconciliationLinkRecord[]>(
    () => seedBankReconciliationRows
  );
  const customerTaskReversalReconciliation = useMemo(
    () => reconcileCustomerTaskReversals({
      canDirectCorrect: (record) =>
        guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '撤销任务验收').allowed
        && !hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
        && !invoiceBusinessAllocationRows.some((allocation) =>
          allocation.targetType === '应收应付'
          && allocation.targetId === record.id
          && isFinanceInvoiceAllocationEffective(allocation)
        )
        && !hasFinanceReceivablePayableActiveSettlement(
          getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
        ),
      facts: customerTaskBillingFacts,
      records: receivablePayableRows
    }),
    [
      accountingPeriodLocks,
      accountingVoucherLifecycleRows,
      customerTaskBillingFacts,
      financeRows,
      invoiceBusinessAllocationRows,
      receivablePayableRows
    ]
  );
  const customerTaskZeroNetReconciliation = useMemo(
    () => reconcileZeroNetCustomerTaskAcceptanceCorrections({
      canDirectCorrect: (record) =>
        guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '更正甲方验收').allowed
        && !hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
        && !invoiceBusinessAllocationRows.some((allocation) =>
          allocation.targetType === '应收应付'
          && allocation.targetId === record.id
          && isFinanceInvoiceAllocationEffective(allocation)
        )
        && !hasFinanceReceivablePayableActiveSettlement(
          getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
        ),
      facts: customerTaskBillingFacts,
      records: receivablePayableRows
    }),
    [
      accountingPeriodLocks,
      accountingVoucherLifecycleRows,
      customerTaskBillingFacts,
      financeRows,
      invoiceBusinessAllocationRows,
      receivablePayableRows
    ]
  );
  const customerTaskSettlementIssues = useMemo(
    () => {
      const resolvedIssueIds = new Set(
        accountingVoucherLaterPeriodAdjustmentRows
          .filter((record) => record.candidateStatus === '已记账' && record.correctionContext)
          .filter((adjustment) => {
            const sourceRecord = receivablePayableRows.find(
              (record) => record.id === adjustment.correctionContext?.recordId
            );
            if (!sourceRecord) {
              return false;
            }

            const correctionAlreadyApplied = sourceRecord.taskSettlementCorrections?.some(
              (correction) => correction.issueId === adjustment.correctionContext?.issueId
            ) ?? false;
            const correctedAmount = Number((
              getReceivablePayableConfirmedAmount(sourceRecord)
              + (correctionAlreadyApplied ? 0 : adjustment.signedAmount)
            ).toFixed(2));
            const linkedTransactions = getFinanceReceivablePayableLinkedTransactionRows(sourceRecord, financeRows);
            const hasPendingTransaction = linkedTransactions.some((record) => record.status === '待复核');
            const postedAmount = linkedTransactions
              .filter((record) => record.status === '已入账')
              .reduce(
                (total, transaction) => total + getFinanceReceivablePayableSettlementSignedAmount(
                  sourceRecord,
                  transaction,
                  financeRows
                ),
                0
              );
            const allocatedInvoiceAmount = invoiceBusinessAllocationRows
              .filter((allocation) => (
                allocation.targetType === '应收应付'
                && allocation.targetId === sourceRecord.id
                && isFinanceInvoiceAllocationEffective(allocation)
              ))
              .reduce((total, allocation) => total + allocation.taxIncludedAmount, 0);

            return (
              correctedAmount >= -0.01
              && !hasPendingTransaction
              && postedAmount <= correctedAmount + 0.01
              && allocatedInvoiceAmount <= correctedAmount + 0.01
            );
          })
          .map((record) => record.correctionContext?.issueId)
          .filter((issueId): issueId is string => Boolean(issueId))
      );
      const issues = [
        ...getCustomerTaskSettlementMergeIssues({
        batches: customerTaskSettlementBatches,
        brands: brandRows,
        canDirectCorrect: (record) =>
          guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '更正甲方验收').allowed
          && !hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
          && !invoiceBusinessAllocationRows.some((allocation) =>
            allocation.targetType === '应收应付'
            && allocation.targetId === record.id
            && isFinanceInvoiceAllocationEffective(allocation)
          )
          && !hasFinanceReceivablePayableActiveSettlement(
            getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
          ),
        customers: customerRows,
        records: receivablePayableRows
      }),
        ...customerTaskZeroNetReconciliation.issues,
        ...customerTaskReversalReconciliation.issues
      ];

      return issues.filter((issue) => !resolvedIssueIds.has(issue.issueId));
    },
    [
      brandRows,
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingPeriodLocks,
      accountingVoucherLifecycleRows,
      customerRows,
      customerTaskReversalReconciliation.issues,
      customerTaskSettlementBatches,
      customerTaskZeroNetReconciliation.issues,
      financeRows,
      invoiceBusinessAllocationRows,
      receivablePayableRows
    ]
  );
  useEffect(() => {
    setReceivablePayableRows((currentRows) => {
      const mergedRows = mergeCustomerTaskReceivablePayableRecords({
        batches: customerTaskSettlementBatches,
        brands: brandRows,
        canDirectCorrect: (record) =>
          guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '更正甲方验收').allowed
          && !hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
          && !invoiceBusinessAllocationRows.some((allocation) =>
            allocation.targetType === '应收应付'
            && allocation.targetId === record.id
            && isFinanceInvoiceAllocationEffective(allocation)
          )
          && !hasFinanceReceivablePayableActiveSettlement(
            getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
          ),
        customers: customerRows,
        records: currentRows,
        stores: storeRows
      });

      const zeroNetReconciledRows = reconcileZeroNetCustomerTaskAcceptanceCorrections({
        canDirectCorrect: (record) =>
          guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '更正甲方验收').allowed
          && !hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
          && !invoiceBusinessAllocationRows.some((allocation) =>
            allocation.targetType === '应收应付'
            && allocation.targetId === record.id
            && isFinanceInvoiceAllocationEffective(allocation)
          )
          && !hasFinanceReceivablePayableActiveSettlement(
            getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
          ),
        facts: customerTaskBillingFacts,
        records: mergedRows
      }).records;

      return reconcileCustomerTaskReversals({
        canDirectCorrect: (record) =>
          guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '撤销任务验收').allowed
          && !hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
          && !invoiceBusinessAllocationRows.some((allocation) =>
            allocation.targetType === '应收应付'
            && allocation.targetId === record.id
            && isFinanceInvoiceAllocationEffective(allocation)
          )
          && !hasFinanceReceivablePayableActiveSettlement(
            getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
          ),
        facts: customerTaskBillingFacts,
        records: zeroNetReconciledRows
      }).records;
    });
  }, [
    accountingPeriodLocks,
    accountingVoucherLifecycleRows,
    brandRows,
    customerRows,
    customerTaskBillingFacts,
    customerTaskSettlementBatches,
    financeRows,
    invoiceBusinessAllocationRows,
    storeRows
  ]);
  useEffect(() => {
    setReceivablePayableRows((currentRows) =>
      mergePartTimeLaborReceivablePayableRecords({
        batches: partTimeLaborSettlementBatches,
        canDirectCorrect: (record) =>
          guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '撤销兼职任务验收').allowed
          && !hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
          && !hasFinanceReceivablePayableActiveSettlement(
            getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
          ),
        people: peopleRows,
        records: currentRows
      })
    );
  }, [
    accountingPeriodLocks,
    accountingVoucherLifecycleRows,
    financeRows,
    partTimeLaborSettlementBatches,
    peopleRows
  ]);
  useEffect(() => {
    setReceivablePayableRows((currentRows) =>
      mergeSalaryReceivablePayableRecords({
        payments: salaryPaymentRecords,
        people: peopleRows,
        records: currentRows,
        workflows: salaryMonthlyWorkflows
      })
    );
  }, [peopleRows, salaryMonthlyWorkflows, salaryPaymentRecords]);
  const effectiveDeclarationPreparationRows = useMemo(
    () => ensurePayrollIitDeclarationPreparationRecords(
      declarationPreparationRows,
      salaryPaymentRecords,
      financeRows,
      receivablePayableRows
    ),
    [declarationPreparationRows, financeRows, receivablePayableRows, salaryPaymentRecords]
  );
  const effectiveTaxMatterRows = useMemo(
    () => ensurePayrollIitTaxMatterRecords(taxMatterRows, effectiveDeclarationPreparationRows)
      .map((record) => reconcileTaxMatterCashSettlement(record, financeRows))
      .map((record) => assignTaxFilingAdjustmentAccountingPeriod(record, accountingPeriodLocks)),
    [accountingPeriodLocks, effectiveDeclarationPreparationRows, financeRows, taxMatterRows]
  );
  const derivedReceivablePayableRows = useMemo(
    () => deriveFinanceReceivablePayableSettlementRows(receivablePayableRows, financeRows),
    [financeRows, receivablePayableRows]
  );
  const accountingVoucherRows = useMemo(
    () => applyAccountingVoucherLifecycle(
      buildAccountingVouchers(
        derivedReceivablePayableRows,
        financeRows,
        invoiceRows,
        effectiveTaxMatterRows,
        bankReconciliationRows,
        ledgerOpeningAdjustmentRows,
        accountingVoucherLaterPeriodAdjustmentRows,
        {
          accountingPeriodStart: accountingSubjectProfile.effectivePeriod,
          declarationPreparationRows: effectiveDeclarationPreparationRows,
          invoiceBusinessAllocationRows,
          monthEndMatterRows
        }
      ),
      accountingVoucherLifecycleRows
    ),
    [
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingVoucherLifecycleRows,
      bankReconciliationRows,
      customerTaskSettlementIssues,
      derivedReceivablePayableRows,
      effectiveDeclarationPreparationRows,
      financeRows,
      invoiceBusinessAllocationRows,
      invoiceRows,
      ledgerOpeningAdjustmentRows,
      monthEndMatterRows,
      effectiveTaxMatterRows
    ]
  );

  const value = useMemo<FinanceManagementStateValue>(
    () => ({
      addManualStampDutySource(record) {
        const duplicate = manualStampDutySourceRows.some(
          (currentRecord) =>
            currentRecord.sourceId === record.sourceId &&
            currentRecord.sourceVersion === record.sourceVersion &&
            currentRecord.taxItem === record.taxItem
        );

        if (duplicate) {
          return false;
        }

        const accountingPeriod = getAccountingPeriodFromBusinessPeriod(record.obligationPeriod);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, accountingPeriod, '补录印花税应税凭证').allowed) {
          return false;
        }

        setManualStampDutySourceRows((currentRows) => [...currentRows, record]);
        return true;
      },
      addStampDutySettlementSource(record) {
        const duplicate = manualStampDutySourceRows.some(
          (currentRecord) => currentRecord.id === record.id || currentRecord.sourceNo === record.sourceNo
        );

        if (duplicate || !record.settlementDate || record.resolutionStatus !== '可申报') {
          return false;
        }

        const accountingPeriod = getAccountingPeriodFromBusinessPeriod(record.obligationPeriod);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, accountingPeriod, '登记印花税实际结算').allowed) {
          return false;
        }

        setManualStampDutySourceRows((currentRows) => [...currentRows, record]);
        return true;
      },
      saveStampDutySourceResolution(resolution) {
        const accountingPeriod = getAccountingPeriodFromBusinessPeriod(resolution.obligationPeriod);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, accountingPeriod, '确认印花税税源').allowed) {
          return false;
        }

        setStampDutySourceResolutionRows((currentRows) => [
          ...currentRows.filter(
            (currentRecord) =>
              currentRecord.sourceId !== resolution.sourceId || currentRecord.sourceVersion !== resolution.sourceVersion
          ),
          resolution
        ]);
        return true;
      },
      accountingPeriodLocks,
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingVoucherLifecycleRows,
      accountingVoucherRows,
      invoiceBusinessAllocationRows,
      invoiceImportBatches,
      ledgerOpeningAdjustmentRows,
      monthEndMatterRows,
      getAccountingPeriodGuard(accountingPeriod, actionLabel = '修改') {
        return guardAccountingPeriodOpen(accountingPeriodLocks, accountingPeriod, actionLabel);
      },
      isAccountingPeriodClosed(accountingPeriod) {
        return Boolean(accountingPeriod) && !guardAccountingPeriodOpen(accountingPeriodLocks, accountingPeriod, '修改').allowed;
      },
      addLedgerOpeningAdjustmentVoucher(record) {
        if (!guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '生成期初调整凭证').allowed) {
          return false;
        }

        setLedgerOpeningAdjustmentRows((currentRows) => {
          const alreadyExists = currentRows.some((currentRecord) => currentRecord.id === record.id || currentRecord.voucherNo === record.voucherNo);

          return alreadyExists ? currentRows : [record, ...currentRows];
        });

        return true;
      },
      addAccountingVoucherLaterPeriodAdjustment(record) {
        const input: AccountingVoucherLaterPeriodAdjustmentInput = {
          accountingPeriod: record.accountingPeriod,
          adjustmentMode: record.adjustmentMode,
          adjustedAt: record.adjustedAt,
          correctionContext: record.correctionContext,
          reason: record.reason,
          signedAmount: record.signedAmount
        };

        if (!canSubmitLaterPeriodAccountingVoucherAdjustment(
          record.snapshot,
          input,
          accountingPeriodLocks,
          accountingVoucherLaterPeriodAdjustmentRows
        )) {
          return false;
        }

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '创建后续调整事项').allowed) {
          return false;
        }

        setAccountingVoucherLaterPeriodAdjustmentRows((currentRows) => {
          const alreadyExists = currentRows.some(
            (currentRecord) =>
              currentRecord.id === record.id ||
              currentRecord.adjustmentNo === record.adjustmentNo ||
              (
                currentRecord.originalVoucherId === record.originalVoucherId &&
                currentRecord.accountingPeriod === record.accountingPeriod &&
                currentRecord.correctionContext?.issueId === record.correctionContext?.issueId
              )
          );

          return alreadyExists ? currentRows : [record, ...currentRows];
        });

        return true;
      },
      addFinanceTransaction(record) {
        if (!guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '登记流水').allowed) {
          return false;
        }

        if (record.adjustmentContext) {
          const result = commitFinanceTransactionAdjustmentRegistration(
            { financeRows, receivablePayableRows: derivedReceivablePayableRows },
            record
          );

          if (!result.success) {
            return false;
          }

          setFinanceRows(result.financeRows);
          return true;
        }

        setFinanceRows((current) => current.some(
          (candidate) => candidate.id === record.id || candidate.transactionNo === record.transactionNo
        )
          ? current
          : [record, ...current]
        );
        return true;
      },
      registerReceivablePayableSettlement(recordId, transaction) {
        const record = derivedReceivablePayableRows.find((candidate) => candidate.id === recordId);
        const recordPeriodGuard = guardAccountingPeriodOpen(
          accountingPeriodLocks,
          record?.accountingPeriod,
          record?.direction === '应收' ? '登记收款流水' : '登记付款流水'
        );
        const transactionPeriodGuard = guardAccountingPeriodOpen(
          accountingPeriodLocks,
          transaction.accountingPeriod,
          record?.direction === '应收' ? '登记收款流水' : '登记付款流水'
        );

        if (!recordPeriodGuard.allowed || !transactionPeriodGuard.allowed) {
          return {
            message: recordPeriodGuard.reason ?? transactionPeriodGuard.reason ?? '当前会计期间已锁定',
            success: false
          };
        }

        const result = commitFinanceReceivablePayableSettlementRegistration(
          { financeRows, receivablePayableRows: derivedReceivablePayableRows },
          recordId,
          transaction
        );

        if (result.success) {
          setFinanceRows(result.financeRows);
          setReceivablePayableRows(result.receivablePayableRows);
        }

        return result;
      },
      commitTaxMatterPayment(recordId, nextRecord, transaction) {
        const currentRecord = effectiveTaxMatterRows.find((record) => record.id === recordId);
        const duplicateTransaction = financeRows.some(
          (record) => record.id === transaction.id || record.transactionNo === transaction.transactionNo
        );

        if (
          !currentRecord ||
          nextRecord.id !== currentRecord.id ||
          transaction.sourceNo !== currentRecord.matterNo ||
          duplicateTransaction ||
          !guardAccountingPeriodOpen(accountingPeriodLocks, transaction.accountingPeriod, '登记税费缴款流水').allowed
        ) {
          return false;
        }

        setFinanceRows((currentRows) => [transaction, ...currentRows]);
        setTaxMatterRows((currentRows) =>
          currentRows.some((record) => record.id === recordId)
            ? currentRows.map((record) => (record.id === recordId ? nextRecord : record))
            : [nextRecord, ...currentRows]
        );
        return true;
      },
      commitTaxMatterDeclarationResult(recordId, nextRecord) {
        const currentRecord = effectiveTaxMatterRows.find((record) => record.id === recordId);

        if (
          !currentRecord
          || nextRecord.id !== currentRecord.id
          || !['申报成功', '零申报'].includes(nextRecord.declarationStatus)
        ) {
          return false;
        }

        const committedRecord = assignTaxFilingAdjustmentAccountingPeriod(
          nextRecord,
          accountingPeriodLocks
        );

        const preparation = effectiveDeclarationPreparationRows.find(
          (record) =>
            record.taxType === committedRecord.matterType
            && record.period === committedRecord.period
            && (!committedRecord.declarationScenario || record.declarationScenario === committedRecord.declarationScenario)
        );
        const nextPreparation = preparation
          ? finalizeDeclarationPreparationAfterFiling(
              finalizePayrollIitCorrectionPreparation(
                preparation,
                committedRecord,
                currentFinanceActor,
                `${financeToday} 15:10`
              ),
              committedRecord,
              currentFinanceActor,
              `${financeToday} 15:10`
            )
          : undefined;

        setTaxMatterRows((currentRows) =>
          currentRows.some((record) => record.id === recordId)
            ? currentRows.map((record) => (record.id === recordId ? committedRecord : record))
            : [committedRecord, ...currentRows]
        );

        if (preparation && nextPreparation && nextPreparation !== preparation) {
          setDeclarationPreparationRows((currentRows) =>
            currentRows.some((record) => record.id === preparation.id)
              ? currentRows.map((record) => (record.id === preparation.id ? nextPreparation : record))
              : [nextPreparation, ...currentRows]
          );
        }

        return true;
      },
      commitTaxMatterRefund(recordId, nextRecord, transaction) {
        const currentRecord = effectiveTaxMatterRows.find((record) => record.id === recordId);
        const duplicateTransaction = financeRows.some(
          (record) => record.id === transaction.id || record.transactionNo === transaction.transactionNo
        );

        if (
          !currentRecord ||
          nextRecord.id !== currentRecord.id ||
          transaction.sourceNo !== currentRecord.matterNo ||
          transaction.direction !== '收入' ||
          transaction.category !== '税费退还' ||
          duplicateTransaction ||
          !guardAccountingPeriodOpen(accountingPeriodLocks, transaction.accountingPeriod, '登记退税流水').allowed
        ) {
          return false;
        }

        setFinanceRows((currentRows) => [transaction, ...currentRows]);
        setTaxMatterRows((currentRows) =>
          currentRows.some((record) => record.id === recordId)
            ? currentRows.map((record) => (record.id === recordId ? nextRecord : record))
            : [nextRecord, ...currentRows]
        );
        return true;
      },
      commitTaxMatterOffset(sourceRecordId, targetRecordId, nextSourceRecord, nextTargetRecord) {
        const sourceRecord = effectiveTaxMatterRows.find((record) => record.id === sourceRecordId);
        const targetRecord = effectiveTaxMatterRows.find((record) => record.id === targetRecordId);

        if (
          !sourceRecord
          || !targetRecord
          || sourceRecord.id === targetRecord.id
          || sourceRecord.matterType !== targetRecord.matterType
          || nextSourceRecord.id !== sourceRecord.id
          || nextTargetRecord.id !== targetRecord.id
          || nextSourceRecord.offsetTargetMatterId !== targetRecord.id
        ) {
          return false;
        }

        setTaxMatterRows((currentRows) => currentRows.map((record) => {
          if (record.id === sourceRecordId) return nextSourceRecord;
          if (record.id === targetRecordId) return nextTargetRecord;
          return record;
        }));
        return true;
      },
      importInvoiceBatch(batch, records) {
        const lockedRecord = records.find(
          (record) => !guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '导入税务发票数据').allowed
        );

        const duplicateInvoice = records.find((record) =>
          invoiceRows.some((currentRecord) => currentRecord.id === record.id || currentRecord.invoiceNo === record.invoiceNo)
        );
        const duplicateBatch = invoiceImportBatches.some((currentBatch) => currentBatch.id === batch.id);

        if (lockedRecord || duplicateInvoice || duplicateBatch) {
          return false;
        }

        setInvoiceRows((currentRows) => [...records, ...currentRows]);
        setInvoiceImportBatches((currentBatches) => [batch, ...currentBatches]);
        return true;
      },
      addSourceGeneratedReceivablePayableRecord(record) {
        if (!guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '生成应收应付事项').allowed) {
          return false;
        }

        setReceivablePayableRows((currentRows) => {
          const alreadyExists = currentRows.some(
            (currentRecord) =>
              currentRecord.documentNo === record.documentNo ||
              currentRecord.sourceNo === record.sourceNo
          );

          return alreadyExists ? currentRows : [record, ...currentRows];
        });
        return true;
      },
      commitExpenseApprovalFinancialPlan({ payableRecord, salaryAdjustment }) {
        let nextSnapshot;

        try {
          nextSnapshot = buildFinanceExpenseApprovalCommit({
            isSalaryAdjustmentPeriodOpen,
            isAccountingPeriodOpen: (accountingPeriod) => guardAccountingPeriodOpen(
              accountingPeriodLocks,
              accountingPeriod,
              '通过报销并生成应付事项'
            ).allowed,
            plan: { payableRecord, salaryAdjustment },
            snapshot: {
              payableRows: receivablePayableRows,
              salaryAdjustments
            }
          });
        } catch {
          return false;
        }

        if (salaryAdjustment && !saveSalaryAdjustment(salaryAdjustment)) {
          return false;
        }

        if (payableRecord) {
          setReceivablePayableRows(nextSnapshot.payableRows);
        }

        return true;
      },
      revokeExpenseApprovalFinancialPlan({ occurredAt, reason, salaryAdjustmentId, sourceCode }) {
        let reversal;

        try {
          reversal = buildFinanceExpenseApprovalReversal({
            actor: currentFinanceActor,
            hasActiveSettlement: (record) => hasFinanceReceivablePayableActiveSettlement(
              getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
            ),
            isAccountingPeriodOpen: (accountingPeriod) => guardAccountingPeriodOpen(
              accountingPeriodLocks,
              accountingPeriod,
              '撤销费用报销审核'
            ).allowed,
            isPayableBooked: (record) => hasFinanceReceivablePayableBookedVoucher(
              record,
              accountingVoucherLifecycleRows
            ),
            isSalaryAdjustmentPeriodOpen,
            occurredAt,
            payableRows: receivablePayableRows,
            reason,
            salaryAdjustmentId,
            salaryAdjustments,
            sourceCode
          });
        } catch (error) {
          return {
            reason: error instanceof Error ? error.message : '报销财务结果未撤销',
            success: false
          };
        }

        if (reversal.salaryAdjustmentToVoid) {
          const voidResult = voidSalaryAdjustment(reversal.salaryAdjustmentToVoid.id, occurredAt, reason);
          if (!voidResult.success) {
            return voidResult;
          }
        }

        setReceivablePayableRows(reversal.payableRows);

        return { success: true };
      },
      supplementExpenseApprovalEvidence(sourceCode, file) {
        try {
          const nextRows = buildFinanceExpenseEvidenceSupplement({
            actor: currentFinanceActor,
            file,
            hasActiveSettlement: (record) => hasFinanceReceivablePayableActiveSettlement(
              getFinanceReceivablePayableLinkedTransactionRows(record, financeRows)
            ),
            isAccountingPeriodOpen: (accountingPeriod) => guardAccountingPeriodOpen(
              accountingPeriodLocks,
              accountingPeriod,
              '补充报销凭证'
            ).allowed,
            isPayableBooked: (record) => hasFinanceReceivablePayableBookedVoucher(
              record,
              accountingVoucherLifecycleRows
            ),
            payableRows: receivablePayableRows,
            sourceCode
          });

          setReceivablePayableRows(nextRows);
        } catch {
          return false;
        }
        return true;
      },
      confirmBankReconciliation(bankRecord, transactions) {
        const lockedRecord = transactions.find((record) =>
          !guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '确认银行对账').allowed
        );

        if (lockedRecord) {
          return false;
        }

        const transactionIds = new Set(transactions.map((record) => record.id));
        const bankLink = buildFinanceBankReconciliationLinkRecord(bankRecord, transactions);

        setBankReconciliationRows((currentRows) => [
          bankLink,
          ...currentRows.filter((record) => record.bankStatementId !== bankRecord.id)
        ]);
        setFinanceRows((current) =>
          current.map((record) =>
            transactionIds.has(record.id)
              ? {
                  ...record,
                  reconciliationStatus: '已对账',
                  reconciledAt: financeToday,
                  updatedAt: `${financeToday} 16:30`,
                  operationRecords: [
                    ...record.operationRecords,
                    {
                      id: `fin-op-bank-confirm-${Date.now()}`,
                      time: `${financeToday} 16:30`,
                      actor: '李明',
                      object: record.transactionNo,
                      action: '确认对账',
                      summary: `确认银行流水 ${bankRecord.bankSerialNo} 与系统流水 ${record.transactionNo} 对账；状态 未对账 -> 已对账`
                    }
                  ]
                }
              : record
          )
        );
        return true;
      },
      closeAccountingPeriod(accountingPeriod, reason = '期间结账', closeCheckSnapshot, closeSummarySnapshot) {
        const enabledPeriod = enabledProfile?.effectivePeriod;
        const previousPeriod = getPreviousAccountingPeriod(accountingPeriod);
        const previousPeriodClosed = accountingPeriodLocks.some(
          (record) => record.accountingPeriod === previousPeriod && record.status === '已结账'
        );
        const alreadyClosed = accountingPeriodLocks.some(
          (record) => record.accountingPeriod === accountingPeriod && record.status === '已结账'
        );
        const checksPassed = Boolean(
          closeCheckSnapshot?.length && closeCheckSnapshot.every((item) => item.status === '通过')
        );
        const summaryPassed = Boolean(
          closeSummarySnapshot &&
          closeSummarySnapshot.blockedCheckCount === 0 &&
          closeSummarySnapshot.trialBalanceStatus === '平衡' &&
          closeSummarySnapshot.trialBalanceDifference === 0
        );
        const continuityPassed = Boolean(
          enabledPeriod && (accountingPeriod === enabledPeriod || previousPeriodClosed)
        );

        if (!reason.trim() || alreadyClosed || !checksPassed || !summaryPassed || !continuityPassed) {
          return false;
        }

        setAccountingPeriodLocks((currentRows) => {
          const nextRecord: AccountingPeriodLockRecord = {
            accountingPeriod,
            closeCheckSnapshot,
            closeSummarySnapshot,
            lockedAt: `${financeToday} 18:00`,
            lockedBy: currentFinanceActor,
            reason,
            status: '已结账'
          };

          return applyAccountingPeriodCloseLock(currentRows, nextRecord);
        });
        return true;
      },
      reopenAccountingPeriod(accountingPeriod, reason) {
        const currentLock = accountingPeriodLocks.find(
          (record) => record.accountingPeriod === accountingPeriod && record.status === '已结账'
        );

        if (!currentLock || !reason.trim()) {
          return false;
        }

        setAccountingPeriodLocks((currentRows) =>
          reopenAccountingPeriodLock(currentRows, accountingPeriod, {
            reason: reason.trim(),
            reopenedAt: `${financeToday} 18:30`,
            reopenedBy: currentFinanceActor
          })
        );
        return true;
      },
      addTransactionVoucherFile(transactionId, file) {
        const transactionToUpdate = financeRows.find((record) => record.id === transactionId);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, transactionToUpdate?.accountingPeriod, '补充流水凭证').allowed) {
          return false;
        }

        setFinanceRows((current) =>
          current.map((record) =>
            record.id === transactionId
              ? {
                  ...record,
                  files: [...record.files, { ...file, status: '已上传', updatedAt: financeToday }],
                  updatedAt: `${financeToday} 10:30`,
                  voucherStatus: '已上传',
                  operationRecords: [
                    ...record.operationRecords,
                    {
                      id: `fin-op-voucher-${Date.now()}`,
                      time: `${financeToday} 10:30`,
                      actor: '李明',
                      object: record.transactionNo,
                      action: '补充凭证',
                      summary: `补充凭证：${file.name}`
                    }
                  ]
                }
              : record
          )
        );
        return true;
      },
      removeTransactionVoucherFile(transactionId, fileId) {
        const transactionToUpdate = financeRows.find((record) => record.id === transactionId);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, transactionToUpdate?.accountingPeriod, '移除流水凭证').allowed) {
          return false;
        }

        setFinanceRows((current) =>
          current.map((record) => {
            if (record.id !== transactionId) {
              return record;
            }

            const nextFiles = record.files.filter((file) => file.id !== fileId);
            return {
              ...record,
              files: nextFiles,
              updatedAt: `${financeToday} 10:35`,
              voucherStatus: nextFiles.length > 0 ? '已上传' : '待补充',
              operationRecords: [
                ...record.operationRecords,
                {
                  id: `fin-op-voucher-remove-${Date.now()}`,
                  time: `${financeToday} 10:35`,
                  actor: '李明',
                  object: record.transactionNo,
                  action: '移除凭证',
                  summary: '复核前移除凭证文件'
                }
              ]
            };
          })
        );
        return true;
      },
      revokeBankReconciliation(transactionId, bankSerialNo, reason) {
        const transactionToRevoke = financeRows.find((record) => record.id === transactionId);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, transactionToRevoke?.accountingPeriod, '撤销银行对账').allowed) {
          return false;
        }

        setBankReconciliationRows((currentRows) =>
          currentRows
            .map((record) => ({
              ...record,
              linkedTransactions: record.linkedTransactions.filter(
                (linkedTransaction) =>
                  linkedTransaction.financeTransactionId !== transactionId &&
                  linkedTransaction.financeTransactionNo !== transactionToRevoke?.transactionNo
              )
            }))
            .filter((record) => record.linkedTransactions.length > 0)
        );
        setFinanceRows((current) =>
          current.map((record) =>
            record.id === transactionId
              ? {
                  ...record,
                  reconciliationStatus: '未对账',
                  reconciledAt: undefined,
                  updatedAt: `${financeToday} 16:40`,
                  operationRecords: [
                    ...record.operationRecords,
                    {
                      id: `fin-op-bank-revoke-${Date.now()}`,
                      time: `${financeToday} 16:40`,
                      actor: '李明',
                      object: record.transactionNo,
                      action: '撤销对账',
                      summary: `撤销银行流水 ${bankSerialNo} 与系统流水 ${record.transactionNo} 的对账关系；状态 已对账 -> 未对账；原因：${reason}`
                    }
                  ]
                }
              : record
          )
        );
        return true;
      },
      returnFinanceTransaction(transactionId) {
        const transactionToReturn = financeRows.find((record) => record.id === transactionId);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, transactionToReturn?.accountingPeriod, '退回流水复核').allowed) {
          return false;
        }

        setFinanceRows((current) =>
          current.map((record) =>
            record.id === transactionId
              ? {
                  ...record,
                  status: '退回修改',
                  reviewedBy: '财务复核',
                  reviewedAt: `${financeToday} 15:30`,
                  updatedAt: `${financeToday} 15:30`,
                  operationRecords: [
                    ...record.operationRecords,
                    {
                      id: `fin-op-return-${Date.now()}`,
                      time: `${financeToday} 15:30`,
                      actor: '财务复核',
                      object: record.transactionNo,
                      action: '退回修改',
                      summary: '复核未通过，退回流水登记侧修改'
                    }
                  ]
                }
              : record
          )
        );
        return true;
      },
      reviewFinanceTransaction(transactionId) {
        const transactionToReview = financeRows.find((record) => record.id === transactionId);
        const transactionPeriodGuard = guardAccountingPeriodOpen(
          accountingPeriodLocks,
          transactionToReview?.accountingPeriod,
          '复核流水入账'
        );

        if (!transactionPeriodGuard.allowed) {
          return {
            message: transactionPeriodGuard.reason ?? '当前会计期间已锁定',
            success: false
          };
        }

        const lockedSettlementTarget = getFinanceReceivablePayableSettlementTargets(
          receivablePayableRows,
          transactionToReview,
          financeRows
        ).find((record) => !guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '复核流水入账').allowed);

        if (lockedSettlementTarget) {
          return { message: `${lockedSettlementTarget.accountingPeriod} 已结账，不能复核关联流水`, success: false };
        }

        const result = commitFinanceTransactionReview(
          { financeRows, receivablePayableRows: derivedReceivablePayableRows },
          {
            operationId: `fin-op-review-${Date.now()}`,
            reviewedAt: `${financeToday} 15:30`,
            reviewer: '财务复核',
            transactionId
          }
        );

        if (result.success) {
          const correctionResult = commitPayrollIitCorrectionAfterPostedReversal(
            {
              declarationPreparationRows: effectiveDeclarationPreparationRows,
              financeRows: result.financeRows,
              receivablePayableRows: result.receivablePayableRows,
              salaryPaymentRecords,
              taxMatterRows: effectiveTaxMatterRows
            },
            {
              actor: '财务复核',
              occurredAt: `${financeToday} 15:30`,
              transactionId
            }
          );

          if (!correctionResult.success) {
            return { message: correctionResult.message, success: false };
          }

          const reviewedTransaction = correctionResult.financeRows.find((record) => record.id === transactionId);
          const reversedOriginTransaction = reviewedTransaction?.adjustmentContext?.originTransactionNo
            ? correctionResult.financeRows.find(
                (record) => record.transactionNo === reviewedTransaction.adjustmentContext?.originTransactionNo
              )
            : undefined;

          if (
            reviewedTransaction?.adjustmentContext?.mode === '冲正'
            && reversedOriginTransaction?.sourceType === '薪酬发放'
          ) {
            const salaryReversal = reverseSalaryPayment(
              reversedOriginTransaction.transactionNo,
              `${financeToday} 15:30`,
              '财务复核'
            );

            if (!salaryReversal.success) {
              return { message: salaryReversal.reason ?? '工资冲正未能同步薪酬状态', success: false };
            }
          }

          setFinanceRows(correctionResult.financeRows);
          setReceivablePayableRows(correctionResult.receivablePayableRows);
          setDeclarationPreparationRows(correctionResult.declarationPreparationRows);
          setTaxMatterRows(correctionResult.taxMatterRows);
        }

        return result;
      },
      updateFinanceTransactionsByNo(transactionNos, updater) {
        const transactionNoSet = new Set(transactionNos);
        const recordsToUpdate = financeRows.filter((record) => transactionNoSet.has(record.transactionNo));
        const nextRecordsByNo = new Map<string, FinanceTransactionRecord>();

        if (recordsToUpdate.length !== transactionNoSet.size) {
          return false;
        }

        for (const record of recordsToUpdate) {
          if (!guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '修改流水').allowed) {
            return false;
          }

          const nextRecord = updater(record);

          if (!guardAccountingPeriodOpen(accountingPeriodLocks, nextRecord.accountingPeriod, '修改流水').allowed) {
            return false;
          }

          nextRecordsByNo.set(record.transactionNo, nextRecord);
        }

        setFinanceRows((current) =>
          current.map((record) => nextRecordsByNo.get(record.transactionNo) ?? record)
        );
        return true;
      },
      updateReceivablePayableRecord(recordId, updater) {
        const currentRecord = receivablePayableRows.find((record) => record.id === recordId);

        if (!currentRecord) {
          return false;
        }

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, currentRecord.accountingPeriod, '调整应收应付事项').allowed) {
          return false;
        }

        if (hasFinanceReceivablePayableBookedVoucher(currentRecord, accountingVoucherLifecycleRows)) {
          return false;
        }

        const nextRecord = updater(currentRecord);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, nextRecord.accountingPeriod, '调整应收应付事项').allowed) {
          return false;
        }

        setReceivablePayableRows((currentRows) =>
          currentRows.map((record) => (record.id === recordId ? nextRecord : record))
        );
        return true;
      },
      replaceInvoiceBusinessAssociations(invoiceId, nextDrafts) {
        const invoice = invoiceRows.find((currentInvoice) => currentInvoice.id === invoiceId);

        if (!invoice || invoice.invoiceStatus !== '正常') {
          return false;
        }

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, invoice.accountingPeriod, '调整发票关联').allowed) {
          return false;
        }

        const nextTotal = nextDrafts.reduce((total, draft) => total + Number(draft.amount.toFixed(2)), 0);

        if (
          nextDrafts.some((draft) => !Number.isFinite(draft.amount) || draft.amount <= 0.01) ||
          nextTotal - invoice.taxIncludedAmount > 0.01
        ) {
          return false;
        }

        const currentAllocations = invoiceBusinessAllocationRows.filter(
          (allocation) => allocation.invoiceId === invoice.id && allocation.status === '有效'
        );
        const affectedReceivablePayableIds = new Set([
          ...currentAllocations
            .filter((allocation) => allocation.targetType === '应收应付')
            .map((allocation) => allocation.targetId),
          ...nextDrafts
            .filter((draft) => draft.targetType === '应收应付')
            .map((draft) => draft.targetId)
        ]);

        for (const targetId of affectedReceivablePayableIds) {
          const target = receivablePayableRows.find((record) => record.id === targetId);

          if (
            !target ||
            !guardAccountingPeriodOpen(accountingPeriodLocks, target.accountingPeriod, '调整发票关联').allowed ||
            hasFinanceReceivablePayableBookedVoucher(target, accountingVoucherLifecycleRows)
          ) {
            return false;
          }
        }

        for (const draft of nextDrafts) {
          if (draft.targetType === '应收应付') {
            const target = receivablePayableRows.find((record) => record.id === draft.targetId);

            if (
              !target ||
              !guardAccountingPeriodOpen(accountingPeriodLocks, target.accountingPeriod, '调整发票关联').allowed ||
              hasFinanceReceivablePayableBookedVoucher(target, accountingVoucherLifecycleRows) ||
              !getInvoiceAssociationMatchBasis(invoice, target, invoiceBusinessAllocationRows)
            ) {
              return false;
            }

            const otherAllocatedAmount = getInvoiceBusinessAssociationAllocatedAmount(target, invoiceRows, invoiceBusinessAllocationRows, {
              excludeInvoiceId: invoice.id
            });
            const nextTargetAmount = nextDrafts
              .filter((currentDraft) => currentDraft.targetType === '应收应付' && currentDraft.targetId === target.id)
              .reduce((total, currentDraft) => total + currentDraft.amount, 0);

            if (otherAllocatedAmount + nextTargetAmount - target.amount > 0.01) {
              return false;
            }
          }

        }

        const occurredAt = `${financeToday} 17:20`;
        setInvoiceBusinessAllocationRows((currentRows) => [
          ...currentRows.map((allocation) =>
            allocation.invoiceId === invoice.id && allocation.status === '有效'
              ? {
                  ...allocation,
                  reversedAt: occurredAt,
                  reversedBy: currentFinanceActor,
                  reversalReason: '重新关联业务事项',
                  status: '已撤销' as const
                }
              : allocation
          ),
          ...buildInvoiceBusinessAllocations(invoice, nextDrafts, {
            actor: currentFinanceActor,
            occurredAt,
            sequence: currentRows.length + 1
          })
        ]);
        return true;
      },
      replaceBusinessInvoiceAssociations(businessRecordId, nextDrafts) {
        const businessRecord = receivablePayableRows.find((record) => record.id === businessRecordId);

        if (
          !businessRecord ||
          !guardAccountingPeriodOpen(accountingPeriodLocks, businessRecord.accountingPeriod, '调整发票关联').allowed ||
          hasFinanceReceivablePayableBookedVoucher(businessRecord, accountingVoucherLifecycleRows)
        ) {
          return false;
        }

        const draftAmountByInvoiceId = new Map(nextDrafts.map((draft) => [draft.invoiceId, Number(draft.amount.toFixed(2))]));
        const totalAmount = Array.from(draftAmountByInvoiceId.values()).reduce((total, amount) => total + amount, 0);

        if (
          Array.from(draftAmountByInvoiceId.values()).some((amount) => !Number.isFinite(amount) || amount <= 0.01) ||
          totalAmount - businessRecord.amount > 0.01
        ) {
          return false;
        }

        const currentlyLinkedInvoiceIds = invoiceBusinessAllocationRows
          .filter((allocation) => allocation.status === '有效' && doesInvoiceAllocationMatchReceivablePayable(allocation, businessRecord))
          .map((allocation) => allocation.invoiceId);
        const affectedInvoiceIds = new Set([...currentlyLinkedInvoiceIds, ...draftAmountByInvoiceId.keys()]);

        for (const invoiceId of affectedInvoiceIds) {
          const invoice = invoiceRows.find((currentInvoice) => currentInvoice.id === invoiceId);
          const draftAmount = draftAmountByInvoiceId.get(invoiceId) ?? 0;

          if (
              !invoice ||
              invoice.invoiceStatus !== '正常' ||
              !guardAccountingPeriodOpen(accountingPeriodLocks, invoice.accountingPeriod, '调整发票关联').allowed ||
              (draftAmount > 0.01 && !getInvoiceAssociationMatchBasis(invoice, businessRecord, invoiceBusinessAllocationRows))
            ) {
              return false;
            }

          const otherReferenceAmount = invoiceBusinessAllocationRows
            .filter((allocation) => allocation.invoiceId === invoice.id && allocation.status === '有效')
            .filter((allocation) => !doesInvoiceAllocationMatchReceivablePayable(allocation, businessRecord))
            .reduce((total, allocation) => total + Math.max(0, allocation.taxIncludedAmount), 0);

          if (otherReferenceAmount + draftAmount - invoice.taxIncludedAmount > 0.01) {
            return false;
          }
        }

        const occurredAt = `${financeToday} 17:21`;
        setInvoiceBusinessAllocationRows((currentRows) => {
          const nextRows = currentRows.map((allocation) =>
            allocation.status === '有效' && doesInvoiceAllocationMatchReceivablePayable(allocation, businessRecord)
              ? {
                  ...allocation,
                  reversedAt: occurredAt,
                  reversedBy: currentFinanceActor,
                  reversalReason: '从应收应付重新关联发票',
                  status: '已撤销' as const
                }
              : allocation
          );
          const appendedRows = Array.from(draftAmountByInvoiceId.entries()).flatMap(([invoiceId, amount], index) => {
            if (amount <= 0.01) {
              return [];
            }

            const targetInvoice = invoiceRows.find((invoice) => invoice.id === invoiceId);
            const draft = nextDrafts.find((currentDraft) => currentDraft.invoiceId === invoiceId);

            return targetInvoice && draft ? buildInvoiceBusinessAllocations(targetInvoice, [{
              amount,
              matchBasis: draft.matchBasis,
              targetId: businessRecord.id,
              targetNo: businessRecord.documentNo,
              targetTitle: businessRecord.sourceTitle,
              targetType: '应收应付'
            }], {
              actor: currentFinanceActor,
              occurredAt,
              sequence: currentRows.length + index + 1
            }) : [];
          });

          return [...nextRows, ...appendedRows];
        });
        return true;
      },
      linkRedInvoiceOriginal(invoiceId, originalInvoiceId) {
        const redInvoice = invoiceRows.find((invoice) => invoice.id === invoiceId);
        const originalInvoice = invoiceRows.find((invoice) => invoice.id === originalInvoiceId);

        if (
          !redInvoice ||
          !originalInvoice ||
          redInvoice.invoiceStatus !== '红冲' ||
          originalInvoice.invoiceStatus !== '正常' ||
          redInvoice.direction !== originalInvoice.direction ||
          redInvoice.counterparty !== originalInvoice.counterparty ||
          originalInvoice.invoiceDate > redInvoice.invoiceDate ||
          !guardAccountingPeriodOpen(accountingPeriodLocks, redInvoice.accountingPeriod, '确认红冲原票关联').allowed ||
          accountingVoucherLifecycleRows.some((row) => row.voucherId === `voucher-invoice-${redInvoice.id}` && row.status === '已记账')
        ) {
          return false;
        }

        if (buildOriginalInvoiceRedSummary(originalInvoice, invoiceRows, redInvoice).isOverLimit) {
          return false;
        }

        const redAllocations = buildRedInvoiceBusinessAllocations(redInvoice, originalInvoice, invoiceBusinessAllocationRows, {
          actor: currentFinanceActor,
          occurredAt: `${financeToday} 17:22`,
          sequence: invoiceBusinessAllocationRows.length + 1
        });

        if (Math.abs(redAllocations.reduce((total, allocation) => total + allocation.taxIncludedAmount, 0)) + 0.01 < Math.abs(redInvoice.taxIncludedAmount)) {
          return false;
        }

        setInvoiceRows((currentRows) =>
          currentRows.map((invoice) =>
            invoice.id === redInvoice.id
              ? {
                  ...invoice,
                  originalInvoiceId: originalInvoice.id
                }
              : invoice
          )
        );
        setInvoiceBusinessAllocationRows((currentRows) => [
          ...currentRows.map((allocation) =>
            allocation.invoiceId === redInvoice.id && allocation.status === '有效'
              ? {
                  ...allocation,
                  reversedAt: `${financeToday} 17:22`,
                  reversedBy: currentFinanceActor,
                  reversalReason: '重新关联红字原票',
                  status: '已撤销' as const
                }
              : allocation
          ),
          ...redAllocations
        ]);
        return true;
      },
      updateDeclarationPreparationRecord(recordId, updater) {
        const currentRecord = effectiveDeclarationPreparationRows.find((record) => record.id === recordId);

        if (!currentRecord) {
          return false;
        }

        const nextRecord = updater(currentRecord);

        setDeclarationPreparationRows((currentRows) =>
          currentRows.some((record) => record.id === recordId)
            ? currentRows.map((record) => (record.id === recordId ? nextRecord : record))
            : [nextRecord, ...currentRows]
        );
        return true;
      },
      updateTaxMatterRecord(recordId, updater) {
        const currentRecord = effectiveTaxMatterRows.find((record) => record.id === recordId);

        if (!currentRecord) {
          return false;
        }

        const nextRecord = updater(currentRecord);

        setTaxMatterRows((currentRows) =>
          currentRows.some((record) => record.id === recordId)
            ? currentRows.map((record) => (record.id === recordId ? nextRecord : record))
            : [nextRecord, ...currentRows]
        );
        return true;
      },
      updateMonthEndMatterRecord(recordId, updater) {
        const currentRecord = monthEndMatterRows.find((record) => record.id === recordId);

        if (!currentRecord || !guardAccountingPeriodOpen(accountingPeriodLocks, currentRecord.accountingPeriod, '确认月末事项').allowed) {
          return false;
        }

        const nextRecord = updater(currentRecord);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, nextRecord.accountingPeriod, '确认月末事项').allowed) {
          return false;
        }

        setMonthEndMatterRows((currentRows) =>
          currentRows.map((record) => (record.id === recordId ? nextRecord : record))
        );
        return true;
      },
      bookAccountingVoucher(record) {
        if (!canBookAccountingVoucher(record, accountingPeriodLocks)) {
          return false;
        }

        if (record.sourceModule === '账套初始化') {
          setLedgerOpeningAdjustmentRows((currentRows) =>
            currentRows.map((currentRecord) =>
              currentRecord.voucherNo === record.sourceNo
                ? {
                    ...currentRecord,
                    status: '已记账'
                  }
                : currentRecord
            )
          );
        }

        if (record.sourceType === '后续调整') {
          const adjustmentRecord = accountingVoucherLaterPeriodAdjustmentRows.find(
            (currentRecord) => currentRecord.adjustmentNo === record.sourceNo
          );

          setAccountingVoucherLaterPeriodAdjustmentRows((currentRows) =>
            currentRows.map((currentRecord) =>
              currentRecord.adjustmentNo === record.sourceNo
                ? {
                    ...currentRecord,
                    candidateStatus: '已记账'
                  }
                : currentRecord
            )
          );

          if (adjustmentRecord?.correctionContext && adjustmentRecord.adjustmentMode === '差额调整') {
            setReceivablePayableRows((currentRows) => currentRows.map((currentRecord) => {
              if (currentRecord.id !== adjustmentRecord.correctionContext?.recordId) {
                return currentRecord;
              }

              const existingCorrections = currentRecord.taskSettlementCorrections ?? [];
              if (existingCorrections.some((correction) => correction.issueId === adjustmentRecord.correctionContext?.issueId)) {
                return currentRecord;
              }

              return {
                ...currentRecord,
                operationRecords: [
                  ...currentRecord.operationRecords,
                  {
                    action: '记账差额调整',
                    actor: currentFinanceActor,
                    id: `op-${currentRecord.id}-${adjustmentRecord.id}`,
                    object: currentRecord.documentNo,
                    summary: `${adjustmentRecord.adjustmentNo} 调整 ${adjustmentRecord.signedAmount.toFixed(2)} 元`,
                    time: `${financeToday} 17:30`
                  }
                ],
                taskSettlementCorrections: [
                  ...existingCorrections,
                  {
                    accountingPeriod: adjustmentRecord.accountingPeriod,
                    adjustmentNo: adjustmentRecord.adjustmentNo,
                    bookedAt: `${financeToday} 17:30`,
                    differenceAmount: adjustmentRecord.signedAmount,
                    issueId: adjustmentRecord.correctionContext.issueId
                  }
                ],
                updatedAt: `${financeToday} 17:30`
              };
            }));
          }
        }

        if (record.sourceModule === '月末事项') {
          setMonthEndMatterRows((currentRows) =>
            currentRows.map((currentRecord) =>
              currentRecord.sourceNo === record.sourceNo
                ? markFinanceMonthEndMatterBooked(currentRecord, currentFinanceActor)
                : currentRecord
            )
          );
        }

        setAccountingVoucherLifecycleRows((currentRows) => {
          if (currentRows.some((row) => row.voucherId === record.id)) {
            return currentRows;
          }

          return [
            createAccountingVoucherLifecycleRecord(
              record,
              getNextAccountingVoucherNo(currentRows, record.accountingPeriod),
              currentFinanceActor,
              getAccountingVoucherLifecycleTime(record, '17:10')
            ),
            ...currentRows
          ];
        });
        return true;
      },
      reverseAccountingVoucher(record, reversalInput) {
        const existingTargetRow = accountingVoucherLifecycleRows.find((row) => row.voucherId === record.id && row.status === '已记账');

        if (
          !existingTargetRow ||
          !canReverseAccountingVoucher(existingTargetRow.snapshot, accountingPeriodLocks) ||
          validateAccountingVoucherReversal(existingTargetRow.snapshot, reversalInput, accountingPeriodLocks).length > 0
        ) {
          return false;
        }

        setAccountingVoucherLifecycleRows((currentRows) => {
          const targetRow = currentRows.find((row) => row.voucherId === record.id && row.status === '已记账');

          if (
            !targetRow ||
            !canReverseAccountingVoucher(targetRow.snapshot, accountingPeriodLocks) ||
            validateAccountingVoucherReversal(targetRow.snapshot, reversalInput, accountingPeriodLocks).length > 0
          ) {
            return currentRows;
          }

          const reversalReason = reversalInput.reason.trim();
          const reversedAt = reversalInput.reversedAt.includes(' ')
            ? reversalInput.reversedAt
            : `${reversalInput.reversedAt} 17:20`;
          const reversalVoucherNo = getNextAccountingVoucherNo(currentRows, targetRow.accountingPeriod);
          const reversalSnapshot = createReversalAccountingVoucherSnapshot({
            actor: currentFinanceActor,
            voucherNo: reversalVoucherNo,
            originalRecord: targetRow.snapshot,
            reason: reversalReason,
            reversedAt
          });
          const reversedSnapshot = createReversedAccountingVoucherSnapshot({
            record: targetRow.snapshot,
            reversedAt,
            reversedBy: currentFinanceActor,
            reversedByVoucherId: reversalSnapshot.id,
            reversalReason
          });

          return [
            {
              accountingPeriod: reversalSnapshot.accountingPeriod,
              bookedAt: reversalSnapshot.bookedAt ?? reversedAt,
              bookedBy: reversalSnapshot.bookedBy ?? currentFinanceActor,
              voucherNo: reversalSnapshot.voucherNo,
              snapshot: reversalSnapshot,
              status: '已记账' as const,
              voucherId: reversalSnapshot.id
            },
            ...currentRows.map((row) =>
              row.voucherId === targetRow.voucherId
                ? {
                    ...row,
                    reversedAt,
                    reversedBy: currentFinanceActor,
                    reversalReason,
                    snapshot: reversedSnapshot,
                    status: '已冲销' as const
                  }
                : row
            )
          ];
        });
        return true;
      },
      validateAccountingVoucherLaterPeriodAdjustment(record, input) {
        return canSubmitLaterPeriodAccountingVoucherAdjustment(
          record,
          input,
          accountingPeriodLocks,
          accountingVoucherLaterPeriodAdjustmentRows
        );
      },
      voidFinanceTransaction(transactionId) {
        const transactionToVoid = financeRows.find((record) => record.id === transactionId);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, transactionToVoid?.accountingPeriod, '作废流水').allowed) {
          return false;
        }

        setFinanceRows((current) =>
          current.map((record) =>
            record.id === transactionId
              ? {
                  ...record,
                  reconciliationStatus: '未对账',
                  status: '已作废',
                  updatedAt: `${financeToday} 15:30`,
                  operationRecords: [
                    ...record.operationRecords,
                    {
                      id: `fin-op-void-${Date.now()}`,
                      time: `${financeToday} 15:30`,
                      actor: '财务复核',
                      object: record.transactionNo,
                      action: '作废流水',
                      summary: '复核前作废'
                    }
                  ]
                }
              : record
          )
        );
        return true;
      },
      bankReconciliationRows,
      customerTaskSettlementIssues,
      declarationPreparationRows: effectiveDeclarationPreparationRows,
      financeRows,
      manualStampDutySourceRows,
      stampDutySourceResolutionRows,
      invoiceRows,
      receivablePayableRows: derivedReceivablePayableRows,
      taxMatterRows: effectiveTaxMatterRows
    }),
    [
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingPeriodLocks,
      accountingVoucherLifecycleRows,
      accountingVoucherRows,
      bankReconciliationRows,
      effectiveDeclarationPreparationRows,
      effectiveTaxMatterRows,
      enabledProfile,
      financeRows,
      invoiceBusinessAllocationRows,
      invoiceImportBatches,
      invoiceRows,
      ledgerOpeningAdjustmentRows,
      monthEndMatterRows,
      manualStampDutySourceRows,
      stampDutySourceResolutionRows,
      derivedReceivablePayableRows,
      receivablePayableRows,
      salaryAdjustments,
      salaryPaymentRecords,
      isSalaryAdjustmentPeriodOpen,
      reverseSalaryPayment,
      saveSalaryAdjustment,
      voidSalaryAdjustment,
      taxMatterRows
    ]
  );

  return <FinanceManagementContext.Provider value={value}>{children}</FinanceManagementContext.Provider>;
}

export function useFinanceManagement() {
  const context = useContext(FinanceManagementContext);

  if (!context) {
    throw new Error('useFinanceManagement must be used within FinanceManagementProvider');
  }

  return context;
}
