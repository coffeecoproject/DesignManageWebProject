import { frontendBusinessToday } from '../../app/frontendBusinessClock';
import type { TaskConfigRow } from '../system/TaskConfigState';
import { getPrimaryCustomerContact, type BrandRecord, type BrandTaskConfigRecord, type CustomerContractRecord, type CustomerRecord } from './customerData';
import {
  getCurrentBrandTaskPricingDrafts,
  isBrandSettlementPolicyValid,
  resolveActiveBrandTaskPriceVersion,
  type BrandSettlementPolicy,
  type BrandTaskPriceVersionRecord,
  type BrandTaskPricingDraft
} from './brandTaskPricingModel';
import {
  cloneBrandAcceptancePolicy,
  defaultBrandAcceptancePolicy,
  isBrandAcceptancePolicyValid,
  getBrandAcceptancePolicy,
  type BrandAcceptancePolicy,
  type BrandAcceptancePolicyRecord
} from './brandAcceptancePolicyModel';

export type BrandTaskConfigForm = BrandTaskPricingDraft;

export type BrandForm = {
  acceptancePolicy: BrandAcceptancePolicy;
  code: string;
  contactName: string;
  customerId: string;
  name: string;
  note: string;
  settlementPolicy: BrandSettlementPolicy;
  taskConfigs: BrandTaskConfigForm[];
};

export type BrandTaskDisplayRow = {
  category: TaskConfigRow['category'];
  id: string;
  name: string;
  billable: boolean;
  contractId?: string;
  contractName: string;
  unitPrice: number;
};

export type BrandTaskFormDisplayRow = Omit<BrandTaskDisplayRow, 'id'> & {
  taskConfigId: string;
};

type BuildBrandRecordInput = {
  editingBrand?: BrandRecord | undefined;
  form: BrandForm;
  updatedAt?: string;
};

export function matchesBrandKeyword(record: BrandRecord, keyword: string, customers: CustomerRecord[]) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  const customer = customers.find((currentCustomer) => currentCustomer.id === record.customerId);
  return [record.name, record.code, record.contactName, customer?.name]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

function getNextBrandCode(records: BrandRecord[]) {
  const maxSequence = records.reduce((max, record) => {
    const match = record.code.match(/^BRD-2026-(\d+)$/);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `BRD-2026-${String(maxSequence + 1).padStart(3, '0')}`;
}

export function getDefaultBrandContactName(customerId: string, customers: CustomerRecord[]) {
  const customer = customers.find((record) => record.id === customerId);
  return customer ? getPrimaryCustomerContact(customer)?.name ?? '' : '';
}

export function getTaskConfigName(taskConfigId: string, taskConfigRows: TaskConfigRow[]) {
  return taskConfigRows.find((taskConfigRow) => taskConfigRow.id === taskConfigId)?.name ?? '未配置任务类型';
}

export function buildBrandForm(
  record: BrandRecord,
  priceVersions: readonly BrandTaskPriceVersionRecord[],
  acceptancePolicies: readonly BrandAcceptancePolicyRecord[],
  effectiveAt = frontendBusinessToday
): BrandForm {
  const acceptancePolicy = getBrandAcceptancePolicy({
    brandId: record.id,
    policies: acceptancePolicies
  })?.policy ?? defaultBrandAcceptancePolicy;
  return {
    acceptancePolicy: cloneBrandAcceptancePolicy(acceptancePolicy),
    code: record.code,
    contactName: record.contactName,
    customerId: record.customerId,
    name: record.name,
    note: record.note,
    settlementPolicy: record.settlementPolicy,
    taskConfigs: getCurrentBrandTaskPricingDrafts({
      brandId: record.id,
      effectiveAt,
      priceVersions,
      taskConfigIds: record.taskConfigs.map((taskConfig) => taskConfig.taskConfigId)
    })
  };
}

export function buildDefaultBrandForm({
  brandRows,
  customerRows
}: {
  brandRows: BrandRecord[];
  customerRows: CustomerRecord[];
}): BrandForm {
  const customerId = customerRows[0]?.id ?? '';

  return {
    acceptancePolicy: cloneBrandAcceptancePolicy(defaultBrandAcceptancePolicy),
    code: getNextBrandCode(brandRows),
    contactName: getDefaultBrandContactName(customerId, customerRows),
    customerId,
    name: '',
    note: '',
    settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
    taskConfigs: []
  };
}

export function isBrandFormValid(form: BrandForm) {
  return Boolean(
    form.customerId &&
      form.name.trim() &&
      form.contactName.trim() &&
      isBrandAcceptancePolicyValid(form.acceptancePolicy) &&
      isBrandSettlementPolicyValid(form.settlementPolicy) &&
      form.taskConfigs.every((taskConfig) => !taskConfig.billable || (taskConfig.unitPrice > 0 && taskConfig.contractId))
  );
}

function normalizeBrandTaskConfigs(brandCode: string, taskConfigs: BrandTaskConfigForm[]): BrandTaskConfigRecord[] {
  return taskConfigs.map((taskConfig) => ({
    id: `brand-task-${brandCode.toLowerCase()}-${taskConfig.taskConfigId}`,
    taskConfigId: taskConfig.taskConfigId
  }));
}

function toBrandTaskDisplayRow({
  billable,
  contractId,
  contracts,
  taskConfigId,
  taskConfigRows,
  unitPrice
}: {
  billable: boolean;
  contractId?: string;
  contracts: readonly CustomerContractRecord[];
  taskConfigId: string;
  taskConfigRows: TaskConfigRow[];
  unitPrice: number;
}): Omit<BrandTaskDisplayRow, 'id'> | undefined {
  const taskType = taskConfigRows.find((taskConfigRow) => taskConfigRow.id === taskConfigId);

  if (!taskType) {
    return undefined;
  }

  return {
    billable,
    category: taskType.category,
    contractId,
    contractName: contracts.find((contract) => contract.id === contractId)?.name ?? '-',
    name: taskType.name,
    unitPrice
  };
}

export function buildBrandTaskDisplayRows(
  record: BrandRecord,
  taskConfigRows: TaskConfigRow[],
  priceVersions: readonly BrandTaskPriceVersionRecord[],
  contracts: readonly CustomerContractRecord[],
  effectiveAt = frontendBusinessToday
): BrandTaskDisplayRow[] {
  return record.taskConfigs
    .map((taskConfig) => {
      const priceVersion = resolveActiveBrandTaskPriceVersion({
        brandId: record.id,
        effectiveAt,
        priceVersions,
        taskConfigId: taskConfig.taskConfigId
      });
      const displayRow = toBrandTaskDisplayRow({
        billable: priceVersion?.billable ?? false,
        contractId: priceVersion?.contractId,
        contracts,
        taskConfigId: taskConfig.taskConfigId,
        taskConfigRows,
        unitPrice: priceVersion?.unitPrice ?? 0
      });

      if (!displayRow) {
        return undefined;
      }

      return {
        id: taskConfig.id,
        ...displayRow
      } satisfies BrandTaskDisplayRow;
    })
    .filter((row): row is BrandTaskDisplayRow => Boolean(row));
}

export function buildBrandTaskFormDisplayRows(
  taskConfigs: BrandTaskConfigForm[],
  taskConfigRows: TaskConfigRow[],
  contracts: readonly CustomerContractRecord[]
): BrandTaskFormDisplayRow[] {
  return taskConfigs
    .map((taskConfig) => {
      const displayRow = toBrandTaskDisplayRow({
        billable: taskConfig.billable,
        contractId: taskConfig.contractId,
        contracts,
        taskConfigId: taskConfig.taskConfigId,
        taskConfigRows,
        unitPrice: taskConfig.unitPrice
      });

      if (!displayRow) {
        return undefined;
      }

      return {
        ...displayRow,
        taskConfigId: taskConfig.taskConfigId
      } satisfies BrandTaskFormDisplayRow;
    })
    .filter((row): row is BrandTaskFormDisplayRow => Boolean(row));
}

export function getAddableBrandTaskConfigs({
  form,
  taskConfigRows
}: {
  form: BrandForm;
  taskConfigRows: TaskConfigRow[];
}) {
  return taskConfigRows.filter(
    (taskConfig) => taskConfig.status === '启用' && !form.taskConfigs.some((item) => item.taskConfigId === taskConfig.id)
  );
}

export function addBrandTaskConfigToForm({
  form,
  taskConfigId,
  taskConfigRows
}: {
  form: BrandForm;
  taskConfigId: string | undefined;
  taskConfigRows: TaskConfigRow[];
}): BrandForm {
  const taskConfigRow = taskConfigRows.find((currentTaskConfigRow) => currentTaskConfigRow.id === taskConfigId);

  if (!taskConfigRow || taskConfigRow.status !== '启用') {
    return form;
  }

  if (form.taskConfigs.some((taskConfig) => taskConfig.taskConfigId === taskConfigRow.id)) {
    return form;
  }

  return {
    ...form,
    taskConfigs: [
      ...form.taskConfigs,
      {
        billable: false,
        taskConfigId: taskConfigRow.id,
        unitPrice: 0
      }
    ]
  };
}

export function removeBrandTaskConfigFromForm(form: BrandForm, taskConfigId: string): BrandForm {
  return {
    ...form,
    taskConfigs: form.taskConfigs.filter((taskConfig) => taskConfig.taskConfigId !== taskConfigId)
  };
}

export function updateBrandTaskPricing(
  form: BrandForm,
  taskConfigId: string,
  patch: Partial<Pick<BrandTaskConfigForm, 'billable' | 'contractId' | 'unitPrice'>>
): BrandForm {
  return {
    ...form,
    taskConfigs: form.taskConfigs.map((taskConfig) => {
      if (taskConfig.taskConfigId !== taskConfigId) {
        return taskConfig;
      }

      const next = { ...taskConfig, ...patch };
      return next.billable ? next : { ...next, contractId: undefined, unitPrice: 0 };
    })
  };
}

export function buildBrandRecordForSave({ editingBrand, form, updatedAt = '2026-06-14' }: BuildBrandRecordInput): BrandRecord {
  const normalizedForm = {
    contactName: form.contactName.trim(),
    customerId: form.customerId,
    name: form.name.trim(),
    note: form.note.trim() || '暂无备注。',
    settlementPolicy: form.settlementPolicy,
    taskConfigs: normalizeBrandTaskConfigs(form.code, form.taskConfigs)
  };

  if (editingBrand) {
    return {
      ...editingBrand,
      ...normalizedForm,
      updatedAt
    };
  }

  return {
    id: `brand-${form.code.toLowerCase()}`,
    code: form.code,
    owner: '',
    status: '启用',
    storeCount: 0,
    updatedAt,
    ...normalizedForm
  };
}
