import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  FileDoneOutlined,
  MessageOutlined,
  ShopOutlined,
  WarningOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { CellText, CompactCell } from '../../components/TableCell';
import { feedbackChannelTone } from './TaskClientFeedbackShared';
import type { ClientFeedbackChannel, ClientFeedbackRecord, StoreTaskRecord } from './TaskManagementState';
import { TaskFilesSection } from './components/TaskFilesSection';
import {
  getTaskFeedbackCompletedAt,
  getTaskFeedbackOperationRecords,
  type TaskFeedbackSummary,
  type TaskInternalReworkRecord
} from './taskFeedbackModel';

type TaskFeedbackDrawerProps = {
  activeSummary?: TaskFeedbackSummary;
  getBrandName: (task: StoreTaskRecord) => string;
  getCustomerName: (task: StoreTaskRecord) => string;
  getStoreLabel: (task: StoreTaskRecord) => string;
  getTaskTypeName: (task: StoreTaskRecord) => string;
  open: boolean;
  onClose: () => void;
};

export function TaskFeedbackDrawer({
  activeSummary,
  getBrandName,
  getCustomerName,
  getStoreLabel,
  getTaskTypeName,
  open,
  onClose
}: TaskFeedbackDrawerProps) {
  const task = activeSummary?.task;
  const reworkColumns = useMemo<TableColumnsType<TaskInternalReworkRecord>>(
    () => [
      {
        title: '次数',
        dataIndex: 'sequence',
        align: 'center',
        width: 72,
        render: (sequence: number) => <CellText>{sequence}</CellText>
      },
      {
        title: '驳回时间',
        dataIndex: 'rejectedAt',
        width: 140
      },
      {
        title: '验收人',
        dataIndex: 'rejectedBy',
        align: 'center',
        width: 100
      },
      {
        title: '驳回原因',
        dataIndex: 'reason',
        width: 220
      },
      {
        title: '整改要求',
        dataIndex: 'requirement',
        width: 260
      }
    ],
    []
  );
  const clientFeedbackColumns = useMemo<TableColumnsType<ClientFeedbackRecord>>(
    () => [
      {
        title: '反馈时间',
        dataIndex: 'feedbackAt',
        width: 140
      },
      {
        title: '反馈人',
        key: 'feedbackBy',
        width: 150,
        render: (_, record) => <CompactCell align="center" primary={record.feedbackBy} secondary={record.feedbackRole || record.feedbackPhone || '-'} />
      },
      {
        title: '渠道',
        dataIndex: 'channel',
        align: 'center',
        width: 92,
        render: (channel: ClientFeedbackChannel) => <StatusTag toneMap={feedbackChannelTone} value={channel} />
      },
      {
        title: '反馈摘要',
        dataIndex: 'summary',
        width: 260
      },
      {
        title: '截图',
        key: 'files',
        align: 'center',
        width: 80,
        render: (_, record) => <CellText>{record.files.length} 张</CellText>
      },
      {
        title: '登记人',
        dataIndex: 'recorder',
        align: 'center',
        width: 92
      }
    ],
    []
  );
  const feedbackFiles = activeSummary?.clientFeedbackRows.flatMap((record) => record.files) ?? [];
  const operationRecords = activeSummary ? getTaskFeedbackOperationRecords(activeSummary) : [];

  return (
    <DetailDrawerShell
      closeAction={{ label: '关闭', onClick: onClose }}
      open={open}
      title={
        activeSummary && task ? (
          <DetailDrawerTitle
            status="反馈归档"
            statusTone="blue"
            subtitle="任务管理 / 任务反馈"
            title={task.name}
          />
        ) : null
      }
      width={980}
      onClose={onClose}
    >
      {activeSummary && task ? (
        <div className="rule-readonly-stack">
          <DetailSummaryCards
            columns={4}
            items={[
              { icon: <CheckCircleOutlined />, key: 'completedAt', label: '完成时间', value: getTaskFeedbackCompletedAt(activeSummary) },
              { icon: <WarningOutlined />, key: 'rework', label: '驳回次数', value: `${activeSummary.internalRejectionCount} 次` },
              { icon: <CommentOutlined />, key: 'clientFeedback', label: '甲方反馈', value: `${activeSummary.clientFeedbackCount} 次` },
              { icon: <ClockCircleOutlined />, key: 'latest', label: '最近反馈', value: activeSummary.latestFeedbackAt }
            ]}
          />

          <DetailTabs
            tabTestIdPrefix="task-feedback-detail-tab"
            testId="task-feedback-detail-tabs"
            items={[
              {
                key: 'overview',
                label: '反馈概览',
                children: (
                  <DetailSection icon={<ShopOutlined />} title="任务上下文">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '任务编号', value: task.code },
                        { label: '任务类型', value: getTaskTypeName(task) },
                        { label: '客户', value: getCustomerName(task) },
                        { label: '品牌', value: getBrandName(task) },
                        { label: '门店', value: getStoreLabel(task) },
                        { label: '执行人', value: task.executorName ?? '-' },
                        { label: '验收人', value: task.acceptorName },
                        { label: '计划交付', value: task.plannedDeliveryAt },
                        { label: '完成时间', value: getTaskFeedbackCompletedAt(activeSummary) }
                      ]}
                    />
                  </DetailSection>
                )
              },
              {
                key: 'internalRework',
                label: '内部驳回',
                children: (
                  <DetailSection icon={<WarningOutlined />} title="内部驳回记录">
                    <CompactDetailTable<TaskInternalReworkRecord>
                      columns={reworkColumns}
                      dataSource={activeSummary.internalReworkRecords}
                      emptyText="暂无内部驳回记录"
                      rowKey="id"
                      scrollX={840}
                    />
                  </DetailSection>
                )
              },
              {
                key: 'clientFeedback',
                label: '甲方反馈',
                children: (
                  <>
                    <DetailSection icon={<MessageOutlined />} title="甲方反馈记录">
                      <CompactDetailTable<ClientFeedbackRecord>
                        columns={clientFeedbackColumns}
                        dataSource={activeSummary.clientFeedbackRows}
                        emptyText="暂无甲方反馈记录"
                        rowKey="id"
                        scrollX={860}
                      />
                    </DetailSection>
                    <TaskFilesSection emptyText="暂无反馈截图" icon={<FileDoneOutlined />} records={feedbackFiles} title="反馈截图" />
                  </>
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
