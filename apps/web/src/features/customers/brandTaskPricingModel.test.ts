import {
  createInitialBrandSettlementPolicyVersions,
  getEligibleBrandPricingContracts,
  reconcileBrandTaskPriceVersions,
  reconcileBrandSettlementPolicyVersions,
  resolveActiveBrandTaskPriceVersion,
  resolveActiveBrandSettlementPolicyVersion,
  validateBrandTaskPricingDrafts,
  type BrandPricingContract,
  type BrandTaskPriceVersionRecord
} from './brandTaskPricingModel';

type UnitTest = { name: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
}

const contracts: BrandPricingContract[] = [
  {
    amount: null,
    amountMode: '无固定金额',
    code: 'CON-001',
    customerId: 'customer-a',
    expiresAt: '2026-12-31',
    files: [{ type: '已签署合同' }],
    id: 'contract-a',
    name: '客户A合同',
    signedAt: '2026-01-01',
    status: '有效'
  },
  {
    amount: null,
    amountMode: '无固定金额',
    code: 'CON-002',
    customerId: 'customer-b',
    expiresAt: '2026-12-31',
    files: [{ type: '已签署合同' }],
    id: 'contract-b',
    name: '客户B合同',
    signedAt: '2026-01-01',
    status: '有效'
  }
];

const initialVersion: BrandTaskPriceVersionRecord = {
  billable: true,
  brandId: 'brand-a',
  contractId: 'contract-a',
  currency: 'CNY',
  effectiveFrom: '2026-01-01',
  id: 'brand-price-a-v1',
  status: '生效中',
  taskConfigId: 'task-floor-plan',
  unitPrice: 3000,
  version: 1
};

const tests: UnitTest[] = [
  {
    name: 'TR-01 resolves task price independently for each brand',
    run() {
      const rows: BrandTaskPriceVersionRecord[] = [
        initialVersion,
        { ...initialVersion, brandId: 'brand-b', id: 'brand-price-b-v1', unitPrice: 5200 }
      ];
      assertEqual(
        resolveActiveBrandTaskPriceVersion({ brandId: 'brand-a', effectiveAt: '2026-06-15', priceVersions: rows, taskConfigId: 'task-floor-plan' })?.unitPrice,
        3000,
        'brand A should resolve its own price'
      );
      assertEqual(
        resolveActiveBrandTaskPriceVersion({ brandId: 'brand-b', effectiveAt: '2026-06-15', priceVersions: rows, taskConfigId: 'task-floor-plan' })?.unitPrice,
        5200,
        'brand B should resolve its own price'
      );
    }
  },
  {
    name: 'TR-02 and TR-03 reject billable tasks without price or eligible contract',
    run() {
      const issues = validateBrandTaskPricingDrafts({
        contracts,
        customerId: 'customer-a',
        effectiveAt: '2026-06-15',
        pricingDrafts: [{ billable: true, taskConfigId: 'task-floor-plan', unitPrice: 0 }]
      });
      assert(issues.some((issue) => issue.code === 'INVALID_PRICE'), 'missing price should be blocked');
      assert(issues.some((issue) => issue.code === 'CONTRACT_REQUIRED'), 'missing contract should be blocked');
    }
  },
  {
    name: 'TR-04 excludes and rejects another customer contract',
    run() {
      const eligible = getEligibleBrandPricingContracts(contracts, 'customer-a', '2026-06-15');
      assertEqual(eligible.length, 1, 'only current customer contracts should be candidates');
      assertEqual(eligible[0]?.id, 'contract-a', 'customer A contract should remain');
      const issues = validateBrandTaskPricingDrafts({
        contracts,
        customerId: 'customer-a',
        effectiveAt: '2026-06-15',
        pricingDrafts: [{ billable: true, contractId: 'contract-b', taskConfigId: 'task-floor-plan', unitPrice: 3000 }]
      });
      assert(issues.some((issue) => issue.code === 'CONTRACT_CUSTOMER_MISMATCH'), 'cross-customer contract should be rejected');
    }
  },
  {
    name: 'TR-04A excludes a terminated contract from new brand pricing',
    run() {
      const terminatedContract: BrandPricingContract = {
        ...contracts[0],
        status: '已终止',
        terminatedAt: '2026-06-10'
      };
      const eligible = getEligibleBrandPricingContracts([terminatedContract], 'customer-a', '2026-06-15');
      assertEqual(eligible.length, 0, 'terminated contract must not remain an eligible pricing source');
      const issues = validateBrandTaskPricingDrafts({
        contracts: [terminatedContract],
        customerId: 'customer-a',
        effectiveAt: '2026-06-15',
        pricingDrafts: [{ billable: true, contractId: terminatedContract.id, taskConfigId: 'task-floor-plan', unitPrice: 3000 }]
      });
      assert(issues.some((issue) => issue.code === 'CONTRACT_INELIGIBLE'), 'terminated contract should be rejected');
    }
  },
  {
    name: 'TR-05 changing a price creates a new version and preserves history',
    run() {
      const next = reconcileBrandTaskPriceVersions({
        brandId: 'brand-a',
        effectiveAt: '2026-07-01',
        priceVersions: [initialVersion],
        pricingDrafts: [{ billable: true, contractId: 'contract-a', taskConfigId: 'task-floor-plan', unitPrice: 3600 }]
      });
      assertEqual(next.length, 2, 'price change should add a version');
      assertEqual(next.find((row) => row.version === 1)?.status, '已失效', 'old version should be closed');
      assertEqual(next.find((row) => row.version === 1)?.effectiveTo, '2026-06-30', 'old version should end before new version');
      assertEqual(next.find((row) => row.version === 2)?.unitPrice, 3600, 'new version should carry new price');
    }
  },
  {
    name: 'unchanged pricing does not create a duplicate version',
    run() {
      const next = reconcileBrandTaskPriceVersions({
        brandId: 'brand-a',
        effectiveAt: '2026-06-15',
        priceVersions: [initialVersion],
        pricingDrafts: [{ billable: true, contractId: 'contract-a', taskConfigId: 'task-floor-plan', unitPrice: 3000 }]
      });
      assertEqual(next.length, 1, 'unchanged pricing should keep one version');
    }
  },
  {
    name: 'TR-05 settlement policy changes take effect from the scheduled month without rewriting history',
    run() {
      const initialRows = createInitialBrandSettlementPolicyVersions(
        [{ id: 'brand-a', settlementPolicy: { mode: '按任务结算', perTaskDueDays: 15 } }],
        '2026-01-01'
      );
      const scheduledRows = reconcileBrandSettlementPolicyVersions({
        asOfDate: '2026-06-15',
        brandId: 'brand-a',
        effectiveAt: '2026-07-01',
        policy: { mode: '按月汇总', monthlyDueDay: 10 },
        policyVersions: initialRows
      });

      assertEqual(scheduledRows.length, 2, 'a scheduled policy change should create one new version');
      assertEqual(
        resolveActiveBrandSettlementPolicyVersion({
          brandId: 'brand-a',
          effectiveAt: '2026-06-30',
          policyVersions: scheduledRows
        })?.policy.mode,
        '按任务结算',
        'June tasks should retain the previous settlement policy'
      );
      assertEqual(
        resolveActiveBrandSettlementPolicyVersion({
          brandId: 'brand-a',
          effectiveAt: '2026-07-01',
          policyVersions: scheduledRows
        })?.policy.mode,
        '按月汇总',
        'July tasks should use the scheduled settlement policy'
      );
      assertEqual(
        scheduledRows.find((row) => row.version === 2)?.status,
        '待生效',
        'a future policy version should remain scheduled before its effective date'
      );
      assertEqual(
        scheduledRows.find((row) => row.version === 1)?.status,
        '生效中',
        'the current policy should remain active until the scheduled effective date'
      );

      const editedScheduledRows = reconcileBrandSettlementPolicyVersions({
        asOfDate: '2026-06-15',
        brandId: 'brand-a',
        effectiveAt: '2026-07-01',
        policy: { mode: '按月汇总', monthlyDueDay: 15 },
        policyVersions: scheduledRows
      });
      assertEqual(editedScheduledRows.length, 2, 'editing the same scheduled version should not create duplicates');
      assertEqual(
        editedScheduledRows.find((row) => row.version === 2)?.policy.monthlyDueDay,
        15,
        'the scheduled version should carry the latest unsent configuration'
      );
    }
  }
];

export function runBrandTaskPricingModelTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];
  for (const test of tests) {
    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed: passedTestNames.length,
    passedTestNames,
    total: tests.length
  };
}
