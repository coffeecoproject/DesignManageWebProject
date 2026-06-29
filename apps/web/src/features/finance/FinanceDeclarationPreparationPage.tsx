import {
  AuditOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  PercentageOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Button, Select, message } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { CompactCell } from '../../components/TableCell';
import { TagChip } from '../../components/TagChip';
import { CorporateIncomeTaxSourceTable } from './CorporateIncomeTaxSourceTable';
import { useFinanceManagement } from './FinanceManagementState';
import {
  applyDeclarationPreparationSourceState,
  buildConfirmedDeclarationPreparationItem,
  canConfirmDeclarationPreparationItem,
  declarationPreparationItemStatusTone,
  declarationPreparationStatusTone,
  getDeclarationPreparationSubsequentInvoiceCandidates,
  getDeclarationPreparationUnbilledIncomeCandidates,
  getDeclarationPreparationProgress,
  isDeclarationPreparationReady,
  isDeclarationPreparationItemManuallyConfirmable,
  type FinanceDeclarationUnbilledIncomeCandidate,
  type FinanceDeclarationPreparationItem,
  type FinanceDeclarationPreparationRecord,
  type FinanceDeclarationPreparationStatus,
  type FinanceDeclarationPreparationTaxType
} from './financeDeclarationPreparationData';
import { financeToday, formatMoney, invoiceDeclarationStatusTone } from './financeUtils';

type FilterOptionValue = '全部';

type DeclarationPreparationFilters = {
  keyword: string;
  period: FilterOptionValue | string;
  status: FilterOptionValue | FinanceDeclarationPreparationStatus;
  taxType: FilterOptionValue | FinanceDeclarationPreparationTaxType;
};

const defaultFilters: DeclarationPreparationFilters = {
  keyword: '',
  period: '全部',
  status: '全部',
  taxType: '全部'
};

const declarationPreparationTaxTypeTone = {
  增值税及附加: 'green',
  企业所得税: 'amber',
  印花税: 'gray'
} as const;

const declarationPreparationHandlingTone = {
  待准备结果确认: 'amber',
  可进入税务办理: 'blue',
  已进入税务办理: 'green',
  未进入办理: 'gray',
  待税务办理: 'blue',
  已归档: 'green'
} as const;

function uniqueOptions<T extends string>(records: FinanceDeclarationPreparationRecord[], selector: (record: FinanceDeclarationPreparationRecord) => T) {
  return Array.from(new Set(records.map(selector)));
}

function getSearchText(record: FinanceDeclarationPreparationRecord) {
  return [
    record.preparationNo,
    record.title,
    record.period,
    record.taxType,
    record.status,
    record.items.map((item) => `${item.title} ${item.type} ${item.status} ${item.sourceModule}`).join(' ')
  ].join(' ');
}

function matchesFilters(record: FinanceDeclarationPreparationRecord, filters: DeclarationPreparationFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (filters.period !== '全部' && record.period !== filters.period) {
    return false;
  }

  if (filters.taxType !== '全部' && record.taxType !== filters.taxType) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  return !keyword || getSearchText(record).toLowerCase().includes(keyword);
}

function getPreparationRowProgressText(record: FinanceDeclarationPreparationRecord) {
  const progress = getDeclarationPreparationProgress(record);

  return `${progress.processedCount}/${progress.actionableCount} 项`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function getCorporateIncomeTaxEligibilityText(summary: FinanceDeclarationPreparationRecord['citSummary']) {
  if (!summary) {
    return '-';
  }

  return summary.smallLowProfitEligible ? '符合小型微利候选口径' : '按普通企业口径';
}

function getPreparationBasisCell(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '企业所得税') {
    return {
      primary: formatMoney(record.citSummary?.profitBeforeTaxAmount ?? 0),
      secondary: '利润总额'
    };
  }

  return {
    primary: formatMoney(record.vatSummary.declaredNetSalesAmount),
    secondary: '不含税销售额'
  };
}

function getPreparationSourceCell(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '企业所得税') {
    return {
      primary: formatMoney(record.citSummary?.operatingRevenueAmount ?? 0),
      secondary: '经营收入'
    };
  }

  return {
    primary: formatMoney(record.vatSummary.outputBlueNetAmount),
    secondary: `含税 ${formatMoney(record.vatSummary.outputBlueTaxIncludedAmount)}`
  };
}

function getPreparationAdjustmentCell(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '企业所得税') {
    const summary = record.citSummary;
    const netAdjustmentAmount = (summary?.taxAdjustmentIncreaseAmount ?? 0) - (summary?.taxAdjustmentDecreaseAmount ?? 0);

    return {
      primary: formatMoney(netAdjustmentAmount),
      secondary: `弥补亏损 ${formatMoney(summary?.priorLossDeductionAmount ?? 0)}`
    };
  }

  return {
    primary: formatMoney(record.vatSummary.redInvoiceNetAmount),
    secondary: `未开票 ${formatMoney(record.vatSummary.unbilledIncomeNetAmount)}`
  };
}

function getPreparationEstimatedTaxAmount(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '企业所得税') {
    return record.citSummary?.estimatedCorporateIncomeTaxAmount ?? 0;
  }

  return record.vatSummary.estimatedTotalTaxAmount;
}

function getCorporateIncomeTaxNetAdjustmentAmount(summary: FinanceDeclarationPreparationRecord['citSummary']) {
  return (summary?.taxAdjustmentIncreaseAmount ?? 0) - (summary?.taxAdjustmentDecreaseAmount ?? 0);
}

function getPreparationResultItems(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '企业所得税') {
    const summary = record.citSummary;
    const netAdjustmentAmount = getCorporateIncomeTaxNetAdjustmentAmount(summary);

    return [
      { label: '申报期间', value: record.period },
      { label: '准备状态', value: <StatusTag toneMap={declarationPreparationStatusTone} value={record.status} /> },
      { label: '利润总额', value: formatMoney(summary?.profitBeforeTaxAmount ?? 0) },
      { label: '纳税调整', value: formatMoney(netAdjustmentAmount) },
      { label: '弥补亏损', value: formatMoney(summary?.priorLossDeductionAmount ?? 0) },
      { label: '应纳税所得额', value: formatMoney(summary?.taxableIncomeAmount ?? 0) },
      { label: '小型微利资格', value: getCorporateIncomeTaxEligibilityText(summary) },
      { label: '有效预缴率', value: formatPercent(summary?.effectiveTaxRate ?? summary?.taxRate ?? 0) },
      { label: '预计企业所得税', value: formatMoney(summary?.estimatedCorporateIncomeTaxAmount ?? 0) }
    ];
  }

  return [
    { label: '申报期间', value: record.period },
    { label: '准备状态', value: <StatusTag toneMap={declarationPreparationStatusTone} value={record.status} /> },
    { label: '销项蓝票不含税', value: formatMoney(record.vatSummary.outputBlueNetAmount) },
    { label: '销项蓝票含税', value: formatMoney(record.vatSummary.outputBlueTaxIncludedAmount) },
    { label: '红票冲减', value: formatMoney(record.vatSummary.redInvoiceNetAmount) },
    { label: '未开票收入', value: formatMoney(record.vatSummary.unbilledIncomeNetAmount) },
    { label: '前期未开票冲抵', value: formatMoney(record.vatSummary.priorUnbilledOffsetNetAmount) },
    { label: '申报销售额', value: formatMoney(record.vatSummary.declaredNetSalesAmount) },
    { label: '免税阈值', value: formatMoney(record.vatSummary.quarterlyExemptionThreshold) },
    {
      label: '免税判断',
      value: record.vatSummary.isBelowQuarterlyExemptionThreshold ? '季度30万以下' : '超过季度30万'
    },
    { label: '预计增值税', value: formatMoney(record.vatSummary.estimatedVatAfterExemption) },
    { label: '预计附加税', value: formatMoney(record.vatSummary.estimatedSurcharge) },
    { label: '预计税费', value: formatMoney(record.vatSummary.estimatedTotalTaxAmount) }
  ];
}

function getPreparationItemActionLabel(item: FinanceDeclarationPreparationItem) {
  const labelMap: Partial<Record<FinanceDeclarationPreparationItem['type'], string>> = {
    前期未开票后续开票: '确认冲抵',
    申报口径确认: '确认申报口径',
    纳税调整确认: '确认调整',
    优惠资格确认: '确认资格',
    预缴口径确认: '确认预缴口径'
  };

  return labelMap[item.type] ?? '确认';
}

function getPreparationItemBlockedLabel(item: FinanceDeclarationPreparationItem) {
  if (item.type === '申报口径确认' || item.type === '预缴口径确认') {
    return '先确认前置项';
  }

  return '待前置处理';
}

function getVisiblePreparationItems(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType !== '企业所得税') {
    return record.items;
  }

  return record.items.filter((item) => item.type !== '利润数据确认');
}

function getDeclarationHandlingStatus(record: FinanceDeclarationPreparationRecord) {
  if (record.status === '已进入税务办理') {
    return '已进入税务办理';
  }

  if (record.status === '可申报') {
    return '可进入税务办理';
  }

  return '待准备结果确认';
}

function getDeclarationReceiptStatus(record: FinanceDeclarationPreparationRecord) {
  if (record.status === '已进入税务办理') {
    return '已归档';
  }

  if (record.status === '可申报') {
    return '待税务办理';
  }

  return '未进入办理';
}

function getPreparationHandlingItems(record: FinanceDeclarationPreparationRecord) {
  return [
    {
      label: '申报周期',
      value: record.periodType === '季度' ? `${record.period} 季度` : record.period
    },
    {
      label: '内部准备',
      value: <StatusTag toneMap={declarationPreparationStatusTone} value={record.status} />
    },
    {
      label: '外部办理',
      value: <StatusTag toneMap={declarationPreparationHandlingTone} value={getDeclarationHandlingStatus(record)} />
    },
    {
      label: '回执归档',
      value: <StatusTag toneMap={declarationPreparationHandlingTone} value={getDeclarationReceiptStatus(record)} />
    }
  ];
}

function DrawerTitle({ record }: { record: FinanceDeclarationPreparationRecord }) {
  return (
    <DetailDrawerTitle
      status={record.status}
      statusToneMap={declarationPreparationStatusTone}
      subtitle={`${record.preparationNo} / ${record.period}`}
      title={record.title}
    />
  );
}

export function FinanceDeclarationPreparationPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    declarationPreparationRows,
    financeRows,
    invoiceRows,
    updateDeclarationPreparationRecord,
    updateFinanceTransactionsByNo
  } = useFinanceManagement();
  const [filters, setFilters] = useState<DeclarationPreparationFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [unbilledDrawerRecordId, setUnbilledDrawerRecordId] = useState<string>();
  const [selectedUnbilledTransactionNos, setSelectedUnbilledTransactionNos] = useState<string[]>([]);
  const displayDeclarationPreparationRows = useMemo(
    () => applyDeclarationPreparationSourceState(declarationPreparationRows, invoiceRows, financeRows),
    [declarationPreparationRows, financeRows, invoiceRows]
  );

  const filteredRows = useMemo(
    () => displayDeclarationPreparationRows.filter((record) => matchesFilters(record, filters)),
    [displayDeclarationPreparationRows, filters]
  );
  const activeRecord = useMemo(
    () => displayDeclarationPreparationRows.find((record) => record.id === activeRecordId),
    [activeRecordId, displayDeclarationPreparationRows]
  );
  const unbilledDrawerRecord = useMemo(
    () => displayDeclarationPreparationRows.find((record) => record.id === unbilledDrawerRecordId),
    [displayDeclarationPreparationRows, unbilledDrawerRecordId]
  );
  const unbilledIncomeCandidates = useMemo(
    () =>
      unbilledDrawerRecord
        ? getDeclarationPreparationUnbilledIncomeCandidates(unbilledDrawerRecord, invoiceRows, financeRows)
        : [],
    [financeRows, invoiceRows, unbilledDrawerRecord]
  );
  const selectedUnbilledRows = useMemo(() => {
    const selectedSet = new Set(selectedUnbilledTransactionNos);

    return unbilledIncomeCandidates.filter((candidate) => selectedSet.has(candidate.record.transactionNo));
  }, [selectedUnbilledTransactionNos, unbilledIncomeCandidates]);
  const selectedUnbilledAmount = selectedUnbilledRows.reduce((total, candidate) => total + candidate.netAmount, 0);
  const periodOptions = ['全部', ...uniqueOptions(displayDeclarationPreparationRows, (record) => record.period)];
  const taxTypeOptions = ['全部', ...uniqueOptions(displayDeclarationPreparationRows, (record) => record.taxType)];
  const statusOptions = ['全部', ...uniqueOptions(displayDeclarationPreparationRows, (record) => record.status)];
  const preparingRows = displayDeclarationPreparationRows.filter((record) => record.status === '准备中');
  const readyRows = displayDeclarationPreparationRows.filter((record) => record.status === '可申报');
  const pendingItemCount = displayDeclarationPreparationRows.reduce(
    (total, record) => total + getDeclarationPreparationProgress(record).pendingCount,
    0
  );

  function updatePreparation(recordId: string, updater: (record: FinanceDeclarationPreparationRecord) => FinanceDeclarationPreparationRecord) {
    updateDeclarationPreparationRecord(recordId, updater);
  }

  function handleProcessItem(record: FinanceDeclarationPreparationRecord, item: FinanceDeclarationPreparationItem) {
    if (item.type === '前期未开票后续开票') {
      const candidates = getDeclarationPreparationSubsequentInvoiceCandidates(record, invoiceRows, financeRows);
      const transactionNos = Array.from(new Set(candidates.map((candidate) => candidate.record.transactionNo)));

      updateFinanceTransactionsByNo(transactionNos, (financeRecord) => ({
        ...financeRecord,
        invoiceDeclarationStatus: '后续开票已处理',
        operationRecords: [
          ...financeRecord.operationRecords,
          {
            action: '确认后续开票',
            actor: '李明',
            id: `fin-op-subsequent-invoice-${financeRecord.transactionNo}-${Date.now()}`,
            object: financeRecord.transactionNo,
            summary: `${financeRecord.transactionNo} 的前期未开票收入后续开票已处理`,
            time: `${financeToday} 14:25`
          }
        ],
        updatedAt: `${financeToday} 14:25`
      }));
    }

    updatePreparation(record.id, (currentRecord) => ({
      ...currentRecord,
      items: record.items.map((currentItem) =>
        currentItem.id === item.id ? buildConfirmedDeclarationPreparationItem(currentItem) : currentItem
      ),
      operationRecords: [
        {
          action: '确认准备项',
          actor: '李明',
          id: `declaration-prep-op-item-${Date.now()}`,
          object: currentRecord.preparationNo,
          summary: `${item.title} 已确认`,
          time: `${financeToday} 14:20`
        },
        ...currentRecord.operationRecords
      ],
      updatedAt: financeToday
    }));
    void messageApi.success('已确认准备项');
  }

  function handleOpenUnbilledIncomeDrawer(record: FinanceDeclarationPreparationRecord) {
    setSelectedUnbilledTransactionNos(record.unbilledIncomeTransactionNos ?? []);
    setUnbilledDrawerRecordId(record.id);
  }

  function handleConfirmUnbilledIncome() {
    if (!unbilledDrawerRecord) {
      return;
    }

    if (selectedUnbilledRows.length === 0) {
      void messageApi.warning('请选择需要计入本期的未开票收入流水');
      return;
    }

    const selectedTransactionNos = selectedUnbilledRows.map((candidate) => candidate.record.transactionNo);
    const selectedTransactionNoSet = new Set(selectedTransactionNos);
    const previousTransactionNos = unbilledDrawerRecord.unbilledIncomeTransactionNos ?? [];
    const previousDeferredTransactionNos = unbilledDrawerRecord.deferredUnbilledIncomeTransactionNos ?? [];
    const nextDeferredTransactionNos = previousDeferredTransactionNos.filter(
      (transactionNo) => !selectedTransactionNoSet.has(transactionNo)
    );
    const nextDeferredTransactionNoSet = new Set(nextDeferredTransactionNos);
    const affectedTransactionNos = Array.from(new Set([...previousTransactionNos, ...previousDeferredTransactionNos, ...selectedTransactionNos]));

    updatePreparation(unbilledDrawerRecord.id, (currentRecord) => ({
      ...currentRecord,
      items: unbilledDrawerRecord.items.map((currentItem) =>
        currentItem.type === '未开票收入确认'
          ? {
              ...buildConfirmedDeclarationPreparationItem({
                ...currentItem,
                amount: selectedUnbilledAmount
              }),
              result: `${selectedUnbilledRows.length} 条未开票收入已计入本期`
            }
          : currentItem
      ),
      operationRecords: [
        {
          action: '确认未开票收入',
          actor: '李明',
          id: `declaration-prep-op-unbilled-${Date.now()}`,
          object: currentRecord.preparationNo,
          summary: `${selectedUnbilledRows.length} 条流水计入 ${currentRecord.period} 未开票收入，金额 ${formatMoney(selectedUnbilledAmount)}`,
          time: `${financeToday} 14:30`
        },
        ...currentRecord.operationRecords
      ],
      deferredUnbilledIncomeTransactionNos: nextDeferredTransactionNos,
      unbilledIncomeTransactionNos: selectedTransactionNos,
      updatedAt: financeToday
    }));

    updateFinanceTransactionsByNo(affectedTransactionNos, (record) => {
      const isSelected = selectedTransactionNoSet.has(record.transactionNo);
      const isDeferred = nextDeferredTransactionNoSet.has(record.transactionNo);
      const belongsToCurrentPreparation = record.invoiceDeclarationPreparationNo === unbilledDrawerRecord.preparationNo;

      if (!isSelected && !isDeferred && !belongsToCurrentPreparation) {
        return record;
      }

      return {
        ...record,
        invoiceDeclarationPeriod: isSelected || isDeferred ? unbilledDrawerRecord.period : undefined,
        invoiceDeclarationPreparationNo: isSelected || isDeferred ? unbilledDrawerRecord.preparationNo : undefined,
        invoiceDeclarationStatus: isSelected ? '未开票已申报' : isDeferred ? '本期暂不计入' : undefined,
        operationRecords: [
          ...record.operationRecords,
          {
            action: isSelected ? '确认未开票申报' : isDeferred ? '确认本期暂不计入' : '取消未开票申报',
            actor: '李明',
            id: `fin-op-unbilled-declare-${record.transactionNo}-${Date.now()}`,
            object: record.transactionNo,
            summary: isSelected
              ? `${record.transactionNo} 已计入 ${unbilledDrawerRecord.period} 未开票收入`
              : isDeferred
                ? `${record.transactionNo} 本期暂不计入未开票收入`
              : `${record.transactionNo} 从 ${unbilledDrawerRecord.period} 未开票收入中移除`,
            time: `${financeToday} 14:30`
          }
        ],
        updatedAt: `${financeToday} 14:30`
      };
    });

    setUnbilledDrawerRecordId(undefined);
    setSelectedUnbilledTransactionNos([]);
    void messageApi.success('未开票收入已确认');
  }

  function handleDeferUnbilledIncome() {
    if (!unbilledDrawerRecord) {
      return;
    }

    if (selectedUnbilledRows.length === 0) {
      void messageApi.warning('请选择本期暂不计入的未开票收入流水');
      return;
    }

    const selectedTransactionNos = selectedUnbilledRows.map((candidate) => candidate.record.transactionNo);
    const selectedTransactionNoSet = new Set(selectedTransactionNos);
    const previousIncludedTransactionNos = unbilledDrawerRecord.unbilledIncomeTransactionNos ?? [];
    const previousDeferredTransactionNos = unbilledDrawerRecord.deferredUnbilledIncomeTransactionNos ?? [];
    const nextIncludedTransactionNos = previousIncludedTransactionNos.filter(
      (transactionNo) => !selectedTransactionNoSet.has(transactionNo)
    );
    const nextDeferredTransactionNos = Array.from(new Set([...previousDeferredTransactionNos, ...selectedTransactionNos]));
    const includedTransactionNoSet = new Set(nextIncludedTransactionNos);
    const deferredTransactionNoSet = new Set(nextDeferredTransactionNos);
    const affectedTransactionNos = Array.from(new Set([...previousIncludedTransactionNos, ...previousDeferredTransactionNos, ...selectedTransactionNos]));
    const nextIncludedRows = unbilledIncomeCandidates.filter((candidate) => includedTransactionNoSet.has(candidate.record.transactionNo));
    const nextIncludedAmount = nextIncludedRows.reduce((total, candidate) => total + candidate.netAmount, 0);

    updatePreparation(unbilledDrawerRecord.id, (currentRecord) => ({
      ...currentRecord,
      deferredUnbilledIncomeTransactionNos: nextDeferredTransactionNos,
      items: unbilledDrawerRecord.items.map((currentItem) =>
        currentItem.type === '未开票收入确认'
          ? {
              ...buildConfirmedDeclarationPreparationItem({
                ...currentItem,
                amount: nextIncludedAmount
              }),
              result: `${nextIncludedRows.length} 条计入本期，${nextDeferredTransactionNos.length} 条本期暂不计入`
            }
          : currentItem
      ),
      operationRecords: [
        {
          action: '确认本期暂不计入',
          actor: '李明',
          id: `declaration-prep-op-unbilled-defer-${Date.now()}`,
          object: currentRecord.preparationNo,
          summary: `${selectedUnbilledRows.length} 条流水本期暂不计入未开票收入`,
          time: `${financeToday} 14:35`
        },
        ...currentRecord.operationRecords
      ],
      unbilledIncomeTransactionNos: nextIncludedTransactionNos,
      updatedAt: financeToday
    }));

    updateFinanceTransactionsByNo(affectedTransactionNos, (record) => {
      const isIncluded = includedTransactionNoSet.has(record.transactionNo);
      const isDeferred = deferredTransactionNoSet.has(record.transactionNo);

      return {
        ...record,
        invoiceDeclarationPeriod: isIncluded || isDeferred ? unbilledDrawerRecord.period : undefined,
        invoiceDeclarationPreparationNo: isIncluded || isDeferred ? unbilledDrawerRecord.preparationNo : undefined,
        invoiceDeclarationStatus: isIncluded ? '未开票已申报' : isDeferred ? '本期暂不计入' : undefined,
        operationRecords: [
          ...record.operationRecords,
          {
            action: isIncluded ? '确认未开票申报' : isDeferred ? '确认本期暂不计入' : '取消未开票申报',
            actor: '李明',
            id: `fin-op-unbilled-defer-${record.transactionNo}-${Date.now()}`,
            object: record.transactionNo,
            summary: isDeferred ? `${record.transactionNo} 本期暂不计入未开票收入` : `${record.transactionNo} 更新未开票收入申报口径`,
            time: `${financeToday} 14:35`
          }
        ],
        updatedAt: `${financeToday} 14:35`
      };
    });

    setUnbilledDrawerRecordId(undefined);
    setSelectedUnbilledTransactionNos([]);
    void messageApi.success('已标记本期暂不计入');
  }

  function handleConfirmPreparation(record: FinanceDeclarationPreparationRecord) {
    if (!isDeclarationPreparationReady(record)) {
      void messageApi.warning('仍有准备项未确认');
      return;
    }

    updatePreparation(record.id, (currentRecord) => ({
      ...currentRecord,
      confirmedSourceSnapshotKey: record.sourceSnapshotKey,
      confirmedCitSummary: record.taxType === '企业所得税' ? record.citSummary : currentRecord.confirmedCitSummary,
      confirmedVatSummary: record.taxType === '增值税及附加' ? record.vatSummary : currentRecord.confirmedVatSummary,
      citSummary: record.citSummary ?? currentRecord.citSummary,
      items: record.items,
      status: '可申报',
      vatSummary: record.vatSummary,
      operationRecords: [
        {
          action: '确认准备结果',
          actor: '李明',
          id: `declaration-prep-op-confirm-${Date.now()}`,
          object: currentRecord.preparationNo,
          summary: `${currentRecord.period} ${currentRecord.taxType} 准备结果已确认`,
          time: `${financeToday} 15:00`
        },
        ...currentRecord.operationRecords
      ],
      updatedAt: financeToday
    }));
    void messageApi.success('准备结果已确认');
  }

  const columns: TableColumnsType<FinanceDeclarationPreparationRecord> = [
    {
      dataIndex: 'title',
      fixed: 'left',
      render: (_title: string, record) => <CompactCell primary={record.title} secondary={record.preparationNo} />,
      title: '准备事项',
      width: 210
    },
    {
      dataIndex: 'period',
      render: (_period: string, record) => <CompactCell primary={record.period} secondary={record.periodType} />,
      title: '申报期间',
      width: 108
    },
    {
      dataIndex: 'taxType',
      render: (taxType: FinanceDeclarationPreparationTaxType) => (
        <StatusTag toneMap={declarationPreparationTaxTypeTone} value={taxType} />
      ),
      title: '税种',
      width: 136
    },
    {
      key: 'basis',
      render: (_, record) => {
        const cell = getPreparationBasisCell(record);

        return <CompactCell primary={cell.primary} secondary={cell.secondary} />;
      },
      title: '申报基础',
      width: 136
    },
    {
      key: 'sourceAmount',
      render: (_, record) => {
        const cell = getPreparationSourceCell(record);

        return <CompactCell primary={cell.primary} secondary={cell.secondary} />;
      },
      title: '来源数据',
      width: 168
    },
    {
      key: 'adjustment',
      render: (_, record) => {
        const cell = getPreparationAdjustmentCell(record);

        return <CompactCell primary={cell.primary} secondary={cell.secondary} />;
      },
      title: '调整项',
      width: 150
    },
    {
      key: 'estimatedTaxAmount',
      render: (_, record) => formatMoney(getPreparationEstimatedTaxAmount(record)),
      title: '预计税费',
      width: 124
    },
    {
      key: 'progress',
      render: (_, record) => {
        const progress = getDeclarationPreparationProgress(record);

        return <CompactCell primary={getPreparationRowProgressText(record)} secondary={progress.pendingCount > 0 ? `${progress.pendingCount} 项待确认` : '已确认'} />;
      },
      title: '准备项',
      width: 118
    },
    {
      dataIndex: 'status',
      render: (status: FinanceDeclarationPreparationStatus) => <StatusTag toneMap={declarationPreparationStatusTone} value={status} />,
      title: '准备状态',
      width: 112
    },
    {
      dataIndex: 'updatedAt',
      title: '最近更新',
      width: 110
    }
  ];

  const itemColumns: TableColumnsType<FinanceDeclarationPreparationItem> = [
    {
      dataIndex: 'title',
      render: (_title: string, item) => (
        <CompactCell
          primary={item.title}
          secondary={item.sourceModule}
        />
      ),
      title: '准备项',
      width: 190
    },
    {
      dataIndex: 'period',
      title: '期间',
      width: 96
    },
    {
      dataIndex: 'amount',
      render: (amount: number) => formatMoney(amount),
      title: '金额',
      width: 128
    },
    {
      dataIndex: 'status',
      render: (status: FinanceDeclarationPreparationItem['status']) => <StatusTag toneMap={declarationPreparationItemStatusTone} value={status} />,
      title: '确认状态',
      width: 104
    },
    {
      dataIndex: 'result',
      title: '处理结果',
      width: 210
    },
    {
      key: 'action',
      render: (_, item) =>
        activeRecord && item.type === '未开票收入确认' && canConfirmDeclarationPreparationItem(activeRecord, item) ? (
          <Button
            size="small"
            type="link"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenUnbilledIncomeDrawer(activeRecord);
            }}
          >
            选择流水
          </Button>
        ) : activeRecord && canConfirmDeclarationPreparationItem(activeRecord, item) ? (
          <Button
            size="small"
            type="link"
            onClick={(event) => {
              event.stopPropagation();
              handleProcessItem(activeRecord, item);
            }}
          >
            {getPreparationItemActionLabel(item)}
          </Button>
        ) : activeRecord && item.status === '待确认' && isDeclarationPreparationItemManuallyConfirmable(item) ? (
          <StatusTag tone="gray" value={getPreparationItemBlockedLabel(item)} variant="compact" />
        ) : (
          '-'
        ),
      title: '操作',
      width: 124
    }
  ];

  const unbilledIncomeColumns: TableColumnsType<FinanceDeclarationUnbilledIncomeCandidate> = [
    {
      dataIndex: ['record', 'transactionNo'],
      render: (_transactionNo: string, candidate) => (
        <CompactCell primary={candidate.record.transactionNo} secondary={candidate.record.occurredAt} />
      ),
      title: '流水',
      width: 170
    },
    {
      dataIndex: ['record', 'counterparty'],
      render: (_counterparty: string, candidate) => (
        <CompactCell primary={candidate.record.counterparty} secondary={candidate.record.sourceTitle} />
      ),
      title: '收款对象',
      width: 190
    },
    {
      dataIndex: ['record', 'amount'],
      render: (_amount: number, candidate) => formatMoney(candidate.record.amount),
      title: '含税收款',
      width: 136
    },
    {
      dataIndex: 'netAmount',
      render: (netAmount: number) => formatMoney(netAmount),
      title: '申报金额',
      width: 136
    },
    {
      dataIndex: 'invoiceDeclarationStatus',
      render: (status: FinanceDeclarationUnbilledIncomeCandidate['invoiceDeclarationStatus']) => (
        <StatusTag toneMap={invoiceDeclarationStatusTone} value={status} />
      ),
      title: '发票/申报',
      width: 132
    }
  ];

  const activeProgress = activeRecord ? getDeclarationPreparationProgress(activeRecord) : undefined;
  const canConfirmActiveRecord = Boolean(activeRecord && activeRecord.status === '准备中' && isDeclarationPreparationReady(activeRecord));

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="申报期间">
              <Select
                data-testid="finance-declaration-preparation-period-filter"
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.period}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="税种" controlWidth="wide-select">
              <Select
                data-testid="finance-declaration-preparation-type-filter"
                options={taxTypeOptions.map((taxType) => ({ label: taxType, value: taxType }))}
                value={filters.taxType}
                onChange={(taxType) => setFilters((current) => ({ ...current, taxType }))}
              />
            </FilterField>
            <FilterField label="准备状态" controlWidth="status-select">
              <Select
                data-testid="finance-declaration-preparation-status-filter"
                options={statusOptions.map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-declaration-preparation-keyword-input"
              placeholder="期间 / 税种 / 准备项"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
          <MetricGrid columns={4}>
          <MetricCard icon={<FileSearchOutlined />} label="准备事项" value={`${displayDeclarationPreparationRows.length} 条`} />
          <MetricCard icon={<AuditOutlined />} label="准备中" value={`${preparingRows.length} 条`} />
          <MetricCard icon={<CheckCircleOutlined />} label="可申报" value={`${readyRows.length} 条`} />
          <MetricCard icon={<FileTextOutlined />} label="待确认项" value={`${pendingItemCount} 项`} />
        </MetricGrid>
      }
      pageId="tax-declaration-preparation"
    >
      {contextHolder}
      <ManagementTable<FinanceDeclarationPreparationRecord>
        columns={columns}
        count={{ value: filteredRows.length, unit: '条申报准备' }}
        dataSource={filteredRows}
        rowKey="id"
        rowTestIdPrefix="finance-declaration-preparation-table-row"
        tableTestId="finance-declaration-preparation-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />

      <DetailDrawerShell
        bodyTestId="finance-declaration-preparation-detail-drawer"
        className="finance-declaration-preparation-drawer"
        closeAction={{ label: '关闭', onClick: () => setActiveRecordId(undefined) }}
        open={Boolean(activeRecord)}
        primaryAction={
          activeRecord?.status === '准备中'
            ? {
                disabled: !canConfirmActiveRecord,
                icon: <CheckCircleOutlined />,
                label: '确认准备结果',
                testId: 'finance-declaration-preparation-confirm-button',
                onClick: () => handleConfirmPreparation(activeRecord)
              }
            : undefined
        }
        title={activeRecord ? <DrawerTitle record={activeRecord} /> : null}
        width={900}
        onClose={() => setActiveRecordId(undefined)}
      >
        {activeRecord ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={[
                {
                  icon: <FileTextOutlined />,
                  key: 'taxType',
                  label: '税种',
                  value: activeRecord.taxType
                },
                {
                  icon: <PercentageOutlined />,
                  key: 'basis',
                  label: activeRecord.taxType === '企业所得税' ? '应纳税所得额' : '不含税销售额',
                  value:
                    activeRecord.taxType === '企业所得税'
                      ? formatMoney(activeRecord.citSummary?.taxableIncomeAmount ?? 0)
                      : formatMoney(activeRecord.vatSummary.declaredNetSalesAmount)
                },
                {
                  icon: <WalletOutlined />,
                  key: 'total',
                  label: '预计税费',
                  value: formatMoney(getPreparationEstimatedTaxAmount(activeRecord))
                },
                {
                  icon: <AuditOutlined />,
                  key: 'progress',
                  label: '准备项',
                  value: activeProgress ? `${activeProgress.processedCount}/${activeProgress.actionableCount} 项` : '-'
                }
              ]}
            />

            <DetailTabs
              items={[
                {
                  children: (
                    <>
                      <DetailSection icon={<FileSearchOutlined />} title="准备结果">
                        <DetailInfoGrid
                          columns={4}
                          items={getPreparationResultItems(activeRecord)}
                        />
                      </DetailSection>

                      {activeRecord.taxType === '企业所得税' ? (
                        <DetailSection icon={<FileTextOutlined />} title="数据来源">
                          <CorporateIncomeTaxSourceTable record={activeRecord} />
                        </DetailSection>
                      ) : null}

                      <DetailSection icon={<AuditOutlined />} title="税务办理">
                        <DetailInfoGrid
                          columns={4}
                          items={getPreparationHandlingItems(activeRecord)}
                        />
                      </DetailSection>
                    </>
                  ),
                  key: 'summary',
                  label: '准备结果'
                },
                {
                  children: (
                    <DetailSection
                      extra={
                        activeProgress ? (
                          <TagChip
                            label={`${activeProgress.processedCount}/${activeProgress.actionableCount} 项`}
                            tone={activeProgress.pendingCount > 0 ? 'amber' : 'green'}
                          />
                        ) : null
                      }
                      icon={<AuditOutlined />}
                      title="准备项"
                    >
                      <CompactDetailTable<FinanceDeclarationPreparationItem>
                        columns={itemColumns}
                        dataSource={getVisiblePreparationItems(activeRecord)}
                        rowKey="id"
                        scrollX={860}
                      />
                    </DetailSection>
                  ),
                  key: 'items',
                  label: '准备项'
                },
                {
                  children: (
                    <OperationRecordSection icon={<CheckCircleOutlined />} records={activeRecord.operationRecords} title="操作记录" />
                  ),
                  key: 'operations',
                  label: '操作记录'
                }
              ]}
              tabTestIdPrefix="finance-declaration-preparation-detail-tab"
              testId="finance-declaration-preparation-detail-tabs"
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <DetailDrawerShell
        bodyTestId="finance-declaration-preparation-unbilled-drawer"
        className="finance-declaration-preparation-drawer"
        closeAction={{
          label: '关闭',
          onClick: () => {
            setUnbilledDrawerRecordId(undefined);
            setSelectedUnbilledTransactionNos([]);
          }
        }}
        open={Boolean(unbilledDrawerRecord)}
        primaryAction={{
          disabled: selectedUnbilledRows.length === 0,
          icon: <CheckSquareOutlined />,
          label: '计入本期申报',
          testId: 'finance-declaration-preparation-unbilled-confirm-button',
          onClick: handleConfirmUnbilledIncome
        }}
        secondaryAction={{
          disabled: selectedUnbilledRows.length === 0,
          label: '本期暂不计入',
          testId: 'finance-declaration-preparation-unbilled-defer-button',
          onClick: handleDeferUnbilledIncome
        }}
        title={
          unbilledDrawerRecord ? (
            <DetailDrawerTitle
              status="待确认"
              statusToneMap={declarationPreparationItemStatusTone}
              subtitle={`${unbilledDrawerRecord.preparationNo} / ${unbilledDrawerRecord.period}`}
              title="未开票收入确认"
            />
          ) : null
        }
        width={820}
        onClose={() => {
          setUnbilledDrawerRecordId(undefined);
          setSelectedUnbilledTransactionNos([]);
        }}
      >
        {unbilledDrawerRecord ? (
          <div className="detail-tab-stack">
            <DetailSummaryCards
              columns={3}
              items={[
                {
                  icon: <FileSearchOutlined />,
                  key: 'candidate',
                  label: '候选流水',
                  value: `${unbilledIncomeCandidates.length} 条`
                },
                {
                  icon: <CheckSquareOutlined />,
                  key: 'selected',
                  label: '本次选择',
                  value: `${selectedUnbilledRows.length} 条`
                },
                {
                  icon: <WalletOutlined />,
                  key: 'amount',
                  label: '申报金额',
                  value: formatMoney(selectedUnbilledAmount)
                }
              ]}
            />
            <DetailSection icon={<FileSearchOutlined />} title="候选流水">
              <CompactDetailTable<FinanceDeclarationUnbilledIncomeCandidate>
                columns={unbilledIncomeColumns}
                dataSource={unbilledIncomeCandidates}
                emptyText="暂无可确认的未开票收入流水"
                rowKey={(candidate) => candidate.record.transactionNo}
                rowSelection={{
                  selectedRowKeys: selectedUnbilledTransactionNos,
                  onChange: (selectedRowKeys) => {
                    setSelectedUnbilledTransactionNos(selectedRowKeys.map(String));
                  }
                }}
                scrollX={820}
              />
            </DetailSection>
          </div>
        ) : null}
      </DetailDrawerShell>
    </ManagementPageScaffold>
  );
}
