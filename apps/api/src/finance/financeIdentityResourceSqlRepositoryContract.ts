import type { FinanceHttpAuthenticatedPrincipal } from './financeHttpAuthMiddlewareContract.js';
import type { FinanceResourceScope } from './financeHttpResourceAuthorizationContract.js';
import type { FinanceHttpServerRuntimeIdentityRequest } from './financeHttpServerRuntimeContract.js';
import {
  financePeriodClosePermissionScopes,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';

export type FinanceIdentitySqlStatus = 'active' | 'disabled';
export type FinanceIdentitySessionSqlStatus = 'active' | 'revoked';
export type FinanceIdentityGrantSqlStatus = 'active' | 'disabled';

export type FinanceIdentityUserSqlRow = {
  display_name: string;
  status: FinanceIdentitySqlStatus;
  user_id: string;
};

export type FinanceIdentitySessionSqlRow = {
  expires_at: string;
  revoked_at?: string;
  session_id: string;
  session_token_hash: string;
  status: FinanceIdentitySessionSqlStatus;
  user_id: string;
};

export type FinanceIdentityPermissionGrantSqlRow = {
  effective_from: string;
  effective_to?: string;
  grant_id: string;
  permission_scope: FinancePeriodClosePermissionScope;
  status: FinanceIdentityGrantSqlStatus;
  user_id: string;
};

export type FinanceIdentityLedgerResourceGrantSqlRow = {
  effective_from: string;
  effective_to?: string;
  grant_id: string;
  ledger_key: '*' | string;
  status: FinanceIdentityGrantSqlStatus;
  user_id: string;
};

export type FinanceIdentityResourceSqlRows = {
  identity_ledger_resource_grants: readonly FinanceIdentityLedgerResourceGrantSqlRow[];
  identity_permission_grants: readonly FinanceIdentityPermissionGrantSqlRow[];
  identity_sessions: readonly FinanceIdentitySessionSqlRow[];
  identity_users: readonly FinanceIdentityUserSqlRow[];
};

export type FinanceIdentityResourceSqlValidationResult =
  | {
      ok: true;
    }
  | {
      errors: string[];
      ok: false;
    };

export const financeIdentityResourceSqlTableDefinitions = [
  {
    primaryKey: ['user_id'],
    requiredColumns: ['user_id', 'display_name', 'status'],
    tableName: 'identity_users'
  },
  {
    primaryKey: ['session_id'],
    requiredColumns: ['session_id', 'session_token_hash', 'user_id', 'status', 'expires_at'],
    tableName: 'identity_sessions'
  },
  {
    primaryKey: ['grant_id'],
    requiredColumns: ['grant_id', 'user_id', 'permission_scope', 'status', 'effective_from'],
    tableName: 'identity_permission_grants'
  },
  {
    primaryKey: ['grant_id'],
    requiredColumns: ['grant_id', 'user_id', 'ledger_key', 'status', 'effective_from'],
    tableName: 'identity_ledger_resource_grants'
  }
] as const;

const trustedPermissionScopes = new Set<string>(financePeriodClosePermissionScopes);

function createValidationResult(errors: string[]): FinanceIdentityResourceSqlValidationResult {
  return errors.length > 0
    ? {
        errors,
        ok: false
      }
    : {
        ok: true
      };
}

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

function parseTime(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const time = Date.parse(value);

  return Number.isFinite(time) ? time : undefined;
}

function isValidLedgerKey(value: string) {
  return value === '*' || /^[a-zA-Z0-9_.:-]+$/.test(value);
}

function isEffectiveAt({
  effectiveFrom,
  effectiveTo,
  now
}: {
  effectiveFrom: string;
  effectiveTo?: string;
  now: string;
}) {
  const nowTime = parseTime(now);
  const fromTime = parseTime(effectiveFrom);
  const toTime = parseTime(effectiveTo);

  if (nowTime === undefined || fromTime === undefined) {
    return false;
  }

  if (fromTime > nowTime) {
    return false;
  }

  return toTime === undefined || toTime > nowTime;
}

function isSessionUsableAt({
  now,
  session
}: {
  now: string;
  session: FinanceIdentitySessionSqlRow;
}) {
  const nowTime = parseTime(now);
  const expiresAtTime = parseTime(session.expires_at);
  const revokedAtTime = parseTime(session.revoked_at);

  if (session.status !== 'active' || nowTime === undefined || expiresAtTime === undefined) {
    return false;
  }

  if (expiresAtTime <= nowTime) {
    return false;
  }

  return revokedAtTime === undefined || revokedAtTime > nowTime;
}

function toResourceScope(ledgerKey: '*' | string): FinanceResourceScope {
  return ledgerKey === '*' ? 'finance.ledger:*' : `finance.ledger:${ledgerKey}`;
}

function assertUnique({
  errors,
  label,
  values
}: {
  errors: string[];
  label: string;
  values: readonly string[];
}) {
  const seen = new Set<string>();

  values.forEach((value) => {
    if (!value) {
      errors.push(`${label} 不能为空。`);

      return;
    }

    if (seen.has(value)) {
      errors.push(`${label} ${value} 重复。`);
    }

    seen.add(value);
  });
}

function validateEffectiveRange({
  errors,
  id,
  row
}: {
  errors: string[];
  id: string;
  row: {
    effective_from: string;
    effective_to?: string;
  };
}) {
  const fromTime = parseTime(row.effective_from);
  const toTime = parseTime(row.effective_to);

  if (fromTime === undefined) {
    errors.push(`${id} 生效时间无效。`);
  }

  if (row.effective_to !== undefined && toTime === undefined) {
    errors.push(`${id} 失效时间无效。`);
  }

  if (fromTime !== undefined && toTime !== undefined && toTime <= fromTime) {
    errors.push(`${id} 失效时间必须晚于生效时间。`);
  }
}

export function validateFinanceIdentityResourceSqlRows(
  rows: FinanceIdentityResourceSqlRows
): FinanceIdentityResourceSqlValidationResult {
  const errors: string[] = [];
  const userIds = new Set(rows.identity_users.map((user) => user.user_id));

  assertUnique({
    errors,
    label: '用户 ID',
    values: rows.identity_users.map((user) => user.user_id)
  });
  assertUnique({
    errors,
    label: 'Session ID',
    values: rows.identity_sessions.map((session) => session.session_id)
  });
  assertUnique({
    errors,
    label: 'Session token hash',
    values: rows.identity_sessions.map((session) => session.session_token_hash)
  });
  assertUnique({
    errors,
    label: '权限授权 ID',
    values: rows.identity_permission_grants.map((grant) => grant.grant_id)
  });
  assertUnique({
    errors,
    label: '账套资源授权 ID',
    values: rows.identity_ledger_resource_grants.map((grant) => grant.grant_id)
  });

  rows.identity_users.forEach((user) => {
    if (!user.display_name.trim()) {
      errors.push(`用户 ${user.user_id} 名称不能为空。`);
    }

    if (user.status !== 'active' && user.status !== 'disabled') {
      errors.push(`用户 ${user.user_id} 状态无效。`);
    }
  });

  rows.identity_sessions.forEach((session) => {
    if (!userIds.has(session.user_id)) {
      errors.push(`Session ${session.session_id} 关联的用户不存在。`);
    }

    if (session.status !== 'active' && session.status !== 'revoked') {
      errors.push(`Session ${session.session_id} 状态无效。`);
    }

    if (parseTime(session.expires_at) === undefined) {
      errors.push(`Session ${session.session_id} 过期时间无效。`);
    }

    if (session.revoked_at !== undefined && parseTime(session.revoked_at) === undefined) {
      errors.push(`Session ${session.session_id} 撤销时间无效。`);
    }
  });

  rows.identity_permission_grants.forEach((grant) => {
    if (!userIds.has(grant.user_id)) {
      errors.push(`权限授权 ${grant.grant_id} 关联的用户不存在。`);
    }

    if (!trustedPermissionScopes.has(grant.permission_scope)) {
      errors.push(`权限授权 ${grant.grant_id} 使用了未登记权限。`);
    }

    if (grant.status !== 'active' && grant.status !== 'disabled') {
      errors.push(`权限授权 ${grant.grant_id} 状态无效。`);
    }

    validateEffectiveRange({ errors, id: `权限授权 ${grant.grant_id}`, row: grant });
  });

  rows.identity_ledger_resource_grants.forEach((grant) => {
    if (!userIds.has(grant.user_id)) {
      errors.push(`账套资源授权 ${grant.grant_id} 关联的用户不存在。`);
    }

    if (!isValidLedgerKey(grant.ledger_key)) {
      errors.push(`账套资源授权 ${grant.grant_id} 账套 Key 无效。`);
    }

    if (grant.status !== 'active' && grant.status !== 'disabled') {
      errors.push(`账套资源授权 ${grant.grant_id} 状态无效。`);
    }

    validateEffectiveRange({ errors, id: `账套资源授权 ${grant.grant_id}`, row: grant });
  });

  return createValidationResult(errors);
}

export function createFinanceIdentityResourceSqlSessionResolver({
  cookieName = 'sms_session',
  hashToken,
  now = () => '1970-01-01T00:00:00+00:00',
  rows
}: {
  cookieName?: string;
  hashToken: (token: string) => string;
  now?: () => string;
  rows: FinanceIdentityResourceSqlRows;
}) {
  const validation = validateFinanceIdentityResourceSqlRows(rows);

  if (!validation.ok) {
    throw new Error(`Finance identity resource SQL rows are invalid: ${validation.errors.join(' ')}`);
  }

  const usersById = new Map(rows.identity_users.map((user) => [user.user_id, user]));
  const sessionsByTokenHash = new Map(
    rows.identity_sessions.map((session) => [session.session_token_hash, session])
  );

  return (request: FinanceHttpServerRuntimeIdentityRequest): FinanceHttpAuthenticatedPrincipal | undefined => {
    const bearerToken = parseBearerToken(request.authorization);
    const sessionToken = bearerToken ?? parseCookieToken({ cookieHeader: request.headers.cookie, cookieName });

    if (!sessionToken) {
      return undefined;
    }

    const currentTime = now();
    const session = sessionsByTokenHash.get(hashToken(sessionToken));

    if (!session || !isSessionUsableAt({ now: currentTime, session })) {
      return undefined;
    }

    const user = usersById.get(session.user_id);

    if (!user) {
      return undefined;
    }

    const permissionScopes = rows.identity_permission_grants
      .filter((grant) => grant.user_id === user.user_id)
      .filter((grant) => grant.status === 'active')
      .filter((grant) =>
        isEffectiveAt({
          effectiveFrom: grant.effective_from,
          effectiveTo: grant.effective_to,
          now: currentTime
        })
      )
      .map((grant) => grant.permission_scope);

    const resourceScopes = rows.identity_ledger_resource_grants
      .filter((grant) => grant.user_id === user.user_id)
      .filter((grant) => grant.status === 'active')
      .filter((grant) =>
        isEffectiveAt({
          effectiveFrom: grant.effective_from,
          effectiveTo: grant.effective_to,
          now: currentTime
        })
      )
      .map((grant) => toResourceScope(grant.ledger_key));

    return {
      actorSnapshot: {
        id: user.user_id,
        name: user.display_name
      },
      permissionScopes,
      resourceScopes,
      status: user.status
    };
  };
}
