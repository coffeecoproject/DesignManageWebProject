import {
  assertAccountingPeriodOpen,
  canonicalClosedAccountingPeriodErrorCode,
  type AccountingPeriodRecord,
  type ApiErrorResponse
} from './periodCloseContract.js';

export const sourceAccountingPeriodUnresolvedErrorCode = 'SOURCE_ACCOUNTING_PERIOD_UNRESOLVED';

export const guardedFinanceSourceMutationAreas = [
  'receivable_payable',
  'invoice_ledger',
  'invoice_matching',
  'cash_flow_review',
  'bank_reconciliation',
  'accounting_voucher',
  'tax_handling',
  'social_insurance_housing_fund',
  'payroll',
  'ledger_initialization'
] as const;

export type FinanceSourceMutationArea = (typeof guardedFinanceSourceMutationAreas)[number];

export type FinanceSourceMutationGuardErrorCode =
  | typeof canonicalClosedAccountingPeriodErrorCode
  | typeof sourceAccountingPeriodUnresolvedErrorCode;

export type FinanceSourceMutationGuardRequest = {
  accountingPeriods: Array<string | undefined>;
  operation: string;
  requestId: string;
  sourceArea: FinanceSourceMutationArea;
  sourceId?: string;
  sourceNo?: string;
};

export type FinanceSourceMutationGuardSuccess = {
  allowed: true;
  checkedAccountingPeriods: string[];
  operation: string;
  sourceArea: FinanceSourceMutationArea;
  sourceModule: string;
};

export type FinanceSourceMutationGuardFailure = {
  allowed: false;
  checkedAccountingPeriods: string[];
  error: ApiErrorResponse & {
    code: FinanceSourceMutationGuardErrorCode;
  };
  operation: string;
  sourceArea: FinanceSourceMutationArea;
  sourceModule: string;
};

export type FinanceSourceMutationGuardResult = FinanceSourceMutationGuardFailure | FinanceSourceMutationGuardSuccess;

const accountingPeriodPattern = /^\d{4}-\d{2}$/;

export const financeSourceMutationAreaLabels: Record<FinanceSourceMutationArea, string> = {
  accounting_voucher: '会计凭证',
  bank_reconciliation: '银行对账',
  cash_flow_review: '流水复核',
  invoice_ledger: '发票台账',
  invoice_matching: '发票匹配',
  ledger_initialization: '账套初始化',
  payroll: '薪酬社保',
  receivable_payable: '应收应付',
  social_insurance_housing_fund: '社保公积金',
  tax_handling: '税务办理'
};

function normalizeAccountingPeriods(accountingPeriods: Array<string | undefined>) {
  return Array.from(
    new Set(
      accountingPeriods
        .map((period) => period?.trim())
        .filter((period): period is string => Boolean(period))
    )
  );
}

function createUnresolvedPeriodError({
  request,
  sourceModule
}: {
  request: FinanceSourceMutationGuardRequest;
  sourceModule: string;
}): FinanceSourceMutationGuardFailure {
  return {
    allowed: false,
    checkedAccountingPeriods: [],
    error: {
      code: sourceAccountingPeriodUnresolvedErrorCode,
      message: '源单写入前必须先解析会计期间。',
      requestId: request.requestId,
      sourceId: request.sourceId,
      sourceModule
    },
    operation: request.operation,
    sourceArea: request.sourceArea,
    sourceModule
  };
}

export function guardFinanceSourceMutation({
  periods,
  request
}: {
  periods: AccountingPeriodRecord[];
  request: FinanceSourceMutationGuardRequest;
}): FinanceSourceMutationGuardResult {
  const sourceModule = financeSourceMutationAreaLabels[request.sourceArea];
  const checkedAccountingPeriods = normalizeAccountingPeriods(request.accountingPeriods);

  if (
    checkedAccountingPeriods.length === 0 ||
    checkedAccountingPeriods.some((accountingPeriod) => !accountingPeriodPattern.test(accountingPeriod))
  ) {
    return createUnresolvedPeriodError({ request, sourceModule });
  }

  for (const accountingPeriod of checkedAccountingPeriods) {
    const guard = assertAccountingPeriodOpen({
      accountingPeriod,
      periods,
      requestId: request.requestId,
      sourceId: request.sourceId,
      sourceModule
    });

    if (!guard.allowed) {
      if (guard.error.code === canonicalClosedAccountingPeriodErrorCode) {
        return {
          allowed: false,
          checkedAccountingPeriods,
          error: {
            ...guard.error,
            code: canonicalClosedAccountingPeriodErrorCode,
            message: `${accountingPeriod} 已结账，不能${request.operation}；请优先创建后续期间调整事项，反结账属于异常流程。`,
            sourceModule
          },
          operation: request.operation,
          sourceArea: request.sourceArea,
          sourceModule
        };
      }

      return {
        allowed: false,
        checkedAccountingPeriods,
        error: {
          ...guard.error,
          code: sourceAccountingPeriodUnresolvedErrorCode,
          sourceModule
        },
        operation: request.operation,
        sourceArea: request.sourceArea,
        sourceModule
      };
    }
  }

  return {
    allowed: true,
    checkedAccountingPeriods,
    operation: request.operation,
    sourceArea: request.sourceArea,
    sourceModule
  };
}
