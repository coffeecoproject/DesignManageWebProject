import {
  AuditOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  LockOutlined,
  PartitionOutlined,
  ProfileOutlined,
  RollbackOutlined,
  UploadOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import { Alert, App as AntApp, Button, Input, InputNumber, Segmented, Select, Space } from 'antd';
import type { TableColumnsType } from 'antd';
import { type ReactNode, useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useModeDrawerState } from '../../components/DrawerForm';
import { FilterBar, FilterField, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import type { OperationRecord } from '../../components/OperationRecordTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from './FinanceManagementState';
import { useFinanceLedgerInitialization } from './FinanceLedgerInitializationState';
import {
  accountingStatementTargetTone,
  accountingSubjectSeedRows,
  accountingSubjectStatusTone,
  accountingSubjectTypeOptions,
  accountingSubjectTypeTone,
  type AccountingSubjectBalanceDirection,
  type AccountingSubjectRecord,
  type AccountingSubjectType
} from './financeAccountingSubjectData';
import {
  buildLedgerInitializationSteps,
  buildLedgerInitializationSummary,
  buildLedgerInitializationControlledActions,
  buildLedgerOpeningBalanceWorkspace,
  applyLedgerOpeningBalanceImportPreview,
  defaultLedgerInitializationFilters,
  ledgerInitializationControlContext,
  ledgerInitializationDraftProfile,
  ledgerOpeningBalanceDraftImportBatch,
  ledgerOpeningBalanceEntrySourceLabels,
  matchesLedgerInitializationFilters,
  type LedgerInitializationControlledAction,
  type LedgerInitializationControlledActionKey,
  type LedgerInitializationControlledActionStatus,
  type LedgerInitializationControlContext,
  type LedgerInitializationFilters,
  type LedgerInitializationOperationRecord,
  type LedgerInitializationProfile,
  type LedgerInitializationSummary,
  type LedgerInitializationStatus,
  type LedgerInitializationStepKey,
  type LedgerInitializationStepStatus,
  type LedgerInitializationTrialBalanceStatus,
  type LedgerInitializationWorkspaceMode,
  type LedgerOpeningBalanceEntrySource,
  type LedgerOpeningBalanceEntryStatus,
  type LedgerOpeningBalanceImportImpact,
  type LedgerOpeningBalanceImportPreviewRow,
  type LedgerOpeningBalanceImportStatus,
  type LedgerOpeningBalancePreviewStatus,
  type LedgerOpeningBalanceValidationItem,
  type LedgerOpeningBalanceRow,
  type LedgerOpeningAdjustmentVoucherRecord,
  type LedgerOpeningAdjustmentVoucherStatus
} from './financeLedgerInitializationModel';
import { formatMoney } from './financeUtils';

const ledgerInitializationStatusTone: Record<LedgerInitializationStatus, 'amber' | 'blue' | 'green' | 'gray' | 'red'> = {
  未开始: 'gray',
  基础设置完成: 'blue',
  科目已确认: 'blue',
  期初已录入: 'blue',
  试算平衡: 'green',
  试算不平: 'red',
  已启用: 'green'
};

const ledgerInitializationStepTone: Record<LedgerInitializationStepStatus, 'amber' | 'blue' | 'green' | 'gray' | 'red'> = {
  error: 'red',
  finish: 'green',
  process: 'blue',
  wait: 'gray'
};

const ledgerInitializationStepLabel: Record<LedgerInitializationStepStatus, string> = {
  error: '需处理',
  finish: '已完成',
  process: '当前',
  wait: '待处理'
};

const ledgerInitializationWorkspaceTone: Record<LedgerInitializationWorkspaceMode, 'blue' | 'green'> = {
  初始化草稿: 'blue',
  已启用账套: 'green'
};

const controlledActionTone: Record<LedgerInitializationControlledActionStatus, 'amber' | 'blue' | 'gray'> = {
  可发起: 'blue',
  受限: 'amber',
  未启用: 'gray'
};

const openingAdjustmentVoucherStatusTone: Record<LedgerOpeningAdjustmentVoucherStatus, 'blue' | 'green'> = {
  待记账: 'blue',
  已记账: 'green'
};

const trialBalanceTone: Record<LedgerInitializationTrialBalanceStatus, 'amber' | 'green' | 'red'> = {
  待试算: 'amber',
  不平衡: 'red',
  平衡: 'green'
};

const openingBalanceEntryStatusTone: Record<LedgerOpeningBalanceEntryStatus, 'blue' | 'gray' | 'green'> = {
  可录入: 'blue',
  已录入: 'green',
  已锁定: 'gray'
};

const openingBalanceEntrySourceTone: Record<LedgerOpeningBalanceEntrySource, 'blue' | 'gray' | 'green'> = {
  导入应用: 'green',
  手工录入: 'blue',
  系统承接: 'gray'
};

const openingBalanceImportStatusTone: Record<LedgerOpeningBalanceImportStatus, 'amber' | 'blue' | 'gray' | 'green' | 'red'> = {
  未导入: 'gray',
  待应用: 'blue',
  已应用: 'green',
  校验失败: 'red',
  已锁定: 'gray'
};

const openingBalancePreviewStatusTone: Record<LedgerOpeningBalancePreviewStatus, 'green' | 'red'> = {
  可应用: 'green',
  需处理: 'red'
};

const openingBalanceValidationStatusTone: Record<'通过' | '需处理', 'green' | 'red'> = {
  通过: 'green',
  需处理: 'red'
};

const balanceDirectionTone: Record<AccountingSubjectBalanceDirection, 'green' | 'red'> = {
  借方: 'green',
  贷方: 'red'
};

const workflowViewOptions: Array<{ label: string; value: LedgerInitializationStepKey }> = [
  { label: '基础设置', value: 'basic' },
  { label: '科目确认', value: 'subjects' },
  { label: '期初余额', value: 'opening-balances' },
  { label: '试算结果', value: 'trial-balance' },
  { label: '启用记录', value: 'enable' }
];

const workspaceModeOptions: Array<{ label: string; value: LedgerInitializationWorkspaceMode }> = [
  { label: '初始化草稿', value: '初始化草稿' },
  { label: '已启用账套', value: '已启用账套' }
];

type OpeningBalanceViewKey = 'ledger' | 'import-preview' | 'validation';

type LedgerInitializationProcessActionKey =
  | 'basic-settings'
  | 'opening-add'
  | 'opening-delete'
  | 'opening-import'
  | 'trial-balance'
  | 'apply-import'
  | 'enable-ledger';

const ledgerInitializationProcessActionLabels: Record<LedgerInitializationProcessActionKey, string> = {
  'apply-import': '应用导入',
  'basic-settings': '保存基础设置',
  'enable-ledger': '启用账套',
  'opening-add': '保存科目余额',
  'opening-delete': '确认删除',
  'opening-import': '上传并预览',
  'trial-balance': '执行试算'
};

type LedgerInitializationBasicSettingsForm = Pick<LedgerInitializationProfile, 'accountSetName' | 'effectivePeriod'>;

type LedgerOpeningBalanceManualForm = {
  amount: number;
  auxiliaryLabel: string;
  balanceSide: AccountingSubjectBalanceDirection;
  subjectCode: string;
};

type LedgerEnableWithdrawForm = {
  impact: string;
  reason: string;
};

type LedgerOpeningAdjustmentForm = {
  amount: number;
  balanceSide: AccountingSubjectBalanceDirection;
  evidenceName: string;
  reason: string;
  subjectCode: string;
};

const openingBalanceImportImpactTone: Record<LedgerOpeningBalanceImportImpact, 'amber' | 'blue'> = {
  新增: 'blue',
  覆盖: 'amber'
};

const openingBalanceViewOptions: Array<{ label: string; value: OpeningBalanceViewKey }> = [
  { label: '录入台账', value: 'ledger' },
  { label: '导入预览', value: 'import-preview' },
  { label: '校验结果', value: 'validation' }
];

function formatOpeningAmount(amount: number) {
  return amount === 0 ? '-' : formatMoney(amount);
}

function renderOpeningBalanceEntrySource(entrySource: LedgerOpeningBalanceEntrySource) {
  return <StatusTag tone={openingBalanceEntrySourceTone[entrySource]} value={ledgerOpeningBalanceEntrySourceLabels[entrySource]} />;
}

function formatOperationTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes())
  ].join('');
}

function createBasicSettingsForm(profile: LedgerInitializationProfile): LedgerInitializationBasicSettingsForm {
  return {
    accountSetName: profile.accountSetName,
    effectivePeriod: profile.effectivePeriod
  };
}

function isOpeningBalanceSubjectEligible(subject: AccountingSubjectRecord) {
  return subject.status === '启用' && subject.type !== '损益类';
}

function createDefaultOpeningBalanceForm(subjectRows = accountingSubjectSeedRows): LedgerOpeningBalanceManualForm {
  const defaultSubject =
    subjectRows.find(isOpeningBalanceSubjectEligible) ?? accountingSubjectSeedRows.find(isOpeningBalanceSubjectEligible) ?? accountingSubjectSeedRows[0];

  return {
    amount: 0,
    auxiliaryLabel: '无',
    balanceSide: defaultSubject?.balanceDirection ?? '借方',
    subjectCode: defaultSubject?.code ?? ''
  };
}

function createDefaultWithdrawForm(): LedgerEnableWithdrawForm {
  return {
    impact: '',
    reason: ''
  };
}

function getOpeningAdjustmentSubjectRows() {
  return accountingSubjectSeedRows.filter((subject) => subject.status === '启用');
}

function createDefaultOpeningAdjustmentForm(): LedgerOpeningAdjustmentForm {
  const defaultSubject = getOpeningAdjustmentSubjectRows()[0] ?? accountingSubjectSeedRows[0];

  return {
    amount: 0,
    balanceSide: defaultSubject?.balanceDirection ?? '借方',
    evidenceName: '',
    reason: '',
    subjectCode: defaultSubject?.code ?? ''
  };
}

function createOpeningBalanceFormFromRow(row: LedgerOpeningBalanceRow): LedgerOpeningBalanceManualForm {
  return {
    amount: row.debitAmount > 0 ? row.debitAmount : row.creditAmount,
    auxiliaryLabel: row.auxiliaryLabel,
    balanceSide: row.debitAmount > 0 ? '借方' : '贷方',
    subjectCode: row.subjectCode
  };
}

function getOpeningBalanceFormIssue(form: LedgerOpeningBalanceManualForm) {
  const subject = accountingSubjectSeedRows.find((record) => record.code === form.subjectCode);

  if (!subject) {
    return '请选择有效会计科目。';
  }

  if (subject.status !== '启用') {
    return '停用科目不能录入期初余额。';
  }

  if (subject.type === '损益类') {
    return '损益类科目不直接录入期初余额，历史经营结果通过本年利润或未分配利润承接。';
  }

  if (form.amount <= 0) {
    return '期初金额必须大于 0。';
  }

  return undefined;
}

function getWithdrawFormIssue(form: LedgerEnableWithdrawForm) {
  if (!form.reason.trim()) {
    return '请填写撤回原因。';
  }

  if (!form.impact.trim()) {
    return '请填写影响范围说明。';
  }

  return undefined;
}

function getOpeningAdjustmentFormIssue(form: LedgerOpeningAdjustmentForm) {
  const subject = accountingSubjectSeedRows.find((record) => record.code === form.subjectCode);

  if (!subject || subject.status !== '启用') {
    return '请选择启用状态的会计科目。';
  }

  if (form.amount <= 0) {
    return '调整金额必须大于 0。';
  }

  if (!form.reason.trim()) {
    return '请填写调整原因。';
  }

  if (!form.evidenceName.trim()) {
    return '请填写原始依据。';
  }

  return undefined;
}

function buildOpeningBalanceFormRowIdSuffix(auxiliaryLabel: string) {
  const normalizedLabel = auxiliaryLabel.trim() || '无';

  if (normalizedLabel === '无') {
    return 'none';
  }

  return encodeURIComponent(normalizedLabel).replace(/%/g, '').toLowerCase();
}

function createDraftOperationRecord({
  action,
  note,
  result
}: {
  action: string;
  note: string;
  result: LedgerInitializationStatus;
}): LedgerInitializationOperationRecord {
  const operatedAt = formatOperationTime();

  return {
    action,
    actor: '李明',
    id: `ledger-init-operation-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    note,
    operatedAt,
    result
  };
}

function buildManualOpeningBalanceRow({
  form,
  period
}: {
  form: LedgerOpeningBalanceManualForm;
  period: string;
}): LedgerOpeningBalanceRow | undefined {
  const subject = accountingSubjectSeedRows.find((record) => record.code === form.subjectCode);

  if (!subject) {
    return undefined;
  }

  return {
    accountingPeriod: period,
    auxiliaryLabel: form.auxiliaryLabel.trim() || '无',
    balanceDirection: subject.balanceDirection,
    creditAmount: form.balanceSide === '贷方' ? form.amount : 0,
    debitAmount: form.balanceSide === '借方' ? form.amount : 0,
    entrySource: '手工录入',
    id: `ledger-opening-manual-${subject.code.replace(/\./g, '-')}-${buildOpeningBalanceFormRowIdSuffix(form.auxiliaryLabel)}`,
    source: '账套初始化',
    subjectCode: subject.code,
    subjectName: subject.name,
    subjectType: subject.type
  };
}

function buildOpeningAdjustmentVoucherRecord({
  accountingPeriod,
  createdAt,
  form
}: {
  accountingPeriod: string;
  createdAt: string;
  form: LedgerOpeningAdjustmentForm;
}): LedgerOpeningAdjustmentVoucherRecord | undefined {
  const subject = accountingSubjectSeedRows.find((record) => record.code === form.subjectCode);

  if (!subject) {
    return undefined;
  }

  return {
    accountingPeriod,
    amount: form.amount,
    balanceSide: form.balanceSide,
    createdAt,
    createdBy: '李明',
    evidenceName: form.evidenceName.trim(),
    id: `ledger-opening-adjustment-${Date.now()}`,
    reason: form.reason.trim(),
    status: '待记账',
    subjectCode: subject.code,
    subjectName: subject.name,
    voucherNo: `INIT-ADJ-${createdAt.slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-4)}`
  };
}

function mapOperationRecord(record: LedgerInitializationOperationRecord, accountSetName: string): OperationRecord {
  return {
    action: record.action,
    actor: record.actor,
    id: record.id,
    object: accountSetName,
    summary: record.note,
    time: record.operatedAt
  };
}

function OpeningBalanceFormContent({
  form,
  subjectOptions,
  subjectSelectDisabled,
  onChange
}: {
  form: LedgerOpeningBalanceManualForm;
  subjectOptions: Array<{ label: string; value: string }>;
  subjectSelectDisabled?: boolean;
  onChange: <K extends keyof LedgerOpeningBalanceManualForm>(key: K, value: LedgerOpeningBalanceManualForm[K]) => void;
}) {
  const selectedSubject = accountingSubjectSeedRows.find((subject) => subject.code === form.subjectCode);
  const formIssue = getOpeningBalanceFormIssue(form);

  return (
    <div className="ledger-initialization-form-stack">
      <DrawerFormGrid>
        <DrawerFormField label="会计科目" required wide>
          <Select
            disabled={subjectSelectDisabled}
            showSearch
            optionFilterProp="label"
            options={subjectOptions}
            placeholder="选择未录入期初余额的科目"
            value={form.subjectCode || undefined}
            onChange={(subjectCode: string) => {
              const nextSubject = accountingSubjectSeedRows.find((subject) => subject.code === subjectCode);

              onChange('subjectCode', subjectCode);
              if (nextSubject) {
                onChange('balanceSide', nextSubject.balanceDirection);
              }
            }}
          />
        </DrawerFormField>
        <DrawerFormField label="辅助核算">
          <Input
            placeholder="无 / 客户 / 供应商 / 员工"
            value={form.auxiliaryLabel}
            onChange={(event) => onChange('auxiliaryLabel', event.target.value)}
          />
        </DrawerFormField>
        <DrawerFormField label="余额方向" required>
          <Select
            options={[
              { label: '借方', value: '借方' },
              { label: '贷方', value: '贷方' }
            ]}
            value={form.balanceSide}
            onChange={(balanceSide: AccountingSubjectBalanceDirection) => onChange('balanceSide', balanceSide)}
          />
        </DrawerFormField>
        <DrawerFormField label="期初金额" required>
          <InputNumber
            min={0}
            precision={2}
            style={{ width: '100%' }}
            value={form.amount}
            onChange={(value) => onChange('amount', value ?? 0)}
          />
        </DrawerFormField>
        <DrawerFormField label="科目默认方向">
          <Input disabled value={selectedSubject?.balanceDirection ?? '-'} />
        </DrawerFormField>
      </DrawerFormGrid>
      {formIssue ? <Alert message={formIssue} showIcon type="warning" /> : null}
    </div>
  );
}

function OpeningBalanceDrawer({
  canEdit,
  form,
  mode,
  open,
  record,
  subjectOptions,
  onCancel,
  onDelete,
  onEdit,
  onFormChange,
  onSave,
  onClose
}: {
  canEdit: boolean;
  form: LedgerOpeningBalanceManualForm;
  mode?: 'create' | 'detail' | 'edit';
  open: boolean;
  record?: LedgerOpeningBalanceRow;
  subjectOptions: Array<{ label: string; value: string }>;
  onCancel: () => void;
  onDelete: (record: LedgerOpeningBalanceRow) => void;
  onEdit: () => void;
  onFormChange: <K extends keyof LedgerOpeningBalanceManualForm>(key: K, value: LedgerOpeningBalanceManualForm[K]) => void;
  onSave: (record: LedgerOpeningBalanceRow, form: LedgerOpeningBalanceManualForm) => void;
  onClose: () => void;
}) {
  const isDetailMode = mode === 'detail';
  const isEditMode = mode === 'edit';
  const currentSubjectOption =
    record && !subjectOptions.some((option) => option.value === record.subjectCode)
      ? [{ label: `${record.subjectCode} ${record.subjectName}`, value: record.subjectCode }, ...subjectOptions]
      : subjectOptions;

  if (!record) {
    return null;
  }

  return (
    <DrawerFormShell
      bodyTestId="finance-ledger-initialization-detail-drawer"
      className="finance-transaction-drawer"
      detailActions={
        isDetailMode
          ? {
              closeAction: { label: '关闭', onClick: onClose },
              primaryAction: canEdit
                ? {
                    icon: <EditOutlined />,
                    label: '编辑',
                    testId: 'finance-ledger-initialization-opening-edit-from-detail',
                    onClick: onEdit
                  }
                : undefined,
              secondaryAction: canEdit
                ? {
                    danger: true,
                    icon: <DeleteOutlined />,
                    label: '删除',
                    testId: 'finance-ledger-initialization-opening-delete-from-detail',
                    type: 'default',
                    onClick: () => onDelete(record)
                  }
                : undefined
            }
          : undefined
      }
      formActions={
        isEditMode
          ? {
              cancelAction: { label: '取消', onClick: onCancel },
              primaryAction: {
                disabled: Boolean(getOpeningBalanceFormIssue(form)),
                icon: <EditOutlined />,
                label: '保存调整',
                onClick: () => onSave(record, form)
              }
            }
          : undefined
      }
      mode={mode}
      open={open}
      title={
        <DetailDrawerTitle
          status={ledgerOpeningBalanceEntrySourceLabels[record.entrySource]}
          statusTone={openingBalanceEntrySourceTone[record.entrySource]}
          subtitle={`${record.subjectCode} / ${record.accountingPeriod}`}
          title={isEditMode ? '编辑期初余额' : '期初余额详情'}
        />
      }
      width={820}
      onClose={isEditMode ? onCancel : onClose}
    >
      {isDetailMode ? (
        <>
          <DetailSummaryCards
            columns={4}
            items={[
              { icon: <ProfileOutlined />, key: 'subject', label: '科目', value: `${record.subjectCode} ${record.subjectName}` },
              { icon: <BookOutlined />, key: 'debit', label: '期初借方', value: formatOpeningAmount(record.debitAmount) },
              { icon: <BookOutlined />, key: 'credit', label: '期初贷方', value: formatOpeningAmount(record.creditAmount) },
              {
                icon: <CheckCircleOutlined />,
                key: 'direction',
                label: '余额方向',
                value: <StatusTag toneMap={balanceDirectionTone} value={record.balanceDirection} />
              }
            ]}
          />

          <DetailSection icon={<PartitionOutlined />} title="科目信息">
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '科目编码', value: record.subjectCode },
                { label: '科目名称', value: record.subjectName },
                { label: '科目类别', value: <StatusTag toneMap={accountingSubjectTypeTone} value={record.subjectType} /> },
                { label: '会计期间', value: record.accountingPeriod },
                { label: '辅助核算', value: record.auxiliaryLabel },
                { label: '录入方式', value: renderOpeningBalanceEntrySource(record.entrySource) }
              ]}
            />
          </DetailSection>
        </>
      ) : (
        <DetailSection icon={<EditOutlined />} title="调整内容">
          <div className="ledger-initialization-section-stack">
            <Alert message="编辑后会把该条期初余额标记为手工录入，并要求重新试算。" showIcon type="info" />
            <OpeningBalanceFormContent
              form={form}
              subjectOptions={currentSubjectOption}
              subjectSelectDisabled
              onChange={onFormChange}
            />
          </div>
        </DetailSection>
      )}
    </DrawerFormShell>
  );
}

function LedgerInitializationProcessDrawer({
  actionKey,
  basicSettingsForm,
  importFileName,
  openingBalanceForm,
  openingBalanceSubjectOptions,
  openingBalanceTarget,
  openingWorkspace,
  profile,
  summary,
  effectivePeriodLocked,
  workspaceMode,
  onBasicSettingsFormChange,
  onClose,
  onImportFileNameChange,
  onOpeningBalanceFormChange,
  onSubmit
}: {
  actionKey?: LedgerInitializationProcessActionKey;
  basicSettingsForm: LedgerInitializationBasicSettingsForm;
  importFileName: string;
  openingBalanceForm: LedgerOpeningBalanceManualForm;
  openingBalanceSubjectOptions: Array<{ label: string; value: string }>;
  openingBalanceTarget?: LedgerOpeningBalanceRow;
  openingWorkspace: ReturnType<typeof buildLedgerOpeningBalanceWorkspace>;
  profile: LedgerInitializationProfile;
  summary: LedgerInitializationSummary;
  effectivePeriodLocked: boolean;
  workspaceMode: LedgerInitializationWorkspaceMode;
  onBasicSettingsFormChange: <K extends keyof LedgerInitializationBasicSettingsForm>(
    key: K,
    value: LedgerInitializationBasicSettingsForm[K]
  ) => void;
  onClose: () => void;
  onImportFileNameChange: (fileName: string) => void;
  onOpeningBalanceFormChange: <K extends keyof LedgerOpeningBalanceManualForm>(key: K, value: LedgerOpeningBalanceManualForm[K]) => void;
  onSubmit: (actionKey: LedgerInitializationProcessActionKey) => void;
}) {
  if (!actionKey) {
    return null;
  }

  const processCopy: Record<
    LedgerInitializationProcessActionKey,
    {
      alert: string;
      icon: ReactNode;
      primaryLabel: string;
      title: string;
      values: Array<{ label: string; value: string }>;
    }
  > = {
    'apply-import': {
      alert: '应用导入后会覆盖同科目同辅助核算的草稿期初余额，仍需要重新试算。',
      icon: <CheckCircleOutlined />,
      primaryLabel: '应用导入',
      title: '应用导入预览',
      values: [
        { label: '处理阶段', value: '期初余额' },
        { label: '处理结果', value: '导入预览应用到期初余额草稿' },
        { label: '后续流程', value: '试算校验 / 启用账套' }
      ]
    },
    'basic-settings': {
      alert: '基础设置只在账套启用前允许保存；启用后进入只读档案。',
      icon: <EditOutlined />,
      primaryLabel: '保存基础设置',
      title: '编辑基础设置',
      values: [
        { label: '账套名称', value: profile.accountSetName },
        { label: '会计准则', value: profile.accountingStandard },
        { label: '纳税人类型', value: profile.taxpayerType },
        { label: '启用期间', value: profile.effectivePeriod },
        { label: '后续流程', value: '科目确认 / 期初余额 / 试算平衡' }
      ]
    },
    'enable-ledger': {
      alert: '启用后基础设置和期初余额锁定，作为后续账簿期初。',
      icon: <LockOutlined />,
      primaryLabel: '启用账套',
      title: '启用账套',
      values: [
        { label: '启用期间', value: profile.effectivePeriod },
        { label: '启用影响', value: '期初余额作为后续账簿期初' },
        { label: '后续改错', value: '撤回启用或期初调整' }
      ]
    },
    'opening-add': {
      alert: '手工新增用于补充没有从业务承接或导入录入带入的期初科目余额。',
      icon: <FileDoneOutlined />,
      primaryLabel: '保存科目余额',
      title: '新增科目余额',
      values: [
        { label: '处理阶段', value: '期初余额' },
        { label: '录入口径', value: '科目 / 辅助核算 / 借方或贷方金额' },
        { label: '后续流程', value: '试算校验 / 启用账套' }
      ]
    },
    'opening-delete': {
      alert: '删除后需要重新试算；账套启用后不能直接删除期初余额。',
      icon: <DeleteOutlined />,
      primaryLabel: '确认删除',
      title: '删除期初余额',
      values: [
        { label: '处理阶段', value: '期初余额' },
        { label: '处理结果', value: '从期初余额草稿移除该科目余额' },
        { label: '后续流程', value: '试算校验 / 启用账套' }
      ]
    },
    'opening-import': {
      alert: '导入只进入预览，预览通过后再应用到期初余额草稿。',
      icon: <UploadOutlined />,
      primaryLabel: '上传并预览',
      title: '导入期初余额',
      values: [
        { label: '处理阶段', value: '期初余额' },
        { label: '文件要求', value: '科目编码、辅助核算、余额方向、期初金额' },
        { label: '后续流程', value: '导入预览 / 应用导入 / 试算校验' }
      ]
    },
    'trial-balance': {
      alert: '试算只检查期初借贷是否平衡；试算不平不能启用账套。',
      icon: <AuditOutlined />,
      primaryLabel: '执行试算',
      title: '试算校验',
      values: [
        { label: '处理阶段', value: '试算平衡' },
        { label: '校验口径', value: '期初借方合计等于期初贷方合计' },
        { label: '后续流程', value: '试算平衡后启用账套' }
      ]
    }
  };
  const current = processCopy[actionKey];
  const importPreviewStatus: LedgerOpeningBalancePreviewStatus = openingWorkspace.importPreviewRows.some(
    (row) => row.previewStatus === '需处理'
  )
    ? '需处理'
    : '可应用';
  const openingBalanceFormIssue = getOpeningBalanceFormIssue(openingBalanceForm);
  const primaryDisabled =
    (effectivePeriodLocked && actionKey !== 'enable-ledger') ||
    (actionKey === 'basic-settings' && (!basicSettingsForm.accountSetName.trim() || !basicSettingsForm.effectivePeriod.trim())) ||
    (actionKey === 'opening-add' && (Boolean(openingBalanceFormIssue) || openingBalanceSubjectOptions.length === 0)) ||
    (actionKey === 'opening-delete' && !openingBalanceTarget) ||
    (actionKey === 'opening-import' && !importFileName.trim()) ||
    (actionKey === 'trial-balance' && !openingWorkspace.canRunTrialBalance) ||
    (actionKey === 'apply-import' && !openingWorkspace.canApplyImport) ||
    (actionKey === 'enable-ledger' && (!summary.canEnable || openingWorkspace.validation.blockingIssueCount > 0 || effectivePeriodLocked));

  function renderProcessContent() {
    if (actionKey === 'basic-settings') {
      return (
        <DrawerFormGrid>
          <DrawerFormField label="账套名称" required>
            <Input
              value={basicSettingsForm.accountSetName}
              onChange={(event) => onBasicSettingsFormChange('accountSetName', event.target.value)}
            />
          </DrawerFormField>
          <DrawerFormField label="启用期间" required>
            <Input
              placeholder="YYYY-MM"
              value={basicSettingsForm.effectivePeriod}
              onChange={(event) => onBasicSettingsFormChange('effectivePeriod', event.target.value)}
            />
          </DrawerFormField>
          <DrawerFormField label="会计准则">
            <Input disabled value={profile.accountingStandard} />
          </DrawerFormField>
          <DrawerFormField label="纳税人类型">
            <Input disabled value={profile.taxpayerType} />
          </DrawerFormField>
        </DrawerFormGrid>
      );
    }

    if (actionKey === 'opening-add') {
      return (
        <>
          {openingBalanceSubjectOptions.length === 0 ? (
            <Alert message="可录入期初余额的科目均已有记录，请在列表详情中编辑原记录。" showIcon type="warning" />
          ) : null}
          <OpeningBalanceFormContent
            form={openingBalanceForm}
            subjectOptions={openingBalanceSubjectOptions}
            onChange={onOpeningBalanceFormChange}
          />
        </>
      );
    }

    if (actionKey === 'opening-delete') {
      return (
        <DetailInfoGrid
          columns={2}
          items={[
            { label: '科目', value: openingBalanceTarget ? `${openingBalanceTarget.subjectCode} ${openingBalanceTarget.subjectName}` : '-' },
            { label: '辅助核算', value: openingBalanceTarget?.auxiliaryLabel ?? '-' },
            { label: '期初借方', value: openingBalanceTarget ? formatOpeningAmount(openingBalanceTarget.debitAmount) : '-' },
            { label: '期初贷方', value: openingBalanceTarget ? formatOpeningAmount(openingBalanceTarget.creditAmount) : '-' }
          ]}
        />
      );
    }

    if (actionKey === 'opening-import') {
      return (
        <DrawerFormGrid>
          <DrawerFormField label="导入文件" required wide>
            <Input
              placeholder="例如：2026-06-期初余额导入模板.xlsx"
              value={importFileName}
              onChange={(event) => onImportFileNameChange(event.target.value)}
            />
          </DrawerFormField>
          <DrawerFormField label="导入方式">
            <Input disabled value="先预览，后应用" />
          </DrawerFormField>
          <DrawerFormField label="预览行数">
            <Input disabled value={`${openingWorkspace.importPreviewRows.length} 条`} />
          </DrawerFormField>
        </DrawerFormGrid>
      );
    }

    if (actionKey === 'trial-balance') {
      return (
        <DetailInfoGrid
          columns={2}
          items={[
            { label: '期初借方', value: formatMoney(summary.debitTotal) },
            { label: '期初贷方', value: formatMoney(summary.creditTotal) },
            { label: '试算差额', value: formatMoney(Math.abs(summary.difference)) },
            { label: '试算状态', value: <StatusTag toneMap={trialBalanceTone} value={summary.trialBalanceStatus} /> }
          ]}
        />
      );
    }

    if (actionKey === 'apply-import') {
      return (
        <DetailInfoGrid
          columns={2}
          items={[
            { label: '导入文件', value: openingWorkspace.importBatch?.fileName ?? '-' },
            { label: '预览行数', value: `${openingWorkspace.importPreviewRows.length} 条` },
            { label: '导入状态', value: <StatusTag toneMap={openingBalanceImportStatusTone} value={openingWorkspace.importStatus} /> },
            { label: '应用策略', value: '同科目同辅助核算覆盖' },
            { label: '预览状态', value: <StatusTag toneMap={openingBalancePreviewStatusTone} value={importPreviewStatus} /> }
          ]}
        />
      );
    }

    return <DetailInfoGrid columns={2} items={current.values} />;
  }

  return (
    <DetailDrawerShell
      bodyTestId="finance-ledger-initialization-process-drawer"
      open={Boolean(actionKey)}
      primaryAction={{
        danger: actionKey === 'opening-delete',
        disabled: primaryDisabled,
        icon: current.icon,
        label: current.primaryLabel,
        onClick: () => onSubmit(actionKey)
      }}
      title={
        <DetailDrawerTitle
          status={workspaceMode}
          statusToneMap={ledgerInitializationWorkspaceTone}
          subtitle="系统管理 / 账套初始化"
          title={current.title}
        />
      }
      width={760}
      onClose={onClose}
    >
      <Alert message={current.alert} showIcon type="info" />
      {actionKey !== 'enable-ledger' && effectivePeriodLocked ? (
        <Alert message="启用期间已结账，当前账套初始化只能回看，不能调整草稿内容。" showIcon type="warning" />
      ) : null}
      {actionKey === 'enable-ledger' && effectivePeriodLocked ? (
        <Alert message="启用期间已结账，当前账套初始化只能回看，不能再启用到该期间。" showIcon type="warning" />
      ) : null}
      <DetailSection icon={current.icon} title="处理内容">
        {renderProcessContent()}
      </DetailSection>
    </DetailDrawerShell>
  );
}

function LedgerInitializationControlledActionDrawer({
  action,
  adjustmentForm,
  adjustmentSubjectOptions,
  withdrawForm,
  onAdjustmentFormChange,
  onClose,
  onSubmit,
  onWithdrawFormChange
}: {
  action?: LedgerInitializationControlledAction;
  adjustmentForm: LedgerOpeningAdjustmentForm;
  adjustmentSubjectOptions: Array<{ label: string; value: string }>;
  withdrawForm: LedgerEnableWithdrawForm;
  onAdjustmentFormChange: <K extends keyof LedgerOpeningAdjustmentForm>(key: K, value: LedgerOpeningAdjustmentForm[K]) => void;
  onClose: () => void;
  onSubmit: (actionKey: LedgerInitializationControlledActionKey) => void;
  onWithdrawFormChange: <K extends keyof LedgerEnableWithdrawForm>(key: K, value: LedgerEnableWithdrawForm[K]) => void;
}) {
  if (!action) {
    return null;
  }

  const isWithdraw = action.key === 'withdraw-enable';
  const formIssue = isWithdraw ? getWithdrawFormIssue(withdrawForm) : getOpeningAdjustmentFormIssue(adjustmentForm);
  const canSubmit = action.status === '可发起' && !formIssue;

  return (
    <DetailDrawerShell
      bodyTestId="finance-ledger-initialization-controlled-action-drawer"
      open={Boolean(action)}
      primaryAction={{
        disabled: !canSubmit,
        icon: isWithdraw ? <RollbackOutlined /> : <FileDoneOutlined />,
        label: action.primaryActionLabel,
        onClick: () => onSubmit(action.key)
      }}
      title={
        <DetailDrawerTitle
          status={action.status}
          statusToneMap={controlledActionTone}
          subtitle="系统管理 / 账套初始化"
          title={action.title}
        />
      }
      width={820}
      onClose={onClose}
    >
      <DetailSection icon={isWithdraw ? <RollbackOutlined /> : <FileDoneOutlined />} title="适用场景">
        <DetailInfoGrid columns={1} items={[{ label: '场景', value: action.scenario }]} />
      </DetailSection>

      <DetailSection icon={<EditOutlined />} title={action.status === '可发起' ? '提交内容' : '当前限制'}>
        <div className="ledger-initialization-section-stack">
          {action.status !== '可发起' ? (
            <Alert message="当前账套状态不满足该操作的前置条件，只能查看处理流程。" showIcon type="warning" />
          ) : null}
          {action.status === '可发起' && formIssue ? <Alert message={formIssue} showIcon type="warning" /> : null}
          {action.status === '可发起' && isWithdraw ? (
            <DrawerFormGrid>
              <DrawerFormField label="撤回原因" required wide>
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 5 }}
                  placeholder="说明为什么要撤回本次启用"
                  value={withdrawForm.reason}
                  onChange={(event) => onWithdrawFormChange('reason', event.target.value)}
                />
              </DrawerFormField>
              <DrawerFormField label="影响范围说明" required wide>
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 5 }}
                  placeholder="说明尚未产生凭证、总账记录或期间结账影响"
                  value={withdrawForm.impact}
                  onChange={(event) => onWithdrawFormChange('impact', event.target.value)}
                />
              </DrawerFormField>
            </DrawerFormGrid>
          ) : null}
          {action.status === '可发起' && !isWithdraw ? (
            <DrawerFormGrid>
              <DrawerFormField label="调整科目" required wide>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={adjustmentSubjectOptions}
                  value={adjustmentForm.subjectCode || undefined}
                  onChange={(subjectCode: string) => {
                    const nextSubject = accountingSubjectSeedRows.find((subject) => subject.code === subjectCode);

                    onAdjustmentFormChange('subjectCode', subjectCode);
                    if (nextSubject) {
                      onAdjustmentFormChange('balanceSide', nextSubject.balanceDirection);
                    }
                  }}
                />
              </DrawerFormField>
              <DrawerFormField label="调整方向" required>
                <Select
                  options={[
                    { label: '借方', value: '借方' },
                    { label: '贷方', value: '贷方' }
                  ]}
                  value={adjustmentForm.balanceSide}
                  onChange={(balanceSide: AccountingSubjectBalanceDirection) => onAdjustmentFormChange('balanceSide', balanceSide)}
                />
              </DrawerFormField>
              <DrawerFormField label="调整金额" required>
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  value={adjustmentForm.amount}
                  onChange={(value) => onAdjustmentFormChange('amount', value ?? 0)}
                />
              </DrawerFormField>
              <DrawerFormField label="调整原因" required wide>
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 5 }}
                  placeholder="说明期初差错或调整原因"
                  value={adjustmentForm.reason}
                  onChange={(event) => onAdjustmentFormChange('reason', event.target.value)}
                />
              </DrawerFormField>
              <DrawerFormField label="原始依据" required wide>
                <Input
                  placeholder="例如：期初差错说明、对账记录、原始单据编号"
                  value={adjustmentForm.evidenceName}
                  onChange={(event) => onAdjustmentFormChange('evidenceName', event.target.value)}
                />
              </DrawerFormField>
            </DrawerFormGrid>
          ) : null}
        </div>
      </DetailSection>

      <DetailSection icon={<AuditOutlined />} title="处理流程">
        <DetailInfoGrid
          columns={1}
          items={[
            { label: '前置校验', value: action.prechecks.join(' / ') },
            { label: '提交内容', value: action.materials.join(' / ') },
            { label: '处理结果', value: action.effect.join(' / ') },
            { label: '后续流程', value: action.downstreamSteps.join(' / ') }
          ]}
        />
      </DetailSection>
    </DetailDrawerShell>
  );
}

export function FinanceLedgerInitializationPage() {
  const { message } = AntApp.useApp();
  const { addLedgerOpeningAdjustmentVoucher, getAccountingPeriodGuard, ledgerOpeningAdjustmentRows } = useFinanceManagement();
  const {
    draftImportBatch,
    draftOpeningRows,
    draftOperationRecords,
    draftProfile,
    enabledImportBatch,
    enabledOpeningRows,
    enabledOperationRecords,
    enabledProfile,
    setDraftImportBatch,
    setDraftOpeningRows,
    setDraftOperationRecords,
    setDraftProfile,
    setEnabledImportBatch,
    setEnabledOpeningRows,
    setEnabledOperationRecords,
    setEnabledProfile
  } = useFinanceLedgerInitialization();
  const [workspaceMode, setWorkspaceMode] = useState<LedgerInitializationWorkspaceMode>('初始化草稿');
  const [activeView, setActiveView] = useState<LedgerInitializationStepKey>('basic');
  const [openingBalanceView, setOpeningBalanceView] = useState<OpeningBalanceViewKey>('ledger');
  const [filters, setFilters] = useState<LedgerInitializationFilters>(defaultLedgerInitializationFilters);
  const [activeOpeningMutationId, setActiveOpeningMutationId] = useState<string>();
  const [activeProcessAction, setActiveProcessAction] = useState<LedgerInitializationProcessActionKey>();
  const [activeControlledActionKey, setActiveControlledActionKey] = useState<LedgerInitializationControlledActionKey>();
  const [basicSettingsForm, setBasicSettingsForm] = useState<LedgerInitializationBasicSettingsForm>(() =>
    createBasicSettingsForm(ledgerInitializationDraftProfile)
  );
  const [openingBalanceForm, setOpeningBalanceForm] = useState<LedgerOpeningBalanceManualForm>(() => createDefaultOpeningBalanceForm());
  const [withdrawForm, setWithdrawForm] = useState<LedgerEnableWithdrawForm>(() => createDefaultWithdrawForm());
  const [openingAdjustmentForm, setOpeningAdjustmentForm] = useState<LedgerOpeningAdjustmentForm>(() =>
    createDefaultOpeningAdjustmentForm()
  );
  const [importFileName, setImportFileName] = useState(ledgerOpeningBalanceDraftImportBatch.fileName);

  const activeProfile = workspaceMode === '初始化草稿' ? draftProfile : enabledProfile ?? draftProfile;
  const activeOpeningRows = workspaceMode === '初始化草稿' ? draftOpeningRows : enabledOpeningRows;
  const activeImportBatch = workspaceMode === '初始化草稿' ? draftImportBatch : enabledImportBatch;
  const sourceOperationRecords = workspaceMode === '初始化草稿' ? draftOperationRecords : enabledOperationRecords;
  const activeEffectivePeriodGuard = getAccountingPeriodGuard(activeProfile.effectivePeriod, '处理账套初始化');
  const activeEffectivePeriodLocked = !activeEffectivePeriodGuard.allowed;
  const activeControlContext: LedgerInitializationControlContext =
    workspaceMode === '初始化草稿'
      ? {
          hasGeneralLedgerRead: false,
          periodLocked: activeEffectivePeriodLocked,
          postedVoucherCount: ledgerOpeningAdjustmentRows.length
        }
      : {
          ...ledgerInitializationControlContext,
          periodLocked: activeEffectivePeriodLocked
        };
  const summary = useMemo(
    () => buildLedgerInitializationSummary({ openingBalanceRows: activeOpeningRows, profile: activeProfile }),
    [activeOpeningRows, activeProfile]
  );
  const effectivePeriodReadbackNotice = activeEffectivePeriodLocked
    ? `${activeEffectivePeriodGuard.reason} 当前账套初始化仅用于回看。`
    : undefined;
  const openingWorkspace = useMemo(
    () => buildLedgerOpeningBalanceWorkspace({ importBatch: activeImportBatch, openingBalanceRows: activeOpeningRows, profile: activeProfile }),
    [activeImportBatch, activeOpeningRows, activeProfile]
  );
  const workflowSteps = useMemo(() => buildLedgerInitializationSteps(summary.status), [summary.status]);
  const operationRecords = useMemo(
    () => sourceOperationRecords.map((record) => mapOperationRecord(record, activeProfile.accountSetName)),
    [activeProfile.accountSetName, sourceOperationRecords]
  );
  const controlledActions = useMemo(
    () => buildLedgerInitializationControlledActions({ context: activeControlContext, profile: activeProfile }),
    [activeControlContext, activeProfile]
  );
  const openingRows = useMemo(
    () => activeOpeningRows.filter((record) => matchesLedgerInitializationFilters(record, filters)),
    [activeOpeningRows, filters]
  );
  const occupiedOpeningSubjectCodes = useMemo(() => new Set(activeOpeningRows.map((record) => record.subjectCode)), [activeOpeningRows]);
  const availableOpeningSubjectRows = useMemo(
    () =>
      accountingSubjectSeedRows.filter(
        (subject) => isOpeningBalanceSubjectEligible(subject) && !occupiedOpeningSubjectCodes.has(subject.code)
      ),
    [occupiedOpeningSubjectCodes]
  );
  const availableOpeningSubjectOptions = useMemo(
    () =>
      availableOpeningSubjectRows.map((subject) => ({
        label: `${subject.code} ${subject.name}`,
        value: subject.code
      })),
    [availableOpeningSubjectRows]
  );
  const openingAdjustmentSubjectOptions = useMemo(
    () =>
      getOpeningAdjustmentSubjectRows().map((subject) => ({
        label: `${subject.code} ${subject.name}`,
        value: subject.code
      })),
    []
  );
  const openingBalanceDrawer = useModeDrawerState<LedgerOpeningBalanceRow, LedgerOpeningBalanceManualForm>({
    createForm: () => createDefaultOpeningBalanceForm(availableOpeningSubjectRows),
    detailForm: createOpeningBalanceFormFromRow,
    editForm: createOpeningBalanceFormFromRow
  });
  const activeOpeningMutationRecord = useMemo(
    () => activeOpeningRows.find((record) => record.id === activeOpeningMutationId),
    [activeOpeningMutationId, activeOpeningRows]
  );
  const activeControlledAction = useMemo(
    () => controlledActions.find((action) => action.key === activeControlledActionKey),
    [activeControlledActionKey, controlledActions]
  );

  function openControlledAction(actionKey: LedgerInitializationControlledActionKey) {
    if (actionKey === 'withdraw-enable') {
      setWithdrawForm(createDefaultWithdrawForm());
    } else {
      setOpeningAdjustmentForm(createDefaultOpeningAdjustmentForm());
    }

    setActiveControlledActionKey(actionKey);
  }

  function guardLedgerInitializationDraftMutation(actionLabel: string) {
    const periodGuard = getAccountingPeriodGuard(activeProfile.effectivePeriod, actionLabel);

    if (!periodGuard.allowed) {
      message.warning(periodGuard.reason);
      return false;
    }

    return true;
  }

  function appendDraftOperationRecord(record: LedgerInitializationOperationRecord) {
    setDraftOperationRecords((currentRecords) => [...currentRecords, record]);
  }

  function appendActiveOperationRecord(record: LedgerInitializationOperationRecord) {
    if (workspaceMode === '初始化草稿') {
      appendDraftOperationRecord(record);
      return;
    }

    setEnabledOperationRecords((currentRecords) => [...currentRecords, record]);
  }

  function updateBasicSettingsForm<K extends keyof LedgerInitializationBasicSettingsForm>(
    key: K,
    value: LedgerInitializationBasicSettingsForm[K]
  ) {
    setBasicSettingsForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  function updateWithdrawForm<K extends keyof LedgerEnableWithdrawForm>(key: K, value: LedgerEnableWithdrawForm[K]) {
    setWithdrawForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  function updateOpeningAdjustmentForm<K extends keyof LedgerOpeningAdjustmentForm>(
    key: K,
    value: LedgerOpeningAdjustmentForm[K]
  ) {
    setOpeningAdjustmentForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  function updateOpeningBalanceForm<K extends keyof LedgerOpeningBalanceManualForm>(key: K, value: LedgerOpeningBalanceManualForm[K]) {
    setOpeningBalanceForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  function openProcessAction(actionKey: LedgerInitializationProcessActionKey) {
    if (actionKey !== 'enable-ledger' && !guardLedgerInitializationDraftMutation(ledgerInitializationProcessActionLabels[actionKey])) {
      return;
    }

    if (actionKey === 'basic-settings') {
      setBasicSettingsForm(createBasicSettingsForm(activeProfile));
    }

    if (actionKey === 'opening-add') {
      if (availableOpeningSubjectRows.length === 0) {
        message.info('可录入期初余额的科目均已有记录，请在列表详情中编辑原记录。');
        return;
      }
      setActiveOpeningMutationId(undefined);
      setOpeningBalanceForm(createDefaultOpeningBalanceForm(availableOpeningSubjectRows));
    }

    if (actionKey === 'opening-import') {
      setImportFileName(activeImportBatch?.fileName ?? `${activeProfile.effectivePeriod}-期初余额导入模板.xlsx`);
    }

    setActiveProcessAction(actionKey);
  }

  function openDeleteOpeningBalance(record: LedgerOpeningBalanceRow) {
    if (!guardLedgerInitializationDraftMutation('删除期初余额')) {
      return;
    }

    setActiveOpeningMutationId(record.id);
    setActiveProcessAction('opening-delete');
  }

  function saveBasicSettings() {
    if (!guardLedgerInitializationDraftMutation('保存基础设置')) {
      return;
    }

    const nextProfile: LedgerInitializationProfile = {
      ...draftProfile,
      accountSetName: basicSettingsForm.accountSetName.trim(),
      configuredAt: formatOperationTime(),
      configuredBy: '李明',
      effectivePeriod: basicSettingsForm.effectivePeriod.trim()
    };

    setDraftProfile(nextProfile);
    appendDraftOperationRecord(
      createDraftOperationRecord({
        action: '保存基础设置',
        note: `确认账套名称为 ${nextProfile.accountSetName}，启用期间为 ${nextProfile.effectivePeriod}。`,
        result: nextProfile.status
      })
    );
    setActiveProcessAction(undefined);
    message.success('基础设置已保存');
  }

  function applyOpeningRowsChange(nextRows: LedgerOpeningBalanceRow[], recordedAt = formatOperationTime()) {
    setDraftOpeningRows(nextRows);
    setDraftProfile((currentProfile) => ({
      ...currentProfile,
      openingRecordedAt: nextRows.length > 0 ? recordedAt : '',
      openingRecordedBy: nextRows.length > 0 ? '李明' : '',
      status: nextRows.length > 0 ? '期初已录入' : '科目已确认',
      trialBalancedAt: '',
      trialBalancedBy: ''
    }));
  }

  function persistOpeningBalance({
    form,
    isEdit,
    targetId
  }: {
    form: LedgerOpeningBalanceManualForm;
    isEdit: boolean;
    targetId?: string;
  }) {
    if (!guardLedgerInitializationDraftMutation(isEdit ? '调整期初余额' : '录入期初余额')) {
      return undefined;
    }

    const formIssue = getOpeningBalanceFormIssue(form);

    if (formIssue) {
      message.warning(formIssue);
      return undefined;
    }

    const nextRow = buildManualOpeningBalanceRow({ form, period: draftProfile.effectivePeriod });

    if (!nextRow) {
      message.error('请选择有效会计科目');
      return undefined;
    }

    const duplicateRow = draftOpeningRows.find((row) => row.id !== targetId && row.subjectCode === nextRow.subjectCode);

    if (duplicateRow) {
      message.warning('该科目已有期初余额，请进入原记录详情编辑。');
      return undefined;
    }

    const nextRows = [...draftOpeningRows.filter((row) => row.id !== targetId), nextRow];

    applyOpeningRowsChange(nextRows);
    appendDraftOperationRecord(
      createDraftOperationRecord({
        action: isEdit ? '调整期初余额' : '录入期初余额',
        note: `${isEdit ? '调整' : '录入'} ${nextRow.subjectCode} ${nextRow.subjectName} ${formatMoney(form.amount)}，需要重新试算。`,
        result: '期初已录入'
      })
    );

    return nextRow;
  }

  function saveOpeningBalance() {
    const nextRow = persistOpeningBalance({ form: openingBalanceForm, isEdit: false });

    if (!nextRow) {
      return;
    }

    setOpeningBalanceView('ledger');
    setActiveOpeningMutationId(undefined);
    setActiveProcessAction(undefined);
    message.success('科目余额已录入');
  }

  function saveOpeningBalanceEdit(record: LedgerOpeningBalanceRow, form: LedgerOpeningBalanceManualForm) {
    const nextRow = persistOpeningBalance({ form, isEdit: true, targetId: record.id });

    if (!nextRow) {
      return;
    }

    setOpeningBalanceView('ledger');
    openingBalanceDrawer.openDetail(nextRow);
    message.success('科目余额已调整');
  }

  function deleteOpeningBalance() {
    if (!guardLedgerInitializationDraftMutation('删除期初余额')) {
      return;
    }

    if (!activeOpeningMutationRecord) {
      message.error('请选择要删除的期初余额');
      return;
    }

    const nextRows = draftOpeningRows.filter((row) => row.id !== activeOpeningMutationRecord.id);

    applyOpeningRowsChange(nextRows);
    appendDraftOperationRecord(
      createDraftOperationRecord({
        action: '删除期初余额',
        note: `删除 ${activeOpeningMutationRecord.subjectCode} ${activeOpeningMutationRecord.subjectName}，需要重新试算。`,
        result: nextRows.length > 0 ? '期初已录入' : '科目已确认'
      })
    );
    setOpeningBalanceView('ledger');
    setActiveOpeningMutationId(undefined);
    setActiveProcessAction(undefined);
    openingBalanceDrawer.close();
    message.success('期初余额已删除');
  }

  function importOpeningBalancePreview() {
    if (!guardLedgerInitializationDraftMutation('导入期初余额')) {
      return;
    }

    const importedAt = formatOperationTime();

    setDraftImportBatch({
      fileName: importFileName.trim(),
      id: `ledger-opening-import-${Date.now()}`,
      importedAt,
      importedBy: '李明',
      previewRowCount: openingWorkspace.importPreviewRows.length,
      status: '待应用'
    });
    appendDraftOperationRecord(
      createDraftOperationRecord({
        action: '导入期初余额',
        note: `上传 ${importFileName.trim()} 并生成导入预览。`,
        result: draftProfile.status
      })
    );
    setOpeningBalanceView('import-preview');
    setActiveProcessAction(undefined);
    message.success('已生成导入预览');
  }

  function runTrialBalance() {
    if (!guardLedgerInitializationDraftMutation('执行试算')) {
      return;
    }

    const nextSummary = buildLedgerInitializationSummary({ openingBalanceRows: draftOpeningRows, profile: draftProfile });
    const validation = buildLedgerOpeningBalanceWorkspace({
      importBatch: draftImportBatch,
      openingBalanceRows: draftOpeningRows,
      profile: draftProfile
    }).validation;
    const nextStatus: LedgerInitializationStatus = validation.blockingIssueCount === 0 ? '试算平衡' : '试算不平';

    setDraftProfile((currentProfile) => ({
      ...currentProfile,
      status: nextStatus,
      trialBalancedAt: formatOperationTime(),
      trialBalancedBy: '李明'
    }));
    appendDraftOperationRecord(
      createDraftOperationRecord({
        action: '试算校验',
        note:
          validation.blockingIssueCount === 0
            ? '期初借方合计与贷方合计一致，差额 0.00 元。'
            : `期初余额存在 ${validation.blockingIssueCount} 项阻断校验，试算差额 ${formatMoney(Math.abs(nextSummary.difference))}。`,
        result: nextStatus
      })
    );
    setActiveView('trial-balance');
    setActiveProcessAction(undefined);
    message.success(validation.blockingIssueCount === 0 ? '试算平衡' : '试算不平，请调整期初余额');
  }

  function applyImportPreview() {
    if (!guardLedgerInitializationDraftMutation('应用导入')) {
      return;
    }

    try {
      const nextRows = applyLedgerOpeningBalanceImportPreview({
        currentRows: draftOpeningRows,
        importPreviewRows: openingWorkspace.importPreviewRows,
        profile: draftProfile
      });
      const appliedAt = formatOperationTime();

      applyOpeningRowsChange(nextRows, appliedAt);
      setDraftImportBatch((currentBatch) =>
        currentBatch
          ? {
              ...currentBatch,
              appliedAt,
              appliedBy: '李明',
              status: '已应用'
            }
          : currentBatch
      );
      appendDraftOperationRecord(
        createDraftOperationRecord({
          action: '应用导入',
          note: '将导入预览应用到期初余额草稿，同科目同辅助核算覆盖，需重新试算。',
          result: '期初已录入'
        })
      );
      setOpeningBalanceView('ledger');
      setActiveProcessAction(undefined);
      message.success('导入预览已应用');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '应用导入失败');
    }
  }

  function enableLedger() {
    const periodGuard = getAccountingPeriodGuard(activeProfile.effectivePeriod, '启用账套');

    if (!periodGuard.allowed) {
      message.warning(periodGuard.reason);
      return;
    }

    const enabledAt = formatOperationTime();

    const nextProfile: LedgerInitializationProfile = {
      ...draftProfile,
      enabledAt,
      enabledBy: '李明',
      status: '已启用'
    };
    const operationRecord = createDraftOperationRecord({
      action: '启用账套',
      note: '账套启用后，基础设置和期初余额进入只读锁定状态。',
      result: '已启用'
    });

    setDraftProfile(nextProfile);
    setEnabledProfile(nextProfile);
    setEnabledOpeningRows(draftOpeningRows.map((row) => ({ ...row })));
    setEnabledImportBatch(draftImportBatch ? { ...draftImportBatch } : undefined);
    setDraftOperationRecords((currentRecords) => [...currentRecords, operationRecord]);
    setEnabledOperationRecords((currentRecords) => [...currentRecords.filter((record) => record.result !== '已启用'), operationRecord]);
    setWorkspaceMode('已启用账套');
    setActiveView('enable');
    setActiveProcessAction(undefined);
    message.success('账套已启用');
  }

  function withdrawEnablement() {
    const formIssue = getWithdrawFormIssue(withdrawForm);
    const withdrawAction = controlledActions.find((action) => action.key === 'withdraw-enable');

    if (formIssue) {
      message.warning(formIssue);
      return;
    }

    if (!withdrawAction || withdrawAction.status !== '可发起') {
      message.warning('当前账套不满足撤回启用条件');
      return;
    }

    const nextProfile: LedgerInitializationProfile = {
      ...activeProfile,
      enabledAt: '',
      enabledBy: '',
      status: '试算平衡'
    };
    const operationRecord = createDraftOperationRecord({
      action: '撤回启用',
      note: `撤回原因：${withdrawForm.reason.trim()}；影响范围：${withdrawForm.impact.trim()}。账套回到试算平衡状态。`,
      result: '试算平衡'
    });

    setDraftProfile(nextProfile);
    setEnabledProfile(undefined);
    setDraftOperationRecords((currentRecords) => [...currentRecords, operationRecord]);
    setEnabledOperationRecords((currentRecords) => [...currentRecords, operationRecord]);
    setWorkspaceMode('初始化草稿');
    setActiveControlledActionKey(undefined);
    setWithdrawForm(createDefaultWithdrawForm());
    setActiveView('enable');
    message.success('已撤回启用，账套回到试算平衡');
  }

  function submitOpeningAdjustment() {
    const formIssue = getOpeningAdjustmentFormIssue(openingAdjustmentForm);
    const adjustmentAction = controlledActions.find((action) => action.key === 'opening-adjustment');

    if (formIssue) {
      message.warning(formIssue);
      return;
    }

    if (!adjustmentAction || adjustmentAction.status !== '可发起') {
      message.warning('当前账套不满足期初调整条件');
      return;
    }

    const createdAt = formatOperationTime();
    const nextRecord = buildOpeningAdjustmentVoucherRecord({
      accountingPeriod: activeProfile.effectivePeriod,
      createdAt,
      form: openingAdjustmentForm
    });

    if (!nextRecord) {
      message.error('请选择有效会计科目');
      return;
    }

    const periodGuard = getAccountingPeriodGuard(nextRecord.accountingPeriod, '生成期初调整凭证');

    if (!periodGuard.allowed) {
      message.warning(periodGuard.reason);
      return;
    }

    if (!addLedgerOpeningAdjustmentVoucher(nextRecord)) {
      message.warning('当前会计期间已锁定，不能生成期初调整凭证');
      return;
    }

    appendActiveOperationRecord(
      createDraftOperationRecord({
        action: '期初调整',
        note: `生成期初调整凭证 ${nextRecord.voucherNo}，${nextRecord.subjectCode} ${nextRecord.subjectName} ${nextRecord.balanceSide} ${formatMoney(nextRecord.amount)}，原因：${nextRecord.reason}。`,
        result: '已启用'
      })
    );
    setActiveControlledActionKey(undefined);
    setOpeningAdjustmentForm(createDefaultOpeningAdjustmentForm());
    setActiveView('enable');
    message.success('已生成待记账期初调整凭证');
  }

  function submitControlledAction(actionKey: LedgerInitializationControlledActionKey) {
    if (actionKey === 'withdraw-enable') {
      withdrawEnablement();
      return;
    }

    submitOpeningAdjustment();
  }

  function submitProcessAction(actionKey: LedgerInitializationProcessActionKey) {
    if (workspaceMode !== '初始化草稿' && actionKey !== 'enable-ledger') {
      setActiveProcessAction(undefined);
      return;
    }

    if (actionKey === 'basic-settings') {
      saveBasicSettings();
      return;
    }

    if (actionKey === 'opening-add') {
      saveOpeningBalance();
      return;
    }

    if (actionKey === 'opening-delete') {
      deleteOpeningBalance();
      return;
    }

    if (actionKey === 'opening-import') {
      importOpeningBalancePreview();
      return;
    }

    if (actionKey === 'trial-balance') {
      runTrialBalance();
      return;
    }

    if (actionKey === 'apply-import') {
      applyImportPreview();
      return;
    }

    enableLedger();
  }

  const openingColumns: TableColumnsType<LedgerOpeningBalanceRow> = [
    {
      title: '科目',
      key: 'subject',
      width: 220,
      render: (_, record) => <CellText>{`${record.subjectCode} ${record.subjectName}`}</CellText>
    },
    {
      title: '辅助核算',
      dataIndex: 'auxiliaryLabel',
      width: 120
    },
    {
      title: '类别',
      dataIndex: 'subjectType',
      width: 110,
      render: (subjectType: AccountingSubjectType) => <StatusTag toneMap={accountingSubjectTypeTone} value={subjectType} />
    },
    {
      title: '余额方向',
      dataIndex: 'balanceDirection',
      width: 104,
      render: (direction: AccountingSubjectBalanceDirection) => <StatusTag toneMap={balanceDirectionTone} value={direction} />
    },
    {
      title: '期初借方',
      dataIndex: 'debitAmount',
      width: 130,
      render: (amount: number) => <CellText tone={amount > 0 ? 'income' : 'subtle'}>{formatOpeningAmount(amount)}</CellText>
    },
    {
      title: '期初贷方',
      dataIndex: 'creditAmount',
      width: 130,
      render: (amount: number) => <CellText tone={amount > 0 ? 'expense' : 'subtle'}>{formatOpeningAmount(amount)}</CellText>
    },
    {
      title: '录入方式',
      dataIndex: 'entrySource',
      width: 120,
      render: (entrySource: LedgerOpeningBalanceEntrySource) => renderOpeningBalanceEntrySource(entrySource)
    }
  ];

  const subjectColumns: TableColumnsType<AccountingSubjectRecord> = [
    {
      title: '科目',
      key: 'subject',
      width: 250,
      render: (_, record) => <CompactCell primary={`${record.code} ${record.name}`} secondary={record.reportItem} />
    },
    {
      title: '类别',
      dataIndex: 'type',
      width: 110,
      render: (subjectType: AccountingSubjectType) => <StatusTag toneMap={accountingSubjectTypeTone} value={subjectType} />
    },
    {
      title: '余额方向',
      dataIndex: 'balanceDirection',
      width: 104,
      render: (direction: AccountingSubjectBalanceDirection) => <StatusTag toneMap={balanceDirectionTone} value={direction} />
    },
    {
      title: '报表归属',
      dataIndex: 'statementTarget',
      width: 136,
      render: (statementTarget: AccountingSubjectRecord['statementTarget']) => (
        <StatusTag toneMap={accountingStatementTargetTone} value={statementTarget} />
      )
    },
    {
      title: '辅助核算',
      key: 'auxiliaryScopes',
      width: 160,
      render: (_, record) => record.auxiliaryScopes.join(' / ')
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: AccountingSubjectRecord['status']) => <StatusTag toneMap={accountingSubjectStatusTone} value={status} />
    }
  ];

  const importPreviewColumns: TableColumnsType<LedgerOpeningBalanceImportPreviewRow> = [
    {
      title: '行号',
      dataIndex: 'lineNo',
      width: 84
    },
    {
      title: '科目',
      key: 'subject',
      width: 240,
      render: (_, record) => <CompactCell primary={`${record.subjectCode} ${record.subjectName}`} secondary={record.auxiliaryLabel} />
    },
    {
      title: '余额方向',
      dataIndex: 'balanceDirection',
      width: 104,
      render: (direction: AccountingSubjectBalanceDirection) => <StatusTag toneMap={balanceDirectionTone} value={direction} />
    },
    {
      title: '期初借方',
      dataIndex: 'debitAmount',
      width: 130,
      render: (amount: number) => <CellText tone={amount > 0 ? 'income' : 'subtle'}>{formatOpeningAmount(amount)}</CellText>
    },
    {
      title: '期初贷方',
      dataIndex: 'creditAmount',
      width: 130,
      render: (amount: number) => <CellText tone={amount > 0 ? 'expense' : 'subtle'}>{formatOpeningAmount(amount)}</CellText>
    },
    {
      title: '应用影响',
      dataIndex: 'importImpact',
      width: 110,
      render: (impact: LedgerOpeningBalanceImportImpact) => <StatusTag toneMap={openingBalanceImportImpactTone} value={impact} />
    },
    {
      title: '预览结果',
      key: 'previewStatus',
      width: 220,
      render: (_, record) => (
        <CompactCell
          primary={<StatusTag toneMap={openingBalancePreviewStatusTone} value={record.previewStatus} />}
          secondary={record.previewMessage}
        />
      )
    }
  ];

  const validationColumns: TableColumnsType<LedgerOpeningBalanceValidationItem> = [
    {
      title: '校验项',
      key: 'title',
      width: 220,
      render: (_, record) => <CompactCell primary={record.title} secondary={record.subjectCode ?? '账套期初'} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: LedgerOpeningBalanceValidationItem['status']) => <StatusTag toneMap={openingBalanceValidationStatusTone} value={status} />
    },
    {
      title: '影响',
      key: 'blocking',
      width: 120,
      render: (_, record) => (record.blocking ? <StatusTag tone="red" value="阻断启用" /> : <StatusTag tone="gray" value="非阻断" />)
    },
    {
      title: '说明',
      dataIndex: 'message'
    }
  ];

  const controlledActionColumns: TableColumnsType<LedgerInitializationControlledAction> = [
    {
      title: '处理事项',
      key: 'title',
      width: 180,
      render: (_, record) => <CompactCell primary={record.title} secondary={record.scenario} />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: LedgerInitializationControlledActionStatus) => <StatusTag toneMap={controlledActionTone} value={status} />
    },
    {
      title: '后续流程',
      key: 'downstream',
      render: (_, record) => record.downstreamSteps.join(' / ')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          data-testid={`finance-ledger-initialization-control-action-${record.key}`}
          icon={<FileSearchOutlined />}
          type="link"
          onClick={() => openControlledAction(record.key)}
        >
          {record.status === '可发起' ? '处理' : '查看'}
        </Button>
      )
    }
  ];

  const openingAdjustmentVoucherColumns: TableColumnsType<LedgerOpeningAdjustmentVoucherRecord> = [
    {
      title: '调整凭证',
      key: 'voucher',
      width: 210,
      render: (_, record) => <CompactCell primary={record.voucherNo} secondary={record.createdAt} />
    },
    {
      title: '会计科目',
      key: 'subject',
      width: 230,
      render: (_, record) => <CompactCell primary={`${record.subjectCode} ${record.subjectName}`} secondary={record.evidenceName} />
    },
    {
      title: '方向',
      dataIndex: 'balanceSide',
      width: 96,
      render: (balanceSide: AccountingSubjectBalanceDirection) => <StatusTag toneMap={balanceDirectionTone} value={balanceSide} />
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 140,
      render: (amount: number) => <CellText tone="strong">{formatMoney(amount)}</CellText>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: LedgerOpeningAdjustmentVoucherStatus) => (
        <StatusTag toneMap={openingAdjustmentVoucherStatusTone} value={status} />
      )
    },
    {
      title: '调整原因',
      dataIndex: 'reason'
    }
  ];

  const renderWorkflowContent = () => {
    if (activeView === 'basic') {
      return (
        <DetailSection icon={<ProfileOutlined />} title="基础设置">
          <DetailInfoGrid
            columns={3}
            items={[
              { label: '账套名称', value: activeProfile.accountSetName },
              { label: '会计准则', value: activeProfile.accountingStandard },
              { label: '纳税人类型', value: activeProfile.taxpayerType },
              { label: '记账本位币', value: activeProfile.currency },
              { label: '启用期间', value: activeProfile.effectivePeriod },
              { label: '会计期间', value: activeProfile.periodMode }
            ]}
          />
          <div className="ledger-initialization-action-row">
            <Space wrap>
              <Button
                disabled={summary.isLocked || activeEffectivePeriodLocked}
                icon={<FileDoneOutlined />}
                type="primary"
                onClick={() => openProcessAction('basic-settings')}
              >
                保存基础设置
              </Button>
              {summary.isLocked ? <StatusTag tone="gray" value="已锁定" /> : null}
            </Space>
          </div>
        </DetailSection>
      );
    }

    if (activeView === 'subjects') {
      return (
        <>
          <DetailSection icon={<PartitionOutlined />} title="科目确认">
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '科目体系', value: '小企业会计科目' },
                { label: '数据来源', value: '内置规范科目表' },
                { label: '适用口径', value: `${activeProfile.accountingStandard} / ${activeProfile.taxpayerType}` },
                { label: '启用科目', value: `${summary.enabledSubjectCount} 个` },
                { label: '确认科目', value: `${summary.confirmedSubjectCount} 个` }
              ]}
            />
          </DetailSection>
          <ManagementTable<AccountingSubjectRecord>
            columns={subjectColumns}
            count={{ value: accountingSubjectSeedRows.length, unit: '个科目' }}
            dataSource={accountingSubjectSeedRows}
            rowKey="id"
            rowTestIdPrefix="finance-ledger-initialization-subject-row"
            tableTestId="finance-ledger-initialization-subject-table"
          />
        </>
      );
    }

    if (activeView === 'opening-balances') {
      return (
        <>
          <DetailSection
            extra={
              <Space wrap>
                <Button
                  data-testid="finance-ledger-initialization-add-opening-balance"
                  disabled={activeEffectivePeriodLocked || !openingWorkspace.canEditOpeningBalances || availableOpeningSubjectRows.length === 0}
                  icon={<FileDoneOutlined />}
                  title={availableOpeningSubjectRows.length === 0 ? '可录入期初余额的科目均已有记录' : undefined}
                  type="primary"
                  onClick={() => openProcessAction('opening-add')}
                >
                  新增科目余额
                </Button>
                <Button
                  data-testid="finance-ledger-initialization-import-opening-balance"
                  disabled={activeEffectivePeriodLocked || !openingWorkspace.canImportOpeningBalances}
                  icon={<UploadOutlined />}
                  onClick={() => openProcessAction('opening-import')}
                >
                  导入期初余额
                </Button>
                <Button
                  data-testid="finance-ledger-initialization-apply-import"
                  disabled={activeEffectivePeriodLocked || !openingWorkspace.canApplyImport}
                  icon={<CheckCircleOutlined />}
                  onClick={() => openProcessAction('apply-import')}
                >
                  应用导入
                </Button>
              </Space>
            }
            icon={<BookOutlined />}
            title="期初余额"
          >
            <DetailInfoGrid
              columns={4}
              items={[
                { label: '录入状态', value: <StatusTag toneMap={openingBalanceEntryStatusTone} value={openingWorkspace.entryStatus} /> },
                { label: '导入状态', value: <StatusTag toneMap={openingBalanceImportStatusTone} value={openingWorkspace.importStatus} /> },
                { label: '校验状态', value: <StatusTag toneMap={openingBalanceValidationStatusTone} value={openingWorkspace.validation.status} /> },
                { label: '生效口径', value: '启用后生效' }
              ]}
            />
          </DetailSection>
          <div className="ledger-initialization-subnav">
            <Segmented
              data-testid="finance-ledger-initialization-opening-switch"
              options={openingBalanceViewOptions}
              value={openingBalanceView}
              onChange={(value) => setOpeningBalanceView(value as OpeningBalanceViewKey)}
            />
            {openingBalanceView === 'ledger' ? (
              <div className="ledger-initialization-inline-filters">
                <FilterBar>
                  <FilterField label="科目类别">
                    <Select
                      data-testid="finance-ledger-initialization-subject-type-filter"
                      options={(['全部', ...accountingSubjectTypeOptions] satisfies Array<'全部' | AccountingSubjectType>).map((subjectType) => ({
                        label: subjectType,
                        value: subjectType
                      }))}
                      value={filters.subjectType}
                      onChange={(subjectType) => setFilters((current) => ({ ...current, subjectType }))}
                    />
                  </FilterField>
                  <KeywordFilter
                    data-testid="finance-ledger-initialization-keyword-input"
                    placeholder="科目 / 辅助核算 / 录入方式"
                    value={filters.keyword}
                    width="wide"
                    onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
                  />
                </FilterBar>
              </div>
            ) : null}
          </div>
          {openingBalanceView === 'ledger' ? (
            <ManagementTable<LedgerOpeningBalanceRow>
              columns={openingColumns}
              count={{ value: openingRows.length, unit: '条期初' }}
              dataSource={openingRows}
              rowKey="id"
              rowTestIdPrefix="finance-ledger-initialization-table-row"
              tableTestId="finance-ledger-initialization-table"
              onRowClick={openingBalanceDrawer.openDetail}
            />
          ) : null}
          {openingBalanceView === 'import-preview' ? (
            <ManagementTable<LedgerOpeningBalanceImportPreviewRow>
              columns={importPreviewColumns}
              count={{ value: openingWorkspace.importPreviewRows.length, unit: '条预览' }}
              dataSource={openingWorkspace.importPreviewRows}
              rowKey={(record) => `${record.importBatchId}-${record.lineNo}`}
              rowTestIdPrefix="finance-ledger-initialization-import-row"
              tableTestId="finance-ledger-initialization-import-table"
            />
          ) : null}
          {openingBalanceView === 'validation' ? (
            <ManagementTable<LedgerOpeningBalanceValidationItem>
              columns={validationColumns}
              count={{ value: openingWorkspace.validation.items.length, unit: '项校验' }}
              dataSource={openingWorkspace.validation.items}
              rowKey="id"
              rowTestIdPrefix="finance-ledger-initialization-validation-row"
              tableTestId="finance-ledger-initialization-validation-table"
            />
          ) : null}
        </>
      );
    }

    if (activeView === 'trial-balance') {
      const trialBalanceActionLabel = summary.trialBalanceStatus === '待试算' ? '执行试算' : '重新试算';
      const trialBalanceAlert =
        summary.trialBalanceStatus === '待试算'
          ? {
              message: '期初余额需要执行试算，试算平衡后才能启用账套。',
              type: 'warning' as const
            }
          : summary.trialBalanceStatus === '平衡'
            ? {
                message: '期初借贷已平衡，可以作为启用依据。',
                type: 'success' as const
              }
            : {
                message: '期初借贷不平衡，不能启用账套。',
                type: 'error' as const
              };

      return (
        <DetailSection
          extra={
            <Button
              data-testid="finance-ledger-initialization-trial-balance"
              disabled={activeEffectivePeriodLocked || !openingWorkspace.canRunTrialBalance}
              icon={<AuditOutlined />}
              type="primary"
              onClick={() => openProcessAction('trial-balance')}
            >
              {trialBalanceActionLabel}
            </Button>
          }
          icon={<AuditOutlined />}
          title="试算结果"
        >
          <div className="ledger-initialization-section-stack">
            <DetailSummaryCards
              columns={4}
              items={[
                { icon: <BookOutlined />, key: 'debit', label: '期初借方', value: formatMoney(summary.debitTotal) },
                { icon: <BookOutlined />, key: 'credit', label: '期初贷方', value: formatMoney(summary.creditTotal) },
                { icon: <AuditOutlined />, key: 'diff', label: '试算差额', value: formatMoney(Math.abs(summary.difference)) },
                {
                  icon: <CheckCircleOutlined />,
                  key: 'status',
                  label: '试算状态',
                  value: <StatusTag toneMap={trialBalanceTone} value={summary.trialBalanceStatus} />
                }
              ]}
            />
            <Alert message={trialBalanceAlert.message} showIcon type={trialBalanceAlert.type} />
          </div>
        </DetailSection>
      );
    }

    return (
      <>
        <DetailSection
          extra={
            !summary.isLocked ? (
              <Button
                disabled={!summary.canEnable || openingWorkspace.validation.blockingIssueCount > 0 || activeEffectivePeriodLocked}
                icon={<LockOutlined />}
                type="primary"
                onClick={() => openProcessAction('enable-ledger')}
              >
                启用账套
              </Button>
            ) : null
          }
          icon={summary.isLocked ? <LockOutlined /> : <UnlockOutlined />}
          title={summary.isLocked ? '启用记录' : '启用准备'}
        >
          <DetailSummaryCards
            columns={4}
            items={[
              {
                icon: summary.isLocked ? <LockOutlined /> : <UnlockOutlined />,
                key: 'lock',
                label: '锁定规则',
                value: summary.isLocked ? '已锁定' : '未锁定'
              },
              { icon: <ProfileOutlined />, key: 'enabledBy', label: '启用人', value: activeProfile.enabledBy || '-' },
              { icon: <CheckCircleOutlined />, key: 'enabledAt', label: '启用时间', value: activeProfile.enabledAt || '-' },
              { icon: <FileTextOutlined />, key: 'source', label: '期初来源', value: summary.isLocked ? '账套初始化' : '未生效' }
            ]}
          />
          {effectivePeriodReadbackNotice ? (
            <Alert
              className="finance-period-readback-alert"
              message={effectivePeriodReadbackNotice}
              showIcon
              type="info"
            />
          ) : null}
        </DetailSection>
        <DetailSection icon={<RollbackOutlined />} title="启用后处理">
          <DetailInfoGrid
            columns={4}
            items={[
              { label: '账簿使用', value: activeControlContext.hasGeneralLedgerRead ? '已使用' : '未使用' },
              { label: '调整凭证', value: `${activeControlContext.postedVoucherCount} 张` },
              { label: '期间状态', value: activeControlContext.periodLocked ? '已锁定' : '未锁定' },
              { label: '处理原则', value: '已启用后不直接改期初' }
            ]}
          />
        </DetailSection>
        <ManagementTable<LedgerInitializationControlledAction>
          columns={controlledActionColumns}
          count={{ value: controlledActions.length, unit: '项流程' }}
          dataSource={controlledActions}
          rowKey="key"
          rowTestIdPrefix="finance-ledger-initialization-controlled-row"
          tableTestId="finance-ledger-initialization-controlled-table"
        />
        {ledgerOpeningAdjustmentRows.length > 0 ? (
          <ManagementTable<LedgerOpeningAdjustmentVoucherRecord>
            columns={openingAdjustmentVoucherColumns}
            count={{ value: ledgerOpeningAdjustmentRows.length, unit: '张调整凭证' }}
            dataSource={ledgerOpeningAdjustmentRows}
            rowKey="id"
            rowTestIdPrefix="finance-ledger-initialization-adjustment-row"
            tableTestId="finance-ledger-initialization-adjustment-table"
          />
        ) : null}
        <OperationRecordSection records={operationRecords} scrollX={900} />
      </>
    );
  };

  return (
    <ManagementPageScaffold
      metrics={
        <MetricGrid columns={4} density="compact">
          <MetricCard icon={<ProfileOutlined />} label="启用期间" value={activeProfile.effectivePeriod} />
          <MetricCard
            icon={<CheckCircleOutlined />}
            label="账套状态"
            value={<StatusTag toneMap={ledgerInitializationStatusTone} value={summary.status} />}
          />
          <MetricCard icon={<FileDoneOutlined />} label="流程进度" value={`${summary.completedStepCount}/${summary.requiredStepCount}`} />
          <MetricCard icon={<AuditOutlined />} label="试算差额" value={formatMoney(Math.abs(summary.difference))} />
        </MetricGrid>
      }
      overview={
        <DetailSection
          extra={
            <Segmented
              data-testid="finance-ledger-initialization-workspace-switch"
              options={workspaceModeOptions}
              value={workspaceMode}
              onChange={(value) => {
                setWorkspaceMode(value as LedgerInitializationWorkspaceMode);
                setActiveView('basic');
                setOpeningBalanceView('ledger');
              }}
            />
          }
          icon={<ProfileOutlined />}
          title="账套初始化"
        >
          <div className="ledger-initialization-summary-line">
            <span className="ledger-initialization-summary-item">
              <span className="ledger-initialization-summary-label">当前视图</span>
              <StatusTag toneMap={ledgerInitializationWorkspaceTone} value={workspaceMode} />
            </span>
            <span className="ledger-initialization-summary-item">
              <span className="ledger-initialization-summary-label">账套名称</span>
              <span className="ledger-initialization-summary-value">{activeProfile.accountSetName}</span>
            </span>
            <span className="ledger-initialization-summary-item">
              <span className="ledger-initialization-summary-label">启用期间</span>
              <span className="ledger-initialization-summary-value">{activeProfile.effectivePeriod}</span>
            </span>
            <span className="ledger-initialization-summary-item">
              <span className="ledger-initialization-summary-label">生效状态</span>
              <span className="ledger-initialization-summary-value">{summary.isLocked ? '已启用' : '未启用'}</span>
            </span>
          </div>
          <div className="ledger-initialization-step-strip">
            {workflowSteps.map((step) => (
              <div className="ledger-initialization-step-chip" data-status={step.status} key={step.key}>
                <span className="ledger-initialization-step-dot" />
                <span className="ledger-initialization-step-title">{step.title}</span>
                <StatusTag tone={ledgerInitializationStepTone[step.status]} value={ledgerInitializationStepLabel[step.status]} variant="compact" />
              </div>
            ))}
          </div>
        </DetailSection>
      }
      pageId="system-ledger-initialization"
    >
      <div className="ledger-initialization-primary-tabs">
        <Segmented
          data-testid="finance-ledger-initialization-workflow-switch"
          options={workflowViewOptions}
          value={activeView}
          onChange={(value) => setActiveView(value as LedgerInitializationStepKey)}
        />
      </div>

      {renderWorkflowContent()}

      <OpeningBalanceDrawer
        canEdit={!activeEffectivePeriodLocked && openingWorkspace.canEditOpeningBalances}
        form={openingBalanceDrawer.form}
        mode={openingBalanceDrawer.mode}
        open={openingBalanceDrawer.open}
        record={openingBalanceDrawer.record}
        subjectOptions={availableOpeningSubjectOptions}
        onCancel={openingBalanceDrawer.cancel}
        onClose={openingBalanceDrawer.close}
        onDelete={(record) => {
          openingBalanceDrawer.close();
          openDeleteOpeningBalance(record);
        }}
        onEdit={() => openingBalanceDrawer.openEdit()}
        onFormChange={openingBalanceDrawer.updateForm}
        onSave={saveOpeningBalanceEdit}
      />
      <LedgerInitializationProcessDrawer
        actionKey={activeProcessAction}
        basicSettingsForm={basicSettingsForm}
        importFileName={importFileName}
        openingBalanceForm={openingBalanceForm}
        openingBalanceSubjectOptions={availableOpeningSubjectOptions}
        openingBalanceTarget={activeOpeningMutationRecord}
        openingWorkspace={openingWorkspace}
        profile={activeProfile}
        summary={summary}
        effectivePeriodLocked={activeEffectivePeriodLocked}
        workspaceMode={workspaceMode}
        onBasicSettingsFormChange={updateBasicSettingsForm}
        onClose={() => {
          setActiveOpeningMutationId(undefined);
          setActiveProcessAction(undefined);
        }}
        onImportFileNameChange={setImportFileName}
        onOpeningBalanceFormChange={updateOpeningBalanceForm}
        onSubmit={submitProcessAction}
      />
      <LedgerInitializationControlledActionDrawer
        action={activeControlledAction}
        adjustmentForm={openingAdjustmentForm}
        adjustmentSubjectOptions={openingAdjustmentSubjectOptions}
        withdrawForm={withdrawForm}
        onAdjustmentFormChange={updateOpeningAdjustmentForm}
        onClose={() => setActiveControlledActionKey(undefined)}
        onSubmit={submitControlledAction}
        onWithdrawFormChange={updateWithdrawForm}
      />
    </ManagementPageScaffold>
  );
}
