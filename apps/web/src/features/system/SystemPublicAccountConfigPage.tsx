import {
  BankOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Input, InputNumber, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormShell, type ModeDrawerState, useModeDrawerState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { TagChipList } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import { formatMoney } from '../finance/financeUtils';
import { useFinanceManagement } from '../finance/FinanceManagementState';
import {
  formatPublicAccountTail,
  getDefaultPublicAccount,
  publicAccountStatusTone,
  publicAccountUsageOptions,
  publicAccountUsageTone,
  type PublicAccountFormValue,
  type PublicAccountRecord,
  type PublicAccountStatus,
  type PublicAccountUsage,
  usePublicAccountConfigState
} from './PublicAccountConfigState';

const defaultForm: PublicAccountFormValue = {
  accountHolder: '',
  accountTailNumber: '',
  bankName: '',
  defaultFor: ['收款', '付款', '银行对账'],
  displayName: '',
  note: '',
  openingBalance: 0,
  openingBalanceDate: '2026-06-01',
  status: '启用',
  usage: ['收款', '付款', '银行对账']
};

function buildForm(record?: PublicAccountRecord): PublicAccountFormValue {
  if (!record) {
    return {
      ...defaultForm,
      defaultFor: [...defaultForm.defaultFor],
      usage: [...defaultForm.usage]
    };
  }

  return {
    accountHolder: record.accountHolder,
    accountTailNumber: record.accountTailNumber,
    bankName: record.bankName,
    defaultFor: [...record.defaultFor],
    displayName: record.displayName,
    note: record.note,
    openingBalance: record.openingBalance,
    openingBalanceDate: record.openingBalanceDate,
    status: record.status,
    usage: [...record.usage]
  };
}

function isValidForm(form: PublicAccountFormValue) {
  return (
    Boolean(form.displayName.trim()) &&
    Boolean(form.bankName.trim()) &&
    Boolean(form.accountHolder.trim()) &&
    Boolean(form.accountTailNumber.trim()) &&
    Boolean(form.openingBalanceDate.trim()) &&
    form.usage.length > 0 &&
    Number.isFinite(form.openingBalance)
  );
}

function normalizeForm(form: PublicAccountFormValue): PublicAccountFormValue {
  return {
    ...form,
    accountHolder: form.accountHolder.trim(),
    accountTailNumber: form.accountTailNumber.trim(),
    bankName: form.bankName.trim(),
    defaultFor: form.defaultFor.filter((usage) => form.usage.includes(usage)),
    displayName: form.displayName.trim(),
    note: form.note.trim(),
    openingBalanceDate: form.openingBalanceDate.trim()
  };
}

function PublicAccountDrawer({
  drawer,
  record,
  records,
  onCreate,
  onSave,
  onToggleStatus
}: {
  drawer: ModeDrawerState<string, PublicAccountFormValue>;
  record?: PublicAccountRecord;
  records: PublicAccountRecord[];
  onCreate: (nextValue: PublicAccountFormValue) => void;
  onSave: (id: string, nextValue: PublicAccountFormValue) => void;
  onToggleStatus: (record: PublicAccountRecord) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const mode = drawer.mode ?? 'detail';
  const isDetailMode = mode === 'detail';
  const isCreateMode = mode === 'create';
  const form = isDetailMode && record ? buildForm(record) : drawer.form;
  const saveDisabled = !isValidForm(form);
  const activeStatus = isDetailMode ? (record?.status ?? '启用') : form.status;

  function updateForm<T extends keyof PublicAccountFormValue>(key: T, value: PublicAccountFormValue[T]) {
    drawer.updateForm(key, value);
  }

  function handleSave() {
    const nextValue = normalizeForm(form);

    if (!isValidForm(nextValue)) {
      void messageApi.warning('请补全账户名称、开户行、户名、尾号和账户能力');
      return;
    }

    if (records.some((row) => row.id !== record?.id && row.displayName === nextValue.displayName)) {
      void messageApi.warning('账户名称已存在');
      return;
    }

    if (isCreateMode) {
      onCreate(nextValue);
      void messageApi.success('对公账户已新增');
      return;
    }

    if (record) {
      onSave(record.id, nextValue);
      void messageApi.success('对公账户已保存');
    }
  }

  const detailItems = [
    { label: '账户名称', value: record?.displayName },
    { label: '开户行', value: record?.bankName },
    { label: '账户户名', value: record?.accountHolder },
    { label: '账号尾号', value: record ? formatPublicAccountTail(record.accountTailNumber) : undefined },
    {
      label: '账户能力',
      value: record ? (
        <TagChipList
          items={record.usage}
          maxVisible={5}
          tone={(usage) => publicAccountUsageTone[usage as PublicAccountUsage]}
          wrap
        />
      ) : undefined,
      wide: true
    },
    {
      label: '默认承接',
      value: record?.defaultFor.length ? (
        <TagChipList
          items={record.defaultFor}
          maxVisible={5}
          tone={(usage) => publicAccountUsageTone[usage as PublicAccountUsage]}
          wrap
        />
      ) : '-',
      wide: true
    },
    { label: '初始余额', value: record ? formatMoney(record.openingBalance) : undefined },
    { label: '余额日期', value: record?.openingBalanceDate },
    { label: '状态', value: record ? <StatusTag toneMap={publicAccountStatusTone} value={record.status} /> : undefined },
    { label: '最近更新', value: record?.updatedAt },
    { label: '备注', value: record?.note, wide: true }
  ];

  const formItems = [
    {
      label: '账户名称 *',
      value: <Input placeholder="例如：招商银行基本户" value={form.displayName} onChange={(event) => updateForm('displayName', event.target.value)} />
    },
    {
      label: '开户行 *',
      value: <Input placeholder="例如：招商银行" value={form.bankName} onChange={(event) => updateForm('bankName', event.target.value)} />
    },
    {
      label: '账户户名 *',
      value: <Input placeholder="请输入公司账户户名" value={form.accountHolder} onChange={(event) => updateForm('accountHolder', event.target.value)} />
    },
    {
      label: '账号尾号 *',
      value: <Input maxLength={4} placeholder="后四位" value={form.accountTailNumber} onChange={(event) => updateForm('accountTailNumber', event.target.value)} />
    },
    {
      label: '账户能力 *',
      value: (
        <Select
          mode="multiple"
          options={publicAccountUsageOptions.map((usage) => ({ label: usage, value: usage }))}
          value={form.usage}
          onChange={(value) => {
            updateForm('usage', value);
            updateForm(
              'defaultFor',
              form.defaultFor.filter((usage) => value.includes(usage))
            );
          }}
        />
      ),
      wide: true
    },
    {
      label: '默认承接',
      value: (
        <Select
          mode="multiple"
          options={form.usage.map((usage) => ({ label: usage, value: usage }))}
          placeholder="选择默认承接的账户能力"
          value={form.defaultFor}
          onChange={(value) => updateForm('defaultFor', value)}
        />
      ),
      wide: true
    },
    {
      label: '初始余额',
      value: (
        <InputNumber
          min={0}
          precision={2}
          style={{ width: '100%' }}
          value={form.openingBalance}
          onChange={(value) => updateForm('openingBalance', value ?? 0)}
        />
      )
    },
    {
      label: '余额日期 *',
      value: (
        <Input
          placeholder="YYYY-MM-DD"
          value={form.openingBalanceDate}
          onChange={(event) => updateForm('openingBalanceDate', event.target.value)}
        />
      )
    },
    {
      label: '状态',
      value: (
        <Select
          options={[
            { label: '启用', value: '启用' },
            { label: '停用', value: '停用' }
          ]}
          value={form.status}
          onChange={(value: PublicAccountStatus) => updateForm('status', value)}
        />
      )
    },
    {
      label: '备注',
      value: (
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 5 }}
          placeholder="记录账户使用说明或内部备注"
          value={form.note}
          onChange={(event) => updateForm('note', event.target.value)}
        />
      ),
      wide: true
    }
  ];

  const tabItems = [
    {
      children: (
        <DetailSection icon={<BankOutlined />} title="账户信息">
          <DetailInfoGrid columns={2} items={detailItems} />
        </DetailSection>
      ),
      key: 'info',
      label: '账户信息'
    },
    {
      children: (
        <DetailSection icon={<FileSearchOutlined />} title="使用范围">
          <DetailInfoGrid
            columns={2}
            items={[
              { label: '收款登记', value: record?.usage.includes('收款') ? '可引用' : '不适用' },
              { label: '付款登记', value: record?.usage.includes('付款') ? '可引用' : '不适用' },
              { label: '银行对账', value: record?.usage.includes('银行对账') ? '可引用' : '不适用' },
              { label: '账户台账', value: '可归集' }
            ]}
          />
        </DetailSection>
      ),
      key: 'scope',
      label: '使用范围'
    },
    {
      children: (
        <OperationRecordSection icon={<ProfileOutlined />} records={record?.operationRecords ?? []} title="操作记录" />
      ),
      key: 'records',
      label: '操作记录'
    }
  ];

  const title = isCreateMode ? '新增对公账户' : mode === 'edit' ? '编辑对公账户' : '对公账户详情';

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        detailActions={
          isDetailMode
            ? {
                closeAction: { label: '关闭', onClick: drawer.close },
                primaryAction: { icon: <EditOutlined />, label: '编辑', onClick: () => drawer.openEdit() },
                secondaryAction: record
                  ? {
                      danger: record.status === '启用',
                      label: record.status === '启用' ? '停用' : '启用',
                      onClick: () => onToggleStatus(record)
                    }
                  : undefined
              }
            : undefined
        }
        formActions={
          !isDetailMode
            ? {
                cancelAction: { label: '取消', onClick: drawer.cancel },
                primaryAction: {
                  disabled: saveDisabled,
                  label: isCreateMode ? '新增账户' : '保存配置',
                  onClick: handleSave
                }
              }
            : undefined
        }
        mode={mode}
        open={drawer.open}
        title={
          <DetailDrawerTitle
            status={activeStatus}
            statusToneMap={publicAccountStatusTone}
            subtitle="系统管理 / 对公账户配置"
            title={title}
          />
        }
        width={820}
        onClose={isDetailMode ? drawer.close : drawer.cancel}
      >
        {isDetailMode ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={[
                { icon: <BankOutlined />, key: 'name', label: '账户名称', value: record?.displayName },
                { icon: <ProfileOutlined />, key: 'bank', label: '开户行', value: record?.bankName },
                { icon: <FileSearchOutlined />, key: 'tail', label: '账号尾号', value: record ? formatPublicAccountTail(record.accountTailNumber) : '-' },
                { icon: <WalletOutlined />, key: 'balance', label: '初始余额', value: record ? formatMoney(record.openingBalance) : '-' }
              ]}
            />
            <DetailTabs items={tabItems} tabTestIdPrefix="system-public-account-detail-tab" testId="system-public-account-detail-tabs" />
          </>
        ) : (
          <DetailSection icon={<BankOutlined />} title="账户配置">
            <DetailInfoGrid columns={2} items={formItems} />
          </DetailSection>
        )}
      </DrawerFormShell>
    </>
  );
}

export function SystemPublicAccountConfigPage() {
  const { financeRows } = useFinanceManagement();
  const [messageApi, contextHolder] = message.useMessage();
  const { createPublicAccount, publicAccounts, updatePublicAccount, updatePublicAccountStatus } = usePublicAccountConfigState();
  const [statusFilter, setStatusFilter] = useState<'全部' | PublicAccountStatus>('全部');
  const [usageFilter, setUsageFilter] = useState<'全部' | PublicAccountUsage>('全部');
  const [keyword, setKeyword] = useState('');
  const publicAccountDrawer = useModeDrawerState<string, PublicAccountFormValue>({
    createForm: () => buildForm(),
    detailForm: (id) => buildForm(publicAccounts.find((row) => row.id === id))
  });

  const activeRecord = publicAccountDrawer.record
    ? publicAccounts.find((row) => row.id === publicAccountDrawer.record)
    : undefined;
  const defaultAccount = getDefaultPublicAccount(publicAccounts);
  const enabledCount = publicAccounts.filter((row) => row.status === '启用').length;
  const usageCount = new Set(publicAccounts.flatMap((row) => row.usage)).size;

  const rows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return publicAccounts.filter((row) => {
      const matchesStatus = statusFilter === '全部' || row.status === statusFilter;
      const matchesUsage = usageFilter === '全部' || row.usage.includes(usageFilter);
      const matchesKeyword =
        !normalizedKeyword ||
        [
          row.displayName,
          row.bankName,
          row.accountHolder,
          row.accountTailNumber,
          row.note,
          ...row.usage
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);

      return matchesStatus && matchesUsage && matchesKeyword;
    });
  }, [keyword, publicAccounts, statusFilter, usageFilter]);

  function openCreateDrawer() {
    publicAccountDrawer.openCreate();
  }

  function openDetailDrawer(record: PublicAccountRecord) {
    publicAccountDrawer.openDetail(record.id);
  }

  function createAccount(nextValue: PublicAccountFormValue) {
    const nextRecord = createPublicAccount(nextValue);
    publicAccountDrawer.openDetail(nextRecord.id);
  }

  function saveAccount(id: string, nextValue: PublicAccountFormValue) {
    const activeReferenceCount = financeRows.filter(
      (transaction) =>
        transaction.publicAccountId === id &&
        transaction.status !== '已作废' &&
        (transaction.status !== '已入账' || transaction.reconciliationStatus !== '已对账')
    ).length;
    const result = updatePublicAccount(id, nextValue, activeReferenceCount);
    if (!result.success) {
      void messageApi.warning(result.message);
      return;
    }
    publicAccountDrawer.openDetail(id);
  }

  function toggleAccountStatus(record: PublicAccountRecord) {
    const nextStatus: PublicAccountStatus = record.status === '启用' ? '停用' : '启用';
    const activeReferenceCount = financeRows.filter(
      (transaction) =>
        transaction.publicAccountId === record.id &&
        transaction.status !== '已作废' &&
        (transaction.status !== '已入账' || transaction.reconciliationStatus !== '已对账')
    ).length;
    const result = updatePublicAccountStatus(record.id, nextStatus, activeReferenceCount);
    if (!result.success) {
      void messageApi.warning(result.message);
      return;
    }
    void messageApi.success(`${record.displayName}已${nextStatus}`);
  }

  const columns: TableColumnsType<PublicAccountRecord> = [
    {
      title: '账户名称',
      key: 'displayName',
      width: 210,
      render: (_, record) => <CompactCell primary={record.displayName} secondary={record.bankName} />
    },
    {
      title: '账户户名',
      dataIndex: 'accountHolder',
      width: 190
    },
    {
      title: '账号尾号',
      dataIndex: 'accountTailNumber',
      width: 120,
      render: (tailNumber: string) => formatPublicAccountTail(tailNumber)
    },
    {
      title: '账户能力',
      dataIndex: 'usage',
      width: 240,
      render: (items: PublicAccountUsage[]) => (
        <TagChipList items={items} maxVisible={5} tone={(usage) => publicAccountUsageTone[usage as PublicAccountUsage]} wrap />
      )
    },
    {
      title: '默认承接',
      dataIndex: 'defaultFor',
      width: 190,
      render: (items: PublicAccountUsage[]) =>
        items.length ? <TagChipList items={items} maxVisible={3} tone={(usage) => publicAccountUsageTone[usage as PublicAccountUsage]} wrap /> : '-'
    },
    {
      title: '初始余额',
      dataIndex: 'openingBalance',
      width: 130,
      render: (amount: number) => <CellText>{formatMoney(amount)}</CellText>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: PublicAccountStatus) => <StatusTag toneMap={publicAccountStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 108
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="状态">
              <Select
                className="field-control"
                options={['全部', '启用', '停用'].map((status) => ({ label: status, value: status }))}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
              />
            </FilterField>
            <FilterField label="账户能力">
              <Select
                className="field-control"
                options={['全部', ...publicAccountUsageOptions].map((usage) => ({ label: usage, value: usage }))}
                value={usageFilter}
                onChange={(value) => setUsageFilter(value)}
              />
            </FilterField>
            <KeywordFilter placeholder="账户名称 / 开户行 / 户名" value={keyword} onChange={setKeyword} />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<BankOutlined />} label="对公账户" value={publicAccounts.length} />
          <MetricCard icon={<CheckCircleOutlined />} label="启用账户" value={enabledCount} />
          <MetricCard icon={<ProfileOutlined />} label="账户能力" value={usageCount} />
          <MetricCard icon={<WalletOutlined />} label="默认账户" value={defaultAccount?.displayName ?? '-'} />
        </MetricGrid>
      }
      pageId="system-public-accounts"
    >
      <ManagementTable<PublicAccountRecord>
        columns={columns}
        count={{ unit: '个账户', value: rows.length }}
        dataSource={rows}
        primaryAction={{
          icon: <PlusOutlined />,
          label: '新增账户',
          onClick: openCreateDrawer,
          testId: 'system-public-account-create-button'
        }}
        rowKey="id"
        rowTestIdPrefix="system-public-account-table-row"
        tableTestId="system-public-account-table"
        onRowClick={openDetailDrawer}
      />

      <PublicAccountDrawer
        drawer={publicAccountDrawer}
        record={activeRecord}
        records={publicAccounts}
        onCreate={createAccount}
        onSave={saveAccount}
        onToggleStatus={toggleAccountStatus}
      />
    </ManagementPageScaffold>
  );
}
