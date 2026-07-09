import {
  handleFinancialStatementRoute,
  type FinancialStatementRouteState
} from './financialStatementRoutes.js';
import {
  handleGeneralLedgerRoute,
  type GeneralLedgerRouteState
} from './generalLedgerRoutes.js';
import type { FinancePeriodClosePermissionScope } from './periodCloseAuthorizationContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';
import {
  handleFinancePeriodCloseRoute,
  type PeriodCloseRouteState
} from './periodCloseRoutes.js';
import {
  handleFinanceSourceMutationRoute,
  type FinanceSourceMutationRouteState
} from './periodCloseSourceMutationRoutes.js';

export type FinanceHttpApiMethod = 'GET' | 'PATCH' | 'POST';

export type FinanceHttpApiGatewayRequest = {
  body?: unknown;
  headers?: Record<string, string | undefined>;
  method: FinanceHttpApiMethod | string;
  path: string;
  query?: Record<string, string | undefined>;
};

export type FinanceHttpApiGatewayState = {
  financialStatements: FinancialStatementRouteState;
  generalLedger: GeneralLedgerRouteState;
  periodClose: PeriodCloseRouteState;
  sourceMutation: FinanceSourceMutationRouteState;
};

export type FinanceHttpApiGatewayResponse = {
  body: unknown;
  headers: Record<string, string>;
  state: FinanceHttpApiGatewayState;
  status: number;
};

const defaultActorSnapshot: ActorSnapshot = {
  id: 'system-local-api',
  name: '本地 API'
};

const defaultNow = '1970-01-01T00:00:00+00:00';
const defaultRequestId = 'local-http-request';

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

function createContext(request: FinanceHttpApiGatewayRequest) {
  const headers = normalizeHeaders(request.headers);

  return {
    actorSnapshot: {
      id: headers['x-actor-id'] || defaultActorSnapshot.id,
      name: headers['x-actor-name'] || defaultActorSnapshot.name
    },
    now: headers['x-request-time'] || defaultNow,
    permissionScopes: parsePermissionScopes(headers['x-permission-scopes']),
    requestId: headers['x-request-id'] || defaultRequestId
  };
}

function createJsonResponse({
  body,
  state,
  status
}: {
  body: unknown;
  state: FinanceHttpApiGatewayState;
  status: number;
}): FinanceHttpApiGatewayResponse {
  return {
    body,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    state,
    status
  };
}

function syncAccountingPeriods(
  state: FinanceHttpApiGatewayState,
  periods: AccountingPeriodRecord[]
): FinanceHttpApiGatewayState {
  const periodSnapshot = periods.map((period) => ({ ...period }));

  return {
    financialStatements: {
      ...state.financialStatements,
      periods: periodSnapshot.map((period) => ({ ...period }))
    },
    generalLedger: {
      ...state.generalLedger,
      periods: periodSnapshot.map((period) => ({ ...period }))
    },
    periodClose: {
      ...state.periodClose,
      periods: periodSnapshot.map((period) => ({ ...period }))
    },
    sourceMutation: {
      ...state.sourceMutation,
      periods: periodSnapshot.map((period) => ({ ...period }))
    }
  };
}

function createNotFoundResponse(state: FinanceHttpApiGatewayState, requestId: string): FinanceHttpApiGatewayResponse {
  return createJsonResponse({
    body: {
      code: 'NOT_FOUND',
      message: '接口不存在。',
      requestId
    },
    state,
    status: 404
  });
}

function isPeriodCloseRoute(request: FinanceHttpApiGatewayRequest) {
  return request.path === '/api/finance/accounting-periods' || request.path.startsWith('/api/finance/accounting-periods/');
}

function isFinancialStatementRoute(request: FinanceHttpApiGatewayRequest) {
  return request.path.startsWith('/api/finance/financial-statements/');
}

function isGeneralLedgerRoute(request: FinanceHttpApiGatewayRequest) {
  return request.path === '/api/finance/general-ledger' || request.path.startsWith('/api/finance/general-ledger/');
}

function isSourceMutationMethod(method: string): method is 'PATCH' | 'POST' {
  return method === 'PATCH' || method === 'POST';
}

export function handleFinanceHttpApiGateway({
  request,
  state
}: {
  request: FinanceHttpApiGatewayRequest;
  state: FinanceHttpApiGatewayState;
}): FinanceHttpApiGatewayResponse {
  const method = request.method.toUpperCase();
  const context = createContext(request);
  const syncedInputState = syncAccountingPeriods(state, state.periodClose.periods);

  if (isPeriodCloseRoute(request) && (method === 'GET' || method === 'POST')) {
    const response = handleFinancePeriodCloseRoute({
      context,
      request: {
        body: request.body,
        method,
        path: request.path,
        query: request.query
      },
      state: syncedInputState.periodClose
    });
    const nextState = syncAccountingPeriods(
      {
        ...syncedInputState,
        periodClose: response.state
      },
      response.state.periods
    );

    return createJsonResponse({
      body: response.body,
      state: nextState,
      status: response.status
    });
  }

  if (isFinancialStatementRoute(request) && (method === 'GET' || method === 'POST')) {
    const response = handleFinancialStatementRoute({
      context,
      request: {
        body: request.body,
        method,
        path: request.path,
        query: request.query
      },
      state: syncedInputState.financialStatements
    });

    return createJsonResponse({
      body: response.body,
      state: {
        ...syncedInputState,
        financialStatements: response.state
      },
      status: response.status
    });
  }

  if (isGeneralLedgerRoute(request) && method === 'GET') {
    const response = handleGeneralLedgerRoute({
      context,
      request: {
        method,
        path: request.path,
        query: request.query
      },
      state: syncedInputState.generalLedger
    });

    return createJsonResponse({
      body: response.body,
      state: {
        ...syncedInputState,
        generalLedger: response.state
      },
      status: response.status
    });
  }

  if (isSourceMutationMethod(method)) {
    const response = handleFinanceSourceMutationRoute({
      context,
      request: {
        body: request.body,
        method,
        path: request.path
      },
      state: syncedInputState.sourceMutation
    });

    return createJsonResponse({
      body: response.body,
      state: {
        ...syncedInputState,
        sourceMutation: response.state
      },
      status: response.status
    });
  }

  return createNotFoundResponse(syncedInputState, context.requestId);
}
