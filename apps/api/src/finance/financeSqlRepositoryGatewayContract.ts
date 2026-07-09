import { buildFinancialStatementLedgerEntriesFromGeneralLedgerRows } from './generalLedgerContract.js';
import {
  createGeneralLedgerSqlReadRepository,
  type GeneralLedgerSqlRows
} from './generalLedgerSqlRepositoryContract.js';
import { handleGeneralLedgerRoute } from './generalLedgerRoutes.js';
import {
  createFinancialStatementSqlRepository,
  type FinancialStatementSqlRows
} from './financialStatementSqlRepositoryContract.js';
import {
  handleFinancialStatementRoute,
  type FinancialStatementRouteState
} from './financialStatementRoutes.js';
import {
  handleFinanceHttpApiRepositoryGateway,
  type FinanceHttpApiRepositoryGatewayRequest
} from './financeHttpApiRepositoryGatewayContract.js';
import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import type {
  PeriodCloseDatabaseRepository,
  PeriodCloseDatabaseRepositorySnapshot
} from './periodCloseDatabaseRepositoryContract.js';
import type { ActorSnapshot } from './periodCloseContract.js';

export type FinanceSqlRepositoryGatewaySnapshot = {
  financialStatementRows: FinancialStatementSqlRows;
  generalLedgerRows: GeneralLedgerSqlRows;
  periodCloseSnapshot: PeriodCloseDatabaseRepositorySnapshot;
};

export type FinanceSqlRepositoryGatewayResponse = FinanceSqlRepositoryGatewaySnapshot & {
  body: unknown;
  headers: Record<string, string>;
  status: number;
};

export type FinanceSqlRepositoryGateway = {
  handle: (request: FinanceHttpApiRepositoryGatewayRequest) => FinanceSqlRepositoryGatewayResponse;
  readSnapshot: () => FinanceSqlRepositoryGatewaySnapshot;
};

type RequestContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  permissionScopes: FinancePeriodClosePermissionScope[];
  requestId: string;
};

type SnapshotRequestBody = {
  expectedCashFlowMappingVersionHash?: string;
  expectedSourceLedgerHash?: string;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8'
};

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

function createContext(request: FinanceHttpApiRepositoryGatewayRequest): RequestContext {
  const headers = normalizeHeaders(request.headers);

  return {
    actorSnapshot: {
      id: headers['x-actor-id'] || 'system-local-api',
      name: headers['x-actor-name'] || '本地 API'
    },
    now: headers['x-request-time'] || '1970-01-01T00:00:00+00:00',
    permissionScopes: parsePermissionScopes(headers['x-permission-scopes']),
    requestId: headers['x-request-id'] || 'local-http-request'
  };
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseSnapshotRequestBody(body: unknown): SnapshotRequestBody | undefined {
  if (body === undefined) {
    return {};
  }

  const objectBody = toObject(body);
  const expectedCashFlowMappingVersionHash = objectBody.expectedCashFlowMappingVersionHash;
  const expectedSourceLedgerHash = objectBody.expectedSourceLedgerHash;

  if (
    (expectedCashFlowMappingVersionHash !== undefined && typeof expectedCashFlowMappingVersionHash !== 'string') ||
    (expectedSourceLedgerHash !== undefined && typeof expectedSourceLedgerHash !== 'string')
  ) {
    return undefined;
  }

  return {
    expectedCashFlowMappingVersionHash,
    expectedSourceLedgerHash
  };
}

function getGeneralLedgerPeriod(path: string) {
  const match = /^\/api\/finance\/general-ledger\/(\d{4}-\d{2})$/.exec(path);

  return match?.[1];
}

function parseFinancialStatementPath(path: string) {
  const match = /^\/api\/finance\/financial-statements\/(\d{4}-\d{2})\/(readiness|snapshots|snapshots\/latest)$/.exec(path);

  if (!match) {
    return undefined;
  }

  return {
    action: match[2],
    period: match[1]
  };
}

function statusFromSnapshotErrorCode(code: string) {
  if (code === 'FINANCIAL_STATEMENT_READINESS_STALE') {
    return 409;
  }

  if (code === 'FINANCIAL_STATEMENT_PERIOD_NOT_CLOSED' || code === 'CASH_FLOW_MAPPING_INCOMPLETE') {
    return 422;
  }

  return 400;
}

function createResponse({
  body,
  financialStatementRows,
  generalLedgerRows,
  periodRepository,
  status
}: {
  body: unknown;
  financialStatementRows: FinancialStatementSqlRows;
  generalLedgerRows: GeneralLedgerSqlRows;
  periodRepository: PeriodCloseDatabaseRepository;
  status: number;
}): FinanceSqlRepositoryGatewayResponse {
  return {
    body,
    financialStatementRows,
    generalLedgerRows,
    headers: jsonHeaders,
    periodCloseSnapshot: periodRepository.readDatabaseSnapshot(),
    status
  };
}

function createErrorResponse({
  code,
  financialStatementRows,
  generalLedgerRows,
  message,
  period,
  periodRepository,
  requestId,
  status
}: {
  code: string;
  financialStatementRows: FinancialStatementSqlRows;
  generalLedgerRows: GeneralLedgerSqlRows;
  message: string;
  period?: string;
  periodRepository: PeriodCloseDatabaseRepository;
  requestId: string;
  status: number;
}) {
  return createResponse({
    body: {
      code,
      message,
      period,
      requestId
    },
    financialStatementRows,
    generalLedgerRows,
    periodRepository,
    status
  });
}

function getCurrentPeriods(periodRepository: PeriodCloseDatabaseRepository) {
  return periodRepository.readState().periods;
}

function createGeneralLedgerRepository({
  generalLedgerRows,
  periodRepository
}: {
  generalLedgerRows: GeneralLedgerSqlRows;
  periodRepository: PeriodCloseDatabaseRepository;
}) {
  return createGeneralLedgerSqlReadRepository({
    periods: getCurrentPeriods(periodRepository),
    rows: generalLedgerRows
  });
}

function createFinancialStatementRepository({
  financialStatementRows,
  generalLedgerRows,
  periodRepository,
  statementLineInputs
}: {
  financialStatementRows: FinancialStatementSqlRows;
  generalLedgerRows: GeneralLedgerSqlRows;
  periodRepository: PeriodCloseDatabaseRepository;
  statementLineInputs?: FinancialStatementRouteState['statementLineInputs'];
}) {
  const generalLedgerRepository = createGeneralLedgerRepository({ generalLedgerRows, periodRepository });
  const ledgerEntries = buildFinancialStatementLedgerEntriesFromGeneralLedgerRows(
    generalLedgerRepository.readRouteState().ledgerRows
  );

  return createFinancialStatementSqlRepository({
    ledgerEntries,
    periods: getCurrentPeriods(periodRepository),
    rows: financialStatementRows,
    statementLineInputs
  });
}

export function createFinanceSqlRepositoryGateway({
  financialStatementRows,
  generalLedgerRows,
  periodRepository,
  statementLineInputs
}: {
  financialStatementRows: FinancialStatementSqlRows;
  generalLedgerRows: GeneralLedgerSqlRows;
  periodRepository: PeriodCloseDatabaseRepository;
  statementLineInputs?: FinancialStatementRouteState['statementLineInputs'];
}): FinanceSqlRepositoryGateway {
  let currentFinancialStatementRows = financialStatementRows;

  const readSnapshot = (): FinanceSqlRepositoryGatewaySnapshot => ({
    financialStatementRows: currentFinancialStatementRows,
    generalLedgerRows,
    periodCloseSnapshot: periodRepository.readDatabaseSnapshot()
  });

  return {
    handle: (request) => {
      const method = request.method.toUpperCase();
      const context = createContext(request);
      const generalLedgerRepository = createGeneralLedgerRepository({ generalLedgerRows, periodRepository });

      if (method === 'GET') {
        const generalLedgerPeriod = getGeneralLedgerPeriod(request.path);

        if (generalLedgerPeriod) {
          const response = handleGeneralLedgerRoute({
            context,
            request: {
              method: 'GET',
              path: request.path
            },
            state: generalLedgerRepository.readRouteState()
          });

          return createResponse({
            body: response.body,
            financialStatementRows: currentFinancialStatementRows,
            generalLedgerRows,
            periodRepository,
            status: response.status
          });
        }
      }

      const financialStatementPath = parseFinancialStatementPath(request.path);

      if (financialStatementPath && method === 'GET') {
        const financialStatementRepository = createFinancialStatementRepository({
          financialStatementRows: currentFinancialStatementRows,
          generalLedgerRows,
          periodRepository,
          statementLineInputs
        });
        const response = handleFinancialStatementRoute({
          context,
          request: {
            method: 'GET',
            path: request.path
          },
          state: financialStatementRepository.readRouteState()
        });

        return createResponse({
          body: response.body,
          financialStatementRows: currentFinancialStatementRows,
          generalLedgerRows,
          periodRepository,
          status: response.status
        });
      }

      if (financialStatementPath?.action === 'snapshots' && method === 'POST') {
        const authorization = authorizeFinancePeriodCloseOperation({
          context,
          operation: '生成财务报表快照',
          period: financialStatementPath.period,
          requiredPermissionScope: 'finance.financialStatement.generate'
        });

        if (!authorization.allowed) {
          return createResponse({
            body: authorization.error,
            financialStatementRows: currentFinancialStatementRows,
            generalLedgerRows,
            periodRepository,
            status: 403
          });
        }

        const requestBody = parseSnapshotRequestBody(request.body);

        if (!requestBody) {
          return createErrorResponse({
            code: 'INVALID_REQUEST',
            financialStatementRows: currentFinancialStatementRows,
            generalLedgerRows,
            message: '报表快照生成请求只能包含 expectedSourceLedgerHash 和 expectedCashFlowMappingVersionHash。',
            period: financialStatementPath.period,
            periodRepository,
            requestId: context.requestId,
            status: 400
          });
        }

        const financialStatementRepository = createFinancialStatementRepository({
          financialStatementRows: currentFinancialStatementRows,
          generalLedgerRows,
          periodRepository,
          statementLineInputs
        });
        const result = financialStatementRepository.createSnapshot({
          accountingPeriod: financialStatementPath.period,
          expectedCashFlowMappingVersionHash: requestBody.expectedCashFlowMappingVersionHash,
          expectedSourceLedgerHash: requestBody.expectedSourceLedgerHash,
          request: {
            generatedAt: context.now,
            generatedBySnapshot: context.actorSnapshot,
            requestId: context.requestId
          }
        });

        if (!result.ok) {
          return createResponse({
            body: result.error,
            financialStatementRows: result.rows,
            generalLedgerRows,
            periodRepository,
            status: statusFromSnapshotErrorCode(result.error.code)
          });
        }

        currentFinancialStatementRows = result.rows;
        periodRepository.commitFinancialStatementSnapshot(result.snapshot);

        return createResponse({
          body: {
            replayed: result.replayed,
            snapshot: result.snapshot
          },
          financialStatementRows: currentFinancialStatementRows,
          generalLedgerRows,
          periodRepository,
          status: result.replayed ? 200 : 201
        });
      }

      const delegatedResponse = handleFinanceHttpApiRepositoryGateway({
        repository: periodRepository,
        request
      });

      return createResponse({
        body: delegatedResponse.body,
        financialStatementRows: currentFinancialStatementRows,
        generalLedgerRows,
        periodRepository,
        status: delegatedResponse.status
      });
    },
    readSnapshot
  };
}
