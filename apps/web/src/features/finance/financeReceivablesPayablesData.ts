import type { OperationRecord } from '../../components/OperationRecordTable';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import type { StatusTagTone } from '../../components/Detail';
import type { SalarySettlementSnapshot } from '../salary/salaryDomain';
import type { FinanceCategorySnapshot, FinanceReportAggregation, FinanceTransactionCategory } from './financeData';
import { getFinanceCategorySnapshot } from './financeData';
import { partTimeLaborPaymentSnapshot202606 } from './financeNaturalPersonPaymentSeeds';
import type { NaturalPersonPaymentSnapshot } from './naturalPersonPaymentTypes';
import {
  getDefaultReceivablePayableTaxBasis,
  type FinanceTaxBasis,
  type FinanceTaxBasisSource
} from './financeTaxBasisModel';

export type FinanceReceivablePayableDirection = '应收' | '应付';
export type FinanceReceivablePayableConfirmationStatus = '待确认' | '已确认' | '已作废';
export type FinanceReceivablePayableSettlementStatus = '未结清' | '部分结清' | '已结清';
export type FinanceReceivablePayableReviewProgressStatus = '待复核' | '部分待复核';
export type FinanceReceivablePayableTaxBasisSource = FinanceTaxBasisSource;
export type FinanceReceivablePayableCounterpartyType = '客户' | '员工' | '外协' | '供应商' | '内部';
export type FinanceReceivablePayableSourceType =
  | '合同应收'
  | '项目阶段确认'
  | '薪酬发放'
  | '员工报销'
  | '外协结算'
  | '材料采购'
  | '运营费用';

export type FinanceReceivablePayableTaxBasis = FinanceTaxBasis;

export type FinanceReceivablePayableRecord = {
  accountingPeriod: string;
  amount: number;
  category: FinanceTransactionCategory;
  categorySnapshot: FinanceCategorySnapshot;
  confirmDate: string;
  confirmationStatus: FinanceReceivablePayableConfirmationStatus;
  counterparty: string;
  counterpartyId?: string;
  counterpartyType: FinanceReceivablePayableCounterpartyType;
  direction: FinanceReceivablePayableDirection;
  documentNo: string;
  dueDate: string;
  files: RelatedFileRecord[];
  id: string;
  linkedTransactionNos: string[];
  note: string;
  naturalPersonPayment?: NaturalPersonPaymentSnapshot;
  operationRecords: OperationRecord[];
  owner: string;
  reportAggregation: FinanceReportAggregation;
  salarySettlement?: SalarySettlementSnapshot;
  settledAmount: number;
  settlementStatus: FinanceReceivablePayableSettlementStatus;
  sourceNo: string;
  sourceTitle: string;
  sourceType: FinanceReceivablePayableSourceType;
  taxBasis: FinanceReceivablePayableTaxBasis;
  updatedAt: string;
};

export const receivablePayableDirectionTone = {
  应收: 'green',
  应付: 'red'
} as const satisfies Record<FinanceReceivablePayableDirection, StatusTagTone>;

export const receivablePayableConfirmationStatusTone = {
  待确认: 'amber',
  已确认: 'green',
  已作废: 'gray'
} as const satisfies Record<FinanceReceivablePayableConfirmationStatus, StatusTagTone>;

export const receivablePayableSettlementStatusTone = {
  未结清: 'amber',
  部分结清: 'blue',
  已结清: 'green'
} as const satisfies Record<FinanceReceivablePayableSettlementStatus, StatusTagTone>;

export const receivablePayableReviewProgressTone = {
  待复核: 'blue',
  部分待复核: 'blue'
} as const satisfies Record<FinanceReceivablePayableReviewProgressStatus, StatusTagTone>;

export const financeReceivablePayableDirectionOptions: FinanceReceivablePayableDirection[] = ['应收', '应付'];

export const financeReceivablePayableConfirmationStatusOptions: FinanceReceivablePayableConfirmationStatus[] = [
  '待确认',
  '已确认',
  '已作废'
];

export const financeReceivablePayableSettlementStatusOptions: FinanceReceivablePayableSettlementStatus[] = [
  '未结清',
  '部分结清',
  '已结清'
];

export const financeReceivablePayableCounterpartyTypeOptions: FinanceReceivablePayableCounterpartyType[] = [
  '客户',
  '员工',
  '外协',
  '供应商',
  '内部'
];

export function getReceivablePayableOutstandingAmount(record: FinanceReceivablePayableRecord) {
  return Math.max(0, record.amount - record.settledAmount);
}

type FinanceReceivablePayableRecordSeed = Omit<FinanceReceivablePayableRecord, 'categorySnapshot' | 'reportAggregation' | 'taxBasis'> & {
  categorySnapshot?: FinanceCategorySnapshot;
  reportAggregation?: FinanceReportAggregation;
  taxBasis?: FinanceReceivablePayableTaxBasis;
};

export const financeReceivablePayableRecords: FinanceReceivablePayableRecord[] = ([
  {
    accountingPeriod: '2026-06',
    amount: 68000,
    category: '客户回款',
    confirmDate: '2026-06-01',
    confirmationStatus: '已确认',
    counterparty: '奈雪华南区域',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-001',
    dueDate: '2026-06-10',
    files: [
      {
        id: 'rp-file-001',
        name: '奈雪华南门店设计服务合同.pdf',
        status: '已上传',
        type: '合同文件',
        updatedAt: '2026-06-01'
      }
    ],
    id: 'ar-202606-001',
    linkedTransactionNos: ['FIN-202606-0001'],
    note: '合同阶段回款已全部收回。',
    operationRecords: [
      {
        id: 'rp-op-001',
        time: '2026-06-01 10:20',
        actor: '系统',
        object: 'AR-202606-001',
        action: '生成应收',
        summary: '根据合同阶段确认生成应收 68,000 元'
      },
      {
        id: 'rp-op-002',
        time: '2026-06-04 09:12',
        actor: '财务复核',
        object: 'AR-202606-001',
        action: '关联流水',
        summary: '关联 FIN-202606-0001 后结清'
      }
    ],
    owner: '李明',
    settledAmount: 68000,
    settlementStatus: '已结清',
    sourceNo: 'CON-2026-001',
    sourceTitle: '奈雪华南门店设计服务合同',
    sourceType: '合同应收',
    updatedAt: '2026-06-04 09:12'
  },
  {
    accountingPeriod: '2026-06',
    amount: 18000,
    category: '客户回款',
    confirmDate: '2026-06-08',
    confirmationStatus: '已确认',
    counterparty: '星河餐饮集团',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-002',
    dueDate: '2026-06-20',
    files: [
      {
        id: 'rp-file-002',
        name: '星河餐饮集团_阶段确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-08'
      }
    ],
    id: 'ar-202606-002',
    linkedTransactionNos: ['FIN-202606-0005'],
    note: '员工代收 9,800 元，剩余款项待客户支付。',
    operationRecords: [
      {
        id: 'rp-op-003',
        time: '2026-06-08 11:45',
        actor: '系统',
        object: 'AR-202606-002',
        action: '生成应收',
        summary: '根据项目阶段确认生成应收 18,000 元'
      },
      {
        id: 'rp-op-004',
        time: '2026-06-15 09:20',
        actor: '财务复核',
        object: 'AR-202606-002',
        action: '部分收款',
        summary: '关联员工代收流水 9,800 元'
      }
    ],
    owner: '李明',
    settledAmount: 9800,
    settlementStatus: '部分结清',
    sourceNo: 'CON-2026-009',
    sourceTitle: '星河餐饮集团空间设计项目',
    sourceType: '合同应收',
    updatedAt: '2026-06-15 09:20'
  },
  {
    accountingPeriod: '2026-06',
    amount: 12800,
    category: '客户回款',
    confirmDate: '2026-06-12',
    confirmationStatus: '已确认',
    counterparty: '光谷商业空间',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-003',
    dueDate: '2026-06-30',
    files: [
      {
        id: 'rp-file-003',
        name: '光谷商业空间_方案确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-12'
      }
    ],
    id: 'ar-202606-003',
    linkedTransactionNos: [],
    note: '已完成阶段确认，尚未产生收款流水。',
    operationRecords: [
      {
        id: 'rp-op-005',
        time: '2026-06-12 16:20',
        actor: '系统',
        object: 'AR-202606-003',
        action: '生成应收',
        summary: '根据项目阶段确认生成应收 12,800 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'PRJ-202606-003',
    sourceTitle: '光谷商业空间方案阶段',
    sourceType: '项目阶段确认',
    updatedAt: '2026-06-12 16:20'
  },
  {
    accountingPeriod: '2026-06',
    amount: 3200,
    category: '外协付款',
    confirmDate: '2026-06-11',
    confirmationStatus: '已确认',
    counterparty: '示例兼职 B',
    counterpartyId: '20260006',
    counterpartyType: '外协',
    direction: '应付',
    documentNo: 'AP-202606-003',
    dueDate: '2026-06-18',
    files: [
      {
        id: 'rp-file-006',
        name: '示例兼职B_外协结算单.pdf',
        status: '已上传',
        type: '结算单',
        updatedAt: '2026-06-11'
      }
    ],
    id: 'ap-202606-003',
    linkedTransactionNos: ['FIN-202606-0004'],
    naturalPersonPayment: partTimeLaborPaymentSnapshot202606,
    note: '协议金额为税前 3,200 元，已登记银行实付 2,720 元，等待流水复核。',
    operationRecords: [
      {
        id: 'rp-op-010',
        time: '2026-06-11 14:40',
        actor: '系统',
        object: 'AP-202606-003',
        action: '生成应付',
        summary: '根据外协结算生成应付 3,200 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'OUT-202606-0008',
    sourceTitle: '示例兼职 B 外协结算',
    sourceType: '外协结算',
    updatedAt: '2026-06-11 14:40'
  },
  {
    accountingPeriod: '2026-06',
    amount: 24000,
    category: '客户回款',
    confirmDate: '2026-06-18',
    confirmationStatus: '已确认',
    counterparty: '青禾咖啡',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-004',
    dueDate: '2026-06-25',
    files: [
      {
        id: 'rp-file-008',
        name: '青禾咖啡_设计尾款确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-18'
      }
    ],
    id: 'ar-202606-004',
    linkedTransactionNos: ['FIN-202606-0015'],
    note: '客户尾款已到账并完成银行对账。',
    operationRecords: [
      {
        id: 'rp-op-012',
        time: '2026-06-18 10:30',
        actor: '系统',
        object: 'AR-202606-004',
        action: '生成应收',
        summary: '根据项目尾款确认生成应收 24,000 元'
      },
      {
        id: 'rp-op-013',
        time: '2026-06-21 09:30',
        actor: '财务复核',
        object: 'AR-202606-004',
        action: '结清应收',
        summary: '关联 FIN-202606-0015 后结清'
      }
    ],
    owner: '李明',
    settledAmount: 24000,
    settlementStatus: '已结清',
    sourceNo: 'CON-2026-020',
    sourceTitle: '青禾咖啡门店设计尾款',
    sourceType: '合同应收',
    updatedAt: '2026-06-21 09:30'
  },
  {
    accountingPeriod: '2026-06',
    amount: 5200,
    category: '材料采购',
    confirmDate: '2026-06-21',
    confirmationStatus: '已确认',
    counterparty: '武汉源木物料',
    counterpartyType: '供应商',
    direction: '应付',
    documentNo: 'AP-202606-004',
    dueDate: '2026-06-25',
    files: [
      {
        id: 'rp-file-009',
        name: '武汉源木物料_材料采购单.pdf',
        status: '已上传',
        type: '采购凭证',
        updatedAt: '2026-06-21'
      }
    ],
    id: 'ap-202606-004',
    linkedTransactionNos: ['FIN-202606-0016'],
    note: '项目材料采购已完成付款和银行对账。',
    operationRecords: [
      {
        id: 'rp-op-014',
        time: '2026-06-21 14:30',
        actor: '系统',
        object: 'AP-202606-004',
        action: '生成应付',
        summary: '根据材料采购确认生成应付 5,200 元'
      },
      {
        id: 'rp-op-015',
        time: '2026-06-22 09:15',
        actor: '财务复核',
        object: 'AP-202606-004',
        action: '结清应付',
        summary: '关联 FIN-202606-0016 后结清'
      }
    ],
    owner: '李明',
    settledAmount: 5200,
    settlementStatus: '已结清',
    sourceNo: 'MAT-202606-004',
    sourceTitle: '门店打样材料采购',
    sourceType: '材料采购',
    updatedAt: '2026-06-22 09:15'
  },
  {
    accountingPeriod: '2026-06',
    amount: 1480,
    category: '办公费用',
    confirmDate: '2026-06-22',
    confirmationStatus: '已确认',
    counterparty: '云协同科技',
    counterpartyType: '供应商',
    direction: '应付',
    documentNo: 'AP-202606-005',
    dueDate: '2026-06-24',
    files: [
      {
        id: 'rp-file-010',
        name: '云协同科技_服务费电子发票.pdf',
        status: '已上传',
        type: '电子发票',
        updatedAt: '2026-06-22'
      }
    ],
    id: 'ap-202606-005',
    linkedTransactionNos: ['FIN-202606-0017'],
    note: '办公软件服务费已完成付款和银行对账。',
    operationRecords: [
      {
        id: 'rp-op-016',
        time: '2026-06-22 11:20',
        actor: '系统',
        object: 'AP-202606-005',
        action: '生成应付',
        summary: '根据运营费用确认生成应付 1,480 元'
      },
      {
        id: 'rp-op-017',
        time: '2026-06-23 09:40',
        actor: '财务复核',
        object: 'AP-202606-005',
        action: '结清应付',
        summary: '关联 FIN-202606-0017 后结清'
      }
    ],
    owner: '李明',
    settledAmount: 1480,
    settlementStatus: '已结清',
    sourceNo: 'EXP-202606-009',
    sourceTitle: '协同工具年度服务费',
    sourceType: '运营费用',
    updatedAt: '2026-06-23 09:40'
  },
  {
    accountingPeriod: '2026-06',
    amount: 960,
    category: '差旅交通',
    confirmDate: '2026-06-23',
    confirmationStatus: '已确认',
    counterparty: '刘宇',
    counterpartyType: '员工',
    direction: '应付',
    documentNo: 'AP-202606-006',
    dueDate: '2026-06-25',
    files: [
      {
        id: 'rp-file-011',
        name: '刘宇_长沙项目交通报销单.pdf',
        status: '已上传',
        type: '报销单',
        updatedAt: '2026-06-23'
      }
    ],
    id: 'ap-202606-006',
    linkedTransactionNos: ['FIN-202606-0018'],
    note: '项目现场交通费用已完成付款和银行对账。',
    operationRecords: [
      {
        id: 'rp-op-018',
        time: '2026-06-23 10:45',
        actor: '系统',
        object: 'AP-202606-006',
        action: '生成应付',
        summary: '根据员工报销确认生成应付 960 元'
      },
      {
        id: 'rp-op-019',
        time: '2026-06-24 09:25',
        actor: '财务复核',
        object: 'AP-202606-006',
        action: '结清应付',
        summary: '关联 FIN-202606-0018 后结清'
      }
    ],
    owner: '李明',
    settledAmount: 960,
    settlementStatus: '已结清',
    sourceNo: 'EXP-202606-010',
    sourceTitle: '长沙项目现场交通报销',
    sourceType: '员工报销',
    updatedAt: '2026-06-24 09:25'
  },
  {
    accountingPeriod: '2026-06',
    amount: 486.5,
    category: '差旅交通',
    confirmDate: '2026-05-30',
    confirmationStatus: '已确认',
    counterparty: '刘宇',
    counterpartyType: '员工',
    direction: '应付',
    documentNo: 'AP-202605-018',
    dueDate: '2026-06-05',
    files: [
      {
        id: 'rp-file-007',
        name: '刘宇_差旅交通报销单.pdf',
        status: '已上传',
        type: '报销单',
        updatedAt: '2026-05-30'
      }
    ],
    id: 'ap-202605-018',
    linkedTransactionNos: [],
    note: '费用报销审核通过后生成应付，尚未登记付款流水。',
    operationRecords: [
      {
        id: 'rp-op-011',
        time: '2026-05-30 17:20',
        actor: '系统',
        object: 'AP-202605-018',
        action: '生成应付',
        summary: '根据员工报销确认生成应付 486.50 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'EXP-202605-0012',
    sourceTitle: '刘宇 差旅交通报销',
    sourceType: '员工报销',
    updatedAt: '2026-05-30 17:20'
  },
  {
    accountingPeriod: '2026-06',
    amount: 600,
    category: '办公费用',
    confirmDate: '2026-06-15',
    confirmationStatus: '已确认',
    counterparty: '云协同科技',
    counterpartyType: '供应商',
    direction: '应付',
    documentNo: 'AP-202606-007',
    dueDate: '2026-06-30',
    files: [
      {
        id: 'rp-file-012',
        name: '云协同科技_6月协作服务确认单.pdf',
        status: '已上传',
        type: '服务确认单',
        updatedAt: '2026-06-15'
      }
    ],
    id: 'ap-202606-007',
    linkedTransactionNos: [],
    note: '协作服务费已确认，待关联进项发票并登记付款。',
    operationRecords: [
      {
        id: 'rp-op-020',
        time: '2026-06-15 15:20',
        actor: '系统',
        object: 'AP-202606-007',
        action: '生成应付',
        summary: '根据运营费用确认生成应付 600 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'EXP-202606-012',
    sourceTitle: '云协同科技 6 月协作服务费',
    sourceType: '运营费用',
    updatedAt: '2026-06-15 15:20'
  },
  {
    accountingPeriod: '2026-06',
    amount: 7500,
    category: '客户回款',
    confirmDate: '2026-06-18',
    confirmationStatus: '已确认',
    counterparty: '美刻咖啡',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-005',
    dueDate: '2026-06-28',
    files: [
      {
        id: 'rp-file-013',
        name: '美刻咖啡_设计阶段确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-18'
      }
    ],
    id: 'ar-202606-005',
    linkedTransactionNos: [],
    note: '设计阶段已确认，销项发票已完成关联。',
    operationRecords: [
      {
        id: 'rp-op-021',
        time: '2026-06-18 15:10',
        actor: '系统',
        object: 'AR-202606-005',
        action: '生成应收',
        summary: '根据项目阶段确认生成应收 7,500 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-2026-012',
    sourceTitle: '美刻咖啡门店设计阶段款',
    sourceType: '项目阶段确认',
    updatedAt: '2026-06-18 15:10'
  },
  {
    accountingPeriod: '2026-06',
    amount: 11800,
    category: '客户回款',
    confirmDate: '2026-06-21',
    confirmationStatus: '已确认',
    counterparty: '合众餐饮集团',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-006',
    dueDate: '2026-06-30',
    files: [
      {
        id: 'rp-file-014',
        name: '合众餐饮_多门店设计结算确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-21'
      }
    ],
    id: 'ar-202606-006',
    linkedTransactionNos: [],
    note: '两张阶段发票已关联至同一笔设计结算应收。',
    operationRecords: [
      {
        id: 'rp-op-022',
        time: '2026-06-21 16:30',
        actor: '系统',
        object: 'AR-202606-006',
        action: '生成应收',
        summary: '根据项目结算确认生成应收 11,800 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-2026-015',
    sourceTitle: '合众餐饮多门店设计结算款',
    sourceType: '项目阶段确认',
    updatedAt: '2026-06-21 16:30'
  },
  {
    accountingPeriod: '2026-06',
    amount: 4800,
    category: '客户回款',
    confirmDate: '2026-06-20',
    confirmationStatus: '已确认',
    counterparty: '光谷商业空间',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-007',
    dueDate: '2026-06-30',
    files: [
      {
        id: 'rp-file-015',
        name: '光谷商业空间_深化服务确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-20'
      }
    ],
    id: 'ar-202606-007',
    linkedTransactionNos: [],
    note: '深化服务已确认，可与同客户销项发票拆分关联。',
    operationRecords: [
      {
        id: 'rp-op-023',
        time: '2026-06-20 14:15',
        actor: '系统',
        object: 'AR-202606-007',
        action: '生成应收',
        summary: '根据项目阶段确认生成应收 4,800 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'PRJ-202606-007',
    sourceTitle: '光谷商业空间深化服务阶段',
    sourceType: '项目阶段确认',
    updatedAt: '2026-06-20 14:15'
  },
  {
    accountingPeriod: '2026-06',
    amount: 1200,
    category: '客户回款',
    confirmDate: '2026-06-16',
    confirmationStatus: '已确认',
    counterparty: '旧票红冲调整',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202606-008',
    dueDate: '2026-06-25',
    files: [
      {
        id: 'rp-file-018',
        name: '旧票红冲调整_服务确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-06-16'
      }
    ],
    id: 'ar-202606-008',
    linkedTransactionNos: [],
    note: '原蓝字发票已关联；后续红冲将生成负向业务分摊和调整凭证。',
    operationRecords: [
      {
        id: 'rp-op-026',
        time: '2026-06-16 09:20',
        actor: '系统',
        object: 'AR-202606-008',
        action: '生成应收',
        summary: '根据服务确认生成应收 1,200 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-2026-018',
    sourceTitle: '旧票红冲调整服务确认',
    sourceType: '合同应收',
    updatedAt: '2026-06-16 09:20'
  },
  {
    accountingPeriod: '2026-05',
    amount: 15000,
    category: '客户回款',
    confirmDate: '2026-05-20',
    confirmationStatus: '已确认',
    counterparty: '示例客户 A',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202605-001',
    dueDate: '2026-06-05',
    files: [
      {
        id: 'rp-file-016',
        name: '示例客户A_项目阶段确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-05-20'
      }
    ],
    id: 'ar-202605-001',
    linkedTransactionNos: [],
    note: '本期已开 12,000 元，剩余 3,000 元待开票。',
    operationRecords: [
      {
        id: 'rp-op-024',
        time: '2026-05-20 16:10',
        actor: '系统',
        object: 'AR-202605-001',
        action: '生成应收',
        summary: '根据项目阶段确认生成应收 15,000 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-2026-005',
    sourceTitle: '示例客户 A 项目阶段款',
    sourceType: '项目阶段确认',
    updatedAt: '2026-05-20 16:10'
  },
  {
    accountingPeriod: '2026-03',
    amount: 1000,
    category: '客户回款',
    confirmDate: '2026-03-28',
    confirmationStatus: '已确认',
    counterparty: '前期未开票客户',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202603-001',
    dueDate: '2026-03-28',
    files: [
      {
        id: 'rp-file-019',
        name: '前期未开票设计服务确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-03-28'
      }
    ],
    id: 'ar-202603-001',
    linkedTransactionNos: ['FIN-202603-0021'],
    note: '2026-Q1 已按未开票收入申报，后续开票关联本应收事项并在开票期间冲抵。',
    operationRecords: [
      {
        id: 'rp-op-027',
        time: '2026-03-28 15:20',
        actor: '系统',
        object: 'AR-202603-001',
        action: '生成应收',
        summary: '根据设计服务确认生成应收 1,000 元'
      }
    ],
    owner: '李明',
    settledAmount: 1000,
    settlementStatus: '已结清',
    sourceNo: 'CON-2026-002',
    sourceTitle: '前期未开票设计服务',
    sourceType: '合同应收',
    updatedAt: '2026-03-28 15:20'
  },
  {
    accountingPeriod: '2026-04',
    amount: 32000,
    category: '客户回款',
    confirmDate: '2026-04-18',
    confirmationStatus: '已确认',
    counterparty: '春序茶饮',
    counterpartyType: '客户',
    direction: '应收',
    documentNo: 'AR-202604-001',
    dueDate: '2026-04-30',
    files: [
      {
        id: 'rp-file-017',
        name: '春序茶饮_空间设计服务确认单.pdf',
        status: '已上传',
        type: '确认单',
        updatedAt: '2026-04-18'
      }
    ],
    id: 'ar-202604-001',
    linkedTransactionNos: [],
    note: '历史设计服务应收已完成销项发票关联。',
    operationRecords: [
      {
        id: 'rp-op-025',
        time: '2026-04-18 17:10',
        actor: '系统',
        object: 'AR-202604-001',
        action: '生成应收',
        summary: '根据合同确认生成应收 32,000 元'
      }
    ],
    owner: '李明',
    settledAmount: 0,
    settlementStatus: '未结清',
    sourceNo: 'CON-2026-004',
    sourceTitle: '春序茶饮空间设计服务',
    sourceType: '合同应收',
    updatedAt: '2026-04-18 17:10'
  },
] satisfies FinanceReceivablePayableRecordSeed[]).map((record) => {
  const seedRecord = record as FinanceReceivablePayableRecordSeed;
  const categorySnapshot = seedRecord.categorySnapshot ?? getFinanceCategorySnapshot(seedRecord.category);

  return {
    ...seedRecord,
    categorySnapshot,
    reportAggregation: seedRecord.reportAggregation ?? categorySnapshot.reportAggregation,
    taxBasis: seedRecord.taxBasis ?? getDefaultReceivablePayableTaxBasis(seedRecord)
  };
});
