import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { StatusTag } from '../../components/Detail';
import { TagChip } from '../../components/TagChip';
import { CellText } from '../../components/TableCell';
import type { BrandRecord, CustomerContactRecord } from './customerData';
import type { CustomerContactEditorField, CustomerContactForm } from './customerArchiveFormModel';
import { brandStatusTone, CustomerCodeCell } from './CustomerShared';

const customerContactColumns: TableColumnsType<CustomerContactRecord> = [
  {
    title: '标识',
    key: 'primary',
    align: 'center',
    width: 100,
    render: (_, record) => (
      record.primary ? <TagChip label="主联系人" /> : <CellText tone="subtle">联系人</CellText>
    )
  },
  {
    title: '联系人',
    dataIndex: 'name',
    align: 'center',
    width: 120,
    render: (name: string) => <CellText>{name}</CellText>
  },
  {
    title: '岗位',
    dataIndex: 'role',
    align: 'center',
    width: 130
  },
  {
    title: '手机号',
    dataIndex: 'phone',
    align: 'center',
    width: 130
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    align: 'center',
    width: 190
  },
  {
    title: '微信',
    dataIndex: 'wechat',
    align: 'center',
    width: 140
  },
  {
    title: '备注',
    dataIndex: 'note',
    align: 'center',
    width: 190,
    render: (note?: string) => <span className="detail-table-sub">{note || '-'}</span>
  }
];

export function CustomerContactTable({ contacts }: { contacts: CustomerContactRecord[] }) {
  return (
    <CompactDetailTable<CustomerContactRecord>
      className="customer-contact-table"
      columns={customerContactColumns}
      dataSource={contacts}
      rowKey="id"
      scrollX={1000}
    />
  );
}

export function CustomerBrandTable({
  brands,
  getBrandStoreCount
}: {
  brands: BrandRecord[];
  getBrandStoreCount: (brandId: string) => number;
}) {
  const brandColumns: TableColumnsType<BrandRecord> = [
    {
      title: '品牌',
      key: 'brand',
      align: 'left',
      width: 260,
      render: (_, record) => <CustomerCodeCell code={record.code} name={record.name} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 100,
      render: (status: BrandRecord['status']) => <StatusTag toneMap={brandStatusTone} value={status} />
    },
    {
      title: '门店',
      dataIndex: 'storeCount',
      align: 'center',
      width: 90,
      render: (_, record) => `${getBrandStoreCount(record.id)} 个`
    }
  ];

  return (
    <CompactDetailTable<BrandRecord>
      className="customer-brand-table"
      columns={brandColumns}
      dataSource={brands}
      rowKey="id"
      scrollX={520}
    />
  );
}

function ContactEditorInput({
  field,
  placeholder,
  record,
  onChange
}: {
  field: CustomerContactEditorField;
  placeholder: string;
  record: CustomerContactForm;
  onChange: <K extends CustomerContactEditorField>(contactId: string, field: K, value: CustomerContactForm[K]) => void;
}) {
  return (
    <Input
      className="contact-editor-input"
      placeholder={placeholder}
      value={record[field]}
      onChange={(event) => onChange(record.id, field, event.target.value)}
    />
  );
}

export function CustomerContactEditorTable({
  contacts,
  onAdd,
  onChange,
  onRemove,
  onSetPrimary
}: {
  contacts: CustomerContactForm[];
  onAdd: () => void;
  onChange: <K extends CustomerContactEditorField>(contactId: string, field: K, value: CustomerContactForm[K]) => void;
  onRemove: (contactId: string) => void;
  onSetPrimary: (contactId: string) => void;
}) {
  const contactColumns: TableColumnsType<CustomerContactForm> = [
    {
      title: '标识',
      key: 'primary',
      align: 'center',
      width: 104,
      render: (_, record) =>
        record.primary ? (
          <TagChip label="主联系人" tone="green" />
        ) : (
          <Button size="small" onClick={() => onSetPrimary(record.id)}>
            设为主
          </Button>
        )
    },
    {
      title: '联系人 *',
      key: 'name',
      width: 136,
      render: (_, record) => <ContactEditorInput field="name" placeholder="姓名" record={record} onChange={onChange} />
    },
    {
      title: '岗位 *',
      key: 'role',
      width: 140,
      render: (_, record) => <ContactEditorInput field="role" placeholder="岗位" record={record} onChange={onChange} />
    },
    {
      title: '手机号 *',
      key: 'phone',
      width: 142,
      render: (_, record) => <ContactEditorInput field="phone" placeholder="手机号" record={record} onChange={onChange} />
    },
    {
      title: '邮箱 *',
      key: 'email',
      width: 190,
      render: (_, record) => <ContactEditorInput field="email" placeholder="邮箱" record={record} onChange={onChange} />
    },
    {
      title: '微信 *',
      key: 'wechat',
      width: 150,
      render: (_, record) => <ContactEditorInput field="wechat" placeholder="微信" record={record} onChange={onChange} />
    },
    {
      title: '备注',
      key: 'note',
      width: 180,
      render: (_, record) => <ContactEditorInput field="note" placeholder="备注" record={record} onChange={onChange} />
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 86,
      render: (_, record) => (
        <Button
          danger
          disabled={contacts.length === 1}
          icon={<DeleteOutlined />}
          size="small"
          type="text"
          onClick={() => onRemove(record.id)}
        >
          删除
        </Button>
      )
    }
  ];

  return (
    <>
      <div className="contact-editor-toolbar">
        <span className="detail-table-sub">共 {contacts.length} 位联系人</span>
        <Button icon={<PlusOutlined />} onClick={onAdd}>
          新增联系人
        </Button>
      </div>
      <CompactDetailTable<CustomerContactForm>
        className="contact-editor-table"
        columns={contactColumns}
        dataSource={contacts}
        rowKey="id"
        scrollX={1118}
      />
    </>
  );
}
