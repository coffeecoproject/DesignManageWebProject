import {
  accountingSubjectProfile,
  accountingSubjectSeedRows,
  getAccountingSubjectByCode,
  type AccountingSubjectBalanceDirection,
  type AccountingSubjectProfile,
  type AccountingSubjectRecord,
  type AccountingSubjectType
} from './financeAccountingSubjectData';

export type LedgerInitializationStatus =
  | '未开始'
  | '基础设置完成'
  | '科目已确认'
  | '期初已录入'
  | '试算平衡'
  | '试算不平'
  | '已启用';
export type LedgerInitializationSource = '账套初始化';
export type LedgerInitializationStepKey = 'basic' | 'subjects' | 'opening-balances' | 'trial-balance' | 'enable';
export type LedgerInitializationStepStatus = 'wait' | 'process' | 'finish' | 'error';
export type LedgerInitializationTrialBalanceStatus = '待试算' | '平衡' | '不平衡';
export type LedgerOpeningBalanceEntrySource = '手工录入' | '导入应用' | '系统承接';
export type LedgerOpeningBalanceEntryStatus = '可录入' | '已录入' | '已锁定';
export type LedgerOpeningBalanceImportStatus = '未导入' | '待应用' | '已应用' | '校验失败' | '已锁定';
export type LedgerOpeningBalanceImportImpact = '新增' | '覆盖';
export type LedgerOpeningBalancePreviewStatus = '可应用' | '需处理';
export type LedgerOpeningBalanceValidationStatus = '通过' | '需处理';
export type LedgerOpeningBalanceValidationSeverity = 'info' | 'warning' | 'error';
export type LedgerInitializationWorkspaceMode = '初始化草稿' | '已启用账套';
export type LedgerInitializationControlledActionKey = 'withdraw-enable' | 'opening-adjustment';
export type LedgerInitializationControlledActionStatus = '可发起' | '受限' | '未启用';
export type LedgerOpeningAdjustmentVoucherStatus = '待记账' | '已记账';

export const ledgerOpeningBalanceEntrySourceLabels: Record<LedgerOpeningBalanceEntrySource, string> = {
  导入应用: '导入录入',
  手工录入: '手工录入',
  系统承接: '业务承接'
};

export type LedgerOpeningBalanceRow = {
  accountingPeriod: string;
  auxiliaryLabel: string;
  balanceDirection: AccountingSubjectBalanceDirection;
  creditAmount: number;
  debitAmount: number;
  entrySource: LedgerOpeningBalanceEntrySource;
  id: string;
  source: LedgerInitializationSource;
  subjectCode: string;
  subjectName: string;
  subjectType: AccountingSubjectType;
};

export type LedgerOpeningBalanceImportBatch = {
  appliedAt?: string;
  appliedBy?: string;
  fileName: string;
  id: string;
  importedAt: string;
  importedBy: string;
  previewRowCount: number;
  status: LedgerOpeningBalanceImportStatus;
};

export type LedgerOpeningBalanceImportPreviewRow = LedgerOpeningBalanceRow & {
  importBatchId: string;
  importImpact: LedgerOpeningBalanceImportImpact;
  lineNo: number;
  previewMessage: string;
  previewStatus: LedgerOpeningBalancePreviewStatus;
};

export type LedgerOpeningBalanceValidationItem = {
  blocking: boolean;
  id: string;
  message: string;
  severity: LedgerOpeningBalanceValidationSeverity;
  status: LedgerOpeningBalanceValidationStatus;
  subjectCode?: string;
  title: string;
};

export type LedgerOpeningBalanceValidationSummary = {
  blockingIssueCount: number;
  items: LedgerOpeningBalanceValidationItem[];
  passedCount: number;
  status: LedgerOpeningBalanceValidationStatus;
  warningCount: number;
};

export type LedgerOpeningBalanceWorkspace = {
  canApplyImport: boolean;
  canEditOpeningBalances: boolean;
  canImportOpeningBalances: boolean;
  canRunTrialBalance: boolean;
  entryStatus: LedgerOpeningBalanceEntryStatus;
  importBatch?: LedgerOpeningBalanceImportBatch;
  importPreviewRows: LedgerOpeningBalanceImportPreviewRow[];
  importStatus: LedgerOpeningBalanceImportStatus;
  isLocked: boolean;
  validation: LedgerOpeningBalanceValidationSummary;
};

export type LedgerInitializationProfile = AccountingSubjectProfile & {
  configuredAt: string;
  configuredBy: string;
  enabledAt: string;
  enabledBy: string;
  openingRecordedAt: string;
  openingRecordedBy: string;
  subjectConfirmedAt: string;
  subjectConfirmedBy: string;
  status: LedgerInitializationStatus;
  trialBalancedAt: string;
  trialBalancedBy: string;
};

export type LedgerInitializationStepDefinition = {
  description: string;
  key: LedgerInitializationStepKey;
  title: string;
};

export type LedgerInitializationStep = LedgerInitializationStepDefinition & {
  status: LedgerInitializationStepStatus;
};

export type LedgerInitializationSummary = {
  accountingPeriod: string;
  canEnable: boolean;
  completedStepCount: number;
  confirmedSubjectCount: number;
  creditTotal: number;
  debitTotal: number;
  difference: number;
  enabledSubjectCount: number;
  isLocked: boolean;
  openingBalanceCount: number;
  requiredStepCount: number;
  status: LedgerInitializationStatus;
  trialBalanceStatus: LedgerInitializationTrialBalanceStatus;
};

export type LedgerInitializationFilters = {
  keyword: string;
  subjectType: '全部' | AccountingSubjectType;
};

export type LedgerInitializationGeneralLedgerOpeningBalance = {
  accountingPeriod: string;
  amount: number;
  source: LedgerInitializationSource;
  subjectCode: string;
};

export type LedgerInitializationOperationRecord = {
  action: string;
  actor: string;
  id: string;
  note: string;
  operatedAt: string;
  result: LedgerInitializationStatus;
};

export type LedgerInitializationControlledAction = {
  downstreamSteps: string[];
  effect: string[];
  key: LedgerInitializationControlledActionKey;
  materials: string[];
  prechecks: string[];
  primaryActionLabel: string;
  scenario: string;
  status: LedgerInitializationControlledActionStatus;
  title: string;
};

export type LedgerInitializationControlContext = {
  hasGeneralLedgerRead: boolean;
  periodLocked: boolean;
  postedVoucherCount: number;
};

export type LedgerOpeningAdjustmentVoucherRecord = {
  accountingPeriod: string;
  amount: number;
  balanceSide: AccountingSubjectBalanceDirection;
  createdAt: string;
  createdBy: string;
  evidenceName: string;
  id: string;
  reason: string;
  status: LedgerOpeningAdjustmentVoucherStatus;
  subjectCode: string;
  subjectName: string;
  voucherNo: string;
};

export const ledgerInitializationProfile: LedgerInitializationProfile = {
  ...accountingSubjectProfile,
  configuredAt: '2026-06-30 09:10',
  configuredBy: '李明',
  enabledAt: '2026-06-30 10:00',
  enabledBy: '李明',
  openingRecordedAt: '2026-06-30 09:40',
  openingRecordedBy: '李明',
  status: '已启用',
  subjectConfirmedAt: '2026-06-30 09:25',
  subjectConfirmedBy: '李明',
  trialBalancedAt: '2026-06-30 09:55',
  trialBalancedBy: '李明'
};

export const ledgerInitializationDraftProfile: LedgerInitializationProfile = {
  ...accountingSubjectProfile,
  configuredAt: '2026-06-30 09:10',
  configuredBy: '李明',
  enabledAt: '',
  enabledBy: '',
  openingRecordedAt: '2026-06-30 09:40',
  openingRecordedBy: '李明',
  status: '试算平衡',
  subjectConfirmedAt: '2026-06-30 09:25',
  subjectConfirmedBy: '李明',
  trialBalancedAt: '2026-06-30 09:55',
  trialBalancedBy: '李明'
};

export const ledgerInitializationControlContext: LedgerInitializationControlContext = {
  hasGeneralLedgerRead: true,
  periodLocked: false,
  postedVoucherCount: 6
};

export const ledgerInitializationStepDefinitions: LedgerInitializationStepDefinition[] = [
  {
    description: '确认账套名称、准则、纳税人类型、本位币和启用期间。',
    key: 'basic',
    title: '基础设置'
  },
  {
    description: '确认本账套启用的小企业会计科目体系。',
    key: 'subjects',
    title: '科目确认'
  },
  {
    description: '录入或导入启用期间的期初余额。',
    key: 'opening-balances',
    title: '期初余额'
  },
  {
    description: '校验期初借贷合计，试算不平不能启用。',
    key: 'trial-balance',
    title: '试算平衡'
  },
  {
    description: '启用后基础设置和期初余额锁定，作为后续总账期初。',
    key: 'enable',
    title: '启用账套'
  }
];

function requireSubject(subjectCode: string): AccountingSubjectRecord {
  const subject = getAccountingSubjectByCode(subjectCode);

  if (!subject) {
    throw new Error(`missing accounting subject for ledger initialization: ${subjectCode}`);
  }

  return subject;
}

function createOpeningBalanceRow({
  auxiliaryLabel = '无',
  creditAmount = 0,
  debitAmount = 0,
  entrySource = '手工录入',
  subjectCode
}: {
  auxiliaryLabel?: string;
  creditAmount?: number;
  debitAmount?: number;
  entrySource?: LedgerOpeningBalanceEntrySource;
  subjectCode: string;
}): LedgerOpeningBalanceRow {
  const subject = requireSubject(subjectCode);

  return {
    accountingPeriod: ledgerInitializationProfile.effectivePeriod,
    auxiliaryLabel,
    balanceDirection: subject.balanceDirection,
    creditAmount,
    debitAmount,
    entrySource,
    id: `ledger-opening-${subjectCode.replace(/\./g, '-')}`,
    source: '账套初始化',
    subjectCode,
    subjectName: subject.name,
    subjectType: subject.type
  };
}

export const ledgerOpeningBalanceRows: LedgerOpeningBalanceRow[] = [
  createOpeningBalanceRow({ debitAmount: 2_000, entrySource: '导入应用', subjectCode: '1001' }),
  createOpeningBalanceRow({ debitAmount: 252_669.48, entrySource: '导入应用', subjectCode: '1002' }),
  createOpeningBalanceRow({ auxiliaryLabel: '客户往来', debitAmount: 21_000, entrySource: '导入应用', subjectCode: '1122' }),
  createOpeningBalanceRow({ auxiliaryLabel: '供应商往来', creditAmount: 5_006.87, entrySource: '导入应用', subjectCode: '2202' }),
  createOpeningBalanceRow({ auxiliaryLabel: '员工薪酬', creditAmount: 12_000, entrySource: '系统承接', subjectCode: '2211.01' }),
  createOpeningBalanceRow({ auxiliaryLabel: '员工报销', creditAmount: 3_200, entrySource: '系统承接', subjectCode: '2241' }),
  createOpeningBalanceRow({ creditAmount: 200_000, entrySource: '手工录入', subjectCode: '3001' }),
  createOpeningBalanceRow({ creditAmount: 55_462.61, entrySource: '手工录入', subjectCode: '3103' })
];

export const ledgerOpeningBalanceImportBatch: LedgerOpeningBalanceImportBatch = {
  appliedAt: ledgerInitializationProfile.openingRecordedAt,
  appliedBy: ledgerInitializationProfile.openingRecordedBy,
  fileName: '2026-06-期初余额导入模板.xlsx',
  id: 'ledger-opening-import-202606-001',
  importedAt: '2026-06-30 09:35',
  importedBy: '李明',
  previewRowCount: 4,
  status: '已应用'
};

export const ledgerOpeningBalanceDraftImportBatch: LedgerOpeningBalanceImportBatch = {
  fileName: '2026-06-期初余额导入模板.xlsx',
  id: 'ledger-opening-import-202606-draft',
  importedAt: '2026-06-30 09:35',
  importedBy: '李明',
  previewRowCount: 4,
  status: '待应用'
};

export const ledgerInitializationOperationRecords: LedgerInitializationOperationRecord[] = [
  {
    action: '保存基础设置',
    actor: ledgerInitializationProfile.configuredBy,
    id: 'ledger-init-operation-basic',
    note: '确认小企业会计准则、小规模纳税人、人民币和 2026-06 启用期间。',
    operatedAt: ledgerInitializationProfile.configuredAt,
    result: '基础设置完成'
  },
  {
    action: '确认科目',
    actor: ledgerInitializationProfile.subjectConfirmedBy,
    id: 'ledger-init-operation-subjects',
    note: '确认 45 个内置会计科目作为本账套科目体系。',
    operatedAt: ledgerInitializationProfile.subjectConfirmedAt,
    result: '科目已确认'
  },
  {
    action: '录入期初余额',
    actor: ledgerInitializationProfile.openingRecordedBy,
    id: 'ledger-init-operation-opening',
    note: '录入 8 条期初余额，覆盖货币资金、往来、薪酬、权益和本年利润。',
    operatedAt: ledgerInitializationProfile.openingRecordedAt,
    result: '期初已录入'
  },
  {
    action: '试算平衡',
    actor: ledgerInitializationProfile.trialBalancedBy,
    id: 'ledger-init-operation-trial',
    note: '期初借方合计与贷方合计一致，差额 0.00 元。',
    operatedAt: ledgerInitializationProfile.trialBalancedAt,
    result: '试算平衡'
  },
  {
    action: '启用账套',
    actor: ledgerInitializationProfile.enabledBy,
    id: 'ledger-init-operation-enable',
    note: '账套启用后，基础设置和期初余额进入只读锁定状态。',
    operatedAt: ledgerInitializationProfile.enabledAt,
    result: '已启用'
  }
];

export const ledgerInitializationDraftOperationRecords: LedgerInitializationOperationRecord[] = ledgerInitializationOperationRecords.filter(
  (record) => record.result !== '已启用'
);

export const defaultLedgerInitializationFilters: LedgerInitializationFilters = {
  keyword: '',
  subjectType: '全部'
};

function roundMoney(amount: number) {
  return Number(amount.toFixed(2));
}

export function buildLedgerOpeningBalanceKey({ auxiliaryLabel, subjectCode }: Pick<LedgerOpeningBalanceRow, 'auxiliaryLabel' | 'subjectCode'>) {
  return `${subjectCode}-${auxiliaryLabel.trim() || '无'}`;
}

function getInitializationStageIndex(status: LedgerInitializationStatus) {
  const statusOrder: LedgerInitializationStatus[] = [
    '未开始',
    '基础设置完成',
    '科目已确认',
    '期初已录入',
    '试算平衡',
    '已启用'
  ];

  if (status === '试算不平') {
    return 3;
  }

  return Math.max(statusOrder.indexOf(status), 0);
}

export function buildLedgerInitializationSteps(status: LedgerInitializationStatus): LedgerInitializationStep[] {
  const stageIndex = getInitializationStageIndex(status);
  const trialBalanceHasError = status === '试算不平';

  return ledgerInitializationStepDefinitions.map((definition, index) => {
    if (trialBalanceHasError && definition.key === 'trial-balance') {
      return {
        ...definition,
        status: 'error'
      };
    }

    if (status === '已启用' || index < stageIndex) {
      return {
        ...definition,
        status: 'finish'
      };
    }

    if (index === stageIndex) {
      return {
        ...definition,
        status: 'process'
      };
    }

    return {
      ...definition,
      status: 'wait'
    };
  });
}

export function buildLedgerInitializationSummary({
  openingBalanceRows = ledgerOpeningBalanceRows,
  profile = ledgerInitializationProfile,
  subjects = accountingSubjectSeedRows
}: {
  openingBalanceRows?: LedgerOpeningBalanceRow[];
  profile?: LedgerInitializationProfile;
  subjects?: AccountingSubjectRecord[];
} = {}): LedgerInitializationSummary {
  const debitTotal = roundMoney(openingBalanceRows.reduce((total, row) => total + row.debitAmount, 0));
  const creditTotal = roundMoney(openingBalanceRows.reduce((total, row) => total + row.creditAmount, 0));
  const difference = roundMoney(debitTotal - creditTotal);
  const hasTrialBalanceResult = profile.status === '试算平衡' || profile.status === '试算不平' || profile.status === '已启用';
  const hasTrialBalanceEvidence = Boolean(profile.trialBalancedAt && profile.trialBalancedBy);
  const hasBalanceDifference = Math.abs(difference) >= 0.01;
  const trialBalanceStatus: LedgerInitializationTrialBalanceStatus = profile.status === '试算不平' || hasBalanceDifference
    ? '不平衡'
    : hasTrialBalanceResult
      ? '平衡'
      : '待试算';
  const status = hasBalanceDifference && hasTrialBalanceResult ? '试算不平' : profile.status;
  const steps = buildLedgerInitializationSteps(status);
  const completedStepCount = steps.filter((step) => step.status === 'finish').length;

  return {
    accountingPeriod: profile.effectivePeriod,
    canEnable: status === '试算平衡' && trialBalanceStatus === '平衡' && hasTrialBalanceEvidence,
    completedStepCount,
    confirmedSubjectCount: subjects.filter((subject) => subject.status === '启用').length,
    creditTotal,
    debitTotal,
    difference,
    enabledSubjectCount: subjects.filter((subject) => subject.status === '启用').length,
    isLocked: status === '已启用',
    openingBalanceCount: openingBalanceRows.length,
    requiredStepCount: ledgerInitializationStepDefinitions.length,
    status,
    trialBalanceStatus
  };
}

export function buildLedgerInitializationOpeningBalancesForGeneralLedger(
  openingBalanceRows = ledgerOpeningBalanceRows,
  profile = ledgerInitializationProfile
): LedgerInitializationGeneralLedgerOpeningBalance[] {
  const summary = buildLedgerInitializationSummary({ openingBalanceRows, profile });

  if (!summary.isLocked || summary.trialBalanceStatus !== '平衡') {
    return [];
  }

  return openingBalanceRows.map((row) => {
    const amount =
      row.balanceDirection === '借方'
        ? roundMoney(row.debitAmount - row.creditAmount)
        : roundMoney(row.creditAmount - row.debitAmount);

    return {
      accountingPeriod: row.accountingPeriod,
      amount,
      source: '账套初始化',
      subjectCode: row.subjectCode
    };
  });
}

export function buildLedgerInitializationControlledActions({
  context = ledgerInitializationControlContext,
  profile = ledgerInitializationProfile
}: {
  context?: LedgerInitializationControlContext;
  profile?: LedgerInitializationProfile;
} = {}): LedgerInitializationControlledAction[] {
  const isEnabled = profile.status === '已启用';
  const canWithdrawEnablement = isEnabled && !context.hasGeneralLedgerRead && context.postedVoucherCount === 0 && !context.periodLocked;

  return [
    {
      downstreamSteps: ['回到试算平衡', '重新调整基础设置或期初余额', '重新试算', '重新启用账套'],
      effect: ['账套从已启用退回初始化阶段', '后续账簿不再使用本次启用期初数', '原启用记录保留为操作记录'],
      key: 'withdraw-enable',
      materials: ['撤回原因', '影响范围说明'],
      prechecks: ['没有已记账凭证', '总账尚未形成期初记录', '启用期间没有结账'],
      primaryActionLabel: '撤回启用',
      scenario: '账套刚启用但还没有正式发生凭证、总账或结账数据时使用。',
      status: !isEnabled ? '未启用' : canWithdrawEnablement ? '可发起' : '受限',
      title: '撤回启用'
    },
    {
      downstreamSteps: ['会计凭证记账', '总账和报表体现调整结果'],
      effect: ['不直接改原始期初余额', '生成待记账期初调整凭证', '保留原期初、调整依据和操作记录'],
      key: 'opening-adjustment',
      materials: ['调整科目', '调整方向和金额', '调整原因', '原始依据'],
      prechecks: ['账套已启用', '调整期间未被锁定', '涉及科目仍处于启用状态', '原始期初余额不允许直接改写'],
      primaryActionLabel: '生成调整凭证',
      scenario: '账套启用后已经进入总账或凭证流程，发现期初金额、科目或辅助核算需要修正时使用。',
      status: !isEnabled ? '未启用' : context.periodLocked ? '受限' : '可发起',
      title: '期初调整'
    }
  ];
}

function createValidationItem({
  blocking,
  id,
  message,
  severity,
  status,
  subjectCode,
  title
}: LedgerOpeningBalanceValidationItem): LedgerOpeningBalanceValidationItem {
  return {
    blocking,
    id,
    message,
    severity,
    status,
    subjectCode,
    title
  };
}

export function buildLedgerOpeningBalanceImportPreviewRows({
  importBatch = ledgerOpeningBalanceImportBatch,
  openingBalanceRows = ledgerOpeningBalanceRows
}: {
  importBatch?: LedgerOpeningBalanceImportBatch;
  openingBalanceRows?: LedgerOpeningBalanceRow[];
} = {}): LedgerOpeningBalanceImportPreviewRow[] {
  const currentKeys = new Set(openingBalanceRows.map(buildLedgerOpeningBalanceKey));

  return ledgerOpeningBalanceRows
    .filter((row) => row.entrySource === '导入应用')
    .map((row, index) => {
      const hasExistingRow = currentKeys.has(buildLedgerOpeningBalanceKey(row));

      return {
        ...row,
        importBatchId: importBatch.id,
        importImpact: hasExistingRow ? '覆盖' : '新增',
        lineNo: index + 2,
        previewMessage: hasExistingRow
          ? '同科目同辅助核算已存在，应用后覆盖当前台账。'
          : '当前台账不存在同科目同辅助核算，应用后新增。',
        previewStatus: '可应用'
      };
    });
}

export function validateLedgerOpeningBalances({
  openingBalanceRows = ledgerOpeningBalanceRows,
  subjects = accountingSubjectSeedRows
}: {
  openingBalanceRows?: LedgerOpeningBalanceRow[];
  subjects?: AccountingSubjectRecord[];
} = {}): LedgerOpeningBalanceValidationSummary {
  const items: LedgerOpeningBalanceValidationItem[] = [];
  const enabledSubjectsByCode = new Map(subjects.filter((subject) => subject.status === '启用').map((subject) => [subject.code, subject]));
  const duplicateKeys = new Map<string, number>();

  openingBalanceRows.forEach((row) => {
    const duplicateKey = buildLedgerOpeningBalanceKey(row);
    duplicateKeys.set(duplicateKey, (duplicateKeys.get(duplicateKey) ?? 0) + 1);

    if (!enabledSubjectsByCode.has(row.subjectCode)) {
      items.push(
        createValidationItem({
          blocking: true,
          id: `missing-subject-${row.id}`,
          message: '期初余额引用了未启用或不存在的会计科目。',
          severity: 'error',
          status: '需处理',
          subjectCode: row.subjectCode,
          title: '科目存在性'
        })
      );
    }

    if (row.debitAmount < 0 || row.creditAmount < 0) {
      items.push(
        createValidationItem({
          blocking: true,
          id: `negative-amount-${row.id}`,
          message: '期初余额金额不能为负数。',
          severity: 'error',
          status: '需处理',
          subjectCode: row.subjectCode,
          title: '金额合法性'
        })
      );
    }

    if (row.debitAmount > 0 && row.creditAmount > 0) {
      items.push(
        createValidationItem({
          blocking: true,
          id: `double-side-${row.id}`,
          message: '同一科目的一条期初余额不能同时填写借方和贷方金额。',
          severity: 'error',
          status: '需处理',
          subjectCode: row.subjectCode,
          title: '借贷方向'
        })
      );
    }

    if (row.debitAmount === 0 && row.creditAmount === 0) {
      items.push(
        createValidationItem({
          blocking: false,
          id: `zero-amount-${row.id}`,
          message: '零金额行不会影响试算平衡，启用前建议清理。',
          severity: 'warning',
          status: '需处理',
          subjectCode: row.subjectCode,
          title: '零金额行'
        })
      );
    }
  });

  duplicateKeys.forEach((count, key) => {
    if (count <= 1) {
      return;
    }

    items.push(
      createValidationItem({
        blocking: true,
        id: `duplicate-opening-${key}`,
        message: '同一科目和辅助核算存在多条期初余额，启用前需要合并。',
        severity: 'error',
        status: '需处理',
        subjectCode: key.split('-')[0],
        title: '重复期初'
      })
    );
  });

  const summary = buildLedgerInitializationSummary({ openingBalanceRows, subjects });

  if (Math.abs(summary.difference) >= 0.01) {
    items.push(
      createValidationItem({
        blocking: true,
        id: 'trial-balance-difference',
        message: `期初借贷差额 ${roundMoney(Math.abs(summary.difference)).toFixed(2)} 元，不能启用账套。`,
        severity: 'error',
        status: '需处理',
        title: '试算平衡'
      })
    );
  }

  if (items.length === 0) {
    items.push(
      createValidationItem({
        blocking: false,
        id: 'opening-balance-validation-passed',
        message: '科目、金额、重复项和试算平衡均通过。',
        severity: 'info',
        status: '通过',
        title: '期初余额校验'
      })
    );
  }

  const blockingIssueCount = items.filter((item) => item.blocking).length;
  const warningCount = items.filter((item) => item.severity === 'warning').length;
  const passedCount = items.filter((item) => item.status === '通过').length;

  return {
    blockingIssueCount,
    items,
    passedCount,
    status: blockingIssueCount > 0 ? '需处理' : '通过',
    warningCount
  };
}

export function buildLedgerOpeningBalanceWorkspace({
  importBatch = ledgerOpeningBalanceImportBatch,
  openingBalanceRows = ledgerOpeningBalanceRows,
  profile = ledgerInitializationProfile,
  subjects = accountingSubjectSeedRows
}: {
  importBatch?: LedgerOpeningBalanceImportBatch;
  openingBalanceRows?: LedgerOpeningBalanceRow[];
  profile?: LedgerInitializationProfile;
  subjects?: AccountingSubjectRecord[];
} = {}): LedgerOpeningBalanceWorkspace {
  const summary = buildLedgerInitializationSummary({ openingBalanceRows, profile, subjects });
  const validation = validateLedgerOpeningBalances({ openingBalanceRows, subjects });
  const isLocked = summary.isLocked;
  const importPreviewRows = buildLedgerOpeningBalanceImportPreviewRows({ importBatch, openingBalanceRows });
  const importPreviewHasBlockingIssue = importPreviewRows.some((row) => row.previewStatus === '需处理');
  const importStatus: LedgerOpeningBalanceImportStatus = isLocked
    ? '已锁定'
    : importPreviewHasBlockingIssue
      ? '校验失败'
      : importBatch.status;

  return {
    canApplyImport: !isLocked && importStatus === '待应用' && importPreviewRows.length > 0,
    canEditOpeningBalances: !isLocked,
    canImportOpeningBalances: !isLocked,
    canRunTrialBalance: !isLocked && openingBalanceRows.length > 0,
    entryStatus: isLocked ? '已锁定' : openingBalanceRows.length > 0 ? '已录入' : '可录入',
    importBatch,
    importPreviewRows,
    importStatus,
    isLocked,
    validation
  };
}

export function applyLedgerOpeningBalanceImportPreview({
  currentRows = ledgerOpeningBalanceRows,
  importPreviewRows,
  profile = ledgerInitializationProfile,
  subjects = accountingSubjectSeedRows
}: {
  currentRows?: LedgerOpeningBalanceRow[];
  importPreviewRows: LedgerOpeningBalanceImportPreviewRow[];
  profile?: LedgerInitializationProfile;
  subjects?: AccountingSubjectRecord[];
}): LedgerOpeningBalanceRow[] {
  if (profile.status === '已启用') {
    throw new Error('enabled account set opening balances are locked');
  }

  if (importPreviewRows.some((row) => row.previewStatus === '需处理')) {
    throw new Error('opening balance import preview has blocking validation issues');
  }

  const previewRowsByKey = new Map(importPreviewRows.map((row) => [buildLedgerOpeningBalanceKey(row), row]));
  const currentKeys = new Set(currentRows.map(buildLedgerOpeningBalanceKey));
  const previewRowsToAdd = importPreviewRows.filter((row) => !currentKeys.has(buildLedgerOpeningBalanceKey(row)));
  const toOpeningRow = (row: LedgerOpeningBalanceImportPreviewRow): LedgerOpeningBalanceRow => ({
    accountingPeriod: row.accountingPeriod,
    auxiliaryLabel: row.auxiliaryLabel,
    balanceDirection: row.balanceDirection,
    creditAmount: row.creditAmount,
    debitAmount: row.debitAmount,
    entrySource: '导入应用',
    id: row.id,
    source: row.source,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    subjectType: row.subjectType
  });
  const nextRows = [
    ...currentRows.map((row) => {
      const previewRow = previewRowsByKey.get(buildLedgerOpeningBalanceKey(row));

      return previewRow ? toOpeningRow(previewRow) : row;
    }),
    ...previewRowsToAdd.map(toOpeningRow)
  ];
  const validation = validateLedgerOpeningBalances({ openingBalanceRows: nextRows, subjects });
  const blockingDataIssues = validation.items.filter((item) => item.blocking && item.id !== 'trial-balance-difference');

  if (blockingDataIssues.length > 0) {
    throw new Error('opening balance import preview has blocking validation issues');
  }

  return nextRows;
}

export function matchesLedgerInitializationFilters(
  record: LedgerOpeningBalanceRow,
  filters: LedgerInitializationFilters
) {
  if (filters.subjectType !== '全部' && record.subjectType !== filters.subjectType) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [
    record.subjectCode,
    record.subjectName,
    record.subjectType,
    record.auxiliaryLabel,
    record.entrySource,
    ledgerOpeningBalanceEntrySourceLabels[record.entrySource],
    record.source
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}
