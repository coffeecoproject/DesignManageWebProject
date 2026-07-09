import {
  createFinanceHttpConcreteFrameworkAdapter,
  type FinanceHttpConcreteFrameworkRequest,
  type FinanceHttpConcreteFrameworkResponseWriter,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import { createFinanceHttpPostgresManagedApplicationFrameworkAdapter } from './financeHttpPostgresManagedApplicationFrameworkAdapterContract.js';
import {
  createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin,
  type FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
  type FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration,
} from './financeHttpPostgresManagedApplicationFrameworkRoutePluginContract.js';
import type { FinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import type { FinanceHttpPostgresManagedSourceMutationFrameworkAdapter } from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';

export type FinanceHttpPostgresManagedProjectApiServerRouteSource =
  'managed-application-framework-route-plugin';

export type FinanceHttpPostgresManagedProjectApiServerRouteSummary = {
  frameworkName: string;
  methods: readonly string[];
  routePrefix: string;
  source: FinanceHttpPostgresManagedProjectApiServerRouteSource;
};

export type FinanceHttpPostgresManagedProjectApiServerWiringSummary = {
  directFinanceHandlerRegistered: boolean;
  frameworkName: string;
  middlewareOrder: readonly string[];
  productionServerBound: boolean;
  routes: readonly FinanceHttpPostgresManagedProjectApiServerRouteSummary[];
};

export type FinanceHttpPostgresManagedProjectApiServerTrace = {
  adapterKind: 'local_http_managed_postgres_project_api_server_wiring_contract';
  delegatedToRoutePlugin: boolean;
  directFinanceHandlerRegistered: boolean;
  frameworkName: string;
  handled: boolean;
  method: string;
  methodAllowed: boolean;
  productionServerBound: boolean;
  routeMatched: boolean;
  routePrefix: string;
  url: string;
};

export type FinanceHttpPostgresManagedProjectApiServerResponse =
  FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse & {
    projectServerTrace: FinanceHttpPostgresManagedProjectApiServerTrace;
  };

export type FinanceHttpPostgresManagedProjectApiServerWiringContract = {
  getWiringSummary: () => FinanceHttpPostgresManagedProjectApiServerWiringSummary;
  handleConcreteFrameworkRequest: (
    request: FinanceHttpConcreteFrameworkRequest,
    writer?: FinanceHttpConcreteFrameworkResponseWriter,
  ) => Promise<FinanceHttpPostgresManagedProjectApiServerResponse>;
};

const FINANCE_ROUTE_PREFIX = '/api/finance';
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};
const PROJECT_SERVER_ENTRY_HEADER = 'x-finance-local-project-api-server-entry';
const PROJECT_SERVER_METHOD_GUARD_HEADER = 'x-finance-local-project-api-server-method-guard';
const PROJECT_SERVER_PRODUCTION_BOUND_HEADER = 'x-finance-local-project-api-server-production-bound';

const expectedMiddlewareOrder = [
  'project-server-route-registry',
  'framework-route-prefix-match',
  'framework-method-guard',
  'managed-application-framework-route-plugin',
  'managed-application-framework-adapter',
  'managed-source-mutation-first',
  'ordinary-finance-fallback-handler',
] as const;

type CapturedFrameworkResponse = {
  bodyText?: string;
  headers: Record<string, string>;
  status?: number;
};

function createBufferedFrameworkWriter() {
  const captured: CapturedFrameworkResponse = {
    headers: {},
  };
  const writer: FinanceHttpConcreteFrameworkResponseWriter = {
    send: (bodyText) => {
      captured.bodyText = bodyText;
    },
    setHeader: (name, value) => {
      captured.headers[name] = value;
    },
    status: (status) => {
      captured.status = status;

      return writer;
    },
  };

  return { captured, writer };
}

function normalizePathname(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function createRequestUrl(request: FinanceHttpConcreteFrameworkRequest) {
  return request.originalUrl ?? request.url ?? request.pathname ?? request.path ?? '/';
}

function createPathname(request: FinanceHttpConcreteFrameworkRequest) {
  const rawUrl = createRequestUrl(request);

  try {
    return normalizePathname(new URL(rawUrl, 'http://finance.local').pathname);
  } catch {
    return normalizePathname(rawUrl.split('?')[0] ?? '/');
  }
}

function isMatchedRoute(request: FinanceHttpConcreteFrameworkRequest, routePrefix: string) {
  const pathname = createPathname(request);

  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

function isMethodAllowed(method: string, registration: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration) {
  return registration.methods.includes(method.toUpperCase());
}

function createMethodNotAllowedResponse({
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
      code: 'FINANCE_PROJECT_API_SERVER_METHOD_NOT_ALLOWED',
      message: '财务项目 API server 注册路由不支持该请求方法。',
    }),
    handled: true,
    headers: {
      ...JSON_HEADERS,
      'x-finance-local-managed-application-route-plugin-delegated': 'false',
      'x-finance-local-managed-application-route-plugin-framework': frameworkName,
      'x-finance-local-managed-application-route-plugin-matched': 'true',
      'x-finance-local-managed-application-route-plugin-prefix': routePrefix,
    },
    pluginTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_route_plugin_contract',
      delegatedToApplicationAdapter: false,
      frameworkName,
      handled: true,
      matched: true,
      method,
      routePrefix,
      url,
    },
    status: 405,
  };
}

function addProjectHeaders(
  response: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
  methodGuard: 'not_applicable' | 'passed' | 'rejected',
) {
  return {
    ...response,
    headers: {
      ...response.headers,
      [PROJECT_SERVER_ENTRY_HEADER]: 'framework-route-plugin',
      [PROJECT_SERVER_METHOD_GUARD_HEADER]: methodGuard,
      [PROJECT_SERVER_PRODUCTION_BOUND_HEADER]: 'false',
    },
  };
}

function createProjectServerResponse({
  delegatedToRoutePlugin,
  frameworkName,
  methodAllowed,
  pluginResponse,
  routeMatched,
  routePrefix,
  url,
}: {
  delegatedToRoutePlugin: boolean;
  frameworkName: string;
  methodAllowed: boolean;
  pluginResponse: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse;
  routeMatched: boolean;
  routePrefix: string;
  url: string;
}): FinanceHttpPostgresManagedProjectApiServerResponse {
  return {
    ...pluginResponse,
    projectServerTrace: {
      adapterKind: 'local_http_managed_postgres_project_api_server_wiring_contract',
      delegatedToRoutePlugin,
      directFinanceHandlerRegistered: false,
      frameworkName,
      handled: pluginResponse.handled,
      method: pluginResponse.pluginTrace.method,
      methodAllowed,
      productionServerBound: false,
      routeMatched,
      routePrefix,
      url,
    },
  };
}

function writeFrameworkResponse(
  writer: FinanceHttpConcreteFrameworkResponseWriter,
  response: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
) {
  writer.status(response.status);
  Object.entries(response.headers).forEach(([name, value]) => {
    writer.setHeader(name, value);
  });
  writer.send(response.bodyText);
}

function createWiringSummary({
  frameworkName,
  registration,
}: {
  frameworkName: string;
  registration: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration;
}): FinanceHttpPostgresManagedProjectApiServerWiringSummary {
  return {
    directFinanceHandlerRegistered: false,
    frameworkName,
    middlewareOrder: expectedMiddlewareOrder,
    productionServerBound: false,
    routes: [
      {
        frameworkName: registration.frameworkName,
        methods: registration.methods,
        routePrefix: registration.routePrefix,
        source: 'managed-application-framework-route-plugin',
      },
    ],
  };
}

export function validateFinanceHttpPostgresManagedProjectApiServerWiringSummary(
  summary: FinanceHttpPostgresManagedProjectApiServerWiringSummary,
) {
  const errors: string[] = [];
  const route = summary.routes[0];

  if (summary.productionServerBound) {
    errors.push('PROJECT_API_SERVER_MUST_NOT_BIND_PRODUCTION_SERVER');
  }
  if (summary.directFinanceHandlerRegistered) {
    errors.push('PROJECT_API_SERVER_DIRECT_FINANCE_HANDLER_FORBIDDEN');
  }
  if (summary.routes.length !== 1 || !route) {
    errors.push('PROJECT_API_SERVER_ROUTE_COUNT_INVALID');
  }
  if (route && route.routePrefix !== FINANCE_ROUTE_PREFIX) {
    errors.push('PROJECT_API_SERVER_ROUTE_PREFIX_INVALID');
  }
  if (route && route.source !== 'managed-application-framework-route-plugin') {
    errors.push('PROJECT_API_SERVER_ROUTE_SOURCE_INVALID');
  }
  if (route && route.methods.join(',') !== 'GET,PATCH,POST') {
    errors.push('PROJECT_API_SERVER_ROUTE_METHODS_INVALID');
  }
  if (summary.middlewareOrder.join('>') !== expectedMiddlewareOrder.join('>')) {
    errors.push('PROJECT_API_SERVER_MIDDLEWARE_ORDER_INVALID');
  }

  return {
    errors,
    ok: errors.length === 0,
  };
}

export function createFinanceHttpPostgresManagedProjectApiServerWiringContract({
  fallbackHandler,
  frameworkName = 'local-managed-postgres-project-api-server-wiring-contract',
  managedSourceMutationAdapter,
}: {
  fallbackHandler: FinanceHttpServerHandler;
  frameworkName?: string;
  managedSourceMutationAdapter: FinanceHttpPostgresManagedSourceMutationFrameworkAdapter;
}): FinanceHttpPostgresManagedProjectApiServerWiringContract {
  const fallbackAdapter = createFinanceHttpConcreteFrameworkAdapter({
    frameworkName: `${frameworkName}-fallback-framework`,
    handler: fallbackHandler,
  });
  const applicationAdapter = createFinanceHttpPostgresManagedApplicationFrameworkAdapter({
    fallbackAdapter,
    frameworkName: `${frameworkName}-application-framework`,
    managedSourceMutationAdapter,
  });
  const routePlugin = createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
    adapter: applicationAdapter,
    frameworkName,
  });
  const registrations: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration[] = [];
  const registration = routePlugin.register({
    registerRoute: (routeRegistration) => {
      registrations.push(routeRegistration);
    },
  });
  const summary = createWiringSummary({
    frameworkName,
    registration,
  });
  const validation = validateFinanceHttpPostgresManagedProjectApiServerWiringSummary(summary);

  if (registrations.length !== 1 || !validation.ok) {
    throw new Error(`FINANCE_PROJECT_API_SERVER_WIRING_INVALID:${validation.errors.join(',')}`);
  }

  return {
    getWiringSummary: () => ({
      ...summary,
      routes: summary.routes.map((route) => ({
        ...route,
        methods: [...route.methods],
      })),
    }),
    handleConcreteFrameworkRequest: async (request, externalWriter) => {
      const method = request.method ?? 'GET';
      const url = createRequestUrl(request);
      const routeMatched = isMatchedRoute(request, registration.routePrefix);
      const methodAllowed = routeMatched ? isMethodAllowed(method, registration) : true;
      const response = methodAllowed
        ? addProjectHeaders(
            await routePlugin.handleConcreteFrameworkRequest(request),
            routeMatched ? 'passed' : 'not_applicable',
          )
        : addProjectHeaders(
            createMethodNotAllowedResponse({
              frameworkName,
              method,
              routePrefix: registration.routePrefix,
              url,
            }),
            'rejected',
          );
      const { captured, writer } = createBufferedFrameworkWriter();
      const responseWriter = externalWriter ?? writer;

      writeFrameworkResponse(responseWriter, response);

      return createProjectServerResponse({
        delegatedToRoutePlugin: methodAllowed,
        frameworkName,
        methodAllowed,
        pluginResponse: {
          ...response,
          bodyText: externalWriter ? response.bodyText : captured.bodyText ?? response.bodyText,
          headers: externalWriter || Object.keys(captured.headers).length === 0 ? response.headers : captured.headers,
          status: externalWriter ? response.status : captured.status ?? response.status,
        },
        routeMatched,
        routePrefix: registration.routePrefix,
        url,
      });
    },
  };
}
