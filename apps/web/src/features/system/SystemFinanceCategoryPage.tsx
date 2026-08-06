import {
  BankOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  PartitionOutlined,
  PlusOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { Button, Card, Input, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DrawerFormShell, type ModeDrawerState, useModeDrawerState } from '../../components/DrawerForm';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TagChip, TagChipList } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import {
  financeCounterpartyScopeOptions,
  financeDirectionOptions,
  financePaymentMethodOptions,
  financeReportAggregationOptions,
  financeSourceTypeOptions,
  getDefaultAccountingSubjectCodeForPrimary,
  getDefaultAccountingSubjectMappingsForPrimary,
  type FinancePrimaryCategoryFormValue,
  type FinanceSecondaryCategoryFormValue,
  useFinanceCategoryState
} from './FinanceCategoryState';
import {
  financeAccountingSubjectRoleLabels,
  getFinanceCategoryRequiredAccountingRoles,
  type FinanceAccountingSubjectRole,
  type FinanceCategoryStatus,
  type FinancePrimaryCategoryConfig,
  type FinancePaymentMethod,
  type FinanceReportAggregation,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionDirection
} from '../finance/financeData';
import { accountingSubjectSeedRows, getAccountingSubjectByCode } from '../finance/financeAccountingSubjectData';

type FinanceCategoryDrawerContext =
  | {
      id?: string;
      target: 'primary';
    }
  | {
      id?: string;
      initialPrimaryId?: string;
      target: 'secondary';
    };
type FinanceCategoryDrawerFormValue = {
  primary: FinancePrimaryCategoryFormValue;
  secondary: FinanceSecondaryCategoryFormValue;
};

const statusTone = {
  启用: 'green',
  停用: 'gray'
} as const;

const directionTone = {
  收入: 'green',
  支出: 'red',
  内部转入: 'blue'
} as const;

const reportAggregationTone = {
  经营收入: 'green',
  项目成本: 'red',
  人员支出: 'amber',
  运营费用: 'blue',
  其他: 'gray'
} as const;

const defaultPrimaryForm: FinancePrimaryCategoryFormValue = {
  direction: '收入',
  includeInReport: true,
  name: '',
  note: '',
  reportAggregation: '经营收入'
};

const defaultSecondaryForm: FinanceSecondaryCategoryFormValue = {
  accountingSubjectMappings: {
    accrualReceivable: '1122',
    accrualRevenue: '5001',
    cashCredit: '1122',
    cashDebit: '1002',
    outputVatPayable: '2221.01'
  },
  counterpartyScope: '客户',
  defaultAccountingSubjectCode: '1122',
  defaultSourceType: '合同应收',
  includeInReport: true,
  name: '',
  note: '',
  paymentMethods: ['对公账户收款'],
  primaryId: 'finance-primary-customer-income',
  voucherRequirement: ''
};

function buildPrimaryForm(record?: FinancePrimaryCategoryConfig): FinancePrimaryCategoryFormValue {
  if (!record) {
    return { ...defaultPrimaryForm };
  }

  return {
    direction: record.direction,
    includeInReport: record.includeInReport,
    name: record.name,
    note: record.note,
    reportAggregation: record.reportAggregation
  };
}

function buildSecondaryForm(
  record?: FinanceSecondaryCategoryConfig,
  initialPrimaryId?: string,
  primaryRows: FinancePrimaryCategoryConfig[] = []
): FinanceSecondaryCategoryFormValue {
  if (!record) {
    const initialPrimary =
      primaryRows.find((row) => row.id === initialPrimaryId && row.status === '启用') ??
      primaryRows.find((row) => row.id === initialPrimaryId) ??
      primaryRows.find((row) => row.status === '启用') ??
      primaryRows[0];

    if (initialPrimary) {
      return {
        ...defaultSecondaryForm,
        ...getSecondaryDefaultsForPrimary(initialPrimary),
        accountingSubjectMappings: getDefaultAccountingSubjectMappingsForPrimary(initialPrimary),
        paymentMethods: [...getSecondaryDefaultsForPrimary(initialPrimary).paymentMethods]
      };
    }

    return {
      ...defaultSecondaryForm,
      accountingSubjectMappings: { ...defaultSecondaryForm.accountingSubjectMappings },
      paymentMethods: [...defaultSecondaryForm.paymentMethods]
    };
  }

  return {
    accountingSubjectMappings: { ...(record.accountingSubjectMappings ?? {}) },
    counterpartyScope: record.counterpartyScope,
    defaultAccountingSubjectCode: record.defaultAccountingSubjectCode,
    defaultSourceType: record.defaultSourceType,
    includeInReport: record.includeInReport,
    name: record.name,
    note: record.note,
    paymentMethods: [...record.paymentMethods],
    primaryId: record.primaryId,
    voucherRequirement: record.voucherRequirement
  };
}

function getPrimaryFormForDirection(direction: FinanceTransactionDirection): FinancePrimaryCategoryFormValue {
  if (direction === '支出') {
    return {
      ...defaultPrimaryForm,
      direction,
      reportAggregation: '项目成本'
    };
  }

  if (direction === '内部转入') {
    return {
      ...defaultPrimaryForm,
      direction,
      includeInReport: false,
      reportAggregation: '其他'
    };
  }

  return defaultPrimaryForm;
}

function getDefaultPaymentMethods(direction: FinanceTransactionDirection): FinancePaymentMethod[] {
  if (direction === '支出') {
    return ['对公账户付款'];
  }

  if (direction === '内部转入') {
    return ['对公账户收款'];
  }

  return ['对公账户收款'];
}

function getSecondaryDefaultsForPrimary(primary?: FinancePrimaryCategoryConfig): Pick<
  FinanceSecondaryCategoryFormValue,
  'counterpartyScope' | 'defaultAccountingSubjectCode' | 'defaultSourceType' | 'includeInReport' | 'paymentMethods' | 'primaryId'
> {
  if (!primary) {
    return defaultSecondaryForm;
  }

  return {
    counterpartyScope: primary.direction === '收入' ? '客户' : primary.direction === '支出' ? '供应商' : '内部',
    defaultAccountingSubjectCode: getDefaultAccountingSubjectCodeForPrimary(primary),
    defaultSourceType: primary.direction === '收入' ? '合同应收' : primary.direction === '支出' ? '报销单' : '手工登记',
    includeInReport: primary.includeInReport,
    paymentMethods: [...getDefaultPaymentMethods(primary.direction)],
    primaryId: primary.id
  };
}

function buildAccountingRoleMappingItems(
  mappings: FinanceSecondaryCategoryFormValue['accountingSubjectMappings'],
  roles: FinanceAccountingSubjectRole[]
) {
  const mappedItems = roles
    .map((role) => {
      const subjectCode = mappings[role];
      const subject = subjectCode ? getAccountingSubjectByCode(subjectCode) : undefined;

      return {
        label: financeAccountingSubjectRoleLabels[role],
        value: subject ? `${subject.code} ${subject.name}` : '待配置'
      };
    });

  return mappedItems.length > 0
    ? mappedItems
    : [{ label: '映射状态', value: '待配置' }];
}

function FinanceCategoryDrawer({
  drawer,
  primaryRows,
  secondaryRows,
  primaryRecord,
  secondaryRecord,
  onCreatePrimary,
  onCreateSecondary,
  onSavePrimary,
  onSaveSecondary,
  onTogglePrimaryStatus,
  onToggleSecondaryStatus
}: {
  drawer: ModeDrawerState<FinanceCategoryDrawerContext, FinanceCategoryDrawerFormValue>;
  primaryRows: FinancePrimaryCategoryConfig[];
  secondaryRows: FinanceSecondaryCategoryConfig[];
  primaryRecord?: FinancePrimaryCategoryConfig;
  secondaryRecord?: FinanceSecondaryCategoryConfig;
  onCreatePrimary: (nextValue: FinancePrimaryCategoryFormValue) => void;
  onCreateSecondary: (nextValue: FinanceSecondaryCategoryFormValue) => void;
  onSavePrimary: (id: string, nextValue: FinancePrimaryCategoryFormValue) => void;
  onSaveSecondary: (id: string, nextValue: FinanceSecondaryCategoryFormValue) => void;
  onTogglePrimaryStatus: (record: FinancePrimaryCategoryConfig) => void;
  onToggleSecondaryStatus: (record: FinanceSecondaryCategoryConfig) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const mode = drawer.mode ?? 'detail';
  const drawerContext = drawer.record;
  const isCreateMode = mode === 'create';
  const isDetailMode = mode === 'detail';
  const target = drawerContext?.target ?? 'secondary';
  const isPrimaryTarget = target === 'primary';
  const initialSecondaryPrimaryId = drawerContext?.target === 'secondary' ? drawerContext.initialPrimaryId : undefined;
  const primaryForm = isDetailMode && primaryRecord ? buildPrimaryForm(primaryRecord) : drawer.form.primary;
  const secondaryForm = isDetailMode && secondaryRecord
    ? buildSecondaryForm(secondaryRecord, initialSecondaryPrimaryId, primaryRows)
    : drawer.form.secondary;
  const activePrimary = isPrimaryTarget ? primaryRecord : primaryRows.find((row) => row.id === secondaryForm.primaryId);
  const activeStatus = isPrimaryTarget ? (primaryRecord?.status ?? '启用') : (secondaryRecord?.status ?? '启用');
  const activeCode = isPrimaryTarget ? (primaryRecord?.code ?? '保存后生成') : (secondaryRecord?.code ?? '保存后生成');
  const activeAccountingSubject = getAccountingSubjectByCode(secondaryForm.defaultAccountingSubjectCode);
  const primaryHasChildren = Boolean(primaryRecord && secondaryRows.some((row) => row.primaryId === primaryRecord.id));
  const primaryNameLocked = Boolean(primaryRecord && !primaryRecord.id.includes('-custom-'));
  const secondaryNameLocked = Boolean(secondaryRecord && !secondaryRecord.id.includes('-custom-'));
  const requiredAccountingRoles = getFinanceCategoryRequiredAccountingRoles({
    defaultSourceType: secondaryForm.defaultSourceType,
    direction: activePrimary?.direction ?? '支出',
    name: secondaryForm.name
  });
  const accountingSubjectOptions = accountingSubjectSeedRows.map((subject) => ({
    label: `${subject.code} ${subject.name}`,
    value: subject.code
  }));
  const normalizedPrimaryName = primaryForm.name.trim();
  const normalizedSecondaryName = secondaryForm.name.trim();
  const saveDisabled = isPrimaryTarget
    ? !normalizedPrimaryName
    : !normalizedSecondaryName ||
      !secondaryForm.primaryId ||
      !secondaryForm.defaultAccountingSubjectCode ||
      requiredAccountingRoles.some((role) => {
        const subjectCode = secondaryForm.accountingSubjectMappings[role];

        return !subjectCode || !getAccountingSubjectByCode(subjectCode);
      }) ||
      secondaryForm.paymentMethods.length === 0 ||
      !secondaryForm.voucherRequirement.trim();

  function updatePrimaryForm<T extends keyof FinancePrimaryCategoryFormValue>(key: T, value: FinancePrimaryCategoryFormValue[T]) {
    drawer.setForm((currentValue) => ({
      ...currentValue,
      primary: {
        ...currentValue.primary,
        [key]: value
      }
    }));
  }

  function updateSecondaryForm<T extends keyof FinanceSecondaryCategoryFormValue>(key: T, value: FinanceSecondaryCategoryFormValue[T]) {
    drawer.setForm((currentValue) => ({
      ...currentValue,
      secondary: {
        ...currentValue.secondary,
        [key]: value
      }
    }));
  }

  function handlePrimaryDirectionChange(direction: FinanceTransactionDirection) {
    drawer.setForm((currentValue) => ({
      ...currentValue,
      primary: {
        ...currentValue.primary,
        ...getPrimaryFormForDirection(direction),
        name: currentValue.primary.name,
        note: currentValue.primary.note
      }
    }));
  }

  function handleSecondaryPrimaryChange(primaryId: string) {
    const nextPrimary = primaryRows.find((row) => row.id === primaryId);
    drawer.setForm((currentValue) => ({
      ...currentValue,
      secondary: {
        ...currentValue.secondary,
        ...getSecondaryDefaultsForPrimary(nextPrimary),
        accountingSubjectMappings: getDefaultAccountingSubjectMappingsForPrimary(nextPrimary)
      }
    }));
  }

  function normalizePrimaryForm(): FinancePrimaryCategoryFormValue {
    return {
      ...primaryForm,
      name: primaryForm.name.trim(),
      note: primaryForm.note.trim()
    };
  }

  function normalizeSecondaryForm(): FinanceSecondaryCategoryFormValue {
    return {
      ...secondaryForm,
      name: secondaryForm.name.trim(),
      note: secondaryForm.note.trim(),
      voucherRequirement: secondaryForm.voucherRequirement.trim()
    };
  }

  function handleSave() {
    if (isPrimaryTarget) {
      const nextValue = normalizePrimaryForm();

      if (!nextValue.name) {
        void messageApi.warning('请输入一级类目名称');
        return;
      }

      if (primaryRows.some((row) => row.id !== primaryRecord?.id && row.name === nextValue.name)) {
        void messageApi.warning('一级类目名称已存在');
        return;
      }

      if (isCreateMode) {
        onCreatePrimary(nextValue);
        void messageApi.success('一级类目已新增');
        return;
      }

      if (primaryRecord) {
        onSavePrimary(primaryRecord.id, nextValue);
        void messageApi.success('一级类目已保存');
      }

      return;
    }

    const nextValue = normalizeSecondaryForm();

    if (!nextValue.name) {
      void messageApi.warning('请输入二级类目名称');
      return;
    }

    if (!nextValue.primaryId) {
      void messageApi.warning('请选择一级类目');
      return;
    }

    if (nextValue.paymentMethods.length === 0) {
      void messageApi.warning('请至少选择一个适用收付方式');
      return;
    }

    if (!getAccountingSubjectByCode(nextValue.defaultAccountingSubjectCode)) {
      void messageApi.warning('请选择默认会计科目');
      return;
    }

    const missingMappingRole = requiredAccountingRoles.find(
      (role) => {
        const subjectCode = nextValue.accountingSubjectMappings[role];

        return !subjectCode || !getAccountingSubjectByCode(subjectCode);
      }
    );
    if (missingMappingRole) {
      void messageApi.warning(`请选择${financeAccountingSubjectRoleLabels[missingMappingRole]}`);
      return;
    }

    if (!nextValue.voucherRequirement) {
      void messageApi.warning('请输入凭证要求');
      return;
    }

    if (secondaryRows.some((row) => row.id !== secondaryRecord?.id && row.name === nextValue.name)) {
      void messageApi.warning('二级类目名称已存在');
      return;
    }

    if (isCreateMode) {
      onCreateSecondary(nextValue);
      void messageApi.success('二级类目已新增');
      return;
    }

    if (secondaryRecord) {
      onSaveSecondary(secondaryRecord.id, nextValue);
      void messageApi.success('二级类目已保存');
    }
  }

  function getTitle() {
    if (isCreateMode) {
      return isPrimaryTarget ? '新增一级类目' : '新增二级类目';
    }

    if (mode === 'edit') {
      return isPrimaryTarget ? '编辑一级类目' : '编辑二级类目';
    }

    return isPrimaryTarget ? '一级类目详情' : '二级类目详情';
  }

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        className="finance-category-drawer"
        detailActions={
          isDetailMode
            ? {
                closeAction: { label: '关闭', onClick: drawer.close },
                primaryAction: { label: '编辑', onClick: () => drawer.openEdit() },
                secondaryAction: isPrimaryTarget && primaryRecord
                  ? {
                      danger: primaryRecord.status === '启用',
                      label: primaryRecord.status === '启用' ? '停用' : '启用',
                      onClick: () => onTogglePrimaryStatus(primaryRecord)
                    }
                  : !isPrimaryTarget && secondaryRecord
                    ? {
                        danger: secondaryRecord.status === '启用',
                        label: secondaryRecord.status === '启用' ? '停用' : '启用',
                        onClick: () => onToggleSecondaryStatus(secondaryRecord)
                      }
                    : undefined
              }
            : undefined
        }
        formActions={
          !isDetailMode
            ? {
                cancelAction: { label: '取消', onClick: drawer.cancel },
                primaryAction: {
                  disabled: saveDisabled,
                  label: isCreateMode ? '新增类目' : '保存配置',
                  onClick: handleSave
                }
              }
            : undefined
        }
        mode={mode}
        open={drawer.open}
        title={<DetailDrawerTitle status={activeStatus} statusToneMap={statusTone} subtitle="系统管理 / 财务类目" title={getTitle()} />}
        width={820}
        onClose={isDetailMode ? drawer.close : drawer.cancel}
      >
        <DrawerProfileCard
          avatar={(isPrimaryTarget ? primaryForm.name : secondaryForm.name).trim().slice(0, 1) || '财'}
          subtitle={activeCode}
          tags={[
            <StatusTag key="direction" toneMap={directionTone} value={isPrimaryTarget ? primaryForm.direction : (activePrimary?.direction ?? '支出')} />,
            <StatusTag
              key="reportAggregation"
              toneMap={reportAggregationTone}
              value={isPrimaryTarget ? primaryForm.reportAggregation : (activePrimary?.reportAggregation ?? '其他')}
            />
          ]}
          title={(isPrimaryTarget ? primaryForm.name : secondaryForm.name).trim() || '新财务类目'}
        />

        {isPrimaryTarget ? (
          <>
            <DetailSection icon={<PartitionOutlined />} title="一级类目">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    {
                      label: '一级类目名称 *',
                      value: isDetailMode ? (
                        primaryForm.name
                      ) : (
                        <Input
                          disabled={primaryNameLocked}
                          placeholder="例如：客户收入"
                          value={primaryForm.name}
                          onChange={(event) => updatePrimaryForm('name', event.target.value)}
                        />
                      )
                    },
                    { label: '类目编码', value: activeCode },
                    {
                      label: '收支方向',
                      value: isDetailMode ? (
                        <StatusTag toneMap={directionTone} value={primaryForm.direction} />
                      ) : (
                        <Select
                          disabled={primaryHasChildren}
                          options={financeDirectionOptions.map((direction) => ({ label: direction, value: direction }))}
                          value={primaryForm.direction}
                          onChange={handlePrimaryDirectionChange}
                        />
                      )
                    },
                    {
                      label: '统计归集',
                      value: isDetailMode ? (
                        <StatusTag toneMap={reportAggregationTone} value={primaryForm.reportAggregation} />
                      ) : (
                        <Select
                          options={financeReportAggregationOptions.map((aggregation) => ({ label: aggregation, value: aggregation }))}
                          value={primaryForm.reportAggregation}
                          onChange={(value) => updatePrimaryForm('reportAggregation', value)}
                        />
                      )
                    },
                    {
                      label: '进入经营统计',
                      value: isDetailMode ? (
                        primaryForm.includeInReport ? '是' : '否'
                      ) : (
                        <Select
                          options={[
                            { label: '是', value: true },
                            { label: '否', value: false }
                          ]}
                          value={primaryForm.includeInReport}
                          onChange={(value) => updatePrimaryForm('includeInReport', value)}
                        />
                      )
                    },
                    { label: '状态', value: <StatusTag toneMap={statusTone} value={activeStatus} /> }
                  ]}
                />
              </DetailSection>

              <DetailSection icon={<FileProtectOutlined />} title="说明">
                {isDetailMode ? (
                  <div className="task-config-note-text">{primaryForm.note || '暂无说明'}</div>
                ) : (
                  <Input.TextArea
                    autoSize={{ minRows: 3, maxRows: 5 }}
                    placeholder="记录该一级类目的统计边界和使用说明"
                    value={primaryForm.note}
                    onChange={(event) => updatePrimaryForm('note', event.target.value)}
                  />
                )}
              </DetailSection>

            </>
          ) : (
            <>
              <DetailSection icon={<ProfileOutlined />} title="二级类目">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    {
                      label: '二级类目名称 *',
                      value: isDetailMode ? (
                        secondaryForm.name
                      ) : (
                        <Input
                          disabled={secondaryNameLocked}
                          placeholder="例如：客户回款"
                          value={secondaryForm.name}
                          onChange={(event) => updateSecondaryForm('name', event.target.value)}
                        />
                      )
                    },
                    { label: '类目编码', value: activeCode },
                    {
                      label: '所属一级类目',
                      value: isDetailMode ? (
                        activePrimary?.name ?? '-'
                      ) : (
                        <Select
                          disabled={secondaryNameLocked}
                          options={primaryRows
                            .filter((row) => row.status === '启用' || row.id === secondaryForm.primaryId)
                            .map((row) => ({ label: `${row.name} / ${row.direction}`, value: row.id }))}
                          value={secondaryForm.primaryId}
                          onChange={handleSecondaryPrimaryChange}
                        />
                      )
                    },
                    {
                      label: '适用对象',
                      value: isDetailMode ? (
                        secondaryForm.counterpartyScope
                      ) : (
                        <Select
                          options={financeCounterpartyScopeOptions.map((scope) => ({ label: scope, value: scope }))}
                          value={secondaryForm.counterpartyScope}
                          onChange={(value) => updateSecondaryForm('counterpartyScope', value)}
                        />
                      )
                    },
                    {
                      label: '默认会计科目 *',
                      value: isDetailMode ? (
                        activeAccountingSubject ? `${activeAccountingSubject.code} ${activeAccountingSubject.name}` : '-'
                      ) : (
                        <Select
                          options={accountingSubjectOptions}
                          value={secondaryForm.defaultAccountingSubjectCode}
                          onChange={(value) => updateSecondaryForm('defaultAccountingSubjectCode', value)}
                        />
                      )
                    },
                    {
                      label: '适用收付方式 *',
                      value: isDetailMode ? (
                        <TagChipList items={secondaryForm.paymentMethods} maxVisible={5} wrap />
                      ) : (
                        <Select
                          mode="multiple"
                          options={financePaymentMethodOptions.map((method) => ({ label: method, value: method }))}
                          value={secondaryForm.paymentMethods}
                          onChange={(value) => updateSecondaryForm('paymentMethods', value)}
                        />
                      ),
                      wide: true
                    },
                    {
                      label: '默认来源类型',
                      value: isDetailMode ? (
                        secondaryForm.defaultSourceType
                      ) : (
                        <Select
                          options={financeSourceTypeOptions.map((sourceType) => ({ label: sourceType, value: sourceType }))}
                          value={secondaryForm.defaultSourceType}
                          onChange={(value) => updateSecondaryForm('defaultSourceType', value)}
                        />
                      )
                    },
                    {
                      label: '进入经营统计',
                      value: isDetailMode ? (
                        secondaryForm.includeInReport ? '是' : '否'
                      ) : (
                        <Select
                          options={[
                            { label: '是', value: true },
                            { label: '否', value: false }
                          ]}
                          value={secondaryForm.includeInReport}
                          onChange={(value) => updateSecondaryForm('includeInReport', value)}
                        />
                      )
                    },
                    {
                      label: '凭证要求 *',
                      value: isDetailMode ? (
                        secondaryForm.voucherRequirement
                      ) : (
                        <Input placeholder="例如：银行回单、付款截图或发票" value={secondaryForm.voucherRequirement} onChange={(event) => updateSecondaryForm('voucherRequirement', event.target.value)} />
                      ),
                      wide: true
                    }
                  ]}
                />
              </DetailSection>

              <DetailSection icon={<BankOutlined />} title="入账科目">
                {isDetailMode ? (
                  <DetailInfoGrid
                    columns={2}
                    items={buildAccountingRoleMappingItems(
                      secondaryForm.accountingSubjectMappings,
                      requiredAccountingRoles
                    )}
                  />
                ) : (
                  <DetailInfoGrid
                    columns={2}
                    items={requiredAccountingRoles.map((role) => ({
                      label: `${financeAccountingSubjectRoleLabels[role]} *`,
                      value: (
                        <Select
                          options={accountingSubjectOptions}
                          value={secondaryForm.accountingSubjectMappings[role]}
                          onChange={(value) => updateSecondaryForm('accountingSubjectMappings', {
                            ...secondaryForm.accountingSubjectMappings,
                            [role]: value
                          })}
                        />
                      )
                    }))}
                  />
                )}
              </DetailSection>

              <DetailSection icon={<FileProtectOutlined />} title="说明">
                {isDetailMode ? (
                  <div className="task-config-note-text">{secondaryForm.note || '暂无说明'}</div>
                ) : (
                  <Input.TextArea
                    autoSize={{ minRows: 3, maxRows: 5 }}
                    placeholder="记录该二级类目的使用边界和注意事项"
                    value={secondaryForm.note}
                    onChange={(event) => updateSecondaryForm('note', event.target.value)}
                  />
                )}
              </DetailSection>
            </>
          )}
      </DrawerFormShell>
    </>
  );
}

export function SystemFinanceCategoryPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    createPrimaryCategory,
    createSecondaryCategory,
    financePrimaryCategories,
    financeSecondaryCategories,
    updatePrimaryCategory,
    updatePrimaryCategoryStatus,
    updateSecondaryCategory,
    updateSecondaryCategoryStatus
  } = useFinanceCategoryState();
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<'全部' | FinanceCategoryStatus>('全部');
  const [directionFilter, setDirectionFilter] = useState<'全部' | FinanceTransactionDirection>('全部');
  const [aggregationFilter, setAggregationFilter] = useState<'全部' | FinanceReportAggregation>('全部');
  const [keyword, setKeyword] = useState('');
  const financeCategoryDrawer = useModeDrawerState<FinanceCategoryDrawerContext, FinanceCategoryDrawerFormValue>({
    createForm: (context) => ({
      primary: buildPrimaryForm(),
      secondary: buildSecondaryForm(
        undefined,
        context?.target === 'secondary' ? context.initialPrimaryId : undefined,
        financePrimaryCategories
      )
    }),
    detailForm: (context) => ({
      primary: buildPrimaryForm(
        context.target === 'primary' && context.id
          ? financePrimaryCategories.find((row) => row.id === context.id)
          : undefined
      ),
      secondary: buildSecondaryForm(
        context.target === 'secondary' && context.id
          ? financeSecondaryCategories.find((row) => row.id === context.id)
          : undefined,
        context.target === 'secondary' ? context.initialPrimaryId : undefined,
        financePrimaryCategories
      )
    })
  });
  const drawerContext = financeCategoryDrawer.record;

  const activePrimary = drawerContext?.target === 'primary' && drawerContext.id
    ? financePrimaryCategories.find((row) => row.id === drawerContext.id)
    : undefined;
  const activeSecondary = drawerContext?.target === 'secondary' && drawerContext.id
    ? financeSecondaryCategories.find((row) => row.id === drawerContext.id)
    : undefined;
  const enabledPrimaryCount = financePrimaryCategories.filter((row) => row.status === '启用').length;
  const enabledSecondaryCount = financeSecondaryCategories.filter((row) => row.status === '启用').length;
  const mappedSecondaryCount = financeSecondaryCategories.filter((row) => {
    const requiredRoles = getFinanceCategoryRequiredAccountingRoles(row);

    return (
      row.status === '启用' &&
      Boolean(getAccountingSubjectByCode(row.defaultAccountingSubjectCode)) &&
      requiredRoles.length > 0 &&
      requiredRoles.every((role) => {
        const subjectCode = row.accountingSubjectMappings?.[role];

        return Boolean(subjectCode && getAccountingSubjectByCode(subjectCode));
      })
    );
  }).length;

  const filteredSecondaryRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return financeSecondaryCategories.filter((row) => {
      const primary = financePrimaryCategories.find((primaryRow) => primaryRow.id === row.primaryId);
      const matchesStatus = statusFilter === '全部' || row.status === statusFilter;
      const matchesDirection = directionFilter === '全部' || row.direction === directionFilter;
      const matchesAggregation = aggregationFilter === '全部' || row.reportAggregation === aggregationFilter;
      const accountingSubject = getAccountingSubjectByCode(row.defaultAccountingSubjectCode);
      const matchesKeyword =
        !normalizedKeyword ||
        [
          row.name,
          row.code,
          row.note,
          row.voucherRequirement,
          row.reportAggregation,
          primary?.name,
          accountingSubject?.code,
          accountingSubject?.name,
          ...row.paymentMethods
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);

      return matchesStatus && matchesDirection && matchesAggregation && matchesKeyword;
    });
  }, [aggregationFilter, directionFilter, financePrimaryCategories, financeSecondaryCategories, keyword, statusFilter]);

  const filteredPrimaryRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return financePrimaryCategories.filter((row) => {
      const matchesStatus = statusFilter === '全部' || row.status === statusFilter;
      const matchesDirection = directionFilter === '全部' || row.direction === directionFilter;
      const matchesAggregation = aggregationFilter === '全部' || row.reportAggregation === aggregationFilter;
      const relatedSecondaryRows = filteredSecondaryRows.filter((secondaryRow) => secondaryRow.primaryId === row.id);
      const matchesKeyword =
        !normalizedKeyword ||
        [row.name, row.code, row.note, row.reportAggregation].join(' ').toLowerCase().includes(normalizedKeyword) ||
        relatedSecondaryRows.length > 0;

      return matchesStatus && matchesDirection && matchesAggregation && matchesKeyword;
    });
  }, [aggregationFilter, directionFilter, filteredSecondaryRows, financePrimaryCategories, keyword, statusFilter]);

  useEffect(() => {
    if (filteredPrimaryRows.length === 0) {
      setSelectedPrimaryId(undefined);
      return;
    }

    if (!selectedPrimaryId || !filteredPrimaryRows.some((row) => row.id === selectedPrimaryId)) {
      setSelectedPrimaryId(filteredPrimaryRows[0].id);
    }
  }, [filteredPrimaryRows, selectedPrimaryId]);

  const selectedPrimary = selectedPrimaryId ? financePrimaryCategories.find((row) => row.id === selectedPrimaryId) : undefined;
  const visibleSecondaryRows = selectedPrimary ? filteredSecondaryRows.filter((row) => row.primaryId === selectedPrimary.id) : [];

  function openPrimaryCreateDrawer() {
    financeCategoryDrawer.openCreate({ target: 'primary' });
  }

  function openSecondaryCreateDrawer() {
    financeCategoryDrawer.openCreate({
      initialPrimaryId: selectedPrimary?.id,
      target: 'secondary'
    });
  }

  function openPrimaryDetailDrawer(record: FinancePrimaryCategoryConfig) {
    financeCategoryDrawer.openDetail({
      id: record.id,
      target: 'primary'
    });
  }

  function openSecondaryDetailDrawer(record: FinanceSecondaryCategoryConfig) {
    financeCategoryDrawer.openDetail({
      id: record.id,
      target: 'secondary'
    });
  }

  function savePrimaryCategory(id: string, nextValue: FinancePrimaryCategoryFormValue) {
    updatePrimaryCategory(id, nextValue);
    financeCategoryDrawer.openDetail({
      id,
      target: 'primary'
    });
  }

  function saveSecondaryCategory(id: string, nextValue: FinanceSecondaryCategoryFormValue) {
    updateSecondaryCategory(id, nextValue);
    financeCategoryDrawer.openDetail({
      id,
      target: 'secondary'
    });
  }

  function createPrimary(nextValue: FinancePrimaryCategoryFormValue) {
    createPrimaryCategory(nextValue);
    financeCategoryDrawer.close();
  }

  function createSecondary(nextValue: FinanceSecondaryCategoryFormValue) {
    createSecondaryCategory(nextValue);
    financeCategoryDrawer.close();
  }

  function togglePrimaryStatus(record: FinancePrimaryCategoryConfig) {
    const nextStatus: FinanceCategoryStatus = record.status === '启用' ? '停用' : '启用';
    const result = updatePrimaryCategoryStatus(record.id, nextStatus);
    if (!result.success) {
      void messageApi.warning(result.message);
      return;
    }
    void messageApi.success(`${record.name}已${nextStatus}`);
  }

  function toggleSecondaryStatus(record: FinanceSecondaryCategoryConfig) {
    const nextStatus: FinanceCategoryStatus = record.status === '启用' ? '停用' : '启用';
    const result = updateSecondaryCategoryStatus(record.id, nextStatus);
    if (!result.success) {
      void messageApi.warning(result.message);
      return;
    }
    void messageApi.success(`${record.name}已${nextStatus}`);
  }

  const secondaryColumns: TableColumnsType<FinanceSecondaryCategoryConfig> = [
    {
      title: '财务类目',
      key: 'name',
      width: 190,
      render: (_, record) => <CompactCell primary={record.name} />
    },
    {
      title: '适用对象',
      dataIndex: 'counterpartyScope',
      width: 92
    },
    {
      title: '收付方式',
      dataIndex: 'paymentMethods',
      width: 220,
      render: (items: string[]) => <TagChipList items={items} maxVisible={2} wrap />
    },
    {
      title: '默认科目',
      dataIndex: 'defaultAccountingSubjectCode',
      width: 160,
      render: (subjectCode: string) => {
        const subject = getAccountingSubjectByCode(subjectCode);

        return <CompactCell primary={subject ? `${subject.code} ${subject.name}` : '未映射'} secondary={subject?.type ?? '-'} />;
      }
    },
    {
      title: '报表/凭证',
      key: 'report',
      width: 168,
      render: (_, record) => (
        <CompactCell primary={record.includeInReport ? '计入经营统计' : '不计入经营统计'} secondary={record.voucherRequirement} />
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: FinanceCategoryStatus) => <StatusTag toneMap={statusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 104
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<PartitionOutlined />} label="启用一级" value={`${enabledPrimaryCount}/${financePrimaryCategories.length}`} />
          <MetricCard icon={<ProfileOutlined />} label="二级类目" value={financeSecondaryCategories.length} />
          <MetricCard icon={<CheckCircleOutlined />} label="启用二级" value={enabledSecondaryCount} />
          <MetricCard icon={<BankOutlined />} label="科目映射" value={`${mappedSecondaryCount}/${enabledSecondaryCount}`} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="状态">
              <Select
                data-testid="system-finance-category-status-filter"
                options={(['全部', '启用', '停用'] satisfies Array<'全部' | FinanceCategoryStatus>).map((status) => ({ label: status, value: status }))}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </FilterField>
            <FilterField label="收支方向">
              <Select
                data-testid="system-finance-category-direction-filter"
                options={(['全部', ...financeDirectionOptions] satisfies Array<'全部' | FinanceTransactionDirection>).map((direction) => ({
                  label: direction,
                  value: direction
                }))}
                value={directionFilter}
                onChange={setDirectionFilter}
              />
            </FilterField>
            <FilterField label="统计归集">
              <Select
                data-testid="system-finance-category-report-filter"
                options={(['全部', ...financeReportAggregationOptions] satisfies Array<'全部' | FinanceReportAggregation>).map((aggregation) => ({
                  label: aggregation,
                  value: aggregation
                }))}
                value={aggregationFilter}
                onChange={setAggregationFilter}
              />
            </FilterField>
            <KeywordFilter
              data-testid="system-finance-category-keyword-input"
              placeholder="类目 / 编码 / 凭证"
              value={keyword}
              width="wide"
              onChange={setKeyword}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <section className="finance-category-master-detail" data-testid="system-finance-category-master-detail">
        <Card
          className="finance-category-panel finance-category-primary-panel"
          variant="borderless"
          title={
            <div className="finance-category-panel-title">
              <span>一级类目</span>
              <CellText tone="subtle">共 {filteredPrimaryRows.length} 个</CellText>
            </div>
          }
          extra={
            <Button data-testid="system-finance-primary-category-create-button" icon={<PlusOutlined />} size="small" type="primary" onClick={openPrimaryCreateDrawer}>
              新增
            </Button>
          }
        >
          <div className="finance-primary-category-list" data-testid="system-finance-primary-category-list">
            {filteredPrimaryRows.map((record) => {
              const secondaryCount = financeSecondaryCategories.filter((row) => row.primaryId === record.id).length;
              const enabledSecondaryForPrimary = financeSecondaryCategories.filter((row) => row.primaryId === record.id && row.status === '启用').length;
              const isSelected = record.id === selectedPrimary?.id;

              return (
                <button
                  className="finance-primary-category-item"
                  data-selected={isSelected}
                  data-testid={`system-finance-primary-category-card-${record.id}`}
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedPrimaryId(record.id)}
                  onDoubleClick={() => openPrimaryDetailDrawer(record)}
                >
                  <span className="finance-primary-category-main">
                    <span className="finance-primary-category-title-row">
                      <span className="finance-primary-category-name">{record.name}</span>
                      <TagChip label={record.direction} tone={directionTone[record.direction]} variant="finance-direction" />
                      {record.status === '停用' ? <TagChip label="停用" tone="gray" variant="finance-direction" /> : null}
                    </span>
                    <span className="finance-primary-category-sub">{record.reportAggregation} / {record.includeInReport ? '计入统计' : '不计入统计'}</span>
                  </span>
                  <span className="finance-primary-category-count">
                    <span>二级 {enabledSecondaryForPrimary}/{secondaryCount}</span>
                  </span>
                </button>
              );
            })}
            {filteredPrimaryRows.length === 0 ? (
              <div className="finance-category-empty">暂无符合条件的一级类目</div>
            ) : null}
          </div>
        </Card>

        <Card
          className="finance-category-panel finance-category-secondary-panel"
          variant="borderless"
          title={
            <div className="finance-category-panel-title">
              <span>{selectedPrimary?.name ?? '二级类目'}</span>
              <CellText tone="subtle">
                {selectedPrimary ? `${selectedPrimary.direction} / ${selectedPrimary.reportAggregation}` : '请选择一级类目'}
              </CellText>
            </div>
          }
          extra={
            <Button
              data-testid="system-finance-secondary-category-create-button"
              disabled={!selectedPrimary || selectedPrimary.status !== '启用'}
              icon={<PlusOutlined />}
              size="small"
              type="primary"
              onClick={openSecondaryCreateDrawer}
            >
              新增二级
            </Button>
          }
        >
          {selectedPrimary?.status === '停用' ? (
            <div className="finance-category-disabled-note">该一级类目已停用，不能新增二级类目；已有二级类目仍可查看或停用。</div>
          ) : null}
          <ManagementTable<FinanceSecondaryCategoryConfig>
            columns={secondaryColumns}
            dataSource={visibleSecondaryRows}
            rowKey="id"
            rowTestIdPrefix="system-finance-secondary-category-row"
            tableTestId="system-finance-secondary-category-table"
            onRowClick={openSecondaryDetailDrawer}
          />
        </Card>
      </section>

      <FinanceCategoryDrawer
        drawer={financeCategoryDrawer}
        primaryRecord={activePrimary}
        primaryRows={financePrimaryCategories}
        secondaryRecord={activeSecondary}
        secondaryRows={financeSecondaryCategories}
        onCreatePrimary={createPrimary}
        onCreateSecondary={createSecondary}
        onSavePrimary={savePrimaryCategory}
        onSaveSecondary={saveSecondaryCategory}
        onTogglePrimaryStatus={togglePrimaryStatus}
        onToggleSecondaryStatus={toggleSecondaryStatus}
      />
    </ManagementPageScaffold>
  );
}
