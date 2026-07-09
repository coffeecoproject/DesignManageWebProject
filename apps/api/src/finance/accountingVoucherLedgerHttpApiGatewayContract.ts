import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import type { AccountingPeriodRecord, ActorSnapshot } from './periodCloseContract.js';
import type {
  AccountingVoucherLedgerRepository,
  AccountingVoucherLedgerRepositorySnapshot
} from './accountingVoucherLedgerRepositoryContract.js';
import type {
  AccountingVoucherLifecycleBusinessType,
  AccountingVoucherLifecycleLine,
  AccountingVoucherLifecycleResult,
  AccountingVoucherSourceSnapshot
} from './accountingVoucherLifecycleContract.js';

export type AccountingVoucherLedgerHttpApiGatewayRequest = {
  body?: unknown;
  headers?: Record<string, string | undefined>;
  method: string;
  path: string;
};

export type AccountingVoucherLedgerHttpApiGatewayResponse = {
  accountingVoucherSnapshot: AccountingVoucherLedgerRepositorySnapshot;
  body: unknown;
  headers: Record<string, string>;
  status: number;
};

type RequestContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  permissionScopes: FinancePeriodClosePermissionScope[];
  requestId: string;
};

type PrepareVoucherBody = {
  expectedSourceHash: string;
  idempotencyKey: string;
  lines: AccountingVoucherLifecycleLine[];
  sourceSnapshot: AccountingVoucherSourceSnapshot;
};

type BookVoucherBody = {
  idempotencyKey: string;
  version: number;
};

type ReverseVoucherBody = {
  idempotencyKey: string;
  reason: string;
  version: number;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

const defaultActorSnapshot: ActorSnapshot = {
  id: 'system-local-api',
  name: '本地 API'
};

const voucherBusinessTypes: AccountingVoucherLifecycleBusinessType[] = [
  '权责凭证',
  '资金凭证',
  '税费凭证',
  '调整凭证'
];

function normalizeHeaders(headers: Record<string, string | undefined> = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function parsePermissionScopes(value: string | undefined): FinancePeriodClosePermissionScope[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean) as FinancePeriodClosePermissionScope[];
}

function createContext(request: AccountingVoucherLedgerHttpApiGatewayRequest): RequestContext {
  const headers = normalizeHeaders(request.headers);

  return {
    actorSnapshot: {
      id: headers['x-actor-id'] || defaultActorSnapshot.id,
      name: headers['x-actor-name'] || defaultActorSnapshot.name
    },
    now: headers['x-request-time'] || '1970-01-01T00:00:00+00:00',
    permissionScopes: parsePermissionScopes(headers['x-permission-scopes']),
    requestId: headers['x-request-id'] || 'local-http-request'
  };
}

function createResponse({
  body,
  repository,
  status
}: {
  body: unknown;
  repository: AccountingVoucherLedgerRepository;
  status: number;
}): AccountingVoucherLedgerHttpApiGatewayResponse {
  return {
    accountingVoucherSnapshot: repository.readSnapshot(),
    body,
    headers: jsonHeaders,
    status
  };
}

function createErrorResponse({
  code,
  message,
  repository,
  requestId,
  sourceId,
  status
}: {
  code: string;
  message: string;
  repository: AccountingVoucherLedgerRepository;
  requestId: string;
  sourceId?: string;
  status: number;
}) {
  return createResponse({
    body: {
      code,
      message,
      requestId,
      sourceId,
      sourceModule: sourceId ? 'accounting_voucher' : undefined
    },
    repository,
    status
  });
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseLine(value: unknown): AccountingVoucherLifecycleLine | undefined {
  const objectValue = toObject(value);
  const amount = objectValue.amount;
  const auxiliary = objectValue.auxiliary;
  const id = objectValue.id;
  const side = objectValue.side;
  const subjectCode = objectValue.subjectCode;
  const subjectName = objectValue.subjectName;
  const summary = objectValue.summary;

  if (
    typeof amount !== 'string' ||
    typeof auxiliary !== 'string' ||
    typeof id !== 'string' ||
    (side !== '借方' && side !== '贷方') ||
    typeof subjectCode !== 'string' ||
    typeof subjectName !== 'string' ||
    typeof summary !== 'string'
  ) {
    return undefined;
  }

  return {
    amount,
    auxiliary,
    id,
    side,
    subjectCode,
    subjectName,
    summary
  };
}

function parseSourceSnapshot(value: unknown): AccountingVoucherSourceSnapshot | undefined {
  const objectValue = toObject(value);
  const accountingPeriod = objectValue.accountingPeriod;
  const amount = objectValue.amount;
  const businessType = objectValue.businessType;
  const sourceHash = objectValue.sourceHash;
  const sourceId = objectValue.sourceId;
  const sourceModule = objectValue.sourceModule;
  const sourceNo = objectValue.sourceNo;
  const sourceTitle = objectValue.sourceTitle;
  const sourceVersion = objectValue.sourceVersion;
  const voucherDate = objectValue.voucherDate;

  if (
    typeof accountingPeriod !== 'string' ||
    typeof amount !== 'string' ||
    !voucherBusinessTypes.includes(businessType as AccountingVoucherLifecycleBusinessType) ||
    typeof sourceHash !== 'string' ||
    typeof sourceId !== 'string' ||
    typeof sourceModule !== 'string' ||
    typeof sourceNo !== 'string' ||
    typeof sourceTitle !== 'string' ||
    typeof sourceVersion !== 'number' ||
    typeof voucherDate !== 'string'
  ) {
    return undefined;
  }

  return {
    accountingPeriod,
    amount,
    businessType: businessType as AccountingVoucherSourceSnapshot['businessType'],
    sourceHash,
    sourceId,
    sourceModule,
    sourceNo,
    sourceTitle,
    sourceVersion,
    voucherDate
  };
}

function parsePrepareBody(body: unknown): PrepareVoucherBody | undefined {
  const objectBody = toObject(body);
  const expectedSourceHash = objectBody.expectedSourceHash;
  const idempotencyKey = objectBody.idempotencyKey;
  const lines = objectBody.lines;
  const sourceSnapshot = parseSourceSnapshot(objectBody.sourceSnapshot);

  if (
    typeof expectedSourceHash !== 'string' ||
    typeof idempotencyKey !== 'string' ||
    !Array.isArray(lines) ||
    !sourceSnapshot
  ) {
    return undefined;
  }

  const parsedLines = lines.map(parseLine);

  if (parsedLines.some((line) => line === undefined)) {
    return undefined;
  }

  return {
    expectedSourceHash,
    idempotencyKey,
    lines: parsedLines as AccountingVoucherLifecycleLine[],
    sourceSnapshot
  };
}

function parseBookBody(body: unknown): BookVoucherBody | undefined {
  const objectBody = toObject(body);
  const idempotencyKey = objectBody.idempotencyKey;
  const version = objectBody.version;

  if (typeof idempotencyKey !== 'string' || typeof version !== 'number') {
    return undefined;
  }

  return {
    idempotencyKey,
    version
  };
}

function parseReverseBody(body: unknown): ReverseVoucherBody | undefined {
  const objectBody = toObject(body);
  const idempotencyKey = objectBody.idempotencyKey;
  const reason = objectBody.reason;
  const version = objectBody.version;

  if (typeof idempotencyKey !== 'string' || typeof reason !== 'string' || typeof version !== 'number') {
    return undefined;
  }

  return {
    idempotencyKey,
    reason,
    version
  };
}

function getVoucherIdFromActionPath(path: string, action: 'book' | 'reverse') {
  const match = new RegExp(`^/api/finance/accounting-vouchers/([^/]+)/${action}$`).exec(path);

  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function statusFromLifecycleResult(result: AccountingVoucherLifecycleResult) {
  if (result.ok) {
    return result.replayed ? 200 : 201;
  }

  if (result.error.code === 'VOUCHER_NOT_FOUND') {
    return 404;
  }

  if (
    result.error.code === 'INVALID_VOUCHER_REQUEST' ||
    result.error.code === 'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED'
  ) {
    return 400;
  }

  if (
    result.error.code === 'VOUCHER_NOT_BALANCED' ||
    result.error.code === 'VOUCHER_SOURCE_CHANGED'
  ) {
    return 422;
  }

  return 409;
}

function responseBodyFromLifecycleResult(result: AccountingVoucherLifecycleResult) {
  if (!result.ok) {
    return result.error;
  }

  return {
    ledgerRows: result.ledgerRows.filter((row) => row.voucherId === result.voucher.id),
    replayed: result.replayed,
    voucher: result.voucher
  };
}

function findVoucher(repository: AccountingVoucherLedgerRepository, voucherId: string) {
  return repository.readSnapshot().vouchers.find((voucher) => voucher.id === voucherId);
}

function handlePrepareVoucher({
  context,
  periods,
  repository,
  request
}: {
  context: RequestContext;
  periods: AccountingPeriodRecord[];
  repository: AccountingVoucherLedgerRepository;
  request: AccountingVoucherLedgerHttpApiGatewayRequest;
}) {
  const body = parsePrepareBody(request.body);

  if (!body) {
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: '请求体必须包含 expectedSourceHash、idempotencyKey、sourceSnapshot 和完整分录。',
      repository,
      requestId: context.requestId,
      status: 400
    });
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '制单会计凭证',
    period: body.sourceSnapshot.accountingPeriod,
    requiredPermissionScope: 'finance.accountingVoucher.prepare',
    sourceId: body.sourceSnapshot.sourceId,
    sourceModule: 'accounting_voucher'
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  const result = repository.prepareVoucher({
    lines: body.lines,
    periods,
    request: {
      actorSnapshot: context.actorSnapshot,
      expectedSourceHash: body.expectedSourceHash,
      idempotencyKey: body.idempotencyKey,
      now: context.now,
      requestId: context.requestId
    },
    sourceSnapshot: body.sourceSnapshot
  });

  return createResponse({
    body: responseBodyFromLifecycleResult(result),
    repository,
    status: statusFromLifecycleResult(result)
  });
}

function handleBookVoucher({
  context,
  periods,
  repository,
  request,
  voucherId
}: {
  context: RequestContext;
  periods: AccountingPeriodRecord[];
  repository: AccountingVoucherLedgerRepository;
  request: AccountingVoucherLedgerHttpApiGatewayRequest;
  voucherId: string;
}) {
  const body = parseBookBody(request.body);

  if (!body) {
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: '请求体必须包含 version 和 idempotencyKey。',
      repository,
      requestId: context.requestId,
      sourceId: voucherId,
      status: 400
    });
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '记账会计凭证',
    requiredPermissionScope: 'finance.accountingVoucher.book',
    sourceId: voucherId,
    sourceModule: 'accounting_voucher'
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  const voucher = findVoucher(repository, voucherId);

  if (!voucher) {
    return createErrorResponse({
      code: 'VOUCHER_NOT_FOUND',
      message: '会计凭证不存在。',
      repository,
      requestId: context.requestId,
      sourceId: voucherId,
      status: 404
    });
  }

  if (body.version !== voucher.version) {
    return createErrorResponse({
      code: 'VERSION_CONFLICT',
      message: '凭证版本已变化，请刷新后重试。',
      repository,
      requestId: context.requestId,
      sourceId: voucherId,
      status: 409
    });
  }

  const result = repository.bookVoucher({
    periods,
    request: {
      actorSnapshot: context.actorSnapshot,
      idempotencyKey: body.idempotencyKey,
      now: context.now,
      requestId: context.requestId
    },
    voucherId
  });

  return createResponse({
    body: responseBodyFromLifecycleResult(result),
    repository,
    status: statusFromLifecycleResult(result)
  });
}

function handleReverseVoucher({
  context,
  periods,
  repository,
  request,
  voucherId
}: {
  context: RequestContext;
  periods: AccountingPeriodRecord[];
  repository: AccountingVoucherLedgerRepository;
  request: AccountingVoucherLedgerHttpApiGatewayRequest;
  voucherId: string;
}) {
  const body = parseReverseBody(request.body);

  if (!body) {
    return createErrorResponse({
      code: 'INVALID_REQUEST',
      message: '请求体必须包含 version、reason 和 idempotencyKey。',
      repository,
      requestId: context.requestId,
      sourceId: voucherId,
      status: 400
    });
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '冲销会计凭证',
    requiredPermissionScope: 'finance.accountingVoucher.reverse',
    sourceId: voucherId,
    sourceModule: 'accounting_voucher'
  });

  if (!authorization.allowed) {
    return createResponse({
      body: authorization.error,
      repository,
      status: 403
    });
  }

  const voucher = findVoucher(repository, voucherId);

  if (!voucher) {
    return createErrorResponse({
      code: 'VOUCHER_NOT_FOUND',
      message: '会计凭证不存在。',
      repository,
      requestId: context.requestId,
      sourceId: voucherId,
      status: 404
    });
  }

  if (body.version !== voucher.version) {
    return createErrorResponse({
      code: 'VERSION_CONFLICT',
      message: '凭证版本已变化，请刷新后重试。',
      repository,
      requestId: context.requestId,
      sourceId: voucherId,
      status: 409
    });
  }

  const result = repository.reverseVoucher({
    periods,
    request: {
      actorSnapshot: context.actorSnapshot,
      idempotencyKey: body.idempotencyKey,
      now: context.now,
      reason: body.reason,
      requestId: context.requestId
    },
    voucherId
  });

  return createResponse({
    body: responseBodyFromLifecycleResult(result),
    repository,
    status: statusFromLifecycleResult(result)
  });
}

export function handleAccountingVoucherLedgerHttpApiGateway({
  periods,
  repository,
  request
}: {
  periods: AccountingPeriodRecord[];
  repository: AccountingVoucherLedgerRepository;
  request: AccountingVoucherLedgerHttpApiGatewayRequest;
}): AccountingVoucherLedgerHttpApiGatewayResponse {
  const method = request.method.toUpperCase();
  const context = createContext(request);

  if (method === 'POST' && request.path === '/api/finance/accounting-vouchers/prepare') {
    return handlePrepareVoucher({ context, periods, repository, request });
  }

  if (method === 'POST') {
    const bookVoucherId = getVoucherIdFromActionPath(request.path, 'book');

    if (bookVoucherId) {
      return handleBookVoucher({
        context,
        periods,
        repository,
        request,
        voucherId: bookVoucherId
      });
    }

    const reverseVoucherId = getVoucherIdFromActionPath(request.path, 'reverse');

    if (reverseVoucherId) {
      return handleReverseVoucher({
        context,
        periods,
        repository,
        request,
        voucherId: reverseVoucherId
      });
    }
  }

  return createErrorResponse({
    code: 'NOT_FOUND',
    message: '接口不存在。',
    repository,
    requestId: context.requestId,
    status: 404
  });
}
