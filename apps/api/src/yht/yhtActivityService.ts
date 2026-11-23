import { randomUUID } from 'node:crypto';
import type { LedgerPrincipal } from './yhtLedgerDomain.js';
import { assertActivePrincipal, canReadProject } from './yhtLedgerDomain.js';
import type { LedgerSqlPool } from './yhtLedgerPostgresRepository.js';
import type { YhtLedgerRepository } from './yhtLedgerService.js';

export type ActivityKind = '内部审核' | '甲方审核' | '关键事项';
export type ActivityStage = '平面方案' | '施工图';
export type ActivityResult = '待确认' | '通过' | '需修改';
export type ActivityRecord = {
  id: string;
  projectId: string;
  kind: ActivityKind;
  stage: ActivityStage | null;
  result: ActivityResult | null;
  description: string;
  happenedAt: string;
  recordedAt: string;
  recordedBy: string;
  image?: {name:string; mime:string; bytes:number};
};
type ActivityDbRow = Record<string, unknown> & {
  id:string;project_id:string;kind:ActivityKind;stage:ActivityStage|null;
  result:ActivityResult|null;description:string;
  happened_at:Date|string;recorded_at:Date|string;recorded_by:string;
  image_name:string|null;image_mime:string|null;image_size:number|null;
};
const kindSet=new Set<ActivityKind>(['内部审核','甲方审核','关键事项']);
const stageSet=new Set<ActivityStage>(['平面方案','施工图']);
const resultSet=new Set<ActivityResult>(['待确认','通过','需修改']);
const imageMimes=new Set(['image/png','image/jpeg','image/webp']);
export type AddActivity = {
  kind: ActivityKind;
  stage?: ActivityStage | null;
  result?: ActivityResult | null;
  description: string;
  happenedAt: string;
  image?: {name:string;mime:string;base64:string};
};
function iso(value:Date|string):string {
  const date=value instanceof Date ? value:new Date(value);
  if(Number.isNaN(date.getTime())) throw Error('记录时间无效');
  return date.toISOString();
}
function toActivity(row:ActivityDbRow):ActivityRecord {
  return {
    id:row.id,projectId:row.project_id,kind:row.kind,stage:row.stage,
    result:row.result,description:row.description,happenedAt:iso(row.happened_at),
    recordedAt:iso(row.recorded_at),recordedBy:row.recorded_by,
    ...(row.image_name&&row.image_mime ? {image:{name:row.image_name,mime:row.image_mime,bytes:row.image_size??0}} : {})
  };
}
function decodeImage(image:AddActivity['image']):{name:string;mime:string;bytes:Buffer}|null{
  if(!image) return null;
  if(typeof image.name!=='string'||image.name.length<1||image.name.length>160
      ||typeof image.mime!=='string'||!imageMimes.has(image.mime)
      ||typeof image.base64!=='string'||image.base64.length>4194400
      ||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.base64)) {
    throw Error('截图格式不正确，仅支持不超过3MB的PNG/JPEG/WEBP');
  }
  const bytes=Buffer.from(image.base64,'base64');
  if(bytes.length===0||bytes.length>3145728) throw Error('截图超过3MB或为空');
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!(image.mime==='image/png'&&png||image.mime==='image/jpeg'&&jpg||image.mime==='image/webp'&&webp)){
    throw Error('截图实际格式与声明不一致');
  }
  return {name:image.name,mime:image.mime,bytes};
}
export function createYhtActivityService(pool:LedgerSqlPool, repository:YhtLedgerRepository) {
  async function authorize(principal:LedgerPrincipal, projectId:string, write=false) {
    assertActivePrincipal(principal);
    const project=await repository.findById(projectId);
    if(!project||!canReadProject(principal,project)) throw Error('项目不存在或没有访问权限');
    if(write&&principal.role==='executive') throw Error('没有添加记录的权限');
  }
  return {
    async list(principal:LedgerPrincipal, projectId:string):Promise<ActivityRecord[]> {
      await authorize(principal,projectId);
      const found=await pool.query<ActivityDbRow>(
        "SELECT id,project_id,kind,stage,result,description,happened_at,recorded_at,recorded_by,image_name,image_mime,octet_length(image_bytes)::integer AS image_size FROM yht_ledger_activities WHERE project_id=$1 ORDER BY happened_at DESC,id DESC",
        [projectId]
      );
      return found.rows.map(toActivity);
    },
    async add(principal:LedgerPrincipal, projectId:string, input:AddActivity):Promise<ActivityRecord> {
      await authorize(principal,projectId,true);
      if(!input||typeof input!=='object')throw Error('记录数据无效');
      if(!kindSet.has(input.kind))throw Error('记录类型无效');
      if(typeof input.description!=='string'||!input.description.trim()||input.description.length>4000)throw Error('请填写4000字以内的记录内容');
      if(input.stage!=null&&!stageSet.has(input.stage))throw Error('审核阶段无效');
      if(input.result!=null&&!resultSet.has(input.result))throw Error('审核结果无效');
      if(input.kind!=='关键事项'&&(!input.stage||!input.result))throw Error('审核记录需要选择阶段和结果');
      const date=new Date(input.happenedAt);
      if(!input.happenedAt||Number.isNaN(date.getTime()))throw Error('记录时间无效');
      const image=decodeImage(input.image);
      const id=randomUUID();
      const record=await pool.query<ActivityDbRow>(
        "INSERT INTO yht_ledger_activities(id,project_id,kind,stage,result,description,happened_at,recorded_by,image_name,image_mime,image_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,project_id,kind,stage,result,description,happened_at,recorded_at,recorded_by,image_name,image_mime,octet_length(image_bytes)::integer AS image_size",
        [id,projectId,input.kind,input.stage??null,input.result??null,input.description.trim(),date.toISOString(),principal.userId,image?.name??null,image?.mime??null,image?.bytes??null]
      );
      if(!record.rows[0])throw Error('保存审核记录失败');
      return toActivity(record.rows[0]);
    },
    async image(principal:LedgerPrincipal, projectId:string, activityId:string):Promise<{mime:string;bytes:Buffer}|null> {
      await authorize(principal,projectId);
      const found=await pool.query<Record<string,unknown>&{image_mime:string|null;image_bytes:Buffer|null}>(
        'SELECT image_mime,image_bytes FROM yht_ledger_activities WHERE id=$1 AND project_id=$2',
        [activityId,projectId]
      );
      const row=found.rows[0];
      return row?.image_mime&&row.image_bytes?{mime:row.image_mime,bytes:row.image_bytes}:null;
    }
  };
}
