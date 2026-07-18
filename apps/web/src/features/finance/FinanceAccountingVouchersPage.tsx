import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ProfileOutlined,
  RollbackOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Alert, DatePicker, Input, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DateScopeFilter } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import {
  accountingVoucherDefaultMonth,
  accountingVoucherIssueLabels,
  accountingVoucherStatusOptions,
  buildAccountingLedgerEntries,
  buildAccountingVoucherFromLaterPeriodAdjustment,
  buildAccountingVoucherMetrics,
  canBookAccountingVoucher,
  canCreateLaterPeriodAccountingVoucherAdjustment,
  canReverseAccountingVoucher,
  canSubmitLaterPeriodAccountingVoucherAdjustment,
  createLaterPeriodAccountingVoucherAdjustmentRecord,
  canSubmitAccountingVoucherReversal,
  createReversalAccountingVoucherSnapshot,
  defaultAccountingVoucherFilters,
  getAccountingVoucherDeepLinkTargetId,
  getAccountingVoucherDefaultReversalDate,
  getAccountingVoucherFiltersFromQueryString,
  getAccountingVoucherIssueSummary,
  getAccountingVoucherPeriodLockNotice,
  getAccountingVoucherReversalAccountingPeriod,
  getAvailableLaterPeriodAdjustmentAccountingPeriod,
  getDefaultLaterPeriodAdjustmentAccountingPeriod,
  getExistingLaterPeriodAccountingVoucherAdjustment,
  getNextAccountingVoucherNo,
  isAccountingPeriodLocked,
  matchesAccountingVoucherFilters,
  validateLaterPeriodAccountingVoucherAdjustment,
  validateAccountingVoucherReversal,
  type AccountingLedgerEntry,
  type AccountingVoucherBusinessType,
  type AccountingVoucherFilters,
  type AccountingVoucherInvoiceRef,
  type AccountingVoucherIssueCode,
  type AccountingVoucherLaterPeriodAdjustmentInput,
  type AccountingVoucherLaterPeriodAdjustmentRecord,
  type AccountingVoucherLine,
  type AccountingVoucherRecord,
  type AccountingVoucherReversalInput,
  type AccountingVoucherSourceRef,
  type AccountingVoucherStatus,
  type AccountingVoucherTaxBasisSource,
  type AccountingVoucherTaxEvidenceStatus
} from './financeAccountingVoucherModel';
import { formatMoney } from './financeUtils';

const voucherBusinessTone = {
  权责凭证: 'blue',
  资金凭证: 'green',
  税费凭证: 'purple',
  调整凭证: 'amber',
  冲销凭证: 'red'
} as const;

const voucherKindTone = {
  转账凭证: 'blue',
  收款凭证: 'green',
  付款凭证: 'red'
} as const;

const voucherLineSideTone = {
  借方: 'green',
  贷方: 'red'
} as const;

const voucherStatusTone = {
  待生成: 'gray',
  需处理: 'amber',
  待记账: 'green',
  已记账: 'blue',
  已冲销: 'red'
} as const;

const invoiceDirectionTone = {
  销项: 'blue',
  进项: 'green'
} as const;

const invoiceStatusTone = {
  作废: 'gray',
  正常: 'green',
  红冲: 'red'
} as const;

const taxBasisSourceTone = {
  来源单据: 'blue',
  发票台账: 'green',
  不涉及发票: 'gray',
  待确认: 'amber'
} as const;

const taxEvidenceStatusTone = {
  发票已匹配: 'green',
  发票部分匹配: 'blue',
  发票待补: 'amber',
  不涉及发票: 'gray',
  待确认: 'amber'
} as const;

const sessionVoucherStatuses = new Set<AccountingVoucherStatus>(['已记账', '已冲销']);
const accountingVoucherWorkbenchStatusRank: Record<AccountingVoucherStatus, number> = {
  待记账: 0,
  需处理: 1,
  待生成: 2,
  已记账: 3,
  已冲销: 4
};

type AccountingVoucherOperationRecord = {
  action: string;
  actor: string;
  id: string;
  summary: string;
  time: string;
};

function normalizeDatePickerValue(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

function hasSessionVoucherSnapshot(record: AccountingVoucherRecord) {
  return sessionVoucherStatuses.has(record.status);
}

function getAccountingVoucherListIdentity(record: AccountingVoucherRecord) {
  if (hasSessionVoucherSnapshot(record)) {
    return {
      primary: record.voucherNo,
      secondary: `${record.sourceNo} / ${record.summary}`
    };
  }

  return {
    primary: record.sourceNo,
    secondary: record.summary
  };
}

function getAccountingVoucherDrawerTitle(record: AccountingVoucherRecord) {
  if (hasSessionVoucherSnapshot(record)) {
    return {
      subtitle: `${record.voucherNo} / ${record.businessType}`,
      title: '会计凭证详情'
    };
  }

  return {
    subtitle: `${record.sourceNo} / ${record.businessType}`,
    title: '记账事项详情'
  };
}

function getIssueAction(issue: AccountingVoucherIssueCode) {
  if (issue === 'missing_original_evidence') {
    return '需补齐来源凭证';
  }

  if (issue === 'missing_accounting_subject') {
    return '维护科目映射';
  }

  if (issue === 'unbalanced_entries') {
    return '检查分录规则';
  }

  if (issue === 'bank_reconciliation_source_missing') {
    return '需补齐银行对账依据';
  }

  if (issue === 'bank_amount_mismatch') {
    return '需处理银行对账差异';
  }

  if (issue === 'tax_declaration_evidence_pending') {
    return '需核对申报材料';
  }

  if (issue === 'tax_basis_pending' || issue === 'tax_amount_missing') {
    return '需确认发票或来源税额';
  }

  if (issue === 'amount_invalid') {
    return '需修正来源金额';
  }

  return '需完成前置来源事项';
}

function getAccountingVoucherNextStep(
  record: AccountingVoucherRecord,
  canBook: boolean,
  canReverse: boolean,
  canCreateLaterAdjustment: boolean,
  existingLaterAdjustment?: AccountingVoucherLaterPeriodAdjustmentRecord,
  laterAdjustmentTargetPeriod?: string,
  isClosedPeriod = false
) {
  if (isClosedPeriod && !['已记账', '已冲销'].includes(record.status)) {
    return { primary: '只读回看', secondary: '期间已结账' };
  }

  if (record.status === '待记账') {
    return canBook ? { primary: '记账', secondary: '确认分录入总账' } : { primary: '暂不可记账', secondary: '会计期间已结账' };
  }

  if (record.status === '已记账') {
    if (record.reversalOfVoucherId) {
      return { primary: '冲销凭证', secondary: '反向分录已记账' };
    }

    if (canReverse) {
      return { primary: '已记账', secondary: '必要时可冲销' };
    }

    if (canCreateLaterAdjustment) {
      return {
        primary: '后续调整',
        secondary: existingLaterAdjustment
          ? `下个期间 ${laterAdjustmentTargetPeriod} / 已有 ${existingLaterAdjustment.adjustmentNo}`
          : '原期间已结账，不改历史凭证'
      };
    }

    if (existingLaterAdjustment) {
      return {
        primary: '已有后续调整',
        secondary: `${existingLaterAdjustment.accountingPeriod} ${existingLaterAdjustment.adjustmentNo}`
      };
    }

    return { primary: '已记账', secondary: '期间已结账' };
  }

  if (record.status === '已冲销') {
    return { primary: '已冲销', secondary: record.reversedByVoucherId ? '已生成反向凭证' : record.reversalReason ?? '已保留原始凭证影响' };
  }

  if (record.status === '需处理') {
    const firstIssue = record.issueReasons[0];

    return {
      primary: firstIssue ? getIssueAction(firstIssue) : '需完成前置处理',
      secondary: getAccountingVoucherIssueSummary(record)
    };
  }

  return {
    primary: '等待前置完成',
    secondary: getAccountingVoucherIssueSummary(record)
  };
}

function getAccountingVoucherOperationRecords(record: AccountingVoucherRecord): AccountingVoucherOperationRecord[] {
  const rows: AccountingVoucherOperationRecord[] = [];

  if (record.bookedAt || record.bookedBy) {
    rows.push({
      action: '记账',
      actor: record.bookedBy ?? '-',
      id: `${record.id}-booked`,
      summary: '确认分录入总账',
      time: record.bookedAt ?? '-'
    });
  }

  if (record.reversedAt || record.reversedBy) {
    rows.push({
      action: '冲销',
      actor: record.reversedBy ?? '-',
      id: `${record.id}-reversed`,
      summary: record.reversedByVoucherId
        ? `${record.reversalReason ?? '冲销已记账凭证'} / 反向凭证 ${record.reversedByVoucherId}`
        : record.reversalReason ?? '冲销已记账凭证',
      time: record.reversedAt ?? '-'
    });
  }

  return rows;
}

function sortAccountingVoucherWorkbenchRows(rows: AccountingVoucherRecord[]) {
  return [...rows].sort((left, right) => {
    const statusDiff = accountingVoucherWorkbenchStatusRank[left.status] - accountingVoucherWorkbenchStatusRank[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return right.voucherDate.localeCompare(left.voucherDate);
  });
}

function getAccountingVoucherLineColumns(): TableColumnsType<AccountingVoucherLine> {
  return [
    {
      title: '借贷',
      dataIndex: 'side',
      width: 82,
      render: (side: AccountingVoucherLine['side']) => <StatusTag toneMap={voucherLineSideTone} value={side} />
    },
    {
      title: '会计科目',
      key: 'subject',
      width: 210,
      render: (_, line) => (
        <CompactCell
          primary={line.subject ? `${line.subject.code} ${line.subject.name}` : `未配置 ${line.subjectCode}`}
          primaryTone={line.subject ? 'strong' : 'risk'}
          secondary={line.subject ? undefined : '需处理'}
        />
      )
    },
    {
      title: '辅助核算',
      dataIndex: 'auxiliary',
      width: 180
    },
    {
      title: '借方金额',
      key: 'debit',
      width: 130,
      render: (_, line) => (line.side === '借方' ? <CellText tone="income">{formatMoney(line.amount)}</CellText> : '-')
    },
    {
      title: '贷方金额',
      key: 'credit',
      width: 130,
      render: (_, line) => (line.side === '贷方' ? <CellText tone="expense">{formatMoney(line.amount)}</CellText> : '-')
    }
  ];
}

function AccountingVoucherDetailDrawer({
  canBook,
  canReverse,
  canCreateLaterAdjustment,
  existingLaterAdjustment,
  periodLockNotice,
  record,
  onBook,
  onReverse,
  onCreateLaterAdjustment,
  onClose
}: {
  canBook: boolean;
  canReverse: boolean;
  canCreateLaterAdjustment: boolean;
  existingLaterAdjustment?: AccountingVoucherLaterPeriodAdjustmentRecord;
  periodLockNotice?: string;
  record?: AccountingVoucherRecord;
  onBook: (record: AccountingVoucherRecord) => void;
  onReverse: (record: AccountingVoucherRecord) => void;
  onCreateLaterAdjustment: (record: AccountingVoucherRecord) => void;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }

  const hasVoucherSnapshot = hasSessionVoucherSnapshot(record);
  const drawerTitle = getAccountingVoucherDrawerTitle(record);
  const lineColumns = getAccountingVoucherLineColumns();
  const sourceColumns: TableColumnsType<AccountingVoucherSourceRef> = [
    {
      title: '来源模块',
      dataIndex: 'module',
      width: 120
    },
    {
      title: '来源单号',
      key: 'recordNo',
      render: (_, sourceRef) => <CompactCell primary={sourceRef.recordNo} secondary={sourceRef.role} />
    }
  ];
  const invoiceColumns: TableColumnsType<AccountingVoucherInvoiceRef> = [
    {
      title: '发票号',
      key: 'invoiceNo',
      width: 210,
      render: (_, invoice) => <CompactCell primary={invoice.invoiceNo} secondary={invoice.declarationTreatment} />
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 82,
      render: (direction: AccountingVoucherInvoiceRef['direction']) => <StatusTag toneMap={invoiceDirectionTone} value={direction} />
    },
    {
      title: '状态',
      dataIndex: 'invoiceStatus',
      width: 82,
      render: (status: AccountingVoucherInvoiceRef['invoiceStatus']) => <StatusTag toneMap={invoiceStatusTone} value={status} />
    },
    {
      title: '不含税',
      dataIndex: 'taxExcludedAmount',
      width: 120,
      render: (amount: number) => <CellText tone="strong">{formatMoney(amount)}</CellText>
    },
    {
      title: '税额',
      dataIndex: 'taxAmount',
      width: 110,
      render: (amount: number) => <CellText tone="expense">{formatMoney(amount)}</CellText>
    },
    {
      title: '价税合计',
      dataIndex: 'taxIncludedAmount',
      width: 120,
      render: (amount: number) => <CellText tone="strong">{formatMoney(amount)}</CellText>
    }
  ];
  const taxBasisItems = record.taxBasis
    ? [
        {
          label: '依据来源',
          value: <StatusTag toneMap={taxBasisSourceTone} value={record.taxBasis.basisSource as AccountingVoucherTaxBasisSource} />
        },
        {
          label: '票据状态',
          value: <StatusTag toneMap={taxEvidenceStatusTone} value={record.taxBasis.evidenceStatus as AccountingVoucherTaxEvidenceStatus} />
        },
        { label: '业务税务分类', value: record.taxBasis.taxableClassification ?? '-' },
        { label: '本期税额口径', value: record.taxBasis.taxOutcome ?? '以票面或申报结果为准' },
        { label: '税率', value: record.taxBasis.taxRate },
        { label: '价税合计', value: formatMoney(record.taxBasis.taxIncludedAmount) },
        { label: '不含税金额', value: formatMoney(record.taxBasis.taxExcludedAmount) },
        { label: '税额', value: formatMoney(record.taxBasis.taxAmount) },
        { label: '已匹配发票', value: formatMoney(record.taxBasis.matchedInvoiceAmount) }
      ]
    : [];
  const ledgerEntries = buildAccountingLedgerEntries([record]);
  const ledgerColumns: TableColumnsType<AccountingLedgerEntry> = [
    {
      title: '科目',
      key: 'subject',
      width: 210,
      render: (_, entry) => <CompactCell primary={`${entry.subjectCode} ${entry.subjectName}`} secondary={entry.auxiliary} />
    },
    {
      title: '借方',
      dataIndex: 'debitAmount',
      width: 130,
      render: (amount: number) => (amount > 0 ? <CellText tone="income">{formatMoney(amount)}</CellText> : '-')
    },
    {
      title: '贷方',
      dataIndex: 'creditAmount',
      width: 130,
      render: (amount: number) => (amount > 0 ? <CellText tone="expense">{formatMoney(amount)}</CellText> : '-')
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      width: 220
    }
  ];
  const operationRecords = getAccountingVoucherOperationRecords(record);
  const operationColumns: TableColumnsType<AccountingVoucherOperationRecord> = [
    {
      title: '操作',
      dataIndex: 'action',
      width: 96,
      render: (action: string) => <CellText tone="strong">{action}</CellText>
    },
    {
      title: '操作人',
      dataIndex: 'actor',
      width: 120
    },
    {
      title: '时间',
      dataIndex: 'time',
      width: 150
    },
    {
      title: '说明',
      dataIndex: 'summary',
      width: 260
    }
  ];

  return (
    <DetailDrawerShell
      bodyTestId="finance-accounting-voucher-detail-drawer"
      className="finance-transaction-drawer"
      open={Boolean(record)}
      primaryAction={
        record.status === '待记账'
          ? {
              disabled: !canBook,
              icon: <CheckCircleOutlined />,
              label: '记账',
              testId: 'finance-accounting-voucher-book',
              onClick: () => onBook(record)
            }
          : undefined
      }
      secondaryAction={
        record.status === '已记账'
          ? canReverse
            ? {
                danger: true,
                icon: <RollbackOutlined />,
                label: '冲销',
                testId: 'finance-accounting-voucher-reverse',
                onClick: () => onReverse(record)
              }
            : canCreateLaterAdjustment
            ? {
                icon: <FileTextOutlined />,
                label: '后续调整',
                testId: 'finance-accounting-voucher-later-adjustment',
                onClick: () => onCreateLaterAdjustment(record)
              }
            : undefined
          : undefined
      }
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={voucherStatusTone}
          subtitle={drawerTitle.subtitle}
          title={drawerTitle.title}
        />
      }
      width={960}
      onClose={onClose}
    >
      {periodLockNotice ? (
        <Alert
          className="drawer-inline-alert"
          message={periodLockNotice}
          showIcon
          type="warning"
        />
      ) : null}

      <DetailTabs
        defaultActiveKey="basis"
        items={[
          {
            key: 'basis',
            label: '依据',
            children: (
              <>
                <DetailSection icon={<ProfileOutlined />} title={hasVoucherSnapshot ? '凭证信息' : '记账事项'}>
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '当前状态', value: <StatusTag toneMap={voucherStatusTone} value={record.status} /> },
                      hasVoucherSnapshot
                        ? { label: '凭证号', value: record.voucherNo }
                        : { label: '来源单号', value: record.sourceNo },
                      { label: hasVoucherSnapshot ? '凭证日期' : '拟记账日期', value: record.voucherDate },
                      { label: '入账期间', value: record.accountingPeriod },
                      { label: '凭证字别', value: <StatusTag toneMap={voucherKindTone} value={record.kind} /> },
                      { label: '业务环节', value: <StatusTag toneMap={voucherBusinessTone} value={record.businessType} /> },
                      ...(hasVoucherSnapshot ? [{ label: '来源单号', value: record.sourceNo }] : []),
                      { label: '业务对象', value: record.counterparty },
                      { label: '金额', value: formatMoney(record.amount) },
                      ...(record.taxFilingContext
                        ? [
                            { label: '所属税期', value: record.taxFilingContext.taxPeriod },
                            { label: '实际申报日期', value: record.taxFilingContext.declarationDate },
                            { label: '申报版本', value: `第 ${record.taxFilingContext.declarationVersion} 版` }
                          ]
                        : []),
                      ...(record.bookedAt || record.bookedBy
                        ? [
                            { label: '记账人', value: record.bookedBy },
                            { label: '记账时间', value: record.bookedAt }
                          ]
                        : []),
                      ...(existingLaterAdjustment
                        ? [
                            {
                              label: '后续调整',
                              value: `${existingLaterAdjustment.adjustmentNo} / ${existingLaterAdjustment.accountingPeriod}`
                            }
                          ]
                        : []),
                      { label: '摘要', value: record.summary, wide: true }
                    ]}
                  />
                </DetailSection>

                <DetailSection icon={<ProfileOutlined />} title="来源依据">
                  <CompactDetailTable<AccountingVoucherSourceRef>
                    columns={sourceColumns}
                    dataSource={record.sourceRefs}
                    rowKey={(sourceRef) => `${sourceRef.module}-${sourceRef.recordId}-${sourceRef.role}`}
                    scrollX={420}
                  />
                </DetailSection>

                {record.taxBasis ? (
                  <DetailSection icon={<FileTextOutlined />} title="税额依据">
                    <DetailInfoGrid columns={3} items={taxBasisItems} />
                  </DetailSection>
                ) : null}

                {record.invoiceRefs.length > 0 ? (
                  <DetailSection icon={<FileTextOutlined />} title="发票明细">
                    <CompactDetailTable<AccountingVoucherInvoiceRef>
                      columns={invoiceColumns}
                      dataSource={record.invoiceRefs}
                      rowKey="id"
                      scrollX={760}
                    />
                  </DetailSection>
                ) : null}

                {record.issueReasons.length > 0 ? (
                  <DetailSection icon={<ExclamationCircleOutlined />} title="前置条件">
                    <DetailInfoGrid
                      columns={2}
                      items={record.issueReasons.map((issue) => ({
                        label: accountingVoucherIssueLabels[issue],
                        value: getIssueAction(issue)
                      }))}
                    />
                  </DetailSection>
                ) : null}
              </>
            )
          },
          {
            key: 'entries',
            label: '分录',
            children: (
              <>
                <DetailSection icon={<FileTextOutlined />} title={hasVoucherSnapshot ? '分录明细' : '分录预览'}>
                  <CompactDetailTable<AccountingVoucherLine>
                    columns={lineColumns}
                    dataSource={record.lines}
                    rowKey="id"
                    scrollX={720}
                  />
                </DetailSection>

                {ledgerEntries.length > 0 ? (
                  <DetailSection icon={<FileTextOutlined />} title="记账影响">
                    <CompactDetailTable<AccountingLedgerEntry>
                      columns={ledgerColumns}
                      dataSource={ledgerEntries}
                      rowKey="id"
                      scrollX={720}
                    />
                  </DetailSection>
                ) : null}
              </>
            )
          },
          ...(operationRecords.length > 0
            ? [
                {
                  key: 'records',
                  label: '记录',
                  children: (
                    <DetailSection icon={<ClockCircleOutlined />} title="操作记录">
                      <CompactDetailTable<AccountingVoucherOperationRecord>
                        columns={operationColumns}
                        dataSource={operationRecords}
                        rowKey="id"
                        scrollX={640}
                      />
                    </DetailSection>
                  )
                }
              ]
            : [])
        ]}
        tabTestIdPrefix="finance-accounting-voucher-detail-tab"
        testId="finance-accounting-voucher-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

function AccountingVoucherReversalDrawer({
  canSubmit,
  form,
  voucherNo,
  record,
  validationIssues,
  onClose,
  onSubmit,
  onUpdate
}: {
  canSubmit: boolean;
  form: AccountingVoucherReversalInput;
  voucherNo: string;
  record?: AccountingVoucherRecord;
  validationIssues: string[];
  onClose: () => void;
  onSubmit: () => void;
  onUpdate: <K extends keyof AccountingVoucherReversalInput>(field: K, value: AccountingVoucherReversalInput[K]) => void;
}) {
  if (!record) {
    return null;
  }

  const reversedAt = form.reversedAt ? `${form.reversedAt} 17:20` : `${getAccountingVoucherDefaultReversalDate(record)} 17:20`;
  const reversalPeriod = form.reversedAt ? getAccountingVoucherReversalAccountingPeriod(form.reversedAt) : '-';
  const reversalPreview = canSubmit && validationIssues.length === 0
    ? createReversalAccountingVoucherSnapshot({
        actor: '当前账号',
        voucherNo,
        originalRecord: record,
        reason: form.reason.trim(),
        reversedAt
      })
    : undefined;
  const lineColumns = getAccountingVoucherLineColumns();

  return (
    <DetailDrawerShell
      bodyTestId="finance-accounting-voucher-reversal-drawer"
      className="finance-transaction-drawer"
      closeAction={{
        label: '取消',
        onClick: onClose
      }}
      open={Boolean(record)}
      primaryAction={{
        danger: true,
        disabled: !canSubmit,
        icon: <RollbackOutlined />,
        label: '确认冲销',
        testId: 'finance-accounting-voucher-reversal-submit',
        onClick: onSubmit
      }}
      title={
        <DetailDrawerTitle
          status="冲销"
          statusTone="red"
          subtitle={`${record.voucherNo} / ${record.summary}`}
          title="冲销确认"
        />
      }
      width={860}
      onClose={onClose}
    >
      <DetailSection icon={<RollbackOutlined />} title="冲销信息">
        <DrawerFormGrid>
          <DrawerFormField label="冲销日期" required>
            <DatePicker
              inputReadOnly
              value={form.reversedAt ? dayjs(form.reversedAt) : undefined}
              onChange={(_, dateString) => onUpdate('reversedAt', normalizeDatePickerValue(dateString))}
            />
          </DrawerFormField>
          <DrawerFormField label="冲销期间">
            <Input disabled value={reversalPeriod} />
          </DrawerFormField>
          <DrawerFormField label="冲销原因" required wide>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              data-testid="finance-accounting-voucher-reversal-reason"
              placeholder="填写冲销原因，作为反向凭证摘要和操作记录"
              value={form.reason}
              onChange={(event) => onUpdate('reason', event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>

        {validationIssues.length > 0 ? (
          <Alert
            className="drawer-inline-alert"
            message={validationIssues[0]}
            showIcon
            type="warning"
          />
        ) : null}
      </DetailSection>

      <DetailSection icon={<ProfileOutlined />} title="原凭证">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '凭证号', value: record.voucherNo },
            { label: '入账期间', value: record.accountingPeriod },
            { label: '金额', value: formatMoney(record.amount) },
            { label: '业务环节', value: <StatusTag toneMap={voucherBusinessTone} value={record.businessType} /> },
            { label: '业务对象', value: record.counterparty },
            { label: '记账时间', value: record.bookedAt },
            { label: '摘要', value: record.summary, wide: true }
          ]}
        />
      </DetailSection>

      {reversalPreview ? (
        <DetailSection icon={<FileTextOutlined />} title="反向凭证预览">
          <DetailInfoGrid
            columns={3}
            items={[
              { label: '凭证号', value: voucherNo },
              { label: '凭证日期', value: reversalPreview.voucherDate },
              { label: '入账期间', value: reversalPreview.accountingPeriod },
              { label: '业务环节', value: <StatusTag toneMap={voucherBusinessTone} value={reversalPreview.businessType} /> },
              { label: '凭证字别', value: <StatusTag toneMap={voucherKindTone} value={reversalPreview.kind} /> },
              { label: '金额', value: formatMoney(reversalPreview.amount) }
            ]}
          />
          <CompactDetailTable<AccountingVoucherLine>
            columns={lineColumns}
            dataSource={reversalPreview.lines}
            rowKey="id"
            scrollX={720}
          />
        </DetailSection>
      ) : null}
    </DetailDrawerShell>
  );
}

function AccountingVoucherLaterAdjustmentDrawer({
  canSubmit,
  existingRows,
  form,
  record,
  validationIssues,
  onClose,
  onSubmit,
  onUpdate
}: {
  canSubmit: boolean;
  existingRows: AccountingVoucherLaterPeriodAdjustmentRecord[];
  form: AccountingVoucherLaterPeriodAdjustmentInput;
  record?: AccountingVoucherRecord;
  validationIssues: string[];
  onClose: () => void;
  onSubmit: () => void;
  onUpdate: <K extends keyof AccountingVoucherLaterPeriodAdjustmentInput>(
    field: K,
    value: AccountingVoucherLaterPeriodAdjustmentInput[K]
  ) => void;
}) {
  if (!record) {
    return null;
  }

  const previewAccountingPeriod = form.accountingPeriod || getDefaultLaterPeriodAdjustmentAccountingPeriod(record);
  const previewAdjustedAt = form.adjustedAt || `${previewAccountingPeriod}-01`;
  const previewSource = canSubmit && validationIssues.length === 0
    ? createLaterPeriodAccountingVoucherAdjustmentRecord({
        actor: '当前账号',
        existingRows,
        input: {
          accountingPeriod: previewAccountingPeriod,
          adjustedAt: previewAdjustedAt,
          reason: form.reason.trim()
        },
        originalRecord: record
      })
    : undefined;
  const adjustmentPreview = previewSource ? buildAccountingVoucherFromLaterPeriodAdjustment(previewSource, 0) : undefined;
  const lineColumns = getAccountingVoucherLineColumns();

  return (
    <DetailDrawerShell
      bodyTestId="finance-accounting-voucher-later-adjustment-drawer"
      className="finance-transaction-drawer"
      closeAction={{
        label: '取消',
        onClick: onClose
      }}
      open={Boolean(record)}
      primaryAction={{
        disabled: !canSubmit,
        icon: <FileTextOutlined />,
        label: '创建调整事项',
        testId: 'finance-accounting-voucher-later-adjustment-submit',
        onClick: onSubmit
      }}
      title={
        <DetailDrawerTitle
          status="后续调整"
          statusTone="amber"
          subtitle={`${record.voucherNo} / ${record.accountingPeriod}`}
          title="后续期间调整"
        />
      }
      width={860}
      onClose={onClose}
    >
      <DetailSection icon={<FileTextOutlined />} title="调整内容">
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
              data-testid="finance-accounting-voucher-later-adjustment-reason"
              placeholder="填写历史期间错误原因和本期调整依据"
              value={form.reason}
              onChange={(event) => onUpdate('reason', event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>

        {validationIssues.length > 0 ? (
          <Alert
            className="drawer-inline-alert"
            message={validationIssues[0]}
            showIcon
            type="warning"
          />
        ) : null}
      </DetailSection>

      <DetailSection icon={<ProfileOutlined />} title="原凭证">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '凭证号', value: record.voucherNo },
            { label: '原入账期间', value: record.accountingPeriod },
            { label: '金额', value: formatMoney(record.amount) },
            { label: '业务环节', value: <StatusTag toneMap={voucherBusinessTone} value={record.businessType} /> },
            { label: '业务对象', value: record.counterparty },
            { label: '记账时间', value: record.bookedAt },
            { label: '摘要', value: record.summary, wide: true }
          ]}
        />
      </DetailSection>

      {adjustmentPreview && previewSource ? (
        <DetailSection icon={<FileTextOutlined />} title="调整凭证预览">
          <DetailInfoGrid
            columns={3}
            items={[
              { label: '调整事项号', value: previewSource.adjustmentNo },
              { label: '凭证日期', value: adjustmentPreview.voucherDate },
              { label: '入账期间', value: adjustmentPreview.accountingPeriod },
              { label: '业务环节', value: <StatusTag toneMap={voucherBusinessTone} value={adjustmentPreview.businessType} /> },
              { label: '凭证字别', value: <StatusTag toneMap={voucherKindTone} value={adjustmentPreview.kind} /> },
              { label: '金额', value: formatMoney(adjustmentPreview.amount) }
            ]}
          />
          <CompactDetailTable<AccountingVoucherLine>
            columns={lineColumns}
            dataSource={adjustmentPreview.lines}
            rowKey="id"
            scrollX={720}
          />
        </DetailSection>
      ) : null}
    </DetailDrawerShell>
  );
}

export function FinanceAccountingVouchersPage() {
  const {
    addAccountingVoucherLaterPeriodAdjustment,
    accountingPeriodLocks,
    accountingVoucherLaterPeriodAdjustmentRows,
    accountingVoucherLifecycleRows,
    accountingVoucherRows: voucherRows,
    bookAccountingVoucher,
    reverseAccountingVoucher
  } = useFinanceManagement();
  const [messageApi, contextHolder] = message.useMessage();
  const [searchParams] = useSearchParams();
  const deepLinkQuery = searchParams.toString();
  const handledDeepLinkRef = useRef('');
  const [filters, setFilters] = useState<AccountingVoucherFilters>(() =>
    getAccountingVoucherFiltersFromQueryString(deepLinkQuery, defaultAccountingVoucherFilters)
  );
  const [activeVoucherId, setActiveVoucherId] = useState<string>();
  const [laterAdjustmentVoucherId, setLaterAdjustmentVoucherId] = useState<string>();
  const [laterAdjustmentForm, setLaterAdjustmentForm] = useState<AccountingVoucherLaterPeriodAdjustmentInput>({
    accountingPeriod: '',
    adjustedAt: '',
    reason: ''
  });
  const [reversalVoucherId, setReversalVoucherId] = useState<string>();
  const [reversalForm, setReversalForm] = useState<AccountingVoucherReversalInput>({
    reason: '',
    reversedAt: ''
  });

  useEffect(() => {
    setFilters((currentFilters) => getAccountingVoucherFiltersFromQueryString(deepLinkQuery, currentFilters));
  }, [deepLinkQuery]);

  useEffect(() => {
    if (!deepLinkQuery || handledDeepLinkRef.current === deepLinkQuery) {
      return;
    }

    const targetId = getAccountingVoucherDeepLinkTargetId(voucherRows, deepLinkQuery);

    if (!targetId) {
      return;
    }

    handledDeepLinkRef.current = deepLinkQuery;
    setActiveVoucherId(targetId);
  }, [deepLinkQuery, voucherRows]);

  const filteredRows = useMemo(
    () => sortAccountingVoucherWorkbenchRows(voucherRows.filter((record) => matchesAccountingVoucherFilters(record, filters))),
    [filters, voucherRows]
  );
  const metrics = useMemo(() => buildAccountingVoucherMetrics(filteredRows), [filteredRows]);
  const activeRecord = useMemo(
    () => voucherRows.find((record) => record.id === activeVoucherId),
    [activeVoucherId, voucherRows]
  );
  const reversalRecord = useMemo(
    () => voucherRows.find((record) => record.id === reversalVoucherId),
    [reversalVoucherId, voucherRows]
  );
  const laterAdjustmentRecord = useMemo(
    () => voucherRows.find((record) => record.id === laterAdjustmentVoucherId),
    [laterAdjustmentVoucherId, voucherRows]
  );
  const reversalVoucherNo = useMemo(
    () => reversalRecord ? getNextAccountingVoucherNo(accountingVoucherLifecycleRows, reversalRecord.accountingPeriod) : '',
    [accountingVoucherLifecycleRows, reversalRecord]
  );
  const reversalValidationIssues = useMemo(
    () => reversalRecord ? validateAccountingVoucherReversal(reversalRecord, reversalForm, accountingPeriodLocks) : [],
    [accountingPeriodLocks, reversalForm, reversalRecord]
  );
  const canSubmitReversal = reversalRecord
    ? canSubmitAccountingVoucherReversal(reversalRecord, reversalForm, accountingPeriodLocks)
    : false;
  const laterAdjustmentValidationIssues = useMemo(
    () => laterAdjustmentRecord
      ? validateLaterPeriodAccountingVoucherAdjustment(
          laterAdjustmentRecord,
          laterAdjustmentForm,
          accountingPeriodLocks,
          accountingVoucherLaterPeriodAdjustmentRows
        )
      : [],
    [accountingPeriodLocks, accountingVoucherLaterPeriodAdjustmentRows, laterAdjustmentForm, laterAdjustmentRecord]
  );
  const canSubmitLaterAdjustment = laterAdjustmentRecord
    ? canSubmitLaterPeriodAccountingVoucherAdjustment(
        laterAdjustmentRecord,
        laterAdjustmentForm,
        accountingPeriodLocks,
        accountingVoucherLaterPeriodAdjustmentRows
      )
    : false;
  const canBookActiveRecord = activeRecord ? canBookAccountingVoucher(activeRecord, accountingPeriodLocks) : false;
  const canReverseActiveRecord = activeRecord ? canReverseAccountingVoucher(activeRecord, accountingPeriodLocks) : false;
  const activeDefaultLaterAdjustmentTargetPeriod = activeRecord
    ? getDefaultLaterPeriodAdjustmentAccountingPeriod(activeRecord)
    : undefined;
  const activeLaterAdjustmentTargetPeriod = activeRecord
    ? getAvailableLaterPeriodAdjustmentAccountingPeriod(
        activeRecord,
        accountingPeriodLocks,
        accountingVoucherLaterPeriodAdjustmentRows
      )
    : undefined;
  const activeExistingLaterAdjustment = activeRecord && activeDefaultLaterAdjustmentTargetPeriod
    ? getExistingLaterPeriodAccountingVoucherAdjustment(
        activeRecord,
        activeDefaultLaterAdjustmentTargetPeriod,
        accountingVoucherLaterPeriodAdjustmentRows
      )
    : undefined;
  const canCreateLaterAdjustmentActiveRecord = activeRecord
    ? Boolean(activeLaterAdjustmentTargetPeriod) && canCreateLaterPeriodAccountingVoucherAdjustment(
        activeRecord,
        accountingPeriodLocks,
        activeLaterAdjustmentTargetPeriod,
        accountingVoucherLaterPeriodAdjustmentRows
      )
    : false;
  const activePeriodLockNotice = activeRecord
    ? getAccountingVoucherPeriodLockNotice(activeRecord, accountingPeriodLocks)
    : undefined;

  function openReversalDrawer(record: AccountingVoucherRecord) {
    setReversalForm({
      reason: '',
      reversedAt: getAccountingVoucherDefaultReversalDate(record)
    });
    setReversalVoucherId(record.id);
  }

  function updateReversalForm<K extends keyof AccountingVoucherReversalInput>(
    field: K,
    value: AccountingVoucherReversalInput[K]
  ) {
    setReversalForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function openLaterAdjustmentDrawer(record: AccountingVoucherRecord) {
    const defaultAccountingPeriod = getAvailableLaterPeriodAdjustmentAccountingPeriod(
      record,
      accountingPeriodLocks,
      accountingVoucherLaterPeriodAdjustmentRows
    );

    if (!defaultAccountingPeriod) {
      void messageApi.warning('当前凭证暂无可用后续调整期间');
      return;
    }

    setLaterAdjustmentForm({
      accountingPeriod: defaultAccountingPeriod,
      adjustedAt: `${defaultAccountingPeriod}-01`,
      reason: ''
    });
    setLaterAdjustmentVoucherId(record.id);
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

  function handleBookVoucher(record: AccountingVoucherRecord) {
    if (!bookAccountingVoucher(record)) {
      void messageApi.warning('当前凭证不可记账');
      return;
    }

    setActiveVoucherId(record.id);
    void messageApi.success('凭证已记账');
  }

  function submitReversal() {
    if (!reversalRecord || !canSubmitReversal) {
      return;
    }

    if (!reverseAccountingVoucher(reversalRecord, reversalForm)) {
      void messageApi.warning('当前凭证不可冲销');
      return;
    }

    setActiveVoucherId(reversalRecord.id);
    setReversalVoucherId(undefined);
    void messageApi.success('冲销凭证已生成');
  }

  function submitLaterAdjustment() {
    if (!laterAdjustmentRecord || !canSubmitLaterAdjustment) {
      return;
    }

    const adjustmentRecord = createLaterPeriodAccountingVoucherAdjustmentRecord({
      actor: '李明',
      existingRows: accountingVoucherLaterPeriodAdjustmentRows,
      input: laterAdjustmentForm,
      originalRecord: laterAdjustmentRecord
    });
    const created = addAccountingVoucherLaterPeriodAdjustment(adjustmentRecord);

    if (!created) {
      void messageApi.warning('后续调整事项未创建，请检查调整期间或是否已存在');
      return;
    }

    setActiveVoucherId(`voucher-later-adjustment-${adjustmentRecord.id}`);
    setLaterAdjustmentVoucherId(undefined);
    void messageApi.success('后续调整事项已创建');
  }

  const columns: TableColumnsType<AccountingVoucherRecord> = [
    {
      title: '记账事项',
      key: 'voucher',
      width: 260,
      render: (_, record) => {
        const identity = getAccountingVoucherListIdentity(record);

        return <CompactCell primary={identity.primary} secondary={identity.secondary} />;
      }
    },
    {
      title: '业务环节',
      dataIndex: 'businessType',
      width: 112,
      render: (businessType: AccountingVoucherBusinessType) => <StatusTag toneMap={voucherBusinessTone} value={businessType} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 104,
      render: (status: AccountingVoucherStatus) => <StatusTag toneMap={voucherStatusTone} value={status} />
    },
    {
      title: '前置条件',
      key: 'issueSummary',
      width: 160,
      render: (_, record) => (
        <CellText tone={record.issueReasons.length > 0 ? 'risk' : 'subtle'}>
          {record.issueReasons.length > 0 ? getAccountingVoucherIssueSummary(record) : '已满足'}
        </CellText>
      )
    },
    {
      title: '下一步',
      key: 'nextStep',
      width: 180,
      render: (_, record) => {
        const defaultLaterAdjustmentTargetPeriod = getDefaultLaterPeriodAdjustmentAccountingPeriod(record);
        const laterAdjustmentTargetPeriod = getAvailableLaterPeriodAdjustmentAccountingPeriod(
          record,
          accountingPeriodLocks,
          accountingVoucherLaterPeriodAdjustmentRows
        );
        const existingLaterAdjustment = getExistingLaterPeriodAccountingVoucherAdjustment(
          record,
          defaultLaterAdjustmentTargetPeriod,
          accountingVoucherLaterPeriodAdjustmentRows
        );
        const nextStep = getAccountingVoucherNextStep(
          record,
          canBookAccountingVoucher(record, accountingPeriodLocks),
          canReverseAccountingVoucher(record, accountingPeriodLocks),
          Boolean(laterAdjustmentTargetPeriod) && canCreateLaterPeriodAccountingVoucherAdjustment(
            record,
            accountingPeriodLocks,
            laterAdjustmentTargetPeriod,
            accountingVoucherLaterPeriodAdjustmentRows
          ),
          existingLaterAdjustment,
          laterAdjustmentTargetPeriod,
          isAccountingPeriodLocked(accountingPeriodLocks, record.accountingPeriod)
        );

        return <CompactCell primary={nextStep.primary} secondary={nextStep.secondary} />;
      }
    },
    {
      title: '入账期间',
      dataIndex: 'accountingPeriod',
      width: 112
    },
    {
      title: '业务对象',
      dataIndex: 'counterparty',
      width: 150
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      render: (amount: number) => <CellText tone="strong">{formatMoney(amount)}</CellText>
    }
  ];

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      layout="table-workbench"
      metrics={
        <MetricGrid columns={5} density="compact">
          <MetricCard icon={<ClockCircleOutlined />} label="待生成" value={metrics.pendingGenerationCount} />
          <MetricCard icon={<WarningOutlined />} label="需处理" value={metrics.issueCount} />
          <MetricCard icon={<FileTextOutlined />} label="待记账" value={metrics.readyToBookCount} />
          <MetricCard icon={<CheckCircleOutlined />} label="已记账" value={metrics.bookedCount} />
          <MetricCard icon={<RollbackOutlined />} label="已冲销" value={metrics.reversedCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={accountingVoucherDefaultMonth}
              label="入账期间"
              testIdPrefix="finance-accounting-voucher-period"
              value={filters.accountingPeriodTime}
              onChange={(accountingPeriodTime) => setFilters((current) => ({ ...current, accountingPeriodTime }))}
            />
            <FilterField label="凭证状态">
              <Select
                data-testid="finance-accounting-voucher-status-filter"
                options={(['全部', ...accountingVoucherStatusOptions] satisfies Array<'全部' | AccountingVoucherStatus>).map((status) => ({
                  label: status,
                  value: status
                }))}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-accounting-voucher-keyword-input"
              placeholder="来源单号 / 凭证号 / 对象 / 科目"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-accounting-vouchers"
    >
      <ManagementTable<AccountingVoucherRecord>
        columns={columns}
        count={{ value: filteredRows.length, unit: '条事项' }}
        dataSource={filteredRows}
        rowKey="id"
        rowTestIdPrefix="finance-accounting-voucher-table-row"
        tableTestId="finance-accounting-voucher-table"
        onRowClick={(record) => setActiveVoucherId(record.id)}
      />

      <AccountingVoucherDetailDrawer
        canBook={canBookActiveRecord}
        canCreateLaterAdjustment={canCreateLaterAdjustmentActiveRecord}
        canReverse={canReverseActiveRecord}
        existingLaterAdjustment={activeExistingLaterAdjustment}
        periodLockNotice={activePeriodLockNotice}
        record={activeRecord}
        onBook={handleBookVoucher}
        onCreateLaterAdjustment={openLaterAdjustmentDrawer}
        onReverse={openReversalDrawer}
        onClose={() => setActiveVoucherId(undefined)}
      />

      <AccountingVoucherReversalDrawer
        canSubmit={canSubmitReversal}
        form={reversalForm}
        voucherNo={reversalVoucherNo}
        record={reversalRecord}
        validationIssues={reversalValidationIssues}
        onClose={() => setReversalVoucherId(undefined)}
        onSubmit={submitReversal}
        onUpdate={updateReversalForm}
      />

      <AccountingVoucherLaterAdjustmentDrawer
        canSubmit={canSubmitLaterAdjustment}
        existingRows={accountingVoucherLaterPeriodAdjustmentRows}
        form={laterAdjustmentForm}
        record={laterAdjustmentRecord}
        validationIssues={laterAdjustmentValidationIssues}
        onClose={() => setLaterAdjustmentVoucherId(undefined)}
        onSubmit={submitLaterAdjustment}
        onUpdate={updateLaterAdjustmentForm}
      />
    </ManagementPageScaffold>
  );
}
