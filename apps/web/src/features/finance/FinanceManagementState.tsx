import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  applyAccountingVoucherLifecycle,
  applyAccountingPeriodCloseLock,
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
  validateAccountingVoucherReversal,
  type AccountingPeriodLockRecord,
  type AccountingPeriodOpenGuard,
  type AccountingVoucherLaterPeriodAdjustmentInput,
  type AccountingVoucherLaterPeriodAdjustmentRecord,
  type AccountingVoucherLifecycleRecord,
  type AccountingVoucherRecord,
  type AccountingVoucherReversalInput,
  buildAccountingLedgerEntries,
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
  financeDeclarationPreparationRecords,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import { financeInvoiceRecords, type FinanceInvoiceRecord } from './financeInvoiceData';
import { getInvoiceMatchedReceivablePayableTargets } from './financeInvoiceMatchingModel';
import { getRedInvoiceOriginalAssociationAffectedInvoices } from './financeInvoiceModel';
import {
  financeReceivablePayableRecords,
  type FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import {
  applyFinanceReceivablePayableSettlementReview,
  getFinanceReceivablePayableSettlementTargets
} from './financeReceivablesPayablesModel';
import {
  financeTaxMatterRecords,
  type FinanceTaxMatterRecord
} from './financeTaxFilingData';
import {
  buildFinancePeriodCloseRecords,
  createFinancePeriodCloseSummarySnapshot
} from './financePeriodCloseModel';
import type { LedgerOpeningAdjustmentVoucherRecord } from './financeLedgerInitializationModel';
import { financeToday, getAccountingPeriodFromBusinessPeriod } from './financeUtils';

type FinanceManagementStateValue = {
  addAccountingVoucherLaterPeriodAdjustment: (record: AccountingVoucherLaterPeriodAdjustmentRecord) => boolean;
  addFinanceTransaction: (record: FinanceTransactionRecord) => boolean;
  addInvoiceRecords: (records: FinanceInvoiceRecord[]) => boolean;
  addLedgerOpeningAdjustmentVoucher: (record: LedgerOpeningAdjustmentVoucherRecord) => boolean;
  addSourceGeneratedReceivablePayableRecord: (record: FinanceReceivablePayableRecord) => boolean;
  addTransactionVoucherFile: (transactionId: string, file: RelatedFileRecord) => boolean;
  accountingPeriodLocks: AccountingPeriodLockRecord[];
  accountingVoucherLaterPeriodAdjustmentRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  accountingVoucherLifecycleRows: AccountingVoucherLifecycleRecord[];
  bankReconciliationRows: FinanceBankReconciliationLinkRecord[];
  confirmBankReconciliation: (bankRecord: BankStatementRecord, transactions: FinanceTransactionRecord[]) => boolean;
  financeRows: FinanceTransactionRecord[];
  getAccountingPeriodGuard: (accountingPeriod: string | undefined, actionLabel?: string) => AccountingPeriodOpenGuard;
  isAccountingPeriodClosed: (accountingPeriod: string | undefined) => boolean;
  clearInvoiceMatches: (invoiceId: string) => boolean;
  closeAccountingPeriod: (
    accountingPeriod: string,
    reason?: string,
    closeCheckSnapshot?: AccountingPeriodCloseCheckSnapshotItem[],
    closeSummarySnapshot?: AccountingPeriodCloseSummarySnapshot
  ) => void;
  declarationPreparationRows: FinanceDeclarationPreparationRecord[];
  invoiceRows: FinanceInvoiceRecord[];
  ledgerOpeningAdjustmentRows: LedgerOpeningAdjustmentVoucherRecord[];
  receivablePayableRows: FinanceReceivablePayableRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
  removeTransactionVoucherFile: (transactionId: string, fileId: string) => boolean;
  revokeBankReconciliation: (transactionId: string, bankSerialNo: string, reason: string) => boolean;
  returnFinanceTransaction: (transactionId: string) => boolean;
  reviewFinanceTransaction: (transactionId: string) => boolean;
  updateFinanceTransactionsByNo: (
    transactionNos: string[],
    updater: (record: FinanceTransactionRecord) => FinanceTransactionRecord
  ) => boolean;
  updateReceivablePayableRecord: (
    recordId: string,
    updater: (record: FinanceReceivablePayableRecord) => FinanceReceivablePayableRecord
  ) => boolean;
  updateInvoiceRecord: (invoiceId: string, updater: (invoice: FinanceInvoiceRecord) => FinanceInvoiceRecord) => boolean;
  updateDeclarationPreparationRecord: (
    recordId: string,
    updater: (record: FinanceDeclarationPreparationRecord) => FinanceDeclarationPreparationRecord
  ) => boolean;
  updateTaxMatterRecord: (
    recordId: string,
    updater: (record: FinanceTaxMatterRecord) => FinanceTaxMatterRecord
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
const periodCloseDemoAccountingPeriod = '2026-04';
const reportDemoAccountingPeriods = new Set([periodCloseDemoAccountingPeriod, '2026-06']);
const seedBankReconciliationRows = buildSeedFinanceBankReconciliationLinks(financeTransactionRecords);

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
    seedBankReconciliationRows
  );

  return seedVoucherRows
    .filter((record) => reportDemoAccountingPeriods.has(record.accountingPeriod) && record.status === '待记账')
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

function createSeedAccountingPeriodLocks(lifecycleRows: AccountingVoucherLifecycleRecord[]): AccountingPeriodLockRecord[] {
  const seedVoucherRows = applyAccountingVoucherLifecycle(
    buildAccountingVouchers(
      financeReceivablePayableRecords,
      financeTransactionRecords,
      financeInvoiceRecords,
      financeTaxMatterRecords,
      seedBankReconciliationRows
    ),
    lifecycleRows
  );
  const seedLedgerEntries = buildAccountingLedgerEntries(seedVoucherRows);
  const periodCloseRecord = buildFinancePeriodCloseRecords({
    financeRows: financeTransactionRecords,
    ledgerEntries: seedLedgerEntries,
    periodLocks: [],
    taxMatterRows: financeTaxMatterRecords,
    voucherRows: seedVoucherRows
  }).find((record) => record.accountingPeriod === periodCloseDemoAccountingPeriod);

  if (!periodCloseRecord || !periodCloseRecord.canClose) {
    return [];
  }

  return [
    {
      accountingPeriod: periodCloseDemoAccountingPeriod,
      closeCheckSnapshot: periodCloseRecord.checkItems,
      closeSummarySnapshot: createFinancePeriodCloseSummarySnapshot(periodCloseRecord),
      lockedAt: '2026-04-30 18:00',
      lockedBy: currentFinanceActor,
      reason: '月度结账演示',
      status: '已结账'
    }
  ];
}

const seedAccountingVoucherLifecycleRows = createSeedAccountingVoucherLifecycleRows();
const seedAccountingPeriodLocks = createSeedAccountingPeriodLocks(seedAccountingVoucherLifecycleRows);

export function FinanceManagementProvider({ children }: { children: ReactNode }) {
  const [financeRows, setFinanceRows] = useState<FinanceTransactionRecord[]>(financeTransactionRecords);
  const [invoiceRows, setInvoiceRows] = useState<FinanceInvoiceRecord[]>(financeInvoiceRecords);
  const [receivablePayableRows, setReceivablePayableRows] = useState<FinanceReceivablePayableRecord[]>(
    financeReceivablePayableRecords
  );
  const [declarationPreparationRows, setDeclarationPreparationRows] = useState<FinanceDeclarationPreparationRecord[]>(
    financeDeclarationPreparationRecords
  );
  const [taxMatterRows, setTaxMatterRows] = useState<FinanceTaxMatterRecord[]>(financeTaxMatterRecords);
  const [ledgerOpeningAdjustmentRows, setLedgerOpeningAdjustmentRows] = useState<LedgerOpeningAdjustmentVoucherRecord[]>([]);
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

  const value = useMemo<FinanceManagementStateValue>(
    () => ({
      accountingPeriodLocks,
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingVoucherLifecycleRows,
      ledgerOpeningAdjustmentRows,
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
          adjustedAt: record.adjustedAt,
          reason: record.reason
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
                currentRecord.accountingPeriod === record.accountingPeriod
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

        setFinanceRows((current) => [record, ...current]);
        return true;
      },
      addInvoiceRecords(records) {
        const lockedRecord = records.find(
          (record) => !guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '导入税务发票数据').allowed
        );

        if (lockedRecord) {
          return false;
        }

        setInvoiceRows((currentRows) => [...records, ...currentRows]);
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
      clearInvoiceMatches(invoiceId) {
        const invoiceToClear = invoiceRows.find((invoice) => invoice.id === invoiceId);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, invoiceToClear?.accountingPeriod, '撤销发票匹配').allowed) {
          return false;
        }

        const lockedBusinessTarget = getInvoiceMatchedReceivablePayableTargets(invoiceToClear, receivablePayableRows).find(
          (record) => !guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '撤销发票匹配').allowed
        );

        if (lockedBusinessTarget) {
          return false;
        }

        setInvoiceRows((currentRows) =>
          currentRows.map((invoice) =>
            invoice.id === invoiceId
              ? {
                  ...invoice,
                  matchedBusinessRefs: []
                }
              : invoice
          )
        );
        return true;
      },
      closeAccountingPeriod(accountingPeriod, reason = '期间结账', closeCheckSnapshot, closeSummarySnapshot) {
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

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, transactionToReview?.accountingPeriod, '复核流水入账').allowed) {
          return false;
        }

        const lockedSettlementTarget = getFinanceReceivablePayableSettlementTargets(
          receivablePayableRows,
          transactionToReview
        ).find((record) => !guardAccountingPeriodOpen(accountingPeriodLocks, record.accountingPeriod, '复核流水入账').allowed);

        if (lockedSettlementTarget) {
          return false;
        }

        setFinanceRows((current) =>
          current.map((record) =>
            record.id === transactionId
              ? {
                  ...record,
                  status: '已入账' as const,
                  reviewedBy: '财务复核',
                  reviewedAt: `${financeToday} 15:30`,
                  updatedAt: `${financeToday} 15:30`,
                  operationRecords: [
                    ...record.operationRecords,
                    {
                      id: `fin-op-review-${Date.now()}`,
                      time: `${financeToday} 15:30`,
                      actor: '财务复核',
                      object: record.transactionNo,
                      action: '复核入账',
                      summary: '核对流水信息和凭证后入账'
                    }
                  ]
                }
              : record
          )
        );

        if (transactionToReview?.status === '待复核') {
          setReceivablePayableRows((currentRows) =>
            applyFinanceReceivablePayableSettlementReview(currentRows, transactionToReview)
          );
        }
        return true;
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

        const nextRecord = updater(currentRecord);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, nextRecord.accountingPeriod, '调整应收应付事项').allowed) {
          return false;
        }

        setReceivablePayableRows((currentRows) =>
          currentRows.map((record) => (record.id === recordId ? nextRecord : record))
        );
        return true;
      },
      updateInvoiceRecord(invoiceId, updater) {
        const invoiceToUpdate = invoiceRows.find((invoice) => invoice.id === invoiceId);

        if (!invoiceToUpdate) {
          return false;
        }

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, invoiceToUpdate.accountingPeriod, '调整发票匹配').allowed) {
          return false;
        }

        const nextInvoice = updater(invoiceToUpdate);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, nextInvoice.accountingPeriod, '调整发票匹配').allowed) {
          return false;
        }

        const lockedOriginalInvoice = getRedInvoiceOriginalAssociationAffectedInvoices(invoiceToUpdate, nextInvoice, invoiceRows).find(
          (invoice) => !guardAccountingPeriodOpen(accountingPeriodLocks, invoice.accountingPeriod, '调整红冲原票关联').allowed
        );

        if (lockedOriginalInvoice) {
          return false;
        }

        setInvoiceRows((currentRows) =>
          currentRows.map((invoice) => {
            return invoice.id === invoiceId ? nextInvoice : invoice;
          })
        );
        return true;
      },
      updateDeclarationPreparationRecord(recordId, updater) {
        const currentRecord = declarationPreparationRows.find((record) => record.id === recordId);

        if (!currentRecord) {
          return false;
        }

        const accountingPeriod = getAccountingPeriodFromBusinessPeriod(currentRecord.period);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, accountingPeriod, '调整申报准备').allowed) {
          return false;
        }

        const nextRecord = updater(currentRecord);
        const nextAccountingPeriod = getAccountingPeriodFromBusinessPeriod(nextRecord.period);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, nextAccountingPeriod, '调整申报准备').allowed) {
          return false;
        }

        setDeclarationPreparationRows((currentRows) =>
          currentRows.map((record) => (record.id === recordId ? nextRecord : record))
        );
        return true;
      },
      updateTaxMatterRecord(recordId, updater) {
        const currentRecord = taxMatterRows.find((record) => record.id === recordId);

        if (!currentRecord) {
          return false;
        }

        const accountingPeriod = getAccountingPeriodFromBusinessPeriod(currentRecord.period);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, accountingPeriod, '调整税务办理事项').allowed) {
          return false;
        }

        const nextRecord = updater(currentRecord);
        const nextAccountingPeriod = getAccountingPeriodFromBusinessPeriod(nextRecord.period);

        if (!guardAccountingPeriodOpen(accountingPeriodLocks, nextAccountingPeriod, '调整税务办理事项').allowed) {
          return false;
        }

        setTaxMatterRows((currentRows) =>
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
      declarationPreparationRows,
      financeRows,
      invoiceRows,
      receivablePayableRows,
      taxMatterRows
    }),
    [
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingPeriodLocks,
      accountingVoucherLifecycleRows,
      bankReconciliationRows,
      declarationPreparationRows,
      financeRows,
      invoiceRows,
      ledgerOpeningAdjustmentRows,
      receivablePayableRows,
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
