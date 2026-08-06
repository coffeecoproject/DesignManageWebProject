import { BankOutlined, CalendarOutlined, WalletOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, message, Select } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateScopeFilter } from '../../components/DateFilterFields';
import { useDrawerFormState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { ManagementTableTabs } from '../../components/ManagementTableTabs';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  buildPublicAccountOptions,
  getDefaultPublicAccountRef,
  resolveActivePublicAccountRef,
  usePublicAccountConfigState
} from '../system/PublicAccountConfigState';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import type { FinanceTransactionRecord } from './financeData';
import { useFinanceManagement } from './FinanceManagementState';
import type { CustomerTaskSettlementMergeIssue } from './financeCustomerTaskSettlementModel';
import {
  buildFinanceReceivablePayableColumns
} from './FinanceReceivablesPayablesColumns';
import { FinanceReceivablesPayablesDetailDrawer } from './FinanceReceivablesPayablesDetailDrawer';
import { FinanceReceivablesPayablesFormDrawer } from './FinanceReceivablesPayablesFormDrawer';
import { FinanceInvoiceAssociationDrawer } from './FinanceInvoiceAssociationDrawer';
import type { FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import type { FinanceInvoiceBusinessAllocation, FinanceInvoiceRecord } from './financeInvoiceData';
import type {
  FinanceReceivablePayableRecord,
  FinanceReceivablePayableReviewProgressStatus,
  FinanceReceivablePayableSettlementStatus
} from './financeReceivablesPayablesData';
import {
  buildFinanceReceivablePayableSettlementTransaction,
  buildFinanceReceivablePayableFilterOptions,
  buildFinanceReceivablePayableMetrics,
  canEditFinanceReceivablePayableRecord,
  canRegisterFinanceReceivablePayableSettlement,
  hasFinanceReceivablePayableBookedVoucher,
  createFinanceReceivablePayableForm,
  createFinanceReceivablePayableSettlementForm,
  defaultFinanceReceivablePayableFilters,
  financeReceivablePayableListTabs,
  financeReceivablePayableCurrentPeriod,
  getFinanceReceivablePayableDueDate,
  getFinanceReceivablePayableLinkedTransactionRows,
  getFinanceReceivablePayableListTabKey,
  getFinanceReceivablePayableRegisterableAmount,
  getFinanceReceivablePayableReviewProgressStatus,
  isFinanceReceivablePayableSettlementStatusFilterAllowedInTab,
  isFinanceReceivablePayableSettlementFormValid,
  isFinanceReceivablePayableFormValid,
  isFinanceReceivablePayableOverdue,
  matchesFinanceReceivablePayableFilters,
  matchesFinanceReceivablePayableListTab,
  updateFinanceReceivablePayableRecordFromForm,
  type FinanceReceivablePayableFormValue,
  type FinanceReceivablePayableFilters,
  type FinanceReceivablePayableListTabKey,
  type FinanceReceivablePayableSettlementFormValue,
} from './financeReceivablesPayablesModel';
import { formatMoney } from './financeUtils';

const financeReceivablePayableReviewProgressOrder: Record<FinanceReceivablePayableReviewProgressStatus | '无待复核', number> = {
  待复核: 0,
  部分待复核: 1,
  无待复核: 2
};

const financeReceivablePayableSettlementStatusOrder: Record<FinanceReceivablePayableSettlementStatus, number> = {
  未结清: 0,
  部分结清: 1,
  已结清: 2
};

function sortFinanceReceivablePayableRows(
  rows: FinanceReceivablePayableRecord[],
  financeRows: FinanceTransactionRecord[] = []
) {
  return [...rows].sort((first, second) => {
    const overdueDiff = Number(isFinanceReceivablePayableOverdue(second)) - Number(isFinanceReceivablePayableOverdue(first));

    if (overdueDiff !== 0) {
      return overdueDiff;
    }

    const firstReviewProgress = getFinanceReceivablePayableReviewProgressStatus(first, getFinanceReceivablePayableLinkedTransactionRows(first, financeRows)) ?? '无待复核';
    const secondReviewProgress = getFinanceReceivablePayableReviewProgressStatus(second, getFinanceReceivablePayableLinkedTransactionRows(second, financeRows)) ?? '无待复核';
    const reviewProgressDiff = financeReceivablePayableReviewProgressOrder[firstReviewProgress] - financeReceivablePayableReviewProgressOrder[secondReviewProgress];

    if (reviewProgressDiff !== 0) {
      return reviewProgressDiff;
    }

    const statusDiff =
      financeReceivablePayableSettlementStatusOrder[first.settlementStatus] -
      financeReceivablePayableSettlementStatusOrder[second.settlementStatus];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return getFinanceReceivablePayableDueDate(first).localeCompare(getFinanceReceivablePayableDueDate(second)) ||
      first.documentNo.localeCompare(second.documentNo);
  });
}

function isInvoiceLinkedToReceivablePayable(
  invoice: FinanceInvoiceRecord,
  record: FinanceReceivablePayableRecord,
  allocations: FinanceInvoiceBusinessAllocation[]
) {
  return invoice.invoiceStatus !== '作废' && allocations.some(
    (allocation) => allocation.status === '有效' && allocation.invoiceId === invoice.id &&
      allocation.targetType === '应收应付' && allocation.targetId === record.id
  );
}

export function FinanceReceivablesPayablesPage() {
  const navigate = useNavigate();
  const {
    accountingVoucherLifecycleRows,
    customerTaskSettlementIssues,
    invoiceBusinessAllocationRows,
    financeRows,
    getAccountingPeriodGuard,
    invoiceRows,
    receivablePayableRows,
    registerReceivablePayableSettlement,
    updateReceivablePayableRecord
  } = useFinanceManagement();
  const { publicAccounts } = usePublicAccountConfigState();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [activeTaskSettlementIssueId, setActiveTaskSettlementIssueId] = useState<string>();
  const [invoiceAssociationRecordId, setInvoiceAssociationRecordId] = useState<string>();
  const [previewFile, setPreviewFile] = useState<RelatedFileRecord>();
  const [activeTab, setActiveTab] = useState<FinanceReceivablePayableListTabKey>('open');
  const [filters, setFilters] = useState<FinanceReceivablePayableFilters>(defaultFinanceReceivablePayableFilters);
  const [settlementForm, setSettlementForm] = useState<FinanceReceivablePayableSettlementFormValue>(() =>
    createFinanceReceivablePayableSettlementForm()
  );
  const formDrawer = useDrawerFormState<FinanceReceivablePayableRecord, FinanceReceivablePayableFormValue>({
    createForm: () => createFinanceReceivablePayableForm(),
    editForm: (record) => createFinanceReceivablePayableForm(record)
  });

  const updateFilters = (patch: Partial<FinanceReceivablePayableFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setActiveRecordId(undefined);
  };

  const columns = useMemo(
    () => buildFinanceReceivablePayableColumns(financeRows),
    [financeRows]
  );
  const filteredRecords = useMemo(
    () =>
      sortFinanceReceivablePayableRows(
        receivablePayableRows.filter((record) => {
          return (
            matchesFinanceReceivablePayableListTab(record, activeTab) &&
            matchesFinanceReceivablePayableFilters(record, filters)
          );
        }),
        financeRows
      ),
    [activeTab, filters, financeRows, receivablePayableRows]
  );
  const tabCounts = useMemo(() => {
    const baseFilters: FinanceReceivablePayableFilters = { ...filters, settlementStatus: '全部' };

    return receivablePayableRows.reduce<Record<FinanceReceivablePayableListTabKey, number>>(
      (counts, record) => {
        if (matchesFinanceReceivablePayableFilters(record, baseFilters)) {
          counts[getFinanceReceivablePayableListTabKey(record)] += 1;
        }

        return counts;
      },
      { open: 0, settled: 0 }
    );
  }, [filters, receivablePayableRows]);
  const listTabs = useMemo(
    () =>
      financeReceivablePayableListTabs.map((tab) => ({
        key: tab.key,
        label: `${tab.label} ${tabCounts[tab.key]}`
      })),
    [tabCounts]
  );
  const activeRecord = useMemo(
    () => receivablePayableRows.find((record) => record.id === activeRecordId),
    [activeRecordId, receivablePayableRows]
  );
  const activeTaskSettlementIssue = activeRecord && activeTaskSettlementIssueId
    ? customerTaskSettlementIssues.find(
        (issue) => issue.issueId === activeTaskSettlementIssueId && issue.recordId === activeRecord.id
      )
    : undefined;
  const invoiceAssociationRecord = useMemo(
    () => receivablePayableRows.find((record) => record.id === invoiceAssociationRecordId),
    [invoiceAssociationRecordId, receivablePayableRows]
  );
  const linkedTransactionRows = useMemo(
    () => activeRecord
      ? getFinanceReceivablePayableLinkedTransactionRows(activeRecord, financeRows)
      : [],
    [activeRecord, financeRows]
  );
  const linkedInvoiceRows = useMemo(
    () => activeRecord
      ? invoiceRows.filter((invoice) => isInvoiceLinkedToReceivablePayable(invoice, activeRecord, invoiceBusinessAllocationRows))
      : [],
    [activeRecord, invoiceBusinessAllocationRows, invoiceRows]
  );
  const publicAccountOptions = useMemo(
    () =>
      activeRecord
        ? buildPublicAccountOptions(publicAccounts, activeRecord.direction === '应收' ? '收款' : '付款')
        : [],
    [activeRecord, publicAccounts]
  );

  const metrics = useMemo(
    () => buildFinanceReceivablePayableMetrics(filteredRecords),
    [filteredRecords]
  );
  const filterOptions = useMemo(
    () => buildFinanceReceivablePayableFilterOptions(activeTab),
    [activeTab]
  );
  const formValid = isFinanceReceivablePayableFormValid(formDrawer.form);
  const registerableAmount = activeRecord
    ? getFinanceReceivablePayableRegisterableAmount(activeRecord, linkedTransactionRows)
    : 0;
  const activeRecordPeriodGuard = activeRecord
    ? getAccountingPeriodGuard(activeRecord.accountingPeriod, activeRecord.direction === '应收' ? '处理应收事项' : '处理应付事项')
    : undefined;
  const activeRecordLockedReason = activeRecordPeriodGuard?.allowed === false ? activeRecordPeriodGuard.reason : undefined;
  const activeRecordHasBookedVoucher = activeRecord
    ? hasFinanceReceivablePayableBookedVoucher(activeRecord, accountingVoucherLifecycleRows)
    : false;
  const activeRecordEditable = activeRecord
    ? canEditFinanceReceivablePayableRecord(activeRecord, linkedTransactionRows, activeRecordHasBookedVoucher) && !activeRecordLockedReason
    : false;
  const activeRecordEditBlockedReason = activeRecord?.sourceType === '任务结算'
    ? '任务验收自动生成，原事项只读'
    : activeRecordHasBookedVoucher
    ? '已记账，需通过凭证调整'
    : activeRecordLockedReason
      ? '只读回看'
      : '已有收付进度，事项锁定';
  const activeRecordCanRegisterSettlement = activeRecord
    ? canRegisterFinanceReceivablePayableSettlement(activeRecord, linkedTransactionRows) && !activeRecordLockedReason
    : false;
  const settlementFormValid =
    Boolean(activeRecord) &&
    activeRecordCanRegisterSettlement &&
    isFinanceReceivablePayableSettlementFormValid(settlementForm, registerableAmount, activeRecord);

  function getSettlementAccountUsage(record: FinanceReceivablePayableRecord) {
    return record.direction === '应收' ? '收款' : '付款';
  }

  function getDefaultPublicAccountId(record: FinanceReceivablePayableRecord) {
    const usage = getSettlementAccountUsage(record);
    return getDefaultPublicAccountRef(publicAccounts, usage)?.publicAccountId ?? '';
  }

  function handleOpenDetailDrawer(record: FinanceReceivablePayableRecord) {
    const recordLinkedTransactionRows = getFinanceReceivablePayableLinkedTransactionRows(record, financeRows);
    const initialSettlementForm = createFinanceReceivablePayableSettlementForm(record, getDefaultPublicAccountId(record));

    setActiveRecordId(record.id);
    setActiveTaskSettlementIssueId(undefined);
    setSettlementForm({
      ...initialSettlementForm,
      amount: getFinanceReceivablePayableRegisterableAmount(record, recordLinkedTransactionRows)
    });
  }

  function handleOpenTaskSettlementIssue(issue: CustomerTaskSettlementMergeIssue) {
    const record = issue.recordId
      ? receivablePayableRows.find((candidate) => candidate.id === issue.recordId)
      : undefined;

    if (record) {
      handleOpenDetailDrawer(record);
      setActiveTaskSettlementIssueId(issue.issueId);
    }
  }

  function handleOpenLinkedTransaction(record: FinanceTransactionRecord) {
    const pathname = record.status === '待复核' ? '/finance/review' : '/finance/transactions';
    navigate(`${pathname}?transactionNo=${encodeURIComponent(record.transactionNo)}`);
  }

  function handleOpenAccountingVoucher(
    record: FinanceReceivablePayableRecord,
    issue?: CustomerTaskSettlementMergeIssue
  ) {
    const correctionQuery = issue
      ? `&correctionIssueId=${encodeURIComponent(issue.issueId)}&correctionBatchId=${encodeURIComponent(issue.batchId)}&correctionRecordId=${encodeURIComponent(record.id)}&differenceAmount=${encodeURIComponent(String(issue.differenceAmount))}`
      : '';

    navigate(
      `/finance/accounting-vouchers?sourceNo=${encodeURIComponent(record.documentNo)}&period=${encodeURIComponent(record.accountingPeriod)}${correctionQuery}`
    );
  }

  function handleOpenInvoiceCorrection(invoice: FinanceInvoiceRecord) {
    navigate(`/finance/invoices?invoiceNo=${encodeURIComponent(invoice.invoiceNo)}`);
  }

  function handleAssociateInvoice(record: FinanceReceivablePayableRecord) {
    setActiveRecordId(undefined);
    setInvoiceAssociationRecordId(record.id);
  }

  function handleTabChange(nextTab: string) {
    const nextTabKey = nextTab as FinanceReceivablePayableListTabKey;

    setActiveTab(nextTabKey);
    setActiveRecordId(undefined);
    setFilters((current) =>
      isFinanceReceivablePayableSettlementStatusFilterAllowedInTab(nextTabKey, current.settlementStatus)
        ? current
        : { ...current, settlementStatus: '全部' }
    );
  }

  function handleOpenEditDrawer(record: FinanceReceivablePayableRecord) {
    const recordLinkedTransactionRows = getFinanceReceivablePayableLinkedTransactionRows(record, financeRows);
    const periodGuard = getAccountingPeriodGuard(record.accountingPeriod, '调整应收应付事项');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    const hasBookedVoucher = hasFinanceReceivablePayableBookedVoucher(record, accountingVoucherLifecycleRows);

    if (!canEditFinanceReceivablePayableRecord(record, recordLinkedTransactionRows, hasBookedVoucher)) {
      void messageApi.warning(
        hasBookedVoucher
          ? '原事项已生成记账凭证，不能直接调整，请通过会计凭证处理冲销或调整'
          : '已有收付进度，不能直接调整原事项'
      );
      return;
    }

    setActiveRecordId(undefined);
    formDrawer.openEdit(record);
  }

  function handleSaveForm() {
    if (!formDrawer.record || !formValid) {
      return;
    }

    const periodGuard = getAccountingPeriodGuard(formDrawer.record.accountingPeriod, '调整应收应付事项');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    const nextRecord = updateFinanceReceivablePayableRecordFromForm(
      formDrawer.record,
      formDrawer.form,
      financePrimaryCategories,
      financeSecondaryCategories
    );
    const nextPeriodGuard = getAccountingPeriodGuard(nextRecord.accountingPeriod, '调整应收应付事项');

    if (!nextPeriodGuard.allowed) {
      void messageApi.warning(nextPeriodGuard.reason);
      return;
    }

    if (!updateReceivablePayableRecord(nextRecord.id, () => nextRecord)) {
      void messageApi.warning('当前事项不可调整');
      return;
    }

    formDrawer.close();
    void messageApi.success('已保存事项调整');
  }

  function handlePreviewFile(file: RelatedFileRecord) {
    if (!file.url) {
      void messageApi.warning('当前文件缺少可预览地址');
      return;
    }

    setPreviewFile(file);
  }

  function handleDownloadFile(file: RelatedFileRecord) {
    if (!file.url) {
      void messageApi.warning('当前文件缺少可下载地址');
      return;
    }

    window.open(file.url, '_blank', 'noopener,noreferrer');
  }

  function updateSettlementForm<K extends keyof FinanceReceivablePayableSettlementFormValue>(
    field: K,
    value: FinanceReceivablePayableSettlementFormValue[K]
  ) {
    setSettlementForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function buildSettlementVoucherFile(file: FinanceVoucherUploadFile): RelatedFileRecord | undefined {
    const maxFileSize = 10 * 1024 * 1024;

    if (file.size && file.size > maxFileSize) {
      void messageApi.warning(`${file.name} 超过 10MB，无法作为凭证上传`);
      return undefined;
    }

    if (settlementForm.files.some((currentFile) => currentFile.name === file.name)) {
      void messageApi.warning(`${file.name} 已在凭证列表中`);
      return undefined;
    }

    return {
      id: `fin-rp-voucher-${file.uid || Date.now()}`,
      name: file.name,
      status: '已选择',
      type: activeRecord?.direction === '应收' ? '收款凭证' : '付款凭证',
      updatedAt: settlementForm.occurredAt || financeReceivablePayableCurrentPeriod
    };
  }

  function handleSettlementFileSelect(file: FinanceVoucherUploadFile) {
    if (activeRecordLockedReason) {
      void messageApi.warning(activeRecordLockedReason);
      return;
    }

    const nextFile = buildSettlementVoucherFile(file);

    if (!nextFile) {
      return;
    }

    setSettlementForm((current) => ({
      ...current,
      files: [...current.files, nextFile]
    }));
  }

  function handleSettlementFileRemove(file: RelatedFileRecord) {
    if (activeRecordLockedReason) {
      void messageApi.warning(activeRecordLockedReason);
      return;
    }

    setSettlementForm((current) => ({
      ...current,
      files: current.files.filter((currentFile) => currentFile.id !== file.id)
    }));
  }

  function handleRegisterSettlement() {
    if (!activeRecord) {
      return;
    }

    if (activeRecordLockedReason) {
      void messageApi.warning(activeRecordLockedReason);
      return;
    }

    if (!settlementFormValid) {
      void messageApi.warning(`请补充收付款日期、金额、账户和凭证，且金额不超过剩余可登记金额`);
      return;
    }

    const publicAccountRef = resolveActivePublicAccountRef(publicAccounts, settlementForm.publicAccountId, getSettlementAccountUsage(activeRecord));

    if (!publicAccountRef) {
      void messageApi.warning('请选择启用且支持当前收付方向的对公账户');
      return;
    }

    const nextTransaction = buildFinanceReceivablePayableSettlementTransaction(activeRecord, settlementForm, financeRows, publicAccountRef);
    const transactionPeriodGuard = getAccountingPeriodGuard(
      nextTransaction.accountingPeriod,
      activeRecord.direction === '应收' ? '登记收款流水' : '登记付款流水'
    );

    if (!transactionPeriodGuard.allowed) {
      void messageApi.warning(transactionPeriodGuard.reason);
      return;
    }

    const registrationResult = registerReceivablePayableSettlement(activeRecord.id, nextTransaction);

    if (!registrationResult.success) {
      void messageApi.warning(registrationResult.message);
      return;
    }

    setSettlementForm({
      ...createFinanceReceivablePayableSettlementForm(activeRecord, getDefaultPublicAccountId(activeRecord)),
      amount: 0
    });
    void messageApi.success('已登记流水，状态为待复核');
  }

  return (
    <ManagementPageScaffold
      feedback={messageContextHolder}
      layout="table-workbench"
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={financeReceivablePayableCurrentPeriod}
              label="归属月份"
              testIdPrefix="finance-rp-period-filter"
              value={filters.periodTime}
              onChange={(periodTime) => updateFilters({ periodTime })}
            />
            <FilterField label="方向">
              <Select
                data-testid="finance-rp-direction-filter"
                options={filterOptions.directionOptions.map((direction) => ({ label: direction, value: direction }))}
                value={filters.direction}
                onChange={(direction) => updateFilters({ direction })}
              />
            </FilterField>
            {activeTab === 'open' ? (
              <FilterField label="结清状态" controlWidth="status-select">
                <Select
                  data-testid="finance-rp-settlement-status-filter"
                  options={filterOptions.settlementStatusOptions.map((settlementStatus) => ({ label: settlementStatus, value: settlementStatus }))}
                  value={filters.settlementStatus}
                  onChange={(settlementStatus) => updateFilters({ settlementStatus })}
                />
              </FilterField>
            ) : null}
            <KeywordFilter
              data-testid="finance-rp-keyword-input"
              placeholder="对象 / 来源 / 单号"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => updateFilters({ keyword })}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<WalletOutlined />} label="应收未收" value={formatMoney(metrics.receivableOutstanding)} />
          <MetricCard icon={<BankOutlined />} label="应付未付" value={formatMoney(metrics.payableOutstanding)} />
          <MetricCard icon={<CalendarOutlined />} label="确认总额" value={formatMoney(metrics.confirmedAmount)} />
          <MetricCard icon={<WarningOutlined />} label="逾期记录" value={`${metrics.overdueRows.length} 条`} />
        </MetricGrid>
      }
      pageId="finance-receivables-payables"
    >
      {customerTaskSettlementIssues.length > 0 ? (
        <Alert
          data-testid="finance-rp-task-settlement-issue"
          description={(
            <div className="finance-rp-task-settlement-issue-list">
              {customerTaskSettlementIssues.map((issue) => (
                <div className="finance-rp-task-settlement-issue-row" key={issue.issueId}>
                  <span>{issue.message}</span>
                  {issue.recordId ? (
                    <Button size="small" type="link" onClick={() => handleOpenTaskSettlementIssue(issue)}>
                      查看处理
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          message={`任务结算待处理 ${customerTaskSettlementIssues.length} 条`}
          showIcon
          type="warning"
        />
      ) : null}
      <ManagementTableTabs
        activeKey={activeTab}
        items={listTabs}
        tabTestIdPrefix="finance-rp-list-tab"
        testId="finance-rp-list-tabs"
        onChange={handleTabChange}
      />
      <ManagementTable<FinanceReceivablePayableRecord>
        columns={columns}
        count={{ value: filteredRecords.length, unit: '条事项' }}
        dataSource={filteredRecords}
        rowKey="id"
        rowTestIdPrefix="finance-rp-table-row"
        tableTestId="finance-rp-table"
        onRowClick={handleOpenDetailDrawer}
      />

      <FinanceReceivablesPayablesDetailDrawer
        accountOptions={publicAccountOptions}
        linkedInvoiceRows={linkedInvoiceRows}
        linkedTransactionRows={linkedTransactionRows}
        invoiceAssociationLockedReason={activeRecordLockedReason ?? (activeRecordHasBookedVoucher ? '已记账，需通过凭证调整' : undefined)}
        invoiceBusinessAllocationRows={invoiceBusinessAllocationRows}
        recordHasBookedVoucher={activeRecordHasBookedVoucher}
        registerableAmount={registerableAmount}
        record={activeRecord}
        recordEditBlockedReason={activeRecordEditBlockedReason}
        recordEditable={activeRecordEditable}
        recordLockedReason={activeRecordLockedReason}
        settlementForm={settlementForm}
        settlementSubmitDisabled={!settlementFormValid}
        taskSettlementIssue={activeTaskSettlementIssue}
        onDownloadFile={handleDownloadFile}
        onEdit={handleOpenEditDrawer}
        onPreviewFile={handlePreviewFile}
        onRemoveSettlementFile={handleSettlementFileRemove}
        onSelectSettlementFile={handleSettlementFileSelect}
        onSubmitSettlement={handleRegisterSettlement}
        onUpdateSettlementForm={updateSettlementForm}
        onClose={() => {
          setActiveRecordId(undefined);
          setActiveTaskSettlementIssueId(undefined);
        }}
        onAssociateInvoice={handleAssociateInvoice}
        onOpenAccountingVoucher={handleOpenAccountingVoucher}
        onOpenInvoiceCorrection={handleOpenInvoiceCorrection}
        onOpenLinkedTransaction={handleOpenLinkedTransaction}
      />

      <FinanceInvoiceAssociationDrawer
        businessRecord={invoiceAssociationRecord}
        open={Boolean(invoiceAssociationRecord)}
        onClose={() => setInvoiceAssociationRecordId(undefined)}
      />

      <FinanceReceivablesPayablesFormDrawer
        form={formDrawer.form}
        open={formDrawer.open}
        primaryCategories={financePrimaryCategories}
        record={formDrawer.record}
        saveDisabled={!formValid}
        secondaryCategories={financeSecondaryCategories}
        onCancel={formDrawer.cancel}
        onSave={handleSaveForm}
        onUpdate={formDrawer.updateForm}
      />
      <FilePreviewModal
        file={previewFile ? {
          category: previewFile.type,
          name: previewFile.name,
          status: previewFile.status,
          updatedAt: previewFile.updatedAt
        } : undefined}
        title="文件预览"
        onClose={() => setPreviewFile(undefined)}
      />
    </ManagementPageScaffold>
  );
}
