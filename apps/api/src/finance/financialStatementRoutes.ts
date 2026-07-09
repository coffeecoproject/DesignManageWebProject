import {
  buildFinancialStatementReadiness,
  createFinancialStatementSnapshot,
  type CashFlowMappingRecord,
  type FinancialStatementErrorCode,
  type FinancialStatementLedgerEntry,
  type FinancialStatementLine,
  type FinancialStatementSnapshot
} from './financialStatementContract.js';
import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import type { AccountingPeriodRecord, ActorSnapshot, ApiErrorResponse } from './periodCloseContract.js';

export type FinancialStatementRouteMethod = 'GET' | 'POST';

export type FinancialStatementRouteRequest = {
  body?: unknown;
  method: FinancialStatementRouteMethod;
  path: string;
  query?: Record<string, string | undefined>;
};

export type FinancialStatementServerContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  permissionScopes: FinancePeriodClosePermissionScope[];
  requestId: string;
};

export type FinancialStatementLineInputs = {
  balanceSheetLines?: FinancialStatementLine[];
  profitStatementLines?: FinancialStatementLine[];
};

export type FinancialStatementRouteState = {
  cashFlowMappings: CashFlowMappingRecord[];
  ledgerEntries: FinancialStatementLedgerEntry[];
  periods: AccountingPeriodRecord[];
  statementLineInputs?: Record<string, FinancialStatementLineInputs>;
  statementSnapshots: FinancialStatementSnapshot[];
};

export type FinancialStatementRouteResponse = {
  body: unknown;
  state: FinancialStatementRouteState;
  status: number;
};

type SnapshotRequestBody = {
  expectedCashFlowMappingVersionHash?: string;
  expectedSourceLedgerHash?: string;
};

type FinancialStatementRouteErrorCode =
  | ApiErrorResponse['code']
  | FinancialStatementErrorCode
  | 'INVALID_REQUEST'
  | 'NOT_FOUND';

function cloneState(state: FinancialStatementRouteState): FinancialStatementRouteState {
  return {
    cashFlowMappings: state.cashFlowMappings.map((mapping) => ({ ...mapping })),
    ledgerEntries: state.ledgerEntries.map((entry) => ({ ...entry })),
    periods: state.periods.map((period) => ({ ...period })),
    ...(state.statementLineInputs
      ? {
          statementLineInputs: Object.fromEntries(
            Object.entries(state.statementLineInputs).map(([period, inputs]) => [
              period,
              {
                ...(inputs.balanceSheetLines ? { balanceSheetLines: inputs.balanceSheetLines.map(cloneLine) } : {}),
                ...(inputs.profitStatementLines ? { profitStatementLines: inputs.profitStatementLines.map(cloneLine) } : {})
              }
            ])
          )
        }
      : {}),
    statementSnapshots: state.statementSnapshots.map((snapshot) => ({
      ...snapshot,
      balanceSheetLines: snapshot.balanceSheetLines.map(cloneLine),
      cashFlowLines: snapshot.cashFlowLines.map(cloneLine),
      generalLedgerLines: snapshot.generalLedgerLines.map(cloneGeneralLedgerLine),
      profitStatementLines: snapshot.profitStatementLines.map(cloneLine)
    }))
  };
}

function cloneLine(line: FinancialStatementLine): FinancialStatementLine {
  return {
    ...line,
    sourceSubjectCodes: [...line.sourceSubjectCodes],
    voucherNos: [...line.voucherNos]
  };
}

function cloneGeneralLedgerLine(line: FinancialStatementSnapshot['generalLedgerLines'][number]) {
  return {
    ...line,
    voucherNos: [...line.voucherNos]
  };
}

function withState(
  response: Omit<FinancialStatementRouteResponse, 'state'>,
  state: FinancialStatementRouteState
): FinancialStatementRouteResponse {
  return {
    ...response,
    state
  };
}

function createRouteError({
  code,
  message,
  period,
  requestId,
  status
}: {
  code: FinancialStatementRouteErrorCode;
  message: string;
  period?: string;
  requestId: string;
  status: number;
}): Omit<FinancialStatementRouteResponse, 'state'> {
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

function authorizeRoute({
  context,
  operation,
  period,
  requiredPermissionScope,
  state
}: {
  context: FinancialStatementServerContext;
  operation: string;
  period?: string;
  requiredPermissionScope: FinancePeriodClosePermissionScope;
  state: FinancialStatementRouteState;
}): FinancialStatementRouteResponse | undefined {
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

function parseFinancialStatementPath(path: string) {
  const match = path.match(/^\/api\/finance\/financial-statements\/(\d{4}-\d{2})\/(readiness|snapshots|snapshots\/latest)$/);

  if (!match) {
    return undefined;
  }

  return {
    action: match[2],
    period: match[1]
  };
}

function findPeriod(state: FinancialStatementRouteState, period: string) {
  return state.periods.find((item) => item.period === period);
}

function findLatestSnapshot(state: FinancialStatementRouteState, period: string) {
  return state.statementSnapshots
    .filter((snapshot) => snapshot.accountingPeriod === period)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];
}

function buildReadinessForPeriod(state: FinancialStatementRouteState, period: string) {
  const statementLineInputs = state.statementLineInputs?.[period];

  return buildFinancialStatementReadiness({
    accountingPeriod: period,
    balanceSheetLines: statementLineInputs?.balanceSheetLines,
    cashFlowMappings: state.cashFlowMappings,
    ledgerEntries: state.ledgerEntries,
    profitStatementLines: statementLineInputs?.profitStatementLines
  });
}

function isSnapshotRequestBody(value: unknown): value is SnapshotRequestBody {
  if (value === undefined) {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  const body = value as SnapshotRequestBody;

  return (
    (body.expectedCashFlowMappingVersionHash === undefined ||
      typeof body.expectedCashFlowMappingVersionHash === 'string') &&
    (body.expectedSourceLedgerHash === undefined || typeof body.expectedSourceLedgerHash === 'string')
  );
}

function handleReadReadiness({
  context,
  period,
  state
}: {
  context: FinancialStatementServerContext;
  period: string;
  state: FinancialStatementRouteState;
}): FinancialStatementRouteResponse {
  const authorizationFailure = authorizeRoute({
    context,
    operation: '查看财务报表准备状态',
    period,
    requiredPermissionScope: 'finance.financialStatement.read',
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

  const readiness = buildReadinessForPeriod(state, period);
  const existingSnapshot = findLatestSnapshot(state, period);

  return withState(
    {
      body: {
        ...readiness,
        canGenerateFormalSnapshot: periodRecord.status === '已结账' && readiness.canGenerateSnapshot,
        existingSnapshotHash: existingSnapshot?.snapshotHash,
        periodStatus: periodRecord.status,
        serverTime: context.now
      },
      status: 200
    },
    state
  );
}

function handleReadLatestSnapshot({
  context,
  period,
  state
}: {
  context: FinancialStatementServerContext;
  period: string;
  state: FinancialStatementRouteState;
}): FinancialStatementRouteResponse {
  const authorizationFailure = authorizeRoute({
    context,
    operation: '查看财务报表快照',
    period,
    requiredPermissionScope: 'finance.financialStatement.read',
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

  const latestSnapshot = findLatestSnapshot(state, period);

  if (!latestSnapshot) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '财务报表快照尚未生成。',
        period,
        requestId: context.requestId,
        status: 404
      }),
      state
    );
  }

  return withState(
    {
      body: {
        periodStatus: periodRecord.status,
        snapshot: latestSnapshot
      },
      status: 200
    },
    state
  );
}

function handleCreateSnapshot({
  context,
  period,
  request,
  state
}: {
  context: FinancialStatementServerContext;
  period: string;
  request: FinancialStatementRouteRequest;
  state: FinancialStatementRouteState;
}): FinancialStatementRouteResponse {
  const authorizationFailure = authorizeRoute({
    context,
    operation: '生成财务报表快照',
    period,
    requiredPermissionScope: 'finance.financialStatement.generate',
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

  if (!isSnapshotRequestBody(request.body)) {
    return withState(
      createRouteError({
        code: 'INVALID_REQUEST',
        message: '报表快照生成请求只能包含 expectedSourceLedgerHash 和 expectedCashFlowMappingVersionHash。',
        period,
        requestId: context.requestId,
        status: 400
      }),
      state
    );
  }

  const existingSnapshot = findLatestSnapshot(state, period);

  if (existingSnapshot) {
    return withState(
      {
        body: {
          replayed: true,
          snapshot: existingSnapshot
        },
        status: 200
      },
      state
    );
  }

  const readiness = buildReadinessForPeriod(state, period);
  const requestBody = request.body ?? {};

  if (
    requestBody.expectedSourceLedgerHash &&
    requestBody.expectedSourceLedgerHash !== readiness.sourceLedgerHash
  ) {
    return withState(
      createRouteError({
        code: 'FINANCIAL_STATEMENT_READINESS_STALE',
        message: '源总账快照已变化，请重新读取财务报表准备状态。',
        period,
        requestId: context.requestId,
        status: 409
      }),
      state
    );
  }

  if (
    requestBody.expectedCashFlowMappingVersionHash &&
    requestBody.expectedCashFlowMappingVersionHash !== readiness.cashFlowMappingVersionHash
  ) {
    return withState(
      createRouteError({
        code: 'FINANCIAL_STATEMENT_READINESS_STALE',
        message: '现金流量映射版本已变化，请重新读取财务报表准备状态。',
        period,
        requestId: context.requestId,
        status: 409
      }),
      state
    );
  }

  const snapshotResult = createFinancialStatementSnapshot({
    period: periodRecord,
    readiness,
    request: {
      generatedAt: context.now,
      generatedBySnapshot: context.actorSnapshot,
      requestId: context.requestId
    }
  });

  if (!snapshotResult.ok) {
    return withState(
      {
        body: snapshotResult.error,
        status: 422
      },
      state
    );
  }

  return withState(
    {
      body: {
        replayed: false,
        snapshot: snapshotResult.snapshot
      },
      status: 201
    },
    {
      ...state,
      statementSnapshots: [...state.statementSnapshots, snapshotResult.snapshot]
    }
  );
}

export function handleFinancialStatementRoute({
  context,
  request,
  state
}: {
  context: FinancialStatementServerContext;
  request: FinancialStatementRouteRequest;
  state: FinancialStatementRouteState;
}): FinancialStatementRouteResponse {
  const currentState = cloneState(state);
  const parsedPath = parseFinancialStatementPath(request.path);

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

  if (request.method === 'GET' && parsedPath.action === 'readiness') {
    return handleReadReadiness({ context, period: parsedPath.period, state: currentState });
  }

  if (request.method === 'GET' && parsedPath.action === 'snapshots/latest') {
    return handleReadLatestSnapshot({ context, period: parsedPath.period, state: currentState });
  }

  if (request.method === 'POST' && parsedPath.action === 'snapshots') {
    return handleCreateSnapshot({ context, period: parsedPath.period, request, state: currentState });
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
