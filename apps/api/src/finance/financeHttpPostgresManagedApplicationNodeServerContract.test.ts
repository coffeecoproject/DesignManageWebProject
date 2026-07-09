import { request as createNodeHttpRequest } from 'node:http';

import { createFinanceHttpPostgresManagedApplicationNodeServerContract } from './financeHttpPostgresManagedApplicationNodeServerContract.js';
import type { FinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import type {
  FinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
  FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void>;
};

type HttpClientResponse = {
  bodyText: string;
  headers: Record<string, string | readonly string[] | undefined>;
  status: number;
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(message);
  }
}

function parseBody(bodyText: string, message: string) {
  const body = JSON.parse(bodyText) as unknown;

  assertObject(body, message);

  return body;
}

function createManagedAdapterResponse({
  body,
  delegatedToServerEntry = false,
  handled,
  method,
  requestId = 'req-managed-application-test',
  status,
  url,
}: {
  body: Record<string, unknown>;
  delegatedToServerEntry?: boolean;
  handled: boolean;
  method: string;
  requestId?: string;
  status: number;
  url: string;
}): FinanceHttpPostgresManagedSourceMutationFrameworkResponse {
  return {
    adapterTrace: {
      adapterKind: 'local_http_managed_postgres_source_mutation_framework_adapter_contract',
      delegatedToServerEntry,
      frameworkName: 'managed-application-test',
      handled,
      method,
      requestId,
      url,
    },
    body,
    bodyText: JSON.stringify(body),
    handled,
    headers: JSON_HEADERS,
    sourceSqlRows: [],
    status,
    trace: [],
  };
}

function sendHttpRequest({
  bodyText,
  headers,
  method,
  origin,
  path,
}: {
  bodyText?: string;
  headers?: Record<string, string | undefined>;
  method: string;
  origin: string;
  path: string;
}) {
  return new Promise<HttpClientResponse>((resolve, reject) => {
    const clientRequest = createNodeHttpRequest(`${origin}${path}`, { headers, method }, (response) => {
      let responseBody = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        responseBody += String(chunk ?? '');
      });
      response.on('end', () => {
        resolve({
          bodyText: responseBody,
          headers: response.headers,
          status: response.statusCode ?? 0,
        });
      });
      response.on('error', (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });

    clientRequest.on('error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });

    if (bodyText) {
      clientRequest.write(bodyText);
    }

    clientRequest.end();
  });
}

function createManagedAdapter({
  handle,
}: {
  handle: FinanceHttpPostgresManagedSourceMutationFrameworkAdapter['handleConcreteFrameworkRequest'];
}): FinanceHttpPostgresManagedSourceMutationFrameworkAdapter {
  return {
    handleConcreteFrameworkRequest: handle,
    writeConcreteFrameworkResponse: () => undefined,
  };
}

const tests: UnitTest[] = [
  {
    name: 'delegates ordinary finance requests to fallback handler after managed source adapter declines',
    run: async () => {
      const managedRequests: { method?: string; url?: string }[] = [];
      const fallbackRequests: { method: string; url: string }[] = [];
      const managedSourceMutationAdapter = createManagedAdapter({
        handle: async (request) => {
          managedRequests.push({
            method: request.method,
            url: request.url,
          });

          return createManagedAdapterResponse({
            body: { code: 'NOT_SOURCE_MUTATION' },
            handled: false,
            method: request.method ?? 'GET',
            status: 404,
            url: request.url ?? '/',
          });
        },
      });
      const fallbackHandler: FinanceHttpServerHandler = {
        handleServerHandlerRequest: (request) => {
          fallbackRequests.push({
            method: request.method,
            url: request.url,
          });

          return {
            body: {
              handler: 'fallback',
              period: '2026-06',
            },
            bodyText: JSON.stringify({
              handler: 'fallback',
              period: '2026-06',
            }),
            handled: true,
            headers: JSON_HEADERS,
            status: 200,
          };
        },
      };
      const server = await createFinanceHttpPostgresManagedApplicationNodeServerContract({
        fallbackHandler,
        managedSourceMutationAdapter,
      }).listen();

      try {
        const response = await sendHttpRequest({
          method: 'GET',
          origin: server.origin,
          path: '/api/finance/accounting-periods/2026-06/close-checks?view=summary',
        });
        const body = parseBody(response.bodyText, 'fallback response body should parse');

        assertEqual(response.status, 200, 'ordinary finance request should return fallback status');
        assertEqual(body.handler, 'fallback', 'ordinary finance request should use fallback body');
        assertEqual(
          response.headers['x-finance-local-managed-application-server-route'],
          'fallback-handler',
          'ordinary finance request should be marked as fallback route',
        );
        assertEqual(
          response.headers['x-finance-local-managed-application-server-entry'],
          'framework-route-plugin',
          'ordinary finance request should enter through the route plugin',
        );
        assertEqual(
          response.headers['x-finance-local-managed-application-route-plugin-matched'],
          'true',
          'ordinary finance request should be matched by route plugin',
        );
        assertEqual(
          response.headers['x-finance-local-managed-application-server-handled'],
          'true',
          'ordinary finance request should preserve fallback handled status',
        );
        assertEqual(managedRequests.length, 1, 'ordinary finance request should still probe managed source adapter first');
        assertEqual(fallbackRequests.length, 1, 'ordinary finance request should call fallback exactly once');
        assertEqual(
          fallbackRequests[0]?.url,
          '/api/finance/accounting-periods/2026-06/close-checks?view=summary',
          'fallback should receive original URL and query',
        );
      } finally {
        await server.close();
      }
    },
  },
  {
    name: 'routes managed source mutation requests before fallback handler',
    run: async () => {
      let fallbackCallCount = 0;
      let capturedBodyText: string | undefined;
      let capturedAuthorization: string | readonly string[] | undefined;
      const managedSourceMutationAdapter = createManagedAdapter({
        handle: async (request) => {
          capturedBodyText = request.bodyText;
          capturedAuthorization = request.headers?.authorization;

          return createManagedAdapterResponse({
            body: {
              sourceId: 'rp-managed-app-001',
              status: '已调整',
            },
            delegatedToServerEntry: true,
            handled: true,
            method: request.method ?? 'PATCH',
            status: 200,
            url: request.url ?? '/',
          });
        },
      });
      const fallbackHandler: FinanceHttpServerHandler = {
        handleServerHandlerRequest: () => {
          fallbackCallCount += 1;

          return {
            body: { code: 'UNEXPECTED_FALLBACK' },
            bodyText: JSON.stringify({ code: 'UNEXPECTED_FALLBACK' }),
            handled: true,
            headers: JSON_HEADERS,
            status: 500,
          };
        },
      };
      const server = await createFinanceHttpPostgresManagedApplicationNodeServerContract({
        fallbackHandler,
        managedSourceMutationAdapter,
      }).listen();

      try {
        const response = await sendHttpRequest({
          bodyText: JSON.stringify({
            amount: '1300.00',
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06',
          }),
          headers: {
            authorization: 'Bearer managed-application-token',
            'content-type': 'application/json',
          },
          method: 'PATCH',
          origin: server.origin,
          path: '/api/finance/receivables-payables/rp-managed-app-001/adjust',
        });
        const body = parseBody(response.bodyText, 'managed response body should parse');

        assertEqual(response.status, 200, 'managed source mutation should return adapter status');
        assertEqual(body.sourceId, 'rp-managed-app-001', 'managed source mutation should return adapter body');
        assertEqual(
          response.headers['x-finance-local-managed-application-server-route'],
          'managed-source-mutation',
          'managed source mutation should be marked as managed route',
        );
        assertEqual(
          response.headers['x-finance-local-managed-application-server-entry'],
          'framework-route-plugin',
          'managed source mutation should enter through the route plugin',
        );
        assertEqual(
          response.headers['x-finance-local-managed-application-route-plugin-delegated'],
          'true',
          'managed source mutation should delegate from route plugin to application adapter',
        );
        assertEqual(fallbackCallCount, 0, 'managed source mutation should not call fallback handler');
        assertEqual(capturedAuthorization, 'Bearer managed-application-token', 'adapter should receive authorization header');
        assertEqual(
          capturedBodyText,
          JSON.stringify({
            amount: '1300.00',
            expectedVersion: 1,
            targetAccountingPeriod: '2026-06',
          }),
          'adapter should receive original body text',
        );
      } finally {
        await server.close();
      }
    },
  },
  {
    name: 'keeps non-finance requests outside the application route plugin delegation',
    run: async () => {
      let managedCallCount = 0;
      let fallbackCallCount = 0;
      const managedSourceMutationAdapter = createManagedAdapter({
        handle: async (request) => {
          managedCallCount += 1;

          return createManagedAdapterResponse({
            body: { code: 'NOT_SOURCE_MUTATION' },
            handled: false,
            method: request.method ?? 'GET',
            status: 404,
            url: request.url ?? '/',
          });
        },
      });
      const fallbackHandler: FinanceHttpServerHandler = {
        handleServerHandlerRequest: () => {
          fallbackCallCount += 1;

          return {
            body: { code: 'NOT_FOUND' },
            bodyText: JSON.stringify({ code: 'NOT_FOUND' }),
            handled: false,
            headers: JSON_HEADERS,
            status: 404,
          };
        },
      };
      const server = await createFinanceHttpPostgresManagedApplicationNodeServerContract({
        fallbackHandler,
        managedSourceMutationAdapter,
      }).listen();

      try {
        for (const method of ['GET', 'DELETE']) {
          const response = await sendHttpRequest({
            method,
            origin: server.origin,
            path: '/healthz',
          });
          const body = parseBody(response.bodyText, 'unhandled response body should parse');

          assertEqual(response.status, 404, `${method} non-finance request should return route-not-bound status`);
          assertEqual(
            body.code,
            'FINANCE_ROUTE_NOT_BOUND',
            `${method} non-finance request should return route-plugin boundary body`,
          );
          assertEqual(
            response.headers['x-finance-local-managed-application-server-route'],
            'route-plugin-unmatched',
            `${method} non-finance request should be stopped before application adapter delegation`,
          );
          assertEqual(
            response.headers['x-finance-local-managed-application-server-handled'],
            'false',
            `${method} unhandled request should not be reported as handled`,
          );
          assertEqual(
            response.headers['x-finance-local-managed-application-route-plugin-matched'],
            'false',
            `${method} non-finance request should be marked unmatched by route plugin`,
          );
        }

        assertEqual(managedCallCount, 0, 'non-finance request should not probe managed source adapter');
        assertEqual(fallbackCallCount, 0, 'non-finance request should not call fallback handler');
      } finally {
        await server.close();
      }
    },
  },
  {
    name: 'rejects unsupported finance methods at the registered route plugin host before adapters run',
    run: async () => {
      let managedCallCount = 0;
      let fallbackCallCount = 0;
      const managedSourceMutationAdapter = createManagedAdapter({
        handle: async (request) => {
          managedCallCount += 1;

          return createManagedAdapterResponse({
            body: { unexpectedMethod: request.method ?? '' },
            handled: true,
            method: request.method ?? 'DELETE',
            status: 200,
            url: request.url ?? '/',
          });
        },
      });
      const fallbackHandler: FinanceHttpServerHandler = {
        handleServerHandlerRequest: () => {
          fallbackCallCount += 1;

          return {
            body: { code: 'UNEXPECTED_FALLBACK' },
            bodyText: JSON.stringify({ code: 'UNEXPECTED_FALLBACK' }),
            handled: true,
            headers: JSON_HEADERS,
            status: 500,
          };
        },
      };
      const server = await createFinanceHttpPostgresManagedApplicationNodeServerContract({
        fallbackHandler,
        managedSourceMutationAdapter,
      }).listen();

      try {
        const response = await sendHttpRequest({
          method: 'DELETE',
          origin: server.origin,
          path: '/api/finance/accounting-periods/2026-06/close',
        });
        const body = parseBody(response.bodyText, 'method rejection response body should parse');

        assertEqual(response.status, 405, 'unsupported method should return route host method rejection');
        assertEqual(
          body.code,
          'FINANCE_APPLICATION_ROUTE_METHOD_NOT_ALLOWED',
          'unsupported method should return route-host method-not-allowed code',
        );
        assertEqual(
          response.headers['x-finance-local-managed-application-server-route'],
          'route-plugin-method-not-allowed',
          'unsupported method should not claim fallback or managed application route',
        );
        assertEqual(
          response.headers['x-finance-local-managed-application-route-plugin-delegated'],
          'false',
          'unsupported method should not delegate to application adapter',
        );
        assertEqual(managedCallCount, 0, 'unsupported method should not probe managed source adapter');
        assertEqual(fallbackCallCount, 0, 'unsupported method should not call fallback handler');
      } finally {
        await server.close();
      }
    },
  },
];

for (const test of tests) {
  await test.run();
}
