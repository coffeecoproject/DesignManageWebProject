import { CloudUploadOutlined, FileSearchOutlined, FileTextOutlined, LinkOutlined, WalletOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Alert, Select, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useMemo, useState } from 'react';
import { DateScopeFilter, getDateScopeRange, type DateScopeFilterValue } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { ImportDrawerShell } from '../../components/DrawerShell';
import { FileSlot, type FileSlotFile } from '../../components/FileSlot';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CompactCell } from '../../components/TableCell';
import { FinanceInvoiceAssociationDrawer } from './FinanceInvoiceAssociationDrawer';
import { useFinanceManagement } from './FinanceManagementState';
import type {
  FinanceInvoiceBusinessAllocation,
  FinanceInvoiceDirection,
  FinanceInvoiceImportBatch,
  FinanceInvoiceRecord
} from './financeInvoiceData';
import { buildFinanceInvoiceImportBatch, buildFinanceInvoiceRecordsFromImportBatch } from './financeInvoiceImportModel';
import { getInvoiceAmount, getInvoiceMatchStatus, getRedInvoiceOriginalAssociationStatus } from './financeInvoiceModel';
import { financeToday, formatMoney } from './financeUtils';

type InvoiceAssociationFilter = '全部' | '待关联' | '部分关联' | '已关联' | '已作废' | '红票待关联' | '已关联原票';

type InvoiceFilters = {
  association: InvoiceAssociationFilter;
  direction: '全部' | FinanceInvoiceDirection;
  keyword: string;
  occurredTime: DateScopeFilterValue;
};

type InvoiceImportForm = {
  direction: FinanceInvoiceImportBatch['direction'];
  file?: FileSlotFile;
  period: string;
};

const defaultMonth = financeToday.slice(0, 7);
const defaultFilters: InvoiceFilters = {
  association: '全部',
  direction: '全部',
  keyword: '',
  occurredTime: { mode: 'currentMonth' }
};

const invoiceDirectionTone = {
  销项: 'green',
  进项: 'blue'
} as const;

const invoiceAssociationTone = {
  已关联: 'green',
  已关联原票: 'green',
  待关联: 'amber',
  红票待关联: 'amber',
  部分关联: 'blue',
  已作废: 'gray'
} as const;

function getInvoiceAssociationLabel(invoice: FinanceInvoiceRecord, invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]) {
  if (invoice.invoiceStatus === '作废') {
    return '已作废';
  }

  if (invoice.invoiceStatus === '红冲') {
    return getRedInvoiceOriginalAssociationStatus(invoice) === '已关联原票' ? '已关联原票' : '红票待关联';
  }

  const status = getInvoiceMatchStatus(invoice, invoiceBusinessAllocationRows);

  if (status === '已匹配') {
    return '已关联';
  }

  if (status === '部分匹配') {
    return '部分关联';
  }

  return '待关联';
}

function matchesInvoiceAssociation(
  invoice: FinanceInvoiceRecord,
  association: InvoiceAssociationFilter,
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[]
) {
  return association === '全部' || getInvoiceAssociationLabel(invoice, invoiceBusinessAllocationRows) === association;
}

function buildImportPeriodOptions(invoices: FinanceInvoiceRecord[]) {
  return Array.from(new Set([defaultMonth, ...invoices.map((invoice) => invoice.accountingPeriod)])).sort((left, right) => right.localeCompare(left));
}

export function FinanceInvoicesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    getAccountingPeriodGuard,
    importInvoiceBatch,
    invoiceBusinessAllocationRows,
    invoiceImportBatches,
    invoiceRows
  } = useFinanceManagement();
  const [filters, setFilters] = useState<InvoiceFilters>(defaultFilters);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string>();
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const importPeriodOptions = useMemo(() => buildImportPeriodOptions(invoiceRows), [invoiceRows]);
  const getDefaultImportForm = (): InvoiceImportForm => {
    const firstOpenPeriod = importPeriodOptions.find((period) => getAccountingPeriodGuard(period, '导入税务发票数据').allowed) ?? defaultMonth;

    return { direction: '进销项', period: firstOpenPeriod };
  };
  const [importForm, setImportForm] = useState<InvoiceImportForm>(() => getDefaultImportForm());
  const activeInvoice = useMemo(
    () => invoiceRows.find((invoice) => invoice.id === activeInvoiceId),
    [activeInvoiceId, invoiceRows]
  );
  const dateRange = useMemo(
    () => getDateScopeRange(filters.occurredTime, defaultMonth),
    [filters.occurredTime]
  );
  const filteredInvoices = useMemo(
    () =>
      invoiceRows
        .filter((invoice) => {
          const normalizedKeyword = filters.keyword.trim().toLowerCase();
          const matchesKeyword = !normalizedKeyword || [invoice.invoiceNo, invoice.counterparty, invoice.sourceFile]
            .some((value) => value.toLowerCase().includes(normalizedKeyword));
          const matchesDate = !dateRange || (invoice.invoiceDate >= dateRange.startDate && invoice.invoiceDate <= dateRange.endDate);

          return (
            matchesKeyword &&
            matchesDate &&
            (filters.direction === '全部' || invoice.direction === filters.direction) &&
            matchesInvoiceAssociation(invoice, filters.association, invoiceBusinessAllocationRows)
          );
        })
        .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate) || right.importedAt.localeCompare(left.importedAt)),
    [dateRange, filters, invoiceBusinessAllocationRows, invoiceRows]
  );
  const metrics = useMemo(() => {
    const normalInvoices = filteredInvoices.filter((invoice) => invoice.invoiceStatus === '正常');
    const outputTotal = normalInvoices
      .filter((invoice) => invoice.direction === '销项')
      .reduce((total, invoice) => total + getInvoiceAmount(invoice), 0);
    const inputTotal = normalInvoices
      .filter((invoice) => invoice.direction === '进项')
      .reduce((total, invoice) => total + getInvoiceAmount(invoice), 0);
    const pendingCount = filteredInvoices.filter((invoice) => ['待关联', '部分关联'].includes(getInvoiceAssociationLabel(invoice, invoiceBusinessAllocationRows))).length;
    const redPendingCount = filteredInvoices.filter((invoice) => getInvoiceAssociationLabel(invoice, invoiceBusinessAllocationRows) === '红票待关联').length;

    return { inputTotal, outputTotal, pendingCount, redPendingCount };
  }, [filteredInvoices, invoiceBusinessAllocationRows]);
  const importPeriodGuard = getAccountingPeriodGuard(importForm.period, '导入税务发票数据');
  const columns: TableColumnsType<FinanceInvoiceRecord> = [
    {
      title: '发票',
      key: 'invoice',
      width: 240,
      render: (_value, invoice) => <CompactCell primary={invoice.invoiceNo} secondary={invoice.invoiceDate} />
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 92,
      render: (value: FinanceInvoiceDirection) => <StatusTag toneMap={invoiceDirectionTone} value={value} />
    },
    {
      title: '开票对象',
      dataIndex: 'counterparty',
      width: 210,
      ellipsis: true
    },
    {
      title: '发票类型',
      key: 'type',
      width: 138,
      render: (_value, invoice) => <CompactCell primary={invoice.invoiceKind} secondary={invoice.invoiceStatus} />
    },
    {
      title: '价税合计',
      dataIndex: 'taxIncludedAmount',
      width: 144,
      render: (value: number) => formatMoney(value)
    },
    {
      title: '票面税额',
      dataIndex: 'taxAmount',
      width: 128,
      render: (value: number) => formatMoney(value)
    },
    {
      title: '业务关联',
      key: 'association',
      width: 130,
      render: (_value, invoice) => {
        const label = getInvoiceAssociationLabel(invoice, invoiceBusinessAllocationRows);

        return <StatusTag toneMap={invoiceAssociationTone} value={label} />;
      }
    }
  ];

  function updateFilters(patch: Partial<InvoiceFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setActiveInvoiceId(undefined);
  }

  function openImportDrawer() {
    setImportForm(getDefaultImportForm());
    setImportDrawerOpen(true);
  }

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

  function closeImportDrawer() {
    setImportDrawerOpen(false);
    setImportForm(getDefaultImportForm());
  }

  function handleSubmitImport() {
    if (!importPeriodGuard.allowed) {
      void messageApi.warning(importPeriodGuard.reason);
      return;
    }

    if (!importForm.file) {
      void messageApi.warning('请选择税务下载文件');
      return;
    }

    const sequence = invoiceImportBatches.length + 1;
    const batch = buildFinanceInvoiceImportBatch({
      direction: importForm.direction,
      fileName: importForm.file.name,
      importedAt: `${financeToday} 10:00`,
      period: importForm.period,
      sequence
    });
    const records = buildFinanceInvoiceRecordsFromImportBatch(batch, sequence);

    if (!importInvoiceBatch(batch, records)) {
      void messageApi.warning('当前期间已锁定或导入批次重复，不能导入发票数据');
      return;
    }

    void messageApi.success(`已导入 ${batch.invoiceCount} 份发票`);
    closeImportDrawer();
  }

  return (
    <ManagementPageScaffold
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={defaultMonth}
              label="开票日期"
              testIdPrefix="finance-invoices-date"
              value={filters.occurredTime}
              onChange={(occurredTime) => updateFilters({ occurredTime })}
            />
            <FilterField label="方向" variant="type">
              <Select
                options={(['全部', '销项', '进项'] as const).map((value) => ({ label: value, value }))}
                value={filters.direction}
                onChange={(direction) => updateFilters({ direction })}
              />
            </FilterField>
            <FilterField label="关联状态" variant="status">
              <Select
                options={(['全部', '待关联', '部分关联', '已关联', '已作废', '红票待关联', '已关联原票'] as const).map((value) => ({ label: value, value }))}
                value={filters.association}
                onChange={(association) => updateFilters({ association })}
              />
            </FilterField>
            <KeywordFilter placeholder="发票号 / 开票对象 / 来源文件" value={filters.keyword} onChange={(keyword) => updateFilters({ keyword })} />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<WalletOutlined />} label="销项价税合计" value={formatMoney(metrics.outputTotal)} />
          <MetricCard icon={<FileTextOutlined />} label="进项价税合计" value={formatMoney(metrics.inputTotal)} />
          <MetricCard icon={<LinkOutlined />} label="待关联发票" value={`${metrics.pendingCount} 张`} />
          <MetricCard icon={<FileSearchOutlined />} label="红票待关联" value={`${metrics.redPendingCount} 张`} />
        </MetricGrid>
      }
      pageId="finance-invoices"
    >
      {contextHolder}
      <ManagementTable<FinanceInvoiceRecord>
        columns={columns}
        count={{ unit: '张发票', value: filteredInvoices.length }}
        dataSource={filteredInvoices}
        primaryAction={{ icon: <CloudUploadOutlined />, label: '导入税务发票数据', onClick: openImportDrawer }}
        rowKey="id"
        rowTestIdPrefix="finance-invoice-row"
        tableTestId="finance-invoice-table"
        onRowClick={(invoice) => setActiveInvoiceId(invoice.id)}
      />

      <FinanceInvoiceAssociationDrawer invoice={activeInvoice} open={Boolean(activeInvoice)} onClose={() => setActiveInvoiceId(undefined)} />

      <ImportDrawerShell
        bodyTestId="finance-invoice-import-drawer"
        cancelAction={{ label: '取消', onClick: closeImportDrawer }}
        open={importDrawerOpen}
        primaryAction={{
          disabled: !importPeriodGuard.allowed || !importForm.file,
          label: '导入',
          onClick: handleSubmitImport
        }}
        title={<DetailDrawerTitle status="待导入" statusTone="amber" subtitle="税务下载文件" title="导入税务发票数据" />}
        width={720}
        onClose={closeImportDrawer}
      >
        <DetailSection icon={<CloudUploadOutlined />} title="导入信息">
          {!importPeriodGuard.allowed ? <Alert message={importPeriodGuard.reason} showIcon type="info" /> : null}
          <DetailInfoGrid
            columns={2}
            items={[
              {
                label: '导入月份',
                value: (
                  <Select
                    options={importPeriodOptions.map((period) => ({
                      disabled: !getAccountingPeriodGuard(period, '导入税务发票数据').allowed,
                      label: period,
                      value: period
                    }))}
                    value={importForm.period}
                    onChange={(period) => setImportForm((current) => ({ ...current, period }))}
                  />
                )
              },
              {
                label: '发票范围',
                value: (
                  <Select
                    options={(['进销项', '销项', '进项'] as const).map((direction) => ({ label: direction, value: direction }))}
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
