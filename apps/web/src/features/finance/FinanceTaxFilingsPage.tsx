import {
  AuditOutlined,
  CalendarOutlined,
  FileProtectOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Select, message } from 'antd';
import { useMemo, useState } from 'react';
import { StatusTag } from '../../components/Detail';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { ManagementTableTabs } from '../../components/ManagementTableTabs';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CompactCell } from '../../components/TableCell';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import { getDefaultPublicAccountRef, usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { useSalaryManagementState } from '../salary/SalaryManagementState';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { useFinanceManagement } from './FinanceManagementState';
import { buildCorporateIncomeTaxAccountingSources } from './financeCorporateIncomeTaxModel';
import { buildCapitalBookStampDutySourcesFromLedger } from './financeStampDutyLedgerBridge';
import { StampDutySourceDetailDrawer } from './StampDutySourceDetailDrawer';
import type { FinanceStampDutySourceRecord } from './financeStampDutyModel';
import {
  TaxDeclarationEvidenceDrawer,
  TaxDeclarationResultDrawer,
  TaxDeclarationRevisionDrawer,
  TaxOffsetResultDrawer,
  TaxPaymentResultDrawer,
  TaxRefundApplicationDrawer,
  TaxRefundResultDrawer
} from './FinanceTaxMatterActionDrawers';
import { FinanceTaxMatterDetailDrawer } from './FinanceTaxMatterDetailDrawer';
import {
  getTaxMatterProcessStatusLabel,
  taxMatterOfficialHandlingEntries,
  type TaxMatterEditorMode
} from './financeTaxMatterHandlingModel';
import {
  taxMatterProcessStatusTone,
  type FinanceTaxMatterProcessStatus,
  type FinanceTaxMatterRecord,
  type FinanceTaxMatterType
} from './financeTaxFilingData';
import {
  applyDeclarationPreparationSourceState,
  getDeclarationPreparationUnbilledIncomeCandidates
} from './financeDeclarationPreparationData';
import {
  applyDeclarationPreparationsToTaxMatters,
  attachTaxMatterPaymentTransaction,
  attachTaxMatterRefundTransaction,
  buildTaxMatterPaymentTransaction,
  buildTaxMatterRefundTransaction,
  findDeclarationPreparationForTaxMatter,
  getTaxMatterDeclarationPreparationSnapshot,
  getTaxMatterDeclarationResultValidationError,
  getTaxMatterDeclarationRevisionValidationError,
  getTaxMatterCurrentVersionPaidAmount,
  getTaxMatterCurrentVersionRefundedAmount,
  getTaxMatterEvidenceStatus,
  getTaxMatterOutstandingAmount,
  getTaxMatterRefundOutstandingAmount,
  getTaxMatterSettlementDirection,
  recordTaxMatterDeclarationResult,
  recordTaxMatterOffsetResult,
  recordTaxMatterPaymentResult,
  recordTaxMatterRefundApplication,
  recordTaxMatterRefundResult,
  startTaxMatterDeclarationRevision,
  supplementTaxMatterDeclarationEvidence,
  type TaxMatterDeclarationEvidenceInput,
  type TaxMatterDeclarationResultInput,
  type TaxMatterOffsetResultInput,
  type TaxMatterPaymentResultInput,
  type TaxMatterRefundApplicationInput,
  type TaxMatterRefundResultInput
} from './financeTaxMatterModel';
import {
  financeToday,
  formatMoney
} from './financeUtils';

type FilterOptionValue = '全部';
type TaxMatterScope = 'pending' | 'completed' | 'all';
type TaxMatterEditorState = {
  mode: TaxMatterEditorMode;
  recordId: string;
} | undefined;

type FinanceTaxMatterFilters = {
  keyword: string;
  matterType: FilterOptionValue | FinanceTaxMatterType;
  period: FilterOptionValue | string;
};

const currentPeriod = financeToday.slice(0, 7);
const currentQuarter = getQuarterPeriod(financeToday);

const defaultFilters: FinanceTaxMatterFilters = {
  keyword: '',
  matterType: '全部',
  period: '全部'
};

const allowedTaxMatterTypes = new Set<FinanceTaxMatterType>(['个人所得税', '增值税及附加', '企业所得税', '印花税', '其他税费']);

function getQuarterPeriod(dateText: string) {
  const [year, monthText] = dateText.split('-');
  const month = Number(monthText);
  const quarter = Math.ceil(month / 3);

  return `${year}-Q${quarter}`;
}

function uniqueOptions<T extends string>(records: FinanceTaxMatterRecord[], selector: (record: FinanceTaxMatterRecord) => T) {
  return Array.from(new Set(records.map(selector)));
}

function getSourceSearchText(record: FinanceTaxMatterRecord) {
  return record.sourceItems.map((item) => `${item.name} ${item.sourceModule} ${item.status}`).join(' ');
}

function renderTaxMatterProcessStatus(status: FinanceTaxMatterProcessStatus) {
  return (
    <StatusTag
      tone={taxMatterProcessStatusTone[status]}
      value={getTaxMatterProcessStatusLabel(status)}
    />
  );
}

function matchesFilters(record: FinanceTaxMatterRecord, filters: FinanceTaxMatterFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (filters.period !== '全部' && record.period !== filters.period) {
    return false;
  }

  if (filters.matterType !== '全部' && record.matterType !== filters.matterType) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [record.matterNo, record.title, record.matterType, record.period, record.owner, record.participantSummary, getSourceSearchText(record)]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function matchesScope(record: FinanceTaxMatterRecord, scope: TaxMatterScope) {
  if (scope === 'pending') {
    return record.processStatus !== '已完成';
  }

  if (scope === 'completed') {
    return record.processStatus === '已完成';
  }

  return true;
}

export function FinanceTaxFilingsPage() {
  const {
    accountingPeriodLocks,
    accountingVoucherRows,
    commitTaxMatterDeclarationResult,
    commitTaxMatterOffset,
    commitTaxMatterPayment,
    commitTaxMatterRefund,
    declarationPreparationRows,
    financeRows,
    getAccountingPeriodGuard,
    invoiceBusinessAllocationRows,
    invoiceRows,
    manualStampDutySourceRows,
    receivablePayableRows,
    stampDutySourceResolutionRows,
    taxMatterRows,
    updateTaxMatterRecord
  } = useFinanceManagement();
  const { contractRows, customerRows } = useCustomerManagementState();
  const { peopleRows } = usePeopleOrganizationState();
  const { salaryPaymentRecords } = useSalaryManagementState();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const { publicAccounts } = usePublicAccountConfigState();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [activeScope, setActiveScope] = useState<TaxMatterScope>('pending');
  const [editorState, setEditorState] = useState<TaxMatterEditorState>();
  const [filters, setFilters] = useState<FinanceTaxMatterFilters>(defaultFilters);
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

  const allDisplayTaxMatterRows = useMemo(
    () =>
      applyDeclarationPreparationsToTaxMatters(
        taxMatterRows,
        displayDeclarationPreparationRows
      ),
    [displayDeclarationPreparationRows, taxMatterRows]
  );
  const displayTaxMatterRows = useMemo(
    () => allDisplayTaxMatterRows.filter((record) =>
      allowedTaxMatterTypes.has(record.matterType)
      && (record.dataStatus === '已确认' || record.processStatus === '已完成')
    ),
    [allDisplayTaxMatterRows]
  );
  const defaultPaymentAccountRef = useMemo(
    () => getDefaultPublicAccountRef(publicAccounts, '付款'),
    [publicAccounts]
  );
  const defaultReceiptAccountRef = useMemo(
    () => getDefaultPublicAccountRef(publicAccounts, '收款'),
    [publicAccounts]
  );

  const filteredRecords = useMemo(
    () => displayTaxMatterRows.filter((record) => matchesFilters(record, filters)),
    [displayTaxMatterRows, filters]
  );
  const visibleRecords = useMemo(
    () => filteredRecords.filter((record) => matchesScope(record, activeScope)),
    [activeScope, filteredRecords]
  );
  const activeRecord = useMemo(
    () => displayTaxMatterRows.find((record) => record.id === activeRecordId),
    [activeRecordId, displayTaxMatterRows]
  );
  const activeEditorRecord = useMemo(
    () => editorState
      ? displayTaxMatterRows.find((record) => record.id === editorState.recordId)
      : undefined,
    [displayTaxMatterRows, editorState]
  );
  const offsetCandidates = useMemo(
    () => activeEditorRecord
      ? displayTaxMatterRows.filter((record) =>
          record.id !== activeEditorRecord.id
          && record.matterType === activeEditorRecord.matterType
          && getTaxMatterOutstandingAmount(record) > 0
          && ['申报成功', '零申报'].includes(record.declarationStatus)
        )
      : [],
    [activeEditorRecord, displayTaxMatterRows]
  );
  const activeOffsetTargetRecord = activeEditorRecord?.offsetTargetMatterId
    ? displayTaxMatterRows.find((record) => record.id === activeEditorRecord.offsetTargetMatterId)
    : undefined;

  const activeOfficialEntry = activeRecord ? taxMatterOfficialHandlingEntries[activeRecord.matterType] : undefined;
  const activeDeclarationPreparation = activeRecord
    ? findDeclarationPreparationForTaxMatter(activeRecord, displayDeclarationPreparationRows)
    : undefined;
  const activeDeclarationDetailPreparation = useMemo(
    () => activeDeclarationPreparation
      ? getTaxMatterDeclarationPreparationSnapshot(activeDeclarationPreparation, {
          usePendingIitCorrection: Boolean(
            activeRecord?.matterType === '个人所得税'
            && activeRecord.declarationStatus === '待申报'
            && activeRecord.declarationVersion > 1
          )
        })
      : undefined,
    [activeDeclarationPreparation, activeRecord]
  );
  const activeVatUnbilledIncomeRows = useMemo(() => {
    if (activeDeclarationDetailPreparation?.taxType !== '增值税及附加') {
      return [];
    }

    const declarationByBusinessRecordId = new Map(
      (activeDeclarationDetailPreparation.unbilledIncomeDeclarations ?? []).map((declaration) => [
        declaration.businessRecordId,
        declaration
      ])
    );

    return getDeclarationPreparationUnbilledIncomeCandidates(
      activeDeclarationDetailPreparation,
      invoiceRows,
      receivablePayableRows,
      invoiceBusinessAllocationRows,
      displayDeclarationPreparationRows
    )
      .filter((candidate) => declarationByBusinessRecordId.has(candidate.businessRecord.id))
      .map((candidate) => ({
        ...candidate,
        netAmount:
          declarationByBusinessRecordId.get(candidate.businessRecord.id)?.netAmount ?? candidate.netAmount,
        taxBasisResolved: true
      }));
  }, [
    activeDeclarationDetailPreparation,
    displayDeclarationPreparationRows,
    invoiceBusinessAllocationRows,
    invoiceRows,
    receivablePayableRows
  ]);
  const canOpenOfficialPlatform =
    Boolean(activeRecord && activeOfficialEntry) &&
    activeRecord?.processStatus !== '数据待确认';
  const canRecordDeclarationResult = Boolean(activeRecord)
    && activeRecord?.processStatus === '待申报';
  const canMaintainDeclarationEvidence = Boolean(
    activeRecord
    && ['申报成功', '零申报'].includes(activeRecord.declarationStatus)
    && getTaxMatterEvidenceStatus(activeRecord) !== '已齐全'
  );
  const canRecordPaymentResult = Boolean(activeRecord)
    && (activeRecord?.processStatus === '待缴款' || activeRecord?.processStatus === '部分缴纳');
  const canSubmitRefundApplication = Boolean(activeRecord)
    && activeRecord?.processStatus === '待退抵处理';
  const canRecordRefundResult = Boolean(activeRecord)
    && (activeRecord?.processStatus === '退抵处理中' || activeRecord?.processStatus === '部分退抵');
  const canAdjustDeclaration = Boolean(
    activeRecord
    && !getTaxMatterDeclarationRevisionValidationError(activeRecord, '更正', displayTaxMatterRows)
  );
  const canVoidDeclaration = Boolean(
    activeRecord
    && !getTaxMatterDeclarationRevisionValidationError(activeRecord, '作废', displayTaxMatterRows, accountingVoucherRows)
  );
  const periodOptions: Array<FilterOptionValue | string> = ['全部', ...uniqueOptions(displayTaxMatterRows, (record) => record.period)];
  const matterTypeOptions: Array<FilterOptionValue | FinanceTaxMatterType> = ['全部', ...uniqueOptions(displayTaxMatterRows, (record) => record.matterType)];
  const currentRows = displayTaxMatterRows.filter((record) => record.period === currentPeriod || record.period === currentQuarter);
  const pendingRows = displayTaxMatterRows.filter((record) => record.processStatus !== '已完成');
  const pendingDeclarationRows = displayTaxMatterRows.filter((record) => record.processStatus === '待申报');
  const pendingPaymentRows = displayTaxMatterRows.filter((record) =>
    record.processStatus === '待缴款'
    || record.processStatus === '部分缴纳'
    || record.processStatus === '待退抵处理'
    || record.processStatus === '退抵处理中'
    || record.processStatus === '部分退抵'
  );
  const pendingReceiptRows = displayTaxMatterRows.filter((record) =>
    ['申报成功', '零申报'].includes(record.declarationStatus)
      && getTaxMatterEvidenceStatus(record) !== '已齐全'
  );
  const completedRows = displayTaxMatterRows.filter((record) => record.processStatus === '已完成');

  function closeEditor() {
    setEditorState(undefined);
  }

  function saveDeclarationResult(
    record: FinanceTaxMatterRecord,
    input: TaxMatterDeclarationResultInput
  ) {
    const validationError = getTaxMatterDeclarationResultValidationError(record, input);

    if (validationError) {
      void messageApi.warning(validationError);
      return;
    }

    const nextRecord = recordTaxMatterDeclarationResult(record, input);

    if (!commitTaxMatterDeclarationResult(record.id, nextRecord)) {
      void messageApi.warning('当前申报结果不可保存');
      return;
    }

    setActiveRecordId(record.id);
    setActiveScope(nextRecord.processStatus === '已完成' ? 'completed' : 'pending');
    closeEditor();
    void messageApi.success(nextRecord.processStatus === '待缴款' ? '申报结果已登记，待缴款' : '申报结果已登记');
  }

  function saveDeclarationEvidence(record: FinanceTaxMatterRecord, input: TaxMatterDeclarationEvidenceInput) {
    const nextRecord = supplementTaxMatterDeclarationEvidence(record, input);

    if (!updateTaxMatterRecord(record.id, () => nextRecord)) {
      void messageApi.warning('申报材料不可保存');
      return;
    }

    setActiveRecordId(record.id);
    setActiveScope(nextRecord.processStatus === '已完成' ? 'completed' : 'pending');
    closeEditor();
    void messageApi.success('申报材料已保存');
  }

  function savePaymentResult(record: FinanceTaxMatterRecord, input: TaxMatterPaymentResultInput) {
    const outstandingAmount = getTaxMatterOutstandingAmount(record);

    if (input.amount <= 0 || input.amount - outstandingAmount > 0.01) {
      void messageApi.warning('缴款金额不能超过待缴金额');
      return;
    }

    const nextRecordBeforeTransaction = recordTaxMatterPaymentResult(record, input);
    const paymentTransaction = buildTaxMatterPaymentTransaction({
      financePrimaryCategories,
      financeRows,
      financeSecondaryCategories,
      paymentAmount: input.amount,
      paymentDate: input.paymentDate,
      paymentReceiptFile: input.receiptFile,
      publicAccountRef: defaultPaymentAccountRef,
      record: nextRecordBeforeTransaction
    });

    if (!paymentTransaction) {
      void messageApi.warning('缴款流水信息不完整');
      return;
    }

    const periodGuard = getAccountingPeriodGuard(paymentTransaction.accountingPeriod, '生成税费缴款流水');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason ?? '当前会计期间已锁定，不能生成缴款流水');
      return;
    }

    const nextRecord = attachTaxMatterPaymentTransaction(nextRecordBeforeTransaction, paymentTransaction);

    if (!commitTaxMatterPayment(record.id, nextRecord, paymentTransaction)) {
      void messageApi.warning('缴款事项或流水状态已变化，请刷新后重试');
      return;
    }

    setActiveRecordId(record.id);
    setActiveScope(nextRecord.processStatus === '已完成' ? 'completed' : 'pending');
    closeEditor();
    void messageApi.success(nextRecord.processStatus === '部分缴纳' ? '已登记部分缴款' : '缴款结果已登记');
  }

  function saveRefundResult(record: FinanceTaxMatterRecord, input: TaxMatterRefundResultInput) {
    const outstandingAmount = getTaxMatterRefundOutstandingAmount(record);

    if (input.amount <= 0 || input.amount - outstandingAmount > 0.01) {
      void messageApi.warning('退税金额不能超过待退金额');
      return;
    }

    const nextRecordBeforeTransaction = recordTaxMatterRefundResult(record, input);
    const refundTransaction = buildTaxMatterRefundTransaction({
      financePrimaryCategories,
      financeRows,
      financeSecondaryCategories,
      publicAccountRef: defaultReceiptAccountRef,
      record: nextRecordBeforeTransaction,
      refundAmount: input.amount,
      refundDate: input.refundDate,
      refundReceiptFile: input.receiptFile
    });

    if (!refundTransaction) {
      void messageApi.warning('退税到账信息或默认收款账户不完整');
      return;
    }

    const periodGuard = getAccountingPeriodGuard(refundTransaction.accountingPeriod, '生成退税到账流水');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason ?? '当前会计期间已锁定，不能生成退税流水');
      return;
    }

    const nextRecord = attachTaxMatterRefundTransaction(nextRecordBeforeTransaction, refundTransaction);

    if (!commitTaxMatterRefund(record.id, nextRecord, refundTransaction)) {
      void messageApi.warning('退税事项或流水状态已变化，请刷新后重试');
      return;
    }

    setActiveRecordId(record.id);
    setActiveScope(nextRecord.processStatus === '已完成' ? 'completed' : 'pending');
    closeEditor();
    void messageApi.success(
      nextRecord.processStatus === '部分退抵'
        ? '已登记部分退税，并生成待复核收入流水'
        : '退税到账已登记，并生成待复核收入流水'
    );
  }

  function saveRefundApplication(record: FinanceTaxMatterRecord, input: TaxMatterRefundApplicationInput) {
    const nextRecord = recordTaxMatterRefundApplication(record, input);

    if (nextRecord === record || !updateTaxMatterRecord(record.id, () => nextRecord)) {
      void messageApi.warning('退税申请信息不完整或事项状态已变化');
      return;
    }

    setActiveRecordId(record.id);
    setActiveScope('pending');
    closeEditor();
    void messageApi.success(input.method === '抵缴'
      ? '抵缴申请已登记，待税务机关确认抵缴结果'
      : '退税申请已登记，待税务机关处理及退税到账');
  }

  function saveOffsetResult(
    record: FinanceTaxMatterRecord,
    targetRecord: FinanceTaxMatterRecord,
    input: TaxMatterOffsetResultInput
  ) {
    const result = recordTaxMatterOffsetResult(record, targetRecord, input);

    if (!result || !commitTaxMatterOffset(record.id, targetRecord.id, result.sourceRecord, result.targetRecord)) {
      void messageApi.warning('抵缴信息不完整或关联事项状态已变化');
      return;
    }

    setActiveRecordId(record.id);
    setActiveScope(result.sourceRecord.processStatus === '已完成' ? 'completed' : 'pending');
    closeEditor();
    void messageApi.success(result.sourceRecord.processStatus === '部分退抵'
      ? '已登记部分抵缴'
      : '抵缴结果已登记');
  }

  function saveDeclarationRevision(record: FinanceTaxMatterRecord, action: '更正' | '作废', reason: string) {
    const validationError = getTaxMatterDeclarationRevisionValidationError(
      record,
      action,
      displayTaxMatterRows,
      accountingVoucherRows
    );

    if (validationError) {
      void messageApi.warning(validationError);
      return;
    }

    const nextRecord = startTaxMatterDeclarationRevision(record, action, reason);

    if (!updateTaxMatterRecord(record.id, () => nextRecord)) {
      void messageApi.warning('当前申报不可调整');
      return;
    }

    const downstreamIitRecords = action === '更正' && record.matterType === '个人所得税'
      ? displayTaxMatterRows.filter((candidate) =>
          candidate.matterType === '个人所得税'
          && candidate.period > record.period
          && candidate.declarationStatus !== '待申报'
          && candidate.declarationStatus !== '已作废'
        )
      : [];

    downstreamIitRecords.forEach((candidate) => {
      updateTaxMatterRecord(candidate.id, () => startTaxMatterDeclarationRevision(
        candidate,
        '更正',
        `${record.period} 累计预扣数据更正，需重新计算本期申报结果`
      ));
    });

    setActiveScope('pending');
    closeEditor();
    void messageApi.success(
      action === '更正'
        ? downstreamIitRecords.length > 0
          ? `已发起更正，后续 ${downstreamIitRecords.length} 个个税期间已同步转为待更正`
          : '已发起更正，待重新登记申报结果'
        : '申报已作废，待重新申报'
    );
  }

  function openOfficialHandling(record: FinanceTaxMatterRecord) {
    const officialEntry = taxMatterOfficialHandlingEntries[record.matterType];

    const nextRecord: FinanceTaxMatterRecord = {
      ...record,
      updatedAt: financeToday,
      operationRecords: [
        {
          action: '打开办理平台',
          actor: '李明',
          id: `tax-op-entry-${Date.now()}`,
          object: record.matterNo,
          summary: officialEntry.platform,
          time: `${financeToday} 14:30`
        },
        ...record.operationRecords
      ]
    };

    if (!updateTaxMatterRecord(record.id, () => nextRecord)) {
      void messageApi.warning('当前事项不可进入办理');
      return;
    }

    window.open(officialEntry.url, '_blank', 'noopener,noreferrer');
    setActiveRecordId(record.id);
    void messageApi.success('已打开办理平台');
  }

  const columns: TableColumnsType<FinanceTaxMatterRecord> = [
    {
      dataIndex: 'title',
      fixed: 'left',
      render: (_title: string, record) => <CompactCell primary={record.title} secondary={record.matterType} />,
      title: '事项',
      width: 188
    },
    {
      dataIndex: 'period',
      render: (_period: string, record) => <CompactCell primary={record.period} secondary={record.periodType} />,
      title: '所属期间',
      width: 98
    },
    {
      key: 'amountSummary',
      render: (_, record) => (
        <CompactCell
          primary={record.processStatus === '数据待确认'
            ? '待确认'
            : record.declarationStatus === '待申报'
              ? formatMoney(record.preparedPayableAmount)
              : getTaxMatterSettlementDirection(record) === '应退'
                ? formatMoney(record.refundableAmount ?? 0)
                : formatMoney(record.payableAmount)}
          secondary={
            record.processStatus === '数据待确认'
              ? undefined
              : record.declarationStatus === '待申报'
                ? '系统测算'
                : getTaxMatterSettlementDirection(record) === '应退'
                  ? `应退 · 本版已退 ${formatMoney(getTaxMatterCurrentVersionRefundedAmount(record))}`
                  : getTaxMatterSettlementDirection(record) === '无需补退'
                    ? '无需补退'
                    : `应缴 · 本版已缴 ${formatMoney(getTaxMatterCurrentVersionPaidAmount(record))}`
          }
        />
      ),
      title: '办理金额',
      width: 158
    },
    {
      dataIndex: 'processStatus',
      render: (status: FinanceTaxMatterProcessStatus) => renderTaxMatterProcessStatus(status),
      title: '处理进度',
      width: 112
    },
    {
      key: 'deadline',
      render: (_, record) => (
        <CompactCell
          primary={record.declarationDueDate}
          secondary={getTaxMatterSettlementDirection(record) === '应缴'
            ? `缴款 ${record.paymentDueDate}`
            : '申报截止'}
        />
      ),
      title: '办理期限',
      width: 132
    }
  ];

  const renderTaxMatterTable = () => (
    <ManagementTable<FinanceTaxMatterRecord>
      columns={columns}
      count={{ value: visibleRecords.length, unit: '条税务办理事项' }}
      dataSource={visibleRecords}
      rowKey="id"
      rowTestIdPrefix="finance-tax-table-row"
      tableTestId="finance-tax-table"
      onRowClick={(record) => setActiveRecordId(record.id)}
    />
  );

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="所属期间">
              <Select
                data-testid="finance-tax-period-filter"
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.period}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="事项类型" controlWidth="wide-select">
              <Select
                data-testid="finance-tax-type-filter"
                options={matterTypeOptions.map((matterType) => ({ label: matterType, value: matterType }))}
                value={filters.matterType}
                onChange={(matterType) => setFilters((current) => ({ ...current, matterType }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-tax-keyword-input"
              placeholder="事项 / 编号 / 来源"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<CalendarOutlined />} label="当前事项" value={`${currentRows.length} 条`} />
          <MetricCard
            icon={<AuditOutlined />}
            label="材料待核对"
            value={`${pendingReceiptRows.length} 条`}
          />
          <MetricCard
            icon={<FileProtectOutlined />}
            label="待申报"
            value={`${pendingDeclarationRows.length} 条`}
          />
          <MetricCard
            icon={<WalletOutlined />}
            label="待资金处理"
            value={`${pendingPaymentRows.length} 条`}
          />
        </MetricGrid>
      }
      pageId="tax-handling"
    >
      {contextHolder}
      <ManagementTableTabs
        activeKey={activeScope}
        items={[
          { key: 'pending', label: `待处理 ${pendingRows.length}` },
          { key: 'completed', label: `已完成 ${completedRows.length}` },
          { key: 'all', label: `全部事项 ${filteredRecords.length}` }
        ]}
        tabTestIdPrefix="finance-tax-page-tab"
        testId="finance-tax-page-tabs"
        onChange={(key) => setActiveScope(key as TaxMatterScope)}
      />
      {renderTaxMatterTable()}

      <FinanceTaxMatterDetailDrawer
        canAdjustDeclaration={canAdjustDeclaration}
        canOpenOfficialPlatform={canOpenOfficialPlatform}
        canRecordDeclarationResult={canRecordDeclarationResult}
        canRecordPaymentResult={canRecordPaymentResult}
        canRecordRefundResult={canRecordRefundResult}
        canSubmitRefundApplication={canSubmitRefundApplication}
        canMaintainDeclarationEvidence={canMaintainDeclarationEvidence}
        declarationDetailPreparation={activeDeclarationDetailPreparation}
        declarationPreparation={activeDeclarationPreparation}
        record={activeRecord}
        taxFilingVouchers={accountingVoucherRows.filter((voucher) => (
          voucher.sourceNo === activeRecord?.matterNo && Boolean(voucher.taxFilingContext)
        ))}
        vatUnbilledIncomeRows={activeVatUnbilledIncomeRows}
        onClose={() => setActiveRecordId(undefined)}
        onOpenAction={(mode) => activeRecord && setEditorState({ mode, recordId: activeRecord.id })}
        onOpenOfficialPlatform={() => activeRecord && openOfficialHandling(activeRecord)}
        onStampDutySourceClick={setActiveStampDutySource}
      />

      <StampDutySourceDetailDrawer
        editable={false}
        record={activeStampDutySource}
        onClose={() => setActiveStampDutySource(undefined)}
        onSave={() => undefined}
      />

      <TaxDeclarationResultDrawer
        record={editorState?.mode === 'declaration-result' ? activeEditorRecord : undefined}
        onClose={closeEditor}
        onSave={saveDeclarationResult}
      />
      <TaxDeclarationEvidenceDrawer
        record={editorState?.mode === 'declaration-evidence' ? activeEditorRecord : undefined}
        onClose={closeEditor}
        onSave={saveDeclarationEvidence}
      />
      <TaxPaymentResultDrawer
        defaultAccountName={defaultPaymentAccountRef?.publicAccountSnapshot.displayName ?? '未配置默认付款账户'}
        record={editorState?.mode === 'payment-result' ? activeEditorRecord : undefined}
        onClose={closeEditor}
        onSave={savePaymentResult}
      />
      <TaxRefundResultDrawer
        defaultAccountName={defaultReceiptAccountRef?.publicAccountSnapshot.displayName ?? '未配置默认收款账户'}
        record={editorState?.mode === 'refund-result' ? activeEditorRecord : undefined}
        onClose={closeEditor}
        onSave={saveRefundResult}
      />
      <TaxRefundApplicationDrawer
        offsetCandidates={offsetCandidates}
        record={editorState?.mode === 'refund-application' ? activeEditorRecord : undefined}
        onClose={closeEditor}
        onSave={saveRefundApplication}
      />
      <TaxOffsetResultDrawer
        record={editorState?.mode === 'offset-result' ? activeEditorRecord : undefined}
        targetRecord={editorState?.mode === 'offset-result' ? activeOffsetTargetRecord : undefined}
        onClose={closeEditor}
        onSave={saveOffsetResult}
      />
      <TaxDeclarationRevisionDrawer
        canVoid={canVoidDeclaration}
        record={editorState?.mode === 'revision' ? activeEditorRecord : undefined}
        onClose={closeEditor}
        onSave={saveDeclarationRevision}
      />
    </ManagementPageScaffold>
  );
}
