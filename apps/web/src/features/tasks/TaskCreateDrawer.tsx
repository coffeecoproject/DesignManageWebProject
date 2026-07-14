import { ClockCircleOutlined, FileDoneOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Input, InputNumber, Select, Space } from 'antd';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import type { BrandRecord, StoreRecord } from '../customers/customerData';
import { TaskAssignmentCandidatePicker } from './TaskAssignmentCandidateSelect';
import { TaskFileDraftEditor } from './TaskFileDraftEditor';
import { formatTaskDuration, type StoreTaskFileType } from './TaskManagementState';
import { taskWorkdayEndHour, taskWorkdayStartHour } from './taskScheduling';
import type { TaskCreateFormState } from './useTaskCreateFormState';

type TaskCreateDrawerFormState = Pick<TaskCreateFormState, 'actions' | 'candidates' | 'derived' | 'form' | 'validation'>;

type TaskCreateDrawerProps = {
  brandRows: BrandRecord[];
  formState: TaskCreateDrawerFormState;
  materialTypeOptions: StoreTaskFileType[];
  open: boolean;
  storeRows: StoreRecord[];
  onClose: () => void;
  onCreate: () => void;
};

export function TaskCreateDrawer({
  brandRows,
  formState,
  materialTypeOptions,
  open,
  storeRows,
  onClose,
  onCreate
}: TaskCreateDrawerProps) {
  const {
    actions: {
      addMaterial: onMaterialAdd,
      changeAcceptor: onAcceptorChange,
      changeBrand: onBrandChange,
      changeExecutor: onExecutorChange,
      changeLaborGrossAmount: onLaborGrossAmountChange,
      changeMaterial: onMaterialChange,
      changeNote: onNoteChange,
      changePlannedDurationHours: onPlannedDurationHoursChange,
      changeStore: onStoreChange,
      changeTaskConfig: onTaskConfigChange,
      removeMaterial: onMaterialRemove
    },
    candidates: { acceptorCandidates, executorCandidates, selectableExecutorCandidates, selectedExecutorCandidate },
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
    validation: { createDisabled }
  } = formState;
  const selectableExecutorCount = selectableExecutorCandidates.length;

  return (
    <DrawerFormShell
      className="task-list-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      layout="plain"
      open={open}
      primaryAction={{ disabled: createDisabled, label: '创建任务', onClick: onCreate }}
      title={<DetailDrawerTitle subtitle="任务管理 / 任务列表" title="新增任务" />}
      width={840}
      onClose={onClose}
    >
      <div className="rule-readonly-stack">
        <DetailSection icon={<FileTextOutlined />} title="任务信息">
          <DrawerFormGrid>
            <DrawerFormField label="品牌" required>
              <Select value={form.brandId} options={brandRows.map((brand) => ({ label: brand.name, value: brand.id }))} onChange={onBrandChange} />
            </DrawerFormField>
            <DrawerFormField label="门店" required>
              <Select
                value={form.storeId}
                options={storeRows
                  .filter((store) => store.brandId === form.brandId)
                  .map((store) => ({ label: `${store.name} / ${store.city}`, value: store.id }))}
                onChange={onStoreChange}
              />
            </DrawerFormField>
            <DrawerFormField label="任务类型" required>
              <Select
                disabled={availableTaskOptions.length === 0}
                value={form.taskConfigId}
                options={availableTaskOptions.map((option) => ({
                  label: option.taskConfig.name,
                  value: option.taskConfig.id
                }))}
                onChange={onTaskConfigChange}
              />
            </DrawerFormField>
            <DrawerFormField label="预计用时" required>
              <Space.Compact className="field-control task-duration-control">
                <InputNumber
                  className="task-duration-number"
                  min={1}
                  precision={0}
                  placeholder="填写小时数"
                  value={form.plannedDurationHours ?? undefined}
                  onChange={onPlannedDurationHoursChange}
                />
                <Input className="task-duration-unit" readOnly value="小时" />
              </Space.Compact>
            </DrawerFormField>
            <ReadOnlyField density="compact" label="预计交付时间" value={generatedPlannedDeliveryAt || '填写预计用时后生成'} />
            <DrawerFormField label="执行人" required>
              <TaskAssignmentCandidatePicker
                candidates={executorCandidates}
                disabled={!generatedPlannedDeliveryAt}
                disabledReason="请先填写预计用时"
                placeholder="请选择执行人"
                title="选择执行人"
                value={form.executorId}
                onChange={onExecutorChange}
              />
            </DrawerFormField>
            <DrawerFormField label="验收人" required>
              <TaskAssignmentCandidatePicker
                candidates={acceptorCandidates}
                disabled={!generatedPlannedDeliveryAt}
                disabledReason="请先填写预计用时"
                placeholder="请选择验收人"
                title="选择验收人"
                value={form.acceptorId}
                onChange={onAcceptorChange}
              />
            </DrawerFormField>
            {selectedExecutorCandidate?.member.personnelType === '兼职' ? (
              <>
                <DrawerFormField label="约定税前金额" required>
                  <Space.Compact className="field-control task-duration-control">
                    <InputNumber
                      className="task-duration-number"
                      min={0.01}
                      precision={2}
                      placeholder="填写税前金额"
                      value={form.laborGrossAmount ?? undefined}
                      onChange={onLaborGrossAmountChange}
                    />
                    <Input className="task-duration-unit" readOnly value="元" />
                  </Space.Compact>
                </DrawerFormField>
                <ReadOnlyField
                  density="compact"
                  label="劳务协议"
                  value={selectedExecutorCandidate.member.contractNo || '未配置'}
                />
              </>
            ) : null}
            <ReadOnlyField density="compact" label="任务名称" value={generatedTaskName || '自动生成'} wide />
            <DrawerFormField label="任务说明" wide>
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} value={form.note} onChange={(event) => onNoteChange(event.target.value)} />
            </DrawerFormField>
          </DrawerFormGrid>
          <div className="task-candidate-notice-stack">
            {generatedPlannedDeliveryAt && form.taskConfigId && selectableExecutorCount === 0 ? (
              <Alert message="当前任务时间内暂无可用执行人，请调整预计用时或维护人员假勤/任务能力。" showIcon type="warning" />
            ) : null}
          </div>
        </DetailSection>

        <DetailSection
          icon={<FileDoneOutlined />}
          title="原始资料"
          extra={
            <Button icon={<PlusOutlined />} onClick={onMaterialAdd}>
              新增资料
            </Button>
          }
        >
          <TaskFileDraftEditor
            drafts={form.materials}
            itemLabel="资料"
            namePlaceholder="例如 客户原始平面资料.pdf"
            typeOptions={materialTypeOptions}
            onChange={onMaterialChange}
            onRemove={onMaterialRemove}
          />
        </DetailSection>

        {availableTaskOptions.length === 0 ? (
          <Alert message={unavailableTaskMessage} showIcon type="warning" />
        ) : (
          <DetailSection icon={<ClockCircleOutlined />} title="任务摘要">
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '客户', value: selectedCustomer?.name },
                { label: '品牌', value: selectedBrand?.name },
                { label: '门店', value: selectedStore ? `${selectedStore.name} / ${selectedStore.city}` : '-' },
                { label: '任务类型', value: selectedTaskConfig?.name },
                {
                  label: '绩效分值',
                  value: selectedBrandTaskOption ? `${selectedBrandTaskOption.scoreItem.score} 分 / ${selectedBrandTaskOption.scoreItem.unit}` : '-'
                },
                { label: '预计用时', value: form.plannedDurationHours ? formatTaskDuration(form.plannedDurationHours) : '-' },
                { label: '预计交付', value: generatedPlannedDeliveryAt || '-' },
                { label: '排期规则', value: `默认工作日历 / ${taskWorkdayStartHour}:00-${taskWorkdayEndHour}:00 / 法定节假日覆盖` },
                { label: '交付要求', value: selectedTaskConfig?.deliveryFileRequirements.join(' / ') ?? '-' }
              ]}
            />
          </DetailSection>
        )}
      </div>
    </DrawerFormShell>
  );
}
