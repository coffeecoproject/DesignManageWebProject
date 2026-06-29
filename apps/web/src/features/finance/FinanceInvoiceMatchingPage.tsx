import { FileSearchOutlined, FileTextOutlined, LinkOutlined, RollbackOutlined, WalletOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Button, Empty, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import type { FinanceTransactionRecord } from './financeData';
import { type FinanceInvoiceDirection, type FinanceInvoiceRecord } from './financeInvoiceData';
import {
  compareInvoiceReceivablePayableMatchLabel,
  doesInvoiceBusinessRefMatchReceivablePayable,
  getFinanceReceivablePayableInvoiceDirection,
  getInvoiceReceivablePayableMatchLabel,
  isFinanceReceivablePayableInvoiceMatchApplicable,
  type FinanceInvoiceReceivablePayableMatchLabel
} from './financeInvoiceMatchingModel';
import {
  buildOriginalInvoiceRedSummary,
  buildTransactionInvoiceAssociation,
  getInvoiceMatchedAmount,
  getInvoiceMatchStatus,
  getOriginalInvoiceForRedInvoice,
  getRedInvoiceOriginalAssociationStatus,
  isInvoiceEffective
} from './financeInvoiceModel';
import {
  type FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import { financeToday, formatMoney, getFinanceTransactionInvoiceDeclarationStatus } from './financeUtils';

type InvoiceMatchingWorkflowStatus = '待补票税依据' | '待处理差异' | '已匹配';

type DetailTabItem = Parameters<typeof DetailTabs>[0]['items'][number];

type BusinessCandidateRow = {
  allocatedAmount: number;
  availableAmount: number;
  businessRecord: FinanceReceivablePayableRecord;
  id: string;
  matchLabel: FinanceInvoiceReceivablePayableMatchLabel;
};

type InvoiceCandidateRow = {
  availableAmount: number;
  id: string;
  invoice: FinanceInvoiceRecord;
  matchLabel: FinanceInvoiceReceivablePayableMatchLabel;
  matchedAmount: number;
};

type RedOriginalInvoiceCandidateRow = {
  alreadyRedAmount: number;
  availableRedAmount: number;
  currentRedAmount: number;
  id: string;
  isOverLimit: boolean;
  invoice: FinanceInvoiceRecord;
  matchLabel: '对象一致';
  remainingAfterCurrentAmount: number;
};

type InvoiceCurrentBusinessMatchRow = {
  amount: number;
  businessRecord?: FinanceReceivablePayableRecord;
  businessRecordNo: string;
  businessSourceNo: string;
  businessSourceTitle: string;
  id: string;
};

type SubsequentInvoiceMatchedTransactionRow = {
  amount: number;
  id: string;
  transaction: FinanceTransactionRecord;
};

type BusinessCurrentInvoiceMatchRow = {
  amount: number;
  id: string;
  invoice: FinanceInvoiceRecord;
  matchId: string;
};

type SelectedBusinessMatchRow = BusinessCandidateRow & {
  allocationStatus: '全额关联' | '部分关联';
  matchAmount: number;
};

type SelectedInvoiceMatchRow = InvoiceCandidateRow & {
  allocationStatus: '全额关联' | '部分关联';
  matchAmount: number;
};

type InvoiceMatchingTodoRow =
  | {
      amount: number;
      candidateCount: number;
      counterparty: string;
      direction: FinanceInvoiceDirection;
      id: string;
      invoice: FinanceInvoiceRecord;
      latestDate: string;
      matchedAmount: number;
      period: string;
      remainingAmount: number;
      sourceNo: string;
      sourceType: 'invoice';
      status: InvoiceMatchingWorkflowStatus;
      type: '发票待关联权责事项';
    }
  | {
      amount: number;
      candidateCount: number;
      counterparty: string;
      direction: FinanceInvoiceDirection;
      id: string;
      latestDate: string;
      matchedAmount: number;
      period: string;
      remainingAmount: number;
      sourceNo: string;
      businessRecord: FinanceReceivablePayableRecord;
      sourceType: 'business';
      status: InvoiceMatchingWorkflowStatus;
      type: '权责事项待补票税依据';
    }
  | {
      amount: number;
      candidateCount: number;
      counterparty: string;
      direction: FinanceInvoiceDirection;
      id: string;
      invoice: FinanceInvoiceRecord;
      latestDate: string;
      matchedAmount: number;
      period: string;
      remainingAmount: number;
      sourceNo: string;
      sourceType: 'red-invoice';
      status: '待处理差异';
      type: '红冲发票待关联原票';
    }
  | {
      amount: number;
      candidateCount: number;
      counterparty: string;
      direction: FinanceInvoiceDirection;
      id: string;
      invoice: FinanceInvoiceRecord;
      latestDate: string;
      matchedAmount: number;
      period: string;
      remainingAmount: number;
      sourceNo: string;
      sourceType: 'subsequent-invoice';
      status: '待处理差异';
      subsequentRows: SubsequentInvoiceMatchedTransactionRow[];
      type: '后续开票待确认';
    }
  | {
      amount: number;
      candidateCount: number;
      counterparty: string;
      direction: FinanceInvoiceDirection;
      id: string;
      invoice: FinanceInvoiceRecord;
      latestDate: string;
      matchedAmount: number;
      period: string;
      remainingAmount: number;
      sourceNo: string;
      sourceType: 'matched-invoice';
      status: '已匹配';
      type: '票税依据已匹配';
    };

const invoiceDirectionTone = {
  销项: 'green',
  进项: 'blue'
} as const;

const workflowStatusTone = {
  待补票税依据: 'amber',
  待处理差异: 'red',
  已匹配: 'green'
} as const satisfies Record<InvoiceMatchingWorkflowStatus, 'amber' | 'green' | 'red'>;

const allocationStatusTone = {
  全额关联: 'green',
  部分关联: 'blue'
} as const;

const invoiceMatchLabelTone = {
  来源一致: 'green',
  对象一致: 'green',
  报销票据: 'blue'
} as const satisfies Record<FinanceInvoiceReceivablePayableMatchLabel, 'blue' | 'green'>;

function getBusinessAllocatedAmount(invoice: FinanceInvoiceRecord, amount: number) {
  return invoice.invoiceStatus === '红冲' ? 0 : Math.max(0, amount);
}

function getAllocatedAmountByBusinessRecord(invoices: FinanceInvoiceRecord[]) {
  const allocatedAmountMap = new Map<string, number>();

  invoices.forEach((invoice) => {
    invoice.matchedBusinessRefs.forEach((match) => {
      allocatedAmountMap.set(match.recordNo, (allocatedAmountMap.get(match.recordNo) ?? 0) + getBusinessAllocatedAmount(invoice, match.amount));
    });
  });

  return allocatedAmountMap;
}

function getInvoiceRemainingAmount(invoice: FinanceInvoiceRecord) {
  return Math.max(0, invoice.totalAmount - getInvoiceMatchedAmount(invoice));
}

function buildBusinessCandidateRows(
  invoice: FinanceInvoiceRecord,
  invoices: FinanceInvoiceRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[]
): BusinessCandidateRow[] {
  const allocatedAmountMap = getAllocatedAmountByBusinessRecord(invoices);

  return receivablePayableRows
    .flatMap((record) => {
      const matchLabel = getInvoiceReceivablePayableMatchLabel(invoice, record);

      if (!matchLabel) {
        return [];
      }

      const allocatedAmount = allocatedAmountMap.get(record.documentNo) ?? 0;
      const availableAmount = Number((record.amount - allocatedAmount).toFixed(2));

      if (availableAmount <= 0.01) {
        return [];
      }

      return [
        {
          allocatedAmount,
          availableAmount,
          businessRecord: record,
          id: `${invoice.id}-${record.id}`,
          matchLabel
        } satisfies BusinessCandidateRow
      ];
    })
    .sort(compareBusinessCandidateRows);
}

function buildInvoiceCandidateRows(record: FinanceReceivablePayableRecord, invoices: FinanceInvoiceRecord[]): InvoiceCandidateRow[] {
  return invoices
    .flatMap((invoice) => {
      if (invoice.invoiceStatus !== '正常' || !isInvoiceEffective(invoice)) {
        return [];
      }

      const matchLabel = getInvoiceReceivablePayableMatchLabel(invoice, record);

      if (!matchLabel) {
        return [];
      }

      const matchedAmount = getInvoiceMatchedAmount(invoice);
      const availableAmount = Number((invoice.totalAmount - matchedAmount).toFixed(2));

      if (availableAmount <= 0.01) {
        return [];
      }

      return [
        {
          availableAmount,
          id: `${record.id}-${invoice.id}`,
          invoice,
          matchLabel,
          matchedAmount
        } satisfies InvoiceCandidateRow
      ];
    })
    .sort(compareInvoiceCandidateRows);
}

function buildRedOriginalInvoiceCandidates(redInvoice: FinanceInvoiceRecord, invoices: FinanceInvoiceRecord[]): RedOriginalInvoiceCandidateRow[] {
  return invoices
    .flatMap((invoice) => {
      if (invoice.id === redInvoice.id || invoice.invoiceStatus !== '正常' || invoice.direction !== redInvoice.direction) {
        return [];
      }

      if (invoice.counterparty !== redInvoice.counterparty) {
        return [];
      }

      if (invoice.invoiceDate > redInvoice.invoiceDate) {
        return [];
      }

      const redSummary = buildOriginalInvoiceRedSummary(invoice, invoices, redInvoice);

      return [
        {
          alreadyRedAmount: redSummary.alreadyRedAmount,
          availableRedAmount: redSummary.availableRedAmount,
          currentRedAmount: redSummary.currentRedAmount,
          id: `${redInvoice.id}-${invoice.id}`,
          isOverLimit: redSummary.isOverLimit,
          invoice,
          matchLabel: '对象一致',
          remainingAfterCurrentAmount: redSummary.remainingAfterCurrentAmount
        } satisfies RedOriginalInvoiceCandidateRow
      ];
    })
    .sort(compareRedOriginalCandidateRows);
}

function compareBusinessCandidateRows(left: BusinessCandidateRow, right: BusinessCandidateRow) {
  if (left.matchLabel !== right.matchLabel) {
    return compareInvoiceReceivablePayableMatchLabel(left.matchLabel, right.matchLabel);
  }

  if (left.businessRecord.accountingPeriod !== right.businessRecord.accountingPeriod) {
    return right.businessRecord.accountingPeriod.localeCompare(left.businessRecord.accountingPeriod);
  }

  return left.businessRecord.confirmDate.localeCompare(right.businessRecord.confirmDate);
}

function compareInvoiceCandidateRows(left: InvoiceCandidateRow, right: InvoiceCandidateRow) {
  if (left.matchLabel !== right.matchLabel) {
    return compareInvoiceReceivablePayableMatchLabel(left.matchLabel, right.matchLabel);
  }

  if (left.invoice.accountingPeriod !== right.invoice.accountingPeriod) {
    return right.invoice.accountingPeriod.localeCompare(left.invoice.accountingPeriod);
  }

  return left.invoice.invoiceDate.localeCompare(right.invoice.invoiceDate);
}

function compareRedOriginalCandidateRows(left: RedOriginalInvoiceCandidateRow, right: RedOriginalInvoiceCandidateRow) {
  return right.invoice.invoiceDate.localeCompare(left.invoice.invoiceDate);
}

function buildCurrentBusinessMatchRows(
  invoice: FinanceInvoiceRecord,
  businessRecordByNo: Map<string, FinanceReceivablePayableRecord>
): InvoiceCurrentBusinessMatchRow[] {
  return invoice.matchedBusinessRefs.map((match) => ({
    amount: match.amount,
    businessRecord: businessRecordByNo.get(match.recordNo) ?? businessRecordByNo.get(match.sourceNo),
    businessRecordNo: match.recordNo,
    businessSourceNo: match.sourceNo,
    businessSourceTitle: match.sourceTitle,
    id: match.id,
  }));
}

function buildCurrentInvoiceMatchRows(record: FinanceReceivablePayableRecord, invoices: FinanceInvoiceRecord[]): BusinessCurrentInvoiceMatchRow[] {
  return invoices.flatMap((invoice) =>
    invoice.matchedBusinessRefs
      .filter((match) => doesInvoiceBusinessRefMatchReceivablePayable(match, record))
      .map((match) => ({
        amount: match.amount,
        id: `${invoice.id}-${match.id}`,
        invoice,
        matchId: match.id
      }))
  );
}

function getAllocatedCandidateIds(
  candidateIds: string[],
  candidateAvailableAmountById: Map<string, number>,
  remainingAmount: number
) {
  let availableMatchAmount = remainingAmount;
  const allocatedCandidateIds: string[] = [];

  candidateIds.forEach((candidateId) => {
    const candidateAvailableAmount = candidateAvailableAmountById.get(candidateId) ?? 0;

    if (candidateAvailableAmount <= 0.01 || availableMatchAmount <= 0.01) {
      return;
    }

    allocatedCandidateIds.push(candidateId);
    availableMatchAmount = Number((availableMatchAmount - Math.min(candidateAvailableAmount, availableMatchAmount)).toFixed(2));
  });

  return allocatedCandidateIds;
}

function buildSelectedBusinessRows(
  candidates: BusinessCandidateRow[],
  candidateIds: string[],
  remainingAmount: number
): SelectedBusinessMatchRow[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  let availableMatchAmount = remainingAmount;

  return candidateIds.flatMap((candidateId) => {
    const candidate = candidateById.get(candidateId);

    if (!candidate || candidate.availableAmount <= 0.01 || availableMatchAmount <= 0.01) {
      return [];
    }

    const matchAmount = Number(Math.min(candidate.availableAmount, availableMatchAmount).toFixed(2));
    availableMatchAmount = Number((availableMatchAmount - matchAmount).toFixed(2));

    return [
      {
        ...candidate,
        allocationStatus: candidate.availableAmount - matchAmount > 0.01 ? '部分关联' : '全额关联',
        matchAmount
      } satisfies SelectedBusinessMatchRow
    ];
  });
}

function buildSelectedInvoiceRows(
  candidates: InvoiceCandidateRow[],
  candidateIds: string[],
  remainingAmount: number
): SelectedInvoiceMatchRow[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  let availableMatchAmount = remainingAmount;

  return candidateIds.flatMap((candidateId) => {
    const candidate = candidateById.get(candidateId);

    if (!candidate || candidate.availableAmount <= 0.01 || availableMatchAmount <= 0.01) {
      return [];
    }

    const matchAmount = Number(Math.min(candidate.availableAmount, availableMatchAmount).toFixed(2));
    availableMatchAmount = Number((availableMatchAmount - matchAmount).toFixed(2));

    return [
      {
        ...candidate,
        allocationStatus: candidate.availableAmount - matchAmount > 0.01 ? '部分关联' : '全额关联',
        matchAmount
      } satisfies SelectedInvoiceMatchRow
    ];
  });
}

function resolveCandidateSelectionOrder(currentCandidateIds: string[], nextCandidateIds: string[]) {
  const nextCandidateIdSet = new Set(nextCandidateIds);
  const preservedCandidateIds = currentCandidateIds.filter((candidateId) => nextCandidateIdSet.has(candidateId));
  const appendedCandidateIds = nextCandidateIds.filter((candidateId) => !preservedCandidateIds.includes(candidateId));

  return [...preservedCandidateIds, ...appendedCandidateIds];
}

function buildInvoiceMatchingTodos(
  invoices: FinanceInvoiceRecord[],
  financeRows: FinanceTransactionRecord[],
  receivablePayableRows: FinanceReceivablePayableRecord[]
): InvoiceMatchingTodoRow[] {
  const financeRowByNo = new Map(financeRows.map((financeRow) => [financeRow.transactionNo, financeRow]));
  const invoiceTodos = invoices
    .filter((invoice) => isInvoiceEffective(invoice) && invoice.invoiceStatus === '正常' && getInvoiceMatchStatus(invoice) !== '已匹配')
    .map((invoice) => {
      const matchedAmount = getInvoiceMatchedAmount(invoice);
      const remainingAmount = getInvoiceRemainingAmount(invoice);

      return {
        amount: invoice.totalAmount,
        candidateCount: buildBusinessCandidateRows(invoice, invoices, receivablePayableRows).length,
        counterparty: invoice.counterparty,
        direction: invoice.direction,
        id: `invoice-todo-${invoice.id}`,
        invoice,
        latestDate: invoice.invoiceDate,
        matchedAmount,
        period: invoice.accountingPeriod,
        remainingAmount,
        sourceNo: invoice.invoiceNo,
        sourceType: 'invoice',
        status: '待处理差异',
        type: '发票待关联权责事项'
      } satisfies InvoiceMatchingTodoRow;
    });
  const subsequentInvoiceTodos = invoices
    .filter((invoice) => isInvoiceEffective(invoice) && invoice.invoiceStatus === '正常' && getInvoiceMatchStatus(invoice) === '已匹配')
    .flatMap((invoice) => {
      const subsequentRows = invoice.matchedBusinessRefs.flatMap((match): SubsequentInvoiceMatchedTransactionRow[] => {
        const financeRow = match.sourceModule === '未开票收入' ? financeRowByNo.get(match.sourceNo) : undefined;

        if (!financeRow || financeRow.invoiceDeclarationStatus !== '未开票已申报') {
          return [];
        }

        const invoiceDeclarationStatus = getFinanceTransactionInvoiceDeclarationStatus(
          financeRow,
          buildTransactionInvoiceAssociation(financeRow, invoices)
        );

        if (invoiceDeclarationStatus !== '后续开票待处理') {
          return [];
        }

        return [
          {
            amount: match.amount,
            id: `${invoice.id}-${match.id}`,
            transaction: financeRow
          }
        ];
      });

      if (subsequentRows.length === 0) {
        return [];
      }

      const subsequentAmount = subsequentRows.reduce((total, row) => total + row.amount, 0);

      return [
        {
          amount: subsequentAmount,
          candidateCount: subsequentRows.length,
          counterparty: invoice.counterparty,
          direction: invoice.direction,
          id: `subsequent-invoice-todo-${invoice.id}`,
          invoice,
          latestDate: invoice.invoiceDate,
          matchedAmount: subsequentAmount,
          period: invoice.accountingPeriod,
          remainingAmount: subsequentAmount,
          sourceNo: invoice.invoiceNo,
          sourceType: 'subsequent-invoice',
          status: '待处理差异',
          subsequentRows,
          type: '后续开票待确认'
        } satisfies InvoiceMatchingTodoRow
      ];
    });
  const businessTodos = receivablePayableRows
    .filter(isFinanceReceivablePayableInvoiceMatchApplicable)
    .flatMap((record) => {
      const matchedAmount = invoices.reduce(
        (total, invoice) =>
          total +
          invoice.matchedBusinessRefs.reduce(
            (invoiceTotal, match) =>
              doesInvoiceBusinessRefMatchReceivablePayable(match, record)
                ? invoiceTotal + (invoice.invoiceStatus === '红冲' ? 0 : Math.max(0, match.amount))
                : invoiceTotal,
            0
          ),
        0
      );
      const remainingAmount = Math.max(0, record.amount - matchedAmount);

      if (remainingAmount <= 0.01) {
        return [];
      }

      return [
        {
          amount: record.amount,
          businessRecord: record,
          candidateCount: buildInvoiceCandidateRows(record, invoices).length,
          counterparty: record.counterparty,
          direction: getFinanceReceivablePayableInvoiceDirection(record),
          id: `business-todo-${record.id}`,
          latestDate: record.confirmDate,
          matchedAmount,
          period: record.accountingPeriod,
          remainingAmount,
          sourceNo: record.documentNo,
          sourceType: 'business',
          status: '待补票税依据',
          type: '权责事项待补票税依据'
        } satisfies InvoiceMatchingTodoRow
      ];
    });
  const redInvoiceTodos = invoices
    .filter((invoice) => isInvoiceEffective(invoice) && invoice.invoiceStatus === '红冲' && getRedInvoiceOriginalAssociationStatus(invoice) === '待关联原票')
    .map((invoice) => {
      const candidates = buildRedOriginalInvoiceCandidates(invoice, invoices);

      return {
        amount: Math.abs(invoice.totalAmount),
        candidateCount: candidates.filter((candidate) => !candidate.isOverLimit).length,
        counterparty: invoice.counterparty,
        direction: invoice.direction,
        id: `red-invoice-todo-${invoice.id}`,
        invoice,
        latestDate: invoice.invoiceDate,
        matchedAmount: 0,
        period: invoice.accountingPeriod,
        remainingAmount: Math.abs(invoice.totalAmount),
        sourceNo: invoice.invoiceNo,
        sourceType: 'red-invoice',
        status: '待处理差异',
        type: '红冲发票待关联原票'
      } satisfies InvoiceMatchingTodoRow;
    });

  const matchedInvoiceRows = invoices
    .filter((invoice) => isInvoiceEffective(invoice) && invoice.invoiceStatus === '正常' && getInvoiceMatchStatus(invoice) === '已匹配')
    .filter((invoice) =>
      !subsequentInvoiceTodos.some((todo) => todo.sourceType === 'subsequent-invoice' && todo.invoice.id === invoice.id)
    )
    .map((invoice) => {
      const matchedAmount = getInvoiceMatchedAmount(invoice);

      return {
        amount: invoice.totalAmount,
        candidateCount: invoice.matchedBusinessRefs.length,
        counterparty: invoice.counterparty,
        direction: invoice.direction,
        id: `matched-invoice-${invoice.id}`,
        invoice,
        latestDate: invoice.invoiceDate,
        matchedAmount,
        period: invoice.accountingPeriod,
        remainingAmount: 0,
        sourceNo: invoice.invoiceNo,
        sourceType: 'matched-invoice',
        status: '已匹配',
        type: '票税依据已匹配'
      } satisfies InvoiceMatchingTodoRow;
    });

  return [
    ...invoiceTodos,
    ...subsequentInvoiceTodos,
    ...businessTodos,
    ...redInvoiceTodos,
    ...matchedInvoiceRows
  ].sort((left, right) => {
    if (left.status === '已匹配' && right.status !== '已匹配') {
      return 1;
    }

    if (left.status !== '已匹配' && right.status === '已匹配') {
      return -1;
    }

    return right.latestDate.localeCompare(left.latestDate);
  });
}

function renderMoney(amount: number) {
  return <CellText tone={amount < 0 ? 'expense' : amount > 0 ? 'strong' : 'subtle'}>{formatMoney(amount)}</CellText>;
}

function renderDirection(direction: FinanceInvoiceDirection) {
  return <StatusTag toneMap={invoiceDirectionTone} value={direction} />;
}

function renderWorkflowStatus(status: InvoiceMatchingWorkflowStatus) {
  return <StatusTag toneMap={workflowStatusTone} value={status} />;
}

function renderAllocationStatus(status: SelectedBusinessMatchRow['allocationStatus'] | SelectedInvoiceMatchRow['allocationStatus']) {
  return <StatusTag toneMap={allocationStatusTone} value={status} />;
}

function renderInvoiceMatchLabel(matchLabel: FinanceInvoiceReceivablePayableMatchLabel) {
  return <StatusTag toneMap={invoiceMatchLabelTone} value={matchLabel} />;
}

function getTodoQueueDate(row: InvoiceMatchingTodoRow) {
  return row.latestDate.slice(5);
}

function getTodoQueueAmount(row: InvoiceMatchingTodoRow) {
  return row.status === '已匹配' ? row.matchedAmount : row.remainingAmount;
}

export function FinanceInvoiceMatchingPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { financeRows, invoiceRows, receivablePayableRows, updateFinanceTransactionsByNo, updateInvoiceRecord } = useFinanceManagement();
  const [activeTodoId, setActiveTodoId] = useState<string | undefined>();
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  const businessRecordByNo = useMemo(
    () => new Map(receivablePayableRows.flatMap((record) => [[record.documentNo, record], [record.sourceNo, record]] as const)),
    [receivablePayableRows]
  );
  const matchingTodos = useMemo(
    () => buildInvoiceMatchingTodos(invoiceRows, financeRows, receivablePayableRows),
    [financeRows, invoiceRows, receivablePayableRows]
  );
  const rows = matchingTodos;
  const openRows = useMemo(() => rows.filter((row) => row.status !== '已匹配'), [rows]);
  const activeTodo = useMemo(
    () => rows.find((row) => row.id === activeTodoId) ?? openRows[0] ?? rows[0],
    [activeTodoId, openRows, rows]
  );
  const businessCandidates = useMemo(
    () => (activeTodo?.sourceType === 'invoice' ? buildBusinessCandidateRows(activeTodo.invoice, invoiceRows, receivablePayableRows) : []),
    [activeTodo, invoiceRows, receivablePayableRows]
  );
  const invoiceCandidates = useMemo(
    () => (activeTodo?.sourceType === 'business' ? buildInvoiceCandidateRows(activeTodo.businessRecord, invoiceRows) : []),
    [activeTodo, invoiceRows]
  );
  const redOriginalCandidates = useMemo(
    () => (activeTodo?.sourceType === 'red-invoice' ? buildRedOriginalInvoiceCandidates(activeTodo.invoice, invoiceRows) : []),
    [activeTodo, invoiceRows]
  );
  const activeRedOriginalInvoice = activeTodo?.sourceType === 'red-invoice'
    ? getOriginalInvoiceForRedInvoice(activeTodo.invoice, invoiceRows)
    : undefined;
  const currentBusinessMatches = activeTodo?.sourceType === 'invoice' || activeTodo?.sourceType === 'matched-invoice'
    ? buildCurrentBusinessMatchRows(activeTodo.invoice, businessRecordByNo)
    : [];
  const currentInvoiceMatches = activeTodo?.sourceType === 'business' ? buildCurrentInvoiceMatchRows(activeTodo.businessRecord, invoiceRows) : [];
  const selectedBusinessRows = useMemo<SelectedBusinessMatchRow[]>(
    () => (activeTodo?.sourceType === 'invoice' ? buildSelectedBusinessRows(businessCandidates, selectedCandidateIds, activeTodo.remainingAmount) : []),
    [activeTodo, businessCandidates, selectedCandidateIds]
  );
  const selectedInvoiceRows = useMemo<SelectedInvoiceMatchRow[]>(
    () => (activeTodo?.sourceType === 'business' ? buildSelectedInvoiceRows(invoiceCandidates, selectedCandidateIds, activeTodo.remainingAmount) : []),
    [activeTodo, invoiceCandidates, selectedCandidateIds]
  );
  const selectedMatchRows = activeTodo?.sourceType === 'business' ? selectedInvoiceRows : selectedBusinessRows;
  const selectedMatchTotal = selectedMatchRows.reduce((total, row) => total + row.matchAmount, 0);
  const selectedAfterRemaining = (activeTodo?.remainingAmount ?? 0) - selectedMatchTotal;
  const selectedMatchOverLimit = selectedMatchTotal - (activeTodo?.remainingAmount ?? 0) > 0.01;
  const taxBasisTodoCount = rows.filter((row) => row.status === '待补票税依据').length;
  const discrepancyTodoCount = rows.filter((row) => row.status === '待处理差异').length;
  const matchedTodoCount = rows.filter((row) => row.status === '已匹配').length;
  const pendingAmount = openRows.reduce((total, row) => total + row.remainingAmount, 0);
  const subsequentDeclaredPeriods = activeTodo?.sourceType === 'subsequent-invoice'
    ? Array.from(new Set(activeTodo.subsequentRows.map((currentRow) => currentRow.transaction.invoiceDeclarationPeriod ?? currentRow.transaction.accountingPeriod)))
    : [];

  useEffect(() => {
    setSelectedCandidateIds([]);
  }, [activeTodo?.id]);

  function updateInvoiceMatch(invoiceId: string, updater: (invoice: FinanceInvoiceRecord) => FinanceInvoiceRecord) {
    updateInvoiceRecord(invoiceId, updater);
  }

  function handleSelectCandidates(candidateIds: string[]) {
    if (activeTodo?.sourceType === 'red-invoice') {
      setSelectedCandidateIds(candidateIds.slice(-1));
      return;
    }

    const orderedCandidateIds = resolveCandidateSelectionOrder(selectedCandidateIds, candidateIds);

    if (activeTodo?.sourceType === 'invoice') {
      setSelectedCandidateIds(
        getAllocatedCandidateIds(
          orderedCandidateIds,
          new Map(businessCandidates.map((candidate) => [candidate.id, candidate.availableAmount])),
          activeTodo.remainingAmount
        )
      );
      return;
    }

    if (activeTodo?.sourceType === 'business') {
      setSelectedCandidateIds(
        getAllocatedCandidateIds(
          orderedCandidateIds,
          new Map(invoiceCandidates.map((candidate) => [candidate.id, candidate.availableAmount])),
          activeTodo.remainingAmount
        )
      );
      return;
    }

    setSelectedCandidateIds(orderedCandidateIds);
  }

  function handleClearSelection() {
    setSelectedCandidateIds([]);
  }

  function handleSaveInvoiceToBusiness(row: Extract<InvoiceMatchingTodoRow, { sourceType: 'invoice' }>) {
    if (selectedBusinessRows.length === 0) {
      void messageApi.warning('请选择需要关联的业务');
      return;
    }

    if (selectedMatchTotal - row.remainingAmount > 0.01) {
      void messageApi.warning('本次关联金额不能超过待处理金额');
      return;
    }

    updateInvoiceMatch(row.invoice.id, (invoice) => ({
      ...invoice,
      matchedBusinessRefs: selectedBusinessRows.reduce((matches, selectedRow) => {
        const existingMatchIndex = matches.findIndex((match) => match.recordNo === selectedRow.businessRecord.documentNo);

        if (existingMatchIndex >= 0) {
          return matches.map((match, index) =>
            index === existingMatchIndex
              ? {
                  ...match,
                  amount: Number((match.amount + selectedRow.matchAmount).toFixed(2))
                }
              : match
          );
        }

        return [
          ...matches,
          {
            amount: Number(selectedRow.matchAmount.toFixed(2)),
            id: `invoice-match-${invoice.id}-${selectedRow.businessRecord.id}-${Date.now()}`,
            recordId: selectedRow.businessRecord.id,
            recordNo: selectedRow.businessRecord.documentNo,
            sourceModule: '应收应付' as const,
            sourceNo: selectedRow.businessRecord.sourceNo,
            sourceTitle: selectedRow.businessRecord.sourceTitle
          }
        ];
      }, invoice.matchedBusinessRefs)
    }));
    setActiveTodoId(undefined);
    handleClearSelection();
    void messageApi.success(`已保存 ${selectedBusinessRows.length} 条关联关系`);
  }

  function handleSaveBusinessToInvoices(row: Extract<InvoiceMatchingTodoRow, { sourceType: 'business' }>) {
    if (selectedInvoiceRows.length === 0) {
      void messageApi.warning('请选择需要关联的发票');
      return;
    }

    if (selectedMatchTotal - row.remainingAmount > 0.01) {
      void messageApi.warning('本次关联金额不能超过待补票税金额');
      return;
    }

    selectedInvoiceRows.forEach((selectedRow) => {
      updateInvoiceMatch(selectedRow.invoice.id, (invoice) => ({
        ...invoice,
        matchedBusinessRefs: [
          ...invoice.matchedBusinessRefs,
          {
            amount: Number(selectedRow.matchAmount.toFixed(2)),
            id: `invoice-match-${invoice.id}-${row.businessRecord.id}-${Date.now()}`,
            recordId: row.businessRecord.id,
            recordNo: row.businessRecord.documentNo,
            sourceModule: '应收应付' as const,
            sourceNo: row.businessRecord.sourceNo,
            sourceTitle: row.businessRecord.sourceTitle
          }
        ]
      }));
    });
    setActiveTodoId(undefined);
    handleClearSelection();
    void messageApi.success(`已保存 ${selectedInvoiceRows.length} 条关联关系`);
  }

  function handleRemoveInvoiceMatch(invoiceId: string, matchId: string) {
    updateInvoiceMatch(invoiceId, (invoice) => ({
      ...invoice,
      matchedBusinessRefs: invoice.matchedBusinessRefs.filter((match) => match.id !== matchId)
    }));
    void messageApi.success('已撤销关联');
  }

  function handleConfirmRedOriginal(row: Extract<InvoiceMatchingTodoRow, { sourceType: 'red-invoice' }>) {
    if (selectedCandidateIds.length !== 1) {
      void messageApi.warning('请选择原蓝字发票');
      return;
    }

    const selectedCandidate = redOriginalCandidates.find((candidate) => candidate.id === selectedCandidateIds[0]);

    if (!selectedCandidate) {
      void messageApi.warning('未找到原蓝字发票');
      return;
    }

    if (selectedCandidate.isOverLimit) {
      void messageApi.warning('红冲金额不能超过原蓝字发票可冲减金额');
      return;
    }

    updateInvoiceMatch(row.invoice.id, (invoice) => ({
      ...invoice,
      matchedBusinessRefs: [],
      originalInvoiceId: selectedCandidate.invoice.id
    }));
    setActiveTodoId(undefined);
    handleClearSelection();
    void messageApi.success('已确认红冲原票关联');
  }

  function handleConfirmSubsequentInvoice(row: Extract<InvoiceMatchingTodoRow, { sourceType: 'subsequent-invoice' }>) {
    const transactionNos = Array.from(new Set(row.subsequentRows.map((currentRow) => currentRow.transaction.transactionNo)));

    updateFinanceTransactionsByNo(transactionNos, (record) => ({
      ...record,
      invoiceDeclarationStatus: '后续开票已处理',
      operationRecords: [
        ...record.operationRecords,
        {
          action: '确认后续开票',
          actor: '李明',
          id: `fin-op-invoice-subsequent-${record.transactionNo}-${Date.now()}`,
          object: record.transactionNo,
          summary: `${row.invoice.invoiceNo} 已作为前期未开票收入的后续开票处理`,
          time: `${financeToday} 14:25`
        }
      ],
      updatedAt: `${financeToday} 14:25`
    }));
    setActiveTodoId(undefined);
    void messageApi.success('后续开票已确认');
  }

  const currentBusinessColumns: TableColumnsType<InvoiceCurrentBusinessMatchRow> = [
    {
      title: '权责事项',
      dataIndex: 'businessRecordNo',
      width: 190,
      render: (businessRecordNo: string, record) => <CompactCell primary={businessRecordNo} secondary={record.businessRecord?.confirmDate ?? record.businessSourceNo} />
    },
    {
      title: '对象',
      dataIndex: ['businessRecord', 'counterparty'],
      width: 150,
      render: (_: string, record) => record.businessRecord?.counterparty ?? '-'
    },
    {
      title: '关联金额',
      dataIndex: 'amount',
      width: 120,
      render: renderMoney
    },
    {
      title: '操作',
      key: 'action',
      width: 96,
      render: (_, record) =>
        activeTodo?.sourceType === 'invoice' ? (
          <Button icon={<RollbackOutlined />} size="small" onClick={() => handleRemoveInvoiceMatch(activeTodo.invoice.id, record.id)}>
            撤销
          </Button>
        ) : (
          <CellText tone="subtle">-</CellText>
        )
    }
  ];

  const currentInvoiceColumns: TableColumnsType<BusinessCurrentInvoiceMatchRow> = [
    {
      title: '发票',
      dataIndex: ['invoice', 'invoiceNo'],
      width: 190,
      render: (_: string, record) => <CompactCell primary={record.invoice.invoiceNo} secondary={record.invoice.invoiceDate} />
    },
    {
      title: '对象',
      dataIndex: ['invoice', 'counterparty'],
      width: 150,
      render: (_: string, record) => record.invoice.counterparty
    },
    {
      title: '关联金额',
      dataIndex: 'amount',
      width: 120,
      render: renderMoney
    },
    {
      title: '操作',
      key: 'action',
      width: 96,
      render: (_, record) => (
        <Button icon={<RollbackOutlined />} size="small" onClick={() => handleRemoveInvoiceMatch(record.invoice.id, record.matchId)}>
          撤销
        </Button>
      )
    }
  ];

  const subsequentInvoiceColumns: TableColumnsType<SubsequentInvoiceMatchedTransactionRow> = [
    {
      title: '前期未开票收入',
      dataIndex: ['transaction', 'transactionNo'],
      width: 190,
      render: (_transactionNo: string, record) => (
        <CompactCell primary={record.transaction.transactionNo} secondary={record.transaction.invoiceDeclarationPeriod ?? record.transaction.accountingPeriod} />
      )
    },
    {
      title: '对象',
      dataIndex: ['transaction', 'counterparty'],
      width: 150,
      render: (_counterparty: string, record) => record.transaction.counterparty
    },
    {
      title: '后续开票金额',
      dataIndex: 'amount',
      width: 140,
      render: renderMoney
    },
    {
      title: '前期状态',
      dataIndex: ['transaction', 'invoiceDeclarationStatus'],
      width: 140,
      render: (_status: string, record) => record.transaction.invoiceDeclarationStatus ?? '-'
    }
  ];

  const businessCandidateColumns: TableColumnsType<BusinessCandidateRow> = [
    {
      title: '权责事项',
      dataIndex: ['businessRecord', 'documentNo'],
      width: 190,
      render: (_: string, record) => <CompactCell primary={record.businessRecord.documentNo} secondary={record.businessRecord.confirmDate} />
    },
    {
      title: '权责月份',
      dataIndex: ['businessRecord', 'accountingPeriod'],
      width: 112,
      render: (_: string, record) => record.businessRecord.accountingPeriod
    },
    {
      title: '对象',
      dataIndex: ['businessRecord', 'counterparty'],
      width: 150,
      render: (_: string, record) => record.businessRecord.counterparty
    },
    {
      title: '业务金额',
      dataIndex: ['businessRecord', 'amount'],
      width: 120,
      render: renderMoney
    },
    {
      title: '已关联',
      dataIndex: 'allocatedAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '可用金额',
      dataIndex: 'availableAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '建议',
      dataIndex: 'matchLabel',
      width: 104,
      render: renderInvoiceMatchLabel
    }
  ];

  const invoiceCandidateColumns: TableColumnsType<InvoiceCandidateRow> = [
    {
      title: '发票',
      dataIndex: ['invoice', 'invoiceNo'],
      width: 190,
      render: (_: string, record) => <CompactCell primary={record.invoice.invoiceNo} secondary={record.invoice.invoiceDate} />
    },
    {
      title: '开票月份',
      dataIndex: ['invoice', 'accountingPeriod'],
      width: 112,
      render: (_: string, record) => record.invoice.accountingPeriod
    },
    {
      title: '对象',
      dataIndex: ['invoice', 'counterparty'],
      width: 150,
      render: (_: string, record) => record.invoice.counterparty
    },
    {
      title: '发票金额',
      dataIndex: ['invoice', 'totalAmount'],
      width: 120,
      render: renderMoney
    },
    {
      title: '已关联',
      dataIndex: 'matchedAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '可用金额',
      dataIndex: 'availableAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '建议',
      dataIndex: 'matchLabel',
      width: 104,
      render: renderInvoiceMatchLabel
    }
  ];

  const selectedMatchColumns: TableColumnsType<SelectedBusinessMatchRow | SelectedInvoiceMatchRow> = [
    {
      title: '对象',
      key: 'source',
      width: 220,
      render: (_, record) =>
        'businessRecord' in record ? (
          <CompactCell primary={record.businessRecord.documentNo} secondary={`${record.businessRecord.counterparty} / ${record.businessRecord.accountingPeriod}`} />
        ) : (
          <CompactCell primary={record.invoice.invoiceNo} secondary={`${record.invoice.counterparty} / ${record.invoice.accountingPeriod}`} />
        )
    },
    {
      title: '可用金额',
      dataIndex: 'availableAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '本次关联',
      dataIndex: 'matchAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '关联方式',
      dataIndex: 'allocationStatus',
      width: 108,
      render: renderAllocationStatus
    }
  ];

  const redOriginalCandidateColumns: TableColumnsType<RedOriginalInvoiceCandidateRow> = [
    {
      title: '原蓝字发票',
      dataIndex: ['invoice', 'invoiceNo'],
      width: 190,
      render: (_: string, record) => <CompactCell primary={record.invoice.invoiceNo} secondary={record.invoice.invoiceDate} />
    },
    {
      title: '对象',
      dataIndex: ['invoice', 'counterparty'],
      width: 150,
      render: (_: string, record) => record.invoice.counterparty
    },
    {
      title: '发票金额',
      dataIndex: ['invoice', 'totalAmount'],
      width: 120,
      render: renderMoney
    },
    {
      title: '已红冲',
      dataIndex: 'alreadyRedAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '本次红冲',
      dataIndex: 'currentRedAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '可冲减',
      dataIndex: 'availableRedAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '建议',
      dataIndex: 'matchLabel',
      width: 104,
      render: (matchLabel: RedOriginalInvoiceCandidateRow['matchLabel'], record) => (
        <StatusTag tone={record.isOverLimit ? 'red' : matchLabel === '对象一致' ? 'green' : 'blue'} value={record.isOverLimit ? '金额不足' : matchLabel} />
      )
    }
  ];

  function renderSelectedMatchConfirm(onSave: () => void) {
    if (selectedMatchRows.length === 0) {
      return null;
    }

    return (
      <div className="finance-invoice-match-confirm">
        <DetailInfoGrid
          columns={4}
          items={[
            { label: '已选项目', value: `${selectedMatchRows.length} 条` },
            { label: '待处理金额', value: formatMoney(activeTodo?.remainingAmount ?? 0) },
            { label: '本次关联', value: formatMoney(selectedMatchTotal) },
            { label: selectedMatchOverLimit ? '超出金额' : '剩余金额', value: formatMoney(Math.abs(selectedAfterRemaining)) }
          ]}
        />
        <CompactDetailTable<SelectedBusinessMatchRow | SelectedInvoiceMatchRow>
          columns={selectedMatchColumns}
          dataSource={selectedMatchRows}
          emptyText="暂无本次关联"
          rowKey="id"
          scrollX={620}
        />
        <div className="finance-invoice-match-confirm-action">
          <Button onClick={handleClearSelection}>清空选择</Button>
          <Button
            data-testid="finance-invoice-matching-confirm-button"
            disabled={selectedMatchTotal <= 0 || selectedMatchOverLimit}
            type="primary"
            onClick={onSave}
          >
            保存关联
          </Button>
        </div>
      </div>
    );
  }

  function buildDetailTabs(row: InvoiceMatchingTodoRow): DetailTabItem[] {
    if (row.sourceType === 'matched-invoice') {
      return [
        {
          key: 'current',
          label: '已匹配事项',
          children: (
            <DetailSection icon={<LinkOutlined />} title="已匹配事项">
              <CompactDetailTable<InvoiceCurrentBusinessMatchRow>
                columns={currentBusinessColumns}
                dataSource={currentBusinessMatches}
                emptyText="暂无已匹配事项"
                rowKey="id"
                scrollX={620}
              />
            </DetailSection>
          )
        },
        {
          key: 'invoice',
          label: '发票信息',
          children: (
            <DetailSection icon={<FileTextOutlined />} title="发票信息">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '发票号', value: row.invoice.invoiceNo },
                  { label: '对象', value: row.invoice.counterparty },
                  { label: '发票方向', value: renderDirection(row.invoice.direction) },
                  { label: '发票日期', value: row.invoice.invoiceDate },
                  { label: '开票月份', value: row.invoice.accountingPeriod },
                  { label: '来源文件', value: row.invoice.sourceFile }
                ]}
              />
            </DetailSection>
          )
        }
      ];
    }

    if (row.sourceType === 'invoice') {
      return [
        {
          key: 'match',
          label: '关联权责事项',
          children: (
            <DetailSection icon={<FileSearchOutlined />} title="可关联权责事项">
              <CompactDetailTable<BusinessCandidateRow>
                columns={businessCandidateColumns}
                dataSource={businessCandidates}
                emptyText="暂无可关联权责事项"
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedCandidateIds,
                  onChange: (selectedRowKeys) => handleSelectCandidates(selectedRowKeys.map(String))
                }}
                scrollX={860}
              />
              {renderSelectedMatchConfirm(() => handleSaveInvoiceToBusiness(row))}
            </DetailSection>
          )
        },
        {
          key: 'current',
          label: '当前关联',
          children: (
            <DetailSection icon={<LinkOutlined />} title="当前关联">
              <CompactDetailTable<InvoiceCurrentBusinessMatchRow>
                columns={currentBusinessColumns}
                dataSource={currentBusinessMatches}
                emptyText="暂无当前关联"
                rowKey="id"
                scrollX={620}
              />
            </DetailSection>
          )
        },
        {
          key: 'invoice',
          label: '发票信息',
          children: (
            <DetailSection icon={<FileTextOutlined />} title="发票信息">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '发票号', value: row.invoice.invoiceNo },
                  { label: '对象', value: row.invoice.counterparty },
                  { label: '发票方向', value: renderDirection(row.invoice.direction) },
                  { label: '发票日期', value: row.invoice.invoiceDate },
                  { label: '开票月份', value: row.invoice.accountingPeriod },
                  { label: '来源文件', value: row.invoice.sourceFile }
                ]}
              />
            </DetailSection>
          )
        }
      ];
    }

    if (row.sourceType === 'business') {
      return [
        {
          key: 'match',
          label: '关联发票/票据',
          children: (
            <DetailSection icon={<FileSearchOutlined />} title="可关联发票/票据">
              <CompactDetailTable<InvoiceCandidateRow>
                columns={invoiceCandidateColumns}
                dataSource={invoiceCandidates}
                emptyText="暂无可关联发票/票据"
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedCandidateIds,
                  onChange: (selectedRowKeys) => handleSelectCandidates(selectedRowKeys.map(String))
                }}
                scrollX={860}
              />
              {renderSelectedMatchConfirm(() => handleSaveBusinessToInvoices(row))}
            </DetailSection>
          )
        },
        {
          key: 'current',
          label: '当前关联',
          children: (
            <DetailSection icon={<LinkOutlined />} title="当前关联">
              <CompactDetailTable<BusinessCurrentInvoiceMatchRow>
                columns={currentInvoiceColumns}
                dataSource={currentInvoiceMatches}
                emptyText="暂无当前关联"
                rowKey="id"
                scrollX={620}
              />
            </DetailSection>
          )
        },
        {
          key: 'business',
          label: '权责事项',
          children: (
            <DetailSection icon={<WalletOutlined />} title="权责事项">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '事项单号', value: row.businessRecord.documentNo },
                  { label: '对象', value: row.businessRecord.counterparty },
                  { label: '归属月份', value: row.businessRecord.accountingPeriod },
                  { label: '确认日期', value: row.businessRecord.confirmDate },
                  { label: '收付方向', value: row.businessRecord.direction },
                  { label: '财务类目', value: row.businessRecord.category },
                  { label: '票据口径', value: row.businessRecord.taxBasis.basisSource }
                ]}
              />
            </DetailSection>
          )
        }
      ];
    }

    if (row.sourceType === 'subsequent-invoice') {
      return [
        {
          key: 'subsequent',
          label: '后续开票处理',
          children: (
            <>
              <DetailSection icon={<FileTextOutlined />} title="当前后续发票">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '发票号', value: row.invoice.invoiceNo },
                    { label: '开票对象', value: row.invoice.counterparty },
                    { label: '开票日期', value: row.invoice.invoiceDate },
                    { label: '开票金额', value: formatMoney(row.invoice.totalAmount) },
                    { label: '前期申报期间', value: subsequentDeclaredPeriods.join(' / ') },
                    { label: '本期申报口径', value: '不重复计入本期申报销售额' }
                  ]}
                />
              </DetailSection>
              <DetailSection icon={<WalletOutlined />} title="前期未开票收入">
                <CompactDetailTable<SubsequentInvoiceMatchedTransactionRow>
                  columns={subsequentInvoiceColumns}
                  dataSource={row.subsequentRows}
                  emptyText="暂无前期未开票收入"
                  rowKey="id"
                  scrollX={620}
                />
              </DetailSection>
              <div className="finance-invoice-match-confirm-action">
                <Button
                  data-testid="finance-invoice-matching-confirm-subsequent-button"
                  type="primary"
                  onClick={() => handleConfirmSubsequentInvoice(row)}
                >
                  确认后续开票
                </Button>
              </div>
            </>
          )
        },
        {
          key: 'invoice',
          label: '发票信息',
          children: (
            <DetailSection icon={<FileTextOutlined />} title="发票信息">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '发票号', value: row.invoice.invoiceNo },
                  { label: '对象', value: row.invoice.counterparty },
                  { label: '发票方向', value: renderDirection(row.invoice.direction) },
                  { label: '发票日期', value: row.invoice.invoiceDate },
                  { label: '开票月份', value: row.invoice.accountingPeriod },
                  { label: '来源文件', value: row.invoice.sourceFile }
                ]}
              />
            </DetailSection>
          )
        }
      ];
    }

    return [
      {
        key: 'original',
        label: '原票关联',
        children: (
          <DetailSection icon={<FileSearchOutlined />} title="原票关联">
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '红字发票', value: row.invoice.invoiceNo },
                { label: '开票对象', value: row.invoice.counterparty },
                { label: '开票日期', value: row.invoice.invoiceDate },
                { label: '冲减金额', value: formatMoney(row.invoice.totalAmount) },
                { label: '关联要求', value: '选择对应原蓝字发票' },
                { label: '当前原票', value: activeRedOriginalInvoice?.invoiceNo ?? '待关联' }
              ]}
            />
            <CompactDetailTable<RedOriginalInvoiceCandidateRow>
              columns={redOriginalCandidateColumns}
              dataSource={redOriginalCandidates}
              emptyText="暂无可关联原蓝票"
              rowKey="id"
              rowSelection={{
                type: 'radio',
                getCheckboxProps: (record) => ({
                  disabled: record.isOverLimit
                }),
                selectedRowKeys: selectedCandidateIds,
                onChange: (selectedRowKeys) => handleSelectCandidates(selectedRowKeys.map(String))
              }}
              scrollX={1060}
            />
            <div className="finance-invoice-match-confirm-action">
              <Button onClick={handleClearSelection}>清空选择</Button>
              <Button
                data-testid="finance-invoice-matching-confirm-red-button"
                disabled={selectedCandidateIds.length !== 1}
                type="primary"
                onClick={() => handleConfirmRedOriginal(row)}
              >
                确认原票关联
              </Button>
            </div>
          </DetailSection>
        )
      },
      {
        key: 'red-invoice',
        label: '红冲信息',
        children: (
          <DetailSection icon={<FileTextOutlined />} title="红冲信息">
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '红字发票', value: row.invoice.invoiceNo },
                { label: '对象', value: row.invoice.counterparty },
                { label: '发票方向', value: renderDirection(row.invoice.direction) },
                { label: '开票日期', value: row.invoice.invoiceDate },
                { label: '冲减金额', value: formatMoney(row.invoice.totalAmount) },
                { label: '当前原票', value: activeRedOriginalInvoice?.invoiceNo ?? '待关联' },
                { label: '处理口径', value: '关联原蓝票后计入红冲调整' },
                { label: '来源文件', value: row.invoice.sourceFile }
              ]}
            />
          </DetailSection>
        )
      }
    ];
  }

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<WalletOutlined />} label="待补票税依据" value={taxBasisTodoCount} />
          <MetricCard icon={<FileSearchOutlined />} label="待处理差异" value={discrepancyTodoCount} />
          <MetricCard icon={<LinkOutlined />} label="已匹配" value={matchedTodoCount} />
          <MetricCard icon={<FileTextOutlined />} label="待处理金额" value={formatMoney(pendingAmount)} />
        </MetricGrid>
      }
      pageId="finance-invoice-matching"
    >
      <div className="task-submit-workbench">
        <section className="task-submit-queue-card">
          <div className="task-submit-section-head">
            <div>
              <div className="task-submit-section-title">票税处理队列</div>
              <div className="task-submit-section-meta">{openRows.length} 条待处理 / {matchedTodoCount} 条已匹配</div>
            </div>
          </div>
          <div className="task-submit-card-list">
            {rows.length > 0 ? (
              rows.map((row) => {
                const isActive = activeTodo?.id === row.id;

                return (
                  <button
                    className={isActive ? 'finance-review-queue-row is-active' : 'finance-review-queue-row'}
                    data-testid={`finance-invoice-matching-queue-row-${row.id}`}
                    key={row.id}
                    type="button"
                    onClick={() => setActiveTodoId(row.id)}
                  >
                    <span className="finance-review-queue-row-main">
                      <span className="finance-review-queue-row-title">{row.counterparty}</span>
                      {renderMoney(getTodoQueueAmount(row))}
                    </span>
                    <span className="finance-review-queue-row-sub">
                      <span>{row.sourceNo} / {row.type}</span>
                      <span>{getTodoQueueDate(row)}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty description="暂无票税处理事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </section>

        <section className="task-submit-panel finance-invoice-task-panel" data-testid="finance-invoice-matching-detail-panel">
          {activeTodo ? (
            <>
              <div className="task-submit-panel-header">
                <div>
                  <div className="task-submit-panel-title">{activeTodo.counterparty}</div>
                  <div className="task-submit-panel-sub">
                    {activeTodo.sourceNo} / {activeTodo.type}
                  </div>
                </div>
                <div className="finance-invoice-match-panel-tags">
                  {renderDirection(activeTodo.direction)}
                  {renderWorkflowStatus(activeTodo.status)}
                </div>
              </div>

              <div className="task-submit-panel-body finance-invoice-match-panel-body">
                <DetailSummaryCards
                  columns={4}
                  items={
                    [
                      { icon: <FileSearchOutlined />, key: 'type', label: '处理类型', value: activeTodo.type },
                      { icon: <FileTextOutlined />, key: 'source', label: '单号', value: activeTodo.sourceNo },
                      { icon: <WalletOutlined />, key: 'amount', label: '含税金额', value: formatMoney(activeTodo.amount) },
                      {
                        icon: <LinkOutlined />,
                        key: 'remaining',
                        label: activeTodo.status === '已匹配' ? '已关联' : '待处理',
                        value: formatMoney(activeTodo.status === '已匹配' ? activeTodo.matchedAmount : activeTodo.remainingAmount)
                      }
                    ] satisfies DetailSummaryCardItem[]
                  }
                />
                <DetailTabs
                  defaultActiveKey={
                    activeTodo.sourceType === 'matched-invoice'
                      ? 'current'
                      : activeTodo.sourceType === 'red-invoice'
                      ? 'original'
                      : activeTodo.sourceType === 'subsequent-invoice'
                        ? 'subsequent'
                        : 'match'
                  }
                  key={activeTodo.id}
                  tabTestIdPrefix="finance-invoice-matching-detail-tab"
                  testId="finance-invoice-matching-detail-tabs"
                  items={buildDetailTabs(activeTodo)}
                />
              </div>
            </>
          ) : (
            <div className="task-submit-empty-panel">
              <Empty description="暂无票税处理事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </section>
      </div>
    </ManagementPageScaffold>
  );
}
