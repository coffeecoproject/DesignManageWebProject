import { getPrimaryCustomerContact, type BrandRecord, type CustomerRecord } from './customerData';
import { CustomerInfoGrid } from './CustomerShared';

export function StoreRelationInfoGrid({
  brand,
  customer
}: {
  brand: BrandRecord | undefined;
  customer: CustomerRecord | undefined;
}) {
  const contact = customer ? getPrimaryCustomerContact(customer) : undefined;

  return (
    <CustomerInfoGrid
      columns={2}
      items={[
        { label: '所属客户', value: customer?.name },
        { label: '客户编号', value: customer?.code },
        { label: '所属品牌', value: brand?.name },
        { label: '品牌编号', value: brand?.code },
        { label: '主联系人', value: contact ? `${contact.name} / ${contact.role}` : '-' },
        { label: '联系电话', value: contact?.phone }
      ]}
    />
  );
}
