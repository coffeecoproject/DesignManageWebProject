import {
  AppstoreOutlined,
  FileProtectOutlined,
  PlusOutlined,
  ShopOutlined
} from '@ant-design/icons';
import { Input, InputNumber, Segmented, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { frontendBusinessToday, getNextMonthStart } from '../../app/frontendBusinessClock';
import { StatusTag } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useDrawerFormState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricGrid } from '../../components/MetricGrid';
import { useTaskConfigState } from '../system/TaskConfigState';
import { useTaskManagementState } from '../tasks/TaskManagementState';
import {
  addBrandTaskConfigToForm,
  buildBrandForm,
  buildBrandRecordForSave,
  buildBrandTaskDisplayRows,
  buildBrandTaskFormDisplayRows,
  buildDefaultBrandForm,
  getAddableBrandTaskConfigs,
  getDefaultBrandContactName,
  isBrandFormValid,
  matchesBrandKeyword,
  removeBrandTaskConfigFromForm,
  updateBrandTaskPricing,
  type BrandForm
} from './brandFormModel';
import {
  getEligibleBrandPricingContracts,
  validateBrandTaskPricingDrafts
} from './brandTaskPricingModel';
import { BrandStoreTable } from './BrandStoreTable';
import { BrandAcceptanceConfigPanel } from './BrandAcceptanceConfigPanel';
import {
  BrandContractUsageTable,
  BrandTaskConfigEditor,
  BrandTaskConfigSummary,
  BrandTaskConfigTable
} from './BrandTaskConfigPanel';
import {
  getPrimaryCustomerContact,
  type BrandRecord
} from './customerData';
import { useCustomerManagementState } from './CustomerManagementState';
import {
  CustomerCodeCell,
  CustomerDetailSection,
  CustomerDrawerTitle,
  CustomerInfoGrid,
  CustomerMetricCard,
  customerMetricIcons,
  customerStatusTone
} from './CustomerShared';

type BrandFilters = {
  customerId: '全部' | string;
  keyword: string;
};

const brandConfigurationEffectiveAt = frontendBusinessToday;

const defaultFilters: BrandFilters = {
  customerId: '全部',
  keyword: ''
};

function BrandDrawerSummary({ storeCount, taskCount }: { storeCount: number; taskCount: number }) {
  return (
    <MetricGrid columns={2} density="compact">
      <CustomerMetricCard label="可用任务" value={`${taskCount} 项`} icon={customerMetricIcons.brand} />
      <CustomerMetricCard label="关联门店" value={`${storeCount} 个`} icon={customerMetricIcons.store} />
    </MetricGrid>
  );
}

export function BrandManagementPage() {
  const [filters, setFilters] = useState<BrandFilters>(defaultFilters);
  const { customerTaskContractUsageSummaries } = useTaskManagementState();
  const { taskConfigRows } = useTaskConfigState();
  const {
    brandAcceptancePolicyRows,
    brandTaskPriceRows,
    brandRows,
    contractRows,
    customerRows,
    storeRows,
    deriveCustomerStatus,
    getActiveBrandSettlementPolicy,
    getBrandAcceptancePolicy,
    getBrandStoreCount,
    getCustomerById,
    saveBrandConfiguration
  } = useCustomerManagementState();
  const [activeBrand, setActiveBrand] = useState<BrandRecord>();
  const [taskConfigIdToAdd, setTaskConfigIdToAdd] = useState<string>();
  const [messageApi, contextHolder] = message.useMessage();
  const brandFormDrawer = useDrawerFormState<BrandRecord, BrandForm>({
    createForm: () => buildDefaultBrandForm({ brandRows, customerRows }),
    editForm: (record) => buildBrandForm(
      record,
      brandTaskPriceRows,
      brandAcceptancePolicyRows,
      brandConfigurationEffectiveAt
    ),
    onCancelEdit: setActiveBrand
  });
  const brandDrawerMode = brandFormDrawer.mode;
  const editingBrand = brandFormDrawer.record;
  const brandForm = brandFormDrawer.form;
  const setBrandForm = brandFormDrawer.setForm;
  const updateBrandForm = brandFormDrawer.updateForm;
  const rows = useMemo(
    () =>
      brandRows.filter((record) => {
        const customerMatched = filters.customerId === '全部' || record.customerId === filters.customerId;
        return customerMatched && matchesBrandKeyword(record, filters.keyword, customerRows);
      }),
    [brandRows, customerRows, filters.customerId, filters.keyword]
  );
  const previewCustomer = activeBrand ? getCustomerById(activeBrand.customerId) : undefined;
  const previewCustomerStatus = previewCustomer ? deriveCustomerStatus(previewCustomer.id) : undefined;
  const previewCustomerContact = previewCustomer ? getPrimaryCustomerContact(previewCustomer) : undefined;
  const previewStoreRows = activeBrand ? storeRows.filter((store) => store.brandId === activeBrand.id) : [];
  const previewTaskConfigRows = activeBrand
    ? buildBrandTaskDisplayRows(
        activeBrand,
        taskConfigRows,
        brandTaskPriceRows,
        contractRows,
        brandConfigurationEffectiveAt
      )
    : [];
  const previewSettlementPolicy = activeBrand
    ? getActiveBrandSettlementPolicy(activeBrand.id, brandConfigurationEffectiveAt)?.policy
    : undefined;
  const previewAcceptancePolicy = activeBrand
    ? getBrandAcceptancePolicy(activeBrand.id)?.policy
    : undefined;
  const previewContractUsageRows = activeBrand
    ? customerTaskContractUsageSummaries.filter((row) => row.brandIds.includes(activeBrand.id))
    : [];
  const selectedCustomer = getCustomerById(brandForm.customerId);
  const selectedCustomerStatus = selectedCustomer ? deriveCustomerStatus(selectedCustomer.id) : undefined;
  const selectedCustomerContact = selectedCustomer ? getPrimaryCustomerContact(selectedCustomer) : undefined;
  const editingStoreRows = editingBrand ? storeRows.filter((store) => store.brandId === editingBrand.id) : [];
  const configuredTaskFormRows = buildBrandTaskFormDisplayRows(
    brandForm.taskConfigs,
    taskConfigRows,
    contractRows
  );
  const eligibleContracts = getEligibleBrandPricingContracts(
    contractRows,
    brandForm.customerId,
    brandConfigurationEffectiveAt
  );
  const addableTaskConfigs = getAddableBrandTaskConfigs({
    form: brandForm,
    taskConfigRows
  });
  const contactOptions =
    selectedCustomer?.contacts.map((contact) => ({
      label: `${contact.name} / ${contact.role}`,
      value: contact.name
    })) ?? [];
  const brandPricingIssues = validateBrandTaskPricingDrafts({
    contracts: contractRows,
    customerId: brandForm.customerId,
    effectiveAt: brandConfigurationEffectiveAt,
    pricingDrafts: brandForm.taskConfigs
  });
  const brandFormValid = isBrandFormValid(brandForm) && brandPricingIssues.length === 0;

  function addBrandTaskConfig() {
    setBrandForm((current) =>
      addBrandTaskConfigToForm({
        form: current,
        taskConfigId: taskConfigIdToAdd,
        taskConfigRows
      })
    );
    setTaskConfigIdToAdd(undefined);
  }

  function removeBrandTaskConfig(taskConfigId: string) {
    setBrandForm((current) => removeBrandTaskConfigFromForm(current, taskConfigId));
  }

  function updateTaskPricing(
    taskConfigId: string,
    patch: Partial<Pick<(typeof configuredTaskFormRows)[number], 'billable' | 'contractId' | 'unitPrice'>>
  ) {
    setBrandForm((current) => updateBrandTaskPricing(current, taskConfigId, patch));
  }

  function openCreateBrandDrawer() {
    setActiveBrand(undefined);
    setTaskConfigIdToAdd(undefined);
    brandFormDrawer.openCreate();
  }

  function openEditBrandDrawer(record: BrandRecord) {
    setActiveBrand(undefined);
    setTaskConfigIdToAdd(undefined);
    brandFormDrawer.openEdit(record);
  }

  function closeBrandDrawer() {
    brandFormDrawer.close();
    setTaskConfigIdToAdd(undefined);
  }

  function cancelBrandDrawer() {
    brandFormDrawer.cancel();
    setTaskConfigIdToAdd(undefined);
  }

  function saveBrand() {
    if (!brandFormValid) {
      return;
    }

    if (brandDrawerMode === 'edit' && !editingBrand) {
      return;
    }

    const nextBrand = buildBrandRecordForSave({
      editingBrand,
      form: brandForm
    });
    saveBrandConfiguration({
      acceptancePolicy: brandForm.acceptancePolicy,
      effectiveAt: brandConfigurationEffectiveAt,
      pricingDrafts: brandForm.taskConfigs,
      record: nextBrand,
      settlementPolicyEffectiveAt: editingBrand
        ? getNextMonthStart(brandConfigurationEffectiveAt)
        : brandConfigurationEffectiveAt
    });
    setActiveBrand(nextBrand);
    closeBrandDrawer();
    void messageApi.success(
      brandDrawerMode === 'create'
        ? '已新增品牌'
        : `已保存品牌；验收配置已更新，结算规则自 ${getNextMonthStart(brandConfigurationEffectiveAt)} 生效`
    );
  }

  const columns: TableColumnsType<BrandRecord> = [
    {
      title: '品牌',
      key: 'brand',
      width: 210,
      render: (_, record) => <CustomerCodeCell code={record.code} name={record.name} />
    },
    {
      title: '所属客户',
      key: 'customer',
      width: 210,
      render: (_, record) => getCustomerById(record.customerId)?.name ?? '-'
    },
    {
      title: '联系人',
      dataIndex: 'contactName',
      align: 'center',
      width: 96
    },
    {
      title: '适用任务',
      key: 'taskConfigs',
      align: 'center',
      width: 170,
      render: (_, record) => (
        <BrandTaskConfigSummary
          rows={buildBrandTaskDisplayRows(
            record,
            taskConfigRows,
            brandTaskPriceRows,
            contractRows,
            brandConfigurationEffectiveAt
          )}
        />
      )
    },
    {
      title: '门店',
      dataIndex: 'storeCount',
      align: 'center',
      width: 78,
      render: (_, record) => `${getBrandStoreCount(record.id)} 个`
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
        <MetricGrid columns={3}>
          <CustomerMetricCard label="品牌数量" value={brandRows.length} icon={customerMetricIcons.brand} />
          <CustomerMetricCard label="关联客户" value={new Set(brandRows.map((record) => record.customerId)).size} icon={customerMetricIcons.customer} />
          <CustomerMetricCard label="覆盖门店" value={storeRows.length} icon={customerMetricIcons.store} />
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
            <KeywordFilter
              placeholder="品牌 / 客户 / 联系人"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTable<BrandRecord>
        columns={columns}
        count={{ value: rows.length, unit: '个品牌' }}
        dataSource={rows}
        primaryAction={{ icon: <PlusOutlined />, label: '新增品牌', onClick: openCreateBrandDrawer }}
        rowTestIdPrefix="customer-brand-table-row"
        rowKey="id"
        tableTestId="customer-brand-table"
        onRowClick={setActiveBrand}
      />

      <DetailDrawerShell
        closeAction={{ label: '关闭', onClick: () => setActiveBrand(undefined) }}
        open={Boolean(activeBrand)}
        primaryAction={
          activeBrand
            ? {
                label: '编辑品牌',
                onClick: () => openEditBrandDrawer(activeBrand)
              }
            : undefined
        }
        title={
          activeBrand ? (
            <CustomerDrawerTitle eyebrow="客户管理 / 品牌管理" title={activeBrand.name} />
          ) : null
        }
        width={840}
        onClose={() => setActiveBrand(undefined)}
      >
        {activeBrand ? (
          <>
            <BrandDrawerSummary storeCount={previewStoreRows.length} taskCount={previewTaskConfigRows.length} />
            <DetailTabs
              tabTestIdPrefix="customer-brand-detail-tab"
              testId="customer-brand-detail-tabs"
              items={[
                {
                  key: 'brand-profile',
                  label: '品牌资料',
                  children: (
                    <>
                      <CustomerDetailSection icon={<AppstoreOutlined />} title="品牌资料">
                        <CustomerInfoGrid
                          columns={2}
                          items={[
                            { label: '品牌编号', value: activeBrand.code },
                            { label: '品牌名称', value: activeBrand.name },
                            { label: '所属客户', value: previewCustomer?.name },
                            { label: '客户联系人', value: activeBrand.contactName },
                            { label: '门店数量', value: `${getBrandStoreCount(activeBrand.id)} 个` },
                            { label: '最近更新', value: activeBrand.updatedAt },
                            { label: '备注', value: activeBrand.note, wide: true }
                          ]}
                        />
                      </CustomerDetailSection>

                      <CustomerDetailSection icon={<ShopOutlined />} title="所属客户">
                        <CustomerInfoGrid
                          columns={2}
                          items={[
                            { label: '客户名称', value: previewCustomer?.name },
                            {
                              label: '客户合作',
                              value: previewCustomerStatus ? <StatusTag toneMap={customerStatusTone} value={previewCustomerStatus} /> : '-'
                            },
                            { label: '主联系人', value: previewCustomerContact ? `${previewCustomerContact.name} / ${previewCustomerContact.role}` : '-' },
                            { label: '联系电话', value: previewCustomerContact?.phone },
                            { label: '微信', value: previewCustomerContact?.wechat }
                          ]}
                        />
                      </CustomerDetailSection>

                      <CustomerDetailSection icon={<ShopOutlined />} title="关联门店">
                        <BrandStoreTable rows={previewStoreRows} />
                      </CustomerDetailSection>
                    </>
                  )
                },
                {
                  key: 'task-configs',
                  label: '任务配置',
                  children: (
                    <>
                      <CustomerDetailSection icon={<AppstoreOutlined />} title="结算规则">
                        <CustomerInfoGrid
                          columns={2}
                          items={[
                            { label: '结算方式', value: previewSettlementPolicy?.mode ?? '-' },
                            {
                              label: previewSettlementPolicy?.mode === '按任务结算' ? '到期规则' : '月度到期日',
                              value:
                                previewSettlementPolicy?.mode === '按任务结算'
                                  ? `验收后 ${previewSettlementPolicy.perTaskDueDays ?? 0} 天`
                                  : previewSettlementPolicy
                                    ? `次月 ${previewSettlementPolicy.monthlyDueDay ?? 1} 日`
                                    : '-'
                            }
                          ]}
                        />
                      </CustomerDetailSection>

                      {previewContractUsageRows.length > 0 ? (
                        <CustomerDetailSection icon={<FileProtectOutlined />} title="合同额度">
                          <BrandContractUsageTable rows={previewContractUsageRows} />
                        </CustomerDetailSection>
                      ) : null}

                      <CustomerDetailSection icon={<AppstoreOutlined />} title="适用任务">
                        <BrandTaskConfigTable rows={previewTaskConfigRows} />
                      </CustomerDetailSection>
                    </>
                  )
                },
                {
                  key: 'acceptance-config',
                  label: '验收配置',
                  children: <BrandAcceptanceConfigPanel policy={previewAcceptancePolicy} />
                }
              ]}
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: cancelBrandDrawer }}
        layout="plain"
        open={brandFormDrawer.open}
        primaryAction={{
          disabled: !brandFormValid,
          label: '保存品牌',
          onClick: saveBrand
        }}
        title={
          brandDrawerMode ? (
            <CustomerDrawerTitle
              eyebrow="客户管理 / 品牌管理"
              title={brandDrawerMode === 'create' ? '新增品牌' : brandForm.name || editingBrand?.name || '编辑品牌'}
            />
          ) : null
        }
        width={840}
        onClose={cancelBrandDrawer}
      >
        <BrandDrawerSummary storeCount={editingBrand ? editingStoreRows.length : 0} taskCount={configuredTaskFormRows.length} />
        <DetailTabs
          tabTestIdPrefix="customer-brand-form-tab"
          testId="customer-brand-form-tabs"
          items={[
            {
              key: 'brand-profile',
              label: '品牌资料',
              children: (
                <>
                  <CustomerDetailSection icon={<AppstoreOutlined />} title="品牌资料">
                    <DrawerFormGrid>
                      <DrawerFormField label="品牌编号">
                        <Input disabled value={brandForm.code} />
                      </DrawerFormField>
                      <DrawerFormField label="品牌名称" required>
                        <Input value={brandForm.name} onChange={(event) => updateBrandForm('name', event.target.value)} />
                      </DrawerFormField>
                      <DrawerFormField label="所属客户" required>
                        <Select
                          value={brandForm.customerId}
                          options={customerRows.map((customer) => ({ label: customer.name, value: customer.id }))}
                          onChange={(customerId) =>
                            setBrandForm((current) => ({
                              ...current,
                              contactName: getDefaultBrandContactName(customerId, customerRows),
                              customerId
                            }))
                          }
                        />
                      </DrawerFormField>
                      <DrawerFormField label="客户联系人" required>
                        <Select value={brandForm.contactName} options={contactOptions} onChange={(contactName) => updateBrandForm('contactName', contactName)} />
                      </DrawerFormField>
                      <DrawerFormField label="备注" wide>
                        <Input.TextArea
                          autoSize={{ minRows: 3, maxRows: 5 }}
                          value={brandForm.note}
                          onChange={(event) => updateBrandForm('note', event.target.value)}
                        />
                      </DrawerFormField>
                    </DrawerFormGrid>
                  </CustomerDetailSection>

                  <CustomerDetailSection icon={<ShopOutlined />} title="所属客户">
                    <CustomerInfoGrid
                      columns={2}
                      items={[
                        { label: '客户名称', value: selectedCustomer?.name },
                        {
                          label: '客户合作',
                          value: selectedCustomerStatus ? <StatusTag toneMap={customerStatusTone} value={selectedCustomerStatus} /> : '-'
                        },
                        { label: '主联系人', value: selectedCustomerContact ? `${selectedCustomerContact.name} / ${selectedCustomerContact.role}` : '-' },
                        { label: '联系电话', value: selectedCustomerContact?.phone },
                        { label: '微信', value: selectedCustomerContact?.wechat }
                      ]}
                    />
                  </CustomerDetailSection>

                  <CustomerDetailSection icon={<ShopOutlined />} title="关联门店">
                    <BrandStoreTable emptyText="保存品牌后可关联门店。" rows={brandDrawerMode === 'edit' && editingBrand ? editingStoreRows : []} />
                  </CustomerDetailSection>
                </>
              )
            },
            {
              key: 'task-configs',
              label: '任务配置',
              children: (
                <>
                  <CustomerDetailSection icon={<AppstoreOutlined />} title="结算规则">
                    <DrawerFormGrid>
                      <DrawerFormField label="结算方式" required wide>
                        <Segmented
                          block
                          value={brandForm.settlementPolicy.mode}
                          options={['按任务结算', '按月汇总']}
                          onChange={(mode) =>
                            updateBrandForm(
                              'settlementPolicy',
                              mode === '按任务结算'
                                ? { mode: '按任务结算', perTaskDueDays: 30 }
                                : { mode: '按月汇总', monthlyDueDay: 15 }
                            )
                          }
                        />
                      </DrawerFormField>
                      {brandForm.settlementPolicy.mode === '按任务结算' ? (
                        <DrawerFormField label="甲方验收后到期天数" required>
                          <InputNumber
                            min={0}
                            precision={0}
                            value={brandForm.settlementPolicy.perTaskDueDays}
                            onChange={(perTaskDueDays) =>
                              updateBrandForm('settlementPolicy', {
                                mode: '按任务结算',
                                perTaskDueDays: perTaskDueDays ?? 0
                              })
                            }
                          />
                        </DrawerFormField>
                      ) : (
                        <DrawerFormField label="次月到期日" required>
                          <InputNumber
                            min={1}
                            max={31}
                            precision={0}
                            value={brandForm.settlementPolicy.monthlyDueDay}
                            onChange={(monthlyDueDay) =>
                              updateBrandForm('settlementPolicy', {
                                mode: '按月汇总',
                                monthlyDueDay: monthlyDueDay ?? 1
                              })
                            }
                          />
                        </DrawerFormField>
                      )}
                    </DrawerFormGrid>
                  </CustomerDetailSection>

                  <CustomerDetailSection icon={<AppstoreOutlined />} title="适用任务">
                    <BrandTaskConfigEditor
                      addableTaskConfigs={addableTaskConfigs}
                      eligibleContracts={eligibleContracts}
                      rows={configuredTaskFormRows}
                      selectedTaskConfigId={taskConfigIdToAdd}
                      taskConfigRows={taskConfigRows}
                      onAdd={addBrandTaskConfig}
                      onPricingChange={updateTaskPricing}
                      onRemove={removeBrandTaskConfig}
                      onSelectTaskConfig={setTaskConfigIdToAdd}
                    />
                  </CustomerDetailSection>
                </>
              )
            },
            {
              key: 'acceptance-config',
              label: '验收配置',
              children: (
                <BrandAcceptanceConfigPanel
                  editable
                  policy={brandForm.acceptancePolicy}
                  onChange={(acceptancePolicy) => updateBrandForm('acceptancePolicy', acceptancePolicy)}
                />
              )
            }
          ]}
        />
      </DrawerFormShell>
    </ManagementPageScaffold>
  );
}
