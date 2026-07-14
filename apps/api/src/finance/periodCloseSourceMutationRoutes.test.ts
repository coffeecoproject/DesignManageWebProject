import { canonicalClosedAccountingPeriodErrorCode, type AccountingPeriodRecord } from './periodCloseContract.js';
import { financePeriodClosePermissionScopes } from './periodCloseAuthorizationContract.js';
import {
  financeSourceMutationRouteDefinitions,
  handleFinanceSourceMutationRoute,
  type FinanceSourceMutationRecord,
  type FinanceSourceMutationRouteState,
  type FinanceSourceMutationServerContext
} from './periodCloseSourceMutationRoutes.js';
import { guardedFinanceSourceMutationAreas, sourceAccountingPeriodUnresolvedErrorCode } from './periodCloseSourceMutationGuard.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(message);
  }
}

function createPeriod(period: string, status: AccountingPeriodRecord['status']): AccountingPeriodRecord {
  return {
    period,
    status,
    version: 1
  };
}

function createSourceRecord(overrides: Partial<FinanceSourceMutationRecord> = {}): FinanceSourceMutationRecord {
  return {
    accountingPeriod: '2026-06',
    amount: '1000.00',
    id: 'rp-001',
    sourceArea: 'receivable_payable',
    sourceNo: 'AR-202606-001',
    status: '未结清',
    version: 1,
    ...overrides
  };
}

function createContext(overrides: Partial<FinanceSourceMutationServerContext> = {}): FinanceSourceMutationServerContext {
  return {
    actorSnapshot: { id: 'user-001', name: '李明' },
    now: '2026-07-02T19:30:00+08:00',
    permissionScopes: [...financePeriodClosePermissionScopes],
    requestId: 'req-source-route-001',
    ...overrides
  };
}

function createState(overrides: Partial<FinanceSourceMutationRouteState> = {}): FinanceSourceMutationRouteState {
  return {
    events: [],
    periods: [createPeriod('2026-05', '已结账'), createPeriod('2026-06', '开放'), createPeriod('2026-07', '已反结账')],
    sourceRecords: [
      createSourceRecord(),
      createSourceRecord({
        accountingPeriod: '2026-05',
        id: 'inv-closed',
        sourceArea: 'invoice_ledger',
        sourceNo: 'INV-202605-001',
        status: '待关联'
      }),
      createSourceRecord({
        accountingPeriod: '2026-06',
        id: 'txn-open',
        sourceArea: 'cash_flow_review',
        sourceNo: 'FIN-202606-001',
        status: '待复核'
      }),
      createSourceRecord({
        accountingPeriod: undefined,
        id: 'tax-unresolved',
        sourceArea: 'tax_handling',
        sourceNo: 'TAX-2026Q2-001',
        status: '待缴款'
      }),
      createSourceRecord({
        accountingPeriod: '2026-06',
        id: 'voucher-open',
        sourceArea: 'accounting_voucher',
        sourceNo: 'VCH-202606-001',
        status: '已制单'
      })
    ],
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'rejects source mutation before guard logic when domain permission is missing',
    run: () => {
      const state = createState();
      const response = handleFinanceSourceMutationRoute({
        context: createContext({ permissionScopes: ['finance.accountingPeriod.read'] }),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/cash-flows/txn-open/review'
        },
        state
      });

      assertEqual(response.status, 403, 'source mutation should require route-specific permission');
      assertObject(response.body, 'source mutation forbidden body should be object');
      assertEqual(response.body.code, 'FORBIDDEN', 'source mutation forbidden response should use stable code');
      assertEqual(response.state.sourceRecords.find((record) => record.id === 'txn-open')?.status, '待复核', 'forbidden source mutation should not change source status');
      assertEqual(response.state.sourceRecords.find((record) => record.id === 'txn-open')?.version, 1, 'forbidden source mutation should not increment source version');
      assertEqual(response.state.events.length, 0, 'forbidden source mutation should not write source mutation event');
    }
  },
  {
    name: 'route catalog covers every guarded source mutation area',
    run: () => {
      const routeAreas = new Set(financeSourceMutationRouteDefinitions.map((definition) => definition.sourceArea));

      for (const area of guardedFinanceSourceMutationAreas) {
        assertEqual(routeAreas.has(area), true, `${area} should have a route-level mutation adapter`);
      }
    }
  },
  {
    name: 'rejects direct API mutation in a closed period and keeps source row unchanged',
    run: () => {
      const initialState = createState();
      const response = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          body: { targetAccountingPeriod: '2026-06' },
          method: 'PATCH',
          path: '/api/finance/invoices/inv-closed/associations'
        },
        state: initialState
      });

      assertEqual(response.status, 409, 'closed period route mutation should return conflict');
      assertObject(response.body, 'closed period response body should be object');
      assertEqual(response.body.code, canonicalClosedAccountingPeriodErrorCode, 'closed period should use canonical error code');
      assertEqual(response.state.sourceRecords.find((record) => record.id === 'inv-closed')?.accountingPeriod, '2026-05', 'blocked mutation should not change source period');
      assertEqual(response.state.sourceRecords.find((record) => record.id === 'inv-closed')?.version, 1, 'blocked mutation should not increment version');
      assertEqual(response.state.events[0]?.eventType, 'source_mutation_rejected', 'blocked route mutation should write rejection event');
    }
  },
  {
    name: 'applies direct API mutation when affected period is open',
    run: () => {
      const response = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/cash-flows/txn-open/review'
        },
        state: createState()
      });

      assertEqual(response.status, 200, 'open period mutation should pass');
      const mutated = response.state.sourceRecords.find((record) => record.id === 'txn-open');

      assertEqual(mutated?.status, '已入账', 'open period mutation should apply route success status');
      assertEqual(mutated?.version, 2, 'open period mutation should increment source version');
      assertEqual(response.state.events[0]?.eventType, 'source_mutation_applied', 'open period mutation should write applied event');
    }
  },
  {
    name: 'guards expanded source mutation routes with the same period contract',
    run: () => {
      const routeCases: Array<{
        area: FinanceSourceMutationRecord['sourceArea'];
        expectedStatus: string;
        id: string;
        method: 'PATCH' | 'POST';
        path: string;
      }> = [
        {
          area: 'receivable_payable',
          expectedStatus: '待复核',
          id: 'rp-settlement',
          method: 'POST',
          path: '/api/finance/receivables-payables/rp-settlement/settlements'
        },
        {
          area: 'receivable_payable',
          expectedStatus: '已作废',
          id: 'rp-void',
          method: 'POST',
          path: '/api/finance/receivables-payables/rp-void/void'
        },
        {
          area: 'receivable_payable',
          expectedStatus: '税额已确认',
          id: 'rp-tax-basis',
          method: 'POST',
          path: '/api/finance/receivables-payables/rp-tax-basis/tax-basis'
        },
        {
          area: 'invoice_ledger',
          expectedStatus: '关联已保存',
          id: 'invoice-association',
          method: 'PATCH',
          path: '/api/finance/invoices/invoice-association/associations'
        },
        {
          area: 'receivable_payable',
          expectedStatus: '关联已保存',
          id: 'rp-invoice-association',
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-invoice-association/invoice-associations'
        },
        {
          area: 'invoice_ledger',
          expectedStatus: '红票已关联',
          id: 'invoice-red',
          method: 'POST',
          path: '/api/finance/invoices/invoice-red/red-original'
        },
        {
          area: 'cash_flow_review',
          expectedStatus: '退回修改',
          id: 'cash-return',
          method: 'POST',
          path: '/api/finance/cash-flows/cash-return/return'
        },
        {
          area: 'cash_flow_review',
          expectedStatus: '已作废',
          id: 'cash-void',
          method: 'POST',
          path: '/api/finance/cash-flows/cash-void/void'
        },
        {
          area: 'cash_flow_review',
          expectedStatus: '凭证已补充',
          id: 'cash-voucher-file',
          method: 'POST',
          path: '/api/finance/cash-flows/cash-voucher-file/voucher-files'
        },
        {
          area: 'cash_flow_review',
          expectedStatus: '待复核',
          id: 'cash-adjustment',
          method: 'POST',
          path: '/api/finance/cash-flows/cash-adjustment/adjustments'
        },
        {
          area: 'bank_reconciliation',
          expectedStatus: '已撤销对账',
          id: 'bank-revoke',
          method: 'POST',
          path: '/api/finance/bank-reconciliation/bank-revoke/revoke'
        },
        {
          area: 'bank_reconciliation',
          expectedStatus: '已登记系统流水',
          id: 'bank-system-flow',
          method: 'POST',
          path: '/api/finance/bank-reconciliation/bank-system-flow/system-flow'
        },
        {
          area: 'bank_reconciliation',
          expectedStatus: '已生成调整',
          id: 'bank-adjustment',
          method: 'POST',
          path: '/api/finance/bank-reconciliation/bank-adjustment/adjustments'
        },
        {
          area: 'bank_reconciliation',
          expectedStatus: '异常已处理',
          id: 'bank-exception',
          method: 'POST',
          path: '/api/finance/bank-reconciliation/bank-exception/resolve-exception'
        },
        {
          area: 'tax_handling',
          expectedStatus: '已申报',
          id: 'tax-declaration',
          method: 'POST',
          path: '/api/finance/tax-handling/tax-declaration/declaration'
        },
        {
          area: 'tax_handling',
          expectedStatus: '准备项已确认',
          id: 'declaration-preparation-item',
          method: 'POST',
          path: '/api/finance/declaration-preparation/declaration-preparation-item/confirm-item'
        },
        {
          area: 'tax_handling',
          expectedStatus: '可申报',
          id: 'declaration-preparation-confirm',
          method: 'POST',
          path: '/api/finance/declaration-preparation/declaration-preparation-confirm/confirm'
        },
        {
          area: 'tax_handling',
          expectedStatus: '回执已更新',
          id: 'tax-receipt',
          method: 'POST',
          path: '/api/finance/tax-handling/tax-receipt/receipts'
        },
        {
          area: 'social_insurance_housing_fund',
          expectedStatus: '已确认',
          id: 'social-detail',
          method: 'POST',
          path: '/api/finance/social-insurance/social-detail/confirm-detail'
        },
        {
          area: 'social_insurance_housing_fund',
          expectedStatus: '回单已更新',
          id: 'social-receipt',
          method: 'POST',
          path: '/api/finance/social-insurance/social-receipt/receipts'
        },
        {
          area: 'payroll',
          expectedStatus: '已结算',
          id: 'payroll-settle',
          method: 'POST',
          path: '/api/finance/payroll-results/payroll-settle/settle'
        },
        {
          area: 'payroll',
          expectedStatus: '已调整',
          id: 'payroll-adjustment',
          method: 'POST',
          path: '/api/finance/payroll-results/payroll-adjustment/adjustments'
        },
        {
          area: 'ledger_initialization',
          expectedStatus: '已撤回启用',
          id: 'ledger-withdraw',
          method: 'POST',
          path: '/api/finance/ledger-initialization/ledger-withdraw/withdraw-enable'
        }
      ];
      const state = createState({
        sourceRecords: routeCases.map((routeCase) =>
          createSourceRecord({
            accountingPeriod: '2026-06',
            id: routeCase.id,
            sourceArea: routeCase.area,
            sourceNo: `${routeCase.area}-${routeCase.id}`,
            status: '待处理'
          })
        )
      });

      for (const routeCase of routeCases) {
        const response = handleFinanceSourceMutationRoute({
          context: createContext({ requestId: `req-${routeCase.id}` }),
          request: {
            body: {},
            method: routeCase.method,
            path: routeCase.path
          },
          state
        });

        assertEqual(response.status, 200, `${routeCase.path} should pass in an open period`);
        assertEqual(
          response.state.sourceRecords.find((record) => record.id === routeCase.id && record.sourceArea === routeCase.area)?.status,
          routeCase.expectedStatus,
          `${routeCase.path} should write the route success status`
        );
        assertEqual(response.state.events[0]?.eventType, 'source_mutation_applied', `${routeCase.path} should write an applied event`);
      }
    }
  },
  {
    name: 'creates receivable payable source records only after target period guard passes',
    run: () => {
      const response = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-rp-create-open' }),
        request: {
          body: {
            amount: '800.00',
            sourceId: 'rp-create-open',
            sourceNo: 'AP-202606-NEW',
            targetAccountingPeriod: '2026-06'
          },
          method: 'POST',
          path: '/api/finance/receivables-payables'
        },
        state: createState({ sourceRecords: [] })
      });
      const createdRecord = response.state.sourceRecords.find((record) => record.id === 'rp-create-open');

      assertEqual(response.status, 200, 'open target period should allow receivable payable creation');
      assertEqual(createdRecord?.sourceArea, 'receivable_payable', 'created source record should use receivable payable area');
      assertEqual(createdRecord?.accountingPeriod, '2026-06', 'created source record should use target accounting period');
      assertEqual(createdRecord?.sourceNo, 'AP-202606-NEW', 'created source record should keep submitted source number');
      assertEqual(createdRecord?.amount, '800.00', 'created source record should keep submitted amount');
      assertEqual(createdRecord?.status, '已生成', 'created source record should use route success status');
      assertEqual(createdRecord?.version, 1, 'created source record should start at version 1');
      assertEqual(response.state.events[0]?.eventType, 'source_mutation_applied', 'created source record should write applied event');
    }
  },
  {
    name: 'rejects receivable payable source creation when target period is closed',
    run: () => {
      const response = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-rp-create-closed' }),
        request: {
          body: {
            amount: '800.00',
            sourceId: 'rp-create-closed',
            sourceNo: 'AP-202606-CLOSED',
            targetAccountingPeriod: '2026-06'
          },
          method: 'POST',
          path: '/api/finance/receivables-payables'
        },
        state: createState({ periods: [createPeriod('2026-06', '已结账')], sourceRecords: [] })
      });

      assertEqual(response.status, 409, 'closed target period should reject receivable payable creation');
      assertObject(response.body, 'closed receivable payable creation body should be object');
      assertEqual(response.body.code, canonicalClosedAccountingPeriodErrorCode, 'closed creation should use canonical closed-period code');
      assertEqual(response.state.sourceRecords.length, 0, 'blocked creation should not insert source row');
      assertEqual(response.state.events[0]?.eventType, 'source_mutation_rejected', 'blocked creation should write rejection event');
    }
  },
  {
    name: 'creates invoice ledger import source records only after target period guard passes',
    run: () => {
      const response = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-invoice-import-open' }),
        request: {
          body: {
            amount: '12800.00',
            sourceId: 'invoice-import-open',
            sourceNo: 'INV-IMPORT-202606-001',
            targetAccountingPeriod: '2026-06'
          },
          method: 'POST',
          path: '/api/finance/invoices/import'
        },
        state: createState({ sourceRecords: [] })
      });
      const createdRecord = response.state.sourceRecords.find((record) => record.id === 'invoice-import-open');

      assertEqual(response.status, 200, 'open target period should allow invoice ledger import');
      assertEqual(createdRecord?.sourceArea, 'invoice_ledger', 'created source record should use invoice ledger area');
      assertEqual(createdRecord?.accountingPeriod, '2026-06', 'created invoice source record should use target accounting period');
      assertEqual(createdRecord?.sourceNo, 'INV-IMPORT-202606-001', 'created invoice source record should keep submitted source number');
      assertEqual(createdRecord?.amount, '12800.00', 'created invoice source record should keep submitted amount');
      assertEqual(createdRecord?.status, '已导入', 'created invoice source record should use route success status');
      assertEqual(createdRecord?.version, 1, 'created invoice source record should start at version 1');
      assertEqual(response.state.events[0]?.eventType, 'source_mutation_applied', 'created invoice source record should write applied event');
    }
  },
  {
    name: 'rejects invoice ledger import source creation when target period is closed',
    run: () => {
      const response = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-invoice-import-closed' }),
        request: {
          body: {
            amount: '12800.00',
            sourceId: 'invoice-import-closed',
            sourceNo: 'INV-IMPORT-202606-CLOSED',
            targetAccountingPeriod: '2026-06'
          },
          method: 'POST',
          path: '/api/finance/invoices/import'
        },
        state: createState({ periods: [createPeriod('2026-06', '已结账')], sourceRecords: [] })
      });

      assertEqual(response.status, 409, 'closed target period should reject invoice ledger import');
      assertObject(response.body, 'closed invoice ledger import body should be object');
      assertEqual(response.body.code, canonicalClosedAccountingPeriodErrorCode, 'closed invoice import should use canonical closed-period code');
      assertEqual(response.state.sourceRecords.length, 0, 'blocked invoice import should not insert source row');
      assertEqual(response.state.events[0]?.eventType, 'source_mutation_rejected', 'blocked invoice import should write rejection event');
    }
  },
  {
    name: 'rejects expanded route mutations in a closed period before changing source rows',
    run: () => {
      const state = createState({
        periods: [createPeriod('2026-06', '已结账')],
        sourceRecords: [
          createSourceRecord({
            accountingPeriod: '2026-06',
            id: 'bank-revoke-closed',
            sourceArea: 'bank_reconciliation',
            sourceNo: 'BANK-202606-001',
            status: '已对账'
          }),
          createSourceRecord({
            accountingPeriod: '2026-06',
            id: 'payroll-adjustment-closed',
            sourceArea: 'payroll',
            sourceNo: 'PAY-202606-001',
            status: '已确认'
          }),
          createSourceRecord({
            accountingPeriod: '2026-06',
            id: 'declaration-preparation-closed',
            sourceArea: 'tax_handling',
            sourceNo: 'DP-202606-001',
            status: '准备中'
          })
        ]
      });
      const bankResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-bank-revoke-closed' }),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/bank-reconciliation/bank-revoke-closed/revoke'
        },
        state
      });
      const payrollResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-payroll-adjustment-closed' }),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/payroll-results/payroll-adjustment-closed/adjustments'
        },
        state
      });
      const declarationPreparationResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-declaration-preparation-closed' }),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/declaration-preparation/declaration-preparation-closed/confirm'
        },
        state
      });

      assertEqual(bankResponse.status, 409, 'closed period should block bank reconciliation revoke route');
      assertObject(bankResponse.body, 'bank revoke blocked body should be object');
      assertEqual(bankResponse.body.code, canonicalClosedAccountingPeriodErrorCode, 'bank revoke should use canonical closed-period code');
      assertEqual(
        bankResponse.state.sourceRecords.find((record) => record.id === 'bank-revoke-closed')?.status,
        '已对账',
        'blocked bank revoke should not change source status'
      );
      assertEqual(payrollResponse.status, 409, 'closed period should block payroll adjustment route');
      assertObject(payrollResponse.body, 'payroll adjustment blocked body should be object');
      assertEqual(payrollResponse.body.code, canonicalClosedAccountingPeriodErrorCode, 'payroll adjustment should use canonical closed-period code');
      assertEqual(
        payrollResponse.state.sourceRecords.find((record) => record.id === 'payroll-adjustment-closed')?.status,
        '已确认',
        'blocked payroll adjustment should not change source status'
      );
      assertEqual(declarationPreparationResponse.status, 409, 'closed period should block declaration-preparation confirmation route');
      assertObject(declarationPreparationResponse.body, 'declaration-preparation blocked body should be object');
      assertEqual(
        declarationPreparationResponse.body.code,
        canonicalClosedAccountingPeriodErrorCode,
        'declaration-preparation should use canonical closed-period code'
      );
      assertEqual(
        declarationPreparationResponse.state.sourceRecords.find((record) => record.id === 'declaration-preparation-closed')?.status,
        '准备中',
        'blocked declaration-preparation confirmation should not change source status'
      );
    }
  },
  {
    name: 'checks old and target accounting periods before period-changing mutation',
    run: () => {
      const allowed = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          body: { targetAccountingPeriod: '2026-07' },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-001/adjust'
        },
        state: createState()
      });
      const blockedTarget = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-source-route-002' }),
        request: {
          body: { targetAccountingPeriod: '2026-05' },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-001/adjust'
        },
        state: createState()
      });

      assertEqual(allowed.status, 200, 'move from open to reopened period should pass');
      assertEqual(
        allowed.state.sourceRecords.find((record) => record.id === 'rp-001')?.accountingPeriod,
        '2026-07',
        'allowed period-changing mutation should write target period'
      );
      assertEqual(blockedTarget.status, 409, 'targeting a closed period should reject mutation');
      assertEqual(
        blockedTarget.state.sourceRecords.find((record) => record.id === 'rp-001')?.accountingPeriod,
        '2026-06',
        'blocked target-period mutation should keep original period'
      );
    }
  },
  {
    name: 'rejects route mutation when source accounting period is unresolved',
    run: () => {
      const response = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/tax-handling/tax-unresolved/payment'
        },
        state: createState()
      });

      assertEqual(response.status, 400, 'unresolved source period should return bad request');
      assertObject(response.body, 'unresolved period response body should be object');
      assertEqual(response.body.code, sourceAccountingPeriodUnresolvedErrorCode, 'unresolved period should use canonical error code');
      assertEqual(response.state.sourceRecords.find((record) => record.id === 'tax-unresolved')?.version, 1, 'unresolved period should not mutate source');
    }
  },
  {
    name: 'guards accounting-voucher route with same closed-period contract',
    run: () => {
      const prepareResponse = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          body: { sourceId: 'voucher-open' },
          method: 'POST',
          path: '/api/finance/accounting-vouchers/prepare'
        },
        state: createState({
          periods: [createPeriod('2026-06', '已结账')],
          sourceRecords: [
            createSourceRecord({
              accountingPeriod: '2026-06',
              id: 'voucher-open',
              sourceArea: 'accounting_voucher',
              sourceNo: 'VCH-202606-001',
              status: '待制单'
            })
          ]
        })
      });
      const batchPrepareResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-source-route-batch-prepare-001' }),
        request: {
          body: { sourceId: 'voucher-open' },
          method: 'POST',
          path: '/api/finance/accounting-vouchers/batch-prepare'
        },
        state: createState({
          periods: [createPeriod('2026-06', '已结账')],
          sourceRecords: [
            createSourceRecord({
              accountingPeriod: '2026-06',
              id: 'voucher-open',
              sourceArea: 'accounting_voucher',
              sourceNo: 'VCH-202606-001',
              status: '待制单'
            })
          ]
        })
      });
      const bookingResponse = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/accounting-vouchers/voucher-open/book'
        },
        state: createState({
          periods: [createPeriod('2026-06', '已结账')],
          sourceRecords: [
            createSourceRecord({
              accountingPeriod: '2026-06',
              id: 'voucher-open',
              sourceArea: 'accounting_voucher',
              sourceNo: 'VCH-202606-001',
              status: '已制单'
            })
          ]
        })
      });
      const batchBookingResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-source-route-batch-book-001' }),
        request: {
          body: { sourceId: 'voucher-open' },
          method: 'POST',
          path: '/api/finance/accounting-vouchers/batch-book'
        },
        state: createState({
          periods: [createPeriod('2026-06', '已结账')],
          sourceRecords: [
            createSourceRecord({
              accountingPeriod: '2026-06',
              id: 'voucher-open',
              sourceArea: 'accounting_voucher',
              sourceNo: 'VCH-202606-001',
              status: '已制单'
            })
          ]
        })
      });
      const reversalResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-source-route-reverse-001' }),
        request: {
          body: { reason: '闭期冲销应被拒绝' },
          method: 'POST',
          path: '/api/finance/accounting-vouchers/voucher-open/reverse'
        },
        state: createState({
          periods: [createPeriod('2026-06', '已结账')],
          sourceRecords: [
            createSourceRecord({
              accountingPeriod: '2026-06',
              id: 'voucher-open',
              sourceArea: 'accounting_voucher',
              sourceNo: 'VCH-202606-001',
              status: '已记账'
            })
          ]
        })
      });

      assertEqual(prepareResponse.status, 409, 'closed accounting period should block voucher preparation route');
      assertObject(prepareResponse.body, 'voucher preparation blocked body should be object');
      assertEqual(prepareResponse.body.code, canonicalClosedAccountingPeriodErrorCode, 'voucher preparation should use canonical closed-period code');
      assertEqual(batchPrepareResponse.status, 409, 'closed accounting period should block batch voucher preparation route');
      assertObject(batchPrepareResponse.body, 'batch voucher preparation blocked body should be object');
      assertEqual(batchPrepareResponse.body.code, canonicalClosedAccountingPeriodErrorCode, 'batch voucher preparation should use canonical closed-period code');
      assertEqual(bookingResponse.status, 409, 'closed accounting period should block voucher booking route');
      assertObject(bookingResponse.body, 'voucher booking blocked body should be object');
      assertEqual(bookingResponse.body.code, canonicalClosedAccountingPeriodErrorCode, 'voucher booking should use canonical closed-period code');
      assertEqual(batchBookingResponse.status, 409, 'closed accounting period should block batch voucher booking route');
      assertObject(batchBookingResponse.body, 'batch voucher booking blocked body should be object');
      assertEqual(batchBookingResponse.body.code, canonicalClosedAccountingPeriodErrorCode, 'batch voucher booking should use canonical closed-period code');
      assertEqual(reversalResponse.status, 409, 'closed accounting period should block voucher reversal route');
      assertObject(reversalResponse.body, 'voucher reversal blocked body should be object');
      assertEqual(reversalResponse.body.code, canonicalClosedAccountingPeriodErrorCode, 'voucher reversal should use canonical closed-period code');
    }
  },
  {
    name: 'updates only the matched source area when different domains share the same id',
    run: () => {
      const response = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          body: {},
          method: 'POST',
          path: '/api/finance/cash-flows/shared-source-id/review'
        },
        state: createState({
          sourceRecords: [
            createSourceRecord({
              accountingPeriod: '2026-06',
              id: 'shared-source-id',
              sourceArea: 'receivable_payable',
              sourceNo: 'AR-SHARED-001',
              status: '未结清'
            }),
            createSourceRecord({
              accountingPeriod: '2026-06',
              id: 'shared-source-id',
              sourceArea: 'cash_flow_review',
              sourceNo: 'FIN-SHARED-001',
              status: '待复核'
            })
          ]
        })
      });

      assertEqual(response.status, 200, 'cash flow mutation should pass in open period');
      assertEqual(
        response.state.sourceRecords.find((record) => record.id === 'shared-source-id' && record.sourceArea === 'cash_flow_review')?.status,
        '已入账',
        'matched cash-flow source row should be updated'
      );
      assertEqual(
        response.state.sourceRecords.find((record) => record.id === 'shared-source-id' && record.sourceArea === 'receivable_payable')?.status,
        '未结清',
        'same id in another source area should stay unchanged'
      );
    }
  },
  {
    name: 'uses operation period-check mode when resolving guarded periods',
    run: () => {
      const sourcePeriodOnlyResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-source-period-only-mode' }),
        request: {
          body: { targetAccountingPeriod: '2026-05' },
          method: 'POST',
          path: '/api/finance/cash-flows/txn-open/return'
        },
        state: createState()
      });
      const missingTargetResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-target-required-mode' }),
        request: {
          body: {
            amount: '800.00',
            sourceId: 'rp-create-without-target',
            sourceNo: 'AP-NO-TARGET'
          },
          method: 'POST',
          path: '/api/finance/receivables-payables'
        },
        state: createState({ sourceRecords: [] })
      });
      const closedTargetResponse = handleFinanceSourceMutationRoute({
        context: createContext({ requestId: 'req-source-and-target-mode' }),
        request: {
          body: { targetAccountingPeriod: '2026-05' },
          method: 'PATCH',
          path: '/api/finance/receivables-payables/rp-001/adjust'
        },
        state: createState()
      });

      assertEqual(
        sourcePeriodOnlyResponse.status,
        200,
        'source-period operation should guard the source record period rather than an unrelated submitted target period'
      );
      assertEqual(
        sourcePeriodOnlyResponse.state.sourceRecords.find((record) => record.id === 'txn-open')?.status,
        '退回修改',
        'source-period operation should still apply when the actual source period is open'
      );
      assertEqual(missingTargetResponse.status, 400, 'target-period-required create route should reject missing target period');
      assertObject(missingTargetResponse.body, 'missing-target response body should be object');
      assertEqual(
        missingTargetResponse.body.code,
        sourceAccountingPeriodUnresolvedErrorCode,
        'missing target period should use unresolved-period code'
      );
      assertEqual(missingTargetResponse.state.sourceRecords.length, 0, 'missing target should not create source row');
      assertEqual(closedTargetResponse.status, 409, 'source-and-target operation should still reject closed target period');
      assertObject(closedTargetResponse.body, 'closed target response body should be object');
      assertEqual(
        closedTargetResponse.body.code,
        canonicalClosedAccountingPeriodErrorCode,
        'closed target should use canonical closed-period code'
      );
    }
  },
  {
    name: 'returns route-level not found without changing state',
    run: () => {
      const state = createState();
      const response = handleFinanceSourceMutationRoute({
        context: createContext(),
        request: {
          method: 'POST',
          path: '/api/finance/unknown/rp-001/apply'
        },
        state
      });

      assertEqual(response.status, 404, 'unknown mutation route should return not found');
      assertEqual(response.state.sourceRecords.length, state.sourceRecords.length, 'not found route should not change state rows');
      assertEqual(response.state.events.length, 0, 'not found route should not write events');
    }
  }
];

for (const test of tests) {
  test.run();
}
