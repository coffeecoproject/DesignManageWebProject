import type { PublicAccountRef, PublicAccountSnapshot } from '../system/PublicAccountConfigState';

export type BankStatementDirection = '入账' | '出账';
export type BankMatchStatus = '待确认' | '已对账' | '银行未匹配' | '系统未匹配' | '金额不一致' | '重复导入' | '暂不可对账';

export type BankStatementRecord = {
  amount: number;
  balance: number;
  bankSerialNo: string;
  batchNo: string;
  counterparty: string;
  direction: BankStatementDirection;
  id: string;
  importedAccountName: string;
  importedAccountNumber?: string;
  importedAt: string;
  matchedTransactionIds: string[];
  matchReason: string;
  matchStatus: BankMatchStatus;
  matchScore: number;
  publicAccountId: string;
  publicAccountSnapshot: PublicAccountSnapshot;
  statementDate: string;
  summary: string;
};

export type BankImportPrecheckLevel = '通过' | '提示' | '阻断';

export type BankImportPrecheckItem = {
  item: string;
  level: BankImportPrecheckLevel;
  result: string;
};

export type PeriodCount = {
  count: number;
  period: string;
};

export type BankStatementImportFieldKey =
  | 'amount'
  | 'bankSerialNo'
  | 'counterparty'
  | 'direction'
  | 'importedAccountName'
  | 'importedAccountNumber'
  | 'statementDate'
  | 'summary';

export type BankStatementImportFieldSpec = {
  aliases: string[];
  key: BankStatementImportFieldKey;
  label: string;
};

export type BankStatementImportPrecheckResult = {
  accountMismatchRows: BankStatementRecord[];
  blockedRowIds: ReadonlySet<string>;
  blockedRows: BankStatementRecord[];
  coveredPeriods: string[];
  duplicateRowIds: ReadonlySet<string>;
  duplicateRows: BankStatementRecord[];
  hasBlockingIssue: boolean;
  importableRowIds: ReadonlySet<string>;
  importableRows: BankStatementRecord[];
  invalidRows: BankStatementRecord[];
  items: BankImportPrecheckItem[];
  statementRange: string;
  summary: {
    accountMismatchCount: number;
    duplicateCount: number;
    amountMismatchCount: number;
    importableCount: number;
    invalidFieldCount: number;
    totalCount: number;
  };
  uncoveredPeriodCounts: PeriodCount[];
};

const bankImportAmountMismatchStatuses = new Set<BankMatchStatus>(['金额不一致']);

export const bankStatementImportFieldContract: BankStatementImportFieldSpec[] = [
  {
    aliases: ['账号名称', '账户名称', '账户名', '对公账户'],
    key: 'importedAccountName',
    label: '账户名称'
  },
  {
    aliases: ['银行账号', '账号', '本方账号', '本方银行账号'],
    key: 'importedAccountNumber',
    label: '银行账号'
  },
  {
    aliases: ['交易日期', '银行日期', '发生日期', '记账日期'],
    key: 'statementDate',
    label: '交易日期'
  },
  {
    aliases: ['银行流水号', '流水号', '交易流水号', '银行回单号'],
    key: 'bankSerialNo',
    label: '银行流水号'
  },
  {
    aliases: ['收支方向', '方向', '借贷方向'],
    key: 'direction',
    label: '收支方向'
  },
  {
    aliases: ['金额', '交易金额', '收入金额', '支出金额'],
    key: 'amount',
    label: '交易金额'
  },
  {
    aliases: ['对方户名', '对方账户名称', '交易对手', '对手方'],
    key: 'counterparty',
    label: '对方户名'
  },
  {
    aliases: ['摘要', '交易摘要', '用途', '备注'],
    key: 'summary',
    label: '摘要'
  }
];

export const requiredBankStatementImportFieldLabels = bankStatementImportFieldContract.map((field) => field.label);

export function normalizeBankImportIdentity(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeBankAccountNumber(value: string) {
  return value.replace(/\s/g, '');
}

export function buildBankStatementUniqueKey(record: Pick<BankStatementRecord, 'publicAccountId' | 'bankSerialNo'>) {
  const publicAccountId = normalizeBankImportIdentity(record.publicAccountId);
  const bankSerialNo = normalizeBankImportIdentity(record.bankSerialNo);

  return publicAccountId && bankSerialNo ? `${publicAccountId}::${bankSerialNo}` : '';
}

export function getStatementPeriod(date: string) {
  return date.slice(0, 7);
}

export function getBankStatementAccountingPeriods(records: Array<Pick<BankStatementRecord, 'statementDate'>>) {
  return Array.from(new Set(records.map((record) => getStatementPeriod(record.statementDate)).filter(Boolean))).sort((first, second) =>
    first.localeCompare(second)
  );
}

export function getStatementDateRangeLabel(records: BankStatementRecord[]) {
  const dates = records.map((record) => record.statementDate).sort((first, second) => first.localeCompare(second));

  if (dates.length === 0) {
    return '待识别';
  }

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  return firstDate === lastDate ? firstDate : `${firstDate} 至 ${lastDate}`;
}

export function getStatementBatchPeriodCode(records: BankStatementRecord[], fallbackCode: string) {
  const dates = records.map((record) => record.statementDate).sort((first, second) => first.localeCompare(second));

  if (dates.length === 0) {
    return fallbackCode;
  }

  const firstPeriod = getStatementPeriod(dates[0]).replace('-', '');
  const lastPeriod = getStatementPeriod(dates[dates.length - 1]).replace('-', '');

  return firstPeriod === lastPeriod ? firstPeriod : `${firstPeriod}-${lastPeriod}`;
}

export function buildPeriodCounts(periods: string[]): PeriodCount[] {
  const periodMap = new Map<string, number>();

  periods.forEach((period) => {
    periodMap.set(period, (periodMap.get(period) ?? 0) + 1);
  });

  return Array.from(periodMap, ([period, count]) => ({ count, period })).sort((first, second) => first.period.localeCompare(second.period));
}

export function formatPeriodCountList(periodCounts: PeriodCount[]) {
  if (periodCounts.length === 0) {
    return '暂无';
  }

  return periodCounts.map((item) => `${item.period} ${item.count} 条`).join('，');
}

export function formatPeriodList(periods: string[]) {
  if (periods.length === 0) {
    return '待识别';
  }

  return periods.join('，');
}

export function getUncoveredPeriodCounts(requiredPeriodCounts: PeriodCount[], coveredPeriods: Set<string>) {
  return requiredPeriodCounts.filter((item) => !coveredPeriods.has(item.period));
}

export function getBankStatementMissingFieldLabels(record: BankStatementRecord) {
  const missingFields: string[] = [];

  if (!normalizeBankImportIdentity(record.importedAccountName)) {
    missingFields.push('账户名称');
  }

  if (!normalizeBankAccountNumber(record.importedAccountNumber ?? '')) {
    missingFields.push('银行账号');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.statementDate)) {
    missingFields.push('交易日期');
  }

  if (!normalizeBankImportIdentity(record.bankSerialNo)) {
    missingFields.push('银行流水号');
  }

  if (record.direction !== '入账' && record.direction !== '出账') {
    missingFields.push('收支方向');
  }

  if (!Number.isFinite(record.amount) || record.amount <= 0) {
    missingFields.push('交易金额');
  }

  if (!normalizeBankImportIdentity(record.counterparty)) {
    missingFields.push('对方户名');
  }

  if (!normalizeBankImportIdentity(record.summary)) {
    missingFields.push('摘要');
  }

  return missingFields;
}

export function hasValidBankStatementImportFields(record: BankStatementRecord) {
  return getBankStatementMissingFieldLabels(record).length === 0;
}

export function isSelectedBankImportAccount(
  record: BankStatementRecord,
  selectedPublicAccount: PublicAccountRef,
  selectedAccountNumber?: string
) {
  const importedAccountNumber = normalizeBankAccountNumber(record.importedAccountNumber ?? '');
  const normalizedSelectedAccountNumber = normalizeBankAccountNumber(
    selectedAccountNumber ?? selectedPublicAccount.publicAccountSnapshot.accountTailNumber
  );

  return record.publicAccountId === selectedPublicAccount.publicAccountId
    && Boolean(normalizedSelectedAccountNumber)
    && (selectedAccountNumber
      ? importedAccountNumber === normalizedSelectedAccountNumber
      : importedAccountNumber.endsWith(normalizedSelectedAccountNumber));
}

export function buildBankStatementImportPrecheck(input: {
  existingRows: BankStatementRecord[];
  previewRows: BankStatementRecord[];
  requiredPeriodCounts: PeriodCount[];
  selectedPublicAccount?: PublicAccountRef;
  selectedAccountNumber?: string;
}): BankStatementImportPrecheckResult {
  const hasSelectedPublicAccount = Boolean(input.selectedPublicAccount);
  const existingUniqueKeys = new Set(input.existingRows.map(buildBankStatementUniqueKey).filter(Boolean));
  const seenPreviewUniqueKeys = new Set<string>();
  const accountMismatchRows: BankStatementRecord[] = [];
  const blockedRows: BankStatementRecord[] = [];
  const duplicateRows: BankStatementRecord[] = [];
  const importableRows: BankStatementRecord[] = [];
  const invalidRows: BankStatementRecord[] = [];

  input.previewRows.forEach((record) => {
    const uniqueKey = buildBankStatementUniqueKey(record);
    const hasInvalidFields = !hasValidBankStatementImportFields(record);
    const hasAccountMismatch = !input.selectedPublicAccount
      || !isSelectedBankImportAccount(record, input.selectedPublicAccount, input.selectedAccountNumber);
    const hasDuplicateKey = Boolean(uniqueKey && (existingUniqueKeys.has(uniqueKey) || seenPreviewUniqueKeys.has(uniqueKey)));

    if (uniqueKey) {
      seenPreviewUniqueKeys.add(uniqueKey);
    }

    if (hasInvalidFields) {
      invalidRows.push(record);
    }

    if (hasAccountMismatch) {
      accountMismatchRows.push(record);
    }

    if (hasInvalidFields || hasAccountMismatch) {
      blockedRows.push(record);
      return;
    }

    if (hasDuplicateKey) {
      duplicateRows.push(record);
      return;
    }

    importableRows.push(record);
  });

  const coveredPeriods = getBankStatementAccountingPeriods(input.previewRows);
  const uncoveredPeriodCounts = getUncoveredPeriodCounts(input.requiredPeriodCounts, new Set(coveredPeriods));
  const blockedRowIds = new Set(blockedRows.map((record) => record.id));
  const duplicateRowIds = new Set(duplicateRows.map((record) => record.id));
  const importableRowIds = new Set(importableRows.map((record) => record.id));
  const summary = {
    accountMismatchCount: accountMismatchRows.length,
    duplicateCount: duplicateRows.length,
    amountMismatchCount: input.previewRows.filter((record) => bankImportAmountMismatchStatuses.has(record.matchStatus)).length,
    importableCount: importableRows.length,
    invalidFieldCount: invalidRows.length,
    totalCount: input.previewRows.length
  };
  const items = buildBankImportPrecheckItems({
    accountMismatchCount: summary.accountMismatchCount,
    duplicateCount: summary.duplicateCount,
    hasSelectedPublicAccount,
    importableCount: summary.importableCount,
    invalidFieldCount: summary.invalidFieldCount,
    totalCount: summary.totalCount,
    uncoveredPeriodCounts
  });

  return {
    accountMismatchRows,
    blockedRowIds,
    blockedRows,
    coveredPeriods,
    duplicateRowIds,
    duplicateRows,
    hasBlockingIssue: !hasSelectedPublicAccount || blockedRows.length > 0,
    importableRowIds,
    importableRows,
    invalidRows,
    items,
    statementRange: getStatementDateRangeLabel(input.previewRows),
    summary,
    uncoveredPeriodCounts
  };
}

function buildBankImportPrecheckItems(input: {
  accountMismatchCount: number;
  duplicateCount: number;
  hasSelectedPublicAccount: boolean;
  importableCount: number;
  invalidFieldCount: number;
  totalCount: number;
  uncoveredPeriodCounts: PeriodCount[];
}): BankImportPrecheckItem[] {
  return [
    {
      item: '账户识别',
      level: !input.hasSelectedPublicAccount || input.accountMismatchCount > 0 ? '阻断' : '通过',
      result: !input.hasSelectedPublicAccount
        ? '请先选择启用且支持银行对账的对公账户'
        : input.accountMismatchCount > 0
          ? `${input.accountMismatchCount} 条账户无法识别`
          : '账户已识别'
    },
    {
      item: '字段校验',
      level: input.invalidFieldCount > 0 ? '阻断' : '通过',
      result: input.invalidFieldCount > 0 ? `${input.invalidFieldCount} 条缺少必要字段` : '必要字段完整'
    },
    {
      item: '重复流水',
      level: input.duplicateCount > 0 ? '提示' : '通过',
      result: input.duplicateCount > 0 ? `${input.duplicateCount} 条已存在，导入时跳过` : '未发现重复'
    },
    {
      item: '日期覆盖',
      level: input.uncoveredPeriodCounts.length > 0 ? '提示' : '通过',
      result: input.uncoveredPeriodCounts.length > 0 ? `未覆盖 ${formatPeriodCountList(input.uncoveredPeriodCounts)}` : '已覆盖建议补充期间'
    },
    {
      item: '入池结果',
      level: input.importableCount > 0 ? '通过' : input.accountMismatchCount > 0 || input.invalidFieldCount > 0 ? '阻断' : '提示',
      result: input.importableCount > 0 ? `${input.importableCount} 条可进入对账待办` : `暂无可入池新流水，共 ${input.totalCount} 条`
    }
  ];
}
