import {
  AuditOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Col, Input, Row, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormShell } from '../../components/DrawerForm';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText, CompactCell } from '../../components/TableCell';
import { useCustomerManagementState } from '../customers/CustomerManagementState';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import { buildPublicAccountOptions, type PublicAccountUsage, usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import {
  getFinanceCategorySnapshot,
  type FinanceCategorySnapshot,
  type FinanceCollectionStatus,
  type FinanceCounterpartyScope,
  type FinanceInvoiceDeclarationStatus,
  type FinancePaymentMethod,
  type FinancePrimaryCategoryConfig,
  type FinanceReportAggregation,
  type FinanceSettlementAccountType,
  type FinanceSecondaryCategoryConfig,
  type FinanceSourceType,
  type FinanceTransactionCategory,
  type FinanceTransactionDirection,
  type FinanceTransactionRecord,
  type FinanceTransactionStatus,
  type FinanceVoucherStatus
} from './financeData';
import {
  buildTransactionInvoiceAssociation,
  type FinanceTransactionInvoiceAssociation,
  type FinanceTransactionMatchedInvoice
} from './financeInvoiceModel';
import {
  collectionStatusDisplayName,
  collectionStatusTone,
  directionTone,
  financeToday,
  formatMoney,
  getAccountingPeriod,
  getAmountTone,
  getFinanceCategoryDisplayName,
  getFinanceDirectionLabels,
  getFinanceRecordCategorySnapshot,
  getFinanceTransactionInvoiceDeclarationStatus,
  getPublicAccountSignedAmount,
  invoiceDeclarationStatusTone,
  invoiceAssociationStatusTone,
  parseMoney,
  reconciliationStatusTone,
  transactionStatusTone,
  voucherStatusTone
} from './financeUtils';

type FinanceTransactionFilters = {
  category: '全部' | FinanceTransactionCategory;
  direction: '全部' | FinanceTransactionDirection;
  invoiceDeclaration: '全部' | FinanceInvoiceDeclarationStatus;
  keyword: string;
  period: '全部' | string;
  primaryCategory: '全部' | string;
  reportAggregation: '全部' | FinanceReportAggregation;
  status: '全部' | FinanceTransactionStatus;
};

type FinanceTransactionForm = {
  amount: string;
  category: FinanceTransactionCategory;
  categorySnapshot: FinanceCategorySnapshot;
  counterparty: string;
  counterpartyKey: string;
  counterpartyType: FinanceTransactionRecord['counterpartyType'];
  direction: FinanceTransactionDirection;
  note: string;
  occurredAt: string;
  paymentMethod: FinancePaymentMethod;
  primaryCategoryId: string;
  handler: string;
  settlementAccount: string;
  settlementAccountType: FinanceSettlementAccountType;
  sourceNo: string;
  sourceTitle: string;
  sourceType: FinanceSourceType;
  voucherFiles: RelatedFileRecord[];
};

type FinanceSettlementAccountOption = {
  isDefault?: boolean;
  label: string;
  type: FinanceSettlementAccountType;
  value: string;
};

type FinanceHandlerOption = {
  label: string;
  note: string;
  value: string;
};

const defaultFilters: FinanceTransactionFilters = {
  category: '全部',
  direction: '全部',
  invoiceDeclaration: '全部',
  keyword: '',
  period: '全部',
  primaryCategory: '全部',
  reportAggregation: '全部',
  status: '全部'
};

const defaultForm: FinanceTransactionForm = {
  amount: '',
  category: '客户回款',
  categorySnapshot: getFinanceCategorySnapshot('客户回款'),
  counterparty: '',
  counterpartyKey: '',
  counterpartyType: '客户',
  direction: '收入',
  note: '',
  occurredAt: financeToday,
  paymentMethod: '对公账户收款',
  primaryCategoryId: 'finance-primary-customer-income',
  handler: '',
  settlementAccount: '',
  settlementAccountType: '对公账户',
  sourceNo: '',
  sourceTitle: '',
  sourceType: '手工登记',
  voucherFiles: []
};

const paymentMethodOptionsByDirection: Record<'收入' | '支出', FinancePaymentMethod[]> = {
  收入: ['对公账户收款', '员工代收', '现金暂收'],
  支出: ['对公账户付款', '员工垫付']
};

const fallbackCounterpartyOptions: Array<{
  label: string;
  type: FinanceTransactionRecord['counterpartyType'];
  value: string;
}> = [
  { label: '材料供应商', type: '供应商', value: 'supplier-material' },
  { label: '办公用品供应商', type: '供应商', value: 'supplier-office' },
  { label: '交通服务商', type: '供应商', value: 'supplier-traffic' },
  { label: '办公室备用金', type: '内部', value: 'internal-office-cash' },
  { label: '平台服务商', type: '供应商', value: 'supplier-platform-service' },
  { label: '临时收付款对象', type: '内部', value: 'internal-temporary' }
];

function getDefaultSettlementAccountOption(options: FinanceSettlementAccountOption[]) {
  return options.find((option) => option.isDefault) ?? options[0];
}

function getSettlementAccountOptionByLabel(options: FinanceSettlementAccountOption[], label: string) {
  return options.find((option) => option.label === label);
}

function getUncollectedAmount(record: FinanceTransactionRecord) {
  return Math.max(0, record.amount - (record.collectedAmount ?? 0));
}

function getCollectionStatus(record: FinanceTransactionRecord): FinanceCollectionStatus {
  return record.collectionStatus ?? '不适用';
}

function isEmployeeHandledMethod(paymentMethod: FinancePaymentMethod) {
  return paymentMethod === '员工代收' || paymentMethod === '现金暂收' || paymentMethod === '员工垫付';
}

function isPublicAccountMethod(paymentMethod: FinancePaymentMethod) {
  return paymentMethod === '对公账户收款' || paymentMethod === '对公账户付款';
}

function getPublicAccountUsageByPaymentMethod(paymentMethod: FinancePaymentMethod): PublicAccountUsage | undefined {
  if (paymentMethod === '对公账户付款') {
    return '付款';
  }

  if (paymentMethod === '对公账户收款') {
    return '收款';
  }

  return undefined;
}

function getDefaultPaymentMethod(direction: FinanceTransactionDirection): FinancePaymentMethod {
  return direction === '支出' ? '对公账户付款' : '对公账户收款';
}

function getActivePrimaryRows(primaryRows: FinancePrimaryCategoryConfig[]) {
  return primaryRows.filter((row) => row.status === '启用').sort((left, right) => left.sortOrder - right.sortOrder);
}

function getActiveSecondaryRows(primaryRows: FinancePrimaryCategoryConfig[], secondaryRows: FinanceSecondaryCategoryConfig[]) {
  const activePrimaryIds = new Set(getActivePrimaryRows(primaryRows).map((row) => row.id));

  return secondaryRows
    .filter((row) => row.status === '启用' && activePrimaryIds.has(row.primaryId))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function getSecondaryByCategory(secondaryRows: FinanceSecondaryCategoryConfig[], category: FinanceTransactionCategory) {
  return secondaryRows.find((row) => row.name === category);
}

function getPrimaryById(primaryRows: FinancePrimaryCategoryConfig[], primaryId: string) {
  return primaryRows.find((row) => row.id === primaryId);
}

function getCounterpartyTypeFromScope(scope?: FinanceCounterpartyScope): FinanceTransactionRecord['counterpartyType'] {
  if (scope === '客户') {
    return '客户';
  }

  if (scope === '员工') {
    return '员工';
  }

  if (scope === '合作人员') {
    return '外协';
  }

  if (scope === '供应商') {
    return '供应商';
  }

  return '内部';
}

function getCategoryOptionsByPaymentMethod({
  direction,
  paymentMethod,
  primaryCategoryId,
  primaryRows,
  secondaryRows
}: {
  direction: FinanceTransactionDirection;
  paymentMethod: FinancePaymentMethod;
  primaryCategoryId?: string;
  primaryRows: FinancePrimaryCategoryConfig[];
  secondaryRows: FinanceSecondaryCategoryConfig[];
}) {
  return getActiveSecondaryRows(primaryRows, secondaryRows).filter(
    (row) =>
      row.direction === direction &&
      row.paymentMethods.includes(paymentMethod) &&
      (!primaryCategoryId || row.primaryId === primaryCategoryId)
  );
}

function getPrimaryOptionsByDirection(direction: FinanceTransactionDirection, primaryRows: FinancePrimaryCategoryConfig[], secondaryRows: FinanceSecondaryCategoryConfig[]) {
  const activeSecondaryRows = getActiveSecondaryRows(primaryRows, secondaryRows);
  const primaryIdsWithSecondary = new Set(activeSecondaryRows.filter((row) => row.direction === direction).map((row) => row.primaryId));

  return getActivePrimaryRows(primaryRows).filter((row) => row.direction === direction && primaryIdsWithSecondary.has(row.id));
}

function getPaymentMethodOptionsBySelection(direction: FinanceTransactionDirection, primaryCategoryId: string, primaryRows: FinancePrimaryCategoryConfig[], secondaryRows: FinanceSecondaryCategoryConfig[]) {
  const baseMethods = paymentMethodOptionsByDirection[direction === '支出' ? '支出' : '收入'];
  const activeSecondaryRows = getActiveSecondaryRows(primaryRows, secondaryRows).filter(
    (row) => row.direction === direction && (!primaryCategoryId || row.primaryId === primaryCategoryId)
  );

  return baseMethods.filter((method) => activeSecondaryRows.some((row) => row.paymentMethods.includes(method)));
}

function buildFormCategoryPatch(
  category: FinanceTransactionCategory,
  primaryRows: FinancePrimaryCategoryConfig[],
  secondaryRows: FinanceSecondaryCategoryConfig[]
) {
  const secondary = getSecondaryByCategory(secondaryRows, category);
  const primaryCategoryId = secondary?.primaryId ?? '';

  return {
    category,
    categorySnapshot: getFinanceCategorySnapshot(category, primaryRows, secondaryRows),
    counterpartyType: getCounterpartyTypeFromScope(secondary?.counterpartyScope),
    primaryCategoryId,
    sourceType: secondary?.defaultSourceType ?? '手工登记'
  };
}

function getInitialCollectionStatus(paymentMethod: FinancePaymentMethod): FinanceCollectionStatus {
  if (paymentMethod === '员工代收') {
    return '待转入对公';
  }

  if (paymentMethod === '现金暂收') {
    return '待存入对公';
  }

  if (paymentMethod === '员工垫付') {
    return '待报销';
  }

  return '不适用';
}

function getPublicAccountDisplay(record: Pick<FinanceTransactionRecord, 'settlementAccount' | 'settlementAccountType'>) {
  return record.settlementAccountType === '对公账户' ? record.settlementAccount : '-';
}

function getTransactionTableLabels(direction: FinanceTransactionFilters['direction']) {
  if (direction === '收入') {
    return {
      amount: '收款金额',
      counterparty: '收款对象',
      handler: '收款经办人',
      publicAccount: '入账对公账户'
    };
  }

  if (direction === '支出') {
    return {
      amount: '付款金额',
      counterparty: '付款对象',
      handler: '付款经办人',
      publicAccount: '付款对公账户'
    };
  }

  if (direction === '内部转入') {
    return {
      amount: '转入金额',
      counterparty: '处理对象',
      handler: '经办人',
      publicAccount: '进入对公账户'
    };
  }

  return {
    amount: '金额',
    counterparty: '业务对象',
    handler: '经办人',
    publicAccount: '对公账户'
  };
}

function DrawerTitle({ record }: { record: FinanceTransactionRecord }) {
  return (
    <DetailDrawerTitle
      status={record.status}
      statusToneMap={transactionStatusTone}
      subtitle={`${record.transactionNo} / ${record.occurredAt} / ${getFinanceRecordCategorySnapshot(record).secondaryName}`}
      title="流水详情"
    />
  );
}

function matchesFilters(
  record: FinanceTransactionRecord,
  filters: FinanceTransactionFilters,
  invoiceAssociation: FinanceTransactionInvoiceAssociation,
  invoiceDeclarationStatus: FinanceInvoiceDeclarationStatus
) {
  if (filters.period !== '全部' && record.accountingPeriod !== filters.period) {
    return false;
  }

  if (filters.direction !== '全部' && record.direction !== filters.direction) {
    return false;
  }

  if (filters.category !== '全部' && record.category !== filters.category) {
    return false;
  }

  const snapshot = getFinanceRecordCategorySnapshot(record);

  if (filters.primaryCategory !== '全部' && snapshot.primaryName !== filters.primaryCategory) {
    return false;
  }

  if (filters.reportAggregation !== '全部' && snapshot.reportAggregation !== filters.reportAggregation) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  if (filters.invoiceDeclaration !== '全部' && invoiceDeclarationStatus !== filters.invoiceDeclaration) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [
    record.transactionNo,
    record.counterparty,
    record.category,
    snapshot.primaryName,
    snapshot.reportAggregation,
    record.sourceNo,
    record.sourceTitle,
    record.settlementAccount,
    invoiceAssociation.status,
    invoiceDeclarationStatus,
    record.note
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

function buildNextTransactionNo(records: FinanceTransactionRecord[], occurredAt: string) {
  const period = getAccountingPeriod(occurredAt).replace('-', '');
  const maxSequence = records.reduce((max, record) => {
    if (record.transactionNo.slice(4, 10) !== period) {
      return max;
    }

    const sequence = Number(record.transactionNo.slice(-4));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `FIN-${period}-${String(maxSequence + 1).padStart(4, '0')}`;
}

function getTransactionFormValid(form: FinanceTransactionForm) {
  const requiresPublicAccount = isPublicAccountMethod(form.paymentMethod);
  const requiresHandler = isEmployeeHandledMethod(form.paymentMethod);

  return Boolean(
    form.occurredAt.trim() &&
      form.counterparty.trim() &&
      (!requiresPublicAccount || form.settlementAccount.trim()) &&
      (!requiresHandler || form.handler.trim()) &&
      form.sourceTitle.trim() &&
      parseMoney(form.amount) > 0
  );
}

function buildTransactionFromForm(form: FinanceTransactionForm, records: FinanceTransactionRecord[]): FinanceTransactionRecord {
  const transactionNo = buildNextTransactionNo(records, form.occurredAt);
  const amount = parseMoney(form.amount);
  const accountingPeriod = getAccountingPeriod(form.occurredAt);
  const sourceNo = form.sourceNo.trim() || `MANUAL-${transactionNo.replace('FIN-', '')}`;
  const collectionStatus = getInitialCollectionStatus(form.paymentMethod);

  return {
    id: `fin-flow-${Date.now()}`,
    transactionNo,
    occurredAt: form.occurredAt.trim(),
    accountingPeriod,
    direction: form.direction,
    category: form.category,
    categorySnapshot: form.categorySnapshot,
    counterparty: form.counterparty.trim(),
    counterpartyType: form.counterpartyType,
    amount,
    currency: 'CNY',
    paymentMethod: form.paymentMethod,
    settlementAccount: isPublicAccountMethod(form.paymentMethod) ? form.settlementAccount.trim() : '',
    settlementAccountType: isPublicAccountMethod(form.paymentMethod) ? '对公账户' : '员工经办资金',
    handler: isEmployeeHandledMethod(form.paymentMethod) ? form.handler.trim() : undefined,
    sourceType: form.sourceType,
    sourceNo,
    sourceTitle: form.sourceTitle.trim(),
    voucherStatus: form.voucherFiles.length > 0 ? '已上传' : '待补充',
    reconciliationStatus: '未对账',
    status: '待复核',
    registeredBy: '李明',
    collectionStatus,
    collectedAmount: collectionStatus !== '不适用' ? 0 : undefined,
    collectionTransactionNos: collectionStatus !== '不适用' ? [] : undefined,
    note: form.note.trim(),
    updatedAt: `${financeToday} 10:00`,
    files: form.voucherFiles.map((file) => ({
      ...file,
      status: '已上传',
      updatedAt: financeToday
    })),
    operationRecords: [
      {
        id: `fin-op-${Date.now()}`,
        time: `${financeToday} 10:00`,
        actor: '李明',
        object: transactionNo,
        action: '登记流水',
        summary: `登记${form.category} ${formatMoney(amount)}`
      }
    ]
  };
}

export function FinanceTransactionsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { addFinanceTransaction, financeRows: records, invoiceRows } = useFinanceManagement();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const { publicAccounts } = usePublicAccountConfigState();
  const { customerRows } = useCustomerManagementState();
  const { peopleRows } = usePeopleOrganizationState();
  const [filters, setFilters] = useState<FinanceTransactionFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [form, setForm] = useState<FinanceTransactionForm>(defaultForm);

  const invoiceAssociationByTransactionNo = useMemo(
    () =>
      new Map(
        records.map((record) => [
          record.transactionNo,
          buildTransactionInvoiceAssociation(record, invoiceRows)
        ])
      ),
    [invoiceRows, records]
  );
  const invoiceDeclarationStatusByTransactionNo = useMemo(
    () =>
      new Map(
        records.map((record) => {
          const invoiceAssociation =
            invoiceAssociationByTransactionNo.get(record.transactionNo) ??
            buildTransactionInvoiceAssociation(record, invoiceRows);

          return [
            record.transactionNo,
            getFinanceTransactionInvoiceDeclarationStatus(record, invoiceAssociation)
          ];
        })
      ),
    [invoiceAssociationByTransactionNo, invoiceRows, records]
  );
  const rows = useMemo(
    () =>
      records
        .filter((record) => {
          const invoiceAssociation =
            invoiceAssociationByTransactionNo.get(record.transactionNo) ??
            buildTransactionInvoiceAssociation(record, invoiceRows);
          const invoiceDeclarationStatus =
            invoiceDeclarationStatusByTransactionNo.get(record.transactionNo) ??
            getFinanceTransactionInvoiceDeclarationStatus(record, invoiceAssociation);

          return matchesFilters(record, filters, invoiceAssociation, invoiceDeclarationStatus);
        })
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.transactionNo.localeCompare(left.transactionNo)),
    [filters, invoiceAssociationByTransactionNo, invoiceDeclarationStatusByTransactionNo, invoiceRows, records]
  );

  const activeRecord = activeRecordId ? records.find((record) => record.id === activeRecordId) : undefined;
  const activeRecordInvoiceAssociation = activeRecord
    ? invoiceAssociationByTransactionNo.get(activeRecord.transactionNo) ?? buildTransactionInvoiceAssociation(activeRecord, invoiceRows)
    : undefined;
  const activeRecordInvoiceDeclarationStatus =
    activeRecord && activeRecordInvoiceAssociation
      ? invoiceDeclarationStatusByTransactionNo.get(activeRecord.transactionNo) ??
        getFinanceTransactionInvoiceDeclarationStatus(activeRecord, activeRecordInvoiceAssociation)
      : undefined;
  const periodOptions = useMemo(() => ['全部', ...Array.from(new Set(records.map((record) => record.accountingPeriod)))], [records]);
  const activeRows = rows.filter((record) => record.status !== '已作废');
  const receiptTotal = activeRows
    .filter((record) => record.direction === '收入' && getFinanceRecordCategorySnapshot(record).includeInReport)
    .reduce((total, record) => total + record.amount, 0);
  const paymentTotal = activeRows
    .filter((record) => record.direction === '支出' && record.settlementAccountType === '对公账户' && getFinanceRecordCategorySnapshot(record).includeInReport)
    .reduce((total, record) => total + record.amount, 0);
  const publicAccountNetTotal = activeRows.reduce((total, record) => total + getPublicAccountSignedAmount(record), 0);
  const pendingEmployeeFundAmount = activeRows
    .filter((record) => getCollectionStatus(record) !== '不适用' && getCollectionStatus(record) !== '已转入对公' && getCollectionStatus(record) !== '已存入对公' && getCollectionStatus(record) !== '已报销')
    .reduce((total, record) => total + getUncollectedAmount(record), 0);
  const pendingInvoiceDeclarationCount = activeRows.filter((record) => {
    const status =
      invoiceDeclarationStatusByTransactionNo.get(record.transactionNo) ??
      '不适用';

    return status === '待关联发票' || status === '部分关联发票' || status === '未开票待确认' || status === '后续开票待处理';
  }).length;
  const formValid = getTransactionFormValid(form);
  const activePrimaryRows = getActivePrimaryRows(financePrimaryCategories);
  const activeSecondaryRows = getActiveSecondaryRows(financePrimaryCategories, financeSecondaryCategories);
  const filterPrimaryOptions = Array.from(new Set([...activePrimaryRows.map((row) => row.name), ...records.map((record) => getFinanceRecordCategorySnapshot(record).primaryName)])).filter(Boolean);
  const filterSecondaryOptions = Array.from(new Set([...activeSecondaryRows.map((row) => row.name), ...records.map((record) => record.category)])).filter(Boolean);
  const reportAggregationOptions = Array.from(
    new Set([...activeSecondaryRows.map((row) => row.reportAggregation), ...records.map((record) => getFinanceRecordCategorySnapshot(record).reportAggregation)])
  ).filter(Boolean);
  const currentPrimaryOptions = getPrimaryOptionsByDirection(form.direction, financePrimaryCategories, financeSecondaryCategories);
  const currentPaymentMethodOptions = getPaymentMethodOptionsBySelection(
    form.direction,
    form.primaryCategoryId,
    financePrimaryCategories,
    financeSecondaryCategories
  );
  const currentCategoryOptions = getCategoryOptionsByPaymentMethod({
    direction: form.direction,
    paymentMethod: form.paymentMethod,
    primaryCategoryId: form.primaryCategoryId,
    primaryRows: financePrimaryCategories,
    secondaryRows: financeSecondaryCategories
  });
  const getSettlementAccountOptionsForPaymentMethod = useCallback(
    (paymentMethod: FinancePaymentMethod): FinanceSettlementAccountOption[] =>
      buildPublicAccountOptions(publicAccounts, getPublicAccountUsageByPaymentMethod(paymentMethod)).map((option, index) => ({
        ...option,
        isDefault: index === 0
      })),
    [publicAccounts]
  );
  const currentSettlementAccountOptions = useMemo<FinanceSettlementAccountOption[]>(
    () => getSettlementAccountOptionsForPaymentMethod(form.paymentMethod),
    [form.paymentMethod, getSettlementAccountOptionsForPaymentMethod]
  );
  const defaultTransactionForm = useMemo<FinanceTransactionForm>(() => {
    const direction: FinanceTransactionDirection = '收入';
    const firstPrimary = getPrimaryOptionsByDirection(direction, financePrimaryCategories, financeSecondaryCategories)[0];
    const firstPaymentMethod =
      getPaymentMethodOptionsBySelection(direction, firstPrimary?.id ?? '', financePrimaryCategories, financeSecondaryCategories)[0] ??
      defaultForm.paymentMethod;
    const firstCategory =
      getCategoryOptionsByPaymentMethod({
        direction,
        paymentMethod: firstPaymentMethod,
        primaryCategoryId: firstPrimary?.id,
        primaryRows: financePrimaryCategories,
        secondaryRows: financeSecondaryCategories
      })[0] ?? getActiveSecondaryRows(financePrimaryCategories, financeSecondaryCategories).find((row) => row.direction === direction);
    const categoryPatch = firstCategory ? buildFormCategoryPatch(firstCategory.name, financePrimaryCategories, financeSecondaryCategories) : undefined;
    const defaultAccount = getDefaultSettlementAccountOption(
      getSettlementAccountOptionsForPaymentMethod(firstPaymentMethod)
    );

    return {
      ...defaultForm,
      ...(categoryPatch ?? {}),
      paymentMethod: firstPaymentMethod,
      settlementAccount: isPublicAccountMethod(firstPaymentMethod) ? (defaultAccount?.label ?? '') : '',
      settlementAccountType: isPublicAccountMethod(firstPaymentMethod) ? '对公账户' : '员工经办资金'
    };
  }, [financePrimaryCategories, financeSecondaryCategories, getSettlementAccountOptionsForPaymentMethod]);
  const formLabels = getFinanceDirectionLabels(form.direction, form.paymentMethod);
  const handlerOptions = useMemo<FinanceHandlerOption[]>(
    () =>
      peopleRows
        .filter((member) => member.status !== '离职' && member.status !== '结束合作')
        .map((member) => ({
          label: member.name,
          note: `${member.id} / ${member.position}`,
          value: member.name
        })),
    [peopleRows]
  );
  const counterpartyOptions = useMemo(() => {
    const selectedSecondary = getSecondaryByCategory(financeSecondaryCategories, form.category);

    if (selectedSecondary?.counterpartyScope === '客户') {
      return customerRows.map((customer) => ({
        label: customer.name,
        note: customer.code,
        type: '客户' as const,
        value: `customer:${customer.id}`
      }));
    }

    if (selectedSecondary?.counterpartyScope === '员工') {
      return peopleRows
        .filter((member) => member.personnelType === '全职' && member.status !== '离职')
        .map((member) => ({
          label: member.name,
          note: `${member.id} / ${member.position}`,
          type: '员工' as const,
          value: `employee:${member.id}`
        }));
    }

    if (selectedSecondary?.counterpartyScope === '合作人员') {
      return peopleRows
        .filter((member) => member.personnelType === '兼职' && member.status === '合作中')
        .map((member) => ({
          label: member.name,
          note: `${member.id} / ${member.position}`,
          type: '外协' as const,
          value: `contractor:${member.id}`
        }));
    }

    return fallbackCounterpartyOptions.map((option) => ({
      ...option,
      note: option.type
    }));
  }, [customerRows, financeSecondaryCategories, form.category, peopleRows]);

  function clearCounterpartyForCategory(category: FinanceTransactionCategory) {
    const categoryPatch = buildFormCategoryPatch(category, financePrimaryCategories, financeSecondaryCategories);

    return {
      counterparty: '',
      counterpartyKey: '',
      counterpartyType: categoryPatch.counterpartyType
    };
  }

  function handleDirectionChange(direction: FinanceTransactionDirection) {
    setForm((current) => {
      const nextPrimaryOptions = getPrimaryOptionsByDirection(direction, financePrimaryCategories, financeSecondaryCategories);
      const nextPrimary = nextPrimaryOptions[0];
      const nextPaymentMethodOptions = getPaymentMethodOptionsBySelection(direction, nextPrimary?.id ?? '', financePrimaryCategories, financeSecondaryCategories);
      const nextPaymentMethod = nextPaymentMethodOptions[0] ?? getDefaultPaymentMethod(direction);
      const nextCategoryRow =
        getCategoryOptionsByPaymentMethod({
          direction,
          paymentMethod: nextPaymentMethod,
          primaryCategoryId: nextPrimary?.id,
          primaryRows: financePrimaryCategories,
          secondaryRows: financeSecondaryCategories
        })[0] ?? getActiveSecondaryRows(financePrimaryCategories, financeSecondaryCategories).find((row) => row.direction === direction);
      const defaultAccount = getDefaultSettlementAccountOption(getSettlementAccountOptionsForPaymentMethod(nextPaymentMethod));
      const categoryPatch = nextCategoryRow ? buildFormCategoryPatch(nextCategoryRow.name, financePrimaryCategories, financeSecondaryCategories) : undefined;

      return {
        ...current,
        direction,
        paymentMethod: nextPaymentMethod,
        ...(categoryPatch ?? {}),
        settlementAccount: defaultAccount?.label ?? '',
        settlementAccountType: '对公账户',
        handler: '',
        counterparty: '',
        counterpartyKey: ''
      };
    });
  }

  function handleCategoryChange(category: FinanceTransactionCategory) {
    const categoryPatch = buildFormCategoryPatch(category, financePrimaryCategories, financeSecondaryCategories);

    setForm((current) => ({
      ...current,
      ...categoryPatch,
      ...clearCounterpartyForCategory(category)
    }));
  }

  function handlePrimaryCategoryChange(primaryCategoryId: string) {
    setForm((current) => {
      const primary = getPrimaryById(financePrimaryCategories, primaryCategoryId);
      const direction = primary?.direction ?? current.direction;
      const nextPaymentMethodOptions = getPaymentMethodOptionsBySelection(direction, primaryCategoryId, financePrimaryCategories, financeSecondaryCategories);
      const nextPaymentMethod = nextPaymentMethodOptions.includes(current.paymentMethod) ? current.paymentMethod : (nextPaymentMethodOptions[0] ?? getDefaultPaymentMethod(direction));
      const nextCategoryRow =
        getCategoryOptionsByPaymentMethod({
          direction,
          paymentMethod: nextPaymentMethod,
          primaryCategoryId,
          primaryRows: financePrimaryCategories,
          secondaryRows: financeSecondaryCategories
        })[0] ?? getActiveSecondaryRows(financePrimaryCategories, financeSecondaryCategories).find((row) => row.primaryId === primaryCategoryId);
      const categoryPatch = nextCategoryRow ? buildFormCategoryPatch(nextCategoryRow.name, financePrimaryCategories, financeSecondaryCategories) : undefined;
      const defaultAccount = getDefaultSettlementAccountOption(getSettlementAccountOptionsForPaymentMethod(nextPaymentMethod));

      return {
        ...current,
        direction,
        paymentMethod: nextPaymentMethod,
        ...(categoryPatch ?? { primaryCategoryId }),
        settlementAccount: isPublicAccountMethod(nextPaymentMethod) ? (defaultAccount?.label ?? '') : '',
        settlementAccountType: isPublicAccountMethod(nextPaymentMethod) ? '对公账户' : '员工经办资金',
        handler: isEmployeeHandledMethod(nextPaymentMethod) ? current.handler : '',
        counterparty: '',
        counterpartyKey: ''
      };
    });
  }

  function handleCounterpartyChange(counterpartyKey: string) {
    const selectedCounterparty = counterpartyOptions.find((option) => option.value === counterpartyKey);

    setForm((current) => ({
      ...current,
      counterparty: selectedCounterparty?.label ?? '',
      counterpartyKey,
      counterpartyType: selectedCounterparty?.type ?? current.counterpartyType
    }));
  }

  function handlePaymentMethodChange(paymentMethod: FinancePaymentMethod) {
    const defaultAccount = getDefaultSettlementAccountOption(getSettlementAccountOptionsForPaymentMethod(paymentMethod));

    setForm((current) => {
      const currentCategoryOptions = getCategoryOptionsByPaymentMethod({
        direction: current.direction,
        paymentMethod,
        primaryCategoryId: current.primaryCategoryId,
        primaryRows: financePrimaryCategories,
        secondaryRows: financeSecondaryCategories
      });
      const fallbackCategoryOptions = getCategoryOptionsByPaymentMethod({
        direction: current.direction,
        paymentMethod,
        primaryRows: financePrimaryCategories,
        secondaryRows: financeSecondaryCategories
      });
      const nextCategoryRow =
        currentCategoryOptions.find((row) => row.name === current.category) ??
        currentCategoryOptions[0] ??
        fallbackCategoryOptions.find((row) => row.name === current.category) ??
        fallbackCategoryOptions[0];
      const categoryPatch = nextCategoryRow ? buildFormCategoryPatch(nextCategoryRow.name, financePrimaryCategories, financeSecondaryCategories) : undefined;

      return {
        ...current,
        paymentMethod,
        ...(categoryPatch ?? {}),
        settlementAccount: isPublicAccountMethod(paymentMethod) ? (defaultAccount?.label ?? '') : '',
        settlementAccountType: isPublicAccountMethod(paymentMethod) ? '对公账户' : '员工经办资金',
        handler: isEmployeeHandledMethod(paymentMethod) ? current.handler : '',
        counterparty: '',
        counterpartyKey: ''
      };
    });
  }

  function handleSettlementAccountChange(settlementAccount: string) {
    const selectedAccount = getSettlementAccountOptionByLabel(currentSettlementAccountOptions, settlementAccount);

    setForm((current) => ({
      ...current,
      settlementAccount,
      settlementAccountType: selectedAccount?.type ?? current.settlementAccountType
    }));
  }

  function buildVoucherFile(file: FinanceVoucherUploadFile): RelatedFileRecord | undefined {
    const maxFileSize = 10 * 1024 * 1024;

    if (file.size && file.size > maxFileSize) {
      void messageApi.warning(`${file.name} 超过 10MB，无法作为凭证上传`);
      return undefined;
    }

    if (form.voucherFiles.some((currentFile) => currentFile.name === file.name)) {
      void messageApi.warning(`${file.name} 已在凭证列表中`);
      return undefined;
    }

    return {
      id: `fin-voucher-${file.uid || Date.now()}`,
      name: file.name,
      status: '已选择',
      type: '收支凭证',
      updatedAt: financeToday
    };
  }

  function handleVoucherFileSelect(file: FinanceVoucherUploadFile) {
    const nextFile = buildVoucherFile(file);

    if (!nextFile) {
      return;
    }

    setForm((current) => ({
      ...current,
      voucherFiles: [...current.voucherFiles, nextFile]
    }));
  }

  function handleVoucherFileRemove(file: RelatedFileRecord) {
    setForm((current) => ({
      ...current,
      voucherFiles: current.voucherFiles.filter((currentFile) => currentFile.id !== file.id)
    }));
  }

  function handleCreateTransaction() {
    if (!formValid) {
      const requiredFundField = isPublicAccountMethod(form.paymentMethod) ? formLabels.publicAccount : formLabels.handler;
      void messageApi.warning(`请补充发生日期、${formLabels.counterparty}、${formLabels.amount}、${requiredFundField}、事项说明`);
      return;
    }

    const nextRecord = buildTransactionFromForm(form, records);
    addFinanceTransaction(nextRecord);
    setCreateDrawerOpen(false);
    setActiveRecordId(nextRecord.id);
    setForm(defaultTransactionForm);
    void messageApi.success('流水已新增，状态为待复核');
  }

  const tableLabels = getTransactionTableLabels(filters.direction);
  const invoiceRelationColumns: TableColumnsType<FinanceTransactionMatchedInvoice> = [
    {
      title: '发票号',
      dataIndex: 'invoiceNo',
      width: 180,
      render: (invoiceNo: string, record) => <CompactCell primary={invoiceNo} secondary={record.invoiceDate} />
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 86,
      render: (_direction: string, record) => (
        <CompactCell primary={record.direction} secondary={record.invoiceStatus} />
      )
    },
    {
      title: '对象',
      dataIndex: 'counterparty',
      width: 150
    },
    {
      title: '关联金额',
      dataIndex: 'amount',
      width: 132,
      render: (amount: number) => <CellText tone={amount < 0 ? 'expense' : 'strong'}>{formatMoney(amount)}</CellText>
    },
    {
      title: '发票金额',
      dataIndex: 'totalAmount',
      width: 132,
      render: (amount: number) => <CellText tone={amount < 0 ? 'expense' : 'strong'}>{formatMoney(amount)}</CellText>
    }
  ];
  const columns: TableColumnsType<FinanceTransactionRecord> = [
    {
      title: '发生日期',
      dataIndex: 'occurredAt',
      width: 116,
      render: (occurredAt: string, record) => <CompactCell primary={occurredAt} secondary={record.accountingPeriod} />
    },
    {
      title: '流水号',
      dataIndex: 'transactionNo',
      width: 154,
      render: (transactionNo: string, record) => <CompactCell primary={transactionNo} secondary={record.paymentMethod} />
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 84,
      render: (direction: FinanceTransactionDirection) => <StatusTag toneMap={directionTone} value={direction} />
    },
    {
      title: '财务类目',
      dataIndex: 'category',
      width: 150,
      render: (_category: FinanceTransactionCategory, record) => {
        const snapshot = getFinanceRecordCategorySnapshot(record);

        return <CompactCell primary={snapshot.secondaryName} secondary={`${snapshot.primaryName} / ${snapshot.reportAggregation}`} />;
      }
    },
    {
      title: tableLabels.counterparty,
      dataIndex: 'counterparty',
      width: 128,
      render: (counterparty: string) => <CompactCell primary={counterparty} />
    },
    {
      title: tableLabels.amount,
      dataIndex: 'amount',
      width: 132,
      render: (amount: number, record) => <CellText tone={getAmountTone(record)}>{formatMoney(amount)}</CellText>
    },
    {
      title: tableLabels.handler,
      dataIndex: 'handler',
      width: 96,
      render: (handler: string | undefined) => <CellText tone={handler ? 'strong' : 'subtle'}>{handler}</CellText>
    },
    {
      title: tableLabels.publicAccount,
      dataIndex: 'settlementAccount',
      width: 132,
      render: (_settlementAccount: string, record) => (
        <CompactCell primary={getPublicAccountDisplay(record)} secondary={record.settlementAccountType} />
      )
    },
    {
      title: '流水状态',
      dataIndex: 'status',
      width: 104,
      render: (status: FinanceTransactionStatus) => <StatusTag toneMap={transactionStatusTone} value={status} />
    },
    {
      title: '资金处理',
      key: 'collectionStatus',
      width: 128,
      render: (_, record) => {
        const collectionStatus = getCollectionStatus(record);

        if (collectionStatus === '不适用') {
          return <CellText tone="subtle">-</CellText>;
        }

        return <StatusTag tone={collectionStatusTone[collectionStatus]} value={collectionStatusDisplayName[collectionStatus]} />;
      }
    },
    {
      title: '发票/申报',
      key: 'invoiceDeclaration',
      width: 132,
      render: (_, record) => {
        const association =
          invoiceAssociationByTransactionNo.get(record.transactionNo) ??
          buildTransactionInvoiceAssociation(record, invoiceRows);
        const invoiceDeclarationStatus =
          invoiceDeclarationStatusByTransactionNo.get(record.transactionNo) ??
          getFinanceTransactionInvoiceDeclarationStatus(record, association);

        return <StatusTag toneMap={invoiceDeclarationStatusTone} value={invoiceDeclarationStatus} />;
      }
    },
    {
      title: '凭证',
      dataIndex: 'voucherStatus',
      width: 100,
      render: (voucherStatus: FinanceVoucherStatus) => <StatusTag toneMap={voucherStatusTone} value={voucherStatus} />
    }
  ];

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<WalletOutlined />} label="业务收款" value={formatMoney(receiptTotal)} />
          <MetricCard icon={<WalletOutlined />} label="对公付款" value={formatMoney(paymentTotal)} />
          <MetricCard icon={<CalculatorOutlined />} label="对公账户净流入" value={formatMoney(publicAccountNetTotal)} />
          <MetricCard icon={<FileSearchOutlined />} label="员工待处理资金" value={formatMoney(pendingEmployeeFundAmount)} />
          <MetricCard icon={<FileTextOutlined />} label="发票/申报待处理" value={pendingInvoiceDeclarationCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="财务期间">
              <Select
                data-testid="finance-transaction-period-filter"
                value={filters.period}
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="收支方向">
              <Select
                data-testid="finance-transaction-direction-filter"
                value={filters.direction}
                options={(['全部', '收入', '支出', '内部转入'] satisfies FinanceTransactionFilters['direction'][]).map((direction) => ({
                  label: direction,
                  value: direction
                }))}
                onChange={(direction) => setFilters((current) => ({ ...current, direction }))}
              />
            </FilterField>
            <FilterField label="一级类目">
              <Select
                data-testid="finance-transaction-primary-category-filter"
                value={filters.primaryCategory}
                options={['全部', ...filterPrimaryOptions].map((category) => ({ label: category, value: category }))}
                onChange={(primaryCategory) => setFilters((current) => ({ ...current, primaryCategory }))}
              />
            </FilterField>
            <FilterField label="二级类目">
              <Select
                data-testid="finance-transaction-category-filter"
                value={filters.category}
                options={(['全部', ...filterSecondaryOptions] satisfies FinanceTransactionFilters['category'][]).map((category) => ({
                  label: category === '全部' ? category : getFinanceCategoryDisplayName(category),
                  value: category
                }))}
                onChange={(category) => setFilters((current) => ({ ...current, category }))}
              />
            </FilterField>
            <FilterField label="统计归集">
              <Select
                data-testid="finance-transaction-report-filter"
                value={filters.reportAggregation}
                options={(['全部', ...reportAggregationOptions] satisfies FinanceTransactionFilters['reportAggregation'][]).map((reportAggregation) => ({
                  label: reportAggregation,
                  value: reportAggregation
                }))}
                onChange={(reportAggregation) => setFilters((current) => ({ ...current, reportAggregation }))}
              />
            </FilterField>
            <FilterField label="流水状态">
              <Select
                data-testid="finance-transaction-status-filter"
                value={filters.status}
                options={(['全部', '待复核', '退回修改', '已入账', '已作废'] satisfies FinanceTransactionFilters['status'][]).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <FilterField label="发票/申报" controlWidth="wide-select">
              <Select
                data-testid="finance-transaction-invoice-declaration-filter"
                value={filters.invoiceDeclaration}
                options={(
                  [
                    '全部',
                    '不适用',
                    '待关联发票',
                    '部分关联发票',
                    '已关联发票',
                    '未开票待确认',
                    '未开票已申报',
                    '本期暂不计入',
                    '后续开票待处理',
                    '后续开票已处理'
                  ] satisfies FinanceTransactionFilters['invoiceDeclaration'][]
                ).map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(invoiceDeclaration) => setFilters((current) => ({ ...current, invoiceDeclaration }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-transaction-keyword-input"
              placeholder="流水号 / 对象 / 类目 / 来源"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

      <ManagementTable<FinanceTransactionRecord>
        columns={columns}
        count={{ value: rows.length, unit: '条流水' }}
        dataSource={rows}
        primaryAction={{
          icon: <PlusOutlined />,
          label: '新增流水',
          testId: 'finance-transaction-create-button',
          onClick: () => {
            setForm(defaultTransactionForm);
            setCreateDrawerOpen(true);
          }
        }}
        rowTestIdPrefix="finance-transaction-table-row"
        rowKey="id"
        tableTestId="finance-transaction-table"
        onRowClick={(record) => setActiveRecordId(record.id)}
      />

      <DetailDrawerShell
        bodyTestId="finance-transaction-detail-drawer"
        className="finance-transaction-drawer"
        closeAction={{ label: '关闭', testId: 'finance-transaction-close-button', onClick: () => setActiveRecordId(undefined) }}
        open={Boolean(activeRecord)}
        title={activeRecord ? <DrawerTitle record={activeRecord} /> : null}
        width={900}
        onClose={() => setActiveRecordId(undefined)}
      >
        {activeRecord ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={
                [
                  {
                    icon: <ProfileOutlined />,
                    key: 'counterparty',
                    label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).counterparty,
                    value: activeRecord.counterparty
                  },
                  {
                    icon: <WalletOutlined />,
                    key: 'amount',
                    label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).amount,
                    value: formatMoney(activeRecord.amount)
                  },
                  { icon: <AuditOutlined />, key: 'status', label: '流水状态', value: activeRecord.status },
                  activeRecordInvoiceDeclarationStatus
                    ? {
                        icon: <FileTextOutlined />,
                        key: 'invoice-declaration',
                        label: '发票/申报',
                        value: activeRecordInvoiceDeclarationStatus
                      }
                    : undefined,
                  getCollectionStatus(activeRecord) !== '不适用'
                    ? {
                        icon: <FileSearchOutlined />,
                        key: 'fund-handling',
                        label: '资金处理',
                        value: collectionStatusDisplayName[getCollectionStatus(activeRecord)]
                      }
                    : undefined
                ].filter(Boolean) as DetailSummaryCardItem[]
              }
            />
            <DetailTabs
              defaultActiveKey="flow"
              tabTestIdPrefix="finance-transaction-detail-tab"
              testId="finance-transaction-detail-tabs"
              items={[
                {
                  key: 'flow',
                  label: '流水信息',
                  children: (
                    <div className="detail-tab-stack">
                      <DetailSection icon={<WalletOutlined />} title="基础信息">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '流水号', value: activeRecord.transactionNo },
                            { label: '发生日期', value: activeRecord.occurredAt },
                            { label: '财务期间', value: activeRecord.accountingPeriod },
                            { label: '收支方向', value: <StatusTag toneMap={directionTone} value={activeRecord.direction} /> },
                            { label: '一级类目', value: getFinanceRecordCategorySnapshot(activeRecord).primaryName },
                            { label: '二级类目', value: getFinanceRecordCategorySnapshot(activeRecord).secondaryName },
                            { label: '统计归集', value: getFinanceRecordCategorySnapshot(activeRecord).reportAggregation },
                            {
                              label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).amount,
                              value: <CellText tone={getAmountTone(activeRecord)}>{formatMoney(activeRecord.amount)}</CellText>
                            },
                            { label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).paymentMethod, value: activeRecord.paymentMethod },
                            ...(isPublicAccountMethod(activeRecord.paymentMethod)
                              ? [{ label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).publicAccount, value: getPublicAccountDisplay(activeRecord) }]
                              : []),
                            ...(isEmployeeHandledMethod(activeRecord.paymentMethod)
                              ? [{ label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).handler, value: activeRecord.handler }]
                              : []),
                            { label: '币种', value: activeRecord.currency },
                            { label: '备注', value: activeRecord.note, wide: true }
                          ]}
                        />
                      </DetailSection>
                      <DetailSection icon={<FileSearchOutlined />} title="业务来源">
                        <DetailInfoGrid
                          columns={2}
                          items={[
                            { label: getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).counterparty, value: activeRecord.counterparty },
                            { label: '来源类型', value: activeRecord.sourceType },
                            { label: '来源单号', value: activeRecord.sourceNo },
                            ...(activeRecord.collectionSourceTransactionNo
                              ? [
                                  { label: '处理来源', value: activeRecord.collectionSourceTransactionNo },
                                  { label: '经办来源', value: activeRecord.collectionFromAccount },
                                  { label: '进入对公账户', value: activeRecord.collectionToAccount }
                                ]
                              : []),
                            { label: '事项说明', value: activeRecord.sourceTitle, wide: true }
                          ]}
                        />
                      </DetailSection>
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: '状态与凭证',
                  children: (
                    <div className="detail-tab-stack">
                      <DetailSection icon={<AuditOutlined />} title="状态信息">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '登记人', value: activeRecord.registeredBy },
                            { label: '流水状态', value: <StatusTag toneMap={transactionStatusTone} value={activeRecord.status} /> },
                            {
                              label: '对账状态',
                              value: <StatusTag toneMap={reconciliationStatusTone} value={activeRecord.reconciliationStatus} />
                            },
                            { label: '复核人', value: activeRecord.reviewedBy },
                            { label: '复核时间', value: activeRecord.reviewedAt },
                            { label: '对账日期', value: activeRecord.reconciledAt },
                            {
                              label: '凭证状态',
                              value: <StatusTag toneMap={voucherStatusTone} value={activeRecord.voucherStatus} />
                            },
                            ...(activeRecordInvoiceDeclarationStatus
                              ? [
                                  {
                                    label: '发票/申报状态',
                                    value: (
                                      <StatusTag
                                        toneMap={invoiceDeclarationStatusTone}
                                        value={activeRecordInvoiceDeclarationStatus}
                                      />
                                    )
                                  },
                                  { label: '申报期间', value: activeRecord.invoiceDeclarationPeriod },
                                  { label: '申报准备', value: activeRecord.invoiceDeclarationPreparationNo }
                                ]
                              : []),
                            ...(activeRecordInvoiceAssociation
                              ? [
                                  {
                                    label: '发票关联',
                                    value: (
                                      <StatusTag
                                        toneMap={invoiceAssociationStatusTone}
                                        value={activeRecordInvoiceAssociation.status}
                                      />
                                    )
                                  },
                                  { label: '应关联金额', value: formatMoney(activeRecordInvoiceAssociation.requiredAmount) },
                                  { label: '已关联金额', value: formatMoney(activeRecordInvoiceAssociation.matchedAmount) },
                                  { label: '待关联金额', value: formatMoney(activeRecordInvoiceAssociation.remainingAmount) },
                                  { label: '关联发票数', value: `${activeRecordInvoiceAssociation.matchedInvoices.length} 张` }
                                ]
                              : []),
                            ...(getCollectionStatus(activeRecord) !== '不适用'
                              ? [
                                  {
                                    label: '资金处理',
                                    value: (
                                      <StatusTag
                                        tone={collectionStatusTone[getCollectionStatus(activeRecord)]}
                                        value={collectionStatusDisplayName[getCollectionStatus(activeRecord)]}
                                      />
                                    )
                                  },
                                  { label: '已处理金额', value: formatMoney(activeRecord.collectedAmount ?? 0) },
                                  { label: '待处理金额', value: formatMoney(getUncollectedAmount(activeRecord)) },
                                  { label: '处理流水', value: activeRecord.collectionTransactionNos?.join(' / ') }
                                ]
                              : []),
                            { label: '最近更新', value: activeRecord.updatedAt }
                          ]}
                        />
                      </DetailSection>
                      {activeRecordInvoiceAssociation && activeRecordInvoiceAssociation.status !== '无需关联' ? (
                        <DetailSection icon={<FileTextOutlined />} title="发票关联">
                          <CompactDetailTable<FinanceTransactionMatchedInvoice>
                            columns={invoiceRelationColumns}
                            dataSource={activeRecordInvoiceAssociation.matchedInvoices}
                            emptyText="暂无关联发票"
                            rowKey="id"
                          />
                        </DetailSection>
                      ) : null}
                      <DetailSection icon={<FileProtectOutlined />} title={getFinanceDirectionLabels(activeRecord.direction, activeRecord.paymentMethod).voucherSection}>
                        <RelatedFileTable
                          records={activeRecord.files}
                          onPreview={(file) => {
                            void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
                          }}
                          onDownload={(file) => {
                            void messageApi.success(`${file.name} 下载请求已记录`);
                          }}
                        />
                      </DetailSection>
                    </div>
                  )
                },
                {
                  key: 'logs',
                  label: '操作记录',
                  children: (
                    <OperationRecordSection icon={<AuditOutlined />} records={activeRecord.operationRecords} title="操作记录" />
                  )
                }
              ]}
            />
          </>
        ) : null}
      </DetailDrawerShell>

      <DrawerFormShell
        bodyTestId="finance-transaction-create-drawer"
        cancelAction={{ label: '取消', onClick: () => setCreateDrawerOpen(false) }}
        className="finance-transaction-drawer"
        open={createDrawerOpen}
        primaryAction={{ disabled: !formValid, label: '保存为待复核', onClick: handleCreateTransaction }}
        title={<DetailDrawerTitle status="待复核" statusToneMap={transactionStatusTone} subtitle="保存后进入流水复核" title="新增收支流水" />}
        width={860}
        onClose={() => setCreateDrawerOpen(false)}
      >
        <DetailSection icon={<WalletOutlined />} title="基础信息">
          <Row gutter={[14, 14]}>
            <Col span={8}>
              <DrawerFormField label="发生日期" required>
                <Input
                  placeholder="YYYY-MM-DD"
                  value={form.occurredAt}
                  onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))}
                />
              </DrawerFormField>
            </Col>
            <Col span={8}>
              <DrawerFormField label="收支方向" required>
                <Select
                  className="field-control"
                  data-testid="finance-transaction-direction-select"
                  value={form.direction}
                  options={(['收入', '支出'] satisfies FinanceTransactionDirection[]).map((direction) => ({ label: direction, value: direction }))}
                  onChange={handleDirectionChange}
                />
              </DrawerFormField>
            </Col>
            <Col span={8}>
              <DrawerFormField label="一级类目" required>
                <Select
                  className="field-control"
                  data-testid="finance-transaction-primary-category-select"
                  value={form.primaryCategoryId}
                  options={currentPrimaryOptions.map((category) => ({ label: category.name, value: category.id }))}
                  onChange={handlePrimaryCategoryChange}
                />
              </DrawerFormField>
            </Col>
              <Col span={8}>
                <DrawerFormField label="二级类目" required>
                  <Select
                    className="field-control"
                    data-testid="finance-transaction-category-select"
                    value={form.category}
                    options={currentCategoryOptions.map((category) => ({ label: category.name, value: category.name }))}
                    onChange={handleCategoryChange}
                  />
                </DrawerFormField>
              </Col>
              <Col span={8}>
                <DrawerFormField label={formLabels.paymentMethod} required>
                  <Select
                    className="field-control"
                    data-testid="finance-transaction-payment-method-select"
                    value={form.paymentMethod}
                    options={currentPaymentMethodOptions.map((method) => ({ label: method, value: method }))}
                    onChange={handlePaymentMethodChange}
                  />
                </DrawerFormField>
              </Col>
              <Col span={8}>
                <DrawerFormField label={formLabels.counterparty} required>
                  <Select
                    className="field-control"
                    data-testid="finance-transaction-counterparty-select"
                    optionFilterProp="label"
                    placeholder={`请选择${formLabels.counterparty}`}
                    showSearch
                    value={form.counterpartyKey || undefined}
                    options={counterpartyOptions.map((option) => ({
                      label: option.label,
                      value: option.value
                    }))}
                    onChange={handleCounterpartyChange}
                  />
                </DrawerFormField>
              </Col>
              <Col span={8}>
                <DrawerFormField label={formLabels.amount} required>
                  <Input
                    placeholder={`请输入${formLabels.amount}`}
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  />
                </DrawerFormField>
              </Col>
              {isPublicAccountMethod(form.paymentMethod) ? (
                <Col span={8}>
                  <DrawerFormField label={formLabels.publicAccount} required>
                    <Select
                      className="field-control"
                      data-testid="finance-transaction-public-account-select"
                      value={form.settlementAccount}
                      options={currentSettlementAccountOptions.map((option) => ({
                        label: option.label,
                        value: option.label
                      }))}
                      onChange={handleSettlementAccountChange}
                    />
                  </DrawerFormField>
                </Col>
              ) : (
                <Col span={8}>
                  <DrawerFormField label={formLabels.handler} required>
                    <Select
                      className="field-control"
                      data-testid="finance-transaction-handler-select"
                      optionFilterProp="label"
                      placeholder={`请选择${formLabels.handler}`}
                      showSearch
                      value={form.handler || undefined}
                      options={handlerOptions.map((option) => ({
                        label: option.label,
                        value: option.value
                      }))}
                      onChange={(handler) => setForm((current) => ({ ...current, handler }))}
                    />
                  </DrawerFormField>
                </Col>
              )}
            </Row>
          </DetailSection>
          <DetailSection icon={<FileSearchOutlined />} title="业务来源">
            <Row gutter={[14, 14]}>
              <Col span={8}>
                <ReadOnlyField density="compact" label="来源类型" testId="finance-transaction-source-type-input" value={form.sourceType} />
              </Col>
              <Col span={8}>
                <DrawerFormField label="来源单号">
                  <Input
                    placeholder="未填写时自动生成"
                    value={form.sourceNo}
                    onChange={(event) => setForm((current) => ({ ...current, sourceNo: event.target.value }))}
                  />
                </DrawerFormField>
              </Col>
              <Col span={8}>
                <DrawerFormField label="事项说明" required>
                  <Input
                    placeholder="例如合同回款、绩效发放或报销事项"
                    value={form.sourceTitle}
                    onChange={(event) => setForm((current) => ({ ...current, sourceTitle: event.target.value }))}
                  />
                </DrawerFormField>
              </Col>
              <Col span={24}>
                <DrawerFormField label="备注" wide>
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 3 }}
                    placeholder="补充说明，可不填"
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  />
                </DrawerFormField>
              </Col>
            </Row>
          </DetailSection>
          <DetailSection icon={<FileProtectOutlined />} title={formLabels.voucherSection}>
            <FinanceVoucherUploadPanel
              emptyText={formLabels.voucherEmpty}
              files={form.voucherFiles}
              title={formLabels.uploadVoucher}
              onRemove={handleVoucherFileRemove}
              onSelect={handleVoucherFileSelect}
            />
          </DetailSection>
      </DrawerFormShell>
    </ManagementPageScaffold>
  );
}
