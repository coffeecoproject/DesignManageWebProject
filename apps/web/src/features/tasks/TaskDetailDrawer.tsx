import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  ReloadOutlined,
  ShopOutlined
} from '@ant-design/icons';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import type { StoreRecord } from '../customers/customerData';
import type { TaskConfigRow } from '../system/TaskConfigState';
import { formatTaskDuration, type StoreTaskRecord } from './TaskManagementState';
import { getTaskStoreContext, getTaskTypeName, isTaskClosed, taskStatusTone } from './taskDisplayModel';
import { TaskFilesSection } from './components/TaskFilesSection';
import { TaskDeadlineStatus, TaskStatusTag } from './components/TaskStatusTag';

type TaskDetailDrawerProps = {
  getBrandName: (brandId: string) => string;
  getCustomerName: (customerId: string) => string;
  onClose: () => void;
  onReverseAcceptance: (record: StoreTaskRecord) => void;
  onTerminate: (record: StoreTaskRecord) => void;
  open: boolean;
  storeRows: StoreRecord[];
  task?: StoreTaskRecord;
  taskConfigRows: TaskConfigRow[];
};

export function TaskDetailDrawer({
  getBrandName,
  getCustomerName,
  onClose,
  onReverseAcceptance,
  onTerminate,
  open,
  storeRows,
  task,
  taskConfigRows
}: TaskDetailDrawerProps) {
  const storeContext = task ? getTaskStoreContext(storeRows, task.storeId) : undefined;

  return (
    <DetailDrawerShell
      className="task-list-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={open}
      secondaryAction={
        task?.status === '已完成'
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
            tabTestIdPrefix="task-store-detail-tab"
            testId="task-store-detail-tabs"
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
                          { label: '任务类型', value: getTaskTypeName(task.taskConfigId, taskConfigRows) },
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
