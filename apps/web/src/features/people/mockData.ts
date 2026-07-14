import { defaultWorkCalendarId } from '../system/WorkCalendarState';
import type { PeopleMember } from './peopleTypes';

export const peopleMembers: PeopleMember[] = [
  {
    id: '20260001',
    name: '示例全职 A',
    personnelType: '全职',
    housingFundEffectiveMonth: '2026-04',
    housingFundStatus: '缴存',
    position: 'CEO',
    workCalendarId: defaultWorkCalendarId,
    status: '试用期',
    gender: '女',
    birthDate: '1994-03-18',
    nationality: '中国',
    graduationSchool: '武汉大学',
    education: '本科',
    educationMajor: '工商管理',
    graduatedAt: '2016-06-30',
    city: '武汉',
    source: '内部招聘',
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-06-02',
    mobile: '13800002101',
    email: 'person001@example.com',
    wechat: 'wx_person_2101',
    idDocumentType: '居民身份证',
    identityNo: '420111199403181024',
    idValidUntil: '2034-08-31',
    hukouAddress: '湖北省武汉市洪山区珞南街道示例路 18 号',
    address: '湖北省武汉市洪山区软件园示例小区 3 栋 1201',
    emergencyContact: '王敏',
    emergencyContactRelation: '家属',
    emergencyContactPhone: '13900008101',
    joinedAt: '2026-04-01',
    probationEndAt: '2026-06-30',
    contractStatus: '劳动合同有效',
    contractType: '劳动合同',
    contractNo: 'HT-FT-2026-0001',
    contractStartAt: '2026-04-01',
    contractEndAt: '2029-03-31',
    taskCapabilityIds: ['task-type-full-drawing', 'task-type-drawing-detail', 'task-type-floor-plan'],
    taskAccessStatus: '可参与任务',
    taskRecords: [
      {
        id: 'TASK-001',
        name: '施工图深化设计',
        month: '2026-06',
        status: '待验收',
      },
      {
        id: 'TASK-002',
        name: '节点图补充',
        month: '2026-05',
        status: '已验收',
        acceptedAt: '2026-05-28',
      }
    ],
    workEvaluationSummary: {
      month: '2026-06',
      acceptedTasks: 3,
      reworkTasks: 1,
      score: 86,
      level: 'B+'
    },
    workEvaluationRecords: [
      { month: '2026-06', acceptedTasks: 3, reworkTasks: 1, score: 86, level: 'B+' },
      { month: '2026-05', acceptedTasks: 4, reworkTasks: 0, score: 91, level: 'A-' }
    ],
    archiveFiles: [
      { id: 'FILE-20260001-001', name: '身份证人像面照片', category: '身份资料', status: '已上传', updatedAt: '2026-04-01' },
      { id: 'FILE-20260001-002', name: '身份证国徽面照片', category: '身份资料', status: '已上传', updatedAt: '2026-04-01' },
      { id: 'FILE-20260001-003', name: '劳动合同', category: '合同协议', status: '已上传', updatedAt: '2026-04-01' },
      { id: 'FILE-20260001-004', name: '银行卡确认单', category: '收款资料', status: '已上传', updatedAt: '2026-06-02' }
    ],
    paymentProfile: {
      mode: '工资发放',
      payCycle: '月度',
      bankName: '招商银行',
      accountName: '示例全职 A',
      bankAccount: '6225880000002101',
    },
    salaryProfile: {
      status: '已配置',
      structure: '试用期工资 + 转正工资',
      probationSalary: '8000 元/月',
      regularSalary: '10000 元/月',
      payCycle: '月度',
      effectiveAt: '2026-04-01',
      note: '三个月试用期，转正后按正式薪资约定执行'
    },
    auditRecords: [
      { time: '2026-06-09 15:20', actor: '李明', action: '查看人员档案', result: '成功', note: '查看档案' },
      { time: '2026-06-02 10:12', actor: '周倩', action: '更新试用期信息', result: '成功', note: '调整试用期截止日期' }
    ]
  },
  {
    id: '20250018',
    name: '示例全职 B',
    personnelType: '全职',
    housingFundEffectiveMonth: '2025-11',
    housingFundStatus: '缴存',
    position: '主案设计师',
    workCalendarId: defaultWorkCalendarId,
    status: '在职',
    gender: '男',
    birthDate: '1991-08-06',
    nationality: '中国',
    graduationSchool: '中南财经政法大学',
    education: '本科',
    educationMajor: '财务管理',
    graduatedAt: '2014-06-30',
    city: '武汉',
    source: '社会招聘',
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-05-28',
    mobile: '13800002102',
    email: 'person018@example.com',
    wechat: 'wx_person_2102',
    idDocumentType: '居民身份证',
    identityNo: '420102199108062048',
    idValidUntil: '2031-11-30',
    hukouAddress: '湖北省武汉市江岸区后湖街道示例路 36 号',
    address: '湖北省武汉市江岸区建设大道示例公寓 8 栋 901',
    emergencyContact: '李娜',
    emergencyContactRelation: '配偶',
    emergencyContactPhone: '13900008102',
    joinedAt: '2025-11-15',
    contractStatus: '正式合同',
    contractType: '劳动合同',
    contractNo: 'HT-FT-2025-0018',
    contractStartAt: '2025-11-15',
    contractEndAt: '2028-11-14',
    taskCapabilityIds: ['task-type-floor-plan'],
    taskAccessStatus: '可参与任务',
    taskRecords: [
      {
        id: 'TASK-003',
        name: '方案审核',
        month: '2026-06',
        status: '已验收',
        acceptedAt: '2026-06-08',
      },
      {
        id: 'TASK-004',
        name: '效果图复核',
        month: '2026-06',
        status: '已验收',
        acceptedAt: '2026-06-06',
      }
    ],
    workEvaluationSummary: {
      month: '2026-06',
      acceptedTasks: 6,
      reworkTasks: 0,
      score: 58,
      level: 'D'
    },
    workEvaluationRecords: [
      { month: '2026-06', acceptedTasks: 6, reworkTasks: 0, score: 58, level: 'D' },
      { month: '2026-05', acceptedTasks: 5, reworkTasks: 1, score: 89, level: 'B+' }
    ],
    archiveFiles: [
      { id: 'FILE-20250018-001', name: '身份证人像面照片', category: '身份资料', status: '已上传', updatedAt: '2025-11-15' },
      { id: 'FILE-20250018-002', name: '身份证国徽面照片', category: '身份资料', status: '已上传', updatedAt: '2025-11-15' },
      { id: 'FILE-20250018-003', name: '正式劳动合同', category: '合同协议', status: '已上传', updatedAt: '2025-11-15' },
      { id: 'FILE-20250018-004', name: '入职资料包', category: '入职资料', status: '已上传', updatedAt: '2025-11-16' },
      { id: 'FILE-20250018-005', name: '银行卡确认单', category: '收款资料', status: '已上传', updatedAt: '2026-05-28' }
    ],
    paymentProfile: {
      mode: '工资发放',
      payCycle: '月度',
      bankName: '建设银行',
      accountName: '示例全职 B',
      bankAccount: '6217000000002102',
    },
    salaryProfile: {
      status: '已配置',
      structure: '正式工资',
      regularSalary: '12000 元/月',
      payCycle: '月度',
      effectiveAt: '2025-11-15',
      note: '正式合同薪资约定'
    },
    auditRecords: [
      { time: '2026-06-08 17:30', actor: '周倩', action: '查看工作评价', result: '成功', note: '查看工作评价摘要' },
      { time: '2026-05-28 09:16', actor: '周倩', action: '更新联系方式', result: '成功', note: '替换备用联系方式' }
    ]
  },
  {
    id: '20240009',
    name: '示例全职 C',
    personnelType: '全职',
    housingFundStatus: '暂不缴存',
    position: '行政专员',
    workCalendarId: defaultWorkCalendarId,
    status: '离职',
    gender: '男',
    birthDate: '1989-12-12',
    nationality: '中国',
    graduationSchool: '武汉职业技术学院',
    education: '大专',
    educationMajor: '行政管理',
    graduatedAt: '2011-06-30',
    city: '武汉',
    source: '内部转入',
    archiveStatus: '已归档',
    archiveUpdatedAt: '2026-05-01',
    mobile: '13800002103',
    email: 'person009@example.com',
    wechat: 'wx_person_2103',
    idDocumentType: '居民身份证',
    identityNo: '420106198912123096',
    idValidUntil: '2030-04-30',
    hukouAddress: '湖北省武汉市武昌区水果湖街道示例路 9 号',
    address: '湖北省武汉市武昌区中北路示例小区 2 栋 606',
    emergencyContact: '赵强',
    emergencyContactRelation: '家属',
    emergencyContactPhone: '13900008103',
    joinedAt: '2024-08-01',
    contractStatus: '已离职',
    contractType: '劳动合同',
    contractNo: 'HT-FT-2024-0009',
    contractStartAt: '2024-08-01',
    contractEndAt: '2026-05-01',
    taskCapabilityIds: [],
    taskAccessStatus: '已关闭',
    taskRecords: [
      {
        id: 'TASK-005',
        name: '项目排期管理',
        month: '2026-04',
        status: '已验收',
        acceptedAt: '2026-04-22',
      },
      {
        id: 'TASK-006',
        name: '返工协调',
        month: '2026-04',
        status: '返工中',
      }
    ],
    workEvaluationSummary: {
      month: '2026-04',
      acceptedTasks: 4,
      reworkTasks: 2,
      score: 72,
      level: 'C'
    },
    workEvaluationRecords: [
      { month: '2026-04', acceptedTasks: 4, reworkTasks: 2, score: 72, level: 'C' },
      { month: '2026-03', acceptedTasks: 5, reworkTasks: 1, score: 84, level: 'B' }
    ],
    archiveFiles: [
      { id: 'FILE-20240009-001', name: '身份证人像面照片', category: '身份资料', status: '已归档', updatedAt: '2024-08-01' },
      { id: 'FILE-20240009-002', name: '身份证国徽面照片', category: '身份资料', status: '已归档', updatedAt: '2024-08-01' },
      { id: 'FILE-20240009-003', name: '劳动合同', category: '合同协议', status: '已归档', updatedAt: '2024-08-01' },
      { id: 'FILE-20240009-004', name: '离职确认单', category: '其他', status: '已归档', updatedAt: '2026-05-01' }
    ],
    paymentProfile: {
      mode: '工资发放',
      payCycle: '月度',
      bankName: '工商银行',
      accountName: '示例全职 C',
      bankAccount: '6222000000002103',
    },
    salaryProfile: {
      status: '已停用',
      structure: '历史月薪制',
      regularSalary: '11000 元/月',
      payCycle: '月度',
      effectiveAt: '2024-08-01',
      note: '离职后薪资约定停用，仅保留历史记录'
    },
    auditRecords: [
      { time: '2026-05-01 18:20', actor: '周倩', action: '标记离职', result: '成功', note: '关闭任务参与状态' },
      { time: '2026-04-29 11:05', actor: '李明', action: '查看人员档案', result: '成功', note: '离职前档案复核' }
    ]
  },
  {
    id: '20260006',
    name: '示例兼职 B',
    personnelType: '兼职',
    position: '空间设计师',
    status: '合作中',
    gender: '女',
    birthDate: '1996-05-19',
    nationality: '中国',
    graduationSchool: '湖南大学',
    education: '本科',
    educationMajor: '环境设计',
    graduatedAt: '2018-06-30',
    city: '长沙',
    source: '合作推荐',
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-05-30',
    mobile: '13900003201',
    email: 'person006@example.com',
    wechat: 'wx_person_3201',
    idDocumentType: '居民身份证',
    identityNo: '430104199605191128',
    taxIdentityProfile: {
      identityType: '居民个人',
      status: '已确认'
    },
    idValidUntil: '2036-02-28',
    hukouAddress: '湖南省长沙市岳麓区银盆岭街道示例路 22 号',
    address: '湖南省长沙市岳麓区麓谷示例公寓 5 栋 1502',
    emergencyContact: '周琳',
    emergencyContactRelation: '家属',
    emergencyContactPhone: '13800007201',
    joinedAt: '2026-03-10',
    cooperationStartAt: '2026-03-10',
    cooperationEndAt: '2026-12-31',
    contractStatus: '合作协议有效',
    contractType: '合作协议',
    contractNo: 'HZ-PT-2026-0006',
    contractStartAt: '2026-03-10',
    contractEndAt: '2026-12-31',
    taskCapabilityIds: ['task-type-rendering', 'task-type-store-image'],
    taskAccessStatus: '可参与任务',
    taskRecords: [
      {
        id: 'TASK-007',
        name: '效果图表现',
        month: '2026-06',
        status: '已验收',
        acceptedAt: '2026-06-03',
      },
      {
        id: 'TASK-008',
        name: '门店立面调整',
        month: '2026-06',
        status: '待验收',
      }
    ],
    workEvaluationSummary: {
      month: '2026-06',
      acceptedTasks: 2,
      reworkTasks: 0,
      score: 90,
      level: 'A-'
    },
    workEvaluationRecords: [
      { month: '2026-06', acceptedTasks: 2, reworkTasks: 0, score: 90, level: 'A-' },
      { month: '2026-05', acceptedTasks: 3, reworkTasks: 1, score: 86, level: 'B+' }
    ],
    archiveFiles: [
      { id: 'FILE-20260006-001', name: '身份证人像面照片', category: '身份资料', status: '已上传', updatedAt: '2026-03-10' },
      { id: 'FILE-20260006-002', name: '身份证国徽面照片', category: '身份资料', status: '已上传', updatedAt: '2026-03-10' },
      { id: 'FILE-20260006-003', name: '合作协议', category: '合作资料', status: '已上传', updatedAt: '2026-03-10' },
      { id: 'FILE-20260006-004', name: '收款资料确认单', category: '收款资料', status: '待补充', updatedAt: '2026-05-30' }
    ],
    paymentProfile: {
      mode: '按任务付款',
      payCycle: '验收后付款',
      bankName: '中国银行',
      accountName: '示例兼职 B',
      bankAccount: '6216000000003201',
    },
    salaryProfile: {
      status: '已配置',
      structure: '按任务规则',
      taskRateRule: '按任务类型与验收结果执行',
      payCycle: '验收后付款',
      effectiveAt: '2026-03-10',
      note: '兼职合作按任务规则记录，具体核算不在人员档案处理'
    },
    auditRecords: [
      { time: '2026-06-06 14:45', actor: '周倩', action: '查看收款资料', result: '成功', note: '查看收款资料' },
      { time: '2026-05-30 16:18', actor: '周倩', action: '更新合作期限', result: '成功', note: '延长合作协议' }
    ]
  },
  {
    id: '20250011',
    name: '示例兼职 C',
    personnelType: '兼职',
    position: '主案设计师',
    status: '结束合作',
    gender: '男',
    birthDate: '1990-10-23',
    nationality: '中国',
    graduationSchool: '中南大学',
    education: '本科',
    educationMajor: '建筑设计',
    graduatedAt: '2013-06-30',
    city: '长沙',
    source: '历史合作',
    archiveStatus: '已归档',
    archiveUpdatedAt: '2026-06-01',
    mobile: '13900003202',
    email: 'person011@example.com',
    wechat: 'wx_person_3202',
    idDocumentType: '居民身份证',
    identityNo: '430102199010232160',
    idValidUntil: '2032-05-31',
    hukouAddress: '湖南省长沙市芙蓉区定王台街道示例路 11 号',
    address: '湖南省长沙市芙蓉区五一大道示例公寓 7 栋 803',
    emergencyContact: '陈杰',
    emergencyContactRelation: '家属',
    emergencyContactPhone: '13800007202',
    joinedAt: '2025-09-01',
    cooperationStartAt: '2025-09-01',
    cooperationEndAt: '2026-05-31',
    contractStatus: '合作已结束',
    contractType: '合作协议',
    contractNo: 'HZ-PT-2025-0011',
    contractStartAt: '2025-09-01',
    contractEndAt: '2026-05-31',
    taskCapabilityIds: [],
    taskAccessStatus: '已关闭',
    taskRecords: [
      {
        id: 'TASK-009',
        name: '材料清单审核',
        month: '2026-05',
        status: '已验收',
        acceptedAt: '2026-05-18',
      },
      {
        id: 'TASK-010',
        name: '报价复核',
        month: '2026-05',
        status: '已验收',
        acceptedAt: '2026-05-21',
      }
    ],
    workEvaluationSummary: {
      month: '2026-05',
      acceptedTasks: 2,
      reworkTasks: 0,
      score: 88,
      level: 'B+'
    },
    workEvaluationRecords: [
      { month: '2026-05', acceptedTasks: 2, reworkTasks: 0, score: 88, level: 'B+' },
      { month: '2026-04', acceptedTasks: 3, reworkTasks: 0, score: 90, level: 'A-' }
    ],
    archiveFiles: [
      { id: 'FILE-20250011-001', name: '身份证人像面照片', category: '身份资料', status: '已归档', updatedAt: '2025-09-01' },
      { id: 'FILE-20250011-002', name: '身份证国徽面照片', category: '身份资料', status: '已归档', updatedAt: '2025-09-01' },
      { id: 'FILE-20250011-003', name: '合作协议', category: '合作资料', status: '已归档', updatedAt: '2025-09-01' },
      { id: 'FILE-20250011-004', name: '合作结束确认单', category: '其他', status: '已归档', updatedAt: '2026-06-01' }
    ],
    paymentProfile: {
      mode: '按任务付款',
      payCycle: '验收后付款',
      bankName: '农业银行',
      accountName: '示例兼职 C',
      bankAccount: '6228000000003202',
    },
    salaryProfile: {
      status: '已停用',
      structure: '历史任务规则',
      taskRateRule: '历史合作任务规则',
      payCycle: '验收后付款',
      effectiveAt: '2025-09-01',
      note: '合作结束后停用，仅保留历史规则'
    },
    auditRecords: [
      { time: '2026-06-01 10:00', actor: '周倩', action: '结束合作', result: '成功', note: '关闭任务参与状态' },
      { time: '2026-05-25 13:22', actor: '周倩', action: '查看收款资料', result: '成功', note: '合作结束前资料复核' }
    ]
  }
];
