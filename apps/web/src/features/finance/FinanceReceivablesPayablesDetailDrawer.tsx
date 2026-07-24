import {
  CalendarOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  LinkOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Alert, Button } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { TagChip } from '../../components/TagChip';
import type { FinanceTransactionRecord } from './financeData';
import {
  getCustomerTaskSettlementCorrectionActions,
  type CustomerTaskSettlementMergeIssue
} from './financeCustomerTaskSettlementModel';
import { getClosedAccountingPeriodReadbackNotice } from './financeAccountingVoucherModel';
import type { FinanceInvoiceBusinessAllocation, FinanceInvoiceRecord } from './financeInvoiceData';
import type {
  FinanceCustomerTaskSettlementLine,
  FinanceReceivablePayableRecord
} from './financeReceivablesPayablesData';
import {
  getReceivablePayableConfirmedAmount,
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
import { resolveFinanceAccrualTaxBasis } from './financeTaxBasisModel';
import type { FinanceTaxBasisSource, FinanceTaxEvidenceStatus } from './financeTaxBasisModel';
import { formatMoney } from './financeUtils';
import { FinanceReceivablesPayablesSettlementPanel } from './FinanceReceivablesPayablesSettlementPanel';
import type { FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';

type FinanceReceivablesPayablesDetailDrawerProps = {
  accountOptions: Array<{ label: string; value: string }>;
  registerableAmount: number;
  recordEditable: boolean;
  recordEditBlockedReason?: string;
  recordLockedReason?: string;
  settlementForm: FinanceReceivablePayableSettlementFormValue;
  settlementSubmitDisabled: boolean;
  linkedInvoiceRows: FinanceInvoiceRecord[];
  linkedTransactionRows: FinanceTransactionRecord[];
  invoiceAssociationLockedReason?: string;
  invoiceBusinessAllocationRows: FinanceInvoiceBusinessAllocation[];
  recordHasBookedVoucher: boolean;
  taskSettlementIssue?: CustomerTaskSettlementMergeIssue;
  onAssociateInvoice?: (record: FinanceReceivablePayableRecord) => void;
  onOpenAccountingVoucher?: (record: FinanceReceivablePayableRecord, issue?: CustomerTaskSettlementMergeIssue) => void;
  onOpenInvoiceCorrection?: (invoice: FinanceInvoiceRecord) => void;
  onOpenLinkedTransaction?: (record: FinanceTransactionRecord) => void;
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

const taxBasisSourceTone = {
  来源单据: 'blue',
  发票台账: 'green',
  不涉及发票: 'gray',
  待确认: 'amber'
} as const satisfies Record<FinanceTaxBasisSource, 'amber' | 'blue' | 'gray' | 'green'>;

const taxEvidenceStatusTone = {
  发票已匹配: 'green',
  发票部分匹配: 'blue',
  发票待补: 'amber',
  不涉及发票: 'gray',
  待确认: 'amber'
} as const satisfies Record<FinanceTaxEvidenceStatus, 'amber' | 'blue' | 'gray' | 'green'>;

export function FinanceReceivablesPayablesDetailDrawer({
  accountOptions,
  registerableAmount,
  recordEditable,
  recordEditBlockedReason,
  recordLockedReason,
  settlementForm,
  settlementSubmitDisabled,
  linkedInvoiceRows,
  linkedTransactionRows,
  invoiceAssociationLockedReason,
  invoiceBusinessAllocationRows,
  recordHasBookedVoucher,
  taskSettlementIssue,
  onAssociateInvoice,
  onOpenAccountingVoucher,
  onOpenInvoiceCorrection,
  onOpenLinkedTransaction,
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
  const confirmedAmount = getReceivablePayableConfirmedAmount(record);
  const dueDate = getFinanceReceivablePayableDueDate(record);
  const reviewProgressStatus = getFinanceReceivablePayableReviewProgressStatus(record, linkedTransactionRows);
  const overdue = isFinanceReceivablePayableOverdue(record);
  const outstandingAmount = getReceivablePayableOutstandingAmount(record);
  const hasActiveSettlement = hasFinanceReceivablePayableActiveSettlement(linkedTransactionRows);
  const missingAccountingRoleLabels = getFinanceReceivablePayableMissingAccountingRoleLabels(record);
  const taxBasis = resolveFinanceAccrualTaxBasis(record, linkedInvoiceRows, invoiceBusinessAllocationRows);
  const naturalPersonPayment = record.naturalPersonPayment;
  const laborPayment = naturalPersonPayment?.incomeType === '劳务报酬' ? naturalPersonPayment : undefined;
  const salarySettlement = record.salarySettlement;
  const taskSettlement = record.taskSettlement;
  const activeLinkedTransaction = linkedTransactionRows.find((row) => row.status !== '已作废');
  const adjustedTaskSettlementAmount = taskSettlementIssue
    ? Math.max(0, Number((confirmedAmount + taskSettlementIssue.differenceAmount).toFixed(2)))
    : undefined;
  const taskSettlementCorrectionActions = getCustomerTaskSettlementCorrectionActions({
    hasBookedVoucher: recordHasBookedVoucher,
    hasLinkedInvoice: linkedInvoiceRows.length > 0,
    hasLinkedTransaction: Boolean(activeLinkedTransaction),
    periodLocked: Boolean(recordLockedReason)
  });
  const periodReadbackNotice = recordLockedReason
    ? getClosedAccountingPeriodReadbackNotice(record.accountingPeriod, '当前权责事项')
    : undefined;
  const linkedInvoiceDetailRows = linkedInvoiceRows.map((invoice) => ({
    id: invoice.id,
    invoice,
    matchedAmount: invoiceBusinessAllocationRows
      .filter((allocation) => (
        allocation.status === '有效' &&
        allocation.invoiceId === invoice.id &&
        allocation.targetType === '应收应付' &&
        allocation.targetId === record.id
      ))
      .reduce((total, allocation) => total + allocation.taxIncludedAmount, 0)
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
  const taskSettlementColumns: TableColumnsType<FinanceCustomerTaskSettlementLine> = [
    {
      title: '来源任务',
      dataIndex: 'taskName',
      width: 240,
      render: (_taskName: string, row) => (
        <div>
          <div>{row.taskName}</div>
          <div className="secondary-text">{row.taskCode} / {row.storeName}</div>
          {row.customerAcceptanceRemark ? (
            <div className="secondary-text">{row.customerAcceptanceRemark}</div>
          ) : null}
          {row.customerAcceptanceCorrectionReason ? (
            <div className="secondary-text">更正：{row.customerAcceptanceCorrectionReason}</div>
          ) : null}
        </div>
      )
    },
    {
      title: '甲方验收',
      dataIndex: 'customerAcceptedOn',
      width: 150,
      render: (_acceptedOn: string, row) => (
        <div>
          <div>{row.customerAcceptedOn}</div>
          <div className="secondary-text">{row.customerAcceptanceRecordedBy}</div>
        </div>
      )
    },
    {
      title: '验收结果',
      dataIndex: 'customerScore',
      width: 125,
      render: (_score: number, row) => (
        <div>
          <div>{row.customerScore} 分 / {row.timelinessResult}</div>
          <div className="secondary-text">累计扣罚 {row.totalPenaltyPoints} 分</div>
        </div>
      )
    },
    {
      title: '标准金额',
      dataIndex: 'standardAmount',
      align: 'right',
      width: 120,
      render: (amount: number) => formatMoney(amount)
    },
    {
      title: '扣款',
      dataIndex: 'deductionAmount',
      align: 'right',
      width: 110,
      render: (_amount: number, row) => (
        <div>
          <div>{formatMoney(row.deductionAmount)}</div>
          <div className="secondary-text">{Math.round(row.deductionRate * 100)}%</div>
        </div>
      )
    },
    {
      title: '内部验收',
      dataIndex: 'acceptedAt',
      width: 150,
      render: (_acceptedAt: string, row) => (
        <div>
          <div>{row.acceptedAt}</div>
          <div className="secondary-text">{row.acceptedBy}</div>
        </div>
      )
    },
    {
      title: '价格版本',
      dataIndex: 'priceVersion',
      width: 112,
      render: (_version: number, row) => (
        <div>V{row.priceVersion}</div>
      )
    },
    {
      title: '应收净额',
      dataIndex: 'amount',
      align: 'right',
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
            label: laborPayment ? '税前应付' : salarySettlement ? '员工实发应付' : amountLabels.amount,
            value: formatMoney(confirmedAmount)
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
              <>
                {taskSettlementIssue ? (
                  <DetailSection icon={<LinkOutlined />} title="来源更正">
                    <Alert
                      data-testid="finance-rp-task-settlement-correction-alert"
                      description={taskSettlementIssue.message}
                      message={taskSettlementIssue.kind}
                      showIcon
                      type="warning"
                    />
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '原确认金额', value: formatMoney(confirmedAmount) },
                        { label: '更正差额', value: formatMoney(taskSettlementIssue.differenceAmount) },
                        { label: '更正后金额', value: formatMoney(adjustedTaskSettlementAmount ?? confirmedAmount) }
                      ]}
                    />
                    <div className="detail-section-action-row finance-rp-task-settlement-actions">
                      {taskSettlementCorrectionActions.includes('调整发票关联') && onAssociateInvoice && !invoiceAssociationLockedReason ? (
                        <Button icon={<LinkOutlined />} onClick={() => onAssociateInvoice(record)}>
                          调整发票关联
                        </Button>
                      ) : null}
                      {taskSettlementCorrectionActions.includes('处理发票更正') && linkedInvoiceRows[0] && onOpenInvoiceCorrection ? (
                        <Button icon={<LinkOutlined />} onClick={() => onOpenInvoiceCorrection(linkedInvoiceRows[0])}>
                          处理发票更正
                        </Button>
                      ) : null}
                      {taskSettlementCorrectionActions.includes('查看关联流水') && activeLinkedTransaction && onOpenLinkedTransaction ? (
                        <Button onClick={() => onOpenLinkedTransaction(activeLinkedTransaction)}>
                          查看关联流水
                        </Button>
                      ) : null}
                      {taskSettlementCorrectionActions.includes('处理会计凭证') && onOpenAccountingVoucher ? (
                        <Button type="primary" onClick={() => onOpenAccountingVoucher(record, taskSettlementIssue)}>
                          处理会计凭证
                        </Button>
                      ) : null}
                    </div>
                  </DetailSection>
                ) : null}
                <DetailSection
                  extra={
                  recordEditable ? (
                    <Button size="small" onClick={() => onEdit(record)}>
                      调整事项
                    </Button>
                  ) : (
                    <TagChip label={recordEditBlockedReason ?? (recordLockedReason ? '只读回看' : '已有收付进度，事项锁定')} tone="blue" />
                  )
                }
                icon={<ProfileOutlined />}
                title="权责事项"
              >
                {periodReadbackNotice ? (
                  <Alert className="finance-period-readback-alert" message={periodReadbackNotice} showIcon type="info" />
                ) : null}
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
                      label: '权责记账科目',
                      value: missingAccountingRoleLabels.length > 0
                        ? `待配置：${missingAccountingRoleLabels.join(' / ')}`
                        : '科目已配置'
                    },
                    { label: '经办人', value: record.owner },
                    { label: '业务来源', value: getFinanceReceivablePayableSourceLabel(record.sourceType) },
                    { label: '来源单号', value: record.sourceNo },
                    { label: '来源名称', value: record.sourceTitle },
                    { label: amountLabels.amount, value: formatMoney(confirmedAmount) },
                    ...(taskSettlement
                      ? [
                          { label: '品牌', value: taskSettlement.brandName },
                          { label: '结算方式', value: taskSettlement.settlementMode },
                          {
                            label: '依据合同',
                            value: taskSettlement.contractCode
                              ? `${taskSettlement.contractCode} / ${taskSettlement.contractName ?? '-'}`
                              : '-'
                          }
                        ]
                      : []),
                    ...(laborPayment
                      ? [
                          { label: '所得类型', value: laborPayment.incomeType },
                          { label: '税前金额', value: formatMoney(laborPayment.grossIncomeAmount) },
                          { label: '代扣个税', value: formatMoney(laborPayment.withheldTaxAmount) },
                          { label: '银行实付', value: formatMoney(laborPayment.netPaymentAmount) },
                          { label: '预计扣缴期间', value: '按实际付款月份确定' },
                          { label: '结算批次', value: laborPayment.sourceBatchNo },
                          {
                            label: '来源任务',
                            value: laborPayment.sourceRecordNos?.join('、') || '-'
                          }
                        ]
                      : []),
                    ...(salarySettlement
                      ? [
                          { label: '工资薪金', value: formatMoney(salarySettlement.employeeGrossPayableAmount) },
                          { label: '个人社保', value: formatMoney(salarySettlement.employeeSocialInsuranceAmount) },
                          { label: '个人公积金', value: formatMoney(salarySettlement.employeeHousingFundAmount) },
                          { label: '代扣个税', value: formatMoney(salarySettlement.withheldPersonalIncomeTaxAmount) },
                          { label: '员工实发', value: formatMoney(salarySettlement.employeeNetPayableAmount) },
                          { label: '单位承担', value: formatMoney(salarySettlement.employerContributionAmount) }
                        ]
                      : []),
                    { label: amountLabels.settled, value: formatMoney(record.settledAmount) },
                    { label: amountLabels.outstanding, value: formatMoney(outstandingAmount) },
                    { label: '备注', value: record.note, wide: true }
                  ]}
                />
                {taskSettlement ? (
                  <CompactDetailTable<FinanceCustomerTaskSettlementLine>
                    columns={taskSettlementColumns}
                    dataSource={taskSettlement.lineItems}
                    emptyText="暂无来源任务"
                    rowKey="taskId"
                    scrollX={1120}
                  />
                ) : null}
                </DetailSection>
              </>
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
                  lockedReason={recordLockedReason}
                  lockedNotice={periodReadbackNotice}
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
              <>
                <DetailSection icon={<FileTextOutlined />} title="税额依据">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      {
                        label: '依据来源',
                        value: <StatusTag toneMap={taxBasisSourceTone} value={taxBasis.basisSource} />
                      },
                      {
                        label: '票据状态',
                        value: <StatusTag toneMap={taxEvidenceStatusTone} value={taxBasis.evidenceStatus} />
                      },
                      { label: '业务税务分类', value: taxBasis.taxableClassification ?? '-' },
                      { label: '本期税额口径', value: taxBasis.taxOutcome ?? '以票面或申报结果为准' },
                      { label: '税率', value: taxBasis.taxRate },
                      { label: '价税合计', value: formatMoney(taxBasis.taxIncludedAmount) },
                      { label: '不含税金额', value: formatMoney(taxBasis.taxExcludedAmount) },
                      { label: '税额', value: formatMoney(taxBasis.taxAmount) },
                      { label: '已匹配发票', value: formatMoney(taxBasis.matchedInvoiceAmount) }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<FileTextOutlined />} title="发票/票据匹配">
                  {onAssociateInvoice && taxBasis.basisSource !== '不涉及发票' ? (
                    invoiceAssociationLockedReason ? (
                      <Alert message={invoiceAssociationLockedReason} showIcon type="info" />
                    ) : (
                      <div className="detail-section-action-row">
                        <Button
                          icon={<LinkOutlined />}
                          type="primary"
                          onClick={() => onAssociateInvoice(record)}
                        >
                          关联发票
                        </Button>
                      </div>
                    )
                  ) : null}
                  <CompactDetailTable<LinkedInvoiceDetailRow>
                    columns={invoiceColumns}
                    dataSource={linkedInvoiceDetailRows}
                    emptyText="暂无关联发票"
                    rowKey="id"
                    scrollX={760}
                  />
                </DetailSection>
              </>
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
