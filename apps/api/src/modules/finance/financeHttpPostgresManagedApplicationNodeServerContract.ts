import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  createFinanceHttpConcreteFrameworkAdapter,
  type FinanceHttpConcreteFrameworkResponseWriter,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import { createFinanceHttpPostgresManagedApplicationFrameworkAdapter } from './financeHttpPostgresManagedApplicationFrameworkAdapterContract.js';
import {
  createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin,
  type FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
  type FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration,
} from './financeHttpPostgresManagedApplicationFrameworkRoutePluginContract.js';
import type { FinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import type {
  FinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';

export type FinanceHttpPostgresManagedApplicationNodeServerHandle = {
  close: () => Promise<void>;
  origin: string;
};

export type FinanceHttpPostgresManagedApplicationNodeServerContract = {
  listen: (options?: {
    host?: string;
    port?: number;
  }) => Promise<FinanceHttpPostgresManagedApplicationNodeServerHandle>;
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

type CapturedFrameworkResponse = {
  bodyText?: string;
  headers: Record<string, string>;
  status?: number;
};

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let bodyText = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      bodyText += String(chunk ?? '');
    });
    request.on('end', () => resolve(bodyText));
    request.on('error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function getListeningPort(server: Server) {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Finance managed application local HTTP server did not expose a listening port.');
  }

  return address.port;
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve();
    });
  });
}

function writeHeaders(response: ServerResponse<IncomingMessage>, headers: Record<string, string>) {
  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
}

function writeErrorResponse({
  error,
  response,
}: {
  error: unknown;
  response: ServerResponse<IncomingMessage>;
}) {
  response.statusCode = 500;
  writeHeaders(response, JSON_HEADERS);
  response.setHeader('x-finance-local-managed-application-server-route', 'error');
  response.setHeader('x-finance-local-managed-application-server-handled', 'true');
  response.end(
    JSON.stringify({
      code: 'FINANCE_LOCAL_MANAGED_APPLICATION_HTTP_SERVER_ERROR',
      message: error instanceof Error ? error.message : '本地财务应用 HTTP 服务处理失败。',
    }),
  );
}

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

function createMethodNotAllowedResponse({
  method,
  routePrefix,
  url,
}: {
  method: string;
  routePrefix: string;
  url: string;
}): FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse {
  return {
    bodyText: JSON.stringify({
      code: 'FINANCE_APPLICATION_ROUTE_METHOD_NOT_ALLOWED',
      message: '财务应用路由插件不支持该请求方法。',
    }),
    handled: true,
    headers: {
      ...JSON_HEADERS,
      'x-finance-local-managed-application-route-plugin-delegated': 'false',
      'x-finance-local-managed-application-route-plugin-framework': 'local-managed-application-node-server-route-plugin-contract',
      'x-finance-local-managed-application-route-plugin-matched': 'true',
      'x-finance-local-managed-application-route-plugin-prefix': routePrefix,
    },
    pluginTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_route_plugin_contract',
      delegatedToApplicationAdapter: false,
      frameworkName: 'local-managed-application-node-server-route-plugin-contract',
      handled: true,
      matched: true,
      method,
      routePrefix,
      url,
    },
    status: 405,
  };
}

function writeRoutePluginServerResponse({
  captured,
  pluginResponse,
  response,
}: {
  captured: CapturedFrameworkResponse;
  pluginResponse: FinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse;
  response: ServerResponse<IncomingMessage>;
}) {
  const serverRoute =
    pluginResponse.pluginTrace.applicationRoute ??
    (pluginResponse.pluginTrace.matched ? 'route-plugin-method-not-allowed' : 'route-plugin-unmatched');

  response.statusCode = captured.status ?? pluginResponse.status;
  writeHeaders(response, Object.keys(captured.headers).length > 0 ? captured.headers : pluginResponse.headers);
  response.setHeader('x-finance-local-managed-application-server-route', serverRoute);
  response.setHeader('x-finance-local-managed-application-server-handled', pluginResponse.handled ? 'true' : 'false');
  response.setHeader('x-finance-local-managed-application-server-entry', 'framework-route-plugin');
  response.end(captured.bodyText ?? pluginResponse.bodyText);
}

function createApplicationRouteRegistration({
  fallbackHandler,
  managedSourceMutationAdapter,
}: {
  fallbackHandler: FinanceHttpServerHandler;
  managedSourceMutationAdapter: FinanceHttpPostgresManagedSourceMutationFrameworkAdapter;
}) {
  const fallbackAdapter = createFinanceHttpConcreteFrameworkAdapter({
    frameworkName: 'local-managed-application-node-server-fallback-framework-contract',
    handler: fallbackHandler,
  });
  const applicationAdapter = createFinanceHttpPostgresManagedApplicationFrameworkAdapter({
    fallbackAdapter,
    frameworkName: 'local-managed-application-node-server-framework-contract',
    managedSourceMutationAdapter,
  });
  const routePlugin = createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
    adapter: applicationAdapter,
    frameworkName: 'local-managed-application-node-server-route-plugin-contract',
  });
  const registrations: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration[] = [];

  routePlugin.register({
    registerRoute: (registration) => {
      registrations.push(registration);
    },
  });

  if (registrations.length !== 1 || !registrations[0]) {
    throw new Error('Finance managed application route plugin must register exactly one finance route.');
  }

  return registrations[0];
}

function normalizePathname(pathname: string) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function createPathname(url: string) {
  try {
    return normalizePathname(new URL(url, 'http://finance.local').pathname);
  } catch {
    return normalizePathname(url.split('?')[0] ?? '/');
  }
}

function isMatchedRoute(url: string, routePrefix: string) {
  const pathname = createPathname(url);

  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

function isMethodAllowed(method: string, registration: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration) {
  return registration.methods.includes(method.toUpperCase());
}

export function createFinanceHttpPostgresManagedApplicationNodeServerContract({
  fallbackHandler,
  managedSourceMutationAdapter,
}: {
  fallbackHandler: FinanceHttpServerHandler;
  managedSourceMutationAdapter: FinanceHttpPostgresManagedSourceMutationFrameworkAdapter;
}): FinanceHttpPostgresManagedApplicationNodeServerContract {
  const routeRegistration = createApplicationRouteRegistration({
    fallbackHandler,
    managedSourceMutationAdapter,
  });
  const server = createServer((request, response) => {
    void readBody(request)
      .then(async (bodyText) => {
        const method = request.method || 'GET';
        const url = request.url || '/';
        const { captured, writer } = createBufferedFrameworkWriter();
        const matchedRoute = isMatchedRoute(url, routeRegistration.routePrefix);
        const pluginResponse = matchedRoute && !isMethodAllowed(method, routeRegistration)
          ? createMethodNotAllowedResponse({
              method,
              routePrefix: routeRegistration.routePrefix,
              url,
            })
          : await routeRegistration.handler(
              {
                bodyText: bodyText || undefined,
                headers: request.headers,
                method,
                url,
              },
              writer,
            );

        writeRoutePluginServerResponse({
          captured,
          pluginResponse,
          response,
        });
      })
      .catch((error: unknown) => {
        writeErrorResponse({ error, response });
      });
  });

  return {
    listen: ({ host = '127.0.0.1', port = 0 } = {}) =>
      new Promise((resolve, reject) => {
        const handleError = (error?: Error) => {
          reject(error ?? new Error('Finance managed application local HTTP server failed to listen.'));
        };

        server.once('error', handleError);
        server.listen(port, host, () => {
          server.off('error', handleError);
          resolve({
            close: () => closeServer(server),
            origin: `http://${host}:${getListeningPort(server)}`,
          });
        });
      }),
  };
}
