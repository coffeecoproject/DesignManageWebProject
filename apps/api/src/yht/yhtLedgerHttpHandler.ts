import type { LedgerPrincipal, ManagerCreate } from './yhtLedgerDomain.js';
import type { createYhtLedgerService } from './yhtLedgerService.js';

export type YhtLedgerService = ReturnType<typeof createYhtLedgerService>;

/**
 * HTTP framework-independent endpoint adapter.
 *
 * Security boundary: principal MUST come from a verified server session.
 * Do not construct it from incoming headers/body/query strings. Mount these
 * endpoints only after authentication middleware is wired and tested.
 */
export type AuthenticatedYhtRequest = {
  method: string;
  path: string;
  principal: LedgerPrincipal | null;
  body?: unknown;
};
export type YhtResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

function json(status: number, body: unknown): YhtResponse {
  return { status, headers: {'content-type':'application/json; charset=utf-8'}, body };
}
function payload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('请求体必须是JSON对象');
  return value as Record<string, unknown>;
}
function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw Error('revision必须是正整数');
  return value as number;
}
function statusForError(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  if (error.message.includes('已被其他人修改')) return 409;
  if (error.message.includes('没有访问权限') || error.message.includes('无权') ||
      error.message.includes('仅项目负责人')) return 403;
  if (error.message.includes('账号不可用或未登录')) return 401;
  return 400;
}

export function createYhtLedgerHttpHandler(service: YhtLedgerService) {
  return async function handleYhtLedger(request: AuthenticatedYhtRequest): Promise<YhtResponse> {
    const method = request.method.toUpperCase();
    const path = request.path.split('?')[0]?.replace(/\/+$/, '') || '/';
    if (!path.startsWith('/api/yht/ledger')) return json(404,{error:'未找到接口'});
    if (!request.principal) return json(401,{error:'请先登录'});
    try {
      const principal = request.principal;
      if (method === 'GET' && path === '/api/yht/ledger') {
        return json(200, {projects: await service.list(principal)});
      }
      if (method === 'POST' && path === '/api/yht/ledger') {
        return json(201, {project: await service.assign(principal, payload(request.body) as ManagerCreate)});
      }
      if (method === 'GET' && path === '/api/yht/ledger/export.csv') {
        return {
          status: 200,
          headers:{
            'content-type':'text/csv; charset=utf-8',
            'content-disposition':'attachment; filename="yht-client-ledger.csv"',
            'cache-control':'no-store'
          },
          body:await service.exportForClient(principal)
        };
      }
      const match = path.match(/^\/api\/yht\/ledger\/([A-Za-z0-9_-]+)(?:\/(progress|base))?$/);
      if (!match) return json(404,{error:'未找到接口'});
      const id = match[1] as string;
      const sub = match[2];
      if (method === 'GET' && !sub) {
        return json(200,{project:await service.get(principal,id)});
      }
      if (method === 'PATCH' && sub) {
        const body = payload(request.body);
        const expectedRevision = revision(body.revision);
        const changes = payload(body.changes);
        const project = sub === 'progress'
          ? await service.updateProgress(principal,id,changes,expectedRevision)
          : await service.updateBase(principal,id,changes,expectedRevision);
        return json(200,{project});
      }
      return json(405,{error:'请求方法不受支持'});
    } catch (error) {
      const status = statusForError(error);
      return json(status, {error: status === 500 ? '服务器处理失败' : (error as Error).message});
    }
  };
}
