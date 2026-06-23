import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  IdcardOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag, type StatusTagTone } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { TagChip } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import type { PeopleArchiveFile, PeopleWorkEvaluationRecord } from '../people/peopleTypes';
import type { SalaryCompositionLine, SalaryMonthlyReport, SalarySettlementSourceRecord } from '../salary/salaryDomain';
import { formatSalaryMoney } from '../salary/salaryDomain';
import type { StoreTaskRecord } from '../tasks/TaskManagementState';
import { TaskDetailTable, type TaskDetailTableRow } from '../tasks/components/TaskDetailTable';
import { TaskFilesSection } from '../tasks/components/TaskFilesSection';
import { TaskScheduleCell } from '../tasks/components/TaskScheduleCell';
import { TaskStatusTag } from '../tasks/components/TaskStatusTag';
import { TaskAcceptanceWorkbench, TaskSubmitWorkbench } from '../tasks/TaskWorkflowPages';
import { useMyWorkData } from './MyWorkShared';
import type { MyWorkPerformanceTaskRow } from './myWorkModel';

const missingCurrentMemberId = '__missing-current-member__';

const statusToneMap: Record<string, StatusTagTone> = {
  已齐全: 'green',
  待补充: 'amber',
  已归档: 'gray',
  结算中: 'amber',
  待确认: 'amber',
  已确认: 'blue',
  已结算: 'green',
  已计入: 'green',
  不计入: 'gray',
  试用期: 'amber',
  在职: 'green',
  离职: 'gray',
  合作中: 'blue',
  结束合作: 'gray'
};

function getPersonnelStatus(member: { personnelType: string; status: string }) {
  return `${member.personnelType} / ${member.status}`;
}

function getArchiveFileTone(status: PeopleArchiveFile['status']): StatusTagTone {
  if (status === '已上传') {
    return 'green';
  }

  if (status === '待补充') {
    return 'amber';
  }

  return 'gray';
}

function MyWorkProfileSummary() {
  const { archiveSummary, latestSalaryReport, member, taskSummary } = useMyWorkData();

  if (!member || !archiveSummary) {
    return null;
  }

  return (
    <DetailSection icon={<UserOutlined />} title="个人摘要">
      <DetailInfoGrid
        columns={4}
        items={[
          { label: '姓名', value: member.name },
          { label: '岗位', value: member.position },
          { label: '人员状态', value: <StatusTag tone={statusToneMap[member.status]} value={getPersonnelStatus(member)} /> },
          { label: '所在城市', value: member.city },
          { label: '当前任务', value: `${taskSummary.currentTaskCount} 项` },
          { label: '档案状态', value: <StatusTag tone={statusToneMap[archiveSummary.status]} value={archiveSummary.status} /> },
          { label: '最近薪资', value: latestSalaryReport ? `${latestSalaryReport.month} / ${latestSalaryReport.status}` : '暂无' },
          { label: '综合绩效', value: `${member.workEvaluationSummary.score} 分` }
        ]}
      />
    </DetailSection>
  );
}

function CurrentTaskSection({ rows }: { rows: TaskDetailTableRow[] }) {
  const { getBrandName, getCustomerName, getStoreLabel, getTaskTypeName } = useMyWorkData();

  return (
    <DetailSection icon={<FileTextOutlined />} title="当前任务">
      <TaskDetailTable
        emptyText="暂无当前任务"
        getBrandName={getBrandName}
        getCustomerName={getCustomerName}
        getStoreLabel={getStoreLabel}
        getTaskTypeName={getTaskTypeName}
        rows={rows}
        showCustomer
      />
    </DetailSection>
  );
}

function ArchiveSection() {
  const { archiveSummary, member } = useMyWorkData();

  if (!member || !archiveSummary) {
    return null;
  }

  return (
    <DetailSection icon={<FileProtectOutlined />} title="档案摘要">
      <DetailInfoGrid
        columns={4}
        items={[
          { label: '档案状态', value: <StatusTag tone={statusToneMap[archiveSummary.status]} value={archiveSummary.status} /> },
          { label: '档案文件', value: `${archiveSummary.fileCount} 份` },
          { label: '待补充', value: `${archiveSummary.pendingFileCount} 份` },
          { label: '最近更新', value: archiveSummary.updatedAt }
        ]}
      />
    </DetailSection>
  );
}

function SalarySection() {
  const { latestSalaryReport } = useMyWorkData();

  return (
    <DetailSection icon={<BankOutlined />} title="薪资摘要">
      <DetailInfoGrid
        columns={4}
        items={[
          { label: '薪资月份', value: latestSalaryReport?.month },
          { label: '结算状态', value: latestSalaryReport ? <StatusTag tone={statusToneMap[latestSalaryReport.status]} value={latestSalaryReport.status} /> : undefined },
          { label: '应发合计', value: latestSalaryReport ? formatSalaryMoney(latestSalaryReport.grossSalary) : undefined },
          { label: '实发工资', value: latestSalaryReport ? formatSalaryMoney(latestSalaryReport.netSalary) : undefined }
        ]}
      />
    </DetailSection>
  );
}

function PerformanceSection() {
  const { member, performanceTaskRows } = useMyWorkData();

  if (!member) {
    return null;
  }

  const latestRecord = member.workEvaluationRecords[0] ?? member.workEvaluationSummary;

  return (
    <DetailSection icon={<BarChartOutlined />} title="绩效摘要">
      <DetailInfoGrid
        columns={4}
        items={[
          { label: '综合绩效', value: `${member.workEvaluationSummary.score} 分` },
          { label: '评级', value: member.workEvaluationSummary.level },
          { label: '最近月份', value: latestRecord.month },
          { label: '任务计分', value: `${performanceTaskRows.length} 条` }
        ]}
      />
    </DetailSection>
  );
}

export function MyWorkOverviewPage() {
  const { latestSalaryReport, member, taskRows, taskSummary } = useMyWorkData();

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={6}>
          <MetricCard icon={<FileTextOutlined />} label="当前任务" value={taskSummary.currentTaskCount} />
          <MetricCard icon={<SendOutlined />} label="待我提交" value={taskSummary.pendingSubmitCount + taskSummary.pendingResubmitCount} />
          <MetricCard icon={<CheckCircleOutlined />} label="待我验收" value={taskSummary.pendingMyAcceptanceCount} />
          <MetricCard icon={<WarningOutlined />} label="异常任务" value={taskSummary.overdueCount + taskSummary.rejectedCount} />
          <MetricCard icon={<BankOutlined />} label="薪资月份" value={latestSalaryReport?.month ?? '-'} />
          <MetricCard icon={<BarChartOutlined />} label="综合绩效" value={member ? `${member.workEvaluationSummary.score} 分` : '-'} />
        </MetricGrid>
      }
    >
      <div className="rule-readonly-stack">
        <MyWorkProfileSummary />
        <CurrentTaskSection rows={taskRows} />
        <div className="my-work-overview-grid">
          <ArchiveSection />
          <SalarySection />
          <PerformanceSection />
        </div>
      </div>
    </ManagementPageScaffold>
  );
}

function MyTaskDrawer({
  activeRow,
  getBrandName,
  getCustomerName,
  getStoreLabel,
  getTaskScoreText,
  getTaskTypeName,
  onClose
}: {
  activeRow?: TaskDetailTableRow;
  getBrandName: (task: StoreTaskRecord) => string;
  getCustomerName: (task: StoreTaskRecord) => string;
  getStoreLabel: (task: StoreTaskRecord) => string;
  getTaskScoreText: (task: StoreTaskRecord) => string;
  getTaskTypeName: (task: StoreTaskRecord) => string;
  onClose: () => void;
}) {
  const task = activeRow?.task;

  return (
    <DetailDrawerShell
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(task)}
      title={
        task ? (
          <DetailDrawerTitle
            status={task.status}
            subtitle={`${getCustomerName(task)} / ${getBrandName(task)} / ${getStoreLabel(task)}`}
            title={task.name}
          />
        ) : null
      }
      width={960}
      onClose={onClose}
    >
      {task ? (
        <DetailTabs
          items={[
            {
              key: 'summary',
              label: '任务资料',
              children: (
                <>
                  <DetailSummaryCards
                    columns={4}
                    items={[
                      { icon: <ProfileOutlined />, key: 'role', label: '我的角色', value: activeRow?.role ?? '-' },
                      { icon: <ClockCircleOutlined />, key: 'duration', label: '计划用时', value: task.plannedDurationHours ? `${task.plannedDurationHours} 小时` : '-' },
                      { icon: <BarChartOutlined />, key: 'score', label: '绩效分值', value: getTaskScoreText(task) },
                      { icon: <SafetyCertificateOutlined />, key: 'status', label: '当前状态', value: task.status }
                    ]}
                  />
                  <DetailSection icon={<FileTextOutlined />} title="任务信息">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '任务编号', value: task.code },
                        { label: '任务类型', value: getTaskTypeName(task) },
                        { label: '计划交付', value: task.plannedDeliveryAt },
                        { label: '执行人', value: task.executorName },
                        { label: '验收人', value: task.acceptorName },
                        { label: '最近更新', value: task.updatedAt },
                        { label: '任务说明', value: task.note, wide: true }
                      ]}
                    />
                  </DetailSection>
                </>
              )
            },
            {
              key: 'files',
              label: '相关文件',
              children: <TaskFilesSection records={task.files} />
            },
            {
              key: 'records',
              label: '操作记录',
              children: <OperationRecordSection records={task.operationRecords} />
            }
          ]}
          tabTestIdPrefix="my-task-detail-tab"
          testId="my-task-detail-tabs"
        />
      ) : null}
    </DetailDrawerShell>
  );
}

export function MyTasksPage() {
  const { getBrandName, getCustomerName, getStoreLabel, getTaskScoreText, getTaskTypeName, taskRows, taskSummary } = useMyWorkData();
  const [activeRowKey, setActiveRowKey] = useState<string>();
  const activeRow = taskRows.find((row) => `${row.task.id}-${row.role}` === activeRowKey);
  const columns = useMemo<TableColumnsType<TaskDetailTableRow>>(
    () => [
      {
        title: '任务',
        key: 'task',
        width: 220,
        render: (_, row) => <CompactCell primary={row.task.name} secondary={row.task.code} />
      },
      {
        title: '角色',
        key: 'role',
        align: 'center',
        width: 86,
        render: (_, row) => <TagChip label={row.role ?? '-'} tone={row.role === '执行' ? 'blue' : 'green'} />
      },
      {
        title: '客户品牌',
        key: 'brand',
        width: 210,
        render: (_, row) => <CompactCell primary={getBrandName(row.task)} secondary={getCustomerName(row.task)} />
      },
      {
        title: '门店',
        key: 'store',
        width: 178,
        render: (_, row) => <CompactCell align="center" primary={getStoreLabel(row.task)} secondary={getTaskTypeName(row.task)} />
      },
      {
        title: '绩效分值',
        key: 'score',
        align: 'center',
        width: 96,
        render: (_, row) => <CellText>{getTaskScoreText(row.task)}</CellText>
      },
      {
        title: '计划',
        key: 'planned',
        align: 'center',
        width: 170,
        render: (_, row) => <TaskScheduleCell task={row.task} />
      },
      {
        title: '状态',
        key: 'status',
        align: 'center',
        width: 104,
        render: (_, row) => <TaskStatusTag status={row.task.status} />
      },
      {
        title: '最近更新',
        dataIndex: ['task', 'updatedAt'],
        align: 'center',
        width: 140
      }
    ],
    [getBrandName, getCustomerName, getStoreLabel, getTaskScoreText, getTaskTypeName]
  );

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<FileTextOutlined />} label="当前任务" value={taskSummary.currentTaskCount} />
          <MetricCard icon={<ReloadOutlined />} label="执行任务" value={taskSummary.executorCount} />
          <MetricCard icon={<CheckCircleOutlined />} label="验收任务" value={taskSummary.acceptorCount} />
          <MetricCard icon={<WarningOutlined />} label="已逾期" value={taskSummary.overdueCount} />
          <MetricCard icon={<ReloadOutlined />} label="退回任务" value={taskSummary.rejectedCount} />
        </MetricGrid>
      }
    >
      <ManagementTable<TaskDetailTableRow>
        columns={columns}
        count={{ unit: '条', value: taskRows.length }}
        dataSource={taskRows}
        rowKey={(row) => `${row.task.id}-${row.role}`}
        rowTestIdPrefix="my-task-row"
        tableTestId="my-task-table"
        onRowClick={(row) => setActiveRowKey(`${row.task.id}-${row.role}`)}
      />
      <MyTaskDrawer
        activeRow={activeRow}
        getBrandName={getBrandName}
        getCustomerName={getCustomerName}
        getStoreLabel={getStoreLabel}
        getTaskScoreText={getTaskScoreText}
        getTaskTypeName={getTaskTypeName}
        onClose={() => setActiveRowKey(undefined)}
      />
    </ManagementPageScaffold>
  );
}

export function MyTaskSubmitPage() {
  const { member } = useMyWorkData();

  return <TaskSubmitWorkbench memberId={member?.id ?? missingCurrentMemberId} renderScaffold />;
}

export function MyTaskAcceptancePage() {
  const { member } = useMyWorkData();

  return <TaskAcceptanceWorkbench memberId={member?.id ?? missingCurrentMemberId} renderScaffold />;
}

export function MyArchivePage() {
  const { archiveSummary, member } = useMyWorkData();
  const fileColumns = useMemo<TableColumnsType<PeopleArchiveFile>>(
    () => [
      {
        title: '文件名称',
        dataIndex: 'name',
        width: 220,
        render: (name: string) => <CellText>{name}</CellText>
      },
      {
        title: '类型',
        dataIndex: 'category',
        align: 'center',
        width: 120
      },
      {
        title: '状态',
        dataIndex: 'status',
        align: 'center',
        width: 112,
        render: (status: PeopleArchiveFile['status']) => <StatusTag tone={getArchiveFileTone(status)} value={status} />
      },
      {
        title: '最近更新',
        dataIndex: 'updatedAt',
        align: 'center',
        width: 140
      }
    ],
    []
  );

  if (!member || !archiveSummary) {
    return null;
  }

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<FileProtectOutlined />} label="档案状态" value={archiveSummary.status} />
          <MetricCard icon={<FileDoneOutlined />} label="档案文件" value={archiveSummary.fileCount} />
          <MetricCard icon={<WarningOutlined />} label="待补充" value={archiveSummary.pendingFileCount} />
          <MetricCard icon={<ClockCircleOutlined />} label="最近更新" value={archiveSummary.updatedAt} />
        </MetricGrid>
      }
    >
      <div className="rule-readonly-stack">
        <DetailTabs
          items={[
            {
              key: 'basic',
              label: '基础资料',
              children: (
                <>
                  <DetailSection icon={<TeamOutlined />} title="基础信息">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '人员编号', value: member.id },
                        { label: '姓名', value: member.name },
                        { label: '人员状态', value: <StatusTag tone={statusToneMap[member.status]} value={getPersonnelStatus(member)} /> },
                        { label: '岗位', value: member.position },
                        { label: '手机号', value: member.mobile },
                        { label: '邮箱', value: member.email },
                        { label: '学历', value: member.education },
                        { label: '所在城市', value: member.city },
                        { label: '人员来源', value: member.source },
                        { label: '居住地址', value: member.address, wide: true }
                      ]}
                    />
                  </DetailSection>
                  <DetailSection icon={<IdcardOutlined />} title="身份与联系">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '证件类型', value: member.idDocumentType },
                        { label: '证件号码', value: member.identityNo },
                        { label: '证件有效期', value: member.idValidUntil },
                        { label: '微信', value: member.wechat },
                        { label: '紧急联系人', value: `${member.emergencyContact} / ${member.emergencyContactRelation}` },
                        { label: '紧急联系电话', value: member.emergencyContactPhone }
                      ]}
                    />
                  </DetailSection>
                </>
              )
            },
            {
              key: 'employment',
              label: '任职合作',
              children: (
                <DetailSection icon={<ProfileOutlined />} title="任职合作">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: member.personnelType === '全职' ? '入职日期' : '合作起始日期', value: member.personnelType === '全职' ? member.joinedAt : member.cooperationStartAt },
                      { label: member.personnelType === '全职' ? '转正日期' : '终止合作日期', value: member.personnelType === '全职' ? member.probationEndAt : member.cooperationEndAt },
                      { label: '合同类型', value: member.contractType },
                      { label: '合同状态', value: member.contractStatus },
                      { label: '合同开始', value: member.contractStartAt },
                      { label: '合同结束', value: member.contractEndAt }
                    ]}
                  />
                </DetailSection>
              )
            },
            {
              key: 'salary',
              label: '薪资收款',
              children: (
                <DetailSection icon={<BankOutlined />} title="薪资收款">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '计薪方式', value: member.paymentProfile.mode === '工资发放' ? '月薪制' : '任务制' },
                      { label: '薪资结构', value: member.salaryProfile.structure },
                      { label: '发放周期', value: member.salaryProfile.payCycle },
                      { label: '开户行', value: member.paymentProfile.bankName },
                      { label: '账户名', value: member.paymentProfile.accountName },
                      { label: '银行卡号', value: member.paymentProfile.bankAccount }
                    ]}
                  />
                </DetailSection>
              )
            },
            {
              key: 'files',
              label: '档案文件',
              children: (
                <DetailSection icon={<FileDoneOutlined />} title="档案文件">
                  <CompactDetailTable<PeopleArchiveFile>
                    columns={fileColumns}
                    dataSource={member.archiveFiles}
                    rowKey="id"
                    scrollX={620}
                  />
                </DetailSection>
              )
            }
          ]}
          testId="my-archive-detail-tabs"
          variant="page-section"
        />
      </div>
    </ManagementPageScaffold>
  );
}

function MySalaryDrawer({ activeReport, onClose }: { activeReport?: SalaryMonthlyReport; onClose: () => void }) {
  const compositionColumns = useMemo<TableColumnsType<SalaryCompositionLine>>(
    () => [
      { title: '项目', dataIndex: 'item', width: 136, render: (item: string) => <CellText>{item}</CellText> },
      { title: '方向', dataIndex: 'direction', align: 'center', width: 96 },
      { title: '金额', dataIndex: 'amount', align: 'center', width: 120, render: (amount: number) => formatSalaryMoney(amount) },
      { title: '来源', dataIndex: 'source', align: 'center', width: 120 },
      { title: '说明', dataIndex: 'note', width: 220 }
    ],
    []
  );
  const sourceColumns = useMemo<TableColumnsType<SalarySettlementSourceRecord>>(
    () => [
      { title: '来源', dataIndex: 'label', width: 120, render: (label: string) => <CellText>{label}</CellText> },
      { title: '状态', dataIndex: 'status', align: 'center', width: 110, render: (status: string) => <StatusTag tone={statusToneMap[status]} value={status} /> },
      { title: '月份', dataIndex: 'sourceMonth', align: 'center', width: 110 },
      { title: '金额', dataIndex: 'amount', align: 'center', width: 120, render: (amount: number) => formatSalaryMoney(amount) },
      { title: '说明', dataIndex: 'note', width: 260 }
    ],
    []
  );

  return (
    <DetailDrawerShell
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(activeReport)}
      title={
        activeReport ? (
          <DetailDrawerTitle
            status={activeReport.status}
            statusTone={statusToneMap[activeReport.status]}
            subtitle="我的工作 / 我的薪资"
            title={`${activeReport.month} 薪资`}
          />
        ) : null
      }
      width={960}
      onClose={onClose}
    >
      {activeReport ? (
        <DetailTabs
          items={[
            {
              key: 'summary',
              label: '薪资明细',
              children: (
                <>
                  <DetailSummaryCards
                    columns={4}
                    items={[
                      { icon: <BankOutlined />, key: 'gross', label: '应发合计', value: formatSalaryMoney(activeReport.grossSalary) },
                      { icon: <FileTextOutlined />, key: 'deduction', label: '扣减合计', value: formatSalaryMoney(activeReport.deductionAmount) },
                      { icon: <BarChartOutlined />, key: 'performance', label: '绩效预发', value: formatSalaryMoney(activeReport.performancePayAmount) },
                      { icon: <CheckCircleOutlined />, key: 'net', label: '实发工资', value: formatSalaryMoney(activeReport.netSalary) }
                    ]}
                  />
                  <DetailSection icon={<ProfileOutlined />} title="计薪信息">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '基础薪资', value: activeReport.baseSalaryText },
                        { label: '应出勤', value: `${activeReport.expectedWorkdays} 天` },
                        { label: '计薪出勤', value: `${activeReport.payableAttendanceDays} 天` },
                        { label: '考勤影响', value: formatSalaryMoney(activeReport.attendanceDeltaAmount) },
                        { label: '社保公积金', value: formatSalaryMoney(activeReport.socialInsuranceDeductionAmount) },
                        { label: '个人所得税', value: formatSalaryMoney(activeReport.personalIncomeTaxAmount) }
                      ]}
                    />
                  </DetailSection>
                </>
              )
            },
            {
              key: 'composition',
              label: '工资构成',
              children: (
                <DetailSection icon={<FileTextOutlined />} title="工资构成">
                  <CompactDetailTable<SalaryCompositionLine>
                    columns={compositionColumns}
                    dataSource={activeReport.salaryCompositionLines}
                    rowKey="id"
                    scrollX={796}
                  />
                </DetailSection>
              )
            },
            {
              key: 'sources',
              label: '结算来源',
              children: (
                <DetailSection icon={<SafetyCertificateOutlined />} title="结算来源">
                  <CompactDetailTable<SalarySettlementSourceRecord>
                    columns={sourceColumns}
                    dataSource={activeReport.settlementSourceRecords}
                    rowKey="id"
                    scrollX={740}
                  />
                </DetailSection>
              )
            },
            {
              key: 'records',
              label: '操作记录',
              children: (
                <OperationRecordSection icon={<AuditOutlined />} records={activeReport.operationRecords} title="操作记录" />
              )
            }
          ]}
          testId="my-salary-detail-tabs"
        />
      ) : null}
    </DetailDrawerShell>
  );
}

export function MySalaryPage() {
  const { latestSalaryReport, salaryReports } = useMyWorkData();
  const [activeReportId, setActiveReportId] = useState<string>();
  const activeReport = salaryReports.find((report) => report.id === activeReportId);
  const columns = useMemo<TableColumnsType<SalaryMonthlyReport>>(
    () => [
      { title: '月份', dataIndex: 'month', width: 120, render: (month: string) => <CellText>{month}</CellText> },
      { title: '状态', dataIndex: 'status', align: 'center', width: 112, render: (status: string) => <StatusTag tone={statusToneMap[status]} value={status} /> },
      { title: '应发合计', dataIndex: 'grossSalary', align: 'center', width: 130, render: (amount: number) => formatSalaryMoney(amount) },
      { title: '扣减合计', dataIndex: 'deductionAmount', align: 'center', width: 130, render: (amount: number) => formatSalaryMoney(amount) },
      { title: '绩效预发', dataIndex: 'performancePayAmount', align: 'center', width: 130, render: (amount: number) => formatSalaryMoney(amount) },
      { title: '实发工资', dataIndex: 'netSalary', align: 'center', width: 130, render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText> },
      { title: '最近更新', dataIndex: ['workflow', 'updatedAt'], align: 'center', width: 150, render: (_, report) => report.workflow?.updatedAt ?? `${report.month}-17 09:00` }
    ],
    []
  );

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<BankOutlined />} label="最新月份" value={latestSalaryReport?.month ?? '-'} />
          <MetricCard icon={<CheckCircleOutlined />} label="结算状态" value={latestSalaryReport?.status ?? '-'} />
          <MetricCard icon={<FileTextOutlined />} label="应发合计" value={latestSalaryReport ? formatSalaryMoney(latestSalaryReport.grossSalary) : '-'} />
          <MetricCard icon={<BankOutlined />} label="实发工资" value={latestSalaryReport ? formatSalaryMoney(latestSalaryReport.netSalary) : '-'} />
        </MetricGrid>
      }
    >
      <ManagementTable<SalaryMonthlyReport>
        columns={columns}
        count={{ unit: '个月', value: salaryReports.length }}
        dataSource={salaryReports}
        rowKey="id"
        rowTestIdPrefix="my-salary-row"
        tableTestId="my-salary-table"
        onRowClick={(report) => setActiveReportId(report.id)}
      />
      <MySalaryDrawer activeReport={activeReport} onClose={() => setActiveReportId(undefined)} />
    </ManagementPageScaffold>
  );
}

export function MyPerformancePage() {
  const { member, performanceTaskRows } = useMyWorkData();
  const evaluationColumns = useMemo<TableColumnsType<PeopleWorkEvaluationRecord>>(
    () => [
      { title: '月份', dataIndex: 'month', width: 120, render: (month: string) => <CellText>{month}</CellText> },
      { title: '验收任务', dataIndex: 'acceptedTasks', align: 'center', width: 110, render: (value: number) => `${value} 项` },
      { title: '返工任务', dataIndex: 'reworkTasks', align: 'center', width: 110, render: (value: number) => `${value} 项` },
      { title: '综合评分', dataIndex: 'score', align: 'center', width: 120, render: (value: number) => `${value} 分` },
      { title: '评级', dataIndex: 'level', align: 'center', width: 100 }
    ],
    []
  );
  const taskScoreColumns = useMemo<TableColumnsType<MyWorkPerformanceTaskRow>>(
    () => [
      {
        title: '任务',
        key: 'task',
        width: 220,
        render: (_, row) => <CompactCell primary={row.task?.name} secondary={row.task?.code} />
      },
      { title: '来源月份', dataIndex: 'sourceMonth', align: 'center', width: 120 },
      { title: '任务分值', dataIndex: 'scoreValue', align: 'center', width: 120, render: (value?: number) => (value === undefined ? '-' : `${value} 分`) },
      { title: '质量评分', dataIndex: 'qualityScore', align: 'center', width: 120, render: (value?: number) => (value === undefined ? '-' : `${value} 分`) },
      { title: '状态', dataIndex: 'status', align: 'center', width: 110, render: (status: string) => <StatusTag tone={statusToneMap[status]} value={status} /> },
      { title: '最近更新', dataIndex: 'updatedAt', align: 'center', width: 150 }
    ],
    []
  );

  if (!member) {
    return null;
  }

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<BarChartOutlined />} label="综合绩效" value={`${member.workEvaluationSummary.score} 分`} />
          <MetricCard icon={<CheckCircleOutlined />} label="评级" value={member.workEvaluationSummary.level} />
          <MetricCard icon={<FileTextOutlined />} label="任务计分" value={performanceTaskRows.length} />
          <MetricCard icon={<ClockCircleOutlined />} label="最近月份" value={member.workEvaluationSummary.month} />
        </MetricGrid>
      }
    >
      <div className="rule-readonly-stack">
        <DetailSection icon={<BarChartOutlined />} title="月度表现">
          <CompactDetailTable<PeopleWorkEvaluationRecord>
            columns={evaluationColumns}
            dataSource={member.workEvaluationRecords}
            rowKey="month"
            scrollX={570}
          />
        </DetailSection>
        <DetailSection icon={<FileTextOutlined />} title="任务计分">
          <CompactDetailTable<MyWorkPerformanceTaskRow>
            columns={taskScoreColumns}
            dataSource={performanceTaskRows}
            emptyText="暂无已计入任务评分"
            rowKey="id"
            scrollX={840}
          />
        </DetailSection>
      </div>
    </ManagementPageScaffold>
  );
}

export function MyWorkArchivePage() {
  return <MyArchivePage />;
}
