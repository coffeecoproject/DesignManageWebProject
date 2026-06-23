import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { financeTransactionRecords, type FinanceTransactionRecord } from './financeData';
import {
  financeDeclarationPreparationRecords,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import { financeInvoiceRecords, type FinanceInvoiceRecord } from './financeInvoiceData';
import { financeToday } from './financeUtils';

type FinanceManagementStateValue = {
  addFinanceTransaction: (record: FinanceTransactionRecord) => void;
  addTransactionVoucherFile: (transactionId: string, file: RelatedFileRecord) => void;
  collectPersonalAccountTransaction: (sourceTransactionId: string, record: FinanceTransactionRecord) => void;
  confirmBankReconciliation: (transactionId: string, bankSerialNo: string) => void;
  financeRows: FinanceTransactionRecord[];
  clearInvoiceMatches: (invoiceId: string) => void;
  declarationPreparationRows: FinanceDeclarationPreparationRecord[];
  invoiceRows: FinanceInvoiceRecord[];
  removeTransactionVoucherFile: (transactionId: string, fileId: string) => void;
  revokeBankReconciliation: (transactionId: string, bankSerialNo: string, reason: string) => void;
  returnFinanceTransaction: (transactionId: string) => void;
  reviewFinanceTransaction: (transactionId: string) => void;
  updateFinanceTransactionsByNo: (
    transactionNos: string[],
    updater: (record: FinanceTransactionRecord) => FinanceTransactionRecord
  ) => void;
  updateInvoiceRecord: (invoiceId: string, updater: (invoice: FinanceInvoiceRecord) => FinanceInvoiceRecord) => void;
  updateDeclarationPreparationRecord: (
    recordId: string,
    updater: (record: FinanceDeclarationPreparationRecord) => FinanceDeclarationPreparationRecord
  ) => void;
  voidFinanceTransaction: (transactionId: string) => void;
};

const FinanceManagementContext = createContext<FinanceManagementStateValue | undefined>(undefined);

export function FinanceManagementProvider({ children }: { children: ReactNode }) {
  const [financeRows, setFinanceRows] = useState<FinanceTransactionRecord[]>(financeTransactionRecords);
  const [invoiceRows, setInvoiceRows] = useState<FinanceInvoiceRecord[]>(financeInvoiceRecords);
  const [declarationPreparationRows, setDeclarationPreparationRows] = useState<FinanceDeclarationPreparationRecord[]>(
    financeDeclarationPreparationRecords
  );

  const value = useMemo<FinanceManagementStateValue>(
    () => ({
      addFinanceTransaction(record) {
        setFinanceRows((current) => [record, ...current]);
      },
      collectPersonalAccountTransaction(sourceTransactionId, record) {
        setFinanceRows((current) => {
          const sourceRecord = current.find((currentRecord) => currentRecord.id === sourceTransactionId);
          const sourceAmount = sourceRecord?.amount ?? 0;
          const currentCollectedAmount = sourceRecord?.collectedAmount ?? 0;
          const nextCollectedAmount = Math.min(sourceAmount, currentCollectedAmount + record.amount);
          const currentStatus = sourceRecord?.collectionStatus ?? '不适用';
          const nextCollectionStatus: FinanceTransactionRecord['collectionStatus'] =
            currentStatus === '待报销' || currentStatus === '已报销'
              ? nextCollectedAmount >= sourceAmount && sourceAmount > 0
                ? '已报销'
                : '待报销'
              : currentStatus === '待存入对公' || currentStatus === '已存入对公'
                ? nextCollectedAmount >= sourceAmount && sourceAmount > 0
                  ? '已存入对公'
                  : '待存入对公'
                : nextCollectedAmount >= sourceAmount && sourceAmount > 0
                  ? '已转入对公'
                  : nextCollectedAmount > 0
                    ? '部分转入对公'
                    : '待转入对公';

          return [
            record,
            ...current.map((currentRecord) =>
              currentRecord.id === sourceTransactionId
                ? {
                    ...currentRecord,
                    collectedAmount: nextCollectedAmount,
                    collectionStatus: nextCollectionStatus,
                    collectionTransactionNos: [...(currentRecord.collectionTransactionNos ?? []), record.transactionNo],
                    updatedAt: `${financeToday} 10:45`,
                    operationRecords: [
                      ...currentRecord.operationRecords,
                      {
                        id: `fin-op-collect-source-${Date.now()}`,
                        time: `${financeToday} 10:45`,
                        actor: '李明',
                        object: currentRecord.transactionNo,
                        action: '登记资金处理',
                        summary: `已登记处理流水 ${record.transactionNo}，处理金额 ${record.amount.toLocaleString('zh-CN')} 元`
                      }
                    ]
                  }
                : currentRecord
            )
          ];
        });
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
                  matchedTransactions: []
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
        setFinanceRows((current) =>
          current.map((record) =>
            record.id === transactionId
              ? {
                  ...record,
                  status: '已入账',
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
      },
      updateFinanceTransactionsByNo(transactionNos, updater) {
        const transactionNoSet = new Set(transactionNos);

        setFinanceRows((current) =>
          current.map((record) => (transactionNoSet.has(record.transactionNo) ? updater(record) : record))
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
      invoiceRows
    }),
    [declarationPreparationRows, financeRows, invoiceRows]
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
