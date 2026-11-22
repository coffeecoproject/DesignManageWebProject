-- 益禾堂台账业务切片；新表，不修改现有客户/门店/任务与财务表。
-- 执行前在隔离数据库中验证，正式库应用需独立审查和备份。
-- yh_ledger_projects 仅存台账字段；后续通过 store_task_id 对接通用任务。
CREATE TABLE IF NOT EXISTS yht_ledger_projects (
  id text PRIMARY KEY,
  store_task_id text UNIQUE,
  source_record_id text UNIQUE,
  region text NOT NULL,
  store_type text NOT NULL,
  store_name text NOT NULL,
  contract_no text NOT NULL,
  outsourcing_type text NOT NULL CHECK (outsourcing_type IN ('平面+施工图','施工图')),
  designer_id text NOT NULL,
  designer_name text NOT NULL,
  assigned_at timestamptz,
  plan_uploaded_at timestamptz,
  operations_confirmed_at timestamptz,
  construction_uploaded_at timestamptz,
  stage text NOT NULL CHECK (stage IN ('未开始','平面完成','施工图完成','下单完成')),
  special_cases jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(special_cases) = 'array'),
  notes text NOT NULL DEFAULT '',
  plan_score text NOT NULL DEFAULT '',
  construction_score text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  updated_at timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);

CREATE INDEX IF NOT EXISTS yht_ledger_projects_designer_id_idx
  ON yht_ledger_projects (designer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS yht_ledger_projects_assigned_at_idx
  ON yht_ledger_projects (assigned_at DESC);
CREATE INDEX IF NOT EXISTS yht_ledger_projects_contract_no_idx
  ON yht_ledger_projects (contract_no);

CREATE TABLE IF NOT EXISTS yht_ledger_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES yht_ledger_projects(id),
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('派单', '更新进度', '更新基础资料')),
  changed_fields jsonb NOT NULL CHECK (jsonb_typeof(changed_fields) = 'array'),
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS yht_ledger_audit_events_project_idx
  ON yht_ledger_audit_events (project_id, id DESC);

-- 历史迁移时 source_record_id 去重，绝不根据店名或合同号简单合并。
-- 不执行任何真实台账导入、TRUNCATE、DROP或生产数据库修改。

-- 益禾堂独立门户账号。不能使用前端演示账号作为真实身份。
CREATE TABLE IF NOT EXISTS yht_portal_accounts (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager','designer','executive')),
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS yht_portal_sessions (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES yht_portal_accounts(id),
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS yht_portal_sessions_expiry_idx ON yht_portal_sessions(expires_at);
