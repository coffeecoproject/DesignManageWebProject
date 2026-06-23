import { useMemo, useState } from 'react';
import type { BrandRecord, CustomerRecord, StoreRecord } from '../customers/customerData';
import type { PeopleAttendanceRecord } from '../people/PeopleOrganizationState';
import type { PeopleMember } from '../people/peopleTypes';
import type { PerformanceRulePreset } from '../performance/performanceTypes';
import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import type { TaskConfigRow } from '../system/TaskConfigState';
import {
  buildTaskAcceptorCandidates,
  buildTaskExecutorCandidates,
  type TaskAssignmentCandidate
} from './taskAssignmentCandidates';
import type { TaskFileDraft } from './TaskFileDraftEditor';
import type { StoreTaskCreateInput, StoreTaskRecord } from './TaskManagementState';
import {
  addTaskFormMaterial,
  buildTaskCreateInput,
  buildDefaultTaskForm,
  buildGeneratedTaskName,
  buildTaskAssignmentWindow,
  getBrandPerformanceRule,
  getBrandTaskOptions,
  getFirstTaskExecutorId,
  getGeneratedTaskDeliveryAt,
  getTaskCreateValidationState,
  getTaskUnavailableMessage,
  removeTaskFormMaterial,
  updateTaskFormMaterial,
  type BrandTaskOption,
  type StoreTaskForm,
  type TaskCreateValidationState
} from './taskListFormModel';

type UseTaskCreateFormStateInput = {
  annualExceptionRows: AnnualExceptionConfigRow[];
  attendanceRecords: PeopleAttendanceRecord[];
  brandRows: BrandRecord[];
  getCustomerById: (customerId: string) => CustomerRecord | undefined;
  peopleRows: PeopleMember[];
  performanceRuleRows: PerformanceRulePreset[];
  storeRows: StoreRecord[];
  storeTaskRows: StoreTaskRecord[];
  taskConfigRows: TaskConfigRow[];
  workCalendarRows: WorkCalendarRow[];
};

type TaskCreateFormDerivedState = {
  availableTaskOptions: BrandTaskOption[];
  generatedPlannedDeliveryAt: string;
  generatedTaskName: string;
  selectedBrand?: BrandRecord;
  selectedBrandTaskOption?: BrandTaskOption;
  selectedCustomer?: CustomerRecord;
  selectedStore?: StoreRecord;
  selectedTaskConfig?: TaskConfigRow;
  unavailableTaskMessage: string;
};

type TaskCreateFormCandidateState = {
  acceptorCandidates: TaskAssignmentCandidate[];
  executorCandidates: TaskAssignmentCandidate[];
  selectableExecutorCandidates: TaskAssignmentCandidate[];
  selectedAcceptorCandidate?: TaskAssignmentCandidate;
  selectedExecutorCandidate?: TaskAssignmentCandidate;
};

type TaskCreateFormValidationState = {
  createDisabled: boolean;
  createValidation: TaskCreateValidationState;
};

export type TaskCreateFormInputResult =
  | {
      input: StoreTaskCreateInput;
      ready: true;
    }
  | {
      ready: false;
      warningMessage: string;
    };

export type TaskCreateFormState = {
  actions: {
    addMaterial: () => void;
    changeAcceptor: (acceptorId: string) => void;
    changeBrand: (brandId: string) => void;
    changeExecutor: (executorId: string) => void;
    changeMaterial: <K extends keyof Omit<TaskFileDraft, 'id'>>(materialId: string, key: K, value: TaskFileDraft[K]) => void;
    changeNote: (note: string) => void;
    changePlannedDurationHours: (value: number | null) => void;
    changeStore: (storeId: string) => void;
    changeTaskConfig: (taskConfigId: string) => void;
    removeMaterial: (materialId: string) => void;
    reset: () => void;
  };
  candidates: TaskCreateFormCandidateState;
  derived: TaskCreateFormDerivedState;
  form: StoreTaskForm;
  getCreateInput: () => TaskCreateFormInputResult;
  validation: TaskCreateFormValidationState;
};

export function useTaskCreateFormState({
  annualExceptionRows,
  attendanceRecords,
  brandRows,
  getCustomerById,
  peopleRows,
  performanceRuleRows,
  storeRows,
  storeTaskRows,
  taskConfigRows,
  workCalendarRows
}: UseTaskCreateFormStateInput): TaskCreateFormState {
  const [form, setForm] = useState<StoreTaskForm>(() =>
    buildDefaultTaskForm({
      brandRows,
      performanceRuleRows,
      storeRows,
      taskConfigRows
    })
  );

  const selectedBrand = brandRows.find((brand) => brand.id === form.brandId);
  const selectedCustomer = selectedBrand ? getCustomerById(selectedBrand.customerId) : undefined;
  const selectedStore = storeRows.find((store) => store.id === form.storeId);
  const selectedTaskConfig = taskConfigRows.find((row) => row.id === form.taskConfigId);
  const selectedPerformanceRule = getBrandPerformanceRule(selectedBrand, performanceRuleRows);
  const availableTaskOptions = useMemo(
    () => getBrandTaskOptions(selectedBrand, taskConfigRows, performanceRuleRows),
    [performanceRuleRows, selectedBrand, taskConfigRows]
  );
  const selectedBrandTaskOption = availableTaskOptions.find((option) => option.taskConfig.id === form.taskConfigId);
  const unavailableTaskMessage = getTaskUnavailableMessage(selectedPerformanceRule);
  const generatedTaskName = buildGeneratedTaskName(selectedStore, selectedTaskConfig);
  const generatedPlannedDeliveryAt = getGeneratedTaskDeliveryAt(form.plannedDurationHours, workCalendarRows, annualExceptionRows);
  const assignmentWindow = useMemo(
    () => buildTaskAssignmentWindow(form.plannedDurationHours, workCalendarRows, annualExceptionRows),
    [annualExceptionRows, form.plannedDurationHours, workCalendarRows]
  );
  const executorCandidates = useMemo(
    () =>
      buildTaskExecutorCandidates({
        annualExceptionRows,
        attendanceRecords,
        peopleRows,
        storeTaskRows,
        taskConfigId: form.taskConfigId,
        window: assignmentWindow,
        workCalendarRows
      }),
    [annualExceptionRows, assignmentWindow, attendanceRecords, form.taskConfigId, peopleRows, storeTaskRows, workCalendarRows]
  );
  const acceptorCandidates = useMemo(
    () =>
      buildTaskAcceptorCandidates({
        annualExceptionRows,
        attendanceRecords,
        executorId: form.executorId,
        peopleRows,
        storeTaskRows,
        window: assignmentWindow,
        workCalendarRows
      }),
    [annualExceptionRows, assignmentWindow, attendanceRecords, form.executorId, peopleRows, storeTaskRows, workCalendarRows]
  );
  const selectedExecutorCandidate = executorCandidates.find((candidate) => candidate.member.id === form.executorId);
  const selectedAcceptorCandidate = acceptorCandidates.find((candidate) => candidate.member.id === form.acceptorId);
  const selectableExecutorCandidates = executorCandidates.filter((candidate) => candidate.selectable);
  const hasPartialMaterial = form.materials.some((material) => Boolean(material.name.trim()) !== Boolean(material.url.trim()));
  const hasValidExecutor = Boolean(selectedExecutorCandidate?.selectable);
  const hasValidAcceptor = Boolean(selectedAcceptorCandidate?.selectable);
  const createValidation = getTaskCreateValidationState({
    availableTaskOptions,
    form,
    generatedPlannedDeliveryAt,
    generatedTaskName,
    hasPartialMaterial,
    hasValidAcceptor,
    hasValidExecutor,
    selectableExecutorCount: selectableExecutorCandidates.length
  });

  function getFirstExecutorId(taskConfigId: string, plannedDurationHours: number | null) {
    return getFirstTaskExecutorId(
      buildTaskExecutorCandidates({
        annualExceptionRows,
        attendanceRecords,
        peopleRows,
        storeTaskRows,
        taskConfigId,
        window: buildTaskAssignmentWindow(plannedDurationHours, workCalendarRows, annualExceptionRows),
        workCalendarRows
      }),
      plannedDurationHours
    );
  }

  function reset() {
    setForm(
      buildDefaultTaskForm({
        brandRows,
        performanceRuleRows,
        storeRows,
        taskConfigRows
      })
    );
  }

  function changeField<T extends keyof StoreTaskForm>(key: T, value: StoreTaskForm[T]) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  function changeBrand(brandId: string) {
    const nextBrand = brandRows.find((brand) => brand.id === brandId);
    const nextStore = storeRows.find((store) => store.brandId === brandId);
    const nextTaskConfigId = getBrandTaskOptions(nextBrand, taskConfigRows, performanceRuleRows)[0]?.taskConfig.id ?? '';

    setForm((currentForm) => {
      const nextExecutorId = getFirstExecutorId(nextTaskConfigId, currentForm.plannedDurationHours);

      return {
        ...currentForm,
        acceptorId: currentForm.acceptorId === nextExecutorId ? '' : currentForm.acceptorId,
        brandId,
        executorId: nextExecutorId,
        storeId: nextStore?.id ?? '',
        taskConfigId: nextTaskConfigId
      };
    });
  }

  function changeTaskConfig(taskConfigId: string) {
    setForm((currentForm) => {
      const nextExecutorCandidates = buildTaskExecutorCandidates({
        annualExceptionRows,
        attendanceRecords,
        peopleRows,
        storeTaskRows,
        taskConfigId,
        window: buildTaskAssignmentWindow(currentForm.plannedDurationHours, workCalendarRows, annualExceptionRows),
        workCalendarRows
      });
      const currentExecutorCandidate = nextExecutorCandidates.find((candidate) => candidate.member.id === currentForm.executorId);
      const nextExecutorId = currentExecutorCandidate?.selectable ? currentForm.executorId : getFirstTaskExecutorId(nextExecutorCandidates, currentForm.plannedDurationHours);

      return {
        ...currentForm,
        acceptorId: currentForm.acceptorId === nextExecutorId ? '' : currentForm.acceptorId,
        executorId: nextExecutorId,
        taskConfigId
      };
    });
  }

  function changeExecutor(executorId: string) {
    setForm((currentForm) => ({
      ...currentForm,
      acceptorId: currentForm.acceptorId === executorId ? '' : currentForm.acceptorId,
      executorId
    }));
  }

  function changePlannedDurationHours(value: number | null) {
    setForm((currentForm) => {
      const plannedDurationHours = typeof value === 'number' ? value : null;
      const nextWindow = buildTaskAssignmentWindow(plannedDurationHours, workCalendarRows, annualExceptionRows);
      const nextExecutorCandidates = buildTaskExecutorCandidates({
        annualExceptionRows,
        attendanceRecords,
        peopleRows,
        storeTaskRows,
        taskConfigId: currentForm.taskConfigId,
        window: nextWindow,
        workCalendarRows
      });
      const currentExecutorCandidate = nextExecutorCandidates.find((candidate) => candidate.member.id === currentForm.executorId);
      const executorId = currentExecutorCandidate?.selectable ? currentForm.executorId : getFirstTaskExecutorId(nextExecutorCandidates, plannedDurationHours);
      const nextAcceptorCandidates = buildTaskAcceptorCandidates({
        annualExceptionRows,
        attendanceRecords,
        executorId,
        peopleRows,
        storeTaskRows,
        window: nextWindow,
        workCalendarRows
      });
      const currentAcceptorCandidate = nextAcceptorCandidates.find((candidate) => candidate.member.id === currentForm.acceptorId);

      return {
        ...currentForm,
        acceptorId: currentAcceptorCandidate?.selectable ? currentForm.acceptorId : '',
        executorId,
        plannedDurationHours
      };
    });
  }

  function changeMaterial<K extends keyof Omit<TaskFileDraft, 'id'>>(materialId: string, key: K, value: TaskFileDraft[K]) {
    setForm((currentForm) => updateTaskFormMaterial(currentForm, materialId, key, value));
  }

  function getCreateInput(): TaskCreateFormInputResult {
    if (createValidation.disabled) {
      return {
        ready: false,
        warningMessage: createValidation.warningMessage
      };
    }

    const executor = selectedExecutorCandidate?.member;
    const acceptor = selectedAcceptorCandidate?.member;

    if (!executor || !acceptor || !selectedExecutorCandidate?.selectable || !selectedAcceptorCandidate?.selectable) {
      return {
        ready: false,
        warningMessage: '请选择有效的执行人和验收人'
      };
    }

    return {
      input: buildTaskCreateInput({
        acceptor,
        executor,
        form,
        generatedPlannedDeliveryAt,
        generatedTaskName,
        selectedBrand
      }),
      ready: true
    };
  }

  return {
    actions: {
      addMaterial: () => setForm(addTaskFormMaterial),
      changeAcceptor: (acceptorId) => changeField('acceptorId', acceptorId),
      changeBrand,
      changeExecutor,
      changeMaterial,
      changeNote: (note) => changeField('note', note),
      changePlannedDurationHours,
      changeStore: (storeId) => changeField('storeId', storeId),
      changeTaskConfig,
      removeMaterial: (materialId) => setForm((currentForm) => removeTaskFormMaterial(currentForm, materialId)),
      reset
    },
    candidates: {
      acceptorCandidates,
      executorCandidates,
      selectableExecutorCandidates,
      selectedAcceptorCandidate,
      selectedExecutorCandidate
    },
    derived: {
      availableTaskOptions,
      generatedPlannedDeliveryAt,
      generatedTaskName,
      selectedBrand,
      selectedBrandTaskOption,
      selectedCustomer,
      selectedStore,
      selectedTaskConfig,
      unavailableTaskMessage
    },
    form,
    getCreateInput,
    validation: {
      createDisabled: createValidation.disabled,
      createValidation
    }
  };
}
