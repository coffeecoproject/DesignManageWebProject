# 益禾堂 2027 内部台账 — 本地试用操作说明

> 当前只适用于本机开发环境。请勿直接绑定公网、部署生产或用真实账户密码群发。前端入口：`http://127.0.0.1:5173/yht`。

## 0. 当前范围

本地 MVP 支持：
- 管理员账号登录、创建设计师/只读高管账号；
- 项目负责人建店、分配设计师、搜索筛选、按甲方白名单导出 CSV；
- 设计师登录后只看到自己的门店，可更新进度、日期、特殊事项及备注；
- PostgreSQL 数据持久化与审计记录、乐观锁防止更新覆盖。

**暂未支持**：截图上传/审核、附件归档、2026年历史数据自动导入、月度财务结算、与原通用任务模块双向联动、人员停用/密码重置UI、正式上线和备份恢复。

## 1. 独立 worktree（不要改 main）

```bash
git fetch origin
git worktree add ../DesignManageWebProject-yht -b local/yht-test origin/feat/yht-ledger-mvp-2027
cd ../DesignManageWebProject-yht
corepack pnpm install
```

如果本地已有 `local/yht-test`，应复用/拉取，不要盲目覆盖。

## 2. 启动隔离 PostgreSQL

按仓库的 `docs/operations/local-database-runbook.md`：

```bash
scripts/local/db-up.sh
scripts/local/db-status.sh
napbox env
```

从环境输出中读取 `NAPBOX_POSTGRES_5432` 端口，不要假设默认5432。

用工作树**隔离开发库**执行新增建表 SQL：

```bash
scripts/local/db-psql.sh -v ON_ERROR_STOP=1 -f apps/api/migrations/20261122_yht_ledger.sql
```

生产库/schema 迁移必须另外审核和批准。SQL 仅 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`；仍要验证现有对象是否冲突。

## 3. 配置本地 API

从 `napbox env` 获得实际端口，在本地终端设置：

```bash
export YHT_DATABASE_URL='postgres://startupmanage_app:startupmanage_local_dev_only@127.0.0.1:<实际端口>/startupmanage_local'
export YHT_BOOTSTRAP_USER='owner'
export YHT_BOOTSTRAP_PASSWORD='<自行设置12-256字符的强密码>'
export YHT_RUN_SERVER='true'
export YHT_HOST='127.0.0.1'
export YHT_PORT='8787'
```

命令行中的密码不应提交Git。这里只是开发环境账号初始化，已有账号的密码**不会**被这些变量覆盖。

编译并启动（单独终端，项目根目录）：

```bash
corepack pnpm --filter @startupmanage/api exec tsc -p tsconfig.test.json
node apps/api/node_modules/.cache/startupmanage-api-contract-tests/yht/yhtPortalServer.js
```

启动后应提示 `YHT portal API listening on http://127.0.0.1:8787`。如果数据库未建表/无法连接，会报错。

## 4. 启动前端

另一终端运行：

```bash
corepack pnpm dev:web
```

打开 `http://127.0.0.1:5173/yht`。Vite 开发代理将 `/api/yht` 转发至127.0.0.1:8787，不要求公网域名/跨域权限。

用 owner 登录，再创建设计师账号；使用不同浏览器或无痕窗口登录设计师账户验证数据隔离。

## 5. 最小验收场景

1. 负责人建店并指定设计师A。
2. A能看到此门店，B看不到；A更新方案上传时间。
3. 刷新A与负责人页面，时间仍存在；A尝试修改合同号的服务端请求应返回错误。
4. 负责人把任务改派给B（当前前端暂没有改派按钮，需通过API验收）；A刷新后不再看见，B能看见。
5. 管理员导出CSV；不含内部备注、评分、财务及特殊情况。设计师导出返回403。
6. 同一条记录两个页面用相同 `revision` 并发提交，一次成功后另一请求返回409。
7. 项目更新必须与审计日志写入同一事务；日志失败时项目修改应回滚。

## 6. 待执行代码验证

```bash
corepack pnpm --filter @startupmanage/api typecheck
corepack pnpm --filter @startupmanage/api exec tsc -p tsconfig.test.json
node --test apps/api/scripts/yht-ledger-domain.test.mjs apps/api/scripts/yht-ledger-service.test.mjs apps/api/scripts/yht-ledger-postgres.test.mjs apps/api/scripts/yht-ledger-http.test.mjs
corepack pnpm --filter @startupmanage/web typecheck
corepack pnpm build:web
```

测试通过后仍需执行实际 PostgreSQL 迁移、登录/权限、刷新与导出验证。当前GitHub API提交环境不具备本机Napbox及完整pnpm依赖，**尚无以上命令通过的证据**。

## 7. 使用边界

- 现有大管理系统的其他路由保持原样；`/yht` 为独立账号和工作台，不共享前端演示账号。
- 不在浏览器模拟管理员身份，权限由本地后端会话与服务端业务规则控制。
- 新 YHT 台账此阶段是该品牌唯一录入入口。和现有通用任务模型的稳定关联仍待接入，不能在两处同时为益禾堂新增任务。
- 未加证书、反向代理和生产会话/备份安全审查前，只能绑定本机127.0.0.1。
- 不允许将用户的真实 `.base` 或转换结果提交Git仓库。
