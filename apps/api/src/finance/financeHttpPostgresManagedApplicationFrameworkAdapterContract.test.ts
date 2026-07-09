import type {
  FinanceHttpConcreteFrameworkAdapter,
  FinanceHttpConcreteFrameworkRequest,
  FinanceHttpConcreteFrameworkResponse,
  FinanceHttpConcreteFrameworkResponseWriter,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import {
  createFinanceHttpPostgresManagedApplicationFrameworkAdapter,
  validateFinanceHttpPostgresManagedApplicationFrameworkTrace,
} from './financeHttpPostgresManagedApplicationFrameworkAdapterContract.js';
import type {
  FinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
  FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void>;
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

function createManagedAdapterResponse({
  body,
  delegatedToServerEntry = false,
  handled,
  method,
  requestId = 'req-managed-application-framework-test',
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
      frameworkName: 'managed-application-framework-test',
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

function createFallbackResponse({
  body,
  handled,
  method,
  status,
  url,
}: {
  body: Record<string, unknown>;
  handled: boolean;
  method: string;
  status: number;
  url: string;
}): FinanceHttpConcreteFrameworkResponse {
  return {
    adapterTrace: {
      adapterKind: 'local_concrete_framework_adapter_contract',
      frameworkName: 'fallback-application-framework-test',
      handled,
      method,
      url,
    },
    bodyText: JSON.stringify(body),
    handled,
    headers: JSON_HEADERS,
    status,
  };
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

function createManagedAdapter(
  responseFactory: (
    request: FinanceHttpConcreteFrameworkRequest,
  ) => FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
) {
  const calls: FinanceHttpConcreteFrameworkRequest[] = [];
  const adapter: FinanceHttpPostgresManagedSourceMutationFrameworkAdapter = {
    handleConcreteFrameworkRequest: async (request) => {
      calls.push(request);

      return responseFactory(request);
    },
    writeConcreteFrameworkResponse: () => {
      throw new Error('Managed response writer should be reached only through application adapter.');
    },
  };

  return { adapter, calls };
}

function createFallbackAdapter(
  responseFactory: (request: FinanceHttpConcreteFrameworkRequest) => FinanceHttpConcreteFrameworkResponse,
) {
  const calls: FinanceHttpConcreteFrameworkRequest[] = [];
  const adapter: FinanceHttpConcreteFrameworkAdapter = {
    handleConcreteFrameworkRequest: (request) => {
      calls.push(request);

      return responseFactory(request);
    },
    writeConcreteFrameworkResponse: () => {
      throw new Error('Fallback response writer should be reached only through application adapter.');
    },
  };

  return { adapter, calls };
}

const tests: UnitTest[] = [
  {
    name: 'delegates ordinary finance framework requests to fallback adapter after managed source adapter declines',
    run: async () => {
      const managed = createManagedAdapter((request) =>
        createManagedAdapterResponse({
          body: { code: 'NOT_MANAGED_SOURCE_MUTATION' },
          handled: false,
          method: request.method ?? 'GET',
          status: 404,
          url: request.url ?? '/',
        }),
      );
      const fallback = createFallbackAdapter((request) =>
        createFallbackResponse({
          body: {
            handler: 'fallback',
            period: '2026-06',
            query: request.query,
          },
          handled: true,
          method: request.method ?? 'GET',
          status: 200,
          url: '/api/finance/accounting-periods/2026-06/close-checks?view=summary',
        }),
      );
      const adapter = createFinanceHttpPostgresManagedApplicationFrameworkAdapter({
        fallbackAdapter: fallback.adapter,
        frameworkName: 'express-like-contract',
        managedSourceMutationAdapter: managed.adapter,
      });

      const response = await adapter.handleConcreteFrameworkRequest({
        headers: { authorization: 'Bearer local-session' },
        method: 'GET',
        path: '/api/finance/accounting-periods/2026-06/close-checks',
        query: { view: 'summary' },
      });
      const traceValidation = validateFinanceHttpPostgresManagedApplicationFrameworkTrace(response);

      assert(traceValidation.ok, `Application trace should be valid: ${traceValidation.errors.join(',')}`);
      assertEqual(managed.calls.length, 1, 'Managed source adapter should be attempted first');
      assertEqual(fallback.calls.length, 1, 'Fallback adapter should receive ordinary finance request');
      assertEqual(response.applicationTrace.route, 'fallback-handler', 'Ordinary finance request should use fallback route');
      assertEqual(response.applicationTrace.managedSourceMutationHandled, false, 'Managed adapter should decline ordinary request');
      assertEqual(response.applicationTrace.fallbackHandled, true, 'Fallback adapter should handle ordinary request');
      assertEqual(response.headers['x-finance-local-managed-application-framework-route'], 'fallback-handler', 'Route header should show fallback');

      const body = parseBody(response.bodyText, 'Fallback response body should be JSON');
      assertEqual(body.handler, 'fallback', 'Fallback response body should be selected');
      assertEqual(fallback.calls[0]?.query?.view, 'summary', 'Framework query should be preserved for fallback');
    },
  },
  {
    name: 'routes managed source mutation framework requests before fallback adapter',
    run: async () => {
      const managed = createManagedAdapter((request) =>
        createManagedAdapterResponse({
          body: {
            sourceId: 'invoice-202606-001',
            sourceStatus: 'updated',
          },
          delegatedToServerEntry: true,
          handled: true,
          method: request.method ?? 'PATCH',
          status: 200,
          url: request.url ?? '/',
        }),
      );
      const fallback = createFallbackAdapter((request) =>
        createFallbackResponse({
          body: { unexpectedFallbackUrl: request.url ?? '' },
          handled: true,
          method: request.method ?? 'PATCH',
          status: 200,
          url: request.url ?? '/',
        }),
      );
      const adapter = createFinanceHttpPostgresManagedApplicationFrameworkAdapter({
        fallbackAdapter: fallback.adapter,
        managedSourceMutationAdapter: managed.adapter,
      });

      const response = await adapter.handleConcreteFrameworkRequest({
        body: {
          amount: '9800.00',
          sourceId: 'invoice-202606-001',
          status: '已匹配',
          version: 2,
        },
        headers: { authorization: 'Bearer finance-accountant' },
        method: 'PATCH',
        path: '/api/finance/invoice-matches/invoice-202606-001',
      });

      assertEqual(managed.calls.length, 1, 'Managed source adapter should receive mutation request');
      assertEqual(fallback.calls.length, 0, 'Fallback adapter should not run after managed source mutation handles');
      assertEqual(response.applicationTrace.route, 'managed-source-mutation', 'Source mutation should use managed route');
      assertEqual(response.applicationTrace.delegatedToFallback, false, 'Managed source route must not fallback');
      assertEqual(response.headers['x-finance-local-managed-application-framework-route'], 'managed-source-mutation', 'Route header should show managed route');

      const body = parseBody(response.bodyText, 'Managed response body should be JSON');
      assertEqual(body.sourceId, 'invoice-202606-001', 'Managed response body should be selected');
    },
  },
  {
    name: 'keeps framework request unhandled when managed and fallback adapters both decline',
    run: async () => {
      const managed = createManagedAdapter((request) =>
        createManagedAdapterResponse({
          body: { code: 'NOT_MANAGED_SOURCE_MUTATION' },
          handled: false,
          method: request.method ?? 'POST',
          status: 404,
          url: request.url ?? '/',
        }),
      );
      const fallback = createFallbackAdapter((request) =>
        createFallbackResponse({
          body: { code: 'NOT_FOUND' },
          handled: false,
          method: request.method ?? 'POST',
          status: 404,
          url: request.url ?? '/',
        }),
      );
      const adapter = createFinanceHttpPostgresManagedApplicationFrameworkAdapter({
        fallbackAdapter: fallback.adapter,
        managedSourceMutationAdapter: managed.adapter,
      });

      const response = await adapter.handleConcreteFrameworkRequest({
        bodyText: '{}',
        method: 'POST',
        url: '/api/unknown',
      });

      assertEqual(managed.calls.length, 1, 'Managed adapter should still be attempted');
      assertEqual(fallback.calls.length, 1, 'Fallback adapter should decide final unhandled response');
      assertEqual(response.handled, false, 'Application response should remain unhandled');
      assertEqual(response.applicationTrace.route, 'fallback-handler', 'Final unhandled response should come from fallback route');
      assertEqual(response.headers['x-finance-local-managed-application-framework-handled'], 'false', 'Handled header should stay false');
    },
  },
  {
    name: 'writes unified framework response headers and selected body through application adapter',
    run: async () => {
      const managed = createManagedAdapter((request) =>
        createManagedAdapterResponse({
          body: { handledBy: 'managed-source' },
          handled: true,
          method: request.method ?? 'PATCH',
          status: 202,
          url: request.url ?? '/',
        }),
      );
      const fallback = createFallbackAdapter((request) =>
        createFallbackResponse({
          body: { unexpectedFallbackUrl: request.url ?? '' },
          handled: true,
          method: request.method ?? 'PATCH',
          status: 200,
          url: request.url ?? '/',
        }),
      );
      const adapter = createFinanceHttpPostgresManagedApplicationFrameworkAdapter({
        fallbackAdapter: fallback.adapter,
        managedSourceMutationAdapter: managed.adapter,
      });
      const response = await adapter.handleConcreteFrameworkRequest({
        method: 'PATCH',
        url: '/api/finance/bank-reconciliation/items/br-001',
      });
      const { captured, writer } = createCapturedFrameworkWriter();

      adapter.writeConcreteFrameworkResponse(writer, response);

      assertEqual(captured.status, 202, 'Framework writer should receive selected status');
      assertEqual(captured.headers['content-type'], JSON_HEADERS['content-type'], 'Framework writer should receive content type');
      assertEqual(
        captured.headers['x-finance-local-managed-application-framework-route'],
        'managed-source-mutation',
        'Framework writer should receive application route header',
      );
      assertEqual(
        captured.headers['x-finance-local-managed-application-framework-handled'],
        'true',
        'Framework writer should receive handled header',
      );

      const body = parseBody(captured.bodyText ?? '', 'Captured body should be JSON');
      assertEqual(body.handledBy, 'managed-source', 'Framework writer should receive selected response body');
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
