import {
  CalculatorOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  PlusOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Input, InputNumber, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormShell, useModeDrawerState, type ModeDrawerState } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { CellText, CompactCell } from '../../components/TableCell';
import {
  formatSocialInsuranceBase,
  formatSocialInsuranceRate,
  getActivePolicyByConfigType,
  getPolicyCategoryRateTotal,
  getPolicyContributionAmounts,
  socialInsuranceDefaultHousingFundRateRange,
  socialInsurancePolicyItemStatusTone,
  socialInsurancePolicyConfigTypeTone,
  socialInsurancePolicyStatusTone,
  type SocialInsurancePolicyItem,
  type SocialInsurancePolicyItemStatus,
  type SocialInsurancePolicyConfigType,
  type SocialInsurancePolicyStatus,
  type SocialInsurancePolicyVersion
} from './socialInsurancePolicyData';
import {
  socialInsurancePolicyConfigToday,
  useSocialInsurancePolicyConfigState
} from './SocialInsurancePolicyConfigState';

type SocialInsurancePolicyStatusFilter = '全部' | SocialInsurancePolicyStatus;
type SocialInsurancePolicyConfigTypeFilter = '全部' | SocialInsurancePolicyConfigType;

type SocialInsurancePolicyFilters = {
  configType: SocialInsurancePolicyConfigTypeFilter;
  keyword: string;
  status: SocialInsurancePolicyStatusFilter;
};

const defaultFilters: SocialInsurancePolicyFilters = {
  configType: '全部',
  keyword: '',
  status: '全部'
};

const previewContributionBase = 10000;
const payrollBaseSourceOptions = ['人员薪资基数'];

type PolicyFormItem = {
  companyRatePercent: number;
  employeeRatePercent: number;
  id: string;
  name: string;
  status: SocialInsurancePolicyItemStatus;
};

type SocialInsurancePolicyFormValue = {
  configType: SocialInsurancePolicyConfigType;
  effectiveMonth: string;
  housingFundBaseLower: number;
  housingFundRatePercent: number;
  payrollBaseSource: string;
  socialItems: PolicyFormItem[];
  sourcePolicyId: string;
  version: string;
};

function getLatestPolicyUpdate(policy: SocialInsurancePolicyVersion) {
  return policy.operationRecords[0]?.time ?? '-';
}

function getPolicyStatusSortRank(status: SocialInsurancePolicyStatus) {
  const rankMap = {
    启用: 0,
    草稿: 1,
    历史: 2
  } as const satisfies Record<SocialInsurancePolicyStatus, number>;

  return rankMap[status];
}

function getPolicyConfigTypeSortRank(configType: SocialInsurancePolicyConfigType) {
  const rankMap = {
    社保配置: 0,
    公积金配置: 1
  } as const satisfies Record<SocialInsurancePolicyConfigType, number>;

  return rankMap[configType];
}

function getPolicyVersionNumber(version: string) {
  const match = /^V(\d+)$/i.exec(version.trim());
  return match ? Number(match[1]) : 0;
}

function sortPolicyRows(rows: SocialInsurancePolicyVersion[]) {
  return [...rows].sort(
    (left, right) =>
      getPolicyStatusSortRank(left.status) - getPolicyStatusSortRank(right.status) ||
      getPolicyConfigTypeSortRank(left.configType) - getPolicyConfigTypeSortRank(right.configType) ||
      getPolicyVersionNumber(right.version) - getPolicyVersionNumber(left.version)
  );
}

function getHousingFundItem(policy: SocialInsurancePolicyVersion) {
  return policy.socialItems.find((item) => item.category === '公积金');
}

function formatPolicyRateRange([lowerRate, upperRate]: [number, number]) {
  return `${formatSocialInsuranceRate(lowerRate)} - ${formatSocialInsuranceRate(upperRate)}`;
}

function getEnabledSocialItemCount(policy: SocialInsurancePolicyVersion) {
  return policy.socialItems.filter((item) => item.category === '社保' && item.status === '启用').length;
}

function getSocialItems(policy: SocialInsurancePolicyVersion) {
  return policy.socialItems.filter((item) => item.category === '社保');
}

function getNextPolicyVersion(policyRows: SocialInsurancePolicyVersion[], configType: SocialInsurancePolicyConfigType) {
  const maxVersion = policyRows.filter((policy) => policy.configType === configType).reduce((maxValue, policy) => {
    const match = /^V(\d+)$/i.exec(policy.version.trim());
    return match ? Math.max(maxValue, Number(match[1])) : maxValue;
  }, 0);

  return `V${maxVersion + 1}`;
}

function getNextEffectiveMonth(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) {
    return month;
  }

  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextYear = monthNumber === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

function toPercent(rate: number) {
  return Math.round(rate * 100000) / 1000;
}

function toRate(percent: number) {
  return Math.round(percent * 1000) / 100000;
}

function normalizePolicyVersion(version: string) {
  const trimmed = version.trim().toUpperCase();
  return trimmed.startsWith('V') ? trimmed : `V${trimmed}`;
}

function getInputNumberValue(value: number | string | null) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPolicyForm(
  sourcePolicy: SocialInsurancePolicyVersion,
  policyRows: SocialInsurancePolicyVersion[]
): SocialInsurancePolicyFormValue {
  const housingFundItem = getHousingFundItem(sourcePolicy);

  return {
    configType: sourcePolicy.configType,
    effectiveMonth: getNextEffectiveMonth(sourcePolicy.effectiveMonth),
    housingFundBaseLower: housingFundItem?.baseLower ?? 0,
    housingFundRatePercent: toPercent(housingFundItem?.companyRate ?? 0.1),
    payrollBaseSource: sourcePolicy.payrollBaseSource,
    socialItems: getSocialItems(sourcePolicy).map((item) => ({
      companyRatePercent: toPercent(item.companyRate),
      employeeRatePercent: toPercent(item.employeeRate),
      id: item.id,
      name: item.name,
      status: item.status
    })),
    sourcePolicyId: sourcePolicy.id,
    version: getNextPolicyVersion(policyRows, sourcePolicy.configType)
  };
}

function isValidPolicyForm(form: SocialInsurancePolicyFormValue) {
  const baseValid =
    /^V\d+$/i.test(normalizePolicyVersion(form.version)) &&
    /^\d{4}-\d{2}$/.test(form.effectiveMonth) &&
    Boolean(form.payrollBaseSource.trim());

  if (form.configType === '公积金配置') {
    return baseValid && form.housingFundRatePercent > 0 && form.housingFundBaseLower > 0;
  }

  return baseValid && form.socialItems.length > 0 && form.socialItems.every((item) => item.companyRatePercent >= 0 && item.employeeRatePercent >= 0);
}

function buildPolicyFromForm(
  form: SocialInsurancePolicyFormValue,
  sourcePolicy: SocialInsurancePolicyVersion,
  policyRows: SocialInsurancePolicyVersion[]
): SocialInsurancePolicyVersion {
  const version = normalizePolicyVersion(form.version);
  const sameTypeRows = policyRows.filter((policy) => policy.configType === form.configType);
  const sequence = sameTypeRows.length + 1;
  const housingFundSource = getHousingFundItem(sourcePolicy);
  const housingFundRate = toRate(form.housingFundRatePercent);
  const codePrefix = form.configType === '社保配置' ? 'WUHAN-SI' : 'WUHAN-HF';
  const name = form.configType === '社保配置' ? `武汉社保配置${version}` : `武汉公积金配置${version}`;
  const socialItems =
    form.configType === '社保配置'
      ? form.socialItems.map((item) => ({
          ...sourcePolicy.socialItems.find((sourceItem) => sourceItem.id === item.id),
          category: '社保' as const,
          companyRate: toRate(item.companyRatePercent),
          employeeRate: toRate(item.employeeRatePercent),
          id: `${item.id}-${version.toLowerCase()}`,
          name: item.name,
          status: item.status
        }))
      : [
          {
            ...housingFundSource,
            baseLower: form.housingFundBaseLower,
            category: '公积金' as const,
            companyRate: housingFundRate,
            employeeRate: housingFundRate,
            id: `wuhan-housing-fund-${version.toLowerCase()}`,
            name: housingFundSource?.name ?? '住房公积金',
            status: housingFundSource?.status ?? '启用'
          }
        ];

  return {
    ...sourcePolicy,
    code: `${codePrefix}-${form.effectiveMonth}-${version}`,
    configType: form.configType,
    effectiveMonth: form.effectiveMonth,
    id: `${codePrefix.toLowerCase()}-${form.effectiveMonth}-${version.toLowerCase()}-${sequence}`,
    name,
    operationRecords: [
      {
        action: '新增草稿',
        actor: '李明',
        id: `op-${codePrefix.toLowerCase()}-${sequence}`,
        object: name,
        summary: `复制当前${form.configType}后新增草稿`,
        time: `${socialInsurancePolicyConfigToday} 10:30`
      }
    ],
    payrollBaseSource: form.payrollBaseSource.trim(),
    socialItems,
    status: '草稿',
    version
  };
}

function getFormContributionAmounts(form: SocialInsurancePolicyFormValue, category: '社保' | '公积金') {
  if (category === '公积金') {
    const amount = previewContributionBase * toRate(form.housingFundRatePercent);

    return {
      companyAmount: Math.round(amount * 100) / 100,
      personalAmount: Math.round(amount * 100) / 100
    };
  }

  const companyAmount = form.socialItems.reduce((total, item) => total + previewContributionBase * toRate(item.companyRatePercent), 0);
  const personalAmount = form.socialItems.reduce((total, item) => total + previewContributionBase * toRate(item.employeeRatePercent), 0);

  return {
    companyAmount: Math.round(companyAmount * 100) / 100,
    personalAmount: Math.round(personalAmount * 100) / 100
  };
}

function matchesFilters(policy: SocialInsurancePolicyVersion, filters: SocialInsurancePolicyFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (filters.configType !== '全部' && policy.configType !== filters.configType) {
    return false;
  }

  if (filters.status !== '全部' && policy.status !== filters.status) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [
    policy.name,
    policy.code,
    policy.configType,
    policy.version,
    policy.province,
    policy.city,
    policy.effectiveMonth,
    policy.contributionCycle,
    policy.payrollBaseSource
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function PolicyVersionCell({ record }: { record: SocialInsurancePolicyVersion }) {
  return <CompactCell primary={record.name} secondary={`${record.province}${record.city} / ${record.code}`} />;
}

function SystemSocialInsuranceConfigCreateDrawer({
  drawer,
  onCreate,
  policyRows
}: {
  drawer: ModeDrawerState<string, SocialInsurancePolicyFormValue>;
  onCreate: (activate: boolean) => void;
  policyRows: SocialInsurancePolicyVersion[];
}) {
  const formSocialPreview = getFormContributionAmounts(drawer.form, '社保');
  const formHousingPreview = getFormContributionAmounts(drawer.form, '公积金');
  const formDisabled = !isValidPolicyForm(drawer.form);
  const sourcePolicy = getActivePolicyByConfigType(policyRows, drawer.form.configType);

  function updateForm<T extends keyof SocialInsurancePolicyFormValue>(key: T, value: SocialInsurancePolicyFormValue[T]) {
    drawer.updateForm(key, value);
  }

  function updateConfigType(configType: SocialInsurancePolicyConfigType) {
    drawer.setForm(buildPolicyForm(getActivePolicyByConfigType(policyRows, configType), policyRows));
  }

  function updateSocialItem(id: string, key: 'companyRatePercent' | 'employeeRatePercent', value: number | string | null) {
    drawer.setForm((currentForm) => ({
      ...currentForm,
      socialItems: currentForm.socialItems.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: getInputNumberValue(value)
            }
          : item
      )
    }));
  }

  const formItemColumns: TableColumnsType<PolicyFormItem> = [
    {
      title: '项目',
      key: 'name',
      width: 150,
      render: (_, record) => <CompactCell primary={record.name} secondary="社保" />
    },
    {
      title: '单位承担',
      key: 'companyRatePercent',
      width: 130,
      render: (_, record) => (
        <InputNumber
          min={0}
          precision={3}
          style={{ width: '100%' }}
          suffix="%"
          value={record.companyRatePercent}
          onChange={(value) => updateSocialItem(record.id, 'companyRatePercent', value)}
        />
      )
    },
    {
      title: '个人承担',
      key: 'employeeRatePercent',
      width: 130,
      render: (_, record) => (
        <InputNumber
          min={0}
          precision={3}
          style={{ width: '100%' }}
          suffix="%"
          value={record.employeeRatePercent}
          onChange={(value) => updateSocialItem(record.id, 'employeeRatePercent', value)}
        />
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: SocialInsurancePolicyItemStatus) => <StatusTag toneMap={socialInsurancePolicyItemStatusTone} value={status} />
    }
  ];

  return (
    <DrawerFormShell
      bodyTestId="system-social-insurance-config-create"
      className="system-social-insurance-config-drawer"
      formActions={{
        cancelAction: { label: '取消', onClick: drawer.cancel },
        primaryAction: {
          disabled: formDisabled,
          label: '保存并启用',
          onClick: () => onCreate(true)
        },
        secondaryAction: {
          disabled: formDisabled,
          label: '保存草稿',
          onClick: () => onCreate(false)
        }
      }}
      mode={drawer.mode}
      open={drawer.isCreateMode}
      title={
        <DetailDrawerTitle
          status="草稿"
          statusToneMap={socialInsurancePolicyStatusTone}
          subtitle="系统管理 / 社保公积金配置"
          title="新增配置版本"
        />
      }
      width={980}
      onClose={drawer.cancel}
    >
      <DetailTabs
        items={[
          {
            key: 'base',
            label: '基础配置',
            children: (
              <DetailSection icon={<FileTextOutlined />} title="基础配置">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    {
                      label: '配置类型 *',
                      value: (
                        <Select
                          options={(['社保配置', '公积金配置'] as SocialInsurancePolicyConfigType[]).map((configType) => ({
                            label: configType,
                            value: configType
                          }))}
                          value={drawer.form.configType}
                          onChange={updateConfigType}
                        />
                      )
                    },
                    { label: '生成方式', value: '复制当前启用版本' },
                    { label: '当前启用', value: sourcePolicy.version },
                    {
                      label: '同类版本',
                      value: `${policyRows.filter((policy) => policy.configType === drawer.form.configType).length} 个`
                    },
                    {
                      label: '版本 *',
                      value: <Input value={drawer.form.version} onChange={(event) => updateForm('version', event.target.value)} />
                    },
                    {
                      label: '生效月份 *',
                      value: (
                        <Input
                          placeholder="例如：2026-07"
                          value={drawer.form.effectiveMonth}
                          onChange={(event) => updateForm('effectiveMonth', event.target.value)}
                        />
                      )
                    },
                    {
                      label: '基数来源 *',
                      value: (
                        <Select
                          options={payrollBaseSourceOptions.map((source) => ({ label: source, value: source }))}
                          value={drawer.form.payrollBaseSource}
                          onChange={(value) => updateForm('payrollBaseSource', value)}
                        />
                      )
                    }
                  ]}
                />
              </DetailSection>
            )
          },
          ...(drawer.form.configType === '社保配置'
            ? [
                {
                  key: 'social',
                  label: '社保参数',
                  children: (
                    <DetailSection icon={<WalletOutlined />} title="社保参数">
                      <CompactDetailTable<PolicyFormItem>
                        columns={formItemColumns}
                        dataSource={drawer.form.socialItems}
                        rowKey="id"
                        scrollX={false}
                      />
                    </DetailSection>
                  )
                }
              ]
            : [
                {
                  key: 'housing',
                  label: '公积金参数',
                  children: (
                    <DetailSection icon={<CalculatorOutlined />} title="公积金参数">
                      <DetailInfoGrid
                        columns={2}
                        items={[
                          {
                            label: '单位/个人比例 *',
                            value: (
                              <InputNumber
                                min={0}
                                precision={3}
                                style={{ width: '100%' }}
                                suffix="%"
                                value={drawer.form.housingFundRatePercent}
                                onChange={(value) => updateForm('housingFundRatePercent', getInputNumberValue(value))}
                              />
                            )
                          },
                          {
                            label: '缴存基数下限 *',
                            value: (
                              <InputNumber
                                min={0}
                                precision={2}
                                style={{ width: '100%' }}
                                suffix="元"
                                value={drawer.form.housingFundBaseLower}
                                onChange={(value) => updateForm('housingFundBaseLower', getInputNumberValue(value))}
                              />
                            )
                          },
                          { label: '比例范围', value: formatPolicyRateRange(sourcePolicy.housingFundRateRange ?? socialInsuranceDefaultHousingFundRateRange) },
                          { label: '单位个人比例', value: '一致' }
                        ]}
                      />
                    </DetailSection>
                  )
                }
              ]),
          {
            key: 'preview',
            label: '计算预览',
            children: (
              <DetailSection icon={<CalculatorOutlined />} title="计算预览">
                <DetailInfoGrid
                  columns={3}
                  items={
                    drawer.form.configType === '社保配置'
                      ? [
                          { label: '预览基数', value: `${previewContributionBase.toLocaleString('zh-CN')} 元` },
                          { label: '社保单位承担', value: `${formSocialPreview.companyAmount.toLocaleString('zh-CN')} 元` },
                          { label: '社保个人承担', value: `${formSocialPreview.personalAmount.toLocaleString('zh-CN')} 元` }
                        ]
                      : [
                          { label: '预览基数', value: `${previewContributionBase.toLocaleString('zh-CN')} 元` },
                          { label: '公积金单位承担', value: `${formHousingPreview.companyAmount.toLocaleString('zh-CN')} 元` },
                          { label: '公积金个人承担', value: `${formHousingPreview.personalAmount.toLocaleString('zh-CN')} 元` }
                        ]
                  }
                />
              </DetailSection>
            )
          }
        ]}
        tabTestIdPrefix="system-social-insurance-config-create-tab"
        testId="system-social-insurance-config-create-tabs"
      />
    </DrawerFormShell>
  );
}

function SystemSocialInsuranceConfigDrawer({
  open,
  onDeleteDraft,
  onEnable,
  policy,
  onClose
}: {
  open: boolean;
  onDeleteDraft: (policy: SocialInsurancePolicyVersion) => void;
  onEnable: (policy: SocialInsurancePolicyVersion) => void;
  policy?: SocialInsurancePolicyVersion;
  onClose: () => void;
}) {
  if (!policy) {
    return null;
  }

  const socialItems = policy.socialItems.filter((item) => item.category === '社保');
  const housingFundItem = getHousingFundItem(policy);
  const socialRateTotal = getPolicyCategoryRateTotal(policy, '社保');
  const socialPreviewAmounts = getPolicyContributionAmounts(policy, '社保', previewContributionBase);
  const housingFundPreviewAmounts = getPolicyContributionAmounts(policy, '公积金', previewContributionBase);
  const isSocialConfig = policy.configType === '社保配置';

  const socialItemColumns: TableColumnsType<SocialInsurancePolicyItem> = [
    {
      title: '项目',
      dataIndex: 'name',
      width: 140
    },
    {
      title: '缴纳基数',
      key: 'base',
      width: 220,
      render: (_, record) => <CellText>{formatSocialInsuranceBase(record.baseLower, record.baseUpper, record.baseUpperRule)}</CellText>
    },
    {
      title: '单位承担',
      dataIndex: 'companyRate',
      width: 120,
      render: (rate: number, record) => (
        <CellText>{record.companyFixedAmount ? `${formatSocialInsuranceRate(rate)} + ${record.companyFixedAmount} 元` : formatSocialInsuranceRate(rate)}</CellText>
      )
    },
    {
      title: '个人承担',
      dataIndex: 'employeeRate',
      width: 120,
      render: (rate: number, record) => (
        <CellText>{record.employeeFixedAmount ? `${formatSocialInsuranceRate(rate)} + ${record.employeeFixedAmount} 元` : formatSocialInsuranceRate(rate)}</CellText>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 92,
      render: (status: SocialInsurancePolicyItem['status']) => (
        <StatusTag toneMap={socialInsurancePolicyItemStatusTone} value={status} />
      )
    }
  ];

  return (
    <DetailDrawerShell
      bodyTestId="system-social-insurance-config-detail"
      cancelAction={
        policy.status === '草稿'
          ? {
              danger: true,
              icon: <DeleteOutlined />,
              label: '删除草稿',
              onClick: () => onDeleteDraft(policy),
              testId: 'system-social-insurance-config-delete-draft-button'
            }
          : undefined
      }
      className="system-social-insurance-config-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={open}
      primaryAction={
        policy.status === '草稿'
          ? {
              icon: <CheckCircleOutlined />,
              label: '启用此版本',
              onClick: () => onEnable(policy)
            }
          : undefined
      }
      title={
        <DetailDrawerTitle
          status={policy.status}
          statusToneMap={socialInsurancePolicyStatusTone}
          subtitle="系统管理 / 社保公积金配置"
          title={policy.name}
        />
      }
      width={980}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={
          isSocialConfig
            ? [
                { icon: <ProfileOutlined />, key: 'type', label: '配置类型', value: policy.configType },
                { icon: <ProfileOutlined />, key: 'region', label: '适用地区', value: `${policy.province}${policy.city}` },
                { icon: <CalendarOutlined />, key: 'effective', label: '生效月份', value: policy.effectiveMonth },
                { icon: <WalletOutlined />, key: 'social', label: '社保项目', value: getEnabledSocialItemCount(policy) }
              ]
            : [
                { icon: <ProfileOutlined />, key: 'type', label: '配置类型', value: policy.configType },
                { icon: <ProfileOutlined />, key: 'region', label: '适用地区', value: `${policy.province}${policy.city}` },
                { icon: <CalendarOutlined />, key: 'effective', label: '生效月份', value: policy.effectiveMonth },
                    { icon: <CalculatorOutlined />, key: 'housing', label: '公积金比例', value: housingFundItem ? formatSocialInsuranceRate(housingFundItem.companyRate) : '-' }
              ]
        }
      />
      <DetailTabs
        items={[
          {
            key: 'base',
            label: '基础信息',
            children: (
              <DetailSection icon={<FileTextOutlined />} title="基础信息">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '配置名称', value: policy.name },
                    { label: '配置类型', value: <StatusTag toneMap={socialInsurancePolicyConfigTypeTone} value={policy.configType} /> },
                    { label: '版本', value: policy.version },
                    { label: '地区', value: `${policy.province}${policy.city}` },
                    { label: '生效月份', value: policy.effectiveMonth },
                    { label: '缴纳周期', value: policy.contributionCycle },
                    { label: '基数来源', value: policy.payrollBaseSource },
                    { label: '状态', value: <StatusTag toneMap={socialInsurancePolicyStatusTone} value={policy.status} /> },
                    { label: '最近更新', value: getLatestPolicyUpdate(policy) }
                  ]}
                />
              </DetailSection>
            )
          },
          ...(isSocialConfig
            ? [
                {
                  key: 'social',
                  label: '社保参数',
                  children: (
                    <DetailSection icon={<WalletOutlined />} title="社保参数">
                      <CompactDetailTable<SocialInsurancePolicyItem>
                        columns={socialItemColumns}
                        dataSource={socialItems}
                        rowKey="id"
                        scrollX={700}
                      />
                    </DetailSection>
                  )
                }
              ]
            : [
                {
                  key: 'housing',
                  label: '公积金参数',
                  children: (
                    <DetailSection icon={<WalletOutlined />} title="公积金参数">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '项目', value: housingFundItem?.name },
                          {
                            label: '缴纳基数',
                            value: housingFundItem ? formatSocialInsuranceBase(housingFundItem.baseLower, housingFundItem.baseUpper, housingFundItem.baseUpperRule) : undefined,
                            wide: true
                          },
                          { label: '单位承担', value: housingFundItem ? formatSocialInsuranceRate(housingFundItem.companyRate) : undefined },
                          { label: '个人承担', value: housingFundItem ? formatSocialInsuranceRate(housingFundItem.employeeRate) : undefined },
                          { label: '比例范围', value: formatPolicyRateRange(policy.housingFundRateRange ?? socialInsuranceDefaultHousingFundRateRange) },
                          { label: '同比例要求', value: policy.housingFundEqualRateRequired ? '是' : '否' },
                          {
                            label: '状态',
                            value: housingFundItem ? <StatusTag toneMap={socialInsurancePolicyItemStatusTone} value={housingFundItem.status} /> : undefined
                          }
                        ]}
                      />
                    </DetailSection>
                  )
                }
              ]),
          {
            key: 'preview',
            label: '计算预览',
            children: (
              <DetailSection icon={<CalculatorOutlined />} title="计算预览">
                <DetailInfoGrid
                  columns={3}
                  items={
                    isSocialConfig
                      ? [
                          { label: '预览基数', value: `${previewContributionBase.toLocaleString('zh-CN')} 元` },
                          { label: '社保单位比例', value: formatSocialInsuranceRate(socialRateTotal.companyRate) },
                          { label: '社保个人比例', value: formatSocialInsuranceRate(socialRateTotal.employeeRate) },
                          { label: '社保单位承担', value: `${socialPreviewAmounts.companyAmount.toLocaleString('zh-CN')} 元` },
                          { label: '社保个人承担', value: `${socialPreviewAmounts.personalAmount.toLocaleString('zh-CN')} 元` }
                        ]
                      : [
                          { label: '预览基数', value: `${previewContributionBase.toLocaleString('zh-CN')} 元` },
                          { label: '公积金单位承担', value: `${housingFundPreviewAmounts.companyAmount.toLocaleString('zh-CN')} 元` },
                          { label: '公积金个人承担', value: `${housingFundPreviewAmounts.personalAmount.toLocaleString('zh-CN')} 元` }
                        ]
                  }
                />
              </DetailSection>
            )
          },
          {
            key: 'operations',
            label: '版本记录',
            children: (
              <OperationRecordSection icon={<FileTextOutlined />} records={policy.operationRecords} scrollX={820} title="版本记录" />
            )
          }
        ]}
        tabTestIdPrefix="system-social-insurance-config-detail-tab"
        testId="system-social-insurance-config-detail-tabs"
      />
    </DetailDrawerShell>
  );
}

export function SystemSocialInsuranceConfigPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    activeHousingFundPolicy,
    activeSocialInsurancePolicy,
    createPolicyVersion,
    deleteDraftPolicyVersion,
    enablePolicyVersion,
    policyVersions
  } = useSocialInsurancePolicyConfigState();
  const [activePolicyId, setActivePolicyId] = useState<string>();
  const [filters, setFilters] = useState<SocialInsurancePolicyFilters>(defaultFilters);
  const createDrawer = useModeDrawerState<string, SocialInsurancePolicyFormValue>({
    createForm: (sourcePolicyId) =>
      buildPolicyForm(
        policyVersions.find((policy) => policy.id === sourcePolicyId) ?? activeSocialInsurancePolicy,
        policyVersions
      ),
    detailForm: (sourcePolicyId) =>
      buildPolicyForm(
        policyVersions.find((policy) => policy.id === sourcePolicyId) ?? activeSocialInsurancePolicy,
        policyVersions
      )
  });
  const activeRecord = policyVersions.find((policy) => policy.id === activePolicyId);
  const filteredRows = useMemo(
    () => sortPolicyRows(policyVersions.filter((policy) => matchesFilters(policy, filters))),
    [filters, policyVersions]
  );
  const configTypeOptions: SocialInsurancePolicyConfigTypeFilter[] = ['全部', '社保配置', '公积金配置'];
  const statusOptions: SocialInsurancePolicyStatusFilter[] = ['全部', '启用', '草稿', '历史'];
  const activeHousingFundItem = getHousingFundItem(activeHousingFundPolicy);

  function openCreateDrawer() {
    createDrawer.openCreate(activeSocialInsurancePolicy.id);
  }

  function createPolicy(activate: boolean) {
    const normalizedVersion = normalizePolicyVersion(createDrawer.form.version);

    if (!isValidPolicyForm(createDrawer.form)) {
      void messageApi.warning('请补全版本、生效月份和缴纳参数');
      return;
    }

    if (policyVersions.some((policy) => policy.configType === createDrawer.form.configType && policy.version === normalizedVersion)) {
      void messageApi.warning('版本号已存在');
      return;
    }

    const sourcePolicy =
      policyVersions.find((policy) => policy.id === createDrawer.form.sourcePolicyId)
      ?? getActivePolicyByConfigType(policyVersions, createDrawer.form.configType);
    const nextPolicy = buildPolicyFromForm(
      {
        ...createDrawer.form,
        version: normalizedVersion
      },
      sourcePolicy,
      policyVersions
    );

    createPolicyVersion(nextPolicy, activate);
    createDrawer.close();
    setActivePolicyId(nextPolicy.id);
    void messageApi.success(activate ? `${nextPolicy.configType}已新增并启用` : `${nextPolicy.configType}草稿已新增`);
  }

  function enablePolicy(policy: SocialInsurancePolicyVersion) {
    enablePolicyVersion(policy.id);
    setActivePolicyId(policy.id);
    void messageApi.success(`${policy.name}已启用`);
  }

  function deleteDraftPolicy(policy: SocialInsurancePolicyVersion) {
    if (policy.status !== '草稿') {
      return;
    }

    deleteDraftPolicyVersion(policy.id);
    setActivePolicyId(undefined);
    void messageApi.success(`${policy.name}已删除`);
  }

  const columns: TableColumnsType<SocialInsurancePolicyVersion> = [
    {
      title: '配置类型',
      dataIndex: 'configType',
      fixed: 'left',
      width: 120,
      render: (configType: SocialInsurancePolicyConfigType) => (
        <StatusTag toneMap={socialInsurancePolicyConfigTypeTone} value={configType} />
      )
    },
    {
      title: '配置名称',
      key: 'policy',
      width: 240,
      render: (_, record) => <PolicyVersionCell record={record} />
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 90
    },
    {
      title: '缴纳周期',
      key: 'cycle',
      width: 150,
      render: (_, record) => <CompactCell primary={record.contributionCycle} secondary={record.effectiveMonth} />
    },
    {
      title: '参数摘要',
      key: 'parameterSummary',
      width: 180,
      render: (_, record) => {
        const housingFundItem = getHousingFundItem(record);
        return (
          <CellText>
            {record.configType === '社保配置'
              ? `${getEnabledSocialItemCount(record)} 个社保项目`
              : housingFundItem
                ? `单位/个人 ${formatSocialInsuranceRate(housingFundItem.companyRate)}`
                : '-'}
          </CellText>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: SocialInsurancePolicyStatus) => <StatusTag toneMap={socialInsurancePolicyStatusTone} value={status} />
    },
    {
      title: '最近更新',
      key: 'updatedAt',
      width: 160,
      render: (_, record) => <CellText>{getLatestPolicyUpdate(record)}</CellText>
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="配置类型" controlWidth="status-select">
              <Select
                value={filters.configType}
                options={configTypeOptions.map((configType) => ({ label: configType, value: configType }))}
                onChange={(configType) => setFilters((current) => ({ ...current, configType }))}
              />
            </FilterField>
            <FilterField label="状态" controlWidth="status-select">
              <Select
                value={filters.status}
                options={statusOptions.map((status) => ({ label: status, value: status }))}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              placeholder="配置名称 / 编码 / 地区"
              value={filters.keyword}
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid>
          <MetricCard icon={<ProfileOutlined />} label="配置版本" value={policyVersions.length} />
          <MetricCard icon={<CheckCircleOutlined />} label="社保启用" value={activeSocialInsurancePolicy.version} />
          <MetricCard icon={<CheckCircleOutlined />} label="公积金启用" value={activeHousingFundPolicy.version} />
          <MetricCard
            icon={<CalculatorOutlined />}
            label="公积金个人"
            value={activeHousingFundItem ? formatSocialInsuranceRate(activeHousingFundItem.employeeRate) : '-'}
          />
        </MetricGrid>
      }
    >
      <ManagementTable<SocialInsurancePolicyVersion>
        columns={columns}
        count={{ unit: '个', value: filteredRows.length }}
        dataSource={filteredRows}
        primaryAction={{
          icon: <PlusOutlined />,
          label: '新增版本',
          onClick: openCreateDrawer,
          testId: 'system-social-insurance-policy-create-button'
        }}
        rowKey="id"
        rowTestIdPrefix="system-social-insurance-config-row"
        tableTestId="system-social-insurance-config-table"
        onRowClick={(record) => setActivePolicyId(record.id)}
      />

      <SystemSocialInsuranceConfigDrawer
        open={Boolean(activeRecord)}
        onDeleteDraft={deleteDraftPolicy}
        onEnable={enablePolicy}
        policy={activeRecord}
        onClose={() => setActivePolicyId(undefined)}
      />

      <SystemSocialInsuranceConfigCreateDrawer
        drawer={createDrawer}
        policyRows={policyVersions}
        onCreate={createPolicy}
      />
    </ManagementPageScaffold>
  );
}
