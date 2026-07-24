# 任务客户应收前端验收追踪

Status: `passed_frontend_only`

Scope: frontend session only

Source plan: `docs/governance/task-customer-receivable-frontend-hardcut-execution-acceptance-plan-v1.md`

## 1. 证据规则

每个验收项必须能够追溯到业务输入、领域计算、跨模块结果和自动或浏览器证据。类型检查、构建成功和测试总数不能替代单项业务证据。

## 2. 追踪矩阵

| ID | 实现证据 | 自动证据 | 浏览器证据 | 状态 |
| --- | --- | --- | --- | --- |
| TR-01 | `brandTaskPricingModel.ts` 品牌维度解析 | `brandTaskPricingModel.test.ts` | N/A | 自动通过 |
| TR-02 | 计费任务价格校验与任务创建阻断 | `brandTaskPricingModel.test.ts` | 品牌抽屉字段完整 | 通过 |
| TR-03 | 有效合同校验 | `brandTaskPricingModel.test.ts` | N/A | 自动通过 |
| TR-04 | 合同客户归属校验 | `brandTaskPricingModel.test.ts` | 品牌抽屉仅出现同客户合同 | 通过 |
| TR-05 | 价格及结算规则版本替换命令；规则改动按生效月份切换 | `brandTaskPricingModel.test.ts` | N/A | 自动通过 |
| TR-06 | `TaskCustomerBillingSnapshot` 冻结版本和金额 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-07 | 验收提交生成 `CustomerTaskBillingFact`；缺少结算快照时任务、绩效和结算事实均不写入 | `taskCustomerBillingModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-08 | 验收提交按任务事实 ID 幂等 | `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-09 | 返工重验保持事实身份 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-10 | 中止任务不生成事实 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-11 | 不计费事实保留但不生成批次 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-12 | 按任务形成确定性批次和已确认应收 | `taskCustomerBillingModel.test.ts`, `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-13 | 月末按同组汇总 | `taskCustomerBillingModel.test.ts`, `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-14 | 月末前不冻结 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-15 | 迟到事实不覆盖原应收，并在后续期间生成独立调整应收 | `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-16 | 客户应收和兼职劳务应付独立 | `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-17 | 固定金额合同额度软提醒 | `taskCustomerBillingModel.test.ts` | 品牌详情展示合同金额、已结算、剩余额度和阈值状态 | 通过 |
| TR-18 | 到期合同不能支撑新快照 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-19 | 客户、品牌和合同名称使用历史快照 | `financeCustomerTaskSettlementModel.test.ts` | 应收来源抽屉展示冻结名称 | 通过 |
| TR-20 | 后续改价不覆盖原应收和历史价格 | `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-21 | 客户价格字段不进入员工任务 UI | UI 残留扫描 | 任务列表、人员任务、待提交、待验收均无客户金额字段 | 通过 |
| TR-22 | 品牌抽屉维护结算规则和价格 | 组件和状态命令 | 品牌抽屉展示结算规则、任务单价和同客户合同 | 通过 |
| TR-23 | 合同页面无新增计价入口 | 路由和组件残留扫描 | 合同页面无任务计价入口 | 通过 |
| TR-24 | 应收详情展示品牌、合同、任务、验收和金额 | `FinanceReceivablesPayablesDetailDrawer.tsx` | 应收抽屉展示完整来源快照 | 通过 |
| TR-25 | 任务应收进入发票、收款登记、流水复核、结清、权责及资金凭证并记入总账 | `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-26 | 来源客户或品牌档案缺失时拒绝生成不完整应收并显式报告交接异常 | `financeCustomerTaskSettlementModel.ts` | `financeCustomerTaskSettlementModel.test.ts` | 自动通过 |
| TR-27 | 撤销尚未被财务下游消费的任务验收 | 对应应收作废并保留操作记录；重新验收恢复同一结算事实，不生成重复应收 | `financeCustomerTaskSettlementModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-28 | 撤销已被发票、有效凭证、有效收付款或锁期消费的任务验收 | 保留原应收历史并产生“来源撤销待财务更正”事项；完整冲正后的原流水和已冲销凭证不再被误判为仍有效消费 | `financeCustomerTaskSettlementModel.test.ts`, `financeReceivablesPayablesModel.test.ts`, `FinanceManagementState.tsx` | 自动与代码证据通过 |
| TR-29 | 撤销任务验收的跨模块反向结果 | 任务回到待验收，结算事实冲销，绩效停止计入，劳务来源保留并标记撤销，验收归档作废 | `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-30 | 内部验收生成可追溯归档 | 验收提交生成稳定文件地址，任务应收冻结并复用该归档 | `taskCustomerBillingModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-31 | 兼职劳务资料不完整 | 内部验收、客户结算事实和绩效正常提交；仅劳务结算保留阻断 | `partTimeLaborFrontendWorkflow.test.ts` | 自动通过 |
| TR-32 | 合同收款只读取已入账的关联流水 | 待复核流水不计入合同已收金额，复核入账后才进入合同收款摘要 | `contractReceiptModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-33 | 已入账收款冲正后回退合同已收金额 | 原收款与冲正记录均保留，合同已收金额按有效净额重新推导 | `contractReceiptModel.test.ts` | 自动通过 |
| TR-34 | 合同收款按结构化合同标识隔离 | 同一客户的不同合同不会因名称或客户相同而串入收款 | `contractReceiptModel.test.ts` | 自动通过 |
| TR-35 | 任务结算应收复用合同快照并排除作废事项 | 任务应收可追溯至合同，作废应收不再进入合同收款摘要 | `contractReceiptModel.test.ts` | 自动通过 |
| TR-36 | 内部验收驳回与甲方反馈解耦 | 驳回仅要求驳回原因和整改要求；甲方反馈作为可选关联事实 | `taskDomainModel.test.ts` | 自动通过 |
| TR-37 | 撤销验收前显示跨模块后果 | 确认撤销前明确任务、绩效、结算来源和已被财务消费事项的处理方式 | `StoreTasksPage.tsx`, `taskCustomerReceivableFrontendWorkflow.test.ts` | 代码与自动证据通过 |
| TR-38 | 内部验收与甲方验收解耦 | 内部验收形成可追溯的待甲方验收事实，不生成客户应收，任务绩效和兼职劳务仍按内部验收处理 | `taskCustomerBillingModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-39 | 甲方验收形成净额应收 | 录入 0-100 分、时效结果和必要备注后，系统按任务冻结的品牌验收规则计算扣分、扣款率及净额；应收金额等于冻结标准金额减系统扣款 | `taskCustomerBillingModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-40 | 甲方验收录入校验 | 评分范围、时效结果和存在扣罚或不计时时备注必填均由领域模型统一校验；用户不能手填扣款金额 | `taskDomainModel.test.ts` | 自动通过 |
| TR-41 | 甲方验收可审计更正 | 结果保持单一当前记录；业务值未变化时拒绝空更正；真实更正原因必填并贯穿计费事实、结算快照和应收重算记录，首次录入审计不被覆盖 | `taskDomainModel.test.ts`, `financeCustomerTaskSettlementModel.test.ts`, `TaskDetailDrawer.tsx`, `FinanceReceivablesPayablesDetailDrawer.tsx` | 自动与代码证据通过 |
| TR-42 | 跨月甲方验收归属 | 结算归属期和按任务到期日起算点只读取甲方实际验收日期，不读取系统录入时间 | `taskCustomerBillingModel.test.ts`, `financeCustomerTaskSettlementModel.test.ts` | 自动通过 |
| TR-45 | 品牌验收规则累计计算 | 质量和时效分别产生扣分并累计映射扣款比例；达标未超时不扣款，10 分扣 20%，20 分及以上扣 50% | `taskCustomerBillingModel.test.ts` | 自动通过 |
| TR-46 | 单一验收配置与任务快照 | 品牌只维护一份当前配置；保存后新任务立即读取，历史任务继续使用创建时冻结的规则内容 | `taskCustomerBillingModel.test.ts`, `TaskManagementState.tsx` | 自动与代码证据通过 |
| TR-43 | 未消费应收随来源更正重算 | 原应收未被发票、收付款、凭证或锁期使用时，按最新验收日期、扣款和净额直接重算且不产生重复应收 | `financeCustomerTaskSettlementModel.test.ts` | 自动通过 |
| TR-44 | 已消费与零净额更正 | 已消费应收保留原事实并进入唯一更正事项；待复核流水进入流水复核，已入账流水进入收支流水，已开票进入红票更正，已记账且已结账进入后续期间差额凭证；更正后的有效确认金额驱动应收余额，发票、流水或凭证仍超出新金额时事项不得关闭；重复更正使用独立事项标识；未消费任务更正为零净额时移除对应应收行或作废整单 | `financeCustomerTaskSettlementModel.test.ts`, `financeAccountingVoucherModel.test.ts`, `FinanceReceivablesPayablesPage.tsx`, `FinanceReceivablesPayablesDetailDrawer.tsx`, `FinanceReviewPage.tsx`, `FinanceInvoicesPage.tsx`, `FinanceAccountingVouchersPage.tsx`, `FinanceManagementState.tsx` | 自动与代码证据通过 |

## 3. 原型边界

- 通过项只证明当前前端会话内的领域行为。
- 后端持久化、并发幂等、数据库唯一约束、服务端权限和审计仍未实施。
- 甲方验收更正后，未被下游消费的任务应收直接按最新业务事实重算；已有发票、收付款、已记账凭证或期间锁的应收不覆盖原单，也不自动生成第二条应收，而是进入冲销或后续调整口径。后端接入后仍需以事务、期间锁和唯一约束保证正式调整的幂等与不可变性。
- 已消费来源更正分三段验收：应收应付页负责发现并定位异常；详情抽屉依据实际占用事实提供发票关联、流水回看或凭证冲销/后续调整入口；发票解除、流水冲正和凭证冲销后的有效占用状态由现有领域模型重新计算。前端不得直接覆盖已消费原应收。
- 来源主数据缺失在本期仅作为应收页只读交接异常呈现，不增加跨模块跳转或新的处理页面；正式修复入口留待主数据治理范围单独设计。
- 固定金额合同额度仅是管理提醒：品牌当前计费配置中的固定金额合同先进入额度台账，尚无验收事实时显示 `0` 使用额；已结算金额基于有效已验收计费事实累计，达到 `80%` 提醒接近上限，达到或超过 `100%` 提醒已超出；不阻断任务创建、验收或应收生成。
- 统一收入政策调整为：内部验收完成任务、绩效和兼职劳务，并形成 `待甲方验收` 客户结算事实；甲方验收录入后该事实生效并按扣款后的净额生成应收。甲方验收是独立业务结果，不改变任务主状态，也不新增审批流或独立子模块。
- 内部验收驳回只依赖内部的驳回原因和整改要求；甲方反馈是可选关联记录，不得作为内部驳回门禁。
- 验收归档是客户任务应收的来源证据，必须具有稳定文件地址；只有标签而没有地址的 Mock 文件不能作为财务确认依据。
- 兼职劳务资料与客户收入是两条独立链路。资料缺失只阻断自然人劳务应付，不得阻断客户任务收入和任务绩效。
- 撤销验收不会删除历史事实。财务尚未消费时直接作废或重算应收；已经被发票、凭证、收付款或锁期消费时保留原记录，并要求通过冲销或后续调整更正。
- 完整冲正会按原流水与冲正净额判断下游是否仍在消费来源；只存在已冲销凭证时也不继续锁死来源。重新验收必须复用原事实身份，不能因历史作废记录而永久停留在冲销状态。
- 合同页“收款概况/收款记录”已改为本链路的只读派生视图：任务应收冻结 `contractId`，只有对应应收的有效已入账收款计入合同已收金额；待复核不计入，冲正按净额回退并保留原收款与冲正记录。合同页不承担登记、复核、对账或会计处理。

## 4. 浏览器证据

- `docs/evidence/task-customer-receivable-frontend-browser-evidence-2026-07-17.md`
- `docs/evidence/browser/task-customer-receivable/browser-results.json`
- `docs/evidence/browser/task-customer-receivable/brand-pricing-edit.png`
- `docs/evidence/browser/task-customer-receivable/contract-page-unchanged.png`
- `docs/evidence/browser/task-customer-receivable/receivable-task-source-drawer.png`
