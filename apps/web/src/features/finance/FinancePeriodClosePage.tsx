import {
  AuditOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  LockOutlined,
  ProfileOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Alert, DatePicker, Input, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DateScopeFilter, type DateScopeFilterMode } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag, type DetailInfoGridItem } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import { accountingSubjectProfile } from './financeAccountingSubjectData';
import {
  applyAccountingVoucherLifecycle,
  buildAccountingVoucherFromLaterPeriodAdjustment,
  buildAccountingLedgerEntries,
  buildAccountingVouchers,
  canSubmitLaterPeriodAccountingVoucherAdjustment,
  createLaterPeriodAccountingVoucherAdjustmentRecord,
  getAvailableLaterPeriodAdjustmentAccountingPeriod,
  validateLaterPeriodAccountingVoucherAdjustment,
  type AccountingVoucherLaterPeriodAdjustmentInput,
  type AccountingVoucherLaterPeriodAdjustmentRecord,
  type AccountingVoucherLine,
  type AccountingVoucherRecord
} from './financeAccountingVoucherModel';
import {
  buildFinancePeriodCloseReadModel,
  createFinancePeriodCloseSummarySnapshot,
  defaultFinancePeriodCloseFilters,
  financePeriodCloseDefaultMonth,
  financePeriodCloseStatusOptions,
  getFinancePeriodCloseConfirmationNotice,
  type FinancePeriodCloseCheckItem,
  type FinancePeriodCloseFilters,
  type FinancePeriodCloseRecord,
  type FinancePeriodCloseStatus
} from './financePeriodCloseModel';
import { formatMoney } from './financeUtils';

const periodCloseStatusTone = {
  可结账: 'green',
  需处理: 'amber',
  已结账: 'gray'
} as const;

const checkStatusTone = {
  通过: 'green',
  需处理: 'amber'
} as const;

const trialBalanceTone = {
  平衡: 'green',
  不平衡: 'red'
} as const;

const financialStatementReadinessStatusTone = {
  可出具: 'green',
  暂不可出具: 'amber'
} as const;

const laterAdjustmentStatusTone = {
  待记账: 'amber',
  已记账: 'green'
} as const;

const periodCloseModeOptions: Array<{ label: string; value: DateScopeFilterMode }> = [
  { label: '全部', value: 'all' },
  { label: '当月', value: 'currentMonth' },
  { label: '按月份', value: 'month' }
];

function formatCount(value: number, unit = '项') {
  return `${value} ${unit}`;
}

function normalizeDatePickerValue(value: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function getLaterAdjustmentSourceVouchers({
  accountingPeriod,
  existingRows,
  periodLocks,
  voucherRows
}: {
  accountingPeriod: string;
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  periodLocks: ReturnType<typeof useFinanceManagement>['accountingPeriodLocks'];
  voucherRows: AccountingVoucherRecord[];
}) {
  return voucherRows.filter((record) => {
    if (record.accountingPeriod !== accountingPeriod) {
      return false;
    }

    return Boolean(getAvailableLaterPeriodAdjustmentAccountingPeriod(record, periodLocks, existingRows));
  });
}

function PeriodCloseDrawer({
  canStartLaterAdjustment,
  laterAdjustmentRows,
  record,
  onClose,
  onConfirmClose,
  onReopen,
  onStartLaterAdjustment
}: {
  canStartLaterAdjustment: boolean;
  laterAdjustmentRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  record?: FinancePeriodCloseRecord;
  onClose: () => void;
  onConfirmClose: (record: FinancePeriodCloseRecord) => void;
  onReopen: (record: FinancePeriodCloseRecord) => void;
  onStartLaterAdjustment: (record: FinancePeriodCloseRecord) => void;
}) {
  if (!record) {
    return null;
  }

  const isClosed = record.status === '已结账';
  const checkColumns: TableColumnsType<FinancePeriodCloseCheckItem> = [
    {
      title: '检查项',
      dataIndex: 'title',
      width: 130
    },
    {
      title: '结果',
      dataIndex: 'status',
      width: 96,
      render: (status: FinancePeriodCloseCheckItem['status']) => <StatusTag toneMap={checkStatusTone} value={status} />
    },
    {
      title: '说明',
      dataIndex: 'detail',
      width: 420
    }
  ];
  const laterAdjustmentColumns: TableColumnsType<AccountingVoucherLaterPeriodAdjustmentRecord> = [
    {
      title: '调整事项',
      key: 'adjustment',
      width: 220,
      render: (_, row) => (
        <CompactCell
          primary={row.adjustmentNo}
          secondary={`原 ${row.originalAccountingPeriod} / 入账 ${row.accountingPeriod}`}
        />
      )
    },
    {
      title: '原凭证',
      dataIndex: 'originalVoucherNo',
      width: 160
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 140,
      render: (amount: number) => formatMoney(amount)
    },
    {
      title: '状态',
      dataIndex: 'candidateStatus',
      width: 120,
      render: (status: AccountingVoucherLaterPeriodAdjustmentRecord['candidateStatus']) => (
        <StatusTag toneMap={laterAdjustmentStatusTone} value={status} />
      )
    }
  ];
  const reportViewStatus = record.financialStatementReadinessMode === '暂不可出具' ? '暂不可出具' : '可出具';
  const periodSummaryItems: DetailInfoGridItem[] = [
    { label: '会计期间', value: record.accountingPeriod },
    { label: '本期借方', value: formatMoney(record.debitTotal) },
    { label: '本期贷方', value: formatMoney(record.creditTotal) },
    { label: '试算差额', value: formatMoney(record.trialBalanceDifference) },
    ...(isClosed
      ? [
          { label: '结账人', value: record.closedBy },
          { label: '结账时间', value: record.closedAt },
          { label: '结账说明', value: record.closeReason, wide: true }
        ]
      : [])
  ];
  const closeSnapshotItems: DetailInfoGridItem[] = [
    { label: '检查快照', value: formatCount(record.checkItems.length) },
    { label: '总账快照', value: formatCount(record.generalLedgerSnapshotRows?.length ?? 0, '个科目') },
    { label: '报表快照', value: record.financialStatementSnapshot ? '已生成' : '未生成' },
    { label: '快照时间', value: record.closedAt },
    { label: '快照来源', value: '结账确认' }
  ];
  const pendingItemSummary = [
    { count: record.pendingReviewCashFlowCount, label: '流水复核', unit: '条' },
    { count: record.unreconciledCashFlowCount, label: '银行对账', unit: '条' },
    { count: record.socialInsurancePendingCount, label: '社保公积金', unit: '项' }
  ]
    .filter((item) => item.count > 0)
    .map<DetailInfoGridItem>((item) => ({ label: item.label, value: formatCount(item.count, item.unit) }));
  const hasLaterAdjustments = record.laterAdjustmentSourceCount > 0 || record.laterAdjustmentTargetCount > 0;
  const hasContinuityBlocker = Boolean(record.continuityBlockerPeriod);
  const canReopenSequenceException = isClosed && record.continuityStatus === '锁定顺序异常';
  const closeCheckSummaryCard = hasContinuityBlocker
    ? {
        icon: <WarningOutlined />,
        key: 'continuity',
        label: record.continuityStatus === '锁定顺序异常' ? '结账顺序' : '前期结账',
        value: record.continuityBlockerPeriod
      }
    : isClosed
    ? {
        icon: <CheckCircleOutlined />,
        key: 'checkReadback',
        label: '结账检查',
        value: `${record.checkItems.length} 项回看`
      }
    : record.canClose
      ? {
          icon: <CheckCircleOutlined />,
          key: 'checkPassed',
          label: '结账检查',
          value: `${record.checkItems.length} 项通过`
        }
      : {
          icon: <WarningOutlined />,
          key: 'blocked',
          label: '待处理检查',
          value: record.blockedCheckCount
        };

  return (
    <DetailDrawerShell
      bodyTestId="finance-period-close-detail-drawer"
      className="finance-transaction-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      primaryAction={
        canReopenSequenceException
          ? {
              icon: <WarningOutlined />,
              label: '修复结账顺序',
              onClick: () => onReopen(record),
              testId: 'finance-period-close-reopen-button'
            }
          : record.canClose
          ? {
              icon: <LockOutlined />,
              label: '确认结账',
              onClick: () => onConfirmClose(record),
              testId: 'finance-period-close-confirm-button'
            }
          : isClosed && canStartLaterAdjustment
            ? {
                icon: <FileTextOutlined />,
                label: '发起后续调整',
                onClick: () => onStartLaterAdjustment(record),
                testId: 'finance-period-close-later-adjustment-button'
              }
          : undefined
      }
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={periodCloseStatusTone}
          subtitle={record.accountingPeriod}
          title="期间结账详情"
        />
      }
      width={920}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          {
            icon: <FileTextOutlined />,
            key: 'bookedVoucher',
            label: '已记账凭证',
            value: record.bookedVoucherCount
          },
          {
            icon: <ClockCircleOutlined />,
            key: 'unbookedVoucher',
            label: '待处理凭证',
            value: record.pendingVoucherCount + record.issueVoucherCount + record.readyToBookVoucherCount
          },
          {
            icon: <BookOutlined />,
            key: 'trialBalance',
            label: '试算状态',
            value: <StatusTag toneMap={trialBalanceTone} value={record.trialBalanceStatus} />
          },
          closeCheckSummaryCard
        ]}
      />

      {hasContinuityBlocker ? (
        <Alert
          className="drawer-inline-alert"
          data-testid="finance-period-close-continuity-alert"
          message={record.continuityDetail}
          showIcon
          type="warning"
        />
      ) : null}

      <DetailTabs
        items={[
          {
            children: (
              <DetailSection icon={<AuditOutlined />} title="结账检查">
                <CompactDetailTable<FinancePeriodCloseCheckItem>
                  columns={checkColumns}
                  dataSource={record.checkItems}
                  rowKey="code"
                  scrollX={646}
                />
              </DetailSection>
            ),
            key: 'checks',
            label: '结账检查'
          },
          {
            children: (
              <>
                <DetailSection icon={<FileTextOutlined />} title="报表状态">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { label: '当前报表', value: record.financialStatementReadinessMode },
                      { label: '出具状态', value: <StatusTag toneMap={financialStatementReadinessStatusTone} value={reportViewStatus} /> }
                    ]}
                  />
                </DetailSection>

                {pendingItemSummary.length > 0 ? (
                  <DetailSection icon={<WarningOutlined />} title="待处理事项">
                    <DetailInfoGrid
                      columns={3}
                      items={pendingItemSummary}
                    />
                  </DetailSection>
                ) : null}

                {hasLaterAdjustments ? (
                  <DetailSection icon={<AuditOutlined />} title="后续调整">
                    <DetailInfoGrid
                      columns={2}
                      items={[
                        { label: '历史期间调整', value: formatCount(record.laterAdjustmentSourceCount, '项') },
                        { label: '本期承接调整', value: formatCount(record.laterAdjustmentTargetCount, '项') }
                      ]}
                    />
                    {laterAdjustmentRows.length > 0 ? (
                      <CompactDetailTable<AccountingVoucherLaterPeriodAdjustmentRecord>
                        columns={laterAdjustmentColumns}
                        dataSource={laterAdjustmentRows}
                        rowKey="id"
                        scrollX={640}
                      />
                    ) : null}
                  </DetailSection>
                ) : null}

                {isClosed ? (
                  <DetailSection icon={<ProfileOutlined />} title="结账快照">
                    <DetailInfoGrid
                      columns={3}
                      items={closeSnapshotItems}
                    />
                  </DetailSection>
                ) : null}

                {record.reopenedAt ? (
                  <DetailSection icon={<WarningOutlined />} title="结账修复记录">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '修复状态', value: '已反结账' },
                        { label: '修复人', value: record.reopenedBy },
                        { label: '修复时间', value: record.reopenedAt },
                        { label: '修复原因', value: record.reopenReason, wide: true }
                      ]}
                    />
                  </DetailSection>
                ) : null}

                <DetailSection icon={<BookOutlined />} title={isClosed ? '结账结果' : '期间汇总'}>
                  <DetailInfoGrid
                    columns={3}
                    items={periodSummaryItems}
                  />
                </DetailSection>
              </>
            ),
            key: 'summary',
            label: '结账信息'
          }
        ]}
        tabTestIdPrefix="finance-period-close-detail-tab"
        testId="finance-period-close-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

function PeriodCloseLaterAdjustmentDrawer({
  accountingPeriodLocks,
  existingRows,
  form,
  originalPeriod,
  selectedVoucherId,
  sourceVouchers,
  onClose,
  onSelectVoucher,
  onSubmit,
  onUpdate
}: {
  accountingPeriodLocks: ReturnType<typeof useFinanceManagement>['accountingPeriodLocks'];
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  form: AccountingVoucherLaterPeriodAdjustmentInput;
  originalPeriod?: string;
  selectedVoucherId?: string;
  sourceVouchers: AccountingVoucherRecord[];
  onClose: () => void;
  onSelectVoucher: (voucherId: string) => void;
  onSubmit: () => void;
  onUpdate: <K extends keyof AccountingVoucherLaterPeriodAdjustmentInput>(
    field: K,
    value: AccountingVoucherLaterPeriodAdjustmentInput[K]
  ) => void;
}) {
  if (!originalPeriod) {
    return null;
  }

  const selectedVoucher = sourceVouchers.find((record) => record.id === selectedVoucherId);
  const validationIssues = selectedVoucher
    ? validateLaterPeriodAccountingVoucherAdjustment(selectedVoucher, form, accountingPeriodLocks, existingRows)
    : ['请选择原凭证'];
  const reasonIssue = validationIssues.find((issue) => issue === '调整原因必填');
  const blockingIssue = validationIssues.find((issue) => issue !== reasonIssue);
  const canSubmit = Boolean(selectedVoucher) && validationIssues.length === 0;
  const previewSource = selectedVoucher && canSubmit
    ? createLaterPeriodAccountingVoucherAdjustmentRecord({
        actor: '当前账号',
        existingRows,
        input: form,
        originalRecord: selectedVoucher
      })
    : undefined;
  const adjustmentPreview = previewSource ? buildAccountingVoucherFromLaterPeriodAdjustment(previewSource, 0) : undefined;
  const lineColumns: TableColumnsType<AccountingVoucherLine> = [
    {
      title: '方向',
      dataIndex: 'side',
      width: 96
    },
    {
      title: '科目',
      key: 'subject',
      width: 180,
      render: (_, row) => <CompactCell primary={row.subject?.name ?? row.subjectCode} secondary={row.subjectCode} />
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 140,
      render: (amount: number) => formatMoney(amount)
    }
  ];

  return (
    <DetailDrawerShell
      bodyTestId="finance-period-close-later-adjustment-drawer"
      className="finance-transaction-drawer"
      closeAction={{
        label: '取消',
        onClick: onClose
      }}
      open={Boolean(originalPeriod)}
      primaryAction={{
        disabled: !canSubmit,
        icon: <FileTextOutlined />,
        label: '创建调整事项',
        testId: 'finance-period-close-later-adjustment-submit',
        onClick: onSubmit
      }}
      title={
        <DetailDrawerTitle
          subtitle={`原期间 ${originalPeriod}`}
          title="发起后续调整"
        />
      }
      width={860}
      onClose={onClose}
    >
      <DetailSection icon={<ProfileOutlined />} title="原凭证">
        <div className="period-close-later-adjustment-stack">
          <DrawerFormGrid>
            <DrawerFormField label="原凭证" required wide>
              <Select
                options={sourceVouchers.map((record) => ({
                  label: `${record.voucherNo} / ${record.summary} / ${formatMoney(record.amount)}`,
                  value: record.id
                }))}
                value={selectedVoucherId}
                onChange={onSelectVoucher}
              />
            </DrawerFormField>
          </DrawerFormGrid>
          {selectedVoucher ? (
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '原归属月份', value: selectedVoucher.accountingPeriod },
                { label: '金额', value: formatMoney(selectedVoucher.amount) },
                { label: '业务对象', value: selectedVoucher.counterparty },
                { label: '记账时间', value: selectedVoucher.bookedAt },
                { label: '摘要', value: selectedVoucher.summary, wide: true }
              ]}
            />
          ) : null}
        </div>
      </DetailSection>

      <DetailSection icon={<FileTextOutlined />} title="调整内容">
        <div className="period-close-later-adjustment-stack">
          <DetailInfoGrid
            columns={2}
            items={[
              { label: '调整方式', value: '冲销原凭证' },
              { label: '入账规则', value: '生成后续期间待记账凭证' }
            ]}
          />
          <DrawerFormGrid>
            <DrawerFormField label="调整期间" required>
              <DatePicker
                inputReadOnly
                picker="month"
                value={form.accountingPeriod ? dayjs(`${form.accountingPeriod}-01`) : undefined}
                onChange={(_, dateString) => {
                  const accountingPeriod = normalizeDatePickerValue(dateString);

                  onUpdate('accountingPeriod', accountingPeriod);

                  if (accountingPeriod && (!form.adjustedAt || form.adjustedAt.slice(0, 7) !== accountingPeriod)) {
                    onUpdate('adjustedAt', `${accountingPeriod}-01`);
                  }
                }}
              />
            </DrawerFormField>
            <DrawerFormField label="调整日期" required>
              <DatePicker
                inputReadOnly
                value={form.adjustedAt ? dayjs(form.adjustedAt) : undefined}
                onChange={(_, dateString) => onUpdate('adjustedAt', normalizeDatePickerValue(dateString))}
              />
            </DrawerFormField>
            <DrawerFormField label="调整原因" required wide>
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 5 }}
                data-testid="finance-period-close-later-adjustment-reason"
                placeholder="填写历史期间问题和本期调整依据"
                value={form.reason}
                onChange={(event) => onUpdate('reason', event.target.value)}
              />
              {reasonIssue ? <span className="drawer-form-help drawer-form-help-warning">{reasonIssue}</span> : null}
            </DrawerFormField>
          </DrawerFormGrid>

          {blockingIssue ? (
            <Alert
              className="drawer-inline-alert"
              message={blockingIssue}
              showIcon
              type="warning"
            />
          ) : null}
        </div>
      </DetailSection>

      {adjustmentPreview && previewSource ? (
        <DetailSection icon={<FileTextOutlined />} title="调整凭证预览">
          <DetailInfoGrid
            columns={3}
            items={[
              { label: '调整事项号', value: previewSource.adjustmentNo },
              { label: '入账期间', value: adjustmentPreview.accountingPeriod },
              { label: '原期间', value: previewSource.originalAccountingPeriod },
              { label: '调整方式', value: '冲销原凭证' },
              { label: '凭证日期', value: adjustmentPreview.voucherDate },
              { label: '金额', value: formatMoney(adjustmentPreview.amount) },
              { label: '状态', value: <StatusTag toneMap={laterAdjustmentStatusTone} value={previewSource.candidateStatus} /> }
            ]}
          />
          <CompactDetailTable<AccountingVoucherLine>
            columns={lineColumns}
            dataSource={adjustmentPreview.lines}
            rowKey="id"
            scrollX={520}
          />
        </DetailSection>
      ) : null}
    </DetailDrawerShell>
  );
}

function PeriodCloseConfirmDrawer({
  record,
  reason,
  onCancel,
  onChangeReason,
  onSubmit
}: {
  record?: FinancePeriodCloseRecord;
  reason: string;
  onCancel: () => void;
  onChangeReason: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!record) {
    return null;
  }

  const canSubmit = record.canClose && reason.trim().length > 0;
  const hasContinuityBlocker = Boolean(record.continuityBlockerPeriod);

  return (
    <DetailDrawerShell
      bodyTestId="finance-period-close-confirm-drawer"
      className="finance-transaction-drawer"
      closeAction={{ label: '取消', onClick: onCancel }}
      open={Boolean(record)}
      primaryAction={{
        disabled: !canSubmit,
        icon: <LockOutlined />,
        label: '确认结账',
        testId: 'finance-period-close-confirm-submit',
        onClick: onSubmit
      }}
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={periodCloseStatusTone}
          subtitle={record.accountingPeriod}
          title="确认期间结账"
        />
      }
      width={760}
      onClose={onCancel}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <FileTextOutlined />, key: 'booked', label: '已记账凭证', value: record.bookedVoucherCount },
          { icon: <BookOutlined />, key: 'debit', label: '本期借方', value: formatMoney(record.debitTotal) },
          { icon: <BookOutlined />, key: 'credit', label: '本期贷方', value: formatMoney(record.creditTotal) },
          { icon: <CheckCircleOutlined />, key: 'checks', label: '结账检查', value: `${record.checkItems.length} 项通过` }
        ]}
      />

      <Alert
        className="drawer-inline-alert"
        data-testid="finance-period-close-confirm-notice"
        message={hasContinuityBlocker ? record.continuityDetail : getFinancePeriodCloseConfirmationNotice()}
        showIcon
        type="warning"
      />

      <DetailSection icon={<ProfileOutlined />} title="结账快照">
        <DetailInfoGrid
          columns={2}
          items={[
            { label: '检查结果', value: `${record.checkItems.length} 项通过` },
            { label: '总账余额', value: formatCount(record.generalLedgerSnapshotRows?.length ?? 0, '个科目') },
            { label: '财务报表', value: record.financialStatementSnapshot ? '将生成正式快照' : '暂不可生成' },
            { label: '期间状态', value: hasContinuityBlocker ? '需先完成前期结账' : '确认后锁定' }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<LockOutlined />} title="结账确认">
        <DrawerFormGrid>
          <DrawerFormField label="会计期间">
            <Input disabled value={record.accountingPeriod} />
          </DrawerFormField>
          <DrawerFormField label="结账说明" required wide>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              data-testid="finance-period-close-confirm-reason"
              placeholder="填写本次结账说明"
              value={reason}
              onChange={(event) => onChangeReason(event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
    </DetailDrawerShell>
  );
}

function PeriodCloseReopenDrawer({
  record,
  reason,
  onCancel,
  onChangeReason,
  onSubmit
}: {
  record?: FinancePeriodCloseRecord;
  reason: string;
  onCancel: () => void;
  onChangeReason: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!record) {
    return null;
  }

  const canSubmit = record.status === '已结账' && record.continuityStatus === '锁定顺序异常' && reason.trim().length > 0;

  return (
    <DetailDrawerShell
      bodyTestId="finance-period-close-reopen-drawer"
      className="finance-transaction-drawer"
      closeAction={{ label: '取消', onClick: onCancel }}
      open={Boolean(record)}
      primaryAction={{
        disabled: !canSubmit,
        icon: <WarningOutlined />,
        label: '确认反结账',
        onClick: onSubmit,
        testId: 'finance-period-close-reopen-submit'
      }}
      title={
        <DetailDrawerTitle
          status="已结账"
          statusToneMap={periodCloseStatusTone}
          subtitle={record.accountingPeriod}
          title="修复结账顺序"
        />
      }
      width={760}
      onClose={onCancel}
    >
      <Alert
        className="drawer-inline-alert"
        data-testid="finance-period-close-reopen-notice"
        message={`本期在 ${record.continuityBlockerPeriod} 未结账时已结账。反结账后，需先完成前期结账再重新结账。`}
        showIcon
        type="warning"
      />

      <DetailSection icon={<ProfileOutlined />} title="修复范围">
        <DetailInfoGrid
          columns={2}
          items={[
            { label: '当前期间', value: record.accountingPeriod },
            { label: '缺失前期', value: record.continuityBlockerPeriod },
            { label: '当前状态', value: '结账顺序异常' },
            { label: '处理结果', value: '恢复开放，保留历史快照' }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<WarningOutlined />} title="反结账确认">
        <DrawerFormGrid>
          <DrawerFormField label="修复原因" required wide>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              data-testid="finance-period-close-reopen-reason"
              placeholder="填写本次反结账修复原因"
              value={reason}
              onChange={(event) => onChangeReason(event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
    </DetailDrawerShell>
  );
}

export function FinancePeriodClosePage() {
  const {
    addAccountingVoucherLaterPeriodAdjustment,
    accountingPeriodLocks,
    accountingVoucherLaterPeriodAdjustmentRows,
    accountingVoucherLifecycleRows,
    bankReconciliationRows,
    closeAccountingPeriod,
    declarationPreparationRows,
    financeRows,
    invoiceBusinessAllocationRows,
    invoiceRows,
    ledgerOpeningAdjustmentRows,
    monthEndMatterRows,
    receivablePayableRows,
    reopenAccountingPeriod,
    taxMatterRows
  } = useFinanceManagement();
  const [messageApi, contextHolder] = message.useMessage();
  const [filters, setFilters] = useState<FinancePeriodCloseFilters>(defaultFinancePeriodCloseFilters);
  const [activePeriod, setActivePeriod] = useState<string>();
  const [confirmPeriod, setConfirmPeriod] = useState<string>();
  const [closeReason, setCloseReason] = useState('');
  const [reopenPeriod, setReopenPeriod] = useState<string>();
  const [reopenReason, setReopenReason] = useState('');
  const [laterAdjustmentPeriod, setLaterAdjustmentPeriod] = useState<string>();
  const [laterAdjustmentVoucherId, setLaterAdjustmentVoucherId] = useState<string>();
  const [laterAdjustmentForm, setLaterAdjustmentForm] = useState<AccountingVoucherLaterPeriodAdjustmentInput>({
    accountingPeriod: '',
    adjustedAt: '',
    reason: ''
  });

  const voucherRows = useMemo(
    () =>
      applyAccountingVoucherLifecycle(
        buildAccountingVouchers(
          receivablePayableRows,
          financeRows,
          invoiceRows,
          taxMatterRows,
          bankReconciliationRows,
          ledgerOpeningAdjustmentRows,
          accountingVoucherLaterPeriodAdjustmentRows,
          {
            accountingPeriodStart: accountingSubjectProfile.effectivePeriod,
            declarationPreparationRows,
            invoiceBusinessAllocationRows,
            monthEndMatterRows
          }
        ),
        accountingVoucherLifecycleRows
      ),
    [
      accountingVoucherLaterPeriodAdjustmentRows,
      accountingVoucherLifecycleRows,
      bankReconciliationRows,
      declarationPreparationRows,
      financeRows,
      invoiceBusinessAllocationRows,
      invoiceRows,
      ledgerOpeningAdjustmentRows,
      monthEndMatterRows,
      receivablePayableRows,
      taxMatterRows
    ]
  );
  const ledgerEntries = useMemo(() => buildAccountingLedgerEntries(voucherRows), [voucherRows]);
  const periodCloseReadModel = useMemo(
    () =>
      buildFinancePeriodCloseReadModel({
        accountingPeriodStart: accountingSubjectProfile.effectivePeriod,
        financeRows,
        filters,
        laterPeriodAdjustmentRows: accountingVoucherLaterPeriodAdjustmentRows,
        ledgerEntries,
        monthEndMatterRows,
        periodLocks: accountingPeriodLocks,
        taxMatterRows,
        voucherRows
      }),
    [
      accountingPeriodLocks,
      accountingVoucherLaterPeriodAdjustmentRows,
      financeRows,
      filters,
      ledgerEntries,
      monthEndMatterRows,
      taxMatterRows,
      voucherRows
    ]
  );
  const rows = periodCloseReadModel.records;
  const metrics = periodCloseReadModel.metrics;
  const activeRecord = useMemo(
    () => rows.find((record) => record.accountingPeriod === activePeriod),
    [activePeriod, rows]
  );
  const confirmRecord = useMemo(
    () => rows.find((record) => record.accountingPeriod === confirmPeriod),
    [confirmPeriod, rows]
  );
  const reopenRecord = useMemo(
    () => rows.find((record) => record.accountingPeriod === reopenPeriod),
    [reopenPeriod, rows]
  );
  const activeLaterAdjustmentRows = useMemo(
    () =>
      activeRecord
        ? accountingVoucherLaterPeriodAdjustmentRows.filter(
            (record) =>
              record.originalAccountingPeriod === activeRecord.accountingPeriod ||
              record.accountingPeriod === activeRecord.accountingPeriod
          )
        : [],
    [accountingVoucherLaterPeriodAdjustmentRows, activeRecord]
  );
  const activeLaterAdjustmentSourceVouchers = useMemo(
    () =>
      activeRecord
        ? getLaterAdjustmentSourceVouchers({
            accountingPeriod: activeRecord.accountingPeriod,
            existingRows: accountingVoucherLaterPeriodAdjustmentRows,
            periodLocks: accountingPeriodLocks,
            voucherRows
          })
        : [],
    [accountingPeriodLocks, accountingVoucherLaterPeriodAdjustmentRows, activeRecord, voucherRows]
  );
  const laterAdjustmentSourceVouchers = useMemo(
    () =>
      laterAdjustmentPeriod
        ? getLaterAdjustmentSourceVouchers({
            accountingPeriod: laterAdjustmentPeriod,
            existingRows: accountingVoucherLaterPeriodAdjustmentRows,
            periodLocks: accountingPeriodLocks,
            voucherRows
          })
        : [],
    [accountingPeriodLocks, accountingVoucherLaterPeriodAdjustmentRows, laterAdjustmentPeriod, voucherRows]
  );
  const laterAdjustmentSourceRecord = useMemo(
    () => laterAdjustmentSourceVouchers.find((record) => record.id === laterAdjustmentVoucherId),
    [laterAdjustmentSourceVouchers, laterAdjustmentVoucherId]
  );

  function openConfirmClose(record: FinancePeriodCloseRecord) {
    if (!record.canClose) {
      void messageApi.warning(record.continuityDetail || '本期结账前置检查尚未完成');
      return;
    }

    setCloseReason('');
    setConfirmPeriod(record.accountingPeriod);
  }

  function openReopen(record: FinancePeriodCloseRecord) {
    if (record.status !== '已结账' || record.continuityStatus !== '锁定顺序异常') {
      void messageApi.warning('当前期间不需要修复结账顺序');
      return;
    }

    setReopenReason('');
    setReopenPeriod(record.accountingPeriod);
  }

  function closeReopenDrawer() {
    setReopenPeriod(undefined);
    setReopenReason('');
  }

  function submitReopen() {
    if (!reopenRecord || !reopenReason.trim()) {
      return;
    }

    if (reopenRecord.status !== '已结账' || reopenRecord.continuityStatus !== '锁定顺序异常') {
      void messageApi.warning('当前期间不再需要修复结账顺序');
      closeReopenDrawer();
      return;
    }

    if (!reopenAccountingPeriod(reopenRecord.accountingPeriod, reopenReason)) {
      void messageApi.warning('反结账未完成，请刷新后重试');
      return;
    }

    setActivePeriod(reopenRecord.accountingPeriod);
    closeReopenDrawer();
    void messageApi.success(`已反结账 ${reopenRecord.accountingPeriod}，请先完成 ${reopenRecord.continuityBlockerPeriod} 结账`);
  }

  function submitConfirmClose() {
    if (!confirmRecord || !closeReason.trim()) {
      return;
    }

    if (!confirmRecord.canClose) {
      void messageApi.warning(confirmRecord.continuityDetail || '本期结账前置检查尚未完成');
      return;
    }

    closeAccountingPeriod(
      confirmRecord.accountingPeriod,
      closeReason.trim(),
      confirmRecord.checkItems,
      createFinancePeriodCloseSummarySnapshot(confirmRecord)
    );
    setActivePeriod(confirmRecord.accountingPeriod);
    setConfirmPeriod(undefined);
  }

  function openLaterAdjustment(record: FinancePeriodCloseRecord) {
    const [firstVoucher] = getLaterAdjustmentSourceVouchers({
      accountingPeriod: record.accountingPeriod,
      existingRows: accountingVoucherLaterPeriodAdjustmentRows,
      periodLocks: accountingPeriodLocks,
      voucherRows
    });
    const defaultAccountingPeriod = firstVoucher
      ? getAvailableLaterPeriodAdjustmentAccountingPeriod(
          firstVoucher,
          accountingPeriodLocks,
          accountingVoucherLaterPeriodAdjustmentRows
        )
      : undefined;

    if (!firstVoucher || !defaultAccountingPeriod) {
      void messageApi.warning('当前期间暂无可发起后续调整的已记账凭证');
      return;
    }

    setLaterAdjustmentPeriod(record.accountingPeriod);
    setLaterAdjustmentVoucherId(firstVoucher.id);
    setLaterAdjustmentForm({
      accountingPeriod: defaultAccountingPeriod,
      adjustedAt: `${defaultAccountingPeriod}-01`,
      reason: ''
    });
  }

  function selectLaterAdjustmentVoucher(voucherId: string) {
    const sourceRecord = laterAdjustmentSourceVouchers.find((record) => record.id === voucherId);
    const defaultAccountingPeriod = sourceRecord
      ? getAvailableLaterPeriodAdjustmentAccountingPeriod(
          sourceRecord,
          accountingPeriodLocks,
          accountingVoucherLaterPeriodAdjustmentRows
        )
      : undefined;

    setLaterAdjustmentVoucherId(voucherId);
    setLaterAdjustmentForm((currentForm) => ({
      accountingPeriod: defaultAccountingPeriod ?? '',
      adjustedAt: defaultAccountingPeriod ? `${defaultAccountingPeriod}-01` : '',
      reason: currentForm.reason
    }));
  }

  function updateLaterAdjustmentForm<K extends keyof AccountingVoucherLaterPeriodAdjustmentInput>(
    field: K,
    value: AccountingVoucherLaterPeriodAdjustmentInput[K]
  ) {
    setLaterAdjustmentForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function closeLaterAdjustmentDrawer() {
    setLaterAdjustmentPeriod(undefined);
    setLaterAdjustmentVoucherId(undefined);
    setLaterAdjustmentForm({
      accountingPeriod: '',
      adjustedAt: '',
      reason: ''
    });
  }

  function submitLaterAdjustment() {
    if (
      !laterAdjustmentPeriod ||
      !laterAdjustmentSourceRecord ||
      !canSubmitLaterPeriodAccountingVoucherAdjustment(
        laterAdjustmentSourceRecord,
        laterAdjustmentForm,
        accountingPeriodLocks,
        accountingVoucherLaterPeriodAdjustmentRows
      )
    ) {
      return;
    }

    const adjustmentRecord = createLaterPeriodAccountingVoucherAdjustmentRecord({
      actor: '李明',
      existingRows: accountingVoucherLaterPeriodAdjustmentRows,
      input: laterAdjustmentForm,
      originalRecord: laterAdjustmentSourceRecord
    });

    if (!addAccountingVoucherLaterPeriodAdjustment(adjustmentRecord)) {
      void messageApi.warning('后续调整事项未创建，请检查调整期间或是否已存在');
      return;
    }

    setActivePeriod(laterAdjustmentPeriod);
    closeLaterAdjustmentDrawer();
    void messageApi.success('后续调整事项已创建，可在会计凭证记账');
  }

  const columns: TableColumnsType<FinancePeriodCloseRecord> = [
    {
      title: '会计期间',
      key: 'period',
      width: 170,
      render: (_, record) => <CompactCell primary={record.accountingPeriod} secondary={record.periodLabel} />
    },
    {
      title: '结账状态',
      dataIndex: 'status',
      width: 120,
      render: (status: FinancePeriodCloseStatus) => <StatusTag toneMap={periodCloseStatusTone} value={status} />
    },
    {
      title: '凭证处理',
      key: 'voucher',
      width: 190,
      render: (_, record) => (
        <CompactCell
          primary={`${record.bookedVoucherCount} 张已记账`}
          secondary={`${record.pendingVoucherCount + record.issueVoucherCount + record.readyToBookVoucherCount} 项待处理`}
        />
      )
    },
    {
      title: '总账试算',
      key: 'trialBalance',
      width: 160,
      render: (_, record) => (
        <CompactCell
          primarySlot={<StatusTag toneMap={trialBalanceTone} value={record.trialBalanceStatus} />}
          secondary={`差额 ${formatMoney(record.trialBalanceDifference)}`}
        />
      )
    },
    {
      title: '资金核对',
      key: 'cashReconciliation',
      width: 170,
      render: (_, record) => (
        <CompactCell
          primary={`${record.pendingReviewCashFlowCount} 条待复核`}
          secondary={`${record.unreconciledCashFlowCount} 条未对账`}
        />
      )
    },
    {
      title: '社保公积金',
      key: 'socialInsurance',
      width: 150,
      render: (_, record) => (
        <CompactCell
          primary={`${record.socialInsurancePendingCount} 项待处理`}
          secondary={record.socialInsurancePendingCount > 0 ? '需完成缴费确认' : '本期已完成'}
        />
      )
    },
    {
      title: '本期借贷',
      key: 'movement',
      width: 180,
      render: (_, record) => (
        <CompactCell
          primary={`借 ${formatMoney(record.debitTotal)}`}
          secondary={`贷 ${formatMoney(record.creditTotal)}`}
        />
      )
    },
    {
      title: '结账信息',
      key: 'closed',
      width: 180,
      render: (_, record) => {
        if (record.continuityBlockerPeriod) {
          return (
            <CompactCell
              primary={record.status === '已结账' ? '结账顺序异常' : `需先结 ${record.continuityBlockerPeriod}`}
              secondary={record.status === '已结账' ? '前期未结账' : '本期暂不可结账'}
            />
          );
        }

        if (record.closedAt) {
          return <CompactCell primary={record.closedAt} secondary={record.closedBy} />;
        }

        if (record.canClose) {
          return <CompactCell primary="待确认结账" secondary="检查已通过" />;
        }

        return <CompactCell primary="待完成检查" secondary={`${record.blockedCheckCount} 项待处理`} />;
      }
    }
  ];

  return (
    <>
      {contextHolder}
      <ManagementPageScaffold
        filters={
          <FilterPanel>
            <FilterBar>
              <DateScopeFilter
                defaultMonth={financePeriodCloseDefaultMonth}
                label="会计期间"
                modeOptions={periodCloseModeOptions}
                testIdPrefix="finance-period-close-period"
                value={filters.accountingPeriodTime}
                onChange={(accountingPeriodTime) => setFilters((current) => ({ ...current, accountingPeriodTime }))}
              />
              <FilterField label="结账状态" controlWidth="status-select">
                <Select
                  data-testid="finance-period-close-status-select"
                  options={financePeriodCloseStatusOptions.map((status) => ({ label: status, value: status }))}
                  value={filters.closeStatus}
                  onChange={(closeStatus) => setFilters((current) => ({ ...current, closeStatus }))}
                />
              </FilterField>
              <KeywordFilter
                data-testid="finance-period-close-keyword-input"
                placeholder="期间 / 检查项"
                value={filters.keyword}
                width="wide"
                onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
              />
            </FilterBar>
          </FilterPanel>
        }
        layout="table-workbench"
        metrics={
          <MetricGrid columns={4}>
            <MetricCard icon={<BookOutlined />} label="期间数" value={metrics.periodCount} />
            <MetricCard icon={<CheckCircleOutlined />} label="可结账" value={metrics.closeableCount} />
            <MetricCard icon={<WarningOutlined />} label="需处理" value={metrics.pendingCount} />
            <MetricCard icon={<LockOutlined />} label="已结账" value={metrics.closedCount} />
          </MetricGrid>
        }
        pageId="finance-period-close"
      >
        <ManagementTable<FinancePeriodCloseRecord>
          columns={columns}
          count={{ value: rows.length, unit: '个期间' }}
          dataSource={rows}
          rowKey="accountingPeriod"
          rowTestIdPrefix="finance-period-close-table-row"
          tableTestId="finance-period-close-table"
          onRowClick={(record) => setActivePeriod(record.accountingPeriod)}
        />

        <PeriodCloseDrawer
          canStartLaterAdjustment={activeLaterAdjustmentSourceVouchers.length > 0}
          laterAdjustmentRows={activeLaterAdjustmentRows}
          record={activeRecord}
          onClose={() => setActivePeriod(undefined)}
          onConfirmClose={openConfirmClose}
          onReopen={openReopen}
          onStartLaterAdjustment={openLaterAdjustment}
        />

        <PeriodCloseConfirmDrawer
          reason={closeReason}
          record={confirmRecord}
          onCancel={() => setConfirmPeriod(undefined)}
          onChangeReason={setCloseReason}
          onSubmit={submitConfirmClose}
        />

        <PeriodCloseReopenDrawer
          record={reopenRecord}
          reason={reopenReason}
          onCancel={closeReopenDrawer}
          onChangeReason={setReopenReason}
          onSubmit={submitReopen}
        />

        <PeriodCloseLaterAdjustmentDrawer
          accountingPeriodLocks={accountingPeriodLocks}
          existingRows={accountingVoucherLaterPeriodAdjustmentRows}
          form={laterAdjustmentForm}
          originalPeriod={laterAdjustmentPeriod}
          selectedVoucherId={laterAdjustmentVoucherId}
          sourceVouchers={laterAdjustmentSourceVouchers}
          onClose={closeLaterAdjustmentDrawer}
          onSelectVoucher={selectLaterAdjustmentVoucher}
          onSubmit={submitLaterAdjustment}
          onUpdate={updateLaterAdjustmentForm}
        />
      </ManagementPageScaffold>
    </>
  );
}
