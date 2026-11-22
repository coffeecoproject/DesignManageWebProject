import type { FinanceHttpApiRepositoryGatewayRequest } from './financeHttpApiRepositoryGatewayContract.js';
import { parseFinanceSourceMutationPayload } from './financeSourceMutationPayloadContract.js';
import { authorizeFinancePeriodCloseOperation } from './periodCloseAuthorizationContract.js';
import type {
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import type {
  PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  PeriodClosePostgresManagedServicePoolRuntimeContract,
  PeriodClosePostgresManagedServicePoolRuntimeResult
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import {
  createContext,
  getPeriodFromClosePath,
  matchSourceMutationRoute,
  parseCloseBody,
  statusFromErrorCode
} from './financeHttpServiceTransactionGatewayContract.js';

type ManagedRuntimeResult =
  | PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentCloseAccountingPeriodResult>
  | PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>;

export type FinanceHttpPostgresManagedRuntimeGatewayResponse = {
  body: unknown;
  headers: Record<string, string>;
  managedRuntime?: {
    adapterEventCount: number;
    operation: ManagedRuntimeResult['operation'];
    poolLifecycleState: ManagedRuntimeResult['poolLifecycleState'];
    requestId: string;
    runtimeEventNames: ManagedRuntimeResult['events'][number]['event'][];
    status: ManagedRuntimeResult['status'];
    traceErrorCount: number;
    transactionId: string;
  };
  status: number;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

function createResponse({
  body,
  managedRuntime,
  status
}: {
  body: unknown;
  managedRuntime?: ManagedRuntimeResult;
  status: number;
}): FinanceHttpPostgresManagedRuntimeGatewayResponse {
  return {
    body,
    headers: jsonHeaders,
    ...(managedRuntime
      ? {
          managedRuntime: {
            adapterEventCount: managedRuntime.adapterEvents.length,
            operation: managedRuntime.operation,
            poolLifecycleState: managedRuntime.poolLifecycleState,
            requestId: managedRuntime.requestId,
            runtimeEventNames: managedRuntime.events.map((event) => event.event),
            status: managedRuntime.status,
            traceErrorCount: managedRuntime.traceErrors.length,
            transactionId: managedRuntime.transactionId
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

function statusFromRuntimeStatus(status: ManagedRuntimeResult['status']) {
  if (status === 'trace_invalid') {
    return 500;
  }

  return 503;
}

function mapRuntimeFailure(result: ManagedRuntimeResult) {
  if (!result.serviceResult) {
    return createResponse({
      body: {
        code: 'POSTGRES_RUNTIME_UNAVAILABLE',
        message: 'PostgreSQL managed runtime 未就绪，写入请求没有进入服务事务。',
        requestId: result.requestId,
        runtimeStatus: result.status
      },
      managedRuntime: result,
      status: statusFromRuntimeStatus(result.status)
    });
  }

  if (result.serviceResult.error) {
    return createResponse({
      body: result.serviceResult.error,
      managedRuntime: result,
      status: result.serviceResult.error.retryable ? 503 : 500
    });
  }

  const repositoryResult = result.serviceResult.atomicResult.repositoryResult;

  if (!repositoryResult.driverOk) {
    return createResponse({
      body: {
        code: 'DB_TRANSACTION_FAILED',
        message: repositoryResult.error.message,
        requestId: result.requestId,
        retryable: true
      },
      managedRuntime: result,
      status: 503
    });
  }

  if (!repositoryResult.result.ok) {
    return createResponse({
      body: repositoryResult.result.error,
      managedRuntime: result,
      status: statusFromErrorCode(repositoryResult.result.error.code)
    });
  }

  return undefined;
}

function mapCloseResult(
  result: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentCloseAccountingPeriodResult>
) {
  const failure = mapRuntimeFailure(result);

  if (failure) {
    return failure;
  }

  const repositoryResult = result.serviceResult?.atomicResult.repositoryResult;

  if (!repositoryResult?.driverOk || !repositoryResult.result.ok) {
    return createResponse({
      body: {
        code: 'MANAGED_RUNTIME_TRACE_INVALID',
        message: 'managed runtime 结账结果不完整。',
        requestId: result.requestId
      },
      managedRuntime: result,
      status: 500
    });
  }

  const value = repositoryResult.result.value;

  if (!value.ok) {
    return createResponse({
      body: value.error,
      managedRuntime: result,
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
    managedRuntime: result,
    status: value.replayed ? 200 : 201
  });
}

function mapSourceMutationResult(
  result: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>
) {
  const failure = mapRuntimeFailure(result);

  if (failure) {
    return failure;
  }

  const repositoryResult = result.serviceResult?.atomicResult.repositoryResult;

  if (!repositoryResult?.driverOk || !repositoryResult.result.ok) {
    return createResponse({
      body: {
        code: 'MANAGED_RUNTIME_TRACE_INVALID',
        message: 'managed runtime 源单守卫结果不完整。',
        requestId: result.requestId
      },
      managedRuntime: result,
      status: 500
    });
  }

  const value = repositoryResult.result.value;

  if (!value.ok) {
    return createResponse({
      body: value.error,
      managedRuntime: result,
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
    managedRuntime: result,
    status: value.record.version === 1 ? 201 : 200
  });
}

export async function handleFinanceHttpPostgresManagedRuntimeGateway({
  admission,
  request,
  runtime
}: {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  request: FinanceHttpApiRepositoryGatewayRequest;
  runtime: PeriodClosePostgresManagedServicePoolRuntimeContract;
}): Promise<FinanceHttpPostgresManagedRuntimeGatewayResponse> {
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

      const result = await runtime.closeAccountingPeriod({
        admission,
        period,
        request: {
          ...closeBody.body,
          actorSnapshot: context.actorSnapshot,
          now: context.now,
          requestId: context.requestId
        }
      });

      return mapCloseResult(result);
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

      const result = await runtime.guardSourceMutation({
        admission,
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
      });

      return mapSourceMutationResult(result);
    }
  }

  return createErrorResponse({
    code: 'NOT_FOUND',
    message: '接口不存在或尚未接入 PostgreSQL managed runtime。',
    requestId: context.requestId,
    status: 404
  });
}
