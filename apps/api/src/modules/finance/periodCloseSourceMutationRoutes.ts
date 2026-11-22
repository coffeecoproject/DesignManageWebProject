import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord, type ActorSnapshot } from './periodCloseContract.js';
import {
  authorizeFinancePeriodCloseOperation,
  type FinancePeriodClosePermissionScope
} from './periodCloseAuthorizationContract.js';
import {
  financeSourceMutationAreaLabels,
  guardFinanceSourceMutation,
  sourceAccountingPeriodUnresolvedErrorCode,
  type FinanceSourceMutationArea
} from './periodCloseSourceMutationGuard.js';
import { resolveFinanceSourceMutationGuardPeriods } from './periodCloseSourceMutationOperationMetadata.js';

export type FinanceSourceMutationRouteMethod = 'PATCH' | 'POST';

export type FinanceSourceMutationRouteRequest = {
  body?: unknown;
  method: FinanceSourceMutationRouteMethod;
  path: string;
};

export type FinanceSourceMutationServerContext = {
  actorSnapshot: ActorSnapshot;
  now: string;
  permissionScopes: FinancePeriodClosePermissionScope[];
  requestId: string;
};

export type FinanceSourceMutationRecord = {
  accountingPeriod?: string;
  amount: string;
  id: string;
  sourceArea: FinanceSourceMutationArea;
  sourceNo: string;
  status: string;
  version: number;
};

export type FinanceSourceMutationEvent = {
  actorSnapshot: ActorSnapshot;
  affectedAccountingPeriods: string[];
  eventType: 'source_mutation_applied' | 'source_mutation_rejected';
  operation: string;
  requestId: string;
  sourceArea: FinanceSourceMutationArea;
  sourceId: string;
  timestamp: string;
};

export type FinanceSourceMutationRouteState = {
  events: FinanceSourceMutationEvent[];
  periods: AccountingPeriodRecord[];
  sourceRecords: FinanceSourceMutationRecord[];
};

export type FinanceSourceMutationRouteResponse = {
  body: unknown;
  state: FinanceSourceMutationRouteState;
  status: number;
};

type SourceMutationRouteDefinition = {
  createsSourceRecord?: boolean;
  method: FinanceSourceMutationRouteMethod;
  operation: string;
  pathPattern: RegExp;
  permissionScope: FinancePeriodClosePermissionScope;
  sourceArea: FinanceSourceMutationArea;
  sourceIdFromBody?: boolean;
  successStatus: string;
};

type SourceMutationBody = {
  amount?: string;
  sourceId?: string;
  sourceNo?: string;
  status?: string;
  targetAccountingPeriod?: string;
};

export const financeSourceMutationRouteDefinitions: SourceMutationRouteDefinition[] = [
  {
    createsSourceRecord: true,
    method: 'POST',
    operation: '新增应收应付事项',
    pathPattern: /^\/api\/finance\/receivables-payables$/,
    permissionScope: 'finance.receivablePayable.write',
    sourceArea: 'receivable_payable',
    sourceIdFromBody: true,
    successStatus: '已生成'
  },
  {
    createsSourceRecord: true,
    method: 'POST',
    operation: '导入税务发票数据',
    pathPattern: /^\/api\/finance\/invoices\/import$/,
    permissionScope: 'finance.invoiceLedger.write',
    sourceArea: 'invoice_ledger',
    sourceIdFromBody: true,
    successStatus: '已导入'
  },
  {
    method: 'PATCH',
    operation: '调整应收应付事项',
    pathPattern: /^\/api\/finance\/receivables-payables\/([^/]+)\/adjust$/,
    permissionScope: 'finance.receivablePayable.write',
    sourceArea: 'receivable_payable',
    successStatus: '已调整'
  },
  {
    method: 'POST',
    operation: '登记应收应付收付款',
    pathPattern: /^\/api\/finance\/receivables-payables\/([^/]+)\/settlements$/,
    permissionScope: 'finance.receivablePayable.write',
    sourceArea: 'receivable_payable',
    successStatus: '待复核'
  },
  {
    method: 'POST',
    operation: '作废应收应付事项',
    pathPattern: /^\/api\/finance\/receivables-payables\/([^/]+)\/void$/,
    permissionScope: 'finance.receivablePayable.write',
    sourceArea: 'receivable_payable',
    successStatus: '已作废'
  },
  {
    method: 'POST',
    operation: '确认应收应付税额依据',
    pathPattern: /^\/api\/finance\/receivables-payables\/([^/]+)\/tax-basis$/,
    permissionScope: 'finance.receivablePayable.write',
    sourceArea: 'receivable_payable',
    successStatus: '税额已确认'
  },
  {
    method: 'PATCH',
    operation: '保存发票关联',
    pathPattern: /^\/api\/finance\/invoices\/([^/]+)\/associations$/,
    permissionScope: 'finance.invoiceLedger.write',
    sourceArea: 'invoice_ledger',
    successStatus: '关联已保存'
  },
  {
    method: 'PATCH',
    operation: '从应收应付关联发票',
    pathPattern: /^\/api\/finance\/receivables-payables\/([^/]+)\/invoice-associations$/,
    permissionScope: 'finance.receivablePayable.write',
    sourceArea: 'receivable_payable',
    successStatus: '关联已保存'
  },
  {
    method: 'POST',
    operation: '确认红票原票关系',
    pathPattern: /^\/api\/finance\/invoices\/([^/]+)\/red-original$/,
    permissionScope: 'finance.invoiceLedger.write',
    sourceArea: 'invoice_ledger',
    successStatus: '红票已关联'
  },
  {
    method: 'POST',
    operation: '复核流水入账',
    pathPattern: /^\/api\/finance\/cash-flows\/([^/]+)\/review$/,
    permissionScope: 'finance.cashFlow.review',
    sourceArea: 'cash_flow_review',
    successStatus: '已入账'
  },
  {
    method: 'POST',
    operation: '退回流水复核',
    pathPattern: /^\/api\/finance\/cash-flows\/([^/]+)\/return$/,
    permissionScope: 'finance.cashFlow.review',
    sourceArea: 'cash_flow_review',
    successStatus: '退回修改'
  },
  {
    method: 'POST',
    operation: '作废流水',
    pathPattern: /^\/api\/finance\/cash-flows\/([^/]+)\/void$/,
    permissionScope: 'finance.cashFlow.review',
    sourceArea: 'cash_flow_review',
    successStatus: '已作废'
  },
  {
    method: 'POST',
    operation: '补充流水凭证',
    pathPattern: /^\/api\/finance\/cash-flows\/([^/]+)\/voucher-files$/,
    permissionScope: 'finance.cashFlow.review',
    sourceArea: 'cash_flow_review',
    successStatus: '凭证已补充'
  },
  {
    method: 'POST',
    operation: '生成冲正补差流水',
    pathPattern: /^\/api\/finance\/cash-flows\/([^/]+)\/adjustments$/,
    permissionScope: 'finance.cashFlow.review',
    sourceArea: 'cash_flow_review',
    successStatus: '待复核'
  },
  {
    method: 'POST',
    operation: '确认银行对账',
    pathPattern: /^\/api\/finance\/bank-reconciliation\/([^/]+)\/confirm$/,
    permissionScope: 'finance.bankReconciliation.reconcile',
    sourceArea: 'bank_reconciliation',
    successStatus: '已对账'
  },
  {
    method: 'POST',
    operation: '撤销银行对账',
    pathPattern: /^\/api\/finance\/bank-reconciliation\/([^/]+)\/revoke$/,
    permissionScope: 'finance.bankReconciliation.reconcile',
    sourceArea: 'bank_reconciliation',
    successStatus: '已撤销对账'
  },
  {
    method: 'POST',
    operation: '补登记系统流水',
    pathPattern: /^\/api\/finance\/bank-reconciliation\/([^/]+)\/system-flow$/,
    permissionScope: 'finance.bankReconciliation.reconcile',
    sourceArea: 'bank_reconciliation',
    successStatus: '已登记系统流水'
  },
  {
    method: 'POST',
    operation: '生成对账调整流水',
    pathPattern: /^\/api\/finance\/bank-reconciliation\/([^/]+)\/adjustments$/,
    permissionScope: 'finance.bankReconciliation.reconcile',
    sourceArea: 'bank_reconciliation',
    successStatus: '已生成调整'
  },
  {
    method: 'POST',
    operation: '处理银行对账异常',
    pathPattern: /^\/api\/finance\/bank-reconciliation\/([^/]+)\/resolve-exception$/,
    permissionScope: 'finance.bankReconciliation.reconcile',
    sourceArea: 'bank_reconciliation',
    successStatus: '异常已处理'
  },
  {
    method: 'POST',
    operation: '制单会计凭证',
    pathPattern: /^\/api\/finance\/accounting-vouchers\/prepare$/,
    permissionScope: 'finance.accountingVoucher.prepare',
    sourceArea: 'accounting_voucher',
    sourceIdFromBody: true,
    successStatus: '已制单'
  },
  {
    method: 'POST',
    operation: '批量制单会计凭证',
    pathPattern: /^\/api\/finance\/accounting-vouchers\/batch-prepare$/,
    permissionScope: 'finance.accountingVoucher.prepare',
    sourceArea: 'accounting_voucher',
    sourceIdFromBody: true,
    successStatus: '已制单'
  },
  {
    method: 'POST',
    operation: '记账会计凭证',
    pathPattern: /^\/api\/finance\/accounting-vouchers\/([^/]+)\/book$/,
    permissionScope: 'finance.accountingVoucher.book',
    sourceArea: 'accounting_voucher',
    successStatus: '已记账'
  },
  {
    method: 'POST',
    operation: '批量记账会计凭证',
    pathPattern: /^\/api\/finance\/accounting-vouchers\/batch-book$/,
    permissionScope: 'finance.accountingVoucher.book',
    sourceArea: 'accounting_voucher',
    sourceIdFromBody: true,
    successStatus: '已记账'
  },
  {
    method: 'POST',
    operation: '冲销会计凭证',
    pathPattern: /^\/api\/finance\/accounting-vouchers\/([^/]+)\/reverse$/,
    permissionScope: 'finance.accountingVoucher.reverse',
    sourceArea: 'accounting_voucher',
    successStatus: '已冲销'
  },
  {
    method: 'POST',
    operation: '生成税费缴款流水',
    pathPattern: /^\/api\/finance\/tax-handling\/([^/]+)\/payment$/,
    permissionScope: 'finance.taxHandling.write',
    sourceArea: 'tax_handling',
    successStatus: '已缴款'
  },
  {
    method: 'POST',
    operation: '确认申报准备项',
    pathPattern: /^\/api\/finance\/declaration-preparation\/([^/]+)\/confirm-item$/,
    permissionScope: 'finance.taxHandling.write',
    sourceArea: 'tax_handling',
    successStatus: '准备项已确认'
  },
  {
    method: 'POST',
    operation: '确认申报准备结果',
    pathPattern: /^\/api\/finance\/declaration-preparation\/([^/]+)\/confirm$/,
    permissionScope: 'finance.taxHandling.write',
    sourceArea: 'tax_handling',
    successStatus: '可申报'
  },
  {
    method: 'POST',
    operation: '确认税务申报',
    pathPattern: /^\/api\/finance\/tax-handling\/([^/]+)\/declaration$/,
    permissionScope: 'finance.taxHandling.write',
    sourceArea: 'tax_handling',
    successStatus: '已申报'
  },
  {
    method: 'POST',
    operation: '更新税务办理回执',
    pathPattern: /^\/api\/finance\/tax-handling\/([^/]+)\/receipts$/,
    permissionScope: 'finance.taxHandling.write',
    sourceArea: 'tax_handling',
    successStatus: '回执已更新'
  },
  {
    method: 'POST',
    operation: '确认社保公积金明细',
    pathPattern: /^\/api\/finance\/social-insurance\/([^/]+)\/confirm-detail$/,
    permissionScope: 'finance.socialInsurance.write',
    sourceArea: 'social_insurance_housing_fund',
    successStatus: '已确认'
  },
  {
    method: 'POST',
    operation: '确认社保公积金缴费',
    pathPattern: /^\/api\/finance\/social-insurance\/([^/]+)\/confirm-payment$/,
    permissionScope: 'finance.socialInsurance.write',
    sourceArea: 'social_insurance_housing_fund',
    successStatus: '已缴费'
  },
  {
    method: 'POST',
    operation: '更新社保公积金回单',
    pathPattern: /^\/api\/finance\/social-insurance\/([^/]+)\/receipts$/,
    permissionScope: 'finance.socialInsurance.write',
    sourceArea: 'social_insurance_housing_fund',
    successStatus: '回单已更新'
  },
  {
    method: 'POST',
    operation: '确认薪酬社保结果',
    pathPattern: /^\/api\/finance\/payroll-results\/([^/]+)\/confirm$/,
    permissionScope: 'finance.payroll.write',
    sourceArea: 'payroll',
    successStatus: '已确认'
  },
  {
    method: 'POST',
    operation: '结算薪酬社保结果',
    pathPattern: /^\/api\/finance\/payroll-results\/([^/]+)\/settle$/,
    permissionScope: 'finance.payroll.write',
    sourceArea: 'payroll',
    successStatus: '已结算'
  },
  {
    method: 'POST',
    operation: '新增薪酬调整',
    pathPattern: /^\/api\/finance\/payroll-results\/([^/]+)\/adjustments$/,
    permissionScope: 'finance.payroll.write',
    sourceArea: 'payroll',
    successStatus: '已调整'
  },
  {
    method: 'POST',
    operation: '生成期初调整凭证',
    pathPattern: /^\/api\/finance\/ledger-initialization\/([^/]+)\/opening-adjustment$/,
    permissionScope: 'finance.ledgerInitialization.write',
    sourceArea: 'ledger_initialization',
    successStatus: '已生成调整凭证'
  },
  {
    method: 'POST',
    operation: '撤回启用账套',
    pathPattern: /^\/api\/finance\/ledger-initialization\/([^/]+)\/withdraw-enable$/,
    permissionScope: 'finance.ledgerInitialization.write',
    sourceArea: 'ledger_initialization',
    successStatus: '已撤回启用'
  }
];

function cloneState(state: FinanceSourceMutationRouteState): FinanceSourceMutationRouteState {
  return {
    events: state.events.map((event) => ({ ...event, affectedAccountingPeriods: [...event.affectedAccountingPeriods] })),
    periods: state.periods.map((period) => ({ ...period })),
    sourceRecords: state.sourceRecords.map((record) => ({ ...record }))
  };
}

function createRouteResponse({
  body,
  state,
  status
}: {
  body: unknown;
  state: FinanceSourceMutationRouteState;
  status: number;
}): FinanceSourceMutationRouteResponse {
  return {
    body,
    state,
    status
  };
}

function findRouteDefinition(request: FinanceSourceMutationRouteRequest) {
  for (const definition of financeSourceMutationRouteDefinitions) {
    if (definition.method !== request.method) {
      continue;
    }

    const match = request.path.match(definition.pathPattern);

    if (match) {
      return {
        definition,
        sourceId: match[1] ? decodeURIComponent(match[1]) : undefined
      };
    }
  }

  return undefined;
}

function isSourceMutationBody(value: unknown): value is SourceMutationBody {
  if (!value || typeof value !== 'object') {
    return true;
  }

  const body = value as SourceMutationBody;

  return (
    (body.amount === undefined || typeof body.amount === 'string') &&
    (body.sourceId === undefined || typeof body.sourceId === 'string') &&
    (body.sourceNo === undefined || typeof body.sourceNo === 'string') &&
    (body.status === undefined || typeof body.status === 'string') &&
    (body.targetAccountingPeriod === undefined || typeof body.targetAccountingPeriod === 'string')
  );
}

function getMutationBody(value: unknown): SourceMutationBody {
  return value && typeof value === 'object' ? (value as SourceMutationBody) : {};
}

function getBlockedStatus(code: string) {
  if (code === canonicalClosedAccountingPeriodErrorCode) {
    return 409;
  }

  if (code === sourceAccountingPeriodUnresolvedErrorCode) {
    return 400;
  }

  return 422;
}

export function handleFinanceSourceMutationRoute({
  context,
  request,
  state
}: {
  context: FinanceSourceMutationServerContext;
  request: FinanceSourceMutationRouteRequest;
  state: FinanceSourceMutationRouteState;
}): FinanceSourceMutationRouteResponse {
  const currentState = cloneState(state);
  const routeMatch = findRouteDefinition(request);

  if (!routeMatch) {
    return createRouteResponse({
      body: {
        code: 'NOT_FOUND',
        message: '源单写入接口不存在。',
        requestId: context.requestId
      },
      state: currentState,
      status: 404
    });
  }

  if (!isSourceMutationBody(request.body)) {
    return createRouteResponse({
      body: {
        code: 'INVALID_REQUEST',
        message: '源单写入请求体格式不正确。',
        requestId: context.requestId
      },
      state: currentState,
      status: 400
    });
  }

  const body = getMutationBody(request.body);
  const sourceId = routeMatch.sourceId ?? body.sourceId?.trim();

  if (!sourceId) {
    return createRouteResponse({
      body: {
        code: 'INVALID_REQUEST',
        message: '源单写入请求必须包含 sourceId。',
        operation: routeMatch.definition.operation,
        requestId: context.requestId,
        sourceArea: routeMatch.definition.sourceArea
      },
      state: currentState,
      status: 400
    });
  }

  const authorization = authorizeFinancePeriodCloseOperation({
    context,
    operation: routeMatch.definition.operation,
    requiredPermissionScope: routeMatch.definition.permissionScope,
    sourceId,
    sourceModule: financeSourceMutationAreaLabels[routeMatch.definition.sourceArea]
  });

  if (!authorization.allowed) {
    return createRouteResponse({
      body: {
        ...authorization.error,
        operation: routeMatch.definition.operation,
        sourceArea: routeMatch.definition.sourceArea
      },
      state: currentState,
      status: 403
    });
  }

  const sourceRecord = currentState.sourceRecords.find(
    (record) => record.id === sourceId && record.sourceArea === routeMatch.definition.sourceArea
  );

  if (!sourceRecord && !routeMatch.definition.createsSourceRecord) {
    return createRouteResponse({
      body: {
        code: 'NOT_FOUND',
        message: '源单不存在。',
        requestId: context.requestId,
        sourceId
      },
      state: currentState,
      status: 404
    });
  }

  const mutationSourceRecord: FinanceSourceMutationRecord = sourceRecord ?? {
    accountingPeriod: body.targetAccountingPeriod?.trim(),
    amount: body.amount ?? '0.00',
    id: sourceId,
    sourceArea: routeMatch.definition.sourceArea,
    sourceNo: body.sourceNo?.trim() || sourceId,
    status: '待生成',
    version: 0
  };
  const affectedAccountingPeriods = resolveFinanceSourceMutationGuardPeriods({
    operation: routeMatch.definition.operation,
    sourceAccountingPeriod: mutationSourceRecord.accountingPeriod,
    targetAccountingPeriod: body.targetAccountingPeriod
  });
  const guardResult = guardFinanceSourceMutation({
    periods: currentState.periods,
    request: {
      accountingPeriods: affectedAccountingPeriods,
      operation: routeMatch.definition.operation,
      requestId: context.requestId,
      sourceArea: routeMatch.definition.sourceArea,
      sourceId: mutationSourceRecord.id,
      sourceNo: mutationSourceRecord.sourceNo
    }
  });

  if (!guardResult.allowed) {
    return createRouteResponse({
      body: {
        ...guardResult.error,
        operation: guardResult.operation,
        sourceArea: guardResult.sourceArea,
        sourceNo: mutationSourceRecord.sourceNo
      },
      state: {
        ...currentState,
        events: [
          ...currentState.events,
          {
            actorSnapshot: context.actorSnapshot,
            affectedAccountingPeriods: guardResult.checkedAccountingPeriods,
            eventType: 'source_mutation_rejected',
            operation: guardResult.operation,
            requestId: context.requestId,
            sourceArea: guardResult.sourceArea,
            sourceId: mutationSourceRecord.id,
            timestamp: context.now
          }
        ]
      },
      status: getBlockedStatus(guardResult.error.code)
    });
  }

  const nextSourceRecord: FinanceSourceMutationRecord = {
    ...mutationSourceRecord,
    accountingPeriod: body.targetAccountingPeriod?.trim() || mutationSourceRecord.accountingPeriod,
    amount: body.amount ?? mutationSourceRecord.amount,
    status: body.status ?? routeMatch.definition.successStatus,
    version: mutationSourceRecord.version + 1
  };
  const nextState: FinanceSourceMutationRouteState = {
    ...currentState,
    events: [
      ...currentState.events,
      {
        actorSnapshot: context.actorSnapshot,
        affectedAccountingPeriods: guardResult.checkedAccountingPeriods,
        eventType: 'source_mutation_applied',
        operation: guardResult.operation,
        requestId: context.requestId,
        sourceArea: guardResult.sourceArea,
        sourceId: mutationSourceRecord.id,
        timestamp: context.now
      }
    ],
    sourceRecords: sourceRecord
      ? currentState.sourceRecords.map((record) =>
          record.id === sourceRecord.id && record.sourceArea === sourceRecord.sourceArea ? nextSourceRecord : record
        )
      : [nextSourceRecord, ...currentState.sourceRecords]
  };

  return createRouteResponse({
    body: {
      affectedAccountingPeriods: guardResult.checkedAccountingPeriods,
      record: nextSourceRecord,
      sourceArea: guardResult.sourceArea,
      sourceModule: guardResult.sourceModule
    },
    state: nextState,
    status: 200
  });
}
