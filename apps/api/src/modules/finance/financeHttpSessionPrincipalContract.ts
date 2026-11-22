import type { FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import type { FinanceHttpServerRuntimeIdentityRequest } from './financeHttpServerRuntimeContract.js';
import type { FinancePeriodClosePermissionScope } from './periodCloseAuthorizationContract.js';
import type { ActorSnapshot } from './periodCloseContract.js';
import type { FinanceResourceScope } from './financeHttpResourceAuthorizationContract.js';

export type FinanceHttpSessionPrincipalRecord = {
  actorSnapshot: ActorSnapshot;
  expiresAt: string;
  ledgerResourceKeys: readonly ('*' | string)[];
  permissionScopes: readonly FinancePeriodClosePermissionScope[];
  revokedAt?: string;
  sessionToken: string;
  status: 'active' | 'disabled';
};

export type FinanceHttpSessionPrincipalResolver = (
  request: FinanceHttpServerRuntimeIdentityRequest
) => FinanceHttpAuthenticatedPrincipal | undefined;

function parseBearerToken(authorization: string | undefined) {
  if (!authorization) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());

  return match?.[1]?.trim() || undefined;
}

function parseCookieToken({
  cookieHeader,
  cookieName
}: {
  cookieHeader?: string;
  cookieName: string;
}) {
  if (!cookieHeader) {
    return undefined;
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!cookie) {
    return undefined;
  }

  return decodeURIComponent(cookie.slice(cookieName.length + 1));
}

function isExpiredOrRevoked({
  now,
  session
}: {
  now: string;
  session: FinanceHttpSessionPrincipalRecord;
}) {
  const nowTime = Date.parse(now);
  const expiresAtTime = Date.parse(session.expiresAt);
  const revokedAtTime = session.revokedAt ? Date.parse(session.revokedAt) : undefined;

  if (!Number.isFinite(nowTime) || !Number.isFinite(expiresAtTime)) {
    return true;
  }

  if (expiresAtTime <= nowTime) {
    return true;
  }

  return revokedAtTime !== undefined && Number.isFinite(revokedAtTime) && revokedAtTime <= nowTime;
}

function toResourceScope(ledgerResourceKey: '*' | string): FinanceResourceScope {
  return ledgerResourceKey === '*' ? 'finance.ledger:*' : `finance.ledger:${ledgerResourceKey}`;
}

export function createFinanceHttpSessionPrincipalResolver({
  cookieName = 'sms_session',
  now = () => '1970-01-01T00:00:00+00:00',
  sessions
}: {
  cookieName?: string;
  now?: () => string;
  sessions: readonly FinanceHttpSessionPrincipalRecord[];
}): FinanceHttpSessionPrincipalResolver {
  const sessionsByToken = new Map(sessions.map((session) => [session.sessionToken, session]));

  return (request) => {
    const bearerToken = parseBearerToken(request.authorization);
    const sessionToken = bearerToken ?? parseCookieToken({ cookieHeader: request.headers.cookie, cookieName });

    if (!sessionToken) {
      return undefined;
    }

    const session = sessionsByToken.get(sessionToken);

    if (!session || isExpiredOrRevoked({ now: now(), session })) {
      return undefined;
    }

    return {
      actorSnapshot: session.actorSnapshot,
      permissionScopes: session.permissionScopes,
      resourceScopes: session.ledgerResourceKeys.map(toResourceScope),
      status: session.status
    };
  };
}
