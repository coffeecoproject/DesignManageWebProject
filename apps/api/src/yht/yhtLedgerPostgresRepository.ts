import type { LedgerAuditEvent, VersionedProject, YhtLedgerRepository } from './yhtLedgerService.js';

export interface LedgerSqlConnection {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
}
export interface LedgerSqlPool {
  connect(): Promise<LedgerSqlConnection>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}
type DbProject = {
  id: string; source_record_id: string | null;
  region: string; store_type: string; store_name: string;
  contract_no: string; outsourcing_type: VersionedProject['outsourcingType'];
  designer_id: string; designer_name: string;
  assigned_at: Date | string | null;
  plan_uploaded_at: Date | string | null;
  operations_confirmed_at: Date | string | null;
  construction_uploaded_at: Date | string | null;
  stage: VersionedProject['stage'];
  special_cases: string[] | string;
  notes: string; plan_score: string; construction_score: string;
  created_by: string; updated_at: Date | string;
  revision: number;
};
function asIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('数据库时间格式无效');
  return date.toISOString();
}
function mapProject(row: DbProject): VersionedProject {
  const cases: unknown = typeof row.special_cases === 'string'
    ? JSON.parse(row.special_cases) as unknown : row.special_cases;
  if (!Array.isArray(cases) || !cases.every(item => typeof item === 'string')) throw new Error('特殊事项不是合法数组');
  return {
    id: row.id, sourceRecordId: row.source_record_id,
    region: row.region, storeType: row.store_type, storeName: row.store_name,
    contractNo: row.contract_no, outsourcingType: row.outsourcing_type,
    designerId: row.designer_id, designerName: row.designer_name,
    assignedAt: asIso(row.assigned_at), planUploadedAt: asIso(row.plan_uploaded_at),
    operationsConfirmedAt: asIso(row.operations_confirmed_at),
    constructionUploadedAt: asIso(row.construction_uploaded_at),
    stage: row.stage, specialCases: cases as string[], notes: row.notes,
    planScore: row.plan_score, constructionScore: row.construction_score,
    createdBy: row.created_by, updatedAt: asIso(row.updated_at) as string,
    revision: row.revision
  };
}
const columns = [
  'id','source_record_id','region','store_type','store_name','contract_no',
  'outsourcing_type','designer_id','designer_name','assigned_at','plan_uploaded_at',
  'operations_confirmed_at','construction_uploaded_at','stage','special_cases',
  'notes','plan_score','construction_score','created_by','updated_at','revision'
] as const;
const sqlColumns = columns.map(c => '"' + c + '"').join(', ');
const placeholders = columns.map((_, i) => '$' + (i + 1)).join(', ');
const updatable = columns.filter(c => c !== 'id' && c !== 'source_record_id' && c !== 'created_by' && c !== 'revision');

function values(project: VersionedProject): unknown[] {
  return [
    project.id, project.sourceRecordId ?? null, project.region, project.storeType,
    project.storeName, project.contractNo, project.outsourcingType,
    project.designerId, project.designerName, project.assignedAt,
    project.planUploadedAt, project.operationsConfirmedAt,
    project.constructionUploadedAt, project.stage,
    JSON.stringify(project.specialCases), project.notes, project.planScore,
    project.constructionScore, project.createdBy, project.updatedAt, project.revision
  ];
}
async function appendAudit(connection: LedgerSqlConnection, event: LedgerAuditEvent) {
  await connection.query(
    'INSERT INTO yht_ledger_audit_events (project_id, actor_id, action, changed_fields, created_at) VALUES ($1,$2,$3,$4::jsonb,$5)',
    [event.projectId, event.actorId, event.action, JSON.stringify(event.changedFields), event.createdAt]
  );
}
async function transaction<T>(pool: LedgerSqlPool, work: (connection: LedgerSqlConnection) => Promise<T>): Promise<T> {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    const result = await work(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    try { await connection.query('ROLLBACK'); } catch { /* original error takes priority */ }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * The HTTP layer must authenticate first and pass the principal to the service.
 * DB writes and audit events share one transaction; updates are revision-guarded.
 */
export function createYhtPostgresRepository(pool: LedgerSqlPool): YhtLedgerRepository {
  return {
    async findById(id) {
      const found = await pool.query<DbProject & Record<string, unknown>>(
        'SELECT * FROM yht_ledger_projects WHERE id = $1 LIMIT 1', [id]
      );
      return found.rows[0] ? mapProject(found.rows[0]) : null;
    },
    async list() {
      const result = await pool.query<DbProject & Record<string, unknown>>(
        'SELECT * FROM yht_ledger_projects ORDER BY assigned_at DESC NULLS LAST, id'
      );
      return result.rows.map(mapProject);
    },
    async insertWithAudit(project, audit) {
      await transaction(pool, async connection => {
        await connection.query(
          'INSERT INTO yht_ledger_projects (' + sqlColumns + ') VALUES (' + placeholders + ')',
          values(project)
        );
        await appendAudit(connection, audit);
      });
    },
    async updateWithAudit(project, expectedRevision, audit) {
      return transaction(pool, async connection => {
        const raw = values(project);
        const assignments = updatable.map((col, i) => '"' + col + '" = $' + (i + 1)).join(', ');
        const filteredValues = updatable.map(col => raw[columns.indexOf(col)]);
        const result = await connection.query(
          'UPDATE yht_ledger_projects SET ' + assignments +
          ', revision = revision + 1 WHERE id = $' + (filteredValues.length + 1) +
          ' AND revision = $' + (filteredValues.length + 2),
          [...filteredValues, project.id, expectedRevision]
        );
        if (result.rowCount !== 1) return false;
        await appendAudit(connection, audit);
        return true;
      });
    }
  };
}
