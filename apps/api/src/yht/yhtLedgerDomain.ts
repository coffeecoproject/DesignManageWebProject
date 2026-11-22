/**
 * 益禾堂内部台账：纯业务规则（没有数据库、浏览器、网络依赖）。
 * 服务端应从已经验证的会话构造 Principal，严禁使用前端提交的角色/人员 ID 作为认证依据。
 */
export type LedgerRole = 'manager' | 'designer' | 'executive';
export type LedgerPrincipal = { userId: string; role: LedgerRole; enabled: boolean };
export type LedgerStage = '平面完成' | '施工图完成' | '下单完成' | '未开始';
export type OutsourcingType = '平面+施工图' | '施工图';

export type LedgerProject = {
  id: string;
  sourceRecordId?: string | null;
  region: string;
  storeType: string;   // 如 6.5整店、6.5轻改店；不等同于外协类型
  storeName: string;
  contractNo: string;
  outsourcingType: OutsourcingType;
  designerId: string;
  designerName: string;
  assignedAt: string | null;
  planUploadedAt: string | null;
  operationsConfirmedAt: string | null;
  constructionUploadedAt: string | null;
  stage: LedgerStage;
  specialCases: string[];
  notes: string;
  planScore: string;
  constructionScore: string;
  createdBy: string;
  updatedAt: string;
};
export type ManagerCreate = Pick<LedgerProject, 'region' | 'storeType' | 'storeName' | 'contractNo' | 'outsourcingType' | 'designerId' | 'designerName'>;
export type ProgressPatch = Partial<Pick<LedgerProject,
  'planUploadedAt' | 'operationsConfirmedAt' | 'constructionUploadedAt' |
  'stage' | 'specialCases' | 'notes' | 'planScore' | 'constructionScore'>>;
export type ManagerPatch = Partial<ManagerCreate>;

export const FEISHU_2026_COLUMNS = [
  '施工图出图时效', '特殊情况说明', '施工图评分', '营运确认方案时间',
  '城市等级', '是否为核心商圈', '门店模型', '施工图上传时间',
  '方案出图时效（天）', '外协类型', '方案评分', '备注', '合同号',
  '总部施工图设计师签收', '店铺名称', '所属区域', '父记录',
  '外协设计师', '设计出图\n项目状态', '全店出图时效（天）',
  '日期 3', '6.5整店', '服务类型', '方案上传时间', '派单时间'
] as const;

export const CLIENT_EXPORT_HEADERS = [
  '所属区域', '6.5整店', '店铺名称', '合同号', '外协类型', '外协设计师',
  '派单时间', '方案上传时间', '营运确认方案时间', '施工图上传时间',
  '方案出图时效（天）', '施工图出图时效', '全店出图时效（天）', '设计出图项目状态'
] as const;

const managerialFields = new Set<keyof LedgerProject>([
  'region', 'storeType', 'storeName', 'contractNo', 'outsourcingType', 'designerId', 'designerName'
]);
const progressFields = new Set<keyof LedgerProject>([
  'planUploadedAt', 'operationsConfirmedAt', 'constructionUploadedAt',
  'stage', 'specialCases', 'notes', 'planScore', 'constructionScore'
]);
const validOutsourcing = new Set<OutsourcingType>(['平面+施工图', '施工图']);
const validStages = new Set<LedgerStage>(['未开始', '平面完成', '施工图完成', '下单完成']);

export function assertActivePrincipal(principal: LedgerPrincipal): void {
  if (!principal.enabled || !principal.userId.trim()) throw new Error('账号不可用或未登录');
}
export function assertManager(principal: LedgerPrincipal): void {
  assertActivePrincipal(principal);
  if (principal.role !== 'manager') throw new Error('仅项目负责人可以执行此操作');
}
export function canReadProject(principal: LedgerPrincipal, project: Pick<LedgerProject, 'designerId'>): boolean {
  if (!principal.enabled || !principal.userId.trim()) return false;
  return principal.role === 'manager' || principal.role === 'executive' ||
    (principal.role === 'designer' && principal.userId === project.designerId);
}
export function canChangeFields(
  principal: LedgerPrincipal,
  project: Pick<LedgerProject, 'designerId'>,
  fields: string[]
): boolean {
  if (!canReadProject(principal, project) || principal.role === 'executive') return false;
  return fields.length > 0 && fields.every(field =>
    principal.role === 'manager'
      ? managerialFields.has(field as keyof LedgerProject) || progressFields.has(field as keyof LedgerProject)
      : progressFields.has(field as keyof LedgerProject)
  );
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 200) {
    throw new Error(label + '不能为空且不能超过200字');
  }
  return value.trim();
}
export function validateManagerCreate(value: ManagerCreate): ManagerCreate {
  const normalized: ManagerCreate = {
    region: requiredText(value.region, '所属区域'),
    storeType: requiredText(value.storeType, '门店类型'),
    storeName: requiredText(value.storeName, '店铺名称'),
    contractNo: requiredText(value.contractNo, '合同号'),
    outsourcingType: value.outsourcingType,
    designerId: requiredText(value.designerId, '设计师ID'),
    designerName: requiredText(value.designerName, '外协设计师')
  };
  if (!validOutsourcing.has(normalized.outsourcingType)) throw new Error('外协类型不正确');
  return normalized;
}
export function validateProgressPatch(patch: Record<string, unknown>): ProgressPatch {
  const fields = Object.keys(patch);
  if (fields.length === 0 || fields.some(key => !progressFields.has(key as keyof LedgerProject))) {
    throw new Error('包含不允许更新的进度字段');
  }
  const clean: Record<string, unknown> = {};
  for (const field of fields) {
    const value = patch[field];
    if (['planUploadedAt', 'operationsConfirmedAt', 'constructionUploadedAt'].includes(field)) {
      if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) {
        throw new Error('日期格式不正确：' + field);
      }
    } else if (field === 'stage') {
      if (!validStages.has(value as LedgerStage)) throw new Error('项目状态不正确');
    } else if (field === 'specialCases') {
      if (!Array.isArray(value) || value.length > 100 ||
          value.some(v => typeof v !== 'string' || v.length > 200)) throw new Error('特殊情况格式不正确');
    } else {
      if (typeof value !== 'string' || value.length > 10000) throw new Error('文字内容格式不正确');
    }
    clean[field] = value;
  }
  return clean as ProgressPatch;
}

/** 按真实时差计算自然日；任何一端缺失时保留空值，不伪造0天。 */
export function durationDays(end: string | null | undefined, start: string | null | undefined): number | null {
  if (!start || !end) return null;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return null;
  return Math.round(((endTime - startTime) / 86400000) * 100) / 100;
}
export function getDurations(row: Pick<LedgerProject,
  'assignedAt' | 'planUploadedAt' | 'operationsConfirmedAt' | 'constructionUploadedAt'>) {
  const plan = durationDays(row.planUploadedAt, row.assignedAt);
  const construction = durationDays(row.constructionUploadedAt, row.operationsConfirmedAt);
  return {
    plan,
    construction,
    total: plan === null || construction === null ? null : Math.round((plan + construction) * 100) / 100
  };
}

/** 导出明确白名单，不允许前端传任意列名。 */
export function clientExportCells(row: LedgerProject): (string | number | null)[] {
  const d = getDurations(row);
  return [
    row.region, row.storeType, row.storeName, row.contractNo, row.outsourcingType, row.designerName,
    row.assignedAt, row.planUploadedAt, row.operationsConfirmedAt, row.constructionUploadedAt,
    d.plan, d.construction, d.total, row.stage
  ];
}
function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  // Excel/飞书表格公式注入防护：防止 =、+、-、@，包括前导空白/控制符。
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function buildClientCsv(rows: LedgerProject[]): string {
  const lines = [
    CLIENT_EXPORT_HEADERS.map(v => csvCell(v)).join(','),
    ...rows.map(row => clientExportCells(row).map(csvCell).join(','))
  ];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/** 遗留导入仅允许负责人确认；转换器输出的字段映射必须显式可审查。 */
export type LegacyPreviewRow = {
  source_record_id: string;
  '所属区域'?: unknown; '6.5整店'?: unknown; '店铺名称'?: unknown;
  '合同号'?: unknown; '外协类型'?: unknown; '外协设计师'?: unknown;
  '派单时间'?: unknown; '方案上传时间'?: unknown;
  '营运确认方案时间'?: unknown; '施工图上传时间'?: unknown;
  '设计出图\n项目状态'?: unknown;
};
const legacyRequired = ['所属区域', '6.5整店', '店铺名称', '合同号', '外协类型', '外协设计师'] as const;
export function classifyLegacyRow(row: LegacyPreviewRow) {
  const missing = legacyRequired.filter(field =>
    typeof row[field] !== 'string' || !(row[field] as string).trim()
  );
  return {
    sourceRecordId: row.source_record_id,
    readyForImport: Boolean(row.source_record_id) && missing.length === 0,
    missingFields: missing,
    // 设计师中文名字不是可信账号ID，只有经过人工/系统账号匹配才可以派单
    requiresDesignerAccountMapping: true
  };
}
