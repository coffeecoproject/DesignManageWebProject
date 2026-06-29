import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  UploadOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Select, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell, DrawerShell } from '../../components/DrawerShell';
import {
  DateScopeFilter,
  getDateScopeMonthRange,
  getDateScopeRange,
  type DateRangeFilterValue,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { TagChip, type TagChipTone } from '../../components/TagChip';
import { CompactCell } from '../../components/TableCell';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import { getDefaultPublicAccountRef, usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { isSalaryMonthlySettled } from '../salary/salaryDomain';
import { useSalaryManagementState } from '../salary/SalaryManagementState';
import { useSalaryMonthlyReportBuilder } from '../salary/salaryReportBuilder';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import { useFinanceManagement } from './FinanceManagementState';
import { useFinanceSocialInsuranceState } from './FinanceSocialInsuranceState';
import {
  type SocialInsuranceEmployeeRecord,
  type SocialInsuranceHandlingStatus
} from './financeSocialInsuranceData';
import { PayrollIitEmployeeDetailPanel } from './PayrollIitEmployeeDetailPanel';
import { SocialInsuranceContributionDetailPanel } from './SocialInsuranceContributionDetailPanel';
import {
  getTaxMatterFileStatus,
  taxMatterProcessStatusTone,
  taxMatterSourceStatusTone,
  taxMatterTypeTone,
  type FinanceTaxMatterProcessStatus,
  type FinanceTaxMatterRecord,
  type FinanceTaxMatterSourceStatus,
  type FinanceTaxMatterSourceItem,
  type FinanceTaxMatterType
} from './financeTaxFilingData';
import {
  applyDeclarationPreparationSourceState,
  declarationPreparationStatusTone,
  getDeclarationPreparationProgress,
  type FinanceDeclarationPreparationRecord
} from './financeDeclarationPreparationData';
import {
  applyTaxMatterSourceSummaries,
  attachTaxMatterPaymentTransaction,
  buildPayrollIitTaxMatterEmployeeRows,
  buildPayrollIitTaxMatterSummary,
  buildSocialInsuranceTaxMatterSummary,
  buildTaxMatterPaymentTransaction,
  getMissingTaxMatterReceiptTypes,
  getSocialInsuranceCategoryByTaxMatterType,
  getTaxMatterRequiredReceiptTypes,
  hasTaxMatterRequiredReceiptFiles,
  type SocialInsuranceTaxMatterSummary,
  type TaxMatterReceiptFileType
} from './financeTaxMatterModel';
import {
  financeToday,
  formatMoney
} from './financeUtils';

type FilterOptionValue = '全部';
type TaxMatterScope = 'pending' | 'completed' | 'all';
type TaxMatterModuleScope = 'tax' | 'social';
type TaxMatterFileStatus = '待上传' | '待补充' | '已归档';
type TaxMatterEditorState = {
  recordId: string;
} | undefined;
type TaxMatterPageId = 'tax-handling' | 'salary-social-insurance';

type FinanceTaxMatterFilters = {
  keyword: string;
  matterType: FilterOptionValue | FinanceTaxMatterType;
  period: FilterOptionValue | string;
  periodScope: DateScopeFilterValue;
  processStatus: FilterOptionValue | FinanceTaxMatterProcessStatus;
};

type TaxMatterFormValue = Pick<
  FinanceTaxMatterRecord,
  | 'dataStatus'
  | 'declarationDate'
  | 'declarationDueDate'
  | 'declarationStatus'
  | 'matterType'
  | 'owner'
  | 'paidAmount'
  | 'participantSummary'
  | 'payableAmount'
  | 'paymentDueDate'
  | 'paymentStatus'
  | 'period'
  | 'periodType'
>;

const currentPeriod = financeToday.slice(0, 7);
const currentQuarter = getQuarterPeriod(financeToday);

const defaultFilters: FinanceTaxMatterFilters = {
  keyword: '',
  matterType: '全部',
  period: '全部',
  periodScope: { mode: 'all' },
  processStatus: '全部'
};

const taxMatterTypeScopeMap: Record<TaxMatterModuleScope, FinanceTaxMatterType[]> = {
  tax: ['个人所得税', '增值税及附加', '企业所得税', '印花税', '其他税费'],
  social: ['社保缴纳', '公积金缴纳']
};

const taxMatterPageConfig: Record<TaxMatterModuleScope, {
  countUnit: string;
  pageId: TaxMatterPageId;
}> = {
  tax: {
    countUnit: '条税务办理事项',
    pageId: 'tax-handling'
  },
  social: {
    countUnit: '条社保公积金事项',
    pageId: 'salary-social-insurance'
  }
};

const taxMatterFileStatusTone = {
  待上传: 'amber',
  待补充: 'amber',
  已归档: 'green'
} as const satisfies Record<TaxMatterFileStatus, TagChipTone>;

const taxMatterCodeMap: Record<FinanceTaxMatterType, string> = {
  个人所得税: 'IIT',
  社保缴纳: 'SOCIAL',
  公积金缴纳: 'HF',
  增值税及附加: 'VAT',
  企业所得税: 'CIT',
  印花税: 'STAMP',
  其他税费: 'OTHER'
};

const taxMatterSourceTemplates: Record<FinanceTaxMatterType, Array<Pick<FinanceTaxMatterSourceItem, 'name' | 'sourceModule'>>> = {
  个人所得税: [
    { name: '薪酬明细', sourceModule: '薪酬明细' },
    { name: '工资薪金个税表', sourceModule: '自然人电子税务局' }
  ],
  社保缴纳: [
    { name: '社保缴费明细', sourceModule: '社保公积金 / 缴费明细' },
    { name: '社保缴费核定单', sourceModule: '电子税务局' }
  ],
  公积金缴纳: [
    { name: '公积金缴费明细', sourceModule: '社保公积金 / 缴费明细' },
    { name: '公积金汇缴核定单', sourceModule: '公积金系统' }
  ],
  增值税及附加: [
    { name: '办理依据', sourceModule: '申报准备' }
  ],
  企业所得税: [
    { name: '办理依据', sourceModule: '申报准备' }
  ],
  印花税: [
    { name: '合同签署记录', sourceModule: '合同管理' },
    { name: '特定业务事项', sourceModule: '经营数据' }
  ],
  其他税费: [
    { name: '税费事项资料', sourceModule: '财务管理' }
  ]
};

const taxMatterOfficialHandlingEntries: Record<
  FinanceTaxMatterType,
  {
    actionLabel: string;
    platform: string;
    url: string;
  }
> = {
  个人所得税: {
    actionLabel: '去缴办',
    platform: '自然人电子税务局',
    url: 'https://etax.chinatax.gov.cn/'
  },
  社保缴纳: {
    actionLabel: '去缴办',
    platform: '湖北省电子税务局',
    url: 'https://etax.hubei.chinatax.gov.cn/'
  },
  公积金缴纳: {
    actionLabel: '去缴办',
    platform: '武汉住房公积金单位网上业务系统',
    url: 'https://rmb.pingan.com.cn/whgjj/logon_pro.jsp'
  },
  增值税及附加: {
    actionLabel: '去缴办',
    platform: '湖北省电子税务局',
    url: 'https://etax.hubei.chinatax.gov.cn/'
  },
  企业所得税: {
    actionLabel: '去缴办',
    platform: '湖北省电子税务局',
    url: 'https://etax.hubei.chinatax.gov.cn/'
  },
  印花税: {
    actionLabel: '去缴办',
    platform: '湖北省电子税务局',
    url: 'https://etax.hubei.chinatax.gov.cn/'
  },
  其他税费: {
    actionLabel: '去缴办',
    platform: '湖北省电子税务局',
    url: 'https://etax.hubei.chinatax.gov.cn/'
  }
};

const defaultTaxMatterFormValue: TaxMatterFormValue = {
  dataStatus: '待准备',
  declarationDate: '',
  declarationDueDate: '2026-07-15',
  declarationStatus: '待申报',
  matterType: '个人所得税',
  owner: '李明',
  paidAmount: 0,
  participantSummary: '待确认',
  payableAmount: 0,
  paymentDueDate: '2026-07-15',
  paymentStatus: '未开始',
  period: currentPeriod,
  periodType: '月度'
};

function getQuarterPeriod(dateText: string) {
  const [year, monthText] = dateText.split('-');
  const month = Number(monthText);
  const quarter = Math.ceil(month / 3);

  return `${year}-Q${quarter}`;
}

function uniqueOptions<T extends string>(records: FinanceTaxMatterRecord[], selector: (record: FinanceTaxMatterRecord) => T) {
  return Array.from(new Set(records.map(selector)));
}

function getSourceSearchText(record: FinanceTaxMatterRecord) {
  return record.sourceItems.map((item) => `${item.name} ${item.sourceModule} ${item.status}`).join(' ');
}

function getTaxMatterSourceModules(record: FinanceTaxMatterRecord) {
  return Array.from(new Set(record.sourceItems.map((item) => item.sourceModule))).join(' / ') || '-';
}

function isDeclarationPreparationBackedTaxMatter(record: Pick<FinanceTaxMatterRecord, 'matterType'>) {
  return record.matterType === '增值税及附加' || record.matterType === '企业所得税';
}

function getTaxMatterBasisSummary(record: FinanceTaxMatterRecord) {
  if (!isDeclarationPreparationBackedTaxMatter(record)) {
    return getTaxMatterSourceModules(record);
  }

  return record.sourceItems.some((item) => item.status === '已确认') ? '申报准备已确认' : '等待申报准备';
}

function getTaxMatterProcessStatusLabel(status: FinanceTaxMatterProcessStatus, moduleScope: TaxMatterModuleScope) {
  if (moduleScope !== 'social') {
    return status;
  }

  if (status === '数据待确认') {
    return '明细待确认';
  }

  if (status === '可申报') {
    return '可缴费';
  }

  if (status === '待上传回执') {
    return '待上传凭证';
  }

  return status;
}

function renderTaxMatterProcessStatus(status: FinanceTaxMatterProcessStatus, moduleScope: TaxMatterModuleScope) {
  return (
    <StatusTag
      tone={taxMatterProcessStatusTone[status]}
      value={getTaxMatterProcessStatusLabel(status, moduleScope)}
    />
  );
}

function isSocialInsuranceTaxMatterType(matterType: FinanceTaxMatterType) {
  return Boolean(getSocialInsuranceCategoryByTaxMatterType(matterType));
}

function getQuarterRange(period: string): DateRangeFilterValue | undefined {
  const match = /^(\d{4})-Q([1-4])$/.exec(period);

  if (!match) {
    return undefined;
  }

  const [, year, quarterText] = match;
  const quarter = Number(quarterText);
  const startMonth = String((quarter - 1) * 3 + 1).padStart(2, '0');
  const endMonth = String(quarter * 3).padStart(2, '0');

  return {
    endDate: getDateScopeMonthRange(`${year}-${endMonth}`).endDate,
    startDate: `${year}-${startMonth}-01`
  };
}

function getTaxMatterPeriodRange(period: string): DateRangeFilterValue | undefined {
  if (/^\d{4}-\d{2}$/.test(period)) {
    return getDateScopeMonthRange(period);
  }

  return getQuarterRange(period);
}

function isDateRangeOverlapping(left: DateRangeFilterValue, right: DateRangeFilterValue) {
  return left.startDate <= right.endDate && right.startDate <= left.endDate;
}

function isTaxMatterInPeriodScope(
  record: FinanceTaxMatterRecord,
  periodScope: DateScopeFilterValue,
  defaultMonth: string
) {
  const filterRange = getDateScopeRange(periodScope, defaultMonth);

  if (!filterRange) {
    return true;
  }

  const recordRange = getTaxMatterPeriodRange(record.period);

  return recordRange ? isDateRangeOverlapping(recordRange, filterRange) : false;
}

function matchesFilters(record: FinanceTaxMatterRecord, filters: FinanceTaxMatterFilters, moduleScope: TaxMatterModuleScope) {
  const keyword = filters.keyword.trim().toLowerCase();

  if (moduleScope === 'social' && !isTaxMatterInPeriodScope(record, filters.periodScope, currentPeriod)) {
    return false;
  }

  if (moduleScope !== 'social' && filters.period !== '全部' && record.period !== filters.period) {
    return false;
  }

  if (filters.matterType !== '全部' && record.matterType !== filters.matterType) {
    return false;
  }

  if (filters.processStatus !== '全部' && record.processStatus !== filters.processStatus) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  return [record.matterNo, record.title, record.matterType, record.period, record.owner, record.participantSummary, getSourceSearchText(record)]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function matchesScope(record: FinanceTaxMatterRecord, scope: TaxMatterScope) {
  if (scope === 'pending') {
    return record.processStatus !== '已完成';
  }

  if (scope === 'completed') {
    return record.processStatus === '已完成';
  }

  return true;
}

function formatTaxMatterPeriodCode(period: string) {
  return period.replace(/[^0-9A-Z]/gi, '');
}

function buildTaxMatterTitle(formValue: TaxMatterFormValue) {
  return `${formValue.period} ${formValue.matterType}`;
}

function buildTaxMatterNo(formValue: TaxMatterFormValue, records: FinanceTaxMatterRecord[], currentRecordId?: string) {
  const baseNo = `TAX-${formatTaxMatterPeriodCode(formValue.period)}-${taxMatterCodeMap[formValue.matterType]}`;
  let candidateNo = baseNo;
  let index = 2;

  while (records.some((record) => record.id !== currentRecordId && record.matterNo === candidateNo)) {
    candidateNo = `${baseNo}-${index}`;
    index += 1;
  }

  return candidateNo;
}

function getSourceStatusFromDataStatus(dataStatus: FinanceTaxMatterRecord['dataStatus']): FinanceTaxMatterSourceStatus {
  if (dataStatus === '已确认') {
    return '已确认';
  }

  if (dataStatus === '待复核') {
    return '待复核';
  }

  return '待准备';
}

function buildTaxMatterSourceItems(formValue: TaxMatterFormValue, existingItems: FinanceTaxMatterSourceItem[] = []) {
  const nextStatus = getSourceStatusFromDataStatus(formValue.dataStatus);
  const periodCode = formatTaxMatterPeriodCode(formValue.period).toLowerCase();
  const typeCode = taxMatterCodeMap[formValue.matterType].toLowerCase();

  return taxMatterSourceTemplates[formValue.matterType].map((template, index) => {
    const existingItem = existingItems.find(
      (item) => item.name === template.name && item.sourceModule === template.sourceModule
    );

    return {
      id: existingItem?.id ?? `tax-source-${typeCode}-${periodCode}-${index + 1}`,
      name: template.name,
      sourceModule: template.sourceModule,
      status: nextStatus,
      updatedAt: financeToday
    };
  });
}

const socialInsuranceProcessStatusOrder: Record<FinanceTaxMatterProcessStatus, number> = {
  数据待确认: 0,
  可申报: 1,
  待上传回执: 2,
  已完成: 3
};

function compareSocialInsuranceTaxMatterRows(left: FinanceTaxMatterRecord, right: FinanceTaxMatterRecord) {
  const statusDiff = socialInsuranceProcessStatusOrder[left.processStatus] - socialInsuranceProcessStatusOrder[right.processStatus];

  if (statusDiff !== 0) {
    return statusDiff;
  }

  const periodDiff = right.period.localeCompare(left.period);

  if (periodDiff !== 0) {
    return periodDiff;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function getTaxMatterFormValue(record: FinanceTaxMatterRecord | undefined): TaxMatterFormValue {
  if (!record) {
    return defaultTaxMatterFormValue;
  }

  return {
    dataStatus: record.dataStatus,
    declarationDate: record.declarationDate ?? '',
    declarationDueDate: record.declarationDueDate,
    declarationStatus: record.declarationStatus,
    matterType: record.matterType,
    owner: record.owner,
    paidAmount: record.paidAmount,
    participantSummary: record.participantSummary,
    payableAmount: record.payableAmount,
    paymentDueDate: record.paymentDueDate,
    paymentStatus: record.paymentStatus,
    period: record.period,
    periodType: record.periodType
  };
}

function buildTaxMatterRecord(
  formValue: TaxMatterFormValue,
  records: FinanceTaxMatterRecord[],
  existingRecord?: FinanceTaxMatterRecord,
  files: FinanceTaxMatterRecord['files'] = existingRecord?.files ?? []
): FinanceTaxMatterRecord {
  const title = buildTaxMatterTitle(formValue);
  const matterNo = existingRecord?.period === formValue.period && existingRecord.matterType === formValue.matterType
    ? existingRecord.matterNo
    : buildTaxMatterNo(formValue, records, existingRecord?.id);
  const isSocialInsuranceMatter = isSocialInsuranceTaxMatterType(formValue.matterType);
  const requiredReceiptTypes = getTaxMatterRequiredReceiptTypes(formValue);
  const hasRequiredReceiptFiles = hasTaxMatterRequiredReceiptFiles(files, requiredReceiptTypes);
  const operation = {
    action: isSocialInsuranceMatter ? '上传凭证' : '上传回执',
    actor: '李明',
    id: `tax-op-receipt-${Date.now()}`,
    object: matterNo,
    summary: `归档 ${title} ${requiredReceiptTypes.join('、')}`,
    time: `${financeToday} 15:30`
  };

  return {
    ...(existingRecord ?? {
      files: [],
      id: `tax-matter-local-${Date.now()}`,
      linkedTransactionNos: [],
      operationRecords: []
    }),
    ...formValue,
    declarationDate: formValue.declarationDate || financeToday,
    files,
    matterNo,
    operationRecords: [...(existingRecord?.operationRecords ?? []), operation],
    declarationStatus: formValue.payableAmount > 0 ? '已申报' : '零申报',
    paidAmount: formValue.payableAmount,
    paymentStatus: formValue.payableAmount > 0 ? '已缴纳' : '无需缴纳',
    processStatus: hasRequiredReceiptFiles ? '已完成' : '待上传回执',
    sourceItems: buildTaxMatterSourceItems(formValue, existingRecord?.sourceItems),
    title,
    updatedAt: financeToday
  };
}

function getTaxMatterFormError(formValue: TaxMatterFormValue) {
  if (
    !formValue.period.trim()
    || !formValue.owner.trim()
    || !formValue.participantSummary.trim()
    || !formValue.declarationDueDate.trim()
    || !formValue.paymentDueDate.trim()
  ) {
    return '请补全必填信息';
  }

  if (formValue.payableAmount < 0) {
    return '金额不能小于 0';
  }

  return undefined;
}

function buildTaxMatterReceiptFile(file: FinanceVoucherUploadFile, receiptType: TaxMatterReceiptFileType) {
  return {
    id: `tax-file-local-${file.uid}-${Date.now()}`,
    name: file.name,
    status: '已上传',
    type: receiptType,
    updatedAt: financeToday
  };
}

function DrawerTitle({ moduleScope, record }: { moduleScope: TaxMatterModuleScope; record: FinanceTaxMatterRecord }) {
  return (
    <DetailDrawerTitle
      status={getTaxMatterProcessStatusLabel(record.processStatus, moduleScope)}
      statusTone={taxMatterProcessStatusTone[record.processStatus]}
      subtitle={`${record.matterNo} / ${record.period}`}
      title={record.title}
    />
  );
}

export function FinanceTaxFilingsPage() {
  return <FinanceTaxMatterHandlingPage moduleScope="tax" />;
}

export function FinanceSocialInsurancePage() {
  return <FinanceTaxMatterHandlingPage moduleScope="social" />;
}

const taxMatterSourceColumns: TableColumnsType<FinanceTaxMatterSourceItem> = [
  {
    dataIndex: 'name',
    render: (_name: string, record) => <CompactCell primary={record.name} secondary={record.sourceModule} />,
    title: '来源项',
    width: 220
  },
  {
    dataIndex: 'status',
    render: (status: FinanceTaxMatterSourceItem['status']) => <StatusTag toneMap={taxMatterSourceStatusTone} value={status} />,
    title: '状态',
    width: 96
  },
  {
    dataIndex: 'updatedAt',
    title: '最近更新',
    width: 118
  }
];

function findDeclarationPreparationForTaxMatter(
  record: FinanceTaxMatterRecord,
  preparationRows: FinanceDeclarationPreparationRecord[]
) {
  if (!isDeclarationPreparationBackedTaxMatter(record)) {
    return undefined;
  }

  return preparationRows.find((preparation) => preparation.taxType === record.matterType && preparation.period === record.period);
}

function getDeclarationPreparationPayableAmount(preparation: FinanceDeclarationPreparationRecord | undefined) {
  if (!preparation) {
    return 0;
  }

  if (preparation.taxType === '企业所得税') {
    return preparation.citSummary?.estimatedCorporateIncomeTaxAmount ?? 0;
  }

  return preparation.vatSummary.estimatedTotalTaxAmount;
}

function formatTaxRate(rate: number) {
  return `${(rate * 100).toFixed(0)}%`;
}

function getCorporateIncomeTaxEligibilityText(preparation: FinanceDeclarationPreparationRecord) {
  const summary = preparation.citSummary;

  if (!summary) {
    return '-';
  }

  return summary.smallLowProfitEligible ? '符合小型微利候选口径' : '按普通企业口径';
}

function getDeclarationPreparationResultItems(preparation: FinanceDeclarationPreparationRecord) {
  if (preparation.taxType === '企业所得税') {
    const summary = preparation.citSummary;

    return [
      { label: '申报准备', value: <StatusTag toneMap={declarationPreparationStatusTone} value={preparation.status} /> },
      { label: '申报周期', value: preparation.period },
      { label: '应纳税所得额', value: formatMoney(summary?.taxableIncomeAmount ?? 0) },
      { label: '小型微利资格', value: getCorporateIncomeTaxEligibilityText(preparation) },
      { label: '有效预缴率', value: formatTaxRate(summary?.effectiveTaxRate ?? summary?.taxRate ?? 0) },
      { label: '本次应缴', value: formatMoney(summary?.estimatedCorporateIncomeTaxAmount ?? 0) }
    ];
  }

  return [
    { label: '申报准备', value: <StatusTag toneMap={declarationPreparationStatusTone} value={preparation.status} /> },
    { label: '不含税销售额', value: formatMoney(preparation.vatSummary.declaredNetSalesAmount) },
    { label: '销项蓝票', value: formatMoney(preparation.vatSummary.outputBlueNetAmount) },
    { label: '红票冲减', value: formatMoney(preparation.vatSummary.redInvoiceNetAmount) },
    { label: '未开票收入', value: formatMoney(preparation.vatSummary.unbilledIncomeNetAmount) },
    { label: '前期未开票冲抵', value: formatMoney(preparation.vatSummary.priorUnbilledOffsetNetAmount) },
    {
      label: '免税判断',
      value: preparation.vatSummary.isBelowQuarterlyExemptionThreshold ? '季度30万以下' : '超过季度30万'
    },
    { label: '本次应缴', value: formatMoney(preparation.vatSummary.estimatedTotalTaxAmount) }
  ];
}

function buildDeclarationPreparationSourceItem(
  record: FinanceTaxMatterRecord,
  preparation: FinanceDeclarationPreparationRecord | undefined
): FinanceTaxMatterSourceItem[] {
  const existingItem = record.sourceItems.find((item) => item.name === '办理依据');
  const progress = preparation ? getDeclarationPreparationProgress(preparation) : undefined;
  const isPreparationReady =
    preparation && (preparation.status === '可申报' || preparation.status === '已进入税务办理') && progress?.pendingCount === 0;

  return [
    {
      id: existingItem?.id ?? `tax-source-${taxMatterCodeMap[record.matterType].toLowerCase()}-${record.period.toLowerCase()}-preparation`,
      name: '办理依据',
      sourceModule: '申报准备',
      status: isPreparationReady ? '已确认' : '待复核',
      updatedAt: preparation?.updatedAt ?? financeToday
    }
  ];
}

function applyDeclarationPreparationToTaxMatter(
  record: FinanceTaxMatterRecord,
  preparationRows: FinanceDeclarationPreparationRecord[]
): FinanceTaxMatterRecord {
  if (!isDeclarationPreparationBackedTaxMatter(record)) {
    return record;
  }

  const preparation = findDeclarationPreparationForTaxMatter(record, preparationRows);
  const sourceItems = buildDeclarationPreparationSourceItem(record, preparation);
  const progress = preparation ? getDeclarationPreparationProgress(preparation) : undefined;
  const isPreparationReady =
    preparation && (preparation.status === '可申报' || preparation.status === '已进入税务办理') && progress?.pendingCount === 0;

  if (record.processStatus === '已完成') {
    return {
      ...record,
      sourceItems
    };
  }

  if (!isPreparationReady) {
    return {
      ...record,
      dataStatus: '待复核',
      paidAmount: 0,
      payableAmount: 0,
      paymentStatus: '未开始',
      processStatus: '数据待确认',
      sourceItems
    };
  }

  return {
    ...record,
    dataStatus: '已确认',
    payableAmount: getDeclarationPreparationPayableAmount(preparation),
    paymentStatus: record.paymentStatus === '未开始' ? '待缴纳' : record.paymentStatus,
    processStatus: record.processStatus === '数据待确认' ? '可申报' : record.processStatus,
    sourceItems,
    updatedAt: preparation.updatedAt
  };
}

function applyDeclarationPreparationsToTaxMatters(
  records: FinanceTaxMatterRecord[],
  preparationRows: FinanceDeclarationPreparationRecord[]
) {
  return records.map((record) => applyDeclarationPreparationToTaxMatter(record, preparationRows));
}

function FinanceTaxMatterHandlingPage({ moduleScope }: { moduleScope: TaxMatterModuleScope }) {
  const {
    addFinanceTransaction,
    declarationPreparationRows,
    financeRows,
    invoiceRows,
    taxMatterRows,
    updateDeclarationPreparationRecord,
    updateTaxMatterRecord
  } = useFinanceManagement();
  const { socialInsuranceRecords, updateSocialInsuranceRecordStatus } = useFinanceSocialInsuranceState();
  const { salaryMonthlyWorkflows } = useSalaryManagementState();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const { publicAccounts } = usePublicAccountConfigState();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [activeScope, setActiveScope] = useState<TaxMatterScope>('pending');
  const [editorState, setEditorState] = useState<TaxMatterEditorState>();
  const [filters, setFilters] = useState<FinanceTaxMatterFilters>(defaultFilters);
  const pageConfig = taxMatterPageConfig[moduleScope];
  const isSocialInsuranceModule = moduleScope === 'social';
  const allowedMatterTypes = useMemo(() => new Set(taxMatterTypeScopeMap[moduleScope]), [moduleScope]);
  const { getSalaryMonthlyReports } = useSalaryMonthlyReportBuilder();
  const salaryReportPeriods = useMemo(
    () => Array.from(new Set([currentPeriod, ...taxMatterRows.map((record) => record.period)])).sort(),
    [taxMatterRows]
  );
  const salaryMonthlyReports = useMemo(
    () => salaryReportPeriods.flatMap((period) => getSalaryMonthlyReports(period)),
    [getSalaryMonthlyReports, salaryReportPeriods]
  );
  const displayDeclarationPreparationRows = useMemo(
    () => applyDeclarationPreparationSourceState(declarationPreparationRows, invoiceRows, financeRows),
    [declarationPreparationRows, financeRows, invoiceRows]
  );

  const allDisplayTaxMatterRows = useMemo(
    () =>
      applyDeclarationPreparationsToTaxMatters(
        applyTaxMatterSourceSummaries(taxMatterRows, socialInsuranceRecords, salaryMonthlyReports),
        displayDeclarationPreparationRows
      ),
    [displayDeclarationPreparationRows, salaryMonthlyReports, socialInsuranceRecords, taxMatterRows]
  );
  const displayTaxMatterRows = useMemo(
    () => allDisplayTaxMatterRows.filter((record) => allowedMatterTypes.has(record.matterType)),
    [allDisplayTaxMatterRows, allowedMatterTypes]
  );
  const defaultPaymentAccountRef = useMemo(
    () => getDefaultPublicAccountRef(publicAccounts, '付款'),
    [publicAccounts]
  );

  const filteredRecords = useMemo(
    () => displayTaxMatterRows.filter((record) => matchesFilters(record, filters, moduleScope)),
    [displayTaxMatterRows, filters, moduleScope]
  );
  const visibleRecords = useMemo(
    () => {
      if (isSocialInsuranceModule) {
        return [...filteredRecords].sort(compareSocialInsuranceTaxMatterRows);
      }

      return filteredRecords.filter((record) => matchesScope(record, activeScope));
    },
    [activeScope, filteredRecords, isSocialInsuranceModule]
  );
  const activeRecord = useMemo(
    () => displayTaxMatterRows.find((record) => record.id === activeRecordId),
    [activeRecordId, displayTaxMatterRows]
  );

  const activeSocialInsuranceSummary = activeRecord ? getTaxMatterSocialSummary(activeRecord) : undefined;
  const activeSocialInsuranceEmployeeRows = activeRecord ? getTaxMatterSocialEmployeeRows(activeRecord) : [];
  const activePayrollIitSummary = useMemo(
    () => activeRecord?.matterType === '个人所得税'
      ? buildPayrollIitTaxMatterSummary(salaryMonthlyReports, activeRecord.period)
      : undefined,
    [activeRecord, salaryMonthlyReports]
  );
  const activePayrollIitEmployeeRows = useMemo(
    () => activeRecord?.matterType === '个人所得税'
      ? buildPayrollIitTaxMatterEmployeeRows(salaryMonthlyReports, activeRecord.period)
      : [],
    [activeRecord, salaryMonthlyReports]
  );
  const activeOfficialEntry = activeRecord ? taxMatterOfficialHandlingEntries[activeRecord.matterType] : undefined;
  const activeDeclarationPreparation = activeRecord
    ? findDeclarationPreparationForTaxMatter(activeRecord, displayDeclarationPreparationRows)
    : undefined;
  const canHandleActiveRecord =
    Boolean(activeRecord && activeOfficialEntry) &&
    activeRecord?.processStatus !== '数据待确认' &&
    activeRecord?.processStatus !== '已完成';
  const canUploadActiveRecord = Boolean(activeRecord) && activeRecord?.processStatus === '待上传回执';
  const periodOptions: Array<FilterOptionValue | string> = ['全部', ...uniqueOptions(displayTaxMatterRows, (record) => record.period)];
  const matterTypeOptions: Array<FilterOptionValue | FinanceTaxMatterType> = ['全部', ...uniqueOptions(displayTaxMatterRows, (record) => record.matterType)];
  const processStatusOptions: Array<FilterOptionValue | FinanceTaxMatterProcessStatus> = ['全部', ...uniqueOptions(displayTaxMatterRows, (record) => record.processStatus)];
  const currentRows = displayTaxMatterRows.filter((record) => record.period === currentPeriod || record.period === currentQuarter);
  const pendingRows = displayTaxMatterRows.filter((record) => record.processStatus !== '已完成');
  const pendingConfirmRows = displayTaxMatterRows.filter((record) => record.processStatus === '数据待确认');
  const pendingHandlingRows = displayTaxMatterRows.filter((record) => record.processStatus === '可申报');
  const pendingReceiptRows = displayTaxMatterRows.filter((record) => record.processStatus === '待上传回执');
  const completedRows = displayTaxMatterRows.filter((record) => record.processStatus === '已完成');

  function getTaxMatterSocialSummary(record: FinanceTaxMatterRecord): SocialInsuranceTaxMatterSummary | undefined {
    const category = getSocialInsuranceCategoryByTaxMatterType(record.matterType);

    return category ? buildSocialInsuranceTaxMatterSummary(socialInsuranceRecords, category, record.period) : undefined;
  }

  function getTaxMatterSocialEmployeeRows(record: FinanceTaxMatterRecord): SocialInsuranceEmployeeRecord[] {
    const category = getSocialInsuranceCategoryByTaxMatterType(record.matterType);

    return category
      ? socialInsuranceRecords.filter((employeeRecord) => employeeRecord.category === category && employeeRecord.period === record.period)
      : [];
  }

  function openReceiptMatter(record: FinanceTaxMatterRecord) {
    setEditorState({ recordId: record.id });
  }

  function closeEditor() {
    setEditorState(undefined);
  }

  function saveTaxMatter(record: FinanceTaxMatterRecord) {
    const paymentTransaction = buildTaxMatterPaymentTransaction({
      financePrimaryCategories,
      financeRows,
      financeSecondaryCategories,
      publicAccountRef: defaultPaymentAccountRef,
      record,
    });
    const nextRecord = attachTaxMatterPaymentTransaction(record, paymentTransaction);

    if (paymentTransaction) {
      addFinanceTransaction(paymentTransaction);
    }

    updateTaxMatterRecord(nextRecord.id, () => nextRecord);
    setActiveRecordId(nextRecord.id);
    setActiveScope(nextRecord.processStatus === '已完成' ? 'completed' : 'pending');
    setEditorState(undefined);
    void messageApi.success(
      paymentTransaction
        ? isSocialInsuranceModule
          ? '已保存凭证，并生成待复核缴款流水'
          : '已保存回执，并生成待复核缴款流水'
        : isSocialInsuranceModule
          ? '已保存凭证'
          : '已保存回执'
    );
  }

  function handlePreviewFile(file: RelatedFileRecord) {
    void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
  }

  function handleDownloadFile(file: RelatedFileRecord) {
    void messageApi.success(`${file.name} 下载请求已记录`);
  }

  function openOfficialHandling(record: FinanceTaxMatterRecord) {
    const officialEntry = taxMatterOfficialHandlingEntries[record.matterType];

    window.open(officialEntry.url, '_blank', 'noopener,noreferrer');

    const nextRecord: FinanceTaxMatterRecord = {
      ...record,
      processStatus: '待上传回执',
      updatedAt: financeToday,
      operationRecords: [
        {
          action: '去缴办',
          actor: '李明',
          id: `tax-op-entry-${Date.now()}`,
          object: record.matterNo,
          summary: officialEntry.platform,
          time: `${financeToday} 14:30`
        },
        ...record.operationRecords
      ]
    };

    updateTaxMatterRecord(record.id, () => nextRecord);
    if (isDeclarationPreparationBackedTaxMatter(record)) {
      const preparation = findDeclarationPreparationForTaxMatter(record, displayDeclarationPreparationRows);

      if (preparation && preparation.status === '可申报') {
        updateDeclarationPreparationRecord(preparation.id, (currentPreparation) => ({
          ...currentPreparation,
          status: '已进入税务办理',
          operationRecords: [
            {
              action: '进入税务办理',
              actor: '李明',
              id: `declaration-prep-op-entry-${Date.now()}`,
              object: currentPreparation.preparationNo,
              summary: `${record.matterNo} 已进入税务办理`,
              time: `${financeToday} 14:30`
            },
            ...currentPreparation.operationRecords
          ],
          updatedAt: financeToday
        }));
      }
    }
    setActiveRecordId(record.id);
    void messageApi.success('已打开缴办链接');
  }

  function isSocialInsuranceEmployeeLocked(employeeRecord: SocialInsuranceEmployeeRecord) {
    return isSalaryMonthlySettled(salaryMonthlyWorkflows, employeeRecord.employeeNo, employeeRecord.period);
  }

  function getSocialInsuranceHandlingSummary(employeeRecord: SocialInsuranceEmployeeRecord, handlingStatus: SocialInsuranceHandlingStatus) {
    if (handlingStatus === '已确认') {
      return `${employeeRecord.employeeName} ${employeeRecord.category} 已确认`;
    }

    if (handlingStatus === '延期补缴') {
      return `${employeeRecord.employeeName} ${employeeRecord.category} 标记延期补缴`;
    }

    if (handlingStatus === '本月不缴') {
      return `${employeeRecord.employeeName} ${employeeRecord.category} 标记本月不缴`;
    }

    return `${employeeRecord.employeeName} ${employeeRecord.category} 退回明细确认`;
  }

  function updateSocialInsuranceEmployeeHandling(
    record: FinanceTaxMatterRecord,
    employeeRecord: SocialInsuranceEmployeeRecord,
    handlingStatus: SocialInsuranceHandlingStatus
  ) {
    if (isSocialInsuranceEmployeeLocked(employeeRecord)) {
      void messageApi.warning('薪酬明细已结算，当前缴费明细已锁定');
      return;
    }

    updateSocialInsuranceRecordStatus(employeeRecord.id, handlingStatus);

    updateTaxMatterRecord(record.id, (currentRecord) => ({
      ...currentRecord,
      dataStatus: '待复核',
      paidAmount: handlingStatus === '待确认' ? 0 : currentRecord.paidAmount,
      paymentStatus: handlingStatus === '待确认' ? '未开始' : currentRecord.paymentStatus,
      processStatus: handlingStatus === '待确认' ? '数据待确认' : currentRecord.processStatus,
      updatedAt: financeToday,
      operationRecords: [
        {
          action: handlingStatus === '待确认' ? '退回明细' : '更新缴费明细',
          actor: '李明',
          id: `tax-op-return-${employeeRecord.id}-${Date.now()}`,
          object: currentRecord.matterNo,
          summary: getSocialInsuranceHandlingSummary(employeeRecord, handlingStatus),
          time: `${financeToday} 14:40`
        },
        ...currentRecord.operationRecords
      ]
    }));
    setActiveScope('pending');
    void messageApi.success(handlingStatus === '待确认' ? '已退回缴费明细' : '已更新缴费明细');
  }

  const columns: TableColumnsType<FinanceTaxMatterRecord> = [
    {
      dataIndex: 'title',
      fixed: 'left',
      render: (_title: string, record) => <CompactCell primary={record.title} secondary={record.matterType} />,
      title: isSocialInsuranceModule ? '缴费事项' : '事项',
      width: 188
    },
    {
      dataIndex: 'period',
      render: (_period: string, record) => <CompactCell primary={record.period} secondary={record.periodType} />,
      title: '所属期间',
      width: 98
    },
    {
      dataIndex: 'participantSummary',
      title: '涉及对象',
      width: 96
    },
    {
      key: 'amountSummary',
      render: (_, record) => <CompactCell primary={formatMoney(record.payableAmount)} secondary={`已缴 ${formatMoney(record.paidAmount)}`} />,
      title: '应缴金额',
      width: 138
    },
    {
      dataIndex: 'processStatus',
      render: (status: FinanceTaxMatterProcessStatus) => renderTaxMatterProcessStatus(status, moduleScope),
      title: '处理进度',
      width: 112
    },
    {
      key: 'deadline',
      render: (_, record) => <CompactCell primary={record.declarationDueDate} secondary={`缴纳 ${record.paymentDueDate}`} />,
      title: '截止日期',
      width: 118
    },
    {
      dataIndex: 'updatedAt',
      title: '最近更新',
      width: 110
    }
  ];

  const renderTaxMatterTable = () => (
    <ManagementTable<FinanceTaxMatterRecord>
      columns={columns}
      count={{ value: visibleRecords.length, unit: pageConfig.countUnit }}
      dataSource={visibleRecords}
      rowKey="id"
      rowTestIdPrefix="finance-tax-table-row"
      tableTestId="finance-tax-table"
      onRowClick={(record) => setActiveRecordId(record.id)}
    />
  );

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      filters={
        <FilterPanel>
          <FilterBar>
            {isSocialInsuranceModule ? (
              <DateScopeFilter
                defaultMonth={currentPeriod}
                defaultRange={getDateScopeMonthRange(currentPeriod)}
                label="缴费期间"
                monthLabel="缴费月份"
                rangeLabel="缴费时间段"
                testIdPrefix="finance-social-insurance-period"
                value={filters.periodScope}
                onChange={(periodScope) => setFilters((current) => ({ ...current, periodScope }))}
              />
            ) : (
              <FilterField label="所属期间">
                <Select
                  data-testid="finance-tax-period-filter"
                  options={periodOptions.map((period) => ({ label: period, value: period }))}
                  value={filters.period}
                  onChange={(period) => setFilters((current) => ({ ...current, period }))}
                />
              </FilterField>
            )}
            <FilterField label={isSocialInsuranceModule ? '缴费类型' : '事项类型'} controlWidth="wide-select">
              <Select
                data-testid="finance-tax-type-filter"
                options={matterTypeOptions.map((matterType) => ({ label: matterType, value: matterType }))}
                value={filters.matterType}
                onChange={(matterType) => setFilters((current) => ({ ...current, matterType }))}
              />
            </FilterField>
            <FilterField label="处理进度" controlWidth="status-select">
              <Select
                data-testid="finance-tax-status-filter"
                options={processStatusOptions.map((status) => ({
                  label: status === '全部' ? status : getTaxMatterProcessStatusLabel(status, moduleScope),
                  value: status
                }))}
                value={filters.processStatus}
                onChange={(processStatus) => setFilters((current) => ({ ...current, processStatus }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-tax-keyword-input"
              placeholder={isSocialInsuranceModule ? '缴费事项 / 编号 / 来源' : '事项 / 编号 / 来源'}
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<CalendarOutlined />} label={isSocialInsuranceModule ? '当前缴费' : '当前事项'} value={`${currentRows.length} 条`} />
          <MetricCard icon={<AuditOutlined />} label={isSocialInsuranceModule ? '明细待确认' : '数据待确认'} value={`${pendingConfirmRows.length} 条`} />
          <MetricCard icon={<FileProtectOutlined />} label={isSocialInsuranceModule ? '可缴费' : '可申报'} value={`${pendingHandlingRows.length} 条`} />
          <MetricCard icon={<WalletOutlined />} label={isSocialInsuranceModule ? '待上传凭证' : '待上传回执'} value={`${pendingReceiptRows.length} 条`} />
        </MetricGrid>
      }
      pageId={pageConfig.pageId}
    >
      {contextHolder}
      {isSocialInsuranceModule ? (
        renderTaxMatterTable()
      ) : (
        <DetailTabs
          activeKey={activeScope}
          items={[
            {
              children: renderTaxMatterTable(),
              key: 'pending',
              label: `待处理 ${pendingRows.length}`
            },
            {
              children: renderTaxMatterTable(),
              key: 'completed',
              label: `已完成 ${completedRows.length}`
            },
            {
              children: renderTaxMatterTable(),
              key: 'all',
              label: `全部事项 ${filteredRecords.length}`
            }
          ]}
          tabTestIdPrefix="finance-tax-page-tab"
          testId="finance-tax-page-tabs"
          variant="page-section"
          onChange={(key) => setActiveScope(key as TaxMatterScope)}
        />
      )}

      <DetailDrawerShell
        bodyTestId="finance-tax-detail-drawer"
        className="finance-tax-drawer"
        closeAction={{ label: '关闭', onClick: () => setActiveRecordId(undefined) }}
        open={Boolean(activeRecord)}
        primaryAction={
          canUploadActiveRecord && activeRecord
            ? {
                icon: <UploadOutlined />,
                label: isSocialInsuranceModule ? '上传凭证' : '上传回执',
                testId: 'finance-tax-receipt-button',
                onClick: () => openReceiptMatter(activeRecord)
              }
            : undefined
        }
        secondaryAction={
          canHandleActiveRecord && activeRecord && activeOfficialEntry
            ? {
                icon: <ExportOutlined />,
                label: activeOfficialEntry.actionLabel,
                testId: 'finance-tax-official-entry-button',
                onClick: () => openOfficialHandling(activeRecord)
              }
            : undefined
        }
        title={activeRecord ? <DrawerTitle moduleScope={moduleScope} record={activeRecord} /> : null}
        width={860}
        onClose={() => setActiveRecordId(undefined)}
      >
        {activeRecord ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={[
                {
                  icon: <ProfileOutlined />,
                  key: 'matterType',
                  label: isSocialInsuranceModule ? '缴费类别' : '事项类别',
                  value: activeRecord.matterType
                },
                {
                  icon: <CalendarOutlined />,
                  key: 'period',
                  label: '所属期间',
                  value: activeRecord.period
                },
                {
                  icon: <AuditOutlined />,
                  key: 'processStatus',
                  label: '处理进度',
                  value: renderTaxMatterProcessStatus(activeRecord.processStatus, moduleScope)
                },
                {
                  icon: <WalletOutlined />,
                  key: 'payableAmount',
                  label: '应缴金额',
                  value: formatMoney(activeRecord.payableAmount)
                }
              ]}
            />

            <DetailTabs
              items={[
                {
                  children: (
                    <DetailSection icon={<AuditOutlined />} title={isSocialInsuranceModule ? '缴费信息' : '事项信息'}>
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: isSocialInsuranceModule ? '缴费编号' : '事项编号', value: activeRecord.matterNo },
                          { label: isSocialInsuranceModule ? '缴费类型' : '事项类型', value: <StatusTag toneMap={taxMatterTypeTone} value={activeRecord.matterType} /> },
                          { label: '处理进度', value: renderTaxMatterProcessStatus(activeRecord.processStatus, moduleScope) },
                          { label: '办理平台', value: activeOfficialEntry?.platform ?? '-' },
                          { label: isSocialInsuranceModule ? '凭证状态' : '回执状态', value: <StatusTag toneMap={taxMatterFileStatusTone} value={getTaxMatterFileStatus(activeRecord)} /> },
                          { label: '所属期间', value: activeRecord.period },
                          { label: '处理周期', value: activeRecord.periodType },
                          { label: '涉及对象', value: activeRecord.participantSummary },
                          {
                            label: isDeclarationPreparationBackedTaxMatter(activeRecord) ? '办理依据' : '来源模块',
                            value: getTaxMatterBasisSummary(activeRecord)
                          },
                          { label: '负责人', value: activeRecord.owner },
                          { label: isSocialInsuranceModule ? '办理截止日' : '申报截止日', value: activeRecord.declarationDueDate },
                          { label: '缴纳截止日', value: activeRecord.paymentDueDate },
                          { label: '最近更新', value: activeRecord.updatedAt }
                        ]}
                      />
                    </DetailSection>
                  ),
                  key: 'basic',
                  label: isSocialInsuranceModule ? '缴费信息' : '事项信息'
                },
                {
                  children: (
                    <DetailSection
                      extra={
                        activeSocialInsuranceEmployeeRows.length > 0 || activeDeclarationPreparation
                          ? undefined
                          : activePayrollIitEmployeeRows.length > 0
                            ? <TagChip label={`${activePayrollIitEmployeeRows.length} 人`} tone="blue" />
                            : <TagChip label={`${activeRecord.sourceItems.length} 项`} tone="blue" />
                      }
                      icon={<FileSearchOutlined />}
                      title={
                        activeSocialInsuranceEmployeeRows.length > 0
                          ? '缴费明细'
                          : activePayrollIitEmployeeRows.length > 0
                            ? '薪酬明细'
                          : activeDeclarationPreparation
                            ? '办理依据'
                            : '来源资料'
                      }
                    >
                      {activeSocialInsuranceEmployeeRows.length > 0 ? (
                        <SocialInsuranceContributionDetailPanel
                          isRecordLocked={isSocialInsuranceEmployeeLocked}
                          payableAmount={activeRecord.payableAmount}
                          readOnly={activeRecord.processStatus === '已完成'}
                          records={activeSocialInsuranceEmployeeRows}
                          summary={activeSocialInsuranceSummary}
                          onStatusChange={(employeeRecord, handlingStatus) =>
                            updateSocialInsuranceEmployeeHandling(activeRecord, employeeRecord, handlingStatus)
                          }
                        />
                      ) : activePayrollIitEmployeeRows.length > 0 ? (
                        <PayrollIitEmployeeDetailPanel
                          payableAmount={activeRecord.payableAmount}
                          records={activePayrollIitEmployeeRows}
                          summary={activePayrollIitSummary}
                        />
                      ) : activeDeclarationPreparation ? (
                        <DetailInfoGrid columns={3} items={getDeclarationPreparationResultItems(activeDeclarationPreparation)} />
                      ) : (
                        <CompactDetailTable<FinanceTaxMatterSourceItem>
                          columns={taxMatterSourceColumns}
                          dataSource={activeRecord.sourceItems}
                          rowKey="id"
                          scrollX={520}
                        />
                      )}
                    </DetailSection>
                  ),
                  key: 'confirmation',
                  label:
                    activeSocialInsuranceEmployeeRows.length > 0
                      ? '缴费明细'
                      : activePayrollIitEmployeeRows.length > 0
                        ? '薪酬明细'
                      : activeDeclarationPreparation
                        ? '办理依据'
                        : '来源资料'
                },
                {
                  children: (
                    <DetailSection icon={<FileProtectOutlined />} title={isSocialInsuranceModule ? '缴费凭证' : '回执文件'}>
                      <RelatedFileTable records={activeRecord.files} onDownload={handleDownloadFile} onPreview={handlePreviewFile} />
                    </DetailSection>
                  ),
                  key: 'files',
                  label: isSocialInsuranceModule ? '缴费凭证' : '回执文件'
                },
                {
                  children: (
                    <OperationRecordSection icon={<CheckCircleOutlined />} records={activeRecord.operationRecords} title="操作记录" />
                  ),
                  key: 'operations',
                  label: '操作记录'
                }
              ]}
              tabTestIdPrefix="finance-tax-detail-tab"
              testId="finance-tax-detail-tabs"
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <TaxMatterEditorDrawer
        editorState={editorState}
        records={displayTaxMatterRows}
        onClose={closeEditor}
        onSave={saveTaxMatter}
      />
    </ManagementPageScaffold>
  );
}

type TaxMatterEditorDrawerProps = {
  editorState: TaxMatterEditorState;
  records: FinanceTaxMatterRecord[];
  onClose: () => void;
  onSave: (record: FinanceTaxMatterRecord) => void;
};

function TaxMatterEditorDrawer({ editorState, records, onClose, onSave }: TaxMatterEditorDrawerProps) {
  const editingRecord = editorState ? records.find((record) => record.id === editorState.recordId) : undefined;
  const [formValue, setFormValue] = useState<TaxMatterFormValue>(defaultTaxMatterFormValue);
  const [formFiles, setFormFiles] = useState<FinanceTaxMatterRecord['files']>([]);

  useEffect(() => {
    if (!editorState) {
      return;
    }

    setFormValue(getTaxMatterFormValue(editingRecord));
    setFormFiles(editingRecord?.files ?? []);
  }, [editingRecord, editorState]);

  if (!editorState || !editingRecord) {
    return null;
  }

  const title = buildTaxMatterTitle(formValue);
  const matterNo = editingRecord.matterNo ?? buildTaxMatterNo(formValue, records, editingRecord.id);
  const officialEntry = taxMatterOfficialHandlingEntries[formValue.matterType];
  const isSocialInsuranceMatter = isSocialInsuranceTaxMatterType(formValue.matterType);
  const editorModuleScope: TaxMatterModuleScope = isSocialInsuranceMatter ? 'social' : 'tax';
  const requiredReceiptTypes = getTaxMatterRequiredReceiptTypes(formValue);
  const missingReceiptTypes = getMissingTaxMatterReceiptTypes(formFiles, requiredReceiptTypes);
  const processStatus = missingReceiptTypes.length === 0 ? '已完成' : '待上传回执';
  const formError = missingReceiptTypes.length > 0
    ? `请上传${missingReceiptTypes.join('、')}`
    : getTaxMatterFormError(formValue);

  function handleSave() {
    if (formError) {
      return;
    }

    const nextRecord = buildTaxMatterRecord(formValue, records, editingRecord, formFiles);

    onSave(nextRecord);
  }

  function handleReceiptFileSelect(receiptType: TaxMatterReceiptFileType, file: FinanceVoucherUploadFile) {
    setFormFiles((currentFiles) => [
      buildTaxMatterReceiptFile(file, receiptType),
      ...currentFiles.filter((currentFile) => currentFile.type !== receiptType)
    ]);
  }

  function handleReceiptFileRemove(file: FinanceTaxMatterRecord['files'][number]) {
    setFormFiles((currentFiles) => currentFiles.filter((currentFile) => currentFile.id !== file.id));
  }

  return (
    <DrawerShell
      bodyTestId="finance-tax-process-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open={Boolean(editorState)}
      primaryAction={{
        disabled: Boolean(formError),
        label: isSocialInsuranceMatter ? '保存凭证' : '保存回执',
        testId: 'finance-tax-process-save',
        onClick: handleSave
      }}
      title={
        <DetailDrawerTitle
          status={getTaxMatterProcessStatusLabel(processStatus, editorModuleScope)}
          statusTone={taxMatterProcessStatusTone[processStatus]}
          subtitle={matterNo}
          title={isSocialInsuranceMatter ? '上传凭证' : '上传回执'}
        />
      }
      width={820}
      onClose={onClose}
    >
      <DetailSection icon={<FileSearchOutlined />} title={isSocialInsuranceMatter ? '缴费信息' : '办理信息'}>
        <div className="drawer-form-grid">
          <ReadOnlyField label={isSocialInsuranceMatter ? '缴费名称' : '事项名称'} testId="finance-tax-process-title" value={title} />
          <ReadOnlyField label={isSocialInsuranceMatter ? '缴费编号' : '事项编号'} testId="finance-tax-process-no" value={matterNo} />
          <ReadOnlyField label={isSocialInsuranceMatter ? '缴费类型' : '事项类型'} value={<StatusTag toneMap={taxMatterTypeTone} value={formValue.matterType} />} />
          <ReadOnlyField label="所属期间" value={formValue.period} />
          <ReadOnlyField label="处理周期" value={formValue.periodType} />
          <ReadOnlyField label="办理平台" value={officialEntry.platform} />
          <ReadOnlyField label="处理进度" value={renderTaxMatterProcessStatus(processStatus, editorModuleScope)} />
        </div>
      </DetailSection>

      <DetailSection icon={<FileProtectOutlined />} title={isSocialInsuranceMatter ? '凭证文件' : '回执文件'}>
        <div className="detail-tab-stack">
          {requiredReceiptTypes.map((receiptType) => (
            <FinanceVoucherUploadPanel
              key={receiptType}
              description=""
              emptyText={`暂无${receiptType}`}
              files={formFiles.filter((file) => file.type === receiptType)}
              title={receiptType}
              onRemove={handleReceiptFileRemove}
              onSelect={(file) => handleReceiptFileSelect(receiptType, file)}
            />
          ))}
        </div>
      </DetailSection>

    </DrawerShell>
  );
}
