import {
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  FileExcelOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  LinkOutlined,
  WarningOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Button, Input, Modal, Select, Space, Upload, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards, type DetailSummaryCardItem } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { ImportDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import type { OperationRecord } from '../../components/OperationRecordTable';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { TabbedManagementTable, createTabbedManagementTableItem } from '../../components/TabbedManagementTable';
import { CellText, CompactCell, type CellTextTone } from '../../components/TableCell';
import { WorkflowDrawerShell } from '../../components/WorkflowDrawerShell';
import { getDefaultPublicAccount, publicAccountSeeds } from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import type { FinanceTransactionRecord } from './financeData';
import {
  directionTone,
  financeToday,
  formatMoney,
  getFinanceRecordCategorySnapshot,
  getPublicAccountSignedAmount,
  reconciliationStatusTone,
  transactionStatusTone
} from './financeUtils';

type BankStatementDirection = '入账' | '出账';
type BankMatchStatus = '待确认' | '已对账' | '银行未匹配' | '系统未匹配' | '金额异常' | '重复导入' | '暂不可对账';

type BankStatementRecord = {
  accountName: string;
  amount: number;
  balance: number;
  bankSerialNo: string;
  batchNo: string;
  counterparty: string;
  direction: BankStatementDirection;
  id: string;
  importedAt: string;
  matchedTransactionId?: string;
  matchReason: string;
  matchStatus: BankMatchStatus;
  matchScore: number;
  statementDate: string;
  summary: string;
};

type BankImportBatch = {
  accountName: string;
  batchNo: string;
  duplicateRows: number;
  exceptionRows: number;
  fileName: string;
  id: string;
  importedAt: string;
  matchedRows: number;
  period: string;
  status: '已导入' | '导入预览';
  totalRows: number;
};

type BankReconciliationFilters = {
  keyword: string;
  period: string;
  status: '全部' | BankMatchStatus;
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

const publicAccountName = getDefaultPublicAccount(publicAccountSeeds)?.displayName ?? '未配置对公账户';
const currentPeriod = financeToday.slice(0, 7);

const matchStatusTone = {
  待确认: 'blue',
  已对账: 'green',
  银行未匹配: 'amber',
  系统未匹配: 'amber',
  金额异常: 'red',
  重复导入: 'red',
  暂不可对账: 'gray'
} as const;

const pendingMatchStatuses = new Set<BankMatchStatus>(['待确认', '暂不可对账', '银行未匹配', '系统未匹配']);
const exceptionMatchStatuses = new Set<BankMatchStatus>(['金额异常', '重复导入']);

const bankStatementSeeds: BankStatementRecord[] = [
  {
    accountName: publicAccountName,
    amount: 68000,
    balance: 188000,
    bankSerialNo: 'CMB202606030001',
    batchNo: 'BANK-IMP-202606-01',
    counterparty: '奈雪华南区域',
    direction: '入账',
    id: 'bank-statement-001',
    importedAt: '2026-06-04 09:20',
    matchedTransactionId: 'fin-flow-001',
    matchReason: '金额、方向、日期、合同号一致',
    matchStatus: '已对账',
    matchScore: 98,
    statementDate: '2026-06-03',
    summary: '奈雪华南门店设计服务合同 CON-2026-001 回款'
  },
  {
    accountName: publicAccountName,
    amount: 12000,
    balance: 176000,
    bankSerialNo: 'CMB202606100001',
    batchNo: 'BANK-IMP-202606-01',
    counterparty: '赵倩',
    direction: '出账',
    id: 'bank-statement-002',
    importedAt: '2026-06-11 10:10',
    matchedTransactionId: 'fin-flow-003',
    matchReason: '金额、方向、员工姓名一致，待人工确认',
    matchStatus: '待确认',
    matchScore: 95,
    statementDate: '2026-06-10',
    summary: '赵倩 2026-06 工资发放'
  },
  {
    accountName: publicAccountName,
    amount: 1806.88,
    balance: 174193.12,
    bankSerialNo: 'CMB202606100002',
    batchNo: 'BANK-IMP-202606-02',
    counterparty: '陈思',
    direction: '出账',
    id: 'bank-statement-003',
    importedAt: '2026-06-12 09:15',
    matchedTransactionId: 'fin-flow-002',
    matchReason: '系统流水仍在复核中，不能确认对账',
    matchStatus: '暂不可对账',
    matchScore: 82,
    statementDate: '2026-06-10',
    summary: '陈思 2026-06 绩效预发'
  },
  {
    accountName: publicAccountName,
    amount: 9800,
    balance: 183993.12,
    bankSerialNo: 'CMB202606140001',
    batchNo: 'BANK-IMP-202606-02',
    counterparty: '星河餐饮集团',
    direction: '入账',
    id: 'bank-statement-004',
    importedAt: '2026-06-14 16:40',
    matchReason: '银行已有入账，系统尚未形成对公账户流水',
    matchStatus: '银行未匹配',
    matchScore: 42,
    statementDate: '2026-06-14',
    summary: '星河餐饮集团门店设计首款'
  },
  {
    accountName: publicAccountName,
    amount: 3000,
    balance: 180993.12,
    bankSerialNo: 'CMB202606120002',
    batchNo: 'BANK-IMP-202606-02',
    counterparty: '示例兼职 B',
    direction: '出账',
    id: 'bank-statement-005',
    importedAt: '2026-06-14 16:40',
    matchedTransactionId: 'fin-flow-004',
    matchReason: '对象和日期接近，但银行金额与系统金额不一致',
    matchStatus: '金额异常',
    matchScore: 61,
    statementDate: '2026-06-12',
    summary: '空间设计外协任务结算'
  }
];

const importBatchSeeds: BankImportBatch[] = [
  {
    accountName: publicAccountName,
    batchNo: 'BANK-IMP-202606-01',
    duplicateRows: 0,
    exceptionRows: 0,
    fileName: '招商银行基本户_2026-06-01至2026-06-11.xlsx',
    id: 'bank-import-001',
    importedAt: '2026-06-11 10:10',
    matchedRows: 1,
    period: '2026-06',
    status: '已导入',
    totalRows: 2
  },
  {
    accountName: publicAccountName,
    batchNo: 'BANK-IMP-202606-02',
    duplicateRows: 0,
    exceptionRows: 1,
    fileName: '招商银行基本户_2026-06-12至2026-06-14.xlsx',
    id: 'bank-import-002',
    importedAt: '2026-06-14 16:40',
    matchedRows: 0,
    period: '2026-06',
    status: '已导入',
    totalRows: 3
  }
];

const importPreviewRows: BankStatementRecord[] = [
  {
    accountName: publicAccountName,
    amount: 9800,
    balance: 183993.12,
    bankSerialNo: 'CMB202606140001',
    batchNo: '导入预览',
    counterparty: '星河餐饮集团',
    direction: '入账',
    id: 'bank-preview-001',
    importedAt: financeToday,
    matchReason: '银行已有入账，系统尚未形成对公账户流水',
    matchStatus: '银行未匹配',
    matchScore: 42,
    statementDate: '2026-06-14',
    summary: '星河餐饮集团门店设计首款'
  },
  {
    accountName: publicAccountName,
    amount: 3000,
    balance: 180993.12,
    bankSerialNo: 'CMB202606120002',
    batchNo: '导入预览',
    counterparty: '示例兼职 B',
    direction: '出账',
    id: 'bank-preview-002',
    importedAt: financeToday,
    matchedTransactionId: 'fin-flow-004',
    matchReason: '对象和日期接近，但银行金额与系统金额不一致',
    matchStatus: '金额异常',
    matchScore: 61,
    statementDate: '2026-06-12',
    summary: '空间设计外协任务结算'
  }
];

const defaultFilters: BankReconciliationFilters = {
  keyword: '',
  period: currentPeriod,
  status: '全部'
};

function isPublicAccountMovement(record: FinanceTransactionRecord) {
  if (record.status === '已作废' || record.settlementAccountType !== '对公账户') {
    return false;
  }

  return (
    record.paymentMethod === '对公账户收款' ||
    record.paymentMethod === '对公账户付款' ||
    record.direction === '内部转入' ||
    Boolean(record.collectionSourceTransactionNo)
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

function getMatchAction(record: BankStatementRecord, systemRecord?: FinanceTransactionRecord): MatchAction {
  if (record.matchStatus === '已对账') {
    return {
      actionLabel: '已完成'
    };
  }

  if (record.matchStatus === '银行未匹配') {
    return {
      actionLabel: '补登记系统流水'
    };
  }

  if (record.matchStatus === '系统未匹配') {
    return {
      actionLabel: '核对银行流水'
    };
  }

  if (record.matchStatus === '重复导入') {
    return {
      actionLabel: '确认重复'
    };
  }

  if (record.matchStatus === '金额异常') {
    return {
      actionLabel: '核对异常'
    };
  }

  if (record.matchStatus === '暂不可对账' || systemRecord?.status === '待复核') {
    return {
      actionLabel: '等待流水复核'
    };
  }

  if (record.matchStatus === '待确认') {
    return {
      actionLabel: '人工确认'
    };
  }

  return {
    actionLabel: '核对异常'
  };
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

  if (record.statementDate === systemRecord.occurredAt) {
    score += 15;
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
  bankStatements: BankStatementRecord[]
): ConfirmEligibility {
  if (!record) {
    return { canConfirm: false };
  }

  if (record.matchStatus === '已对账') {
    return { canConfirm: false, reason: '已完成对账' };
  }

  if (!systemRecord) {
    return { canConfirm: false, reason: '没有匹配的系统流水' };
  }

  if (systemRecord.status !== '已入账') {
    return { canConfirm: false, reason: '系统流水尚未复核入账' };
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
      bankRecord.matchedTransactionId === systemRecord.id &&
      bankRecord.matchStatus === '已对账'
  );

  if (systemRecordUsed || systemRecord.reconciliationStatus === '已对账') {
    return { canConfirm: false, reason: '系统流水已被对账' };
  }

  return { canConfirm: true };
}

function matchesFilters(record: BankStatementRecord, filters: BankReconciliationFilters) {
  if (filters.period !== '全部' && !record.statementDate.startsWith(filters.period)) {
    return false;
  }

  if (filters.status !== '全部' && record.matchStatus !== filters.status) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [record.bankSerialNo, record.counterparty, record.summary, record.batchNo, record.matchedTransactionId]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword));
}

function buildBatchNo(batchCount: number) {
  return `BANK-IMP-${currentPeriod.replace('-', '')}-${String(batchCount + 1).padStart(2, '0')}`;
}

function DrawerTitle({ record }: { record: BankStatementRecord }) {
  return (
    <DetailDrawerTitle
      status={record.matchStatus}
      statusToneMap={matchStatusTone}
      subtitle={`${record.bankSerialNo} / ${record.direction} / ${formatSignedMoney(record.amount, record.direction)}`}
      title="银行对账详情"
    />
  );
}

export function FinanceBankReconciliationPage() {
  const { confirmBankReconciliation, financeRows, revokeBankReconciliation } = useFinanceManagement();
  const [messageApi, contextHolder] = message.useMessage();
  const [bankStatements, setBankStatements] = useState<BankStatementRecord[]>(bankStatementSeeds);
  const [importBatches, setImportBatches] = useState<BankImportBatch[]>(importBatchSeeds);
  const [filters, setFilters] = useState<BankReconciliationFilters>(defaultFilters);
  const [activeRecordId, setActiveRecordId] = useState<string>();
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [revokeRecordId, setRevokeRecordId] = useState<string>();
  const [revokeReason, setRevokeReason] = useState('');
  const [selectedImportFileName, setSelectedImportFileName] = useState<string>();

  const publicAccountRows = useMemo(() => financeRows.filter(isPublicAccountMovement), [financeRows]);
  const systemRowsById = useMemo(() => new Map(publicAccountRows.map((record) => [record.id, record])), [publicAccountRows]);
  const periodOptions = useMemo(
    () => ['全部', ...Array.from(new Set(bankStatements.map((record) => record.statementDate.slice(0, 7)))).sort((first, second) => second.localeCompare(first))],
    [bankStatements]
  );

  const filteredStatements = useMemo(() => bankStatements.filter((record) => matchesFilters(record, filters)), [bankStatements, filters]);
  const pendingRows = useMemo(() => filteredStatements.filter((record) => pendingMatchStatuses.has(record.matchStatus)), [filteredStatements]);
  const matchedRows = useMemo(() => filteredStatements.filter((record) => record.matchStatus === '已对账'), [filteredStatements]);
  const exceptionRows = useMemo(() => filteredStatements.filter((record) => exceptionMatchStatuses.has(record.matchStatus)), [filteredStatements]);
  const activeRecord = useMemo(() => bankStatements.find((record) => record.id === activeRecordId), [bankStatements, activeRecordId]);
  const activeSystemRecord = activeRecord?.matchedTransactionId ? systemRowsById.get(activeRecord.matchedTransactionId) : undefined;
  const activeMatchAction = activeRecord ? getMatchAction(activeRecord, activeSystemRecord) : undefined;
  const activeSystemCandidates = useMemo(
    () => (activeRecord ? buildSystemCandidates(activeRecord, publicAccountRows) : []),
    [activeRecord, publicAccountRows]
  );
  const activeConfirmEligibility = useMemo(
    () => getConfirmEligibility(activeRecord, activeSystemRecord, bankStatements),
    [activeRecord, activeSystemRecord, bankStatements]
  );
  const activeOperationRecords = useMemo<OperationRecord[]>(
    () =>
      activeSystemRecord
        ? [...activeSystemRecord.operationRecords].sort((first, second) => second.time.localeCompare(first.time))
        : [],
    [activeSystemRecord]
  );

  const currentPeriodStatements = useMemo(
    () => bankStatements.filter((record) => record.statementDate.startsWith(currentPeriod)),
    [bankStatements]
  );
  const importedAmount = currentPeriodStatements.reduce((total, record) => total + (record.direction === '入账' ? record.amount : -record.amount), 0);
  const matchedCount = bankStatements.filter((record) => record.matchStatus === '已对账').length;
  const pendingCount = bankStatements.filter((record) => pendingMatchStatuses.has(record.matchStatus)).length;
  const exceptionCount = bankStatements.filter((record) => exceptionMatchStatuses.has(record.matchStatus)).length;

  function handleConfirmImport() {
    if (!selectedImportFileName) {
      return;
    }

    const nextBatchNo = buildBatchNo(importBatches.length);
    const nextRows = importPreviewRows.map((record, index) => ({
      ...record,
      batchNo: nextBatchNo,
      id: `${record.id}-${Date.now()}-${index}`,
      importedAt: `${financeToday} 11:20`
    }));

    setBankStatements((current) => [...nextRows, ...current]);
    setImportBatches((current) => [
      {
        accountName: publicAccountName,
        batchNo: nextBatchNo,
        duplicateRows: 0,
        exceptionRows: nextRows.filter((record) => exceptionMatchStatuses.has(record.matchStatus)).length,
        fileName: selectedImportFileName,
        id: `bank-import-${Date.now()}`,
        importedAt: `${financeToday} 11:20`,
        matchedRows: nextRows.filter((record) => record.matchStatus === '已对账').length,
        period: currentPeriod,
        status: '已导入',
        totalRows: nextRows.length
      },
      ...current
    ]);
    setSelectedImportFileName(undefined);
    setImportDrawerOpen(false);
    void messageApi.success('银行流水已导入');
  }

  function handleConfirmActiveReconciliation() {
    if (!activeRecord || !activeSystemRecord) {
      return;
    }

    if (!activeConfirmEligibility.canConfirm) {
      void messageApi.warning(activeConfirmEligibility.reason ?? '当前记录不能确认对账');
      return;
    }

    confirmBankReconciliation(activeSystemRecord.id, activeRecord.bankSerialNo);
    setBankStatements((current) =>
      current.map((record) =>
        record.id === activeRecord.id
          ? {
              ...record,
              matchReason: `已人工确认匹配系统流水 ${activeSystemRecord.transactionNo}`,
              matchScore: Math.max(record.matchScore, 95),
              matchStatus: '已对账'
            }
          : record
      )
    );
    void messageApi.success('已确认对账');
  }

  function handleOpenRevokeReconciliation() {
    if (!activeRecord || activeRecord.matchStatus !== '已对账') {
      return;
    }

    setRevokeRecordId(activeRecord.id);
    setRevokeReason('');
  }

  function handleSubmitRevokeReconciliation() {
    const reason = revokeReason.trim();
    const targetRecord = bankStatements.find((record) => record.id === revokeRecordId);
    const targetSystemRecord =
      targetRecord?.matchedTransactionId && activeSystemRecord?.id === targetRecord.matchedTransactionId
        ? activeSystemRecord
        : targetRecord?.matchedTransactionId
          ? systemRowsById.get(targetRecord.matchedTransactionId)
          : undefined;

    if (!targetRecord || !targetSystemRecord) {
      void messageApi.warning('未找到可撤销的对账关系');
      return;
    }

    if (!reason) {
      void messageApi.warning('请填写撤销原因');
      return;
    }

    revokeBankReconciliation(targetSystemRecord.id, targetRecord.bankSerialNo, reason);
    setBankStatements((current) =>
      current.map((record) =>
        record.id === targetRecord.id
          ? {
              ...record,
              matchReason: `已撤销对账，需重新确认。原因：${reason}`,
              matchStatus: '待确认'
            }
          : record
      )
    );
    setRevokeRecordId(undefined);
    setRevokeReason('');
    void messageApi.success('已撤销对账');
  }

  const statementColumns: TableColumnsType<BankStatementRecord> = [
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
      title: '匹配状态',
      dataIndex: 'matchStatus',
      width: 112,
      render: (status: BankMatchStatus) => <StatusTag toneMap={matchStatusTone} value={status} />
    },
    {
      title: '处理建议',
      key: 'matchAction',
      width: 118,
      render: (_, record) => {
        const action = getMatchAction(record, record.matchedTransactionId ? systemRowsById.get(record.matchedTransactionId) : undefined);
        return <CellText>{action.actionLabel}</CellText>;
      }
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
      title: '匹配度',
      dataIndex: 'score',
      width: 96,
      render: (score: number) => `${score}%`
    },
    {
      title: '差额',
      key: 'difference',
      width: 110,
      render: (_, candidate) => <CellText tone={getDifferenceTone(candidate.difference)}>{formatDifference(candidate.difference)}</CellText>
    }
  ];

  const bankPoolColumns: TableColumnsType<BankStatementRecord> = [
    ...statementColumns.slice(0, 5),
    {
      title: '余额',
      dataIndex: 'balance',
      width: 128,
      render: (balance: number) => formatMoney(balance)
    },
    {
      title: '匹配状态',
      dataIndex: 'matchStatus',
      width: 112,
      render: (status: BankMatchStatus) => <StatusTag toneMap={matchStatusTone} value={status} />
    }
  ];

  const importBatchColumns: TableColumnsType<BankImportBatch> = [
    {
      title: '导入批次',
      key: 'batchNo',
      width: 170,
      render: (_, record) => <CompactCell primary={record.batchNo} secondary={record.period} />
    },
    {
      title: '文件名称',
      dataIndex: 'fileName',
      width: 260
    },
    {
      title: '对公账户',
      dataIndex: 'accountName',
      width: 150
    },
    {
      title: '导入结果',
      key: 'result',
      width: 260,
      render: (_, record) => {
        const pendingRowsInBatch = Math.max(record.totalRows - record.matchedRows - record.exceptionRows, 0);
        return `${record.totalRows} 条 / 已对账 ${record.matchedRows} / 待处理 ${pendingRowsInBatch} / 异常 ${record.exceptionRows}`;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: BankImportBatch['status']) => <StatusTag tone={status === '已导入' ? 'green' : 'blue'} value={status} />
    },
    {
      title: '导入时间',
      dataIndex: 'importedAt',
      width: 138
    }
  ];

  return (
    <ManagementPageScaffold
      feedback={contextHolder}
      metrics={
        <MetricGrid spans={[6, 6, 6, 3, 3]}>
          <MetricCard icon={<BankOutlined />} label="银行流水" value={bankStatements.length} />
          <MetricCard icon={<WalletOutlined />} label="导入净额" value={formatMoney(importedAmount)} />
          <MetricCard icon={<CheckCircleOutlined />} label="已对账" value={matchedCount} />
          <MetricCard icon={<LinkOutlined />} label="待处理" value={pendingCount} />
          <MetricCard icon={<WarningOutlined />} label="异常" value={exceptionCount} />
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
                <div className="bank-card-subtitle">Excel / CSV 导入后进入银行流水池，不直接生成收支流水</div>
              </div>
            </div>
            <Space size={8}>
              <Button data-testid="bank-reconciliation-import-button" icon={<CloudUploadOutlined />} type="primary" onClick={() => setImportDrawerOpen(true)}>
                导入银行流水
              </Button>
            </Space>
          </div>
          <div className="bank-match-card">
            <div className="bank-card-title">匹配依据</div>
            <div className="bank-match-rule-grid">
              <span>金额</span>
              <span>方向</span>
              <span>日期</span>
              <span>户名</span>
              <span>摘要</span>
            </div>
          </div>
        </section>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="流水期间">
              <Select
                data-testid="bank-reconciliation-period-filter"
                options={periodOptions.map((period) => ({ label: period, value: period }))}
                value={filters.period}
                onChange={(period) => setFilters((current) => ({ ...current, period }))}
              />
            </FilterField>
            <FilterField label="匹配状态">
              <Select
                data-testid="bank-reconciliation-status-filter"
                options={[
                  { label: '全部', value: '全部' },
                  { label: '待确认', value: '待确认' },
                  { label: '已对账', value: '已对账' },
                  { label: '银行未匹配', value: '银行未匹配' },
                  { label: '系统未匹配', value: '系统未匹配' },
                  { label: '金额异常', value: '金额异常' },
                  { label: '重复导入', value: '重复导入' },
                  { label: '暂不可对账', value: '暂不可对账' }
                ]}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="bank-reconciliation-keyword-input"
              placeholder="银行流水号 / 户名 / 摘要 / 系统流水"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-bank-reconciliation"
    >

      <section className="bank-reconciliation-workbench" data-testid="bank-reconciliation-workbench">
        <TabbedManagementTable
          tabs={[
            createTabbedManagementTableItem<BankStatementRecord>({
              key: 'pending',
              label: '待处理',
              table: {
                columns: statementColumns,
                count: { value: pendingRows.length, unit: '条待处理' },
                dataSource: pendingRows,
                rowKey: 'id',
                rowTestIdPrefix: 'bank-reconciliation-pending-row',
                tableTestId: 'bank-reconciliation-pending-table',
                onRowClick: (record) => setActiveRecordId(record.id)
              }
            }),
            createTabbedManagementTableItem<BankStatementRecord>({
              key: 'matched',
              label: '已对账',
              table: {
                columns: statementColumns,
                count: { value: matchedRows.length, unit: '条已对账' },
                dataSource: matchedRows,
                rowKey: 'id',
                rowTestIdPrefix: 'bank-reconciliation-matched-row',
                tableTestId: 'bank-reconciliation-matched-table',
                onRowClick: (record) => setActiveRecordId(record.id)
              }
            }),
            createTabbedManagementTableItem<BankStatementRecord>({
              key: 'exception',
              label: '对账异常',
              table: {
                columns: statementColumns,
                count: { value: exceptionRows.length, unit: '条对账异常' },
                dataSource: exceptionRows,
                rowKey: 'id',
                rowTestIdPrefix: 'bank-reconciliation-exception-row',
                tableTestId: 'bank-reconciliation-exception-table',
                onRowClick: (record) => setActiveRecordId(record.id)
              }
            }),
            createTabbedManagementTableItem<BankStatementRecord>({
              key: 'bank-pool',
              label: '银行流水',
              table: {
                columns: bankPoolColumns,
                count: { value: filteredStatements.length, unit: '条银行流水' },
                dataSource: filteredStatements,
                rowKey: 'id',
                rowTestIdPrefix: 'bank-reconciliation-bank-row',
                tableTestId: 'bank-reconciliation-bank-table',
                onRowClick: (record) => setActiveRecordId(record.id)
              }
            }),
            createTabbedManagementTableItem<BankImportBatch>({
              key: 'imports',
              label: '导入记录',
              table: {
                columns: importBatchColumns,
                count: { value: importBatches.length, unit: '个导入批次' },
                dataSource: importBatches,
                rowKey: 'id',
                tableTestId: 'bank-reconciliation-import-table'
              }
            })
          ]}
        />
      </section>

      <WorkflowDrawerShell
        bodyTestId="bank-reconciliation-detail-drawer"
        className="finance-transaction-drawer"
        closeAction={{ label: '关闭', onClick: () => setActiveRecordId(undefined) }}
        dangerAction={
          activeRecord?.matchStatus === '已对账'
            ? {
                label: '撤销对账',
                testId: 'bank-reconciliation-revoke-button',
                onClick: handleOpenRevokeReconciliation
              }
            : undefined
        }
        open={Boolean(activeRecord)}
        primaryAction={
          activeRecord?.matchStatus !== '已对账'
            ? {
                disabled: !activeConfirmEligibility.canConfirm,
                label: '确认对账',
                testId: 'bank-reconciliation-confirm-button',
                onClick: handleConfirmActiveReconciliation
              }
            : undefined
        }
        title={activeRecord ? <DrawerTitle record={activeRecord} /> : null}
        width={940}
        onClose={() => setActiveRecordId(undefined)}
      >
        {activeRecord ? (
          <>
            <DetailSummaryCards
              columns={4}
              items={
                [
                  { icon: <BankOutlined />, key: 'bank', label: '银行流水', value: activeRecord.bankSerialNo },
                  {
                    icon: <WalletOutlined />,
                    key: 'amount',
                    label: activeRecord.direction === '入账' ? '银行入账' : '银行出账',
                    value: formatSignedMoney(activeRecord.amount, activeRecord.direction)
                  },
                  { icon: <LinkOutlined />, key: 'status', label: '匹配状态', value: activeRecord.matchStatus },
                  {
                    icon: <AuditOutlined />,
                    key: 'difference',
                    label: '差额',
                    value: formatDifference(getAmountDifference(activeRecord, activeSystemRecord))
                  }
                ].filter(Boolean) as DetailSummaryCardItem[]
              }
            />
            <DetailTabs
              defaultActiveKey="match"
              items={[
                {
                  key: 'match',
                  label: '匹配结果',
                  children: (
                    <div className="detail-tab-stack">
                      <DetailSection icon={<LinkOutlined />} title="匹配信息">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '匹配状态', value: <StatusTag toneMap={matchStatusTone} value={activeRecord.matchStatus} /> },
                            { label: '处理动作', value: activeMatchAction?.actionLabel },
                            { label: '匹配度', value: `${activeRecord.matchScore}%` },
                            {
                              label: '差额',
                              value: (
                                <CellText tone={getDifferenceTone(getAmountDifference(activeRecord, activeSystemRecord))}>
                                  {formatDifference(getAmountDifference(activeRecord, activeSystemRecord))}
                                </CellText>
                              )
                            }
                          ]}
                        />
                      </DetailSection>
                      <DetailSection icon={<FileSearchOutlined />} title="候选系统流水">
                        <CompactDetailTable<SystemCandidateRow>
                          columns={candidateColumns}
                          dataSource={activeSystemCandidates}
                          emptyText="暂无候选系统流水，需要补登记或核对银行导入范围"
                          rowKey={(candidate) => candidate.record.id}
                          scrollX={680}
                        />
                      </DetailSection>
                    </div>
                  )
                },
                {
                  key: 'bank',
                  label: '银行流水',
                  children: (
                    <DetailSection icon={<BankOutlined />} title="银行流水">
                      <DetailInfoGrid
                        columns={3}
                        items={[
                          { label: '银行流水号', value: activeRecord.bankSerialNo },
                          { label: '银行日期', value: activeRecord.statementDate },
                          { label: '对公账户', value: activeRecord.accountName },
                          { label: '方向', value: <StatusTag tone={activeRecord.direction === '入账' ? 'green' : 'red'} value={activeRecord.direction} /> },
                          {
                            label: '银行金额',
                            value: (
                              <CellText tone={getBankAmountTone(activeRecord.direction)}>
                                {formatSignedMoney(activeRecord.amount, activeRecord.direction)}
                              </CellText>
                            )
                          },
                          { label: '余额', value: formatMoney(activeRecord.balance) },
                          { label: '对方户名', value: activeRecord.counterparty },
                          { label: '导入批次', value: activeRecord.batchNo },
                          { label: '银行摘要', value: activeRecord.summary, wide: true }
                        ]}
                      />
                    </DetailSection>
                  )
                },
                {
                  key: 'system',
                  label: '系统流水',
                  children: activeSystemRecord ? (
                    <div className="detail-tab-stack">
                      <DetailSection icon={<FileSearchOutlined />} title="系统流水">
                        <DetailInfoGrid
                          columns={3}
                          items={[
                            { label: '系统流水号', value: activeSystemRecord.transactionNo },
                            { label: '发生日期', value: activeSystemRecord.occurredAt },
                            { label: '系统状态', value: <StatusTag toneMap={transactionStatusTone} value={activeSystemRecord.status} /> },
                            { label: '收支方向', value: <StatusTag toneMap={directionTone} value={activeSystemRecord.direction} /> },
                            { label: '财务类目', value: getFinanceRecordCategorySnapshot(activeSystemRecord).secondaryName },
                            {
                              label: '系统金额',
                              value: <CellText tone={getSystemAmountTone(activeSystemRecord)}>{getSystemAmountLabel(activeSystemRecord)}</CellText>
                            },
                            { label: '业务对象', value: activeSystemRecord.counterparty },
                            { label: '业务来源', value: activeSystemRecord.sourceType },
                            {
                              label: '对账状态',
                              value: (
                                <StatusTag
                                  toneMap={reconciliationStatusTone}
                                  value={activeSystemRecord.reconciliationStatus}
                                />
                              )
                            },
                            { label: '事项说明', value: activeSystemRecord.sourceTitle, wide: true }
                          ]}
                        />
                      </DetailSection>
                      <DetailSection icon={<FileProtectOutlined />} title="系统凭证">
                        <RelatedFileTable records={activeSystemRecord.files} />
                      </DetailSection>
                    </div>
                  ) : (
                    <DetailSection icon={<WarningOutlined />} title="系统流水">
                      <div className="empty-state-text">暂无匹配的系统对公账户流水</div>
                    </DetailSection>
                  )
                },
                {
                  key: 'logs',
                  label: '对账记录',
                  children: activeSystemRecord ? (
                    <OperationRecordSection icon={<AuditOutlined />} records={activeOperationRecords} title="对账记录" />
                  ) : (
                    <DetailSection icon={<AuditOutlined />} title="对账记录">
                      <div className="empty-state-text">银行流水已导入，等待匹配或补登记系统流水</div>
                    </DetailSection>
                  )
                }
              ]}
              tabTestIdPrefix="bank-reconciliation-detail-tab"
              testId="bank-reconciliation-detail-tabs"
            />
          </>
        ) : null}
      </WorkflowDrawerShell>

      <ImportDrawerShell
        bodyTestId="bank-reconciliation-import-drawer"
        cancelAction={{ label: '取消', onClick: () => setImportDrawerOpen(false) }}
        className="finance-transaction-drawer"
        open={importDrawerOpen}
        primaryAction={{ disabled: !selectedImportFileName, label: '导入到银行流水池', onClick: handleConfirmImport }}
        title={
          <DetailDrawerTitle
            status="导入预览"
            statusTone="blue"
            title="导入银行流水"
          />
        }
        width={960}
        onClose={() => setImportDrawerOpen(false)}
      >
        <DetailSection icon={<FileExcelOutlined />} title="导入信息">
          <DetailInfoGrid
            columns={3}
            items={[
              { label: '对公账户', value: publicAccountName },
              { label: '流水期间', value: currentPeriod },
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
        </DetailSection>

        <DetailSection
          extra={<CellText tone="subtle">预览 {importPreviewRows.length} 条银行流水</CellText>}
          icon={<FileSearchOutlined />}
          title="导入预览"
        >
          <CompactDetailTable<BankStatementRecord>
            columns={statementColumns}
            dataSource={importPreviewRows}
            rowKey="id"
            scrollX={872}
          />
        </DetailSection>
      </ImportDrawerShell>
      <Modal
        destroyOnHidden
        footer={
          <Space>
            <Button
              onClick={() => {
                setRevokeRecordId(undefined);
                setRevokeReason('');
              }}
            >
              取消
            </Button>
            <Button
              danger
              data-testid="bank-reconciliation-revoke-confirm-button"
              disabled={!revokeReason.trim()}
              type="primary"
              onClick={handleSubmitRevokeReconciliation}
            >
              确认撤销
            </Button>
          </Space>
        }
        open={Boolean(revokeRecordId)}
        title="撤销对账"
        onCancel={() => {
          setRevokeRecordId(undefined);
          setRevokeReason('');
        }}
        onOk={handleSubmitRevokeReconciliation}
      >
        <div className="detail-tab-stack">
          <div className="empty-state-text">撤销后银行流水会回到待确认，系统流水会回到未对账。请填写撤销原因。</div>
          <Input.TextArea
            data-testid="bank-reconciliation-revoke-reason-input"
            placeholder="例如：匹配对象错误，需要重新选择系统流水"
            rows={4}
            value={revokeReason}
            onChange={(event) => setRevokeReason(event.target.value)}
          />
        </div>
      </Modal>
    </ManagementPageScaffold>
  );
}
