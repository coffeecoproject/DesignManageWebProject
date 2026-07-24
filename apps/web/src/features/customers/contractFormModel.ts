import {
  deriveCustomerContractStatus,
  type CustomerContractAmountMode,
  type CustomerContractAgreementChangeType,
  type CustomerContractAmountTaxMode,
  type CustomerContractBusinessNature,
  type CustomerContractFileRecord,
  type CustomerContractRecord,
  type CustomerContractStatus,
  type CustomerContractType,
  type CustomerRecord
} from './customerData';
import { frontendBusinessToday } from '../../app/frontendBusinessClock';

export type ContractDraftFile = {
  id: string;
  name: string;
  status: '已上传' | '已选择';
  type: CustomerContractFileRecord['type'];
  updatedAt?: string;
};

export type ContractForm = {
  agreementChangeAmount: string;
  agreementChangeType: CustomerContractAgreementChangeType | '';
  amount: string;
  amountMode: CustomerContractAmountMode;
  amountTaxMode: CustomerContractAmountTaxMode;
  businessNature: CustomerContractBusinessNature;
  customerId: string;
  expiresAt: string;
  files: ContractDraftFile[];
  name: string;
  note: string;
  owner: string;
  parentContractId: string;
  signedAt: string;
  signedVersionNo: string;
  type: CustomerContractType;
  vatAmount: string;
};

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
    agreementChangeAmount: '',
    agreementChangeType: '',
    amount: '',
    amountMode: '固定金额',
    amountTaxMode: '价税分列',
    businessNature: '设计及咨询服务',
    customerId: customers[0]?.id ?? '',
    expiresAt: '',
    files: [],
    name: '',
    note: '',
    owner: '李明',
    parentContractId: '',
    signedAt: '',
    signedVersionNo: 'V1.0',
    type: '年框合同',
    vatAmount: ''
  };
}

export function buildContractForm(record: CustomerContractRecord): ContractForm {
  return {
    agreementChangeAmount: record.stampDutyFacts.agreementChangeAmount === undefined ? '' : String(record.stampDutyFacts.agreementChangeAmount),
    agreementChangeType: record.stampDutyFacts.agreementChangeType ?? '',
    amount: record.amount === null ? '' : String(record.amount),
    amountMode: record.amountMode,
    amountTaxMode: record.stampDutyFacts.amountTaxMode,
    businessNature: record.stampDutyFacts.businessNature,
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
    parentContractId: record.stampDutyFacts.parentContractId ?? '',
    signedAt: record.signedAt,
    signedVersionNo: record.stampDutyFacts.signedVersionNo,
    type: record.type,
    vatAmount: record.stampDutyFacts.vatAmount === undefined ? '' : String(record.stampDutyFacts.vatAmount)
  };
}

export function getContractFormAmount(form: ContractForm) {
  return form.amountMode === '固定金额' ? parseMoneyInput(form.amount) : null;
}

export function isContractFormValid(form: ContractForm) {
  const contractAmount = getContractFormAmount(form);
  const amountValid = form.amountMode === '无固定金额' || Boolean(contractAmount && contractAmount > 0);
  const vatAmount = parseMoneyInput(form.vatAmount);
  const vatValid = form.amountTaxMode !== '价税分列' || vatAmount <= (contractAmount ?? Number.MAX_SAFE_INTEGER);
  const agreementChangeAmount = parseMoneyInput(form.agreementChangeAmount);
  const agreementValid =
    !form.parentContractId ||
    (Boolean(form.agreementChangeType) &&
      (form.agreementChangeType === '仅变更非金额条款' || agreementChangeAmount > 0));

  return Boolean(
    agreementValid &&
      form.businessNature &&
      form.customerId &&
      form.name.trim() &&
      form.owner.trim() &&
      form.signedVersionNo.trim() &&
      form.signedAt.trim() &&
      form.expiresAt.trim() &&
      form.files.length > 0 &&
      amountValid &&
      vatValid
  );
}

function getContractFormSnapshot(form: ContractForm) {
  return {
    agreementChangeAmount: form.parentContractId && form.agreementChangeType !== '仅变更非金额条款'
      ? parseMoneyInput(form.agreementChangeAmount)
      : undefined,
    agreementChangeType: form.parentContractId ? form.agreementChangeType : undefined,
    amount: getContractFormAmount(form),
    amountMode: form.amountMode,
    amountTaxMode: form.amountTaxMode,
    businessNature: form.businessNature,
    customerId: form.customerId,
    expiresAt: form.expiresAt.trim(),
    files: form.files.map((file) => ({ name: file.name, type: file.type })),
    name: form.name.trim(),
    note: form.note.trim(),
    owner: form.owner.trim(),
    parentContractId: form.parentContractId || undefined,
    signedAt: form.signedAt.trim(),
    signedVersionNo: form.signedVersionNo.trim(),
    type: form.type,
    vatAmount: form.amountTaxMode === '价税分列' ? parseMoneyInput(form.vatAmount) : undefined
  };
}

function getContractRecordSnapshot(record: CustomerContractRecord) {
  return {
    agreementChangeAmount: record.stampDutyFacts.agreementChangeAmount,
    agreementChangeType: record.stampDutyFacts.agreementChangeType,
    amount: record.amount,
    amountMode: record.amountMode,
    amountTaxMode: record.stampDutyFacts.amountTaxMode,
    businessNature: record.stampDutyFacts.businessNature,
    customerId: record.customerId,
    expiresAt: record.expiresAt,
    files: record.files.map((file) => ({ name: file.name, type: file.type })),
    name: record.name,
    note: record.note,
    owner: record.owner,
    parentContractId: record.stampDutyFacts.parentContractId,
    signedAt: record.signedAt,
    signedVersionNo: record.stampDutyFacts.signedVersionNo,
    type: record.type,
    vatAmount: record.stampDutyFacts.vatAmount
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

export function getContractStatusByDate(expiresAt: string, evaluationDate = frontendBusinessToday): CustomerContractStatus {
  return expiresAt < evaluationDate ? '已到期' : '有效';
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
    stampDutyFacts: {
      agreementChangeAmount: form.parentContractId && form.agreementChangeType !== '仅变更非金额条款'
        ? parseMoneyInput(form.agreementChangeAmount)
        : undefined,
      agreementChangeType: form.parentContractId ? form.agreementChangeType || undefined : undefined,
      amountTaxMode: form.amountTaxMode,
      businessNature: form.businessNature,
      parentContractId: form.parentContractId || undefined,
      signedVersionNo: form.signedVersionNo.trim(),
      vatAmount: form.amountTaxMode === '价税分列' ? parseMoneyInput(form.vatAmount) : undefined
    },
    type: form.type,
    updatedAt
  };

  if (editingContract) {
    const nextRecord = {
      ...editingContract,
      ...baseFields
    };

    return {
      ...nextRecord,
      status: deriveCustomerContractStatus(nextRecord, updatedAt)
    };
  }

  return {
    id: `contract-${code.toLowerCase()}`,
    code,
    customerId: form.customerId,
    name: form.name.trim(),
    type: form.type,
    status: getContractStatusByDate(expiresAt),
    stampDutyFacts: baseFields.stampDutyFacts,
    signedAt,
    expiresAt,
    files,
    amountMode: form.amountMode,
    amount,
    owner: form.owner.trim(),
    updatedAt,
    note: form.note.trim() || '已上传签署合同文件。'
  };
}
