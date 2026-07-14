import { buildPartTimeLaborSettlementBatches } from '../tasks/partTimeLaborSettlementModel';
import { buildResidentLaborPaymentSnapshot } from './financeNaturalPersonPaymentModel';

const partTimeLaborSettlementResult202606 = buildPartTimeLaborSettlementBatches({
  acceptanceRecords: [
    {
      acceptedAt: '2026-06-10 16:00',
      agreementVersion: 'HZ-PT-2026-0006/V1',
      grossAmount: 1800,
      grossAmountSource: {
        field: 'agreedGrossAmount',
        kind: '任务约定',
        recordId: 'TASK-2026-004/AGREEMENT'
      },
      id: 'TASK-2026-004/ACCEPTANCE',
      laborProjectId: 'HZ-PT-2026-0006/WH-HANKOU',
      taskId: 'store-task-2026-004'
    },
    {
      acceptedAt: '2026-06-08 17:30',
      agreementVersion: 'HZ-PT-2026-0006/V1',
      grossAmount: 1400,
      grossAmountSource: {
        field: 'agreedGrossAmount',
        kind: '任务约定',
        recordId: 'TASK-2026-007/AGREEMENT'
      },
      id: 'TASK-2026-007/ACCEPTANCE',
      laborProjectId: 'HZ-PT-2026-0006/WH-HANKOU',
      taskId: 'store-task-2026-007'
    }
  ],
  people: [
    {
      id: '20260006',
      name: '示例兼职 B',
      personnelType: '兼职',
      taxIdentityProfile: { identityType: '居民个人', status: '已确认' }
    }
  ],
  settlementPeriod: '2026-06',
  tasks: [
    {
      acceptedAt: '2026-06-10 16:00',
      code: 'TASK-2026-004',
      executorId: '20260006',
      id: 'store-task-2026-004',
      name: '星际轻装门店快图交付',
      status: '已完成'
    },
    {
      acceptedAt: '2026-06-08 17:30',
      code: 'TASK-2026-007',
      executorId: '20260006',
      id: 'store-task-2026-007',
      name: '武汉汉口店灯光调整图',
      status: '已完成'
    }
  ]
});

const partTimeLaborSettlementBatch202606 = partTimeLaborSettlementResult202606.batches[0];

if (!partTimeLaborSettlementBatch202606 || partTimeLaborSettlementResult202606.blockers.length > 0) {
  throw new Error('兼职任务验收事实无法生成 2026-06 劳务结算批次');
}

export const partTimeLaborPaymentSnapshot202606 = buildResidentLaborPaymentSnapshot({
  grossIncomeAmount: partTimeLaborSettlementBatch202606.grossAmount,
  identityNo: '430104199605191128',
  paymentFactId: `labor:${partTimeLaborSettlementBatch202606.batchKey}`,
  personId: partTimeLaborSettlementBatch202606.employeeNo,
  personName: partTimeLaborSettlementBatch202606.employeeName,
  sourceBatchNo: 'OUT-202606-0008',
  sourceRecordNos: partTimeLaborSettlementBatch202606.sources.map((source) => source.taskNo),
  taxPeriod: partTimeLaborSettlementBatch202606.settlementPeriod
});
