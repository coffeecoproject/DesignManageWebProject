import type {
  CustomerContractAmountMode,
  CustomerContractFileRecord,
  CustomerContractRecord,
  CustomerContractStatus,
  CustomerContractType,
  CustomerRecord
} from './customerData';

export type ContractDraftFile = {
  id: string;
  name: string;
  status: '已上传' | '已选择';
  type: CustomerContractFileRecord['type'];
  updatedAt?: string;
};

export type ContractForm = {
  amount: string;
  amountMode: CustomerContractAmountMode;
  customerId: string;
  expiresAt: string;
  files: ContractDraftFile[];
  name: string;
  note: string;
  owner: string;
  signedAt: string;
  type: CustomerContractType;
};

export type CustomerContractReceiptStatus = '未收' | '已收' | '部分已收' | '已收齐';

export type ContractRelatedFileRecord = {
  id: string;
  name: string;
  status: string;
  type: string;
  updatedAt: string;
};

type BuildContractRecordInput = {
  contractRows: CustomerContractRecord[];
  drawerMode: 'create' | 'edit' | undefined;
  editingContract?: CustomerContractRecord | undefined;
  form: ContractForm;
  updatedAt?: string;
};

export type AddContractFormFileResult =
  | {
      form: ContractForm;
      status: 'added';
    }
  | {
      fileName: string;
      form: ContractForm;
      status: 'duplicate' | 'tooLarge';
    };

const maxContractFileSize = 20 * 1024 * 1024;

export const contractReceiptStatusTone = {
  未收: 'amber',
  已收: 'green',
  部分已收: 'blue',
  已收齐: 'green'
} as const;

export function matchesContractKeyword(record: CustomerContractRecord, keyword: string, customers: CustomerRecord[]) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  const customer = customers.find((currentCustomer) => currentCustomer.id === record.customerId);
  return [record.name, record.code, record.owner, customer?.name]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

function getNextContractCode(records: CustomerContractRecord[]) {
  const maxSequence = records.reduce((max, record) => {
    const sequence = Number(record.code.replace('CON-2026-', ''));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `CON-2026-${String(maxSequence + 1).padStart(3, '0')}`;
}

function parseMoneyInput(value: string | undefined) {
  const amount = Number((value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export function formatContractMoney(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return '无固定金额';
  }

  return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

export function buildDefaultContractForm(customers: CustomerRecord[]): ContractForm {
  return {
    amount: '',
    amountMode: '固定金额',
    customerId: customers[0]?.id ?? '',
    expiresAt: '',
    files: [],
    name: '',
    note: '',
    owner: '李明',
    signedAt: '',
    type: '年框合同'
  };
}

export function buildContractForm(record: CustomerContractRecord): ContractForm {
  return {
    amount: record.amount === null ? '' : String(record.amount),
    amountMode: record.amountMode,
    customerId: record.customerId,
    expiresAt: record.expiresAt,
    files: record.files.map((file) => ({
      id: file.id,
      name: file.name,
      status: file.status,
      type: file.type,
      updatedAt: file.updatedAt
    })),
    name: record.name,
    note: record.note,
    owner: record.owner,
    signedAt: record.signedAt,
    type: record.type
  };
}

export function getContractFormAmount(form: ContractForm) {
  return form.amountMode === '固定金额' ? parseMoneyInput(form.amount) : null;
}

export function isContractFormValid(form: ContractForm) {
  const contractAmount = getContractFormAmount(form);
  const amountValid = form.amountMode === '无固定金额' || Boolean(contractAmount && contractAmount > 0);

  return Boolean(
    form.customerId &&
      form.name.trim() &&
      form.owner.trim() &&
      form.signedAt.trim() &&
      form.expiresAt.trim() &&
      form.files.length > 0 &&
      amountValid
  );
}

function getContractFormSnapshot(form: ContractForm) {
  return {
    amount: getContractFormAmount(form),
    amountMode: form.amountMode,
    customerId: form.customerId,
    expiresAt: form.expiresAt.trim(),
    files: form.files.map((file) => ({ name: file.name, type: file.type })),
    name: form.name.trim(),
    note: form.note.trim(),
    owner: form.owner.trim(),
    signedAt: form.signedAt.trim(),
    type: form.type
  };
}

function getContractRecordSnapshot(record: CustomerContractRecord) {
  return {
    amount: record.amount,
    amountMode: record.amountMode,
    customerId: record.customerId,
    expiresAt: record.expiresAt,
    files: record.files.map((file) => ({ name: file.name, type: file.type })),
    name: record.name,
    note: record.note,
    owner: record.owner,
    signedAt: record.signedAt,
    type: record.type
  };
}

export function isContractFormChanged(form: ContractForm, record: CustomerContractRecord | undefined) {
  if (!record) {
    return true;
  }

  return JSON.stringify(getContractFormSnapshot(form)) !== JSON.stringify(getContractRecordSnapshot(record));
}

export function addContractFormFile(
  form: ContractForm,
  file: { name: string; size?: number; uid: string }
): AddContractFormFileResult {
  if (typeof file.size === 'number' && file.size > maxContractFileSize) {
    return {
      fileName: file.name,
      form,
      status: 'tooLarge'
    };
  }

  if (form.files.some((currentFile) => currentFile.name === file.name)) {
    return {
      fileName: file.name,
      form,
      status: 'duplicate'
    };
  }

  return {
    form: {
      ...form,
      files: [
        ...form.files,
        {
          id: file.uid,
          name: file.name,
          status: '已选择',
          type: '已签署合同'
        }
      ]
    },
    status: 'added'
  };
}

export function removeContractFormFile(form: ContractForm, fileId: string): ContractForm {
  return {
    ...form,
    files: form.files.filter((currentFile) => currentFile.id !== fileId)
  };
}

export function getContractFiles(record: CustomerContractRecord): ContractRelatedFileRecord[] {
  return (record.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    status: file.status,
    type: file.type,
    updatedAt: file.updatedAt
  }));
}

export function getContractStatusByDate(expiresAt: string): CustomerContractStatus {
  return expiresAt < '2026-06-14' ? '已到期' : '有效';
}

export function getContractReceiptStatus(
  record: Pick<CustomerContractRecord, 'amount' | 'amountMode' | 'receivedAmount'>
): CustomerContractReceiptStatus {
  if (record.receivedAmount <= 0) {
    return '未收';
  }

  if (record.amountMode === '无固定金额') {
    return '已收';
  }

  if (record.amountMode === '固定金额' && record.amount !== null && record.receivedAmount >= record.amount) {
    return '已收齐';
  }

  return '部分已收';
}

export function getContractUnreceivedAmount(record: Pick<CustomerContractRecord, 'amount' | 'amountMode' | 'receivedAmount'>) {
  if (record.amountMode !== '固定金额' || record.amount === null) {
    return null;
  }

  return Math.max(record.amount - record.receivedAmount, 0);
}

export function getContractReceiptCellDisplay(record: CustomerContractRecord) {
  const status = getContractReceiptStatus(record);
  const receivedText = record.receivedAmount > 0 ? `已收 ${formatContractMoney(record.receivedAmount)}` : '暂无收款';

  return {
    primary: record.amountMode === '无固定金额' ? '无固定金额' : `固定金额 / ${formatContractMoney(record.amount)}`,
    secondary: `${receivedText} / ${status}`,
    status
  };
}

function buildContractFilesForSave(form: ContractForm, code: string, signedAt: string): CustomerContractFileRecord[] {
  return form.files.map((file, index) => ({
    id: file.status === '已上传' ? file.id : `${code.toLowerCase()}-file-${String(index + 1).padStart(3, '0')}`,
    name: file.name,
    status: '已上传',
    type: file.type,
    updatedAt: file.updatedAt ?? signedAt
  }));
}

export function buildContractRecordForSave({
  contractRows,
  drawerMode,
  editingContract,
  form,
  updatedAt = '2026-06-14'
}: BuildContractRecordInput): CustomerContractRecord | undefined {
  if (drawerMode === 'edit' && !editingContract) {
    return undefined;
  }

  const code = editingContract?.code ?? getNextContractCode(contractRows);
  const signedAt = form.signedAt.trim();
  const expiresAt = form.expiresAt.trim();
  const amount = getContractFormAmount(form);
  const files = buildContractFilesForSave(form, code, signedAt);
  const baseFields = {
    amount,
    amountMode: form.amountMode,
    customerId: form.customerId,
    expiresAt,
    files,
    name: form.name.trim(),
    note: form.note.trim() || '暂无备注。',
    owner: form.owner.trim(),
    signedAt,
    status: getContractStatusByDate(expiresAt),
    type: form.type,
    updatedAt
  };

  if (editingContract) {
    return {
      ...editingContract,
      ...baseFields
    };
  }

  return {
    id: `contract-${code.toLowerCase()}`,
    code,
    customerId: form.customerId,
    name: form.name.trim(),
    type: form.type,
    status: getContractStatusByDate(expiresAt),
    signedAt,
    expiresAt,
    files,
    amountMode: form.amountMode,
    amount,
    receivedAmount: 0,
    latestReceiptAt: '-',
    receiptNote: '收款信息由财务模块维护。',
    receiptRecords: [],
    owner: form.owner.trim(),
    updatedAt,
    note: form.note.trim() || '已上传签署合同文件。'
  };
}
