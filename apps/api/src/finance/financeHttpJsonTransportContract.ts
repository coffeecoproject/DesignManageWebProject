import type { FinanceHttpApiGatewayRequest } from './financeHttpApiGateway.js';

export type FinanceHttpJsonTransportRequest = {
  bodyText?: string;
  headers?: Record<string, string | undefined>;
  method: string;
  url: string;
};

export type FinanceHttpJsonTransportGatewayResponse = {
  body: unknown;
  headers: Record<string, string>;
  status: number;
};

export type FinanceHttpJsonTransportResponse = {
  bodyText: string;
  headers: Record<string, string>;
  status: number;
};

export type FinanceHttpJsonTransport = {
  handleHttpRequest: (request: FinanceHttpJsonTransportRequest) => FinanceHttpJsonTransportResponse;
};

type ParsedUrl = {
  path: string;
  query: Record<string, string | undefined>;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

function normalizeHeaders(headers: Record<string, string | undefined> = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function stripOrigin(url: string) {
  const originMatch = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(.*)$/i.exec(url);

  return originMatch ? originMatch[1] || '/' : url;
}

function decodeQueryPart(value: string) {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function parseUrl(url: string): ParsedUrl {
  const localUrl = stripOrigin(url);
  const [rawPath = '/', rawQuery = ''] = localUrl.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const query: Record<string, string | undefined> = {};

  rawQuery
    .split('&')
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey = '', rawValue] = part.split('=');
      const key = decodeQueryPart(rawKey);

      if (!key) {
        return;
      }

      query[key] = rawValue === undefined ? undefined : decodeQueryPart(rawValue);
    });

  return {
    path,
    query
  };
}

function createTransportError({
  code,
  message,
  status
}: {
  code: string;
  message: string;
  status: number;
}): FinanceHttpJsonTransportResponse {
  return {
    bodyText: JSON.stringify({
      code,
      message
    }),
    headers: jsonHeaders,
    status
  };
}

function parseBody(request: FinanceHttpJsonTransportRequest): { body: unknown; ok: true } | { ok: false } {
  if (request.bodyText === undefined || request.bodyText.trim().length === 0) {
    return {
      body: undefined,
      ok: true
    };
  }

  const headers = normalizeHeaders(request.headers);
  const contentType = headers['content-type'] || '';

  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false
    };
  }

  try {
    return {
      body: JSON.parse(request.bodyText),
      ok: true
    };
  } catch {
    return {
      ok: false
    };
  }
}

export function createFinanceHttpJsonTransport({
  handle
}: {
  handle: (request: FinanceHttpApiGatewayRequest) => FinanceHttpJsonTransportGatewayResponse;
}): FinanceHttpJsonTransport {
  return {
    handleHttpRequest: (request) => {
      const parsedBody = parseBody(request);

      if (!parsedBody.ok) {
        return createTransportError({
          code: 'INVALID_JSON_REQUEST',
          message: '请求体必须是有效 JSON，并使用 application/json。',
          status: 400
        });
      }

      const parsedUrl = parseUrl(request.url);
      const gatewayResponse = handle({
        body: parsedBody.body,
        headers: request.headers,
        method: request.method.toUpperCase(),
        path: parsedUrl.path,
        query: parsedUrl.query
      });

      return {
        bodyText: JSON.stringify(gatewayResponse.body),
        headers: {
          ...jsonHeaders,
          ...gatewayResponse.headers
        },
        status: gatewayResponse.status
      };
    }
  };
}
