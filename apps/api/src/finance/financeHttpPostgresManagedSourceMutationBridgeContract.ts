import type { FinanceHttpApiRepositoryGatewayRequest } from './financeHttpApiRepositoryGatewayContract.js';
import { parseFinanceSourceMutationPayload } from './financeSourceMutationPayloadContract.js';
import {
  createContext,
  matchSourceMutationRoute,
  statusFromErrorCode
} from './financeHttpServiceTransactionGatewayContract.js';
import { authorizeFinancePeriodCloseOperation } from './periodCloseAuthorizationContract.js';
import type {
  PersistentFinanceSourceRecord,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import type {
  PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  PeriodClosePostgresManagedServicePoolRuntimeContract,
  PeriodClosePostgresManagedServicePoolRuntimeResult
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import { getDefaultFinanceSourceTableName } from './periodCloseSourceTableRepositoryContract.js';
import type {
  FinanceSourceTableSqlRepositoryContract,
  FinanceSourceTableSqlRow
} from './periodCloseSourceTableSqlRepositoryContract.js';

export type FinanceHttpPostgresManagedSourceMutationBridgeEventName =
  | 'receive_http_source_request'
  | 'match_source_route'
  | 'validate_source_payload'
  | 'authorize_source_mutation'
  | 'delegate_managed_runtime'
  | 'writeback_source_sql_rows'
  | 'return_source_response';

export type FinanceHttpPostgresManagedSourceMutationBridgeEvent = {
  event: FinanceHttpPostgresManagedSourceMutationBridgeEventName;
  requestId: string;
  sequence: number;
};

export type FinanceHttpPostgresManagedSourceMutationBridgeResponse = {
  body: unknown;
  managedRuntime?: {
    operation: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>['operation'];
    poolLifecycleState: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>['poolLifecycleState'];
    requestId: string;
    status: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>['status'];
    traceErrorCount: number;
    transactionId: string;
  };
  sourceSqlRows: FinanceSourceTableSqlRow[];
  status: number;
  trace: FinanceHttpPostgresManagedSourceMutationBridgeEvent[];
};

function record({
  event,
  events,
  requestId
}: {
  event: FinanceHttpPostgresManagedSourceMutationBridgeEventName;
  events: FinanceHttpPostgresManagedSourceMutationBridgeEvent[];
  requestId: string;
}) {
  events.push({
    event,
    requestId,
    sequence: events.length + 1
  });
}

function createResponse({
  body,
  managedRuntime,
  sourceSqlRepository,
  status,
  trace
}: {
  body: unknown;
  managedRuntime?: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  status: number;
  trace: FinanceHttpPostgresManagedSourceMutationBridgeEvent[];
}): FinanceHttpPostgresManagedSourceMutationBridgeResponse {
  return {
    body,
    ...(managedRuntime
      ? {
          managedRuntime: {
            operation: managedRuntime.operation,
            poolLifecycleState: managedRuntime.poolLifecycleState,
            requestId: managedRuntime.requestId,
            status: managedRuntime.status,
            traceErrorCount: managedRuntime.traceErrors.length,
            transactionId: managedRuntime.transactionId
          }
        }
      : {}),
    sourceSqlRows: sourceSqlRepository.readSqlRows(),
    status,
    trace: trace.map((event) => ({ ...event }))
  };
}

function createErrorResponse({
  code,
  message,
  requestId,
  sourceSqlRepository,
  status,
  trace
}: {
  code: string;
  message: string;
  requestId: string;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  status: number;
  trace: FinanceHttpPostgresManagedSourceMutationBridgeEvent[];
}) {
  return createResponse({
    body: {
      code,
      message,
      requestId
    },
    sourceSqlRepository,
    status,
    trace
  });
}

function statusFromRuntimeStatus(
  status: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>['status']
) {
  return status === 'trace_invalid' ? 500 : 503;
}

function buildSourceTableRowsForWriteback({
  records,
  sourceSqlRepository
}: {
  records: PersistentFinanceSourceRecord[];
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
}) {
  const previousRows = sourceSqlRepository.readRows();
  const previousByKey = new Map(previousRows.map((row) => [`${row.sourceArea}:${row.id}`, row]));

  return records.map((record) => {
    const previous = previousByKey.get(`${record.sourceArea}:${record.id}`);

    return {
      ...record,
      tableName: previous?.tableName ?? getDefaultFinanceSourceTableName(record.sourceArea),
      updatedAt: previous?.updatedAt
    };
  });
}

function mapManagedRuntimeFailure({
  result,
  sourceSqlRepository,
  trace
}: {
  result: PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  trace: FinanceHttpPostgresManagedSourceMutationBridgeEvent[];
}) {
  if (!result.serviceResult) {
    return createResponse({
      body: {
        code: 'POSTGRES_RUNTIME_UNAVAILABLE',
        message: 'PostgreSQL managed runtime 未就绪，源单写入没有进入服务事务。',
        requestId: result.requestId,
        runtimeStatus: result.status
      },
      managedRuntime: result,
      sourceSqlRepository,
      status: statusFromRuntimeStatus(result.status),
      trace
    });
  }

  if (result.serviceResult.error) {
    return createResponse({
      body: result.serviceResult.error,
      managedRuntime: result,
      sourceSqlRepository,
      status: result.serviceResult.error.retryable ? 503 : 500,
      trace
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
      sourceSqlRepository,
      status: 503,
      trace
    });
  }

  if (!repositoryResult.result.ok) {
    return createResponse({
      body: repositoryResult.result.error,
      managedRuntime: result,
      sourceSqlRepository,
      status: statusFromErrorCode(repositoryResult.result.error.code),
      trace
    });
  }

  return undefined;
}

export async function handleFinanceHttpPostgresManagedSourceMutationBridge({
  admission,
  request,
  runtime,
  sourceSqlRepository
}: {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  request: FinanceHttpApiRepositoryGatewayRequest;
  runtime: PeriodClosePostgresManagedServicePoolRuntimeContract;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
}): Promise<FinanceHttpPostgresManagedSourceMutationBridgeResponse> {
  const context = createContext(request);
  const trace: FinanceHttpPostgresManagedSourceMutationBridgeEvent[] = [];

  record({ event: 'receive_http_source_request', events: trace, requestId: context.requestId });

  const matchedRoute = matchSourceMutationRoute(request);

  record({ event: 'match_source_route', events: trace, requestId: context.requestId });

  if (!matchedRoute || (request.method.toUpperCase() !== 'PATCH' && request.method.toUpperCase() !== 'POST')) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });

    return createErrorResponse({
      code: 'NOT_FOUND',
      message: '源单写入接口不存在或尚未接入 PostgreSQL managed runtime。',
      requestId: context.requestId,
      sourceSqlRepository,
      status: 404,
      trace
    });
  }

  const mutationPayload = parseFinanceSourceMutationPayload(request.body);

  record({ event: 'validate_source_payload', events: trace, requestId: context.requestId });

  if (!mutationPayload.ok) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });

    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: mutationPayload.message,
      requestId: context.requestId,
      sourceSqlRepository,
      status: 400,
      trace
    });
  }

  const mutationBody = mutationPayload.body;
  const sourceId = matchedRoute.definition.sourceIdFromBody ? mutationBody.sourceId?.trim() : matchedRoute.sourceId;

  if (!sourceId) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });

    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: '缺少源单标识。',
      requestId: context.requestId,
      sourceSqlRepository,
      status: 400,
      trace
    });
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: matchedRoute.definition.operation,
    requiredPermissionScope: matchedRoute.definition.permissionScope,
    sourceId,
    sourceModule: matchedRoute.definition.sourceArea
  });

  record({ event: 'authorize_source_mutation', events: trace, requestId: context.requestId });

  if (!authorization.allowed) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });

    return createResponse({
      body: authorization.error,
      sourceSqlRepository,
      status: 403,
      trace
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

  record({ event: 'delegate_managed_runtime', events: trace, requestId: context.requestId });

  const failure = mapManagedRuntimeFailure({
    result,
    sourceSqlRepository,
    trace
  });

  if (failure) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });

    return {
      ...failure,
      trace: trace.map((event) => ({ ...event }))
    };
  }

  const repositoryResult = result.serviceResult?.atomicResult.repositoryResult;

  if (!repositoryResult?.driverOk || !repositoryResult.result.ok) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });

    return createErrorResponse({
      code: 'MANAGED_RUNTIME_TRACE_INVALID',
      message: 'managed runtime 源单守卫结果不完整。',
      requestId: context.requestId,
      sourceSqlRepository,
      status: 500,
      trace
    });
  }

  const value = repositoryResult.result.value;

  if (!value.ok) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });

    return createResponse({
      body: value.error,
      managedRuntime: result,
      sourceSqlRepository,
      status: statusFromErrorCode(value.error.code),
      trace
    });
  }

  sourceSqlRepository.replaceRows(
    buildSourceTableRowsForWriteback({
      records: value.state.sourceRecords,
      sourceSqlRepository
    })
  );

  record({ event: 'writeback_source_sql_rows', events: trace, requestId: context.requestId });
  record({ event: 'return_source_response', events: trace, requestId: context.requestId });

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
    sourceSqlRepository,
    status: value.record.version === 1 ? 201 : 200,
    trace
  });
}

export function validateFinanceHttpPostgresManagedSourceMutationBridgeTrace({
  delegated,
  trace,
  writeback
}: {
  delegated: boolean;
  trace: readonly FinanceHttpPostgresManagedSourceMutationBridgeEvent[];
  writeback: boolean;
}) {
  const events = trace.slice().sort((left, right) => left.sequence - right.sequence).map((event) => event.event);
  const errors: string[] = [];

  if (events[0] !== 'receive_http_source_request') {
    errors.push('managed source mutation bridge must receive HTTP source request first');
  }

  if (delegated && !events.includes('delegate_managed_runtime')) {
    errors.push('managed source mutation bridge must delegate to managed runtime when delegated is expected');
  }

  if (!writeback && events.includes('writeback_source_sql_rows')) {
    errors.push('managed source mutation bridge must not write SQL rows when writeback is false');
  }

  if (writeback) {
    const delegateIndex = events.indexOf('delegate_managed_runtime');
    const writebackIndex = events.indexOf('writeback_source_sql_rows');

    if (delegateIndex === -1 || writebackIndex <= delegateIndex) {
      errors.push('managed source mutation bridge must write SQL rows after managed runtime delegation');
    }
  }

  if (events[events.length - 1] !== 'return_source_response') {
    errors.push('managed source mutation bridge must return response last');
  }

  return errors;
}
