import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Divider, Form, Input, Layout, Modal, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

type Role = 'manager' | 'designer' | 'executive';
type Account = {id:string;username:string;name:string;role:Role;enabled:boolean};
type Stage = '未开始' | '平面完成' | '施工图完成' | '下单完成';
type Project = {
  id:string;revision:number;region:string;storeType:string;storeName:string;contractNo:string;
  outsourcingType:'平面+施工图'|'施工图';designerId:string;designerName:string;
  assignedAt:string|null;planUploadedAt:string|null;operationsConfirmedAt:string|null;
  constructionUploadedAt:string|null;stage:Stage;notes:string;specialCases:string[];
  planScore:string;constructionScore:string;
};
type Session={account:Account|null;csrfToken?:string};
const { Header, Content } = Layout;
const stages:Stage[]=['未开始','平面完成','施工图完成','下单完成'];

function dateText(value:string|null){return value?dayjs(value).format('YYYY-MM-DD HH:mm'):'—';}
function dateInput(value:string|null){return value?dayjs(value):null;}
function days(start:string|null,end:string|null):number|null {
  if(!start||!end)return null;
  const d=(Date.parse(end)-Date.parse(start))/86400000;
  return d<0?null:Math.round(d*100)/100;
}
async function api<T>(path:string,options:RequestInit={},csrfToken?:string):Promise<T> {
  const response=await fetch('/api/yht'+path,{
    ...options,
    credentials:'same-origin',
    headers:{
      ...(options.body?{'Content-Type':'application/json'}:{}),
      ...(csrfToken?{'x-csrf-token':csrfToken}:{}),
      ...options.headers
    }
  });
  if(!response.ok){
    let msg='请求失败';
    try { const body=await response.json() as {error?:string};msg=body.error||msg; }catch{/* CSV or non-JSON error */}
    throw Error(msg);
  }
  return response.json() as Promise<T>;
}
export function YhtPortalApp(){
  const [session,setSession]=useState<Session|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [projects,setProjects]=useState<Project[]>([]);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [keyword,setKeyword]=useState('');
  const [statusFilter,setStatusFilter]=useState('全部');
  const [createOpen,setCreateOpen]=useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const [editing,setEditing]=useState<Project|null>(null);
  const [loginForm]=Form.useForm();
  const [createForm]=Form.useForm();
  const [accountForm]=Form.useForm();
  const [progressForm]=Form.useForm();
  const [messageApi,contextHolder]=message.useMessage();
  const account=session?.account;
  const csrf=session?.csrfToken;
  const manager=account?.role==='manager';

  const refresh=useCallback(async()=>{
    const data=await api<{projects:Project[]}>('/ledger');
    setProjects(data.projects);
    if(manager) {
      const result=await api<{accounts:Account[]}>('/accounts');
      setAccounts(result.accounts);
    }
  },[manager]);

  useEffect(()=>{
    void api<Session>('/session')
      .then(setSession).catch(()=>setSession({account:null})).finally(()=>setLoading(false));
  },[]);
  useEffect(()=>{
    if(account) void refresh().catch(error=>messageApi.error((error as Error).message));
  },[account?.id,refresh]);

  const rows=useMemo(()=>projects.filter(p=>{
    const q=keyword.trim().toLowerCase();
    return (!q||[p.storeName,p.region,p.contractNo,p.designerName].some(v=>v.toLowerCase().includes(q)))
      &&(statusFilter==='全部'||p.stage===statusFilter);
  }),[projects,keyword,statusFilter]);

  async function submitLogin(values:{username:string;password:string}){
    setBusy(true);
    try{
      const data=await api<{account:Account;csrfToken:string}>('/login',{method:'POST',body:JSON.stringify(values)});
      setSession(data);loginForm.resetFields();messageApi.success('登录成功');
    }catch(error){messageApi.error((error as Error).message);}
    finally{setBusy(false);}
  }
  async function logout(){
    try{await api('/logout',{method:'POST'},csrf);}
    finally{setSession({account:null});setProjects([]);setAccounts([]);}
  }
  async function create(values:{region:string;storeType:string;storeName:string;contractNo:string;outsourcingType:Project['outsourcingType'];designerId:string}){
    setBusy(true);
    try{
      const designer=accounts.find(a=>a.id===values.designerId);
      await api('/ledger',{method:'POST',body:JSON.stringify({...values,designerName:designer?.name||''})},csrf);
      setCreateOpen(false);createForm.resetFields();await refresh();messageApi.success('新门店已分配');
    }catch(error){messageApi.error((error as Error).message);}
    finally{setBusy(false);}
  }
  async function createAccount(values:{username:string;name:string;password:string;role:'designer'|'executive'}){
    setBusy(true);
    try{
      await api('/accounts',{method:'POST',body:JSON.stringify(values)},csrf);
      accountForm.resetFields();setAccountOpen(false);await refresh();messageApi.success('账号已创建');
    }catch(error){messageApi.error((error as Error).message);}
    finally{setBusy(false);}
  }
  async function saveProgress(values:Record<string,unknown>){
    if(!editing)return;
    setBusy(true);
    try{
      const dateKeys=['planUploadedAt','operationsConfirmedAt','constructionUploadedAt'] as const;
      const changes:Record<string,unknown>={stage:values.stage,notes:values.notes||''};
      for(const key of dateKeys){
        const dt=values[key] as dayjs.Dayjs|null|undefined;
        changes[key]=dt?dt.toISOString():null;
      }
      const special=typeof values.specialCases==='string'?values.specialCases.trim():'';
      changes.specialCases=special?special.split(/[，,]/u).map(v=>v.trim()).filter(Boolean):[];
      await api('/ledger/'+editing.id+'/progress',{
        method:'PATCH',body:JSON.stringify({revision:editing.revision,changes})
      },csrf);
      setEditing(null);await refresh();messageApi.success('进度已保存');
    }catch(error){messageApi.error((error as Error).message);}
    finally{setBusy(false);}
  }
  function openProgress(record:Project){
    setEditing(record);
    progressForm.setFieldsValue({
      stage:record.stage, notes:record.notes,
      specialCases:record.specialCases.join('，'),
      planUploadedAt:dateInput(record.planUploadedAt),
      operationsConfirmedAt:dateInput(record.operationsConfirmedAt),
      constructionUploadedAt:dateInput(record.constructionUploadedAt)
    });
  }
  async function exportClient(){
    try {
      const resp=await fetch('/api/yht/ledger/export.csv',{credentials:'same-origin'});
      if(!resp.ok)throw Error('导出失败，请重新登录或确认权限');
      const blob=await resp.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download='益禾堂甲方台账.csv';a.click();
      URL.revokeObjectURL(url);
    }catch(error){messageApi.error((error as Error).message);}
  }
  const columns:ColumnsType<Project>=[
    {title:'店铺名称',dataIndex:'storeName',width:210,fixed:'left',render:(name:string,row:Project)=><Button type="link" onClick={()=>openProgress(row)}>{name}</Button>},
    {title:'所属区域',dataIndex:'region',width:120},
    {title:'合同号',dataIndex:'contractNo',width:145},
    {title:'门店类型',dataIndex:'storeType',width:120},
    {title:'外协类型',dataIndex:'outsourcingType',width:130},
    {title:'外协设计师',dataIndex:'designerName',width:120},
    {title:'派单时间',dataIndex:'assignedAt',width:165,render:dateText},
    {title:'方案上传时间',dataIndex:'planUploadedAt',width:165,render:dateText},
    {title:'营运确认时间',dataIndex:'operationsConfirmedAt',width:165,render:dateText},
    {title:'施工图上传时间',dataIndex:'constructionUploadedAt',width:165,render:dateText},
    {title:'方案时效(天)',width:110,render:(_,p)=>days(p.assignedAt,p.planUploadedAt)??'—'},
    {title:'施工图时效(天)',width:125,render:(_,p)=>days(p.operationsConfirmedAt,p.constructionUploadedAt)??'—'},
    {title:'项目状态',dataIndex:'stage',width:120,render:(v:Stage)=><Tag color={v==='下单完成'?'green':v==='未开始'?'default':'blue'}>{v}</Tag>}
  ];
  if(loading)return <div style={{margin:'20vh auto',width:150}}><Spin tip="加载中"><div style={{height:80}}/></Spin></div>;
  if(!account) return (
    <div style={{minHeight:'100vh',background:'#f2f5f2',display:'grid',placeItems:'center',padding:20}}>
      {contextHolder}
      <Card style={{width:'100%',maxWidth:400,borderRadius:14,boxShadow:'0 12px 42px #00000012'}}>
        <Typography.Title level={3} style={{marginBottom:4}}>益禾堂 · 设计项目管理</Typography.Title>
        <Typography.Paragraph type="secondary">内部工作平台 · 请使用公司分配的账号登录</Typography.Paragraph>
        <Form form={loginForm} layout="vertical" onFinish={submitLogin} style={{marginTop:28}}>
          <Form.Item name="username" label="账号" rules={[{required:true,message:'请输入账号'}]}><Input autoComplete="username" size="large"/></Form.Item>
          <Form.Item name="password" label="密码" rules={[{required:true,message:'请输入密码'}]}><Input.Password autoComplete="current-password" size="large"/></Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={busy}>登录系统</Button>
        </Form>
      </Card>
    </div>
  );
  return <Layout style={{minHeight:'100vh',background:'#f5f7f5'}}>
    {contextHolder}
    <Header style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',padding:'0 30px',borderBottom:'1px solid #eee'}}>
      <Space><Typography.Title level={4} style={{margin:0,color:'#14532d'}}>益禾堂</Typography.Title><Typography.Text type="secondary">设计项目管理系统</Typography.Text></Space>
      <Space><Tag>{manager?'项目负责人':account.role==='designer'?'设计师':'高管'}</Tag><Typography.Text>{account.name}</Typography.Text><Button onClick={()=>void logout()}>退出</Button></Space>
    </Header>
    <Content style={{padding:'28px',maxWidth:1760,width:'100%',margin:'0 auto'}}>
      <Space direction="vertical" size="large" style={{width:'100%'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div><Typography.Title level={3} style={{marginBottom:4}}>{manager?'全部门店':account.role==='designer'?'我的门店':'门店总览'}</Typography.Title><Typography.Text type="secondary">一店一档，进度统一更新，数据只维护一次</Typography.Text></div>
          <Space wrap>
            <Button onClick={()=>void refresh()}>刷新</Button>
            {manager && <Button onClick={()=>setAccountOpen(true)}>新增设计师账号</Button>}
            {manager && <Button onClick={()=>void exportClient()}>导出甲方台账</Button>}
            {manager && <Button type="primary" onClick={()=>setCreateOpen(true)}>+ 新建门店 / 派单</Button>}
          </Space>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14}}>
          <Card><Statistic title="项目总数" value={projects.length}/></Card>
          <Card><Statistic title="进行中" value={projects.filter(p=>p.stage!=='未开始'&&p.stage!=='下单完成').length}/></Card>
          <Card><Statistic title="下单完成" value={projects.filter(p=>p.stage==='下单完成').length}/></Card>
          <Card><Statistic title="未开始" value={projects.filter(p=>p.stage==='未开始').length}/></Card>
        </div>
        <Card>
          <Space wrap style={{marginBottom:16}}>
            <Input.Search placeholder="搜索门店/合同号/区域/设计师" value={keyword} onChange={e=>setKeyword(e.target.value)} allowClear style={{width:300}}/>
            <Select value={statusFilter} onChange={setStatusFilter} style={{width:160}} options={['全部',...stages].map(v=>({label:v,value:v}))}/>
          </Space>
          <Table<Project> rowKey="id" columns={columns} dataSource={rows} size="middle" scroll={{x:1900}} pagination={{pageSize:20,showSizeChanger:true}}/>
        </Card>
      </Space>
    </Content>
    <Modal title="新建门店并分配设计师" open={createOpen} onCancel={()=>setCreateOpen(false)} onOk={()=>createForm.submit()} okButtonProps={{loading:busy}} destroyOnClose>
      <Form form={createForm} layout="vertical" onFinish={create} initialValues={{outsourcingType:'平面+施工图',storeType:'6.5整店'}}>
        <Form.Item name="region" label="所属区域" rules={[{required:true}]}><Input placeholder="如：湖北区域"/></Form.Item>
        <Form.Item name="storeType" label="6.5整店 / 门店类型" rules={[{required:true}]}><Input/></Form.Item>
        <Form.Item name="storeName" label="店铺名称" rules={[{required:true}]}><Input/></Form.Item>
        <Form.Item name="contractNo" label="合同号" rules={[{required:true}]}><Input/></Form.Item>
        <Form.Item name="outsourcingType" label="外协类型" rules={[{required:true}]}><Select options={['平面+施工图','施工图'].map(v=>({label:v,value:v}))}/></Form.Item>
        <Form.Item name="designerId" label="分配设计师" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={accounts.filter(a=>a.role==='designer'&&a.enabled).map(a=>({label:a.name+'（'+a.username+'）',value:a.id}))}/></Form.Item>
      </Form>
    </Modal>
    <Modal title="创建内部账号" open={accountOpen} onCancel={()=>setAccountOpen(false)} onOk={()=>accountForm.submit()} okButtonProps={{loading:busy}} destroyOnClose>
      <Alert type="info" showIcon message="创建后请安全地将初始密码交给设计师，不要在群里公开发送。"/>
      <Form form={accountForm} onFinish={createAccount} layout="vertical" style={{marginTop:18}} initialValues={{role:'designer'}}>
        <Form.Item label="登录账号" name="username" rules={[{required:true}]}><Input placeholder="如 designer01"/></Form.Item>
        <Form.Item label="姓名" name="name" rules={[{required:true}]}><Input/></Form.Item>
        <Form.Item label="初始密码（至少12位）" name="password" rules={[{required:true,min:12}]}><Input.Password/></Form.Item>
        <Form.Item label="角色" name="role" rules={[{required:true}]}><Select options={[{label:'设计师',value:'designer'},{label:'高管（只读）',value:'executive'}]}/></Form.Item>
      </Form>
    </Modal>
    <Modal title={editing?'更新进度 · '+editing.storeName:'更新进度'} open={!!editing} onCancel={()=>setEditing(null)} onOk={()=>progressForm.submit()} okButtonProps={{loading:busy}} destroyOnClose width={620}>
      {editing && <><Descriptions size="small" bordered column={2} style={{marginBottom:16}} items={[{key:'1',label:'合同号',children:editing.contractNo},{key:'2',label:'设计师',children:editing.designerName},{key:'3',label:'派单时间',children:dateText(editing.assignedAt)},{key:'4',label:'外协类型',children:editing.outsourcingType}]}/><Divider/></>}
      <Form form={progressForm} onFinish={saveProgress} layout="vertical">
        <Form.Item name="stage" label="项目状态"><Select options={stages.map(v=>({label:v,value:v}))}/></Form.Item>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Form.Item name="planUploadedAt" label="方案上传时间"><DatePicker showTime style={{width:'100%'}} format="YYYY-MM-DD HH:mm"/></Form.Item>
          <Form.Item name="operationsConfirmedAt" label="营运确认方案时间"><DatePicker showTime style={{width:'100%'}} format="YYYY-MM-DD HH:mm"/></Form.Item>
          <Form.Item name="constructionUploadedAt" label="施工图上传时间"><DatePicker showTime style={{width:'100%'}} format="YYYY-MM-DD HH:mm"/></Form.Item>
        </div>
        <Form.Item name="specialCases" label="特殊情况（多个用逗号分隔）"><Input/></Form.Item>
        <Form.Item name="notes" label="备注"><Input.TextArea rows={3}/></Form.Item>
      </Form>
      <Alert type="info" showIcon message="当前为第一阶段台账功能；审核截图、甲方反馈和金额核算将在后续模块加入。"/>
    </Modal>
  </Layout>;
}
