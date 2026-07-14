import type { BrandRecord, StoreRecord } from '../customers/customerData';
import type { DateRangeFilterValue, DateScopeFilterValue } from '../../components/DateFilterFields';
import type { PerformanceRulePreset, PerformanceTaskScoreItem } from '../performance/performanceTypes';
import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import type { TaskConfigRow } from '../system/TaskConfigState';
import { getFirstSelectableCandidateId, type TaskAssignmentWindow, type TaskAssignmentCandidate } from './taskAssignmentCandidates';
import {
  taskManagementNow,
  type StoreTaskCreateInput,
  type StoreTaskFileType,
  type StoreTaskRecord,
  type StoreTaskStatus
} from './TaskManagementState';
import { createTaskFileDraft, type TaskFileDraft } from './TaskFileDraftEditor';
import { getTaskSearchText, getTaskStoreContext, getTaskTypeName, isTaskOverdue } from './taskDisplayModel';
import { buildTaskFilesFromDrafts } from './taskFileModel';
import { appendTaskOperation } from './taskOperationModel';
import { addTaskWorkingHours } from './taskScheduling';

export type TaskFilterState = {
  brandId: '全部' | string;
  keyword: string;
  plannedDeliveryTime: DateScopeFilterValue;
  status: '全部' | StoreTaskStatus;
};

export type StoreTaskForm = {
  acceptorId: string;
  brandId: string;
  executorId: string;
  materials: TaskFileDraft[];
  laborGrossAmount: number | null;
  note: string;
  plannedDurationHours: number | null;
  storeId: string;
  taskConfigId: string;
};

export type BrandTaskOption = {
  performanceRule: PerformanceRulePreset;
  scoreItem: PerformanceTaskScoreItem;
  taskConfig: TaskConfigRow;
};

export type TaskListMetrics = {
  completed: number;
  inProgress: number;
  pendingAcceptance: number;
  rejected: number;
  stopped: number;
  total: number;
};

export type TaskCreateValidationState = {
  disabled: boolean;
  warningMessage: string;
};

export const defaultTaskFilters: TaskFilterState = {
  brandId: '全部',
  keyword: '',
  plannedDeliveryTime: { mode: 'all' },
  status: '全部'
};

export const taskMaterialTypeOptions: StoreTaskFileType[] = ['CAD源文件', 'PDF图纸', '图片', '压缩包', '说明文件'];

const taskStatusSortPriority: Record<StoreTaskStatus, number> = {
  待验收: 0,
  验收驳回: 1,
  进行中: 2,
  已完成: 8,
  已中止: 9
};

export function getBrandPerformanceRule(brand: BrandRecord | undefined, performanceRuleRows: PerformanceRulePreset[]) {
  if (!brand) {
    return undefined;
  }

  return performanceRuleRows.find((rule) => rule.id === brand.performanceRuleId && rule.performanceType === '任务制' && rule.status === '已发布');
}

export function getBrandTaskOptions(
  brand: BrandRecord | undefined,
  taskConfigRows: TaskConfigRow[],
  performanceRuleRows: PerformanceRulePreset[]
): BrandTaskOption[] {
  if (!brand) {
    return [];
  }

  const performanceRule = getBrandPerformanceRule(brand, performanceRuleRows);

  if (!performanceRule) {
    return [];
  }

  return brand.taskConfigs
    .map((brandTaskConfig) => {
      const taskConfig = taskConfigRows.find((row) => row.id === brandTaskConfig.taskConfigId && row.status === '启用');
      const scoreItem = performanceRule.taskScoreItems.find((item) => item.taskConfigId === brandTaskConfig.taskConfigId);

      return taskConfig && scoreItem ? { performanceRule, scoreItem, taskConfig } : undefined;
    })
    .filter((item): item is BrandTaskOption => Boolean(item));
}

function normalizeRegionName(value: string) {
  return value
    .replace(/壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区/g, '')
    .replace(/[省市]$/g, '')
    .trim();
}

export function getStoreShortName(store: StoreRecord | undefined) {
  if (!store) {
    return '';
  }

  const prefixes = [store.province, normalizeRegionName(store.province), store.city, normalizeRegionName(store.city)].filter(Boolean);
  const shortName = prefixes.reduce((currentName, prefix) => (currentName.startsWith(prefix) ? currentName.slice(prefix.length) : currentName), store.name);

  return shortName || store.name;
}

export function buildGeneratedTaskName(store: StoreRecord | undefined, taskConfig: TaskConfigRow | undefined) {
  if (!store || !taskConfig) {
    return '';
  }

  return `${getStoreShortName(store)}${taskConfig.name}`;
}

export function buildDefaultTaskForm({
  brandRows,
  performanceRuleRows,
  storeRows,
  taskConfigRows
}: {
  brandRows: BrandRecord[];
  performanceRuleRows: PerformanceRulePreset[];
  storeRows: StoreRecord[];
  taskConfigRows: TaskConfigRow[];
}): StoreTaskForm {
  const brand =
    brandRows.find((row) => storeRows.some((store) => store.brandId === row.id) && getBrandTaskOptions(row, taskConfigRows, performanceRuleRows).length > 0) ??
    brandRows[0];
  const store = storeRows.find((row) => row.brandId === brand?.id);
  const taskConfigId = getBrandTaskOptions(brand, taskConfigRows, performanceRuleRows)[0]?.taskConfig.id ?? '';

  return {
    acceptorId: '',
    brandId: brand?.id ?? '',
    executorId: '',
    laborGrossAmount: null,
    materials: [createTaskFileDraft('PDF图纸')],
    note: '',
    plannedDurationHours: null,
    storeId: store?.id ?? '',
    taskConfigId
  };
}

export function buildTaskAssignmentWindow(
  plannedDurationHours: number | null,
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
): TaskAssignmentWindow | undefined {
  if (typeof plannedDurationHours !== 'number' || plannedDurationHours <= 0) {
    return undefined;
  }

  const endAt = addTaskWorkingHours(taskManagementNow, plannedDurationHours, workCalendarRows, annualExceptionRows);

  return endAt ? { endAt, startAt: taskManagementNow } : undefined;
}

export function getGeneratedTaskDeliveryAt(
  plannedDurationHours: number | null,
  workCalendarRows: WorkCalendarRow[],
  annualExceptionRows: AnnualExceptionConfigRow[]
) {
  return buildTaskAssignmentWindow(plannedDurationHours, workCalendarRows, annualExceptionRows)?.endAt ?? '';
}

export function getFirstTaskExecutorId(candidates: TaskAssignmentCandidate[], plannedDurationHours: number | null) {
  if (typeof plannedDurationHours !== 'number' || plannedDurationHours <= 0) {
    return '';
  }

  return getFirstSelectableCandidateId(candidates);
}

export function getTaskCreateValidationState({
  availableTaskOptions,
  form,
  generatedPlannedDeliveryAt,
  generatedTaskName,
  hasPartialMaterial,
  hasValidAcceptor,
  hasValidExecutor,
  requiresLaborAgreement,
  selectableExecutorCount
}: {
  availableTaskOptions: BrandTaskOption[];
  form: StoreTaskForm;
  generatedPlannedDeliveryAt: string;
  generatedTaskName: string;
  hasPartialMaterial: boolean;
  hasValidAcceptor: boolean;
  hasValidExecutor: boolean;
  requiresLaborAgreement: boolean;
  selectableExecutorCount: number;
}): TaskCreateValidationState {
  if (selectableExecutorCount === 0) {
    return {
      disabled: true,
      warningMessage: '当前任务时间内暂无可用执行人，请调整预计用时或维护人员假勤/任务能力'
    };
  }

  if (hasPartialMaterial) {
    return {
      disabled: true,
      warningMessage: '文件名称和文件链接需要同时填写'
    };
  }

  const disabled =
    !form.brandId ||
    !form.storeId ||
    !form.taskConfigId ||
    !generatedTaskName ||
    !hasValidExecutor ||
    !hasValidAcceptor ||
    !generatedPlannedDeliveryAt ||
    availableTaskOptions.length === 0 ||
    (requiresLaborAgreement && (typeof form.laborGrossAmount !== 'number' || form.laborGrossAmount <= 0));

  return {
    disabled,
    warningMessage: requiresLaborAgreement
      ? '请补全品牌门店、任务类型、预计用时、执行人、验收人和兼职任务税前金额'
      : '请补全品牌门店、任务类型、预计用时、执行人和验收人'
  };
}

export function buildTaskCreateInput({
  acceptor,
  executor,
  fileIdPrefix = `task-file-initial-${Date.now()}`,
  form,
  generatedPlannedDeliveryAt,
  generatedTaskName,
  registeredBy = '李明',
  selectedBrand
}: {
  acceptor: { id: string; name: string };
  executor: { contractNo: string; id: string; name: string; personnelType: '全职' | '兼职' };
  fileIdPrefix?: string;
  form: StoreTaskForm;
  generatedPlannedDeliveryAt: string;
  generatedTaskName: string;
  registeredBy?: string;
  selectedBrand?: Pick<BrandRecord, 'customerId'>;
}): StoreTaskCreateInput {
  return {
    brandId: form.brandId,
    customerId: selectedBrand?.customerId ?? '',
    acceptorId: acceptor.id,
    acceptorName: acceptor.name,
    executorId: executor.id,
    executorName: executor.name,
    laborAgreement:
      executor.personnelType === '兼职'
        ? {
            agreedGrossAmount: form.laborGrossAmount ?? 0,
            agreementVersion: executor.contractNo,
            projectId: `${executor.contractNo}/${form.taskConfigId}`
          }
        : undefined,
    files: buildTaskFilesFromDrafts({
      drafts: form.materials,
      idPrefix: fileIdPrefix,
      registeredBy,
      stage: '原始资料'
    }),
    name: generatedTaskName,
    note: form.note.trim() || '暂无备注。',
    plannedDurationHours: form.plannedDurationHours ?? 0,
    plannedDeliveryAt: generatedPlannedDeliveryAt,
    storeId: form.storeId,
    taskConfigId: form.taskConfigId
  };
}

export function updateTaskFormMaterial<K extends keyof Omit<TaskFileDraft, 'id'>>(
  form: StoreTaskForm,
  materialId: string,
  key: K,
  value: TaskFileDraft[K]
): StoreTaskForm {
  return {
    ...form,
    materials: form.materials.map((material) => (material.id === materialId ? { ...material, [key]: value } : material))
  };
}

export function addTaskFormMaterial(form: StoreTaskForm): StoreTaskForm {
  return {
    ...form,
    materials: [...form.materials, createTaskFileDraft('PDF图纸')]
  };
}

export function removeTaskFormMaterial(form: StoreTaskForm, materialId: string): StoreTaskForm {
  const nextMaterials = form.materials.filter((material) => material.id !== materialId);

  return {
    ...form,
    materials: nextMaterials.length > 0 ? nextMaterials : [createTaskFileDraft('PDF图纸')]
  };
}

export function getTaskUnavailableMessage(selectedPerformanceRule: PerformanceRulePreset | undefined) {
  return selectedPerformanceRule ? '该品牌未选择适用任务，请先到品牌管理配置。' : '该品牌未绑定绩效方案，请先到品牌管理配置。';
}

export function getFilteredStoreTasks({
  brandRows,
  customerRows,
  filters,
  plannedDeliveryRange,
  storeRows,
  storeTaskRows,
  taskConfigRows
}: {
  brandRows: Pick<BrandRecord, 'id' | 'name'>[];
  customerRows: { id: string; name: string }[];
  filters: TaskFilterState;
  plannedDeliveryRange?: DateRangeFilterValue;
  storeRows: StoreRecord[];
  storeTaskRows: StoreTaskRecord[];
  taskConfigRows: TaskConfigRow[];
}) {
  return storeTaskRows
    .filter((record) => {
      const customer = customerRows.find((row) => row.id === record.customerId);
      const brand = brandRows.find((row) => row.id === record.brandId);
      const storeContext = getTaskStoreContext(storeRows, record.storeId);
      const taskTypeName = getTaskTypeName(record.taskConfigId, taskConfigRows);
      const keyword = filters.keyword.trim().toLowerCase();

      const matchesStatus = filters.status === '全部' || record.status === filters.status;
      const matchesBrand = filters.brandId === '全部' || record.brandId === filters.brandId;
      const plannedDeliveryDate = record.plannedDeliveryAt.slice(0, 10);
      const matchesPlannedDelivery =
        !plannedDeliveryRange || (plannedDeliveryDate >= plannedDeliveryRange.startDate && plannedDeliveryDate <= plannedDeliveryRange.endDate);
      const matchesKeyword =
        !keyword ||
        getTaskSearchText({
          acceptorName: record.acceptorName,
          brandName: brand?.name,
          code: record.code,
          customerName: customer?.name,
          executorName: record.executorName,
          name: record.name,
          storeCity: storeContext.city,
          storeName: storeContext.store?.name,
          taskTypeName
        })
          .toLowerCase()
          .includes(keyword);

      return matchesStatus && matchesBrand && matchesPlannedDelivery && matchesKeyword;
    })
    .sort(
      (left, right) =>
        Number(isTaskOverdue(right)) - Number(isTaskOverdue(left)) ||
        taskStatusSortPriority[left.status] - taskStatusSortPriority[right.status] ||
        right.updatedAt.localeCompare(left.updatedAt)
    );
}

export function getTaskListMetrics(storeTaskRows: StoreTaskRecord[]): TaskListMetrics {
  return {
    completed: storeTaskRows.filter((record) => record.status === '已完成').length,
    inProgress: storeTaskRows.filter((record) => record.status === '进行中').length,
    pendingAcceptance: storeTaskRows.filter((record) => record.status === '待验收').length,
    rejected: storeTaskRows.filter((record) => record.status === '验收驳回').length,
    stopped: storeTaskRows.filter((record) => record.status === '已中止').length,
    total: storeTaskRows.length
  };
}

export function buildTerminatedTaskRecord(record: StoreTaskRecord) {
  return appendTaskOperation(
    {
      ...record,
      status: '已中止'
    },
    '中止任务',
    '任务已中止，不再进入提交或验收'
  );
}
