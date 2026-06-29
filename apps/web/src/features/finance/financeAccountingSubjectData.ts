import type { OperationRecord } from '../../components/OperationRecordTable';

export type AccountingSubjectType = '资产类' | '负债类' | '所有者权益类' | '成本类' | '损益类';
export type AccountingSubjectBalanceDirection = '借方' | '贷方';
export type AccountingSubjectStatus = '启用' | '停用';
export type AccountingStatementTarget = '资产负债表' | '利润表' | '现金流量辅助' | '不直接出表';
export type AccountingAuxiliaryScope = '客户' | '供应商' | '员工' | '项目' | '税费' | '无';
export type AccountingSubjectSource = '内置规范' | '企业明细';

export type AccountingSubjectRecord = {
  auxiliaryScopes: AccountingAuxiliaryScope[];
  balanceDirection: AccountingSubjectBalanceDirection;
  code: string;
  id: string;
  name: string;
  note: string;
  operationRecords: OperationRecord[];
  reportItem: string;
  source: AccountingSubjectSource;
  sourceLinks: string[];
  statementTarget: AccountingStatementTarget;
  status: AccountingSubjectStatus;
  type: AccountingSubjectType;
  updatedAt: string;
};

export type AccountingSubjectFilters = {
  keyword: string;
  statementTarget: '全部' | AccountingStatementTarget;
  status: '全部' | AccountingSubjectStatus;
  type: '全部' | AccountingSubjectType;
};

export type AccountingSubjectMetrics = {
  balanceSheetCount: number;
  enabledCount: number;
  profitStatementCount: number;
  standardCount: number;
};

export const accountingSubjectTypeOptions: AccountingSubjectType[] = ['资产类', '负债类', '所有者权益类', '成本类', '损益类'];
export const accountingStatementTargetOptions: AccountingStatementTarget[] = ['资产负债表', '利润表', '现金流量辅助', '不直接出表'];

export const accountingSubjectTypeTone = {
  资产类: 'green',
  负债类: 'red',
  所有者权益类: 'purple',
  成本类: 'amber',
  损益类: 'blue'
} as const;

export const accountingSubjectStatusTone = {
  启用: 'green',
  停用: 'gray'
} as const;

export const accountingStatementTargetTone = {
  资产负债表: 'purple',
  利润表: 'blue',
  现金流量辅助: 'green',
  不直接出表: 'gray'
} as const;

const baseOperationRecords: OperationRecord[] = [
  {
    action: '初始化',
    actor: '系统',
    object: '会计科目',
    summary: '根据小型企业常用科目建立前端演示科目表',
    time: '2026-06-24 11:00'
  }
];

export const accountingSubjectSeedRows: AccountingSubjectRecord[] = [
  {
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    code: '1002',
    id: 'accounting-subject-bank-deposit',
    name: '银行存款',
    note: '承接复核入账后的对公账户资金余额。',
    operationRecords: baseOperationRecords,
    reportItem: '货币资金',
    source: '内置规范',
    sourceLinks: ['收支流水', '银行对账', '账户台账'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '资产类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '借方',
    code: '1122',
    id: 'accounting-subject-accounts-receivable',
    name: '应收账款',
    note: '承接合同、项目阶段确认形成的客户应收。',
    operationRecords: baseOperationRecords,
    reportItem: '应收账款',
    source: '内置规范',
    sourceLinks: ['应收应付', '合同管理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '资产类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['员工', '项目'],
    balanceDirection: '借方',
    code: '1221',
    id: 'accounting-subject-other-receivable',
    name: '其他应收款',
    note: '承接员工代收、备用金等后续可能出现的往来事项。',
    operationRecords: baseOperationRecords,
    reportItem: '其他应收款',
    source: '内置规范',
    sourceLinks: ['费用与代收'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '资产类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['供应商', '项目'],
    balanceDirection: '贷方',
    code: '2202',
    id: 'accounting-subject-accounts-payable',
    name: '应付账款',
    note: '承接外协、供应商、项目成本类应付事项。',
    operationRecords: baseOperationRecords,
    reportItem: '应付账款',
    source: '内置规范',
    sourceLinks: ['应收应付', '任务结算'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    code: '2211',
    id: 'accounting-subject-payroll-payable',
    name: '应付职工薪酬',
    note: '承接工资、绩效、社保公积金中公司承担部分等人员支出计提。',
    operationRecords: baseOperationRecords,
    reportItem: '应付职工薪酬',
    source: '内置规范',
    sourceLinks: ['薪酬明细', '社保公积金'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    code: '2211.01',
    id: 'accounting-subject-payroll-payable-salary',
    name: '应付职工薪酬-工资',
    note: '承接工资计提、发放和个税代扣相关的职工薪酬往来。',
    operationRecords: baseOperationRecords,
    reportItem: '应付职工薪酬',
    source: '内置规范',
    sourceLinks: ['薪酬明细', '收支流水'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    code: '2211.02',
    id: 'accounting-subject-payroll-payable-performance',
    name: '应付职工薪酬-绩效奖金',
    note: '承接月度、季度绩效确认和发放形成的职工薪酬往来。',
    operationRecords: baseOperationRecords,
    reportItem: '应付职工薪酬',
    source: '内置规范',
    sourceLinks: ['绩效明细', '薪酬明细'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    code: '2211.03',
    id: 'accounting-subject-payroll-payable-social-insurance',
    name: '应付职工薪酬-社保',
    note: '承接公司承担和个人代扣形成的社保缴费应付。',
    operationRecords: baseOperationRecords,
    reportItem: '应付职工薪酬',
    source: '内置规范',
    sourceLinks: ['社保公积金', '税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    code: '2211.04',
    id: 'accounting-subject-payroll-payable-housing-fund',
    name: '应付职工薪酬-公积金',
    note: '承接公司承担和个人代扣形成的公积金缴费应付。',
    operationRecords: baseOperationRecords,
    reportItem: '应付职工薪酬',
    source: '内置规范',
    sourceLinks: ['社保公积金', '税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    code: '2221',
    id: 'accounting-subject-tax-payable',
    name: '应交税费',
    note: '承接增值税、个税、企业所得税等待缴税费。',
    operationRecords: baseOperationRecords,
    reportItem: '应交税费',
    source: '内置规范',
    sourceLinks: ['税务办理', '申报准备'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    code: '2221.01',
    id: 'accounting-subject-tax-payable-vat-small-scale',
    name: '应交税费-应交增值税',
    note: '承接小规模纳税人销项侧简易计税形成的应交增值税。',
    operationRecords: baseOperationRecords,
    reportItem: '应交税费',
    source: '内置规范',
    sourceLinks: ['应收应付', '发票台账', '税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    code: '2221.02',
    id: 'accounting-subject-tax-payable-corporate-income-tax',
    name: '应交税费-应交企业所得税',
    note: '承接企业所得税预缴或汇算确认后的应交企业所得税。',
    operationRecords: baseOperationRecords,
    reportItem: '应交税费',
    source: '内置规范',
    sourceLinks: ['申报准备', '税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['税费', '员工'],
    balanceDirection: '贷方',
    code: '2221.03',
    id: 'accounting-subject-tax-payable-personal-income-tax',
    name: '应交税费-代扣代缴个人所得税',
    note: '承接工资薪金个人所得税代扣代缴金额。',
    operationRecords: baseOperationRecords,
    reportItem: '应交税费',
    source: '内置规范',
    sourceLinks: ['薪酬明细', '税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    code: '2221.04',
    id: 'accounting-subject-tax-payable-surcharge',
    name: '应交税费-城市维护建设税及附加',
    note: '承接增值税附征的城市维护建设税、教育费附加和地方教育附加。',
    operationRecords: baseOperationRecords,
    reportItem: '应交税费',
    source: '内置规范',
    sourceLinks: ['申报准备', '税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    code: '2221.05',
    id: 'accounting-subject-tax-payable-stamp-tax',
    name: '应交税费-应交印花税',
    note: '承接合同、账簿等应税凭证形成的印花税。',
    operationRecords: baseOperationRecords,
    reportItem: '应交税费',
    source: '内置规范',
    sourceLinks: ['税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    code: '2221.99',
    id: 'accounting-subject-tax-payable-other-tax',
    name: '应交税费-其他税费',
    note: '承接暂未细分到具体税种的其他应交税费，后续应按税种补充分录规则。',
    operationRecords: baseOperationRecords,
    reportItem: '应交税费',
    source: '内置规范',
    sourceLinks: ['税务办理'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    code: '2241',
    id: 'accounting-subject-other-payable',
    name: '其他应付款',
    note: '承接员工报销、暂收暂付等非供应商应付款项。',
    operationRecords: baseOperationRecords,
    reportItem: '其他应付款',
    source: '内置规范',
    sourceLinks: ['费用与代收', '应收应付'],
    statementTarget: '资产负债表',
    status: '启用',
    type: '负债类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    code: '4001',
    id: 'accounting-subject-paid-in-capital',
    name: '实收资本',
    note: '承接股东实缴资本，当前仅保留科目位置。',
    operationRecords: baseOperationRecords,
    reportItem: '实收资本',
    source: '内置规范',
    sourceLinks: [],
    statementTarget: '资产负债表',
    status: '启用',
    type: '所有者权益类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['项目', '供应商'],
    balanceDirection: '借方',
    code: '6401',
    id: 'accounting-subject-main-cost',
    name: '主营业务成本',
    note: '承接项目外协、材料等直接履约成本。',
    operationRecords: baseOperationRecords,
    reportItem: '营业成本',
    source: '内置规范',
    sourceLinks: ['应收应付', '任务结算'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '借方',
    code: '6403',
    id: 'accounting-subject-taxes-and-surcharges',
    name: '税金及附加',
    note: '承接城市维护建设税、教育费附加、地方教育附加、印花税等经营税费。',
    operationRecords: baseOperationRecords,
    reportItem: '税金及附加',
    source: '内置规范',
    sourceLinks: ['税务办理', '申报准备'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '贷方',
    code: '6001',
    id: 'accounting-subject-main-income',
    name: '主营业务收入',
    note: '承接客户合同收入确认，不等同于收款流水。',
    operationRecords: baseOperationRecords,
    reportItem: '营业收入',
    source: '内置规范',
    sourceLinks: ['应收应付', '合同管理'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '贷方',
    code: '6051',
    id: 'accounting-subject-other-business-income',
    name: '其他业务收入',
    note: '承接非主营设计服务但仍属于业务经营范围的收入。',
    operationRecords: baseOperationRecords,
    reportItem: '营业收入',
    source: '内置规范',
    sourceLinks: ['收支流水'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['项目', '员工'],
    balanceDirection: '借方',
    code: '6602',
    id: 'accounting-subject-admin-expense',
    name: '管理费用',
    note: '承接办公、差旅、薪酬等期间费用。',
    operationRecords: baseOperationRecords,
    reportItem: '期间费用',
    source: '内置规范',
    sourceLinks: ['费用与代收', '薪酬明细'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-24'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '借方',
    code: '6602.01',
    id: 'accounting-subject-admin-expense-payroll',
    name: '管理费用-职工薪酬',
    note: '承接管理与后台人员工资、绩效等期间薪酬费用。',
    operationRecords: baseOperationRecords,
    reportItem: '期间费用',
    source: '内置规范',
    sourceLinks: ['薪酬明细', '绩效明细'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['员工'],
    balanceDirection: '借方',
    code: '6602.02',
    id: 'accounting-subject-admin-expense-social-insurance',
    name: '管理费用-社保公积金',
    note: '承接公司承担的社保、公积金等人员保障支出。',
    operationRecords: baseOperationRecords,
    reportItem: '期间费用',
    source: '内置规范',
    sourceLinks: ['社保公积金'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['供应商'],
    balanceDirection: '借方',
    code: '6602.03',
    id: 'accounting-subject-admin-expense-office',
    name: '管理费用-办公费',
    note: '承接办公耗材、系统服务费等日常运营费用。',
    operationRecords: baseOperationRecords,
    reportItem: '期间费用',
    source: '内置规范',
    sourceLinks: ['费用与代收', '应收应付'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['员工', '项目'],
    balanceDirection: '借方',
    code: '6602.04',
    id: 'accounting-subject-admin-expense-travel',
    name: '管理费用-差旅交通费',
    note: '承接差旅、交通和现场执行相关期间费用。',
    operationRecords: baseOperationRecords,
    reportItem: '期间费用',
    source: '内置规范',
    sourceLinks: ['费用与代收', '应收应付'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-28'
  },
  {
    auxiliaryScopes: ['税费'],
    balanceDirection: '借方',
    code: '6801',
    id: 'accounting-subject-income-tax-expense',
    name: '所得税费用',
    note: '承接企业所得税费用，当前仅作为报表前置科目。',
    operationRecords: baseOperationRecords,
    reportItem: '所得税费用',
    source: '内置规范',
    sourceLinks: ['税务办理'],
    statementTarget: '利润表',
    status: '启用',
    type: '损益类',
    updatedAt: '2026-06-24'
  }
];

export const defaultAccountingSubjectFilters: AccountingSubjectFilters = {
  keyword: '',
  statementTarget: '全部',
  status: '全部',
  type: '全部'
};

export function buildAccountingSubjectMetrics(rows: AccountingSubjectRecord[]): AccountingSubjectMetrics {
  const enabledRows = rows.filter((row) => row.status === '启用');

  return {
    balanceSheetCount: enabledRows.filter((row) => row.statementTarget === '资产负债表').length,
    enabledCount: enabledRows.length,
    profitStatementCount: enabledRows.filter((row) => row.statementTarget === '利润表').length,
    standardCount: enabledRows.filter((row) => row.source === '内置规范').length
  };
}

export function getAccountingSubjectByCode(code: string, rows = accountingSubjectSeedRows) {
  return rows.find((row) => row.code === code);
}

export function matchesAccountingSubjectFilters(record: AccountingSubjectRecord, filters: AccountingSubjectFilters) {
  if (filters.type !== '全部' && record.type !== filters.type) {
    return false;
  }

  if (filters.statementTarget !== '全部' && record.statementTarget !== filters.statementTarget) {
    return false;
  }

  if (filters.status !== '全部' && record.status !== filters.status) {
    return false;
  }

  const keyword = filters.keyword.trim().toLowerCase();

  if (!keyword) {
    return true;
  }

  return [
    record.code,
    record.name,
    record.source,
    record.reportItem,
    record.note,
    ...record.auxiliaryScopes,
    ...record.sourceLinks
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}
