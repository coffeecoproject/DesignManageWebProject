import {
  AuditOutlined,
  BankOutlined,
  ContactsOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  IdcardOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { DatePicker, Input, Select, Table, message } from 'antd';
import type { TableColumnsType } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import { AuditTrailSection } from '../../components/AuditTrailSection';
import type { AuditTrailRecord } from '../../components/AuditTrailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { FileActionButtons } from '../../components/FileActionButtons';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import { FileSlot, FileSlotGrid } from '../../components/FileSlot';
import { FileUploadDropzone } from '../../components/FileUploadDropzone';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { RegionSearchSelect, defaultRegionPath, getRegionCity, getRegionPathByCity } from '../../components/RegionSearchSelect';
import { TagChip } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import { useTaskConfigState, type TaskConfigRow } from '../system/TaskConfigState';
import { defaultWorkCalendarId, useWorkCalendarState, type WorkCalendarRow } from '../system/WorkCalendarState';
import { getArchiveRequiredFileSlots, type ArchiveRequiredFileSlot } from './peopleFileSlotModel';
import { usePeopleOrganizationState } from './PeopleOrganizationState';
import {
  getArchiveWorkCalendarId,
  getPeopleArchiveEndDateInfo,
  getPeopleArchiveListStatus,
  getPeopleArchiveStartDateInfo,
  getPeopleBaseSalaryText,
  getPeopleEmployeeCategoryText,
  getPeopleHousingFundStatus,
  getPeoplePendingArchiveFiles,
  getPeopleSalaryModeText,
  getPeopleTaskAccessStatusFromArchive,
  getWorkCalendarDisplayName,
  getWorkCalendarOptions,
  inferCreatePeopleStatus,
  inferPeopleSalaryMode,
  normalizePeopleText,
  normalizeTaskCapabilityIds,
  type PeopleArchiveListStatus,
  type PeopleSalaryMode
} from './peopleDomain';
import type { PeopleArchiveFile, PeopleHousingFundStatus, PeopleMember } from './peopleTypes';

type ArchiveFileStatusFilter = '全部' | PeopleArchiveFile['status'];
type ArchiveListStatus = PeopleArchiveListStatus;

type ArchiveSearchFilters = {
  archiveStatus: '全部' | ArchiveListStatus;
  fileStatus: ArchiveFileStatusFilter;
  keyword: string;
};

type ArchiveDrawerMode = 'create' | 'detail' | 'edit';
type ArchiveSalaryMode = PeopleSalaryMode;

type ArchiveMaintenanceSnapshot = {
  accountName: string;
  address: string;
  archiveFiles: Array<Pick<PeopleArchiveFile, 'category' | 'id' | 'name' | 'status'>>;
  bankAccount: string;
  bankName: string;
  baseSalary: string;
  birthDate: string;
  city: string;
  contractEndAt: string;
  contractType: string;
  education: string;
  educationMajor: string;
  email: string;
  emergencyContact: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  gender: PeopleMember['gender'];
  graduatedAt: string;
  graduationSchool: string;
  housingFundEffectiveMonth: string;
  housingFundStatus: PeopleHousingFundStatus;
  hukouAddress: string;
  idDocumentType: string;
  idValidUntil: string;
  identityNo: string;
  mobile: string;
  name: string;
  nationality: string;
  personnelType: PeopleMember['personnelType'];
  position: string;
  salaryMode: ArchiveSalaryMode;
  source: string;
  startAt: string;
  taskCapabilityIds: string[];
  wechat: string;
  workCalendarId: string;
};

const defaultArchiveFilters: ArchiveSearchFilters = {
  archiveStatus: '全部',
  fileStatus: '全部',
  keyword: ''
};

const prototypeToday = '2026-06-11';

const archiveEducationOptions = ['本科', '大专', '硕士', '高中'];
const archiveSourceOptions = ['内部招聘', '社会招聘', '合作推荐', '内部转入', '新增建档'];
const archiveDocumentTypeOptions = ['居民身份证', '护照', '港澳台通行证'];
const archiveGenderOptions: PeopleMember['gender'][] = ['女', '男'];
const archiveHousingFundStatusOptions: PeopleHousingFundStatus[] = ['缴存', '暂不缴存'];
const statusTone = {
  试用期: 'amber',
  在职: 'green',
  离职: 'gray',
  合作中: 'blue',
  结束合作: 'gray'
} as const;

const archiveStatusTone = {
  资料完整: 'green',
  待补充: 'amber',
  已归档: 'gray'
} as const;

const archiveListStatusTone = {
  已齐全: 'green',
  待补充: 'amber'
} as const;

const archiveFileStatusTone = {
  已上传: 'green',
  待补充: 'amber',
  已归档: 'gray'
} as const;

const housingFundStatusTone = {
  缴存: 'green',
  暂不缴存: 'gray',
  不适用: 'gray'
} as const;

function normalizeArchiveText(value?: string) {
  return normalizePeopleText(value);
}

function getTaskCapabilityRows(taskCapabilityIds: string[], taskConfigRows: TaskConfigRow[]) {
  const capabilityIdSet = new Set(taskCapabilityIds);

  return taskConfigRows
    .filter((row) => capabilityIdSet.has(row.id))
    .sort((left, right) => taskCapabilityIds.indexOf(left.id) - taskCapabilityIds.indexOf(right.id));
}

function getArchiveFileSnapshot(files: PeopleArchiveFile[]): ArchiveMaintenanceSnapshot['archiveFiles'] {
  return files
    .map((file) => ({
      category: file.category,
      id: file.id,
      name: file.name,
      status: file.status
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function getArchiveRequiredMissingLabels(snapshot: ArchiveMaintenanceSnapshot) {
  const requiredFields: Array<[string, string]> = [
    ['姓名', snapshot.name],
    ['员工类别', snapshot.personnelType],
    ['岗位', snapshot.position],
    ['性别', snapshot.gender],
    ['出生日期', snapshot.birthDate],
    ['国籍', snapshot.nationality],
    ['所在城市', snapshot.city],
    ['人员来源', snapshot.source],
    ['手机号', snapshot.mobile],
    ['证件类型', snapshot.idDocumentType],
    ['证件号码', snapshot.identityNo],
    ['居住地址', snapshot.address],
    ['紧急联系电话', snapshot.emergencyContactPhone],
    [snapshot.personnelType === '兼职' ? '合作起始日期' : '入职日期', snapshot.startAt],
    ['计薪方式', snapshot.salaryMode],
    [snapshot.salaryMode === '任务制' ? '任务规则' : '基础薪资', snapshot.baseSalary],
    ...(snapshot.personnelType === '全职'
      ? ([['公积金缴存', snapshot.housingFundStatus]] as Array<[string, string]>)
      : []),
    ...(snapshot.personnelType === '全职' && snapshot.housingFundStatus === '缴存'
      ? ([['公积金生效月份', snapshot.housingFundEffectiveMonth]] as Array<[string, string]>)
      : []),
    ['开户行', snapshot.bankName],
    ['账户名', snapshot.accountName],
    ['银行卡号', snapshot.bankAccount],
    ['合同/协议类型', snapshot.contractType]
  ];

  return requiredFields.filter(([, value]) => !normalizeArchiveText(value)).map(([label]) => label);
}

function getUploadFileSize(file: UploadFile) {
  return file.size ?? file.originFileObj?.size ?? 0;
}

function isArchiveFileMatchedToSlot(file: Pick<PeopleArchiveFile, 'name'>, slot: ArchiveRequiredFileSlot) {
  if (slot.key === 'id-portrait') {
    return file.name.includes('身份证人像面') || file.name.includes('身份证正面');
  }

  if (slot.key === 'id-emblem') {
    return file.name.includes('身份证国徽面') || file.name.includes('身份证反面');
  }

  return slot.label === '合作协议' ? file.name.includes('合作协议') : file.name.includes('劳动合同');
}

function getArchiveSlotFile<T extends Pick<PeopleArchiveFile, 'name' | 'status'>>(files: T[], slot: ArchiveRequiredFileSlot) {
  return files.find((file) => isArchiveFileMatchedToSlot(file, slot));
}

function isRequiredArchiveFile(file: Pick<PeopleArchiveFile, 'name' | 'status'>, personnelType: PeopleMember['personnelType']) {
  return getArchiveRequiredFileSlots(personnelType).some((slot) => isArchiveFileMatchedToSlot(file, slot));
}

function getMissingRequiredArchiveFileLabels(snapshot: ArchiveMaintenanceSnapshot) {
  return getArchiveRequiredFileSlots(snapshot.personnelType)
    .filter((slot) => {
      const file = getArchiveSlotFile(snapshot.archiveFiles, slot);
      return !file || file.status === '待补充';
    })
    .map((slot) => slot.label);
}

function serializeArchiveSnapshot(snapshot: ArchiveMaintenanceSnapshot) {
  return JSON.stringify(snapshot);
}

function getArchiveStatusFromSnapshot(
  snapshot: ArchiveMaintenanceSnapshot,
  currentStatus: PeopleMember['archiveStatus'] = '待补充'
): PeopleMember['archiveStatus'] {
  if (currentStatus === '已归档') {
    return '已归档';
  }

  const hasRequiredGap = getArchiveRequiredMissingLabels(snapshot).length > 0;
  const hasRequiredFileGap = getMissingRequiredArchiveFileLabels(snapshot).length > 0;
  const hasPendingFile = snapshot.archiveFiles.some((file) => file.status === '待补充');

  return hasRequiredGap || hasRequiredFileGap || hasPendingFile ? '待补充' : '资料完整';
}

function getMemberArchiveMaintenanceSnapshot(member: PeopleMember): ArchiveMaintenanceSnapshot {
  const salaryMode = getPeopleSalaryModeText(member);

  return {
    accountName: normalizeArchiveText(member.paymentProfile.accountName),
    address: normalizeArchiveText(member.address),
    archiveFiles: getArchiveFileSnapshot(member.archiveFiles),
    bankAccount: normalizeArchiveText(member.paymentProfile.bankAccount),
    bankName: normalizeArchiveText(member.paymentProfile.bankName),
    baseSalary: normalizeArchiveText(member.salaryProfile.regularSalary ?? member.salaryProfile.probationSalary ?? member.salaryProfile.taskRateRule ?? ''),
    birthDate: normalizeArchiveText(member.birthDate),
    city: normalizeArchiveText(member.city),
    contractEndAt: normalizeArchiveText(member.personnelType === '兼职' ? member.cooperationEndAt ?? '' : member.contractEndAt ?? ''),
    contractType: normalizeArchiveText(member.contractType),
    education: normalizeArchiveText(member.education),
    educationMajor: normalizeArchiveText(member.educationMajor),
    email: normalizeArchiveText(member.email),
    emergencyContact: normalizeArchiveText(member.emergencyContact),
    emergencyContactPhone: normalizeArchiveText(member.emergencyContactPhone),
    emergencyContactRelation: normalizeArchiveText(member.emergencyContactRelation),
    gender: member.gender,
    graduatedAt: normalizeArchiveText(member.graduatedAt),
    graduationSchool: normalizeArchiveText(member.graduationSchool),
    housingFundEffectiveMonth: normalizeArchiveText(member.personnelType === '全职' ? member.housingFundEffectiveMonth ?? '' : ''),
    housingFundStatus: member.personnelType === '全职' ? member.housingFundStatus ?? '暂不缴存' : '暂不缴存',
    hukouAddress: normalizeArchiveText(member.hukouAddress),
    idDocumentType: normalizeArchiveText(member.idDocumentType),
    idValidUntil: normalizeArchiveText(member.idValidUntil),
    identityNo: normalizeArchiveText(member.identityNo),
    mobile: normalizeArchiveText(member.mobile),
    name: normalizeArchiveText(member.name === '新人员' ? '' : member.name),
    nationality: normalizeArchiveText(member.nationality || '中国'),
    personnelType: member.personnelType,
    position: normalizeArchiveText(member.position),
    salaryMode,
    source: normalizeArchiveText(member.source),
    startAt: normalizeArchiveText(member.personnelType === '兼职' ? member.cooperationStartAt ?? member.joinedAt : member.joinedAt),
    taskCapabilityIds: normalizeTaskCapabilityIds(member.taskCapabilityIds),
    wechat: normalizeArchiveText(member.wechat),
    workCalendarId: getArchiveWorkCalendarId(member.personnelType, member.workCalendarId)
  };
}

function getNextPeopleSequence(rows: PeopleMember[]) {
  return (
    rows.reduce((maxSequence, row) => {
      const matched = row.id.match(/^2026(\d{4})$/);

      if (!matched) {
        return maxSequence;
      }

      const sequence = Number.parseInt(matched[1], 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

function createDraftArchiveMember(rows: PeopleMember[]): PeopleMember {
  const sequence = getNextPeopleSequence(rows);
  const paddedSequence = String(sequence).padStart(4, '0');
  const memberId = `2026${paddedSequence}`;

  return {
    address: '',
    archiveFiles: [],
    archiveStatus: '待补充',
    archiveUpdatedAt: prototypeToday,
    auditRecords: [
      { time: '2026-06-11 00:00', actor: '李明', action: '创建人员档案', result: '成功', note: '新增人员待完善档案' }
    ],
    birthDate: '',
    city: '武汉',
    contractEndAt: '2029-06-10',
    contractNo: `HT-2026-${paddedSequence}`,
    contractStartAt: prototypeToday,
    contractStatus: '劳动合同待维护',
    contractType: '劳动合同',
    education: '本科',
    educationMajor: '',
    email: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    gender: '女',
    graduatedAt: '',
    graduationSchool: '',
    hukouAddress: '',
    id: memberId,
    idDocumentType: '居民身份证',
    idValidUntil: '',
    identityNo: '',
    joinedAt: prototypeToday,
    mobile: '',
    name: '新人员',
    nationality: '中国',
    housingFundStatus: '暂不缴存',
    paymentProfile: {
      accountName: '',
      bankAccount: '',
      bankName: '',
      mode: '工资发放',
      payCycle: '月度'
    },
    personnelType: '全职',
    position: '空间设计师',
    probationEndAt: '2026-09-11',
    salaryProfile: {
      effectiveAt: prototypeToday,
      note: '新增人员待维护薪资约定',
      payCycle: '月度',
      regularSalary: '',
      status: '待补充',
      structure: '月薪制'
    },
    source: '新增建档',
    status: '试用期',
    taskCapabilityIds: [],
    taskAccessStatus: '暂停参与',
    taskRecords: [],
    wechat: '',
    workCalendarId: defaultWorkCalendarId
  };
}

function getCityPath(city: string) {
  return getRegionPathByCity(city, defaultRegionPath);
}

function normalizeDateString(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

function inferArchiveFileCategory(fileName: string, personnelType: PeopleMember['personnelType']): PeopleArchiveFile['category'] {
  if (fileName.includes('身份证') || fileName.includes('身份')) {
    return '身份资料';
  }

  if (fileName.includes('合同') || fileName.includes('协议')) {
    return personnelType === '兼职' ? '合作资料' : '合同协议';
  }

  if (fileName.includes('银行卡') || fileName.includes('收款')) {
    return '收款资料';
  }

  return personnelType === '兼职' ? '合作资料' : '入职资料';
}

function getGeneratedContractNo(memberId: string, personnelType: PeopleMember['personnelType']) {
  return `${personnelType === '兼职' ? 'HZ' : 'HT'}-${memberId.slice(0, 4)}-${memberId.slice(-4)}`;
}

const archiveStatusPriority: Record<PeopleMember['archiveStatus'], number> = {
  待补充: 0,
  资料完整: 1,
  已归档: 2
};

function compareArchiveMembers(left: PeopleMember, right: PeopleMember) {
  return (
    archiveStatusPriority[left.archiveStatus] - archiveStatusPriority[right.archiveStatus] ||
    getPeoplePendingArchiveFiles(right).length - getPeoplePendingArchiveFiles(left).length ||
    right.archiveUpdatedAt.localeCompare(left.archiveUpdatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function getArchiveFileColumns({
  onDownload,
  onPreview
}: {
  onDownload: (file: PeopleArchiveFile) => void;
  onPreview: (file: PeopleArchiveFile) => void;
}): TableColumnsType<PeopleArchiveFile> {
  return [
    {
      title: '文件名称',
      key: 'name',
      width: 190,
      render: (_, record) => (
        <div className="detail-table-main">
          <span>{record.name}</span>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'category',
      align: 'center',
      width: 92
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 92,
      render: (status: PeopleArchiveFile['status']) => <StatusTag toneMap={archiveFileStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 108
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      width: 132,
      render: (_, record) => (
        <FileActionButtons
          record={record}
          onDownload={onDownload}
          onPreview={onPreview}
        />
      )
    }
  ];
}

function getArchiveMaintenanceFileColumns({
  onDelete,
  onPreview
}: {
  onDelete: (fileId: string) => void;
  onPreview: (file: PeopleArchiveFile) => void;
}): TableColumnsType<PeopleArchiveFile> {
  return [
    {
      title: '文件名称',
      key: 'name',
      width: 210,
      render: (_, record) => (
        <div className="detail-table-main">
          <span>{record.name}</span>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'category',
      align: 'center',
      width: 92
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 92,
      render: (status: PeopleArchiveFile['status']) => <StatusTag toneMap={archiveFileStatusTone} value={status} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 108
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      width: 132,
      render: (_, record) => (
        <FileActionButtons
          record={record}
          onDelete={(file) => onDelete(file.id)}
          onPreview={onPreview}
        />
      )
    }
  ];
}

function getArchiveAuditTrailRecords(member: PeopleMember): AuditTrailRecord[] {
  const pendingFiles = getPeoplePendingArchiveFiles(member);
  const baseRecords = member.auditRecords.map((record): AuditTrailRecord => ({
    time: record.time,
    actor: record.actor,
    object: member.name,
    action: record.action,
    summary: record.note,
    result: record.result,
    source: '人员档案',
    note: `档案更新日期：${member.archiveUpdatedAt}`
  }));

  return [
    ...baseRecords,
    {
      time: member.archiveUpdatedAt,
      actor: '周倩',
      object: member.name,
      action: '维护档案文件',
      summary: `相关文件 ${member.archiveFiles.length} 份，待补文件 ${pendingFiles.length} 份`,
      result: '成功',
      source: '人员档案',
      note: pendingFiles.length > 0 ? pendingFiles.map((file) => file.name).join(' / ') : '档案文件已齐全'
    }
  ];
}

function ArchiveDetailDrawer({
  member,
  mode,
  open,
  onClose,
  onModeChange,
  positionOptions,
  workCalendarRows,
  onSave
}: {
  member?: PeopleMember;
  mode: ArchiveDrawerMode;
  open: boolean;
  onClose: () => void;
  onModeChange: (mode: ArchiveDrawerMode) => void;
  positionOptions: string[];
  workCalendarRows: WorkCalendarRow[];
  onSave: (member: PeopleMember) => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const { taskConfigRows } = useTaskConfigState();
  const [previewFile, setPreviewFile] = useState<PeopleArchiveFile>();
  const [draftName, setDraftName] = useState('');
  const [draftPersonnelType, setDraftPersonnelType] = useState<PeopleMember['personnelType']>('全职');
  const [draftPosition, setDraftPosition] = useState('空间设计师');
  const [draftWorkCalendarId, setDraftWorkCalendarId] = useState(defaultWorkCalendarId);
  const [draftGender, setDraftGender] = useState<PeopleMember['gender']>('女');
  const [draftBirthDate, setDraftBirthDate] = useState('');
  const [draftNationality, setDraftNationality] = useState('中国');
  const [draftSource, setDraftSource] = useState('新增建档');
  const [draftMobile, setDraftMobile] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftWechat, setDraftWechat] = useState('');
  const [draftCity, setDraftCity] = useState('武汉');
  const [draftCityPath, setDraftCityPath] = useState<string[]>(['湖北省', '武汉']);
  const [draftGraduationSchool, setDraftGraduationSchool] = useState('');
  const [draftEducation, setDraftEducation] = useState('本科');
  const [draftEducationMajor, setDraftEducationMajor] = useState('');
  const [draftGraduatedAt, setDraftGraduatedAt] = useState('');
  const [draftHousingFundEffectiveMonth, setDraftHousingFundEffectiveMonth] = useState('');
  const [draftHousingFundStatus, setDraftHousingFundStatus] = useState<PeopleHousingFundStatus>('暂不缴存');
  const [draftIdDocumentType, setDraftIdDocumentType] = useState('居民身份证');
  const [draftIdentityNo, setDraftIdentityNo] = useState('');
  const [draftIdValidUntil, setDraftIdValidUntil] = useState('');
  const [draftHukouAddress, setDraftHukouAddress] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftEmergencyContact, setDraftEmergencyContact] = useState('');
  const [draftEmergencyContactRelation, setDraftEmergencyContactRelation] = useState('');
  const [draftEmergencyContactPhone, setDraftEmergencyContactPhone] = useState('');
  const [draftBaseSalary, setDraftBaseSalary] = useState('');
  const [draftStartAt, setDraftStartAt] = useState(prototypeToday);
  const [draftEndAt, setDraftEndAt] = useState('');
  const [draftBankName, setDraftBankName] = useState('');
  const [draftAccountName, setDraftAccountName] = useState('');
  const [draftBankAccount, setDraftBankAccount] = useState('');
  const [draftTaskCapabilityIds, setDraftTaskCapabilityIds] = useState<string[]>([]);
  const [draftArchiveFiles, setDraftArchiveFiles] = useState<PeopleArchiveFile[]>([]);
  const [draftUploadFiles, setDraftUploadFiles] = useState<UploadFile[]>([]);

  const taskCapabilityOptions = useMemo(
    () =>
      taskConfigRows
        .filter((row) => row.status === '启用' || draftTaskCapabilityIds.includes(row.id))
        .map((row) => ({
          label: `${row.name} / ${row.category}`,
          value: row.id
      })),
    [draftTaskCapabilityIds, taskConfigRows]
  );
  const workCalendarOptions = useMemo(
    () => getWorkCalendarOptions(workCalendarRows, draftWorkCalendarId),
    [draftWorkCalendarId, workCalendarRows]
  );

  const archiveFileColumns = useMemo(
    () =>
      getArchiveFileColumns({
        onDownload: (file) => {
          void messageApi.success(`${file.name} 下载请求已记录`);
        },
        onPreview: setPreviewFile
      }),
    [messageApi]
  );
  const archiveMaintenanceFileColumns = useMemo(
    () =>
      getArchiveMaintenanceFileColumns({
        onDelete: handleArchiveFileDelete,
        onPreview: setPreviewFile
      }),
    [draftArchiveFiles]
  );

  useEffect(() => {
    if (!open || !member || (mode !== 'create' && mode !== 'edit')) {
      return;
    }

    setDraftName(member.name === '新人员' ? '' : member.name);
    setDraftPersonnelType(member.personnelType);
    setDraftPosition(member.position);
    setDraftWorkCalendarId(getArchiveWorkCalendarId(member.personnelType, member.workCalendarId));
    setDraftGender(member.gender);
    setDraftBirthDate(member.birthDate);
    setDraftNationality(member.nationality);
    setDraftSource(member.source);
    setDraftMobile(member.mobile);
    setDraftEmail(member.email);
    setDraftWechat(member.wechat);
    setDraftCity(member.city);
    setDraftCityPath(getCityPath(member.city));
    setDraftGraduationSchool(member.graduationSchool);
    setDraftEducation(member.education);
    setDraftEducationMajor(member.educationMajor);
    setDraftGraduatedAt(member.graduatedAt);
    setDraftHousingFundEffectiveMonth(member.personnelType === '全职' ? member.housingFundEffectiveMonth ?? '' : '');
    setDraftHousingFundStatus(member.personnelType === '全职' ? member.housingFundStatus ?? '暂不缴存' : '暂不缴存');
    setDraftIdDocumentType(member.idDocumentType);
    setDraftIdentityNo(member.identityNo);
    setDraftIdValidUntil(member.idValidUntil);
    setDraftHukouAddress(member.hukouAddress);
    setDraftAddress(member.address);
    setDraftEmergencyContact(member.emergencyContact);
    setDraftEmergencyContactRelation(member.emergencyContactRelation);
    setDraftEmergencyContactPhone(member.emergencyContactPhone);
    setDraftBaseSalary(member.salaryProfile.regularSalary ?? member.salaryProfile.probationSalary ?? member.salaryProfile.taskRateRule ?? '');
    setDraftStartAt(member.personnelType === '兼职' ? member.cooperationStartAt ?? member.joinedAt : member.joinedAt);
    setDraftEndAt(member.personnelType === '兼职' ? member.cooperationEndAt ?? '' : member.contractEndAt ?? '');
    setDraftBankName(member.paymentProfile.bankName);
    setDraftAccountName(member.paymentProfile.accountName);
    setDraftBankAccount(member.paymentProfile.bankAccount);
    setDraftTaskCapabilityIds(normalizeTaskCapabilityIds(member.taskCapabilityIds));
    setDraftArchiveFiles(member.archiveFiles);
    setDraftUploadFiles([]);
  }, [member, mode, open]);

  if (!member) {
    return null;
  }

  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit';
  const isMaintainMode = isCreateMode || isEditMode;
  const inferredStatus = inferCreatePeopleStatus(draftPersonnelType);
  const resolvedStatus = isCreateMode ? inferredStatus : member.status;
  const inferredSalaryMode = inferPeopleSalaryMode(draftPersonnelType);
  const isTaskMode = inferredSalaryMode === '任务制';
  const draftContractType = draftPersonnelType === '兼职' ? '合作协议' : '劳动合同';
  const draftSnapshot: ArchiveMaintenanceSnapshot = {
    accountName: normalizeArchiveText(draftAccountName),
    address: normalizeArchiveText(draftAddress),
    archiveFiles: getArchiveFileSnapshot(draftArchiveFiles),
    bankAccount: normalizeArchiveText(draftBankAccount),
    bankName: normalizeArchiveText(draftBankName),
    baseSalary: normalizeArchiveText(draftBaseSalary),
    birthDate: normalizeArchiveText(draftBirthDate),
    city: normalizeArchiveText(draftCity),
    contractEndAt: normalizeArchiveText(draftEndAt),
    contractType: draftContractType,
    education: normalizeArchiveText(draftEducation),
    educationMajor: normalizeArchiveText(draftEducationMajor),
    email: normalizeArchiveText(draftEmail),
    emergencyContact: normalizeArchiveText(draftEmergencyContact),
    emergencyContactPhone: normalizeArchiveText(draftEmergencyContactPhone),
    emergencyContactRelation: normalizeArchiveText(draftEmergencyContactRelation),
    gender: draftGender,
    graduatedAt: normalizeArchiveText(draftGraduatedAt),
    graduationSchool: normalizeArchiveText(draftGraduationSchool),
    housingFundEffectiveMonth: draftPersonnelType === '全职' ? normalizeArchiveText(draftHousingFundEffectiveMonth) : '',
    housingFundStatus: draftPersonnelType === '全职' ? draftHousingFundStatus : '暂不缴存',
    hukouAddress: normalizeArchiveText(draftHukouAddress),
    idDocumentType: normalizeArchiveText(draftIdDocumentType),
    idValidUntil: normalizeArchiveText(draftIdValidUntil),
    identityNo: normalizeArchiveText(draftIdentityNo),
    mobile: normalizeArchiveText(draftMobile),
    name: normalizeArchiveText(draftName),
    nationality: normalizeArchiveText(draftNationality || '中国'),
    personnelType: draftPersonnelType,
    position: normalizeArchiveText(draftPosition),
    salaryMode: inferredSalaryMode,
    source: normalizeArchiveText(draftSource),
    startAt: normalizeArchiveText(draftStartAt),
    taskCapabilityIds: normalizeTaskCapabilityIds(draftTaskCapabilityIds),
    wechat: normalizeArchiveText(draftWechat),
    workCalendarId: getArchiveWorkCalendarId(draftPersonnelType, draftWorkCalendarId)
  };
  const originalSnapshot = getMemberArchiveMaintenanceSnapshot(member);
  const archiveRequiredMissingLabels = getArchiveRequiredMissingLabels(draftSnapshot).filter(
    (label) => isCreateMode || !['基础薪资', '任务规则'].includes(label)
  );
  const requiredArchiveFileSlots = getArchiveRequiredFileSlots(draftPersonnelType);
  const supplementalArchiveFiles = draftArchiveFiles.filter((file) => !isRequiredArchiveFile(file, draftPersonnelType));
  const isArchiveDirty = isMaintainMode && serializeArchiveSnapshot(draftSnapshot) !== serializeArchiveSnapshot(originalSnapshot);
  const canSaveArchive = isMaintainMode && archiveRequiredMissingLabels.length === 0 && isArchiveDirty;
  const visibleArchiveStatus = isMaintainMode ? getArchiveStatusFromSnapshot(draftSnapshot, isCreateMode ? '待补充' : member.archiveStatus) : member.archiveStatus;
  const pendingFiles = isMaintainMode
    ? draftArchiveFiles.filter((file) => file.status === '待补充')
    : getPeoplePendingArchiveFiles(member);
  const visibleTaskCapabilityRows = getTaskCapabilityRows(isMaintainMode ? draftTaskCapabilityIds : member.taskCapabilityIds, taskConfigRows);
  const showWorkCalendarField = (isMaintainMode ? draftPersonnelType : member.personnelType) === '全职';
  const visibleWorkCalendarName = showWorkCalendarField
    ? getWorkCalendarDisplayName(isMaintainMode ? draftWorkCalendarId : member.workCalendarId, workCalendarRows, { includeStatus: true })
    : '';

  function handleDrawerClose() {
    setPreviewFile(undefined);
    onClose();
  }

  function handleArchiveMaintenanceCancel() {
    setPreviewFile(undefined);

    if (isEditMode) {
      onModeChange('detail');
      return;
    }

    onClose();
  }

  function handleDraftPersonnelTypeChange(personnelType: PeopleMember['personnelType']) {
    setDraftPersonnelType(personnelType);

    if (personnelType === '全职' && !draftWorkCalendarId) {
      setDraftWorkCalendarId(defaultWorkCalendarId);
    }

    if (personnelType === '兼职') {
      setDraftWorkCalendarId('');
      setDraftHousingFundEffectiveMonth('');
      setDraftHousingFundStatus('暂不缴存');
    }
  }

  function handleDraftCityChange(cityPath: string[]) {
    setDraftCityPath(cityPath);

    const city = getRegionCity(cityPath);
    setDraftCity(city);
  }

  function handleArchiveMemberSave() {
    if (!member) {
      return;
    }

    const sourceMember = member;
    const startAt = draftSnapshot.startAt || prototypeToday;
    const endAt = draftSnapshot.contractEndAt || undefined;
    const baseSalary = draftSnapshot.baseSalary;
    const isParttime = draftPersonnelType === '兼职';
    const contractStatus = isParttime ? '合作协议有效' : '劳动合同有效';
    const normalizedArchiveFiles = draftArchiveFiles.map((file) => ({
      ...file,
      category: file.category === '合同协议' && isParttime ? '合作资料' : file.category,
      name: file.name === '劳动合同' && isParttime ? '合作协议' : file.name
    }));

    if (archiveRequiredMissingLabels.length > 0) {
      void messageApi.warning(`请补充：${archiveRequiredMissingLabels.slice(0, 3).join('、')}`);
      return;
    }

    if (!isArchiveDirty) {
      void messageApi.info('暂无可保存的变更');
      return;
    }

    const nextSnapshot = {
      ...draftSnapshot,
      archiveFiles: getArchiveFileSnapshot(normalizedArchiveFiles)
    };
    const nextMember: PeopleMember = {
      ...sourceMember,
      address: draftSnapshot.address,
      archiveFiles: normalizedArchiveFiles,
      archiveStatus: getArchiveStatusFromSnapshot(nextSnapshot, isCreateMode ? '待补充' : sourceMember.archiveStatus),
      archiveUpdatedAt: prototypeToday,
      auditRecords: [
        {
          time: '2026-06-11 00:00',
          actor: '李明',
          action: isCreateMode ? '创建人员档案' : '更新人员档案',
          result: '成功',
          note: isCreateMode ? '新增人员待完善档案' : '编辑人员档案'
        },
        ...sourceMember.auditRecords
      ],
      birthDate: draftSnapshot.birthDate,
      city: draftSnapshot.city,
      contractEndAt: endAt,
      contractNo: isCreateMode ? getGeneratedContractNo(sourceMember.id, draftPersonnelType) : sourceMember.contractNo,
      contractStartAt: startAt,
      contractStatus,
      contractType: draftContractType,
      cooperationEndAt: isParttime ? endAt : undefined,
      cooperationStartAt: isParttime ? startAt : undefined,
      education: draftSnapshot.education,
      educationMajor: draftSnapshot.educationMajor,
      email: draftSnapshot.email,
      emergencyContact: draftSnapshot.emergencyContact,
      emergencyContactPhone: draftSnapshot.emergencyContactPhone,
      emergencyContactRelation: draftSnapshot.emergencyContactRelation,
      gender: draftGender,
      graduatedAt: draftSnapshot.graduatedAt,
      graduationSchool: draftSnapshot.graduationSchool,
      hukouAddress: draftSnapshot.hukouAddress,
      idDocumentType: draftSnapshot.idDocumentType,
      idValidUntil: draftSnapshot.idValidUntil,
      identityNo: draftSnapshot.identityNo,
      housingFundEffectiveMonth:
        !isParttime && draftSnapshot.housingFundStatus === '缴存' ? draftSnapshot.housingFundEffectiveMonth : undefined,
      housingFundStatus: isParttime ? undefined : draftSnapshot.housingFundStatus,
      joinedAt: startAt,
      mobile: draftSnapshot.mobile,
      name: draftSnapshot.name,
      nationality: draftSnapshot.nationality || '中国',
      paymentProfile: {
        accountName: draftSnapshot.accountName || draftSnapshot.name,
        bankAccount: draftSnapshot.bankAccount,
        bankName: draftSnapshot.bankName,
        mode: isTaskMode ? '按任务付款' : '工资发放',
        payCycle: isTaskMode ? '按任务' : '月度'
      },
      personnelType: draftPersonnelType,
      position: draftPosition,
      probationEndAt: !isParttime ? endAt ?? sourceMember.probationEndAt : undefined,
      salaryProfile: isCreateMode
        ? {
            effectiveAt: startAt,
            note: isTaskMode ? '按任务规则结算，具体规则待维护' : '月薪制薪资约定',
            payCycle: isTaskMode ? '按任务' : '月度',
            probationSalary: !isParttime && baseSalary ? baseSalary : undefined,
            regularSalary: undefined,
            status: baseSalary ? '已配置' : '待补充',
            structure: inferredSalaryMode,
            taskRateRule: isTaskMode ? baseSalary || '待维护任务规则' : undefined
          }
        : sourceMember.salaryProfile,
      source: draftSnapshot.source,
      status: resolvedStatus,
      taskAccessStatus: getPeopleTaskAccessStatusFromArchive(resolvedStatus, draftSnapshot.taskCapabilityIds),
      taskCapabilityIds: draftSnapshot.taskCapabilityIds,
      wechat: draftSnapshot.wechat,
      workCalendarId: isParttime ? undefined : draftSnapshot.workCalendarId
    };

    onSave(nextMember);
    void messageApi.success(isCreateMode ? '人员已新增' : '档案已保存');
  }

  function handleArchiveFileUploadChange(fileList: UploadFile[]) {
    if (!member) {
      return;
    }

    const uploadedFiles: PeopleArchiveFile[] = fileList.map((file, index) => ({
      category: inferArchiveFileCategory(file.name, draftPersonnelType),
      id: `FILE-${member.id}-UPLOAD-${file.uid || String(index + 1).padStart(3, '0')}`,
      name: file.name,
      status: '已上传',
      updatedAt: prototypeToday
    }));
    const uploadedFileNames = new Set(uploadedFiles.map((file) => file.name));

    setDraftUploadFiles(fileList);
    setDraftArchiveFiles((currentFiles) => [
      ...uploadedFiles,
      ...currentFiles.filter((file) => !file.id.includes('-UPLOAD-') && !uploadedFileNames.has(file.name))
    ]);
  }

  function handleRequiredArchiveFileUpload(slot: ArchiveRequiredFileSlot, file: UploadFile) {
    if (!member || !file.name) {
      return;
    }

    const fileSize = getUploadFileSize(file);

    if (fileSize > slot.maxSizeMb * 1024 * 1024) {
      void messageApi.error(`${slot.label} 文件不能超过 ${slot.maxSizeMb}MB`);
      return;
    }

    const existingFile = getArchiveSlotFile(draftArchiveFiles, slot);
    const nextFile: PeopleArchiveFile = {
      category: slot.category,
      id: existingFile?.id ?? `FILE-${member.id}-${slot.key}-${file.uid || prototypeToday}`,
      name: file.name.includes(slot.label) ? file.name : `${slot.label} - ${file.name}`,
      status: '已上传',
      updatedAt: prototypeToday
    };

    setDraftArchiveFiles((currentFiles) => [nextFile, ...currentFiles.filter((currentFile) => currentFile.id !== existingFile?.id)]);
    void messageApi.success(`${slot.label} 已上传`);
  }

  function handleRequiredArchiveFileDelete(slot: ArchiveRequiredFileSlot) {
    const file = getArchiveSlotFile(draftArchiveFiles, slot);

    if (!file) {
      return;
    }

    setDraftArchiveFiles((currentFiles) => currentFiles.filter((currentFile) => currentFile.id !== file.id));
    void messageApi.success(`${slot.label} 已移除`);
  }

  function handleArchiveFileDelete(fileId: string) {
    const file = draftArchiveFiles.find((currentFile) => currentFile.id === fileId);

    setDraftArchiveFiles((currentFiles) => currentFiles.filter((currentFile) => currentFile.id !== fileId));

    if (file) {
      setDraftUploadFiles((currentFiles) => currentFiles.filter((currentFile) => currentFile.name !== file.name));
      void messageApi.success(`${file.name} 已移除`);
    }
  }

  const archiveDrawerTitle = (
    <DetailDrawerTitle
      status={visibleArchiveStatus}
      statusToneMap={archiveStatusTone}
      subtitle="人员组织 / 人员档案"
      title={isCreateMode ? '新增人员' : isEditMode ? '编辑档案' : '档案详情'}
    />
  );

  const archiveDetailActions = {
    closeAction: {
      label: '关闭',
      onClick: handleDrawerClose
    },
    primaryAction: {
      label: '编辑档案',
      onClick: () => onModeChange('edit')
    }
  };

  const archiveFormActions = {
    cancelAction: {
      label: '取消',
      onClick: handleArchiveMaintenanceCancel
    },
    primaryAction: {
      disabled: !canSaveArchive,
      label: isCreateMode ? '保存人员' : '保存档案',
      onClick: handleArchiveMemberSave
    }
  };

  return (
    <>
      {contextHolder}
      <DrawerFormShell
        bodyTestId="people-archive-detail-drawer"
        detailActions={archiveDetailActions}
        formActions={archiveFormActions}
        mode={mode}
        open={open}
        title={archiveDrawerTitle}
        width={900}
        onClose={handleDrawerClose}
      >
        <DrawerProfileCard
          avatar={(isMaintainMode ? draftName || '新' : member.name).slice(-1)}
          subtitle={`${member.id} / ${isMaintainMode ? draftCity : member.city}`}
          tags={[
            <StatusTag
              key="status"
              tone={statusTone[isMaintainMode ? resolvedStatus : member.status]}
              value={`${isMaintainMode ? draftPersonnelType : member.personnelType} / ${isMaintainMode ? resolvedStatus : member.status}`}
            />
          ]}
          title={isMaintainMode ? draftName || '待填写姓名' : member.name}
        />

        <DetailSummaryCards
          items={[
            {
              icon: <FileTextOutlined />,
              key: 'archiveFiles',
              label: '相关文件',
              value: `${isMaintainMode ? draftArchiveFiles.length : member.archiveFiles.length} 份`
            },
            {
              icon: <SafetyCertificateOutlined />,
              key: 'pendingFiles',
              label: '待补文件',
              value: `${pendingFiles.length} 份`
            },
            {
              icon: <SolutionOutlined />,
              key: 'taskCapabilities',
              label: '可承接',
              value: `${visibleTaskCapabilityRows.length} 类`
            }
          ]}
        />

        <DetailTabs
          defaultActiveKey="base"
          key={`${mode}-${member.id}`}
          tabTestIdPrefix="people-archive-detail-tab"
          testId="people-archive-detail-tabs"
          items={
            isMaintainMode
                ? [
                    {
                      key: 'base',
                      label: '基础资料',
                      children: (
                        <>
	                          <DetailSection icon={<TeamOutlined />} title="人员基础">
	                            <DrawerFormGrid>
	                              <ReadOnlyField label="工号" value={member.id} />
	                              <DrawerFormField required label="姓名">
	                                <Input placeholder="请输入姓名" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
	                              </DrawerFormField>
	                              {isCreateMode ? (
	                                <DrawerFormField required label="员工类别">
	                                  <Select
	                                    value={draftPersonnelType}
	                                    options={[
	                                      { label: '全职', value: '全职' },
	                                      { label: '兼职', value: '兼职' }
	                                    ]}
	                                    onChange={handleDraftPersonnelTypeChange}
	                                  />
	                                </DrawerFormField>
	                              ) : (
	                                <ReadOnlyField label="员工类别" value={draftPersonnelType} />
	                              )}
	                              <DrawerFormField required label="性别">
	                                <Select
	                                  value={draftGender}
	                                  options={archiveGenderOptions.map((gender) => ({ label: gender, value: gender }))}
	                                  onChange={(gender: PeopleMember['gender']) => setDraftGender(gender)}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField required label="出生日期">
	                                <DatePicker
	                                  className="archive-create-date-picker"
	                                  format="YYYY-MM-DD"
	                                  placeholder="选择日期"
	                                  onChange={(_, dateString) => setDraftBirthDate(normalizeDateString(dateString))}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField required label="国籍">
	                                <Input value={draftNationality} onChange={(event) => setDraftNationality(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField required label="所在城市">
	                                <RegionSearchSelect placeholder="选择城市" value={draftCityPath} onChange={handleDraftCityChange} />
	                              </DrawerFormField>
	                            </DrawerFormGrid>
	                          </DetailSection>

	                          <DetailSection icon={<ContactsOutlined />} title="身份与联系">
	                            <DrawerFormGrid>
	                              <DrawerFormField required label="手机号">
	                                <Input placeholder="请输入联系电话" value={draftMobile} onChange={(event) => setDraftMobile(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField label="邮箱">
	                                <Input value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField label="微信">
	                                <Input value={draftWechat} onChange={(event) => setDraftWechat(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField required label="证件类型">
	                                <Select
	                                  value={draftIdDocumentType}
	                                  options={archiveDocumentTypeOptions.map((documentType) => ({ label: documentType, value: documentType }))}
	                                  onChange={setDraftIdDocumentType}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField required label="证件号码">
	                                <Input value={draftIdentityNo} onChange={(event) => setDraftIdentityNo(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField label="证件有效期">
	                                <DatePicker
	                                  className="archive-create-date-picker"
	                                  format="YYYY-MM-DD"
	                                  placeholder="选择日期"
	                                  onChange={(_, dateString) => setDraftIdValidUntil(normalizeDateString(dateString))}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField wide label="户籍地址">
	                                <Input value={draftHukouAddress} onChange={(event) => setDraftHukouAddress(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField required wide label="居住地址">
	                                <Input value={draftAddress} onChange={(event) => setDraftAddress(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField label="紧急联系人">
	                                <Input value={draftEmergencyContact} onChange={(event) => setDraftEmergencyContact(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField label="关系">
	                                <Input
	                                  value={draftEmergencyContactRelation}
	                                  onChange={(event) => setDraftEmergencyContactRelation(event.target.value)}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField required label="紧急联系电话">
	                                <Input value={draftEmergencyContactPhone} onChange={(event) => setDraftEmergencyContactPhone(event.target.value)} />
	                              </DrawerFormField>
	                            </DrawerFormGrid>
	                          </DetailSection>

                        </>
                      )
                    },
                    {
                      key: 'employment-salary',
                      label: '任职与薪资',
                      children: (
                        <>
	                          <DetailSection icon={<TeamOutlined />} title="任职信息">
	                            <DrawerFormGrid>
	                              <DrawerFormField required label="岗位">
	                                <Select
	                                  value={draftPosition}
	                                  options={positionOptions.map((position) => ({ label: position, value: position }))}
	                                  onChange={setDraftPosition}
	                                />
	                              </DrawerFormField>
	                              {draftPersonnelType === '全职' ? (
	                                <DrawerFormField label="适用工作日历">
	                                  <Select
	                                    value={draftWorkCalendarId || defaultWorkCalendarId}
	                                    options={workCalendarOptions}
	                                    onChange={setDraftWorkCalendarId}
	                                  />
	                                </DrawerFormField>
	                              ) : null}
	                              <DrawerFormField required label="人员来源">
	                                <Select
	                                  value={draftSource}
	                                  options={archiveSourceOptions.map((source) => ({ label: source, value: source }))}
	                                  onChange={setDraftSource}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField required label={draftPersonnelType === '兼职' ? '合作起始日期' : '入职日期'}>
	                                <DatePicker
	                                  className="archive-create-date-picker"
	                                  format="YYYY-MM-DD"
	                                  placeholder="选择日期"
	                                  onChange={(_, dateString) => setDraftStartAt(normalizeDateString(dateString))}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField label={draftPersonnelType === '兼职' ? '终止合作日期' : '合同结束日期'}>
	                                <DatePicker
	                                  className="archive-create-date-picker"
	                                  format="YYYY-MM-DD"
	                                  placeholder="选择日期"
	                                  onChange={(_, dateString) => setDraftEndAt(normalizeDateString(dateString))}
	                                />
	                              </DrawerFormField>
	                            </DrawerFormGrid>
	                          </DetailSection>

	                          <DetailSection icon={<SolutionOutlined />} title="学历信息">
	                            <DrawerFormGrid>
	                              <DrawerFormField label="毕业院校">
	                                <Input value={draftGraduationSchool} onChange={(event) => setDraftGraduationSchool(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField label="学历">
	                                <Select
	                                  value={draftEducation}
	                                  options={archiveEducationOptions.map((education) => ({ label: education, value: education }))}
	                                  onChange={setDraftEducation}
	                                />
	                              </DrawerFormField>
	                              <DrawerFormField label="专业">
	                                <Input value={draftEducationMajor} onChange={(event) => setDraftEducationMajor(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField label="毕业时间">
	                                <DatePicker
	                                  className="archive-create-date-picker"
	                                  format="YYYY-MM-DD"
	                                  placeholder="选择日期"
	                                  onChange={(_, dateString) => setDraftGraduatedAt(normalizeDateString(dateString))}
	                                />
	                              </DrawerFormField>
	                            </DrawerFormGrid>
	                          </DetailSection>

	                          <DetailSection icon={<BankOutlined />} title="薪资约定与收款资料">
	                            <DrawerFormGrid>
	                              <ReadOnlyField label="计薪方式" value={inferredSalaryMode} />
	                              {isCreateMode ? (
	                                <DrawerFormField required label={isTaskMode ? '任务规则' : '基础薪资'}>
	                                  <Input
	                                    placeholder={isTaskMode ? '如 按任务规则' : '如 10000 元/月'}
	                                    value={draftBaseSalary}
	                                    onChange={(event) => setDraftBaseSalary(event.target.value)}
	                                  />
	                                </DrawerFormField>
	                              ) : (
	                                <ReadOnlyField label={isTaskMode ? '任务规则' : '基础薪资'} value={draftBaseSalary || '-'} />
	                              )}
	                              {draftPersonnelType === '全职' ? (
	                                <>
	                                  <DrawerFormField label="公积金缴存">
	                                    <Select
	                                      value={draftHousingFundStatus}
	                                      options={archiveHousingFundStatusOptions.map((status) => ({ label: status, value: status }))}
	                                      onChange={setDraftHousingFundStatus}
	                                    />
	                                  </DrawerFormField>
	                                  {draftHousingFundStatus === '缴存' ? (
	                                    <DrawerFormField required label="公积金生效月份">
	                                      <Input
	                                        placeholder="如 2026-06"
	                                        value={draftHousingFundEffectiveMonth}
	                                        onChange={(event) => setDraftHousingFundEffectiveMonth(event.target.value)}
	                                      />
	                                    </DrawerFormField>
	                                  ) : null}
	                                </>
	                              ) : null}
	                              <DrawerFormField required label="开户行">
	                                <Input value={draftBankName} onChange={(event) => setDraftBankName(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField required label="账户名">
	                                <Input value={draftAccountName} onChange={(event) => setDraftAccountName(event.target.value)} />
	                              </DrawerFormField>
	                              <DrawerFormField required label="银行卡号">
	                                <Input value={draftBankAccount} onChange={(event) => setDraftBankAccount(event.target.value)} />
	                              </DrawerFormField>
	                            </DrawerFormGrid>
	                          </DetailSection>

	                          <DetailSection icon={<FileProtectOutlined />} title="合同与协议">
	                            <DrawerFormGrid>
	                              <ReadOnlyField label="合同/协议类型" value={draftContractType} />
	                            </DrawerFormGrid>
	                          </DetailSection>
                        </>
                      )
                    },
                    {
                      key: 'task-capabilities',
	                      label: '任务能力',
	                      children: (
	                        <DetailSection icon={<SolutionOutlined />} title="可承接任务">
	                          <DrawerFormGrid>
	                            <DrawerFormField wide label="任务类型">
	                              <Select
	                                mode="multiple"
	                                options={taskCapabilityOptions}
	                                placeholder="选择可承接任务"
	                                value={draftTaskCapabilityIds}
	                                onChange={(taskCapabilityIds: string[]) => setDraftTaskCapabilityIds(normalizeTaskCapabilityIds(taskCapabilityIds))}
	                              />
	                            </DrawerFormField>
	                          </DrawerFormGrid>
                          <div className="archive-task-capability-list">
                            {visibleTaskCapabilityRows.length > 0 ? (
                              visibleTaskCapabilityRows.map((taskConfig) => (
                                <div className="archive-task-capability-row" key={taskConfig.id}>
                                  <div>
                                    <div className="archive-task-capability-name">{taskConfig.name}</div>
                                    <div className="archive-task-capability-meta">{taskConfig.category}</div>
                                  </div>
                                  <TagChip label={taskConfig.code} />
                                </div>
                              ))
                            ) : (
                              <div className="archive-task-capability-empty">未配置</div>
                            )}
                          </div>
                        </DetailSection>
                      )
                    },
                    {
                      key: 'archive-files',
                      label: '档案文件',
                      children: (
                        <DetailSection icon={<UploadOutlined />} title="档案资料">
                          <FileSlotGrid>
                            {requiredArchiveFileSlots.map((slot) => {
                              const file = getArchiveSlotFile(draftArchiveFiles, slot);

                              return (
                                <FileSlot
                                  accept={slot.accept}
                                  description={slot.description}
                                  file={file}
                                  key={slot.key}
                                  status={file?.status ?? '未上传'}
                                  statusTone={file ? archiveFileStatusTone[file.status] : 'amber'}
                                  title={slot.label}
                                  onPreview={setPreviewFile}
                                  onRemove={() => handleRequiredArchiveFileDelete(slot)}
                                  onSelect={(uploadFile) => handleRequiredArchiveFileUpload(slot, uploadFile)}
                                />
                              );
                            })}
                          </FileSlotGrid>

                          <FileUploadDropzone
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            description="附件、说明、补充证明等资料可按需上传，不影响保存。"
                            fileList={draftUploadFiles}
                            multiple
                            title="补充资料"
                            uploadText="上传补充资料"
                            onChange={handleArchiveFileUploadChange}
                          />
                          {supplementalArchiveFiles.length > 0 ? (
                            <Table<PeopleArchiveFile>
                              className="detail-table archive-maintenance-table"
                              columns={archiveMaintenanceFileColumns}
                              dataSource={supplementalArchiveFiles}
                              pagination={false}
                              rowKey="id"
                              scroll={{ x: 634 }}
                              size="small"
                            />
                          ) : null}
                        </DetailSection>
                      )
          }
                  ]
                : [
                    {
                      key: 'base',
                      label: '基础资料',
                      children: (
                        <>
                          <DetailSection icon={<TeamOutlined />} title="基础档案">
                            <DetailInfoGrid
                              columns={2}
                              items={[
                                { label: '性别', value: member.gender },
                                { label: '出生日期', value: member.birthDate },
                                { label: '国籍', value: member.nationality },
                                { label: '所在城市', value: member.city }
                              ]}
                            />
                          </DetailSection>

                          <DetailSection icon={<ContactsOutlined />} title="身份与联系">
                            <DetailInfoGrid
                              columns={2}
                              items={[
                                { label: '证件类型', value: member.idDocumentType },
                                { label: '证件号码', value: member.identityNo },
                                { label: '证件有效期', value: member.idValidUntil },
                                { label: '手机号', value: member.mobile },
                                { label: '邮箱', value: member.email },
                                { label: '微信', value: member.wechat },
                                { label: '户籍地址', value: member.hukouAddress },
                                { label: '居住地址', value: member.address },
                                {
                                  label: '紧急联系人',
                                  value: `${member.emergencyContact} / ${member.emergencyContactRelation} / ${member.emergencyContactPhone}`
                                }
                              ]}
                            />
                          </DetailSection>
                        </>
                      )
                    },
                    {
                      key: 'employment-salary',
                      label: '任职与薪资',
                      children: (
                        <>
                          <DetailSection icon={<TeamOutlined />} title="任职信息">
                            <DetailInfoGrid
                              columns={2}
                              items={[
                                { label: '岗位', value: member.position },
                                ...(member.personnelType === '全职'
                                  ? [{ label: '适用工作日历', value: visibleWorkCalendarName }]
                                  : []),
                                { label: '人员来源', value: member.source },
                                { label: '入职/建档日期', value: member.joinedAt },
                                { label: '关系类型', value: member.contractType },
                                { label: '关系状态', value: member.contractStatus },
                                { label: '试用期截止', value: member.personnelType === '全职' ? member.probationEndAt ?? '-' : '-' },
                                { label: '合作开始', value: member.personnelType === '兼职' ? member.cooperationStartAt ?? '-' : '-' },
                                { label: '合作结束', value: member.personnelType === '兼职' ? member.cooperationEndAt ?? '-' : '-' }
                              ]}
                            />
                          </DetailSection>

                          <DetailSection icon={<SolutionOutlined />} title="学历信息">
                            <DetailInfoGrid
                              columns={2}
                              items={[
                                { label: '毕业院校', value: member.graduationSchool || '-' },
                                { label: '学历', value: member.education || '-' },
                                { label: '专业', value: member.educationMajor || '-' },
                                { label: '毕业时间', value: member.graduatedAt || '-' }
                              ]}
                            />
                          </DetailSection>

                          <DetailSection icon={<BankOutlined />} title="薪资约定与收款资料">
                            <DetailInfoGrid
                              columns={2}
                              items={[
                                { label: '薪资结构', value: member.salaryProfile.structure },
                                { label: '试用期约定', value: member.salaryProfile.probationSalary ?? '-' },
                                { label: '转正约定', value: member.salaryProfile.regularSalary ?? '-' },
                                { label: '任务规则', value: member.salaryProfile.taskRateRule ?? '-' },
                                ...(member.personnelType === '全职'
                                  ? [
                                      {
                                        label: '公积金缴存',
                                        value: <StatusTag toneMap={housingFundStatusTone} value={getPeopleHousingFundStatus(member)} />
                                      },
                                      {
                                        label: '公积金生效月份',
                                        value: getPeopleHousingFundStatus(member) === '缴存' ? member.housingFundEffectiveMonth ?? '-' : '-'
                                      }
                                    ]
                                  : []),
                                { label: '发放周期', value: member.salaryProfile.payCycle },
                                { label: '生效日期', value: member.salaryProfile.effectiveAt },
                                { label: '薪资备注', value: member.salaryProfile.note },
                                { label: '收款用途', value: member.paymentProfile.mode },
                                { label: '开户行', value: member.paymentProfile.bankName },
                                { label: '账户名', value: member.paymentProfile.accountName },
                                { label: '银行卡号', value: member.paymentProfile.bankAccount }
                              ]}
                            />
                          </DetailSection>

                          <DetailSection icon={<FileProtectOutlined />} title="合同与协议">
                            <DetailInfoGrid
                              columns={2}
                              items={[
                                { label: '合同/协议类型', value: member.contractType },
                                { label: '合同/协议编号', value: member.contractNo },
                                { label: '合同/协议状态', value: member.contractStatus },
                                { label: '合同/协议周期', value: `${member.contractStartAt} 至 ${member.contractEndAt ?? '-'}` }
                              ]}
                            />
                          </DetailSection>
                        </>
                      )
                    },
                    {
                      key: 'task-capabilities',
                      label: '任务能力',
                      children: (
                        <DetailSection icon={<SolutionOutlined />} title="可承接任务">
                          <div className="archive-task-capability-list">
                            {visibleTaskCapabilityRows.length > 0 ? (
                              visibleTaskCapabilityRows.map((taskConfig) => (
                                <div className="archive-task-capability-row" key={taskConfig.id}>
                                  <div>
                                    <div className="archive-task-capability-name">{taskConfig.name}</div>
                                    <div className="archive-task-capability-meta">{taskConfig.category}</div>
                                  </div>
                                  <TagChip label={taskConfig.code} />
                                </div>
                              ))
                            ) : (
                              <div className="archive-task-capability-empty">未配置</div>
                            )}
                          </div>
                        </DetailSection>
                      )
                    },
                    {
                      key: 'files',
                      label: '文件记录',
                      children: (
                        <>
                          <DetailSection icon={<FileTextOutlined />} title="相关文件">
                            <Table<PeopleArchiveFile>
                              className="detail-table"
                              columns={archiveFileColumns}
                              dataSource={member.archiveFiles}
                              pagination={false}
                              rowKey="id"
                              scroll={{ x: 614 }}
                              size="small"
                            />
                          </DetailSection>

                          <AuditTrailSection icon={<AuditOutlined />} records={getArchiveAuditTrailRecords(member)} title="最近操作" />
                        </>
                      )
                    }
                  ]
          }
          />
      </DrawerFormShell>
      <FilePreviewModal
        file={previewFile}
        icon={<FileTextOutlined />}
        statusToneMap={archiveFileStatusTone}
        title="文件预览"
        onClose={() => setPreviewFile(undefined)}
      />
    </>
  );
}

export function PeopleArchivesPage() {
  const { activePositionOptions, peopleRows, savePeopleMember } = usePeopleOrganizationState();
  const { workCalendarRows } = useWorkCalendarState();
  const archiveMembers = peopleRows;
  const [archiveFilters, setArchiveFilters] = useState<ArchiveSearchFilters>(defaultArchiveFilters);
  const [activeMember, setActiveMember] = useState<PeopleMember>();
  const [archiveDrawerMode, setArchiveDrawerMode] = useState<ArchiveDrawerMode>('detail');
  const [detailOpen, setDetailOpen] = useState(false);

  const pending = archiveMembers.filter((member) => getPeopleArchiveListStatus(member) === '待补充').length;
  const completed = archiveMembers.filter((member) => getPeopleArchiveListStatus(member) === '已齐全').length;
  const archived = archiveMembers.filter((member) => member.archiveStatus === '已归档').length;
  const fileCount = archiveMembers.reduce((total, member) => total + member.archiveFiles.length, 0);
  const pendingFileCount = archiveMembers.reduce((total, member) => total + getPeoplePendingArchiveFiles(member).length, 0);

  function openArchiveDetail(record: PeopleMember) {
    setArchiveDrawerMode('detail');
    setActiveMember(record);
    setDetailOpen(true);
  }

  function openCreateArchiveDrawer() {
    setArchiveDrawerMode('create');
    setActiveMember(createDraftArchiveMember(archiveMembers));
    setDetailOpen(true);
  }

  function saveArchiveMember(member: PeopleMember) {
    savePeopleMember(member);
    setActiveMember(member);
    setArchiveDrawerMode('detail');
    setDetailOpen(true);
  }

  const filteredMembers = useMemo(
    () =>
      archiveMembers
        .filter((member) => {
          const keyword = archiveFilters.keyword.trim().toLowerCase();
          const matchesArchiveStatus = archiveFilters.archiveStatus === '全部' || getPeopleArchiveListStatus(member) === archiveFilters.archiveStatus;
          const matchesFileStatus =
            archiveFilters.fileStatus === '全部' || member.archiveFiles.some((file) => file.status === archiveFilters.fileStatus);
          const matchesKeyword =
            keyword.length === 0 ||
            member.name.toLowerCase().includes(keyword) ||
            member.id.toLowerCase().includes(keyword) ||
            member.mobile.toLowerCase().includes(keyword) ||
            member.position.toLowerCase().includes(keyword) ||
            (member.personnelType === '全职' &&
              getWorkCalendarDisplayName(member.workCalendarId, workCalendarRows, { includeStatus: true }).toLowerCase().includes(keyword)) ||
            member.graduationSchool.toLowerCase().includes(keyword) ||
            member.education.toLowerCase().includes(keyword) ||
            member.educationMajor.toLowerCase().includes(keyword);

          return matchesArchiveStatus && matchesFileStatus && matchesKeyword;
        })
        .sort(compareArchiveMembers),
    [archiveFilters, archiveMembers, workCalendarRows]
  );

  const columns: TableColumnsType<PeopleMember> = [
    {
      title: '工号',
      dataIndex: 'id',
      width: 104,
      render: (id: string) => <CellText>{id}</CellText>
    },
    {
      title: '姓名/联系电话',
      key: 'nameContact',
      width: 156,
      render: (_, record) => <CompactCell primary={record.name} secondary={record.mobile} />
    },
    {
      title: '员工类别',
      key: 'employeeCategory',
      align: 'center',
      width: 122,
      render: (_, record) => <StatusTag tone={statusTone[record.status]} value={getPeopleEmployeeCategoryText(record)} />
    },
    {
      title: '档案状态',
      key: 'archiveListStatus',
      align: 'center',
      width: 96,
      render: (_, record) => {
        const status = getPeopleArchiveListStatus(record);
        return <StatusTag toneMap={archiveListStatusTone} value={status} />;
      }
    },
    {
      title: '计薪方式',
      key: 'salaryMode',
      align: 'center',
      width: 128,
      render: (_, record) => getPeopleSalaryModeText(record)
    },
    {
      title: '基础薪资',
      key: 'baseSalary',
      align: 'center',
      width: 118,
      render: (_, record) => <CellText>{getPeopleBaseSalaryText(record)}</CellText>
    },
    {
      title: '起始日期',
      key: 'startDate',
      width: 128,
      render: (_, record) => {
        const startDate = getPeopleArchiveStartDateInfo(record);

        return (
          <CompactCell primary={startDate.value} primaryTone="default" secondary={startDate.label} />
        );
      }
    },
    {
      title: '结束日期',
      key: 'endDate',
      width: 128,
      render: (_, record) => {
        const endDate = getPeopleArchiveEndDateInfo(record);

        return (
          <CompactCell primary={endDate.value} primaryTone="default" secondary={endDate.label} />
        );
      }
    },
    {
      title: '岗位',
      dataIndex: 'position',
      width: 104,
      render: (position: string) => <CellText>{position}</CellText>
    },
    {
      title: '学历',
      dataIndex: 'education',
      align: 'center',
      width: 82
    },
    {
      title: '最近更新',
      dataIndex: 'archiveUpdatedAt',
      align: 'center',
      width: 104
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={5}>
          <MetricCard label="已齐全" value={completed} icon={<FileProtectOutlined />} />
          <MetricCard label="待补档案" value={pending} icon={<IdcardOutlined />} />
          <MetricCard label="已归档" value={archived} icon={<SolutionOutlined />} />
          <MetricCard label="档案文件" value={fileCount} icon={<FileTextOutlined />} />
          <MetricCard label="待补文件" value={pendingFileCount} icon={<SafetyCertificateOutlined />} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField as="div" controlWidth="status-select" label="档案状态" variant="status">
              <Select
                value={archiveFilters.archiveStatus}
                options={[
                  { label: '全部', value: '全部' },
                  { label: '已齐全', value: '已齐全' },
                  { label: '待补充', value: '待补充' }
                ]}
                onChange={(archiveStatus: ArchiveSearchFilters['archiveStatus']) =>
                  setArchiveFilters((current) => ({
                    ...current,
                    archiveStatus
                  }))
                }
              />
            </FilterField>
            <FilterField as="div" controlWidth="status-select" label="文件状态" variant="status">
              <Select
                value={archiveFilters.fileStatus}
                options={[
                  { label: '全部', value: '全部' },
                  { label: '已上传', value: '已上传' },
                  { label: '待补充', value: '待补充' },
                  { label: '已归档', value: '已归档' }
                ]}
                onChange={(fileStatus: ArchiveSearchFilters['fileStatus']) =>
                  setArchiveFilters((current) => ({
                    ...current,
                    fileStatus
                  }))
                }
              />
            </FilterField>
            <KeywordFilter
              allowClear
              as="div"
              placeholder="工号 / 姓名 / 手机 / 岗位 / 学历"
              value={archiveFilters.keyword}
              width="wide"
              onChange={(keyword) =>
                setArchiveFilters((current) => ({
                  ...current,
                  keyword
                }))
              }
            />
          </FilterBar>
        </FilterPanel>
      }
    >
      <ManagementTable<PeopleMember>
        columns={columns}
        count={{ value: filteredMembers.length, unit: '人' }}
        dataSource={filteredMembers}
        primaryAction={{ icon: <PlusOutlined />, label: '新增人员', onClick: openCreateArchiveDrawer }}
        rowTestIdPrefix="people-archive-table-row"
        rowKey="id"
        tableTestId="people-archive-table"
        onRowClick={openArchiveDetail}
      />
      <ArchiveDetailDrawer
        member={activeMember}
        mode={archiveDrawerMode}
        open={detailOpen}
        onModeChange={setArchiveDrawerMode}
        positionOptions={activePositionOptions}
        workCalendarRows={workCalendarRows}
        onSave={saveArchiveMember}
        onClose={() => {
          setDetailOpen(false);
        }}
      />
    </ManagementPageScaffold>
  );
}
