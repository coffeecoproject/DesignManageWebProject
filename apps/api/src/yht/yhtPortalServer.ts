import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createYhtPostgresRepository, type LedgerSqlPool } from './yhtLedgerPostgresRepository.js';
import { createYhtLedgerService } from './yhtLedgerService.js';
import { createYhtLedgerHttpHandler } from './yhtLedgerHttpHandler.js';
import { createPortalAuth } from './yhtPortalAuth.js';
import { createYhtActivityService, type AddActivity } from './yhtActivityService.js';

const require = createRequire(import.meta.url);
// Existing workspace depends on pg; keep its runtime adapter isolated here.
const { Pool } = require('pg') as {
  Pool: new (options:{connectionString:string;max:number})=>LedgerSqlPool & {end():Promise<void>};
};

function parseCookies(cookieHeader: string | undefined): Record<string,string> {
  const pairs = (cookieHeader ?? '').split(';').map(v => v.trim().split('='));
  const cookies: Record<string,string> = {};
  for (const [key,value] of pairs) if (key && value) cookies[key] = value;
  return cookies;
}
function write(res:ServerResponse,status:number,data:unknown,headers:Record<string,string>={}) {
  const isCsv = headers['content-type']?.includes('csv');
  const body=isCsv && typeof data==='string' ? data : JSON.stringify(data);
  res.writeHead(status,{
    'content-type':isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer',
    ...headers
  });
  res.end(body);
}
async function readJson(req:IncomingMessage):Promise<unknown> {
  let text='';
  for await(const part of req) {
    text+=part.toString();
    if(text.length>32768) throw Error('请求体超过大小限制');
  }
  try{return text ? JSON.parse(text) as unknown : {};}catch{throw Error('JSON格式错误');}
}
function asObject(input:unknown):Record<string,unknown> {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw Error('请求数据格式错误');
  return input as Record<string,unknown>;
}
function textField(value:unknown):string {
  return typeof value==='string' ? value : '';
}

export async function startYhtPortalServer() {
  const connectionString=process.env.YHT_DATABASE_URL;
  if(!connectionString) throw Error('YHT_DATABASE_URL 未配置');
  if(!process.env.YHT_BOOTSTRAP_USER || !process.env.YHT_BOOTSTRAP_PASSWORD) {
    throw Error('首次启动需要配置 YHT_BOOTSTRAP_USER / YHT_BOOTSTRAP_PASSWORD');
  }
  const host=process.env.YHT_HOST || '127.0.0.1';
  if(host!=='127.0.0.1' && host!=='localhost' && process.env.YHT_COOKIE_SECURE!=='true') {
    throw Error('非本机服务必须先配置 HTTPS 反向代理和 YHT_COOKIE_SECURE=true');
  }
  const port=Number(process.env.YHT_PORT || '8787');
  const pool = new Pool({connectionString,max:10});
  const auth=createPortalAuth(pool);
  await auth.bootstrapManager(process.env.YHT_BOOTSTRAP_USER,process.env.YHT_BOOTSTRAP_PASSWORD);
  const repository=createYhtPostgresRepository(pool);
  const activities=createYhtActivityService(pool,repository);
  const service=createYhtLedgerService({
    repository,
    newId:randomUUID,
    now:()=>new Date().toISOString(),
    resolveDesigner:(id)=>auth.resolveDesigner(id)
  });
  const ledger=createYhtLedgerHttpHandler(service);
  const secure=process.env.YHT_COOKIE_SECURE==='true' ? '; Secure' : '';
  const cookie=(token:string)=>'yht_session='+token+'; HttpOnly; SameSite=Strict; Path=/api/yht; Max-Age=43200'+secure;
  const clearCookie='yht_session=; HttpOnly; SameSite=Strict; Path=/api/yht; Max-Age=0'+secure;
  const failedLogins=new Map<string,{count:number;since:number}>();

  const server=createServer(async(req,res)=>{
    const path=(req.url??'').split('?')[0]??'';
    if(!path.startsWith('/api/yht/')) return write(res,404,{error:'Not found'});
    const method=(req.method??'GET').toUpperCase();
    const mutating=!['GET','HEAD'].includes(method);
    const origin=req.headers.origin;
    // Reject cross-origin writes; browser fetch in same-origin mode sends Origin for mutations.
    if(mutating && origin) {
      try {
        const url=new URL(origin);
        if(url.host!==req.headers.host) return write(res,403,{error:'跨站请求被拒绝'});
      }catch{return write(res,403,{error:'来源无效'});}
    }
    try {
      const token=parseCookies(req.headers.cookie).yht_session??null;
      const session=await auth.session(token);
      if(path==='/api/yht/session' && method==='GET') {
        return write(res,200,session ? {account:session.account,csrfToken:session.csrfToken} : {account:null});
      }
      if(path==='/api/yht/login' && method==='POST') {
        const ip=req.socket.remoteAddress??'unknown';
        const prior=failedLogins.get(ip);
        if(prior && Date.now()-prior.since<900000 && prior.count>=10) return write(res,429,{error:'尝试次数过多，请稍后再试'});
        const input=asObject(await readJson(req));
        const login=await auth.login(textField(input.username),textField(input.password));
        if(!login) {
          failedLogins.set(ip,{count:prior&&Date.now()-prior.since<900000 ? prior.count+1:1,since:prior&&Date.now()-prior.since<900000?prior.since:Date.now()});
          return write(res,401,{error:'账号或密码错误'});
        }
        failedLogins.delete(ip);
        return write(res,200,{account:login.account,csrfToken:login.csrfToken},{'set-cookie':cookie(login.sessionToken)});
      }
      if(!session) return write(res,401,{error:'请先登录'});
      if(mutating && req.headers['x-csrf-token']!==session.csrfToken) {
        return write(res,403,{error:'安全校验失败，请刷新页面重试'});
      }
      if(path==='/api/yht/logout' && method==='POST'){
        await auth.logout(token);
        return write(res,200,{ok:true},{'set-cookie':clearCookie});
      }
      if(path==='/api/yht/accounts' && method==='GET') {
        if(session.principal.role!=='manager') return write(res,403,{error:'仅负责人可查看人员'});
        return write(res,200,{accounts:await auth.listAccounts()});
      }
      if(path==='/api/yht/accounts' && method==='POST'){
        if(session.principal.role!=='manager') return write(res,403,{error:'仅负责人可创建账号'});
        const data=asObject(await readJson(req));
        const created=await auth.createAccount({
          username:textField(data.username),
          name:textField(data.name),
          password:textField(data.password),
          role:data.role==='executive'?'executive':'designer'
        });
        return write(res,201,{account:created});
      }
      const activityMatch=path.match(/^\/api\/yht\/ledger\/([A-Za-z0-9_-]+)\/activities(?:\/([A-Za-z0-9_-]+)\/image)?$/);
      if(activityMatch){
        const projectId=activityMatch[1] as string;
        const imageId=activityMatch[2];
        if(method==='GET' && imageId){
          const image=await activities.image(session.principal,projectId,imageId);
          if(!image)return write(res,404,{error:'截图不存在'});
          res.writeHead(200,{'content-type':image.mime,'content-disposition':'inline','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"});
          return res.end(image.bytes);
        }
        if(method==='GET' && !imageId)return write(res,200,{activities:await activities.list(session.principal,projectId)});
        if(method==='POST' && !imageId)return write(res,201,{activity:await activities.add(session.principal,projectId,asObject(await readJson(req)) as AddActivity)});
        return write(res,405,{error:'不支持的方法'});
      }
      if(path.startsWith('/api/yht/ledger')){
        const response=await ledger({
          method,
          path,
          principal:session.principal,
          body:mutating ? await readJson(req) : undefined
        });
        return write(res,response.status,response.body,response.headers);
      }
      return write(res,404,{error:'Not found'});
    }catch(error){
      const err=error instanceof Error ? error.message : '系统错误';
      const status=err.includes('duplicate key')?409:err.includes('没有访问权限')||err.includes('没有添加记录的权限')?403:err.includes('请求')||err.includes('密码')||err.includes('账号')||err.includes('记录')||err.includes('截图')||err.includes('审核')?400:500;
      if(status===500) console.error('YHT portal request failed',error);
      return write(res,status,{error:status===500?'服务器处理失败':err});
    }
  });
  await new Promise<void>((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,host,()=>resolve());
  });
  console.log('YHT portal API listening on http://'+host+':'+port);
  const shutdown=async()=>{server.close();await pool.end();};
  process.on('SIGTERM',()=>{void shutdown();});
  process.on('SIGINT',()=>{void shutdown();});
  return server;
}
if(process.env.YHT_RUN_SERVER==='true') {
  void startYhtPortalServer().catch(error=>{console.error(error);process.exitCode=1;});
}
