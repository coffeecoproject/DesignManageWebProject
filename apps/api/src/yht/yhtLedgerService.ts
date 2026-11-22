import {
  assertActivePrincipal, assertManager, canReadProject, canChangeFields,
  validateManagerCreate, validateProgressPatch, buildClientCsv,
  type LedgerPrincipal, type LedgerProject, type ManagerCreate
} from './yhtLedgerDomain.js';

/** 数据库事务的实现责任属于 Repository：项目变更和审计记录必须原子提交。 */
export type VersionedProject = LedgerProject & { revision: number };
export type LedgerAuditEvent = {
  projectId: string;
  actorId: string;
  action: '派单' | '更新进度' | '更新基础资料';
  changedFields: string[];
  createdAt: string;
};
export interface YhtLedgerRepository {
  findById(id: string): Promise<VersionedProject | null>;
  list(): Promise<VersionedProject[]>;
  insertWithAudit(project: VersionedProject, audit: LedgerAuditEvent): Promise<void>;
  updateWithAudit(next: VersionedProject, expectedRevision: number, audit: LedgerAuditEvent): Promise<boolean>;
}
export type LedgerDependencies = {
  repository: YhtLedgerRepository;
  /** 必须由服务端提供安全的ID和当前时间 */
  newId: () => string;
  now: () => string;
  /** 由服务端查询人员/账号表，客户端传入的设计师姓名不能作为身份依据。 */
  resolveDesigner: (designerId: string) => Promise<{
    id: string;
    name: string;
    enabled: boolean;
    role: 'designer' | 'manager' | 'executive';
  } | null>;
};
function assertKeys(input: Record<string, unknown>, allowed: Set<string>) {
  if (Object.keys(input).some(key => !allowed.has(key))) throw new Error('包含不允许写入的字段');
}

const baseFields = new Set([
  'region','storeType','storeName','contractNo','outsourcingType','designerId','designerName'
]);

export function createYhtLedgerService({repository, newId, now, resolveDesigner}: LedgerDependencies) {
  async function verifyDesigner(input: ManagerCreate): Promise<ManagerCreate> {
    const account = await resolveDesigner(input.designerId);
    if (!account || !account.enabled || account.role !== 'designer') {
      throw new Error('设计师账号不存在、已停用或角色不正确');
    }
    // 姓名从可信账号目录获取，避免人员ID与显示姓名不一致。
    return {...input, designerId: account.id, designerName: account.name};
  }
  async function visibleProject(principal: LedgerPrincipal, id: string) {
    assertActivePrincipal(principal);
    const project = await repository.findById(id);
    if (!project || !canReadProject(principal, project)) {
      throw new Error('项目不存在或没有访问权限');
    }
    return project;
  }
  return {
    async list(principal: LedgerPrincipal) {
      assertActivePrincipal(principal);
      const rows = await repository.list();
      return rows.filter(row => canReadProject(principal, row));
    },
    get: visibleProject,
    async assign(principal: LedgerPrincipal, input: ManagerCreate) {
      assertManager(principal);
      assertKeys(input as unknown as Record<string, unknown>, baseFields);
      const base = await verifyDesigner(validateManagerCreate(input));
      const instant = now();
      const next: VersionedProject = {
        ...base,
        id: newId(), revision: 1, sourceRecordId: null,
        assignedAt: instant, planUploadedAt: null, operationsConfirmedAt: null,
        constructionUploadedAt: null, stage: '未开始', specialCases: [],
        notes: '', planScore: '', constructionScore: '',
        createdBy: principal.userId, updatedAt: instant
      };
      const audit: LedgerAuditEvent = {
        projectId: next.id, actorId: principal.userId,
        action: '派单', changedFields: [...baseFields], createdAt: instant
      };
      await repository.insertWithAudit(next, audit);
      return next;
    },
    async updateProgress(
      principal: LedgerPrincipal, id: string, patch: Record<string, unknown>, expectedRevision: number
    ) {
      const current = await visibleProject(principal, id);
      const clean = validateProgressPatch(patch);
      if (!canChangeFields(principal, current, Object.keys(clean))) throw new Error('无权修改项目进度');
      if (current.revision !== expectedRevision) throw new Error('项目已被其他人修改，请刷新后重试');
      const instant = now();
      const next = {...current, ...clean, revision: current.revision + 1, updatedAt: instant};
      const audit: LedgerAuditEvent = {
        projectId: id, actorId: principal.userId, action: '更新进度',
        changedFields: Object.keys(clean), createdAt: instant
      };
      if (!await repository.updateWithAudit(next, expectedRevision, audit)) {
        throw new Error('项目已被其他人修改，请刷新后重试');
      }
      return next;
    },
    async updateBase(
      principal: LedgerPrincipal, id: string, patch: Record<string, unknown>, expectedRevision: number
    ) {
      assertManager(principal);
      const current = await visibleProject(principal, id);
      if (Object.keys(patch).length === 0) throw new Error('没有需要更新的字段');
      assertKeys(patch, baseFields);
      const merged = await verifyDesigner(validateManagerCreate({...current, ...patch}));
      if (current.revision !== expectedRevision) throw new Error('项目已被其他人修改，请刷新后重试');
      const instant = now();
      const next = {...current, ...merged, revision: current.revision + 1, updatedAt: instant};
      const audit: LedgerAuditEvent = {
        projectId: id, actorId: principal.userId, action: '更新基础资料',
        changedFields: Object.keys(patch), createdAt: instant
      };
      if (!await repository.updateWithAudit(next, expectedRevision, audit)) {
        throw new Error('项目已被其他人修改，请刷新后重试');
      }
      return next;
    },
    async exportForClient(principal: LedgerPrincipal) {
      assertManager(principal);
      const rows = await repository.list();
      return buildClientCsv(rows);
    }
  };
}
