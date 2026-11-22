import type {
  FinanceHttpApiRepositoryGatewayRequest,
  FinanceHttpApiRepositoryGatewayResponse,
} from './financeHttpApiRepositoryGatewayContract.js';
import type { FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import {
  handleFinanceHttpPostgresManagedSourceMutationBridge,
  type FinanceHttpPostgresManagedSourceMutationBridgeResponse,
} from './financeHttpPostgresManagedSourceMutationBridgeContract.js';
import type { FinanceResourceScope } from './financeHttpResourceAuthorizationContract.js';
import {
  financePeriodClosePermissionScopes,
  type FinancePeriodClosePermissionScope,
} from './periodCloseAuthorizationContract.js';
import type {
  PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  PeriodClosePostgresManagedServicePoolRuntimeContract,
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import type {
  FinanceSourceTableSqlRepositoryContract,
  FinanceSourceTableSqlRow,
} from './periodCloseSourceTableSqlRepositoryContract.js';

export type FinanceHttpPostgresManagedSourceMutationServerRequest = {
  bodyText?: string;
  headers?: Record<string, string | readonly string[] | undefined>;
  method: string;
  principal?: FinanceHttpAuthenticatedPrincipal;
  receivedAt?: string;
  requestId?: string;
  url: string;
};

export type FinanceHttpPostgresManagedSourceMutationServerTraceEventName =
  | 'receive_server_source_request'
  | 'parse_server_url'
  | 'bind_finance_route'
  | 'authenticate_source_principal'
  | 'authorize_ledger_resource'
  | 'parse_json_body'
  | 'delegate_managed_source_bridge'
  | 'return_server_source_response';

export type FinanceHttpPostgresManagedSourceMutationServerEvent = {
  detail: string;
  event: FinanceHttpPostgresManagedSourceMutationServerTraceEventName;
  ok: boolean;
  order: number;
};

export type FinanceHttpPostgresManagedSourceMutationServerResponse = {
  body: FinanceHttpApiRepositoryGatewayResponse['body'];
  bodyText: string;
  handled: boolean;
  headers: Record<string, string>;
  sourceBridge?: {
    status: number;
    traceErrorCount: number;
    traceEventCount: number;
  };
  sourceSqlRows: FinanceSourceTableSqlRow[];
  status: number;
  trace: FinanceHttpPostgresManagedSourceMutationServerEvent[];
};

export type FinanceHttpPostgresManagedSourceMutationServerInput = {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  financeRoutePrefix?: string;
  request: FinanceHttpPostgresManagedSourceMutationServerRequest;
  runtime: PeriodClosePostgresManagedServicePoolRuntimeContract;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
};

type ServerPathParseResult =
  | { ok: true; pathname: string }
  | { ok: false; reason: string };

type ParsedJsonBodyResult =
  | { ok: true; body: FinanceHttpApiRepositoryGatewayRequest['body'] }
  | { code: string; ok: false; status: number };

const DEFAULT_FINANCE_ROUTE_PREFIX = '/api/finance';
const DEFAULT_LEDGER_ID = 'default-ledger';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function appendTrace(
  trace: FinanceHttpPostgresManagedSourceMutationServerEvent[],
  event: FinanceHttpPostgresManagedSourceMutationServerTraceEventName,
  ok: boolean,
  detail: string,
) {
  trace.push({ detail, event, ok, order: trace.length + 1 });
}

function readRows(sourceSqlRepository: FinanceSourceTableSqlRepositoryContract) {
  return sourceSqlRepository.readSqlRows();
}

function createResponse(
  status: number,
  body: FinanceHttpApiRepositoryGatewayResponse['body'],
  handled: boolean,
  trace: FinanceHttpPostgresManagedSourceMutationServerEvent[],
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract,
  sourceBridge?: FinanceHttpPostgresManagedSourceMutationBridgeResponse,
): FinanceHttpPostgresManagedSourceMutationServerResponse {
  return {
    body,
    bodyText: JSON.stringify(body),
    handled,
    headers: JSON_HEADERS,
    sourceBridge: sourceBridge
      ? {
          status: sourceBridge.status,
          traceErrorCount: sourceBridge.managedRuntime?.traceErrorCount ?? 0,
          traceEventCount: sourceBridge.trace.length,
        }
      : undefined,
    sourceSqlRows: readRows(sourceSqlRepository),
    status,
    trace,
  };
}

function stripOriginAndHash(url: string) {
  const withoutHash = url.split('#', 1)[0] ?? '';
  return withoutHash.replace(/^https?:\/\/[^/]+/u, '');
}

function parseServerPath(url: string): ServerPathParseResult {
  const normalized = stripOriginAndHash(url);
  const rawPath = normalized.split('?', 1)[0] ?? '';
  if (!rawPath.startsWith('/')) {
    return { ok: false, reason: 'URL_PATH_MUST_START_WITH_SLASH' };
  }
  try {
    return { ok: true, pathname: decodeURI(rawPath) };
  } catch {
    return { ok: false, reason: 'URL_PATH_DECODE_FAILED' };
  }
}

function normalizeHeaders(
  headers?: Record<string, string | readonly string[] | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(headers ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    normalized[key.toLowerCase()] = typeof value === 'string' ? value : value.join(',');
  });
  return normalized;
}

function isSupportedFinanceSourceMutationMethod(method: string) {
  return method.toUpperCase() === 'PATCH' || method.toUpperCase() === 'POST';
}

function isKnownPermissionScope(scope: string): scope is FinancePeriodClosePermissionScope {
  return (financePeriodClosePermissionScopes as readonly string[]).includes(scope);
}

function validatePrincipalPermissionContext(principal: FinanceHttpAuthenticatedPrincipal) {
  return principal.permissionScopes.every(isKnownPermissionScope);
}

function hasDefaultLedgerResourceScope(scopes: readonly FinanceResourceScope[]) {
  return scopes.some(
    (scope) => scope === 'finance.ledger:*' || scope === `finance.ledger:${DEFAULT_LEDGER_ID}`,
  );
}

function createTrustedHeaders(
  incomingHeaders: Record<string, string>,
  principal: FinanceHttpAuthenticatedPrincipal,
  request: FinanceHttpPostgresManagedSourceMutationServerRequest,
): Record<string, string> {
  return {
    ...incomingHeaders,
    'x-actor-id': principal.actorSnapshot.id,
    'x-actor-name': principal.actorSnapshot.name,
    'x-finance-resource-scopes': principal.resourceScopes?.join(',') ?? '',
    'x-permission-scopes': principal.permissionScopes.join(','),
    'x-request-id': request.requestId ?? incomingHeaders['x-request-id'] ?? 'server-source-request',
    'x-request-time':
      request.receivedAt ??
      incomingHeaders['x-request-time'] ??
      new Date('2026-07-01T00:00:00.000Z').toISOString(),
  };
}

function parseJsonBody(
  request: FinanceHttpPostgresManagedSourceMutationServerRequest,
  headers: Record<string, string>,
): ParsedJsonBodyResult {
  const bodyText = request.bodyText?.trim();
  if (!bodyText) return { body: undefined, ok: true };

  const contentType = headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { code: 'UNSUPPORTED_CONTENT_TYPE', ok: false, status: 415 };
  }

  try {
    return { body: JSON.parse(bodyText), ok: true };
  } catch {
    return { code: 'INVALID_JSON_REQUEST', ok: false, status: 400 };
  }
}

export async function handleFinanceHttpPostgresManagedSourceMutationServer(
  input: FinanceHttpPostgresManagedSourceMutationServerInput,
): Promise<FinanceHttpPostgresManagedSourceMutationServerResponse> {
  const { admission, request, runtime, sourceSqlRepository } = input;
  const routePrefix = input.financeRoutePrefix ?? DEFAULT_FINANCE_ROUTE_PREFIX;
  const trace: FinanceHttpPostgresManagedSourceMutationServerEvent[] = [];

  appendTrace(trace, 'receive_server_source_request', true, request.method.toUpperCase());

  const parsedPath = parseServerPath(request.url);
  appendTrace(trace, 'parse_server_url', parsedPath.ok, parsedPath.ok ? parsedPath.pathname : parsedPath.reason);
  if (!parsedPath.ok) {
    appendTrace(trace, 'return_server_source_response', true, '400');
    return createResponse(
      400,
      { code: parsedPath.reason, message: 'Invalid finance source route URL.' },
      true,
      trace,
      sourceSqlRepository,
    );
  }

  if (!parsedPath.pathname.startsWith(`${routePrefix}/`)) {
    appendTrace(trace, 'bind_finance_route', false, 'NOT_FINANCE_ROUTE');
    appendTrace(trace, 'return_server_source_response', true, '404');
    return createResponse(
      404,
      { code: 'NOT_FINANCE_ROUTE', message: 'Route is outside the finance source mutation API.' },
      false,
      trace,
      sourceSqlRepository,
    );
  }
  appendTrace(trace, 'bind_finance_route', true, parsedPath.pathname);

  if (!isSupportedFinanceSourceMutationMethod(request.method)) {
    appendTrace(trace, 'return_server_source_response', true, '405');
    return createResponse(
      405,
      { code: 'METHOD_NOT_ALLOWED', message: 'Finance source mutation routes require POST or PATCH.' },
      true,
      trace,
      sourceSqlRepository,
    );
  }

  if (!request.principal) {
    appendTrace(trace, 'authenticate_source_principal', false, 'MISSING_PRINCIPAL');
    appendTrace(trace, 'return_server_source_response', true, '401');
    return createResponse(
      401,
      { code: 'UNAUTHENTICATED', message: 'Finance source mutation requires a server principal.' },
      true,
      trace,
      sourceSqlRepository,
    );
  }

  if (request.principal.status !== 'active') {
    appendTrace(trace, 'authenticate_source_principal', false, 'PRINCIPAL_DISABLED');
    appendTrace(trace, 'return_server_source_response', true, '403');
    return createResponse(
      403,
      { code: 'AUTH_PRINCIPAL_DISABLED', message: 'Finance source mutation principal is disabled.' },
      true,
      trace,
      sourceSqlRepository,
    );
  }

  if (!validatePrincipalPermissionContext(request.principal)) {
    appendTrace(trace, 'authenticate_source_principal', false, 'INVALID_PERMISSION_CONTEXT');
    appendTrace(trace, 'return_server_source_response', true, '500');
    return createResponse(
      500,
      { code: 'INVALID_AUTH_CONTEXT', message: 'Finance source mutation principal has unknown scopes.' },
      true,
      trace,
      sourceSqlRepository,
    );
  }
  appendTrace(trace, 'authenticate_source_principal', true, request.principal.actorSnapshot.id);

  if (!hasDefaultLedgerResourceScope(request.principal.resourceScopes ?? [])) {
    appendTrace(trace, 'authorize_ledger_resource', false, DEFAULT_LEDGER_ID);
    appendTrace(trace, 'return_server_source_response', true, '403');
    return createResponse(
      403,
      { code: 'FORBIDDEN', message: 'Finance source mutation requires access to the default ledger.' },
      true,
      trace,
      sourceSqlRepository,
    );
  }
  appendTrace(trace, 'authorize_ledger_resource', true, DEFAULT_LEDGER_ID);

  const incomingHeaders = normalizeHeaders(request.headers);
  const trustedHeaders = createTrustedHeaders(incomingHeaders, request.principal, request);
  const parsedBody = parseJsonBody(request, incomingHeaders);
  appendTrace(
    trace,
    'parse_json_body',
    parsedBody.ok,
    parsedBody.ok ? 'JSON_BODY_ACCEPTED' : parsedBody.code,
  );
  if (!parsedBody.ok) {
    appendTrace(trace, 'return_server_source_response', true, String(parsedBody.status));
    return createResponse(
      parsedBody.status,
      {
        code: parsedBody.code,
        message: 'Finance source mutation request body must be valid JSON.',
      },
      true,
      trace,
      sourceSqlRepository,
    );
  }

  appendTrace(trace, 'delegate_managed_source_bridge', true, parsedPath.pathname);
  const bridgeResponse = await handleFinanceHttpPostgresManagedSourceMutationBridge({
    admission,
    request: {
      body: parsedBody.body,
      headers: trustedHeaders,
      method: request.method,
      path: parsedPath.pathname,
    },
    runtime,
    sourceSqlRepository,
  });

  appendTrace(trace, 'return_server_source_response', true, String(bridgeResponse.status));
  return createResponse(
    bridgeResponse.status,
    bridgeResponse.body,
    true,
    trace,
    sourceSqlRepository,
    bridgeResponse,
  );
}

export function validateFinanceHttpPostgresManagedSourceMutationServerTrace(input: {
  delegated: boolean;
  trace: readonly FinanceHttpPostgresManagedSourceMutationServerEvent[];
}) {
  const { delegated, trace } = input;
  const errors: string[] = [];
  if (trace.length === 0) {
    return { errors: ['TRACE_EMPTY'], ok: false };
  }

  trace.forEach((event, index) => {
    if (event.order !== index + 1) {
      errors.push(`TRACE_ORDER_GAP:${event.event}:${event.order}:${index + 1}`);
    }
  });

  if (trace[0]?.event !== 'receive_server_source_request') {
    errors.push('TRACE_MUST_START_WITH_RECEIVE_SERVER_SOURCE_REQUEST');
  }
  if (trace.at(-1)?.event !== 'return_server_source_response') {
    errors.push('TRACE_MUST_END_WITH_RETURN_SERVER_SOURCE_RESPONSE');
  }

  const delegateIndex = trace.findIndex((event) => event.event === 'delegate_managed_source_bridge');
  if (delegated && delegateIndex === -1) {
    errors.push('TRACE_MISSING_DELEGATE_MANAGED_SOURCE_BRIDGE');
  }
  if (!delegated && delegateIndex !== -1) {
    errors.push('TRACE_UNEXPECTED_DELEGATE_MANAGED_SOURCE_BRIDGE');
  }

  const parseBodyIndex = trace.findIndex((event) => event.event === 'parse_json_body');
  if (delegated && parseBodyIndex === -1) {
    errors.push('TRACE_MISSING_PARSE_JSON_BODY_BEFORE_DELEGATE');
  }
  if (delegated && parseBodyIndex > delegateIndex) {
    errors.push('TRACE_PARSE_JSON_BODY_AFTER_DELEGATE');
  }

  return { errors, ok: errors.length === 0 };
}
