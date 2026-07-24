import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  RollbackOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Alert, Button, Empty, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import { getClosedAccountingPeriodReadbackNotice } from './financeAccountingVoucherModel';
import {
  type FinancePaymentMethod,
  type FinanceTransactionRecord
} from './financeData';
import {
  directionTone,
  financeToday,
  formatMoney,
  getAmountTone,
  getFinanceDirectionLabels,
  getFinanceRecordCategorySnapshot,
  getFinanceTransactionReviewDueAt
} from './financeUtils';
import {
  buildFinanceReviewMetrics,
  getFinanceReviewQueueRows,
  getFinanceReviewReadiness,
  getFinanceReviewReadinessTone
} from './financeReviewModel';

function isEmployeeHandledMethod(paymentMethod: FinancePaymentMethod) {
  return paymentMethod === '员工代收' || paymentMethod === '现金暂收';
}

function isPublicAccountMethod(paymentMethod: FinancePaymentMethod) {
  return paymentMethod === '对公账户收款' ||
    paymentMethod === '对公账户付款' ||
    paymentMethod === '员工代收' ||
    paymentMethod === '现金暂收';
}

function getPublicAccountDisplay(record: Pick<FinanceTransactionRecord, 'publicAccountSnapshot'>) {
  return record.publicAccountSnapshot.displayName;
}

function getNextActiveRecordId(queueRows: FinanceTransactionRecord[], currentRecordId: string) {
  return queueRows.find((record) => record.id !== currentRecordId)?.id;
}

export function FinanceReviewPage() {
  const [searchParams] = useSearchParams();
  const transactionNo = searchParams.get('transactionNo');
  const handledTransactionNoRef = useRef<string>();
  const [messageApi, contextHolder] = message.useMessage();
  const {
    addTransactionVoucherFile,
    financeRows: records,
    getAccountingPeriodGuard,
    removeTransactionVoucherFile,
    returnFinanceTransaction,
    reviewFinanceTransaction,
    voidFinanceTransaction
  } = useFinanceManagement();
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const queueRows = useMemo(() => getFinanceReviewQueueRows(records), [records]);
  const reviewMetrics = useMemo(() => buildFinanceReviewMetrics(records), [records]);
  const activeRecord = queueRows.find((record) => record.id === activeRecordId) ?? queueRows[0];
  const activeReadiness = activeRecord ? getFinanceReviewReadiness(activeRecord) : undefined;
  const activeReadinessTone = activeReadiness ? getFinanceReviewReadinessTone(activeReadiness) : undefined;
  const activeReviewDueAt = activeRecord ? getFinanceTransactionReviewDueAt(activeRecord) : undefined;
  const activeDirectionLabels = activeRecord ? getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod) : undefined;
  const activeCategorySnapshot = activeRecord ? getFinanceRecordCategorySnapshot(activeRecord) : undefined;
  const activePeriodGuard = activeRecord ? getAccountingPeriodGuard(activeRecord.accountingPeriod, '处理流水复核') : undefined;
  const activePeriodLocked = activePeriodGuard ? !activePeriodGuard.allowed : false;
  const activePeriodReadbackNotice = activeRecord && activePeriodLocked
    ? getClosedAccountingPeriodReadbackNotice(activeRecord.accountingPeriod, '当前流水复核事项')
    : undefined;

  useEffect(() => {
    if (!transactionNo || handledTransactionNoRef.current === transactionNo) {
      return;
    }

    const targetRecord = queueRows.find((record) => record.transactionNo === transactionNo);
    if (!targetRecord) {
      return;
    }

    handledTransactionNoRef.current = transactionNo;
    setActiveRecordId(targetRecord.id);
  }, [queueRows, transactionNo]);

  function buildVoucherFile(file: FinanceVoucherUploadFile, record: FinanceTransactionRecord): RelatedFileRecord | undefined {
    const maxFileSize = 10 * 1024 * 1024;

    if (file.size && file.size > maxFileSize) {
      void messageApi.warning(`${file.name} 超过 10MB，无法作为凭证上传`);
      return undefined;
    }

    if (record.files.some((currentFile) => currentFile.name === file.name)) {
      void messageApi.warning(`${file.name} 已在凭证列表中`);
      return undefined;
    }

    return {
      id: `fin-voucher-${record.id}-${file.uid || Date.now()}`,
      name: file.name,
      status: '已选择',
      type: '收支凭证',
      updatedAt: financeToday
    };
  }

  function handleVoucherFileSelect(file: FinanceVoucherUploadFile) {
    if (!activeRecord || activeRecord.status !== '待复核') {
      return;
    }

    const periodGuard = getAccountingPeriodGuard(activeRecord.accountingPeriod, '补充流水凭证');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    const nextFile = buildVoucherFile(file, activeRecord);

    if (!nextFile) {
      return;
    }

    if (!addTransactionVoucherFile(activeRecord.id, nextFile)) {
      void messageApi.warning('当前流水不可补充凭证');
      return;
    }

    void messageApi.success('凭证已补充');
  }

  function handleReview(record: FinanceTransactionRecord) {
    const periodGuard = getAccountingPeriodGuard(record.accountingPeriod, '复核流水入账');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    if (record.voucherStatus !== '已上传') {
      void messageApi.warning('请先补充凭证，再复核入账');
      return;
    }

    const reviewResult = reviewFinanceTransaction(record.id);

    if (!reviewResult.success) {
      void messageApi.warning(reviewResult.message);
      return;
    }

    const nextActiveRecordId = getNextActiveRecordId(queueRows, record.id);
    setActiveRecordId(nextActiveRecordId);
    void messageApi.success('流水已复核入账');
  }

  function handleReturn(record: FinanceTransactionRecord) {
    const periodGuard = getAccountingPeriodGuard(record.accountingPeriod, '退回流水复核');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    const nextActiveRecordId = getNextActiveRecordId(queueRows, record.id);

    if (!returnFinanceTransaction(record.id)) {
      void messageApi.warning('当前流水不可退回修改');
      return;
    }

    setActiveRecordId(nextActiveRecordId);
    void messageApi.success('流水已退回，需登记侧重新提交后再复核');
  }

  function handleVoid(record: FinanceTransactionRecord) {
    const periodGuard = getAccountingPeriodGuard(record.accountingPeriod, '作废流水');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    const nextActiveRecordId = getNextActiveRecordId(queueRows, record.id);

    if (!voidFinanceTransaction(record.id)) {
      void messageApi.warning('当前流水不可作废');
      return;
    }

    setActiveRecordId(nextActiveRecordId);
    void messageApi.success('流水已作废');
  }

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      layout="table-workbench"
      metrics={
        <MetricGrid columns={3}>
          <MetricCard icon={<AuditOutlined />} label="待复核" value={reviewMetrics.pendingReviewCount} />
          <MetricCard icon={<WarningOutlined />} label="凭证待补" value={reviewMetrics.missingVoucherCount} />
          <MetricCard icon={<WarningOutlined />} label="逾期复核" value={reviewMetrics.overdueReviewCount} />
        </MetricGrid>
      }
      pageId="finance-review"
    >
      <div className="task-submit-workbench" data-testid="finance-review-workbench">
        <section className="task-submit-queue-card">
          <div className="task-submit-section-head">
            <div>
              <div className="task-submit-section-title">复核队列</div>
              <div className="task-submit-section-meta">{queueRows.length} 条待处理</div>
            </div>
          </div>
          <div className="task-submit-card-list">
            {queueRows.length > 0 ? (
              queueRows.map((record) => {
                const snapshot = getFinanceRecordCategorySnapshot(record);
                const isActive = activeRecord?.id === record.id;

                return (
                  <button
                    className={isActive ? 'finance-review-queue-row is-active' : 'finance-review-queue-row'}
                    key={record.id}
                    type="button"
                    onClick={() => setActiveRecordId(record.id)}
                  >
                    <span className="finance-review-queue-row-main">
                      <span className="finance-review-queue-row-title">{record.counterparty}</span>
                      <CellText tone={getAmountTone(record)}>{formatMoney(record.amount)}</CellText>
                    </span>
                    <span className="finance-review-queue-row-sub">
                      <span>{record.transactionNo} / {snapshot.secondaryName}</span>
                      <span>{record.occurredAt.slice(5)}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty description="暂无待复核流水" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </section>

        <section className="task-submit-panel">
          {activeRecord ? (
            <>
              <div className="task-submit-panel-header">
                <div>
                  <div className="task-submit-panel-title">{activeRecord.counterparty}</div>
                  <div className="task-submit-panel-sub">
                    {activeRecord.transactionNo} / {activeRecord.sourceTitle}
                  </div>
                </div>
                <Space size={6}>
                  <StatusTag toneMap={directionTone} value={activeRecord.direction} />
                  {activeReadiness && activeReadinessTone ? <StatusTag tone={activeReadinessTone} value={activeReadiness} /> : null}
                </Space>
              </div>

              <div className="task-submit-panel-body">
                <div className="task-submit-summary-strip">
                  {[
                    { label: activeDirectionLabels?.counterparty ?? '对象', value: activeRecord.counterparty },
                    { label: activeDirectionLabels?.amount ?? '金额', value: formatMoney(activeRecord.amount) },
                    { label: '发生日期', value: activeRecord.occurredAt },
                    { label: '复核期限', value: activeReviewDueAt },
                    { label: '当前处理', value: activeReadiness }
                  ].map((item) => (
                    <div className="task-submit-summary-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>

                {activeRecord.status === '待复核' && activeRecord.voucherStatus !== '已上传' && !activePeriodLocked ? (
                  <Alert className="finance-review-alert" message="该流水缺少凭证，补充凭证后才能复核入账。" showIcon type="warning" />
                ) : null}
                {activePeriodReadbackNotice ? (
                  <Alert className="finance-period-readback-alert" message={activePeriodReadbackNotice} showIcon type="info" />
                ) : null}

                <DetailSection icon={<AuditOutlined />} title="复核信息">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '流水号', value: activeRecord.transactionNo },
                      { label: '财务期间', value: activeRecord.accountingPeriod },
                      { label: '一级类目', value: activeCategorySnapshot?.primaryName },
                      { label: '二级类目', value: activeCategorySnapshot?.secondaryName },
                      { label: '统计归集', value: activeCategorySnapshot?.reportAggregation },
                      { label: '收付方式', value: activeRecord.paymentMethod },
                      {
                        label: activeDirectionLabels?.publicAccount ?? '对公账户',
                        value: isPublicAccountMethod(activeRecord.paymentMethod) ? getPublicAccountDisplay(activeRecord) : '-'
                      },
                      ...(isEmployeeHandledMethod(activeRecord.paymentMethod)
                        ? [
                            {
                              label: activeDirectionLabels?.handler ?? '经办人',
                              value: activeRecord.handler
                            }
                          ]
                        : [])
                    ]}
                  />
                </DetailSection>

                <DetailSection icon={<FileSearchOutlined />} title="业务来源">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { label: '来源类型', value: activeRecord.sourceType },
                      { label: '来源单号', value: activeRecord.sourceNo },
                      { label: '事项说明', value: activeRecord.sourceTitle, wide: true },
                      { label: '备注', value: activeRecord.note, wide: true }
                    ]}
                  />
                </DetailSection>

                <DetailSection icon={<FileProtectOutlined />} title={activeDirectionLabels?.voucherSection ?? '凭证'}>
                  <FinanceVoucherUploadPanel
                    emptyText={activeDirectionLabels?.voucherEmpty}
                    disabled={activePeriodLocked}
                    files={activeRecord.files}
                    title={activeDirectionLabels?.uploadVoucher}
                    onRemove={(file) => {
                      const periodGuard = getAccountingPeriodGuard(activeRecord.accountingPeriod, '移除流水凭证');

                      if (!periodGuard.allowed) {
                        void messageApi.warning(periodGuard.reason);
                        return;
                      }

                      if (!removeTransactionVoucherFile(activeRecord.id, file.id)) {
                        void messageApi.warning('当前流水不可移除凭证');
                      }
                    }}
                    onSelect={handleVoucherFileSelect}
                  />
                </DetailSection>

                <OperationRecordSection icon={<AuditOutlined />} records={activeRecord.operationRecords} title="操作记录" />
              </div>

              <div className="task-submit-panel-footer">
                <Button disabled={activePeriodLocked} icon={<CloseCircleOutlined />} onClick={() => handleVoid(activeRecord)}>
                  作废
                </Button>
                <Button disabled={activePeriodLocked} icon={<RollbackOutlined />} onClick={() => handleReturn(activeRecord)}>
                  退回修改
                </Button>
                <Button
                  disabled={activePeriodLocked || activeRecord.voucherStatus !== '已上传'}
                  icon={<CheckCircleOutlined />}
                  type="primary"
                  onClick={() => handleReview(activeRecord)}
                >
                  复核入账
                </Button>
              </div>
            </>
          ) : (
            <div className="task-submit-empty-panel">
              <Empty description="暂无待复核流水" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </section>
      </div>
    </ManagementPageScaffold>
  );
}
