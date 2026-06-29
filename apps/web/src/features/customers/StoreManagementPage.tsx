import {
  AppstoreOutlined,
  HomeOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Input, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useDrawerFormState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricGrid } from '../../components/MetricGrid';
import {
  RegionSearchSelect,
  getRegionCityLabel,
  getRegionDisplayLabel,
  getRegionOptionsFromPaths,
  getRegionPath,
  getRegionProvince,
  type RegionPath
} from '../../components/RegionSearchSelect';
import type { StoreRecord } from './customerData';
import { useCustomerManagementState } from './CustomerManagementState';
import {
  CustomerCodeCell,
  CustomerDetailSection,
  CustomerDrawerTitle,
  CustomerInfoGrid,
  CustomerMetricCard,
  customerMetricIcons
} from './CustomerShared';
import {
  buildDefaultStoreForm,
  buildStoreForm,
  buildStoreRecordForSave,
  getStoreRegion,
  isStoreFormValid,
  matchesStoreKeyword,
  type StoreForm
} from './storeFormModel';
import { StoreRelationInfoGrid } from './StoreRelationInfoGrid';

type StoreFilters = {
  brandId: '全部' | string;
  keyword: string;
  regionPath: RegionPath;
};

const defaultFilters: StoreFilters = {
  brandId: '全部',
  keyword: '',
  regionPath: []
};

export function StoreManagementPage() {
  const [filters, setFilters] = useState<StoreFilters>(defaultFilters);
  const {
    brandRows,
    customerRows,
    storeRows,
    getBrandById,
    getCustomerById,
    saveStore: saveStoreRecord
  } = useCustomerManagementState();
  const [activeStore, setActiveStore] = useState<StoreRecord>();
  const [messageApi, contextHolder] = message.useMessage();
  const storeFormDrawer = useDrawerFormState<StoreRecord, StoreForm>({
    createForm: () => buildDefaultStoreForm(brandRows, storeRows),
    editForm: buildStoreForm,
    onCancelEdit: setActiveStore
  });
  const storeDrawerMode = storeFormDrawer.mode;
  const editingStore = storeFormDrawer.record;
  const storeForm = storeFormDrawer.form;
  const setStoreForm = storeFormDrawer.setForm;
  const updateStoreForm = storeFormDrawer.updateForm;
  const storeRegionCount = useMemo(() => new Set(storeRows.map(getStoreRegion)).size, [storeRows]);
  const regionFilterOptions = useMemo(
    () => getRegionOptionsFromPaths(storeRows.map((record) => getRegionPath(record.province, record.city))),
    [storeRows]
  );
  const selectedRegionLabel = getRegionDisplayLabel(filters.regionPath);
  const rows = useMemo(
    () =>
      storeRows.filter((record) => {
        const brandMatched = filters.brandId === '全部' || record.brandId === filters.brandId;
        const regionMatched = !selectedRegionLabel || getStoreRegion(record) === selectedRegionLabel;
        return brandMatched && regionMatched && matchesStoreKeyword(record, filters.keyword, brandRows, customerRows);
      }),
    [brandRows, customerRows, filters.brandId, filters.keyword, selectedRegionLabel, storeRows]
  );
  const previewBrand = activeStore ? getBrandById(activeStore.brandId) : undefined;
  const previewCustomer = activeStore ? getCustomerById(activeStore.customerId) : undefined;
  const selectedBrand = getBrandById(storeForm.brandId);
  const selectedCustomer = selectedBrand ? getCustomerById(selectedBrand.customerId) : undefined;
  const storeFormValid = isStoreFormValid(storeForm);

  function openCreateStoreDrawer() {
    setActiveStore(undefined);
    storeFormDrawer.openCreate();
  }

  function openEditStoreDrawer(record: StoreRecord) {
    setActiveStore(undefined);
    storeFormDrawer.openEdit(record);
  }

  function closeStoreDrawer() {
    storeFormDrawer.close();
  }

  function cancelStoreDrawer() {
    storeFormDrawer.cancel();
  }

  function saveStore() {
    if (!storeFormValid) {
      return;
    }

    if (storeDrawerMode === 'edit' && !editingStore) {
      return;
    }

    const nextStore = buildStoreRecordForSave({
      brand: getBrandById(storeForm.brandId),
      editingStore,
      form: storeForm
    });

    if (!nextStore) {
      return;
    }

    saveStoreRecord(nextStore);
    setActiveStore(nextStore);
    closeStoreDrawer();
    void messageApi.success(storeDrawerMode === 'create' ? '已新增门店' : '已保存门店');
  }

  function handleStoreRegionChange(regionPath: string[]) {
    setStoreForm((currentForm) => ({
      ...currentForm,
      city: getRegionCityLabel(regionPath),
      province: getRegionProvince(regionPath)
    }));
  }

  const columns: TableColumnsType<StoreRecord> = [
    {
      title: '门店',
      key: 'store',
      width: 210,
      render: (_, record) => <CustomerCodeCell code={record.code} name={record.name} />
    },
    {
      title: '所属品牌',
      key: 'brand',
      width: 160,
      render: (_, record) => getBrandById(record.brandId)?.name ?? '-'
    },
    {
      title: '所属客户',
      key: 'customer',
      width: 210,
      render: (_, record) => getCustomerById(record.customerId)?.name ?? '-'
    },
    {
      title: '省市',
      key: 'region',
      align: 'center',
      width: 140,
      render: (_, record) => getStoreRegion(record)
    },
    {
      title: '地址',
      dataIndex: 'address',
      width: 220
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
          <CustomerMetricCard label="门店数量" value={storeRows.length} icon={customerMetricIcons.store} />
          <CustomerMetricCard label="关联品牌" value={new Set(storeRows.map((record) => record.brandId)).size} icon={customerMetricIcons.brand} />
          <CustomerMetricCard label="覆盖省市" value={storeRegionCount} icon={customerMetricIcons.brand} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="所属品牌">
              <Select
                value={filters.brandId}
                options={[
                  { label: '全部', value: '全部' },
                  ...brandRows.map((brand) => ({ label: brand.name, value: brand.id }))
                ]}
                onChange={(brandId) => setFilters((current) => ({ ...current, brandId }))}
              />
            </FilterField>
            <FilterField as="div" controlWidth="wide-select" label="省市">
              <RegionSearchSelect
                allowAll
                options={regionFilterOptions}
                placeholder="全部"
                value={filters.regionPath}
                onChange={(regionPath) => setFilters((current) => ({ ...current, regionPath }))}
              />
            </FilterField>
            <KeywordFilter
              placeholder="门店 / 品牌 / 客户"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTable<StoreRecord>
        columns={columns}
        count={{ value: rows.length, unit: '个门店' }}
        dataSource={rows}
        primaryAction={{ icon: <PlusOutlined />, label: '新增门店', onClick: openCreateStoreDrawer }}
        rowTestIdPrefix="customer-store-table-row"
        rowKey="id"
        tableTestId="customer-store-table"
        onRowClick={setActiveStore}
      />

      <DetailDrawerShell
        closeAction={{ label: '关闭', onClick: () => setActiveStore(undefined) }}
        open={Boolean(activeStore)}
        primaryAction={
          activeStore
            ? {
                label: '编辑门店',
                onClick: () => openEditStoreDrawer(activeStore)
              }
            : undefined
        }
        title={
          activeStore ? (
            <CustomerDrawerTitle eyebrow="客户管理 / 门店管理" title={activeStore.name} />
          ) : null
        }
        width={820}
        onClose={() => setActiveStore(undefined)}
      >
        {activeStore ? (
          <>
            <DetailTabs
              defaultActiveKey="profile"
              tabTestIdPrefix="customer-store-detail-tab"
              testId="customer-store-detail-tabs"
              items={[
                {
                  key: 'profile',
                  label: '门店资料',
                  children: (
                    <CustomerDetailSection icon={<HomeOutlined />} title="门店资料">
                      <CustomerInfoGrid
                        columns={2}
                        items={[
                          { label: '门店编号', value: activeStore.code },
                          { label: '门店名称', value: activeStore.name },
                          { label: '省市', value: getStoreRegion(activeStore) },
                          { label: '最近更新', value: activeStore.updatedAt },
                          { label: '地址', value: activeStore.address, wide: true }
                        ]}
                      />
                    </CustomerDetailSection>
                  )
                },
                {
                  key: 'relation',
                  label: '归属关系',
                  children: (
                    <CustomerDetailSection icon={<AppstoreOutlined />} title="归属关系">
                      <StoreRelationInfoGrid brand={previewBrand} customer={previewCustomer} />
                    </CustomerDetailSection>
                  )
                }
              ]}
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: cancelStoreDrawer }}
        open={storeFormDrawer.open}
        primaryAction={{
          disabled: !storeFormValid,
          label: '保存门店',
          onClick: saveStore
        }}
        title={
          storeDrawerMode ? (
            <CustomerDrawerTitle
              eyebrow="客户管理 / 门店管理"
              title={storeDrawerMode === 'create' ? '新增门店' : storeForm.name || editingStore?.name || '编辑门店'}
            />
          ) : null
        }
        width={820}
        onClose={cancelStoreDrawer}
      >
        <DetailTabs
          defaultActiveKey="profile"
          tabTestIdPrefix="customer-store-form-tab"
          testId="customer-store-form-tabs"
          items={[
            {
              key: 'profile',
              label: '门店资料',
              children: (
                <CustomerDetailSection icon={<HomeOutlined />} title="门店资料">
                  <DrawerFormGrid>
                    <DrawerFormField label="门店编号">
                      <Input disabled value={storeForm.code} />
                    </DrawerFormField>
                    <DrawerFormField label="门店名称" required>
                      <Input value={storeForm.name} onChange={(event) => updateStoreForm('name', event.target.value)} />
                    </DrawerFormField>
                    <DrawerFormField label="所属品牌" required>
                      <Select
                        value={storeForm.brandId}
                        options={brandRows.map((brand) => ({ label: brand.name, value: brand.id }))}
                        onChange={(brandId) => updateStoreForm('brandId', brandId)}
                      />
                    </DrawerFormField>
                    <DrawerFormField label="所在省市" required>
                      <RegionSearchSelect
                        placeholder="选择省市"
                        value={getRegionPath(storeForm.province, storeForm.city)}
                        onChange={handleStoreRegionChange}
                      />
                    </DrawerFormField>
                    <DrawerFormField label="地址" required wide>
                      <Input value={storeForm.address} onChange={(event) => updateStoreForm('address', event.target.value)} />
                    </DrawerFormField>
                  </DrawerFormGrid>
                </CustomerDetailSection>
              )
            },
            {
              key: 'relation',
              label: '归属关系',
              children: (
                <CustomerDetailSection icon={<AppstoreOutlined />} title="归属关系">
                  <StoreRelationInfoGrid brand={selectedBrand} customer={selectedCustomer} />
                </CustomerDetailSection>
              )
            }
          ]}
        />
      </DrawerFormShell>
    </ManagementPageScaffold>
  );
}
