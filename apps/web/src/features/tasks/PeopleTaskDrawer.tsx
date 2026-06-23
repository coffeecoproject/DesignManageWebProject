import {
  AuditOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TeamOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import type { StoreTaskRecord } from './TaskManagementState';
import { TaskDetailTable } from './components/TaskDetailTable';
import {
  getPersonTaskOperationRecords,
  getPersonTaskRows,
  getPersonTaskStatusLabel,
  getPersonTaskStatusTone,
  type PersonTaskSummary
} from './personTaskViewModel';

type PeopleTaskDrawerProps = {
  activeSummary?: PersonTaskSummary;
  getBrandName: (task: StoreTaskRecord) => string;
  getCustomerName: (task: StoreTaskRecord) => string;
  getStoreLabel: (task: StoreTaskRecord) => string;
  getTaskTypeName: (task: StoreTaskRecord) => string;
  open: boolean;
  onClose: () => void;
};

export function PeopleTaskDrawer({
  activeSummary,
  getBrandName,
  getCustomerName,
  getStoreLabel,
  getTaskTypeName,
  open,
  onClose
}: PeopleTaskDrawerProps) {
  const member = activeSummary?.member;
  const allRows = activeSummary ? getPersonTaskRows(activeSummary, 'all') : [];
  const executorRows = activeSummary ? getPersonTaskRows(activeSummary, 'executor') : [];
  const acceptorRows = activeSummary ? getPersonTaskRows(activeSummary, 'acceptor') : [];
  const completedRows = activeSummary ? getPersonTaskRows(activeSummary, 'completed') : [];
  const exceptionRows = activeSummary ? getPersonTaskRows(activeSummary, 'exception') : [];
  const operationRecords = activeSummary ? getPersonTaskOperationRecords(activeSummary) : [];

  return (
    <DetailDrawerShell
      closeAction={{ label: '关闭', onClick: onClose }}
      open={open}
      title={
        activeSummary && member ? (
          <DetailDrawerTitle
            status={getPersonTaskStatusLabel(member)}
            statusTone={getPersonTaskStatusTone(member.status)}
            subtitle="任务管理 / 人员任务"
            title={member.name}
          />
        ) : null
      }
      width={960}
      onClose={onClose}
    >
      {activeSummary && member ? (
        <div className="rule-readonly-stack">
          <DetailSummaryCards
            columns={3}
            items={[
              { icon: <FileTextOutlined />, key: 'current', label: '当前任务', value: activeSummary.involvedTasks.length },
              { icon: <CheckCircleOutlined />, key: 'completed', label: '已完成', value: activeSummary.completedTasks.length },
              { icon: <ReloadOutlined />, key: 'executor', label: '执行中', value: activeSummary.inProgressTasks.length },
              { icon: <FileTextOutlined />, key: 'acceptor', label: '待验收', value: activeSummary.pendingAcceptanceTasks.length },
              { icon: <WarningOutlined />, key: 'exception', label: '异常任务', value: exceptionRows.length },
              { icon: <AuditOutlined />, key: 'rejectionCount', label: '驳回次数', value: activeSummary.rejectionCount }
            ]}
          />

          <DetailTabs
            tabTestIdPrefix="people-task-detail-tab"
            testId="people-task-detail-tabs"
            items={[
              {
                key: 'summary',
                label: '任务概况',
                children: (
                  <>
                    <DetailSection icon={<TeamOutlined />} title="人员状态">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '人员编号', value: member.id },
                          { label: '岗位', value: member.position },
                          { label: '人员状态', value: getPersonTaskStatusLabel(member) },
                          { label: '任务参与', value: member.taskAccessStatus },
                          { label: '任务能力', value: `${member.taskCapabilityIds.length} 项` },
                          { label: '综合绩效', value: `${member.workEvaluationSummary.score} 分` },
                          { label: '当前未闭环', value: `${activeSummary.involvedTasks.length} 项` },
                          { label: '已完成', value: `${activeSummary.completedTasks.length} 项` },
                          { label: '驳回次数', value: `${activeSummary.rejectionCount} 次` }
                        ]}
                      />
                    </DetailSection>
                    <DetailSection icon={<FileTextOutlined />} title="当前任务">
                      <TaskDetailTable
                        getBrandName={getBrandName}
                        getCustomerName={getCustomerName}
                        getStoreLabel={getStoreLabel}
                        getTaskTypeName={getTaskTypeName}
                        rows={allRows}
                        showCustomer
                      />
                    </DetailSection>
                  </>
                )
              },
              {
                key: 'completed',
                label: '已完成',
                children: (
                  <DetailSection icon={<CheckCircleOutlined />} title="已完成任务">
                    <TaskDetailTable
                      emptyText="暂无已完成任务"
                      getBrandName={getBrandName}
                      getCustomerName={getCustomerName}
                      getStoreLabel={getStoreLabel}
                      getTaskTypeName={getTaskTypeName}
                      rows={completedRows}
                      showCustomer
                    />
                  </DetailSection>
                )
              },
              {
                key: 'executor',
                label: '执行任务',
                children: (
                  <DetailSection icon={<ReloadOutlined />} title="执行任务">
                    <TaskDetailTable
                      getBrandName={getBrandName}
                      getCustomerName={getCustomerName}
                      getStoreLabel={getStoreLabel}
                      getTaskTypeName={getTaskTypeName}
                      rows={executorRows}
                      showCustomer
                    />
                  </DetailSection>
                )
              },
              {
                key: 'acceptor',
                label: '验收任务',
                children: (
                  <DetailSection icon={<CheckCircleOutlined />} title="验收任务">
                    <TaskDetailTable
                      getBrandName={getBrandName}
                      getCustomerName={getCustomerName}
                      getStoreLabel={getStoreLabel}
                      getTaskTypeName={getTaskTypeName}
                      rows={acceptorRows}
                      showCustomer
                    />
                  </DetailSection>
                )
              },
              {
                key: 'records',
                label: '操作记录',
                children: <OperationRecordSection icon={<AuditOutlined />} records={operationRecords} title="操作记录" />
              }
            ]}
          />
        </div>
      ) : null}
    </DetailDrawerShell>
  );
}
