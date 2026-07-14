export type PersonnelType = '全职' | '兼职';

export type FulltimeStatus = '试用期' | '在职' | '离职';

export type ParttimeStatus = '合作中' | '结束合作';

export type PeopleStatus = FulltimeStatus | ParttimeStatus;

export type PeopleArchiveStatus = '资料完整' | '待补充' | '已归档';

export type PeoplePaymentProfileMode = '工资发放' | '按任务付款';

export type PeopleSalaryProfileStatus = '已配置' | '待补充' | '已停用';
export type PeopleHousingFundStatus = '缴存' | '暂不缴存';

export type PeopleTaxIdentityProfile = {
  identityType: '居民个人' | '非居民个人';
  status: '待确认' | '已确认';
};

export type PeopleSalaryProfile = {
  status: PeopleSalaryProfileStatus;
  structure: string;
  probationSalary?: string;
  regularSalary?: string;
  taskRateRule?: string;
  payCycle: string;
  effectiveAt: string;
  note: string;
};

export type PeopleTaskRecord = {
  id: string;
  name: string;
  month: string;
  status: '待验收' | '已验收' | '返工中' | '逾期';
  acceptedAt?: string;
};

export type PeopleAuditRecord = {
  time: string;
  actor: string;
  action: string;
  result: '成功';
  note: string;
};

export type PeopleWorkEvaluationRecord = {
  month: string;
  acceptedTasks: number;
  reworkTasks: number;
  score: number;
  level: string;
};

export type PeopleArchiveFile = {
  id: string;
  name: string;
  category: '身份资料' | '合同协议' | '收款资料' | '入职资料' | '合作资料' | '其他';
  status: '已上传' | '待补充' | '已归档';
  updatedAt: string;
};

export type PeopleMember = {
  id: string;
  name: string;
  personnelType: PersonnelType;
  housingFundEffectiveMonth?: string;
  housingFundStatus?: PeopleHousingFundStatus;
  position: string;
  workCalendarId?: string;
  status: PeopleStatus;
  gender: '男' | '女';
  birthDate: string;
  nationality: string;
  graduationSchool: string;
  education: string;
  educationMajor: string;
  graduatedAt: string;
  city: string;
  source: string;
  archiveStatus: PeopleArchiveStatus;
  archiveUpdatedAt: string;
  mobile: string;
  email: string;
  wechat: string;
  idDocumentType: string;
  identityNo: string;
  taxIdentityProfile?: PeopleTaxIdentityProfile;
  idValidUntil: string;
  hukouAddress: string;
  address: string;
  emergencyContact: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  joinedAt: string;
  probationEndAt?: string;
  cooperationStartAt?: string;
  cooperationEndAt?: string;
  contractStatus: string;
  contractType: string;
  contractNo: string;
  contractStartAt: string;
  contractEndAt?: string;
  taskCapabilityIds: string[];
  taskAccessStatus: '可参与任务' | '暂停参与' | '已关闭';
  taskRecords: PeopleTaskRecord[];
  workEvaluationSummary: PeopleWorkEvaluationRecord;
  workEvaluationRecords: PeopleWorkEvaluationRecord[];
  archiveFiles: PeopleArchiveFile[];
  paymentProfile: {
    mode: PeoplePaymentProfileMode;
    payCycle: string;
    bankName: string;
    accountName: string;
    bankAccount: string;
  };
  salaryProfile: PeopleSalaryProfile;
  auditRecords: PeopleAuditRecord[];
};

export type PeopleFilters = {
  personnelType: '全部' | PersonnelType;
  status: '全部' | PeopleStatus;
};

export const fulltimeStatuses: FulltimeStatus[] = ['试用期', '在职', '离职'];

export const parttimeStatuses: ParttimeStatus[] = ['合作中', '结束合作'];

export function getStatusOptions(personnelType: PeopleFilters['personnelType']) {
  if (personnelType === '全职') {
    return ['全部', ...fulltimeStatuses];
  }

  if (personnelType === '兼职') {
    return ['全部', ...parttimeStatuses];
  }

  return ['全部', ...fulltimeStatuses, ...parttimeStatuses];
}

export function isStatusValidForType(status: PeopleFilters['status'], personnelType: PeopleFilters['personnelType']) {
  if (status === '全部' || personnelType === '全部') {
    return true;
  }

  if (personnelType === '全职') {
    return fulltimeStatuses.includes(status as FulltimeStatus);
  }

  return parttimeStatuses.includes(status as ParttimeStatus);
}
