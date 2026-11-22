import type {
  FinanceHttpServerRuntime,
  FinanceHttpServerRuntimeRequest,
  FinanceHttpServerRuntimeResponse
} from './financeHttpServerRuntimeContract.js';

export type FinanceHttpFrameworkRouteQueryValue =
  | boolean
  | number
  | readonly (boolean | number | string)[]
  | string
  | undefined;

export type FinanceHttpFrameworkRouteRequest = {
  bodyText?: string;
  headers?: Record<string, string | readonly string[] | undefined>;
  method: string;
  pathname: string;
  query?: Record<string, FinanceHttpFrameworkRouteQueryValue>;
};

export type FinanceHttpFrameworkRouteResponse = FinanceHttpServerRuntimeResponse & {
  handled: boolean;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

function createRouteBindingError({
  code,
  handled,
  message,
  status
}: {
  code: 'FINANCE_METHOD_NOT_ALLOWED' | 'FINANCE_ROUTE_NOT_BOUND';
  handled: boolean;
  message: string;
  status: number;
}): FinanceHttpFrameworkRouteResponse {
  return {
    bodyText: JSON.stringify({
      code,
      message
    }),
    handled,
    headers: jsonHeaders,
    status
  };
}

function normalizePathname(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function normalizeRoutePrefix(routePrefix: string) {
  const normalized = normalizePathname(routePrefix);

  return normalized.endsWith('/') && normalized.length > 1 ? normalized.slice(0, -1) : normalized;
}

function isBoundFinancePath(pathname: string, routePrefix: string) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedRoutePrefix = normalizeRoutePrefix(routePrefix);

  return normalizedPathname === normalizedRoutePrefix || normalizedPathname.startsWith(`${normalizedRoutePrefix}/`);
}

function encodeQueryPart(value: boolean | number | string) {
  return encodeURIComponent(String(value));
}

function isQueryValueArray(
  value: FinanceHttpFrameworkRouteQueryValue
): value is readonly (boolean | number | string)[] {
  return Array.isArray(value);
}

function serializeQuery(query: FinanceHttpFrameworkRouteRequest['query'] = {}) {
  const parts: string[] = [];

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (isQueryValueArray(value)) {
      value.forEach((item) => {
        parts.push(`${encodeQueryPart(key)}=${encodeQueryPart(item)}`);
      });

      return;
    }

    parts.push(`${encodeQueryPart(key)}=${encodeQueryPart(value)}`);
  });

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function createRuntimeRequest(request: FinanceHttpFrameworkRouteRequest): FinanceHttpServerRuntimeRequest {
  return {
    bodyText: request.bodyText,
    headers: request.headers,
    method: request.method.toUpperCase(),
    url: `${normalizePathname(request.pathname)}${serializeQuery(request.query)}`
  };
}

export function createFinanceHttpFrameworkRouteBinding({
  allowedMethods = ['GET', 'PATCH', 'POST'],
  routePrefix = '/api/finance',
  runtime
}: {
  allowedMethods?: readonly string[];
  routePrefix?: string;
  runtime: FinanceHttpServerRuntime;
}) {
  const allowedMethodSet = new Set(allowedMethods.map((method) => method.toUpperCase()));

  return {
    handleFrameworkRouteRequest: (request: FinanceHttpFrameworkRouteRequest): FinanceHttpFrameworkRouteResponse => {
      if (!isBoundFinancePath(request.pathname, routePrefix)) {
        return createRouteBindingError({
          code: 'FINANCE_ROUTE_NOT_BOUND',
          handled: false,
          message: '该请求不属于财务 API 绑定范围。',
          status: 404
        });
      }

      if (!allowedMethodSet.has(request.method.toUpperCase())) {
        return createRouteBindingError({
          code: 'FINANCE_METHOD_NOT_ALLOWED',
          handled: true,
          message: '财务 API 不支持该请求方法。',
          status: 405
        });
      }

      return {
        ...runtime.handleServerRequest(createRuntimeRequest(request)),
        handled: true
      };
    }
  };
}
