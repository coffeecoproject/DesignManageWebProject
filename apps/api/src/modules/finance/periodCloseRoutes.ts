import {
  buildCloseChecksResponse,
  closeAccountingPeriod,
  reopenAccountingPeriod,
  type AccountingPeriodEvent,
  type AccountingPeriodRecord,
  type AccountingPeriodIdempotencyRecord,
  type ReopenAccountingPeriodExternalSubmission,
  type ReopenAccountingPeriodRiskConfirmation,
  type ActorSnapshot,
  type ApiErrorResponse,
  type CloseCheckRow,
  type CloseChecksResponse,
  type CloseAccountingPeriodSuccess,
  type ReopenAccountingPeriodSuccess,
  type TrialBalanceSnapshot
} from './periodCloseContract.js';
import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import {
  buildAccountingPeriodVoucherSummaries,
  type AccountingPeriodVoucherCountSourceRow,
  type AccountingPeriodVoucherSummary
} from './periodCloseVoucherSummaryContract.js';
import {
  buildFinancialStatementReadiness,
  type CashFlowMappingRecord,
  type FinancialStatementLedgerEntry,
  type FinancialStatementLine
} from './financialStatementContract.js';

export type PeriodCloseRouteMethod = 'GET' | 'POST';

export type PeriodCloseRouteRequest = {
  body?: unknown;
  method: PeriodCloseRouteMethod;
  path: string;
  query?: Record<string, string | undefined>;
};

export type PeriodCloseServerContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  permissionScopes: FinancePeriodClosePermissionScope[];
  requestId: string;
};

export type PeriodCloseRouteState = {
  checkInputs: Record<
    string,
    {
      checks: CloseCheckRow[];
      computedAt: string;
      sourceVersionSetHash: string;
      trialBalance: TrialBalanceSnapshot;
    }
  >;
  financialStatementInputs?: {
    cashFlowMappings: CashFlowMappingRecord[];
    ledgerEntries: FinancialStatementLedgerEntry[];
    statementLineInputs?: Record<
      string,
      {
        balanceSheetLines?: FinancialStatementLine[];
        profitStatementLines?: FinancialStatementLine[];
      }
    >;
  };
  idempotencyRecords: AccountingPeriodIdempotencyRecord[];
  periods: AccountingPeriodRecord[];
  reopenExternalSubmissions?: ReopenAccountingPeriodExternalSubmission[];
  voucherRows?: AccountingPeriodVoucherCountSourceRow[];
  voucherSummaries?: Record<string, AccountingPeriodVoucherSummary>;
};

export type PeriodCloseRouteResponse = {
  body: unknown;
  state: PeriodCloseRouteState;
  status: number;
};

type CloseRequestBody = {
  expectedCheckSnapshotHash?: string;
  idempotencyKey?: string;
  reason?: string;
  version?: number;
};

type ValidCloseRequestBody = {
  expectedCheckSnapshotHash?: string;
  idempotencyKey: string;
  reason: string;
  version: number;
};

type ReopenRequestBody = {
  idempotencyKey?: string;
  reason?: string;
  riskConfirmation?: unknown;
  version?: number;
};

type ValidReopenRequestBody = {
  idempotencyKey: string;
  reason: string;
  riskConfirmation?: ReopenAccountingPeriodRiskConfirmation;
  version: number;
};

function cloneStatementLine(line: FinancialStatementLine): FinancialStatementLine {
  return {
    ...line,
    sourceSubjectCodes: [...line.sourceSubjectCodes],
    voucherNos: [...line.voucherNos]
  };
}

function cloneState(state: PeriodCloseRouteState): PeriodCloseRouteState {
  return {
    checkInputs: { ...state.checkInputs },
    ...(state.financialStatementInputs
      ? {
          financialStatementInputs: {
            cashFlowMappings: state.financialStatementInputs.cashFlowMappings.map((mapping) => ({ ...mapping })),
            ledgerEntries: state.financialStatementInputs.ledgerEntries.map((entry) => ({ ...entry })),
            ...(state.financialStatementInputs.statementLineInputs
              ? {
                  statementLineInputs: Object.fromEntries(
                    Object.entries(state.financialStatementInputs.statementLineInputs).map(([period, inputs]) => [
                      period,
                      {
                        ...(inputs.balanceSheetLines
                          ? { balanceSheetLines: inputs.balanceSheetLines.map(cloneStatementLine) }
                          : {}),
                        ...(inputs.profitStatementLines
                          ? { profitStatementLines: inputs.profitStatementLines.map(cloneStatementLine) }
                          : {})
                      }
                    ])
                  )
                }
              : {})
          }
        }
      : {}),
    idempotencyRecords: [...state.idempotencyRecords],
    periods: state.periods.map((period) => ({ ...period })),
    ...(state.reopenExternalSubmissions
      ? { reopenExternalSubmissions: state.reopenExternalSubmissions.map((submission) => ({ ...submission })) }
      : {}),
    ...(state.voucherSummaries
      ? {
          voucherSummaries: Object.fromEntries(
            Object.entries(state.voucherSummaries).map(([period, summary]) => [period, { ...summary }])
          )
        }
      : {}),
    ...(state.voucherRows ? { voucherRows: state.voucherRows.map((row) => ({ ...row })) } : {})
  };
}

function createRouteError({
  code,
  message,
  period,
  requestId,
  status
}: {
  code: ApiErrorResponse['code'] | 'INVALID_REQUEST' | 'NOT_FOUND';
  message: string;
  period?: string;
  requestId: string;
  status: number;
}): Omit<PeriodCloseRouteResponse, 'state'> {
  return {
    body: {
      code,
      message,
      period,
      requestId
    },
    status
  };
}

function withState(response: Omit<PeriodCloseRouteResponse, 'state'>, state: PeriodCloseRouteState): PeriodCloseRouteResponse {
  return {
    ...response,
    state
  };
}

function buildRouteEventId(event: AccountingPeriodEvent) {
  return `${event.period}:${event.eventType}:${event.timestamp}:${event.requestId}`;
}

function buildCloseSuccessBody(result: CloseAccountingPeriodSuccess) {
  return {
    checkSnapshotHash: result.period.closeCheckSnapshotHash,
    closeCheckSnapshotId: result.period.closeCheckSnapshotId,
    closeReason: result.period.closeReason,
    closedAt: result.period.closedAt,
    closedBySnapshot: result.period.closedBySnapshot,
    eventId: buildRouteEventId(result.event),
    period: result.period.period,
    replayed: result.replayed,
    status: result.period.status,
    version: result.period.version
  };
}

function buildReopenSuccessBody(result: ReopenAccountingPeriodSuccess) {
  return {
    eventId: buildRouteEventId(result.event),
    period: result.period.period,
    reopenImpactSnapshot: result.period.reopenImpactSnapshot,
    reopenedAt: result.period.reopenedAt,
    reopenedBySnapshot: result.period.reopenedBySnapshot,
    reopenReason: result.period.reopenReason,
    reopenRiskConfirmationSnapshot: result.period.reopenRiskConfirmationSnapshot,
    replayed: result.replayed,
    status: result.period.status,
    version: result.period.version
  };
}

function authorizeRoute({
  context,
  operation,
  period,
  requiredPermissionScope,
  state
}: {
  context: PeriodCloseServerContext;
  operation: string;
  period?: string;
  requiredPermissionScope: FinancePeriodClosePermissionScope;
  state: PeriodCloseRouteState;
}): PeriodCloseRouteResponse | undefined {
  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation,
    period,
    requiredPermissionScope
  });

  if (authorization.allowed) {
    return undefined;
  }

  return withState(
    {
      body: authorization.error,
      status: 403
    },
    state
  );
}

function findPeriod(state: PeriodCloseRouteState, period: string) {
  return state.periods.find((item) => item.period === period);
}

function buildVoucherBookingCheckFromRows({
  baseCheck,
  period,
  voucherRows
}: {
  baseCheck?: CloseCheckRow;
  period: AccountingPeriodRecord;
  voucherRows: AccountingPeriodVoucherCountSourceRow[];
}): CloseCheckRow {
  const unbookedRows = voucherRows.filter((row) => row.accountingPeriod === period.period && row.status === '已制单');
  const blockerCount = unbookedRows.length;

  return {
    blockerCount,
    canPass: blockerCount === 0,
    code: 'voucher_booking',
    label: baseCheck?.label ?? '凭证记账',
    nextModule: baseCheck?.nextModule ?? '会计凭证',
    sources: unbookedRows.map((row) => ({
      accountingPeriod: period.period,
      nextAction: '完成凭证记账后重新运行结账检查',
      reason: '凭证已制单但尚未记账。',
      reasonCode: 'unbooked_voucher',
      sourceId: row.id,
      sourceModule: row.sourceModule ?? '会计凭证',
      sourceNo: row.sourceNo ?? row.id,
      sourceStatus: row.status
    })),
    status: blockerCount === 0 ? '通过' : '阻断',
    summary: blockerCount === 0 ? '已制单凭证均已完成记账。' : `还有 ${blockerCount} 张已制单凭证未记账。`
  };
}

function buildFinancialStatementReadinessCheck({
  baseCheck,
  period,
  state
}: {
  baseCheck?: CloseCheckRow;
  period: AccountingPeriodRecord;
  state: PeriodCloseRouteState;
}): CloseCheckRow | undefined {
  const inputs = state.financialStatementInputs;

  if (!inputs) {
    return undefined;
  }

  const lineInputs = inputs.statementLineInputs?.[period.period];
  const readiness = buildFinancialStatementReadiness({
    accountingPeriod: period.period,
    balanceSheetLines: lineInputs?.balanceSheetLines,
    cashFlowMappings: inputs.cashFlowMappings,
    ledgerEntries: inputs.ledgerEntries,
    profitStatementLines: lineInputs?.profitStatementLines
  });

  if (readiness.canGenerateSnapshot) {
    return {
      blockerCount: 0,
      canPass: true,
      code: 'financial_statements',
      label: baseCheck?.label ?? '报表准备',
      nextModule: baseCheck?.nextModule ?? '财务报表',
      sources: [],
      status: '通过',
      summary:
        period.status === '已结账'
          ? '财务报表快照准备已具备，报表可读取已结账账簿结果。'
          : '财务报表试算准备已具备，结账后可生成报表快照。'
    };
  }

  return {
    blockerCount: readiness.cashFlowMappingGaps.length,
    canPass: false,
    code: 'financial_statements',
    label: baseCheck?.label ?? '报表准备',
    nextModule: baseCheck?.nextModule ?? '财务报表',
    sources: readiness.cashFlowMappingGaps.map((gap) => ({
      accountingPeriod: period.period,
      nextAction: '补齐现金流量表项目映射后重新运行结账检查',
      reason: gap.reason,
      reasonCode: 'cash_flow_mapping_missing',
      sourceId: `cash-flow-mapping:${gap.voucherNo}`,
      sourceModule: '财务报表',
      sourceNo: gap.voucherNo,
      sourceStatus: '待补映射'
    })),
    status: '阻断',
    summary: `现金流量表有 ${readiness.cashFlowMappingGaps.length} 张凭证缺少对方科目映射。`
  };
}

function buildEffectiveChecksForPeriod({
  checks,
  period,
  state
}: {
  checks: CloseCheckRow[];
  period: AccountingPeriodRecord;
  state: PeriodCloseRouteState;
}) {
  const baseVoucherBookingCheck = checks.find((check) => check.code === 'voucher_booking');
  const voucherBookingCheck = state.voucherRows
    ? buildVoucherBookingCheckFromRows({
        baseCheck: baseVoucherBookingCheck,
        period,
        voucherRows: state.voucherRows
      })
    : undefined;
  const baseFinancialStatementReadinessCheck = checks.find((check) => check.code === 'financial_statements');
  const financialStatementReadinessCheck = buildFinancialStatementReadinessCheck({
    baseCheck: baseFinancialStatementReadinessCheck,
    period,
    state
  });
  let replacedVoucherBookingCheck = false;
  let replacedFinancialStatementReadinessCheck = false;
  const effectiveChecks = checks.map((check) => {
    if (check.code === 'voucher_booking' && voucherBookingCheck) {
      replacedVoucherBookingCheck = true;
      return voucherBookingCheck;
    }

    if (check.code === 'financial_statements' && financialStatementReadinessCheck) {
      replacedFinancialStatementReadinessCheck = true;
      return financialStatementReadinessCheck;
    }

    return check;
  });

  if (voucherBookingCheck && !replacedVoucherBookingCheck) {
    effectiveChecks.push(voucherBookingCheck);
  }

  if (financialStatementReadinessCheck && !replacedFinancialStatementReadinessCheck) {
    effectiveChecks.push(financialStatementReadinessCheck);
  }

  return effectiveChecks;
}

function buildChecksForPeriod(state: PeriodCloseRouteState, period: AccountingPeriodRecord): CloseChecksResponse | undefined {
  const input = state.checkInputs[period.period];

  if (!input) {
    return undefined;
  }

  return buildCloseChecksResponse({
    checks: buildEffectiveChecksForPeriod({ checks: input.checks, period, state }),
    computedAt: input.computedAt,
    period,
    sourceVersionSetHash: input.sourceVersionSetHash,
    trialBalance: input.trialBalance
  });
}

function buildVoucherSummaryForPeriod({
  checks,
  period,
  voucherSummaries
}: {
  checks: CloseChecksResponse | undefined;
  period: AccountingPeriodRecord;
  voucherSummaries?: Record<string, AccountingPeriodVoucherSummary>;
}) {
  const explicitSummary = voucherSummaries?.[period.period];
  const voucherBookingBlockerCount =
    checks?.checks.find((check) => check.code === 'voucher_booking' && !check.canPass)?.blockerCount ?? 0;

  return {
    bookedVoucherCount: explicitSummary?.bookedVoucherCount ?? 0,
    preparedVoucherCount: explicitSummary?.preparedVoucherCount ?? voucherBookingBlockerCount,
    unbookedVoucherCount: explicitSummary?.unbookedVoucherCount ?? voucherBookingBlockerCount
  };
}

function parseAccountingPeriodPath(path: string) {
  const match = path.match(/^\/api\/finance\/accounting-periods\/(\d{4}-\d{2})(?:\/(close-checks|close|reopen))?$/);

  if (!match) {
    return undefined;
  }

  return {
    action: match[2],
    period: match[1]
  };
}

function isCloseRequestBody(value: unknown): value is ValidCloseRequestBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const body = value as CloseRequestBody;

  return typeof body.reason === 'string' && typeof body.version === 'number' && typeof body.idempotencyKey === 'string';
}

function isReopenRequestBody(value: unknown): value is ValidReopenRequestBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const body = value as ReopenRequestBody;

  if (typeof body.reason !== 'string' || typeof body.version !== 'number' || typeof body.idempotencyKey !== 'string') {
    return false;
  }

  if (body.riskConfirmation === undefined) {
    return true;
  }

  if (!body.riskConfirmation || typeof body.riskConfirmation !== 'object') {
    return false;
  }

  const riskConfirmation = body.riskConfirmation as Partial<ReopenAccountingPeriodRiskConfirmation>;

  return (
    typeof riskConfirmation.decisionNo === 'string' &&
    typeof riskConfirmation.note === 'string' &&
    (riskConfirmation.allowLaterClosedPeriods === undefined ||
      typeof riskConfirmation.allowLaterClosedPeriods === 'boolean') &&
    (riskConfirmation.allowIrreversibleExternalSubmissions === undefined ||
      typeof riskConfirmation.allowIrreversibleExternalSubmissions === 'boolean')
  );
}

function handleListAccountingPeriods({
  context,
  request,
  state
}: {
  context: PeriodCloseServerContext;
  request: PeriodCloseRouteRequest;
  state: PeriodCloseRouteState;
}): PeriodCloseRouteResponse {
  const authorizationFailure = authorizeRoute({
    context,
    operation: '查看会计期间',
    requiredPermissionScope: 'finance.accountingPeriod.read',
    state
  });

  if (authorizationFailure) {
    return authorizationFailure;
  }

  const { fromPeriod, status, toPeriod } = request.query ?? {};
  const voucherSummaries = state.voucherRows ? buildAccountingPeriodVoucherSummaries(state.voucherRows) : state.voucherSummaries;
  const items = state.periods
    .filter((period) => (!fromPeriod || period.period >= fromPeriod) && (!toPeriod || period.period <= toPeriod))
    .filter((period) => !status || period.status === status)
    .map((period) => {
      const checks = buildChecksForPeriod(state, period);
      const blockingChecks = checks?.checks.filter((check) => !check.canPass) ?? [];
      const voucherSummary = buildVoucherSummaryForPeriod({ checks, period, voucherSummaries });

      return {
        blockingCandidateCount: blockingChecks.reduce((sum, check) => sum + check.blockerCount, 0),
        bookedVoucherCount: voucherSummary.bookedVoucherCount,
        canClose: checks?.canClose ?? false,
        closeCheckStatus: checks ? (checks.canClose ? '通过' : '阻断') : '未运行',
        closeReason: period.closeReason,
        closedAt: period.closedAt,
        closedBySnapshot: period.closedBySnapshot,
        latestCheckSnapshotHash: period.closeCheckSnapshotHash ?? checks?.checkSnapshotHash,
        period: period.period,
        preparedVoucherCount: voucherSummary.preparedVoucherCount,
        status: period.status,
        trialBalanceDifference: checks?.trialBalance.difference ?? '0.00',
        trialBalanceStatus: checks?.trialBalance.status ?? '未生成',
        unbookedVoucherCount: voucherSummary.unbookedVoucherCount,
        version: period.version
      };
    });

  return withState(
    {
      body: {
        items,
        serverTime: context.now
      },
      status: 200
    },
    state
  );
}

function handleReadCloseChecks({
  context,
  period,
  state
}: {
  context: PeriodCloseServerContext;
  period: string;
  state: PeriodCloseRouteState;
}): PeriodCloseRouteResponse {
  const authorizationFailure = authorizeRoute({
    context,
    operation: '查看期间结账检查',
    period,
    requiredPermissionScope: 'finance.accountingPeriod.read',
    state
  });

  if (authorizationFailure) {
    return authorizationFailure;
  }

  const periodRecord = findPeriod(state, period);

  if (!periodRecord) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '会计期间不存在。',
        period,
        requestId: context.requestId,
        status: 404
      }),
      state
    );
  }

  const checks = buildChecksForPeriod(state, periodRecord);

  if (!checks) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '会计期间结账检查尚未生成。',
        period,
        requestId: context.requestId,
        status: 404
      }),
      state
    );
  }

  return withState(
    {
      body: checks,
      status: 200
    },
    state
  );
}

function handleCloseAccountingPeriodRoute({
  context,
  period,
  request,
  state
}: {
  context: PeriodCloseServerContext;
  period: string;
  request: PeriodCloseRouteRequest;
  state: PeriodCloseRouteState;
}): PeriodCloseRouteResponse {
  const authorizationFailure = authorizeRoute({
    context,
    operation: '确认期间结账',
    period,
    requiredPermissionScope: 'finance.accountingPeriod.close',
    state
  });

  if (authorizationFailure) {
    return authorizationFailure;
  }

  const periodRecord = findPeriod(state, period);

  if (!periodRecord) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '会计期间不存在。',
        period,
        requestId: context.requestId,
        status: 404
      }),
      state
    );
  }

  if (!isCloseRequestBody(request.body)) {
    return withState(
      createRouteError({
        code: 'INVALID_REQUEST',
        message: '结账请求必须包含 reason、version 和 idempotencyKey。',
        period,
        requestId: context.requestId,
        status: 400
      }),
      state
    );
  }

  const closeBody = request.body;
  const checks = buildChecksForPeriod(state, periodRecord);

  if (!checks) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '会计期间结账检查尚未生成。',
        period,
        requestId: context.requestId,
        status: 404
      }),
      state
    );
  }

  const closeResult = closeAccountingPeriod({
    checks,
    idempotencyRecords: state.idempotencyRecords,
    period: periodRecord,
    request: {
      actorSnapshot: context.actorSnapshot,
      expectedCheckSnapshotHash: closeBody.expectedCheckSnapshotHash,
      idempotencyKey: closeBody.idempotencyKey,
      now: context.now,
      reason: closeBody.reason,
      requestId: context.requestId,
      version: closeBody.version
    }
  });

  if (!closeResult.ok) {
    return withState(
      {
        body: closeResult.error,
        status: closeResult.error.code === 'PERIOD_VERSION_CONFLICT' ? 409 : 422
      },
      {
        ...state,
        idempotencyRecords: closeResult.idempotencyRecords
      }
    );
  }

  const nextState = {
    ...state,
    idempotencyRecords: closeResult.idempotencyRecords,
    periods: state.periods.map((item) => (item.period === period ? closeResult.period : item))
  };

  return withState(
    {
      body: buildCloseSuccessBody(closeResult),
      status: closeResult.replayed ? 200 : 201
    },
    nextState
  );
}

function handleReopenAccountingPeriodRoute({
  context,
  period,
  request,
  state
}: {
  context: PeriodCloseServerContext;
  period: string;
  request: PeriodCloseRouteRequest;
  state: PeriodCloseRouteState;
}): PeriodCloseRouteResponse {
  const authorizationFailure = authorizeRoute({
    context,
    operation: '执行反结账',
    period,
    requiredPermissionScope: 'finance.accountingPeriod.reopen',
    state
  });

  if (authorizationFailure) {
    return authorizationFailure;
  }

  const periodRecord = findPeriod(state, period);

  if (!periodRecord) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '会计期间不存在。',
        period,
        requestId: context.requestId,
        status: 404
      }),
      state
    );
  }

  if (!isReopenRequestBody(request.body)) {
    return withState(
      createRouteError({
        code: 'INVALID_REQUEST',
        message: '反结账请求必须包含 reason、version 和 idempotencyKey。',
        period,
        requestId: context.requestId,
        status: 400
      }),
      state
    );
  }

  const reopenResult = reopenAccountingPeriod({
    irreversibleExternalSubmissions: state.reopenExternalSubmissions,
    idempotencyRecords: state.idempotencyRecords,
    period: periodRecord,
    periods: state.periods,
    request: {
      actorSnapshot: context.actorSnapshot,
      idempotencyKey: request.body.idempotencyKey,
      now: context.now,
      reason: request.body.reason,
      requestId: context.requestId,
      riskConfirmation: request.body.riskConfirmation,
      version: request.body.version
    }
  });

  if (!reopenResult.ok) {
    return withState(
      {
        body: reopenResult.error,
        status: ['PERIOD_REOPEN_BLOCKED', 'PERIOD_VERSION_CONFLICT'].includes(reopenResult.error.code) ? 409 : 422
      },
      {
        ...state,
        idempotencyRecords: reopenResult.idempotencyRecords
      }
    );
  }

  const nextState = {
    ...state,
    idempotencyRecords: reopenResult.idempotencyRecords,
    periods: state.periods.map((item) => (item.period === period ? reopenResult.period : item))
  };

  return withState(
    {
      body: buildReopenSuccessBody(reopenResult),
      status: reopenResult.replayed ? 200 : 201
    },
    nextState
  );
}

export function handleFinancePeriodCloseRoute({
  context,
  request,
  state
}: {
  context: PeriodCloseServerContext;
  request: PeriodCloseRouteRequest;
  state: PeriodCloseRouteState;
}): PeriodCloseRouteResponse {
  const currentState = cloneState(state);

  if (request.method === 'GET' && request.path === '/api/finance/accounting-periods') {
    return handleListAccountingPeriods({ context, request, state: currentState });
  }

  const parsedPath = parseAccountingPeriodPath(request.path);

  if (!parsedPath) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '接口不存在。',
        requestId: context.requestId,
        status: 404
      }),
      currentState
    );
  }

  if (request.method === 'GET' && parsedPath.action === 'close-checks') {
    return handleReadCloseChecks({ context, period: parsedPath.period, state: currentState });
  }

  if (request.method === 'POST' && parsedPath.action === 'close') {
    return handleCloseAccountingPeriodRoute({
      context,
      period: parsedPath.period,
      request,
      state: currentState
    });
  }

  if (request.method === 'POST' && parsedPath.action === 'reopen') {
    return handleReopenAccountingPeriodRoute({
      context,
      period: parsedPath.period,
      request,
      state: currentState
    });
  }

  return withState(
    createRouteError({
      code: 'NOT_FOUND',
      message: '接口不存在。',
      requestId: context.requestId,
      status: 404
    }),
    currentState
  );
}
