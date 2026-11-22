import {
  buildFinancialStatementReadiness,
  createFinancialStatementSnapshot,
  type CashFlowMappingRecord,
  type FinancialStatementLedgerEntry,
  type FinancialStatementLine
} from './financialStatementContract.js';
import { parseFinanceSourceMutationPayload } from './financeSourceMutationPayloadContract.js';
import {
  buildCloseChecksResponse,
  type CloseAccountingPeriodRequest
} from './periodCloseContract.js';
import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import type {
  PeriodCloseDatabaseRepository,
  PeriodCloseDatabaseRepositorySnapshot
} from './periodCloseDatabaseRepositoryContract.js';
import {
  buildEffectiveVoucherCloseChecks,
  type PeriodClosePersistenceContext
} from './periodClosePersistenceContract.js';
import { closeAccountingPeriodWithRepositoryTransaction } from './periodCloseRepositoryContract.js';
import { applyFinanceSourceMutationRepositoryApi } from './periodCloseSourceMutationRepositoryApiContract.js';
import { financeSourceMutationRouteDefinitions } from './periodCloseSourceMutationRoutes.js';
import {
  createAccountingVoucherLaterPeriodAdjustment,
  type AccountingVoucherAdjustmentErrorCode
} from './accountingVoucherLaterPeriodAdjustmentContract.js';

export type FinanceHttpApiRepositoryGatewayRequest = {
  body?: unknown;
  headers?: Record<string, string | undefined>;
  method: string;
  path: string;
};

export type FinanceHttpApiRepositoryGatewayFinancialStatementInputs = {
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

export type FinanceHttpApiRepositoryGatewayResponse = {
  body: unknown;
  databaseSnapshot: PeriodCloseDatabaseRepositorySnapshot;
  headers: Record<string, string>;
  status: number;
};

type RequestContext = PeriodClosePersistenceContext & {
  permissionScopes: FinancePeriodClosePermissionScope[];
};

type ParsedCloseBody =
  | {
      body: Omit<CloseAccountingPeriodRequest, 'actorSnapshot' | 'now' | 'requestId'>;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

type FinancialStatementSnapshotBody = {
  expectedCashFlowMappingVersionHash?: string;
  expectedSourceLedgerHash?: string;
};

type LaterPeriodAdjustmentBody = {
  adjustmentDate: string;
  adjustmentPeriod: string;
  idempotencyKey: string;
  reason: string;
  version: number;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

const defaultActorSnapshot = {
  id: 'system-local-api',
  name: '本地 API'
};

function normalizeHeaders(headers: Record<string, string | undefined> = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function parsePermissionScopes(value: string | undefined): FinancePeriodClosePermissionScope[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean) as FinancePeriodClosePermissionScope[];
}

function createContext(request: FinanceHttpApiRepositoryGatewayRequest): RequestContext {
  const headers = normalizeHeaders(request.headers);

  return {
    actorSnapshot: {
      id: headers['x-actor-id'] || defaultActorSnapshot.id,
      name: headers['x-actor-name'] || defaultActorSnapshot.name
    },
    now: headers['x-request-time'] || '1970-01-01T00:00:00+00:00',
    permissionScopes: parsePermissionScopes(headers['x-permission-scopes']),
    requestId: headers['x-request-id'] || 'local-http-request'
  };
}

function createResponse({
  body,
  repository,
  status
}: {
  body: unknown;
  repository: PeriodCloseDatabaseRepository;
  status: number;
}): FinanceHttpApiRepositoryGatewayResponse {
  return {
    body,
    databaseSnapshot: repository.readDatabaseSnapshot(),
    headers: jsonHeaders,
    status
  };
}

function createErrorResponse({
  code,
  message,
  period,
  repository,
  requestId,
  sourceId,
  sourceModule,
  status
}: {
  code: string;
  message: string;
  period?: string;
  repository: PeriodCloseDatabaseRepository;
  requestId: string;
  sourceId?: string;
  sourceModule?: string;
  status: number;
}) {
  return createResponse({
    body: {
      code,
      message,
      period,
      requestId,
      sourceId,
      sourceModule
    },
    repository,
    status
  });
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseCloseBody(body: unknown): ParsedCloseBody {
  const objectBody = toObject(body);
  const idempotencyKey = objectBody.idempotencyKey;
  const reason = objectBody.reason;
  const version = objectBody.version;
  const expectedCheckSnapshotHash = objectBody.expectedCheckSnapshotHash;

  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    return { message: '缺少幂等键。', ok: false };
  }

  if (typeof reason !== 'string') {
    return { message: '缺少结账说明。', ok: false };
  }

  if (typeof version !== 'number') {
    return { message: '缺少会计期间版本。', ok: false };
  }

  if (expectedCheckSnapshotHash !== undefined && typeof expectedCheckSnapshotHash !== 'string') {
    return { message: '结账检查快照标识格式不正确。', ok: false };
  }

  return {
    body: {
      expectedCheckSnapshotHash,
      idempotencyKey,
      reason,
      version
    },
    ok: true
  };
}

function parseFinancialStatementSnapshotBody(body: unknown): FinancialStatementSnapshotBody | undefined {
  if (body === undefined) {
    return {};
  }

  const objectBody = toObject(body);
  const expectedCashFlowMappingVersionHash = objectBody.expectedCashFlowMappingVersionHash;
  const expectedSourceLedgerHash = objectBody.expectedSourceLedgerHash;

  if (
    (expectedCashFlowMappingVersionHash !== undefined && typeof expectedCashFlowMappingVersionHash !== 'string') ||
    (expectedSourceLedgerHash !== undefined && typeof expectedSourceLedgerHash !== 'string')
  ) {
    return undefined;
  }

  return {
    expectedCashFlowMappingVersionHash,
    expectedSourceLedgerHash
  };
}

function parseLaterPeriodAdjustmentBody(body: unknown): LaterPeriodAdjustmentBody | undefined {
  const objectBody = toObject(body);
  const adjustmentDate = objectBody.adjustmentDate;
  const adjustmentPeriod = objectBody.adjustmentPeriod;
  const idempotencyKey = objectBody.idempotencyKey;
  const reason = objectBody.reason;
  const version = objectBody.version;

  if (
    typeof adjustmentDate !== 'string' ||
    typeof adjustmentPeriod !== 'string' ||
    typeof idempotencyKey !== 'string' ||
    typeof reason !== 'string' ||
    typeof version !== 'number'
  ) {
    return undefined;
  }

  return {
    adjustmentDate,
    adjustmentPeriod,
    idempotencyKey,
    reason,
    version
  };
}

function statusFromErrorCode(code: string) {
  if (code === 'FORBIDDEN') {
    return 403;
  }

  if (code === 'PERIOD_NOT_FOUND' || code === 'SOURCE_NOT_FOUND' || code === 'CLOSE_CHECK_NOT_FOUND') {
    return 404;
  }

  if (code === 'INVALID_REQUEST' || code === 'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED') {
    return 400;
  }

  return 409;
}

function getPeriodFromClosePath(path: string, action: 'close' | 'close-checks') {
  const suffix = action === 'close' ? 'close' : 'close-checks';
  const match = new RegExp(`^/api/finance/accounting-periods/([^/]+)/${suffix}$`).exec(path);

  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function getPeriodFromFinancialStatementSnapshotPath(path: string) {
  const match = /^\/api\/finance\/financial-statements\/([^/]+)\/snapshots$/.exec(path);

  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function getVoucherIdFromLaterPeriodAdjustmentPath(path: string) {
  const match = /^\/api\/finance\/accounting-vouchers\/([^/]+)\/later-period-adjustments$/.exec(path);

  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function statusFromLaterPeriodAdjustmentError(code: AccountingVoucherAdjustmentErrorCode) {
  if (code === 'VOUCHER_NOT_FOUND') {
    return 404;
  }

  if (code === 'INVALID_ADJUSTMENT_REQUEST') {
    return 400;
  }

  if (
    code === 'ADJUSTMENT_ALREADY_EXISTS' ||
    code === 'IDEMPOTENCY_KEY_REUSED' ||
    code === 'VERSION_CONFLICT' ||
    code === 'CLOSED_ACCOUNTING_PERIOD'
  ) {
    return 409;
  }

  return 422;
}

function handleCloseChecks({
  context,
  period,
  repository
}: {
  context: RequestContext;
  period: string;
  repository: PeriodCloseDatabaseRepository;
}) {
  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '读取结账检查',
    period,
    requiredPermissionScope: 'finance.accountingPeriod.read'
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  const state = repository.readState();
  const periodRecord = state.periods.find((item) => item.period === period);
  const input = state.checkInputs[period];

  if (!periodRecord || !input) {
    return createErrorResponse({
      code: periodRecord ? 'CLOSE_CHECK_NOT_FOUND' : 'PERIOD_NOT_FOUND',
      message: periodRecord ? '结账检查尚未生成。' : '会计期间不存在。',
      period,
      repository,
      requestId: context.requestId,
      status: 404
    });
  }

  const body = buildCloseChecksResponse({
    checks: buildEffectiveVoucherCloseChecks({
      checks: input.checks,
      period: periodRecord,
      voucherRows: state.voucherRows ?? []
    }),
    computedAt: input.computedAt,
    period: periodRecord,
    sourceVersionSetHash: input.sourceVersionSetHash,
    trialBalance: input.trialBalance
  });

  return createResponse({
    body,
    repository,
    status: 200
  });
}

function handleClose({
  context,
  period,
  repository,
  request
}: {
  context: RequestContext;
  period: string;
  repository: PeriodCloseDatabaseRepository;
  request: FinanceHttpApiRepositoryGatewayRequest;
}) {
  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '确认期间结账',
    period,
    requiredPermissionScope: 'finance.accountingPeriod.close'
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  const closeBody = parseCloseBody(request.body);

  if (!closeBody.ok) {
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: closeBody.message,
      period,
      repository,
      requestId: context.requestId,
      status: 400
    });
  }

  const result = closeAccountingPeriodWithRepositoryTransaction({
    period,
    repository,
    request: {
      ...closeBody.body,
      actorSnapshot: context.actorSnapshot,
      now: context.now,
      requestId: context.requestId
    }
  });

  if (!result.ok) {
    return createResponse({
      body: result.error,
      repository,
      status: statusFromErrorCode(result.error.code)
    });
  }

  return createResponse({
    body: {
      checkSnapshotHash: result.snapshot.checkSnapshotHash,
      closeCheckSnapshotId: result.snapshot.id,
      closeReason: result.period.closeReason,
      closedAt: result.period.closedAt,
      closedBySnapshot: result.period.closedBySnapshot,
      period: result.period.period,
      replayed: result.replayed,
      status: result.period.status,
      version: result.period.version
    },
    repository,
    status: result.replayed ? 200 : 201
  });
}

function handleCreateFinancialStatementSnapshot({
  context,
  financialStatements,
  period,
  repository,
  request
}: {
  context: RequestContext;
  financialStatements?: FinanceHttpApiRepositoryGatewayFinancialStatementInputs;
  period: string;
  repository: PeriodCloseDatabaseRepository;
  request: FinanceHttpApiRepositoryGatewayRequest;
}) {
  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '生成财务报表快照',
    period,
    requiredPermissionScope: 'finance.financialStatement.generate'
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  if (!financialStatements) {
    return createErrorResponse({
      code: 'FINANCIAL_STATEMENT_INPUTS_MISSING',
      message: '缺少财务报表快照生成所需的总账分录和现金流量映射。',
      period,
      repository,
      requestId: context.requestId,
      status: 400
    });
  }

  const snapshotBody = parseFinancialStatementSnapshotBody(request.body);

  if (!snapshotBody) {
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: '报表快照生成请求只能包含 expectedSourceLedgerHash 和 expectedCashFlowMappingVersionHash。',
      period,
      repository,
      requestId: context.requestId,
      status: 400
    });
  }

  const state = repository.readState();
  const periodRecord = state.periods.find((item) => item.period === period);

  if (!periodRecord) {
    return createErrorResponse({
      code: 'PERIOD_NOT_FOUND',
      message: '会计期间不存在。',
      period,
      repository,
      requestId: context.requestId,
      status: 404
    });
  }

  const existingSnapshot = repository
    .readFinancialStatementSnapshots()
    .filter((snapshot) => snapshot.accountingPeriod === period)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];

  if (existingSnapshot) {
    return createResponse({
      body: {
        replayed: true,
        snapshot: existingSnapshot
      },
      repository,
      status: 200
    });
  }

  const statementLineInputs = financialStatements.statementLineInputs?.[period];
  const readiness = buildFinancialStatementReadiness({
    accountingPeriod: period,
    balanceSheetLines: statementLineInputs?.balanceSheetLines,
    cashFlowMappings: financialStatements.cashFlowMappings,
    ledgerEntries: financialStatements.ledgerEntries,
    profitStatementLines: statementLineInputs?.profitStatementLines
  });

  if (snapshotBody.expectedSourceLedgerHash && snapshotBody.expectedSourceLedgerHash !== readiness.sourceLedgerHash) {
    return createErrorResponse({
      code: 'FINANCIAL_STATEMENT_READINESS_STALE',
      message: '源总账快照已变化，请重新读取财务报表准备状态。',
      period,
      repository,
      requestId: context.requestId,
      status: 409
    });
  }

  if (
    snapshotBody.expectedCashFlowMappingVersionHash &&
    snapshotBody.expectedCashFlowMappingVersionHash !== readiness.cashFlowMappingVersionHash
  ) {
    return createErrorResponse({
      code: 'FINANCIAL_STATEMENT_READINESS_STALE',
      message: '现金流量映射版本已变化，请重新读取财务报表准备状态。',
      period,
      repository,
      requestId: context.requestId,
      status: 409
    });
  }

  const result = createFinancialStatementSnapshot({
    period: periodRecord,
    readiness,
    request: {
      generatedAt: context.now,
      generatedBySnapshot: context.actorSnapshot,
      requestId: context.requestId
    }
  });

  if (!result.ok) {
    return createResponse({
      body: result.error,
      repository,
      status: 422
    });
  }

  repository.commitFinancialStatementSnapshot(result.snapshot);

  return createResponse({
    body: {
      replayed: false,
      snapshot: result.snapshot
    },
    repository,
    status: 201
  });
}

function handleCreateLaterPeriodAdjustment({
  context,
  repository,
  request,
  voucherId
}: {
  context: RequestContext;
  repository: PeriodCloseDatabaseRepository;
  request: FinanceHttpApiRepositoryGatewayRequest;
  voucherId: string;
}) {
  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '生成后续期间调整',
    requiredPermissionScope: 'finance.accountingVoucher.reverse',
    sourceId: voucherId,
    sourceModule: 'accounting_voucher'
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  const body = parseLaterPeriodAdjustmentBody(request.body);

  if (!body) {
    return createErrorResponse({
      code: 'INVALID_ADJUSTMENT_REQUEST',
      message: '请求体必须包含调整期间、调整日期、调整原因、版本和幂等键。',
      repository,
      requestId: context.requestId,
      sourceId: voucherId,
      sourceModule: 'accounting_voucher',
      status: 400
    });
  }

  const snapshot = repository.readDatabaseSnapshot();
  const result = createAccountingVoucherLaterPeriodAdjustment({
    adjustmentFacts: snapshot.laterPeriodAdjustmentFacts ?? [],
    idempotencyRecords: snapshot.laterPeriodAdjustmentIdempotencyRecords ?? [],
    originalVoucher: snapshot.accountingVouchers?.find((voucher) => voucher.id === voucherId),
    periods: repository.readState().periods,
    request: {
      ...body,
      actorSnapshot: context.actorSnapshot,
      now: context.now,
      requestId: context.requestId
    }
  });

  if (!result.ok) {
    return createResponse({
      body: result.error,
      repository,
      status: statusFromLaterPeriodAdjustmentError(result.error.code)
    });
  }

  repository.commitAccountingVoucherLaterPeriodAdjustment(result);

  return createResponse({
    body: {
      adjustmentFact: result.adjustmentFact,
      candidate: result.candidate,
      replayed: result.replayed
    },
    repository,
    status: result.replayed ? 200 : 201
  });
}

function matchSourceMutationRoute(request: FinanceHttpApiRepositoryGatewayRequest) {
  const method = request.method.toUpperCase();

  for (const definition of financeSourceMutationRouteDefinitions) {
    const match = definition.pathPattern.exec(request.path);

    if (definition.method === method && match) {
      return { definition, match };
    }
  }

  return undefined;
}

function handleSourceMutation({
  context,
  repository,
  request
}: {
  context: RequestContext;
  repository: PeriodCloseDatabaseRepository;
  request: FinanceHttpApiRepositoryGatewayRequest;
}) {
  const matchedRoute = matchSourceMutationRoute(request);

  if (!matchedRoute) {
    return undefined;
  }

  const { definition, match } = matchedRoute;
  const mutationPayload = parseFinanceSourceMutationPayload(request.body);

  if (!mutationPayload.ok) {
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: mutationPayload.message,
      repository,
      requestId: context.requestId,
      status: 400
    });
  }

  const mutationBody = mutationPayload.body;
  const sourceId = definition.sourceIdFromBody ? mutationBody.sourceId : match[1];

  if (!sourceId) {
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: '缺少源单标识。',
      repository,
      requestId: context.requestId,
      status: 400
    });
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: definition.operation,
    requiredPermissionScope: definition.permissionScope,
    sourceId,
    sourceModule: definition.sourceArea
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  const result = applyFinanceSourceMutationRepositoryApi({
    context,
    operation: definition,
    repository,
    request: {
      amount: mutationBody.amount,
      sourceId,
      sourceNo: mutationBody.sourceNo,
      status: mutationBody.status ?? definition.successStatus,
      expectedVersion: mutationBody.expectedVersion,
      targetAccountingPeriod: mutationBody.targetAccountingPeriod
    }
  });

  if (!result.ok) {
    return createResponse({
      body: result.error,
      repository,
      status: statusFromErrorCode(result.error.code)
    });
  }

  return createResponse({
    body: {
      eventType: result.event.eventType,
      sourceArea: result.record.sourceArea,
      sourceId: result.record.id,
      sourceNo: result.record.sourceNo,
      status: result.record.status,
      version: result.record.version
      },
      repository,
      status: definition.createsSourceRecord ? 201 : 200
    });
}

export function handleFinanceHttpApiRepositoryGateway({
  financialStatements,
  repository,
  request
}: {
  financialStatements?: FinanceHttpApiRepositoryGatewayFinancialStatementInputs;
  repository: PeriodCloseDatabaseRepository;
  request: FinanceHttpApiRepositoryGatewayRequest;
}): FinanceHttpApiRepositoryGatewayResponse {
  const method = request.method.toUpperCase();
  const context = createContext(request);

  if (method === 'GET') {
    const period = getPeriodFromClosePath(request.path, 'close-checks');

    if (period) {
      return handleCloseChecks({ context, period, repository });
    }
  }

  if (method === 'POST') {
    const period = getPeriodFromClosePath(request.path, 'close');

    if (period) {
      return handleClose({ context, period, repository, request });
    }

    const financialStatementPeriod = getPeriodFromFinancialStatementSnapshotPath(request.path);

    if (financialStatementPeriod) {
      return handleCreateFinancialStatementSnapshot({
        context,
        financialStatements,
        period: financialStatementPeriod,
        repository,
        request
      });
    }

    const laterPeriodAdjustmentVoucherId = getVoucherIdFromLaterPeriodAdjustmentPath(request.path);

    if (laterPeriodAdjustmentVoucherId) {
      return handleCreateLaterPeriodAdjustment({
        context,
        repository,
        request,
        voucherId: laterPeriodAdjustmentVoucherId
      });
    }
  }

  if (method === 'PATCH' || method === 'POST') {
    const sourceMutationResponse = handleSourceMutation({ context, repository, request });

    if (sourceMutationResponse) {
      return sourceMutationResponse;
    }
  }

  return createErrorResponse({
    code: 'NOT_FOUND',
    message: '接口不存在。',
    repository,
    requestId: context.requestId,
    status: 404
  });
}
