import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import type { AccountingPeriodRecord, ActorSnapshot, ApiErrorResponse } from './periodCloseContract.js';
import type { GeneralLedgerLifecycleRow } from './accountingVoucherLifecycleContract.js';
import {
  buildGeneralLedgerReadModel,
  type GeneralLedgerOpeningBalanceRecord,
  type GeneralLedgerSubjectRecord,
  type GeneralLedgerSubjectType
} from './generalLedgerContract.js';

export type GeneralLedgerRouteMethod = 'GET';

export type GeneralLedgerRouteRequest = {
  method: GeneralLedgerRouteMethod;
  path: string;
  query?: Record<string, string | undefined>;
};

export type GeneralLedgerServerContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  permissionScopes: FinancePeriodClosePermissionScope[];
  requestId: string;
};

export type GeneralLedgerRouteState = {
  ledgerRows: GeneralLedgerLifecycleRow[];
  openingBalances?: GeneralLedgerOpeningBalanceRecord[];
  periods: AccountingPeriodRecord[];
  subjects: GeneralLedgerSubjectRecord[];
};

export type GeneralLedgerRouteResponse = {
  body: unknown;
  state: GeneralLedgerRouteState;
  status: number;
};

type GeneralLedgerRouteErrorCode = ApiErrorResponse['code'] | 'INVALID_REQUEST' | 'NOT_FOUND';

const subjectTypes: GeneralLedgerSubjectType[] = ['资产类', '负债类', '权益类', '成本类', '损益类'];

function cloneState(state: GeneralLedgerRouteState): GeneralLedgerRouteState {
  return {
    ledgerRows: state.ledgerRows.map((row) => ({ ...row })),
    ...(state.openingBalances ? { openingBalances: state.openingBalances.map((row) => ({ ...row })) } : {}),
    periods: state.periods.map((period) => ({ ...period })),
    subjects: state.subjects.map((subject) => ({ ...subject }))
  };
}

function withState(
  response: Omit<GeneralLedgerRouteResponse, 'state'>,
  state: GeneralLedgerRouteState
): GeneralLedgerRouteResponse {
  return {
    ...response,
    state
  };
}

function createRouteError({
  code,
  message,
  period,
  requestId,
  status
}: {
  code: GeneralLedgerRouteErrorCode;
  message: string;
  period?: string;
  requestId: string;
  status: number;
}): Omit<GeneralLedgerRouteResponse, 'state'> {
  return {
    body: {
      code,
      message,
      period,
      requestId
    },
    status
  };
}

function parsePeriodFromRequest(request: GeneralLedgerRouteRequest) {
  const match = request.path.match(/^\/api\/finance\/general-ledger(?:\/(\d{4}-\d{2}))?$/);

  if (!match) {
    return undefined;
  }

  return match[1] ?? request.query?.period;
}

function isValidPeriod(value: string | undefined): value is string {
  return Boolean(value?.match(/^\d{4}-\d{2}$/));
}

function resolveSubjectType(value: string | undefined) {
  if (!value || value === '全部') {
    return undefined;
  }

  return subjectTypes.includes(value as GeneralLedgerSubjectType)
    ? (value as GeneralLedgerSubjectType)
    : undefined;
}

function matchesKeyword(row: ReturnType<typeof buildGeneralLedgerReadModel>['rows'][number], keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return [
    row.subjectCode,
    row.subjectName,
    row.reportItem,
    row.statementTarget,
    ...row.entries.flatMap((entry) => [entry.voucherNo, entry.summary, entry.auxiliary])
  ].some((value) => value.toLowerCase().includes(normalizedKeyword));
}

function filterRows({
  keyword,
  readModel,
  subjectType
}: {
  keyword?: string;
  readModel: ReturnType<typeof buildGeneralLedgerReadModel>;
  subjectType?: GeneralLedgerSubjectType;
}) {
  return readModel.rows
    .filter((row) => !subjectType || row.subjectType === subjectType)
    .filter((row) => matchesKeyword(row, keyword ?? ''));
}

export function handleGeneralLedgerRoute({
  context,
  request,
  state
}: {
  context: GeneralLedgerServerContext;
  request: GeneralLedgerRouteRequest;
  state: GeneralLedgerRouteState;
}): GeneralLedgerRouteResponse {
  const currentState = cloneState(state);
  const period = parsePeriodFromRequest(request);

  if (request.method !== 'GET' || !request.path.startsWith('/api/finance/general-ledger')) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '接口不存在。',
        requestId: context.requestId,
        status: 404
      }),
      currentState
    );
  }

  if (!isValidPeriod(period)) {
    return withState(
      createRouteError({
        code: 'INVALID_REQUEST',
        message: '总账读取必须提供 YYYY-MM 格式的会计期间。',
        requestId: context.requestId,
        status: 400
      }),
      currentState
    );
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: '查看总账和科目余额',
    period,
    requiredPermissionScope: 'finance.generalLedger.read'
  });

  if (!authorization.allowed) {
    return withState(
      {
        body: authorization.error,
        status: 403
      },
      currentState
    );
  }

  const periodRecord = currentState.periods.find((item) => item.period === period);

  if (!periodRecord) {
    return withState(
      createRouteError({
        code: 'NOT_FOUND',
        message: '会计期间不存在。',
        period,
        requestId: context.requestId,
        status: 404
      }),
      currentState
    );
  }

  const readModel = buildGeneralLedgerReadModel({
    accountingPeriod: period,
    ledgerRows: currentState.ledgerRows,
    openingBalances: currentState.openingBalances,
    periods: currentState.periods,
    subjects: currentState.subjects
  });
  const subjectType = resolveSubjectType(request.query?.subjectType);
  const rows = filterRows({
    keyword: request.query?.keyword,
    readModel,
    subjectType
  });

  return withState(
    {
      body: {
        ...readModel,
        rows,
        serverTime: context.now
      },
      status: 200
    },
    currentState
  );
}
