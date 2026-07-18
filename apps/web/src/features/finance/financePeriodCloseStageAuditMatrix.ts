export type FinancePeriodCloseStageId =
  | 'phase_0_decision_contract'
  | 'phase_1_backend_close_checks'
  | 'phase_2_persistent_period_lock'
  | 'phase_3_source_mutation_lock'
  | 'phase_4_accounting_voucher_lifecycle'
  | 'phase_5_source_readiness_checks'
  | 'phase_6_reopen_and_later_adjustment'
  | 'phase_7_financial_statement_carryover'
  | 'phase_8_release_recovery_governance';

export type FinancePeriodCloseStageStatus =
  | 'frontend_governance_satisfied'
  | 'frontend_prototype_partial'
  | 'local_contract_partial'
  | 'documented_gap';

export type FinancePeriodCloseFormalCompletion = 'not_formally_complete';

export type FinancePeriodCloseStageGate =
  | 'document_gate'
  | 'automated_gate'
  | 'evidence_gate'
  | 'manual_approval_gate';

export type FinancePeriodCloseExecutionTrackId = 'local_backend_contract_hardening';

export type FinancePeriodCloseExecutionTrack = {
  activeScope: string[];
  deferredScope: string[];
  id: FinancePeriodCloseExecutionTrackId;
  title: string;
};

export type FinancePeriodCloseStageAuditEntry = {
  blockers: string[];
  currentEvidence: string[];
  formalCompletion: FinancePeriodCloseFormalCompletion;
  gateClasses: FinancePeriodCloseStageGate[];
  id: FinancePeriodCloseStageId;
  nextAction: string;
  order: number;
  stage: string;
  status: FinancePeriodCloseStageStatus;
};

export const financePeriodCloseCurrentExecutionTrack: FinancePeriodCloseExecutionTrack = {
  activeScope: [
    '本地后端 close-checks 和期间锁契约',
    '本地 Node HTTP listener 和请求链路契约',
    '本地 HTTP 服务事务网关契约',
    '本地身份/session/权限/账套资源授权契约',
    '本地 row-backed 源单闭期守卫证据',
    '本地 period-close SQL migration/repository transaction contract',
    '本地 period-close formal DB transaction manager contract',
    '本地 period-close DB connection-pool lifecycle contract',
    '本地 period-close DB runtime adapter contract',
    '本地 period-close PostgreSQL client bridge contract',
    '本地 period-close native PostgreSQL pool adapter contract',
    '本地 period-close PostgreSQL runtime binding contract',
    '本地 period-close PostgreSQL secret resolver contract',
    '本地 period-close managed secret provider readiness contract',
    '本地 period-close PostgreSQL pool factory/config contract',
    '本地 period-close PostgreSQL runtime readiness package contract',
    '本地 period-close PostgreSQL dependency admission contract',
    '本地 period-close PostgreSQL runtime admission orchestrator contract',
    '本地 period-close PostgreSQL runtime import contract',
    '本地 period-close PostgreSQL atomic commit bridge contract',
    '本地 period-close service atomic commit boundary contract',
    '本地 period-close PostgreSQL service runtime gateway contract',
    '本地 period-close PostgreSQL shared service pool runtime contract',
    '本地 period-close PostgreSQL managed service pool runtime contract',
    '本地 period-close HTTP managed PostgreSQL runtime gateway contract',
    '本地 source mutation API transaction bridge contract',
    '本地 HTTP managed PostgreSQL source mutation bridge contract',
    '本地 HTTP managed PostgreSQL source mutation server contract',
    '本地 HTTP managed PostgreSQL source mutation framework adapter contract',
    '本地 HTTP managed PostgreSQL application framework adapter contract',
    '本地 HTTP managed PostgreSQL application framework route plugin contract',
    '本地 HTTP managed PostgreSQL source mutation Node listener contract',
    '本地 HTTP managed PostgreSQL application Node server contract',
    '本地 HTTP managed PostgreSQL project API server wiring contract',
    '本地 HTTP managed PostgreSQL project runtime process contract',
    '本地 HTTP managed PostgreSQL project runtime Node server contract',
    '本地 HTTP managed PostgreSQL project service-process bootstrap contract',
    '本地 HTTP managed PostgreSQL project service-process runtime lifecycle contract',
    '本地 HTTP managed PostgreSQL project service runtime admission contract',
    '本地 period-close PostgreSQL runtime implementation manifest contract',
    '本地 period-close PostgreSQL runtime implementation bundle contract',
    '本地 PostgreSQL migration plan contract',
    '本地 period-close transaction isolation policy contract',
    '本地 PostgreSQL rollback-only dry-run',
    '本地 PostgreSQL isolated apply fixture drill',
    '本地 PostgreSQL persisted replay drill',
    '本地 PostgreSQL row-lock concurrency drill'
  ],
  deferredScope: [
    '具体框架和生产部署的 HTTP API',
    '真实数据库 migration 和 repository',
    '生产身份、session/cookie 和用户-账套资源服务',
    '生产发布、恢复和审计归档证据'
  ],
  id: 'local_backend_contract_hardening',
  title: '当前执行轨道：本地后端契约加固'
};

export const financePeriodCloseStageAuditMatrix: readonly FinancePeriodCloseStageAuditEntry[] = [
  {
    blockers: [
      '当前只推进本地后端契约，仍需避免把本地 listener / row-backed harness 说成生产后端',
      '后续若启用真实数据库、生产身份或发布流程，需要重新确认边界'
    ],
    currentEvidence: [
      'docs/governance/finance-period-close-industrial-execution-acceptance-plan-v1.md',
      'apps/web/src/features/finance/financePeriodCloseAcceptanceMatrix.ts',
      'docs/evidence/finance-period-close-phase1-3-contract-evidence.md'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['document_gate', 'automated_gate'],
    id: 'phase_0_decision_contract',
    nextAction: '保持当前本地后端契约加固轨道；进入真实数据库、生产身份或发布流程前先更新执行决策和验收证据。',
    order: 0,
    stage: '阶段 0：决策和契约冻结',
    status: 'frontend_governance_satisfied'
  },
  {
    blockers: [
      '已有本地 Node HTTP listener、具体框架 adapter、server handler、framework route binding、HTTP runtime、JSON transport、auth middleware、HTTP 请求形态 gateway contract、服务事务网关 contract、HTTP managed PostgreSQL runtime gateway contract、managed application framework adapter、managed application route plugin、managed application Node server route-plugin host contract、project API server wiring contract、project runtime process contract、project runtime Node server contract、project service-process bootstrap contract、project service-process runtime lifecycle contract 和 project service runtime admission contract，但缺生产部署的 close-checks API',
      '已有本地后端 close-checks sourceVersionSetHash / checkSnapshotHash，且 POST close 会用服务端重算 hash 拒绝客户端旧快照；仍缺真实 DB repository 与生产级集成测试证明前端不再自行计算最终 canClose',
      '已有本地 session principal resolver、identity/resource SQL-shape contract 和账套资源 scope authorization contract，但缺真实身份提供方、生产 session/cookie 策略、真实用户-账套资源服务、数据库 repository/migration 和服务端集成测试证明前端不再自行计算最终 canClose'
    ],
    currentEvidence: [
      'docs/api/finance-period-close-api-contract.md',
      'apps/api/src/finance/financeHttpJsonTransportContract.ts',
      'apps/api/src/finance/financeHttpAuthMiddlewareContract.ts',
      'apps/api/src/finance/financeHttpResourceAuthorizationContract.ts',
      'apps/api/src/finance/financeHttpSessionPrincipalContract.ts',
      'apps/api/src/finance/financeIdentityResourceSqlRepositoryContract.ts',
      'apps/api/src/finance/financeHttpServerRuntimeContract.ts',
      'apps/api/src/finance/financeHttpFrameworkRouteBindingContract.ts',
      'apps/api/src/finance/financeHttpServerHandlerContract.ts',
      'apps/api/src/finance/financeHttpConcreteFrameworkAdapterContract.ts',
      'apps/api/src/finance/financeNodeHttpServerContract.ts',
      'apps/api/src/finance/financeHttpServiceTransactionGatewayContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedRuntimeGatewayContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedApplicationFrameworkAdapterContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedApplicationFrameworkRoutePluginContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedApplicationNodeServerContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectApiServerWiringContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeProcessContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeNodeServerContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessBootstrapContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessRuntimeContract.ts',
      'apps/api/src/finance/periodCloseManagedSecretProviderReadinessContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceRuntimeAdmissionContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeImplementationManifestContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeImplementationBundleContract.ts',
      'apps/api/src/finance/financeHttpApiGateway.ts',
      'apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts',
      'apps/api/src/finance/periodCloseContract.ts',
      'apps/api/src/finance/periodCloseRoutes.ts',
      'apps/web/src/features/finance/financePeriodCloseModel.ts'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['document_gate', 'automated_gate', 'evidence_gate'],
    id: 'phase_1_backend_close_checks',
    nextAction: '当前仍不推进生产 server；本地 Node HTTP listener、具体框架 adapter、server handler、framework route binding、HTTP runtime、session principal resolver、identity/resource SQL-shape contract、auth middleware、resource authorization middleware、JSON transport、gateway、服务事务网关、HTTP managed PostgreSQL runtime gateway、managed application framework adapter、managed application framework route plugin、managed application Node server route-plugin host、project API server wiring、project runtime process、project runtime Node server、project service-process bootstrap、project service-process runtime lifecycle、managed secret provider readiness、runtime implementation manifest、runtime implementation bundle 和 project service runtime admission 已覆盖真实本地端口监听、Express/Fastify/Next-like request/response 适配、server URL/query/header/body 解析、财务路由绑定、请求入口、body size guard、Bearer/cookie session 到 principal/resource 映射、用户/session/权限/账套资源 grant 行形态校验、请求解析、响应序列化、服务端 actor/permission/resource/request context 注入、客户端权限/资源头防伪、close-check 服务端重算快照拒绝旧 hash、闭期源单拒绝、HTTP 写入口进入服务事务边界、HTTP 写入口进入 managed PostgreSQL runtime，以及 application Node server 只通过统一框架路由插件把 /api/finance 委托到同一个 application adapter 后再先匹配 managed source mutation、未处理再委托普通 finance handler，项目级 API server wiring 禁止 direct finance handler，project runtime process 在 readiness/admission 阻断时不构造项目 API server，active path 必须暴露 runtime bundle evidence 后才把 project wiring 委托到同一 managed runtime，bundle/readiness drift 以 blocked_by_runtime_bundle 阻断，project runtime Node server 只允许本地 host、非 active process 不允许 listen、关闭 HTTP server 时同步 shutdown managed runtime，project service-process bootstrap 在 listen 前拒绝生产启动、原始密钥环境变量和非 localhost bind，并在 summary 中承接 runtime Node bundle evidence id 与 lifecycle，project service-process runtime lifecycle 在启动后提供本地 manifest、health/readiness 探针、draining 状态、优雅 shutdown 委托，并把已准入 runtime implementation bundle evidence 暴露到 runtime summary/probes，runtime implementation bundle 证明只有 implementation manifest、dependency admission、readiness-derived pool config、SQL repository runtime bindings 和 service runtime bundle evidence 全部通过时才会组装本地 runtime bundle，project service runtime admission 在启动服务运行时前统一校验服务 manifest、runtime implementation bundle 和 managed secret provider readiness，并把 ready bundle descriptor 传给 serviceRuntime.start，implementation manifest blocked 时以 runtime_implementation_blocked 前置阻断，bundle evidence 缺失时以 runtime_implementation_bundle_blocked 阻断，启动后 handle/health/readiness bundle evidence 漂移时以 runtime_bundle_continuity_blocked 阻断且不暴露 unsafe handle；下一步需要真实身份提供方、生产 session/cookie 策略、真实 DB repository/migration、用户-账套资源服务、生产 server 接入和生产级集成测试。',
    order: 1,
    stage: '阶段 1：后端 close-checks 统一口径',
    status: 'local_contract_partial'
  },
  {
    blockers: [
      '已有本地 period-close SQL migration/repository transaction contract、application SQL transaction manager contract、SQL driver/repository adapter contract、PG-like client port contract、native PostgreSQL pool adapter contract、PostgreSQL runtime binding contract、PostgreSQL secret resolver contract、PostgreSQL pool factory/config contract、PostgreSQL runtime readiness package contract、DB client/repository contract、PG-like client/repository bridge contract、PG-like atomic commit bridge contract、service atomic commit boundary contract、PostgreSQL service runtime gateway contract、PostgreSQL shared service pool runtime contract、PostgreSQL managed service pool runtime contract、HTTP managed PostgreSQL runtime gateway contract、formal DB transaction manager contract、DB connection-pool lifecycle contract、DB runtime adapter contract、service transaction boundary runtime trace contract、service concurrency contract、row-backed service-restart idempotent replay、PostgreSQL migration plan contract、project migration artifact contract、仓库内 not-applied SQL artifact、rollback/forward-fix review、operational gate contract、rollback-only dry-run、isolated apply fixture drill、persisted replay drill 和 row-lock concurrency drill；目标数据库、备份恢复、release/rollback owner 和生产 apply 审批仍保持未开始，缺正式项目 schema migration apply 证据',
      '已有本地 transaction isolation policy contract 覆盖 READ COMMITTED、accounting_periods SELECT FOR UPDATE、幂等唯一约束、源单守卫、报表快照 source-hash 校验、外层 retryable failure 分类和事务内不自动重试；仍缺真实数据库隔离级别验证',
      'pg runtime dependency manifest/lockfile admission 已完成本地 package/lockfile 准入，且已有 runtime readiness package 把目标数据库、secret、备份恢复、owner、production apply approval、formal migration apply 和 pool config 收敛成一个可验证包；managed secret provider readiness 已证明服务运行时环境快照不能携带裸 DATABASE_URL/PGPASSWORD/POSTGRES_PASSWORD/FINANCE_DATABASE_PASSWORD，受管 secret reference 必须和目标数据库 evidence 匹配，生产 secret 必须有 access-policy/rotation 证据，且结果只暴露 redacted keys 和 secret:// 引用；runtime implementation manifest 已把 service process entry、managed secret adapter、lazy pg import、native managed pool、SQL repository runtime、migration apply、durable audit/observability 收敛成可验证清单，当前 local contract / row-backed / fake pg / local audit 均不能被误判为真实 DB runtime；runtime implementation bundle 已把 manifest、dependency admission、readiness-derived pool config、SQL repository runtime bindings 和 service runtime bundle evidence 串成统一准入包，implementation/dependency/repository/service evidence 任一阻断都不会组装 bundle；runtime admission orchestrator 现在直接接收 readiness package 并在入口内部派生 runtime evidence/pool config 后才绑定 lazy runtime import；PostgreSQL service runtime gateway 已证明 blocked readiness 不进入 service atomic boundary；PostgreSQL shared service pool runtime 已证明 ready path 构造单个请求级 native pool adapter并交给 service atomic boundary 复用该 pool replay SQL；PostgreSQL managed service pool runtime 已硬切为必须接收并消费已准入 runtime implementation bundle，使用 bundle.poolConfig 建池，并把 bundle pool config 与 readiness 派生配置交叉校验；bundle 缺失实现路径或 pool config 漂移会以 runtime_bundle_invalid 阻断，ready 实例仍跨请求复用同一个 native pool adapter、shutdown 后拒绝新请求、初始化后拒绝替换 pool；HTTP managed PostgreSQL runtime gateway 已证明 HTTP 写入口在授权后进入 managed runtime、未授权不进入 runtime、readiness 阻断不建池、结账后源单守卫复用同一 managed pool；project runtime process 已证明 readiness/admission 阻断不构造项目 API server、bundle/readiness drift 以 blocked_by_runtime_bundle 阻断、active summary 暴露 runtime bundle evidence 且 Node host trace header helper 保留该 evidence id 后才复用同一 managed runtime、shutdown 后拒绝框架请求；project runtime Node server 已证明非 active process 不允许本地 listen、active process 可通过真实本地 HTTP 请求进入同一 managed runtime、close 时关闭 HTTP server 并 shutdown runtime；project service-process bootstrap 已证明本地服务进程启动前拒绝生产启动、原始密钥环境变量和非 localhost bind；project service-process runtime lifecycle 已证明本地 manifest、health/readiness、draining 和 graceful shutdown 只在非生产服务进程契约内成立，会在 ready 前校验 bootstrap runtime-bundle evidence continuity，并在启动后持续暴露 runtime implementation bundle evidence；project service runtime admission 已证明服务运行时启动前会先校验服务 manifest、执行 runtime implementation bundle、派生 runtime readiness、执行 managed secret provider readiness，并把 ready bundle descriptor 传入 serviceRuntime.start，在 bundle 或 secret provider 阻断时不会调用 serviceRuntime.start；仍缺真实 secret manager implementation、真实 DB client implementation、真实 DB runtime implementation、生产应用服务进程 wiring 和真实服务级数据库并发事务测试',
      '缺真实应用服务数据库持久化重放、多进程/多实例并发和真实 DB 事务竞争验证'
    ],
    currentEvidence: [
      'docs/data/finance-period-close-data-contract.md',
      'apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts',
      'apps/api/src/finance/financeHttpServiceTransactionGatewayContract.ts',
      'apps/api/src/finance/periodClosePersistenceContract.ts',
      'apps/api/src/finance/periodCloseRepositoryContract.ts',
      'apps/api/src/finance/periodCloseDatabaseContract.ts',
      'apps/api/src/finance/periodCloseDatabaseRepositoryContract.ts',
      'apps/api/src/finance/periodCloseSqlRepositoryContract.ts',
      'apps/api/src/finance/periodCloseSqlTransactionManagerContract.ts',
      'apps/api/src/finance/periodCloseSqlDriverRepositoryContract.ts',
      'apps/api/src/finance/periodClosePostgresClientPortContract.ts',
      'apps/api/src/finance/periodCloseNativePostgresPoolAdapterContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeBindingContract.ts',
      'apps/api/src/finance/periodClosePostgresSecretResolverContract.ts',
      'apps/api/src/finance/periodCloseManagedSecretProviderReadinessContract.ts',
      'apps/api/src/finance/periodClosePostgresPoolFactoryContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeReadinessPackageContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeImplementationManifestContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeImplementationBundleContract.ts',
      'apps/api/src/finance/periodClosePostgresDependencyAdmissionContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeAdmissionOrchestratorContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
      'apps/api/src/finance/periodClosePostgresDbClientRepositoryBridgeContract.ts',
      'apps/api/src/finance/periodClosePostgresAtomicCommitBridgeContract.ts',
      'apps/api/src/finance/periodCloseServiceAtomicCommitBoundaryContract.ts',
      'apps/api/src/finance/periodClosePostgresServiceRuntimeGatewayContract.ts',
      'apps/api/src/finance/periodClosePostgresSharedServicePoolRuntimeContract.ts',
      'apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedRuntimeGatewayContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeProcessContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeNodeServerContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessBootstrapContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessRuntimeContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceRuntimeAdmissionContract.ts',
      'apps/api/src/finance/periodCloseDbClientRepositoryContract.ts',
      'apps/api/src/finance/periodCloseServiceTransactionBoundaryContract.ts',
      'apps/api/src/finance/periodCloseServiceConcurrencyContract.ts',
      'apps/api/src/finance/periodCloseTransactionIsolationPolicyContract.ts',
      'apps/api/src/finance/periodCloseFormalDbTransactionManagerContract.ts',
      'apps/api/src/finance/periodCloseDbConnectionPoolLifecycleContract.ts',
      'apps/api/src/finance/periodCloseDbRuntimeAdapterContract.ts',
      'apps/api/src/finance/periodClosePostgresMigrationContract.ts',
      'apps/api/src/finance/periodCloseProjectMigrationArtifactContract.ts',
      'apps/api/src/finance/periodCloseMigrationFormalApplyReviewContract.ts',
      'apps/api/src/finance/periodCloseMigrationOperationalGateContract.ts',
      'apps/api/src/finance/periodCloseMigrationArtifactFileContract.ts',
      'apps/api/migrations/not-applied/20260704_000001_period_close_persistent_lock.sql',
      'apps/api/scripts/period-close-migration-artifact-file-contract.test.mjs',
      'apps/api/src/finance/periodClosePostgresDryRunContract.ts',
      'apps/api/src/finance/periodClosePostgresApplyDrillContract.ts',
      'apps/api/src/finance/periodClosePostgresReplayDrillContract.ts',
      'apps/api/src/finance/periodClosePostgresConcurrencyDrillContract.ts',
      'scripts/local/period-close-postgres-dry-run.sh',
      'scripts/local/period-close-postgres-apply-drill.sh',
      'scripts/local/period-close-postgres-replay-drill.sh',
      'scripts/local/period-close-postgres-concurrency-drill.sh'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['document_gate', 'automated_gate', 'evidence_gate'],
    id: 'phase_2_persistent_period_lock',
    nextAction: '当前本地契约轮次已补 row-backed candidate rows、HTTP service transaction gateway contract、HTTP managed PostgreSQL runtime gateway contract、project runtime process contract、project runtime Node server contract、project service-process bootstrap contract、project service-process runtime lifecycle contract、project service runtime admission contract、runtime implementation manifest contract、runtime implementation bundle contract、period-close SQL migration/repository transaction contract、application SQL transaction manager contract、SQL driver/repository adapter contract、PG-like client port contract、native PostgreSQL pool adapter contract、PostgreSQL runtime binding contract、PostgreSQL secret resolver contract、managed secret provider readiness contract、PostgreSQL pool factory/config contract、PostgreSQL runtime readiness package contract、PostgreSQL dependency admission contract、PostgreSQL runtime admission orchestrator contract、PostgreSQL runtime import contract、DB client/repository contract、PG-like client/repository bridge contract、PG-like atomic commit bridge contract、service atomic commit boundary contract、PostgreSQL service runtime gateway contract、PostgreSQL shared service pool runtime contract、PostgreSQL managed service pool runtime contract、formal DB transaction manager contract、DB connection-pool lifecycle contract、DB runtime adapter contract、service transaction boundary runtime trace contract、service concurrency contract、row-backed service-restart idempotent replay、transaction isolation policy contract、PostgreSQL migration plan contract、project migration artifact contract、仓库内 not-applied SQL artifact、rollback/forward-fix review、operational gate contract、rollback-only dry-run、isolated apply fixture drill、persisted replay drill 和 row-lock concurrency drill；下一步需要真实选择目标数据库、批准备份恢复计划、明确 release/rollback owner、取得生产 apply 审批、执行正式项目 schema migration apply、接入真实 secret manager implementation、真实 DB client implementation、真实 DB runtime implementation、生产应用服务进程 wiring、真实数据库隔离级别验证和真实 DB/多实例并发服务测试。',
    order: 2,
    stage: '阶段 2：期间锁持久化',
    status: 'local_contract_partial'
  },
  {
    blockers: [
      '已有本地源单 payload contract、源单 API service contract、source mutation API transaction bridge contract、HTTP managed PostgreSQL source mutation bridge/server/framework-adapter、application-framework、route-plugin、node-listener、application-server、project-server-wiring contract、project-runtime-process contract、project-runtime-node-server contract、project-service-process-bootstrap contract、project-service-process-runtime-lifecycle contract 和 project-service-runtime-admission contract 证明直接 API、row-backed gateway、service transaction gateway、HTTP managed PostgreSQL runtime gateway 会使用同一套源单 payload 校验，并证明直接 API 请求会经过 route 匹配、payload 校验、权限校验、SQL 源表 hydrate、服务事务边界委托、服务提交成功后 SQL 源表回写；HTTP managed PostgreSQL 源单写入会先经过 concrete framework-shaped request 映射、server-shaped URL/JSON/受信 principal/账套资源 scope 边界、统一 framework route plugin、统一 framework application adapter、本地 Node HTTP listener、统一 application server、project API server wiring、带 runtime bundle evidence 的 project runtime process、本地 project runtime Node host、本地 service-process bootstrap 启动边界、本地 service-process runtime lifecycle 探针/关闭边界和 service runtime admission 启动准入，再进入 managed runtime，且只有 managed runtime 已提交并返回业务成功才回写 SQL 源表，再返回闭期拒绝或开放期写入结果；仍缺生产源表服务/API/真实数据库 runtime 集成',
      '已有本地源表 SQL repository contract 证明源表表结构、参数化语句、SQL row 校验、闭期拒绝、版本冲突、新增插入和成功回写统一经过 repository transaction guard；仍缺生产 source API service wiring 和真实 SQL repository runtime',
      '缺真实用户-账套资源映射、审计事件、create/update 源单行不变的真实事务证据'
    ],
    currentEvidence: [
      'apps/web/src/features/finance/financePeriodCloseSourceMutationMatrix.ts',
      'docs/data/finance-period-close-source-mutation-matrix.md',
      'apps/api/src/finance/financeHttpApiGateway.ts',
      'apps/api/src/finance/financeHttpApiRepositoryGatewayContract.ts',
      'apps/api/src/finance/financeHttpServiceTransactionGatewayContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedRuntimeGatewayContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedSourceMutationServerContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedApplicationFrameworkAdapterContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedApplicationFrameworkRoutePluginContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedSourceMutationNodeServerContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedApplicationNodeServerContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectApiServerWiringContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeProcessContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectRuntimeNodeServerContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessBootstrapContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceProcessRuntimeContract.ts',
      'apps/api/src/finance/periodCloseManagedSecretProviderReadinessContract.ts',
      'apps/api/src/finance/financeHttpPostgresManagedProjectServiceRuntimeAdmissionContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeImplementationManifestContract.ts',
      'apps/api/src/finance/periodClosePostgresRuntimeImplementationBundleContract.ts',
      'apps/api/src/finance/financeSourceMutationPayloadContract.ts',
      'apps/api/src/finance/periodCloseSourceMutationRepositoryApiContract.ts',
      'apps/api/src/finance/periodCloseSourceTableRepositoryContract.ts',
      'apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts',
      'apps/api/src/finance/periodCloseSourceMutationApiServiceContract.ts',
      'apps/api/src/finance/periodCloseSourceMutationApiTransactionBridgeContract.ts',
      'apps/api/src/finance/periodCloseSourceMutationGuard.ts',
      'apps/api/src/finance/periodCloseSourceMutationRoutes.ts'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['automated_gate', 'evidence_gate'],
    id: 'phase_3_source_mutation_lock',
    nextAction: '当前本地契约轮次继续用源单矩阵、route skeleton、源单 payload contract、源单 repository API contract、源表 repository adapter contract、源表 SQL repository contract、源单 API service contract、source mutation API transaction bridge contract、HTTP managed PostgreSQL source mutation bridge/server/framework-adapter/application-framework/route-plugin/node-listener/application-server/project-server-wiring/project-runtime-process/project-runtime-node-server/project-service-process-bootstrap/project-service-process-runtime-lifecycle/project-service-runtime-admission contract、runtime implementation manifest contract、runtime implementation bundle contract、HTTP service transaction gateway、HTTP managed PostgreSQL runtime gateway 和 row-backed create/update 契约防漂移；下一步需要生产源表服务/API、真实 SQL source repository runtime、生产 auth middleware、真实用户-账套资源映射和数据库事务集成。',
    order: 3,
    stage: '阶段 3：源单锁定',
    status: 'local_contract_partial'
  },
  {
    blockers: [
      '会计凭证记账、冲销仍是前端 session 生命周期',
      '缺正式凭证号、凭证快照、总账分录持久化和重复记账防重',
      '缺已结账期间凭证动作的真实后端拒绝'
    ],
    currentEvidence: [
      'apps/web/src/features/finance/financeAccountingVoucherModel.ts',
      'apps/web/src/features/finance/financeAccountingVoucherModel.test.ts',
      'apps/web/src/features/finance/financeGeneralLedgerModel.ts',
      'apps/api/src/finance/accountingVoucherLaterPeriodAdjustmentContract.ts'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['automated_gate', 'evidence_gate'],
    id: 'phase_4_accounting_voucher_lifecycle',
    nextAction: '当前本地契约轮次继续收敛凭证记账、冲销和后续调整的本地契约与页面口径；真实持久化服务留作后续接入。',
    order: 4,
    stage: '阶段 4：会计凭证生命周期硬化',
    status: 'frontend_prototype_partial'
  },
  {
    blockers: [
      '结账来源检查已收敛到真实模块，但仍是前端会话汇总依据',
      '缺薪酬社保、税费计提凭证、会计凭证和资金链路的后端统一结账来源状态服务',
      '缺来源事项到候选凭证、凭证记账和闭期检查的一致性持久化证据'
    ],
    currentEvidence: [
      'apps/web/src/features/finance/financePeriodCloseModel.ts',
      'apps/web/src/features/finance/FinancePeriodClosePage.tsx',
      'apps/web/src/features/finance/financePeriodCloseModel.test.ts',
      'apps/web/src/features/finance/financeAccountingVoucherModel.ts',
      'apps/web/src/features/finance/financeTaxFilingData.ts',
      'apps/web/src/features/finance/financeData.ts'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['automated_gate', 'evidence_gate'],
    id: 'phase_5_source_readiness_checks',
    nextAction: '后端接入时提供统一结账来源状态 API，期间结账只消费汇总结果和来源入口，不承载来源业务处理。',
    order: 5,
    stage: '阶段 5：结账来源检查收敛',
    status: 'frontend_prototype_partial'
  },
  {
    blockers: [
      '反结账已具备前端 mock 顺序修复抽屉和原因记录，缺真实高权限流程',
      '后续期间调整缺真实持久化来源事实、权限、事务和候选凭证查询 API',
      '缺操作原因、事件、权限和后续期间已结账影响的真实验证'
    ],
    currentEvidence: [
      'apps/api/src/finance/accountingVoucherLaterPeriodAdjustmentContract.ts',
      'apps/api/src/finance/periodCloseRoutes.ts',
      'apps/web/src/features/finance/FinanceAccountingVouchersPage.tsx',
      'apps/web/src/features/finance/FinanceManagementState.tsx',
      'apps/web/src/features/finance/financeAccountingVoucherModel.ts',
      'apps/web/src/features/finance/financeAccountingVoucherModel.test.ts',
      'apps/web/src/features/finance/financePeriodCloseModel.test.ts',
      'docs/evidence/finance-period-close-phase1-3-contract-evidence.md'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['automated_gate', 'evidence_gate', 'manual_approval_gate'],
    id: 'phase_6_reopen_and_later_adjustment',
    nextAction: '当前前端保留后续期间调整优先和跳月锁反结账修复；真实反结账权限、事件、审批和并发事务边界留作后续接入。',
    order: 6,
    stage: '阶段 6：反结账和后续期间调整',
    status: 'local_contract_partial'
  },
  {
    blockers: [
      '当前已具备前端会话资产负债表/利润表/现金流量表试算和结账回看页面',
      '已有前端期间结账财务报表现金流量映射缺口阻断，以及本地后端目标契约和 route adapter 覆盖现金流量映射缺口、已结账快照、stale readiness、latest readback、快照不漂移规则',
      '缺正式监听 HTTP API、真实 SQL driver/repository、真实资产负债表、利润表、现金流量表查询服务、报表快照 repository 和归档证据',
      '缺现金流量表项目映射表的 migration apply、补充资料、权限、审计和数据库事务证据'
    ],
    currentEvidence: [
      'apps/api/src/finance/financialStatementContract.ts',
      'apps/api/src/finance/financialStatementContract.test.ts',
      'apps/api/src/finance/financialStatementRoutes.ts',
      'apps/api/src/finance/financialStatementRoutes.test.ts',
      'apps/api/src/finance/financialStatementSqlRepositoryContract.ts',
      'apps/api/src/finance/financialStatementSqlRepositoryContract.test.ts',
      'apps/api/src/finance/generalLedgerContract.ts',
      'apps/api/src/finance/generalLedgerContract.test.ts',
      'apps/api/src/finance/generalLedgerRoutes.ts',
      'apps/api/src/finance/generalLedgerRoutes.test.ts',
      'apps/api/src/finance/generalLedgerSqlRepositoryContract.ts',
      'apps/api/src/finance/generalLedgerSqlRepositoryContract.test.ts',
      'apps/api/src/finance/financeSqlRepositoryGatewayContract.ts',
      'apps/api/src/finance/financeSqlRepositoryGatewayContract.test.ts',
      'apps/api/src/finance/financeHttpApiGateway.ts',
      'apps/api/src/finance/periodCloseRoutes.ts',
      'apps/api/src/finance/periodCloseRoutes.test.ts',
      'apps/web/src/features/finance/FinanceFinancialStatementsPage.tsx',
      'apps/web/src/features/finance/FinanceAccountingSubjectsPage.tsx',
      'apps/web/src/features/finance/financeAccountingSubjectData.ts',
      'apps/web/src/features/finance/financeAccountingSubjectData.test.ts',
      'apps/web/src/features/finance/financeFinancialStatementsModel.ts',
      'apps/web/src/features/finance/financeFinancialStatementsModel.test.ts',
      'apps/web/src/features/finance/financePeriodCloseModel.ts',
      'apps/web/src/features/finance/financePeriodCloseModel.test.ts',
      'apps/web/src/features/finance/financeGeneralLedgerModel.ts',
      'docs/data/finance-accounting-voucher-ledger-contract.md'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['document_gate', 'automated_gate', 'evidence_gate'],
    id: 'phase_7_financial_statement_carryover',
    nextAction:
      '当前已具备前端只读财务报表承接、前端期间结账财务报表现金流量映射缺口阻断、现金流量表映射试算、本地后端目标契约、本地 route adapter、本地 HTTP 请求形态 gateway contract、本地总账/科目余额 read contract、本地总账 SQL repository/migration contract、本地现金流映射和报表 snapshot SQL repository contract，以及统一 SQL repository gateway contract 衔接期间锁、总账 SQL rows 和报表 snapshot SQL rows；下一步需要真实监听 HTTP、真实 SQL driver/repository 集成、migration apply、数据库事务、归档和审计证据。',
    order: 7,
    stage: '阶段 7：财务报表承接',
    status: 'local_contract_partial'
  },
  {
    blockers: [
      '缺 migration apply/rollback 或 forward-fix 记录',
      '缺 non-production dry run、backup/restore drill、release owner 和 rollback owner',
      '缺生产发布、监控、审计归档和事故恢复证据'
    ],
    currentEvidence: [
      'docs/governance/finance-period-close-industrial-execution-acceptance-plan-v1.md',
      'docs/testing/test-plan.md',
      'docs/evidence/finance-period-close-phase1-3-contract-evidence.md'
    ],
    formalCompletion: 'not_formally_complete',
    gateClasses: ['document_gate', 'evidence_gate', 'manual_approval_gate'],
    id: 'phase_8_release_recovery_governance',
    nextAction: '当前本地契约轮次不触发发布、恢复或生产证据；真实后端和数据库落地后再补非生产演练、恢复演练、发布和回滚证据。',
    order: 8,
    stage: '阶段 8：发布、回滚和恢复',
    status: 'documented_gap'
  }
];
