import type { FinanceHttpApiRepositoryGatewayRequest } from './financeHttpApiRepositoryGatewayContract.js';
import { parseFinanceSourceMutationPayload } from './financeSourceMutationPayloadContract.js';
import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import {
  type PeriodCloseServiceTransactionBoundaryContract,
  type PeriodCloseServiceTransactionBoundaryResult
} from './periodCloseServiceTransactionBoundaryContract.js';
import { financeSourceMutationRouteDefinitions } from './periodCloseSourceMutationRoutes.js';

export type FinanceHttpServiceTransactionGatewayResponse = {
  body: unknown;
  headers: Record<string, string>;
  serviceTransaction?: {
    operation: PeriodCloseServiceTransactionBoundaryResult<
      PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
    >['operation'];
    requestId: string;
    status: PeriodCloseServiceTransactionBoundaryResult<
      PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
    >['status'];
    traceErrorCount: number;
    transactionId: string;
  };
  status: number;
};

export type FinanceHttpPeriodCloseWriteRequestContext = PeriodClosePersistenceContext & {
  permissionScopes: FinancePeriodClosePermissionScope[];
};

type RequestContext = FinanceHttpPeriodCloseWriteRequestContext;

type ParsedCloseBody =
  | {
      body: Omit<CloseAccountingPeriodRequest, 'actorSnapshot' | 'now' | 'requestId'>;
      ok: true;
    }
  | {
      message: string;
      ok: false;
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

export function createContext(request: FinanceHttpApiRepositoryGatewayRequest): RequestContext {
  const headers = normalizeHeaders(request.headers);

  return {
    actorSnapshot: {
      id: headers['x-actor-id'] || defaultActorSnapshot.id,
      name: headers['x-actor-name'] || defaultActorSnapshot.name
    },
    now: headers['x-request-time'] || '1970-01-01T00:00:00+00:00',
    permissionScopes: parsePermissionScopes(headers['x-permission-scopes']),
    requestId: headers['x-request-id'] || 'local-http-service-transaction-request'
  };
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseCloseBody(body: unknown): ParsedCloseBody {
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

function createResponse({
  body,
  serviceTransaction,
  status
}: {
  body: unknown;
  serviceTransaction?: PeriodCloseServiceTransactionBoundaryResult<
    PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
  >;
  status: number;
}): FinanceHttpServiceTransactionGatewayResponse {
  return {
    body,
    headers: jsonHeaders,
    ...(serviceTransaction
      ? {
          serviceTransaction: {
            operation: serviceTransaction.operation,
            requestId: serviceTransaction.requestId,
            status: serviceTransaction.status,
            traceErrorCount: serviceTransaction.traceErrors.length,
            transactionId: serviceTransaction.transactionId
          }
        }
      : {}),
    status
  };
}

function createErrorResponse({
  code,
  message,
  requestId,
  status
}: {
  code: string;
  message: string;
  requestId: string;
  status: number;
}) {
  return createResponse({
    body: {
      code,
      message,
      requestId
    },
    status
  });
}

export function statusFromErrorCode(code: string) {
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

export function getPeriodFromClosePath(path: string) {
  const match = /^\/api\/finance\/accounting-periods\/([^/]+)\/close$/.exec(path);

  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function matchSourceMutationRoute(request: FinanceHttpApiRepositoryGatewayRequest) {
  const method = request.method.toUpperCase();

  for (const definition of financeSourceMutationRouteDefinitions) {
    if (definition.method !== method) {
      continue;
    }

    const match = request.path.match(definition.pathPattern);

    if (match) {
      return {
        definition,
        sourceId: match[1] ? decodeURIComponent(match[1]) : undefined
      };
    }
  }

  return undefined;
}

function mapServiceFailure(
  result: PeriodCloseServiceTransactionBoundaryResult<
    PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
  >
) {
  if (result.error) {
    return createResponse({
      body: result.error,
      serviceTransaction: result,
      status: result.error.retryable ? 503 : 500
    });
  }

  if (!result.repositoryResult.driverOk) {
    return createResponse({
      body: {
        code: 'DB_TRANSACTION_FAILED',
        message: result.repositoryResult.error.message,
        requestId: result.requestId,
        retryable: true
      },
      serviceTransaction: result,
      status: 503
    });
  }

  if (!result.repositoryResult.result.ok) {
    return createResponse({
      body: result.repositoryResult.result.error,
      serviceTransaction: result,
      status: statusFromErrorCode(result.repositoryResult.result.error.code)
    });
  }

  return undefined;
}

function mapCloseResult(
  result: PeriodCloseServiceTransactionBoundaryResult<PersistentCloseAccountingPeriodResult>
) {
  const failure = mapServiceFailure(result);

  if (failure) {
    return failure;
  }

  if (!result.repositoryResult.driverOk || !result.repositoryResult.result.ok) {
    return createResponse({
      body: {
        code: 'DB_TRANSACTION_TRACE_INVALID',
        message: '服务事务结果不完整。',
        requestId: result.requestId
      },
      serviceTransaction: result,
      status: 500
    });
  }

  const value = result.repositoryResult.result.value;

  if (!value.ok) {
    return createResponse({
      body: value.error,
      serviceTransaction: result,
      status: statusFromErrorCode(value.error.code)
    });
  }

  return createResponse({
    body: {
      checkSnapshotHash: value.snapshot.checkSnapshotHash,
      closeCheckSnapshotId: value.snapshot.id,
      closeReason: value.period.closeReason,
      closedAt: value.period.closedAt,
      closedBySnapshot: value.period.closedBySnapshot,
      period: value.period.period,
      replayed: value.replayed,
      status: value.period.status,
      version: value.period.version
    },
    serviceTransaction: result,
    status: value.replayed ? 200 : 201
  });
}

function mapSourceMutationResult(
  result: PeriodCloseServiceTransactionBoundaryResult<PersistentSourceMutationResult>
) {
  const failure = mapServiceFailure(result);

  if (failure) {
    return failure;
  }

  if (!result.repositoryResult.driverOk || !result.repositoryResult.result.ok) {
    return createResponse({
      body: {
        code: 'DB_TRANSACTION_TRACE_INVALID',
        message: '服务事务结果不完整。',
        requestId: result.requestId
      },
      serviceTransaction: result,
      status: 500
    });
  }

  const value = result.repositoryResult.result.value;

  if (!value.ok) {
    return createResponse({
      body: value.error,
      serviceTransaction: result,
      status: statusFromErrorCode(value.error.code)
    });
  }

  return createResponse({
    body: {
      eventType: value.event.eventType,
      sourceArea: value.record.sourceArea,
      sourceId: value.record.id,
      sourceNo: value.record.sourceNo,
      status: value.record.status,
      version: value.record.version
    },
    serviceTransaction: result,
    status: value.record.version === 1 ? 201 : 200
  });
}

export function handleFinanceHttpServiceTransactionGateway({
  request,
  service
}: {
  request: FinanceHttpApiRepositoryGatewayRequest;
  service: PeriodCloseServiceTransactionBoundaryContract;
}): FinanceHttpServiceTransactionGatewayResponse {
  const method = request.method.toUpperCase();
  const context = createContext(request);

  if (method === 'POST') {
    const period = getPeriodFromClosePath(request.path);

    if (period) {
      const authorization = authorizeFinancePeriodCloseOperation({
        context,
        operation: '确认期间结账',
        period,
        requiredPermissionScope: 'finance.accountingPeriod.close'
      });

      if (!authorization.allowed) {
        return createResponse({
          body: authorization.error,
          status: 403
        });
      }

      const closeBody = parseCloseBody(request.body);

      if (!closeBody.ok) {
        return createErrorResponse({
          code: 'INVALID_REQUEST',
          message: closeBody.message,
          requestId: context.requestId,
          status: 400
        });
      }

      return mapCloseResult(
        service.closeAccountingPeriod({
          period,
          request: {
            ...closeBody.body,
            actorSnapshot: context.actorSnapshot,
            now: context.now,
            requestId: context.requestId
          }
        })
      );
    }
  }

  if (method === 'PATCH' || method === 'POST') {
    const matchedRoute = matchSourceMutationRoute(request);

    if (matchedRoute) {
      const mutationPayload = parseFinanceSourceMutationPayload(request.body);

      if (!mutationPayload.ok) {
        return createErrorResponse({
          code: 'INVALID_REQUEST',
          message: mutationPayload.message,
          requestId: context.requestId,
          status: 400
        });
      }

      const mutationBody = mutationPayload.body;
      const sourceId = matchedRoute.definition.sourceIdFromBody ? mutationBody.sourceId : matchedRoute.sourceId;

      if (!sourceId) {
        return createErrorResponse({
          code: 'INVALID_REQUEST',
          message: '缺少源单标识。',
          requestId: context.requestId,
          status: 400
        });
      }

      const authorization = authorizeFinancePeriodCloseOperation({
        context,
        operation: matchedRoute.definition.operation,
        requiredPermissionScope: matchedRoute.definition.permissionScope,
        sourceId,
        sourceModule: matchedRoute.definition.sourceArea
      });

      if (!authorization.allowed) {
        return createResponse({
          body: authorization.error,
          status: 403
        });
      }

      return mapSourceMutationResult(
        service.guardSourceMutation({
          context,
          mutation: {
            amount: mutationBody.amount,
            createsSourceRecord: matchedRoute.definition.createsSourceRecord,
            expectedVersion: mutationBody.expectedVersion,
            operation: matchedRoute.definition.operation,
            sourceArea: matchedRoute.definition.sourceArea,
            sourceId,
            sourceNo: mutationBody.sourceNo,
            status: mutationBody.status ?? matchedRoute.definition.successStatus,
            targetAccountingPeriod: mutationBody.targetAccountingPeriod
          }
        })
      );
    }
  }

  return createErrorResponse({
    code: 'NOT_FOUND',
    message: '接口不存在或尚未接入服务事务边界。',
    requestId: context.requestId,
    status: 404
  });
}
