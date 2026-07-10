import {
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  FileExcelOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  FormOutlined,
  LinkOutlined,
  SwapOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, Select, Space, Upload, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { ImportDrawerShell } from '../../components/DrawerShell';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import type { OperationRecord } from '../../components/OperationRecordTable';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText, CompactCell, type CellTextTone } from '../../components/TableCell';
import {
  getDefaultPublicAccountRef,
  resolveActivePublicAccountRef,
  type PublicAccountRef,
  usePublicAccountConfigState
} from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import { FinanceTransactionAdjustmentDrawer } from './FinanceTransactionAdjustmentDrawer';
import { getClosedAccountingPeriodReadbackNotice } from './financeAccountingVoucherModel';
import { getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';
import {
  buildBankStatementImportPrecheck,
  buildPeriodCounts,
  formatPeriodCountList,
  formatPeriodList,
  getBankStatementAccountingPeriods,
  getStatementBatchPeriodCode,
  getStatementDateRangeLabel,
  getStatementPeriod,
  requiredBankStatementImportFieldLabels,
  type BankImportPrecheckItem,
  type BankImportPrecheckLevel,
  type BankMatchStatus,
  type BankStatementDirection,
  type BankStatementRecord
} from './financeBankImportContract';
import {
  buildFinanceTransactionFromBankStatement,
  createBankReconciliationFlowForm,
  getBankReconciliationResolution,
  getBankReconciliationCategoryOptions,
  getBankReconciliationPrimaryCategoryOptions,
  getDefaultBankReconciliationCategory,
  type BankReconciliationResolution,
  type BankReconciliationFlowFormValue
} from './financeBankReconciliationModel';
import {
  financeToday,
  formatMoney,
  getFinanceRecordCategorySnapshot,
  getPublicAccountSignedAmount,
  reconciliationStatusTone,
  transactionStatusTone
} from './financeUtils';

type BankDisplayStatus = '待处理' | '待确认' | '金额不一致' | '已对账' | '跳过';

type BankImportBatch = Pick<BankStatementRecord, 'importedAccountName' | 'publicAccountId' | 'publicAccountSnapshot'> & {
  batchNo: string;
  duplicateRows: number;
  amountMismatchRows: number;
  fileName: string;
  id: string;
  importedAt: string;
  matchedRows: number;
  statementRange: string;
  status: '已导入' | '导入预览';
  totalRows: number;
};

type MatchAction = {
  actionLabel: string;
};

type SystemCandidateRow = {
  difference: number | undefined;
  record: FinanceTransactionRecord;
  score: number;
};

type ConfirmEligibility = {
  canConfirm: boolean;
  reason?: string;
};

type BankQuickActionMode = 'create-system-flow' | 'import-bank-statement' | 'waiting-review';

const seedBankPublicAccountRef = getFinanceSeedPublicAccountRef('public-account-cmb-basic');
const seedBankPublicAccountName = seedBankPublicAccountRef.publicAccountSnapshot.displayName;
const seedSecondaryPaymentPublicAccountRef = getFinanceSeedPublicAccountRef('public-account-icbc-payment-reserve');
const seedSecondaryPaymentPublicAccountName = seedSecondaryPaymentPublicAccountRef.publicAccountSnapshot.displayName;

const amountMismatchStatuses = new Set<BankMatchStatus>(['金额不一致']);

const displayMatchStatusTone = {
  待处理: 'amber',
  待确认: 'blue',
  金额不一致: 'red',
  已对账: 'green',
  跳过: 'gray'
} as const;

const importPrecheckTone = {
  通过: 'green',
  提示: 'amber',
  阻断: 'red'
} as const;

const importPreviewResultTone = {
  待处理: 'amber',
  待确认: 'blue',
  金额不一致: 'red',
  已对账: 'green',
  跳过: 'gray',
  阻断: 'red'
} as const;

const queueStatusPriority: Record<BankMatchStatus, number> = {
  金额不一致: 1,
  银行未匹配: 2,
  系统未匹配: 2,
  暂不可对账: 3,
  待确认: 4,
  重复导入: 9,
  已对账: 9
};

function getDisplayMatchStatus(status: BankMatchStatus): BankDisplayStatus {
  if (status === '已对账') {
    return '已对账';
  }

  if (status === '待确认') {
    return '待确认';
  }

  if (amountMismatchStatuses.has(status)) {
    return '金额不一致';
  }

  if (status === '重复导入') {
    return '跳过';
  }

  return '待处理';
}

const bankStatementSeeds: BankStatementRecord[] = [
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 4600,
    balance: 188593.12,
    bankSerialNo: 'CMB202606160003',
    batchNo: 'BANK-IMP-202606-03',
    counterparty: '蓝岛咖啡',
    direction: '入账',
    id: 'bank-statement-007',
    importedAt: '2026-06-19 10:20',
    matchedTransactionIds: [],
    matchReason: '银行已有入账，系统尚未形成对公账户流水',
    matchStatus: '银行未匹配',
    matchScore: 38,
    statementDate: '2026-06-16',
    summary: '蓝岛咖啡门店方案补充回款'
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 3000,
    balance: 191593.12,
    bankSerialNo: '待补导入',
    batchNo: '系统待补导入',
    counterparty: '美刻咖啡',
    direction: '入账',
    id: 'bank-statement-008',
    importedAt: '2026-06-19 10:20',
    matchedTransactionIds: ['fin-flow-008'],
    matchReason: '系统流水已入账，尚未导入对应银行明细',
    matchStatus: '系统未匹配',
    matchScore: 55,
    statementDate: '2026-06-18',
    summary: '美刻咖啡门店设计阶段款'
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 68000,
    balance: 188000,
    bankSerialNo: 'CMB202606030001',
    batchNo: 'BANK-IMP-202606-01',
    counterparty: '奈雪华南区域',
    direction: '入账',
    id: 'bank-statement-001',
    importedAt: '2026-06-04 09:20',
    matchedTransactionIds: ['fin-flow-001'],
    matchReason: '金额、方向、日期、合同号一致',
    matchStatus: '已对账',
    matchScore: 98,
    statementDate: '2026-06-03',
    summary: '奈雪华南门店设计服务合同 CON-2026-001 回款'
  },
  {
    importedAccountName: seedSecondaryPaymentPublicAccountName,
    ...seedSecondaryPaymentPublicAccountRef,
    amount: 12000,
    balance: 176000,
    bankSerialNo: 'CMB202605210001',
    batchNo: 'BANK-IMP-202605-01',
    counterparty: '示例客户 A',
    direction: '入账',
    id: 'bank-statement-006',
    importedAt: '2026-06-24 10:40',
    matchedTransactionIds: ['fin-flow-015'],
    matchReason: '银行日期在 5 月，系统流水已复核入账且仍未完成银行对账',
    matchStatus: '待确认',
    matchScore: 92,
    statementDate: '2026-05-21',
    summary: '示例客户 A 项目阶段款 CON-2026-005'
  },
  {
    importedAccountName: seedSecondaryPaymentPublicAccountName,
    ...seedSecondaryPaymentPublicAccountRef,
    amount: 12000,
    balance: 176000,
    bankSerialNo: 'CMB202606100001',
    batchNo: 'BANK-IMP-202606-01',
    counterparty: '赵倩',
    direction: '出账',
    id: 'bank-statement-002',
    importedAt: '2026-06-11 10:10',
    matchedTransactionIds: ['fin-flow-003'],
    matchReason: '金额、方向、员工姓名一致，待人工确认',
    matchStatus: '待确认',
    matchScore: 95,
    statementDate: '2026-06-10',
    summary: '赵倩 2026-06 工资发放'
  },
  {
    importedAccountName: seedSecondaryPaymentPublicAccountName,
    ...seedSecondaryPaymentPublicAccountRef,
    amount: 1806.88,
    balance: 174193.12,
    bankSerialNo: 'CMB202606100002',
    batchNo: 'BANK-IMP-202606-02',
    counterparty: '陈思',
    direction: '出账',
    id: 'bank-statement-003',
    importedAt: '2026-06-12 09:15',
    matchedTransactionIds: ['fin-flow-002'],
    matchReason: '系统流水仍在复核中，不能确认对账',
    matchStatus: '暂不可对账',
    matchScore: 82,
    statementDate: '2026-06-10',
    summary: '陈思 2026-06 绩效预发'
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 9800,
    balance: 183993.12,
    bankSerialNo: 'CMB202606140001',
    batchNo: 'BANK-IMP-202606-02',
    counterparty: '星河餐饮集团',
    direction: '入账',
    id: 'bank-statement-004',
    importedAt: '2026-06-14 16:40',
    matchedTransactionIds: ['fin-flow-005'],
    matchReason: '系统流水已生成，等待流水复核后确认对账',
    matchStatus: '暂不可对账',
    matchScore: 86,
    statementDate: '2026-06-14',
    summary: '星河餐饮集团门店设计首款'
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 3000,
    balance: 180993.12,
    bankSerialNo: 'CMB202606120002',
    batchNo: 'BANK-IMP-202606-02',
    counterparty: '示例兼职 B',
    direction: '出账',
    id: 'bank-statement-005',
    importedAt: '2026-06-14 16:40',
    matchedTransactionIds: ['fin-flow-004'],
    matchReason: '对象和日期接近，但银行金额与系统金额不一致',
    matchStatus: '金额不一致',
    matchScore: 61,
    statementDate: '2026-06-12',
    summary: '空间设计外协任务结算'
  }
];

const importBatchSeeds: BankImportBatch[] = [
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amountMismatchRows: 0,
    batchNo: 'BANK-IMP-202606-01',
    duplicateRows: 0,
    fileName: '招商银行基本户_2026-06-01至2026-06-11.xlsx',
    id: 'bank-import-001',
    importedAt: '2026-06-11 10:10',
    matchedRows: 1,
    statementRange: '2026-06-03 至 2026-06-10',
    status: '已导入',
    totalRows: 2
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amountMismatchRows: 0,
    batchNo: 'BANK-IMP-202605-01',
    duplicateRows: 0,
    fileName: '招商银行基本户_2026-05-21.xlsx',
    id: 'bank-import-003',
    importedAt: '2026-06-24 10:40',
    matchedRows: 0,
    statementRange: '2026-05-21',
    status: '已导入',
    totalRows: 1
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amountMismatchRows: 1,
    batchNo: 'BANK-IMP-202606-02',
    duplicateRows: 0,
    fileName: '招商银行基本户_2026-06-12至2026-06-14.xlsx',
    id: 'bank-import-002',
    importedAt: '2026-06-14 16:40',
    matchedRows: 0,
    statementRange: '2026-06-12 至 2026-06-14',
    status: '已导入',
    totalRows: 3
  }
];

const importPreviewSeedRows: BankStatementRecord[] = [
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 9800,
    balance: 183993.12,
    bankSerialNo: 'CMB202606140001',
    batchNo: '导入预览',
    counterparty: '星河餐饮集团',
    direction: '入账',
    id: 'bank-preview-001',
    importedAt: financeToday,
    matchedTransactionIds: [],
    matchReason: '银行已有入账，系统尚未形成对公账户流水',
    matchStatus: '银行未匹配',
    matchScore: 42,
    statementDate: '2026-06-14',
    summary: '星河餐饮集团门店设计首款'
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 3000,
    balance: 180993.12,
    bankSerialNo: 'CMB202606120002',
    batchNo: '导入预览',
    counterparty: '示例兼职 B',
    direction: '出账',
    id: 'bank-preview-002',
    importedAt: financeToday,
    matchedTransactionIds: ['fin-flow-004'],
    matchReason: '对象和日期接近，但银行金额与系统金额不一致',
    matchStatus: '金额不一致',
    matchScore: 61,
    statementDate: '2026-06-12',
    summary: '空间设计外协任务结算'
  },
  {
    importedAccountName: seedBankPublicAccountName,
    ...seedBankPublicAccountRef,
    amount: 4600,
    balance: 188593.12,
    bankSerialNo: 'CMB202606150001',
    batchNo: '导入预览',
    counterparty: '麦田轻食',
    direction: '入账',
    id: 'bank-preview-003',
    importedAt: financeToday,
    matchedTransactionIds: [],
    matchReason: '银行已有入账，系统尚未形成对公账户流水',
    matchStatus: '银行未匹配',
    matchScore: 40,
    statementDate: '2026-06-15',
    summary: '麦田轻食项目补充回款'
  }
];

function buildImportPreviewRowsForAccount(rows: BankStatementRecord[], publicAccountRef: PublicAccountRef) {
  return rows.map((record) => ({
    ...record,
    importedAccountName: publicAccountRef.publicAccountSnapshot.displayName,
    publicAccountId: publicAccountRef.publicAccountId,
    publicAccountSnapshot: publicAccountRef.publicAccountSnapshot
  }));
}

function isPublicAccountMovement(record: FinanceTransactionRecord) {
  if (record.status === '已作废' || !record.publicAccountId) {
    return false;
  }

  return (
    record.paymentMethod === '对公账户收款' ||
    record.paymentMethod === '对公账户付款' ||
    record.paymentMethod === '员工代收' ||
    record.paymentMethod === '现金暂收' ||
    record.direction === '内部转入'
  );
}

function formatSignedMoney(amount: number, direction: BankStatementDirection) {
  const sign = direction === '出账' ? '-' : '';
  return `${sign}${formatMoney(amount)}`;
}

function getBankAmountTone(direction: BankStatementDirection): CellTextTone {
  return direction === '入账' ? 'income' : 'expense';
}

function getSystemAmountLabel(record: FinanceTransactionRecord) {
  const signedAmount = getPublicAccountSignedAmount(record);
  return signedAmount < 0 ? `-${formatMoney(Math.abs(signedAmount))}` : formatMoney(signedAmount);
}

function getSystemAmountTone(record: FinanceTransactionRecord): CellTextTone {
  const signedAmount = getPublicAccountSignedAmount(record);
  return signedAmount < 0 ? 'expense' : 'income';
}

function getAmountDifference(record: BankStatementRecord, systemRecord?: FinanceTransactionRecord) {
  if (!systemRecord) {
    return undefined;
  }

  return record.amount - Math.abs(getPublicAccountSignedAmount(systemRecord));
}

function formatDifference(amount: number | undefined) {
  if (amount === undefined) {
    return '-';
  }

  if (amount === 0) {
    return formatMoney(0);
  }

  const sign = amount > 0 ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(amount))}`;
}

function getDifferenceTone(amount: number | undefined): CellTextTone {
  if (amount === undefined || amount === 0) {
    return 'muted';
  }

  return 'expense';
}

function getSystemBankDirection(record: FinanceTransactionRecord): BankStatementDirection {
  return getPublicAccountSignedAmount(record) < 0 ? '出账' : '入账';
}

function getPrimaryMatchedTransactionId(record: BankStatementRecord) {
  return record.matchedTransactionIds[0];
}

function getPrimaryMatchedSystemRecord(
  record: BankStatementRecord | undefined,
  systemRowsById: Map<string, FinanceTransactionRecord>
) {
  const transactionId = record ? getPrimaryMatchedTransactionId(record) : undefined;

  return transactionId ? systemRowsById.get(transactionId) : undefined;
}

function getStatementDateTime(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function getDateDistanceDays(firstDate: string, secondDate: string) {
  return Math.abs(Math.round((getStatementDateTime(firstDate) - getStatementDateTime(secondDate)) / 86400000));
}

function getDateRelationLabel(record: BankStatementRecord, systemRecord?: FinanceTransactionRecord) {
  if (!systemRecord) {
    return '-';
  }

  const bankPeriod = getStatementPeriod(record.statementDate);
  const systemPeriod = systemRecord.accountingPeriod;

  if (record.statementDate === systemRecord.occurredAt) {
    return '同日';
  }

  const distance = getDateDistanceDays(record.statementDate, systemRecord.occurredAt);

  if (bankPeriod === systemPeriod) {
    return `同月相差 ${distance} 天`;
  }

  return `${bankPeriod} 银行 / ${systemPeriod} 系统`;
}

function getMatchAction(
  record: BankStatementRecord,
  systemRecord?: FinanceTransactionRecord,
  resolution?: BankReconciliationResolution
): MatchAction {
  const effectiveStatus = resolution?.effectiveStatus ?? record.matchStatus;

  if (effectiveStatus === '已对账') {
    return {
      actionLabel: '已完成'
    };
  }

  if (effectiveStatus === '银行未匹配') {
    return {
      actionLabel: '补登记系统流水'
    };
  }

  if (effectiveStatus === '系统未匹配') {
    return {
      actionLabel: '补充银行流水'
    };
  }

  if (effectiveStatus === '重复导入') {
    return {
      actionLabel: '自动跳过'
    };
  }

  if (effectiveStatus === '金额不一致') {
    return {
      actionLabel: '核对匹配'
    };
  }

  if (resolution && resolution.pendingAdjustmentRecords.length > 0) {
    return {
      actionLabel: '等待调整复核'
    };
  }

  if (systemRecord?.status === '待复核' || (effectiveStatus === '暂不可对账' && systemRecord?.status !== '已入账')) {
    return {
      actionLabel: '等待流水复核'
    };
  }

  if (effectiveStatus === '待确认') {
    return {
      actionLabel: '人工确认'
    };
  }

  if (effectiveStatus === '暂不可对账' && systemRecord?.status === '已入账') {
    return {
      actionLabel: '待转确认'
    };
  }

  return {
    actionLabel: '核对匹配'
  };
}

function getQuickActionMode(
  record: BankStatementRecord,
  systemRecord?: FinanceTransactionRecord,
  resolution?: BankReconciliationResolution
): BankQuickActionMode | undefined {
  const effectiveStatus = resolution?.effectiveStatus ?? record.matchStatus;

  if (effectiveStatus === '银行未匹配') {
    return 'create-system-flow';
  }

  if (effectiveStatus === '系统未匹配') {
    return 'import-bank-statement';
  }

  if (
    resolution?.pendingAdjustmentRecords.length ||
    systemRecord?.status === '待复核' ||
    (effectiveStatus === '暂不可对账' && systemRecord?.status !== '已入账')
  ) {
    return 'waiting-review';
  }

  return undefined;
}

function getQuickActionLabel(mode: BankQuickActionMode) {
  if (mode === 'create-system-flow') {
    return '补登记系统流水';
  }

  if (mode === 'import-bank-statement') {
    return '补充银行流水';
  }

  return '查看复核进度';
}

function getCandidateScore(record: BankStatementRecord, systemRecord: FinanceTransactionRecord) {
  const difference = getAmountDifference(record, systemRecord);
  const absDifference = difference === undefined ? Number.POSITIVE_INFINITY : Math.abs(difference);
  let score = 0;

  if (record.direction === getSystemBankDirection(systemRecord)) {
    score += 20;
  }

  if (absDifference === 0) {
    score += 35;
  } else if (absDifference <= 200) {
    score += 18;
  }

  const dateDistance = getDateDistanceDays(record.statementDate, systemRecord.occurredAt);

  if (dateDistance === 0) {
    score += 15;
  } else if (dateDistance <= 3) {
    score += 10;
  } else if (getStatementPeriod(record.statementDate) === systemRecord.accountingPeriod) {
    score += 5;
  }

  if (record.counterparty.includes(systemRecord.counterparty) || systemRecord.counterparty.includes(record.counterparty)) {
    score += 20;
  }

  if (record.summary.includes(systemRecord.sourceTitle) || systemRecord.sourceTitle.includes(record.summary) || record.summary.includes(systemRecord.sourceType)) {
    score += 10;
  }

  return { difference, score };
}

function buildSystemCandidates(record: BankStatementRecord, systemRows: FinanceTransactionRecord[]) {
  return systemRows
    .filter((systemRecord) => systemRecord.publicAccountId === record.publicAccountId)
    .map((systemRecord) => {
      const result = getCandidateScore(record, systemRecord);
      return {
        difference: result.difference,
        record: systemRecord,
        score: result.score
      };
    })
    .filter((candidate) => candidate.score >= 45)
    .sort((first, second) => second.score - first.score)
    .slice(0, 3);
}

function getConfirmEligibility(
  record: BankStatementRecord | undefined,
  systemRecord: FinanceTransactionRecord | undefined,
  bankStatements: BankStatementRecord[],
  resolution?: BankReconciliationResolution
): ConfirmEligibility {
  if (!record) {
    return { canConfirm: false };
  }

  const effectiveStatus = resolution?.effectiveStatus ?? record.matchStatus;

  if (effectiveStatus === '已对账') {
    return { canConfirm: false, reason: '已完成对账' };
  }

  if (effectiveStatus !== '待确认') {
    return { canConfirm: false, reason: '当前状态需先处理，不能直接确认' };
  }

  if (!systemRecord) {
    return { canConfirm: false, reason: '没有匹配的系统流水' };
  }

  if (systemRecord.publicAccountId !== record.publicAccountId) {
    return { canConfirm: false, reason: '银行账户与系统流水账户不一致' };
  }

  if (systemRecord.status !== '已入账') {
    return { canConfirm: false, reason: '系统流水尚未复核入账' };
  }

  if (resolution?.canConfirmWithAdjustments) {
    const recordsToConfirm = [systemRecord, ...resolution.reviewedAdjustmentRecords];
    const hasReconciledRecord = recordsToConfirm.some((item) => item.reconciliationStatus === '已对账');

    if (hasReconciledRecord) {
      return { canConfirm: false, reason: '关联流水已被对账' };
    }

    return { canConfirm: true };
  }

  if (record.direction !== getSystemBankDirection(systemRecord)) {
    return { canConfirm: false, reason: '银行方向与系统流水方向不一致' };
  }

  const difference = getAmountDifference(record, systemRecord);

  if (difference !== 0) {
    return { canConfirm: false, reason: '银行金额与系统金额不一致' };
  }

  const systemRecordUsed = bankStatements.some(
    (bankRecord) =>
      bankRecord.id !== record.id &&
      bankRecord.matchedTransactionIds.includes(systemRecord.id) &&
      bankRecord.matchStatus === '已对账'
  );

  if (systemRecordUsed || systemRecord.reconciliationStatus === '已对账') {
    return { canConfirm: false, reason: '系统流水已被对账' };
  }

  return { canConfirm: true };
}

function buildBatchNo(batchCount: number, records: BankStatementRecord[]) {
  return `BANK-IMP-${getStatementBatchPeriodCode(records, financeToday.replaceAll('-', ''))}-${String(batchCount + 1).padStart(2, '0')}`;
}

export function FinanceBankReconciliationPage() {
  const { addFinanceTransaction, confirmBankReconciliation, financeRows, getAccountingPeriodGuard } = useFinanceManagement();
  const { publicAccounts } = usePublicAccountConfigState();
  const [messageApi, contextHolder] = message.useMessage();
  const [bankStatements, setBankStatements] = useState<BankStatementRecord[]>(bankStatementSeeds);
  const [importBatches, setImportBatches] = useState<BankImportBatch[]>(importBatchSeeds);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [selectedImportFileName, setSelectedImportFileName] = useState<string>();
  const [quickActionMode, setQuickActionMode] = useState<BankQuickActionMode>();
  const [quickActionRecordId, setQuickActionRecordId] = useState<string>();
  const [adjustmentRecordId, setAdjustmentRecordId] = useState<string>();
  const [selectedImportPublicAccountId, setSelectedImportPublicAccountId] = useState(seedBankPublicAccountRef.publicAccountId);
  const [quickFlowForm, setQuickFlowForm] = useState<BankReconciliationFlowFormValue>(() => createBankReconciliationFlowForm());

  const selectedImportPublicAccountRef = useMemo(
    () =>
      resolveActivePublicAccountRef(publicAccounts, selectedImportPublicAccountId, '银行对账') ??
      getDefaultPublicAccountRef(publicAccounts, '银行对账'),
    [publicAccounts, selectedImportPublicAccountId]
  );
  const selectedImportPublicAccountName = selectedImportPublicAccountRef?.publicAccountSnapshot.displayName ?? '';
  const importPreviewRows = useMemo(
    () => (selectedImportPublicAccountRef ? buildImportPreviewRowsForAccount(importPreviewSeedRows, selectedImportPublicAccountRef) : []),
    [selectedImportPublicAccountRef]
  );
  const bankImportAccountOptions = useMemo(
    () =>
      publicAccounts
        .filter((account) => account.status === '启用' && account.usage.includes('银行对账'))
        .map((account) => ({ label: account.displayName, value: account.id })),
    [publicAccounts]
  );

  const publicAccountRows = useMemo(() => financeRows.filter(isPublicAccountMovement), [financeRows]);
  const systemRowsById = useMemo(() => new Map(publicAccountRows.map((record) => [record.id, record])), [publicAccountRows]);
  const bankResolutionById = useMemo(
    () =>
      new Map(
        bankStatements.map((record) => [
          record.id,
          getBankReconciliationResolution(
            record,
            getPrimaryMatchedSystemRecord(record, systemRowsById),
            publicAccountRows
          )
        ])
      ),
    [bankStatements, publicAccountRows, systemRowsById]
  );
  const unreconciledSystemPeriodCounts = useMemo(
    () =>
      buildPeriodCounts(
        publicAccountRows
          .filter((record) => record.status === '已入账' && record.reconciliationStatus !== '已对账')
          .map((record) => record.accountingPeriod)
      ),
    [publicAccountRows]
  );
  const queueRows = useMemo(
    () =>
      bankStatements
        .filter((record) => {
          const effectiveStatus = bankResolutionById.get(record.id)?.effectiveStatus ?? record.matchStatus;
          return effectiveStatus !== '已对账' && effectiveStatus !== '重复导入';
        })
        .sort((first, second) => {
          const firstStatus = bankResolutionById.get(first.id)?.effectiveStatus ?? first.matchStatus;
          const secondStatus = bankResolutionById.get(second.id)?.effectiveStatus ?? second.matchStatus;
          const statusOrder = queueStatusPriority[firstStatus] - queueStatusPriority[secondStatus];
          return statusOrder === 0 ? second.statementDate.localeCompare(first.statementDate) : statusOrder;
        }),
    [bankResolutionById, bankStatements]
  );
  const activeRecord = useMemo(() => {
    const selectedRecord = bankStatements.find((record) => record.id === activeRecordId);
    const selectedEffectiveStatus = selectedRecord
      ? (bankResolutionById.get(selectedRecord.id)?.effectiveStatus ?? selectedRecord.matchStatus)
      : undefined;

    if (selectedRecord && selectedEffectiveStatus !== '已对账' && selectedEffectiveStatus !== '重复导入') {
      return selectedRecord;
    }

    return queueRows[0];
  }, [activeRecordId, bankResolutionById, bankStatements, queueRows]);
  const activeSystemRecord = getPrimaryMatchedSystemRecord(activeRecord, systemRowsById);
  const activeSystemPeriodGuard = activeSystemRecord
    ? getAccountingPeriodGuard(activeSystemRecord.accountingPeriod, '确认银行对账')
    : undefined;
  const activeSystemPeriodLocked = activeSystemPeriodGuard ? !activeSystemPeriodGuard.allowed : false;
  const activeResolution = activeRecord ? bankResolutionById.get(activeRecord.id) : undefined;
  const activeEffectiveStatus = activeResolution?.effectiveStatus ?? activeRecord?.matchStatus;
  const activeDisplayDifference = activeResolution?.relatedAdjustmentRecords.length
    ? activeResolution.remainingDifference
    : (activeRecord ? getAmountDifference(activeRecord, activeSystemRecord) : undefined);
  const activeMatchAction = activeRecord ? getMatchAction(activeRecord, activeSystemRecord, activeResolution) : undefined;
  const activeQuickActionMode = activeRecord ? getQuickActionMode(activeRecord, activeSystemRecord, activeResolution) : undefined;
  const activeQuickActionPeriod = activeRecord && activeQuickActionMode
    ? activeQuickActionMode === 'create-system-flow'
      ? getStatementPeriod(activeRecord.statementDate)
      : activeSystemRecord?.accountingPeriod ?? getStatementPeriod(activeRecord.statementDate)
    : undefined;
  const activeQuickActionLabel = activeQuickActionMode === 'create-system-flow'
    ? '补登记系统流水'
    : activeQuickActionMode === 'import-bank-statement'
      ? '补充银行流水'
      : '处理银行对账';
  const activeQuickActionPeriodGuard = activeQuickActionPeriod
    ? getAccountingPeriodGuard(activeQuickActionPeriod, activeQuickActionLabel)
    : undefined;
  const activeQuickActionPeriodLocked = activeQuickActionPeriodGuard ? !activeQuickActionPeriodGuard.allowed : false;
  const activePeriodReadbackNotice = activeSystemRecord && activeSystemPeriodLocked
    ? getClosedAccountingPeriodReadbackNotice(activeSystemRecord.accountingPeriod, '当前银行对账事项')
    : activeQuickActionPeriod && activeQuickActionPeriodLocked
      ? getClosedAccountingPeriodReadbackNotice(activeQuickActionPeriod, '当前银行对账事项')
      : undefined;
  const activeHasPendingAdjustment = Boolean(activeResolution?.pendingAdjustmentRecords.length);
  const activeShowConfirmAction = activeEffectiveStatus === '待确认';
  const activeShowAmountMismatchAction = Boolean(
    activeRecord &&
      activeRecord.matchStatus === '金额不一致' &&
      activeSystemRecord &&
      !activeHasPendingAdjustment &&
      !activeResolution?.canConfirmWithAdjustments
  );
  const activeShowFooterActions = Boolean((activeRecord && activeQuickActionMode) || activeShowConfirmAction || activeShowAmountMismatchAction);
  const quickActionRecord = useMemo(
    () => bankStatements.find((record) => record.id === quickActionRecordId),
    [bankStatements, quickActionRecordId]
  );
  const quickActionSystemRecord = getPrimaryMatchedSystemRecord(quickActionRecord, systemRowsById);
  const quickActionResolution = quickActionRecord ? bankResolutionById.get(quickActionRecord.id) : undefined;
  const quickActionWaitingRecord = quickActionResolution?.pendingAdjustmentRecords[0] ?? quickActionSystemRecord;
  const adjustmentRecord = useMemo(
    () => bankStatements.find((record) => record.id === adjustmentRecordId),
    [adjustmentRecordId, bankStatements]
  );
  const adjustmentSystemRecord = getPrimaryMatchedSystemRecord(adjustmentRecord, systemRowsById);
  const quickPrimaryCategoryOptions = quickActionRecord ? getBankReconciliationPrimaryCategoryOptions(quickActionRecord.direction) : [];
  const quickCategoryOptions = quickActionRecord ? getBankReconciliationCategoryOptions(quickActionRecord.direction, quickFlowForm.primaryCategoryId) : [];
  const activeSystemCandidates = useMemo(
    () => (activeRecord ? buildSystemCandidates(activeRecord, publicAccountRows) : []),
    [activeRecord, publicAccountRows]
  );
  const activeConfirmEligibility = useMemo(
    () => getConfirmEligibility(activeRecord, activeSystemRecord, bankStatements, activeResolution),
    [activeRecord, activeResolution, activeSystemRecord, bankStatements]
  );
  const activeOperationRecords = useMemo<OperationRecord[]>(
    () =>
      activeSystemRecord
        ? [...activeSystemRecord.operationRecords].sort((first, second) => second.time.localeCompare(first.time))
        : [],
    [activeSystemRecord]
  );

  const matchedCount = bankStatements.filter((record) => (bankResolutionById.get(record.id)?.effectiveStatus ?? record.matchStatus) === '已对账').length;
  const confirmCount = bankStatements.filter((record) => (bankResolutionById.get(record.id)?.effectiveStatus ?? record.matchStatus) === '待确认').length;
  const amountMismatchCount = bankStatements.filter((record) => amountMismatchStatuses.has(bankResolutionById.get(record.id)?.effectiveStatus ?? record.matchStatus)).length;
  const bankImportPrecheck = useMemo(
    () =>
      buildBankStatementImportPrecheck({
        existingRows: bankStatements,
        previewRows: importPreviewRows,
        requiredPeriodCounts: unreconciledSystemPeriodCounts,
        selectedPublicAccount: selectedImportPublicAccountRef
      }),
    [bankStatements, importPreviewRows, selectedImportPublicAccountRef, unreconciledSystemPeriodCounts]
  );
  const importablePreviewRows = bankImportPrecheck.importableRows;
  const importPrecheckItems = bankImportPrecheck.items;
  const importHasBlockingPrecheck = bankImportPrecheck.hasBlockingIssue;
  const importPeriodGuard = getBankStatementAccountingPeriods(importablePreviewRows)
    .map((accountingPeriod) => getAccountingPeriodGuard(accountingPeriod, '导入银行流水'))
    .find((periodGuard) => !periodGuard.allowed);

  function handleConfirmImport() {
    if (!selectedImportFileName) {
      return;
    }

    if (!selectedImportPublicAccountRef) {
      void messageApi.warning('请先配置启用且支持银行对账的对公账户');
      return;
    }

    if (importHasBlockingPrecheck) {
      void messageApi.warning('导入预检未通过，请先修正文件');
      return;
    }

    if (importPeriodGuard) {
      void messageApi.warning(importPeriodGuard.reason);
      return;
    }

    if (importablePreviewRows.length === 0) {
      void messageApi.warning('本次文件没有可入池的新流水');
      return;
    }

    const importTime = `${financeToday} 11:20`;
    const importIdentity = Date.now();
    const nextBatchNo = buildBatchNo(importBatches.length, importablePreviewRows);
    const nextRows = importablePreviewRows.map((record, index) => ({
      ...record,
      batchNo: nextBatchNo,
      id: `${record.id}-${importIdentity}-${index}`,
      importedAt: importTime
    }));

    setBankStatements((current) => [...nextRows, ...current]);
    setImportBatches((current) => [
      {
        importedAccountName: selectedImportPublicAccountName,
        publicAccountId: selectedImportPublicAccountRef.publicAccountId,
        publicAccountSnapshot: selectedImportPublicAccountRef.publicAccountSnapshot,
        amountMismatchRows: nextRows.filter((record) => amountMismatchStatuses.has(record.matchStatus)).length,
        batchNo: nextBatchNo,
        duplicateRows: bankImportPrecheck.summary.duplicateCount,
        fileName: selectedImportFileName,
        id: `bank-import-${importIdentity}`,
        importedAt: importTime,
        matchedRows: nextRows.filter((record) => record.matchStatus === '已对账').length,
        statementRange: getStatementDateRangeLabel(nextRows),
        status: '已导入',
        totalRows: importPreviewRows.length
      },
      ...current
    ]);
    setSelectedImportFileName(undefined);
    setImportDrawerOpen(false);
    void messageApi.success(`已导入 ${nextRows.length} 条，跳过重复 ${bankImportPrecheck.summary.duplicateCount} 条`);
  }

  function handleConfirmActiveReconciliation() {
    if (!activeRecord || !activeSystemRecord) {
      return;
    }

    if (!activeConfirmEligibility.canConfirm) {
      void messageApi.warning(activeConfirmEligibility.reason ?? '当前记录不能确认对账');
      return;
    }

    const recordsToConfirm = activeResolution?.canConfirmWithAdjustments
      ? [activeSystemRecord, ...activeResolution.reviewedAdjustmentRecords]
      : [activeSystemRecord];
    const confirmedTransactionNos = recordsToConfirm.map((record) => record.transactionNo).join('、');
    const lockedRecord = recordsToConfirm.find((record) => !getAccountingPeriodGuard(record.accountingPeriod, '确认银行对账').allowed);

    if (lockedRecord) {
      const periodGuard = getAccountingPeriodGuard(lockedRecord.accountingPeriod, '确认银行对账');
      void messageApi.warning(periodGuard.reason);
      return;
    }

    if (!confirmBankReconciliation(activeRecord, recordsToConfirm)) {
      void messageApi.warning('当前会计期间已锁定，不能确认银行对账');
      return;
    }

    setBankStatements((current) =>
      current.map((record) =>
        record.id === activeRecord.id
          ? {
              ...record,
              matchedTransactionIds: recordsToConfirm.map((item) => item.id),
              matchReason: `已人工确认匹配系统流水 ${confirmedTransactionNos}`,
              matchScore: Math.max(record.matchScore, 95),
              matchStatus: '已对账'
            }
          : record
      )
    );
    void messageApi.success('已确认对账');
  }

  function updateQuickFlowForm<K extends keyof BankReconciliationFlowFormValue>(field: K, value: BankReconciliationFlowFormValue[K]) {
    setQuickFlowForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleQuickPrimaryCategoryChange(primaryCategoryId: string) {
    if (!quickActionRecord) {
      return;
    }

    setQuickFlowForm((currentForm) => ({
      ...currentForm,
      category: getDefaultBankReconciliationCategory(quickActionRecord, primaryCategoryId),
      primaryCategoryId
    }));
  }

  function openQuickAction(record: BankStatementRecord, mode: BankQuickActionMode) {
    setQuickActionRecordId(record.id);
    setQuickActionMode(mode);

    if (mode === 'create-system-flow') {
      setQuickFlowForm(createBankReconciliationFlowForm(record));
    }
  }

  function closeQuickAction() {
    setQuickActionMode(undefined);
    setQuickActionRecordId(undefined);
  }

  function handleCreateSystemFlowFromBankStatement() {
    if (!quickActionRecord || quickActionMode !== 'create-system-flow') {
      return;
    }

    const periodGuard = getAccountingPeriodGuard(getStatementPeriod(quickActionRecord.statementDate), '补登记系统流水');

    if (!periodGuard.allowed) {
      void messageApi.warning(periodGuard.reason);
      return;
    }

    if (!quickFlowForm.category || !quickFlowForm.sourceTitle.trim()) {
      void messageApi.warning('请先补全类目和事项说明');
      return;
    }

    const transaction = buildFinanceTransactionFromBankStatement(quickActionRecord, quickFlowForm, financeRows);

    if (!addFinanceTransaction(transaction)) {
      void messageApi.warning(periodGuard.reason ?? '当前会计期间已锁定，不能补登记系统流水');
      return;
    }

    setBankStatements((current) =>
      current.map((record) =>
        record.id === quickActionRecord.id
          ? {
              ...record,
              matchedTransactionIds: [transaction.id],
              matchReason: `已补登记系统流水 ${transaction.transactionNo}，等待流水复核后确认对账`,
              matchScore: Math.max(record.matchScore, 86),
              matchStatus: '暂不可对账'
            }
          : record
      )
    );
    setActiveRecordId(quickActionRecord.id);
    closeQuickAction();
    void messageApi.success('已登记待复核系统流水');
  }

  function handleOpenImportFromQuickAction() {
    if (quickActionRecord) {
      const periodGuard = getAccountingPeriodGuard(getStatementPeriod(quickActionRecord.statementDate), '补充银行流水');

      if (!periodGuard.allowed) {
        void messageApi.warning(periodGuard.reason);
        return;
      }
    }

    closeQuickAction();
    setImportDrawerOpen(true);
  }

  function handlePreviewFile(file: RelatedFileRecord) {
    void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
  }

  function handleDownloadFile(file: RelatedFileRecord) {
    void messageApi.success(`${file.name} 下载请求已记录`);
  }

  const importPreviewColumns: TableColumnsType<BankStatementRecord> = [
    {
      title: '银行日期',
      dataIndex: 'statementDate',
      width: 108
    },
    {
      title: '银行流水',
      key: 'bankSerialNo',
      width: 168,
      render: (_, record) => <CompactCell primary={record.bankSerialNo} />
    },
    {
      title: '方向',
      key: 'direction',
      width: 88,
      render: (_, record) => <StatusTag tone={record.direction === '入账' ? 'green' : 'red'} value={record.direction} />
    },
    {
      title: '银行金额',
      key: 'amount',
      width: 128,
      render: (_, record) => <CellText tone={getBankAmountTone(record.direction)}>{formatSignedMoney(record.amount, record.direction)}</CellText>
    },
    {
      title: '对方户名',
      key: 'counterparty',
      width: 150,
      render: (_, record) => <CompactCell primary={record.counterparty} secondary={record.summary} />
    },
    {
      title: '导入处理',
      key: 'importResult',
      width: 112,
      render: (_, record) => {
        if (bankImportPrecheck.blockedRowIds.has(record.id)) {
          return <StatusTag toneMap={importPreviewResultTone} value="阻断" />;
        }

        if (bankImportPrecheck.duplicateRowIds.has(record.id)) {
          return <StatusTag toneMap={importPreviewResultTone} value="跳过" />;
        }

        return <StatusTag toneMap={importPreviewResultTone} value={getDisplayMatchStatus(record.matchStatus)} />;
      }
    }
  ];

  const importPrecheckColumns: TableColumnsType<BankImportPrecheckItem> = [
    {
      title: '检查项',
      dataIndex: 'item',
      width: 120
    },
    {
      title: '结果',
      dataIndex: 'level',
      width: 96,
      render: (level: BankImportPrecheckLevel) => <StatusTag toneMap={importPrecheckTone} value={level} />
    },
    {
      title: '说明',
      dataIndex: 'result',
      render: (result: string) => <CellText>{result}</CellText>
    }
  ];

  const candidateColumns: TableColumnsType<SystemCandidateRow> = [
    {
      title: '系统流水',
      key: 'systemRecord',
      width: 190,
      render: (_, candidate) => (
        <CompactCell
          primary={candidate.record.transactionNo}
          secondarySlot={<StatusTag toneMap={transactionStatusTone} value={candidate.record.status} />}
        />
      )
    },
    {
      title: '金额',
      key: 'amount',
      width: 128,
      render: (_, candidate) => <CellText tone={getSystemAmountTone(candidate.record)}>{getSystemAmountLabel(candidate.record)}</CellText>
    },
    {
      title: '系统期间',
      key: 'accountingPeriod',
      width: 108,
      render: (_, candidate) => candidate.record.accountingPeriod
    },
    {
      title: '日期关系',
      key: 'dateRelation',
      width: 138,
      render: (_, candidate) => (activeRecord ? getDateRelationLabel(activeRecord, candidate.record) : '-')
    },
    {
      title: '差额',
      key: 'difference',
      width: 110,
      render: (_, candidate) => <CellText tone={getDifferenceTone(candidate.difference)}>{formatDifference(candidate.difference)}</CellText>
    }
  ];

  const quickDrawerTitle = quickActionMode ? getQuickActionLabel(quickActionMode) : '处理对账待办';
  const quickDrawerPrimaryAction = quickActionMode === 'create-system-flow'
    ? {
        label: '登记待复核流水',
        onClick: handleCreateSystemFlowFromBankStatement,
        type: 'primary' as const
      }
    : quickActionMode === 'import-bank-statement'
      ? {
          icon: <CloudUploadOutlined />,
          label: '打开导入',
          onClick: handleOpenImportFromQuickAction,
          type: 'primary' as const
        }
      : undefined;

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<LinkOutlined />} label="待处理" value={queueRows.length} />
          <MetricCard icon={<CheckCircleOutlined />} label="待确认" value={confirmCount} />
          <MetricCard icon={<WarningOutlined />} label="金额不一致" value={amountMismatchCount} />
          <MetricCard icon={<BankOutlined />} label="已对账" value={matchedCount} />
        </MetricGrid>
      }
      overview={
        <section className="bank-reconciliation-hero">
          <div className="bank-import-card">
            <div className="bank-import-main">
              <span className="drawer-section-icon">
                <CloudUploadOutlined />
              </span>
              <div>
                <div className="bank-card-title">银行流水导入</div>
                <div className="bank-card-subtitle">导入后形成对账待办，不直接生成收支流水</div>
                <div className="bank-card-subhint">建议补充：{formatPeriodCountList(unreconciledSystemPeriodCounts)}</div>
              </div>
            </div>
            <Button data-testid="bank-reconciliation-import-button" icon={<CloudUploadOutlined />} type="primary" onClick={() => setImportDrawerOpen(true)}>
              导入银行流水
            </Button>
          </div>
        </section>
      }
      pageId="finance-bank-reconciliation"
    >
      <div className="task-submit-workbench bank-reconciliation-workbench" data-testid="bank-reconciliation-workbench">
        <section className="task-submit-queue-card">
          <div className="task-submit-section-head">
            <div>
              <div className="task-submit-section-title">对账待办</div>
              <div className="task-submit-section-meta">{queueRows.length} 条待处理</div>
            </div>
          </div>
          <div className="task-submit-card-list">
            {queueRows.length > 0 ? (
              queueRows.map((record) => {
                const isActive = activeRecord?.id === record.id;
                const resolution = bankResolutionById.get(record.id);

                return (
                  <button
                    className={isActive ? 'finance-review-queue-row is-active' : 'finance-review-queue-row'}
                    key={record.id}
                    type="button"
                    onClick={() => setActiveRecordId(record.id)}
                  >
                    <span className="finance-review-queue-row-main">
                      <span className="finance-review-queue-row-title">{record.counterparty}</span>
                      <CellText tone={getBankAmountTone(record.direction)}>{formatSignedMoney(record.amount, record.direction)}</CellText>
                    </span>
                    <span className="finance-review-queue-row-sub">
                      <span>
                        {record.bankSerialNo} / {getMatchAction(record, getPrimaryMatchedSystemRecord(record, systemRowsById), resolution)?.actionLabel}
                      </span>
                      <span>{record.statementDate.slice(5)}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty description="暂无待处理对账" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                    {activeRecord.bankSerialNo} / {activeRecord.summary}
                  </div>
                </div>
                <Space size={6}>
                  <StatusTag tone={activeRecord.direction === '入账' ? 'green' : 'red'} value={activeRecord.direction} />
                  <StatusTag toneMap={displayMatchStatusTone} value={getDisplayMatchStatus(activeEffectiveStatus ?? activeRecord.matchStatus)} />
                </Space>
              </div>

              <div className="task-submit-panel-body">
                <div className="task-submit-summary-strip">
                  {[
                    { label: '银行日期', value: activeRecord.statementDate },
                    { label: '银行金额', value: formatSignedMoney(activeRecord.amount, activeRecord.direction) },
                    { label: '系统期间', value: activeSystemRecord?.accountingPeriod ?? '-' },
                    { label: '日期关系', value: getDateRelationLabel(activeRecord, activeSystemRecord) }
                  ].map((item) => (
                    <div className="task-submit-summary-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>

                {activePeriodReadbackNotice ? (
                  <Alert className="finance-period-readback-alert" message={activePeriodReadbackNotice} showIcon type="info" />
                ) : null}

                <DetailSection icon={<LinkOutlined />} title="对账判断">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      {
                        label: '处理状态',
                        value: <StatusTag toneMap={displayMatchStatusTone} value={getDisplayMatchStatus(activeEffectiveStatus ?? activeRecord.matchStatus)} />
                      },
                      { label: '处理方式', value: activeMatchAction?.actionLabel },
                      { label: '日期关系', value: getDateRelationLabel(activeRecord, activeSystemRecord) },
                      {
                        label: '差额',
                        value: (
                          <CellText tone={getDifferenceTone(activeDisplayDifference)}>
                            {formatDifference(activeDisplayDifference)}
                          </CellText>
                        )
                      },
                      { label: '确认条件', value: activeConfirmEligibility.canConfirm ? '可确认' : (activeConfirmEligibility.reason ?? '待处理') },
                      ...(activeSystemPeriodLocked && activeSystemPeriodGuard?.reason
                        ? [{ label: '期间限制', value: activeSystemPeriodGuard.reason, wide: true }]
                        : []),
                      { label: '说明', value: activeResolution?.effectiveReason ?? activeRecord.matchReason, wide: true }
                    ]}
                  />
                </DetailSection>

                <DetailSection icon={<FileSearchOutlined />} title="可匹配系统流水">
                  <CompactDetailTable<SystemCandidateRow>
                    columns={candidateColumns}
                    dataSource={activeSystemCandidates}
                    emptyText="暂无可匹配系统流水"
                    rowKey={(candidate) => candidate.record.id}
                    scrollX={680}
                  />
                </DetailSection>

                {activeSystemRecord ? (
                  <>
                    <DetailSection icon={<BankOutlined />} title="系统流水">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '流水号', value: activeSystemRecord.transactionNo },
                          { label: '发生日期', value: activeSystemRecord.occurredAt },
                          { label: '系统期间', value: activeSystemRecord.accountingPeriod },
                          { label: '对公账户', value: activeSystemRecord.publicAccountSnapshot.displayName },
                          { label: '流水状态', value: <StatusTag toneMap={transactionStatusTone} value={activeSystemRecord.status} /> },
                          { label: '财务类目', value: getFinanceRecordCategorySnapshot(activeSystemRecord).secondaryName },
                          {
                            label: '系统金额',
                            value: <CellText tone={getSystemAmountTone(activeSystemRecord)}>{getSystemAmountLabel(activeSystemRecord)}</CellText>
                          },
                          {
                            label: '对账状态',
                            value: <StatusTag toneMap={reconciliationStatusTone} value={activeSystemRecord.reconciliationStatus} />
                          },
                          { label: '业务来源', value: activeSystemRecord.sourceType },
                          { label: '事项说明', value: activeSystemRecord.sourceTitle, wide: true }
                        ]}
                      />
                    </DetailSection>
                    <DetailSection icon={<FileProtectOutlined />} title="系统凭证">
                      <RelatedFileTable records={activeSystemRecord.files} onDownload={handleDownloadFile} onPreview={handlePreviewFile} />
                    </DetailSection>
                    <OperationRecordSection icon={<AuditOutlined />} records={activeOperationRecords} title="操作记录" />
                  </>
                ) : (
                  <DetailSection icon={<WarningOutlined />} title="系统流水">
                    <div className="empty-state-text">暂无匹配的系统对公账户流水</div>
                  </DetailSection>
                )}
              </div>

              {activeShowFooterActions ? (
                <div className="task-submit-panel-footer">
                  {activeRecord && activeQuickActionMode ? (
                    <Button
                      data-testid="bank-reconciliation-quick-action-button"
                      disabled={activeQuickActionPeriodLocked}
                      icon={<FormOutlined />}
                      onClick={() => openQuickAction(activeRecord, activeQuickActionMode)}
                    >
                      {getQuickActionLabel(activeQuickActionMode)}
                    </Button>
                  ) : null}
                  {activeShowConfirmAction ? (
                    <Button
                      data-testid="bank-reconciliation-confirm-button"
                      disabled={activeSystemPeriodLocked || !activeConfirmEligibility.canConfirm}
                      icon={<CheckCircleOutlined />}
                      type="primary"
                      onClick={handleConfirmActiveReconciliation}
                    >
                      确认对账
                    </Button>
                  ) : null}
                  {activeShowAmountMismatchAction && activeRecord ? (
                    <Button
                      data-testid="bank-reconciliation-adjustment-button"
                      disabled={activeSystemPeriodLocked}
                      icon={<SwapOutlined />}
                      type="primary"
                      onClick={() => setAdjustmentRecordId(activeRecord.id)}
                    >
                      处理金额不一致
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="task-submit-empty-panel">
              <Empty description="暂无待处理对账" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </section>
      </div>

      <ImportDrawerShell
        cancelAction={{ label: '关闭', onClick: closeQuickAction }}
        className="finance-transaction-drawer"
        open={Boolean(quickActionMode)}
        primaryAction={quickDrawerPrimaryAction}
        title={quickDrawerTitle}
        width={760}
        onClose={closeQuickAction}
      >
        {quickActionRecord ? (
          <>
            <DetailSection icon={<BankOutlined />} title="银行流水">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '银行日期', value: quickActionRecord.statementDate },
                  {
                    label: '银行金额',
                    value: <CellText tone={getBankAmountTone(quickActionRecord.direction)}>{formatSignedMoney(quickActionRecord.amount, quickActionRecord.direction)}</CellText>
                  },
                  { label: '对方户名', value: quickActionRecord.counterparty },
                  { label: '绑定账户', value: quickActionRecord.publicAccountSnapshot.displayName },
                  { label: '导入账户名', value: quickActionRecord.importedAccountName },
                  { label: '银行流水号', value: quickActionRecord.bankSerialNo },
                  { label: '摘要', value: quickActionRecord.summary, wide: true }
                ]}
              />
            </DetailSection>

            {quickActionMode === 'create-system-flow' ? (
              <DetailSection icon={<FormOutlined />} title="补登记信息">
                <DrawerFormGrid>
                  <DrawerFormField label="一级类目" required>
                    <Select
                      options={quickPrimaryCategoryOptions.map((category) => ({ label: category.name, value: category.id }))}
                      value={quickFlowForm.primaryCategoryId}
                      onChange={handleQuickPrimaryCategoryChange}
                    />
                  </DrawerFormField>
                  <DrawerFormField label="二级类目" required>
                    <Select
                      options={quickCategoryOptions.map((category) => ({ label: category.name, value: category.name }))}
                      value={quickFlowForm.category}
                      onChange={(value) => updateQuickFlowForm('category', value)}
                    />
                  </DrawerFormField>
                  <DrawerFormField label="来源单号">
                    <Input value={quickFlowForm.sourceNo} onChange={(event) => updateQuickFlowForm('sourceNo', event.target.value)} />
                  </DrawerFormField>
                  <DrawerFormField label="事项说明" required wide>
                    <Input value={quickFlowForm.sourceTitle} onChange={(event) => updateQuickFlowForm('sourceTitle', event.target.value)} />
                  </DrawerFormField>
                  <DrawerFormField label="备注" wide>
                    <Input.TextArea rows={3} value={quickFlowForm.note} onChange={(event) => updateQuickFlowForm('note', event.target.value)} />
                  </DrawerFormField>
                </DrawerFormGrid>
                <div className="bank-action-note">登记后进入流水复核；复核入账后，本页再确认银行对账。</div>
              </DetailSection>
            ) : null}

            {quickActionMode === 'import-bank-statement' ? (
              <DetailSection icon={<CloudUploadOutlined />} title="补充导入">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { label: '建议账户', value: quickActionRecord.publicAccountSnapshot.displayName },
                    { label: '建议期间', value: quickActionSystemRecord?.accountingPeriod ?? getStatementPeriod(quickActionRecord.statementDate) },
                    { label: '处理方式', value: '导入银行原始明细后重新自动匹配', wide: true }
                  ]}
                />
                <div className="bank-action-note">这里只打开导入入口，不直接生成或修改系统流水。</div>
              </DetailSection>
            ) : null}

            {quickActionMode === 'waiting-review' ? (
              <DetailSection icon={<AuditOutlined />} title="复核进度">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '系统流水', value: quickActionWaitingRecord?.transactionNo ?? '-' },
                    {
                      label: '流水状态',
                      value: quickActionWaitingRecord ? <StatusTag toneMap={transactionStatusTone} value={quickActionWaitingRecord.status} /> : '-'
                    },
                    { label: '复核期限', value: quickActionWaitingRecord?.reviewDueAt ?? '-' },
                    { label: '处理方式', value: '先在流水复核完成入账，再回到本页确认对账', wide: true }
                  ]}
                />
              </DetailSection>
            ) : null}
          </>
        ) : (
          <Empty description="暂无可处理的对账事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </ImportDrawerShell>

      <ImportDrawerShell
        bodyTestId="bank-reconciliation-import-drawer"
        cancelAction={{ label: '取消', onClick: () => setImportDrawerOpen(false) }}
        className="finance-transaction-drawer"
        open={importDrawerOpen}
        primaryAction={{
          disabled: !selectedImportFileName || !selectedImportPublicAccountRef || importHasBlockingPrecheck || Boolean(importPeriodGuard) || importablePreviewRows.length === 0,
          label: '导入可入池流水',
          onClick: handleConfirmImport
        }}
        title="导入银行流水"
        width={960}
        onClose={() => setImportDrawerOpen(false)}
      >
        {importPeriodGuard ? (
          <Alert className="finance-period-readback-alert" message={importPeriodGuard.reason} showIcon type="info" />
        ) : null}

        <DetailSection icon={<FileExcelOutlined />} title="导入信息">
          <DetailInfoGrid
            columns={3}
            items={[
              {
                label: '对公账户',
                value: (
                  <Select
                    disabled={bankImportAccountOptions.length === 0}
                    options={bankImportAccountOptions}
                    placeholder="选择启用且支持银行对账的对公账户"
                    value={selectedImportPublicAccountRef?.publicAccountId}
                    onChange={setSelectedImportPublicAccountId}
                  />
                )
              },
              {
                label: '账单范围',
                value: (
                  <CellText tone="default">{bankImportPrecheck.statementRange}</CellText>
                )
              },
              { label: '文件格式', value: 'Excel / CSV' },
              {
                label: '上传文件',
                value: (
                  <div className="bank-upload-line">
                    <Upload
                      accept=".xlsx,.xls,.csv"
                      beforeUpload={(file) => {
                        setSelectedImportFileName(file.name);
                        return false;
                      }}
                      maxCount={1}
                      showUploadList={false}
                    >
                      <Button data-testid="bank-reconciliation-file-select-button" icon={<CloudUploadOutlined />}>
                        选择文件
                      </Button>
                    </Upload>
                    <CellText tone="subtle">{selectedImportFileName ?? '未选择文件'}</CellText>
                  </div>
                ),
                wide: true
              }
            ]}
          />
          <div className="bank-import-hint">
            上传银行导出的原始明细，需包含{requiredBankStatementImportFieldLabels.join('、')}。
          </div>
          <div className="bank-import-coverage">
            <span>本次预览覆盖：{formatPeriodList(bankImportPrecheck.coveredPeriods)}</span>
            <span>仍建议补充：{formatPeriodCountList(bankImportPrecheck.uncoveredPeriodCounts)}</span>
          </div>
        </DetailSection>

        <DetailSection icon={<WarningOutlined />} title="导入预检">
          <CompactDetailTable<BankImportPrecheckItem>
            columns={importPrecheckColumns}
            dataSource={importPrecheckItems}
            rowKey="item"
            scrollX={520}
          />
        </DetailSection>

        <DetailSection
          extra={
            <CellText tone="subtle">
              {`预览 ${bankImportPrecheck.summary.totalCount} 条 / 可入池 ${bankImportPrecheck.summary.importableCount} / 跳过 ${bankImportPrecheck.summary.duplicateCount} / 金额不一致 ${bankImportPrecheck.summary.amountMismatchCount}`}
            </CellText>
          }
          icon={<FileSearchOutlined />}
          title="导入预览"
        >
          <CompactDetailTable<BankStatementRecord>
            columns={importPreviewColumns}
            dataSource={importPreviewRows}
            rowKey="id"
            scrollX={872}
          />
        </DetailSection>
      </ImportDrawerShell>
      <FinanceTransactionAdjustmentDrawer
        bankContext={
          adjustmentRecord
            ? {
                amount: adjustmentRecord.amount,
                bankSerialNo: adjustmentRecord.bankSerialNo,
                counterparty: adjustmentRecord.counterparty,
                direction: adjustmentRecord.direction,
                statementDate: adjustmentRecord.statementDate,
                summary: adjustmentRecord.summary
              }
            : undefined
        }
        existingRows={financeRows}
        open={Boolean(adjustmentRecordId)}
        originRecord={adjustmentSystemRecord}
        onClose={() => setAdjustmentRecordId(undefined)}
        onSubmit={(record) => {
          const periodGuard = getAccountingPeriodGuard(record.accountingPeriod, '生成对账调整流水');

          if (!periodGuard.allowed) {
            void messageApi.warning(periodGuard.reason);
            return;
          }

          if (!addFinanceTransaction(record)) {
            void messageApi.warning(periodGuard.reason ?? '当前会计期间已锁定，不能生成对账调整流水');
            return;
          }

          setBankStatements((current) =>
            current.map((bankRecord) =>
              bankRecord.id === adjustmentRecordId
                ? {
                    ...bankRecord,
                    matchedTransactionIds: Array.from(new Set([...bankRecord.matchedTransactionIds, record.id])),
                    matchReason: `已生成调整流水 ${record.transactionNo}，等待流水复核后继续处理对账`
                  }
                : bankRecord
            )
          );
          setAdjustmentRecordId(undefined);
          void messageApi.success('已生成待复核调整流水');
        }}
      />
    </ManagementPageScaffold>
  );
}
