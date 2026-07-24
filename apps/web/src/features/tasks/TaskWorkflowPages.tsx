import {
  AuditOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  SendOutlined,
  UploadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Button, DatePicker, Empty, Input, InputNumber, Select, Space, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DetailInfoGrid, DetailSection, StatusTag, type StatusTagTone } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { CellText } from '../../components/TableCell';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { usePerformanceRuleState } from '../performance/PerformanceRuleState';
import {
  buildAcceptanceFeedbackDraft,
  buildAcceptanceScoringDraft,
  formatScore,
  getAcceptanceBlockers,
  getCompletedDimensionScores,
  getQualityBand,
  getQualityScore,
  getReworkBlockers,
  getTaskClientFeedbackRows,
  getTaskPerformanceRule,
  getTaskScoreItem,
  isAcceptanceFeedbackReady,
  type AcceptanceFeedbackDraft,
  type AcceptanceScoringDraft
} from './taskAcceptanceModel';
import { feedbackChannelOptions } from './TaskClientFeedbackShared';
import { createTaskFileDraft, TaskFileDraftEditor, type TaskFileDraft } from './TaskFileDraftEditor';
import { TaskFilesSection } from './components/TaskFilesSection';
import { TaskStatusTag } from './components/TaskStatusTag';
import {
  formatTaskDuration,
  taskDateTimeFormat,
  taskManagementNow,
  type StoreTaskFileType,
  type StoreTaskRecord,
  type StoreTaskStatus,
  useTaskManagementState
} from './TaskManagementState';
import { getTaskStoreContext, getTaskTypeName, isTaskOverdue } from './taskDisplayModel';
import {
  buildClientFeedbackScreenshotFiles,
  buildTaskFilesFromDrafts,
  buildTaskReworkScreenshotFiles,
  hasPartialTaskFileDraft,
  normalizeCompletedTaskFileDrafts
} from './taskFileModel';
import { appendTaskOperation } from './taskOperationModel';
import { prepareTaskAcceptanceCommit } from './taskAcceptanceWorkflow';

const submitTaskStatusTone = {
  待提交: 'blue',
  需调整: 'red'
} satisfies Record<string, StatusTagTone>;

const submitQueueStatusPriority: Record<Extract<StoreTaskStatus, '进行中' | '验收驳回'>, number> = {
  验收驳回: 0,
  进行中: 1
};

const disabledTaskMinutes = Array.from({ length: 59 }, (_, index) => index + 1);
const deliveryFileTypeOptions: StoreTaskFileType[] = ['CAD源文件', 'PDF图纸', '图片', '压缩包', '说明文件'];

type TaskWorkflowWorkbenchProps = {
  memberId?: string;
  renderScaffold?: boolean;
};

function renderTaskSummaryValue(value: ReactNode) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  return value;
}

function getSubmitTaskStatusLabel(status: StoreTaskStatus) {
  if (status === '验收驳回') {
    return '需调整';
  }

  if (status === '进行中') {
    return '待提交';
  }

  return status;
}

function useTaskContext() {
  const { brandRows, getBrandById, getCustomerById, storeRows } = useCustomerManagementState();
  const { performanceRuleRows } = usePerformanceRuleState();
  const { peopleRows } = usePeopleOrganizationState();
  const { clientFeedbackRows, commitTaskAcceptance, createClientFeedback, saveStoreTask, storeTaskRows } = useTaskManagementState();

  return {
    brandRows,
    clientFeedbackRows,
    commitTaskAcceptance,
    createClientFeedback,
    getBrandById,
    getCustomerById,
    performanceRuleRows,
    peopleRows,
    saveStoreTask,
    storeRows,
    storeTaskRows
  };
}

export function TaskSubmitWorkbench({ memberId, renderScaffold = false }: TaskWorkflowWorkbenchProps = {}) {
  const [messageApi, contextHolder] = message.useMessage();
  const { getBrandById, getCustomerById, peopleRows, performanceRuleRows, saveStoreTask, storeRows, storeTaskRows } = useTaskContext();
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const [deliveryDrafts, setDeliveryDrafts] = useState<TaskFileDraft[]>(() => [createTaskFileDraft('压缩包')]);
  const [submitNote, setSubmitNote] = useState('');

  const submitRows = useMemo(
    () =>
      storeTaskRows
        .filter(
          (record): record is StoreTaskRecord & { status: '进行中' | '验收驳回' } =>
            (record.status === '进行中' || record.status === '验收驳回') && (!memberId || record.executorId === memberId)
        )
        .sort(
          (left, right) =>
            Number(isTaskOverdue(right)) - Number(isTaskOverdue(left)) ||
            submitQueueStatusPriority[left.status] - submitQueueStatusPriority[right.status] ||
            left.plannedDeliveryAt.localeCompare(right.plannedDeliveryAt)
        ),
    [memberId, storeTaskRows]
  );
  const selectedTask = submitRows.find((record) => record.id === activeTaskId) ?? submitRows[0];
  const selectedPerformanceRule = selectedTask
    ? getTaskPerformanceRule(
        selectedTask,
        peopleRows.find((person) => person.id === selectedTask.executorId),
        performanceRuleRows
      )
    : undefined;
  const selectedScoreItem = selectedTask ? getTaskScoreItem(selectedTask, selectedPerformanceRule) : undefined;
  const completedDeliveryDrafts = useMemo(
    () => normalizeCompletedTaskFileDrafts(deliveryDrafts),
    [deliveryDrafts]
  );
  const hasPartialDelivery = hasPartialTaskFileDraft(deliveryDrafts);
  const metrics = useMemo(
    () => ({
      overdue: submitRows.filter((record) => isTaskOverdue(record)).length,
      rejected: submitRows.filter((record) => record.status === '验收驳回').length,
      total: submitRows.length
    }),
    [submitRows]
  );

  function selectTask(record: StoreTaskRecord) {
    setActiveTaskId(record.id);
    setDeliveryDrafts([createTaskFileDraft('压缩包')]);
    setSubmitNote(record.status === '验收驳回' ? '已按驳回要求调整。' : '');
  }

  function updateDeliveryDraft<K extends keyof Omit<TaskFileDraft, 'id'>>(draftId: string, key: K, value: TaskFileDraft[K]) {
    setDeliveryDrafts((currentDrafts) => currentDrafts.map((draft) => (draft.id === draftId ? { ...draft, [key]: value } : draft)));
  }

  function addDeliveryDraft() {
    setDeliveryDrafts((currentDrafts) => [...currentDrafts, createTaskFileDraft('压缩包')]);
  }

  function removeDeliveryDraft(draftId: string) {
    setDeliveryDrafts((currentDrafts) => {
      const nextDrafts = currentDrafts.filter((draft) => draft.id !== draftId);
      return nextDrafts.length > 0 ? nextDrafts : [createTaskFileDraft('压缩包')];
    });
  }

  function handleSubmit(record: StoreTaskRecord) {
    if (hasPartialDelivery) {
      void messageApi.warning('文件名称和文件链接需要同时填写');
      return;
    }

    if (completedDeliveryDrafts.length === 0) {
      void messageApi.warning('请至少登记一份交付文件');
      return;
    }

    const deliveryFiles = buildTaskFilesFromDrafts({
      drafts: completedDeliveryDrafts,
      idPrefix: `task-file-${record.code.toLowerCase()}-delivery`,
      registeredBy: record.executorName ?? '李明',
      stage: '交付文件',
      startIndex: record.files.length + 1
    });
    const nextRecord = appendTaskOperation(
      {
        ...record,
        files: [...deliveryFiles, ...record.files],
        status: '待验收',
        submittedAt: taskManagementNow
      },
      '提交交付',
      submitNote.trim() || `登记 ${deliveryFiles.length} 份交付文件并提交验收`
    );

    saveStoreTask(nextRecord);
    setActiveTaskId(submitRows.find((row) => row.id !== record.id)?.id);
    setDeliveryDrafts([createTaskFileDraft('压缩包')]);
    setSubmitNote('');
    void messageApi.success('交付已提交验收');
  }

  const metricsNode = (
    <MetricGrid columns={3}>
      <MetricCard label="待提交" value={metrics.total} icon={<SendOutlined />} />
      <MetricCard label="需调整" value={metrics.rejected} icon={<ReloadOutlined />} />
      <MetricCard label="已逾期" value={metrics.overdue} icon={<WarningOutlined />} />
    </MetricGrid>
  );
  const content = (
      <div className="task-submit-workbench">
        <section className="task-submit-queue-card">
          <div className="task-submit-section-head">
            <div>
              <div className="task-submit-section-title">提交队列</div>
              <div className="task-submit-section-meta">{submitRows.length} 条待处理</div>
            </div>
          </div>
          <div className="task-submit-card-list">
            {submitRows.length > 0 ? (
              submitRows.map((record) => {
                const isActive = selectedTask?.id === record.id;
                const storeText = getTaskStoreContext(storeRows, record.storeId).storeCityLabel;
                return (
                  <button className={isActive ? 'task-submit-card is-active' : 'task-submit-card'} key={record.id} type="button" onClick={() => selectTask(record)}>
                    <span className="task-submit-card-top">
                      <span className="task-submit-card-title">{record.name}</span>
                      <StatusTag toneMap={submitTaskStatusTone} value={getSubmitTaskStatusLabel(record.status)} />
                    </span>
                    <span className="task-submit-card-sub">
                      {getBrandById(record.brandId)?.name ?? '-'} / {storeText}
                    </span>
                    <span className="task-submit-card-line">
                      <span>类型：{getTaskTypeName(record)}</span>
                      <span>执行：{record.executorName ?? '-'}</span>
                    </span>
                    <span className="task-submit-card-foot">
                      <CellText tone={isTaskOverdue(record) ? 'risk' : 'default'}>
                        计划 {formatTaskDuration(record.plannedDurationHours)} / {record.plannedDeliveryAt}
                      </CellText>
                      {isTaskOverdue(record) ? <StatusTag tone="amber" value="已逾期" /> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty description="暂无需要提交的任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </section>

        <section className="task-submit-panel">
          {selectedTask ? (
            <>
              <div className="task-submit-panel-header">
                <div>
                  <div className="task-submit-panel-title">{selectedTask.name}</div>
                  <div className="task-submit-panel-sub">
                    {getCustomerById(selectedTask.customerId)?.name ?? '-'} / {getTaskStoreContext(storeRows, selectedTask.storeId).storeCityLabel}
                  </div>
                </div>
                <Space size={6}>
                  {isTaskOverdue(selectedTask) ? <StatusTag tone="amber" value="已逾期" /> : null}
                  <StatusTag toneMap={submitTaskStatusTone} value={getSubmitTaskStatusLabel(selectedTask.status)} />
                </Space>
              </div>

              <div className="task-submit-panel-body">
                <div className="task-submit-summary-strip">
                  {[
                    { label: '品牌', value: getBrandById(selectedTask.brandId)?.name },
                    { label: '任务类型', value: getTaskTypeName(selectedTask) },
                    { label: '绩效分数', value: formatScore(selectedScoreItem?.score) },
                    { label: '执行人', value: selectedTask.executorName ?? '-' },
                    { label: '验收人', value: selectedTask.acceptorName },
                    { label: '计划时效', value: formatTaskDuration(selectedTask.plannedDurationHours) },
                    { label: '计划交付', value: selectedTask.plannedDeliveryAt },
                    { label: '退回次数', value: `${selectedTask.reworkCount} 次` }
                  ].map((item) => (
                    <div className="task-submit-summary-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{renderTaskSummaryValue(item.value)}</strong>
                    </div>
                  ))}
                </div>

                {selectedTask.status === '验收驳回' ? (
                  <DetailSection icon={<ReloadOutlined />} title="驳回要求">
                    <DetailInfoGrid
                      columns={2}
                      items={[
                        { label: '驳回原因', value: selectedTask.latestReworkReason ?? '-' },
                        { label: '整改要求', value: selectedTask.latestReworkRequirement ?? '-' },
                        { label: '驳回次数', value: `${selectedTask.reworkCount} 次` },
                        { label: '最近更新', value: selectedTask.updatedAt }
                      ]}
                    />
                  </DetailSection>
                ) : null}

                <DetailSection
                  extra={
                    <Button icon={<FileDoneOutlined />} onClick={addDeliveryDraft}>
                      添加文件
                    </Button>
                  }
                  icon={<FileDoneOutlined />}
                  title="交付文件登记"
                >
                  <TaskFileDraftEditor
                    drafts={deliveryDrafts}
                    itemLabel="文件"
                    namePlaceholder="交付文件.zip / 图纸说明.pdf"
                    typeOptions={deliveryFileTypeOptions}
                    onChange={updateDeliveryDraft}
                    onRemove={removeDeliveryDraft}
                  />
                  <label className="task-submit-note-field">
                    <span>交付说明</span>
                    <Input.TextArea
                      autoSize={{ minRows: 2, maxRows: 4 }}
                      placeholder="可填写交付说明、调整说明"
                      value={submitNote}
                      onChange={(event) => setSubmitNote(event.target.value)}
                    />
                  </label>
                </DetailSection>

                <TaskFilesSection icon={<AuditOutlined />} records={selectedTask.files} title="已登记文件" />
              </div>

              <div className="task-submit-panel-footer">
                <Button
                  disabled={hasPartialDelivery || completedDeliveryDrafts.length === 0}
                  icon={<SendOutlined />}
                  type="primary"
                  onClick={() => handleSubmit(selectedTask)}
                >
                  提交至验收
                </Button>
              </div>
            </>
          ) : (
            <div className="task-submit-empty-panel">
              <Empty description="暂无需要提交的任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </section>
      </div>
  );

  if (!renderScaffold) {
    return (
      <>
        {contextHolder}
        {content}
      </>
    );
  }

  return (
    <ManagementPageScaffold feedback={contextHolder} metrics={metricsNode} pageId="task-workflow">
      {content}
    </ManagementPageScaffold>
  );
}

export function TaskAcceptanceWorkbench({ memberId, renderScaffold = false }: TaskWorkflowWorkbenchProps = {}) {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    clientFeedbackRows,
    commitTaskAcceptance,
    createClientFeedback,
    getBrandById,
    getCustomerById,
    performanceRuleRows,
    peopleRows,
    saveStoreTask,
    storeRows,
    storeTaskRows
  } = useTaskContext();
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const [activeAcceptanceTab, setActiveAcceptanceTab] = useState('overview');
  const [reworkTaskId, setReworkTaskId] = useState<string>();
  const [reworkReason, setReworkReason] = useState('');
  const [reworkRequirement, setReworkRequirement] = useState('');
  const [reworkScreenshots, setReworkScreenshots] = useState<UploadFile[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState<AcceptanceFeedbackDraft>();
  const [scoringDraft, setScoringDraft] = useState<AcceptanceScoringDraft>();

  const acceptanceRows = useMemo(
    () =>
      storeTaskRows
        .filter((record): record is StoreTaskRecord & { status: '待验收' } => record.status === '待验收' && (!memberId || record.acceptorId === memberId))
        .sort(
          (left, right) =>
            Number(isTaskOverdue(right)) - Number(isTaskOverdue(left)) ||
            left.plannedDeliveryAt.localeCompare(right.plannedDeliveryAt) ||
            (left.submittedAt ?? '').localeCompare(right.submittedAt ?? '')
        ),
    [memberId, storeTaskRows]
  );
  const selectedTask = acceptanceRows.find((record) => record.id === activeTaskId) ?? acceptanceRows[0];
  const selectedCustomer = selectedTask ? getCustomerById(selectedTask.customerId) : undefined;
  const selectedTaskFeedbackRows = useMemo(() => (selectedTask ? getTaskClientFeedbackRows(selectedTask, clientFeedbackRows) : []), [clientFeedbackRows, selectedTask]);
  const latestClientFeedback = selectedTaskFeedbackRows[0];
  const selectedRule = performanceRuleRows.find((rule) => rule.id === scoringDraft?.ruleId);
  const selectedScoreItem = selectedRule?.taskScoreItems.find((item) => item.id === scoringDraft?.scoreItemId);
  const completedDimensionScores = getCompletedDimensionScores(scoringDraft);
  const qualityScore = completedDimensionScores && selectedRule
    ? getQualityScore(completedDimensionScores, selectedRule.qualityDimensions)
    : undefined;
  const qualityBand = typeof qualityScore === 'number' ? getQualityBand(selectedRule, qualityScore) : undefined;
  const acceptanceBlockers = selectedTask ? getAcceptanceBlockers(selectedTask, scoringDraft) : [];
  const acceptanceReady = selectedTask ? acceptanceBlockers.length === 0 : false;
  const reworkBlockers = selectedTask ? getReworkBlockers(reworkReason, reworkRequirement) : [];
  const reworkReady = selectedTask ? reworkBlockers.length === 0 : false;
  const metrics = useMemo(
    () => ({
      overdue: acceptanceRows.filter((record) => isTaskOverdue(record)).length,
      rework: acceptanceRows.filter((record) => record.reworkCount > 0).length,
      total: acceptanceRows.length
    }),
    [acceptanceRows]
  );

  useEffect(() => {
    if (!selectedTask) {
      setFeedbackDraft(undefined);
      setScoringDraft(undefined);
      return;
    }

    setFeedbackDraft(buildAcceptanceFeedbackDraft(selectedTask, getCustomerById));
    setScoringDraft(buildAcceptanceScoringDraft(
      selectedTask,
      peopleRows.find((person) => person.id === selectedTask.executorId),
      performanceRuleRows
    ));
  }, [getCustomerById, peopleRows, performanceRuleRows, selectedTask]);

  function finishAcceptanceAction(currentTask: StoreTaskRecord, nextTask: StoreTaskRecord, successMessage: string, persistTask = true) {
    if (persistTask) {
      saveStoreTask(nextTask);
    }
    setActiveTaskId(acceptanceRows.find((row) => row.id !== currentTask.id)?.id);
    setReworkTaskId(undefined);
    setReworkReason('');
    setReworkRequirement('');
    setReworkScreenshots([]);
    void messageApi.success(successMessage);
  }

  function selectAcceptanceTask(record: StoreTaskRecord) {
    setActiveTaskId(record.id);
    setActiveAcceptanceTab('overview');
    setReworkTaskId(undefined);
    setReworkReason('');
    setReworkRequirement('');
    setReworkScreenshots([]);
    setFeedbackDraft(buildAcceptanceFeedbackDraft(record, getCustomerById));
    setScoringDraft(buildAcceptanceScoringDraft(
      record,
      peopleRows.find((person) => person.id === record.executorId),
      performanceRuleRows
    ));
  }

  function handleAccept(record: StoreTaskRecord) {
    const result = prepareTaskAcceptanceCommit({
      acceptedAt: taskManagementNow,
      performanceRuleRows,
      person: peopleRows.find((person) => person.id === record.executorId),
      scoringDraft,
      task: record
    });

    if (!result.success) {
      setActiveAcceptanceTab(result.targetTab);
      void messageApi.warning(result.message);
      return;
    }

    const commitResult = commitTaskAcceptance(result.commitInput);
    if (!commitResult.success) {
      setActiveAcceptanceTab('overview');
      void messageApi.warning(commitResult.message);
      return;
    }
    finishAcceptanceAction(
      record,
      result.nextTask,
      result.warnings.length > 0
        ? `任务已验收完成；${result.warnings.join('；')}`
        : '任务已验收完成',
      false
    );
  }

  function startRework(record: StoreTaskRecord) {
    setReworkTaskId(record.id);
    setActiveAcceptanceTab('overview');
    setReworkReason('');
    setReworkRequirement('');
    setReworkScreenshots([]);
    setFeedbackDraft(buildAcceptanceFeedbackDraft(record, getCustomerById));
  }

  function cancelRework() {
    setReworkTaskId(undefined);
    setReworkReason('');
    setReworkRequirement('');
    setReworkScreenshots([]);
  }

  function handleDimensionScoreChange(dimensionId: string, value: number | null) {
    setScoringDraft((current) =>
      current
        ? {
            ...current,
            dimensionScores: current.dimensionScores.map((dimension) =>
              dimension.id === dimensionId
                ? {
                    ...dimension,
                    score: typeof value === 'number' ? Math.min(dimension.maxScore, Math.max(0, value)) : undefined
                  }
                : dimension
            )
          }
        : current
    );
  }

  function updateFeedbackDraft<K extends keyof AcceptanceFeedbackDraft>(key: K, value: AcceptanceFeedbackDraft[K]) {
    setFeedbackDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleFeedbackContactChange(contactId: string) {
    const contact = selectedCustomer?.contacts.find((item) => item.id === contactId);

    setFeedbackDraft((current) =>
      current
        ? {
            ...current,
            contactId,
            feedbackBy: contact?.name ?? '',
            feedbackPhone: contact?.phone ?? '',
            feedbackRole: contact?.role ?? ''
          }
        : current
    );
  }

  function persistAcceptanceFeedback(record: StoreTaskRecord) {
    if (!feedbackDraft || !isAcceptanceFeedbackReady(feedbackDraft)) {
      return false;
    }

    createClientFeedback({
      brandId: record.brandId,
      channel: feedbackDraft.channel,
      content: feedbackDraft.content.trim(),
      customerId: record.customerId,
      feedbackAt: feedbackDraft.feedbackAt,
      feedbackBy: feedbackDraft.feedbackBy.trim(),
      feedbackPhone: feedbackDraft.feedbackPhone.trim(),
      feedbackRole: feedbackDraft.feedbackRole.trim(),
      files: buildClientFeedbackScreenshotFiles(feedbackDraft.screenshots, record),
      storeId: record.storeId,
      taskId: record.id
    });
    setFeedbackDraft(buildAcceptanceFeedbackDraft(record, getCustomerById));
    return true;
  }

  function handleRework(record: StoreTaskRecord) {
    const normalizedReason = reworkReason.trim();
    const normalizedRequirement = reworkRequirement.trim();
    const blockers = getReworkBlockers(normalizedReason, normalizedRequirement);

    if (blockers.length > 0) {
      setActiveAcceptanceTab('overview');
      void messageApi.warning(`请先完成：${blockers.join('、')}`);
      return;
    }

    persistAcceptanceFeedback(record);

    const reworkSummary = `驳回原因：${normalizedReason}；整改要求：${normalizedRequirement}`;
    const screenshotFiles = buildTaskReworkScreenshotFiles(reworkScreenshots, record);
    const nextRecord = appendTaskOperation(
      {
        ...record,
        files: [...screenshotFiles, ...record.files],
        latestReworkReason: normalizedReason,
        latestReworkRequirement: normalizedRequirement,
        reworkCount: record.reworkCount + 1,
        status: '验收驳回'
      },
      '验收驳回',
      screenshotFiles.length > 0 ? `${reworkSummary}；补充 ${screenshotFiles.length} 张问题截图` : reworkSummary
    );

    finishAcceptanceAction(record, nextRecord, '已驳回验收');
  }

  const metricsNode = (
    <MetricGrid columns={3}>
      <MetricCard label="待验收" value={metrics.total} icon={<CheckCircleOutlined />} />
      <MetricCard label="有退回记录" value={metrics.rework} icon={<ReloadOutlined />} />
      <MetricCard label="已逾期" value={metrics.overdue} icon={<WarningOutlined />} />
    </MetricGrid>
  );
  const content = (
      <div className="task-submit-workbench">
        <section className="task-submit-queue-card">
          <div className="task-submit-section-head">
            <div>
              <div className="task-submit-section-title">验收队列</div>
              <div className="task-submit-section-meta">{acceptanceRows.length} 条待处理</div>
            </div>
          </div>
          <div className="task-submit-card-list">
            {acceptanceRows.length > 0 ? (
              acceptanceRows.map((record) => {
                const isActive = selectedTask?.id === record.id;
                const storeText = getTaskStoreContext(storeRows, record.storeId).storeCityLabel;
                return (
                  <button className={isActive ? 'task-submit-card is-active' : 'task-submit-card'} key={record.id} type="button" onClick={() => selectAcceptanceTask(record)}>
                    <span className="task-submit-card-top">
                      <span className="task-submit-card-title">{record.name}</span>
                      <TaskStatusTag status={record.status} />
                    </span>
                    <span className="task-submit-card-sub">
                      {getBrandById(record.brandId)?.name ?? '-'} / {storeText}
                    </span>
                    <span className="task-submit-card-line">
                      <span>类型：{getTaskTypeName(record)}</span>
                      <span>执行：{record.executorName ?? '-'}</span>
                    </span>
                    <span className="task-submit-card-foot">
                      <CellText tone={isTaskOverdue(record) ? 'risk' : 'default'}>
                        计划 {formatTaskDuration(record.plannedDurationHours)} / {record.plannedDeliveryAt}
                      </CellText>
                      {isTaskOverdue(record) ? <StatusTag tone="amber" value="已逾期" /> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty description="暂无需要验收的任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </section>

        <section className="task-submit-panel">
          {selectedTask ? (
            <>
              <div className="task-submit-panel-header">
                <div>
                  <div className="task-submit-panel-title">{selectedTask.name}</div>
                  <div className="task-submit-panel-sub">
                    {getCustomerById(selectedTask.customerId)?.name ?? '-'} / {getTaskStoreContext(storeRows, selectedTask.storeId).storeCityLabel}
                  </div>
                </div>
                <Space size={6}>
                  {isTaskOverdue(selectedTask) ? <StatusTag tone="amber" value="已逾期" /> : null}
                  <TaskStatusTag status={selectedTask.status} />
                </Space>
              </div>

              <div className="task-submit-panel-body">
                <DetailTabs
                  activeKey={activeAcceptanceTab}
                  tabTestIdPrefix="task-workflow-acceptance-tab"
                  testId="task-workflow-acceptance-tabs"
                  variant="sticky-workbench"
                  items={[
                    {
                      key: 'overview',
                      label: '验收信息',
                      children: (
                        <>
                          <div className="task-submit-summary-strip">
                            {[
                              { label: '品牌', value: getBrandById(selectedTask.brandId)?.name },
                              { label: '任务类型', value: getTaskTypeName(selectedTask) },
                              { label: '执行人', value: selectedTask.executorName ?? '-' },
                              { label: '验收人', value: selectedTask.acceptorName },
                              { label: '计划时效', value: formatTaskDuration(selectedTask.plannedDurationHours) },
                              { label: '计划交付', value: selectedTask.plannedDeliveryAt },
                              { label: '提交时间', value: selectedTask.submittedAt ?? '-' }
                            ].map((item) => (
                              <div className="task-submit-summary-item" key={item.label}>
                                <span>{item.label}</span>
                                <strong>{renderTaskSummaryValue(item.value)}</strong>
                              </div>
                            ))}
                          </div>

                          <TaskFilesSection icon={<FileDoneOutlined />} records={selectedTask.files} title="交付文件" />

                          <DetailSection
                            extra={
                              <StatusTag
                                tone={selectedTaskFeedbackRows.length > 0 ? 'green' : 'amber'}
                                value={selectedTaskFeedbackRows.length > 0 ? `已登记 ${selectedTaskFeedbackRows.length} 条` : '未登记'}
                              />
                            }
                            icon={<CommentOutlined />}
                            title="甲方反馈"
                          >
                            {latestClientFeedback ? (
                              <div className="task-submit-reject-note task-acceptance-feedback-latest">
                                <CommentOutlined />
                                <span>
                                  {latestClientFeedback.feedbackAt} / {latestClientFeedback.feedbackBy}：{latestClientFeedback.summary}
                                </span>
                              </div>
                            ) : (
                              <Empty description="暂无甲方反馈" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                          </DetailSection>

                          <DetailSection icon={<CheckCircleOutlined />} title="验收处理">
                            <DetailInfoGrid
                              columns={3}
                              items={[
                                { label: '当前状态', value: <TaskStatusTag status={selectedTask.status} /> },
                                { label: '退回次数', value: `${selectedTask.reworkCount} 次` },
                                { label: '任务说明', value: selectedTask.note }
                              ]}
                            />
                          </DetailSection>

                          {reworkTaskId === selectedTask.id ? (
                            <DetailSection icon={<ReloadOutlined />} title="驳回处理">
                              <div className="task-rework-panel">
                                {reworkBlockers.length > 0 ? (
                                  <div className="task-submit-reject-note task-rework-validation-note">
                                    <WarningOutlined />
                                    <span>确认驳回前需完成：{reworkBlockers.join('、')}</span>
                                  </div>
                                ) : null}
                                <div className="task-rework-subsection">
                                  <div className="task-rework-subsection-title">甲方反馈（可选）</div>
                                  {latestClientFeedback ? (
                                    <div className="task-submit-reject-note task-acceptance-feedback-latest">
                                      <CommentOutlined />
                                      <span>
                                        已有关联反馈：{latestClientFeedback.feedbackAt} / {latestClientFeedback.feedbackBy}：{latestClientFeedback.summary}
                                      </span>
                                    </div>
                                  ) : null}
                                  {feedbackDraft ? (
                                    <div className="task-acceptance-feedback-form">
                                      <DrawerFormGrid>
                                        <DrawerFormField label="反馈时间" required>
                                          <DatePicker
                                            className="archive-create-date-picker"
                                            format={taskDateTimeFormat}
                                            inputReadOnly
                                            placeholder="选择日期和小时"
                                            showTime={{ disabledMinutes: () => disabledTaskMinutes, format: 'HH:mm' }}
                                            value={feedbackDraft.feedbackAt ? dayjs(feedbackDraft.feedbackAt) : undefined}
                                            onChange={(_, dateString) => updateFeedbackDraft('feedbackAt', Array.isArray(dateString) ? dateString[0] ?? '' : dateString)}
                                          />
                                        </DrawerFormField>
                                        <DrawerFormField label="反馈渠道" required>
                                          <Select
                                            options={feedbackChannelOptions.map((channel) => ({ label: channel, value: channel }))}
                                            value={feedbackDraft.channel}
                                            onChange={(channel) => updateFeedbackDraft('channel', channel)}
                                          />
                                        </DrawerFormField>
                                        <DrawerFormField label="反馈人" required>
                                          <Select
                                            placeholder="请选择联系人"
                                            value={feedbackDraft.contactId || undefined}
                                            options={(selectedCustomer?.contacts ?? []).map((contact) => ({
                                              label: `${contact.name} / ${contact.role}`,
                                              value: contact.id
                                            }))}
                                            onChange={handleFeedbackContactChange}
                                          />
                                        </DrawerFormField>
                                        <DrawerFormField label="联系电话">
                                          <Input value={feedbackDraft.feedbackPhone} onChange={(event) => updateFeedbackDraft('feedbackPhone', event.target.value)} />
                                        </DrawerFormField>
                                        <DrawerFormField label="反馈内容" required wide>
                                          <Input.TextArea
                                            autoSize={{ minRows: 3, maxRows: 5 }}
                                            placeholder="记录甲方反馈原文或沟通摘要"
                                            value={feedbackDraft.content}
                                            onChange={(event) => updateFeedbackDraft('content', event.target.value)}
                                          />
                                        </DrawerFormField>
                                      </DrawerFormGrid>
                                      <div className="task-rework-upload client-feedback-upload">
                                        <div className="task-rework-upload-head">
                                          <span>反馈截图</span>
                                          <span>PNG/JPG，单张 5MB 内，可选。</span>
                                        </div>
                                        <Upload
                                          accept="image/png,image/jpeg"
                                          beforeUpload={(file) => {
                                            const isSupportedImage = file.type === 'image/png' || file.type === 'image/jpeg';
                                            const isUnderLimit = file.size / 1024 / 1024 <= 5;

                                            if (!isSupportedImage) {
                                              void messageApi.warning('仅支持 PNG/JPG 截图');
                                              return Upload.LIST_IGNORE;
                                            }

                                            if (!isUnderLimit) {
                                              void messageApi.warning('单张截图不能超过 5MB');
                                              return Upload.LIST_IGNORE;
                                            }

                                            return false;
                                          }}
                                          fileList={feedbackDraft.screenshots}
                                          listType="picture"
                                          multiple
                                          onChange={({ fileList }) => updateFeedbackDraft('screenshots', fileList)}
                                        >
                                          <Button icon={<UploadOutlined />}>上传截图</Button>
                                        </Upload>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="task-rework-subsection">
                                  <div className="task-rework-subsection-title">驳回信息</div>
                                  <label className="task-submit-note-field">
                                    <span>驳回原因 *</span>
                                    <Input.TextArea
                                      autoSize={{ minRows: 3, maxRows: 5 }}
                                      placeholder="说明内部验收不通过的具体问题"
                                      status={reworkReason.trim() ? undefined : 'warning'}
                                      value={reworkReason}
                                      onChange={(event) => setReworkReason(event.target.value)}
                                    />
                                  </label>
                                  <label className="task-submit-note-field">
                                    <span>整改要求 *</span>
                                    <Input.TextArea
                                      autoSize={{ minRows: 3, maxRows: 5 }}
                                      placeholder="说明执行人需要补充、修改或重新提交的内容"
                                      status={reworkRequirement.trim() ? undefined : 'warning'}
                                      value={reworkRequirement}
                                      onChange={(event) => setReworkRequirement(event.target.value)}
                                    />
                                  </label>
                                </div>
                                <div className="task-rework-upload">
                                  <div className="task-rework-upload-head">
                                    <span>问题截图</span>
                                    <span>支持 PNG/JPG，单张不超过 5MB，可多张上传。</span>
                                  </div>
                                  <Upload
                                    accept="image/png,image/jpeg"
                                    beforeUpload={(file) => {
                                      const isSupportedImage = file.type === 'image/png' || file.type === 'image/jpeg';
                                      const isUnderLimit = file.size / 1024 / 1024 <= 5;

                                      if (!isSupportedImage) {
                                        void messageApi.warning('仅支持 PNG/JPG 截图');
                                        return Upload.LIST_IGNORE;
                                      }

                                      if (!isUnderLimit) {
                                        void messageApi.warning('单张截图不能超过 5MB');
                                        return Upload.LIST_IGNORE;
                                      }

                                      return false;
                                    }}
                                    fileList={reworkScreenshots}
                                    listType="picture"
                                    multiple
                                    onChange={({ fileList }) => setReworkScreenshots(fileList)}
                                  >
                                    <Button icon={<FileDoneOutlined />}>上传截图</Button>
                                  </Upload>
                                </div>
                              </div>
                            </DetailSection>
                          ) : null}
                        </>
                      )
                    },
                    {
                      key: 'scoring',
                      label: '绩效评分',
                      children: (
                        <DetailSection icon={<BarChartOutlined />} title="绩效评分">
                          {scoringDraft ? (
                            <div className="task-acceptance-scoring">
                              <DetailInfoGrid
                                columns={3}
                                items={[
                                  { label: '绩效方案', value: selectedRule ? `${selectedRule.performanceType} / ${selectedRule.category} / ${selectedRule.currentVersion}` : '-' },
                                  {
                                    label: '任务类型',
                                    value: selectedScoreItem ? `${selectedTask.taskDefinitionSnapshot.name} / ${formatScore(scoringDraft.scoreValue)}` : '-'
                                  },
                                  { label: '归属月份', value: scoringDraft.sourceMonth },
                                  { label: '任务分', value: formatScore(scoringDraft.scoreValue) },
                                  { label: '质量分', value: formatScore(qualityScore) },
                                  { label: '质量档位', value: qualityBand?.scoreRange ?? '-' }
                                ]}
                              />

                              <div className="task-acceptance-score-list">
                                {scoringDraft.dimensionScores.map((dimension) => (
                                  <div className="task-acceptance-score-row" key={dimension.id}>
                                    <div className="task-acceptance-score-main">
                                      <span>{dimension.name}</span>
                                      <strong>{typeof dimension.score === 'number' ? `最高 ${dimension.maxScore} 分` : `必填 / 最高 ${dimension.maxScore} 分`}</strong>
                                    </div>
                                    <InputNumber
                                      className="task-acceptance-score-input"
                                      max={dimension.maxScore}
                                      min={0}
                                      placeholder="填写分数"
                                      precision={0}
                                      status={typeof dimension.score === 'number' ? undefined : 'warning'}
                                      value={typeof dimension.score === 'number' ? dimension.score : null}
                                      onChange={(value) => handleDimensionScoreChange(dimension.id, value)}
                                    />
                                  </div>
                                ))}
                              </div>

                              <label className="task-submit-note-field">
                                <span>评分备注</span>
                                <Input.TextArea
                                  autoSize={{ minRows: 2, maxRows: 4 }}
                                  placeholder="可记录扣分原因、质量判断或跨月归属说明"
                                  value={scoringDraft.adjustmentReason}
                                  onChange={(event) => setScoringDraft((current) => (current ? { ...current, adjustmentReason: event.target.value } : current))}
                                />
                              </label>
                            </div>
                          ) : (
                            <Empty description="暂无可用绩效规则" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                          )}
                        </DetailSection>
                      )
                    },
                    {
                      key: 'records',
                      label: '操作记录',
                      children: (
                        <OperationRecordSection icon={<AuditOutlined />} records={selectedTask.operationRecords} title="操作记录" />
                      )
                    }
                  ]}
                  onChange={setActiveAcceptanceTab}
                />
              </div>

              <div className="task-submit-panel-footer">
                <Space size={8}>
                  {reworkTaskId === selectedTask.id ? (
                    <>
                      <Button onClick={cancelRework}>取消驳回</Button>
                      <Button danger disabled={!reworkReady} onClick={() => handleRework(selectedTask)}>
                        确认驳回
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button danger onClick={() => startRework(selectedTask)}>
                        驳回
                      </Button>
                      <Button disabled={!acceptanceReady} icon={<CheckCircleOutlined />} type="primary" onClick={() => handleAccept(selectedTask)}>
                        验收通过
                      </Button>
                    </>
                  )}
                </Space>
              </div>
            </>
          ) : (
            <div className="task-submit-empty-panel">
              <Empty description="暂无需要验收的任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </section>
      </div>
  );

  if (!renderScaffold) {
    return (
      <>
        {contextHolder}
        {content}
      </>
    );
  }

  return (
    <ManagementPageScaffold feedback={contextHolder} metrics={metricsNode} pageId="task-workflow">
      {content}
    </ManagementPageScaffold>
  );
}
