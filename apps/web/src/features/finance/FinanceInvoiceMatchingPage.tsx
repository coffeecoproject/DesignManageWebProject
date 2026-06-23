import { FileSearchOutlined, FileTextOutlined, LinkOutlined, RollbackOutlined, WalletOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Button, Select, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import type { FinanceTransactionRecord } from './financeData';
import { type FinanceInvoiceDirection, type FinanceInvoiceRecord } from './financeInvoiceData';
import {
  buildOriginalInvoiceRedSummary,
  buildTransactionInvoiceAssociation,
  getInvoiceMatchedAmount,
  getInvoiceMatchStatus,
  getOriginalInvoiceForRedInvoice,
  getRedInvoiceOriginalAssociationStatus,
  isInvoiceEffective,
  isTransactionInvoiceAssociationRequired
} from './financeInvoiceModel';
import { financeToday, formatMoney, getFinanceTransactionInvoiceDeclarationStatus } from './financeUtils';

type InvoiceMatchingTodoType = '发票待关联流水' | '流水待关联发票' | '红冲待关联原票' | '后续开票待处理';
type InvoiceMatchingTodoStatus = '待处理' | '部分关联' | '待确认原票';
type InvoiceMatchingTodoTypeFilter = '全部' | InvoiceMatchingTodoType;
type InvoiceMatchingDirectionFilter = '全部' | FinanceInvoiceDirection;
type InvoiceMatchingPeriodFilter = '全部' | string;
type InvoiceMatchingStatusFilter = '全部' | InvoiceMatchingTodoStatus;

type InvoiceMatchingFilters = {
  direction: InvoiceMatchingDirectionFilter;
  keyword: string;
  period: InvoiceMatchingPeriodFilter;
  status: InvoiceMatchingStatusFilter;
  type: InvoiceMatchingTodoTypeFilter;
};

type DetailTabItem = Parameters<typeof DetailTabs>[0]['items'][number];

type CashFlowCandidateRow = {
  allocatedAmount: number;
  availableAmount: number;
  id: string;
  matchLabel: '对象一致' | '同方向候选';
  transaction: FinanceTransactionRecord;
};

type InvoiceCandidateRow = {
  availableAmount: number;
  id: string;
  invoice: FinanceInvoiceRecord;
  matchLabel: '对象一致' | '同方向候选';
  matchedAmount: number;
};

type RedOriginalInvoiceCandidateRow = {
  alreadyRedAmount: number;
  availableRedAmount: number;
  currentRedAmount: number;
  id: string;
  isOverLimit: boolean;
  invoice: FinanceInvoiceRecord;
  matchLabel: '对象一致' | '同方向候选';
  remainingAfterCurrentAmount: number;
};

type InvoiceCurrentCashFlowMatchRow = {
  amount: number;
  id: string;
  transaction?: FinanceTransactionRecord;
  transactionNo: string;
};

type SubsequentInvoiceMatchedTransactionRow = {
  amount: number;
  id: string;
  transaction: FinanceTransactionRecord;
};

type TransactionCurrentInvoiceMatchRow = {
  amount: number;
  id: string;
  invoice: FinanceInvoiceRecord;
  matchId: string;
};

type SelectedCashFlowMatchRow = CashFlowCandidateRow & {
  allocationStatus: '全额占用' | '部分占用';
  matchAmount: number;
};

type SelectedInvoiceMatchRow = InvoiceCandidateRow & {
  allocationStatus: '全额占用' | '部分占用';
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
      status: InvoiceMatchingTodoStatus;
      type: '发票待关联流水';
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
      sourceType: 'transaction';
      status: InvoiceMatchingTodoStatus;
      transaction: FinanceTransactionRecord;
      type: '流水待关联发票';
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
      status: '待确认原票';
      type: '红冲待关联原票';
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
      status: '待处理';
      subsequentRows: SubsequentInvoiceMatchedTransactionRow[];
      type: '后续开票待处理';
    };

const defaultFilters: InvoiceMatchingFilters = {
  direction: '全部',
  keyword: '',
  period: '全部',
  status: '全部',
  type: '全部'
};

const invoiceDirectionTone = {
  销项: 'green',
  进项: 'blue'
} as const;

const todoTypeTone = {
  发票待关联流水: 'blue',
  流水待关联发票: 'green',
  红冲待关联原票: 'amber',
  后续开票待处理: 'blue'
} as const satisfies Record<InvoiceMatchingTodoType, 'amber' | 'blue' | 'green'>;

const todoStatusTone = {
  待处理: 'amber',
  部分关联: 'blue',
  待确认原票: 'amber'
} as const satisfies Record<InvoiceMatchingTodoStatus, 'amber' | 'blue'>;

const allocationStatusTone = {
  全额占用: 'green',
  部分占用: 'blue'
} as const;

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function getCashFlowAllocatedAmount(invoice: FinanceInvoiceRecord, amount: number) {
  return invoice.invoiceStatus === '红冲' ? 0 : Math.max(0, amount);
}

function getAllocatedAmountByTransaction(invoices: FinanceInvoiceRecord[]) {
  const allocatedAmountMap = new Map<string, number>();

  invoices.forEach((invoice) => {
    invoice.matchedTransactions.forEach((match) => {
      allocatedAmountMap.set(match.transactionNo, (allocatedAmountMap.get(match.transactionNo) ?? 0) + getCashFlowAllocatedAmount(invoice, match.amount));
    });
  });

  return allocatedAmountMap;
}

function getInvoiceRemainingAmount(invoice: FinanceInvoiceRecord) {
  return Math.max(0, invoice.totalAmount - getInvoiceMatchedAmount(invoice));
}

function getInvoiceDirectionFromTransaction(transaction: FinanceTransactionRecord): FinanceInvoiceDirection {
  return transaction.direction === '收入' ? '销项' : '进项';
}

function isDirectionMatched(invoice: FinanceInvoiceRecord, transaction: FinanceTransactionRecord) {
  if (invoice.direction === '销项') {
    return transaction.direction === '收入' && transaction.counterpartyType === '客户';
  }

  return transaction.direction === '支出' && (transaction.counterpartyType === '供应商' || transaction.counterpartyType === '外协');
}

function buildCashFlowCandidateRows(
  invoice: FinanceInvoiceRecord,
  invoices: FinanceInvoiceRecord[],
  financeRows: FinanceTransactionRecord[]
): CashFlowCandidateRow[] {
  const allocatedAmountMap = getAllocatedAmountByTransaction(invoices);

  return financeRows
    .flatMap((transaction) => {
      if (transaction.accountingPeriod !== invoice.accountingPeriod || transaction.status !== '已入账') {
        return [];
      }

      if (!isDirectionMatched(invoice, transaction)) {
        return [];
      }

      const allocatedAmount = allocatedAmountMap.get(transaction.transactionNo) ?? 0;
      const availableAmount = Number((transaction.amount - allocatedAmount).toFixed(2));

      if (availableAmount <= 0.01) {
        return [];
      }

      return [
        {
          allocatedAmount,
          availableAmount,
          id: `${invoice.id}-${transaction.id}`,
          matchLabel: transaction.counterparty === invoice.counterparty ? '对象一致' : '同方向候选',
          transaction
        } satisfies CashFlowCandidateRow
      ];
    })
    .sort(compareCandidateRows);
}

function buildInvoiceCandidateRows(transaction: FinanceTransactionRecord, invoices: FinanceInvoiceRecord[]): InvoiceCandidateRow[] {
  return invoices
    .flatMap((invoice) => {
      if (invoice.accountingPeriod !== transaction.accountingPeriod || invoice.invoiceStatus !== '正常' || !isInvoiceEffective(invoice)) {
        return [];
      }

      if (!isDirectionMatched(invoice, transaction)) {
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
          id: `${transaction.id}-${invoice.id}`,
          invoice,
          matchLabel: transaction.counterparty === invoice.counterparty ? '对象一致' : '同方向候选',
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
          matchLabel: invoice.counterparty === redInvoice.counterparty ? '对象一致' : '同方向候选',
          remainingAfterCurrentAmount: redSummary.remainingAfterCurrentAmount
        } satisfies RedOriginalInvoiceCandidateRow
      ];
    })
    .sort(compareRedOriginalCandidateRows);
}

function compareCandidateRows(left: CashFlowCandidateRow, right: CashFlowCandidateRow) {
  if (left.matchLabel !== right.matchLabel) {
    return left.matchLabel === '对象一致' ? -1 : 1;
  }

  return left.transaction.occurredAt.localeCompare(right.transaction.occurredAt);
}

function compareInvoiceCandidateRows(left: InvoiceCandidateRow, right: InvoiceCandidateRow) {
  if (left.matchLabel !== right.matchLabel) {
    return left.matchLabel === '对象一致' ? -1 : 1;
  }

  return left.invoice.invoiceDate.localeCompare(right.invoice.invoiceDate);
}

function compareRedOriginalCandidateRows(left: RedOriginalInvoiceCandidateRow, right: RedOriginalInvoiceCandidateRow) {
  if (left.matchLabel !== right.matchLabel) {
    return left.matchLabel === '对象一致' ? -1 : 1;
  }

  return right.invoice.invoiceDate.localeCompare(left.invoice.invoiceDate);
}

function buildCurrentCashFlowMatchRows(
  invoice: FinanceInvoiceRecord,
  transactionByNo: Map<string, FinanceTransactionRecord>
): InvoiceCurrentCashFlowMatchRow[] {
  return invoice.matchedTransactions.map((match) => ({
    amount: match.amount,
    id: match.id,
    transaction: transactionByNo.get(match.transactionNo),
    transactionNo: match.transactionNo
  }));
}

function buildCurrentInvoiceMatchRows(transaction: FinanceTransactionRecord, invoices: FinanceInvoiceRecord[]): TransactionCurrentInvoiceMatchRow[] {
  return invoices.flatMap((invoice) =>
    invoice.matchedTransactions
      .filter((match) => match.transactionNo === transaction.transactionNo)
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

function buildSelectedCashFlowRows(
  candidates: CashFlowCandidateRow[],
  candidateIds: string[],
  remainingAmount: number
): SelectedCashFlowMatchRow[] {
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
        allocationStatus: candidate.availableAmount - matchAmount > 0.01 ? '部分占用' : '全额占用',
        matchAmount
      } satisfies SelectedCashFlowMatchRow
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
        allocationStatus: candidate.availableAmount - matchAmount > 0.01 ? '部分占用' : '全额占用',
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
  financeRows: FinanceTransactionRecord[]
): InvoiceMatchingTodoRow[] {
  const financeRowByNo = new Map(financeRows.map((financeRow) => [financeRow.transactionNo, financeRow]));
  const invoiceTodos = invoices
    .filter((invoice) => isInvoiceEffective(invoice) && invoice.invoiceStatus === '正常' && getInvoiceMatchStatus(invoice) !== '已匹配')
    .map((invoice) => {
      const matchedAmount = getInvoiceMatchedAmount(invoice);
      const remainingAmount = getInvoiceRemainingAmount(invoice);

      return {
        amount: invoice.totalAmount,
        candidateCount: buildCashFlowCandidateRows(invoice, invoices, financeRows).length,
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
        status: matchedAmount > 0 ? '部分关联' : '待处理',
        type: '发票待关联流水'
      } satisfies InvoiceMatchingTodoRow;
    });
  const subsequentInvoiceTodos = invoices
    .filter((invoice) => isInvoiceEffective(invoice) && invoice.invoiceStatus === '正常' && getInvoiceMatchStatus(invoice) === '已匹配')
    .flatMap((invoice) => {
      const subsequentRows = invoice.matchedTransactions.flatMap((match): SubsequentInvoiceMatchedTransactionRow[] => {
        const financeRow = financeRowByNo.get(match.transactionNo);

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
          status: '待处理',
          subsequentRows,
          type: '后续开票待处理'
        } satisfies InvoiceMatchingTodoRow
      ];
    });
  const transactionTodos = financeRows
    .filter((transaction) => transaction.status === '已入账' && isTransactionInvoiceAssociationRequired(transaction))
    .flatMap((transaction) => {
      const association = buildTransactionInvoiceAssociation(transaction, invoices);

      if (association.status === '已关联') {
        return [];
      }

      return [
        {
          amount: association.requiredAmount,
          candidateCount: buildInvoiceCandidateRows(transaction, invoices).length,
          counterparty: transaction.counterparty,
          direction: getInvoiceDirectionFromTransaction(transaction),
          id: `transaction-todo-${transaction.id}`,
          latestDate: transaction.occurredAt,
          matchedAmount: association.matchedAmount,
          period: transaction.accountingPeriod,
          remainingAmount: association.remainingAmount,
          sourceNo: transaction.transactionNo,
          sourceType: 'transaction',
          status: association.status === '部分关联' ? '部分关联' : '待处理',
          transaction,
          type: '流水待关联发票'
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
        status: '待确认原票',
        type: '红冲待关联原票'
      } satisfies InvoiceMatchingTodoRow;
    });

  return [...invoiceTodos, ...subsequentInvoiceTodos, ...transactionTodos, ...redInvoiceTodos].sort((left, right) => right.latestDate.localeCompare(left.latestDate));
}

function matchesFilters(row: InvoiceMatchingTodoRow, filters: InvoiceMatchingFilters) {
  const keyword = normalizeKeyword(filters.keyword);
  const typeMatched = filters.type === '全部' || row.type === filters.type;
  const periodMatched = filters.period === '全部' || row.period === filters.period;
  const directionMatched = filters.direction === '全部' || row.direction === filters.direction;
  const statusMatched = filters.status === '全部' || row.status === filters.status;
  const keywordMatched =
    !keyword ||
    [row.period, row.direction, row.counterparty, row.sourceNo, row.type, row.status]
      .join(' ')
      .toLowerCase()
      .includes(keyword);

  return typeMatched && periodMatched && directionMatched && statusMatched && keywordMatched;
}

function renderMoney(amount: number) {
  return <CellText tone={amount < 0 ? 'expense' : amount > 0 ? 'strong' : 'subtle'}>{formatMoney(amount)}</CellText>;
}

function renderDirection(direction: FinanceInvoiceDirection) {
  return <StatusTag toneMap={invoiceDirectionTone} value={direction} />;
}

function renderTodoType(type: InvoiceMatchingTodoType) {
  return <StatusTag toneMap={todoTypeTone} value={type} />;
}

function renderTodoStatus(status: InvoiceMatchingTodoStatus) {
  return <StatusTag toneMap={todoStatusTone} value={status} />;
}

function renderAllocationStatus(status: SelectedCashFlowMatchRow['allocationStatus'] | SelectedInvoiceMatchRow['allocationStatus']) {
  return <StatusTag toneMap={allocationStatusTone} value={status} />;
}

function DrawerTitle({ row }: { row: InvoiceMatchingTodoRow }) {
  return (
    <DetailDrawerTitle
      status={row.status}
      statusTone={todoStatusTone[row.status]}
      subtitle={`${row.direction} / ${row.period}`}
      title={row.type}
    />
  );
}

export function FinanceInvoiceMatchingPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { financeRows, invoiceRows, updateFinanceTransactionsByNo, updateInvoiceRecord } = useFinanceManagement();
  const [filters, setFilters] = useState<InvoiceMatchingFilters>(defaultFilters);
  const [activeTodoId, setActiveTodoId] = useState<string | undefined>();
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  const transactionByNo = useMemo(() => new Map(financeRows.map((record) => [record.transactionNo, record])), [financeRows]);
  const matchingTodos = useMemo(
    () => buildInvoiceMatchingTodos(invoiceRows, financeRows),
    [financeRows, invoiceRows]
  );
  const rows = useMemo(() => matchingTodos.filter((row) => matchesFilters(row, filters)), [filters, matchingTodos]);
  const activeTodo = useMemo(() => matchingTodos.find((row) => row.id === activeTodoId), [activeTodoId, matchingTodos]);
  const periodOptions = useMemo(() => ['全部', ...Array.from(new Set(matchingTodos.map((row) => row.period)))], [matchingTodos]);
  const cashFlowCandidates = useMemo(
    () => (activeTodo?.sourceType === 'invoice' ? buildCashFlowCandidateRows(activeTodo.invoice, invoiceRows, financeRows) : []),
    [activeTodo, financeRows, invoiceRows]
  );
  const invoiceCandidates = useMemo(
    () => (activeTodo?.sourceType === 'transaction' ? buildInvoiceCandidateRows(activeTodo.transaction, invoiceRows) : []),
    [activeTodo, invoiceRows]
  );
  const redOriginalCandidates = useMemo(
    () => (activeTodo?.sourceType === 'red-invoice' ? buildRedOriginalInvoiceCandidates(activeTodo.invoice, invoiceRows) : []),
    [activeTodo, invoiceRows]
  );
  const activeRedOriginalInvoice = activeTodo?.sourceType === 'red-invoice'
    ? getOriginalInvoiceForRedInvoice(activeTodo.invoice, invoiceRows)
    : undefined;
  const currentCashFlowMatches = activeTodo?.sourceType === 'invoice' ? buildCurrentCashFlowMatchRows(activeTodo.invoice, transactionByNo) : [];
  const currentInvoiceMatches = activeTodo?.sourceType === 'transaction' ? buildCurrentInvoiceMatchRows(activeTodo.transaction, invoiceRows) : [];
  const selectedCashFlowRows = useMemo<SelectedCashFlowMatchRow[]>(
    () => (activeTodo?.sourceType === 'invoice' ? buildSelectedCashFlowRows(cashFlowCandidates, selectedCandidateIds, activeTodo.remainingAmount) : []),
    [activeTodo, cashFlowCandidates, selectedCandidateIds]
  );
  const selectedInvoiceRows = useMemo<SelectedInvoiceMatchRow[]>(
    () => (activeTodo?.sourceType === 'transaction' ? buildSelectedInvoiceRows(invoiceCandidates, selectedCandidateIds, activeTodo.remainingAmount) : []),
    [activeTodo, invoiceCandidates, selectedCandidateIds]
  );
  const selectedMatchRows = activeTodo?.sourceType === 'transaction' ? selectedInvoiceRows : selectedCashFlowRows;
  const selectedMatchTotal = selectedMatchRows.reduce((total, row) => total + row.matchAmount, 0);
  const selectedAfterRemaining = (activeTodo?.remainingAmount ?? 0) - selectedMatchTotal;
  const selectedMatchOverLimit = selectedMatchTotal - (activeTodo?.remainingAmount ?? 0) > 0.01;
  const invoiceTodoCount = rows.filter((row) => row.sourceType === 'invoice').length;
  const transactionTodoCount = rows.filter((row) => row.sourceType === 'transaction').length;
  const redTodoCount = rows.filter((row) => row.sourceType === 'red-invoice').length;
  const pendingAmount = rows.reduce((total, row) => total + row.remainingAmount, 0);
  const subsequentDeclaredPeriods = activeTodo?.sourceType === 'subsequent-invoice'
    ? Array.from(new Set(activeTodo.subsequentRows.map((currentRow) => currentRow.transaction.invoiceDeclarationPeriod ?? currentRow.transaction.accountingPeriod)))
    : [];

  useEffect(() => {
    setSelectedCandidateIds([]);
  }, [activeTodoId]);

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
          new Map(cashFlowCandidates.map((candidate) => [candidate.id, candidate.availableAmount])),
          activeTodo.remainingAmount
        )
      );
      return;
    }

    if (activeTodo?.sourceType === 'transaction') {
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

  function handleSaveInvoiceToCashFlows(row: Extract<InvoiceMatchingTodoRow, { sourceType: 'invoice' }>) {
    if (selectedCashFlowRows.length === 0) {
      void messageApi.warning('请选择需要关联的流水');
      return;
    }

    if (selectedMatchTotal - row.remainingAmount > 0.01) {
      void messageApi.warning('本次占用金额不能超过发票待关联金额');
      return;
    }

    updateInvoiceMatch(row.invoice.id, (invoice) => ({
      ...invoice,
      matchedTransactions: selectedCashFlowRows.reduce((matches, selectedRow) => {
        const existingMatchIndex = matches.findIndex((match) => match.transactionNo === selectedRow.transaction.transactionNo);

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
            id: `invoice-match-${invoice.id}-${selectedRow.transaction.id}-${Date.now()}`,
            transactionNo: selectedRow.transaction.transactionNo
          }
        ];
      }, invoice.matchedTransactions)
    }));
    setActiveTodoId(undefined);
    handleClearSelection();
    void messageApi.success(`已保存 ${selectedCashFlowRows.length} 条关联关系`);
  }

  function handleSaveTransactionToInvoices(row: Extract<InvoiceMatchingTodoRow, { sourceType: 'transaction' }>) {
    if (selectedInvoiceRows.length === 0) {
      void messageApi.warning('请选择需要关联的发票');
      return;
    }

    if (selectedMatchTotal - row.remainingAmount > 0.01) {
      void messageApi.warning('本次占用金额不能超过流水待关联金额');
      return;
    }

    selectedInvoiceRows.forEach((selectedRow) => {
      updateInvoiceMatch(selectedRow.invoice.id, (invoice) => ({
        ...invoice,
        matchedTransactions: [
          ...invoice.matchedTransactions,
          {
            amount: Number(selectedRow.matchAmount.toFixed(2)),
            id: `invoice-match-${invoice.id}-${row.transaction.id}-${Date.now()}`,
            transactionNo: row.transaction.transactionNo
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
      matchedTransactions: invoice.matchedTransactions.filter((match) => match.id !== matchId)
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
      matchedTransactions: [],
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

  const columns: TableColumnsType<InvoiceMatchingTodoRow> = [
    {
      title: '待办事项',
      dataIndex: 'type',
      width: 210,
      render: (_: InvoiceMatchingTodoType, record) => <CompactCell primarySlot={renderTodoType(record.type)} secondary={record.sourceNo} />
    },
    {
      title: '对象',
      dataIndex: 'counterparty',
      width: 160,
      render: (counterparty: string, record) => <CompactCell primary={counterparty} secondary={record.period} />
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 88,
      render: renderDirection
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 124,
      render: renderMoney
    },
    {
      title: '已关联',
      dataIndex: 'matchedAmount',
      width: 124,
      render: renderMoney
    },
    {
      title: '待关联',
      dataIndex: 'remainingAmount',
      width: 124,
      render: renderMoney
    },
    {
      title: '候选',
      dataIndex: 'candidateCount',
      width: 92,
      render: (candidateCount: number) => (candidateCount > 0 ? <CellText>{candidateCount} 条</CellText> : <CellText tone="subtle">-</CellText>)
    },
    {
      title: '最近日期',
      dataIndex: 'latestDate',
      width: 118
    },
    {
      title: '处理状态',
      dataIndex: 'status',
      width: 118,
      render: renderTodoStatus
    }
  ];

  const currentCashFlowColumns: TableColumnsType<InvoiceCurrentCashFlowMatchRow> = [
    {
      title: '流水',
      dataIndex: 'transactionNo',
      width: 190,
      render: (transactionNo: string, record) => <CompactCell primary={transactionNo} secondary={record.transaction?.occurredAt ?? '-'} />
    },
    {
      title: '对象',
      dataIndex: ['transaction', 'counterparty'],
      width: 150,
      render: (_: string, record) => record.transaction?.counterparty ?? '-'
    },
    {
      title: '占用金额',
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

  const currentInvoiceColumns: TableColumnsType<TransactionCurrentInvoiceMatchRow> = [
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
      title: '占用金额',
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
      title: '前期流水',
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

  const cashFlowCandidateColumns: TableColumnsType<CashFlowCandidateRow> = [
    {
      title: '流水',
      dataIndex: ['transaction', 'transactionNo'],
      width: 190,
      render: (_: string, record) => <CompactCell primary={record.transaction.transactionNo} secondary={record.transaction.occurredAt} />
    },
    {
      title: '对象',
      dataIndex: ['transaction', 'counterparty'],
      width: 150,
      render: (_: string, record) => record.transaction.counterparty
    },
    {
      title: '流水金额',
      dataIndex: ['transaction', 'amount'],
      width: 120,
      render: renderMoney
    },
    {
      title: '已占用',
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
      render: (matchLabel: CashFlowCandidateRow['matchLabel']) => <StatusTag tone={matchLabel === '对象一致' ? 'green' : 'blue'} value={matchLabel} />
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
      title: '已占用',
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
      render: (matchLabel: InvoiceCandidateRow['matchLabel']) => <StatusTag tone={matchLabel === '对象一致' ? 'green' : 'blue'} value={matchLabel} />
    }
  ];

  const selectedMatchColumns: TableColumnsType<SelectedCashFlowMatchRow | SelectedInvoiceMatchRow> = [
    {
      title: '对象',
      key: 'source',
      width: 220,
      render: (_, record) =>
        'transaction' in record ? (
          <CompactCell primary={record.transaction.transactionNo} secondary={record.transaction.counterparty} />
        ) : (
          <CompactCell primary={record.invoice.invoiceNo} secondary={record.invoice.counterparty} />
        )
    },
    {
      title: '可用金额',
      dataIndex: 'availableAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '本次占用',
      dataIndex: 'matchAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '占用方式',
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
            { label: '待关联金额', value: formatMoney(activeTodo?.remainingAmount ?? 0) },
            { label: '本次占用', value: formatMoney(selectedMatchTotal) },
            { label: selectedMatchOverLimit ? '超出金额' : '剩余金额', value: formatMoney(Math.abs(selectedAfterRemaining)) }
          ]}
        />
        <CompactDetailTable<SelectedCashFlowMatchRow | SelectedInvoiceMatchRow>
          columns={selectedMatchColumns}
          dataSource={selectedMatchRows}
          emptyText="暂无本次占用"
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

  function buildDrawerTabs(row: InvoiceMatchingTodoRow): DetailTabItem[] {
    if (row.sourceType === 'invoice') {
      return [
        {
          key: 'match',
          label: '处理匹配',
          children: (
            <DetailSection icon={<FileSearchOutlined />} title="候选流水">
              <CompactDetailTable<CashFlowCandidateRow>
                columns={cashFlowCandidateColumns}
                dataSource={cashFlowCandidates}
                emptyText="暂无候选流水"
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedCandidateIds,
                  onChange: (selectedRowKeys) => handleSelectCandidates(selectedRowKeys.map(String))
                }}
                scrollX={860}
              />
              {renderSelectedMatchConfirm(() => handleSaveInvoiceToCashFlows(row))}
            </DetailSection>
          )
        },
        {
          key: 'current',
          label: '当前关联',
          children: (
            <DetailSection icon={<LinkOutlined />} title="当前关联">
              <CompactDetailTable<InvoiceCurrentCashFlowMatchRow>
                columns={currentCashFlowColumns}
                dataSource={currentCashFlowMatches}
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
                  { label: '所属月份', value: row.invoice.accountingPeriod },
                  { label: '来源文件', value: row.invoice.sourceFile }
                ]}
              />
            </DetailSection>
          )
        }
      ];
    }

    if (row.sourceType === 'transaction') {
      return [
        {
          key: 'match',
          label: '处理匹配',
          children: (
            <DetailSection icon={<FileSearchOutlined />} title="候选发票">
              <CompactDetailTable<InvoiceCandidateRow>
                columns={invoiceCandidateColumns}
                dataSource={invoiceCandidates}
                emptyText="暂无候选发票"
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedCandidateIds,
                  onChange: (selectedRowKeys) => handleSelectCandidates(selectedRowKeys.map(String))
                }}
                scrollX={860}
              />
              {renderSelectedMatchConfirm(() => handleSaveTransactionToInvoices(row))}
            </DetailSection>
          )
        },
        {
          key: 'current',
          label: '当前关联',
          children: (
            <DetailSection icon={<LinkOutlined />} title="当前关联">
              <CompactDetailTable<TransactionCurrentInvoiceMatchRow>
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
          key: 'transaction',
          label: '流水信息',
          children: (
            <DetailSection icon={<WalletOutlined />} title="流水信息">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '流水号', value: row.transaction.transactionNo },
                  { label: '对象', value: row.transaction.counterparty },
                  { label: '发生日期', value: row.transaction.occurredAt },
                  { label: '收支方向', value: row.transaction.direction },
                  { label: '财务类目', value: row.transaction.category },
                  { label: '复核状态', value: row.transaction.status }
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
                  { label: '所属月份', value: row.invoice.accountingPeriod },
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
              emptyText="暂无候选原蓝票"
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
      feedback={contextHolder}
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="待办类型">
              <Select
                data-testid="finance-invoice-matching-type-filter"
                options={(['全部', '发票待关联流水', '流水待关联发票', '红冲待关联原票', '后续开票待处理'] satisfies InvoiceMatchingTodoTypeFilter[]).map((type) => ({
                  label: type,
                  value: type
                }))}
                value={filters.type}
                onChange={(type) => setFilters((current) => ({ ...current, type }))}
              />
            </FilterField>
            <FilterField label="期间">
              <Select
                data-testid="finance-invoice-matching-period-filter"
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.period}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="发票方向">
              <Select
                data-testid="finance-invoice-matching-direction-filter"
                options={(['全部', '销项', '进项'] satisfies InvoiceMatchingDirectionFilter[]).map((direction) => ({
                  label: direction,
                  value: direction
                }))}
                value={filters.direction}
                onChange={(direction) => setFilters((current) => ({ ...current, direction }))}
              />
            </FilterField>
            <FilterField label="处理状态">
              <Select
                data-testid="finance-invoice-matching-status-filter"
                options={(['全部', '待处理', '部分关联', '待确认原票'] satisfies InvoiceMatchingStatusFilter[]).map((status) => ({
                  label: status,
                  value: status
                }))}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-invoice-matching-keyword-input"
              placeholder="事项 / 对象 / 发票号 / 流水号"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<FileSearchOutlined />} label="待办项" value={rows.length} />
          <MetricCard icon={<FileTextOutlined />} label="发票待关联" value={invoiceTodoCount} />
          <MetricCard icon={<WalletOutlined />} label="流水待关联" value={transactionTodoCount} />
          <MetricCard icon={<RollbackOutlined />} label="红冲待处理" value={redTodoCount} />
          <MetricCard icon={<LinkOutlined />} label="待关联金额" value={formatMoney(pendingAmount)} />
        </MetricGrid>
      }
      pageId="finance-invoice-matching"
    >
      <ManagementTable<InvoiceMatchingTodoRow>
        columns={columns}
        count={{ value: rows.length, unit: '条待办' }}
        dataSource={rows}
        rowKey="id"
        rowTestIdPrefix="finance-invoice-matching-table-row"
        tableTestId="finance-invoice-matching-table"
        onRowClick={(row) => setActiveTodoId(row.id)}
      />

      <DetailDrawerShell
        bodyTestId="finance-invoice-matching-detail-drawer"
        className="finance-invoice-drawer"
        closeAction={{ label: '关闭', testId: 'finance-invoice-matching-close-button', onClick: () => setActiveTodoId(undefined) }}
        open={Boolean(activeTodo)}
        title={activeTodo ? <DrawerTitle row={activeTodo} /> : null}
        width={980}
        onClose={() => setActiveTodoId(undefined)}
      >
        {activeTodo ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={
                [
                  { icon: <FileSearchOutlined />, key: 'type', label: '待办事项', value: activeTodo.type },
                  { icon: <FileTextOutlined />, key: 'source', label: '处理对象', value: activeTodo.sourceNo },
                  { icon: <WalletOutlined />, key: 'amount', label: '事项金额', value: formatMoney(activeTodo.amount) },
                  { icon: <LinkOutlined />, key: 'remaining', label: '待关联', value: formatMoney(activeTodo.remainingAmount) }
                ] satisfies DetailSummaryCardItem[]
              }
            />
            <DetailTabs
              defaultActiveKey={
                activeTodo.sourceType === 'red-invoice'
                  ? 'original'
                  : activeTodo.sourceType === 'subsequent-invoice'
                    ? 'subsequent'
                    : 'match'
              }
              tabTestIdPrefix="finance-invoice-matching-detail-tab"
              testId="finance-invoice-matching-detail-tabs"
              items={buildDrawerTabs(activeTodo)}
            />
          </>
        ) : null}
      </DetailDrawerShell>
    </ManagementPageScaffold>
  );
}
