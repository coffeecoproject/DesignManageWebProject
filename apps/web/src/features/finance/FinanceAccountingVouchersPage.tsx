import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ProfileOutlined,
  RollbackOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DateScopeFilter } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import {
  accountingVoucherDefaultMonth,
  accountingVoucherIssueLabels,
  accountingVoucherStatusOptions,
  applyAccountingVoucherLifecycle,
  buildAccountingLedgerEntries,
  buildAccountingVoucherMetrics,
  buildAccountingVouchers,
  canPrepareAccountingVoucher,
  canPostAccountingVoucher,
  canReverseAccountingVoucher,
  defaultAccountingVoucherFilters,
  getAccountingVoucherIssueSummary,
  matchesAccountingVoucherFilters,
  type AccountingLedgerEntry,
  type AccountingVoucherBusinessType,
  type AccountingVoucherFilters,
  type AccountingVoucherInvoiceRef,
  type AccountingVoucherIssueCode,
  type AccountingVoucherLine,
  type AccountingVoucherRecord,
  type AccountingVoucherSourceRef,
  type AccountingVoucherStatus,
  type AccountingVoucherTaxBasisSource,
  type AccountingVoucherTaxEvidenceStatus
} from './financeAccountingVoucherModel';
import { formatMoney } from './financeUtils';

const voucherBusinessTone = {
  权责凭证: 'blue',
  资金凭证: 'green',
  税费凭证: 'purple',
  调整凭证: 'amber'
} as const;

const voucherKindTone = {
  转账凭证: 'blue',
  收款凭证: 'green',
  付款凭证: 'red'
} as const;

const voucherLineSideTone = {
  借方: 'green',
  贷方: 'red'
} as const;

const voucherStatusTone = {
  待生成: 'gray',
  需处理: 'amber',
  待制单: 'green',
  已制单: 'blue',
  已入账: 'blue',
  已冲销: 'red'
} as const;

const invoiceDirectionTone = {
  销项: 'blue',
  进项: 'green'
} as const;

const invoiceStatusTone = {
  作废: 'gray',
  正常: 'green',
  红冲: 'red'
} as const;

const taxBasisSourceTone = {
  来源单据: 'blue',
  发票台账: 'green',
  不涉及发票: 'gray',
  待确认: 'amber'
} as const;

const taxEvidenceStatusTone = {
  发票已匹配: 'green',
  发票部分匹配: 'blue',
  发票待补: 'amber',
  不涉及发票: 'gray',
  待确认: 'amber'
} as const;

function getVoucherSubjects(record: AccountingVoucherRecord, side: AccountingVoucherLine['side']) {
  return record.lines
    .filter((line) => line.side === side)
    .map((line) => (line.subject ? `${line.subject.code} ${line.subject.name}` : `未配置 ${line.subjectCode}`))
    .join(' / ');
}

function getIssueAction(issue: AccountingVoucherIssueCode) {
  if (issue === 'missing_original_evidence') {
    return '补齐来源凭证';
  }

  if (issue === 'missing_accounting_subject') {
    return '维护科目映射';
  }

  if (issue === 'unbalanced_entries') {
    return '检查分录规则';
  }

  if (issue === 'bank_reconciliation_pending') {
    return '完成银行对账';
  }

  if (issue === 'bank_amount_mismatch') {
    return '处理对账差异';
  }

  if (issue === 'tax_matter_pending') {
    return '完成税务办理';
  }

  if (issue === 'tax_receipt_missing') {
    return '补齐税费回执';
  }

  if (issue === 'tax_basis_pending' || issue === 'tax_amount_missing') {
    return '确认税额依据';
  }

  if (issue === 'amount_invalid') {
    return '修正来源金额';
  }

  return '回到来源模块处理';
}

function AccountingVoucherDetailDrawer({
  canPrepare,
  canPost,
  canReverse,
  record,
  onPrepare,
  onPost,
  onReverse,
  onClose
}: {
  canPrepare: boolean;
  canPost: boolean;
  canReverse: boolean;
  record?: AccountingVoucherRecord;
  onPrepare: (record: AccountingVoucherRecord) => void;
  onPost: (record: AccountingVoucherRecord) => void;
  onReverse: (record: AccountingVoucherRecord) => void;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }

  const lineColumns: TableColumnsType<AccountingVoucherLine> = [
    {
      title: '借贷',
      dataIndex: 'side',
      width: 82,
      render: (side: AccountingVoucherLine['side']) => <StatusTag toneMap={voucherLineSideTone} value={side} />
    },
    {
      title: '会计科目',
      key: 'subject',
      width: 210,
      render: (_, line) => (
        <CompactCell
          primary={line.subject ? `${line.subject.code} ${line.subject.name}` : `未配置 ${line.subjectCode}`}
          primaryTone={line.subject ? 'strong' : 'risk'}
          secondary={line.subject ? undefined : '需处理'}
        />
      )
    },
    {
      title: '辅助核算',
      dataIndex: 'auxiliary',
      width: 180
    },
    {
      title: '借方金额',
      key: 'debit',
      width: 130,
      render: (_, line) => (line.side === '借方' ? <CellText tone="income">{formatMoney(line.amount)}</CellText> : '-')
    },
    {
      title: '贷方金额',
      key: 'credit',
      width: 130,
      render: (_, line) => (line.side === '贷方' ? <CellText tone="expense">{formatMoney(line.amount)}</CellText> : '-')
    }
  ];
  const sourceColumns: TableColumnsType<AccountingVoucherSourceRef> = [
    {
      title: '来源模块',
      dataIndex: 'module',
      width: 120
    },
    {
      title: '来源单号',
      key: 'recordNo',
      render: (_, sourceRef) => <CompactCell primary={sourceRef.recordNo} secondary={sourceRef.role} />
    }
  ];
  const invoiceColumns: TableColumnsType<AccountingVoucherInvoiceRef> = [
    {
      title: '发票号',
      key: 'invoiceNo',
      width: 210,
      render: (_, invoice) => <CompactCell primary={invoice.invoiceNo} secondary={invoice.declarationTreatment} />
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 82,
      render: (direction: AccountingVoucherInvoiceRef['direction']) => <StatusTag toneMap={invoiceDirectionTone} value={direction} />
    },
    {
      title: '状态',
      dataIndex: 'invoiceStatus',
      width: 82,
      render: (status: AccountingVoucherInvoiceRef['invoiceStatus']) => <StatusTag toneMap={invoiceStatusTone} value={status} />
    },
    {
      title: '不含税',
      dataIndex: 'taxExcludedAmount',
      width: 120,
      render: (amount: number) => <CellText tone="strong">{formatMoney(amount)}</CellText>
    },
    {
      title: '税额',
      dataIndex: 'taxAmount',
      width: 110,
      render: (amount: number) => <CellText tone="expense">{formatMoney(amount)}</CellText>
    },
    {
      title: '价税合计',
      dataIndex: 'taxIncludedAmount',
      width: 120,
      render: (amount: number) => <CellText tone="strong">{formatMoney(amount)}</CellText>
    }
  ];
  const taxBasisItems = record.taxBasis
    ? [
        {
          label: '依据来源',
          value: <StatusTag toneMap={taxBasisSourceTone} value={record.taxBasis.basisSource as AccountingVoucherTaxBasisSource} />
        },
        {
          label: '票据状态',
          value: <StatusTag toneMap={taxEvidenceStatusTone} value={record.taxBasis.evidenceStatus as AccountingVoucherTaxEvidenceStatus} />
        },
        { label: '税率', value: record.taxBasis.taxRate },
        { label: '价税合计', value: formatMoney(record.taxBasis.taxIncludedAmount) },
        { label: '不含税金额', value: formatMoney(record.taxBasis.taxExcludedAmount) },
        { label: '税额', value: formatMoney(record.taxBasis.taxAmount) },
        { label: '已匹配发票', value: formatMoney(record.taxBasis.matchedInvoiceAmount) }
      ]
    : [];
  const ledgerEntries = buildAccountingLedgerEntries([record]);
  const ledgerColumns: TableColumnsType<AccountingLedgerEntry> = [
    {
      title: '科目',
      key: 'subject',
      width: 210,
      render: (_, entry) => <CompactCell primary={`${entry.subjectCode} ${entry.subjectName}`} secondary={entry.auxiliary} />
    },
    {
      title: '借方',
      dataIndex: 'debitAmount',
      width: 130,
      render: (amount: number) => (amount > 0 ? <CellText tone="income">{formatMoney(amount)}</CellText> : '-')
    },
    {
      title: '贷方',
      dataIndex: 'creditAmount',
      width: 130,
      render: (amount: number) => (amount > 0 ? <CellText tone="expense">{formatMoney(amount)}</CellText> : '-')
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      width: 220
    }
  ];

  return (
    <DetailDrawerShell
      bodyTestId="finance-accounting-voucher-detail-drawer"
      className="finance-transaction-drawer"
      open={Boolean(record)}
      primaryAction={
        record.status === '待制单'
          ? {
              disabled: !canPrepare,
              icon: <FileTextOutlined />,
              label: '制单',
              testId: 'finance-accounting-voucher-prepare',
              onClick: () => onPrepare(record)
            }
          : record.status === '已制单'
          ? {
              disabled: !canPost,
              icon: <CheckCircleOutlined />,
              label: '入账',
              testId: 'finance-accounting-voucher-post',
              onClick: () => onPost(record)
            }
          : undefined
      }
      secondaryAction={
        record.status === '已入账'
          ? {
              danger: true,
              disabled: !canReverse,
              icon: <RollbackOutlined />,
              label: '冲销',
              testId: 'finance-accounting-voucher-reverse',
              onClick: () => onReverse(record)
            }
          : undefined
      }
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={voucherStatusTone}
          subtitle={`${record.voucherNo} / ${record.businessType}`}
          title="会计凭证详情"
        />
      }
      width={960}
      onClose={onClose}
    >
      <DetailSection icon={<ProfileOutlined />} title="凭证信息">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '凭证状态', value: <StatusTag toneMap={voucherStatusTone} value={record.status} /> },
            { label: '凭证日期', value: record.voucherDate },
            { label: '会计期间', value: record.accountingPeriod },
            { label: '凭证类型', value: <StatusTag toneMap={voucherKindTone} value={record.kind} /> },
            { label: '来源单号', value: record.sourceNo },
            { label: '业务对象', value: record.counterparty },
            { label: '凭证金额', value: formatMoney(record.amount) },
            { label: '摘要', value: record.summary, wide: true }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<ProfileOutlined />} title="来源依据">
        <CompactDetailTable<AccountingVoucherSourceRef>
          columns={sourceColumns}
          dataSource={record.sourceRefs}
          rowKey={(sourceRef) => `${sourceRef.module}-${sourceRef.recordId}-${sourceRef.role}`}
          scrollX={420}
        />
      </DetailSection>

      {record.taxBasis ? (
        <DetailSection icon={<FileTextOutlined />} title="税额依据">
          <DetailInfoGrid columns={3} items={taxBasisItems} />
        </DetailSection>
      ) : null}

      {record.invoiceRefs.length > 0 ? (
        <DetailSection icon={<FileTextOutlined />} title="发票明细">
          <CompactDetailTable<AccountingVoucherInvoiceRef>
            columns={invoiceColumns}
            dataSource={record.invoiceRefs}
            rowKey="id"
            scrollX={760}
          />
        </DetailSection>
      ) : null}

      {record.issueReasons.length > 0 ? (
        <DetailSection icon={<ExclamationCircleOutlined />} title="前置条件">
          <DetailInfoGrid
            columns={2}
            items={record.issueReasons.map((issue) => ({
              label: accountingVoucherIssueLabels[issue],
              value: getIssueAction(issue)
            }))}
          />
        </DetailSection>
      ) : null}

      <DetailSection icon={<FileTextOutlined />} title="分录明细">
        <CompactDetailTable<AccountingVoucherLine>
          columns={lineColumns}
          dataSource={record.lines}
          rowKey="id"
          scrollX={720}
        />
      </DetailSection>

      {ledgerEntries.length > 0 ? (
        <DetailSection icon={<FileTextOutlined />} title="总账影响">
          <CompactDetailTable<AccountingLedgerEntry>
            columns={ledgerColumns}
            dataSource={ledgerEntries}
            rowKey="id"
            scrollX={720}
          />
        </DetailSection>
      ) : null}
    </DetailDrawerShell>
  );
}

export function FinanceAccountingVouchersPage() {
  const {
    accountingPeriodLocks,
    accountingVoucherLifecycleRows,
    financeRows,
    invoiceRows,
    prepareAccountingVoucher,
    postAccountingVoucher,
    receivablePayableRows,
    reverseAccountingVoucher,
    taxMatterRows
  } = useFinanceManagement();
  const [filters, setFilters] = useState<AccountingVoucherFilters>(defaultAccountingVoucherFilters);
  const [activeVoucherId, setActiveVoucherId] = useState<string>();

  const generatedVoucherRows = useMemo(
    () => buildAccountingVouchers(receivablePayableRows, financeRows, invoiceRows, taxMatterRows),
    [financeRows, invoiceRows, receivablePayableRows, taxMatterRows]
  );
  const voucherRows = useMemo(
    () => applyAccountingVoucherLifecycle(generatedVoucherRows, accountingVoucherLifecycleRows),
    [accountingVoucherLifecycleRows, generatedVoucherRows]
  );
  const filteredRows = useMemo(
    () => voucherRows.filter((record) => matchesAccountingVoucherFilters(record, filters)),
    [filters, voucherRows]
  );
  const metrics = useMemo(() => buildAccountingVoucherMetrics(filteredRows), [filteredRows]);
  const activeRecord = useMemo(
    () => voucherRows.find((record) => record.id === activeVoucherId),
    [activeVoucherId, voucherRows]
  );
  const canPrepareActiveRecord = activeRecord ? canPrepareAccountingVoucher(activeRecord, accountingPeriodLocks) : false;
  const canPostActiveRecord = activeRecord ? canPostAccountingVoucher(activeRecord, accountingPeriodLocks) : false;
  const canReverseActiveRecord = activeRecord ? canReverseAccountingVoucher(activeRecord, accountingPeriodLocks) : false;

  const columns: TableColumnsType<AccountingVoucherRecord> = [
    {
      title: '凭证',
      key: 'voucher',
      width: 230,
      render: (_, record) => <CompactCell primary={record.voucherNo} secondary={record.summary} />
    },
    {
      title: '凭证业务',
      dataIndex: 'businessType',
      width: 112,
      render: (businessType: AccountingVoucherBusinessType) => <StatusTag toneMap={voucherBusinessTone} value={businessType} />
    },
    {
      title: '凭证状态',
      dataIndex: 'status',
      width: 104,
      render: (status: AccountingVoucherStatus) => <StatusTag toneMap={voucherStatusTone} value={status} />
    },
    {
      title: '前置条件',
      key: 'issueSummary',
      width: 160,
      render: (_, record) => (
        <CellText tone={record.issueReasons.length > 0 ? 'risk' : 'subtle'}>
          {record.issueReasons.length > 0 ? getAccountingVoucherIssueSummary(record) : '已满足'}
        </CellText>
      )
    },
    {
      title: '归属月份',
      dataIndex: 'accountingPeriod',
      width: 112
    },
    {
      title: '业务对象',
      dataIndex: 'counterparty',
      width: 150
    },
    {
      title: '借方',
      key: 'debitSubject',
      width: 190,
      render: (_, record) => getVoucherSubjects(record, '借方')
    },
    {
      title: '贷方',
      key: 'creditSubject',
      width: 190,
      render: (_, record) => getVoucherSubjects(record, '贷方')
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      render: (amount: number) => <CellText tone="strong">{formatMoney(amount)}</CellText>
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={6}>
          <MetricCard icon={<ClockCircleOutlined />} label="待生成" value={metrics.pendingGenerationCount} />
          <MetricCard icon={<WarningOutlined />} label="需处理" value={metrics.issueCount} />
          <MetricCard icon={<FileTextOutlined />} label="待制单" value={metrics.readyToPrepareCount} />
          <MetricCard icon={<ProfileOutlined />} label="已制单" value={metrics.preparedCount} />
          <MetricCard icon={<CheckCircleOutlined />} label="已入账" value={metrics.postedCount} />
          <MetricCard icon={<RollbackOutlined />} label="已冲销" value={metrics.reversedCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={accountingVoucherDefaultMonth}
              label="归属月份"
              testIdPrefix="finance-accounting-voucher-period"
              value={filters.accountingPeriodTime}
              onChange={(accountingPeriodTime) => setFilters((current) => ({ ...current, accountingPeriodTime }))}
            />
            <FilterField label="凭证业务">
              <Select
                data-testid="finance-accounting-voucher-business-filter"
                options={(['全部', '权责凭证', '资金凭证', '税费凭证', '调整凭证'] satisfies Array<'全部' | AccountingVoucherBusinessType>).map((businessType) => ({
                  label: businessType,
                  value: businessType
                }))}
                value={filters.businessType}
                onChange={(businessType) => setFilters((current) => ({ ...current, businessType }))}
              />
            </FilterField>
            <FilterField label="凭证状态">
              <Select
                data-testid="finance-accounting-voucher-status-filter"
                options={(['全部', ...accountingVoucherStatusOptions] satisfies Array<'全部' | AccountingVoucherStatus>).map((status) => ({
                  label: status,
                  value: status
                }))}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-accounting-voucher-keyword-input"
              placeholder="凭证号 / 来源单号 / 科目 / 对象"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-accounting-vouchers"
    >
      <ManagementTable<AccountingVoucherRecord>
        columns={columns}
        count={{ value: filteredRows.length, unit: '张凭证' }}
        dataSource={filteredRows}
        rowKey="id"
        rowTestIdPrefix="finance-accounting-voucher-table-row"
        tableTestId="finance-accounting-voucher-table"
        onRowClick={(record) => setActiveVoucherId(record.id)}
      />

      <AccountingVoucherDetailDrawer
        canPrepare={canPrepareActiveRecord}
        canPost={canPostActiveRecord}
        canReverse={canReverseActiveRecord}
        record={activeRecord}
        onPrepare={(record) => prepareAccountingVoucher(record)}
        onPost={(record) => postAccountingVoucher(record)}
        onReverse={(record) => reverseAccountingVoucher(record, '前端演示冲销')}
        onClose={() => setActiveVoucherId(undefined)}
      />
    </ManagementPageScaffold>
  );
}
