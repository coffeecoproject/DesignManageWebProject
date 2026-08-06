import {
  AuditOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  ReloadOutlined,
  StopOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, InputNumber, message, Segmented, Select, Space } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useMemo, useState } from 'react';
import { DetailInfoGrid, DetailSection, StatusTag, type StatusTagTone } from '../../components/Detail';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import { FileSlot } from '../../components/FileSlot';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText } from '../../components/TableCell';
import { financeToday, formatMoney } from '../finance/financeUtils';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import type { MyWorkExpenseVoucherComplianceConclusion } from './myWorkExpenseCollectionModel';
import {
  buildMyWorkExpenseReviewCompletedRows,
  buildMyWorkExpenseReviewMetrics,
  buildMyWorkExpenseReviewQueue,
  getExpenseApprovalDecisionIssues,
  getExpenseReviewCategoryLabel,
  isExpenseReviewOverdue,
  type MyWorkExpenseApprovalDecision,
  type MyWorkExpenseReviewRecord,
  type MyWorkExpenseReviewStatus
} from './myWorkExpenseReviewModel';
import { useMyExpenseReviewState } from './MyExpenseReviewState';

type ReviewViewMode = 'pending' | 'processed';
type EvidenceCompliance = Extract<
  MyWorkExpenseVoucherComplianceConclusion,
  '发票' | '财政票据或其他合法凭证' | '小额零星收款凭证'
>;

const expenseReviewStatusTone = {
  待审核: 'blue',
  需调整: 'red',
  已通过: 'green',
  已撤销: 'gray'
} as const satisfies Record<MyWorkExpenseReviewStatus, StatusTagTone>;

function getReviewQueueStatus(record: MyWorkExpenseReviewRecord) {
  return isExpenseReviewOverdue(record) ? '已逾期' : record.reviewStatus;
}

function getReviewQueueTone(record: MyWorkExpenseReviewRecord): StatusTagTone {
  return isExpenseReviewOverdue(record) ? 'amber' : expenseReviewStatusTone[record.reviewStatus];
}

function getNextActiveRecordId(rows: MyWorkExpenseReviewRecord[], currentRecordId: string) {
  return rows.find((record) => record.id !== currentRecordId)?.id;
}

function createDefaultApprovalDecision(record?: MyWorkExpenseReviewRecord): MyWorkExpenseApprovalDecision {
  return {
    businessReimbursementAmount: record?.amount ?? 0,
    employeeBorneAmount: 0,
    exceptionReason: '',
    expenseAuthenticity: '真实',
    overStandardNature: '未超标',
    reviewerName: '李明',
    salaryTaxableAmount: 0,
    voucherCompliance: record?.originalType === '无正式票据' ? '暂缺合规凭证' : '发票'
  };
}

function createEvidenceFile(record: MyWorkExpenseReviewRecord, file: UploadFile): RelatedFileRecord {
  return {
    id: `${record.code}-${file.uid || file.name}`,
    name: file.name,
    status: '已选择',
    type: '补充凭证',
    updatedAt: financeToday
  };
}

function getProcessedResultItems(record: MyWorkExpenseReviewRecord) {
  const result = record.expenseReviewResult;

  if (!result) {
    return [
      { label: '处理结果', value: record.reviewStatus === '需调整' ? '已退回修改' : record.reviewStatus },
      { label: '处理说明', value: record.operationRecords[0]?.summary ?? '-' }
    ];
  }

  return [
    { label: '费用真实性', value: result.expenseAuthenticity },
    { label: '凭证合规性', value: result.voucherCompliance },
    { label: '凭证结果', value: result.evidenceStatus },
    { label: '超标准性质', value: result.overStandardNature },
    { label: '业务报销金额', value: formatMoney(result.businessReimbursementAmount) },
    { label: '转薪酬计税金额', value: formatMoney(result.salaryTaxableAmount) },
    { label: '员工承担金额', value: formatMoney(result.employeeBorneAmount) },
    { label: '判定依据', value: result.exceptionReason || '-', wide: true }
  ];
}

export function MyExpenseReviewPage() {
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const {
    approveExpenseReview,
    records,
    returnExpenseReview,
    revokeExpenseReview,
    supplementExpenseEvidence
  } = useMyExpenseReviewState();
  const [messageApi, contextHolder] = message.useMessage();
  const [viewMode, setViewMode] = useState<ReviewViewMode>('pending');
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [returnReason, setReturnReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [approvalDecision, setApprovalDecision] = useState<MyWorkExpenseApprovalDecision>(() =>
    createDefaultApprovalDecision(buildMyWorkExpenseReviewQueue(records)[0])
  );
  const [evidenceCompliance, setEvidenceCompliance] = useState<EvidenceCompliance>('发票');
  const [pendingEvidenceFile, setPendingEvidenceFile] = useState<RelatedFileRecord>();
  const [previewFile, setPreviewFile] = useState<RelatedFileRecord>();

  const pendingRows = useMemo(() => buildMyWorkExpenseReviewQueue(records), [records]);
  const processedRows = useMemo(() => buildMyWorkExpenseReviewCompletedRows(records), [records]);
  const visibleRows = viewMode === 'pending' ? pendingRows : processedRows;
  const activeRecord = visibleRows.find((record) => record.id === activeRecordId) ?? visibleRows[0];
  const metrics = useMemo(() => buildMyWorkExpenseReviewMetrics(records), [records]);
  const approvalIssues = activeRecord && viewMode === 'pending'
    ? getExpenseApprovalDecisionIssues(activeRecord.amount, approvalDecision)
    : [];

  function resetTransientState(record?: MyWorkExpenseReviewRecord) {
    setReturnReason('');
    setRevokeReason('');
    setPendingEvidenceFile(undefined);
    setEvidenceCompliance('发票');
    setApprovalDecision(createDefaultApprovalDecision(record));
  }

  function selectRecord(record: MyWorkExpenseReviewRecord) {
    setActiveRecordId(record.id);
    resetTransientState(record);
  }

  function changeViewMode(nextMode: ReviewViewMode) {
    const nextRows = nextMode === 'pending' ? pendingRows : processedRows;
    setViewMode(nextMode);
    setActiveRecordId(nextRows[0]?.id);
    resetTransientState(nextRows[0]);
  }

  function handleApprove(record: MyWorkExpenseReviewRecord) {
    const decisionIssues = getExpenseApprovalDecisionIssues(record.amount, approvalDecision);
    if (decisionIssues.length > 0) {
      void messageApi.warning(decisionIssues[0]);
      return;
    }

    const result = approveExpenseReview(record.id, approvalDecision);
    if (!result.success) {
      void messageApi.warning(result.reason ?? '报销审核未提交');
      return;
    }

    const nextRecordId = getNextActiveRecordId(pendingRows, record.id);
    const nextRecord = pendingRows.find((candidate) => candidate.id === nextRecordId);
    setActiveRecordId(nextRecordId);
    resetTransientState(nextRecord);
    void messageApi.success('已通过');
  }

  function handleReturn(record: MyWorkExpenseReviewRecord) {
    const normalizedReason = returnReason.trim();
    if (!normalizedReason) {
      void messageApi.warning('请填写退回原因');
      return;
    }

    const result = returnExpenseReview(record.id, normalizedReason, '李明');
    if (!result.success) {
      void messageApi.warning(result.reason ?? '报销未能退回');
      return;
    }

    const nextRecordId = getNextActiveRecordId(pendingRows, record.id);
    const nextRecord = pendingRows.find((candidate) => candidate.id === nextRecordId);
    setActiveRecordId(nextRecordId);
    resetTransientState(nextRecord);
    void messageApi.success('已退回');
  }

  function handleSupplementEvidence(record: MyWorkExpenseReviewRecord) {
    if (!pendingEvidenceFile) {
      void messageApi.warning('请选择补充凭证');
      return;
    }

    const result = supplementExpenseEvidence(
      record.id,
      { ...pendingEvidenceFile, status: '已上传' },
      evidenceCompliance,
      '李明'
    );
    if (!result.success) {
      void messageApi.warning(result.reason ?? '补充凭证未保存');
      return;
    }

    setPendingEvidenceFile(undefined);
    void messageApi.success('凭证已补充');
  }

  function handleRevoke(record: MyWorkExpenseReviewRecord) {
    const normalizedReason = revokeReason.trim();
    if (!normalizedReason) {
      void messageApi.warning('请填写撤销原因');
      return;
    }

    const result = revokeExpenseReview(record.id, normalizedReason, '李明');
    if (!result.success) {
      void messageApi.warning(result.reason ?? '审核结果不能直接撤销');
      return;
    }

    setRevokeReason('');
    void messageApi.success('审核结果已撤销');
  }

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={3}>
          <MetricCard icon={<AuditOutlined />} label="待审核" value={metrics.pendingCount} />
          <MetricCard icon={<ReloadOutlined />} label="需调整" value={metrics.returnedCount} />
          <MetricCard icon={<WarningOutlined />} label="已逾期" value={metrics.overdueCount} />
        </MetricGrid>
      }
      pageId="my-expense-review"
    >
      <div className="task-submit-workbench">
        <section className="task-submit-queue-card">
          <div className="task-submit-section-head">
            <div>
              <div className="task-submit-section-title">审核记录</div>
              <div className="task-submit-section-meta">{visibleRows.length} 条</div>
            </div>
            <Segmented
              options={[
                { label: `待处理 ${pendingRows.length}`, value: 'pending' },
                { label: `已处理 ${processedRows.length}`, value: 'processed' }
              ]}
              size="small"
              value={viewMode}
              onChange={(value) => changeViewMode(value as ReviewViewMode)}
            />
          </div>
          <div className="task-submit-card-list">
            {visibleRows.length > 0 ? (
              visibleRows.map((record) => {
                const isActive = activeRecord?.id === record.id;

                return (
                  <button
                    className={isActive ? 'task-submit-card is-active' : 'task-submit-card'}
                    key={record.id}
                    type="button"
                    onClick={() => selectRecord(record)}
                  >
                    <span className="task-submit-card-top">
                      <span className="task-submit-card-title">{record.title}</span>
                      <StatusTag tone={getReviewQueueTone(record)} value={getReviewQueueStatus(record)} />
                    </span>
                    <span className="task-submit-card-sub">
                      {record.submitterName} / {formatMoney(record.amount)}
                    </span>
                    <span className="task-submit-card-foot">
                      <CellText tone={isExpenseReviewOverdue(record) ? 'risk' : 'muted'}>{record.code}</CellText>
                      <span>{record.occurredAt}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty
                description={viewMode === 'pending' ? '暂无待审核报销' : '暂无已处理记录'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </section>

        <section className="task-submit-panel">
          {activeRecord ? (
            <>
              <div className="task-submit-panel-header">
                <div>
                  <div className="task-submit-panel-title">{activeRecord.title}</div>
                  <div className="task-submit-panel-sub">
                    {activeRecord.submitterName} / {activeRecord.code}
                  </div>
                </div>
                <Space size={6}>
                  {isExpenseReviewOverdue(activeRecord) ? <StatusTag tone="amber" value="已逾期" /> : null}
                  <StatusTag toneMap={expenseReviewStatusTone} value={activeRecord.reviewStatus} />
                </Space>
              </div>

              <div className="task-submit-panel-body">
                <div className="task-submit-summary-strip">
                  {[
                    { label: '提交人', value: activeRecord.submitterName },
                    { label: '金额', value: formatMoney(activeRecord.amount) },
                    { label: '费用日期', value: activeRecord.occurredAt },
                    {
                      label: '费用类目',
                      value: getExpenseReviewCategoryLabel(
                        activeRecord,
                        financePrimaryCategories,
                        financeSecondaryCategories
                      )
                    },
                    { label: '支付方式', value: activeRecord.paymentMethod },
                    { label: '凭证', value: `${activeRecord.files.length} 份` }
                  ].map((item) => (
                    <div className="task-submit-summary-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>

                <DetailSection icon={<FileTextOutlined />} title="报销信息">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '报销事由', value: activeRecord.title },
                      { label: '归属事项', value: activeRecord.relatedTarget || '-' },
                      { label: '提交时间', value: activeRecord.submittedAt },
                      { label: '原件类型', value: activeRecord.originalType },
                      { label: '备注', value: activeRecord.note || '-', wide: true }
                    ]}
                  />
                </DetailSection>

                <DetailSection icon={<FileProtectOutlined />} title="费用凭证">
                  <RelatedFileTable records={activeRecord.files} onPreview={setPreviewFile} />
                </DetailSection>

                {viewMode === 'pending' ? (
                  <>
                    <DetailSection icon={<CheckCircleOutlined />} title="审核结论">
                      <div className="drawer-form-grid">
                        <label className="drawer-form-field">
                          <span>费用真实性</span>
                          <Select
                            options={[{ label: '真实', value: '真实' }, { label: '不真实', value: '不真实' }]}
                            value={approvalDecision.expenseAuthenticity}
                            onChange={(value) => setApprovalDecision((current) => ({ ...current, expenseAuthenticity: value }))}
                          />
                        </label>
                        <label className="drawer-form-field">
                          <span>凭证合规性</span>
                          <Select
                            options={[
                              { label: '发票', value: '发票' },
                              { label: '财政票据或其他合法凭证', value: '财政票据或其他合法凭证' },
                              { label: '小额零星收款凭证', value: '小额零星收款凭证' },
                              { label: '暂缺合规凭证', value: '暂缺合规凭证' },
                              { label: '无法核验材料', value: '无法核验材料' }
                            ]}
                            value={approvalDecision.voucherCompliance}
                            onChange={(value) => setApprovalDecision((current) => ({ ...current, voucherCompliance: value }))}
                          />
                        </label>
                        <label className="drawer-form-field">
                          <span>超标准性质</span>
                          <Select
                            options={[
                              { label: '未超标', value: '未超标' },
                              { label: '业务必要超标', value: '业务必要超标' },
                              { label: '个人消费超标', value: '个人消费超标' },
                              { label: '混合性质超标', value: '混合性质超标' }
                            ]}
                            value={approvalDecision.overStandardNature}
                            onChange={(value) => setApprovalDecision((current) => ({ ...current, overStandardNature: value }))}
                          />
                        </label>
                        <label className="drawer-form-field">
                          <span>业务报销金额</span>
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} value={approvalDecision.businessReimbursementAmount} onChange={(value) => setApprovalDecision((current) => ({ ...current, businessReimbursementAmount: Number(value ?? 0) }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>转薪酬计税金额</span>
                          <InputNumber disabled={!activeRecord.submitterId} min={0} precision={2} style={{ width: '100%' }} value={approvalDecision.salaryTaxableAmount} onChange={(value) => setApprovalDecision((current) => ({ ...current, salaryTaxableAmount: Number(value ?? 0) }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>员工承担金额</span>
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} value={approvalDecision.employeeBorneAmount} onChange={(value) => setApprovalDecision((current) => ({ ...current, employeeBorneAmount: Number(value ?? 0) }))} />
                        </label>
                        <label className="drawer-form-field drawer-form-field-wide">
                          <span>凭证与超标准判定依据</span>
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            value={approvalDecision.exceptionReason}
                            onChange={(event) => setApprovalDecision((current) => ({ ...current, exceptionReason: event.target.value }))}
                          />
                        </label>
                      </div>
                      {approvalIssues[0] ? <Alert message={approvalIssues[0]} showIcon type="warning" /> : null}
                    </DetailSection>

                    <DetailSection icon={<ReloadOutlined />} title="退回修改">
                      <label className="task-submit-note-field">
                        <span>退回原因</span>
                        <Input.TextArea
                          autoSize={{ minRows: 2, maxRows: 4 }}
                          placeholder="退回时必填"
                          value={returnReason}
                          onChange={(event) => setReturnReason(event.target.value)}
                        />
                      </label>
                    </DetailSection>
                  </>
                ) : (
                  <>
                    <DetailSection icon={<CheckCircleOutlined />} title="处理结论">
                      <DetailInfoGrid columns={3} items={getProcessedResultItems(activeRecord)} />
                    </DetailSection>

                    {activeRecord.reviewStatus === '已通过' && activeRecord.expenseReviewResult?.evidenceStatus === '待补凭证' ? (
                      <DetailSection icon={<FileProtectOutlined />} title="补充凭证">
                        <div className="drawer-form-grid">
                          <label className="drawer-form-field">
                            <span>凭证类型</span>
                            <Select<EvidenceCompliance>
                              options={[
                                { label: '发票', value: '发票' },
                                { label: '财政票据或其他合法凭证', value: '财政票据或其他合法凭证' },
                                { label: '小额零星收款凭证', value: '小额零星收款凭证' }
                              ]}
                              value={evidenceCompliance}
                              onChange={setEvidenceCompliance}
                            />
                          </label>
                          <div className="drawer-form-field drawer-form-field-wide">
                            <FileSlot
                              accept=".pdf,.jpg,.jpeg,.png"
                              density="compact"
                              description="支持 PDF/JPG/PNG"
                              file={pendingEvidenceFile}
                              title="补充凭证"
                              onPreview={setPreviewFile}
                              onSelect={(file) => setPendingEvidenceFile(createEvidenceFile(activeRecord, file))}
                            />
                          </div>
                        </div>
                        <div className="drawer-inline-actions">
                          <Button disabled={!pendingEvidenceFile} icon={<CheckCircleOutlined />} type="primary" onClick={() => handleSupplementEvidence(activeRecord)}>
                            确认补充
                          </Button>
                        </div>
                      </DetailSection>
                    ) : null}

                    {activeRecord.reviewStatus === '已通过' ? (
                      <DetailSection icon={<StopOutlined />} title="撤销审核">
                        <label className="task-submit-note-field">
                          <span>撤销原因</span>
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            placeholder="撤销时必填"
                            value={revokeReason}
                            onChange={(event) => setRevokeReason(event.target.value)}
                          />
                        </label>
                        <div className="drawer-inline-actions">
                          <Button danger disabled={!revokeReason.trim()} icon={<StopOutlined />} onClick={() => handleRevoke(activeRecord)}>
                            撤销审核结果
                          </Button>
                        </div>
                      </DetailSection>
                    ) : null}
                  </>
                )}

                <OperationRecordSection icon={<AuditOutlined />} records={activeRecord.operationRecords} title="处理记录" />
              </div>

              {viewMode === 'pending' ? (
                <div className="task-submit-panel-footer">
                  <Button icon={<ReloadOutlined />} onClick={() => handleReturn(activeRecord)}>
                    退回修改
                  </Button>
                  <Button disabled={approvalIssues.length > 0} icon={<CheckCircleOutlined />} type="primary" onClick={() => handleApprove(activeRecord)}>
                    通过
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="task-submit-empty-panel">
              <Empty
                description={viewMode === 'pending' ? '暂无待审核报销' : '暂无已处理记录'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )}
        </section>
      </div>

      <FilePreviewModal
        file={previewFile ? { ...previewFile, category: previewFile.type } : undefined}
        title="凭证预览"
        onClose={() => setPreviewFile(undefined)}
      />
    </ManagementPageScaffold>
  );
}
