import type {
  FinanceHttpConcreteFrameworkRequest,
  FinanceHttpConcreteFrameworkResponseWriter,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import type { FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import type { FinanceHttpServerRuntimeIdentityRequest } from './financeHttpServerRuntimeContract.js';
import {
  handleFinanceHttpPostgresManagedSourceMutationServer,
  type FinanceHttpPostgresManagedSourceMutationServerResponse,
} from './financeHttpPostgresManagedSourceMutationServerContract.js';
import type {
  PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  PeriodClosePostgresManagedServicePoolRuntimeContract,
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import type { FinanceSourceTableSqlRepositoryContract } from './periodCloseSourceTableSqlRepositoryContract.js';

export type FinanceHttpPostgresManagedSourceMutationFrameworkAdapterTrace = {
  adapterKind: 'local_http_managed_postgres_source_mutation_framework_adapter_contract';
  delegatedToServerEntry: boolean;
  frameworkName: string;
  handled: boolean;
  method: string;
  requestId: string;
  url: string;
};

export type FinanceHttpPostgresManagedSourceMutationFrameworkResponse =
  FinanceHttpPostgresManagedSourceMutationServerResponse & {
    adapterTrace: FinanceHttpPostgresManagedSourceMutationFrameworkAdapterTrace;
  };

export type FinanceHttpPostgresManagedSourceMutationFrameworkAdapter = {
  handleConcreteFrameworkRequest: (
    request: FinanceHttpConcreteFrameworkRequest,
  ) => Promise<FinanceHttpPostgresManagedSourceMutationFrameworkResponse>;
  writeConcreteFrameworkResponse: (
    writer: FinanceHttpConcreteFrameworkResponseWriter,
    response: FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
  ) => void;
};

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

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

function createBodyText(request: FinanceHttpConcreteFrameworkRequest) {
  if (request.bodyText !== undefined) return request.bodyText;
  if (request.body === undefined) return undefined;
  if (typeof request.body === 'string') return request.body;

  return JSON.stringify(request.body);
}

function normalizeHeaders(
  headers: FinanceHttpConcreteFrameworkRequest['headers'] = {},
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};

  Object.entries(headers).forEach(([key, value]) => {
    if (value === undefined) {
      normalized[key.toLowerCase()] = undefined;

      return;
    }

    normalized[key.toLowerCase()] = typeof value === 'string' ? value : value.join(', ');
  });

  return normalized;
}

function countUtf8Bytes(value: string) {
  let byteLength = 0;

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;

    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7ff) {
      byteLength += 2;
    } else if (codePoint <= 0xffff) {
      byteLength += 3;
    } else {
      byteLength += 4;
    }
  }

  return byteLength;
}

function createTooLargeResponse({
  frameworkName,
  method,
  requestId,
  sourceSqlRepository,
  url,
}: {
  frameworkName: string;
  method: string;
  requestId: string;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
  url: string;
}): FinanceHttpPostgresManagedSourceMutationFrameworkResponse {
  const body = {
    code: 'PAYLOAD_TOO_LARGE',
    message: '请求体超过允许大小。',
  };

  return {
    adapterTrace: {
      adapterKind: 'local_http_managed_postgres_source_mutation_framework_adapter_contract',
      delegatedToServerEntry: false,
      frameworkName,
      handled: true,
      method,
      requestId,
      url,
    },
    body,
    bodyText: JSON.stringify(body),
    handled: true,
    headers: JSON_HEADERS,
    sourceSqlRows: sourceSqlRepository.readSqlRows(),
    status: 413,
    trace: [],
  };
}

export function createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter({
  admission,
  frameworkName = 'local-managed-source-framework-contract',
  maxBodyBytes = 1024 * 1024,
  now = () => '1970-01-01T00:00:00+00:00',
  requestIdFactory = () => 'local-managed-source-framework-request',
  resolvePrincipal,
  runtime,
  sourceSqlRepository,
}: {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  frameworkName?: string;
  maxBodyBytes?: number;
  now?: () => string;
  requestIdFactory?: () => string;
  resolvePrincipal: (request: FinanceHttpServerRuntimeIdentityRequest) => FinanceHttpAuthenticatedPrincipal | undefined;
  runtime: PeriodClosePostgresManagedServicePoolRuntimeContract;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
}): FinanceHttpPostgresManagedSourceMutationFrameworkAdapter {
  return {
    handleConcreteFrameworkRequest: async (request) => {
      const method = request.method ?? 'GET';
      const url = createUrl(request);
      const bodyText = createBodyText(request);
      const headers = normalizeHeaders(request.headers);
      const requestId = requestIdFactory();

      if (countUtf8Bytes(bodyText ?? '') > maxBodyBytes) {
        return createTooLargeResponse({
          frameworkName,
          method,
          requestId,
          sourceSqlRepository,
          url,
        });
      }

      const principal = resolvePrincipal({
        authorization: headers.authorization,
        headers,
        method: method.toUpperCase(),
        url,
      });

      const response = await handleFinanceHttpPostgresManagedSourceMutationServer({
        admission,
        request: {
          bodyText,
          headers: request.headers,
          method,
          principal,
          receivedAt: now(),
          requestId,
          url,
        },
        runtime,
        sourceSqlRepository,
      });

      return {
        ...response,
        adapterTrace: {
          adapterKind: 'local_http_managed_postgres_source_mutation_framework_adapter_contract',
          delegatedToServerEntry: true,
          frameworkName,
          handled: response.handled,
          method,
          requestId,
          url,
        },
      };
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

export function validateFinanceHttpPostgresManagedSourceMutationFrameworkAdapterTrace(
  response: FinanceHttpPostgresManagedSourceMutationFrameworkResponse,
) {
  const errors: string[] = [];

  if (response.adapterTrace.adapterKind !== 'local_http_managed_postgres_source_mutation_framework_adapter_contract') {
    errors.push('ADAPTER_TRACE_KIND_INVALID');
  }
  if (!response.adapterTrace.frameworkName) {
    errors.push('ADAPTER_TRACE_FRAMEWORK_NAME_REQUIRED');
  }
  if (!response.adapterTrace.method) {
    errors.push('ADAPTER_TRACE_METHOD_REQUIRED');
  }
  if (!response.adapterTrace.url.startsWith('/')) {
    errors.push('ADAPTER_TRACE_URL_MUST_BE_SERVER_PATH');
  }
  if (response.adapterTrace.handled !== response.handled) {
    errors.push('ADAPTER_TRACE_HANDLED_MISMATCH');
  }
  if (response.adapterTrace.delegatedToServerEntry && response.trace.length === 0) {
    errors.push('ADAPTER_TRACE_DELEGATED_WITHOUT_SERVER_TRACE');
  }
  if (!response.adapterTrace.delegatedToServerEntry && response.trace.length > 0) {
    errors.push('ADAPTER_TRACE_NOT_DELEGATED_WITH_SERVER_TRACE');
  }

  return { errors, ok: errors.length === 0 };
}
