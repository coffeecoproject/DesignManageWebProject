import type {
  FinanceHttpJsonTransport,
  FinanceHttpJsonTransportRequest,
  FinanceHttpJsonTransportResponse
} from './financeHttpJsonTransportContract.js';

export type FinanceResourceScope = 'finance.ledger:*' | `finance.ledger:${string}`;

export type FinanceHttpResourceAuthorizationRequirement = {
  operation: string;
  resourceKey: string;
  resourceType: 'accounting_ledger';
};

export type FinanceHttpResourceAuthorizationResolver = (
  request: FinanceHttpJsonTransportRequest
) => FinanceHttpResourceAuthorizationRequirement | undefined;

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

function normalizePath(url: string) {
  const [path = '/'] = stripOrigin(url).split('?');

  return path.startsWith('/') ? path : `/${path}`;
}

function parseResourceScopes(value: string | undefined): FinanceResourceScope[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope): scope is FinanceResourceScope => isTrustedResourceScope(scope));
}

function isTrustedResourceScope(scope: string): scope is FinanceResourceScope {
  if (scope === 'finance.ledger:*') {
    return true;
  }

  return /^finance\.ledger:[a-zA-Z0-9_.:-]+$/.test(scope);
}

function canAccessResource({
  resourceKey,
  resourceScopes
}: {
  resourceKey: string;
  resourceScopes: readonly FinanceResourceScope[];
}) {
  return resourceScopes.includes('finance.ledger:*') || resourceScopes.includes(`finance.ledger:${resourceKey}`);
}

function createForbiddenResponse({
  operation,
  requestId,
  resourceKey,
  resourceType
}: FinanceHttpResourceAuthorizationRequirement & {
  requestId: string;
}): FinanceHttpJsonTransportResponse {
  return {
    bodyText: JSON.stringify({
      code: 'FORBIDDEN',
      message: `缺少 ${resourceKey} 账套资源权限，不能${operation}。`,
      requestId,
      resourceKey,
      resourceType
    }),
    headers: jsonHeaders,
    status: 403
  };
}

export function resolveDefaultFinanceResourceRequirement(
  request: FinanceHttpJsonTransportRequest
): FinanceHttpResourceAuthorizationRequirement | undefined {
  const method = request.method.toUpperCase();
  const path = normalizePath(request.url);

  if (!path.startsWith('/api/finance/')) {
    return undefined;
  }

  if (/^\/api\/finance\/accounting-periods\/[^/]+\/close-checks$/.test(path) && method === 'GET') {
    return {
      operation: '读取结账检查',
      resourceKey: 'default-ledger',
      resourceType: 'accounting_ledger'
    };
  }

  if (/^\/api\/finance\/accounting-periods\/[^/]+\/close$/.test(path) && method === 'POST') {
    return {
      operation: '确认期间结账',
      resourceKey: 'default-ledger',
      resourceType: 'accounting_ledger'
    };
  }

  if (/^\/api\/finance\/accounting-periods\/[^/]+\/reopen$/.test(path) && method === 'POST') {
    return {
      operation: '发起反结账',
      resourceKey: 'default-ledger',
      resourceType: 'accounting_ledger'
    };
  }

  if (/^\/api\/finance\/financial-statements\/[^/]+/.test(path)) {
    return {
      operation: method === 'POST' ? '生成财务报表快照' : '读取财务报表',
      resourceKey: 'default-ledger',
      resourceType: 'accounting_ledger'
    };
  }

  if (path === '/api/finance/general-ledger' || path.startsWith('/api/finance/general-ledger/')) {
    return {
      operation: '读取总账',
      resourceKey: 'default-ledger',
      resourceType: 'accounting_ledger'
    };
  }

  if (method === 'PATCH' || method === 'POST') {
    return {
      operation: '写入财务源单',
      resourceKey: 'default-ledger',
      resourceType: 'accounting_ledger'
    };
  }

  return undefined;
}

export function createFinanceHttpResourceAuthorizationMiddleware({
  resolveRequirement = resolveDefaultFinanceResourceRequirement,
  transport
}: {
  resolveRequirement?: FinanceHttpResourceAuthorizationResolver;
  transport: FinanceHttpJsonTransport;
}): FinanceHttpJsonTransport {
  return {
    handleHttpRequest: (request) => {
      const requirement = resolveRequirement(request);

      if (!requirement) {
        return transport.handleHttpRequest(request);
      }

      const headers = normalizeHeaders(request.headers);
      const resourceScopes = parseResourceScopes(headers['x-finance-resource-scopes']);

      if (!canAccessResource({ resourceKey: requirement.resourceKey, resourceScopes })) {
        return createForbiddenResponse({
          ...requirement,
          requestId: headers['x-request-id'] || 'local-resource-authorization-request'
        });
      }

      return transport.handleHttpRequest(request);
    }
  };
}
