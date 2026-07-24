import {
  AppstoreOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  HomeOutlined,
  ProfileOutlined,
  ShopOutlined
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import type { StatusTagTone } from '../../components/Detail';
import { TagChipList, type TagChipTone } from '../../components/TagChip';
import { CompactCell } from '../../components/TableCell';
import type { BrandStatus, CustomerContractStatus, CustomerStatus, StoreStatus } from './customerData';

export { MetricCard as CustomerMetricCard } from '../../components/MetricCard';

export const customerStatusTone = {
  合作中: 'green',
  待签约: 'amber',
  已到期: 'gray',
  已终止: 'gray',
  无合同: 'blue'
} satisfies Record<CustomerStatus, StatusTagTone>;

export const brandStatusTone = {
  启用: 'green',
  暂停: 'amber',
  停用: 'gray'
} satisfies Record<BrandStatus, StatusTagTone>;

export const storeStatusTone = {
  筹备中: 'blue',
  营业中: 'green',
  暂停: 'amber',
  闭店: 'gray'
} satisfies Record<StoreStatus, StatusTagTone>;

export const customerContractStatusTone = {
  有效: 'green',
  已到期: 'gray',
  已终止: 'gray'
} satisfies Record<CustomerContractStatus, StatusTagTone>;

export const customerMetricIcons = {
  active: <CheckCircleOutlined />,
  brand: <AppstoreOutlined />,
  contract: <FileProtectOutlined />,
  customer: <ShopOutlined />,
  pending: <ClockCircleOutlined />,
  store: <HomeOutlined />
};

export const CustomerDetailSection = DetailSection;
export const CustomerInfoGrid = DetailInfoGrid;

export function CustomerDrawerTitle({
  eyebrow,
  status,
  statusTone,
  title
}: {
  eyebrow: string;
  status?: ReactNode;
  statusTone?: StatusTagTone;
  title: string;
}) {
  return <DetailDrawerTitle eyebrow={eyebrow} status={status} statusTone={statusTone} title={title} />;
}

export function CustomerTagList({
  items,
  maxVisible = 2,
  tone = 'blue'
}: {
  items: string[];
  maxVisible?: number;
  tone?: TagChipTone;
}) {
  return <TagChipList items={items} maxVisible={maxVisible} tone={tone} wrap />;
}

export function CustomerCodeCell({ code, name }: { code: string; name: string }) {
  return <CompactCell primary={name} secondary={code} />;
}

export function CustomerSubjectCell({
  code,
  name,
  subtitle
}: {
  code: string;
  name: string;
  subtitle: string;
}) {
  return <CompactCell primary={name} secondary={`${code} / ${subtitle}`} />;
}

export const customerDetailIcons = {
  brand: <AppstoreOutlined />,
  contact: <BankOutlined />,
  profile: <ProfileOutlined />,
  store: <HomeOutlined />
};
