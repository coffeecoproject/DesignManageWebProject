import type {
  FinanceHttpConcreteFrameworkRequest,
  FinanceHttpConcreteFrameworkResponseWriter,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import type {
  FinanceHttpPostgresManagedApplicationFrameworkAdapter,
  FinanceHttpPostgresManagedApplicationFrameworkResponse,
  FinanceHttpPostgresManagedApplicationFrameworkRoute,
} from './financeHttpPostgresManagedApplicationFrameworkAdapterContract.js';

export type FinanceHttpPostgresManagedApplicationFrameworkRoutePluginTrace = {
  adapterKind: 'local_http_managed_postgres_application_framework_route_plugin_contract';
  applicationRoute?: FinanceHttpPostgresManagedApplicationFrameworkRoute;
  delegatedToApplicationAdapter: boolean;
  frameworkName: string;
  handled: boolean;
  matched: boolean;
  method: string;
  routePrefix: string;
  url: string;
};

export type FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse = {
  applicationResponse?: FinanceHttpPostgresManagedApplicationFrameworkResponse;
  bodyText: string;
  handled: boolean;
  headers: Record<string, string>;
  pluginTrace: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginTrace;
  status: number;
};

export type FinanceHttpPostgresManagedApplicationFrameworkRoutePluginHandler = (
  request: FinanceHttpConcreteFrameworkRequest,
  writer: FinanceHttpConcreteFrameworkResponseWriter,
) => Promise<FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse>;

export type FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration = {
  frameworkName: string;
  handler: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginHandler;
  methods: readonly string[];
  routePrefix: string;
};

export type FinanceHttpPostgresManagedApplicationFrameworkRouteRegistry = {
  registerRoute: (registration: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration) => void;
};

export type FinanceHttpPostgresManagedApplicationFrameworkRoutePluginContract = {
  handleConcreteFrameworkRequest: (
    request: FinanceHttpConcreteFrameworkRequest,
  ) => Promise<FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse>;
  register: (
    registry: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistry,
  ) => FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration;
  writeConcreteFrameworkResponse: (
    writer: FinanceHttpConcreteFrameworkResponseWriter,
    response: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
  ) => void;
};

const FINANCE_ROUTE_PREFIX = '/api/finance';
const ROUTE_PLUGIN_DELEGATED_HEADER = 'x-finance-local-managed-application-route-plugin-delegated';
const ROUTE_PLUGIN_FRAMEWORK_HEADER = 'x-finance-local-managed-application-route-plugin-framework';
const ROUTE_PLUGIN_MATCHED_HEADER = 'x-finance-local-managed-application-route-plugin-matched';
const ROUTE_PLUGIN_PREFIX_HEADER = 'x-finance-local-managed-application-route-plugin-prefix';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function normalizePathname(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function normalizeRoutePrefix(routePrefix: string) {
  const normalized = normalizePathname(routePrefix.trim());

  return normalized.endsWith('/') && normalized.length > 1 ? normalized.slice(0, -1) : normalized;
}

function createRoutePluginHeaders({
  delegatedToApplicationAdapter,
  frameworkName,
  headers,
  matched,
  routePrefix,
}: {
  delegatedToApplicationAdapter: boolean;
  frameworkName: string;
  headers: Record<string, string>;
  matched: boolean;
  routePrefix: string;
}) {
  return {
    ...headers,
    [ROUTE_PLUGIN_FRAMEWORK_HEADER]: frameworkName,
    [ROUTE_PLUGIN_PREFIX_HEADER]: routePrefix,
    [ROUTE_PLUGIN_MATCHED_HEADER]: matched ? 'true' : 'false',
    [ROUTE_PLUGIN_DELEGATED_HEADER]: delegatedToApplicationAdapter ? 'true' : 'false',
  };
}

function createPathname(request: FinanceHttpConcreteFrameworkRequest) {
  const rawUrl = request.pathname ?? request.path ?? request.originalUrl ?? request.url ?? '/';

  try {
    return normalizePathname(new URL(rawUrl, 'http://finance.local').pathname);
  } catch {
    return normalizePathname(rawUrl.split('?')[0] ?? '/');
  }
}

function createUrl(request: FinanceHttpConcreteFrameworkRequest) {
  return request.originalUrl ?? request.url ?? request.pathname ?? request.path ?? '/';
}

function isMatchedFinanceRoute(request: FinanceHttpConcreteFrameworkRequest, routePrefix: string) {
  const pathname = createPathname(request);

  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

function createNotMatchedResponse({
  frameworkName,
  method,
  routePrefix,
  url,
}: {
  frameworkName: string;
  method: string;
  routePrefix: string;
  url: string;
}): FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse {
  return {
    bodyText: JSON.stringify({
      code: 'FINANCE_ROUTE_NOT_BOUND',
      message: '该请求不属于财务应用路由插件范围。',
    }),
    handled: false,
    headers: createRoutePluginHeaders({
      delegatedToApplicationAdapter: false,
      frameworkName,
      headers: JSON_HEADERS,
      matched: false,
      routePrefix,
    }),
    pluginTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_route_plugin_contract',
      delegatedToApplicationAdapter: false,
      frameworkName,
      handled: false,
      matched: false,
      method,
      routePrefix,
      url,
    },
    status: 404,
  };
}

function createMatchedResponse({
  applicationResponse,
  frameworkName,
  method,
  routePrefix,
  url,
}: {
  applicationResponse: FinanceHttpPostgresManagedApplicationFrameworkResponse;
  frameworkName: string;
  method: string;
  routePrefix: string;
  url: string;
}): FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse {
  return {
    applicationResponse,
    bodyText: applicationResponse.bodyText,
    handled: applicationResponse.handled,
    headers: createRoutePluginHeaders({
      delegatedToApplicationAdapter: true,
      frameworkName,
      headers: applicationResponse.headers,
      matched: true,
      routePrefix,
    }),
    pluginTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_route_plugin_contract',
      applicationRoute: applicationResponse.applicationTrace.route,
      delegatedToApplicationAdapter: true,
      frameworkName,
      handled: applicationResponse.handled,
      matched: true,
      method,
      routePrefix,
      url,
    },
    status: applicationResponse.status,
  };
}

function assertValidRoutePluginPrefix(routePrefix: string) {
  const normalized = normalizeRoutePrefix(routePrefix);

  if (normalized !== FINANCE_ROUTE_PREFIX) {
    throw new Error(`FINANCE_APPLICATION_ROUTE_PLUGIN_PREFIX_INVALID:${routePrefix}`);
  }

  return normalized;
}

function normalizeMethods(methods: readonly string[]) {
  return methods.map((method) => method.toUpperCase());
}

export function createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
  adapter,
  frameworkName = 'local-managed-application-framework-route-plugin-contract',
  methods = ['GET', 'PATCH', 'POST'],
  routePrefix = FINANCE_ROUTE_PREFIX,
}: {
  adapter: FinanceHttpPostgresManagedApplicationFrameworkAdapter;
  frameworkName?: string;
  methods?: readonly string[];
  routePrefix?: string;
}): FinanceHttpPostgresManagedApplicationFrameworkRoutePluginContract {
  const normalizedRoutePrefix = assertValidRoutePluginPrefix(routePrefix);
  const normalizedMethods = normalizeMethods(methods);

  const writeConcreteFrameworkResponse = (
    writer: FinanceHttpConcreteFrameworkResponseWriter,
    response: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
  ) => {
    writer.status(response.status);
    Object.entries(response.headers).forEach(([name, value]) => {
      writer.setHeader(name, value);
    });
    writer.send(response.bodyText);
  };

  const handleConcreteFrameworkRequest = async (
    request: FinanceHttpConcreteFrameworkRequest,
  ): Promise<FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse> => {
    const method = request.method ?? 'GET';
    const url = createUrl(request);

    if (!isMatchedFinanceRoute(request, normalizedRoutePrefix)) {
      return createNotMatchedResponse({
        frameworkName,
        method,
        routePrefix: normalizedRoutePrefix,
        url,
      });
    }

    return createMatchedResponse({
      applicationResponse: await adapter.handleConcreteFrameworkRequest(request),
      frameworkName,
      method,
      routePrefix: normalizedRoutePrefix,
      url,
    });
  };

  return {
    handleConcreteFrameworkRequest,
    register: (registry) => {
      const registration: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration = {
        frameworkName,
        handler: async (request, writer) => {
          const response = await handleConcreteFrameworkRequest(request);

          writeConcreteFrameworkResponse(writer, response);

          return response;
        },
        methods: normalizedMethods,
        routePrefix: normalizedRoutePrefix,
      };

      registry.registerRoute(registration);

      return registration;
    },
    writeConcreteFrameworkResponse,
  };
}

export function validateFinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse(
  response: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
) {
  const errors: string[] = [];

  if (response.pluginTrace.adapterKind !== 'local_http_managed_postgres_application_framework_route_plugin_contract') {
    errors.push('ROUTE_PLUGIN_TRACE_KIND_INVALID');
  }
  if (response.pluginTrace.routePrefix !== FINANCE_ROUTE_PREFIX) {
    errors.push('ROUTE_PLUGIN_PREFIX_INVALID');
  }
  if (response.pluginTrace.handled !== response.handled) {
    errors.push('ROUTE_PLUGIN_HANDLED_MISMATCH');
  }
  if (response.pluginTrace.delegatedToApplicationAdapter !== Boolean(response.applicationResponse)) {
    errors.push('ROUTE_PLUGIN_DELEGATION_MISMATCH');
  }
  if (response.pluginTrace.matched && !response.applicationResponse) {
    errors.push('ROUTE_PLUGIN_MATCHED_RESPONSE_REQUIRED');
  }
  if (!response.pluginTrace.matched && response.applicationResponse) {
    errors.push('ROUTE_PLUGIN_UNMATCHED_MUST_NOT_HAVE_APPLICATION_RESPONSE');
  }

  return { errors, ok: errors.length === 0 };
}
