import { BankOutlined, CalendarOutlined, WalletOutlined, WarningOutlined } from '@ant-design/icons';
import { message, Select } from 'antd';
import { useMemo, useState } from 'react';
import { DateScopeFilter } from '../../components/DateFilterFields';
import { useDrawerFormState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { ManagementTableTabs } from '../../components/ManagementTableTabs';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  buildPublicAccountOptions,
  getDefaultPublicAccountRef,
  resolveActivePublicAccountRef,
  usePublicAccountConfigState
} from '../system/PublicAccountConfigState';
import type { FinanceTransactionRecord } from './financeData';
import { useFinanceManagement } from './FinanceManagementState';
import {
  buildFinanceReceivablePayableColumns
} from './FinanceReceivablesPayablesColumns';
import { FinanceReceivablesPayablesDetailDrawer } from './FinanceReceivablesPayablesDetailDrawer';
import { FinanceReceivablesPayablesFormDrawer } from './FinanceReceivablesPayablesFormDrawer';
import type { FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import type { FinanceInvoiceRecord } from './financeInvoiceData';
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
  linkFinanceReceivablePayableSettlementTransaction,
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
  record: FinanceReceivablePayableRecord
) {
  const expectedDirection = record.direction === '应收' ? '销项' : '进项';

  return (
    invoice.direction === expectedDirection &&
    invoice.counterparty === record.counterparty &&
    invoice.matchedBusinessRefs.some((ref) =>
      ref.recordId === record.id ||
      ref.recordNo === record.documentNo ||
      ref.sourceNo === record.sourceNo
    )
  );
}

export function FinanceReceivablesPayablesPage() {
  const {
    addFinanceTransaction,
    financeRows,
    getAccountingPeriodGuard,
    invoiceRows,
    receivablePayableRows,
    updateReceivablePayableRecord
  } = useFinanceManagement();
  const { publicAccounts } = usePublicAccountConfigState();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeRecordId, setActiveRecordId] = useState<string>();
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
  const linkedTransactionRows = useMemo(
    () => activeRecord
      ? getFinanceReceivablePayableLinkedTransactionRows(activeRecord, financeRows)
      : [],
    [activeRecord, financeRows]
  );
  const linkedInvoiceRows = useMemo(
    () => activeRecord
      ? invoiceRows.filter((invoice) => isInvoiceLinkedToReceivablePayable(invoice, activeRecord))
      : [],
    [activeRecord, invoiceRows]
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
  const activeRecordEditable = activeRecord
    ? canEditFinanceReceivablePayableRecord(activeRecord, linkedTransactionRows) && !activeRecordLockedReason
    : false;
  const activeRecordCanRegisterSettlement = activeRecord
    ? canRegisterFinanceReceivablePayableSettlement(activeRecord, linkedTransactionRows) && !activeRecordLockedReason
    : false;
  const settlementFormValid =
    Boolean(activeRecord) &&
    activeRecordCanRegisterSettlement &&
    isFinanceReceivablePayableSettlementFormValid(settlementForm, registerableAmount);

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
    setSettlementForm({
      ...initialSettlementForm,
      amount: getFinanceReceivablePayableRegisterableAmount(record, recordLinkedTransactionRows)
    });
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

    if (!canEditFinanceReceivablePayableRecord(record, recordLinkedTransactionRows)) {
      void messageApi.warning('已有收付进度，不能直接调整原事项');
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

    const nextRecord = updateFinanceReceivablePayableRecordFromForm(formDrawer.record, formDrawer.form);
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
    void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
  }

  function handleDownloadFile(file: RelatedFileRecord) {
    void messageApi.success(`${file.name} 下载请求已记录`);
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

    if (!addFinanceTransaction(nextTransaction)) {
      void messageApi.warning(transactionPeriodGuard.reason ?? '当前会计期间已锁定，不能登记流水');
      return;
    }

    if (
      !updateReceivablePayableRecord(activeRecord.id, (record) =>
        linkFinanceReceivablePayableSettlementTransaction(record, nextTransaction)
      )
    ) {
      void messageApi.warning('流水已登记，但事项进度未完成关联，请重新打开事项核对');
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
        registerableAmount={registerableAmount}
        record={activeRecord}
        recordEditable={activeRecordEditable}
        recordLockedReason={activeRecordLockedReason}
        settlementForm={settlementForm}
        settlementSubmitDisabled={!settlementFormValid}
        onDownloadFile={handleDownloadFile}
        onEdit={handleOpenEditDrawer}
        onPreviewFile={handlePreviewFile}
        onRemoveSettlementFile={handleSettlementFileRemove}
        onSelectSettlementFile={handleSettlementFileSelect}
        onSubmitSettlement={handleRegisterSettlement}
        onUpdateSettlementForm={updateSettlementForm}
        onClose={() => setActiveRecordId(undefined)}
      />

      <FinanceReceivablesPayablesFormDrawer
        form={formDrawer.form}
        open={formDrawer.open}
        record={formDrawer.record}
        saveDisabled={!formValid}
        onCancel={formDrawer.cancel}
        onSave={handleSaveForm}
        onUpdate={formDrawer.updateForm}
      />
    </ManagementPageScaffold>
  );
}
