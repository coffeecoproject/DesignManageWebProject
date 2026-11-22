import {
  createStableSnapshotHash,
  type AccountingPeriodRecord,
  type ActorSnapshot
} from './periodCloseContract.js';

export type CashFlowActivity = '经营活动' | '投资活动' | '筹资活动';
export type CashFlowMappingStatus = '有效' | '停用';
export type FinancialStatementReadinessStatus = '可生成' | '需处理';
export type FinancialStatementSnapshotStatus = '已生成';

export type FinancialStatementErrorCode =
  | 'CASH_FLOW_MAPPING_INCOMPLETE'
  | 'FINANCIAL_STATEMENT_READINESS_STALE'
  | 'FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED';

export type CashFlowMappingRecord = {
  activity: CashFlowActivity;
  createdAt: string;
  createdBySnapshot: ActorSnapshot;
  effectivePeriod: string;
  item: string;
  status: CashFlowMappingStatus;
  subjectCode: string;
  version: number;
};

export type FinancialStatementLedgerEntry = {
  accountingPeriod: string;
  creditAmount: string;
  debitAmount: string;
  subjectCode: string;
  voucherId: string;
  voucherNo: string;
};

export type FinancialStatementLine = {
  amount: string;
  item: string;
  section: string;
  sourceSubjectCodes: string[];
  voucherNos: string[];
};

export type FinancialStatementGeneralLedgerLine = {
  accountingPeriod: string;
  creditAmount: string;
  debitAmount: string;
  entryCount: number;
  sourceLedgerHash: string;
  subjectCode: string;
  voucherNos: string[];
};

export type CashFlowMappingGap = {
  cashSubjectCodes: string[];
  counterpartSubjectCodes: string[];
  reason: string;
  voucherNo: string;
};

export type BuildFinancialStatementReadinessInput = {
  accountingPeriod: string;
  balanceSheetLines?: FinancialStatementLine[];
  cashFlowMappings: CashFlowMappingRecord[];
  ledgerEntries: FinancialStatementLedgerEntry[];
  profitStatementLines?: FinancialStatementLine[];
};

export type FinancialStatementReadiness = {
  accountingPeriod: string;
  balanceSheetLines: FinancialStatementLine[];
  canGenerateSnapshot: boolean;
  cashFlowLines: FinancialStatementLine[];
  cashFlowMappingGaps: CashFlowMappingGap[];
  cashFlowMappingVersionHash: string;
  generalLedgerLines: FinancialStatementGeneralLedgerLine[];
  profitStatementLines: FinancialStatementLine[];
  sourceLedgerHash: string;
  status: FinancialStatementReadinessStatus;
};

export type CreateFinancialStatementSnapshotRequest = {
  generatedAt: string;
  generatedBySnapshot: ActorSnapshot;
  requestId: string;
};

export type FinancialStatementSnapshot = {
  accountingPeriod: string;
  balanceSheetLines: FinancialStatementLine[];
  cashFlowLines: FinancialStatementLine[];
  cashFlowMappingVersionHash: string;
  generatedAt: string;
  generatedBySnapshot: ActorSnapshot;
  generalLedgerLines: FinancialStatementGeneralLedgerLine[];
  profitStatementLines: FinancialStatementLine[];
  snapshotHash: string;
  sourceLedgerHash: string;
  status: FinancialStatementSnapshotStatus;
};

export type FinancialStatementError = {
  code: FinancialStatementErrorCode;
  message: string;
  period: string;
  requestId: string;
};

export type CreateFinancialStatementSnapshotResult =
  | {
      ok: true;
      snapshot: FinancialStatementSnapshot;
    }
  | {
      error: FinancialStatementError;
      ok: false;
    };

const cashSubjectCodes = new Set(['1001', '1002', '1012']);
const moneyTolerance = 0.005;

function parseMoney(amount: string) {
  const parsed = Number(amount);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatMoney(amount: number) {
  if (Object.is(amount, -0)) {
    return '0.00';
  }

  return amount.toFixed(2);
}

function normalizeLine(line: FinancialStatementLine): FinancialStatementLine {
  return {
    ...line,
    sourceSubjectCodes: [...new Set(line.sourceSubjectCodes)].sort(),
    voucherNos: [...new Set(line.voucherNos)].sort()
  };
}

function normalizeLines(lines: readonly FinancialStatementLine[]) {
  return lines
    .map(normalizeLine)
    .sort(
      (left, right) =>
        left.section.localeCompare(right.section) ||
        left.item.localeCompare(right.item) ||
        left.amount.localeCompare(right.amount)
    );
}

function isCashSubjectCode(subjectCode: string) {
  return cashSubjectCodes.has(subjectCode);
}

function mappingIdentity(record: CashFlowMappingRecord) {
  return {
    activity: record.activity,
    effectivePeriod: record.effectivePeriod,
    item: record.item,
    status: record.status,
    subjectCode: record.subjectCode,
    version: record.version
  };
}

export function resolveCashFlowMappingsForPeriod({
  accountingPeriod,
  mappings
}: {
  accountingPeriod: string;
  mappings: readonly CashFlowMappingRecord[];
}) {
  const latestBySubject = new Map<string, CashFlowMappingRecord>();
  const candidates = mappings
    .filter((mapping) => mapping.status === '有效' && mapping.effectivePeriod <= accountingPeriod)
    .sort(
      (left, right) =>
        left.subjectCode.localeCompare(right.subjectCode) ||
        right.effectivePeriod.localeCompare(left.effectivePeriod) ||
        right.version - left.version
    );

  for (const candidate of candidates) {
    if (!latestBySubject.has(candidate.subjectCode)) {
      latestBySubject.set(candidate.subjectCode, candidate);
    }
  }

  return [...latestBySubject.values()].sort((left, right) => left.subjectCode.localeCompare(right.subjectCode));
}

export function createCashFlowMappingVersionHash(mappings: readonly CashFlowMappingRecord[]) {
  return createStableSnapshotHash(
    mappings.map(mappingIdentity).sort((left, right) => {
      return (
        left.subjectCode.localeCompare(right.subjectCode) ||
        left.effectivePeriod.localeCompare(right.effectivePeriod) ||
        left.version - right.version
      );
    })
  );
}

function createSourceLedgerHash(entries: readonly FinancialStatementLedgerEntry[]) {
  return createStableSnapshotHash(
    entries
      .map((entry) => ({
        accountingPeriod: entry.accountingPeriod,
        creditAmount: entry.creditAmount,
        debitAmount: entry.debitAmount,
        subjectCode: entry.subjectCode,
        voucherId: entry.voucherId,
        voucherNo: entry.voucherNo
      }))
      .sort(
        (left, right) =>
          left.voucherNo.localeCompare(right.voucherNo) ||
          left.subjectCode.localeCompare(right.subjectCode) ||
          left.debitAmount.localeCompare(right.debitAmount) ||
          left.creditAmount.localeCompare(right.creditAmount)
      )
  );
}

function normalizeGeneralLedgerLine(line: FinancialStatementGeneralLedgerLine): FinancialStatementGeneralLedgerLine {
  return {
    ...line,
    voucherNos: [...new Set(line.voucherNos)].sort()
  };
}

function buildGeneralLedgerLines({
  accountingPeriod,
  ledgerEntries,
  sourceLedgerHash
}: {
  accountingPeriod: string;
  ledgerEntries: readonly FinancialStatementLedgerEntry[];
  sourceLedgerHash: string;
}) {
  const linesBySubject = new Map<string, FinancialStatementGeneralLedgerLine & {
    numericCreditAmount: number;
    numericDebitAmount: number;
  }>();

  ledgerEntries
    .filter((entry) => entry.accountingPeriod === accountingPeriod)
    .forEach((entry) => {
      const current = linesBySubject.get(entry.subjectCode) ?? {
        accountingPeriod,
        creditAmount: '0.00',
        debitAmount: '0.00',
        entryCount: 0,
        numericCreditAmount: 0,
        numericDebitAmount: 0,
        sourceLedgerHash,
        subjectCode: entry.subjectCode,
        voucherNos: []
      };

      current.entryCount += 1;
      current.numericCreditAmount += parseMoney(entry.creditAmount);
      current.numericDebitAmount += parseMoney(entry.debitAmount);
      current.voucherNos.push(entry.voucherNo);
      linesBySubject.set(entry.subjectCode, current);
    });

  return [...linesBySubject.values()]
    .map(({ numericCreditAmount, numericDebitAmount, ...line }) =>
      normalizeGeneralLedgerLine({
        ...line,
        creditAmount: formatMoney(numericCreditAmount),
        debitAmount: formatMoney(numericDebitAmount)
      })
    )
    .sort((left, right) => left.subjectCode.localeCompare(right.subjectCode));
}

function groupEntriesByVoucher(entries: readonly FinancialStatementLedgerEntry[]) {
  const grouped = new Map<string, FinancialStatementLedgerEntry[]>();

  for (const entry of entries) {
    const group = grouped.get(entry.voucherId) ?? [];
    group.push(entry);
    grouped.set(entry.voucherId, group);
  }

  return grouped;
}

export function buildFinancialStatementReadiness({
  accountingPeriod,
  balanceSheetLines = [],
  cashFlowMappings,
  ledgerEntries,
  profitStatementLines = []
}: BuildFinancialStatementReadinessInput): FinancialStatementReadiness {
  const periodLedgerEntries = ledgerEntries.filter((entry) => entry.accountingPeriod === accountingPeriod);
  const resolvedMappings = resolveCashFlowMappingsForPeriod({ accountingPeriod, mappings: cashFlowMappings });
  const mappingBySubjectCode = new Map(resolvedMappings.map((mapping) => [mapping.subjectCode, mapping]));
  const cashFlowLineByKey = new Map<string, FinancialStatementLine & { numericAmount: number }>();
  const cashFlowMappingGaps: CashFlowMappingGap[] = [];

  for (const voucherEntries of groupEntriesByVoucher(periodLedgerEntries).values()) {
    const cashEntries = voucherEntries.filter((entry) => isCashSubjectCode(entry.subjectCode));
    const cashMovement = cashEntries.reduce(
      (total, entry) => total + parseMoney(entry.debitAmount) - parseMoney(entry.creditAmount),
      0
    );

    if (cashEntries.length === 0 || Math.abs(cashMovement) < moneyTolerance) {
      continue;
    }

    const counterpartEntries = voucherEntries.filter((entry) => !isCashSubjectCode(entry.subjectCode));
    const mappedCounterpartEntries = counterpartEntries
      .map((entry) => ({ entry, mapping: mappingBySubjectCode.get(entry.subjectCode) }))
      .filter((item): item is { entry: FinancialStatementLedgerEntry; mapping: CashFlowMappingRecord } => Boolean(item.mapping));
    const unmappedSubjectCodes = counterpartEntries
      .filter((entry) => !mappingBySubjectCode.has(entry.subjectCode))
      .map((entry) => entry.subjectCode);

    if (mappedCounterpartEntries.length === 0 || unmappedSubjectCodes.length > 0) {
      cashFlowMappingGaps.push({
        cashSubjectCodes: [...new Set(cashEntries.map((entry) => entry.subjectCode))].sort(),
        counterpartSubjectCodes: [...new Set(unmappedSubjectCodes.length > 0 ? unmappedSubjectCodes : counterpartEntries.map((entry) => entry.subjectCode))].sort(),
        reason: '现金/银行分录的对方科目缺少现金流量表项目映射',
        voucherNo: voucherEntries[0]?.voucherNo ?? ''
      });
      continue;
    }

    const counterpartWeights = mappedCounterpartEntries.map(({ entry }) => {
      return Math.abs(parseMoney(entry.debitAmount)) + Math.abs(parseMoney(entry.creditAmount));
    });
    const totalWeight = counterpartWeights.reduce((total, amount) => total + amount, 0);

    mappedCounterpartEntries.forEach(({ entry, mapping }, index) => {
      const weight = totalWeight > moneyTolerance ? counterpartWeights[index] / totalWeight : 1 / mappedCounterpartEntries.length;
      const allocatedAmount = cashMovement * weight;
      const key = `${mapping.activity}:${mapping.item}`;
      const current = cashFlowLineByKey.get(key) ?? {
        amount: '0.00',
        item: mapping.item,
        numericAmount: 0,
        section: mapping.activity,
        sourceSubjectCodes: [],
        voucherNos: []
      };

      current.numericAmount += allocatedAmount;
      current.sourceSubjectCodes.push(entry.subjectCode);
      current.voucherNos.push(entry.voucherNo);
      cashFlowLineByKey.set(key, current);
    });
  }

  const cashFlowLines = normalizeLines(
    [...cashFlowLineByKey.values()].map(({ numericAmount, ...line }) => ({
      ...line,
      amount: formatMoney(numericAmount)
    }))
  );
  const canGenerateSnapshot = cashFlowMappingGaps.length === 0;
  const sourceLedgerHash = createSourceLedgerHash(periodLedgerEntries);

  return {
    accountingPeriod,
    balanceSheetLines: normalizeLines(balanceSheetLines),
    canGenerateSnapshot,
    cashFlowLines,
    cashFlowMappingGaps: cashFlowMappingGaps.sort((left, right) => left.voucherNo.localeCompare(right.voucherNo)),
    cashFlowMappingVersionHash: createCashFlowMappingVersionHash(resolvedMappings),
    generalLedgerLines: buildGeneralLedgerLines({
      accountingPeriod,
      ledgerEntries,
      sourceLedgerHash
    }),
    profitStatementLines: normalizeLines(profitStatementLines),
    sourceLedgerHash,
    status: canGenerateSnapshot ? '可生成' : '需处理'
  };
}

function createStatementError({
  code,
  message,
  period,
  requestId
}: FinancialStatementError): CreateFinancialStatementSnapshotResult {
  return {
    error: {
      code,
      message,
      period,
      requestId
    },
    ok: false
  };
}

export function createFinancialStatementSnapshot({
  period,
  readiness,
  request
}: {
  period: AccountingPeriodRecord;
  readiness: FinancialStatementReadiness;
  request: CreateFinancialStatementSnapshotRequest;
}): CreateFinancialStatementSnapshotResult {
  if (period.status !== '已结账') {
    return createStatementError({
      code: 'FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED',
      message: '正式财务报表快照只能在期间结账后生成。',
      period: period.period,
      requestId: request.requestId
    });
  }

  if (!readiness.canGenerateSnapshot) {
    return createStatementError({
      code: 'CASH_FLOW_MAPPING_INCOMPLETE',
      message: '现金流量表存在未映射的现金/银行对方科目，不能生成正式报表快照。',
      period: period.period,
      requestId: request.requestId
    });
  }

  const snapshotWithoutHash: Omit<FinancialStatementSnapshot, 'snapshotHash'> = {
    accountingPeriod: period.period,
    balanceSheetLines: readiness.balanceSheetLines,
    cashFlowLines: readiness.cashFlowLines,
    cashFlowMappingVersionHash: readiness.cashFlowMappingVersionHash,
    generatedAt: request.generatedAt,
    generatedBySnapshot: request.generatedBySnapshot,
    generalLedgerLines: readiness.generalLedgerLines,
    profitStatementLines: readiness.profitStatementLines,
    sourceLedgerHash: readiness.sourceLedgerHash,
    status: '已生成'
  };

  return {
    ok: true,
    snapshot: {
      ...snapshotWithoutHash,
      snapshotHash: createStableSnapshotHash(snapshotWithoutHash)
    }
  };
}
