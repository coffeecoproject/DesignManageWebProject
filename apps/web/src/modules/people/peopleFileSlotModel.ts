import type { PositionManagementFile } from './PeopleOrganizationState';
import type { PeopleArchiveFile, PeopleMember } from './peopleTypes';

export type RequiredFileSlot<Category extends string, Key extends string, Label extends string = string> = {
  accept: string;
  category: Category;
  description: string;
  key: Key;
  label: Label;
  maxSizeMb: number;
};

export type ArchiveRequiredFileSlotKey = 'id-portrait' | 'id-emblem' | 'contract';
export type ArchiveRequiredFileSlot = RequiredFileSlot<PeopleArchiveFile['category'], ArchiveRequiredFileSlotKey>;

export type PositionRequiredFileSlot = RequiredFileSlot<
  Extract<PositionManagementFile['category'], '岗位说明书' | '任职要求'>,
  'job-description' | 'role-requirement',
  Extract<PositionManagementFile['category'], '岗位说明书' | '任职要求'>
>;

export type MovementRequiredFileSlotKey = 'renewal-agreement' | 'resignation-certificate' | 'cooperation-end-confirmation';
export type MovementFileSlotType = '转正' | '岗位调整' | '工作日历变更' | '薪资标准调整' | '续签' | '离职' | '结束合作' | '暂停任务参与' | '恢复任务参与';
export type MovementRequiredFileSlot = RequiredFileSlot<PeopleArchiveFile['category'], MovementRequiredFileSlotKey>;

export const archiveIdentityFileMaxSizeMb = 10;
export const archiveContractFileMaxSizeMb = 20;
export const positionRequiredFileMaxSizeMb = 20;
export const movementRequiredFileMaxSizeMb = 20;

export function getArchiveRequiredFileSlots(personnelType: PeopleMember['personnelType']): ArchiveRequiredFileSlot[] {
  const agreementLabel = personnelType === '兼职' ? '合作协议' : '劳动合同';

  return [
    {
      accept: '.jpg,.jpeg,.png,.pdf',
      category: '身份资料',
      description: `上传人像面照片或扫描件，支持 JPG/PNG/PDF，单个文件不超过 ${archiveIdentityFileMaxSizeMb}MB`,
      key: 'id-portrait',
      label: '身份证人像面',
      maxSizeMb: archiveIdentityFileMaxSizeMb
    },
    {
      accept: '.jpg,.jpeg,.png,.pdf',
      category: '身份资料',
      description: `上传国徽面照片或扫描件，支持 JPG/PNG/PDF，单个文件不超过 ${archiveIdentityFileMaxSizeMb}MB`,
      key: 'id-emblem',
      label: '身份证国徽面',
      maxSizeMb: archiveIdentityFileMaxSizeMb
    },
    {
      accept: '.pdf,.jpg,.jpeg,.png',
      category: personnelType === '兼职' ? '合作资料' : '合同协议',
      description: `上传已签署${agreementLabel}，支持 PDF/JPG/PNG，单个文件不超过 ${archiveContractFileMaxSizeMb}MB`,
      key: 'contract',
      label: agreementLabel,
      maxSizeMb: archiveContractFileMaxSizeMb
    }
  ];
}

export const positionRequiredFileSlots: PositionRequiredFileSlot[] = [
  {
    accept: '.pdf,.jpg,.jpeg,.png',
    category: '岗位说明书',
    description: `上传正式岗位说明书，支持 PDF/JPG/PNG，单个文件不超过 ${positionRequiredFileMaxSizeMb}MB`,
    key: 'job-description',
    label: '岗位说明书',
    maxSizeMb: positionRequiredFileMaxSizeMb
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png',
    category: '任职要求',
    description: `上传岗位任职要求，支持 PDF/JPG/PNG，单个文件不超过 ${positionRequiredFileMaxSizeMb}MB`,
    key: 'role-requirement',
    label: '任职要求',
    maxSizeMb: positionRequiredFileMaxSizeMb
  }
];

export function getMovementRequiredFileSlots(member: PeopleMember | undefined, type: MovementFileSlotType): MovementRequiredFileSlot[] {
  if (!member) {
    return [];
  }

  if (type === '续签') {
    const label = member.personnelType === '兼职' ? '合作协议续签附件' : '劳动合同续签附件';

    return [
      {
        accept: '.pdf,.jpg,.jpeg,.png',
        category: member.personnelType === '兼职' ? '合作资料' : '合同协议',
        description: `上传已签署${label.replace('附件', '')}，支持 PDF/JPG/PNG，单个文件不超过 ${movementRequiredFileMaxSizeMb}MB`,
        key: 'renewal-agreement',
        label,
        maxSizeMb: movementRequiredFileMaxSizeMb
      }
    ];
  }

  if (type === '离职' && member.personnelType === '全职') {
    return [
      {
        accept: '.pdf,.jpg,.jpeg,.png',
        category: '合同协议',
        description: `创建离职记录时必须上传离职证明，支持 PDF/JPG/PNG，单个文件不超过 ${movementRequiredFileMaxSizeMb}MB`,
        key: 'resignation-certificate',
        label: '离职证明',
        maxSizeMb: movementRequiredFileMaxSizeMb
      }
    ];
  }

  if (type === '结束合作' && member.personnelType === '兼职') {
    return [
      {
        accept: '.pdf,.jpg,.jpeg,.png',
        category: '合作资料',
        description: `上传合作终止确认或终止协议，支持 PDF/JPG/PNG，单个文件不超过 ${movementRequiredFileMaxSizeMb}MB`,
        key: 'cooperation-end-confirmation',
        label: '合作终止确认文件',
        maxSizeMb: movementRequiredFileMaxSizeMb
      }
    ];
  }

  return [];
}
