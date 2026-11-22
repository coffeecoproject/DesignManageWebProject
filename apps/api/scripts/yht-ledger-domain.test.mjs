import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FEISHU_2026_COLUMNS, CLIENT_EXPORT_HEADERS, assertManager, canReadProject,
  canChangeFields, validateManagerCreate, validateProgressPatch,
  durationDays, getDurations, classifyLegacyRow, buildClientCsv
} from '../src/yht/yhtLedgerDomain.ts';

const manager = {userId:'manager-1',role:'manager',enabled:true};
const designerA = {userId:'designer-A',role:'designer',enabled:true};
const designerB = {userId:'designer-B',role:'designer',enabled:true};
const executive = {userId:'executive-1',role:'executive',enabled:true};
const project = {
  id:'project-1', sourceRecordId:'rec-1', region:'湖北', storeType:'6.5整店',
  storeName:'示例门店', contractNo:'HT-001', outsourcingType:'平面+施工图',
  designerId:'designer-A', designerName:'设计师A',
  assignedAt:'2026-11-01T10:00:00+08:00',
  planUploadedAt:'2026-11-03T10:00:00+08:00',
  operationsConfirmedAt:'2026-11-04T10:00:00+08:00',
  constructionUploadedAt:'2026-11-07T10:00:00+08:00',
  stage:'施工图完成', specialCases:['客户改图'], notes:'内部说明', planScore:'90',
  constructionScore:'88', createdBy:'manager-1', updatedAt:'2026-11-07T10:00:00+08:00'
};
test('原始快照字段数和甲方导出字段数符合约定',()=>{
  assert.equal(FEISHU_2026_COLUMNS.length,25);
  assert.equal(CLIENT_EXPORT_HEADERS.length,14);
});
test('负责人可派单；普通人员无权派单',()=>{
  assert.doesNotThrow(()=>assertManager(manager));
  assert.throws(()=>assertManager(designerA));
  assert.throws(()=>assertManager(executive));
  assert.throws(()=>assertManager({...manager,enabled:false}));
});
test('设计师只能读写本人分配的项目，不能更改合同/指派',()=>{
  assert.equal(canReadProject(manager,project),true);
  assert.equal(canReadProject(designerA,project),true);
  assert.equal(canReadProject(designerB,project),false);
  assert.equal(canReadProject(executive,project),true);
  assert.equal(canChangeFields(designerA,project,['stage','planUploadedAt']),true);
  assert.equal(canChangeFields(designerA,project,['contractNo']),false);
  assert.equal(canChangeFields(designerB,project,['stage']),false);
  assert.equal(canChangeFields(executive,project,['stage']),false);
  assert.equal(canChangeFields(manager,project,['contractNo','designerId']),true);
});
test('六项派单信息必填且外协类型合法',()=>{
  const input={region:'湖北',storeType:'6.5整店',storeName:'示例门店',
    contractNo:'HT-001',outsourcingType:'平面+施工图',
    designerId:'designer-A',designerName:'设计师A'};
  assert.deepEqual(validateManagerCreate(input),input);
  assert.throws(()=>validateManagerCreate({...input,designerId:''}));
  assert.throws(()=>validateManagerCreate({...input,outsourcingType:'不明确'}));
});
test('设计师进度只更新许可的字段；不能注入基础字段',()=>{
  assert.deepEqual(validateProgressPatch({stage:'平面完成'}),{stage:'平面完成'});
  assert.throws(()=>validateProgressPatch({contractNo:'改合同'}));
  assert.throws(()=>validateProgressPatch({stage:'未经审核'}));
  assert.throws(()=>validateProgressPatch({planUploadedAt:'无效时间'}));
});
test('时效：只计算完整日期，不把缺失时间当作0',()=>{
  assert.equal(durationDays('2026-11-03T10:00:00+08:00','2026-11-01T10:00:00+08:00'),2);
  assert.equal(durationDays(null,'2026-11-01T10:00:00+08:00'),null);
  assert.equal(durationDays('2026-11-01T10:00:00+08:00','2026-11-03T10:00:00+08:00'),null);
  assert.deepEqual(getDurations(project),{plan:2,construction:3,total:5});
  assert.deepEqual(getDurations({...project,operationsConfirmedAt:null}),{plan:2,construction:null,total:null});
});
test('甲方导出白名单不泄漏内部问题、评分和财务信息',()=>{
  const csv=buildClientCsv([{...project, notes:'仅内部看的信息',specialCases:['内部责任'],planScore:'秘密分数',storeName:'=HYPERLINK("https://bad.example")'}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(!csv.includes('仅内部看的信息'));
  assert.ok(!csv.includes('内部责任'));
  assert.ok(!csv.includes('秘密分数'));
  assert.ok(!csv.includes('sourceRecordId'));
});
test('导入预览保留不完整记录并标明不可直接派单',()=>{
  const valid={source_record_id:'rec-123','所属区域':'湖北','6.5整店':'6.5整店',
    '店铺名称':'示例','合同号':'HT-1','外协类型':'施工图','外协设计师':'设计师A'};
  assert.deepEqual(classifyLegacyRow(valid).missingFields,[]);
  assert.equal(classifyLegacyRow(valid).readyForImport,true);
  assert.equal(classifyLegacyRow(valid).requiresDesignerAccountMapping,true);
  const incomplete=classifyLegacyRow({...valid,'合同号':''});
  assert.equal(incomplete.readyForImport,false);
  assert.deepEqual(incomplete.missingFields,['合同号']);
});
