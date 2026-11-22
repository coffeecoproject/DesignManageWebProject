import assert from 'node:assert/strict';
import test from 'node:test';
import { createYhtPostgresRepository } from '../node_modules/.cache/startupmanage-api-contract-tests/yht/yhtLedgerPostgresRepository.js';

function fixture() {
  const calls = [];
  let rowCount = 1;
  let failAudit = false;
  let released = 0;
  const connection = {
    async query(sql, params) {
      calls.push({sql,params});
      if (failAudit && sql.includes('INSERT INTO yht_ledger_audit_events')) throw Error('audit failed');
      if (sql.startsWith('UPDATE')) return {rows:[],rowCount};
      return {rows:[],rowCount:1};
    },
    release(){ released++; }
  };
  return {
    pool: {connect:async()=>connection,query:async()=>({rows:[],rowCount:0})},
    calls,
    setConflict:()=>{rowCount=0;},
    setAuditFailure:()=>{failAudit=true;},
    released:()=>released
  };
}
const project={
  id:'test-1', sourceRecordId:null, region:'湖北',storeType:'6.5整店',storeName:'测试门店',
  contractNo:'HT-001',outsourcingType:'施工图',designerId:'designer-a',designerName:'设计师甲',
  assignedAt:'2026-11-22T17:00:00+08:00',planUploadedAt:null,operationsConfirmedAt:null,
  constructionUploadedAt:null,stage:'未开始',specialCases:[],notes:'',planScore:'',
  constructionScore:'',createdBy:'owner',updatedAt:'2026-11-22T17:00:00+08:00',revision:1
};
const audit={projectId:'test-1',actorId:'owner',action:'派单',changedFields:['storeName'],createdAt:'2026-11-22T17:00:00+08:00'};
test('派单和审计写入处于同一事务',async()=>{
  const f=fixture();
  await createYhtPostgresRepository(f.pool).insertWithAudit(project,audit);
  assert.deepEqual(f.calls.map(c=>c.sql.split(' ')[0]),['BEGIN','INSERT','INSERT','COMMIT']);
  assert.equal(f.released(),1);
  assert.equal(f.calls.some(c=>c.sql==='ROLLBACK'),false);
});
test('审计失败回滚派单',async()=>{
  const f=fixture(); f.setAuditFailure();
  await assert.rejects(()=>createYhtPostgresRepository(f.pool).insertWithAudit(project,audit),/audit failed/);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.released(),1);
});
test('按版本条件更新，冲突不写审计',async()=>{
  const f=fixture();f.setConflict();
  assert.equal(await createYhtPostgresRepository(f.pool).updateWithAudit({...project,revision:2},1,{...audit,action:'更新进度'}),false);
  assert.equal(f.calls.filter(c=>c.sql.includes('INSERT INTO yht_ledger_audit_events')).length,0);
  assert.equal(f.calls.at(-1).sql,'COMMIT');
});
test('成功的进度更新版本加1并写审计',async()=>{
  const f=fixture();
  assert.equal(await createYhtPostgresRepository(f.pool).updateWithAudit({...project,revision:2,stage:'平面完成'},1,{...audit,action:'更新进度'}),true);
  const update=f.calls.find(c=>c.sql.startsWith('UPDATE'));
  assert.ok(update.sql.includes('revision = revision + 1'));
  assert.ok(update.sql.includes('AND revision = $'));
  assert.ok(update.params.includes('平面完成'));
  assert.ok(f.calls.some(c=>c.sql.includes('INSERT INTO yht_ledger_audit_events')));
  assert.equal(f.calls.at(-1).sql,'COMMIT');
});
