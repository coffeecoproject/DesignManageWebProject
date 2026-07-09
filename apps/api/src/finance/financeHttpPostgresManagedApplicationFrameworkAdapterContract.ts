import type {
  FinanceHttpConcreteFrameworkAdapter,
  FinanceHttpConcreteFrameworkRequest,
  FinanceHttpConcreteFrameworkResponse,
  FinanceHttpConcreteFrameworkResponseWriter,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import type {
  FinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
  FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';

export type FinanceHttpPostgresManagedApplicationFrameworkRoute =
  | 'fallback-handler'
  | 'managed-source-mutation';

export type FinanceHttpPostgresManagedApplicationFrameworkTrace = {
  adapterKind: 'local_http_managed_postgres_application_framework_adapter_contract';
  delegatedToFallback: boolean;
  delegatedToManagedSourceMutation: boolean;
  fallbackHandled: boolean;
  frameworkName: string;
  handled: boolean;
  managedSourceMutationHandled: boolean;
  method: string;
  route: FinanceHttpPostgresManagedApplicationFrameworkRoute;
  url: string;
};

export type FinanceHttpPostgresManagedApplicationFrameworkResponse = {
  applicationTrace: FinanceHttpPostgresManagedApplicationFrameworkTrace;
  bodyText: string;
  handled: boolean;
  headers: Record<string, string>;
  selectedResponse:
    | FinanceHttpConcreteFrameworkResponse
    | FinanceHttpPostgresManagedSourceMutationFrameworkResponse;
  status: number;
};

export type FinanceHttpPostgresManagedApplicationFrameworkAdapter = {
  handleConcreteFrameworkRequest: (
    request: FinanceHttpConcreteFrameworkRequest,
  ) => Promise<FinanceHttpPostgresManagedApplicationFrameworkResponse>;
  writeConcreteFrameworkResponse: (
    writer: FinanceHttpConcreteFrameworkResponseWriter,
    response: FinanceHttpPostgresManagedApplicationFrameworkResponse,
  ) => void;
};

const APPLICATION_ROUTE_HEADER = 'x-finance-local-managed-application-framework-route';
const APPLICATION_HANDLED_HEADER = 'x-finance-local-managed-application-framework-handled';

function encodeQueryPart(value: boolean | number | string) {
  return encodeURIComponent(String(value));
}

function isQueryValueArray(
  value: NonNullable<FinanceHttpConcreteFrameworkRequest['query']>[string],
): value is readonly (boolean | number | string)[] {
  return Array.isArray(value);
}

function serializeQuery(query: FinanceHttpConcreteFrameworkRequest['query'] = {}) {
  const parts: string[] = [];

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;

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

function createApplicationHeaders({
  handled,
  headers,
  route,
}: {
  handled: boolean;
  headers: Record<string, string>;
  route: FinanceHttpPostgresManagedApplicationFrameworkRoute;
}) {
  return {
    ...headers,
    [APPLICATION_ROUTE_HEADER]: route,
    [APPLICATION_HANDLED_HEADER]: handled ? 'true' : 'false',
  };
}

function createManagedApplicationResponse({
  frameworkName,
  managedResponse,
  method,
  url,
}: {
  frameworkName: string;
  managedResponse: FinanceHttpPostgresManagedSourceMutationFrameworkResponse;
  method: string;
  url: string;
}): FinanceHttpPostgresManagedApplicationFrameworkResponse {
  return {
    applicationTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_adapter_contract',
      delegatedToFallback: false,
      delegatedToManagedSourceMutation: true,
      fallbackHandled: false,
      frameworkName,
      handled: managedResponse.handled,
      managedSourceMutationHandled: managedResponse.handled,
      method,
      route: 'managed-source-mutation',
      url,
    },
    bodyText: managedResponse.bodyText,
    handled: managedResponse.handled,
    headers: createApplicationHeaders({
      handled: managedResponse.handled,
      headers: managedResponse.headers,
      route: 'managed-source-mutation',
    }),
    selectedResponse: managedResponse,
    status: managedResponse.status,
  };
}

function createFallbackApplicationResponse({
  fallbackResponse,
  frameworkName,
  managedResponse,
  method,
  url,
}: {
  fallbackResponse: FinanceHttpConcreteFrameworkResponse;
  frameworkName: string;
  managedResponse: FinanceHttpPostgresManagedSourceMutationFrameworkResponse;
  method: string;
  url: string;
}): FinanceHttpPostgresManagedApplicationFrameworkResponse {
  return {
    applicationTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_adapter_contract',
      delegatedToFallback: true,
      delegatedToManagedSourceMutation: true,
      fallbackHandled: fallbackResponse.handled,
      frameworkName,
      handled: fallbackResponse.handled,
      managedSourceMutationHandled: managedResponse.handled,
      method,
      route: 'fallback-handler',
      url,
    },
    bodyText: fallbackResponse.bodyText,
    handled: fallbackResponse.handled,
    headers: createApplicationHeaders({
      handled: fallbackResponse.handled,
      headers: fallbackResponse.headers,
      route: 'fallback-handler',
    }),
    selectedResponse: fallbackResponse,
    status: fallbackResponse.status,
  };
}

export function createFinanceHttpPostgresManagedApplicationFrameworkAdapter({
  fallbackAdapter,
  frameworkName = 'local-managed-application-framework-contract',
  managedSourceMutationAdapter,
}: {
  fallbackAdapter: FinanceHttpConcreteFrameworkAdapter;
  frameworkName?: string;
  managedSourceMutationAdapter: FinanceHttpPostgresManagedSourceMutationFrameworkAdapter;
}): FinanceHttpPostgresManagedApplicationFrameworkAdapter {
  return {
    handleConcreteFrameworkRequest: async (request) => {
      const method = request.method ?? 'GET';
      const url = createUrl(request);
      const managedResponse = await managedSourceMutationAdapter.handleConcreteFrameworkRequest(request);

      if (managedResponse.handled) {
        return createManagedApplicationResponse({
          frameworkName,
          managedResponse,
          method,
          url,
        });
      }

      const fallbackResponse = fallbackAdapter.handleConcreteFrameworkRequest(request);

      return createFallbackApplicationResponse({
        fallbackResponse,
        frameworkName,
        managedResponse,
        method,
        url,
      });
    },
    writeConcreteFrameworkResponse: (writer, response) => {
      writer.status(response.status);
      Object.entries(response.headers).forEach(([name, value]) => {
        writer.setHeader(name, value);
      });
      writer.send(response.bodyText);
    },
  };
}

export function validateFinanceHttpPostgresManagedApplicationFrameworkTrace(
  response: FinanceHttpPostgresManagedApplicationFrameworkResponse,
) {
  const errors: string[] = [];

  if (response.applicationTrace.adapterKind !== 'local_http_managed_postgres_application_framework_adapter_contract') {
    errors.push('APPLICATION_TRACE_KIND_INVALID');
  }
  if (!response.applicationTrace.frameworkName) {
    errors.push('APPLICATION_TRACE_FRAMEWORK_NAME_REQUIRED');
  }
  if (!response.applicationTrace.method) {
    errors.push('APPLICATION_TRACE_METHOD_REQUIRED');
  }
  if (!response.applicationTrace.url.startsWith('/')) {
    errors.push('APPLICATION_TRACE_URL_MUST_BE_FRAMEWORK_PATH');
  }
  if (response.applicationTrace.handled !== response.handled) {
    errors.push('APPLICATION_TRACE_HANDLED_MISMATCH');
  }
  if (!response.applicationTrace.delegatedToManagedSourceMutation) {
    errors.push('APPLICATION_TRACE_MANAGED_DELEGATION_REQUIRED');
  }
  if (response.applicationTrace.route === 'managed-source-mutation' && response.applicationTrace.delegatedToFallback) {
    errors.push('APPLICATION_TRACE_MANAGED_ROUTE_MUST_NOT_FALLBACK');
  }
  if (response.applicationTrace.route === 'fallback-handler' && !response.applicationTrace.delegatedToFallback) {
    errors.push('APPLICATION_TRACE_FALLBACK_ROUTE_MUST_DELEGATE');
  }

  return { errors, ok: errors.length === 0 };
}
