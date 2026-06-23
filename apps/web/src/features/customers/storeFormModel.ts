import type { BrandRecord, CustomerRecord, StoreRecord } from './customerData';

export type StoreForm = {
  address: string;
  brandId: string;
  city: string;
  code: string;
  name: string;
  province: string;
};

type BuildStoreRecordInput = {
  brand: BrandRecord | undefined;
  editingStore?: StoreRecord | undefined;
  form: StoreForm;
  updatedAt?: string;
};

export function getStoreRegion(record: StoreRecord) {
  return `${record.province} / ${record.city}`;
}

export function matchesStoreKeyword(record: StoreRecord, keyword: string, brands: BrandRecord[], customers: CustomerRecord[]) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  const brand = brands.find((currentBrand) => currentBrand.id === record.brandId);
  const customer = customers.find((currentCustomer) => currentCustomer.id === record.customerId);
  return [record.name, record.code, record.address, brand?.name, customer?.name]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

function getNextStoreCode(records: StoreRecord[]) {
  const maxSequence = records.reduce((max, record) => {
    const match = record.code.match(/^STR-2026-(\d+)$/);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `STR-2026-${String(maxSequence + 1).padStart(3, '0')}`;
}

export function buildStoreForm(record: StoreRecord): StoreForm {
  return {
    address: record.address,
    brandId: record.brandId,
    city: record.city,
    code: record.code,
    name: record.name,
    province: record.province
  };
}

export function buildDefaultStoreForm(brands: BrandRecord[], stores: StoreRecord[]): StoreForm {
  return {
    address: '',
    brandId: brands[0]?.id ?? '',
    city: '',
    code: getNextStoreCode(stores),
    name: '',
    province: ''
  };
}

export function isStoreFormValid(form: StoreForm) {
  return Boolean(form.brandId && form.name.trim() && form.province.trim() && form.city.trim() && form.address.trim());
}

export function buildStoreRecordForSave({
  brand,
  editingStore,
  form,
  updatedAt = '2026-06-14'
}: BuildStoreRecordInput): StoreRecord | undefined {
  if (!brand) {
    return undefined;
  }

  const normalizedForm = {
    address: form.address.trim(),
    brandId: form.brandId,
    city: form.city.trim(),
    customerId: brand.customerId,
    name: form.name.trim(),
    openedAt: editingStore?.openedAt ?? '',
    province: form.province.trim(),
    status: editingStore?.status ?? '营业中'
  } satisfies Pick<StoreRecord, 'address' | 'brandId' | 'city' | 'customerId' | 'name' | 'openedAt' | 'province' | 'status'>;

  if (editingStore) {
    return {
      ...editingStore,
      ...normalizedForm,
      updatedAt
    };
  }

  return {
    id: `store-${form.code.toLowerCase()}`,
    code: form.code,
    updatedAt,
    ...normalizedForm
  };
}
