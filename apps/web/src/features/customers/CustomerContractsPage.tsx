import { BankOutlined, PlusOutlined } from '@ant-design/icons';
import { Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { StatusTag } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormShell, useDrawerFormState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricGrid } from '../../components/MetricGrid';
import { CompactCell } from '../../components/TableCell';
import {
  ContractFileSection,
  ContractFileUploadSection,
  ContractFormSection,
  ContractProfileSection,
  ContractReceiptPanel
} from './ContractSections';
import {
  addContractFormFile,
  buildContractForm,
  buildContractRecordForSave,
  buildDefaultContractForm,
  formatContractMoney,
  getContractReceiptCellDisplay,
  isContractFormChanged,
  isContractFormValid,
  matchesContractKeyword,
  removeContractFormFile,
  type ContractDraftFile,
  type ContractForm
} from './contractFormModel';
import {
  type CustomerContractFileRecord,
  type CustomerContractRecord,
  type CustomerContractStatus
} from './customerData';
import { useCustomerManagementState } from './CustomerManagementState';
import {
  CustomerCodeCell,
  CustomerDrawerTitle,
  CustomerMetricCard,
  customerContractStatusTone,
  customerMetricIcons
} from './CustomerShared';

type ContractFilters = {
  customerId: '全部' | string;
  keyword: string;
  status: '全部' | CustomerContractStatus;
};

const defaultFilters: ContractFilters = {
  customerId: '全部',
  keyword: '',
  status: '全部'
};

function renderReceiptCell(record: CustomerContractRecord) {
  const display = getContractReceiptCellDisplay(record);

  return (
    <CompactCell
      primary={display.primary}
      secondary={display.secondary}
    />
  );
}

export function CustomerContractsPage() {
  const [filters, setFilters] = useState<ContractFilters>(defaultFilters);
  const {
    contractRows,
    customerRows,
    getCustomerById,
    saveContract: saveContractRecord
  } = useCustomerManagementState();
  const [activeContract, setActiveContract] = useState<CustomerContractRecord>();
  const [messageApi, contextHolder] = message.useMessage();
  const contractFormDrawer = useDrawerFormState<CustomerContractRecord, ContractForm>({
    createForm: () => buildDefaultContractForm(customerRows),
    editForm: buildContractForm,
    onCancelEdit: setActiveContract
  });
  const contractDrawerMode = contractFormDrawer.mode;
  const editingContract = contractFormDrawer.record;
  const contractForm = contractFormDrawer.form;
  const setContractForm = contractFormDrawer.setForm;
  const rows = useMemo(
    () =>
      contractRows.filter((record) => {
        const customerMatched = filters.customerId === '全部' || record.customerId === filters.customerId;
        const statusMatched = filters.status === '全部' || record.status === filters.status;
        return customerMatched && statusMatched && matchesContractKeyword(record, filters.keyword, customerRows);
      }),
    [contractRows, customerRows, filters.customerId, filters.keyword, filters.status]
  );
  const contractFormValid = isContractFormValid(contractForm);
  const contractFormChanged = contractDrawerMode === 'create' || isContractFormChanged(contractForm, editingContract);
  const canSaveContract = Boolean(contractDrawerMode && contractFormValid && contractFormChanged);
  const contractAmountTotal = contractRows.reduce((total, record) => total + (record.amount ?? 0), 0);
  const receivedAmountTotal = contractRows.reduce((total, record) => total + record.receivedAmount, 0);

  function handleAddContractFormFile(file: { name: string; size?: number; uid: string }) {
    setContractForm((current) => {
      const result = addContractFormFile(current, file);

      if (result.status === 'tooLarge') {
        void messageApi.error('单个合同文件不能超过 20MB');
        return current;
      }

      if (result.status === 'duplicate') {
        void messageApi.warning(`${result.fileName} 已在上传列表中`);
        return current;
      }

      return result.form;
    });
  }

  function handleRemoveContractFormFile(file: ContractDraftFile) {
    setContractForm((current) => removeContractFormFile(current, file.id));
  }

  function updateContractFormPatch(patch: Partial<ContractForm>) {
    setContractForm((current) => ({
      ...current,
      ...patch
    }));
  }

  function openCreateContractDrawer() {
    setActiveContract(undefined);
    contractFormDrawer.openCreate();
  }

  function openEditContractDrawer(record: CustomerContractRecord) {
    setActiveContract(undefined);
    contractFormDrawer.openEdit(record);
  }

  function closeContractDrawer() {
    contractFormDrawer.close();
  }

  function cancelContractDrawer() {
    contractFormDrawer.cancel();
  }

  function saveContract() {
    if (!canSaveContract) {
      return;
    }

    const nextContract = buildContractRecordForSave({
      contractRows,
      drawerMode: contractDrawerMode,
      editingContract,
      form: contractForm
    });

    if (!nextContract) {
      return;
    }

    saveContractRecord(nextContract);
    setActiveContract(nextContract);
    closeContractDrawer();
    void messageApi.success(contractDrawerMode === 'create' ? '已新增合同档案' : '已保存合同');
  }

  const columns: TableColumnsType<CustomerContractRecord> = [
    {
      title: '合同',
      key: 'contract',
      width: 240,
      render: (_, record) => <CustomerCodeCell code={record.code} name={record.name} />
    },
    {
      title: '客户',
      key: 'customer',
      width: 220,
      render: (_, record) => getCustomerById(record.customerId)?.name ?? '-'
    },
    {
      title: '合同类型',
      dataIndex: 'type',
      align: 'center',
      width: 108
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 90,
      render: (status: CustomerContractStatus) => <StatusTag toneMap={customerContractStatusTone} value={status} />
    },
    {
      title: '签署日期',
      dataIndex: 'signedAt',
      align: 'center',
      width: 108
    },
    {
      title: '到期日期',
      dataIndex: 'expiresAt',
      align: 'center',
      width: 108
    },
    {
      title: '收款情况',
      key: 'receipt',
      align: 'center',
      width: 168,
      render: (_, record) => renderReceiptCell(record)
    },
    {
      title: '文件',
      dataIndex: 'files',
      align: 'center',
      width: 78,
      render: (files: CustomerContractFileRecord[] | undefined) => `${files?.length ?? 0} 份`
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      align: 'center',
      width: 92
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 108
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <CustomerMetricCard label="合同数量" value={contractRows.length} icon={customerMetricIcons.contract} />
          <CustomerMetricCard label="有效合同" value={contractRows.filter((record) => record.status === '有效').length} icon={customerMetricIcons.active} />
          <CustomerMetricCard label="固定合同额" value={formatContractMoney(contractAmountTotal)} icon={<BankOutlined />} />
          <CustomerMetricCard label="已收金额" value={formatContractMoney(receivedAmountTotal)} icon={customerMetricIcons.active} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="所属客户">
              <Select
                value={filters.customerId}
                options={[
                  { label: '全部', value: '全部' },
                  ...customerRows.map((customer) => ({ label: customer.name, value: customer.id }))
                ]}
                onChange={(customerId) => setFilters((current) => ({ ...current, customerId }))}
              />
            </FilterField>
            <FilterField label="合同状态">
              <Select
                value={filters.status}
                options={(['全部', '有效', '已到期'] satisfies ContractFilters['status'][]).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              placeholder="合同 / 客户 / 负责人"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTable<CustomerContractRecord>
        columns={columns}
        count={{ value: rows.length, unit: '份合同' }}
        dataSource={rows}
        primaryAction={{ icon: <PlusOutlined />, label: '新增合同', onClick: openCreateContractDrawer }}
        rowTestIdPrefix="customer-contract-table-row"
        rowKey="id"
        tableTestId="customer-contract-table"
        onRowClick={setActiveContract}
      />

      <DetailDrawerShell
        closeAction={{ label: '关闭', onClick: () => setActiveContract(undefined) }}
        open={Boolean(activeContract)}
        primaryAction={
          activeContract
            ? {
                label: '编辑合同',
                onClick: () => openEditContractDrawer(activeContract)
              }
            : undefined
        }
        title={
          activeContract ? (
            <CustomerDrawerTitle
              eyebrow="客户管理 / 合同管理"
              status={activeContract.status}
              statusTone={customerContractStatusTone[activeContract.status]}
              title={activeContract.name}
            />
          ) : null
        }
        width={820}
        onClose={() => setActiveContract(undefined)}
      >
        {activeContract ? (
          <>
            <DetailTabs
              defaultActiveKey="profile"
              tabTestIdPrefix="customer-contract-detail-tab"
              testId="customer-contract-detail-tabs"
              items={[
                {
                  key: 'profile',
                  label: '合同资料',
                  children: (
                    <ContractProfileSection
                      contract={activeContract}
                      customerName={getCustomerById(activeContract.customerId)?.name}
                      customerTaxId={getCustomerById(activeContract.customerId)?.taxpayerIdentificationNo}
                    />
                  )
                },
                {
                  key: 'receipts',
                  label: '收款信息',
                  children: <ContractReceiptPanel contract={activeContract} />
                },
                {
                  key: 'files',
                  label: '合同文件',
                  children: (
                    <ContractFileSection
                      contract={activeContract}
                      onPreview={(file) => {
                        void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
                      }}
                      onDownload={(file) => {
                        void messageApi.success(`${file.name} 下载请求已记录`);
                      }}
                    />
                  )
                }
              ]}
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: cancelContractDrawer }}
        open={contractFormDrawer.open}
        primaryAction={{
          disabled: !canSaveContract,
          label: contractDrawerMode === 'create' ? '保存合同' : '保存修改',
          onClick: saveContract
        }}
        title={
          contractDrawerMode ? (
            <CustomerDrawerTitle
              eyebrow="客户管理 / 合同管理"
              title={contractDrawerMode === 'create' ? '新增合同' : contractForm.name || editingContract?.name || '编辑合同'}
            />
          ) : null
        }
        width={760}
        onClose={cancelContractDrawer}
      >
        <ContractFormSection contracts={contractRows} customers={customerRows} form={contractForm} onChange={updateContractFormPatch} />
        <ContractFileUploadSection
          files={contractForm.files}
          onPreview={(file) => {
            void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
          }}
          onRemove={handleRemoveContractFormFile}
          onSelect={handleAddContractFormFile}
        />
      </DrawerFormShell>
    </ManagementPageScaffold>
  );
}
