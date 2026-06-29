import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  getNextAccountingVoucherFormalNo,
  type AccountingPeriodLockRecord,
  type AccountingVoucherLifecycleRecord,
  type AccountingVoucherRecord
} from './financeAccountingVoucherModel';
import { financeTransactionRecords, type FinanceTransactionRecord } from './financeData';
import {
  financeDeclarationPreparationRecords,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import { financeInvoiceRecords, type FinanceInvoiceRecord } from './financeInvoiceData';
import {
  financeReceivablePayableRecords,
  type FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import { applyFinanceReceivablePayableSettlementReview } from './financeReceivablesPayablesModel';
import {
  financeTaxMatterRecords,
  type FinanceTaxMatterRecord
} from './financeTaxFilingData';
import { financeToday } from './financeUtils';

type FinanceManagementStateValue = {
  addFinanceTransaction: (record: FinanceTransactionRecord) => void;
  addTransactionVoucherFile: (transactionId: string, file: RelatedFileRecord) => void;
  accountingPeriodLocks: AccountingPeriodLockRecord[];
  accountingVoucherLifecycleRows: AccountingVoucherLifecycleRecord[];
  confirmBankReconciliation: (transactionId: string, bankSerialNo: string) => void;
  financeRows: FinanceTransactionRecord[];
  clearInvoiceMatches: (invoiceId: string) => void;
  declarationPreparationRows: FinanceDeclarationPreparationRecord[];
  invoiceRows: FinanceInvoiceRecord[];
  receivablePayableRows: FinanceReceivablePayableRecord[];
  taxMatterRows: FinanceTaxMatterRecord[];
  removeTransactionVoucherFile: (transactionId: string, fileId: string) => void;
  revokeBankReconciliation: (transactionId: string, bankSerialNo: string, reason: string) => void;
  returnFinanceTransaction: (transactionId: string) => void;
  reviewFinanceTransaction: (transactionId: string) => void;
  updateFinanceTransactionsByNo: (
    transactionNos: string[],
    updater: (record: FinanceTransactionRecord) => FinanceTransactionRecord
  ) => void;
  updateReceivablePayableRecord: (
    recordId: string,
    updater: (record: FinanceReceivablePayableRecord) => FinanceReceivablePayableRecord
  ) => void;
  updateInvoiceRecord: (invoiceId: string, updater: (invoice: FinanceInvoiceRecord) => FinanceInvoiceRecord) => void;
  updateDeclarationPreparationRecord: (
    recordId: string,
    updater: (record: FinanceDeclarationPreparationRecord) => FinanceDeclarationPreparationRecord
  ) => void;
  updateTaxMatterRecord: (
    recordId: string,
    updater: (record: FinanceTaxMatterRecord) => FinanceTaxMatterRecord
  ) => void;
  prepareAccountingVoucher: (record: AccountingVoucherRecord) => void;
  postAccountingVoucher: (record: AccountingVoucherRecord) => void;
  reverseAccountingVoucher: (record: AccountingVoucherRecord, reason: string) => void;
  voidFinanceTransaction: (transactionId: string) => void;
};

const FinanceManagementContext = createContext<FinanceManagementStateValue | undefined>(undefined);

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
  const [accountingVoucherLifecycleRows, setAccountingVoucherLifecycleRows] = useState<AccountingVoucherLifecycleRecord[]>([]);
  const [accountingPeriodLocks] = useState<AccountingPeriodLockRecord[]>([]);

  const value = useMemo<FinanceManagementStateValue>(
    () => ({
      accountingPeriodLocks,
      accountingVoucherLifecycleRows,
      addFinanceTransaction(record) {
        setFinanceRows((current) => [record, ...current]);
      },
      confirmBankReconciliation(transactionId, bankSerialNo) {
        setFinanceRows((current) =>
          current.map((record) =>
            record.id === transactionId
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
                      summary: `确认银行流水 ${bankSerialNo} 与系统流水 ${record.transactionNo} 对账；状态 未对账 -> 已对账`
                    }
                  ]
                }
              : record
          )
        );
      },
      clearInvoiceMatches(invoiceId) {
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
      },
      addTransactionVoucherFile(transactionId, file) {
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
      },
      removeTransactionVoucherFile(transactionId, fileId) {
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
      },
      revokeBankReconciliation(transactionId, bankSerialNo, reason) {
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
      },
      returnFinanceTransaction(transactionId) {
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
      },
      reviewFinanceTransaction(transactionId) {
        const transactionToReview = financeRows.find((record) => record.id === transactionId);

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
      },
      updateFinanceTransactionsByNo(transactionNos, updater) {
        const transactionNoSet = new Set(transactionNos);

        setFinanceRows((current) =>
          current.map((record) => (transactionNoSet.has(record.transactionNo) ? updater(record) : record))
        );
      },
      updateReceivablePayableRecord(recordId, updater) {
        setReceivablePayableRows((currentRows) =>
          currentRows.map((record) => (record.id === recordId ? updater(record) : record))
        );
      },
      updateInvoiceRecord(invoiceId, updater) {
        setInvoiceRows((currentRows) => currentRows.map((invoice) => (invoice.id === invoiceId ? updater(invoice) : invoice)));
      },
      updateDeclarationPreparationRecord(recordId, updater) {
        setDeclarationPreparationRows((currentRows) =>
          currentRows.map((record) => (record.id === recordId ? updater(record) : record))
        );
      },
      updateTaxMatterRecord(recordId, updater) {
        setTaxMatterRows((currentRows) =>
          currentRows.map((record) => (record.id === recordId ? updater(record) : record))
        );
      },
      prepareAccountingVoucher(record) {
        setAccountingVoucherLifecycleRows((currentRows) => {
          if (currentRows.some((row) => row.voucherId === record.id)) {
            return currentRows;
          }

          return [
            {
              accountingPeriod: record.accountingPeriod,
              formalVoucherNo: getNextAccountingVoucherFormalNo(currentRows, record.accountingPeriod),
              preparedAt: `${financeToday} 17:00`,
              preparedBy: '李明',
              status: '已制单',
              voucherId: record.id
            },
            ...currentRows
          ];
        });
      },
      postAccountingVoucher(record) {
        setAccountingVoucherLifecycleRows((currentRows) =>
          currentRows.map((row) =>
            row.voucherId === record.id && row.status === '已制单'
              ? {
                  ...row,
                  postedAt: `${financeToday} 17:10`,
                  postedBy: '李明',
                  status: '已入账'
                }
              : row
          )
        );
      },
      reverseAccountingVoucher(record, reason) {
        setAccountingVoucherLifecycleRows((currentRows) =>
          currentRows.map((row) =>
            row.voucherId === record.id && row.status === '已入账'
              ? {
                  ...row,
                  reversedAt: `${financeToday} 17:20`,
                  reversedBy: '李明',
                  reversalReason: reason,
                  status: '已冲销'
                }
              : row
          )
        );
      },
      voidFinanceTransaction(transactionId) {
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
      },
      declarationPreparationRows,
      financeRows,
      invoiceRows,
      receivablePayableRows,
      taxMatterRows
    }),
    [
      accountingPeriodLocks,
      accountingVoucherLifecycleRows,
      declarationPreparationRows,
      financeRows,
      invoiceRows,
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
