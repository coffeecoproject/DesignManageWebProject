export type CustomerStatus = '合作中' | '待签约' | '已到期' | '无合同';
export type BrandStatus = '启用' | '暂停' | '停用';
export type StoreStatus = '筹备中' | '营业中' | '暂停' | '闭店';
export type CustomerContractStatus = '有效' | '已到期';
export type CustomerContractType = '年框合同' | '项目合同';
export type CustomerContractAmountMode = '固定金额' | '无固定金额';
export type CustomerContractReceiptMethod = '银行转账' | '现金' | '其他';
export type CustomerContractBusinessNature =
  | '设计及咨询服务'
  | '工程施工'
  | '采购或销售'
  | '租赁'
  | '技术服务'
  | '借款'
  | '产权转移'
  | '其他';
export type CustomerContractAmountTaxMode = '价税分列' | '含税未分列' | '不涉及增值税';
export type CustomerContractAgreementChangeType = '新增金额' | '减少金额' | '仅变更非金额条款';

export type CustomerContractStampDutyFacts = {
  agreementChangeAmount?: number;
  agreementChangeType?: CustomerContractAgreementChangeType;
  amountTaxMode: CustomerContractAmountTaxMode;
  businessNature: CustomerContractBusinessNature;
  parentContractId?: string;
  signedVersionNo: string;
  vatAmount?: number;
};

export type BrandTaskConfigRecord = {
  id: string;
  taskConfigId: string;
};

export type CustomerContractReceiptRecord = {
  id: string;
  amount: number;
  method: CustomerContractReceiptMethod;
  note: string;
  receivedAt: string;
  recorder: string;
};

export type CustomerContractFileRecord = {
  id: string;
  name: string;
  status: '已上传';
  type: '已签署合同' | '补充协议' | '合同附件';
  updatedAt: string;
};

export type CustomerContactRecord = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  wechat: string;
  primary?: boolean;
  note?: string;
};

export type CustomerRecord = {
  id: string;
  code: string;
  name: string;
  taxpayerIdentificationNo: string;
  industry: string;
  owner: string;
  contacts: CustomerContactRecord[];
  brandCount: number;
  storeCount: number;
  updatedAt: string;
  note: string;
};

export type CustomerContractRecord = {
  id: string;
  code: string;
  customerId: string;
  name: string;
  type: CustomerContractType;
  status: CustomerContractStatus;
  stampDutyFacts: CustomerContractStampDutyFacts;
  signedAt: string;
  expiresAt: string;
  files: CustomerContractFileRecord[];
  amountMode: CustomerContractAmountMode;
  amount: number | null;
  receivedAmount: number;
  latestReceiptAt: string;
  receiptNote: string;
  receiptRecords: CustomerContractReceiptRecord[];
  owner: string;
  updatedAt: string;
  note: string;
};

export type BrandRecord = {
  id: string;
  code: string;
  customerId: string;
  name: string;
  status: BrandStatus;
  owner: string;
  contactName: string;
  performanceRuleId: string;
  taskConfigs: BrandTaskConfigRecord[];
  storeCount: number;
  updatedAt: string;
  note: string;
};

export type StoreRecord = {
  id: string;
  code: string;
  customerId: string;
  brandId: string;
  name: string;
  province: string;
  city: string;
  status: StoreStatus;
  openedAt: string;
  updatedAt: string;
  address: string;
};

export const customerRecords: CustomerRecord[] = [
  {
    id: 'customer-starry',
    code: 'CUS-2026-001',
    name: '湖北星际装饰有限公司',
    taxpayerIdentificationNo: '91420100MA49STARRY1',
    industry: '连锁商业空间',
    owner: '李明',
    contacts: [
      {
        id: 'contact-starry-zhou',
        name: '周岚',
        role: '工程负责人',
        phone: '13800006601',
        email: 'zhoulan@starry.example',
        wechat: 'zhoulan-space',
        primary: true,
        note: '任务与验收对接'
      },
      {
        id: 'contact-starry-deng',
        name: '邓可',
        role: '品牌运营',
        phone: '13800006605',
        email: 'dengke@starry.example',
        wechat: 'dengke-brand',
        note: '品牌资料与门店计划对接'
      }
    ],
    brandCount: 2,
    storeCount: 8,
    updatedAt: '2026-06-12',
    note: '主服务客户，门店主数据维护稳定。'
  },
  {
    id: 'customer-nova',
    code: 'CUS-2026-002',
    name: '湖南新岚餐饮管理有限公司',
    taxpayerIdentificationNo: '91430100MA4PNOVA01',
    industry: '餐饮连锁',
    owner: '王芳',
    contacts: [
      {
        id: 'contact-nova-chen',
        name: '陈思',
        role: '品牌运营',
        phone: '13800006602',
        email: 'chensi@nova.example',
        wechat: 'chensi-nova',
        primary: true,
        note: '首店项目范围确认'
      }
    ],
    brandCount: 1,
    storeCount: 3,
    updatedAt: '2026-06-10',
    note: '先建立客户、品牌和门店档案。'
  },
  {
    id: 'customer-urban',
    code: 'CUS-2025-009',
    name: '武汉城设商业运营有限公司',
    taxpayerIdentificationNo: '91420106MA4URBAN09',
    industry: '商业运营',
    owner: '李明',
    contacts: [
      {
        id: 'contact-urban-liu',
        name: '刘晨',
        role: '招商主管',
        phone: '13800006603',
        email: 'liuchen@urban.example',
        wechat: 'liuchen-market',
        primary: true,
        note: '商业空间门店资料对接'
      },
      {
        id: 'contact-urban-he',
        name: '何敏',
        role: '财务对接',
        phone: '13800006606',
        email: 'hemin@urban.example',
        wechat: 'hemin-finance',
        note: '合同与收款资料对接'
      }
    ],
    brandCount: 1,
    storeCount: 2,
    updatedAt: '2026-05-28',
    note: '合同仍在有效期内，当前门店资料维护频率较低。'
  },
  {
    id: 'customer-old',
    code: 'CUS-2024-004',
    name: '长沙旧巷商业管理有限公司',
    taxpayerIdentificationNo: '91430103MA4OLD0004',
    industry: '零售空间',
    owner: '赵敏',
    contacts: [
      {
        id: 'contact-old-tang',
        name: '唐青',
        role: '项目经理',
        phone: '13800006604',
        email: 'tangqing@oldstreet.example',
        wechat: 'tangqing-retail',
        primary: true,
        note: '历史项目联系人'
      }
    ],
    brandCount: 1,
    storeCount: 1,
    updatedAt: '2026-04-30',
    note: '历史客户，仅保留查询。'
  }
];

export const customerContractRecords: CustomerContractRecord[] = [
  {
    id: 'contract-starry-framework',
    code: 'CON-2026-001',
    customerId: 'customer-starry',
    name: '星际空间年框合同',
    type: '年框合同',
    status: '有效',
    stampDutyFacts: {
      amountTaxMode: '价税分列',
      businessNature: '设计及咨询服务',
      signedVersionNo: 'V1.0',
      vatAmount: 0
    },
    signedAt: '2026-01-15',
    expiresAt: '2026-12-31',
    files: [
      {
        id: 'contract-starry-framework-file-001',
        name: '星际空间年框合同_已签署.pdf',
        status: '已上传',
        type: '已签署合同',
        updatedAt: '2026-01-15'
      },
      {
        id: 'contract-starry-framework-file-002',
        name: '星际轻装品牌补充协议_已签署.pdf',
        status: '已上传',
        type: '补充协议',
        updatedAt: '2026-06-12'
      }
    ],
    amountMode: '无固定金额',
    amount: null,
    receivedAmount: 86000,
    latestReceiptAt: '2026-06-06',
    receiptNote: '年框合同按实际门店项目收款。',
    receiptRecords: [
      {
        id: 'receipt-starry-001',
        amount: 56000,
        method: '银行转账',
        note: '星际空间门店施工图阶段收款',
        receivedAt: '2026-04-18',
        recorder: '李明'
      },
      {
        id: 'receipt-starry-002',
        amount: 30000,
        method: '银行转账',
        note: '星际轻装门店资料补充收款',
        receivedAt: '2026-06-06',
        recorder: '李明'
      }
    ],
    owner: '李明',
    updatedAt: '2026-06-12',
    note: '覆盖星际空间及星际轻装品牌的年度合作。'
  },
  {
    id: 'contract-starry-supplement-001',
    code: 'CON-2026-003',
    customerId: 'customer-starry',
    name: '星际空间施工范围补充协议',
    type: '项目合同',
    status: '有效',
    stampDutyFacts: {
      agreementChangeAmount: 15000,
      agreementChangeType: '新增金额',
      amountTaxMode: '价税分列',
      businessNature: '工程施工',
      parentContractId: 'contract-starry-framework',
      signedVersionNo: 'V1.1',
      vatAmount: 436.89
    },
    signedAt: '2026-06-12',
    expiresAt: '2026-12-31',
    files: [
      {
        id: 'contract-starry-supplement-file-001',
        name: '星际空间施工范围补充协议_已签署.pdf',
        status: '已上传',
        type: '补充协议',
        updatedAt: '2026-06-12'
      }
    ],
    amountMode: '固定金额',
    amount: 15000,
    receivedAmount: 0,
    latestReceiptAt: '-',
    receiptNote: '补充协议新增金额待后续收款。',
    receiptRecords: [],
    owner: '李明',
    updatedAt: '2026-06-12',
    note: '仅对补充协议新增金额形成独立税源。'
  },
  {
    id: 'contract-nova-start',
    code: 'CON-2026-002',
    customerId: 'customer-nova',
    name: '新岚茶集首店项目合同',
    type: '项目合同',
    status: '有效',
    stampDutyFacts: {
      amountTaxMode: '价税分列',
      businessNature: '工程施工',
      signedVersionNo: 'V1.0',
      vatAmount: 1689.32
    },
    signedAt: '2026-06-10',
    expiresAt: '2026-09-30',
    files: [
      {
        id: 'contract-nova-start-file-001',
        name: '新岚茶集首店项目合同_已签署.pdf',
        status: '已上传',
        type: '已签署合同',
        updatedAt: '2026-06-10'
      }
    ],
    amountMode: '固定金额',
    amount: 58000,
    receivedAmount: 20000,
    latestReceiptAt: '2026-06-12',
    receiptNote: '项目首款已收，尾款待验收后收取。',
    receiptRecords: [
      {
        id: 'receipt-nova-001',
        amount: 20000,
        method: '银行转账',
        note: '项目启动款',
        receivedAt: '2026-06-12',
        recorder: '王芳'
      }
    ],
    owner: '王芳',
    updatedAt: '2026-06-10',
    note: '客户已确认项目范围，签署合同已归档。'
  },
  {
    id: 'contract-urban-framework',
    code: 'CON-2025-009',
    customerId: 'customer-urban',
    name: '城设集市年度合作合同',
    type: '年框合同',
    status: '有效',
    stampDutyFacts: {
      amountTaxMode: '含税未分列',
      businessNature: '技术服务',
      signedVersionNo: 'V1.0'
    },
    signedAt: '2025-09-20',
    expiresAt: '2026-09-19',
    files: [
      {
        id: 'contract-urban-framework-file-001',
        name: '城设集市年度合作合同_已签署.pdf',
        status: '已上传',
        type: '已签署合同',
        updatedAt: '2025-09-20'
      }
    ],
    amountMode: '固定金额',
    amount: 120000,
    receivedAmount: 120000,
    latestReceiptAt: '2026-04-20',
    receiptNote: '年度合作款已收齐。',
    receiptRecords: [
      {
        id: 'receipt-urban-001',
        amount: 80000,
        method: '银行转账',
        note: '年度合作首款',
        receivedAt: '2025-10-15',
        recorder: '李明'
      },
      {
        id: 'receipt-urban-002',
        amount: 40000,
        method: '银行转账',
        note: '年度合作尾款',
        receivedAt: '2026-04-20',
        recorder: '李明'
      }
    ],
    owner: '李明',
    updatedAt: '2026-05-28',
    note: '合同仍在有效期内，保留合同档案与客户资料。'
  },
  {
    id: 'contract-old-history',
    code: 'CON-2024-004',
    customerId: 'customer-old',
    name: '旧巷零售历史合作协议',
    type: '项目合同',
    status: '已到期',
    stampDutyFacts: {
      amountTaxMode: '含税未分列',
      businessNature: '设计及咨询服务',
      signedVersionNo: 'V1.0'
    },
    signedAt: '2024-04-10',
    expiresAt: '2025-04-09',
    files: [
      {
        id: 'contract-old-history-file-001',
        name: '旧巷零售历史项目合同_已签署.pdf',
        status: '已上传',
        type: '已签署合同',
        updatedAt: '2024-04-10'
      }
    ],
    amountMode: '固定金额',
    amount: 46000,
    receivedAmount: 46000,
    latestReceiptAt: '2024-06-15',
    receiptNote: '历史项目已收款完成。',
    receiptRecords: [
      {
        id: 'receipt-old-001',
        amount: 46000,
        method: '银行转账',
        note: '项目结清',
        receivedAt: '2024-06-15',
        recorder: '赵敏'
      }
    ],
    owner: '赵敏',
    updatedAt: '2026-04-30',
    note: '历史合同，仅保留查看。'
  }
];

export const brandRecords: BrandRecord[] = [
  {
    id: 'brand-starry-space',
    code: 'BRD-2026-001',
    customerId: 'customer-starry',
    name: '星际空间',
    status: '启用',
    owner: '李明',
    contactName: '周岚',
    performanceRuleId: 'perf-rule-space-design-v2-draft',
    taskConfigs: [
      {
        id: 'brand-task-starry-space-full-drawing',
        taskConfigId: 'task-type-full-drawing'
      },
      {
        id: 'brand-task-starry-space-floor-plan',
        taskConfigId: 'task-type-floor-plan'
      },
      {
        id: 'brand-task-starry-space-store-image',
        taskConfigId: 'task-type-store-image'
      }
    ],
    storeCount: 5,
    updatedAt: '2026-06-12',
    note: '当前主要维护品牌。'
  },
  {
    id: 'brand-starry-light',
    code: 'BRD-2026-002',
    customerId: 'customer-starry',
    name: '星际轻装',
    status: '启用',
    owner: '王芳',
    contactName: '邓可',
    performanceRuleId: 'perf-rule-space-design-v2-draft',
    taskConfigs: [
      {
        id: 'brand-task-starry-light-floor-plan',
        taskConfigId: 'task-type-floor-plan'
      },
      {
        id: 'brand-task-starry-light-store-image',
        taskConfigId: 'task-type-store-image'
      }
    ],
    storeCount: 3,
    updatedAt: '2026-06-08',
    note: '小型门店品牌档案。'
  },
  {
    id: 'brand-nova-tea',
    code: 'BRD-2026-003',
    customerId: 'customer-nova',
    name: '新岚茶集',
    status: '暂停',
    owner: '王芳',
    contactName: '陈思',
    performanceRuleId: 'perf-rule-space-design-v2-draft',
    taskConfigs: [
      {
        id: 'brand-task-nova-tea-full-drawing',
        taskConfigId: 'task-type-full-drawing'
      },
      {
        id: 'brand-task-nova-tea-floor-plan',
        taskConfigId: 'task-type-floor-plan'
      }
    ],
    storeCount: 3,
    updatedAt: '2026-06-10',
    note: '等待客户确认首店模型。'
  },
  {
    id: 'brand-urban-hub',
    code: 'BRD-2025-009',
    customerId: 'customer-urban',
    name: '城设集市',
    status: '停用',
    owner: '李明',
    contactName: '刘晨',
    performanceRuleId: 'perf-rule-space-design-v2-draft',
    taskConfigs: [
      {
        id: 'brand-task-urban-hub-store-image',
        taskConfigId: 'task-type-store-image'
      }
    ],
    storeCount: 2,
    updatedAt: '2026-05-28',
    note: '低频维护品牌档案。'
  },
  {
    id: 'brand-old-lane',
    code: 'BRD-2024-004',
    customerId: 'customer-old',
    name: '旧巷零售',
    status: '停用',
    owner: '赵敏',
    contactName: '唐青',
    performanceRuleId: 'perf-rule-space-design-v2-draft',
    taskConfigs: [],
    storeCount: 1,
    updatedAt: '2026-04-30',
    note: '历史品牌，仅保留查询。'
  }
];

export const storeRecords: StoreRecord[] = [
  {
    id: 'store-wh-optics',
    code: 'STR-2026-001',
    customerId: 'customer-starry',
    brandId: 'brand-starry-space',
    name: '武汉光谷店',
    province: '湖北省',
    city: '武汉市',
    status: '营业中',
    openedAt: '2026-03-12',
    updatedAt: '2026-06-12',
    address: '湖北省武汉市东湖高新区'
  },
  {
    id: 'store-wh-hankou',
    code: 'STR-2026-002',
    customerId: 'customer-starry',
    brandId: 'brand-starry-space',
    name: '武汉汉口店',
    province: '湖北省',
    city: '武汉市',
    status: '筹备中',
    openedAt: '2026-07-01',
    updatedAt: '2026-06-09',
    address: '湖北省武汉市江汉区'
  },
  {
    id: 'store-cs-yuelu',
    code: 'STR-2026-003',
    customerId: 'customer-nova',
    brandId: 'brand-nova-tea',
    name: '长沙岳麓首店',
    province: '湖南省',
    city: '长沙市',
    status: '筹备中',
    openedAt: '2026-07-15',
    updatedAt: '2026-06-10',
    address: '湖南省长沙市岳麓区'
  },
  {
    id: 'store-wh-market',
    code: 'STR-2025-009',
    customerId: 'customer-urban',
    brandId: 'brand-urban-hub',
    name: '武汉中央集市',
    province: '湖北省',
    city: '武汉市',
    status: '暂停',
    openedAt: '2025-10-01',
    updatedAt: '2026-05-28',
    address: '湖北省武汉市武昌区'
  },
  {
    id: 'store-cs-old',
    code: 'STR-2024-004',
    customerId: 'customer-old',
    brandId: 'brand-old-lane',
    name: '长沙旧巷店',
    province: '湖南省',
    city: '长沙市',
    status: '闭店',
    openedAt: '2024-05-01',
    updatedAt: '2026-04-30',
    address: '湖南省长沙市天心区'
  }
];

export function getCustomerById(customerId: string) {
  return customerRecords.find((customer) => customer.id === customerId);
}

const STATUS_EVALUATION_DATE = '2026-06-13';

export function getCustomerContracts(customerId: string, contracts: CustomerContractRecord[] = customerContractRecords) {
  return contracts.filter((contract) => contract.customerId === customerId);
}

export function deriveCustomerStatus(
  customerId: string,
  contracts: CustomerContractRecord[] = customerContractRecords,
  evaluationDate = STATUS_EVALUATION_DATE
): CustomerStatus {
  const customerContracts = getCustomerContracts(customerId, contracts);

  if (
    customerContracts.some(
      (contract) =>
        contract.status === '有效' &&
        contract.signedAt !== '-' &&
        contract.signedAt <= evaluationDate &&
        contract.expiresAt >= evaluationDate
    )
  ) {
    return '合作中';
  }

  if (customerContracts.length > 0) {
    return '已到期';
  }

  return '无合同';
}

export function getPrimaryCustomerContact(customer: CustomerRecord) {
  return customer.contacts.find((contact) => contact.primary) ?? customer.contacts[0];
}

export function getBrandById(brandId: string | undefined) {
  if (!brandId) {
    return undefined;
  }

  return brandRecords.find((brand) => brand.id === brandId);
}
