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
import type {
  PeriodClosePersistenceContext,
  PeriodClosePersistentState
} from './periodClosePersistenceContract.js';
import { applyFinanceSourceMutationRepositoryApi } from './periodCloseSourceMutationRepositoryApiContract.js';
import { findFinanceSourceMutationOperation } from './periodCloseSourceMutationRegistry.js';
import { createSourceTableBackedPeriodCloseRepository } from './periodCloseSourceTableRepositoryContract.js';
import type {
  FinanceSourceTableSqlRepositoryContract,
  FinanceSourceTableSqlRow
} from './periodCloseSourceTableSqlRepositoryContract.js';

export type FinanceSourceMutationApiServiceEventName =
  | 'receive_api_request'
  | 'match_source_route'
  | 'validate_source_payload'
  | 'authorize_source_mutation'
  | 'hydrate_source_sql_repository'
  | 'delegate_repository_guard'
  | 'return_source_response';

export type FinanceSourceMutationApiServiceEvent = {
  event: FinanceSourceMutationApiServiceEventName;
  requestId: string;
  sequence: number;
};

export type FinanceSourceMutationApiServiceContext = PeriodClosePersistenceContext & {
  permissionScopes: FinancePeriodClosePermissionScope[];
};

export type FinanceSourceMutationApiServiceResponse = {
  body: unknown;
  sourceSqlRows: FinanceSourceTableSqlRow[];
  state?: PeriodClosePersistentState;
  status: number;
  trace: FinanceSourceMutationApiServiceEvent[];
};

function record({
  events,
  event,
  requestId
}: {
  event: FinanceSourceMutationApiServiceEventName;
  events: FinanceSourceMutationApiServiceEvent[];
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
  sourceSqlRepository,
  state,
  status,
  trace
}: {
  body: unknown;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  state?: PeriodClosePersistentState;
  status: number;
  trace: FinanceSourceMutationApiServiceEvent[];
}): FinanceSourceMutationApiServiceResponse {
  return {
    body,
    sourceSqlRows: sourceSqlRepository.readSqlRows(),
    ...(state ? { state } : {}),
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
  trace: FinanceSourceMutationApiServiceEvent[];
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

export function handleFinanceSourceMutationApiService({
  context,
  initialState,
  request,
  sourceSqlRepository
}: {
  context: FinanceSourceMutationApiServiceContext;
  initialState: PeriodClosePersistentState;
  request: FinanceHttpApiRepositoryGatewayRequest;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
}): FinanceSourceMutationApiServiceResponse {
  const trace: FinanceSourceMutationApiServiceEvent[] = [];

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

  const repository = createSourceTableBackedPeriodCloseRepository({
    initialState,
    sourceTableRepository: sourceSqlRepository
  });

  record({ event: 'hydrate_source_sql_repository', events: trace, requestId: context.requestId });

  const result = applyFinanceSourceMutationRepositoryApi({
    context,
    operation,
    repository,
    request: {
      amount: payload.body.amount,
      expectedVersion: payload.body.expectedVersion,
      sourceId,
      sourceNo: payload.body.sourceNo,
      status: payload.body.status,
      targetAccountingPeriod: payload.body.targetAccountingPeriod
    }
  });

  record({ event: 'delegate_repository_guard', events: trace, requestId: context.requestId });
  record({ event: 'return_source_response', events: trace, requestId: context.requestId });

  if (!result.ok) {
    return createResponse({
      body: result.error,
      sourceSqlRepository,
      state: repository.readState(),
      status: statusFromErrorCode(result.error.code),
      trace
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
    sourceSqlRepository,
    state: repository.readState(),
    status: result.record.version === 1 ? 201 : 200,
    trace
  });
}

export function validateFinanceSourceMutationApiServiceTrace({
  delegated,
  trace
}: {
  delegated: boolean;
  trace: readonly FinanceSourceMutationApiServiceEvent[];
}) {
  const events = trace.slice().sort((left, right) => left.sequence - right.sequence).map((event) => event.event);
  const errors: string[] = [];
  const expectedPrefix: FinanceSourceMutationApiServiceEventName[] = [
    'receive_api_request',
    'match_source_route'
  ];

  if (events.slice(0, expectedPrefix.length).join('|') !== expectedPrefix.join('|')) {
    errors.push('source mutation API service must receive request before route matching');
  }

  if (delegated) {
    const expected: FinanceSourceMutationApiServiceEventName[] = [
      'receive_api_request',
      'match_source_route',
      'validate_source_payload',
      'authorize_source_mutation',
      'hydrate_source_sql_repository',
      'delegate_repository_guard',
      'return_source_response'
    ];

    if (events.join('|') !== expected.join('|')) {
      errors.push('delegated source mutation API service trace must route, validate, authorize, hydrate, delegate, then return');
    }
  }

  if (events[events.length - 1] !== 'return_source_response') {
    errors.push('source mutation API service must return response last');
  }

  return errors;
}
