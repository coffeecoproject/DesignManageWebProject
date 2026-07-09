import {
  createFinanceHttpPostgresManagedProjectApiServerWiringContract,
  validateFinanceHttpPostgresManagedProjectApiServerWiringSummary,
} from './financeHttpPostgresManagedProjectApiServerWiringContract.js';
import type { FinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import type {
  FinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
  FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

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
  status,
  url,
}: {
  body: Record<string, unknown>;
  delegatedToServerEntry?: boolean;
  handled: boolean;
  method: string;
  status: number;
  url: string;
}): FinanceHttpPostgresManagedSourceMutationFrameworkResponse {
  return {
    adapterTrace: {
      adapterKind: 'local_http_managed_postgres_source_mutation_framework_adapter_contract',
      delegatedToServerEntry,
      frameworkName: 'project-api-server-wiring-test-managed-source',
      handled,
      method,
      requestId: 'req-project-api-server-wiring-test',
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

function createFallbackHandler(
  handle: FinanceHttpServerHandler['handleServerHandlerRequest'],
): FinanceHttpServerHandler {
  return {
    handleServerHandlerRequest: handle,
  };
}

const tests: UnitTest[] = [
  {
    name: 'registers one finance route through the managed application route plugin and forbids direct finance handlers',
    run: () => {
      const contract = createFinanceHttpPostgresManagedProjectApiServerWiringContract({
        fallbackHandler: createFallbackHandler(() => ({
          body: { code: 'OK' },
          bodyText: JSON.stringify({ code: 'OK' }),
          handled: true,
          headers: JSON_HEADERS,
          status: 200,
        })),
        managedSourceMutationAdapter: createManagedAdapter({
          handle: async (request) =>
            createManagedAdapterResponse({
              body: { code: 'NOT_SOURCE_MUTATION' },
              handled: false,
              method: request.method ?? 'GET',
              status: 404,
              url: request.url ?? '/',
            }),
        }),
      });
      const summary = contract.getWiringSummary();
      const validation = validateFinanceHttpPostgresManagedProjectApiServerWiringSummary(summary);

      assert(validation.ok, `Project API server wiring should validate: ${validation.errors.join(',')}`);
      assertEqual(summary.productionServerBound, false, 'Project wiring contract must not bind a production server');
      assertEqual(
        summary.directFinanceHandlerRegistered,
        false,
        'Project wiring contract must not register a direct finance handler beside the route plugin',
      );
      assertEqual(summary.routes.length, 1, 'Project wiring should expose exactly one finance route');
      assertEqual(summary.routes[0]?.routePrefix, '/api/finance', 'Project wiring should bind finance prefix only');
      assertEqual(
        summary.routes[0]?.source,
        'managed-application-framework-route-plugin',
        'Project wiring should source the route from the managed application route plugin',
      );
      assertEqual(summary.routes[0]?.methods.join(','), 'GET,PATCH,POST', 'Project wiring should keep finance methods');
      assertEqual(
        summary.middlewareOrder.join('>'),
        [
          'project-server-route-registry',
          'framework-route-prefix-match',
          'framework-method-guard',
          'managed-application-framework-route-plugin',
          'managed-application-framework-adapter',
          'managed-source-mutation-first',
          'ordinary-finance-fallback-handler',
        ].join('>'),
        'Project wiring should preserve the route-plugin-first server order',
      );
    },
  },
  {
    name: 'delegates ordinary finance framework requests through the route plugin before fallback handling',
    run: async () => {
      const managedRequests: { method?: string; url?: string }[] = [];
      const fallbackRequests: { method: string; url: string }[] = [];
      const contract = createFinanceHttpPostgresManagedProjectApiServerWiringContract({
        fallbackHandler: createFallbackHandler((request) => {
          fallbackRequests.push({
            method: request.method,
            url: request.url,
          });

          return {
            body: { handler: 'fallback', period: '2026-06' },
            bodyText: JSON.stringify({ handler: 'fallback', period: '2026-06' }),
            handled: true,
            headers: JSON_HEADERS,
            status: 200,
          };
        }),
        managedSourceMutationAdapter: createManagedAdapter({
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
        }),
      });
      const response = await contract.handleConcreteFrameworkRequest({
        method: 'GET',
        originalUrl: '/api/finance/accounting-periods/2026-06/close-checks?includeSources=true',
      });
      const body = parseBody(response.bodyText, 'ordinary finance response body should parse');

      assertEqual(response.status, 200, 'Ordinary finance request should return fallback status');
      assertEqual(body.handler, 'fallback', 'Ordinary finance request should be handled by fallback after managed decline');
      assertEqual(managedRequests.length, 1, 'Managed source adapter should be probed first');
      assertEqual(fallbackRequests.length, 1, 'Fallback handler should handle ordinary finance request');
      assertEqual(
        response.headers['x-finance-local-project-api-server-entry'],
        'framework-route-plugin',
        'Project server should expose route-plugin entry provenance',
      );
      assertEqual(
        response.headers['x-finance-local-project-api-server-production-bound'],
        'false',
        'Project wiring should not claim production server binding',
      );
      assertEqual(
        response.headers['x-finance-local-managed-application-route-plugin-matched'],
        'true',
        'Route plugin should match the finance request',
      );
      assertEqual(
        response.headers['x-finance-local-managed-application-framework-route'],
        'fallback-handler',
        'Application adapter should preserve fallback route provenance',
      );
      assertEqual(response.projectServerTrace.delegatedToRoutePlugin, true, 'Project server should delegate to plugin');
      assertEqual(response.projectServerTrace.routeMatched, true, 'Project trace should mark finance route matched');
      assertEqual(response.projectServerTrace.methodAllowed, true, 'Project trace should mark finance method allowed');
    },
  },
  {
    name: 'keeps managed source mutation ahead of fallback under the project route plugin wiring',
    run: async () => {
      let fallbackCallCount = 0;
      const contract = createFinanceHttpPostgresManagedProjectApiServerWiringContract({
        fallbackHandler: createFallbackHandler(() => {
          fallbackCallCount += 1;

          return {
            body: { code: 'UNEXPECTED_FALLBACK' },
            bodyText: JSON.stringify({ code: 'UNEXPECTED_FALLBACK' }),
            handled: true,
            headers: JSON_HEADERS,
            status: 500,
          };
        }),
        managedSourceMutationAdapter: createManagedAdapter({
          handle: async (request) =>
            createManagedAdapterResponse({
              body: { handler: 'managed-source-mutation', requestUrl: request.url ?? '/' },
              delegatedToServerEntry: true,
              handled: true,
              method: request.method ?? 'PATCH',
              status: 202,
              url: request.url ?? '/',
            }),
        }),
      });
      const response = await contract.handleConcreteFrameworkRequest({
        body: { amount: '12800.00', expectedVersion: 1 },
        method: 'PATCH',
        url: '/api/finance/receivables-payables/rp-001',
      });
      const body = parseBody(response.bodyText, 'managed source response body should parse');

      assertEqual(response.status, 202, 'Managed source request should keep managed adapter status');
      assertEqual(body.handler, 'managed-source-mutation', 'Managed source adapter should handle source mutation');
      assertEqual(fallbackCallCount, 0, 'Fallback handler should not run after managed source handles request');
      assertEqual(
        response.headers['x-finance-local-managed-application-framework-route'],
        'managed-source-mutation',
        'Application adapter should preserve managed source route provenance',
      );
      assertEqual(response.projectServerTrace.delegatedToRoutePlugin, true, 'Source mutation should delegate to plugin');
    },
  },
  {
    name: 'rejects unsupported finance methods at project server method guard before adapters run',
    run: async () => {
      let managedCallCount = 0;
      let fallbackCallCount = 0;
      const contract = createFinanceHttpPostgresManagedProjectApiServerWiringContract({
        fallbackHandler: createFallbackHandler(() => {
          fallbackCallCount += 1;

          return {
            body: { code: 'UNEXPECTED_FALLBACK' },
            bodyText: JSON.stringify({ code: 'UNEXPECTED_FALLBACK' }),
            handled: true,
            headers: JSON_HEADERS,
            status: 500,
          };
        }),
        managedSourceMutationAdapter: createManagedAdapter({
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
        }),
      });
      const response = await contract.handleConcreteFrameworkRequest({
        method: 'DELETE',
        url: '/api/finance/accounting-periods/2026-06/close',
      });
      const body = parseBody(response.bodyText, 'method guard response body should parse');

      assertEqual(response.status, 405, 'Unsupported finance method should be rejected by project server guard');
      assertEqual(
        body.code,
        'FINANCE_PROJECT_API_SERVER_METHOD_NOT_ALLOWED',
        'Unsupported method should return project server method guard code',
      );
      assertEqual(managedCallCount, 0, 'Unsupported finance method should not probe managed source adapter');
      assertEqual(fallbackCallCount, 0, 'Unsupported finance method should not call fallback handler');
      assertEqual(
        response.headers['x-finance-local-project-api-server-method-guard'],
        'rejected',
        'Project server should expose rejected method guard provenance',
      );
      assertEqual(response.projectServerTrace.delegatedToRoutePlugin, false, 'Method guard should stop before plugin');
      assertEqual(response.projectServerTrace.methodAllowed, false, 'Project trace should mark method disallowed');
    },
  },
  {
    name: 'does not apply finance method guard to unmatched non-finance routes',
    run: async () => {
      let managedCallCount = 0;
      let fallbackCallCount = 0;
      const contract = createFinanceHttpPostgresManagedProjectApiServerWiringContract({
        fallbackHandler: createFallbackHandler(() => {
          fallbackCallCount += 1;

          return {
            body: { code: 'UNEXPECTED_FALLBACK' },
            bodyText: JSON.stringify({ code: 'UNEXPECTED_FALLBACK' }),
            handled: true,
            headers: JSON_HEADERS,
            status: 500,
          };
        }),
        managedSourceMutationAdapter: createManagedAdapter({
          handle: async (request) => {
            managedCallCount += 1;

            return createManagedAdapterResponse({
              body: { unexpectedUrl: request.url ?? '' },
              handled: true,
              method: request.method ?? 'DELETE',
              status: 200,
              url: request.url ?? '/',
            });
          },
        }),
      });
      const response = await contract.handleConcreteFrameworkRequest({
        method: 'DELETE',
        url: '/healthz',
      });
      const body = parseBody(response.bodyText, 'unmatched route response body should parse');

      assertEqual(response.status, 404, 'Unmatched route should remain route-plugin unmatched');
      assertEqual(body.code, 'FINANCE_ROUTE_NOT_BOUND', 'Unmatched route should return route-not-bound code');
      assertEqual(managedCallCount, 0, 'Unmatched route should not probe managed source adapter');
      assertEqual(fallbackCallCount, 0, 'Unmatched route should not call fallback handler');
      assertEqual(
        response.headers['x-finance-local-managed-application-route-plugin-matched'],
        'false',
        'Unmatched route should remain outside finance route plugin match',
      );
      assertEqual(
        response.headers['x-finance-local-project-api-server-method-guard'],
        'not_applicable',
        'Project server method guard should not apply to non-finance routes',
      );
      assertEqual(response.projectServerTrace.routeMatched, false, 'Project trace should mark route unmatched');
      assertEqual(response.projectServerTrace.methodAllowed, true, 'Unmatched route should bypass finance method guard');
    },
  },
];

for (const test of tests) {
  await test.run();
}
