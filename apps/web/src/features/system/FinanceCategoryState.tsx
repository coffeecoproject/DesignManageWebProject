import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  financeCategoryConfigToday,
  financeCategoryAccountingSubjectMappings,
  financePrimaryCategorySeeds,
  financeSecondaryCategorySeeds,
  type FinanceCategoryStatus,
  type FinanceAccountingSubjectRoleMappings,
  type FinanceCounterpartyScope,
  type FinancePaymentMethod,
  type FinancePrimaryCategoryConfig,
  type FinanceReportAggregation,
  type FinanceSecondaryCategoryConfig,
  type FinanceSourceType,
  type FinanceTransactionDirection
} from '../finance/financeData';
import {
  allowMasterDataMutation,
  validatePrimaryCategoryStatusChange,
  type MasterDataMutationResult
} from './masterDataLifecycleModel';

export type FinancePrimaryCategoryFormValue = Pick<
  FinancePrimaryCategoryConfig,
  'direction' | 'includeInReport' | 'name' | 'note' | 'reportAggregation'
>;

export type FinanceSecondaryCategoryFormValue = Pick<
  FinanceSecondaryCategoryConfig,
  | 'counterpartyScope'
  | 'defaultAccountingSubjectCode'
  | 'defaultSourceType'
  | 'includeInReport'
  | 'name'
  | 'note'
  | 'paymentMethods'
  | 'primaryId'
  | 'voucherRequirement'
> & {
  accountingSubjectMappings: FinanceAccountingSubjectRoleMappings;
};

type FinanceCategoryStateValue = {
  createPrimaryCategory: (nextValue: FinancePrimaryCategoryFormValue) => void;
  createSecondaryCategory: (nextValue: FinanceSecondaryCategoryFormValue) => void;
  financePrimaryCategories: FinancePrimaryCategoryConfig[];
  financeSecondaryCategories: FinanceSecondaryCategoryConfig[];
  updatePrimaryCategory: (id: string, nextValue: FinancePrimaryCategoryFormValue) => void;
  updatePrimaryCategoryStatus: (id: string, status: FinanceCategoryStatus) => MasterDataMutationResult;
  updateSecondaryCategory: (id: string, nextValue: FinanceSecondaryCategoryFormValue) => void;
  updateSecondaryCategoryStatus: (id: string, status: FinanceCategoryStatus) => MasterDataMutationResult;
};

export const financeReportAggregationOptions: FinanceReportAggregation[] = [
  '经营收入',
  '项目成本',
  '人员支出',
  '运营费用',
  '其他'
];

export const financeCounterpartyScopeOptions: FinanceCounterpartyScope[] = ['客户', '员工', '合作人员', '供应商', '内部'];
export const financeSourceTypeOptions: FinanceSourceType[] = [
  '合同应收',
  '薪酬发放',
  '外协结算',
  '报销单',
  '税费事项',
  '社保公积金缴费',
  '员工代收流水',
  '现金暂收流水',
  '流水冲正',
  '流水补差',
  '手工登记'
];
export const financePaymentMethodOptions: FinancePaymentMethod[] = ['对公账户收款', '对公账户付款', '员工代收', '现金暂收'];
export const financeDirectionOptions: FinanceTransactionDirection[] = ['收入', '支出', '内部转入'];

export function getDefaultAccountingSubjectMappingsForPrimary(
  primary?: Pick<FinancePrimaryCategoryConfig, 'direction' | 'name' | 'reportAggregation'>
): FinanceAccountingSubjectRoleMappings {
  if (!primary) {
    return {};
  }

  if (primary.direction === '收入') {
    return {
      accrualReceivable: '1122',
      accrualRevenue: primary.reportAggregation === '其他' ? '5051' : '5001',
      cashCredit: '1122',
      cashDebit: '1002',
      outputVatPayable: '2221.01'
    };
  }

  if (primary.direction === '内部转入') {
    return { cashCredit: '1002', cashDebit: '1002' };
  }

  if (primary.name.includes('税费')) {
    return { cashCredit: '1002', cashDebit: '2221.99' };
  }

  if (primary.reportAggregation === '人员支出') {
    return {
      accrualExpense: '5602.01',
      accrualPayable: '2211.01',
      cashCredit: '1002',
      cashDebit: '2211.01'
    };
  }

  if (primary.reportAggregation === '项目成本') {
    return {
      accrualExpense: '5401',
      accrualPayable: '2202',
      cashCredit: '1002',
      cashDebit: '2202'
    };
  }

  return {
    accrualExpense: '5602',
    accrualPayable: '2241',
    cashCredit: '1002',
    cashDebit: '2241'
  };
}

function buildFinanceCategoryStateRows() {
  return financeSecondaryCategorySeeds.map((row) => ({
    ...row,
    accountingSubjectMappings: {
      ...(financeCategoryAccountingSubjectMappings[row.name] ?? row.accountingSubjectMappings ?? {})
    },
    paymentMethods: [...row.paymentMethods]
  }));
}

export function getDefaultAccountingSubjectCodeForPrimary(primary?: Pick<FinancePrimaryCategoryConfig, 'direction' | 'name' | 'reportAggregation'>) {
  if (!primary) {
    return '';
  }

  if (primary.direction === '收入') {
    return primary.reportAggregation === '其他' ? '5051' : '1122';
  }

  if (primary.reportAggregation === '人员支出') {
    return '2211.01';
  }

  if (primary.reportAggregation === '项目成本') {
    return '2202';
  }

  if (primary.name.includes('税费')) {
    return '2221';
  }

  return '5602';
}

function getNextSequence(rows: Array<{ code: string }>, prefix: string) {
  return (
    rows.reduce((maxSequence, row) => {
      const sequence = Number.parseInt(row.code.replace(new RegExp(`^${prefix}-`), ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

export function protectFinancePrimaryCategoryUpdate(
  currentRecord: FinancePrimaryCategoryConfig,
  nextValue: FinancePrimaryCategoryFormValue,
  hasChildren: boolean
): FinancePrimaryCategoryFormValue {
  const isBuiltIn = !currentRecord.id.includes('-custom-');

  if (isBuiltIn) {
    return { ...nextValue, direction: currentRecord.direction, name: currentRecord.name };
  }
  return hasChildren ? { ...nextValue, direction: currentRecord.direction } : nextValue;
}

export function protectFinanceSecondaryCategoryUpdate(
  currentRecord: FinanceSecondaryCategoryConfig,
  nextValue: FinanceSecondaryCategoryFormValue
): FinanceSecondaryCategoryFormValue {
  return currentRecord.id.includes('-custom-')
    ? nextValue
    : { ...nextValue, name: currentRecord.name, primaryId: currentRecord.primaryId };
}

const FinanceCategoryStateContext = createContext<FinanceCategoryStateValue | undefined>(undefined);

export function FinanceCategoryProvider({ children }: { children: ReactNode }) {
  const [financePrimaryCategories, setFinancePrimaryCategories] = useState<FinancePrimaryCategoryConfig[]>(() => financePrimaryCategorySeeds);
  const [financeSecondaryCategories, setFinanceSecondaryCategories] = useState<FinanceSecondaryCategoryConfig[]>(buildFinanceCategoryStateRows);

  const value = useMemo<FinanceCategoryStateValue>(
    () => ({
      createPrimaryCategory(nextValue) {
        setFinancePrimaryCategories((currentRows) => {
          const sequence = String(getNextSequence(currentRows, 'FC1')).padStart(3, '0');
          const nextRow: FinancePrimaryCategoryConfig = {
            ...nextValue,
            code: `FC1-${sequence}`,
            id: `finance-primary-custom-${sequence}`,
            sortOrder: currentRows.length * 10 + 10,
            status: '启用',
            updatedAt: financeCategoryConfigToday
          };

          return [...currentRows, nextRow];
        });
      },
      createSecondaryCategory(nextValue) {
        setFinanceSecondaryCategories((currentRows) => {
          const sequence = String(getNextSequence(currentRows, 'FC2')).padStart(3, '0');
          const primary = financePrimaryCategories.find((row) => row.id === nextValue.primaryId);
          const nextRow: FinanceSecondaryCategoryConfig = {
            ...nextValue,
            code: `FC2-${sequence}`,
            direction: primary?.direction ?? '支出',
            id: `finance-secondary-custom-${sequence}`,
            reportAggregation: primary?.reportAggregation ?? '其他',
            sortOrder: currentRows.length * 10 + 10,
            status: '启用',
            updatedAt: financeCategoryConfigToday
          };

          return [...currentRows, nextRow];
        });
      },
      financePrimaryCategories,
      financeSecondaryCategories,
      updatePrimaryCategory(id, nextValue) {
        const currentRecord = financePrimaryCategories.find((row) => row.id === id);
        const hasChildren = financeSecondaryCategories.some((row) => row.primaryId === id);
        const protectedValue = currentRecord
          ? protectFinancePrimaryCategoryUpdate(currentRecord, nextValue, hasChildren)
          : nextValue;
        setFinancePrimaryCategories((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  ...protectedValue,
                  updatedAt: financeCategoryConfigToday
                }
              : row
          )
        );
        setFinanceSecondaryCategories((currentRows) =>
          currentRows.map((row) =>
            row.primaryId === id
              ? {
                  ...row,
                  direction: protectedValue.direction,
                  reportAggregation: protectedValue.reportAggregation,
                  updatedAt: financeCategoryConfigToday
                }
              : row
          )
        );
      },
      updatePrimaryCategoryStatus(id, status) {
        const enabledChildCount = financeSecondaryCategories.filter(
          (row) => row.primaryId === id && row.status === '启用'
        ).length;
        const validation = validatePrimaryCategoryStatusChange(status, enabledChildCount);
        if (!validation.success) {
          return validation;
        }

        setFinancePrimaryCategories((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status,
                  updatedAt: financeCategoryConfigToday
                }
              : row
          )
        );
        return validation;
      },
      updateSecondaryCategory(id, nextValue) {
        const currentRecord = financeSecondaryCategories.find((row) => row.id === id);
        const protectedValue = currentRecord
          ? protectFinanceSecondaryCategoryUpdate(currentRecord, nextValue)
          : nextValue;
        setFinanceSecondaryCategories((currentRows) =>
          currentRows.map((row) => {
            const primary = financePrimaryCategories.find((primaryRow) => primaryRow.id === protectedValue.primaryId);

            return row.id === id
              ? {
                  ...row,
                  ...protectedValue,
                  direction: primary?.direction ?? row.direction,
                  reportAggregation: primary?.reportAggregation ?? row.reportAggregation,
                  updatedAt: financeCategoryConfigToday
                }
              : row;
          })
        );
      },
      updateSecondaryCategoryStatus(id, status) {
        setFinanceSecondaryCategories((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status,
                  updatedAt: financeCategoryConfigToday
                }
              : row
          )
        );
        return allowMasterDataMutation();
      }
    }),
    [financePrimaryCategories, financeSecondaryCategories]
  );

  return <FinanceCategoryStateContext.Provider value={value}>{children}</FinanceCategoryStateContext.Provider>;
}

export function useFinanceCategoryState() {
  const value = useContext(FinanceCategoryStateContext);

  if (!value) {
    throw new Error('useFinanceCategoryState must be used within FinanceCategoryProvider');
  }

  return value;
}
