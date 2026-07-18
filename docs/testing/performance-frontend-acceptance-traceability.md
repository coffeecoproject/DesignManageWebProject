# 绩效前端硬切验收追踪表

Status: `phase-0-7-implemented-browser-evidence-complete`

Source plan: `docs/governance/performance-frontend-hardcut-execution-acceptance-plan-v1.md`

## 1. 追踪规则

每个验收项必须同时给出可定位的业务输入、领域结果、跨模块影响和自动测试证据。页面可见或类型检查通过不能单独作为业务验收通过依据。

状态只使用：

- `planned`：尚未进入实现。
- `in_progress`：已有实现但证据未完整。
- `passed`：对应自动测试和静态门禁均通过。
- `blocked`：存在明确外部决策或后端依赖。

## 2. Phase 0/1 追踪

| ID | 场景 | 状态 | 代码证据 | 自动证据 | UI/静态证据 |
| --- | --- | --- | --- | --- | --- |
| PF-01 | 人员类型自动适用 | passed | `performanceRuleApplicabilityModel.ts` | `performanceRuleApplicabilityModel.test.ts` | 绩效明细读取规则适用结果 |
| PF-02 | 岗位自动适用 | passed | `performanceRuleApplicabilityModel.ts` | `performanceRuleApplicabilityModel.test.ts` | 绩效明细读取规则适用结果 |
| PF-03 | 未发布规则不适用 | passed | `performanceRuleApplicabilityModel.ts` | `performanceRuleApplicabilityModel.test.ts` | 规则适用异常由领域结果统一给出 |
| PF-04 | 规则版本边界 | passed | `performanceRuleModel.ts`、`performanceRuleApplicabilityModel.ts` | `performanceRuleModel.test.ts`、`performanceRuleApplicabilityModel.test.ts` | 规则发布自动关闭前一版本；区分历史/当前发布版本 |
| PF-05 | 签署档案不控制计算 | passed | `performanceMonthlyModel.ts` | `performanceMonthlyModel.test.ts` | 月度结果不读取签署档案 |
| PF-06 | 线下档案维护 | passed | `performanceSignatureModel.ts` | `performanceSignatureModel.test.ts` | 仅维护当前档案/历史档案及上传文件关系 |
| PF-07 | 在线确认残留清零 | passed | 绩效类型、规则、月度和看板模型 | 生产代码残留扫描 | 在线确认批次、员工选择规则、未签新版回退均已清零 |
| PF-19 | 3个工作日反馈期限 | passed | `performanceResultDeadlineModel.ts`、`performanceResultResponseModel.ts` | `performanceResultDeadlineModel.test.ts`、`performanceResultWorkflow.test.ts` | 工作日算法及员工反馈期限动作均已接入 |

## 3. Phase 2 追踪

| ID | 场景 | 状态 | 代码证据 | 自动证据 | UI/静态证据 |
| --- | --- | --- | --- | --- | --- |
| PF-08 | 任务验收来源唯一 | passed | `taskPerformanceMonthlySourceModel.ts` 以 `taskId` 去重并保留最新有效计分事实 | `taskPerformanceMonthlySourceModel.test.ts` 重复计分场景 | 月度结果携带唯一 `sourceRecordIds` |
| PF-09 | 非有效任务排除 | passed | `taskPerformanceMonthlySourceModel.ts` 校验任务完成、验收时间、计分状态、全职工资人员和规则版本 | `taskPerformanceMonthlySourceModel.test.ts` 未验收、退回、作废、兼职和版本漂移场景 | 无效来源不生成结果行 |
| PF-10 | 结构化公式 | passed | `performanceRuleCalculationModel.ts`；规则字段 `monthlyPrepayRatio / belowBaselineFactor / qualityDimensions.weight` | `performanceMonthlyModel.test.ts` 结构化预发、未达标和质量权重场景 | 生产计算不读取 `payoutMode` 显示文本 |
| PF-11 | 中途入离职折算 | passed | `performanceMonthlyModel.ts` 仅折算满分、达标线和基础金额，保留任务得分 | `performanceMonthlyModel.test.ts` 月中入职、月中离职场景 | 明细展示任职工作日折算结果 |
| PF-12 | 零任务月份 | passed | `getTaskPerformanceSourceMonths` 从已发布规则生效期间生成月份；来源模型生成 0 分 0 元记录 | `taskPerformanceMonthlySourceModel.test.ts` 无任务月份和规则期间场景 | 列表明确显示 `0 条`来源，不伪装为空数据 |
| PF-13 | 未实现模板隔离 | passed | 来源模型只生成`绘图任务制`；月度页面只保留`综合 / 绘图任务制` | `taskPerformanceMonthlySourceModel.test.ts` 不支持类别隔离场景 | 生产代码残留扫描无岗位职责或项目奖金当前结果 Mock |

## 4. Phase 3 追踪

| ID | 场景 | 状态 | 代码证据 | 自动证据 | UI/静态证据 |
| --- | --- | --- | --- | --- | --- |
| PF-14 | 月度草稿重算 | passed | `performanceResultModel.ts`按当前来源生成稳定身份草稿并重算来源哈希 | `performanceResultModel.test.ts`：`PF-14 recomputes an unpublished draft without creating formal history` | 草稿不进入正式下游读模型 |
| PF-15 | 月度结果发布 | passed | `PerformanceResultState.tsx`、`performanceResultModel.ts`冻结计算、规则、来源、人员、送达和工作日历快照 | `performanceResultModel.test.ts`：`PF-15 publishes an immutable monthly result snapshot with delivery evidence` | `PerformanceResultDrawer.tsx`提供发布动作和三Tab详情 |
| PF-29 | 统一读模型 | passed | `usePerformanceResults.ts`、`performanceResultConsumerModel.ts`和`salaryPerformanceConsumptionModel.ts`向全部当前消费者提供正式结果 | 结果版本测试、人员/任务候选测试及`performance-phase6-consumer-hardcut.mjs`通过 | 浏览器同会话发布后，绩效看板、人员总览和薪酬明细读取边界一致；见`docs/evidence/performance-frontend-browser-evidence-2026-07-17.md` |
| PF-30 | 风险文案 | passed | `peoplePerformanceRiskModel.ts`只读取已发布结果并输出`绩效规则低分风险` | `peopleDomain.test.ts`验证无正式结果不触发、已发布结果按适用规则触发 | 人员总览无`触发开除条件`及旧评价字段读取 |

Phase 3 同时完成以下无独立验收编号的结果版本控制：同一`员工 + 月份 + 绩效类别`保持一个结果谱系；重复发布被阻断；来源未变化不能创建更正；来源变化时生成V2并将V1保留为`已更正`历史。

## 5. Phase 4 追踪

| ID | 场景 | 状态 | 代码证据 | 自动证据 | UI/静态证据 |
| --- | --- | --- | --- | --- | --- |
| PF-21 | 季度应有月份 | passed | `performanceQuarterlyResultModel.ts`按实际存在的适用月度结果草稿推导季度月份 | `performanceQuarterlyResultModel.test.ts`：`PF-21 derives only actually applicable months for a mid-quarter start` | 月中开始适用时不把前置月份伪装为缺失 |
| PF-22 | 季度缺月及异议阻断 | passed | `getQuarterlyPublishBlockingReasons`拒绝未发布适用月份和未处理月度异议 | `performanceQuarterlyResultModel.test.ts`：`PF-22 blocks quarterly publication and lists every unpublished applicable month`、`PF-22B blocks quarterly publication while a source month has an open objection` | 共享结果抽屉展示全部发布阻断原因，发布按钮禁用 |
| PF-23 | 季度金额计算 | passed | 季度计算快照从正式月度结果归集金额、预发和差额 | `performanceQuarterlyResultModel.test.ts`：`PF-23 derives quarterly amount prepay total and difference from published monthly results` | 季度列表和抽屉只展示派生金额，不提供最终金额自由输入 |
| PF-24 | 季度调整 | passed | 季度发布只接受调整金额、原因和可选佐证；非零调整强制原因 | `performanceQuarterlyResultModel.test.ts`：`PF-24 requires a reason for nonzero quarterly adjustment and freezes the adjusted amount` | 调整区在同一抽屉内展示计算金额、预发、最终金额和差额 |
| PF-25 | 季度结算期间 | passed | `salarySettlementMonth`由季度末月派生，结果类型不存在自由`settlementDate` | `performanceQuarterlyResultModel.test.ts`：`PF-25 derives the quarter-end salary month and exposes no free settlement date` | 列表和抽屉只读展示薪酬结算月份；残留扫描只命中反向断言 |
| PF-26 | 季度员工反馈 | passed | 季度发布复用统一送达、截止日快照和员工反馈契约 | `performanceQuarterlyResultModel.test.ts`验证送达前置；`performanceResultWorkflow.test.ts`验证季度确认与异议 | 员工端复用共享三 Tab 结果抽屉和月度同一反馈状态机 |

## 6. Phase 5 追踪

| ID | 场景 | 状态 | 代码证据 | 自动证据 | UI/静态证据 |
| --- | --- | --- | --- | --- | --- |
| PF-16 | 员工确认本人结果 | passed | `performanceResultResponseModel.ts`只允许当前员工确认当前正式版本 | `performanceResultWorkflow.test.ts`验证员工、时间、版本及金额不变 | `/my-work/performance`及共享结果抽屉提供`确认结果` |
| PF-17 | 员工提出异议 | passed | 异议只接受原因和可选文件标识，不接收结果金额 | `performanceResultWorkflow.test.ts`验证必填原因、附件去重和金额不变 | 共享抽屉复用文件上传组件，不新增审批状态或审批页面 |
| PF-18 | 越权与旧版本反馈 | passed | 当前结果谱系、员工工号和结果版本共同构成反馈门禁 | `performanceResultWorkflow.test.ts`验证他人结果和已更正V1均被拒绝 | 员工列表只输出本人当前正式版本 |
| PF-19 | 反馈期与到期未反馈 | passed | `performanceResultDeadlineModel.ts`冻结三工作日截止日；`performanceResultResponseModel.ts`阻断超期动作并派生`已送达未反馈` | 两组领域测试覆盖周末、节假日、补班、日历优先级、反馈期内及到期后 | 反馈期内只显示员工动作；到期后不再开放反馈 |
| PF-20 | 异议薪酬边界 | passed | `isPerformanceResultSalaryEligible`和`salaryPerformanceConsumptionModel.ts`共同阻断反馈期内结果及有效异议 | `performanceResultWorkflow.test.ts`与`salaryPerformanceConsumptionModel.test.ts`覆盖管理端、薪酬读取及结算防绕过 | 基础工资不依赖绩效反馈；管理端不新增审批状态 |
| PF-31 | 共享抽屉 | passed | `PerformanceResultDrawer.tsx`统一编排管理端月度、季度及员工端结果详情 | `performance-phase7-residual-hardcut.mjs`、typecheck及build | 两个页面复用共享`结果概览 / 来源明细 / 操作记录`三 Tab，无页面穿透 |
| PF-32 | 会话一致性 | passed | `PerformanceResultState.tsx`统一承载发布、反馈和异议处理状态；`performanceResultMockBootstrapModel.ts`仅把当前演示账号的最新有效任务来源按正式发布领域函数初始化 | 领域工作流测试验证同一状态集合的连续变更；PF-32自动测试验证演示正式结果保留任务计分来源、工作日截止期和待确认状态 | 全新浏览器会话直接进入员工端可见正式结果并完成确认；管理端手工发布、员工端确认及管理端回读证据继续保留；异议分支由领域测试覆盖 |

## 7. Phase 6 追踪

| ID | 场景 | 状态 | 代码证据 | 自动证据 | UI/静态证据 |
| --- | --- | --- | --- | --- | --- |
| PF-27 | 薪酬唯一消费 | passed | `salaryPerformanceConsumptionModel.ts`只把月度`prepayAmount`和季度`quarterDifferenceAmount`转换为唯一结算引用；`performanceResultSettlementModel.ts`只结算工资实际引用的结果 | `salaryPerformanceConsumptionModel.test.ts`覆盖唯一引用、反馈门禁、异议阻断和结算防绕过 | 全新浏览器会话完成`员工确认 -> 月度预发12.38元进入薪酬 -> 薪酬确认 -> 绩效生命周期已结算`；见`docs/evidence/performance-frontend-browser-evidence-2026-07-17.md` |
| PF-28 | 薪酬确认后更正 | passed | 月度与季度更正均生成下一版本；季度人工调整录错可在月度来源未变时更正；`salaryDomain.ts`把已确认/已发放月份后的差额顺延到下一未锁月份 | `performanceResultModel.test.ts`、`performanceQuarterlyResultModel.test.ts`的`PF-28B`和`salaryPerformanceConsumptionModel.test.ts`覆盖月度V2、季度调整V2、历史冻结及后续差额 | 不覆盖原薪酬，不新增审批或独立绩效付款入口 |

PF-29已经取得正式结果发布后的浏览器多页面一致性证据。PF-32同时覆盖两条路径：管理端把当前账号来源草稿发布后由员工确认并在管理端回读；全新会话由演示启动模型把同一任务来源按正式发布函数初始化，使`我的绩效`无需依赖旧会话即可展示。初始化结果不是手写金额快照，仍保留任务计分、规则、人员和工作日历来源。

## 8. Phase 7 追踪

| 范围 | 状态 | 代码证据 | 自动证据 | 剩余证据 |
| --- | --- | --- | --- | --- |
| 旧人员绩效契约删除 | passed | `peopleTypes.ts`、`mockData.ts`、`peopleDomain.ts`及人员创建逻辑不再定义或构造旧评价字段 | `performance-phase7-residual-hardcut.mjs`扫描全部前端TypeScript源文件 | 无 |
| 旧季度与独立状态文件删除 | passed | `PerformanceMonthlyState.tsx`、`performanceExecutionContract.ts`和`performanceQuarterlyReviewModel.ts`保持删除 | P7静态门禁拒绝旧文件回归 | 无 |
| 共享结果抽屉 | passed | 管理端和员工端均复用`PerformanceResultDrawer.tsx` | P7静态门禁验证2个消费者和3个Tab | 管理端浏览器完成三Tab视觉、键盘切换和发布动作；员工端复用同一组件并完成结果确认 |

## 9. 后续阶段

| 范围 | 验收项 | 状态 |
| --- | --- | --- |
| 员工结果反馈 | PF-16 至 PF-20、PF-26员工动作 | passed |
| 季度结果 | PF-21 至 PF-25 | passed |
| 薪酬消费 | PF-27、PF-28 | passed |
| 统一读模型与会话交互 | PF-29、PF-32 | passed；正式结果发布后的管理端消费者和员工反馈同会话交互均已验证 |
| 旧类型、Mock和组件残留 | Phase 7 | passed |
| 共享结果抽屉 | PF-31 | passed |
| 中性风险文案 | PF-30 | passed |

## 10. 工作日口径证据要求

PF-19 至少覆盖以下可执行场景：

1. 周五送达，普通周末跳过。
2. 连续法定节假日全部跳过。
3. 周末调休补班计入工作日。
4. 员工专属工作日历优先于公司默认日历。
5. 日历缺失时阻断，不按固定双休估算。
6. 截止日生成后保存工作日历快照标识，后续日历变化不得改写既有截止日。

## 11. 完成门禁

Phase 0/1 只有在以下证据全部存在时才能标记完成：

- PF-01 至 PF-07 自动测试通过。
- PF-19 工作日算法测试通过；完整反馈工作流仍保持后续阶段状态。
- 绩效生产代码中不存在旧在线确认批次、员工选择规则或未签新版回退逻辑。
- `test:web`、`typecheck`、`lint`、`build:web`、`ai-native:check`和`git diff --check`通过。

Phase 2 只有在以下证据全部存在时才能标记完成：

- PF-08 至 PF-13 均有对应领域测试并通过。
- 月度来源只来自有效任务验收和已发布结构化规则，不再读取静态结果 Mock。
- 零任务月份由已发布规则的生效期间驱动，不依赖当月存在任务。
- 生产计算中不存在 `payoutMode` 文案解析、隐藏未达标系数或隐式等权质量计算。
- 未实现绩效类别不生成结果、不进入薪酬，也不作为可用结果 Tab 呈现。
- `test:web`、`typecheck`、`lint`、`build:web`、`ai-native:check`和`git diff --check`通过。

Phase 3 只有在以下证据全部存在时才能标记完成：

- PF-14、PF-15和结果版本控制场景有领域测试并通过。
- 同一员工、月份和绩效类别使用稳定结果身份，来源记录ID或规则版本变化不得生成第二条并行结果。
- 草稿不进入绩效看板和人员摘要；发布和更正后只输出当前正式版本。
- 人员总览不再把`workEvaluationSummary / workEvaluationRecords`当作当前绩效事实。
- 绩效风险不输出劳动关系结论性文案。
- 本阶段不初始化伪造的正式结果Mock；浏览器刷新恢复草稿基线是已声明的前端边界。
- `test:web`、`typecheck`、`lint`、`build:web`、`ai-native:check`和`git diff --check`通过。

Phase 4 只有在以下证据全部存在时才能标记完成：

- PF-21 至 PF-25 均有季度领域测试并通过；PF-26明确保持 Phase 5 员工动作边界。
- 季度应有月份只来自实际适用月度结果，不要求员工尚未入职或规则尚未生效的月份。
- 缺少任一适用月已发布结果时，领域发布与页面动作同时阻断并列出月份。
- 季度最终金额只由月度金额、预发合计和有原因的调整派生，不允许自由填写。
- 绩效模块不保留自由结算日期；只输出季度末薪酬结算月份和唯一差额引用。
- 旧`performanceQuarterlyReviewModel`、旧季度输入和独立季度状态已从绩效生产代码清零；季度薪酬消费已在Phase 6切换为正式季度差额结果。
- `test:web`、`typecheck`、`lint`、`build:web`、`ai-native:check`和`git diff --check`通过。

Phase 5 只有在以下证据全部存在时才能标记完成：

- PF-16 至 PF-20以及PF-26员工动作均有领域工作流测试并通过。
- 员工只读取和反馈本人当前正式版本；他人结果、草稿、已更正历史和超期结果不可操作。
- 确认和异议不允许编辑结果金额，不新增审批状态、审批页面或伪造正式结果Mock。
- 管理端只通过维持原结果或基于已变化正式来源生成更正版本关闭异议。
- `我的绩效`复用统一结果抽屉；工作概览、任务候选和薪酬消费已在Phase 6完成正式结果硬切。
- `test:web`、`typecheck`、`lint`、`build:web`、`ai-native:check`和`git diff --check`通过。

Phase 6 只有在以下证据全部存在时才能标记实现完成：

- PF-20、PF-27和PF-28跨模块测试通过，且薪酬结算动作不能绕过反馈期限或有效异议。
- 月度只结算预发、季度只结算复核差额；同一结算引用只能被一个薪酬批次承接。
- 已确认薪酬后的月度或季度更正不回写原薪酬，只把相对已承接版本的差额顺延到下一未确认月份。
- 工作概览、人员总览、绩效看板、任务候选、人员任务和薪酬均不读取旧人员评价字段作为当前绩效事实。
- 任务候选中的绩效只作软提示，不得成为人员可承接资格门禁。
- 领域测试、静态硬切门禁及Web质量门禁通过。PF-29必须有发布后多页面一致性证据；PF-32必须额外有当前员工确认或异议的浏览器交互证据。

Phase 7 只有在以下证据全部存在时才能标记实现完成：

- 旧人员绩效类型、字段、Mock和测试夹具从全部前端源文件删除，不保留可选字段或双读兼容。
- 管理端月度/季度结果和员工端结果只复用一个共享结果抽屉，固定为三个领域Tab。
- 已删除的旧季度模型和独立结果状态文件不得恢复。
- P7静态残留门禁、Web单测、类型检查、Lint、构建、AI Native检查和差异检查全部通过。
- 浏览器证据缺失时，只能声明领域与静态实现完成；当前PF-29和PF-32均已有对应页面交互证据。

## 12. 本轮门禁结果

执行日期：`2026-07-17`

| 门禁 | 分类 | 结果 | 证据 |
| --- | --- | --- | --- |
| 绩效业务场景 | automated_gate | passed | `corepack pnpm test:web`，`492/492`；覆盖历史规则解析、验收证据、当前账号来源草稿及正式演示初始化、月度异议阻断季度、季度调整更正和争议结果消费者隔离 |
| Web 类型 | automated_gate | passed | `corepack pnpm --filter @startupmanage/web typecheck` |
| 全仓类型 | automated_gate | passed | `corepack pnpm typecheck` |
| 代码规范 | automated_gate | passed | `corepack pnpm lint` |
| Web 构建 | automated_gate | passed | `corepack pnpm build:web` |
| AI Native 适配 | automated_gate | passed | `corepack pnpm ai-native:check` |
| 差异格式 | automated_gate | passed | `git diff --check` |
| Phase 6 消费者硬切 | automated_gate | passed | `performance-phase6-consumer-hardcut.mjs`扫描7个当前消费者；薪酬、工作概览、人员总览、绩效看板、任务候选和人员任务无旧人员评价事实读取 |
| Phase 7 残留硬切 | automated_gate | passed | `performance-phase7-residual-hardcut.mjs`扫描326个前端源文件、2个共享抽屉消费者和3个固定Tab；旧人员绩效契约及旧文件无残留 |
| Phase 2 来源隔离 | automated_gate | passed | PF-08 至 PF-13 单元场景通过；月度页面仅保留`综合 / 绘图任务制`，未实现类别不生成当前结果 |
| 页面交互 | evidence_gate | passed | 本机 Chromium CDP 完成真实DOM点击、真实`role=tab`键盘切换、月度/季度发布、季度更正表单、当前账号员工确认、管理端回读、SPA路由切换、截图和控制台采集；见`docs/evidence/performance-frontend-browser-evidence-2026-07-17.md` |

Phase 0至Phase 7的领域实现、静态硬切和浏览器证据已经完成。Phase 7删除旧人员绩效类型、旧静态结果Mock、测试夹具和兼容克隆逻辑，并锁定管理端与员工端共用三Tab结果抽屉。PF-29完成多页面消费者一致性证据；PF-32完成当前账号来源草稿、管理端发布、员工确认、管理端回读及全新会话直接可见。当前前端会在每次应用启动时按现有任务来源重新构建一条演示正式结果；员工确认仍是会话状态，刷新后重置为该演示结果的待确认状态，不代表后端持久化。
