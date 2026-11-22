import assert from 'node:assert/strict';
import test from 'node:test';
import { createYhtLedgerHttpHandler } from '../node_modules/.cache/startupmanage-api-contract-tests/yht/yhtLedgerHttpHandler.js';

const manager={userId:'owner',role:'manager',enabled:true};
const a={userId:'a',role:'designer',enabled:true};
const b={userId:'b',role:'designer',enabled:true};
const input={region:'湖北',storeType:'6.5整店',storeName:'示例门店',contractNo:'HT-001',outsourcingType:'平面+施工图',designerId:'a',designerName:'设计师A'};

function setup(){
  const db=new Map();
  const service={
    async list(p){
      return [...db.values()].filter(row=>p.role==='manager' || p.role==='executive' || row.designerId===p.userId);
    },
    async assign(p,data){
      if(p.role!=='manager') throw new Error('仅项目负责人可以执行此操作');
      if(!data.storeName) throw new Error('店铺名称不能为空');
      const project={...data,id:'p1',revision:1,stage:'未开始',notes:''};db.set(project.id,project);return project;
    },
    async get(p,id){
      const row=db.get(id);
      if(!row || (p.role==='designer' && row.designerId!==p.userId)) throw new Error('项目不存在或没有访问权限');
      return row;
    },
    async updateProgress(p,id,changes,revision){
      const row=await this.get(p,id);
      if(p.role==='executive') throw new Error('无权修改项目进度');
      if(revision!==row.revision) throw new Error('项目已被其他人修改，请刷新后重试');
      if('contractNo' in changes) throw new Error('包含不允许更新的进度字段');
      const next={...row,...changes,revision:revision+1};db.set(id,next);return next;
    },
    async updateBase(p,id,changes,revision){
      if(p.role!=='manager') throw new Error('仅项目负责人可以执行此操作');
      const row=await this.get(p,id);
      if(revision!==row.revision) throw new Error('项目已被其他人修改，请刷新后重试');
      const next={...row,...changes,revision:revision+1};db.set(id,next);return next;
    },
    async exportForClient(p){
      if(p.role!=='manager') throw new Error('仅项目负责人可以执行此操作');
      return '店铺名称\n示例门店\n';
    }
  };
  return {handler:createYhtLedgerHttpHandler(service),db};
}

test('未认证请求被拒绝，不能通过URL字段指定身份',async()=>{
  const {handler}=setup();
  const result=await handler({method:'GET',path:'/api/yht/ledger?role=manager',principal:null});
  assert.equal(result.status,401);
});
test('派单后设计师看自己的门店，他人不可查看',async()=>{
  const {handler}=setup();
  const created=await handler({method:'POST',path:'/api/yht/ledger',principal:manager,body:input});
  assert.equal(created.status,201);
  const ok=await handler({method:'GET',path:'/api/yht/ledger/p1',principal:a});
  assert.equal(ok.status,200);
  const denied=await handler({method:'GET',path:'/api/yht/ledger/p1',principal:b});
  assert.equal(denied.status,403);
});
test('权限与字段限制，冲突409，导出仅负责人',async()=>{
  const {handler}=setup();
  await handler({method:'POST',path:'/api/yht/ledger',principal:manager,body:input});
  const forbidden=await handler({method:'PATCH',path:'/api/yht/ledger/p1/base',principal:a,body:{revision:1,changes:{storeName:'恶意修改'}}});
  assert.equal(forbidden.status,403);
  const ok=await handler({method:'PATCH',path:'/api/yht/ledger/p1/progress',principal:a,body:{revision:1,changes:{stage:'平面完成'}}});
  assert.equal(ok.status,200);
  const conflict=await handler({method:'PATCH',path:'/api/yht/ledger/p1/progress',principal:a,body:{revision:1,changes:{stage:'施工图完成'}}});
  assert.equal(conflict.status,409);
  assert.equal((await handler({method:'GET',path:'/api/yht/ledger/export.csv',principal:a})).status,403);
  const exported=await handler({method:'GET',path:'/api/yht/ledger/export.csv',principal:manager});
  assert.equal(exported.status,200);
  assert.ok(exported.headers['content-type'].includes('csv'));
});
