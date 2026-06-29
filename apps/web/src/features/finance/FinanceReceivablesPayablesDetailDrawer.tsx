import {
  CalendarOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Button } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { TagChip } from '../../components/TagChip';
import type { FinanceTransactionRecord } from './financeData';
import type { FinanceInvoiceRecord } from './financeInvoiceData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  getReceivablePayableOutstandingAmount,
  receivablePayableDirectionTone,
  receivablePayableReviewProgressTone,
  receivablePayableSettlementStatusTone
} from './financeReceivablesPayablesData';
import {
  getFinanceReceivablePayableAmountLabels,
  getFinanceReceivablePayableDueDate,
  getFinanceReceivablePayableMissingAccountingRoleLabels,
  getFinanceReceivablePayableReviewProgressStatus,
  getFinanceReceivablePayableSourceLabel,
  hasFinanceReceivablePayableActiveSettlement,
  isFinanceReceivablePayableOverdue,
  type FinanceReceivablePayableSettlementFormValue,
  getFinanceReceivablePayableSettlementProgress
} from './financeReceivablesPayablesModel';
import { formatMoney } from './financeUtils';
import { FinanceReceivablesPayablesSettlementPanel } from './FinanceReceivablesPayablesSettlementPanel';
import type { FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';

type FinanceReceivablesPayablesDetailDrawerProps = {
  accountOptions: Array<{ label: string; value: string }>;
  registerableAmount: number;
  recordEditable: boolean;
  settlementForm: FinanceReceivablePayableSettlementFormValue;
  settlementSubmitDisabled: boolean;
  linkedInvoiceRows: FinanceInvoiceRecord[];
  linkedTransactionRows: FinanceTransactionRecord[];
  onClose: () => void;
  onDownloadFile: (file: RelatedFileRecord) => void;
  onEdit: (record: FinanceReceivablePayableRecord) => void;
  onPreviewFile: (file: RelatedFileRecord) => void;
  onRemoveSettlementFile: (file: RelatedFileRecord) => void;
  onSelectSettlementFile: (file: FinanceVoucherUploadFile) => void;
  onSubmitSettlement: () => void;
  onUpdateSettlementForm: <K extends keyof FinanceReceivablePayableSettlementFormValue>(
    field: K,
    value: FinanceReceivablePayableSettlementFormValue[K]
  ) => void;
  record?: FinanceReceivablePayableRecord;
};

type LinkedInvoiceDetailRow = {
  id: string;
  invoice: FinanceInvoiceRecord;
  matchedAmount: number;
};

const invoiceDirectionTone = {
  销项: 'green',
  进项: 'blue'
} as const;

export function FinanceReceivablesPayablesDetailDrawer({
  accountOptions,
  registerableAmount,
  recordEditable,
  settlementForm,
  settlementSubmitDisabled,
  linkedInvoiceRows,
  linkedTransactionRows,
  onClose,
  onDownloadFile,
  onEdit,
  onPreviewFile,
  onRemoveSettlementFile,
  onSelectSettlementFile,
  onSubmitSettlement,
  onUpdateSettlementForm,
  record
}: FinanceReceivablesPayablesDetailDrawerProps) {
  if (!record) {
    return null;
  }

  const amountLabels = getFinanceReceivablePayableAmountLabels(record.direction);
  const dueDate = getFinanceReceivablePayableDueDate(record);
  const reviewProgressStatus = getFinanceReceivablePayableReviewProgressStatus(record, linkedTransactionRows);
  const overdue = isFinanceReceivablePayableOverdue(record);
  const outstandingAmount = getReceivablePayableOutstandingAmount(record);
  const hasActiveSettlement = hasFinanceReceivablePayableActiveSettlement(linkedTransactionRows);
  const missingAccountingRoleLabels = getFinanceReceivablePayableMissingAccountingRoleLabels(record);
  const linkedInvoiceDetailRows = linkedInvoiceRows.map((invoice) => ({
    id: invoice.id,
    invoice,
    matchedAmount: invoice.matchedBusinessRefs
      .filter((ref) =>
        ref.recordId === record.id ||
        ref.recordNo === record.documentNo ||
        ref.sourceNo === record.sourceNo
      )
      .reduce((total, ref) => total + ref.amount, 0)
  }));
  const invoiceColumns: TableColumnsType<LinkedInvoiceDetailRow> = [
    {
      title: '发票号',
      dataIndex: ['invoice', 'invoiceNo'],
      width: 180
    },
    {
      title: '方向',
      dataIndex: ['invoice', 'direction'],
      width: 86,
      render: (_direction: string, row) => <StatusTag toneMap={invoiceDirectionTone} value={row.invoice.direction} />
    },
    {
      title: '开票日期',
      dataIndex: ['invoice', 'invoiceDate'],
      width: 112
    },
    {
      title: '发票金额',
      dataIndex: ['invoice', 'taxIncludedAmount'],
      width: 120,
      render: (_amount: number, row) => formatMoney(row.invoice.taxIncludedAmount)
    },
    {
      title: '税额',
      dataIndex: ['invoice', 'taxAmount'],
      width: 120,
      render: (_amount: number, row) => formatMoney(row.invoice.taxAmount)
    },
    {
      title: '匹配金额',
      dataIndex: 'matchedAmount',
      width: 120,
      render: (amount: number) => formatMoney(amount)
    }
  ];
  const settlementTabLabel = hasActiveSettlement
    ? record.direction === '应收'
      ? '收款进度'
      : '付款进度'
    : record.direction === '应收'
      ? '收款登记'
      : '付款登记';

  return (
    <DetailDrawerShell
      bodyTestId="finance-rp-detail-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      title={
        <DetailDrawerTitle
          status={record.settlementStatus}
          statusToneMap={receivablePayableSettlementStatusTone}
          subtitle={`${record.documentNo} / ${record.accountingPeriod}`}
          title={`${record.direction}事项`}
        />
      }
      width={780}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          {
            icon: <ProfileOutlined />,
            key: 'counterparty',
            label: '往来对象',
            value: record.counterparty
          },
          {
            icon: <FileProtectOutlined />,
            key: 'amount',
            label: amountLabels.amount,
            value: formatMoney(record.amount)
          },
          {
            icon: <WalletOutlined />,
            key: 'outstanding',
            label: amountLabels.outstanding,
            value: formatMoney(outstandingAmount)
          },
          {
            icon: <CalendarOutlined />,
            key: 'dueDate',
            label: '到期日',
            value: dueDate
          }
        ]}
      />

      <DetailTabs
        items={[
          {
            children: (
              <DetailSection
                extra={
                  recordEditable ? (
                    <Button size="small" onClick={() => onEdit(record)}>
                      调整事项
                    </Button>
                  ) : (
                    <TagChip label="已有收付进度，事项锁定" tone="blue" />
                  )
                }
                icon={<ProfileOutlined />}
                title="权责事项"
              >
                <DetailInfoGrid
                  columns={3}
                  items={[
                    {
                      label: '收付方向',
                      value: <StatusTag toneMap={receivablePayableDirectionTone} value={record.direction} />
                    },
                    {
                      label: '结清状态',
                      value: <StatusTag toneMap={receivablePayableSettlementStatusTone} value={record.settlementStatus} />
                    },
                    {
                      label: '流水复核',
                      value: reviewProgressStatus ? (
                        <StatusTag toneMap={receivablePayableReviewProgressTone} value={reviewProgressStatus} />
                      ) : (
                        '-'
                      )
                    },
                    { label: '结清比例', value: getFinanceReceivablePayableSettlementProgress(record) },
                    { label: '归属月份', value: record.accountingPeriod },
                    { label: '确认日期', value: record.confirmDate },
                    { label: '到期日', value: dueDate },
                    {
                      label: '逾期风险',
                      value: overdue ? <StatusTag tone="red" value="逾期" /> : '未逾期'
                    },
                    { label: '财务类目', value: record.category },
                    {
                      label: '权责制单科目',
                      value: missingAccountingRoleLabels.length > 0
                        ? `待配置：${missingAccountingRoleLabels.join(' / ')}`
                        : '科目已配置'
                    },
                    { label: '经办人', value: record.owner },
                    { label: '业务来源', value: getFinanceReceivablePayableSourceLabel(record.sourceType) },
                    { label: '来源单号', value: record.sourceNo },
                    { label: '来源名称', value: record.sourceTitle },
                    { label: amountLabels.amount, value: formatMoney(record.amount) },
                    { label: amountLabels.settled, value: formatMoney(record.settledAmount) },
                    { label: amountLabels.outstanding, value: formatMoney(outstandingAmount) },
                    { label: '备注', value: record.note, wide: true }
                  ]}
                />
              </DetailSection>
            ),
            key: 'basic',
            label: '权责事项'
          },
          {
            children: (
              <FinanceReceivablesPayablesSettlementPanel
                accountOptions={accountOptions}
                form={settlementForm}
                linkedTransactionRows={linkedTransactionRows}
                maxAmount={registerableAmount}
                record={record}
                submitDisabled={settlementSubmitDisabled}
                onDownloadFile={onDownloadFile}
                onPreviewFile={onPreviewFile}
                onRemoveFile={onRemoveSettlementFile}
                onSelectFile={onSelectSettlementFile}
                onSubmit={onSubmitSettlement}
                onUpdate={onUpdateSettlementForm}
              />
            ),
            key: 'settlement',
            label: settlementTabLabel
          },
          {
            children: (
              <DetailSection icon={<FileTextOutlined />} title="发票/票据匹配">
                <CompactDetailTable<LinkedInvoiceDetailRow>
                  columns={invoiceColumns}
                  dataSource={linkedInvoiceDetailRows}
                  emptyText="暂无关联发票"
                  rowKey="id"
                  scrollX={760}
                />
              </DetailSection>
            ),
            key: 'invoices',
            label: '发票/票据'
          },
          {
            children: (
              <DetailSection icon={<FileProtectOutlined />} title="确认依据">
                <RelatedFileTable records={record.files} onDownload={onDownloadFile} onPreview={onPreviewFile} />
              </DetailSection>
            ),
            key: 'files',
            label: '确认依据'
          },
          {
            children: (
              <OperationRecordSection
                icon={<CheckCircleOutlined />}
                records={record.operationRecords}
                title="操作记录"
              />
            ),
            key: 'operations',
            label: '操作记录'
          }
        ]}
        tabTestIdPrefix="finance-rp-detail-tab"
        testId="finance-rp-detail-tabs"
      />
    </DetailDrawerShell>
  );
}
