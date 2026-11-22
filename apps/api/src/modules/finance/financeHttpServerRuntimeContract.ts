import type {
  FinanceHttpAuthMiddleware,
  FinanceHttpAuthenticatedPrincipal
} from './financeHttpAuthMiddlewareContract.js';
import type { FinanceHttpJsonTransportResponse } from './financeHttpJsonTransportContract.js';

export type FinanceHttpServerRuntimeRequest = {
  bodyText?: string;
  headers?: Record<string, string | readonly string[] | undefined>;
  method: string;
  url: string;
};

export type FinanceHttpServerRuntimeIdentityRequest = {
  authorization?: string;
  headers: Record<string, string | undefined>;
  method: string;
  url: string;
};

export type FinanceHttpServerRuntimeResponse = FinanceHttpJsonTransportResponse;

export type FinanceHttpServerRuntime = {
  handleServerRequest: (request: FinanceHttpServerRuntimeRequest) => FinanceHttpServerRuntimeResponse;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

function createRuntimeError({
  code,
  message,
  status
}: {
  code: 'PAYLOAD_TOO_LARGE';
  message: string;
  status: number;
}): FinanceHttpServerRuntimeResponse {
  return {
    bodyText: JSON.stringify({
      code,
      message
    }),
    headers: jsonHeaders,
    status
  };
}

function isHeaderValueArray(value: string | readonly string[] | undefined): value is readonly string[] {
  return Array.isArray(value);
}

function normalizeServerHeaders(headers: FinanceHttpServerRuntimeRequest['headers'] = {}) {
  const normalized: Record<string, string | undefined> = {};

  Object.entries(headers).forEach(([key, value]) => {
    if (isHeaderValueArray(value)) {
      normalized[key.toLowerCase()] = [...value].join(', ');

      return;
    }

    normalized[key.toLowerCase()] = value;
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

export function createFinanceHttpServerRuntime({
  authMiddleware,
  maxBodyBytes = 1024 * 1024,
  now = () => '1970-01-01T00:00:00+00:00',
  requestIdFactory = () => 'local-http-runtime-request',
  resolvePrincipal
}: {
  authMiddleware: FinanceHttpAuthMiddleware;
  maxBodyBytes?: number;
  now?: () => string;
  requestIdFactory?: () => string;
  resolvePrincipal: (
    request: FinanceHttpServerRuntimeIdentityRequest
  ) => FinanceHttpAuthenticatedPrincipal | undefined;
}): FinanceHttpServerRuntime {
  return {
    handleServerRequest: (request) => {
      const bodyText = request.bodyText ?? '';

      if (countUtf8Bytes(bodyText) > maxBodyBytes) {
        return createRuntimeError({
          code: 'PAYLOAD_TOO_LARGE',
          message: '请求体超过允许大小。',
          status: 413
        });
      }

      const headers = normalizeServerHeaders(request.headers);
      const principal = resolvePrincipal({
        authorization: headers.authorization,
        headers,
        method: request.method.toUpperCase(),
        url: request.url
      });

      return authMiddleware.handleAuthenticatedRequest({
        bodyText: request.bodyText,
        headers,
        method: request.method,
        principal,
        receivedAt: now(),
        requestId: requestIdFactory(),
        url: request.url
      });
    }
  };
}
