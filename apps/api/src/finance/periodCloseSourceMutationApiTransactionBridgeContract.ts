import type { FinanceHttpApiRepositoryGatewayRequest } from './financeHttpApiRepositoryGatewayContract.js';
import { parseFinanceSourceMutationPayload } from './financeSourceMutationPayloadContract.js';
import {
  matchSourceMutationRoute,
  statusFromErrorCode
} from './financeHttpServiceTransactionGatewayContract.js';
import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import { createPeriodCloseDbClientRepositoryContract } from './periodCloseDbClientRepositoryContract.js';
import type {
  PeriodClosePersistenceContext,
  PeriodClosePersistentState,
  PersistentFinanceSourceRecord,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';
import {
  createPeriodCloseServiceTransactionBoundaryContract,
  type PeriodCloseServiceTransactionBoundaryResult
} from './periodCloseServiceTransactionBoundaryContract.js';
import {
  createInMemoryPeriodCloseSqlDriverExecutor,
  type PeriodCloseSqlDriverStatementName
} from './periodCloseSqlDriverRepositoryContract.js';
import { createPeriodCloseSqlRepositoryContract } from './periodCloseSqlRepositoryContract.js';
import { findFinanceSourceMutationOperation } from './periodCloseSourceMutationRegistry.js';
import { getDefaultFinanceSourceTableName } from './periodCloseSourceTableRepositoryContract.js';
import type {
  FinanceSourceTableSqlRepositoryContract,
  FinanceSourceTableSqlRow
} from './periodCloseSourceTableSqlRepositoryContract.js';

export type FinanceSourceMutationApiTransactionBridgeEventName =
  | 'receive_api_request'
  | 'match_source_route'
  | 'validate_source_payload'
  | 'authorize_source_mutation'
  | 'hydrate_source_sql_rows'
  | 'delegate_service_transaction'
  | 'writeback_source_sql_rows'
  | 'return_source_response';

export type FinanceSourceMutationApiTransactionBridgeEvent = {
  event: FinanceSourceMutationApiTransactionBridgeEventName;
  requestId: string;
  sequence: number;
};

export type FinanceSourceMutationApiTransactionBridgeContext = PeriodClosePersistenceContext & {
  permissionScopes: FinancePeriodClosePermissionScope[];
};

export type FinanceSourceMutationApiTransactionBridgeResponse = {
  body: unknown;
  serviceTransaction?: {
    operation: PeriodCloseServiceTransactionBoundaryResult<PersistentSourceMutationResult>['operation'];
    status: PeriodCloseServiceTransactionBoundaryResult<PersistentSourceMutationResult>['status'];
    traceErrorCount: number;
    transactionId: string;
  };
  sourceSqlRows: FinanceSourceTableSqlRow[];
  status: number;
  trace: FinanceSourceMutationApiTransactionBridgeEvent[];
};

function record({
  event,
  events,
  requestId
}: {
  event: FinanceSourceMutationApiTransactionBridgeEventName;
  events: FinanceSourceMutationApiTransactionBridgeEvent[];
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
  serviceTransaction,
  sourceSqlRepository,
  status,
  trace
}: {
  body: unknown;
  serviceTransaction?: PeriodCloseServiceTransactionBoundaryResult<PersistentSourceMutationResult>;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  status: number;
  trace: FinanceSourceMutationApiTransactionBridgeEvent[];
}): FinanceSourceMutationApiTransactionBridgeResponse {
  return {
    body,
    ...(serviceTransaction
      ? {
          serviceTransaction: {
            operation: serviceTransaction.operation,
            status: serviceTransaction.status,
            traceErrorCount: serviceTransaction.traceErrors.length,
            transactionId: serviceTransaction.transactionId
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
  trace: FinanceSourceMutationApiTransactionBridgeEvent[];
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

function mapServiceFailure({
  requestId,
  result,
  sourceSqlRepository,
  trace
}: {
  requestId: string;
  result: PeriodCloseServiceTransactionBoundaryResult<PersistentSourceMutationResult>;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  trace: FinanceSourceMutationApiTransactionBridgeEvent[];
}) {
  if (result.error) {
    return createResponse({
      body: result.error,
      serviceTransaction: result,
      sourceSqlRepository,
      status: result.error.retryable ? 503 : 500,
      trace
    });
  }

  if (!result.repositoryResult.driverOk) {
    return createResponse({
      body: {
        code: 'DB_TRANSACTION_FAILED',
        message: result.repositoryResult.error.message,
        requestId,
        retryable: true
      },
      serviceTransaction: result,
      sourceSqlRepository,
      status: 503,
      trace
    });
  }

  if (!result.repositoryResult.result.ok) {
    return createResponse({
      body: {
        code: 'DB_TRANSACTION_TRACE_INVALID',
        message: '源单服务事务结果不完整。',
        requestId
      },
      serviceTransaction: result,
      sourceSqlRepository,
      status: 500,
      trace
    });
  }

  return undefined;
}

export function handleFinanceSourceMutationApiTransactionBridge({
  context,
  failOnStatement,
  initialState,
  request,
  sourceSqlRepository
}: {
  context: FinanceSourceMutationApiTransactionBridgeContext;
  failOnStatement?: PeriodCloseSqlDriverStatementName;
  initialState: PeriodClosePersistentState;
  request: FinanceHttpApiRepositoryGatewayRequest;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
}): FinanceSourceMutationApiTransactionBridgeResponse {
  const trace: FinanceSourceMutationApiTransactionBridgeEvent[] = [];

  record({ event: 'receive_api_request', events: trace, requestId: context.requestId });

  const matchedRoute = matchSourceMutationRoute(request);

  record({ event: 'match_source_route', events: trace, requestId: context.requestId });

  if (!matchedRoute) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });
    return createErrorResponse({
      code: 'NOT_FOUND',
      message: '源单写入接口不存在。',
      requestId: context.requestId,
      sourceSqlRepository,
      status: 404,
      trace
    });
  }

  const payload = parseFinanceSourceMutationPayload(request.body);

  record({ event: 'validate_source_payload', events: trace, requestId: context.requestId });

  if (!payload.ok) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: payload.message,
      requestId: context.requestId,
      sourceSqlRepository,
      status: 400,
      trace
    });
  }

  const sourceId = matchedRoute.definition.sourceIdFromBody ? payload.body.sourceId?.trim() : matchedRoute.sourceId;

  if (!sourceId) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: '源单写入请求必须包含 sourceId。',
      requestId: context.requestId,
      sourceSqlRepository,
      status: 400,
      trace
    });
  }

  const operation = findFinanceSourceMutationOperation(matchedRoute.definition.operation);

  if (!operation) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });
    return createErrorResponse({
      code: 'SOURCE_OPERATION_NOT_REGISTERED',
      message: '源单写入操作没有登记到期间锁目录。',
      requestId: context.requestId,
      sourceSqlRepository,
      status: 500,
      trace
    });
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: operation.operation,
    requiredPermissionScope: operation.permissionScope as FinancePeriodClosePermissionScope,
    sourceId,
    sourceModule: operation.sourceArea
  });

  record({ event: 'authorize_source_mutation', events: trace, requestId: context.requestId });

  if (!authorization.allowed) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });
    return createResponse({
      body: {
        ...authorization.error,
        operation: operation.operation,
        sourceArea: operation.sourceArea
      },
      sourceSqlRepository,
      status: 403,
      trace
    });
  }

  const repository = createPeriodCloseSqlRepositoryContract({
    fallbackNow: context.now,
    initialState: {
      ...initialState,
      sourceRecords: sourceSqlRepository.readRows().map((row) => ({
        accountingPeriod: row.accountingPeriod,
        amount: row.amount,
        id: row.id,
        sourceArea: row.sourceArea,
        sourceNo: row.sourceNo,
        status: row.status,
        version: row.version
      }))
    }
  });
  const driver = createInMemoryPeriodCloseSqlDriverExecutor(
    failOnStatement ? { failOnStatement } : undefined
  );
  const clientRepository = createPeriodCloseDbClientRepositoryContract({ driver, repository });
  const service = createPeriodCloseServiceTransactionBoundaryContract({
    clientRepository,
    resolveSourceMutationPeriod: ({ mutation }) =>
      mutation.targetAccountingPeriod ??
      repository
        .readDatabaseSnapshot()
        .sourceRecords.find(
          (record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea
        )?.accountingPeriod
  });

  record({ event: 'hydrate_source_sql_rows', events: trace, requestId: context.requestId });

  const result = service.guardSourceMutation({
    context,
    mutation: {
      amount: payload.body.amount,
      createsSourceRecord: operation.createsSourceRecord,
      expectedVersion: payload.body.expectedVersion,
      operation: operation.operation,
      sourceArea: operation.sourceArea,
      sourceId,
      sourceNo: payload.body.sourceNo,
      status: payload.body.status ?? operation.successStatus,
      targetAccountingPeriod: payload.body.targetAccountingPeriod
    }
  });

  record({ event: 'delegate_service_transaction', events: trace, requestId: context.requestId });

  const failure = mapServiceFailure({
    requestId: context.requestId,
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

  if (!result.repositoryResult.driverOk || !result.repositoryResult.result.ok) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });
    return createErrorResponse({
      code: 'DB_TRANSACTION_TRACE_INVALID',
      message: '源单服务事务结果不完整。',
      requestId: context.requestId,
      sourceSqlRepository,
      status: 500,
      trace
    });
  }

  const value = result.repositoryResult.result.value;

  if (!value.ok) {
    record({ event: 'return_source_response', events: trace, requestId: context.requestId });
    return createResponse({
      body: value.error,
      serviceTransaction: result,
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
    serviceTransaction: result,
    sourceSqlRepository,
    status: value.record.version === 1 ? 201 : 200,
    trace
  });
}

export function validateFinanceSourceMutationApiTransactionBridgeTrace({
  delegated,
  trace,
  writeback
}: {
  delegated: boolean;
  trace: readonly FinanceSourceMutationApiTransactionBridgeEvent[];
  writeback: boolean;
}) {
  const events = trace.slice().sort((left, right) => left.sequence - right.sequence).map((event) => event.event);
  const errors: string[] = [];

  if (events[0] !== 'receive_api_request') {
    errors.push('source mutation API transaction bridge must receive request first');
  }

  if (delegated && !events.includes('delegate_service_transaction')) {
    errors.push('delegated source mutation API transaction bridge must enter service transaction boundary');
  }

  if (!writeback && events.includes('writeback_source_sql_rows')) {
    errors.push('source mutation API transaction bridge must not write back SQL rows when writeback is false');
  }

  if (writeback) {
    const delegateIndex = events.indexOf('delegate_service_transaction');
    const writebackIndex = events.indexOf('writeback_source_sql_rows');

    if (delegateIndex === -1 || writebackIndex <= delegateIndex) {
      errors.push('source mutation API transaction bridge must write back SQL rows after service transaction delegation');
    }
  }

  if (events[events.length - 1] !== 'return_source_response') {
    errors.push('source mutation API transaction bridge must return response last');
  }

  return errors;
}
