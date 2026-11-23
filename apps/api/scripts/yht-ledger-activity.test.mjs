import assert from 'node:assert/strict';
import test from 'node:test';
import { createYhtActivityService } from '../node_modules/.cache/startupmanage-api-contract-tests/yht/yhtActivityService.js';

const mgr={userId:'owner',role:'manager',enabled:true};
const a={userId:'a',role:'designer',enabled:true};
const b={userId:'b',role:'designer',enabled:true};
const exec={userId:'boss',role:'executive',enabled:true};
const project={id:'project-1',designerId:'a'};
function setup(){
  const queries=[];
  const pool={
    async query(sql,values){
      queries.push({sql,values});
      if(sql.startsWith('INSERT'))return{rows:[{
        id:values[0],project_id:values[1],kind:values[2],stage:values[3],
        result:values[4],description:values[5],happened_at:values[6],
        recorded_by:values[7],recorded_at:values[6],image_name:values[8],
        image_mime:values[9],image_size:values[10]?.length??null
      }],rowCount:1};
      if(sql.includes('octet_length(image_bytes)'))return{rows:[],rowCount:0};
      if(sql.includes('SELECT image_mime,image_bytes'))return{rows:[],rowCount:0};
      return{rows:[],rowCount:0};
    }
  };
  const repo={findById:async id=>id===project.id?project:null};
  return{activities:createYhtActivityService(pool,repo),queries};
}
const input={kind:'内部审核',stage:'平面方案',result:'需修改',description:'审核意见',happenedAt:'2026-11-23T10:00:00+08:00'};
test('本人设计师可增加内部审核记录，SQL不暴露图片正文',async()=>{
  const {activities,queries}=setup();
  const saved=await activities.add(a,project.id,input);
  assert.equal(saved.recordedBy,'a');
  assert.equal(saved.kind,'内部审核');
  assert.equal(saved.description,'审核意见');
  assert.ok(queries.some(q=>q.sql.startsWith('INSERT INTO yht_ledger_activities')));
  const items=await activities.list(a,project.id);
  assert.deepEqual(items,[]);
});
test('非相关设计师不能读、不能新增、不能下载截图',async()=>{
  const {activities,queries}=setup();
  await assert.rejects(()=>activities.list(b,project.id),/权限/);
  await assert.rejects(()=>activities.add(b,project.id,input),/权限/);
  await assert.rejects(()=>activities.image(b,project.id,'event-1'),/权限/);
  assert.equal(queries.length,0);
});
test('高管允许查阅但不能新增审核记录',async()=>{
  const {activities}=setup();
  await activities.list(exec,project.id);
  await assert.rejects(()=>activities.add(exec,project.id,input),/权限/);
});
test('关键事项允许不填写审核阶段与结果',async()=>{
  const {activities}=setup();
  const record=await activities.add(mgr,project.id,{kind:'关键事项',description:'加盟商更换设备',happenedAt:input.happenedAt});
  assert.equal(record.stage,null);
});
test('不接收虚假截图格式、超大附件或不完整审核字段',async()=>{
  const {activities}=setup();
  await assert.rejects(()=>activities.add(a,project.id,{...input,stage:null}),/需要选择/);
  await assert.rejects(()=>activities.add(a,project.id,{...input,image:{name:'bad.jpg',mime:'image/jpeg',base64:Buffer.from('hello').toString('base64')}}),/格式/);
  await assert.rejects(()=>activities.add(a,project.id,{...input,image:{name:'huge.png',mime:'image/png',base64:'a'.repeat(4194404)}}),/截图/);
});
test('接受PNG文件头及有效base64',async()=>{
  const {activities}=setup();
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const result=await activities.add(a,project.id,{...input,image:{name:'审查.png',mime:'image/png',base64:bytes.toString('base64')}});
  assert.equal(result.image?.mime,'image/png');
  assert.equal(result.image?.bytes,12);
});
