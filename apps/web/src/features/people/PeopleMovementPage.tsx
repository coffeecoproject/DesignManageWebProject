import {
  AuditOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  SwapOutlined,
  UploadOutlined,
  UserSwitchOutlined
} from '@ant-design/icons';
import { DatePicker, Input, Modal, Select, Table, Tooltip, message } from 'antd';
import type { TableColumnsType } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import { AuditTrailSection } from '../../components/AuditTrailSection';
import type { AuditTrailRecord } from '../../components/AuditTrailTable';
import {
  DateScopeFilter,
  getDateScopeRange,
  type DateScopeFilterValue
} from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { DrawerShell } from '../../components/DrawerShell';
import { FileActionButtons } from '../../components/FileActionButtons';
import { FileSlot, FileSlotGrid } from '../../components/FileSlot';
import { FileUploadDropzone } from '../../components/FileUploadDropzone';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { FilterBar, FilterField, FilterPanel } from '../../components/FilterControls';
import {
  getMovementRequiredFileSlots,
  movementRequiredFileMaxSizeMb,
  type MovementRequiredFileSlot,
  type MovementRequiredFileSlotKey
} from './peopleFileSlotModel';
import {
  type PeopleMovementEffect,
  type PeopleMovementType,
  usePeopleOrganizationState
} from './PeopleOrganizationState';
import { applyPeopleMovementEffect, createPeopleMovementSnapshot, isPeopleMovementSnapshotEqual } from './peopleDomain';
import {
  createInitialPeopleMovementRows,
  createPeopleMovementRow,
  type PeopleMovementAttachment as MovementAttachment,
  type PeopleMovementRecordStatus as MovementRecordStatus,
  type PeopleMovementRecordType as MovementRecordType,
  type PeopleMovementRow as MovementRow
} from './peopleMovementRecordModel';
import type { PeopleArchiveFile, PeopleMember } from './peopleTypes';

type MovementDrawerMode = 'create' | 'detail';
type MovementRecordAction = 'void' | 'reverse';
type MovementActionResult = {
  message: string;
  ok: boolean;
};
type MovementTypeFilter = '全部' | MovementRecordType;
type MovementStatusFilter = '全部' | MovementRecordStatus;
type MovementFilters = {
  effectiveTime: DateScopeFilterValue;
  recordStatus: MovementStatusFilter;
  type: MovementTypeFilter;
};

const prototypeToday = '2026-06-11';
const prototypeCurrentMonth = prototypeToday.slice(0, 7);
const prototypeCurrentMonthRange = {
  endDate: `${prototypeCurrentMonth}-30`,
  startDate: `${prototypeCurrentMonth}-01`
};
const defaultMovementFilters: MovementFilters = {
  effectiveTime: { mode: 'all' },
  recordStatus: '全部',
  type: '全部'
};

const statusTone = {
  试用期: 'amber',
  在职: 'green',
  离职: 'gray',
  合作中: 'blue',
  结束合作: 'gray'
} as const;

const movementTypeTone = {
  转正: 'blue',
  薪资标准调整: 'amber',
  续签: 'blue',
  离职: 'gray',
  结束合作: 'gray',
  暂停任务参与: 'amber',
  恢复任务参与: 'blue',
  冲正: 'purple'
} as const;

const movementRecordStatusTone = {
  待生效: 'amber',
  已生效: 'green',
  已作废: 'gray',
  已冲正: 'purple'
} as const;

const movementSourceTone = {
  人事异动: 'blue',
  系统生成: 'gray',
  冲正: 'amber'
} as const;

const movementTypeFilterOptions: MovementTypeFilter[] = [
  '全部',
  '转正',
  '薪资标准调整',
  '续签',
  '离职',
  '结束合作',
  '暂停任务参与',
  '恢复任务参与',
  '冲正'
];

const movementStatusFilterOptions: MovementStatusFilter[] = ['全部', '待生效', '已生效', '已作废', '已冲正'];

const archiveFileStatusTone = {
  已上传: 'green',
  待补充: 'amber',
  已归档: 'gray'
} as const;

function PersonCell({ member, onClick }: { member: PeopleMember; onClick?: () => void }) {
  const content = <CompactCell primary={member.name} secondary={member.position} />;

  if (!onClick) {
    return content;
  }

  return (
    <button className="table-row-trigger" type="button" onClick={onClick}>
      {content}
    </button>
  );
}

function getUploadFileSize(file: UploadFile) {
  return file.size ?? file.originFileObj?.size ?? 0;
}

function normalizeDateString(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

function getMovementChangeText(record: Pick<MovementRow, 'afterValue' | 'beforeValue'>) {
  return `${record.beforeValue} -> ${record.afterValue}`;
}

function isMovementEffectiveAtInScope(effectiveAt: string, scope: DateScopeFilterValue) {
  const range = getDateScopeRange(scope, prototypeCurrentMonth);

  if (!range) {
    return true;
  }

  return effectiveAt >= range.startDate && effectiveAt <= range.endDate;
}

function movementMatchesFilters(record: MovementRow, filters: MovementFilters) {
  const matchesType = filters.type === '全部' || record.type === filters.type;
  const matchesStatus = filters.recordStatus === '全部' || record.recordStatus === filters.recordStatus;

  return matchesType && matchesStatus && isMovementEffectiveAtInScope(record.effectiveAt, filters.effectiveTime);
}

function isEffectiveDateReached(dateText: string) {
  return new Date(`${dateText}T00:00:00`).getTime() <= new Date(`${prototypeToday}T00:00:00`).getTime();
}

function getMovementTypeOptions(member: PeopleMember | undefined): PeopleMovementType[] {
  if (!member) {
    return [];
  }

  const taskAccessMovementTypes: PeopleMovementType[] =
    member.taskAccessStatus === '可参与任务' ? ['暂停任务参与'] : member.taskAccessStatus === '暂停参与' ? ['恢复任务参与'] : [];

  if (member.personnelType === '全职') {
    if (member.status === '离职') {
      return [];
    }

    const fulltimeTypes: PeopleMovementType[] =
      member.status === '试用期' ? ['转正', '薪资标准调整', '续签', '离职'] : ['薪资标准调整', '续签', '离职'];

    return [...fulltimeTypes, ...taskAccessMovementTypes];
  }

  if (member.status === '结束合作') {
    return [];
  }

  return ['薪资标准调整', '续签', '结束合作', ...taskAccessMovementTypes];
}

function getDefaultMovementType(member: PeopleMember | undefined): PeopleMovementType {
  return getMovementTypeOptions(member)[0] ?? '薪资标准调整';
}

function getCurrentSalaryText(member: PeopleMember) {
  if (member.personnelType === '兼职' || member.salaryProfile.taskRateRule) {
    return member.salaryProfile.taskRateRule ?? '按任务规则';
  }

  if (member.status === '试用期') {
    return member.salaryProfile.probationSalary ?? member.salaryProfile.regularSalary ?? '-';
  }

  return member.salaryProfile.regularSalary ?? member.salaryProfile.probationSalary ?? '-';
}

function getCurrentContractEndText(member: PeopleMember) {
  return member.personnelType === '兼职' ? member.cooperationEndAt ?? member.contractEndAt ?? '-' : member.contractEndAt ?? '-';
}

function getMovementTypeOptionLabel(type: PeopleMovementType) {
  if (type === '转正') {
    return '提前转正';
  }

  return type;
}

function getMovementEffectiveDateLabel(type: PeopleMovementType) {
  if (type === '转正') {
    return '提前转正日期';
  }

  const labels: Record<Exclude<PeopleMovementType, '转正'>, string> = {
    薪资标准调整: '生效日期',
    续签: '续签日期',
    离职: '离职日期',
    结束合作: '结束日期',
    暂停任务参与: '暂停日期',
    恢复任务参与: '恢复日期'
  };

  return labels[type];
}

function createMovementAttachmentFromFile(file: UploadFile, slot: MovementRequiredFileSlot): MovementAttachment {
  return {
    category: slot.category,
    id: `MOVFILE-${slot.key}-${file.uid || prototypeToday}`,
    name: file.name || slot.label,
    slotKey: slot.key,
    status: '已上传',
    updatedAt: prototypeToday
  };
}

function getMovementBeforeValue(member: PeopleMember, type: PeopleMovementType) {
  const fixedValues: Record<PeopleMovementType, string> = {
    转正: '全职 / 试用期',
    薪资标准调整: getCurrentSalaryText(member),
    续签: getCurrentContractEndText(member),
    离职: member.status === '试用期' ? '全职 / 试用期' : '全职 / 在职',
    结束合作: '兼职 / 合作中',
    暂停任务参与: '可参与任务',
    恢复任务参与: '暂停参与'
  };

  return fixedValues[type];
}

function getMovementAfterValue({
  member,
  newContractEndAt,
  newSalaryText,
  type
}: {
  member: PeopleMember;
  newContractEndAt: string;
  newSalaryText: string;
  type: PeopleMovementType;
}) {
  const fixedValues: Record<PeopleMovementType, string> = {
    转正: '全职 / 正式',
    薪资标准调整: newSalaryText.trim() || (member.personnelType === '兼职' ? '新任务规则待填写' : '新基础薪资待填写'),
    续签: newContractEndAt || '新结束日期待选择',
    离职: '全职 / 离职',
    结束合作: '兼职 / 结束合作',
    暂停任务参与: '暂停参与',
    恢复任务参与: '可参与任务'
  };

  return fixedValues[type];
}

function getMovementSummary(type: PeopleMovementType) {
  if (type === '转正') {
    return '提前转正';
  }

  const summaries: Record<Exclude<PeopleMovementType, '转正'>, string> = {
    薪资标准调整: '调整长期薪资标准',
    续签: '更新合同/协议结束日期',
    离职: '结束全职任职关系',
    结束合作: '结束外部合作关系',
    暂停任务参与: '暂停任务参与资格',
    恢复任务参与: '恢复任务参与资格'
  };

  return summaries[type];
}

function getMovementReasonLabel(type: PeopleMovementType) {
  const labels: Record<PeopleMovementType, string> = {
    转正: '转正说明',
    薪资标准调整: '备注',
    续签: '备注',
    离职: '离职原因',
    结束合作: '结束原因',
    暂停任务参与: '备注',
    恢复任务参与: '备注'
  };

  return labels[type];
}

function isMovementReasonRequired(type: PeopleMovementType) {
  return type === '离职' || type === '结束合作';
}

function getMovementDefaultNote({
  recordStatus,
  type
}: {
  recordStatus: MovementRecordStatus;
  type: PeopleMovementType;
}) {
  if (type === '转正') {
    return '提前转正';
  }

  return recordStatus === '已生效' ? '即时生效异动' : '待生效异动';
}

function isMovementRecordAfter(candidate: MovementRow, baseRecord: MovementRow) {
  if (candidate.effectiveAt !== baseRecord.effectiveAt) {
    return candidate.effectiveAt > baseRecord.effectiveAt;
  }

  if (candidate.updatedAt !== baseRecord.updatedAt) {
    return candidate.updatedAt > baseRecord.updatedAt;
  }

  return candidate.id > baseRecord.id;
}

function hasLaterEffectiveMovementRecord(record: MovementRow, records: MovementRow[]) {
  return records.some(
    (candidate) =>
      candidate.id !== record.id &&
      candidate.member.id === record.member.id &&
      candidate.recordStatus === '已生效' &&
      candidate.type !== '冲正' &&
      isMovementRecordAfter(candidate, record)
  );
}

function getMovementActionRestriction({
  currentMember,
  record,
  records
}: {
  currentMember?: PeopleMember;
  record: MovementRow;
  records: MovementRow[];
}) {
  if (record.recordStatus !== '已生效') {
    return undefined;
  }

  if (record.type === '冲正') {
    return '冲正记录不能再次冲正';
  }

  if (!record.beforeMemberSnapshot || !record.afterMemberSnapshot) {
    return '缺少生效前后快照，需人工更正';
  }

  if (hasLaterEffectiveMovementRecord(record, records)) {
    return '存在同人员后续已生效异动，请先处理后续记录';
  }

  if (!currentMember || !isPeopleMovementSnapshotEqual(currentMember, record.afterMemberSnapshot)) {
    return '当前人员主数据已变化，不能自动冲正';
  }

  return undefined;
}

function getMovementRecordAction({
  currentMember,
  record,
  records
}: {
  currentMember?: PeopleMember;
  record?: MovementRow;
  records: MovementRow[];
}): { disabled?: boolean; disabledReason?: string; label: string; type: MovementRecordAction } | undefined {
  if (!record) {
    return undefined;
  }

  if (record.recordStatus === '待生效') {
    return { label: '作废异动', type: 'void' };
  }

  if (record.recordStatus !== '已生效' || record.type === '冲正') {
    return undefined;
  }

  const disabledReason = getMovementActionRestriction({ currentMember, record, records });

  return {
    disabled: Boolean(disabledReason),
    disabledReason,
    label: '发起冲正',
    type: 'reverse'
  };
}

function createMovementReversalRow(record: MovementRow, currentMember: PeopleMember, reason: string): MovementRow {
  return createPeopleMovementRow({
    afterMemberSnapshot: record.beforeMemberSnapshot,
    afterValue: record.beforeValue,
    beforeMemberSnapshot: createPeopleMovementSnapshot(currentMember),
    beforeValue: record.afterValue,
    effectiveAt: prototypeToday,
    files: [],
    id: `MOV-REV-${record.id}-${String(Date.now()).slice(-6)}`,
    member: currentMember,
    note: `冲正原异动 ${record.id}：${reason}`,
    recordStatus: '已生效',
    recorder: '李明',
    reversalReason: reason,
    reversesId: record.id,
    source: '冲正',
    summary: `冲正：${record.summary}`,
    type: '冲正',
    updatedAt: prototypeToday
  });
}

function getMovementAuditTrailRecords(record: MovementRow): AuditTrailRecord[] {
  const hasPendingFile = record.files.some((file) => file.status === '待补充');
  const records: AuditTrailRecord[] = [
    {
      time: record.updatedAt,
      actor: record.recorder,
      object: `${record.member.name} / ${record.type}`,
      action: record.source === '冲正' ? '冲正异动' : '记录异动',
      summary: `${record.beforeValue} -> ${record.afterValue}`,
      result: record.recordStatus,
      source: record.source,
      note: record.note
    }
  ];

  if (record.voidReason) {
    records.push({
      time: record.voidedAt ?? record.updatedAt,
      actor: record.voidedBy ?? record.recorder,
      object: `${record.member.name} / ${record.type}`,
      action: '作废异动',
      summary: '待生效异动已作废',
      result: '已作废',
      source: '人事异动',
      note: record.voidReason
    });
  }

  if (record.reversedById && record.reversalReason) {
    records.push({
      time: record.reversedAt ?? record.updatedAt,
      actor: record.reversedBy ?? record.recorder,
      object: `${record.member.name} / ${record.type}`,
      action: '冲正标记',
      summary: `生成冲正记录 ${record.reversedById}`,
      result: '已冲正',
      source: '冲正',
      note: record.reversalReason
    });
  }

  if (record.files.length > 0) {
    records.push({
      time: record.updatedAt,
      actor: record.recorder,
      object: `${record.member.name} / ${record.type}`,
      action: '维护凭证文件',
      summary: `关联 ${record.files.length} 份凭证文件`,
      result: hasPendingFile ? '待生效' : '成功',
      source: record.source,
      note: record.files.map((file) => file.name).join(' / ')
    });
  }

  return records;
}

function MovementRecordDrawer({
  mode,
  movementRows,
  open,
  peopleRows,
  record,
  onClose,
  onApplyEffect,
  onReverseRecord,
  onSave,
  onVoidRecord
}: {
  mode: MovementDrawerMode;
  movementRows: MovementRow[];
  open: boolean;
  peopleRows: PeopleMember[];
  record?: MovementRow;
  onClose: () => void;
  onApplyEffect: (effect: PeopleMovementEffect) => void;
  onReverseRecord: (recordId: string, reason: string) => MovementActionResult;
  onSave: (record: MovementRow) => void;
  onVoidRecord: (recordId: string, reason: string) => MovementActionResult;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedMemberId, setSelectedMemberId] = useState(peopleRows[0]?.id ?? '');
  const [movementType, setMovementType] = useState<PeopleMovementType>('薪资标准调整');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [newSalaryText, setNewSalaryText] = useState('');
  const [newContractEndAt, setNewContractEndAt] = useState('');
  const [note, setNote] = useState('');
  const [recordAction, setRecordAction] = useState<{ reason: string; record: MovementRow; type: MovementRecordAction }>();
  const [movementRequiredFiles, setMovementRequiredFiles] = useState<Partial<Record<MovementRequiredFileSlotKey, UploadFile>>>({});
  const [movementSupplementalFiles, setMovementSupplementalFiles] = useState<UploadFile[]>([]);
  const selectedMember = peopleRows.find((member) => member.id === selectedMemberId) ?? peopleRows[0];
  const availableMovementTypes = useMemo(() => getMovementTypeOptions(selectedMember), [selectedMember]);
  const hasAvailableMovementTypes = availableMovementTypes.length > 0;
  const canUseMovementType = availableMovementTypes.includes(movementType);
  const requiredMovementFileSlots = useMemo(
    () => (canUseMovementType ? getMovementRequiredFileSlots(selectedMember, movementType) : []),
    [canUseMovementType, movementType, selectedMember]
  );
  const missingMovementFileLabels = requiredMovementFileSlots.filter((slot) => !movementRequiredFiles[slot.key]).map((slot) => slot.label);
  const reasonRequired = canUseMovementType ? isMovementReasonRequired(movementType) : false;
  const movementBeforeValue = selectedMember && canUseMovementType ? getMovementBeforeValue(selectedMember, movementType) : '';
  const movementAfterValue =
    selectedMember && canUseMovementType
      ? getMovementAfterValue({
          member: selectedMember,
          newContractEndAt,
          newSalaryText,
          type: movementType
        })
    : '';
  const movementSummary = canUseMovementType ? getMovementSummary(movementType) : '';
  const movementReasonLabel = canUseMovementType ? getMovementReasonLabel(movementType) : '备注';
  const detailRecord = mode === 'detail' ? record : undefined;
  const detailRecordFiles = detailRecord?.files ?? [];
  const profileMember = detailRecord ? peopleRows.find((member) => member.id === detailRecord.member.id) ?? detailRecord.member : selectedMember;
  const detailRecordAction = getMovementRecordAction({
    currentMember: profileMember,
    record: detailRecord,
    records: movementRows
  });
  const isCreateMovementDisabled =
    !hasAvailableMovementTypes ||
    !canUseMovementType ||
    !effectiveAt ||
    (movementType === '薪资标准调整' && !newSalaryText.trim()) ||
    (movementType === '续签' && !newContractEndAt) ||
    (reasonRequired && !note.trim()) ||
    missingMovementFileLabels.length > 0;

  useEffect(() => {
    if (!open || mode !== 'create') {
      return;
    }

    const firstMember = peopleRows[0];

    if (!firstMember) {
      return;
    }

    setSelectedMemberId(firstMember.id);
    setMovementType(getDefaultMovementType(firstMember));
    setEffectiveAt('');
    setNewSalaryText('');
    setNewContractEndAt('');
    setNote('');
    setMovementRequiredFiles({});
    setMovementSupplementalFiles([]);
  }, [mode, open, peopleRows]);

  useEffect(() => {
    if (!open) {
      setRecordAction(undefined);
    }
  }, [open]);

  if (mode === 'detail' && !detailRecord) {
    return null;
  }

  function handleSelectedMemberChange(memberId: string) {
    const nextMember = peopleRows.find((member) => member.id === memberId);

    setSelectedMemberId(memberId);

    if (nextMember) {
      setMovementType(getDefaultMovementType(nextMember));
      setNewSalaryText('');
      setNewContractEndAt('');
      setNote('');
      setMovementRequiredFiles({});
      setMovementSupplementalFiles([]);
    }
  }

  function handleMovementTypeChange(type: PeopleMovementType) {
    setMovementType(type);
    setNewSalaryText('');
    setNewContractEndAt('');
    setNote('');
    setMovementRequiredFiles({});
    setMovementSupplementalFiles([]);
  }

  function handleMovementRequiredFileUpload(slot: MovementRequiredFileSlot, file: UploadFile) {
    const fileSize = getUploadFileSize(file);
    const maxSize = slot.maxSizeMb * 1024 * 1024;

    if (fileSize > maxSize) {
      void messageApi.warning(`${slot.label}不能超过 ${slot.maxSizeMb}MB`);
      return;
    }

    setMovementRequiredFiles((currentFiles) => ({
      ...currentFiles,
      [slot.key]: file
    }));
    void messageApi.success(`${slot.label}已选择`);
  }

  function handleMovementRequiredFileDelete(slot: MovementRequiredFileSlot) {
    setMovementRequiredFiles((currentFiles) => {
      const nextFiles = { ...currentFiles };
      delete nextFiles[slot.key];
      return nextFiles;
    });
  }

  function handleMovementSupplementalUploadChange(fileList: UploadFile[]) {
    const maxSize = movementRequiredFileMaxSizeMb * 1024 * 1024;
    const acceptedFiles = fileList.filter((file) => getUploadFileSize(file) <= maxSize);

    if (acceptedFiles.length !== fileList.length) {
      void messageApi.warning(`补充附件单个文件不能超过 ${movementRequiredFileMaxSizeMb}MB`);
    }

    setMovementSupplementalFiles(acceptedFiles);
  }

  function getMovementAttachments(member: PeopleMember): MovementAttachment[] {
    const requiredFiles = requiredMovementFileSlots
      .map((slot) => {
        const file = movementRequiredFiles[slot.key];
        return file ? createMovementAttachmentFromFile(file, slot) : undefined;
      })
      .filter((file): file is MovementAttachment => Boolean(file));
    const supplementalFiles = movementSupplementalFiles.map((file, index): MovementAttachment => ({
      category: member.personnelType === '兼职' ? '合作资料' : '合同协议',
      id: `MOVFILE-SUP-${file.uid || index}`,
      name: file.name || `补充附件-${index + 1}`,
      status: '已上传',
      updatedAt: prototypeToday
    }));

    return [...requiredFiles, ...supplementalFiles];
  }

  function handleCreateMovementRecord() {
    if (!selectedMember) {
      void messageApi.warning('请选择人员');
      return;
    }

    if (!availableMovementTypes.includes(movementType)) {
      void messageApi.warning('当前人员状态暂无可发起异动');
      return;
    }

    if (!effectiveAt) {
      void messageApi.warning('请选择生效日期');
      return;
    }

    if (movementType === '薪资标准调整' && !newSalaryText.trim()) {
      void messageApi.warning(selectedMember.personnelType === '兼职' ? '请输入新任务规则' : '请输入新基础薪资');
      return;
    }

    if (movementType === '续签' && !newContractEndAt) {
      void messageApi.warning('请选择新的结束日期');
      return;
    }

    if (reasonRequired && !note.trim()) {
      void messageApi.warning(`请输入${movementReasonLabel}`);
      return;
    }

    if (missingMovementFileLabels.length > 0) {
      void messageApi.warning(`请上传${missingMovementFileLabels.join('、')}`);
      return;
    }

    const recordStatus: MovementRecordStatus = isEffectiveDateReached(effectiveAt) ? '已生效' : '待生效';
    const movementEffect: PeopleMovementEffect = {
      effectiveAt,
      memberId: selectedMember.id,
      newContractEndAt,
      newSalaryText,
      type: movementType
    };
    const afterMember = applyPeopleMovementEffect(selectedMember, movementEffect, { today: prototypeToday });
    const movementSnapshots = {
      afterMemberSnapshot: createPeopleMovementSnapshot(afterMember),
      beforeMemberSnapshot: createPeopleMovementSnapshot(selectedMember)
    };
    const nextRecord = createPeopleMovementRow({
      ...movementSnapshots,
      afterValue: movementAfterValue,
      beforeValue: movementBeforeValue,
      effectiveAt,
      files: getMovementAttachments(selectedMember),
      id: `MOV-${String(Date.now()).slice(-6)}`,
      member: selectedMember,
      note: note.trim() || getMovementDefaultNote({ recordStatus, type: movementType }),
      recordStatus,
      recorder: '李明',
      source: '人事异动',
      summary: movementSummary,
      type: movementType,
      updatedAt: prototypeToday
    });

    if (recordStatus === '已生效') {
      onApplyEffect(movementEffect);
    }

    onSave(nextRecord);
    void messageApi.success(recordStatus === '已生效' ? '异动已生效' : '异动已发起');
  }

  function openMovementRecordAction(type: MovementRecordAction, actionRecord: MovementRow) {
    setRecordAction({ reason: '', record: actionRecord, type });
  }

  function handleConfirmMovementRecordAction() {
    if (!recordAction) {
      return;
    }

    const reason = recordAction.reason.trim();

    if (!reason) {
      void messageApi.warning(recordAction.type === 'reverse' ? '请输入冲正原因' : '请输入作废原因');
      return;
    }

    const result = recordAction.type === 'reverse' ? onReverseRecord(recordAction.record.id, reason) : onVoidRecord(recordAction.record.id, reason);

    if (!result.ok) {
      void messageApi.warning(result.message);
      return;
    }

    setRecordAction(undefined);
    void messageApi.success(result.message);
  }

  const movementFileColumns: TableColumnsType<MovementAttachment> = [
    {
      title: '文件名称',
      key: 'name',
      width: 220,
      render: (_, file) => (
        <div className="detail-table-main">
          <span>{file.name}</span>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'category',
      align: 'center',
      width: 96
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
      width: 112,
      render: (_, file) => (
        <FileActionButtons
          record={file}
          onDownload={(record) => {
            void messageApi.info(`原型下载：${record.name}`);
          }}
          onPreview={(record) => {
            void messageApi.info(`原型预览：${record.name}`);
          }}
        />
      )
    }
  ];
  const detailSecondaryAction =
    detailRecord && detailRecordAction
      ? {
          danger: true,
          disabled: detailRecordAction.disabled,
          icon: detailRecordAction.type === 'reverse' ? <SwapOutlined /> : <CloseCircleOutlined />,
          label: detailRecordAction.label,
          onClick: () => openMovementRecordAction(detailRecordAction.type, detailRecord)
        }
      : undefined;

  return (
    <>
      {contextHolder}
      <DrawerShell
        cancelAction={
          mode === 'create'
            ? {
                label: '取消',
                onClick: onClose
              }
            : undefined
        }
        className="people-detail-drawer people-movement-drawer"
        closeAction={
          mode === 'detail'
            ? {
                label: '关闭',
                onClick: onClose
              }
            : undefined
        }
        contentLayout="detail"
        destroyOnHidden
        open={open}
        primaryAction={
          mode === 'create'
            ? {
                disabled: isCreateMovementDisabled,
                label: '发起异动',
                onClick: handleCreateMovementRecord
              }
            : undefined
        }
        secondaryAction={mode === 'detail' ? detailSecondaryAction : undefined}
        title={
          <DetailDrawerTitle
            status={detailRecord?.recordStatus}
            statusToneMap={movementRecordStatusTone}
            subtitle="人员组织 / 人事异动"
            title={mode === 'create' ? '发起异动' : '异动详情'}
          />
        }
        width={760}
        onClose={onClose}
      >
          {profileMember ? (
            <DrawerProfileCard
              avatar={profileMember.name.slice(-1)}
              subtitle={`${profileMember.id} / ${profileMember.position}`}
              tags={[
                detailRecord ? <StatusTag key="movementType" toneMap={movementTypeTone} value={detailRecord.type} /> : null,
                <StatusTag key="status" tone={statusTone[profileMember.status]} value={`${profileMember.personnelType} / ${profileMember.status}`} />
              ]}
              title={profileMember.name}
            />
          ) : null}

          {mode === 'create' ? (
            <DetailSection icon={<SwapOutlined />} title="异动信息">
              <DrawerFormGrid>
                <DrawerFormField required label="人员">
                  <Select
                    showSearch
                    value={selectedMemberId}
                    options={peopleRows.map((member) => ({
                      label: `${member.name} / ${member.id}`,
                      value: member.id
                    }))}
                    onChange={handleSelectedMemberChange}
                  />
                </DrawerFormField>
                {hasAvailableMovementTypes ? (
                  <>
                    <DrawerFormField required label="异动类型">
                      <Select
                        value={canUseMovementType ? movementType : undefined}
                        options={availableMovementTypes.map((type) => ({ label: getMovementTypeOptionLabel(type), value: type }))}
                        onChange={handleMovementTypeChange}
                      />
                    </DrawerFormField>
                    {canUseMovementType ? (
                      <>
                        <DrawerFormField required label={getMovementEffectiveDateLabel(movementType)}>
                          <DatePicker
                            format="YYYY-MM-DD"
                            placeholder="选择日期"
                            onChange={(_, dateString) => setEffectiveAt(normalizeDateString(dateString))}
                          />
                        </DrawerFormField>
                        {movementType === '薪资标准调整' ? (
                          <DrawerFormField required wide label={selectedMember?.personnelType === '兼职' ? '新任务规则' : '新基础薪资'}>
                            <Input
                              placeholder={selectedMember?.personnelType === '兼职' ? '例如：按任务规则 1.5 倍' : '例如：12000 元/月'}
                              value={newSalaryText}
                              onChange={(event) => setNewSalaryText(event.target.value)}
                            />
                          </DrawerFormField>
                        ) : null}
                        {movementType === '续签' ? (
                          <DrawerFormField required label="新的结束日期">
                            <DatePicker
                              format="YYYY-MM-DD"
                              placeholder="选择日期"
                              onChange={(_, dateString) => setNewContractEndAt(normalizeDateString(dateString))}
                            />
                          </DrawerFormField>
                        ) : null}
                        <DrawerFormField label="变更前">
                          <Input readOnly value={movementBeforeValue} />
                        </DrawerFormField>
                        <DrawerFormField label="变更后">
                          <Input readOnly value={movementAfterValue} />
                        </DrawerFormField>
                        <DrawerFormField required={reasonRequired} wide label={movementReasonLabel}>
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 3 }}
                            placeholder={reasonRequired ? `请输入${movementReasonLabel}` : '可补充附件、沟通记录或来源说明'}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                          />
                        </DrawerFormField>
                      </>
                    ) : null}
                  </>
                ) : (
                  <DrawerFormField wide label="异动限制">
                    <div className="movement-rule-hint">当前人员状态暂无可发起异动。</div>
                  </DrawerFormField>
                )}
              </DrawerFormGrid>
            </DetailSection>
          ) : null}

          {mode === 'create' && requiredMovementFileSlots.length > 0 ? (
            <DetailSection icon={<UploadOutlined />} title="异动凭证">
              <FileSlotGrid>
                {requiredMovementFileSlots.map((slot) => {
                  const file = movementRequiredFiles[slot.key];

                  return (
                    <FileSlot
                      accept={slot.accept}
                      description={slot.description}
                      file={file ? { id: file.uid, name: file.name, status: '已上传' } : undefined}
                      key={slot.key}
                      status={file ? '已上传' : '未上传'}
                      statusTone={file ? archiveFileStatusTone['已上传'] : 'amber'}
                      title={slot.label}
                      onPreview={(previewFile) => {
                        void messageApi.info(`原型预览：${previewFile.name}`);
                      }}
                      onRemove={() => handleMovementRequiredFileDelete(slot)}
                      onSelect={(uploadFile) => handleMovementRequiredFileUpload(slot, uploadFile)}
                    />
                  );
                })}
              </FileSlotGrid>

              <FileUploadDropzone
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                description="交接单、申请单、沟通记录等资料可按需上传，不影响必填凭证校验。"
                fileList={movementSupplementalFiles}
                multiple
                title="补充附件"
                uploadText="上传补充附件"
                onChange={handleMovementSupplementalUploadChange}
              />
            </DetailSection>
          ) : detailRecord ? (
            <>
              <DetailSummaryCards
                columns={4}
                items={[
                  {
                    icon: <SwapOutlined />,
                    key: 'movementType',
                    label: '异动类型',
                    value: <StatusTag toneMap={movementTypeTone} value={detailRecord.type} />
                  },
                  {
                    icon: <AuditOutlined />,
                    key: 'recordStatus',
                    label: '异动状态',
                    value: <StatusTag toneMap={movementRecordStatusTone} value={detailRecord.recordStatus} />
                  },
                  { icon: <ClockCircleOutlined />, key: 'effectiveAt', label: '生效日期', value: detailRecord.effectiveAt },
                  {
                    icon: <UserSwitchOutlined />,
                    key: 'change',
                    label: '变更前后',
                    value: (
                      <Tooltip title={getMovementChangeText(detailRecord)}>
                        <span>{getMovementChangeText(detailRecord)}</span>
                      </Tooltip>
                    )
                  }
                ]}
              />
              <DetailTabs
                defaultActiveKey="summary"
                key={detailRecord.id}
                tabTestIdPrefix="people-movement-detail-tab"
                testId="people-movement-detail-tabs"
                items={[
                  {
                    key: 'summary',
                    label: '异动信息',
                    children: (
                      <DetailSection icon={<SwapOutlined />} title="基础信息">
                        <DetailInfoGrid
                          columns={2}
                          items={[
                            { label: '工号', value: detailRecord.member.id },
                            { label: '人员', value: profileMember?.name ?? detailRecord.member.name },
                            {
                              label: '员工类别',
                              value: profileMember ? `${profileMember.personnelType} / ${profileMember.status}` : `${detailRecord.member.personnelType} / ${detailRecord.member.status}`
                            },
                            { label: '事项', value: <StatusTag toneMap={movementTypeTone} value={detailRecord.type} /> },
                            {
                              label: '状态',
                              value: <StatusTag toneMap={movementRecordStatusTone} value={detailRecord.recordStatus} />
                            },
                            { label: '生效日期', value: detailRecord.effectiveAt },
                            { label: '发起来源', value: <StatusTag toneMap={movementSourceTone} value={detailRecord.source} /> },
                            { label: '记录人', value: detailRecord.recorder },
                            { label: '最近更新', value: detailRecord.updatedAt },
                            ...(detailRecord.voidReason ? [{ label: '作废原因', value: detailRecord.voidReason }] : []),
                            ...(detailRecord.reversedById ? [{ label: '冲正记录', value: detailRecord.reversedById }] : []),
                            ...(detailRecord.reversesId ? [{ label: '原异动记录', value: detailRecord.reversesId }] : [])
                          ]}
                        />
                      </DetailSection>
                    )
                  },
                  {
                    key: 'change',
                    label: '变更前后',
                    children: (
                      <DetailSection icon={<UserSwitchOutlined />} title="变更前后">
                        <DetailInfoGrid
                          columns={2}
                          items={[
                            { label: '变更前', value: detailRecord.beforeValue },
                            { label: '变更后', value: detailRecord.afterValue },
                            { label: '备注', value: detailRecord.note },
                            ...(detailRecord.reversalReason ? [{ label: '冲正原因', value: detailRecord.reversalReason }] : [])
                          ]}
                        />
                      </DetailSection>
                    )
                  },
                  ...(detailRecordFiles.length > 0
                    ? [
                        {
                          key: 'files',
                          label: '凭证文件',
                          children: (
                            <DetailSection icon={<UploadOutlined />} title="凭证文件">
                              <Table<MovementAttachment>
                                className="detail-table"
                                columns={movementFileColumns}
                                dataSource={detailRecordFiles}
                                pagination={false}
                                rowKey="id"
                                scroll={{ x: 628 }}
                                size="small"
                              />
                            </DetailSection>
                          )
                        }
                      ]
                    : []),
                  {
                    key: 'logs',
                    label: '处理记录',
                    children: (
                      <AuditTrailSection
                        icon={<AuditOutlined />}
                        records={getMovementAuditTrailRecords(detailRecord)}
                        summaryTitle="处理内容"
                        title="处理记录"
                      />
                    )
                  }
                ]}
              />
            </>
          ) : null}
      </DrawerShell>
      <Modal
        destroyOnHidden
        okButtonProps={{ danger: true, disabled: !recordAction?.reason.trim() }}
        okText={recordAction?.type === 'reverse' ? '确认冲正' : '确认作废'}
        open={Boolean(recordAction)}
        title={recordAction?.type === 'reverse' ? '确认冲正异动' : '确认作废异动'}
        onCancel={() => setRecordAction(undefined)}
        onOk={handleConfirmMovementRecordAction}
      >
        <DetailInfoGrid
          columns={1}
          items={[
            { label: '异动记录', value: recordAction ? `${recordAction.record.member.name} / ${recordAction.record.id}` : '-' },
            { label: '异动内容', value: recordAction ? `${recordAction.record.beforeValue} -> ${recordAction.record.afterValue}` : '-' }
          ]}
        />
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 4 }}
          placeholder={recordAction?.type === 'reverse' ? '请输入冲正原因' : '请输入作废原因'}
          value={recordAction?.reason ?? ''}
          onChange={(event) =>
            setRecordAction((currentAction) => (currentAction ? { ...currentAction, reason: event.target.value } : currentAction))
          }
        />
      </Modal>
    </>
  );
}

export function PeopleMovementPage() {
  const { applyMovementEffect, peopleRows, restoreMovementSnapshot } = usePeopleOrganizationState();
  const [movementRows, setMovementRows] = useState<MovementRow[]>(() => createInitialPeopleMovementRows(peopleRows));
  const [activeMovement, setActiveMovement] = useState<MovementRow>();
  const [filters, setFilters] = useState<MovementFilters>(defaultMovementFilters);
  const [movementDrawerMode, setMovementDrawerMode] = useState<MovementDrawerMode>('detail');
  const [movementDrawerOpen, setMovementDrawerOpen] = useState(false);
  const memberById = useMemo(() => new Map(peopleRows.map((member) => [member.id, member])), [peopleRows]);
  const displayMovementRows = useMemo(
    () =>
      movementRows.map((row) => {
        const latestMember = memberById.get(row.member.id);
        return latestMember ? { ...row, member: latestMember } : row;
      }),
    [memberById, movementRows]
  );
  const pendingCount = displayMovementRows.filter((row) => row.recordStatus === '待生效').length;
  const effectiveCount = displayMovementRows.filter((row) => row.recordStatus === '已生效').length;
  const closedCount = displayMovementRows.filter((row) => row.recordStatus === '已作废' || row.recordStatus === '已冲正').length;
  const filteredMovementRows = useMemo(
    () => displayMovementRows.filter((row) => movementMatchesFilters(row, filters)),
    [displayMovementRows, filters]
  );

  function openCreateMovementDrawer() {
    setMovementDrawerMode('create');
    setActiveMovement(undefined);
    setMovementDrawerOpen(true);
  }

  function openMovementDetail(record: MovementRow) {
    setMovementDrawerMode('detail');
    setActiveMovement(record);
    setMovementDrawerOpen(true);
  }

  function saveMovementRecord(record: MovementRow) {
    setMovementRows((currentRows) => [record, ...currentRows]);
    setActiveMovement(record);
    setMovementDrawerMode('detail');
    setMovementDrawerOpen(true);
  }

  function voidMovementRecord(recordId: string, reason: string): MovementActionResult {
    const targetRecord = movementRows.find((row) => row.id === recordId);

    if (!targetRecord) {
      return { message: '未找到异动记录', ok: false };
    }

    if (targetRecord.recordStatus !== '待生效') {
      return { message: '只有待生效异动可以作废', ok: false };
    }

    const nextRecord: MovementRow = {
      ...targetRecord,
      recordStatus: '已作废',
      updatedAt: prototypeToday,
      voidedAt: prototypeToday,
      voidedBy: '李明',
      voidReason: reason
    };

    setMovementRows((currentRows) => currentRows.map((row) => (row.id === recordId ? nextRecord : row)));
    setActiveMovement(nextRecord);

    return { message: '异动已作废', ok: true };
  }

  function reverseMovementRecord(recordId: string, reason: string): MovementActionResult {
    const targetRecord = movementRows.find((row) => row.id === recordId);
    const currentMember = targetRecord ? peopleRows.find((member) => member.id === targetRecord.member.id) : undefined;

    if (!targetRecord) {
      return { message: '未找到异动记录', ok: false };
    }

    if (targetRecord.recordStatus !== '已生效' || targetRecord.type === '冲正') {
      return { message: '当前异动不能冲正', ok: false };
    }

    const restriction = getMovementActionRestriction({
      currentMember,
      record: targetRecord,
      records: movementRows
    });

    if (restriction) {
      return { message: restriction, ok: false };
    }

    if (!currentMember || !targetRecord.beforeMemberSnapshot) {
      return { message: '缺少可恢复的主数据快照', ok: false };
    }

    const reversalRecord = createMovementReversalRow(targetRecord, currentMember, reason);
    const reversedRecord: MovementRow = {
      ...targetRecord,
      recordStatus: '已冲正',
      reversedAt: prototypeToday,
      reversedBy: '李明',
      reversedById: reversalRecord.id,
      reversalReason: reason,
      updatedAt: prototypeToday
    };

    restoreMovementSnapshot(targetRecord.member.id, targetRecord.beforeMemberSnapshot, {
      actor: '李明',
      effectiveAt: prototypeToday,
      reason,
      sourceRecordId: targetRecord.id
    });
    setMovementRows((currentRows) => [reversalRecord, ...currentRows.map((row) => (row.id === recordId ? reversedRecord : row))]);
    setActiveMovement(reversalRecord);

    return { message: '异动已冲正', ok: true };
  }

  const columns: TableColumnsType<MovementRow> = [
    {
      title: '工号',
      key: 'workNo',
      align: 'center',
      width: 96,
      render: (_, record) => <CellText>{record.member.id}</CellText>
    },
    {
      title: '人员',
      key: 'person',
      width: 150,
      render: (_, record) => <PersonCell member={record.member} />
    },
    {
      title: '事项',
      key: 'movementType',
      align: 'center',
      width: 118,
      render: (_, record) => <StatusTag toneMap={movementTypeTone} value={record.type} />
    },
    {
      title: '状态',
      key: 'recordStatus',
      align: 'center',
      width: 102,
      render: (_, record) => <StatusTag toneMap={movementRecordStatusTone} value={record.recordStatus} />
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveAt',
      align: 'center',
      width: 112
    },
    {
      title: '变更前后',
      key: 'change',
      width: 260,
      render: (_, record) => (
        <CompactCell
          primarySlot={
            <Tooltip title={getMovementChangeText(record)}>
              <span>{getMovementChangeText(record)}</span>
            </Tooltip>
          }
        />
      )
    },
    {
      title: '记录信息',
      key: 'recordInfo',
      align: 'center',
      width: 130,
      render: (_, record) => <CompactCell align="center" primarySlot={<StatusTag toneMap={movementSourceTone} value={record.source} />} secondary={record.recorder} />
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      align: 'center',
      width: 108
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={4}>
          <MetricCard label="异动记录" value={movementRows.length} icon={<SwapOutlined />} />
          <MetricCard label="待处理" value={pendingCount} icon={<ClockCircleOutlined />} />
          <MetricCard label="已生效" value={effectiveCount} icon={<UserSwitchOutlined />} />
          <MetricCard label="已关闭" value={closedCount} icon={<AuditOutlined />} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <DateScopeFilter
              defaultMonth={prototypeCurrentMonth}
              defaultRange={prototypeCurrentMonthRange}
              testIdPrefix="people-movement-effective-time-filter"
              value={filters.effectiveTime}
              onChange={(effectiveTime) => setFilters((current) => ({ ...current, effectiveTime }))}
            />
            <FilterField as="div" label="异动类型" variant="type">
              <Select
                data-testid="people-movement-type-filter"
                options={movementTypeFilterOptions.map((type) => ({ label: type, value: type }))}
                value={filters.type}
                onChange={(type: MovementTypeFilter) => setFilters((current) => ({ ...current, type }))}
              />
            </FilterField>
            <FilterField as="div" controlWidth="status-select" label="状态" variant="status">
              <Select
                data-testid="people-movement-status-filter"
                options={movementStatusFilterOptions.map((recordStatus) => ({ label: recordStatus, value: recordStatus }))}
                value={filters.recordStatus}
                onChange={(recordStatus: MovementStatusFilter) => setFilters((current) => ({ ...current, recordStatus }))}
              />
            </FilterField>
          </FilterBar>
        </FilterPanel>
      }
    >
      <ManagementTable<MovementRow>
        columns={columns}
        count={{ value: filteredMovementRows.length, unit: '条' }}
        dataSource={filteredMovementRows}
        primaryAction={{ icon: <PlusOutlined />, label: '发起异动', onClick: openCreateMovementDrawer }}
        rowTestIdPrefix="people-movement-table-row"
        rowKey="id"
        tableTestId="people-movement-table"
        onRowClick={openMovementDetail}
      />
      <MovementRecordDrawer
        mode={movementDrawerMode}
        movementRows={displayMovementRows}
        open={movementDrawerOpen}
        peopleRows={peopleRows}
        record={activeMovement}
        onApplyEffect={applyMovementEffect}
        onReverseRecord={reverseMovementRecord}
        onSave={saveMovementRecord}
        onVoidRecord={voidMovementRecord}
        onClose={() => {
          setMovementDrawerOpen(false);
        }}
      />
    </ManagementPageScaffold>
  );
}
