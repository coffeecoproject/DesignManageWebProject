import type {
  FinanceHttpConcreteFrameworkRequest,
  FinanceHttpConcreteFrameworkResponse,
  FinanceHttpConcreteFrameworkResponseWriter,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import type {
  FinanceHttpPostgresManagedApplicationFrameworkAdapter,
  FinanceHttpPostgresManagedApplicationFrameworkResponse,
  FinanceHttpPostgresManagedApplicationFrameworkRoute,
} from './financeHttpPostgresManagedApplicationFrameworkAdapterContract.js';
import {
  createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin,
  type FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration,
  validateFinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse,
} from './financeHttpPostgresManagedApplicationFrameworkRoutePluginContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

type CapturedFrameworkResponse = {
  bodyText?: string;
  headers: Record<string, string>;
  status?: number;
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

function createCapturedFrameworkWriter() {
  const captured: CapturedFrameworkResponse = {
    headers: {},
  };
  const writer: FinanceHttpConcreteFrameworkResponseWriter = {
    send: (bodyText) => {
      captured.bodyText = bodyText;
    },
    setHeader: (name, value) => {
      captured.headers[name.toLowerCase()] = value;
    },
    status: (status) => {
      captured.status = status;

      return writer;
    },
  };

  return { captured, writer };
}

function createSelectedFallbackResponse({
  bodyText,
  handled,
  method,
  status,
  url,
}: {
  bodyText: string;
  handled: boolean;
  method: string;
  status: number;
  url: string;
}): FinanceHttpConcreteFrameworkResponse {
  return {
    adapterTrace: {
      adapterKind: 'local_concrete_framework_adapter_contract',
      frameworkName: 'route-plugin-test-fallback',
      handled,
      method,
      url,
    },
    bodyText,
    handled,
    headers: JSON_HEADERS,
    status,
  };
}

function createApplicationResponse({
  body,
  handled,
  method,
  route,
  status,
  url,
}: {
  body: Record<string, unknown>;
  handled: boolean;
  method: string;
  route: FinanceHttpPostgresManagedApplicationFrameworkRoute;
  status: number;
  url: string;
}): FinanceHttpPostgresManagedApplicationFrameworkResponse {
  const bodyText = JSON.stringify(body);

  return {
    applicationTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_adapter_contract',
      delegatedToFallback: route === 'fallback-handler',
      delegatedToManagedSourceMutation: true,
      fallbackHandled: route === 'fallback-handler' ? handled : false,
      frameworkName: 'route-plugin-test-application',
      handled,
      managedSourceMutationHandled: route === 'managed-source-mutation' ? handled : false,
      method,
      route,
      url,
    },
    bodyText,
    handled,
    headers: {
      ...JSON_HEADERS,
      'x-finance-local-managed-application-framework-handled': handled ? 'true' : 'false',
      'x-finance-local-managed-application-framework-route': route,
    },
    selectedResponse: createSelectedFallbackResponse({
      bodyText,
      handled,
      method,
      status,
      url,
    }),
    status,
  };
}

function createApplicationAdapter(
  responseFactory: (request: FinanceHttpConcreteFrameworkRequest) => FinanceHttpPostgresManagedApplicationFrameworkResponse,
) {
  const calls: FinanceHttpConcreteFrameworkRequest[] = [];
  const adapter: FinanceHttpPostgresManagedApplicationFrameworkAdapter = {
    handleConcreteFrameworkRequest: async (request) => {
      calls.push(request);

      return responseFactory(request);
    },
    writeConcreteFrameworkResponse: () => {
      throw new Error('Route plugin should own framework response writing at this boundary.');
    },
  };

  return { adapter, calls };
}

function createRouteRegistry() {
  const registrations: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration[] = [];

  return {
    registrations,
    registry: {
      registerRoute: (registration: FinanceHttpPostgresManagedApplicationFrameworkRouteRegistration) => {
        registrations.push(registration);
      },
    },
  };
}

const tests: UnitTest[] = [
  {
    name: 'registers one finance application route plugin with the standard finance prefix and methods',
    run: () => {
      const application = createApplicationAdapter((request) =>
        createApplicationResponse({
          body: { code: 'OK' },
          handled: true,
          method: request.method ?? 'GET',
          route: 'fallback-handler',
          status: 200,
          url: request.url ?? '/',
        }),
      );
      const plugin = createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
        adapter: application.adapter,
        frameworkName: 'fastify-like-contract',
      });
      const { registrations, registry } = createRouteRegistry();
      const registration = plugin.register(registry);

      assertEqual(registrations.length, 1, 'Route plugin should register exactly one framework route');
      assertEqual(registration.routePrefix, '/api/finance', 'Route plugin should bind only the finance prefix');
      assertEqual(registration.frameworkName, 'fastify-like-contract', 'Registration should preserve framework name');
      assertEqual(registration.methods.join(','), 'GET,PATCH,POST', 'Registration should expose standard finance methods');
    },
  },
  {
    name: 'delegates matched finance requests to the unified application framework adapter and writes plugin provenance',
    run: async () => {
      const application = createApplicationAdapter((request) =>
        createApplicationResponse({
          body: {
            handler: 'fallback',
            period: '2026-06',
          },
          handled: true,
          method: request.method ?? 'GET',
          route: 'fallback-handler',
          status: 200,
          url: request.originalUrl ?? request.url ?? '/',
        }),
      );
      const plugin = createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
        adapter: application.adapter,
      });
      const { registrations, registry } = createRouteRegistry();
      plugin.register(registry);
      const { captured, writer } = createCapturedFrameworkWriter();
      const response = await registrations[0]?.handler(
        {
          method: 'GET',
          path: '/api/finance/accounting-periods/2026-06/close-checks',
          query: { view: 'summary' },
        },
        writer,
      );

      assert(response !== undefined, 'Registered route handler should return a response');
      assertEqual(application.calls.length, 1, 'Matched finance request should reach the application adapter');
      assertEqual(application.calls[0]?.query?.view, 'summary', 'Framework query should be passed through');
      assertEqual(response.pluginTrace.applicationRoute, 'fallback-handler', 'Plugin trace should preserve application route');
      assertEqual(response.headers['x-finance-local-managed-application-route-plugin-matched'], 'true', 'Plugin headers should show matched route');
      assertEqual(response.headers['x-finance-local-managed-application-route-plugin-delegated'], 'true', 'Plugin headers should show application delegation');
      assertEqual(captured.status, 200, 'Writer should receive application response status');
      assertEqual(captured.headers['x-finance-local-managed-application-route-plugin-prefix'], '/api/finance', 'Writer should receive plugin prefix header');

      const validation = validateFinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse(response);
      assert(validation.ok, `Route plugin response should validate: ${validation.errors.join(',')}`);

      const body = parseBody(captured.bodyText ?? '', 'Captured body should be JSON');
      assertEqual(body.handler, 'fallback', 'Writer should receive selected application body');
    },
  },
  {
    name: 'keeps non-finance requests outside the application adapter',
    run: async () => {
      const application = createApplicationAdapter((request) =>
        createApplicationResponse({
          body: { unexpectedPath: request.path ?? request.url ?? '' },
          handled: true,
          method: request.method ?? 'GET',
          route: 'fallback-handler',
          status: 200,
          url: request.url ?? '/',
        }),
      );
      const plugin = createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
        adapter: application.adapter,
      });
      const { captured, writer } = createCapturedFrameworkWriter();
      const response = await plugin.handleConcreteFrameworkRequest({
        method: 'GET',
        path: '/api/customer/accounts',
      });

      plugin.writeConcreteFrameworkResponse(writer, response);

      assertEqual(application.calls.length, 0, 'Non-finance route should not reach application adapter');
      assertEqual(response.handled, false, 'Non-finance route should remain unhandled');
      assertEqual(response.pluginTrace.matched, false, 'Plugin trace should mark non-finance route unmatched');
      assertEqual(captured.status, 404, 'Writer should receive unbound route status');
      assertEqual(captured.headers['x-finance-local-managed-application-route-plugin-matched'], 'false', 'Writer should receive unmatched header');

      const validation = validateFinanceHttpPostgresManagedApplicationFrameworkRoutePluginResponse(response);
      assert(validation.ok, `Unmatched route plugin response should validate: ${validation.errors.join(',')}`);

      const body = parseBody(captured.bodyText ?? '', 'Unmatched body should be JSON');
      assertEqual(body.code, 'FINANCE_ROUTE_NOT_BOUND', 'Unmatched route should return finance route-not-bound code');
    },
  },
  {
    name: 'preserves managed source mutation application route through the framework route plugin',
    run: async () => {
      const application = createApplicationAdapter((request) =>
        createApplicationResponse({
          body: {
            sourceId: 'invoice-202606-001',
            sourceStatus: 'updated',
          },
          handled: true,
          method: request.method ?? 'PATCH',
          route: 'managed-source-mutation',
          status: 202,
          url: request.url ?? '/',
        }),
      );
      const plugin = createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
        adapter: application.adapter,
      });
      const response = await plugin.handleConcreteFrameworkRequest({
        body: {
          amount: '9800.00',
          version: 3,
        },
        method: 'PATCH',
        url: '/api/finance/invoice-matches/invoice-202606-001',
      });

      assertEqual(application.calls.length, 1, 'Managed source mutation route should reach application adapter once');
      assertEqual(response.status, 202, 'Plugin should preserve managed application status');
      assertEqual(response.pluginTrace.applicationRoute, 'managed-source-mutation', 'Plugin trace should preserve managed route');
      assertEqual(
        response.headers['x-finance-local-managed-application-framework-route'],
        'managed-source-mutation',
        'Application route header should remain visible after plugin headers are added',
      );

      const body = parseBody(response.bodyText, 'Managed plugin response body should be JSON');
      assertEqual(body.sourceStatus, 'updated', 'Plugin should preserve managed source response body');
    },
  },
  {
    name: 'rejects non-finance route prefixes before registration',
    run: () => {
      const application = createApplicationAdapter((request) =>
        createApplicationResponse({
          body: { code: 'OK' },
          handled: true,
          method: request.method ?? 'GET',
          route: 'fallback-handler',
          status: 200,
          url: request.url ?? '/',
        }),
      );
      let errorMessage = '';

      try {
        createFinanceHttpPostgresManagedApplicationFrameworkRoutePlugin({
          adapter: application.adapter,
          routePrefix: '/api/customer',
        });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      assert(
        errorMessage.includes('FINANCE_APPLICATION_ROUTE_PLUGIN_PREFIX_INVALID'),
        'Route plugin should reject non-finance prefixes',
      );
    },
  },
];

async function run() {
  for (const test of tests) {
    await test.run();
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
