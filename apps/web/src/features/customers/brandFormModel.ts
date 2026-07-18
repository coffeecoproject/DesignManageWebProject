import type { PerformanceRulePreset, PerformanceTaskScoreItem } from '../performance/performanceTypes';
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

export type BrandTaskConfigForm = BrandTaskPricingDraft;

export type BrandForm = {
  code: string;
  contactName: string;
  customerId: string;
  name: string;
  note: string;
  performanceRuleId: string;
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
  score: number;
  unitPrice: number;
  unit: string;
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

export function getAvailableBrandPerformanceRules(ruleRows: PerformanceRulePreset[]) {
  return ruleRows.filter((rule) => rule.performanceType === '任务制' && rule.status === '已发布' && rule.taskScoreItems.length > 0);
}

export function getPerformanceRuleLabel(rule: PerformanceRulePreset | undefined) {
  return rule ? `${rule.category} / ${rule.currentVersion}` : '未绑定';
}

export function getTaskConfigName(taskConfigId: string, taskConfigRows: TaskConfigRow[]) {
  return taskConfigRows.find((taskConfigRow) => taskConfigRow.id === taskConfigId)?.name ?? '未配置任务类型';
}

export function buildBrandForm(
  record: BrandRecord,
  priceVersions: readonly BrandTaskPriceVersionRecord[],
  effectiveAt = frontendBusinessToday
): BrandForm {
  return {
    code: record.code,
    contactName: record.contactName,
    customerId: record.customerId,
    name: record.name,
    note: record.note,
    performanceRuleId: record.performanceRuleId,
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
  customerRows,
  defaultPerformanceRuleId
}: {
  brandRows: BrandRecord[];
  customerRows: CustomerRecord[];
  defaultPerformanceRuleId: string;
}): BrandForm {
  const customerId = customerRows[0]?.id ?? '';

  return {
    code: getNextBrandCode(brandRows),
    contactName: getDefaultBrandContactName(customerId, customerRows),
    customerId,
    name: '',
    note: '',
    performanceRuleId: defaultPerformanceRuleId,
    settlementPolicy: { mode: '按任务结算', perTaskDueDays: 30 },
    taskConfigs: []
  };
}

export function isBrandFormValid(form: BrandForm) {
  return Boolean(
    form.customerId &&
      form.name.trim() &&
      form.contactName.trim() &&
      form.performanceRuleId &&
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

function findRuleTaskScoreItem(rule: PerformanceRulePreset | undefined, taskConfigId: string) {
  return rule?.taskScoreItems.find((item) => item.taskConfigId === taskConfigId);
}

function toBrandTaskDisplayRow({
  billable,
  contractId,
  contracts,
  taskConfigId,
  taskConfigRows,
  taskScoreItem,
  unitPrice
}: {
  billable: boolean;
  contractId?: string;
  contracts: readonly CustomerContractRecord[];
  taskConfigId: string;
  taskConfigRows: TaskConfigRow[];
  taskScoreItem: PerformanceTaskScoreItem | undefined;
  unitPrice: number;
}): Omit<BrandTaskDisplayRow, 'id'> | undefined {
  const taskType = taskConfigRows.find((taskConfigRow) => taskConfigRow.id === taskConfigId);

  if (!taskType || !taskScoreItem) {
    return undefined;
  }

  return {
    billable,
    category: taskType.category,
    contractId,
    contractName: contracts.find((contract) => contract.id === contractId)?.name ?? '-',
    name: taskType.name,
    score: taskScoreItem.score,
    unitPrice,
    unit: taskScoreItem.unit
  };
}

export function buildBrandTaskDisplayRows(
  record: BrandRecord,
  taskConfigRows: TaskConfigRow[],
  performanceRules: PerformanceRulePreset[],
  priceVersions: readonly BrandTaskPriceVersionRecord[],
  contracts: readonly CustomerContractRecord[],
  effectiveAt = frontendBusinessToday
): BrandTaskDisplayRow[] {
  const performanceRule = performanceRules.find((rule) => rule.id === record.performanceRuleId);

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
        taskScoreItem: findRuleTaskScoreItem(performanceRule, taskConfig.taskConfigId),
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
  performanceRule: PerformanceRulePreset | undefined,
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
        taskScoreItem: findRuleTaskScoreItem(performanceRule, taskConfig.taskConfigId),
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

export function getAddableBrandTaskScoreItems({
  form,
  performanceRule,
  taskConfigRows
}: {
  form: BrandForm;
  performanceRule: PerformanceRulePreset | undefined;
  taskConfigRows: TaskConfigRow[];
}) {
  return (
    performanceRule?.taskScoreItems.filter((taskScoreItem) => {
      const taskConfig = taskConfigRows.find((taskConfigRow) => taskConfigRow.id === taskScoreItem.taskConfigId);
      return taskConfig?.status === '启用' && !form.taskConfigs.some((taskConfigItem) => taskConfigItem.taskConfigId === taskScoreItem.taskConfigId);
    }) ?? []
  );
}

export function addBrandTaskConfigToForm({
  form,
  performanceRule,
  taskConfigId,
  taskConfigRows
}: {
  form: BrandForm;
  performanceRule: PerformanceRulePreset | undefined;
  taskConfigId: string | undefined;
  taskConfigRows: TaskConfigRow[];
}): BrandForm {
  const taskScoreItem = performanceRule?.taskScoreItems.find((item) => item.taskConfigId === taskConfigId);
  const taskConfigRow = taskConfigRows.find((currentTaskConfigRow) => currentTaskConfigRow.id === taskConfigId);

  if (!taskScoreItem || !taskConfigRow || taskConfigRow.status !== '启用') {
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

export function setBrandPerformanceRule(form: BrandForm, performanceRuleId: string): BrandForm {
  return {
    ...form,
    performanceRuleId,
    taskConfigs: []
  };
}

export function buildBrandRecordForSave({ editingBrand, form, updatedAt = '2026-06-14' }: BuildBrandRecordInput): BrandRecord {
  const normalizedForm = {
    contactName: form.contactName.trim(),
    customerId: form.customerId,
    name: form.name.trim(),
    note: form.note.trim() || '暂无备注。',
    performanceRuleId: form.performanceRuleId,
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
