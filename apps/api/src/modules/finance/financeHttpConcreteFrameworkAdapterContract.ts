import type { FinanceHttpFrameworkRouteQueryValue } from './financeHttpFrameworkRouteBindingContract.js';
import type {
  FinanceHttpServerHandler,
  FinanceHttpServerHandlerRequest,
  FinanceHttpServerHandlerResponse
} from './financeHttpServerHandlerContract.js';

export type FinanceHttpConcreteFrameworkRequest = {
  body?: unknown;
  bodyText?: string;
  headers?: Record<string, string | readonly string[] | undefined>;
  method?: string;
  originalUrl?: string;
  path?: string;
  pathname?: string;
  query?: Record<string, FinanceHttpFrameworkRouteQueryValue>;
  url?: string;
};

export type FinanceHttpConcreteFrameworkResponseWriter = {
  send: (bodyText: string) => void;
  setHeader: (name: string, value: string) => void;
  status: (status: number) => FinanceHttpConcreteFrameworkResponseWriter | void;
};

export type FinanceHttpConcreteFrameworkResponse = FinanceHttpServerHandlerResponse & {
  adapterTrace: {
    adapterKind: 'local_concrete_framework_adapter_contract';
    frameworkName: string;
    handled: boolean;
    method: string;
    url: string;
  };
};

export type FinanceHttpConcreteFrameworkAdapter = {
  handleConcreteFrameworkRequest: (
    request: FinanceHttpConcreteFrameworkRequest
  ) => FinanceHttpConcreteFrameworkResponse;
  writeConcreteFrameworkResponse: (
    writer: FinanceHttpConcreteFrameworkResponseWriter,
    response: FinanceHttpConcreteFrameworkResponse
  ) => void;
};

function encodeQueryPart(value: boolean | number | string) {
  return encodeURIComponent(String(value));
}

function isQueryValueArray(
  value: FinanceHttpFrameworkRouteQueryValue
): value is readonly (boolean | number | string)[] {
  return Array.isArray(value);
}

function serializeQuery(query: FinanceHttpConcreteFrameworkRequest['query'] = {}) {
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

function normalizePathname(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function createUrl(request: FinanceHttpConcreteFrameworkRequest) {
  const frameworkUrl = request.originalUrl ?? request.url;

  if (frameworkUrl) {
    return frameworkUrl.includes('?') ? frameworkUrl : `${frameworkUrl}${serializeQuery(request.query)}`;
  }

  return `${normalizePathname(request.pathname ?? request.path ?? '/')}${serializeQuery(request.query)}`;
}

function createBodyText(request: FinanceHttpConcreteFrameworkRequest) {
  if (request.bodyText !== undefined) {
    return request.bodyText;
  }

  if (request.body === undefined) {
    return undefined;
  }

  if (typeof request.body === 'string') {
    return request.body;
  }

  return JSON.stringify(request.body);
}

function createServerHandlerRequest(request: FinanceHttpConcreteFrameworkRequest): FinanceHttpServerHandlerRequest {
  return {
    bodyText: createBodyText(request),
    headers: request.headers,
    method: request.method ?? 'GET',
    url: createUrl(request)
  };
}

export function createFinanceHttpConcreteFrameworkAdapter({
  frameworkName = 'local-framework-contract',
  handler
}: {
  frameworkName?: string;
  handler: FinanceHttpServerHandler;
}): FinanceHttpConcreteFrameworkAdapter {
  return {
    handleConcreteFrameworkRequest: (request) => {
      const serverRequest = createServerHandlerRequest(request);
      const response = handler.handleServerHandlerRequest(serverRequest);

      return {
        ...response,
        adapterTrace: {
          adapterKind: 'local_concrete_framework_adapter_contract',
          frameworkName,
          handled: response.handled,
          method: serverRequest.method,
          url: serverRequest.url
        }
      };
    },
    writeConcreteFrameworkResponse: (writer, response) => {
      writer.status(response.status);
      Object.entries(response.headers).forEach(([name, value]) => {
        writer.setHeader(name, value);
      });
      writer.send(response.bodyText);
    }
  };
}
