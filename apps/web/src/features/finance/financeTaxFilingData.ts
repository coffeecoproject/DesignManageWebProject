import type { StatusTagTone } from '../../components/Detail';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { getFinanceVatSurchargeSummary, type FinanceVatSurchargeSummary } from './financeTaxPolicyModel';

export type FinanceTaxMatterType = '个人所得税' | '社保缴纳' | '公积金缴纳' | '增值税及附加' | '企业所得税' | '印花税' | '其他税费';
export type FinanceTaxMatterPeriodType = '月度' | '季度' | '年度' | '按次';
export type FinanceTaxMatterProcessStatus = '数据待确认' | '待申报' | '待缴款' | '部分缴纳' | '待退税' | '部分退税' | '待补回执' | '已完成';
export type FinanceTaxMatterAccountingStatus = '无需生成' | '待确认' | '可生成';
export type FinanceTaxMatterEvidenceStatus = '无需回执' | '待补回执' | '已齐全';
export type FinanceTaxMatterDataStatus = '待准备' | '待复核' | '已确认';
export type FinanceTaxMatterDeclarationStatus = '待申报' | '申报成功' | '零申报' | '无申报义务' | '已作废';
export type FinanceTaxMatterPaymentStatus = '未开始' | '无需缴纳' | '待缴纳' | '部分缴纳' | '已缴纳';
export type FinanceTaxMatterRefundStatus = '不适用' | '待退税' | '部分退税' | '已退税';
export type FinanceTaxMatterSettlementDirection = '待确定' | '应缴' | '无需补退' | '应退';
export type FinanceTaxMatterSourceStatus = '待准备' | '待复核' | '已确认' | '不适用';
export type FinanceTaxMatterDeclarationScenario = '月度扣缴' | '季度申报' | '季度预缴' | '年度汇算' | '按次申报';

export type FinanceTaxMatterDeclarationHistoryRecord = {
  action: '更正' | '作废';
  declarationDate?: string;
  declarationReceiptFileId?: string;
  declarationReceiptNo?: string;
  declarationStatus: FinanceTaxMatterDeclarationStatus;
  filedAccountingAmount?: number;
  filedPayableAmount: number;
  filedRefundableAmount?: number;
  filedVatSettlement?: FinanceVatTaxSettlementSnapshot;
  filedVatSurcharge?: FinanceVatSurchargeSummary;
  id: string;
  operatedAt: string;
  operatedBy: string;
  reason: string;
  version: number;
};

export type FinanceTaxMatterSourceItem = {
  id: string;
  name: string;
  sourceModule: string;
  status: FinanceTaxMatterSourceStatus;
  updatedAt: string;
};

export type FinanceVatTaxSettlementSnapshot = {
  declaredVatAmount: number;
  officialBreakdown?: FinanceVatOfficialSettlementBreakdown;
  sourceRecognizedVatAmount: number;
  surcharge: FinanceVatSurchargeSummary;
  totalPayableAmount: number;
};

export type FinanceVatOfficialSettlementBreakdown = {
  declaredVatAmount: number;
  educationSurchargeAmount: number;
  localEducationSurchargeAmount: number;
  urbanMaintenanceTaxAmount: number;
};

export type FinanceSocialInsuranceSettlementSnapshot = {
  category: '社保' | '公积金';
  companyAmount: number;
  personalAmount: number;
  totalAmount: number;
};

export type FinanceTaxMatterRecord = {
  dataStatus: FinanceTaxMatterDataStatus;
  declarationScenario?: FinanceTaxMatterDeclarationScenario;
  declarationDate?: string;
  declarationDueDate: string;
  declarationDifferenceReason?: string;
  declarationHistory: FinanceTaxMatterDeclarationHistoryRecord[];
  declarationReceiptFileId?: string;
  declarationReceiptNo?: string;
  declarationStatus: FinanceTaxMatterDeclarationStatus;
  declarationVersion: number;
  files: RelatedFileRecord[];
  id: string;
  linkedTransactionNos: string[];
  matterNo: string;
  matterType: FinanceTaxMatterType;
  operationRecords: OperationRecord[];
  owner: string;
  paidAmount: number;
  participantSummary: string;
  payableAmount: number;
  preparedPayableAmount: number;
  paymentDate?: string;
  paymentDueDate: string;
  paymentStatus: FinanceTaxMatterPaymentStatus;
  refundableAmount?: number;
  refundDate?: string;
  refundedAmount?: number;
  refundStatus?: FinanceTaxMatterRefundStatus;
  period: string;
  periodType: FinanceTaxMatterPeriodType;
  processStatus: FinanceTaxMatterProcessStatus;
  settlementDirection?: FinanceTaxMatterSettlementDirection;
  socialInsuranceSettlement?: FinanceSocialInsuranceSettlementSnapshot;
  sourceItems: FinanceTaxMatterSourceItem[];
  title: string;
  updatedAt: string;
  vatSettlement?: FinanceVatTaxSettlementSnapshot;
};

const q1VatSurcharge = getFinanceVatSurchargeSummary({
  accountingPeriod: '2026-03',
  qualifiesForMicroTaxFeeReduction: true,
  vatPayableAmount: 440.1
});

export const taxMatterTypeTone = {
  个人所得税: 'purple',
  社保缴纳: 'blue',
  公积金缴纳: 'blue',
  增值税及附加: 'green',
  企业所得税: 'amber',
  印花税: 'gray',
  其他税费: 'gray'
} as const satisfies Record<FinanceTaxMatterType, StatusTagTone>;

export const taxMatterProcessStatusTone = {
  数据待确认: 'amber',
  待申报: 'blue',
  待缴款: 'amber',
  部分缴纳: 'blue',
  待退税: 'amber',
  部分退税: 'blue',
  待补回执: 'amber',
  已完成: 'green'
} as const satisfies Record<FinanceTaxMatterProcessStatus, StatusTagTone>;

export const taxMatterDataStatusTone = {
  待准备: 'amber',
  待复核: 'blue',
  已确认: 'green'
} as const satisfies Record<FinanceTaxMatterDataStatus, StatusTagTone>;

export const taxMatterDeclarationStatusTone = {
  待申报: 'amber',
  申报成功: 'green',
  零申报: 'gray',
  无申报义务: 'gray',
  已作废: 'gray'
} as const satisfies Record<FinanceTaxMatterDeclarationStatus, StatusTagTone>;

export const taxMatterPaymentStatusTone = {
  未开始: 'gray',
  无需缴纳: 'gray',
  待缴纳: 'amber',
  部分缴纳: 'blue',
  已缴纳: 'green'
} as const satisfies Record<FinanceTaxMatterPaymentStatus, StatusTagTone>;

export const taxMatterSourceStatusTone = {
  待准备: 'amber',
  待复核: 'blue',
  已确认: 'green',
  不适用: 'gray'
} as const satisfies Record<FinanceTaxMatterSourceStatus, StatusTagTone>;

export const financeTaxMatterRecords: FinanceTaxMatterRecord[] = [
  {
    dataStatus: '待复核',
    declarationScenario: '月度扣缴',
    declarationDueDate: '2026-07-15',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '待申报',
    files: [],
    id: 'tax-matter-001',
    linkedTransactionNos: [],
    matterNo: 'TAX-202606-IIT',
    matterType: '个人所得税',
    operationRecords: [
      {
        id: 'tax-op-001',
        time: '2026-06-18 09:30',
        actor: '李明',
        object: 'TAX-202606-IIT',
        action: '建立事项',
        summary: '建立 2026-06 个人所得税办理事项，等待申报准备确认'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '0 人',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-07-15',
    paymentStatus: '未开始',
    period: '2026-06',
    periodType: '月度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-001',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '待复核',
        updatedAt: '2026-06-18'
      }
    ],
    title: '2026-06 个人所得税',
    updatedAt: '2026-06-18'
  },
  {
    dataStatus: '待复核',
    declarationDueDate: '2026-07-20',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '待申报',
    files: [],
    id: 'tax-matter-002',
    linkedTransactionNos: [],
    matterNo: 'TAX-202606-SOCIAL',
    matterType: '社保缴纳',
    operationRecords: [
      {
        id: 'tax-op-003',
        time: '2026-06-18 09:50',
        actor: '李明',
        object: 'TAX-202606-SOCIAL',
        action: '建立事项',
        summary: '登记 2026-06 社保缴办事项'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '1 人',
    payableAmount: 3075,
    preparedPayableAmount: 3075,
    paymentDueDate: '2026-07-20',
    paymentStatus: '未开始',
    period: '2026-06',
    periodType: '月度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-003',
        name: '社保缴费明细',
        sourceModule: '社保公积金 / 缴费明细',
        status: '待复核',
        updatedAt: '2026-06-15'
      },
      {
        id: 'tax-source-004',
        name: '社保缴费核定单',
        sourceModule: '电子税务局',
        status: '待准备',
        updatedAt: '2026-06-15'
      }
    ],
    title: '2026-06 社保缴纳',
    updatedAt: '2026-06-15'
  },
  {
    dataStatus: '待复核',
    declarationDueDate: '2026-07-20',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '待申报',
    files: [],
    id: 'tax-matter-003',
    linkedTransactionNos: [],
    matterNo: 'TAX-202606-HF',
    matterType: '公积金缴纳',
    operationRecords: [
      {
        id: 'tax-op-004',
        time: '2026-06-18 09:58',
        actor: '李明',
        object: 'TAX-202606-HF',
        action: '建立事项',
        summary: '登记 2026-06 公积金缴办事项'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '待确认',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-07-20',
    paymentStatus: '未开始',
    period: '2026-06',
    periodType: '月度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-005',
        name: '公积金缴费明细',
        sourceModule: '社保公积金 / 缴费明细',
        status: '待复核',
        updatedAt: '2026-06-15'
      },
      {
        id: 'tax-source-006',
        name: '公积金汇缴核定单',
        sourceModule: '公积金系统',
        status: '待准备',
        updatedAt: '2026-06-15'
      }
    ],
    title: '2026-06 公积金缴纳',
    updatedAt: '2026-06-15'
  },
  {
    dataStatus: '待复核',
    declarationScenario: '季度申报',
    declarationDueDate: '2026-07-15',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '待申报',
    files: [],
    id: 'tax-matter-004',
    linkedTransactionNos: [],
    matterNo: 'TAX-2026Q2-VAT',
    matterType: '增值税及附加',
    operationRecords: [
      {
        id: 'tax-op-005',
        time: '2026-06-18 10:20',
        actor: '李明',
        object: 'TAX-2026Q2-VAT',
        action: '建立事项',
        summary: '登记 2026-Q2 增值税及附加事项'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '季度收入',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-07-15',
    paymentStatus: '未开始',
    period: '2026-Q2',
    periodType: '季度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-007',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '待复核',
        updatedAt: '2026-06-24'
      }
    ],
    title: '2026-Q2 增值税及附加',
    updatedAt: '2026-06-24'
  },
  {
    dataStatus: '待复核',
    declarationScenario: '季度预缴',
    declarationDueDate: '2026-07-15',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '待申报',
    files: [],
    id: 'tax-matter-005',
    linkedTransactionNos: [],
    matterNo: 'TAX-2026Q2-CIT',
    matterType: '企业所得税',
    operationRecords: [
      {
        id: 'tax-op-006',
        time: '2026-06-18 10:32',
        actor: '李明',
        object: 'TAX-2026Q2-CIT',
        action: '建立事项',
        summary: '登记 2026-Q2 企业所得税预缴事项'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '本年累计利润',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-07-15',
    paymentStatus: '未开始',
    period: '2026-Q2',
    periodType: '季度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-010',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '待复核',
        updatedAt: '2026-06-21'
      }
    ],
    title: '2026-Q2 企业所得税季度预缴',
    updatedAt: '2026-06-21'
  },
  {
    dataStatus: '待复核',
    declarationScenario: '季度申报',
    declarationDueDate: '2026-07-15',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '待申报',
    files: [],
    id: 'tax-matter-006',
    linkedTransactionNos: [],
    matterNo: 'TAX-2026Q2-STAMP',
    matterType: '印花税',
    operationRecords: [
      {
        id: 'tax-op-007',
        time: '2026-06-18 10:40',
        actor: '李明',
        object: 'TAX-2026Q2-STAMP',
        action: '建立事项',
        summary: '根据已确认申报准备建立 2026-Q2 印花税办理事项'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '应税凭证 2 条',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-07-15',
    paymentStatus: '未开始',
    period: '2026-Q2',
    periodType: '季度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-012',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '待复核',
        updatedAt: '2026-06-18'
      }
    ],
    title: '2026-Q2 印花税',
    updatedAt: '2026-06-18'
  },
  {
    dataStatus: '已确认',
    declarationScenario: '季度申报',
    declarationDate: '2026-04-12',
    declarationDueDate: '2026-04-20',
    declarationHistory: [],
    declarationReceiptFileId: 'tax-file-q1-vat-receipt',
    declarationReceiptNo: 'VAT-2026Q1-0001',
    declarationVersion: 1,
    declarationStatus: '申报成功',
    files: [
      {
        id: 'tax-file-q1-vat-receipt',
        name: '2026-Q1_增值税及附加申报回执.pdf',
        status: '已上传',
        type: '申报回执',
        updatedAt: '2026-04-12'
      },
      {
        id: 'tax-file-q1-vat-payment',
        name: '2026-Q1_增值税及附加缴款回单.pdf',
        status: '已上传',
        type: '缴款回单',
        updatedAt: '2026-04-12'
      }
    ],
    id: 'tax-matter-007',
    linkedTransactionNos: ['FIN-202604-0009'],
    matterNo: 'TAX-2026Q1-VAT',
    matterType: '增值税及附加',
    operationRecords: [
      {
        id: 'tax-op-008',
        time: '2026-04-10 09:30',
        actor: '李明',
        object: 'TAX-2026Q1-VAT',
        action: '确认准备结果',
        summary: '确认 2026-Q1 增值税及附加申报准备'
      },
      {
        id: 'tax-op-009',
        time: '2026-04-12 15:20',
        actor: '李明',
        object: 'TAX-2026Q1-VAT',
        action: '上传回执',
        summary: '归档申报回执和缴款回单'
      }
    ],
    owner: '李明',
    paidAmount: 466.51,
    participantSummary: '季度收入',
    payableAmount: 466.51,
    preparedPayableAmount: 466.51,
    paymentDate: '2026-04-12',
    paymentDueDate: '2026-04-20',
    paymentStatus: '已缴纳',
    period: '2026-Q1',
    periodType: '季度',
    processStatus: '已完成',
    sourceItems: [
      {
        id: 'tax-source-q1-vat-statistics',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '已确认',
        updatedAt: '2026-04-10'
      }
    ],
    title: '2026-Q1 增值税及附加',
    updatedAt: '2026-04-12',
    vatSettlement: {
      declaredVatAmount: 440.1,
      sourceRecognizedVatAmount: 440.1,
      surcharge: q1VatSurcharge,
      totalPayableAmount: 466.51
    }
  },
  {
    dataStatus: '已确认',
    declarationScenario: '季度预缴',
    declarationDate: '2026-04-12',
    declarationDueDate: '2026-04-20',
    declarationHistory: [],
    declarationReceiptFileId: 'tax-file-q1-cit-receipt',
    declarationReceiptNo: 'CIT-2026Q1-0001',
    declarationVersion: 1,
    declarationStatus: '申报成功',
    files: [
      {
        id: 'tax-file-q1-cit-receipt',
        name: '2026-Q1_企业所得税预缴申报回执.pdf',
        status: '已上传',
        type: '申报回执',
        updatedAt: '2026-04-12'
      },
      {
        id: 'tax-file-q1-cit-payment',
        name: '2026-Q1_企业所得税预缴缴款回单.pdf',
        status: '已上传',
        type: '缴款回单',
        updatedAt: '2026-04-12'
      }
    ],
    id: 'tax-matter-008',
    linkedTransactionNos: ['FIN-202604-0012'],
    matterNo: 'TAX-2026Q1-CIT',
    matterType: '企业所得税',
    operationRecords: [
      {
        id: 'tax-op-010',
        time: '2026-04-10 10:20',
        actor: '李明',
        object: 'TAX-2026Q1-CIT',
        action: '确认准备结果',
        summary: '确认 2026-Q1 企业所得税预缴准备结果'
      },
      {
        id: 'tax-op-011',
        time: '2026-04-12 16:05',
        actor: '李明',
        object: 'TAX-2026Q1-CIT',
        action: '上传回执',
        summary: '归档申报回执和缴款回单'
      }
    ],
    owner: '李明',
    paidAmount: 500,
    participantSummary: '本年累计利润',
    payableAmount: 500,
    preparedPayableAmount: 500,
    paymentDate: '2026-04-12',
    paymentDueDate: '2026-04-20',
    paymentStatus: '已缴纳',
    period: '2026-Q1',
    periodType: '季度',
    processStatus: '已完成',
    sourceItems: [
      {
        id: 'tax-source-q1-cit-preparation',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '已确认',
        updatedAt: '2026-04-10'
      }
    ],
    title: '2026-Q1 企业所得税季度预缴',
    updatedAt: '2026-04-12'
  },
  {
    dataStatus: '已确认',
    declarationScenario: '季度申报',
    declarationDate: '2026-01-15',
    declarationDueDate: '2026-01-20',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '零申报',
    files: [],
    id: 'tax-matter-2025q4-vat-receipt-pending',
    linkedTransactionNos: [],
    matterNo: 'TAX-2025Q4-VAT',
    matterType: '增值税及附加',
    operationRecords: [
      {
        action: '登记申报结果',
        actor: '李明',
        id: 'tax-op-2025q4-vat-receipt-pending',
        object: 'TAX-2025Q4-VAT',
        summary: '登记 2025-Q4 增值税及附加零申报，申报回执待补充',
        time: '2026-01-15 15:20'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '季度零申报',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-01-20',
    paymentStatus: '无需缴纳',
    period: '2025-Q4',
    periodType: '季度',
    processStatus: '待补回执',
    settlementDirection: '无需补退',
    sourceItems: [
      {
        id: 'tax-source-2025q4-vat-preparation',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '已确认',
        updatedAt: '2026-01-15'
      }
    ],
    title: '2025-Q4 增值税及附加',
    updatedAt: '2026-01-15'
  },
  {
    dataStatus: '已确认',
    declarationScenario: '季度申报',
    declarationDate: '2026-04-10',
    declarationDueDate: '2026-04-20',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '无申报义务',
    files: [],
    id: 'tax-matter-2026q1-stamp',
    linkedTransactionNos: [],
    matterNo: 'TAX-2026Q1-STAMP',
    matterType: '印花税',
    operationRecords: [
      {
        action: '确认无需申报',
        actor: '李明',
        id: 'tax-op-2026q1-stamp-001',
        object: 'TAX-2026Q1-STAMP',
        summary: '本期税源核对后无列举应税凭证，确认无需申报',
        time: '2026-04-10 11:00'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '应税凭证 0 条',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-04-20',
    paymentStatus: '无需缴纳',
    period: '2026-Q1',
    periodType: '季度',
    processStatus: '已完成',
    sourceItems: [
      {
        id: 'tax-source-2026q1-stamp-preparation',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '已确认',
        updatedAt: '2026-03-31'
      }
    ],
    title: '2026-Q1 印花税',
    updatedAt: '2026-04-10'
  },
  {
    dataStatus: '已确认',
    declarationDate: '2026-05-28',
    declarationDueDate: '2026-05-31',
    declarationHistory: [],
    declarationReceiptNo: 'CIT-2025-ANNUAL-001',
    declarationScenario: '年度汇算',
    declarationStatus: '申报成功',
    declarationVersion: 1,
    files: [],
    id: 'tax-matter-2025-cit-annual-refund',
    linkedTransactionNos: [],
    matterNo: 'TAX-2025-CIT-ANNUAL',
    matterType: '企业所得税',
    operationRecords: [
      {
        action: '登记申报结果',
        actor: '李明',
        id: 'tax-op-2025-cit-annual-refund',
        object: 'TAX-2025-CIT-ANNUAL',
        summary: '年度汇算申报成功，应退企业所得税 1,200.00 元',
        time: '2026-05-28 14:20'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '2025 年度汇算',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-08-31',
    paymentStatus: '无需缴纳',
    period: '2025',
    periodType: '年度',
    processStatus: '待退税',
    refundableAmount: 1200,
    refundedAmount: 0,
    refundStatus: '待退税',
    settlementDirection: '应退',
    sourceItems: [
      {
        id: 'tax-source-2025-cit-annual-preparation',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '已确认',
        updatedAt: '2026-05-28'
      }
    ],
    title: '2025 年度企业所得税汇算清缴',
    updatedAt: '2026-05-28'
  },
  {
    dataStatus: '待准备',
    declarationDueDate: '2027-05-31',
    declarationScenario: '年度汇算',
    declarationHistory: [],
    declarationVersion: 1,
    declarationStatus: '待申报',
    files: [],
    id: 'tax-matter-2026-cit-annual',
    linkedTransactionNos: [],
    matterNo: 'TAX-2026-CIT-ANNUAL',
    matterType: '企业所得税',
    operationRecords: [
      {
        action: '建立事项',
        actor: '李明',
        id: 'tax-op-2026-cit-annual',
        object: 'TAX-2026-CIT-ANNUAL',
        summary: '建立 2026 年度企业所得税汇算清缴事项',
        time: '2026-06-30 10:30'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '年度应纳税所得额',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2027-05-31',
    paymentStatus: '未开始',
    period: '2026',
    periodType: '年度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-2026-cit-annual',
        name: '办理依据',
        sourceModule: '申报准备',
        status: '待准备',
        updatedAt: '2026-06-30'
      }
    ],
    title: '2026 年度企业所得税汇算清缴',
    updatedAt: '2026-06-30'
  }
];

export function getTaxMatterOutstandingAmount(record: FinanceTaxMatterRecord) {
  return Math.max(0, record.payableAmount - record.paidAmount);
}

export function getTaxMatterFileStatus(record: FinanceTaxMatterRecord) {
  if (record.files.length > 0) {
    return '已归档';
  }

  if (record.processStatus === '数据待确认' || record.processStatus === '待申报') {
    return '未开始';
  }

  return record.processStatus === '已完成' ? '待补充' : '待上传';
}
