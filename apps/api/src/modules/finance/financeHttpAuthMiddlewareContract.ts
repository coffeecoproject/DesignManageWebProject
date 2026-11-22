import {
  financePeriodClosePermissionScopes,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import type { FinanceResourceScope } from './financeHttpResourceAuthorizationContract.js';
import type {
  FinanceHttpJsonTransport,
  FinanceHttpJsonTransportRequest,
  FinanceHttpJsonTransportResponse
} from './financeHttpJsonTransportContract.js';
import type { ActorSnapshot } from './periodCloseContract.js';

export type FinanceHttpAuthenticatedPrincipal = {
  actorSnapshot: ActorSnapshot;
  permissionScopes: readonly FinancePeriodClosePermissionScope[];
  resourceScopes?: readonly FinanceResourceScope[];
  status: 'active' | 'disabled';
};

export type FinanceHttpAuthenticatedRequest = FinanceHttpJsonTransportRequest & {
  principal?: FinanceHttpAuthenticatedPrincipal;
  receivedAt?: string;
  requestId?: string;
};

export type FinanceHttpAuthMiddleware = {
  handleAuthenticatedRequest: (request: FinanceHttpAuthenticatedRequest) => FinanceHttpJsonTransportResponse;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

const trustedFinanceScopes = new Set<string>(financePeriodClosePermissionScopes);

function createAuthError({
  code,
  message,
  status
}: {
  code: 'UNAUTHENTICATED' | 'AUTH_PRINCIPAL_DISABLED' | 'INVALID_AUTH_CONTEXT';
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

function normalizeHeaders(headers: Record<string, string | undefined> = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function assertTrustedPermissionScopes(scopes: readonly FinancePeriodClosePermissionScope[]) {
  return scopes.every((scope) => trustedFinanceScopes.has(scope));
}

function createServerOwnedHeaders({
  request,
  trustedRequestId
}: {
  request: FinanceHttpAuthenticatedRequest;
  trustedRequestId: string;
}) {
  const incomingHeaders = normalizeHeaders(request.headers);
  const principal = request.principal;

  return {
    ...incomingHeaders,
    'x-actor-id': principal?.actorSnapshot.id,
    'x-finance-resource-scopes': principal?.resourceScopes?.join(',') ?? '',
    'x-actor-name': principal?.actorSnapshot.name,
    'x-permission-scopes': principal?.permissionScopes.join(','),
    'x-request-id': trustedRequestId,
    'x-request-time': request.receivedAt || '1970-01-01T00:00:00+00:00'
  };
}

export function createFinanceHttpAuthMiddleware({
  transport
}: {
  transport: FinanceHttpJsonTransport;
}): FinanceHttpAuthMiddleware {
  return {
    handleAuthenticatedRequest: (request) => {
      const principal = request.principal;

      if (!principal) {
        return createAuthError({
          code: 'UNAUTHENTICATED',
          message: '请先完成登录认证。',
          status: 401
        });
      }

      if (principal.status !== 'active') {
        return createAuthError({
          code: 'AUTH_PRINCIPAL_DISABLED',
          message: '当前账号不可执行财务操作。',
          status: 403
        });
      }

      if (!assertTrustedPermissionScopes(principal.permissionScopes)) {
        return createAuthError({
          code: 'INVALID_AUTH_CONTEXT',
          message: '认证上下文包含未登记的财务权限。',
          status: 500
        });
      }

      const trustedRequestId = request.requestId || 'local-authenticated-request';

      return transport.handleHttpRequest({
        bodyText: request.bodyText,
        headers: createServerOwnedHeaders({
          request,
          trustedRequestId
        }),
        method: request.method,
        url: request.url
      });
    }
  };
}
