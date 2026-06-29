import {
  AuditOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Button, Empty, Input, message, Space } from 'antd';
import { useMemo, useState } from 'react';
import { DetailInfoGrid, DetailSection, StatusTag, type StatusTagTone } from '../../components/Detail';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText } from '../../components/TableCell';
import { formatMoney } from '../finance/financeUtils';
import {
  approveExpenseReviewRecord,
  buildMyWorkExpenseReviewMetrics,
  buildMyWorkExpenseReviewQueue,
  getExpenseReviewCategoryLabel,
  isExpenseReviewOverdue,
  myWorkExpenseReviewSeedRecords,
  returnExpenseReviewRecord,
  type MyWorkExpenseReviewRecord,
  type MyWorkExpenseReviewStatus
} from './myWorkExpenseReviewModel';

const expenseReviewStatusTone = {
  待审核: 'blue',
  需调整: 'red',
  已通过: 'green'
} satisfies Record<MyWorkExpenseReviewStatus, StatusTagTone>;

function getReviewQueueStatus(record: MyWorkExpenseReviewRecord) {
  return isExpenseReviewOverdue(record) ? '已逾期' : record.reviewStatus;
}

function getReviewQueueTone(record: MyWorkExpenseReviewRecord): StatusTagTone {
  return isExpenseReviewOverdue(record) ? 'amber' : expenseReviewStatusTone[record.reviewStatus];
}

function getNextActiveRecordId(queue: MyWorkExpenseReviewRecord[], currentRecordId: string) {
  return queue.find((record) => record.id !== currentRecordId)?.id;
}

export function MyExpenseReviewPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [records, setRecords] = useState<MyWorkExpenseReviewRecord[]>(() => myWorkExpenseReviewSeedRecords);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [returnReason, setReturnReason] = useState('');

  const queueRows = useMemo(() => buildMyWorkExpenseReviewQueue(records), [records]);
  const activeRecord = queueRows.find((record) => record.id === activeRecordId) ?? queueRows[0];
  const metrics = useMemo(() => buildMyWorkExpenseReviewMetrics(records), [records]);

  function selectRecord(record: MyWorkExpenseReviewRecord) {
    setActiveRecordId(record.id);
    setReturnReason('');
  }

  function handleApprove(record: MyWorkExpenseReviewRecord) {
    const nextRecord = approveExpenseReviewRecord(record, { reviewerName: '李明' });
    const nextActiveRecordId = getNextActiveRecordId(queueRows, record.id);

    setRecords((currentRecords) => currentRecords.map((currentRecord) => (currentRecord.id === record.id ? nextRecord : currentRecord)));
    setActiveRecordId(nextActiveRecordId);
    setReturnReason('');
    void messageApi.success('已通过');
  }

  function handleReturn(record: MyWorkExpenseReviewRecord) {
    const normalizedReason = returnReason.trim();

    if (!normalizedReason) {
      void messageApi.warning('请填写退回原因');
      return;
    }

    const nextRecord = returnExpenseReviewRecord(record, {
      returnedReason: normalizedReason,
      reviewerName: '李明'
    });
    const nextActiveRecordId = getNextActiveRecordId(queueRows, record.id);

    setRecords((currentRecords) => currentRecords.map((currentRecord) => (currentRecord.id === record.id ? nextRecord : currentRecord)));
    setActiveRecordId(nextActiveRecordId);
    setReturnReason('');
    void messageApi.success('已退回');
  }

  function handlePreviewFile(file: RelatedFileRecord) {
    void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
  }

  function handleDownloadFile(file: RelatedFileRecord) {
    void messageApi.success(`${file.name} 下载请求已记录`);
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
              <div className="task-submit-section-title">审核队列</div>
              <div className="task-submit-section-meta">{queueRows.length} 条待处理</div>
            </div>
          </div>
          <div className="task-submit-card-list">
            {queueRows.length > 0 ? (
              queueRows.map((record) => {
                const isActive = activeRecord?.id === record.id;

                return (
                  <button className={isActive ? 'task-submit-card is-active' : 'task-submit-card'} key={record.id} type="button" onClick={() => selectRecord(record)}>
                    <span className="task-submit-card-top">
                      <span className="task-submit-card-title">{record.title}</span>
                      <StatusTag tone={getReviewQueueTone(record)} value={getReviewQueueStatus(record)} />
                    </span>
                    <span className="task-submit-card-sub">
                      {record.submitterName} / {getExpenseReviewCategoryLabel(record)}
                    </span>
                    <span className="task-submit-card-line">
                      <span>金额：{formatMoney(record.amount)}</span>
                      <span>日期：{record.occurredAt}</span>
                    </span>
                    <span className="task-submit-card-foot">
                      <CellText tone={isExpenseReviewOverdue(record) ? 'risk' : 'default'}>提交 {record.submittedAt}</CellText>
                      {isExpenseReviewOverdue(record) ? <StatusTag tone="amber" value="已逾期" /> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty description="暂无待审核报销" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                    { label: '费用类目', value: getExpenseReviewCategoryLabel(activeRecord) },
                    { label: '支付方式', value: activeRecord.paymentMethod },
                    { label: '原件类型', value: activeRecord.originalType },
                    { label: '处理期限', value: activeRecord.dueAt },
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
                      { label: '备注', value: activeRecord.note || '-', wide: true }
                    ]}
                  />
                </DetailSection>

                <DetailSection icon={<FileProtectOutlined />} title="费用凭证">
                  <RelatedFileTable records={activeRecord.files} onDownload={handleDownloadFile} onPreview={handlePreviewFile} />
                </DetailSection>

                <OperationRecordSection icon={<AuditOutlined />} records={activeRecord.operationRecords} title="处理记录" />

                <DetailSection icon={<ReloadOutlined />} title="审核意见">
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
              </div>

              <div className="task-submit-panel-footer">
                <Button icon={<ReloadOutlined />} onClick={() => handleReturn(activeRecord)}>
                  退回修改
                </Button>
                <Button icon={<CheckCircleOutlined />} type="primary" onClick={() => handleApprove(activeRecord)}>
                  通过
                </Button>
              </div>
            </>
          ) : (
            <div className="task-submit-empty-panel">
              <Empty description="暂无待审核报销" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </section>
      </div>
    </ManagementPageScaffold>
  );
}
