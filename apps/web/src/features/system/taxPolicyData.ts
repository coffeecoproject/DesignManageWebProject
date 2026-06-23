import type { StatusTagTone } from '../../components/Detail';

export type TaxPolicyStatus = '生效中' | '随事项确认';
export type TaxPolicyGroup = '经营税费' | '人员税费' | '合同税费';

export type TaxPolicyMetric = {
  label: string;
  value: string;
};

export type TaxPolicyParameter = {
  label: string;
  value: string;
};

export type TaxPolicyCalculationRule = {
  basis: string;
  name: string;
  result: string;
};

export type TaxPolicyVersionRecord = {
  changedAt: string;
  changeSummary: string;
  id: string;
  version: string;
};

export type TaxPolicyRule = {
  calculationRules: TaxPolicyCalculationRule[];
  declarationCycle: string;
  effectivePeriod: string;
  group: TaxPolicyGroup;
  id: string;
  metrics: TaxPolicyMetric[];
  officialChannel: string;
  parameters: TaxPolicyParameter[];
  primaryStatement?: string;
  region: string;
  status: TaxPolicyStatus;
  taxpayerScope: string;
  title: string;
  usedModules: string[];
  versionRecords: TaxPolicyVersionRecord[];
};

export const taxPolicyStatusTone = {
  生效中: 'green',
  随事项确认: 'blue'
} as const satisfies Record<TaxPolicyStatus, StatusTagTone>;

export const taxPolicyGroupTone = {
  经营税费: 'green',
  人员税费: 'blue',
  合同税费: 'purple'
} as const satisfies Record<TaxPolicyGroup, StatusTagTone>;

export const taxPolicyRules: TaxPolicyRule[] = [
  {
    calculationRules: [
      {
        basis: '湖北武汉小规模纳税人季度不含税销售额',
        name: '免征判断',
        result: '季度不含税销售额 30 万元以下按免征增值税口径处理'
      },
      {
        basis: '普通销售额、专票销售额和小规模当期征收口径',
        name: '应纳税额',
        result: '普通销售额按季度阈值判断；专票部分不直接按免税处理，以电子税务局带出结果为准'
      },
      {
        basis: '申报准备确认结果',
        name: '结果回填',
        result: '系统仅作申报前测算；最终纳税额以电子税务局申报和回执为准'
      }
    ],
    declarationCycle: '季度',
    effectivePeriod: '按当期有效政策',
    group: '经营税费',
    id: 'tax-policy-vat-surcharge',
    metrics: [
      { label: '税费范围', value: '增值税+附加' },
      { label: '计税来源', value: '销售额/两税' },
      { label: '确认方式', value: '季度准备' }
    ],
    officialChannel: '湖北省电子税务局',
    parameters: [
      { label: '纳税人类型', value: '小规模纳税人' },
      { label: '地区', value: '湖北省武汉市' },
      { label: '收入口径', value: '不含税销售额' },
      { label: '申报周期', value: '季度' },
      { label: '免税阈值', value: '季度不含税销售额 30 万元以下' },
      { label: '专票口径', value: '不直接按免税处理，以电子税务局结果为准' },
      { label: '附加税关系', value: '增值税为 0 时附加税通常为 0；有应缴增值税时再测算附加税' },
      { label: '结果回填', value: '以电子税务局申报结果为准' },
      { label: '准备模块', value: '申报准备' },
      { label: '办理模块', value: '税务办理' }
    ],
    primaryStatement: '小规模纳税人 / 季度不含税销售额 30 万元以下免征增值税',
    region: '湖北武汉',
    status: '随事项确认',
    taxpayerScope: '公司主体',
    title: '增值税及附加',
    usedModules: ['申报准备', '税务办理', '发票台账', '发票匹配', '收支流水'],
    versionRecords: [
      {
        changedAt: '2026-06-21',
        changeSummary: '固定湖北武汉小规模季度不含税销售额 30 万元以下免税口径，并区分普通销售额与专票处理边界',
        id: 'tax-policy-vat-v1',
        version: 'V1'
      }
    ]
  },
  {
    calculationRules: [
      {
        basis: '季度会计利润、纳税调整事项和以前年度亏损弥补',
        name: '季度预缴',
        result: '按申报准备确认后的应纳税所得额预缴'
      },
      {
        basis: '应纳税所得额、从业人数、资产总额和行业限制',
        name: '小型微利资格',
        result: '应纳税所得额不超过 300 万、从业人数不超过 300 人、资产总额不超过 5000 万且行业不受限时，按小型微利企业口径预估'
      },
      {
        basis: '季度预缴结果和年度最终申报结果',
        name: '年度汇算',
        result: '当前系统不处理年度汇算；后续作为独立流程扩展'
      }
    ],
    declarationCycle: '季度 / 年度',
    effectivePeriod: '按当期有效政策',
    group: '经营税费',
    id: 'tax-policy-cit',
    metrics: [
      { label: '预缴周期', value: '季度' },
      { label: '优惠资格', value: '待确认' },
      { label: '确认方式', value: '申报准备' }
    ],
    officialChannel: '湖北省电子税务局',
    parameters: [
      { label: '申报事项', value: '企业所得税预缴 / 年度汇算' },
      { label: '地区', value: '湖北省武汉市' },
      { label: '计算基础', value: '会计利润、纳税调整和可弥补亏损等事项' },
      { label: '普通口径', value: '不符合小型微利条件时按普通企业所得税口径预估' },
      { label: '优惠口径', value: '符合小型微利企业条件时按 5% 有效预缴率预估' },
      { label: '所得额条件', value: '年度应纳税所得额不超过 300 万元' },
      { label: '从业人数条件', value: '从业人数不超过 300 人' },
      { label: '资产条件', value: '资产总额不超过 5000 万元' },
      { label: '行业条件', value: '非国家限制和禁止行业' },
      { label: '当前范围', value: '季度预缴准备' },
      { label: '数据来源', value: '财务统计、薪酬社保、申报准备' },
      { label: '内部确认', value: '在申报准备确认利润、调整、亏损和优惠资格' },
      { label: '外部办理', value: '在税务办理完成申报、缴款和回执归档' }
    ],
    primaryStatement: '季度预缴 / 申报准备确认后进入税务办理',
    region: '湖北武汉',
    status: '随事项确认',
    taxpayerScope: '公司主体',
    title: '企业所得税',
    usedModules: ['申报准备', '税务办理', '财务统计', '薪酬社保'],
    versionRecords: [
      {
        changedAt: '2026-06-21',
        changeSummary: '企业所得税季度预缴拆分为申报准备内部确认和税务办理外部申报缴款，年度汇算后续单独扩展',
        id: 'tax-policy-cit-v1',
        version: 'V1'
      }
    ]
  },
  {
    calculationRules: [
      {
        basis: '增值税、消费税实际应缴税额',
        name: '附加税起算',
        result: '增值税为 0 时附加税通常为 0；存在应缴两税时进入附加税测算'
      },
      {
        basis: '纳税人身份和当期可享受减征政策',
        name: '减征判断',
        result: '小规模纳税人、小型微利企业等符合条件时按减征口径确认'
      },
      {
        basis: '电子税务局申报结果',
        name: '结果确认',
        result: '系统仅展示当前口径，最终金额以税务办理回填结果为准'
      }
    ],
    declarationCycle: '随增值税 / 消费税',
    effectivePeriod: '按当期有效政策',
    group: '经营税费',
    id: 'tax-policy-six-taxes-two-fees',
    metrics: [
      { label: '适用对象', value: '小规模/小微' },
      { label: '触发基础', value: '两税应缴额' },
      { label: '确认方式', value: '随事项确认' }
    ],
    officialChannel: '湖北省电子税务局',
    parameters: [
      { label: '适用地区', value: '湖北省武汉市' },
      { label: '适用对象', value: '小规模纳税人、小型微利企业等符合条件主体' },
      { label: '关联税费', value: '城建税、教育费附加、地方教育附加等' },
      { label: '触发条件', value: '存在实际应缴增值税或消费税' },
      { label: '减征口径', value: '符合条件时按当期减征政策确认' },
      { label: '结果回填', value: '以电子税务局申报结果为准' }
    ],
    primaryStatement: '符合条件时随增值税及附加事项确认减征口径',
    region: '湖北武汉',
    status: '随事项确认',
    taxpayerScope: '公司主体',
    title: '六税两费减征',
    usedModules: ['申报准备', '税务办理', '财务统计'],
    versionRecords: [
      {
        changedAt: '2026-06-21',
        changeSummary: '新增湖北武汉小规模及小微相关六税两费减征只读口径',
        id: 'tax-policy-six-taxes-two-fees-v1',
        version: 'V1'
      }
    ]
  },
  {
    calculationRules: [
      {
        basis: '合同、产权转移书据、营业账簿等应税凭证',
        name: '触发判断',
        result: '按事项进入申报准备'
      },
      {
        basis: '对应税目、计税金额和适用税率',
        name: '税额确认',
        result: '在申报准备中确认申报结果'
      }
    ],
    declarationCycle: '按次 / 按期',
    effectivePeriod: '按当期有效政策',
    group: '合同税费',
    id: 'tax-policy-stamp',
    metrics: [
      { label: '触发来源', value: '应税凭证' },
      { label: '处理方式', value: '事项确认' },
      { label: '申报入口', value: '电子税务局' }
    ],
    officialChannel: '湖北省电子税务局',
    parameters: [
      { label: '事项来源', value: '合同管理、财务统计、申报准备' },
      { label: '申报方式', value: '按税目、计税金额和事项确认' },
      { label: '结果确认', value: '以税务办理事项回填结果为准' }
    ],
    region: '湖北武汉',
    status: '随事项确认',
    taxpayerScope: '公司主体',
    title: '印花税',
    usedModules: ['申报准备', '税务办理', '合同管理', '财务统计'],
    versionRecords: [
      {
        changedAt: '2026-06-19',
        changeSummary: '建立合同与特定业务触发口径',
        id: 'tax-policy-stamp-v1',
        version: 'V1'
      }
    ]
  },
  {
    calculationRules: [
      {
        basis: '薪酬明细、专项扣除和专项附加扣除等信息已确认',
        name: '工资薪金个税',
        result: '按工资薪金累计预扣口径由薪酬明细推导'
      },
      {
        basis: '员工累计收入、累计减除费用和依法可扣除项目',
        name: '扣除口径',
        result: '计入当期累计应纳税所得额扣除'
      }
    ],
    declarationCycle: '月度',
    effectivePeriod: '按当期有效政策',
    group: '人员税费',
    id: 'tax-policy-iit',
    metrics: [
      { label: '扣缴周期', value: '月度' },
      { label: '数据来源', value: '薪酬明细' },
      { label: '计算方式', value: '累计预扣' }
    ],
    officialChannel: '自然人电子税务局',
    parameters: [
      { label: '来源模块', value: '薪酬明细' },
      { label: '前置条件', value: '考勤、社保公积金、薪酬结果、个税扣除信息已确认' },
      { label: '计算口径', value: '工资薪金累计预扣；年度综合所得汇算另行处理' },
      { label: '办理模块', value: '税务办理' }
    ],
    region: '中国大陆',
    status: '生效中',
    taxpayerScope: '申报个税员工',
    title: '个人所得税',
    usedModules: ['薪酬明细', '税务办理', '社保公积金'],
    versionRecords: [
      {
        changedAt: '2026-06-19',
        changeSummary: '明确工资薪金累计预扣口径，保留税务办理事项确认',
        id: 'tax-policy-iit-v1',
        version: 'V1'
      }
    ]
  }
];

export const taxPolicyOverview = {
  region: '湖北武汉',
  taxpayerType: '公司主体 / 扣缴义务人',
  declarationCycle: '月度 / 季度 / 年度 / 按次',
  status: '税务事项口径'
};
