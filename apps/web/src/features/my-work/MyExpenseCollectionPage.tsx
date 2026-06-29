import {
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
  WalletOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { DatePicker, Input, InputNumber, message, Select } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { DateScopeFilter } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag, type StatusTagTone } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useDrawerFormState } from '../../components/DrawerForm';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FileSlot, FileSlotGrid } from '../../components/FileSlot';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { buildPublicAccountOptions, resolveActivePublicAccountRef, usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { useFinanceManagement } from '../finance/FinanceManagementState';
import { financeToday, formatMoney } from '../finance/financeUtils';
import {
  buildMyWorkCollectionReceivableOptions,
  buildFinanceTransactionFromMyWorkCollection,
  buildMyWorkExpenseCollectionMetrics,
  createMyWorkExpenseCollectionForm,
  createMyWorkExpenseCollectionRecordFromForm,
  defaultMyWorkExpenseCollectionFilters,
  getMyWorkExpenseCategoryOptions,
  getMyWorkExpensePrimaryCategoryId,
  getMyWorkExpensePrimaryCategoryName,
  getMyWorkExpensePrimaryCategoryOptions,
  isMyWorkExpenseCollectionDraftSavable,
  isMyWorkExpenseCollectionFormValid,
  linkMyWorkCollectionFinanceTransaction,
  matchesMyWorkExpenseCollectionFilters,
  myWorkCollectionMethodOptions,
  myWorkExpenseCollectionCurrentMonth,
  myWorkExpenseCollectionKindOptions,
  myWorkExpenseCollectionSeedRecords,
  myWorkExpenseCollectionStatusOptions,
  myWorkExpenseOriginalTypeOptions,
  myWorkExpensePaymentMethodOptions,
  resubmitMyWorkExpenseCollectionRecordFromForm,
  type MyWorkExpenseCollectionFilterValue,
  type MyWorkExpenseCollectionFilters,
  type MyWorkExpenseCollectionFormValue,
  type MyWorkExpenseCollectionKind,
  type MyWorkExpenseCollectionRecord,
  type MyWorkExpenseCollectionStatus,
  type MyWorkExpenseOriginalType,
  type MyWorkReceivableOption
} from './myWorkExpenseCollectionModel';

const expenseCollectionKindTone = {
  费用报销: 'red',
  代收登记: 'green'
} as const satisfies Record<MyWorkExpenseCollectionKind, StatusTagTone>;

const expenseCollectionStatusTone = {
  草稿: 'gray',
  待审核: 'amber',
  待复核: 'blue',
  退回修改: 'red',
  已确认: 'green',
  已关闭: 'gray'
} as const satisfies Record<MyWorkExpenseCollectionStatus, StatusTagTone>;

const expenseOriginalTypeTone = {
  电子原件: 'green',
  纸质原件: 'amber',
  无正式票据: 'red'
} as const satisfies Record<MyWorkExpenseOriginalType, StatusTagTone>;

function normalizePickerValue(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

function createAttachmentFromUpload(file: UploadFile, type: string): RelatedFileRecord {
  return {
    id: file.uid || file.name,
    name: file.name,
    status: '已选择',
    type,
    updatedAt: financeToday
  };
}

function upsertAttachment(files: RelatedFileRecord[], file: UploadFile, type: string) {
  const nextFile = createAttachmentFromUpload(file, type);

  return files.some((currentFile) => currentFile.name === nextFile.name)
    ? files.map((currentFile) => (currentFile.name === nextFile.name ? nextFile : currentFile))
    : [...files, nextFile];
}

function getVoucherSummary(record: MyWorkExpenseCollectionRecord) {
  const fileCount = record.files.length + (record.transferFiles?.length ?? 0);

  if (fileCount === 0) {
    return '待补充';
  }

  return `${fileCount} 份`;
}

function getMaterialOrFundStatus(record: MyWorkExpenseCollectionRecord) {
  if (record.kind === '费用报销') {
    return record.paperStatus ?? '无需提交';
  }

  return record.transferFiles?.length ? '转入凭证已上传' : '待补转入凭证';
}

function getRelatedObject(record: MyWorkExpenseCollectionRecord) {
  if (record.kind === '费用报销') {
    return record.relatedTarget || '-';
  }

  return record.customerName || '-';
}

function getExpenseCategoryLabel(record: MyWorkExpenseCollectionRecord) {
  if (record.kind !== '费用报销') {
    return record.category;
  }

  return `${getMyWorkExpensePrimaryCategoryName(getMyWorkExpensePrimaryCategoryId(record.category))} / ${record.category}`;
}

function sortExpenseCollectionRows(rows: MyWorkExpenseCollectionRecord[]) {
  return [...rows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.occurredAt.localeCompare(left.occurredAt));
}

type PublicAccountOption = {
  label: string;
  value: string;
};

function getPublicAccountLabel(publicAccountId: string | undefined, options: PublicAccountOption[]) {
  if (!publicAccountId) {
    return '-';
  }

  return options.find((option) => option.value === publicAccountId)?.label ?? '未配置对公账户';
}

function MyExpenseCollectionFormDrawer({
  customerOptions,
  form,
  isEditMode,
  open,
  receivableOptions,
  record,
  publicAccountOptions,
  draftDisabled,
  saveDisabled,
  onCancel,
  onSaveDraft,
  onSave,
  onUpdate
}: {
  customerOptions: string[];
  form: MyWorkExpenseCollectionFormValue;
  isEditMode: boolean;
  open: boolean;
  receivableOptions: MyWorkReceivableOption[];
  record?: MyWorkExpenseCollectionRecord;
  publicAccountOptions: PublicAccountOption[];
  draftDisabled: boolean;
  saveDisabled: boolean;
  onCancel: () => void;
  onSaveDraft: () => void;
  onSave: () => void;
  onUpdate: <K extends keyof MyWorkExpenseCollectionFormValue>(
    field: K,
    value: MyWorkExpenseCollectionFormValue[K]
  ) => void;
}) {
  const expensePrimaryCategoryOptions = getMyWorkExpensePrimaryCategoryOptions();
  const expenseCategoryOptions = getMyWorkExpenseCategoryOptions();
  const currentExpenseCategoryOptions = getMyWorkExpenseCategoryOptions(form.primaryCategoryId);
  const filteredReceivableOptions = form.customerName
    ? receivableOptions.filter((option) => option.customerName === form.customerName)
    : receivableOptions;
  const fileType = form.kind === '费用报销' ? '费用凭证' : '收款凭证';
  const noteRequired = form.kind === '费用报销' && form.originalType === '无正式票据';
  const drawerTitle = isEditMode ? '重新提交' : '新增费用与代收';

  function handleKindChange(kind: MyWorkExpenseCollectionKind) {
    onUpdate('kind', kind);
    onUpdate('files', []);

    if (kind === '费用报销') {
      const nextPrimaryCategoryId = getMyWorkExpensePrimaryCategoryId('差旅交通') || expensePrimaryCategoryOptions[0]?.id || '';

      onUpdate('primaryCategoryId', nextPrimaryCategoryId);
      onUpdate('category', getMyWorkExpenseCategoryOptions(nextPrimaryCategoryId)[0]?.name ?? expenseCategoryOptions[0]?.name ?? '');
      onUpdate('customerName', '');
      onUpdate('relatedReceivableNo', '');
      onUpdate('publicAccountId', '');
      onUpdate('transferFiles', []);
      return;
    }

    onUpdate('category', '客户回款');
    onUpdate('relatedTarget', '');
    onUpdate('originalType', '电子原件');
    onUpdate('publicAccountId', publicAccountOptions[0]?.value ?? '');
    onUpdate('transferFiles', []);
  }

  function handleOriginalTypeChange(originalType: MyWorkExpenseOriginalType) {
    onUpdate('originalType', originalType);
  }

  function handlePrimaryCategoryChange(primaryCategoryId: string) {
    onUpdate('primaryCategoryId', primaryCategoryId);
    onUpdate('category', getMyWorkExpenseCategoryOptions(primaryCategoryId)[0]?.name ?? '');
  }

  function handleFileSelect(file: UploadFile) {
    onUpdate('files', upsertAttachment(form.files, file, fileType));
  }

  function handleTransferFileSelect(file: UploadFile) {
    onUpdate('transferFiles', upsertAttachment(form.transferFiles, file, '转入凭证'));
  }

  return (
    <DrawerFormShell
      bodyTestId="my-expense-collection-form-drawer"
      cancelAction={{ label: '取消', onClick: onCancel }}
      layout="plain"
      open={open}
      primaryAction={{
        disabled: saveDisabled,
        icon: <SendOutlined />,
        label: isEditMode && record?.status === '退回修改' ? '重新提交' : '提交',
        onClick: onSave
      }}
      secondaryAction={{
        disabled: draftDisabled,
        icon: <SaveOutlined />,
        label: '保存草稿',
        onClick: onSaveDraft
      }}
      title={
        <DetailDrawerTitle
          status={isEditMode ? record?.status : form.kind}
          statusToneMap={{ ...expenseCollectionKindTone, ...expenseCollectionStatusTone }}
          subtitle={isEditMode ? record?.code : '我的工作'}
          title={drawerTitle}
        />
      }
      width={860}
      onClose={onCancel}
    >
      <DetailSection icon={<FileTextOutlined />} title="事项信息">
        <DrawerFormGrid>
          <DrawerFormField label="事项类型" required>
            <Select
              disabled={isEditMode}
              options={myWorkExpenseCollectionKindOptions.map((kind) => ({ label: kind, value: kind }))}
              value={form.kind}
              onChange={handleKindChange}
            />
          </DrawerFormField>
          <DrawerFormField label={form.kind === '费用报销' ? '费用日期' : '收款日期'} required>
            <DatePicker
              inputReadOnly
              style={{ width: '100%' }}
              value={form.occurredAt ? dayjs(form.occurredAt) : undefined}
              onChange={(_, dateString) => onUpdate('occurredAt', normalizePickerValue(dateString))}
            />
          </DrawerFormField>
          <DrawerFormField label="金额" required>
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              value={form.amount}
              onChange={(amount) => onUpdate('amount', Number(amount ?? 0))}
            />
          </DrawerFormField>
          <DrawerFormField label={form.kind === '费用报销' ? '报销事由' : '代收事项'} required wide>
            <Input value={form.title} onChange={(event) => onUpdate('title', event.target.value)} />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>

      {form.kind === '费用报销' ? (
        <DetailSection icon={<WalletOutlined />} title="费用信息">
          <DrawerFormGrid>
            <DrawerFormField label="费用大类" required>
              <Select
                options={expensePrimaryCategoryOptions.map((category) => ({ label: category.name, value: category.id }))}
                value={form.primaryCategoryId}
                onChange={handlePrimaryCategoryChange}
              />
            </DrawerFormField>
            <DrawerFormField label="费用明细" required>
              <Select
                options={currentExpenseCategoryOptions.map((category) => ({ label: category.name, value: category.name }))}
                value={form.category}
                onChange={(category) => onUpdate('category', category)}
              />
            </DrawerFormField>
            <DrawerFormField label="支付方式" required>
              <Select
                options={myWorkExpensePaymentMethodOptions.map((method) => ({ label: method, value: method }))}
                value={form.paymentMethod}
                onChange={(paymentMethod) => onUpdate('paymentMethod', paymentMethod)}
              />
            </DrawerFormField>
            <DrawerFormField label="归属事项">
              <Input
                placeholder="客户 / 项目 / 任务，可不填"
                value={form.relatedTarget}
                onChange={(event) => onUpdate('relatedTarget', event.target.value)}
              />
            </DrawerFormField>
            <DrawerFormField label="原件类型" required>
              <Select
                options={myWorkExpenseOriginalTypeOptions.map((originalType) => ({ label: originalType, value: originalType }))}
                value={form.originalType}
                onChange={handleOriginalTypeChange}
              />
            </DrawerFormField>
          </DrawerFormGrid>
        </DetailSection>
      ) : (
        <DetailSection icon={<BankOutlined />} title="代收信息">
          <DrawerFormGrid>
            <DrawerFormField label="客户" required>
              <Select
                options={customerOptions.map((customerName) => ({ label: customerName, value: customerName }))}
                value={form.customerName || undefined}
                onChange={(customerName) => {
                  onUpdate('customerName', customerName);
                  onUpdate('relatedReceivableNo', '');
                }}
              />
            </DrawerFormField>
            <DrawerFormField label="收款方式" required>
              <Select
                options={myWorkCollectionMethodOptions.map((method) => ({ label: method, value: method }))}
                value={form.collectionMethod}
                onChange={(collectionMethod) => onUpdate('collectionMethod', collectionMethod)}
              />
            </DrawerFormField>
            <DrawerFormField label="转入对公账户" required>
              <Select
                options={publicAccountOptions}
                placeholder="选择实际转入的公司账户"
                value={form.publicAccountId || undefined}
                onChange={(publicAccountId) => onUpdate('publicAccountId', publicAccountId)}
              />
            </DrawerFormField>
            <DrawerFormField label="关联应收" wide>
              <Select
                allowClear
                options={filteredReceivableOptions.map((option) => ({ label: option.label, value: option.value }))}
                placeholder="可不关联，由财务确认"
                value={form.relatedReceivableNo || undefined}
                onChange={(relatedReceivableNo) => onUpdate('relatedReceivableNo', relatedReceivableNo ?? '')}
              />
            </DrawerFormField>
          </DrawerFormGrid>
        </DetailSection>
      )}

      <DetailSection icon={<FileProtectOutlined />} title={fileType}>
        <FileSlotGrid flush>
          <FileSlot
            accept=".pdf,.ofd,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
            description={form.kind === '费用报销' ? '发票、收据、行程单、付款截图等材料。' : '客户付款截图、收据等辅助材料，可先保存草稿后补充。'}
            files={form.files}
            multiple
            status={form.files.length > 0 ? '已选择' : '未上传'}
            statusTone={form.files.length > 0 ? 'green' : 'amber'}
            title={fileType}
            uploadText={`上传${fileType}`}
            variant="list"
            onRemove={(file) => onUpdate('files', form.files.filter((currentFile) => currentFile.id !== file.id))}
            onSelect={handleFileSelect}
          />
          {form.kind === '代收登记' ? (
            <FileSlot
              accept=".pdf,.ofd,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
              description="必须上传员工转入公司对公账户的银行回单或转账截图，提交后进入流水复核。"
              files={form.transferFiles}
              multiple
              status={form.transferFiles.length > 0 ? '已选择' : '未上传'}
              statusTone={form.transferFiles.length > 0 ? 'green' : 'amber'}
              title="转入凭证"
              uploadText="上传转入凭证"
              variant="list"
              onRemove={(file) => onUpdate('transferFiles', form.transferFiles.filter((currentFile) => currentFile.id !== file.id))}
              onSelect={handleTransferFileSelect}
            />
          ) : null}
        </FileSlotGrid>
      </DetailSection>

      <DetailSection icon={<FileTextOutlined />} title="说明">
        <DrawerFormGrid>
          <DrawerFormField label="备注" required={noteRequired} wide>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              placeholder={noteRequired ? '请说明无正式票据原因' : undefined}
              value={form.note}
              onChange={(event) => onUpdate('note', event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
    </DrawerFormShell>
  );
}

function MyExpenseCollectionDetailDrawer({
  accountOptions,
  record,
  onClose,
  onResubmit
}: {
  accountOptions: PublicAccountOption[];
  record?: MyWorkExpenseCollectionRecord;
  onClose: () => void;
  onResubmit: (record: MyWorkExpenseCollectionRecord) => void;
}) {
  if (!record) {
    return null;
  }

  return (
    <DetailDrawerShell
      bodyTestId="my-expense-collection-detail-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      primaryAction={
        record.status === '退回修改' || record.status === '草稿'
          ? { label: record.status === '草稿' ? '编辑草稿' : '重新提交', onClick: () => onResubmit(record) }
          : undefined
      }
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={expenseCollectionStatusTone}
          subtitle={`${record.kind} / ${record.code}`}
          title={record.title}
        />
      }
      width={860}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <FileTextOutlined />, key: 'kind', label: '类型', value: record.kind },
          { icon: <WalletOutlined />, key: 'amount', label: '金额', value: formatMoney(record.amount) },
          { icon: <FileProtectOutlined />, key: 'files', label: '凭证', value: getVoucherSummary(record) },
          { icon: <CheckCircleOutlined />, key: 'status', label: '状态', value: record.status }
        ]}
      />

      <DetailTabs
        items={[
          {
            children: (
              <>
                <DetailSection icon={<FileTextOutlined />} title="事项信息">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '事项类型', value: <StatusTag toneMap={expenseCollectionKindTone} value={record.kind} /> },
                      { label: record.kind === '费用报销' ? '费用日期' : '收款日期', value: record.occurredAt },
                      { label: '金额', value: formatMoney(record.amount) },
                      ...(record.kind === '费用报销'
                        ? [
                            { label: '费用大类', value: getMyWorkExpensePrimaryCategoryName(getMyWorkExpensePrimaryCategoryId(record.category)) },
                            { label: '费用明细', value: record.category },
                            { label: '支付方式', value: record.paymentMethod ?? '-' }
                          ]
                        : [{ label: '收款事项', value: record.category }]),
                      { label: record.kind === '费用报销' ? '归属事项' : '客户', value: getRelatedObject(record) },
                      { label: '当前状态', value: <StatusTag toneMap={expenseCollectionStatusTone} value={record.status} /> },
                      ...(record.kind === '费用报销'
                        ? [
                            { label: '原件类型', value: record.originalType ? <StatusTag toneMap={expenseOriginalTypeTone} value={record.originalType} /> : '-' },
                            { label: '纸质原件', value: record.paperStatus ?? '-' }
                          ]
                        : [
                            { label: '收款方式', value: record.collectionMethod ?? '-' },
                            { label: '转入对公账户', value: getPublicAccountLabel(record.publicAccountId, accountOptions) },
                            { label: '关联应收', value: record.relatedReceivableNo || '-' },
                            { label: '复核流水', value: record.linkedFinanceTransactionNo || '-' }
                          ]),
                      { label: '备注', value: record.note, wide: true }
                    ]}
                  />
                </DetailSection>
              </>
            ),
            key: 'summary',
            label: '事项信息'
          },
          {
            children: (
              <>
                <DetailSection icon={<FileProtectOutlined />} title={record.kind === '费用报销' ? '费用凭证' : '收款凭证'}>
                  <RelatedFileTable records={record.files} />
                </DetailSection>
                {record.kind === '代收登记' ? (
                  <DetailSection icon={<FileProtectOutlined />} title="转入凭证">
                    <RelatedFileTable records={record.transferFiles ?? []} />
                  </DetailSection>
                ) : null}
              </>
            ),
            key: 'files',
            label: '凭证附件'
          },
          {
            children: (
              <OperationRecordSection
                icon={<AuditOutlined />}
                records={record.operationRecords}
                title="处理记录"
              />
            ),
            key: 'records',
            label: '处理记录'
          }
        ]}
        tabTestIdPrefix="my-expense-collection-detail-tab"
        testId="my-expense-collection-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

export function MyExpenseCollectionPage() {
  const { customerRows } = useCustomerManagementState();
  const { addFinanceTransaction, financeRows, receivablePayableRows } = useFinanceManagement();
  const { publicAccounts } = usePublicAccountConfigState();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [records, setRecords] = useState<MyWorkExpenseCollectionRecord[]>(() => myWorkExpenseCollectionSeedRecords);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [filters, setFilters] = useState<MyWorkExpenseCollectionFilters>(defaultMyWorkExpenseCollectionFilters);
  const formDrawer = useDrawerFormState<MyWorkExpenseCollectionRecord, MyWorkExpenseCollectionFormValue>({
    createForm: () => createMyWorkExpenseCollectionForm(),
    editForm: (record) => createMyWorkExpenseCollectionForm(record)
  });
  const allRecords = useMemo(() => sortExpenseCollectionRows(records), [records]);
  const filteredRecords = useMemo(
    () => allRecords.filter((record) => matchesMyWorkExpenseCollectionFilters(record, filters)),
    [allRecords, filters]
  );
  const activeRecord = allRecords.find((record) => record.id === activeRecordId);
  const metrics = useMemo(() => buildMyWorkExpenseCollectionMetrics(allRecords), [allRecords]);
  const customerOptions = useMemo(() => customerRows.map((customer) => customer.name), [customerRows]);
  const receivableOptions = useMemo(() => buildMyWorkCollectionReceivableOptions(receivablePayableRows), [receivablePayableRows]);
  const publicAccountOptions = useMemo(
    () => buildPublicAccountOptions(publicAccounts, '收款').map((option) => ({ label: option.label, value: option.value })),
    [publicAccounts]
  );
  const formValid = isMyWorkExpenseCollectionFormValid(formDrawer.form);
  const draftSavable = isMyWorkExpenseCollectionDraftSavable(formDrawer.form);
  const columns = useMemo<TableColumnsType<MyWorkExpenseCollectionRecord>>(
    () => [
      {
        title: '类型',
        dataIndex: 'kind',
        align: 'center',
        width: 104,
        render: (kind: MyWorkExpenseCollectionKind) => <StatusTag toneMap={expenseCollectionKindTone} value={kind} />
      },
      {
        title: '事项',
        key: 'title',
        width: 240,
        render: (_, record) => <CompactCell primary={record.title} secondary={getExpenseCategoryLabel(record)} />
      },
      {
        title: '金额',
        dataIndex: 'amount',
        align: 'center',
        width: 128,
        render: (amount: number) => <CellText>{formatMoney(amount)}</CellText>
      },
      {
        title: '发生日期',
        dataIndex: 'occurredAt',
        align: 'center',
        width: 118
      },
      {
        title: '对象',
        key: 'related',
        width: 220,
        render: (_, record) => <CompactCell primary={getRelatedObject(record)} secondary={record.kind === '费用报销' ? '归属事项' : '客户'} />
      },
      {
        title: '凭证',
        key: 'files',
        align: 'center',
        width: 104,
        render: (_, record) => <CellText tone={record.files.length > 0 ? 'strong' : 'risk'}>{getVoucherSummary(record)}</CellText>
      },
      {
        title: '原件/转入',
        key: 'material',
        align: 'center',
        width: 126,
        render: (_, record) => <CellText>{getMaterialOrFundStatus(record)}</CellText>
      },
      {
        title: '状态',
        dataIndex: 'status',
        align: 'center',
        width: 118,
        render: (status: MyWorkExpenseCollectionStatus) => <StatusTag toneMap={expenseCollectionStatusTone} value={status} />
      }
    ],
    []
  );

  function updateFilters(patch: Partial<MyWorkExpenseCollectionFilters>) {
    setFilters((currentFilters) => ({ ...currentFilters, ...patch }));
    setActiveRecordId(undefined);
  }

  function persistForm(mode: 'draft' | 'submit') {
    if (mode === 'submit' && !formValid) {
      return;
    }

    if (mode === 'draft' && !draftSavable) {
      return;
    }

    if (
      mode === 'submit' &&
      formDrawer.form.kind === '代收登记' &&
      !resolveActivePublicAccountRef(publicAccounts, formDrawer.form.publicAccountId, '收款')
    ) {
      void messageApi.warning('请选择启用且支持收款的转入对公账户');
      return;
    }

    function buildFinanceTransactionForSubmit(record: MyWorkExpenseCollectionRecord) {
      if (mode !== 'submit' || record.kind !== '代收登记') {
        return undefined;
      }

      const publicAccountRef = resolveActivePublicAccountRef(publicAccounts, record.publicAccountId ?? '', '收款');

      if (!publicAccountRef) {
        void messageApi.warning('请选择启用且支持收款的转入对公账户');
        return undefined;
      }

      return buildFinanceTransactionFromMyWorkCollection(record, financeRows, publicAccountRef);
    }

    if (formDrawer.isEditMode && formDrawer.record) {
      const nextRecord = resubmitMyWorkExpenseCollectionRecordFromForm(formDrawer.record, formDrawer.form, mode);
      const financeTransaction = buildFinanceTransactionForSubmit(nextRecord);
      const recordToPersist = financeTransaction
        ? linkMyWorkCollectionFinanceTransaction(nextRecord, financeTransaction.transactionNo)
        : nextRecord;

      if (financeTransaction) {
        addFinanceTransaction(financeTransaction);
      }

      setRecords((currentRecords) => currentRecords.map((record) => (record.id === recordToPersist.id ? recordToPersist : record)));
      formDrawer.close();
      void messageApi.success(mode === 'draft' ? '草稿已保存' : formDrawer.record.status === '退回修改' ? '已重新提交' : '已提交');
      return;
    }

    const nextRecord = createMyWorkExpenseCollectionRecordFromForm(formDrawer.form, allRecords.length + 1, mode);
    const financeTransaction = buildFinanceTransactionForSubmit(nextRecord);
    const recordToPersist = financeTransaction
      ? linkMyWorkCollectionFinanceTransaction(nextRecord, financeTransaction.transactionNo)
      : nextRecord;

    if (financeTransaction) {
      addFinanceTransaction(financeTransaction);
    }

    setRecords((currentRecords) => [recordToPersist, ...currentRecords]);
    formDrawer.close();
    void messageApi.success(mode === 'draft' ? '草稿已保存' : '已提交');
  }

  function handleSubmitForm() {
    persistForm('submit');
  }

  function handleSaveDraft() {
    persistForm('draft');
  }

  return (
    <ManagementPageScaffold
      feedback={messageContextHolder}
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={myWorkExpenseCollectionCurrentMonth}
              label="发生时间"
              testIdPrefix="my-expense-collection-time-filter"
              value={filters.occurredTime}
              onChange={(occurredTime) => updateFilters({ occurredTime })}
            />
            <FilterField label="类型">
              <Select
                data-testid="my-expense-collection-kind-filter"
                options={['全部', ...myWorkExpenseCollectionKindOptions].map((kind) => ({ label: kind, value: kind }))}
                value={filters.kind}
                onChange={(kind: MyWorkExpenseCollectionFilterValue | MyWorkExpenseCollectionKind) => updateFilters({ kind })}
              />
            </FilterField>
            <FilterField label="状态" controlWidth="status-select">
              <Select
                data-testid="my-expense-collection-status-filter"
                options={['全部', ...myWorkExpenseCollectionStatusOptions].map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status) => updateFilters({ status })}
              />
            </FilterField>
            <KeywordFilter
              data-testid="my-expense-collection-keyword-input"
              placeholder="事项 / 客户 / 说明"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => updateFilters({ keyword })}
            />
          </FilterBar>
        </FilterPanel>
      }
      layout="table-workbench"
      metrics={
        <MetricGrid columns={6}>
          <MetricCard icon={<FileTextOutlined />} label="我的事项" value={`${metrics.totalCount} 条`} />
          <MetricCard icon={<SaveOutlined />} label="草稿" value={`${metrics.draftCount} 条`} />
          <MetricCard icon={<ReloadOutlined />} label="待我补充" value={`${metrics.pendingMyActionCount} 条`} />
          <MetricCard icon={<WarningOutlined />} label="报销审核" value={`${metrics.pendingApprovalCount} 条`} />
          <MetricCard icon={<WalletOutlined />} label="流水复核" value={`${metrics.pendingReviewCount} 条`} />
          <MetricCard icon={<CheckCircleOutlined />} label="已确认" value={`${metrics.confirmedCount} 条`} />
        </MetricGrid>
      }
      pageId="my-expense-collection"
    >
      <ManagementTable<MyWorkExpenseCollectionRecord>
        columns={columns}
        count={{ unit: '条', value: filteredRecords.length }}
        dataSource={filteredRecords}
        primaryAction={{ icon: <PlusOutlined />, label: '新增', onClick: formDrawer.openCreate }}
        rowKey="id"
        rowTestIdPrefix="my-expense-collection-row"
        tableTestId="my-expense-collection-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />

      <MyExpenseCollectionDetailDrawer
        accountOptions={publicAccountOptions}
        record={activeRecord}
        onClose={() => setActiveRecordId(undefined)}
        onResubmit={(record) => {
          setActiveRecordId(undefined);
          formDrawer.openEdit(record);
        }}
      />

      <MyExpenseCollectionFormDrawer
        customerOptions={customerOptions}
        form={formDrawer.form}
        isEditMode={formDrawer.isEditMode}
        open={formDrawer.open}
        receivableOptions={receivableOptions}
        record={formDrawer.record}
        publicAccountOptions={publicAccountOptions}
        draftDisabled={!draftSavable}
        saveDisabled={!formValid}
        onCancel={formDrawer.cancel}
        onSaveDraft={handleSaveDraft}
        onSave={handleSubmitForm}
        onUpdate={formDrawer.updateForm}
      />
    </ManagementPageScaffold>
  );
}
