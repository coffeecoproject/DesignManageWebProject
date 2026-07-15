import { customerContractRecords, customerRecords } from '../customers/customerData';
import {
  assertUniqueStampDutySources,
  applyStampDutySourceResolution,
  buildCapitalBookStampDutySource,
  buildContractStampDutySource,
  buildManualDocumentStampDutySource,
  buildStampDutyPreparationSummary,
  buildStampDutySettlementEvent,
  resolveStampDutyTaxItem,
  validateStampDutyDocumentAmounts
} from './financeStampDutyModel';

type UnitTest = { name: string; run: () => void };

function createSettlementEvidence(id: string, updatedAt: string) {
  return [{
    id: `evidence-${id}`,
    name: `${id}.pdf`,
    status: '已上传',
    type: '结算依据',
    updatedAt
  }];
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(run: () => void, message: string) {
  try {
    run();
  } catch {
    return;
  }

  throw new Error(message);
}

const tests: UnitTest[] = [
  {
    name: 'ST-01 fixed construction contract subtracts separately stated VAT and applies reduction',
    run: () => {
      const contract = customerContractRecords.find((record) => record.id === 'contract-nova-start')!;
      const customer = customerRecords.find((record) => record.id === contract.customerId)!;
      const source = buildContractStampDutySource(contract, customer);

      assertEqual(source.taxItem, '建设工程合同', 'construction contract tax item');
      assertEqual(source.taxableBasis, 56310.68, 'taxable basis excludes separately stated VAT');
      assertEqual(source.taxBeforeReduction, 16.89, 'tax before reduction');
      assertEqual(source.reductionAmount, 8.45, 'six-tax reduction amount');
      assertEqual(source.estimatedPayableAmount, 8.44, 'estimated payable amount');
      assertEqual(source.resolutionStatus, '可申报', 'fixed contract resolution');
    }
  },
  {
    name: 'ST-02 uncertain consulting contract remains pending instead of guessing a tax item',
    run: () => {
      const contract = customerContractRecords.find((record) => record.id === 'contract-starry-framework')!;
      const customer = customerRecords.find((record) => record.id === contract.customerId)!;
      const source = buildContractStampDutySource(contract, customer);

      assertEqual(source.taxItem, '待确认', 'consulting contract should not guess tax item');
      assertEqual(source.resolutionStatus, '待确认', 'consulting contract resolution');
      assertEqual(source.estimatedPayableAmount, 0, 'pending source has no estimated tax');
    }
  },
  {
    name: 'ST-03 ordinary borrowing remains pending because only qualified financial-institution loans are taxable',
    run: () => {
      assertEqual(resolveStampDutyTaxItem('借款'), '待确认', 'ordinary loan must not be auto-taxed');
    }
  },
  {
    name: 'ST-04 pending source can be resolved into multiple legal tax items without changing source facts',
    run: () => {
      const contract = customerContractRecords.find((record) => record.id === 'contract-starry-framework')!;
      const customer = customerRecords.find((record) => record.id === contract.customerId)!;
      const source = buildContractStampDutySource(contract, customer);
      const firstBasis = Number((source.taxableBasis * 0.6).toFixed(2));
      const resolved = applyStampDutySourceResolution(source, {
        allocations: [
          { id: 'allocation-design', taxableBasis: firstBasis, taxItem: '建设工程合同' },
          { id: 'allocation-service', taxableBasis: Number((source.taxableBasis - firstBasis).toFixed(2)), taxItem: '技术合同' }
        ],
        obligationPeriod: source.obligationPeriod,
        reason: '合同已分别列明设计与技术服务金额',
        resolvedAt: '2026-06-30',
        resolvedBy: '李明',
        sourceId: source.sourceId,
        sourceVersion: source.sourceVersion,
        treatment: '应税'
      });

      assertEqual(resolved.length, 2, 'resolved tax item line count');
      assertEqual(resolved.every((record) => record.resolutionStatus === '可申报'), true, 'resolved sources are declarable');
      assertEqual(
        Number(resolved.reduce((total, record) => total + record.taxableBasis, 0).toFixed(2)),
        source.taxableBasis,
        'allocation basis preserves original source basis'
      );
    }
  },
  {
    name: 'ST-05 pending source can be concluded as non-taxable with an auditable reason',
    run: () => {
      const contract = customerContractRecords.find((record) => record.id === 'contract-starry-framework')!;
      const customer = customerRecords.find((record) => record.id === contract.customerId)!;
      const source = buildContractStampDutySource(contract, customer);
      const [resolved] = applyStampDutySourceResolution(source, {
        allocations: [],
        obligationPeriod: source.obligationPeriod,
        reason: '不属于印花税法税目税率表列举凭证',
        resolvedAt: '2026-06-30',
        resolvedBy: '李明',
        sourceId: source.sourceId,
        sourceVersion: source.sourceVersion,
        treatment: '非应税'
      });

      assertEqual(resolved.resolutionStatus, '已完成', 'non-taxable source resolution');
      assertEqual(resolved.estimatedPayableAmount, 0, 'non-taxable source payable amount');
      assertEqual(resolved.resolutionNote?.length ? true : false, true, 'non-taxable conclusion keeps evidence reason');
    }
  },
  {
    name: 'ST-06 tax item allocations must cover the complete source basis including decrease offsets',
    run: () => {
      const contract = customerContractRecords.find((record) => record.id === 'contract-starry-framework')!;
      const customer = customerRecords.find((record) => record.id === contract.customerId)!;
      const source = { ...buildContractStampDutySource(contract, customer), adjustmentType: '调减' as const };

      assertThrows(
        () => applyStampDutySourceResolution(source, {
          allocations: [{ id: 'allocation-offset', taxableBasis: source.taxableBasis - 1, taxItem: '技术合同' }],
          obligationPeriod: source.obligationPeriod,
          reason: '补充协议调减技术服务金额',
          resolvedAt: '2026-06-30',
          resolvedBy: '李明',
          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion,
          treatment: '抵缴'
        }),
        'decrease allocation must preserve the complete source basis'
      );
    }
  },
  {
    name: 'document amount validation rejects VAT equal to or above total amount',
    run: () => {
      assertEqual(
        validateStampDutyDocumentAmounts({ amount: 100, amountTaxMode: '价税分列', vatAmount: 100 }),
        '单列增值税额必须小于凭证金额',
        'invalid VAT amount validation'
      );
    }
  },
  {
    name: 'ST-07 open amount document creates a later settlement event without overwriting the original',
    run: () => {
      const source = buildManualDocumentStampDutySource({
        amountTaxMode: '含税未分列',
        counterparty: '武汉光谷商业管理有限公司',
        counterpartyTaxId: '91420100MA4LEASE01',
        documentName: '办公场地租赁框架协议',
        evidenceFiles: [],
        id: 'manual-open-lease',
        signedAt: '2026-06-18',
        sourceNo: 'STAMP-MANUAL-001',
        sourceVersion: 'V1.0',
        taxItem: '租赁合同'
      });
      const settlement = buildStampDutySettlementEvent(source, {
        amount: 12000,
        evidenceFiles: createSettlementEvidence('SET-001', '2026-07-20'),
        id: 'SET-001',
        settledAt: '2026-07-20'
      });

      assertEqual(source.resolutionStatus, '待后续结算', 'open amount source resolution');
      assertEqual(source.taxableBasis, 0, 'open amount first filing basis');
      assertEqual(settlement.resolutionStatus, '可申报', 'settlement event resolution');
      assertEqual(settlement.obligationPeriod, '2026-Q3', 'settlement enters its filing quarter');
      assertEqual(settlement.taxableBasis, 12000, 'settlement event basis');
      assertEqual(settlement.sourceId === source.sourceId, false, 'settlement source must be independent');
    }
  },
  {
    name: 'ST-08 quarter-end settlement stays in the quarter where the amount becomes determined',
    run: () => {
      const source = buildManualDocumentStampDutySource({
        amountTaxMode: '含税未分列',
        counterparty: '武汉光谷商业管理有限公司',
        counterpartyTaxId: '91420100MA4LEASE01',
        documentName: '无固定金额租赁协议',
        evidenceFiles: createSettlementEvidence('OPEN-LEASE', '2026-06-18'),
        id: 'manual-quarter-end-lease',
        signedAt: '2026-06-18',
        sourceNo: 'STAMP-MANUAL-QE',
        sourceVersion: 'V1.0',
        taxItem: '租赁合同'
      });
      const settlement = buildStampDutySettlementEvent(source, {
        amount: 18000,
        evidenceFiles: createSettlementEvidence('SET-Q3-END', '2026-09-30'),
        id: 'SET-Q3-END',
        settledAt: '2026-09-30'
      });

      assertEqual(settlement.obligationPeriod, '2026-Q3', 'September settlement belongs to Q3');
    }
  },
  {
    name: 'ST-08A price-tax separated settlement excludes stated VAT and requires settlement evidence',
    run: () => {
      const source = buildManualDocumentStampDutySource({
        amountTaxMode: '价税分列',
        counterparty: '武汉材料有限公司',
        counterpartyTaxId: '91420100MATERIAL01',
        documentName: '无固定金额采购协议',
        evidenceFiles: createSettlementEvidence('OPEN-PURCHASE', '2026-06-20'),
        id: 'manual-open-purchase',
        signedAt: '2026-06-20',
        sourceNo: 'STAMP-MANUAL-PURCHASE',
        sourceVersion: 'V1.0',
        taxItem: '买卖合同'
      });
      const settlement = buildStampDutySettlementEvent(source, {
        amount: 10300,
        evidenceFiles: createSettlementEvidence('SET-PURCHASE', '2026-08-15'),
        id: 'SET-PURCHASE',
        settledAt: '2026-08-15',
        statedVatAmount: 300
      });

      assertEqual(settlement.taxableBasis, 10000, 'settlement basis excludes separately stated VAT');
      assertThrows(
        () => buildStampDutySettlementEvent(source, {
          amount: 10300,
          evidenceFiles: createSettlementEvidence('SET-BEFORE-SIGNED', '2026-06-19'),
          id: 'SET-BEFORE-SIGNED',
          settledAt: '2026-06-19',
          statedVatAmount: 300
        }),
        'settlement before document execution must be rejected'
      );
      assertThrows(
        () => buildStampDutySettlementEvent(source, {
          amount: 10300,
          evidenceFiles: [],
          id: 'SET-PURCHASE-NO-EVIDENCE',
          settledAt: '2026-08-15',
          statedVatAmount: 300
        }),
        'settlement without evidence must be rejected'
      );
    }
  },
  {
    name: 'ST-14 capital book taxes only the increase over historical taxed maximum basis',
    run: () => {
      const source = buildCapitalBookStampDutySource({
        capitalReserveEndingBalance: 50000,
        historicalTaxedMaximumBasis: 200000,
        paidInCapitalEndingBalance: 200000,
        period: '2026',
        sourceVersion: '2026-final'
      });

      assertEqual(source.taxableBasis, 50000, 'capital book increase basis');
      assertEqual(source.taxBeforeReduction, 12.5, 'capital book tax before reduction');
      assertEqual(source.estimatedPayableAmount, 6.25, 'capital book payable tax');
      assertEqual(source.resolutionStatus, '可申报', 'capital book resolution');
    }
  },
  {
    name: 'ST-15 capital book blocks calculation when historical taxed basis is missing',
    run: () => {
      const source = buildCapitalBookStampDutySource({
        capitalReserveEndingBalance: 50000,
        paidInCapitalEndingBalance: 200000,
        period: '2026',
        sourceVersion: '2026-final'
      });

      assertEqual(source.resolutionStatus, '待确认', 'missing historical basis blocks source');
      assertEqual(source.taxableBasis, 0, 'missing historical basis does not guess taxable basis');
    }
  },
  {
    name: 'preparation rejects duplicate source version and item',
    run: () => {
      const contract = customerContractRecords.find((record) => record.id === 'contract-nova-start')!;
      const customer = customerRecords.find((record) => record.id === contract.customerId)!;
      const source = buildContractStampDutySource(contract, customer);

      assertThrows(() => assertUniqueStampDutySources([source, source]), 'duplicate source should be rejected');
      assertThrows(() => buildStampDutyPreparationSummary([source, source]), 'duplicate summary source should be rejected');
    }
  }
];

export function runFinanceStampDutyModelTests() {
  const failures: string[] = [];
  const executedTestNames: string[] = [];
  const passedTestNames: string[] = [];

  tests.forEach((test) => {
    executedTestNames.push(test.name);
    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return { executedTestNames, failures, passed: tests.length - failures.length, passedTestNames, total: tests.length };
}
