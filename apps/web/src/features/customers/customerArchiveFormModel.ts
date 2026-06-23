import type { CustomerContactRecord, CustomerRecord } from './customerData';

export type CustomerContactForm = {
  email: string;
  id: string;
  name: string;
  note: string;
  phone: string;
  primary: boolean;
  role: string;
  wechat: string;
};

export type CustomerContactEditorField = Exclude<keyof CustomerContactForm, 'id' | 'primary'>;

export type CustomerForm = {
  contacts: CustomerContactForm[];
  industry: string;
  name: string;
  note: string;
  owner: string;
};

type BuildCustomerRecordInput = {
  customerRows: CustomerRecord[];
  editingCustomer?: CustomerRecord | undefined;
  form: CustomerForm;
  updatedAt?: string;
};

let contactDraftSequence = 0;

function createBlankContact(index: number): CustomerContactForm {
  contactDraftSequence += 1;

  return {
    email: '',
    id: `contact-draft-${contactDraftSequence}`,
    name: '',
    note: '',
    phone: '',
    primary: index === 1,
    role: '',
    wechat: ''
  };
}

export function createDefaultCustomerForm(): CustomerForm {
  return {
    contacts: [createBlankContact(1)],
    industry: '',
    name: '',
    note: '',
    owner: '李明'
  };
}

export function buildCustomerForm(record: CustomerRecord): CustomerForm {
  return {
    contacts: record.contacts.map((contact) => ({
      email: contact.email,
      id: contact.id,
      name: contact.name,
      note: contact.note ?? '',
      phone: contact.phone,
      primary: Boolean(contact.primary),
      role: contact.role,
      wechat: contact.wechat
    })),
    industry: record.industry,
    name: record.name,
    note: record.note,
    owner: record.owner
  };
}

export function addCustomerContact(form: CustomerForm): CustomerForm {
  return {
    ...form,
    contacts: [...form.contacts, createBlankContact(form.contacts.length + 1)]
  };
}

export function updateCustomerContact<K extends CustomerContactEditorField>(
  form: CustomerForm,
  contactId: string,
  field: K,
  value: CustomerContactForm[K]
): CustomerForm {
  return {
    ...form,
    contacts: form.contacts.map((contact) => (contact.id === contactId ? { ...contact, [field]: value } : contact))
  };
}

export function setPrimaryCustomerContact(form: CustomerForm, contactId: string): CustomerForm {
  return {
    ...form,
    contacts: form.contacts.map((contact) => ({ ...contact, primary: contact.id === contactId }))
  };
}

export function removeCustomerContact(form: CustomerForm, contactId: string): CustomerForm {
  if (form.contacts.length === 1) {
    return form;
  }

  const nextContacts = form.contacts.filter((contact) => contact.id !== contactId);

  if (nextContacts.some((contact) => contact.primary)) {
    return {
      ...form,
      contacts: nextContacts
    };
  }

  return {
    ...form,
    contacts: nextContacts.map((contact, index) => ({ ...contact, primary: index === 0 }))
  };
}

export function isCustomerFormValid(form: CustomerForm) {
  const hasValidContacts =
    form.contacts.length > 0 &&
    form.contacts.some((contact) => contact.primary) &&
    form.contacts.every(
      (contact) =>
        contact.name.trim() &&
        contact.role.trim() &&
        contact.phone.trim() &&
        contact.email.trim() &&
        contact.wechat.trim()
    );

  return Boolean(
    form.name.trim() &&
      form.industry.trim() &&
      form.owner.trim() &&
      hasValidContacts
  );
}

function getNextCustomerCode(records: CustomerRecord[]) {
  const maxSequence = records.reduce((max, record) => {
    const sequence = Number(record.code.replace('CUS-2026-', ''));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `CUS-2026-${String(maxSequence + 1).padStart(3, '0')}`;
}

function buildCustomerContactsForSave(form: CustomerForm, customerCode: string): CustomerContactRecord[] {
  return form.contacts.map((contact, index) => ({
    id: contact.id.startsWith('contact-draft-') ? `contact-${customerCode.toLowerCase()}-${index + 1}` : contact.id,
    email: contact.email.trim(),
    name: contact.name.trim(),
    note: contact.note.trim() || (contact.primary ? '主联系人' : ''),
    phone: contact.phone.trim(),
    primary: contact.primary,
    role: contact.role.trim(),
    wechat: contact.wechat.trim()
  }));
}

export function buildCustomerRecordForSave({
  customerRows,
  editingCustomer,
  form,
  updatedAt = '2026-06-14'
}: BuildCustomerRecordInput): CustomerRecord {
  const customerCode = editingCustomer?.code ?? getNextCustomerCode(customerRows);
  const contacts = buildCustomerContactsForSave(form, customerCode);

  if (editingCustomer) {
    return {
      ...editingCustomer,
      contacts,
      industry: form.industry.trim(),
      name: form.name.trim(),
      note: form.note.trim() || '暂无备注。',
      owner: form.owner.trim(),
      updatedAt
    };
  }

  return {
    id: `customer-${customerCode.toLowerCase()}`,
    code: customerCode,
    name: form.name.trim(),
    industry: form.industry.trim(),
    owner: form.owner.trim(),
    contacts,
    brandCount: 0,
    storeCount: 0,
    updatedAt,
    note: form.note.trim() || '新增客户档案，待补充品牌和门店信息。'
  };
}
