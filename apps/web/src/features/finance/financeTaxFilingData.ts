import type { StatusTagTone } from '../../components/Detail';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';

export type FinanceTaxMatterType = '个人所得税' | '社保缴纳' | '公积金缴纳' | '增值税及附加' | '企业所得税' | '印花税' | '其他税费';
export type FinanceTaxMatterPeriodType = '月度' | '季度' | '年度' | '按次';
export type FinanceTaxMatterProcessStatus = '数据待确认' | '可申报' | '待上传回执' | '已完成';
export type FinanceTaxMatterDataStatus = '待准备' | '待复核' | '已确认';
export type FinanceTaxMatterDeclarationStatus = '待申报' | '已申报' | '已核定' | '零申报' | '无需申报';
export type FinanceTaxMatterPaymentStatus = '未开始' | '无需缴纳' | '待缴纳' | '部分缴纳' | '已缴纳';
export type FinanceTaxMatterSourceStatus = '待准备' | '待复核' | '已确认' | '不适用';

export type FinanceTaxMatterSourceItem = {
  id: string;
  name: string;
  sourceModule: string;
  status: FinanceTaxMatterSourceStatus;
  updatedAt: string;
};

export type FinanceTaxMatterRecord = {
  dataStatus: FinanceTaxMatterDataStatus;
  declarationDate?: string;
  declarationDueDate: string;
  declarationStatus: FinanceTaxMatterDeclarationStatus;
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
  paymentDueDate: string;
  paymentStatus: FinanceTaxMatterPaymentStatus;
  period: string;
  periodType: FinanceTaxMatterPeriodType;
  processStatus: FinanceTaxMatterProcessStatus;
  sourceItems: FinanceTaxMatterSourceItem[];
  title: string;
  updatedAt: string;
};

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
  可申报: 'blue',
  待上传回执: 'amber',
  已完成: 'green'
} as const satisfies Record<FinanceTaxMatterProcessStatus, StatusTagTone>;

export const taxMatterDataStatusTone = {
  待准备: 'amber',
  待复核: 'blue',
  已确认: 'green'
} as const satisfies Record<FinanceTaxMatterDataStatus, StatusTagTone>;

export const taxMatterDeclarationStatusTone = {
  待申报: 'amber',
  已申报: 'green',
  已核定: 'green',
  零申报: 'gray',
  无需申报: 'gray'
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
    declarationDueDate: '2026-07-15',
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
        action: '来源同步',
        summary: '同步薪酬明细数据，形成 2026-06 个人所得税事项'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '待确认',
    payableAmount: 0,
    paymentDueDate: '2026-07-15',
    paymentStatus: '未开始',
    period: '2026-06',
    periodType: '月度',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-001',
        name: '薪酬明细',
        sourceModule: '薪酬明细',
        status: '待复核',
        updatedAt: '2026-06-18'
      },
      {
        id: 'tax-source-002',
        name: '工资薪金个税表',
        sourceModule: '自然人电子税务局',
        status: '待准备',
        updatedAt: '2026-06-18'
      }
    ],
    title: '2026-06 个人所得税',
    updatedAt: '2026-06-18'
  },
  {
    dataStatus: '待复核',
    declarationDueDate: '2026-07-20',
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
    declarationDueDate: '2026-07-15',
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
    declarationDueDate: '2026-07-15',
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
    participantSummary: '季度利润',
    payableAmount: 0,
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
    title: '2026-Q2 企业所得税预缴',
    updatedAt: '2026-06-21'
  },
  {
    dataStatus: '待复核',
    declarationDueDate: '2026-07-15',
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
        summary: '登记 2026-Q2 印花税事项'
      }
    ],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '合同触发',
    payableAmount: 0,
    paymentDueDate: '2026-07-15',
    paymentStatus: '未开始',
    period: '2026-Q2',
    periodType: '按次',
    processStatus: '数据待确认',
    sourceItems: [
      {
        id: 'tax-source-012',
        name: '合同签署记录',
        sourceModule: '合同管理',
        status: '待复核',
        updatedAt: '2026-06-18'
      },
      {
        id: 'tax-source-013',
        name: '特定业务事项',
        sourceModule: '经营数据',
        status: '待准备',
        updatedAt: '2026-06-18'
      }
    ],
    title: '2026-Q2 印花税',
    updatedAt: '2026-06-18'
  },
  {
    dataStatus: '已确认',
    declarationDate: '2026-04-12',
    declarationDueDate: '2026-04-15',
    declarationStatus: '已申报',
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
    paidAmount: 450,
    participantSummary: '季度收入',
    payableAmount: 450,
    paymentDueDate: '2026-04-15',
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
    updatedAt: '2026-04-12'
  },
  {
    dataStatus: '已确认',
    declarationDate: '2026-04-12',
    declarationDueDate: '2026-04-15',
    declarationStatus: '已申报',
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
    participantSummary: '季度利润',
    payableAmount: 500,
    paymentDueDate: '2026-04-15',
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
    title: '2026-Q1 企业所得税预缴',
    updatedAt: '2026-04-12'
  }
];

export function getTaxMatterOutstandingAmount(record: FinanceTaxMatterRecord) {
  return Math.max(0, record.payableAmount - record.paidAmount);
}

export function getTaxMatterFileStatus(record: FinanceTaxMatterRecord) {
  if (record.files.length > 0) {
    return '已归档';
  }

  return record.processStatus === '已完成' ? '待补充' : '待上传';
}
