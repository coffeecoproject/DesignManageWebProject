import assert from 'node:assert/strict';
import test from 'node:test';
import { createYhtLedgerService } from '../node_modules/.cache/startupmanage-api-contract-tests/yht/yhtLedgerService.js';

function setup() {
  const records=new Map();
  const audit=[];
  let counter=0;
  const repository={
    async findById(id) { return structuredClone(records.get(id)??null); },
    async list() { return structuredClone([...records.values()]); },
    async insertWithAudit(project,event) {
      if(records.has(project.id)) throw new Error('duplicate id');
      records.set(project.id,structuredClone(project)); audit.push(event);
    },
    async updateWithAudit(project,version,event) {
      if(records.get(project.id)?.revision !== version) return false;
      records.set(project.id,structuredClone(project)); audit.push(event);
      return true;
    }
  };
  const service=createYhtLedgerService({repository,newId:()=>('yht-'+(++counter)),now:()=> '2026-11-22T17:00:00+08:00'});
  return {service, records, audit};
}
const manager={userId:'owner',role:'manager',enabled:true};
const a={userId:'a',role:'designer',enabled:true};
const b={userId:'b',role:'designer',enabled:true};
const exec={userId:'exec',role:'executive',enabled:true};
const input={region:'湖北',storeType:'6.5整店',storeName:'测试门店',contractNo:'HT-123',outsourcingType:'平面+施工图',designerId:'a',designerName:'设计师A'};

test('建店派单 - 设计师只看本人门店 - 负责人看全部',async()=>{
  const {service,audit}=setup();
  const created=await service.assign(manager,input);
  assert.equal(created.revision,1);
  assert.equal(created.designerId,'a');
  assert.equal((await service.list(manager)).length,1);
  assert.equal((await service.list(a)).length,1);
  assert.equal((await service.list(b)).length,0);
  assert.equal((await service.list(exec)).length,1);
  await assert.rejects(()=>service.assign(a,input),/负责人/);
  assert.equal(audit.length,1);
  assert.equal(audit[0].action,'派单');
});
test('设计师可改进度但不能改合同，任何人不可伪造更新字段',async()=>{
  const {service,audit}=setup();
  const p=await service.assign(manager,input);
  const result=await service.updateProgress(a,p.id,{stage:'平面完成',notes:'已上传'},1);
  assert.equal(result.revision,2);
  assert.equal(result.stage,'平面完成');
  await assert.rejects(()=>service.updateProgress(a,p.id,{contractNo:'FAKE'},2));
  await assert.rejects(()=>service.updateProgress(b,p.id,{stage:'下单完成'},2));
  await assert.rejects(()=>service.updateProgress(exec,p.id,{stage:'下单完成'},2));
  await assert.rejects(()=>service.updateProgress(a,p.id,{stage:'施工图完成'},1),/刷新/);
  assert.equal(audit.length,2);
  assert.deepEqual(audit[1].changedFields,['stage','notes']);
});
test('负责人修改基本资料后可改派，原设计师失去项目权限',async()=>{
  const {service}=setup();
  const p=await service.assign(manager,input);
  await assert.rejects(()=>service.updateBase(a,p.id,{designerId:'b'},1),/负责人/);
  const updated=await service.updateBase(manager,p.id,{designerId:'b',designerName:'设计师B'},1);
  assert.equal(updated.revision,2);
  assert.equal((await service.list(a)).length,0);
  assert.equal((await service.list(b)).length,1);
});
test('仅负责人可以导出，内容不含内部备注',async()=>{
  const {service}=setup();
  const p=await service.assign(manager,{...input,storeName:'=1+1'});
  await service.updateProgress(a,p.id,{notes:'机密内部记录'},1);
  await assert.rejects(()=>service.exportForClient(a),/负责人/);
  await assert.rejects(()=>service.exportForClient(exec),/负责人/);
  const csv=await service.exportForClient(manager);
  assert.ok(csv.includes("'=1+1"));
  assert.equal(csv.includes('机密内部记录'),false);
});
