import type { OperationRecord } from '../../components/OperationRecordTable';

export type AccountingSubjectType = '资产类' | '负债类' | '所有者权益类' | '成本类' | '损益类';
export type AccountingSubjectBalanceDirection = '借方' | '贷方';
export type AccountingSubjectStatus = '启用' | '停用';
export type AccountingStatementTarget = '资产负债表' | '利润表' | '现金流量辅助' | '不直接出表';
export type AccountingAuxiliaryScope = '客户' | '供应商' | '员工' | '项目' | '税费' | '无';
export type AccountingSubjectSource = '内置规范' | '企业明细';
export type AccountingCashFlowActivity = '经营活动' | '投资活动' | '筹资活动';

export type AccountingSubjectRecord = {
  auxiliaryScopes: AccountingAuxiliaryScope[];
  balanceDirection: AccountingSubjectBalanceDirection;
  cashFlowActivity?: AccountingCashFlowActivity;
  cashFlowItem?: string;
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
  cashFlowMappedCount: number;
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

export type AccountingSubjectProfile = {
  accountingStandard: '小企业会计准则';
  accountSetName: string;
  currency: '人民币';
  effectivePeriod: string;
  periodMode: '月度';
  taxpayerType: '小规模纳税人';
};

export const accountingSubjectProfile: AccountingSubjectProfile = {
  accountSetName: '公司默认账套',
  accountingStandard: '小企业会计准则',
  currency: '人民币',
  effectivePeriod: '2026-06',
  periodMode: '月度',
  taxpayerType: '小规模纳税人'
};

const baseOperationRecords: OperationRecord[] = [
  {
    action: '初始化',
    actor: '系统',
    object: '会计科目',
    summary: '按小企业会计准则和小规模纳税人口径初始化前端科目表',
    time: '2026-06-24 11:00'
  }
];

type AccountingSubjectSeedInput = Omit<
  AccountingSubjectRecord,
  'id' | 'operationRecords' | 'source' | 'status' | 'updatedAt'
> &
  Partial<Pick<AccountingSubjectRecord, 'id' | 'operationRecords' | 'source' | 'status' | 'updatedAt'>>;

function createAccountingSubject(record: AccountingSubjectSeedInput): AccountingSubjectRecord {
  return {
    id: `accounting-subject-${record.code.replace(/\./g, '-')}`,
    operationRecords: baseOperationRecords,
    source: '内置规范',
    status: '启用',
    updatedAt: '2026-06-30',
    ...record
  };
}

export const accountingSubjectSeedRows: AccountingSubjectRecord[] = [
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    code: '1001',
    name: '库存现金',
    note: '承接少量备用现金和线下现金收付，日常优先使用对公银行账户。',
    reportItem: '货币资金',
    sourceLinks: ['费用与代收'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    code: '1002',
    name: '银行存款',
    note: '承接复核入账后的对公账户资金余额。',
    reportItem: '货币资金',
    sourceLinks: ['收支流水', '银行对账', '账户台账'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    code: '1012',
    name: '其他货币资金',
    note: '承接保证金、第三方支付余额等不在基本户直接反映的货币资金。',
    reportItem: '货币资金',
    sourceLinks: ['账户台账'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '销售商品、提供劳务收到的现金',
    code: '1122',
    name: '应收账款',
    note: '承接合同、项目阶段确认形成的客户应收。',
    reportItem: '应收账款',
    sourceLinks: ['应收应付', '合同管理'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['供应商', '项目'],
    balanceDirection: '借方',
    code: '1123',
    name: '预付账款',
    note: '承接预付供应商、外协或服务商款项。',
    reportItem: '预付款项',
    sourceLinks: ['应收应付', '收支流水'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工', '项目'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '收到其他与经营活动有关的现金',
    code: '1221',
    name: '其他应收款',
    note: '承接员工代收、备用金等后续可能出现的往来事项。',
    reportItem: '其他应收款',
    sourceLinks: ['费用与代收'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['项目'],
    balanceDirection: '借方',
    code: '1405',
    name: '库存商品',
    note: '承接物料、样品等形成库存管理需求时的存货余额。',
    reportItem: '存货',
    sourceLinks: ['费用与代收', '应收应付'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    code: '1601',
    name: '固定资产',
    note: '承接办公设备、电子设备等固定资产原值。',
    reportItem: '固定资产',
    sourceLinks: ['费用与代收'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    code: '1602',
    name: '累计折旧',
    note: '承接固定资产累计计提折旧。',
    reportItem: '固定资产',
    sourceLinks: ['会计凭证'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    code: '1701',
    name: '无形资产',
    note: '承接软件、系统或其他可辨认无形资产原值。',
    reportItem: '无形资产',
    sourceLinks: ['费用与代收'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    code: '1801',
    name: '长期待摊费用',
    note: '承接需跨期摊销的装修、系统服务等长期待摊事项。',
    reportItem: '长期待摊费用',
    sourceLinks: ['费用与代收'],
    statementTarget: '资产负债表',
    type: '资产类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    code: '2001',
    name: '短期借款',
    note: '承接一年内到期的银行或其他借款。',
    reportItem: '短期借款',
    sourceLinks: ['收支流水'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['供应商', '项目'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '购买商品、接受劳务支付的现金',
    code: '2202',
    name: '应付账款',
    note: '承接外协、供应商、项目成本类应付事项。',
    reportItem: '应付账款',
    sourceLinks: ['应收应付', '任务结算'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '销售商品、提供劳务收到的现金',
    code: '2203',
    name: '预收账款',
    note: '承接已收款但尚未满足收入确认条件的客户预收款。',
    reportItem: '预收款项',
    sourceLinks: ['应收应付', '收支流水'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付给职工以及为职工支付的现金',
    code: '2211',
    name: '应付职工薪酬',
    note: '承接工资、绩效、社保公积金中公司承担部分等人员支出计提。',
    reportItem: '应付职工薪酬',
    sourceLinks: ['薪酬明细', '社保公积金'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付给职工以及为职工支付的现金',
    code: '2211.01',
    name: '应付职工薪酬-工资',
    note: '承接工资计提、发放和个税代扣相关的职工薪酬往来。',
    reportItem: '应付职工薪酬',
    sourceLinks: ['薪酬明细', '收支流水'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付给职工以及为职工支付的现金',
    code: '2211.02',
    name: '应付职工薪酬-绩效奖金',
    note: '承接月度、季度绩效确认和发放形成的职工薪酬往来。',
    reportItem: '应付职工薪酬',
    sourceLinks: ['绩效明细', '薪酬明细'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付给职工以及为职工支付的现金',
    code: '2211.03',
    name: '应付职工薪酬-社保',
    note: '承接公司承担和个人代扣形成的社保缴费应付。',
    reportItem: '应付职工薪酬',
    sourceLinks: ['社保公积金', '税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付给职工以及为职工支付的现金',
    code: '2211.04',
    name: '应付职工薪酬-公积金',
    note: '承接公司承担和个人代扣形成的公积金缴费应付。',
    reportItem: '应付职工薪酬',
    sourceLinks: ['社保公积金', '税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '2221',
    name: '应交税费',
    note: '承接增值税、个税、企业所得税等待缴税费。',
    reportItem: '应交税费',
    sourceLinks: ['税务办理', '申报准备'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '2221.01',
    name: '应交税费-应交增值税',
    note: '承接小规模纳税人销项侧简易计税形成的应交增值税。',
    reportItem: '应交税费',
    sourceLinks: ['应收应付', '发票台账', '税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '2221.02',
    name: '应交税费-应交企业所得税',
    note: '承接企业所得税预缴或汇算确认后的应交企业所得税。',
    reportItem: '应交税费',
    sourceLinks: ['申报准备', '税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费', '员工'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '2221.03',
    name: '应交税费-代扣代缴个人所得税',
    note: '承接工资薪金个人所得税代扣代缴金额。',
    reportItem: '应交税费',
    sourceLinks: ['薪酬明细', '税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '2221.04',
    name: '应交税费-城市维护建设税及附加',
    note: '承接增值税附征的城市维护建设税、教育费附加和地方教育附加。',
    reportItem: '应交税费',
    sourceLinks: ['申报准备', '税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '2221.05',
    name: '应交税费-应交印花税',
    note: '承接合同、账簿等应税凭证形成的印花税。',
    reportItem: '应交税费',
    sourceLinks: ['税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '2221.99',
    name: '应交税费-其他税费',
    note: '承接暂未细分到具体税种的其他应交税费，后续应按税种补充分录规则。',
    reportItem: '应交税费',
    sourceLinks: ['税务办理'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付其他与经营活动有关的现金',
    code: '2241',
    name: '其他应付款',
    note: '承接员工报销、暂收暂付等非供应商应付款项。',
    reportItem: '其他应付款',
    sourceLinks: ['费用与代收', '应收应付'],
    statementTarget: '资产负债表',
    type: '负债类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    cashFlowActivity: '筹资活动',
    cashFlowItem: '吸收投资收到的现金',
    code: '3001',
    name: '实收资本',
    note: '承接股东实缴资本。',
    reportItem: '实收资本',
    sourceLinks: [],
    statementTarget: '资产负债表',
    type: '所有者权益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    code: '3002',
    name: '资本公积',
    note: '承接资本溢价等资本性权益变动。',
    reportItem: '资本公积',
    sourceLinks: [],
    statementTarget: '资产负债表',
    type: '所有者权益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    code: '3103',
    name: '本年利润',
    note: '承接本年累计损益结转余额。',
    reportItem: '未分配利润',
    sourceLinks: ['会计凭证', '总账'],
    statementTarget: '资产负债表',
    type: '所有者权益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    code: '3104',
    name: '利润分配',
    note: '承接利润分配和年末结转后的未分配利润。',
    reportItem: '未分配利润',
    sourceLinks: ['会计凭证', '总账'],
    statementTarget: '资产负债表',
    type: '所有者权益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '销售商品、提供劳务收到的现金',
    code: '5001',
    name: '主营业务收入',
    note: '承接客户合同收入确认，不等同于收款流水。',
    reportItem: '营业收入',
    sourceLinks: ['应收应付', '合同管理'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '贷方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '收到其他与经营活动有关的现金',
    code: '5051',
    name: '其他业务收入',
    note: '承接非主营设计服务但仍属于业务经营范围的收入。',
    reportItem: '营业收入',
    sourceLinks: ['收支流水'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '贷方',
    code: '5301',
    name: '营业外收入',
    note: '承接与日常经营无直接关系的利得。',
    reportItem: '营业外收入',
    sourceLinks: ['收支流水'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['项目', '供应商'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '购买商品、接受劳务支付的现金',
    code: '5401',
    name: '主营业务成本',
    note: '承接项目外协、材料等直接履约成本。',
    reportItem: '营业成本',
    sourceLinks: ['应收应付', '任务结算'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '5403',
    name: '税金及附加',
    note: '承接城市维护建设税、教育费附加、地方教育附加、印花税等经营税费。',
    reportItem: '税金及附加',
    sourceLinks: ['税务办理', '申报准备'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['客户', '项目'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付其他与经营活动有关的现金',
    code: '5601',
    name: '销售费用',
    note: '承接销售、市场、客户拓展相关期间费用。',
    reportItem: '销售费用',
    sourceLinks: ['费用与代收'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['项目', '员工'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付其他与经营活动有关的现金',
    code: '5602',
    name: '管理费用',
    note: '承接办公、差旅、薪酬等期间费用。',
    reportItem: '管理费用',
    sourceLinks: ['费用与代收', '薪酬明细'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付给职工以及为职工支付的现金',
    code: '5602.01',
    name: '管理费用-职工薪酬',
    note: '承接管理与后台人员工资、绩效等期间薪酬费用。',
    reportItem: '管理费用',
    sourceLinks: ['薪酬明细', '绩效明细'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付给职工以及为职工支付的现金',
    code: '5602.02',
    name: '管理费用-社保公积金',
    note: '承接公司承担的社保、公积金等人员保障支出。',
    reportItem: '管理费用',
    sourceLinks: ['社保公积金'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['供应商'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付其他与经营活动有关的现金',
    code: '5602.03',
    name: '管理费用-办公费',
    note: '承接办公耗材、系统服务费等日常运营费用。',
    reportItem: '管理费用',
    sourceLinks: ['费用与代收', '应收应付'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['员工', '项目'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付其他与经营活动有关的现金',
    code: '5602.04',
    name: '管理费用-差旅交通费',
    note: '承接差旅、交通和现场执行相关期间费用。',
    reportItem: '管理费用',
    sourceLinks: ['费用与代收', '应收应付'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付其他与经营活动有关的现金',
    code: '5603',
    name: '财务费用',
    note: '承接利息支出、手续费等资金成本。',
    reportItem: '财务费用',
    sourceLinks: ['收支流水'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['无'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付其他与经营活动有关的现金',
    code: '5711',
    name: '营业外支出',
    note: '承接与日常经营无直接关系的损失。',
    reportItem: '营业外支出',
    sourceLinks: ['收支流水'],
    statementTarget: '利润表',
    type: '损益类'
  }),
  createAccountingSubject({
    auxiliaryScopes: ['税费'],
    balanceDirection: '借方',
    cashFlowActivity: '经营活动',
    cashFlowItem: '支付的各项税费',
    code: '5801',
    name: '所得税费用',
    note: '承接企业所得税费用，当前仅作为报表前置科目。',
    reportItem: '所得税费用',
    sourceLinks: ['税务办理'],
    statementTarget: '利润表',
    type: '损益类'
  })
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
    cashFlowMappedCount: enabledRows.filter((row) => row.cashFlowItem && row.cashFlowActivity).length,
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
    record.cashFlowActivity,
    record.cashFlowItem,
    record.note,
    ...record.auxiliaryScopes,
    ...record.sourceLinks
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}
