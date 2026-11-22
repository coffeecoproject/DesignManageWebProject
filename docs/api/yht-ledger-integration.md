# 益禾堂台账 API 与数据库集成说明（未接入生产）

## 当前实现（开发分支）

- 领域规则：`apps/api/src/yht/yhtLedgerDomain.ts`
- 业务服务：`apps/api/src/yht/yhtLedgerService.ts`
- PostgreSQL Repository：`apps/api/src/yht/yhtLedgerPostgresRepository.ts`
- HTTP 处理器：`apps/api/src/yht/yhtLedgerHttpHandler.ts`
- 增量建表文件：`apps/api/migrations/20261122_yht_ledger.sql`
- 合约测试：`apps/api/scripts/yht-ledger-*.test.mjs`

**注意：这是可集成的业务切片，不代表现有 Web 已能调用。** 没有注册 HTTP 路由，没有替换仓库固定演示账号，也没有真实数据库执行/测试证明。

## 已定义 HTTP 接口

| 方法 | 路径 | 角色 | 作用 |
| --- | --- | --- | --- |
| GET | /api/yht/ledger | 负责人/设计师/高管 | 依角色过滤项目 |
| POST | /api/yht/ledger | 项目负责人 | 填6项基础数据并派单 |
| GET | /api/yht/ledger/:id | 有项目权限的人员 | 单店详情 |
| PATCH | /api/yht/ledger/:id/progress | 负责人/负责设计师 | 更新进度字段 |
| PATCH | /api/yht/ledger/:id/base | 项目负责人 | 修改基础信息或改派 |
| GET | /api/yht/ledger/export.csv | 项目负责人 | 甲方字段白名单导出 |

PATCH 请求示意：

```json
{"revision":1,"changes":{"stage":"平面完成","planUploadedAt":"2026-11-22T16:00:00+08:00"}}
```

- 版本冲突：409，请刷新；未认证：401；权限不足：403。
- 外部下载不可直接复用内部完整台账：必须使用白名单。
- 编辑之后应保留审计日志。高管只能查看数据，不得直接操作派单。

## 后端接线要求

1. 从真实服务器会话获取 `LedgerPrincipal`。**严禁从请求体或 `x-role` 一类任意 HTTP 头解析角色**。
2. `resolveDesigner` 必须查询系统人员/账号目录：指定账号存在、启用且设计师角色正确；显示姓名从目录获取，不信任客户端。
3. 在业务服务器使用受管 PostgreSQL Pool 创建 `createYhtPostgresRepository(pool)`，再用 `createYhtLedgerService` 注入 ID、服务器时钟和账号查询，最后接 `createYhtLedgerHttpHandler`。
4. 在路由框架完成 body 大小限制、CORS/CSRF（如基于 cookie）、请求限速、错误日志，以及对真实 JSON/CSV Response 的序列化。
5. 迁移 SQL 仅用于独立测试库/经批准的新schema迁移。正式应用必须先完成数据库备份、回滚策略和权限复核。
6. 现有通用门店/任务记录为系统主业务对象。正式接入前，必须明确 `store_task_id` 的关联写入及一致性策略，避免建立第二套独立任务台账。
7. 登陆/身份尚为演示模式时，不得将新路由对外开放。

## 本地验证指令（需要在可用完整仓库的 Codex 工作区中执行）

```bash
corepack pnpm install
corepack pnpm --filter @startupmanage/api typecheck
corepack pnpm --filter @startupmanage/api exec tsc -p tsconfig.test.json
node --test apps/api/scripts/yht-ledger-domain.test.mjs \
  apps/api/scripts/yht-ledger-service.test.mjs \
  apps/api/scripts/yht-ledger-postgres.test.mjs \
  apps/api/scripts/yht-ledger-http.test.mjs
```

这些是**待执行的命令**，不能当作通过的验证结果。PostgreSQL的真实事务、字段映射、数据库连接和重启持久化，还需要独立集成测试，mock测试不能代替。

## 原始台账迁移校验

使用本地转换器解析 `.base` 文件：共501条记录、25字段、2视图，解析警告为0。
- 484条具备六项派单基础字段。
- 17条不完整，其中12条多字段缺失，另外5条仅缺合同号（可由缺失字段统计推断）。
- 不能直接把中文设计师姓名当作真实人员账号ID。
- 无法关联账号或缺资料的记录保留在预览/待修复状态，不能默默丢弃，也不能自动派到错误的人。
- 原始客户数据仅在受控导入环境处理，不上传Git。

## 后续最小交付步骤

1. 接入现有认证与账号目录，禁止演示身份进入新接口。
2. 在独立PostgreSQL测试实例执行增量迁移并验证项目+审计事务。
3. 把台账数据关联到现有门店任务对象，补齐存储和接口集成测试。
4. 复用Ant Design页面接入负责人派单和设计师进度更新。
5. 先预览再导入历史数据，再进行可重放的幂等迁移和甲方导出。
6. 审核截图、关键事项、月度总结、金额复核按后续阶段实施。

## 风险与边界

尚未有真实账号登录、多角色环境验证、实际数据库连接、前端页面或生产部署。
此阶段应保持 PR 为 Draft，不合并主分支，也不修改真实业务数据。
