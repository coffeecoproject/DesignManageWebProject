import { FileSearchOutlined, FileTextOutlined, LinkOutlined, RollbackOutlined, WalletOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Alert, Checkbox, InputNumber, message, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import {
  buildBusinessInvoiceAssociationCandidates,
  buildInvoiceBusinessAssociationCandidates,
  buildInvoiceBusinessAssociationDrafts,
  doesInvoiceAllocationMatchReceivablePayable,
  haveBusinessInvoiceAssociationDraftsChanged,
  haveInvoiceAssociationDraftsChanged,
  type FinanceBusinessInvoiceAssociationDraft,
  type FinanceBusinessInvoiceAssociationCandidate,
  type FinanceInvoiceAssociationMatchBasis,
  type FinanceInvoiceBusinessAssociationCandidate
} from './financeInvoiceAssociationModel';
import { buildOriginalInvoiceRedSummary, getInvoiceMatchStatus, getRedInvoiceOriginalAssociationStatus } from './financeInvoiceModel';
import type { FinanceInvoiceBusinessAllocation, FinanceInvoiceRecord } from './financeInvoiceData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import { hasFinanceReceivablePayableBookedVoucher } from './financeReceivablesPayablesModel';
import { formatMoney } from './financeUtils';

type FinanceInvoiceAssociationDrawerProps = {
  businessRecord?: FinanceReceivablePayableRecord;
  invoice?: FinanceInvoiceRecord;
  open: boolean;
  onClose: () => void;
};

type RedInvoiceCandidateRow = {
  availableRedAmount: number;
  id: string;
  invoice: FinanceInvoiceRecord;
  isOverLimit: boolean;
};

type InvoiceAllocationRow = FinanceInvoiceBusinessAllocation & {
  key: string;
};

const associationStatusTone = {
  已匹配: 'green',
  未匹配: 'amber',
  部分匹配: 'blue',
  已作废: 'gray'
} as const;

const directionTone = {
  销项: 'green',
  进项: 'blue'
} as const;

const matchBasisTone = {
  已有关联: 'green',
  来源单据: 'green',
  名称一致: 'gray',
  报销票据: 'blue',
  红冲原票: 'gray'
} as const satisfies Record<FinanceInvoiceAssociationMatchBasis, 'blue' | 'gray' | 'green'>;

const invoiceFileStatusTone = {
  已上传: 'green'
} as const;

function getBusinessReferenceAmount(
  invoice: FinanceInvoiceRecord,
  businessRecord: FinanceReceivablePayableRecord,
  allocations: FinanceInvoiceBusinessAllocation[]
) {
  return allocations
    .filter((allocation) => allocation.invoiceId === invoice.id && allocation.status === '有效')
    .filter((allocation) => doesInvoiceAllocationMatchReceivablePayable(allocation, businessRecord))
    .reduce((total, allocation) => total + Math.max(0, allocation.taxIncludedAmount), 0);
}

function formatAmountInput(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getInvoiceAssociationStatusLabel(status: ReturnType<typeof getInvoiceMatchStatus>) {
  if (status === '已匹配') {
    return '已关联';
  }

  if (status === '部分匹配') {
    return '部分关联';
  }

  if (status === '未匹配') {
    return '待关联';
  }

  return status;
}

export function FinanceInvoiceAssociationDrawer({ businessRecord, invoice, open, onClose }: FinanceInvoiceAssociationDrawerProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    accountingVoucherLifecycleRows,
    getAccountingPeriodGuard,
    invoiceBusinessAllocationRows,
    invoiceRows,
    linkRedInvoiceOriginal,
    receivablePayableRows,
    replaceBusinessInvoiceAssociations,
    replaceInvoiceBusinessAssociations
  } = useFinanceManagement();
  const [amountsByCandidateId, setAmountsByCandidateId] = useState<Record<string, number>>({});
  const [previewFile, setPreviewFile] = useState<RelatedFileRecord>();
  const [redOriginalInvoiceId, setRedOriginalInvoiceId] = useState<string>();
  const activeInvoice = invoice ? invoiceRows.find((record) => record.id === invoice.id) : undefined;
  const activeBusinessRecord = businessRecord
    ? receivablePayableRows.find((record) => record.id === businessRecord.id)
    : undefined;
  const activeMode = activeInvoice ? 'invoice' : activeBusinessRecord ? 'business' : undefined;
  const activeInvoiceAllocationRows = useMemo<InvoiceAllocationRow[]>(
    () => activeInvoice
      ? invoiceBusinessAllocationRows
          .filter((allocation) => allocation.invoiceId === activeInvoice.id && allocation.status === '有效')
          .map((allocation) => ({ ...allocation, key: allocation.id }))
      : [],
    [activeInvoice, invoiceBusinessAllocationRows]
  );
  const invoiceBusinessCandidates = useMemo(
    () => (activeInvoice ? buildInvoiceBusinessAssociationCandidates(activeInvoice, invoiceRows, invoiceBusinessAllocationRows, receivablePayableRows) : []),
    [activeInvoice, invoiceBusinessAllocationRows, invoiceRows, receivablePayableRows]
  );
  const businessInvoiceCandidates = useMemo(
    () => (activeBusinessRecord ? buildBusinessInvoiceAssociationCandidates(activeBusinessRecord, invoiceRows, invoiceBusinessAllocationRows) : []),
    [activeBusinessRecord, invoiceBusinessAllocationRows, invoiceRows]
  );
  const redInvoiceCandidates = useMemo<RedInvoiceCandidateRow[]>(
    () => {
      if (!activeInvoice || activeInvoice.invoiceStatus !== '红冲') {
        return [];
      }

      return invoiceRows
        .filter((record) => (
          record.id !== activeInvoice.id &&
          record.invoiceStatus === '正常' &&
          record.direction === activeInvoice.direction &&
          record.counterparty === activeInvoice.counterparty &&
          record.invoiceDate <= activeInvoice.invoiceDate
        ))
        .map((record) => {
          const summary = buildOriginalInvoiceRedSummary(record, invoiceRows, activeInvoice);
          const allocatableAmount = invoiceBusinessAllocationRows
            .filter((allocation) => (
              allocation.status === '有效' &&
              allocation.invoiceId === record.id &&
              allocation.taxIncludedAmount > 0
            ))
            .reduce((total, allocation) => total + allocation.taxIncludedAmount, 0);

          return {
            availableRedAmount: Math.min(summary.availableRedAmount, allocatableAmount),
            id: record.id,
            invoice: record,
            isOverLimit: summary.isOverLimit || allocatableAmount + 0.01 < Math.abs(activeInvoice.taxIncludedAmount)
          };
        })
        .filter((record) => !record.isOverLimit)
        .sort((left, right) => right.invoice.invoiceDate.localeCompare(left.invoice.invoiceDate));
    },
    [activeInvoice, invoiceBusinessAllocationRows, invoiceRows]
  );
  const activePeriod = activeInvoice?.accountingPeriod ?? activeBusinessRecord?.accountingPeriod;
  const periodGuard = getAccountingPeriodGuard(activePeriod, '调整发票关联');
  const isRedInvoice = activeInvoice?.invoiceStatus === '红冲';
  const isVoidInvoice = activeInvoice?.invoiceStatus === '作废';
  const associationReadbackReason = useMemo(() => {
    if (activeBusinessRecord) {
      return hasFinanceReceivablePayableBookedVoucher(activeBusinessRecord, accountingVoucherLifecycleRows)
        ? '该事项已生成已记账凭证，不能直接修改发票关联。'
        : undefined;
    }

    if (!activeInvoice) {
      return undefined;
    }

    if (activeInvoice.invoiceStatus === '红冲') {
      return undefined;
    }

    const blockedReference = invoiceBusinessAllocationRows
      .filter((allocation) => allocation.invoiceId === activeInvoice.id && allocation.status === '有效' && allocation.targetType === '应收应付')
      .map((allocation) => receivablePayableRows.find((record) => record.id === allocation.targetId))
      .find((record) => (
        record
        && (
          hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows)
          || !getAccountingPeriodGuard(record.accountingPeriod, '调整发票关联').allowed
        )
      ));

    if (blockedReference) {
      return hasFinanceReceivablePayableBookedVoucher(blockedReference, accountingVoucherLifecycleRows)
        ? '关联事项已生成已记账凭证，不能直接修改发票关联。'
        : '关联事项所在期间已结账，不能直接修改发票关联。';
    }

    return undefined;
  }, [accountingVoucherLifecycleRows, activeBusinessRecord, activeInvoice, getAccountingPeriodGuard, invoiceBusinessAllocationRows, receivablePayableRows]);
  const associationEditable = periodGuard.allowed && !associationReadbackReason && !isVoidInvoice;

  useEffect(() => {
    if (!open) {
      setPreviewFile(undefined);
      return;
    }

    if (activeInvoice) {
      const initialAmounts = Object.fromEntries([
        ...invoiceBusinessCandidates.map((candidate) => [candidate.id, getBusinessReferenceAmount(activeInvoice, candidate.businessRecord, invoiceBusinessAllocationRows)])
      ]);

      setAmountsByCandidateId(initialAmounts);
      setRedOriginalInvoiceId(activeInvoice.originalInvoiceId);
      return;
    }

    if (activeBusinessRecord) {
      setAmountsByCandidateId(
        Object.fromEntries(
          businessInvoiceCandidates.map((candidate) => [candidate.id, getBusinessReferenceAmount(candidate.invoice, activeBusinessRecord, invoiceBusinessAllocationRows)])
        )
      );
    }
  }, [activeBusinessRecord, activeInvoice, businessInvoiceCandidates, invoiceBusinessAllocationRows, invoiceBusinessCandidates, open]);

  const invoiceDrafts = activeInvoice
    ? buildInvoiceBusinessAssociationDrafts(invoiceBusinessCandidates, amountsByCandidateId)
    : [];
  const businessDrafts = activeBusinessRecord
    ? businessInvoiceCandidates.flatMap((candidate): FinanceBusinessInvoiceAssociationDraft[] => {
        const amount = Number((amountsByCandidateId[candidate.id] ?? 0).toFixed(2));

        return amount > 0.01 ? [{ amount, invoiceId: candidate.invoice.id, matchBasis: candidate.matchBasis }] : [];
      })
    : [];
  const selectedAmount = (activeMode === 'invoice' ? invoiceDrafts : businessDrafts).reduce((total, draft) => total + draft.amount, 0);
  const maximumAmount = activeInvoice?.taxIncludedAmount ?? activeBusinessRecord?.amount ?? 0;
  const remainingAmount = Math.max(0, maximumAmount - selectedAmount);
  const haveAssociationChanges = activeInvoice
    ? haveInvoiceAssociationDraftsChanged(activeInvoice.id, invoiceDrafts, invoiceBusinessAllocationRows)
    : activeBusinessRecord
      ? haveBusinessInvoiceAssociationDraftsChanged(activeBusinessRecord.id, businessDrafts, invoiceBusinessAllocationRows)
      : false;
  const hasRedOriginalChange = Boolean(
    isRedInvoice &&
    redOriginalInvoiceId &&
    redOriginalInvoiceId !== activeInvoice?.originalInvoiceId
  );

  function getCandidateAmountLimit(candidateId: string, availableAmount: number) {
    const currentAmount = amountsByCandidateId[candidateId] ?? 0;
    const otherSelectedAmount = Math.max(0, selectedAmount - currentAmount);

    return Math.max(0, Math.min(availableAmount, maximumAmount - otherSelectedAmount));
  }

  function updateCandidateAmount(candidateId: string, value: number | null, availableAmount: number) {
    const amountLimit = getCandidateAmountLimit(candidateId, availableAmount);
    const nextAmount = Math.max(0, Math.min(formatAmountInput(value), amountLimit));

    setAmountsByCandidateId((current) => ({
      ...current,
      [candidateId]: Number(nextAmount.toFixed(2))
    }));
  }

  function toggleCandidateSelection(candidateId: string, availableAmount: number, selected: boolean) {
    if (!selected) {
      setAmountsByCandidateId((current) => ({ ...current, [candidateId]: 0 }));
      return;
    }

    const amountLimit = getCandidateAmountLimit(candidateId, availableAmount);

    if (amountLimit <= 0.01) {
      void messageApi.warning('待关联金额已分配完成，请先调整其他事项的关联金额');
      return;
    }

    setAmountsByCandidateId((current) => ({ ...current, [candidateId]: Number(amountLimit.toFixed(2)) }));
  }

  function handleSaveInvoiceAssociations() {
    if (!activeInvoice || selectedAmount - activeInvoice.taxIncludedAmount > 0.01) {
      void messageApi.warning('关联金额不能超过发票金额');
      return;
    }

    if (!replaceInvoiceBusinessAssociations(activeInvoice.id, invoiceDrafts)) {
      void messageApi.warning('当前发票或关联事项已锁定、已记账，或关联金额不符合要求');
      return;
    }

    void messageApi.success('已保存发票关联');
    onClose();
  }

  function handleSaveBusinessAssociations() {
    if (!activeBusinessRecord || selectedAmount - activeBusinessRecord.amount > 0.01) {
      void messageApi.warning('关联金额不能超过事项金额');
      return;
    }

    if (!replaceBusinessInvoiceAssociations(activeBusinessRecord.id, businessDrafts)) {
      void messageApi.warning('当前事项或关联发票已锁定、已记账，或关联金额不符合要求');
      return;
    }

    void messageApi.success('已保存发票关联');
    onClose();
  }

  function handleConfirmRedOriginal() {
    if (!activeInvoice || !redOriginalInvoiceId) {
      void messageApi.warning('请选择原蓝字发票');
      return;
    }

    if (!linkRedInvoiceOriginal(activeInvoice.id, redOriginalInvoiceId)) {
      void messageApi.warning('原票关联不符合当前期间或金额要求');
      return;
    }

    void messageApi.success('已关联原蓝字发票');
    onClose();
  }

  const invoiceBusinessColumns: TableColumnsType<FinanceInvoiceBusinessAssociationCandidate> = [
    {
      title: '应收应付事项',
      dataIndex: ['businessRecord', 'documentNo'],
      width: 180,
      render: (_value: string, record) => <CompactCell primary={record.businessRecord.documentNo} secondary={record.businessRecord.sourceTitle} />
    },
    {
      title: '归属月份',
      dataIndex: ['businessRecord', 'accountingPeriod'],
      width: 104
    },
    {
      title: '可关联',
      dataIndex: 'availableAmount',
      width: 120,
      render: (value: number) => formatMoney(value)
    },
    {
      title: '匹配依据',
      dataIndex: 'matchBasis',
      width: 108,
      render: (value: FinanceInvoiceAssociationMatchBasis) => <StatusTag toneMap={matchBasisTone} value={value} />
    },
    {
      title: '关联',
      key: 'selected',
      width: 76,
      render: (_value, record) => (
        <Checkbox
          aria-label={`关联 ${record.businessRecord.documentNo}`}
          checked={(amountsByCandidateId[record.id] ?? 0) > 0.01}
          disabled={!associationEditable}
          onChange={(event) => toggleCandidateSelection(record.id, record.availableAmount, event.target.checked)}
        />
      )
    },
    {
      title: '关联金额',
      key: 'amount',
      width: 142,
      render: (_value, record) => (
        <InputNumber
          aria-label={`关联金额 ${record.businessRecord.documentNo}`}
          controls={false}
          disabled={!associationEditable || (amountsByCandidateId[record.id] ?? 0) <= 0.01}
          max={getCandidateAmountLimit(record.id, record.availableAmount)}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          value={amountsByCandidateId[record.id] ?? 0}
          onChange={(value) => updateCandidateAmount(record.id, value, record.availableAmount)}
        />
      )
    }
  ];

  const businessInvoiceColumns: TableColumnsType<FinanceBusinessInvoiceAssociationCandidate> = [
    {
      title: '发票',
      dataIndex: ['invoice', 'invoiceNo'],
      width: 180,
      render: (_value: string, record) => <CompactCell primary={record.invoice.invoiceNo} secondary={record.invoice.invoiceDate} />
    },
    {
      title: '可关联',
      dataIndex: 'availableAmount',
      width: 120,
      render: (value: number) => formatMoney(value)
    },
    {
      title: '匹配依据',
      dataIndex: 'matchBasis',
      width: 108,
      render: (value: FinanceInvoiceAssociationMatchBasis) => <StatusTag toneMap={matchBasisTone} value={value} />
    },
    {
      title: '关联',
      key: 'selected',
      width: 76,
      render: (_value, record) => (
        <Checkbox
          aria-label={`关联 ${record.invoice.invoiceNo}`}
          checked={(amountsByCandidateId[record.id] ?? 0) > 0.01}
          disabled={!associationEditable}
          onChange={(event) => toggleCandidateSelection(record.id, record.availableAmount, event.target.checked)}
        />
      )
    },
    {
      title: '关联金额',
      key: 'amount',
      width: 142,
      render: (_value, record) => (
        <InputNumber
          aria-label={`关联金额 ${record.invoice.invoiceNo}`}
          controls={false}
          disabled={!associationEditable || (amountsByCandidateId[record.id] ?? 0) <= 0.01}
          max={getCandidateAmountLimit(record.id, record.availableAmount)}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          value={amountsByCandidateId[record.id] ?? 0}
          onChange={(value) => updateCandidateAmount(record.id, value, record.availableAmount)}
        />
      )
    }
  ];

  const redInvoiceColumns: TableColumnsType<RedInvoiceCandidateRow> = [
    {
      title: '原蓝字发票',
      dataIndex: ['invoice', 'invoiceNo'],
      width: 190,
      render: (_value: string, record) => <CompactCell primary={record.invoice.invoiceNo} secondary={record.invoice.invoiceDate} />
    },
    {
      title: '发票金额',
      dataIndex: ['invoice', 'taxIncludedAmount'],
      width: 132,
      render: (_value: number, record) => formatMoney(record.invoice.taxIncludedAmount)
    },
    {
      title: '可冲减',
      dataIndex: 'availableRedAmount',
      width: 132,
      render: (value: number) => formatMoney(value)
    }
  ];

  const allocationColumns: TableColumnsType<InvoiceAllocationRow> = [
    {
      title: '关联事项',
      dataIndex: 'targetNo',
      width: 188,
      render: (_value: string, record) => <CompactCell primary={record.targetNo} secondary={record.targetTitle} />
    },
    {
      title: '价税合计',
      dataIndex: 'taxIncludedAmount',
      width: 126,
      render: (value: number) => formatMoney(value)
    },
    {
      title: '不含税金额',
      dataIndex: 'taxExcludedAmount',
      width: 126,
      render: (value: number) => formatMoney(value)
    },
    {
      title: '税额',
      dataIndex: 'taxAmount',
      width: 116,
      render: (value: number) => formatMoney(value)
    },
    {
      title: '匹配依据',
      dataIndex: 'matchBasis',
      width: 108,
      render: (value: FinanceInvoiceAssociationMatchBasis) => <StatusTag toneMap={matchBasisTone} value={value} />
    }
  ];

  if (!activeMode) {
    return null;
  }

  const drawerTitle = activeInvoice
    ? <DetailDrawerTitle
        status={isRedInvoice
          ? getRedInvoiceOriginalAssociationStatus(activeInvoice)
          : getInvoiceAssociationStatusLabel(getInvoiceMatchStatus(activeInvoice, invoiceBusinessAllocationRows))}
        statusTone={isRedInvoice ? 'amber' : associationStatusTone[getInvoiceMatchStatus(activeInvoice, invoiceBusinessAllocationRows)]}
        subtitle={activeInvoice.invoiceNo}
        title={activeInvoice.counterparty}
      />
    : <DetailDrawerTitle
        status={selectedAmount > 0 ? '已关联' : '待补票'}
        statusTone={selectedAmount > 0 ? 'green' : 'amber'}
        subtitle={activeBusinessRecord?.documentNo}
        title={activeBusinessRecord?.counterparty ?? ''}
      />;
  const summaryItems: DetailSummaryCardItem[] = isRedInvoice
    ? [
        {
          icon: <RollbackOutlined />,
          key: 'red-amount',
          label: '红冲金额',
          value: formatMoney(Math.abs(maximumAmount))
        },
        {
          icon: <FileTextOutlined />,
          key: 'original-invoice',
          label: '原蓝字发票',
          value: redInvoiceCandidates.find((candidate) => candidate.id === redOriginalInvoiceId)?.invoice.invoiceNo ?? '未关联'
        },
        {
          icon: <LinkOutlined />,
          key: 'original-status',
          label: '原票关联',
          value: getRedInvoiceOriginalAssociationStatus(activeInvoice!)
        },
        {
          icon: <FileTextOutlined />,
          key: 'direction',
          label: '方向',
          value: <StatusTag toneMap={directionTone} value={activeInvoice!.direction} />
        }
      ]
    : [
        {
          icon: <WalletOutlined />,
          key: 'total',
          label: activeMode === 'invoice' ? '发票金额' : '事项金额',
          value: formatMoney(maximumAmount)
        },
        {
          icon: <LinkOutlined />,
          key: 'associated',
          label: '关联金额',
          value: formatMoney(selectedAmount)
        },
        {
          icon: <FileSearchOutlined />,
          key: 'remaining',
          label: '待关联',
          value: formatMoney(remainingAmount)
        },
        {
          icon: <FileTextOutlined />,
          key: 'direction',
          label: '方向',
          value: activeInvoice ? <StatusTag toneMap={directionTone} value={activeInvoice.direction} /> : activeBusinessRecord?.direction
        }
      ];

  return (
    <DetailDrawerShell
      bodyTestId="finance-invoice-association-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={open}
      primaryAction={
        isVoidInvoice
          ? undefined
          : isRedInvoice
          ? {
              disabled: !periodGuard.allowed || !hasRedOriginalChange,
              label: '确认原票关联',
              onClick: handleConfirmRedOriginal
            }
          : {
              disabled: !associationEditable || !haveAssociationChanges || selectedAmount - maximumAmount > 0.01,
              label: '保存关联',
              onClick: activeMode === 'invoice' ? handleSaveInvoiceAssociations : handleSaveBusinessAssociations
            }
      }
      title={drawerTitle}
      width={980}
      onClose={onClose}
    >
      {contextHolder}
      {periodGuard.allowed ? null : (
        <Alert message={periodGuard.reason} showIcon type="info" />
      )}
      {associationReadbackReason ? <Alert message={associationReadbackReason} showIcon type="info" /> : null}
      <DetailSummaryCards
        columns={4}
        items={summaryItems}
      />
      <DetailTabs
        defaultActiveKey={
          activeInvoice && (isRedInvoice || getInvoiceMatchStatus(activeInvoice, invoiceBusinessAllocationRows) !== '已匹配')
            ? 'association'
            : 'information'
        }
        key={`${activeMode}-${activeInvoice?.id ?? activeBusinessRecord?.id}`}
        tabTestIdPrefix="finance-invoice-association-tab"
        testId="finance-invoice-association-tabs"
        items={[
          {
            key: 'information',
            label: activeMode === 'invoice' ? '发票信息' : '事项信息',
            children: activeInvoice ? (
              <>
                <DetailSection icon={<FileTextOutlined />} title="发票信息">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '发票号', value: activeInvoice.invoiceNo },
                      { label: '开票日期', value: activeInvoice.invoiceDate },
                      { label: '发票类型', value: activeInvoice.invoiceKind },
                      { label: '发票状态', value: activeInvoice.invoiceStatus },
                      { label: '税务归属', value: activeInvoice.declarationTreatment },
                      { label: '价税合计', value: formatMoney(activeInvoice.taxIncludedAmount) },
                      { label: '不含税金额', value: formatMoney(activeInvoice.taxExcludedAmount) },
                      { label: '票面税额', value: formatMoney(activeInvoice.taxAmount) }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<FileTextOutlined />} title="来源文件">
                  <RelatedFileTable
                    records={[
                      {
                        id: `invoice-source-file-${activeInvoice.id}`,
                        name: activeInvoice.sourceFile,
                        status: '已上传',
                        type: '税务导入文件',
                        updatedAt: activeInvoice.importedAt.slice(0, 10)
                      }
                    ]}
                    onPreview={setPreviewFile}
                  />
                </DetailSection>
              </>
            ) : (
              <DetailSection icon={<WalletOutlined />} title="事项信息">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '事项单号', value: activeBusinessRecord?.documentNo },
                    { label: '归属月份', value: activeBusinessRecord?.accountingPeriod },
                    { label: '收付方向', value: activeBusinessRecord?.direction },
                    { label: '业务来源', value: activeBusinessRecord?.sourceTitle },
                    { label: '财务类目', value: activeBusinessRecord?.category },
                    { label: '事项金额', value: formatMoney(activeBusinessRecord?.amount ?? 0) }
                  ]}
                />
              </DetailSection>
            )
          },
          {
            key: 'association',
            label: '业务关联',
            children: isVoidInvoice ? (
              <Alert message="作废发票仅保留票据事实，不参与业务关联。" showIcon type="info" />
            ) : isRedInvoice ? (
              <>
                <DetailSection icon={<RollbackOutlined />} title="原蓝字发票">
                  <Select
                    allowClear
                    disabled={!periodGuard.allowed}
                    options={redInvoiceCandidates.map((candidate) => ({
                      label: `${candidate.invoice.invoiceNo} / ${formatMoney(candidate.invoice.taxIncludedAmount)}`,
                      value: candidate.id
                    }))}
                    placeholder="选择原蓝字发票"
                    style={{ marginBottom: 16, width: '100%' }}
                    value={redOriginalInvoiceId}
                    onChange={setRedOriginalInvoiceId}
                  />
                  <CompactDetailTable<RedInvoiceCandidateRow>
                    columns={redInvoiceColumns}
                    dataSource={redInvoiceCandidates}
                    emptyText="暂无可关联原蓝字发票"
                    rowKey="id"
                    scrollX={620}
                  />
                </DetailSection>
                {activeInvoiceAllocationRows.length > 0 ? (
                  <DetailSection icon={<LinkOutlined />} title="红冲分摊">
                    <CompactDetailTable<InvoiceAllocationRow>
                      columns={allocationColumns}
                      dataSource={activeInvoiceAllocationRows}
                      rowKey="id"
                      scrollX={760}
                    />
                  </DetailSection>
                ) : null}
              </>
            ) : activeInvoice ? (
              <>
                <DetailSection icon={<LinkOutlined />} title="关联应收应付">
                  <CompactDetailTable<FinanceInvoiceBusinessAssociationCandidate>
                    columns={invoiceBusinessColumns}
                    dataSource={invoiceBusinessCandidates}
                    emptyText="暂无可关联应收应付事项"
                    rowKey="id"
                    scrollX={760}
                  />
                </DetailSection>
                {activeInvoiceAllocationRows.length > 0 ? (
                  <DetailSection icon={<LinkOutlined />} title="当前分摊">
                    <CompactDetailTable<InvoiceAllocationRow>
                      columns={allocationColumns}
                      dataSource={activeInvoiceAllocationRows}
                      rowKey="id"
                      scrollX={760}
                    />
                  </DetailSection>
                ) : null}
              </>
            ) : (
              <DetailSection icon={<LinkOutlined />} title="关联发票">
                <CompactDetailTable<FinanceBusinessInvoiceAssociationCandidate>
                  columns={businessInvoiceColumns}
                  dataSource={businessInvoiceCandidates}
                  emptyText="暂无可关联发票"
                  rowKey="id"
                  scrollX={700}
                />
              </DetailSection>
            )
          }
        ]}
      />
      <FilePreviewModal
        file={previewFile ? {
          category: previewFile.type,
          name: previewFile.name,
          status: previewFile.status,
          updatedAt: previewFile.updatedAt
        } : undefined}
        statusToneMap={invoiceFileStatusTone}
        title="文件预览"
        onClose={() => setPreviewFile(undefined)}
      />
    </DetailDrawerShell>
  );
}
