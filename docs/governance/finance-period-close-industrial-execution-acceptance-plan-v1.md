# 财务期间结账工业化执行与验收方案 V1

Date: 2026-07-01

Status: `execution_acceptance_plan`

Owner: `财务管理 / 期间结账`

Related contracts and plans:

- `docs/api/finance-period-close-api-contract.md`
- `docs/data/finance-period-close-data-contract.md`
- `docs/data/finance-period-close-source-mutation-matrix.md`
- `docs/data/finance-accounting-voucher-ledger-contract.md`
- `docs/governance/finance-accounting-backend-implementation-preplan-v1.md`
- `docs/governance/finance-accounting-voucher-full-workflow-plan-v1.md`
- `docs/data/finance-funds-voucher-phase1-backend-contract.md`
- `docs/data/finance-tax-accounting-backend-contract.md`
- `docs/web/route-page-inventory.md`
- `docs/testing/test-plan.md`
- `docs/evidence/finance-period-close-phase1-3-contract-evidence.md`

## 1. 文档定位

本方案用于把 `财务管理 / 期间结账` 从前端会话内检查页，升级为后续可接入真实后端、源单锁定、来源事项检查、总账、报表和反结账治理的工业化执行方案。

本方案不是法律、税务或审计意见；不是生产实施证明；不是数据库 migration；不是后端 API 已实现声明。

本方案固定以下口径：

```text
业务事实
  -> 原始凭证 / 发票 / 税额依据 / 资金事实
  -> 会计凭证候选
  -> 制单
  -> 记账入总账
  -> 来源事项完成
  -> 期间结账检查
  -> 确认结账并锁期
  -> 正式报表 / 后续调整 / 异常反结账
```

期间结账是最后的检查和锁期动作，不承载具体业务处理动作。具体处理动作仍归属于应收应付、发票匹配、收支流水、流水复核、银行对账、薪酬社保、税务办理、会计凭证、固定资产等来源模块。

## 2. 当前状态

截至本方案创建时，前端已经具备以下原型能力：

- `/finance/accounting-vouchers` 支持前端会话内 `制单 -> 记账 -> 冲销` 生命周期。
- `/finance/general-ledger` 从已记账凭证读取期间科目余额。
- `/finance/period-close` 已有八项前端检查：
  - 凭证来源
  - 凭证记账
  - 总账试算
  - 财务报表
  - 流水复核
  - 银行对账
  - 税务办理
  - 社保公积金
- `/finance/period-close` 通过确认抽屉写入前端会话内期间锁。

当前仍未具备以下正式能力：

- 后端持久化期间锁。
- 后端统一 `close-checks`。
- 源单更新 API 的锁期校验。
- 真实来源事项汇总、自动计提/摊销/折旧和候选凭证生成。
- 反结账 / 后续期间调整的正式流程。
- 正式三张表和结账报表快照。
- 审计级会计档案、电子凭证归档和恢复演练证据。

### 2.1 阶段性执行记录

2026-07-02 前端原型层已补齐：

- `close-checks` 展示口径增加 `报表准备` 检查项；前端页面不在期间结账页生成报表，后端目标契约应从财务报表 readiness 派生该检查的阻断原因。
- `AccountingPeriodLockRecord` 前端模型支持 `开放 / 已结账 / 已反结账` 状态。
- 前端会话内增加统一期间锁 guard，并在主要源单 mutation 入口使用同一套关闭期间提示：
  - 应收应付调整和收付款登记。
  - 发票匹配、撤销匹配、红冲原票确认、后续开票确认。
  - 收支流水复核、退回、作废、凭证补充。
  - 银行对账确认和银行流水补登记系统流水。
  - 税费缴款流水生成。
  - 员工代收提交、费用报销审核通过后生成应付事项。
  - 收支流水冲正补差。
  - 会计凭证制单、记账、冲销。
- 会计凭证页已把“开放期间冲销”和“已结账历史期间后续调整”拆成两条前端原型路径：
  - 开放期间 `已记账` 凭证仍走同期间冲销。
  - 已结账历史期间 `已记账` 凭证生成后续期间 `调整凭证` 候选，原凭证不改为 `已冲销`。
  - 后续调整候选已接入会计凭证、总账和期间结账的同一前端会话读模型。
- 关键页面已增加禁用态或明确提示，避免前端状态层拒绝后仍显示操作成功。

该记录不改变正式完成定义：后端 `close-checks`、源单 API 锁期校验、正式反结账和后续期间调整目前只有本地
framework-agnostic contract skeleton；持久化期间锁、真实 HTTP/API 集成、权限、事务和数据库证据仍未实现。

### 2.1.1 当前执行边界修正

2026-07-02 曾把沟通和实现主线收回到前端，以避免把前端 session 状态误称为正式锁期能力。当前目标已经切换为期间结账工业化落地，因此执行边界同步调整为本地后端契约加固：

- 当前可继续落地的内容包括 `apps/api` 本地 contract、具体框架 adapter、Node HTTP listener、row-backed repository harness、身份/session/权限/账套资源授权契约、源单闭期守卫契约、前端阶段矩阵和治理证据。
- 仍不得把本地 listener、row-backed candidate rows、framework-agnostic contract 或前端 session read model 说成生产后端、真实数据库持久化或正式锁期能力。
- 本阶段不得执行生产部署、生产配置、真实数据库 migration、生产数据处理、生产身份/session/cookie 策略或发布证据；进入这些范围前必须另行确认。
- 任何 close-out 均必须明确“本地后端契约证据”和“生产后端未就绪”的边界。

### 2.1.2 当前本地后端契约执行轨道

2026-07-04 之后继续执行期间结账时，当前轮次固定为本地后端契约加固：

- 优先推进本地 `close-checks`、期间锁、源单闭期守卫、真实本地 HTTP listener 和 request chain 的 contract tests。
- 优先补齐 identity/session/permission/ledger-resource SQL-shape、auth/resource middleware、row-backed repository gateway、period-close SQL migration/repository transaction contract、PostgreSQL migration plan contract、project migration artifact contract、本地 PostgreSQL dry-run/apply/concurrency drill 和治理证据。
- 保持 `/finance/accounting-vouchers`、`/finance/general-ledger`、`/finance/period-close` 等前端页面作为会话内呈现和回看入口，但不把前端状态作为正式锁期证据。
- 不在当前轮次推进生产数据库 migration、生产源单 API/repository guard、生产权限中间件、发布、恢复或生产证据。
- `/finance/financial-statements` 已作为前端会话内只读正式报表承接页接入，当前只读取已记账总账和科目余额，区分 `待结账` 与 `正式报表`；现金流量表已按已记账现金/银行分录和对方科目 `cashFlowItem / cashFlowActivity` 映射生成，缺映射时显示待补映射并阻断结账，不从应收应付、流水、发票等业务源单倒推。
- `/finance/accounting-subjects` 已把 `cashFlowItem / cashFlowActivity` 作为会计科目的只读内置映射呈现，供现金流量表追溯来源；当前不开放业务侧编辑，后端接入前不声明映射版本、审批或生效期能力。
- `/finance/period-close` 前端 `报表准备` 检查已复用财务报表模型的现金流量映射缺口：总账试算平衡但现金/银行分录对方科目缺少现金流量项目映射时，期间仍为 `需处理`，并归口跳转到 `/finance/financial-statements`。
- `/finance/period-close` 前端已移除独立调整检查：薪酬社保、税务办理、后续调整和其他来源事项通过各自来源模块状态和会计凭证状态进入结账检查；期间结账只显示汇总检查结果，不在结账页处理来源事项，也不显示假入口。
- `/finance/period-close` 前端 `凭证制单 / 凭证记账` 检查已从泛化跳转升级为深链处理入口：跳转 `/finance/accounting-vouchers` 时带归属月份、凭证状态和单号参数；会计凭证页读取参数后自动筛选并打开对应制单事项或已制单凭证抽屉，期间结账仍只负责导航，不在结账抽屉内处理凭证。
- `/finance/accounting-vouchers` 前端后续期间调整已把重复校验前移到入口模型和抽屉验证：同一原凭证在同一调整期间已有后续调整事项时，入口不再引导同期间重复创建；如存在后续开放期间，则列表下一步和详情入口默认指向下一个可用调整期间，并在详情回看既有调整事项号；抽屉仍会禁用重复提交，避免状态层静默去重造成 false-success。
- 前端模型已覆盖后续期间调整的目标期间结账闭环：`待制单` 调整阻断凭证制单，`已制单` 调整阻断凭证记账，`已记账` 调整进入目标期间总账并允许目标期间在其他检查通过时结账；原已结账期间继续读取结账时快照，只追加后续调整回看上下文，不因目标期间调整凭证改写历史期间汇总。
- `apps/api/src/finance/financialStatementContract.ts` 和 `financialStatementRoutes.ts` 已补本地后端目标契约：正式报表快照只能基于已结账期间生成，现金流量表缺对方科目映射时返回 `CASH_FLOW_MAPPING_INCOMPLETE`，快照保存源总账 hash、现金流映射版本 hash 和按科目聚合的 `generalLedgerLines`；route adapter 覆盖 readiness、生成快照、读取最新快照、displayed-readiness hash stale、既有快照不重写和 latest 回看不随当前 ledger entries 漂移。`periodCloseDatabaseContract.ts` 已同步补候选 DB rows，用于保存正式报表快照、报表行和按科目聚合的总账快照行，并校验快照只能引用已结账期间、总账行 source-ledger hash 必须与快照一致。该契约仍不是真实监听 HTTP endpoint、SQL migration、真实 snapshot repository 或正式归档证据。
- `apps/api/src/finance/periodCloseRoutes.ts` 的本地目标契约已把 `financial_statements` 接入同一套财务报表 readiness：有报表输入时，缺现金流量项目映射会作为结账阻断项返回，映射完整才允许该检查通过；`POST /api/finance/accounting-periods/{period}/close` 会用服务端重算的 close-check snapshot 拒绝客户端旧 `expectedCheckSnapshotHash`，并返回当前 `currentCheckSnapshotHash` 让前端重新检查。
- `apps/api/src/finance/financeHttpJsonTransportContract.ts` 已补本地 JSON transport contract：把 HTTP-shaped method/url/query/header/body text 转成现有 gateway request envelope，非法或非 JSON 请求体会在进入 gateway 前拒绝，响应会序列化为 JSON body text，并覆盖结账后闭期源单写入仍经同一 transport/gateway 拒绝。该 contract 仍不是监听 HTTP server、framework route、auth middleware、部署 endpoint 或生产 API。
- `apps/api/src/finance/financeHttpAuthMiddlewareContract.ts` 已补本地 auth middleware contract：认证主体由服务端上下文提供，middleware 会覆盖客户端传入的 actor/permission/request headers，把 actor、权限、request id 和 request time 注入 JSON transport；未认证、停用账号和未登记权限会在进入业务 gateway 前拒绝；测试覆盖客户端伪造 `x-permission-scopes` 不能提升到结账权限。该 contract 仍不是真实身份系统、session/token/cookie 策略、framework auth middleware、资源级权限或生产授权证据。
- `apps/api/src/finance/financeHttpResourceAuthorizationContract.ts` 已补本地资源级授权 contract：在 auth middleware 和 JSON transport 之间增加 resource authorization middleware，由服务端 principal 注入 `x-finance-resource-scopes`，按财务路径解析默认账套资源 `default-ledger`，缺少 `finance.ledger:default-ledger` 或 `finance.ledger:*` 时在进入 gateway 前返回 `FORBIDDEN`；测试覆盖缺账套资源拒绝、客户端伪造资源 scope 不生效、精确账套资源和通配账套资源放行。该 contract 仍不是用户-账套关系服务、真实 resource-scope resolver、组织/多账套权限模型、framework middleware 或生产授权证据。
- `apps/api/src/finance/financeHttpSessionPrincipalContract.ts` 已补本地 session principal resolver contract：从服务端 runtime 提供的 Bearer token 或 `sms_session` cookie 解析本地 session 记录，派生 actor、权限 scopes 和账套资源 scopes；过期或撤销 session 不返回 principal，禁用账号返回 disabled principal 交给 auth middleware 拒绝；测试覆盖 Bearer/cookie 解析、过期 session 不结账、禁用账号不结账、客户端伪造权限/资源头不生效，以及 cookie session 通过完整 handler 链路写入 row-backed 期间锁。该 contract 仍不是真实身份提供方、生产 session/cookie 策略、用户-账套关系服务、组织资源图或生产授权证据。
- `apps/api/src/finance/financeIdentityResourceSqlRepositoryContract.ts` 已补本地 identity/resource SQL-shape contract：以 `identity_users`、`identity_sessions`、`identity_permission_grants`、`identity_ledger_resource_grants` 四类行数据表达用户、session、权限授权和账套资源授权；构建 resolver 前校验 duplicate token hash、孤儿 session/grant、无效账套 key、无效权限 scope 和无效生效区间；resolver 通过 token hash 从 Bearer 或 `sms_session` cookie 派生 actor、权限 scopes 和账套资源 scopes，且客户端传入的权限/资源 header 不参与授权。测试覆盖 SQL 行形态、cookie/bearer 解析、过期 session、禁用用户、缺账套资源、伪造 header 和完整 handler 链路结账。该 contract 仍不是 SQL migration、真实 DB repository、生产身份提供方、生产 session/cookie 策略、组织/多账套权限服务或生产授权证据。
- `apps/api/src/finance/periodCloseSqlRepositoryContract.ts` 已补本地 period-close SQL migration/repository transaction contract：声明期间结账九组候选表的非破坏迁移形态、期间锁和幂等相关索引、结账/反结账、闭期源单守卫、报表快照的事务边界；本地 repository wrapper 在执行结账或源单 mutation 前按期间加锁、做版本检查、保留同幂等键重放通道、异常回滚，并复用 row-backed row contract 验证提交后的行集合。`periodCloseSqlTransactionManagerContract.ts` 已补本地 application SQL transaction manager contract：显式记录 `BEGIN`、`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`、`SELECT ... FOR UPDATE`、幂等检查、版本校验、源单守卫、row contract 校验、`COMMIT/ROLLBACK` 的顺序；版本冲突在持有期间锁后回滚，闭期源单写入在锁后、源单变更前执行守卫并提交拒绝审计。`periodCloseSqlDriverRepositoryContract.ts` 已补本地 SQL driver/repository adapter contract：把结账和源单守卫转换为参数化 DB executor 调用，验证业务 SQL 不内联期间字面量、拒绝破坏性 SQL、驱动失败会回滚且不进入仓储写入、闭期源单守卫在期间行锁之后写审计。`periodCloseDbClientRepositoryContract.ts` 已补本地 DB client/repository contract：在 driver adapter 外层记录 checkout connection、begin transaction、delegate repository operation、commit/rollback、release connection 的客户端事务资源顺序，校验 client terminal event 必须与 driver COMMIT/ROLLBACK 一致，并覆盖成功结账提交、版本冲突回滚、闭期源单守卫审计提交、driver failure 回滚释放。`periodCloseFormalDbTransactionManagerContract.ts` 已补本地 formal DB transaction manager contract：统一记录 transaction context 分配、connection lease、begin、按隔离策略设置 transaction isolation、正数 lock timeout、unit of work、commit/rollback、release connection、release 后失败分类和事务外 retry scope，禁止事务内自动重试和混用 connection lease。`periodCloseDbConnectionPoolLifecycleContract.ts` 已补本地 DB connection-pool lifecycle contract：声明 pool 初始化、max connections、acquire timeout、connection checkout、lease、begin、isolation、lock timeout、unit of work、commit/rollback、release、pool exhausted 拒绝和 leak detection 的顺序，证明提交、driver failure、池耗尽和缺 release 的本地校验口径。`periodCloseDbRuntimeAdapterContract.ts` 已补本地 DB runtime adapter contract：把 service request、connection-pool lifecycle、formal DB transaction manager 和 SQL driver trace 串成一条本地运行时桥接链路，要求池耗尽时不进入正式事务和 SQL driver，提交、回滚、driver failure 的 pool/formal/driver 终态一致，并保留 driver failure 只在 release 后分类、事务外重试的口径。`periodCloseServiceTransactionBoundaryContract.ts` 已补本地 service transaction boundary contract：服务入口为每个结账/源单守卫请求分配独立 transaction id，强制经 DB client wrapper 执行，校验 DB client trace 和 DB runtime adapter trace，要求源单守卫运行时期间可解析，校验 service/runtime 终态一致，区分 committed、rolled_back、driver_failed、trace_invalid，并把 driver failure 映射为可重试服务错误。`periodCloseServiceConcurrencyContract.ts` 已补本地 service concurrency contract：在服务入口外层模拟 period-level in-flight gate，证明同一期间结账进行中时第二个同期间结账或源单写入不会进入 DB client，不同期间请求可独立推进，首个结账完成后同幂等请求只能重放既有结果且不重复写 close snapshot，并新增服务重启后从 row-backed snapshot hydrate 再重放同幂等键的契约，证明 close snapshot、event、idempotency rows 不重复生成。`periodCloseTransactionIsolationPolicyContract.ts` 已补本地 transaction isolation policy contract：把结账/反结账、闭期源单守卫和结账后正式报表快照统一为 `READ COMMITTED + accounting_periods SELECT FOR UPDATE` 策略，要求幂等唯一约束、source-hash 校验、`lock_timeout/deadlock_detected/serialization_failure` 只在事务外重试，并禁止事务内自动重试。测试覆盖迁移形态、结账提交、幂等重放不重复写行、服务重启后重放不重复写行、版本冲突不改行、异常回滚、同期间锁冲突、已结账来源写入拒绝、审计行落地、应用层事务 trace 顺序、driver adapter 执行顺序、DB client 事务资源顺序、formal DB transaction manager trace 顺序、连接池生命周期和泄漏检测、DB runtime adapter 端到端终态一致性、服务入口事务边界和运行时 trace 对齐、源单期间无法解析 trace_invalid、服务级并发 period gate 和本地事务隔离策略校验。该 contract 仍不是 migration apply、真实 DB client implementation、真实 DB runtime implementation、真实数据库隔离级别验证、真实连接池运行时集成、多进程/多实例真实服务级数据库并发测试、生产 repository 或生产锁期证据。
- `apps/api/src/finance/periodClosePostgresClientPortContract.ts` 已补本地 PG-like client port contract：不直接 import/instantiate `pg`，但固定 `pool.connect() -> client.query(sql, params) -> client.release()` 形状；执行前校验事务 SQL 仍为参数化 `READ COMMITTED + accounting_periods FOR UPDATE`，非法 SQL shape 在连接 DB client 前进入 `trace_invalid`；成功路径要求终态 `COMMIT/ROLLBACK` 后 release；失败路径要求先 `ROLLBACK`、再 release、再按 PostgreSQL 错误码分类 `lock_timeout/deadlock_detected/serialization_failure/connection_lost/constraint_violation/unknown`，并只在 release 后判断事务外 retryable。该 contract 是真实 DB client implementation 的前置接口契约，不是真实 runtime import、真实连接池运行时、正式 migration apply 或生产数据库证据。
- `apps/api/src/finance/periodCloseNativePostgresPoolAdapterContract.ts` 已补本地 native PostgreSQL pool adapter contract：在不直接 import/instantiate `pg`、不连接真实数据库的前提下，把真实 `pg.Pool` 风格的 `connect -> query -> release` 对象适配到现有 PG-like client port；校验 native pool/client 形状、复制 query 参数和 rows 边界、释放无效 client、保留 native query/release adapter event，并证明 native query failure 仍经 PG-like client port rollback/release/error-code 分类。该 contract 是已锁定 `pg` 依赖后的边界适配证据，不是真实 runtime import、真实连接池运行时、真实 DB client implementation、正式 migration apply 或生产数据库证据。
- `apps/api/src/finance/periodClosePostgresRuntimeBindingContract.ts` 已补本地 PostgreSQL runtime binding contract：把 native PostgreSQL pool adapter 和 PG-like client port 串成同一条本地运行时绑定链，要求 SQL 形状错误不得触达 native pool，native pool/client 形状错误归为 `trace_invalid` 而不是普通业务 driver failure，native query failure 必须继续走 rollback、release、PostgreSQL 错误码分类和事务外 retryable 口径。该 contract 仍不直接 import/instantiate `pg`、不连接真实项目数据库、不执行正式 migration，也不证明真实连接池运行时或生产数据库行为。
- `apps/api/src/finance/periodClosePostgresSecretResolverContract.ts` 已补本地 PostgreSQL secret resolver contract：在不连接真实 secret manager 的前提下，把 `secret://` 引用解析成内部 password value，并只向外暴露 redacted evidence（reference、version、source、access policy/rotation/target DB evidence），拒绝非 `secret://` 引用、缺失 secret、过期 secret、scope 不匹配 secret，生产 secret 必须来自 managed secret store 且具备访问策略、轮换和目标数据库证据。该 contract 是密钥解析边界证据，不是真实 secret manager、真实 IAM、真实密钥读取、生产密钥轮换或生产配置证据。
- `apps/api/src/finance/periodCloseManagedSecretProviderReadinessContract.ts` 已补本地 managed secret provider readiness contract：在不读取真实 secret、不读取真实生产环境变量的前提下，把服务运行时密钥准入前移为可验证契约；运行时环境快照不得携带原始 `DATABASE_URL`、`PGPASSWORD`、`POSTGRES_PASSWORD` 或 `FINANCE_DATABASE_PASSWORD`，目标数据库身份必须来自 readiness package，生产 secret 必须有 managed-secret source、access-policy、rotation 和目标数据库 evidence，结果只暴露 redacted env keys 和 `secret://` 引用。该 contract 已接入 project service runtime admission，secret provider gate 不通过时不会调用 `serviceRuntime.start`。它仍不是真实 secret manager implementation、真实 IAM policy、生产密钥轮换、真实环境变量读取、真实数据库连接或生产 DB runtime 证据。
- `apps/api/src/finance/periodClosePostgresRuntimeImplementationManifestContract.ts` 已补本地 PostgreSQL runtime implementation manifest contract：在不连接真实数据库、不启动生产进程、不读取真实 secret 的前提下，把“真实 DB runtime implementation”拆成可验证清单；service process entry、managed secret adapter、lazy `pg` runtime import、native managed pool、SQL runtime repositories、formal migration apply + rollback evidence、durable audit archive、metrics 和 runbook evidence 必须全部满足，才允许 manifest 标记为 ready。当前 local contract service runtime、fake pg、row-backed repository、local audit events 会被明确 blocked，避免把本地 contract 链路误称为真实 DB runtime。该清单已被 runtime implementation bundle 直接消费，manifest blocked 时 bundle 不继续执行 dependency admission；project service runtime admission 会以 `runtime_implementation_blocked` 前置阻断且不会调用 `serviceRuntime.start`。它仍不是真实 secret manager、真实 DB client/runtime、生产 process manager、正式 migration apply 执行或生产数据库证据。
- `apps/api/src/finance/periodClosePostgresRuntimeImplementationBundleContract.ts` 已补本地 PostgreSQL runtime implementation bundle contract：在不连接真实数据库、不启动生产服务、不读取真实 secret 的前提下，把 runtime implementation manifest、dependency admission、readiness-derived pool config、SQL repository runtime bindings 和 service runtime bundle evidence 串成统一准入包；implementation manifest、dependency admission、repository binding 或 service runtime evidence 任一阻断时都不会组装 bundle。该 bundle 已被 project service runtime admission 作为启动前准入输入，bundle evidence 缺失时返回 `runtime_implementation_bundle_blocked` 且不会调用 `serviceRuntime.start`；admission 启动本地 service runtime 后还会校验返回的 handle summary、health probe、readiness probe 是否继续承接同一 bundle evidence，漂移时返回 `runtime_bundle_continuity_blocked` 且不暴露 unsafe handle。它进一步证明当前 local contract / row-backed / fake pg / 缺服务运行时 evidence / post-start bundle drift 的路径不能被误认为真实 DB runtime bundle；它仍不是真实 DB client/runtime、真实服务进程、真实 secret manager、正式 migration apply 执行或生产数据库证据。
- `apps/api/src/finance/periodClosePostgresPoolFactoryContract.ts` 已补本地 PostgreSQL pool factory/config contract：在不直接 import/instantiate `pg`、不连接数据库的前提下，把未来 `pg.Pool` 构造入口前置成可验证契约；校验本地/test 只能指向 localhost，拒绝原始密码字段和 `databaseUrl` 夹带原始凭据，只允许 `secret://` secret 引用，限制连接池参数、超时参数和 application name，生产配置必须带 password secret reference、目标数据库、备份恢复、release/rollback owner 和 production apply approval 证据；配置通过且密钥解析成功后才允许构造 pool，并继续委托 runtime binding 验证 SQL shape、native pool/client shape、rollback/release/classification。该 contract 是依赖准入、密钥引用和配置边界证据，不是真实 runtime import、真实 secret manager、真实数据库连接、正式 migration apply 或生产运行证据。
- `apps/api/src/finance/periodClosePostgresRuntimeReadinessPackageContract.ts` 已补本地 PostgreSQL runtime readiness package contract：把目标数据库选择、managed secret、备份恢复、release/rollback owner、production apply approval、formal migration apply 和 pool policy 从分散布尔值收敛为一个 blocked/ready 包；当前 operational gate 只能派生 blocked package 且不暴露可用 pool config，未来生产包必须全部证据齐全才派生 runtime evidence 和 redacted pool config；该 readiness package 现在是 runtime admission orchestrator 的唯一 readiness/config 输入，入口内部重新派生 readiness 后才允许继续。该 contract 不连接真实数据库、不读取真实 secret manager、不执行正式 migration，也不证明生产 DB runtime 已就绪。
- `apps/api/src/finance/periodClosePostgresDependencyAdmissionContract.ts` 已补本地 PostgreSQL dependency admission contract：把 `pg` 接入拆成 manifest、lockfile 和运维证据三层准入，要求 `@startupmanage/api` 必须在 `dependencies` 声明 `pg`、`pnpm-lock.yaml` 必须同时有 importer 和 package entry，且真实 secret manager、目标数据库、备份恢复、release/rollback owner、production apply approval 和正式 migration apply 证据全部满足后，才允许期间结账真实 runtime import `pg`。当前 `@startupmanage/api` 已声明并锁定 `pg@^8.22.0`，测试会读取真实 `apps/api/package.json` 与 `pnpm-lock.yaml` 校验 manifest/lockfile gate，同时保留 no-`pg` fixture、devDependency 误放、manifest/lockfile 漂移、依赖和 lock 齐但运维门未过，以及未来全部证据齐全时的 admitted 状态。该 contract 不连接真实数据库、不读取真实 secret、不执行正式 migration，也不证明真实 DB runtime 已就绪。
- `apps/api/src/finance/periodClosePostgresRuntimeAdmissionOrchestratorContract.ts` 已补本地 PostgreSQL runtime admission orchestrator contract：运行时入口不再信任调用方传入的 admission、runtime evidence 或 pool config，而是接收 readiness package，在入口处重新派生 readiness，再用 `@startupmanage/api` package manifest、`pnpm-lock.yaml` 和派生出的 runtime evidence 重新计算 dependency admission；只有 dependency admission、readiness trace 和 pool config 全部通过后，才允许委托 lazy runtime import。测试覆盖当前 workspace package/lock + operational gate 不加载 `pg`、devDependency 误放不委托、readiness package 无效不加载 `pg`，以及未来证据齐全时通过 managed-secret evidence、fake `pg.Pool`、`COMMIT` 和 release 的入口编排。该 contract 是 runtime 入口编排证据，不连接真实数据库、不读取真实 secret manager、不执行正式 migration，也不证明生产 DB runtime 就绪。
- `apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts` 已补本地 PostgreSQL runtime import contract：在 `DependencyAdmission` 未达到 `admitted` 前禁止加载 `pg`，配置校验失败时也不得加载 `pg`；admission 和 config 都通过后才通过 lazy loader 加载 `pg` module，校验 `Pool` constructor 形状，再委托 `PostgresPoolFactory` 和后续 runtime binding。测试用 fake `pg.Pool` 覆盖 admission 阻断、config 阻断、module shape 阻断、loader failure、CommonJS default export 形状，以及 admitted 后委托 pool factory 并执行到 fake `COMMIT`/release。该 contract 是真实 runtime import 的门禁边界证据，不连接真实数据库、不读取真实 secret、不执行正式 migration，也不证明真实 DB runtime 已就绪。
- `apps/api/src/finance/periodClosePostgresDbClientRepositoryBridgeContract.ts` 已补本地 PG-like client/repository bridge contract：把 DB client repository 生成的 driver executions 继续送入 PG-like client port，验证 DB client events、SQL driver executions、PG client query/release trace 的期间、request id、statement 顺序和 `COMMIT/ROLLBACK` 终态一致；成功结账、版本冲突回滚和闭期源单守卫审计提交都必须在 repository 计划和 PG-like client port 两侧一致；如 PG query 失败导致 repository 计划终态与 client port 终态不一致，则进入 `trace_invalid`，避免把本地 repository commit 误认为真实 DB runtime 成功。该 contract 仍不直接 runtime import/instantiate `pg`、不连接真实项目数据库、不执行正式 migration，也不证明真实连接池、真实事务或生产数据库行为。
- `apps/api/src/finance/periodClosePostgresAtomicCommitBridgeContract.ts` 已补本地 PG-like atomic commit bridge contract：把本地 repository 执行限制在 staged unit of work 中，只有 DB-client trace、SQL driver executions 和 PG-like client port replay 全部通过后才调用 `commit` 发布 staged state；业务回滚、driver failure、PG query failure 或 trace mismatch 都调用 `rollback` 丢弃 staged state。测试覆盖成功结账发布、版本冲突不发布、PG query 失败后 committed snapshot 不污染、闭期源单守卫审计在 replay 成功后发布，以及缺 staged commit event 的 trace 拒绝。该 contract 仍不直接 runtime import/instantiate `pg`、不连接真实项目数据库、不执行正式 migration，也不证明真实连接池、真实事务或生产数据库行为。
- `apps/api/src/finance/periodCloseServiceAtomicCommitBoundaryContract.ts` 已补本地 service atomic commit boundary contract：服务入口不直接发布本地 repository 状态，而是记录 request、service transaction allocation、atomic bridge delegation、atomic trace validation 和 response 的顺序，并委托 PG-like atomic commit bridge 完成 staged state 发布。测试覆盖服务级结账成功发布、PG replay 失败后 committed snapshot 不污染、版本冲突回滚不发布、闭期源单守卫审计在服务级 replay 成功后发布，以及跳过 atomic bridge delegation 的 service event trace 拒绝。该 contract 仍不是生产 HTTP service、真实 DB runtime、真实连接池、正式 migration apply 或生产锁期证据。
- `apps/api/src/finance/periodClosePostgresServiceRuntimeGatewayContract.ts` 已补本地 PostgreSQL service runtime gateway contract：服务入口先执行 runtime readiness/admission/import 编排，只有 runtime admission、readiness trace 和 service atomic trace 都通过后，才返回结账或闭期源单守卫结果；blocked readiness 会在服务原子边界前返回 `runtime_blocked`，不构造 fake `pg.Pool`、不调用 service boundary。测试覆盖 blocked operational readiness、ready close 通过 service atomic boundary 发布状态，以及后续闭期源单守卫审计通过同一 runtime gateway 落地。该 contract 是服务 runtime 顺序证据，不是真实数据库连接、真实 secret manager、真实共享连接池运行时、正式 migration apply、生产 HTTP service 或生产锁期证据。
- `apps/api/src/finance/periodClosePostgresSharedServicePoolRuntimeContract.ts` 已补本地 PostgreSQL shared service pool runtime contract：运行时入口在 readiness、dependency admission、config、secret、module shape 全部通过后，只构造一个请求级 native pool adapter，并把该 pool 交给 service atomic boundary 执行结账或闭期源单守卫；blocked readiness 不构造 pool、不创建 service boundary。测试覆盖 blocked readiness、ready close、闭期源单守卫和 invalid module shape。该 contract 是共享 pool 交接证据，不是真实数据库连接、真实 secret manager、真实连接池运行时集成、正式 migration apply、生产 HTTP service 或生产锁期证据。
- `apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts` 已补并硬切本地 PostgreSQL managed service pool runtime contract：运行时入口仍交叉校验 readiness package、dependency admission、secret 和 module shape，但建池配置必须来自已准入的 runtime implementation bundle；bundle 缺失 managed pool/runtime import/source mutation bridge/service evidence，或 bundle pool config 与 readiness 派生配置漂移，都会以 `runtime_bundle_invalid` 阻断且不构造 pool。首次 ready 请求用 `runtimeImplementationBundle.poolConfig` 初始化一个 runtime-owned native pool adapter，后续 close/source guard 请求复用同一个 adapter；`shutdown` 调用 native `pool.end()` 后拒绝后续服务请求；pool 初始化后配置漂移仍拒绝进入 service work。测试覆盖 blocked readiness 不构造 pool、bundle/readiness pool config drift 不构造 pool、close 与 source guard 跨请求复用同一 managed pool、shutdown 后拒绝新请求、config drift 不创建替换 pool。该 contract 是本地服务进程 pool 生命周期和 bundle 消费证据，不是真实数据库连接、真实 secret manager implementation、生产服务 wiring、正式 migration apply、生产 HTTP service、多实例并发或生产锁期证据。
- `apps/api/src/finance/financeHttpPostgresManagedRuntimeGatewayContract.ts` 已补本地 HTTP managed PostgreSQL runtime gateway contract：保持和 HTTP service transaction gateway 同一套 close/source 写路由、请求解析和错误映射，但授权通过后直接委托 `periodClosePostgresManagedServicePoolRuntimeContract`。测试覆盖未授权 close 请求在 runtime admission 前拒绝、readiness 阻断返回 runtime-unavailable 且不建池、授权 close 通过 managed runtime 提交、结账后源单调整复用同一 managed pool 并只提交拒绝审计、不修改源单行。后续补入 `financeSourceMutationPayloadContract.ts` 后，managed runtime gateway、HTTP service transaction gateway、row-backed gateway 和 direct source API service 对源单 amount、version、source id、source no、status、target accounting period 的非法类型统一返回 `INVALID_REQUEST`，并在 runtime admission、service transaction 或 repository mutation 前停止。该 contract 是本地 HTTP 写入口到 managed runtime 的 wiring 证据，不是生产 framework plugin、真实数据库连接、真实 secret manager implementation、正式 migration apply、生产服务 wiring、多实例并发或生产锁期证据。
- `apps/api/src/finance/periodCloseSourceMutationRepositoryApiContract.ts` 已补本地源单 repository API contract：把 ordinary source mutation registry 中的 create/update 写入统一委托到 `applyFinanceSourceMutationWithRepositoryTransaction`，并把原 row-backed HTTP gateway 中重复的新增源单事务切到同一条 repository mutation path。测试覆盖所有 ordinary source mutation operation 在闭期下拒绝且不插入/改写源单、开放期新增源单、重复新增冲突、开放源期间但目标期间已结账的跨期间拒绝，以及 target-period-required 新增缺期间时不插入不完整源单。该 contract 是本地源单 API 到统一仓储事务的防漂移证据，不是真实源表 repository、生产 API、生产 auth middleware 或正式数据库事务证据。
- `apps/api/src/finance/periodCloseSourceTableRepositoryContract.ts` 已补本地源表 repository adapter contract：把业务源表行映射成期间结账事务可读取的 source-record view，并在同一 repository transaction 中证明闭期拒绝不改源表、开放期写入才回写源表、版本冲突不回写、开放目标期间新增才插入源表、事务异常不提交源表或审计事件。该 contract 比普通 source mutation repository API 更接近真实源表边界，但仍是本地 adapter 证据；它不是生产源表服务、真实 SQL source repository、生产 API、生产 auth middleware 或正式数据库事务证据。
- `apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts` 已补本地源表 SQL repository contract：覆盖所有 ordinary source mutation `sourceArea` 的默认源表、必需列、索引、非破坏性表契约、参数化 `select/insert/update` 语句、SQL row 校验、SQL row 与 source-table row 的 hydrate/writeback。测试证明闭期拒绝不改 SQL row、开放期成功写回 amount/status/version、版本冲突不写、开放目标期间新增才插入 SQL row、闭期新增不插入、无效 SQL row 在 repository 可用前拒绝。该 contract 是 SQL row shape 和本地 repository 边界证据；它不连接真实数据库、不执行 migration apply、不提供生产源表服务/API、不证明生产 auth 或正式数据库事务。
- `apps/api/src/finance/periodCloseSourceMutationApiServiceContract.ts` 已补本地源单 API service contract：复用源单 route catalog，把 direct API 请求按 `receive -> route match -> payload validate -> authorize -> hydrate SQL source repository -> delegate repository guard -> return` 顺序固定下来，并用 `FinanceSourceTableSqlRepositoryContract` 作为源表边界。测试证明 route catalog 与 operation registry/SQL table contracts 对齐、无权限请求不委托 repository guard 且不改 SQL row、非法 payload 不进入 authorization 或 SQL repository hydrate、闭期 direct API 返回 `CLOSED_ACCOUNTING_PERIOD` 且 SQL row amount/version 不变、开放期 direct API 写回 SQL amount/status/version、create-type API 只有目标期间已解析且开放时才插入 SQL row。该 contract 是本地 direct API service 边界证据；它仍不是生产 source API service、真实 framework endpoint、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/periodCloseSourceMutationApiTransactionBridgeContract.ts` 已补本地源单 API transaction bridge contract：direct API 在 route/payload/authorization 之后，把 SQL 源表 rows 水合为 period-close service transaction boundary 的本地初始状态，源单写入必须委托 `periodCloseServiceTransactionBoundaryContract`，且只有服务事务返回已提交且业务结果成功时才把 source records 回写到 SQL 源表；非法 payload 不进入服务事务，闭期拒绝返回 `CLOSED_ACCOUNTING_PERIOD` 并保持 SQL amount/version 不变，driver failure 返回可重试 503 且不回写 SQL rows，create-type 写入只在服务事务成功后插入对应源表行。该 contract 是本地 direct API 到服务事务边界的桥接证据；它仍不是生产 source API service、真实 framework endpoint、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts` 已补本地 HTTP managed PostgreSQL source mutation bridge contract：HTTP-shaped 源单写入在 route/payload/authorization 之后委托 `periodClosePostgresManagedServicePoolRuntimeContract`，且只有 managed runtime 已提交并返回业务成功结果时才把 source records 写回 SQL 源表；非法 payload 和无权限请求不进入 managed runtime，readiness 阻断不建池也不写源表，闭期拒绝只提交 guard audit state 并保持 SQL amount/version 不变，create-type 源单只在 managed runtime commit 后插入对应源表行。该 contract 是本地 HTTP managed runtime 到 SQL 源表回写的桥接证据；它仍不是生产 source API service、真实 framework endpoint、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedSourceMutationServerContract.ts` 已补本地 HTTP managed PostgreSQL source mutation server-entry contract：在 managed source mutation bridge 之上增加 server-shaped 异步入口，负责解析绝对/相对 URL、财务路由绑定、POST/PATCH 方法限制、JSON body 校验、服务端 authenticated principal 校验、默认账套资源 scope 校验、覆盖客户端伪造 actor/permission/resource header，再委托 managed source bridge。测试覆盖非财务路由和不支持方法不进入 runtime、缺 principal/缺账套资源/非法 JSON 不写 SQL、客户端伪造权限 header 不能绕过服务端 principal、开放期间写入必须先 managed runtime commit 再回写 SQL、闭期拒绝只提交 guard audit 且不回写 SQL、create-type invoice import 只在 managed commit 后插入源表行。该 contract 是本地 server 入口链路证据；它仍不是生产 framework endpoint、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.ts` 已补本地 HTTP managed PostgreSQL source mutation framework adapter contract：在 async server-entry 之上增加 Express/Fastify/Next-like request/response 适配，覆盖对象 body 序列化、path/query URL 组装、headers normalize 后交给 identity resolver、request id/time 生成、body-size guard、服务端 principal 解析结果传入 server-entry，以及 framework response writer 写回 status/header/body。测试覆盖 framework-shaped 开放期源单写入通过 resolved server principal 进入 managed runtime 并在 commit 后回写 SQL、超大 body 在 identity/runtime/SQL 前拒绝、resolver 未解析 principal 时由 server-entry 返回认证拒绝、客户端伪造 header 不替代 resolved principal。该 contract 是本地 async framework adapter 证据；它仍不是生产 framework plugin、部署路由、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedApplicationFrameworkAdapterContract.ts` 已补本地 HTTP managed PostgreSQL application framework adapter contract：在 framework request/response 层组合 managed source mutation framework adapter 和普通 concrete finance framework adapter，先让 source mutation adapter 处理，未处理再 fallback 到普通 finance handler adapter，并由 application adapter 统一写回 status/header/body 和 route provenance。测试覆盖普通 close-checks 类请求 fallback、source mutation 请求不 fall through、两侧都不处理时保持 unhandled，以及 writer 只输出被选中的响应。该 contract 是本地 framework application entry 收敛证据；它仍不是生产 framework plugin、部署路由、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedApplicationFrameworkRoutePluginContract.ts` 已补本地 HTTP managed PostgreSQL application framework route plugin contract：在统一 application framework adapter 之上固定一个框架级 `/api/finance` 路由插件注册边界，标准化 `GET/PATCH/POST` 方法、拒绝非财务前缀、非财务请求不委托 application adapter、匹配财务请求统一进入 application adapter，并保留 route plugin provenance headers。测试覆盖注册形态、matched fallback、matched managed source mutation、unmatched route 404 和非法 route prefix 拒绝。该 contract 是本地 framework route-plugin wiring 证据；它仍不是生产 framework registration、部署路由、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedSourceMutationNodeServerContract.ts` 已补本地 HTTP managed PostgreSQL source mutation Node listener contract：在 async framework adapter 之上增加真实 Node HTTP 监听器，读取真实 request body/header/method/url，写回 adapter response 的 status/header/body，并用 provenance header 标记 handled/delegated。测试覆盖真实 localhost PATCH 请求通过 Bearer 解析到服务端 principal 后才进入 managed runtime、managed runtime commit 后才回写 SQL amount/version，以及缺 Bearer 时返回 `UNAUTHENTICATED` 且不进入 runtime、不写 SQL。该 contract 是本地 listener 证据；它仍不是生产 framework/server integration、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedApplicationNodeServerContract.ts` 已补本地 HTTP managed PostgreSQL application Node server contract：在本地 Node HTTP 监听器内注册统一 `/api/finance` application route plugin，真实读取 request body/header/method/url 后由 route plugin 命中财务请求并委托 unified application framework adapter；application adapter 内部仍保持 managed source mutation 优先、未处理再 fallback 到普通 finance handler。测试覆盖普通 close-checks 类请求经 route plugin 命中后 fallback、source mutation 请求经 route plugin 命中后优先由 managed adapter 处理且不 fall through、非财务请求停在 route-plugin unmatched 边界、unsupported finance method 在 route host 前置拒绝且不进入 managed/fallback adapter。该 contract 是本地 route-plugin hosted application entry 收敛证据；它仍不是生产 framework/server integration、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedProjectApiServerWiringContract.ts` 已补本地 HTTP managed PostgreSQL project API server wiring contract：在不启动真实端口、不改生产 server 配置的前提下，模拟项目级 API server route registry，只允许通过统一 `/api/finance` managed application framework route plugin 注册财务入口，禁止并行 direct finance handler，固定 route registry -> route prefix match -> method guard -> route plugin -> application adapter -> managed source mutation first -> ordinary fallback handler 顺序。测试覆盖 wiring summary 校验、普通财务请求经 route plugin 后 fallback、源单请求优先 managed 且不 fall through、财务 unsupported method 在项目 server guard 前置拒绝、非财务 `DELETE /healthz` 不被财务 method guard 误拦截并保持 route-plugin unmatched。该 contract 是本地 project server wiring 候选证据；它仍不是生产 framework/server integration、真实 auth middleware、真实 SQL repository runtime、正式数据库事务或生产证据。
- `apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeProcessContract.ts` 已补并硬切本地 HTTP managed PostgreSQL project runtime process contract：在不启动真实生产进程、不绑定端口、不改部署配置的前提下，把 runtime readiness package、dependency admission、runtime implementation bundle、managed source mutation framework adapter、project API server wiring 和 managed service pool runtime shutdown 串成一个本地进程生命周期契约。process active 前必须校验并暴露已准入 runtime bundle evidence；bundle/readiness pool config 漂移会以 `blocked_by_runtime_bundle` / `FINANCE_PROJECT_RUNTIME_BUNDLE_BLOCKED` 在 project API server 构造前阻断，且不调用 managed runtime 或 fallback handler。测试覆盖 readiness/admission 阻断时不构造 project API server、bundle 漂移阻断并不暴露 active bundle evidence、active source mutation 经 project API server wiring 委托到同一个 managed runtime 并只在 managed commit 后写回 source SQL rows、shutdown 调用 managed runtime 后拒绝后续 framework request。该 contract 是本地项目运行进程 wiring 和 bundle continuity 候选证据；它仍不是生产服务进程、真实 DB runtime、真实 secret manager、正式 migration apply、部署路由、生产进程监管或生产 API 证据。
- `apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeNodeServerContract.ts` 已补本地 HTTP managed PostgreSQL project runtime Node server contract：在不改生产 server 配置、不绑定公网地址的前提下，把真实本地 Node HTTP request body/header/method/url 转给 project runtime process；listen 前要求 process summary 合法且 lifecycle 为 active，拒绝 blocked process 启动本地 listener，拒绝非 localhost bind，close 时先关闭本地 HTTP server 再 shutdown managed runtime。测试覆盖 blocked process 不允许 listen、active process 通过真实 localhost PATCH 请求进入 project runtime process 并在 managed commit 后回写 source SQL rows、local server close 同步关闭 process/runtime、非本地 host 拒绝。该 contract 是本地 Node host 证据；它仍不是生产服务进程、部署路由、真实 auth middleware、真实 SQL repository runtime、正式 migration apply、生产进程监管或生产 API 证据。
- `apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessBootstrapContract.ts` 已补本地 HTTP managed PostgreSQL project service-process bootstrap contract：在不改生产 server 配置、不启动真实生产进程、不读取真实 secret 的前提下，把服务进程启动前置校验收敛为本地契约；本地模式只允许 localhost bind，生产模式在本地契约内一律要求单独人工审批且不继续 listen，环境快照中出现原始 `DATABASE_URL`、`PGPASSWORD`、`JWT_SECRET` 等密钥值会在 runtime Node server listen 前被拒绝；通过校验后才委托 project runtime Node server listen，并把 runtime Node server summary 中的 bundle evidence id 与 lifecycle 承接到 service-process summary；shutdown 时先记录服务进程关闭请求再关闭 runtime Node server。该 contract 是本地服务进程启动边界证据；它仍不是生产 process manager、部署入口、真实 secret manager、真实 DB runtime、正式 migration apply、生产进程监管或生产 API 证据。
- `apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessRuntimeContract.ts` 已补并硬切本地 HTTP managed PostgreSQL project service-process runtime lifecycle contract：在不启动生产进程、不接生产 process manager、不读取真实 secret 的前提下，把服务进程启动后的 manifest、health/readiness 探针、draining 状态和 graceful shutdown 委托收敛为本地契约；本地 contract 会拒绝 production mode、production supervisor、production traffic、无效 probe path、无效 shutdown timeout 和非 graceful signal 策略，启动时必须携带已准入 runtime implementation bundle descriptor，且 bootstrap 返回的 runtime Node bundle evidence id 必须与 descriptor 中的 service runtime admission evidence 一致，否则在 ready 前以 runtime_failed 阻断；启动后 health/readiness 与 runtime summary 会持续暴露 service runtime admission、runtime import、managed pool、source mutation bridge 和 SQL repository runtime evidence，shutdown 先进入 draining 再委托 bootstrap shutdown。该 contract 是本地服务进程运行期生命周期证据；它仍不是生产 process manager、部署入口、真实健康检查端点、真实 DB runtime、正式 migration apply、生产进程监管或生产 API 证据。
- `apps/api/src/finance/financeHttpPostgresManagedProjectServiceRuntimeAdmissionContract.ts` 已补并硬切本地 HTTP managed PostgreSQL project service runtime admission contract：在不启动生产服务、不接真实 process manager、不读取真实 secret 的前提下，把服务运行时启动准入收敛为本地契约；启动前会校验 service runtime manifest、执行 runtime implementation bundle、从 bundle 派生 runtime readiness、执行 managed secret provider readiness，blocked readiness/runtime-implementation/runtime-bundle/secret-provider/manifest 均不会调用 `serviceRuntime.start`，只有全部准入通过才把 ready bundle descriptor 传入 serviceRuntime.start、启动本地服务运行时并读取带 bundle evidence 的非生产 health/readiness 探针。该 contract 是本地服务运行准入证据；它仍不是生产 process manager、部署入口、真实 readiness admission、真实 DB runtime、正式 migration apply、生产进程监管或生产 API 证据。
- `apps/api/src/finance/periodClosePostgresMigrationContract.ts` 已补本地 PostgreSQL migration plan contract：从 period-close SQL contract 生成 PostgreSQL 16 目标的 enum type、先建表后加外键约束的 DDL、必要索引和事务 recipe 文本；验证覆盖非破坏性、全部候选表/列渲染、状态/检查组枚举、期间版本锁索引、幂等唯一索引、源单守卫索引、结账/源单守卫/正式报表快照事务 `FOR UPDATE` 入口，以及禁止 `DROP/TRUNCATE/DELETE`。`periodCloseProjectMigrationArtifactContract.ts` 已补本地 project migration artifact contract：把 PostgreSQL migration plan 固化为带稳定制品号、迁移文件名、校验和、`not_applied` 状态、手工审批要求、禁止自动 apply、rollback/forward-fix 说明和证据门禁的项目级迁移制品候选；测试证明制品可渲染 SQL provenance header，禁止破坏性 DDL/DML，缺生产 apply approval gate 或绕过手工审批会失败。`apps/api/migrations/not-applied/20260704_000001_period_close_persistent_lock.sql` 已把该制品落为仓库内 review-only SQL artifact，`periodCloseMigrationArtifactFileContract.ts` 和 `apps/api/scripts/period-close-migration-artifact-file-contract.test.mjs` 校验路径、header、checksum、`not_applied` 状态、禁止隐式 `COMMIT`、禁止破坏性 DDL/DML，并要求文件内容与契约渲染完全一致。`periodCloseMigrationFormalApplyReviewContract.ts` 已补正式 apply 前 review 契约：rollback/forward-fix review 本地通过，禁止正式 apply 后 destructive rollback，要求 post-apply 修复只能走 additive forward-fix，明确 pre-apply 回滚证据只来自 rollback-only dry-run 或隔离 schema 演练，且 formal apply checklist 仍保留人工和运维阻断。`periodCloseMigrationOperationalGateContract.ts` 已补正式 apply 前运维门禁契约：目标数据库保持 `not_selected`，禁止出现连接串或 secret 引用，备份恢复计划/恢复演练、release owner、rollback owner 和 production apply approval 均保持 `not_started`，并拒绝把本地结构化证据伪装成真实批准。`periodClosePostgresDryRunContract.ts` 和 `scripts/local/period-close-postgres-dry-run.sh` 已提供本地 PostgreSQL 16 rollback-only dry-run：SQL 在一个事务中执行 DDL 与 schema assertions，输出 `period_close_postgres_migration_dry_run_passed` 后 `ROLLBACK`。`periodClosePostgresApplyDrillContract.ts` 和 `scripts/local/period-close-postgres-apply-drill.sh` 已提供本地 isolated apply fixture drill：只在 `period_close_drill_*` 临时 schema 中提交 DDL 和 fixture 写入，验证期间行锁、幂等唯一键、源单守卫审计和结账状态更新，再 `DROP SCHEMA` 清理并输出 `period_close_postgres_apply_drill_passed`。`periodClosePostgresReplayDrillContract.ts` 和 `scripts/local/period-close-postgres-replay-drill.sh` 已提供本地 persisted replay drill：只在 `period_close_drill_*` 临时 schema 中提交一次结账，再用新事务按同一幂等键读取已持久化 response snapshot，断言 close snapshot、close event 和 idempotency row 都不重复，并输出 `period_close_postgres_replay_drill_passed` 后清理临时 schema。`periodClosePostgresConcurrencyDrillContract.ts` 和 `scripts/local/period-close-postgres-concurrency-drill.sh` 已提供本地 row-lock concurrency drill：两个本地 psql 会话竞争同一 `accounting_periods` 行，持锁会话释放前争锁会话必须因 `lock_timeout` 失败，释放后再完成结账和闭期源单守卫断言，输出 `period_close_postgres_concurrency_drill_passed` 与 `period_close_postgres_concurrency_lock_conflict_observed`。该证据仍不是正式项目 schema migration apply、目标数据库选择、备份恢复审批、生产 apply approval、真实 SQL repository、应用层数据库事务管理器、真实数据库隔离级别/并发测试或生产证据。
- `apps/api/src/finance/financeHttpServerRuntimeContract.ts` 已补本地 HTTP runtime contract：runtime 接收 HTTP-shaped method/url/headers/body，统一 header normalize、body size guard、server-side principal resolver、request id/time 生成，然后进入 auth middleware、JSON transport 和 row-backed repository gateway；测试覆盖伪造客户端财务 header 不能认证、合法服务端 principal 结账后写入 row-backed 期间锁、同一 runtime 下闭期源单写入被拒绝且源行不变。该 contract 仍不是监听 HTTP server process、具体框架集成、真实身份系统、session/token/cookie 策略、资源级权限、SQL driver 或生产 API。
- `apps/api/src/finance/financeHttpFrameworkRouteBindingContract.ts` 已补本地 framework route binding contract：binding 接收框架层 pathname/query/header/body，只有 `/api/finance` 路由会进入 runtime，非财务路由不委托，Unsupported finance method 在 runtime 前返回 405，query/header/body 被组装成 runtime request；测试覆盖通过 binding 结账写入 row-backed 期间锁，以及同一 binding 链路下闭期源单写入被拒绝且源行不变。该 contract 仍不是监听 HTTP server process、具体框架集成、真实身份系统、session/token/cookie 策略、SQL driver 或生产 API。
- `apps/api/src/finance/financeHttpServerHandlerContract.ts` 已补本地 server handler contract：handler 接收 server 层 method/url/headers/body，解析绝对或相对 URL、剥离 hash、解码重复 query、保留 header/body，然后进入 framework route binding；测试覆盖 server handler 到 binding 的 URL/query/header/body 组装、非财务 server request 不进入 runtime、通过 handler 结账写入 row-backed 期间锁、同一 handler 链路下闭期源单写入被拒绝且源行不变。该 contract 仍不是监听 HTTP server process、具体框架集成、真实身份系统、SQL driver、部署路由或生产 API。
- `apps/api/src/finance/financeHttpConcreteFrameworkAdapterContract.ts` 已补本地具体框架 adapter contract：adapter 接收 Express/Fastify/Next-like `method/url/path/query/header/body` 请求形态，转入 server handler，并把 handler response 的 status/header/body 写回 framework response writer；测试覆盖对象 body 序列化、path/query 组装、response 写回、通过 adapter 结账写入 row-backed 期间锁、客户端伪造 actor/permission/resource header 不生效、缺服务端账套资源 scope 拒绝、非财务路由不进入 runtime、unsupported method 在业务前返回 405。该 contract 仍不是生产 framework plugin、生产 server、真实身份提供方、生产 session/cookie 策略、真实 DB repository/migration 或生产级集成测试。
- `apps/api/src/finance/financeHttpServiceTransactionGatewayContract.ts` 已补本地 HTTP service transaction gateway contract：保持同一 HTTP-shaped 请求入口，把期间结账和普通源单 mutation route 委托到 `periodCloseServiceTransactionBoundaryContract`，覆盖 concrete framework adapter -> server handler -> framework route binding -> HTTP runtime -> auth/resource middleware -> JSON transport -> service transaction gateway -> DB client/repository boundary 的本地链路；测试覆盖服务端 actor/resource context、create-source、闭期源单拒绝审计、SQL driver 前置失败返回可重试 503。该 contract 仍不是生产 framework plugin、真实 DB client implementation、真实 DB runtime implementation、部署路由或生产 API 证据。
- `apps/api/src/finance/financeNodeHttpServerContract.ts` 已补本地 Node HTTP listener contract：用 Node 标准库在本地随机端口启动 ephemeral HTTP server，把真实 HTTP 请求转换为 server handler request，并将 handler response 写回真实 HTTP response；测试通过 `node:http` client 请求 `127.0.0.1`，覆盖 SQL-backed cookie identity 读取 close-checks、结账写入 row-backed 期间锁、客户端 actor/permission/resource header 防伪、同一监听服务下闭期源单写入拒绝，以及非财务路由保持未绑定。该 contract 仍不是具体框架集成、生产监听服务、部署 endpoint、TLS/session/cookie 策略、真实 DB repository 或生产 API 证据。
- `apps/api/src/finance/financeHttpApiGateway.ts` 已补 HTTP 请求形态的本地 API Gateway contract，把期间结账、源单 mutation guard 和财务报表 route adapters 统一到同一个请求入口，并在结账后把期间状态同步给源单守卫和报表快照路由。该 contract 用于防止本地 route adapters 各自漂移；它仍不是监听端口的 server、真实 auth middleware、数据库 repository、事务边界或生产 API。
- `apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts` 已补 row-backed HTTP gateway repository contract：同一 HTTP 请求形态入口可以把结账提交到候选 DB row sets，并让后续既有源单 mutation 或新增源单 mutation 从已提交 row-backed lock 读取闭期状态后拒绝；有明确 affected period 的拒绝会落 source-mutation guard audit row，缺归属期间的 create 请求会拒绝但不写不完整审计行。该 contract 仍使用本地 row-backed repository harness；没有 SQL driver、migration、真实事务管理器、auth middleware、监听 server 或生产数据证据。
- `apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts` 的 row-backed gateway 已继续补 `POST /api/finance/financial-statements/{period}/snapshots`：未结账期间拒绝且不写正式报表 rows，已结账期间把正式报表快照、报表行和按科目聚合的总账快照行写入候选 row sets，重复生成直接重放既有快照，避免当前 ledger entries 漂移改写历史 rows。该 contract 仍使用本地输入 fixture 和候选 rows；没有真实总账 SQL 查询、现金流映射表、SQL snapshot repository、归档服务或生产证据。
- `apps/api/src/finance/financeSqlRepositoryGatewayContract.ts` 已补统一 SQL repository gateway contract：同一请求形态入口组合 row-backed 期间锁、总账 SQL rows、现金流映射 SQL rows 和报表 snapshot SQL rows，覆盖结账后读取总账、报表 readiness、正式报表快照写入、既有快照重放和缺权限拒绝。该 contract 仍是本地仓储组合证据；没有监听 HTTP server、真实 SQL driver、migration apply、数据库事务、auth middleware、归档服务或生产证据。
- `apps/api/src/finance/financeHttpApiRepositoryGatewayContract.test.ts` 已补矩阵驱动测试：遍历所有普通 `financeSourceMutationRouteDefinitions`，先通过 row-backed gateway 提交期间结账，再直接调用每条本地 route skeleton，验证都会从已提交候选 row 锁读到闭期并返回 `CLOSED_ACCOUNTING_PERIOD`，既不改源行金额/状态/版本，也不插入 create-type 源行。该证据仍是本地 route skeleton 范围，不是生产源单 API 集成。
- `apps/api/src/finance/accountingVoucherLifecycleContract.ts` 已补普通会计凭证生命周期的本地后端目标契约：制单校验来源 hash 和借贷平衡、生成正式凭证号并冻结来源/分录快照；记账写入一行分录对应一行总账并支持重复记账重放不重复写；开放期间冲销生成已记账反向凭证并保留原凭证关联；已结账期间制单、记账和同期间冲销统一返回 `CLOSED_ACCOUNTING_PERIOD` 并指向后续期间调整。该契约仍不是监听 HTTP endpoint、真实凭证 repository、数据库事务、权限中间件或总账持久化证据。
- 独立调整来源契约已不作为当前期间结账前端口径；后续后端应提供统一结账来源状态服务，聚合薪酬社保、税务办理、会计凭证、资金复核、银行对账和报表准备状态。该契约仍不是自动折旧、摊销、预提或候选凭证服务，也不是 HTTP endpoint、数据库或生产证据。
- `/finance/period-close` 页面不在结账抽屉内生成报表；未通过时归口跳转到 `/finance/financial-statements` 查看报表承接状态，避免把报表结果继续塞回期间结账页。

阶段 1-3 的后端 close-checks、持久化期间锁和源单 API 闭期守卫仍是正式工业化必需项；当前本地契约轮次只补齐可执行契约证据，不替代生产数据库、生产身份和生产部署。

### 2.2 阶段 1-3 文档契约补齐记录

2026-07-02 仅在文档契约层补齐期间结账阶段 1-3：

- `docs/api/finance-period-close-api-contract.md` 定义后端
  `close-checks`、`close`、源单 mutation guard、错误码和幂等/并发语义。
- `docs/data/finance-period-close-data-contract.md` 定义
  `accounting_periods`、`accounting_period_close_checks`、
  `accounting_period_close_check_items`、`accounting_period_events` 和源单
  guard 所需的期间解析数据边界。
- `docs/data/finance-accounting-voucher-ledger-contract.md` 同步引用上述
  契约，并统一关闭期间错误码为 `CLOSED_ACCOUNTING_PERIOD`。
- `docs/testing/test-plan.md` 增加阶段 1-3 后端契约验收测试要求。
- `docs/evidence/finance-period-close-phase1-3-contract-evidence.md` 记录本次
  文档契约证据和仍缺失的实现证据。

该补齐不代表后端已实现；截至本记录，只有本地 framework-agnostic contract
tests，仍没有数据库 migration、真实后端 endpoint、framework/server integration
test、permission test、CI 证据、非生产演练、发布记录或生产锁期证据。

同日，前端期间结账页增加 `frontend_session_adapter` 读模型入口：

- `/finance/period-close` 页面改为消费 `buildFinancePeriodCloseReadModel`，
  不再在页面层分别计算 rows 和 metrics。
- read model 明确标记当前权威为前端会话适配层，并列出待接入的后端
  `close-checks`、`close` 和源单 mutation guard 能力。
- 该适配层只是后端切换点，不改变正式完成定义；后端仍未实现。

同日，新增 `apps/api` 本地契约域模型骨架：

- `apps/api/src/finance/periodCloseContract.ts` 固化后端 `close-checks`、
  `close/reopen` 幂等/并发语义、后续期间已结账时反结账默认阻断，以及关闭
  期间源单 guard 的可执行规则。
- `apps/api/src/finance/periodCloseContract.test.ts` 覆盖八组检查项、阻断
  `canClose=false`、稳定快照哈希、结账成功、失败不锁期、幂等重放、幂等键
  复用拒绝、版本冲突、快照不匹配、反结账成功、反结账幂等、反结账版本冲突、
  后续期间已结账阻断，以及 `CLOSED_ACCOUNTING_PERIOD` guard。
- 该骨架没有 HTTP route、数据库、migration、auth、真实事务或持久化锁；它只把
  后端契约从纯文档推进为可测试域模型。

随后，`apps/api` 增加本地 route adapter 骨架：

- `apps/api/src/finance/periodCloseRoutes.ts` 提供框架无关的请求处理器，覆盖
  `GET /api/finance/accounting-periods`、
  `GET /api/finance/accounting-periods/{period}/close-checks` 和
  `POST /api/finance/accounting-periods/{period}/close`、
  `POST /api/finance/accounting-periods/{period}/reopen`。
- route adapter 使用服务端上下文写入操作人、操作时间和 request id；客户端请求体
  不提交这些字段。
- `apps/api/src/finance/periodCloseRoutes.test.ts` 覆盖期间列表、检查读取、结账
  成功、反结账成功、幂等重放、阻断结账、阻断反结账、版本冲突、非法请求和
  不存在接口。
- 该 adapter 仍不是监听端口的 HTTP 服务，没有数据库、auth middleware、事务和
  migration。

随后，`apps/api` 增加本地源单 mutation guard adapter 骨架：

- `apps/api/src/finance/periodCloseSourceMutationGuard.ts` 作为未来源单写接口的
  统一守卫适配层，覆盖应收应付、发票台账、发票匹配、流水复核、银行对账、会计凭证、
  税务办理、社保公积金、薪酬社保和账套初始化。
- adapter 要求源单写入前必须解析会计期间；缺失或格式不合法时返回
  `SOURCE_ACCOUNTING_PERIOD_UNRESOLVED`。
- adapter 会同时校验 mutation 涉及的旧期间和新期间；任何已结账期间都会返回
  canonical `CLOSED_ACCOUNTING_PERIOD`，并指向后续期间调整。
- `apps/api/src/finance/periodCloseSourceMutationGuard.test.ts` 覆盖源单领域注册、
  open/reopened 期间放行、已结账期间阻断、跨期间变更双期间校验、缺失/非法
  期间拒绝，以及会计凭证和账套初始化同口径守卫。
- 该 adapter 仍不是具体源单 API 集成，没有数据库事务、auth middleware、真实
  源单写入或 source row unchanged 证据。

随后，`apps/api` 增加本地 source mutation route adapter 骨架：

- `apps/api/src/finance/periodCloseSourceMutationRoutes.ts` 定义源单写入 route
  catalog，覆盖应收应付新建/调整/收付/作废/税额依据、发票台账导入、发票匹配、
  流水复核/凭证/冲正补差、银行对账、会计凭证制单/记账/冲销、申报准备和税务办理、
  社保公积金、薪酬社保，以及账套初始化期初调整/撤回启用。
- route adapter 的顺序固定为：解析 route -> 读取源单 -> 解析旧/新会计期间 ->
  运行 `guardFinanceSourceMutation` -> 通过后才写源单状态/期间/版本和操作事件。
- `apps/api/src/finance/periodCloseSourceMutationRoutes.test.ts` 覆盖直接 API-style
  写入闭期拒绝且源单行不变、开放期间可写、跨期间变更检查旧/新期间、源单期间
  无法解析拒绝、会计凭证记账同口径阻断，以及 route catalog 覆盖所有守卫源单
  领域。
- 该 route adapter 仍不是监听端口的业务 API，没有真实 repository、数据库事务、
  auth middleware、源单模块服务或生产集成证据。

随后，前端增加源单写入口矩阵作为防漂移治理证据：

- `docs/data/finance-period-close-source-mutation-matrix.md` 记录源单写入口矩阵的
  治理边界、源单区域、期间来源、闭期行为和剩余后端证据缺口。
- `apps/web/src/features/finance/financePeriodCloseSourceMutationMatrix.ts` 作为当前
  前端源单写入口到本地 API route skeleton 的机器可读矩阵。
- `apps/web/src/features/finance/financePeriodCloseSourceMutationMatrix.test.ts` 纳入
  web 单测，检查区域覆盖、路由覆盖、关键前端状态写入口覆盖、发票台账和发票匹配
  的边界，以及每条入口必须声明期间来源和闭期行为。
- 该矩阵不代表后端 API 已实现，只用于防止前端写入口、期间来源和本地契约继续漂移。

随后，前端增加期间结账验收矩阵作为主流程防漂移证据：

- `apps/web/src/features/finance/financePeriodCloseAcceptanceMatrix.ts` 记录本方案
  第 6 节 16 步主流程、八项结账检查、异常验收和前端呈现标准到当前证据的映射。
- `apps/web/src/features/finance/financePeriodCloseAcceptanceMatrix.test.ts` 纳入 web
  单测，检查主流程步骤顺序、八项检查覆盖、闭期源单异常覆盖所有守卫领域、后续期间
  调整和反结账边界，以及每个阶段仍需保留的正式后端证据缺口。
- 该矩阵不代表真实后端、数据库、权限、生产或审计闭环已完成；它只用于防止期间结账
  工作台、测试和治理文档从既定工业化验收口径继续漂移。

随后，前端增加期间结账阶段审计矩阵作为完成度防误判证据：

- `apps/web/src/features/finance/financePeriodCloseStageAuditMatrix.ts` 记录本方案阶段
  0-8 的当前状态、证据、阻断门禁和下一步动作。
- `apps/web/src/features/finance/financePeriodCloseStageAuditMatrix.test.ts` 纳入 web
  单测，检查阶段顺序完整、所有阶段均不得声明正式完成、后端/数据库/发布相关阶段必须
  保留 evidence gate 阻断，以及每个阶段必须指向当前证据和下一步。
- 该矩阵用于复盘当前工作离正式工业化闭环的距离；在缺少真实后端、数据库迁移、
  source API 守卫、权限中间件、发布和恢复证据前，所有阶段仍保持
  `not_formally_complete`。

随后，`apps/api` 增加本地 persistence-boundary contract 骨架：

- `apps/api/src/finance/periodClosePersistenceContract.ts` 定义内存态的持久化
  边界契约：结账成功时必须把 close snapshot、期间锁、事件和幂等记录作为同一
  次事务结果提交；结账阻断时不得写入 close snapshot 或期间锁；同一幂等请求重放
  不得重复写 snapshot/event；源单写入必须在同一边界内先检查会计期间，再改源单行。
- `apps/api/src/finance/periodClosePersistenceContract.test.ts` 覆盖成功结账原子提交、
  缺失期间/检查输入不写状态、阻断结账不落锁、不重复幂等重放、闭期源单写入拒绝
  且源单不变、未登记期间按未解析期间拒绝、闭期拒绝优先于源单版本冲突、跨期间
  写入检查旧/新期间、同 id 不同 source area 不串改，以及普通源单版本冲突不改源单。
- 该 contract 仍是本地内存契约，不是数据库 repository、真实事务管理器、migration、
  auth middleware 或生产 API 证据。

随后，`apps/api` 增加本地 repository transaction harness 骨架：

- `apps/api/src/finance/periodCloseRepositoryContract.ts` 把 persistence-boundary
  contract 包进 repository-style unit of work：读取状态返回防御性副本；事务成功时
  提交返回的 next state；handler 抛错时不提交工作态。
- `apps/api/src/finance/periodCloseRepositoryContract.test.ts` 覆盖 repository
  事务提交结账锁、幂等重放不重复提交、同一 repository 中结账后源单写入读取已提交
  期间锁并拒绝、读取副本不外泄内部状态、异常事务回滚。
- 该 harness 仍是本地内存仓储，不是数据库 repository 实现、真实事务管理器、
  migration、auth middleware、HTTP API 或生产证据。

随后，`apps/api` 增加本地 database row/schema mapper contract 骨架：

- `apps/api/src/finance/periodCloseDatabaseContract.ts` 声明期间结账相关九组
  候选 DB rows：`accounting_periods`、`accounting_period_close_checks`、
  `accounting_period_close_check_items`、`accounting_period_events`、
  `accounting_period_idempotency_records`、
  `accounting_period_source_mutation_events`、`financial_statement_snapshots`、
  `financial_statement_snapshot_lines` 和
  `financial_statement_general_ledger_lines`。
- `mapPeriodCloseStateToDatabaseRows` 把当前内存持久化状态映射为候选数据库行；
  `validatePeriodCloseDatabaseRows` 校验已结账期间快照引用、结账 metadata、
  已反结账 metadata、检查组合法性、事件引用、幂等唯一键、源单守卫审计行、
  正式报表快照引用的期间状态、报表快照生成审计信息、报表行引用关系，以及
  总账快照行与报表快照的 source-ledger hash 一致性。
- `apps/api/src/finance/periodCloseDatabaseContract.test.ts` 覆盖成功结账后的
  row 映射、九组候选 row 声明、close snapshot 引用、全部检查组落行、event 关联、
  idempotency row、重复幂等键拒绝、已反结账 metadata 缺失拒绝，以及闭期源单
  mutation rejection 映射为 guard audit row；2026-07-04 继续补正式报表快照行、
  报表行和总账快照行的声明、映射、hydrate readback、开放期间快照拒绝和
  stale source-ledger hash 拒绝。
- 该 contract 使用当前本地 mapper 的稳定 text id 口径；它仍不是数据库
  migration、真实表、真实 repository、事务管理器或生产持久化证据。

随后，`apps/api` 增加本地 row-backed repository contract 骨架：

- `apps/api/src/finance/periodCloseDatabaseRepositoryContract.ts` 以候选
  period-close row set 作为本地仓储快照的权威边界，把 rows hydrate 成现有
  persistence state 执行事务，再把结果映射回 rows；正式报表快照 rows 已进入
  clone/read snapshot 和本地 commit 边界，但尚未接入真实 SQL snapshot repository。
- 该 contract 保留 source records 和 close-check inputs 为外部依赖 fixture，明确
  区分“期间结账控制表 row 持久化边界”和“完整业务源表/SQL 实现”。
- `apps/api/src/finance/periodCloseDatabaseRepositoryContract.test.ts` 覆盖
  row snapshot hydrate、`未运行` close-check row 状态保留、防御性 primitive 和嵌套
  JSON snapshot 读取、结账事务写回 period/snapshot/idempotency rows、幂等重放不重复
  row、闭期源单写入读取 row-backed 锁并生成 source mutation guard audit row，以及
  异常事务不提交 row state。
- 该 harness 仍不是真实数据库 repository，没有 SQL driver、migration、row lock、
  isolation level、auth middleware、HTTP API、真实源表或生产证据。

随后，`apps/api` 增加本地 authorization contract 骨架：

- `apps/api/src/finance/periodCloseAuthorizationContract.ts` 声明期间结账和闭期
  源单写入守卫所需的本地权限 scope，包括 `finance.accountingPeriod.read`、
  `finance.accountingPeriod.close`、`finance.accountingPeriod.reopen` 以及各类
  source mutation 写权限。
- `apps/api/src/finance/periodCloseRoutes.ts` 和
  `apps/api/src/finance/periodCloseSourceMutationRoutes.ts` 在进入结账、反结账、
  读取检查和源单写入业务逻辑前先执行本地权限检查；缺权限时返回 `FORBIDDEN`
  且不改变期间状态、幂等记录、源单行或源单事件。
- `apps/api/src/finance/periodCloseAuthorizationContract.test.ts`、
  `periodCloseRoutes.test.ts` 和 `periodCloseSourceMutationRoutes.test.ts` 覆盖
  普通缺权限读/结账/反结账/源单写入拒绝，尤其证明 `finance.accountingPeriod.reopen`
  是高权限异常流程。
- 该 contract 仍不是真实 auth middleware、用户角色映射、资源级授权、HTTP API、
  审计日志或生产权限证据。

### 2.3 后续期间调整契约复查记录

2026-07-02 文档/证据侧补充复查了“后续期间调整”的前后端契约状态：

| 切面 | 当前口径 | 证据状态 |
| --- | --- | --- |
| 前端原型 | 已结账历史期间的 `已记账` 凭证不再走同期间冲销；页面生成目标期间 `调整凭证` 候选，原凭证保持 `已记账` | frontend-session prototype only |
| 不反改原凭证 | 后续期间调整不得把原凭证标记为 `已冲销`，不得写 `reversed_by_voucher_id`，不得改原分录或历史总账行 | frontend model and local API contract tests covered; persistence evidence pending |
| 目标期间未锁定 | 目标调整期间必须晚于原期间且未锁定；当前 V1 合同按 `开放` 期间接收，目标期间 `已结账` 必须拒绝 | local API contract test covered; real period repository evidence pending |
| 待制单调整事实 | 后端应创建后续期间调整来源事实，并由候选服务暴露目标期间 `待制单` `调整凭证`；该候选未处理时阻断目标期间结账 | frontend model and local API contract tests covered; persistence and candidate-service evidence pending |
| 后端实现 | `apps/api/src/finance/accountingVoucherLaterPeriodAdjustmentContract.ts` 和对应测试已提供本地 domain/route skeleton | partial skeleton; not real HTTP/database/auth/transaction readiness |

该复查不把前端候选或本地 skeleton 声明为正式完成。2026-07-04 前端模型测试已补充候选未记账不进总账、记账后只进入目标期间总账、目标期间待制单候选阻断结账的证据；正式完成仍需要真实 API 测试、持久化事实、事务/idempotency、权限、迁移、HTTP route 集成和非生产演练证据。

## 3. 目标原则

### 3.1 期间结账只做检查和锁定

期间结账页只能做：

- 展示检查项。
- 展示阻断原因。
- 指出回到哪个来源模块处理。
- 在全部检查通过后确认结账。
- 展示已结账状态和结账记录。

期间结账页不得做：

- 直接处理税务办理。
- 直接处理社保公积金。
- 直接处理银行对账。
- 直接计算折旧摊销。
- 直接修改应收应付、发票、流水、凭证。
- 直接生成报表调整分录。

### 3.2 已结账期间默认只读

期间结账后，影响本期账务结果的源单和凭证不得直接修改。

必须被锁定的范围：

| 模块 | 锁定对象 | 说明 |
| --- | --- | --- |
| 应收应付 | 金额、方向、类目、归属月份、税额依据、原始凭证 | 影响权责事实和权责凭证 |
| 发票匹配 | 匹配关系、税额、发票方向、归属期间 | 影响税额依据和发票证据 |
| 收支流水 | 金额、账户、发生日期、复核状态、对账状态 | 影响资金事实和资金凭证 |
| 流水复核 | 复核入账、退回、作废 | 影响可记账资金事实 |
| 银行对账 | 对账关系、异常处理、补差冲正 | 影响资金凭证完整性 |
| 会计凭证 | 制单、记账、冲销 | 影响总账和报表 |
| 税务办理 | 申报、缴款、回执 | 影响税费凭证和结账前置 |
| 社保公积金 | 确认、缴费、回单 | 影响工资社保相关凭证 |
| 薪酬社保 | 工资、绩效、社保、公积金、个税结果 | 影响薪酬计提和付款 |
| 账套初始化 | 期初调整凭证 | 影响后续总账口径 |

前端按钮禁用只是体验层；后端 API 拒绝才是有效锁定。

### 3.3 错误修正分两类

已结账期间发现错误时，不能默认直接改历史数据。

| 方式 | 用途 | 默认建议 |
| --- | --- | --- |
| 后续期间调整 | 历史期间已关闭且不宜重开，通过当前或后续期间调整凭证修正 | 默认优先 |
| 反结账 | 极少数情况下重开历史期间重新处理 | 高权限异常流程 |

## 4. 目标业务流程

```text
1. 上游业务产生事实
   合同 / 项目阶段 / 报销 / 代收 / 薪酬 / 外协 / 税费

2. 应收应付确认权责事实
   归属月份、金额、方向、类目、税额依据、原始凭证齐全

3. 发票和税额依据补充
   发票匹配、未开票税额依据、红票原票关系、进项/销项事实

4. 资金事实进入收支流水
   付款或收款事实、凭证、对公账户、经办信息

5. 流水复核和银行对账
   系统流水复核入账，再与银行流水确认一致

6. 会计凭证候选生成
   权责凭证、资金凭证、税费凭证、调整凭证、冲销凭证

7. 会计凭证制单
   生成正式凭证号，冻结来源快照和分录快照

8. 会计凭证记账
   写入总账分录

9. 来源事项完成
   薪酬社保、税务办理、后续调整、凭证候选和资金链路在各自模块完成

10. 期间结账检查
    检查凭证、总账、资金、税务、社保和报表准备

11. 确认结账
    写期间锁、检查快照、结账事件

12. 报表读取
    未结账期间用于结账前核对；确认结账后生成并回看正式报表
```

## 5. 执行阶段

### 阶段 0：决策和契约冻结

目标：在继续实现前冻结期间结账的产品和数据边界。

必须完成：

- 确认期间结账页只做检查和锁期，不做业务处理。
- 确认已结账期间默认只读。
- 确认错误修正优先走后续期间调整。
- 确认反结账是异常高权限流程。
- 确认来源事项在所属模块处理，期间结账只消费汇总状态。

交付物：

- 本方案。
- 更新后的 `finance-accounting-voucher-ledger-contract.md`。
- 更新后的测试计划。

验收：

- 文档中不得把前端 session lock 声明为正式结账能力。
- 文档中必须明确后端锁期和源单锁定仍未实现。

### 阶段 1：后端 close-checks 统一口径

目标：建立唯一的期间结账检查来源。

目标 API：

```text
GET /api/finance/accounting-periods
GET /api/finance/accounting-periods/{period}/close-checks
```

`close-checks` 至少返回：

| 检查组 | 必要字段 |
| --- | --- |
| 凭证制单 | 待生成、需处理、待制单数量和来源 |
| 凭证记账 | 已制单未记账数量和凭证列表 |
| 总账试算 | 借方、贷方、差额、试算状态 |
| 资金对账 | 已复核未对账流水、对账异常流水 |
| 税务办理 | 未申报、未缴款、缺回执事项 |
| 社保公积金 | 未确认、未缴费、缺回单事项 |
| 报表准备 | 报表可生成状态和阻断原因 |

验收：

- 任一检查项未通过时，`canClose=false`。
- 检查结果必须包含来源单号或来源模块。
- 前端不得自行重算最终 `canClose`。
- 同一期间多次读取检查结果必须稳定。

文档契约状态：

- API 字段和稳定性规则已补充在
  `docs/api/finance-period-close-api-contract.md`。
- 数据快照和来源版本 hash 规则已补充在
  `docs/data/finance-period-close-data-contract.md`。
- 本地 contract tests 已覆盖 domain、persistence-boundary、repository harness、
  database row/schema mapper、row-backed repository harness、route adapter、source mutation guard adapter、本地具体框架 adapter、managed application framework adapter、本地 Node HTTP listener 和本地 service-process bootstrap；真实
  DB repository、migration、生产 permission、生产 server 接入和并发事务测试仍未完成。
- `apps/api/src/finance/financeHttpConcreteFrameworkAdapterContract.ts` 已补本地具体框架 adapter contract：adapter 接收 Express/Fastify/Next-like `method/url/path/query/header/body` 请求形态，转入 server handler，并把 handler response 的 status/header/body 写回 framework response writer；测试覆盖对象 body 序列化、path/query 组装、response 写回、通过 adapter 结账写入 row-backed 期间锁、客户端伪造 actor/permission/resource header 不生效、缺服务端账套资源 scope 拒绝、非财务路由不进入 runtime、unsupported method 在业务前返回 405。该 contract 仍不是生产 framework plugin、生产 server、真实身份提供方、生产 session/cookie 策略、真实 DB repository/migration 或生产级集成测试。
- 本地 Node HTTP listener、具体框架 adapter、managed application framework adapter、application framework route plugin、application Node server route-plugin host、project API server wiring contract、project runtime process contract、project runtime Node server contract、project service-process bootstrap contract、project service-process runtime lifecycle contract、managed secret provider readiness contract、runtime implementation manifest contract、runtime implementation bundle contract、project service runtime admission contract、server handler、framework route binding、HTTP runtime、session principal resolver、identity/resource SQL-shape contract、auth middleware、resource authorization middleware、JSON transport、HTTP 请求形态 gateway contract、HTTP service transaction gateway contract 和 HTTP managed PostgreSQL runtime gateway contract 已覆盖真实本地端口监听、Express/Fastify/Next-like request/response 适配、统一 framework application managed-first/fallback route、统一 `/api/finance` route plugin 注册和命中委托、application Node server 只通过 route plugin host 进入 application adapter、项目级 API server registry 只允许 route plugin 注册财务入口且禁止 direct finance handler、project runtime process 在 readiness/admission gate 不通过时不构造项目 API server，active path 必须先校验并暴露 runtime bundle evidence 后才把 project wiring 委托到同一 managed runtime，bundle/readiness drift 以 `blocked_by_runtime_bundle` 前置阻断，shutdown 后拒绝新请求、project runtime Node server 要求 active process 才能 listen 且只允许 localhost，本地 close 时同步 shutdown managed runtime、project service-process bootstrap 在 listen 前拒绝生产启动、原始密钥环境变量和非 localhost bind，并在 summary 中承接 runtime Node bundle evidence id 与 lifecycle、project service-process runtime lifecycle 提供本地 manifest、health/readiness、draining 和 graceful shutdown 边界、project service runtime admission 在服务运行时启动前统一校验 service manifest、runtime implementation manifest、runtime readiness、managed secret provider readiness 和 dependency admission，implementation manifest blocked 时返回 `runtime_implementation_blocked` 且不启动服务运行时，runtime implementation bundle 进一步要求 dependency admission、readiness-derived pool config、SQL repository runtime bindings 和 service runtime bundle evidence 全部通过后才允许组装 bundle；server URL/query/header/body 解析、财务 API 路由绑定、allowed method、framework query/header/body 组装、HTTP-shaped 入口、header normalize、body size guard、Bearer/cookie session 到 principal/resource 映射、用户/session/权限/账套资源 grant 行形态校验、URL/query/header/body 解析、非法 JSON 拒绝、服务端 actor/permission/resource/request context 注入、客户端权限/资源头防伪、`close-checks` 路由、结账时服务端重算 snapshot 并拒绝客户端旧 hash、结账后期间状态同步、HTTP 写入口进入服务事务边界、HTTP 写入口进入 managed PostgreSQL runtime、闭期源单写入拒绝、已结账报表快照生成和未知路由 `NOT_FOUND`；它仍不是生产 HTTP server，也不替代真实身份提供方、生产 session/cookie 策略、真实 DB repository/migration、用户-账套资源服务、生产 server 接入或生产级集成测试。
- 本地 row-backed HTTP gateway repository contract 已覆盖缺权限不写候选行、HTTP close 提交后写入 accounting-period lock / close snapshot / event / idempotency rows、幂等重放不重复写行、闭期既有源单和新增源单写入拒绝、开放期间既有源单和新增源单写入提交到 row-backed snapshot，以及缺归属期间 create 请求不写不完整审计行。它仍不是 SQL repository、migration、真实 API server 或后端集成测试。

### 阶段 2：期间锁持久化

目标：将结账从前端 session 状态升级为后端持久化状态。

建议数据对象：

```text
accounting_periods
accounting_period_close_checks
accounting_period_close_check_items
accounting_period_events
accounting_period_idempotency_records
accounting_period_source_mutation_events
```

期间状态建议：

```text
开放
已结账
已反结账
```

结账接口：

```text
POST /api/finance/accounting-periods/{period}/close
```

请求必须包含：

- `reason`
- `version`
- `idempotencyKey`

后端行为：

- 重新执行 close-checks。
- 检查通过后写期间锁。
- 保存检查快照。
- 写结账事件。
- 返回最新期间状态。

验收：

- 刷新页面后结账状态不丢失。
- 并发重复结账不能产生两条有效锁。
- 检查失败时不能结账。
- 结账事件能追溯操作人、时间、原因和检查快照。

文档契约状态：

- 持久化期间锁以 `accounting_periods.status` 和 close metadata 为正式来源。
- close snapshot、event、idempotency 和 version 规则已文档化。
- 本地 database row/schema mapper 已覆盖期间锁、结账检查、源单守卫审计、正式报表快照、报表行和总账快照行的候选 row 与行级不变量。
- 本地 row-backed repository harness 已覆盖从候选 rows hydrate、事务提交后写回
  rows、闭期源单拒绝审计 row 和异常事务不提交。
- 本地 period-close SQL migration/repository transaction contract 已覆盖非破坏迁移形态、期间锁索引、幂等唯一键、结账事务边界、闭期源单守卫事务边界、版本冲突、幂等重放、异常回滚和同期间锁冲突。
- 本地 PostgreSQL migration plan contract 已把候选表、枚举、外键约束、索引和事务 `FOR UPDATE` recipe 渲染成 PostgreSQL 16 目标文本，并验证不包含破坏性 DDL/DML；project migration artifact contract 已把该 plan 固化为带校验和、`not_applied` 状态、手工审批、禁止自动 apply、rollback/forward-fix 说明和证据门禁的项目迁移制品候选；仓库内 `apps/api/migrations/not-applied/20260704_000001_period_close_persistent_lock.sql` 已持久化该 review-only 制品，并由文件级契约防漂移；本地 formal-apply review contract 已把 rollback/forward-fix review 标记为 local passed，同时保留人工和运维门禁阻断；本地 operational gate contract 已结构化锁定目标数据库未选择、备份恢复未批准、release/rollback owner 未指派、production apply approval 未开始，防止误宣称正式 apply 已具备条件。
- 本地 rollback-only dry-run 已在 Docker Compose PostgreSQL 16 上执行 DDL 与 schema assertions，输出 `period_close_postgres_migration_dry_run_passed` 后回滚。
- 本地 isolated apply fixture drill 已在 Docker Compose PostgreSQL 16 上创建 `period_close_drill_*` 隔离 schema，提交 DDL 和 fixture 写入，验证期间行锁、幂等唯一键、源单守卫审计和结账状态更新，然后只清理该隔离 schema。
- 本地 persisted replay drill 已在 Docker Compose PostgreSQL 16 上创建 `period_close_drill_*` 隔离 schema，提交一次结账后用新事务读取同一幂等键的持久化 response snapshot，并断言 close snapshot、close event 和 idempotency row 均未重复生成，然后只清理该隔离 schema。
- 本地 row-lock concurrency drill 已用两个 psql 会话证明同一期间行在 `FOR UPDATE` 持锁期间会阻塞并在 `lock_timeout` 下失败，释放后可继续结账并执行闭期源单守卫断言。
- 本地 service concurrency contract 已在服务入口外层覆盖同期间 in-flight period gate、同期间重复结账拒绝进入 DB client、跨期间并发放行、结账完成后同幂等重放不重复写 close snapshot、服务重启后从 row-backed snapshot hydrate 再重放同幂等键不重复写 close/event/idempotency rows，以及结账 in-flight 期间源单写入不进入 DB client。
- 本地 transaction isolation policy contract 已覆盖 `READ COMMITTED + accounting_periods SELECT FOR UPDATE`、幂等唯一约束、源单守卫、正式报表快照 source-hash 校验、事务外 retryable failure 分类和事务内不自动重试。
- 本地 formal DB transaction manager contract 已覆盖 transaction context、connection lease、begin、isolation policy、lock timeout、unit of work、commit/rollback、release、release 后 failure 分类、事务外 retry scope 和禁止事务内自动重试。
- 本地 DB connection-pool lifecycle contract 已覆盖 pool 初始化、max connections、acquire timeout、checkout、lease、pool exhausted 拒绝、release、driver failure 回滚释放和 active lease 泄漏检测。
- 本地 DB runtime adapter contract 已覆盖服务请求、连接池生命周期、正式事务管理器和 SQL driver trace 的桥接：池耗尽不进入事务和 driver，提交/回滚/driver failure 的三层终态一致，driver failure 在 release 后分类且只允许事务外重试。
- 本地 service transaction boundary contract 已把 DB runtime adapter witness trace 纳入服务入口验证：返回前同时校验 DB client trace、runtime adapter trace、source mutation 运行时期间解析和 service/runtime 终态一致性；源单期间无法解析时进入 `trace_invalid`，避免服务层把未能定位会计期间的源单写入视为有效运行时事务。
- 本地 PG-like client port contract 已覆盖真实 DB client 接口形状的前置边界：执行前校验 SQL 形状，成功路径 release 后返回，失败路径 rollback、release、再按 PostgreSQL 错误码分类并映射事务外 retryable；本地 native PostgreSQL pool adapter contract 已把真实 `pg.Pool` 风格对象适配到该 port 边界，覆盖 native pool/client 形状校验、参数/rows 边界复制、无效 client 释放和 native query failure 后的 rollback/release/classification；本地 PostgreSQL runtime binding contract 已把 native adapter 和 PG-like client port 串为一条可验证链路，证明 SQL shape failure 不触达 native pool，native shape failure 归入 `trace_invalid`，native query failure 仍保留 rollback/release/classification；本地 PostgreSQL secret resolver contract 已固定 `secret://` 引用解析、redacted evidence、过期/缺失/scope 拒绝和生产 managed-secret 证据门禁；本地 managed secret provider readiness contract 已固定服务运行时 env snapshot 不得携带裸数据库密钥、目标数据库身份不得来自 `DATABASE_URL`、生产 secret 必须有 access-policy/rotation/target DB evidence 且只输出 redacted keys；本地 PostgreSQL pool factory/config contract 已固定未来 `pg.Pool` 构造前的配置校验、生产证据门禁、无原始密码/URL 凭据边界、本地 localhost 限制、secret resolver 先行和 runtime binding delegation；本地 PostgreSQL runtime readiness package contract 已把 target DB、managed secret、backup/restore、owner、production apply approval、formal migration apply 和 pool config 收敛为一个前置包，未 ready 时不暴露可用 pool config；本地 PostgreSQL dependency admission、runtime admission orchestrator、runtime import、runtime implementation manifest 和 runtime implementation bundle contract 已证明 `pg` package/lockfile 满足后仍必须由运行时入口接收 readiness package 并内部派生 runtime evidence/pool config，不能信任外部传入 admission、runtime evidence 或 config，且加载后必须校验 `Pool` constructor、SQL repository runtime bindings 和 service runtime bundle evidence 再组装本地 runtime bundle；本地 project service runtime admission 已证明 ready bundle descriptor 会继续传入 service-process runtime，而不是停留在 admission 预检；本地 PG-like client/repository bridge contract 已把 repository driver executions 继续送入 PG-like client port，验证 statement/query/release/terminal 对齐，并把 PG query 失败后的终态不一致标记为 `trace_invalid`；本地 PG-like atomic commit bridge contract 进一步证明 staged repository state 只有在 PG-like replay 成功后才发布，PG 失败不会污染 committed snapshot；本地 service atomic commit boundary contract 把服务入口约束到该 atomic bridge delegation，防止服务层绕过 staged 发布边界；本地 PostgreSQL service runtime gateway contract 已把 runtime readiness/admission/import 放在 service atomic boundary 前，blocked readiness 不进入服务原子边界；本地 PostgreSQL shared service pool runtime contract 已证明 ready path 会构造一个请求级 native pool adapter 并交给 service atomic boundary 复用该 pool replay SQL；本地 PostgreSQL managed service pool runtime contract 已证明本地 runtime 实例必须消费已准入 runtime implementation bundle 的 poolConfig 建池，并拒绝 bundle/readiness pool config 漂移、shutdown 后新请求、初始化后替换 pool；本地 HTTP managed PostgreSQL runtime gateway contract 已证明 HTTP 写入口授权后进入 managed runtime，未授权或 readiness 阻断不会构造 pool，结账后源单守卫会复用同一 managed pool 并提交拒绝审计；当前已在 `@startupmanage/api` runtime dependencies 声明并通过 `pnpm-lock.yaml` 锁定 `pg`，并已有 runtime readiness package + managed secret provider readiness + runtime admission orchestrator + lazy runtime import + implementation manifest + implementation bundle contract，但仍没有连接正式项目数据库。
- 尚未有正式项目 schema migration apply、真实目标数据库选择、真实备份恢复计划审批、真实 release/rollback owner 指派、production apply approval、应用层真实 SQL driver/repository、真实 secret manager implementation、真实 DB client implementation、真实 DB runtime implementation、生产幂等键表、生产服务进程连接池 wiring、真实数据库隔离级别验证、多进程/多实例并发或真实服务级数据库并发测试证据；当前只有本地 managed secret provider readiness gate，不等于真实 secret manager 接入。

### 阶段 3：源单锁定

目标：所有影响已结账期间的 mutation API 必须统一拒绝。

后端必须提供通用校验：

```text
assertAccountingPeriodOpen(accountingPeriod)
```

覆盖范围：

- 应收应付新增、调整、作废。
- 发票匹配、取消匹配、红票处理。
- 收支流水复核、退回、作废。
- 银行对账确认、撤销、补差、冲正。
- 会计凭证制单、记账、冲销。
- 税务办理确认、缴款、回执变更。
- 社保公积金确认、缴费、回单变更。
- 薪酬明细确认、社保公积金确认、个税确认。
- 账套初始化启用后期初调整制单/记账。

验收：

- 前端按钮禁用并显示原因。
- 后端接口直接调用也拒绝。
- 错误码统一，例如 `CLOSED_ACCOUNTING_PERIOD`。
- 错误提示指向 `反结账` 或 `后续期间调整`。

文档契约状态：

- `CLOSED_ACCOUNTING_PERIOD` 已作为阶段 1-3 canonical 错误码写入 API
  和数据契约。
- 源单 mutation guard 覆盖面已文档化，要求后端统一调用
  `assertAccountingPeriodOpen(accountingPeriod, sourceModule, sourceId, operation)`。
- 本地源单 repository API contract 已把 create/update 源单写入统一送入同一个
  repository transaction guard，row-backed HTTP gateway 不再维护单独的新增源单
  事务分支。
- 本地源表 repository adapter contract 已证明源表行读取、闭期拒绝、版本冲突、
  成功回写和事务异常不提交都在同一 repository transaction guard 边界内。
- 仍缺生产源表服务/API、真实 SQL source repository、真实 auth middleware、真实源表事务和生产直接
  API 调用闭期拒绝证据；前端禁用态仍不能作为安全或锁期证据。

### 阶段 4：会计凭证生命周期硬化

目标：真实凭证和总账成为期间结账的事实来源。

必须实现：

- 候选凭证由后端服务推导。
- 制单生成正式凭证号。
- 制单冻结来源快照和分录快照。
- 记账写总账分录。
- 冲销生成反向凭证，不删除原凭证。
- 已结账期间禁止制单、记账、冲销。
- 已结账期间的历史凭证修正必须进入后续期间调整来源事项，并在目标开放期间生成调整凭证候选。

验收：

- 制单后源单变化不改写该凭证快照。
- 已记账凭证产生总账行。
- 重复记账不会重复写总账。
- 冲销保留原凭证和反向凭证关联。
- 已结账期间所有凭证动作被拒绝。
- 后续期间调整只影响目标期间总账，不改写历史期间凭证状态和总账行。

2026-07-04 阶段 4 本地契约进展：

- `apps/api/src/finance/accountingVoucherLedgerRepositoryContract.ts` 已把会计凭证生命周期包进本地凭证/总账 repository contract：制单、记账、冲销通过同一仓储快照读写 `vouchers`、`ledgerRows`、`events`、`idempotencyRecords` 和期间结账使用的 `voucherRows`。
- repository 级幂等已覆盖：同一制单/记账/冲销幂等键重放不重复写凭证或总账；同一幂等键但请求签名变化返回 `IDEMPOTENCY_KEY_REUSED`。
- repository 级 voucher row 同步已覆盖：`已制单` row 阻断目标期间 `voucher_booking`，`已记账` row 解除该阻断；后续期间调整候选 row 在制单后被正式凭证 row 替换；开放期冲销会保留原凭证 row 并新增冲销凭证 row，不误删原凭证证据。
- `apps/api/src/finance/accountingVoucherLedgerHttpApiGatewayContract.ts` 已补本地请求形态 gateway contract：`prepare / book / reverse` 通过同一入口读取 actor/time/request id header，执行本地 permission scope 校验、版本冲突校验、幂等重放、闭期拒绝，并把制单/记账后的 `voucherRows` 接回期间结账 `voucher_booking` 检查。
- 该进展仍是本地 framework-agnostic repository 和 request-shaped gateway contract，不是监听 HTTP、真实凭证/总账 SQL repository、数据库事务、权限中间件、migration 或生产总账持久化证据。

### 阶段 5：来源事项就绪检查

目标：把期间结账前置事项收敛为真实来源模块的就绪状态，而不是在期间结账内维护独立检查清单。

建议来源：

| 来源类型 | 来源模块 | 目标承接 |
| --- | --- | --- |
| 薪酬社保 | 薪酬社保 | 薪酬/社保凭证与缴费状态 |
| 税务办理 | 税务办理 | 税费凭证与办理状态 |
| 后续调整 | 会计凭证 | 后续期间调整凭证 |
| 资金链路 | 流水复核 / 银行对账 | 已复核流水与银行对账状态 |
| 财务报表 | 财务报表 | 报表可出具状态 |

阶段性策略：

```text
V1: 前端按真实来源模块汇总就绪状态
V2: 后端 close-checks 统一聚合来源状态和候选凭证状态
V3: 自动计算折旧、摊销、预提等来源事实，并由会计凭证承接
```

验收：

- 期间结账不得维护独立来源事项清单。
- 来源事项必须能回到所属模块确认或修正。
- 需要入账的事项必须由会计凭证候选承接。
- 候选凭证未制单或未记账会通过凭证检查阻断结账。
- 不适用、无事项和未启用的业务口径由所属模块负责表达。

### 阶段 6：反结账和后续期间调整

目标：为结账后错误建立正规修正路径。

默认规则：

- 普通错误优先走后续期间调整。
- 反结账是异常高权限流程。
- 反结账不删除历史事件。

反结账条件：

- 当前期间已结账。
- 操作人具备高权限。
- 必须填写原因。
- 后续期间未结账，或经过单独决策允许处理后续影响。
- 该期间没有不可逆外部提交，或已完成人工风险确认。

验收：

- 普通用户看不到反结账入口。
- 反结账写事件记录。
- 后续期间已结账或存在不可逆外部提交时，反结账默认阻断；只有带决策编号和确认说明的风险确认才能作为异常路径。
- 风险确认必须把后续已结账期间和不可逆外部提交保存为影响快照，不能只保存一句原因。
- 反结账后期间回到可处理状态。
- 后续期间调整不改历史源单，只生成调整凭证。
- 后续期间调整必须校验原期间已结账、目标期间开放且晚于原期间、原因必填。
- 后续期间调整生成的是目标期间 `待制单` 调整来源事实，不自动制单、记账或改写总账。
- 目标期间已锁定、未晚于原期间或原因缺失时，必须拒绝且不得创建调整事实。

2026-07-04 阶段 6 本地契约进展：

- `apps/api/src/finance/periodCloseContract.ts` 已把反结账高风险条件做成本地后端目标契约：后续期间已结账、不可逆外部提交默认返回 `PERIOD_REOPEN_BLOCKED` 并指向后续期间调整；风险确认缺少决策编号或确认说明时返回 `INVALID_REOPEN_RISK_CONFIRMATION`。
- 显式高风险确认通过时，期间记录和事件记录都会保存 `reopenImpactSnapshot` 与 `reopenRiskConfirmationSnapshot`，包括后续已结账期间、不可逆外部提交、决策编号和确认说明。
- `apps/api/src/finance/periodCloseRoutes.ts` 已把上述语义贯通到 framework-agnostic reopen route，并保留 server-owned actor/time。
- `apps/api/src/finance/periodCloseDatabaseContract.ts` 已声明并校验候选行字段 `reopen_impact_snapshot`、`reopen_risk_confirmation_snapshot`。
- `apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts` 已把 `POST /api/finance/accounting-vouchers/{id}/later-period-adjustments` 接入 row-backed gateway：成功后写入本地后续期间调整事实、幂等记录、事件和目标期间 `待制单` voucher row；同一幂等键重放不重复写行。
- 目标期间 `GET close-checks` 与 `POST close` 已共用该 voucher row 派生的凭证状态检查：`待制单` 阻断 `voucher_preparation`，`已制单` 阻断 `voucher_booking`，`已记账` 且其他检查通过时允许目标期间结账。
- `apps/api/src/finance/accountingVoucherLaterPeriodLifecycleBridgeContract.ts` 已把目标期间后续调整候选接入普通会计凭证生命周期输入：制单后回写调整事实为 `已制单`、用正式凭证 row 替换 `待制单` 候选 row，记账后写入总账行并将目标期间 row 更新为 `已记账`，目标期间随后可在其他检查通过时结账。
- 该进展仍是本地契约和候选行证据，不是生产 HTTP、真实 auth middleware、SQL migration、税务外部提交数据源、真实凭证 repository、总账持久化或审计归档实现。

### 阶段 7：财务报表承接

目标：报表只读取账务结果，不反向读取业务源单；已结账期间作为正式报表快照回看。

规则：

- 未结账期间：展示 `待结账` 状态，用于结账前核对资产负债表、利润表和现金流量表。
- 已结账期间：展示 `正式报表`；当前前端在确认结账时保存会话内总账行和报表行快照，后端接入后需要由总账、锁期和报表快照 repository 承接同一口径。
- 报表读取已记账总账和科目余额。
- 已结账期间单月回看优先读取结账快照，因此不因后续源单或实时分录变化而漂移；旧锁缺少快照时只能降级为只读参考，不声明正式冻结结果。
- 现金流量表必须读取已记账现金/银行分录，并使用对方科目的现金流量项目映射；缺映射时只提示待补映射，不允许用应收应付、流水、发票等业务源单直接倒推。
- 前端期间结账检查和本地后端目标契约都已使用财务报表 readiness 派生 `financial_statements` 阻断项；前端会话内结账快照已覆盖总账/报表回看，本地 row-backed gateway 已能把正式报表快照写入候选 rows；正式报表仍需真实后端总账查询、SQL snapshot repository、归档和审计后才能声明。
- 本地后端目标契约已要求正式报表快照在已结账期间生成，并保存源总账 hash、现金流量映射版本 hash 和按科目聚合的总账快照行；财务报表 route adapter 已覆盖 readiness、snapshot create、latest readback 和闭期快照不随当前 ledger entries 漂移；总账 route adapter 已覆盖 `GET /api/finance/general-ledger/{period}` 和 `GET /api/finance/general-ledger?period=YYYY-MM` 的科目余额、试算平衡、source-ledger hash、权限校验和统一 gateway 分发；本地总账 SQL repository/migration contract 已声明科目、期初余额和已记账总账分录三类表契约、查询索引、非破坏性迁移口径、row 校验和 route state 复用；本地财务报表 SQL repository/migration contract 已声明现金流量映射表、正式报表快照 rows、报表行、总账快照行、row 校验、快照重放和 route state 复用；本地统一 SQL repository gateway contract 已把 row-backed 期间锁、总账 SQL rows、现金流映射 SQL rows、报表 snapshot SQL rows 接到同一请求形态入口，并验证结账后读总账、报表 readiness、快照写入、快照重放和权限拒绝；row-backed HTTP gateway 已覆盖候选 rows 写入和重放，期间结账 route adapter 已用同一 readiness 派生 `financial_statements` 阻断项。真实 HTTP/API/DB 接入后才能作为正式报表证据。

验收：

- 报表金额可追溯到总账。
- `待结账` 和 `正式报表` 文案区分清楚，不再把已结账报表描述成试算或回看页。
- 已结账报表可复查。
- 报表不直接消费应收应付、流水、发票源单作为最终金额。
- 本地契约测试覆盖缺现金流映射阻断结账检查、未结账期间拒绝正式快照、displayed-readiness hash stale 拒绝、已生成快照不随后续映射变化漂移、既有快照重复生成不重写。

### 阶段 8：发布、回滚和恢复

目标：财务结账能力进入可控上线流程。

非生产上线前必须有：

- migration apply 和 rollback/forward-fix 说明。
- seed data replay。
- contract tests。
- permission tests。
- 幂等和并发测试。
- period close rollback-only dry-run。
- period close isolated apply fixture drill。
- period close row-lock concurrency drill。
- backup/restore drill 记录。

生产上线前额外需要：

- 明确 release owner。
- 明确 rollback owner。
- 明确异常处理窗口。
- 明确数据备份策略。
- 明确审计日志保留策略。

生产后禁止：

- destructive rollback 删除已记账凭证或总账。
- 直接修改已记账凭证。
- 自动重开已结账期间。
- 通过前端无审计修正式账务数据。

## 6. 验收主流程

完整验收必须跑通以下链路：

```text
1. 生成应收应付
2. 匹配或补充发票 / 税额依据
3. 发生收支流水
4. 流水复核通过
5. 银行对账完成
6. 生成会计凭证候选
7. 制单
8. 记账
9. 来源事项完成
10. 总账试算平衡
11. 税务办理完成
12. 社保公积金完成
13. close-checks 全部通过
14. 确认结账
15. 已结账期间禁止修改
16. 报表读取已结账结果
```

## 7. 异常验收矩阵

| 场景 | 预期 |
| --- | --- |
| 存在 `待生成` 或 `需处理` 凭证候选 | 不能结账 |
| 存在 `待制单` 凭证候选 | 不能结账 |
| 存在 `已制单` 但未 `已记账` 凭证 | 不能结账 |
| 总账借贷不平 | 不能结账 |
| 已复核流水未银行对账 | 不能结账 |
| 银行对账存在异常 | 不能结账 |
| 税务办理未完成 | 不能结账 |
| 社保公积金未完成 | 不能结账 |
| 来源事项未完成或候选凭证未承接 | 不能结账 |
| 已结账后调整应收应付 | 后端拒绝 |
| 已结账后修改发票匹配 | 后端拒绝 |
| 已结账后复核或作废当期流水 | 后端拒绝 |
| 已结账后制单、记账、冲销 | 后端拒绝 |
| 已结账后需要修正 | 默认走后续期间调整 |
| 高权限反结账 | 必须写原因和事件 |
| 后续期间已结账时反开前期 | 默认拒绝，需单独决策 |

## 8. 前端验收标准

`/finance/period-close` 必须满足：

- 只展示检查、详情、确认结账。
- 不展示直接处理业务的按钮。
- 检查项包含状态、说明、来源和下一步。
- `确认结账` 只在全部检查通过时出现。
- 确认抽屉必须填写 `结账说明`。
- 已结账后不再显示可结账动作。
- 已结账状态和结账记录清晰可读。

其他页面必须满足：

- 已结账期间禁用编辑入口。
- 禁用原因明确。
- 不把隐藏按钮当作安全控制。
- API 返回锁期错误时能展示可理解提示。

## 9. 后端验收标准

必须具备的 API：

```text
GET  /api/finance/accounting-periods
GET  /api/finance/accounting-periods/{period}/close-checks
POST /api/finance/accounting-periods/{period}/close
POST /api/finance/accounting-periods/{period}/reopen
```

必须具备的后端能力：

- 期间状态持久化。
- 结账检查快照。
- 结账事件。
- 反结账事件。
- 源单 mutation 锁期校验。
- 凭证制单/记账/冲销锁期校验。
- 幂等键校验。
- 并发版本校验。

## 10. 自动化测试门禁

每一阶段至少需要以下门禁：

| Gate | 覆盖 |
| --- | --- |
| model unit tests | close-checks、来源事项承接、试算平衡、状态派生 |
| API contract tests | close、reopen、source mutation guard、idempotency |
| permission tests | 反结账、高权限操作、普通用户禁用 |
| integration tests | 业务事实到结账全链路 |
| frontend tests | 检查项、确认抽屉、已结账禁用态 |
| build gates | typecheck、lint、unit tests、build、diff check |
| residual scans | 旧状态、旧文案、绕过期间锁入口 |

## 11. 暂不纳入首轮实现

以下能力不应混入首轮期间锁实现：

- 固定资产完整台账。
- 自动折旧计算。
- 长期待摊自动摊销。
- 复杂成本分摊。
- 多级审批。
- 税务申报真实接口。
- 银行直连。
- 电子会计档案合规归档。
- 正式三张表审计级输出。

这些能力需要在后续阶段作为独立模块或独立合同推进。

## 12. 推荐执行顺序

```text
1. 后端期间锁和 close-checks 契约细化
2. 前端期间结账改为读取后端检查结果
3. 源单和凭证 API 加期间锁校验
4. 会计凭证生命周期后端化
5. 来源事项就绪状态接入后端 close-checks
6. 反结账 / 后续期间调整流程
7. 财务报表承接
8. 电子档案和审计归档
```

执行原则：先完成“锁”和“不能乱改”，再补自动折旧、摊销、预提和报表。否则会继续扩大账务漂移。

## 13. 决策项

| Decision | Recommendation | Status |
| --- | --- | --- |
| 期间结账页是否承载业务动作 | 不承载，只做检查和锁期 | recommended |
| 已结账期间是否允许直接改源单 | 不允许，必须后端拒绝 | recommended |
| 来源事项首轮形态 | 所属模块处理，期间结账只消费汇总状态和凭证承接结果 | recommended |
| 反结账是否开放给普通用户 | 不开放，高权限异常流程 | recommended |
| 错误修正默认方式 | 后续期间调整优先 | recommended |
| 报表是否由结账动作生成 | 不由结账动作生成；结账后报表读取锁定账簿 | recommended |
| 是否首轮做固定资产/长期待摊 | 暂不混入期间锁首轮 | recommended |
| 是否接真实税务/银行接口 | 暂不接，先完成内部账务闭环 | recommended |

## 14. 当前缺口

| Gap | Impact | Target phase |
| --- | --- | --- |
| 后端 close-checks 未实现 | 已有本地 Node HTTP listener、具体框架 adapter contract、route adapter、server handler contract、framework route binding contract、HTTP runtime contract、session principal resolver contract、identity/resource SQL-shape contract、auth middleware contract、resource authorization middleware contract、JSON transport contract、HTTP 请求形态 gateway contract、HTTP service transaction gateway contract、HTTP managed PostgreSQL runtime gateway contract、HTTP managed PostgreSQL application framework adapter、application route plugin、application Node server route-plugin host contract、project API server wiring contract、project runtime process contract、project runtime Node server contract、project service-process bootstrap contract、project service-process runtime lifecycle contract、managed secret provider readiness contract、runtime implementation manifest contract、runtime implementation bundle contract、project service runtime admission contract 和 row-backed gateway repository contract，并已覆盖 close-check 服务端重算 snapshot 拒绝客户端旧 hash、统一 `/api/finance` route plugin 入口、非财务 unmatched 边界、unsupported method 前置拒绝、禁止 direct finance handler、统一 application adapter managed-first/fallback 入口，以及 readiness/admission 阻断时不构造 project API server、active path 委托同一 managed runtime、project runtime process active summary 和 Node host trace header helper 必须暴露 bundle evidence 且 bundle/readiness drift 以 `blocked_by_runtime_bundle` 阻断、shutdown 后拒绝新请求、本地 Node host 只允许 active process listen 且 close 时同步 shutdown runtime、本地服务进程启动前拒绝生产启动/原始密钥/非 localhost bind、本地 service-process bootstrap summary 承接 runtime Node bundle evidence、本地 service-process runtime manifest/health/readiness/draining/graceful shutdown 和 ready 前 bundle continuity 校验、本地 service runtime admission 启动前校验 service manifest、runtime implementation manifest、runtime readiness、managed secret provider readiness 和 dependency admission，implementation manifest blocked 时返回 `runtime_implementation_blocked` 且不启动服务运行时，runtime implementation bundle 要求 dependency、pool config、SQL repository runtime bindings 和 service runtime bundle evidence 全部通过，且准入后的 bundle descriptor 会继续进入 service-process runtime summary/probes，managed service pool runtime 会消费 bundle.poolConfig 建池并在 bundle/readiness pool config 漂移时以 `runtime_bundle_invalid` 阻断；前端检查仍不能作为真实结账依据，仍缺真实身份提供方、生产 session/cookie 策略、真实 DB repository/migration、用户-账套资源服务、生产 server/auth middleware 和生产级集成测试 | 阶段 1 |
| 期间锁未持久化 | 已有 row-backed candidate rows、HTTP 入口到 row-backed repository、HTTP 写入口到 service transaction boundary、HTTP 写入口到 managed PostgreSQL runtime、project runtime process contract、project runtime Node server contract、project service-process bootstrap contract、project service-process runtime lifecycle contract、managed secret provider readiness contract、project service runtime admission contract、PostgreSQL migration plan、project migration artifact、仓库内 not-applied SQL artifact、rollback/forward-fix review、operational gate contract、本地 PostgreSQL dry-run、isolated apply fixture drill、persisted replay drill、row-lock concurrency drill、service concurrency contract、service transaction boundary runtime trace validation、PG-like client port contract、native PostgreSQL pool adapter contract、PostgreSQL runtime binding contract、PostgreSQL secret resolver contract、PostgreSQL pool factory/config contract、PostgreSQL runtime readiness package contract、runtime implementation manifest contract、runtime implementation bundle contract、PG-like client/repository bridge contract、PG-like atomic commit bridge contract、service atomic commit boundary contract、PostgreSQL service runtime gateway contract、PostgreSQL shared service pool runtime contract、PostgreSQL managed service pool runtime contract（含 bundle.poolConfig 消费和 bundle/readiness drift 阻断）、row-backed service-restart idempotent replay、transaction isolation policy contract、formal DB transaction manager contract、DB connection-pool lifecycle contract 和 DB runtime adapter contract；仍缺正式项目 schema migration apply、真实目标数据库选择、真实备份恢复计划审批、真实 release/rollback owner 指派、production apply approval、真实应用层 SQL driver/repository、真实 secret manager implementation、真实 DB client implementation、真实 DB runtime implementation、生产应用服务进程 wiring、真实数据库隔离级别验证、真实应用服务数据库持久化重放和多实例真实服务级验证 | 阶段 2 |
| 源单 API 未统一锁期 | 已有本地 source mutation route adapter、operation registry、源单 repository API contract、源表 repository adapter contract、source mutation API transaction bridge、HTTP managed PostgreSQL source mutation bridge/server-entry/framework-adapter/application-framework/route-plugin/node-listener/application-server/project-server-wiring/project-runtime-process/project-runtime-node-server/project-service-process-bootstrap/project-service-process-runtime-lifecycle/project-service-runtime-admission contract 和 row-backed HTTP gateway 矩阵测试，覆盖所有普通本地 route skeleton 在已提交候选期间锁后拒绝闭期写入，证明 create/update 源单写入统一进入 repository transaction guard，并进一步证明 concrete framework-shaped request 映射、server-shaped 请求解析、framework route plugin 统一 `/api/finance` 入口、framework application managed-first/fallback route、服务端 principal/账套资源校验、客户端 header 防伪、真实本地 HTTP listener、application Node server 通过 route plugin host 委托统一 application adapter、project API server wiring 禁止 direct finance handler、project runtime process active path 委托同一 managed runtime 且 active summary 必须携带 runtime bundle evidence、本地 project runtime Node host 通过真实 HTTP 请求进入同一进程链、本地 service-process bootstrap 启动前阻断生产/密钥/公网配置漂移、本地 service-process runtime lifecycle 探针和 graceful shutdown 边界、本地 service runtime admission 启动前阻断未满足准入的服务运行时、managed runtime commit 后 SQL 源表回写、闭期拒绝不回写、版本冲突和事务异常不提交的本地源表边界；仍缺生产源表服务/API、真实 SQL source repository runtime、真实 auth middleware、源表事务和生产直接 API 调用闭期拒绝证据 | 阶段 3 |
| 会计凭证仍有前端 session 生命周期 | 已有本地后端目标契约覆盖制单冻结快照、记账写总账、重复记账重放、开放期冲销和闭期拒绝；本地凭证/总账 repository contract 已覆盖仓储快照、幂等重放、voucher row 同步和总账行回读；本地 request-shaped gateway 已覆盖 prepare/book/reverse 的权限、版本、幂等和闭期拒绝。仍缺监听 HTTP、真实凭证/总账 SQL repository、数据库事务、权限中间件、migration 和生产持久化回放证据，前端 session 仍不是正式凭证和总账证据 | 阶段 4 |
| 来源事项就绪仍未后端化 | 前端已移除独立来源 checklist，改由薪酬社保、税务办理、会计凭证、资金复核、银行对账和报表准备等真实模块状态汇总结账；仍缺后端统一 close-checks 来源状态服务、自动折旧/摊销/预提计算、候选凭证服务、HTTP/DB/权限/事务证据 | 阶段 5 |
| 反结账未成正式后端流程 | 已有本地契约覆盖普通阻断、高风险确认、影响快照、路由适配和候选行校验；仍缺真实 HTTP、权限中间件、SQL migration、不可逆外部提交数据源、审计归档和生产级事务证据 | 阶段 6 |
| 后续期间调整后端证据未闭合 | 已有前端原型、前端模型测试、文档合同、本地 API contract 测试、row-backed gateway 写入本地调整事实/幂等/事件/目标期间 voucher row 的证据，以及候选到正式凭证生命周期的本地桥接契约；本地 contract 已覆盖 `待制单` 阻断制单、`已制单` 阻断记账、`已记账` 后目标期间可结账。仍缺监听 HTTP、真实 auth middleware、SQL migration、真实凭证/调整事实 repository、数据库事务和生产总账持久化联动证据 | 阶段 6 |
| 财务报表后端和现金流量表未闭合 | 已有前端只读正式报表承接、前端结账时会话内总账/报表快照、前端期间结账 `financial_statements` 映射缺口阻断、现金流量项目映射、会计科目只读映射呈现、本地后端目标契约测试、route adapter 测试和 HTTP 请求形态 gateway contract；正式报表本地契约已携带源总账 hash、现金流映射 hash 和按科目聚合的总账快照行；本地总账/科目余额 read contract 已覆盖 posted ledger rows、期初余额、试算平衡、source-ledger hash 和 gateway 分发；本地总账 SQL repository/migration contract 已覆盖科目、期初余额、总账分录表契约、查询索引、非破坏性迁移口径、row 校验和 route state 复用；本地财务报表 SQL repository/migration contract 已覆盖现金流量映射表、正式报表快照 rows、报表行、总账快照行、row 校验、闭期快照重放和 route state 复用；本地统一 SQL repository gateway contract 已把 row-backed 期间锁、总账 SQL rows 和报表 snapshot SQL rows 接到同一请求形态入口；candidate DB row contract 已声明并验证正式报表快照、报表行和总账快照行；row-backed HTTP gateway 已能把正式报表快照写入候选 rows 并重放既有快照；期间结账本地 route adapter 已用财务报表 readiness 派生 `financial_statements` 阻断项；仍缺真实监听 HTTP、真实 SQL driver/repository 集成、migration apply、数据库事务、归档和审计证据 | 阶段 7 |
| 备份恢复和审计归档未实现 | 不具备生产治理证据 | 阶段 8 |

## 15. 完成定义

本方案真正完成时，必须同时满足：

- 后端是唯一期间结账检查来源。
- 结账锁持久化且可审计。
- 已结账期间所有相关 mutation API 被锁期校验保护。
- 会计凭证制单、记账、冲销写入后端并影响总账。
- 来源事项有真实模块、真实状态，并由会计凭证或所属业务模块承接。
- 反结账和后续期间调整路径明确。
- 报表读取总账和科目余额。
- 自动化测试和非生产演练证据完整。

在这些条件完成前，任何页面效果都只能视为前端原型或阶段性闭环，不能声明为正式财务结账能力。
