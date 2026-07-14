import type { RelatedFileRecord } from '../../components/RelatedFileTable';

export type FinanceMonthEndSourceStatus = '使用中' | '已摊销完毕';

export type FinanceFixedAssetRecord = {
  accumulatedDepreciation: number;
  assetNo: string;
  department: string;
  files: RelatedFileRecord[];
  monthlyDepreciation: number;
  originalCost: number;
  startDate: string;
  status: '使用中';
  title: string;
  usefulLifeMonths: number;
};

export type FinancePrepaidExpenseRecord = {
  amortizedAmount: number;
  endDate: string;
  files: RelatedFileRecord[];
  monthlyAmortization: number;
  originalAmount: number;
  remainingAmount: number;
  sourceNo: string;
  startDate: string;
  status: FinanceMonthEndSourceStatus;
  title: string;
};

export const financeFixedAssetRecords: FinanceFixedAssetRecord[] = [
  {
    accumulatedDepreciation: 2500,
    assetNo: 'FA-2026-001',
    department: '设计部',
    files: [
      {
        id: 'asset-file-2026-001',
        name: '办公设计工作站采购发票.pdf',
        status: '已归档',
        type: '原始凭证',
        updatedAt: '2026-01-15'
      },
      {
        id: 'asset-file-2026-002',
        name: '办公设计工作站验收单.pdf',
        status: '已归档',
        type: '验收确认单',
        updatedAt: '2026-01-15'
      }
    ],
    monthlyDepreciation: 500,
    originalCost: 30000,
    startDate: '2026-01-15',
    status: '使用中',
    title: '办公设计工作站',
    usefulLifeMonths: 60
  }
];

export const financePrepaidExpenseRecords: FinancePrepaidExpenseRecord[] = [
  {
    amortizedAmount: 3000,
    endDate: '2026-12-31',
    files: [
      {
        id: 'prepaid-file-2026-001',
        name: '设计协同软件年度服务发票.pdf',
        status: '已归档',
        type: '原始凭证',
        updatedAt: '2026-01-02'
      },
      {
        id: 'prepaid-file-2026-002',
        name: '设计协同软件年度服务合同.pdf',
        status: '已归档',
        type: '合同',
        updatedAt: '2026-01-02'
      }
    ],
    monthlyAmortization: 600,
    originalAmount: 7200,
    remainingAmount: 4200,
    sourceNo: 'PP-2026-001',
    startDate: '2026-01-01',
    status: '使用中',
    title: '设计协同软件年度服务'
  }
];
