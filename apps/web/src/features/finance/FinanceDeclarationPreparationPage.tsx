import {
  AuditOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  PercentageOutlined,
  WalletOutlined,
  PlusOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Alert, DatePicker, Input, InputNumber, Select, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import { FileSlot } from '../../components/FileSlot';
import { FilterBar, FilterField, FilterPanel } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { CompactCell } from '../../components/TableCell';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { TagChip } from '../../components/TagChip';
import { useSalaryManagementState } from '../salary/SalaryManagementState';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { CorporateIncomeTaxSourceTable } from './CorporateIncomeTaxSourceTable';
import { CorporateIncomeTaxAnnualSourceReviewPanel } from './CorporateIncomeTaxAnnualSourceReviewPanel';
import { DeclarationCheckResultCell } from './DeclarationCheckResultCell';
import { buildCorporateIncomeTaxAccountingSources } from './financeCorporateIncomeTaxModel';
import { getPreparationItemCheckResult } from './declarationCheckResultModel';
import { buildCapitalBookStampDutySourcesFromLedger } from './financeStampDutyLedgerBridge';
import { useFinanceManagement } from './FinanceManagementState';
import { PayrollIitEmployeeDetailPanel } from './PayrollIitEmployeeDetailPanel';
import { StampDutySourceDetailTable } from './StampDutySourceDetailTable';
import { StampDutySourceDetailDrawer } from './StampDutySourceDetailDrawer';
import { VatUnbilledIncomeDetailTable } from './VatUnbilledIncomeDetailTable';
import {
  applyDeclarationPreparationSourceState,
  declarationPreparationStatusTone,
  getDeclarationPreparationAccountingPeriod,
  getDeclarationPreparationUnbilledIncomeCandidates,
  getDeclarationPreparationProgress,
  isDeclarationPreparationReady,
  type FinanceCorporateIncomeTaxAnnualSourceReview,
  type FinanceDeclarationPreparationItem,
  type FinanceDeclarationPreparationRecord,
  type FinanceDeclarationPreparationStatus,
  type FinanceDeclarationPreparationTaxType,
  type FinanceUnbilledIncomeExclusionReason
} from './financeDeclarationPreparationData';
import {
  buildManualDocumentStampDutySource,
  validateStampDutyDocumentAmounts,
  type FinanceStampDutySourceRecord
} from './financeStampDutyModel';
import type {
  CustomerContractAmountTaxMode
} from '../customers/customerData';
import { getActiveFinanceTaxPolicyProfile, type FinanceStampDutyTaxItem } from './financeTaxPolicyModel';
import { financeToday, formatMoney } from './financeUtils';

type FilterOptionValue = '全部';

type DeclarationPreparationFilters = {
  period: FilterOptionValue | string;
  status: FilterOptionValue | FinanceDeclarationPreparationStatus;
  taxType: FilterOptionValue | FinanceDeclarationPreparationTaxType;
};

const defaultFilters: DeclarationPreparationFilters = {
  period: '全部',
  status: '全部',
  taxType: '全部'
};

type StampDutyDocumentForm = {
  amount?: number;
  amountTaxMode: CustomerContractAmountTaxMode;
  counterparty: string;
  counterpartyTaxId: string;
  documentName: string;
  documentNo: string;
  files: RelatedFileRecord[];
  signedAt: string;
  taxItem: FinanceStampDutyTaxItem;
  vatAmount?: number;
};

const defaultStampDutyDocumentForm: StampDutyDocumentForm = {
  amount: undefined,
  amountTaxMode: '价税分列',
  counterparty: '',
  counterpartyTaxId: '',
  documentName: '',
  documentNo: '',
  files: [],
  signedAt: financeToday,
  taxItem: '买卖合同',
  vatAmount: undefined
};

const declarationPreparationTaxTypeTone = {
  个人所得税: 'purple',
  增值税及附加: 'green',
  企业所得税: 'amber',
  印花税: 'gray'
} as const;

function uniqueOptions<T extends string>(records: FinanceDeclarationPreparationRecord[], selector: (record: FinanceDeclarationPreparationRecord) => T) {
  return Array.from(new Set(records.map(selector)));
}

function matchesFilters(record: FinanceDeclarationPreparationRecord, filters: DeclarationPreparationFilters) {
  if (filters.period !== '全部' && record.period !== filters.period) {
    return false;
  }

  if (filters.taxType !== '全部' && record.taxType !== filters.taxType) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  return true;
}

function getPreparationRowProgressText(record: FinanceDeclarationPreparationRecord) {
  const progress = getDeclarationPreparationProgress(record);

  return `${progress.totalCount - progress.pendingCount}/${progress.totalCount} 项`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function getCorporateIncomeTaxEligibilityText(summary: FinanceDeclarationPreparationRecord['citSummary']) {
  if (!summary) {
    return '-';
  }

  return summary.smallLowProfitEligible ? '符合' : '不符合';
}

function getPreparationBasisCell(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '印花税') {
    return {
      primary: formatMoney(record.stampDutySummary?.taxableBasis ?? 0),
      secondary: '计税依据'
    };
  }

  if (record.taxType === '个人所得税') {
    return {
      primary: formatMoney(record.iitSummary?.currentIncomeAmount ?? 0),
      secondary: '本月计税工资'
    };
  }

  if (record.taxType === '企业所得税') {
    return {
      primary: formatMoney(record.citSummary?.cumulativeProfitBeforeTaxAmount ?? 0),
      secondary: record.declarationScenario === '年度汇算' ? '全年利润总额' : '本年累计利润'
    };
  }

  return {
    primary: formatMoney(record.vatSummary.declaredNetSalesAmount),
    secondary: '不含税销售额'
  };
}

function getPreparationEstimatedTaxAmount(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '印花税') {
    return record.stampDutySummary?.estimatedPayableAmount ?? 0;
  }

  if (record.taxType === '个人所得税') {
    return record.iitSummary?.payableAmount ?? 0;
  }

  if (record.taxType === '企业所得税') {
    return (record.citSummary?.currentPeriodPayableAmount ?? 0) || (record.citSummary?.overpaidTaxAmount ?? 0);
  }

  return record.vatSummary.estimatedTotalTaxAmount;
}

function getPreparationScopeSummary(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '个人所得税') {
    return { label: '申报人员', value: record.iitSummary?.participantSummary ?? '待生成' };
  }

  if (record.taxType === '印花税') {
    return { label: '税源数量', value: `${record.stampDutySummary?.sourceCount ?? 0} 条` };
  }

  if (record.taxType === '企业所得税') {
    return {
      label: record.declarationScenario === '年度汇算' ? '全年利润总额' : '本年累计利润总额',
      value: formatMoney(record.citSummary?.cumulativeProfitBeforeTaxAmount ?? 0)
    };
  }

  return { label: '申报周期', value: record.vatSummary.filingCycle };
}

function getCorporateIncomeTaxNetAdjustmentAmount(summary: FinanceDeclarationPreparationRecord['citSummary']) {
  return (summary?.taxAdjustmentIncreaseAmount ?? 0) - (summary?.taxAdjustmentDecreaseAmount ?? 0);
}

function getPreparationResultItems(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '印花税') {
    const summary = record.stampDutySummary;

    return [
      { label: '税源数量', value: `${summary?.sourceCount ?? 0} 条` },
      { label: '计税依据', value: formatMoney(summary?.taxableBasis ?? 0) },
      { label: '减免前税额', value: formatMoney(summary?.taxBeforeReduction ?? 0) },
      { label: '六税两费减征', value: formatMoney(summary?.reductionAmount ?? 0) },
      { label: '预计应纳税额', value: formatMoney(summary?.estimatedPayableAmount ?? 0) },
      { label: '待处理税源', value: `${(summary?.pendingCount ?? 0) + (summary?.waitingSettlementCount ?? 0)} 条` }
    ];
  }

  if (record.taxType === '个人所得税') {
    const summary = record.iitSummary;

    return [
      { label: '申报人员', value: summary?.participantSummary ?? '待生成' },
      { label: '本月计税工资', value: formatMoney(summary?.currentIncomeAmount ?? 0) },
      { label: '基本减除费用', value: formatMoney(summary?.currentBasicDeductionAmount ?? 0) },
      { label: '社保公积金个人部分', value: formatMoney(summary?.currentSpecialDeductionAmount ?? 0) },
      { label: '专项附加扣除', value: formatMoney(summary?.currentAdditionalDeductionAmount ?? 0) },
      { label: '其他依法扣除', value: formatMoney(summary?.currentOtherDeductionAmount ?? 0) },
      { label: '本月应纳税所得额', value: formatMoney(summary?.currentTaxableIncomeAmount ?? 0) },
      { label: '预计个税', value: formatMoney(summary?.payableAmount ?? 0) }
    ];
  }

  if (record.taxType === '企业所得税') {
    const summary = record.citSummary;
    const netAdjustmentAmount = getCorporateIncomeTaxNetAdjustmentAmount(summary);

    const isAnnual = record.declarationScenario === '年度汇算';
    return [
      { label: '数据口径', value: summary?.reportingBasis ?? '-' },
      { label: isAnnual ? '全年利润总额' : '本年累计利润总额', value: formatMoney(summary?.cumulativeProfitBeforeTaxAmount ?? 0) },
      { label: isAnnual ? '年度纳税调整' : '累计纳税调整', value: formatMoney(netAdjustmentAmount) },
      { label: '弥补以前年度亏损', value: formatMoney(summary?.priorLossDeductionAmount ?? 0) },
      { label: isAnnual ? '年度应纳税所得额' : '累计实际利润额', value: formatMoney(summary?.cumulativeTaxableIncomeAmount ?? 0) },
      { label: '小型微利资格', value: getCorporateIncomeTaxEligibilityText(summary) },
      { label: '法定税额', value: formatMoney(summary?.statutoryIncomeTaxAmount ?? 0) },
      { label: '减免所得税额', value: formatMoney(summary?.incomeTaxReliefAmount ?? 0) },
      { label: '累计应纳所得税额', value: formatMoney(summary?.cumulativeIncomeTaxPayableAmount ?? 0) },
      { label: '本年实际已缴', value: formatMoney(summary?.taxPaidYearToDateAmount ?? 0) },
      { label: isAnnual ? '年度应补' : '本季应预缴', value: formatMoney(summary?.currentPeriodPayableAmount ?? 0) },
      ...(isAnnual ? [{ label: '年度多缴', value: formatMoney(summary?.overpaidTaxAmount ?? 0) }] : []),
      { label: '优惠后有效税率', value: formatPercent(summary?.effectiveTaxRate ?? 0) }
    ];
  }

  return [
    { label: '申报销售额', value: formatMoney(record.vatSummary.declaredNetSalesAmount) },
    { label: '计税结果', value: record.vatSummary.taxOutcome },
    { label: '适用征收率', value: record.vatSummary.appliedTaxRate },
    { label: '应缴增值税', value: formatMoney(record.vatSummary.estimatedVatAfterExemption) },
    {
      label: '城市维护建设税',
      value: formatMoney(record.vatSummary.surchargeBreakdown.urbanMaintenanceTaxAfterReduction)
    },
    {
      label: '教育费附加',
      value: formatMoney(record.vatSummary.surchargeBreakdown.educationSurchargeAfterReduction)
    },
    {
      label: '地方教育附加',
      value: formatMoney(record.vatSummary.surchargeBreakdown.localEducationSurchargeAfterReduction)
    },
    { label: '附加税减征', value: formatMoney(record.vatSummary.surchargeBreakdown.reductionAmount) },
    { label: '本次应缴合计', value: formatMoney(record.vatSummary.estimatedTotalTaxAmount) }
  ];
}

function getVatDeclarationLineItems(record: FinanceDeclarationPreparationRecord) {
  return [
    { label: '增值税专用发票', value: formatMoney(record.vatSummary.specialInvoiceSalesAmount) },
    { label: '其他发票及未开票', value: formatMoney(record.vatSummary.otherInvoiceAndUnbilledSalesAmount) },
    { label: '货物及劳务', value: formatMoney(record.vatSummary.goodsLaborSalesAmount) },
    { label: '服务、不动产和无形资产', value: formatMoney(record.vatSummary.serviceSalesAmount) },
    { label: '红票冲减', value: formatMoney(record.vatSummary.redInvoiceNetAmount) },
    { label: '前期未开票冲抵', value: formatMoney(record.vatSummary.priorUnbilledOffsetNetAmount) },
    { label: '免税销售额', value: formatMoney(record.vatSummary.exemptSalesAmount) },
    { label: '减按 1% 销售额', value: formatMoney(record.vatSummary.reducedRateSalesAmount) },
    { label: '法定征收率销售额', value: formatMoney(record.vatSummary.legalRateSalesAmount) },
    { label: '季度免税限额', value: formatMoney(record.vatSummary.exemptionThreshold) },
    {
      label: '限额判断',
      value: record.vatSummary.isBelowExemptionThreshold ? '未超过限额' : '超过限额'
    },
    { label: '附加税计税依据', value: formatMoney(record.vatSummary.estimatedVatAfterExemption) }
  ];
}

function getVisiblePreparationItems(record: FinanceDeclarationPreparationRecord) {
  if (record.taxType === '企业所得税') {
    return record.items.filter((item) => item.type !== '利润数据同步');
  }

  if (record.taxType === '增值税及附加') {
    return record.items.filter((item) => item.type !== '申报测算');
  }

  return record.items;
}

function formatPreparationItemValue(item: FinanceDeclarationPreparationItem) {
  if (item.type === '季度账务完整性检查') {
    return item.amount > 0 ? `${item.amount.toLocaleString('zh-CN')} 张` : '无待记账';
  }

  if (item.type === '历史申报连续性检查') {
    return item.amount > 0 ? `${item.amount.toLocaleString('zh-CN')} 个季度` : '申报连续';
  }

  if (
    item.type === '年度结账检查'
    || item.type === '年度报表检查'
    || item.type === '第四季度预缴检查'
    || item.type === '优惠资格判定'
  ) {
    return '-';
  }

  return formatMoney(item.amount);
}

function getPreparationBlockingItems(record: FinanceDeclarationPreparationRecord) {
  return getVisiblePreparationItems(record).filter((item) => item.status === '待确认');
}

function DrawerTitle({ record }: { record: FinanceDeclarationPreparationRecord }) {
  return (
    <DetailDrawerTitle
      status={record.status}
      statusToneMap={declarationPreparationStatusTone}
      subtitle={record.preparationNo}
      title={record.title}
    />
  );
}

export function FinanceDeclarationPreparationPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    accountingPeriodLocks,
    accountingVoucherRows,
    addManualStampDutySource,
    declarationPreparationRows,
    financeRows,
    getAccountingPeriodGuard,
    invoiceBusinessAllocationRows,
    invoiceRows,
    manualStampDutySourceRows,
    receivablePayableRows,
    saveStampDutySourceResolution,
    stampDutySourceResolutionRows,
    taxMatterRows,
    updateDeclarationPreparationRecord
  } = useFinanceManagement();
  const { contractRows, customerRows } = useCustomerManagementState();
  const { peopleRows } = usePeopleOrganizationState();
  const { salaryPaymentRecords } = useSalaryManagementState();
  const [filters, setFilters] = useState<DeclarationPreparationFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [stampDutyDocumentForm, setStampDutyDocumentForm] = useState<StampDutyDocumentForm>(defaultStampDutyDocumentForm);
  const [stampDutyDocumentDrawerOpen, setStampDutyDocumentDrawerOpen] = useState(false);
  const [activeStampDutySource, setActiveStampDutySource] = useState<FinanceStampDutySourceRecord>();
  const corporateIncomeTaxAccountingSources = useMemo(
    () => buildCorporateIncomeTaxAccountingSources(
      declarationPreparationRows,
      peopleRows,
      accountingVoucherRows,
      accountingPeriodLocks
    ),
    [accountingPeriodLocks, accountingVoucherRows, declarationPreparationRows, peopleRows]
  );
  const capitalBookStampDutySources = useMemo(
    () => buildCapitalBookStampDutySourcesFromLedger(declarationPreparationRows, accountingVoucherRows),
    [accountingVoucherRows, declarationPreparationRows]
  );
  const displayDeclarationPreparationRows = useMemo(
    () => applyDeclarationPreparationSourceState(
      declarationPreparationRows,
      invoiceRows,
      financeRows,
      receivablePayableRows,
      invoiceBusinessAllocationRows,
      taxMatterRows,
      salaryPaymentRecords,
      corporateIncomeTaxAccountingSources,
      accountingPeriodLocks,
      contractRows,
      customerRows,
      manualStampDutySourceRows,
      stampDutySourceResolutionRows,
      capitalBookStampDutySources
    ),
    [accountingPeriodLocks, capitalBookStampDutySources, contractRows, corporateIncomeTaxAccountingSources, customerRows, declarationPreparationRows, financeRows, invoiceBusinessAllocationRows, invoiceRows, manualStampDutySourceRows, receivablePayableRows, salaryPaymentRecords, stampDutySourceResolutionRows, taxMatterRows]
  );

  const filteredRows = useMemo(
    () => displayDeclarationPreparationRows.filter((record) => matchesFilters(record, filters)),
    [displayDeclarationPreparationRows, filters]
  );
  const activeRecord = useMemo(
    () => displayDeclarationPreparationRows.find((record) => record.id === activeRecordId),
    [activeRecordId, displayDeclarationPreparationRows]
  );
  const activeUnbilledIncomeCandidates = useMemo(
    () =>
      activeRecord?.taxType === '增值税及附加'
        ? getDeclarationPreparationUnbilledIncomeCandidates(
            activeRecord,
            invoiceRows,
            receivablePayableRows,
            invoiceBusinessAllocationRows,
            displayDeclarationPreparationRows
          )
        : [],
    [activeRecord, displayDeclarationPreparationRows, invoiceBusinessAllocationRows, invoiceRows, receivablePayableRows]
  );
  const periodOptions = ['全部', ...uniqueOptions(displayDeclarationPreparationRows, (record) => record.period)];
  const taxTypeOptions = ['全部', ...uniqueOptions(displayDeclarationPreparationRows, (record) => record.taxType)];
  const statusOptions = ['全部', ...uniqueOptions(displayDeclarationPreparationRows, (record) => record.status)];
  const preparingRows = displayDeclarationPreparationRows.filter((record) => record.status === '准备中');
  const readyRows = displayDeclarationPreparationRows.filter((record) => record.status === '可申报');
  const pendingItemCount = displayDeclarationPreparationRows.reduce(
    (total, record) => total + getDeclarationPreparationProgress(record).pendingCount,
    0
  );
  const activeRecordAccountingPeriod = activeRecord
    ? getDeclarationPreparationAccountingPeriod(activeRecord.period)
    : undefined;
  const activeRecordPeriodGuard = activeRecord
    ? getAccountingPeriodGuard(activeRecordAccountingPeriod, '调整申报准备')
    : undefined;
  const activeRecordReadbackNotice =
    activeRecordPeriodGuard && !activeRecordPeriodGuard.allowed
      ? `${activeRecordPeriodGuard.reason} 当前申报准备仅用于回看，不再调整申报口径。`
      : undefined;

  function updatePreparation(recordId: string, updater: (record: FinanceDeclarationPreparationRecord) => FinanceDeclarationPreparationRecord) {
    return updateDeclarationPreparationRecord(recordId, updater);
  }

  function handleUnbilledIncomeInclusionChange(businessRecordId: string, included: boolean) {
    if (!activeRecord || activeRecord.status !== '准备中' || activeRecordReadbackNotice) {
      return;
    }

    updatePreparation(activeRecord.id, (currentRecord) => {
      const currentExclusions = currentRecord.unbilledIncomeExclusions ?? [];

      if (included) {
        const exclusion = currentExclusions.find((item) => item.businessRecordId === businessRecordId);

        return {
          ...currentRecord,
          operationRecords: exclusion?.reason
            ? [{
                action: '恢复系统纳入',
                actor: '李明',
                id: `declaration-prep-op-unbilled-include-${Date.now()}`,
                object: currentRecord.preparationNo,
                summary: `${businessRecordId} 恢复纳入本期未开票收入`,
                time: `${financeToday} 15:00`
              }, ...currentRecord.operationRecords]
            : currentRecord.operationRecords,
          status: '准备中',
          unbilledIncomeExclusions: currentExclusions.filter((item) => item.businessRecordId !== businessRecordId),
          updatedAt: financeToday
        };
      }

      if (currentExclusions.some((item) => item.businessRecordId === businessRecordId)) {
        return currentRecord;
      }

      return {
        ...currentRecord,
        status: '准备中',
        unbilledIncomeExclusions: [
          ...currentExclusions,
          {
            businessRecordId,
            excludedAt: `${financeToday} 15:00`,
            excludedBy: '李明'
          }
        ],
        updatedAt: financeToday
      };
    });
  }

  function handleUnbilledIncomeReasonChange(
    businessRecordId: string,
    reason: FinanceUnbilledIncomeExclusionReason
  ) {
    if (!activeRecord || activeRecord.status !== '准备中' || activeRecordReadbackNotice) {
      return;
    }

    updatePreparation(activeRecord.id, (currentRecord) => {
      const currentExclusions = currentRecord.unbilledIncomeExclusions ?? [];
      const previousExclusion = currentExclusions.find((item) => item.businessRecordId === businessRecordId);

      if (previousExclusion?.reason === reason) {
        return currentRecord;
      }

      return {
        ...currentRecord,
        operationRecords: [{
          action: '排除未开票事项',
          actor: '李明',
          id: `declaration-prep-op-unbilled-exclude-${Date.now()}`,
          object: currentRecord.preparationNo,
          summary: `${businessRecordId} 排除原因：${reason}`,
          time: `${financeToday} 15:00`
        }, ...currentRecord.operationRecords],
        status: '准备中',
        unbilledIncomeExclusions: [
          ...currentExclusions.filter((item) => item.businessRecordId !== businessRecordId),
          {
            businessRecordId,
            excludedAt: `${financeToday} 15:00`,
            excludedBy: '李明',
            reason
          }
        ],
        updatedAt: financeToday
      };
    });
  }

  function updateStampDutyDocumentForm(patch: Partial<StampDutyDocumentForm>) {
    setStampDutyDocumentForm((current) => ({ ...current, ...patch }));
  }

  function openStampDutyDocumentDrawer() {
    setStampDutyDocumentForm(defaultStampDutyDocumentForm);
    setStampDutyDocumentDrawerOpen(true);
  }

  function closeStampDutyDocumentDrawer() {
    setStampDutyDocumentDrawerOpen(false);
  }

  function addStampDutyDocumentFile(file: UploadFile) {
    setStampDutyDocumentForm((current) => ({
      ...current,
      files: [
        ...current.files.filter((currentFile) => currentFile.name !== file.name),
        {
          id: String(file.uid),
          name: file.name,
          status: '已选择',
          type: '应税凭证',
          updatedAt: financeToday
        }
      ]
    }));
  }

  function saveStampDutyDocument() {
    const source = buildManualDocumentStampDutySource({
      amountTaxMode: stampDutyDocumentForm.amountTaxMode,
      counterparty: stampDutyDocumentForm.counterparty,
      counterpartyTaxId: stampDutyDocumentForm.counterpartyTaxId,
      documentName: stampDutyDocumentForm.documentName,
      documentNo: stampDutyDocumentForm.documentNo || undefined,
      evidenceFiles: stampDutyDocumentForm.files,
      id: `manual-${Date.now()}`,
      signedAt: stampDutyDocumentForm.signedAt,
      sourceNo: `STAMP-MANUAL-${Date.now()}`,
      sourceVersion: 'V1.0',
      statedAmount: stampDutyDocumentForm.amount,
      statedVatAmount: stampDutyDocumentForm.amountTaxMode === '价税分列' ? stampDutyDocumentForm.vatAmount : undefined,
      taxItem: stampDutyDocumentForm.taxItem
    });

    if (!addManualStampDutySource(source)) {
      void messageApi.warning('该应税凭证无法补录，请检查重复来源或期间状态');
      return;
    }

    closeStampDutyDocumentDrawer();
    void messageApi.success('应税凭证已补录');
  }

  function saveStampDutyResolution(resolution: Parameters<typeof saveStampDutySourceResolution>[0]) {
    if (!saveStampDutySourceResolution(resolution)) {
      void messageApi.warning('当前期间已锁定，无法修改税源处理结果');
      return;
    }

    setActiveStampDutySource(undefined);
    void messageApi.success('印花税税源处理结果已保存');
  }

  function saveCorporateIncomeTaxAnnualSourceReview(review: FinanceCorporateIncomeTaxAnnualSourceReview) {
    if (!activeRecord || activeRecord.declarationScenario !== '年度汇算' || activeRecord.status !== '准备中') {
      return;
    }

    if (!updatePreparation(activeRecord.id, (currentRecord) => ({
      ...currentRecord,
      citAnnualSourceReview: review,
      operationRecords: [
        {
          action: '核对年度税务资料',
          actor: '李明',
          id: `declaration-prep-op-cit-annual-source-${Date.now()}`,
          object: currentRecord.preparationNo,
          summary: `已核对 ${review.adjustments.length} 项纳税调整及以前年度亏损`,
          time: `${financeToday} 15:00`
        },
        ...currentRecord.operationRecords
      ],
      status: '准备中',
      updatedAt: financeToday
    }))) {
      void messageApi.warning('当前年度汇算资料不可调整');
      return;
    }

    void messageApi.success('年度税务资料已保存');
  }

  function handleConfirmPreparation(record: FinanceDeclarationPreparationRecord) {
    const periodGuard = getAccountingPeriodGuard(getDeclarationPreparationAccountingPeriod(record.period), '确认申报准备结果');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    if (!isDeclarationPreparationReady(record)) {
      void messageApi.warning('仍有准备项未确认');
      return;
    }

    if (!updatePreparation(record.id, (currentRecord) => ({
      ...currentRecord,
      confirmedSourceSnapshotKey: record.sourceSnapshotKey,
      confirmedCitSummary: record.taxType === '企业所得税' ? record.citSummary : currentRecord.confirmedCitSummary,
      confirmedCitAnnualSettlement: record.declarationScenario === '年度汇算' ? record.citAnnualSettlement : currentRecord.confirmedCitAnnualSettlement,
      confirmedCitAnnualSourceReview: record.declarationScenario === '年度汇算' ? record.citAnnualSourceReview : currentRecord.confirmedCitAnnualSourceReview,
      confirmedIitEmployeeRows: record.taxType === '个人所得税' ? record.iitEmployeeRows : currentRecord.confirmedIitEmployeeRows,
      confirmedIitSummary: record.taxType === '个人所得税' ? record.iitSummary : currentRecord.confirmedIitSummary,
      confirmedUnbilledIncomeDeclarations:
        record.taxType === '增值税及附加'
          ? record.unbilledIncomeDeclarations
          : currentRecord.confirmedUnbilledIncomeDeclarations,
      confirmedVatSummary: record.taxType === '增值税及附加' ? record.vatSummary : currentRecord.confirmedVatSummary,
      confirmedStampDutySources: record.taxType === '印花税' ? record.stampDutySources : currentRecord.confirmedStampDutySources,
      confirmedStampDutySummary: record.taxType === '印花税' ? record.stampDutySummary : currentRecord.confirmedStampDutySummary,
      citSummary: record.citSummary ?? currentRecord.citSummary,
      iitEmployeeRows: record.iitEmployeeRows ?? currentRecord.iitEmployeeRows,
      iitSummary: record.iitSummary ?? currentRecord.iitSummary,
      items: record.items,
      stampDutySources: record.stampDutySources ?? currentRecord.stampDutySources,
      stampDutySummary: record.stampDutySummary ?? currentRecord.stampDutySummary,
      status: '可申报',
      vatSummary: record.vatSummary,
      operationRecords: [
        {
          action: record.taxType === '个人所得税' ? '确认申报数据' : '确认准备结果',
          actor: '李明',
          id: `declaration-prep-op-confirm-${Date.now()}`,
          object: currentRecord.preparationNo,
          summary:
            record.taxType === '个人所得税'
              ? `${currentRecord.period} 个人所得税申报数据已确认`
              : `${currentRecord.period} ${currentRecord.taxType} 准备结果已确认`,
          time: `${financeToday} 15:00`
        },
        ...currentRecord.operationRecords
      ],
      updatedAt: financeToday
    }))) {
      void messageApi.warning('当前申报准备结果不可确认');
      return;
    }

    void messageApi.success(record.taxType === '个人所得税' ? '申报数据已确认' : '准备结果已确认');
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
      dataIndex: 'declarationScenario',
      title: '申报类型',
      width: 112
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
      key: 'estimatedTaxAmount',
      render: (_, record) => formatMoney(getPreparationEstimatedTaxAmount(record)),
      title: '预计税费',
      width: 124
    },
    {
      key: 'progress',
      render: (_, record) => {
        const progress = getDeclarationPreparationProgress(record);

        return <CompactCell primary={getPreparationRowProgressText(record)} secondary={progress.pendingCount > 0 ? `${progress.pendingCount} 项阻断` : '检查通过'} />;
      },
      title: '检查进度',
      width: 118
    },
    {
      dataIndex: 'status',
      render: (status: FinanceDeclarationPreparationStatus) => <StatusTag toneMap={declarationPreparationStatusTone} value={status} />,
      title: '准备状态',
      width: 112
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
      dataIndex: 'amount',
      render: (_amount: number, item) => formatPreparationItemValue(item),
      title: '数值',
      width: 128
    },
    {
      dataIndex: 'result',
      render: (_result: string, item) => {
        const presentation = getPreparationItemCheckResult(item);

        return (
          <DeclarationCheckResultCell
            {...presentation}
            tag={item.status === '待确认' ? { tone: 'amber', value: '待完成' } : undefined}
          />
        );
      },
      title: '核对结果',
      width: 300
    }
  ];

  const activeProgress = activeRecord ? getDeclarationPreparationProgress(activeRecord) : undefined;
  const activeBlockingItems = activeRecord ? getPreparationBlockingItems(activeRecord) : [];
  const canConfirmActiveRecord = Boolean(
    activeRecord &&
    activeRecord.status === '准备中' &&
    isDeclarationPreparationReady(activeRecord) &&
    !activeRecordReadbackNotice
  );
  const stampDutyAmountError = validateStampDutyDocumentAmounts({
    amount: stampDutyDocumentForm.amount,
    amountTaxMode: stampDutyDocumentForm.amountTaxMode,
    vatAmount: stampDutyDocumentForm.vatAmount
  });
  const canSaveStampDutyDocument = Boolean(
    stampDutyDocumentForm.documentName.trim() &&
      stampDutyDocumentForm.counterparty.trim() &&
      stampDutyDocumentForm.counterpartyTaxId.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(stampDutyDocumentForm.signedAt) &&
      stampDutyDocumentForm.files.length > 0 &&
      !stampDutyAmountError
  );
  const stampDutyTaxItemOptions = getActiveFinanceTaxPolicyProfile(stampDutyDocumentForm.signedAt.slice(0, 7)).stampDuty.items
    .filter((item) => item.item !== '营业账簿')
    .map((item) => ({ label: item.item, value: item.item }));
  const activeStampDutyResolution = activeStampDutySource
    ? stampDutySourceResolutionRows.find(
        (resolution) =>
          resolution.sourceId === activeStampDutySource.sourceId &&
          resolution.sourceVersion === activeStampDutySource.sourceVersion
      )
    : undefined;

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
          </FilterBar>
        </FilterPanel>
      }
      metrics={
          <MetricGrid columns={4}>
          <MetricCard icon={<FileSearchOutlined />} label="准备事项" value={`${displayDeclarationPreparationRows.length} 条`} />
          <MetricCard icon={<AuditOutlined />} label="准备中" value={`${preparingRows.length} 条`} />
          <MetricCard icon={<CheckCircleOutlined />} label="可申报" value={`${readyRows.length} 条`} />
          <MetricCard icon={<FileTextOutlined />} label="阻断事项" value={`${pendingItemCount} 项`} />
        </MetricGrid>
      }
      pageId="tax-declaration-preparation"
    >
      {contextHolder}
      <ManagementTable<FinanceDeclarationPreparationRecord>
        columns={columns}
        count={{ value: filteredRows.length, unit: '条申报准备' }}
        dataSource={filteredRows}
        primaryAction={filters.taxType === '印花税'
          ? { icon: <PlusOutlined />, label: '补录应税凭证', onClick: openStampDutyDocumentDrawer }
          : undefined}
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
                label: activeRecord.taxType === '个人所得税'
                  ? '确认申报数据'
                  : activeRecord.declarationScenario === '年度汇算'
                    ? '确认汇算准备'
                    : '确认准备结果',
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
                  key: 'scope',
                  ...getPreparationScopeSummary(activeRecord)
                },
                {
                  icon: <PercentageOutlined />,
                  key: 'basis',
                  label:
                    activeRecord.taxType === '个人所得税'
                      ? '本月计税工资'
                      : activeRecord.taxType === '印花税'
                        ? '计税依据'
                      : activeRecord.taxType === '企业所得税'
                        ? activeRecord.declarationScenario === '年度汇算' ? '年度应纳税所得额' : '累计实际利润额'
                        : '不含税销售额',
                  value:
                    activeRecord.taxType === '个人所得税'
                      ? formatMoney(activeRecord.iitSummary?.currentIncomeAmount ?? 0)
                      : activeRecord.taxType === '印花税'
                        ? formatMoney(activeRecord.stampDutySummary?.taxableBasis ?? 0)
                      : activeRecord.taxType === '企业所得税'
                      ? formatMoney(activeRecord.citSummary?.cumulativeTaxableIncomeAmount ?? 0)
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
                  label: '检查进度',
                  value: activeProgress ? `${activeProgress.totalCount - activeProgress.pendingCount}/${activeProgress.totalCount} 项` : '-'
                }
              ]}
            />
            {activeRecordReadbackNotice ? (
              <Alert
                className="finance-period-readback-alert"
                message={activeRecordReadbackNotice}
                showIcon
                type="info"
              />
            ) : null}

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
                        <DetailSection icon={<PercentageOutlined />} title="纳税调整">
                          <DetailInfoGrid
                            columns={3}
                            items={[
                              { label: '调增金额', value: formatMoney(activeRecord.citSummary?.taxAdjustmentIncreaseAmount ?? 0) },
                              { label: '调减金额', value: formatMoney(activeRecord.citSummary?.taxAdjustmentDecreaseAmount ?? 0) },
                              { label: '净调整额', value: formatMoney(getCorporateIncomeTaxNetAdjustmentAmount(activeRecord.citSummary)) }
                            ]}
                          />
                        </DetailSection>
                      ) : null}

                      {activeRecord.declarationScenario === '年度汇算' && activeRecord.citAnnualSettlement ? (
                        <DetailSection icon={<AuditOutlined />} title="年度汇算前置">
                          <DetailInfoGrid
                            columns={3}
                            items={[
                              { label: '12 月结账', value: activeRecord.citAnnualSettlement.yearEndClosed ? '已完成' : '待完成' },
                              { label: '年度财务报表', value: activeRecord.citAnnualSettlement.annualFinancialStatementsReady ? '可出具' : '待完成' },
                              { label: '第四季度预缴', value: activeRecord.citAnnualSettlement.q4PrepaymentReady ? '已完成' : '待完成' },
                              { label: '纳税调整资料', value: activeRecord.citAnnualSettlement.adjustmentSourceReady ? '已核对' : '待核对' },
                              { label: '以前年度亏损', value: activeRecord.citAnnualSettlement.priorLossSourceReady ? '已核对' : '待核对' }
                            ]}
                          />
                        </DetailSection>
                      ) : null}

                      {activeBlockingItems.length > 0 ? (
                        <DetailSection
                          extra={<TagChip label={`${activeBlockingItems.length} 项`} tone="amber" />}
                          icon={<AuditOutlined />}
                          title="阻断事项"
                        >
                          <CompactDetailTable<FinanceDeclarationPreparationItem>
                            columns={itemColumns}
                            dataSource={activeBlockingItems}
                            rowKey="id"
                            scrollX={620}
                          />
                        </DetailSection>
                      ) : null}

                      {activeRecord.taxType !== '印花税' && activeRecord.taxType !== '个人所得税' ? (
                        <DetailSection
                          extra={activeProgress ? <TagChip label={`${activeProgress.totalCount - activeProgress.pendingCount}/${activeProgress.totalCount} 项`} tone={activeProgress.pendingCount > 0 ? 'amber' : 'green'} /> : null}
                          icon={<AuditOutlined />}
                          title="核对结果"
                        >
                          <CompactDetailTable<FinanceDeclarationPreparationItem>
                            columns={itemColumns}
                            dataSource={getVisiblePreparationItems(activeRecord).filter((item) => item.status !== '待确认')}
                            rowKey="id"
                            scrollX={620}
                          />
                        </DetailSection>
                      ) : null}
                    </>
                  ),
                  key: 'overview',
                  label: '申报概览'
                },
                {
                  children: (
                    <>
                      {activeRecord.taxType === '个人所得税' ? (
                        <DetailSection icon={<FileTextOutlined />} title="员工明细">
                          <PayrollIitEmployeeDetailPanel
                            payableAmount={activeRecord.iitSummary?.payableAmount ?? 0}
                            records={activeRecord.iitEmployeeRows ?? []}
                            summary={activeRecord.iitSummary}
                          />
                        </DetailSection>
                      ) : null}
                      {activeRecord.taxType === '增值税及附加' ? (
                        <>
                          <DetailSection icon={<PercentageOutlined />} title="申报栏次">
                            <DetailInfoGrid columns={4} items={getVatDeclarationLineItems(activeRecord)} />
                          </DetailSection>
                          <DetailSection icon={<FileTextOutlined />} title="未开票应税事项">
                            <VatUnbilledIncomeDetailTable
                              editable={activeRecord.status === '准备中' && !activeRecordReadbackNotice}
                              records={activeUnbilledIncomeCandidates}
                              onInclusionChange={handleUnbilledIncomeInclusionChange}
                              onReasonChange={handleUnbilledIncomeReasonChange}
                            />
                          </DetailSection>
                        </>
                      ) : null}
                      {activeRecord.taxType === '企业所得税' ? (
                        <DetailSection icon={<FileTextOutlined />} title="数据来源">
                          <CorporateIncomeTaxSourceTable record={activeRecord} />
                        </DetailSection>
                      ) : null}
                      {activeRecord.declarationScenario === '年度汇算' && activeRecord.citAnnualSettlement ? (
                        <CorporateIncomeTaxAnnualSourceReviewPanel
                          editable={activeRecord.status === '准备中' && !activeRecordReadbackNotice}
                          profitBeforeTaxAmount={activeRecord.citSummary?.cumulativeProfitBeforeTaxAmount ?? 0}
                          review={activeRecord.citAnnualSourceReview}
                          onSave={saveCorporateIncomeTaxAnnualSourceReview}
                        />
                      ) : null}
                      {activeRecord.taxType === '印花税' ? (
                        <DetailSection icon={<FileTextOutlined />} title="税源明细">
                          <StampDutySourceDetailTable
                            records={activeRecord.stampDutySources ?? []}
                            onRecordClick={setActiveStampDutySource}
                          />
                        </DetailSection>
                      ) : null}
                    </>
                  ),
                  key: 'details',
                  label: '申报明细'
                },
                {
                  children: (
                    <OperationRecordSection
                      icon={<CheckCircleOutlined />}
                      records={activeRecord.operationRecords}
                      title="操作记录"
                    />
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

      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: closeStampDutyDocumentDrawer }}
        open={stampDutyDocumentDrawerOpen}
        primaryAction={{
          disabled: !canSaveStampDutyDocument,
          label: '保存凭证',
          onClick: saveStampDutyDocument
        }}
        title={<DetailDrawerTitle title="补录应税凭证" subtitle="印花税申报准备" />}
        width={760}
        onClose={closeStampDutyDocumentDrawer}
      >
        <DetailSection icon={<FileTextOutlined />} title="凭证信息">
          <DrawerFormGrid>
            <DrawerFormField label="凭证名称" required>
              <Input
                value={stampDutyDocumentForm.documentName}
                onChange={(event) => updateStampDutyDocumentForm({ documentName: event.target.value })}
              />
            </DrawerFormField>
            <DrawerFormField label="凭证编号">
              <Input
                value={stampDutyDocumentForm.documentNo}
                onChange={(event) => updateStampDutyDocumentForm({ documentNo: event.target.value })}
              />
            </DrawerFormField>
            <DrawerFormField label="法定税目" required>
              <Select
                value={stampDutyDocumentForm.taxItem}
                options={stampDutyTaxItemOptions}
                onChange={(taxItem) => updateStampDutyDocumentForm({ taxItem })}
              />
            </DrawerFormField>
            <DrawerFormField label="签署日期" required>
              <DatePicker
                inputReadOnly
                style={{ width: '100%' }}
                value={dayjs(stampDutyDocumentForm.signedAt)}
                onChange={(_, dateString) => updateStampDutyDocumentForm({ signedAt: Array.isArray(dateString) ? dateString[0] ?? '' : dateString })}
              />
            </DrawerFormField>
            <DrawerFormField label="对方名称" required>
              <Input
                value={stampDutyDocumentForm.counterparty}
                onChange={(event) => updateStampDutyDocumentForm({ counterparty: event.target.value })}
              />
            </DrawerFormField>
            <DrawerFormField label="对方纳税人识别号" required>
              <Input
                value={stampDutyDocumentForm.counterpartyTaxId}
                onChange={(event) => updateStampDutyDocumentForm({ counterpartyTaxId: event.target.value })}
              />
            </DrawerFormField>
            <DrawerFormField label="凭证金额">
              <InputNumber
                min={0.01}
                placeholder="未列明金额可不填"
                precision={2}
                style={{ width: '100%' }}
                value={stampDutyDocumentForm.amount}
                onChange={(amount) => updateStampDutyDocumentForm({ amount: amount === null ? undefined : Number(amount) })}
              />
            </DrawerFormField>
            <DrawerFormField label="价税方式" required>
              <Select
                value={stampDutyDocumentForm.amountTaxMode}
                options={(
                  ['价税分列', '含税未分列', '不涉及增值税'] satisfies CustomerContractAmountTaxMode[]
                ).map((amountTaxMode) => ({ label: amountTaxMode, value: amountTaxMode }))}
                onChange={(amountTaxMode) => updateStampDutyDocumentForm({ amountTaxMode, vatAmount: undefined })}
              />
            </DrawerFormField>
            {stampDutyDocumentForm.amountTaxMode === '价税分列' ? (
              <DrawerFormField label="单列增值税额">
                <InputNumber
                  min={0}
                  precision={2}
                  status={stampDutyAmountError ? 'error' : undefined}
                  style={{ width: '100%' }}
                  value={stampDutyDocumentForm.vatAmount}
                  onChange={(vatAmount) => updateStampDutyDocumentForm({ vatAmount: vatAmount === null ? undefined : Number(vatAmount) })}
                />
              </DrawerFormField>
            ) : null}
          </DrawerFormGrid>
        </DetailSection>
        <DetailSection icon={<FileSearchOutlined />} title="签署文件">
          <FileSlot<RelatedFileRecord>
            accept=".pdf,.jpg,.jpeg,.png"
            description="上传真实签署凭证，支持 PDF/JPG/PNG。"
            emptyText="至少上传 1 份签署文件"
            files={stampDutyDocumentForm.files}
            multiple
            status={stampDutyDocumentForm.files.length > 0 ? '已选择' : '待补充'}
            title="应税凭证文件 *"
            uploadText="上传文件"
            variant="list"
            onRemove={(file) =>
              setStampDutyDocumentForm((current) => ({
                ...current,
                files: current.files.filter((currentFile) => currentFile.id !== file.id)
              }))
            }
            onSelect={addStampDutyDocumentFile}
          />
        </DetailSection>
      </DrawerFormShell>

      <StampDutySourceDetailDrawer
        editable={Boolean(activeRecord?.status === '准备中' && !activeRecordReadbackNotice)}
        record={activeStampDutySource}
        resolution={activeStampDutyResolution}
        onClose={() => setActiveStampDutySource(undefined)}
        onDownloadFile={(fileName) => void messageApi.info(`已下载 ${fileName}`)}
        onPreviewFile={(fileName) => void messageApi.info(`正在预览 ${fileName}`)}
        onSave={saveStampDutyResolution}
      />

    </ManagementPageScaffold>
  );
}
