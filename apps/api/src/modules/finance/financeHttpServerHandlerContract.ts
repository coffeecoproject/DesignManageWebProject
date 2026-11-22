import type {
  FinanceHttpFrameworkRouteQueryValue,
  FinanceHttpFrameworkRouteResponse
} from './financeHttpFrameworkRouteBindingContract.js';

export type FinanceHttpServerHandlerRequest = {
  bodyText?: string;
  headers?: Record<string, string | readonly string[] | undefined>;
  method: string;
  url: string;
};

export type FinanceHttpServerHandlerResponse = FinanceHttpFrameworkRouteResponse;

export type FinanceHttpServerHandlerRouteBinding = {
  handleFrameworkRouteRequest: (request: {
    bodyText?: string;
    headers?: Record<string, string | readonly string[] | undefined>;
    method: string;
    pathname: string;
    query?: Record<string, FinanceHttpFrameworkRouteQueryValue>;
  }) => FinanceHttpFrameworkRouteResponse;
};

export type FinanceHttpServerHandler = {
  handleServerHandlerRequest: (request: FinanceHttpServerHandlerRequest) => FinanceHttpServerHandlerResponse;
};

function stripOriginAndHash(url: string) {
  const [withoutHash = ''] = url.split('#');
  const originMatch = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(.*)$/i.exec(withoutHash);

  return originMatch ? originMatch[1] || '/' : withoutHash;
}

function normalizePathname(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function decodeQueryPart(value: string) {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function isQueryValueArray(
  value: FinanceHttpFrameworkRouteQueryValue
): value is readonly (boolean | number | string)[] {
  return Array.isArray(value);
}

function addQueryValue({
  key,
  query,
  value
}: {
  key: string;
  query: Record<string, FinanceHttpFrameworkRouteQueryValue>;
  value: string;
}) {
  const currentValue = query[key];

  if (currentValue === undefined) {
    query[key] = value;

    return;
  }

  if (isQueryValueArray(currentValue)) {
    query[key] = [...currentValue, value];

    return;
  }

  query[key] = [currentValue, value];
}

function parseHandlerUrl(url: string) {
  const localUrl = stripOriginAndHash(url);
  const [rawPathname = '/', rawQuery = ''] = localUrl.split('?');
  const pathname = normalizePathname(rawPathname || '/');
  const query: Record<string, FinanceHttpFrameworkRouteQueryValue> = {};

  rawQuery
    .split('&')
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey = '', rawValue = ''] = part.split('=');
      const key = decodeQueryPart(rawKey);

      if (!key) {
        return;
      }

      addQueryValue({
        key,
        query,
        value: decodeQueryPart(rawValue)
      });
    });

  return {
    pathname,
    query
  };
}

export function createFinanceHttpServerHandler({
  routeBinding
}: {
  routeBinding: FinanceHttpServerHandlerRouteBinding;
}): FinanceHttpServerHandler {
  return {
    handleServerHandlerRequest: (request) => {
      const parsedUrl = parseHandlerUrl(request.url);

      return routeBinding.handleFrameworkRouteRequest({
        bodyText: request.bodyText,
        headers: request.headers,
        method: request.method,
        pathname: parsedUrl.pathname,
        query: parsedUrl.query
      });
    }
  };
}
