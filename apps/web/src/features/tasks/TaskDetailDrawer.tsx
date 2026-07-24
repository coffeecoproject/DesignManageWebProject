import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  ReloadOutlined,
  ShopOutlined,
  StarOutlined
} from '@ant-design/icons';
import { DatePicker, Input, InputNumber, Segmented } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { TagChip } from '../../components/TagChip';
import type { StoreRecord } from '../customers/customerData';
import { formatTaskDuration, type StoreTaskRecord } from './TaskManagementState';
import { getTaskStoreContext, getTaskTypeName, isTaskClosed, taskStatusTone } from './taskDisplayModel';
import { TaskFilesSection } from './components/TaskFilesSection';
import { TaskDeadlineStatus, TaskStatusTag } from './components/TaskStatusTag';
import {
  getCustomerTaskAcceptanceStatus,
  getCustomerTaskAcceptanceValidationMessage,
  type CustomerTaskAcceptanceInput
} from './taskCustomerAcceptanceModel';
import {
  calculateBrandAcceptance,
  type BrandAcceptanceTimelinessResult
} from '../customers/brandAcceptancePolicyModel';

type TaskDetailDrawerProps = {
  getBrandName: (brandId: string) => string;
  getCustomerName: (customerId: string) => string;
  onClose: () => void;
  onReverseAcceptance: (record: StoreTaskRecord) => void;
  onSaveCustomerAcceptance: (record: StoreTaskRecord, input: CustomerTaskAcceptanceInput) => boolean;
  onTerminate: (record: StoreTaskRecord) => void;
  open: boolean;
  storeRows: StoreRecord[];
  task?: StoreTaskRecord;
};

export function TaskDetailDrawer({
  getBrandName,
  getCustomerName,
  onClose,
  onReverseAcceptance,
  onSaveCustomerAcceptance,
  onTerminate,
  open,
  storeRows,
  task
}: TaskDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const [customerAcceptanceEditing, setCustomerAcceptanceEditing] = useState(false);
  const [customerAcceptanceForm, setCustomerAcceptanceForm] = useState<CustomerTaskAcceptanceInput>({
    acceptedOn: '',
    correctionReason: '',
    remark: '',
    score: null,
    timelinessResult: null
  });
  const storeContext = task ? getTaskStoreContext(storeRows, task.storeId) : undefined;
  const customerAcceptanceStatus = task ? getCustomerTaskAcceptanceStatus(task) : '不适用';
  const customerAcceptanceValidation = task
    ? getCustomerTaskAcceptanceValidationMessage(task, customerAcceptanceForm)
    : '未找到任务记录';

  useEffect(() => {
    setActiveTab('profile');
    setCustomerAcceptanceEditing(false);
    setCustomerAcceptanceForm({
      acceptedOn: task?.customerAcceptance?.acceptedOn ?? task?.acceptedAt?.slice(0, 10) ?? '',
      correctionReason: '',
      remark: task?.customerAcceptance?.remark ?? '',
      score: task?.customerAcceptance?.score ?? null,
      timelinessResult: task?.customerAcceptance?.timelinessResult ?? null
    });
  }, [open, task?.id]);

  function startCustomerAcceptanceEdit() {
    if (!task) {
      return;
    }

    setCustomerAcceptanceForm({
      acceptedOn: task.customerAcceptance?.acceptedOn ?? task.acceptedAt?.slice(0, 10) ?? '',
      correctionReason: '',
      remark: task.customerAcceptance?.remark ?? '',
      score: task.customerAcceptance?.score ?? null,
      timelinessResult: task.customerAcceptance?.timelinessResult ?? null
    });
    setActiveTab('customerAcceptance');
    setCustomerAcceptanceEditing(true);
  }

  function cancelCustomerAcceptanceEdit() {
    setCustomerAcceptanceEditing(false);
    setCustomerAcceptanceForm({
      acceptedOn: task?.customerAcceptance?.acceptedOn ?? task?.acceptedAt?.slice(0, 10) ?? '',
      correctionReason: '',
      remark: task?.customerAcceptance?.remark ?? '',
      score: task?.customerAcceptance?.score ?? null,
      timelinessResult: task?.customerAcceptance?.timelinessResult ?? null
    });
  }

  function saveCustomerAcceptance() {
    if (!task || customerAcceptanceValidation || !onSaveCustomerAcceptance(task, customerAcceptanceForm)) {
      return;
    }

    setCustomerAcceptanceEditing(false);
  }

  const standardAmount = task?.customerBillingSnapshot?.unitPrice ?? 0;
  const editingCalculation = customerAcceptanceEditing
    && task?.customerBillingSnapshot
    && customerAcceptanceForm.score !== null
    && customerAcceptanceForm.timelinessResult
      ? calculateBrandAcceptance({
          policy: task.customerBillingSnapshot.acceptancePolicy,
          score: customerAcceptanceForm.score,
          standardAmount,
          timelinessResult: customerAcceptanceForm.timelinessResult
        })
      : undefined;
  const deductionAmount = editingCalculation?.deductionAmount ?? task?.customerAcceptance?.deductionAmount ?? 0;
  const finalAmount = editingCalculation?.finalAmount ?? task?.customerAcceptance?.finalAmount ?? standardAmount;
  const money = (value: number) => `${value.toFixed(2)} 元`;

  return (
    <DetailDrawerShell
      className="task-list-drawer"
      closeAction={customerAcceptanceEditing ? undefined : { label: '关闭', onClick: onClose }}
      cancelAction={customerAcceptanceEditing ? { label: '取消', onClick: cancelCustomerAcceptanceEdit } : undefined}
      open={open}
      primaryAction={
        task && customerAcceptanceStatus !== '不适用'
          ? customerAcceptanceEditing
            ? {
                disabled: Boolean(customerAcceptanceValidation),
                label: '保存甲方验收',
                onClick: saveCustomerAcceptance
              }
            : {
                label: task.customerAcceptance ? '更正甲方验收' : '录入甲方验收',
                onClick: startCustomerAcceptanceEdit
              }
          : undefined
      }
      secondaryAction={
        !customerAcceptanceEditing && task?.status === '已完成'
          ? {
              danger: true,
              label: '撤销验收',
              onClick: () => onReverseAcceptance(task)
            }
          : task && !isTaskClosed(task)
          ? {
              danger: true,
              label: '中止任务',
              onClick: () => onTerminate(task)
            }
          : undefined
      }
      title={task ? <DetailDrawerTitle status={task.status} statusToneMap={taskStatusTone} subtitle="任务管理 / 任务列表" title={task.name} /> : null}
      width={920}
      onClose={onClose}
    >
      {task ? (
        <div className="rule-readonly-stack">
          <DetailSummaryCards
            columns={4}
            items={[
              { icon: <FileTextOutlined />, key: 'status', label: '状态', value: task.status },
              {
                icon: <ClockCircleOutlined />,
                key: 'plannedSchedule',
                label: '计划',
                value: `${formatTaskDuration(task.plannedDurationHours)} / ${task.plannedDeliveryAt}`
              },
              { icon: <ReloadOutlined />, key: 'executor', label: '执行', value: task.executorName ?? '-' },
              { icon: <CheckCircleOutlined />, key: 'acceptor', label: '验收', value: task.acceptorName ?? '-' }
            ]}
          />

          <DetailTabs
            activeKey={activeTab}
            tabTestIdPrefix="task-store-detail-tab"
            testId="task-store-detail-tabs"
            onChange={setActiveTab}
            items={[
              {
                key: 'profile',
                label: '任务资料',
                children: (
                  <>
                    <DetailSection icon={<ShopOutlined />} title="客户门店">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '客户', value: getCustomerName(task.customerId) },
                          { label: '品牌', value: getBrandName(task.brandId) },
                          { label: '门店', value: storeContext?.storeCityLabel ?? '-' },
                          { label: '任务编号', value: task.code },
                          { label: '任务类型', value: getTaskTypeName(task) },
                          { label: '执行人', value: task.executorName ?? '-' },
                          { label: '验收人', value: task.acceptorName ?? '-' }
                        ]}
                      />
                    </DetailSection>
                    <DetailSection icon={<ClockCircleOutlined />} title="交付计划">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '创建时间', value: task.createdAt },
                          { label: '计划时效', value: formatTaskDuration(task.plannedDurationHours) },
                          { label: '计划交付', value: task.plannedDeliveryAt },
                          { label: '交付状态', value: <TaskDeadlineStatus task={task} /> },
                          { label: '提交时间', value: task.submittedAt ?? '-' },
                          { label: '验收时间', value: task.acceptedAt ?? '-' },
                          { label: '最近更新', value: task.updatedAt },
                          { label: '任务说明', value: task.note }
                        ]}
                      />
                    </DetailSection>
                  </>
                )
              },
              {
                key: 'delivery',
                label: '交付验收',
                children: (
                  <>
                    <DetailSection icon={<CheckCircleOutlined />} title="验收结果">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '当前状态', value: <TaskStatusTag status={task.status} /> },
                          { label: '验收人', value: task.acceptorName ?? '-' },
                          { label: '验收时间', value: task.acceptedAt ?? '-' },
                          { label: '驳回次数', value: `${task.reworkCount} 次` },
                          { label: '驳回原因', value: task.latestReworkReason ?? '-' },
                          { label: '整改要求', value: task.latestReworkRequirement ?? '-' }
                        ]}
                      />
                    </DetailSection>
                    <TaskFilesSection
                      emptyText="暂无飞书文件链接记录，任务提交后可登记交付文件链接。"
                      icon={<FileDoneOutlined />}
                      records={task.files}
                      title="相关文件"
                    />
                  </>
                )
              },
              {
                key: 'customerAcceptance',
                label: '甲方验收',
                children: (
                  <DetailSection icon={<StarOutlined />} title="甲方验收">
                    {customerAcceptanceEditing ? (
                      <>
                        <DetailInfoGrid
                          columns={4}
                          items={[
                            { label: '标准结算金额', value: money(standardAmount) },
                            { label: '质量扣罚', value: `${editingCalculation?.qualityPenaltyPoints ?? 0} 分` },
                            { label: '时效扣罚', value: `${editingCalculation?.timelinessPenaltyPoints ?? 0} 分` },
                            { label: '累计扣罚', value: `${editingCalculation?.totalPenaltyPoints ?? 0} 分` },
                            { label: '扣款比例', value: `${Math.round((editingCalculation?.deductionRate ?? 0) * 100)}%` },
                            { label: '扣款金额', value: money(deductionAmount) },
                            { label: '最终结算金额', value: money(finalAmount) }
                          ]}
                        />
                        <DrawerFormGrid>
                          <DrawerFormField label="甲方验收日期" required>
                            <DatePicker
                              allowClear={false}
                              value={customerAcceptanceForm.acceptedOn ? dayjs(customerAcceptanceForm.acceptedOn) : null}
                              onChange={(value) => setCustomerAcceptanceForm((current) => ({
                                ...current,
                                acceptedOn: value?.format('YYYY-MM-DD') ?? ''
                              }))}
                            />
                          </DrawerFormField>
                          <DrawerFormField label="甲方评分" required>
                            <InputNumber
                              max={100}
                              min={0}
                              precision={0}
                              value={customerAcceptanceForm.score}
                              onChange={(score) => setCustomerAcceptanceForm((current) => ({ ...current, score }))}
                            />
                          </DrawerFormField>
                          <DrawerFormField label="时效结果" required>
                            <Segmented
                              block
                              options={['未超时', '超时', '不计时']}
                              value={customerAcceptanceForm.timelinessResult ?? undefined}
                              onChange={(timelinessResult) => setCustomerAcceptanceForm((current) => ({
                                ...current,
                                timelinessResult: timelinessResult as BrandAcceptanceTimelinessResult
                              }))}
                            />
                          </DrawerFormField>
                          <DrawerFormField
                            label="备注"
                            required={(editingCalculation?.totalPenaltyPoints ?? 0) > 0 || customerAcceptanceForm.timelinessResult === '不计时'}
                            wide
                          >
                            <Input.TextArea
                              autoSize={{ minRows: 3, maxRows: 6 }}
                              maxLength={200}
                              showCount
                              value={customerAcceptanceForm.remark}
                              onChange={(event) => setCustomerAcceptanceForm((current) => ({
                                ...current,
                                remark: event.target.value
                              }))}
                            />
                          </DrawerFormField>
                          {task.customerAcceptance ? (
                            <DrawerFormField label="更正原因" required wide>
                              <Input.TextArea
                                autoSize={{ minRows: 3, maxRows: 6 }}
                                maxLength={200}
                                showCount
                                value={customerAcceptanceForm.correctionReason}
                                onChange={(event) => setCustomerAcceptanceForm((current) => ({
                                  ...current,
                                  correctionReason: event.target.value
                                }))}
                              />
                            </DrawerFormField>
                          ) : null}
                        </DrawerFormGrid>
                      </>
                    ) : (
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          {
                            label: '验收状态',
                            value: customerAcceptanceStatus === '不适用'
                              ? '-'
                              : <TagChip
                                  label={customerAcceptanceStatus}
                                  tone={customerAcceptanceStatus === '已完成' ? 'green' : 'amber'}
                                />
                          },
                          { label: '甲方评分', value: task.customerAcceptance ? `${task.customerAcceptance.score} 分` : '-' },
                          { label: '时效结果', value: task.customerAcceptance?.timelinessResult ?? '-' },
                          { label: '标准结算金额', value: customerAcceptanceStatus === '不适用' ? '-' : money(standardAmount) },
                          { label: '质量扣罚', value: task.customerAcceptance ? `${task.customerAcceptance.qualityPenaltyPoints} 分` : '-' },
                          { label: '时效扣罚', value: task.customerAcceptance ? `${task.customerAcceptance.timelinessPenaltyPoints} 分` : '-' },
                          { label: '累计扣罚', value: task.customerAcceptance ? `${task.customerAcceptance.totalPenaltyPoints} 分` : '-' },
                          { label: '扣款比例', value: task.customerAcceptance ? `${Math.round(task.customerAcceptance.deductionRate * 100)}%` : '-' },
                          { label: '扣款金额', value: task.customerAcceptance ? money(task.customerAcceptance.deductionAmount) : '-' },
                          { label: '最终结算金额', value: task.customerAcceptance ? money(finalAmount) : '-' },
                          { label: '甲方验收日期', value: task.customerAcceptance?.acceptedOn ?? '-' },
                          { label: '备注', value: task.customerAcceptance?.remark || '-' },
                          ...(task.customerAcceptance?.correctionReason
                            ? [{ label: '最近更正原因', value: task.customerAcceptance.correctionReason }]
                            : [])
                        ]}
                      />
                    )}
                  </DetailSection>
                )
              },
              {
                key: 'records',
                label: '操作记录',
                children: <OperationRecordSection icon={<AuditOutlined />} records={task.operationRecords} title="操作记录" />
              }
            ]}
          />
        </div>
      ) : null}
    </DetailDrawerShell>
  );
}
