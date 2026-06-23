import {
  CloudUploadOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  LinkOutlined,
  PercentageOutlined,
  RollbackOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Button, Select, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell, ImportDrawerShell } from '../../components/DrawerShell';
import { FileActionButtons } from '../../components/FileActionButtons';
import { FileSlot, type FileSlotFile } from '../../components/FileSlot';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { createTabbedManagementTableItem, TabbedManagementTable } from '../../components/TabbedManagementTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import type { FinanceTransactionRecord } from './financeData';
import {
  applyDeclarationPreparationSourceState,
  declarationPreparationStatusTone,
  type FinanceDeclarationPreparationRecord,
  type FinanceDeclarationPreparationStatus
} from './financeDeclarationPreparationData';
import {
  financeInvoiceImportBatches,
  type FinanceInvoiceDirection,
  type FinanceInvoiceImportBatch,
  type FinanceInvoiceMatchStatus,
  type FinanceInvoiceRecord,
  type FinanceInvoiceStatus
} from './financeInvoiceData';
import {
  buildOriginalInvoiceRedSummary,
  type FinanceRedInvoiceOriginalAssociationStatus,
  getInvoiceAmount,
  getInvoiceMatchedAmount,
  getInvoiceMatchedTransactionNos,
  getInvoiceMatchStatus,
  getInvoiceTaxAmount,
  getOriginalInvoiceForRedInvoice,
  getRedInvoiceOriginalAssociationStatus,
  isInvoiceEffective,
  isSameMoneyAmount
} from './financeInvoiceModel';
import { financeToday, formatMoney } from './financeUtils';

type InvoicePeriodFilter = '全部' | string;
type InvoiceMatchFilter = '全部' | '有待关联' | '已全部关联';
type InvoiceLedgerView = 'monthly' | 'declaration';

type InvoiceFilters = {
  keyword: string;
  matchStatus: InvoiceMatchFilter;
  period: InvoicePeriodFilter;
};

type InvoiceLedgerRow = {
  accountingPeriod: string;
  direction: FinanceInvoiceDirection;
  id: string;
  importBatches: FinanceInvoiceImportBatch[];
  invoices: FinanceInvoiceRecord[];
  latestImportedAt: string;
  summary: InvoiceDirectionSummary;
};

type InvoiceDirectionSummary = {
  invoiceCount: number;
  matchedCount: number;
  netAmount: number;
  pendingCount: number;
  taxAmount: number;
  totalAmount: number;
};

type InvoiceDeclarationPeriodRow = {
  declarationPeriod: string;
  id: string;
  importBatches: FinanceInvoiceImportBatch[];
  importedMonthCount: number;
  inputAmount: number;
  inputCount: number;
  inputNetAmount: number;
  invoices: FinanceInvoiceRecord[];
  latestImportedAt: string;
  monthRows: InvoiceLedgerRow[];
  months: string[];
  outputAmount: number;
  outputCount: number;
  outputNetAmount: number;
  pendingCount: number;
  preparationRecord?: FinanceDeclarationPreparationRecord;
  redAmount: number;
  redCount: number;
  redNetAmount: number;
};

type InvoiceMatchRelationRow = {
  allocationStatus: '全额占用' | '部分占用';
  id: string;
  invoiceAmount: number;
  invoiceCounterparty: string;
  invoiceId: string;
  invoiceStatus: FinanceInvoiceStatus;
  invoiceNo: string;
  matchedAmount: number;
  transactionAmount?: number;
  transactionCounterparty: string;
  transactionDate: string;
  transactionNo: string;
};

type RedInvoiceOriginalRelationRow = {
  id: string;
  originalInvoice?: FinanceInvoiceRecord;
  redInvoice: FinanceInvoiceRecord;
  redSummary?: ReturnType<typeof buildOriginalInvoiceRedSummary>;
  status: FinanceRedInvoiceOriginalAssociationStatus;
};

type InvoiceMatchSummaryRow = {
  id: string;
  invoice: FinanceInvoiceRecord;
  matchStatus: FinanceInvoiceMatchStatus;
  matchedAmount: number;
  remainingAmount: number;
  relations: InvoiceMatchRelationRow[];
};

type InvoiceImportForm = {
  direction: FinanceInvoiceImportBatch['direction'];
  file?: FileSlotFile;
  period: string;
};

const currentPeriod = financeToday.slice(0, 7);
const currentDeclarationPeriod = getQuarterPeriodFromMonth(currentPeriod);
const defaultFilters: InvoiceFilters = {
  keyword: '',
  matchStatus: '全部',
  period: currentPeriod
};
const defaultImportForm: InvoiceImportForm = {
  direction: '进销项',
  period: currentPeriod
};

const invoiceDirectionTone = {
  销项: 'green',
  进项: 'blue'
} as const;

const invoiceStatusTone = {
  正常: 'green',
  红冲: 'amber',
  作废: 'gray'
} as const satisfies Record<FinanceInvoiceStatus, 'amber' | 'blue' | 'gray' | 'green' | 'red'>;

const invoiceMatchStatusTone = {
  已匹配: 'green',
  部分匹配: 'blue',
  未匹配: 'amber'
} as const satisfies Record<FinanceInvoiceMatchStatus, 'amber' | 'blue' | 'gray' | 'green' | 'red'>;

const invoiceRelationStatusText = {
  已匹配: '已关联',
  部分匹配: '部分关联',
  未匹配: '未关联'
} as const satisfies Record<FinanceInvoiceMatchStatus, string>;

const invoiceAllocationStatusTone = {
  全额占用: 'green',
  部分占用: 'blue'
} as const;

const redOriginalAssociationTone = {
  已关联原票: 'green',
  待关联原票: 'amber'
} as const satisfies Record<FinanceRedInvoiceOriginalAssociationStatus, 'amber' | 'green'>;

const declarationStatusFallbackTone = {
  未生成: 'gray'
} as const;

function getQuarterPeriodFromMonth(accountingPeriod: string) {
  const [year, monthText] = accountingPeriod.split('-');
  const month = Number(monthText);

  if (!year || !Number.isFinite(month) || month < 1 || month > 12) {
    return accountingPeriod;
  }

  return `${year}-Q${Math.ceil(month / 3)}`;
}

function getQuarterMonthPeriods(period: string) {
  const quarterMatch = period.match(/^(\d{4})-Q([1-4])$/);

  if (!quarterMatch) {
    return [period];
  }

  const [, year, quarterText] = quarterMatch;
  const quarter = Number(quarterText);
  const startMonth = (quarter - 1) * 3 + 1;

  return [0, 1, 2].map((offset) => `${year}-${String(startMonth + offset).padStart(2, '0')}`);
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function isInvoiceAssociationComplete(record: FinanceInvoiceRecord) {
  if (record.invoiceStatus === '红冲') {
    return getRedInvoiceOriginalAssociationStatus(record) === '已关联原票';
  }

  return getInvoiceMatchStatus(record) === '已匹配';
}

function getDirectionSummary(records: FinanceInvoiceRecord[]): InvoiceDirectionSummary {
  const effectiveRecords = records.filter(isInvoiceEffective);
  return {
    invoiceCount: records.length,
    matchedCount: effectiveRecords.filter(isInvoiceAssociationComplete).length,
    netAmount: effectiveRecords.reduce((total, record) => total + record.taxExcludedAmount, 0),
    pendingCount: effectiveRecords.filter((record) => !isInvoiceAssociationComplete(record)).length,
    taxAmount: effectiveRecords.reduce((total, record) => total + getInvoiceTaxAmount(record), 0),
    totalAmount: effectiveRecords.reduce((total, record) => total + getInvoiceAmount(record), 0)
  };
}

function buildInvoiceLedgerRows(records: FinanceInvoiceRecord[], importBatches: FinanceInvoiceImportBatch[]) {
  const rowsByPeriod = new Map<string, FinanceInvoiceRecord[]>();

  records.forEach((record) => {
    const rows = rowsByPeriod.get(record.accountingPeriod) ?? [];
    rows.push(record);
    rowsByPeriod.set(record.accountingPeriod, rows);
  });

  return Array.from(rowsByPeriod.entries())
    .flatMap(([accountingPeriod, invoices]) => {
      const directions: FinanceInvoiceDirection[] = ['销项', '进项'];

      return directions.flatMap((direction) => {
        const directionInvoices = invoices.filter((invoice) => invoice.direction === direction);
        const directionBatches = importBatches.filter(
          (batch) => batch.accountingPeriod === accountingPeriod && (batch.direction === direction || batch.direction === '进销项')
        );

        if (directionInvoices.length === 0 && directionBatches.length === 0) {
          return [];
        }

        const latestImportedAt = [
          ...directionInvoices.map((invoice) => invoice.importedAt),
          ...directionBatches.map((batch) => batch.importedAt)
        ]
          .filter(Boolean)
          .sort((left, right) => right.localeCompare(left))[0];

        return [
          {
            accountingPeriod,
            direction,
            id: `${accountingPeriod}-${direction}`,
            importBatches: directionBatches,
            invoices: directionInvoices,
            latestImportedAt: latestImportedAt ?? '-',
            summary: getDirectionSummary(directionInvoices)
          }
        ];
      });
    })
    .sort((left, right) => {
      const periodSort = right.accountingPeriod.localeCompare(left.accountingPeriod);
      if (periodSort !== 0) return periodSort;
      return left.direction === '销项' ? -1 : 1;
    });
}

function buildInvoiceDeclarationPeriodRows(
  records: FinanceInvoiceRecord[],
  importBatches: FinanceInvoiceImportBatch[],
  monthRows: InvoiceLedgerRow[],
  preparationRecords: FinanceDeclarationPreparationRecord[]
) {
  const declarationPeriods = new Set<string>();

  records.forEach((record) => declarationPeriods.add(getQuarterPeriodFromMonth(record.accountingPeriod)));
  importBatches.forEach((batch) => declarationPeriods.add(getQuarterPeriodFromMonth(batch.accountingPeriod)));
  preparationRecords
    .filter((record) => record.taxType === '增值税及附加' && record.periodType === '季度')
    .forEach((record) => declarationPeriods.add(record.period));

  return Array.from(declarationPeriods)
    .map((declarationPeriod): InvoiceDeclarationPeriodRow => {
      const months = getQuarterMonthPeriods(declarationPeriod);
      const monthSet = new Set(months);
      const periodInvoices = records.filter((record) => monthSet.has(record.accountingPeriod) && isInvoiceEffective(record));
      const periodImportBatches = importBatches.filter((batch) => monthSet.has(batch.accountingPeriod));
      const periodMonthRows = monthRows.filter((row) => monthSet.has(row.accountingPeriod));
      const outputInvoices = periodInvoices.filter((invoice) => invoice.direction === '销项' && invoice.invoiceStatus === '正常');
      const inputInvoices = periodInvoices.filter((invoice) => invoice.direction === '进项' && invoice.invoiceStatus === '正常');
      const redInvoices = periodInvoices.filter((invoice) => invoice.invoiceStatus === '红冲');
      const pendingCount = periodInvoices.filter((invoice) => !isInvoiceAssociationComplete(invoice)).length;
      const latestImportedAt = [
        ...periodInvoices.map((invoice) => invoice.importedAt),
        ...periodImportBatches.map((batch) => batch.importedAt)
      ]
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left))[0];

      return {
        declarationPeriod,
        id: declarationPeriod,
        importBatches: periodImportBatches,
        importedMonthCount: new Set(periodImportBatches.map((batch) => batch.accountingPeriod)).size,
        inputAmount: inputInvoices.reduce((total, invoice) => total + getInvoiceAmount(invoice), 0),
        inputCount: inputInvoices.length,
        inputNetAmount: inputInvoices.reduce((total, invoice) => total + invoice.taxExcludedAmount, 0),
        invoices: periodInvoices,
        latestImportedAt: latestImportedAt ?? '-',
        monthRows: periodMonthRows,
        months,
        outputAmount: outputInvoices.reduce((total, invoice) => total + getInvoiceAmount(invoice), 0),
        outputCount: outputInvoices.length,
        outputNetAmount: outputInvoices.reduce((total, invoice) => total + invoice.taxExcludedAmount, 0),
        pendingCount,
        preparationRecord: preparationRecords.find((record) => record.period === declarationPeriod && record.taxType === '增值税及附加'),
        redAmount: redInvoices.reduce((total, invoice) => total + getInvoiceAmount(invoice), 0),
        redCount: redInvoices.length,
        redNetAmount: redInvoices.reduce((total, invoice) => total + invoice.taxExcludedAmount, 0)
      };
    })
    .sort((left, right) => right.declarationPeriod.localeCompare(left.declarationPeriod));
}

function getPendingCount(row: InvoiceLedgerRow) {
  return row.summary.pendingCount;
}

function getDeclarationPendingText(row: InvoiceDeclarationPeriodRow) {
  return row.pendingCount > 0 ? `待关联 ${row.pendingCount}` : '已关联';
}

function getDeclarationPendingTone(row: InvoiceDeclarationPeriodRow) {
  return row.pendingCount > 0 ? 'amber' : 'green';
}

function getDeclarationPreparationStatusText(row: InvoiceDeclarationPeriodRow) {
  return row.preparationRecord?.status ?? '未生成';
}

function getDeclarationPreparationStatusTone(row: InvoiceDeclarationPeriodRow) {
  const status = getDeclarationPreparationStatusText(row);

  return status === '未生成' ? declarationStatusFallbackTone[status] : declarationPreparationStatusTone[status as FinanceDeclarationPreparationStatus];
}

function getMatchText(summary: InvoiceDirectionSummary) {
  if (summary.invoiceCount === 0) {
    return '无发票';
  }

  if (summary.pendingCount === 0) {
    return `已关联 ${summary.matchedCount}/${summary.invoiceCount}`;
  }

  return `待关联 ${summary.pendingCount}`;
}

function getMatchTone(summary: InvoiceDirectionSummary) {
  if (summary.invoiceCount === 0) return 'gray';
  if (summary.pendingCount === 0) return 'green';
  return 'amber';
}

function matchesKeyword(row: InvoiceLedgerRow, keyword: string) {
  if (!keyword) {
    return true;
  }

  return row.invoices.some((invoice) =>
    [
      row.accountingPeriod,
      invoice.counterparty,
      invoice.invoiceNo,
      invoice.sourceFile,
      invoice.direction,
      invoice.invoiceStatus,
      invoice.invoiceStatus === '红冲' ? getRedInvoiceOriginalAssociationStatus(invoice) : getInvoiceMatchStatus(invoice),
      invoice.originalInvoiceId ?? '',
      ...getInvoiceMatchedTransactionNos(invoice)
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  );
}

function matchesFilters(row: InvoiceLedgerRow, filters: InvoiceFilters) {
  const keyword = normalizeKeyword(filters.keyword);
  const periodMatched = filters.period === '全部' || row.accountingPeriod === filters.period;
  const keywordMatched = matchesKeyword(row, keyword);
  const pendingCount = getPendingCount(row);
  const statusMatched =
    filters.matchStatus === '全部' ||
    (filters.matchStatus === '有待关联' && pendingCount > 0) ||
    (filters.matchStatus === '已全部关联' && pendingCount === 0);

  return periodMatched && keywordMatched && statusMatched;
}

function matchesDeclarationFilters(row: InvoiceDeclarationPeriodRow, filters: InvoiceFilters) {
  const keyword = normalizeKeyword(filters.keyword);
  const periodMatched = filters.period === '全部' || row.declarationPeriod === filters.period;
  const statusMatched =
    filters.matchStatus === '全部' ||
    (filters.matchStatus === '有待关联' && row.pendingCount > 0) ||
    (filters.matchStatus === '已全部关联' && row.pendingCount === 0);
  const keywordMatched =
    !keyword ||
    [
      row.declarationPeriod,
      row.months.join(' '),
      getDeclarationPreparationStatusText(row),
      row.invoices.map((invoice) => `${invoice.invoiceNo} ${invoice.counterparty} ${invoice.sourceFile}`).join(' ')
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword);

  return periodMatched && statusMatched && keywordMatched;
}

function buildInvoiceMatchRelationRows(row: InvoiceLedgerRow, transactionByNo: Map<string, FinanceTransactionRecord>): InvoiceMatchRelationRow[] {
  return row.invoices.flatMap((invoice) =>
    invoice.invoiceStatus === '红冲' ? [] : invoice.matchedTransactions.map((match) => {
      const transaction = transactionByNo.get(match.transactionNo);
      const allocationStatus =
        transaction && isSameMoneyAmount(Math.abs(match.amount), Math.abs(transaction.amount))
            ? '全额占用'
            : '部分占用';

      return {
        allocationStatus,
        id: match.id,
        invoiceAmount: invoice.totalAmount,
        invoiceCounterparty: invoice.counterparty,
        invoiceId: invoice.id,
        invoiceStatus: invoice.invoiceStatus,
        invoiceNo: invoice.invoiceNo,
        matchedAmount: match.amount,
        transactionAmount: transaction?.amount,
        transactionCounterparty: transaction?.counterparty ?? '-',
        transactionDate: transaction?.occurredAt ?? '-',
        transactionNo: match.transactionNo
      };
    })
  );
}

function buildInvoiceMatchSummaryRows(row: InvoiceLedgerRow, relationRows: InvoiceMatchRelationRow[]): InvoiceMatchSummaryRow[] {
  return row.invoices.filter((invoice) => invoice.invoiceStatus !== '红冲').map((invoice) => {
    const matchedAmount = getInvoiceMatchedAmount(invoice);

    return {
      id: invoice.id,
      invoice,
      matchedAmount,
      matchStatus: getInvoiceMatchStatus(invoice),
      remainingAmount: invoice.totalAmount - matchedAmount,
      relations: relationRows.filter((relation) => relation.invoiceId === invoice.id)
    };
  });
}

function buildRedOriginalRelationRows(row: InvoiceLedgerRow, invoices: FinanceInvoiceRecord[]): RedInvoiceOriginalRelationRow[] {
  return row.invoices
    .filter((invoice) => invoice.invoiceStatus === '红冲')
    .map((redInvoice) => {
      const originalInvoice = getOriginalInvoiceForRedInvoice(redInvoice, invoices);

      return {
        id: redInvoice.id,
        originalInvoice,
        redInvoice,
        redSummary: originalInvoice ? buildOriginalInvoiceRedSummary(originalInvoice, invoices, redInvoice) : undefined,
        status: getRedInvoiceOriginalAssociationStatus(redInvoice)
      };
    });
}

function renderMoney(amount: number) {
  return <CellText tone={amount < 0 ? 'expense' : amount > 0 ? 'strong' : 'subtle'}>{formatMoney(amount)}</CellText>;
}

function renderOptionalMoney(amount?: number) {
  return amount === undefined ? <CellText tone="subtle">-</CellText> : renderMoney(amount);
}

function renderRelationStatus(status: FinanceInvoiceMatchStatus) {
  return <StatusTag tone={invoiceMatchStatusTone[status]} value={invoiceRelationStatusText[status]} />;
}

function renderInvoiceAssociationStatus(record: FinanceInvoiceRecord) {
  if (record.invoiceStatus === '红冲') {
    const status = getRedInvoiceOriginalAssociationStatus(record);

    return <StatusTag toneMap={redOriginalAssociationTone} value={status} />;
  }

  return renderRelationStatus(getInvoiceMatchStatus(record));
}

function renderAllocationStatus(status: InvoiceMatchRelationRow['allocationStatus']) {
  return <StatusTag toneMap={invoiceAllocationStatusTone} value={status} />;
}

function DrawerTitle({ row }: { row: InvoiceLedgerRow }) {
  const pendingCount = getPendingCount(row);

  return (
    <DetailDrawerTitle
      status={pendingCount > 0 ? `${pendingCount} 条待关联` : '已关联'}
      statusTone={pendingCount > 0 ? 'amber' : 'green'}
      subtitle={`${row.direction} / ${row.summary.invoiceCount} 份发票`}
      title={`${row.accountingPeriod} ${row.direction}发票`}
    />
  );
}

export function FinanceInvoicesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    clearInvoiceMatches,
    declarationPreparationRows,
    financeRows,
    invoiceRows: invoiceRecordRows,
    updateInvoiceRecord
  } = useFinanceManagement();
  const [activeView, setActiveView] = useState<InvoiceLedgerView>('monthly');
  const [filters, setFilters] = useState<InvoiceFilters>(defaultFilters);
  const [activeRowId, setActiveRowId] = useState<string | undefined>();
  const [activeDeclarationRowId, setActiveDeclarationRowId] = useState<string | undefined>();
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [importForm, setImportForm] = useState<InvoiceImportForm>(defaultImportForm);

  const invoiceRows = useMemo(() => buildInvoiceLedgerRows(invoiceRecordRows, financeInvoiceImportBatches), [invoiceRecordRows]);
  const transactionByNo = useMemo(() => new Map(financeRows.map((record) => [record.transactionNo, record])), [financeRows]);
  const displayDeclarationPreparationRows = useMemo(
    () => applyDeclarationPreparationSourceState(declarationPreparationRows, invoiceRecordRows, financeRows),
    [declarationPreparationRows, financeRows, invoiceRecordRows]
  );
  const declarationRows = useMemo(
    () => buildInvoiceDeclarationPeriodRows(invoiceRecordRows, financeInvoiceImportBatches, invoiceRows, displayDeclarationPreparationRows),
    [displayDeclarationPreparationRows, invoiceRecordRows, invoiceRows]
  );
  const monthlyRows = useMemo(() => invoiceRows.filter((row) => matchesFilters(row, filters)), [filters, invoiceRows]);
  const filteredDeclarationRows = useMemo(
    () => declarationRows.filter((row) => matchesDeclarationFilters(row, filters)),
    [declarationRows, filters]
  );
  const activeRow = useMemo(() => invoiceRows.find((row) => row.id === activeRowId), [activeRowId, invoiceRows]);
  const activeDeclarationRow = useMemo(
    () => declarationRows.find((row) => row.id === activeDeclarationRowId),
    [activeDeclarationRowId, declarationRows]
  );
  const monthlyPeriodOptions = useMemo(() => ['全部', ...Array.from(new Set(invoiceRows.map((row) => row.accountingPeriod)))], [invoiceRows]);
  const declarationPeriodOptions = useMemo(() => ['全部', ...declarationRows.map((row) => row.declarationPeriod)], [declarationRows]);
  const periodOptions = activeView === 'monthly' ? monthlyPeriodOptions : declarationPeriodOptions;
  const currentRows = invoiceRows.filter((row) => row.accountingPeriod === currentPeriod);
  const currentOutputRow = currentRows.find((row) => row.direction === '销项');
  const currentInputRow = currentRows.find((row) => row.direction === '进项');
  const currentDeclarationRow = declarationRows.find((row) => row.declarationPeriod === currentDeclarationPeriod);
  const importedPeriodCount = new Set(invoiceRows.map((row) => row.accountingPeriod)).size;
  const pendingInvoiceCount = invoiceRows.reduce((total, row) => total + getPendingCount(row), 0);

  function handleImportFileSelect(file: UploadFile) {
    setImportForm((current) => ({
      ...current,
      file: {
        id: `invoice-import-file-${file.uid || Date.now()}`,
        name: file.name,
        status: '已选择',
        type: '税务下载文件',
        updatedAt: financeToday
      }
    }));
  }

  function handleSubmitImport() {
    if (!importForm.file) {
      void messageApi.warning('请选择税务下载文件');
      return;
    }

    setImportDrawerOpen(false);
    setImportForm(defaultImportForm);
    void messageApi.success('发票数据已进入导入记录');
  }

  function handleRevokeInvoiceMatch(invoiceId: string) {
    const targetInvoice = invoiceRecordRows.find((invoice) => invoice.id === invoiceId);

    if (!targetInvoice || targetInvoice.invoiceStatus !== '正常' || getInvoiceMatchStatus(targetInvoice) !== '已匹配') {
      void messageApi.warning('当前发票不能撤销匹配');
      return;
    }

    clearInvoiceMatches(invoiceId);
    void messageApi.success('已撤销匹配，发票已进入待关联');
  }

  function handleRevokeRedOriginalLink(invoiceId: string) {
    const targetInvoice = invoiceRecordRows.find((invoice) => invoice.id === invoiceId);

    if (!targetInvoice || targetInvoice.invoiceStatus !== '红冲' || !targetInvoice.originalInvoiceId) {
      void messageApi.warning('当前红冲发票没有原票关联');
      return;
    }

    updateInvoiceRecord(invoiceId, (invoice) => ({
      ...invoice,
      originalInvoiceId: undefined
    }));
    void messageApi.success('已撤销原票关联，红冲发票已进入发票匹配');
  }

  function handlePreviewImportFile(record: FinanceInvoiceImportBatch) {
    void messageApi.info(`${record.fileName} 预览仍为前端原型，未接入真实文件服务`);
  }

  function handleDownloadImportFile(record: FinanceInvoiceImportBatch) {
    void messageApi.success(`${record.fileName} 下载请求已记录`);
  }

  const monthlyColumns: TableColumnsType<InvoiceLedgerRow> = [
    {
      title: '月份',
      dataIndex: 'accountingPeriod',
      width: 110,
      render: (accountingPeriod: string, row) => <CompactCell primary={accountingPeriod} secondary={`${row.importBatches.length} 个导入批次`} />
    },
    {
      title: '发票方向',
      dataIndex: 'direction',
      width: 112,
      render: (direction: FinanceInvoiceDirection) => <StatusTag toneMap={invoiceDirectionTone} value={direction} />
    },
    {
      title: '发票份数',
      dataIndex: ['summary', 'invoiceCount'],
      width: 104,
      render: (invoiceCount: number) => <CellText>{invoiceCount} 份</CellText>
    },
    {
      title: '含税金额',
      dataIndex: ['summary', 'totalAmount'],
      width: 132,
      render: renderMoney
    },
    {
      title: '税额',
      dataIndex: ['summary', 'taxAmount'],
      width: 120,
      render: renderMoney
    },
    {
      title: '关联状态',
      dataIndex: ['summary'],
      width: 142,
      render: (summary: InvoiceDirectionSummary) => <StatusTag tone={getMatchTone(summary)} value={getMatchText(summary)} />
    },
    {
      title: '最近导入',
      dataIndex: 'latestImportedAt',
      width: 148
    }
  ];

  const declarationColumns: TableColumnsType<InvoiceDeclarationPeriodRow> = [
    {
      title: '申报周期',
      dataIndex: 'declarationPeriod',
      width: 128,
      render: (declarationPeriod: string, row) => <CompactCell primary={declarationPeriod} secondary={row.months.join(' / ')} />
    },
    {
      title: '销项不含税',
      dataIndex: 'outputNetAmount',
      width: 132,
      render: renderMoney
    },
    {
      title: '红票冲减',
      dataIndex: 'redNetAmount',
      width: 132,
      render: renderMoney
    },
    {
      title: '进项含税',
      dataIndex: 'inputAmount',
      width: 132,
      render: renderMoney
    },
    {
      title: '导入月份',
      dataIndex: 'importedMonthCount',
      width: 110,
      render: (importedMonthCount: number, row) => (
        <StatusTag tone={importedMonthCount === row.months.length ? 'green' : 'amber'} value={`${importedMonthCount}/${row.months.length}`} />
      )
    },
    {
      title: '关联状态',
      dataIndex: 'pendingCount',
      width: 124,
      render: (_pendingCount: number, row) => <StatusTag tone={getDeclarationPendingTone(row)} value={getDeclarationPendingText(row)} />
    },
    {
      title: '申报准备',
      dataIndex: ['preparationRecord', 'status'],
      width: 126,
      render: (_status: string | undefined, row) => <StatusTag tone={getDeclarationPreparationStatusTone(row)} value={getDeclarationPreparationStatusText(row)} />
    },
    {
      title: '最近导入',
      dataIndex: 'latestImportedAt',
      width: 148
    }
  ];

  const invoiceColumns: TableColumnsType<FinanceInvoiceRecord> = [
    {
      title: '发票',
      dataIndex: 'invoiceNo',
      width: 180,
      render: (invoiceNo: string, record) => <CompactCell primary={invoiceNo} secondary={record.invoiceDate} />
    },
    {
      title: '对象',
      dataIndex: 'counterparty',
      width: 150,
      render: (counterparty: string, record) => (
        <CompactCell
          primary={counterparty}
          secondarySlot={<StatusTag toneMap={invoiceStatusTone} value={record.invoiceStatus} variant="compact" />}
        />
      )
    },
    {
      title: '含税金额',
      dataIndex: 'totalAmount',
      width: 124,
      render: renderMoney
    },
    {
      title: '税额',
      dataIndex: 'taxAmount',
      width: 112,
      render: renderMoney
    },
    {
      title: '征收率',
      dataIndex: 'taxRate',
      width: 82
    },
    {
      title: '关联状态',
      key: 'matchStatus',
      width: 104,
      render: (_, record) => renderInvoiceAssociationStatus(record)
    }
  ];

  const matchDetailColumns: TableColumnsType<InvoiceMatchRelationRow> = [
    {
      title: '流水',
      dataIndex: 'transactionNo',
      width: 190,
      render: (transactionNo: string, record) => <CompactCell primary={transactionNo} secondary={record.transactionDate} />
    },
    {
      title: '对象',
      dataIndex: 'transactionCounterparty',
      width: 150
    },
    {
      title: '流水金额',
      dataIndex: 'transactionAmount',
      width: 120,
      render: renderOptionalMoney
    },
    {
      title: '占用金额',
      dataIndex: 'matchedAmount',
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

  const matchSummaryColumns: TableColumnsType<InvoiceMatchSummaryRow> = [
    {
      title: '发票',
      dataIndex: ['invoice', 'invoiceNo'],
      width: 190,
      render: (_: string, record) => <CompactCell primary={record.invoice.invoiceNo} secondary={record.invoice.counterparty} />
    },
    {
      title: '流水关联',
      dataIndex: 'matchStatus',
      width: 110,
      render: renderRelationStatus
    },
    {
      title: '对应流水',
      dataIndex: 'relations',
      width: 96,
      render: (relations: InvoiceMatchRelationRow[]) => (relations.length > 0 ? <CellText>{relations.length} 条</CellText> : <CellText tone="subtle">-</CellText>)
    },
    {
      title: '已占用',
      dataIndex: 'matchedAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '发票金额',
      dataIndex: ['invoice', 'totalAmount'],
      width: 120,
      render: renderMoney
    },
    {
      title: '待关联',
      dataIndex: 'remainingAmount',
      width: 120,
      render: renderMoney
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        const canRevoke = record.invoice.invoiceStatus === '正常' && record.matchStatus === '已匹配' && record.relations.length > 0;

        if (!canRevoke) {
          return <CellText tone="subtle">-</CellText>;
        }

        return (
          <Button
            icon={<RollbackOutlined />}
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              handleRevokeInvoiceMatch(record.invoice.id);
            }}
          >
            撤销匹配
          </Button>
        );
      }
    }
  ];

  const redOriginalColumns: TableColumnsType<RedInvoiceOriginalRelationRow> = [
    {
      title: '红字发票',
      dataIndex: ['redInvoice', 'invoiceNo'],
      width: 190,
      render: (_invoiceNo: string, record) => <CompactCell primary={record.redInvoice.invoiceNo} secondary={record.redInvoice.invoiceDate} />
    },
    {
      title: '对象',
      dataIndex: ['redInvoice', 'counterparty'],
      width: 150,
      render: (_counterparty: string, record) => record.redInvoice.counterparty
    },
    {
      title: '红冲金额',
      dataIndex: ['redInvoice', 'totalAmount'],
      width: 120,
      render: renderMoney
    },
    {
      title: '原蓝票',
      key: 'originalInvoice',
      width: 190,
      render: (_, record) =>
        record.originalInvoice ? (
          <CompactCell primary={record.originalInvoice.invoiceNo} secondary={record.originalInvoice.invoiceDate} />
        ) : (
          <CellText tone="subtle">待关联</CellText>
        )
    },
    {
      title: '原票金额',
      key: 'originalAmount',
      width: 120,
      render: (_, record) => (record.originalInvoice ? renderMoney(record.originalInvoice.totalAmount) : <CellText tone="subtle">-</CellText>)
    },
    {
      title: '可冲减',
      key: 'availableRedAmount',
      width: 120,
      render: (_, record) => (record.redSummary ? renderMoney(record.redSummary.availableRedAmount) : <CellText tone="subtle">-</CellText>)
    },
    {
      title: '原票关联',
      dataIndex: 'status',
      width: 118,
      render: (status: FinanceRedInvoiceOriginalAssociationStatus) => <StatusTag toneMap={redOriginalAssociationTone} value={status} />
    },
    {
      title: '操作',
      key: 'action',
      width: 118,
      render: (_, record) =>
        record.status === '已关联原票' ? (
          <Button
            icon={<RollbackOutlined />}
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              handleRevokeRedOriginalLink(record.redInvoice.id);
            }}
          >
            撤销关联
          </Button>
        ) : (
          <CellText tone="subtle">-</CellText>
        )
    }
  ];

  const importColumns: TableColumnsType<FinanceInvoiceImportBatch> = [
    {
      title: '导入文件',
      dataIndex: 'fileName',
      width: 300,
      render: (fileName: string, record) => <CompactCell primary={fileName} secondary={record.direction} />
    },
    {
      title: '发票份数',
      dataIndex: 'invoiceCount',
      width: 92,
      render: (invoiceCount: number) => <CellText>{invoiceCount} 份</CellText>
    },
    {
      title: '导入时间',
      dataIndex: 'importedAt',
      width: 148
    },
    {
      title: '操作',
      key: 'action',
      width: 128,
      render: (_, record) => (
        <FileActionButtons
          record={record}
          onDownload={handleDownloadImportFile}
          onPreview={handlePreviewImportFile}
        />
      )
    }
  ];

  const matchRelationRows = activeRow ? buildInvoiceMatchRelationRows(activeRow, transactionByNo) : [];
  const matchSummaryRows = activeRow ? buildInvoiceMatchSummaryRows(activeRow, matchRelationRows) : [];
  const redOriginalRows = activeRow ? buildRedOriginalRelationRows(activeRow, invoiceRecordRows) : [];
  const declarationRedOriginalRows = activeDeclarationRow ? buildRedOriginalRelationRows(
    {
      accountingPeriod: activeDeclarationRow.declarationPeriod,
      direction: '销项',
      id: `${activeDeclarationRow.id}-red`,
      importBatches: activeDeclarationRow.importBatches,
      invoices: activeDeclarationRow.invoices,
      latestImportedAt: activeDeclarationRow.latestImportedAt,
      summary: getDirectionSummary(activeDeclarationRow.invoices)
    },
    invoiceRecordRows
  ) : [];
  const activeDeclarationInvoiceRows = activeDeclarationRow
    ? [...activeDeclarationRow.invoices].sort(
        (left, right) =>
          left.accountingPeriod.localeCompare(right.accountingPeriod) ||
          left.direction.localeCompare(right.direction) ||
          left.invoiceDate.localeCompare(right.invoiceDate) ||
          left.invoiceNo.localeCompare(right.invoiceNo)
      )
    : [];
  const importPrimaryAction = {
    icon: <CloudUploadOutlined />,
    label: '导入税务发票数据',
    testId: 'finance-invoice-import-button',
    onClick: () => {
      setImportForm(defaultImportForm);
      setImportDrawerOpen(true);
    }
  };

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label={activeView === 'monthly' ? '月份' : '申报周期'}>
              <Select
                data-testid="finance-invoice-period-filter"
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.period}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="关联状态">
              <Select
                data-testid="finance-invoice-match-filter"
                options={(['全部', '有待关联', '已全部关联'] satisfies InvoiceMatchFilter[]).map((status) => ({
                  label: status,
                  value: status
                }))}
                value={filters.matchStatus}
                onChange={(matchStatus) => setFilters((current) => ({ ...current, matchStatus }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-invoice-keyword-input"
              placeholder="月份 / 发票号 / 对象 / 流水号"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={5}>
          {activeView === 'monthly' ? (
            <>
              <MetricCard icon={<FileTextOutlined />} label="本月销项" value={formatMoney(currentOutputRow?.summary.totalAmount ?? 0)} />
              <MetricCard icon={<PercentageOutlined />} label="销项税额" value={formatMoney(currentOutputRow?.summary.taxAmount ?? 0)} />
              <MetricCard icon={<WalletOutlined />} label="本月进项" value={formatMoney(currentInputRow?.summary.totalAmount ?? 0)} />
              <MetricCard icon={<LinkOutlined />} label="待关联发票" value={pendingInvoiceCount} />
              <MetricCard icon={<CloudUploadOutlined />} label="导入月份" value={importedPeriodCount} />
            </>
          ) : (
            <>
              <MetricCard icon={<FileTextOutlined />} label="本季销项不含税" value={formatMoney(currentDeclarationRow?.outputNetAmount ?? 0)} />
              <MetricCard icon={<RollbackOutlined />} label="本季红票冲减" value={formatMoney(currentDeclarationRow?.redNetAmount ?? 0)} />
              <MetricCard icon={<WalletOutlined />} label="本季进项含税" value={formatMoney(currentDeclarationRow?.inputAmount ?? 0)} />
              <MetricCard icon={<LinkOutlined />} label="待关联发票" value={currentDeclarationRow?.pendingCount ?? 0} />
              <MetricCard icon={<CloudUploadOutlined />} label="导入月份" value={`${currentDeclarationRow?.importedMonthCount ?? 0}/3`} />
            </>
          )}
        </MetricGrid>
      }
      pageId="finance-invoices"
    >
      <TabbedManagementTable
        activeKey={activeView}
        tabs={[
          createTabbedManagementTableItem<InvoiceLedgerRow>({
            key: 'monthly',
            label: '月度台账',
            table: {
              columns: monthlyColumns,
              count: { value: monthlyRows.length, unit: '条月度记录' },
              dataSource: monthlyRows,
              primaryAction: importPrimaryAction,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-invoice-table-row',
              tableTestId: 'finance-invoice-table',
              onRowClick: (row) => setActiveRowId(row.id)
            }
          }),
          createTabbedManagementTableItem<InvoiceDeclarationPeriodRow>({
            key: 'declaration',
            label: '申报周期',
            table: {
              columns: declarationColumns,
              count: { value: filteredDeclarationRows.length, unit: '条申报周期' },
              dataSource: filteredDeclarationRows,
              primaryAction: importPrimaryAction,
              rowKey: 'id',
              rowTestIdPrefix: 'finance-invoice-declaration-table-row',
              tableTestId: 'finance-invoice-declaration-table',
              onRowClick: (row) => setActiveDeclarationRowId(row.id)
            }
          })
        ]}
        tabTestIdPrefix="finance-invoice-page-tab"
        testId="finance-invoice-page-tabs"
        onChange={(key) => {
          const nextView = key as InvoiceLedgerView;
          setActiveView(nextView);
          setActiveRowId(undefined);
          setActiveDeclarationRowId(undefined);
          setFilters((current) => ({
            ...current,
            period: nextView === 'monthly' ? currentPeriod : currentDeclarationPeriod
          }));
        }}
      />

      <DetailDrawerShell
        bodyTestId="finance-invoice-detail-drawer"
        className="finance-invoice-drawer"
        closeAction={{ label: '关闭', testId: 'finance-invoice-close-button', onClick: () => setActiveRowId(undefined) }}
        open={Boolean(activeRow)}
        title={activeRow ? <DrawerTitle row={activeRow} /> : null}
        width={980}
        onClose={() => setActiveRowId(undefined)}
      >
        {activeRow ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={
                [
                  { icon: <FileTextOutlined />, key: 'direction', label: '发票方向', value: activeRow.direction },
                  { icon: <WalletOutlined />, key: 'amount', label: '含税金额', value: formatMoney(activeRow.summary.totalAmount) },
                  { icon: <PercentageOutlined />, key: 'tax', label: '税额', value: formatMoney(activeRow.summary.taxAmount) },
                  { icon: <LinkOutlined />, key: 'pending', label: '待关联', value: getPendingCount(activeRow) }
                ] satisfies DetailSummaryCardItem[]
              }
            />
            <DetailTabs
              defaultActiveKey="summary"
              tabTestIdPrefix="finance-invoice-detail-tab"
              testId="finance-invoice-detail-tabs"
              items={[
                {
                  key: 'summary',
                  label: '方向汇总',
                  children: (
                    <DetailSection icon={<FileSearchOutlined />} title="发票汇总">
                      <DetailInfoGrid
                        columns={4}
                        items={[
                          { label: '发票月份', value: activeRow.accountingPeriod },
                          { label: '发票方向', value: <StatusTag toneMap={invoiceDirectionTone} value={activeRow.direction} /> },
                          { label: '发票份数', value: `${activeRow.summary.invoiceCount} 份` },
                          { label: '流水关联', value: <StatusTag tone={getMatchTone(activeRow.summary)} value={getMatchText(activeRow.summary)} /> },
                          { label: '最近导入', value: activeRow.latestImportedAt },
                          { label: '导入批次', value: `${activeRow.importBatches.length} 个` },
                          { label: '待关联发票', value: `${getPendingCount(activeRow)} 条` }
                        ]}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'invoices',
                  label: '发票明细',
                  children: (
                    <DetailSection icon={<FileTextOutlined />} title={`${activeRow.direction}发票`}>
                      <CompactDetailTable<FinanceInvoiceRecord>
                        columns={invoiceColumns}
                        dataSource={activeRow.invoices}
                        emptyText={`暂无${activeRow.direction}发票`}
                        rowKey="id"
                        scrollX={960}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'match',
                  label: '关联关系',
                  children: (
                    <>
                      <DetailSection icon={<LinkOutlined />} title="流水关联">
                        <CompactDetailTable<InvoiceMatchSummaryRow>
                          columns={matchSummaryColumns}
                          dataSource={matchSummaryRows}
                          emptyText="暂无流水关联"
                          expandable={{
                            expandedRowRender: (record) => (
                              <div className="finance-invoice-match-expanded">
                                <CompactDetailTable<InvoiceMatchRelationRow>
                                  columns={matchDetailColumns}
                                  dataSource={record.relations}
                                  emptyText="暂无对应流水"
                                  rowKey="id"
                                  scrollX={false}
                                />
                              </div>
                            ),
                            rowExpandable: (record) => record.relations.length > 0
                          }}
                          rowKey="id"
                          scrollX={860}
                        />
                      </DetailSection>
                      {redOriginalRows.length > 0 ? (
                        <DetailSection icon={<RollbackOutlined />} title="红冲关联">
                          <CompactDetailTable<RedInvoiceOriginalRelationRow>
                            columns={redOriginalColumns}
                            dataSource={redOriginalRows}
                            emptyText="暂无红冲关联"
                            rowKey="id"
                            scrollX={1090}
                          />
                        </DetailSection>
                      ) : null}
                    </>
                  )
                },
                {
                  key: 'imports',
                  label: '导入记录',
                  children: (
                    <DetailSection icon={<CloudUploadOutlined />} title="导入记录">
                      <CompactDetailTable<FinanceInvoiceImportBatch>
                        columns={importColumns}
                        dataSource={activeRow.importBatches}
                        emptyText="暂无导入记录"
                        rowKey="id"
                        scrollX={620}
                      />
                    </DetailSection>
                  )
                }
              ]}
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <DetailDrawerShell
        bodyTestId="finance-invoice-declaration-detail-drawer"
        className="finance-invoice-drawer"
        closeAction={{ label: '关闭', testId: 'finance-invoice-declaration-close-button', onClick: () => setActiveDeclarationRowId(undefined) }}
        open={Boolean(activeDeclarationRow)}
        title={
          activeDeclarationRow ? (
            <DetailDrawerTitle
              status={getDeclarationPendingText(activeDeclarationRow)}
              statusTone={getDeclarationPendingTone(activeDeclarationRow)}
              subtitle={activeDeclarationRow.months.join(' / ')}
              title={`${activeDeclarationRow.declarationPeriod} 发票情况`}
            />
          ) : null
        }
        width={980}
        onClose={() => setActiveDeclarationRowId(undefined)}
      >
        {activeDeclarationRow ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={
                [
                  { icon: <FileTextOutlined />, key: 'period', label: '申报周期', value: activeDeclarationRow.declarationPeriod },
                  { icon: <WalletOutlined />, key: 'output', label: '销项不含税', value: formatMoney(activeDeclarationRow.outputNetAmount) },
                  { icon: <RollbackOutlined />, key: 'red', label: '红票冲减', value: formatMoney(activeDeclarationRow.redNetAmount) },
                  { icon: <LinkOutlined />, key: 'pending', label: '待关联', value: activeDeclarationRow.pendingCount }
                ] satisfies DetailSummaryCardItem[]
              }
            />
            <DetailTabs
              defaultActiveKey="summary"
              tabTestIdPrefix="finance-invoice-declaration-detail-tab"
              testId="finance-invoice-declaration-detail-tabs"
              items={[
                {
                  key: 'summary',
                  label: '周期汇总',
                  children: (
                    <DetailSection icon={<FileSearchOutlined />} title="周期汇总">
                      <DetailInfoGrid
                        columns={4}
                        items={[
                          { label: '申报周期', value: activeDeclarationRow.declarationPeriod },
                          { label: '覆盖月份', value: activeDeclarationRow.months.join(' / ') },
                          { label: '销项发票', value: `${activeDeclarationRow.outputCount} 份` },
                          { label: '销项不含税', value: formatMoney(activeDeclarationRow.outputNetAmount) },
                          { label: '销项含税', value: formatMoney(activeDeclarationRow.outputAmount) },
                          { label: '红冲发票', value: `${activeDeclarationRow.redCount} 份` },
                          { label: '红票冲减不含税', value: formatMoney(activeDeclarationRow.redNetAmount) },
                          { label: '红票冲减含税', value: formatMoney(activeDeclarationRow.redAmount) },
                          { label: '进项发票', value: `${activeDeclarationRow.inputCount} 份` },
                          { label: '进项含税', value: formatMoney(activeDeclarationRow.inputAmount) },
                          { label: '导入月份', value: `${activeDeclarationRow.importedMonthCount}/${activeDeclarationRow.months.length}` },
                          {
                            label: '关联状态',
                            value: <StatusTag tone={getDeclarationPendingTone(activeDeclarationRow)} value={getDeclarationPendingText(activeDeclarationRow)} />
                          },
                          {
                            label: '申报准备',
                            value: (
                              <StatusTag
                                tone={getDeclarationPreparationStatusTone(activeDeclarationRow)}
                                value={getDeclarationPreparationStatusText(activeDeclarationRow)}
                              />
                            )
                          },
                          { label: '最近导入', value: activeDeclarationRow.latestImportedAt }
                        ]}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'months',
                  label: '月度拆分',
                  children: (
                    <DetailSection icon={<FileSearchOutlined />} title="月度拆分">
                      <CompactDetailTable<InvoiceLedgerRow>
                        columns={monthlyColumns}
                        dataSource={activeDeclarationRow.monthRows}
                        emptyText="暂无月度发票记录"
                        rowKey="id"
                        scrollX={960}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'invoices',
                  label: '发票明细',
                  children: (
                    <DetailSection icon={<FileTextOutlined />} title="发票明细">
                      <CompactDetailTable<FinanceInvoiceRecord>
                        columns={invoiceColumns}
                        dataSource={activeDeclarationInvoiceRows}
                        emptyText="暂无发票明细"
                        rowKey="id"
                        scrollX={960}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'red',
                  label: '红冲关联',
                  children: (
                    <DetailSection icon={<RollbackOutlined />} title="红冲关联">
                      <CompactDetailTable<RedInvoiceOriginalRelationRow>
                        columns={redOriginalColumns}
                        dataSource={declarationRedOriginalRows}
                        emptyText="暂无红冲关联"
                        rowKey="id"
                        scrollX={1090}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'imports',
                  label: '导入记录',
                  children: (
                    <DetailSection icon={<CloudUploadOutlined />} title="导入记录">
                      <CompactDetailTable<FinanceInvoiceImportBatch>
                        columns={importColumns}
                        dataSource={activeDeclarationRow.importBatches}
                        emptyText="暂无导入记录"
                        rowKey="id"
                        scrollX={620}
                      />
                    </DetailSection>
                  )
                }
              ]}
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <ImportDrawerShell
        bodyTestId="finance-invoice-import-drawer"
        className="finance-invoice-drawer"
        cancelAction={{
          label: '取消',
          onClick: () => {
            setImportDrawerOpen(false);
            setImportForm(defaultImportForm);
          }
        }}
        open={importDrawerOpen}
        primaryAction={{
          disabled: !importForm.file,
          label: '导入',
          testId: 'finance-invoice-import-submit-button',
          onClick: handleSubmitImport
        }}
        title={<DetailDrawerTitle status="待导入" statusTone="amber" subtitle="税务下载文件" title="导入税务发票数据" />}
        width={760}
        onClose={() => {
          setImportDrawerOpen(false);
          setImportForm(defaultImportForm);
        }}
      >
        <DetailSection icon={<CloudUploadOutlined />} title="导入信息">
          <DetailInfoGrid
            columns={2}
            items={[
              {
                label: '导入月份',
                value: (
                  <Select
                    className="finance-invoice-inline-select"
                    data-testid="finance-invoice-import-period-select"
                    options={monthlyPeriodOptions.filter((period) => period !== '全部').map((period) => ({ label: period, value: period }))}
                    value={importForm.period}
                    onChange={(period) => setImportForm((current) => ({ ...current, period }))}
                  />
                )
              },
              {
                label: '发票范围',
                value: (
                  <Select
                    className="finance-invoice-inline-select"
                    data-testid="finance-invoice-import-direction-select"
                    options={(['进销项', '销项', '进项'] satisfies FinanceInvoiceImportBatch['direction'][]).map((direction) => ({
                      label: direction,
                      value: direction
                    }))}
                    value={importForm.direction}
                    onChange={(direction) => setImportForm((current) => ({ ...current, direction }))}
                  />
                )
              }
            ]}
          />
        </DetailSection>
        <DetailSection icon={<FileTextOutlined />} title="税务下载文件">
          <FileSlot<FileSlotFile>
            accept=".xlsx,.xls,.csv"
            description="Excel / CSV"
            file={importForm.file}
            title="发票数据文件"
            uploadText="选择文件"
            onRemove={() => setImportForm((current) => ({ ...current, file: undefined }))}
            onSelect={handleImportFileSelect}
          />
        </DetailSection>
      </ImportDrawerShell>
    </ManagementPageScaffold>
  );
}
