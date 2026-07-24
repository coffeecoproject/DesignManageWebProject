import {
  AppstoreOutlined,
  PhoneOutlined,
  PlusOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { Input, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { StatusTag } from '../../components/Detail';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useDrawerFormState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricGrid } from '../../components/MetricGrid';
import { CompactCell } from '../../components/TableCell';
import {
  CustomerBrandTable,
  CustomerContactEditorTable,
  CustomerContactTable
} from './CustomerArchiveTables';
import {
  addCustomerContact,
  buildCustomerForm,
  buildCustomerRecordForSave,
  createDefaultCustomerForm,
  isCustomerFormValid,
  removeCustomerContact,
  setPrimaryCustomerContact,
  updateCustomerContact,
  type CustomerContactEditorField,
  type CustomerContactForm,
  type CustomerForm
} from './customerArchiveFormModel';
import {
  getPrimaryCustomerContact,
  type CustomerRecord,
  type CustomerStatus
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

type CustomerArchiveFilters = {
  keyword: string;
  status: '全部' | CustomerStatus;
};

const defaultFilters: CustomerArchiveFilters = {
  keyword: '',
  status: '全部'
};

function matchesCustomerKeyword(record: CustomerRecord, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  const contactsText = record.contacts
    .flatMap((contact) => [contact.name, contact.role, contact.phone, contact.email, contact.wechat])
    .join(' ');

  return [record.name, record.code, contactsText, record.owner]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

export function CustomerArchivePage() {
  const [filters, setFilters] = useState<CustomerArchiveFilters>(defaultFilters);
  const {
    brandRows,
    customerRows,
    storeRows,
    deriveCustomerStatus,
    getBrandStoreCount,
    getCustomerBrandCount,
    getCustomerStoreCount,
    saveCustomer: saveCustomerRecord
  } = useCustomerManagementState();
  const [activeCustomer, setActiveCustomer] = useState<CustomerRecord>();
  const [messageApi, contextHolder] = message.useMessage();
  const customerFormDrawer = useDrawerFormState<CustomerRecord, CustomerForm>({
    createForm: createDefaultCustomerForm,
    editForm: buildCustomerForm,
    onCancelEdit: setActiveCustomer
  });
  const customerDrawerMode = customerFormDrawer.mode;
  const editingCustomer = customerFormDrawer.record;
  const customerForm = customerFormDrawer.form;
  const setCustomerForm = customerFormDrawer.setForm;
  const updateCustomerForm = customerFormDrawer.updateForm;
  const rows = useMemo(
    () =>
      customerRows.filter((record) => {
        const customerStatus = deriveCustomerStatus(record.id);
        const statusMatched = filters.status === '全部' || customerStatus === filters.status;
        return statusMatched && matchesCustomerKeyword(record, filters.keyword);
      }),
    [customerRows, deriveCustomerStatus, filters.keyword, filters.status]
  );
  const activeBrandRows = activeCustomer ? brandRows.filter((brand) => brand.customerId === activeCustomer.id) : [];
  const customerStoreCount = activeCustomer ? getCustomerStoreCount(activeCustomer.id) : 0;
  const activeCustomerStatus = activeCustomer ? deriveCustomerStatus(activeCustomer.id) : undefined;
  const customerFormValid = isCustomerFormValid(customerForm);

  function openCreateDrawer() {
    setActiveCustomer(undefined);
    customerFormDrawer.openCreate();
  }

  function openEditCustomerDrawer(record: CustomerRecord) {
    setActiveCustomer(undefined);
    customerFormDrawer.openEdit(record);
  }

  function closeCustomerDrawer() {
    customerFormDrawer.close();
  }

  function cancelCustomerDrawer() {
    customerFormDrawer.cancel();
  }

  function addCreateContact() {
    setCustomerForm(addCustomerContact);
  }

  function updateCreateContact<K extends CustomerContactEditorField>(
    contactId: string,
    field: K,
    value: CustomerContactForm[K]
  ) {
    setCustomerForm((current) => updateCustomerContact(current, contactId, field, value));
  }

  function setPrimaryCreateContact(contactId: string) {
    setCustomerForm((current) => setPrimaryCustomerContact(current, contactId));
  }

  function removeCreateContact(contactId: string) {
    setCustomerForm((current) => removeCustomerContact(current, contactId));
  }

  function saveCustomer() {
    if (!customerFormValid) {
      return;
    }

    const isEditing = customerDrawerMode === 'edit' && Boolean(editingCustomer);
    const nextCustomer = buildCustomerRecordForSave({
      customerRows,
      editingCustomer: isEditing ? editingCustomer : undefined,
      form: customerForm
    });

    saveCustomerRecord(nextCustomer);
    setActiveCustomer(nextCustomer);
    closeCustomerDrawer();
    void messageApi.success(isEditing ? '已保存客户' : '已新增客户档案');
  }

  const columns: TableColumnsType<CustomerRecord> = [
    {
      title: '客户',
      key: 'customer',
      width: 230,
      render: (_, record) => <CustomerCodeCell code={record.code} name={record.name} />
    },
    {
      title: '合作状态',
      key: 'status',
      align: 'center',
      width: 100,
      render: (_, record) => {
        const status = deriveCustomerStatus(record.id);
        return <StatusTag toneMap={customerStatusTone} value={status} />;
      }
    },
    {
      title: '联系人',
      key: 'contact',
      width: 170,
      render: (_, record) => {
        const primaryContact = getPrimaryCustomerContact(record);

        return (
          <CompactCell
            primary={`${primaryContact?.name ?? '-'}${primaryContact ? ` / ${primaryContact.role}` : ''}`}
            secondary={`${primaryContact?.phone ?? '-'}${record.contacts.length > 1 ? `  +${record.contacts.length - 1} 位` : ''}`}
          />
        );
      }
    },
    {
      title: '所属行业',
      dataIndex: 'industry',
      width: 150
    },
    {
      title: '品牌',
      dataIndex: 'brandCount',
      align: 'center',
      width: 78,
      render: (_, record) => `${getCustomerBrandCount(record.id)} 个`
    },
    {
      title: '门店',
      dataIndex: 'storeCount',
      align: 'center',
      width: 78,
      render: (_, record) => `${getCustomerStoreCount(record.id)} 个`
    },
    {
      title: '对接人',
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
          <CustomerMetricCard label="客户总数" value={customerRows.length} icon={customerMetricIcons.customer} />
          <CustomerMetricCard
            label="合作中"
            value={customerRows.filter((record) => deriveCustomerStatus(record.id) === '合作中').length}
            icon={customerMetricIcons.active}
          />
          <CustomerMetricCard label="品牌数量" value={brandRows.length} icon={customerMetricIcons.brand} />
          <CustomerMetricCard label="门店数量" value={storeRows.length} icon={customerMetricIcons.store} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="合作状态">
              <Select
                value={filters.status}
                options={(['全部', '合作中', '待签约', '已到期', '已终止', '无合同'] satisfies CustomerArchiveFilters['status'][]).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              placeholder="客户 / 联系人 / 手机 / 邮箱"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTable<CustomerRecord>
        columns={columns}
        count={{ value: rows.length, unit: '个客户' }}
        dataSource={rows}
        primaryAction={{ icon: <PlusOutlined />, label: '新增客户', onClick: openCreateDrawer }}
        rowTestIdPrefix="customer-archive-table-row"
        rowKey="id"
        tableTestId="customer-archive-table"
        onRowClick={setActiveCustomer}
      />

      <DetailDrawerShell
        className="customer-archive-drawer"
        closeAction={{ label: '关闭', onClick: () => setActiveCustomer(undefined) }}
        open={Boolean(activeCustomer)}
        primaryAction={
          activeCustomer
            ? {
                label: '编辑客户',
                onClick: () => openEditCustomerDrawer(activeCustomer)
              }
            : undefined
        }
        title={
          activeCustomer ? (
            <CustomerDrawerTitle
              eyebrow="客户管理 / 客户档案"
              status={activeCustomerStatus}
              statusTone={activeCustomerStatus ? customerStatusTone[activeCustomerStatus] : undefined}
              title={activeCustomer.name}
            />
          ) : null
        }
        width={860}
        onClose={() => setActiveCustomer(undefined)}
      >
        {activeCustomer ? (
          <>
            <CustomerDetailSection icon={<ProfileOutlined />} title="客户资料">
              <CustomerInfoGrid
                columns={2}
                items={[
                  { label: '客户编号', value: activeCustomer.code },
                  { label: '所属行业', value: activeCustomer.industry },
                  { label: '纳税人识别号', value: activeCustomer.taxpayerIdentificationNo },
                  {
                    label: '合作状态',
                    value: activeCustomerStatus ? <StatusTag toneMap={customerStatusTone} value={activeCustomerStatus} /> : '-'
                  },
                  { label: '内部对接人', value: activeCustomer.owner },
                  { label: '品牌数量', value: `${getCustomerBrandCount(activeCustomer.id)} 个` },
                  { label: '门店数量', value: `${customerStoreCount} 个` },
                  { label: '备注', value: activeCustomer.note, wide: true }
                ]}
              />
            </CustomerDetailSection>

            <CustomerDetailSection icon={<PhoneOutlined />} title="联系人">
              <CustomerContactTable contacts={activeCustomer.contacts} />
            </CustomerDetailSection>

            <CustomerDetailSection icon={<AppstoreOutlined />} title="关联品牌">
              <CustomerBrandTable brands={activeBrandRows} getBrandStoreCount={getBrandStoreCount} />
            </CustomerDetailSection>
          </>
        ) : null}
      </DetailDrawerShell>

      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: cancelCustomerDrawer }}
        className="customer-archive-drawer"
        open={customerFormDrawer.open}
        primaryAction={{
          disabled: !customerFormValid,
          label: customerDrawerMode === 'create' ? '保存客户' : '保存修改',
          onClick: saveCustomer
        }}
        title={
          customerDrawerMode ? (
            <CustomerDrawerTitle
              eyebrow="客户管理 / 客户档案"
              title={customerDrawerMode === 'create' ? '新增客户' : customerForm.name || editingCustomer?.name || '编辑客户'}
            />
          ) : null
        }
        width={940}
        onClose={cancelCustomerDrawer}
      >
        <CustomerDetailSection icon={<ProfileOutlined />} title="客户资料">
          <DrawerFormGrid>
            <DrawerFormField label="客户名称" required>
              <Input value={customerForm.name} onChange={(event) => updateCustomerForm('name', event.target.value)} />
            </DrawerFormField>
            <DrawerFormField label="所属行业" required>
              <Input value={customerForm.industry} onChange={(event) => updateCustomerForm('industry', event.target.value)} />
            </DrawerFormField>
            <DrawerFormField label="纳税人识别号" required>
              <Input
                value={customerForm.taxpayerIdentificationNo}
                onChange={(event) => updateCustomerForm('taxpayerIdentificationNo', event.target.value)}
              />
            </DrawerFormField>
            <DrawerFormField label="内部对接人" required>
              <Input value={customerForm.owner} onChange={(event) => updateCustomerForm('owner', event.target.value)} />
            </DrawerFormField>
            <DrawerFormField label="备注" wide>
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 5 }}
                value={customerForm.note}
                onChange={(event) => updateCustomerForm('note', event.target.value)}
              />
            </DrawerFormField>
          </DrawerFormGrid>
        </CustomerDetailSection>

        <CustomerDetailSection icon={<PhoneOutlined />} title="联系人">
          <CustomerContactEditorTable
            contacts={customerForm.contacts}
            onAdd={addCreateContact}
            onChange={updateCreateContact}
            onRemove={removeCreateContact}
            onSetPrimary={setPrimaryCreateContact}
          />
        </CustomerDetailSection>
      </DrawerFormShell>
    </ManagementPageScaffold>
  );
}
